#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
MANIFEST_FILE="$ROOT_DIR/seo-redirects.json"
PROD_SSH="${PROD_SSH:-aldima@158.160.125.225}"
PROD_URL="${PROD_URL:-https://adshortsai.com}"
REMOTE_CADDYFILE="${REMOTE_CADDYFILE:-/etc/caddy/Caddyfile}"
DRY_RUN="${DRY_RUN:-1}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)

if [ ! -f "$MANIFEST_FILE" ]; then
  echo "Redirect manifest not found: $MANIFEST_FILE" >&2
  exit 1
fi

if [ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]; then
  echo "SEO redirect release requires a clean git worktree." >&2
  exit 1
fi

redirect_block="$(node --input-type=module - "$MANIFEST_FILE" <<'NODE'
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (manifest.deployAutomatically !== false) {
  throw new Error("Redirect manifest must require an explicit deployment");
}
if (!Array.isArray(manifest.redirects) || manifest.redirects.length === 0) {
  throw new Error("Redirect manifest is empty");
}

const sources = new Set();
for (const redirect of manifest.redirects) {
  const { url, target, statusCode } = redirect;
  if (typeof url !== "string" || !url.startsWith("/") || /[\s?#]/.test(url)) {
    throw new Error(`Invalid redirect source: ${String(url)}`);
  }
  if (typeof target !== "string" || !target.startsWith("/") || /[\s?#]/.test(target)) {
    throw new Error(`Invalid redirect target: ${String(target)}`);
  }
  if (url === target) throw new Error(`Self redirect: ${url}`);
  if (statusCode !== 301) throw new Error(`Only 301 redirects are allowed: ${url}`);
  if (sources.has(url)) throw new Error(`Duplicate redirect source: ${url}`);
  sources.add(url);
}

for (const { url, target } of manifest.redirects) {
  if (sources.has(target)) throw new Error(`Redirect chain is not allowed: ${url} -> ${target}`);
}

const lines = ["    # seo-redirects:start"];
for (const { url, target, statusCode } of manifest.redirects) {
  lines.push(`    redir ${url} ${target} ${statusCode}`);
}
lines.push("    # seo-redirects:end");
process.stdout.write(lines.join("\n"));
NODE
)"

redirect_count="$(node --input-type=module - "$MANIFEST_FILE" <<'NODE'
import { readFileSync } from "node:fs";
const manifest = JSON.parse(readFileSync(process.argv[2], "utf8"));
process.stdout.write(String(manifest.redirects.length));
NODE
)"

echo "[seo-redirects] validated $redirect_count redirects"
printf '%s\n' "$redirect_block"

if [ "$DRY_RUN" = "1" ]; then
  echo "[seo-redirects] dry run complete"
  exit 0
fi

if [ "${CONFIRM_SEO_REDIRECTS:-0}" != "1" ]; then
  echo "Set CONFIRM_SEO_REDIRECTS=1 for a real Caddy update." >&2
  exit 1
fi

block_b64="$(printf '%s\n' "$redirect_block" | base64 | tr -d '\n')"

echo "[seo-redirects] update production Caddy config"
remote_output="$(ssh "${SSH_OPTS[@]}" "$PROD_SSH" \
  "sudo bash -s -- '$REMOTE_CADDYFILE' '$block_b64'" <<'REMOTE'
set -euo pipefail

CADDYFILE="$1"
BLOCK_B64="$2"
BACKUP_FILE="${CADDYFILE}.bak.seo-redirects-$(date +%Y%m%d%H%M%S)"
changed=0

rollback() {
  if [ "$changed" = "1" ] && [ -f "$BACKUP_FILE" ]; then
    echo "[seo-redirects] rolling back Caddy config" >&2
    cp "$BACKUP_FILE" "$CADDYFILE"
    caddy validate --config "$CADDYFILE" >/dev/null 2>&1 || true
    systemctl reload caddy || true
  fi
}

on_error() {
  local exit_code=$?
  rollback
  exit "$exit_code"
}
trap on_error ERR

cp "$CADDYFILE" "$BACKUP_FILE"
changed=1

python3 - "$CADDYFILE" "$BLOCK_B64" <<'PY'
from base64 import b64decode
from pathlib import Path
import sys

