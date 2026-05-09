import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteOrigin = "https://adshortsai.com";
const dateModified = "2026-05-09";

const crawledNotIndexedUrls = [
  "https://adshortsai.com/en/ai-for-youtube-shorts/",
  "https://adshortsai.com/shorts-ne-zagruzhayutsya/",
  "https://adshortsai.com/en/youtube-shorts-monetization/",
  "https://adshortsai.com/kak-sdelat-dinamichnyj-temp-v-shorts/",
  "https://adshortsai.com/en/how-to-film-shorts-on-a-phone/",
  "https://adshortsai.com/shorts-malo-laykov/",
  "https://adshortsai.com/en/copyright-free-music-for-shorts/",
  "https://adshortsai.com/kak-sdelat-shorts-iz-dlinnogo-video/",
  "https://adshortsai.com/shorts-ne-otobrazhayutsya-na-kanale/",
  "https://adshortsai.com/opisanie-dlya-shorts-chto-pisat/",
  "https://adshortsai.com/shorts-ne-konvertiruyut-v-podpischiki/",
  "https://adshortsai.com/en/youtube-shorts-few-likes/",
  "https://adshortsai.com/en/youtube-shorts-copyright/",
  "https://adshortsai.com/neyroset-dlya-shorts/",
  "https://adshortsai.com/en/youtube-shorts-getting-0-views/",
  "https://adshortsai.com/shorts-chernye-polosy/",
  "https://adshortsai.com/en/keywords-for-youtube-shorts/",
  "https://adshortsai.com/en/how-often-to-post-youtube-shorts/",
  "https://adshortsai.com/en/how-to-drive-traffic-from-shorts-to-telegram/",
  "https://adshortsai.com/fon-dlya-shorts/",
  "https://adshortsai.com/en/youtube-shorts-description-what-to-write/",
  "https://adshortsai.com/kak-zagruzit-shorts/",
  "https://adshortsai.com/en/youtube-shorts-not-converting-to-subscribers/",
  "https://adshortsai.com/kak-chasto-vykladyvat-shorts/",
  "https://adshortsai.com/en/youtube-shorts-not-getting-views/",
  "https://adshortsai.com/shorts-ne-nabirayut-prosmotry/",
  "https://adshortsai.com/format-video-dlya-shorts/",
  "https://adshortsai.com/en/youtube-shorts-for-online-school/",
  "https://adshortsai.com/kak-privesti-trafik-iz-shorts-v-telegram/",
  "https://adshortsai.com/kak-snimat-shorts-na-telefon/",
];

const routeForUrl = (urlString) => {
  const url = new URL(urlString);
  if (url.origin !== siteOrigin) {
    throw new Error(`Unexpected origin in ${urlString}`);
  }

  return url.pathname;
};

const localFileForRoute = (route) => {
  if (route === "/") return path.join(rootDir, "index.html");

  return path.join(rootDir, route.replace(/^\//, ""), "index.html");
};

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const extractTagText = (html, tagName) => {
  const match = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i").exec(html);
  return match?.[1]?.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() ?? "";
};

const extractCanonical = (html) =>
  /<link\s+rel="canonical"\s+href="([^"]+)"/i.exec(html)?.[1] ?? "";

const stripBlock = (html, name) =>
  html.replace(new RegExp(`\\n?\\s*<!-- ${name}:start -->[\\s\\S]*?<!-- ${name}:end -->\\n?`, "g"), "\n");

const normalizeTrailingSlashLinks = (html) =>
  html.replace(
    /href="((?:\.\.\/){1,2}(?:en\/)?(?:examples|pricing))(?![/?#])"/g,
    'href="$1/"',
  );

