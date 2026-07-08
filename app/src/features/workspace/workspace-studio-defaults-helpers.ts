import type { ExamplePrefillStudioSettings } from "../../../shared/example-prefill";
import { DEFAULT_STUDIO_VOICE_ID } from "../../../shared/locales";
import type { Locale } from "../../lib/i18n";
import { STUDIO_BRAND_TEXT_MAX_CHARS } from "./workspace-brand-helpers";
import {
  getCanonicalStudioVoiceOptionId,
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
  const canonicalVoiceId = getCanonicalStudioVoiceOptionId(voiceId);
  if (!canonicalVoiceId) {
    return null;
  }

  const normalizedVoiceKey = canonicalVoiceId.toLowerCase();
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
  const requestedVoiceKey = getCanonicalStudioVoiceOptionId(voiceId)?.toLowerCase() ?? "";
  const fallbackVoiceKey = getCanonicalStudioVoiceOptionId(fallbackVoiceId)?.toLowerCase() ?? "";
  return (
    studioVoiceOptionsByLanguage[language].find((voice) => voice.id.toLowerCase() === requestedVoiceKey)?.id ??
    studioVoiceOptionsByLanguage[language].find((voice) => voice.id.toLowerCase() === fallbackVoiceKey)?.id ??
    getDefaultStudioVoiceId(language)
  );
};

export type WorkspaceExplicitStudioVoiceSelection = {
  language: StudioLanguage;
  voiceId: StudioVoiceOption["id"];
};

export const resolveWorkspaceGenerationVoiceRequest = (options: {
  currentLanguage: StudioLanguage;
  currentVoiceEnabled: boolean;
  explicitVoiceSelection?: WorkspaceExplicitStudioVoiceSelection | null;
  generationLanguage: StudioLanguage;
  requestedVoiceEnabled?: boolean;
  requestedVoiceId?: string | null;
  selectedVoiceId: string | null | undefined;
  selectedVoiceIdForLanguage?: string | null;
}): { voiceEnabled: boolean; voiceId?: StudioVoiceOption["id"] } => {
  const explicitVoiceSelection =
    options.explicitVoiceSelection?.language === options.generationLanguage &&
    getStudioLanguageForVoiceId(options.explicitVoiceSelection.voiceId) === options.generationLanguage
      ? options.explicitVoiceSelection
      : null;
  const voiceEnabled =
    typeof options.requestedVoiceEnabled === "boolean"
      ? options.requestedVoiceEnabled
      : explicitVoiceSelection
        ? true
        : options.currentVoiceEnabled;
  const voiceId = voiceEnabled
    ? resolveStudioVoiceIdForLanguage(
        options.generationLanguage,
        options.requestedVoiceId ??
          explicitVoiceSelection?.voiceId ??
          (options.generationLanguage === options.currentLanguage ? options.selectedVoiceId : undefined),
        options.selectedVoiceIdForLanguage,
      )
    : undefined;

  return {
    voiceEnabled,
    voiceId,
  };
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
