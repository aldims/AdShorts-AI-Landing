#!/usr/bin/env node
const args = process.argv.slice(2);
const options = { base: "http://127.0.0.1:4275", concurrency: "8" };
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
  const [key, inlineValue] = argument.slice(2).split("=", 2);
  options[key] = inlineValue ?? args[++index];
}

const baseUrl = new URL(options.base);
const concurrency = Math.max(1, Math.min(24, Number(options.concurrency) || 8));
const timeoutMs = Math.max(1000, Number(options.timeout) || 15000);
const expectedOrigin = "https://adshortsai.com";

const fetchText = async (url) => {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": "AdShortsAI-SEO-Audit/1.0" },
  });
  return { response, text: await response.text() };
};

const sitemapUrl = new URL(options.sitemap ?? "/sitemap.xml", baseUrl);
const { response: sitemapResponse, text: sitemap } = await fetchText(sitemapUrl);
if (!sitemapResponse.ok) throw new Error(`Sitemap returned ${sitemapResponse.status}: ${sitemapUrl}`);

const canonicalUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (!canonicalUrls.length) throw new Error("Sitemap contains no URLs.");

const jobs = canonicalUrls.map((canonical) => ({
  canonical,
  requestUrl: new URL(new URL(canonical).pathname, baseUrl).href,
}));
const results = new Array(jobs.length);
let cursor = 0;

const worker = async () => {
  while (cursor < jobs.length) {
    const index = cursor;
    cursor += 1;
    const job = jobs[index];
    try {
      const { response, text } = await fetchText(job.requestUrl);
      const canonical = text.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1] ?? null;
      const robots = text.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i)?.[1] ?? null;
      const titles = [...text.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map((match) => match[1].replace(/\s+/g, " ").trim());
      const h1Count = (text.match(/<h1\b/gi) ?? []).length;
      const jsonLdErrors = [];
      for (const [, source] of text.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)) {
        try {
          JSON.parse(source);
        } catch (error) {
          jsonLdErrors.push(error.message);
        }
      }
      const errors = [];
      if (response.status !== 200) errors.push(`status ${response.status}`);
      if (canonical !== job.canonical) errors.push(`canonical ${canonical ?? "missing"}`);
      if (/noindex/i.test(robots ?? "")) errors.push(`robots ${robots}`);
      if (/noindex/i.test(response.headers.get("x-robots-tag") ?? "")) errors.push(`X-Robots-Tag ${response.headers.get("x-robots-tag")}`);
      if (titles.length !== 1 || !titles[0]) errors.push(`title count ${titles.length}`);
      if (h1Count !== 1) errors.push(`H1 count ${h1Count}`);
      if (jsonLdErrors.length) errors.push(`invalid JSON-LD: ${jsonLdErrors.join("; ")}`);
      results[index] = { ...job, status: response.status, title: titles[0] ?? null, errors };
    } catch (error) {
      results[index] = { ...job, status: null, title: null, errors: [error.message] };
    }
  }
};

await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()));

const titleOwners = new Map();
for (const result of results) {
  if (!result.title) continue;
  const owners = titleOwners.get(result.title) ?? [];
  owners.push(result.canonical);
  titleOwners.set(result.title, owners);
}
for (const [title, owners] of titleOwners) {
  if (owners.length < 2) continue;
  for (const canonical of owners) {
    results.find((result) => result.canonical === canonical)?.errors.push(`duplicate title: ${title}`);
  }
}

const errors = results.filter((result) => result.errors.length);
const report = {
  baseUrl: baseUrl.href,
  sitemapUrl: sitemapUrl.href,
  expectedOrigin,
  urls: results.length,
  passed: results.length - errors.length,
  failed: errors.length,
  errors,
};

if (options.output) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (errors.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(`SEO crawl passed: ${report.passed}/${report.urls} URLs from ${sitemapUrl.href}`);
