#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteOrigin = "https://adshortsai.com";
const dateModified = "2026-06-18";

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const setTitle = (html, title) => html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

const setH1 = (html, h1) => html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, `<h1>${escapeHtml(h1)}</h1>`);

const setMeta = (html, attributeName, attributeValue, content) => {
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attributeName}="${escapeRegExp(attributeValue)}")[^>]*>`, "i");
  if (!pattern.test(html)) {
    throw new Error(`Missing meta ${attributeName}="${attributeValue}"`);
  }

  return html.replace(pattern, (tag) => {
    if (!/\bcontent="/i.test(tag)) {
      return tag.replace(/\/?>$/, ` content="${escapeHtml(content)}" />`);
    }
    return tag.replace(/\bcontent="[^"]*"/i, `content="${escapeHtml(content)}"`);
  });
};

const updateHeadMeta = (html, { title, description }) => {
  let next = setTitle(html, title);
  next = setMeta(next, "name", "description", description);
  next = setMeta(next, "property", "og:title", title);
  next = setMeta(next, "property", "og:description", description);
  next = setMeta(next, "name", "twitter:title", title);
  next = setMeta(next, "name", "twitter:description", description);
  next = next.replace(/("headline"\s*:\s*")[^"]*(")/g, `$1${title}$2`);
  next = next.replace(/("description"\s*:\s*")[^"]*(")/g, `$1${description}$2`);
  next = next.replace(/("dateModified"\s*:\s*")[^"]*(")/g, `$1${dateModified}$2`);
  if (!/"dateModified"\s*:/.test(next)) {
    next = next.replace(/("inLanguage"\s*:\s*"ru"\s*,)/, `$1\n      "dateModified": "${dateModified}",`);
  }
  return next;
};

const stripBlock = (html, name) =>
  html.replace(new RegExp(`\\s*<!-- ${name}:start -->[\\s\\S]*?<!-- ${name}:end -->\\n?`, "g"), "\n");

const renderLinks = (links) =>
  links.map(([href, text]) => `<a href="${href}">${escapeHtml(text)}</a>`).join(", ");

const renderBlock = ({ heading, lead, bullets, links }) => `          <!-- seo-yandex-growth:start -->
          <h2>${escapeHtml(heading)}</h2>
          <p>
            ${escapeHtml(lead)}
          </p>
          <ul>
