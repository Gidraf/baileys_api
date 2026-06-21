import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  delay,
  makeInMemoryStore,
  decryptPollVote,
  jidNormalizedUser,
} from '@itsliaaa/baileys'
import crypto from 'crypto'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import fs from 'fs'
import path from 'path'
import qrcode from 'qrcode'
import { createClient } from 'redis'
import AntiBan, { startPresenceCycling, stopPresenceCycling } from './antiban.js'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { getProxy as getWhatsAppProxy } from './proxy-pool.js'

// Lazy-import to break circular dep (webhooks imports session-manager indirectly)
let _recordWebhookEvent = null
async function getRecordWebhookEvent() {
  if (!_recordWebhookEvent) {
    const mod = await import('./routes/webhooks.js')
    _recordWebhookEvent = mod.recordWebhookEvent
  }
  return _recordWebhookEvent
}

const SESSIONS_DIR  = process.env.SESSIONS_DIR  || './sessions'
const REDIS_URL     = process.env.REDIS_URL     || 'redis://redis:6379'
const INSTANCE_ID   = process.env.INSTANCE_ID   || `worker-${process.pid}`
const LOCK_TTL_MS   = 30_000   // lock expires after 30 s if not renewed
const LOCK_RENEW_MS = 10_000   // renew every 10 s

function createProxyAgent(proxyUrl) {
  const protocol = new URL(proxyUrl).protocol.toLowerCase()
  if (protocol.startsWith('socks')) {
    return new SocksProxyAgent(proxyUrl)
  }
  if (protocol === 'http:' || protocol === 'https:') {
    return new HttpsProxyAgent(proxyUrl)
  }
  throw new Error(`Unsupported proxy protocol: ${protocol}`)
}

function resolveSessionProxy(sessionId) {
  const proxyUrl = getWhatsAppProxy(sessionId)
  if (!proxyUrl) {
    return {
      proxyUrl: null,
      proxyAgent: null,
      usingProxy: false,
    }
  }

  try {
    return {
      proxyUrl,
      proxyAgent: createProxyAgent(proxyUrl),
      usingProxy: true,
    }
  } catch (err) {
    console.warn(`[${sessionId}] Invalid proxy '${proxyUrl}', falling back to direct connection: ${err.message}`)
    return {
      proxyUrl: null,
      proxyAgent: null,
      usingProxy: false,
    }
  }
}

// ─── Redis client (gracefully disabled if unavailable) ────────────────────────
let _redis = null

async function getRedis() {
  if (_redis?.isOpen) return _redis
  try {
    _redis = createClient({ url: REDIS_URL })
    _redis.on('error', e => console.warn('[Redis] error (non-fatal):', e.message))
    await _redis.connect()
    console.log(`[Redis] connected (instance ${INSTANCE_ID})`)
  } catch (e) {
    console.warn('[Redis] unavailable – running single-worker mode:', e.message)
    _redis = null
  }
  return _redis
}

// ─── Distributed lock helpers ────────────────────────────────────────────────

async function acquireLock(sessionId) {
  const rc = await getRedis()
  if (!rc) return true  // no Redis → always proceed (single-worker)

  const key = `session-lock:${sessionId}`
  // NX = only set if key doesn't exist; PX = TTL in ms
  const result = await rc.set(key, INSTANCE_ID, { NX: true, PX: LOCK_TTL_MS })
  if (result === 'OK') return true

  // Already exists – check if we own it (e.g. after a restart)
  const owner = await rc.get(key)
  return owner === INSTANCE_ID
}

async function renewLock(sessionId) {
  const rc = await getRedis()
  if (!rc) return
  const owner = await rc.get(`session-lock:${sessionId}`)
  if (owner === INSTANCE_ID) await rc.pExpire(`session-lock:${sessionId}`, LOCK_TTL_MS)
}

async function getLockOwner(sessionId) {
  const rc = await getRedis()
  if (!rc) return INSTANCE_ID
  return await rc.get(`session-lock:${sessionId}`)
}

async function releaseLock(sessionId) {
  const rc = await getRedis()
  if (!rc) return
  const owner = await rc.get(`session-lock:${sessionId}`)
  if (owner === INSTANCE_ID) await rc.del(`session-lock:${sessionId}`)
}

