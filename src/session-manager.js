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

const SESSIONS_DIR = process.env.SESSIONS_DIR || './sessions'

export class SessionManager {
  constructor() {
    this.sessions = new Map()   // sessionId -> { sock, store, status, qr, pairingCode }
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  }

  count() { return this.sessions.size }

  list() {
    return [...this.sessions.entries()].map(([id, s]) => ({
      sessionId: id,
      status: s.status,
      phone: s.phone || null,
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
    if (s.qrDataURL) return { type: 'qr', data: s.qrDataURL }
    if (s.pairingCode) return { type: 'pairingCode', data: s.pairingCode }
    return null
  }

  getSocket(sessionId) {
    const s = this.sessions.get(sessionId)
    if (!s || s.status !== 'open') throw new Error(`Session '${sessionId}' is not connected`)
    return s.sock
  }

  async createSession(sessionId, { phoneNumber, pairingCode: customCode, webhook } = {}) {
    if (this.sessions.has(sessionId)) {
      return { sessionId, status: this.sessions.get(sessionId).status }
    }

    const sessionDir = path.join(SESSIONS_DIR, sessionId)
    fs.mkdirSync(sessionDir, { recursive: true })

    const sessionData = { status: 'connecting', sock: null, store: null, qrDataURL: null, pairingCode: null, phone: phoneNumber || null, webhook: webhook || null }
    this.sessions.set(sessionId, sessionData)

    const sendWebhook = (event, data) => {
      if (sessionData.webhook) {
        fetch(sessionData.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, event, data, timestamp: Date.now() })
        }).catch(err => console.error(`[${sessionId}] Webhook error for ${event}:`, err.message))
      }
    }

    const logger = pino({ level: process.env.LOG_LEVEL || 'silent' })
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

    const sock = makeWASocket({ logger, auth: state, printQRInTerminal: false, browser: ['Ubuntu', 'Chrome', '20.0.04'] })

    const store = makeInMemoryStore({ logger, socket: sock })
    store.bind(sock.ev)

    sessionData.sock = sock
    sessionData.store = store

    sock.ev.on('creds.update', saveCreds)

    sock.ev.process(async (events) => {
      for (const [event, data] of Object.entries(events)) {
        sendWebhook(event, data)
      }
    })

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        try {
          sessionData.qrDataURL = await qrcode.toDataURL(qr)
          sessionData.pairingCode = null
          sendWebhook('qr', { qr: sessionData.qrDataURL })
        } catch { sessionData.qrDataURL = qr }
      }

      if (connection === 'connecting') {
        sessionData.status = 'connecting'
        // Request pairing code if phone number provided and not yet registered
        if (phoneNumber && !sock.authState.creds.registered) {
          try {
            await delay(1500)
            const code = await sock.requestPairingCode(phoneNumber, customCode)
            sessionData.pairingCode = code
            sessionData.qrDataURL = null
            sendWebhook('pairing_code', { code })
            console.log(`[${sessionId}] Pairing code: ${code}`)
          } catch (e) {
            console.error(`[${sessionId}] Failed to request pairing code:`, e.message)
          }
        }
      } else if (connection === 'open') {
        sessionData.status = 'open'
        sessionData.qrDataURL = null
        sessionData.pairingCode = null
        sessionData.phone = sock.authState.creds.me?.id || phoneNumber || null
        console.log(`[${sessionId}] Connected as ${sessionData.phone}`)
        sendWebhook('connected', { user: sock.authState.creds.me })
      } else if (connection === 'close') {
        sessionData.status = 'closed'
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode
        const shouldReconnect = code !== DisconnectReason.loggedOut
        console.log(`[${sessionId}] Connection closed (${code}), reconnect=${shouldReconnect}`)
        sendWebhook('disconnected', { statusCode: code })
        if (shouldReconnect) {
          const storedWebhook = sessionData.webhook
          this.sessions.delete(sessionId)
          setTimeout(() => this.createSession(sessionId, { phoneNumber, pairingCode: customCode, webhook: storedWebhook }), 3000)
        } else {
          // If logged out (401), we MUST delete the local credentials directory
          // so a new QR code can be generated next time.
          try {
            const dir = path.join(SESSIONS_DIR, sessionId)
            fs.rmSync(dir, { recursive: true, force: true })
            console.log(`[${sessionId}] Deleted corrupted/logged-out session data from disk.`)
          } catch (e) {}
          this.sessions.delete(sessionId)
        }
      }
    })

    return { sessionId, status: 'connecting' }
  }

  async removeSession(sessionId) {
    const s = this.sessions.get(sessionId)
    if (s?.sock) {
      try { await s.sock.logout() } catch {}
    }
    this.sessions.delete(sessionId)
    const sessionDir = path.join(SESSIONS_DIR, sessionId)
    fs.rmSync(sessionDir, { recursive: true, force: true })
  }
}
