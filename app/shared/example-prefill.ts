import { isSupportedLocale, type Locale } from "./locales.js";

export type ExamplePrefillStudioLanguage = Locale;

export type ExamplePrefillStudioMusicType =
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

export type ExamplePrefillStudioVideoMode = "ai_photo" | "ai_video" | "custom" | "standard";

export type ExamplePrefillStudioSettings = {
  brandText?: string;
  language?: ExamplePrefillStudioLanguage;
  musicType?: ExamplePrefillStudioMusicType;
  subtitleColorId?: string;
  subtitleEnabled?: boolean;
  subtitleStyleId?: string;
  videoMode?: ExamplePrefillStudioVideoMode;
  voiceEnabled?: boolean;
  voiceId?: string;
};

export type ExamplePrefillIntent = {
  exampleId: string;
  prompt: string;
  settings?: ExamplePrefillStudioSettings | null;
};

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

export const normalizeExamplePrefillStudioSettings = (
  value: unknown,
): ExamplePrefillStudioSettings | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const settings: ExamplePrefillStudioSettings = {};
  const language = normalizeText(payload.language);
  const musicType = normalizeText(payload.musicType);
  const subtitleColorId = normalizeText(payload.subtitleColorId);
  const subtitleStyleId = normalizeText(payload.subtitleStyleId);
  const videoMode = normalizeText(payload.videoMode);
  const voiceId = normalizeText(payload.voiceId);
  const brandText = normalizeText(payload.brandText);

  if (isSupportedLocale(language)) {
    settings.language = language;
  }

  if (musicType) {
    settings.musicType = musicType as ExamplePrefillStudioMusicType;
  }

  if (subtitleColorId) {
    settings.subtitleColorId = subtitleColorId;
  }

  if (typeof payload.subtitleEnabled === "boolean") {
    settings.subtitleEnabled = payload.subtitleEnabled;
  }

  if (subtitleStyleId) {
    settings.subtitleStyleId = subtitleStyleId;
  }

  if (videoMode) {
    settings.videoMode = videoMode as ExamplePrefillStudioVideoMode;
  }

  if (typeof payload.voiceEnabled === "boolean") {
    settings.voiceEnabled = payload.voiceEnabled;
  }

  if (voiceId) {
    settings.voiceId = voiceId;
  }

  if (brandText) {
    settings.brandText = brandText;
  }

  return Object.keys(settings).length ? settings : null;
};

export const normalizeExamplePrefillIntent = (value: unknown): ExamplePrefillIntent | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const exampleId = normalizeText(payload.exampleId);
  const prompt = normalizeText(payload.prompt);

  if (!exampleId || !prompt) {
    return null;
  }

  return {
    exampleId,
    prompt,
    settings: normalizeExamplePrefillStudioSettings(payload.settings),
  };
};
