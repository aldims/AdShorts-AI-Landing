#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteOrigin = "https://adshortsai.com";
const indexPolicy = JSON.parse(await readFile(path.join(rootDir, "seo-index-policy.json"), "utf8"));
const indexPaths = new Set(indexPolicy.index.map((entry) => entry.url));
const dateModified = "2026-07-10";
const cssVersion = 55;
const scriptVersion = 8;
const logoUrl = `${siteOrigin}/logo.png?v=2`;

const commercialPages = [
  {
    slug: "youtube-shorts-generator",
    ruSlug: "generator-youtube-shorts",
    targetQuery: "youtube shorts generator",
    title: "YouTube Shorts Generator: AI Script, Voice and Subtitles",
    description:
      "Use AdShorts AI as a YouTube Shorts generator: turn one idea into a vertical video with AI script, voiceover, subtitles, music and visuals.",
    h1: "YouTube Shorts Generator",
    lead:
      "Create a ready-to-edit Short from one topic: script, voiceover, subtitles, background visuals and a publishable 9:16 structure in one workflow.",
    ctaSource: "seo_en_youtube_shorts_generator",
    useCases: ["Creators testing daily Shorts", "Businesses turning offers into short videos", "Teams that need repeatable formats without manual editing"],
    workflow: ["Enter a topic or offer", "Review the AI script and hook", "Choose voice, subtitles and visual style", "Export or publish the finished Short"],
    differentiators: [
      "Built around retention: hook, pacing, on-screen text and ending are part of the same flow.",
      "Useful for repeatable publishing because each idea can become a consistent format.",
      "Pairs generation with editable output, so the first draft is not a dead end.",
    ],
    related: [
      ["../how-to-create-a-hook-in-shorts/", "how to create a hook"],
      ["../how-to-increase-retention-in-shorts/", "increase Shorts retention"],
      ["../youtube-shorts-templates/", "YouTube Shorts templates"],
      ["../pricing/", "AdShorts AI pricing"],
    ],
    faq: [
      ["What does the YouTube Shorts generator create?", "It creates a short-form video draft with script, voiceover, subtitles, music and vertical visuals that you can edit before publishing."],
      ["Is it only for YouTube Shorts?", "The output is optimized for vertical short-form video, so the same workflow can also help with Reels and TikTok variants."],
      ["Should I still edit the result?", "Yes. Use the generated draft to move faster, then adjust the hook, CTA, subtitles or visuals based on your audience."],
    ],
  },
  {
    slug: "ai-shorts-generator",
    ruSlug: "ai-generator-shorts",
    targetQuery: "ai shorts generator",
    title: "AI Shorts Generator for Fast Short-Form Video Production",
    description:
      "AI Shorts generator for creators and teams: create short-form videos from a topic with script, voiceover, subtitles, visuals and CTA-ready structure.",
    h1: "AI Shorts Generator",
    lead:
      "Use AI to turn ideas into short-form videos faster: generate the structure, voice, subtitles and visual rhythm, then edit the details before publishing.",
    ctaSource: "seo_en_ai_shorts_generator",
    useCases: ["Testing more hooks per week", "Repurposing expert ideas into Shorts", "Creating simple product, education and storytelling videos"],
    workflow: ["Start with a clear idea", "Let AI build the first version", "Tighten the first seconds", "Publish one clean test and compare retention"],
    differentiators: [
      "Designed for speed, but still keeps the viewer journey visible: problem, payoff and next step.",
      "Helps avoid blank-page delays when you need a new video today.",
      "Works best when you build a series, not one isolated video.",
    ],
    related: [
      ["../youtube-shorts-generator/", "YouTube Shorts generator"],
      ["../ai-for-youtube-shorts/", "AI for Shorts"],
      ["../how-to-test-youtube-shorts/", "how to test Shorts"],
      ["../examples/", "Shorts examples"],
    ],
    faq: [
      ["Can AI create a full Short from one prompt?", "Yes, but the strongest results come from a specific topic, audience and promise rather than a vague prompt."],
      ["What should I check before publishing?", "Check the first frame, the first line, subtitle readability, pacing and whether the CTA matches the viewer intent."],
      ["Can I use it for business videos?", "Yes. Start with a customer problem, then let the video explain the fix and point to one next action."],
    ],
  },
  {
    slug: "faceless-youtube-shorts-generator",
    ruSlug: "generator-shorts-bez-lica",
    targetQuery: "faceless youtube shorts generator",
    title: "Faceless YouTube Shorts Generator: No Camera Needed",
    description:
      "Create faceless YouTube Shorts with AI: scripts, voiceover, subtitles and visual structure for creators who do not want to film themselves.",
    h1: "Faceless YouTube Shorts Generator",
    lead:
      "Build Shorts without showing your face. AdShorts AI helps turn a topic into a voice-led vertical video with subtitles, background visuals and a clear retention structure.",
    ctaSource: "seo_en_faceless_youtube_shorts_generator",
    useCases: ["Niche channels without on-camera filming", "Educational explainers", "Product or service videos where the idea matters more than the presenter"],
    workflow: ["Choose a faceless format", "Generate a script and voiceover", "Add readable subtitles", "Use visual progress to keep viewers watching"],
    differentiators: [
      "The page structure focuses on clarity because faceless Shorts need strong text and visual progress.",
      "Works for screencasts, facts, comparisons, mini-guides and list formats.",
      "Keeps production simple when lighting, camera confidence or recording conditions are blockers.",
    ],
    related: [
      ["../faceless-youtube-shorts/", "faceless Shorts formats"],
      ["../on-screen-text-for-youtube-shorts/", "on-screen text"],
      ["../voiceover-for-shorts-how-to-choose-a-voice/", "voiceover for Shorts"],
      ["../youtube-shorts-from-photos/", "Shorts from photos"],
    ],
    faq: [
      ["Do faceless Shorts perform worse?", "Not automatically. Performance depends more on the first seconds, clarity, pacing and payoff than on whether a face is visible."],
      ["What format should I start with?", "Start with a mini-guide, checklist, comparison or before-after format because progress is easy to understand."],
      ["Can I make a whole faceless channel this way?", "Yes, if you create a repeatable content system and keep improving formats from retention data."],
    ],
  },
  {
    slug: "youtube-shorts-script-generator",
    ruSlug: "generator-scenariev-youtube-shorts",
    targetQuery: "youtube shorts script generator",
    title: "YouTube Shorts Script Generator: Hooks, Pacing and CTA",
    description:
      "Generate YouTube Shorts scripts with hooks, fast pacing, on-screen text ideas and CTA options before turning the script into a video.",
    h1: "YouTube Shorts Script Generator",
    lead:
      "Start with the script when the idea is clear but the wording is slow. Generate a short hook, compact structure, subtitle-friendly lines and a natural CTA.",
    ctaSource: "seo_en_youtube_shorts_script_generator",
    useCases: ["Creators who need more hook variants", "Businesses turning product points into Shorts", "Editors who want a tighter first draft before production"],
    workflow: ["Write the topic and audience", "Generate several hook directions", "Pick a 20-40 second structure", "Turn the winning script into a video"],
    differentiators: [
      "Script generation is connected to video generation, so copy is written for spoken pacing and subtitles.",
      "Prompts viewers toward one next action instead of forcing a sales pitch into every line.",
      "Helps create multiple angles from one idea for testing.",
    ],
    related: [
      ["../how-to-write-a-script-for-shorts/", "how to write a Shorts script"],
      ["../how-to-create-a-hook-in-shorts/", "hook formulas"],
      ["../cta-in-youtube-shorts/", "CTA in Shorts"],
      ["../youtube-shorts-title-how-to-write/", "Shorts title"],
    ],
    faq: [
      ["What makes a Shorts script different?", "It needs a fast first line, clear progress, short spoken phrases and a payoff that arrives before attention drops."],
      ["Can I generate several versions?", "Yes. Test different hooks or CTAs while keeping the core idea stable."],
      ["Should the script include hashtags?", "No. Keep the spoken script focused on the viewer. Add keywords and hashtags separately in title or description."],
    ],
  },
  {
    slug: "shorts-video-maker",
    ruSlug: "sozdat-shorts-video",
    targetQuery: "shorts video maker",
    title: "Shorts Video Maker: Create Vertical Videos Without Manual Editing",
    description:
      "Use AdShorts AI as a Shorts video maker for 9:16 videos with AI script, subtitles, voiceover, music and background visuals.",
    h1: "Shorts Video Maker",
    lead:
      "Make vertical videos for Shorts, Reels and TikTok without building every cut manually. Start with an idea and produce a structured draft you can edit.",
    ctaSource: "seo_en_shorts_video_maker",
    useCases: ["Fast video drafts for content calendars", "Short educational clips", "Offer, product and service explainers"],
    workflow: ["Choose the topic", "Generate the video draft", "Edit subtitles and voice if needed", "Export a vertical video for the next test"],
    differentiators: [
      "Combines script, voice, subtitles and visuals instead of solving only one part of production.",
      "Keeps videos short and structured so the output is not just a slideshow.",
      "Useful for teams that need a repeatable workflow, not a one-off template.",
    ],
    related: [
      ["../how-to-make-shorts-without-editing/", "make Shorts without editing"],
      ["../video-format-for-youtube-shorts/", "video format for Shorts"],
      ["../automatic-subtitles-for-youtube-shorts/", "automatic subtitles"],
      ["../pricing/", "pricing"],
    ],
    faq: [
      ["Is this a video editor or a generator?", "It is closer to a generator with editing controls: AI creates the draft and you adjust the result."],
      ["Can I use it without filming?", "Yes. Use generated or uploaded visuals, voiceover and subtitles instead of recording everything yourself."],
      ["What should I improve first?", "Improve the hook and subtitle readability first because they affect early retention most directly."],
    ],
  },
  {
    slug: "youtube-shorts-automation",
    ruSlug: "avtomatizaciya-youtube-shorts",
    targetQuery: "youtube shorts automation",
    title: "YouTube Shorts Automation: Build a Repeatable AI Workflow",
    description:
      "YouTube Shorts automation workflow for creators and teams: generate scripts, voiceover, subtitles and video drafts, then test formats consistently.",
    h1: "YouTube Shorts Automation",
    lead:
      "Automate the repetitive parts of Shorts production while keeping human control over ideas, claims and final edits. The goal is more useful tests, not low-quality spam.",
    ctaSource: "seo_en_youtube_shorts_automation",
    useCases: ["Publishing more consistently", "Building content batches", "Turning one content pillar into many short tests"],
    workflow: ["Create a topic bank", "Generate scripts in batches", "Produce video drafts", "Publish, measure retention and reuse what works"],
    differentiators: [
      "Focuses on a sustainable workflow instead of mass-uploading weak variations.",
      "Keeps the human review step for accuracy, brand fit and claims.",
      "Works best with content pillars and a weekly testing plan.",
    ],
    related: [
      ["../youtube-shorts-content-plan-for-a-month/", "Shorts content plan"],
      ["../how-to-batch-film-shorts/", "batch Shorts workflow"],
      ["../how-often-to-post-youtube-shorts/", "posting frequency"],
      ["../youtube-shorts-analytics-how-to-read/", "Shorts analytics"],
    ],
    faq: [
      ["Can YouTube Shorts be fully automated?", "Production tasks can be automated, but strategy, accuracy, brand safety and final review should stay human."],
      ["What should automation not do?", "Do not mass-post duplicate or misleading videos. That can hurt quality signals and trust."],
      ["What is the best first automation step?", "Start by generating scripts and drafts from a content plan, then publish fewer but cleaner tests."],
    ],
  },
  {
    slug: "tiktok-video-generator",
    ruSlug: "generator-video-dlya-tiktok",
    targetQuery: "tiktok video generator",
    title: "TikTok Video Generator: AI Scripts, Voiceover and Captions",
    description:
      "Create TikTok-style vertical videos with AI scripts, voiceover, captions, music and visuals using the AdShorts AI short-form video workflow.",
    h1: "TikTok Video Generator",
    lead:
      "Create TikTok-ready vertical video drafts from an idea, then adapt the hook, pacing and CTA to the audience before posting.",
    ctaSource: "seo_en_tiktok_video_generator",
    useCases: ["Testing short product explainers", "Turning expert tips into vertical clips", "Creating faceless TikTok formats"],
    workflow: ["Start with a specific TikTok angle", "Generate the script and voice", "Keep captions large and readable", "Export a short 9:16 draft"],
    differentiators: [
      "Uses a short-form workflow that can also support YouTube Shorts and Reels variants.",
      "Keeps captions and pacing central because many users watch without sound.",
      "Lets you turn the same core idea into platform-specific angles.",
    ],
    related: [
      ["../instagram-reels-generator/", "Instagram Reels generator"],
      ["../ai-video-generator-for-social-media/", "AI video generator for social media"],
      ["../watching-youtube-shorts-without-sound/", "videos without sound"],
      ["../examples/", "examples"],
    ],
    faq: [
      ["Can I use the same video for TikTok and Shorts?", "Often yes, but adjust the hook, caption style and CTA to match the platform and audience."],
      ["What length should I start with?", "Start with a compact version that earns attention quickly, then test longer variants only when retention is strong."],
      ["Does the generator publish to TikTok directly?", "Use it to create and export the video draft; publishing workflow depends on your connected platform setup."],
    ],
  },
  {
    slug: "instagram-reels-generator",
    ruSlug: "generator-reels-instagram",
    targetQuery: "instagram reels generator",
    title: "Instagram Reels Generator: Create Short Videos with AI",
    description:
      "Generate Instagram Reels drafts with AI script, voiceover, captions, music and vertical visuals, then adapt the result for your brand and offer.",
    h1: "Instagram Reels Generator",
    lead:
      "Turn an idea into a Reels-ready vertical video draft with a clear hook, voiceover, captions and simple visual structure.",
    ctaSource: "seo_en_instagram_reels_generator",
    useCases: ["Service businesses creating simple Reels", "Creators repurposing ideas across platforms", "Brands testing hooks and offers"],
    workflow: ["Choose the audience and promise", "Generate a short script", "Add captions and visuals", "Review the CTA and publish the cleanest version"],
    differentiators: [
      "Creates a structured short-form draft instead of only giving you caption text.",
      "Works for educational, product, storytelling and offer-led Reels.",
      "Keeps the CTA soft so the video can sell without losing retention immediately.",
    ],
    related: [
      ["../tiktok-video-generator/", "TikTok video generator"],
      ["../shorts-video-maker/", "Shorts video maker"],
      ["../how-to-sell-with-youtube-shorts/", "selling with short videos"],
      ["../youtube-shorts-for-business/", "Shorts for business"],
    ],
    faq: [
      ["Can I create Reels without filming myself?", "Yes. Use faceless formats with voiceover, subtitles, product visuals, screenshots or simple background video."],
      ["Should every Reel include a CTA?", "Not every Reel needs a hard CTA. Educational and trust-building clips can use a softer next step."],
      ["Can I reuse the video on Shorts?", "Yes, but check title, description and CTA because discovery mechanics differ by platform."],
    ],
  },
  {
    slug: "ai-video-generator-for-social-media",
    ruSlug: "ai-generator-video-dlya-socsetey",
    targetQuery: "ai video generator for social media",
    title: "AI Video Generator for Social Media: Shorts, Reels and TikTok",
    description:
      "AI video generator for social media teams: create short-form video drafts for YouTube Shorts, Instagram Reels and TikTok from one idea.",
    h1: "AI Video Generator for Social Media",
    lead:
      "Create platform-ready short-form drafts from one idea, then adapt the hook, captions and CTA for Shorts, Reels or TikTok.",
    ctaSource: "seo_en_ai_video_generator_for_social_media",
    useCases: ["Small teams that need more creative tests", "Founders turning product ideas into video", "Agencies building short-form drafts for clients"],
    workflow: ["Define the content pillar", "Generate a short-form draft", "Adapt the opening for each platform", "Track retention, clicks and inquiries"],
    differentiators: [
      "Prioritizes short-form structure over generic video generation.",
      "Combines content strategy, script, voice and subtitles in one workflow.",
      "Helps build a repeatable testing system for organic traffic.",
    ],
    related: [
      ["../youtube-shorts-generator/", "YouTube Shorts generator"],
      ["../tiktok-video-generator/", "TikTok video generator"],
      ["../instagram-reels-generator/", "Instagram Reels generator"],
      ["../youtube-shorts-for-business/", "short-form video for business"],
    ],
    faq: [
      ["What platforms can I create videos for?", "The workflow is built for vertical short-form videos, especially YouTube Shorts, Instagram Reels and TikTok."],
      ["Is this useful for organic traffic?", "Yes, when you use it to publish consistent tests around problems, use cases and offers people already search for."],
      ["How many videos should I create?", "Start with a small batch around one topic cluster, measure signals, then scale formats that keep viewers watching."],
    ],
  },
];

