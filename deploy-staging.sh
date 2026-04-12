#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
APP_DIR="$ROOT_DIR/app"
LOCAL_EXAMPLES_DIR="$APP_DIR/data/local-examples"

STAGING_SSH="${STAGING_SSH:-aldima@158.160.125.225}"
STAGING_APP_DIR="${STAGING_APP_DIR:-/home/aldima/AdShorts-AI-staging/app}"
STAGING_SERVICE="${STAGING_SERVICE:-adshorts-staging-api}"
STAGING_URL="${STAGING_URL:-https://staging.adshortsai.com}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)

if [ ! -d "$APP_DIR" ]; then
  echo "App directory not found: $APP_DIR" >&2
  exit 1
fi

echo "[staging] build"
cd "$APP_DIR"
npm run build

if [ "${RUN_TESTS:-0}" = "1" ]; then
  echo "[staging] tests"
  npm test
fi

echo "[staging] upload frontend"
rsync -az --delete "$APP_DIR/dist/" "$STAGING_SSH:$STAGING_APP_DIR/dist/"

echo "[staging] upload server"
rsync -az --delete "$APP_DIR/dist-server/" "$STAGING_SSH:$STAGING_APP_DIR/dist-server/"

echo "[staging] sync local examples"
mkdir -p "$LOCAL_EXAMPLES_DIR"
rsync -az --delete "$LOCAL_EXAMPLES_DIR/" "$STAGING_SSH:$STAGING_APP_DIR/data/local-examples/"

echo "[staging] validate OpenRouter config, restart and verify"
ssh "${SSH_OPTS[@]}" "$STAGING_SSH" \
  "STAGING_APP_DIR='$STAGING_APP_DIR' STAGING_SERVICE='$STAGING_SERVICE' STAGING_URL='$STAGING_URL' bash -s" <<'REMOTE'
set -euo pipefail

cd "$STAGING_APP_DIR"

node --input-type=module <<'NODE'
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import dotenv from "dotenv";

const appDir = process.env.STAGING_APP_DIR;
if (!appDir) {
  throw new Error("STAGING_APP_DIR is not set.");
}

const mergedEnv = {};
const mergeEnvFile = (filePath) => {
  Object.assign(mergedEnv, dotenv.parse(readFileSync(filePath)));
};

const appEnvFile = resolve(appDir, ".env");
if (existsSync(appEnvFile)) {
  mergeEnvFile(appEnvFile);
}

const sharedEnvFile = String(mergedEnv.ADSHORTS_SHARED_ENV_FILE ?? "").trim();
if (sharedEnvFile) {
  const resolvedSharedEnvFile = isAbsolute(sharedEnvFile) ? sharedEnvFile : resolve(appDir, sharedEnvFile);
  if (!existsSync(resolvedSharedEnvFile)) {
    throw new Error(`ADSHORTS_SHARED_ENV_FILE points to a missing file: ${resolvedSharedEnvFile}`);
  }

  mergeEnvFile(resolvedSharedEnvFile);
}

if (!String(mergedEnv.OPENROUTER_API_KEY ?? "").trim()) {
  throw new Error(
    `Missing OPENROUTER_API_KEY for staging backend. Set it in ${appEnvFile} or point ADSHORTS_SHARED_ENV_FILE to a shared secrets file.`,
  );
}
NODE

sudo systemctl restart "$STAGING_SERVICE"
sleep 2

service_state="$(systemctl is-active "$STAGING_SERVICE")"
if [ "$service_state" != "active" ]; then
  echo "Service is not active: $service_state" >&2
  sudo journalctl -u "$STAGING_SERVICE" -n 80 --no-pager >&2
  exit 1
fi

api_health="$(curl -fsS http://127.0.0.1:4275/api/health)"
public_status="$(curl -sS -o /dev/null -w "%{http_code}" "$STAGING_URL/")"

if [ "$public_status" != "200" ] && [ "$public_status" != "401" ]; then
  echo "Unexpected public status from $STAGING_URL/: $public_status" >&2
  exit 1
fi

echo "service=$service_state"
echo "local_api_health=$api_health"
echo "public_status=$public_status"
REMOTE

echo "[staging] deployed: $STAGING_URL"
