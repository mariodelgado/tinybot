#!/usr/bin/env bash
#
# Start TinyBot and the six TinyFish products, then verify each service answers.
# TinyPipe comes up first (auth socket on :3712). Safe to rerun: matching services
# are left running, and unrelated port holders are reported.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
LOGS="$ROOT/.logs"
mkdir -p "$LOGS"

if [ ! -f "$ROOT/.env" ]; then
  printf '\033[31m%s\033[0m\n' ".env is missing. Copy .env.example to .env and fill in the required settings."
  exit 1
fi

# The environment first, then .env, then the default. Compose and the API server both read .env, so a
# port or token configured there is what this script must use as well.
setting() {
  local name="$1" fallback="$2" value="${!1:-}"
  if [ -z "$value" ]; then
    value="$(grep -E "^$name=" "$ROOT/.env" | tail -1 | cut -d= -f2- | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/")"
  fi
  printf '%s' "${value:-$fallback}"
}

# Persist a default into .env when the key is missing or commented out.
# Does not overwrite an explicit user value.
ensure_setting() {
  local name="$1" value="$2" tmp
  if grep -qE "^${name}=" "$ROOT/.env"; then
    return 0
  fi
  tmp="$(mktemp)"
  if grep -qE "^#[[:space:]]*${name}=" "$ROOT/.env"; then
    awk -v name="$name" -v value="$value" '
      $0 ~ "^#[[:space:]]*"name"=" && !done { print name"="value; done=1; next }
      { print }
    ' "$ROOT/.env" > "$tmp"
    mv "$tmp" "$ROOT/.env"
    return 0
  fi
  printf '\n%s=%s\n' "$name" "$value" >> "$ROOT/.env"
}

# TinyBot inference: OpenRouter when OPENROUTER_API_KEY is set. Same OpenAI-shaped
# client; force the OpenRouter base URL. Do not print the key.
OPENROUTER_API_KEY="$(setting OPENROUTER_API_KEY "")"
if [ -n "$OPENROUTER_API_KEY" ]; then
  export OPENROUTER_API_KEY
  export OPENAI_API_KEY="$OPENROUTER_API_KEY"
  export OPENAI_BASE_URL="https://openrouter.ai/api/v1"
  export BOT_PROVIDER=openai
  BOT_MODEL="$(setting BOT_MODEL stealth/ox-alpha)"
  export BOT_MODEL
fi

APP_PORT="$(setting APP_PORT 3010)"
SERVER_PORT="$(setting SERVER_PORT 3001)"
COMPUTER_PORT="$(setting COMPUTER_PORT 4100)"
BOT_PORT="$(setting BOT_PORT 4200)"
LANGGRAPH_PORT="$(setting LANGGRAPH_PORT 4201)"
SUPERVISOR_PORT="$(setting SUPERVISOR_PORT 4500)"
ONE_COMPUTER_EACH="${OPENBOT_ONE_COMPUTER_EACH:-true}"
export APP_PORT SERVER_PORT
SUPERVISOR_TOKEN="$(setting SUPERVISOR_TOKEN openbot-dev-supervisor-token)"
COMPUTER_TOKEN="$(setting COMPUTER_TOKEN openbot-dev-computer-token)"

green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }
info()  { printf '\033[2m%s\033[0m\n' "$1"; }

holder() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN -Fcn 2>/dev/null | awk '/^c/{c=substr($0,2)} /^n/{print c" ("substr($0,2)")"; exit}' || true
}

require_free_or_ours() {
  local port="$1" name="$2" who
  who="$(holder "$port")"
  [ -z "$who" ] && return 0
  if curl -fsS --max-time 3 "http://localhost:$port/health" >/dev/null 2>&1 \
     || curl -fsS --max-time 3 "http://localhost:$port/api/capabilities" >/dev/null 2>&1 \
     || curl -fsS --max-time 3 "http://localhost:$port/" >/dev/null 2>&1; then
    info "  $name: already up on $port ($who)"
    return 0
  fi
  red "  $name: port $port is held by something else: $who"
  red "  Re-run with ${name^^}_PORT=<free port>, or stop that process yourself."
  exit 1
}