const ruCommercialPages = [
  {
    slug: "generator-youtube-shorts",
    enSlug: "youtube-shorts-generator",
    targetQuery: "генератор youtube shorts",
    title: "Генератор YouTube Shorts: сценарий, озвучка и субтитры",
    description:
      "Генератор YouTube Shorts от AdShorts AI: превратите идею в вертикальное видео с AI-сценарием, озвучкой, субтитрами, музыкой и визуалом.",
    h1: "Генератор YouTube Shorts",
    lead:
      "Создавайте готовый черновик Shorts из одной темы: сценарий, озвучка, субтитры, визуальный фон и структура 9:16 в одном рабочем процессе.",
    ctaSource: "seo_ru_generator_youtube_shorts",
    useCases: ["Авторы, которые тестируют Shorts регулярно", "Бизнес, который превращает офферы в короткие видео", "Команды, которым нужен повторяемый выпуск без ручного монтажа"],
    workflow: ["Введите тему или оффер", "Проверьте AI-сценарий и хук", "Выберите голос, субтитры и визуальный стиль", "Экспортируйте или опубликуйте готовый Shorts"],
    differentiators: [
      "Фокус на удержании: хук, темп, текст на экране и финал связаны в одном процессе.",
      "Подходит для регулярного выпуска, потому что идею легко превратить в повторяемый формат.",
      "Черновик можно редактировать, а не начинать заново после первой генерации.",
    ],
    related: [
      ["../kak-sdelat-huk-v-shorts/", "как сделать хук"],
      ["../kak-podnyat-uderzhanie-v-shorts/", "как поднять удержание"],
      ["../shablony-dlya-shorts/", "шаблоны Shorts"],
      ["../pricing/", "тарифы AdShorts AI"],
    ],
    faq: [
      ["Что создает генератор YouTube Shorts?", "Он создает черновик короткого видео со сценарием, озвучкой, субтитрами, музыкой и вертикальным визуалом, который можно отредактировать перед публикацией."],
      ["Это только для YouTube Shorts?", "Формат оптимизирован под вертикальные короткие видео, поэтому его можно адаптировать также для Reels и TikTok."],
      ["Нужно ли редактировать результат?", "Да. Используйте генерацию для скорости, а затем улучшите хук, CTA, субтитры или визуал под свою аудиторию."],
    ],
  },
  {
    slug: "ai-generator-shorts",
    enSlug: "ai-shorts-generator",
    targetQuery: "ai генератор shorts",
    title: "AI-генератор Shorts для быстрого создания коротких видео",
    description:
      "AI-генератор Shorts для авторов и команд: создавайте короткие видео из темы со сценарием, озвучкой, субтитрами, визуалом и CTA.",
    h1: "AI-генератор Shorts",
    lead:
      "Используйте AI, чтобы быстрее превращать идеи в короткие видео: генерация структуры, голоса, субтитров и визуального ритма перед публикацией.",
    ctaSource: "seo_ru_ai_generator_shorts",
    useCases: ["Тестировать больше хуков за неделю", "Превращать экспертные идеи в Shorts", "Создавать простые продуктовые, обучающие и storytelling-ролики"],
    workflow: ["Начните с конкретной идеи", "Сгенерируйте первую версию", "Усильте первые секунды", "Опубликуйте чистый тест и сравните удержание"],
    differentiators: [
      "Скорость без потери структуры: проблема, обещание и следующий шаг остаются видимыми.",
      "Помогает убрать задержку чистого листа, когда нужен новый ролик сегодня.",
      "Лучше всего работает как серия, а не как один случайный ролик.",
    ],
    related: [
      ["../generator-youtube-shorts/", "генератор YouTube Shorts"],
      ["../neyroset-dlya-shorts/", "нейросеть для Shorts"],
      ["../kak-testirovat-shorts/", "как тестировать Shorts"],
      ["../examples/", "примеры Shorts"],
    ],
    faq: [
      ["Можно ли создать Shorts из одного промпта?", "Да, но лучший результат получается из конкретной темы, аудитории и обещания, а не из общего запроса."],
      ["Что проверить перед публикацией?", "Проверьте первый кадр, первую фразу, читаемость субтитров, темп и соответствие CTA интенту зрителя."],
      ["Подходит ли это для бизнеса?", "Да. Начните с проблемы клиента, затем покажите решение и один понятный следующий шаг."],
    ],
  },
  {
    slug: "generator-shorts-bez-lica",
    enSlug: "faceless-youtube-shorts-generator",
    targetQuery: "генератор shorts без лица",
    title: "Генератор Shorts без лица: видео без съемки на камеру",
    description:
      "Создавайте Shorts без лица с AI: сценарий, озвучка, субтитры и визуальная структура для авторов, которые не хотят сниматься.",
    h1: "Генератор Shorts без лица",
    lead:
      "Создавайте Shorts без появления в кадре. AdShorts AI превращает тему в вертикальное видео с голосом, субтитрами, фоном и понятной структурой удержания.",
    ctaSource: "seo_ru_generator_shorts_bez_lica",
    useCases: ["Нишевые каналы без съемки лица", "Обучающие объяснения", "Продуктовые и сервисные видео, где важнее идея, чем ведущий"],
    workflow: ["Выберите faceless-формат", "Сгенерируйте сценарий и голос", "Добавьте читаемые субтитры", "Покажите прогресс, чтобы зритель досмотрел"],
    differentiators: [
      "Страница и workflow заточены под ясность, потому что faceless-роликам особенно важны текст и прогресс.",
      "Подходит для скринкастов, фактов, сравнений, мини-гайдов и списков.",
      "Убирает блокер камеры, света и уверенности перед съемкой.",
    ],
    related: [
      ["../shorts-bez-lica/", "форматы Shorts без лица"],
      ["../kak-sdelat-tekst-na-video-dlya-shorts/", "текст на видео"],
      ["../ozvuchka-dlya-shorts-kak-vybrat-golos/", "озвучка для Shorts"],
      ["../shorts-iz-foto/", "Shorts из фото"],
    ],
    faq: [
      ["Shorts без лица хуже набирают просмотры?", "Не обязательно. Важнее первые секунды, ясность, темп и обещанный результат, чем наличие лица в кадре."],
      ["С какого формата начать?", "Начните с мини-гайда, чек-листа, сравнения или before-after, потому что прогресс легко понять."],
      ["Можно ли вести весь канал без лица?", "Да, если строить повторяемую систему контента и улучшать форматы по данным удержания."],
    ],
  },
  {
    slug: "generator-scenariev-youtube-shorts",
    enSlug: "youtube-shorts-script-generator",
    targetQuery: "генератор сценариев youtube shorts",
    title: "Генератор сценариев YouTube Shorts: хуки, темп и CTA",
    description:
      "Генерируйте сценарии для YouTube Shorts: хуки, быстрый темп, идеи текста на экране и CTA перед созданием готового видео.",
    h1: "Генератор сценариев YouTube Shorts",
    lead:
      "Начните со сценария, когда идея понятна, но формулировки тормозят. Получите хук, короткую структуру, фразы для субтитров и естественный CTA.",
    ctaSource: "seo_ru_generator_scenariev_youtube_shorts",
    useCases: ["Авторы, которым нужны варианты хуков", "Бизнес, который превращает продуктовые тезисы в Shorts", "Монтажеры, которым нужен сильный черновик перед продакшеном"],
    workflow: ["Опишите тему и аудиторию", "Сгенерируйте несколько вариантов хука", "Выберите структуру на 20-40 секунд", "Превратите лучший сценарий в видео"],
    differentiators: [
      "Сценарий пишется под озвучку и субтитры, а не как обычный текст.",
      "CTA встроен мягко и не ломает удержание.",
      "Из одной идеи можно быстро получить несколько углов для теста.",
    ],
    related: [
      ["../kak-napisat-scenariy-dlya-shorts/", "как написать сценарий"],
      ["../kak-sdelat-huk-v-shorts/", "формулы хуков"],
      ["../cta-v-shorts/", "CTA в Shorts"],
      ["../zagolovok-dlya-shorts-kak-pisat/", "заголовок Shorts"],
    ],
    faq: [
      ["Чем сценарий Shorts отличается от обычного текста?", "Нужна быстрая первая фраза, понятный прогресс, короткие реплики и payoff до падения внимания."],
      ["Можно ли генерировать несколько версий?", "Да. Тестируйте разные хуки или CTA, оставляя основную идею стабильной."],
      ["Нужно ли добавлять хештеги в сценарий?", "Нет. Сценарий должен быть для зрителя. Ключи и хештеги добавляйте отдельно в заголовок или описание."],
    ],
  },
  {
    slug: "sozdat-shorts-video",
    enSlug: "shorts-video-maker",
    targetQuery: "создать shorts видео",
    title: "Создать Shorts-видео без ручного монтажа — AdShorts AI",
    description:
      "Создавайте Shorts-видео в формате 9:16 с AI-сценарием, субтитрами, озвучкой, музыкой и визуальным фоном без ручного монтажа.",
    h1: "Создать Shorts-видео",
    lead:
      "Создавайте вертикальные видео для Shorts, Reels и TikTok без ручной сборки каждого кадра. Начните с идеи и получите структурированный черновик.",
    ctaSource: "seo_ru_sozdat_shorts_video",
    useCases: ["Быстрые черновики для контент-плана", "Короткие обучающие ролики", "Объяснение оффера, продукта или услуги"],
    workflow: ["Выберите тему", "Сгенерируйте черновик видео", "Отредактируйте субтитры и голос", "Экспортируйте 9:16 ролик для теста"],
    differentiators: [
      "Объединяет сценарий, голос, субтитры и визуал, а не решает только одну часть продакшена.",
      "Держит видео коротким и структурированным, чтобы это не было просто слайд-шоу.",
      "Подходит командам, которым нужен повторяемый процесс, а не разовый шаблон.",
    ],
    related: [
      ["../kak-sdelat-shorts-bez-montazha/", "Shorts без монтажа"],
      ["../format-video-dlya-shorts/", "формат видео для Shorts"],
      ["../subtitry-dlya-shorts-avtomatom/", "автоматические субтитры"],
      ["../pricing/", "тарифы"],
    ],
    faq: [
      ["Это редактор или генератор?", "Скорее генератор с возможностью редактирования: AI создает черновик, а вы правите результат."],
      ["Можно ли использовать без съемки?", "Да. Используйте сгенерированный или загруженный визуал, озвучку и субтитры вместо полной съемки."],
      ["Что улучшать первым?", "Сначала улучшайте хук и читаемость субтитров, потому что они сильнее всего влияют на раннее удержание."],
    ],
  },
  {
    slug: "avtomatizaciya-youtube-shorts",
    enSlug: "youtube-shorts-automation",
    targetQuery: "автоматизация youtube shorts",
    title: "Автоматизация YouTube Shorts: повторяемый AI-workflow",
    description:
      "Автоматизация YouTube Shorts для авторов и команд: сценарии, озвучка, субтитры и черновики видео для регулярного тестирования форматов.",
    h1: "Автоматизация YouTube Shorts",
    lead:
      "Автоматизируйте повторяющиеся части продакшена Shorts, сохраняя ручной контроль над идеями, фактами и финальной правкой.",
    ctaSource: "seo_ru_avtomatizaciya_youtube_shorts",
    useCases: ["Публиковать регулярнее", "Собирать ролики пачками", "Превращать один контент-пиллар в серию тестов"],
    workflow: ["Соберите банк тем", "Сгенерируйте сценарии пачкой", "Создайте черновики видео", "Публикуйте, измеряйте удержание и повторяйте рабочие форматы"],
    differentiators: [
      "Фокус на устойчивом процессе, а не на массовой публикации слабых вариаций.",
      "Сохраняет этап проверки точности, бренда и фактов.",
      "Лучше всего работает с контент-пилларами и недельным планом тестов.",
    ],
    related: [
      ["../kontent-plan-dlya-shorts-na-mesyac/", "контент-план Shorts"],
      ["../kak-snimat-shorts-pachkoy/", "пакетный выпуск Shorts"],
      ["../kak-chasto-vykladyvat-shorts/", "частота публикаций"],
      ["../analitika-youtube-shorts-kak-chitat/", "аналитика Shorts"],
    ],
    faq: [
      ["Можно ли полностью автоматизировать Shorts?", "Можно автоматизировать продакшен-задачи, но стратегия, точность и финальная проверка должны оставаться за человеком."],
      ["Чего автоматизация не должна делать?", "Не стоит массово публиковать дубликаты или вводящие в заблуждение ролики. Это бьет по качеству и доверию."],
      ["С чего начать?", "Начните с генерации сценариев и черновиков по контент-плану, а затем публикуйте меньше, но чище."],
    ],
  },
  {
    slug: "generator-video-dlya-tiktok",
    enSlug: "tiktok-video-generator",
    targetQuery: "генератор видео для tiktok",
    title: "Генератор видео для TikTok: сценарий, голос и субтитры",
    description:
      "Создавайте TikTok-видео с AI-сценарием, озвучкой, субтитрами, музыкой и визуалом в workflow AdShorts AI для коротких видео.",
    h1: "Генератор видео для TikTok",
    lead:
      "Создавайте черновики вертикальных видео для TikTok из одной идеи, а затем адаптируйте хук, темп и CTA под аудиторию.",
    ctaSource: "seo_ru_generator_video_dlya_tiktok",
    useCases: ["Тестировать короткие продуктовые объяснения", "Превращать экспертные советы в вертикальные клипы", "Создавать faceless-форматы для TikTok"],
    workflow: ["Выберите TikTok-угол", "Сгенерируйте сценарий и голос", "Сделайте субтитры крупными и читаемыми", "Экспортируйте короткий 9:16 ролик"],
    differentiators: [
      "Workflow подходит также для вариантов под YouTube Shorts и Reels.",
      "Субтитры и темп в центре процесса, потому что многие смотрят без звука.",
      "Одну идею можно адаптировать под разные платформы.",
    ],
    related: [
      ["../generator-reels-instagram/", "генератор Reels"],
      ["../ai-generator-video-dlya-socsetey/", "AI-генератор видео для соцсетей"],
      ["../shorts-smotryat-bez-zvuka/", "ролики без звука"],
      ["../examples/", "примеры"],
    ],
    faq: [
      ["Можно ли использовать одно видео для TikTok и Shorts?", "Часто да, но хук, стиль субтитров и CTA лучше адаптировать под платформу."],
      ["С какой длины начинать?", "Начните с компактной версии, которая быстро дает смысл, и тестируйте длиннее только при хорошем удержании."],
      ["Публикует ли генератор в TikTok напрямую?", "Используйте его для создания и экспорта черновика; публикация зависит от вашего platform setup."],
    ],
  },
  {
    slug: "generator-reels-instagram",
    enSlug: "instagram-reels-generator",
    targetQuery: "генератор reels instagram",
    title: "Генератор Instagram Reels: короткие видео с AI",
    description:
      "Генерируйте черновики Instagram Reels с AI-сценарием, озвучкой, субтитрами, музыкой и вертикальным визуалом для бренда или оффера.",
    h1: "Генератор Instagram Reels",
    lead:
      "Превратите идею в Reels-ready черновик с понятным хуком, озвучкой, субтитрами и простой визуальной структурой.",
    ctaSource: "seo_ru_generator_reels_instagram",
    useCases: ["Услуги и малый бизнес", "Авторы, которые переупаковывают идеи под разные платформы", "Бренды, которые тестируют хуки и офферы"],
    workflow: ["Выберите аудиторию и обещание", "Сгенерируйте короткий сценарий", "Добавьте субтитры и визуал", "Проверьте CTA и публикуйте лучшую версию"],
    differentiators: [
      "Создает структурированный short-form черновик, а не только текст подписи.",
      "Подходит для обучающих, продуктовых, storytelling и offer-led Reels.",
      "Помогает продавать мягко, не ломая удержание с первых секунд.",
    ],
    related: [
      ["../generator-video-dlya-tiktok/", "генератор видео для TikTok"],
      ["../sozdat-shorts-video/", "создать Shorts-видео"],
      ["../kak-prodavat-cherez-shorts/", "продажи через короткие видео"],
      ["../shorts-dlya-biznesa/", "Shorts для бизнеса"],
    ],
    faq: [
      ["Можно ли делать Reels без съемки себя?", "Да. Используйте faceless-форматы с озвучкой, субтитрами, продуктовым визуалом, скриншотами или фоном."],
      ["Нужен ли CTA в каждом Reels?", "Не обязательно. Обучающие и доверительные ролики могут вести к мягкому следующему шагу."],
      ["Можно ли переиспользовать видео в Shorts?", "Да, но проверьте заголовок, описание и CTA, потому что механики поиска и рекомендаций отличаются."],
    ],
  },
  {
    slug: "ai-generator-video-dlya-socsetey",
    enSlug: "ai-video-generator-for-social-media",
    targetQuery: "ai генератор видео для соцсетей",
    title: "AI-генератор видео для соцсетей: Shorts, Reels и TikTok",
    description:
      "AI-генератор видео для соцсетей: создавайте короткие ролики для YouTube Shorts, Instagram Reels и TikTok из одной идеи.",
    h1: "AI-генератор видео для соцсетей",
    lead:
      "Создавайте short-form черновики из одной идеи, затем адаптируйте хук, субтитры и CTA под Shorts, Reels или TikTok.",
    ctaSource: "seo_ru_ai_generator_video_dlya_socsetey",
    useCases: ["Малые команды, которым нужно больше креативных тестов", "Фаундеры, которые объясняют продукт через видео", "Агентства, которые готовят черновики для клиентов"],
    workflow: ["Определите контент-пиллар", "Сгенерируйте short-form черновик", "Адаптируйте начало под платформу", "Отслеживайте удержание, клики и заявки"],
    differentiators: [
      "Фокус на структуре коротких видео, а не на универсальной генерации ради генерации.",
      "Объединяет стратегию, сценарий, голос и субтитры в одном процессе.",
      "Помогает строить повторяемую систему тестов для органического трафика.",
    ],
    related: [
      ["../generator-youtube-shorts/", "генератор YouTube Shorts"],
      ["../generator-video-dlya-tiktok/", "генератор TikTok-видео"],
      ["../generator-reels-instagram/", "генератор Reels"],
      ["../shorts-dlya-biznesa/", "короткие видео для бизнеса"],
    ],
    faq: [
      ["Для каких платформ можно создавать видео?", "Workflow подходит для вертикальных коротких видео: YouTube Shorts, Instagram Reels и TikTok."],
      ["Это помогает органическому трафику?", "Да, если публиковать регулярные тесты вокруг проблем, use cases и офферов, которые люди уже ищут."],
      ["Сколько видео делать?", "Начните с небольшой пачки вокруг одного кластера, измерьте сигналы и масштабируйте форматы, которые удерживают зрителя."],
    ],
  },
];

