import express from 'express'
import { json } from 'express'
import multer from 'multer'
import { SessionManager } from './session-manager.js'
import { createMessageRoutes } from './routes/messages.js'
import { createGroupRoutes } from './routes/groups.js'
import { createProfileRoutes } from './routes/profile.js'
import { createNewsletterRoutes } from './routes/newsletter.js'
import { createBusinessRoutes } from './routes/business.js'
import { createPrivacyRoutes } from './routes/privacy.js'
import { createCommunityRoutes } from './routes/community.js'
import { createWebhookRoutes } from './routes/webhooks.js'
import AntiBan, { getStats as antibanStats } from './antiban.js'
import { getPool as getTsProxyPool } from './proxy-pool.js'

const app = express()
const PORT = process.env.PORT || 21465
const upload = multer({ storage: multer.memoryStorage() })

app.use(json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.use((req, _res, next) => {
  req.upload = upload
  next()
})

const sessionManager = new SessionManager()

// ─── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', sessions: sessionManager.count() }))

const apiRouter = express.Router()

// ─── Session Management ───────────────────────────────────────────────────────
apiRouter.post('/sessions', async (req, res) => {
  try {
    const { sessionId, phoneNumber, pairingCode, webhook } = req.body
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' })
    const result = await sessionManager.createSession(sessionId, { phoneNumber, pairingCode, webhook })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.get('/sessions', (_req, res) => {
  res.json({ sessions: sessionManager.list() })
})

apiRouter.get('/sessions/:sessionId', (req, res) => {
  const info = sessionManager.getInfo(req.params.sessionId)
  if (!info) return res.status(404).json({ error: 'Session not found' })
  res.json(info)
})

apiRouter.delete('/sessions', async (_req, res) => {
  try {
    const deleted = await sessionManager.clearAllSessions()
    res.json({ success: true, deletedCount: deleted.length, sessions: deleted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.delete('/sessions/partner/:partnerId', async (req, res) => {
  try {
    const deleted = await sessionManager.removePartnerSessions(req.params.partnerId)
    res.json({ success: true, deletedCount: deleted.length, sessions: deleted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.delete('/sessions/:sessionId', async (req, res) => {
  try {
    await sessionManager.removeSession(req.params.sessionId)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.get('/sessions/:sessionId/qr', (req, res) => {
  const data = sessionManager.getQR(req.params.sessionId)
  if (!data) return res.status(404).json({ error: 'No QR or pairing code available' })
  res.json(data)
})

// ─── Mount domain routes ──────────────────────────────────────────────────────
apiRouter.use('/sessions/:sessionId/messages',   createMessageRoutes(sessionManager))
apiRouter.use('/sessions/:sessionId/groups',     createGroupRoutes(sessionManager))
apiRouter.use('/sessions/:sessionId/profile',    createProfileRoutes(sessionManager, upload))
apiRouter.use('/sessions/:sessionId/newsletter', createNewsletterRoutes(sessionManager, upload))
apiRouter.use('/sessions/:sessionId/business',   createBusinessRoutes(sessionManager, upload))
apiRouter.use('/sessions/:sessionId/privacy',    createPrivacyRoutes(sessionManager))
apiRouter.use('/sessions/:sessionId/community',  createCommunityRoutes(sessionManager))

// ─── Webhook Management ───────────────────────────────────────────────────────
apiRouter.use('/webhooks', createWebhookRoutes(sessionManager))

// ─── AntiBan Stats ───────────────────────────────────────────────────────────
apiRouter.get('/sessions/:sessionId/antiban', async (req, res) => {
  try {
    const stats = await antibanStats(req.params.sessionId)
    res.json(stats)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Proxy Pool (Tailscale) ───────────────────────────────────────────────────
apiRouter.get('/proxy/pool', (_req, res) => {
  try { res.json(getTsProxyPool().status()) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

apiRouter.post('/proxy/pool/refresh', async (_req, res) => {
  try {
    await getTsProxyPool().forceRefresh()
    res.json({ refreshed: true, ...getTsProxyPool().status() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

apiRouter.delete('/proxy/pool/pin/:sessionId', (req, res) => {
  try {
    getTsProxyPool().unpin(req.params.sessionId)
    res.json({ unpinned: req.params.sessionId })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.use('/api', apiRouter)

import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── Serve Frontend ───────────────────────────────────────────────────────────
const distPath = path.join(__dirname, '../frontend/dist')
app.use(express.static(distPath))
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500
  // Only log unexpected server errors with a full stack trace.
  // 404 (session not found) and 503 (session not ready) are expected operational
  // states — log them as a single-line warning to avoid log spam.
  if (status >= 500) {
    console.error(err)
  } else {
    console.warn(`[${status}] ${err.message}`)
  }
  res.status(status).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`🚀 Baileys API server running on port ${PORT}`)
})

// ─── Process-level error handling to prevent server crashes ──────────────────
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', err)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED REJECTION at:', promise, 'reason:', reason)
})

export default app
