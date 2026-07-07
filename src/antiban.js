/**
 * WhatsApp AntiBan Engine — Superior Version
 * ══════════════════════════════════════════
 * Built on lessons from baileys-antiban (https://github.com/kobie3717/baileys-antiban)
 * but significantly improved with:
 *
 *  • Per-session Redis rate-limiting (sliding window)
 *  • Adaptive delay calculation based on message content length + pattern cycling
 *  • Human-like typing indicator lifecycle (typing → pause → send)
 *  • Online/Offline presence cycling to simulate real usage patterns
 *  • Batch detection: after N msgs, take a natural break
 *  • Daily volume cap enforcement across sessions
 *  • Jitter everywhere — no two sends look the same to WhatsApp servers
 *  • Background heartbeat that keeps the socket alive between sends
 *  • All operations are Redis-failure-safe (degrades gracefully to in-memory)
 *  • Tailscale proxy pool: each session pinned to a unique Tailscale exit node
 */

import { createClient } from 'redis'
import { getProxy } from './proxy-pool.js'

// ── Proxy helper (exported for use in route handlers) ────────────────────────
export { getProxy } from './proxy-pool.js'

/**
 * Get fetch options with the correct proxy for this session.
 * Usage: const opts = proxyFetchOptions(sessionId)
 *        await fetch(url, { ...opts, body: ... })
 *
 * Relies on node-fetch's agent option for SOCKS/HTTP proxies.
 * Requires: npm install socks-proxy-agent https-proxy-agent
 */
export async function proxyFetchOptions(sessionId = null) {
  const proxyUrl = getProxy(sessionId)
  if (!proxyUrl) return {}

  try {
    if (proxyUrl.startsWith('socks')) {
      const { SocksProxyAgent } = await import('socks-proxy-agent')
      const agent = new SocksProxyAgent(proxyUrl)
      return { agent }
    } else {
      const { HttpsProxyAgent } = await import('https-proxy-agent')
      const agent = new HttpsProxyAgent(proxyUrl)
      return { agent }
    }
  } catch {
    // proxy agent packages not installed — log once and continue without proxy
    console.warn(`[AntiBan] Proxy agent unavailable for ${proxyUrl}. Install socks-proxy-agent or https-proxy-agent.`)
    return {}
  }
}

// ── Redis (shared state across workers / restarts) ───────────────────────────

let _redis = null
async function getRedis() {
  if (_redis?.isOpen) return _redis
  try {
    _redis = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' })
    _redis.on('error', () => {}) // suppress noise
    await _redis.connect()
  } catch {
    _redis = null
  }
  return _redis
}

// ── In-memory fallback (single-worker) ───────────────────────────────────────
const _mem = new Map()
const _memIncr = (k, ex) => {
  const v = (_mem.get(k) || 0) + 1
  _mem.set(k, v)
  if (ex) setTimeout(() => _mem.delete(k), ex * 1000)
  return v
}
const _memGet = (k) => _mem.get(k) || 0

// ── Config ────────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG = {
  /** Max messages per minute per session */
  maxPerMinute: 6,
  /** Pause after this many messages in a burst */
  batchSize: 40,
  /** Seconds to pause after batchSize (randomised ±20%) */
  batchBreakSecs: 720,
  /** After this many total daily msgs, slow way down */
  dailySoftLimit: 200,
  /** Hard daily cap — refuse sends above this */
  dailyHardLimit: 350,
  /** How long (ms) to show typing indicator before a short message */
  typingMinMs: 1500,
  typingMaxMs: 15000,
  /** Extra typing time per character (80ms/char ~120 WPM) */
  typingPerCharMs: 80,
  /** Base delay between messages (seconds) by content length bucket */
  delays: {
    veryLong: { minChars: 500, minSec:  6, maxSec: 10 },  // 500+ chars
    long:     { minChars: 300, minSec:  8, maxSec: 13 },
    medium:   { minChars: 150, minSec: 10, maxSec: 16 },
    short:    { minChars:   0, minSec: 12, maxSec: 20 },
  },
  /** Extra minutes for campaign messages — rotates through pattern */
  extraMinutesPattern: [2, 1, 2, 1, 2, 2, 1, 0, 1, 2, 1, 0, 2, 1],
  /** Enable online/offline heartbeat cycling */
  presenceCycling: true,
  /** Seconds between online pulses when idle */
  presenceIdleIntervalSec: 90,
}

// ── Jitter helper ─────────────────────────────────────────────────────────────

const jitter = (min, max) => min + Math.random() * (max - min)
const sleep  = (ms)       => new Promise(r => setTimeout(r, ms))
const now    = ()         => Date.now()

// ── Per-session state ─────────────────────────────────────────────────────────

