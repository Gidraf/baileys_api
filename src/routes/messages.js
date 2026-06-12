import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import { sanitizeJid, isValidJid } from '../utils/jid.js'
import { resolveMedia, guessMime } from '../utils/media.js'

// 200 MB limit for campaign video uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } })

export function createMessageRoutes(sm) {
  const router = Router({ mergeParams: true })

  function sock(req) { 
    const s = sm.getSocket(req.params.sessionId);
    return {
      ...s,
      sendMessage: async (jid, content, options) => {
        const isValidJid = (j) => {
          if (!j || typeof j !== 'string') return false;
          if (j === 'status@broadcast') return true;
          const parts = j.split('@');
          if (parts.length !== 2) return false;
          const validDomains = ['s.whatsapp.net', 'g.us', 'newsletter', 'lid'];
          if (!validDomains.includes(parts[1])) return false;
          return /^[0-9:\-]+$/.test(parts[0]);
        };
        
        if (typeof jid === 'string' && !isValidJid(jid)) {
          console.error(`[API] Blocked sending message to invalid JID: ${jid}`);
          return { error: 'Invalid JID format', blocked: true };
        }

        if (jid && typeof jid === 'string' && jid.includes('@s.whatsapp.net')) {
          try {
            const ids = await s.findUserId(jid);
            if (ids && ids.lid) {
              console.log(`[API] Auto-resolved ${jid} -> ${ids.lid}`);
              jid = ids.lid;
            }
          } catch (e) {
            console.log(`[API] LID resolution failed for ${jid}: ${e.message}`);
          }
        } else if (Array.isArray(jid)) {
          // For status mention arrays, resolve each one
          jid = await Promise.all(jid.map(async (j) => {
            if (j && typeof j === 'string' && j.includes('@s.whatsapp.net')) {
              try {
                const ids = await s.findUserId(j);
                if (ids && ids.lid) return ids.lid;
              } catch (e) {}
            }
            return j;
          }));
        }
        return s.sendMessage(jid, content, options);
      }
    };
  }
  function store(req) { return sm.getStore(req.params.sessionId) }

  // ── Middleware: Validate and Auto-Correct JID ─────────────────────────────────
  const validateJid = (req, res, next) => {
    let { jid } = req.body;
    
    if (jid) {
      if (Array.isArray(jid)) {
        req.body.jid = jid.map(sanitizeJid);
      } else {
        req.body.jid = sanitizeJid(jid);
      }
      
      const checkJids = Array.isArray(req.body.jid) ? req.body.jid : [req.body.jid];
      for (const j of checkJids) {
        if (!isValidJid(j)) {
          console.error(`[API] Blocked invalid JID: ${j}`);
          return res.status(400).json({ error: 'Invalid JID format', blocked: true });
        }
      }
    }
    next();
  };
  
  router.use(validateJid);

  // ── Fetch Messages ──────────────────────────────────────────────────────────
  router.get('/:jid', (req, res) => {
    try {
      const jid = req.params.jid
      const st = store(req)
      const messages = st.messages[jid] ? st.messages[jid].array : []
      res.json({ jid, messages })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Status / Story ──────────────────────────────────────────────────────────
  router.post('/status/text', async (req, res) => {
    try {
      const { text, backgroundColor = '#000000', font = 1, statusJidList } = req.body
      const msg = { text }
      
      let jidList = statusJidList
      if (typeof jidList === 'string') {
        try { jidList = JSON.parse(jidList) } catch (e) {}
      }
      if (!jidList || !Array.isArray(jidList) || jidList.length === 0) {
        const st = store(req)
        jidList = st ? Object.keys(st.contacts || {}) : []
      }
      
      const opts = { 
        backgroundColor, 
        font,
        broadcast: true,
        statusJidList: jidList
      }
      const result = await sock(req).sendMessage('status@broadcast', msg, opts)
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.post('/status/media', upload.single('file'), async (req, res) => {
    try {
      const { type = 'image', caption, url, statusJidList } = req.body
      const media = req.file ? req.file.buffer : { url }
      const payload = { [type]: media, caption }
      
      let jidList = statusJidList
      if (typeof jidList === 'string') {
        try { jidList = JSON.parse(jidList) } catch (e) {}
      }
      if (!jidList || !Array.isArray(jidList) || jidList.length === 0) {
        const st = store(req)
        jidList = st ? Object.keys(st.contacts || {}) : []
      }
      
      const opts = {
        broadcast: true,
        statusJidList: jidList
      }
      const result = await sock(req).sendMessage('status@broadcast', payload, opts)
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Newsletter / Channel Post ───────────────────────────────────────────────
  router.post('/newsletter/post', upload.single('file'), async (req, res) => {
    try {
      const { jid, type = 'text', text, caption, url } = req.body
      if (!jid || !jid.endsWith('@newsletter')) {
        return res.status(400).json({ error: 'Valid newsletter JID is required' })
      }
      
      let payload
      if (type === 'text') {
        payload = { text }
      } else if (type === 'image' || type === 'video' || type === 'audio' || type === 'document') {
        const media = req.file ? req.file.buffer : { url }
        payload = { [type]: media, caption }
      } else {
        return res.status(400).json({ error: 'Unsupported post type' })
      }
      
      const result = await sock(req).sendMessage(jid, payload)
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Text ────────────────────────────────────────────────────────────────────
  /**
   * POST /sessions/:id/messages/text
   * { jid, text, quoted?, mentions?, mentionAll? }
   */
  router.post('/text', async (req, res) => {
    try {
      const { jid, text, quoted, mentions, mentionAll } = req.body
      const msg = { text, ...(mentions && { mentions }), ...(mentionAll && { mentionAll }) }
      const opts = quoted ? { quoted } : {}
      const result = await sock(req).sendMessage(jid, msg, opts)
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Reaction ─────────────────────────────────────────────────────────────────
  /**
   * POST /sessions/:id/messages/reaction
   * { jid, messageKey, emoji }
   */
  router.post('/reaction', async (req, res) => {
    try {
      const { jid, messageKey, emoji } = req.body
      const result = await sock(req).sendMessage(jid, { react: { key: messageKey, text: emoji } })
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Pin ───────────────────────────────────────────────────────────────────────
  /**
   * POST /sessions/:id/messages/pin
   * { jid, messageKey, time, type }  type: 1=pin 2=unpin
   */
  router.post('/pin', async (req, res) => {
    try {
      const { jid, messageKey, time = 86400, type = 1 } = req.body
      const result = await sock(req).sendMessage(jid, { pin: messageKey, time, type })
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Keep ──────────────────────────────────────────────────────────────────────
  router.post('/keep', async (req, res) => {
    try {
      const { jid, messageKey, type = 1 } = req.body
      const result = await sock(req).sendMessage(jid, { keep: messageKey, type })
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Forward ───────────────────────────────────────────────────────────────────
  router.post('/forward', async (req, res) => {
    try {
      const { jid, message, force = true } = req.body
      const result = await sock(req).sendMessage(jid, { forward: message, force })
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Delete ────────────────────────────────────────────────────────────────────
  router.post('/delete', async (req, res) => {
    try {
      const { jid, messageKey } = req.body
      const result = await sock(req).sendMessage(jid, { delete: messageKey })
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Edit ──────────────────────────────────────────────────────────────────────
  router.post('/edit', async (req, res) => {
    try {
      const { jid, messageKey, text, caption } = req.body
      const msg = { edit: messageKey, ...(text && { text }), ...(caption && { caption }) }
      const result = await sock(req).sendMessage(jid, msg)
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Contact ───────────────────────────────────────────────────────────────────
  router.post('/contact', async (req, res) => {
    try {
      const { jid, displayName, vcard, quoted } = req.body
      const result = await sock(req).sendMessage(jid, {
        contacts: { displayName, contacts: [{ vcard }] }
      }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Location ──────────────────────────────────────────────────────────────────
  router.post('/location', async (req, res) => {
    try {
      const { jid, latitude, longitude, name, quoted } = req.body
      const result = await sock(req).sendMessage(jid, {
        location: { degreesLatitude: latitude, degreesLongitude: longitude, name }
      }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Event ─────────────────────────────────────────────────────────────────────
  router.post('/event', async (req, res) => {
    try {
      const { jid, event, quoted } = req.body
      if (event) {
        const start = event.startDate || event.startTime
        const end = event.endDate || event.endTime
        if (start) event.startDate = new Date(start)
        if (end) event.endDate = new Date(end)
        delete event.startTime
        delete event.endTime
      }
      const result = await sock(req).sendMessage(jid, { event }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Poll ──────────────────────────────────────────────────────────────────────
  router.post('/poll', async (req, res) => {
    try {
      const { jid, poll, quoted } = req.body
      const result = await sock(req).sendMessage(jid, { poll }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Group Invite ──────────────────────────────────────────────────────────────
  router.post('/group-invite', async (req, res) => {
    try {
      const { jid, groupInvite, quoted } = req.body
      const result = await sock(req).sendMessage(jid, { groupInvite }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Button Response ───────────────────────────────────────────────────────────
  router.post('/button-reply', async (req, res) => {
    try {
      const { jid, type = 'plain', buttonReply, quoted } = req.body
      const result = await sock(req).sendMessage(jid, { type, buttonReply }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.post('/list-reply', async (req, res) => {
    try {
      const { jid, listReply, quoted } = req.body
      const result = await sock(req).sendMessage(jid, { listReply }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.post('/flow-reply', async (req, res) => {
    try {
      const { jid, flowReply, quoted } = req.body
      const result = await sock(req).sendMessage(jid, { flowReply }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Buttons ───────────────────────────────────────────────────────────────────
  router.post('/buttons', upload.single('image'), async (req, res) => {
    try {
      const body = req.body
      const payload = {
        text: body.text,
        footer: body.footer,
        buttons: typeof body.buttons === 'string' ? JSON.parse(body.buttons) : body.buttons,
      }
      if (req.file) payload.image = req.file.buffer
      const quoted = body.quoted ? (typeof body.quoted === 'string' ? JSON.parse(body.quoted) : body.quoted) : undefined
      const result = await sock(req).sendMessage(body.jid, payload, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── List ──────────────────────────────────────────────────────────────────────
  router.post('/list', async (req, res) => {
    try {
      const { jid, text, footer, buttonText, title, sections, quoted } = req.body
      const result = await sock(req).sendMessage(jid, { text, footer, buttonText, title, sections }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Interactive (NativeFlow / Carousel) ───────────────────────────────────────
  router.post('/interactive', upload.single('image'), async (req, res) => {
    try {
      const body = req.body
      const payload = { ...body }
      if (req.file) payload.image = req.file.buffer
      else if (payload.image && typeof payload.image === 'string') payload.image = { url: payload.image }

      ;['nativeFlow','cards','buttons','sections'].forEach(k => {
        if (payload[k] && typeof payload[k] === 'string') payload[k] = JSON.parse(payload[k])
      })
      const quoted = payload.quoted ? (typeof payload.quoted === 'string' ? JSON.parse(payload.quoted) : payload.quoted) : undefined
      delete payload.quoted
      const result = await sock(req).sendMessage(payload.jid, payload, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Template Buttons ──────────────────────────────────────────────────────────
  router.post('/template', upload.single('image'), async (req, res) => {
    try {
      const body = req.body
      const payload = { ...body }
      if (req.file) payload.image = req.file.buffer
      else if (payload.image && typeof payload.image === 'string') payload.image = { url: payload.image }

      if (payload.templateButtons && typeof payload.templateButtons === 'string')
        payload.templateButtons = JSON.parse(payload.templateButtons)
      const quoted = payload.quoted ? (typeof payload.quoted === 'string' ? JSON.parse(payload.quoted) : payload.quoted) : undefined
      delete payload.quoted
      const result = await sock(req).sendMessage(payload.jid, payload, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Rich Response ─────────────────────────────────────────────────────────────
  router.post('/rich-response', async (req, res) => {
    try {
      const { jid, disclaimerText, richResponse } = req.body
      const result = await sock(req).sendMessage(jid, { disclaimerText, richResponse })
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Code Block ────────────────────────────────────────────────────────────────
  router.post('/code-block', async (req, res) => {
    try {
      const { jid, disclaimerText, headerText, contentText, code, language, footerText } = req.body
      const result = await sock(req).sendMessage(jid, { disclaimerText, headerText, contentText, code, language, footerText })
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Inline Entities ───────────────────────────────────────────────────────────
  router.post('/inline-entities', async (req, res) => {
    try {
      const { jid, disclaimerText, headerText, contentText, links, footerText } = req.body
      const result = await sock(req).sendMessage(jid, { disclaimerText, headerText, contentText, links, footerText })
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Table ─────────────────────────────────────────────────────────────────────
  router.post('/table', async (req, res) => {
    try {
      const { jid, disclaimerText, headerText, contentText, title, table, noHeading, footerText } = req.body
      const result = await sock(req).sendMessage(jid, { disclaimerText, headerText, contentText, title, table, noHeading, footerText })
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Media: Image ──────────────────────────────────────────────────────────────
  router.post('/image', upload.single('file'), async (req, res) => {
    try {
      const { jid, caption, url, viewOnce, ai, spoiler, ephemeral } = req.body
      const quoted = req.body.quoted ? JSON.parse(req.body.quoted) : undefined
      const image = await resolveMedia(req.file, url)
      if (!image) return res.status(400).json({ error: 'No file or url provided' })
      const opts = { caption, ...(viewOnce && { viewOnce: true }), ...(ai && { ai: true }), ...(spoiler && { spoiler: true }), ...(ephemeral && { ephemeral: true }) }
      const result = await sock(req).sendMessage(jid, { image, ...opts }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Media: Video ──────────────────────────────────────────────────────────────
  router.post('/video', upload.single('file'), async (req, res) => {
    try {
      const { jid, caption, url, gifPlayback, ptv, viewOnce, ephemeral } = req.body
      const quoted = req.body.quoted ? JSON.parse(req.body.quoted) : undefined
      const video = await resolveMedia(req.file, url)
      if (!video) return res.status(400).json({ error: 'No file or url provided' })
      const result = await sock(req).sendMessage(jid, {
        video, caption,
        ...(gifPlayback && { gifPlayback: true }),
        ...(ptv && { ptv: true }),
        ...(viewOnce && { viewOnce: true }),
        ...(ephemeral && { ephemeral: true }),
      }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Media: Audio ──────────────────────────────────────────────────────────────
  router.post('/audio', upload.single('file'), async (req, res) => {
    try {
      const { jid, url, ptt } = req.body
      const quoted = req.body.quoted ? JSON.parse(req.body.quoted) : undefined
      const audio = await resolveMedia(req.file, url)
      if (!audio) return res.status(400).json({ error: 'No file or url provided' })
      const result = await sock(req).sendMessage(jid, { audio, ptt: ptt === 'true' }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Media: Sticker ────────────────────────────────────────────────────────────
  router.post('/sticker', upload.single('file'), async (req, res) => {
    try {
      const { jid, url, isLottie } = req.body
      const quoted = req.body.quoted ? JSON.parse(req.body.quoted) : undefined
      const sticker = req.file ? req.file.buffer : { url }
      const result = await sock(req).sendMessage(jid, { sticker, ...(isLottie && { isLottie: true }) }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Media: Document ───────────────────────────────────────────────────────────
  router.post('/document', upload.single('file'), async (req, res) => {
    try {
      const { jid, url, caption, fileName } = req.body
      let { mimetype } = req.body
      if (!mimetype) mimetype = req.file ? (req.file.mimetype || 'application/octet-stream') : guessMime(url || fileName || '', 'application/octet-stream')
      console.log(`[API] Received /document request for ${jid} (${fileName}) mime=${mimetype}`)
      const quoted = req.body.quoted ? JSON.parse(req.body.quoted) : undefined
      const document = await resolveMedia(req.file, url)
      if (!document) return res.status(400).json({ error: 'No file or url provided' })
      const result = await sock(req).sendMessage(jid, { document, mimetype, caption, fileName }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Media: Album ──────────────────────────────────────────────────────────────
  router.post('/album', async (req, res) => {
    try {
      const { jid, album, quoted } = req.body
      let albumPayload = album
      if (album && !Array.isArray(album) && Array.isArray(album.items)) {
        albumPayload = album.items
      }
      
      if (Array.isArray(albumPayload)) {
        albumPayload = albumPayload.map(item => {
          const newItem = { ...item }
          if (newItem.image && typeof newItem.image === 'string') {
            newItem.image = { url: newItem.image }
          }
          if (newItem.video && typeof newItem.video === 'string') {
            newItem.video = { url: newItem.video }
          }
          return newItem
        })
      }

      const result = await sock(req).sendMessage(jid, { album: albumPayload }, quoted ? { quoted } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Media: Sticker Pack ───────────────────────────────────────────────────────
  router.post('/sticker-pack', async (req, res) => {
    try {
      const { jid, stickers, cover, name, publisher, description, quoted } = req.body
      
      const mappedStickers = Array.isArray(stickers) ? stickers.map(s => ({
        ...s,
        data: typeof s.data === 'string' ? { url: s.data } : s.data
      })) : []

      const payload = {
        stickers: mappedStickers,
        cover: typeof cover === 'string' ? { url: cover } : cover,
        ...(name && { name }),
        ...(publisher && { publisher }),
        ...(description && { description })
      }
      const q = quoted ? (typeof quoted === 'string' ? JSON.parse(quoted) : quoted) : undefined
      const result = await sock(req).sendMessage(jid, payload, q ? { quoted: q } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Product / Catalog ─────────────────────────────────────────────────────────
  router.post('/product', async (req, res) => {
    try {
      const { jid, product, businessOwnerJid, image, quoted } = req.body
      const payload = {
        product,
        businessOwnerJid,
        image: typeof image === 'string' ? { url: image } : image
      }
      const q = quoted ? (typeof quoted === 'string' ? JSON.parse(quoted) : quoted) : undefined
      const result = await sock(req).sendMessage(jid, payload, q ? { quoted: q } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Modify Message (Edit/Delete) ──────────────────────────────────────────────
  router.post('/modify', async (req, res) => {
    try {
      const { jid, type, messageKey, text, caption } = req.body
      if (type === 'delete') {
        const result = await sock(req).sendMessage(jid, { delete: messageKey })
        return res.json(result)
      } else if (type === 'edit') {
        const msg = { edit: messageKey, ...(text && { text }), ...(caption && { caption }) }
        const result = await sock(req).sendMessage(jid, msg)
        return res.json(result)
      } else {
        return res.status(400).json({ error: "Invalid modification type. Must be 'edit' or 'delete'." })
      }
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── View Once Media ───────────────────────────────────────────────────────────
  router.post('/view-once', upload.single('file'), async (req, res) => {
    try {
      const { jid, type = 'image', caption, url, viewOnceType = 'viewOnceV2', ephemeral, quoted } = req.body
      const media = req.file ? req.file.buffer : { url }
      
      const payload = {
        [type]: media,
        caption,
        [viewOnceType]: true,
        ...(ephemeral && { ephemeral: true })
      }
      
      const q = quoted ? (typeof quoted === 'string' ? JSON.parse(quoted) : quoted) : undefined
      const result = await sock(req).sendMessage(jid, payload, q ? { quoted: q } : {})
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Payment ───────────────────────────────────────────────────────────────────
  router.post('/payment-invite', async (req, res) => {
    try {
      const { jid, serviceType = 3 } = req.body
      const result = await sock(req).sendMessage(jid, { paymentInviteServiceType: serviceType })
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.post('/request-payment', async (req, res) => {
    try {
      const { jid, text, requestPaymentFrom } = req.body
      const result = await sock(req).sendMessage(jid, { text, requestPaymentFrom })
      res.json(result)
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Read Receipts ─────────────────────────────────────────────────────────────
  router.post('/read', async (req, res) => {
    try {
      const { keys } = req.body
      await sock(req).readMessages(keys)
      res.json({ success: true })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.post('/receipt', async (req, res) => {
    try {
      const { jid, participant, messageIds, type = 'read' } = req.body
      if (!jid || !messageIds || !Array.isArray(messageIds)) {
        return res.status(400).json({ error: "jid and messageIds (array) are required" })
      }
      await sock(req).sendReceipt(jid, participant, messageIds, type)
      res.json({ success: true })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Presence ──────────────────────────────────────────────────────────────────
  router.post('/presence', async (req, res) => {
    try {
      const { jid, type = 'available' } = req.body
      await sock(req).sendPresenceUpdate(type, jid)
      res.json({ success: true })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  router.post('/presence/subscribe', async (req, res) => {
    try {
      const { jid } = req.body
      if (!jid) return res.status(400).json({ error: "jid is required" })
      await sock(req).presenceSubscribe(jid)
      res.json({ success: true })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Star Messages ─────────────────────────────────────────────────────────────
  router.post('/star', async (req, res) => {
    try {
      const { jid, messageKeys, star } = req.body
      if (!jid || !messageKeys || !Array.isArray(messageKeys)) {
        return res.status(400).json({ error: "jid and messageKeys (array) are required" })
      }
      await sock(req).star(jid, messageKeys, star === true)
      res.json({ success: true })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Create Call Link ──────────────────────────────────────────────────────────
  router.post('/call-link', async (req, res) => {
    try {
      const { type = 'video', startTime, timeoutMs } = req.body
      const result = await sock(req).createCallLink(type, { startTime: startTime ? new Date(startTime) : undefined }, timeoutMs)
      res.json({ link: result })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  return router
}
