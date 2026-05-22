#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteOrigin = "https://adshortsai.com";
const dateModified = "2026-05-23";
const cssVersion = 54;
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

const allCommercialPages = [
  ...commercialPages.map((page) => ({ ...page, locale: "en", alternateSlug: page.ruSlug })),
  ...ruCommercialPages.map((page) => ({ ...page, locale: "ru", alternateSlug: page.enSlug })),
];

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

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
  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AdShorts AI",
    url: page.locale === "en" ? `${siteOrigin}/en/` : `${siteOrigin}/`,
    image: logoUrl,
    logo: logoUrl,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    description: page.description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      url: canonical,
    },
  };
  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.h1,
    description: page.description,
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
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };

  return `  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="canonical" href="${canonical}" />
    <link rel="alternate" hreflang="ru" href="${alternateRu(page)}" />
    <link rel="alternate" hreflang="en" href="${alternateEn(page)}" />
    <link rel="alternate" hreflang="x-default" href="${alternateRu(page)}" />
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:image" content="${logoUrl}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:site_name" content="AdShorts AI" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
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
    <script type="application/ld+json">
${renderJsonLd(faq)}
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
        workflow: "How the workflow works",
        why: "Why use AdShorts AI for this",
        loopTitle: "Build this into an organic traffic loop",
        loopText:
          "Treat this page as a production workflow, not a one-off tool page. Pick one search intent, create a short video for it, publish the cleanest version, then improve the next draft from retention and click data.",
        loopEnd: `Start with <a href="${studioHref}?source=${escapeHtml(page.ctaSource)}">AdShorts AI Studio</a>, then compare the result with <a href="${examplesHref}">real examples</a> and the current <a href="${pricingHref}">pricing</a>.`,
        faq: "FAQ",
        readAlso: "Read also",
        contact: "Contact:",
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
        workflow: "Как работает workflow",
        why: "Почему AdShorts AI подходит для этого",
        loopTitle: "Встройте это в цикл органического роста",
        loopText:
          "Относитесь к этой странице как к production-workflow, а не как к разовому инструменту. Выберите один поисковый интент, создайте под него короткое видео, опубликуйте чистую версию и улучшайте следующий черновик по данным удержания и кликов.",
        loopEnd: `Начните в <a href="${studioHref}?source=${escapeHtml(page.ctaSource)}">студии AdShorts AI</a>, затем сравните результат с <a href="${examplesHref}">примерами</a> и актуальными <a href="${pricingHref}">тарифами</a>.`,
        faq: "FAQ",
        readAlso: "Читайте также",
        contact: "Контакты:",
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
          <h1>${escapeHtml(page.h1)}</h1>
          <p class="lead">${escapeHtml(page.lead)}</p>

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
${renderList(page.useCases)}
          </ul>

          <h2>${footerLinks.workflow}</h2>
          <ol>
${renderList(page.workflow)}
          </ol>

          <h2>${footerLinks.why}</h2>
          <ul>
${renderList(page.differentiators)}
          </ul>

          <section class="article-index-boost" aria-labelledby="commercial-next-steps">
            <h2 id="commercial-next-steps">${footerLinks.loopTitle}</h2>
            <p>
              ${footerLinks.loopText}
            </p>
            <ul>
${renderRelated(page.related)}
            </ul>
            <p>
              ${footerLinks.loopEnd}
            </p>
          </section>

          <section class="article-faq" aria-labelledby="commercial-faq">
            <h2 id="commercial-faq">${footerLinks.faq}</h2>
${page.faq.map(([question, answer]) => `            <h3>${escapeHtml(question)}</h3>
            <p>${escapeHtml(answer)}</p>`).join("\n")}
          </section>

          <h2>${footerLinks.readAlso}</h2>
          <ul>
${renderRelated(page.related)}
          </ul>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="container footer__inner">
        <a class="logo" href="${footerHomeHref}">AdShorts<span>AI</span></a>
        <div class="footer__links">
          <span style="color: var(--muted);">${footerLinks.contact} <a href="mailto:support@adshortsai.com" style="color: var(--muted);">support@adshortsai.com</a></span>
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
  const pages = locale === "en" ? commercialPages : ruCommercialPages;
  const title = locale === "en" ? "AI generators" : "AI-генераторы";
  const intro = locale === "en"
    ? "High-intent pages for users who are already looking for a Shorts, Reels or TikTok creation tool."
    : "Коммерческие страницы для пользователей, которые уже ищут инструмент для создания Shorts, Reels или TikTok.";

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

const updateSitemap = async () => {
  const sitemapPath = path.join(rootDir, "sitemap.xml");
  let sitemap = await readFile(sitemapPath, "utf8");

  for (const page of allCommercialPages) {
    const canonical = canonicalFor(page);
    sitemap = sitemap.replace(
      new RegExp(`\\s*<url>\\s*<loc>${escapeRegExp(canonical)}<\\/loc>[\\s\\S]*?<\\/url>`, "g"),
      "",
    );
  }

  const blocks = allCommercialPages
    .map((page) => {
      const canonical = canonicalFor(page);
      return `  <url>
    <loc>${canonical}</loc>
    <xhtml:link rel="alternate" hreflang="ru" href="${alternateRu(page)}" />
    <xhtml:link rel="alternate" hreflang="en" href="${alternateEn(page)}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${alternateRu(page)}" />
    <lastmod>${dateModified}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.74</priority>
  </url>`;
    })
    .join("\n");

  sitemap = sitemap.replace(/\n<\/urlset>\s*$/, `\n${blocks}\n</urlset>\n`);
  await writeFile(sitemapPath, sitemap, "utf8");
};

for (const page of allCommercialPages) {
  const dir = page.locale === "en" ? path.join(rootDir, "en", page.slug) : path.join(rootDir, page.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), renderPage(page), "utf8");
}

await updateGuidesIndex("en");
await updateGuidesIndex("ru");
await updateSitemap();

console.log(
  `Generated ${allCommercialPages.length} commercial SEO pages, updated guides indexes and sitemap lastmod ${dateModified}.`,
);
