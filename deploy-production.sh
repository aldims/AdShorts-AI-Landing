#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
RELEASE_DIR="$ROOT_DIR/.codex-tmp/production-release"
APP_DIR="$RELEASE_DIR/app"
LOCAL_EXAMPLES_DIR="$ROOT_DIR/app/data/local-examples"

PROD_SSH="${PROD_SSH:-aldima@158.160.125.225}"
PROD_ROOT_DIR="${PROD_ROOT_DIR:-/home/aldima/AdShorts-AI-production}"
PROD_APP_DIR="${PROD_APP_DIR:-$PROD_ROOT_DIR/app}"
PROD_STATIC_DIR="${PROD_STATIC_DIR:-/home/aldima/AdShorts-AI-production-static}"
PROD_SERVICE="${PROD_SERVICE:-adshorts-production-api}"
PROD_URL="${PROD_URL:-https://adshortsai.com}"
PROD_API_HOST="${PROD_API_HOST:-127.0.0.1}"
PROD_API_PORT="${PROD_API_PORT:-4175}"
PROD_DB_NAME="${PROD_DB_NAME:-adshorts_prod}"
PROD_DB_USER="${PROD_DB_USER:-adshorts_prod}"
STAGING_APP_DIR="${STAGING_APP_DIR:-/home/aldima/AdShorts-AI-staging/app}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)

echo "[production] prepare release workspace"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

rsync -az --delete \
  --exclude='.git/' \
  --exclude='.codex-tmp/' \
  --exclude='node_modules/' \
  --exclude='app/node_modules/' \
  --exclude='app/dist/' \
  --exclude='app/dist-server/' \
  --exclude='app/data/' \
  --exclude='app/logs/' \
  --exclude='logs/' \
  --exclude='tmp/' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='*.local' \
  "$ROOT_DIR/" "$RELEASE_DIR/"

if [ ! -d "$APP_DIR" ]; then
  echo "App directory not found in release workspace: $APP_DIR" >&2
  exit 1
fi

echo "[production] install release build dependencies"
cd "$APP_DIR"
npm ci --no-audit --no-fund

echo "[production] build release"
npm run build

if [ "${RUN_TESTS:-0}" = "1" ]; then
  echo "[production] tests"
  npm test
fi

echo "[production] check static pages"
cd "$RELEASE_DIR"
node scripts/generate-static-landing.mjs --check
node scripts/check-static-i18n.mjs

echo "[production] prepare remote directories"
ssh "${SSH_OPTS[@]}" "$PROD_SSH" \
  "mkdir -p '$PROD_APP_DIR' '$PROD_APP_DIR/data/local-examples' '$PROD_STATIC_DIR'"

echo "[production] upload static pages"
rsync -az --delete \
  --exclude='.git/' \
  --exclude='.codex-tmp/' \
  --exclude='app/' \
  --exclude='node_modules/' \
  --exclude='logs/' \
  --exclude='tmp/' \
  --exclude='Untitled' \
  --include='*/' \
  --include='*.html' \
  --include='*.css' \
  --include='*.js' \
  --include='*.svg' \
  --include='*.png' \
  --include='*.webp' \
  --include='*.mp4' \
  --include='*.ico' \
  --include='*.txt' \
  --include='*.xml' \
  --exclude='*' \
  "$RELEASE_DIR/" "$PROD_SSH:$PROD_STATIC_DIR/"

echo "[production] upload frontend"
rsync -az --delete "$APP_DIR/dist/" "$PROD_SSH:$PROD_APP_DIR/dist/"

echo "[production] upload server"
rsync -az --delete "$APP_DIR/dist-server/" "$PROD_SSH:$PROD_APP_DIR/dist-server/"
rsync -az "$APP_DIR/package.json" "$APP_DIR/package-lock.json" "$PROD_SSH:$PROD_APP_DIR/"

echo "[production] sync local examples"
mkdir -p "$LOCAL_EXAMPLES_DIR"
rsync -az --delete "$LOCAL_EXAMPLES_DIR/" "$PROD_SSH:$PROD_APP_DIR/data/local-examples/"

