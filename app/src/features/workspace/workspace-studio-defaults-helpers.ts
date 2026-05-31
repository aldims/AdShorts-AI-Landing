import type { ExamplePrefillStudioSettings } from "../../../shared/example-prefill";
import { DEFAULT_STUDIO_VOICE_ID } from "../../../shared/locales";
import type { Locale } from "../../lib/i18n";
import { STUDIO_BRAND_TEXT_MAX_CHARS } from "./workspace-brand-helpers";
import {
  getStudioLanguageForVoiceId,
  normalizeStudioLanguageValue,
  studioVideoOptions,
  studioVoiceOptionsByLanguage,
} from "./workspace-segment-editor";
import { studioMusicOptions, type StudioMusicType } from "./workspace-studio-options";
import type {
  StudioLanguage,
  StudioSubtitleColorOption,
  StudioSubtitleStyleOption,
  StudioVideoMode,
  StudioVoiceOption,
} from "./workspace-types";

export const getStudioVoiceOptionById = (voiceId: string | null | undefined): StudioVoiceOption | null => {
  const normalizedVoiceKey = String(voiceId ?? "").trim().toLowerCase();
  if (!normalizedVoiceKey || normalizedVoiceKey === "none") {
    return null;
  }

  for (const voiceOptions of Object.values(studioVoiceOptionsByLanguage)) {
    const voice = voiceOptions.find((option) => option.id.toLowerCase() === normalizedVoiceKey);
    if (voice) {
      return voice;
    }
  }

  return null;
};

export const getDefaultStudioVoiceId = (language: StudioLanguage): StudioVoiceOption["id"] =>
  DEFAULT_STUDIO_VOICE_ID[language] ?? studioVoiceOptionsByLanguage[language][0]?.id ?? "Bys_24000";

export const resolveStudioVoiceIdForLanguage = (
  language: StudioLanguage,
  voiceId: string | null | undefined,
  fallbackVoiceId?: string | null | undefined,
): StudioVoiceOption["id"] => {
  const requestedVoiceKey = String(voiceId ?? "").trim().toLowerCase();
  const fallbackVoiceKey = String(fallbackVoiceId ?? "").trim().toLowerCase();
  return (
    studioVoiceOptionsByLanguage[language].find((voice) => voice.id.toLowerCase() === requestedVoiceKey)?.id ??
    studioVoiceOptionsByLanguage[language].find((voice) => voice.id.toLowerCase() === fallbackVoiceKey)?.id ??
    getDefaultStudioVoiceId(language)
  );
};

export const getWorkspaceInitialStudioDefaults = (
  locale: Locale,
): { language: StudioLanguage; voiceId: StudioVoiceOption["id"] } => {
  const language = normalizeStudioLanguageValue(locale) ?? "ru";
  return {
    language,
    voiceId: getDefaultStudioVoiceId(language),
  };
};

export type WorkspaceExamplePrefillInitialStudioState = {
  brandText: string;
  language: StudioLanguage;
  musicType: StudioMusicType;
  subtitleColorId: StudioSubtitleColorOption["id"];
  subtitleEnabled: boolean;
  subtitleStyleId: StudioSubtitleStyleOption["id"];
  videoMode: StudioVideoMode;
  voiceEnabled: boolean;
  voiceId: StudioVoiceOption["id"];
};

const normalizeWorkspaceExamplePrefillString = (value: unknown) => String(value ?? "").trim();

const resolveWorkspaceExamplePrefillInitialMusicType = (
  settings: ExamplePrefillStudioSettings | null | undefined,
): StudioMusicType => {
  const requestedMusicType = normalizeWorkspaceExamplePrefillString(settings?.musicType);
  if (requestedMusicType && requestedMusicType !== "custom") {
    return studioMusicOptions.find((option) => option.id === requestedMusicType)?.id ?? "ai";
  }

  return "ai";
};

const resolveWorkspaceExamplePrefillInitialVideoMode = (
  settings: ExamplePrefillStudioSettings | null | undefined,
): StudioVideoMode => {
  const requestedVideoMode = normalizeWorkspaceExamplePrefillString(settings?.videoMode);
  if (requestedVideoMode && requestedVideoMode !== "custom") {
    return studioVideoOptions.find((option) => option.id === requestedVideoMode)?.id ?? "standard";
  }

  return "standard";
};

export const resolveWorkspaceExamplePrefillInitialStudioState = (options: {
  prefillSettings?: ExamplePrefillStudioSettings | null;
  routeDefaults: { language: StudioLanguage; voiceId: StudioVoiceOption["id"] };
}): WorkspaceExamplePrefillInitialStudioState => {
  const settings = options.prefillSettings ?? null;
  const routeDefaults = options.routeDefaults;
  const requestedVoiceId = normalizeWorkspaceExamplePrefillString(settings?.voiceId);
  const requestedVoiceLanguage = getStudioLanguageForVoiceId(requestedVoiceId);
  const requestedLanguage = normalizeStudioLanguageValue(settings?.language);
  const language = requestedLanguage ?? requestedVoiceLanguage ?? routeDefaults.language;
  const voiceId = requestedVoiceId
    ? resolveStudioVoiceIdForLanguage(language, requestedVoiceId, routeDefaults.voiceId)
    : resolveStudioVoiceIdForLanguage(language, routeDefaults.voiceId);
  const subtitleStyleId = normalizeWorkspaceExamplePrefillString(settings?.subtitleStyleId) || "modern";
  const subtitleColorId = normalizeWorkspaceExamplePrefillString(settings?.subtitleColorId) || "purple";
  const brandText = normalizeWorkspaceExamplePrefillString(settings?.brandText).slice(0, STUDIO_BRAND_TEXT_MAX_CHARS);
  const voiceEnabled = typeof settings?.voiceEnabled === "boolean" ? settings.voiceEnabled : true;
  const subtitleEnabled = voiceEnabled && (typeof settings?.subtitleEnabled === "boolean" ? settings.subtitleEnabled : true);

  return {
    brandText,
    language,
    musicType: resolveWorkspaceExamplePrefillInitialMusicType(settings),
    subtitleColorId,
    subtitleEnabled,
    subtitleStyleId,
    videoMode: resolveWorkspaceExamplePrefillInitialVideoMode(settings),
    voiceEnabled,
    voiceId,
  };
};
