import fetch from 'node-fetch'
import mime from 'mime-types'
import path from 'path'

/**
 * Download a remote URL (HTTP/HTTPS) to a Buffer.
 * Baileys works most reliably with Buffers — avoids issues with
 * private MinIO URLs or HTTPS certs that Baileys can't resolve itself.
 */
export async function downloadToBuffer(url) {
  const res = await fetch(url, { timeout: 60000 })
  if (!res.ok) throw new Error(`Failed to fetch media ${url}: ${res.status} ${res.statusText}`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Resolve media for a Baileys sendMessage call.
 * - If req.file is present (multipart upload): use the buffer directly.
 * - If url is provided (HTTP/HTTPS): download to buffer so Baileys doesn't
 *   need to reach out itself (important for private MinIO endpoints).
 * - If url is a local path: pass as { url } — Baileys reads local files fine.
 *
 * Returns the value to use as the media key in the Baileys payload.
 */
export async function resolveMedia(file, url) {
  if (file && file.buffer) return file.buffer

  if (!url) return null

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return await downloadToBuffer(url)
  }

  // Local file path — pass as-is
  return { url }
}

/**
 * Guess a reasonable MIME type from a URL or filename.
 */
export function guessMime(urlOrFilename, fallback = 'application/octet-stream') {
  const ext = path.extname(urlOrFilename || '').toLowerCase()
  return mime.lookup(ext) || fallback
}