${bullets.map((item) => `            <li>${item}</li>`).join("\n")}
          </ul>
          <p>
            Дальше по воронке: ${renderLinks(links)}.
          </p>
          <!-- seo-yandex-growth:end -->`;

const addBeforeReadAlso = (html, block) => {
  const marker = /\n\s*<h2>Читайте также<\/h2>/;
  if (!marker.test(html)) {
    throw new Error("Missing read-also block");
  }
  return html.replace(marker, `\n\n${block}\n\n          <h2>Читайте также</h2>`);
};

const pageUpdates = [
  {
    file: "ai-generator-shorts-dlya-malogo-biznesa/index.html",
    route: "/ai-generator-shorts-dlya-malogo-biznesa/",
    title: "AI Shorts для бизнеса: видео для продаж без монтажа",
    description:
      "AI Shorts для бизнеса: превращайте офферы, FAQ и боли клиентов в короткие видео со сценарием, озвучкой, субтитрами и CTA без ручного монтажа.",
    h1: "AI Shorts для бизнеса: ролики без монтажа",
    block: {
      heading: "AI Shorts для бизнеса: что ищет пользователь",
      lead:
        "По этому запросу чаще всего ищут не теорию монтажа, а понятный сервис, который быстро превращает оффер, вопросы клиентов и преимущества продукта в вертикальные ролики.",
      bullets: [
        "<strong>Для продаж.</strong> Один ролик = один оффер, один хук и один CTA.",
        "<strong>Для экспертизы.</strong> Серия коротких ответов на частые вопросы клиентов работает лучше случайных тем.",
        "<strong>Для тестов.</strong> Быстро собирайте несколько вариантов первого кадра, озвучки и заголовка, чтобы найти связку с лучшим CTR.",
      ],
      links: [
        ["../sozdat-shorts-video/", "создать Shorts-видео"],
        ["../ai-generator-video-dlya-socsetey/", "AI-видео для соцсетей"],
        ["../pricing/", "тарифы"],
      ],
    },
  },
  {
    file: "ozvuchka-dlya-shorts-kak-vybrat-golos/index.html",
    route: "/ozvuchka-dlya-shorts-kak-vybrat-golos/",
    title: "Нейросеть для Shorts озвучки: голос, темп и паузы",
    description:
      "Нейросеть для Shorts озвучки: как выбрать голос, темп, паузы и субтитры, чтобы ролик звучал естественно и удерживал зрителя.",
    h1: "Нейросеть для Shorts озвучки: как выбрать голос",
    block: {
      heading: "Нейросеть для Shorts озвучки: быстрый чек-лист",
      lead:
        "Когда пользователь ищет озвучку через нейросеть, ему важны не только голоса. Решают первые секунды, скорость речи и то, насколько голос совпадает с темой ролика.",
      bullets: [
        "<strong>Голос.</strong> Для экспертного ролика выбирайте спокойный и уверенный тембр, для развлекательного - более энергичный.",
        "<strong>Темп.</strong> Shorts обычно требуют чуть более быстрого темпа, но без ощущения скороговорки.",
        "<strong>Паузы.</strong> Оставляйте микропаузу перед выводом или CTA, чтобы зритель успел понять мысль.",
        "<strong>Субтитры.</strong> Делайте их короткими: они должны усиливать речь, а не превращаться в длинный текст.",
      ],
      links: [
        ["../subtitry-dlya-shorts-avtomatom/", "автоматические субтитры"],
        ["../kak-sdelat-chistyy-zvuk-v-shorts/", "чистый звук"],
        ["../app/studio?source=seo_yandex_voice", "студия"],
      ],
    },
  },
  {
    file: "kak-sdelat-shorts-bez-montazha/index.html",
    route: "/kak-sdelat-shorts-bez-montazha/",
    title: "Shorts без монтажа: автоматическое создание видео",
    description:
      "Shorts без монтажа: как автоматизировать сценарий, озвучку, субтитры и первый кадр, чтобы выпускать видео регулярно без ручной сборки.",
    h1: "Shorts без монтажа: автоматическое создание видео",
    block: {
      heading: "Автоматическое создание Shorts без монтажа",
      lead:
        "Запросы про сервис AI Shorts 24/7 и видео без монтажа обычно означают, что пользователю нужен повторяемый процесс: идея, сценарий, озвучка, субтитры и экспорт без долгой ручной сборки.",
      bullets: [
        "<strong>Сценарий.</strong> Держите одну мысль на ролик и начинайте с конкретной боли или обещания.",
        "<strong>Озвучка.</strong> Используйте нейроголос, если нужен стабильный выпуск без записи с микрофона.",
        "<strong>Первый кадр.</strong> Делайте его как превью: крупный объект, контраст и 1-3 слова.",
        "<strong>Правки.</strong> Тестируйте две версии старта, а не переписывайте весь ролик.",
      ],
      links: [
        ["../avtomatizaciya-youtube-shorts/", "автоматизация Shorts"],
        ["../sozdat-shorts-video/", "создать Shorts-видео"],
        ["../app/studio?source=seo_yandex_no_edit", "студия"],
      ],
    },
  },
  {
    file: "avtomatizaciya-youtube-shorts/index.html",
    route: "/avtomatizaciya-youtube-shorts/",
    title: "Автоматическое создание Shorts: AI workflow без монтажа",
    description:
      "Автоматическое создание Shorts: AI workflow для сценариев, озвучки, субтитров и черновиков видео без ручного монтажа.",
    h1: "Автоматическое создание Shorts без монтажа",
    block: {
      heading: "Сервис AI Shorts 24/7: что автоматизировать",
      lead:
        "Для органики важна не разовая публикация, а стабильная серия тестов. Автоматизация нужна там, где вручную тормозят сценарии, озвучка, субтитры и пересборка вариантов.",
      bullets: [
        "<strong>План.</strong> Разбейте тему на серию коротких роликов, а не один большой сценарий.",
        "<strong>Производство.</strong> Автоматизируйте повторяемые шаги: структура, озвучка, субтитры, CTA.",
        "<strong>Аналитика.</strong> Сравнивайте первые 3 секунды, удержание и клики по профилю.",
      ],
      links: [
        ["../kak-sdelat-shorts-bez-montazha/", "Shorts без монтажа"],
        ["../analitika-youtube-shorts-kak-chitat/", "аналитика Shorts"],
        ["../app/studio?source=seo_yandex_automation", "студия"],
      ],
    },
  },
  {
    file: "sozdat-shorts-video/index.html",
    route: "/sozdat-shorts-video/",
    title: "Создать Shorts видео: AI-сервис без монтажа",
    description:
      "Создать Shorts видео через AI-сервис: сценарий, озвучка, субтитры, фон и CTA в формате 9:16 без ручного монтажа.",
    h1: "Создать Shorts-видео без ручного монтажа",
    block: {
      heading: "Создать Shorts-видео через AI-сервис",
      lead:
        "Коммерческий интент здесь простой: пользователь хочет быстро получить вертикальное видео, а не читать длинный учебник по монтажу.",
      bullets: [
        "<strong>Начните с оффера.</strong> Что зритель должен понять или сделать после ролика.",
        "<strong>Соберите черновик.</strong> Сценарий, голос, субтитры и визуальный фон должны появляться в одном процессе.",
        "<strong>Сделайте вариант B.</strong> Чаще всего стоит менять первый кадр и хук, а не всю структуру.",
      ],
      links: [
        ["../ai-generator-shorts/", "AI-генератор Shorts"],
        ["../kak-sdelat-shorts-bez-montazha/", "Shorts без монтажа"],
        ["../app/studio?source=seo_yandex_create_video", "создать в студии"],
      ],
    },
  },
  {
    file: "kak-postavit-oblozhku-na-shorts/index.html",
    route: "/kak-postavit-oblozhku-na-shorts/",
    title: "Как поменять превью на Shorts: обложка и первый кадр",
    description:
      "Как поменять превью на Shorts: что проверить в YouTube Studio, почему обложка может не обновляться и как подготовить первый кадр.",
    h1: "Как поменять превью и обложку на Shorts",
    block: {
      heading: "Как поменять превью на Shorts: короткий ответ",
      lead:
        "Если нужно именно поменять превью уже опубликованного Shorts, начните с YouTube Studio и проверьте, доступна ли смена миниатюры для конкретного ролика. Если опции нет или лента показывает другой кадр, работайте с первым кадром видео.",
      bullets: [
        "<strong>Проверьте ролик в Studio.</strong> Откройте детали видео и посмотрите, доступна ли смена миниатюры.",
        "<strong>Проверьте кэш.</strong> После изменения превью старый кадр может показываться некоторое время.",
        "<strong>Контролируйте первый кадр.</strong> В ленте Shorts он часто важнее обычной обложки.",
        "<strong>Не перегружайте текст.</strong> Для превью достаточно 1-3 крупных слов.",
      ],
      links: [
        ["../oblozhka-dlya-shorts/", "обложка для Shorts"],
        ["../kak-sdelat-tekst-na-video-dlya-shorts/", "текст на видео"],
        ["../app/studio?source=seo_yandex_preview", "студия"],
      ],
    },
  },
];

const updatePage = async (page) => {
  const filePath = path.join(rootDir, page.file);
  let html = await readFile(filePath, "utf8");
  html = updateHeadMeta(html, page);
  html = setH1(html, page.h1);
  html = stripBlock(html, "seo-yandex-growth");
  html = addBeforeReadAlso(html, renderBlock(page.block));
  await writeFile(filePath, html, "utf8");
  return page.file;
};

const updateSitemap = async () => {
  const sitemapPath = path.join(rootDir, "sitemap.xml");
  let sitemap = await readFile(sitemapPath, "utf8");
  let updated = 0;

  for (const page of pageUpdates) {
    const canonical = `${siteOrigin}${page.route}`;
    const pattern = new RegExp(`(<loc>${escapeRegExp(canonical)}<\\/loc>[\\s\\S]*?<lastmod>)([^<]+)(<\\/lastmod>)`);
    if (!pattern.test(sitemap)) {
      throw new Error(`sitemap.xml: missing ${canonical}`);
    }
    sitemap = sitemap.replace(pattern, (_match, before, current, after) => {
      if (current === dateModified) return `${before}${current}${after}`;
      updated += 1;
      return `${before}${dateModified}${after}`;
    });
  }

  await writeFile(sitemapPath, sitemap, "utf8");
  return updated;
};

const changed = [];
for (const page of pageUpdates) {
  changed.push(await updatePage(page));
}

const sitemapUpdates = await updateSitemap();

console.log(
  [
    `SEO Yandex growth sprint updated ${changed.length} pages.`,
    `Updated ${sitemapUpdates} sitemap lastmod values to ${dateModified}.`,
    ...changed.map((file) => `- ${file}`),
  ].join("\n"),
);
