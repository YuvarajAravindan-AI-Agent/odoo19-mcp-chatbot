#!/usr/bin/env bash
# Starts the local side of the Odoo chatbot: the read-only proxy + a
# cloudflared quick tunnel. The tunnel URL is NOT fixed (free quick tunnels
# are ephemeral) — each run prints a new URL. Update ODOO_PROXY_URL in Vercel
# (`vercel env rm/add ODOO_PROXY_URL`) whenever you restart this.
#
# Prereq: Odoo running via `docker compose up -d` in this directory.
set -euo pipefail
cd "$(dirname "$0")"

PROXY_LOG=/tmp/odoo-proxy.log
TUNNEL_LOG=/tmp/odoo-cloudflared.log

# 1. Read-only proxy (only if not already up on 8788)
if ! ss -tln 2>/dev/null | grep -q ':8788'; then
  setsid ./proxy/.venv/bin/uvicorn --app-dir ./proxy main:app \
    --host 127.0.0.1 --port 8788 >"$PROXY_LOG" 2>&1 < /dev/null &
  sleep 2
  echo "proxy: started (log: $PROXY_LOG)"
else
  echo "proxy: already running on :8788"
fi

# 2. cloudflared quick tunnel (kill any existing one for this project first)
pkill -f "cloudflared tunnel --url http://localhost:8788" 2>/dev/null || true
sleep 1
setsid /home/yuvaraj/bin/cloudflared tunnel --url http://localhost:8788 \
  --logfile "$TUNNEL_LOG" >/dev/null 2>&1 < /dev/null &
sleep 6

URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | tail -1)
if [ -n "$URL" ]; then
  echo
  echo "============================================================"
  echo "  TUNNEL UP:  $URL"
  echo "  Update Vercel: vercel env rm ODOO_PROXY_URL production"
  echo "                 echo $URL | vercel env add ODOO_PROXY_URL production"
  echo "                 vercel --prod (to redeploy with the new URL)"
  echo "============================================================"
else
  echo "!! cloudflared did not start cleanly — check $TUNNEL_LOG"
fi
