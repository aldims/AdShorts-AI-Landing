import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteOrigin = "https://adshortsai.com";
const dateModified = "2026-05-22";

const priorityRoutes = [
  "/en/faceless-youtube-shorts/",
  "/en/youtube-shorts-swipe-away-rate/",
  "/shorts-chernye-polosy/",
  "/en/youtube-shorts-for-lawyers/",
  "/kak-ubrat-tryasku-v-shorts/",
  "/shorts-ne-nabirayut-prosmotry/",
  "/shorts-dlya-kliniki/",
  "/kak-chasto-vykladyvat-shorts/",
  "/en/how-to-create-a-hook-in-shorts/",
  "/en/keywords-for-youtube-shorts/",
  "/analitika-youtube-shorts-kak-chitat/",
  "/bitreyt-dlya-shorts/",
  "/cta-v-shorts/",
  "/en/cta-in-youtube-shorts/",
  "/en/do-hashtags-work-for-youtube-shorts/",
  "/en/how-much-does-shorts-editing-cost/",
  "/en/how-to-add-a-link-in-shorts/",
  "/en/how-to-add-a-mid-video-twist-in-shorts/",
  "/en/how-to-analyze-retention-in-shorts/",
  "/en/low-retention-on-youtube-shorts/",
  "/en/youtube-shorts-getting-0-views/",
  "/en/youtube-shorts-wont-upload/",
  "/en/how-to-increase-retention-in-shorts/",
];

const metaOverrides = {
  "/en/low-retention-on-youtube-shorts/": {
    title: "Low Retention on YouTube Shorts: Fix First 3 Seconds",
    description:
      "Diagnose low retention on YouTube Shorts: first-second drops, pacing, text and audio issues, plus hook tests to run before your next upload.",
  },
  "/en/youtube-shorts-getting-0-views/": {
    title: "Shorts Getting 0 Views: Checks Before You Reupload",
    description:
      "Shorts getting 0 views? Check visibility, format, moderation, first frame and retention signals before deleting, reuploading or changing strategy.",
  },
  "/en/youtube-shorts-swipe-away-rate/": {
    title: "YouTube Shorts Swipe Away Rate: Fix the First 3 Seconds",
    description:
      "Lower YouTube Shorts swipe-away rate with clearer first frames, stronger hooks, faster pacing and a simple test plan for the next upload.",
  },
  "/en/how-to-analyze-retention-in-shorts/": {
    title: "How to Analyze Shorts Retention: Read Drops and Fix Them",
    description:
      "Learn how to analyze Shorts retention graphs: first-second drops, middle drop-offs, weak endings, rewatches and which edit to test first.",
  },
  "/en/how-to-increase-retention-in-shorts/": {
    title: "Increase YouTube Shorts Retention: 7 Edits to Test",
    description:
      "Increase YouTube Shorts retention with stronger first seconds, clearer on-screen text, pacing changes, audio fixes, loops and A/B test ideas.",
  },
  "/en/youtube-shorts-wont-upload/": {
    title: "YouTube Shorts Won't Upload: Format, File and App Checks",
    description:
      "YouTube Shorts won't upload? Check file format, aspect ratio, length, app errors, copyright blocks and export settings before re-rendering.",
  },
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const routeToFile = (route) => path.join(rootDir, route.replace(/^\//, ""), "index.html");

const routeToCanonical = (route) => `${siteOrigin}${route}`;

const extractTagText = (html, tagName) =>
  new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i")
    .exec(html)?.[1]
    ?.replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim() ?? "";

const extractCanonical = (html) =>
  /<link\s+rel="canonical"\s+href="([^"]+)"/i.exec(html)?.[1] ?? "";

const extractTitle = (html) => /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";

const extractMetaDescription = (html) =>
  /<meta\s+name="description"\s+content="([^"]*)"\s*\/?>/i.exec(html)?.[1] ?? "";

const stripBlock = (html, name) =>
  html.replace(new RegExp(`\\n?\\s*<!-- ${escapeRegExp(name)}:start -->[\\s\\S]*?<!-- ${escapeRegExp(name)}:end -->\\n?`, "g"), "\n");

