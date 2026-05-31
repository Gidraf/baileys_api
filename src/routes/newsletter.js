import { Router } from 'express'
import { resolveMedia } from '../utils/media.js'

export function createNewsletterRoutes(sessionManager, upload) {
  const router = Router()

  const getSock = (req) => sessionManager.getSessionSock(req.params.sessionId)

  router.post('/:sessionId', async (req, res, next) => {
    try {
      const { name, description } = req.body
      const result = await getSock(req).newsletterCreate(name, description)
      res.json(result)
    } catch (err) { next(err) }
  })

  router.get('/:sessionId/:jid/metadata', async (req, res, next) => {
    try {
      const result = await getSock(req).newsletterMetadata(req.params.jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  router.get('/:sessionId/:jid/subscribers', async (req, res, next) => {
    try {
      const result = await getSock(req).newsletterSubscribers(req.params.jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  router.post('/:sessionId/:jid/follow', async (req, res, next) => {
    try {
      await getSock(req).newsletterFollow(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:sessionId/:jid/unfollow', async (req, res, next) => {
    try {
      await getSock(req).newsletterUnfollow(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:sessionId/:jid/mute', async (req, res, next) => {
    try {
      await getSock(req).newsletterMute(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:sessionId/:jid/unmute', async (req, res, next) => {
    try {
      await getSock(req).newsletterUnmute(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:sessionId/:jid/demote', async (req, res, next) => {
    try {
      const { participantJid } = req.body
      await getSock(req).newsletterDemote(req.params.jid, participantJid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:sessionId/:jid/change-owner', async (req, res, next) => {
    try {
      const { newOwnerJid } = req.body
      await getSock(req).newsletterChangeOwner(req.params.jid, newOwnerJid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:sessionId/:jid', async (req, res, next) => {
    try {
      await getSock(req).newsletterUpdate(req.params.jid, req.body)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:sessionId/:jid/name', async (req, res, next) => {
    try {
      await getSock(req).newsletterUpdateName(req.params.jid, req.body.name)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:sessionId/:jid/description', async (req, res, next) => {
    try {
      await getSock(req).newsletterUpdateDescription(req.params.jid, req.body.description)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.put('/:sessionId/:jid/picture', upload.single('file'), async (req, res, next) => {
    try {
      const media = req.file ? { buffer: req.file.buffer } : { url: req.body.url }
      await getSock(req).newsletterUpdatePicture(req.params.jid, media)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.delete('/:sessionId/:jid/picture', async (req, res, next) => {
    try {
      await getSock(req).newsletterRemovePicture(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:sessionId/:jid/react', async (req, res, next) => {
    try {
      const { messageServerId, emoji } = req.body
      await getSock(req).newsletterReactMessage(req.params.jid, messageServerId, emoji)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.get('/:sessionId/:jid/admin-count', async (req, res, next) => {
    try {
      const count = await getSock(req).newsletterAdminCount(req.params.jid)
      res.json({ count })
    } catch (err) { next(err) }
  })

  router.get('/:sessionId/subscribed', async (req, res, next) => {
    try {
      const result = await getSock(req).newsletterSubscribed()
      res.json(result)
    } catch (err) { next(err) }
  })

  router.get('/:sessionId/:jid/messages', async (req, res, next) => {
    try {
      const { count, after, before } = req.query
      const result = await getSock(req).newsletterFetchMessages('jid', req.params.jid, parseInt(count) || 50, parseInt(after) || 0, parseInt(before) || 0)
      res.json(result)
    } catch (err) { next(err) }
  })

  router.delete('/:sessionId/:jid', async (req, res, next) => {
    try {
      await getSock(req).newsletterDelete(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  return router
}
