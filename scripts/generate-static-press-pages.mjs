#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteOrigin = "https://adshortsai.com";
const dateModified = "2026-05-23";
const cssVersion = 55;
const scriptVersion = 8;
const logoUrl = `${siteOrigin}/logo.png?v=2`;

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const renderJsonLd = (data) => JSON.stringify(data, null, 2).replace(/^/gm, "    ");

const renderYandexMetrikaCounter = () => `    <!-- Yandex.Metrika counter -->
    <script type="text/javascript">
      (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {
          if (document.scripts[j].src === r) { return; }
        }
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
      })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=109093136', 'ym');

      ym(109093136, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
    </script>
    <noscript><div><img src="https://mc.yandex.ru/watch/109093136" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
    <!-- /Yandex.Metrika counter -->`;

const pages = [
  {
    locale: "ru",
    lang: "ru",
    dir: "press",
    assetPrefix: "../",
    canonical: `${siteOrigin}/press/`,
    alternateRu: `${siteOrigin}/press/`,
    alternateEn: `${siteOrigin}/en/press/`,
    title: "AdShorts AI: пресс-кит и описание продукта",
    description:
      "Пресс-кит AdShorts AI: описание продукта, логотип, категории, факты, контакты и готовые тексты для каталогов, обзоров и публикаций.",
    ogTitle: "AdShorts AI Press Kit",
    ogDescription: "Факты, описание, логотип и контакты AdShorts AI для каталогов, обзоров и медиа.",
    langHref: "../en/press/",
    langLabel: "English",
    nav: {
      home: "Главная",
      examples: "Примеры",
      guides: "Гайды",
      pricing: "Тарифы",
      studio: "Студия",
      signIn: "Войти",
      menu: "Меню",
    },
    links: {
      home: "../",
      examples: "../examples/",
      guides: "../shorts-guides/",
      pricing: "../pricing/",
      studio: "../app/studio?source=press_ru",
      contact: "../contacts/",
      language: "../en/press/",
      privacy: "../privacy/",
      terms: "../terms/",
      offer: "../offer/",
    },
    heroEyebrow: "Press kit",
    h1: "Пресс-кит AdShorts AI",
    lead:
      "Краткое описание продукта, факты, логотип, категории и готовые тексты для каталогов, обзоров, подборок AI-инструментов и публикаций.",
    primaryCta: "Открыть продукт",
    secondaryCta: "Логотип",
    factsTitle: "Коротко о продукте",
    facts: [
      ["Название", "AdShorts AI"],
      ["Категория", "AI video generator, YouTube Shorts, short-form video"],
      ["Сайт", "https://adshortsai.com"],
      ["Формат", "Web studio + Telegram bot"],
      ["Аудитория", "Создатели YouTube, SMM, малый бизнес, агентства"],
      ["Контакт", "support@adshortsai.com"],
    ],
    descriptionTitle: "Описание для публикаций",
    productDescription:
      "AdShorts AI помогает создавать вертикальные видео для YouTube Shorts, Instagram Reels и TikTok из темы или короткого брифа. Сервис собирает сценарий, озвучку, субтитры, музыку, визуальный фон и готовый ролик, который можно доработать в студии и использовать для регулярного контент-плана.",
    featureTitle: "Что делает AdShorts AI",
    features: [
      "Генерирует сценарий короткого ролика по теме или офферу.",
      "Добавляет озвучку, субтитры, музыку и видеофон.",
      "Помогает быстро выпускать серии Shorts без ручного монтажа с нуля.",
      "Подходит для теста идей, прогрева аудитории и привлечения трафика из коротких видео.",
    ],
    assetTitle: "Материалы",
    assets: [
      ["Логотип", `${siteOrigin}/logo.png?v=2`, "PNG 512x512"],
      ["Open Graph", `${siteOrigin}/og-image.svg`, "SVG preview"],
      ["Примеры роликов", `${siteOrigin}/examples/`, "Видео-демо"],
      ["Тарифы", `${siteOrigin}/pricing/`, "Планы и лимиты"],
    ],
    directoryTitle: "Готовые тексты для каталогов",
    copyBlocks: [
      ["One-liner", "AdShorts AI creates YouTube Shorts, Reels and TikTok videos from an idea with AI script, voiceover, subtitles and visuals."],
      [
        "Short description",
        "AdShorts AI is an AI video maker for short-form content. It turns a topic or offer into a vertical video with script, voiceover, subtitles, music and visuals, then lets creators edit and publish faster.",
      ],
      ["Tags", "AI video generator, YouTube Shorts, Reels, TikTok, faceless videos, subtitles, social media, creator tools"],
    ],
    contactTitle: "Контакт",
    contactText:
      "Для каталогов, подборок, обзоров, партнёрств и уточнения фактов используйте support@adshortsai.com. В описаниях можно ссылаться на эту страницу как на официальный press kit.",
    footerNote: "Официальные материалы AdShorts AI для каталогов, медиа и партнёров.",
  },
  {
    locale: "en",
    lang: "en",
    dir: "en/press",
    assetPrefix: "../../",
    canonical: `${siteOrigin}/en/press/`,
    alternateRu: `${siteOrigin}/press/`,
    alternateEn: `${siteOrigin}/en/press/`,
    title: "AdShorts AI Press Kit: AI Shorts Generator",
    description:
      "Press kit for AdShorts AI: product description, logo, categories, facts, contact details and ready-to-use copy for directories and reviews.",
    ogTitle: "AdShorts AI Press Kit",
    ogDescription: "Product facts, logo, descriptions and contact details for directories, reviews and media.",
    langHref: "../../press/",
    langLabel: "Русский",
    nav: {
      home: "Home",
      examples: "Examples",
      guides: "Guides",
      pricing: "Pricing",
      studio: "Studio",
      signIn: "Sign in",
      menu: "Menu",
    },
    links: {
      home: "../../en/",
      examples: "../../en/examples/",
      guides: "../../en/shorts-guides/",
      pricing: "../../en/pricing/",
      studio: "../../en/app/studio?source=press_en",
      contact: "../../en/contact/",
      language: "../../press/",
      privacy: "../../en/privacy/",
      terms: "../../en/terms/",
      offer: "../../offer/",
    },
    heroEyebrow: "Press kit",
    h1: "AdShorts AI Press Kit",
    lead:
      "A concise product profile with facts, logo links, category data and ready-to-use copy for AI directories, reviews, launch platforms and media mentions.",
    primaryCta: "Open product",
    secondaryCta: "Logo",
    factsTitle: "Quick facts",
    facts: [
      ["Product", "AdShorts AI"],
      ["Category", "AI video generator, YouTube Shorts, short-form video"],
      ["Website", "https://adshortsai.com/en/"],
      ["Format", "Web studio + Telegram bot"],
      ["Audience", "YouTube creators, social media teams, small businesses, agencies"],
      ["Contact", "support@adshortsai.com"],
    ],
    descriptionTitle: "Product description",
    productDescription:
      "AdShorts AI helps creators and teams generate vertical videos for YouTube Shorts, Instagram Reels and TikTok from a topic or short brief. The product creates a script, voiceover, subtitles, music, visuals and a ready-to-edit short-form video for repeatable content workflows.",
    featureTitle: "What AdShorts AI does",
    features: [
      "Generates short-form video scripts from a topic, idea or offer.",
      "Adds voiceover, subtitles, music and visual backgrounds.",
      "Helps creators publish batches of Shorts without editing every video from scratch.",
      "Supports content testing, audience growth and traffic from short-form video.",
    ],
    assetTitle: "Assets",
    assets: [
      ["Logo", `${siteOrigin}/logo.png?v=2`, "PNG 512x512"],
      ["Open Graph", `${siteOrigin}/og-image.svg`, "SVG preview"],
      ["Video examples", `${siteOrigin}/en/examples/`, "Demo videos"],
      ["Pricing", `${siteOrigin}/en/pricing/`, "Plans and limits"],
    ],
    directoryTitle: "Directory copy",
    copyBlocks: [
      ["One-liner", "AdShorts AI creates YouTube Shorts, Reels and TikTok videos from an idea with AI script, voiceover, subtitles and visuals."],
      [
        "Short description",
        "AdShorts AI is an AI video maker for short-form content. It turns a topic or offer into a vertical video with script, voiceover, subtitles, music and visuals, then lets creators edit and publish faster.",
      ],
      ["Tags", "AI video generator, YouTube Shorts, Reels, TikTok, faceless videos, subtitles, social media, creator tools"],
    ],
    contactTitle: "Contact",
    contactText:
      "For directories, roundups, reviews, partnerships and factual updates, contact support@adshortsai.com. This page can be used as the official source for product descriptions and media assets.",
    footerNote: "Official AdShorts AI materials for directories, media and partners.",
  },
];

