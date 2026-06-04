import React, { useState } from 'react';
import CodeSnippet from '../components/CodeSnippet';
import { BookOpen } from 'lucide-react';

const ENDPOINTS = [
  {
    category: "Sessions",
    items: [
      {
        title: "Create Session",
        method: "POST",
        path: "/api/sessions",
        description: "Creates a new WhatsApp session and returns status or pairing code details.",
        payload: '{\n  "sessionId": "my-session",\n  "phoneNumber": "254XXXXXXXXX",\n  "pairingCode": "ABCDEFGH",\n  "webhook": "https://mywebhook.com/handler"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions", json={\n  "sessionId": "my-session",\n  "phoneNumber": "254XXXXXXXXX",\n  "webhook": "https://mywebhook.com/handler"\n})',
          javascript: 'fetch("https://wabot.gidraf.dev/api/sessions", {\n  method: "POST",\n  headers: {"Content-Type":"application/json"},\n  body: JSON.stringify({\n    sessionId: "my-session",\n    phoneNumber: "254XXXXXXXXX",\n    webhook: "https://mywebhook.com/handler"\n  })\n})',
          go: '// Go code\npayload := []byte(`{"sessionId":"my-session"}`)\nresp, _ := http.Post("https://wabot.gidraf.dev/api/sessions", "application/json", bytes.NewBuffer(payload))'
        }
      },
      {
        title: "Get Session Status",
        method: "GET",
        path: "/api/sessions/:sessionId",
        description: "Check if a session is connected, connecting, or disconnected.",
        snippets: {
          python: 'import requests\nprint(requests.get("https://wabot.gidraf.dev/api/sessions/my-session").json())',
          javascript: 'fetch("https://wabot.gidraf.dev/api/sessions/my-session").then(r=>r.json()).then(console.log)',
          go: 'resp, _ := http.Get("https://wabot.gidraf.dev/api/sessions/my-session")'
        }
      },
      {
        title: "Get QR Code",
        method: "GET",
        path: "/api/sessions/:sessionId/qr",
        description: "Returns the base64 PNG QR code or the active pairing code.",
        snippets: {
          python: 'import requests\nprint(requests.get("https://wabot.gidraf.dev/api/sessions/my-session/qr").json())',
          javascript: 'fetch("https://wabot.gidraf.dev/api/sessions/my-session/qr").then(r=>r.json()).then(console.log)',
          go: 'resp, _ := http.Get("https://wabot.gidraf.dev/api/sessions/my-session/qr")'
        }
      },
      {
        title: "Delete Session",
        method: "DELETE",
        path: "/api/sessions/:sessionId",
        description: "Logs out and permanently deletes session files.",
        snippets: {
          python: 'import requests\nrequests.delete("https://wabot.gidraf.dev/api/sessions/my-session")',
          javascript: 'fetch("https://wabot.gidraf.dev/api/sessions/my-session", { method: "DELETE" })',
          go: 'req, _ := http.NewRequest("DELETE", "https://wabot.gidraf.dev/api/sessions/my-session", nil)\nhttp.DefaultClient.Do(req)'
        }
      }
    ]
  },
  {
    category: "Messages (Basic)",
    items: [
      {
        title: "Send Text Message",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/text",
        description: "Send a plain text message with optional mentions.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "text": "Hello World",\n  "mentions": ["254YYYYYYYYY@s.whatsapp.net"]\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/text", json={\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "text": "Hello"\n})',
          javascript: 'fetch("https://wabot.gidraf.dev/api/sessions/my-session/messages/text", {\n  method: "POST",\n  headers: {"Content-Type":"application/json"},\n  body: JSON.stringify({ jid: "254XXXXXXXXX@s.whatsapp.net", text: "Hello" })\n})',
          go: '// Send message in Go'
        }
      },
      {
        title: "Send Image",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/image",
        description: "Send an image via URL or multipart file upload.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "url": "https://example.com/image.png",\n  "caption": "Check this out!"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/image", json={\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "url": "https://example.com/image.png",\n  "caption": "Caption"\n})'
        }
      },
      {
        title: "Send Reaction",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/reaction",
        description: "React to a message with an emoji.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "messageKey": {\n    "remoteJid": "254XXXXXXXXX@s.whatsapp.net",\n    "fromMe": false,\n    "id": "MSG_ID_123"\n  },\n  "emoji": "👍"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/reaction", json={\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "messageKey": {"id": "MSG_ID_123", "fromMe": False, "remoteJid": "254XXXXXXXXX@s.whatsapp.net"},\n  "emoji": "👍"\n})'
        }
      },
      {
        title: "Star Messages",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/star",
        description: "Star or unstar messages in a chat conversation.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "messageKeys": [\n    { "id": "MSG_ID_123", "fromMe": true }\n  ],\n  "star": true\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/star", json={\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "messageKeys": [{"id": "MSG_ID_123", "fromMe": True}],\n  "star": True\n})'
        }
      },
      {
        title: "Create Call Link",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/call-link",
        description: "Generate a custom voice or video call join link.",
        payload: '{\n  "type": "video"\n}',
        snippets: {
          python: 'import requests\nprint(requests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/call-link", json={"type": "video"}).json())'
        }
      }
    ]
  },
  {
    category: "Messages (Interactive & Rich)",
    items: [
      {
        title: "Interactive Messages (NativeFlow / Carousel)",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/interactive",
        description: "Send premium interactive flows, buttons, lists or carousel cards.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "text": "Select your plan",\n  "nativeFlow": {\n    "buttons": [\n      { "text": "Basic Plan", "id": "plan_basic" },\n      { "text": "Pro Plan", "id": "plan_pro" },\n      { "text": "Visit Website", "url": "https://ajiriwa.gidraf.dev" }\n    ]\n  }\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/interactive", json={\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "text": "Plan Selection",\n  "nativeFlow": { "buttons": [{ "text": "Plan A", "id": "a" }] }\n})'
        }
      },
      {
        title: "Send Sticker Pack",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/sticker-pack",
        description: "Sends a full pack of stickers with custom metadata.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "name": "My Pack Name",\n  "publisher": "Developer",\n  "description": "My WhatsApp Sticker Pack",\n  "cover": "https://example.com/cover.png",\n  "stickers": [\n    { "data": "https://example.com/sticker1.png", "emojis": ["🎉"] },\n    { "data": "https://example.com/sticker2.png", "emojis": ["✨"] }\n  ]\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/sticker-pack", json={\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "name": "Pack Name",\n  "publisher": "Creator",\n  "cover": "https://example.com/cover.png",\n  "stickers": [{"data": "https://example.com/sticker1.png"}]\n})'
        }
      },
      {
        title: "Send Album Message",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/album",
        description: "Send multiple image/video items grouped together as an album.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "album": {\n    "name": "Album Name",\n    "items": [\n      { "image": { "url": "https://example.com/img1.jpg" }, "caption": "Item 1" },\n      { "image": { "url": "https://example.com/img2.jpg" }, "caption": "Item 2" }\n    ]\n  }\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/album", json={\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "album": {"items": [{"image": {"url": "https://example.com/img.jpg"}}]}\n})'
        }
      },
      {
        title: "Send View-Once Media",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/view-once",
        description: "Send image, video, or audio as view-once media.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "type": "image",\n  "url": "https://example.com/image.jpg",\n  "viewOnceType": "viewOnceV2",\n  "caption": "Secret image"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/view-once", json={\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "type": "image",\n  "url": "https://example.com/image.jpg",\n  "viewOnceType": "viewOnceV2"\n})'
        }
      },
      {
        title: "Modify Message (Edit/Delete)",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/modify",
        description: "Edit or delete an already sent message.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "type": "edit",\n  "messageKey": {\n    "remoteJid": "254XXXXXXXXX@s.whatsapp.net",\n    "fromMe": true,\n    "id": "MSG_ID_123"\n  },\n  "text": "This is the updated message content"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/modify", json={\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "type": "edit",\n  "messageKey": {"id": "MSG_ID_123", "fromMe": True, "remoteJid": "254XXXXXXXXX@s.whatsapp.net"},\n  "text": "New Text"\n})'
        }
      }
    ]
  },
  {
    category: "Groups",
    items: [
      {
        title: "Create Group",
        method: "POST",
        path: "/api/sessions/:sessionId/groups",
        description: "Create a new group with participants.",
        payload: '{\n  "name": "My New Group",\n  "participants": ["254XXXXXXXXX@s.whatsapp.net"]\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/groups", json={\n  "name": "Group Name",\n  "participants": ["254XXXXXXXXX@s.whatsapp.net"]\n})'
        }
      },
      {
        title: "Manage Participants",
        method: "PATCH",
        path: "/api/sessions/:sessionId/groups/:jid/participants",
        description: "Add, remove, promote, or demote participants.",
        payload: '{\n  "participants": ["254XXXXXXXXX@s.whatsapp.net"],\n  "action": "add"\n}',
        snippets: {
          python: 'import requests\nrequests.patch("https://wabot.gidraf.dev/api/sessions/my-session/groups/1203632XXXX@g.us/participants", json={\n  "participants": ["254XXXXXXXXX@s.whatsapp.net"],\n  "action": "add"\n})'
        }
      }
    ]
  },
  {
    category: "Communities",
    items: [
      {
        title: "Create Community",
        method: "POST",
        path: "/api/sessions/:sessionId/community",
        description: "Create a community to group chats and send broadcasts.",
        payload: '{\n  "name": "My Business Community",\n  "description": "Welcome to our community!"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/community", json={\n  "name": "Community Name",\n  "description": "Desc"\n})'
        }
      },
      {
        title: "Link Group to Community",
        method: "POST",
        path: "/api/sessions/:sessionId/community/:jid/link-group",
        description: "Link a group to the community.",
        payload: '{\n  "groupJid": "120363XXXXXXXX@g.us"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/community/120363XXXXX@g.us/link-group", json={\n  "groupJid": "120363XXXXXXXX@g.us"\n})'
        }
      }
    ]
  },
  {
    category: "Newsletters (Channels)",
    items: [
      {
        title: "Create Newsletter",
        method: "POST",
        path: "/api/sessions/:sessionId/newsletter",
        description: "Creates a public WhatsApp channel/newsletter.",
        payload: '{\n  "name": "My Tech Channel",\n  "description": "Daily technology updates."\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/newsletter", json={\n  "name": "Tech Channel",\n  "description": "Desc"\n})'
        }
      },
      {
        title: "Follow Newsletter",
        method: "POST",
        path: "/api/sessions/:sessionId/newsletter/:jid/follow",
        description: "Follows a WhatsApp channel.",
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/newsletter/120363XXXX@newsletter/follow")'
        }
      }
    ]
  },
  {
    category: "Business & Privacy",
    items: [
      {
        title: "Update Business Profile",
        method: "PUT",
        path: "/api/sessions/:sessionId/business/profile",
        description: "Updates business profile details like address, email, hours, and description.",
        payload: '{\n  "description": "High quality products",\n  "address": "123 Main St",\n  "email": "contact@business.com",\n  "vertical": "Shopping & Retail"\n}',
        snippets: {
          python: 'import requests\nrequests.put("https://wabot.gidraf.dev/api/sessions/my-session/business/profile", json={\n  "description": "Store description"\n})'
        }
      },
      {
        title: "Check WhatsApp Registration",
        method: "POST",
        path: "/api/sessions/:sessionId/profile/on-whatsapp",
        description: "Check if multiple phone numbers are registered WhatsApp accounts.",
        payload: '{\n  "numbers": ["2547XXXXXXXX", "2547YYYYYYYY"]\n}',
        snippets: {
          python: 'import requests\nprint(requests.post("https://wabot.gidraf.dev/api/sessions/my-session/profile/on-whatsapp", json={\n  "numbers": ["2547XXXXXXXX"]\n}).json())'
        }
      },
      {
        title: "Get Privacy Settings",
        method: "GET",
        path: "/api/sessions/:sessionId/privacy",
        description: "Fetch all active account privacy settings.",
        snippets: {
          python: 'import requests\nprint(requests.get("https://wabot.gidraf.dev/api/sessions/my-session/privacy").json())'
        }
      },
      {
        title: "Update Privacy: Last Seen",
        method: "PATCH",
        path: "/api/sessions/:sessionId/privacy/last-seen",
        description: "Update last-seen visibility settings.",
        payload: '{\n  "value": "contacts"\n}',
        snippets: {
          python: 'import requests\nrequests.patch("https://wabot.gidraf.dev/api/sessions/my-session/privacy/last-seen", json={\n  "value": "contacts"\n})'
        }
      },
      {
        title: "Update Privacy: Read Receipts",
        method: "PATCH",
        path: "/api/sessions/:sessionId/privacy/read-receipts",
        description: "Toggle blue ticks / read receipts.",
        payload: '{\n  "value": "none"\n}',
        snippets: {
          python: 'import requests\nrequests.patch("https://wabot.gidraf.dev/api/sessions/my-session/privacy/read-receipts", json={\n  "value": "none"\n})'
        }
      }
    ]
  }
];

