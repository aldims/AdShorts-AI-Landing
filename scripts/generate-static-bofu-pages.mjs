#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteOrigin = "https://adshortsai.com";
const cssVersion = 55;
const scriptVersion = 8;
const logoUrl = `${siteOrigin}/logo.png?v=2`;

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

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
    slug: "pricing",
    langHref: "../en/pricing/",
    langLabel: "English",
    langCode: "RU",
    canonical: `${siteOrigin}/pricing/`,
    alternateRu: `${siteOrigin}/pricing/`,
    alternateEn: `${siteOrigin}/en/pricing/`,
    title: "Тарифы AdShorts AI: создание Shorts с AI-сценарием и субтитрами",
    description:
      "Тарифы AdShorts AI для создания YouTube Shorts, Reels и TikTok: бесплатный старт, Pro для регулярного контента и Ultra для больших объёмов.",
    ogTitle: "Тарифы AdShorts AI",
    ogDescription:
      "Выберите тариф для регулярного создания вертикальных роликов: AI-сценарий, озвучка, субтитры, визуал и публикация.",
    nav: {
      home: "Главная",
      examples: "Примеры",
      guides: "Гайды",
      studio: "Студия",
      pricing: "Тарифы",
      menu: "Меню",
      langAria: "Выбор языка",
      currentLang: "Язык: Русский",
      signIn: "Войти",
    },
    page: "pricing",
    h1: "Тарифы AdShorts AI",
    lead:
      "Платите за готовые Shorts, а не за часы монтажа: сценарий, озвучка, субтитры, визуальный ряд и публикация собираются в студии.",
    primaryCta: "Создать Shorts бесплатно",
    secondaryCta: "Смотреть примеры",
    primaryHref: "../app/studio?source=pricing_ru",
    secondaryHref: "../examples/",
    proof: ["1 бесплатный Shorts для старта", "AI-сценарий, голос и субтитры", "Публикация в YouTube из студии"],
    plans: [
      {
        name: "START",
        badge: "Бесплатно",
        audience: "Проверить идею и качество результата",
        price: "0 ₽",
        billing: "1 Shorts",
        output: "Первый ролик",
        note: "С водяным знаком",
        cta: "Начать бесплатно",
        href: "../app/studio?source=pricing_start_ru",
        features: ["Полный путь от идеи до видео", "Озвучка и субтитры", "Проверка студии без оплаты"],
      },
      {
        name: "PRO",
        badge: "Рекомендуем",
        audience: "Регулярный контент для канала или бизнеса",
        price: "1 490 ₽",
        billing: "в месяц",
        output: "До 25 Shorts",
        note: "около 60 ₽ за ролик",
        cta: "Выбрать Pro",
        href: "../app/studio?source=pricing_pro_ru",
        featured: true,
        features: ["Без водяного знака", "Редактирование результата", "Публикация в YouTube"],
      },
      {
        name: "ULTRA",
        badge: "Лучшая цена",
        audience: "Пачки роликов, агентства и активные каналы",
        price: "4 990 ₽",
        billing: "в месяц",
        output: "До 100 Shorts",
        note: "около 50 ₽ за ролик",
        cta: "Выбрать Ultra",
        href: "../app/studio?source=pricing_ultra_ru",
        features: ["Максимальный лимит", "Лучшая цена за видео", "Подходит для серийного выпуска"],
      },
    ],
    packsTitle: "Дополнительные пакеты",
    packsLead: "Для Pro и Ultra можно докупить ролики в любой момент. Баланс не сгорает.",
    packs: [
      ["Pack 10", "10 видео", "690 ₽", "~69 ₽/видео"],
      ["Pack 50", "50 видео", "2 750 ₽", "~55 ₽/видео"],
      ["Pack 100", "100 видео", "4 990 ₽", "~50 ₽/видео"],
    ],
    faqTitle: "Что важно знать перед оплатой",
    faq: [
      ["Можно начать бесплатно?", "Да. START даёт первый ролик, чтобы проверить качество и понять процесс."],
      ["Что входит в один Shorts?", "Сценарий, озвучка, субтитры, музыка, визуал и готовый вертикальный формат."],
      ["Можно ли редактировать результат?", "Да. Можно менять текст, голос, субтитры, музыку и визуальную часть, затем пересобрать видео."],
    ],
    finalTitle: "Сначала проверьте результат на одном ролике",
    finalText: "Органический рост начинается с регулярного теста форматов. Создайте первый Shorts и посмотрите, что можно улучшить.",
    finalCta: "Создать Shorts бесплатно",
    finalHref: "../app/studio?source=pricing_final_ru",
  },
  {
    locale: "en",
    slug: "en/pricing",
    langHref: "../../pricing/",
    langLabel: "Русский",
    langCode: "EN",
    canonical: `${siteOrigin}/en/pricing/`,
    alternateRu: `${siteOrigin}/pricing/`,
    alternateEn: `${siteOrigin}/en/pricing/`,
    title: "AdShorts AI Pricing: AI Shorts, Reels and TikTok Videos",
    description:
      "AdShorts AI pricing for creating YouTube Shorts, Reels and TikTok videos with AI scripts, voiceover, subtitles, visuals and publishing tools.",
    ogTitle: "AdShorts AI Pricing",
    ogDescription:
      "Choose a plan for regular short-form video production: AI script, voiceover, subtitles, visuals and publishing tools.",
    nav: {
      home: "Home",
      examples: "Examples",
      guides: "Guides",
      studio: "Studio",
      pricing: "Pricing",
      menu: "Menu",
      langAria: "Language selection",
      currentLang: "Language: English",
      signIn: "Sign in",
    },
    page: "pricing",
    h1: "AdShorts AI Pricing",
    lead:
      "Pay for finished Shorts, not editing hours: script, voiceover, subtitles, visuals and publishing live in one web studio.",
    primaryCta: "Create Shorts for free",
    secondaryCta: "View examples",
    primaryHref: "../../en/app/studio?source=pricing_en",
    secondaryHref: "../../en/examples/",
    proof: ["Free start plan", "AI script, voice and subtitles", "YouTube publishing tools"],
    plans: [
      {
        name: "START",
        badge: "Free",
        audience: "Test one idea and the output quality",
        price: "0",
        billing: "1 Short",
        output: "First video",
        note: "With watermark",
        cta: "Start free",
        href: "../../en/app/studio?source=pricing_start_en",
        features: ["Idea to finished video", "Voiceover and subtitles", "Try the studio before paying"],
      },
      {
        name: "PRO",
        badge: "Recommended",
        audience: "Regular content for creators and businesses",
        price: "$24",
        billing: "preview tier",
        output: "Up to 25 Shorts",
        note: "Regular-use tier",
        cta: "Choose Pro",
        href: "../../en/app/studio?source=pricing_pro_en",
        featured: true,
        features: ["No watermark", "Studio editing", "YouTube publishing tools"],
      },
      {
        name: "ULTRA",
        badge: "Best value",
        audience: "High-volume channels and teams",
        price: "$70",
        billing: "preview tier",
        output: "Up to 100 Shorts",
        note: "Best price per video",
        cta: "Choose Ultra",
        href: "../../en/app/studio?source=pricing_ultra_en",
        features: ["Highest monthly limit", "Best unit economics", "Built for batch publishing"],
      },
    ],
    packsTitle: "Extra video packs",
    packsLead: "Pro and Ultra users can add more videos anytime. Unused balance stays available.",
    packs: [
      ["Pack 10", "10 videos", "$10", "Extra credits"],
      ["Pack 50", "50 videos", "$40", "Volume pack"],
      ["Pack 100", "100 videos", "$70", "Best value"],
    ],
    faqTitle: "Before you choose a plan",
    faq: [
      ["Can I start for free?", "Yes. START lets you create one video and check the workflow."],
      ["What is included in one Short?", "Script, voiceover, subtitles, music, visuals and a vertical video ready to publish."],
      ["Can I edit the result?", "Yes. You can adjust text, voice, subtitles, music and visuals, then regenerate."],
    ],
    finalTitle: "Start with one video",
    finalText: "Organic growth comes from consistent format testing. Create one Short and see what you want to improve.",
    finalCta: "Create Shorts for free",
    finalHref: "../../en/app/studio?source=pricing_final_en",
  },
  {
    locale: "ru",
    slug: "examples",
    langHref: "../en/examples/",
    langLabel: "English",
    langCode: "RU",
    canonical: `${siteOrigin}/examples/`,
    alternateRu: `${siteOrigin}/examples/`,
    alternateEn: `${siteOrigin}/en/examples/`,
    title: "Примеры Shorts AdShorts AI: шаблоны для рекламы, роста и обучения",
    description:
      "Примеры Shorts, которые можно использовать как стартовый шаблон: реклама услуг, рост канала, обучающий контент и storytelling.",
    ogTitle: "Примеры Shorts AdShorts AI",
    ogDescription:
      "Готовые сцены и шаблоны для запуска Shorts: выберите пример и откройте похожую структуру в студии.",
    nav: {
      home: "Главная",
      examples: "Примеры",
      guides: "Гайды",
      studio: "Студия",
      pricing: "Тарифы",
      menu: "Меню",
      langAria: "Выбор языка",
      currentLang: "Язык: Русский",
      signIn: "Войти",
    },
    page: "examples",
    h1: "Примеры Shorts AdShorts AI",
    lead:
      "Посмотрите, какие вертикальные ролики можно собрать из одной идеи: рекламные Shorts, обучающие сцены, storytelling и контент для роста канала.",
    primaryCta: "Создать похожий Shorts",
    secondaryCta: "Посмотреть тарифы",
    primaryHref: "../app/studio?source=examples_ru",
    secondaryHref: "../pricing/",
    proof: ["3 базовых сценария", "9:16 видео с субтитрами", "Шаблон можно открыть в студии"],
    examples: [
      {
        goal: "Рост канала",
        title: "Storytelling с кинематографичным первым кадром",
        text: "Формат для личных историй, трендов и нарратива, где важны настроение и темп с первой секунды.",
        video: "../1ru.mp4?v=2",
        href: "../app/studio?source=examples_story_ru",
      },
      {
        goal: "Реклама",
        title: "Продажа через боль и короткий CTA",
        text: "Подходит для услуг, экспертов и агентств: хук, проблема, решение и следующий шаг без лишней воды.",
        video: "../2ru.mp4?v=2",
        href: "../app/studio?source=examples_ads_ru",
      },
      {
        goal: "Обучение",
        title: "Факт-видео с визуальным якорем",
        text: "Структура для экспертного контента: одна мысль, быстрый прогресс и понятный вывод.",
        video: "../3ru.mp4?v=2",
        href: "../app/studio?source=examples_education_ru",
      },
    ],
    workflowTitle: "Как использовать пример",
    workflow: [
      ["Выберите формат", "Реклама, рост канала или обучение."],
      ["Откройте студию", "Шаблон подскажет структуру и настройки."],
      ["Замените тему", "AI соберёт новый ролик под вашу задачу."],
    ],
    finalTitle: "Запустите свой первый пример",
    finalText: "Самый быстрый путь к органике — регулярно тестировать разные хуки и структуры, а не ждать идеального ролика.",
    finalCta: "Открыть студию",
    finalHref: "../app/studio?source=examples_final_ru",
  },
  {
    locale: "en",
    slug: "en/examples",
    langHref: "../../examples/",
    langLabel: "Русский",
    langCode: "EN",
    canonical: `${siteOrigin}/en/examples/`,
    alternateRu: `${siteOrigin}/examples/`,
    alternateEn: `${siteOrigin}/en/examples/`,
    title: "AdShorts AI Examples: Templates for Ads, Growth and Education",
    description:
      "AdShorts AI examples for short-form video creation: ad Shorts, channel growth, educational content and storytelling templates.",
    ogTitle: "AdShorts AI Examples",
    ogDescription:
      "Ready scenes and templates for Shorts: choose an example and open a similar structure in the studio.",
    nav: {
      home: "Home",
      examples: "Examples",
      guides: "Guides",
      studio: "Studio",
      pricing: "Pricing",
      menu: "Menu",
      langAria: "Language selection",
      currentLang: "Language: English",
      signIn: "Sign in",
    },
    page: "examples",
    h1: "AdShorts AI Examples",
    lead:
      "See how one idea becomes a vertical video: ad Shorts, educational scenes, storytelling and formats for channel growth.",
    primaryCta: "Create a similar Short",
    secondaryCta: "View pricing",
    primaryHref: "../../en/app/studio?source=examples_en",
    secondaryHref: "../../en/pricing/",
    proof: ["3 base formats", "9:16 video with subtitles", "Open templates in the studio"],
    examples: [
      {
        goal: "Growth",
        title: "Storytelling with a cinematic first frame",
        text: "A format for personal stories, trends and narrative videos where mood and pace matter from the first second.",
        video: "../../1en.mp4?v=2",
        href: "../../en/app/studio?source=examples_story_en",
      },
      {
        goal: "Ads",
        title: "Pain, solution and a short CTA",
        text: "Useful for services, creators and agencies: hook, problem, solution and one clear next step.",
        video: "../../2en.mp4?v=2",
        href: "../../en/app/studio?source=examples_ads_en",
      },
      {
        goal: "Education",
        title: "Fact video with a visual anchor",
        text: "A compact expert-content structure: one idea, fast progress and a clear takeaway.",
        video: "../../3en.mp4?v=2",
        href: "../../en/app/studio?source=examples_education_en",
      },
    ],
    workflowTitle: "How to use an example",
    workflow: [
      ["Choose a format", "Ads, channel growth or education."],
      ["Open the studio", "The template gives you structure and settings."],
      ["Replace the topic", "AI creates a new video for your task."],
    ],
    finalTitle: "Launch from a template",
    finalText: "The fastest path to organic growth is testing hooks and structures consistently, not waiting for one perfect video.",
    finalCta: "Open studio",
    finalHref: "../../en/app/studio?source=examples_final_en",
  },
];