const enBuyerGuidePages = [
  {
    slug: "best-ai-shorts-generator",
    ruSlug: "luchshiy-ai-generator-shorts",
    targetQuery: "best ai shorts generator",
    title: "Best AI Shorts Generator: What to Check Before Choosing",
    description:
      "How to choose the best AI Shorts generator for your workflow: scripts, voiceover, subtitles, editing control, speed and repeatable output.",
    h1: "Best AI Shorts Generator",
    lead:
      "The best AI Shorts generator is the one that turns ideas into repeatable, editable short-form videos without hiding the parts that affect retention.",
    ctaSource: "seo_en_best_ai_shorts_generator",
    useCases: ["Creators choosing a repeatable production workflow", "Small teams comparing content tools by practical output", "Founders who need Shorts without hiring an editor first"],
    workflow: ["Check the script and hook quality", "Review voiceover and subtitle control", "Test how easy edits are after generation", "Compare whether output can become a weekly series"],
    differentiators: [
      "AdShorts AI combines script, voice, subtitles and visuals in one workflow.",
      "The generated draft stays editable, so you can improve the hook, CTA and pacing.",
      "It is designed for recurring Shorts production rather than a one-off demo.",
    ],
    related: [
      ["../ai-shorts-generator/", "AI Shorts generator"],
      ["../youtube-shorts-generator/", "YouTube Shorts generator"],
      ["../how-to-choose-an-ai-shorts-generator/", "how to choose a generator"],
      ["../pricing/", "AdShorts AI pricing"],
    ],
    faq: [
      ["What should the best AI Shorts generator include?", "At minimum it should help with script, hook, voiceover, subtitles, visuals and simple editing after the first draft."],
      ["Is speed the only thing that matters?", "No. Speed helps, but repeatable quality, editable output and retention-focused structure matter more for organic growth."],
      ["How should I test a generator?", "Create several videos around the same topic cluster, then compare retention, first-frame clarity and whether production becomes easier."],
    ],
  },
  {
    slug: "best-faceless-youtube-shorts-generator",
    ruSlug: "luchshiy-generator-shorts-bez-lica",
    targetQuery: "best faceless youtube shorts generator",
    title: "Best Faceless YouTube Shorts Generator: No-Camera Checklist",
    description:
      "Choose a faceless YouTube Shorts generator by checking scripts, voiceover, captions, visual rhythm, format consistency and editing control.",
    h1: "Best Faceless YouTube Shorts Generator",
    lead:
      "A strong faceless Shorts workflow replaces camera recording with clear narration, readable subtitles and visual progress that keeps the viewer oriented.",
    ctaSource: "seo_en_best_faceless_youtube_shorts_generator",
    useCases: ["Faceless niche channels", "Educational clips without on-camera recording", "Business videos where the idea matters more than the presenter"],
    workflow: ["Pick a topic that works without a face", "Generate a voice-led structure", "Use subtitles and visual progress", "Edit the first seconds before publishing"],
    differentiators: [
      "AdShorts AI supports faceless videos with voiceover, subtitles and background visuals.",
      "The workflow is useful for repeatable formats: facts, mini-guides, checklists and explainers.",
      "Editable output helps avoid static slideshow videos with no progression.",
    ],
    related: [
      ["../faceless-youtube-shorts-generator/", "faceless Shorts generator"],
      ["../faceless-youtube-shorts/", "faceless Shorts formats"],
      ["../youtube-shorts-from-photos/", "Shorts from photos"],
      ["../voiceover-for-shorts-how-to-choose-a-voice/", "voiceover for Shorts"],
    ],
    faq: [
      ["Can faceless Shorts work without a presenter?", "Yes, if the video has a clear hook, useful narration, readable captions and visual progress."],
      ["What should I avoid?", "Avoid long static slides, tiny text and generic background loops that do not help the viewer follow the idea."],
      ["What format should I test first?", "Start with mini-guides, numbered lists, before-after explanations or simple product walkthroughs."],
    ],
  },
  {
    slug: "how-to-choose-an-ai-shorts-generator",
    ruSlug: "kak-vybrat-ai-generator-shorts",
    targetQuery: "how to choose an ai shorts generator",
    title: "How to Choose an AI Shorts Generator: 9 Practical Checks",
    description:
      "How to choose an AI Shorts generator: evaluate script quality, captions, voice, visuals, editing control, publishing workflow and cost per test.",
    h1: "How to Choose an AI Shorts Generator",
    lead:
      "Choose an AI Shorts generator by testing the whole workflow, not a single impressive sample. The result should be fast, editable and usable for a content system.",
    ctaSource: "seo_en_how_to_choose_ai_shorts_generator",
    useCases: ["Teams comparing tools before a content sprint", "Creators who need consistent output quality", "Businesses trying short-form video for lead generation"],
    workflow: ["Define one topic cluster", "Generate three video drafts", "Edit hook, captions and CTA", "Measure time saved and publishing readiness"],
    differentiators: [
      "AdShorts AI keeps the production parts connected instead of splitting script, voice and video into separate tasks.",
      "The workflow makes it easier to test several hooks without starting over each time.",
      "Commercial pages, examples and pricing are linked so evaluation can happen in one place.",
    ],
    related: [
      ["../best-ai-shorts-generator/", "best AI Shorts generator checklist"],
      ["../youtube-shorts-script-generator/", "Shorts script generator"],
      ["../shorts-video-maker/", "Shorts video maker"],
      ["../examples/", "Shorts examples"],
    ],
    faq: [
      ["What is the most important check?", "Editable output. If you cannot adjust hook, subtitles, pacing and CTA, the first draft becomes a bottleneck."],
      ["Should I compare only video quality?", "No. Also compare speed, consistency, caption readability, voice quality and whether the workflow supports a series."],
      ["How many tests are enough?", "Three to five drafts around one topic cluster usually reveal whether the workflow is practical."],
    ],
  },
  {
    slug: "ai-shorts-generator-for-small-business",
    ruSlug: "ai-generator-shorts-dlya-malogo-biznesa",
    targetQuery: "ai shorts generator for small business",
    title: "AI Shorts Generator for Small Business: Faster Video Tests",
    description:
      "AI Shorts generator for small business: turn offers, FAQs and customer problems into short videos with script, voiceover, subtitles and CTA.",
    h1: "AI Shorts Generator for Small Business",
    lead:
      "Small businesses need short videos that explain one problem, one proof point and one next action without creating a full production process every time.",
    ctaSource: "seo_en_ai_shorts_generator_small_business",
    useCases: ["Local services testing offers", "Online stores explaining products", "Founders turning FAQs into short videos"],
    workflow: ["Choose one customer problem", "Generate a short script and video draft", "Add a clear CTA", "Publish and compare clicks or inquiries"],
    differentiators: [
      "AdShorts AI helps turn product knowledge into repeatable short-form content.",
      "The workflow is faster than briefing a new video from scratch for every idea.",
      "It supports simple educational, product and offer-led formats.",
    ],
    related: [
      ["../youtube-shorts-for-business/", "YouTube Shorts for business"],
      ["../how-to-sell-with-youtube-shorts/", "how to sell with Shorts"],
      ["../shorts-video-maker/", "Shorts video maker"],
      ["../pricing/", "pricing"],
    ],
    faq: [
      ["What should a small business publish first?", "Start with customer questions, simple myths, before-after explanations and one offer-focused video."],
      ["Do I need a big content team?", "No. A repeatable AI workflow can cover scripts, drafts, subtitles and simple visual structure."],
      ["What should I measure?", "Measure profile clicks, website clicks, inquiries and whether videos are getting watched past the first seconds."],
    ],
  },
  {
    slug: "ai-shorts-generator-for-youtube-creators",
    ruSlug: "ai-generator-shorts-dlya-avtorov-youtube",
    targetQuery: "ai shorts generator for youtube creators",
    title: "AI Shorts Generator for YouTube Creators: Build More Tests",
    description:
      "AI Shorts generator for YouTube creators: create more hook, script and video variants while keeping subtitles, voiceover and pacing editable.",
    h1: "AI Shorts Generator for YouTube Creators",
    lead:
      "Creators grow faster when they can test more ideas without lowering quality. Use AI to build drafts, then make the creative decision yourself.",
    ctaSource: "seo_en_ai_shorts_generator_youtube_creators",
    useCases: ["Creators testing several hooks per topic", "Channels turning long videos into Shorts ideas", "Faceless or voice-led YouTube channels"],
    workflow: ["Pick a proven topic or long-form segment", "Generate several Shorts angles", "Edit the strongest first seconds", "Publish and compare retention"],
    differentiators: [
      "AdShorts AI helps create repeatable drafts without removing creator control.",
      "The output is suited for retention testing, not only quick visual generation.",
      "It connects production with guides on hooks, retention and Shorts analytics.",
    ],
    related: [
      ["../youtube-shorts-generator/", "YouTube Shorts generator"],
      ["../how-to-create-a-hook-in-shorts/", "how to create a hook"],
      ["../how-to-analyze-retention-in-shorts/", "analyze Shorts retention"],
      ["../youtube-shorts-analytics-how-to-read/", "Shorts analytics"],
    ],
    faq: [
      ["Will AI replace creator judgment?", "No. It speeds up drafts, but the creator should still choose the angle, verify claims and edit the hook."],
      ["What content works best?", "Strong topics with a clear viewer promise: one problem, one payoff and one reason to keep watching."],
      ["Can it help with faceless channels?", "Yes. Use voiceover, subtitles and background visuals instead of on-camera recording."],
    ],
  },
  {
    slug: "ai-video-maker-for-reels-tiktok-and-shorts",
    ruSlug: "ai-video-maker-dlya-reels-tiktok-i-shorts",
    targetQuery: "ai video maker for reels tiktok shorts",
    title: "AI Video Maker for Reels, TikTok and Shorts",
    description:
      "AI video maker for Reels, TikTok and Shorts: create vertical videos with script, voiceover, subtitles, visuals and platform-ready structure.",
    h1: "AI Video Maker for Reels, TikTok and Shorts",
    lead:
      "One vertical video workflow can support multiple short-form platforms when the idea, hook, subtitles and CTA are easy to adapt.",
    ctaSource: "seo_en_ai_video_maker_reels_tiktok_shorts",
    useCases: ["Teams repurposing one idea across platforms", "Creators building a short-form content calendar", "Businesses testing vertical video offers"],
    workflow: ["Start with a platform-neutral idea", "Generate a vertical draft", "Adjust hook and CTA for each channel", "Track which angle performs best"],
    differentiators: [
      "AdShorts AI focuses on 9:16 short-form production from the first prompt.",
      "Script, voice, subtitles and visuals are generated together for faster testing.",
      "The same draft can be adapted instead of rebuilding each platform version from scratch.",
    ],
    related: [
      ["../shorts-video-maker/", "Shorts video maker"],
      ["../tiktok-video-generator/", "TikTok video generator"],
      ["../instagram-reels-generator/", "Instagram Reels generator"],
      ["../ai-video-generator-for-social-media/", "AI video generator for social media"],
    ],
    faq: [
      ["Can one video work everywhere?", "Sometimes, but the hook, caption and CTA usually need small changes for each platform."],
      ["What format should I export?", "Use a clean vertical 9:16 video with readable subtitles and safe margins for platform UI."],
      ["What should I test first?", "Test the first line and first frame because they influence whether viewers stay long enough to see the message."],
    ],
  },
  {
    slug: "faceless-video-generator-for-youtube-shorts",
    ruSlug: "generator-video-bez-lica-dlya-youtube-shorts",
    targetQuery: "faceless video generator for youtube shorts",
    title: "Faceless Video Generator for YouTube Shorts",
    description:
      "Faceless video generator for YouTube Shorts: create voice-led videos with subtitles, background visuals, structure and editable drafts.",
    h1: "Faceless Video Generator for YouTube Shorts",
    lead:
      "Make Shorts without filming yourself by combining a clear script, voiceover, captions and visuals that show progress from the first seconds.",
    ctaSource: "seo_en_faceless_video_generator_youtube_shorts",
    useCases: ["Faceless educational channels", "Topic explainers without camera recording", "Businesses that need simple voice-led Shorts"],
    workflow: ["Write one clear topic", "Generate script, voice and visual draft", "Make subtitles readable", "Publish one version and measure retention"],
    differentiators: [
      "AdShorts AI makes faceless video production faster without relying on empty background loops.",
      "The draft can be edited before publishing, which is critical for pacing and clarity.",
      "It pairs well with guides on subtitles, voiceover and Shorts from photos.",
    ],
    related: [
      ["../faceless-youtube-shorts-generator/", "faceless YouTube Shorts generator"],
      ["../automatic-subtitles-for-youtube-shorts/", "automatic subtitles"],
      ["../youtube-shorts-from-photos/", "Shorts from photos"],
      ["../background-for-youtube-shorts/", "background for Shorts"],
    ],
    faq: [
      ["What makes a faceless video work?", "A specific topic, clear narration, readable subtitles and visuals that move the idea forward."],
      ["Can I use photos?", "Yes. Photos work best when they are paced like a story or checklist, not left as a slow slideshow."],
      ["Should every faceless Short have voiceover?", "Usually yes, because voiceover gives pace and context while captions support silent viewing."],
    ],
  },
];