caddyfile = Path(sys.argv[1])
redirect_block = b64decode(sys.argv[2]).decode("utf-8").rstrip("\n").splitlines(keepends=False)
lines = caddyfile.read_text(encoding="utf-8").splitlines(keepends=True)

site_start = next((index for index, line in enumerate(lines) if line.strip() == "https://adshortsai.com {"), None)
if site_start is None:
    raise SystemExit("adshortsai.com site block was not found")

site_end = next((index for index in range(site_start + 1, len(lines)) if lines[index].rstrip("\n") == "}"), None)
if site_end is None:
    raise SystemExit("adshortsai.com site block is not closed")

start_marker = "    # seo-redirects:start"
end_marker = "    # seo-redirects:end"
marker_start = next((index for index in range(site_start + 1, site_end) if lines[index].rstrip("\n") == start_marker), None)
marker_end = next((index for index in range(site_start + 1, site_end) if lines[index].rstrip("\n") == end_marker), None)

replacement = [f"{line}\n" for line in redirect_block]
if marker_start is not None or marker_end is not None:
    if marker_start is None or marker_end is None or marker_start >= marker_end:
        raise SystemExit("SEO redirect markers are incomplete")
    lines[marker_start : marker_end + 1] = replacement
else:
    insert_at = next(
        (index for index in range(site_start + 1, site_end) if lines[index].startswith("    redir ")),
        site_end,
    )
    lines[insert_at:insert_at] = replacement + ["\n"]

caddyfile.write_text("".join(lines), encoding="utf-8")
PY

caddy validate --config "$CADDYFILE" >/tmp/adshorts-seo-redirects-caddy-validate.log 2>&1
systemctl reload caddy
trap - ERR
echo "BACKUP_FILE=$BACKUP_FILE"
REMOTE
)"

backup_file="$(printf '%s\n' "$remote_output" | sed -n 's/^BACKUP_FILE=//p' | tail -n 1)"
if [ -z "$backup_file" ]; then
  echo "Production update did not report a Caddy backup." >&2
  exit 1
fi

rollback_remote() {
  echo "[seo-redirects] production smoke check failed; restoring $backup_file" >&2
  ssh "${SSH_OPTS[@]}" "$PROD_SSH" \
    "sudo cp '$backup_file' '$REMOTE_CADDYFILE' && sudo caddy validate --config '$REMOTE_CADDYFILE' && sudo systemctl reload caddy"
}

smoke_failed=0
while IFS=$'\t' read -r source target; do
  result="$(curl -sS -o /dev/null -w $'%{http_code}\t%{redirect_url}' "$PROD_URL$source")"
  code="${result%%$'\t'*}"
  location="${result#*$'\t'}"
  expected_location="$PROD_URL$target"
  target_code="$(curl -sS -o /dev/null -w '%{http_code}' "$expected_location")"
  if [ "$code" != "301" ] || { [ "$location" != "$target" ] && [ "$location" != "$expected_location" ]; } || [ "$target_code" != "200" ]; then
    echo "Redirect check failed: $source code=$code location=$location target_code=$target_code" >&2
    smoke_failed=1
  fi
done < <(node --input-type=module - "$MANIFEST_FILE" <<'NODE'
import { readFileSync } from "node:fs";
const manifest = JSON.parse(readFileSync(process.argv[2], "utf8"));
for (const { url, target } of manifest.redirects) process.stdout.write(`${url}\t${target}\n`);
NODE
)

for route in / /pricing/ /examples/; do
  route_html="$(curl -fsS "$PROD_URL$route")" || smoke_failed=1
  if [[ "$route_html" != *'<div id="app">'* ]]; then
    echo "React shell check failed: $route" >&2
    smoke_failed=1
  fi
done

local_sitemap_count="$(grep -c '<loc>' "$ROOT_DIR/sitemap.xml")"
remote_sitemap_count="$(curl -fsS "$PROD_URL/sitemap.xml" | grep -c '<loc>')" || smoke_failed=1
if [ "$remote_sitemap_count" != "$local_sitemap_count" ]; then
  echo "Sitemap check failed: production=$remote_sitemap_count expected=$local_sitemap_count" >&2
  smoke_failed=1
fi

if [ "$smoke_failed" = "1" ]; then
  rollback_remote
  exit 1
fi

echo "[seo-redirects] deployed $redirect_count redirects; backup: $backup_file"
