import { Router } from 'express'

export function createBusinessRoutes(sessionManager, upload) {
  const router = Router()

  const getSock = (req) => sessionManager.getSessionSock(req.params.sessionId)

  // Create product
  router.post('/:sessionId/products', upload.array('images'), async (req, res, next) => {
    try {
      const data = JSON.parse(req.body.data || '{}')
      if (req.files?.length) {
        data.images = req.files.map(f => f.buffer)
      }
      const result = await getSock(req).productCreate(data)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Update product
  router.patch('/:sessionId/products/:productId', upload.array('images'), async (req, res, next) => {
    try {
      const data = JSON.parse(req.body.data || '{}')
      if (req.files?.length) {
        data.images = req.files.map(f => f.buffer)
      }
      const result = await getSock(req).productUpdate(req.params.productId, data)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Delete products
  router.delete('/:sessionId/products', async (req, res, next) => {
    try {
      const { productIds } = req.body
      await getSock(req).productDelete(productIds)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Get catalog
  router.get('/:sessionId/catalog', async (req, res, next) => {
    try {
      const { jid, limit, cursor } = req.query
      const result = await getSock(req).getCatalog({ jid, limit: parseInt(limit) || 10, ...(cursor && { cursor }) })
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get collections
  router.get('/:sessionId/collections', async (req, res, next) => {
    try {
      const { jid, limit } = req.query
      const result = await getSock(req).getCollections(jid, parseInt(limit) || 10)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get order details
  router.get('/:sessionId/orders/:orderId', async (req, res, next) => {
    try {
      const { token } = req.query
      const result = await getSock(req).getOrderDetails(req.params.orderId, token)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Update business profile
  router.put('/:sessionId/profile', async (req, res, next) => {
    try {
      await getSock(req).updateBusinessProfile(req.body)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Update cover photo
  router.put('/:sessionId/cover', upload.single('file'), async (req, res, next) => {
    try {
      const media = req.file ? { buffer: req.file.buffer } : { url: req.body.url }
      await getSock(req).updateCoverPhoto(media)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Remove cover photo
  router.delete('/:sessionId/cover', async (req, res, next) => {
    try {
      await getSock(req).removeCoverPhoto(req.body.coverId)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Quick replies
  router.post('/:sessionId/quick-replies', async (req, res, next) => {
    try {
      const { shortcut, message } = req.body
      await getSock(req).addOrEditQuickReply({ shortcut, message })
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.delete('/:sessionId/quick-replies/:timestamp', async (req, res, next) => {
    try {
      await getSock(req).removeQuickReply(req.params.timestamp)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  return router
}
