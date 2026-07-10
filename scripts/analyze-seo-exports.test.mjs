#!/usr/bin/env node
import assert from "node:assert/strict";
import { analyzeEventLines, analyzeSearchRows, parseCsv, parseMetric } from "./lib/seo-csv-analysis.mjs";

const queryCsv = `Запросы;Клики;Показы;CTR;Позиция\n"adshorts ai";12;20;60%;1,2\n"генератор shorts";5;100;5%;8,4\n"shorts, без лица";1;50;2%;11,1\n`;
const queryRows = parseCsv(queryCsv);
assert.equal(queryRows.length, 3);
assert.equal(queryRows[2]["запросы"], "shorts, без лица");
const queryReport = analyzeSearchRows(queryRows, { source: "test", benchmarkCtr: 3.1 });
assert.equal(queryReport.brand.clicks, 12);
assert.equal(queryReport.nonBrand.clicks, 6);
assert.equal(queryReport.nonBrand.impressions, 150);
assert.equal(queryReport.totals.clicks, 18);

const pageCsv = `Pages,Clicks,Impressions,CTR,Position\nhttps://adshortsai.com/a/,1,100,1%,8.2\nhttps://adshortsai.com/b/,4,40,10%,3.1\n`;
const pageReport = analyzeSearchRows(parseCsv(pageCsv), { source: "pages", benchmarkCtr: 3.1 });
assert.equal(pageReport.growthPages[0].pathname, "/a/");
assert.equal(pageReport.growthPages[0].opportunityClicks, 2);

assert.equal(parseMetric("1\u00a0234"), 1234);
assert.equal(parseMetric("1,234"), 1234);
assert.equal(parseMetric("3,91%"), 3.91);

const events = [
  JSON.stringify({ event: "seo_page_view", canonical: "https://adshortsai.com/a/" }),
  JSON.stringify({ event: "seo_cta_click", canonical: "https://adshortsai.com/a/", cta: "studio", href: "https://adshortsai.com/app/studio?source=seo_a" }),
  JSON.stringify({ event: "seo_page_view", canonical: "https://adshortsai.com/a/" }),
  "not-json",
].join("\n");
const eventReport = analyzeEventLines(events);
assert.equal(eventReport.invalidLines, 1);
assert.equal(eventReport.totals.pageViews, 2);
assert.equal(eventReport.totals.studioClicks, 1);
assert.equal(eventReport.pages[0].studioCtrPercent, 50);

console.log("SEO export analysis tests passed.");