const ruBuyerGuidePages = [
  {
    slug: "luchshiy-ai-generator-shorts",
    enSlug: "best-ai-shorts-generator",
    targetQuery: "лучший ai генератор shorts",
    title: "Лучший AI-генератор Shorts: что проверить перед выбором",
    description:
      "Как выбрать лучший AI-генератор Shorts: сценарий, озвучка, субтитры, визуал, редактирование, скорость и повторяемый результат.",
    h1: "Лучший AI-генератор Shorts",
    lead:
      "Лучший AI-генератор Shorts помогает не только быстро создать ролик, но и повторять workflow: идея, хук, голос, субтитры, визуал и правки.",
    ctaSource: "seo_ru_luchshiy_ai_generator_shorts",
    useCases: ["Авторы, которым нужна регулярная публикация", "Команды, выбирающие практичный video workflow", "Фаундеры, которые хотят тестировать идеи без отдельного монтажа"],
    workflow: ["Проверьте качество сценария и хука", "Оцените озвучку и субтитры", "Посмотрите, насколько легко править черновик", "Сравните, получится ли делать серию роликов"],
    differentiators: [
      "AdShorts AI объединяет сценарий, голос, субтитры и визуал в одном процессе.",
      "Черновик можно доработать, а не принимать первый результат как финальный.",
      "Workflow подходит для регулярного производства Shorts, а не только для одного теста.",
    ],
    related: [
      ["../ai-generator-shorts/", "AI-генератор Shorts"],
      ["../generator-youtube-shorts/", "генератор YouTube Shorts"],
      ["../kak-vybrat-ai-generator-shorts/", "как выбрать AI-генератор"],
      ["../pricing/", "тарифы"],
    ],
    faq: [
      ["Что должен уметь хороший AI-генератор Shorts?", "Минимум: помогать со сценарием, хуком, озвучкой, субтитрами, визуалом и правками после генерации."],
      ["Достаточно ли быстрой генерации?", "Нет. Для органического роста важнее повторяемое качество, редактируемый результат и структура, которая держит внимание."],
      ["Как протестировать инструмент?", "Сделайте несколько роликов вокруг одного кластера тем и сравните удержание, первый кадр и скорость подготовки."],
    ],
  },
  {
    slug: "luchshiy-generator-shorts-bez-lica",
    enSlug: "best-faceless-youtube-shorts-generator",
    targetQuery: "лучший генератор shorts без лица",
    title: "Лучший генератор Shorts без лица: чеклист выбора",
    description:
      "Как выбрать генератор Shorts без лица: сценарии, озвучка, субтитры, визуальный темп, единый формат и контроль правок.",
    h1: "Лучший генератор Shorts без лица",
    lead:
      "Сильный faceless workflow заменяет съемку на понятную озвучку, крупные субтитры и визуальный прогресс, который удерживает внимание.",
    ctaSource: "seo_ru_luchshiy_generator_shorts_bez_lica",
    useCases: ["Faceless-каналы", "Обучающие ролики без съемки себя", "Бизнес-видео, где важнее идея, а не ведущий"],
    workflow: ["Выберите тему, которая работает без лица", "Сгенерируйте структуру с голосом", "Добавьте читаемые субтитры", "Доработайте первые секунды перед публикацией"],
    differentiators: [
      "AdShorts AI поддерживает faceless-видео с озвучкой, субтитрами и визуальным фоном.",
      "Workflow подходит для фактов, мини-гайдов, чеклистов и объяснений.",
      "Редактируемый черновик помогает избежать статичного слайдшоу без развития.",
    ],
    related: [
      ["../generator-shorts-bez-lica/", "генератор Shorts без лица"],
      ["../shorts-bez-lica/", "форматы Shorts без лица"],
      ["../shorts-iz-foto/", "Shorts из фото"],
      ["../ozvuchka-dlya-shorts-kak-vybrat-golos/", "озвучка для Shorts"],
    ],
    faq: [
      ["Могут ли Shorts без лица работать?", "Да, если есть сильный хук, полезная озвучка, читаемые субтитры и визуальный прогресс."],
      ["Чего избегать?", "Длинных статичных слайдов, мелкого текста и фона, который не помогает понять идею."],
      ["С какого формата начать?", "С мини-гайдов, списков, объяснений до/после или простого product walkthrough."],
    ],
  },
  {
    slug: "kak-vybrat-ai-generator-shorts",
    enSlug: "how-to-choose-an-ai-shorts-generator",
    targetQuery: "как выбрать ai генератор shorts",
    title: "Как выбрать AI-генератор Shorts: 9 практических проверок",
    description:
      "Как выбрать AI-генератор Shorts: проверьте сценарий, субтитры, голос, визуал, редактирование, workflow публикации и цену одного теста.",
    h1: "Как выбрать AI-генератор Shorts",
    lead:
      "Выбирайте AI-генератор Shorts по полному workflow, а не по одному красивому примеру. Результат должен быть быстрым, редактируемым и пригодным для серии.",
    ctaSource: "seo_ru_kak_vybrat_ai_generator_shorts",
    useCases: ["Команды перед контент-спринтом", "Авторы, которым нужна стабильность качества", "Бизнес, который тестирует короткие видео для заявок"],
    workflow: ["Определите один кластер тем", "Сгенерируйте три черновика", "Отредактируйте хук, субтитры и CTA", "Сравните экономию времени и готовность к публикации"],
    differentiators: [
      "AdShorts AI соединяет сценарий, голос и видео, а не разносит их по отдельным задачам.",
      "Проще тестировать несколько хуков без полного пересоздания ролика.",
      "Примеры, тарифы и гайды связаны в одну систему оценки.",
    ],
    related: [
      ["../luchshiy-ai-generator-shorts/", "лучший AI-генератор Shorts"],
      ["../generator-scenariev-youtube-shorts/", "генератор сценариев Shorts"],
      ["../sozdat-shorts-video/", "создать Shorts-видео"],
      ["../examples/", "примеры Shorts"],
    ],
    faq: [
      ["Самая важная проверка?", "Редактируемость результата. Если нельзя поправить хук, субтитры, темп и CTA, черновик становится узким местом."],
      ["Сравнивать только качество видео?", "Нет. Сравните скорость, стабильность, читаемость субтитров, голос и возможность делать серию."],
      ["Сколько тестов достаточно?", "Три-пять черновиков вокруг одного кластера тем обычно быстро показывают, подходит ли workflow."],
    ],
  },
  {
    slug: "ai-generator-shorts-dlya-malogo-biznesa",
    enSlug: "ai-shorts-generator-for-small-business",
    targetQuery: "ai генератор shorts для малого бизнеса",
    title: "AI-генератор Shorts для малого бизнеса: быстрые video-тесты",
    description:
      "AI-генератор Shorts для малого бизнеса: превращайте офферы, FAQ и боли клиентов в видео со сценарием, озвучкой, субтитрами и CTA.",
    h1: "AI-генератор Shorts для малого бизнеса",
    lead:
      "Малому бизнесу нужны короткие видео про одну проблему, один аргумент и один следующий шаг без запуска отдельного production-процесса каждый раз.",
    ctaSource: "seo_ru_ai_generator_shorts_malogo_biznesa",
    useCases: ["Локальные услуги и офферы", "Интернет-магазины и карточки продуктов", "Фаундеры, которые превращают FAQ в короткие видео"],
    workflow: ["Выберите одну проблему клиента", "Сгенерируйте сценарий и черновик видео", "Добавьте понятный CTA", "Опубликуйте и сравните клики или заявки"],
    differentiators: [
      "AdShorts AI помогает превращать продуктовые знания в регулярный short-form контент.",
      "Workflow быстрее, чем каждый раз заново брифовать ролик.",
      "Подходит для обучающих, продуктовых и offer-led форматов.",
    ],
    related: [
      ["../shorts-dlya-biznesa/", "Shorts для бизнеса"],
      ["../kak-prodavat-cherez-shorts/", "как продавать через Shorts"],
      ["../sozdat-shorts-video/", "создать Shorts-видео"],
      ["../pricing/", "тарифы"],
    ],
    faq: [
      ["Что бизнесу публиковать первым?", "Вопросы клиентов, мифы, объяснения до/после и один ролик с конкретным оффером."],
      ["Нужна ли большая команда?", "Нет. AI workflow может закрыть сценарии, черновики, субтитры и простую визуальную структуру."],
      ["Что измерять?", "Клики, заявки, переходы в профиль и удержание в первые секунды."],
    ],
  },
  {
    slug: "ai-generator-shorts-dlya-avtorov-youtube",
    enSlug: "ai-shorts-generator-for-youtube-creators",
    targetQuery: "ai генератор shorts для авторов youtube",
    title: "AI-генератор Shorts для авторов YouTube: больше тестов",
    description:
      "AI-генератор Shorts для авторов YouTube: создавайте больше вариантов хуков, сценариев и видео, сохраняя контроль над субтитрами и темпом.",
    h1: "AI-генератор Shorts для авторов YouTube",
    lead:
      "Авторы растут быстрее, когда могут тестировать больше идей без просадки качества. AI ускоряет черновики, а творческое решение остается за вами.",
    ctaSource: "seo_ru_ai_generator_shorts_avtorov_youtube",
    useCases: ["Авторы, тестирующие несколько хуков на одну тему", "Каналы, превращающие длинные видео в Shorts", "Faceless- и voice-led YouTube-каналы"],
    workflow: ["Выберите проверенную тему или фрагмент", "Сгенерируйте несколько углов подачи", "Доработайте первые секунды", "Опубликуйте и сравните удержание"],
    differentiators: [
      "AdShorts AI ускоряет черновики, не забирая у автора контроль.",
      "Результат подходит для retention-тестов, а не только для быстрой генерации визуала.",
      "Workflow связан с гайдами по хукам, удержанию и аналитике Shorts.",
    ],
    related: [
      ["../generator-youtube-shorts/", "генератор YouTube Shorts"],
      ["../kak-sdelat-huk-v-shorts/", "как сделать хук"],
      ["../kak-analizirovat-uderzhanie-v-shorts/", "анализ удержания"],
      ["../analitika-youtube-shorts-kak-chitat/", "аналитика Shorts"],
    ],
    faq: [
      ["AI заменяет автора?", "Нет. Он ускоряет черновики, но автор выбирает угол, проверяет факты и правит хук."],
      ["Какие темы подходят?", "Темы с понятным обещанием: одна проблема, один результат и причина досмотреть."],
      ["Подходит ли для faceless-каналов?", "Да. Используйте озвучку, субтитры и визуальный фон вместо съемки себя."],
    ],
  },
  {
    slug: "ai-video-maker-dlya-reels-tiktok-i-shorts",
    enSlug: "ai-video-maker-for-reels-tiktok-and-shorts",
    targetQuery: "ai video maker для reels tiktok shorts",
    title: "AI video maker для Reels, TikTok и Shorts",
    description:
      "AI video maker для Reels, TikTok и Shorts: создавайте вертикальные видео со сценарием, озвучкой, субтитрами, визуалом и CTA.",
    h1: "AI video maker для Reels, TikTok и Shorts",
    lead:
      "Один vertical video workflow может поддерживать несколько short-form платформ, если идею, хук, субтитры и CTA легко адаптировать.",
    ctaSource: "seo_ru_ai_video_maker_reels_tiktok_shorts",
    useCases: ["Команды, адаптирующие одну идею под несколько платформ", "Авторы с short-form контент-планом", "Бизнес, тестирующий вертикальные видео"],
    workflow: ["Начните с идеи без привязки к платформе", "Сгенерируйте вертикальный черновик", "Адаптируйте хук и CTA", "Сравните, какой угол сработал лучше"],
    differentiators: [
      "AdShorts AI строит 9:16 short-form workflow с первого промпта.",
      "Сценарий, голос, субтитры и визуал создаются вместе для быстрых тестов.",
      "Черновик можно адаптировать, а не собирать каждую версию с нуля.",
    ],
    related: [
      ["../sozdat-shorts-video/", "создать Shorts-видео"],
      ["../generator-video-dlya-tiktok/", "генератор TikTok-видео"],
      ["../generator-reels-instagram/", "генератор Reels"],
      ["../ai-generator-video-dlya-socsetey/", "AI-генератор видео для соцсетей"],
    ],
    faq: [
      ["Один ролик подойдет везде?", "Иногда, но хук, подпись и CTA обычно лучше слегка адаптировать под платформу."],
      ["В каком формате экспортировать?", "Чистое вертикальное 9:16 видео с читаемыми субтитрами и безопасными полями под интерфейс платформы."],
      ["Что тестировать первым?", "Первую фразу и первый кадр: они сильнее всего влияют на досмотр до основной идеи."],
    ],
  },
  {
    slug: "generator-video-bez-lica-dlya-youtube-shorts",
    enSlug: "faceless-video-generator-for-youtube-shorts",
    targetQuery: "генератор видео без лица для youtube shorts",
    title: "Генератор видео без лица для YouTube Shorts",
    description:
      "Генератор видео без лица для YouTube Shorts: создавайте ролики с озвучкой, субтитрами, визуальным фоном, структурой и правками.",
    h1: "Генератор видео без лица для YouTube Shorts",
    lead:
      "Создавайте Shorts без съемки себя: понятный сценарий, озвучка, субтитры и визуал, который показывает прогресс с первых секунд.",
    ctaSource: "seo_ru_generator_video_bez_lica_youtube_shorts",
    useCases: ["Faceless-обучающие каналы", "Объяснения тем без камеры", "Бизнесу нужны простые voice-led Shorts"],
    workflow: ["Напишите одну конкретную тему", "Сгенерируйте сценарий, голос и видео", "Сделайте субтитры читаемыми", "Опубликуйте версию и измерьте удержание"],
    differentiators: [
      "AdShorts AI ускоряет faceless production без пустых фоновых лупов.",
      "Черновик можно редактировать до публикации, что важно для темпа и ясности.",
      "Workflow хорошо сочетается с гайдами по субтитрам, озвучке и Shorts из фото.",
    ],
    related: [
      ["../generator-shorts-bez-lica/", "генератор Shorts без лица"],
      ["../subtitry-dlya-shorts-avtomatom/", "автоматические субтитры"],
      ["../shorts-iz-foto/", "Shorts из фото"],
      ["../fon-dlya-shorts/", "фон для Shorts"],
    ],
    faq: [
      ["Что делает faceless-видео сильным?", "Конкретная тема, понятная озвучка, читаемые субтитры и визуал, который двигает идею вперед."],
      ["Можно использовать фото?", "Да. Фото работают лучше, если они собраны как история или чеклист, а не медленное слайдшоу."],
      ["Нужна ли озвучка?", "Обычно да: голос задает темп и контекст, а субтитры помогают смотреть без звука."],
    ],
  },
];

