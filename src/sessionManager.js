import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeInMemoryStore,
  delay,
  fetchLatestBaileysVersion
} from '@itsliaaa/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import path from 'path'
import fs from 'fs'
import { logger } from './utils/logger.js'
import { createClient } from 'redis'

const SESSIONS_DIR = process.env.SESSIONS_DIR || './sessions'
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379'
const INSTANCE_ID = process.env.INSTANCE_ID || Math.random().toString(36).substring(2, 8)

const redisClient = createClient({ url: REDIS_URL })
redisClient.on('error', (err) => logger.error('Redis Client Error', err))
redisClient.connect().catch(err => logger.error('Redis Connect Error', err))

export class SessionManager {
  constructor(wss) {
    this.sessions = new Map()    // sessionId -> { sock, store, status, qr, pairingCode }
    this.wss = wss
    this._ensureSessionsDir()
    this._restoreSessions()
  }

  _ensureSessionsDir() {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    }
  }

  async _restoreSessions() {
    try {
      const dirs = fs.readdirSync(SESSIONS_DIR)
      for (const dir of dirs) {
        const sessionPath = path.join(SESSIONS_DIR, dir)
        if (fs.statSync(sessionPath).isDirectory()) {
          logger.info(`Restoring session: ${dir}`)
          await this.createSession(dir)
        }
      }
    } catch (err) {
      logger.error('Failed to restore sessions:', err)
    }
  }

  _broadcast(sessionId, event, data) {
    if (!this.wss) return
    this.wss.clients.forEach((ws) => {
      if (ws.readyState === 1 && (ws.sessionId === sessionId || ws.sessionId === '*')) {
        ws.send(JSON.stringify({ sessionId, event, data, timestamp: Date.now() }))
      }
    })
  }

  async createSession(sessionId, phoneNumber = null) {
    if (this.sessions.has(sessionId)) {
      return { exists: true, status: this.sessions.get(sessionId).status }
    }

    const lockKey = `session_lock:${sessionId}`
    if (redisClient.isOpen) {
      const acquired = await redisClient.set(lockKey, INSTANCE_ID, { NX: true, EX: 30 })
      if (!acquired && (await redisClient.get(lockKey)) !== INSTANCE_ID) {
        logger.info(`Session ${sessionId} is locked by another worker`)
        return { exists: true, status: 'locked', lockedByOther: true }
      }
    }

    const sessionPath = path.join(SESSIONS_DIR, sessionId)
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true })
    }

    const sessionData = {
      sock: null,
      store: null,
      status: 'connecting',
      qr: null,
      pairingCode: null,
      phoneNumber,
      retries: 0,
      lockInterval: redisClient.isOpen ? setInterval(async () => {
        try {
          const owner = await redisClient.get(lockKey)
          if (owner === INSTANCE_ID) await redisClient.expire(lockKey, 30)
        } catch (err) {}
      }, 15000) : null
    }
    this.sessions.set(sessionId, sessionData)

    const connect = async () => {
      try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
        const { version } = await fetchLatestBaileysVersion()

        const silentLogger = pino({ level: 'silent' })

        const sock = makeWASocket({
          version,
          logger: silentLogger,
          auth: state,
          printQRInTerminal: false,
          generateHighQualityLinkPreview: true
        })

        const store = makeInMemoryStore({ logger: silentLogger })
        store.bind(sock.ev)

        sessionData.sock = sock
        sessionData.store = store

        sock.ev.on('creds.update', saveCreds)

        sock.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr } = update

          if (qr) {
            sessionData.qr = qr
            sessionData.status = 'qr'
            this._broadcast(sessionId, 'qr', { qr })
            logger.info(`QR generated for session ${sessionId}`)

            // Auto-request pairing code if phone number provided
            if (phoneNumber && !sock.authState.creds.registered) {
              try {
                await delay(1500)
                const code = await sock.requestPairingCode(phoneNumber)
                sessionData.pairingCode = code
                sessionData.status = 'pairing'
                this._broadcast(sessionId, 'pairing_code', { code })
                logger.info(`Pairing code for ${sessionId}: ${code}`)
              } catch (e) {
                logger.error(`Pairing code error for ${sessionId}:`, e)
              }
            }
          }

          if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut

            sessionData.status = 'disconnected'
            this._broadcast(sessionId, 'disconnected', { statusCode, shouldReconnect })

            if (shouldReconnect && sessionData.retries < 5) {
              sessionData.retries++
              logger.info(`Reconnecting session ${sessionId} (attempt ${sessionData.retries})`)
              await delay(2000 * sessionData.retries)
              connect()
            } else if (!shouldReconnect) {
              logger.info(`Session ${sessionId} logged out`)
              this._cleanup(sessionId)
            }
          } else if (connection === 'open') {
            sessionData.status = 'connected'
            sessionData.qr = null
            sessionData.pairingCode = null
            sessionData.retries = 0
            this._broadcast(sessionId, 'connected', { user: sock.user })
            logger.info(`Session ${sessionId} connected as ${sock.user?.id}`)
          } else if (connection === 'connecting') {
            sessionData.status = 'connecting'
            this._broadcast(sessionId, 'connecting', {})
          }
        })

        // Forward all events to WebSocket clients
        const events = [
          'messages.upsert', 'messages.update', 'messages.delete',
          'messages.reaction', 'message-receipt.update', 'messages.media-update',
          'chats.upsert', 'chats.update', 'chats.delete', 'chats.lock',
          'contacts.upsert', 'contacts.update',
          'presence.update',
          'groups.upsert', 'groups.update', 'group-participants.update',
          'group.join-request', 'group.member-tag.update',
          'blocklist.set', 'blocklist.update',
          'call',
          'labels.edit', 'labels.association',
          'newsletter.reaction', 'newsletter.view',
          'newsletter-participants.update', 'newsletter-settings.update',
          'settings.update'
        ]

        events.forEach((event) => {
          sock.ev.on(event, (data) => {
            this._broadcast(sessionId, event, data)
          })
        })

      } catch (err) {
        logger.error(`Session ${sessionId} connect error:`, err)
        sessionData.status = 'error'
        this._broadcast(sessionId, 'error', { message: err.message })
      }
    }

    await connect()
    return { created: true, status: sessionData.status }
  }

  _cleanup(sessionId) {
    const sessionData = this.sessions.get(sessionId)
    if (sessionData?.lockInterval) {
      clearInterval(sessionData.lockInterval)
    }
    if (redisClient.isOpen) {
      redisClient.get(`session_lock:${sessionId}`).then(owner => {
        if (owner === INSTANCE_ID) redisClient.del(`session_lock:${sessionId}`)
      }).catch(() => {})
    }

    if (sessionData?.sock) {
      try { sessionData.sock.end() } catch (_) {}
    }
    this.sessions.delete(sessionId)
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId)
  }

  getSessionSock(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session '${sessionId}' not found`)
    if (session.status !== 'connected') throw new Error(`Session '${sessionId}' is not connected (status: ${session.status})`)
    return session.sock
  }

  async deleteSession(sessionId) {
    const sessionData = this.sessions.get(sessionId)
    if (!sessionData) return false

    if (sessionData.sock) {
      try {
        await sessionData.sock.logout()
      } catch (_) {}
      try {
        sessionData.sock.end()
      } catch (_) {}
    }

    this.sessions.delete(sessionId)

    // Delete session files
    const sessionPath = path.join(SESSIONS_DIR, sessionId)
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true })
    }

    return true
  }

  listSessions() {
    const result = []
    for (const [id, data] of this.sessions.entries()) {
      result.push({
        id,
        status: data.status,
        user: data.sock?.user || null,
        hasQr: !!data.qr,
        hasPairingCode: !!data.pairingCode
      })
    }
    return result
  }

  getSessionCount() {
    return this.sessions.size
  }

  async closeAll() {
    for (const [id] of this.sessions.entries()) {
      await this.deleteSession(id)
    }
  }

  async requestPairingCode(sessionId, phoneNumber, customCode = null) {
    const sock = this.getSessionSock(sessionId)
    return await sock.requestPairingCode(phoneNumber, customCode)
  }
}
