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

const studioMusicPreviewTracksByType: Partial<Record<StudioMusicType, readonly string[]>> = {
  business: [
    "business_1.mp3",
    "business_2.mp3",
    "business_3.mp3",
    "business_4.mp3",
    "business_5.mp3",
    "business_6.mp3",
    "business_7.mp3",
    "business_8.mp3",
    "business_9.mp3",
    "business_10.mp3",
    "business_11.mp3",
    "business_12.mp3",
    "business_13.mp3",
    "business_14.mp3",
    "business_15.mp3",
    "business_16.mp3",
    "business_17.mp3",
    "business_18.mp3",
    "business_19.mp3",
    "business_20.mp3",
  ],
  calm: [
    "calm_1.mp3",
    "calm_2.mp3",
    "calm_3.mp3",
    "calm_4.mp3",
    "calm_5.mp3",
    "calm_6.mp3",
    "calm_7.mp3",
    "calm_8.mp3",
    "calm_9.mp3",
    "calm_10.mp3",
    "calm_11.mp3",
    "calm_12.mp3",
    "calm_13.mp3",
    "calm_14.mp3",
    "calm_15.mp3",
    "calm_16.mp3",
    "calm_17.mp3",
    "calm_18.mp3",
    "calm_19.mp3",
    "calm_20.mp3",
  ],
  energetic: [
    "energetic_1.mp3",
    "energetic_2.mp3",
    "energetic_3.mp3",
    "energetic_4.mp3",
    "energetic_5.mp3",
    "energetic_6.mp3",
    "energetic_7.mp3",
    "energetic_8.mp3",
    "energetic_9.mp3",
    "energetic_10.mp3",
    "energetic_11.mp3",
    "energetic_12.mp3",
    "energetic_13.mp3",
    "energetic_14.mp3",
    "energetic_15.mp3",
    "energetic_16.mp3",
    "energetic_17.mp3",
    "energetic_18.mp3",
    "energetic_19.mp3",
    "energetic_20.mp3",
  ],
  dramatic: [
    "dramatic_1.mp3",
    "dramatic_2.mp3",
    "dramatic_3.mp3",
    "dramatic_4.mp3",
    "dramatic_5.mp3",
    "dramatic_6.mp3",
    "dramatic_7.mp3",
    "dramatic_8.mp3",
    "dramatic_9.mp3",
    "dramatic_10.mp3",
    "dramatic_11.mp3",
    "dramatic_12.mp3",
    "dramatic_13.mp3",
    "dramatic_14.mp3",
    "dramatic_15.mp3",
    "dramatic_16.mp3",
    "dramatic_17.mp3",
    "dramatic_18.mp3",
    "dramatic_19.mp3",
    "dramatic_20.mp3",
  ],
  fun: [
    "fun_1.mp3",
    "fun_2.mp3",
    "fun_3.mp3",
    "fun_4.mp3",
    "fun_5.mp3",
    "fun_6.mp3",
    "fun_7.mp3",
    "fun_8.mp3",
    "fun_9.mp3",
    "fun_10.mp3",
    "fun_11.mp3",
    "fun_12.mp3",
    "fun_13.mp3",
    "fun_14.mp3",
    "fun_15.mp3",
    "fun_16.mp3",
    "fun_17.mp3",
    "fun_18.mp3",
    "fun_19.mp3",
    "fun_20.mp3",
  ],
  inspirational: [
    "inspirational_1.mp3",
    "inspirational_2.mp3",
    "inspirational_3.mp3",
    "inspirational_4.mp3",
    "inspirational_5.mp3",
    "inspirational_6.mp3",
    "inspirational_7.mp3",
    "inspirational_8.mp3",
    "inspirational_9.mp3",
    "inspirational_10.mp3",
    "inspirational_11.mp3",
    "inspirational_12.mp3",
    "inspirational_13.mp3",
    "inspirational_14.mp3",
    "inspirational_15.mp3",
    "inspirational_16.mp3",
    "inspirational_17.mp3",
    "inspirational_18.mp3",
    "inspirational_19.mp3",
    "inspirational_20.mp3",
  ],
  luxury: [
    "luxury_1.mp3",
    "luxury_2.mp3",
    "luxury_3.mp3",
    "luxury_4.mp3",
    "luxury_5.mp3",
    "luxury_6.mp3",
    "luxury_7.mp3",
    "luxury_8.mp3",
    "luxury_9.mp3",
    "luxury_10.mp3",
    "luxury_11.mp3",
    "luxury_12.mp3",
    "luxury_13.mp3",
    "luxury_14.mp3",
    "luxury_15.mp3",
    "luxury_16.mp3",
    "luxury_17.mp3",
    "luxury_18.mp3",
    "luxury_19.mp3",
    "luxury_20.mp3",
  ],
  tech: [
    "tech_1.mp3",
    "tech_2.mp3",
    "tech_3.mp3",
    "tech_4.mp3",
    "tech_5.mp3",
    "tech_6.mp3",
    "tech_7.mp3",
    "tech_8.mp3",
    "tech_9.mp3",
    "tech_10.mp3",
    "tech_11.mp3",
    "tech_12.mp3",
    "tech_13.mp3",
    "tech_14.mp3",
    "tech_15.mp3",
    "tech_16.mp3",
    "tech_17.mp3",
    "tech_18.mp3",
    "tech_19.mp3",
    "tech_20.mp3",
  ],
  upbeat: [
    "upbeat_1.mp3",
    "upbeat_2.mp3",
    "upbeat_3.mp3",
    "upbeat_4.mp3",
    "upbeat_5.mp3",
    "upbeat_6.mp3",
    "upbeat_7.mp3",
    "upbeat_8.mp3",
    "upbeat_9.mp3",
    "upbeat_10.mp3",
    "upbeat_11.mp3",
    "upbeat_12.mp3",
    "upbeat_13.mp3",
    "upbeat_14.mp3",
    "upbeat_15.mp3",
    "upbeat_16.mp3",
    "upbeat_17.mp3",
    "upbeat_18.mp3",
    "upbeat_19.mp3",
    "upbeat_20.mp3",
  ],
};

export const getStudioMusicPreviewTrackName = (musicType: string | null | undefined) =>
  studioMusicPreviewTracksByType[String(musicType ?? "").trim().toLowerCase() as StudioMusicType]?.[0] ?? null;

export const pickStudioMusicPreviewTrackName = (musicType: string | null | undefined) => {
  const tracks = studioMusicPreviewTracksByType[String(musicType ?? "").trim().toLowerCase() as StudioMusicType] ?? [];
  if (tracks.length === 0) {
    return null;
  }

  return tracks[Math.floor(Math.random() * tracks.length)] ?? null;
};

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
