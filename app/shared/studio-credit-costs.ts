export type StudioCreditAction =
  | "video_generation"
  | "ai_photo"
  | "ai_video"
  | "photo_animation"
  | "talking_photo"
  | "image_edit"
  | "image_upscale"
  | "scene_sound"
  | "segment_voiceover";

export type StudioSegmentVisualQuality = "standard" | "premium";
export type StudioSegmentPhotoAnimationDurationSeconds = 5 | 8 | 10;

export const STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST = 10;
export const STUDIO_PREMIUM_VIDEO_GENERATION_CREDIT_COST = 20;
export const STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST = 5;
export const STUDIO_PREMIUM_VOICE_CREDIT_COST = 5;
export const STUDIO_VIDEO_GENERATION_CREDIT_COST = STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST;
export const STUDIO_SEGMENT_AI_VIDEO_STANDARD_CREDIT_COST = 7;
export const STUDIO_SEGMENT_AI_VIDEO_PREMIUM_CREDIT_COST = 15;
export const STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST = STUDIO_SEGMENT_AI_VIDEO_STANDARD_CREDIT_COST;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_5S_CREDIT_COST = 5;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_8S_CREDIT_COST = 8;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_5S_CREDIT_COST = 10;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_10S_CREDIT_COST = 20;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_CREDIT_COST = STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_5S_CREDIT_COST;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_CREDIT_COST = STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_5S_CREDIT_COST;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST = STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_CREDIT_COST;
export const STUDIO_SEGMENT_TALKING_PHOTO_CREDIT_COST = 10;
export const STUDIO_SEGMENT_TALKING_PHOTO_CREDITS_PER_SECOND = 2;
export const STUDIO_SEGMENT_TALKING_PHOTO_WORDS_PER_SECOND = 2.2;
export const STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST = 5;
export const STUDIO_SEGMENT_AI_PHOTO_STANDARD_CREDIT_COST = 2;
export const STUDIO_SEGMENT_AI_PHOTO_PREMIUM_CREDIT_COST = 4;
export const STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST = STUDIO_SEGMENT_AI_PHOTO_STANDARD_CREDIT_COST;
export const STUDIO_WORKSPACE_CHARACTER_REFERENCE_CREDIT_COST = 10;
export const STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST = 1;
export const STUDIO_SEGMENT_SCENE_SOUND_CREDIT_COST = 1;
export const STUDIO_SEGMENT_VOICEOVER_CREDIT_COST = 1;
export const STUDIO_SEGMENT_PREMIUM_VOICEOVER_CREDIT_COST = 5;
export const STUDIO_PREMIUM_VOICE_IDS = [
  "Liam",
  "Liam_Timing",
  "Elena",
  "English_ManWithDeepVoice",
  "Russian_BrightHeroine",
] as const;

export const STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST_BY_QUALITY: Record<StudioSegmentVisualQuality, number> = {
  premium: STUDIO_SEGMENT_AI_PHOTO_PREMIUM_CREDIT_COST,
  standard: STUDIO_SEGMENT_AI_PHOTO_STANDARD_CREDIT_COST,
};

export const STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST_BY_QUALITY: Record<StudioSegmentVisualQuality, number> = {
  premium: STUDIO_SEGMENT_AI_VIDEO_PREMIUM_CREDIT_COST,
  standard: STUDIO_SEGMENT_AI_VIDEO_STANDARD_CREDIT_COST,
};

export const STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST_BY_QUALITY: Record<StudioSegmentVisualQuality, number> = {
  premium: STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_CREDIT_COST,
  standard: STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_CREDIT_COST,
};

export const STUDIO_SEGMENT_PHOTO_ANIMATION_DURATION_OPTIONS_BY_QUALITY: Record<
  StudioSegmentVisualQuality,
  StudioSegmentPhotoAnimationDurationSeconds[]
> = {
  premium: [5, 10],
  standard: [5, 8],
};

export const STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST_BY_QUALITY_AND_DURATION: Record<
  StudioSegmentVisualQuality,
  Partial<Record<StudioSegmentPhotoAnimationDurationSeconds, number>>
> = {
  premium: {
    5: STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_5S_CREDIT_COST,
    10: STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_10S_CREDIT_COST,
  },
  standard: {
    5: STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_5S_CREDIT_COST,
    8: STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_8S_CREDIT_COST,
  },
};