const classifyPage = (route) => {
  const slug = route.toLowerCase();

  if (
    /zagruzh|upload|format|black|chern|copyright|music|muzyka|phone|telefon|background|fon/.test(slug)
  ) {
    return "production";
  }

  if (/views|prosmotr|0-views|likes|layk|subscriber|podpisch|channel|retention|uderzhan/.test(slug)) {
    return "performance";
  }

  if (/description|opisanie|keyword|heshteg|hashtag|title|zagolovok|hook|tekst|script/.test(slug)) {
    return "text";
  }

  if (/traffic|monetization|school|shkol|post|chasto|often|business|sell/.test(slug)) {
    return "growth";
  }

  return "strategy";
};

const linkSets = {
  ru: {
    base: [
      ["https://adshortsai.com/shorts-guides/", "все гайды по YouTube Shorts"],
      ["https://adshortsai.com/examples/", "примеры готовых Shorts"],
      ["https://adshortsai.com/pricing/", "тарифы AdShorts AI"],
    ],
    production: [
      ["https://adshortsai.com/format-video-dlya-shorts/", "формат видео для Shorts"],
      ["https://adshortsai.com/razreshenie-dlya-shorts/", "разрешение для Shorts"],
      ["https://adshortsai.com/subtitry-dlya-shorts-avtomatom/", "автоматические субтитры"],
      ["https://adshortsai.com/gromkost-golosa-i-muzyki-v-shorts/", "баланс голоса и музыки"],
    ],
    performance: [
      ["https://adshortsai.com/shorts-ne-nabirayut-prosmotry/", "почему Shorts не набирают просмотры"],
      ["https://adshortsai.com/kak-sdelat-huk-v-shorts/", "как сделать сильный хук"],
      ["https://adshortsai.com/procent-prolistyvaniy-shorts/", "процент пролистываний Shorts"],
      ["https://adshortsai.com/kak-testirovat-shorts/", "как тестировать Shorts"],
    ],
    text: [
      ["https://adshortsai.com/kak-sdelat-huk-v-shorts/", "хук для Shorts"],
      ["https://adshortsai.com/zagolovok-dlya-shorts-kak-pisat/", "заголовок для Shorts"],
      ["https://adshortsai.com/kak-naiti-heshtegi-dlya-shorts/", "как найти хештеги"],
      ["https://adshortsai.com/kak-sdelat-tekst-na-video-dlya-shorts/", "текст на видео"],
    ],
    growth: [
      ["https://adshortsai.com/kak-chasto-vykladyvat-shorts/", "как часто выкладывать Shorts"],
      ["https://adshortsai.com/kogda-vykladyvat-shorts/", "когда выкладывать Shorts"],
      ["https://adshortsai.com/kak-privesti-trafik-iz-shorts-v-telegram/", "трафик из Shorts в Telegram"],
      ["https://adshortsai.com/shorts-dlya-onlayn-shkoly/", "Shorts для онлайн-школы"],
    ],
    strategy: [
      ["https://adshortsai.com/neyroset-dlya-shorts/", "нейросеть для Shorts"],
      ["https://adshortsai.com/kak-testirovat-shorts/", "как тестировать Shorts"],
      ["https://adshortsai.com/kak-sdelat-seriyu-shorts/", "серия Shorts"],
      ["https://adshortsai.com/analitika-youtube-shorts-kak-chitat/", "аналитика Shorts"],
    ],
  },
  en: {
    base: [
      ["https://adshortsai.com/en/shorts-guides/", "all YouTube Shorts guides"],
      ["https://adshortsai.com/en/examples/", "Shorts examples"],
      ["https://adshortsai.com/en/pricing/", "AdShorts AI pricing"],
    ],
    production: [
      ["https://adshortsai.com/en/video-format-for-youtube-shorts/", "video format for Shorts"],
      ["https://adshortsai.com/en/youtube-shorts-resolution/", "YouTube Shorts resolution"],
      ["https://adshortsai.com/en/automatic-subtitles-for-youtube-shorts/", "automatic subtitles"],
      ["https://adshortsai.com/en/voice-and-music-volume-in-shorts/", "voice and music volume"],
    ],
    performance: [
      ["https://adshortsai.com/en/youtube-shorts-not-getting-views/", "why Shorts are not getting views"],
      ["https://adshortsai.com/en/how-to-create-a-hook-in-shorts/", "how to create a hook"],
      ["https://adshortsai.com/en/youtube-shorts-swipe-away-rate/", "Shorts swipe-away rate"],
      ["https://adshortsai.com/en/how-to-test-youtube-shorts/", "how to test YouTube Shorts"],
    ],
    text: [
      ["https://adshortsai.com/en/how-to-create-a-hook-in-shorts/", "hook for Shorts"],
      ["https://adshortsai.com/en/youtube-shorts-title-how-to-write/", "YouTube Shorts title"],
      ["https://adshortsai.com/en/how-to-find-hashtags-for-shorts/", "how to find hashtags"],
      ["https://adshortsai.com/en/on-screen-text-for-youtube-shorts/", "on-screen text"],
    ],
    growth: [
      ["https://adshortsai.com/en/how-often-to-post-youtube-shorts/", "how often to post Shorts"],
      ["https://adshortsai.com/en/when-to-post-youtube-shorts/", "when to post Shorts"],
      ["https://adshortsai.com/en/how-to-drive-traffic-from-shorts-to-telegram/", "traffic from Shorts to Telegram"],
      ["https://adshortsai.com/en/youtube-shorts-for-online-school/", "Shorts for online schools"],
    ],
    strategy: [
      ["https://adshortsai.com/en/ai-for-youtube-shorts/", "AI for Shorts"],
      ["https://adshortsai.com/en/how-to-test-youtube-shorts/", "how to test YouTube Shorts"],
      ["https://adshortsai.com/en/how-to-make-a-youtube-shorts-series/", "YouTube Shorts series"],
      ["https://adshortsai.com/en/youtube-shorts-analytics-how-to-read/", "Shorts analytics"],
    ],
  },
};

