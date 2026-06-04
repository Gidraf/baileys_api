import React, { useState, useEffect } from 'react';
import { Send, Terminal, Key, FileText, CheckCircle2, Clock, Calendar, ListTodo, Image as ImageIcon, Code } from 'lucide-react';
import CodeSnippet from '../components/CodeSnippet';

const PLAYGROUND_ENDPOINTS = [
  {
    id: 'text',
    label: 'Send Text Message',
    path: 'text',
    defaultPayload: {
      text: "Hello from the API playground!"
    }
  },
  {
    id: 'image',
    label: 'Send Image',
    path: 'image',
    defaultPayload: {
      url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
      caption: "Beautiful digital art"
    }
  },
  {
    id: 'video',
    label: 'Send Video',
    path: 'video',
    defaultPayload: {
      url: "https://www.w3schools.com/html/mov_bbb.mp4",
      caption: "Big Buck Bunny movie trailer"
    }
  },
  {
    id: 'audio',
    label: 'Send Audio / Voice',
    path: 'audio',
    defaultPayload: {
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      ptt: false
    }
  },
  {
    id: 'sticker',
    label: 'Send Sticker',
    path: 'sticker',
    defaultPayload: {
      url: "https://wabot.gidraf.dev/assets/logo.png"
    }
  },
  {
    id: 'document',
    label: 'Send Document',
    path: 'document',
    defaultPayload: {
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      mimetype: "application/pdf",
      fileName: "test_document.pdf",
      caption: "Important documentation"
    }
  },
  {
    id: 'poll',
    label: 'Send Poll',
    path: 'poll',
    defaultPayload: {
      poll: {
        name: "What is your preferred development stack?",
        values: ["Vite + React", "Next.js", "Nuxt + Vue"],
        selectableCount: 1
      }
    }
  },
  {
    id: 'event',
    label: 'Send Event',
    path: 'event',
    defaultPayload: {
      event: {
        name: "Weekly Technical Sync",
        description: "Developer team align and status report",
        startTime: new Date(Date.now() + 86400000).toISOString()
      }
    }
  },
  {
    id: 'newsletter-post',
    label: 'Post to Newsletter / Channel',
    path: 'newsletter/post',
    defaultPayload: {
      type: "text",
      text: "Hello everyone, this is an update on our new features!",
      caption: "Optional media caption",
      url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"
    }
  },
  {
    id: 'status-text',
    label: 'Post Text Status (Story)',
    path: 'status/text',
    defaultPayload: {
      text: "Hello, this is my text status on WhatsApp!",
      backgroundColor: "#00a884",
      font: 1
    }
  },
  {
    id: 'status-media',
    label: 'Post Media Status (Story)',
    path: 'status/media',
    defaultPayload: {
      type: "image",
      url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
      caption: "Stunning status background!"
    }
  },
  {
    id: 'interactive',
    label: 'Interactive Messages (Native Flow/Buttons/Carousel)',
    path: 'interactive',
    defaultPayload: {
      text: "Select a package that works for you",
      nativeFlow: {
        buttons: [
          { "text": "Ajiriwa ERP", "id": "ajiriwa_erp" },
          { "text": "Ajiriwa CRM", "id": "ajiriwa_crm" },
          { "text": "Sign Up Free", "url": "https://ajiriwa.gidraf.dev" }
        ]
      }
    }
  },
  {
    id: 'template',
    label: 'Template Buttons',
    path: 'template',
    defaultPayload: {
      text: "Click one of the call-to-actions below:",
      templateButtons: [
        { "index": 1, "urlButton": { "displayText": "View ajiriwa.gidraf.dev", "url": "https://ajiriwa.gidraf.dev" } },
        { "index": 2, "callButton": { "displayText": "Contact Sales", "phoneNumber": "254700000000" } }
      ]
    }
  },
  {
    id: 'list',
    label: 'List Menu',
    path: 'list',
    defaultPayload: {
      text: "Select from the list below",
      buttonText: "Browse Menu",
      title: "Services Catalog",
      sections: [
        {
          title: "Recruitment Tools",
          rows: [
            { "title": "CV Auto-Review", "rowId": "cv_review", "description": "Review and reply automatically via WhatsApp" }
          ]
        },
        {
          title: "E-Commerce",
          rows: [
            { "title": "Logistics Bot", "rowId": "logistics", "description": "Handle customer delivery status" }
          ]
        }
      ]
    }
  },
  {
    id: 'album',
    label: 'Send Album',
    path: 'album',
    defaultPayload: {
      album: {
        name: "Product Highlights",
        items: [
          { "image": { "url": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe" }, "caption": "Art 1" },
          { "image": { "url": "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119" }, "caption": "Art 2" }
        ]
      }
    }
  },
  {
    id: 'sticker-pack',
    label: 'Send Sticker Pack',
    path: 'sticker-pack',
    defaultPayload: {
      name: "Ajiriwa Pack",
      publisher: "Baileys API",
      description: "Custom WhatsApp stickers",
      cover: "https://wabot.gidraf.dev/assets/logo.png",
      stickers: [
        { "data": "https://wabot.gidraf.dev/assets/logo.png", "emojis": ["🎉"] }
      ]
    }
  },
  {
    id: 'product',
    label: 'Send Catalog Product',
    path: 'product',
    defaultPayload: {
      businessOwnerJid: "2547XXXXXXXX@s.whatsapp.net",
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
      product: {
        title: "Vite + React Integration Service",
        description: "Full setup of custom backend & frontend components",
        currencyCode: "KES",
        priceAmount1000: 50000000
      }
    }
  },
  {
    id: 'view-once',
    label: 'Send View Once Media',
    path: 'view-once',
    defaultPayload: {
      type: "image",
      url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
      viewOnceType: "viewOnceV2",
      caption: "This image will disappear after opening"
    }
  },
  {
    id: 'modify',
    label: 'Modify Message (Edit/Delete)',
    path: 'modify',
    defaultPayload: {
      type: "edit",
      messageKey: {
        remoteJid: "2547XXXXXXXX@s.whatsapp.net",
        fromMe: true,
        id: "MSG_ID_ABC"
      },
      text: "This is the updated message content!"
    }
  },
  {
    id: 'reaction',
    label: 'Send Reaction',
    path: 'reaction',
    defaultPayload: {
      messageKey: {
        remoteJid: "2547XXXXXXXX@s.whatsapp.net",
        fromMe: false,
        id: "MSG_ID_ABC"
      },
      emoji: "❤️"
    }
  },
  {
    id: 'pin',
    label: 'Pin Message',
    path: 'pin',
    defaultPayload: {
      messageKey: {
        remoteJid: "2547XXXXXXXX@s.whatsapp.net",
        fromMe: false,
        id: "MSG_ID_ABC"
      },
      time: 86400,
      type: 1
    }
  },
  {
    id: 'keep',
    label: 'Keep Message',
    path: 'keep',
    defaultPayload: {
      messageKey: {
        remoteJid: "2547XXXXXXXX@s.whatsapp.net",
        fromMe: false,
        id: "MSG_ID_ABC"
      },
      type: 1
    }
  },
  {
    id: 'star',
    label: 'Star Message',
    path: 'star',
    defaultPayload: {
      messageKeys: [
        { "id": "MSG_ID_ABC", "fromMe": true }
      ],
      star: true
    }
  },
  {
    id: 'call-link',
    label: 'Create Call Link',
    path: 'call-link',
    defaultPayload: {
      type: "video"
    }
  },
  {
    id: 'presence',
    label: 'Send Presence Update',
    path: 'presence',
    defaultPayload: {
      type: "composing"
    }
  },
  {
    id: 'presence-subscribe',
    label: 'Presence Subscribe',
    path: 'presence/subscribe',
    defaultPayload: {
      jid: "2547XXXXXXXX@s.whatsapp.net"
    }
  },
  {
    id: 'receipt',
    label: 'Send Message Receipt',
    path: 'receipt',
    defaultPayload: {
      jid: "2547XXXXXXXX@s.whatsapp.net",
      participant: "2547XXXXXXXX@s.whatsapp.net",
      messageIds: ["MSG_ID_ABC"],
      type: "read"
    }
  },
  {
    id: 'resync-app-state',
    label: 'Resync App State',
    path: 'profile/resync-app-state',
    defaultPayload: {
      collections: ["regular", "critical_block"],
      isInitialSync: true
    }
  },
  {
    id: 'profile-picture-get',
    label: 'Get Profile Picture URL',
    path: 'profile/picture',
    method: 'GET',
    defaultPayload: {
      jid: "2547XXXXXXXX@s.whatsapp.net",
      type: "image"
    }
  },
  {
    id: 'profile-picture-update',
    label: 'Update Profile Picture',
    path: 'profile/picture',
    method: 'PUT',
    defaultPayload: {
      jid: "2547XXXXXXXX@s.whatsapp.net",
      url: "https://wabot.gidraf.dev/assets/logo.png"
    }
  },
  {
    id: 'profile-picture-remove',
    label: 'Remove Profile Picture',
    path: 'profile/picture',
    method: 'DELETE',
    defaultPayload: {
      jid: "2547XXXXXXXX@s.whatsapp.net"
    }
  },
  {
    id: 'profile-name-update',
    label: 'Update Profile Name',
    path: 'profile/name',
    method: 'PATCH',
    defaultPayload: {
      name: "My New Name"
    }
  },
  {
    id: 'profile-status-update',
    label: 'Update Profile Status',
    path: 'profile/status',
    method: 'PATCH',
    defaultPayload: {
      status: "Available"
    }
  },
  {
    id: 'profile-block-status',
    label: 'Update Block Status',
    path: 'profile/block',
    method: 'PATCH',
    defaultPayload: {
      jid: "2547XXXXXXXX@s.whatsapp.net",
      action: "block"
    }
  },
  {
    id: 'profile-blocklist-get',
    label: 'Fetch Blocklist',
    path: 'profile/blocklist',
    method: 'GET',
    defaultPayload: {}
  },
  {
    id: 'profile-chat-modify',
    label: 'Modify Chat',
    path: 'profile/chat',
    method: 'PATCH',
    defaultPayload: {
      jid: "2547XXXXXXXX@s.whatsapp.net",
      modifications: {
        archive: true
      }
    }
  },
  {
    id: 'profile-contact-add',
    label: 'Add/Edit Contact',
    path: 'profile/contact',
    defaultPayload: {
      jid: "2547XXXXXXXX@s.whatsapp.net",
      displayName: "Starseed"
    }
  },
  {
    id: 'profile-contact-remove',
    label: 'Remove Contact',
    path: 'profile/contact',
    method: 'DELETE',
    defaultPayload: {
      jid: "2547XXXXXXXX@s.whatsapp.net"
    }
  },
  {
    id: 'profile-label-chat-add',
    label: 'Add Chat Label',
    path: 'profile/label/chat',
    defaultPayload: {
      jid: "2547XXXXXXXX@s.whatsapp.net",
      labelId: "1"
    }
  },
  {
    id: 'profile-label-chat-remove',
    label: 'Remove Chat Label',
    path: 'profile/label/chat',
    method: 'DELETE',
    defaultPayload: {
      jid: "2547XXXXXXXX@s.whatsapp.net",
      labelId: "1"
    }
  },
  {
    id: 'profile-label-message-add',
    label: 'Add Message Label',
    path: 'profile/label/message',
    defaultPayload: {
      jid: "2547XXXXXXXX@s.whatsapp.net",
      messageId: "MSG_ID_ABC",
      labelId: "1"
    }
  },
  {
    id: 'profile-label-message-remove',
    label: 'Remove Message Label',
    path: 'profile/label/message',
    method: 'DELETE',
    defaultPayload: {
      jid: "2547XXXXXXXX@s.whatsapp.net",
      messageId: "MSG_ID_ABC",
      labelId: "1"
    }
  },
  {
    id: 'profile-business-get',
    label: 'Get Business Profile',
    path: 'profile/business',
    method: 'GET',
    defaultPayload: {
      jid: "2547XXXXXXXX@s.whatsapp.net"
    }
  }
];

export default function Playground() {
  const sessionId = localStorage.getItem('baileys_session') || '{SESSION_ID}';
  const [contacts, setContacts] = useState([]);
  const [newsletters, setNewsletters] = useState([]);
  const [recipient, setRecipient] = useState('');
  
  const [activeEndpointId, setActiveEndpointId] = useState(PLAYGROUND_ENDPOINTS[0].id);
  const [jsonPayloadString, setJsonPayloadString] = useState(
    JSON.stringify(PLAYGROUND_ENDPOINTS[0].defaultPayload, null, 2)
  );

  // Scheduler
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduledTasks, setScheduledTasks] = useState([]);

  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState(null);
  const [jsonError, setJsonError] = useState(null);

  useEffect(() => {
    if (sessionId && sessionId !== '{SESSION_ID}') {
      // Fetch contacts
      fetch(`/api/sessions/${sessionId}/profile/contacts`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
            if (Array.isArray(data)) setContacts(data.filter(c => c.id || c.jid));
            else if (data.data) setContacts(data.data);
            else setContacts(Object.values(data));
        }).catch(() => {});

      // Fetch followed newsletters
      fetch(`/api/sessions/${sessionId}/newsletter/subscribed`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
            if (Array.isArray(data)) setNewsletters(data);
            else if (data.data) setNewsletters(data.data);
            else setNewsletters(Object.values(data));
        }).catch(() => {});
    }
  }, [sessionId]);

  const activeEndpoint = PLAYGROUND_ENDPOINTS.find(e => e.id === activeEndpointId) || PLAYGROUND_ENDPOINTS[0];
  
  const isNewsletterTarget = recipient?.endsWith('@newsletter') || activeEndpointId === 'newsletter-post';
  
  let defaultJid = "254XXXXXXXXX@s.whatsapp.net";
  if (activeEndpointId === 'newsletter-post') {
    defaultJid = (newsletters[0]?.id || newsletters[0]?.jid) || "120363XXXXXXXXXXXX@newsletter";
  } else if (contacts.length > 0) {
    defaultJid = contacts[0]?.id || contacts[0]?.jid || defaultJid;
  }

  const targetJid = recipient 
    ? (recipient.includes('@') ? recipient : `${recipient}${isNewsletterTarget ? '@newsletter' : '@s.whatsapp.net'}`) 
    : defaultJid;

  // When endpoint selection changes, populate default JSON payload
  const handleEndpointChange = (id) => {
    setActiveEndpointId(id);
    const endpoint = PLAYGROUND_ENDPOINTS.find(e => e.id === id);
    if (endpoint) {
      setJsonPayloadString(JSON.stringify(endpoint.defaultPayload, null, 2));
      setJsonError(null);
    }
  };

  const handleJsonChange = (val) => {
    setJsonPayloadString(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (e) {
      setJsonError(e.message);
    }
  };

  const isJidRequired = ![
    'call-link',
    'presence',
    'status-text',
    'status-media',
    'profile-blocklist-get',
    'profile-name-update',
    'profile-status-update',
    'resync-app-state'
  ].includes(activeEndpoint.id);

  const getCombinedPayload = () => {
    try {
      const parsed = JSON.parse(jsonPayloadString);
      // Automatically merge JID if applicable
      if (isJidRequired && !parsed.jid) {
        parsed.jid = targetJid;
      }
      return parsed;
    } catch (e) {
      return {};
    }
  };

  const resolveEndpointPath = (path) => {
    return path.includes('/') ? path : `messages/${path}`;
  };

  const getEndpointUrl = () => {
    const relativePath = resolveEndpointPath(activeEndpoint.path);
    let url = `${window.location.origin}/api/sessions/${sessionId}/${relativePath}`;
    if (activeEndpoint.method === 'GET') {
      const payload = getCombinedPayload();
      const params = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null && k !== 'jid') params.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
      });
      if (payload.jid) params.append('jid', payload.jid);
      const q = params.toString();
      if (q) url += `?${q}`;
    }
    return url;
  };

  const snippets = {
    curl: activeEndpoint.method === 'GET'
      ? `curl '${getEndpointUrl()}'`
      : `curl -X ${activeEndpoint.method || 'POST'} '${getEndpointUrl()}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(getCombinedPayload())}'`,
    python: activeEndpoint.method === 'GET'
      ? `import requests\n\nurl = "${getEndpointUrl()}"\n\nresponse = requests.get(url)\nprint(response.json())`
      : `import requests\n\nurl = "${getEndpointUrl()}"\npayload = ${JSON.stringify(getCombinedPayload(), null, 2)}\n\nresponse = requests.${(activeEndpoint.method || 'post').toLowerCase()}(url, json=payload)\nprint(response.json())`,
    javascript: activeEndpoint.method === 'GET'
      ? `fetch("${getEndpointUrl()}")\n.then(res => res.json())\n.then(console.log);`
      : `fetch("${getEndpointUrl()}", {\n  method: "${activeEndpoint.method || 'POST'}",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify(${JSON.stringify(getCombinedPayload(), null, 2).replace(/\n/g, '\n  ')})\n})\n.then(res => res.json())\n.then(console.log);`,
    go: `// Execute HTTP ${activeEndpoint.method || 'POST'} to ${getEndpointUrl()}\n// With payload: ${JSON.stringify(getCombinedPayload())}`
  };

  const executeApi = async (payload) => {
    setSending(true);
    try {
      const method = activeEndpoint.method || 'POST';
      const relativePath = resolveEndpointPath(activeEndpoint.path);
      let url = `/api/sessions/${sessionId}/${relativePath}`;
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };

      if (method === 'GET') {
        const params = new URLSearchParams();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null) params.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
        });
        const q = params.toString();
        if (q) url += `?${q}`;
      } else {
        options.body = JSON.stringify(payload);
      }

      const res = await fetch(url, options);
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setResponse({ error: err.message });
    }
    setSending(false);
  };

  const handleSendAction = () => {
    if (!sessionId || sessionId === '{SESSION_ID}') return;
    if (jsonError) return;

    const payload = getCombinedPayload();

    if (scheduleTime) {
      const delayMs = new Date(scheduleTime).getTime() - Date.now();
      if (delayMs > 0) {
        const taskId = Math.random().toString(36).substring(7);
        const task = { id: taskId, type: activeEndpoint.label, time: scheduleTime, payload };
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
          <p className="text-gray-400 mt-1">Select any exposed endpoint, build custom JSON structures, and schedule actions instantly.</p>
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

            {/* Endpoint Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Select Endpoint / Feature</label>
              <select 
                value={activeEndpointId}
                onChange={e => handleEndpointChange(e.target.value)}
                className="w-full bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-3 text-white font-medium focus:outline-none focus:border-[#25D366]"
              >
                {PLAYGROUND_ENDPOINTS.map(ep => (
                  <option key={ep.id} value={ep.id}>{ep.label} ({`/messages/${ep.path}`})</option>
                ))}
              </select>
            </div>

            {/* Contact Selector */}
            {isJidRequired && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Recipient (Select or Type)</label>
                <div className="flex flex-col space-y-2">
                  <select 
                    onChange={e => setRecipient(e.target.value)}
                    className="w-full bg-[#111b21] border border-[#222d34] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#25D366]"
                  >
                    <option value="">-- Choose from Contacts / Channels --</option>
                    <optgroup label="Contacts">
                      {contacts.map((c, i) => (
                        <option key={i} value={c.id || c.jid}>{c.name || c.notify || c.id || c.jid}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Newsletters (Channels)">
                      {newsletters.map((nl, i) => (
                        <option key={i} value={nl.id || nl.jid}>{nl.name || nl.subject || nl.id || nl.jid}</option>
                      ))}
                    </optgroup>
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
            )}

            {/* JSON Payload Editor */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-gray-400">JSON Payload</label>
                {jsonError ? (
                  <span className="text-xs font-semibold text-red-500">Invalid JSON: {jsonError}</span>
                ) : (
                  <span className="text-xs font-semibold text-emerald-500">Valid JSON Structure</span>
                )}
              </div>
              <textarea 
                value={jsonPayloadString} 
                onChange={e => handleJsonChange(e.target.value)} 
                rows={10}
                className="w-full bg-[#0b141a] border border-[#222d34] p-4 rounded-xl text-sm font-mono text-yellow-400 focus:outline-none focus:border-[#25D366] resize-none"
              />
            </div>

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
              disabled={sending || (isJidRequired && !recipient) || sessionId === '{SESSION_ID}' || !!jsonError}
              className={`w-full text-white py-4 rounded-xl font-bold shadow-lg transition-colors flex items-center justify-center ${scheduleTime ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-[#25D366] hover:bg-[#128C7E] shadow-[#25D366]/20'} disabled:opacity-50 disabled:cursor-not-allowed`}
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
                      <span className="text-gray-400">To: {task.payload.jid ? task.payload.jid.split('@')[0] : 'N/A'}</span>
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