const renderLanguageSwitcher = (page) => {
  const otherCode = page.locale === "ru" ? "EN" : "RU";
  const otherName = page.locale === "ru" ? "English" : "Русский";
  const currentName = page.locale === "ru" ? "Русский" : "English";

  return `<details class="lang-switcher"><summary class="lang-switcher__trigger" aria-label="${escapeHtml(page.nav.currentLang)}" title="${escapeHtml(page.nav.currentLang)}"><svg class="lang-switcher__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.2 2.35 3.4 5.35 3.4 9s-1.2 6.65-3.4 9M12 3c-2.2 2.35-3.4 5.35-3.4 9s1.2 6.65 3.4 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>${page.langCode}</span></summary><div class="lang-switcher__menu" role="menu" aria-label="${escapeHtml(page.nav.langAria)}"><a class="lang-switcher__option is-active" href="./" role="menuitem" aria-label="${page.langCode} ${escapeHtml(currentName)}" aria-current="page"><span class="lang-switcher__code">${page.langCode}</span><span class="lang-switcher__label">${escapeHtml(currentName)}</span></a><a class="lang-switcher__option" href="${escapeHtml(page.langHref)}" role="menuitem" aria-label="${otherCode} ${escapeHtml(otherName)}"><span class="lang-switcher__code">${otherCode}</span><span class="lang-switcher__label">${escapeHtml(otherName)}</span></a></div></details>`;
};

