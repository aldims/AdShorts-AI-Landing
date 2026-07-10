#!/usr/bin/env node
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policyPath = path.join(rootDir, "seo-index-policy.json");
const policy = JSON.parse(await readFile(policyPath, "utf8"));
const siteOrigin = policy.siteOrigin.replace(/\/$/, "");
const indexByPath = new Map(policy.index.map((entry) => [entry.url, entry]));
const redirectByPath = new Map(policy.redirect.map((entry) => [entry.url, entry]));
const errors = [];

const normalizePath = (value) => {
  const parsed = new URL(value, `${siteOrigin}/`);
  return parsed.pathname === "/data-deletion.html" ? parsed.pathname : parsed.pathname.replace(/\/?$/, "/");
};

const duplicatePaths = [...indexByPath.keys()].filter((url) => redirectByPath.has(url));
if (duplicatePaths.length) errors.push(`URLs cannot be both index and redirect: ${duplicatePaths.join(", ")}`);

for (const entry of policy.redirect) {
  if (!indexByPath.has(entry.target)) errors.push(`Redirect target must be indexable: ${entry.url} -> ${entry.target}`);
  if (redirectByPath.has(entry.target)) errors.push(`Redirect chain is not allowed: ${entry.url} -> ${entry.target}`);
}

const excludedDirs = new Set([".git", ".codex-tmp", "app", "node_modules", "seo-external-layer", "tmp", "logs"]);
const htmlFiles = [];

const walk = async (dir) => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirs.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute);
    } else if (entry.name === "index.html" || absolute === path.join(rootDir, "data-deletion.html")) {
      htmlFiles.push(absolute);
    }
  }
};

await walk(rootDir);

const pages = new Map();
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
  if (!canonical) continue;
  const parsed = new URL(canonical, `${siteOrigin}/`);
  if (parsed.origin !== siteOrigin) continue;
  const pathname = normalizePath(parsed.pathname);
  if (!pages.has(pathname)) pages.set(pathname, { file, html });
}

for (const pathname of [...indexByPath.keys(), ...redirectByPath.keys()]) {
  if (!pages.has(pathname)) errors.push(`Policy URL has no static canonical page: ${pathname}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const statusFor = (pathname) => {
  if (indexByPath.has(pathname)) return "index";
  if (redirectByPath.has(pathname)) return "redirect";
  return "noindex";
};

const setRobots = (html, content) => {
  const meta = `    <meta name="robots" content="${content}" />`;
  if (/<meta\s+name=["']robots["'][^>]*>/i.test(html)) {
    return html.replace(/\s*<meta\s+name=["']robots["'][^>]*>/i, `\n${meta}`);
  }
  return html.replace(/(<meta\s+name=["']viewport["'][^>]*>)/i, `$1\n${meta}`);
};

const filterHreflang = (html) => html.replace(
  /\s*<link\s+rel=["']alternate["']\s+hreflang=["'][^"']+["']\s+href=["']([^"']+)["']\s*\/?>/gi,
  (tag, href) => statusFor(normalizePath(href)) === "index" ? tag : "",
);

const stripDeprecatedSeoBlocks = (html) => html
  .replace(/\s*<!-- seo-(?:index-boost|action-plan):start -->[\s\S]*?<!-- seo-(?:index-boost|action-plan):end -->/gi, "")
  .replace(/\s*<!-- seo-sprint-faq-jsonld:start -->\s*<!-- seo-sprint-faq-jsonld:end -->/gi, "");

for (const [pathname, page] of pages) {
  const status = statusFor(pathname);
  let html = setRobots(page.html, status === "index" ? "index, follow" : "noindex, follow");
  html = filterHreflang(html);
  if (status === "index") html = stripDeprecatedSeoBlocks(html);
  await writeFile(page.file, html, "utf8");
  page.html = html;
}

const internalStatus = (href, hubUrl) => {
  try {
    const resolved = new URL(href, hubUrl);
    if (resolved.origin !== siteOrigin) return "external";
    return statusFor(normalizePath(resolved.pathname));
  } catch {
    return "invalid";
  }
};

for (const hubPath of policy.hubs) {
  const page = pages.get(hubPath);
  if (!page) continue;
  const hubUrl = `${siteOrigin}${hubPath}`;
  const html = page.html.replace(
    /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi,
    (anchor, before, href, after, label) => {
      const status = internalStatus(href, hubUrl);
      return status === "noindex" || status === "redirect" ? label : anchor;
    },
  ).replace(/[ \t]+$/gm, "");
  await writeFile(page.file, html, "utf8");
  page.html = html;
}

const previousSitemap = await readFile(path.join(rootDir, "sitemap.xml"), "utf8");
const previousBlocks = new Map(
  [...previousSitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g)]
    .map((match) => [normalizePath(match[1]), match[2]]),
);

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const extract = (block, name, fallback) => block?.match(new RegExp(`<${name}>([^<]+)<\\/${name}>`))?.[1] ?? fallback;

const sitemapBlocks = policy.index.map((entry) => {
  const page = pages.get(entry.url);
  const oldBlock = previousBlocks.get(entry.url);
  const canonical = `${siteOrigin}${entry.url}`;
  const lastmod = entry.contentModified ?? extract(oldBlock, "lastmod", policy.baselineDate);
  const changefreq = extract(oldBlock, "changefreq", "monthly");
  const priority = extract(oldBlock, "priority", entry.url.startsWith("/en/") ? "0.60" : "0.70");
  const alternates = [...page.html.matchAll(/<link\s+rel=["']alternate["']\s+hreflang=["']([^"']+)["']\s+href=["']([^"']+)["']/gi)]
    .filter(([, , href]) => statusFor(normalizePath(href)) === "index")
    .map(([, locale, href]) => `    <xhtml:link rel="alternate" hreflang="${escapeXml(locale)}" href="${escapeXml(href)}" />`)
    .join("\n");
  return `  <url>\n    <loc>${escapeXml(canonical)}</loc>${alternates ? `\n${alternates}` : ""}\n    <lastmod>${escapeXml(lastmod)}</lastmod>\n    <changefreq>${escapeXml(changefreq)}</changefreq>\n    <priority>${escapeXml(priority)}</priority>\n  </url>`;
});

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${sitemapBlocks.join("\n")}\n</urlset>\n`;
await writeFile(path.join(rootDir, "sitemap.xml"), sitemap, "utf8");

const redirectManifest = {
  generatedAt: policy.baselineDate,
  deployAutomatically: false,
  note: "Review and deploy separately after explicit owner approval. SEO-only deploy excludes this file.",
  redirects: policy.redirect.map((entry) => ({ ...entry, statusCode: 301 })),
};
await writeFile(path.join(rootDir, "seo-redirects.json"), `${JSON.stringify(redirectManifest, null, 2)}\n`, "utf8");

const statusCounts = { index: policy.index.length, redirect: policy.redirect.length, noindex: 0 };
for (const pathname of pages.keys()) {
  if (statusFor(pathname) === "noindex") statusCounts.noindex += 1;
}
console.log(`Applied SEO policy: ${statusCounts.index} index, ${statusCounts.noindex} noindex, ${statusCounts.redirect} redirect.`);
