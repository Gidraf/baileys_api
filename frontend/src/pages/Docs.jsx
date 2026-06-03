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
        description: "Creates a new WhatsApp session and returns a QR code or pairing code.",
        payload: '{\n  "sessionId": "my-session"\n}',
        snippets: {
          python: `import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions", json={"sessionId": "my-session"})`,
          javascript: `fetch("https://wabot.gidraf.dev/api/sessions", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({sessionId: "my-session"}) })`,
          go: `// Implement HTTP POST to /api/sessions with JSON {"sessionId": "my-session"}`,
          cpp: `// Implement CPR POST to /api/sessions with JSON {"sessionId": "my-session"}`
        }
      },
      {
        title: "Get Session Status",
        method: "GET",
        path: "/api/sessions/:sessionId",
        description: "Check if a session is connected or requires QR scanning.",
        snippets: {
          python: `import requests\nprint(requests.get("https://wabot.gidraf.dev/api/sessions/my-session").json())`,
          javascript: `fetch("https://wabot.gidraf.dev/api/sessions/my-session").then(r=>r.json()).then(console.log)`,
          go: `// Implement HTTP GET to /api/sessions/my-session`,
          cpp: `// Implement CPR GET to /api/sessions/my-session`
        }
      }
    ]
  },
  {
    category: "Messages",
    items: [
      {
        title: "Send Text Message",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/text",
        description: "Send a plain text message.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "text": "Hello World"\n}',
        snippets: {
          python: `import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/text", json={"jid": "254XXXXXXXXX@s.whatsapp.net", "text": "Hello"})`,
          javascript: `fetch("https://wabot.gidraf.dev/api/sessions/my-session/messages/text", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({jid: "254XXXXXXXXX@s.whatsapp.net", text: "Hello"}) })`,
          go: `// HTTP POST to /api/sessions/my-session/messages/text`,
          cpp: `// CPR POST to /api/sessions/my-session/messages/text`
        }
      },
      {
        title: "Send Image/Video",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/image",
        description: "Send media either by URL or Base64.",
        payload: '{\n  "jid": "...",\n  "imageUrl": "https://example.com/img.jpg",\n  "caption": "Look at this!"\n}',
        snippets: {
          python: `import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/image", json={"jid": "...", "imageUrl": "..."})`,
          javascript: `// fetch POST JSON with imageUrl`,
          go: `// HTTP POST JSON with imageUrl`,
          cpp: `// CPR POST JSON with imageUrl`
        }
      },
      {
        title: "Send Poll",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/poll",
        description: "Send a poll with multiple options.",
        payload: '{\n  "jid": "...",\n  "poll": {\n    "name": "Which color?",\n    "values": ["Red", "Blue", "Green"],\n    "selectableCount": 1\n  }\n}',
        snippets: {
          python: `import requests\npayload = {"jid": "...", "poll": {"name": "Color?", "values": ["Red", "Blue"], "selectableCount": 1}}\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/poll", json=payload)`,
          javascript: `// fetch POST JSON with poll object`,
          go: `// HTTP POST JSON with poll object`,
          cpp: `// CPR POST JSON with poll object`
        }
      },
      {
        title: "Send Event",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/event",
        description: "Create an event in a group.",
        payload: '{\n  "jid": "...",\n  "event": {\n    "name": "Team Meeting",\n    "description": "Weekly Sync",\n    "startTime": 1735689600\n  }\n}',
        snippets: {
          python: `import requests\n# startTime is a unix timestamp in seconds\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/event", json={"jid":"...", "event":{"name":"Meeting", "startTime":1735689600}})`,
          javascript: `// fetch POST JSON with event object`,
          go: `// HTTP POST JSON with event object`,
          cpp: `// CPR POST JSON with event object`
        }
      }
    ]
  },
  {
    category: "Groups & Channels",
    items: [
      {
        title: "List Groups",
        method: "GET",
        path: "/api/sessions/:sessionId/groups",
        description: "Fetch all groups the session is part of.",
        snippets: {
          python: `import requests\nprint(requests.get("https://wabot.gidraf.dev/api/sessions/my-session/groups").json())`,
          javascript: `// fetch GET`,
          go: `// HTTP GET`,
          cpp: `// CPR GET`
        }
      },
      {
        title: "List Subscribed Channels",
        method: "GET",
        path: "/api/sessions/:sessionId/newsletter/subscribed",
        description: "Fetch all followed Newsletters (Channels).",
        snippets: {
          python: `import requests\nprint(requests.get("https://wabot.gidraf.dev/api/sessions/my-session/newsletter/subscribed").json())`,
          javascript: `// fetch GET`,
          go: `// HTTP GET`,
          cpp: `// CPR GET`
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
              className={\`text-left px-4 py-2 rounded-lg font-medium transition-colors \${activeCategory === cat.category ? 'bg-[#25D366]/10 text-[#25D366]' : 'text-gray-400 hover:text-white'}\`}
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
              <span className={\`px-3 py-1 rounded font-bold text-xs \${endpoint.method === 'GET' ? 'bg-blue-500/20 text-blue-400' : endpoint.method === 'POST' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}\`}>
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