const assetPrefix = (page) => (page.locale === "ru" ? "../" : "../../");

const renderHead = (page) => {
  const prefix = assetPrefix(page);
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: page.locale === "ru" ? "Главная" : "Home",
        item: page.locale === "ru" ? `${siteOrigin}/` : `${siteOrigin}/en/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: page.page === "pricing" ? page.nav.pricing : page.nav.examples,
        item: page.canonical,
      },
    ],
  };
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AdShorts AI",
    url: page.locale === "ru" ? `${siteOrigin}/` : `${siteOrigin}/en/`,
    image: logoUrl,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    description: page.description,
    offers: page.page === "pricing"
      ? page.plans.map((plan) => ({
          "@type": "Offer",
          name: `AdShorts AI ${plan.name}`,
          url: page.canonical,
          priceCurrency: page.locale === "ru" ? "RUB" : "USD",
        }))
      : undefined,
  };

  return `  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="canonical" href="${escapeHtml(page.canonical)}" />
    <link rel="alternate" hreflang="ru" href="${escapeHtml(page.alternateRu)}" />
    <link rel="alternate" hreflang="en" href="${escapeHtml(page.alternateEn)}" />
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(page.alternateRu)}" />
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(page.canonical)}" />
    <meta property="og:title" content="${escapeHtml(page.ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(page.ogDescription)}" />
    <meta property="og:image" content="${logoUrl}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:site_name" content="AdShorts AI" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.ogTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(page.ogDescription)}" />
    <meta name="twitter:image" content="${logoUrl}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${prefix}styles.css?v=${cssVersion}" />
    <link rel="icon" type="image/png" sizes="120x120" href="${prefix}favicon.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="${prefix}favicon-32.png" />
    <link rel="icon" type="image/svg+xml" href="${prefix}favicon.svg" />
    <link rel="shortcut icon" type="image/x-icon" href="${prefix}favicon.ico" />
    <style>${renderInlineStyles()}</style>
    <script defer src="${prefix}script.js?v=${scriptVersion}"></script>