const getLinks = (locale, category, canonical) => {
  const seen = new Set([canonical]);
  const candidates = [...linkSets[locale].base, ...linkSets[locale][category], ...linkSets[locale].strategy];

  return candidates.filter(([href]) => {
    if (seen.has(href)) return false;
    seen.add(href);
    return true;
  }).slice(0, 7);
};

const renderBoostBlock = ({ locale, h1, category, canonical }) => {
  const links = getLinks(locale, category, canonical);
  const title = escapeHtml(h1);

  if (locale === "en") {
    return `          <!-- seo-index-boost:start -->
          <section class="article-index-boost" aria-labelledby="index-boost-heading">
            <h2 id="index-boost-heading">Next steps after this guide</h2>
            <p>
              Use this “${title}” guide as one part of a Shorts testing loop: fix the page-specific issue, publish a clean version, then compare the hook, retention, and click path before making the next edit.
            </p>
            <ul>
${links.map(([href, label]) => `              <li><a href="${href}">${escapeHtml(label)}</a></li>`).join("\n")}
            </ul>
            <p>
              For a faster production test, open <a href="https://adshortsai.com/en/examples/">examples</a> or build a version in <a href="https://adshortsai.com/en/app/studio?source=seo_index_boost">AdShorts AI Studio</a>.
            </p>
          </section>
          <!-- seo-index-boost:end -->
`;
  }

  return `          <!-- seo-index-boost:start -->
          <section class="article-index-boost" aria-labelledby="index-boost-heading">
            <h2 id="index-boost-heading">Что сделать после этого гайда</h2>
            <p>
              Используйте материал «${title}» как часть цикла тестирования Shorts: исправьте конкретную проблему, выпустите чистую версию, затем сравните хук, удержание и переходы перед следующей правкой.
            </p>
            <ul>
${links.map(([href, label]) => `              <li><a href="${href}">${escapeHtml(label)}</a></li>`).join("\n")}
            </ul>
            <p>
              Чтобы быстрее проверить гипотезу, откройте <a href="https://adshortsai.com/examples/">примеры Shorts</a> или соберите тестовую версию в <a href="https://adshortsai.com/app/studio?source=seo_index_boost">студии AdShorts AI</a>.
            </p>
          </section>
          <!-- seo-index-boost:end -->
`;
};

