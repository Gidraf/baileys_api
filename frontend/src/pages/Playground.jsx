import React, { useState, useEffect } from 'react';
import { Send, Terminal, Key, FileText, CheckCircle2, Clock, Calendar, ListTodo, Image as ImageIcon } from 'lucide-react';
import CodeSnippet from '../components/CodeSnippet';

export default function Playground() {
  const sessionId = localStorage.getItem('baileys_session') || '{SESSION_ID}';
  const [contacts, setContacts] = useState([]);
  const [recipient, setRecipient] = useState('');
  const [msgType, setMsgType] = useState('text');
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  
  // Poll
  const [pollName, setPollName] = useState('');
  const [pollOptions, setPollOptions] = useState(['Yes', 'No']);
  
  // Event
  const [eventName, setEventName] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDate, setEventDate] = useState('');

  // Scheduler
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduledTasks, setScheduledTasks] = useState([]);

  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState(null);

  useEffect(() => {
    if (sessionId && sessionId !== '{SESSION_ID}') {
      fetch(`/api/sessions/${sessionId}/profile/contacts`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
            if (Array.isArray(data)) setContacts(data.filter(c => c.id || c.jid));
            else if (data.data) setContacts(data.data);
            else setContacts(Object.values(data));
        }).catch(() => {});
    }
  }, [sessionId]);

  const targetJid = recipient ? (recipient.includes('@') ? recipient : \`\${recipient}@s.whatsapp.net\`) : "254XXXXXXXXX@s.whatsapp.net";

  const getPayload = () => {
    if (msgType === 'text') return { jid: targetJid, text: message || "Hello" };
    if (msgType === 'media') return { jid: targetJid, imageUrl: mediaUrl || "https://example.com/img.jpg", caption: message };
    if (msgType === 'poll') return { jid: targetJid, poll: { name: pollName || "My Poll", values: pollOptions.filter(Boolean), selectableCount: 1 } };
    if (msgType === 'event') {
        const start = eventDate ? Math.floor(new Date(eventDate).getTime()/1000) : Math.floor(Date.now()/1000) + 86400;
        return { jid: targetJid, event: { name: eventName || "New Event", description: eventDesc, startTime: start } };
    }
    return {};
  };

  const getEndpointUrl = () => {
    let path = 'text';
    if (msgType === 'media') path = 'image';
    if (msgType === 'poll') path = 'poll';
    if (msgType === 'event') path = 'event';
    return \`https://wabot.gidraf.dev/api/sessions/\${sessionId}/messages/\${path}\`;
  };

  const snippets = {
    python: \`import requests\\n\\nurl = "\${getEndpointUrl()}"\\npayload = \${JSON.stringify(getPayload(), null, 2)}\\n\\nresponse = requests.post(url, json=payload)\\nprint(response.json())\`,
    javascript: \`fetch("\${getEndpointUrl()}", {\\n  method: "POST",\\n  headers: { "Content-Type": "application/json" },\\n  body: JSON.stringify(\${JSON.stringify(getPayload(), null, 2).replace(/\\n/g, '\\n  ')})\\n})\\n.then(res => res.json())\\n.then(console.log);\`,
    go: \`// Execute HTTP POST to \${getEndpointUrl()}\\n// With payload: \${JSON.stringify(getPayload())}\`
  };

  const executeApi = async (payload) => {
    setSending(true);
    try {
      let path = 'text';
      if (payload.imageUrl) path = 'image';
      if (payload.poll) path = 'poll';
      if (payload.event) path = 'event';

      const res = await fetch(\`/api/sessions/\${sessionId}/messages/\${path}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setResponse({ error: err.message });
    }
    setSending(false);
  };

  const handleSendAction = () => {
    if (!sessionId || sessionId === '{SESSION_ID}' || !recipient) return;
    const payload = getPayload();

    if (scheduleTime) {
      const delayMs = new Date(scheduleTime).getTime() - Date.now();
      if (delayMs > 0) {
        const taskId = Math.random().toString(36).substring(7);
        const task = { id: taskId, type: msgType, time: scheduleTime, payload };
        setScheduledTasks(prev => [...prev, task]);
        
        setTimeout(() => {
          executeApi(task.payload);
          setScheduledTasks(prev => prev.filter(t => t.id !== taskId));
        }, delayMs);
        
        setResponse({ status: "Scheduled successfully", time: scheduleTime });
        return;
      }
    }
    
    executeApi(payload);
  };

  return (
    <div className="flex flex-col space-y-8 mt-6 max-w-7xl mx-auto w-full pb-16">
      <div className="flex items-center space-x-3 border-b border-[#222d34] pb-4">
        <Terminal className="w-8 h-8 text-[#25D366]" />
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">API Playground</h2>
          <p className="text-gray-400 mt-1">Test your endpoints, select contacts, and schedule messages entirely in the browser.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Side: Builder */}
        <div className="glass rounded-2xl p-6 shadow-xl flex flex-col space-y-6 border-t-4 border-t-[#25D366]">
          <h3 className="text-xl font-semibold flex items-center">
            <Send className="w-5 h-5 mr-2 text-[#25D366]" /> Message Builder
          </h3>
          
          <div className="space-y-5">
            {/* Session ID display */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Session ID</label>
              <div className="flex items-center bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-2 opacity-70">
                <Key className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-mono text-sm">{sessionId}</span>
              </div>
            </div>

            {/* Contact Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Recipient (Select or Type)</label>
              <div className="flex flex-col space-y-2">
                <select 
                  onChange={e => setRecipient(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#25D366]"
                >
                  <option value="">-- Choose from Contacts --</option>
                  {contacts.map((c, i) => (
                    <option key={i} value={c.id || c.jid}>{c.name || c.notify || c.id || c.jid}</option>
                  ))}
                </select>
                <input 
                  type="text" 
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  placeholder="Or type number manually (e.g. 2547XXXXXXXXX)"
                  className="w-full bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#25D366]"
                />
              </div>
            </div>

            {/* Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Message Type</label>
              <div className="flex space-x-2 bg-[#111b21] p-1 rounded-lg border border-[#222d34]">
                {[
                  { id: 'text', icon: FileText, label: 'Text' },
                  { id: 'media', icon: ImageIcon, label: 'Media' },
                  { id: 'poll', icon: ListTodo, label: 'Poll' },
                  { id: 'event', icon: Calendar, label: 'Event' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setMsgType(t.id)}
                    className={\`flex-1 py-2 flex justify-center items-center space-x-2 rounded-md text-sm font-medium transition-colors \${msgType === t.id ? 'bg-[#222d34] text-[#25D366]' : 'text-gray-400 hover:text-white'}\`}
                  >
                    <t.icon className="w-4 h-4" /> <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Inputs based on Type */}
            {msgType === 'text' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Message Text</label>
                <textarea 
                  value={message} onChange={e => setMessage(e.target.value)} rows={3}
                  className="w-full bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-3 text-white focus:border-[#25D366] resize-none"
                />
              </div>
            )}

            {msgType === 'media' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Media URL</label>
                  <input type="text" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://..." className="w-full bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-2 text-white focus:border-[#25D366]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Caption</label>
                  <input type="text" value={message} onChange={e => setMessage(e.target.value)} className="w-full bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-2 text-white focus:border-[#25D366]" />
                </div>
              </div>
            )}

            {msgType === 'poll' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Poll Question</label>
                  <input type="text" value={pollName} onChange={e => setPollName(e.target.value)} className="w-full bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-2 text-white focus:border-[#25D366]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Options</label>
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex space-x-2 mb-2">
                      <input type="text" value={opt} onChange={e => {
                        const newOpts = [...pollOptions]; newOpts[i] = e.target.value; setPollOptions(newOpts);
                      }} className="flex-1 bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-2 text-white focus:border-[#25D366]" />
                    </div>
                  ))}
                  <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-[#25D366] text-sm font-medium hover:underline">+ Add Option</button>
                </div>
              </div>
            )}

            {msgType === 'event' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Event Name</label>
                  <input type="text" value={eventName} onChange={e => setEventName(e.target.value)} className="w-full bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-2 text-white focus:border-[#25D366]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Date & Time</label>
                  <input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} className="w-full bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-2 text-white focus:border-[#25D366] color-scheme-dark" />
                </div>
              </div>
            )}

            {/* Scheduler UI */}
            <div className="bg-[#0b141a] p-4 rounded-xl border border-[#222d34]">
              <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                <Clock className="w-4 h-4 mr-2 text-blue-400" /> Schedule Message (Browser-based)
              </label>
              <input type="datetime-local" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-2 text-gray-400 focus:border-blue-500 color-scheme-dark" />
              <p className="text-xs text-gray-500 mt-2">Leave blank to send immediately. (Browser must remain open for scheduled tasks).</p>
            </div>

            <button 
              onClick={handleSendAction}
              disabled={sending || !recipient || sessionId === '{SESSION_ID}'}
              className={\`w-full text-white py-4 rounded-xl font-bold shadow-lg transition-colors flex items-center justify-center \${scheduleTime ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-[#25D366] hover:bg-[#128C7E] shadow-[#25D366]/20'}\`}
            >
              {sending ? 'Processing...' : (scheduleTime ? 'Schedule Message' : 'Execute Request')}
            </button>
          </div>

        </div>

        {/* Right Side: Code & Status */}
        <div className="flex flex-col space-y-6">
          <CodeSnippet snippets={snippets} />

          {/* Response Viewer */}
          {response && (
            <div className="glass rounded-xl p-4 border-l-4 border-l-[#25D366]">
              <p className="text-xs text-gray-500 font-semibold uppercase mb-2 tracking-wider">API Response</p>
              <pre className="text-sm font-mono overflow-x-auto text-emerald-400">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}

          {/* Scheduled Tasks List */}
          {scheduledTasks.length > 0 && (
            <div className="glass rounded-xl p-4 border-l-4 border-l-blue-500">
              <p className="text-xs text-gray-500 font-semibold uppercase mb-2 tracking-wider flex items-center">
                <Clock className="w-4 h-4 mr-2" /> Pending Scheduled Tasks ({scheduledTasks.length})
              </p>
              <div className="space-y-2 mt-3">
                {scheduledTasks.map(task => (
                  <div key={task.id} className="bg-[#111b21] p-3 rounded-lg border border-[#222d34] flex justify-between items-center text-sm">
                    <div>
                      <span className="font-bold text-blue-400 uppercase mr-2">{task.type}</span>
                      <span className="text-gray-400">To: {task.payload.jid.split('@')[0]}</span>
                    </div>
                    <span className="font-mono text-gray-500 text-xs">{new Date(task.time).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