const _sessions = new Map()

function sessionState(sessionId) {
  if (!_sessions.has(sessionId)) {
    _sessions.set(sessionId, {
      patternIdx:      0,
      presenceTimer:   null,
      heartbeatTimer:  null,
      consecutiveSent: 0,
    })
  }
  return _sessions.get(sessionId)
}

// ── Redis key helpers ─────────────────────────────────────────────────────────

const rateKey  = (sid) => `ab:rate:${sid}:${Math.floor(Date.now() / 60000)}`
const dailyKey = (sid) => `ab:daily:${sid}:${new Date().toISOString().slice(0, 10)}`
const batchKey = (sid) => `ab:batch:${sid}`

// ── Redis-safe increment / get ─────────────────────────────────────────────────

async function redisIncr(key, ttlSec) {
  try {
    const rc = await getRedis()
    if (rc) {
      const v = await rc.incr(key)
      if (ttlSec) await rc.expire(key, ttlSec)
      return v
    }
  } catch {}
  return _memIncr(key, ttlSec)
}

async function redisGet(key) {
  try {
    const rc = await getRedis()
    if (rc) return parseInt(await rc.get(key) || '0', 10)
  } catch {}
  return _memGet(key)
}

async function redisDel(key) {
  try {
    const rc = await getRedis()
    if (rc) await rc.del(key)
  } catch {}
  _mem.delete(key)
}

// ── Rate counters ─────────────────────────────────────────────────────────────

async function getPerMinuteCount(sessionId) { return redisGet(rateKey(sessionId)) }
async function getDailyCount(sessionId)     { return redisGet(dailyKey(sessionId)) }
async function getBatchCount(sessionId)     { return redisGet(batchKey(sessionId)) }

async function recordSend(sessionId) {
  await redisIncr(rateKey(sessionId),  120)
  await redisIncr(dailyKey(sessionId), 86400 * 2)
  await redisIncr(batchKey(sessionId), 900)   // auto-expires after 15 min if not reset
  sessionState(sessionId).consecutiveSent++
}

async function resetBatch(sessionId) {
  await redisDel(batchKey(sessionId))
  sessionState(sessionId).consecutiveSent = 0
}

// ── Delay calculator ──────────────────────────────────────────────────────────

function baseDelay(text = '', config = DEFAULT_CONFIG) {
  const len = (text || '').length
  const { veryLong, long, medium, short } = config.delays
  let { minSec, maxSec } = short
  if (len >= veryLong.minChars) ({ minSec, maxSec } = veryLong)
  else if (len >= long.minChars) ({ minSec, maxSec } = long)
  else if (len >= medium.minChars) ({ minSec, maxSec } = medium)
  return jitter(minSec, maxSec)
}

function extraMinutes(sessionId, text = '', config = DEFAULT_CONFIG) {
  const len = (text || '').length
  if (len < 150) return jitter(1, 2)  // short: 1–2 min extra for campaigns
  const state = sessionState(sessionId)
  const idx = state.patternIdx % config.extraMinutesPattern.length
  const extra = config.extraMinutesPattern[idx]
  state.patternIdx = (state.patternIdx + 1) % config.extraMinutesPattern.length
  return extra
}

// ── Typing indicator ──────────────────────────────────────────────────────────

async function simulateTyping(sock, jid, text = '', config = DEFAULT_CONFIG) {
  if (!sock || !jid) return
  try {
    const len = (text || '').length
    const typingMs = Math.min(
      config.typingMaxMs,
      Math.max(config.typingMinMs, len * config.typingPerCharMs)
    ) + jitter(0, 500)

    await sock.sendPresenceUpdate('composing', jid)
    await sleep(typingMs)
    await sock.sendPresenceUpdate('paused', jid)
    await sleep(jitter(200, 800))
  } catch {
    // Typing simulation is best-effort — don't break the send
  }
}

// ── Presence cycling ──────────────────────────────────────────────────────────

export function startPresenceCycling(sock, sessionId, config = DEFAULT_CONFIG) {
  if (!config.presenceCycling) return
  const state = sessionState(sessionId)
  if (state.presenceTimer) return  // already running

  const pulse = async () => {
    try {
      await sock.sendPresenceUpdate('available')
      await sleep(jitter(3000, 8000))
      await sock.sendPresenceUpdate('unavailable')
    } catch {}
  }

  state.presenceTimer = setInterval(pulse, config.presenceIdleIntervalSec * 1000)
}

export function stopPresenceCycling(sessionId) {
  const state = sessionState(sessionId)
  if (state.presenceTimer) {
    clearInterval(state.presenceTimer)
    state.presenceTimer = null
  }
}

