import { Router } from 'express'

export function createCommunityRoutes(sessionManager) {
  const router = Router({ mergeParams: true })

  const getSock = (req) => sessionManager.getSessionSock(req.params.sessionId)

  router.post('/', async (req, res, next) => {
    try {
      const { name, description } = req.body
      const result = await getSock(req).communityCreate(name, description)
      res.json(result)
    } catch (err) { next(err) }
  })

  router.post('/:jid/create-group', async (req, res, next) => {
    try {
      const { name, participants } = req.body
      const result = await getSock(req).communityCreateGroup(name, participants, req.params.jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  router.post('/:jid/link-group', async (req, res, next) => {
    try {
      await getSock(req).communityLinkGroup(req.body.groupJid, req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:jid/unlink-group', async (req, res, next) => {
    try {
      await getSock(req).communityUnlinkGroup(req.body.groupJid, req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.get('/:jid/metadata', async (req, res, next) => {
    try {
      const result = await getSock(req).communityMetadata(req.params.jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  router.get('/:jid/invite-code', async (req, res, next) => {
    try {
      const code = await getSock(req).communityInviteCode(req.params.jid)
      res.json({ code })
    } catch (err) { next(err) }
  })

  router.post('/:jid/revoke-invite', async (req, res, next) => {
    try {
      await getSock(req).communityRevokeInvite(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/accept-invite', async (req, res, next) => {
    try {
      await getSock(req).communityAcceptInvite(req.body.inviteCode)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.post('/:jid/leave', async (req, res, next) => {
    try {
      await getSock(req).communityLeave(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:jid/join-requests', async (req, res, next) => {
    try {
      const { participants, action } = req.body
      await getSock(req).communityRequestParticipantsUpdate(req.params.jid, participants, action)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:jid/name', async (req, res, next) => {
    try {
      await getSock(req).communityUpdateSubject(req.params.jid, req.body.name)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:jid/description', async (req, res, next) => {
    try {
      await getSock(req).communityUpdateDescription(req.params.jid, req.body.description)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:jid/setting', async (req, res, next) => {
    try {
      await getSock(req).communitySettingUpdate(req.params.jid, req.body.setting)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:jid/member-add-mode', async (req, res, next) => {
    try {
      await getSock(req).communityMemberAddMode(req.params.jid, req.body.mode)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:jid/ephemeral', async (req, res, next) => {
    try {
      await getSock(req).communityToggleEphemeral(req.params.jid, req.body.seconds || 0)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.patch('/:jid/join-approval', async (req, res, next) => {
    try {
      await getSock(req).communityJoinApprovalMode(req.params.jid, req.body.mode)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.get('/', async (req, res, next) => {
    try {
      const result = await getSock(req).communityFetchAllParticipating()
      res.json(result)
    } catch (err) { next(err) }
  })

  router.get('/:jid/linked-groups', async (req, res, next) => {
    try {
      const result = await getSock(req).communityFetchLinkedGroups(req.params.jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  router.get('/:jid/join-requests', async (req, res, next) => {
    try {
      const result = await getSock(req).communityRequestParticipantsList(req.params.jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  router.post('/invite-info', async (req, res, next) => {
    try {
      const result = await getSock(req).communityGetInviteInfo(req.body.inviteCode)
      res.json(result)
    } catch (err) { next(err) }
  })

  return router
}