const enYandexExpansionPages = [
  {
    slug: "ai-tool-for-creating-shorts",
    ruSlug: "neyroset-dlya-sozdaniya-shorts",
    targetQuery: "ai tool for creating shorts",
    title: "AI Tool for Creating Shorts: Script, Voice and Subtitles",
    description:
      "AI tool for creating Shorts from one idea: generate a script, voiceover, subtitles, visual rhythm and CTA-ready vertical video draft.",
    h1: "AI Tool for Creating Shorts",
    lead:
      "Use one AI workflow to turn a topic, offer or FAQ into a short vertical video draft with script, voice, subtitles and a clear first frame.",
    ctaSource: "seo_en_ai_tool_for_creating_shorts",
    useCases: ["Creators producing repeatable Shorts", "Businesses turning FAQs into video", "Teams testing hooks without manual editing"],
    workflow: ["Enter one topic or offer", "Generate the short script and voiceover", "Review subtitles and first frame", "Export one clean 9:16 test"],
    differentiators: [
      "The workflow connects script, voice and visual pacing instead of generating only text.",
      "It is built for repeatable organic tests, not one isolated demo video.",
      "Editable drafts help improve hooks, subtitles and CTA before publishing.",
    ],
    related: [
      ["../shorts-creation-service/", "Shorts creation service"],
      ["../automatic-shorts-creation/", "automatic Shorts creation"],
      ["../ai-shorts-generator/", "AI Shorts generator"],
      ["../shorts-video-maker/", "Shorts video maker"],
    ],
    faq: [
      ["What should I give the AI first?", "Start with one audience, one problem and one promised result. Specific input creates a stronger first draft."],
      ["Can this replace manual editing?", "It can remove much of the repetitive work, but you should still review the hook, claims and CTA."],
      ["What should I test first?", "Test the first frame and first sentence because they decide whether people keep watching."],
    ],
  },
  {
    slug: "shorts-creation-service",
    ruSlug: "servis-dlya-sozdaniya-shorts",
    targetQuery: "shorts creation service",
    title: "Shorts Creation Service: AI Workflow for Vertical Videos",
    description:
      "Shorts creation service for creators and businesses: create vertical video drafts with AI script, voiceover, subtitles, visuals and CTA.",
    h1: "Shorts Creation Service",
    lead:
      "Create Shorts without starting a production task from scratch every time. The service turns one idea into a structured draft you can edit and publish.",
    ctaSource: "seo_en_shorts_creation_service",
    useCases: ["Small businesses testing offers", "Creators building a weekly Shorts system", "Agencies preparing short-form drafts"],
    workflow: ["Choose a content angle", "Generate the draft", "Edit hook and subtitles", "Publish and measure retention"],
    differentiators: [
      "Designed around a complete short-form workflow, not a single disconnected AI feature.",
      "Useful for repeatable videos where format consistency matters.",
      "Connects creation pages with examples, pricing and practical Shorts guides.",
    ],
    related: [
      ["../ai-tool-for-creating-shorts/", "AI tool for creating Shorts"],
      ["../shorts-video-maker/", "Shorts video maker"],
      ["../youtube-shorts-generator/", "YouTube Shorts generator"],
      ["../pricing/", "pricing"],
    ],
    faq: [
      ["Who is this service for?", "It is for teams and creators who need a faster repeatable way to create short vertical videos."],
      ["Is it a done-for-you agency?", "No. It is a self-serve AI workflow where you create and edit the draft yourself."],
      ["What result should I expect?", "A publishable draft that still benefits from a quick human check before posting."],
    ],
  },
  {
    slug: "automatic-shorts-creation",
    ruSlug: "avtomaticheskoe-sozdanie-shorts",
    targetQuery: "automatic shorts creation",
    title: "Automatic Shorts Creation: Repeatable AI Video Workflow",
    description:
      "Automatic Shorts creation with AI: generate scripts, voiceover, subtitles and vertical video drafts for regular organic content tests.",
    h1: "Automatic Shorts Creation",
    lead:
      "Automate the repetitive parts of Shorts production while keeping strategy, facts and final review under your control.",
    ctaSource: "seo_en_automatic_shorts_creation",
    useCases: ["Content teams building a publishing rhythm", "Founders turning product knowledge into videos", "Faceless channels creating voice-led Shorts"],
    workflow: ["Build a topic queue", "Generate scripts and drafts", "Review the first seconds", "Publish, measure and reuse winning formats"],
    differentiators: [
      "Automation is focused on quality signals: hook, pacing, subtitles and clear next step.",
      "The process helps avoid random one-off videos and supports content clusters.",
      "Every draft remains editable so automation does not remove control.",
    ],
    related: [
      ["../youtube-shorts-automation/", "YouTube Shorts automation"],
      ["../shorts-creation-service/", "Shorts creation service"],
      ["../bulk-shorts-creation/", "bulk Shorts creation"],
      ["../youtube-shorts-content-plan-for-a-month/", "Shorts content plan"],
    ],
    faq: [
      ["Can Shorts be created automatically?", "Production steps can be automated, but final review and topic strategy should stay human."],
      ["What should not be automated?", "Do not automate duplicate spam, misleading claims or low-quality mass publishing."],
      ["How do I scale safely?", "Scale one topic cluster at a time and keep measuring retention, clicks and conversions."],
    ],
  },
  {
    slug: "shorts-production-service-or-ai",
    ruSlug: "sozdanie-shorts-na-zakaz-ili-ai",
    targetQuery: "shorts production service or ai",
    title: "Shorts Production Service or AI: What to Choose",
    description:
      "Compare a Shorts production service with an AI workflow: speed, cost per test, editing control, repeatability and when each option makes sense.",
    h1: "Shorts Production Service or AI",
    lead:
      "If you need short videos every week, the main question is not only quality. Compare speed, control and the cost of testing many angles.",
    ctaSource: "seo_en_shorts_production_service_or_ai",
    useCases: ["Teams choosing between hiring and self-serve creation", "Businesses testing short-form before scaling", "Creators who need more drafts per week"],
    workflow: ["Estimate how many videos you need", "Compare cost per publishable test", "Check who controls revisions", "Pick agency, AI or a hybrid workflow"],
    differentiators: [
      "AI is strongest when you need many structured tests quickly.",
      "A production service can be stronger for complex brand shoots and heavy creative direction.",
      "A hybrid workflow often works best: AI drafts plus human review and selected polishing.",
    ],
    related: [
      ["../shorts-creation-service/", "Shorts creation service"],
      ["../ai-shorts-editing/", "AI Shorts editing"],
      ["../shorts-for-sales/", "Shorts for sales"],
      ["../pricing/", "pricing"],
    ],
    faq: [
      ["Is AI always cheaper?", "Usually the cost per draft is lower, but the value depends on how much review and polishing you need."],
      ["When should I use a production service?", "Use one for complex brand shoots, testimonials or high-stakes campaigns with custom filming."],
      ["When is AI better?", "Use AI for regular educational, product, FAQ and faceless short-form tests."],
    ],
  },
  {
    slug: "shorts-for-sales",
    ruSlug: "shorts-dlya-prodazh",
    targetQuery: "shorts for sales",
    title: "Shorts for Sales: Short Videos That Explain an Offer",
    description:
      "Shorts for sales: create short videos that explain one customer problem, one offer, one proof point and one clear next step.",
    h1: "Shorts for Sales",
    lead:
      "Sales-focused Shorts work best when they sell one idea at a time: problem, proof, offer and the next action without a long pitch.",
    ctaSource: "seo_en_shorts_for_sales",
    useCases: ["Service businesses explaining offers", "Online stores showing product use cases", "Founders testing one value proposition per video"],
    workflow: ["Pick one buyer pain", "Write a short hook", "Show the practical result", "End with one CTA"],
    differentiators: [
      "AdShorts AI helps turn sales points into short videos without making every clip feel like an ad.",
      "The workflow keeps CTA and retention in balance.",
      "It supports series around objections, use cases, comparisons and FAQs.",
    ],
    related: [
      ["../youtube-shorts-for-business/", "Shorts for business"],
      ["../shorts-ad-video-maker/", "Shorts ad video maker"],
      ["../ai-shorts-generator-for-small-business/", "AI Shorts for small business"],
      ["../shorts-for-marketplaces/", "Shorts for marketplaces"],
    ],
    faq: [
      ["Should every sales Short have a hard CTA?", "No. Many sales Shorts work better with a soft next step if the video is educational."],
      ["What should I sell first?", "Sell one clear outcome or use case, not the whole product."],
      ["What should I measure?", "Measure clicks, inquiries and whether viewers stay long enough to reach the offer."],
    ],
  },
  {
    slug: "shorts-ad-video-maker",
    ruSlug: "video-dlya-reklamy-v-shorts",
    targetQuery: "shorts ad video maker",
    title: "Shorts Ad Video Maker: Create Fast Vertical Creative Tests",
    description:
      "Create Shorts-style ad video drafts with AI script, voiceover, subtitles, visuals and CTA for fast vertical creative testing.",
    h1: "Shorts Ad Video Maker",
    lead:
      "Use a short-form workflow to produce quick creative drafts for vertical ads, organic tests or offer validation before investing in heavy production.",
    ctaSource: "seo_en_shorts_ad_video_maker",
    useCases: ["Testing ad angles before production", "Creating offer-led vertical videos", "Repurposing organic winners into paid creatives"],
    workflow: ["Choose one offer angle", "Generate a short creative draft", "Edit the first frame and CTA", "Compare retention and clicks"],
    differentiators: [
      "Fast drafts help test messaging before spending on polished production.",
      "Subtitles, voice and visual rhythm are generated together.",
      "The same idea can become organic Shorts, Reels or a paid creative test.",
    ],
    related: [
      ["../shorts-for-sales/", "Shorts for sales"],
      ["../ai-video-generator-for-social-media/", "AI video for social media"],
      ["../shorts-production-service-or-ai/", "production service or AI"],
      ["../examples/", "examples"],
    ],
    faq: [
      ["Is this for paid ads only?", "No. Use it for organic validation first, then adapt winning messages into paid creatives."],
      ["What should the first version include?", "One hook, one customer problem, one proof point and one CTA."],
      ["Should I generate many variants?", "Yes, but vary one major element at a time so you can learn from the result."],
    ],
  },
  {
    slug: "ai-voiceover-for-shorts",
    ruSlug: "ai-ozvuchka-dlya-shorts",
    targetQuery: "ai voiceover for shorts",
    title: "AI Voiceover for Shorts: Generate Voice-Led Videos",
    description:
      "AI voiceover for Shorts: create voice-led vertical videos with script, subtitles, pacing and editable drafts for faceless or fast production.",
    h1: "AI Voiceover for Shorts",
    lead:
      "Voiceover can replace camera recording when the script, tempo and subtitles are clear. Generate a voice-led draft and edit the first seconds before publishing.",
    ctaSource: "seo_en_ai_voiceover_for_shorts",
    useCases: ["Faceless channels", "Creators without recording setup", "Businesses turning FAQs into narrated videos"],
    workflow: ["Write one short script", "Choose the voice and pace", "Add readable subtitles", "Check the intro and CTA"],
    differentiators: [
      "Voiceover is generated inside the video workflow, so subtitles and pacing stay aligned.",
      "Useful for frequent publishing when recording voice manually slows you down.",
      "Works with faceless, educational and product explainer formats.",
    ],
    related: [
      ["../voiceover-for-shorts-how-to-choose-a-voice/", "voiceover guide"],
      ["../automatic-subtitles-for-youtube-shorts/", "automatic subtitles"],
      ["../faceless-youtube-shorts-generator/", "faceless Shorts generator"],
      ["../ai-tool-for-creating-shorts/", "AI tool for Shorts"],
    ],
    faq: [
      ["Is AI voiceover good enough for Shorts?", "It can be, if the voice matches the format and the script is written for spoken pacing."],
      ["What should I adjust first?", "Adjust pace, pauses and subtitle line length before changing the whole script."],
      ["Can I use voiceover for business videos?", "Yes, especially for FAQs, product explainers and simple educational videos."],
    ],
  },
  {
    slug: "shorts-subtitle-generator",
    ruSlug: "generator-subtitrov-dlya-shorts",
    targetQuery: "shorts subtitle generator",
    title: "Shorts Subtitle Generator: Captions for Vertical Videos",
    description:
      "Shorts subtitle generator for vertical videos: create readable captions, voice-aligned timing and mobile-friendly text for better retention.",
    h1: "Shorts Subtitle Generator",
    lead:
      "Subtitles are not just accessibility. In Shorts they carry the idea when people watch silently and help viewers follow the pace.",
    ctaSource: "seo_en_shorts_subtitle_generator",
    useCases: ["Videos watched without sound", "Voice-led explainers", "Faceless Shorts with text-driven progress"],
    workflow: ["Generate or paste the script", "Create subtitles from the voice", "Shorten long lines", "Check safe margins on mobile"],
    differentiators: [
      "Subtitles are part of the short-form video draft, not a separate afterthought.",
      "Readable caption rhythm helps early retention.",
      "Works with AI voiceover, uploaded voice or script-led videos.",
    ],
    related: [
      ["../automatic-subtitles-for-youtube-shorts/", "automatic subtitles"],
      ["../on-screen-text-for-youtube-shorts/", "on-screen text"],
      ["../ai-voiceover-for-shorts/", "AI voiceover"],
      ["../shorts-video-maker/", "Shorts video maker"],
    ],
    faq: [
      ["How long should subtitle lines be?", "Keep them short enough to read on a phone without covering the main visual."],
      ["Do subtitles improve retention?", "They can, especially when viewers watch silently or the video has fast narration."],
      ["Should every word be shown?", "Not always. Sometimes clean key-phrase subtitles work better than dense word-for-word captions."],
    ],
  },
  {
    slug: "vertical-video-generator",
    ruSlug: "generator-vertikalnyh-video",
    targetQuery: "vertical video generator",
    title: "Vertical Video Generator for Shorts, Reels and TikTok",
    description:
      "Generate vertical videos for Shorts, Reels and TikTok with AI script, voiceover, subtitles, visual rhythm and 9:16 output.",
    h1: "Vertical Video Generator",
    lead:
      "Create 9:16 vertical videos from one idea and adapt the result for Shorts, Reels or TikTok without rebuilding the draft manually.",
    ctaSource: "seo_en_vertical_video_generator",
    useCases: ["Short-form content calendars", "Social media video tests", "Businesses creating vertical explainers"],
    workflow: ["Start with one idea", "Generate a 9:16 draft", "Edit subtitles and hook", "Export for the selected platform"],
    differentiators: [
      "Built specifically for vertical short-form instead of generic horizontal video.",
      "Supports script, voice, subtitles and visual rhythm in one flow.",
      "Helps create platform variants from a common draft.",
    ],
    related: [
      ["../shorts-video-maker/", "Shorts video maker"],
      ["../ai-video-maker-for-reels-tiktok-and-shorts/", "AI video maker"],
      ["../tiktok-video-generator/", "TikTok video generator"],
      ["../instagram-reels-generator/", "Reels generator"],
    ],
    faq: [
      ["What format does vertical video need?", "Use 9:16 with readable subtitles and safe margins for mobile UI."],
      ["Can one draft work across platforms?", "Yes, but adjust the first line, caption and CTA to the platform."],
      ["What should I check before export?", "Check the first frame, subtitle readability, audio balance and final CTA."],
    ],
  },
  {
    slug: "shorts-for-telegram-channel",
    ruSlug: "shorts-dlya-telegram-kanala",
    targetQuery: "shorts for telegram channel",
    title: "Shorts for Telegram Channel Growth: Drive Viewers to a Community",
    description:
      "Create Shorts that drive viewers to a Telegram channel: hooks, soft CTA, content bridge, subtitles and repeatable video ideas.",
    h1: "Shorts for Telegram Channel Growth",
    lead:
      "Shorts can warm up viewers before they join a Telegram channel, but the video must explain why the next step is useful now.",
    ctaSource: "seo_en_shorts_for_telegram_channel",
    useCases: ["Experts growing a Telegram community", "Founders moving viewers to updates", "Creators building a warmer audience outside YouTube"],
    workflow: ["Pick a useful preview idea", "Create a short answer or checklist", "Use a soft Telegram CTA", "Track clicks and retained viewers"],
    differentiators: [
      "AdShorts AI helps turn Telegram topics into short teaser videos.",
      "The CTA can be framed as a continuation rather than a hard promotion.",
      "Works best as a series around one audience problem.",
    ],
    related: [
      ["../how-to-drive-traffic-from-shorts-to-telegram/", "drive traffic to Telegram"],
      ["../shorts-for-experts/", "Shorts for experts"],
      ["../youtube-shorts-content-plan-for-a-month/", "content plan"],
      ["../cta-in-youtube-shorts/", "CTA in Shorts"],
    ],
    faq: [
      ["Should the CTA mention Telegram directly?", "Yes, but only after the video gives value and makes the continuation clear."],
      ["What content works best?", "Short checklists, mistakes, templates and previews of a deeper Telegram post."],
      ["What should I measure?", "Measure profile clicks, Telegram joins and retention before the CTA."],
    ],
  },
  {
    slug: "shorts-for-marketplaces",
    ruSlug: "shorts-dlya-marketplejsa",
    targetQuery: "shorts for marketplaces",
    title: "Shorts for Marketplaces: Product Videos Without Heavy Production",
    description:
      "Create Shorts for marketplace products: short demos, use cases, benefits, subtitles and product-led vertical video drafts with AI.",
    h1: "Shorts for Marketplaces",
    lead:
      "Marketplace products need short videos that show use, problem, benefit and proof quickly. One product can become many short-form angles.",
    ctaSource: "seo_en_shorts_for_marketplaces",
    useCases: ["Sellers explaining product benefits", "Brands testing product angles", "Teams creating product-led short videos"],
    workflow: ["Choose one product use case", "Generate a demo-style script", "Add subtitles and benefit text", "Export a vertical video test"],
    differentiators: [
      "Helps create product videos without planning a full shoot for every angle.",
      "Supports benefit-led, FAQ, unboxing and problem-solution formats.",
      "Useful for organic social and pre-testing creative ideas.",
    ],
    related: [
      ["../shorts-for-sales/", "Shorts for sales"],
      ["../shorts-ad-video-maker/", "ad video maker"],
      ["../ai-shorts-generator-for-small-business/", "AI Shorts for small business"],
      ["../vertical-video-generator/", "vertical video generator"],
    ],
    faq: [
      ["What product videos work best?", "Use case demos, problem-solution clips and short comparisons usually work better than generic product shots."],
      ["Do I need filming?", "Real product footage helps, but AI workflow can still structure the script, subtitles and draft."],
      ["How many angles should I test?", "Start with three: problem, benefit and objection."],
    ],
  },
  {
    slug: "shorts-for-experts",
    ruSlug: "shorts-dlya-eksperta",
    targetQuery: "shorts for experts",
    title: "Shorts for Experts: Turn Knowledge Into Short Videos",
    description:
      "Create Shorts for experts: convert advice, FAQs, mistakes and frameworks into short videos with AI script, voiceover and subtitles.",
    h1: "Shorts for Experts",
    lead:
      "Experts do not need viral tricks first. They need repeatable short videos that package one useful answer and build trust over time.",
    ctaSource: "seo_en_shorts_for_experts",
    useCases: ["Consultants explaining common mistakes", "Coaches turning frameworks into clips", "Specialists building trust with short answers"],
    workflow: ["Pick one client question", "Create a compact answer", "Add a practical example", "End with a soft next step"],
    differentiators: [
      "AdShorts AI helps turn expertise into a repeatable video format.",
      "Voiceover and subtitles make production faster when filming is a blocker.",
      "Works well for series: myths, mistakes, checklists and mini-cases.",
    ],
    related: [
      ["../shorts-for-telegram-channel/", "Shorts for Telegram"],
      ["../youtube-shorts-for-business/", "Shorts for business"],
      ["../ai-content-for-shorts/", "AI content for Shorts"],
      ["../how-to-create-a-hook-in-shorts/", "hooks"],
    ],
    faq: [
      ["What should an expert publish first?", "Start with frequent questions, mistakes and simple frameworks that clients already ask about."],
      ["Can experts use faceless Shorts?", "Yes, voice-led videos with subtitles can work well for educational content."],
      ["How do I avoid sounding too promotional?", "Teach one useful thing first, then use a soft CTA after the value is clear."],
    ],
  },
  {
    slug: "ai-content-for-shorts",
    ruSlug: "kontent-dlya-shorts-s-ai",
    targetQuery: "ai content for shorts",
    title: "AI Content for Shorts: Ideas, Scripts and Video Drafts",
    description:
      "Create AI content for Shorts: turn topics, FAQs and offers into video ideas, scripts, voiceover, subtitles and vertical drafts.",
    h1: "AI Content for Shorts",
    lead:
      "AI content for Shorts should not stop at idea generation. The useful workflow moves from topic to script to video draft to measurement.",
    ctaSource: "seo_en_ai_content_for_shorts",
    useCases: ["Creators building a content queue", "Businesses turning FAQs into posts", "Teams repurposing long ideas into short clips"],
    workflow: ["Create a topic cluster", "Generate video angles", "Build drafts from the best angles", "Measure and expand the winning theme"],
    differentiators: [
      "Connects content planning and video production in one short-form workflow.",
      "Helps avoid random ideas by clustering videos around real search and audience problems.",
      "Supports both educational and commercial short-form content.",
    ],
    related: [
      ["../youtube-shorts-content-plan-for-a-month/", "Shorts content plan"],
      ["../ai-tool-for-creating-shorts/", "AI tool for Shorts"],
      ["../youtube-shorts-script-generator/", "script generator"],
      ["../bulk-shorts-creation/", "bulk creation"],
    ],
    faq: [
      ["What is AI content for Shorts?", "It is the process of generating ideas, scripts and video drafts around a clear audience problem."],
      ["How do I avoid generic content?", "Use specific questions, objections and product use cases instead of broad topics."],
      ["How often should I create new ideas?", "Create ideas in batches, then scale the cluster that shows the strongest retention and clicks."],
    ],
  },
  {
    slug: "ai-shorts-editing",
    ruSlug: "ai-montazh-shorts",
    targetQuery: "ai shorts editing",
    title: "AI Shorts Editing: Faster Hooks, Captions and Drafts",
    description:
      "AI Shorts editing workflow for faster short-form videos: improve hooks, captions, voiceover, pacing and CTA before publishing.",
    h1: "AI Shorts Editing",
    lead:
      "AI editing for Shorts is most useful when it speeds up repetitive decisions: structure, subtitle rhythm, voice, first frame and CTA.",
    ctaSource: "seo_en_ai_shorts_editing",
    useCases: ["Creators reducing manual editing time", "Teams making multiple draft variants", "Faceless channels improving pacing"],
    workflow: ["Generate or upload a draft", "Tighten the first seconds", "Fix subtitles and voice timing", "Export one measurable version"],
    differentiators: [
      "Focuses on short-form retention details instead of generic editing features.",
      "Helps create variants without rebuilding the whole video.",
      "Keeps human review in place for message, facts and brand fit.",
    ],
    related: [
      ["../shorts-production-service-or-ai/", "production service or AI"],
      ["../how-to-make-shorts-without-editing/", "Shorts without editing"],
      ["../shorts-subtitle-generator/", "subtitle generator"],
      ["../automatic-shorts-creation/", "automatic creation"],
    ],
    faq: [
      ["Can AI edit Shorts completely?", "It can automate much of the draft work, but final judgment should stay with the creator or team."],
      ["What should AI edit first?", "Start with the hook, subtitle readability, audio balance and CTA timing."],
      ["Is this useful for existing footage?", "Yes, if the source material already has a clear idea or can be structured into a short answer."],
    ],
  },
  {
    slug: "bulk-shorts-creation",
    ruSlug: "massovoe-sozdanie-shorts",
    targetQuery: "bulk shorts creation",
    title: "Bulk Shorts Creation: Scale Drafts Without Losing Quality",
    description:
      "Bulk Shorts creation with AI: create batches of scripts and vertical video drafts while preserving review, quality and topic focus.",
    h1: "Bulk Shorts Creation",
    lead:
      "Bulk creation only works when each video still has a clear topic, useful hook and human review. Scale clusters, not low-quality duplicates.",
    ctaSource: "seo_en_bulk_shorts_creation",
    useCases: ["Content teams creating weekly batches", "Agencies preparing draft variants", "Creators scaling one proven topic cluster"],
    workflow: ["Choose one topic cluster", "Generate multiple angles", "Review and edit the strongest drafts", "Publish gradually and measure results"],
    differentiators: [
      "Designed for batches of meaningful variants, not spammy duplicate uploads.",
      "Supports topic clusters, internal links and measurable publishing rhythm.",
      "Pairs well with analytics: keep winners, rewrite weak openings.",
    ],
    related: [
      ["../automatic-shorts-creation/", "automatic Shorts creation"],
      ["../youtube-shorts-automation/", "Shorts automation"],
      ["../ai-content-for-shorts/", "AI content for Shorts"],
      ["../youtube-shorts-content-plan-for-a-month/", "content plan"],
    ],
    faq: [
      ["How many Shorts should I create in bulk?", "Start with a manageable batch around one cluster, then publish and measure before scaling."],
      ["Will bulk creation hurt quality?", "It can if you skip review. Keep human checks for claims, hooks, subtitles and visual clarity."],
      ["What is the safest scaling method?", "Create several angles from one topic, publish gradually and expand only the winners."],
    ],
  },
];

