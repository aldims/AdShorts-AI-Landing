export type StudioCreditAction =
  | "video_generation"
  | "ai_photo"
  | "ai_video"
  | "photo_animation"
  | "talking_photo"
  | "image_edit"
  | "image_upscale"
  | "infographic"
  | "scene_sound"
  | "segment_voiceover";

export type StudioSegmentVisualQuality = "standard" | "premium";
export type StudioSegmentPhotoAnimationDurationSeconds = 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type StudioSegmentSeedanceDurationMode = "voiceover" | "manual";

export const STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST = 10;
export const STUDIO_AI_PHOTO_VIDEO_GENERATION_CREDIT_COST = 10;
export const STUDIO_AI_VIDEO_GENERATION_CREDIT_COST = 80;
export const STUDIO_PREMIUM_VIDEO_GENERATION_CREDIT_COST = STUDIO_AI_PHOTO_VIDEO_GENERATION_CREDIT_COST;
export const STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST = 5;
export const STUDIO_PREMIUM_VOICE_CREDIT_COST = 0;
export const STUDIO_VIDEO_GENERATION_CREDIT_COST = STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST;
export const STUDIO_SEGMENT_SEEDANCE_MIN_DURATION_SECONDS = 4;
export const STUDIO_SEGMENT_SEEDANCE_MAX_DURATION_SECONDS = 12;
export const STUDIO_SEGMENT_SEEDANCE_DEFAULT_DURATION_SECONDS = 5;
export const STUDIO_SEGMENT_SEEDANCE_CREDITS_PER_SECOND = 3;
export const STUDIO_SEGMENT_SEEDANCE_AUDIO_CREDITS_PER_SECOND = 1;
export const STUDIO_SEGMENT_AI_VIDEO_STANDARD_CREDIT_COST = 15;
export const STUDIO_SEGMENT_AI_VIDEO_PREMIUM_CREDIT_COST = 15;
export const STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST = STUDIO_SEGMENT_AI_VIDEO_STANDARD_CREDIT_COST;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_5S_CREDIT_COST = 15;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_8S_CREDIT_COST = 24;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_5S_CREDIT_COST = 15;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_10S_CREDIT_COST = 30;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_CREDIT_COST = STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_5S_CREDIT_COST;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_CREDIT_COST = STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_5S_CREDIT_COST;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST = STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_CREDIT_COST;
export const STUDIO_SEGMENT_TALKING_PHOTO_CREDIT_COST = 10;
export const STUDIO_SEGMENT_TALKING_PHOTO_CREDITS_PER_SECOND = 2;
export const STUDIO_SEGMENT_TALKING_PHOTO_WORDS_PER_SECOND = 2.2;
export const STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST = 5;
export const STUDIO_SEGMENT_AI_PHOTO_STANDARD_CREDIT_COST = 2;
export const STUDIO_SEGMENT_AI_PHOTO_PREMIUM_CREDIT_COST = 2;
export const STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST = STUDIO_SEGMENT_AI_PHOTO_STANDARD_CREDIT_COST;
export const STUDIO_WORKSPACE_CHARACTER_REFERENCE_CREDIT_COST = 10;
export const STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST = 1;
export const STUDIO_SEGMENT_INFOGRAPHIC_CREDIT_COST = 2;
export const STUDIO_SEGMENT_SCENE_SOUND_CREDIT_COST_PER_5_SECONDS = 2;
export const STUDIO_SEGMENT_SCENE_SOUND_CREDIT_COST = STUDIO_SEGMENT_SCENE_SOUND_CREDIT_COST_PER_5_SECONDS;
export const STUDIO_SEGMENT_VOICEOVER_CREDIT_COST = 1;
export const STUDIO_SEGMENT_PREMIUM_VOICEOVER_CREDIT_COST = STUDIO_SEGMENT_VOICEOVER_CREDIT_COST;
export const STUDIO_VOICEOVER_CHARACTERS_PER_CREDIT = 100;
export const STUDIO_SEGMENT_VOICEOVER_MAX_TEXT_CHARS = 200;

