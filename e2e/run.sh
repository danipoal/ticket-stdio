#!/usr/bin/env bash
# Smoke e2e contra el build web servido con la misma config nginx de produccion.
#   ./e2e/run.sh [dist]           (por defecto ./dist, generado con `npx expo export --platform web`)
#   SMOKE_ONLINE=1 ./e2e/run.sh   (ademas comprueba el mensaje real de Supabase)
# Requiere Docker. Usa un puerto libre y limpia los contenedores al terminar.
set -euo pipefail
cd "$(dirname "$0")/.."
DIST="$(cd "${1:-dist}" && pwd)"
PORT="${PORT:-19555}"
NAME="ticket-smoke-$$"
trap 'docker stop "$NAME" >/dev/null 2>&1 || true' EXIT
docker run -d --rm --name "$NAME" -p "$PORT:8081" \
  -v "$DIST:/usr/share/nginx/html:ro" \
  -v "$PWD/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine >/dev/null
for _ in $(seq 1 20); do curl -sf "http://127.0.0.1:$PORT/" >/dev/null && break; sleep 0.5; done
docker run --rm --network host -e BASE="http://127.0.0.1:$PORT" -e SMOKE_ONLINE="${SMOKE_ONLINE:-0}" \
  -v "$PWD/e2e:/home/pptruser/e2e:ro" ghcr.io/puppeteer/puppeteer:latest node /home/pptruser/e2e/smoke.js
