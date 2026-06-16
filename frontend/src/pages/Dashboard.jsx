import React, { useState, useEffect, useRef } from 'react';
import { QrCode, LogIn, CheckCircle2, Loader2, LogOut, Smartphone } from 'lucide-react';

export default function Dashboard() {
  const [sessionId, setSessionId] = useState(localStorage.getItem('baileys_session') || '');
  const [inputSession, setInputSession] = useState('');
  const [status, setStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [phoneInfo, setPhoneInfo] = useState(null);
  const [partnerId, setPartnerId] = useState('');
  const [deletingPartner, setDeletingPartner] = useState(false);
  const [partnerResult, setPartnerResult] = useState(null);
  
  const pollInterval = useRef(null);

  useEffect(() => {
    if (sessionId) {
      checkStatus(sessionId);
    }
    return () => clearInterval(pollInterval.current);
  }, [sessionId]);

  const startPolling = (id) => {
    clearInterval(pollInterval.current);
    pollInterval.current = setInterval(() => checkStatus(id), 3000);
  };

  const checkStatus = async (id) => {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        if (data.status === 'open') {
           setPhoneInfo(data.phone);
           setQrCode(null);
           clearInterval(pollInterval.current);
        } else if (data.status === 'connecting' || data.status === 'qr') {
           fetchQr(id);
        }
      } else {
        setStatus('disconnected');
        clearInterval(pollInterval.current);
      }
    } catch (err) {
      console.error(err);
      setStatus('disconnected');
      clearInterval(pollInterval.current);
    }
  };

  const fetchQr = async (id) => {
    try {
      const res = await fetch(`/api/sessions/${id}/qr`);
      if (res.ok) {
        const json = await res.json();
        if (json.type === 'qr' && json.data) {
           setQrCode(json.data);
        }
      }
    } catch (err) {}
  };

  const handleCreateSession = async () => {
    if (!inputSession) return;
    setLoading(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: inputSession, ephemeral: true })
      });
      if (res.ok) {
        localStorage.setItem('baileys_session', inputSession);
        setSessionId(inputSession);
        setStatus('connecting');
        startPolling(inputSession);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    if (!sessionId) return;
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    } catch (err) {}
    localStorage.removeItem('baileys_session');
    setSessionId('');
    setStatus('disconnected');
    setQrCode(null);
    setPhoneInfo(null);
    clearInterval(pollInterval.current);
  };

  const handleDeletePartnerSessions = async () => {
    if (!partnerId) return;
    setDeletingPartner(true);
    setPartnerResult(null);
    try {
      const res = await fetch(`/api/sessions/partner/${partnerId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      setPartnerResult(data);
      if (res.ok) {
        const currentSession = localStorage.getItem('baileys_session');
        if (currentSession && (currentSession === partnerId || currentSession.startsWith(partnerId + '_') || currentSession.startsWith(partnerId + '-'))) {
          localStorage.removeItem('baileys_session');
          setSessionId('');
          setStatus('disconnected');
          setQrCode(null);
          setPhoneInfo(null);
          clearInterval(pollInterval.current);
        }
      }
    } catch (err) {
      console.error(err);
      setPartnerResult({ error: err.message });
    }
    setDeletingPartner(false);
  };

  return (
    <div className="flex flex-col items-center max-w-2xl mx-auto w-full space-y-8 mt-10">
      <div className="text-center space-y-3">
        <h2 className="text-4xl font-bold text-white tracking-tight">Link Your Device</h2>
        <p className="text-gray-400">Connect your WhatsApp to start automating and sending messages.</p>
      </div>

      <div className="glass rounded-2xl p-8 w-full shadow-2xl relative overflow-hidden">
        
        {status === 'open' ? (
          <div className="flex flex-col items-center py-8 space-y-6">
            <div className="w-20 h-20 bg-[#25D366]/20 rounded-full flex items-center justify-center relative">
              <Smartphone className="w-10 h-10 text-[#25D366]" />
              <div className="absolute -bottom-1 -right-1 bg-[#111b21] rounded-full p-1">
                 <CheckCircle2 className="w-6 h-6 text-[#25D366]" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white">Connected</h3>
              <p className="text-[#25D366] font-mono mt-2 bg-[#25D366]/10 py-1 px-3 rounded-full inline-block">
                {phoneInfo || sessionId}
              </p>
            </div>
            
            <button 
              onClick={handleLogout}
              className="mt-8 flex items-center space-x-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 px-6 rounded-full font-medium transition-colors border border-red-500/20"
            >
              <LogOut className="w-5 h-5" />
              <span>Disconnect</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-8">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-400 mb-2">Session ID</label>
              <div className="flex space-x-3">
                <input 
                  type="text" 
                  value={inputSession}
                  onChange={(e) => setInputSession(e.target.value)}
                  placeholder="e.g. my-bot-session"
                  className="flex-1 bg-[#111b21] border border-[#222d34] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#25D366] transition-colors"
                />
                <button 
                  onClick={handleCreateSession}
                  disabled={!inputSession || loading}
                  className="bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 disabled:hover:bg-[#25D366] text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center shadow-[0_0_15px_rgba(37,211,102,0.3)]"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                  <span className="ml-2">Connect</span>
                </button>
              </div>
            </div>

            {(status === 'connecting' || status === 'qr') && (
              <div className="flex flex-col items-center p-8 bg-[#111b21] border border-[#222d34] rounded-xl w-full">
                {qrCode ? (
                  <div className="space-y-4 flex flex-col items-center animate-in fade-in zoom-in duration-300">
                    <div className="bg-white p-4 rounded-xl shadow-lg">
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                    </div>
                    <p className="text-gray-400 text-sm">Open WhatsApp &gt; Linked Devices &gt; Link a Device</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4 py-12">
                    <Loader2 className="w-10 h-10 animate-spin text-[#25D366]" />
                    <p className="text-gray-400 font-medium">Generating QR Code...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Partner Sessions Section */}
      <div className="glass rounded-2xl p-8 w-full shadow-2xl">
        <h3 className="text-xl font-bold text-white mb-2">Delete Partner Sessions</h3>
        <p className="text-gray-400 text-sm mb-4">Disconnect and delete all active and stored WhatsApp sessions associated with a specific partner ID prefix.</p>
        <div className="flex space-x-3">
          <input 
            type="text" 
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            placeholder="e.g. partner-a"
            className="flex-1 bg-[#111b21] border border-[#222d34] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
          />
          <button 
            onClick={handleDeletePartnerSessions}
            disabled={!partnerId || deletingPartner}
            className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center shadow-[0_0_15px_rgba(239,68,68,0.3)]"
          >
            {deletingPartner ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
            <span className="ml-2">Delete All</span>
          </button>
        </div>
        {partnerResult && (
          <div className="mt-4 p-4 bg-[#111b21] border border-[#222d34] rounded-xl text-sm font-mono text-emerald-400 overflow-x-auto max-h-40 text-left w-full">
            <pre>{JSON.stringify(partnerResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