const setTitle = (html, title) =>
  html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

const setNamedMeta = (html, name, content) => {
  const pattern = new RegExp(`<meta\\s+name="${escapeRegExp(name)}"\\s+content="[^"]*"\\s*/?>`, "i");
  const replacement = `<meta name="${name}" content="${escapeHtml(content)}" />`;
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
};

const setPropertyMeta = (html, property, content) => {
  const pattern = new RegExp(`<meta\\s+property="${escapeRegExp(property)}"\\s+content="[^"]*"\\s*/?>`, "i");
  const replacement = `<meta property="${property}" content="${escapeHtml(content)}" />`;
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
};

const renderJsonLd = (data) => JSON.stringify(data, null, 6).replace(/^/gm, "    ");

const getJsonLdType = (data) => {
  if (!data || typeof data !== "object") return "";
  const type = data["@type"];
  return Array.isArray(type) ? type.join(" ") : String(type ?? "");
};

const hasJsonLdType = (html, typeName) => {
  const scripts = html.matchAll(/<script\s+type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi);
  for (const match of scripts) {
    try {
      const data = JSON.parse(match[1]);
      if (getJsonLdType(data).includes(typeName)) return true;
    } catch {
      // Ignore non-JSON snippets; the audit will catch critical pages separately.
    }
  }
  return false;
};

const updateArticleJsonLd = (html, locale, { headline, description }) =>
  html.replace(/\n?\s*<script\s+type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi, (match, rawJson) => {
    try {
      const data = JSON.parse(rawJson);
      if (!getJsonLdType(data).includes("Article")) return match;
      if (headline) data.headline = headline;
      if (description) data.description = description;
      data.dateModified = dateModified;
      data.author = {
        "@type": "Organization",
        name: "AdShorts AI",
        url: locale === "en" ? `${siteOrigin}/en/` : `${siteOrigin}/`,
      };
      return `\n    <script type="application/ld+json">\n${renderJsonLd(data)}\n    </script>`;
    } catch {
      return match;
    }
  });

