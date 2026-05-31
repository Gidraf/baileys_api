# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install build tools needed for native addons (libsignal / sharp etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ git \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# ffmpeg for audio/video processing used by Baileys
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy built artefacts from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY package.json ./

# Sessions are stored on a mounted volume so they survive container restarts
VOLUME ["/app/sessions"]

ENV PORT=3000
ENV SESSIONS_DIR=/app/sessions
ENV LOG_LEVEL=silent
ENV NODE_ENV=production

EXPOSE 3000

# Non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && mkdir -p /app/sessions && chown -R appuser:appuser /app
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
