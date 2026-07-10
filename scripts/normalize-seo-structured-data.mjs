#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(await readFile(path.join(rootDir, "seo-index-policy.json"), "utf8"));
const siteOrigin = policy.siteOrigin.replace(/\/$/, "");

const localPathFor = (pathname) => {
  if (pathname === "/") return "index.html";
  if (pathname === "/data-deletion.html") return "data-deletion.html";
  return `${pathname.slice(1)}index.html`;
};

const normalizeNode = (value, locale) => {
  if (Array.isArray(value)) return value.map((item) => normalizeNode(item, locale));
  if (!value || typeof value !== "object") return value;

  const normalized = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "aggregateRating") continue;
    normalized[key] = normalizeNode(child, locale);
  }

  const types = Array.isArray(normalized["@type"]) ? normalized["@type"] : [normalized["@type"]];
  if (types.includes("SoftwareApplication")) {
    normalized.operatingSystem = "Web";
  }
  if (types.includes("Offer")) {
    normalized.priceCurrency = locale === "en" ? "USD" : "RUB";
    normalized.url = locale === "en" ? `${siteOrigin}/en/pricing/` : `${siteOrigin}/pricing/`;
  }
  return normalized;
};

let changed = 0;
for (const entry of policy.index) {
  const filePath = path.join(rootDir, localPathFor(entry.url));
  let html = await readFile(filePath, "utf8");
  const locale = entry.url.startsWith("/en/") ? "en" : "ru";
  let pageChanged = false;

  html = html.replace(
    /\s*<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi,
    (block, source) => {
      let data;
      try {
        data = JSON.parse(source);
      } catch {
        return block;
      }

      const types = Array.isArray(data?.["@type"]) ? data["@type"] : [data?.["@type"]];
      if (types.includes("FAQPage")) {
        pageChanged = true;
        return "";
      }

      const normalized = normalizeNode(data, locale);
      if (JSON.stringify(normalized) === JSON.stringify(data)) return block;
      const nextBlock = `\n    <script type="application/ld+json">\n${JSON.stringify(normalized, null, 6).replace(/^/gm, "    ")}\n    </script>`;
      pageChanged = true;
      return nextBlock;
    },
  );

  if (pageChanged) {
    await writeFile(filePath, html, "utf8");
    changed += 1;
  }
}

console.log(`Normalized structured data on ${changed} index pages.`);
