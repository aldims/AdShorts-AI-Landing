export type StudioMusicType =
  | "ai"
  | "business"
  | "calm"
  | "custom"
  | "dramatic"
  | "energetic"
  | "fun"
  | "inspirational"
  | "luxury"
  | "none"
  | "tech"
  | "upbeat";

export type StudioMusicOption = {
  description: string;
  id: StudioMusicType;
  label: string;
};

export const studioMusicOptions: StudioMusicOption[] = [
  {
    id: "ai",
    label: "Авто",
    description: "AI подберет музыку под ролик",
  },
  {
    id: "energetic",
    label: "Энергичная",
    description: "Для динамичных и продажных Shorts",
  },
  {
    id: "calm",
    label: "Спокойная",
    description: "Для экспертной подачи и размеренного темпа",
  },
  {
    id: "business",
    label: "Деловая",
    description: "Для продуктов, сервисов и B2B-подачи",
  },
  {
    id: "upbeat",
    label: "Оптимистичная",
    description: "Для легких продающих и lifestyle роликов",
  },
  {
    id: "inspirational",
    label: "Вдохновляющая",
    description: "Для историй, роста и мотивационных тем",
  },
  {
    id: "dramatic",
    label: "Драматичная",
    description: "Для сильного хука и эмоционального накала",
  },
  {
    id: "tech",
    label: "Технологичная",
    description: "Для AI, SaaS и цифровых продуктов",
  },
  {
    id: "luxury",
    label: "Люксовая",
    description: "Для премиальных брендов и дорогой подачи",
  },
  {
    id: "fun",
    label: "Веселая",
    description: "Для UGC, мемов и вирусных форматов",
  },
  {
    id: "custom",
    label: "Своя музыка",
    description: "Загрузите свой .mp3, .wav или .m4a",
  },
  {
    id: "none",
    label: "Без музыки",
    description: "Оставить только голос и видео",
  },
];
export const studioMusicStyleOptions = studioMusicOptions.filter(
  (option): option is StudioMusicOption & { id: Exclude<StudioMusicType, "ai" | "custom" | "none"> } =>
    !["ai", "custom", "none"].includes(option.id),
);
const studioMusicOptionEnglishCopy: Record<StudioMusicType, Pick<StudioMusicOption, "description" | "label">> = {
  ai: { label: "Auto", description: "AI picks music for the video" },
  business: { label: "Business", description: "For products, services and B2B delivery" },
  calm: { label: "Calm", description: "For expert delivery and a measured pace" },
  custom: { label: "Custom music", description: "Upload your .mp3, .wav or .m4a" },
  dramatic: { label: "Dramatic", description: "For a strong hook and emotional intensity" },
  energetic: { label: "Energetic", description: "For dynamic and sales-oriented Shorts" },
  fun: { label: "Fun", description: "For UGC, memes and viral formats" },
  inspirational: { label: "Inspirational", description: "For stories, growth and motivational topics" },
  luxury: { label: "Luxury", description: "For premium brands and expensive positioning" },
  none: { label: "No music", description: "Keep only voice and video" },
  tech: { label: "Tech", description: "For AI, SaaS and digital products" },
  upbeat: { label: "Upbeat", description: "For light sales and lifestyle videos" },
};

export const getStudioMusicOptionCopy = (option: StudioMusicOption, locale: string) =>
  locale === "en" ? studioMusicOptionEnglishCopy[option.id] ?? option : option;
