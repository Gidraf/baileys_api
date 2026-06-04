import { Router } from 'express'

export function createPrivacyRoutes(sessionManager) {
  const router = Router({ mergeParams: true })

  const getSock = (req) => sessionManager.getSessionSock(req.params.sessionId)

  router.get('/', async (req, res, next) => {
    try {
      const result = await getSock(req).fetchPrivacySettings()
      res.json(result)
    } catch (err) { next(err) }
  })

  router.patch('/last-seen', async (req, res, next) => {
    try {
      // value: 'all' | 'contacts' | 'contact_blacklist' | 'nobody'
      await getSock(req).updateLastSeenPrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/online', async (req, res, next) => {
    try {
      // value: 'all' | 'match_last_seen'
      await getSock(req).updateOnlinePrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/profile-picture', async (req, res, next) => {
    try {
      await getSock(req).updateProfilePicturePrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/status', async (req, res, next) => {
    try {
      await getSock(req).updateStatusPrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/read-receipts', async (req, res, next) => {
    try {
      // value: 'all' | 'none'
      await getSock(req).updateReadReceiptsPrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/groups-add', async (req, res, next) => {
    try {
      // value: 'all' | 'contacts'
      await getSock(req).updateGroupsAddPrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/messages', async (req, res, next) => {
    try {
      // value: 'all' | 'contacts' | 'nobody'
      await getSock(req).updateMessagesPrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/calls', async (req, res, next) => {
    try {
      // value: 'everyone'
      await getSock(req).updateCallPrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/disappearing-mode', async (req, res, next) => {
    try {
      await getSock(req).updateDefaultDisappearingMode(req.body.seconds || 0)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/link-previews', async (req, res, next) => {
    try {
      await getSock(req).updateDisableLinkPreviewsPrivacy(req.body.disabled === true)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  return router
}