const classifyPage = (route) => {
  const slug = route.toLowerCase();

  if (/upload|zagruzh|format|bitreyt|black|chern|copyright|music|muzyka|phone|telefon|background|fon|shake|tryask|audio|zvuk/.test(slug)) {
    return "production";
  }

  if (/views|prosmotr|0-views|likes|layk|subscriber|podpisch|channel|retention|uderzhan|swipe|prolist/.test(slug)) {
    return "performance";
  }

  if (/description|opisanie|keyword|heshteg|hashtag|title|zagolovok|hook|tekst|script|cta|link/.test(slug)) {
    return "text";
  }

  if (/traffic|monetization|school|shkol|post|chasto|often|clinic|kliniki|lawyer|yurist|cost|editing/.test(slug)) {
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
      ["https://adshortsai.com/gromkost-golosa-i-muzyki-v-shorts/", "баланс голоса и музыки"],
      ["https://adshortsai.com/subtitry-dlya-shorts-avtomatom/", "автоматические субтитры"],
    ],
    performance: [
      ["https://adshortsai.com/shorts-ne-nabirayut-prosmotry/", "почему Shorts не набирают просмотры"],
      ["https://adshortsai.com/kak-podnyat-uderzhanie-v-shorts/", "как поднять удержание"],
      ["https://adshortsai.com/procent-prolistyvaniy-shorts/", "процент пролистываний Shorts"],
      ["https://adshortsai.com/kak-testirovat-shorts/", "как тестировать Shorts"],
    ],
    text: [
      ["https://adshortsai.com/kak-sdelat-huk-v-shorts/", "хук для Shorts"],
      ["https://adshortsai.com/klyuchevye-slova-dlya-shorts/", "ключевые слова для Shorts"],
      ["https://adshortsai.com/kak-naiti-heshtegi-dlya-shorts/", "как найти хештеги"],
      ["https://adshortsai.com/kak-sdelat-tekst-na-video-dlya-shorts/", "текст на видео"],
    ],
    growth: [
      ["https://adshortsai.com/kak-chasto-vykladyvat-shorts/", "как часто выкладывать Shorts"],
      ["https://adshortsai.com/kak-privesti-trafik-iz-shorts-v-telegram/", "трафик из Shorts в Telegram"],
      ["https://adshortsai.com/shorts-dlya-biznesa/", "Shorts для бизнеса"],
      ["https://adshortsai.com/kak-prodavat-cherez-shorts/", "как продавать через Shorts"],
    ],
    strategy: [
      ["https://adshortsai.com/neyroset-dlya-shorts/", "нейросеть для Shorts"],
      ["https://adshortsai.com/kak-sdelat-seriyu-shorts/", "серия Shorts"],
      ["https://adshortsai.com/analitika-youtube-shorts-kak-chitat/", "аналитика Shorts"],
      ["https://adshortsai.com/kak-testirovat-shorts/", "как тестировать Shorts"],
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
      ["https://adshortsai.com/en/voice-and-music-volume-in-shorts/", "voice and music volume"],
      ["https://adshortsai.com/en/automatic-subtitles-for-youtube-shorts/", "automatic subtitles"],
    ],
    performance: [
      ["https://adshortsai.com/en/low-retention-on-youtube-shorts/", "low retention in Shorts"],
      ["https://adshortsai.com/en/youtube-shorts-not-getting-views/", "why Shorts are not getting views"],
      ["https://adshortsai.com/en/youtube-shorts-swipe-away-rate/", "Shorts swipe-away rate"],
      ["https://adshortsai.com/en/how-to-test-youtube-shorts/", "how to test YouTube Shorts"],
    ],
    text: [
      ["https://adshortsai.com/en/how-to-create-a-hook-in-shorts/", "hook for Shorts"],
      ["https://adshortsai.com/en/keywords-for-youtube-shorts/", "keywords for Shorts"],
      ["https://adshortsai.com/en/how-to-find-hashtags-for-shorts/", "how to find hashtags"],
      ["https://adshortsai.com/en/on-screen-text-for-youtube-shorts/", "on-screen text"],
    ],
    growth: [
      ["https://adshortsai.com/en/how-often-to-post-youtube-shorts/", "how often to post Shorts"],
      ["https://adshortsai.com/en/how-to-drive-traffic-from-shorts-to-telegram/", "traffic from Shorts to Telegram"],
      ["https://adshortsai.com/en/how-to-sell-with-youtube-shorts/", "how to sell with Shorts"],
      ["https://adshortsai.com/en/youtube-shorts-for-online-school/", "Shorts for online schools"],
    ],
    strategy: [
      ["https://adshortsai.com/en/ai-for-youtube-shorts/", "AI for Shorts"],
      ["https://adshortsai.com/en/how-to-make-a-youtube-shorts-series/", "YouTube Shorts series"],
      ["https://adshortsai.com/en/youtube-shorts-analytics-how-to-read/", "Shorts analytics"],
      ["https://adshortsai.com/en/how-to-test-youtube-shorts/", "how to test YouTube Shorts"],
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
  }).slice(0, 8);
};

const getFaq = ({ locale, h1, category }) => {
  if (locale === "en") {
    const firstAction = {
      production: "Check the file, frame, text readability and audio before changing the whole concept.",
      performance: "Test the first frame and first two seconds before rewriting the whole video.",
      text: "Make the viewer promise clear first, then test wording, subtitles and the ending CTA.",
      growth: "Turn the topic into a repeatable series and keep one clear next step for viewers.",
      strategy: "Pick one repeatable format, publish several variants, then compare retention and clicks.",
    }[category];
    return [
      [`What should I test first after this ${h1} guide?`, firstAction],
      [
        "How do I know the change worked?",
        "Compare one metric before and after the change: swipe-away rate for the opening, retention for the middle, and clicks or inquiries for the CTA.",
      ],
    ];
  }

  const firstAction = {
    production: "Проверьте файл, кадр, читаемость текста и звук до того, как менять всю идею ролика.",
    performance: "Сначала протестируйте первый кадр и первые две секунды, а не переписывайте весь ролик.",
    text: "Сначала сделайте понятным обещание для зрителя, затем тестируйте формулировку, субтитры и CTA.",
    growth: "Соберите тему в повторяемую серию и оставьте один понятный следующий шаг для зрителя.",
    strategy: "Выберите один повторяемый формат, выпустите несколько вариантов и сравните удержание и клики.",
  }[category];

  return [
    [`Что проверить первым после гайда «${h1}»?`, firstAction],
    [
      "Как понять, что правка сработала?",
      "Сравните одну метрику до и после изменения: пролистывания для начала ролика, удержание для середины и клики или заявки для CTA.",
    ],
  ];
};

