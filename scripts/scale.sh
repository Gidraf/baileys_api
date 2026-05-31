#!/usr/bin/env bash
# Usage: ./scripts/scale.sh <number_of_workers>
# Example: ./scripts/scale.sh 5

set -euo pipefail

REPLICAS=${1:-2}

if ! [[ "$REPLICAS" =~ ^[0-9]+$ ]] || [ "$REPLICAS" -lt 1 ]; then
  echo "Usage: $0 <number_of_workers> (must be >= 1)"
  exit 1
fi

echo "Scaling baileys-worker to $REPLICAS replicas..."
docker compose up --scale baileys-worker="$REPLICAS" --no-recreate -d

echo ""
echo "Current containers:"
docker compose ps

echo ""
echo "Tip: Watch sessions per worker with:"
echo "  watch -n 5 'docker compose ps && echo && for c in \$(docker compose ps -q baileys-worker); do echo -n \"\$c: \"; docker exec \$c wget -qO- http://localhost:21465/health 2>/dev/null | grep -o \"sessions\":[0-9]*; done'"