wait_for() {
  local url="$1" name="$2" tries="${3:-40}"
  for _ in $(seq 1 "$tries"); do
    curl -fsS --max-time 3 "$url" >/dev/null 2>&1 && { green "  $name ready"; return 0; }
    sleep 1
  done
  red "  $name never became ready at $url"
  red "  Log: $LOGS/${name}.log"
  exit 1
}

echo
echo "TinyBot"
echo "======="

info "1/5  TinyFish products (TinyPipe first)"
ensure_setting TINYFISH_MCP_URL "http://127.0.0.1:3712/mcp"
ensure_setting TINYFISH_ISSUER "https://issuer.fixtures.tinyfish.test"
export TINYFISH_MCP_URL="$(setting TINYFISH_MCP_URL http://127.0.0.1:3712/mcp)"
export TINYFISH_ISSUER="$(setting TINYFISH_ISSUER https://issuer.fixtures.tinyfish.test)"
for _tf_url_key in \
  TINYFISH_TINYPIPE_URL TINYFISH_TINYTAIL_URL TINYFISH_TINYPULSE_URL \
  TINYFISH_TINYWEB_URL TINYFISH_TINYWATCH_URL TINYFISH_TINYKIT_URL \
  VITE_TINYFISH_TF_03_URL VITE_TINYFISH_JS_01_URL VITE_TINYFISH_JS_02_URL \
  VITE_TINYFISH_JS_03_URL VITE_TINYFISH_TF_01_URL VITE_TINYFISH_TF_02_URL
do
  _tf_url_val="$(setting "$_tf_url_key" "")"
  if [ -n "$_tf_url_val" ]; then
    export "${_tf_url_key}=${_tf_url_val}"
  fi
done
unset _tf_url_key _tf_url_val
if [ "${OPENBOT_SKIP_TINYFISH_PRODUCTS:-}" = "1" ]; then
  info "  skipped (OPENBOT_SKIP_TINYFISH_PRODUCTS=1). Cards show Unreachable until the six are up."
else
  if ! bun "$ROOT/scripts/tinyfish/start-products.ts" | tee "$LOGS/tinyfish-products.log"; then
    red "  TinyFish products did not start. TinyPipe must be healthy on :3712 before sign-in and the cards work."
    red "  Log: $LOGS/tinyfish-products.log"
    exit 1
  fi
  green "  TinyPipe $TINYFISH_MCP_URL · issuer $TINYFISH_ISSUER"
fi

info "2/5  Docker services"
SERVICES=(postgres)
if [ "$ONE_COMPUTER_EACH" = "true" ]; then
  SERVICES+=(supervisor)
fi
for svc_port in "agent-computer:$COMPUTER_PORT" "agent-bot:$BOT_PORT" "agent-langgraph:$LANGGRAPH_PORT"; do
  svc="${svc_port%%:*}"; port="${svc_port##*:}"
  if curl -fsS --max-time 3 "http://localhost:$port/health" >/dev/null 2>&1; then
    info "  $svc: already answering on $port"
  else
    SERVICES+=("$svc")
  fi
done

export SUPERVISOR_TOKEN COMPUTER_TOKEN
export COMPUTER_PORT BOT_PORT LANGGRAPH_PORT SUPERVISOR_PORT
docker compose up -d --build "${SERVICES[@]}" >/dev/null
if ! docker compose run --rm --build migrate >"$LOGS/migrate.log" 2>&1; then
  red "  Migrations did not apply. The database is not the schema this server expects."
  red "  Log: $LOGS/migrate.log"
  exit 1
fi
wait_for "http://localhost:$COMPUTER_PORT/health" "agent-computer"
wait_for "http://localhost:$BOT_PORT/health" "agent-bot"
wait_for "http://localhost:$LANGGRAPH_PORT/health" "agent-langgraph"

for table in agent_profiles agent_preferences; do
  if ! docker compose exec -T postgres \
       psql -U openbot -d openbot -tAc "select to_regclass('public.$table')" 2>/dev/null \
       | grep -q "^$table$"; then
    red "  $table is missing. Run: bun run --cwd server db:migrate"
    exit 1
  fi
done
green "  coworker tables migrated"

MANAGED_URL="$(grep -E '^MANAGED_AGENT_AG_UI_URL=' "$ROOT/.env" | tail -1 | cut -d= -f2-)"
if [ -z "$MANAGED_URL" ]; then
  red "  MANAGED_AGENT_AG_UI_URL is not set in .env."
  red "  See .env.example."
  exit 1
