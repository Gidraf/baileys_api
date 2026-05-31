#!/usr/bin/env bash
# autoscale.sh - Automatically scale workers based on total session count
#
# Run as a daemon:  nohup ./scripts/autoscale.sh &
# Or as a cron:     */2 * * * * /path/to/baileys-api/scripts/autoscale.sh

set -euo pipefail

SESSIONS_PER_WORKER=${SESSIONS_PER_WORKER:-10}   # Target sessions per worker
MIN_WORKERS=${MIN_WORKERS:-1}
MAX_WORKERS=${MAX_WORKERS:-20}
CHECK_INTERVAL=${CHECK_INTERVAL:-60}              # Seconds between checks
NGINX_PORT=${EXPOSE_PORT:-21465}

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

get_total_sessions() {
  # Query all workers via nginx and sum session counts
  local total=0
  local count
  count=$(curl -sf "http://localhost:${NGINX_PORT}/health" \
    | grep -o '"sessions":[0-9]*' \
    | grep -o '[0-9]*' || echo 0)
  echo "$count"
}

get_current_replicas() {
  docker compose ps --format json baileys-worker 2>/dev/null \
    | grep -c '"Service":"baileys-worker"' || echo 1
}

scale_to() {
  local target=$1
  log "Scaling to $target workers"
  docker compose up --scale baileys-worker="$target" --no-recreate -d --quiet-pull 2>&1 | tail -1
}

log "Auto-scaler started (target: ${SESSIONS_PER_WORKER} sessions/worker, min: ${MIN_WORKERS}, max: ${MAX_WORKERS})"

while true; do
  TOTAL_SESSIONS=$(get_total_sessions)
  CURRENT_REPLICAS=$(get_current_replicas)

  # Calculate desired replicas (ceiling division)
  DESIRED=$(( (TOTAL_SESSIONS + SESSIONS_PER_WORKER - 1) / SESSIONS_PER_WORKER ))
  DESIRED=$(( DESIRED < MIN_WORKERS ? MIN_WORKERS : DESIRED ))
  DESIRED=$(( DESIRED > MAX_WORKERS ? MAX_WORKERS : DESIRED ))

  log "Sessions: ${TOTAL_SESSIONS} | Current workers: ${CURRENT_REPLICAS} | Desired: ${DESIRED}"

  if [ "$DESIRED" -ne "$CURRENT_REPLICAS" ]; then
    scale_to "$DESIRED"
  fi

  sleep "$CHECK_INTERVAL"
done
