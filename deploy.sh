#!/usr/bin/env bash
# Deploy SoulForge to VPS (git pull + npm + pm2).
# Usage:
#   export SOULFORGE_SSH=user@your.vps.ip
#   export SOULFORGE_DIR=/var/www/soulforge   # optional
#   ./deploy.sh
set -euo pipefail

SSH_TARGET="${SOULFORGE_SSH:-}"
REMOTE_DIR="${SOULFORGE_DIR:-/var/www/soulforge}"

if [[ -z "$SSH_TARGET" ]]; then
  echo "Set SOULFORGE_SSH=user@host (e.g. root@1.2.3.4)"
  exit 1
fi

echo "==> Deploy to $SSH_TARGET:$REMOTE_DIR"
ssh "$SSH_TARGET" bash -s -- "$REMOTE_DIR" <<'REMOTE'
set -euo pipefail
DIR="$1"
cd "$DIR"
git pull --ff-only
cd server
npm ci --omit=dev
if pm2 describe soulforge >/dev/null 2>&1; then
  HOST=127.0.0.1 PORT=8787 pm2 restart soulforge --update-env
else
  HOST=127.0.0.1 PORT=8787 pm2 start ecosystem.config.cjs
  pm2 save
fi
pm2 status soulforge
echo "OK"
REMOTE