const ruYandexExpansionPages = [
  {
    slug: "neyroset-dlya-sozdaniya-shorts",
    enSlug: "ai-tool-for-creating-shorts",
    targetQuery: "нейросеть для создания shorts",
    title: "Нейросеть для создания Shorts: сценарий, голос и субтитры",
    description:
      "Нейросеть для создания Shorts из одной идеи: AI-сценарий, озвучка, субтитры, визуальный ритм и CTA в вертикальном видео.",
    h1: "Нейросеть для создания Shorts",
    lead:
      "Используйте один AI workflow, чтобы превратить тему, оффер или FAQ в короткий вертикальный ролик со сценарием, голосом, субтитрами и понятным первым кадром.",
    ctaSource: "seo_ru_neyroset_dlya_sozdaniya_shorts",
    useCases: ["Авторы, которые регулярно делают Shorts", "Бизнес, который превращает FAQ в видео", "Команды, тестирующие хуки без ручного монтажа"],
    workflow: ["Введите одну тему или оффер", "Сгенерируйте сценарий и озвучку", "Проверьте субтитры и первый кадр", "Экспортируйте чистый 9:16 тест"],
    differentiators: [
      "Workflow связывает сценарий, голос и визуальный темп, а не генерирует только текст.",
      "Подходит для повторяемых органических тестов, а не одного демо-ролика.",
      "Редактируемый черновик помогает улучшить хук, субтитры и CTA до публикации.",
    ],
    related: [
      ["../servis-dlya-sozdaniya-shorts/", "сервис для создания Shorts"],
      ["../avtomaticheskoe-sozdanie-shorts/", "автоматическое создание Shorts"],
      ["../ai-generator-shorts/", "AI-генератор Shorts"],
      ["../sozdat-shorts-video/", "создать Shorts-видео"],
    ],
    faq: [
      ["Что дать нейросети сначала?", "Одну аудиторию, одну проблему и один обещанный результат. Чем конкретнее вход, тем сильнее черновик."],
      ["Можно ли заменить ручной монтаж?", "Можно убрать большую часть повторяемой работы, но хук, факты и CTA всё равно стоит проверять."],
      ["Что тестировать первым?", "Первый кадр и первую фразу: они решают, продолжит ли зритель смотреть."],
    ],
  },
  {
    slug: "servis-dlya-sozdaniya-shorts",
    enSlug: "shorts-creation-service",
    targetQuery: "сервис для создания shorts",
    title: "Сервис для создания Shorts: AI workflow для вертикальных видео",
    description:
      "Сервис для создания Shorts: вертикальные видео с AI-сценарием, озвучкой, субтитрами, визуалом и CTA для авторов и бизнеса.",
    h1: "Сервис для создания Shorts",
    lead:
      "Создавайте Shorts без запуска production-задачи с нуля каждый раз. Сервис превращает одну идею в структурированный черновик, который можно отредактировать и опубликовать.",
    ctaSource: "seo_ru_servis_dlya_sozdaniya_shorts",
    useCases: ["Малый бизнес тестирует офферы", "Авторы строят weekly Shorts-систему", "Агентства готовят short-form черновики"],
    workflow: ["Выберите угол подачи", "Сгенерируйте черновик", "Отредактируйте хук и субтитры", "Опубликуйте и измерьте удержание"],
    differentiators: [
      "Это полный short-form workflow, а не одна отдельная AI-функция.",
      "Полезен для регулярных видео, где важна повторяемость формата.",
      "Связывает создание ролика с примерами, тарифами и практическими гайдами.",
    ],
    related: [
      ["../neyroset-dlya-sozdaniya-shorts/", "нейросеть для создания Shorts"],
      ["../sozdat-shorts-video/", "создать Shorts-видео"],
      ["../generator-youtube-shorts/", "генератор YouTube Shorts"],
      ["../pricing/", "тарифы"],
    ],
    faq: [
      ["Кому подходит такой сервис?", "Командам и авторам, которым нужен быстрый повторяемый способ создавать короткие вертикальные видео."],
      ["Это агентство под ключ?", "Нет. Это self-serve AI workflow, где вы сами создаете и редактируете черновик."],
      ["Какой результат на выходе?", "Публикуемый черновик, который всё равно стоит быстро проверить человеком перед размещением."],
    ],
  },
  {
    slug: "avtomaticheskoe-sozdanie-shorts",
    enSlug: "automatic-shorts-creation",
    targetQuery: "автоматическое создание shorts",
    title: "Автоматическое создание Shorts: повторяемый AI workflow",
    description:
      "Автоматическое создание Shorts с AI: сценарии, озвучка, субтитры и вертикальные черновики для регулярных органических тестов.",
    h1: "Автоматическое создание Shorts",
    lead:
      "Автоматизируйте повторяемые части production Shorts, сохраняя стратегию, факты и финальную проверку под своим контролем.",
    ctaSource: "seo_ru_avtomaticheskoe_sozdanie_shorts",
    useCases: ["Контент-команды строят ритм публикаций", "Фаундеры превращают продуктовые знания в видео", "Faceless-каналы создают ролики с голосом"],
    workflow: ["Соберите очередь тем", "Сгенерируйте сценарии и черновики", "Проверьте первые секунды", "Публикуйте, измеряйте и повторяйте удачные форматы"],
    differentiators: [
      "Автоматизация сфокусирована на сигналах качества: хук, темп, субтитры и следующий шаг.",
      "Процесс помогает уйти от случайных роликов к тематическим кластерам.",
      "Каждый черновик остается редактируемым, поэтому контроль не исчезает.",
    ],
    related: [
      ["../avtomatizaciya-youtube-shorts/", "автоматизация YouTube Shorts"],
      ["../servis-dlya-sozdaniya-shorts/", "сервис для создания Shorts"],
      ["../massovoe-sozdanie-shorts/", "массовое создание Shorts"],
      ["../kontent-plan-dlya-shorts-na-mesyac/", "контент-план Shorts"],
    ],
    faq: [
      ["Можно ли создавать Shorts автоматически?", "Production-шаги можно автоматизировать, но финальная проверка и стратегия тем должны оставаться за человеком."],
      ["Что не стоит автоматизировать?", "Дубликаты, вводящие в заблуждение обещания и массовые слабые публикации."],
      ["Как масштабировать аккуратно?", "Масштабируйте один тематический кластер за раз и измеряйте удержание, клики и конверсии."],
    ],
  },
  {
    slug: "sozdanie-shorts-na-zakaz-ili-ai",
    enSlug: "shorts-production-service-or-ai",
    targetQuery: "создание shorts на заказ или ai",
    title: "Создание Shorts на заказ или AI: что выбрать",
    description:
      "Сравните создание Shorts на заказ и AI workflow: скорость, цена одного теста, контроль правок, повторяемость и сценарии использования.",
    h1: "Создание Shorts на заказ или AI",
    lead:
      "Если короткие видео нужны каждую неделю, важна не только финальная картинка. Сравнивайте скорость, контроль и стоимость проверки нескольких углов.",
    ctaSource: "seo_ru_sozdanie_shorts_na_zakaz_ili_ai",
    useCases: ["Команды выбирают между подрядчиком и self-serve", "Бизнес тестирует short-form до масштабирования", "Авторам нужно больше черновиков в неделю"],
    workflow: ["Оцените нужный объем видео", "Посчитайте стоимость одного теста", "Проверьте, кто контролирует правки", "Выберите подрядчика, AI или гибрид"],
    differentiators: [
      "AI сильнее, когда нужно быстро проверить много структурированных идей.",
      "Подрядчик полезнее для сложных брендовых съемок и кастомной режиссуры.",
      "Часто оптимален гибрид: AI-черновики, human review и точечная полировка.",
    ],
    related: [
      ["../servis-dlya-sozdaniya-shorts/", "сервис для создания Shorts"],
      ["../ai-montazh-shorts/", "AI-монтаж Shorts"],
      ["../shorts-dlya-prodazh/", "Shorts для продаж"],
      ["../pricing/", "тарифы"],
    ],
    faq: [
      ["AI всегда дешевле?", "Обычно цена черновика ниже, но итоговая ценность зависит от проверки и полировки."],
      ["Когда нужен подрядчик?", "Для сложных брендовых съемок, отзывов и кампаний, где важна кастомная съемка."],
      ["Когда лучше AI?", "Для регулярных обучающих, продуктовых, FAQ и faceless short-form тестов."],
    ],
  },
  {
    slug: "shorts-dlya-prodazh",
    enSlug: "shorts-for-sales",
    targetQuery: "shorts для продаж",
    title: "Shorts для продаж: короткие видео, которые объясняют оффер",
    description:
      "Shorts для продаж: создавайте ролики про одну проблему клиента, один оффер, один аргумент и понятный следующий шаг.",
    h1: "Shorts для продаж",
    lead:
      "Продающие Shorts работают лучше, когда продают одну идею за раз: проблема, доказательство, оффер и следующий шаг без длинного питча.",
    ctaSource: "seo_ru_shorts_dlya_prodazh",
    useCases: ["Услуги объясняют оффер", "Интернет-магазины показывают сценарии использования", "Фаундеры тестируют одну ценность за ролик"],
    workflow: ["Выберите одну боль покупателя", "Напишите короткий хук", "Покажите практический результат", "Завершите одним CTA"],
    differentiators: [
      "AdShorts AI помогает превратить sales-тезисы в короткие видео без ощущения прямой рекламы.",
      "Workflow балансирует CTA и удержание.",
      "Подходит для серий про возражения, use cases, сравнения и FAQ.",
    ],
    related: [
      ["../shorts-dlya-biznesa/", "Shorts для бизнеса"],
      ["../video-dlya-reklamy-v-shorts/", "видео для рекламы в Shorts"],
      ["../ai-generator-shorts-dlya-malogo-biznesa/", "AI Shorts для малого бизнеса"],
      ["../shorts-dlya-marketplejsa/", "Shorts для маркетплейса"],
    ],
    faq: [
      ["В каждом продающем Shorts нужен жесткий CTA?", "Нет. Часто лучше работает мягкий следующий шаг после полезной части."],
      ["Что продавать первым?", "Один конкретный результат или сценарий использования, а не весь продукт сразу."],
      ["Что измерять?", "Клики, заявки и то, досматривают ли зрители до оффера."],
    ],
  },
  {
    slug: "video-dlya-reklamy-v-shorts",
    enSlug: "shorts-ad-video-maker",
    targetQuery: "видео для рекламы в shorts",
    title: "Видео для рекламы в Shorts: быстрые vertical creative тесты",
    description:
      "Создавайте рекламные Shorts-черновики с AI-сценарием, озвучкой, субтитрами, визуалом и CTA для быстрых vertical creative тестов.",
    h1: "Видео для рекламы в Shorts",
    lead:
      "Используйте short-form workflow, чтобы быстро собрать креативы для рекламы, органических тестов или проверки оффера до дорогого продакшена.",
    ctaSource: "seo_ru_video_dlya_reklamy_v_shorts",
    useCases: ["Тестировать рекламные углы до продакшена", "Создавать offer-led вертикальные видео", "Переупаковывать органические победители в paid creative"],
    workflow: ["Выберите один угол оффера", "Сгенерируйте короткий черновик", "Поправьте первый кадр и CTA", "Сравните удержание и клики"],
    differentiators: [
      "Быстрые черновики позволяют тестировать сообщение до расходов на полировку.",
      "Субтитры, голос и визуальный ритм создаются вместе.",
      "Одна идея может стать organic Shorts, Reels или платным creative-тестом.",
    ],
    related: [
      ["../shorts-dlya-prodazh/", "Shorts для продаж"],
      ["../ai-generator-video-dlya-socsetey/", "AI-видео для соцсетей"],
      ["../sozdanie-shorts-na-zakaz-ili-ai/", "на заказ или AI"],
      ["../examples/", "примеры"],
    ],
    faq: [
      ["Это только для платной рекламы?", "Нет. Сначала можно проверить сообщение органически, а победителей адаптировать в paid creative."],
      ["Что должна включать первая версия?", "Один хук, одну проблему клиента, один аргумент и один CTA."],
      ["Нужно ли генерировать много вариантов?", "Да, но меняйте один главный элемент за раз, чтобы понимать, что сработало."],
    ],
  },
  {
    slug: "ai-ozvuchka-dlya-shorts",
    enSlug: "ai-voiceover-for-shorts",
    targetQuery: "ai озвучка для shorts",
    title: "AI-озвучка для Shorts: ролики с голосом без записи",
    description:
      "AI-озвучка для Shorts: создавайте voice-led вертикальные видео со сценарием, субтитрами, темпом и редактируемым черновиком.",
    h1: "AI-озвучка для Shorts",
    lead:
      "Озвучка может заменить запись на микрофон, если сценарий, темп и субтитры понятны. Сгенерируйте voice-led черновик и проверьте первые секунды до публикации.",
    ctaSource: "seo_ru_ai_ozvuchka_dlya_shorts",
    useCases: ["Faceless-каналы", "Авторы без setup для записи", "Бизнес превращает FAQ в ролики с голосом"],
    workflow: ["Напишите короткий сценарий", "Выберите голос и темп", "Добавьте читаемые субтитры", "Проверьте вступление и CTA"],
    differentiators: [
      "Озвучка генерируется внутри video workflow, поэтому субтитры и темп совпадают.",
      "Полезно для регулярного выпуска, когда ручная запись тормозит.",
      "Подходит для faceless, обучающих и продуктовых объяснений.",
    ],
    related: [
      ["../ozvuchka-dlya-shorts-kak-vybrat-golos/", "гайд по озвучке"],
      ["../subtitry-dlya-shorts-avtomatom/", "автоматические субтитры"],
      ["../generator-shorts-bez-lica/", "генератор Shorts без лица"],
      ["../neyroset-dlya-sozdaniya-shorts/", "нейросеть для Shorts"],
    ],
    faq: [
      ["AI-озвучка подходит для Shorts?", "Да, если голос совпадает с форматом, а сценарий написан под живой темп речи."],
      ["Что править первым?", "Темп, паузы и длину строк субтитров, а не весь сценарий."],
      ["Можно использовать для бизнеса?", "Да, особенно для FAQ, продуктовых объяснений и коротких обучающих роликов."],
    ],
  },
  {
    slug: "generator-subtitrov-dlya-shorts",
    enSlug: "shorts-subtitle-generator",
    targetQuery: "генератор субтитров для shorts",
    title: "Генератор субтитров для Shorts: читаемый текст для видео",
    description:
      "Генератор субтитров для Shorts: создавайте читаемые caption-строки, тайминг под голос и мобильный текст для лучшего удержания.",
    h1: "Генератор субтитров для Shorts",
    lead:
      "Субтитры в Shorts - не только доступность. Они несут смысл, когда зритель смотрит без звука, и помогают удерживать темп.",
    ctaSource: "seo_ru_generator_subtitrov_dlya_shorts",
    useCases: ["Видео смотрят без звука", "Voice-led объяснения", "Faceless Shorts с текстовым прогрессом"],
    workflow: ["Сгенерируйте или вставьте сценарий", "Создайте субтитры из голоса", "Сократите длинные строки", "Проверьте safe margins на телефоне"],
    differentiators: [
      "Субтитры входят в short-form черновик, а не добавляются отдельно в конце.",
      "Читабельный ритм caption-строк помогает раннему удержанию.",
      "Работает с AI-озвучкой, загруженным голосом или script-led видео.",
    ],
    related: [
      ["../subtitry-dlya-shorts-avtomatom/", "автоматические субтитры"],
      ["../kak-sdelat-tekst-na-video-dlya-shorts/", "текст на видео"],
      ["../ai-ozvuchka-dlya-shorts/", "AI-озвучка"],
      ["../sozdat-shorts-video/", "создать Shorts-видео"],
    ],
    faq: [
      ["Какой длины должны быть строки?", "Достаточно короткие, чтобы читаться на телефоне и не закрывать основной визуал."],
      ["Субтитры улучшают удержание?", "Могут, особенно если зрители смотрят без звука или озвучка идет быстро."],
      ["Нужно показывать каждое слово?", "Не всегда. Иногда чистые key-phrase субтитры лучше плотной дословной расшифровки."],
    ],
  },
  {
    slug: "generator-vertikalnyh-video",
    enSlug: "vertical-video-generator",
    targetQuery: "генератор вертикальных видео",
    title: "Генератор вертикальных видео для Shorts, Reels и TikTok",
    description:
      "Генерируйте вертикальные видео для Shorts, Reels и TikTok: AI-сценарий, озвучка, субтитры, визуальный ритм и формат 9:16.",
    h1: "Генератор вертикальных видео",
    lead:
      "Создавайте 9:16 видео из одной идеи и адаптируйте результат под Shorts, Reels или TikTok без ручной пересборки черновика.",
    ctaSource: "seo_ru_generator_vertikalnyh_video",
    useCases: ["Short-form контент-планы", "Тесты видео для соцсетей", "Бизнес делает вертикальные объяснения"],
    workflow: ["Начните с одной идеи", "Сгенерируйте 9:16 черновик", "Поправьте субтитры и хук", "Экспортируйте под выбранную платформу"],
    differentiators: [
      "Workflow создан именно для вертикального short-form, а не универсального горизонтального видео.",
      "Сценарий, голос, субтитры и визуальный ритм находятся в одном процессе.",
      "Помогает делать platform-variants из общего черновика.",
    ],
    related: [
      ["../sozdat-shorts-video/", "создать Shorts-видео"],
      ["../ai-video-maker-dlya-reels-tiktok-i-shorts/", "AI video maker"],
      ["../generator-video-dlya-tiktok/", "генератор TikTok"],
      ["../generator-reels-instagram/", "генератор Reels"],
    ],
    faq: [
      ["Какой формат нужен вертикальному видео?", "9:16, читаемые субтитры и безопасные поля под мобильный интерфейс."],
      ["Один черновик подойдет везде?", "Да, но первую фразу, caption и CTA лучше адаптировать под платформу."],
      ["Что проверить перед экспортом?", "Первый кадр, читаемость субтитров, баланс звука и финальный CTA."],
    ],
  },
  {
    slug: "shorts-dlya-telegram-kanala",
    enSlug: "shorts-for-telegram-channel",
    targetQuery: "shorts для telegram канала",
    title: "Shorts для Telegram-канала: как вести зрителей в сообщество",
    description:
      "Создавайте Shorts для роста Telegram-канала: хук, мягкий CTA, мостик к посту, субтитры и повторяемые идеи видео.",
    h1: "Shorts для Telegram-канала",
    lead:
      "Shorts могут прогревать зрителя перед переходом в Telegram, но ролик должен объяснять, зачем следующий шаг полезен именно сейчас.",
    ctaSource: "seo_ru_shorts_dlya_telegram_kanala",
    useCases: ["Эксперты растят Telegram-сообщество", "Фаундеры ведут зрителей к обновлениям", "Авторы строят теплую аудиторию вне YouTube"],
    workflow: ["Выберите полезную teaser-идею", "Сделайте короткий ответ или чеклист", "Добавьте мягкий Telegram CTA", "Отслеживайте клики и удержание"],
    differentiators: [
      "AdShorts AI помогает превращать темы Telegram в короткие teaser-видео.",
      "CTA можно оформить как продолжение, а не как прямую рекламу.",
      "Лучше всего работает серией вокруг одной проблемы аудитории.",
    ],
    related: [
      ["../kak-privesti-trafik-iz-shorts-v-telegram/", "трафик из Shorts в Telegram"],
      ["../shorts-dlya-eksperta/", "Shorts для эксперта"],
      ["../kontent-plan-dlya-shorts-na-mesyac/", "контент-план"],
      ["../cta-v-shorts/", "CTA в Shorts"],
    ],
    faq: [
      ["Нужно ли прямо упоминать Telegram?", "Да, но после полезной части и с понятным продолжением темы."],
      ["Какие темы подходят?", "Чеклисты, ошибки, шаблоны и preview более глубокого поста в Telegram."],
      ["Что измерять?", "Клики в профиль, переходы в Telegram и удержание до CTA."],
    ],
  },
  {
    slug: "shorts-dlya-marketplejsa",
    enSlug: "shorts-for-marketplaces",
    targetQuery: "shorts для маркетплейса",
    title: "Shorts для маркетплейса: продуктовые видео без тяжелого продакшена",
    description:
      "Создавайте Shorts для товаров на маркетплейсах: демо, use cases, преимущества, субтитры и product-led черновики с AI.",
    h1: "Shorts для маркетплейса",
    lead:
      "Товарам нужны короткие видео, которые быстро показывают сценарий использования, проблему, выгоду и доказательство. Один товар можно раскрыть через несколько углов.",
    ctaSource: "seo_ru_shorts_dlya_marketplejsa",
    useCases: ["Продавцы объясняют преимущества товара", "Бренды тестируют продуктовые углы", "Команды делают product-led короткие видео"],
    workflow: ["Выберите один сценарий использования", "Сгенерируйте demo-style сценарий", "Добавьте субтитры и benefit-текст", "Экспортируйте вертикальный тест"],
    differentiators: [
      "Помогает делать продуктовые видео без отдельной съемки под каждый угол.",
      "Поддерживает benefit-led, FAQ, unboxing и problem-solution форматы.",
      "Полезно для органики и предварительного теста creative-идей.",
    ],
    related: [
      ["../shorts-dlya-prodazh/", "Shorts для продаж"],
      ["../video-dlya-reklamy-v-shorts/", "видео для рекламы"],
      ["../ai-generator-shorts-dlya-malogo-biznesa/", "AI Shorts для малого бизнеса"],
      ["../generator-vertikalnyh-video/", "генератор вертикальных видео"],
    ],
    faq: [
      ["Какие продуктовые видео работают лучше?", "Демо сценария использования, problem-solution и короткие сравнения обычно сильнее обычных product shots."],
      ["Нужна ли съемка товара?", "Реальные кадры товара полезны, но AI workflow всё равно помогает со сценарием, субтитрами и черновиком."],
      ["Сколько углов тестировать?", "Начните с трех: проблема, выгода и возражение."],
    ],
  },
  {
    slug: "shorts-dlya-eksperta",
    enSlug: "shorts-for-experts",
    targetQuery: "shorts для эксперта",
    title: "Shorts для эксперта: упакуйте знания в короткие видео",
    description:
      "Создавайте Shorts для экспертов: советы, FAQ, ошибки и фреймворки в коротких видео с AI-сценарием, озвучкой и субтитрами.",
    h1: "Shorts для эксперта",
    lead:
      "Экспертам не нужны сначала вирусные трюки. Нужны повторяемые короткие видео, которые упаковывают один полезный ответ и постепенно строят доверие.",
    ctaSource: "seo_ru_shorts_dlya_eksperta",
    useCases: ["Консультанты объясняют частые ошибки", "Коучи превращают фреймворки в клипы", "Специалисты отвечают на вопросы клиентов"],
    workflow: ["Выберите один вопрос клиента", "Соберите компактный ответ", "Добавьте практический пример", "Закончите мягким следующим шагом"],
    differentiators: [
      "AdShorts AI помогает превращать экспертизу в повторяемый видеоформат.",
      "Озвучка и субтитры ускоряют production, если съемка тормозит.",
      "Хорошо работает сериями: мифы, ошибки, чеклисты и мини-кейсы.",
    ],
    related: [
      ["../shorts-dlya-telegram-kanala/", "Shorts для Telegram"],
      ["../shorts-dlya-biznesa/", "Shorts для бизнеса"],
      ["../kontent-dlya-shorts-s-ai/", "контент для Shorts с AI"],
      ["../kak-sdelat-huk-v-shorts/", "хуки"],
    ],
    faq: [
      ["Что эксперту публиковать первым?", "Частые вопросы, ошибки и простые фреймворки, которые клиенты уже спрашивают."],
      ["Можно ли делать Shorts без лица?", "Да, voice-led ролики с субтитрами хорошо подходят для обучающего контента."],
      ["Как не выглядеть слишком рекламно?", "Сначала дать одну полезную мысль, потом мягкий CTA после ценности."],
    ],
  },
  {
    slug: "kontent-dlya-shorts-s-ai",
    enSlug: "ai-content-for-shorts",
    targetQuery: "контент для shorts с ai",
    title: "Контент для Shorts с AI: идеи, сценарии и видео-черновики",
    description:
      "Создавайте контент для Shorts с AI: превращайте темы, FAQ и офферы в идеи видео, сценарии, озвучку, субтитры и черновики.",
    h1: "Контент для Shorts с AI",
    lead:
      "AI-контент для Shorts не должен заканчиваться списком идей. Полезный workflow ведет от темы к сценарию, видео-черновику и измерению результата.",
    ctaSource: "seo_ru_kontent_dlya_shorts_s_ai",
    useCases: ["Авторы собирают очередь тем", "Бизнес превращает FAQ в ролики", "Команды переупаковывают длинные идеи в короткие клипы"],
    workflow: ["Создайте тематический кластер", "Сгенерируйте углы видео", "Соберите черновики из лучших углов", "Измерьте и расширьте winning theme"],
    differentiators: [
      "Связывает контент-планирование и video production в одном short-form workflow.",
      "Помогает избежать случайных идей через кластеры реальных проблем аудитории.",
      "Поддерживает образовательный и коммерческий short-form контент.",
    ],
    related: [
      ["../kontent-plan-dlya-shorts-na-mesyac/", "контент-план Shorts"],
      ["../neyroset-dlya-sozdaniya-shorts/", "нейросеть для Shorts"],
      ["../generator-scenariev-youtube-shorts/", "генератор сценариев"],
      ["../massovoe-sozdanie-shorts/", "массовое создание"],
    ],
    faq: [
      ["Что такое контент для Shorts с AI?", "Это генерация идей, сценариев и видео-черновиков вокруг конкретной проблемы аудитории."],
      ["Как избежать generic-контента?", "Используйте конкретные вопросы, возражения и продуктовые сценарии, а не широкие темы."],
      ["Как часто делать новые идеи?", "Генерируйте идеи пачками, а масштабируйте кластер, который дает лучшее удержание и клики."],
    ],
  },
  {
    slug: "ai-montazh-shorts",
    enSlug: "ai-shorts-editing",
    targetQuery: "ai монтаж shorts",
    title: "AI-монтаж Shorts: быстрее хуки, субтитры и черновики",
    description:
      "AI-монтаж Shorts: ускорьте создание коротких видео через правку хуков, субтитров, озвучки, темпа и CTA перед публикацией.",
    h1: "AI-монтаж Shorts",
    lead:
      "AI-монтаж для Shorts полезен, когда ускоряет повторяемые решения: структура, ритм субтитров, голос, первый кадр и CTA.",
    ctaSource: "seo_ru_ai_montazh_shorts",
    useCases: ["Авторы сокращают время монтажа", "Команды делают несколько вариантов черновика", "Faceless-каналы улучшают темп"],
    workflow: ["Сгенерируйте или загрузите черновик", "Усильте первые секунды", "Поправьте субтитры и тайминг голоса", "Экспортируйте одну измеримую версию"],
    differentiators: [
      "Фокус на short-form retention, а не на универсальных editing-фичах.",
      "Помогает делать варианты без пересборки всего видео.",
      "Оставляет human review для смысла, фактов и бренда.",
    ],
    related: [
      ["../sozdanie-shorts-na-zakaz-ili-ai/", "на заказ или AI"],
      ["../kak-sdelat-shorts-bez-montazha/", "Shorts без монтажа"],
      ["../generator-subtitrov-dlya-shorts/", "генератор субтитров"],
      ["../avtomaticheskoe-sozdanie-shorts/", "автоматическое создание"],
    ],
    faq: [
      ["AI может полностью смонтировать Shorts?", "Он может автоматизировать большую часть черновой работы, но финальная оценка должна оставаться за человеком."],
      ["Что править первым?", "Хук, читаемость субтитров, баланс звука и момент CTA."],
      ["Подходит ли для уже снятого видео?", "Да, если в исходнике есть понятная идея или его можно структурировать в короткий ответ."],
    ],
  },
  {
    slug: "massovoe-sozdanie-shorts",
    enSlug: "bulk-shorts-creation",
    targetQuery: "массовое создание shorts",
    title: "Массовое создание Shorts: масштабируйте черновики без потери качества",
    description:
      "Массовое создание Shorts с AI: пачки сценариев и вертикальных видео-черновиков с контролем качества, тем и human review.",
    h1: "Массовое создание Shorts",
    lead:
      "Массовое создание работает только если у каждого ролика есть понятная тема, полезный хук и проверка человеком. Масштабируйте кластеры, а не дубли.",
    ctaSource: "seo_ru_massovoe_sozdanie_shorts",
    useCases: ["Контент-команды делают weekly batches", "Агентства готовят варианты черновиков", "Авторы масштабируют один доказанный кластер"],
    workflow: ["Выберите один тематический кластер", "Сгенерируйте несколько углов", "Проверьте и отредактируйте сильные черновики", "Публикуйте постепенно и измеряйте результат"],
    differentiators: [
      "Подходит для meaningful-вариантов, а не спамных дублей.",
      "Поддерживает тематические кластеры, внутренние ссылки и измеримый ритм публикаций.",
      "Хорошо работает вместе с аналитикой: оставляйте победителей, переписывайте слабые вступления.",
    ],
    related: [
      ["../avtomaticheskoe-sozdanie-shorts/", "автоматическое создание Shorts"],
      ["../avtomatizaciya-youtube-shorts/", "автоматизация Shorts"],
      ["../kontent-dlya-shorts-s-ai/", "контент для Shorts с AI"],
      ["../kontent-plan-dlya-shorts-na-mesyac/", "контент-план"],
    ],
    faq: [
      ["Сколько Shorts создавать пачкой?", "Начните с управляемой пачки вокруг одного кластера, затем публикуйте и измеряйте перед масштабированием."],
      ["Массовое создание портит качество?", "Может, если убрать review. Проверяйте факты, хук, субтитры и визуальную ясность."],
      ["Как масштабировать безопаснее?", "Создавайте несколько углов из одной темы, публикуйте постепенно и расширяйте только победителей."],
    ],
  },
];