echo "[production] configure runtime, caddy and service"
ssh "${SSH_OPTS[@]}" "$PROD_SSH" \
  "PROD_APP_DIR='$PROD_APP_DIR' PROD_STATIC_DIR='$PROD_STATIC_DIR' PROD_SERVICE='$PROD_SERVICE' PROD_URL='$PROD_URL' PROD_API_HOST='$PROD_API_HOST' PROD_API_PORT='$PROD_API_PORT' PROD_DB_NAME='$PROD_DB_NAME' PROD_DB_USER='$PROD_DB_USER' STAGING_APP_DIR='$STAGING_APP_DIR' bash -s" <<'REMOTE'
set -euo pipefail

validate_identifier() {
  case "$1" in
    ''|*[!a-zA-Z0-9_]*)
      echo "Invalid PostgreSQL identifier: $1" >&2
      exit 1
      ;;
  esac
}

rollback_caddy() {
  local backup_file="${1:-}"
  if [ -n "$backup_file" ] && [ -f "$backup_file" ]; then
    echo "[production] rollback caddy to $backup_file" >&2
    sudo cp "$backup_file" /etc/caddy/Caddyfile
    sudo systemctl reload caddy || sudo systemctl restart caddy || true
  fi
}

validate_identifier "$PROD_DB_NAME"
validate_identifier "$PROD_DB_USER"

echo "[production] install remote production dependencies"
cd "$PROD_APP_DIR"
npm ci --omit=dev --no-audit --no-fund

PROD_ENV_FILE="$PROD_APP_DIR/.env"
STAGING_ENV_FILE="$STAGING_APP_DIR/.env"
AUTH_DATABASE_URL=""

if [ -f "$PROD_ENV_FILE" ]; then
  AUTH_DATABASE_URL="$(node --input-type=module - "$PROD_ENV_FILE" <<'NODE'
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
const parsed = dotenv.parse(readFileSync(process.argv[2]));
process.stdout.write(String(parsed.AUTH_DATABASE_URL ?? "").trim());
NODE
)"
fi

if [ -z "$AUTH_DATABASE_URL" ]; then
  DB_PASS="$(openssl rand -hex 32)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL >/dev/null
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$PROD_DB_USER') THEN
    CREATE ROLE $PROD_DB_USER LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE $PROD_DB_USER LOGIN PASSWORD '$DB_PASS';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE $PROD_DB_NAME OWNER $PROD_DB_USER'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$PROD_DB_NAME')\gexec
ALTER DATABASE $PROD_DB_NAME OWNER TO $PROD_DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $PROD_DB_NAME TO $PROD_DB_USER;
SQL
  AUTH_DATABASE_URL="postgresql://$PROD_DB_USER:$DB_PASS@127.0.0.1:5432/$PROD_DB_NAME"
fi

node --input-type=module - "$STAGING_ENV_FILE" "$PROD_ENV_FILE" "$AUTH_DATABASE_URL" "$PROD_URL" "$PROD_API_HOST" "$PROD_API_PORT" <<'NODE'
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";

const [stagingEnvFile, prodEnvFile, authDatabaseUrl, prodUrl, prodApiHost, prodApiPort] = process.argv.slice(2);
const readEnv = (filePath) => (existsSync(filePath) ? dotenv.parse(readFileSync(filePath)) : {});
const staging = readEnv(stagingEnvFile);
const existing = readEnv(prodEnvFile);
const pickKeys = [
  "ADSHORTS_SHARED_ENV_FILE",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "TELEGRAM_BOT_ID",
  "TELEGRAM_BOT_USERNAME",
  "TELEGRAM_BOT_TOKEN",
  "ADSFLOW_API_BASE_URL",
  "ADSFLOW_ADMIN_TOKEN",
  "PAYMENT_BASE_URL",
  "PAYMENT_LINK_START",
  "PAYMENT_LINK_PRO",
  "PAYMENT_LINK_ULTRA",
  "PAYMENT_LINK_PACKAGE_10",
  "PAYMENT_LINK_PACKAGE_50",
  "PAYMENT_LINK_PACKAGE_100",
  "DEAPI_API_KEY",
  "WAVESPEED_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_MAIN_MODEL",
  "OPENROUTER_FALLBACK_MODEL",
  "REDIS_URL",
  "FFMPEG_PATH",
  "DISABLE_BACKGROUND_WARMING",
  "UPSTREAM_BOOTSTRAP_TIMEOUT_MS",
  "UPSTREAM_PROJECTS_TIMEOUT_MS",
  "UPSTREAM_PROBE_TIMEOUT_MS",
  "UPSTREAM_PROXY_TIMEOUT_MS",
  "UPSTREAM_PLAYBACK_PREPARATION_TIMEOUT_MS",
];