fi
green "  managed coworker endpoint: $MANAGED_URL"

info "3/5  Server"
require_free_or_ours "$SERVER_PORT" server
if ! curl -fsS --max-time 3 "http://localhost:$SERVER_PORT/api/capabilities" >/dev/null 2>&1; then
  if [ "$ONE_COMPUTER_EACH" = "true" ]; then
    (cd server && PORT="$SERVER_PORT" \
      COMPUTER_SUPERVISOR_URL="http://localhost:$SUPERVISOR_PORT" \
      SUPERVISOR_TOKEN="$SUPERVISOR_TOKEN" \
      COMPUTER_TOKEN="$COMPUTER_TOKEN" \
      bun --env-file=../.env src/index.ts >"$LOGS/server.log" 2>&1 &)
  else
    (cd server && PORT="$SERVER_PORT" bun --env-file=../.env src/index.ts >"$LOGS/server.log" 2>&1 &)
  fi
fi
wait_for "http://localhost:$SERVER_PORT/api/capabilities" "server"

info "4/5  Runtime health"
INFO="$(curl -fsS --max-time 8 "http://localhost:$SERVER_PORT/api/copilotkit/info")"
python3 - "$INFO" <<'PY'
import json, sys
info = json.loads(sys.argv[1])
status, agents = info.get("licenseStatus"), list(info.get("agents", {}))
if status != "valid":
    print(f"\033[31m  licence is '{status}', not 'valid'.\033[0m")
    print("\033[31m  Run: npx copilotkit@latest login && npx copilotkit@latest license --write\033[0m")
    print("\033[31m  See README.md for Intelligence setup.\033[0m")
    raise SystemExit(1)
if not agents:
    print("\033[31m  No Bots registered.\033[0m")
    raise SystemExit(1)
print(f"\033[32m  licence valid · mode {info.get('mode')} · Bots: {', '.join(agents)}\033[0m")
PY

info "5/5  App"
require_free_or_ours "$APP_PORT" app
if ! curl -fsS --max-time 3 "http://localhost:$APP_PORT/" >/dev/null 2>&1; then
  (cd app && bun run dev --port "$APP_PORT" --strictPort >"$LOGS/app.log" 2>&1 &)
fi
wait_for "http://localhost:$APP_PORT/" "app"

cat <<EOF

$(green "Ready. http://localhost:$APP_PORT")

Sign in first:             http://localhost:$APP_PORT/sign
  TinyPipe must be healthy. Paste tfk.alice (creates tfu_alice).

TinyFish cards iframe the UI; agents call /api/products/<slug>/* (TinyPipe first):

  - TinyPipe:              http://127.0.0.1:3712/ui   POST /api/products/tinypipe/mcp
  - TinyTail:              http://127.0.0.1:18765/ui  GET  /api/products/tinytail/v1/as-of
  - TinyPulse:             http://127.0.0.1:18082/ui  /api/products/tinypulse/…
  - TinyWeb:               http://127.0.0.1:18766/ui  /api/products/tinyweb/…
  - TinyWatch:             http://127.0.0.1:18081/    /api/products/tinywatch/…
  - TinyKit:               http://127.0.0.1:18083/    /api/products/tinykit/…

Next steps:

  - Direct Bot chat:       http://localhost:$APP_PORT/bot
  - Coworkers:             http://localhost:$APP_PORT/agents
  - Audit trail:           http://localhost:$APP_PORT/admin/audit
  - Boundaries/policy:     http://localhost:$APP_PORT/admin/boundaries
  - Setup docs:            README.md
  - Configuration docs:    docs/configuration.md

Try:

  1. Open /sign and paste tfk.alice, then open a start-page card.
  2. Open /bot and ask: Open news.ycombinator.com and tell me the top story.
  3. Create a coworker in /agents and start a channel with it.
  4. Review browser/file actions in /admin/audit.

Logs: $LOGS
Stop Docker services: docker compose down
Stop TinyFish products: bun scripts/tinyfish/start-products.ts --down
Stop host app/server: kill the processes using ports $APP_PORT and $SERVER_PORT
EOF
