/**
 * Tailscale Proxy Pool — Node.js version
 * ════════════════════════════════════════
 * Discovers online Tailscale peers and rotates HTTP/SOCKS5 proxies across them.
 *
 * Each Tailscale peer must be running a proxy service on WA_PROXY_PORT (default 1080).
 *
 * Quick setup on each device:
 *   apt install microsocks && microsocks -p 1080
 *   # or with auth: microsocks -p 1080 -u wa -P secret
 *
 * Environment variables:
 *   WA_PROXY_PORT       Port all TS peers run proxy on      (default: 1080)
 *   WA_PROXY_PROTOCOL   socks5h | http                      (default: socks5h)
 *   WA_PROXY_USER       Optional proxy username
 *   WA_PROXY_PASS       Optional proxy password
 *   WA_PROXY_URL        Static fallback proxy URL
 *   WA_PROXY_TAGS       Comma-separated hostname substrings to filter peers
 *   TAILSCALE_REFRESH   Peer list refresh interval in seconds (default: 60)
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as net from 'net'
import * as http from 'http'

const execAsync = promisify(exec)

// ── Config ─────────────────────────────────────────────────────────────────────

const PROXY_PORT     = parseInt(process.env.WA_PROXY_PORT     || '1080', 10)
const PROXY_PROTOCOL = process.env.WA_PROXY_PROTOCOL || 'socks5h'
const PROXY_USER     = process.env.WA_PROXY_USER     || ''
const PROXY_PASS     = process.env.WA_PROXY_PASS     || ''
const STATIC_PROXY   = process.env.WA_PROXY_URL      || ''
const ALLOWED_TAGS   = (process.env.WA_PROXY_TAGS || '').split(',').map(t => t.trim()).filter(Boolean)
const REFRESH_SECS   = parseInt(process.env.TAILSCALE_REFRESH || '60', 10) * 1000
// Static peer override — WA_PROXY_PEERS=100.68.207.107,100.65.45.69,100.70.180.34
const STATIC_PEERS_RAW = process.env.WA_PROXY_PEERS || ''

const TS_SOCKET_PATHS = [
  process.env.TS_SOCKET,
  '/var/run/tailscale/tailscaled.sock',
  '/run/tailscale/tailscaled.sock',
  '/tmp/tailscaled.sock',
].filter(Boolean)

// ── Build proxy URL ─────────────────────────────────────────────────────────────

function buildProxyUrl(ip) {
  const auth = PROXY_USER ? `${encodeURIComponent(PROXY_USER)}:${encodeURIComponent(PROXY_PASS)}@` : ''
  return `${PROXY_PROTOCOL}://${auth}${ip}:${PROXY_PORT}`
}

// ── Peer discovery: static env override ────────────────────────────────────────

function peersFromEnv() {
  if (!STATIC_PEERS_RAW) return []
  const ips = STATIC_PEERS_RAW.split(',').map(s => s.trim()).filter(Boolean)
  const valid = ips.filter(ip => /^100\.\d+\.\d+\.\d+$/.test(ip))
  console.log(`[ProxyPool] ${valid.length} static peer(s) from WA_PROXY_PEERS: ${valid.join(', ')}`)
  return valid.map(ip => ({ ip, hostname: ip, os: 'static', Online: true }))
}

// ── Peer discovery: tailscale CLI --json ───────────────────────────────────────

async function queryViaCli() {
  try {
    const { stdout } = await execAsync('tailscale status --json', { timeout: 10000 })
    const data = JSON.parse(stdout)
    return Object.values(data.Peer || {})
  } catch {
    return []
  }
}

// ── Peer discovery: tailscale status plain text ─────────────────────────────────
// Format per line:
//   100.68.207.107  mail    user@  linux    -
//   100.65.45.69    gidraf  user@  android  idle; offers exit node

async function queryViaCliText() {
  try {
    const { stdout } = await execAsync('tailscale status', { timeout: 10000 })
    const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean)
    const peers = []
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(/\s+/)
      if (parts.length < 4) continue
      const [ip, hostname, , osName] = parts
      if (!/^100\.\d+\.\d+\.\d+$/.test(ip)) continue
      if (i === 0) continue  // skip self (first line)
      const statusStr = parts.slice(4).join(' ')
      if (statusStr.includes('offline')) continue
      if (ALLOWED_TAGS.length && !ALLOWED_TAGS.some(t => hostname.includes(t))) continue
      peers.push({ TailscaleIPs: [ip], HostName: hostname, OS: osName, Online: true, status: statusStr })
    }
    if (peers.length) console.log(`[ProxyPool] Plain-text: ${peers.length} peer(s) found`)
    return peers
  } catch {
    return []
  }
}

// ── Peer discovery via tailscaled Unix socket ──────────────────────────────────

function queryViaSocket(socketPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(socketPath)) { resolve([]); return }

    const socket = net.createConnection(socketPath)
    let raw = ''

    socket.on('connect', () => {
      socket.write([
        'GET /localapi/v0/status HTTP/1.1',
        'Host: local-tailscaled.sock',
        'Connection: close',
        '',
        ''
      ].join('\r\n'))
    })
    socket.on('data', d => { raw += d.toString() })
    socket.on('end', () => {
      try {
        const body = raw.split('\r\n\r\n').slice(1).join('\r\n\r\n')
        const data = JSON.parse(body)
        resolve(Object.values(data.Peer || {}))
      } catch { resolve([]) }
    })
    socket.on('error', () => resolve([]))
    socket.setTimeout(5000, () => { socket.destroy(); resolve([]) })
  })
}

// ── Fetch all online peers ──────────────────────────────────────────────────────

async function fetchPeers() {
  // 1. Static env override (fastest, no subprocess)
  const envPeers = peersFromEnv()
  if (envPeers.length > 0) {
    return envPeers.map(p => ({ ip: p.ip, hostname: p.hostname, os: p.os }))
  }

  // 2. Unix socket (no CLI needed)
  let rawPeers = []
  for (const path of TS_SOCKET_PATHS) {
    rawPeers = await queryViaSocket(path)
    if (rawPeers.length > 0) break
  }

  // 3. CLI --json
  if (rawPeers.length === 0) rawPeers = await queryViaCli()

  // 4. CLI plain text
  if (rawPeers.length === 0) rawPeers = await queryViaCliText()

  const ips = []
  for (const peer of rawPeers) {
    if (!peer.Online) continue
    const hostname = peer.HostName || peer.hostname || ''
    if (ALLOWED_TAGS.length > 0 && !ALLOWED_TAGS.some(tag => hostname.includes(tag))) continue
    const ip4 = Array.isArray(peer.TailscaleIPs)
      ? peer.TailscaleIPs.find(ip => ip.startsWith('100.') && !ip.includes(':'))
      : (peer.ip || null)
    if (ip4) ips.push({ ip: ip4, hostname, os: peer.OS || peer.os || 'unknown', status: peer.status || '' })
  }

  console.log(`[ProxyPool] ${ips.length} peer(s): ${ips.map(p => `${p.hostname}(${p.ip})`).join(', ') || 'none'}`)
  return ips
}

// ── Pool class ──────────────────────────────────────────────────────────────────

class ProxyPool {
  constructor() {
    this._peers       = []          // [{ ip, hostname }]
    this._rrIndex     = 0           // global round-robin pointer
    this._partnerPin  = new Map()   // partner_id → ip
    this._lastRefresh = 0
    this._refreshing  = false
    // Kick off initial load + periodic refresh
    this._scheduleRefresh()
  }

  _scheduleRefresh() {
    this._doRefresh()
    setInterval(() => this._doRefresh(), REFRESH_SECS)
  }

  async _doRefresh() {
    if (this._refreshing) return
    this._refreshing = true
    try {
      const peers = await fetchPeers()
      // Clear pins for IPs that vanished
      const newIPs = new Set(peers.map(p => p.ip))
      for (const [pid, ip] of this._partnerPin.entries()) {
        if (!newIPs.has(ip)) this._partnerPin.delete(pid)
      }
      this._peers = peers
      this._lastRefresh = Date.now()
    } catch (e) {
      console.warn('[ProxyPool] Refresh error:', e.message)
    }
    this._refreshing = false
  }

  async forceRefresh() {
    this._lastRefresh = 0
    await this._doRefresh()
  }

  /**
   * Get a proxy URL for a session/partner.
   * If WA_PROXY_URL is set, always use it.
   * Otherwise, partners are pinned to a random connected peer for session consistency.
   * Returns null when no proxy is available.
   */
  getProxy(sessionId = null) {
    // Always prefer a fixed proxy when explicitly configured.
    if (STATIC_PROXY) return STATIC_PROXY

    if (this._peers.length === 0) return null

    if (sessionId) {
      if (this._partnerPin.has(sessionId)) {
        const pinnedIp = this._partnerPin.get(sessionId)
        if (this._peers.some(p => p.ip === pinnedIp)) {
          return buildProxyUrl(pinnedIp)
        }
      }
      // Randomize across currently connected peers, then pin per session.
      const peer = this._peers[Math.floor(Math.random() * this._peers.length)]
      this._partnerPin.set(sessionId, peer.ip)
      return buildProxyUrl(peer.ip)
    }

    // Random peer selection when no session ID is provided.
    const peer = this._peers[Math.floor(Math.random() * this._peers.length)]
    return buildProxyUrl(peer.ip)
  }

  /**
   * Get ALL proxy URLs (for external tooling / health checks).
   */
  getAllProxies() {
    return this._peers.map(p => ({ url: buildProxyUrl(p.ip), ip: p.ip, hostname: p.hostname }))
  }

  unpin(sessionId) {
    this._partnerPin.delete(sessionId)
  }

  status() {
    return {
      peers:            this._peers.length,
      peerList:         this._peers.map(p => ({
        ip:       p.ip,
        hostname: p.hostname,
        os:       p.os || 'unknown',
        status:   p.status || '',
        proxyUrl: buildProxyUrl(p.ip),
      })),
      staticFallback:    STATIC_PROXY || null,
      proxyPort:         PROXY_PORT,
      protocol:          PROXY_PROTOCOL,
      pinnedSessions:    this._partnerPin.size,
      usingEnvPeers:     Boolean(STATIC_PEERS_RAW),
      lastRefreshMs:     this._lastRefresh,
      lastRefreshAgoSec: Math.floor((Date.now() - this._lastRefresh) / 1000),
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _pool = null
export function getPool() {
  if (!_pool) _pool = new ProxyPool()
  return _pool
}

export const proxyPool = { getPool }

/**
 * Get a proxy URL for a session ID (convenience wrapper).
 */
export function getProxy(sessionId = null) {
  return getPool().getProxy(sessionId)
}

export default { getPool, getProxy }
