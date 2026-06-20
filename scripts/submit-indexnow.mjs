#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteHost = "adshortsai.com";
const indexNowKey = "7bc3b66e6b0d381d51ec10ea138cb3a51ff94b43c24c414d3a33de656dd3d7c5";
const defaultLastmod = "2026-06-18";
const endpoints = [
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
];

const metadata = JSON.parse(await readFile(path.join(rootDir, "seo-url-metadata.json"), "utf8"));
const requestedLastmod = process.env.INDEXNOW_LASTMOD ?? defaultLastmod;
const urls = metadata.urls
  .filter((entry) => entry.lastmod === requestedLastmod)
  .map((entry) => entry.url);

if (!urls.length) {
  throw new Error(`No URLs found for lastmod ${requestedLastmod}`);
}

const payload = {
  host: siteHost,
  key: indexNowKey,
  urlList: urls,
};

const results = [];
for (const endpoint of endpoints) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  results.push({
    endpoint,
    status: response.status,
    ok: response.ok || response.status === 202,
    body: body.trim(),
  });
}

for (const result of results) {
  console.log(`${result.endpoint} ${result.status}${result.ok ? " OK" : " FAILED"}`);
  if (result.body) console.log(result.body);
}

if (results.some((result) => !result.ok)) {
  process.exit(1);
}

console.log(`Submitted ${urls.length} URLs with lastmod ${requestedLastmod}.`);
