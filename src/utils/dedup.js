/**
 * Redis-backed idempotency / deduplication for outbound messages.
 *
 * Every send endpoint accepts an optional `idempotencyKey` in the request body.
 * When a key is present:
 *   1. We check Redis for `msg-dedup:{sessionId}:{key}`.
 *   2. If it exists we return the cached result immediately — WhatsApp never
 *      sees a duplicate.
 *   3. If it doesn't exist we let the send proceed, then store the result so
 *      any future retry with the same key is a no-op.
 *
 * TTL is 24 hours — long enough to absorb all retry windows.
 * If Redis is unavailable dedup is silently skipped (fail-open).
 */

import { createClient } from 'redis'

const REDIS_URL        = process.env.REDIS_URL        || 'redis://redis:6379'
const DEDUP_TTL_SECS   = parseInt(process.env.DEDUP_TTL_SECS || '86400', 10)  // 24 h
const PENDING_TTL_SECS = 60  // placeholder TTL while a send is in-flight

let _redis = null

async function getRedis() {
  if (_redis?.isOpen) return _redis
  try {
    _redis = createClient({ url: REDIS_URL })
    _redis.on('error', () => {})  // non-fatal
    await _redis.connect()
  } catch {
    _redis = null
  }
  return _redis
}

function dedupKey(sessionId, key) {
  return `msg-dedup:${sessionId}:${key}`
}

/**
 * Check if a message with this key was already sent.
 * Returns the cached send result (object), or null if no record found.
 */
export async function checkDedup(sessionId, idempotencyKey) {
  if (!idempotencyKey) return null
  const rc = await getRedis()
  if (!rc) return null
  try {
    const raw = await rc.get(dedupKey(sessionId, idempotencyKey))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Ignore placeholder entries — an in-flight send hasn't resolved yet
    if (parsed?.__pending) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Reserve a slot for an in-flight send.  This prevents a second concurrent
 * request with the same key from racing through while the first is still
 * waiting on Baileys.  TTL is short (60 s) so a crashed worker doesn't
 * permanently block the key.
 */
export async function reserveDedup(sessionId, idempotencyKey) {
  if (!idempotencyKey) return
  const rc = await getRedis()
  if (!rc) return
  try {
    await rc.set(dedupKey(sessionId, idempotencyKey), JSON.stringify({ __pending: true }), {
      NX: true,
      EX: PENDING_TTL_SECS,
    })
  } catch { /* non-fatal */ }
}

/**
 * Store the final send result against this key.
 */
export async function confirmDedup(sessionId, idempotencyKey, result) {
  if (!idempotencyKey) return
  const rc = await getRedis()
  if (!rc) return
  try {
    await rc.set(
      dedupKey(sessionId, idempotencyKey),
      JSON.stringify(result ?? {}),
      { EX: DEDUP_TTL_SECS }
    )
  } catch { /* non-fatal */ }
}