export default function Docs() {
  const [activeCategory, setActiveCategory] = useState(ENDPOINTS[0].category);

  return (
    <div className="flex flex-col md:flex-row gap-8 mt-6">
      
      {/* Sidebar Navigation */}
      <div className="md:w-64 shrink-0 border-r border-[#222d34] pr-4">
        <div className="flex items-center space-x-2 mb-6">
          <BookOpen className="w-6 h-6 text-[#25D366]" />
          <h2 className="text-xl font-bold text-white">Documentation</h2>
        </div>
        <div className="flex flex-col space-y-2">
          {ENDPOINTS.map((cat) => (
            <button
              key={cat.category}
              onClick={() => setActiveCategory(cat.category)}
              className={`text-left px-4 py-2 rounded-lg font-medium transition-colors ${activeCategory === cat.category ? 'bg-[#25D366]/10 text-[#25D366]' : 'text-gray-400 hover:text-white'}`}
            >
              {cat.category}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 space-y-12 pb-16">
        {ENDPOINTS.find(c => c.category === activeCategory)?.items.map((endpoint, idx) => (
          <div key={idx} className="bg-[#111b21] border border-[#222d34] rounded-2xl p-6 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-[#25D366]"></div>
            
            <div className="flex items-center space-x-4 mb-4">
              <span className={`px-3 py-1 rounded font-bold text-xs ${endpoint.method === 'GET' ? 'bg-blue-500/20 text-blue-400' : endpoint.method === 'POST' ? 'bg-green-500/20 text-green-400' : endpoint.method === 'PATCH' ? 'bg-purple-500/20 text-purple-400' : 'bg-red-500/20 text-red-400'}`}>
                {endpoint.method}
              </span>
              <code className="text-gray-300 font-mono text-sm">{endpoint.path}</code>
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">{endpoint.title}</h3>
            <p className="text-gray-400 mb-6">{endpoint.description}</p>

            {endpoint.payload && (
              <div className="mb-6">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-2 tracking-wider">JSON Payload</p>
                <pre className="bg-[#0b141a] border border-[#222d34] p-4 rounded-xl text-sm font-mono text-yellow-400 overflow-x-auto">
                  {endpoint.payload}
                </pre>
              </div>
            )}

            <CodeSnippet snippets={endpoint.snippets} />
          </div>
        ))}
      </div>

    </div>
  );
}
