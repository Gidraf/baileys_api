import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Webhook, Globe, Trash2, Send, RefreshCw, CheckCircle2,
  XCircle, Radio, Filter, Copy, ChevronDown, ChevronRight, Zap,
  Network, RotateCcw, Wifi, WifiOff, Pin, PinOff,
} from 'lucide-react';

const API = '/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function EventBadge({ event }) {
  const colors = {
    'messages.upsert':     'bg-green-500/20 text-green-400',
    'poll.vote':           'bg-purple-500/20 text-purple-400',
    'poll.result':         'bg-purple-700/20 text-purple-300',
    'interactive.response':'bg-blue-500/20 text-blue-400',
    'connected':           'bg-emerald-500/20 text-emerald-400',
    'disconnected':        'bg-red-500/20 text-red-400',
    'connection.update':   'bg-yellow-500/20 text-yellow-400',
    'webhook.test':        'bg-cyan-500/20 text-cyan-400',
    'qr':                  'bg-orange-500/20 text-orange-400',
  };
  const cls = colors[event] || 'bg-gray-500/20 text-gray-300';
  return <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${cls}`}>{event}</span>;
}

function EventRow({ entry }) {
  const [open, setOpen] = useState(false);
  const json = JSON.stringify(entry.data, null, 2);

  return (
    <div className="border-b border-[#222d34] last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />}
        <EventBadge event={entry.event} />
        <span className="text-xs text-gray-400 font-mono">{entry.sessionId}</span>
        <span className="ml-auto text-xs text-gray-500">{ago(entry.timestamp)}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="relative">
            <button
              onClick={() => navigator.clipboard.writeText(json)}
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
              title="Copy"
            >
              <Copy className="w-4 h-4" />
            </button>
            <pre className="bg-[#0d1a20] rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto max-h-64">
              {json}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WebhookPlayground() {
  const [sessions, setSessions] = useState([]);
  const [webhooks, setWebhooks] = useState({});      // { sessionId: url }
  const [events, setEvents]     = useState([]);
  const [proxyPool, setProxyPool]     = useState(null);
  const [proxyRefreshing, setProxyRefreshing] = useState(false);
  const [filterSession, setFilterSession] = useState('');
  const [filterEvent, setFilterEvent]     = useState('');
  const [liveMode, setLiveMode]     = useState(true);
  const [editUrl, setEditUrl]       = useState({});   // { sessionId: url }
  const [saving, setSaving]         = useState({});
  const [testing, setTesting]       = useState({});
  const [testResult, setTestResult] = useState({});
  const sseRef = useRef(null);
  const eventsEndRef = useRef(null);

  // ── Load sessions & webhooks ────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const [sessRes, whRes] = await Promise.all([
        fetch(`${API}/sessions`).then(r => r.json()),
        fetch(`${API}/webhooks`).then(r => r.json()),
      ]);
      const s = sessRes.sessions || [];
      setSessions(s);
      const map = {};
      (whRes.webhooks || []).forEach(w => { map[w.sessionId] = w.webhookUrl || ''; });
      setWebhooks(map);
      setEditUrl(map);
    } catch {}
  }, []);

  // ── Load Tailscale proxy pool status ────────────────────────────────────────
  const loadProxyPool = useCallback(async () => {
    try {
      const data = await fetch(`${API}/proxy/pool`).then(r => r.json());
      setProxyPool(data);
    } catch {}
  }, []);

  const refreshProxyPool = async () => {
    setProxyRefreshing(true);
    try {
      const data = await fetch(`${API}/proxy/pool/refresh`, { method: 'POST' }).then(r => r.json());
      setProxyPool(data);
    } catch {}
    setProxyRefreshing(false);
  };

  const unpinSession = async (sessionId) => {
    try {
      await fetch(`${API}/proxy/pool/pin/${sessionId}`, { method: 'DELETE' });
      loadProxyPool();
    } catch {}
  };

  useEffect(() => { refresh(); loadProxyPool(); }, [refresh, loadProxyPool]);

  // ── SSE live stream ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!liveMode) { sseRef.current?.close(); return; }
    const since = events.length > 0 ? events[events.length - 1].timestamp : 0;
    const es = new EventSource(`${API}/webhooks/events/stream?since=${since}`);
    sseRef.current = es;
    es.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data);
        setEvents(prev => [...prev.slice(-199), entry]);
      } catch {}
    };
    es.onerror = () => {};
    return () => es.close();
  }, [liveMode]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (liveMode) eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events, liveMode]);

  // ── Load recent events (initial / refresh) ──────────────────────────────────
  const loadRecent = async () => {
    try {
      const qs = filterSession ? `sessionId=${filterSession}&` : '';
      const r = await fetch(`${API}/webhooks/events/recent?${qs}limit=100`).then(r => r.json());
      setEvents((r.events || []).reverse());
    } catch {}
  };
  useEffect(() => { if (!liveMode) loadRecent(); }, [liveMode, filterSession]);

  // ── Save webhook URL ────────────────────────────────────────────────────────
  const saveWebhook = async (sessionId) => {
    setSaving(s => ({ ...s, [sessionId]: true }));
    try {
      const url = editUrl[sessionId] || '';
      if (!url) {
        await fetch(`${API}/webhooks/${sessionId}`, { method: 'DELETE' });
      } else {
        await fetch(`${API}/webhooks/${sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
      }
      setWebhooks(w => ({ ...w, [sessionId]: url }));
    } catch {}
    setSaving(s => ({ ...s, [sessionId]: false }));
  };

  // ── Test webhook ─────────────────────────────────────────────────────────────
  const testWebhook = async (sessionId) => {
    setTesting(t => ({ ...t, [sessionId]: true }));
    setTestResult(r => ({ ...r, [sessionId]: null }));
    try {
      const r = await fetch(`${API}/webhooks/test/${sessionId}`, { method: 'POST' });
      const data = await r.json();
      setTestResult(p => ({ ...p, [sessionId]: data }));
    } catch (err) {
      setTestResult(p => ({ ...p, [sessionId]: { error: err.message } }));
    }
    setTesting(t => ({ ...t, [sessionId]: false }));
  };

  // ── Inject fake event ────────────────────────────────────────────────────────
  const injectEvent = async () => {
    await fetch(`${API}/webhooks/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: filterSession || (sessions[0]?.sessionId ?? 'test'),
        event: 'webhook.test',
        data: { message: 'Test event from playground', ts: Date.now() },
      }),
    });
  };

  // ── Filtered events ──────────────────────────────────────────────────────────
  const filtered = events.filter(e => {
    if (filterSession && e.sessionId !== filterSession) return false;
    if (filterEvent && !e.event.includes(filterEvent)) return false;
    return true;
  });

  // ── Unique event types for filter ────────────────────────────────────────────
  const eventTypes = [...new Set(events.map(e => e.event))].sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Webhook className="w-8 h-8 text-[#25D366]" />
          <div>
            <h2 className="text-2xl font-bold">Webhook Playground</h2>
            <p className="text-gray-400 text-sm">Configure webhooks and watch events in real-time</p>
          </div>
        </div>
        <button onClick={refresh} className="flex items-center gap-2 px-4 py-2 glass rounded-lg hover:text-[#25D366] text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Webhook Configuration Cards */}
      <div className="grid gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="w-5 h-5 text-[#25D366]" /> Session Webhook URLs
        </h3>
        {sessions.length === 0 && (
          <div className="glass rounded-xl p-6 text-center text-gray-400">
            No sessions found. Create a session from the Dashboard first.
          </div>
        )}
        {sessions.map(sess => {
          const sid = sess.sessionId;
          const currentUrl = editUrl[sid] ?? (webhooks[sid] || '');
          const saved = webhooks[sid] || '';
          const changed = currentUrl !== saved;
          const tr = testResult[sid];

          return (
            <div key={sid} className="glass rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold">{sid}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    sess.status === 'open'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>{sess.status}</span>
                </div>
                {saved && (
                  <button
                    onClick={() => testWebhook(sid)}
                    disabled={testing[sid]}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition"
                  >
                    <Send className="w-3 h-3" />
                    {testing[sid] ? 'Sending…' : 'Test Ping'}
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://your-server.com/webhook"
                  value={currentUrl}
                  onChange={e => setEditUrl(p => ({ ...p, [sid]: e.target.value }))}
                  className="flex-1 bg-[#0d1a20] border border-[#2a3a42] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#25D366]"
                />
                <button
                  onClick={() => saveWebhook(sid)}
                  disabled={!changed || saving[sid]}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    changed && !saving[sid]
                      ? 'bg-[#25D366] text-black hover:bg-[#1da84f]'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {saving[sid] ? 'Saving…' : changed ? 'Save' : 'Saved'}
                </button>
                {saved && (
                  <button
                    onClick={() => { setEditUrl(p => ({ ...p, [sid]: '' })); saveWebhook(sid); }}
                    className="px-3 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                    title="Remove webhook"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {tr && (
                <div className={`text-xs flex items-center gap-2 px-3 py-2 rounded-lg ${
                  tr.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {tr.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {tr.success ? `Ping delivered (HTTP ${tr.status})` : `Error: ${tr.error || 'Request failed'}`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live Event Stream */}
      <div className="glass rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[#222d34]">
          <div className="flex items-center gap-2 flex-1">
            <Radio className={`w-4 h-4 ${liveMode ? 'text-[#25D366] animate-pulse' : 'text-gray-500'}`} />
            <span className="font-semibold text-sm">Event Stream</span>
            <span className="text-xs text-gray-500">{filtered.length} events</span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterSession}
              onChange={e => setFilterSession(e.target.value)}
              className="bg-[#0d1a20] border border-[#2a3a42] rounded-lg px-2 py-1 text-xs"
            >
              <option value="">All Sessions</option>
              {sessions.map(s => <option key={s.sessionId} value={s.sessionId}>{s.sessionId}</option>)}
            </select>
            <select
              value={filterEvent}
              onChange={e => setFilterEvent(e.target.value)}
              className="bg-[#0d1a20] border border-[#2a3a42] rounded-lg px-2 py-1 text-xs"
            >
              <option value="">All Events</option>
              {eventTypes.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLiveMode(l => !l)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition ${
                liveMode ? 'bg-[#25D366]/20 text-[#25D366]' : 'bg-gray-700 text-gray-400'
              }`}
            >
              <Radio className="w-3 h-3" />
              {liveMode ? 'Live' : 'Paused'}
            </button>
            <button
              onClick={injectEvent}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition"
              title="Inject a test event into the stream"
            >
              <Zap className="w-3 h-3" /> Inject
            </button>
            <button
              onClick={() => setEvents([])}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
        </div>

        {/* Events list */}
        <div className="max-h-[600px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <Radio className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Waiting for events…</p>
              <p className="text-xs mt-1 opacity-60">
                Configure a webhook URL above, then send a message to see events here.
              </p>
            </div>
          ) : (
            filtered.map((e, i) => <EventRow key={`${e.timestamp}-${i}`} entry={e} />)
          )}
          <div ref={eventsEndRef} />
        </div>
      </div>

      {/* Tailscale Proxy Pool */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222d34]">
          <div className="flex items-center gap-3">
            <Network className="w-5 h-5 text-[#25D366]" />
            <div>
              <h3 className="font-semibold">Tailscale Proxy Pool</h3>
              <p className="text-xs text-gray-400">Each session is pinned to a different Tailscale device IP for anti-ban diversity</p>
            </div>
          </div>
          <button
            onClick={refreshProxyPool}
            disabled={proxyRefreshing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 glass rounded-lg hover:text-[#25D366] transition"
          >
            <RotateCcw className={`w-4 h-4 ${proxyRefreshing ? 'animate-spin' : ''}`} />
            {proxyRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {!proxyPool ? (
          <div className="py-10 text-center text-gray-500 text-sm">Loading proxy pool…</div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Online Peers', value: proxyPool.peers ?? 0, color: proxyPool.peers > 0 ? 'text-green-400' : 'text-gray-400' },
                { label: 'Protocol', value: proxyPool.protocol || '—', color: 'text-blue-400' },
                { label: 'Proxy Port', value: proxyPool.proxyPort || '—', color: 'text-purple-400' },
                { label: 'Pinned Sessions', value: proxyPool.pinnedSessions ?? 0, color: 'text-yellow-400' },
              ].map(s => (
                <div key={s.label} className="bg-[#0d1a20] rounded-lg p-3 text-center">
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Static fallback */}
            {proxyPool.staticFallback && (
              <div className="flex items-center gap-2 text-xs px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400">
                <Globe className="w-4 h-4" />
                Static fallback: <code className="ml-1 font-mono">{proxyPool.staticFallback}</code>
              </div>
            )}

            {/* Peer list */}
            {proxyPool.peerList && proxyPool.peerList.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Online Devices</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {proxyPool.peerList.map((peer, i) => {
                    const isAndroid = (peer.os || '').toLowerCase() === 'android';
                    return (
                      <div key={peer.ip} className="flex items-center gap-3 bg-[#0d1a20] rounded-lg px-4 py-3">
                        <Wifi className="w-4 h-4 text-green-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-gray-200 truncate">{peer.hostname || peer.ip}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                              isAndroid ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'
                            }`}>{peer.os || 'unknown'}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500 font-mono">{peer.ip}:{proxyPool.proxyPort}</span>
                            {peer.status && <span className="text-xs text-gray-600 truncate">{peer.status}</span>}
                          </div>
                          {isAndroid && (
                            <div className="text-xs text-yellow-500/70 mt-1">
                              Android: run <code className="bg-[#0b141a] px-1 rounded">microsocks -p {proxyPool.proxyPort}</code> in Termux
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">#{i + 1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center space-y-2">
                <WifiOff className="w-8 h-8 mx-auto text-gray-600" />
                <p className="text-sm text-gray-400">No Tailscale peers found</p>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Install <code className="text-gray-300">microsocks</code> on each Tailscale device and run:
                  <code className="block mt-1 bg-[#0d1a20] rounded px-3 py-1 font-mono text-gray-300">microsocks -p {proxyPool.proxyPort || 1080}</code>
                </p>
                {proxyPool.staticFallback && (
                  <p className="text-xs text-yellow-500">Using static fallback: {proxyPool.staticFallback}</p>
                )}
              </div>
            )}

            {/* Per-session pins for current sessions */}
            {sessions.length > 0 && proxyPool.peers > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Session Proxy Pins</h4>
                <div className="space-y-1.5">
                  {sessions.map(s => {
                    const peerList = proxyPool.peerList || []
                    const hash = s.sessionId.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0)
                    const pinned = peerList.length > 0 ? peerList[hash % peerList.length] : null
                    return (
                      <div key={s.sessionId} className="flex items-center gap-3 text-xs">
                        <span className="font-mono text-gray-300 w-32 truncate">{s.sessionId}</span>
                        <span className="text-gray-500">→</span>
                        {pinned ? (
                          <span className="flex items-center gap-1.5 text-green-400 font-mono">
                            <Pin className="w-3 h-3" />
                            {pinned.ip} ({pinned.hostname})
                          </span>
                        ) : (
                          <span className="text-gray-500">no proxy</span>
                        )}
                        {pinned && (
                          <button
                            onClick={() => unpinSession(s.sessionId)}
                            className="ml-auto text-gray-500 hover:text-red-400"
                            title="Unpin (next send picks a new peer)"
                          >
                            <PinOff className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-600 pt-1">
              Last refreshed {proxyPool.lastRefreshAgoSec}s ago — auto-refreshes every {Math.round((parseInt(process?.env?.TAILSCALE_REFRESH || '60', 10)))}s
            </div>
          </div>
        )}
      </div>

      {/* Webhook Payload Reference */}
      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Webhook className="w-4 h-4 text-[#25D366]" /> Webhook Payload Format
        </h3>
        <pre className="bg-[#0d1a20] rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto">{`// Every webhook POST contains:
{
  "sessionId": "your-session-id",
  "event":     "messages.upsert",   // event name
  "data":      { ... },             // event-specific payload
  "timestamp": 1718000000000        // Unix ms
}

// Common events:
// messages.upsert        — incoming message
// poll.vote              — someone voted on your poll
// poll.result            — updated tally after a vote
// interactive.response   — button / list / flow response
// connected              — session connected
// disconnected           — session disconnected
// qr                     — new QR code (data: { qr: dataURL })
// pairing_code           — pairing code issued`}
        </pre>
      </div>
    </div>
  );
}
