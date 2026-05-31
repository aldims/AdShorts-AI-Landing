#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteOrigin = "https://adshortsai.com";
const organicSprintLastmod = "2026-05-31";
const commercialGrowthLastmod = "2026-05-31";

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
  "press/index.html",
  "en/press/index.html",
  "shorts-guides/index.html",
  "shorts-ne-nabirayut-prosmotry/index.html",
];

const organicSprintPages = [
  "en/faceless-youtube-shorts/index.html",
  "en/youtube-shorts-swipe-away-rate/index.html",
  "shorts-chernye-polosy/index.html",
  "en/youtube-shorts-for-lawyers/index.html",
  "kak-ubrat-tryasku-v-shorts/index.html",
  "shorts-ne-nabirayut-prosmotry/index.html",
  "shorts-dlya-kliniki/index.html",
  "kak-chasto-vykladyvat-shorts/index.html",
  "en/how-to-create-a-hook-in-shorts/index.html",
  "en/keywords-for-youtube-shorts/index.html",
  "analitika-youtube-shorts-kak-chitat/index.html",
  "bitreyt-dlya-shorts/index.html",
  "cta-v-shorts/index.html",
  "en/cta-in-youtube-shorts/index.html",
  "en/do-hashtags-work-for-youtube-shorts/index.html",
  "en/how-much-does-shorts-editing-cost/index.html",
  "en/how-to-add-a-link-in-shorts/index.html",
  "en/how-to-add-a-mid-video-twist-in-shorts/index.html",
  "en/how-to-analyze-retention-in-shorts/index.html",
  "en/low-retention-on-youtube-shorts/index.html",
  "en/youtube-shorts-getting-0-views/index.html",
  "en/youtube-shorts-wont-upload/index.html",
  "en/how-to-increase-retention-in-shorts/index.html",
  "en/youtube-shorts-not-showing-on-channel/index.html",
  "en/youtube-shorts-description-what-to-write/index.html",
  "en/youtube-shorts-from-photos/index.html",
  "en/how-to-upload-youtube-shorts/index.html",
  "en/youtube-shorts-not-converting-to-subscribers/index.html",
  "en/youtube-shorts-no-sound/index.html",
  "en/youtube-shorts-black-bars/index.html",
  "en/youtube-shorts-not-getting-views/index.html",
  "en/youtube-shorts-resolution/index.html",
  "en/copyright-free-music-for-shorts/index.html",
  "en/youtube-shorts-copyright/index.html",
  "en/background-for-youtube-shorts/index.html",
  "en/how-often-to-post-youtube-shorts/index.html",
  "en/ctr-in-youtube-shorts/index.html",
  "razreshenie-dlya-shorts/index.html",
  "nizkoe-uderzhanie-v-youtube-shorts/index.html",
  "monetizaciya-youtube-shorts/index.html",
  "avtorskie-prava-v-shorts/index.html",
  "opisanie-dlya-shorts-chto-pisat/index.html",
  "shorts-iz-foto/index.html",
  "kak-zagruzit-shorts/index.html",
  "shorts-ne-otobrazhayutsya-na-kanale/index.html",
  "shorts-net-zvuka/index.html",
];

