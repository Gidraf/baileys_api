import { Router } from 'express'

export function createGroupRoutes(sessionManager) {
  const router = Router({ mergeParams: true })

  const getSock = (req) => sessionManager.getSessionSock(req.params.sessionId)

  // Create group
  router.post('/', async (req, res, next) => {
    try {
      const { name, participants } = req.body
      const result = await getSock(req).groupCreate(name, participants)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get group metadata
  router.get('/:jid', async (req, res, next) => {
    try {
      const result = await getSock(req).groupMetadata(req.params.jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get all groups
  router.get('/', async (req, res, next) => {
    try {
      const result = await getSock(req).groupFetchAllParticipating()
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get invite code
  router.get('/:jid/invite-code', async (req, res, next) => {
    try {
      const code = await getSock(req).groupInviteCode(req.params.jid)
      res.json({ code })
    } catch (err) { next(err) }
  })

  // Revoke invite link
  router.post('/:jid/revoke-invite', async (req, res, next) => {
    try {
      await getSock(req).groupRevokeInvite(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Accept group invite
  router.post('/accept-invite', async (req, res, next) => {
    try {
      const { inviteCode } = req.body
      await getSock(req).groupAcceptInvite(inviteCode)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Leave group
  router.post('/:jid/leave', async (req, res, next) => {
    try {
      await getSock(req).groupLeave(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Update participants (add/remove/promote/demote)
  router.patch('/:jid/participants', async (req, res, next) => {
    try {
      const { participants, action } = req.body
      // action: 'add' | 'remove' | 'promote' | 'demote'
      const result = await getSock(req).groupParticipantsUpdate(req.params.jid, participants, action)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Request participants update (approve/reject)
  router.patch('/:jid/join-requests', async (req, res, next) => {
    try {
      const { participants, action } = req.body
      // action: 'approve' | 'reject'
      const result = await getSock(req).groupRequestParticipantsUpdate(req.params.jid, participants, action)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get pending join requests
  router.get('/:jid/join-requests', async (req, res, next) => {
    try {
      const result = await getSock(req).groupRequestParticipantsList(req.params.jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Update name
  router.patch('/:jid/name', async (req, res, next) => {
    try {
      await getSock(req).groupUpdateSubject(req.params.jid, req.body.name)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Update description
  router.patch('/:jid/description', async (req, res, next) => {
    try {
      await getSock(req).groupUpdateDescription(req.params.jid, req.body.description)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Update setting (announcement / not_announcement / locked / unlocked)
  router.patch('/:jid/setting', async (req, res, next) => {
    try {
      await getSock(req).groupSettingUpdate(req.params.jid, req.body.setting)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Member add mode
  router.patch('/:jid/member-add-mode', async (req, res, next) => {
    try {
      await getSock(req).groupMemberAddMode(req.params.jid, req.body.mode)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Toggle ephemeral
  router.patch('/:jid/ephemeral', async (req, res, next) => {
    try {
      await getSock(req).groupToggleEphemeral(req.params.jid, req.body.seconds || 0)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Join approval mode
  router.patch('/:jid/join-approval', async (req, res, next) => {
    try {
      await getSock(req).groupJoinApprovalMode(req.params.jid, req.body.mode)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Get group info from invite link
  router.post('/invite-info', async (req, res, next) => {
    try {
      const { inviteCode } = req.body
      const result = await getSock(req).groupGetInviteInfo(inviteCode)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Update member label
  router.patch('/:jid/member-label', async (req, res, next) => {
    try {
      await getSock(req).updateMemberLabel(req.params.jid, req.body.label)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  return router
}
