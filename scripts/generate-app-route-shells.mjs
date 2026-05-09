import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDistDir = path.join(rootDir, "app", "dist");
const sourceShellPath = path.join(appDistDir, "index.html");
const siteOrigin = "https://adshortsai.com";

const routeShells = [
  {
    outputPath: "index.html",
    lang: "ru",
    canonical: `${siteOrigin}/`,
    title: "AdShorts AI — Shorts/Reels/TikTok за 1 минуту",
    description:
      "AdShorts AI создаёт YouTube Shorts, Reels и TikTok за минуту: AI-сценарий, озвучка, субтитры, фон и публикация без ручного монтажа.",
    ogTitle: "AdShorts AI — Shorts/Reels/TikTok за 1 минуту",
    ogDescription: "Введите идею — получите готовый Shorts с озвучкой, субтитрами и визуалом.",
    h1: "Shorts / Reels / TikTok за 1 минуту. В один клик.",
    lead:
      "AdShorts AI собирает вертикальные ролики из идеи: сценарий, озвучка, субтитры, визуальный ряд и подготовка к публикации.",
    ctas: [
      ["Открыть студию", "/app/studio?source=seo_fallback_home"],
      ["Посмотреть примеры", "/examples/"],
      ["Тарифы", "/pricing/"],
    ],
    sections: [
      ["Что делает сервис", ["Генерирует сценарий под Shorts, Reels и TikTok.", "Добавляет озвучку, субтитры, фон и визуальный стиль.", "Помогает выпускать ролики регулярно без ручного монтажа."]],
      ["Для кого", ["Авторы и эксперты.", "Бизнес, услуги и онлайн-школы.", "SMM-команды и агентства."]],
    ],
  },
  {
    outputPath: "en/index.html",
    lang: "en",
    canonical: `${siteOrigin}/en/`,
    title: "AdShorts AI — Shorts/Reels/TikTok in 1 Minute",
    description:
      "AdShorts AI creates YouTube Shorts, Reels and TikTok videos in minutes: AI script, voiceover, subtitles, visuals and publishing without manual editing.",
    ogTitle: "AdShorts AI — Shorts/Reels/TikTok in 1 Minute",
    ogDescription: "Enter an idea and get a ready Shorts video with voiceover, subtitles and visuals.",
    h1: "Shorts / Reels / TikTok in 1 Minute. In one click.",
    lead:
      "AdShorts AI turns an idea into a vertical video: script, voiceover, subtitles, visuals and publishing preparation.",
    ctas: [
      ["Open studio", "/en/app/studio?source=seo_fallback_home"],
      ["View examples", "/en/examples/"],
      ["Pricing", "/en/pricing/"],
    ],
    sections: [
      ["What the product does", ["Generates short-form scripts for Shorts, Reels and TikTok.", "Adds voiceover, subtitles, background and visual style.", "Helps publish vertical videos consistently without manual editing."]],
      ["Built for", ["Creators and experts.", "Businesses, services and online schools.", "SMM teams and agencies."]],
    ],
  },
  {
    outputPath: "pricing/index.html",
    lang: "ru",
    canonical: `${siteOrigin}/pricing/`,
    title: "Тарифы AdShorts AI: создание Shorts с AI-сценарием и субтитрами",
    description:
      "Тарифы AdShorts AI для создания YouTube Shorts, Reels и TikTok: бесплатный старт, Pro для регулярного контента и Ultra для больших объёмов.",
    ogTitle: "Тарифы AdShorts AI",
    ogDescription:
      "Выберите тариф для регулярного создания вертикальных роликов: AI-сценарий, озвучка, субтитры, визуал и публикация.",
    h1: "Выберите свой тариф",
    lead:
      "Тарифы AdShorts AI рассчитаны на регулярное создание YouTube Shorts, Reels и TikTok: от первого тестового ролика до серийного выпуска.",
    ctas: [
      ["Начать бесплатно", "/app/studio?source=seo_fallback_pricing"],
      ["Смотреть примеры", "/examples/"],
    ],
    sections: [
      ["START", ["390 ₽ / 50 кредитов.", "До 5 Shorts.", "Подходит для первого запуска и проверки качества."]],
      ["PRO", ["1 490 ₽ / 250 кредитов.", "До 25 Shorts.", "Для регулярного контента без водяного знака."]],
      ["ULTRA", ["4 990 ₽ / 1000 кредитов.", "До 100 Shorts.", "Для максимального объёма и пачек роликов."]],
      ["Дополнительные пакеты", ["Пакеты кредитов доступны на PRO и ULTRA.", "Баланс можно пополнять без смены тарифа."]],
    ],
  },
  {
    outputPath: "en/pricing/index.html",
    lang: "en",
    canonical: `${siteOrigin}/en/pricing/`,
    title: "AdShorts AI Pricing: AI Shorts, Reels and TikTok Videos",
    description:
      "AdShorts AI pricing for creating YouTube Shorts, Reels and TikTok videos with AI scripts, voiceover, subtitles, visuals and publishing tools.",
    ogTitle: "AdShorts AI Pricing",
    ogDescription:
      "Choose a plan for regular short-form video production: AI script, voiceover, subtitles, visuals and publishing tools.",
    h1: "Pricing",
    lead:
      "AdShorts AI pricing is designed for regular YouTube Shorts, Reels and TikTok creation: from a first test video to batch production.",
    ctas: [
      ["Start free", "/en/app/studio?source=seo_fallback_pricing"],
      ["View examples", "/en/examples/"],
    ],
    sections: [
      ["START", ["390 RUB / 50 credits.", "Up to 5 Shorts.", "Best for a first launch and quality check."]],
      ["PRO", ["1,490 RUB / 250 credits.", "Up to 25 Shorts.", "For regular content without watermark."]],
      ["ULTRA", ["4,990 RUB / 1000 credits.", "Up to 100 Shorts.", "For high-volume channels and batch production."]],
      ["Add-on packs", ["Credit packs are available on PRO and ULTRA.", "Top up balance without changing your plan."]],
    ],
  },
  {
    outputPath: "examples/index.html",
    lang: "ru",
    canonical: `${siteOrigin}/examples/`,
    title: "Примеры Shorts AdShorts AI: шаблоны для рекламы, роста и обучения",
    description:
      "Примеры Shorts, которые можно использовать как стартовый шаблон: реклама услуг, рост канала, обучающий контент и storytelling.",
    ogTitle: "Примеры Shorts AdShorts AI",
    ogDescription:
      "Готовые сцены и шаблоны для запуска Shorts: выберите пример и откройте похожую структуру в студии.",
    h1: "Готовые сцены для запуска Shorts",
    lead:
      "Примеры AdShorts AI показывают, как можно быстро стартовать с рекламным, обучающим или growth-роликом и открыть похожую структуру в студии.",
    ctas: [
      ["Открыть студию", "/app/studio?source=seo_fallback_examples"],
      ["Смотреть тарифы", "/pricing/"],
    ],
    sections: [
      ["Рекламные Shorts", ["Структуры для услуг, продуктов и офферов.", "Помогают быстро перейти от идеи к продающему ролику."]],
      ["Shorts для роста канала", ["Сцены для регулярного контента и удержания.", "Подходят для тестирования разных форматов."]],
      ["Обучающие Shorts", ["Форматы для экспертов, курсов и объясняющего контента.", "Помогают превратить тезисы в готовую структуру ролика."]],
    ],
  },
  {
    outputPath: "en/examples/index.html",
    lang: "en",
    canonical: `${siteOrigin}/en/examples/`,
    title: "AdShorts AI Examples: Templates for Ads, Growth and Education",
    description:
      "AdShorts AI examples for short-form video creation: ad Shorts, channel growth, educational content and storytelling templates.",
    ogTitle: "AdShorts AI Examples",
    ogDescription:
      "Ready scenes and templates for Shorts: choose an example and open a similar structure in the studio.",
    h1: "Ready scenes for launching Shorts",
    lead:
      "AdShorts AI examples show how to start with an ad, educational or growth video and open a similar structure in the studio.",
    ctas: [
      ["Open studio", "/en/app/studio?source=seo_fallback_examples"],
      ["View pricing", "/en/pricing/"],
    ],
    sections: [
      ["Ad Shorts", ["Structures for services, products and offers.", "A fast path from idea to promotional short-form video."]],
      ["Channel growth Shorts", ["Scenes for regular content and retention.", "Useful for testing multiple formats."]],
      ["Educational Shorts", ["Formats for experts, courses and explainers.", "Turn key points into a ready video structure."]],
    ],
  },
];