const renderFaqBlock = ({ locale, faq }) => {
  const heading = locale === "en" ? "Quick FAQ for the next test" : "Короткий FAQ для следующего теста";
  return `          <!-- seo-sprint-faq:start -->
          <section class="article-faq" aria-labelledby="seo-sprint-faq-heading">
            <h2 id="seo-sprint-faq-heading">${heading}</h2>
${faq
  .map(
    ([question, answer]) => `            <h3>${escapeHtml(question)}</h3>
            <p>${escapeHtml(answer)}</p>`,
  )
  .join("\n")}
          </section>
          <!-- seo-sprint-faq:end -->
`;
};

const renderBoostBlock = ({ locale, h1, category, canonical }) => {
  const links = getLinks(locale, category, canonical);
  const escapedTitle = escapeHtml(h1);

  if (locale === "en") {
    return `          <!-- seo-index-boost:start -->
          <section class="article-index-boost" aria-labelledby="index-boost-heading">
            <h2 id="index-boost-heading">Next tests after this guide</h2>
            <p>
              Treat “${escapedTitle}” as one test in a Shorts loop: define the exact viewer problem, change one visible thing, publish a clean version, then compare retention and clicks before making the next edit.
            </p>
            <ul>
${links.map(([href, label]) => `              <li><a href="${href}">${escapeHtml(label)}</a></li>`).join("\n")}
            </ul>
            <p>
              Before publishing, write one hypothesis: what should improve and why. For a faster variant, open <a href="https://adshortsai.com/en/examples/">examples</a> or build the next version in <a href="https://adshortsai.com/en/app/studio?source=seo_growth_sprint">AdShorts AI Studio</a>.
            </p>
          </section>
          <!-- seo-index-boost:end -->
`;
  }

  return `          <!-- seo-index-boost:start -->
          <section class="article-index-boost" aria-labelledby="index-boost-heading">
            <h2 id="index-boost-heading">Следующие тесты после этого гайда</h2>
            <p>
              Используйте материал «${escapedTitle}» как один тест в цикле Shorts: зафиксируйте конкретную проблему зрителя, измените один видимый элемент, выпустите чистую версию и сравните удержание и клики перед следующей правкой.
            </p>
            <ul>
${links.map(([href, label]) => `              <li><a href="${href}">${escapeHtml(label)}</a></li>`).join("\n")}
            </ul>
            <p>
              Перед публикацией запишите одну гипотезу: что должно улучшиться и почему. Чтобы быстрее собрать вариант, откройте <a href="https://adshortsai.com/examples/">примеры</a> или сделайте следующую версию в <a href="https://adshortsai.com/app/studio?source=seo_growth_sprint">студии AdShorts AI</a>.
            </p>
          </section>
          <!-- seo-index-boost:end -->
`;
};

const renderBreadcrumbJsonLd = ({ locale, h1, canonical }) => {
  const home = locale === "en" ? `${siteOrigin}/en/` : `${siteOrigin}/`;
  const guideHub = locale === "en" ? `${siteOrigin}/en/shorts-guides/` : `${siteOrigin}/shorts-guides/`;
  const guideHubName = locale === "en" ? "YouTube Shorts Guides" : "Гайды по YouTube Shorts";

  return {
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
};

const renderFaqJsonLd = (faq) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
});

