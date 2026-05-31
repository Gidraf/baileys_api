# 🌱 Baileys WhatsApp API Server

A fully-featured, auto-scalable WhatsApp API server built on [`@itsliaaa/baileys`](https://github.com/itsliaaa/baileys).

## Quick Start

```bash
# 1. Clone / copy this folder
cd baileys-api

# 2. Copy env file
cp .env.example .env

# 3. Build & start (2 workers by default)
docker compose up -d --build

# 4. Check health
curl http://localhost:21465/health
```

---

## Scaling

```bash
# Scale to 5 workers
./scripts/scale.sh 5

# Auto-scale based on session load (runs as daemon)
nohup ./scripts/autoscale.sh &
```

The autoscaler checks session count every 60 seconds and adds/removes workers to maintain `SESSIONS_PER_WORKER` sessions per container.

---

## WebSocket Events

Connect to `ws://localhost:21465/ws?session=<sessionId>` to receive real-time events:

```json
{ "sessionId": "my-session", "event": "messages.upsert", "data": {...}, "timestamp": 1234567890 }
```

Use `session=*` to receive events from all sessions.

---

## API Reference

All endpoints are prefixed with `http://localhost:21465`.

### Sessions

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET` | `/sessions` | — | List all sessions |
| `POST` | `/sessions` | `{ sessionId, phoneNumber? }` | Create/connect session |
| `GET` | `/sessions/:id` | — | Get session status |
| `GET` | `/sessions/:id/qr` | — | Get QR code (base64) |
| `POST` | `/sessions/:id/pairing-code` | `{ phoneNumber, customCode? }` | Request pairing code |
| `POST` | `/sessions/:id/disconnect` | — | Disconnect (keep files) |
| `DELETE` | `/sessions/:id` | — | Delete session (logout) |
| `POST` | `/sessions/:id/logout` | — | WhatsApp logout |

### Messages

All message endpoints: `POST /messages/:sessionId/<type>`

#### Text
```json
POST /messages/:sessionId/text
{ "jid": "628xxx@s.whatsapp.net", "text": "Hello!", "mentions": [], "mentionAll": false }
```

#### Media (multipart/form-data or JSON with url)
- `POST /messages/:sessionId/image` — `file` or `url`, + `caption`, `viewOnce`, `ai`, `spoiler`, `ephemeral`
- `POST /messages/:sessionId/video` — `file` or `url`, + `caption`, `gifPlayback`, `ptv`
- `POST /messages/:sessionId/audio` — `file` or `url`, + `ptt`
- `POST /messages/:sessionId/sticker` — `file` or `url`, + `isLottie`
- `POST /messages/:sessionId/document` — `file` or `url`, + `mimetype`, `filename`, `caption`

#### Interactive
- `POST /messages/:sessionId/buttons` — `{ jid, text, footer, buttons: [{text, id}] }`
- `POST /messages/:sessionId/list` — `{ jid, text, buttonText, title, sections }`
- `POST /messages/:sessionId/interactive` — `{ jid, payload }` (full interactive body)
- `POST /messages/:sessionId/template` — `{ jid, title, caption, footer, templateButtons }`

#### Other
- `POST /messages/:sessionId/poll` — `{ jid, poll: { name, values, selectableCount } }`
- `POST /messages/:sessionId/react` — `{ jid, key, emoji }`
- `POST /messages/:sessionId/album` — `{ jid, album: [{image/video, caption}] }`
- `POST /messages/:sessionId/location` — `{ jid, latitude, longitude, name }`
- `POST /messages/:sessionId/contact` — `{ jid, displayName, contacts }`
- `POST /messages/:sessionId/event` — `{ jid, event: {...} }`
- `POST /messages/:sessionId/rich-response` — `{ jid, richResponse, disclaimerText }`
- `POST /messages/:sessionId/code-block` — `{ jid, code, language, headerText, footerText }`
- `POST /messages/:sessionId/inline-entities` — `{ jid, links, headerText, footerText }`
- `POST /messages/:sessionId/table` — `{ jid, title, table, headerText, footerText }`
- `DELETE /messages/:sessionId/message` — `{ jid, key }` — Delete message
- `PATCH /messages/:sessionId/message` — `{ jid, key, text/caption }` — Edit message
- `POST /messages/:sessionId/read` — `{ keys: [...] }` — Mark as read
- `POST /messages/:sessionId/presence` — `{ jid, type }` — Send presence
- `POST /messages/:sessionId/star` — `{ jid, messages, star }` — Star messages
- `POST /messages/:sessionId/find-user` — `{ jid }` — Find user ID

#### Payment
- `POST /messages/:sessionId/payment/invite` — `{ jid, serviceType }`
- `POST /messages/:sessionId/payment/request` — `{ jid, text, requestPaymentFrom }`
- `POST /messages/:sessionId/payment/order` — `{ jid, orderText }` + `thumbnail` file

### Groups `GET|POST|PATCH|DELETE /groups/:sessionId/...`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/groups/:sessionId` | Create group |
| `GET` | `/groups/:sessionId` | Get all groups |
| `GET` | `/groups/:sessionId/:jid` | Get group metadata |
| `GET` | `/groups/:sessionId/:jid/invite-code` | Get invite code |
| `POST` | `/groups/:sessionId/:jid/revoke-invite` | Revoke invite |
| `POST` | `/groups/:sessionId/accept-invite` | Accept invite |
| `POST` | `/groups/:sessionId/:jid/leave` | Leave group |
| `PATCH` | `/groups/:sessionId/:jid/participants` | Add/remove/promote/demote |
| `PATCH` | `/groups/:sessionId/:jid/join-requests` | Approve/reject join requests |
| `PATCH` | `/groups/:sessionId/:jid/name` | Update name |
| `PATCH` | `/groups/:sessionId/:jid/description` | Update description |
| `PATCH` | `/groups/:sessionId/:jid/setting` | Update setting |
| `PATCH` | `/groups/:sessionId/:jid/ephemeral` | Toggle ephemeral |
| `PATCH` | `/groups/:sessionId/:jid/join-approval` | Join approval mode |

### Newsletter `/newsletter/:sessionId/...`

Create, metadata, subscribers, follow/unfollow, mute/unmute, update name/description/picture, react, admin count, fetch messages, delete.

### Community `/community/:sessionId/...`

Create, create-group, link/unlink group, metadata, invite, leave, participants, name/description/settings.

### Profile `/profile/:sessionId/...`

Picture (get/update/delete), name, status, block/unblock, blocklist, chat modify, contacts, labels, business profile.

### Business `/business/:sessionId/...`

Products (CRUD), catalog, collections, orders, business profile, cover photo, quick replies.

### Privacy `/privacy/:sessionId/...`

Last seen, online, profile picture, status, read receipts, groups-add, messages, calls, disappearing mode, link previews.

---

## Session Lifecycle

```
POST /sessions { sessionId: "user1" }
  → status: "connecting"
  → WebSocket event: "qr" (scan with WhatsApp)
  → WebSocket event: "connected"

# Now send messages
POST /messages/user1/text { jid: "628xxx@s.whatsapp.net", text: "Hi!" }
```

---

## Architecture

```
Client
  │
  ▼
Nginx (port 21465)
  │  least_conn load balancing
  ├── baileys-worker-1:21465  (sessions: A, B, C)
  ├── baileys-worker-2:21465  (sessions: D, E)
  └── baileys-worker-N:21465  (auto-scaled)
            │
        Shared Volume
        /app/sessions/  (auth state per session)
```

Sessions are stored on a shared Docker volume so any worker can reconnect them on startup. Nginx distributes new requests to the least-busy worker.
