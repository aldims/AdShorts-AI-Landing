#!/usr/bin/env node
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readRootFile = (relativePath) => readFile(path.join(rootDir, relativePath), "utf8");
const policy = JSON.parse(await readRootFile("seo-index-policy.json"));
const siteOrigin = policy.siteOrigin.replace(/\/$/, "");
const indexPaths = new Set(policy.index.map((entry) => entry.url));
const redirects = new Map(policy.redirect.map((entry) => [entry.url, entry.target]));
const demandRecoveryPaths = [
  "/shorts-ne-prohodyat-moderaciyu/",
  "/shorts-nizkoe-kachestvo-video/",
  "/gromkost-golosa-i-muzyki-v-shorts/",
  "/ozvuchka-dlya-shorts-kak-vybrat-golos/",
];
const errors = [];

const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

const normalizePath = (value) => {
  const parsed = new URL(value, `${siteOrigin}/`);
  return parsed.pathname === "/data-deletion.html" ? parsed.pathname : parsed.pathname.replace(/\/?$/, "/");
};

const localPathFor = (pathname) => {
  if (pathname === "/") return "index.html";
  if (pathname === "/data-deletion.html") return "data-deletion.html";
  return `${pathname.slice(1)}index.html`;
};

const exists = async (relativePath) => {
  try {
    await access(path.join(rootDir, relativePath));
    return true;
  } catch {
    return false;
  }
};

const stripHtml = (html) => html
  .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/\s+/g, " ")
  .trim();

const sitemap = await readRootFile("sitemap.xml");
const sitemapUrls = [...sitemap.matchAll(/<loc>(https:\/\/adshortsai\.com\/[^<]*)<\/loc>/g)].map((match) => match[1]);
const sitemapPaths = new Set(sitemapUrls.map(normalizePath));

assert(sitemapUrls.length >= 80 && sitemapUrls.length <= 110, `sitemap.xml: expected 80-110 URLs, got ${sitemapUrls.length}`);
assert(sitemapUrls.length === sitemapPaths.size, "sitemap.xml: duplicate URLs found");
assert(indexPaths.size === policy.index.length, "seo-index-policy.json: duplicate index URLs found");
assert(redirects.size === policy.redirect.length, "seo-index-policy.json: duplicate redirect URLs found");

for (const pathname of indexPaths) {
  assert(sitemapPaths.has(pathname), `sitemap.xml: missing index URL ${pathname}`);
  assert(await exists(localPathFor(pathname)), `seo-index-policy.json: missing local page ${pathname}`);
}

for (const pathname of sitemapPaths) {
  assert(indexPaths.has(pathname), `sitemap.xml: contains non-index URL ${pathname}`);
}

for (const pathname of demandRecoveryPaths) {
  assert(indexPaths.has(pathname), `seo-index-policy.json: confirmed-demand URL must be index ${pathname}`);
}

for (const [source, target] of redirects) {
  assert(!indexPaths.has(source), `seo-index-policy.json: redirect source is also index ${source}`);
  assert(indexPaths.has(target), `seo-index-policy.json: redirect target is not index ${source} -> ${target}`);
  assert(!redirects.has(target), `seo-index-policy.json: redirect chain ${source} -> ${target}`);
  assert(!sitemapPaths.has(source), `sitemap.xml: contains redirect source ${source}`);
}

const forbiddenVisibleText = [
  /Google\s+(?:is slower to index|медленнее индексирует)/i,
  /production[- ]workflow/i,
  /production[- ]тест/i,
  /(?:search intent|поисков(?:ый|ому) интент)/i,
  /(?:crawlable )?topic cluster/i,
  /SEO-кластер/i,
  /контент-пиллар/i,
];

