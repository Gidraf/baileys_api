# ── Stage 1: Build / install dependencies ─────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# System libs needed by sharp + canvas (optional but common with Baileys)
RUN apk add --no-cache \
    python3 make g++ \
    cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev \
    ffmpeg \
    && ln -sf python3 /usr/bin/python

COPY package.json ./
RUN npm install --omit=dev --legacy-peer-deps

# ── Stage 2: Production image ──────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Runtime system libraries
RUN apk add --no-cache \
    cairo pango jpeg giflib librsvg \
    ffmpeg \
    dumb-init

# Non-root user
RUN addgroup -S baileys && adduser -S baileys -G baileys

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=baileys:baileys . .

# Sessions volume
VOLUME ["/app/sessions"]

ENV NODE_ENV=production \
    PORT=21465 \
    SESSIONS_DIR=/app/sessions \
    LOG_LEVEL=info

EXPOSE 21465

USER baileys

# Use dumb-init to handle signals properly (important for graceful shutdown)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:21465/health || exit 1
