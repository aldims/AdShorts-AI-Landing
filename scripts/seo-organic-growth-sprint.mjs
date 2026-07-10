import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteOrigin = "https://adshortsai.com";
const dateModified = "2026-06-17";

const priorityRoutes = [
  "/en/faceless-youtube-shorts/",
  "/en/youtube-shorts-swipe-away-rate/",
  "/shorts-chernye-polosy/",
  "/en/youtube-shorts-for-lawyers/",
  "/kak-ubrat-tryasku-v-shorts/",
  "/shorts-ne-nabirayut-prosmotry/",
  "/shorts-dlya-kliniki/",
  "/kak-chasto-vykladyvat-shorts/",
  "/kak-sdelat-seriyu-shorts/",
  "/shorts-ne-konvertiruyut-v-podpischiki/",
  "/kak-sdelat-huk-v-shorts/",
  "/kak-podnyat-uderzhanie-v-shorts/",
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
  "/en/youtube-shorts-not-showing-on-channel/",
  "/en/youtube-shorts-description-what-to-write/",
  "/en/youtube-shorts-from-photos/",
  "/en/how-to-upload-youtube-shorts/",
  "/en/youtube-shorts-not-converting-to-subscribers/",
  "/en/youtube-shorts-no-sound/",
  "/en/youtube-shorts-black-bars/",
  "/en/youtube-shorts-not-getting-views/",
  "/en/youtube-shorts-resolution/",
  "/en/copyright-free-music-for-shorts/",
  "/en/youtube-shorts-copyright/",
  "/en/background-for-youtube-shorts/",
  "/en/how-often-to-post-youtube-shorts/",
  "/en/ctr-in-youtube-shorts/",
  "/razreshenie-dlya-shorts/",
  "/nizkoe-uderzhanie-v-youtube-shorts/",
  "/monetizaciya-youtube-shorts/",
  "/avtorskie-prava-v-shorts/",
  "/opisanie-dlya-shorts-chto-pisat/",
  "/shorts-iz-foto/",
  "/kak-zagruzit-shorts/",
  "/shorts-ne-otobrazhayutsya-na-kanale/",
  "/shorts-net-zvuka/",
];

