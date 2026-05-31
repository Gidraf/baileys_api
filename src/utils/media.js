import { createWriteStream, mkdirSync } from 'fs'
import { pipeline } from 'stream/promises'
import fetch from 'node-fetch'
import path from 'path'
import os from 'os'

/**
 * Resolve a URL to a Buffer for upload to WhatsApp.
 * Returns { url } object so Baileys can handle it natively,
 * or a Buffer if the caller specifically needs one.
 */
export async function resolveMedia(urlOrPath) {
  if (!urlOrPath) return null

  // If it looks like a URL, let Baileys fetch it directly
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    return { url: urlOrPath }
  }

  // Local file path
  return { url: urlOrPath }
}

/**
 * Download media from a URL to a temp Buffer
 */
export async function downloadToBuffer(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch media: ${res.statusText}`)
  const buffer = await res.buffer()
  return buffer
}
