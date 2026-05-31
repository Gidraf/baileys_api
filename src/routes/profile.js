import { Router } from 'express'
import { resolveMedia } from '../utils/media.js'

export function createProfileRoutes(sessionManager, upload) {
  const router = Router()

  const getSock = (req) => sessionManager.getSessionSock(req.params.sessionId)

  // Get profile picture URL
  router.get('/:sessionId/picture', async (req, res, next) => {
    try {
      const { jid, type } = req.query
      const url = await getSock(req).profilePictureUrl(jid, type || 'image')
      res.json({ url })
    } catch (err) { next(err) }
  })

  // Update profile picture
  router.put('/:sessionId/picture', upload.single('file'), async (req, res, next) => {
    try {
      const { jid, url } = req.body
      const buffer = req.file ? req.file.buffer : await resolveMedia(url)
      await getSock(req).updateProfilePicture(jid, buffer)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Remove profile picture
  router.delete('/:sessionId/picture', async (req, res, next) => {
    try {
      const { jid } = req.body
      await getSock(req).removeProfilePicture(jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Update profile name
  router.patch('/:sessionId/name', async (req, res, next) => {
    try {
      await getSock(req).updateProfileName(req.body.name)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Update profile status
  router.patch('/:sessionId/status', async (req, res, next) => {
    try {
      await getSock(req).updateProfileStatus(req.body.status)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Block/unblock user
  router.patch('/:sessionId/block', async (req, res, next) => {
    try {
      const { jid, action } = req.body // action: 'block' | 'unblock'
      await getSock(req).updateBlockStatus(jid, action)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Fetch blocklist
  router.get('/:sessionId/blocklist', async (req, res, next) => {
    try {
      const result = await getSock(req).fetchBlocklist()
      res.json(result)
    } catch (err) { next(err) }
  })

  // Chat modify (archive/mute/etc)
  router.patch('/:sessionId/chat', async (req, res, next) => {
    try {
      const { jid, modifications } = req.body
      await getSock(req).chatModify(modifications, jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Contact management
  router.post('/:sessionId/contact', async (req, res, next) => {
    try {
      const { jid, displayName } = req.body
      await getSock(req).addOrEditContact(jid, { displayName })
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.delete('/:sessionId/contact', async (req, res, next) => {
    try {
      await getSock(req).removeContact(req.body.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Labels
  router.post('/:sessionId/label/chat', async (req, res, next) => {
    try {
      const { jid, labelId } = req.body
      await getSock(req).addChatLabel(jid, labelId)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.delete('/:sessionId/label/chat', async (req, res, next) => {
    try {
      const { jid, labelId } = req.body
      await getSock(req).removeChatLabel(jid, labelId)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:sessionId/label/message', async (req, res, next) => {
    try {
      const { jid, messageId, labelId } = req.body
      await getSock(req).addMessageLabel(jid, messageId, labelId)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Get business profile
  router.get('/:sessionId/business', async (req, res, next) => {
    try {
      const result = await getSock(req).getBusinessProfile(req.query.jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  return router
}