const addJsonLdBlock = (html, name, data) => {
  const cleaned = stripBlock(html, name);
  const block = `    <!-- ${name}:start -->
    <script type="application/ld+json">
${renderJsonLd(data)}
    </script>
    <!-- ${name}:end -->
`;
  return cleaned.replace(/\n\s*<\/head>/, `\n${block}  </head>`);
};

const addBeforeReadAlso = (html, block) => {
  const anchor = /\n\s*<h2>(Читайте также|Read also)<\/h2>/;
  if (anchor.test(html)) {
    return html.replace(anchor, `\n${block}$&`);
  }

  return html.replace(/\n\s*<\/div>\s*\n\s*<\/section>\s*\n\s*<\/main>/, `\n${block}$&`);
};

const processPage = async (route) => {
  const filePath = routeToFile(route);
  const locale = route.startsWith("/en/") ? "en" : "ru";
  const canonical = routeToCanonical(route);
  const category = classifyPage(route);
  let html = await readFile(filePath, "utf8");
  const h1 = extractTagText(html, "h1");
  const currentCanonical = extractCanonical(html);

  if (!h1) throw new Error(`${route}: missing H1`);
  if (currentCanonical !== canonical) throw new Error(`${route}: canonical mismatch: ${currentCanonical}`);

  const meta = metaOverrides[route];
  if (meta) {
    html = setTitle(html, meta.title);
    html = setNamedMeta(html, "description", meta.description);
    html = setPropertyMeta(html, "og:title", meta.title);
    html = setPropertyMeta(html, "og:description", meta.description);
    html = setNamedMeta(html, "twitter:title", meta.title);
    html = setNamedMeta(html, "twitter:description", meta.description);
  }

  html = updateArticleJsonLd(html, locale, {
    headline: meta?.title ?? extractTitle(html),
    description: meta?.description ?? extractMetaDescription(html),
  });

  if (!hasJsonLdType(html, "BreadcrumbList")) {
    html = addJsonLdBlock(html, "seo-breadcrumb-jsonld", renderBreadcrumbJsonLd({ locale, h1, canonical }));
  }

  const faq = getFaq({ locale, h1, category });
  html = addJsonLdBlock(html, "seo-sprint-faq-jsonld", renderFaqJsonLd(faq));
  html = stripBlock(html, "seo-sprint-faq");
  html = stripBlock(html, "seo-index-boost");
  html = addBeforeReadAlso(html, renderBoostBlock({ locale, h1, category, canonical }));
  html = addBeforeReadAlso(html, renderFaqBlock({ locale, faq }));

  await writeFile(filePath, html);
  return path.relative(rootDir, filePath);
};

const updateSitemapLastmod = async (routes) => {
  const sitemapPath = path.join(rootDir, "sitemap.xml");
  let sitemap = await readFile(sitemapPath, "utf8");
  let updated = 0;

  for (const route of routes) {
    const canonical = routeToCanonical(route);
    const pattern = new RegExp(`(<loc>${escapeRegExp(canonical)}<\\/loc>[\\s\\S]*?<lastmod>)([^<]+)(<\\/lastmod>)`);
    if (!pattern.test(sitemap)) {
      throw new Error(`sitemap.xml: missing lastmod block for ${canonical}`);
    }
    sitemap = sitemap.replace(pattern, (_match, before, current, after) => {
      if (current === dateModified) return `${before}${current}${after}`;
      updated += 1;
      return `${before}${dateModified}${after}`;
    });
  }

  await writeFile(sitemapPath, sitemap);
  return updated;
};

const changed = [];
for (const route of priorityRoutes) {
  changed.push(await processPage(route));
}
const updatedSitemapLastmods = await updateSitemapLastmod(priorityRoutes);

console.log(
  [
    `SEO organic growth sprint updated ${changed.length} priority pages.`,
    `Updated ${updatedSitemapLastmods} sitemap lastmod values to ${dateModified}.`,
    ...changed.map((file) => `- ${file}`),
  ].join("\n"),
);
