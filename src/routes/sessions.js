import { Router } from 'express'
import QRCode from 'qrcode'

export function createSessionRoutes(sessionManager, upload) {
  const router = Router()

  // List all sessions
  router.get('/', (req, res) => {
    res.json({ sessions: sessionManager.listSessions() })
  })

  // Create / connect a session
  router.post('/', async (req, res, next) => {
    try {
      const { sessionId, phoneNumber } = req.body
      if (!sessionId) return res.status(400).json({ error: 'sessionId is required' })

      const result = await sessionManager.createSession(sessionId, phoneNumber)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get session status
  router.get('/:sessionId', (req, res) => {
    const session = sessionManager.getSession(req.params.sessionId)
    if (!session) return res.status(404).json({ error: 'Session not found' })

    res.json({
      id: req.params.sessionId,
      status: session.status,
      user: session.sock?.user || null,
      hasQr: !!session.qr,
      hasPairingCode: !!session.pairingCode,
      pairingCode: session.pairingCode || null
    })
  })

  // Get QR code as base64 image
  router.get('/:sessionId/qr', async (req, res, next) => {
    try {
      const session = sessionManager.getSession(req.params.sessionId)
      if (!session) return res.status(404).json({ error: 'Session not found' })
      if (!session.qr) return res.status(404).json({ error: 'No QR code available', status: session.status })

      const qrImage = await QRCode.toDataURL(session.qr)
      res.json({ qr: session.qr, qrImage })
    } catch (err) { next(err) }
  })

  // Request pairing code
  router.post('/:sessionId/pairing-code', async (req, res, next) => {
    try {
      const { phoneNumber, customCode } = req.body
      if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' })

      const session = sessionManager.getSession(req.params.sessionId)
      if (!session) return res.status(404).json({ error: 'Session not found' })

      const sock = session.sock
      if (!sock) return res.status(400).json({ error: 'Socket not initialized yet' })

      const code = await sock.requestPairingCode(phoneNumber, customCode)
      session.pairingCode = code
      res.json({ code })
    } catch (err) { next(err) }
  })

  // Disconnect a session (but keep files)
  router.post('/:sessionId/disconnect', async (req, res, next) => {
    try {
      const session = sessionManager.getSession(req.params.sessionId)
      if (!session) return res.status(404).json({ error: 'Session not found' })
      if (session.sock) session.sock.end()
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Delete a session (logout + remove files)
  router.delete('/:sessionId', async (req, res, next) => {
    try {
      const deleted = await sessionManager.deleteSession(req.params.sessionId)
      if (!deleted) return res.status(404).json({ error: 'Session not found' })
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Logout from WhatsApp
  router.post('/:sessionId/logout', async (req, res, next) => {
    try {
      const sock = sessionManager.getSessionSock(req.params.sessionId)
      await sock.logout()
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  return router
}
