# SEO console status — 2026-07-19

## Production release

- Policy-driven sitemap restored to 87 indexable URLs.
- 171 weak static pages now return `noindex, follow`; six duplicate URLs return direct 301 redirects to indexable targets.
- Production crawl passed for 87/87 sitemap URLs.
- `/app` and `/app/studio` still return HTTP 200 after the SEO-only release.
- The regular production deploy now runs structured-data normalization and `apply-seo-index-policy.mjs`, so a future app deploy cannot restore the former 264-URL sitemap.

## Google Search Console

- `https://adshortsai.com/sitemap.xml` was resubmitted successfully on 2026-07-19.
- The previous processing snapshot still reports 83 discovered URLs from 2026-07-15; the new 87-URL sitemap is awaiting processing.
- `/kalkulyator-stoimosti-shorts/` was already discovered through the sitemap but had not been crawled.
- A priority indexing request for the calculator was accepted on 2026-07-19.
- The external links report shows zero detected links.

## Yandex Webmaster

- The 87-URL sitemap was added to the processing queue on 2026-07-19.
- Nine validated commercial and demand-recovery pages were submitted for priority recrawl:
  - `/kalkulyator-stoimosti-shorts/`
  - `/generator-youtube-shorts/`
  - `/shorts-ne-prohodyat-moderaciyu/`
  - `/shorts-nizkoe-kachestvo-video/`
  - `/gromkost-golosa-i-muzyki-v-shorts/`
  - `/ozvuchka-dlya-shorts-kak-vybrat-golos/`
  - `/ai-generator-shorts-dlya-malogo-biznesa/`
  - `/kak-sdelat-shorts-bez-montazha/`
  - `/sozdat-shorts-video/`
- All nine requests are shown as queued. The remaining daily quota is 141 URLs.
- The external links report shows zero detected links.

## Next measurement point

- Do not resubmit the sitemap or the same URLs repeatedly.
- Recheck sitemap processing, calculator crawl status, indexed URL counts and non-brand performance after 7-10 days.
- The next growth constraint is external authority. Editorial posts and outreach remain confirmation-gated and were not published in this release.