export const getStudioSegmentSceneSoundCreditCost = (durationSeconds: number | null | undefined) => {
  const normalizedDuration = Number.isFinite(durationSeconds) ? Math.max(0, Number(durationSeconds)) : 0;
  const fiveSecondBlocks = Math.max(1, Math.ceil(normalizedDuration / 5));
  return fiveSecondBlocks * STUDIO_SEGMENT_SCENE_SOUND_CREDIT_COST_PER_5_SECONDS;
};
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
  premium: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  standard: [4, 5, 6, 7, 8, 9, 10, 11, 12],
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
  _quality: StudioSegmentVisualQuality,
  durationSeconds: unknown,
): StudioSegmentPhotoAnimationDurationSeconds => {
  const numeric = Number(durationSeconds);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return STUDIO_SEGMENT_SEEDANCE_DEFAULT_DURATION_SECONDS;
  }
  return Math.min(
    STUDIO_SEGMENT_SEEDANCE_MAX_DURATION_SECONDS,
    Math.max(STUDIO_SEGMENT_SEEDANCE_MIN_DURATION_SECONDS, Math.ceil(numeric)),
  ) as StudioSegmentPhotoAnimationDurationSeconds;
};

export const resolveStudioSegmentSeedanceDurationSeconds = (options: {
  durationMode?: StudioSegmentSeedanceDurationMode | null;
  manualDurationSeconds?: unknown;
  voiceoverDurationSeconds?: unknown;
}): StudioSegmentPhotoAnimationDurationSeconds => {
  const voiceoverDuration = Number(options.voiceoverDurationSeconds);
  const hasVoiceoverDuration = Number.isFinite(voiceoverDuration) && voiceoverDuration > 0;
  const sourceDuration = options.durationMode !== "manual" && hasVoiceoverDuration
    ? voiceoverDuration
    : options.durationMode === "manual"
      ? options.manualDurationSeconds
      : STUDIO_SEGMENT_SEEDANCE_DEFAULT_DURATION_SECONDS;
  return normalizeStudioSegmentPhotoAnimationDurationSeconds("premium", sourceDuration);
};

export const getStudioSegmentSeedanceAudioCreditCost = (
  durationSeconds: unknown,
  generateAudio = false,
): number =>
  generateAudio
    ? normalizeStudioSegmentPhotoAnimationDurationSeconds("premium", durationSeconds) *
      STUDIO_SEGMENT_SEEDANCE_AUDIO_CREDITS_PER_SECOND
    : 0;

export const getStudioSegmentAiVideoCreditCost = (
  durationSeconds: unknown,
  generateAudio = false,
): number => {
  const normalizedDurationSeconds = normalizeStudioSegmentPhotoAnimationDurationSeconds("premium", durationSeconds);
  return (
    normalizedDurationSeconds * STUDIO_SEGMENT_SEEDANCE_CREDITS_PER_SECOND +
    getStudioSegmentSeedanceAudioCreditCost(normalizedDurationSeconds, generateAudio)
  );
};

export const getStudioSegmentPhotoAnimationCreditCost = (
  _quality: StudioSegmentVisualQuality,
  durationSeconds: unknown,
  generateAudio = false,
): number => {
  return getStudioSegmentAiVideoCreditCost(durationSeconds, generateAudio);
};

export const getStudioSegmentVoiceoverCreditCost = (voiceId: string | null | undefined): number => {
  const normalizedVoiceId = String(voiceId ?? "").trim();
  if (!normalizedVoiceId || normalizedVoiceId.toLowerCase() === "none") {
    return 0;
  }

  return STUDIO_SEGMENT_VOICEOVER_CREDIT_COST;
};

export const normalizeStudioVoiceoverBillingText = (text: string | null | undefined): string =>
  String(text ?? "").trim().replace(/\s+/gu, " ");

export const getStudioVoiceoverCharacterCount = (text: string | null | undefined): number =>
  Array.from(normalizeStudioVoiceoverBillingText(text)).length;