const renderStructuredData = (page) => [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AdShorts AI",
    url: siteOrigin,
    logo: logoUrl,
    contactPoint: {
      "@type": "ContactPoint",
      email: "support@adshortsai.com",
      contactType: "press and customer support",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AdShorts AI",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web, Telegram",
    url: page.locale === "en" ? `${siteOrigin}/en/` : `${siteOrigin}/`,
    image: logoUrl,
    description: page.productDescription,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: page.locale === "en" ? "USD" : "RUB",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.description,
    url: page.canonical,
    inLanguage: page.lang,
    dateModified,
    isPartOf: {
      "@type": "WebSite",
      name: "AdShorts AI",
      url: siteOrigin,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "AdShorts AI",
        item: page.locale === "en" ? `${siteOrigin}/en/` : `${siteOrigin}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Press Kit",
        item: page.canonical,
      },
    ],
  },
];

const renderCopyCards = (page) =>
  page.copyBlocks
    .map(
      ([label, value]) => `              <article class="press-copy-card">
                <h3>${escapeHtml(label)}</h3>
                <p>${escapeHtml(value)}</p>
              </article>`,
    )
    .join("\n");

const renderFacts = (page) =>
  page.facts
    .map(
      ([label, value]) => `              <div class="press-fact">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>`,
    )
    .join("\n");

const renderAssets = (page) =>
  page.assets
    .map(
      ([label, href, meta]) => `              <a class="press-asset" href="${escapeHtml(href)}">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(meta)}</strong>
              </a>`,
    )
    .join("\n");

const renderFeatures = (page) =>
  page.features.map((feature) => `              <li>${escapeHtml(feature)}</li>`).join("\n");

const renderPage = (page) => {
  const structuredData = renderStructuredData(page)
    .map((data) => `    <script type="application/ld+json">\n${renderJsonLd(data)}\n    </script>`)
    .join("\n");
  const ruLangHref = page.locale === "ru" ? "./" : "../../press/";
  const enLangHref = page.locale === "en" ? "./" : "../en/press/";
  const currentLangLabel = page.locale === "ru" ? "Язык: Русский" : "Language: English";

  return `<!doctype html>
<html lang="${page.lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${page.canonical}" />
    <link rel="alternate" hreflang="ru" href="${page.alternateRu}" />
    <link rel="alternate" hreflang="en" href="${page.alternateEn}" />
    <link rel="alternate" hreflang="x-default" href="${page.alternateRu}" />
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${page.canonical}" />
    <meta property="og:title" content="${escapeHtml(page.ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(page.ogDescription)}" />
    <meta property="og:image" content="${logoUrl}" />
    <meta property="og:site_name" content="AdShorts AI" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.ogTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(page.ogDescription)}" />
    <meta name="twitter:image" content="${logoUrl}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="${page.assetPrefix}styles.css?v=${cssVersion}" />
    <link rel="preload" as="image" href="${logoUrl}" />
    <link rel="icon" type="image/png" sizes="120x120" href="${page.assetPrefix}favicon.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="${page.assetPrefix}favicon-48.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="${page.assetPrefix}favicon-16.png" />
    <link rel="icon" type="image/svg+xml" href="${page.assetPrefix}favicon.svg" />
    <link rel="shortcut icon" type="image/x-icon" href="${page.assetPrefix}favicon.ico" />
    <link rel="apple-touch-icon" href="${logoUrl}" />
    <style>
      .press-page {
        background:
          radial-gradient(circle at 12% 18%, rgba(0, 218, 255, 0.12), transparent 28rem),
          linear-gradient(180deg, rgba(7, 12, 24, 0.96), rgba(10, 18, 32, 0.98));
        color: #f8fbff;
      }

      .press-main {
        padding: 7rem 0 4rem;
      }

      .press-hero {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(18rem, 0.65fr);
        gap: clamp(1.5rem, 4vw, 4rem);
        align-items: start;
        margin-bottom: 3rem;
      }

      .press-eyebrow {
        color: #71e2ff;
        font-weight: 700;
        letter-spacing: 0;
        margin: 0 0 0.9rem;
        text-transform: uppercase;
      }

      .press-hero h1 {
        margin: 0;
        max-width: 15ch;
        font-size: clamp(2.6rem, 7vw, 5.5rem);
        line-height: 0.94;
      }

      .press-lead {
        max-width: 44rem;
        margin: 1.3rem 0 0;
        color: rgba(248, 251, 255, 0.78);
        font-size: clamp(1.05rem, 2vw, 1.3rem);
      }

      .press-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.85rem;
        margin-top: 1.8rem;
      }

      .press-panel,
      .press-section {
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.06);
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22);
      }

      .press-panel {
        border-radius: 18px;
        padding: 1.2rem;
      }

      .press-logo-card {
        display: grid;
        gap: 1rem;
        place-items: center;
        min-height: 18rem;
        text-align: center;
      }

      .press-logo-card img {
        width: min(9rem, 52vw);
        height: auto;
      }

      .press-logo-card strong {
        display: block;
        font-size: 1.35rem;
      }

      .press-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .press-section {
        border-radius: 20px;
        padding: clamp(1.2rem, 3vw, 2rem);
        margin-top: 1rem;
      }

      .press-section h2 {
        margin: 0 0 1rem;
        font-size: clamp(1.4rem, 3vw, 2.1rem);
      }

      .press-section p,
      .press-section li {
        color: rgba(248, 251, 255, 0.76);
      }

      .press-facts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .press-fact,
      .press-copy-card,
      .press-asset {
        border: 1px solid rgba(255, 255, 255, 0.11);
        border-radius: 14px;
        background: rgba(5, 10, 19, 0.35);
      }

      .press-fact {
        padding: 0.95rem;
      }

      .press-fact span,
      .press-asset span {
        display: block;
        margin-bottom: 0.4rem;
        color: rgba(248, 251, 255, 0.55);
        font-size: 0.82rem;
      }

      .press-fact strong,
      .press-asset strong {
        display: block;
        color: #ffffff;
        overflow-wrap: anywhere;
      }

      .press-copy-grid,
      .press-assets {
        display: grid;
        gap: 0.85rem;
      }

      .press-copy-card {
        padding: 1rem;
      }

      .press-copy-card h3 {
        margin: 0 0 0.55rem;
        font-size: 1rem;
      }

      .press-copy-card p {
        margin: 0;
      }

      .press-assets {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .press-asset {
        display: block;
        padding: 1rem;
        text-decoration: none;
        transition: transform 160ms ease, border-color 160ms ease;
      }

      .press-asset:hover {
        border-color: rgba(113, 226, 255, 0.55);
        transform: translateY(-2px);
      }

      .press-footer {
        padding: 2rem 0 3rem;
        color: rgba(248, 251, 255, 0.62);
      }

      .press-footer__links {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        margin-top: 0.7rem;
      }

      .press-footer__links a {
        color: rgba(248, 251, 255, 0.82);
      }

      @media (max-width: 820px) {
        .press-main {
          padding-top: 5rem;
        }

        .press-hero,
        .press-grid,
        .press-facts,
        .press-assets {
          grid-template-columns: 1fr;
        }

        .press-logo-card {
          min-height: 14rem;
        }
      }
    </style>
    <script defer src="${page.assetPrefix}script.js?v=${scriptVersion}"></script>
${renderYandexMetrikaCounter()}
${structuredData}
  </head>
  <body class="press-page">
    <header class="header header--app-static">
      <div class="container header__inner">
        <a class="logo" href="${page.links.home}" aria-label="AdShorts AI">
          <img class="logo__icon" src="${logoUrl}" alt="" role="presentation" width="46" height="46" />
          <span class="logo__wordmark">AdShorts<span>AI</span></span>
        </a>
        <nav class="nav" aria-label="Main navigation">
          <button class="nav__toggle" aria-expanded="false" aria-controls="nav-menu">${escapeHtml(page.nav.menu)}</button>
          <ul id="nav-menu" class="nav__list">
            <li><a href="${page.links.home}">${escapeHtml(page.nav.home)}</a></li>
            <li><a href="${page.links.examples}">${escapeHtml(page.nav.examples)}</a></li>
            <li><a href="${page.links.guides}">${escapeHtml(page.nav.guides)}</a></li>
            <li><a href="${page.links.pricing}">${escapeHtml(page.nav.pricing)}</a></li>
          </ul>
        </nav>
        <div class="header__actions">
          <details class="lang-switcher">
            <summary class="lang-switcher__trigger" aria-label="${escapeHtml(currentLangLabel)}" title="${escapeHtml(currentLangLabel)}">
              <svg class="lang-switcher__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
                <path d="M3 12h18M12 3c2.2 2.35 3.4 5.35 3.4 9s-1.2 6.65-3.4 9M12 3c-2.2 2.35-3.4 5.35-3.4 9s1.2 6.65 3.4 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
              <span>${page.locale.toUpperCase()}</span>
            </summary>
            <div class="lang-switcher__menu" role="menu" aria-label="Language selection">
              <a class="lang-switcher__option${page.locale === "ru" ? " is-active" : ""}" href="${ruLangHref}" role="menuitem" aria-label="RU Русский"${page.locale === "ru" ? ' aria-current="page"' : ""}>
                <span class="lang-switcher__code">RU</span>
                <span class="lang-switcher__label">Русский</span>
              </a>
              <a class="lang-switcher__option${page.locale === "en" ? " is-active" : ""}" href="${enLangHref}" role="menuitem" aria-label="EN English"${page.locale === "en" ? ' aria-current="page"' : ""}>
                <span class="lang-switcher__code">EN</span>
                <span class="lang-switcher__label">English</span>
              </a>
            </div>
          </details>
          <a class="header__signin-link" href="${page.links.studio}">${escapeHtml(page.nav.signIn)}</a>
        </div>
      </div>
    </header>

    <main class="press-main">
      <div class="container">
        <section class="press-hero">
          <div>
            <p class="press-eyebrow">${escapeHtml(page.heroEyebrow)}</p>
            <h1>${escapeHtml(page.h1)}</h1>
            <p class="press-lead">${escapeHtml(page.lead)}</p>
            <div class="press-actions">
              <a class="btn btn--primary btn--lg" href="${page.links.studio}">${escapeHtml(page.primaryCta)}</a>
              <a class="btn btn--ghost btn--lg" href="${logoUrl}">${escapeHtml(page.secondaryCta)}</a>
            </div>
          </div>
          <aside class="press-panel press-logo-card" aria-label="AdShorts AI logo">
            <img src="${logoUrl}" alt="AdShorts AI logo" width="180" height="180" />
            <div>
              <strong>AdShorts AI</strong>
              <span>${escapeHtml(page.facts[1][1])}</span>
            </div>
          </aside>
        </section>

        <section class="press-section">
          <h2>${escapeHtml(page.factsTitle)}</h2>
          <div class="press-facts">
${renderFacts(page)}
          </div>
        </section>

        <div class="press-grid">
          <section class="press-section">
            <h2>${escapeHtml(page.descriptionTitle)}</h2>
            <p>${escapeHtml(page.productDescription)}</p>
          </section>

          <section class="press-section">
            <h2>${escapeHtml(page.featureTitle)}</h2>
            <ul>
${renderFeatures(page)}
            </ul>
          </section>
        </div>

        <div class="press-grid">
          <section class="press-section">
            <h2>${escapeHtml(page.assetTitle)}</h2>
            <div class="press-assets">
${renderAssets(page)}
            </div>
          </section>

          <section class="press-section">
            <h2>${escapeHtml(page.directoryTitle)}</h2>
            <div class="press-copy-grid">
${renderCopyCards(page)}
            </div>
          </section>
        </div>

        <section class="press-section">
          <h2>${escapeHtml(page.contactTitle)}</h2>
          <p>${escapeHtml(page.contactText)}</p>
        </section>
      </div>
    </main>

    <footer class="press-footer">
      <div class="container">
        <p>${escapeHtml(page.footerNote)}</p>
        <div class="press-footer__links">
          <a href="${page.links.home}">AdShorts AI</a>
          <a href="${page.links.contact}">${page.locale === "ru" ? "О проекте" : "About"}</a>
          <a href="${page.links.privacy}">Privacy</a>
          <a href="${page.links.terms}">Terms</a>
          <a href="${page.links.offer}">Offer</a>
        </div>
      </div>
    </footer>
  </body>
</html>
`;
};

const updateSitemap = async () => {
  const sitemapPath = path.join(rootDir, "sitemap.xml");
  let sitemap = await readFile(sitemapPath, "utf8");

  for (const page of pages) {
    sitemap = sitemap.replace(
      new RegExp(`\\s*<url>\\s*<loc>${escapeRegExp(page.canonical)}<\\/loc>[\\s\\S]*?<\\/url>`, "g"),
      "",
    );
  }

  const blocks = pages
    .map(
      (page) => `  <url>
    <loc>${page.canonical}</loc>
    <xhtml:link rel="alternate" hreflang="ru" href="${page.alternateRu}" />
    <xhtml:link rel="alternate" hreflang="en" href="${page.alternateEn}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${page.alternateRu}" />
    <lastmod>${dateModified}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.55</priority>
  </url>`,
    )
    .join("\n");

  sitemap = sitemap.replace(/\n<\/urlset>\s*$/, `\n${blocks}\n</urlset>\n`);
  await writeFile(sitemapPath, sitemap, "utf8");
};

for (const page of pages) {
  const dir = path.join(rootDir, page.dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), renderPage(page), "utf8");
}

await updateSitemap();

console.log(`Generated ${pages.length} press pages and updated sitemap lastmod ${dateModified}.`);