const escapeAttr = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const replaceTag = (html, pattern, replacement, label) => {
  if (!pattern.test(html)) {
    throw new Error(`Could not find ${label} in ${sourceShellPath}`);
  }
  return html.replace(pattern, replacement);
};

const setNamedMeta = (html, name, content) =>
  replaceTag(
    html,
    new RegExp(`<meta\\s+[^>]*name="${name}"[^>]*>`, "i"),
    `<meta name="${name}" content="${escapeAttr(content)}" />`,
    `meta[name="${name}"]`,
  );

const setPropertyMeta = (html, property, content) => {
  const replacement = `<meta property="${property}" content="${escapeAttr(content)}" />`;
  const pattern = new RegExp(`<meta\\s+[^>]*property="${property}"[^>]*>`, "i");
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }

  return replaceTag(
    html,
    /(<meta\s+[^>]*property="og:type"[^>]*>)/i,
    `$1\n    ${replacement}`,
    `meta[property="${property}"] insertion point`,
  );
};

const renderFallbackList = (items) => items.map((item) => `<li>${escapeAttr(item)}</li>`).join("");

const renderSeoFallback = (route) => `\n      <main class="seo-fallback" data-seo-fallback="true">\n        <section class="seo-fallback__hero">\n          <p class="seo-fallback__brand">AdShorts AI</p>\n          <h1>${escapeAttr(route.h1)}</h1>\n          <p>${escapeAttr(route.lead)}</p>\n          <nav aria-label="${route.lang === "ru" ? "Основные действия" : "Primary actions"}">\n            ${route.ctas.map(([label, href]) => `<a href="${escapeAttr(href)}">${escapeAttr(label)}</a>`).join("\n            ")}\n          </nav>\n        </section>\n        ${route.sections
          .map(
            ([heading, items]) => `<section class="seo-fallback__section">\n          <h2>${escapeAttr(heading)}</h2>\n          <ul>${renderFallbackList(items)}</ul>\n        </section>`,
          )
          .join("\n        ")}\n      </main>\n    `;

const renderRouteShell = (sourceHtml, route) => {
  let html = sourceHtml;
  html = replaceTag(html, /<html\s+lang="[^"]+"/i, `<html lang="${route.lang}"`, "html lang");
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(route.title)}</title>`, "title");
  html = setNamedMeta(html, "description", route.description);
  html = setNamedMeta(html, "robots", "index, follow");
  html = replaceTag(
    html,
    /<link\s+[^>]*rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${route.canonical}" />`,
    "canonical",
  );
  html = setPropertyMeta(html, "og:type", "website");
  html = setPropertyMeta(html, "og:url", route.canonical);
  html = setPropertyMeta(html, "og:title", route.ogTitle);
  html = setPropertyMeta(html, "og:description", route.ogDescription);
  html = replaceTag(
    html,
    /<div id="app"><\/div>/i,
    `<div id="app">${renderSeoFallback(route)}</div>`,
    "app root",
  );
  return html;
};

const sourceHtml = await readFile(sourceShellPath, "utf8");

await Promise.all(
  routeShells.map(async (route) => {
    const outputPath = path.join(appDistDir, route.outputPath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, renderRouteShell(sourceHtml, route));
  }),
);

console.log(`Generated ${routeShells.length} app route shells.`);