const commercialGrowthPages = [
  "generator-youtube-shorts/index.html",
  "ai-generator-shorts/index.html",
  "generator-shorts-bez-lica/index.html",
  "generator-scenariev-youtube-shorts/index.html",
  "sozdat-shorts-video/index.html",
  "avtomatizaciya-youtube-shorts/index.html",
  "generator-video-dlya-tiktok/index.html",
  "generator-reels-instagram/index.html",
  "ai-generator-video-dlya-socsetey/index.html",
  "luchshiy-ai-generator-shorts/index.html",
  "luchshiy-generator-shorts-bez-lica/index.html",
  "kak-vybrat-ai-generator-shorts/index.html",
  "ai-generator-shorts-dlya-malogo-biznesa/index.html",
  "ai-generator-shorts-dlya-avtorov-youtube/index.html",
  "ai-video-maker-dlya-reels-tiktok-i-shorts/index.html",
  "generator-video-bez-lica-dlya-youtube-shorts/index.html",
  "en/youtube-shorts-generator/index.html",
  "en/ai-shorts-generator/index.html",
  "en/faceless-youtube-shorts-generator/index.html",
  "en/youtube-shorts-script-generator/index.html",
  "en/shorts-video-maker/index.html",
  "en/youtube-shorts-automation/index.html",
  "en/tiktok-video-generator/index.html",
  "en/instagram-reels-generator/index.html",
  "en/ai-video-generator-for-social-media/index.html",
  "en/best-ai-shorts-generator/index.html",
  "en/best-faceless-youtube-shorts-generator/index.html",
  "en/how-to-choose-an-ai-shorts-generator/index.html",
  "en/ai-shorts-generator-for-small-business/index.html",
  "en/ai-shorts-generator-for-youtube-creators/index.html",
  "en/ai-video-maker-for-reels-tiktok-and-shorts/index.html",
  "en/faceless-video-generator-for-youtube-shorts/index.html",
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

for (const pagePath of organicSprintPages) {
  const html = await readRootFile(pagePath);
  assert(/<title>[^<]{20,}<\/title>/i.test(html), `${pagePath}: missing organic sprint title`);
  assert(/<meta\s+name="description"\s+content="[^"]{80,}"/i.test(html), `${pagePath}: missing organic sprint description`);
  assert(/<link\s+rel="canonical"\s+href="https:\/\/adshortsai\.com\/[^"]*"/i.test(html), `${pagePath}: missing canonical`);
  assert(new RegExp(`"dateModified"\\s*:\\s*"${organicSprintLastmod}"`, "i").test(html), `${pagePath}: missing current dateModified`);
  assert(/"author"\s*:\s*\{\s*"@type"\s*:\s*"Organization"\s*,\s*"name"\s*:\s*"AdShorts AI"/i.test(html), `${pagePath}: missing Article author`);
  assert(/"@type"\s*:\s*"BreadcrumbList"/i.test(html), `${pagePath}: missing BreadcrumbList`);
  assert(/"@type"\s*:\s*"FAQPage"/i.test(html), `${pagePath}: missing FAQPage`);
  assert(/<!-- seo-index-boost:start -->/i.test(html), `${pagePath}: missing index boost block`);
  assert(/<!-- seo-sprint-faq:start -->/i.test(html), `${pagePath}: missing visible sprint FAQ`);
}

for (const pagePath of commercialGrowthPages) {
  const html = await readRootFile(pagePath);
  assert(/<title>[^<]{20,}<\/title>/i.test(html), `${pagePath}: missing commercial growth title`);
  assert(/<meta\s+name="description"\s+content="[^"]{80,}"/i.test(html), `${pagePath}: missing commercial growth description`);
  assert(/<link\s+rel="canonical"\s+href="https:\/\/adshortsai\.com\/(?:en\/)?[^"]+\/"/i.test(html), `${pagePath}: missing commercial growth canonical`);
  assert(/<link\s+rel="alternate"\s+hreflang="ru"\s+href="https:\/\/adshortsai\.com\/[^"]+\/"/i.test(html), `${pagePath}: missing ru hreflang`);
  assert(/<link\s+rel="alternate"\s+hreflang="en"\s+href="https:\/\/adshortsai\.com\/en\/[^"]+\/"/i.test(html), `${pagePath}: missing en hreflang`);
  assert(/<link\s+rel="alternate"\s+hreflang="x-default"\s+href="https:\/\/adshortsai\.com\/[^"]+\/"/i.test(html), `${pagePath}: missing x-default hreflang`);
  assert(/"@type"\s*:\s*"SoftwareApplication"/i.test(html), `${pagePath}: missing SoftwareApplication`);
  assert(/"@type"\s*:\s*"WebPage"/i.test(html), `${pagePath}: missing WebPage`);
  assert(new RegExp(`"dateModified"\\s*:\\s*"${commercialGrowthLastmod}"`, "i").test(html), `${pagePath}: missing commercial growth dateModified`);
  assert(/"@type"\s*:\s*"BreadcrumbList"/i.test(html), `${pagePath}: missing BreadcrumbList`);
  assert(/"@type"\s*:\s*"FAQPage"/i.test(html), `${pagePath}: missing FAQPage`);
  assert(/id="priority-growth-links"/i.test(html), `${pagePath}: missing priority cluster links`);
  assert(/id="commercial-next-steps"/i.test(html), `${pagePath}: missing commercial internal-link block`);
  assert(/href="\.\.\/shorts-guides\/#ai-generators"/i.test(html), `${pagePath}: missing commercial guides backlink`);
}

const rootLanding = await readRootFile("index.html");
assert(/href="\.\/shorts-guides\/#ai-generators"/i.test(rootLanding), "index.html: missing AI generator cluster link from landing");
const englishLanding = await readRootFile("en/index.html");
assert(/href="\.\/shorts-guides\/#ai-generators"/i.test(englishLanding), "en/index.html: missing AI generator cluster link from landing");

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
    assert(/<link\s+rel="alternate"\s+hreflang="ru"\s+href="https:\/\/adshortsai\.com\/[^"]*"/i.test(html), `${routeShellPath}: missing ru hreflang`);
    assert(/<link\s+rel="alternate"\s+hreflang="en"\s+href="https:\/\/adshortsai\.com\/en\/[^"]*"/i.test(html), `${routeShellPath}: missing en hreflang`);
    assert(/<link\s+rel="alternate"\s+hreflang="x-default"\s+href="https:\/\/adshortsai\.com\/[^"]*"/i.test(html), `${routeShellPath}: missing x-default hreflang`);
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
  `${siteOrigin}/press/`,
  `${siteOrigin}/en/press/`,
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

for (const pagePath of commercialGrowthPages) {
  const commercialUrl = `${siteOrigin}/${pagePath.replace(/index\.html$/, "")}`;
  assert(
    new RegExp(`<loc>${commercialUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/loc>[\\s\\S]*?<lastmod>${commercialGrowthLastmod}<\\/lastmod>`).test(sitemap),
    `sitemap.xml: commercial growth URL must use current lastmod ${commercialUrl}`,
  );
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

for (const pagePath of organicSprintPages) {
  const sprintUrl = `${siteOrigin}/${pagePath.replace(/index\.html$/, "")}`;
  assert(
    new RegExp(`<loc>${sprintUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/loc>[\\s\\S]*?<lastmod>${organicSprintLastmod}<\\/lastmod>`).test(sitemap),
    `sitemap.xml: organic sprint URL must use current lastmod ${sprintUrl}`,
  );
  const record = metadata.urls.find((entry) => entry.url === sprintUrl);
  assert(record?.lastmod === organicSprintLastmod, `seo-url-metadata.json: organic sprint URL must use current lastmod ${sprintUrl}`);
}

for (const pagePath of commercialGrowthPages) {
  const commercialUrl = `${siteOrigin}/${pagePath.replace(/index\.html$/, "")}`;
  const record = metadata.urls.find((entry) => entry.url === commercialUrl);
  assert(record?.lastmod === commercialGrowthLastmod, `seo-url-metadata.json: commercial growth URL must use current lastmod ${commercialUrl}`);
  assert(record?.intent === "commercial", `seo-url-metadata.json: commercial growth URL should be classified as commercial ${commercialUrl}`);
}

const englishGuides = await readRootFile("en/shorts-guides/index.html");
assert(/href="#ai-generators"/i.test(englishGuides), "en/shorts-guides/index.html: missing AI generators nav link");
assert(/<!-- seo-commercial-growth:start -->/i.test(englishGuides), "en/shorts-guides/index.html: missing commercial growth section");
const russianGuides = await readRootFile("shorts-guides/index.html");
assert(/href="#ai-generators"/i.test(russianGuides), "shorts-guides/index.html: missing AI generators nav link");
assert(/<!-- seo-commercial-growth:start -->/i.test(russianGuides), "shorts-guides/index.html: missing commercial growth section");

const deployProduction = await readRootFile("deploy-production.sh");
assert(/node scripts\/seo-commercial-growth-sprint\.mjs/.test(deployProduction), "deploy-production.sh: must run commercial growth sprint before SEO metadata export");
assert(/node scripts\/seo-organic-growth-sprint\.mjs/.test(deployProduction), "deploy-production.sh: must run organic growth sprint before SEO metadata export");
assert(/node scripts\/generate-static-press-pages\.mjs/.test(deployProduction), "deploy-production.sh: must generate press pages before SEO metadata export");
assert(
  /@app_routes path \/ \/en\/ \/app\* \/en\/app\* \/rf_\* \/pricing\/ \/en\/pricing\/ \/examples\/ \/en\/examples\/ \/hero-background-test \/en\/hero-background-test/.test(deployProduction),
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