export const getStudioVoiceoverCreditCostForText = (text: string | null | undefined): number => {
  const characterCount = getStudioVoiceoverCharacterCount(text);
  return characterCount > 0 ? Math.ceil(characterCount / STUDIO_VOICEOVER_CHARACTERS_PER_CREDIT) : 0;
};

export const buildStudioVoiceoverProviderText = (
  segmentTexts: Array<string | null | undefined>,
): string =>
  segmentTexts
    .map(normalizeStudioVoiceoverBillingText)
    .filter(Boolean)
    .map((text) => (/[.!?…]$/u.test(text) ? text : `${text}.`))
    .join(" ");

export type StudioBatchVoiceoverBillingGroup = {
  language?: string | null;
  segments?: Array<{
    segmentIndex?: number | null;
    text?: string | null;
  }> | null;
  voiceType?: string | null;
};

export type StudioBatchVoiceoverBillingRun = {
  characterCount: number;
  creditCost: number;
  language: string;
  segmentIndexes: number[];
  text: string;
  voiceType: string;
};

export const buildStudioBatchVoiceoverBillingRuns = (
  groups: StudioBatchVoiceoverBillingGroup[] | null | undefined,
): StudioBatchVoiceoverBillingRun[] => {
  const targets = (groups ?? [])
    .flatMap((group) => {
      const language = String(group.language ?? "").trim().toLowerCase();
      const voiceType = String(group.voiceType ?? "").trim();
      if (!voiceType || voiceType.toLowerCase() === "none") {
        return [];
      }

      const fingerprint = `${language}:${voiceType.toLowerCase()}`;
      return (group.segments ?? []).flatMap((segment, position) => {
        const text = normalizeStudioVoiceoverBillingText(segment.text);
        if (!text) {
          return [];
        }
        const rawSegmentIndex = Number(segment.segmentIndex);
        const segmentIndex = Number.isInteger(rawSegmentIndex) && rawSegmentIndex >= 0
          ? rawSegmentIndex
          : position;
        return [{ fingerprint, language, segmentIndex, text, voiceType }];
      });
    })
    .sort((left, right) => left.segmentIndex - right.segmentIndex);

  const runs: Array<{
    fingerprint: string;
    language: string;
    segmentIndexes: number[];
    texts: string[];
    voiceType: string;
  }> = [];
  const seenSegmentIndexes = new Set<number>();
  for (const target of targets) {
    if (seenSegmentIndexes.has(target.segmentIndex)) {
      continue;
    }
    seenSegmentIndexes.add(target.segmentIndex);

    const previousRun = runs[runs.length - 1];
    if (previousRun?.fingerprint === target.fingerprint) {
      previousRun.segmentIndexes.push(target.segmentIndex);
      previousRun.texts.push(target.text);
      continue;
    }

    runs.push({
      fingerprint: target.fingerprint,
      language: target.language,
      segmentIndexes: [target.segmentIndex],
      texts: [target.text],
      voiceType: target.voiceType,
    });
  }

  return runs.map((run) => {
    const text = buildStudioVoiceoverProviderText(run.texts);
    return {
      characterCount: getStudioVoiceoverCharacterCount(text),
      creditCost: getStudioVoiceoverCreditCostForText(text),
      language: run.language,
      segmentIndexes: run.segmentIndexes,
      text,
      voiceType: run.voiceType,
    };
  });
};

export const getStudioBatchVoiceoverCreditCost = (
  groups: StudioBatchVoiceoverBillingGroup[] | null | undefined,
): number =>
  buildStudioBatchVoiceoverBillingRuns(groups).reduce((total, run) => total + run.creditCost, 0);

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
  infographic: STUDIO_SEGMENT_INFOGRAPHIC_CREDIT_COST,
  scene_sound: STUDIO_SEGMENT_SCENE_SOUND_CREDIT_COST,
  segment_voiceover: STUDIO_SEGMENT_VOICEOVER_CREDIT_COST,
};
