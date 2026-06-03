import { Router } from 'express'

export function createBusinessRoutes(sessionManager, upload) {
  const router = Router({ mergeParams: true })

  const getSock = (req) => sessionManager.getSessionSock(req.params.sessionId)

  // Create product
  router.post('/products', upload.array('images'), async (req, res, next) => {
    try {
      const data = JSON.parse(req.body.data || '{}')
      if (req.files?.length) {
        data.images = req.files.map(f => f.buffer)
      } else if (data.images?.length) {
        const { downloadToBuffer } = await import('../utils/media.js')
        const resolved = []
        for (const img of data.images) {
          try {
            let url = img.url || img
            if (typeof url === 'string') {
              const minioHost = process.env.STORAGE_ENDPOINT || 'minio:9000'
              if (url.includes('localhost:9000')) {
                url = url.replace('localhost:9000', minioHost)
              } else if (url.includes('127.0.0.1:9000')) {
                url = url.replace('127.0.0.1:9000', minioHost)
              }
              const buf = await downloadToBuffer(url)
              resolved.push(buf)
            }
          } catch (err) {
            console.error('Failed to resolve image URL to buffer', err)
          }
        }
        if (resolved.length) {
          data.images = resolved
        }
      }
      const result = await getSock(req).productCreate(data)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Update product
  router.patch('/products/:productId', upload.array('images'), async (req, res, next) => {
    try {
      const data = JSON.parse(req.body.data || '{}')
      if (req.files?.length) {
        data.images = req.files.map(f => f.buffer)
      } else if (data.images?.length) {
        const { downloadToBuffer } = await import('../utils/media.js')
        const resolved = []
        for (const img of data.images) {
          try {
            let url = img.url || img
            if (typeof url === 'string') {
              const minioHost = process.env.STORAGE_ENDPOINT || 'minio:9000'
              if (url.includes('localhost:9000')) {
                url = url.replace('localhost:9000', minioHost)
              } else if (url.includes('127.0.0.1:9000')) {
                url = url.replace('127.0.0.1:9000', minioHost)
              }
              const buf = await downloadToBuffer(url)
              resolved.push(buf)
            }
          } catch (err) {
            console.error('Failed to resolve image URL to buffer', err)
          }
        }
        if (resolved.length) {
          data.images = resolved
        }
      }
      const result = await getSock(req).productUpdate(req.params.productId, data)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Delete products
  router.delete('/products', async (req, res, next) => {
    try {
      const { productIds } = req.body
      await getSock(req).productDelete(productIds)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Get catalog
  router.get('/catalog', async (req, res, next) => {
    try {
      const { jid, limit, cursor } = req.query
      const result = await getSock(req).getCatalog({ jid, limit: parseInt(limit) || 10, ...(cursor && { cursor }) })
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get collections
  router.get('/collections', async (req, res, next) => {
    try {
      const { jid, limit } = req.query
      const result = await getSock(req).getCollections(jid, parseInt(limit) || 10)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Get order details
  router.get('/orders/:orderId', async (req, res, next) => {
    try {
      const { token } = req.query
      const result = await getSock(req).getOrderDetails(req.params.orderId, token)
      res.json(result)
    } catch (err) { next(err) }
  })

  // Update business profile
  router.put('/profile', async (req, res, next) => {
    try {
      await getSock(req).updateBusinessProfile(req.body)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Update cover photo
  router.put('/cover', upload.single('file'), async (req, res, next) => {
    try {
      const media = req.file ? { buffer: req.file.buffer } : { url: req.body.url }
      await getSock(req).updateCoverPhoto(media)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Remove cover photo
  router.delete('/cover', async (req, res, next) => {
    try {
      await getSock(req).removeCoverPhoto(req.body.coverId)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  // Quick replies
  router.post('/quick-replies', async (req, res, next) => {
    try {
      const { shortcut, message } = req.body
      await getSock(req).addOrEditQuickReply({ shortcut, message })
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  router.delete('/quick-replies/:timestamp', async (req, res, next) => {
    try {
      await getSock(req).removeQuickReply(req.params.timestamp)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  return router
}