const merged = {};
for (const key of pickKeys) {
  if (staging[key] != null) merged[key] = staging[key];
}
Object.assign(merged, existing);
Object.assign(merged, {
  NODE_ENV: "production",
  APP_URL: prodUrl,
  BETTER_AUTH_URL: prodUrl,
  AUTH_SERVER_HOST: prodApiHost,
  AUTH_SERVER_PORT: prodApiPort,
  AUTH_DATABASE_URL: existing.AUTH_DATABASE_URL?.trim() || authDatabaseUrl,
});

if (!merged.BETTER_AUTH_SECRET?.trim()) {
  merged.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
}

const orderedKeys = [
  "NODE_ENV",
  "APP_URL",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "AUTH_SERVER_HOST",
  "AUTH_SERVER_PORT",
  "AUTH_DATABASE_URL",
  ...pickKeys,
];
const seen = new Set();
const quote = (value) => {
  const text = String(value ?? "");
  if (!/[#\s"'\\$`]/.test(text)) return text;
  return JSON.stringify(text);
};
const lines = [];
for (const key of orderedKeys) {
  if (seen.has(key) || merged[key] == null) continue;
  seen.add(key);
  lines.push(`${key}=${quote(merged[key])}`);
}
for (const key of Object.keys(merged).sort()) {
  if (seen.has(key)) continue;
  lines.push(`${key}=${quote(merged[key])}`);
}
writeFileSync(prodEnvFile, `${lines.join("\n")}\n`, { mode: 0o600 });
NODE

chmod 600 "$PROD_ENV_FILE"

node --input-type=module - "$PROD_ENV_FILE" <<'NODE'
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import dotenv from "dotenv";

const prodEnvFile = process.argv[2];
const merged = dotenv.parse(readFileSync(prodEnvFile));
const required = [
  "NODE_ENV",
  "APP_URL",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "AUTH_SERVER_HOST",
  "AUTH_SERVER_PORT",
  "AUTH_DATABASE_URL",
];
const missing = required.filter((key) => !String(merged[key] ?? "").trim());
if (missing.length) {
  throw new Error(`Production .env missing required keys: ${missing.join(", ")}`);
}
if (merged.NODE_ENV !== "production") {
  throw new Error("Production .env must set NODE_ENV=production.");
}
if (merged.APP_URL !== "https://adshortsai.com" || merged.BETTER_AUTH_URL !== "https://adshortsai.com") {
  throw new Error("Production public URLs must point to https://adshortsai.com.");
}

const sharedEnv = String(merged.ADSHORTS_SHARED_ENV_FILE ?? "").trim();
if (sharedEnv) {
  const resolvedSharedEnv = isAbsolute(sharedEnv) ? sharedEnv : resolve(process.cwd(), sharedEnv);
  if (!existsSync(resolvedSharedEnv)) {
    throw new Error(`ADSHORTS_SHARED_ENV_FILE points to a missing file: ${resolvedSharedEnv}`);
  }
}
NODE

echo "[production] write systemd service"
sudo tee "/etc/systemd/system/$PROD_SERVICE.service" >/dev/null <<SERVICE
[Unit]
Description=AdShorts Production API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=aldima
WorkingDirectory=$PROD_APP_DIR
EnvironmentFile=$PROD_ENV_FILE
ExecStart=/usr/bin/node dist-server/server/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable "$PROD_SERVICE" >/dev/null
sudo systemctl restart "$PROD_SERVICE"

echo "[production] wait for local API"
api_health=""
service_state="unknown"
for _ in $(seq 1 30); do
  service_state="$(systemctl is-active "$PROD_SERVICE" || true)"
  if [ "$service_state" = "active" ] && api_health="$(curl -fsS "http://$PROD_API_HOST:$PROD_API_PORT/api/health" 2>/dev/null)"; then
    break
  fi
  sleep 1
done

if [ "$service_state" != "active" ] || [ -z "$api_health" ]; then
  echo "Production API did not become ready." >&2
  sudo journalctl -u "$PROD_SERVICE" -n 120 --no-pager >&2 || true
  exit 1
fi

echo "[production] update caddy"
CADDY_BACKUP="/etc/caddy/Caddyfile.bak.production-$(date +%Y%m%d%H%M%S)"
sudo cp /etc/caddy/Caddyfile "$CADDY_BACKUP"

sudo PROD_APP_DIR="$PROD_APP_DIR" PROD_STATIC_DIR="$PROD_STATIC_DIR" PROD_API_PORT="$PROD_API_PORT" python3 - <<'PY'
import os
from pathlib import Path

caddyfile = Path("/etc/caddy/Caddyfile")
source = caddyfile.read_text()
prod_app_dir = os.environ["PROD_APP_DIR"]
prod_static_dir = os.environ["PROD_STATIC_DIR"]
prod_api_port = os.environ["PROD_API_PORT"]

production_blocks = f"""https://adshortsai.com {{
    encode gzip zstd

    @acme path /.well-known/acme-challenge/*
    handle @acme {{
        root * /var/www/html
        file_server
    }}

    @app_assets path /background/* /google-g-logo.svg /assets/* /voice-previews/* /icons/* /ui/*
    @static_assets path /styles.css /script.js /favicon.svg /favicon.ico /favicon.png /favicon-*.png /logo.png /hero_image.png /hero_image.webp /background-aurora.svg /icons.svg /google-g-logo.svg /telegram-2019-logo.svg /hybrid.png /hybrid_icon.svg /og-image.svg /flags/* /1ru.mp4 /2ru.mp4 /3ru.mp4 /1en.mp4 /2en.mp4 /3en.mp4 /sample1.mp4 /sample1_original.mp4 /sample2.mp4 /sample2_original.mp4 /sample3.mp4 /sample3_original.mp4 /robots.txt /sitemap.xml /yandex_98ced54b6a337450.html /yandex_b95e4ede4fd42a24.html

    header @app_assets Cache-Control "public, max-age=31536000, immutable"
    header @static_assets Cache-Control "public, max-age=31536000, immutable"

    @html not path /background/* /google-g-logo.svg /assets/* /voice-previews/* /icons/* /ui/* /styles.css /script.js /favicon.svg /favicon.ico /favicon.png /favicon-*.png /logo.png /hero_image.png /hero_image.webp /background-aurora.svg /icons.svg /google-g-logo.svg /telegram-2019-logo.svg /hybrid.png /hybrid_icon.svg /og-image.svg /flags/* /1ru.mp4 /2ru.mp4 /3ru.mp4 /1en.mp4 /2en.mp4 /3en.mp4 /sample1.mp4 /sample1_original.mp4 /sample2.mp4 /sample2_original.mp4 /sample3.mp4 /sample3_original.mp4 /robots.txt /sitemap.xml /yandex_98ced54b6a337450.html /yandex_b95e4ede4fd42a24.html /api/* /.well-known/acme-challenge/*
    header @html Cache-Control "no-store, no-cache, must-revalidate, max-age=0"
    header @html Pragma "no-cache"
    header @html Expires "0"

    handle /api/* {{
        reverse_proxy 127.0.0.1:{prod_api_port}
    }}

    handle /background/* {{
        root * {prod_app_dir}/dist
        file_server
    }}

    handle @app_assets {{
        root * {prod_app_dir}/dist
        file_server
    }}

    handle @static_assets {{
        root * {prod_static_dir}
        file_server
    }}

    @app_routes path / /en /en/ /app* /en/app* /pricing* /en/pricing* /examples* /en/examples* /hero-background-test* /en/hero-background-test*
    handle @app_routes {{
        root * {prod_app_dir}/dist
        rewrite * /index.html
        file_server
    }}

    handle {{
        root * {prod_static_dir}
        try_files {{path}} {{path}}/index.html /404.html
        file_server
    }}
}}

https://www.adshortsai.com {{
    redir /privacy https://adshortsai.com/privacy/ 301
    redir /terms https://adshortsai.com/terms/ 301
    redir https://adshortsai.com{{uri}} 301
}}
"""

starts_to_replace = ("https://adshortsai.com", "https://www.adshortsai.com")
lines = source.splitlines(keepends=True)
out = []
i = 0
inserted = False

while i < len(lines):
    stripped = lines[i].strip()
    if any(stripped.startswith(start) and stripped.endswith("{") for start in starts_to_replace):
        if not inserted:
            out.append(production_blocks)
            inserted = True

        depth = lines[i].count("{") - lines[i].count("}")
        i += 1
        while i < len(lines) and depth > 0:
            depth += lines[i].count("{") - lines[i].count("}")
            i += 1
        while i < len(lines) and not lines[i].strip():
            i += 1
        continue

    out.append(lines[i])
    i += 1

if not inserted:
    marker = "\napi.adshortsai.com {"
    next_source = "".join(out)
    if marker not in next_source:
        raise SystemExit("Could not find insertion point for production adshortsai.com Caddy block.")
    next_source = next_source.replace(marker, "\n" + production_blocks + marker, 1)
else:
    next_source = "".join(out)

caddyfile.write_text(next_source)
PY

if ! sudo caddy validate --config /etc/caddy/Caddyfile >/tmp/adshorts-prod-caddy-validate.log 2>&1; then
  cat /tmp/adshorts-prod-caddy-validate.log >&2
  rollback_caddy "$CADDY_BACKUP"
  exit 1
fi

if ! sudo systemctl reload caddy; then
  rollback_caddy "$CADDY_BACKUP"
  exit 1
fi

echo "[production] smoke checks"
smoke_failed=0
check_status() {
  local url="$1"
  local expected="$2"
  local status
  status="$(curl -sS -o /dev/null -w "%{http_code}" "$url" || true)"
  if [ "$status" != "$expected" ]; then
    echo "Unexpected status for $url: $status (expected $expected)" >&2
    smoke_failed=1
  fi
}

check_status "$PROD_URL/api/health" "200"
check_status "$PROD_URL/" "200"
check_status "$PROD_URL/en/" "200"
check_status "$PROD_URL/pricing" "200"
check_status "$PROD_URL/examples" "200"
check_status "$PROD_URL/app" "200"
check_status "$PROD_URL/kak-sdelat-shorts-na-youtube/" "200"

www_status="$(curl -sS -o /dev/null -w "%{http_code}" https://www.adshortsai.com/ || true)"
www_effective="$(curl -sSL -o /dev/null -w "%{url_effective}" https://www.adshortsai.com/ || true)"
if [ "$www_status" != "301" ] || [ "$www_effective" != "$PROD_URL/" ]; then
  echo "Unexpected www redirect: status=$www_status effective=$www_effective" >&2
  smoke_failed=1
fi

staging_status="$(curl -sS -o /dev/null -w "%{http_code}" https://staging.adshortsai.com/ || true)"
if [ "$staging_status" != "401" ]; then
  echo "Staging is not Basic Auth protected: status=$staging_status" >&2
  smoke_failed=1
fi

if [ "$smoke_failed" -ne 0 ]; then
  rollback_caddy "$CADDY_BACKUP"
  sudo systemctl stop "$PROD_SERVICE" || true
  exit 1
fi

echo "caddy_backup=$CADDY_BACKUP"
echo "local_api_health=$api_health"
echo "production_url=$PROD_URL"
REMOTE

echo "[production] deployed: $PROD_URL"
