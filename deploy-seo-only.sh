#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
RELEASE_DIR="$ROOT_DIR/.codex-tmp/seo-only-release"
PROD_SSH="${PROD_SSH:-aldima@158.160.125.225}"
PROD_STATIC_DIR="${PROD_STATIC_DIR:-/home/aldima/AdShorts-AI-production-static}"
PROD_URL="${PROD_URL:-https://adshortsai.com}"
DRY_RUN="${DRY_RUN:-1}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)

if [ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]; then
  echo "SEO release requires a clean git worktree." >&2
  exit 1
fi

echo "[seo-only] regenerate and verify"
cd "$ROOT_DIR"
node scripts/generate-static-landing.mjs
node scripts/generate-static-bofu-pages.mjs
node scripts/seo-commercial-growth-sprint.mjs
node scripts/seo-organic-growth-sprint.mjs
node scripts/seo-yandex-growth-sprint.mjs
node scripts/generate-static-press-pages.mjs
node scripts/generate-static-contact-pages.mjs
node scripts/update-static-language-switchers.mjs
node scripts/generate-static-landing.mjs --check
node scripts/check-static-i18n.mjs
node scripts/normalize-seo-structured-data.mjs
node scripts/apply-seo-index-policy.mjs
node scripts/export-seo-url-metadata.mjs
node scripts/analyze-seo-exports.test.mjs
node scripts/audit-seo-foundation.mjs

if [ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]; then
  echo "Generated SEO files differ from the committed release. Commit them before upload." >&2
  git -C "$ROOT_DIR" status --short >&2
  exit 1
fi

rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

rsync -a --prune-empty-dirs \
  --exclude='.git/' \
  --exclude='.codex-tmp/' \
  --exclude='app/' \
  --exclude='scripts/' \
  --exclude='seo-external-layer/' \
  --exclude='node_modules/' \
  --exclude='logs/' \
  --exclude='tmp/' \
  --include='*/' \
  --include='*.html' \
  --include='*.css' \
  --include='*.js' \
  --include='*.svg' \
  --include='*.png' \
  --include='*.webp' \
  --include='*.mp4' \
  --include='*.ico' \
  --include='robots.txt' \
  --include='sitemap.xml' \
  --exclude='*' \
  "$ROOT_DIR/" "$RELEASE_DIR/"

local_url_count="$(grep -c '<loc>' "$RELEASE_DIR/sitemap.xml")"
if [ "$local_url_count" -lt 80 ] || [ "$local_url_count" -gt 110 ]; then
  echo "Unexpected sitemap URL count: $local_url_count" >&2
  exit 1
fi

if [ "$DRY_RUN" = "1" ]; then
  file_count="$(find "$RELEASE_DIR" -type f | wc -l | tr -d ' ')"
  total_size="$(du -sh "$RELEASE_DIR" | awk '{print $1}')"
  echo "[seo-only] dry run complete: $file_count files, $total_size, $local_url_count sitemap URLs"
  exit 0
fi

if [ "${CONFIRM_SEO_DEPLOY:-0}" != "1" ]; then
  echo "Set CONFIRM_SEO_DEPLOY=1 for a real SEO upload." >&2
  exit 1
fi

ssh "${SSH_OPTS[@]}" "$PROD_SSH" "mkdir -p '$PROD_STATIC_DIR'"
rsync -az --itemize-changes "$RELEASE_DIR/" "$PROD_SSH:$PROD_STATIC_DIR/"

echo "[seo-only] production checks"
remote_sitemap="$(curl -fsS "$PROD_URL/sitemap.xml")"
remote_url_count="$(printf '%s' "$remote_sitemap" | grep -c '<loc>')"
if [ "$remote_url_count" != "$local_url_count" ]; then
  echo "Unexpected production sitemap count: $remote_url_count (expected $local_url_count)" >&2
  exit 1
fi

calculator_status="$(curl -sS -o /dev/null -w '%{http_code}' "$PROD_URL/kalkulyator-stoimosti-shorts/")"
generator_status="$(curl -sS -o /dev/null -w '%{http_code}' "$PROD_URL/generator-youtube-shorts/")"
weak_page_html="$(curl -fsS "$PROD_URL/shorts-malo-laykov/")"
if [ "$calculator_status" != "200" ] || [ "$generator_status" != "200" ]; then
  echo "SEO page checks failed: calculator=$calculator_status generator=$generator_status" >&2
  exit 1
fi
if [[ "$weak_page_html" != *'name="robots" content="noindex, follow"'* ]]; then
  echo "Noindex page check failed." >&2
  exit 1
fi

echo "[seo-only] uploaded: $remote_url_count sitemap URLs"