const allCommercialPages = [
  ...commercialPages.map((page) => ({ ...page, locale: "en", alternateSlug: page.ruSlug })),
  ...enBuyerGuidePages.map((page) => ({ ...page, locale: "en", alternateSlug: page.ruSlug })),
  ...enYandexExpansionPages.map((page) => ({ ...page, locale: "en", alternateSlug: page.ruSlug })),
  ...ruCommercialPages.map((page) => ({ ...page, locale: "ru", alternateSlug: page.enSlug })),
  ...ruBuyerGuidePages.map((page) => ({ ...page, locale: "ru", alternateSlug: page.enSlug })),
  ...ruYandexExpansionPages.map((page) => ({ ...page, locale: "ru", alternateSlug: page.enSlug })),
];

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const publicCopy = (value, locale) => String(value)
  .replace(/production[- ]workflow/gi, locale === "en" ? "creation process" : "процесс создания")
  .replace(/production/gi, locale === "en" ? "creation" : "создание")
  .replace(/workflow/gi, locale === "en" ? "process" : "процесс")
  .replace(/short-form/gi, locale === "en" ? "vertical video" : "коротких видео")
  .replace(/content pillars?/gi, locale === "en" ? "topics" : "темы")
  .replace(/контент-пиллар(?:ы|ов|ами)?/gi, "темы")
  .replace(/search intent/gi, locale === "en" ? "viewer question" : "вопрос зрителя")
  .replace(/поисков(?:ый|ого|ому|ым) интент/gi, "вопрос пользователя")
  .replace(/topic cluster/gi, "related topics");

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const renderJsonLd = (data) => JSON.stringify(data, null, 6).replace(/^/gm, "    ");

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

const pagePath = (page) => (page.locale === "en" ? `/en/${page.slug}/` : `/${page.slug}/`);
const canonicalFor = (page) => `${siteOrigin}${pagePath(page)}`;
const assetPrefix = (page) => (page.locale === "en" ? "../../" : "../");
const alternateRu = (page) => `${siteOrigin}/${page.locale === "ru" ? page.slug : page.alternateSlug}/`;
const alternateEn = (page) => `${siteOrigin}/en/${page.locale === "en" ? page.slug : page.alternateSlug}/`;

