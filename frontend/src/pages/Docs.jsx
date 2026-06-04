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
        description: "Creates a new WhatsApp session and returns connection or pairing details.",
        payload: '{\n  "sessionId": "my-session",\n  "phoneNumber": "254XXXXXXXXX",\n  "pairingCode": "ABCDEFGH",\n  "webhook": "https://mywebhook.com/handler"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions", json={\n  "sessionId": "my-session",\n  "phoneNumber": "254XXXXXXXXX"\n})',
          javascript: 'fetch("https://wabot.gidraf.dev/api/sessions", { method: "POST", body: JSON.stringify({ sessionId: "my-session" }) })'
        }
      },
      {
        title: "List Sessions",
        method: "GET",
        path: "/api/sessions",
        description: "Get all active sessions managed by this API server instance.",
        snippets: {
          python: 'import requests\nprint(requests.get("https://wabot.gidraf.dev/api/sessions").json())'
        }
      },
      {
        title: "Get Session Status",
        method: "GET",
        path: "/api/sessions/:sessionId",
        description: "Returns connection status (connecting, open, closed) and registered metadata.",
        snippets: {
          javascript: 'fetch("https://wabot.gidraf.dev/api/sessions/my-session").then(r => r.json()).then(console.log)'
        }
      },
      {
        title: "Get QR Code",
        method: "GET",
        path: "/api/sessions/:sessionId/qr",
        description: "Returns base64 encoded QR code PNG data or active pairing code.",
        snippets: {
          python: 'import requests\nprint(requests.get("https://wabot.gidraf.dev/api/sessions/my-session/qr").json())'
        }
      },
      {
        title: "Delete Session",
        method: "DELETE",
        path: "/api/sessions/:sessionId",
        description: "Logs out WhatsApp client, releases locks, and cleans up auth files.",
        snippets: {
          python: 'import requests\nrequests.delete("https://wabot.gidraf.dev/api/sessions/my-session")'
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
        description: "Sends a plain text message with optional mentions.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "text": "Hello World",\n  "mentions": ["254YYYYYYYYY@s.whatsapp.net"]\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/text", json={"jid": "...", "text": "Hello"})'
        }
      },
      {
        title: "Send Image",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/image",
        description: "Send image media via URL, base64, or multipart file upload.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "url": "https://example.com/image.png",\n  "caption": "Beautiful view",\n  "viewOnce": false\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/image", json={"jid": "...", "url": "https://..."})'
        }
      },
      {
        title: "Send Video",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/video",
        description: "Send video media via URL or multipart file upload.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "url": "https://example.com/video.mp4",\n  "caption": "Video Title"\n}',
        snippets: {
          javascript: 'fetch("https://wabot.gidraf.dev/api/sessions/my-session/messages/video", { method: "POST", body: JSON.stringify({...}) })'
        }
      },
      {
        title: "Send Audio",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/audio",
        description: "Send audio media files (supports PTT / voice messages).",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "url": "https://example.com/audio.mp3",\n  "ptt": true\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/audio", json={"jid": "...", "url": "...", "ptt": True})'
        }
      },
      {
        title: "Send Sticker",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/sticker",
        description: "Sends a WebP sticker.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "url": "https://example.com/sticker.webp"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/sticker", json={"jid": "...", "url": "..."})'
        }
      },
      {
        title: "Send Document",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/document",
        description: "Send any document (PDF, DOCX, ZIP etc.) with customized filename.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "url": "https://example.com/doc.pdf",\n  "mimetype": "application/pdf",\n  "fileName": "ProjectProposal.pdf"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/document", json={"jid": "...", "url": "...", "fileName": "proposal.pdf"})'
        }
      },
      {
        title: "Send Contact",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/contact",
        description: "Sends contact details card formatted in Vcard.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "displayName": "Jane Doe",\n  "vcard": "BEGIN:VCARD\\nVERSION:3.0\\nFN:Jane Doe\\nTEL;type=CELL;type=VOICE;type=pref:+254700000000\\nEND:VCARD"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/contact", json={"jid": "...", "displayName": "Jane", "vcard": "..."})'
        }
      },
      {
        title: "Send Location",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/location",
        description: "Sends location latitude/longitude coordinates.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "latitude": -1.2921,\n  "longitude": 36.8219,\n  "name": "Nairobi HQ"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/location", json={"jid": "...", "latitude": -1.2921, "longitude": 36.8219, "name": "Nairobi"})'
        }
      },
      {
        title: "Send Poll",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/poll",
        description: "Send poll questions with custom options.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "poll": {\n    "name": "Which platform?",\n    "values": ["React", "Vue"],\n    "selectableCount": 1\n  }\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/poll", json={"jid": "...", "poll": {"name": "...", "values": ["A", "B"]}})'
        }
      },
      {
        title: "Send Event",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/event",
        description: "Send group event scheduler details.",
        payload: '{\n  "jid": "120363XXXXXX@g.us",\n  "event": {\n    "name": "Meeting",\n    "description": "Weekly Sync",\n    "startTime": "2026-06-05T12:00:00Z"\n  }\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/event", json={"jid": "...", "event": {"name": "Sync", "startTime": "2026-06-05T12:00:00Z"}})'
        }
      },
      {
        title: "Send Group Invite",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/group-invite",
        description: "Send a stylized invitation to join a group chat.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "groupInvite": {\n    "inviteCode": "ABCDEF1234",\n    "inviteExpiration": 1780480908,\n    "text": "Join our official announcements group!",\n    "jid": "1203632XXXX@g.us",\n    "subject": "Main Group"\n  }\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/group-invite", json={"jid": "...", "groupInvite": {...}})'
        }
      },
      {
        title: "Send Reaction",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/reaction",
        description: "React to a target message with an emoji.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "messageKey": {\n    "remoteJid": "254XXXXXXXXX@s.whatsapp.net",\n    "fromMe": false,\n    "id": "MSG_ID_123"\n  },\n  "emoji": "🔥"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/reaction", json={"jid": "...", "messageKey": {}, "emoji": "🔥"})'
        }
      },
      {
        title: "Star Messages",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/star",
        description: "Star or unstar message keys.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "messageKeys": [{ "id": "MSG_ID_123", "fromMe": true }],\n  "star": true\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/star", json={"jid": "...", "messageKeys": [], "star": True})'
        }
      },
      {
        title: "Pin Message",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/pin",
        description: "Pin a message in a conversation for a duration.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "messageKey": { "id": "MSG_ID_123", "fromMe": false },\n  "time": 86400,\n  "type": 1\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/pin", json={"jid": "...", "messageKey": {}, "time": 86400})'
        }
      },
      {
        title: "Keep Message",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/keep",
        description: "Keep a message in an ephemeral (disappearing) chat.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "messageKey": { "id": "MSG_ID_123", "fromMe": false },\n  "type": 1\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/keep", json={"jid": "...", "messageKey": {}, "type": 1})'
        }
      },
      {
        title: "Forward Message",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/forward",
        description: "Forward an existing message structure.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "message": {},\n  "force": true\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/forward", json={"jid": "...", "message": {}})'
        }
      },
      {
        title: "Mark Messages Read",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/read",
        description: "Send read receipt ticks for a list of message keys.",
        payload: '{\n  "keys": [{ "remoteJid": "254XXXXXXXXX@s.whatsapp.net", "id": "MSG_ID_123", "fromMe": false }]\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/read", json={"keys": []})'
        }
      },
      {
        title: "Send Message Receipt",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/receipt",
        description: "Send a read/delivered receipt for specific messages.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "participant": "254XXXXXXXXX@s.whatsapp.net",\n  "messageIds": ["MSG_ID_123"],\n  "type": "read"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/receipt", json={\n  "jid": "...",\n  "messageIds": ["..."],\n  "type": "read"\n})'
        }
      },
      {
        title: "Send Presence Update",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/presence",
        description: "Sends presence states (composing, recording, available, unavailable) to JID.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "type": "composing"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/presence", json={"jid": "...", "type": "composing"})'
        }
      },
      {
        title: "Presence Subscribe",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/presence/subscribe",
        description: "Subscribe to presence updates (online status, typing status) for a specific user.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/presence/subscribe", json={"jid": "..."})'
        }
      },
      {
        title: "Create Call Link",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/call-link",
        description: "Generates a customized video/audio call link.",
        payload: '{\n  "type": "video"\n}',
        snippets: {
          python: 'import requests\nprint(requests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/call-link", json={"type": "video"}).json())'
        }
      },
      {
        title: "Post Text Status (Story)",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/status/text",
        description: "Post a plain text status update (story) visible to contacts.",
        payload: '{\n  "text": "Hello, this is my status!",\n  "backgroundColor": "#00a884",\n  "font": 1,\n  "statusJidList": ["254XXXXXXXXX@s.whatsapp.net"]\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/status/text", json={\n  "text": "My text story",\n  "backgroundColor": "#00a884"\n})'
        }
      },
      {
        title: "Post Media Status (Story)",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/status/media",
        description: "Post an image or video status update (story) with caption.",
        payload: '{\n  "type": "image",\n  "url": "https://example.com/status.png",\n  "caption": "Check my story!",\n  "statusJidList": ["254XXXXXXXXX@s.whatsapp.net"]\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/status/media", json={\n  "type": "image",\n  "url": "https://...",\n  "caption": "My story caption"\n})'
        }
      }
    ]
  },
  {
    category: "Messages (Interactive & Rich)",
    items: [
      {
        title: "Interactive Flow / Carousel / Buttons",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/interactive",
        description: "Send advanced interactive Native Flows, CTA Buttons, or Carousel Cards.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "text": "Choose options",\n  "nativeFlow": {\n    "buttons": [\n      { "text": "Basic Plan", "id": "plan_basic" },\n      { "text": "Sign Up Free", "url": "https://ajiriwa.gidraf.dev" }\n    ]\n  }\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/interactive", json={"jid": "...", "text": "...", "nativeFlow": {...}})'
        }
      },
      {
        title: "Template Buttons",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/template",
        description: "Send hydrated template buttons (URL, phone number links).",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "text": "Select action",\n  "templateButtons": [\n    { "index": 1, "urlButton": { "displayText": "Ajiriwa Portal", "url": "https://ajiriwa.gidraf.dev" } }\n  ]\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/template", json={"jid": "...", "text": "...", "templateButtons": []})'
        }
      },
      {
        title: "List Menu Message",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/list",
        description: "Send interactive single-select menus.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "text": "Choose a service",\n  "buttonText": "View Menu",\n  "title": "Main Menu",\n  "sections": [\n    {\n      "title": "Recruitment",\n      "rows": [{ "title": "CV Reviews", "rowId": "cv_review", "description": "Auto replies" }]\n    }\n  ]\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/list", json={"jid": "...", "text": "...", "sections": []})'
        }
      },
      {
        title: "Rich Text Response",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/rich-response",
        description: "Send text with metadata formatting.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "disclaimerText": "Confidential",\n  "richResponse": { "body": "Welcome back" }\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/rich-response", json={"jid": "...", "richResponse": {}})'
        }
      },
      {
        title: "Code Block Message",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/code-block",
        description: "Send monospace styled blocks of source code.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "code": "console.log(\'Hello World\');",\n  "language": "javascript",\n  "disclaimerText": "Source Code"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/code-block", json={"jid": "...", "code": "..."})'
        }
      },
      {
        title: "Table Message",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/table",
        description: "Send formatted layouts representing comparative values.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "title": "Project Summary",\n  "table": {\n    "headers": ["Service", "Price"],\n    "rows": [["ERP", "$19"], ["CRM", "$49"]]\n  }\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/table", json={"jid": "...", "table": {}})'
        }
      },
      {
        title: "Send Album",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/album",
        description: "Send collections of images or videos grouped together.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "album": {\n    "name": "Product Portfolio",\n    "items": [\n      { "image": { "url": "https://example.com/img1.jpg" }, "caption": "A1" }\n    ]\n  }\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/album", json={"jid": "...", "album": {}})'
        }
      },
      {
        title: "Send Sticker Pack",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/sticker-pack",
        description: "Builds and sends a packed WebP sticker zip bundle.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "name": "Sticker Pack",\n  "publisher": "Baileys API",\n  "cover": "https://wabot.gidraf.dev/assets/logo.png",\n  "stickers": [\n    { "data": "https://wabot.gidraf.dev/assets/logo.png", "emojis": ["🔥"] }\n  ]\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/sticker-pack", json={"jid": "...", "stickers": []})'
        }
      },
      {
        title: "Send Catalog Product",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/product",
        description: "Send catalog detail item card.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "businessOwnerJid": "2547XXXXXXXX@s.whatsapp.net",\n  "image": "https://example.com/img.jpg",\n  "product": { "title": "Vite React Template", "currencyCode": "KES", "priceAmount1000": 500000 }\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/product", json={"jid": "...", "product": {}})'
        }
      },
      {
        title: "View Once Media",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/view-once",
        description: "Sends ephemeral media (viewOnce, viewOnceV2, or viewOnceV2Extension).",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "type": "image",\n  "url": "https://example.com/pic.jpg",\n  "viewOnceType": "viewOnceV2",\n  "caption": "Disappearing photo"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/view-once", json={"jid": "...", "type": "image", "viewOnceType": "viewOnceV2"})'
        }
      },
      {
        title: "Modify Message (Edit/Delete)",
        method: "POST",
        path: "/api/sessions/:sessionId/messages/modify",
        description: "Execute edit or revoke actions on already sent messages.",
        payload: '{\n  "jid": "254XXXXXXXXX@s.whatsapp.net",\n  "type": "edit",\n  "messageKey": { "id": "MSG_ID_123", "fromMe": true },\n  "text": "New content"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/messages/modify", json={"jid": "...", "type": "edit", "messageKey": {}})'
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
        description: "Create a new group chat.",
        payload: '{\n  "name": "My Tech Team",\n  "participants": ["254XXXXXXXXX@s.whatsapp.net"]\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/groups", json={"name": "Team", "participants": []})'
        }
      },
      {
        title: "List Groups",
        method: "GET",
        path: "/api/sessions/:sessionId/groups",
        description: "Get all participating groups.",
        snippets: {
          python: 'requests.get("https://wabot.gidraf.dev/api/sessions/my-session/groups")'
        }
      },
      {
        title: "Manage Members",
        method: "PATCH",
        path: "/api/sessions/:sessionId/groups/:jid/participants",
        description: "Modify group members (add, remove, promote, demote).",
        payload: '{\n  "participants": ["254XXXXXXXXX@s.whatsapp.net"],\n  "action": "add"\n}',
        snippets: {
          python: 'requests.patch("https://wabot.gidraf.dev/api/sessions/my-session/groups/1203632@g.us/participants", json={"participants": [], "action": "add"})'
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
        description: "Create a community root structure.",
        payload: '{\n  "name": "Corporate Hub",\n  "description": "Primary community"\n}',
        snippets: {
          python: 'requests.post("https://wabot.gidraf.dev/api/sessions/my-session/community", json={"name": "Hub"})'
        }
      },
      {
        title: "Link Group to Community",
        method: "POST",
        path: "/api/sessions/:sessionId/community/:jid/link-group",
        description: "Link sub group chats under a community JID.",
        payload: '{\n  "groupJid": "1203632XXXX@g.us"\n}',
        snippets: {
          python: 'requests.post("https://wabot.gidraf.dev/api/sessions/my-session/community/120363community@g.us/link-group", json={"groupJid": "..."})'
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
        description: "Create public newsletter channels.",
        payload: '{\n  "name": "Daily Bulletins",\n  "description": "Tech feeds"\n}',
        snippets: {
          python: 'requests.post("https://wabot.gidraf.dev/api/sessions/my-session/newsletter", json={"name": "Feeds"})'
        }
      },
      {
        title: "Follow Channel",
        method: "POST",
        path: "/api/sessions/:sessionId/newsletter/:jid/follow",
        description: "Subscribes the WhatsApp account to follow the channel.",
        snippets: {
          python: 'requests.post("https://wabot.gidraf.dev/api/sessions/my-session/newsletter/120363@newsletter/follow")'
        }
      },
      {
        title: "Post to Newsletter",
        method: "POST",
        path: "/api/sessions/:sessionId/newsletter/:jid/post",
        description: "Post text or media content directly to the newsletter channel. Supports type 'text', 'image', 'video', 'audio', and 'document'.",
        payload: '{\n  "type": "text",\n  "text": "Hello, this is a post to my channel!",\n  "caption": "Optional caption for media",\n  "url": "https://example.com/image.png"\n}',
        snippets: {
          python: 'import requests\nrequests.post("https://wabot.gidraf.dev/api/sessions/my-session/newsletter/120363@newsletter/post", json={\n  "type": "text",\n  "text": "Hello Channel!"\n})'
        }
      }
    ]
  },
  {
    category: "Business & Privacy",
    items: [
      {
        title: "Check WhatsApp Account",
        method: "POST",
        path: "/api/sessions/:sessionId/profile/on-whatsapp",
        description: "Verify if a list of phone numbers have registered WhatsApp accounts.",
        payload: '{\n  "numbers": ["2547XXXXXXXX", "2547YYYYYYYY"]\n}',
        snippets: {
          python: 'print(requests.post("https://wabot.gidraf.dev/api/sessions/my-session/profile/on-whatsapp", json={"numbers": ["2547XXXXXXXX"]}).json())'
        }
      },
      {
        title: "Fetch Privacy Settings",
        method: "GET",
        path: "/api/sessions/:sessionId/privacy",
        description: "Retrieve active preferences for last-seen, read receipts, online status, groups etc.",
        snippets: {
          python: 'print(requests.get("https://wabot.gidraf.dev/api/sessions/my-session/privacy").json())'
        }
      },
      {
        title: "Update Business Profile",
        method: "PUT",
        path: "/api/sessions/:sessionId/business/profile",
        description: "Updates vertical, address, description, and website.",
        payload: '{\n  "description": "Retail center",\n  "email": "retail@shop.com"\n}',
        snippets: {
          python: 'requests.put("https://wabot.gidraf.dev/api/sessions/my-session/business/profile", json={"description": "..."})'
        }
      },
      {
        title: "Get Contacts List",
        method: "GET",
        path: "/api/sessions/:sessionId/profile/contacts",
        description: "Query cached and sync'd contact objects from store memory.",
        snippets: {
          python: 'print(requests.get("https://wabot.gidraf.dev/api/sessions/my-session/profile/contacts").json())'
        }
      },
      {
        title: "Resync App State",
        method: "POST",
        path: "/api/sessions/:sessionId/profile/resync-app-state",
        description: "Manually trigger synchronization for app state collections like blocklists, archives, etc.",
        payload: '{\n  "collections": ["regular", "critical_block"],\n  "isInitialSync": true\n}',
        snippets: {
          python: 'requests.post("https://wabot.gidraf.dev/api/sessions/my-session/profile/resync-app-state", json={"collections": ["regular", "critical_block"]})'
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
              <span className={`px-3 py-1 rounded font-bold text-xs ${endpoint.method === 'GET' ? 'bg-blue-500/20 text-blue-400' : endpoint.method === 'POST' ? 'bg-green-500/20 text-green-400' : endpoint.method === 'PATCH' ? 'bg-purple-500/20 text-purple-400' : endpoint.method === 'PATCH' ? 'bg-purple-500/20 text-purple-400' : 'bg-red-500/20 text-red-400'}`}>
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