// ── Webhook Parsing Helper ──────────────────────────────────────────────────
async function parseMessageForWebhooks(msg, store, sendWebhook) {
  const content = msg.message;
  if (!content) return;

  // 1. Poll Update / Vote
  if (content.pollUpdateMessage) {
    const pollUpdate = content.pollUpdateMessage;
    const creationMsgKey = pollUpdate.pollCreationMessageKey;
    if (creationMsgKey) {
      try {
        const pollMsg = await store.loadMessage(creationMsgKey.remoteJid, creationMsgKey.id);
        if (pollMsg) {
          // The messageSecret may be deserialized from JSON as a plain object {type:'Buffer',data:[...]}
          // instead of a Uint8Array. Re-hydrate it so hmacSign doesn't fail.
          let pollEncKey = pollMsg.messageContextInfo?.messageSecret;
          if (pollEncKey && !Buffer.isBuffer(pollEncKey) && !(pollEncKey instanceof Uint8Array)) {
            // Handle JSON deserialized Buffer: {type:'Buffer',data:[...]} or just {data:[...]}
            if (pollEncKey.data) {
              pollEncKey = Buffer.from(pollEncKey.data);
            } else if (Array.isArray(pollEncKey)) {
              pollEncKey = Buffer.from(pollEncKey);
            }
          }
          if (pollEncKey) {
            // Ensure it's a proper Buffer
            pollEncKey = Buffer.from(pollEncKey);
            
            const pollCreatorJid = jidNormalizedUser(creationMsgKey.participant || creationMsgKey.remoteJid);
            const voterJid = jidNormalizedUser(msg.key.participant || msg.key.remoteJid);

            console.log(`[Poll] Decrypting vote from ${voterJid} on poll ${creationMsgKey.id} by ${pollCreatorJid}`);
            
            const decrypted = decryptPollVote(
              pollUpdate.vote,
              {
                pollEncKey,
                pollCreatorJid,
                pollMsgId: creationMsgKey.id,
                voterJid
              }
            );

            // Cover all poll creation message variants (V1 through V5)
            const pollCreationMsg = pollMsg.message?.pollCreationMessage ||
                                   pollMsg.message?.pollCreationMessageV2 ||
                                   pollMsg.message?.pollCreationMessageV3 ||
                                   pollMsg.message?.pollCreationMessageV4 ||
                                   pollMsg.message?.pollCreationMessageV5;

            const pollName = pollCreationMsg?.name || "";
            const originalPollOptions = pollCreationMsg?.options?.map(o => o.optionName) || [];

            console.log(`[Poll] Decrypted selectedOptions count: ${decrypted?.selectedOptions?.length ?? 'null'}, original options: [${originalPollOptions.join(', ')}]`);

            if (decrypted && decrypted.selectedOptions !== undefined) {
              const selectedOptionsHex = decrypted.selectedOptions.map(h => Buffer.from(h).toString('hex'));
              
              const selectedOptions = originalPollOptions.filter(opt => {
                const optHash = crypto.createHash('sha256').update(opt).digest('hex');
                return selectedOptionsHex.includes(optHash);
              });

              console.log(`[Poll] Resolved vote: [${selectedOptions.join(', ')}] from hashes: [${selectedOptionsHex.join(', ')}]`);

              // Send poll.vote event (also fires on deselect-all: selectedOptions=[])
              sendWebhook('poll.vote', {
                pollJid: creationMsgKey.remoteJid,
                pollId: creationMsgKey.id,
                pollName,
                voterJid,
                selectedOptions,
                selectedOptionsHashes: selectedOptionsHex,
                timestamp: Number(pollUpdate.senderTimestampMs) || Date.now()
              });

              // Track in-memory poll updates for this poll message to generate results
              if (!pollMsg.pollUpdates) pollMsg.pollUpdates = [];
              const existingVoteIdx = pollMsg.pollUpdates.findIndex(v => v.pollUpdateMessageKey?.id === msg.key.id);
              if (existingVoteIdx > -1) {
                pollMsg.pollUpdates[existingVoteIdx] = {
                  pollUpdateMessageKey: msg.key,
                  vote: decrypted,
                  senderTimestampMs: pollUpdate.senderTimestampMs
                };
              } else {
                pollMsg.pollUpdates.push({
                  pollUpdateMessageKey: msg.key,
                  vote: decrypted,
                  senderTimestampMs: pollUpdate.senderTimestampMs
                });
              }

              // Compute results tally
              const results = {};
              originalPollOptions.forEach(opt => { results[opt] = 0; });
              
              const latestVotes = new Map();
              pollMsg.pollUpdates.forEach(u => {
                const voter = jidNormalizedUser(u.pollUpdateMessageKey.participant || u.pollUpdateMessageKey.remoteJid);
                let decVote = u.vote;
                // decVote already has selectedOptions if it was decrypted in this run
                if (decVote && decVote.selectedOptions !== undefined) {
                  // selectedOptions may be empty (deselect-all) — still track it to zero-out old votes
                  latestVotes.set(voter, decVote.selectedOptions.map(h => Buffer.from(h).toString('hex')));
                } else if (decVote) {
                  // Old stored raw vote that needs re-decryption
                  try {
                    decVote = decryptPollVote(
                      decVote,
                      { pollEncKey, pollCreatorJid, pollMsgId: creationMsgKey.id, voterJid: voter }
                    );
                    if (decVote && decVote.selectedOptions !== undefined) {
                      latestVotes.set(voter, decVote.selectedOptions.map(h => Buffer.from(h).toString('hex')));
                    }
                  } catch (e) {}
                }
              });

              let totalVotes = 0;
              latestVotes.forEach((optsHex) => {
                originalPollOptions.forEach(opt => {
                  const optHash = crypto.createHash('sha256').update(opt).digest('hex');
                  if (optsHex.includes(optHash)) {
                    results[opt]++;
                    totalVotes++;
                  }
                });
              });

              sendWebhook('poll.result', {
                pollJid: creationMsgKey.remoteJid,
                pollId: creationMsgKey.id,
                pollName,
                results,
                totalVotes,
                timestamp: Date.now()
              });
            }
          } else {
            console.warn(`[Poll] No messageSecret/pollEncKey found for poll ${creationMsgKey.id}. Check that messageContextInfo is stored correctly.`);
          }
        } else {
          console.warn(`[Poll] Poll creation message not found in store: JID=${creationMsgKey.remoteJid} ID=${creationMsgKey.id}. Cannot decrypt vote.`);
        }
      } catch (err) {
        console.error('[SessionManager] Failed to decrypt poll vote:', err.message);
        console.error(err.stack);
      }
    }
  }

  // 2. Interactive Response Message (NativeFlow / Cards / Buttons)
  const interactiveResponseMessage = content.interactiveResponseMessage;
  if (interactiveResponseMessage) {
    const nativeFlow = interactiveResponseMessage.nativeFlowResponseMessage;
    if (nativeFlow) {
      let parsedParams = null;
      try { parsedParams = JSON.parse(nativeFlow.paramsJson); } catch (e) { parsedParams = nativeFlow.paramsJson; }
      sendWebhook('interactive.response', {
        jid: jidNormalizedUser(msg.key.participant || msg.key.remoteJid),
        messageId: msg.key.id,
        response: {
          type: 'flow',
          name: nativeFlow.name,
          payload: parsedParams
        }
      });
    }
  }

  // 3. Button Response Message (Quick Reply / Template buttons)
  const buttonResponseMessage = content.buttonResponseMessage;
  if (buttonResponseMessage) {
    sendWebhook('interactive.response', {
      jid: jidNormalizedUser(msg.key.participant || msg.key.remoteJid),
      messageId: msg.key.id,
      response: {
        type: 'button',
        buttonId: buttonResponseMessage.selectedButtonId,
        displayText: buttonResponseMessage.selectedDisplayText
      }
    });
  }

  // 4. Template Button Reply Message
  const templateButtonReplyMessage = content.templateButtonReplyMessage;
  if (templateButtonReplyMessage) {
    sendWebhook('interactive.response', {
      jid: jidNormalizedUser(msg.key.participant || msg.key.remoteJid),
      messageId: msg.key.id,
      response: {
        type: 'template',
        buttonId: templateButtonReplyMessage.selectedId,
        displayText: templateButtonReplyMessage.selectedDisplayText,
        index: templateButtonReplyMessage.selectedIndex
      }
    });
  }

  // 5. List Response Message (Menu Lists)
  const listResponseMessage = content.listResponseMessage;
  if (listResponseMessage) {
    sendWebhook('interactive.response', {
      jid: jidNormalizedUser(msg.key.participant || msg.key.remoteJid),
      messageId: msg.key.id,
      response: {
        type: 'list',
        buttonId: listResponseMessage.singleSelectReply?.selectedRowId,
        title: listResponseMessage.title,
        description: listResponseMessage.description
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export class SessionManager {
  constructor() {
    this.sessions = new Map()
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    this._restoreExistingSessions()
    
    // Cleanup ephemeral sessions older than 24h
    setInterval(() => this._cleanupEphemeralSessions(), 1000 * 60 * 60)
  }

  async _cleanupEphemeralSessions() {
    try {
      const dirs = fs.readdirSync(SESSIONS_DIR)
      const now = Date.now()
      for (const dir of dirs) {
        const metaPath = path.join(SESSIONS_DIR, dir, 'meta.json')
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath))
          if (meta.ephemeral && meta.createdAt && (now - meta.createdAt > 24 * 60 * 60 * 1000)) {
            console.log(`[${dir}] Deleting expired ephemeral session`)
            await this.deleteSession(dir)
          }
        }
      }
    } catch (e) { console.error('[SessionManager] Cleanup error', e.message) }
  }

  // ── Restore sessions that exist on disk (on startup) ──────────────────────
  async _restoreExistingSessions() {
    try {
      const dirs = fs.readdirSync(SESSIONS_DIR)
      for (const dir of dirs) {
        const p = path.join(SESSIONS_DIR, dir)
        if (!fs.statSync(p).isDirectory()) continue
        // Stagger restores so workers don't all race for the same session
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 2500)))
        console.log(`[${dir}] Attempting auto-restore…`)
        this.createSession(dir, {}).catch(e =>
          console.error(`[${dir}] Auto-restore failed:`, e.message)
        )
      }
    } catch (e) {
      console.error('[SessionManager] Restore error:', e.message)
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  count() { return this.sessions.size }

  list() {
    return [...this.sessions.entries()].map(([id, s]) => ({
      sessionId: id,
      status:    s.status,
      phone:     s.phone || null,
    }))
  }

  getInfo(sessionId) {
    const s = this.sessions.get(sessionId)
    if (!s) return null
    return { sessionId, status: s.status, phone: s.phone || null }
  }

  getQR(sessionId) {
    const s = this.sessions.get(sessionId)
    if (!s) return null
    if (s.qrDataURL)    return { type: 'qr',          data: s.qrDataURL }
    if (s.pairingCode)  return { type: 'pairingCode', data: s.pairingCode }
    return null
  }

  getSocket(sessionId) {
    const s = this.sessions.get(sessionId)
    if (!s) throw new Error(`Session '${sessionId}' not found`)
    if (s.status !== 'open')
      throw new Error(`Session '${sessionId}' is not connected (status: ${s?.status}). Please try again when it is 'open'.`)
    if (!s.sock)
      throw new Error(`Session '${sessionId}' is initializing (no socket yet)`)
    return s.sock
  }

  // Alias for backward compatibility with route files
  getSessionSock(sessionId) {
    return this.getSocket(sessionId)
  }

  getStore(sessionId) {
    const s = this.sessions.get(sessionId)
    if (!s) throw new Error(`Session '${sessionId}' not found`)
    if (!s.store) throw new Error(`Session '${sessionId}' store not fully initialized yet.`)
    return s.store
  }

  // ── Create / connect a session ─────────────────────────────────────────────

  async createSession(sessionId, { phoneNumber, pairingCode: customCode, webhook, ephemeral } = {}) {
    const sessionDir = path.join(SESSIONS_DIR, sessionId)
    const webhookFile = path.join(SESSIONS_DIR, sessionId, 'webhook.txt')
    const metaFile = path.join(SESSIONS_DIR, sessionId, 'meta.json')

    // Already running in this worker
    if (this.sessions.has(sessionId)) {
      const existing = this.sessions.get(sessionId)
      if (webhook) {
        existing.webhook = webhook  // update webhook URL if changed
        try { fs.writeFileSync(webhookFile, webhook) } catch (e) {}
      }
      return { sessionId, status: existing.status }
    }

    // ── Distributed lock ────────────────────────────────────────────────────
    const owned = await acquireLock(sessionId)
    if (!owned) {
      const owner = await getLockOwner(sessionId)
      console.log(`[${sessionId}] Already owned by ${owner} – skipping`)
      return { sessionId, status: 'owned_elsewhere' }
    }

    fs.mkdirSync(sessionDir, { recursive: true })

    if (ephemeral && !fs.existsSync(metaFile)) {
      try { fs.writeFileSync(metaFile, JSON.stringify({ ephemeral: true, createdAt: Date.now() })) } catch (e) {}
    }

    let finalWebhook = webhook || null
    try {
      if (!webhook && fs.existsSync(webhookFile)) {
        finalWebhook = fs.readFileSync(webhookFile, 'utf8').trim()
      } else if (webhook) {
        fs.writeFileSync(webhookFile, webhook)
      }
    } catch (e) {
      console.warn(`[${sessionId}] Failed to read/write webhook file:`, e.message)
    }

    const sessionData = {
      status:       'connecting',
      sock:         null,
      store:        null,
      qrDataURL:    null,
      pairingCode:  null,
      phone:        phoneNumber || null,
      webhook:      finalWebhook,
      lockRenewer:  null,
      retries440:   0,
      retries:      0,
      hasConnectedOnce: false,
      webhookQueue: [],
      webhookProcessing: false,
    }
    const { proxyUrl, proxyAgent, usingProxy } = resolveSessionProxy(sessionId)
    sessionData.proxyUrl = proxyUrl
    sessionData.proxyAgent = proxyAgent
    if (usingProxy) {
      console.log(`[${sessionId}] Using WhatsApp proxy ${proxyUrl}`)
    } else {
      console.log(`[${sessionId}] No proxy available, using direct WhatsApp connection (backward compatibility)`)
    }
    this.sessions.set(sessionId, sessionData)

    // Keep the lock alive
    sessionData.lockRenewer = setInterval(() => renewLock(sessionId), LOCK_RENEW_MS)

    // ── Webhook helper ──────────────────────────────────────────────────────
    const sendWebhook = (event, data) => {
      sessionData.webhookQueue.push({ event, data })
      processWebhookQueue()
      // Also push to SSE event stream (playground viewer) — fire and forget
      getRecordWebhookEvent().then(fn => { try { fn(sessionId, event, data) } catch {} }).catch(() => {})
    }

    const processWebhookQueue = async () => {
      if (sessionData.webhookProcessing) return
      sessionData.webhookProcessing = true

      while (sessionData.webhookQueue.length > 0) {
        const { event, data } = sessionData.webhookQueue.shift()
        const url = sessionData.webhook
        if (url) {
          try {
            await fetch(url, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ sessionId, event, data, timestamp: Date.now() }),
            })
          } catch (err) {
            console.error(`[${sessionId}] Webhook error (${event}):`, err.message)
          }
        }
      }
      sessionData.webhookProcessing = false
    }

    // ── Internal connect function (called on reconnects too) ────────────────
    const doConnect = async () => {
      if (sessionData.dead) {
        console.log(`[${sessionId}] Session is dead. Aborting doConnect.`)
        return
      }
      try {
        sessionData.status = 'connecting'
        const logger               = pino({ level: process.env.LOG_LEVEL || 'silent' })
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

        const proxyInfo = sessionData.proxyUrl ? `via ${sessionData.proxyUrl}` : 'direct (no proxy)'
        console.log(`[${sessionId}] Creating socket ${proxyInfo}...`)

        const sock = makeWASocket({
          logger,
          auth:               state,
          agent:              sessionData.proxyAgent,
          fetchAgent:         sessionData.proxyAgent,
          printQRInTerminal:  false,
          browser:            ['Ubuntu', 'Chrome', '20.0.04'],
          markOnlineOnConnect: true,
          connectTimeoutMs:   30000,  // 30s timeout for connection establishment
          getMessage: async (key) => {
            if (sessionData.store) {
              const msg = await sessionData.store.loadMessage(key.remoteJid, key.id)
              return msg?.message || undefined
            }
            return undefined
          }
        })

        // Monitor for connection timeout (socket created but never reaches 'open' state)
        let connectionTimeoutHandle = null
        const setConnectionTimeout = () => {
          if (connectionTimeoutHandle) clearTimeout(connectionTimeoutHandle)
          connectionTimeoutHandle = setTimeout(() => {
            if (sessionData.sock === sock && sessionData.status === 'connecting') {
              console.warn(`[${sessionId}] Connection timeout (60s) in 'connecting' state. ${sessionData.proxyUrl ? 'Proxy may be slow. ' : ''}Closing socket...`)
              try { sock.end() } catch {}
              
              // If proxy was being used, try fallback to direct connection on next retry
              if (sessionData.proxyUrl) {
                console.warn(`[${sessionId}] Proxy connection timeout – will retry without proxy`)
                sessionData.proxyAgent = null
                sessionData.proxyUrl = null
              }
            }
          }, 60000)  // 60s timeout for reaching 'open' state after socket created
        }

        const clearConnectionTimeout = () => {
          if (connectionTimeoutHandle) clearTimeout(connectionTimeoutHandle)
        }

        const storePath = path.join(sessionDir, 'baileys_store_multi.json')
        const store = makeInMemoryStore({ logger, socket: sock })
        try {
            store.readFromFile(storePath)
        } catch (e) {
            console.error(`[${sessionId}] Failed to read store:`, e.message)
        }
        
        if (sessionData.storeInterval) clearInterval(sessionData.storeInterval)
        // Write to file periodically to persist messages without memory leaks
        sessionData.storeInterval = setInterval(() => {
          try {
             store.writeToFile(storePath)
          } catch (e) {
             console.error(`[${sessionId}] Failed to write store:`, e.message)
          }
        }, 10_000)

        store.bind(sock.ev)

        sessionData.sock  = sock
        sessionData.store = store

        sock.ev.on('creds.update', saveCreds)

        // ── Forward ALL Baileys events to webhook ──────────────────────────
        // We do this via ev.process so we get everything, but we ALSO
        // handle connection.update separately below to convert QR to dataURL.
        sock.ev.process(async (events) => {
          for (const [event, data] of Object.entries(events)) {
            if (event === 'connection.update') continue;

            if (event === 'messages.upsert' && data.messages && Array.isArray(data.messages)) {
              // Ignore history syncs ('append'), only forward real-time new messages ('notify')
              if (data.type !== 'notify') continue;

              // Queue messages one by one so the backend can process them sequentially
              for (const msg of data.messages) {
                // Optional: skip messages sent by the bot itself to prevent infinite auto-reply loops
                if (msg.key.fromMe) continue;
                
                // Parse messages for custom events (votes, interactive button replies)
                await parseMessageForWebhooks(msg, store, sendWebhook);
                
                sendWebhook('messages.upsert', { ...data, messages: [msg] })
              }
            } else {
              sendWebhook(event, data)
            }
          }
        })

        // ── Connection lifecycle ───────────────────────────────────────────
        sock.ev.on('connection.update', async (update) => {
          if (sessionData.sock && sessionData.sock !== sock) {
            return // Ignore events from old sockets to prevent loops
          }
          const { connection, lastDisconnect, qr, isNewLogin, isChallenge } = update
          
          // Log all connection updates for debugging
          if (connection) {
            console.log(`[${sessionId}] connection.update: connection=${connection}, isNewLogin=${isNewLogin}, isChallenge=${isChallenge}`)
          }

          // ── QR code ─────────────────────────────────────────────────────
          if (qr) {
            try {
              // Convert to PNG dataURL so the frontend can display it directly
              sessionData.qrDataURL   = await qrcode.toDataURL(qr)
              sessionData.pairingCode = null
            } catch {
              sessionData.qrDataURL = qr  // fall back to raw string
            }
            // Send the converted dataURL version
            sendWebhook('qr', { qr: sessionData.qrDataURL })
          }

          if (connection === 'connecting') {
            sessionData.status = 'connecting'
            sendWebhook('connection.update', { connection: 'connecting' })
            setConnectionTimeout()  // Start monitoring for connection timeout

            // Request pairing code if a phone number was provided
            if (phoneNumber && !sock.authState.creds.registered) {
              try {
                await delay(1500)
                const code              = await sock.requestPairingCode(phoneNumber, customCode)
                sessionData.pairingCode = code
                sessionData.qrDataURL   = null
                sendWebhook('pairing_code', { code })
                console.log(`[${sessionId}] Pairing code: ${code}`)
              } catch (e) {
                console.error(`[${sessionId}] Pairing code request failed:`, e.message)
              }
            }

          } else if (connection === 'open') {
            clearConnectionTimeout()  // Connection succeeded, clear timeout
            sessionData.status      = 'open'
            sessionData.qrDataURL   = null
            sessionData.pairingCode = null
            sessionData.retries440  = 0
            sessionData.retries     = 0
            sessionData.hasConnectedOnce = true
            sessionData.phone       = sock.authState.creds.me?.id || phoneNumber || null
            console.log(`[${sessionId}] ✅ Connected as ${sessionData.phone}`)
            sendWebhook('connected', { user: sock.authState.creds.me })
            // Start antiban presence cycling
            startPresenceCycling(sock, sessionId)

          } else if (connection === 'close') {
            clearConnectionTimeout()  // Connection closed, clear timeout
            const code = lastDisconnect?.error?.output?.statusCode || new Boom(lastDisconnect?.error)?.output?.statusCode;
            const isLoggedOut = code === DisconnectReason.loggedOut  // 401
            const isConflict  = code === 440

            console.log(`[${sessionId}] Connection closed (code=${code})`)
            sessionData.status = 'closed'

            // ── Permanent logout ──────────────────────────────────────────
            if (isLoggedOut) {
              sendWebhook('disconnected', { statusCode: code, reason: 'loggedOut' })
              this._cleanup(sessionId)
              // Delete auth state so a fresh QR can be issued next time
              try { fs.rmSync(sessionDir, { recursive: true, force: true }) } catch {}
              return
            }

            // ── Reset session if it fails repeatedly without ever connecting ─
            const isNetworkError = lastDisconnect?.error && [
              'ENOTFOUND',
              'EAI_AGAIN',
              'ECONNREFUSED',
              'ETIMEDOUT',
              'EHOSTUNREACH',
              'ECONNRESET'
            ].includes(lastDisconnect?.error?.code);

            if (!sessionData.hasConnectedOnce && sessionData.retries > 10 && !isNetworkError) {
              console.error(`[${sessionId}] Session failed to connect after 10 attempts without opening. Clearing auth state to reset QR code.`)
              sendWebhook('disconnected', { statusCode: code, reason: 'handshake_loop_reset' })
              this._cleanup(sessionId)
              try { fs.rmSync(sessionDir, { recursive: true, force: true }) } catch {}
              return
            }

            // ── Conflict (440) – another socket connected with same creds ─
            if (isConflict) {
              const owner = await getLockOwner(sessionId)
              if (owner !== INSTANCE_ID) {
                console.log(`[${sessionId}] Lock moved to ${owner} – shutting down this copy`)
                this._cleanup(sessionId)
                return
              }

              sessionData.retries440++
              if (sessionData.retries440 > 12) {
                console.error(`[${sessionId}] Too many 440 conflicts – forcing session deletion. Please re-scan QR.`)
                sendWebhook('disconnected', { statusCode: code, reason: 'conflict_loop' })
                this._cleanup(sessionId)
                try { fs.rmSync(sessionDir, { recursive: true, force: true }) } catch {}
                return
              }

              // Exponential back-off: 2s, 4s, 8s, 16s, 32s, max 60s
              const waitMs = Math.min(1000 * Math.pow(2, sessionData.retries440), 60_000)
              console.log(`[${sessionId}] 440 conflict #${sessionData.retries440} – waiting ${waitMs}ms before reconnecting...`)
              sendWebhook('disconnected', { statusCode: code, reason: 'conflict_retry' })
              
              await delay(waitMs)
              if (!sessionData.dead) {
                try { sock.end() } catch {}
                await doConnect()
              }
              return
            }

            // ── Normal / transient disconnect – reconnect ──────────────────
            sendWebhook('disconnected', { statusCode: code })
            sessionData.retries++
            
            // Retry indefinitely for normal disconnects, max wait 30s
            const waitMs = Math.min(2000 * sessionData.retries, 30_000)
            console.log(`[${sessionId}] Reconnecting in ${waitMs}ms (attempt ${sessionData.retries})`)
            await delay(waitMs)
            if (!sessionData.dead) {
              await doConnect()
            }
          }
        })

      } catch (err) {
        clearConnectionTimeout()  // Clear timeout on error
        console.error(`[${sessionId}] doConnect error:`, err.message)
        sessionData.status = 'error'
        sendWebhook('error', { message: err.message })
      }
    }

    await doConnect()
    return { sessionId, status: 'connecting' }
  }

  // ── Internal cleanup ───────────────────────────────────────────────────────

  _cleanup(sessionId) {
    const s = this.sessions.get(sessionId)
    if (!s) return
    s.dead = true
    if (s.storeInterval) clearInterval(s.storeInterval)
    if (s.lockRenewer) clearInterval(s.lockRenewer)
    if (s.sock) { try { s.sock.end() } catch {} }
    stopPresenceCycling(sessionId)
    releaseLock(sessionId)
    this.sessions.delete(sessionId)
  }

  // ── Public removal ─────────────────────────────────────────────────────────

  async removeSession(sessionId) {
    const s = this.sessions.get(sessionId)
    if (!s) return
    if (s.sock) { try { await s.sock.logout() } catch {} }
    this._cleanup(sessionId)
    const sessionDir = path.join(SESSIONS_DIR, sessionId)
    try { fs.rmSync(sessionDir, { recursive: true, force: true }) } catch {}
  }

  async removePartnerSessions(partnerId) {
    const deletedSessions = []
    
    // 1. Get all session IDs from memory and disk
    const sessionIds = new Set(this.sessions.keys())
    try {
      if (fs.existsSync(SESSIONS_DIR)) {
        const dirs = fs.readdirSync(SESSIONS_DIR)
        for (const dir of dirs) {
          const p = path.join(SESSIONS_DIR, dir)
          if (fs.statSync(p).isDirectory()) {
            sessionIds.add(dir)
          }
        }
      }
    } catch (e) {
      console.error('[SessionManager] Failed to read sessions dir for partner removal:', e.message)
    }

    // 2. Identify sessions belonging to this partner
    for (const sessionId of sessionIds) {
      const isMatch = sessionId === partnerId || 
                      sessionId.startsWith(partnerId + '_') || 
                      sessionId.startsWith(partnerId + '-')
      
      if (isMatch) {
        console.log(`[SessionManager] Deleting partner session: ${sessionId}`)
        // If active in memory, logout and clean up
        const activeSession = this.sessions.get(sessionId)
        if (activeSession) {
          if (activeSession.sock) { try { await activeSession.sock.logout() } catch {} }
          this._cleanup(sessionId)
        }
        // Clean up lock in Redis
        try { await releaseLock(sessionId) } catch {}
        
        // Clean up files on disk
        const sessionDir = path.join(SESSIONS_DIR, sessionId)
        try { fs.rmSync(sessionDir, { recursive: true, force: true }) } catch {}
        
        deletedSessions.push(sessionId)
      }
    }
    
    return deletedSessions
  }

  async clearAllSessions() {
    const deletedSessions = []
    
    // 1. Get all session IDs from memory and disk
    const sessionIds = new Set(this.sessions.keys())
    try {
      if (fs.existsSync(SESSIONS_DIR)) {
        const dirs = fs.readdirSync(SESSIONS_DIR)
        for (const dir of dirs) {
          const p = path.join(SESSIONS_DIR, dir)
          if (fs.statSync(p).isDirectory()) {
            sessionIds.add(dir)
          }
        }
      }
    } catch (e) {
      console.error('[SessionManager] Failed to read sessions dir for clear-all:', e.message)
    }

    // 2. Clean up and delete each session
    for (const sessionId of sessionIds) {
      console.log(`[SessionManager] Forcing cleanup of session: ${sessionId}`)
      const activeSession = this.sessions.get(sessionId)
      if (activeSession) {
        if (activeSession.sock) { try { await activeSession.sock.logout() } catch {} }
        this._cleanup(sessionId)
      }
      // Clean up lock in Redis
      try { await releaseLock(sessionId) } catch {}

      // Clean up files on disk
      const sessionDir = path.join(SESSIONS_DIR, sessionId)
      try { fs.rmSync(sessionDir, { recursive: true, force: true }) } catch {}
      
      deletedSessions.push(sessionId)
    }

    return deletedSessions
  }
}