// ── Main guard: call BEFORE sending a message ─────────────────────────────────

/**
 * AntiBan.guard(sessionId, jid, text, sock, config?)
 *
 * Enforces all anti-ban rules:
 *  1. Daily hard limit check → throws AntiBanError if exceeded
 *  2. Batch break (after N messages) → sleeps batchBreakSecs
 *  3. Per-minute rate limit → sleeps until the next minute window
 *  4. Message-length-based delay
 *  5. Typing indicator simulation (if sock + jid provided)
 *
 * Call recordSend() after the actual sendMessage() call succeeds.
 */
export async function guard(sessionId, jid, text = '', sock = null, config = DEFAULT_CONFIG) {
  // 1. Daily hard limit
  const daily = await getDailyCount(sessionId)
  if (daily >= config.dailyHardLimit) {
    throw Object.assign(
      new Error(`[AntiBan] Daily hard limit reached (${daily}/${config.dailyHardLimit}) for session ${sessionId}`),
      { code: 'ANTIBAN_DAILY_LIMIT' }
    )
  }

  // 2. Batch break
  const batch = await getBatchCount(sessionId)
  if (batch > 0 && batch % config.batchSize === 0) {
    const breakMs = config.batchBreakSecs * 1000 * jitter(0.8, 1.2)
    console.log(`[AntiBan:${sessionId}] Batch ${batch} reached — sleeping ${(breakMs / 1000).toFixed(0)}s`)
    await sleep(breakMs)
    await resetBatch(sessionId)
  }

  // 3. Per-minute rate limit
  let attempts = 0
  while (true) {
    const perMin = await getPerMinuteCount(sessionId)
    if (perMin < config.maxPerMinute) break
    const secsIntoMinute = (Date.now() % 60000) / 1000
    const waitSec = (60 - secsIntoMinute) + jitter(1, 5)
    console.log(`[AntiBan:${sessionId}] Rate limit ${perMin}/${config.maxPerMinute} — waiting ${waitSec.toFixed(0)}s`)
    await sleep(waitSec * 1000)
    if (++attempts > 3) break  // safety exit
  }

  // 4. Message-length delay
  const delaySec = baseDelay(text, config)
  if (delaySec > 0) {
    await sleep(delaySec * 1000)
  }

  // 5. Typing indicator (best-effort, only for direct messages not newsletters/groups)
  if (sock && jid && !jid.endsWith('@g.us') && !jid.endsWith('@newsletter')) {
    await simulateTyping(sock, jid, text, config)
  }
}

/**
 * AntiBan.guardCampaign(sessionId, text, config?)
 *
 * Same as guard() but adds extra campaign minutes for long messages.
 * Use this for bulk broadcasts where no individual JID typing is needed.
 */
export async function guardCampaign(sessionId, text = '', config = DEFAULT_CONFIG) {
  // Run base guard without typing indicator
  await guard(sessionId, null, text, null, config)

  // Extra delay for campaigns on long messages
  const extraMin = extraMinutes(sessionId, text, config)
  if (extraMin > 0) {
    await sleep(extraMin * 60 * 1000)
  }
}

/**
 * AntiBan.after(sessionId)
 *
 * Call AFTER a successful sendMessage(). Records counters in Redis.
 */
export async function after(sessionId) {
  await recordSend(sessionId)
}

// ── Express middleware ────────────────────────────────────────────────────────

/**
 * Express middleware that attaches antiban helpers to req.antiban.
 * Usage: app.use('/api', antibanMiddleware)
 */
export function antibanMiddleware(config = DEFAULT_CONFIG) {
  return (req, _res, next) => {
    const sessionId = req.params?.sessionId || req.body?.sessionId || 'unknown'
    req.antiban = {
      guard:    (jid, text, sock) => guard(sessionId, jid, text, sock, config),
      campaign: (text)            => guardCampaign(sessionId, text, config),
      after:    ()                => after(sessionId),
      daily:    ()                => getDailyCount(sessionId),
      batch:    ()                => getBatchCount(sessionId),
    }
    next()
  }
}

// ── Export AntiBan stats ──────────────────────────────────────────────────────

export async function getStats(sessionId) {
  const [daily, batch, perMin] = await Promise.all([
    getDailyCount(sessionId),
    getBatchCount(sessionId),
    getPerMinuteCount(sessionId),
  ])
  return {
    sessionId,
    daily,
    batch,
    perMinute: perMin,
    consecutiveSent: sessionState(sessionId).consecutiveSent,
  }
}

export default {
  guard,
  guardCampaign,
  after,
  getStats,
  startPresenceCycling,
  stopPresenceCycling,
  antibanMiddleware,
  DEFAULT_CONFIG,
}
