import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  delay,
  makeInMemoryStore,
} from '@itsliaaa/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import fs from 'fs'
import path from 'path'
import qrcode from 'qrcode'
import { createClient } from 'redis'

const SESSIONS_DIR  = process.env.SESSIONS_DIR  || './sessions'
const REDIS_URL     = process.env.REDIS_URL     || 'redis://redis:6379'
const INSTANCE_ID   = process.env.INSTANCE_ID   || `worker-${process.pid}`
const LOCK_TTL_MS   = 30_000   // lock expires after 30 s if not renewed
const LOCK_RENEW_MS = 10_000   // renew every 10 s

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

// ─────────────────────────────────────────────────────────────────────────────

export class SessionManager {
  constructor() {
    this.sessions = new Map()
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    this._restoreExistingSessions()
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
    if (!s || !s.store)
      throw new Error(`Session '${sessionId}' store not available`)
    return s.store
  }

  // ── Create / connect a session ─────────────────────────────────────────────

  async createSession(sessionId, { phoneNumber, pairingCode: customCode, webhook } = {}) {
    const sessionDir = path.join(SESSIONS_DIR, sessionId)
    const webhookFile = path.join(SESSIONS_DIR, sessionId, 'webhook.txt')

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
      webhookQueue: [],
      webhookProcessing: false,
    }
    this.sessions.set(sessionId, sessionData)

    // Keep the lock alive
    sessionData.lockRenewer = setInterval(() => renewLock(sessionId), LOCK_RENEW_MS)

    // ── Webhook helper ──────────────────────────────────────────────────────
    const sendWebhook = (event, data) => {
      sessionData.webhookQueue.push({ event, data })
      processWebhookQueue()
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
      try {
        sessionData.status = 'connecting'
        const logger               = pino({ level: process.env.LOG_LEVEL || 'silent' })
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

        const sock = makeWASocket({
          logger,
          auth:               state,
          printQRInTerminal:  false,
          browser:            ['Ubuntu', 'Chrome', '20.0.04'],
          markOnlineOnConnect: true,
          getMessage: async (key) => {
            if (sessionData.store) {
              const msg = await sessionData.store.loadMessage(key.remoteJid, key.id)
              return msg?.message || undefined
            }
            return { conversation: 'Offline message sync' }
          }
        })

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
        sock.ev.process((events) => {
          for (const [event, data] of Object.entries(events)) {
            if (event === 'connection.update') continue;

            if (event === 'messages.upsert' && data.messages && Array.isArray(data.messages)) {
              // Ignore history syncs ('append'), only forward real-time new messages ('notify')
              if (data.type !== 'notify') continue;

              // Queue messages one by one so the backend can process them sequentially
              for (const msg of data.messages) {
                // Optional: skip messages sent by the bot itself to prevent infinite auto-reply loops
                if (msg.key.fromMe) continue;
                
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
          const { connection, lastDisconnect, qr } = update

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
            sessionData.status      = 'open'
            sessionData.qrDataURL   = null
            sessionData.pairingCode = null
            sessionData.retries440  = 0
            sessionData.retries     = 0
            sessionData.phone       = sock.authState.creds.me?.id || phoneNumber || null
            console.log(`[${sessionId}] ✅ Connected as ${sessionData.phone}`)
            sendWebhook('connected', { user: sock.authState.creds.me })

          } else if (connection === 'close') {
            const code       = new Boom(lastDisconnect?.error)?.output?.statusCode
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

            // ── Conflict (440) – another socket connected with same creds ─
            if (isConflict) {
              const owner = await getLockOwner(sessionId)
              if (owner !== INSTANCE_ID) {
                console.log(`[${sessionId}] Lock moved to ${owner} – shutting down this copy`)
                this._cleanup(sessionId)
                return
              }

              console.error(`[${sessionId}] 440 conflict (replaced). Forcefully deleting session to prevent infinite loop. Please re-scan QR.`)
              sendWebhook('disconnected', { statusCode: code, reason: 'conflict_loop' })
              this._cleanup(sessionId)
              try { fs.rmSync(sessionDir, { recursive: true, force: true }) } catch {}
              return
            }

            // ── Normal / transient disconnect – reconnect ──────────────────
            sendWebhook('disconnected', { statusCode: code })
            sessionData.retries++
            if (sessionData.retries > 8) {
              console.error(`[${sessionId}] Too many reconnect attempts – giving up`)
              sendWebhook('disconnected', { statusCode: code, reason: 'retries_exhausted' })
              this._cleanup(sessionId)
              return
            }
            const waitMs = Math.min(3000 * sessionData.retries, 30_000)
            console.log(`[${sessionId}] Reconnecting in ${waitMs}ms (attempt ${sessionData.retries})`)
            await delay(waitMs)
            await doConnect()
          }
        })

      } catch (err) {
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
    if (s.lockRenewer) clearInterval(s.lockRenewer)
    if (s.sock) { try { s.sock.end() } catch {} }
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
}
