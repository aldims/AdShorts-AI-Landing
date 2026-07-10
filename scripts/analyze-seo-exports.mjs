#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeEventLines, analyzeSearchRows, parseCsv, roundReport } from "./lib/seo-csv-analysis.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const options = {};
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
  const [key, inlineValue] = argument.slice(2).split("=", 2);
  if (inlineValue !== undefined) {
    options[key] = inlineValue;
  } else if (args[index + 1] && !args[index + 1].startsWith("--")) {
    options[key] = args[++index];
  } else {
    options[key] = true;
  }
}

if (options.help) {
  console.log("Usage: node scripts/analyze-seo-exports.mjs [--gsc-query file.csv] [--gsc-page file.csv] [--yandex-query file.csv] [--yandex-page file.csv] [--events server.jsonl] [--output report.json]");
  process.exit(0);
}

const baseline = JSON.parse(await readFile(path.join(rootDir, "seo-measurement-baseline.json"), "utf8"));
const policy = JSON.parse(await readFile(path.join(rootDir, "seo-index-policy.json"), "utf8"));
const inputSpecs = [
  ["gscQuery", options["gsc-query"], "Google Search Console queries", baseline.googleSearchConsole.ctrPercent],
  ["gscPage", options["gsc-page"], "Google Search Console pages", baseline.googleSearchConsole.ctrPercent],
  ["yandexQuery", options["yandex-query"], "Yandex Webmaster queries", baseline.yandexWebmaster.ctrPercent],
  ["yandexPage", options["yandex-page"], "Yandex Webmaster pages", baseline.yandexWebmaster.ctrPercent],
];

const report = {
  generatedAt: new Date().toISOString(),
  baselineDate: baseline.baselineDate,
  policy: {
    indexUrls: policy.index.length,
    redirects: policy.redirect.length,
    reviewDate: policy.reviewDate,
  },
  search: {},
};

for (const [key, file, label, benchmarkCtr] of inputSpecs) {
  if (!file) continue;
  const source = await readFile(path.resolve(file), "utf8");
  report.search[key] = analyzeSearchRows(parseCsv(source), {
    source: label,
    benchmarkCtr,
    siteOrigin: policy.siteOrigin,
  });
}

if (options.events) {
  report.events = analyzeEventLines(await readFile(path.resolve(options.events), "utf8"));
}

const rounded = roundReport(report);
const serialized = `${JSON.stringify(rounded, null, 2)}\n`;
if (options.output) {
  await writeFile(path.resolve(options.output), serialized, "utf8");
  console.log(`SEO report written to ${path.resolve(options.output)}`);
} else {
  process.stdout.write(serialized);
}