const renderHead = (page) => {
  const canonical = canonicalFor(page);
  const prefix = assetPrefix(page);
  const cleanDescription = publicCopy(page.description, page.locale);
  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AdShorts AI",
    url: page.locale === "en" ? `${siteOrigin}/en/` : `${siteOrigin}/`,
    image: logoUrl,
    logo: logoUrl,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    description: cleanDescription,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: page.locale === "en" ? "USD" : "RUB",
      url: page.locale === "en" ? `${siteOrigin}/en/pricing/` : `${siteOrigin}/pricing/`,
    },
  };
  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.h1,
    description: cleanDescription,
    inLanguage: page.locale,
    url: canonical,
    dateModified,
    isPartOf: {
      "@type": "WebSite",
      name: "AdShorts AI",
      url: siteOrigin,
    },
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: page.locale === "en" ? "Home" : "Главная",
        item: page.locale === "en" ? `${siteOrigin}/en/` : `${siteOrigin}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: page.locale === "en" ? "Shorts Guides" : "Гайды по Shorts",
        item: page.locale === "en" ? `${siteOrigin}/en/shorts-guides/` : `${siteOrigin}/shorts-guides/`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: page.h1,
        item: canonical,
      },
    ],
  };
  return `  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="canonical" href="${canonical}" />
    <link rel="alternate" hreflang="ru" href="${alternateRu(page)}" />
    <link rel="alternate" hreflang="en" href="${alternateEn(page)}" />
    <link rel="alternate" hreflang="x-default" href="${alternateRu(page)}" />
    <title>${escapeHtml(publicCopy(page.title, page.locale))}</title>
    <meta name="description" content="${escapeHtml(cleanDescription)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${escapeHtml(publicCopy(page.title, page.locale))}" />
    <meta property="og:description" content="${escapeHtml(cleanDescription)}" />
    <meta property="og:image" content="${logoUrl}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:site_name" content="AdShorts AI" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(publicCopy(page.title, page.locale))}" />
    <meta name="twitter:description" content="${escapeHtml(cleanDescription)}" />
    <meta name="twitter:image" content="${logoUrl}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${prefix}styles.css?v=${cssVersion}" />
    <link rel="preload" as="image" href="${prefix}logo.png?v=2" />
    <link rel="icon" type="image/png" sizes="120x120" href="${prefix}favicon.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="${prefix}favicon-48.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="${prefix}favicon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="${prefix}favicon-16.png" />
    <link rel="icon" type="image/svg+xml" href="${prefix}favicon.svg" />
    <link rel="shortcut icon" type="image/x-icon" href="${prefix}favicon.ico" />
    <link rel="apple-touch-icon" href="${prefix}logo.png?v=2" />
    <style>
      .logo { display: inline-flex; align-items: center; gap: 12px; }
      .logo__icon { display: inline-block; }
      .commercial-snapshot { display: grid; gap: 14px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 30px 0 42px; }
      .commercial-snapshot__item { min-width: 0; padding: 18px 20px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--card); }
      .commercial-snapshot__item strong { display: block; margin-bottom: 8px; color: var(--text); }
      .commercial-snapshot__item p { margin: 0; font-size: .94rem; }
      .commercial-example { margin: 34px 0; }
      .commercial-example video { display: block; width: min(100%, 420px); aspect-ratio: 9 / 16; margin: 18px auto 0; border: 1px solid var(--border); border-radius: var(--radius-sm); background: #05070f; object-fit: cover; }
      .commercial-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
      @media (max-width: 760px) { .commercial-snapshot { grid-template-columns: 1fr; } }
    </style>
    <script defer src="${prefix}script.js?v=${scriptVersion}"></script>
${renderYandexMetrikaCounter()}
    <script type="application/ld+json">
${renderJsonLd(softwareApplication)}
    </script>
    <script type="application/ld+json">
${renderJsonLd(webPage)}
    </script>
    <script type="application/ld+json">
${renderJsonLd(breadcrumb)}
    </script>
  </head>`;
};

const renderHeader = (page) => {
  const prefix = assetPrefix(page);
  const homeHref = page.locale === "en" ? "../../en/" : "../";
  const examplesHref = page.locale === "en" ? "../../en/examples/" : "../examples/";
  const studioHref = page.locale === "en" ? "../../en/app/studio" : "../app/studio";
  const pricingHref = page.locale === "en" ? "../../en/pricing/" : "../pricing/";
  const currentCode = page.locale.toUpperCase();
  const currentName = page.locale === "en" ? "English" : "Русский";
  const otherCode = page.locale === "en" ? "RU" : "EN";
  const otherName = page.locale === "en" ? "Русский" : "English";
  const otherHref = page.locale === "en" ? `../../${page.alternateSlug}/` : `../en/${page.alternateSlug}/`;
  const nav = page.locale === "en"
    ? { home: "Home", examples: "Examples", studio: "Studio", pricing: "Pricing", menu: "Menu", signIn: "Sign in", language: "Language selection", current: "Language: English" }
    : { home: "Главная", examples: "Примеры", studio: "Студия", pricing: "Тарифы", menu: "Меню", signIn: "Войти", language: "Выбор языка", current: "Язык: Русский" };

  return `    <header class="header header--app-static">
      <div class="container header__inner">
        <a class="logo" href="${homeHref}" aria-label="AdShorts AI">
          <img class="logo__icon" src="${prefix}logo.png?v=2" alt="" role="presentation" width="46" height="46" />
          <span class="logo__wordmark">AdShorts<span>AI</span></span>
        </a>
        <nav class="nav" aria-label="Main navigation">
          <button class="nav__toggle" aria-expanded="false" aria-controls="nav-menu">${nav.menu}</button>
          <ul id="nav-menu" class="nav__list">
            <li><a class="nav__home-link" href="${homeHref}">${nav.home}</a></li>
            <li><a href="${examplesHref}">${nav.examples}</a></li>
            <li><a href="${studioHref}">${nav.studio}</a></li>
            <li><a href="${pricingHref}">${nav.pricing}</a></li>
          </ul>
        </nav>
        <div class="header__actions">
          <details class="lang-switcher"><summary class="lang-switcher__trigger" aria-label="${escapeHtml(nav.current)}" title="${escapeHtml(nav.current)}"><svg class="lang-switcher__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.2 2.35 3.4 5.35 3.4 9s-1.2 6.65-3.4 9M12 3c-2.2 2.35-3.4 5.35-3.4 9s1.2 6.65 3.4 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>${currentCode}</span></summary><div class="lang-switcher__menu" role="menu" aria-label="${escapeHtml(nav.language)}"><a class="lang-switcher__option is-active" href="./" role="menuitem" aria-label="${currentCode} ${escapeHtml(currentName)}" aria-current="page"><span class="lang-switcher__code">${currentCode}</span><span class="lang-switcher__label">${escapeHtml(currentName)}</span></a><a class="lang-switcher__option" href="${otherHref}" role="menuitem" aria-label="${otherCode} ${escapeHtml(otherName)}"><span class="lang-switcher__code">${otherCode}</span><span class="lang-switcher__label">${escapeHtml(otherName)}</span></a></div></details>
          <a class="header__signin-link" href="${studioHref}">${nav.signIn}</a>
        </div>
      </div>
    </header>`;
};

const renderList = (items) => items.map((item) => `              <li>${escapeHtml(item)}</li>`).join("\n");

const renderRelated = (items) =>
  items
    .map(([href, label]) => `              <li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`)
    .join("\n");

const renderPage = (page) => {
  const prefix = assetPrefix(page);
  const guidesHref = page.locale === "en" ? "../shorts-guides/#ai-generators" : "../shorts-guides/#ai-generators";
  const studioHref = page.locale === "en" ? "../../en/app/studio" : "../app/studio";
  const examplesHref = page.locale === "en" ? "../examples/" : "../examples/";
  const pricingHref = page.locale === "en" ? "../pricing/" : "../pricing/";
  const footerHomeHref = page.locale === "en" ? "../../en/" : "../";
  const videoHref = page.locale === "en" ? "../../1en.mp4?v=2" : "../1ru.mp4?v=2";
  const copy = (value) => escapeHtml(publicCopy(value, page.locale));
  const footerLinks = page.locale === "en"
    ? {
        back: "All AI generator pages",
        cta: "Create Video for Free",
        note: "Studio opens in the browser. Start with one idea, then edit the generated draft before publishing.",
        bestFor: "Best for",
        output: "Main output",
        outputText: "9:16 short-form video draft with script, voice and subtitles.",
        metric: "Next metric",
        metricText: "Compare first-second retention, average view duration and CTA clicks.",
        who: "Who this is for",
        workflow: "How it works",
        why: "Why use AdShorts AI for this",
        exampleTitle: "A real video example",
        exampleText: "This video was created with the same studio. Use it to evaluate pacing, captions and the 9:16 result before starting.",
        limitations: "When this tool is not the right fit",
        limitationItems: [
          "Complex brand shoots that require actors, custom locations or precise art direction.",
          "Videos with claims that cannot be checked by the person publishing them.",
          "Projects that need frame-by-frame compositing in a professional editor.",
        ],
        actionTitle: "Create the first draft",
        actionText: "Start with one clear topic. Review the script, voice, captions and final frame before export.",
        pricing: "View pricing",
        faq: "FAQ",
        readAlso: "Read also",
        contact: "Contact:",
        about: "About",
        offer: "Public Offer",
        termsOfUse: "Terms of Use",
        terms: "User Agreement",
        privacy: "Privacy Policy",
        guides: "Shorts Guides",
      }
    : {
        back: "Все AI-генераторы",
        cta: "Создать видео бесплатно",
        note: "Откроется студия. Начните с одной идеи, затем отредактируйте сгенерированный черновик перед публикацией.",
        bestFor: "Для кого",
        output: "Что на выходе",
        outputText: "9:16 черновик короткого видео со сценарием, голосом и субтитрами.",
        metric: "Следующая метрика",
        metricText: "Сравните удержание в первые секунды, среднюю длительность просмотра и клики по CTA.",
        who: "Кому это подходит",
        workflow: "Как это работает",
        why: "Почему AdShorts AI подходит для этого",
        exampleTitle: "Пример готового видео",
        exampleText: "Видео создано в этой же студии. По нему можно оценить темп, субтитры и результат 9:16 до начала работы.",
        limitations: "Когда инструмент не подойдёт",
        limitationItems: [
          "Сложная брендовая съёмка с актёрами, локациями и точной арт-дирекцией.",
          "Видео с утверждениями, которые автор публикации не может проверить.",
          "Проекты, где нужен покадровый композитинг в профессиональном редакторе.",
        ],
        actionTitle: "Создайте первый черновик",
        actionText: "Начните с одной понятной темы. Перед экспортом проверьте сценарий, голос, субтитры и финальный кадр.",
        pricing: "Посмотреть тарифы",
        faq: "FAQ",
        readAlso: "Читайте также",
        contact: "Контакты:",
        about: "О проекте",
        offer: "Публичная оферта",
        termsOfUse: "Условия использования",
        terms: "Пользовательское соглашение",
        privacy: "Политика конфиденциальности",
        guides: "Гайды по Shorts",
      };

  return `<!doctype html>
<html lang="${page.locale}">
${renderHead(page)}
  <body>
${renderHeader(page)}
    <main>
      <section class="section">
        <div class="container article">
          <a href="${guidesHref}" class="article-back">${footerLinks.back}</a>
          <h1>${copy(page.h1)}</h1>
          <p class="lead">${copy(page.lead)}</p>

          <div class="cta cta--center">
            <a class="btn btn--primary btn--lg" href="${studioHref}?source=${escapeHtml(page.ctaSource)}">${footerLinks.cta}</a>
            <p class="cta__note">${footerLinks.note}</p>
          </div>

          <div class="commercial-snapshot" aria-label="Page summary">
            <div class="commercial-snapshot__item"><strong>${footerLinks.bestFor}</strong><p>${escapeHtml(page.useCases[0])}</p></div>
            <div class="commercial-snapshot__item"><strong>${footerLinks.output}</strong><p>${footerLinks.outputText}</p></div>
            <div class="commercial-snapshot__item"><strong>${footerLinks.metric}</strong><p>${footerLinks.metricText}</p></div>
          </div>

          <h2>${footerLinks.who}</h2>
          <ul>
${renderList(page.useCases.map((item) => publicCopy(item, page.locale)))}
          </ul>

          <h2>${footerLinks.workflow}</h2>
          <ol>
${renderList(page.workflow.map((item) => publicCopy(item, page.locale)))}
          </ol>

          <h2>${footerLinks.why}</h2>
          <ul>
${renderList(page.differentiators.map((item) => publicCopy(item, page.locale)))}
          </ul>

          <section class="commercial-example" aria-labelledby="commercial-example">
            <h2 id="commercial-example">${footerLinks.exampleTitle}</h2>
            <p>${footerLinks.exampleText}</p>
            <video controls preload="metadata" playsinline src="${videoHref}"></video>
          </section>

          <h2>${footerLinks.limitations}</h2>
          <ul>
${renderList(footerLinks.limitationItems)}
          </ul>

          <section class="cta cta--center" aria-labelledby="commercial-action">
            <h2 id="commercial-action">${footerLinks.actionTitle}</h2>
            <p>${footerLinks.actionText}</p>
            <div class="commercial-actions">
              <a class="btn btn--primary btn--lg" href="${studioHref}?source=${escapeHtml(page.ctaSource)}">${footerLinks.cta}</a>
              <a class="btn btn--ghost btn--lg" href="${pricingHref}">${footerLinks.pricing}</a>
            </div>
          </section>

          <section class="article-faq" aria-labelledby="commercial-faq">
            <h2 id="commercial-faq">${footerLinks.faq}</h2>
${page.faq.map(([question, answer]) => `            <h3>${copy(question)}</h3>
            <p>${copy(answer)}</p>`).join("\n")}
          </section>

          <h2>${footerLinks.readAlso}</h2>
          <ul>
${renderRelated(page.related.slice(0, 4).map(([href, label]) => [href, publicCopy(label, page.locale)]))}
          </ul>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="container footer__inner">
        <a class="logo" href="${footerHomeHref}">AdShorts<span>AI</span></a>
        <div class="footer__links">
          <span style="color: var(--muted);">${footerLinks.contact} <a href="mailto:support@adshortsai.com" style="color: var(--muted);">support@adshortsai.com</a></span>
          <a href="${page.locale === "en" ? "../contact/" : "../contacts/"}">${footerLinks.about}</a>
          <a href="${prefix}offer/">${footerLinks.offer}</a>
          <a href="${page.locale === "en" ? "../terms-of-use/" : "../terms-of-use/"}">${footerLinks.termsOfUse}</a>
          <a href="${page.locale === "en" ? "../terms/" : "../terms/"}">${footerLinks.terms}</a>
          <a href="${page.locale === "en" ? "../privacy/" : "../privacy/"}">${footerLinks.privacy}</a>
          <a href="${page.locale === "en" ? "../shorts-guides/" : "../shorts-guides/"}">${footerLinks.guides}</a>
          <span style="color: var(--muted);">© <span id="year"></span> AdShorts AI</span>
        </div>
      </div>
    </footer>
  </body>
</html>
`;
};

const renderGuidesBlock = (locale) => {
  const commercialHubPages = locale === "en"
    ? [...commercialPages, ...enBuyerGuidePages, ...enYandexExpansionPages]
    : [...ruCommercialPages, ...ruBuyerGuidePages, ...ruYandexExpansionPages];
  const pages = commercialHubPages.filter((page) => {
    const pathname = locale === "en" ? `/en/${page.slug}/` : `/${page.slug}/`;
    return indexPaths.has(pathname);
  });
  if (locale === "ru" && indexPaths.has("/kalkulyator-stoimosti-shorts/")) {
    pages.unshift({
      slug: "kalkulyator-stoimosti-shorts",
      h1: "Калькулятор стоимости и времени Shorts",
      description: "Сравните часы и бюджет ручного создания коротких видео со своим сценарием работы через AI.",
    });
  }
  const title = locale === "en" ? "AI generators" : "AI-генераторы";
  const intro = locale === "en"
    ? "Product pages and practical guides for creating vertical videos with AI."
    : "Инструменты и практические материалы для создания вертикальных видео с AI.";

  return `          <!-- seo-commercial-growth:start -->
          <div class="section-header guide-section" id="ai-generators">
            <div class="section-header__icon section-header__icon--purple">AI</div>
            <div class="section-header__text">
              <h2>${title} <span class="section-count">${pages.length} ${locale === "en" ? "pages" : "страниц"}</span></h2>
              <p>${intro}</p>
            </div>
          </div>
          <div class="guide-cards">
${pages
  .map(
    (page) => `            <a class="guide-card" href="../${page.slug}/">
              <h3>${escapeHtml(page.h1)}</h3>
              <p>${escapeHtml(page.description)}</p>
            </a>`,
  )
  .join("\n\n")}
          </div>
          <!-- seo-commercial-growth:end -->
`;
};

const updateGuidesIndex = async (locale) => {
  const guidesPath = path.join(rootDir, locale === "en" ? "en/shorts-guides/index.html" : "shorts-guides/index.html");
  let html = await readFile(guidesPath, "utf8");
  const navLink = locale === "en"
    ? '              <a class="btn btn--ghost btn--small" href="#ai-generators">AI generators</a>'
    : '              <a class="btn btn--ghost btn--small" href="#ai-generators">AI-генераторы</a>';
  const productionNavLink = locale === "en"
    ? '              <a class="btn btn--ghost btn--small" href="#production">🎬 Editing</a>'
    : '              <a class="btn btn--ghost btn--small" href="#production">🎬 Монтаж</a>';

  if (!html.includes('href="#ai-generators"')) {
    html = html.replace(
      productionNavLink,
      `${navLink}\n${productionNavLink}`,
    );
  }

  html = html.replace(/\s*<!-- seo-commercial-growth:start -->[\s\S]*?<!-- seo-commercial-growth:end -->\n?/g, "\n");
  html = html.replace(
    '          <div class="section-header guide-section" id="production">',
    `${renderGuidesBlock(locale)}\n          <div class="section-header guide-section" id="production">`,
  );

  await writeFile(guidesPath, html, "utf8");
};

for (const page of allCommercialPages) {
  const dir = page.locale === "en" ? path.join(rootDir, "en", page.slug) : path.join(rootDir, page.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), renderPage(page), "utf8");
}

await updateGuidesIndex("en");
await updateGuidesIndex("ru");

console.log(
  `Generated ${allCommercialPages.length} commercial SEO pages and updated guides indexes. Run apply-seo-index-policy.mjs to update index controls and sitemap.`,
);
