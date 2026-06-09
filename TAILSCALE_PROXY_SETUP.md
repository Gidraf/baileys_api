# Tailscale Proxy Pool — Setup Guide

Your current Tailscale devices:
```
100.68.207.107  mail    (Linux)   ← run microsocks here
100.65.45.69    gidraf  (Android) ← run microsocks via Termux
100.70.180.34   gtv     (Android) ← run microsocks via Termux
```

---

## Step 1 — Add to your .env on the main server

```bash
# Tell the proxy pool about your 3 Tailscale devices directly
# (no Tailscale CLI needed on the server — just reads this list)
WA_PROXY_PEERS=100.68.207.107,100.65.45.69,100.70.180.34

# Port microsocks listens on (same on all devices)
WA_PROXY_PORT=1080

# Protocol (socks5h resolves DNS through the proxy — recommended)
WA_PROXY_PROTOCOL=socks5h

# Optional: shared proxy auth on all devices
# WA_PROXY_USER=wa
# WA_PROXY_PASS=secret
```

---

## Step 2 — Start microsocks on each device

### 100.68.207.107 — mail (Linux)

```bash
apt install microsocks

# Start immediately
microsocks -p 1080

# Or as a systemd service (persistent across reboots):
cat > /etc/systemd/system/microsocks.service << 'EOF'
[Unit]
Description=WA Proxy SOCKS5
After=network.target tailscaled.service

[Service]
ExecStart=/usr/bin/microsocks -p 1080
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl enable --now microsocks
systemctl status microsocks
```

---

### 100.65.45.69 — gidraf (Android via Termux)
### 100.70.180.34 — gtv (Android via Termux)

Install [Termux](https://f-droid.org/packages/com.termux/) and [Termux:Boot](https://f-droid.org/packages/com.termux.boot/) from F-Droid.

```bash
# In Termux:
pkg update && pkg upgrade -y
pkg install git clang make

# Build microsocks (no package available in Termux yet)
git clone https://github.com/rofl0r/microsocks
cd microsocks
make
cp microsocks $PREFIX/bin/

# Test it
microsocks -p 1080 &
```

**Auto-start on boot with Termux:Boot:**
```bash
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start-proxy.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
# Keep Termux awake and start the proxy
termux-wake-lock
microsocks -p 1080
EOF
chmod +x ~/.termux/boot/start-proxy.sh
```

> **Important:** In Termux settings, enable "Acquire wakelock" so the proxy keeps
> running when the screen is off.

---

## Step 3 — Verify from the main server

```bash
# Test each device
curl --socks5h 100.68.207.107:1080 https://api.ipify.org
curl --socks5h 100.65.45.69:1080  https://api.ipify.org
curl --socks5h 100.70.180.34:1080 https://api.ipify.org
```

Each should return a different public IP. If they return the same IP, the traffic
is routing through the same upstream connection — that's fine for anti-ban purposes
as long as Tailscale is routing via the peer's internet connection.

---

## Step 4 — Check the dashboard

Open: `http://your-server:21465/webhooks` → **Tailscale Proxy Pool** section

You'll see all 3 devices, their IPs, and which sessions/partners are pinned to which.

---

## How partner pinning works

With 3 devices, partners are assigned like this:

```
hash("partner-A") % 3 = 1  →  100.65.45.69   (gidraf)
hash("partner-B") % 3 = 2  →  100.70.180.34  (gtv)
hash("partner-C") % 3 = 0  →  100.68.207.107 (mail)
```

All 300 messages from Partner A look like they come from gidraf's IP.
All from Partner B look like gtv's IP.
Completely different fingerprints = much lower ban risk.

---

## Adding more devices

1. Add any machine to your Tailscale network
2. Run `microsocks -p 1080` on it
3. Add its IP to `WA_PROXY_PEERS` (or leave that env unset for auto-discovery)
4. Hit `POST /api/proxy/pool/refresh` or wait 60 seconds

The pool picks it up automatically and starts routing some partners through it.
