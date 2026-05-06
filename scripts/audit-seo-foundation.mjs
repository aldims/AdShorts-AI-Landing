#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteOrigin = "https://adshortsai.com";

const errors = [];

const readRootFile = (relativePath) => readFile(path.join(rootDir, relativePath), "utf8");

const exists = async (relativePath) => {
  try {
    await access(path.join(rootDir, relativePath));
    return true;
  } catch {
    return false;
  }
};

const urlToLocalIndex = (url) => {
  const parsed = new URL(url);
  if (parsed.origin !== siteOrigin) return null;
  if (parsed.pathname === "/") return "index.html";
  if (parsed.pathname.endsWith("/")) return `${parsed.pathname.slice(1)}index.html`;
  return parsed.pathname.slice(1);
};

const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

const criticalPages = [
  "index.html",
  "en/index.html",
  "pricing/index.html",
  "en/pricing/index.html",
  "examples/index.html",
  "en/examples/index.html",
  "shorts-guides/index.html",
  "shorts-ne-nabirayut-prosmotry/index.html",
];

for (const pagePath of criticalPages) {
  const html = await readRootFile(pagePath);
  assert(/<title>[^<]{20,}<\/title>/i.test(html), `${pagePath}: missing useful title`);
  assert(/<meta\s+name="description"\s+content="[^"]{50,}"/i.test(html), `${pagePath}: missing useful description`);
  assert(/<link\s+rel="canonical"\s+href="https:\/\/adshortsai\.com\/[^"]*"/i.test(html), `${pagePath}: missing canonical`);
  assert(/<h1[\s>]/i.test(html), `${pagePath}: missing H1 in static HTML`);
  assert(!/<div id="app"><\/div>/i.test(html), `${pagePath}: serves only SPA shell`);
  assert(!/AdShorts AI App|app staging/i.test(html), `${pagePath}: contains staging app copy`);
}

const appShell = await readRootFile("app/index.html");
assert(!/app staging/i.test(appShell), "app/index.html: contains staging description");
assert(/<meta name="robots" content="noindex, nofollow"/i.test(appShell), "app/index.html: app shell should be noindex");

const sitemap = await readRootFile("sitemap.xml");
const sitemapUrls = [...sitemap.matchAll(/<loc>(https:\/\/adshortsai\.com\/[^<]*)<\/loc>/g)].map((match) => match[1]);
for (const requiredUrl of [
  `${siteOrigin}/`,
  `${siteOrigin}/en/`,
  `${siteOrigin}/pricing/`,
  `${siteOrigin}/en/pricing/`,
  `${siteOrigin}/examples/`,
  `${siteOrigin}/en/examples/`,
  `${siteOrigin}/shorts-guides/`,
]) {
  assert(sitemapUrls.includes(requiredUrl), `sitemap.xml: missing ${requiredUrl}`);
}

for (const url of sitemapUrls) {
  const localPath = urlToLocalIndex(url);
  if (!localPath) continue;
  assert(await exists(localPath), `sitemap.xml: ${url} points to missing ${localPath}`);
}

const metadata = JSON.parse(await readRootFile("seo-url-metadata.json"));
assert(Array.isArray(metadata.urls), "seo-url-metadata.json: missing urls array");
assert(metadata.urls.length === sitemapUrls.length, "seo-url-metadata.json: URL count must match sitemap");
for (const url of sitemapUrls) {
  const record = metadata.urls.find((entry) => entry.url === url);
  assert(record, `seo-url-metadata.json: missing ${url}`);
  if (record) {
    assert(record.canonical && record.target_query && record.intent && record.cluster && record.cta_source, `seo-url-metadata.json: incomplete record for ${url}`);
  }
}

const deployProduction = await readRootFile("deploy-production.sh");
assert(
  /@app_routes path \/app\* \/en\/app\*/.test(deployProduction),
  "deploy-production.sh: app routes must be limited to app surfaces",
);
assert(
  !/@app_routes path[^\n]*(?: \/ |\/pricing\*|\/examples\*)/.test(deployProduction),
  "deploy-production.sh: SEO pages are still routed to the SPA app shell",
);
assert(/try_files \{\{path\}\} \{\{path\}\}\/index\.html =404/.test(deployProduction), "deploy-production.sh: static fallback should return real 404");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`SEO foundation audit passed for ${criticalPages.length} critical pages and ${sitemapUrls.length} sitemap URLs.`);
