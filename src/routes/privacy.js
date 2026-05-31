import { Router } from 'express'

export function createPrivacyRoutes(sessionManager) {
  const router = Router()

  const getSock = (req) => sessionManager.getSessionSock(req.params.sessionId)

  router.patch('/:sessionId/last-seen', async (req, res, next) => {
    try {
      // value: 'all' | 'contacts' | 'contact_blacklist' | 'nobody'
      await getSock(req).updateLastSeenPrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:sessionId/online', async (req, res, next) => {
    try {
      // value: 'all' | 'match_last_seen'
      await getSock(req).updateOnlinePrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:sessionId/profile-picture', async (req, res, next) => {
    try {
      await getSock(req).updateProfilePicturePrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:sessionId/status', async (req, res, next) => {
    try {
      await getSock(req).updateStatusPrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:sessionId/read-receipts', async (req, res, next) => {
    try {
      // value: 'all' | 'none'
      await getSock(req).updateReadReceiptsPrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:sessionId/groups-add', async (req, res, next) => {
    try {
      // value: 'all' | 'contacts'
      await getSock(req).updateGroupsAddPrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:sessionId/messages', async (req, res, next) => {
    try {
      // value: 'all' | 'contacts' | 'nobody'
      await getSock(req).updateMessagesPrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:sessionId/calls', async (req, res, next) => {
    try {
      // value: 'everyone'
      await getSock(req).updateCallPrivacy(req.body.value)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:sessionId/disappearing-mode', async (req, res, next) => {
    try {
      await getSock(req).updateDefaultDisappearingMode(req.body.seconds || 0)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:sessionId/link-previews', async (req, res, next) => {
    try {
      await getSock(req).updateDisableLinkPreviewsPrivacy(req.body.disabled === true)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  return router
}
