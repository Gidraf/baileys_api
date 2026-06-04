import { Router } from 'express'
import { resolveMedia } from '../utils/media.js'

export function createProfileRoutes(sessionManager, upload) {
  const router = Router({ mergeParams: true })

  const getSock = (req) => sessionManager.getSessionSock(req.params.sessionId)
  const getStore = (req) => sessionManager.getStore(req.params.sessionId)

  // Get all contacts from store
  router.get('/contacts', async (req, res, next) => {
    try {
      const store = getStore(req)
      const contacts = store.contacts ? Object.values(store.contacts) : []
      res.json(contacts)
    } catch (err) { next(err) }
  })

  // Get profile picture URL
  router.get('/picture', async (req, res, next) => {
    try {
      const { jid, type } = req.query
      const url = await getSock(req).profilePictureUrl(jid, type || 'image')
      res.json({ url })
    } catch (err) { next(err) }
  })

  // Update profile picture
  router.put('/picture', upload.single('file'), async (req, res, next) => {
    try {
      const { jid, url } = req.body
      const buffer = req.file ? req.file.buffer : await resolveMedia(url)
      await getSock(req).updateProfilePicture(jid, buffer)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Remove profile picture
  router.delete('/picture', async (req, res, next) => {
    try {
      const { jid } = req.body
      await getSock(req).removeProfilePicture(jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Update profile name
  router.patch('/name', async (req, res, next) => {
    try {
      await getSock(req).updateProfileName(req.body.name)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Update profile status
  router.patch('/status', async (req, res, next) => {
    try {
      await getSock(req).updateProfileStatus(req.body.status)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Block/unblock user
  router.patch('/block', async (req, res, next) => {
    try {
      const { jid, action } = req.body // action: 'block' | 'unblock'
      await getSock(req).updateBlockStatus(jid, action)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Fetch blocklist
  router.get('/blocklist', async (req, res, next) => {
    try {
      const result = await getSock(req).fetchBlocklist()
      res.json(result)
    } catch (err) { next(err) }
  })

  // Chat modify (archive/mute/etc)
  router.patch('/chat', async (req, res, next) => {
    try {
      const { jid, modifications } = req.body
      await getSock(req).chatModify(modifications, jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Contact management
  router.post('/contact', async (req, res, next) => {
    try {
      const { jid, displayName } = req.body
      await getSock(req).addOrEditContact(jid, { displayName })
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.delete('/contact', async (req, res, next) => {
    try {
      await getSock(req).removeContact(req.body.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Labels
  router.post('/label/chat', async (req, res, next) => {
    try {
      const { jid, labelId } = req.body
      await getSock(req).addChatLabel(jid, labelId)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.delete('/label/chat', async (req, res, next) => {
    try {
      const { jid, labelId } = req.body
      await getSock(req).removeChatLabel(jid, labelId)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/label/message', async (req, res, next) => {
    try {
      const { jid, messageId, labelId } = req.body
      await getSock(req).addMessageLabel(jid, messageId, labelId)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.delete('/label/message', async (req, res, next) => {
    try {
      const { jid, messageId, labelId } = req.body
      await getSock(req).removeMessageLabel(jid, messageId, labelId)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Get business profile
  router.get('/business', async (req, res, next) => {
    try {
      const result = await getSock(req).getBusinessProfile(req.query.jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Check if numbers are registered on WhatsApp
  router.post('/on-whatsapp', async (req, res, next) => {
    try {
      const { numbers } = req.body
      if (!numbers || !Array.isArray(numbers)) {
        return res.status(400).json({ error: "numbers must be an array of strings" })
      }
      const result = await getSock(req).onWhatsApp(...numbers)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get contact status/about
  router.get('/status', async (req, res, next) => {
    try {
      const { jid } = req.query
      if (!jid) return res.status(400).json({ error: "jid is required" })
      const result = await getSock(req).fetchStatus(jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get contact disappearing duration
  router.get('/disappearing-duration', async (req, res, next) => {
    try {
      const { jid } = req.query
      if (!jid) return res.status(400).json({ error: "jid is required" })
      const result = await getSock(req).fetchDisappearingDuration(jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  return router
}
