# SEO console status — 2026-07-15

## Production

- Public sitemap contains 83 policy-approved URLs before this demand-recovery update.
- Production HTTP crawl passed for 83/83 sitemap URLs.
- Google and Yandex both processed the 83-URL sitemap successfully.

## Google Search Console

- Sitemap status: successful, submitted 2026-07-11 and processed 2026-07-15.
- The sitemap report contains 30 indexed and 53 not-indexed URLs, but the page-indexing snapshot is dated 2026-07-10 and predates the 2026-07-11 release.
- Current sitemap reasons in that stale snapshot: 29 crawled but not indexed, 19 discovered but not indexed and 5 old noindex observations.
- The five noindex observations are trust pages last crawled in February or March; production now serves them as indexable.
- All-URL report improved from 54 to 58 indexed pages. Discovered-but-not-indexed fell from 143 to 19.
- Performance for the rolling three-month report: 221 clicks, 7,158 impressions, 3.1% CTR and average position 10.3.
- The exact brand query `adshorts ai` produced 136 clicks, so at least 61% of Google clicks remain branded.
- External links report still shows 0 detected links.

## Yandex Webmaster

- The sitemap loaded from robots.txt contains 83 URLs and was processed successfully on 2026-07-11.
- All ten priority recrawl submissions from 2026-07-11 are marked processed.
- Search pages report contains 188 canonical URLs and 87 excluded URLs. Most exclusions are intentional noindex or redirects; three old MP4 fetch failures are not page-indexing issues.
- The old index is still contracting: 81 URLs are reported as removed, so the 188 canonical count still includes pages from the former sitemap.
- Current versus previous comparison for 2026-06-09 through 2026-07-09: impressions 5,367 vs 3,272; clicks 210 vs 95; CTR 3.91% vs 1.57%.

## Confirmed demand recovery

The following Russian pages crossed the accepted threshold of a click or at least 20 impressions and must return to index:

- `/shorts-ne-prohodyat-moderaciyu/`: 20 impressions, 9 clicks.
- `/shorts-nizkoe-kachestvo-video/`: 25 impressions, 2 clicks.
- `/gromkost-golosa-i-muzyki-v-shorts/`: 31 impressions.
- `/ozvuchka-dlya-shorts-kak-vybrat-golos/`: 37 impressions.

The cost cluster also has validated impressions without clicks: `монтаж шортс цена`, `сколько стоит смонтировать шортс` and close variants. Consolidate this intent on `/kalkulyator-stoimosti-shorts/` instead of creating duplicate pages.

## Release decision

- Return the four confirmed-demand pages to index and the RU guide hub.
- Update their snippets and visible answers around the observed queries.
- Update the calculator snippet for the Shorts editing price cluster.
- Do not resubmit the whole sitemap repeatedly. After release, submit only the four recovered URLs to Yandex recrawl and allow Google to discover them through sitemap and internal links.
- Do not change Caddy, React, backend, workers or services in this release.