${renderYandexMetrikaCounter()}
    <script type="application/ld+json">
${renderJsonLd(softwareSchema)}
    </script>
    <script type="application/ld+json">
${renderJsonLd(breadcrumbSchema)}
    </script>
  </head>`;
};

const renderInlineStyles = () => `
      .seo-bofu { color: #fff; background: radial-gradient(circle at 8% 0%, rgba(216,255,114,.14), transparent 30%), radial-gradient(circle at 92% 6%, rgba(90,142,255,.16), transparent 28%), #0b0d11; min-height: 100vh; }
      .seo-header { position: sticky; top: 0; z-index: 80; background: rgba(10,13,18,.78); border-bottom: 1px solid rgba(255,255,255,.08); backdrop-filter: blur(18px); }
      .seo-header__inner { min-height: 76px; display: flex; align-items: center; justify-content: space-between; gap: 22px; }
      .seo-logo { display: inline-flex; align-items: center; gap: 10px; color: #fff; font-weight: 800; text-decoration: none; letter-spacing: -.03em; }
      .seo-logo img { width: 42px; height: 42px; border-radius: 12px; }
      .seo-nav { display: flex; align-items: center; gap: 16px; color: rgba(255,255,255,.72); font-size: .94rem; font-weight: 700; }
      .seo-nav a { color: inherit; text-decoration: none; }
      .seo-nav a[aria-current="page"], .seo-nav a:hover { color: #d8ff72; }
      .seo-actions { display: flex; align-items: center; gap: 12px; }
      .seo-signin { color: rgba(255,255,255,.82); text-decoration: none; font-weight: 800; }
      .seo-hero { padding: 110px 0 54px; }
      .seo-hero__grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 410px); gap: 44px; align-items: end; }
      .seo-hero__grid > *, .seo-proof, .seo-card, .seo-mini, .seo-final__box { min-width: 0; max-width: 100%; }
      .seo-kicker { margin: 0 0 16px; color: #d8ff72; font-size: .78rem; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; }
      .seo-hero h1 { max-width: 820px; margin: 0; font-family: Sora, Manrope, sans-serif; font-size: clamp(3rem, 6vw, 5.7rem); line-height: .92; letter-spacing: -.08em; overflow-wrap: anywhere; }
      .seo-lead { max-width: 720px; margin: 22px 0 0; color: rgba(255,255,255,.72); font-size: 1.12rem; line-height: 1.65; overflow-wrap: anywhere; }
      .seo-hero__actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
      .seo-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 54px; max-width: 100%; padding: 0 22px; border-radius: 999px; border: 1px solid rgba(255,255,255,.14); color: #fff; background: rgba(255,255,255,.05); text-decoration: none; font-weight: 900; text-align: center; white-space: normal; overflow-wrap: anywhere; }
      .seo-btn--primary { color: #111407; background: #d8ff72; border-color: rgba(216,255,114,.42); box-shadow: 0 18px 42px rgba(216,255,114,.16); }
      .seo-proof { display: grid; gap: 12px; padding: 24px; border: 1px solid rgba(255,255,255,.1); border-radius: 28px; background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03)); box-shadow: 0 24px 58px rgba(0,0,0,.2); }
      .seo-proof strong { font-family: Sora, Manrope, sans-serif; font-size: 1.35rem; line-height: 1.08; letter-spacing: -.04em; }
      .seo-proof ul { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; color: rgba(255,255,255,.74); }
      .seo-proof li { padding-left: 18px; position: relative; }
      .seo-proof li::before { content: ""; position: absolute; left: 0; top: .7em; width: 7px; height: 7px; border-radius: 50%; background: #d8ff72; }
      .seo-section { padding: 58px 0; }
      .seo-section h2 { margin: 0 0 24px; font-family: Sora, Manrope, sans-serif; font-size: clamp(2.2rem, 4vw, 4rem); line-height: .98; letter-spacing: -.07em; overflow-wrap: anywhere; }
      .seo-plan-grid, .seo-example-grid, .seo-pack-grid, .seo-faq-grid, .seo-workflow-grid { display: grid; gap: 18px; }
      .seo-plan-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .seo-card { position: relative; display: grid; gap: 18px; padding: 28px; border: 1px solid rgba(255,255,255,.1); border-radius: 30px; background: radial-gradient(circle at top left, rgba(216,255,114,.08), transparent 35%), rgba(255,255,255,.05); box-shadow: 0 24px 54px rgba(0,0,0,.22); }
      .seo-card--featured { border-color: rgba(216,255,114,.36); background: radial-gradient(circle at top left, rgba(216,255,114,.16), transparent 36%), rgba(255,255,255,.08); }
      .seo-badge { justify-self: start; min-height: 28px; padding: 6px 10px; border-radius: 999px; background: rgba(216,255,114,.15); color: #d8ff72; font-size: .72rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
      .seo-card h3 { margin: 0; font-family: Sora, Manrope, sans-serif; font-size: 1.8rem; line-height: 1; letter-spacing: -.05em; }
      .seo-card p { margin: 0; color: rgba(255,255,255,.7); line-height: 1.55; }
      .seo-price { display: flex; gap: 8px; align-items: end; }
      .seo-price strong { font-family: Sora, Manrope, sans-serif; font-size: 3rem; line-height: .92; letter-spacing: -.07em; }
      .seo-output { padding: 16px; border-radius: 20px; background: rgba(255,255,255,.06); }
      .seo-card ul { margin: 0; padding-left: 18px; color: rgba(255,255,255,.78); }
      .seo-pack-grid, .seo-faq-grid, .seo-workflow-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .seo-mini { padding: 22px; border: 1px solid rgba(255,255,255,.1); border-radius: 24px; background: rgba(255,255,255,.045); }
      .seo-mini strong { display: block; margin-bottom: 8px; font-size: 1.1rem; color: #fff; }
      .seo-mini p { margin: 0; color: rgba(255,255,255,.7); }
      .seo-example-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .seo-example { overflow: hidden; padding: 0; }
      .seo-example video { display: block; width: 100%; aspect-ratio: 9 / 16; object-fit: cover; background: #12161d; }
      .seo-example__body { display: grid; gap: 14px; padding: 22px; }
      .seo-example__goal { color: #d8ff72; font-size: .76rem; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
      .seo-final { padding: 70px 0 96px; }
      .seo-final__box { display: grid; gap: 18px; justify-items: center; text-align: center; padding: 44px; border: 1px solid rgba(216,255,114,.18); border-radius: 34px; background: radial-gradient(circle at top, rgba(216,255,114,.13), transparent 38%), rgba(255,255,255,.05); }
      .seo-final h2 { margin: 0; font-family: Sora, Manrope, sans-serif; font-size: clamp(2.3rem, 4.7vw, 4.2rem); line-height: .98; letter-spacing: -.07em; }
      .seo-final p { max-width: 640px; margin: 0; color: rgba(255,255,255,.72); }
      @media (max-width: 980px) { .seo-hero__grid, .seo-plan-grid, .seo-example-grid, .seo-pack-grid, .seo-faq-grid, .seo-workflow-grid { grid-template-columns: 1fr; } .seo-nav { display: none; } .seo-hero { padding-top: 72px; } }
      @media (max-width: 640px) { .seo-header__inner { min-height: 68px; } .seo-signin { display: none; } .seo-kicker { letter-spacing: .08em; } .seo-hero h1 { font-size: clamp(1.8rem, 11vw, 2.6rem); line-height: 1; letter-spacing: -.04em; } .seo-section h2 { font-size: clamp(1.75rem, 10vw, 2.4rem); letter-spacing: -.04em; } .seo-hero__actions, .seo-btn { width: 100%; } .seo-card, .seo-final__box, .seo-proof { border-radius: 24px; padding: 22px; } }
`;

const renderHeader = (page) => {
  const prefix = assetPrefix(page);
  const homeHref = page.locale === "ru" ? "../" : "../../en/";
  const examplesHref = page.locale === "ru" ? "../examples/" : "../../en/examples/";
  const guidesHref = page.locale === "ru" ? "../shorts-guides/" : "../../en/shorts-guides/";
  const pricingHref = page.locale === "ru" ? "../pricing/" : "../../en/pricing/";
  const studioHref = page.locale === "ru" ? "../app/studio" : "../../en/app/studio";

  return `    <header class="seo-header">
      <div class="container seo-header__inner">
        <a class="seo-logo" href="${homeHref}" aria-label="AdShorts AI">
          <img src="${prefix}logo.png?v=2" alt="" width="42" height="42" />
          <span>AdShorts AI</span>
        </a>
        <nav class="seo-nav" aria-label="${escapeHtml(page.nav.langAria)}">
          <a href="${homeHref}">${escapeHtml(page.nav.home)}</a>
          <a href="${examplesHref}"${page.page === "examples" ? ' aria-current="page"' : ""}>${escapeHtml(page.nav.examples)}</a>
          <a href="${guidesHref}">${escapeHtml(page.nav.guides)}</a>
          <a href="${pricingHref}"${page.page === "pricing" ? ' aria-current="page"' : ""}>${escapeHtml(page.nav.pricing)}</a>
          <a href="${studioHref}">${escapeHtml(page.nav.studio)}</a>
        </nav>
        <div class="seo-actions">
          ${renderLanguageSwitcher(page)}
          <a class="seo-signin" href="${studioHref}">${escapeHtml(page.nav.signIn)}</a>
        </div>
      </div>
    </header>`;
};

const renderHero = (page) => `<section class="seo-hero">
        <div class="container seo-hero__grid">
          <div>
            <p class="seo-kicker">AdShorts AI</p>
            <h1>${escapeHtml(page.h1)}</h1>
            <p class="seo-lead">${escapeHtml(page.lead)}</p>
            <div class="seo-hero__actions">
              <a class="seo-btn seo-btn--primary" href="${escapeHtml(page.primaryHref)}" data-seo-cta="${page.page}_hero">${escapeHtml(page.primaryCta)}</a>
              <a class="seo-btn" href="${escapeHtml(page.secondaryHref)}" data-seo-cta="${page.page}_secondary">${escapeHtml(page.secondaryCta)}</a>
            </div>
          </div>
          <aside class="seo-proof">
            <strong>${page.locale === "ru" ? "Что получает пользователь" : "What users get"}</strong>
            <ul>
              ${page.proof.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n              ")}
            </ul>
          </aside>
        </div>
      </section>`;

const renderPricingBody = (page) => `<section class="seo-section">
        <div class="container">
          <h2>${page.locale === "ru" ? "Выберите объём под ваш темп публикаций" : "Choose the volume for your publishing pace"}</h2>
          <div class="seo-plan-grid">
            ${page.plans
              .map(
                (plan) => `<article class="seo-card${plan.featured ? " seo-card--featured" : ""}">
              <span class="seo-badge">${escapeHtml(plan.badge)}</span>
              <h3>${escapeHtml(plan.name)}</h3>
              <p>${escapeHtml(plan.audience)}</p>
              <div class="seo-price"><strong>${escapeHtml(plan.price)}</strong><span>${escapeHtml(plan.billing)}</span></div>
              <div class="seo-output"><strong>${escapeHtml(plan.output)}</strong><p>${escapeHtml(plan.note)}</p></div>
              <ul>${plan.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>
              <a class="seo-btn${plan.featured ? " seo-btn--primary" : ""}" href="${escapeHtml(plan.href)}" data-seo-cta="pricing_${plan.name.toLowerCase()}">${escapeHtml(plan.cta)}</a>
            </article>`,
              )
              .join("\n            ")}
          </div>
        </div>
      </section>
      <section class="seo-section">
        <div class="container">
          <h2>${escapeHtml(page.packsTitle)}</h2>
          <p class="seo-lead">${escapeHtml(page.packsLead)}</p>
          <div class="seo-pack-grid">
            ${page.packs
              .map(
                ([name, videos, price, note]) => `<article class="seo-mini"><strong>${escapeHtml(name)}</strong><p>${escapeHtml(videos)} · ${escapeHtml(price)} · ${escapeHtml(note)}</p></article>`,
              )
              .join("\n            ")}
          </div>
        </div>
      </section>
      <section class="seo-section">
        <div class="container">
          <h2>${escapeHtml(page.faqTitle)}</h2>
          <div class="seo-faq-grid">
            ${page.faq
              .map(([question, answer]) => `<article class="seo-mini"><strong>${escapeHtml(question)}</strong><p>${escapeHtml(answer)}</p></article>`)
              .join("\n            ")}
          </div>
        </div>
      </section>`;

const renderExamplesBody = (page) => `<section class="seo-section">
        <div class="container">
          <h2>${page.locale === "ru" ? "Готовые форматы для первого запуска" : "Ready formats for your first launch"}</h2>
          <div class="seo-example-grid">
            ${page.examples
              .map(
                (example) => `<article class="seo-card seo-example">
              <video src="${escapeHtml(example.video)}" autoplay muted loop playsinline preload="metadata"></video>
              <div class="seo-example__body">
                <span class="seo-example__goal">${escapeHtml(example.goal)}</span>
                <h3>${escapeHtml(example.title)}</h3>
                <p>${escapeHtml(example.text)}</p>
                <a class="seo-btn seo-btn--primary" href="${escapeHtml(example.href)}" data-seo-cta="examples_template">${page.locale === "ru" ? "Использовать шаблон" : "Use template"}</a>
              </div>
            </article>`,
              )
              .join("\n            ")}
          </div>
        </div>
      </section>
      <section class="seo-section">
        <div class="container">
          <h2>${escapeHtml(page.workflowTitle)}</h2>
          <div class="seo-workflow-grid">
            ${page.workflow
              .map(([title, text]) => `<article class="seo-mini"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></article>`)
              .join("\n            ")}
          </div>
        </div>
      </section>`;

const renderFinalCta = (page) => `<section class="seo-final">
        <div class="container">
          <div class="seo-final__box">
            <h2>${escapeHtml(page.finalTitle)}</h2>
            <p>${escapeHtml(page.finalText)}</p>
            <a class="seo-btn seo-btn--primary" href="${escapeHtml(page.finalHref)}" data-seo-cta="${page.page}_final">${escapeHtml(page.finalCta)}</a>
          </div>
        </div>
      </section>`;

const renderPage = (page) => `<!doctype html>
<html lang="${page.locale}">
${renderHead(page)}
  <body class="seo-bofu">
${renderHeader(page)}
    <main>
      ${renderHero(page)}
      ${page.page === "pricing" ? renderPricingBody(page) : renderExamplesBody(page)}
      ${renderFinalCta(page)}
    </main>
    <footer class="footer">
      <div class="container footer__inner">
        <a class="logo" href="${page.locale === "ru" ? "../" : "../../en/"}">AdShorts<span>AI</span></a>
        <div class="footer__links">
          <span style="color: var(--muted);">${page.locale === "ru" ? "Контакты:" : "Contact:"} <a href="mailto:support@adshortsai.com" style="color: var(--muted);">support@adshortsai.com</a></span>
          <a href="${page.locale === "ru" ? "../contacts/" : "../../en/contact/"}">${page.locale === "ru" ? "О проекте" : "About"}</a>
          <a href="${page.locale === "ru" ? "../privacy/" : "../../en/privacy/"}">${page.locale === "ru" ? "Политика конфиденциальности" : "Privacy Policy"}</a>
          <a href="${page.locale === "ru" ? "../terms/" : "../../en/terms/"}">${page.locale === "ru" ? "Пользовательское соглашение" : "User Agreement"}</a>
          <a href="${escapeHtml(page.langHref)}" rel="alternate" hreflang="${page.locale === "ru" ? "en" : "ru"}">${escapeHtml(page.langLabel)}</a>
          <span style="color: var(--muted);">© <span id="year"></span> AdShorts AI</span>
        </div>
      </div>
    </footer>
  </body>
</html>
`;

for (const page of pages) {
  const dir = path.join(rootDir, page.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), renderPage(page));
  console.log(`Generated ${page.slug}/index.html`);
}
