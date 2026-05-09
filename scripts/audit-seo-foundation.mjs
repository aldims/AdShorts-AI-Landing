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

const legalPages = [
  "privacy/index.html",
  "terms/index.html",
  "terms-of-use/index.html",
  "data-deletion.html",
  "en/privacy/index.html",
  "en/terms/index.html",
  "en/terms-of-use/index.html",
  "en/data-deletion/index.html",
  "offer/index.html",
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

for (const pagePath of legalPages) {
  const html = await readRootFile(pagePath);
  assert(/<meta\s+name="robots"\s+content="index, follow"/i.test(html), `${pagePath}: legal trust page should be indexable`);
  assert(!/history\.replaceState\(null,\s*null,\s*window\.location\.pathname\.slice\(0,\s*-1\)/.test(html), `${pagePath}: must not rewrite canonical trailing slash in the browser`);
  assert(!/href="\.\/(?:examples|pricing)"/.test(html), `${pagePath}: internal pricing/examples links should use trailing slash`);
}

const appShell = await readRootFile("app/index.html");
assert(!/app staging/i.test(appShell), "app/index.html: contains staging description");
assert(/<meta name="robots" content="index, follow"/i.test(appShell), "app/index.html: public app shell should be indexable");
assert(/<link rel="canonical" href="https:\/\/adshortsai\.com\/"/i.test(appShell), "app/index.html: public app shell should canonicalize to the landing page");
assert(/YouTube Shorts, Reels и TikTok за минуту/i.test(appShell), "app/index.html: root app shell should use landing SEO description");

const appPackage = JSON.parse(await readRootFile("app/package.json"));
assert(
  String(appPackage.scripts?.build ?? "").includes("generate-app-route-shells.mjs"),
  "app/package.json: build must generate per-route app shells",
);

const builtAppRouteShells = [
  ["app/dist/index.html", `${siteOrigin}/`],
  ["app/dist/en/index.html", `${siteOrigin}/en/`],
  ["app/dist/pricing/index.html", `${siteOrigin}/pricing/`],
  ["app/dist/en/pricing/index.html", `${siteOrigin}/en/pricing/`],
  ["app/dist/examples/index.html", `${siteOrigin}/examples/`],
  ["app/dist/en/examples/index.html", `${siteOrigin}/en/examples/`],
];
if (await exists("app/dist/index.html")) {
  for (const [routeShellPath, canonical] of builtAppRouteShells) {
    const html = await readRootFile(routeShellPath);
    assert(/<div id="app">/i.test(html), `${routeShellPath}: missing React app root`);
    assert(/data-seo-fallback="true"/i.test(html), `${routeShellPath}: missing SEO fallback content`);
    assert(/<h1[\s>]/i.test(html), `${routeShellPath}: missing fallback H1`);
    assert(
      new RegExp(`<link\\s+rel="canonical"\\s+href="${canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*/?>`, "i").test(html),
      `${routeShellPath}: wrong canonical`,
    );
    assert(/<meta\s+name="description"\s+content="[^"]{50,}"/i.test(html), `${routeShellPath}: missing route description`);
    assert(/<title>[^<]{20,}<\/title>/i.test(html), `${routeShellPath}: missing route title`);
  }
}

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
  `${siteOrigin}/privacy/`,
  `${siteOrigin}/en/privacy/`,
  `${siteOrigin}/terms/`,
  `${siteOrigin}/en/terms/`,
  `${siteOrigin}/terms-of-use/`,
  `${siteOrigin}/en/terms-of-use/`,
  `${siteOrigin}/data-deletion.html`,
  `${siteOrigin}/en/data-deletion/`,
  `${siteOrigin}/offer/`,
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
  /@app_routes path \/ \/en\/ \/app\* \/en\/app\* \/pricing\/ \/en\/pricing\/ \/examples\/ \/en\/examples\/ \/hero-background-test \/en\/hero-background-test/.test(deployProduction),
  "deploy-production.sh: public landing, pricing, examples, and app routes must use the React app shell",
);
assert(/header @app_html X-Robots-Tag "noindex, nofollow"/.test(deployProduction), "deploy-production.sh: app shell routes must send X-Robots-Tag noindex");
assert(/redir \/index\.html \/ 301/.test(deployProduction), "deploy-production.sh: missing /index.html canonical redirect");
assert(/redir \/en\/index\.html \/en\/ 301/.test(deployProduction), "deploy-production.sh: missing /en/index.html canonical redirect");
assert(/redir \/pricing \/pricing\/ 301/.test(deployProduction), "deploy-production.sh: missing /pricing trailing-slash redirect");
assert(/redir \/examples \/examples\/ 301/.test(deployProduction), "deploy-production.sh: missing /examples trailing-slash redirect");
assert(/redir \/index\.html https:\/\/adshortsai\.com\/ 301/.test(deployProduction), "deploy-production.sh: missing direct www /index.html redirect");
assert(/redir \/terms\.html https:\/\/adshortsai\.com\/terms\/ 301/.test(deployProduction), "deploy-production.sh: missing direct www /terms.html redirect");
assert(/try_files \{\{path\}\} \{\{path\}\}\/index\.html \/index\.html/.test(deployProduction), "deploy-production.sh: app routes must prefer generated route shells");
assert(/try_files \{\{path\}\} \{\{path\}\}\/index\.html =404/.test(deployProduction), "deploy-production.sh: static fallback should return real 404");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`SEO foundation audit passed for ${criticalPages.length} critical pages and ${sitemapUrls.length} sitemap URLs.`);