const addBoostBlock = (html, block) => {
  const cleaned = stripBlock(html, "seo-index-boost");
  const anchor = /\n\s*<h2>(Читайте также|Read also)<\/h2>/;

  if (anchor.test(cleaned)) {
    return cleaned.replace(anchor, `\n${block}$&`);
  }

  return cleaned.replace(/\n\s*<\/div>\s*\n\s*<\/section>\s*\n\s*<\/main>/, `\n${block}$&`);
};

const addArticleDateModified = (html) => {
  if (/"dateModified"\s*:/.test(html)) return html;

  return html.replace(
    /("inLanguage":\s*"[^"]+",)/,
    `$1
      "dateModified": "${dateModified}",
      "author": {
        "@type": "Organization",
        "name": "AdShorts AI"
      },`,
  );
};

const renderBreadcrumbJsonLd = ({ locale, h1, canonical }) => {
  const home = locale === "en" ? `${siteOrigin}/en/` : `${siteOrigin}/`;
  const guideHub = locale === "en" ? `${siteOrigin}/en/shorts-guides/` : `${siteOrigin}/shorts-guides/`;
  const guideHubName = locale === "en" ? "YouTube Shorts Guides" : "Гайды по YouTube Shorts";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "AdShorts AI",
        item: home,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: guideHubName,
        item: guideHub,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: h1,
        item: canonical,
      },
    ],
  };

  return `    <!-- seo-breadcrumb-jsonld:start -->
    <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 6).replace(/^/gm, "    ")}
    </script>
    <!-- seo-breadcrumb-jsonld:end -->
`;
};

const addBreadcrumbJsonLd = (html, data) => {
  const cleaned = stripBlock(html, "seo-breadcrumb-jsonld");
  return cleaned.replace(/\n\s*<\/head>/, `\n${renderBreadcrumbJsonLd(data)}  </head>`);
};

const processTargetPage = async (urlString) => {
  const route = routeForUrl(urlString);
  const filePath = localFileForRoute(route);
  const locale = route.startsWith("/en/") ? "en" : "ru";
  const category = classifyPage(route);
  let html = await readFile(filePath, "utf8");
  const h1 = extractTagText(html, "h1");
  const canonical = extractCanonical(html);

  if (!h1) throw new Error(`${route}: missing h1`);
  if (canonical !== urlString) throw new Error(`${route}: canonical mismatch: ${canonical}`);

  html = normalizeTrailingSlashLinks(html);
  html = addArticleDateModified(html);
  html = addBreadcrumbJsonLd(html, { locale, h1, canonical });
  html = addBoostBlock(html, renderBoostBlock({ locale, h1, category, canonical }));

  await writeFile(filePath, html);
  return path.relative(rootDir, filePath);
};

const processAllStaticHtmlLinks = async () => {
  const files = [];

  const walk = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".") || ["app", "node_modules"].includes(entry.name)) continue;
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        files.push(entryPath);
      }
    }
  };

  await walk(rootDir);

  let changed = 0;
  for (const filePath of files) {
    const original = await readFile(filePath, "utf8");
    const next = normalizeTrailingSlashLinks(original);
    if (next === original) continue;
    await writeFile(filePath, next);
    changed += 1;
  }

  return changed;
};

const changedTargetFiles = [];
for (const urlString of crawledNotIndexedUrls) {
  changedTargetFiles.push(await processTargetPage(urlString));
}

const normalizedFilesCount = await processAllStaticHtmlLinks();

console.log(
  [
    `Boosted ${changedTargetFiles.length} crawled-but-not-indexed pages.`,
    `Normalized trailing-slash nav links in ${normalizedFilesCount} static HTML files.`,
    ...changedTargetFiles.map((file) => `- ${file}`),
  ].join("\n"),
);
