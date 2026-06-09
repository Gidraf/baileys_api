/**
 * Webhook management routes
 *
 * GET  /api/webhooks             - list all session webhooks
 * GET  /api/webhooks/:sessionId  - get webhook for a session
 * PUT  /api/webhooks/:sessionId  - set/update webhook URL for a session
 * DEL  /api/webhooks/:sessionId  - remove webhook URL from a session
 * POST /api/webhooks/test/:sessionId - send a test ping to the configured webhook
 * GET  /api/webhooks/events      - SSE stream of recent webhook events (playground)
 * POST /api/webhooks/simulate    - push a fake event to the SSE stream (testing)
 */

import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const SESSIONS_DIR = process.env.SESSIONS_DIR || './sessions'

// In-memory ring-buffer of the last N webhook events for the playground viewer
const MAX_EVENTS = 200
const _events = []
const _sseClients = new Set()

/**
 * Push an event into the ring buffer and broadcast to all SSE clients.
 * Called by SessionManager whenever it fires a webhook.
 */
export function recordWebhookEvent(sessionId, event, data) {
  const entry = { sessionId, event, data, timestamp: Date.now() }
  _events.push(entry)
  if (_events.length > MAX_EVENTS) _events.shift()

  const payload = `data: ${JSON.stringify(entry)}\n\n`
  for (const client of _sseClients) {
    try { client.write(payload) } catch {}
  }
}

export function createWebhookRoutes(sessionManager) {
  const router = Router()

  // ── List all webhooks ────────────────────────────────────────────────────────
  router.get('/', (_req, res) => {
    const list = sessionManager.list().map(s => {
      const wf = path.join(SESSIONS_DIR, s.sessionId, 'webhook.txt')
      const url = fs.existsSync(wf) ? fs.readFileSync(wf, 'utf8').trim() : null
      return { sessionId: s.sessionId, webhookUrl: url, status: s.status }
    })
    res.json({ webhooks: list })
  })

  // ── Get webhook for session ──────────────────────────────────────────────────
  router.get('/:sessionId', (req, res) => {
    const { sessionId } = req.params
    const wf = path.join(SESSIONS_DIR, sessionId, 'webhook.txt')
    const url = fs.existsSync(wf) ? fs.readFileSync(wf, 'utf8').trim() : null
    res.json({ sessionId, webhookUrl: url })
  })

  // ── Set / update webhook URL ─────────────────────────────────────────────────
  router.put('/:sessionId', async (req, res) => {
    const { sessionId } = req.params
    const { url } = req.body
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required' })
    }
    // Update in running session
    const sess = sessionManager.sessions.get(sessionId)
    if (sess) sess.webhook = url

    // Persist to disk
    const dir = path.join(SESSIONS_DIR, sessionId)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'webhook.txt'), url)

    res.json({ sessionId, webhookUrl: url, updated: true })
  })

  // ── Remove webhook ───────────────────────────────────────────────────────────
  router.delete('/:sessionId', (req, res) => {
    const { sessionId } = req.params
    const sess = sessionManager.sessions.get(sessionId)
    if (sess) sess.webhook = null

    const wf = path.join(SESSIONS_DIR, sessionId, 'webhook.txt')
    try { fs.unlinkSync(wf) } catch {}
    res.json({ sessionId, webhookUrl: null, removed: true })
  })

  // ── Test webhook (send a ping) ───────────────────────────────────────────────
  router.post('/test/:sessionId', async (req, res) => {
    const { sessionId } = req.params
    const wf = path.join(SESSIONS_DIR, sessionId, 'webhook.txt')
    const url = (sessionManager.sessions.get(sessionId)?.webhook) ||
                (fs.existsSync(wf) ? fs.readFileSync(wf, 'utf8').trim() : null)

    if (!url) return res.status(400).json({ error: 'No webhook URL configured for this session' })

    try {
      const testPayload = {
        sessionId,
        event: 'webhook.test',
        data: { message: 'This is a test ping from the Baileys API playground', ts: Date.now() },
        timestamp: Date.now(),
      }
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      })
      res.json({ success: r.ok, status: r.status, url })
    } catch (err) {
      res.status(500).json({ error: err.message, url })
    }
  })

  // ── SSE event stream (playground live viewer) ────────────────────────────────
  router.get('/events/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    // Send buffered events first (catch-up)
    const since = parseInt(req.query.since || '0', 10)
    const catchUp = _events.filter(e => e.timestamp > since)
    for (const e of catchUp) {
      res.write(`data: ${JSON.stringify(e)}\n\n`)
    }

    // Heartbeat every 30s to keep connection alive through proxies
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 30000)
    _sseClients.add(res)

    req.on('close', () => {
      clearInterval(heartbeat)
      _sseClients.delete(res)
    })
  })

  // ── Recent events (REST fallback) ────────────────────────────────────────────
  router.get('/events/recent', (req, res) => {
    const { sessionId, event: eventFilter, limit = 50 } = req.query
    let events = [..._events].reverse()
    if (sessionId) events = events.filter(e => e.sessionId === sessionId)
    if (eventFilter) events = events.filter(e => e.event === eventFilter)
    res.json({ events: events.slice(0, parseInt(limit, 10)) })
  })

  // ── Simulate / inject a fake event (for testing) ────────────────────────────
  router.post('/simulate', (req, res) => {
    const { sessionId = 'test', event = 'messages.upsert', data = {} } = req.body
    recordWebhookEvent(sessionId, event, data)
    res.json({ success: true, injected: { sessionId, event } })
  })

  return router
}
