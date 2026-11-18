#!/usr/bin/env bash
# E2E contra el build web servido con la misma config nginx de produccion.
#   ./e2e/run.sh [dist]            build generado con EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399
#                                  (ver `npm run e2e`): arranca el Supabase simulado y lanza smoke + flujos.
#   MOCK=0 ./e2e/run.sh dist       build con Supabase real (p. ej. produccion): solo smoke.
# Requiere Docker y Node. Usa puertos libres y limpia al terminar.
set -euo pipefail
cd "$(dirname "$0")/.."
DIST="$(cd "${1:-dist}" && pwd)"
PORT="${PORT:-19555}"
MOCK="${MOCK:-1}"
NAME="ticket-smoke-$$"
MOCK_PID=""
cleanup() {
  docker stop "$NAME" >/dev/null 2>&1 || true
  if [ -n "$MOCK_PID" ]; then kill "$MOCK_PID" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

if [ "$MOCK" = "1" ]; then
  node e2e/mock-supabase.js >/dev/null 2>&1 &
  MOCK_PID=$!
  for _ in $(seq 1 20); do curl -sf "http://127.0.0.1:54399/rest/v1/Sheet_status" >/dev/null && break; sleep 0.5; done
fi

docker run -d --rm --name "$NAME" -p "$PORT:8081" \
  -v "$DIST:/usr/share/nginx/html:ro" \
  -v "$PWD/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine >/dev/null
for _ in $(seq 1 20); do curl -sf "http://127.0.0.1:$PORT/" >/dev/null && break; sleep 0.5; done

pptr() {
  docker run --rm --network host -e BASE="http://127.0.0.1:$PORT" -e SMOKE_ONLINE="${SMOKE_ONLINE:-$MOCK}" \
    -v "$PWD/e2e:/home/pptruser/e2e:ro" ghcr.io/puppeteer/puppeteer:latest node "/home/pptruser/e2e/$1"
}
STATUS=0
pptr smoke.js || STATUS=1
if [ "$MOCK" = "1" ]; then pptr flows.js || STATUS=1; fi
exit $STATUS
