#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteOrigin = "https://adshortsai.com";

const decodeHtml = (value) =>
  String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/\s+/g, " ")
    .trim();

const stripTags = (value) => decodeHtml(String(value).replace(/<[^>]+>/g, " "));

const urlToLocalFile = (url) => {
  const parsed = new URL(url);
  if (parsed.origin !== siteOrigin) return null;
  if (parsed.pathname === "/") return "index.html";
  if (parsed.pathname.endsWith("/")) return `${parsed.pathname.slice(1)}index.html`;
  return parsed.pathname.slice(1);
};

const normalizeSlug = (url) => {
  const parsed = new URL(url);
  const pathName = parsed.pathname.replace(/^\/|\/$/g, "");
  return pathName || "home";
};

const resolveCluster = (slug, h1) => {
  const haystack = `${slug} ${h1}`.toLowerCase();
  if (/(pricing|тариф|цена|стоит|cost|price)/.test(haystack)) return "pricing";
  if (/(generator|automation|video-maker|shorts-maker|reels-generator|tiktok-video-generator|создат|sozdat|генератор|автоматизац)/.test(haystack)) return "commercial";
  if (/(examples|пример|template|шаблон)/.test(haystack)) return "examples";
  if (/(guides|гайд)/.test(haystack)) return "hub";
  if (/(view|prosmotr|просмотр|0-|shadow|moderac|copyright|загру|звук|quality|kachestv|black|polos|restriction|ban|ошиб|problem|views-dropped|ne-)/.test(haystack)) return "problems";
  if (/(retention|uderzhan|досмотр|hook|huk|length|dlina|loop|petl|temp|pacing|storytelling|prolist)/.test(haystack)) return "retention";
  if (/(script|scenari|tekst|title|zagolov|description|opisanie|hashtag|heshteg|keyword|cta|comment|link)/.test(haystack)) return "scripts";
  if (/(montazh|editing|format|resolution|bitrate|light|svet|shake|tryask|photo|foto|thumbnail|oblozh|background|fon|transition|perehod|subtitle|subtitr|voice|ozvuch|music|muzyka|sound|audio)/.test(haystack)) return "production";
  if (/(recommend|analytics|analitik|test|traffic|trafik|monetization|monetiz|post|vykлады|often|chasto|ctr)/.test(haystack)) return "growth";
  if (/(business|biznes|clinic|kliniki|law|yurist|school|shkol|store|magazin|real-estate|nedvizh|smm|agency|it-company|niche|nisha|ideas|idei|content-plan|kontent-plan|series|seriy|batch|pachk|sell|prodavat)/.test(haystack)) return "strategy";
  return "other";
};

const resolveIntent = (slug, h1) => {
  const haystack = `${slug} ${h1}`.toLowerCase();
  if (/(pricing|тариф|цена|cost|price)/.test(haystack)) return "commercial";
  if (/(generator|automation|video-maker|shorts-maker|reels-generator|tiktok-video-generator|создат|sozdat|генератор|автоматизац)/.test(haystack)) return "commercial";
  if (/(examples|пример|template|шаблон)/.test(haystack)) return "template";
  if (/(how|kak|как)/.test(haystack)) return "how-to";
  if (/(ne-|нет|not|wont|низк|low|problem|ошиб|ban|copyright|moderac|0-views|0 просмотров)/.test(haystack)) return "problem-solution";
  if (/(для|for-)/.test(haystack)) return "use-case";
  return "informational";
};

const sitemap = await readFile(path.join(rootDir, "sitemap.xml"), "utf8");
const urlBlocks = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1]);
const records = [];

for (const block of urlBlocks) {
  const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
  if (!loc) continue;

  const localFile = urlToLocalFile(loc);
  if (!localFile) continue;

  const html = await readFile(path.join(rootDir, localFile), "utf8");
  const title = stripTags(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = decodeHtml(html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? "");
  const h1 = stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? title);
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] ?? loc;
  const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? null;
  const slug = normalizeSlug(loc);
  const locale = new URL(loc).pathname.startsWith("/en/") ? "en" : "ru";

  records.push({
    canonical,
    cluster: resolveCluster(slug, h1),
    cta_source: `seo_${slug.replace(/^en\//, "en_").replaceAll("/", "_").replaceAll("-", "_")}`,
    description,
    h1,
    intent: resolveIntent(slug, h1),
    lastmod,
    locale,
    target_query: h1,
    title,
    url: loc,
  });
}

await writeFile(
  path.join(rootDir, "seo-url-metadata.json"),
  `${JSON.stringify(
    {
      generatedAt: "build-time",
      source: "sitemap.xml + static HTML metadata",
      urls: records,
    },
    null,
    2,
  )}\n`,
);

console.log(`Exported seo-url-metadata.json with ${records.length} URLs.`);
