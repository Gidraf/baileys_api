import { Router } from 'express'

export function createGroupRoutes(sessionManager) {
  const router = Router()

  const getSock = (req) => sessionManager.getSessionSock(req.params.sessionId)

  // Create group
  router.post('/:sessionId', async (req, res, next) => {
    try {
      const { name, participants } = req.body
      const result = await getSock(req).groupCreate(name, participants)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get group metadata
  router.get('/:sessionId/:jid', async (req, res, next) => {
    try {
      const result = await getSock(req).groupMetadata(req.params.jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get all groups
  router.get('/:sessionId', async (req, res, next) => {
    try {
      const result = await getSock(req).groupFetchAllParticipating()
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get invite code
  router.get('/:sessionId/:jid/invite-code', async (req, res, next) => {
    try {
      const code = await getSock(req).groupInviteCode(req.params.jid)
      res.json({ code })
    } catch (err) { next(err) }
  })

  // Revoke invite link
  router.post('/:sessionId/:jid/revoke-invite', async (req, res, next) => {
    try {
      await getSock(req).groupRevokeInvite(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Accept group invite
  router.post('/:sessionId/accept-invite', async (req, res, next) => {
    try {
      const { inviteCode } = req.body
      await getSock(req).groupAcceptInvite(inviteCode)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Leave group
  router.post('/:sessionId/:jid/leave', async (req, res, next) => {
    try {
      await getSock(req).groupLeave(req.params.jid)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Update participants (add/remove/promote/demote)
  router.patch('/:sessionId/:jid/participants', async (req, res, next) => {
    try {
      const { participants, action } = req.body
      // action: 'add' | 'remove' | 'promote' | 'demote'
      const result = await getSock(req).groupParticipantsUpdate(req.params.jid, participants, action)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Request participants update (approve/reject)
  router.patch('/:sessionId/:jid/join-requests', async (req, res, next) => {
    try {
      const { participants, action } = req.body
      // action: 'approve' | 'reject'
      const result = await getSock(req).groupRequestParticipantsUpdate(req.params.jid, participants, action)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get pending join requests
  router.get('/:sessionId/:jid/join-requests', async (req, res, next) => {
    try {
      const result = await getSock(req).groupRequestParticipantsList(req.params.jid)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Update name
  router.patch('/:sessionId/:jid/name', async (req, res, next) => {
    try {
      await getSock(req).groupUpdateSubject(req.params.jid, req.body.name)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Update description
  router.patch('/:sessionId/:jid/description', async (req, res, next) => {
    try {
      await getSock(req).groupUpdateDescription(req.params.jid, req.body.description)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Update setting (announcement / not_announcement / locked / unlocked)
  router.patch('/:sessionId/:jid/setting', async (req, res, next) => {
    try {
      await getSock(req).groupSettingUpdate(req.params.jid, req.body.setting)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Member add mode
  router.patch('/:sessionId/:jid/member-add-mode', async (req, res, next) => {
    try {
      await getSock(req).groupMemberAddMode(req.params.jid, req.body.mode)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Toggle ephemeral
  router.patch('/:sessionId/:jid/ephemeral', async (req, res, next) => {
    try {
      await getSock(req).groupToggleEphemeral(req.params.jid, req.body.seconds || 0)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Join approval mode
  router.patch('/:sessionId/:jid/join-approval', async (req, res, next) => {
    try {
      await getSock(req).groupJoinApprovalMode(req.params.jid, req.body.mode)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Get group info from invite link
  router.post('/:sessionId/invite-info', async (req, res, next) => {
    try {
      const { inviteCode } = req.body
      const result = await getSock(req).groupGetInviteInfo(inviteCode)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Update member label
  router.patch('/:sessionId/:jid/member-label', async (req, res, next) => {
    try {
      await getSock(req).updateMemberLabel(req.params.jid, req.body.label)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  return router
}