const metaOverrides = {
  "/en/faceless-youtube-shorts/": {
    title: "Faceless YouTube Shorts: Formats, Hooks and Retention",
    description:
      "Plan faceless YouTube Shorts with stronger hooks, readable text, voiceover, visual progress and retention checks before publishing the next video.",
  },
  "/kak-sdelat-seriyu-shorts/": {
    title: "Как сделать серию Shorts: темы, структура и тесты",
    description:
      "Как сделать серию YouTube Shorts: выбрать повторяемый формат, собрать темы, удерживать внимание и проверять результат по метрикам.",
  },
  "/shorts-ne-konvertiruyut-v-podpischiki/": {
    title: "Shorts не конвертируют в подписчиков: что исправить",
    description:
      "Почему Shorts набирают просмотры, но не дают подписчиков: проверьте обещание канала, CTA, концовку, профиль и следующий шаг зрителя.",
  },
  "/kak-sdelat-huk-v-shorts/": {
    title: "Как сделать хук в Shorts: первые 2 секунды и примеры",
    description:
      "Как сделать хук в YouTube Shorts: усилить первый кадр, первую фразу, текст на экране и проверить, где зрители пролистывают ролик.",
  },
  "/kak-podnyat-uderzhanie-v-shorts/": {
    title: "Как поднять удержание в Shorts: 7 правок перед публикацией",
    description:
      "Как поднять удержание в YouTube Shorts: проверьте первый кадр, темп, субтитры, звук, середину ролика, loop и понятный финал.",
  },
  "/en/low-retention-on-youtube-shorts/": {
    title: "YouTube Shorts Retention: Fix the First 3 Seconds",
    description:
      "Fix YouTube Shorts retention in the first seconds: diagnose early drops, weak hooks, pacing, text, audio and what to test before the next upload.",
  },
  "/en/youtube-shorts-getting-0-views/": {
    title: "YouTube Shorts Getting 0 Views? Checks Before Reuploading",
    description:
      "YouTube Shorts getting 0 views? Check visibility, format, moderation, first frame and retention signals before deleting or reuploading.",
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
  "/en/youtube-shorts-not-showing-on-channel/": {
    title: "YouTube Shorts Not Showing on Channel? 10 Checks to Fix It",
    description:
      "YouTube Shorts not showing on your channel? Check visibility, Shorts recognition, cache, restrictions, processing and channel display settings.",
  },
  "/en/youtube-shorts-description-what-to-write/": {
    title: "YouTube Shorts Description: Length, Examples and Best Practices",
    description:
      "What to write in a YouTube Shorts description: ideal length, first line, hashtags, examples and common mistakes that make descriptions look spammy.",
  },
  "/en/youtube-shorts-from-photos/": {
    title: "Can YouTube Shorts Be Made From Photos? Slideshow Guide",
    description:
      "Can YouTube Shorts be made from photos? Build a watchable slideshow with pacing, transitions, on-screen text and a clean 20-30 second structure.",
  },
  "/en/how-to-upload-youtube-shorts/": {
    title: "How to Upload YouTube Shorts: Format, Length and Checklist",
    description:
      "How to upload YouTube Shorts from phone or desktop: format, length, title, description, visibility checks and common publishing issues.",
  },
  "/en/youtube-shorts-not-converting-to-subscribers/": {
    title: "YouTube Shorts Not Converting to Subscribers? Fix the CTA",
    description:
      "If YouTube Shorts get views but no subscribers, fix the promise, CTA, ending, channel fit and next-step path before changing the whole topic.",
  },
  "/en/youtube-shorts-no-sound/": {
    title: "YouTube Shorts No Sound? Audio Fix Checklist",
    description:
      "YouTube Shorts have no sound? Check export audio, muted tracks, music restrictions, codecs, device playback and what to fix before reuploading.",
  },
  "/en/youtube-shorts-black-bars/": {
    title: "YouTube Shorts Black Bars? Fix 9:16 Format and Export",
    description:
      "Remove black bars from YouTube Shorts: check 9:16 format, 1080x1920 resolution, crop, background fill and export settings before upload.",
  },
  "/en/youtube-shorts-not-getting-views/": {
    title: "YouTube Shorts Not Getting Views? Reasons and Fixes",
    description:
      "YouTube Shorts not getting views? Diagnose first-frame clarity, topic fit, format, visibility, retention, posting consistency and testing mistakes.",
  },
  "/en/youtube-shorts-resolution/": {
    title: "YouTube Shorts Resolution: 1080x1920, 9:16 and Export Settings",
    description:
      "Best YouTube Shorts resolution and export settings: 1080x1920, 9:16, FPS, bitrate and checks to avoid blur, black bars and tiny text.",
  },
  "/en/copyright-free-music-for-shorts/": {
    title: "Copyright-Free Music for YouTube Shorts: Safe Use Checklist",
    description:
      "Choose copyright-free music for YouTube Shorts safely: licenses, platform libraries, attribution, monetization risks and audio checks before upload.",
  },
  "/en/youtube-shorts-copyright/": {
    title: "YouTube Shorts Copyright: Music, Clips and Monetization Checks",
    description:
      "YouTube Shorts copyright guide: music, reused clips, claims, restrictions, monetization risk and what to check before publishing.",
  },
  "/en/background-for-youtube-shorts/": {
    title: "Background for YouTube Shorts: Visual Ideas That Keep Attention",
    description:
      "Choose a background for YouTube Shorts that supports retention: readable text, movement, contrast, topic fit and faceless video formats.",
  },
  "/en/how-often-to-post-youtube-shorts/": {
    title: "How Often to Post YouTube Shorts: Consistent Schedule Guide",
    description:
      "How often to post YouTube Shorts: practical publishing cadence, testing rhythm, topic batching and what to measure before increasing volume.",
  },
  "/en/ctr-in-youtube-shorts/": {
    title: "CTR in YouTube Shorts: Titles, First Frame and Packaging",
    description:
      "Improve CTR in YouTube Shorts with clearer titles, first frames, topic promises and packaging tests that match viewer intent.",
  },
  "/razreshenie-dlya-shorts/": {
    title: "Разрешение для Shorts: 1080x1920, 9:16 и настройки экспорта",
    description:
      "Какое разрешение выбрать для YouTube Shorts: 1080x1920, вертикальный формат 9:16, FPS, битрейт и проверки против мыла и черных полос.",
  },
  "/nizkoe-uderzhanie-v-youtube-shorts/": {
    title: "Низкое удержание в YouTube Shorts: как исправить первые секунды",
    description:
      "Что делать, если в YouTube Shorts низкое удержание: проверьте первый кадр, хук, темп, текст, звук и тесты перед следующим роликом.",
  },
  "/monetizaciya-youtube-shorts/": {
    title: "Монетизация YouTube Shorts: условия, ошибки и что проверять",
    description:
      "Как работает монетизация YouTube Shorts: условия, просмотры, авторские права, повторяющийся контент и что проверить перед масштабированием канала.",
  },
  "/avtorskie-prava-v-shorts/": {
    title: "Авторские права в Shorts: музыка, фрагменты и монетизация",
    description:
      "Авторские права в YouTube Shorts: музыка, чужие фрагменты, claims, ограничения, монетизация и безопасные проверки перед публикацией.",
  },
  "/opisanie-dlya-shorts-chto-pisat/": {
    title: "Описание для Shorts: длина, примеры и частые ошибки",
    description:
      "Что писать в описании YouTube Shorts: оптимальная длина, первая строка, хэштеги, примеры и ошибки, из-за которых описание выглядит спамом.",
  },
  "/shorts-iz-foto/": {
    title: "Shorts из фото: как сделать слайдшоу, которое досматривают",
    description:
      "Как сделать YouTube Shorts из фото: структура слайдшоу, темп, переходы, крупный текст и проверка перед публикацией.",
  },
  "/kak-zagruzit-shorts/": {
    title: "Как загрузить Shorts: формат, длина и чеклист публикации",
    description:
      "Как загрузить YouTube Shorts с телефона или компьютера: формат, длина, название, описание, видимость и частые проблемы публикации.",
  },
  "/shorts-ne-otobrazhayutsya-na-kanale/": {
    title: "Shorts не отображаются на канале: что проверить и как исправить",
    description:
      "Shorts не отображаются на канале? Проверьте видимость, распознавание Shorts, кэш, ограничения, обработку и настройки канала.",
  },
  "/shorts-net-zvuka/": {
    title: "Нет звука в YouTube Shorts: быстрый чеклист исправления",
    description:
      "Что делать, если в YouTube Shorts нет звука: экспорт, дорожки, ограничения музыки, кодек, проверка на телефоне и повторная загрузка.",
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
      ["https://adshortsai.com/ai-generator-shorts/", "AI-генератор Shorts"],
      ["https://adshortsai.com/generator-youtube-shorts/", "генератор YouTube Shorts"],
      ["https://adshortsai.com/ai-generator-shorts-dlya-malogo-biznesa/", "Shorts для малого бизнеса"],
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
      ["https://adshortsai.com/en/ai-shorts-generator/", "AI Shorts generator"],
      ["https://adshortsai.com/en/youtube-shorts-generator/", "YouTube Shorts generator"],
      ["https://adshortsai.com/en/ai-shorts-generator-for-small-business/", "AI Shorts for small business"],
      ["https://adshortsai.com/en/faceless-youtube-shorts-generator/", "faceless Shorts generator"],
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
  }).slice(0, 10);
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

const getActionPlan = ({ locale, category }) => {
  if (locale === "en") {
    return {
      heading: "Three checks before the next upload",
      intro:
        "This page should lead to a real publishing decision, not just another read. Use the short checklist below to turn the topic into one measurable Shorts test.",
      items: {
        production: [
          "Confirm the video is vertical 9:16, readable on a phone and exported without black bars, muffled audio or tiny subtitles.",
          "Keep one production variable stable so the next result is not mixed with format or quality issues.",
          "Save the clean version as the baseline before changing style, voice, music or background visuals.",
        ],
        performance: [
          "Write the exact viewer promise for the first frame and first spoken line.",
          "Change only one retention lever: hook, pacing, visual progress, subtitle density or ending.",
          "Compare the first two seconds, average view duration and subscriber or CTA clicks before the next edit.",
        ],
        text: [
          "Draft three hook variants that promise the same outcome in different words.",
          "Check that on-screen text is readable without sound and does not repeat the voiceover too literally.",
          "Use one CTA that matches the viewer intent instead of adding several competing actions.",
        ],
        growth: [
          "Turn the topic into a repeatable series with one audience, one promise and one next action.",
          "Publish several variants close together so the result is not based on a single upload.",
          "Keep the winning format linked from the guide hub and related generator pages.",
        ],
        strategy: [
          "Pick one repeatable format and one audience before generating more videos.",
          "Batch several ideas, but publish only the cleanest version first.",
          "Use retention and click data to decide whether the topic deserves a full series.",
        ],
      }[category],
    };
  }

  return {
    heading: "Три проверки перед следующим роликом",
    intro:
      "Эта страница должна приводить к конкретному тесту, а не просто к чтению. Используйте короткий чеклист ниже, чтобы превратить тему в измеримый Shorts-эксперимент.",
    items: {
      production: [
        "Проверьте вертикальный формат 9:16, читаемость на телефоне, отсутствие черных полос, тихого звука и мелких субтитров.",
        "Оставьте стабильным один production-параметр, чтобы следующий результат не смешался с проблемами качества.",
        "Сохраните чистую версию как базовую перед сменой стиля, голоса, музыки или фона.",
      ],
      performance: [
        "Запишите точное обещание для первого кадра и первой фразы.",
        "Меняйте только один рычаг удержания: хук, темп, визуальный прогресс, плотность субтитров или концовку.",
        "Сравните первые две секунды, среднюю длительность просмотра и подписки или клики по CTA перед следующей правкой.",
      ],
      text: [
        "Подготовьте три варианта хука с одним и тем же обещанием, но разными формулировками.",
        "Проверьте, что текст на экране читается без звука и не дублирует озвучку слишком буквально.",
        "Оставьте один CTA под интент зрителя, а не несколько конкурирующих действий.",
      ],
      growth: [
        "Соберите тему в повторяемую серию: одна аудитория, одно обещание, одно следующее действие.",
        "Выпустите несколько близких вариантов, чтобы вывод не зависел от одного ролика.",
        "Свяжите удачный формат с хабом гайдов и релевантными страницами генераторов.",
      ],
      strategy: [
        "Выберите один повторяемый формат и одну аудиторию до генерации новых роликов.",
        "Соберите несколько идей пачкой, но сначала публикуйте самый чистый вариант.",
        "Решайте по удержанию и кликам, стоит ли развивать тему в полноценную серию.",
      ],
    }[category],
  };
};

const renderActionPlanBlock = ({ locale, category }) => {
  const plan = getActionPlan({ locale, category });

  return `          <!-- seo-action-plan:start -->
          <section class="article-index-boost article-index-boost--action-plan" aria-labelledby="seo-action-plan-heading">
            <h2 id="seo-action-plan-heading">${escapeHtml(plan.heading)}</h2>
            <p>
              ${escapeHtml(plan.intro)}
            </p>
            <ol>
${plan.items.map((item) => `              <li>${escapeHtml(item)}</li>`).join("\n")}
            </ol>
          </section>
          <!-- seo-action-plan:end -->
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
  html = stripBlock(html, "seo-sprint-faq-jsonld");
  html = stripBlock(html, "seo-sprint-faq");
  html = stripBlock(html, "seo-index-boost");
  html = stripBlock(html, "seo-action-plan");
  html = addBeforeReadAlso(html, renderBoostBlock({ locale, h1, category, canonical }));
  html = addBeforeReadAlso(html, renderActionPlanBlock({ locale, category }));
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