for (const pathname of indexPaths) {
  const relativePath = localPathFor(pathname);
  const html = await readRootFile(relativePath);
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
  const robots = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i)?.[1];
  const titles = html.match(/<title\b[^>]*>[\s\S]*?<\/title>/gi) ?? [];
  const h1s = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) ?? [];
  const visibleText = stripHtml(html);

  assert(robots && /^index,\s*follow$/i.test(robots), `${relativePath}: index URL must use index, follow`);
  assert(canonical === `${siteOrigin}${pathname}`, `${relativePath}: canonical must be self-referencing`);
  assert(titles.length === 1, `${relativePath}: expected exactly one title, got ${titles.length}`);
  assert(h1s.length === 1, `${relativePath}: expected exactly one H1, got ${h1s.length}`);
  assert(!/"@type"\s*:\s*"FAQPage"/i.test(html), `${relativePath}: template FAQPage JSON-LD is not allowed`);
  assert(!/"aggregateRating"\s*:/i.test(html), `${relativePath}: unverified aggregateRating is not allowed`);
  assert(!/<!-- seo-(?:index-boost|action-plan):start -->/i.test(html), `${relativePath}: deprecated SEO block is not allowed`);

  for (const pattern of forbiddenVisibleText) {
    assert(!pattern.test(visibleText), `${relativePath}: forbidden internal SEO copy matches ${pattern}`);
  }

  if (!pathname.startsWith("/en/")) {
    assert(!/"priceCurrency"\s*:\s*"USD"/i.test(html), `${relativePath}: Russian schema must not contain USD`);
  }

  const hreflangs = [...html.matchAll(/<link\s+rel=["']alternate["']\s+hreflang=["']([^"']+)["']\s+href=["']([^"']+)["']/gi)];
  for (const [, locale, href] of hreflangs) {
    const alternate = normalizePath(href);
    assert(indexPaths.has(alternate), `${relativePath}: hreflang ${locale} points to non-index URL ${alternate}`);
  }

  const jsonLdBlocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
  for (const [, source] of jsonLdBlocks) {
    try {
      JSON.parse(source);
    } catch (error) {
      errors.push(`${relativePath}: invalid JSON-LD (${error.message})`);
    }
  }
}

const excludedDirs = new Set([".git", ".codex-tmp", "app", "node_modules", "seo-external-layer", "tmp", "logs"]);
const staticHtml = [];
const walk = async (dir) => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirs.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else if (entry.name === "index.html" || absolute === path.join(rootDir, "data-deletion.html")) staticHtml.push(absolute);
  }
};
await walk(rootDir);

for (const absolute of staticHtml) {
  const html = await readFile(absolute, "utf8");
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
  if (!canonical || !canonical.startsWith(siteOrigin)) continue;
  const pathname = normalizePath(canonical);
  if (indexPaths.has(pathname)) continue;
  assert(/<meta\s+name=["']robots["']\s+content=["']noindex,\s*follow["']/i.test(html), `${path.relative(rootDir, absolute)}: non-index URL must use noindex, follow`);
  assert(!sitemapPaths.has(pathname), `${path.relative(rootDir, absolute)}: noindex URL found in sitemap`);
}

for (const hubPath of policy.hubs) {
  const hubHtml = await readRootFile(localPathFor(hubPath));
  const hubUrl = `${siteOrigin}${hubPath}`;
  for (const [, href] of hubHtml.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    const resolved = new URL(href, hubUrl);
    if (resolved.origin !== siteOrigin || resolved.pathname.startsWith("/app")) continue;
    const target = normalizePath(resolved.pathname);
    assert(indexPaths.has(target), `${localPathFor(hubPath)}: hub links to non-index URL ${target}`);
  }
}

const ruGuidesHtml = await readRootFile("shorts-guides/index.html");
for (const pathname of demandRecoveryPaths) {
  assert(
    ruGuidesHtml.includes(`href="..${pathname}"`),
    `shorts-guides/index.html: missing confirmed-demand link ${pathname}`,
  );
}

const metadata = JSON.parse(await readRootFile("seo-url-metadata.json"));
assert(Array.isArray(metadata.urls), "seo-url-metadata.json: missing urls array");
assert(metadata.urls.length === sitemapUrls.length, "seo-url-metadata.json: URL count must match sitemap");

const redirectManifest = JSON.parse(await readRootFile("seo-redirects.json"));
assert(redirectManifest.deployAutomatically === false, "seo-redirects.json: redirects must require separate approval");
assert(redirectManifest.redirects.length === policy.redirect.length, "seo-redirects.json: redirect count must match policy");

const calculatorHtml = await readRootFile("kalkulyator-stoimosti-shorts/index.html");
const calculatorJs = await readRootFile("kalkulyator-stoimosti-shorts/calculator.js");
const calculatorCss = await readRootFile("kalkulyator-stoimosti-shorts/calculator.css");
assert(/<title>Сколько стоит монтаж Shorts:/i.test(calculatorHtml), "calculator: title must answer the validated price query");
for (const id of ["shorts-calculator", "manual-time", "manual-cost", "ai-time", "ai-cost", "manual-unit-cost", "ai-unit-cost", "saved-percent", "reset-calculator", "share-result"]) {
  assert(new RegExp(`id=["']${id}["']`).test(calculatorHtml), `calculator: missing #${id}`);
}
assert(/calculator\.css\?v=\d+/.test(calculatorHtml), "calculator: dedicated responsive styles are missing");
assert(/@media \(max-width: 520px\)/.test(calculatorCss), "calculator: mobile layout is missing");
assert(/new URLSearchParams\(window\.location\.search\)/.test(calculatorJs), "calculator: shared URL state is missing");
assert(/window\.history\.replaceState/.test(calculatorJs), "calculator: URL result update is missing");
assert(!/\b(?:fetch|XMLHttpRequest)\b/.test(calculatorJs), "calculator: calculation must remain client-side without data submission");

const baseline = JSON.parse(await readRootFile("seo-measurement-baseline.json"));
assert(baseline.baselineDate === "2026-07-10", "seo-measurement-baseline.json: baseline date must remain fixed");
assert(baseline.marketPriority === "ru" && baseline.productSurface === "web", "seo-measurement-baseline.json: market and product scope mismatch");
assert(baseline.googleSearchConsole?.clicks === 213, "seo-measurement-baseline.json: GSC baseline mismatch");
assert(baseline.yandexWebmaster?.clicks === 210, "seo-measurement-baseline.json: Yandex baseline mismatch");
assert(await exists("scripts/analyze-seo-exports.mjs"), "SEO export analyzer is missing");
assert(await exists("scripts/analyze-seo-exports.test.mjs"), "SEO export analyzer tests are missing");
assert(await exists("scripts/crawl-seo-pages.mjs"), "SEO HTTP crawler is missing");

const seoDeploy = await readRootFile("deploy-seo-only.sh").catch(() => "");
if (seoDeploy) {
  assert(!/(systemctl|caddy|backend|worker|app\/dist)/i.test(seoDeploy), "deploy-seo-only.sh: must not touch Caddy, services, backend, workers or React build");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`SEO policy audit passed for ${sitemapUrls.length} index URLs, ${redirects.size} redirects and ${staticHtml.length - indexPaths.size} noindex pages.`);
