import React, { useState } from 'react';
import { Send, Terminal, Key, FileText, Code2, Copy, CheckCircle2 } from 'lucide-react';

export default function Playground() {
  const sessionId = localStorage.getItem('baileys_session') || '{SESSION_ID}';
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('python');

  const handleSend = async () => {
    if (!sessionId || sessionId === '{SESSION_ID}' || !recipient || !message) return;
    setSending(true);
    try {
      const formatJid = recipient.includes('@') ? recipient : `${recipient}@s.whatsapp.net`;
      const res = await fetch(`/api/sessions/${sessionId}/messages/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid: formatJid, text: message })
      });
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setResponse({ error: err.message });
    }
    setSending(false);
  };

  const getCodeSnippet = (lang) => {
    const targetJid = recipient ? (recipient.includes('@') ? recipient : `${recipient}@s.whatsapp.net`) : "254XXXXXXXXX@s.whatsapp.net";
    const targetMsg = message || "Hello from Baileys API!";
    const endpoint = `http://localhost:21465/api/sessions/${sessionId}/messages/text`;

    switch (lang) {
      case 'python':
        return `import requests\n\nurl = "${endpoint}"\npayload = {\n    "jid": "${targetJid}",\n    "text": "${targetMsg}"\n}\n\nresponse = requests.post(url, json=payload)\nprint(response.json())`;
      case 'javascript':
        return `fetch("${endpoint}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    jid: "${targetJid}",\n    text: "${targetMsg}"\n  })\n})\n.then(res => res.json())\n.then(console.log);`;
      case 'go':
        return `package main\nimport (\n\t"bytes"\n\t"encoding/json"\n\t"net/http"\n)\n\nfunc main() {\n\tbody, _ := json.Marshal(map[string]string{\n\t\t"jid": "${targetJid}",\n\t\t"text": "${targetMsg}",\n\t})\n\thttp.Post("${endpoint}", "application/json", bytes.NewBuffer(body))\n}`;
      case 'cpp':
        return `#include <iostream>\n#include <cpr/cpr.h>\n\nint main() {\n    cpr::Response r = cpr::Post(cpr::Url{"${endpoint}"},\n                      cpr::Body{"{\\"jid\\":\\"${targetJid}\\",\\"text\\":\\"${targetMsg}\\"}"},\n                      cpr::Header{{"Content-Type", "application/json"}});\n    std::cout << r.text << std::endl;\n    return 0;\n}`;
      default: return "";
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(getCodeSnippet(activeTab));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col space-y-8 mt-6 max-w-6xl mx-auto w-full pb-16">
      <div className="flex items-center space-x-3 border-b border-[#222d34] pb-4">
        <Terminal className="w-8 h-8 text-[#25D366]" />
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">API Playground</h2>
          <p className="text-gray-400 mt-1">Test your endpoints directly from the browser.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Side: GUI Tester */}
        <div className="glass rounded-2xl p-6 shadow-xl flex flex-col space-y-6 border-t-4 border-t-[#25D366]">
          <h3 className="text-xl font-semibold flex items-center">
            <Send className="w-5 h-5 mr-2 text-[#25D366]" /> Send a Message
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Session ID (Auto-filled)</label>
              <div className="flex items-center bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-2 opacity-70">
                <Key className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-mono text-sm">{sessionId}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Recipient Number / JID</label>
              <input 
                type="text" 
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                placeholder="2547XXXXXXXXX or ...@s.whatsapp.net"
                className="w-full bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#25D366] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Message Text</label>
              <textarea 
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Hello there!"
                rows={4}
                className="w-full bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#25D366] transition-colors resize-none"
              />
            </div>

            <button 
              onClick={handleSend}
              disabled={sending || !recipient || !message || sessionId === '{SESSION_ID}'}
              className="w-full bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-50 text-white py-3 rounded-lg font-bold shadow-lg transition-colors flex items-center justify-center"
            >
              {sending ? 'Sending...' : 'Execute Request'}
            </button>
          </div>

          {response && (
             <div className="mt-4 bg-[#0b141a] border border-[#222d34] rounded-lg p-4">
               <p className="text-xs text-gray-500 font-semibold uppercase mb-2 tracking-wider">Response</p>
               <pre className="text-sm font-mono overflow-x-auto text-emerald-400">
                 {JSON.stringify(response, null, 2)}
               </pre>
             </div>
          )}
        </div>

        {/* Right Side: Code Snippets */}
        <div className="glass rounded-2xl overflow-hidden shadow-xl flex flex-col border border-[#222d34]">
          <div className="bg-[#111b21] border-b border-[#222d34] p-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center">
              <Code2 className="w-5 h-5 mr-2 text-gray-400" /> Integration Code
            </h3>
            <button onClick={copyCode} className="text-gray-400 hover:text-white transition-colors">
              {copied ? <CheckCircle2 className="w-5 h-5 text-[#25D366]" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          
          <div className="flex border-b border-[#222d34] bg-[#0b141a]">
            {['python', 'javascript', 'go', 'cpp'].map(lang => (
              <button
                key={lang}
                onClick={() => setActiveTab(lang)}
                className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                  activeTab === lang 
                    ? 'text-[#25D366] border-b-2 border-[#25D366] bg-[#111b21]' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          <div className="p-6 bg-[#0b141a] flex-1 overflow-x-auto relative">
             <pre className="text-sm font-mono text-gray-300">
               {getCodeSnippet(activeTab)}
             </pre>
          </div>
        </div>

      </div>
    </div>
  );
}
