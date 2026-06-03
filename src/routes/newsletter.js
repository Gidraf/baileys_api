import { Router } from 'express'
import { resolveMedia } from '../utils/media.js'

export function createNewsletterRoutes(sessionManager, upload) {
  const router = Router({ mergeParams: true })

  const getSock = (req) => sessionManager.getSessionSock(req.params.sessionId)

  router.post('/', async (req, res, next) => {
    try {
      const { name, description } = req.body
      const result = await getSock(req).newsletterCreate(name, description)
      res.json(result)
    } catch (err) { next(err) }
  })

  router.get('/:jid/metadata', async (req, res, next) => {
    try {
      const result = await getSock(req).newsletterMetadata(req.params.jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  router.get('/:jid/subscribers', async (req, res, next) => {
    try {
      const result = await getSock(req).newsletterSubscribers(req.params.jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  router.post('/:jid/follow', async (req, res, next) => {
    try {
      await getSock(req).newsletterFollow(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:jid/unfollow', async (req, res, next) => {
    try {
      await getSock(req).newsletterUnfollow(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:jid/mute', async (req, res, next) => {
    try {
      await getSock(req).newsletterMute(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:jid/unmute', async (req, res, next) => {
    try {
      await getSock(req).newsletterUnmute(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:jid/demote', async (req, res, next) => {
    try {
      const { participantJid } = req.body
      await getSock(req).newsletterDemote(req.params.jid, participantJid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:jid/change-owner', async (req, res, next) => {
    try {
      const { newOwnerJid } = req.body
      await getSock(req).newsletterChangeOwner(req.params.jid, newOwnerJid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:jid', async (req, res, next) => {
    try {
      await getSock(req).newsletterUpdate(req.params.jid, req.body)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:jid/name', async (req, res, next) => {
    try {
      await getSock(req).newsletterUpdateName(req.params.jid, req.body.name)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:jid/description', async (req, res, next) => {
    try {
      await getSock(req).newsletterUpdateDescription(req.params.jid, req.body.description)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.put('/:jid/picture', upload.single('file'), async (req, res, next) => {
    try {
      const media = req.file ? { buffer: req.file.buffer } : { url: req.body.url }
      await getSock(req).newsletterUpdatePicture(req.params.jid, media)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.delete('/:jid/picture', async (req, res, next) => {
    try {
      await getSock(req).newsletterRemovePicture(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:jid/react', async (req, res, next) => {
    try {
      const { messageServerId, emoji } = req.body
      await getSock(req).newsletterReactMessage(req.params.jid, messageServerId, emoji)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.get('/:jid/admin-count', async (req, res, next) => {
    try {
      const count = await getSock(req).newsletterAdminCount(req.params.jid)
      res.json({ count })
    } catch (err) { next(err) }
  })

  router.get('/subscribed', async (req, res, next) => {
    try {
      let result = await getSock(req).newsletterSubscribed()
      // Filter out groups and ensure only newsletters are returned
      if (typeof result === 'object' && result !== null) {
        if (Array.isArray(result)) {
            result = result.filter(item => item?.id?.endsWith('@newsletter') || item?.jid?.endsWith('@newsletter'))
        } else {
            result = Object.fromEntries(
                Object.entries(result).filter(([jid, data]) => jid.endsWith('@newsletter'))
            )
        }
      }
      res.json(result)
    } catch (err) { next(err) }
  })

  router.get('/:jid/messages', async (req, res, next) => {
    try {
      const { count, after, before } = req.query
      const result = await getSock(req).newsletterFetchMessages('jid', req.params.jid, parseInt(count) || 50, parseInt(after) || 0, parseInt(before) || 0)
      res.json(result)
    } catch (err) { next(err) }
  })

  router.delete('/:jid', async (req, res, next) => {
    try {
      await getSock(req).newsletterDelete(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  return router
}