export const getStudioSegmentPhotoAnimationDurationOptions = (
  quality: StudioSegmentVisualQuality,
): StudioSegmentPhotoAnimationDurationSeconds[] =>
  STUDIO_SEGMENT_PHOTO_ANIMATION_DURATION_OPTIONS_BY_QUALITY[quality] ??
  STUDIO_SEGMENT_PHOTO_ANIMATION_DURATION_OPTIONS_BY_QUALITY.standard;

export const normalizeStudioSegmentPhotoAnimationDurationSeconds = (
  quality: StudioSegmentVisualQuality,
  durationSeconds: unknown,
): StudioSegmentPhotoAnimationDurationSeconds => {
  const options = getStudioSegmentPhotoAnimationDurationOptions(quality);
  const numeric = Number(durationSeconds);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return options[0] ?? 5;
  }

  const rounded = Math.round(numeric);
  if (options.includes(rounded as StudioSegmentPhotoAnimationDurationSeconds)) {
    return rounded as StudioSegmentPhotoAnimationDurationSeconds;
  }

  const [shortDuration, longDuration] = options;
  if (!shortDuration || !longDuration) {
    return shortDuration ?? 5;
  }

  return numeric > (shortDuration + longDuration) / 2 ? longDuration : shortDuration;
};

export const getStudioSegmentPhotoAnimationCreditCost = (
  quality: StudioSegmentVisualQuality,
  durationSeconds: unknown,
): number => {
  const normalizedDurationSeconds = normalizeStudioSegmentPhotoAnimationDurationSeconds(quality, durationSeconds);
  return (
    STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST_BY_QUALITY_AND_DURATION[quality]?.[normalizedDurationSeconds] ??
    STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST_BY_QUALITY[quality] ??
    STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST
  );
};

export const getStudioSegmentVoiceoverCreditCost = (voiceId: string | null | undefined): number => {
  const normalizedVoiceId = String(voiceId ?? "").trim();
  if (!normalizedVoiceId || normalizedVoiceId.toLowerCase() === "none") {
    return 0;
  }

  const normalizedVoiceKey = normalizedVoiceId.toLowerCase();
  return STUDIO_PREMIUM_VOICE_IDS.some((premiumVoiceId) => premiumVoiceId.toLowerCase() === normalizedVoiceKey)
    ? STUDIO_SEGMENT_PREMIUM_VOICEOVER_CREDIT_COST
    : STUDIO_SEGMENT_VOICEOVER_CREDIT_COST;
};

export const getStudioSegmentTalkingPhotoCreditCostForDuration = (durationSeconds: unknown): number => {
  const duration = Number(durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) {
    return STUDIO_SEGMENT_TALKING_PHOTO_CREDIT_COST;
  }

  return Math.max(
    STUDIO_SEGMENT_TALKING_PHOTO_CREDIT_COST,
    Math.ceil(duration * STUDIO_SEGMENT_TALKING_PHOTO_CREDITS_PER_SECOND),
  );
};

export const estimateStudioSegmentTalkingPhotoScriptDurationSeconds = (
  script: string | null | undefined,
): number => {
  const normalizedScript = String(script ?? "").trim();
  if (!normalizedScript) {
    return 0;
  }

  const words = normalizedScript.match(/[0-9A-Za-zА-Яа-яЁё]+/g) ?? [];
  if (words.length > 0) {
    return words.length / STUDIO_SEGMENT_TALKING_PHOTO_WORDS_PER_SECOND;
  }

  return normalizedScript.replace(/\s+/g, "").length / 14;
};

export const getStudioSegmentTalkingPhotoCreditCost = (
  script: string | null | undefined,
): number => {
  const normalizedScript = String(script ?? "").trim();
  if (!normalizedScript) {
    return 0;
  }

  return getStudioSegmentTalkingPhotoCreditCostForDuration(
    estimateStudioSegmentTalkingPhotoScriptDurationSeconds(normalizedScript),
  );
};

export const STUDIO_CREDIT_COST_BY_ACTION: Record<StudioCreditAction, number> = {
  video_generation: STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST,
  ai_photo: STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST,
  ai_video: STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST,
  photo_animation: STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST,
  talking_photo: STUDIO_SEGMENT_TALKING_PHOTO_CREDIT_COST,
  image_edit: STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST,
  image_upscale: STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST,
  scene_sound: STUDIO_SEGMENT_SCENE_SOUND_CREDIT_COST,
  segment_voiceover: STUDIO_SEGMENT_VOICEOVER_CREDIT_COST,
};
