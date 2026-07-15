import {
  STUDIO_AI_PHOTO_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_AI_VIDEO_AUDIO_CREDIT_COST,
  STUDIO_AI_VIDEO_GENERATION_CREDIT_COST,
  getStudioSegmentAiVideoCreditCost,
  getStudioSegmentPhotoAnimationCreditCost,
  STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST,
  STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST_BY_QUALITY,
  getStudioSegmentSceneSoundCreditCost,
  STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_WORKSPACE_CHARACTER_REFERENCE_CREDIT_COST,
  type StudioSegmentVisualQuality,
} from "../../../shared/studio-credit-costs";
import type { WorkspaceMediaAssetRef } from "../../../shared/workspace-media-assets";
import type { WorkspaceReferenceKind } from "../../../shared/workspace-references";
import { WORKSPACE_SEGMENT_PHOTO_DURATION_AUDIO_GUARD_EPSILON_SECONDS } from "./workspace-constants";
import {
  areWorkspaceSegmentInfographicsEqual,
  cloneWorkspaceSegmentInfographic,
  normalizeWorkspaceSegmentInfographic,
} from "./workspace-infographic-helpers";
import type {
  StudioBrandLogoFile,
  StudioCustomMusicFile,
  StudioCustomVideoFile,
  StudioLanguage,
  StudioSubtitleColorCatalogOption,
  StudioSubtitleColorOption,
  StudioSubtitleColorOverrides,
  StudioSubtitleStyleOption,
  StudioVideoMode,
  StudioVideoOption,
  StudioVoiceOption,
  WorkspaceProject,
  WorkspaceSegmentAiVideoMode,
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentEditorDraftSession,
  WorkspaceSegmentEditorLocalizedTextMap,
  WorkspaceSegmentEditorMediaUploadScope,
  WorkspaceSegmentEditorSegment,
  WorkspaceSegmentEditorSession,
  WorkspaceSegmentEditorSpeechWord,
  WorkspaceSegmentSceneSoundPayload,
  WorkspaceSegmentEditorVideoAction,
  WorkspaceSegmentInfographicTransform,
  WorkspaceSegmentMediaType,
  WorkspaceSegmentPreviewKind,
  WorkspaceSegmentSourceKind,
  WorkspaceSegmentTimelineHistoryKind,
} from "./workspace-types";
import {
  getWorkspaceSegmentPhotoDurationVoiceoverMinimumSeconds,
  getWorkspaceSegmentVoiceoverTextHash,
  normalizeWorkspaceSegmentBulkSubtitleText,
  splitWorkspaceSegmentBulkSubtitleWords,
} from "./workspace-utils";
import type { WorkspaceMediaLibraryItem } from "../../lib/workspaceMediaLibrary";
import { sanitizeWorkspaceSegmentEditorCustomMusicState } from "../../lib/workspaceSegmentEditorMusic";
import { hasWorkspaceSegmentEditorStructureChanged } from "../../lib/workspaceSegmentEditorStructure";
import {
  estimateWorkspaceSegmentEditorSpeechDuration,
  getWorkspaceSegmentEditorDisplayEndTime,
  getWorkspaceSegmentEditorDisplayStartTime,
  getWorkspaceSegmentEditorSpeechDuration,
  getWorkspaceSegmentTimelineSpeechRange,
  normalizeWorkspaceSegmentManualDurationSeconds,
  rebuildWorkspaceSegmentEditorTimeline,
  roundWorkspaceSegmentTimelineSeconds,
  type WorkspaceSegmentDurationMode,
  type WorkspaceSegmentTimelineRange,
} from "../../lib/workspaceSegmentEditorTimeline";
import {
  filterWorkspaceStillAssetUrls,
  isLikelyVideoAssetUrl,
} from "../../lib/workspaceSegmentPreview";

export const STUDIO_CUSTOM_ASSET_NAME_MAX_CHARS = 16;

export const STUDIO_ALLOWED_SEGMENT_CUSTOM_IMAGE_EXTENSIONS = [".avif", ".jpeg", ".jpg", ".png", ".webp"] as const;

export const WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS = 1;

export const WORKSPACE_SEGMENT_EDITOR_NEW_SEGMENT_DURATION_SECONDS = 5;

export const WORKSPACE_SEGMENT_EDITOR_MAX_VISUAL_DURATION_SECONDS = 50;

export const WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS = 0.075;
const WORKSPACE_SEGMENT_STALE_AUTO_VISUAL_REPAIR_THRESHOLD_SECONDS = 0.75;

export const WORKSPACE_SEGMENT_VOICE_PREVIEW_LEAD_SECONDS = 0.08;

export const WORKSPACE_SEGMENT_VOICE_PREVIEW_TAIL_SECONDS = 0.45;

export const WORKSPACE_SEGMENT_VOICE_PREVIEW_MIN_DURATION_SECONDS = 0.2;

export const WORKSPACE_SEGMENT_PROJECT_VOICE_SOURCE_TIMELINE_DRIFT_SECONDS = 0.35;

const WORKSPACE_SEGMENT_PENDING_VOICEOVER_ESTIMATE_MIN_REFERENCE_WORDS = 3;
const WORKSPACE_SEGMENT_PENDING_VOICEOVER_ESTIMATE_MIN_WORD_SECONDS = 0.24;
const WORKSPACE_SEGMENT_PENDING_VOICEOVER_ESTIMATE_MAX_WORD_SECONDS = 1.05;
const WORKSPACE_SEGMENT_PENDING_VOICEOVER_ESTIMATE_MAX_REFERENCE_RATIO = 2.6;
const WORKSPACE_SEGMENT_PENDING_VOICEOVER_ESTIMATE_MAX_REFERENCE_EXTRA_SECONDS = 4;

export const WORKSPACE_SEGMENT_AI_EXTENSION_STEP_SECONDS = 5;
const WORKSPACE_SEGMENT_PERSISTED_SLOT_DEFAULT_DURATION_TOLERANCE_SECONDS = 0.2;

export const normalizeWorkspaceSegmentDurationMode = (value: unknown): WorkspaceSegmentDurationMode =>
  String(value ?? "").trim().toLowerCase() === "manual" ? "manual" : "auto";

export const normalizeWorkspaceSegmentDurationSyncMode = (
  value: unknown,
): WorkspaceSegmentEditorDraftSegment["durationSyncMode"] =>
  value === "visual" || value === "voiceover" ? value : null;

export const clampWorkspaceSegmentEditorVisualDurationSeconds = (value: number | null | undefined) => {
  const normalizedValue = normalizeWorkspaceSegmentManualDurationSeconds(value);
  if (normalizedValue === null) {
    return null;
  }

  return roundWorkspaceSegmentTimelineSeconds(
    Math.min(normalizedValue, WORKSPACE_SEGMENT_EDITOR_MAX_VISUAL_DURATION_SECONDS),
  );
};

export const rgbFromHex = (value: string) => {
  const normalized = value.replace("#", "");
  if (normalized.length !== 6) return null;

  const numeric = Number.parseInt(normalized, 16);
  if (Number.isNaN(numeric)) return null;

  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
};

export const createStudioSubtitleColorOption = (
  id: string,
  label: string,
  accent: string,
  overrides: StudioSubtitleColorOverrides = {},
): StudioSubtitleColorOption => {
  const rgb = rgbFromHex(accent) ?? { r: 255, g: 255, b: 255 };
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;

  return {
    id,
    label,
    accent,
    surface: overrides.surface ?? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`,
    text: overrides.text ?? (brightness >= 170 ? "#08111d" : "#f8fbff"),
    outline: overrides.outline ?? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.34)`,
  };
};

export const fallbackStudioSubtitleStyleOption: StudioSubtitleStyleOption = {
  defaultColorId: "purple",
  description: "Текущий дефолт для Shorts на Manrope.",
  fontFamily: "Manrope",
  fontSize: 96,
  id: "modern",
  label: "Modern",
  logicMode: "block",
  marginBottom: 420,
  outlineWidth: 3,
  position: "bottom_center",
  transitionMode: "hard_cut",
  usesAccentColor: true,
  windowSize: 3,
  wordEffect: "none",
};

export const fallbackStudioSubtitleColorCatalogOption: StudioSubtitleColorCatalogOption = {
  hex: "8B5CF6",
  id: "purple",
  label: "Фиолетовый",
};

export const fallbackStudioSubtitleColorOption = createStudioSubtitleColorOption(
  fallbackStudioSubtitleColorCatalogOption.id,
  fallbackStudioSubtitleColorCatalogOption.label,
  `#${fallbackStudioSubtitleColorCatalogOption.hex}`,
);

export const normalizeWorkspaceSegmentEditorTextForCompare = (value: string) => value.replace(/\s+/g, " ").trim();

export const isWorkspaceSegmentDraftTextEdited = (segment: WorkspaceSegmentEditorDraftSegment) =>
  normalizeWorkspaceSegmentEditorTextForCompare(segment.text) !==
  normalizeWorkspaceSegmentEditorTextForCompare(segment.originalText);

export const getWorkspaceSegmentSubtitleTypeOverrideId = (
  segment:
    | Pick<WorkspaceSegmentEditorSegment, "subtitleType" | "subtitle_type">
    | null
    | undefined,
) => normalizeWorkspaceSegmentEditorSetting(segment?.subtitleType ?? segment?.subtitle_type) ?? null;

export const getWorkspaceSegmentSubtitleStyleOverrideId = (
  segment:
    | Pick<WorkspaceSegmentEditorSegment, "subtitleStyle" | "subtitle_style">
    | null
    | undefined,
) => normalizeWorkspaceSegmentEditorSetting(segment?.subtitleStyle ?? segment?.subtitle_style) ?? null;

export const getWorkspaceSegmentSubtitleColorOverrideId = (
  segment:
    | Pick<WorkspaceSegmentEditorSegment, "subtitleColor" | "subtitle_color">
    | null
    | undefined,
) => normalizeWorkspaceSegmentEditorSetting(segment?.subtitleColor ?? segment?.subtitle_color) ?? null;

type WorkspaceSegmentEffectiveSubtitleSegment = Pick<
  WorkspaceSegmentEditorSegment,
  | "subtitleColor"
  | "subtitle_color"
  | "subtitleStyle"
  | "subtitle_style"
  | "subtitleType"
  | "subtitle_type"
  | "voiceType"
  | "voice_type"
> &
  Partial<
    Pick<
      WorkspaceSegmentEditorDraftSegment,
      | "speechDuration"
      | "speechEndTime"
      | "speechStartTime"
      | "speechWords"
      | "text"
      | "voiceoverAsset"
      | "voiceoverLanguage"
      | "voiceoverTextHash"
      | "voiceoverVoiceType"
      | "voiceSourceDuration"
      | "voiceSourceEndTime"
      | "voiceSourceStartTime"
      | "voice_source_duration"
      | "voice_source_end_time"
      | "voice_source_start_time"
      | "_voice_source_duration"
      | "_voice_source_end_time"
      | "_voice_source_start_time"
    >
  >;

export const getWorkspaceSegmentEffectiveSubtitleSettings = (
  session:
    | (Pick<WorkspaceSegmentEditorSession, "subtitleType" | "voiceType"> &
        Partial<Pick<WorkspaceSegmentEditorSession, "language" | "subtitleColor" | "subtitleStyle" | "ttsAssetId">>)
    | null
    | undefined,
  segment: WorkspaceSegmentEffectiveSubtitleSegment | null | undefined,
  fallbackSelection: {
    subtitleColorId: string;
    subtitleStyleId: string;
  },
) => {
  const globalType = normalizeWorkspaceSegmentEditorSetting(session?.subtitleType);
  const globalEnabled = globalType !== "none";
  const globalVoiceEnabled = normalizeWorkspaceSegmentEditorSetting(session?.voiceType) !== "none";
  const segmentVoiceType = getWorkspaceSegmentVoiceOverrideId(segment);
  const hasEmbeddedTalkingPhotoAudio = Boolean(
    segment && doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio(segment as WorkspaceSegmentEditorDraftSegment),
  );
  const hasFreshSceneVoiceover = Boolean(
    segment &&
      segmentVoiceType !== "none" &&
      isWorkspaceSegmentVoiceoverPlaybackFresh(
        segment as WorkspaceSegmentEditorDraftSegment,
        session as Pick<WorkspaceSegmentEditorDraftSession, "language" | "ttsAssetId" | "voiceType"> | null | undefined,
      ),
  );
  const voiceEnabled =
    hasEmbeddedTalkingPhotoAudio ||
    (segmentVoiceType !== "none" &&
      (globalVoiceEnabled || Boolean(segmentVoiceType) || hasFreshSceneVoiceover));
  const segmentType = getWorkspaceSegmentSubtitleTypeOverrideId(segment);
  const segmentStyleId = getWorkspaceSegmentSubtitleStyleOverrideId(segment);
  const segmentColorId = getWorkspaceSegmentSubtitleColorOverrideId(segment);
  const hasSceneSubtitleOverride = Boolean(segmentType || segmentStyleId || segmentColorId);
  const sceneSubtitleDisabled = segmentType === "none";
  const sceneSubtitleEnabled = hasSceneSubtitleOverride && !sceneSubtitleDisabled;
  const isEnabled = voiceEnabled && !sceneSubtitleDisabled && (globalEnabled || sceneSubtitleEnabled);
  const subtitleStyleId =
    segmentStyleId ??
    normalizeWorkspaceSegmentEditorSetting(session?.subtitleStyle) ??
    normalizeWorkspaceSegmentEditorSetting(fallbackSelection.subtitleStyleId) ??
    fallbackStudioSubtitleStyleOption.id;
  const subtitleColorId =
    segmentColorId ??
    normalizeWorkspaceSegmentEditorSetting(session?.subtitleColor) ??
    normalizeWorkspaceSegmentEditorSetting(fallbackSelection.subtitleColorId) ??
    fallbackStudioSubtitleColorOption.id;

  return {
    globalEnabled,
    isEnabled,
    subtitleColorId,
    subtitleStyleId,
    subtitleType: segmentType ?? (globalEnabled || sceneSubtitleEnabled ? "default" : "none"),
    voiceEnabled,
  };
};

export const applyWorkspaceSegmentEditorGlobalSubtitleSelection = (
  draft: WorkspaceSegmentEditorDraftSession,
  selection: Partial<Pick<WorkspaceSegmentEditorDraftSession, "subtitleColor" | "subtitleStyle" | "subtitleType">>,
): WorkspaceSegmentEditorDraftSession => {
  const nextSubtitleType =
    selection.subtitleType ??
    (normalizeWorkspaceSegmentEditorSetting(draft.subtitleType) === "none"
      ? "default"
      : draft.subtitleType || "default");
  const shouldClearSceneSubtitleType = nextSubtitleType !== "none";

  return {
    ...draft,
    ...(selection.subtitleColor !== undefined ? { subtitleColor: selection.subtitleColor } : {}),
    ...(selection.subtitleStyle !== undefined ? { subtitleStyle: selection.subtitleStyle } : {}),
    subtitleType: nextSubtitleType,
    segments: draft.segments.map((segment) => {
      const segmentSubtitleType = getWorkspaceSegmentSubtitleTypeOverrideId(segment);
      const nextSegment: WorkspaceSegmentEditorDraftSegment = {
        ...segment,
        subtitleColor: null,
        subtitleStyle: null,
      };

      if (shouldClearSceneSubtitleType && segmentSubtitleType !== "none") {
        nextSegment.subtitleType = null;
      }

      return nextSegment;
    }),
  };
};

export const areWorkspaceSegmentDurationValuesEqual = (left: number | null, right: number | null) => {
  if (left === null || right === null) {
    return left === right;
  }

  return Math.abs(left - right) <= 0.05;
};

const getWorkspaceSegmentLegacyVoiceRenderWindowDuration = (
  segment: WorkspaceSegmentEditorDraftSegment,
) => {
  const record = segment as WorkspaceSegmentEditorDraftSegment & Record<string, unknown>;
  const start = normalizeWorkspaceSegmentManualDurationSeconds(record._voice_render_source_start_time);
  const end = normalizeWorkspaceSegmentManualDurationSeconds(record._voice_render_source_end_time);
  if (start === null || end === null || end <= start) {
    return null;
  }
  return roundWorkspaceSegmentTimelineSeconds(end - start);
};

const shouldDiscardWorkspaceSegmentLegacyVoiceRenderManualDuration = (
  segment: WorkspaceSegmentEditorDraftSegment,
) => {
  const manualDuration = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
  const voiceDuration = getWorkspaceSegmentVoiceSourceDurationSeconds(segment);
  const legacyRenderWindowDuration = getWorkspaceSegmentLegacyVoiceRenderWindowDuration(segment);
  if (manualDuration === null || voiceDuration === null || manualDuration <= voiceDuration + 1) {
    return false;
  }

  if (legacyRenderWindowDuration !== null) {
    return areWorkspaceSegmentDurationValuesEqual(manualDuration, legacyRenderWindowDuration);
  }

  if (segment.mediaType !== "photo") {
    return false;
  }

  if (segment.durationSyncModeUserSelected === true) {
    return false;
  }

  const normalizedText = normalizeWorkspaceSegmentEditorTextForCompare(segment.text);
  if (!normalizedText) {
    return false;
  }

  const estimatedVoiceDuration = estimateWorkspaceSegmentEditorSpeechDuration(normalizedText);
  return manualDuration > Math.max(
    voiceDuration * 2.6,
    voiceDuration + 4,
    estimatedVoiceDuration * 2.6,
    estimatedVoiceDuration + 4,
  );
};

type WorkspaceSegmentDraftDurationComparable = Pick<
  WorkspaceSegmentEditorDraftSegment,
  "duration" | "durationMode" | "manualDurationSeconds"
> &
  Partial<
    Pick<
      WorkspaceSegmentEditorDraftSegment,
      | "durationExtensionSourceDurationSeconds"
      | "durationSyncMode"
      | "durationSyncModeUserSelected"
      | "duration_extension_source_duration_seconds"
    >
  >;

export const isWorkspaceSegmentDraftDurationEdited = (
  segment: WorkspaceSegmentDraftDurationComparable,
  baselineSegment: WorkspaceSegmentDraftDurationComparable | null | undefined,
) => {
  const durationMode = normalizeWorkspaceSegmentDurationMode(segment.durationMode);
  const durationSyncMode = normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode);
  const durationSyncModeUserSelected = segment.durationSyncModeUserSelected === true;
  const durationExtensionSourceDurationSeconds =
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment);
  if (!baselineSegment) {
    return (
      (durationMode === "manual" && normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds) !== null) ||
      durationSyncModeUserSelected ||
      durationExtensionSourceDurationSeconds !== null
    );
  }

  const baselineDurationMode = normalizeWorkspaceSegmentDurationMode(baselineSegment?.durationMode);
  const baselineDurationSyncMode = normalizeWorkspaceSegmentDurationSyncMode(baselineSegment?.durationSyncMode);
  const baselineDurationSyncModeUserSelected = baselineSegment.durationSyncModeUserSelected === true;
  const baselineDurationExtensionSourceDurationSeconds =
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(baselineSegment);
  const duration = normalizeWorkspaceSegmentManualDurationSeconds(segment.duration);
  const baselineDuration = normalizeWorkspaceSegmentManualDurationSeconds(baselineSegment?.duration);
  if (durationMode !== baselineDurationMode) {
    return true;
  }

  if (durationSyncModeUserSelected && durationSyncMode !== baselineDurationSyncMode) {
    return true;
  }

  if (durationSyncModeUserSelected && durationSyncModeUserSelected !== baselineDurationSyncModeUserSelected) {
    return true;
  }

  if (
    durationSyncModeUserSelected &&
    !areWorkspaceSegmentDurationValuesEqual(
      durationExtensionSourceDurationSeconds,
      baselineDurationExtensionSourceDurationSeconds,
    )
  ) {
    return true;
  }

  if (!areWorkspaceSegmentDurationValuesEqual(duration, baselineDuration)) {
    return true;
  }

  if (durationMode !== "manual") {
    return false;
  }

  return !areWorkspaceSegmentDurationValuesEqual(
    normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds),
    normalizeWorkspaceSegmentManualDurationSeconds(baselineSegment?.manualDurationSeconds),
  );
};

export const getWorkspaceSegmentCustomAssetId = (asset: StudioCustomVideoFile | null | undefined) => {
  if (!asset) {
    return null;
  }

  const record = asset as StudioCustomVideoFile & {
    id?: unknown;
    mediaAssetId?: unknown;
    media_asset_id?: unknown;
  };
  const assetId = Number(
    record.assetId ??
      record.mediaAssetId ??
      record.media_asset_id ??
      record.id,
  );

  return Number.isFinite(assetId) && assetId > 0 ? Math.trunc(assetId) : null;
};

export const getWorkspaceSegmentVoiceOverrideId = (
  segment: Pick<WorkspaceSegmentEditorSegment, "voiceType" | "voice_type"> | null | undefined,
) => normalizeWorkspaceSegmentEditorSetting(segment?.voiceType ?? segment?.voice_type) ?? null;

export const getWorkspaceSegmentVoiceLanguage = (
  segment:
    | Pick<WorkspaceSegmentEditorSegment, "voiceLanguage" | "voice_language" | "voiceoverLanguage">
    | null
    | undefined,
  fallbackLanguage?: StudioLanguage | null,
): StudioLanguage =>
  normalizeStudioLanguageValue(segment?.voiceLanguage ?? segment?.voice_language) ??
  normalizeStudioLanguageValue(fallbackLanguage) ??
  normalizeStudioLanguageValue(segment?.voiceoverLanguage) ??
  "ru";

export const getWorkspaceSegmentVoiceOverrideForLanguage = (
  segment: Pick<WorkspaceSegmentEditorSegment, "voiceType" | "voice_type"> | null | undefined,
  language: StudioLanguage,
) => {
  const normalizedVoiceId = getCanonicalStudioVoiceOptionId(getWorkspaceSegmentVoiceOverrideId(segment));
  if (!normalizedVoiceId || normalizedVoiceId === "none") {
    return null;
  }

  const normalizedVoiceKey = normalizedVoiceId.toLowerCase();
  return (
    studioVoiceOptionsByLanguage[language].find((voice) => voice.id.toLowerCase() === normalizedVoiceKey)?.id ?? null
  );
};

export const getWorkspaceSegmentVoiceLanguageSelectionPatch = (
  segment:
    | Pick<WorkspaceSegmentEditorSegment, "voiceLanguage" | "voiceType" | "voice_language" | "voice_type">
    | null
    | undefined,
  language: StudioLanguage,
) => {
  const voiceType = getWorkspaceSegmentVoiceOverrideForLanguage(segment, language);
  const voiceLanguage = voiceType ? language : null;

  return {
    voiceLanguage,
    voiceType,
    voice_language: voiceLanguage,
    voice_type: voiceType,
  };
};

const getWorkspaceSegmentVoiceoverAssetIdForInference = (
  segment:
    | (Pick<WorkspaceSegmentEditorSegment, "voiceoverAssetId" | "voiceover_asset_id"> & {
        voiceover?: { media_asset_id?: number | null } | null;
        voiceoverAsset?: Pick<StudioCustomVideoFile, "assetId"> | null;
      })
    | null
    | undefined,
) =>
  getPositiveWorkspaceMediaAssetId(segment?.voiceoverAsset?.assetId) ??
  getPositiveWorkspaceMediaAssetId(segment?.voiceoverAssetId) ??
  getPositiveWorkspaceMediaAssetId(segment?.voiceover?.media_asset_id) ??
  getPositiveWorkspaceMediaAssetId(segment?.voiceover_asset_id);

export const inferWorkspaceSegmentEditorUniformVoiceType = (
  session: Pick<WorkspaceSegmentEditorSession, "segments"> | null | undefined,
) => {
  const segments = session?.segments ?? [];
  if (segments.length < 2) {
    return null;
  }

  const voiceIds = segments.map((segment) => getWorkspaceSegmentVoiceOverrideId(segment));
  if (voiceIds.some((voiceId) => !voiceId || voiceId === "none")) {
    return null;
  }

  const firstVoiceId = voiceIds[0];
  return firstVoiceId && voiceIds.every((voiceId) => voiceId === firstVoiceId) ? firstVoiceId : null;
};

const inferWorkspaceSegmentEditorProjectVoiceoverVoiceType = (
  session: Pick<WorkspaceSegmentEditorSession, "segments" | "ttsAssetId"> | null | undefined,
) => {
  const ttsAssetId = getPositiveWorkspaceMediaAssetId(session?.ttsAssetId);
  if (ttsAssetId === null) {
    return null;
  }

  const voiceIds = (session?.segments ?? [])
    .filter((segment) => getWorkspaceSegmentVoiceoverAssetIdForInference(segment) === ttsAssetId)
    .map((segment) => normalizeWorkspaceSegmentEditorSetting(segment.voiceoverVoiceType))
    .filter((voiceId): voiceId is string => Boolean(voiceId && voiceId !== "none"));
  if (voiceIds.length === 0) {
    return null;
  }

  const firstVoiceId = voiceIds[0];
  return firstVoiceId && voiceIds.every((voiceId) => voiceId === firstVoiceId) ? firstVoiceId : null;
};

const inferWorkspaceSegmentEditorUniformSceneVoiceoverVoiceType = (
  session: Pick<WorkspaceSegmentEditorSession, "segments"> | null | undefined,
) => {
  const segments = session?.segments ?? [];
  if (segments.length < 2) {
    return null;
  }

  const voiceIds = segments.map((segment) => normalizeWorkspaceSegmentEditorSetting(segment.voiceoverVoiceType));
  if (voiceIds.some((voiceId) => !voiceId || voiceId === "none")) {
    return null;
  }

  const firstVoiceId = voiceIds[0];
  return firstVoiceId && voiceIds.every((voiceId) => voiceId === firstVoiceId) ? firstVoiceId : null;
};

export const getWorkspaceSegmentEditorProjectVoiceType = (
  session: Pick<WorkspaceSegmentEditorSession, "segments" | "ttsAssetId" | "voiceType"> | null | undefined,
) => {
  const configuredVoiceType = normalizeWorkspaceSegmentEditorSetting(session?.voiceType);
  if (configuredVoiceType === "none") {
    return configuredVoiceType;
  }

  return (
    inferWorkspaceSegmentEditorUniformVoiceType(session) ??
    inferWorkspaceSegmentEditorUniformSceneVoiceoverVoiceType(session) ??
    configuredVoiceType ??
    inferWorkspaceSegmentEditorProjectVoiceoverVoiceType(session)
  );
};

const normalizeWorkspaceSegmentEditorSessionVoiceInheritance = <T extends WorkspaceSegmentEditorSession>(
  session: T,
): T => {
  const inheritedVoiceType = getWorkspaceSegmentEditorProjectVoiceType(session);
  if (!inheritedVoiceType) {
    return session;
  }

  return {
    ...session,
    voiceType: inheritedVoiceType,
    segments: session.segments.map((segment) => {
      const voiceOverrideId = getWorkspaceSegmentVoiceOverrideId(segment);
      if (voiceOverrideId !== inheritedVoiceType) {
        return segment;
      }

      return {
        ...segment,
        voiceType: null,
        voice_type: null,
      };
    }),
  };
};

export const studioVoicePreviewAssetVersion = "20260708-4";

export const getStudioVoicePreviewSampleUrl = (fileName: string) =>
  `/voice-previews/${fileName}?v=${studioVoicePreviewAssetVersion}`;

export const studioSupportedVoiceOptionsByLanguage: Record<StudioLanguage, StudioVoiceOption[]> = {
  ru: [
    {
      id: "Liam_Timing",
      label: "Александр",
      description: "Выразительный голос с точными таймингами",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("alexander-premium.wav"),
    },
    {
      id: "Elena",
      label: "Елена",
      description: "Серьёзный, прямой и уверенный голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("elena.wav"),
    },
    {
      id: "Adam",
      label: "Адам",
      description: "Тёмный и уверенный голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("adam.wav"),
    },
    {
      id: "Maxim",
      label: "Максим",
      description: "Естественный разговорный голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("maxim.wav"),
    },
    {
      id: "Vika",
      label: "Вика",
      description: "Естественный, ясный и дружелюбный голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("vika.wav"),
    },
    {
      id: "Alisa",
      label: "Алиса",
      description: "Таинственный и эмоциональный голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("alisa.wav"),
    },
    {
      id: "Anastasia",
      label: "Анастасия",
      description: "Бодрый и ясный голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("anastasia.wav"),
    },
    {
      id: "Lesha",
      label: "Леша",
      description: "Мягкий, уверенный и убедительный голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("lesha.wav"),
    },
    {
      id: "Stas",
      label: "Стас",
      description: "Мудрый и располагающий голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("stas.wav"),
    },
    {
      id: "Misha",
      label: "Миша",
      description: "Уверенный и выразительный голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("misha.wav"),
    },
    {
      id: "English_ManWithDeepVoice",
      label: "Глеб",
      description: "Глубокий голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("gleb-premium.wav"),
    },
    {
      id: "Russian_BrightHeroine",
      label: "Тим",
      description: "Яркий голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("tim-premium.wav"),
    },
    {
      id: "Bys_24000",
      label: "Борис",
      description: "Базовый мужской голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("boris.wav"),
    },
    {
      id: "Nec_24000",
      label: "Наталья",
      description: "Женский голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("natalya.wav"),
    },
    {
      id: "Tur_24000",
      label: "Владимир",
      description: "Уверенный мужской голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("taras.wav"),
    },
    {
      id: "May_24000",
      label: "Екатерина",
      description: "Женский голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("marfa.wav"),
    },
    {
      id: "Ost_24000",
      label: "Александра",
      description: "Естественный рекламный голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("alexandra.wav"),
    },
    {
      id: "Russian_Mikhail",
      label: "Михаил",
      description: "Мужской голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("mikhail.wav"),
    },
    {
      id: "Russian_ReliableMan",
      label: "Сергей",
      description: "Деловой мужской голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("sergey.wav"),
    },
    {
      id: "male-qn-jingying",
      label: "Алексей",
      description: "Выразительный мужской голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("aleksey.wav"),
    },
  ],
  en: [
    {
      id: "Aiden",
      label: "Aiden",
      description: "Ясный американский мужской голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("aiden.wav"),
    },
    {
      id: "Ryan",
      label: "Ryan",
      description: "Энергичный мужской голос с сильным ритмом",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("ryan.wav"),
    },
    {
      id: "Serena",
      label: "Serena",
      description: "Теплый мягкий женский голос",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("serena.wav"),
    },
    {
      id: "Vivian",
      label: "Vivian",
      description: "Яркий молодой женский голос с характером",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("vivian.wav"),
    },
    {
      id: "Uncle_Fu",
      label: "Uncle Fu",
      description: "Низкий зрелый мужской тембр",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("uncle-fu.wav"),
    },
    {
      id: "Dylan",
      label: "Dylan",
      description: "Молодой мужской голос с пекинским оттенком",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("dylan.wav"),
    },
    {
      id: "Eric",
      label: "Eric",
      description: "Живой мужской голос с легкой хрипотцой",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("eric.wav"),
    },
    {
      id: "Ono_Anna",
      label: "Ono Anna",
      description: "Легкий японский женский тембр",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("ono-anna.wav"),
    },
    {
      id: "Sohee",
      label: "Sohee",
      description: "Теплый корейский женский голос с эмоцией",
      previewSampleUrl: getStudioVoicePreviewSampleUrl("sohee.wav"),
    },
  ],
};

export const STUDIO_ELEVENLABS_VOICE_IDS = [
  "Liam_Timing",
  "Elena",
  "Adam",
  "Maxim",
  "Vika",
  "Alisa",
  "Anastasia",
  "Lesha",
  "Stas",
  "Misha",
] as const;

const studioElevenLabsVoiceIds = new Set<string>(STUDIO_ELEVENLABS_VOICE_IDS);
const studioElevenLabsVoiceOptions = studioSupportedVoiceOptionsByLanguage.ru.filter((voice) =>
  studioElevenLabsVoiceIds.has(voice.id),
);

export const studioVoiceOptionsByLanguage: Record<StudioLanguage, StudioVoiceOption[]> = {
  en: studioElevenLabsVoiceOptions,
  ru: studioElevenLabsVoiceOptions,
};

const studioVoiceOptionEnglishCopy: Record<string, Partial<Pick<StudioVoiceOption, "description" | "label">>> = {
  Bys_24000: { label: "Boris", description: "Basic male voice" },
  Dylan: { description: "Young male voice with a Beijing accent" },
  English_ManWithDeepVoice: { label: "Gleb", description: "Deep voice" },
  Eric: { description: "Lively male voice with a slight rasp" },
  Elena: { label: "Elena", description: "Serious, direct, confident voice" },
  Adam: { label: "Adam", description: "Dark, confident voice" },
  Maxim: { label: "Maxim", description: "Natural conversational voice" },
  Vika: { label: "Vika", description: "Natural, clear, friendly voice" },
  Alisa: { label: "Alisa", description: "Mysterious, emotive voice" },
  Anastasia: { label: "Anastasia", description: "Upbeat, clear voice" },
  Lesha: { label: "Lesha", description: "Smooth, confident, persuasive voice" },
  Stas: { label: "Stas", description: "Wise, approachable voice" },
  Misha: { label: "Misha", description: "Confident, expressive voice" },
  Liam_Timing: { label: "Alexander", description: "Expressive voice with provider timings" },
  May_24000: { label: "Ekaterina", description: "Female voice" },
  Nec_24000: { label: "Natalia", description: "Female voice" },
  Ono_Anna: { description: "Light Japanese female tone" },
  Ost_24000: { label: "Alexandra", description: "Natural advertising voice" },
  Russian_Mikhail: { label: "Mikhail", description: "Male voice" },
  Russian_ReliableMan: { label: "Sergey", description: "Businesslike male voice" },
  Russian_BrightHeroine: { label: "Tim", description: "Bright premium voice" },
  Ryan: { description: "Energetic male voice with a strong rhythm" },
  Serena: { description: "Warm, soft female voice" },
  Sohee: { description: "Warm Korean female voice with emotion" },
  Tur_24000: { label: "Vladimir", description: "Confident male voice" },
  Uncle_Fu: { description: "Low, mature male timbre" },
  Vivian: { description: "Bright young female voice with character" },
  "male-qn-jingying": { label: "Alexey", description: "Expressive male voice" },
  Aiden: { description: "Clear American male voice" },
};

const studioVoiceLegacyAliases = new Map<string, StudioVoiceOption["id"]>([
  ["liam", "Liam_Timing"],
  ["alexander", "Liam_Timing"],
  ["alexandr", "Liam_Timing"],
  ["aleksandr", "Liam_Timing"],
  ["александр", "Liam_Timing"],
  ["mark", "Maxim"],
  ["mark_v3", "Maxim"],
  ["mark v3", "Maxim"],
  ["mark_natural_conversations", "Maxim"],
  ["mark natural conversations", "Maxim"],
  ["mark - natural conversations", "Maxim"],
  ["maxim", "Maxim"],
  ["maxim_v3", "Maxim"],
  ["maxim v3", "Maxim"],
  ["максим", "Maxim"],
  ["vika", "Vika"],
  ["vika_v3", "Vika"],
  ["vika v3", "Vika"],
  ["vika_grib", "Vika"],
  ["vika grib", "Vika"],
  ["vika_grib_natural_clear_and_friendly", "Vika"],
  ["vika grib natural clear and friendly", "Vika"],
  ["vika grib - natural, clear and friendly", "Vika"],
  ["вика", "Vika"],
  ["alisa", "Alisa"],
  ["alisa_v3", "Alisa"],
  ["alisa v3", "Alisa"],
  ["alice", "Alisa"],
  ["alice_v3", "Alisa"],
  ["alice v3", "Alisa"],
  ["arabella", "Alisa"],
  ["arabella_v3", "Alisa"],
  ["arabella v3", "Alisa"],
  ["arabella_mysterious_and_emotive", "Alisa"],
  ["arabella mysterious and emotive", "Alisa"],
  ["arabella - mysterious and emotive", "Alisa"],
  ["алиса", "Alisa"],
  ["anastasia", "Anastasia"],
  ["anastasia_v3", "Anastasia"],
  ["anastasia v3", "Anastasia"],
  ["hope", "Anastasia"],
  ["hope_v3", "Anastasia"],
  ["hope v3", "Anastasia"],
  ["hope_upbeat_and_clear", "Anastasia"],
  ["hope upbeat and clear", "Anastasia"],
  ["hope - upbeat and clear", "Anastasia"],
  ["анастасия", "Anastasia"],
  ["lesha", "Lesha"],
  ["lesha_v3", "Lesha"],
  ["lesha v3", "Lesha"],
  ["hale", "Lesha"],
  ["hale_v3", "Lesha"],
  ["hale v3", "Lesha"],
  ["hale_smooth_confident_and_persuasive", "Lesha"],
  ["hale smooth confident and persuasive", "Lesha"],
  ["hale smooth, confident and persuasive", "Lesha"],
  ["hale - smooth, confident and persuasive", "Lesha"],
  ["леша", "Lesha"],
  ["лёша", "Lesha"],
  ["stas", "Stas"],
  ["stas_v3", "Stas"],
  ["stas v3", "Stas"],
  ["spuds", "Stas"],
  ["spuds_oxley", "Stas"],
  ["spuds oxley", "Stas"],
  ["spuds_oxley_wise_and_approachable", "Stas"],
  ["spuds oxley wise and approachable", "Stas"],
  ["spuds oxley - wise and approachable", "Stas"],
  ["стас", "Stas"],
  ["misha", "Misha"],
  ["misha_v3", "Misha"],
  ["misha v3", "Misha"],
  ["michael", "Misha"],
  ["michael_v3", "Misha"],
  ["michael v3", "Misha"],
  ["michael_c_vincent", "Misha"],
  ["michael c vincent", "Misha"],
  ["michael c. vincent", "Misha"],
  ["michael_c_vincent_confident_expressive", "Misha"],
  ["michael c vincent confident expressive", "Misha"],
  ["michael c. vincent confident expressive", "Misha"],
  ["michael c. vincent - confident, expressive", "Misha"],
  ["michael c. vincent - suspenseful storyteller", "Misha"],
  ["миша", "Misha"],
]);

export const getCanonicalStudioVoiceOptionId = (voiceId: string | null | undefined): string | null => {
  const normalizedVoiceId = String(voiceId ?? "").trim();
  if (!normalizedVoiceId || normalizedVoiceId === "none") {
    return null;
  }

  const normalizedVoiceKey = normalizedVoiceId.toLowerCase();
  return studioVoiceLegacyAliases.get(normalizedVoiceKey) ?? normalizedVoiceId;
};

export const getStudioVoiceOptionCopy = (voice: StudioVoiceOption, locale: string): StudioVoiceOption => {
  if (locale !== "en") {
    return voice;
  }

  return {
    ...voice,
    ...(studioVoiceOptionEnglishCopy[voice.id] ?? {}),
  };
};

export const getStudioLanguageForVoiceId = (
  voiceId: string | null | undefined,
  preferredLanguage?: StudioLanguage | null,
): StudioLanguage | null => {
  const canonicalVoiceId = getCanonicalStudioVoiceOptionId(voiceId);
  if (!canonicalVoiceId) {
    return null;
  }

  const normalizedVoiceKey = canonicalVoiceId.toLowerCase();
  if (
    preferredLanguage &&
    studioVoiceOptionsByLanguage[preferredLanguage].some((voice) => voice.id.toLowerCase() === normalizedVoiceKey)
  ) {
    return preferredLanguage;
  }

  for (const language of Object.keys(studioSupportedVoiceOptionsByLanguage) as StudioLanguage[]) {
    if (studioSupportedVoiceOptionsByLanguage[language].some((voice) => voice.id.toLowerCase() === normalizedVoiceKey)) {
      return language;
    }
  }

  return null;
};

export const normalizeStudioLanguageValue = (value: string | null | undefined): StudioLanguage | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "ru" || normalized === "en" ? normalized : null;
};

export const getWorkspaceSegmentEditorSessionLanguage = (
  session: Pick<WorkspaceSegmentEditorSession, "language" | "voiceType">,
): StudioLanguage => normalizeStudioLanguageValue(session.language) ?? getStudioLanguageForVoiceId(session.voiceType) ?? "ru";

export const isWorkspaceSegmentEditorProjectVoiceSelectionEdited = (
  draft:
    | Pick<WorkspaceSegmentEditorSession, "language" | "segments" | "ttsAssetId" | "voiceType">
    | null
    | undefined,
  baseline:
    | Pick<WorkspaceSegmentEditorSession, "language" | "segments" | "ttsAssetId" | "voiceType">
    | null
    | undefined,
) => {
  if (!draft || !baseline) {
    return false;
  }

  const draftVoiceType = getWorkspaceSegmentEditorProjectVoiceType(draft);
  const baselineVoiceType = getWorkspaceSegmentEditorProjectVoiceType(baseline);
  const draftVoiceEnabled = Boolean(draftVoiceType && draftVoiceType !== "none");
  const baselineVoiceEnabled = Boolean(baselineVoiceType && baselineVoiceType !== "none");

  if (draftVoiceEnabled !== baselineVoiceEnabled) {
    return true;
  }
  if (!draftVoiceEnabled) {
    return false;
  }

  return (
    draftVoiceType !== baselineVoiceType ||
    getWorkspaceSegmentEditorSessionLanguage(draft) !== getWorkspaceSegmentEditorSessionLanguage(baseline)
  );
};

export const studioVideoOptions: StudioVideoOption[] = [
  {
    id: "ai_photo",
    label: "AI фото",
    description: "AI фото для всех сцен",
    duration: "1–2 минуты",
  },
  {
    id: "ai_video",
    label: "AI видео",
    description: "AI видео для всех сцен",
    duration: "3–5 минут",
  },
];

export const studioVideoOptionEnglishCopy: Record<StudioVideoMode, Pick<StudioVideoOption, "description" | "label">> = {
  ai_photo: { label: "AI photos", description: "AI photos for every scene" },
  ai_video: { label: "AI video", description: "AI video for every scene" },
  custom: { label: "Custom visual", description: "Upload your own photo or video" },
  standard: { label: "Standard", description: "Stock assets + AI photos" },
};

export const getStudioVideoOptionCopy = (option: StudioVideoOption, locale: string): StudioVideoOption => {
  if (locale !== "en") {
    return option;
  }

  if (option.id === "ai_photo") {
    return {
      ...option,
      description: "AI photos for every scene",
      duration: "1–2 minutes",
      label: "AI photos",
    };
  }

  return {
    ...option,
    ...(studioVideoOptionEnglishCopy[option.id] ?? {}),
    ...(option.id === "ai_video" ? { duration: "3–5 minutes" } : {}),
  };
};

export const buildWorkspaceMediaAssetProxyUrl = (assetId: number) => `/api/workspace/media-assets/${Math.trunc(assetId)}`;

export const buildWorkspaceMediaAssetPlaybackUrl = (assetId: number) =>
  `/api/workspace/media-assets/${Math.trunc(assetId)}/playback`;

export const WORKSPACE_MEDIA_ASSET_RAW_PROXY_ROUTE_PATTERN =
  /^\/api\/(?:workspace\/media-assets\/\d+|media\/\d+\/download)(?:[/?#]|$)/i;

export const WORKSPACE_VIDEO_FILE_NAME_PATTERN = /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i;

export const getPositiveWorkspaceMediaAssetId = (value: unknown) =>
  Number.isFinite(Number(value)) && Number(value) > 0 ? Math.trunc(Number(value)) : null;

export const hasWorkspaceSegmentEditorGeneratedShortsFromProject = (
  projects: ReadonlyArray<Pick<WorkspaceProject, "adId" | "editedFromProjectAdId" | "versionRootProjectAdId">>,
  projectId: number | null | undefined,
) => {
  const sourceProjectId = getPositiveWorkspaceMediaAssetId(projectId);
  if (!sourceProjectId) {
    return false;
  }

  return projects.some((project) => {
    const currentProjectId = getPositiveWorkspaceMediaAssetId(project.adId);
    if (!currentProjectId || currentProjectId === sourceProjectId) {
      return false;
    }

    return (
      getPositiveWorkspaceMediaAssetId(project.editedFromProjectAdId) === sourceProjectId ||
      getPositiveWorkspaceMediaAssetId(project.versionRootProjectAdId) === sourceProjectId
    );
  });
};

export const getWorkspaceMediaAssetResolvedPreviewUrl = (
  asset:
    | {
        assetId?: number | null;
        fileName?: string | null;
        mimeType?: string | null;
        remoteUrl?: string | null;
      }
    | null
    | undefined,
) => {
  const assetId =
    Number.isFinite(Number(asset?.assetId)) && Number(asset?.assetId) > 0
      ? Math.trunc(Number(asset?.assetId))
      : null;
  const fileName = String(asset?.fileName ?? "").trim();
  const mimeType = String(asset?.mimeType ?? "").trim().toLowerCase();
  const remoteUrl = String(asset?.remoteUrl ?? "").trim();
  const isVideoAsset =
    mimeType.startsWith("video/") ||
    WORKSPACE_VIDEO_FILE_NAME_PATTERN.test(fileName);

  if (assetId && isVideoAsset && (!remoteUrl || WORKSPACE_MEDIA_ASSET_RAW_PROXY_ROUTE_PATTERN.test(remoteUrl))) {
    return buildWorkspaceMediaAssetPlaybackUrl(assetId);
  }

  if (remoteUrl) {
    return remoteUrl;
  }

  return assetId ? buildWorkspaceMediaAssetProxyUrl(assetId) : null;
};

export const getWorkspaceMediaAssetDurablePreviewUrl = (
  asset:
    | {
        assetId?: number | null;
        fileName?: string | null;
        mimeType?: string | null;
        remoteUrl?: string | null;
      }
    | null
    | undefined,
) => {
  const assetId = getPositiveWorkspaceMediaAssetId(asset?.assetId);
  if (!assetId) {
    return getWorkspaceMediaAssetResolvedPreviewUrl(asset);
  }

  const fileName = String(asset?.fileName ?? "").trim();
  const mimeType = String(asset?.mimeType ?? "").trim().toLowerCase();
  const isVideoAsset =
    mimeType.startsWith("video/") ||
    WORKSPACE_VIDEO_FILE_NAME_PATTERN.test(fileName);

  return isVideoAsset ? buildWorkspaceMediaAssetPlaybackUrl(assetId) : buildWorkspaceMediaAssetProxyUrl(assetId);
};

export const getStudioCustomAssetPreviewUrl = (
  asset:
    | Pick<StudioBrandLogoFile, "assetId" | "dataUrl" | "fileName" | "mimeType" | "objectUrl">
    | Pick<StudioCustomMusicFile, "assetId" | "dataUrl" | "objectUrl">
    | Pick<StudioCustomVideoFile, "assetId" | "dataUrl" | "fileName" | "mimeType" | "objectUrl" | "remoteUrl">
    | null
    | undefined,
) => {
  const objectUrl = typeof asset?.objectUrl === "string" ? asset.objectUrl.trim() : "";
  if (objectUrl) {
    return objectUrl;
  }

  const dataUrl = typeof asset?.dataUrl === "string" ? asset.dataUrl.trim() : "";
  if (dataUrl) {
    return dataUrl;
  }

  const remoteUrl = getWorkspaceMediaAssetResolvedPreviewUrl({
    assetId:
      Number.isFinite(Number((asset as { assetId?: unknown } | null | undefined)?.assetId)) &&
      Number((asset as { assetId?: unknown } | null | undefined)?.assetId) > 0
        ? Math.trunc(Number((asset as { assetId?: unknown }).assetId))
        : null,
    fileName:
      typeof (asset as { fileName?: unknown } | null | undefined)?.fileName === "string"
        ? String((asset as { fileName?: string }).fileName)
        : "",
    mimeType:
      typeof (asset as { mimeType?: unknown } | null | undefined)?.mimeType === "string"
        ? String((asset as { mimeType?: string }).mimeType)
        : "",
    remoteUrl:
    typeof (asset as { remoteUrl?: unknown } | null | undefined)?.remoteUrl === "string"
        ? String((asset as { remoteUrl?: string }).remoteUrl)
        : "",
  });
  if (remoteUrl) {
    return remoteUrl;
  }

  return null;
};

export const getStudioSceneSoundAssetPreviewUrl = (
  asset: Pick<StudioCustomVideoFile, "assetId" | "dataUrl" | "fileName" | "mimeType" | "objectUrl" | "remoteUrl"> | null | undefined,
) => {
  const assetId =
    Number.isFinite(Number(asset?.assetId)) && Number(asset?.assetId) > 0
      ? Math.trunc(Number(asset?.assetId))
      : null;
  if (assetId) {
    return buildWorkspaceMediaAssetPlaybackUrl(assetId);
  }

  return getStudioCustomAssetPreviewUrl(asset);
};

export const getStudioSceneSoundAssetPreviewMediaKind = (
  asset: Pick<StudioCustomVideoFile, "fileName" | "mimeType"> | null | undefined,
): "audio" | "video" => {
  const fileName = String(asset?.fileName ?? "").trim();
  const mimeType = String(asset?.mimeType ?? "").trim().toLowerCase();
  return mimeType.startsWith("video/") || WORKSPACE_VIDEO_FILE_NAME_PATTERN.test(fileName) ? "video" : "audio";
};

export const getWorkspaceMediaAssetFileName = (asset: WorkspaceMediaAssetRef | null | undefined, fallbackName: string) => {
  const storageFileName = String(asset?.storageKey ?? "").split("/").pop()?.trim();
  const downloadFileName = String(asset?.downloadPath ?? asset?.downloadUrl ?? asset?.playbackUrl ?? "").split("/").pop()?.split("?")[0]?.trim();
  return storageFileName || downloadFileName || fallbackName;
};

export const createStudioCustomVideoFileFromWorkspaceMediaAsset = (
  asset: WorkspaceMediaAssetRef | null | undefined,
  options: {
    fallbackFileName: string;
    fallbackMimeType?: string;
    fallbackRemoteUrl?: string | null;
    posterUrl?: string | null;
  },
): StudioCustomVideoFile | null => {
  const assetId =
    Number.isFinite(Number(asset?.assetId)) && Number(asset?.assetId) > 0
      ? Math.trunc(Number(asset?.assetId))
      : undefined;
  const fileName = getWorkspaceMediaAssetFileName(asset, options.fallbackFileName);
  const remoteUrl = getWorkspaceMediaAssetResolvedPreviewUrl({
    assetId: assetId ?? null,
    fileName,
    mimeType: String(asset?.mimeType ?? "").trim() || options.fallbackMimeType || "video/mp4",
    remoteUrl:
    String(asset?.downloadPath ?? "").trim() ||
    String(asset?.downloadUrl ?? "").trim() ||
    String(asset?.playbackUrl ?? "").trim() ||
    String(asset?.originalUrl ?? "").trim() ||
    String(options.fallbackRemoteUrl ?? "").trim() ||
      "",
  });

  if (!assetId && !remoteUrl) {
    return null;
  }

  return {
    assetId,
    fileName,
    fileSize: 0,
    mimeType: String(asset?.mimeType ?? "").trim() || options.fallbackMimeType || "video/mp4",
    posterUrl: String(options.posterUrl ?? "").trim() || undefined,
    remoteUrl: remoteUrl || undefined,
    source: "media-library",
  };
};

export const createWorkspaceSegmentSceneSoundAsset = (
  segment: WorkspaceSegmentEditorSegment,
  fallbackSegmentIndex: number,
): StudioCustomVideoFile | null => {
  const explicitAsset = (segment as Partial<WorkspaceSegmentEditorDraftSegment>).sceneSoundAsset ?? null;
  const camelAsset = explicitAsset ?? segment.sceneSound ?? null;
  const snakeAsset = segment.scene_sound ?? null;
  const assetId =
    getPositiveWorkspaceMediaAssetId(camelAsset?.assetId) ??
    getPositiveWorkspaceMediaAssetId(segment.sceneSoundAssetId) ??
    getPositiveWorkspaceMediaAssetId(snakeAsset?.media_asset_id) ??
    getPositiveWorkspaceMediaAssetId(segment.scene_sound_asset_id);
  const fileName =
    String(camelAsset?.fileName ?? "").trim() ||
    String(snakeAsset?.file_name ?? "").trim() ||
    `segment-${fallbackSegmentIndex + 1}-scene-sound.wav`;
  const mimeType =
    String(camelAsset?.mimeType ?? "").trim() ||
    String(snakeAsset?.mime_type ?? "").trim() ||
    "audio/wav";
  const rawRemoteUrl =
    String(camelAsset?.remoteUrl ?? "").trim() ||
    String(snakeAsset?.download_url ?? "").trim() ||
    String(snakeAsset?.remote_url ?? "").trim() ||
    String(snakeAsset?.url ?? "").trim();
  const remoteUrl = getWorkspaceMediaAssetResolvedPreviewUrl({
    assetId,
    fileName,
    mimeType,
    remoteUrl: rawRemoteUrl,
  });

  if (!assetId && !remoteUrl) {
    return null;
  }

  return {
    assetId: assetId ?? undefined,
    fileName,
    fileSize: Math.max(0, Number(camelAsset?.fileSize ?? snakeAsset?.file_size ?? 0) || 0),
    mimeType,
    remoteUrl: remoteUrl ?? undefined,
    source: "media-library",
  };
};

export const createWorkspaceSegmentVoiceoverAsset = (
  segment: WorkspaceSegmentEditorSegment,
  fallbackSegmentIndex: number,
): StudioCustomVideoFile | null => {
  const camelAsset = segment.voiceover ?? null;
  const assetId =
    getPositiveWorkspaceMediaAssetId(segment.voiceoverAssetId) ??
    getPositiveWorkspaceMediaAssetId(camelAsset?.media_asset_id) ??
    getPositiveWorkspaceMediaAssetId(segment.voiceover_asset_id);
  const fileName =
    String(camelAsset?.file_name ?? "").trim() ||
    `segment-${fallbackSegmentIndex + 1}-voiceover.wav`;
  const mimeType =
    String(camelAsset?.mime_type ?? "").trim() ||
    "audio/wav";
  const rawRemoteUrl =
    String(camelAsset?.download_url ?? "").trim() ||
    String(camelAsset?.remote_url ?? "").trim() ||
    String(camelAsset?.url ?? "").trim();
  const remoteUrl = getWorkspaceMediaAssetResolvedPreviewUrl({
    assetId,
    fileName,
    mimeType,
    remoteUrl: rawRemoteUrl,
  });

  if (!assetId && !remoteUrl) {
    return null;
  }

  return {
    assetId: assetId ?? undefined,
    fileName,
    fileSize: Math.max(0, Number(camelAsset?.file_size ?? 0) || 0),
    mimeType,
    remoteUrl: remoteUrl ?? undefined,
    source: "media-library",
  };
};

export const truncateStudioCustomAssetName = (value: string, maxChars = STUDIO_CUSTOM_ASSET_NAME_MAX_CHARS) => {
  const normalized = value.trim();

  if (!normalized || normalized.length <= maxChars) {
    return normalized;
  }

  const lastDotIndex = normalized.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === normalized.length - 1) {
    return `${normalized.slice(0, Math.max(1, maxChars - 3))}...`;
  }

  const extension = normalized.slice(lastDotIndex);
  const baseMaxChars = maxChars - extension.length - 3;

  if (baseMaxChars <= 0) {
    return `${normalized.slice(0, Math.max(1, maxChars - 3))}...`;
  }

  return `${normalized.slice(0, baseMaxChars)}...${extension}`;
};

export const hasStudioBranding = (options: { brandLogoFile?: StudioBrandLogoFile | null; brandText?: string | null }) =>
  Boolean(options.brandLogoFile) || Boolean(String(options.brandText ?? "").trim());

export const isWorkspaceSegmentImageFile = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase();
  return STUDIO_ALLOWED_SEGMENT_CUSTOM_IMAGE_EXTENSIONS.some((extension) => normalized.endsWith(extension));
};

export const getWorkspaceSegmentCustomPreviewKind = (customVideo: StudioCustomVideoFile | null): WorkspaceSegmentPreviewKind | null => {
  if (!customVideo) {
    return null;
  }

  if (customVideo.mimeType.startsWith("image/") || isWorkspaceSegmentImageFile(customVideo.fileName)) {
    return "image";
  }

  return "video";
};

export const normalizeWorkspaceSegmentAiPhotoPrompt = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

export const normalizeWorkspaceSegmentMediaType = (value: unknown): WorkspaceSegmentMediaType =>
  String(value ?? "").trim().toLowerCase() === "photo" ? "photo" : "video";

export const normalizeWorkspaceSegmentSceneSoundPrompt = normalizeWorkspaceSegmentAiPhotoPrompt;

export const WORKSPACE_SEGMENT_SCENE_SOUND_DEFAULT_PROMPT =
  "Generate realistic synchronized sound effects and ambient audio.\nNo speech, no narration, no vocals, no background music.";

export const resolveWorkspaceSegmentSceneSoundPrompt = (value: unknown) =>
  normalizeWorkspaceSegmentSceneSoundPrompt(value) || WORKSPACE_SEGMENT_SCENE_SOUND_DEFAULT_PROMPT;

export const hasWorkspaceSegmentDisplayAiVideoAsset = (segment: Pick<
  WorkspaceSegmentEditorDraftSegment,
  "aiVideoAsset" | "aiVideoGeneratedMode" | "videoAction"
>, mode?: WorkspaceSegmentAiVideoMode) =>
  Boolean(segment.aiVideoAsset) &&
  (!mode ||
    segment.aiVideoGeneratedMode === mode ||
    (!segment.aiVideoGeneratedMode &&
      ((mode === "ai_video" && segment.videoAction === "ai") ||
        (mode === "photo_animation" && segment.videoAction === "photo_animation") ||
        (mode === "talking_photo" && segment.videoAction === "talking_photo"))));

export const getWorkspaceSegmentDisplayAiVideoAssetUrl = (segment: Pick<
  WorkspaceSegmentEditorDraftSegment,
  "aiVideoAsset" | "aiVideoGeneratedMode" | "videoAction"
>, mode?: WorkspaceSegmentAiVideoMode) =>
  hasWorkspaceSegmentDisplayAiVideoAsset(segment, mode) ? getStudioCustomAssetPreviewUrl(segment.aiVideoAsset) : null;

export const getWorkspaceSegmentPendingImageEditSourceAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
): StudioCustomVideoFile | null => {
  if (segment.imageEditAsset) {
    return null;
  }

  if (getWorkspaceSegmentCustomPreviewKind(segment.aiPhotoAsset) === "image") {
    return segment.aiPhotoAsset;
  }

  if (getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "image") {
    return segment.customVideo;
  }

  if (getWorkspaceSegmentCustomPreviewKind(segment.photoAnimationSourceAsset) === "image") {
    return segment.photoAnimationSourceAsset;
  }

  return null;
};

export const getWorkspaceSegmentDraftVisualAsset = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (latestVisualAction === "ai" || latestVisualAction === "photo_animation" || latestVisualAction === "talking_photo") {
    return segment.aiVideoAsset;
  }

  if (latestVisualAction === "image_edit") {
    return segment.imageEditAsset ?? getWorkspaceSegmentPendingImageEditSourceAsset(segment);
  }

  if (latestVisualAction === "custom") {
    return segment.customVideo;
  }

  if (latestVisualAction === "ai_photo") {
    return segment.aiPhotoAsset;
  }

  return null;
};

export const getWorkspaceSegmentOriginalPhotoAsset = (segment: WorkspaceSegmentEditorDraftSegment): StudioCustomVideoFile | null => {
  const hasOriginalPhotoAsset = isWorkspacePhotoMediaAsset(segment.originalAsset);
  if (segment.mediaType !== "photo" && !hasOriginalPhotoAsset) {
    return null;
  }

  const originalRemoteUrl =
    segment.originalExternalPreviewUrl ??
    segment.originalExternalPlaybackUrl ??
    segment.originalPreviewUrl ??
    segment.originalPlaybackUrl ??
    null;
  const remoteUrl = hasOriginalPhotoAsset
    ? originalRemoteUrl ??
      getWorkspaceSegmentPreferredStillPreviewUrl(segment) ??
      segment.currentExternalPreviewUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentPlaybackUrl ??
      ""
    : getWorkspaceSegmentPreferredStillPreviewUrl(segment)
      ?? segment.currentPreviewUrl
      ?? segment.originalPreviewUrl
      ?? segment.currentPlaybackUrl
      ?? segment.originalPlaybackUrl
      ?? segment.currentExternalPreviewUrl
      ?? segment.originalExternalPreviewUrl
      ?? "";
  if (!remoteUrl) {
    return null;
  }

  return {
    fileName: `segment-photo-${segment.index + 1}.jpg`,
    fileSize: 0,
    mimeType: "image/jpeg",
    remoteUrl,
  };
};

export const getWorkspaceSegmentCurrentPhotoAsset = (segment: WorkspaceSegmentEditorDraftSegment): StudioCustomVideoFile | null => {
  const currentStillUrl =
    getWorkspaceSegmentStillPreviewUrlsFromValues(segment, [
      segment.currentExternalPreviewUrl,
      segment.currentExternalPlaybackUrl,
      segment.currentPreviewUrl,
      segment.currentPlaybackUrl,
    ])[0] ?? null;

  if (!currentStillUrl) {
    return null;
  }

  if (
    !isWorkspacePhotoMediaAsset(segment.currentAsset) &&
    !isWorkspaceSegmentCurrentVisualDifferentFromOriginal(segment) &&
    segment.mediaType !== "photo"
  ) {
    return null;
  }

  return {
    fileName: `segment-current-photo-${segment.index + 1}.jpg`,
    fileSize: 0,
    mimeType: "image/jpeg",
    remoteUrl: currentStillUrl,
  };
};

export const createWorkspaceSegmentStillFrameAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
  remoteUrl: string,
): StudioCustomVideoFile => ({
  fileName: `segment-frame-${segment.index + 1}.jpg`,
  fileSize: 0,
  mimeType: "image/jpeg",
  remoteUrl,
});

export const getWorkspaceSegmentFallbackStillFrameAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
): StudioCustomVideoFile | null => {
  const draftVisualAsset = getWorkspaceSegmentDraftVisualAsset(segment);
  const draftPosterUrl =
    getWorkspaceSegmentCustomPreviewKind(draftVisualAsset) === "video" ? draftVisualAsset?.posterUrl : null;
  const stillUrl =
    getWorkspaceSegmentPreferredStillPreviewUrl(segment) ||
    draftPosterUrl ||
    segment.currentPosterUrl ||
    segment.originalPosterUrl ||
    "";

  return stillUrl ? createWorkspaceSegmentStillFrameAsset(segment, stillUrl) : null;
};

export const getWorkspaceSegmentLatestEditablePhotoAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
): StudioCustomVideoFile | null => {
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);
  const originalPhotoAsset = getWorkspaceSegmentOriginalPhotoAsset(segment);
  const currentPhotoAsset = getWorkspaceSegmentCurrentPhotoAsset(segment);

  if (latestVisualAction === "custom") {
    if (getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "image" && segment.customVideo) {
      return segment.customVideo;
    }

    return currentPhotoAsset ?? originalPhotoAsset ?? getWorkspaceSegmentFallbackStillFrameAsset(segment);
    }

  if (latestVisualAction === "image_edit") {
    if (getWorkspaceSegmentCustomPreviewKind(segment.imageEditAsset) === "image" && segment.imageEditAsset) {
      return segment.imageEditAsset;
    }

    return (
      currentPhotoAsset ??
      (getWorkspaceSegmentCustomPreviewKind(segment.aiPhotoAsset) === "image" ? segment.aiPhotoAsset : null) ??
      originalPhotoAsset ??
      getWorkspaceSegmentFallbackStillFrameAsset(segment)
    );
  }

  if (latestVisualAction === "ai_photo") {
    if (getWorkspaceSegmentCustomPreviewKind(segment.aiPhotoAsset) === "image" && segment.aiPhotoAsset) {
      return segment.aiPhotoAsset;
    }

    return currentPhotoAsset ?? originalPhotoAsset ?? getWorkspaceSegmentFallbackStillFrameAsset(segment);
  }

  if (latestVisualAction === "photo_animation" || latestVisualAction === "talking_photo") {
    if (getWorkspaceSegmentCustomPreviewKind(segment.photoAnimationSourceAsset) === "image" && segment.photoAnimationSourceAsset) {
      return segment.photoAnimationSourceAsset;
    }

    if (getWorkspaceSegmentCustomPreviewKind(segment.imageEditAsset) === "image" && segment.imageEditAsset) {
      return segment.imageEditAsset;
    }

    if (getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "image" && segment.customVideo) {
      return segment.customVideo;
    }

    if (getWorkspaceSegmentCustomPreviewKind(segment.aiPhotoAsset) === "image" && segment.aiPhotoAsset) {
      return segment.aiPhotoAsset;
    }

    return currentPhotoAsset ?? originalPhotoAsset ?? getWorkspaceSegmentFallbackStillFrameAsset(segment);
  }

  if (latestVisualAction === "original") {
    return currentPhotoAsset ?? originalPhotoAsset ?? getWorkspaceSegmentFallbackStillFrameAsset(segment);
  }

      return null;
};

export const getWorkspaceSegmentPhotoAnimationSourceAsset = (segment: WorkspaceSegmentEditorDraftSegment) => {
  return getWorkspaceSegmentLatestEditablePhotoAsset(segment);
};

export const getWorkspaceSegmentDurationExtensionStillSourceAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
): StudioCustomVideoFile | null => getWorkspaceSegmentPhotoAnimationSourceAsset(segment);

export const getWorkspaceSegmentFallbackPreviewKind = (
  segment: Pick<WorkspaceSegmentEditorDraftSegment, "mediaType">,
): WorkspaceSegmentPreviewKind => (segment.mediaType === "photo" ? "image" : "video");

export const getWorkspaceSegmentSelectedVisualPreviewKind = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentPreviewKind => {
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (shouldUseWorkspaceSegmentAiPhotoRenderedStillPreview(segment) && latestVisualAction !== "photo_animation") {
    return "image";
  }

  if (latestVisualAction === "ai" || latestVisualAction === "photo_animation" || latestVisualAction === "talking_photo") {
    return "video";
  }

  return (
    getWorkspaceSegmentCustomPreviewKind(getWorkspaceSegmentDraftVisualAsset(segment)) ??
    getWorkspaceSegmentFallbackPreviewKind(segment)
  );
};

export const isWorkspaceSegmentGeneratedVideoVisual = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "video") {
    return false;
  }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);
  if (latestVisualAction === "ai" || latestVisualAction === "photo_animation") {
    return true;
  }

  const markers = [
    segment.currentSourceKind,
    segment.originalSourceKind,
    segment.currentAsset?.sourceKind,
    segment.originalAsset?.sourceKind,
    segment.currentAsset?.libraryKind,
    segment.originalAsset?.libraryKind,
    segment.currentAsset?.kind,
    segment.originalAsset?.kind,
    segment.currentAsset?.role,
    segment.originalAsset?.role,
  ]
    .map((value) => String(value ?? "").trim().toLowerCase().replace(/-/g, "_"))
    .filter(Boolean);

  return markers.some((marker) => marker === "ai_generated" || marker === "ai_video" || marker === "photo_animation");
};

export const canWorkspaceSegmentUseVideoExtensionTool = (segment: WorkspaceSegmentEditorDraftSegment) =>
  getWorkspaceSegmentLatestVisualAction(segment) !== "photo_animation" &&
  getWorkspaceSegmentSelectedVisualPreviewKind(segment) === "video" &&
  Boolean(getWorkspaceSegmentDurationExtensionStillSourceAsset(segment));

export const getWorkspaceSegmentEditorVisualDurationMaxSeconds = (
  _segment: WorkspaceSegmentEditorDraftSegment,
) => WORKSPACE_SEGMENT_EDITOR_MAX_VISUAL_DURATION_SECONDS;

export const resolveWorkspaceSegmentVisualDurationMaxGuard = (
  segment: WorkspaceSegmentEditorDraftSegment,
  requestedDurationSeconds: number | null | undefined,
) => {
  const requestedDuration = normalizeWorkspaceSegmentManualDurationSeconds(requestedDurationSeconds);
  if (requestedDuration === null) {
    return null;
  }

  const maximumDuration = getWorkspaceSegmentEditorVisualDurationMaxSeconds(segment);
  if (requestedDuration <= maximumDuration + WORKSPACE_SEGMENT_PHOTO_DURATION_AUDIO_GUARD_EPSILON_SECONDS) {
    return null;
  }

  return {
    limitKind: "visual" as const,
    maximumDurationSeconds: roundWorkspaceSegmentTimelineSeconds(maximumDuration),
    requestedDurationSeconds: roundWorkspaceSegmentTimelineSeconds(requestedDuration),
  };
};

export const getWorkspaceSegmentPreviewKind = (segment: WorkspaceSegmentEditorDraftSegment): WorkspaceSegmentPreviewKind => {
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (shouldUseWorkspaceSegmentAiPhotoRenderedStillPreview(segment) && latestVisualAction !== "photo_animation") {
    return "image";
  }

  // Fresh segment sessions can promote a photo segment to a server-backed animation
  // before the local `videoAction` catches up. The carousel must treat that case as
  // video, otherwise it falls back to synthetic pan/zoom playback over the source photo.
  if (latestVisualAction === "ai") {
    return getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "ai_video")
      ? "video"
      : getWorkspaceSegmentFallbackPreviewKind(segment);
  }

  if (latestVisualAction === "photo_animation" || latestVisualAction === "talking_photo") {
    const generatedMode = latestVisualAction === "talking_photo" ? "talking_photo" : "photo_animation";
    const isPendingDurationExtension =
      latestVisualAction === "photo_animation" &&
      getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment) !== null;
    return getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, generatedMode) ||
      isWorkspaceSegmentServerPhotoAnimationOverride(segment) ||
      isWorkspacePhotoAnimationMediaAsset(segment.currentAsset) ||
      isPendingDurationExtension
      ? "video"
      : getWorkspaceSegmentCustomPreviewKind(segment.photoAnimationSourceAsset) === "image"
        ? "image"
        : getWorkspaceSegmentFallbackPreviewKind(segment);
  }

  return (
    getWorkspaceSegmentCustomPreviewKind(getWorkspaceSegmentDraftVisualAsset(segment)) ??
    getWorkspaceSegmentFallbackPreviewKind(segment)
  );
};

export const normalizeWorkspaceMediaAssetToken = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

const normalizeWorkspaceMediaAssetBoolean = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return null;
};

const getWorkspaceMediaAssetRenderedAnimationMode = (asset: WorkspaceMediaAssetRef | null | undefined) =>
  normalizeWorkspaceMediaAssetToken(
    asset?.renderedAnimationMode ?? (asset as { rendered_animation_mode?: string | null } | null | undefined)?.rendered_animation_mode,
  );

const getWorkspaceMediaAssetRenderedViaI2v = (asset: WorkspaceMediaAssetRef | null | undefined) =>
  normalizeWorkspaceMediaAssetBoolean(
    asset?.renderedViaI2v ?? (asset as { rendered_via_i2v?: boolean | string | number | null } | null | undefined)?.rendered_via_i2v,
  );

export const getWorkspaceMediaAssetSignature = (asset: WorkspaceMediaAssetRef | null | undefined) =>
  [
    asset?.kind,
    asset?.libraryKind,
    asset?.role,
    asset?.sourceKind,
    asset?.renderedAnimationMode,
    String(asset?.renderedViaI2v ?? ""),
    asset?.storageKey,
    asset?.downloadPath,
    asset?.downloadUrl,
    asset?.originalUrl,
  ]
    .map(normalizeWorkspaceMediaAssetToken)
    .filter(Boolean)
    .join(" ");

export const isWorkspacePhotoAnimationMediaAsset = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  const signature = getWorkspaceMediaAssetSignature(asset);
  return (
    signature.includes("photo_animation") ||
    signature.includes("photo-animation") ||
    signature.includes("image_to_video") ||
    signature.includes("image-to-video") ||
    signature.includes("animate_photo") ||
    signature.includes("animate-photo")
  );
};

export const isWorkspaceTalkingPhotoMediaAsset = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  const signature = getWorkspaceMediaAssetSignature(asset);
  return (
    signature.includes("talking_photo") ||
    signature.includes("talking-photo") ||
    signature.includes("talking_avatar") ||
    signature.includes("talking-avatar")
  );
};

export const isWorkspacePhotoMediaAsset = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  const mediaType = normalizeWorkspaceMediaAssetToken(asset?.mediaType);
  const mimeType = normalizeWorkspaceMediaAssetToken(asset?.mimeType);
  return mediaType === "photo" || mediaType === "image" || mimeType.startsWith("image/");
};

export const isWorkspaceVideoMediaAsset = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  const mediaType = normalizeWorkspaceMediaAssetToken(asset?.mediaType);
  const mimeType = normalizeWorkspaceMediaAssetToken(asset?.mimeType);
  return mediaType === "video" || mimeType.startsWith("video/");
};

export const getWorkspaceMediaAssetBaseProxyUrlAssetId = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(normalizedValue, "http://localhost");
    const match = url.pathname.match(/^\/api\/workspace\/media-assets\/(\d+)$/i);
    if (!match) {
      return null;
    }

    const assetId = Number(match[1]);
    return Number.isFinite(assetId) && assetId > 0 ? Math.trunc(assetId) : null;
  } catch {
    return null;
  }
};

export const isWorkspaceMediaAssetRefAssetId = (
  asset: WorkspaceMediaAssetRef | null | undefined,
  assetId: number | null,
) => {
  if (assetId === null) {
    return false;
  }

  const candidateAssetId = Number(asset?.assetId);
  return Number.isFinite(candidateAssetId) && Math.trunc(candidateAssetId) === assetId;
};

export const isWorkspaceAiPhotoRenderedStillAsset = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  if (!isWorkspaceVideoMediaAsset(asset)) {
    return false;
  }

  const signature = getWorkspaceMediaAssetSignature(asset);
  const libraryKind = normalizeWorkspaceMediaAssetToken(asset?.libraryKind);
  const sourceKind = normalizeWorkspaceMediaAssetToken(asset?.sourceKind);
  const isRenderedSegment =
    signature.includes("rendered_segment") ||
    signature.includes("current_rendered_segment") ||
    signature.includes("/rendered_segment/");
  const hasAiPhotoMarker =
    libraryKind === "ai_photo" ||
    signature.includes("source_ai_image") ||
    signature.includes("ai_photo") ||
    signature.includes("ai-photo") ||
    signature.includes("segment_animation_fallback");

  return isRenderedSegment && hasAiPhotoMarker && (libraryKind === "ai_photo" || sourceKind === "ai_generated");
};

export const isWorkspaceHoldableRenderedPhotoVisualAsset = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  if (!isWorkspaceVideoMediaAsset(asset)) {
    return false;
  }

  const signature = getWorkspaceMediaAssetSignature(asset);
  const libraryKind = normalizeWorkspaceMediaAssetToken(asset?.libraryKind);
  const renderedAnimationMode = getWorkspaceMediaAssetRenderedAnimationMode(asset);
  const renderedViaI2v = getWorkspaceMediaAssetRenderedViaI2v(asset);
  const isRenderedSegment =
    signature.includes("rendered_segment") ||
    signature.includes("current_rendered_segment") ||
    signature.includes("/rendered_segment/");
  const hasPhotoMarker =
    libraryKind === "photo_animation" ||
    libraryKind === "ai_photo" ||
    signature.includes("photo_animation") ||
    signature.includes("photo-animation") ||
    signature.includes("source_ai_image") ||
    signature.includes("ai_photo") ||
    signature.includes("ai-photo");
  const hasGeneratedVideoMarker =
    renderedViaI2v === true ||
    renderedAnimationMode === "i2v" ||
    signature.includes("wavespeed") ||
    signature.includes("deapi");
  const hasStillRenderMarker =
    renderedAnimationMode === "ffmpeg" ||
    renderedAnimationMode === "still" ||
    renderedAnimationMode === "image" ||
    signature.includes("rendered_segment_cache") ||
    signature.includes("segment_animation_fallback");

  return isRenderedSegment && hasPhotoMarker && hasStillRenderMarker && !hasGeneratedVideoMarker;
};

export const isWorkspaceSegmentAiPhotoRenderedStill = (segment: WorkspaceSegmentEditorDraftSegment) =>
  Boolean(
    isWorkspaceAiPhotoRenderedStillAsset(segment.currentAsset) ||
      isWorkspaceAiPhotoRenderedStillAsset(segment.originalAsset),
  );

export const isWorkspaceSegmentHoldableRenderedPhotoVisual = (segment: WorkspaceSegmentEditorDraftSegment) =>
  Boolean(
    isWorkspaceHoldableRenderedPhotoVisualAsset(segment.currentAsset) ||
      isWorkspaceHoldableRenderedPhotoVisualAsset(segment.originalAsset),
  );

const hasWorkspaceSegmentCurrentDraftVisualReference = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const currentVisualIdentity = getWorkspaceSegmentCurrentVisualIdentityKey(segment);
  const originalVisualIdentity = getWorkspaceSegmentOriginalVisualIdentityKey(segment);

  return Boolean(currentVisualIdentity && currentVisualIdentity !== originalVisualIdentity);
};

export const hasWorkspaceSegmentExplicitDraftVisual = (segment: WorkspaceSegmentEditorDraftSegment) =>
  (segment.videoAction === "custom" && (Boolean(segment.customVideo) || hasWorkspaceSegmentCurrentDraftVisualReference(segment))) ||
  (segment.videoAction === "ai_photo" && Boolean(segment.aiPhotoAsset)) ||
  (segment.videoAction === "image_edit" && Boolean(segment.imageEditAsset)) ||
  ((segment.videoAction === "ai" || segment.videoAction === "photo_animation" || segment.videoAction === "talking_photo") &&
    Boolean(segment.aiVideoAsset));

export const shouldUseWorkspaceSegmentAiPhotoRenderedStillPreview = (segment: WorkspaceSegmentEditorDraftSegment) =>
  isWorkspaceSegmentAiPhotoRenderedStill(segment) && !hasWorkspaceSegmentExplicitDraftVisual(segment);

export const buildWorkspaceMediaAssetPosterUrl = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  const assetId = Number(asset?.assetId);
  if (!Number.isFinite(assetId) || assetId <= 0 || !isWorkspaceVideoMediaAsset(asset)) {
    return null;
  }

  return `/api/workspace/media-assets/${Math.trunc(assetId)}/poster`;
};

const getWorkspaceMediaAssetPosterUrlAssetId = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(normalizedValue, "http://localhost");
    const match = url.pathname.match(/^\/api\/workspace\/media-assets\/(\d+)\/poster$/i);
    if (!match) {
      return null;
    }

    return getPositiveWorkspaceMediaAssetId(match[1]);
  } catch {
    return null;
  }
};

const shouldNormalizeWorkspaceMediaAssetPosterVersion = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return false;
  }

  try {
    const url = new URL(normalizedValue, "http://localhost");
    const version = url.searchParams.get("v");
    return !version || version.includes(":");
  } catch {
    return false;
  }
};

const getWorkspaceStableMediaAssetPosterUrl = (
  asset: WorkspaceMediaAssetRef | null | undefined,
  posterUrl: string | null | undefined,
) => {
  const stablePosterUrl = buildWorkspaceMediaAssetPosterUrl(asset);
  const normalizedPosterUrl = String(posterUrl ?? "").trim();
  const assetId = getPositiveWorkspaceMediaAssetId(asset?.assetId);
  const posterAssetId = getWorkspaceMediaAssetPosterUrlAssetId(normalizedPosterUrl);
  const normalizedMediaAssetPosterUrl = posterAssetId
    ? `/api/workspace/media-assets/${posterAssetId}/poster`
    : null;

  if (
    posterAssetId &&
    (!assetId || posterAssetId === assetId) &&
    shouldNormalizeWorkspaceMediaAssetPosterVersion(normalizedPosterUrl)
  ) {
    return stablePosterUrl ?? normalizedMediaAssetPosterUrl;
  }

  return normalizedPosterUrl || stablePosterUrl;
};

export const buildWorkspaceMediaLibraryAssetPosterUrl = (item: WorkspaceMediaLibraryItem) => {
  const assetId = getPositiveWorkspaceMediaAssetId(item.assetId);
  if (!assetId || item.previewKind !== "video") {
    return null;
  }

  return `/api/workspace/media-assets/${assetId}/poster`;
};

export const getWorkspaceSegmentVideoAssetPosterUrl = (
  segment: WorkspaceSegmentEditorDraftSegment,
  options?: { preferOriginal?: boolean },
) =>
  getUniqueWorkspaceSegmentPreviewUrls(
    options?.preferOriginal
      ? [
          buildWorkspaceMediaAssetPosterUrl(segment.originalAsset),
          buildWorkspaceMediaAssetPosterUrl(segment.currentAsset),
        ]
      : [
          buildWorkspaceMediaAssetPosterUrl(segment.currentAsset),
          buildWorkspaceMediaAssetPosterUrl(segment.originalAsset),
        ],
  )[0] ?? null;

export const isWorkspaceTimelineFallbackMediaAsset = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  if (!asset) {
    return false;
  }

  const signature = [
    asset.kind,
    asset.libraryKind,
    asset.role,
    asset.sourceKind,
    asset.storageKey,
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

  return (
    signature.includes("final_video") ||
    signature.includes("combined_background") ||
    signature.includes("project_background")
  );
};

export const isWorkspaceSegmentScopedPosterUrl = (value: string | null | undefined) =>
  String(value ?? "").includes("/api/workspace/project-segment-poster");

export const buildWorkspaceSegmentScopedPosterUrlFromVideoUrl = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue || !normalizedValue.includes("/api/workspace/project-segment-video")) {
    return null;
  }

  try {
    const videoUrl = new URL(normalizedValue, window.location.origin);
    if (videoUrl.pathname !== "/api/workspace/project-segment-video") {
      return null;
    }

    const projectId = videoUrl.searchParams.get("projectId");
    const segmentIndex = videoUrl.searchParams.get("segmentIndex");
    const source = videoUrl.searchParams.get("source");
    if (!projectId || !segmentIndex || !source) {
      return null;
    }

    const posterParams = new URLSearchParams({
      projectId,
      segmentIndex,
      source,
    });
    const marker = videoUrl.searchParams.get("v");
    if (marker) {
      posterParams.set("v", marker);
    }
    return `/api/workspace/project-segment-poster?${posterParams.toString()}`;
  } catch {
    return null;
  }
};

export const getWorkspaceSegmentCurrentPosterUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const scopedPosterUrl = isWorkspaceSegmentScopedPosterUrl(segment.currentPosterUrl)
    ? segment.currentPosterUrl
    : buildWorkspaceSegmentScopedPosterUrlFromVideoUrl(segment.currentPreviewUrl ?? segment.currentPlaybackUrl);

  if (isWorkspaceTimelineFallbackMediaAsset(segment.currentAsset)) {
    return scopedPosterUrl;
  }

  return getWorkspaceStableMediaAssetPosterUrl(segment.currentAsset, segment.currentPosterUrl);
};

export const getWorkspaceSegmentOriginalPosterUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const scopedPosterUrl = isWorkspaceSegmentScopedPosterUrl(segment.originalPosterUrl)
    ? segment.originalPosterUrl
    : buildWorkspaceSegmentScopedPosterUrlFromVideoUrl(segment.originalPreviewUrl ?? segment.originalPlaybackUrl);

  if (isWorkspaceTimelineFallbackMediaAsset(segment.originalAsset)) {
    return scopedPosterUrl;
  }

  return getWorkspaceStableMediaAssetPosterUrl(segment.originalAsset, segment.originalPosterUrl);
};

export const getWorkspaceMediaAssetIdentityKey = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  const assetId = Number(asset?.assetId);
  if (Number.isFinite(assetId) && assetId > 0) {
    return `asset:${Math.trunc(assetId)}`;
  }

  const storageKey = String(asset?.storageKey ?? "").trim();
  if (storageKey) {
    return `storage:${storageKey}`;
  }

  const urlIdentity = [
    asset?.downloadPath,
    asset?.downloadUrl,
    asset?.playbackUrl,
    asset?.originalUrl,
  ].find((value) => String(value ?? "").trim());
  return urlIdentity ? `url:${String(urlIdentity).trim()}` : null;
};

export const getWorkspaceSegmentCurrentVisualIdentityKey = (
  segment: Pick<
    WorkspaceSegmentEditorSegment,
    | "currentAsset"
    | "currentExternalPlaybackUrl"
    | "currentExternalPreviewUrl"
    | "currentPlaybackUrl"
    | "currentPosterUrl"
    | "currentPreviewUrl"
  >,
) =>
  getWorkspaceMediaAssetIdentityKey(segment.currentAsset) ??
  [
    segment.currentExternalPlaybackUrl,
    segment.currentExternalPreviewUrl,
    segment.currentPosterUrl,
    segment.currentPlaybackUrl,
    segment.currentPreviewUrl,
  ]
    .map((value) => String(value ?? "").trim())
    .find(Boolean) ??
  null;

export const getWorkspaceSegmentOriginalVisualIdentityKey = (
  segment: Pick<
    WorkspaceSegmentEditorSegment,
    | "originalAsset"
    | "originalExternalPlaybackUrl"
    | "originalExternalPreviewUrl"
    | "originalPlaybackUrl"
    | "originalPosterUrl"
    | "originalPreviewUrl"
  >,
) =>
  getWorkspaceMediaAssetIdentityKey(segment.originalAsset) ??
  [
    segment.originalExternalPlaybackUrl,
    segment.originalExternalPreviewUrl,
    segment.originalPosterUrl,
    segment.originalPlaybackUrl,
    segment.originalPreviewUrl,
  ]
    .map((value) => String(value ?? "").trim())
    .find(Boolean) ??
  null;

export const isWorkspaceSegmentOriginalVisualCollapsedIntoCurrent = (segment: WorkspaceSegmentEditorSegment) => {
  const currentIdentity = getWorkspaceSegmentCurrentVisualIdentityKey(segment);
  const originalIdentity = getWorkspaceSegmentOriginalVisualIdentityKey(segment);

  return Boolean(currentIdentity && originalIdentity && currentIdentity === originalIdentity);
};

export const preserveWorkspaceSegmentEditorOriginalVisualReferences = (
  incomingSession: WorkspaceSegmentEditorSession,
  baselineSession: WorkspaceSegmentEditorSession | null | undefined,
): WorkspaceSegmentEditorSession => {
  if (!baselineSession || baselineSession.projectId !== incomingSession.projectId) {
    return incomingSession;
  }

  let hasChanges = false;
  const baselineSegmentsByIndex = new Map(baselineSession.segments.map((segment) => [segment.index, segment] as const));
  const segments = incomingSession.segments.map((segment) => {
    if (!isWorkspaceSegmentOriginalVisualCollapsedIntoCurrent(segment)) {
      return segment;
    }

    const baselineSegment = baselineSegmentsByIndex.get(segment.index);
    if (!baselineSegment) {
      return segment;
    }

    const baselineOriginalIdentity = getWorkspaceSegmentOriginalVisualIdentityKey(baselineSegment);
    const incomingCurrentIdentity = getWorkspaceSegmentCurrentVisualIdentityKey(segment);
    if (!baselineOriginalIdentity || baselineOriginalIdentity === incomingCurrentIdentity) {
      return segment;
    }

    hasChanges = true;
    return {
      ...segment,
      originalAsset: cloneWorkspaceMediaAssetRef(baselineSegment.originalAsset),
      originalExternalPlaybackUrl: baselineSegment.originalExternalPlaybackUrl,
      originalExternalPreviewUrl: baselineSegment.originalExternalPreviewUrl,
      originalPlaybackUrl: baselineSegment.originalPlaybackUrl,
      originalPosterUrl: baselineSegment.originalPosterUrl,
      originalPreviewUrl: baselineSegment.originalPreviewUrl,
      originalSourceKind: baselineSegment.originalSourceKind,
    };
  });

  return hasChanges
    ? {
        ...incomingSession,
        segments,
      }
    : incomingSession;
};

export const resolveWorkspaceSegmentEditorLoadedBaselineSession = (
  incomingSession: WorkspaceSegmentEditorSession,
  existingBaselineSession: WorkspaceSegmentEditorSession | null | undefined,
): WorkspaceSegmentEditorSession =>
  existingBaselineSession?.projectId === incomingSession.projectId ? existingBaselineSession : incomingSession;

export const isWorkspaceSegmentCurrentVisualDifferentFromOriginal = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const currentAssetIdentity = getWorkspaceMediaAssetIdentityKey(segment.currentAsset);
  const originalAssetIdentity = getWorkspaceMediaAssetIdentityKey(segment.originalAsset);

  if (currentAssetIdentity && originalAssetIdentity) {
    return currentAssetIdentity !== originalAssetIdentity;
  }

  if (currentAssetIdentity || originalAssetIdentity) {
    return Boolean(
      segment.currentPlaybackUrl ||
        segment.currentPreviewUrl ||
        segment.currentExternalPlaybackUrl ||
        segment.currentExternalPreviewUrl,
    );
  }

  const currentUrlIdentity = [
    segment.currentExternalPlaybackUrl,
    segment.currentExternalPreviewUrl,
    segment.currentPlaybackUrl,
    segment.currentPreviewUrl,
  ].find((value) => String(value ?? "").trim());
  const originalUrlIdentity = [
    segment.originalExternalPlaybackUrl,
    segment.originalExternalPreviewUrl,
    segment.originalPlaybackUrl,
    segment.originalPreviewUrl,
  ].find((value) => String(value ?? "").trim());

  return Boolean(
    currentUrlIdentity &&
      originalUrlIdentity &&
      String(currentUrlIdentity).trim() !== String(originalUrlIdentity).trim(),
  );
};

export const hasWorkspaceSegmentCurrentVideoReference = (segment: WorkspaceSegmentEditorDraftSegment) =>
  Boolean(
    segment.currentPlaybackUrl ||
      segment.currentExternalPlaybackUrl ||
      segment.currentPreviewUrl ||
      segment.currentExternalPreviewUrl,
  );

export const isWorkspaceSegmentServerPhotoAnimationOverride = (segment: WorkspaceSegmentEditorDraftSegment) =>
  Boolean(
    isWorkspaceSegmentCurrentVisualDifferentFromOriginal(segment) &&
      isWorkspacePhotoMediaAsset(segment.originalAsset) &&
      (isWorkspaceVideoMediaAsset(segment.currentAsset) || segment.mediaType === "video") &&
      hasWorkspaceSegmentCurrentVideoReference(segment),
  );

export const hasWorkspaceSegmentPlayableVideoUrl = (segment: WorkspaceSegmentEditorDraftSegment) =>
  Boolean(
    getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "photo_animation") ||
      getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "talking_photo") ||
      getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "ai_video") ||
      segment.currentPlaybackUrl ||
      segment.currentExternalPlaybackUrl ||
      segment.currentPreviewUrl ||
      segment.currentExternalPreviewUrl ||
      segment.originalPlaybackUrl ||
      segment.originalExternalPlaybackUrl ||
      segment.originalPreviewUrl ||
      segment.originalExternalPreviewUrl,
  );

export const getWorkspaceSegmentLatestVisualAction = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentEditorVideoAction => {
  if (segment.videoAction === "custom" && segment.customVideo) {
    return "custom";
  }

  if (segment.videoAction === "photo_animation") {
    return "photo_animation";
  }

  if (segment.videoAction === "talking_photo") {
    return "talking_photo";
  }

  if (segment.videoAction === "ai") {
    return "ai";
  }

  if (segment.aiVideoGeneratedMode === "photo_animation" && hasWorkspaceSegmentPlayableVideoUrl(segment)) {
    return "photo_animation";
  }

  if (segment.aiVideoGeneratedMode === "talking_photo") {
    return "talking_photo";
  }

  if (isWorkspaceTalkingPhotoMediaAsset(segment.currentAsset)) {
    return "talking_photo";
  }

  // The renderer stores a still photo as an MP4 so it can participate in the
  // final timeline. `libraryKind: photo_animation` describes that render
  // pipeline, while ffmpeg + renderedViaI2v=false proves that no real video
  // animation was generated. Keep the authoritative segment media type here
  // so photo duration controls do not turn into video-extension controls.
  if (segment.mediaType === "photo" && isWorkspaceSegmentHoldableRenderedPhotoVisual(segment)) {
    return segment.videoAction;
  }

  if (isWorkspacePhotoAnimationMediaAsset(segment.currentAsset)) {
    return "photo_animation";
  }

  if (isWorkspaceSegmentServerPhotoAnimationOverride(segment)) {
    return "photo_animation";
  }

  if (
    segment.videoAction === "original" &&
    segment.mediaType === "video" &&
    isWorkspacePhotoMediaAsset(segment.originalAsset) &&
    (segment.currentSourceKind === "ai_generated" || segment.currentAsset?.sourceKind === "ai_generated") &&
    hasWorkspaceSegmentPlayableVideoUrl(segment)
  ) {
    return "photo_animation";
  }

  if (
    segment.videoAction === "image_edit" &&
    !segment.imageEditAsset &&
    segment.mediaType === "video" &&
    hasWorkspaceSegmentPlayableVideoUrl(segment)
  ) {
    return "photo_animation";
  }

  return segment.videoAction;
};

export const doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio = (
  segment: WorkspaceSegmentEditorDraftSegment,
) => getWorkspaceSegmentLatestVisualAction(segment) === "talking_photo";

export const getStudioVideoChipValue = (
  videoMode: StudioVideoMode,
  customVideoFile: StudioCustomVideoFile | null,
  options?: { brandLogoFile?: StudioBrandLogoFile | null; brandText?: string | null; locale?: string },
) => {
  const locale = options?.locale ?? "ru";
  const visualLabel =
    videoMode === "custom"
      ? customVideoFile
        ? truncateStudioCustomAssetName(customVideoFile.fileName)
        : locale === "en"
          ? "Custom visual"
          : "Свой визуал"
      : (() => {
          const option = studioVideoOptions.find((item) => item.id === videoMode);
          return option ? getStudioVideoOptionCopy(option, locale).label : locale === "en" ? "Standard" : "Стандартный";
        })();

  return hasStudioBranding(options ?? {}) ? `${visualLabel} + ${locale === "en" ? "brand" : "бренд"}` : visualLabel;
};

export const getRequiredCreditsForVideoMode = (videoMode: StudioVideoMode) => {
  if (videoMode === "ai_video") {
    return STUDIO_AI_VIDEO_GENERATION_CREDIT_COST;
  }

  return videoMode === "ai_photo"
    ? STUDIO_AI_PHOTO_VIDEO_GENERATION_CREDIT_COST
    : STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST;
};

export const getStudioVoiceCreditCost = (_voiceId: string | null | undefined) => 0;

export const getStudioGenerationRequiredCredits = (
  videoMode: StudioVideoMode,
  options?: {
    aiVideoGenerateAudioEnabled?: boolean;
    isSegmentEditorGeneration?: boolean;
    voiceEnabled?: boolean;
    voiceId?: string | null;
  },
) => {
  const baseCredits = options?.isSegmentEditorGeneration
    ? STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST
    : getRequiredCreditsForVideoMode(videoMode);
  const voiceCredits = options?.voiceEnabled === false ? 0 : getStudioVoiceCreditCost(options?.voiceId);
  const aiVideoAudioCredits =
    !options?.isSegmentEditorGeneration &&
    videoMode === "ai_video" &&
    options?.aiVideoGenerateAudioEnabled
      ? STUDIO_AI_VIDEO_AUDIO_CREDIT_COST
      : 0;
  return baseCredits + voiceCredits + aiVideoAudioCredits;
};

export const getStudioEditVideoGenerationRequiredCredits = (
  options?: { voiceEnabled?: boolean; voiceId?: string | null },
) =>
  getStudioGenerationRequiredCredits("standard", {
    isSegmentEditorGeneration: true,
    voiceEnabled: options?.voiceEnabled,
    voiceId: options?.voiceId,
  });

export const getWorkspaceSegmentEditorVoiceCreditCost = (
  session: WorkspaceSegmentEditorDraftSession | WorkspaceSegmentEditorSession | null | undefined,
) => {
  if (!session) {
    return 0;
  }

  const voiceCreditCosts: number[] = [];
  const globalVoiceId = normalizeWorkspaceSegmentEditorSetting(session.voiceType);

  for (const segment of session.segments) {
    const draftSegment = segment as WorkspaceSegmentEditorDraftSegment;
    if (isWorkspaceSegmentVoiceoverPlaybackFresh(draftSegment, session as WorkspaceSegmentEditorDraftSession)) {
      continue;
    }

    const segmentVoiceId = getWorkspaceSegmentVoiceOverrideId(segment);
    if (segmentVoiceId === "none") {
      continue;
    }

    const effectiveVoiceId = segmentVoiceId ?? (globalVoiceId !== "none" ? globalVoiceId : null);
    if (effectiveVoiceId) {
      voiceCreditCosts.push(getStudioVoiceCreditCost(effectiveVoiceId));
    }
  }

  return Math.max(0, ...voiceCreditCosts);
};

export const getWorkspaceSegmentEditorBulkSceneSoundCreditCost = (
  segmentDurations: readonly (number | null | undefined)[],
) =>
  segmentDurations.reduce<number>(
    (total, durationSeconds) => total + getStudioSegmentSceneSoundCreditCost(durationSeconds),
    0,
  );

export const getWorkspaceSegmentEditorGenerationRequiredCredits = (
  session: WorkspaceSegmentEditorDraftSession | WorkspaceSegmentEditorSession | null | undefined,
) => {
  if (!session) {
    return getStudioEditVideoGenerationRequiredCredits();
  }

  return STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST + getWorkspaceSegmentEditorVoiceCreditCost(session);
};

export const getWorkspaceGenerationRequiredCredits = (
  videoMode: StudioVideoMode,
  options?: {
    aiVideoGenerateAudioEnabled?: boolean;
    isSegmentEditorGeneration?: boolean;
    segmentEditorSession?: WorkspaceSegmentEditorDraftSession | WorkspaceSegmentEditorSession | null;
    voiceEnabled?: boolean;
    voiceId?: string | null;
  },
) => {
  if (options?.segmentEditorSession) {
    return getWorkspaceSegmentEditorGenerationRequiredCredits(options.segmentEditorSession);
  }

  return getStudioGenerationRequiredCredits(videoMode, {
    aiVideoGenerateAudioEnabled: options?.aiVideoGenerateAudioEnabled,
    isSegmentEditorGeneration: options?.isSegmentEditorGeneration,
    voiceEnabled: options?.voiceEnabled,
    voiceId: options?.voiceId,
  });
};

export const getSegmentAiPhotoCreditCost = (quality: StudioSegmentVisualQuality) =>
  STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST_BY_QUALITY[quality] ?? STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST;

export const getWorkspaceReferenceGenerationCreditCost = (
  kind: WorkspaceReferenceKind,
  quality: StudioSegmentVisualQuality,
) =>
  kind === "character"
    ? STUDIO_WORKSPACE_CHARACTER_REFERENCE_CREDIT_COST
    : getSegmentAiPhotoCreditCost(quality);

export const getSegmentAiVideoCreditCost = (
  _quality: StudioSegmentVisualQuality,
  durationSeconds: unknown = 5,
  generateAudio = false,
) => getStudioSegmentAiVideoCreditCost(durationSeconds, generateAudio);

export const getSegmentPhotoAnimationCreditCost = (
  quality: StudioSegmentVisualQuality,
  durationSeconds: unknown = 5,
  generateAudio = false,
) => getStudioSegmentPhotoAnimationCreditCost(quality, durationSeconds, generateAudio);

export const cloneStudioCustomVideoFile = (value: StudioCustomVideoFile | null) => (value ? { ...value } : null);

export const cloneStudioCustomMusicFile = (value: StudioCustomMusicFile | null) => (value ? { ...value } : null);

export const cloneWorkspaceMediaAssetRef = (value: WorkspaceMediaAssetRef | null) => (value ? { ...value } : null);

export const getStudioCustomVideoFileIdentityKey = (asset: StudioCustomVideoFile | null | undefined) => {
  const assetId = getWorkspaceSegmentCustomAssetId(asset);
  if (assetId) {
    return `asset:${assetId}`;
  }

  const remoteAssetId = getWorkspaceMediaAssetBaseProxyUrlAssetId(asset?.remoteUrl);
  if (remoteAssetId) {
    return `asset:${remoteAssetId}`;
  }

  const libraryItemKey = String(asset?.libraryItemKey ?? "").trim();
  if (libraryItemKey) {
    return `library:${libraryItemKey}`;
  }

  const remoteUrl = String(asset?.remoteUrl ?? "").trim();
  return remoteUrl ? `url:${remoteUrl}` : null;
};

export const areStudioCustomVideoFilesSameIdentity = (
  left: StudioCustomVideoFile | null | undefined,
  right: StudioCustomVideoFile | null | undefined,
) => {
  const leftIdentity = getStudioCustomVideoFileIdentityKey(left);
  const rightIdentity = getStudioCustomVideoFileIdentityKey(right);
  return Boolean(leftIdentity && rightIdentity && leftIdentity === rightIdentity);
};

export const getWorkspaceSegmentTimelineHistoryKey = (
  kind: WorkspaceSegmentTimelineHistoryKind,
  segmentIndex?: number | null,
) => `${kind}:${kind === "music" ? "global" : Number(segmentIndex ?? -1)}`;

const cloneWorkspaceSegmentSceneSoundPayload = (
  payload: WorkspaceSegmentSceneSoundPayload | null | undefined,
): WorkspaceSegmentSceneSoundPayload | null => (payload ? { ...payload } : null);

export const buildWorkspaceSegmentSceneSoundPayloadFromAsset = (
  asset: StudioCustomVideoFile | null | undefined,
  explicitAssetId?: number | null,
): WorkspaceSegmentSceneSoundPayload | null => {
  const assetId =
    getPositiveWorkspaceMediaAssetId(explicitAssetId) ??
    getPositiveWorkspaceMediaAssetId(asset?.assetId);
  const remoteUrl = String(asset?.remoteUrl ?? "").trim();
  const fileName = String(asset?.fileName ?? "").trim() || (assetId ? `segment-scene-sound-${assetId}.wav` : "");
  const mimeType = String(asset?.mimeType ?? "").trim() || "audio/wav";

  if (!assetId && !remoteUrl) {
    return null;
  }

  return {
    download_url: remoteUrl || null,
    file_name: fileName || "segment-scene-sound.wav",
    file_size: Math.max(0, Number(asset?.fileSize ?? 0) || 0),
    media_asset_id: assetId ?? null,
    mime_type: mimeType,
    remote_url: remoteUrl || null,
    url: remoteUrl || null,
  };
};

export const getWorkspaceSegmentSceneSoundStateAssetId = (
  segment: Partial<WorkspaceSegmentEditorDraftSegment> | null | undefined,
) =>
  getPositiveWorkspaceMediaAssetId(segment?.sceneSoundAsset?.assetId) ??
  getPositiveWorkspaceMediaAssetId(segment?.sceneSound?.assetId) ??
  getPositiveWorkspaceMediaAssetId(segment?.sceneSoundAssetId) ??
  getPositiveWorkspaceMediaAssetId(segment?.scene_sound?.media_asset_id) ??
  getPositiveWorkspaceMediaAssetId(segment?.scene_sound_asset_id);

export const clearWorkspaceSegmentSceneSoundState = <T extends WorkspaceSegmentEditorDraftSegment>(segment: T): T =>
  ({
    ...segment,
    sceneSound: null,
    sceneSoundAsset: null,
    sceneSoundAssetId: null,
    scene_sound: null,
    scene_sound_asset_id: null,
    sceneSoundGeneratedFromPrompt: null,
    sceneSoundPrompt: "",
    sceneSoundPromptInitialized: false,
    sceneSoundReset: true,
  }) as T;

export const invalidateWorkspaceSegmentSceneSoundForVisualChange = <T extends WorkspaceSegmentEditorDraftSegment>(
  segment: T,
): T => {
  const preservedPrompt =
    String(segment.sceneSoundPrompt ?? "").trim() ||
    String(segment.sceneSoundGeneratedFromPrompt ?? "").trim();
  const hadSceneSound = Boolean(
    segment.sceneSound ||
    segment.sceneSoundAsset ||
    segment.scene_sound ||
    getWorkspaceSegmentSceneSoundStateAssetId(segment),
  );
  const clearedSegment = clearWorkspaceSegmentSceneSoundState(segment);

  return {
    ...clearedSegment,
    sceneSoundPrompt: preservedPrompt,
    sceneSoundPromptInitialized: Boolean(preservedPrompt),
    sceneSoundReset: Boolean(segment.sceneSoundReset || hadSceneSound),
  } as T;
};

export const restoreWorkspaceSegmentSceneSoundState = <T extends WorkspaceSegmentEditorDraftSegment>(
  segment: T,
  source: WorkspaceSegmentEditorDraftSegment | null | undefined,
): T => {
  if (!source) {
    return {
      ...clearWorkspaceSegmentSceneSoundState(segment),
      sceneSoundReset: false,
    };
  }

  const sceneSoundAsset = cloneStudioCustomVideoFile(source.sceneSoundAsset);
  const sceneSoundAssetId = getWorkspaceSegmentSceneSoundStateAssetId(source);
  const sceneSoundGeneratedFromPrompt =
    typeof source.sceneSoundGeneratedFromPrompt === "string" && source.sceneSoundGeneratedFromPrompt.trim()
      ? source.sceneSoundGeneratedFromPrompt
      : null;
  const sceneSoundPrompt = typeof source.sceneSoundPrompt === "string" ? source.sceneSoundPrompt : "";

  return {
    ...segment,
    sceneSound: cloneStudioCustomVideoFile(source.sceneSound ?? null),
    sceneSoundAsset,
    sceneSoundAssetId,
    scene_sound: cloneWorkspaceSegmentSceneSoundPayload(source.scene_sound),
    scene_sound_asset_id:
      getPositiveWorkspaceMediaAssetId(source.scene_sound_asset_id) ??
      getPositiveWorkspaceMediaAssetId(source.scene_sound?.media_asset_id) ??
      sceneSoundAssetId,
    sceneSoundGeneratedFromPrompt,
    sceneSoundPrompt,
    sceneSoundPromptInitialized: Boolean(
      source.sceneSoundPromptInitialized ||
        sceneSoundPrompt ||
        sceneSoundGeneratedFromPrompt ||
        sceneSoundAsset ||
        sceneSoundAssetId,
    ),
    sceneSoundReset: false,
  } as T;
};

export const getWorkspaceSegmentSceneSoundSelectionSyncKey = (
  projectId: number,
  segmentIndex: number,
) => `${projectId}:${segmentIndex}`;

export const waitForWorkspaceSegmentSceneSoundSelectionSync = async (
  syncs: Record<string, Promise<void>>,
  projectId: number,
) => {
  const projectPrefix = `${projectId}:`;
  const pendingSyncs = Object.entries(syncs)
    .filter(([key]) => key.startsWith(projectPrefix))
    .map(([, sync]) => sync);
  await Promise.all(pendingSyncs);
};

const restoreWorkspaceSegmentTimelineDurationState = (
  segment: WorkspaceSegmentEditorDraftSegment,
  source: WorkspaceSegmentEditorDraftSegment | null | undefined,
): WorkspaceSegmentEditorDraftSegment => {
  if (!source) {
    return segment;
  }

  const duration = normalizeWorkspaceSegmentManualDurationSeconds(source.duration) ?? segment.duration;
  const startTime = normalizeWorkspaceSegmentManualDurationSeconds(source.startTime) ?? segment.startTime;
  const endTime =
    normalizeWorkspaceSegmentManualDurationSeconds(source.endTime) ??
    roundWorkspaceSegmentTimelineSeconds(startTime + duration);
  const durationSyncMode = normalizeWorkspaceSegmentDurationSyncMode(source.durationSyncMode ?? source.duration_sync_mode);
  const durationSyncModeUserSelected =
    source.durationSyncModeUserSelected === true || source.duration_sync_mode_user_selected === true;

  return {
    ...segment,
    duration,
    durationExtensionSourceDurationSeconds: getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(source),
    durationMode: normalizeWorkspaceSegmentDurationMode(source.durationMode),
    durationSyncMode,
    durationSyncModeUserSelected,
    duration_sync_mode: durationSyncMode,
    duration_sync_mode_user_selected: durationSyncModeUserSelected,
    endTime,
    manualDurationSeconds: normalizeWorkspaceSegmentManualDurationSeconds(source.manualDurationSeconds),
    startTime,
  };
};

export const restoreWorkspaceSegmentTimelineSnapshot = (
  segment: WorkspaceSegmentEditorDraftSegment,
  snapshot: WorkspaceSegmentEditorDraftSegment,
  kind: Exclude<WorkspaceSegmentTimelineHistoryKind, "music">,
): WorkspaceSegmentEditorDraftSegment => {
  const restoreSpeechTimingState = (
    nextSegment: WorkspaceSegmentEditorDraftSegment,
    sourceSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  ): WorkspaceSegmentEditorDraftSegment => ({
    ...nextSegment,
    speechDuration: sourceSegment?.speechDuration ?? null,
    speechDurationSource: sourceSegment?.speechDurationSource ?? null,
    speechEndTime: sourceSegment?.speechEndTime ?? null,
    speechStartTime: sourceSegment?.speechStartTime ?? null,
    speechWords: sourceSegment?.speechWords.map((word) => ({ ...word })) ?? [],
    voiceSourceDuration: sourceSegment?.voiceSourceDuration ?? null,
    voiceSourceEndTime: sourceSegment?.voiceSourceEndTime ?? null,
    voiceSourceStartTime: sourceSegment?.voiceSourceStartTime ?? null,
  });
  const restoreVoiceoverState = (
    nextSegment: WorkspaceSegmentEditorDraftSegment,
    sourceSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  ): WorkspaceSegmentEditorDraftSegment => ({
    ...restoreSpeechTimingState(nextSegment, sourceSegment),
    voiceLanguage: normalizeStudioLanguageValue(sourceSegment?.voiceLanguage ?? sourceSegment?.voice_language),
    voice_language: normalizeStudioLanguageValue(sourceSegment?.voiceLanguage ?? sourceSegment?.voice_language),
    voiceoverAsset: cloneStudioCustomVideoFile(sourceSegment?.voiceoverAsset ?? null),
    voiceoverLanguage: sourceSegment?.voiceoverLanguage ?? null,
    voiceoverTextHash: sourceSegment?.voiceoverTextHash ?? null,
    voiceoverVoiceType: sourceSegment?.voiceoverVoiceType ?? null,
  });

  if (kind === "text") {
    return restoreVoiceoverState({
      ...segment,
      text: snapshot.text,
      textByLanguage: { ...snapshot.textByLanguage },
      voiceType: getWorkspaceSegmentVoiceOverrideId(snapshot),
      voice_type: getWorkspaceSegmentVoiceOverrideId(snapshot),
    }, snapshot);
  }

  if (kind === "voice") {
    return restoreVoiceoverState({
      ...segment,
      voiceType: getWorkspaceSegmentVoiceOverrideId(snapshot),
      voice_type: getWorkspaceSegmentVoiceOverrideId(snapshot),
    }, snapshot);
  }

  if (kind === "subtitle") {
    return {
      ...segment,
      subtitleColor: getWorkspaceSegmentSubtitleColorOverrideId(snapshot),
      subtitleStyle: getWorkspaceSegmentSubtitleStyleOverrideId(snapshot),
      subtitleType: getWorkspaceSegmentSubtitleTypeOverrideId(snapshot),
    };
  }

  if (kind === "sound") {
    return restoreWorkspaceSegmentSceneSoundState(segment, snapshot);
  }

  if (kind === "infographic") {
    return {
      ...segment,
      infographic: cloneWorkspaceSegmentInfographic(snapshot.infographic),
      infographicRemoved: snapshot.infographicRemoved,
      infographicSourceWarningDismissedForIdentity: snapshot.infographicSourceWarningDismissedForIdentity,
      infographicStylePromptDraft: snapshot.infographicStylePromptDraft,
      infographicTextDraft: snapshot.infographicTextDraft,
    };
  }

  const restoredVisualSegment = {
    ...segment,
    aiPhotoAsset: cloneStudioCustomVideoFile(snapshot.aiPhotoAsset),
    aiPhotoGeneratedFromPrompt: snapshot.aiPhotoGeneratedFromPrompt,
    aiPhotoPrompt: snapshot.aiPhotoPrompt,
    aiPhotoPromptInitialized: snapshot.aiPhotoPromptInitialized,
    aiVideoAsset: cloneStudioCustomVideoFile(snapshot.aiVideoAsset),
    aiVideoGeneratedMode: snapshot.aiVideoGeneratedMode,
    aiVideoGeneratedFromPrompt: snapshot.aiVideoGeneratedFromPrompt,
    aiVideoPrompt: snapshot.aiVideoPrompt,
    aiVideoPromptInitialized: snapshot.aiVideoPromptInitialized,
    currentAsset: cloneWorkspaceMediaAssetRef(snapshot.currentAsset),
    currentExternalPlaybackUrl: snapshot.currentExternalPlaybackUrl,
    currentExternalPreviewUrl: snapshot.currentExternalPreviewUrl,
    currentPlaybackUrl: snapshot.currentPlaybackUrl,
    currentPosterUrl: snapshot.currentPosterUrl,
    currentPreviewUrl: snapshot.currentPreviewUrl,
    currentSourceKind: snapshot.currentSourceKind,
    customVideo: cloneStudioCustomVideoFile(snapshot.customVideo),
    imageEditAsset: cloneStudioCustomVideoFile(snapshot.imageEditAsset),
    imageEditGeneratedFromPrompt: snapshot.imageEditGeneratedFromPrompt,
    imageEditPrompt: snapshot.imageEditPrompt,
    imageEditPromptInitialized: snapshot.imageEditPromptInitialized,
    mediaType: snapshot.mediaType,
    photoAnimationSourceAsset: cloneStudioCustomVideoFile(snapshot.photoAnimationSourceAsset),
    videoAction: snapshot.videoAction,
    visualReset: snapshot.visualReset,
  };
  return restoreWorkspaceSegmentTimelineDurationState(
    getWorkspaceSegmentLatestVisualAction(snapshot) === "talking_photo"
      ? restoreSpeechTimingState(restoredVisualSegment, snapshot)
      : restoredVisualSegment,
    snapshot,
  );
};

export const cloneWorkspaceProject = (project: WorkspaceProject): WorkspaceProject => ({
  ...project,
  finalAsset: project.finalAsset ? { ...project.finalAsset } : null,
  hashtags: [...project.hashtags],
  instagramPublication: project.instagramPublication ? { ...project.instagramPublication } : null,
  youtubePublication: project.youtubePublication ? { ...project.youtubePublication } : null,
});

export const hasWorkspaceCyrillicText = (value: string | null | undefined) => /[А-Яа-яЁё]/.test(String(value ?? ""));

export const normalizeWorkspaceLocalizedTextForCompare = (value: string | null | undefined) =>
  String(value ?? "").replace(/\s+/g, " ").trim();

export const isWorkspaceSegmentCachedLanguageTextUsable = (
  targetText: string | null | undefined,
  targetLanguage: StudioLanguage,
  sourceText: string | null | undefined,
) => {
  if (typeof targetText !== "string") {
    return false;
  }

  const normalizedTargetText = normalizeWorkspaceLocalizedTextForCompare(targetText);
  const normalizedSourceText = normalizeWorkspaceLocalizedTextForCompare(sourceText);

  if (!normalizedTargetText) {
    return !normalizedSourceText;
  }

  if (targetLanguage === "en") {
    // Older voice-menu builds could save the unchanged Russian source under
    // the English cache key. Treat such entries as stale so selecting English
    // requests a real translation. A valid English translation may still keep
    // a Cyrillic brand or proper name, so only reject an unchanged source copy.
    return !hasWorkspaceCyrillicText(normalizedTargetText) || normalizedTargetText !== normalizedSourceText;
  }

  if (hasWorkspaceCyrillicText(normalizedTargetText)) {
    return true;
  }

  if (normalizedSourceText && !hasWorkspaceCyrillicText(normalizedSourceText)) {
    return false;
  }

  return !normalizedSourceText || normalizedTargetText !== normalizedSourceText;
};

export const cloneWorkspaceSegmentEditorLocalizedTextMap = (
  value: WorkspaceSegmentEditorLocalizedTextMap | null | undefined,
  fallbackText: string,
  fallbackLanguage: StudioLanguage = "ru",
): WorkspaceSegmentEditorLocalizedTextMap => {
  const nextMap: WorkspaceSegmentEditorLocalizedTextMap = {};
  const hadFallbackLanguage = typeof value?.[fallbackLanguage] === "string";

  (["ru", "en"] as const).forEach((language) => {
    if (typeof value?.[language] === "string") {
      nextMap[language] = value[language];
    }
  });

  if (typeof nextMap[fallbackLanguage] !== "string") {
    nextMap[fallbackLanguage] = fallbackText;
  }

  if (
    fallbackLanguage === "en" &&
    typeof nextMap.ru === "string" &&
    normalizeWorkspaceLocalizedTextForCompare(nextMap.ru) === normalizeWorkspaceLocalizedTextForCompare(nextMap.en) &&
    !hasWorkspaceCyrillicText(nextMap.ru) &&
    (!hadFallbackLanguage || nextMap.ru === fallbackText)
  ) {
    delete nextMap.ru;
  }

  return nextMap;
};

export const cloneWorkspaceSegmentEditorDraftSegment = (
  segment: WorkspaceSegmentEditorDraftSegment,
  fallbackLanguage: StudioLanguage = "ru",
): WorkspaceSegmentEditorDraftSegment => ({
  ...normalizeWorkspaceSegmentEditorSegmentUrls(segment),
  aiPhotoAsset: cloneStudioCustomVideoFile(segment.aiPhotoAsset),
  aiPhotoGeneratedFromPrompt:
    typeof segment.aiPhotoGeneratedFromPrompt === "string" && segment.aiPhotoGeneratedFromPrompt.trim()
      ? segment.aiPhotoGeneratedFromPrompt
      : null,
  aiPhotoPrompt: typeof segment.aiPhotoPrompt === "string" ? segment.aiPhotoPrompt : "",
  aiPhotoPromptInitialized: Boolean(segment.aiPhotoPromptInitialized),
  aiVideoAsset: cloneStudioCustomVideoFile(segment.aiVideoAsset),
  aiVideoGeneratedMode:
    segment.aiVideoGeneratedMode === "photo_animation" ||
    segment.aiVideoGeneratedMode === "talking_photo" ||
    segment.aiVideoGeneratedMode === "ai_video"
      ? segment.aiVideoGeneratedMode
      : null,
  aiVideoGeneratedFromPrompt:
    typeof segment.aiVideoGeneratedFromPrompt === "string" && segment.aiVideoGeneratedFromPrompt.trim()
      ? segment.aiVideoGeneratedFromPrompt
      : null,
  aiVideoPrompt: typeof segment.aiVideoPrompt === "string" ? segment.aiVideoPrompt : "",
  aiVideoPromptInitialized: Boolean(segment.aiVideoPromptInitialized),
  customVideo: cloneStudioCustomVideoFile(segment.customVideo),
  durationSyncMode: normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode),
  durationSyncModeUserSelected: segment.durationSyncModeUserSelected === true,
  durationExtensionSourceDurationSeconds: getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment),
  imageEditAsset: cloneStudioCustomVideoFile(segment.imageEditAsset),
  imageEditGeneratedFromPrompt:
    typeof segment.imageEditGeneratedFromPrompt === "string" && segment.imageEditGeneratedFromPrompt.trim()
      ? segment.imageEditGeneratedFromPrompt
      : null,
  imageEditPrompt: typeof segment.imageEditPrompt === "string" ? segment.imageEditPrompt : "",
  imageEditPromptInitialized: Boolean(segment.imageEditPromptInitialized),
  infographic: cloneWorkspaceSegmentInfographic(segment.infographic),
  infographicRemoved: segment.infographicRemoved === true,
  infographicSourceWarningDismissedForIdentity:
    typeof segment.infographicSourceWarningDismissedForIdentity === "string"
      ? segment.infographicSourceWarningDismissedForIdentity
      : null,
  infographicStylePromptDraft:
    typeof segment.infographicStylePromptDraft === "string"
      ? segment.infographicStylePromptDraft
      : segment.infographic?.stylePrompt ?? "",
  infographicTextDraft:
    typeof segment.infographicTextDraft === "string"
      ? segment.infographicTextDraft
      : segment.infographic?.text ?? "",
  durationMode: normalizeWorkspaceSegmentDurationMode(segment.durationMode),
  manualDurationSeconds: normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds),
  mediaType: normalizeWorkspaceSegmentMediaType(segment.mediaType),
  originalText: typeof segment.originalText === "string" ? segment.originalText : segment.text,
  originalTextByLanguage: cloneWorkspaceSegmentEditorLocalizedTextMap(
    segment.originalTextByLanguage,
    typeof segment.originalText === "string" ? segment.originalText : segment.text,
    fallbackLanguage,
  ),
  photoAnimationSourceAsset: cloneStudioCustomVideoFile(segment.photoAnimationSourceAsset),
  sceneSoundAsset: cloneStudioCustomVideoFile(segment.sceneSoundAsset),
  sceneSoundGeneratedFromPrompt:
    typeof segment.sceneSoundGeneratedFromPrompt === "string" && segment.sceneSoundGeneratedFromPrompt.trim()
      ? segment.sceneSoundGeneratedFromPrompt
      : null,
  sceneSoundPrompt: typeof segment.sceneSoundPrompt === "string" ? segment.sceneSoundPrompt : "",
  sceneSoundPromptInitialized: Boolean(segment.sceneSoundPromptInitialized),
  sceneSoundReset: segment.sceneSoundReset === true,
  subtitleColor: getWorkspaceSegmentSubtitleColorOverrideId(segment),
  subtitleStyle: getWorkspaceSegmentSubtitleStyleOverrideId(segment),
  subtitleType: getWorkspaceSegmentSubtitleTypeOverrideId(segment),
  textByLanguage: cloneWorkspaceSegmentEditorLocalizedTextMap(segment.textByLanguage, segment.text, fallbackLanguage),
  voiceSourceDuration: getWorkspaceSegmentVoiceSourceDurationSeconds(segment),
  voiceSourceEndTime: getWorkspaceSegmentVoiceSourceEndTime(segment),
  voiceSourceStartTime: getWorkspaceSegmentVoiceSourceStartTime(segment),
  voiceLanguage:
    normalizeStudioLanguageValue(segment.voiceLanguage ?? segment.voice_language) ??
    normalizeStudioLanguageValue(segment.voiceoverLanguage),
  voice_language:
    normalizeStudioLanguageValue(segment.voiceLanguage ?? segment.voice_language) ??
    normalizeStudioLanguageValue(segment.voiceoverLanguage),
  voiceoverAsset: cloneStudioCustomVideoFile(segment.voiceoverAsset),
  voiceoverLanguage: typeof segment.voiceoverLanguage === "string" && segment.voiceoverLanguage.trim() ? segment.voiceoverLanguage : null,
  voiceoverTextHash: typeof segment.voiceoverTextHash === "string" && segment.voiceoverTextHash.trim() ? segment.voiceoverTextHash : null,
  voiceoverVoiceType: typeof segment.voiceoverVoiceType === "string" && segment.voiceoverVoiceType.trim() ? segment.voiceoverVoiceType : null,
  voiceType: getWorkspaceSegmentVoiceOverrideId(segment),
  voice_type: getWorkspaceSegmentVoiceOverrideId(segment),
  visualReset: Boolean(segment.visualReset),
});

export const restoreWorkspaceSegmentVoiceTextDraftSnapshot = (
  segment: WorkspaceSegmentEditorDraftSegment,
  snapshot: WorkspaceSegmentEditorDraftSegment,
  fallbackLanguage: StudioLanguage = "ru",
): WorkspaceSegmentEditorDraftSegment => restoreWorkspaceSegmentTimelineDurationState({
  ...segment,
  _voice_render_source_end_time: snapshot._voice_render_source_end_time ?? null,
  _voice_render_source_start_time: snapshot._voice_render_source_start_time ?? null,
  _voice_source_duration: snapshot._voice_source_duration ?? null,
  _voice_source_end_time: snapshot._voice_source_end_time ?? null,
  _voice_source_start_time: snapshot._voice_source_start_time ?? null,
  estimatedVoiceoverDurationSeconds: snapshot.estimatedVoiceoverDurationSeconds ?? null,
  estimatedVoiceoverTextHash: snapshot.estimatedVoiceoverTextHash ?? null,
  originalText: snapshot.originalText,
  originalTextByLanguage: cloneWorkspaceSegmentEditorLocalizedTextMap(
    snapshot.originalTextByLanguage,
    snapshot.originalText,
    fallbackLanguage,
  ),
  speechDuration: snapshot.speechDuration,
  speechDurationSource: snapshot.speechDurationSource ?? null,
  speechEndTime: snapshot.speechEndTime,
  speechStartTime: snapshot.speechStartTime,
  speechWords: snapshot.speechWords.map((word) => ({ ...word })),
  voiceSourceDuration: snapshot.voiceSourceDuration ?? null,
  voiceSourceEndTime: snapshot.voiceSourceEndTime ?? null,
  voiceSourceStartTime: snapshot.voiceSourceStartTime ?? null,
  voice_source_duration: snapshot.voice_source_duration ?? null,
  voice_source_end_time: snapshot.voice_source_end_time ?? null,
  voice_source_start_time: snapshot.voice_source_start_time ?? null,
  text: snapshot.text,
  textByLanguage: cloneWorkspaceSegmentEditorLocalizedTextMap(
    snapshot.textByLanguage,
    snapshot.text,
    fallbackLanguage,
  ),
  voiceLanguage: normalizeStudioLanguageValue(snapshot.voiceLanguage ?? snapshot.voice_language),
  voice_language: normalizeStudioLanguageValue(snapshot.voiceLanguage ?? snapshot.voice_language),
  voiceType: snapshot.voiceType,
  voice_type: snapshot.voice_type,
  voiceoverAsset: cloneStudioCustomVideoFile(snapshot.voiceoverAsset),
  voiceoverLanguage: snapshot.voiceoverLanguage,
  voiceoverTextHash: snapshot.voiceoverTextHash,
  voiceoverVoiceType: snapshot.voiceoverVoiceType,
}, snapshot);

export const restoreWorkspaceSegmentVoiceTextDraftSessionSnapshot = (
  draft: WorkspaceSegmentEditorDraftSession,
  snapshot: {
    segment: WorkspaceSegmentEditorDraftSegment;
    segmentIndex: number;
    ttsAssetId: WorkspaceSegmentEditorDraftSession["ttsAssetId"];
  },
  fallbackLanguage: StudioLanguage = "ru",
): WorkspaceSegmentEditorDraftSession | null => {
  let didRestore = false;
  const nextSegments = draft.segments.map((segment) => {
    if (segment.index !== snapshot.segmentIndex) {
      return segment;
    }

    didRestore = true;
    return restoreWorkspaceSegmentVoiceTextDraftSnapshot(segment, snapshot.segment, fallbackLanguage);
  });

  if (!didRestore) {
    return null;
  }

  return rebuildWorkspaceSegmentEditorDraftSessionTimeline({
    ...draft,
    segments: nextSegments,
    ttsAssetId: snapshot.ttsAssetId,
  });
};

export const areWorkspaceSegmentEditorLocalizedTextMapsEqual = (
  left: WorkspaceSegmentEditorLocalizedTextMap | null | undefined,
  right: WorkspaceSegmentEditorLocalizedTextMap | null | undefined,
) =>
  (["ru", "en"] as const).every((language) => {
    const leftValue = typeof left?.[language] === "string" ? left[language] : undefined;
    const rightValue = typeof right?.[language] === "string" ? right[language] : undefined;
    return leftValue === rightValue;
  });

export const normalizeWorkspaceSegmentEditorUrl = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
};

export const ADSFLOW_MEDIA_DOWNLOAD_URL_PATTERN = /\/api\/media\/(\d+)\/download(?:[/?#]|$)/i;

export const normalizeWorkspaceSegmentMediaAssetProxyUrl = (value: unknown) => {
  const normalizedUrl = normalizeWorkspaceSegmentEditorUrl(value);
  if (!normalizedUrl) {
    return null;
  }

  const matchedPath = normalizedUrl.match(ADSFLOW_MEDIA_DOWNLOAD_URL_PATTERN);
  if (matchedPath) {
    return `/api/workspace/media-assets/${matchedPath[1]}`;
  }

  try {
    const resolvedUrl = new URL(normalizedUrl);
    const matchedAbsolutePath = resolvedUrl.pathname.match(ADSFLOW_MEDIA_DOWNLOAD_URL_PATTERN);
    if (matchedAbsolutePath) {
      return `/api/workspace/media-assets/${matchedAbsolutePath[1]}`;
    }
  } catch {
    return normalizedUrl;
  }

  return normalizedUrl;
};

export const normalizeWorkspaceSegmentSourceKind = (value: unknown): WorkspaceSegmentSourceKind => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "ai_generated" || normalized === "stock" || normalized === "upload") {
    return normalized;
  }

  return "unknown";
};

export const getUniqueWorkspaceSegmentPreviewUrls = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      values
        .map((value) => normalizeWorkspaceSegmentEditorUrl(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );

export const getWorkspaceSegmentStillPreviewUrlsFromValues = (
  segment: Pick<
    WorkspaceSegmentEditorDraftSegment,
    | "currentAsset"
    | "originalAsset"
  >,
  values: Array<string | null | undefined>,
) =>
  Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter((value) => {
          if (!value) {
            return false;
          }

          const mediaAssetId = getWorkspaceMediaAssetBaseProxyUrlAssetId(value);
          if (mediaAssetId !== null) {
            if (
              (isWorkspaceVideoMediaAsset(segment.currentAsset) &&
                isWorkspaceMediaAssetRefAssetId(segment.currentAsset, mediaAssetId)) ||
              (isWorkspaceVideoMediaAsset(segment.originalAsset) &&
                isWorkspaceMediaAssetRefAssetId(segment.originalAsset, mediaAssetId))
            ) {
              return false;
            }

            if (
              (isWorkspacePhotoMediaAsset(segment.currentAsset) &&
                isWorkspaceMediaAssetRefAssetId(segment.currentAsset, mediaAssetId)) ||
              (isWorkspacePhotoMediaAsset(segment.originalAsset) &&
                isWorkspaceMediaAssetRefAssetId(segment.originalAsset, mediaAssetId))
            ) {
              return true;
            }
          }

          return !isLikelyVideoAssetUrl(value);
        }),
    ),
  );

export const getWorkspaceSegmentStillPreviewUrls = (
  segment: Pick<
    WorkspaceSegmentEditorDraftSegment,
    | "currentAsset"
    | "currentExternalPlaybackUrl"
    | "currentExternalPreviewUrl"
    | "currentPlaybackUrl"
    | "currentPreviewUrl"
    | "originalAsset"
    | "originalExternalPlaybackUrl"
    | "originalExternalPreviewUrl"
    | "originalPlaybackUrl"
    | "originalPreviewUrl"
  >,
) =>
  getWorkspaceSegmentStillPreviewUrlsFromValues(segment, [
    segment.currentExternalPreviewUrl,
    segment.originalExternalPreviewUrl,
    segment.currentExternalPlaybackUrl,
    segment.originalExternalPlaybackUrl,
    segment.currentPreviewUrl,
    segment.originalPreviewUrl,
    segment.currentPlaybackUrl,
    segment.originalPlaybackUrl,
  ]);

export const getWorkspaceSegmentPreferredStillPreviewUrl = (
  segment: Pick<
    WorkspaceSegmentEditorDraftSegment,
    | "currentAsset"
    | "currentExternalPlaybackUrl"
    | "currentExternalPreviewUrl"
    | "currentPlaybackUrl"
    | "currentPreviewUrl"
    | "originalAsset"
    | "originalExternalPlaybackUrl"
    | "originalExternalPreviewUrl"
    | "originalPlaybackUrl"
    | "originalPreviewUrl"
  >,
) => getWorkspaceSegmentStillPreviewUrls(segment)[0] ?? null;

export const hasWorkspaceSegmentOriginalVisualReference = (segment: WorkspaceSegmentEditorDraftSegment) =>
  Boolean(
    segment.originalAsset ||
      segment.originalPlaybackUrl ||
      segment.originalPreviewUrl ||
      segment.originalExternalPlaybackUrl ||
      segment.originalExternalPreviewUrl,
  );

export const hasWorkspaceSegmentPersistedMediaReference = (segment: WorkspaceSegmentEditorDraftSegment) =>
  Boolean(
    segment.currentAsset ||
      segment.originalAsset ||
      segment.currentPlaybackUrl ||
      segment.currentPosterUrl ||
      segment.currentPreviewUrl ||
      segment.currentExternalPlaybackUrl ||
      segment.currentExternalPreviewUrl ||
      segment.originalPlaybackUrl ||
      segment.originalPosterUrl ||
      segment.originalPreviewUrl ||
      segment.originalExternalPlaybackUrl ||
      segment.originalExternalPreviewUrl,
  );

const hasWorkspaceSegmentExportablePersistedVisualReference = (segment: WorkspaceSegmentEditorDraftSegment) =>
  Boolean(
    segment.currentAsset ||
      segment.originalAsset ||
      segment.currentPlaybackUrl ||
      segment.currentPreviewUrl ||
      segment.currentExternalPlaybackUrl ||
      segment.currentExternalPreviewUrl ||
      segment.originalPlaybackUrl ||
      segment.originalPreviewUrl ||
      segment.originalExternalPlaybackUrl ||
      segment.originalExternalPreviewUrl,
  );

export const hasWorkspaceSegmentEditorScratchReadyVisual = (segment: WorkspaceSegmentEditorDraftSegment) =>
  Boolean(hasWorkspaceSegmentExplicitDraftVisual(segment) || hasWorkspaceSegmentExportablePersistedVisualReference(segment));

export const getWorkspaceSegmentEditorMissingVisualSceneNumbers = (
  draft: Pick<WorkspaceSegmentEditorDraftSession, "segments"> | null | undefined,
) =>
  (draft?.segments ?? []).flatMap((segment, index) =>
    hasWorkspaceSegmentEditorScratchReadyVisual(segment) ? [] : [index + 1],
  );

const normalizeWorkspaceSegmentEditorSceneNumbers = (sceneNumbers: readonly number[]) =>
  sceneNumbers
    .map((sceneNumber) => Math.trunc(Number(sceneNumber)))
    .filter((sceneNumber, index, allSceneNumbers) =>
      Number.isInteger(sceneNumber) &&
      sceneNumber > 0 &&
      allSceneNumbers.indexOf(sceneNumber) === index,
    );

const formatWorkspaceSegmentEditorSceneNumberList = (
  sceneNumbers: readonly number[],
  language: StudioLanguage = "ru",
) => {
  const normalizedSceneNumbers = normalizeWorkspaceSegmentEditorSceneNumbers(sceneNumbers);

  if (normalizedSceneNumbers.length <= 1) {
    return String(normalizedSceneNumbers[0] ?? 1);
  }

  const lastSceneNumber = normalizedSceneNumbers[normalizedSceneNumbers.length - 1];
  const prefix = normalizedSceneNumbers.slice(0, -1).join(", ");
  return `${prefix}${language === "en" ? " and " : " и "}${lastSceneNumber}`;
};

export const formatWorkspaceSegmentEditorMissingVisualScenesMessage = (
  sceneNumbers: readonly number[],
  language: StudioLanguage = "ru",
) => {
  const normalizedSceneNumbers = normalizeWorkspaceSegmentEditorSceneNumbers(sceneNumbers);

  const sceneNumberList = formatWorkspaceSegmentEditorSceneNumberList(normalizedSceneNumbers, language);
  if (normalizedSceneNumbers.length <= 1) {
    return language === "en"
      ? `Scene ${sceneNumberList} has no visual. Add a visual or delete the scene.`
      : `Визуал не задан для сцены ${sceneNumberList}. Добавьте визуал или удалите сцену.`;
  }

  return language === "en"
    ? `Scenes ${sceneNumberList} have no visual. Add visuals or delete these scenes.`
    : `Визуал не задан для сцен ${sceneNumberList}. Добавьте визуал или удалите эти сцены.`;
};

const isWorkspaceSegmentProjectVisualUrl = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim();
  return (
    normalized.includes("/api/workspace/project-segment-video") ||
    normalized.includes("/api/workspace/project-segment-poster")
  );
};

const isWorkspaceSegmentProjectVisualAsset = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  if (!asset) {
    return false;
  }

  const projectId = Number(asset.projectId);
  const segmentIndex = Number(asset.segmentIndex);
  if (Number.isInteger(projectId) && projectId > 0 && Number.isInteger(segmentIndex) && segmentIndex >= 0) {
    return true;
  }

  const markers = [asset.kind, asset.role]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);
  return markers.some((marker) => marker === "segment_current" || marker === "segment_original");
};

const hasWorkspaceSegmentPersistedProjectVisualReference = (segment: WorkspaceSegmentEditorDraftSegment) =>
  Boolean(
    isWorkspaceSegmentProjectVisualAsset(segment.currentAsset) ||
      isWorkspaceSegmentProjectVisualAsset(segment.originalAsset) ||
      [
        segment.currentPlaybackUrl,
        segment.currentPosterUrl,
        segment.currentPreviewUrl,
        segment.currentExternalPlaybackUrl,
        segment.currentExternalPreviewUrl,
        segment.originalPlaybackUrl,
        segment.originalPosterUrl,
        segment.originalPreviewUrl,
        segment.originalExternalPlaybackUrl,
        segment.originalExternalPreviewUrl,
      ].some(isWorkspaceSegmentProjectVisualUrl),
  );

export const isWorkspaceSegmentPersistedForVisualJobBinding = (
  currentDraft: Pick<WorkspaceSegmentEditorDraftSession, "projectId" | "segments"> | null | undefined,
  targetSegmentIndex: number,
  baselineSession?: Pick<WorkspaceSegmentEditorDraftSession, "projectId" | "segments"> | null,
) => {
  if (!currentDraft) {
    return false;
  }

  if (baselineSession && baselineSession.projectId === currentDraft.projectId) {
    return baselineSession.segments.some((segment) => segment.index === targetSegmentIndex);
  }

  const targetSegment = currentDraft.segments.find((segment) => segment.index === targetSegmentIndex) ?? null;
  return targetSegment ? hasWorkspaceSegmentPersistedMediaReference(targetSegment) : false;
};

const isWorkspaceSegmentEditorDraftSegmentVisualEmpty = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) =>
  Boolean(
    segment &&
      !hasWorkspaceSegmentExplicitDraftVisual(segment) &&
      !segment.photoAnimationSourceAsset &&
      !hasWorkspaceSegmentPersistedMediaReference(segment),
  );

export const resolveWorkspaceSegmentEditorMediaUploadScope = (
  session: Pick<WorkspaceSegmentEditorDraftSession, "projectId">,
  segment: WorkspaceSegmentEditorDraftSegment,
  options?: {
    allowStructureChange?: boolean;
    persistedSegmentIndexes?: readonly number[];
  },
): WorkspaceSegmentEditorMediaUploadScope => {
  const shouldScopeToProjectSegment =
    !options?.allowStructureChange ||
    (options.persistedSegmentIndexes
      ? options.persistedSegmentIndexes.includes(segment.index)
      : hasWorkspaceSegmentPersistedMediaReference(segment));

  return shouldScopeToProjectSegment
    ? {
        projectId: session.projectId,
        segmentIndex: segment.index,
      }
    : {};
};

export const isWorkspaceSegmentEditorDraftSegmentEmpty = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) =>
  Boolean(
    segment &&
      !normalizeWorkspaceSegmentEditorTextForCompare(segment.text) &&
      isWorkspaceSegmentEditorDraftSegmentVisualEmpty(segment) &&
      !segment.sceneSoundAsset,
  );

export const hasWorkspaceSegmentEditorRenderableScratchScene = (
  draft: Pick<WorkspaceSegmentEditorDraftSession, "segments"> | null | undefined,
) =>
  Boolean(
    draft?.segments.some(
      (segment) =>
        Boolean(normalizeWorkspaceSegmentEditorTextForCompare(segment.text)) ||
        hasWorkspaceSegmentExplicitDraftVisual(segment) ||
        hasWorkspaceSegmentPersistedMediaReference(segment),
    ),
  );

export const getWorkspaceSegmentEditorVisibleTimelineDisplayRange = (
  segment: WorkspaceSegmentEditorDraftSegment,
  range: { endTime: number; startTime: number },
) => {
  if (!isWorkspaceSegmentEditorDraftSegmentEmpty(segment)) {
    return range;
  }

  return {
    endTime: range.startTime,
    startTime: range.startTime,
  };
};

export const getWorkspaceSegmentOriginalMediaType = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentMediaType => {
  if (isWorkspacePhotoMediaAsset(segment.originalAsset)) {
    return "photo";
  }

  if (isWorkspaceVideoMediaAsset(segment.originalAsset)) {
    return "video";
  }

  if (filterWorkspaceStillAssetUrls([
    segment.originalExternalPreviewUrl,
    segment.originalExternalPlaybackUrl,
    segment.originalPreviewUrl,
    segment.originalPlaybackUrl,
  ]).length > 0) {
    return "photo";
  }

  return segment.mediaType;
};

export const isWorkspaceSegmentOriginalProxyUrl = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim();
  return normalized.includes("/api/workspace/project-segment-video") && normalized.includes("source=original");
};

export const isWorkspaceMediaAssetProxyUrl = (value: string | null | undefined) =>
  /\/api\/workspace\/media-assets\/\d+(?:[/?#]|$)/i.test(String(value ?? "").trim());

export const hasWorkspaceSegmentMediaAssetCurrentVisualUrl = (segment: WorkspaceSegmentEditorDraftSegment) =>
  [
    segment.currentPlaybackUrl,
    segment.currentPreviewUrl,
    segment.currentExternalPlaybackUrl,
    segment.currentExternalPreviewUrl,
  ].some(isWorkspaceMediaAssetProxyUrl);

export const isWorkspaceSegmentStaleUploadOriginalVisual = (segment: WorkspaceSegmentEditorDraftSegment) => {
  return (
    segment.currentSourceKind === "upload" ||
    segment.originalSourceKind === "upload" ||
    segment.videoAction === "custom" ||
    (segment.visualReset && hasWorkspaceSegmentMediaAssetCurrentVisualUrl(segment))
  );
};

export const shouldRewriteWorkspaceSegmentOriginalProxyOnReset = (segment: WorkspaceSegmentEditorDraftSegment) =>
  (segment.currentSourceKind === "upload" ||
    segment.originalSourceKind === "upload" ||
    (segment.visualReset && hasWorkspaceSegmentMediaAssetCurrentVisualUrl(segment))) &&
  !hasWorkspaceSegmentOriginalVisualReference(segment);

export const isWorkspaceSegmentVisualResetApplied = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (!segment.visualReset) {
    return false;
  }

  if (
    segment.videoAction !== "original" ||
    segment.customVideo ||
    segment.aiPhotoAsset ||
    segment.aiVideoAsset ||
    segment.imageEditAsset ||
    segment.photoAnimationSourceAsset
  ) {
    return false;
  }

  const currentAssetIdentity = getWorkspaceMediaAssetIdentityKey(segment.currentAsset);
  const originalAssetIdentity = getWorkspaceMediaAssetIdentityKey(segment.originalAsset);
  if (currentAssetIdentity || originalAssetIdentity) {
    return Boolean(currentAssetIdentity && originalAssetIdentity && currentAssetIdentity === originalAssetIdentity);
  }

  const currentUrlIdentity =
    segment.currentPlaybackUrl ??
    segment.currentPreviewUrl ??
    segment.currentExternalPlaybackUrl ??
    segment.currentExternalPreviewUrl ??
    null;
  const originalUrlIdentity =
    segment.originalPlaybackUrl ??
    segment.originalPreviewUrl ??
    segment.originalExternalPlaybackUrl ??
    segment.originalExternalPreviewUrl ??
    null;

  if (!currentUrlIdentity) {
    return true;
  }

  if (!originalUrlIdentity) {
    return false;
  }

  return (
    currentUrlIdentity === originalUrlIdentity ||
    (isWorkspaceSegmentOriginalProxyUrl(currentUrlIdentity) && isWorkspaceSegmentOriginalProxyUrl(originalUrlIdentity))
  );
};

export const clearWorkspaceSegmentCurrentVisualReference = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentEditorDraftSegment => ({
  ...segment,
  currentAsset: null,
  currentExternalPlaybackUrl: null,
  currentExternalPreviewUrl: null,
  currentPlaybackUrl: null,
  currentPosterUrl: null,
  currentPreviewUrl: null,
  currentSourceKind: "unknown",
});

export const buildWorkspaceSegmentOriginalProxyUrl = (
  projectId: number,
  segmentIndex: number,
  delivery: "playback" | "preview",
) => {
  const params = new URLSearchParams({
    delivery,
    projectId: String(projectId),
    segmentIndex: String(segmentIndex),
    source: "original",
  });
  return `/api/workspace/project-segment-video?${params.toString()}`;
};

export const buildWorkspaceProjectMusicAudioProxyUrl = (
  projectId: number | null | undefined,
  version?: string | number | null,
) => {
  const normalizedProjectId = Number(projectId);
  const normalizedVersion = String(version ?? "").trim();
  const normalizedMusicName =
    normalizedVersion &&
    !normalizedVersion.includes("/") &&
    !normalizedVersion.includes("\\") &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.(?:aac|m4a|mp3|ogg|wav)$/i.test(normalizedVersion)
      ? normalizedVersion
      : "";
  if (!Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    if (!normalizedMusicName) {
      return null;
    }

    const stockParams = new URLSearchParams({
      musicName: normalizedMusicName,
    });
    return `/api/workspace/project-music-audio?${stockParams.toString()}`;
  }

  const params = new URLSearchParams({
    projectId: String(normalizedProjectId),
  });
  if (normalizedVersion) {
    params.set("v", normalizedVersion);
    if (normalizedMusicName) {
      params.set("musicName", normalizedMusicName);
    }
  }

  return `/api/workspace/project-music-audio?${params.toString()}`;
};

export const buildWorkspaceSegmentVoiceoverAudioProxyUrl = (
  projectId: number | null | undefined,
  segmentIndex: number | null | undefined,
  version?: string | number | null,
) => {
  const normalizedProjectId = Number(projectId);
  const normalizedSegmentIndex = Number(segmentIndex);
  if (
    !Number.isInteger(normalizedProjectId) ||
    normalizedProjectId <= 0 ||
    !Number.isInteger(normalizedSegmentIndex) ||
    normalizedSegmentIndex < 0
  ) {
    return null;
  }

  const params = new URLSearchParams({
    projectId: String(normalizedProjectId),
    segmentIndex: String(normalizedSegmentIndex),
  });
  const normalizedVersion = String(version ?? "").trim();
  if (normalizedVersion) {
    params.set("v", normalizedVersion);
  }

  return `/api/workspace/project-segment-voiceover?${params.toString()}`;
};

export type WorkspaceSegmentVoiceoverAudioPreviewSource = {
  audioUrl: string | null;
  latestSceneVoiceoverAudioUrl: string | null;
  previewRange: { endTime: number; startTime: number } | null;
  projectVoiceoverAudioUrl: string | null;
  segmentVoiceoverAudioUrl: string | null;
  shouldClip: boolean;
  sourceKind: "project" | "scene" | "segment" | null;
  version: string;
};

export const getWorkspaceSegmentVoiceoverAudioPreviewSource = (options: {
  allowFinalVideoStaleProjectTimelineFallback?: boolean;
  allowProjectTimelineFallback?: boolean;
  isVoiceAudioStale?: boolean;
  preferSegmentProxy?: boolean;
  segment: WorkspaceSegmentEditorDraftSegment;
  session: WorkspaceSegmentEditorDraftSession;
  voiceEnabled: boolean;
  voiceOption: StudioVoiceOption | null | undefined;
}): WorkspaceSegmentVoiceoverAudioPreviewSource => {
  const {
    allowFinalVideoStaleProjectTimelineFallback = false,
    allowProjectTimelineFallback = false,
    isVoiceAudioStale = false,
    preferSegmentProxy = false,
    segment,
    session,
    voiceEnabled,
    voiceOption,
  } = options;
  const rawVoiceoverAssetPreviewUrl = getStudioSceneSoundAssetPreviewUrl(segment.voiceoverAsset);
  const isProjectVoiceoverAsset = isWorkspaceSegmentProjectVoiceoverAsset(segment, session);
  const isSharedVoiceoverAsset = isWorkspaceSegmentSharedVoiceoverAsset(segment, session);
  const voiceSourceRange = getWorkspaceSegmentVoiceSourceRange(segment);
  const voiceoverAssetDurationSeconds = getStudioCustomVideoFileDurationSeconds(segment.voiceoverAsset);
  const voiceoverAssetId = getPositiveWorkspaceMediaAssetId(segment.voiceoverAsset?.assetId);
  const explicitSpeechDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.speechDuration);
  const speechTimelineDurationSeconds = getWorkspaceSegmentSpeechTimelineDurationSeconds(segment);
  const voiceSourceDurationSeconds =
    voiceSourceRange !== null && voiceSourceRange.endTime > voiceSourceRange.startTime
      ? voiceSourceRange.endTime - voiceSourceRange.startTime
      : null;
  const estimatedProjectVoiceoverLeakDurationSeconds =
    getWorkspaceSegmentEstimatedProjectVoiceoverLeakDuration(segment, voiceoverAssetDurationSeconds);
  const hasShorterSceneVoiceoverTimingThanAsset =
    voiceoverAssetDurationSeconds !== null &&
    [
      explicitSpeechDurationSeconds,
      speechTimelineDurationSeconds,
      voiceSourceDurationSeconds,
      estimatedProjectVoiceoverLeakDurationSeconds,
    ].some(
      (durationSeconds) =>
        durationSeconds !== null &&
        durationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS < voiceoverAssetDurationSeconds,
    );
  const hasLeakedSharedFullVoiceoverAssetRange =
    rawVoiceoverAssetPreviewUrl !== null &&
    voiceSourceRange !== null &&
    isWorkspaceSegmentProjectVoiceoverFullAssetDurationLeak(segment, session, voiceSourceDurationSeconds);
  const isLeakedProjectVoiceoverAsset =
    hasLeakedSharedFullVoiceoverAssetRange ||
    (!isProjectVoiceoverAsset &&
      rawVoiceoverAssetPreviewUrl !== null &&
      voiceoverAssetDurationSeconds !== null &&
      voiceSourceRange === null &&
      hasShorterSceneVoiceoverTimingThanAsset &&
      getWorkspaceSegmentSceneDurationCandidates(segment).some(
        (durationSeconds) =>
          durationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS < voiceoverAssetDurationSeconds,
      ));
  const isWindowedVoiceoverAsset =
    !isProjectVoiceoverAsset &&
    rawVoiceoverAssetPreviewUrl !== null &&
    voiceSourceRange !== null &&
    (voiceSourceRange.startTime > WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS ||
      (voiceoverAssetDurationSeconds !== null &&
        voiceSourceRange.endTime < voiceoverAssetDurationSeconds - WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS));
  const latestSceneVoiceoverAudioUrl =
    isProjectVoiceoverAsset || isSharedVoiceoverAsset || isWindowedVoiceoverAsset || isLeakedProjectVoiceoverAsset
      ? null
      : rawVoiceoverAssetPreviewUrl;
  const windowedVoiceoverAudioUrl =
    isWindowedVoiceoverAsset || isLeakedProjectVoiceoverAsset ? rawVoiceoverAssetPreviewUrl : null;
  const effectiveVoiceIdForVersion = voiceOption?.id ?? getWorkspaceSegmentEffectiveVoiceId(segment, session) ?? "";
  const version = [
    segment.voiceoverAsset?.assetId ?? "",
    segment.voiceoverTextHash ?? "",
    segment.voiceoverVoiceType ?? "",
    segment.voiceoverLanguage ?? "",
    session.ttsAssetId ?? "",
    normalizeWorkspaceSegmentEditorTextForCompare(segment.text),
    effectiveVoiceIdForVersion,
  ].join(":");
  const previewRange = getWorkspaceSegmentVoiceoverPreviewRange(segment, session);
  const projectVoiceoverAssetId =
    getPositiveWorkspaceMediaAssetId(session.ttsAssetId) ??
    (isSharedVoiceoverAsset || isWindowedVoiceoverAsset || isLeakedProjectVoiceoverAsset ? voiceoverAssetId : null);
  const hasProjectVoiceoverTiming = hasWorkspaceSegmentProjectVoiceoverTimingData(segment);
  const projectTimelineFallbackRange =
    allowProjectTimelineFallback && !hasProjectVoiceoverTiming
      ? getWorkspaceSegmentTimelineVoiceoverPreviewRange(segment, session)
      : null;
  const canUseProjectTimelineFallback =
    allowProjectTimelineFallback &&
    projectTimelineFallbackRange !== null &&
    isWorkspaceSegmentProjectTimelineVoiceoverAvailable(segment, session, {
      allowFinalVideoStaleWithMissingVoiceoverMetadata: allowFinalVideoStaleProjectTimelineFallback,
      allowMissingVoiceoverMetadata: true,
    });
  const effectivePreviewRange = canUseProjectTimelineFallback ? projectTimelineFallbackRange : previewRange;
  const canUseProjectVoiceoverAudio =
    voiceEnabled &&
    projectVoiceoverAssetId !== null &&
    effectivePreviewRange !== null &&
    (hasProjectVoiceoverTiming || canUseProjectTimelineFallback);
  const canUseLeakedProjectVoiceoverSegmentProxy =
    voiceEnabled &&
    projectVoiceoverAssetId !== null &&
    effectivePreviewRange !== null &&
    (isWindowedVoiceoverAsset || isLeakedProjectVoiceoverAsset) &&
    !hasLeakedSharedFullVoiceoverAssetRange;
  const canUseSharedProjectVoiceoverSegmentProxy =
    voiceEnabled &&
    projectVoiceoverAssetId !== null &&
    effectivePreviewRange !== null &&
    isSharedVoiceoverAsset &&
    !hasLeakedSharedFullVoiceoverAssetRange;
  const canUseSegmentVoiceoverAudioProxy =
    (canUseProjectVoiceoverAudio && hasProjectVoiceoverTiming && !hasLeakedSharedFullVoiceoverAssetRange) ||
    canUseLeakedProjectVoiceoverSegmentProxy ||
    canUseSharedProjectVoiceoverSegmentProxy;
  const projectVoiceoverAudioUrl =
    (canUseProjectVoiceoverAudio ||
      canUseLeakedProjectVoiceoverSegmentProxy ||
      canUseSharedProjectVoiceoverSegmentProxy) &&
    projectVoiceoverAssetId !== null
      ? buildWorkspaceMediaAssetPlaybackUrl(projectVoiceoverAssetId)
      : null;
  const segmentVoiceoverAudioUrl =
    canUseSegmentVoiceoverAudioProxy
      ? buildWorkspaceSegmentVoiceoverAudioProxyUrl(session.projectId, segment.index, version)
      : null;
  const preferredSegmentVoiceoverAudioUrl = preferSegmentProxy ? segmentVoiceoverAudioUrl : null;
  const audioUrl = isVoiceAudioStale
    ? null
    : latestSceneVoiceoverAudioUrl ??
      preferredSegmentVoiceoverAudioUrl ??
      windowedVoiceoverAudioUrl ??
      projectVoiceoverAudioUrl;
  const sourceKind =
    audioUrl === null
      ? null
      : audioUrl === latestSceneVoiceoverAudioUrl
        ? "scene"
        : audioUrl === projectVoiceoverAudioUrl || audioUrl === windowedVoiceoverAudioUrl
          ? "project"
          : "segment";

  return {
    audioUrl,
    latestSceneVoiceoverAudioUrl,
    previewRange: effectivePreviewRange,
    projectVoiceoverAudioUrl,
    segmentVoiceoverAudioUrl,
    shouldClip: audioUrl !== null && (audioUrl === projectVoiceoverAudioUrl || audioUrl === windowedVoiceoverAudioUrl),
    sourceKind,
    version,
  };
};

export const rewriteWorkspaceSegmentProjectProxyUrl = (value: string | null | undefined, projectId: number) => {
  const normalized = String(value ?? "").trim();
  if (!normalized || !normalized.includes("/api/workspace/project-segment-video")) {
    return value ?? null;
  }

  try {
    const url = new URL(normalized, window.location.origin);
    url.searchParams.set("projectId", String(projectId));
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return normalized.replace(/([?&]projectId=)[^&#]*/i, `$1${projectId}`);
  }
};

export const ensureWorkspaceSegmentOriginalProxyReference = (
  segment: WorkspaceSegmentEditorDraftSegment,
  projectId: number | null | undefined,
  options?: { force?: boolean },
): WorkspaceSegmentEditorDraftSegment => {
  const normalizedProjectId = Number(projectId);
  if (
    !Number.isInteger(normalizedProjectId) ||
    normalizedProjectId <= 0 ||
    (!options?.force && (segment.originalPlaybackUrl || segment.originalPreviewUrl))
  ) {
    return segment;
  }

  return {
    ...segment,
    originalAsset: options?.force ? null : segment.originalAsset,
    originalExternalPlaybackUrl: options?.force ? null : segment.originalExternalPlaybackUrl,
    originalExternalPreviewUrl: options?.force ? null : segment.originalExternalPreviewUrl,
    originalPlaybackUrl: buildWorkspaceSegmentOriginalProxyUrl(normalizedProjectId, segment.index, "playback"),
    originalPosterUrl: options?.force ? null : segment.originalPosterUrl,
    originalPreviewUrl: buildWorkspaceSegmentOriginalProxyUrl(normalizedProjectId, segment.index, "preview"),
    originalSourceKind: options?.force || segment.originalSourceKind === "upload" ? "unknown" : segment.originalSourceKind,
  };
};

export const resetWorkspaceSegmentDraftVisualToOriginal = (
  segment: WorkspaceSegmentEditorDraftSegment,
  projectId?: number | null,
  timelineSourceSegment?: WorkspaceSegmentEditorDraftSegment | null,
): WorkspaceSegmentEditorDraftSegment => {
  const shouldRewriteOriginalProxy = shouldRewriteWorkspaceSegmentOriginalProxyOnReset(segment);
  const sourceSegment = shouldRewriteOriginalProxy
    ? ensureWorkspaceSegmentOriginalProxyReference(segment, projectId, { force: true })
    : segment;
  const withTimelineState = (nextSegment: WorkspaceSegmentEditorDraftSegment) =>
    restoreWorkspaceSegmentTimelineDurationState(nextSegment, timelineSourceSegment);
  const resetSegment: WorkspaceSegmentEditorDraftSegment = {
    ...sourceSegment,
    aiPhotoAsset: null,
    aiPhotoGeneratedFromPrompt: null,
    aiPhotoPrompt: "",
    aiPhotoPromptInitialized: false,
    aiVideoAsset: null,
    aiVideoGeneratedMode: null,
    aiVideoGeneratedFromPrompt: null,
    aiVideoPrompt: "",
    aiVideoPromptInitialized: false,
    customVideo: null,
    imageEditAsset: null,
    imageEditGeneratedFromPrompt: null,
    imageEditPrompt: "",
    imageEditPromptInitialized: false,
    photoAnimationSourceAsset: null,
    videoAction: "original",
    visualReset: true,
  };

  if (!hasWorkspaceSegmentOriginalVisualReference(sourceSegment)) {
    return withTimelineState(clearWorkspaceSegmentCurrentVisualReference(resetSegment));
  }

  if (shouldRewriteOriginalProxy) {
    const correctedOriginalSegment: WorkspaceSegmentEditorDraftSegment = {
      ...sourceSegment,
      originalAsset: null,
      originalExternalPlaybackUrl: null,
      originalExternalPreviewUrl: null,
      originalPosterUrl: null,
      originalSourceKind: "unknown",
    };

    if (!sourceSegment.originalPlaybackUrl && !sourceSegment.originalPreviewUrl) {
      return withTimelineState(clearWorkspaceSegmentCurrentVisualReference({
        ...resetSegment,
        originalAsset: correctedOriginalSegment.originalAsset,
        originalExternalPlaybackUrl: correctedOriginalSegment.originalExternalPlaybackUrl,
        originalExternalPreviewUrl: correctedOriginalSegment.originalExternalPreviewUrl,
        originalPosterUrl: correctedOriginalSegment.originalPosterUrl,
        originalSourceKind: correctedOriginalSegment.originalSourceKind,
      }));
    }

    return withTimelineState({
      ...resetSegment,
      currentAsset: null,
      currentExternalPlaybackUrl: null,
      currentExternalPreviewUrl: null,
      currentPlaybackUrl: sourceSegment.originalPlaybackUrl,
      currentPosterUrl: sourceSegment.originalPosterUrl,
      currentPreviewUrl: sourceSegment.originalPreviewUrl,
      currentSourceKind: "unknown",
      mediaType: getWorkspaceSegmentOriginalMediaType(correctedOriginalSegment),
      originalAsset: correctedOriginalSegment.originalAsset,
      originalExternalPlaybackUrl: correctedOriginalSegment.originalExternalPlaybackUrl,
      originalExternalPreviewUrl: correctedOriginalSegment.originalExternalPreviewUrl,
      originalSourceKind: correctedOriginalSegment.originalSourceKind,
    });
  }

  return withTimelineState({
    ...resetSegment,
    currentAsset: cloneWorkspaceMediaAssetRef(sourceSegment.originalAsset),
    currentExternalPlaybackUrl: sourceSegment.originalExternalPlaybackUrl,
    currentExternalPreviewUrl: sourceSegment.originalExternalPreviewUrl,
    currentPlaybackUrl: sourceSegment.originalPlaybackUrl,
    currentPosterUrl: sourceSegment.originalPosterUrl,
    currentPreviewUrl: sourceSegment.originalPreviewUrl,
    currentSourceKind: sourceSegment.originalSourceKind,
    mediaType: getWorkspaceSegmentOriginalMediaType(sourceSegment),
  });
};

export const restoreWorkspaceSegmentDraftVisualFromBaseline = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentEditorDraftSegment =>
  restoreWorkspaceSegmentTimelineDurationState(
    {
      ...segment,
      aiPhotoAsset: cloneStudioCustomVideoFile(baselineSegment.aiPhotoAsset),
      aiPhotoGeneratedFromPrompt: baselineSegment.aiPhotoGeneratedFromPrompt,
      aiPhotoPrompt: baselineSegment.aiPhotoPrompt,
      aiPhotoPromptInitialized: baselineSegment.aiPhotoPromptInitialized,
      aiVideoAsset: cloneStudioCustomVideoFile(baselineSegment.aiVideoAsset),
      aiVideoGeneratedMode: baselineSegment.aiVideoGeneratedMode,
      aiVideoGeneratedFromPrompt: baselineSegment.aiVideoGeneratedFromPrompt,
      aiVideoPrompt: baselineSegment.aiVideoPrompt,
      aiVideoPromptInitialized: baselineSegment.aiVideoPromptInitialized,
      currentAsset: cloneWorkspaceMediaAssetRef(baselineSegment.currentAsset),
      currentExternalPlaybackUrl: baselineSegment.currentExternalPlaybackUrl,
      currentExternalPreviewUrl: baselineSegment.currentExternalPreviewUrl,
      currentPlaybackUrl: baselineSegment.currentPlaybackUrl,
      currentPosterUrl: baselineSegment.currentPosterUrl,
      currentPreviewUrl: baselineSegment.currentPreviewUrl,
      currentSourceKind: baselineSegment.currentSourceKind,
      customVideo: cloneStudioCustomVideoFile(baselineSegment.customVideo),
      imageEditAsset: cloneStudioCustomVideoFile(baselineSegment.imageEditAsset),
      imageEditGeneratedFromPrompt: baselineSegment.imageEditGeneratedFromPrompt,
      imageEditPrompt: baselineSegment.imageEditPrompt,
      imageEditPromptInitialized: baselineSegment.imageEditPromptInitialized,
      mediaType: baselineSegment.mediaType,
      originalAsset: cloneWorkspaceMediaAssetRef(baselineSegment.originalAsset),
      originalExternalPlaybackUrl: baselineSegment.originalExternalPlaybackUrl,
      originalExternalPreviewUrl: baselineSegment.originalExternalPreviewUrl,
      originalPlaybackUrl: baselineSegment.originalPlaybackUrl,
      originalPosterUrl: baselineSegment.originalPosterUrl,
      originalPreviewUrl: baselineSegment.originalPreviewUrl,
      originalSourceKind: baselineSegment.originalSourceKind,
      photoAnimationSourceAsset: cloneStudioCustomVideoFile(baselineSegment.photoAnimationSourceAsset),
      sceneSoundAsset: cloneStudioCustomVideoFile(baselineSegment.sceneSoundAsset),
      sceneSoundGeneratedFromPrompt: baselineSegment.sceneSoundGeneratedFromPrompt,
      sceneSoundPrompt: baselineSegment.sceneSoundPrompt,
      sceneSoundPromptInitialized: baselineSegment.sceneSoundPromptInitialized,
      voiceoverAsset: cloneStudioCustomVideoFile(baselineSegment.voiceoverAsset),
      voiceoverLanguage: baselineSegment.voiceoverLanguage,
      voiceoverTextHash: baselineSegment.voiceoverTextHash,
      voiceoverVoiceType: baselineSegment.voiceoverVoiceType,
      videoAction: baselineSegment.videoAction,
      voiceType: getWorkspaceSegmentVoiceOverrideId(baselineSegment),
      voice_type: getWorkspaceSegmentVoiceOverrideId(baselineSegment),
      visualReset: Boolean(baselineSegment.visualReset),
    },
    baselineSegment,
  );

export const normalizeWorkspaceSegmentEditorSetting = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
};

export const normalizeWorkspaceSegmentEditorSegmentUrls = <
  T extends {
    currentExternalPlaybackUrl?: string | null;
    currentExternalPreviewUrl?: string | null;
    currentPlaybackUrl?: string | null;
    currentPosterUrl?: string | null;
    currentPreviewUrl?: string | null;
    currentVideoUrl?: string | null;
    currentSourceKind?: WorkspaceSegmentSourceKind | string | null;
    originalExternalPlaybackUrl?: string | null;
    originalExternalPreviewUrl?: string | null;
    originalPlaybackUrl?: string | null;
    originalPosterUrl?: string | null;
    originalPreviewUrl?: string | null;
    originalVideoUrl?: string | null;
    originalSourceKind?: WorkspaceSegmentSourceKind | string | null;
  },
>(
  segment: T,
) => ({
  ...segment,
  currentExternalPlaybackUrl: normalizeWorkspaceSegmentMediaAssetProxyUrl(segment.currentExternalPlaybackUrl),
  currentExternalPreviewUrl: normalizeWorkspaceSegmentMediaAssetProxyUrl(segment.currentExternalPreviewUrl),
  currentPlaybackUrl: normalizeWorkspaceSegmentEditorUrl(
    segment.currentPlaybackUrl ?? segment.currentPreviewUrl ?? segment.currentVideoUrl,
  ),
  currentPosterUrl: normalizeWorkspaceSegmentEditorUrl(segment.currentPosterUrl),
  currentPreviewUrl: normalizeWorkspaceSegmentEditorUrl(
    segment.currentPreviewUrl ?? segment.currentPlaybackUrl ?? segment.currentVideoUrl,
  ),
  currentSourceKind: normalizeWorkspaceSegmentSourceKind(segment.currentSourceKind),
  originalExternalPlaybackUrl: normalizeWorkspaceSegmentMediaAssetProxyUrl(segment.originalExternalPlaybackUrl),
  originalExternalPreviewUrl: normalizeWorkspaceSegmentMediaAssetProxyUrl(segment.originalExternalPreviewUrl),
  originalPlaybackUrl: normalizeWorkspaceSegmentEditorUrl(
    segment.originalPlaybackUrl ?? segment.originalPreviewUrl ?? segment.originalVideoUrl,
  ),
  originalPosterUrl: normalizeWorkspaceSegmentEditorUrl(segment.originalPosterUrl),
  originalPreviewUrl: normalizeWorkspaceSegmentEditorUrl(
    segment.originalPreviewUrl ?? segment.originalPlaybackUrl ?? segment.originalVideoUrl,
  ),
  originalSourceKind: normalizeWorkspaceSegmentSourceKind(segment.originalSourceKind),
});

export const cloneWorkspaceSegmentEditorDraftSession = (
  session: WorkspaceSegmentEditorDraftSession,
): WorkspaceSegmentEditorDraftSession => {
  const fallbackLanguage = getWorkspaceSegmentEditorSessionLanguage(session);

  return {
    ...sanitizeWorkspaceSegmentEditorCustomMusicState(session, {
      allowEphemeralCustomMusic: true,
    }),
    segments: repairWorkspaceSegmentEditorSpeechWordBoundaries(
      session.segments.map((segment) => cloneWorkspaceSegmentEditorDraftSegment(segment, fallbackLanguage)),
    ),
  };
};

export const applyWorkspaceSegmentPendingInfographicTransforms = (
  draft: WorkspaceSegmentEditorDraftSession,
  pendingTransforms: Readonly<Record<number, WorkspaceSegmentInfographicTransform | undefined>>,
): {
  changedSegmentIndexes: number[];
  draft: WorkspaceSegmentEditorDraftSession;
} => {
  const changedSegmentIndexes: number[] = [];
  const segments = draft.segments.map((segment) => {
    const pendingTransform = pendingTransforms[segment.index];
    const currentTransform = segment.infographic?.transform;
    if (
      !pendingTransform ||
      !segment.infographic ||
      (
        currentTransform?.centerX === pendingTransform.centerX &&
        currentTransform.centerY === pendingTransform.centerY &&
        currentTransform.width === pendingTransform.width
      )
    ) {
      return segment;
    }

    changedSegmentIndexes.push(segment.index);
    return {
      ...segment,
      infographic: {
        ...segment.infographic,
        transform: { ...pendingTransform },
      },
      infographicRemoved: false,
    };
  });

  return {
    changedSegmentIndexes,
    draft: changedSegmentIndexes.length > 0 ? { ...draft, segments } : draft,
  };
};

export const shouldPreferEstimatedDurationForDraftSegment = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const hasSpeechTiming =
    (typeof segment.speechDuration === "number" && Number.isFinite(segment.speechDuration) && segment.speechDuration > 0) ||
    (typeof segment.speechStartTime === "number" && Number.isFinite(segment.speechStartTime)) ||
    (typeof segment.speechEndTime === "number" && Number.isFinite(segment.speechEndTime)) ||
    getWorkspaceSegmentVoiceSourceRange(segment) !== null ||
    getWorkspaceSegmentVoiceSourceDurationSeconds(segment) !== null ||
    segment.speechWords.length > 0;
  if (hasSpeechTiming) {
    return false;
  }

  if (hasWorkspaceSegmentPersistedMediaReference(segment)) {
    return false;
  }

  return getWorkspaceSegmentPreviewKind(segment) === "image";
};

export const getWorkspaceSegmentEffectiveVoiceEnabled = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> | null,
) => {
  if (doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio(segment)) {
    return false;
  }

  const voiceOverrideId = getWorkspaceSegmentVoiceOverrideId(segment);
  if (voiceOverrideId === "none") {
    return false;
  }

  const voiceoverVoiceType = normalizeWorkspaceSegmentEditorSetting(segment.voiceoverVoiceType);
  return (
    normalizeWorkspaceSegmentEditorSetting(session?.voiceType) !== "none" ||
    Boolean(voiceOverrideId) ||
    Boolean(voiceoverVoiceType && voiceoverVoiceType !== "none")
  );
};

export const getWorkspaceSegmentEffectiveVoiceId = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> | null,
) => {
  if (!getWorkspaceSegmentEffectiveVoiceEnabled(segment, session)) {
    return null;
  }

  const voiceOverrideId = getWorkspaceSegmentVoiceOverrideId(segment);
  if (voiceOverrideId && voiceOverrideId !== "none") {
    return voiceOverrideId;
  }

  const sessionVoiceType = normalizeWorkspaceSegmentEditorSetting(session?.voiceType);
  if (sessionVoiceType && sessionVoiceType !== "none") {
    return sessionVoiceType;
  }

  const voiceoverVoiceType = normalizeWorkspaceSegmentEditorSetting(segment.voiceoverVoiceType);
  return voiceoverVoiceType && voiceoverVoiceType !== "none" ? voiceoverVoiceType : null;
};

export const restoreWorkspaceSegmentEffectiveVoiceFromBaseline = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  options: {
    baselineSession: Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> | null | undefined;
    draftSession: Pick<WorkspaceSegmentEditorDraftSession, "voiceType">;
  },
): WorkspaceSegmentEditorDraftSegment => {
  const restoredSegment = baselineSegment
    ? restoreWorkspaceSegmentTimelineSnapshot(segment, baselineSegment, "voice")
    : {
        ...segment,
        speechDuration: null,
        speechDurationSource: null,
        speechEndTime: null,
        speechStartTime: null,
        speechWords: [],
        voiceSourceDuration: null,
        voiceSourceEndTime: null,
        voiceSourceStartTime: null,
        voiceoverAsset: null,
        voiceoverLanguage: null,
        voiceoverTextHash: null,
        voiceoverVoiceType: null,
      };
  const draftProjectVoiceId = normalizeWorkspaceSegmentEditorSetting(options.draftSession.voiceType);
  const baselineProjectVoiceId = normalizeWorkspaceSegmentEditorSetting(options.baselineSession?.voiceType);
  const baselineVoiceEnabled = baselineSegment
    ? getWorkspaceSegmentEffectiveVoiceEnabled(baselineSegment, options.baselineSession)
    : Boolean(baselineProjectVoiceId && baselineProjectVoiceId !== "none");
  const baselineVoiceId = baselineSegment
    ? getWorkspaceSegmentEffectiveVoiceId(baselineSegment, options.baselineSession)
    : baselineVoiceEnabled
      ? baselineProjectVoiceId
      : null;
  const nextVoiceOverrideId = !baselineVoiceEnabled
    ? draftProjectVoiceId && draftProjectVoiceId !== "none"
      ? "none"
      : null
    : baselineVoiceId && baselineVoiceId !== draftProjectVoiceId
      ? baselineVoiceId
      : null;

  return {
    ...restoredSegment,
    voiceType: nextVoiceOverrideId,
    voice_type: nextVoiceOverrideId,
  };
};

export const isWorkspaceSegmentVoiceoverAssetFresh = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "voiceType" | "language" | "ttsAssetId"> | null,
) => {
  if (!segment.voiceoverAsset) {
    return false;
  }

  const assetId = getWorkspaceSegmentCustomAssetId(segment.voiceoverAsset);
  const ttsAssetId = getPositiveWorkspaceMediaAssetId(session?.ttsAssetId);
  if (assetId !== null && ttsAssetId !== null && assetId === ttsAssetId) {
    return false;
  }

  const sessionLanguage = normalizeStudioLanguageValue(session?.language);
  const assetLanguage = normalizeStudioLanguageValue(segment.voiceoverLanguage);
  const language = getWorkspaceSegmentVoiceLanguage(segment, sessionLanguage);
  const voiceOverrideId = getWorkspaceSegmentVoiceOverrideId(segment);
  if (voiceOverrideId === "none") {
    return false;
  }
  const sessionVoiceType = normalizeWorkspaceSegmentEditorSetting(session?.voiceType);
  const voiceoverVoiceType = normalizeWorkspaceSegmentEditorSetting(segment.voiceoverVoiceType);
  const voiceType = voiceOverrideId ?? (sessionVoiceType !== "none" ? sessionVoiceType : null) ?? voiceoverVoiceType;
  if (!voiceType) {
    return false;
  }

  return (
    segment.voiceoverTextHash === getWorkspaceSegmentVoiceoverTextHash(segment.text) &&
    normalizeWorkspaceSegmentEditorSetting(segment.voiceoverVoiceType) === normalizeWorkspaceSegmentEditorSetting(voiceType) &&
    (assetLanguage ?? language) === language
  );
};

export const getStudioCustomVideoFileDurationSeconds = (asset: StudioCustomVideoFile | null | undefined) =>
  normalizeWorkspaceSegmentManualDurationSeconds(asset?.durationSeconds);

export const getWorkspaceMediaAssetDurationSeconds = (asset: WorkspaceMediaAssetRef | null | undefined) =>
  normalizeWorkspaceSegmentManualDurationSeconds(
    asset?.durationSeconds ??
      (asset as { duration_seconds?: unknown } | null | undefined)?.duration_seconds ??
      (asset as { duration?: unknown } | null | undefined)?.duration,
  );

const getWorkspaceSegmentMediaAssetVisualDurationSeconds = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const mediaAssetDuration =
    getWorkspaceMediaAssetDurationSeconds(segment.currentAsset) ??
    getWorkspaceMediaAssetDurationSeconds(segment.originalAsset);
  const durationExtensionSourceDurationSeconds = getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment);

  if (isWorkspaceSegmentGeneratedVideoVisual(segment)) {
    const generatedVideoDurationCandidates = [
      mediaAssetDuration,
      durationExtensionSourceDurationSeconds,
      WORKSPACE_SEGMENT_AI_EXTENSION_STEP_SECONDS,
    ].filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);

    return generatedVideoDurationCandidates.length > 0
      ? roundWorkspaceSegmentTimelineSeconds(Math.max(...generatedVideoDurationCandidates))
      : null;
  }

  return mediaAssetDuration ?? durationExtensionSourceDurationSeconds;
};

export const isWorkspaceSegmentProjectVoiceoverAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId"> | null,
) => {
  const assetId = getWorkspaceSegmentCustomAssetId(segment.voiceoverAsset);
  const ttsAssetId = getPositiveWorkspaceMediaAssetId(session?.ttsAssetId);
  return assetId !== null && ttsAssetId !== null && assetId === ttsAssetId;
};

const isWorkspaceSegmentSharedVoiceoverAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Partial<Pick<WorkspaceSegmentEditorDraftSession, "segments">> | null,
) => {
  const assetId = getWorkspaceSegmentCustomAssetId(segment.voiceoverAsset);
  if (assetId === null || !Array.isArray(session?.segments)) {
    return false;
  }

  return session.segments.some(
    (candidate) =>
      candidate.index !== segment.index &&
      getWorkspaceSegmentCustomAssetId(candidate.voiceoverAsset) === assetId,
  );
};

export const isWorkspaceSegmentProjectTimelineVoiceoverAvailable = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?:
    | (Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId" | "voiceType"> &
        Partial<Pick<WorkspaceSegmentEditorDraftSession, "finalVideoStale" | "language">>)
    | null,
  options?: { allowFinalVideoStaleWithMissingVoiceoverMetadata?: boolean; allowMissingVoiceoverMetadata?: boolean },
) => {
  const projectVoiceoverAssetId = getPositiveWorkspaceMediaAssetId(session?.ttsAssetId);
  if (projectVoiceoverAssetId === null || !getWorkspaceSegmentEffectiveVoiceEnabled(segment, session)) {
    return false;
  }

  const segmentVoiceoverAssetId = getWorkspaceSegmentCustomAssetId(segment.voiceoverAsset);
  if (segmentVoiceoverAssetId !== null && segmentVoiceoverAssetId !== projectVoiceoverAssetId) {
    return false;
  }

  const effectiveVoiceId = normalizeWorkspaceSegmentEditorSetting(
    getWorkspaceSegmentEffectiveVoiceId(segment, session),
  );
  if (!effectiveVoiceId) {
    return false;
  }

  if (!hasWorkspaceSegmentProjectVoiceoverTimingData(segment)) {
    return false;
  }

  const voiceoverTextHash = String(segment.voiceoverTextHash ?? "").trim();
  const voiceoverVoiceType = normalizeWorkspaceSegmentEditorSetting(segment.voiceoverVoiceType);
  const hasTextMetadata = voiceoverTextHash.length > 0;
  const hasVoiceMetadata = Boolean(voiceoverVoiceType);

  if (!hasTextMetadata && !hasVoiceMetadata) {
    return (
      Boolean(options?.allowMissingVoiceoverMetadata) &&
      (session?.finalVideoStale !== true || Boolean(options?.allowFinalVideoStaleWithMissingVoiceoverMetadata))
    );
  }

  if (!hasTextMetadata || !hasVoiceMetadata) {
    return false;
  }

  const sessionLanguage = normalizeStudioLanguageValue(session?.language);
  const voiceoverLanguage = normalizeStudioLanguageValue(segment.voiceoverLanguage);
  const languageMatches = !voiceoverLanguage || !sessionLanguage || voiceoverLanguage === sessionLanguage;

  return (
    languageMatches &&
    voiceoverTextHash === getWorkspaceSegmentVoiceoverTextHash(segment.text) &&
    normalizeWorkspaceSegmentEditorSetting(voiceoverVoiceType) === effectiveVoiceId
  );
};

const resolveWorkspaceSegmentProjectVoiceoverVoiceOverrideId = (
  segment: Pick<
    WorkspaceSegmentEditorSegment,
    "text" | "voiceType" | "voice_type" | "voiceoverTextHash" | "voiceoverVoiceType"
  >,
  options: {
    hasProjectVoiceoverTiming: boolean;
    sessionTtsAssetId?: number | null;
    sessionVoiceType?: string | null;
    voiceoverAsset?: StudioCustomVideoFile | null;
  },
) => {
  const voiceOverrideId = getWorkspaceSegmentVoiceOverrideId(segment);
  if (!voiceOverrideId || voiceOverrideId === "none") {
    return voiceOverrideId;
  }

  const sessionVoiceType = normalizeWorkspaceSegmentEditorSetting(options.sessionVoiceType);
  const voiceoverVoiceType = normalizeWorkspaceSegmentEditorSetting(segment.voiceoverVoiceType);
  if (
    !sessionVoiceType ||
    sessionVoiceType === "none" ||
    !voiceoverVoiceType ||
    voiceoverVoiceType !== sessionVoiceType ||
    voiceOverrideId === voiceoverVoiceType
  ) {
    return voiceOverrideId;
  }

  const voiceoverTextHash = typeof segment.voiceoverTextHash === "string" ? segment.voiceoverTextHash.trim() : "";
  if (voiceoverTextHash !== getWorkspaceSegmentVoiceoverTextHash(segment.text)) {
    return voiceOverrideId;
  }

  const ttsAssetId = getPositiveWorkspaceMediaAssetId(options.sessionTtsAssetId);
  const voiceoverAssetId = getWorkspaceSegmentCustomAssetId(options.voiceoverAsset);
  const hasProjectVoiceoverAsset = ttsAssetId !== null && voiceoverAssetId !== null && voiceoverAssetId === ttsAssetId;
  return options.hasProjectVoiceoverTiming || hasProjectVoiceoverAsset ? null : voiceOverrideId;
};

export const getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds = (
  segment:
    | Pick<
        WorkspaceSegmentEditorDraftSegment,
        "durationExtensionSourceDurationSeconds" | "duration_extension_source_duration_seconds"
      >
    | null
    | undefined,
) =>
  normalizeWorkspaceSegmentManualDurationSeconds(
    segment?.durationExtensionSourceDurationSeconds ?? segment?.duration_extension_source_duration_seconds,
  );

export const getWorkspaceSegmentCanonicalSlotDurationSeconds = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const manualDuration = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
  if (manualDuration !== null) {
    return manualDuration;
  }

  const startTime = getWorkspaceSegmentEditorDisplayStartTime(segment);
  const timelineDuration = getWorkspaceSegmentEditorDisplayEndTime(segment) - startTime;
  const normalizedTimelineDuration = normalizeWorkspaceSegmentManualDurationSeconds(timelineDuration);
  if (normalizedTimelineDuration !== null) {
    return normalizedTimelineDuration;
  }

  return normalizeWorkspaceSegmentManualDurationSeconds(segment.duration);
};

export const getWorkspaceSegmentKnownVisualDurationSeconds = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const selectedVisualPreviewKind = getWorkspaceSegmentSelectedVisualPreviewKind(segment);
  const previewKind = getWorkspaceSegmentPreviewKind(segment);
  const isVideoVisualSegment =
    selectedVisualPreviewKind === "video" ||
    previewKind === "video" ||
    String(segment.mediaType ?? "").trim().toLowerCase() === "video";
  const manualVisualDuration = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
  if (
    selectedVisualPreviewKind === "video" &&
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" &&
    normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) === "visual" &&
    manualVisualDuration !== null
  ) {
    return roundWorkspaceSegmentTimelineSeconds(manualVisualDuration);
  }

  if (doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio(segment)) {
    const slotDurationSeconds = getWorkspaceSegmentCanonicalSlotDurationSeconds(segment);
    const assetDurationSeconds = getStudioCustomVideoFileDurationSeconds(getWorkspaceSegmentDraftVisualAsset(segment));
    const durationCandidates = [slotDurationSeconds, assetDurationSeconds].filter(
      (value): value is number => value !== null && Number.isFinite(value) && value > 0,
    );

    return durationCandidates.length > 0
      ? roundWorkspaceSegmentTimelineSeconds(Math.max(...durationCandidates))
      : null;
  }

  const hasUserSelectedVoiceoverSync =
    normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) === "voiceover" &&
    segment.durationSyncModeUserSelected === true;

  const visualAsset = getWorkspaceSegmentDraftVisualAsset(segment);
  const visualAssetDuration = getStudioCustomVideoFileDurationSeconds(visualAsset);
  if (visualAssetDuration !== null) {
    return visualAssetDuration;
  }

  if (isVideoVisualSegment && !hasUserSelectedVoiceoverSync && hasWorkspaceSegmentPersistedMediaReference(segment)) {
    const hasManualVisualSlot =
      normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" &&
      normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) === "visual";
    const directMediaAssetDurationSeconds =
      getWorkspaceMediaAssetDurationSeconds(segment.currentAsset) ??
      getWorkspaceMediaAssetDurationSeconds(segment.originalAsset);
    const storedSourceDurationSeconds = getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment);
    const hasSourceTimelineVoiceMetadata = getWorkspaceSegmentVoiceSourceDurationSeconds(segment) !== null;
    const slotDurationSeconds = getWorkspaceSegmentCanonicalSlotDurationSeconds(segment);
    if (
      slotDurationSeconds !== null &&
      directMediaAssetDurationSeconds === null &&
      storedSourceDurationSeconds === null &&
      (hasSourceTimelineVoiceMetadata ||
        (!hasManualVisualSlot &&
          slotDurationSeconds + WORKSPACE_SEGMENT_PERSISTED_SLOT_DEFAULT_DURATION_TOLERANCE_SECONDS >=
            WORKSPACE_SEGMENT_AI_EXTENSION_STEP_SECONDS))
    ) {
      return roundWorkspaceSegmentTimelineSeconds(slotDurationSeconds);
    }
  }

  const mediaAssetVisualDurationSeconds = getWorkspaceSegmentMediaAssetVisualDurationSeconds(segment);
  if (mediaAssetVisualDurationSeconds !== null) {
    return mediaAssetVisualDurationSeconds;
  }

  return null;
};

export const getWorkspaceSegmentVideoVisualSourceDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  options?: {
    baselineSegment?: WorkspaceSegmentEditorDraftSegment | null;
    measuredVisualDurationSeconds?: number | null;
  },
): number | null => {
  if (getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "video") {
    return null;
  }

  const measuredVisualDuration = normalizeWorkspaceSegmentManualDurationSeconds(options?.measuredVisualDurationSeconds);
  if (measuredVisualDuration !== null) {
    return roundWorkspaceSegmentTimelineSeconds(measuredVisualDuration);
  }

  const directMediaAssetVisualDuration =
    getWorkspaceMediaAssetDurationSeconds(segment.currentAsset) ??
    getWorkspaceMediaAssetDurationSeconds(segment.originalAsset);
  const directVisualDuration =
    getStudioCustomVideoFileDurationSeconds(getWorkspaceSegmentDraftVisualAsset(segment)) ??
    directMediaAssetVisualDuration ??
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment);
  if (directVisualDuration !== null) {
    return roundWorkspaceSegmentTimelineSeconds(directVisualDuration);
  }

  const baselineSegment = options?.baselineSegment;
  const currentVisualIdentity = getWorkspaceSegmentCurrentVisualIdentityKey(segment);
  const baselineVisualIdentity = baselineSegment ? getWorkspaceSegmentCurrentVisualIdentityKey(baselineSegment) : null;
  if (
    baselineSegment &&
    getWorkspaceSegmentSelectedVisualPreviewKind(baselineSegment) === "video" &&
    currentVisualIdentity &&
    baselineVisualIdentity &&
    currentVisualIdentity === baselineVisualIdentity
  ) {
    const baselineVisualDuration =
      getStudioCustomVideoFileDurationSeconds(getWorkspaceSegmentDraftVisualAsset(baselineSegment)) ??
      getWorkspaceMediaAssetDurationSeconds(baselineSegment.currentAsset) ??
      getWorkspaceMediaAssetDurationSeconds(baselineSegment.originalAsset) ??
      getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(baselineSegment);
    if (baselineVisualDuration !== null) {
      return roundWorkspaceSegmentTimelineSeconds(baselineVisualDuration);
    }
  }

  return null;
};

const getWorkspaceSegmentDirectVideoVisualSourceDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  options?: {
    baselineSegment?: WorkspaceSegmentEditorDraftSegment | null;
    measuredVisualDurationSeconds?: number | null;
  },
) => {
  if (getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "video") {
    return null;
  }

  const measuredVisualDuration = normalizeWorkspaceSegmentManualDurationSeconds(options?.measuredVisualDurationSeconds);
  if (measuredVisualDuration !== null) {
    return roundWorkspaceSegmentTimelineSeconds(measuredVisualDuration);
  }

  const directVisualDuration =
    getStudioCustomVideoFileDurationSeconds(getWorkspaceSegmentDraftVisualAsset(segment)) ??
    getWorkspaceMediaAssetDurationSeconds(segment.currentAsset) ??
    getWorkspaceMediaAssetDurationSeconds(segment.originalAsset);
  if (directVisualDuration !== null) {
    return roundWorkspaceSegmentTimelineSeconds(directVisualDuration);
  }

  const baselineSegment = options?.baselineSegment;
  const currentVisualIdentity = getWorkspaceSegmentCurrentVisualIdentityKey(segment);
  const baselineVisualIdentity = baselineSegment ? getWorkspaceSegmentCurrentVisualIdentityKey(baselineSegment) : null;
  if (
    baselineSegment &&
    getWorkspaceSegmentSelectedVisualPreviewKind(baselineSegment) === "video" &&
    currentVisualIdentity &&
    baselineVisualIdentity &&
    currentVisualIdentity === baselineVisualIdentity
  ) {
    const baselineVisualDuration =
      getStudioCustomVideoFileDurationSeconds(getWorkspaceSegmentDraftVisualAsset(baselineSegment)) ??
      getWorkspaceMediaAssetDurationSeconds(baselineSegment.currentAsset) ??
      getWorkspaceMediaAssetDurationSeconds(baselineSegment.originalAsset);
    if (baselineVisualDuration !== null) {
      return roundWorkspaceSegmentTimelineSeconds(baselineVisualDuration);
    }
  }

  return null;
};

export const getWorkspaceSegmentVideoVisualDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  options?: {
    baselineSegment?: WorkspaceSegmentEditorDraftSegment | null;
    measuredVisualDurationSeconds?: number | null;
    session?: Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> | null;
  },
): number | null => {
  if (getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "video") {
    return null;
  }

  const manualSlotDuration = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
  if (
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" &&
    normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) === "visual" &&
    manualSlotDuration !== null
  ) {
    return roundWorkspaceSegmentTimelineSeconds(manualSlotDuration);
  }

  const measuredVisualDuration = normalizeWorkspaceSegmentManualDurationSeconds(options?.measuredVisualDurationSeconds);
  if (measuredVisualDuration !== null) {
    return roundWorkspaceSegmentTimelineSeconds(measuredVisualDuration);
  }

  const directMediaAssetVisualDuration =
    getWorkspaceMediaAssetDurationSeconds(segment.currentAsset) ??
    getWorkspaceMediaAssetDurationSeconds(segment.originalAsset);
  const directVisualDuration =
    getStudioCustomVideoFileDurationSeconds(getWorkspaceSegmentDraftVisualAsset(segment)) ??
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment) ??
    directMediaAssetVisualDuration;
  if (directVisualDuration !== null) {
    return roundWorkspaceSegmentTimelineSeconds(directVisualDuration);
  }

  const baselineSegment = options?.baselineSegment;
  const currentVisualIdentity = getWorkspaceSegmentCurrentVisualIdentityKey(segment);
  const baselineVisualIdentity = baselineSegment ? getWorkspaceSegmentCurrentVisualIdentityKey(baselineSegment) : null;
  if (
    baselineSegment &&
    getWorkspaceSegmentSelectedVisualPreviewKind(baselineSegment) === "video" &&
    currentVisualIdentity &&
    baselineVisualIdentity &&
    currentVisualIdentity === baselineVisualIdentity
  ) {
    const baselineVisualDuration =
      getStudioCustomVideoFileDurationSeconds(getWorkspaceSegmentDraftVisualAsset(baselineSegment)) ??
      getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(baselineSegment);
    if (baselineVisualDuration !== null) {
      return roundWorkspaceSegmentTimelineSeconds(baselineVisualDuration);
    }
  }

  return null;
};

export const getWorkspaceSegmentBaselineDurationExtensionSourceDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
) =>
  getStudioCustomVideoFileDurationSeconds(getWorkspaceSegmentDraftVisualAsset(segment)) ??
  getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment) ??
  getWorkspaceSegmentKnownVisualDurationSeconds(segment) ??
  getWorkspaceSegmentCanonicalSlotDurationSeconds(segment) ??
  normalizeWorkspaceSegmentManualDurationSeconds(segment.duration);

export type WorkspaceSegmentDurationExtensionSourceOptions = {
  sourceDurationSeconds?: number | null;
};

export const getWorkspaceSegmentDurationExtensionPlan = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment?: WorkspaceSegmentEditorDraftSegment | null,
  options?: WorkspaceSegmentDurationExtensionSourceOptions,
) => {
  const slotDurationSeconds = getWorkspaceSegmentCanonicalSlotDurationSeconds(segment);
  if (slotDurationSeconds === null) {
    return null;
  }

  const draftVisualAssetDurationSeconds = getStudioCustomVideoFileDurationSeconds(getWorkspaceSegmentDraftVisualAsset(segment));
  const storedDurationExtensionSourceDurationSeconds =
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment);
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);
  const usableStoredDurationExtensionSourceDurationSeconds =
    storedDurationExtensionSourceDurationSeconds !== null &&
    (storedDurationExtensionSourceDurationSeconds < slotDurationSeconds - WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS ||
      latestVisualAction === "photo_animation")
      ? storedDurationExtensionSourceDurationSeconds
      : null;
  const baselineVisualDurationSeconds = baselineSegment
    ? getWorkspaceSegmentBaselineDurationExtensionSourceDurationSeconds(baselineSegment)
    : null;
  const explicitSourceDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(options?.sourceDurationSeconds);
  const sourceDurationSeconds =
    explicitSourceDurationSeconds ??
    draftVisualAssetDurationSeconds ??
    usableStoredDurationExtensionSourceDurationSeconds ??
    baselineVisualDurationSeconds;
  if (sourceDurationSeconds === null || slotDurationSeconds <= sourceDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS) {
    return null;
  }

  return {
    canRequestAiExtension: Boolean(getWorkspaceSegmentDurationExtensionStillSourceAsset(segment)),
    extraDurationSeconds: roundWorkspaceSegmentTimelineSeconds(slotDurationSeconds - sourceDurationSeconds),
    mode: "cinematic_hold" as const,
    slotDurationSeconds: roundWorkspaceSegmentTimelineSeconds(slotDurationSeconds),
    sourceDurationSeconds: roundWorkspaceSegmentTimelineSeconds(sourceDurationSeconds),
  };
};

export const getWorkspaceSegmentDurationExtensionSourceDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment?: WorkspaceSegmentEditorDraftSegment | null,
  options?: WorkspaceSegmentDurationExtensionSourceOptions,
) => {
  const slotDurationSeconds = getWorkspaceSegmentCanonicalSlotDurationSeconds(segment);
  const storedDurationExtensionSourceDurationSeconds =
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment);
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);
  const usableStoredDurationExtensionSourceDurationSeconds =
    storedDurationExtensionSourceDurationSeconds !== null &&
    (slotDurationSeconds === null ||
      storedDurationExtensionSourceDurationSeconds < slotDurationSeconds - WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS ||
      storedDurationExtensionSourceDurationSeconds > slotDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS ||
      latestVisualAction === "photo_animation")
      ? storedDurationExtensionSourceDurationSeconds
      : null;
  const explicitSourceDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(options?.sourceDurationSeconds);

  return (
    explicitSourceDurationSeconds ??
    getStudioCustomVideoFileDurationSeconds(getWorkspaceSegmentDraftVisualAsset(segment)) ??
    usableStoredDurationExtensionSourceDurationSeconds ??
    (baselineSegment ? getWorkspaceSegmentBaselineDurationExtensionSourceDurationSeconds(baselineSegment) : null) ??
    normalizeWorkspaceSegmentManualDurationSeconds(segment.duration)
  );
};

export const resolveWorkspaceSegmentVideoExtensionMenuSourceDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment?: WorkspaceSegmentEditorDraftSegment | null,
  options?: {
    fallbackDurationSeconds?: number | null;
    measuredVisualDurationSeconds?: number | null;
  },
) => {
  const fallbackDurationSeconds =
    normalizeWorkspaceSegmentManualDurationSeconds(options?.fallbackDurationSeconds) ??
    WORKSPACE_SEGMENT_AI_EXTENSION_STEP_SECONDS;
  const slotDurationSeconds = getWorkspaceSegmentCanonicalSlotDurationSeconds(segment);
  const directVideoSourceDurationSeconds = getWorkspaceSegmentDirectVideoVisualSourceDurationSeconds(segment, {
    baselineSegment,
    measuredVisualDurationSeconds: options?.measuredVisualDurationSeconds,
  });
  const storedDurationExtensionSourceDurationSeconds =
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment);
  const shouldIgnoreStoredSlotDurationSource =
    directVideoSourceDurationSeconds !== null &&
    storedDurationExtensionSourceDurationSeconds !== null &&
    slotDurationSeconds !== null &&
    storedDurationExtensionSourceDurationSeconds > directVideoSourceDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS &&
    Math.abs(storedDurationExtensionSourceDurationSeconds - slotDurationSeconds) <= WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS;
  const currentSourceDurationCandidates =
    directVideoSourceDurationSeconds !== null
      ? [
          directVideoSourceDurationSeconds,
          shouldIgnoreStoredSlotDurationSource ? null : storedDurationExtensionSourceDurationSeconds,
        ].filter((duration): duration is number => duration !== null && Number.isFinite(duration) && duration > 0)
      : [
          getWorkspaceSegmentKnownVisualDurationSeconds(segment),
          getWorkspaceSegmentVideoVisualSourceDurationSeconds(segment, { baselineSegment }),
          storedDurationExtensionSourceDurationSeconds,
        ].filter((duration): duration is number => duration !== null && Number.isFinite(duration) && duration > 0);
  const sourceDurationCandidates =
    currentSourceDurationCandidates.length > 0
      ? currentSourceDurationCandidates
      : [
          baselineSegment ? getWorkspaceSegmentKnownVisualDurationSeconds(baselineSegment) : null,
        ].filter((duration): duration is number => duration !== null && Number.isFinite(duration) && duration > 0);
  const sourceDurationSeconds =
    sourceDurationCandidates.length > 0
      ? roundWorkspaceSegmentTimelineSeconds(Math.max(...sourceDurationCandidates))
      : fallbackDurationSeconds;

  if (
    directVideoSourceDurationSeconds === null &&
    slotDurationSeconds !== null &&
    slotDurationSeconds > sourceDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS
  ) {
    return roundWorkspaceSegmentTimelineSeconds(slotDurationSeconds);
  }

  return sourceDurationSeconds;
};

export const resolveWorkspaceSegmentAiDurationExtensionTargetSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment?: WorkspaceSegmentEditorDraftSegment | null,
  currentSlotDurationSeconds?: number | null,
  options?: {
    extensionStepSeconds?: number | null;
    sourceDurationSeconds?: number | null;
  },
) => {
  const sourceDurationSeconds = getWorkspaceSegmentDurationExtensionSourceDurationSeconds(segment, baselineSegment, {
    sourceDurationSeconds: options?.sourceDurationSeconds,
  });
  const currentSlotDuration =
    normalizeWorkspaceSegmentManualDurationSeconds(currentSlotDurationSeconds) ??
    getWorkspaceSegmentCanonicalSlotDurationSeconds(segment);
  const extensionStepSeconds =
    normalizeWorkspaceSegmentManualDurationSeconds(options?.extensionStepSeconds) ??
    WORKSPACE_SEGMENT_AI_EXTENSION_STEP_SECONDS;

  if (
    sourceDurationSeconds !== null &&
    currentSlotDuration !== null &&
    currentSlotDuration > sourceDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS
  ) {
    return clampWorkspaceSegmentEditorVisualDurationSeconds(currentSlotDuration);
  }

  const baseDurationSeconds = sourceDurationSeconds ?? currentSlotDuration;
  if (baseDurationSeconds === null) {
    return null;
  }

  return clampWorkspaceSegmentEditorVisualDurationSeconds(baseDurationSeconds + extensionStepSeconds);
};

export const resolveWorkspaceSegmentAiDurationExtensionEffectiveTargetSeconds = (
  _segment: WorkspaceSegmentEditorDraftSegment,
  _baselineSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  targetDurationSeconds: number | null | undefined,
  options?: {
    sourceDurationSeconds?: number | null;
    trimToVoiceover?: boolean;
    voiceoverDurationSeconds?: number | null;
  },
) => {
  const normalizedTargetDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(targetDurationSeconds);
  if (normalizedTargetDurationSeconds === null) {
    return null;
  }

  const voiceoverDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(options?.voiceoverDurationSeconds);
  if (!options?.trimToVoiceover || voiceoverDurationSeconds === null) {
    return clampWorkspaceSegmentEditorVisualDurationSeconds(normalizedTargetDurationSeconds);
  }

  return clampWorkspaceSegmentEditorVisualDurationSeconds(voiceoverDurationSeconds);
};

export const WORKSPACE_SEGMENT_AUTO_TRIM_TO_VOICEOVER_MAX_GAP_SECONDS = 1;

export const shouldAutoTrimWorkspaceSegmentVideoToVoiceover = (
  currentVideoDurationSeconds: number | null | undefined,
  voiceoverDurationSeconds: number | null | undefined,
) => {
  const normalizedVideoDurationSeconds =
    normalizeWorkspaceSegmentManualDurationSeconds(currentVideoDurationSeconds);
  const normalizedVoiceoverDurationSeconds =
    normalizeWorkspaceSegmentManualDurationSeconds(voiceoverDurationSeconds);
  if (normalizedVideoDurationSeconds === null || normalizedVoiceoverDurationSeconds === null) {
    return false;
  }

  const videoTailSeconds = normalizedVideoDurationSeconds - normalizedVoiceoverDurationSeconds;
  return (
    videoTailSeconds > WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS &&
    videoTailSeconds < WORKSPACE_SEGMENT_AUTO_TRIM_TO_VOICEOVER_MAX_GAP_SECONDS
  );
};

export const shouldShowWorkspaceSegmentAiDurationExtensionVoiceoverTrim = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  targetDurationSeconds: number | null | undefined,
  voiceoverDurationSeconds: number | null | undefined,
  options?: WorkspaceSegmentDurationExtensionSourceOptions,
) => {
  const normalizedTargetDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(targetDurationSeconds);
  const normalizedVoiceoverDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(voiceoverDurationSeconds);
  if (normalizedTargetDurationSeconds === null || normalizedVoiceoverDurationSeconds === null) {
    return false;
  }

  const sourceDurationSeconds = getWorkspaceSegmentDurationExtensionSourceDurationSeconds(segment, baselineSegment, options);
  if (sourceDurationSeconds === null) {
    return false;
  }

  return (
    Math.abs(normalizedVoiceoverDurationSeconds - sourceDurationSeconds) >
      WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS ||
    Math.abs(normalizedVoiceoverDurationSeconds - normalizedTargetDurationSeconds) >
      WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS
  );
};

export const resolveWorkspaceSegmentDurationExtensionSourceDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  nextSlotDurationSeconds: number,
  baselineSegment?: WorkspaceSegmentEditorDraftSegment | null,
  options?: WorkspaceSegmentDurationExtensionSourceOptions,
) => {
  const sourceDurationSeconds = getWorkspaceSegmentDurationExtensionSourceDurationSeconds(segment, baselineSegment, options);
  if (
    sourceDurationSeconds === null ||
    nextSlotDurationSeconds <= sourceDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS
  ) {
    return null;
  }

  return roundWorkspaceSegmentTimelineSeconds(sourceDurationSeconds);
};

export const syncWorkspaceSegmentEmbeddedVisualDuration = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentEditorDraftSegment => {
  if (!doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio(segment)) {
    return segment;
  }

  const manualDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
  const hasSavedProjectTalkingPhotoVoiceover = Boolean(
    manualDurationSeconds !== null &&
      segment.voiceoverTextHash &&
      normalizeWorkspaceSegmentEditorSetting(segment.voiceoverVoiceType),
  );
  if (
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" &&
    hasSavedProjectTalkingPhotoVoiceover
  ) {
    return segment;
  }

  const storedDurationExtensionSourceDurationSeconds =
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment);
  if (
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" &&
    manualDurationSeconds !== null &&
    storedDurationExtensionSourceDurationSeconds !== null &&
    storedDurationExtensionSourceDurationSeconds > manualDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS
  ) {
    return segment;
  }

  const visualDuration = getWorkspaceSegmentKnownVisualDurationSeconds(segment);
  if (visualDuration === null) {
    return segment;
  }

  if (
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" &&
    areWorkspaceSegmentDurationValuesEqual(
      manualDurationSeconds,
      visualDuration,
    )
  ) {
    return segment;
  }

  return {
    ...segment,
    durationMode: "manual",
    manualDurationSeconds: visualDuration,
  };
};

export const syncWorkspaceSegmentsEmbeddedVisualDurations = (
  segments: WorkspaceSegmentEditorDraftSegment[],
): WorkspaceSegmentEditorDraftSegment[] => {
  let hasChanges = false;
  const nextSegments = segments.map((segment) => {
    const nextSegment = syncWorkspaceSegmentEmbeddedVisualDuration(segment);
    if (nextSegment !== segment) {
      hasChanges = true;
    }
    return nextSegment;
  });

  return hasChanges ? nextSegments : segments;
};

export const isWorkspaceSegmentStaleMeasuredRenderedPhotoDuration = (
  draftSegment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment,
) => {
  const draftManualDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(
    draftSegment.manualDurationSeconds,
  );
  const baselineManualDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(
    baselineSegment.manualDurationSeconds,
  );
  const draftDurationSeconds =
    draftManualDurationSeconds ?? normalizeWorkspaceSegmentManualDurationSeconds(draftSegment.duration);
  const baselineDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(
    baselineManualDurationSeconds ?? baselineSegment.duration,
  );
  const draftVisualIdentity = getWorkspaceSegmentCurrentVisualIdentityKey(draftSegment);
  const baselineVisualIdentity = getWorkspaceSegmentCurrentVisualIdentityKey(baselineSegment);

  return Boolean(
    (isWorkspaceSegmentHoldableRenderedPhotoVisual(draftSegment) ||
      isWorkspaceSegmentHoldableRenderedPhotoVisual(baselineSegment)) &&
      draftSegment.durationSyncModeUserSelected !== true &&
      draftDurationSeconds !== null &&
      baselineDurationSeconds !== null &&
      Boolean(draftVisualIdentity) &&
      draftVisualIdentity === baselineVisualIdentity &&
      !areWorkspaceSegmentDurationValuesEqual(draftDurationSeconds, baselineDurationSeconds)
  );
};

export const restoreWorkspaceSegmentStaleMeasuredRenderedPhotoDuration = (
  draftSegment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentEditorDraftSegment =>
  isWorkspaceSegmentStaleMeasuredRenderedPhotoDuration(draftSegment, baselineSegment)
    ? restoreWorkspaceSegmentTimelineDurationState(
        {
          ...draftSegment,
          speechDuration: baselineSegment.speechDuration,
          speechDurationSource: baselineSegment.speechDurationSource ?? null,
          speechEndTime: baselineSegment.speechEndTime,
          speechStartTime: baselineSegment.speechStartTime,
          speechWords: baselineSegment.speechWords.map((word) => ({ ...word })),
          voiceSourceDuration: baselineSegment.voiceSourceDuration ?? null,
          voiceSourceEndTime: baselineSegment.voiceSourceEndTime ?? null,
          voiceSourceStartTime: baselineSegment.voiceSourceStartTime ?? null,
        },
        baselineSegment,
      )
    : draftSegment;

export const syncWorkspaceSegmentMeasuredVideoVisualDuration = (
  segment: WorkspaceSegmentEditorDraftSegment,
  durationSeconds: number | null | undefined,
  options?: {
    voiceoverDurationSeconds?: number | null;
  },
): WorkspaceSegmentEditorDraftSegment => {
  const measuredVisualDuration = normalizeWorkspaceSegmentManualDurationSeconds(durationSeconds);
  if (measuredVisualDuration === null || getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "video") {
    return segment;
  }

  // Persisted ffmpeg photo renders may contain transition handles beyond the
  // logical scene slot. The server timeline remains authoritative for them;
  // treating the encoded file length as a user duration changes both the UI
  // and the reset checklist immediately after opening an untouched project.
  if (isWorkspaceSegmentHoldableRenderedPhotoVisual(segment)) {
    return segment;
  }

  const storedDurationExtensionSourceDurationSeconds =
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment);
  const rawVoiceoverDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(options?.voiceoverDurationSeconds);
  const voiceoverDurationSeconds = resolveWorkspaceSegmentSceneVoiceoverTimelineDurationSeconds(
    segment,
    rawVoiceoverDurationSeconds,
    measuredVisualDuration,
  );
  const shouldRepairVoiceoverRenderTail =
    rawVoiceoverDurationSeconds !== null &&
    voiceoverDurationSeconds !== null &&
    rawVoiceoverDurationSeconds > voiceoverDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS;
  const shouldLoopMeasuredVideoToVoiceover =
    storedDurationExtensionSourceDurationSeconds === null &&
    voiceoverDurationSeconds !== null &&
    voiceoverDurationSeconds > measuredVisualDuration + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS;
  if (
    normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) === "voiceover" &&
    !shouldLoopMeasuredVideoToVoiceover &&
    !shouldRepairVoiceoverRenderTail
  ) {
    return segment;
  }

  const knownVisualDuration = getWorkspaceSegmentKnownVisualDurationSeconds(segment);
  if (
    knownVisualDuration !== null &&
    areWorkspaceSegmentDurationValuesEqual(knownVisualDuration, measuredVisualDuration) &&
    !shouldLoopMeasuredVideoToVoiceover &&
    !shouldRepairVoiceoverRenderTail
  ) {
    return segment;
  }

  const durationMode = normalizeWorkspaceSegmentDurationMode(segment.durationMode);
  const manualDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
  const hasManualTimelineOverride =
    durationMode === "manual" ||
    manualDurationSeconds !== null ||
    storedDurationExtensionSourceDurationSeconds !== null;
  if (hasManualTimelineOverride && !shouldLoopMeasuredVideoToVoiceover) {
    return segment;
  }

  const duration = roundWorkspaceSegmentTimelineSeconds(
    shouldLoopMeasuredVideoToVoiceover ? voiceoverDurationSeconds : measuredVisualDuration,
  );
  const startTime = getWorkspaceSegmentEditorDisplayStartTime(segment);
  return {
    ...segment,
    duration,
    durationMode: shouldLoopMeasuredVideoToVoiceover || shouldRepairVoiceoverRenderTail ? "auto" : "manual",
    durationSyncMode: shouldLoopMeasuredVideoToVoiceover || shouldRepairVoiceoverRenderTail ? "voiceover" : "visual",
    durationSyncModeUserSelected: false,
    endTime: roundWorkspaceSegmentTimelineSeconds(startTime + duration),
    manualDurationSeconds: shouldLoopMeasuredVideoToVoiceover || shouldRepairVoiceoverRenderTail ? null : duration,
    startTime,
  };
};

const syncWorkspaceSegmentGeneratedVideoDefaultVisualDuration = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentEditorDraftSegment => {
  const durationSyncMode = normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode);
  if (
    getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "video" ||
    durationSyncMode === "voiceover" ||
    !isWorkspaceSegmentGeneratedVideoVisual(segment)
  ) {
    return segment;
  }

  const currentSlotDurationSeconds = getWorkspaceSegmentCanonicalSlotDurationSeconds(segment);
  const knownSourceDurationSeconds =
    getWorkspaceSegmentKnownVisualDurationSeconds(segment) ??
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment);
  const sourceDurationSeconds = roundWorkspaceSegmentTimelineSeconds(
    Math.max(
      knownSourceDurationSeconds ?? 0,
      WORKSPACE_SEGMENT_AI_EXTENSION_STEP_SECONDS,
    ),
  );
  if (currentSlotDurationSeconds === null) {
    return segment;
  }

  const durationMode = normalizeWorkspaceSegmentDurationMode(segment.durationMode);
  const manualDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
  const storedDurationExtensionSourceDurationSeconds =
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment);
  const directMediaAssetDurationSeconds =
    getWorkspaceMediaAssetDurationSeconds(segment.currentAsset) ??
    getWorkspaceMediaAssetDurationSeconds(segment.originalAsset);
  const hasSourceTimelineVoiceMetadata = getWorkspaceSegmentVoiceSourceDurationSeconds(segment) !== null;
  const hasManualVisualSlot =
    durationMode === "manual" &&
    durationSyncMode === "visual" &&
    manualDurationSeconds !== null;
  if (
    hasWorkspaceSegmentPersistedMediaReference(segment) &&
    directMediaAssetDurationSeconds === null &&
    storedDurationExtensionSourceDurationSeconds === null &&
    (hasSourceTimelineVoiceMetadata ||
      (!hasManualVisualSlot &&
        currentSlotDurationSeconds + WORKSPACE_SEGMENT_PERSISTED_SLOT_DEFAULT_DURATION_TOLERANCE_SECONDS >=
          WORKSPACE_SEGMENT_AI_EXTENSION_STEP_SECONDS))
  ) {
    return segment;
  }

  if (
    durationMode === "manual" &&
    durationSyncMode === "visual" &&
    manualDurationSeconds !== null &&
    currentSlotDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS >= WORKSPACE_SEGMENT_AI_EXTENSION_STEP_SECONDS
  ) {
    return segment;
  }

  if (
    durationMode === "manual" &&
    manualDurationSeconds !== null &&
    storedDurationExtensionSourceDurationSeconds !== null &&
    storedDurationExtensionSourceDurationSeconds > manualDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS
  ) {
    return segment;
  }

  const duration = roundWorkspaceSegmentTimelineSeconds(Math.max(currentSlotDurationSeconds, sourceDurationSeconds));
  if (
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" &&
    durationSyncMode === "visual" &&
    areWorkspaceSegmentDurationValuesEqual(
      manualDurationSeconds,
      duration,
    )
  ) {
    return segment;
  }

  const startTime = getWorkspaceSegmentEditorDisplayStartTime(segment);
  return {
    ...segment,
    duration,
    durationMode: "manual",
    durationSyncMode: "visual",
    endTime: roundWorkspaceSegmentTimelineSeconds(startTime + duration),
    manualDurationSeconds: duration,
    startTime,
  };
};

const syncWorkspaceSegmentPendingVoiceoverEstimatedDuration = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId" | "voiceType"> | null,
): WorkspaceSegmentEditorDraftSegment => {
  const selectedVisualPreviewKind = getWorkspaceSegmentSelectedVisualPreviewKind(segment);
  const previewKind = getWorkspaceSegmentPreviewKind(segment);
  const isVideoVisualSegment =
    selectedVisualPreviewKind === "video" ||
    previewKind === "video" ||
    String(segment.mediaType ?? "").trim().toLowerCase() === "video";
  if (!isVideoVisualSegment) {
    return segment;
  }

  if (segment.voiceoverAsset || doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio(segment)) {
    return segment;
  }

  const durationSyncMode = normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode);
  const hasUserSelectedVisualDurationSync =
    durationSyncMode === "visual" && segment.durationSyncModeUserSelected === true;
  if (hasUserSelectedVisualDurationSync) {
    return segment;
  }

  const estimatedVoiceoverTextHash = getWorkspaceSegmentVoiceoverTextHash(segment.text);
  const storedEstimatedVoiceoverTextHash =
    typeof segment.estimatedVoiceoverTextHash === "string" ? segment.estimatedVoiceoverTextHash : null;
  const storedEstimatedVoiceoverDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(
    segment.estimatedVoiceoverDurationSeconds,
  );
  const hasStoredPendingVoiceoverEstimate =
    storedEstimatedVoiceoverDurationSeconds !== null &&
    storedEstimatedVoiceoverTextHash === estimatedVoiceoverTextHash;
  const hasCustomVideoVisual = Boolean(segment.customVideo) || getWorkspaceSegmentLatestVisualAction(segment) === "custom";
  if (
    !hasStoredPendingVoiceoverEstimate &&
    !hasCustomVideoVisual
  ) {
    return segment;
  }

  const voiceoverDurationInfo = getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session, {
    allowEmbeddedVisualFallback: false,
  });
  const estimatedVoiceoverDurationSeconds =
    voiceoverDurationInfo?.source === "estimated"
      ? normalizeWorkspaceSegmentManualDurationSeconds(voiceoverDurationInfo.durationSeconds)
      : null;
  if (estimatedVoiceoverDurationSeconds === null) {
    return segment;
  }

  const sourceDurationCandidates = [
    getWorkspaceSegmentKnownVisualDurationSeconds(segment),
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment),
    getWorkspaceSegmentCanonicalSlotDurationSeconds(segment),
    normalizeWorkspaceSegmentManualDurationSeconds(segment.duration),
  ].filter((value): value is number => value !== null);
  const sourceDurationSeconds =
    sourceDurationCandidates.length > 0
      ? roundWorkspaceSegmentTimelineSeconds(Math.max(...sourceDurationCandidates))
      : null;
  const duration = roundWorkspaceSegmentTimelineSeconds(estimatedVoiceoverDurationSeconds);
  const durationExtensionSourceDurationSeconds =
    sourceDurationSeconds !== null &&
    sourceDurationSeconds > duration + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS
      ? sourceDurationSeconds
      : null;
  const startTime = getWorkspaceSegmentEditorDisplayStartTime(segment);
  if (
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "auto" &&
    durationSyncMode === "voiceover" &&
    normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds) === null &&
    areWorkspaceSegmentDurationValuesEqual(
      normalizeWorkspaceSegmentManualDurationSeconds(segment.duration),
      duration,
    ) &&
    areWorkspaceSegmentDurationValuesEqual(
      getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment),
      durationExtensionSourceDurationSeconds,
    ) &&
    segment.estimatedVoiceoverTextHash === estimatedVoiceoverTextHash &&
    areWorkspaceSegmentDurationValuesEqual(
      normalizeWorkspaceSegmentManualDurationSeconds(segment.estimatedVoiceoverDurationSeconds),
      duration,
    )
  ) {
    return segment;
  }

  return {
    ...segment,
    duration,
    durationExtensionSourceDurationSeconds,
    durationMode: "auto",
    durationSyncMode: "voiceover",
    durationSyncModeUserSelected:
      durationSyncMode === "voiceover" && segment.durationSyncModeUserSelected === true,
    endTime: roundWorkspaceSegmentTimelineSeconds(startTime + duration),
    estimatedVoiceoverDurationSeconds: duration,
    estimatedVoiceoverTextHash,
    manualDurationSeconds: null,
    startTime,
  };
};

export const getWorkspaceSegmentManualDurationMinimum = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: (Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> &
    Partial<Pick<WorkspaceSegmentEditorDraftSession, "language" | "ttsAssetId">>) | null,
  options?: {
    voiceoverDurationSeconds?: number | null;
  },
) => {
  const hasExplicitVoiceoverDurationSeconds = Object.prototype.hasOwnProperty.call(
    options ?? {},
    "voiceoverDurationSeconds",
  );
  const explicitVoiceoverDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(
    options?.voiceoverDurationSeconds,
  );
  const shouldIgnoreStaleVoiceoverTiming = Boolean(
    !hasExplicitVoiceoverDurationSeconds &&
      isWorkspaceSegmentDraftTextEdited(segment) &&
      !isWorkspaceSegmentVoiceoverPlaybackFresh(segment, session),
  );
  const fallbackVoiceoverDurationSeconds = getWorkspaceSegmentEffectiveVoiceEnabled(segment, session)
    ? getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session, {
        allowEmbeddedVisualFallback: false,
        allowEstimated: shouldIgnoreStaleVoiceoverTiming,
        isStale: shouldIgnoreStaleVoiceoverTiming,
      })?.durationSeconds ?? null
    : null;
  const voiceoverDurationSeconds = hasExplicitVoiceoverDurationSeconds
    ? explicitVoiceoverDurationSeconds
    : fallbackVoiceoverDurationSeconds;
  const isImageVisualSegment = getWorkspaceSegmentSelectedVisualPreviewKind(segment) === "image";
  const shouldUseExactFreshSceneVoiceoverMinimum =
    isImageVisualSegment &&
    voiceoverDurationSeconds !== null &&
    isWorkspaceSegmentVoiceoverAssetFresh(segment, session);
  const visualMinimumDurationSeconds =
    isImageVisualSegment
      ? shouldUseExactFreshSceneVoiceoverMinimum
        ? roundWorkspaceSegmentTimelineSeconds(voiceoverDurationSeconds)
        : getWorkspaceSegmentPhotoDurationVoiceoverMinimumSeconds(voiceoverDurationSeconds)
      : voiceoverDurationSeconds;

  return Math.max(1, visualMinimumDurationSeconds ?? 1);
};

const getWorkspaceSegmentSceneDurationCandidates = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const rawSegmentStart = Number(segment.startTime);
  const rawSegmentEnd = Number(segment.endTime);
  const timelineDuration =
    Number.isFinite(rawSegmentStart) &&
    Number.isFinite(rawSegmentEnd) &&
    rawSegmentEnd > rawSegmentStart
      ? rawSegmentEnd - rawSegmentStart
      : null;

  return [
    timelineDuration,
    normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds),
    normalizeWorkspaceSegmentManualDurationSeconds(segment.duration),
  ].filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
};

const isWorkspaceSegmentSceneDurationSpeechEcho = (
  segment: WorkspaceSegmentEditorDraftSegment,
  speechDuration: number,
) => {
  if (segment.speechDurationSource === "audio") {
    return false;
  }

  const hasManualSceneDuration =
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" ||
    normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds) !== null;
  if (!hasManualSceneDuration || getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "image") {
    return false;
  }

  const segmentDurationCandidates = getWorkspaceSegmentSceneDurationCandidates(segment);
  if (
    segmentDurationCandidates.length === 0 ||
    !segmentDurationCandidates.some(
      (duration) => Math.abs(duration - speechDuration) <= WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS,
    )
  ) {
    return false;
  }

  const speechRange = getWorkspaceSegmentTimelineSpeechRange(segment);
  if (!speechRange) {
    return false;
  }

  const rawSegmentStart = Number(segment.startTime);
  const rawSegmentEnd = Number(segment.endTime);
  const segmentStart = Number.isFinite(rawSegmentStart) ? rawSegmentStart : null;
  const segmentEnd = Number.isFinite(rawSegmentEnd) ? rawSegmentEnd : null;
  const speechTimelineDuration = speechRange.endTime - speechRange.startTime;
  const speechRangeMatchesSegmentBounds =
    segmentStart !== null &&
    segmentEnd !== null &&
    Math.abs(speechRange.startTime - segmentStart) <= WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS &&
    Math.abs(speechRange.endTime - segmentEnd) <= WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS;
  const speechRangeMatchesSegmentDuration =
    segmentDurationCandidates.some(
      (duration) => Math.abs(duration - speechTimelineDuration) <= WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS,
    ) &&
    (segmentStart === null ||
      Math.abs(speechRange.startTime - segmentStart) <= WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS);

  return speechRangeMatchesSegmentBounds || speechRangeMatchesSegmentDuration;
};

const isWorkspaceSegmentVoiceoverDurationObviousVisualEcho = (
  segment: WorkspaceSegmentEditorDraftSegment,
  durationSeconds: number | null | undefined,
) => {
  const normalizedDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(durationSeconds);
  const normalizedText = normalizeWorkspaceSegmentEditorTextForCompare(segment.text);
  if (normalizedDurationSeconds === null || !normalizedText) {
    return false;
  }

  const estimatedSpeechDuration = estimateWorkspaceSegmentEditorSpeechDuration(normalizedText);
  if (
    normalizedDurationSeconds <= Math.max(estimatedSpeechDuration * 2.6, estimatedSpeechDuration + 4)
  ) {
    return false;
  }

  const assetDuration = getStudioCustomVideoFileDurationSeconds(segment.voiceoverAsset);
  const matchesAssetDuration =
    assetDuration !== null &&
    Math.abs(normalizedDurationSeconds - assetDuration) <= WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS;
  const matchesSceneDuration =
    getWorkspaceSegmentSelectedVisualPreviewKind(segment) === "image" &&
    getWorkspaceSegmentSceneDurationCandidates(segment).some(
      (duration) => Math.abs(duration - normalizedDurationSeconds) <= WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS,
    );

  return matchesAssetDuration || matchesSceneDuration;
};

const getWorkspaceSegmentEstimatedProjectVoiceoverLeakDuration = (
  segment: WorkspaceSegmentEditorDraftSegment,
  assetDurationSeconds: number | null,
) => {
  const normalizedText = normalizeWorkspaceSegmentEditorTextForCompare(segment.text);
  if (assetDurationSeconds === null || !normalizedText) {
    return null;
  }

  const estimatedSpeechDuration = estimateWorkspaceSegmentEditorSpeechDuration(normalizedText);
  const isAssetMuchLongerThanSpeech =
    assetDurationSeconds > Math.max(estimatedSpeechDuration * 2.6, estimatedSpeechDuration + 4);
  const isAssetLongerThanScene = getWorkspaceSegmentSceneDurationCandidates(segment).some(
    (durationSeconds) =>
      durationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS < assetDurationSeconds,
  );

  return isAssetMuchLongerThanSpeech && isAssetLongerThanScene
    ? roundWorkspaceSegmentTimelineSeconds(estimatedSpeechDuration)
    : null;
};

const resolveWorkspaceSegmentSceneVoiceoverTimelineDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  sourceDurationSeconds: number | null | undefined,
  measuredVisualDurationSeconds?: number | null,
) => {
  const normalizedSourceDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(sourceDurationSeconds);
  if (normalizedSourceDurationSeconds === null) {
    return null;
  }

  const slotDurationSeconds = getWorkspaceSegmentCanonicalSlotDurationSeconds(segment);
  const speechWordsRange = getWorkspaceSegmentSpeechWordsRange(segment);
  const speechWordsDurationSeconds =
    speechWordsRange !== null
      ? normalizeWorkspaceSegmentManualDurationSeconds(
          speechWordsRange.endTime - speechWordsRange.startTime,
        )
      : null;
  const explicitSpeechDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.speechDuration);
  const explicitSpeechDurationIsSourceEcho =
    explicitSpeechDurationSeconds !== null &&
    Math.abs(explicitSpeechDurationSeconds - normalizedSourceDurationSeconds) <=
      WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS;
  const preciseSpeechDurationCandidates = [
    speechWordsDurationSeconds,
    !explicitSpeechDurationIsSourceEcho &&
    (speechWordsDurationSeconds !== null || segment.speechDurationSource === "audio")
      ? explicitSpeechDurationSeconds
      : null,
  ].filter((value): value is number => value !== null);
  const preciseSpeechDurationSeconds = preciseSpeechDurationCandidates.length > 0
    ? Math.max(...preciseSpeechDurationCandidates)
    : null;
  const visualDurationSeconds = getWorkspaceSegmentKnownVisualDurationSeconds(segment);
  const coveredTimelineDurationCandidates = [
    slotDurationSeconds,
    visualDurationSeconds,
    normalizeWorkspaceSegmentManualDurationSeconds(measuredVisualDurationSeconds),
  ].filter(
    (durationSeconds): durationSeconds is number =>
      durationSeconds !== null &&
      preciseSpeechDurationSeconds !== null &&
      preciseSpeechDurationSeconds > 0 &&
      preciseSpeechDurationSeconds <= durationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS &&
      normalizedSourceDurationSeconds > durationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS,
  );

  // A durable per-scene voiceover file can contain a small render tail after
  // the last spoken word. That tail is required for clean audio playback, but
  // it must not make the logical scene longer or trigger a false video-shortfall
  // warning when the authoritative scene slot already contains all speech.
  if (coveredTimelineDurationCandidates.length > 0) {
    return roundWorkspaceSegmentTimelineSeconds(Math.min(...coveredTimelineDurationCandidates));
  }

  return roundWorkspaceSegmentTimelineSeconds(normalizedSourceDurationSeconds);
};

export const getWorkspaceSegmentExplicitVoiceoverDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "language" | "ttsAssetId" | "voiceType"> | null,
) => {
  const isProjectVoiceoverAsset = isWorkspaceSegmentProjectVoiceoverAsset(segment, session);
  const assetDuration = getStudioCustomVideoFileDurationSeconds(segment.voiceoverAsset);
  const playableAssetDuration = isProjectVoiceoverAsset ? null : assetDuration;
  const hasVoiceSourceRange = getWorkspaceSegmentVoiceSourceRange(segment) !== null;
  const freshIsolatedSceneVoiceoverAssetDuration =
    playableAssetDuration !== null &&
    !hasVoiceSourceRange &&
    isWorkspaceSegmentVoiceoverAssetFresh(segment, session)
      ? resolveWorkspaceSegmentSceneVoiceoverTimelineDurationSeconds(segment, playableAssetDuration)
      : null;
  const voiceSourceDuration = getWorkspaceSegmentVoiceSourceDurationSeconds(segment);
  if (
    voiceSourceDuration !== null &&
    !isWorkspaceSegmentProjectVoiceoverFullAssetDurationLeak(segment, session, voiceSourceDuration) &&
    !isWorkspaceSegmentVoiceoverDurationObviousVisualEcho(segment, voiceSourceDuration)
  ) {
    return isWorkspaceSegmentVoiceoverAssetFresh(segment, session)
      ? resolveWorkspaceSegmentSceneVoiceoverTimelineDurationSeconds(segment, voiceSourceDuration)
      : roundWorkspaceSegmentTimelineSeconds(voiceSourceDuration);
  }

  const speechWordsRange = getWorkspaceSegmentSpeechWordsRange(segment);
  const speechWordsDuration =
    speechWordsRange !== null ? Math.max(0, speechWordsRange.endTime - speechWordsRange.startTime) : null;
  const hasStaleSpeechBoundary = hasWorkspaceSegmentStaleSpeechBoundary(segment);
  const explicitSpeechDuration =
    !hasStaleSpeechBoundary &&
    typeof segment.speechDuration === "number" &&
    Number.isFinite(segment.speechDuration) &&
    segment.speechDuration > 0 &&
    !isWorkspaceSegmentVoiceoverDurationObviousVisualEcho(segment, segment.speechDuration)
      ? segment.speechDuration
      : null;
  const speechDurationCandidates = [speechWordsDuration, explicitSpeechDuration].filter(
    (value): value is number => value !== null,
  );
  const speechDuration =
    speechDurationCandidates.length > 0
      ? normalizeWorkspaceSegmentManualDurationSeconds(Math.max(...speechDurationCandidates))
      : null;
  if (speechDuration !== null) {
    if (freshIsolatedSceneVoiceoverAssetDuration !== null) {
      return roundWorkspaceSegmentTimelineSeconds(freshIsolatedSceneVoiceoverAssetDuration);
    }

    const sceneDurationCandidates = getWorkspaceSegmentSceneDurationCandidates(segment);
    const isProjectAssetDurationLeakingIntoScene =
      isProjectVoiceoverAsset &&
      assetDuration !== null &&
      Math.abs(speechDuration - assetDuration) <= WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS &&
      sceneDurationCandidates.some((duration) => duration + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS < assetDuration);
    if (isProjectAssetDurationLeakingIntoScene) {
      return null;
    }

    if (isWorkspaceSegmentSceneDurationSpeechEcho(segment, speechDuration)) {
      return playableAssetDuration;
    }

    return roundWorkspaceSegmentTimelineSeconds(speechDuration);
  }

  if (isProjectVoiceoverAsset) {
    return null;
  }

  if (freshIsolatedSceneVoiceoverAssetDuration !== null) {
    return roundWorkspaceSegmentTimelineSeconds(freshIsolatedSceneVoiceoverAssetDuration);
  }

  if (isWorkspaceSegmentVoiceoverDurationObviousVisualEcho(segment, playableAssetDuration)) {
    return getWorkspaceSegmentEstimatedVoiceoverDurationSeconds(segment) ?? null;
  }

  return isWorkspaceSegmentVoiceoverAssetFresh(segment, session)
    ? resolveWorkspaceSegmentSceneVoiceoverTimelineDurationSeconds(segment, playableAssetDuration)
    : playableAssetDuration;
};

export const isWorkspaceSegmentProjectVoiceoverFullAssetDurationLeak = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session:
    | (Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId"> &
        Partial<Pick<WorkspaceSegmentEditorDraftSession, "segments">>)
    | null
    | undefined,
  durationSeconds: number | null | undefined,
) => {
  const normalizedDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(durationSeconds);
  const assetDuration = getStudioCustomVideoFileDurationSeconds(segment.voiceoverAsset);
  const isKnownProjectOrSharedVoiceoverAsset =
    isWorkspaceSegmentProjectVoiceoverAsset(segment, session) ||
    isWorkspaceSegmentSharedVoiceoverAsset(segment, session);
  return Boolean(
    normalizedDurationSeconds !== null &&
      isKnownProjectOrSharedVoiceoverAsset &&
      assetDuration !== null &&
      Math.abs(normalizedDurationSeconds - assetDuration) <= WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS &&
      getWorkspaceSegmentSceneDurationCandidates(segment).some(
        (duration) => duration + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS < assetDuration,
      ),
  );
};

export const getWorkspaceSegmentSpeechTimelineDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
) => {
  const speechRange = getWorkspaceSegmentTimelineSpeechRange(segment);
  const speechStartTime = speechRange?.startTime ?? null;
  const speechEndTime = speechRange?.endTime ?? null;
  if (speechStartTime === null || speechEndTime === null || speechEndTime <= speechStartTime) {
    return null;
  }

  const segmentStartTime = normalizeWorkspaceSegmentVoicePreviewTime(segment.startTime);
  const segmentEndTime = normalizeWorkspaceSegmentVoicePreviewTime(segment.endTime);
  const speechTimelineDuration = speechEndTime - speechStartTime;
  if (segment.speechDurationSource === "audio") {
    return roundWorkspaceSegmentTimelineSeconds(speechTimelineDuration);
  }

  const rawSegmentDuration = Number(segment.duration ?? segment.manualDurationSeconds);
  const segmentDuration =
    Number.isFinite(rawSegmentDuration) && rawSegmentDuration > 0
      ? rawSegmentDuration
      : segmentStartTime !== null && segmentEndTime !== null && segmentEndTime > segmentStartTime
        ? segmentEndTime - segmentStartTime
        : null;
  const speechMatchesSegmentRange =
    (segmentStartTime !== null &&
      segmentEndTime !== null &&
      Math.abs(speechStartTime - segmentStartTime) < 0.04 &&
      Math.abs(speechEndTime - segmentEndTime) < 0.04) ||
    (segmentDuration !== null &&
      Math.abs(speechTimelineDuration - segmentDuration) < 0.04 &&
      (segmentStartTime === null || Math.abs(speechStartTime - segmentStartTime) < 0.04));
  if (speechMatchesSegmentRange) {
    return null;
  }

  return roundWorkspaceSegmentTimelineSeconds(speechTimelineDuration);
};

export const getWorkspaceSegmentVoiceoverDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: (Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> &
    Partial<Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId">>) | null,
) => {
  if (!getWorkspaceSegmentEffectiveVoiceEnabled(segment, session)) {
    return null;
  }

  const explicitDurationSeconds = getWorkspaceSegmentExplicitVoiceoverDurationSeconds(segment, session);
  if (explicitDurationSeconds !== null) {
    return explicitDurationSeconds;
  }

  const speechTimelineDurationSeconds = getWorkspaceSegmentSpeechTimelineDurationSeconds(segment);
  return isWorkspaceSegmentProjectVoiceoverFullAssetDurationLeak(segment, session, speechTimelineDurationSeconds) ||
    isWorkspaceSegmentVoiceoverDurationObviousVisualEcho(segment, speechTimelineDurationSeconds)
    ? null
    : speechTimelineDurationSeconds;
};

export const getWorkspaceSegmentEmbeddedTalkingPhotoAudioDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  options?: {
    allowVisualFallback?: boolean;
  },
) => {
  if (!doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio(segment)) {
    return null;
  }

  const knownVisualDurationSeconds = getWorkspaceSegmentKnownVisualDurationSeconds(segment) ?? null;
  const isVisualDurationEcho = (durationSeconds: number | null | undefined) =>
    knownVisualDurationSeconds !== null &&
    typeof durationSeconds === "number" &&
    areWorkspaceSegmentDurationValuesEqual(durationSeconds, knownVisualDurationSeconds);

  const voiceSourceDurationSeconds = getWorkspaceSegmentVoiceSourceDurationSeconds(segment);
  const voiceSourceRange = getWorkspaceSegmentVoiceSourceRange(segment);
  if (
    voiceSourceDurationSeconds !== null &&
    (voiceSourceRange !== null || !isVisualDurationEcho(voiceSourceDurationSeconds))
  ) {
    return roundWorkspaceSegmentTimelineSeconds(voiceSourceDurationSeconds);
  }

  const speechWordsRange = getWorkspaceSegmentSpeechWordsRange(segment);
  const speechWordsDurationSeconds =
    speechWordsRange !== null ? Math.max(0, speechWordsRange.endTime - speechWordsRange.startTime) : null;
  if (speechWordsDurationSeconds !== null && speechWordsDurationSeconds > 0) {
    return roundWorkspaceSegmentTimelineSeconds(speechWordsDurationSeconds);
  }

  const speechDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.speechDuration);
  if (speechDurationSeconds !== null && !isVisualDurationEcho(speechDurationSeconds)) {
    return roundWorkspaceSegmentTimelineSeconds(speechDurationSeconds);
  }

  return options?.allowVisualFallback === false ? null : knownVisualDurationSeconds;
};

export const shouldIgnoreWorkspaceSegmentMeasuredVoiceoverDuration = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session:
    | (Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> & Partial<Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId">>)
    | null
    | undefined,
  sourceUrl: string | null | undefined,
  measuredDurationSeconds: number | null | undefined,
) => {
  const normalizedMeasuredDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(measuredDurationSeconds);
  if (normalizedMeasuredDurationSeconds === null) {
    return false;
  }

  const resolvedSceneTimelineDurationSeconds = isWorkspaceSegmentVoiceoverAssetFresh(segment, session)
    ? resolveWorkspaceSegmentSceneVoiceoverTimelineDurationSeconds(segment, normalizedMeasuredDurationSeconds)
    : null;
  if (
    resolvedSceneTimelineDurationSeconds !== null &&
    resolvedSceneTimelineDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS <
      normalizedMeasuredDurationSeconds
  ) {
    return true;
  }

  const knownVoiceoverDurationSeconds = getWorkspaceSegmentVoiceoverDurationSeconds(segment, session);
  if (
    knownVoiceoverDurationSeconds === null ||
    knownVoiceoverDurationSeconds + 0.75 >= normalizedMeasuredDurationSeconds
  ) {
    return false;
  }

  const normalizedSourceUrl = String(sourceUrl ?? "").trim();
  if (!normalizedSourceUrl) {
    return false;
  }

  try {
    return /^\/api\/workspace\/media-assets\/\d+$/i.test(new URL(normalizedSourceUrl, "http://localhost").pathname);
  } catch {
    return /^\/api\/workspace\/media-assets\/\d+(?:[?#]|$)/i.test(normalizedSourceUrl);
  }
};

export const getWorkspaceSegmentEstimatedVoiceoverDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> | null,
) => {
  if (!doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio(segment) && !getWorkspaceSegmentEffectiveVoiceEnabled(segment, session)) {
    return null;
  }

  if (!normalizeWorkspaceSegmentEditorTextForCompare(segment.text)) {
    return null;
  }

  const estimatedVoiceoverTextHash =
    typeof segment.estimatedVoiceoverTextHash === "string" ? segment.estimatedVoiceoverTextHash : null;
  const storedEstimatedDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(
    segment.estimatedVoiceoverDurationSeconds,
  );
  if (
    storedEstimatedDurationSeconds !== null &&
    estimatedVoiceoverTextHash === getWorkspaceSegmentVoiceoverTextHash(segment.text)
  ) {
    return roundWorkspaceSegmentTimelineSeconds(storedEstimatedDurationSeconds);
  }

  return estimateWorkspaceSegmentEditorSpeechDuration(segment.text);
};

export const getWorkspaceSegmentEstimatedVoiceoverLabelDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> | null,
) => getWorkspaceSegmentEstimatedVoiceoverDurationSeconds(segment, session);

export const getWorkspaceSegmentTimelineVoiceoverDurationInfo = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: (Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> &
    Partial<Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId">>) | null,
  options?: {
    allowEmbeddedVisualFallback?: boolean;
    allowEstimated?: boolean;
    isStale?: boolean;
  },
) => {
  const embeddedVoiceoverDurationSeconds = getWorkspaceSegmentEmbeddedTalkingPhotoAudioDurationSeconds(segment, {
    allowVisualFallback: options?.allowEmbeddedVisualFallback,
  });
  const knownDurationSeconds = options?.isStale
    ? null
    : normalizeWorkspaceSegmentManualDurationSeconds(
        embeddedVoiceoverDurationSeconds ?? getWorkspaceSegmentVoiceoverDurationSeconds(segment, session),
      );
  if (knownDurationSeconds !== null) {
    return {
      durationSeconds: roundWorkspaceSegmentTimelineSeconds(knownDurationSeconds),
      source: "actual" as const,
    };
  }

  if (options?.allowEstimated === false) {
    return null;
  }

  const estimatedDurationSeconds = getWorkspaceSegmentEstimatedVoiceoverDurationSeconds(segment, session);
  if (estimatedDurationSeconds === null) {
    return null;
  }

  return {
    durationSeconds: estimatedDurationSeconds,
    source: "estimated" as const,
  };
};

export const getWorkspaceSegmentTimelineVoiceoverDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: (Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> &
    Partial<Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId">>) | null,
) => getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session)?.durationSeconds ?? null;

const getWorkspaceSegmentVoiceoverEstimateWordCount = (value: string | null | undefined) =>
  splitWorkspaceSegmentBulkSubtitleWords(normalizeWorkspaceSegmentBulkSubtitleText(value)).length;

const getWorkspaceSegmentPendingVoiceoverDurationEstimateSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session:
    | (Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> & Partial<Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId">>)
    | null
    | undefined,
  options?: {
    previousText?: string | null;
    previousVoiceoverDurationSeconds?: number | null;
  },
) => {
  const baseEstimatedDurationSeconds = getWorkspaceSegmentEstimatedVoiceoverDurationSeconds(segment, session);
  if (baseEstimatedDurationSeconds === null) {
    return null;
  }

  const previousText = normalizeWorkspaceSegmentBulkSubtitleText(options?.previousText);
  const currentWordCount = getWorkspaceSegmentVoiceoverEstimateWordCount(segment.text);
  const previousWordCount = getWorkspaceSegmentVoiceoverEstimateWordCount(previousText);
  const previousDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(
    options?.previousVoiceoverDurationSeconds,
  );
  if (
    !previousText ||
    currentWordCount <= 0 ||
    previousWordCount < WORKSPACE_SEGMENT_PENDING_VOICEOVER_ESTIMATE_MIN_REFERENCE_WORDS ||
    previousDurationSeconds === null
  ) {
    return baseEstimatedDurationSeconds;
  }

  const previousBaseEstimatedDurationSeconds = estimateWorkspaceSegmentEditorSpeechDuration(
    previousText,
    previousWordCount,
  );
  const maxPlausibleReferenceDurationSeconds = Math.max(
    previousBaseEstimatedDurationSeconds * WORKSPACE_SEGMENT_PENDING_VOICEOVER_ESTIMATE_MAX_REFERENCE_RATIO,
    previousBaseEstimatedDurationSeconds + WORKSPACE_SEGMENT_PENDING_VOICEOVER_ESTIMATE_MAX_REFERENCE_EXTRA_SECONDS,
  );
  if (previousDurationSeconds > maxPlausibleReferenceDurationSeconds) {
    return baseEstimatedDurationSeconds;
  }

  const clampedSecondsPerWord = Math.min(
    WORKSPACE_SEGMENT_PENDING_VOICEOVER_ESTIMATE_MAX_WORD_SECONDS,
    Math.max(
      WORKSPACE_SEGMENT_PENDING_VOICEOVER_ESTIMATE_MIN_WORD_SECONDS,
      previousDurationSeconds / previousWordCount,
    ),
  );
  const scaledEstimatedDurationSeconds = roundWorkspaceSegmentTimelineSeconds(currentWordCount * clampedSecondsPerWord);
  return roundWorkspaceSegmentTimelineSeconds(
    Math.max(baseEstimatedDurationSeconds, scaledEstimatedDurationSeconds),
  );
};

export const getWorkspaceSegmentVisualAudioDurationMismatchInfo = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> | null,
  options?: {
    allowEstimatedVoiceover?: boolean;
    baselineSegment?: WorkspaceSegmentEditorDraftSegment | null;
    fallbackVisualDurationSeconds?: number | null;
    includeAnyVideoVisual?: boolean;
    isVoiceoverStale?: boolean;
    visualDurationSeconds?: number | null;
  },
) => {
  if (getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "video") {
    return null;
  }

  if (doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio(segment)) {
    return null;
  }

  if (isWorkspaceSegmentHoldableRenderedPhotoVisual(segment)) {
    return null;
  }

  if (!options?.includeAnyVideoVisual && !isWorkspaceSegmentGeneratedVideoVisual(segment)) {
    return null;
  }

  const visualDurationSeconds =
    normalizeWorkspaceSegmentManualDurationSeconds(options?.visualDurationSeconds) ??
    getWorkspaceSegmentVideoVisualDurationSeconds(segment, {
      baselineSegment: options?.baselineSegment,
      session,
    }) ??
    normalizeWorkspaceSegmentManualDurationSeconds(options?.fallbackVisualDurationSeconds);
  const voiceoverDurationInfo = getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session, {
    allowEstimated: options?.allowEstimatedVoiceover,
    isStale: options?.isVoiceoverStale,
  });
  if (visualDurationSeconds === null || !voiceoverDurationInfo) {
    return null;
  }

  const warningVoiceoverDurationSeconds = voiceoverDurationInfo.durationSeconds;

  if (warningVoiceoverDurationSeconds <= visualDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS) {
    return null;
  }

  return {
    visualDurationSeconds: roundWorkspaceSegmentTimelineSeconds(visualDurationSeconds),
    voiceoverDurationSeconds: roundWorkspaceSegmentTimelineSeconds(warningVoiceoverDurationSeconds),
    voiceoverDurationSource: voiceoverDurationInfo.source,
  };
};

export const resolveWorkspaceSegmentTimelineVisualAudioMismatchInfo = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "language" | "voiceType"> | null,
  options?: {
    baselineSegment?: WorkspaceSegmentEditorDraftSegment | null;
    includeAnyVideoVisual?: boolean;
    isGlobalVoiceEdited?: boolean;
    isVoiceSpanEdited?: boolean;
    visualDurationSeconds?: number | null;
  },
) => {
  const isVoiceAudioStale =
    !isWorkspaceSegmentVoiceoverAssetFresh(segment, session) &&
    (Boolean(options?.isGlobalVoiceEdited) ||
      Boolean(options?.isVoiceSpanEdited) ||
      isWorkspaceSegmentDraftTextEdited(segment));

  return getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, session, {
    allowEstimatedVoiceover: true,
    baselineSegment: options?.baselineSegment,
    includeAnyVideoVisual: options?.includeAnyVideoVisual,
    isVoiceoverStale: isVoiceAudioStale,
    visualDurationSeconds: options?.visualDurationSeconds,
  });
};

export const getWorkspaceSegmentVideoVisualDurationSourceSeconds = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "video") {
    return null;
  }

  return (
    getStudioCustomVideoFileDurationSeconds(getWorkspaceSegmentDraftVisualAsset(segment)) ??
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment) ??
    getWorkspaceSegmentCanonicalSlotDurationSeconds(segment) ??
    normalizeWorkspaceSegmentManualDurationSeconds(segment.duration)
  );
};

export const clearWorkspaceSegmentVoiceoverTiming = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentEditorDraftSegment => {
  const videoVisualDurationSourceSeconds = getWorkspaceSegmentVideoVisualDurationSourceSeconds(segment);

  return {
    ...segment,
    durationExtensionSourceDurationSeconds:
      getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment) ?? videoVisualDurationSourceSeconds,
    estimatedVoiceoverDurationSeconds: null,
    estimatedVoiceoverTextHash: null,
    speechDuration: null,
    speechDurationSource: null,
    speechEndTime: null,
    speechStartTime: null,
    speechWords: [],
    voiceSourceDuration: null,
    voiceSourceEndTime: null,
    voiceSourceStartTime: null,
    voice_source_duration: null,
    voice_source_end_time: null,
    voice_source_start_time: null,
    _voice_source_duration: null,
    _voice_source_end_time: null,
    _voice_source_start_time: null,
    _voice_render_source_end_time: null,
    _voice_render_source_start_time: null,
  };
};

export const clearWorkspaceSegmentEditorVoiceoverGenerationState = (
  segment: WorkspaceSegmentEditorDraftSegment,
  options?: {
    preserveUserSelectedVisualDuration?: boolean;
    previousText?: string | null;
    previousVoiceoverDurationSeconds?: number | null;
    resetTimelineToEstimatedVoiceover?: boolean;
    session?: Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId" | "voiceType"> | null;
  },
): WorkspaceSegmentEditorDraftSegment => {
  const currentEstimatedVoiceoverTextHash =
    typeof segment.estimatedVoiceoverTextHash === "string" ? segment.estimatedVoiceoverTextHash : null;
  const storedEstimatedVoiceoverDurationSeconds =
    currentEstimatedVoiceoverTextHash === getWorkspaceSegmentVoiceoverTextHash(segment.text)
      ? normalizeWorkspaceSegmentManualDurationSeconds(segment.estimatedVoiceoverDurationSeconds)
      : null;
  const previousVoiceoverDurationSeconds =
    normalizeWorkspaceSegmentManualDurationSeconds(options?.previousVoiceoverDurationSeconds) ??
    getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, options?.session, { allowEstimated: false })?.durationSeconds ??
    storedEstimatedVoiceoverDurationSeconds ??
    null;
  const clearedSegment = {
    ...clearWorkspaceSegmentVoiceoverTiming(segment),
    voiceoverAsset: null,
    voiceoverLanguage: null,
    voiceoverTextHash: null,
    voiceoverVoiceType: null,
  };

  const estimatedVoiceoverDurationSeconds = options?.resetTimelineToEstimatedVoiceover
    ? getWorkspaceSegmentPendingVoiceoverDurationEstimateSeconds(clearedSegment, options.session, {
        previousText: options.previousText,
        previousVoiceoverDurationSeconds,
      })
    : null;
  const shouldPreserveUserSelectedVisualDuration =
    options?.preserveUserSelectedVisualDuration !== false &&
    normalizeWorkspaceSegmentDurationSyncMode(clearedSegment.durationSyncMode) === "visual" &&
    clearedSegment.durationSyncModeUserSelected === true &&
    normalizeWorkspaceSegmentManualDurationSeconds(clearedSegment.manualDurationSeconds) !== null;
  if (estimatedVoiceoverDurationSeconds === null || shouldPreserveUserSelectedVisualDuration) {
    return clearedSegment;
  }

  const startTime = getWorkspaceSegmentEditorDisplayStartTime(clearedSegment);
  const roundedEstimatedVoiceoverDurationSeconds = roundWorkspaceSegmentTimelineSeconds(estimatedVoiceoverDurationSeconds);
  const knownVideoVisualDurationSeconds =
    getWorkspaceSegmentSelectedVisualPreviewKind(clearedSegment) === "video"
      ? getWorkspaceSegmentKnownVisualDurationSeconds(clearedSegment)
      : null;
  const estimatedVoiceoverVideoSourceDurationSeconds =
    knownVideoVisualDurationSeconds !== null &&
    knownVideoVisualDurationSeconds > roundedEstimatedVoiceoverDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS
      ? roundWorkspaceSegmentTimelineSeconds(knownVideoVisualDurationSeconds)
      : null;
  return {
    ...clearedSegment,
    duration: roundedEstimatedVoiceoverDurationSeconds,
    durationExtensionSourceDurationSeconds: estimatedVoiceoverVideoSourceDurationSeconds,
    estimatedVoiceoverDurationSeconds: roundedEstimatedVoiceoverDurationSeconds,
    estimatedVoiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(clearedSegment.text),
    durationMode: "auto",
    durationSyncMode: "voiceover",
    durationSyncModeUserSelected:
      normalizeWorkspaceSegmentDurationSyncMode(clearedSegment.durationSyncMode) === "voiceover" &&
      clearedSegment.durationSyncModeUserSelected === true,
    endTime: roundWorkspaceSegmentTimelineSeconds(startTime + roundedEstimatedVoiceoverDurationSeconds),
    manualDurationSeconds: null,
    startTime,
  };
};

export const applyWorkspaceSegmentEditorGlobalVoiceToSegments = (
  draft: WorkspaceSegmentEditorDraftSession,
  voiceType: string,
): WorkspaceSegmentEditorDraftSession => {
  const isVoiceDisabled = normalizeWorkspaceSegmentEditorSetting(voiceType) === "none";

  return {
    ...draft,
    subtitleType: isVoiceDisabled ? "none" : draft.subtitleType,
    ttsAssetId: null,
    voiceType,
    segments: draft.segments.map((segment) => {
      if (doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio(segment)) {
        return segment;
      }

      if (getWorkspaceSegmentVoiceOverrideId(segment)) {
        return clearWorkspaceSegmentEditorVoiceoverGenerationState({
          ...segment,
          subtitleType: isVoiceDisabled ? "none" : segment.subtitleType,
          voiceLanguage: null,
          voice_language: null,
          voiceType: null,
        }, {
          resetTimelineToEstimatedVoiceover: true,
          session: draft,
        });
      }

      if (isVoiceDisabled) {
        return clearWorkspaceSegmentEditorVoiceoverGenerationState({
          ...segment,
          subtitleType: "none",
          voiceLanguage: null,
          voice_language: null,
        }, {
          resetTimelineToEstimatedVoiceover: true,
          session: draft,
        });
      }

      return clearWorkspaceSegmentEditorVoiceoverGenerationState({
        ...segment,
        voiceLanguage: null,
        voice_language: null,
      }, {
        resetTimelineToEstimatedVoiceover: true,
        session: draft,
      });
    }),
  };
};

export const applyWorkspaceSegmentEditorSceneVoiceOverride = (
  draft: WorkspaceSegmentEditorDraftSession,
  segmentIndex: number,
  voiceType: string | null,
  options?: { subtitleType?: string | null },
): WorkspaceSegmentEditorDraftSession => ({
  ...draft,
  segments: draft.segments.map((segment) =>
    segment.index === segmentIndex
      ? doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio(segment)
        ? segment
        : clearWorkspaceSegmentEditorVoiceoverGenerationState({
            ...segment,
            ...(options && "subtitleType" in options ? { subtitleType: options.subtitleType ?? null } : {}),
            voiceType,
          }, {
            resetTimelineToEstimatedVoiceover: true,
            session: draft,
          })
      : segment,
  ),
});

export const normalizeWorkspaceSegmentVoicePreviewTime = (value: unknown) => {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

type WorkspaceSegmentVoiceSourceTimingFields = Pick<
  WorkspaceSegmentEditorSegment,
  | "voiceSourceDuration"
  | "voiceSourceEndTime"
  | "voiceSourceStartTime"
  | "voice_source_duration"
  | "voice_source_end_time"
  | "voice_source_start_time"
  | "_voice_source_duration"
  | "_voice_source_end_time"
  | "_voice_source_start_time"
>;

const normalizeWorkspaceSegmentVoiceSourceDurationSeconds = (value: unknown) => {
  const normalized = normalizeWorkspaceSegmentVoicePreviewTime(value);
  return normalized !== null && normalized > 0 ? roundWorkspaceSegmentTimelineSeconds(normalized) : null;
};

export const getWorkspaceSegmentVoiceSourceStartTime = (
  segment: WorkspaceSegmentVoiceSourceTimingFields,
) =>
  normalizeWorkspaceSegmentVoicePreviewTime(
    segment.voiceSourceStartTime ?? segment.voice_source_start_time ?? segment._voice_source_start_time,
  );

export const getWorkspaceSegmentVoiceSourceEndTime = (
  segment: WorkspaceSegmentVoiceSourceTimingFields,
) =>
  normalizeWorkspaceSegmentVoicePreviewTime(
    segment.voiceSourceEndTime ?? segment.voice_source_end_time ?? segment._voice_source_end_time,
  );

export const getWorkspaceSegmentVoiceSourceDurationSeconds = (
  segment: WorkspaceSegmentVoiceSourceTimingFields,
) => {
  const startTime = getWorkspaceSegmentVoiceSourceStartTime(segment);
  const endTime = getWorkspaceSegmentVoiceSourceEndTime(segment);
  if (startTime !== null && endTime !== null && endTime > startTime) {
    return roundWorkspaceSegmentTimelineSeconds(endTime - startTime);
  }

  const explicitDuration = normalizeWorkspaceSegmentVoiceSourceDurationSeconds(
    segment.voiceSourceDuration ?? segment.voice_source_duration ?? segment._voice_source_duration,
  );
  if (explicitDuration !== null) {
    return explicitDuration;
  }

  return null;
};

export const getWorkspaceSegmentVoiceSourceRange = (
  segment: WorkspaceSegmentVoiceSourceTimingFields,
) => {
  const startTime = getWorkspaceSegmentVoiceSourceStartTime(segment);
  const endTime = getWorkspaceSegmentVoiceSourceEndTime(segment);
  if (startTime !== null && endTime !== null && endTime > startTime) {
    return {
      endTime: roundWorkspaceSegmentTimelineSeconds(endTime),
      startTime: roundWorkspaceSegmentTimelineSeconds(startTime),
    };
  }

  const durationSeconds = getWorkspaceSegmentVoiceSourceDurationSeconds(segment);
  if (startTime !== null && durationSeconds !== null) {
    return {
      endTime: roundWorkspaceSegmentTimelineSeconds(startTime + durationSeconds),
      startTime: roundWorkspaceSegmentTimelineSeconds(startTime),
    };
  }

  return null;
};

export const getWorkspaceSegmentSpeechWordsRange = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const speechWords = Array.isArray(segment.speechWords) ? segment.speechWords : [];
  const firstSpeechWord = speechWords[0] ?? null;
  const lastSpeechWord = speechWords[speechWords.length - 1] ?? null;
  const startTime = normalizeWorkspaceSegmentVoicePreviewTime(firstSpeechWord?.startTime);
  const endTime = normalizeWorkspaceSegmentVoicePreviewTime(lastSpeechWord?.endTime);
  if (startTime === null || endTime === null || endTime <= startTime) {
    return null;
  }

  return { endTime, startTime };
};

const tokenizeWorkspaceSegmentSpeechBoundaryText = (value: unknown) =>
  normalizeWorkspaceSegmentEditorTextForCompare(String(value ?? ""))
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/gu)
    .filter(Boolean);

const getWorkspaceSegmentSpeechWordTokenItems = (
  speechWords: WorkspaceSegmentEditorSpeechWord[],
) =>
  speechWords.flatMap((word, wordIndex) =>
    tokenizeWorkspaceSegmentSpeechBoundaryText(word.text).map((token) => ({
      token,
      wordIndex,
    })),
  );

const areWorkspaceSegmentSpeechBoundaryTokensEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((token, index) => token === right[index]);

const isWorkspaceSegmentSpeechBoundaryTokenPrefix = (prefix: string[], tokens: string[]) =>
  prefix.length <= tokens.length && prefix.every((token, index) => token === tokens[index]);

const cloneWorkspaceSegmentEditorSpeechWord = (
  word: WorkspaceSegmentEditorSpeechWord,
): WorkspaceSegmentEditorSpeechWord => ({ ...word });

const cloneWorkspaceSegmentForSpeechBoundaryRepair = <T extends WorkspaceSegmentEditorSegment>(
  segment: T,
): T => ({
  ...segment,
  speechWords: segment.speechWords.map(cloneWorkspaceSegmentEditorSpeechWord),
});

const applyWorkspaceSegmentSpeechWordsRange = <T extends WorkspaceSegmentEditorSegment>(segment: T) => {
  const speechWords = Array.isArray(segment.speechWords) ? segment.speechWords : [];
  const firstSpeechWord = speechWords[0] ?? null;
  const lastSpeechWord = speechWords[speechWords.length - 1] ?? null;
  const startTime = normalizeWorkspaceSegmentVoicePreviewTime(firstSpeechWord?.startTime);
  const endTime = normalizeWorkspaceSegmentVoicePreviewTime(lastSpeechWord?.endTime);
  if (startTime === null || endTime === null || endTime <= startTime) {
    return;
  }

  const speechStartTime = roundWorkspaceSegmentTimelineSeconds(startTime);
  const speechEndTime = roundWorkspaceSegmentTimelineSeconds(endTime);
  const speechDuration = roundWorkspaceSegmentTimelineSeconds(Math.max(0, speechEndTime - speechStartTime));
  segment.speechDuration = speechDuration;
  segment.speechDurationSource = null;
  segment.speechEndTime = speechEndTime;
  segment.speechStartTime = speechStartTime;
  segment.voiceSourceDuration = speechDuration;
  segment.voiceSourceEndTime = speechEndTime;
  segment.voiceSourceStartTime = speechStartTime;
};

const canRepairWorkspaceSegmentSharedProjectVoiceoverBoundary = (
  current: WorkspaceSegmentEditorSegment,
  next: WorkspaceSegmentEditorSegment,
) =>
  getPositiveWorkspaceMediaAssetId(current.voiceoverAssetId ?? current.voiceover?.media_asset_id ?? current.voiceover_asset_id) === null &&
  getPositiveWorkspaceMediaAssetId(next.voiceoverAssetId ?? next.voiceover?.media_asset_id ?? next.voiceover_asset_id) === null;

export const repairWorkspaceSegmentEditorSpeechWordBoundaries = <T extends WorkspaceSegmentEditorSegment>(
  segments: T[],
): T[] => {
  const repairedSegments = segments.map(cloneWorkspaceSegmentForSpeechBoundaryRepair);
  let didRepair = false;

  for (let index = 0; index < repairedSegments.length - 1; index += 1) {
    const current = repairedSegments[index];
    const next = repairedSegments[index + 1];
    if (!current || !next || !canRepairWorkspaceSegmentSharedProjectVoiceoverBoundary(current, next)) {
      continue;
    }

    const currentTextTokens = tokenizeWorkspaceSegmentSpeechBoundaryText(current.text);
    const nextTextTokens = tokenizeWorkspaceSegmentSpeechBoundaryText(next.text);
    if (currentTextTokens.length === 0 || nextTextTokens.length === 0) {
      continue;
    }

    const currentSpeechTokenItems = getWorkspaceSegmentSpeechWordTokenItems(current.speechWords);
    const nextSpeechTokenItems = getWorkspaceSegmentSpeechWordTokenItems(next.speechWords);
    const currentSpeechTokens = currentSpeechTokenItems.map((item) => item.token);
    const nextSpeechTokens = nextSpeechTokenItems.map((item) => item.token);
    if (
      currentSpeechTokens.length === 0 ||
      currentSpeechTokens.length >= currentTextTokens.length ||
      !isWorkspaceSegmentSpeechBoundaryTokenPrefix(currentSpeechTokens, currentTextTokens)
    ) {
      continue;
    }

    const missingCurrentTextTokens = currentTextTokens.slice(currentSpeechTokens.length);
    if (
      missingCurrentTextTokens.length === 0 ||
      !isWorkspaceSegmentSpeechBoundaryTokenPrefix(missingCurrentTextTokens, nextSpeechTokens) ||
      !areWorkspaceSegmentSpeechBoundaryTokensEqual(
        nextSpeechTokens.slice(missingCurrentTextTokens.length),
        nextTextTokens,
      )
    ) {
      continue;
    }

    const lastMovedToken = nextSpeechTokenItems[missingCurrentTextTokens.length - 1] ?? null;
    if (!lastMovedToken || nextSpeechTokenItems[missingCurrentTextTokens.length]?.wordIndex === lastMovedToken.wordIndex) {
      continue;
    }

    const moveWordCount = lastMovedToken.wordIndex + 1;
    const movedWords = next.speechWords.slice(0, moveWordCount).map(cloneWorkspaceSegmentEditorSpeechWord);
    const remainingNextWords = next.speechWords.slice(moveWordCount).map(cloneWorkspaceSegmentEditorSpeechWord);
    if (movedWords.length === 0 || remainingNextWords.length === 0) {
      continue;
    }

    current.speechWords = [
      ...current.speechWords.map(cloneWorkspaceSegmentEditorSpeechWord),
      ...movedWords,
    ];
    next.speechWords = remainingNextWords;
    applyWorkspaceSegmentSpeechWordsRange(current);
    applyWorkspaceSegmentSpeechWordsRange(next);

    const currentSpeechEndTime = normalizeWorkspaceSegmentVoicePreviewTime(current.speechEndTime);
    const nextSpeechStartTime = normalizeWorkspaceSegmentVoicePreviewTime(next.speechStartTime);
    if (currentSpeechEndTime !== null && nextSpeechStartTime !== null) {
      const boundary = roundWorkspaceSegmentTimelineSeconds(
        Math.max(current.endTime, next.startTime, currentSpeechEndTime, nextSpeechStartTime),
      );
      current.endTime = boundary;
      current.duration = roundWorkspaceSegmentTimelineSeconds(Math.max(0, current.endTime - current.startTime));
      next.startTime = boundary;
      next.duration = roundWorkspaceSegmentTimelineSeconds(Math.max(0, next.endTime - next.startTime));
    }

    didRepair = true;
  }

  return didRepair ? repairedSegments : segments;
};

const hasWorkspaceSegmentTrustedSpeechWordTiming = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const speechWords = Array.isArray(segment.speechWords) ? segment.speechWords : [];
  return speechWords.some((word) => Number.isFinite(Number(word.confidence)) && Number(word.confidence) > 0);
};

export const hasWorkspaceSegmentStaleSpeechBoundary = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const speechWordsRange = getWorkspaceSegmentSpeechWordsRange(segment);
  const speechStartTime = normalizeWorkspaceSegmentVoicePreviewTime(segment.speechStartTime);
  return (
    speechWordsRange !== null &&
    speechStartTime !== null &&
    Math.abs(speechStartTime - speechWordsRange.startTime) > 0.35
  );
};

export const hasWorkspaceSegmentProjectVoiceoverTimingData = (
  segment: Pick<
    WorkspaceSegmentEditorSegment,
    | "speechDuration"
    | "speechEndTime"
    | "speechStartTime"
    | "speechWords"
    | "voiceSourceDuration"
    | "voiceSourceEndTime"
    | "voiceSourceStartTime"
    | "voice_source_duration"
    | "voice_source_end_time"
    | "voice_source_start_time"
    | "_voice_source_duration"
    | "_voice_source_end_time"
    | "_voice_source_start_time"
  >,
) => {
  if (getWorkspaceSegmentVoiceSourceRange(segment) !== null) {
    return true;
  }

  const speechWords = Array.isArray(segment.speechWords) ? segment.speechWords : [];
  const firstSpeechWord = speechWords[0] ?? null;
  const lastSpeechWord = speechWords[speechWords.length - 1] ?? null;
  const speechWordsStartTime = normalizeWorkspaceSegmentVoicePreviewTime(firstSpeechWord?.startTime);
  const speechWordsEndTime = normalizeWorkspaceSegmentVoicePreviewTime(lastSpeechWord?.endTime);
  if (
    speechWordsStartTime !== null &&
    speechWordsEndTime !== null &&
    speechWordsEndTime > speechWordsStartTime
  ) {
    return true;
  }

  const speechStartTime = normalizeWorkspaceSegmentVoicePreviewTime(segment.speechStartTime);
  const speechEndTime = normalizeWorkspaceSegmentVoicePreviewTime(segment.speechEndTime);
  if (speechStartTime !== null && speechEndTime !== null && speechEndTime > speechStartTime) {
    return true;
  }

  const speechDuration = normalizeWorkspaceSegmentManualDurationSeconds(segment.speechDuration);
  return speechStartTime !== null && speechDuration !== null && speechDuration > 0;
};

export const getWorkspaceSegmentVoiceoverPreviewRange = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: (Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> &
    Partial<Pick<WorkspaceSegmentEditorDraftSession, "segments" | "ttsAssetId">>) | null,
) => {
  if (!getWorkspaceSegmentEffectiveVoiceEnabled(segment, session)) {
    return null;
  }

  const voiceSourceRange = getWorkspaceSegmentVoiceSourceRange(segment);
  const voiceSourceRangeDuration =
    voiceSourceRange !== null && voiceSourceRange.endTime > voiceSourceRange.startTime
      ? voiceSourceRange.endTime - voiceSourceRange.startTime
      : null;
  if (
    voiceSourceRange !== null &&
    !isWorkspaceSegmentProjectVoiceoverFullAssetDurationLeak(segment, session, voiceSourceRangeDuration)
  ) {
    return voiceSourceRange;
  }

  const rawSpeechRange = getWorkspaceSegmentTimelineSpeechRange(segment);
  const rawSpeechRangeDuration =
    rawSpeechRange !== null && rawSpeechRange.endTime > rawSpeechRange.startTime
      ? rawSpeechRange.endTime - rawSpeechRange.startTime
      : null;
  const shouldIgnoreRawSpeechRange = isWorkspaceSegmentProjectVoiceoverFullAssetDurationLeak(
    segment,
    session,
    rawSpeechRangeDuration,
  );
  const speechRange = shouldIgnoreRawSpeechRange ? null : rawSpeechRange;
  const hasStaleSpeechBoundary = hasWorkspaceSegmentStaleSpeechBoundary(segment);
  const speechStartTime =
    speechRange?.startTime ??
    (shouldIgnoreRawSpeechRange ? null : normalizeWorkspaceSegmentVoicePreviewTime(segment.speechStartTime)) ??
    normalizeWorkspaceSegmentVoicePreviewTime(segment.startTime) ??
    0;
  const rawSpeechDuration = Number(segment.speechDuration);
  const speechDuration =
    !hasStaleSpeechBoundary &&
    Number.isFinite(rawSpeechDuration) &&
    rawSpeechDuration > 0 &&
    !isWorkspaceSegmentProjectVoiceoverFullAssetDurationLeak(segment, session, rawSpeechDuration)
      ? rawSpeechDuration
      : getWorkspaceSegmentVoiceoverDurationSeconds(segment, session);
  const explicitSpeechEndTime =
    speechDuration !== null && Number.isFinite(speechDuration)
      ? speechStartTime + speechDuration
      : null;
  const speechWords = Array.isArray(segment.speechWords) ? segment.speechWords : [];
  const hasSyntheticSpeechWordTiming =
    speechWords.length > 0 && !hasWorkspaceSegmentTrustedSpeechWordTiming(segment);
  const timelineEndTime = normalizeWorkspaceSegmentVoicePreviewTime(segment.endTime);
  const timelineDuration =
    timelineEndTime !== null && timelineEndTime > speechStartTime
      ? timelineEndTime - speechStartTime
      : null;
  const syntheticTimelineEndTime =
    hasSyntheticSpeechWordTiming &&
    timelineEndTime !== null &&
    timelineDuration !== null &&
    !isWorkspaceSegmentProjectVoiceoverFullAssetDurationLeak(segment, session, timelineDuration)
      ? timelineEndTime
      : null;
  const estimatedSyntheticSpeechEndTime =
    hasSyntheticSpeechWordTiming && normalizeWorkspaceSegmentEditorTextForCompare(segment.text)
      ? speechStartTime + estimateWorkspaceSegmentEditorSpeechDuration(segment.text)
      : null;
  const speechEndTimeCandidates = [
    speechRange?.endTime,
    hasStaleSpeechBoundary || shouldIgnoreRawSpeechRange ? null : normalizeWorkspaceSegmentVoicePreviewTime(segment.speechEndTime),
    explicitSpeechEndTime,
    syntheticTimelineEndTime,
    estimatedSyntheticSpeechEndTime,
  ].filter((value): value is number => value !== null && typeof value !== "undefined");
  const speechEndTime =
    speechEndTimeCandidates.length > 0
      ? Math.max(...speechEndTimeCandidates)
      : normalizeWorkspaceSegmentVoicePreviewTime(segment.endTime);

  if (speechEndTime === null || speechEndTime <= speechStartTime) {
    return null;
  }

  const startTime = roundWorkspaceSegmentTimelineSeconds(
    Math.max(0, speechStartTime - WORKSPACE_SEGMENT_VOICE_PREVIEW_LEAD_SECONDS),
  );
  const endTime = roundWorkspaceSegmentTimelineSeconds(
    Math.max(
      startTime + WORKSPACE_SEGMENT_VOICE_PREVIEW_MIN_DURATION_SECONDS,
      speechEndTime + WORKSPACE_SEGMENT_VOICE_PREVIEW_TAIL_SECONDS,
    ),
  );

  return {
    endTime,
    startTime,
  };
};

export const getWorkspaceSegmentTimelineVoiceoverPreviewRange = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> | null,
) => {
  if (!getWorkspaceSegmentEffectiveVoiceEnabled(segment, session)) {
    return null;
  }

  const startTime = normalizeWorkspaceSegmentVoicePreviewTime(segment.startTime) ?? 0;
  const endTime = normalizeWorkspaceSegmentVoicePreviewTime(segment.endTime);
  if (endTime === null || endTime <= startTime) {
    return null;
  }

  return {
    endTime: roundWorkspaceSegmentTimelineSeconds(endTime),
    startTime: roundWorkspaceSegmentTimelineSeconds(startTime),
  };
};

export const resolveWorkspaceSegmentProjectVoiceoverFullPreviewAudioRange = ({
  previewRange,
  segment,
  timelineEndTime,
  timelineStartTime,
}: {
  previewRange?: { endTime: number; startTime: number } | null;
  segment: Pick<
    WorkspaceSegmentEditorDraftSegment,
    | "speechDuration"
    | "speechEndTime"
    | "speechStartTime"
    | "speechWords"
    | "voiceSourceDuration"
    | "voiceSourceEndTime"
    | "voiceSourceStartTime"
    | "voice_source_duration"
    | "voice_source_end_time"
    | "voice_source_start_time"
    | "_voice_source_duration"
    | "_voice_source_end_time"
    | "_voice_source_start_time"
  >;
  timelineEndTime: number;
  timelineStartTime: number;
}) => {
  const normalizedTimelineStartTime = normalizeWorkspaceSegmentVoicePreviewTime(timelineStartTime) ?? 0;
  const normalizedTimelineEndTime = Math.max(
    normalizedTimelineStartTime,
    normalizeWorkspaceSegmentVoicePreviewTime(timelineEndTime) ?? normalizedTimelineStartTime,
  );
  const previewStartTime = normalizeWorkspaceSegmentVoicePreviewTime(previewRange?.startTime);
  const previewEndTime = normalizeWorkspaceSegmentVoicePreviewTime(previewRange?.endTime);
  const voiceSourceRange = getWorkspaceSegmentVoiceSourceRange(segment);
  const speechRange = getWorkspaceSegmentTimelineSpeechRange(segment);
  const speechStartTime = normalizeWorkspaceSegmentVoicePreviewTime(speechRange?.startTime);
  const speechEndTime = normalizeWorkspaceSegmentVoicePreviewTime(speechRange?.endTime);
  const sourceBoundaryStartTime = voiceSourceRange?.startTime ?? speechStartTime ?? previewStartTime ?? null;
  const sourceBoundaryEndTime = voiceSourceRange?.endTime ?? speechEndTime ?? previewEndTime;
  const hasShiftedSourceTimeline =
    sourceBoundaryStartTime !== null &&
    Math.abs(sourceBoundaryStartTime - normalizedTimelineStartTime) >
      WORKSPACE_SEGMENT_PROJECT_VOICE_SOURCE_TIMELINE_DRIFT_SECONDS;
  const sourceStartTime =
    voiceSourceRange?.startTime ??
    (hasShiftedSourceTimeline ? sourceBoundaryStartTime : normalizedTimelineStartTime);
  const sourcePreviewDuration =
    (voiceSourceRange !== null || hasShiftedSourceTimeline) &&
    sourceBoundaryEndTime !== null &&
    sourceBoundaryEndTime > sourceStartTime
      ? sourceBoundaryEndTime - sourceStartTime
      : null;
  const timelineEndTimeFromShiftedSource =
    sourcePreviewDuration !== null ? normalizedTimelineStartTime + sourcePreviewDuration : null;
  const resolvedTimelineEndTime = voiceSourceRange !== null || hasShiftedSourceTimeline
    ? timelineEndTimeFromShiftedSource ?? normalizedTimelineEndTime
    : sourceBoundaryEndTime ?? normalizedTimelineEndTime;

  return {
    sourceStartTime: roundWorkspaceSegmentTimelineSeconds(sourceStartTime),
    timelineEndTime: roundWorkspaceSegmentTimelineSeconds(
      Math.max(normalizedTimelineStartTime, resolvedTimelineEndTime),
    ),
  };
};

export const shouldUseWorkspaceSegmentProjectVoiceoverSegmentProxyInFullPreview = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> | null,
  options?: {
    hasPriorNonProjectVoiceover?: boolean;
    hasProjectVoiceoverAsset?: boolean;
    previewRange?: { endTime: number; startTime: number } | null;
    timelineEndTime?: number | null;
    timelineStartTime?: number | null;
  },
) => {
  const segmentVoiceOverrideId = getWorkspaceSegmentVoiceOverrideId(segment);
  const timelineStartTime = normalizeWorkspaceSegmentVoicePreviewTime(options?.timelineStartTime);
  const timelineEndTime = normalizeWorkspaceSegmentVoicePreviewTime(options?.timelineEndTime);
  const previewStartTime = normalizeWorkspaceSegmentVoicePreviewTime(options?.previewRange?.startTime);
  const previewEndTime = normalizeWorkspaceSegmentVoicePreviewTime(options?.previewRange?.endTime);
  const timelineDuration =
    timelineStartTime !== null && timelineEndTime !== null && timelineEndTime > timelineStartTime
      ? timelineEndTime - timelineStartTime
      : null;
  const previewDuration =
    previewStartTime !== null && previewEndTime !== null && previewEndTime > previewStartTime
      ? previewEndTime - previewStartTime
      : null;
  const hasShiftedProjectSourceStart =
    timelineStartTime !== null &&
    previewStartTime !== null &&
    Math.abs(timelineStartTime - previewStartTime) > WORKSPACE_SEGMENT_PROJECT_VOICE_SOURCE_TIMELINE_DRIFT_SECONDS;
  const hasManualVoicePause =
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" &&
    timelineDuration !== null &&
    previewDuration !== null &&
    timelineDuration >
      previewDuration + WORKSPACE_SEGMENT_PROJECT_VOICE_SOURCE_TIMELINE_DRIFT_SECONDS;

  if (Boolean(options?.hasPriorNonProjectVoiceover) || hasShiftedProjectSourceStart || hasManualVoicePause) {
    return true;
  }

  if (!segmentVoiceOverrideId || segmentVoiceOverrideId === "none") {
    return false;
  }

  const sessionVoiceId = normalizeWorkspaceSegmentEditorSetting(session?.voiceType);
  return segmentVoiceOverrideId !== sessionVoiceId;
};

export const isWorkspaceSegmentProjectVoiceoverTimingFresh = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "language" | "ttsAssetId" | "voiceType"> | null,
) => {
  const voiceoverAssetId = getWorkspaceSegmentCustomAssetId(segment.voiceoverAsset);
  const ttsAssetId = getPositiveWorkspaceMediaAssetId(session?.ttsAssetId);
  const hasSceneVoiceoverAsset = voiceoverAssetId !== null && (ttsAssetId === null || voiceoverAssetId !== ttsAssetId);
  if (
    hasSceneVoiceoverAsset ||
    !ttsAssetId ||
    !hasWorkspaceSegmentProjectVoiceoverTimingData(segment)
  ) {
    return false;
  }

  const previewRange = getWorkspaceSegmentVoiceoverPreviewRange(segment, session);
  if (!previewRange) {
    return false;
  }

  const sessionLanguage = normalizeStudioLanguageValue(session?.language);
  const voiceoverLanguage = normalizeStudioLanguageValue(segment.voiceoverLanguage);
  const language = getWorkspaceSegmentVoiceLanguage(segment, sessionLanguage);
  const voiceOverrideId = getWorkspaceSegmentVoiceOverrideId(segment);
  if (voiceOverrideId === "none") {
    return false;
  }
  const sessionVoiceType = normalizeWorkspaceSegmentEditorSetting(session?.voiceType);
  const voiceoverVoiceType = normalizeWorkspaceSegmentEditorSetting(segment.voiceoverVoiceType);
  const voiceType = voiceOverrideId ?? (sessionVoiceType !== "none" ? sessionVoiceType : null) ?? voiceoverVoiceType;
  if (!voiceType) {
    return false;
  }

  return (
    segment.voiceoverTextHash === getWorkspaceSegmentVoiceoverTextHash(segment.text) &&
    normalizeWorkspaceSegmentEditorSetting(segment.voiceoverVoiceType) === normalizeWorkspaceSegmentEditorSetting(voiceType) &&
    (voiceoverLanguage ?? language) === language
  );
};

export const isWorkspaceSegmentVoiceoverPlaybackFresh = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "language" | "ttsAssetId" | "voiceType"> | null,
) =>
  isWorkspaceSegmentVoiceoverAssetFresh(segment, session) ||
  isWorkspaceSegmentProjectVoiceoverTimingFresh(segment, session);

export const applyWorkspaceSegmentEditorSceneVoiceSelection = (
  draft: WorkspaceSegmentEditorDraftSession,
  segmentIndex: number,
  selectedVoiceType: string,
  baselineSession?: WorkspaceSegmentEditorDraftSession | null,
  options?: { language?: StudioLanguage | null },
): WorkspaceSegmentEditorDraftSession => {
  const selectedVoiceId = normalizeWorkspaceSegmentEditorSetting(selectedVoiceType);
  if (!selectedVoiceId || selectedVoiceId === "none") {
    return applyWorkspaceSegmentEditorSceneVoiceOverride(draft, segmentIndex, selectedVoiceId ?? null);
  }

  const segment = draft.segments.find((candidate) => candidate.index === segmentIndex) ?? null;
  if (!segment || doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio(segment)) {
    return draft;
  }

  const draftLanguage = getWorkspaceSegmentEditorSessionLanguage(draft);
  const selectedLanguage = normalizeStudioLanguageValue(options?.language) ??
    getWorkspaceSegmentVoiceLanguage(segment, draftLanguage);
  const currentLanguage = getWorkspaceSegmentVoiceLanguage(segment, draftLanguage);
  const languageChanged = currentLanguage !== selectedLanguage;

  const currentVoiceId = normalizeWorkspaceSegmentEditorSetting(
    getWorkspaceSegmentEffectiveVoiceId(segment, draft),
  );
  if (
    currentVoiceId === selectedVoiceId &&
    !languageChanged &&
    isWorkspaceSegmentVoiceoverPlaybackFresh(segment, draft)
  ) {
    return draft;
  }

  const compatibleBaselineSession = baselineSession?.projectId === draft.projectId ? baselineSession : null;
  const baselineSegment =
    compatibleBaselineSession?.segments.find((candidate) => candidate.index === segmentIndex) ?? null;
  const baselineVoiceId = baselineSegment && compatibleBaselineSession
    ? normalizeWorkspaceSegmentEditorSetting(
        getWorkspaceSegmentEffectiveVoiceId(baselineSegment, compatibleBaselineSession),
      )
    : undefined;
  const hasUnchangedBaselineText = Boolean(
    baselineSegment &&
      normalizeWorkspaceSegmentEditorTextForCompare(segment.text) ===
        normalizeWorkspaceSegmentEditorTextForCompare(baselineSegment.text),
  );
  const hasCompatibleBaselineLanguage = Boolean(
    compatibleBaselineSession &&
      selectedLanguage ===
        getWorkspaceSegmentVoiceLanguage(
          baselineSegment,
          getWorkspaceSegmentEditorSessionLanguage(compatibleBaselineSession),
        ),
  );

  if (
    baselineSegment &&
    compatibleBaselineSession &&
    baselineVoiceId === selectedVoiceId &&
    hasUnchangedBaselineText &&
    hasCompatibleBaselineLanguage
  ) {
    return {
      ...draft,
      segments: draft.segments.map((candidate) =>
        candidate.index === segmentIndex
          ? {
              ...restoreWorkspaceSegmentEffectiveVoiceFromBaseline(candidate, baselineSegment, {
                baselineSession: compatibleBaselineSession,
                draftSession: draft,
              }),
              estimatedVoiceoverDurationSeconds: baselineSegment.estimatedVoiceoverDurationSeconds ?? null,
              estimatedVoiceoverTextHash: baselineSegment.estimatedVoiceoverTextHash ?? null,
            }
          : candidate,
      ),
    };
  }

  if (currentVoiceId === selectedVoiceId && !languageChanged) {
    return draft;
  }

  const projectVoiceId = normalizeWorkspaceSegmentEditorSetting(draft.voiceType);
  const nextDraft = applyWorkspaceSegmentEditorSceneVoiceOverride(
    draft,
    segmentIndex,
    projectVoiceId === selectedVoiceId ? null : selectedVoiceId,
  );
  return {
    ...nextDraft,
    segments: nextDraft.segments.map((candidate) =>
      candidate.index === segmentIndex
        ? {
            ...candidate,
            voiceLanguage: selectedLanguage,
            voice_language: selectedLanguage,
          }
        : candidate,
    ),
  };
};

const WORKSPACE_SEGMENT_PROJECT_TTS_RESTORE_RANGE_EPSILON_SECONDS = 0.35;

const areWorkspaceSegmentVoiceoverRangesEquivalent = (
  first: { endTime: number; startTime: number } | null,
  second: { endTime: number; startTime: number } | null,
) =>
  first !== null &&
  second !== null &&
  Math.abs(first.startTime - second.startTime) <= WORKSPACE_SEGMENT_PROJECT_TTS_RESTORE_RANGE_EPSILON_SECONDS &&
  Math.abs(first.endTime - second.endTime) <= WORKSPACE_SEGMENT_PROJECT_TTS_RESTORE_RANGE_EPSILON_SECONDS;

const getWorkspaceSegmentProjectVoiceoverRestoreRange = (segment: WorkspaceSegmentEditorDraftSegment) =>
  getWorkspaceSegmentVoiceSourceRange(segment) ?? getWorkspaceSegmentTimelineSpeechRange(segment);

const hasSafeWorkspaceSegmentProjectTtsRestoreRange = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment | null,
) => {
  if (getWorkspaceSegmentVoiceSourceRange(segment) !== null) {
    return true;
  }

  if (!baselineSegment) {
    return false;
  }

  return areWorkspaceSegmentVoiceoverRangesEquivalent(
    getWorkspaceSegmentProjectVoiceoverRestoreRange(segment),
    getWorkspaceSegmentProjectVoiceoverRestoreRange(baselineSegment),
  );
};

export const resolveWorkspaceSegmentEditorReusableProjectTtsAssetId = (
  draft: WorkspaceSegmentEditorDraftSession,
  fallbackSession?:
    | (Pick<WorkspaceSegmentEditorDraftSession, "language" | "ttsAssetId" | "voiceType"> &
        Partial<Pick<WorkspaceSegmentEditorDraftSession, "segments">>)
    | null,
) => {
  const draftTtsAssetId = getPositiveWorkspaceMediaAssetId(draft.ttsAssetId);
  if (draftTtsAssetId !== null) {
    return draftTtsAssetId;
  }

  const fallbackTtsAssetId = getPositiveWorkspaceMediaAssetId(fallbackSession?.ttsAssetId);
  if (fallbackTtsAssetId === null) {
    return null;
  }

  const draftVoiceType = normalizeWorkspaceSegmentEditorSetting(draft.voiceType);
  const fallbackVoiceType = normalizeWorkspaceSegmentEditorSetting(fallbackSession?.voiceType);
  if (
    draftVoiceType &&
    draftVoiceType !== "none" &&
    fallbackVoiceType &&
    fallbackVoiceType !== "none" &&
    draftVoiceType !== fallbackVoiceType
  ) {
    return null;
  }

  const draftLanguage = normalizeStudioLanguageValue(draft.language);
  const fallbackLanguage = normalizeStudioLanguageValue(fallbackSession?.language);
  if (draftLanguage && fallbackLanguage && draftLanguage !== fallbackLanguage) {
    return null;
  }

  const candidateSession: Pick<WorkspaceSegmentEditorDraftSession, "language" | "ttsAssetId" | "voiceType"> = {
    language: draftLanguage ?? fallbackLanguage ?? draft.language,
    ttsAssetId: fallbackTtsAssetId,
    voiceType: draftVoiceType ?? fallbackVoiceType ?? draft.voiceType,
  };
  const fallbackSegmentsByIndex = new Map(
    (fallbackSession?.segments ?? []).map((segment) => [segment.index, segment] as const),
  );
  const reusableProjectTtsSegments = draft.segments.filter((segment) =>
    isWorkspaceSegmentProjectVoiceoverTimingFresh(segment, candidateSession),
  );

  if (reusableProjectTtsSegments.length === 0) {
    return null;
  }

  return reusableProjectTtsSegments.every((segment) =>
    hasSafeWorkspaceSegmentProjectTtsRestoreRange(
      segment,
      fallbackSegmentsByIndex.get(segment.index) ?? null,
    ),
  )
    ? fallbackTtsAssetId
    : null;
};

export const restoreWorkspaceSegmentEditorDraftProjectTtsAsset = (
  draft: WorkspaceSegmentEditorDraftSession,
  fallbackSession?:
    | (Pick<WorkspaceSegmentEditorDraftSession, "language" | "ttsAssetId" | "voiceType"> &
        Partial<Pick<WorkspaceSegmentEditorDraftSession, "segments">>)
    | null,
): WorkspaceSegmentEditorDraftSession => {
  const reusableProjectTtsAssetId = resolveWorkspaceSegmentEditorReusableProjectTtsAssetId(draft, fallbackSession);
  if (reusableProjectTtsAssetId === null || reusableProjectTtsAssetId === getPositiveWorkspaceMediaAssetId(draft.ttsAssetId)) {
    return draft;
  }

  return {
    ...draft,
    ttsAssetId: reusableProjectTtsAssetId,
  };
};

const isWorkspaceSegmentFreshSceneVoiceoverAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "language" | "ttsAssetId" | "voiceType"> | null,
) =>
  Boolean(segment.voiceoverAsset) &&
  isWorkspaceSegmentVoiceoverAssetFresh(segment, session) &&
  !isWorkspaceSegmentProjectVoiceoverAsset(segment, session);

const isWorkspaceSegmentPersistedSceneVoiceoverAsset = (
  asset: StudioCustomVideoFile | null | undefined,
) => {
  if (!asset || getWorkspaceSegmentCustomAssetId(asset) === null) {
    return false;
  }

  const source = String(asset.source ?? "").trim().toLowerCase();
  const remoteUrl = String(asset.remoteUrl ?? "").trim().toLowerCase();
  return (
    source === "media-library" ||
    source === "library" ||
    remoteUrl.includes("/api/media/") ||
    remoteUrl.includes("/api/workspace/media-assets/")
  );
};

export const getWorkspaceSegmentSceneSoundDurationSeconds = (segment: WorkspaceSegmentEditorDraftSegment) =>
  getStudioCustomVideoFileDurationSeconds(segment.sceneSoundAsset);

export const getWorkspaceSegmentSceneSoundRefreshPrompt = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) => {
  if (!segment?.sceneSoundAsset) {
    return "";
  }

  return (
    normalizeWorkspaceSegmentSceneSoundPrompt(segment.sceneSoundGeneratedFromPrompt) ||
    (segment.sceneSoundPromptInitialized ? normalizeWorkspaceSegmentSceneSoundPrompt(segment.sceneSoundPrompt) : "")
  );
};

export const getWorkspaceSegmentRecommendedDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> | null,
) => {
  const candidates = [
    getWorkspaceSegmentKnownVisualDurationSeconds(segment),
    getWorkspaceSegmentCanonicalSlotDurationSeconds(segment),
    getWorkspaceSegmentVoiceoverDurationSeconds(segment, session),
  ].filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);

  return candidates.length > 0 ? roundWorkspaceSegmentTimelineSeconds(Math.max(...candidates)) : null;
};

export const getWorkspaceSegmentFreshVoiceoverDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "language" | "ttsAssetId" | "voiceType"> | null,
) => {
  const sceneVoiceoverAssetDurationSeconds = isWorkspaceSegmentFreshSceneVoiceoverAsset(segment, session)
    ? resolveWorkspaceSegmentSceneVoiceoverTimelineDurationSeconds(
        segment,
        getStudioCustomVideoFileDurationSeconds(segment.voiceoverAsset),
      )
    : null;
  const voiceoverDurationSeconds =
    sceneVoiceoverAssetDurationSeconds ??
    (isWorkspaceSegmentVoiceoverPlaybackFresh(segment, session)
      ? getWorkspaceSegmentVoiceoverDurationSeconds(segment, session)
      : null);
  return typeof voiceoverDurationSeconds === "number" && Number.isFinite(voiceoverDurationSeconds) && voiceoverDurationSeconds > 0
    ? roundWorkspaceSegmentTimelineSeconds(voiceoverDurationSeconds)
    : null;
};

export const shouldPreserveWorkspaceSegmentManualVisualDurationForVoiceover = (
  segment: WorkspaceSegmentEditorDraftSegment,
  voiceoverDurationSeconds: number | null | undefined,
) => {
  const normalizedVoiceoverDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(voiceoverDurationSeconds);
  const manualDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
  const storedDurationExtensionSourceDurationSeconds =
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment);
  const hasUserSelectedVoiceoverDurationSync =
    normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) === "voiceover" &&
    segment.durationSyncModeUserSelected === true;
  const hasUserSelectedVisualDurationSync =
    normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) === "visual" &&
    segment.durationSyncModeUserSelected === true;
  const hasManualTimelineOverride =
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" ||
    manualDurationSeconds !== null ||
    storedDurationExtensionSourceDurationSeconds !== null;
  return (
    normalizedVoiceoverDurationSeconds !== null &&
    !hasUserSelectedVoiceoverDurationSync &&
    hasManualTimelineOverride &&
    hasUserSelectedVisualDurationSync &&
    storedDurationExtensionSourceDurationSeconds === null &&
    manualDurationSeconds !== null &&
    manualDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS >= normalizedVoiceoverDurationSeconds
  );
};

export const shouldPreserveWorkspaceSegmentUserVisualDurationForVoiceover = (
  segment: WorkspaceSegmentEditorDraftSegment,
  voiceoverDurationSeconds: number | null | undefined,
) => {
  const normalizedVoiceoverDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(voiceoverDurationSeconds);
  const manualDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
  const hasVisualDurationSync = normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) === "visual";
  return (
    hasVisualDurationSync &&
    segment.durationSyncModeUserSelected === true &&
    normalizedVoiceoverDurationSeconds !== null &&
    manualDurationSeconds !== null
  );
};

export const syncWorkspaceSegmentFreshVoiceoverTimelineDuration = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "language" | "ttsAssetId" | "voiceType"> | null,
): WorkspaceSegmentEditorDraftSegment => {
  const freshVoiceoverDurationSeconds = getWorkspaceSegmentFreshVoiceoverDurationSeconds(segment, session);
  const storedDurationExtensionSourceDurationSeconds =
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment);
  const currentSlotDurationSeconds = getWorkspaceSegmentCanonicalSlotDurationSeconds(segment);
  const hasStoredDurationExtension =
    storedDurationExtensionSourceDurationSeconds !== null &&
    currentSlotDurationSeconds !== null &&
    currentSlotDurationSeconds > storedDurationExtensionSourceDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS;
  const actualExtendedVoiceoverDurationSeconds =
    freshVoiceoverDurationSeconds === null &&
    hasStoredDurationExtension
      ? getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session, { allowEstimated: false })?.durationSeconds ?? null
      : null;
  const voiceoverDurationSeconds = freshVoiceoverDurationSeconds ?? actualExtendedVoiceoverDurationSeconds;
  if (voiceoverDurationSeconds === null) {
    return segment;
  }

  const durationSyncMode = normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode);
  const hasUserSelectedVisualDurationSync =
    durationSyncMode === "visual" && segment.durationSyncModeUserSelected === true;
  const hasStaleVoiceoverTrimmedVisualRestoreCandidate =
    freshVoiceoverDurationSeconds === null &&
    durationSyncMode === "voiceover" &&
    segment.durationSyncModeUserSelected !== true &&
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "auto" &&
    normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds) === null &&
    storedDurationExtensionSourceDurationSeconds !== null;
  const shouldVoiceoverOwnTimelineDuration =
    freshVoiceoverDurationSeconds !== null &&
    isWorkspaceSegmentFreshSceneVoiceoverAsset(segment, session) &&
    !hasUserSelectedVisualDurationSync &&
    !hasStaleVoiceoverTrimmedVisualRestoreCandidate &&
    !doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio(segment);
  const currentSpeechDuration = getWorkspaceSegmentEditorSpeechDuration(segment);
  const shouldFillSpeechDuration = currentSpeechDuration === null;
  const shouldPreserveManualVisualDuration =
    !shouldVoiceoverOwnTimelineDuration &&
    shouldPreserveWorkspaceSegmentManualVisualDurationForVoiceover(segment, voiceoverDurationSeconds);
  const shouldPreserveUserVisualDuration =
    !shouldVoiceoverOwnTimelineDuration &&
    shouldPreserveWorkspaceSegmentUserVisualDurationForVoiceover(segment, voiceoverDurationSeconds);
  const isSavedTalkingPhotoWithEmbeddedVoice =
    doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio(segment) &&
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" &&
    normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds) !== null &&
    Boolean(segment.voiceoverTextHash) &&
    Boolean(normalizeWorkspaceSegmentEditorSetting(segment.voiceoverVoiceType));
  if (isSavedTalkingPhotoWithEmbeddedVoice) {
    return {
      ...segment,
      durationSyncMode: "visual",
      speechDuration: shouldFillSpeechDuration ? voiceoverDurationSeconds : segment.speechDuration,
      speechDurationSource: shouldFillSpeechDuration ? "audio" : segment.speechDurationSource ?? null,
    };
  }
  if (shouldPreserveManualVisualDuration || shouldPreserveUserVisualDuration) {
    const manualDurationSeconds =
      normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds) ??
      getWorkspaceSegmentCanonicalSlotDurationSeconds(segment);
    return {
      ...segment,
      durationSyncMode: "visual",
      durationMode: "manual",
      manualDurationSeconds,
      speechDuration: shouldFillSpeechDuration ? voiceoverDurationSeconds : segment.speechDuration,
      speechDurationSource: shouldFillSpeechDuration ? "audio" : segment.speechDurationSource ?? null,
    };
  }
  const selectedVisualPreviewKind = getWorkspaceSegmentSelectedVisualPreviewKind(segment);
  const previewKind = getWorkspaceSegmentPreviewKind(segment);
  const isVideoVisualSegment =
    selectedVisualPreviewKind === "video" ||
    previewKind === "video" ||
    String(segment.mediaType ?? "").trim().toLowerCase() === "video";
  const hasPersistedVideoSceneVoiceoverSlot =
    isVideoVisualSegment &&
    !shouldVoiceoverOwnTimelineDuration &&
    hasWorkspaceSegmentPersistedMediaReference(segment) &&
    isWorkspaceSegmentPersistedSceneVoiceoverAsset(segment.voiceoverAsset) &&
    currentSlotDurationSeconds !== null &&
    !(
      normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) === "voiceover" &&
      segment.durationSyncModeUserSelected === true
    );
  if (hasPersistedVideoSceneVoiceoverSlot) {
    const duration = roundWorkspaceSegmentTimelineSeconds(currentSlotDurationSeconds);
    const startTime = getWorkspaceSegmentEditorDisplayStartTime(segment);
    return {
      ...segment,
      duration,
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      durationMode: "manual",
      endTime: roundWorkspaceSegmentTimelineSeconds(startTime + duration),
      manualDurationSeconds: duration,
      speechDuration: shouldFillSpeechDuration ? voiceoverDurationSeconds : segment.speechDuration,
      speechDurationSource: shouldFillSpeechDuration ? "audio" : segment.speechDurationSource ?? null,
      startTime,
    };
  }
  const isImageVisualSegment =
    selectedVisualPreviewKind === "image" ||
    previewKind === "image" ||
    String(segment.mediaType ?? "").trim().toLowerCase() === "photo";
  const knownVideoVisualDurationSeconds = isVideoVisualSegment ? getWorkspaceSegmentKnownVisualDurationSeconds(segment) : null;
  const canonicalVideoDurationSeconds = isVideoVisualSegment ? getWorkspaceSegmentCanonicalSlotDurationSeconds(segment) : null;
  const currentVideoDurationSeconds =
    knownVideoVisualDurationSeconds !== null && canonicalVideoDurationSeconds !== null
      ? Math.max(knownVideoVisualDurationSeconds, canonicalVideoDurationSeconds)
      : knownVideoVisualDurationSeconds ?? canonicalVideoDurationSeconds;
  const hasUserSelectedVoiceoverDurationSync =
    durationSyncMode === "voiceover" && segment.durationSyncModeUserSelected === true;
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);
  const hasManualVideoTimelineOverride =
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" ||
    normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds) !== null;
  const isManualVideoTimelineAtSourceDuration =
    hasManualVideoTimelineOverride &&
    knownVideoVisualDurationSeconds !== null &&
    canonicalVideoDurationSeconds !== null &&
    canonicalVideoDurationSeconds <= knownVideoVisualDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS;
  const isManualVideoTimelineAtStoredSourceDuration =
    durationSyncMode === "visual" &&
    hasManualVideoTimelineOverride &&
    storedDurationExtensionSourceDurationSeconds !== null &&
    canonicalVideoDurationSeconds !== null &&
    areWorkspaceSegmentDurationValuesEqual(canonicalVideoDurationSeconds, storedDurationExtensionSourceDurationSeconds);
  const hasFreshVoiceoverTimelineDuration =
    freshVoiceoverDurationSeconds !== null &&
    Boolean(segment.voiceoverAsset) &&
    isWorkspaceSegmentVoiceoverAssetFresh(segment, session);
  const hasSceneOnlyVoiceoverSession =
    normalizeWorkspaceSegmentEditorSetting(session?.voiceType) === "none" &&
    getPositiveWorkspaceMediaAssetId(session?.ttsAssetId) === null;
  const hasFreshCustomVideoProjectVoiceoverTimelineDuration =
    freshVoiceoverDurationSeconds !== null &&
    !segment.voiceoverAsset &&
    latestVisualAction === "custom" &&
    isWorkspaceSegmentProjectVoiceoverTimingFresh(segment, session);
  const shouldSyncVideoToVoiceover =
    !hasStaleVoiceoverTrimmedVisualRestoreCandidate &&
    (shouldVoiceoverOwnTimelineDuration ||
      hasUserSelectedVoiceoverDurationSync ||
      actualExtendedVoiceoverDurationSeconds !== null ||
      (isVideoVisualSegment && !hasUserSelectedVisualDurationSync && freshVoiceoverDurationSeconds !== null) ||
      (!isManualVideoTimelineAtStoredSourceDuration &&
        shouldAutoTrimWorkspaceSegmentVideoToVoiceover(currentVideoDurationSeconds, voiceoverDurationSeconds)) ||
      (hasFreshVoiceoverTimelineDuration &&
        hasManualVideoTimelineOverride &&
        (durationSyncMode !== "visual" ||
          isWorkspaceSegmentGeneratedVideoVisual(segment) ||
          (hasSceneOnlyVoiceoverSession &&
            latestVisualAction === "custom" &&
            isManualVideoTimelineAtSourceDuration &&
            storedDurationExtensionSourceDurationSeconds === null))) ||
      (hasFreshCustomVideoProjectVoiceoverTimelineDuration && hasManualVideoTimelineOverride));

  if (
    isVideoVisualSegment &&
    shouldSyncVideoToVoiceover
  ) {
    const duration = roundWorkspaceSegmentTimelineSeconds(voiceoverDurationSeconds);
    const sourceDurationSeconds =
      currentVideoDurationSeconds !== null &&
      currentVideoDurationSeconds > duration + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS
        ? roundWorkspaceSegmentTimelineSeconds(currentVideoDurationSeconds)
        : null;
    return {
      ...segment,
      duration,
      durationExtensionSourceDurationSeconds: sourceDurationSeconds,
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: hasUserSelectedVoiceoverDurationSync,
      durationMode: "auto",
      manualDurationSeconds: null,
      speechDuration: shouldFillSpeechDuration ? voiceoverDurationSeconds : segment.speechDuration,
      speechDurationSource: shouldFillSpeechDuration ? "audio" : segment.speechDurationSource ?? null,
    };
  }

  if (
    isVideoVisualSegment &&
    hasUserSelectedVisualDurationSync &&
    currentVideoDurationSeconds !== null &&
    currentVideoDurationSeconds > voiceoverDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS
  ) {
    const visualDurationSourceSeconds = knownVideoVisualDurationSeconds ?? currentVideoDurationSeconds;
    const visualDuration = roundWorkspaceSegmentTimelineSeconds(visualDurationSourceSeconds);
    const startTime = getWorkspaceSegmentEditorDisplayStartTime(segment);
    const currentManualDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
    if (
      durationSyncMode === "visual" &&
      normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" &&
      areWorkspaceSegmentDurationValuesEqual(currentManualDurationSeconds, visualDuration)
    ) {
      return segment;
    }

    return {
      ...segment,
      duration: visualDuration,
      durationExtensionSourceDurationSeconds:
        storedDurationExtensionSourceDurationSeconds ?? visualDuration,
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      durationMode: "manual",
      endTime: roundWorkspaceSegmentTimelineSeconds(startTime + visualDuration),
      manualDurationSeconds: visualDuration,
      startTime,
    };
  }

  const hasManualTimelineOverride =
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" ||
    normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds) !== null ||
    storedDurationExtensionSourceDurationSeconds !== null;
  if (!hasManualTimelineOverride && !shouldFillSpeechDuration) {
    return segment;
  }

  if (isImageVisualSegment) {
    return {
      ...segment,
      durationExtensionSourceDurationSeconds: null,
      durationSyncMode: shouldVoiceoverOwnTimelineDuration ? "voiceover" : "visual",
      durationSyncModeUserSelected: false,
      durationMode: "auto",
      manualDurationSeconds: null,
      speechDuration: shouldFillSpeechDuration ? voiceoverDurationSeconds : segment.speechDuration,
      speechDurationSource: shouldFillSpeechDuration ? "audio" : segment.speechDurationSource ?? null,
    };
  }

  return {
    ...segment,
    durationExtensionSourceDurationSeconds: null,
    durationSyncMode: "voiceover",
    durationSyncModeUserSelected: false,
    durationMode: "auto" as const,
    manualDurationSeconds: null,
    speechDuration: shouldFillSpeechDuration ? voiceoverDurationSeconds : segment.speechDuration,
    speechDurationSource: shouldFillSpeechDuration ? "audio" : segment.speechDurationSource ?? null,
  };
};

export const shouldRepairWorkspaceSegmentAutoVisualDurationToVoiceover = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "language" | "ttsAssetId" | "voiceType"> | null,
) => {
  const voiceoverDurationSeconds =
    getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session, { allowEstimated: false })?.durationSeconds ?? null;
  if (voiceoverDurationSeconds === null) {
    return false;
  }

  if (shouldPreserveWorkspaceSegmentManualVisualDurationForVoiceover(segment, voiceoverDurationSeconds)) {
    return false;
  }

  if (shouldPreserveWorkspaceSegmentUserVisualDurationForVoiceover(segment, voiceoverDurationSeconds)) {
    return false;
  }

  const displayDurationSeconds =
    getWorkspaceSegmentEditorDisplayEndTime(segment) - getWorkspaceSegmentEditorDisplayStartTime(segment);
  return displayDurationSeconds > voiceoverDurationSeconds + WORKSPACE_SEGMENT_STALE_AUTO_VISUAL_REPAIR_THRESHOLD_SECONDS;
};

const restoreWorkspaceSegmentStaleVoiceoverTrimToVisualDuration = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "language" | "ttsAssetId" | "voiceType"> | null,
): WorkspaceSegmentEditorDraftSegment => {
  if (
    getWorkspaceSegmentPreviewKind(segment) !== "video" ||
    normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) !== "voiceover" ||
    segment.durationSyncModeUserSelected === true
  ) {
    return segment;
  }

  if (
    getWorkspaceSegmentFreshVoiceoverDurationSeconds(segment, session) !== null
  ) {
    return segment;
  }

  const voiceoverDurationSeconds =
    getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session, { allowEstimated: false })?.durationSeconds ?? null;
  const visualDurationSeconds = getWorkspaceSegmentKnownVisualDurationSeconds(segment);
  if (
    voiceoverDurationSeconds === null ||
    visualDurationSeconds === null ||
    visualDurationSeconds <= voiceoverDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS
  ) {
    return segment;
  }

  const duration = roundWorkspaceSegmentTimelineSeconds(visualDurationSeconds);
  const startTime = getWorkspaceSegmentEditorDisplayStartTime(segment);
  return {
    ...segment,
    duration,
    durationExtensionSourceDurationSeconds:
      getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment) ?? duration,
    durationMode: "manual",
    durationSyncMode: "visual",
    durationSyncModeUserSelected: false,
    endTime: roundWorkspaceSegmentTimelineSeconds(startTime + duration),
    manualDurationSeconds: duration,
    startTime,
  };
};

export const resolveWorkspaceSegmentBoundaryTiming = (
  segment: WorkspaceSegmentEditorDraftSegment,
  requestedBoundaryTime: number,
  session?: (Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> &
    Partial<Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId">>) | null,
  options?: {
    voiceoverDurationSeconds?: number | null;
  },
) => {
  const segmentStartTime = getWorkspaceSegmentEditorDisplayStartTime(segment);
  const currentBoundaryTime = Math.max(segmentStartTime, getWorkspaceSegmentEditorDisplayEndTime(segment));
  const minimumDurationOptions = Object.prototype.hasOwnProperty.call(
    options ?? {},
    "voiceoverDurationSeconds",
  )
    ? {
        voiceoverDurationSeconds: options?.voiceoverDurationSeconds,
      }
    : undefined;
  const minimumDuration = getWorkspaceSegmentManualDurationMinimum(segment, session, minimumDurationOptions);
  const minimumBoundaryTime = segmentStartTime + minimumDuration;

  if (!Number.isFinite(requestedBoundaryTime) || requestedBoundaryTime < segmentStartTime) {
    return {
      boundaryTime: currentBoundaryTime,
      duration: Math.max(0, currentBoundaryTime - segmentStartTime),
      minimumBoundaryTime,
      minimumDuration,
      requestedDuration: requestedBoundaryTime - segmentStartTime,
      segmentStartTime,
      status: "invalid" as const,
    };
  }

  const requestedDuration = requestedBoundaryTime - segmentStartTime;
  const duration = Math.max(minimumDuration, requestedDuration);

  return {
    boundaryTime: segmentStartTime + duration,
    clamped: duration > requestedDuration,
    duration,
    minimumBoundaryTime,
    minimumDuration,
    requestedDuration,
    segmentStartTime,
    status: "valid" as const,
  };
};

export const getWorkspaceSegmentVisualGenerationDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) => {
  if (!segment) {
    return undefined;
  }

  const timelineDuration =
    getWorkspaceSegmentEditorDisplayEndTime(segment) - getWorkspaceSegmentEditorDisplayStartTime(segment);
  const manualDuration = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
  const timelineDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(timelineDuration);
  const segmentDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.duration);
  const manualDurationCandidates = [manualDuration, timelineDurationSeconds, segmentDurationSeconds].filter(
    (value): value is number => value !== null,
  );
  const resolvedDuration =
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" && manualDurationCandidates.length > 0
      ? Math.max(...manualDurationCandidates)
      : timelineDurationSeconds ?? segmentDurationSeconds;

  return resolvedDuration !== null ? Number(resolvedDuration.toFixed(3)) : undefined;
};

export const doesWorkspaceSegmentUseProjectVoiceoverTimelineTiming = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId" | "voiceType"> | null,
) => {
  const projectVoiceoverAssetId = getPositiveWorkspaceMediaAssetId(session?.ttsAssetId);
  if (
    projectVoiceoverAssetId === null ||
    !getWorkspaceSegmentEffectiveVoiceEnabled(segment, session) ||
    !hasWorkspaceSegmentProjectVoiceoverTimingData(segment)
  ) {
    return false;
  }

  const segmentVoiceoverAssetId = getWorkspaceSegmentCustomAssetId(segment.voiceoverAsset);
  return segmentVoiceoverAssetId === null || segmentVoiceoverAssetId === projectVoiceoverAssetId;
};

export const shouldUseWorkspaceSegmentProjectVoiceoverSpeechBoundary = (
  previousSegment: WorkspaceSegmentEditorDraftSegment,
  nextSegment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId" | "voiceType"> | null,
) => {
  const previousHasUserSelectedVoiceoverDuration =
    previousSegment.durationSyncModeUserSelected === true &&
    normalizeWorkspaceSegmentDurationSyncMode(previousSegment.durationSyncMode) === "voiceover";
  const nextHasUserSelectedVoiceoverDuration =
    nextSegment.durationSyncModeUserSelected === true &&
    normalizeWorkspaceSegmentDurationSyncMode(nextSegment.durationSyncMode) === "voiceover";
  const previousIsAuto =
    !previousHasUserSelectedVoiceoverDuration &&
    normalizeWorkspaceSegmentDurationMode(previousSegment.durationMode) !== "manual" &&
    normalizeWorkspaceSegmentManualDurationSeconds(previousSegment.manualDurationSeconds) === null;
  const nextIsAuto =
    !nextHasUserSelectedVoiceoverDuration &&
    normalizeWorkspaceSegmentDurationMode(nextSegment.durationMode) !== "manual" &&
    normalizeWorkspaceSegmentManualDurationSeconds(nextSegment.manualDurationSeconds) === null;

  return (
    previousIsAuto &&
    nextIsAuto &&
    doesWorkspaceSegmentUseProjectVoiceoverTimelineTiming(previousSegment, session) &&
    doesWorkspaceSegmentUseProjectVoiceoverTimelineTiming(nextSegment, session)
  );
};

const getWorkspaceSegmentProjectVoiceoverTimelineSpeechRange = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId" | "voiceType"> | null,
): WorkspaceSegmentTimelineRange | null => {
  if (!doesWorkspaceSegmentUseProjectVoiceoverTimelineTiming(segment, session)) {
    return getWorkspaceSegmentTimelineSpeechRange(segment);
  }

  return getWorkspaceSegmentVoiceSourceRange(segment) ?? getWorkspaceSegmentTimelineSpeechRange(segment);
};

const getWorkspaceSegmentShorterProjectVoiceoverSpeechDurationSeconds = (
  segment: WorkspaceSegmentEditorDraftSegment,
  assetDurationSeconds: number,
) => {
  const speechWordsRange = getWorkspaceSegmentSpeechWordsRange(segment);
  const speechWordsDuration =
    speechWordsRange !== null ? speechWordsRange.endTime - speechWordsRange.startTime : null;
  const speechStartTime = normalizeWorkspaceSegmentVoicePreviewTime(segment.speechStartTime);
  const speechEndTime = normalizeWorkspaceSegmentVoicePreviewTime(segment.speechEndTime);
  const speechBoundaryDuration =
    speechStartTime !== null && speechEndTime !== null && speechEndTime > speechStartTime
      ? speechEndTime - speechStartTime
      : null;
  const shorterSpeechDurations = [speechWordsDuration, speechBoundaryDuration].filter(
    (duration): duration is number =>
      duration !== null &&
      Number.isFinite(duration) &&
      duration > 0 &&
      duration + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS < assetDurationSeconds,
  );

  return shorterSpeechDurations.length > 0
    ? roundWorkspaceSegmentTimelineSeconds(Math.max(...shorterSpeechDurations))
    : null;
};

const sanitizeWorkspaceSegmentProjectVoiceoverFullAssetDurationLeak = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId"> | null,
) => {
  if (!isWorkspaceSegmentProjectVoiceoverAsset(segment, session)) {
    return segment;
  }

  const assetDurationSeconds = getStudioCustomVideoFileDurationSeconds(segment.voiceoverAsset);
  const speechDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.speechDuration);
  const voiceSourceDurationSeconds = getWorkspaceSegmentVoiceSourceDurationSeconds(segment);
  if (
    assetDurationSeconds === null ||
    ![speechDurationSeconds, voiceSourceDurationSeconds].some(
      (durationSeconds) => areWorkspaceSegmentDurationValuesEqual(durationSeconds, assetDurationSeconds),
    )
  ) {
    return segment;
  }

  const shorterSpeechDurationSeconds =
    getWorkspaceSegmentShorterProjectVoiceoverSpeechDurationSeconds(segment, assetDurationSeconds);
  const speechStartTime = normalizeWorkspaceSegmentVoicePreviewTime(segment.speechStartTime);
  const speechEndTime = normalizeWorkspaceSegmentVoicePreviewTime(segment.speechEndTime);
  const speechBoundaryDurationSeconds =
    speechStartTime !== null && speechEndTime !== null && speechEndTime > speechStartTime
      ? speechEndTime - speechStartTime
      : null;
  const shouldClearLeakedSpeechBoundary = areWorkspaceSegmentDurationValuesEqual(
    speechBoundaryDurationSeconds,
    assetDurationSeconds,
  );
  const shouldClearLeakedVoiceSource = areWorkspaceSegmentDurationValuesEqual(
    voiceSourceDurationSeconds,
    assetDurationSeconds,
  );
  const hasShorterSceneDuration = getWorkspaceSegmentSceneDurationCandidates(segment).some(
    (duration) => duration + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS < assetDurationSeconds,
  );
  if (shorterSpeechDurationSeconds === null && !hasShorterSceneDuration) {
    return segment;
  }

  const hasManualDuration =
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "manual" ||
    normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds) !== null;
  const startTime = normalizeWorkspaceSegmentVoicePreviewTime(segment.startTime) ?? 0;
  const endTime = normalizeWorkspaceSegmentVoicePreviewTime(segment.endTime);
  const timelineDuration = endTime !== null && endTime > startTime ? endTime - startTime : null;
  const shouldResetLeakedSceneDuration =
    !hasManualDuration &&
    shorterSpeechDurationSeconds !== null &&
    (areWorkspaceSegmentDurationValuesEqual(
      normalizeWorkspaceSegmentManualDurationSeconds(segment.duration),
      assetDurationSeconds,
    ) ||
      areWorkspaceSegmentDurationValuesEqual(
        normalizeWorkspaceSegmentManualDurationSeconds(timelineDuration),
        assetDurationSeconds,
      ));

  return {
    ...segment,
    duration: shouldResetLeakedSceneDuration ? shorterSpeechDurationSeconds : segment.duration,
    endTime: shouldResetLeakedSceneDuration
      ? roundWorkspaceSegmentTimelineSeconds(startTime + shorterSpeechDurationSeconds)
      : segment.endTime,
    speechDuration: shorterSpeechDurationSeconds,
    speechDurationSource: null,
    speechEndTime: shouldClearLeakedSpeechBoundary ? null : segment.speechEndTime,
    speechStartTime: shouldClearLeakedSpeechBoundary ? null : segment.speechStartTime,
    voiceSourceDuration: shouldClearLeakedVoiceSource ? null : segment.voiceSourceDuration,
    voiceSourceEndTime: shouldClearLeakedVoiceSource ? null : segment.voiceSourceEndTime,
    voiceSourceStartTime: shouldClearLeakedVoiceSource ? null : segment.voiceSourceStartTime,
  };
};

const sanitizeWorkspaceSegmentObviousVoiceoverVisualEcho = (
  segment: WorkspaceSegmentEditorDraftSegment,
) => {
  if (getWorkspaceSegmentPreviewKind(segment) === "video") {
    return segment;
  }

  if (isWorkspaceSegmentPersistedStillSlot(segment)) {
    return segment;
  }

  const leakedDurationCandidates = [
    normalizeWorkspaceSegmentManualDurationSeconds(segment.speechDuration),
    getWorkspaceSegmentVoiceSourceDurationSeconds(segment),
    getWorkspaceSegmentSpeechTimelineDurationSeconds(segment),
  ];
  const hasObviousVoiceoverDurationLeak = leakedDurationCandidates.some((durationSeconds) =>
    isWorkspaceSegmentVoiceoverDurationObviousVisualEcho(segment, durationSeconds),
  );
  if (!hasObviousVoiceoverDurationLeak) {
    return segment;
  }

  const normalizedText = normalizeWorkspaceSegmentEditorTextForCompare(segment.text);
  const estimatedVoiceDuration = normalizedText
    ? estimateWorkspaceSegmentEditorSpeechDuration(normalizedText)
    : WORKSPACE_SEGMENT_EDITOR_NEW_SEGMENT_DURATION_SECONDS;
  const speechDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.speechDuration);
  const voiceSourceDurationSeconds = getWorkspaceSegmentVoiceSourceDurationSeconds(segment);
  const speechTimelineDurationSeconds = getWorkspaceSegmentSpeechTimelineDurationSeconds(segment);
  const safeVoiceDurationCandidates = [
    voiceSourceDurationSeconds,
    speechDurationSeconds,
    speechTimelineDurationSeconds,
  ].filter(
    (durationSeconds): durationSeconds is number =>
      durationSeconds !== null && !isWorkspaceSegmentVoiceoverDurationObviousVisualEcho(segment, durationSeconds),
  );
  const safeVoiceDuration =
    safeVoiceDurationCandidates.length > 0
      ? roundWorkspaceSegmentTimelineSeconds(Math.max(...safeVoiceDurationCandidates))
      : estimatedVoiceDuration;
  const resetVisualDuration =
    getWorkspaceSegmentKnownVisualDurationSeconds(segment) ??
    normalizeWorkspaceSegmentManualDurationSeconds(segment.durationExtensionSourceDurationSeconds) ??
    safeVoiceDuration ??
    WORKSPACE_SEGMENT_EDITOR_NEW_SEGMENT_DURATION_SECONDS;
  const shouldResetSceneDuration =
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment) === null &&
    getWorkspaceSegmentSceneDurationCandidates(segment).some(
      (duration) => duration > Math.max(estimatedVoiceDuration * 2.6, estimatedVoiceDuration + 4),
    );
  const startTime = getWorkspaceSegmentEditorDisplayStartTime(segment);
  const shouldClearSpeechDuration =
    speechDurationSeconds !== null && isWorkspaceSegmentVoiceoverDurationObviousVisualEcho(segment, speechDurationSeconds);
  const speechRange = getWorkspaceSegmentTimelineSpeechRange(segment);
  const speechRangeDuration =
    speechRange !== null && speechRange.endTime > speechRange.startTime
      ? roundWorkspaceSegmentTimelineSeconds(speechRange.endTime - speechRange.startTime)
      : null;
  const shouldClearSpeechRangeEcho =
    shouldResetSceneDuration &&
    speechRangeDuration !== null &&
    speechRangeDuration > Math.max(safeVoiceDuration * 2.6, safeVoiceDuration + 4) &&
    getWorkspaceSegmentSceneDurationCandidates(segment).some((durationSeconds) =>
      areWorkspaceSegmentDurationValuesEqual(durationSeconds, speechRangeDuration),
    );
  const shouldClearSpeechTimeline =
    shouldClearSpeechRangeEcho ||
    (speechTimelineDurationSeconds !== null &&
      isWorkspaceSegmentVoiceoverDurationObviousVisualEcho(segment, speechTimelineDurationSeconds));
  const shouldClearVoiceSource =
    voiceSourceDurationSeconds !== null &&
    isWorkspaceSegmentVoiceoverDurationObviousVisualEcho(segment, voiceSourceDurationSeconds);

  return {
    ...segment,
    duration: shouldResetSceneDuration ? roundWorkspaceSegmentTimelineSeconds(resetVisualDuration) : segment.duration,
    durationExtensionSourceDurationSeconds: shouldResetSceneDuration ? null : segment.durationExtensionSourceDurationSeconds,
    durationMode: shouldResetSceneDuration ? "auto" : segment.durationMode,
    durationSyncMode: shouldResetSceneDuration ? "visual" : segment.durationSyncMode,
    durationSyncModeUserSelected: shouldResetSceneDuration ? false : segment.durationSyncModeUserSelected,
    endTime: shouldResetSceneDuration
      ? roundWorkspaceSegmentTimelineSeconds(startTime + resetVisualDuration)
      : segment.endTime,
    manualDurationSeconds: shouldResetSceneDuration ? null : segment.manualDurationSeconds,
    speechDuration: shouldClearSpeechDuration ? null : segment.speechDuration,
    speechDurationSource: shouldClearSpeechDuration ? null : segment.speechDurationSource ?? null,
    speechEndTime: shouldClearSpeechTimeline ? null : segment.speechEndTime,
    speechStartTime: shouldClearSpeechTimeline ? null : segment.speechStartTime,
    speechWords: shouldClearSpeechTimeline ? [] : segment.speechWords,
    startTime: shouldResetSceneDuration ? startTime : segment.startTime,
    voiceSourceDuration: shouldClearVoiceSource ? null : segment.voiceSourceDuration,
    voiceSourceEndTime: shouldClearVoiceSource ? null : segment.voiceSourceEndTime,
    voiceSourceStartTime: shouldClearVoiceSource ? null : segment.voiceSourceStartTime,
    voice_source_duration: shouldClearVoiceSource ? null : segment.voice_source_duration,
    voice_source_end_time: shouldClearVoiceSource ? null : segment.voice_source_end_time,
    voice_source_start_time: shouldClearVoiceSource ? null : segment.voice_source_start_time,
    _voice_source_duration: shouldClearVoiceSource ? null : segment._voice_source_duration,
    _voice_source_end_time: shouldClearVoiceSource ? null : segment._voice_source_end_time,
    _voice_source_start_time: shouldClearVoiceSource ? null : segment._voice_source_start_time,
  };
};

const sanitizeWorkspaceSegmentLegacyVoiceRenderManualDuration = (
  segment: WorkspaceSegmentEditorDraftSegment,
) => {
  if (!shouldDiscardWorkspaceSegmentLegacyVoiceRenderManualDuration(segment)) {
    return segment;
  }

  const voiceDuration = getWorkspaceSegmentVoiceSourceDurationSeconds(segment);
  if (voiceDuration === null) {
    return segment;
  }

  const startTime = getWorkspaceSegmentEditorDisplayStartTime(segment);
  const knownVisualDuration = getWorkspaceSegmentKnownVisualDurationSeconds(segment);
  const duration = roundWorkspaceSegmentTimelineSeconds(knownVisualDuration ?? voiceDuration);
  const durationSyncMode = knownVisualDuration !== null ? ("visual" as const) : ("voiceover" as const);
  return {
    ...segment,
    duration,
    durationExtensionSourceDurationSeconds: null,
    durationMode: "auto" as const,
    durationSyncMode,
    durationSyncModeUserSelected: false,
    endTime: roundWorkspaceSegmentTimelineSeconds(startTime + duration),
    manualDurationSeconds: null,
  };
};

const hasWorkspaceSegmentUserSelectedStillDurationSlotConflict = (
  segments: WorkspaceSegmentEditorDraftSegment[],
) => segments.some((segment) => {
  const manualDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
  if (
    manualDurationSeconds === null ||
    segment.durationSyncModeUserSelected !== true ||
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) !== "manual" ||
    normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) !== "visual" ||
    getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "image"
  ) {
    return false;
  }

  const startTime = normalizeWorkspaceSegmentManualDurationSeconds(segment.startTime);
  const endTime = normalizeWorkspaceSegmentManualDurationSeconds(segment.endTime);
  const timelineDurationSeconds =
    startTime !== null && endTime !== null && endTime > startTime
      ? normalizeWorkspaceSegmentManualDurationSeconds(endTime - startTime)
      : null;
  const storedDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.duration);

  return [timelineDurationSeconds, storedDurationSeconds].some(
    (durationSeconds) =>
      durationSeconds !== null &&
      !areWorkspaceSegmentDurationValuesEqual(durationSeconds, manualDurationSeconds),
  );
});

function isWorkspaceSegmentPersistedStillSlot(segment: WorkspaceSegmentEditorDraftSegment) {
  const isStillSegment =
    getWorkspaceSegmentPreviewKind(segment) === "image" ||
    getWorkspaceSegmentFallbackPreviewKind(segment) === "image" ||
    isWorkspacePhotoMediaAsset(segment.currentAsset) ||
    isWorkspacePhotoMediaAsset(segment.originalAsset);
  if (!isStillSegment) {
    return false;
  }

  return (
    hasWorkspaceSegmentPersistedProjectVisualReference(segment) &&
    getWorkspaceSegmentCanonicalSlotDurationSeconds(segment) !== null &&
    !(
      normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) === "voiceover" &&
      segment.durationSyncModeUserSelected === true
    )
  );
}

const shouldSyncWorkspaceSegmentStillDurationToFreshVoiceover = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "language" | "subtitleType" | "ttsAssetId" | "voiceType"> | null,
) =>
  getWorkspaceSegmentPreviewKind(segment) === "image" &&
  normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) === "voiceover" &&
  segment.durationSyncModeUserSelected !== true &&
  isWorkspaceSegmentFreshSceneVoiceoverAsset(segment, session) &&
  !doesWorkspaceSegmentUseEmbeddedTalkingPhotoAudio(segment);

const shouldPreserveWorkspaceSegmentExistingStillDuration = (
  segment: WorkspaceSegmentEditorDraftSegment,
  session?: Pick<WorkspaceSegmentEditorDraftSession, "language" | "subtitleType" | "ttsAssetId" | "voiceType"> | null,
) => {
  if (getWorkspaceSegmentPreviewKind(segment) !== "image") {
    return false;
  }

  if (segment.durationSyncModeUserSelected === true) {
    return true;
  }

  if (shouldSyncWorkspaceSegmentStillDurationToFreshVoiceover(segment, session)) {
    return false;
  }

  if (shouldRepairWorkspaceSegmentAutoVisualDurationToVoiceover(segment, session)) {
    return false;
  }

  if (isWorkspaceSegmentPersistedStillSlot(segment)) {
    return true;
  }

  const voiceoverDurationSeconds =
    getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session, { allowEstimated: false })?.durationSeconds ?? null;
  if (voiceoverDurationSeconds === null) {
    return true;
  }

  const displayDurationSeconds =
    getWorkspaceSegmentEditorDisplayEndTime(segment) - getWorkspaceSegmentEditorDisplayStartTime(segment);
  const hasResetManualVisualDuration =
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) === "auto" &&
    normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds) === null;

  return !(
    hasResetManualVisualDuration &&
    displayDurationSeconds > voiceoverDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS
  );
};

export const rebuildWorkspaceSegmentEditorDraftTimeline = (
  segments: WorkspaceSegmentEditorDraftSegment[],
  session?: Pick<WorkspaceSegmentEditorDraftSession, "language" | "subtitleType" | "ttsAssetId" | "voiceType"> | null,
  options?: {
    preserveSpeechBoundaries?: boolean;
    preserveExistingStillDurations?: boolean | ((segment: WorkspaceSegmentEditorDraftSegment) => boolean);
    preserveSourceTimelineEnd?: boolean;
  },
) => {
  let hasVoiceoverTimelineDurationReset = false;
  const syncedSegments = syncWorkspaceSegmentsEmbeddedVisualDurations(segments).map((segment) => {
    const segmentWithSanitizedProjectVoiceoverDuration =
      sanitizeWorkspaceSegmentLegacyVoiceRenderManualDuration(
        sanitizeWorkspaceSegmentObviousVoiceoverVisualEcho(
          sanitizeWorkspaceSegmentProjectVoiceoverFullAssetDurationLeak(segment, session),
        ),
      );
    const segmentWithGeneratedVideoVisualDuration = syncWorkspaceSegmentGeneratedVideoDefaultVisualDuration(
      segmentWithSanitizedProjectVoiceoverDuration,
    );
    const segmentWithPendingVoiceoverTiming = syncWorkspaceSegmentPendingVoiceoverEstimatedDuration(
      segmentWithGeneratedVideoVisualDuration,
      session,
    );
    const segmentWithFreshVoiceoverTiming = syncWorkspaceSegmentFreshVoiceoverTimelineDuration(
      segmentWithPendingVoiceoverTiming,
      session,
    );
    const timelineDurationBeforeFreshVoiceoverSync = roundWorkspaceSegmentTimelineSeconds(
      Math.max(
        0,
        getWorkspaceSegmentEditorDisplayEndTime(segmentWithPendingVoiceoverTiming) -
          getWorkspaceSegmentEditorDisplayStartTime(segmentWithPendingVoiceoverTiming),
      ),
    );
    const actualTimelineVoiceoverDurationInfo = getWorkspaceSegmentTimelineVoiceoverDurationInfo(
      segmentWithPendingVoiceoverTiming,
      session,
      { allowEstimated: false },
    );
    if (
      actualTimelineVoiceoverDurationInfo?.source === "actual" &&
      normalizeWorkspaceSegmentDurationSyncMode(segmentWithFreshVoiceoverTiming.durationSyncMode) === "voiceover" &&
      !areWorkspaceSegmentDurationValuesEqual(
        timelineDurationBeforeFreshVoiceoverSync,
        actualTimelineVoiceoverDurationInfo.durationSeconds,
      )
    ) {
      hasVoiceoverTimelineDurationReset = true;
    }
    const segmentWithRestoredVisualDuration = restoreWorkspaceSegmentStaleVoiceoverTrimToVisualDuration(
      segmentWithFreshVoiceoverTiming,
      session,
    );
    const segmentHadManualTimelineOverride =
      normalizeWorkspaceSegmentDurationMode(segmentWithSanitizedProjectVoiceoverDuration.durationMode) === "manual" ||
      normalizeWorkspaceSegmentManualDurationSeconds(segmentWithSanitizedProjectVoiceoverDuration.manualDurationSeconds) !== null ||
      getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segmentWithSanitizedProjectVoiceoverDuration) !== null;
    const segmentKeptManualTimelineOverride =
      normalizeWorkspaceSegmentDurationMode(segmentWithRestoredVisualDuration.durationMode) === "manual" ||
      normalizeWorkspaceSegmentManualDurationSeconds(segmentWithRestoredVisualDuration.manualDurationSeconds) !== null ||
      getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segmentWithRestoredVisualDuration) !== null;
    if (
      segmentHadManualTimelineOverride &&
      !segmentKeptManualTimelineOverride &&
      getWorkspaceSegmentTimelineVoiceoverDurationInfo(segmentWithRestoredVisualDuration, session, {
        allowEstimated: false,
      }) !== null
    ) {
      hasVoiceoverTimelineDurationReset = true;
    }
    if (shouldRepairWorkspaceSegmentAutoVisualDurationToVoiceover(segmentWithRestoredVisualDuration, session)) {
      hasVoiceoverTimelineDurationReset = true;
    }
    return segmentWithRestoredVisualDuration.voiceoverAsset &&
      !isWorkspaceSegmentProjectVoiceoverAsset(segmentWithRestoredVisualDuration, session) &&
      !isWorkspaceSegmentVoiceoverAssetFresh(segmentWithRestoredVisualDuration, session)
      ? {
          ...segmentWithRestoredVisualDuration,
          speechDuration: null,
          speechDurationSource: null,
          speechEndTime: null,
          speechStartTime: null,
          speechWords: [],
          voiceSourceDuration: null,
          voiceSourceEndTime: null,
          voiceSourceStartTime: null,
        }
      : segmentWithRestoredVisualDuration;
  });
  const shouldRepairUserSelectedStillDurations =
    hasWorkspaceSegmentUserSelectedStillDurationSlotConflict(syncedSegments);
  const preserveExistingStillDurationsOverride = options?.preserveExistingStillDurations;
  const preserveSpeechBoundaries = options?.preserveSpeechBoundaries ?? !hasVoiceoverTimelineDurationReset;

  return rebuildWorkspaceSegmentEditorTimeline(syncedSegments, {
    preferEstimatedDuration: shouldPreferEstimatedDurationForDraftSegment,
    stillNoTextFallbackDuration: WORKSPACE_SEGMENT_EDITOR_NEW_SEGMENT_DURATION_SECONDS,
    subtitleEnabled: (segment) =>
      getWorkspaceSegmentEffectiveSubtitleSettings(session, segment, {
        subtitleColorId: fallbackStudioSubtitleColorOption.id,
        subtitleStyleId: fallbackStudioSubtitleStyleOption.id,
      }).isEnabled,
    visualDurationSeconds: (segment) => getWorkspaceSegmentKnownVisualDurationSeconds(segment),
    visualKind: (segment) => (getWorkspaceSegmentPreviewKind(segment) === "video" ? "video" : "image"),
    voiceDurationSeconds: (segment) => getWorkspaceSegmentTimelineVoiceoverDurationSeconds(segment, session),
    voiceEnabled: (segment) => getWorkspaceSegmentEffectiveVoiceEnabled(segment, session),
    speechBoundaryEnabled: (previousSegment, nextSegment) =>
      shouldUseWorkspaceSegmentProjectVoiceoverSpeechBoundary(previousSegment, nextSegment, session),
    speechRange: (segment) => getWorkspaceSegmentProjectVoiceoverTimelineSpeechRange(segment, session),
    preserveSpeechBoundaries,
    preserveSourceTimelineEnd:
      options?.preserveSourceTimelineEnd ?? (!hasVoiceoverTimelineDurationReset && !shouldRepairUserSelectedStillDurations),
    preserveExistingStillDurations: (segment) =>
      typeof preserveExistingStillDurationsOverride === "function"
        ? preserveExistingStillDurationsOverride(segment)
        : typeof preserveExistingStillDurationsOverride === "boolean"
          ? preserveExistingStillDurationsOverride
          : shouldPreserveWorkspaceSegmentExistingStillDuration(segment, session),
    preserveExistingStillDurationsExact: (segment) =>
      isWorkspaceSegmentPersistedStillSlot(segment) &&
      !shouldSyncWorkspaceSegmentStillDurationToFreshVoiceover(segment, session),
    minimumDurationSeconds: (segment) => getWorkspaceSegmentManualDurationMinimum(segment, session),
    zeroDuration: isWorkspaceSegmentEditorDraftSegmentEmpty,
  });
};

export const rebuildWorkspaceSegmentEditorDraftSessionTimeline = (
  session: WorkspaceSegmentEditorDraftSession,
  options?: {
    preserveSpeechBoundaries?: boolean;
    preserveExistingStillDurations?: boolean | ((segment: WorkspaceSegmentEditorDraftSegment) => boolean);
    preserveSourceTimelineEnd?: boolean;
  },
): WorkspaceSegmentEditorDraftSession => {
  const repairedSession = {
    ...session,
    segments: repairWorkspaceSegmentEditorSpeechWordBoundaries(session.segments),
  };

  return {
    ...repairedSession,
    segments: rebuildWorkspaceSegmentEditorDraftTimeline(repairedSession.segments, repairedSession, options),
  };
};

export type WorkspaceSegmentEditorJobResultApplyStatus =
  | "applied"
  | "project-mismatch"
  | "segment-missing";

export const applyWorkspaceSegmentEditorJobResult = (
  session: WorkspaceSegmentEditorDraftSession,
  options: {
    expectedProjectId: number;
    segmentIndex: number;
    updater: (
      segment: WorkspaceSegmentEditorDraftSegment,
      session: WorkspaceSegmentEditorDraftSession,
    ) => WorkspaceSegmentEditorDraftSegment;
    timelineOptions?: {
      preserveSpeechBoundaries?: boolean;
      preserveExistingStillDurations?: boolean | ((segment: WorkspaceSegmentEditorDraftSegment) => boolean);
      preserveSourceTimelineEnd?: boolean;
    };
  },
): {
  draft: WorkspaceSegmentEditorDraftSession;
  status: WorkspaceSegmentEditorJobResultApplyStatus;
} => {
  if (session.projectId !== options.expectedProjectId) {
    return { draft: session, status: "project-mismatch" };
  }

  const targetSegment = session.segments.find((segment) => segment.index === options.segmentIndex);
  if (!targetSegment) {
    return { draft: session, status: "segment-missing" };
  }

  const nextSegment = options.updater(targetSegment, session);
  if (nextSegment === targetSegment) {
    return { draft: session, status: "applied" };
  }

  return {
    draft: rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...session,
      segments: session.segments.map((segment) =>
        segment.index === options.segmentIndex ? nextSegment : segment,
      ),
    }, options.timelineOptions),
    status: "applied",
  };
};

export const WORKSPACE_SEGMENT_EDITOR_SCRATCH_PROJECT_ID = 0;

const createWorkspaceSegmentEditorScratchDraftId = () => {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return `scratch:${randomUuid}`;
  }

  return `scratch:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 12)}`;
};

export const getWorkspaceSegmentEditorDraftId = (
  session?: Pick<WorkspaceSegmentEditorDraftSession, "draftId" | "projectId"> | null,
) => {
  const explicitDraftId = String(session?.draftId ?? "").trim();
  if (explicitDraftId) {
    return explicitDraftId;
  }

  const projectId = Number(session?.projectId);
  return Number.isInteger(projectId) && projectId > 0 ? `project:${projectId}` : null;
};

export const ensureWorkspaceSegmentEditorDraftId = (
  session: WorkspaceSegmentEditorDraftSession,
): WorkspaceSegmentEditorDraftSession => {
  const draftId = getWorkspaceSegmentEditorDraftId(session) ?? createWorkspaceSegmentEditorScratchDraftId();
  return session.draftId === draftId ? session : { ...session, draftId };
};

export const isWorkspaceSegmentEditorScratchDraft = (
  session?: Pick<WorkspaceSegmentEditorDraftSession, "projectId"> | null,
) => Number(session?.projectId) === WORKSPACE_SEGMENT_EDITOR_SCRATCH_PROJECT_ID;

export const createWorkspaceSegmentEditorDraftSession = (
  session: WorkspaceSegmentEditorSession,
): WorkspaceSegmentEditorDraftSession => {
  const normalizedSession = normalizeWorkspaceSegmentEditorSessionVoiceInheritance({
    ...session,
    segments: repairWorkspaceSegmentEditorSpeechWordBoundaries(session.segments),
  });
  const sourceLanguage = getWorkspaceSegmentEditorSessionLanguage(normalizedSession);

  return {
    ...normalizedSession,
    draftId: `project:${normalizedSession.projectId}`,
    segments: rebuildWorkspaceSegmentEditorDraftTimeline(
      normalizedSession.segments.map((segment) => {
        const sceneSoundAsset = createWorkspaceSegmentSceneSoundAsset(segment, segment.index);
        const voiceoverAsset = createWorkspaceSegmentVoiceoverAsset(segment, segment.index);
        const hasProjectVoiceoverTiming =
          !voiceoverAsset &&
          getPositiveWorkspaceMediaAssetId(normalizedSession.ttsAssetId) !== null &&
          hasWorkspaceSegmentProjectVoiceoverTimingData(segment);
        const manualDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
        const voiceOverrideId = resolveWorkspaceSegmentProjectVoiceoverVoiceOverrideId(segment, {
          hasProjectVoiceoverTiming,
          sessionTtsAssetId: normalizedSession.ttsAssetId,
          sessionVoiceType: normalizedSession.voiceType,
          voiceoverAsset,
        });
        const isPersistedTalkingPhotoSegment =
          segment.videoAction === "talking_photo" || segment.aiVideoGeneratedMode === "talking_photo";
        const legacyVoiceRenderSourceStartTime = normalizeWorkspaceSegmentManualDurationSeconds(
          segment._voice_render_source_start_time,
        );
        const legacyVoiceRenderSourceEndTime = normalizeWorkspaceSegmentManualDurationSeconds(
          segment._voice_render_source_end_time,
        );
        const infographic = normalizeWorkspaceSegmentInfographic(segment.infographic);

        return {
          ...normalizeWorkspaceSegmentEditorSegmentUrls(segment),
          _voice_render_source_end_time: legacyVoiceRenderSourceEndTime,
          _voice_render_source_start_time: legacyVoiceRenderSourceStartTime,
          aiPhotoAsset: null,
          aiPhotoGeneratedFromPrompt: null,
          aiPhotoPrompt: "",
          aiPhotoPromptInitialized: false,
          aiVideoAsset: null,
          aiVideoGeneratedMode: isPersistedTalkingPhotoSegment ? "talking_photo" : null,
          aiVideoGeneratedFromPrompt: null,
          aiVideoPrompt: "",
          aiVideoPromptInitialized: false,
          customVideo: null,
          durationExtensionSourceDurationSeconds: getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment),
          durationMode: normalizeWorkspaceSegmentDurationMode(segment.durationMode),
          imageEditAsset: null,
          imageEditGeneratedFromPrompt: null,
          imageEditPrompt: "",
          imageEditPromptInitialized: false,
          infographic,
          infographicRemoved: false,
          infographicSourceWarningDismissedForIdentity: null,
          infographicStylePromptDraft: infographic?.stylePrompt ?? "",
          infographicTextDraft: infographic?.text ?? "",
          mediaType: normalizeWorkspaceSegmentMediaType(segment.mediaType),
          manualDurationSeconds,
          originalText: segment.text,
          originalTextByLanguage: {
            [sourceLanguage]: segment.text,
          },
          photoAnimationSourceAsset: null,
          sceneSoundAsset,
          sceneSoundGeneratedFromPrompt: null,
          sceneSoundPrompt: "",
          sceneSoundPromptInitialized: Boolean(sceneSoundAsset),
          sceneSoundReset: false,
          subtitleColor: getWorkspaceSegmentSubtitleColorOverrideId(segment),
          subtitleStyle: getWorkspaceSegmentSubtitleStyleOverrideId(segment),
          subtitleType: getWorkspaceSegmentSubtitleTypeOverrideId(segment),
          textByLanguage: {
            [sourceLanguage]: segment.text,
          },
          voiceLanguage:
            normalizeStudioLanguageValue(segment.voiceLanguage ?? segment.voice_language) ??
            (voiceoverAsset || hasProjectVoiceoverTiming
              ? normalizeStudioLanguageValue(segment.voiceoverLanguage) ?? sourceLanguage
              : null),
          voice_language:
            normalizeStudioLanguageValue(segment.voiceLanguage ?? segment.voice_language) ??
            (voiceoverAsset || hasProjectVoiceoverTiming
              ? normalizeStudioLanguageValue(segment.voiceoverLanguage) ?? sourceLanguage
              : null),
          voiceoverAsset,
          voiceoverLanguage: segment.voiceoverLanguage ?? (voiceoverAsset || hasProjectVoiceoverTiming ? sourceLanguage : null),
          voiceoverTextHash:
            segment.voiceoverTextHash ??
            (voiceoverAsset || hasProjectVoiceoverTiming ? getWorkspaceSegmentVoiceoverTextHash(segment.text) : null),
          voiceoverVoiceType:
            segment.voiceoverVoiceType ??
            (voiceoverAsset || hasProjectVoiceoverTiming
              ? voiceOverrideId ?? normalizedSession.voiceType
              : null),
          videoAction: isPersistedTalkingPhotoSegment ? "talking_photo" : "original",
          voiceType: voiceOverrideId,
          voice_type: voiceOverrideId,
          visualReset: false,
        };
      }),
      normalizedSession,
    ),
  };
};

export const getWorkspaceSegmentEditorMusicStateKey = (
  session: Pick<
    WorkspaceSegmentEditorSession,
    "customMusicAssetId" | "customMusicFileName" | "musicAssetId" | "musicName" | "musicType"
  >,
) => {
  const musicType = normalizeWorkspaceSegmentEditorSetting(session.musicType) ?? "ai";
  const musicAssetId =
    Number.isFinite(Number(session.musicAssetId)) && Number(session.musicAssetId) > 0
      ? String(Math.trunc(Number(session.musicAssetId)))
      : "";
  const musicName = String(session.musicName ?? "").replace(/\s+/g, " ").trim();
  if (musicType !== "custom") {
    return `${musicType}:${musicAssetId}:${musicName}`;
  }

  const customMusicAssetId =
    Number.isFinite(Number(session.customMusicAssetId)) && Number(session.customMusicAssetId) > 0
      ? String(Math.trunc(Number(session.customMusicAssetId)))
      : "";
  const customMusicFileName = String(session.customMusicFileName ?? "").replace(/\s+/g, " ").trim();

  return `${musicType}:${musicAssetId}:${musicName}:${customMusicAssetId}:${customMusicFileName}`;
};

export const areWorkspaceSegmentEditorMusicStatesEqual = (
  left: Pick<
    WorkspaceSegmentEditorSession,
    "customMusicAssetId" | "customMusicFileName" | "musicAssetId" | "musicName" | "musicType"
  >,
  right: Pick<
    WorkspaceSegmentEditorSession,
    "customMusicAssetId" | "customMusicFileName" | "musicAssetId" | "musicName" | "musicType"
  >,
) => getWorkspaceSegmentEditorMusicStateKey(left) === getWorkspaceSegmentEditorMusicStateKey(right);

export const shouldPromoteFreshServerVideoToPhotoAnimation = (
  liveSegment: WorkspaceSegmentEditorDraftSegment,
  freshSegment: WorkspaceSegmentEditorSegment,
) => {
  if (freshSegment.mediaType !== "video") {
    return false;
  }

  if (!["ai_photo", "image_edit", "original", "photo_animation", "talking_photo"].includes(liveSegment.videoAction)) {
    return false;
  }

  const hasPhotoAnimationSource =
    liveSegment.mediaType === "photo" ||
    liveSegment.videoAction === "photo_animation" ||
    liveSegment.videoAction === "talking_photo" ||
    liveSegment.aiVideoGeneratedMode === "photo_animation" ||
    liveSegment.aiVideoGeneratedMode === "talking_photo" ||
    isWorkspacePhotoAnimationMediaAsset(freshSegment.currentAsset) ||
    isWorkspaceTalkingPhotoMediaAsset(freshSegment.currentAsset) ||
    getWorkspaceSegmentCustomPreviewKind(liveSegment.aiPhotoAsset) === "image" ||
    getWorkspaceSegmentCustomPreviewKind(liveSegment.imageEditAsset) === "image" ||
    getWorkspaceSegmentCustomPreviewKind(liveSegment.photoAnimationSourceAsset) === "image";

  if (!hasPhotoAnimationSource) {
    return false;
  }

  return Boolean(
    freshSegment.currentPlaybackUrl ||
      freshSegment.currentPreviewUrl ||
      freshSegment.currentExternalPlaybackUrl ||
      freshSegment.currentExternalPreviewUrl,
  );
};

export const shouldPromoteFreshServerVideoToAiVideo = (
  liveSegment: WorkspaceSegmentEditorDraftSegment,
  freshSegment: WorkspaceSegmentEditorSegment,
) => {
  if (freshSegment.mediaType !== "video") {
    return false;
  }

  const expectsAiVideo =
    liveSegment.videoAction === "ai" ||
    liveSegment.aiVideoGeneratedMode === "ai_video";
  if (!expectsAiVideo) {
    return false;
  }

  if (isWorkspacePhotoAnimationMediaAsset(freshSegment.currentAsset)) {
    return false;
  }

  const hasAiGeneratedSource =
    freshSegment.currentSourceKind === "ai_generated" ||
    freshSegment.currentAsset?.sourceKind === "ai_generated";
  if (!hasAiGeneratedSource) {
    return false;
  }

  return Boolean(
    freshSegment.currentPlaybackUrl ||
      freshSegment.currentPreviewUrl ||
      freshSegment.currentExternalPlaybackUrl ||
      freshSegment.currentExternalPreviewUrl,
  );
};

export const createWorkspaceSegmentFreshPhotoAnimationAsset = (
  freshSegment: WorkspaceSegmentEditorSegment,
): StudioCustomVideoFile | null =>
  createStudioCustomVideoFileFromWorkspaceMediaAsset(freshSegment.currentAsset, {
    fallbackFileName: `segment-${freshSegment.index + 1}-animation.mp4`,
    fallbackMimeType: "video/mp4",
    fallbackRemoteUrl:
      freshSegment.currentPlaybackUrl ??
      freshSegment.currentExternalPlaybackUrl ??
      freshSegment.currentPreviewUrl ??
      freshSegment.currentExternalPreviewUrl,
  });

export const createWorkspaceSegmentFreshAiVideoAsset = (
  freshSegment: WorkspaceSegmentEditorSegment,
): StudioCustomVideoFile | null =>
  createStudioCustomVideoFileFromWorkspaceMediaAsset(freshSegment.currentAsset, {
    fallbackFileName: `segment-${freshSegment.index + 1}-ai-video.mp4`,
    fallbackMimeType: "video/mp4",
    fallbackRemoteUrl:
      freshSegment.currentPlaybackUrl ??
      freshSegment.currentExternalPlaybackUrl ??
      freshSegment.currentPreviewUrl ??
      freshSegment.currentExternalPreviewUrl,
    posterUrl: buildWorkspaceMediaAssetPosterUrl(freshSegment.currentAsset),
  });

const getWorkspaceSegmentRefreshGeneratedVideoMode = (
  segment:
    | Pick<WorkspaceSegmentEditorDraftSegment, "aiVideoAsset" | "aiVideoGeneratedMode" | "videoAction">
    | null
    | undefined,
): WorkspaceSegmentAiVideoMode | null => {
  if (!segment?.aiVideoAsset) {
    return null;
  }

  if (segment.videoAction === "photo_animation" || segment.aiVideoGeneratedMode === "photo_animation") {
    return "photo_animation";
  }

  if (segment.videoAction === "talking_photo" || segment.aiVideoGeneratedMode === "talking_photo") {
    return "talking_photo";
  }

  if (segment.videoAction === "ai" || segment.aiVideoGeneratedMode === "ai_video") {
    return "ai_video";
  }

  return null;
};

const getWorkspaceSegmentSessionSegmentByIndex = <
  TSegment extends Pick<WorkspaceSegmentEditorSegment, "index">,
>(
  segments: TSegment[],
  targetSegment: Pick<WorkspaceSegmentEditorSegment, "index">,
) => segments.find((segment) => segment.index === targetSegment.index) ?? null;

const isWorkspaceSegmentGeneratedVideoReflectedInRefreshSegment = (
  liveSegment: WorkspaceSegmentEditorDraftSegment,
  candidateSegment: WorkspaceSegmentEditorSegment | WorkspaceSegmentEditorDraftSegment | null | undefined,
  mode: WorkspaceSegmentAiVideoMode,
) => {
  if (!candidateSegment) {
    return false;
  }

  const candidateDraftAsset = "aiVideoAsset" in candidateSegment ? candidateSegment.aiVideoAsset : null;
  if (
    candidateDraftAsset &&
    areStudioCustomVideoFilesSameIdentity(liveSegment.aiVideoAsset, candidateDraftAsset)
  ) {
    const candidateMode = getWorkspaceSegmentRefreshGeneratedVideoMode(
      candidateSegment as WorkspaceSegmentEditorDraftSegment,
    );
    return candidateMode === mode;
  }

  if (mode === "ai_video") {
    return shouldPromoteFreshServerVideoToAiVideo(liveSegment, candidateSegment);
  }

  return shouldPromoteFreshServerVideoToPhotoAnimation(liveSegment, candidateSegment);
};

const getWorkspaceSegmentRefreshVoiceoverAsset = (
  candidateSegment: WorkspaceSegmentEditorSegment | WorkspaceSegmentEditorDraftSegment | null | undefined,
) => {
  if (!candidateSegment) {
    return null;
  }

  const candidateDraftAsset = "voiceoverAsset" in candidateSegment ? candidateSegment.voiceoverAsset : null;
  return candidateDraftAsset ?? createWorkspaceSegmentVoiceoverAsset(candidateSegment, candidateSegment.index);
};

const isWorkspaceSegmentVoiceoverReflectedInRefreshSegment = (
  liveSegment: WorkspaceSegmentEditorDraftSegment,
  candidateSegment: WorkspaceSegmentEditorSegment | WorkspaceSegmentEditorDraftSegment | null | undefined,
) =>
  areStudioCustomVideoFilesSameIdentity(
    liveSegment.voiceoverAsset,
    getWorkspaceSegmentRefreshVoiceoverAsset(candidateSegment),
  );

export const hasWorkspaceSegmentEditorUnreflectedLiveGeneratedVideo = (
  liveDraft: WorkspaceSegmentEditorDraftSession,
  freshSession: WorkspaceSegmentEditorSession,
  baselineSession?: WorkspaceSegmentEditorDraftSession | WorkspaceSegmentEditorSession | null,
) =>
  liveDraft.segments.some((liveSegment) => {
    const mode = getWorkspaceSegmentRefreshGeneratedVideoMode(liveSegment);
    if (!mode || !getWorkspaceSegmentDisplayAiVideoAssetUrl(liveSegment, mode)) {
      return false;
    }

    const baselineSegment = baselineSession
      ? getWorkspaceSegmentSessionSegmentByIndex(baselineSession.segments, liveSegment)
      : null;
    if (isWorkspaceSegmentGeneratedVideoReflectedInRefreshSegment(liveSegment, baselineSegment, mode)) {
      return false;
    }

    const freshSegment = getWorkspaceSegmentSessionSegmentByIndex(freshSession.segments, liveSegment);
    return !isWorkspaceSegmentGeneratedVideoReflectedInRefreshSegment(liveSegment, freshSegment, mode);
  });

export const hasWorkspaceSegmentEditorUnreflectedLiveGeneratedVoiceover = (
  liveDraft: WorkspaceSegmentEditorDraftSession,
  freshSession: WorkspaceSegmentEditorSession,
  baselineSession?: WorkspaceSegmentEditorDraftSession | WorkspaceSegmentEditorSession | null,
) =>
  liveDraft.segments.some((liveSegment) => {
    if (!isWorkspaceSegmentVoiceoverAssetFresh(liveSegment, liveDraft)) {
      return false;
    }

    const baselineSegment = baselineSession
      ? getWorkspaceSegmentSessionSegmentByIndex(baselineSession.segments, liveSegment)
      : null;
    if (isWorkspaceSegmentVoiceoverReflectedInRefreshSegment(liveSegment, baselineSegment)) {
      return false;
    }

    const freshSegment = getWorkspaceSegmentSessionSegmentByIndex(freshSession.segments, liveSegment);
    return !isWorkspaceSegmentVoiceoverReflectedInRefreshSegment(liveSegment, freshSegment);
  });

export const shouldPreserveWorkspaceSegmentLiveOriginalVisualOnRefresh = (segment: WorkspaceSegmentEditorDraftSegment) =>
  segment.visualReset ||
  segment.videoAction !== "original" ||
  hasWorkspaceSegmentExplicitDraftVisual(segment) ||
  isWorkspaceSegmentCurrentVisualDifferentFromOriginal(segment);

export const isWorkspaceSegmentEditorShortPrefixStructure = (
  candidateSegmentIndexes: number[],
  sourceSegmentIndexes: number[],
) =>
  candidateSegmentIndexes.length < sourceSegmentIndexes.length &&
  candidateSegmentIndexes.every((segmentIndex, index) => segmentIndex === sourceSegmentIndexes[index]);

export const shouldPreserveWorkspaceSegmentEditorLiveStructureOnRefresh = (
  liveDraft: WorkspaceSegmentEditorDraftSession,
  freshSession: WorkspaceSegmentEditorSession,
  baselineSession?: WorkspaceSegmentEditorSession | null,
) => {
  const liveSegmentIndexes = liveDraft.segments.map((segment) => segment.index);

  if (baselineSession) {
    return hasWorkspaceSegmentEditorStructureChanged(
      liveSegmentIndexes,
      baselineSession.segments.map((segment) => segment.index),
    );
  }

  const freshSegmentIndexes = freshSession.segments.map((segment) => segment.index);
  if (isWorkspaceSegmentEditorShortPrefixStructure(liveSegmentIndexes, freshSegmentIndexes)) {
    return false;
  }

  return hasWorkspaceSegmentEditorStructureChanged(liveSegmentIndexes, freshSegmentIndexes);
};

export const mergeWorkspaceSegmentEditorDraftSegmentWithFreshSession = (
  liveSegment: WorkspaceSegmentEditorDraftSegment,
  freshSegment: WorkspaceSegmentEditorSegment,
  fallbackLanguage: StudioLanguage = "ru",
  fallbackVoiceType?: string | null,
  fallbackTtsAssetId?: number | null,
  baselineSegment?: WorkspaceSegmentEditorSegment | null,
  options?: { preserveUnbaselinedManualDuration?: boolean },
): WorkspaceSegmentEditorDraftSegment => {
  const normalizedFreshSegment = normalizeWorkspaceSegmentEditorSegmentUrls(freshSegment);
  const normalizedFreshDraftSegment = normalizedFreshSegment as Partial<WorkspaceSegmentEditorDraftSegment>;
  if (isWorkspaceSegmentEditorDraftSegmentEmpty(liveSegment)) {
    return cloneWorkspaceSegmentEditorDraftSegment(liveSegment, fallbackLanguage);
  }

  const shouldUseFreshServerVideo =
    !liveSegment.visualReset && shouldPromoteFreshServerVideoToPhotoAnimation(liveSegment, normalizedFreshSegment);
  const shouldUseFreshServerAiVideo =
    !liveSegment.visualReset && shouldPromoteFreshServerVideoToAiVideo(liveSegment, normalizedFreshSegment);
  const freshServerVideoMode: WorkspaceSegmentAiVideoMode =
    liveSegment.videoAction === "talking_photo" ||
    liveSegment.aiVideoGeneratedMode === "talking_photo" ||
    isWorkspaceTalkingPhotoMediaAsset(normalizedFreshSegment.currentAsset)
      ? "talking_photo"
      : "photo_animation";
  const freshPhotoAnimationAsset = shouldUseFreshServerVideo
    ? createWorkspaceSegmentFreshPhotoAnimationAsset(normalizedFreshSegment)
    : null;
  const freshAiVideoAsset = shouldUseFreshServerAiVideo
    ? createWorkspaceSegmentFreshAiVideoAsset(normalizedFreshSegment)
    : null;
  const freshSceneSoundAsset = createWorkspaceSegmentSceneSoundAsset(normalizedFreshSegment, normalizedFreshSegment.index);
  const freshSceneSoundAssetId = getWorkspaceSegmentSceneSoundStateAssetId(normalizedFreshDraftSegment);
  const freshSceneSoundPayload =
    cloneWorkspaceSegmentSceneSoundPayload(normalizedFreshDraftSegment.scene_sound) ??
    buildWorkspaceSegmentSceneSoundPayloadFromAsset(freshSceneSoundAsset, freshSceneSoundAssetId);
  const freshVoiceoverAsset = createWorkspaceSegmentVoiceoverAsset(normalizedFreshSegment, normalizedFreshSegment.index);
  const freshSpeechWordsRange = (() => {
    const speechWords = Array.isArray(normalizedFreshSegment.speechWords) ? normalizedFreshSegment.speechWords : [];
    const firstSpeechWord = speechWords[0] ?? null;
    const lastSpeechWord = speechWords[speechWords.length - 1] ?? null;
    const startTime = normalizeWorkspaceSegmentVoicePreviewTime(firstSpeechWord?.startTime);
    const endTime = normalizeWorkspaceSegmentVoicePreviewTime(lastSpeechWord?.endTime);
    return startTime !== null && endTime !== null && endTime > startTime ? { endTime, startTime } : null;
  })();
  const freshSpeechStartTime = normalizeWorkspaceSegmentVoicePreviewTime(normalizedFreshSegment.speechStartTime);
  const freshSpeechEndTime = normalizeWorkspaceSegmentVoicePreviewTime(normalizedFreshSegment.speechEndTime);
  const freshVoiceSourceDuration = getWorkspaceSegmentVoiceSourceDurationSeconds(normalizedFreshSegment);
  const freshVoiceSourceStartTime = getWorkspaceSegmentVoiceSourceStartTime(normalizedFreshSegment);
  const freshVoiceSourceEndTime = getWorkspaceSegmentVoiceSourceEndTime(normalizedFreshSegment);
  const hasFreshProjectVoiceoverTiming =
    !freshVoiceoverAsset && hasWorkspaceSegmentProjectVoiceoverTimingData(normalizedFreshSegment);
  const baselineVoiceoverAsset = getWorkspaceSegmentRefreshVoiceoverAsset(baselineSegment);
  const shouldPreserveLiveVoiceover = Boolean(
    !freshVoiceoverAsset &&
      isWorkspaceSegmentVoiceoverAssetFresh(liveSegment, {
        language: fallbackLanguage,
        ttsAssetId: fallbackTtsAssetId,
        voiceType: fallbackVoiceType ?? "",
      }) &&
      !areStudioCustomVideoFilesSameIdentity(liveSegment.voiceoverAsset, baselineVoiceoverAsset),
  );
  const shouldUseFreshProjectVoiceoverTiming = hasFreshProjectVoiceoverTiming && !shouldPreserveLiveVoiceover;
  const freshProjectVoiceoverDurationCandidates = shouldUseFreshProjectVoiceoverTiming
    ? [
        freshVoiceSourceDuration,
        normalizeWorkspaceSegmentManualDurationSeconds(normalizedFreshSegment.speechDuration),
        freshSpeechWordsRange !== null ? freshSpeechWordsRange.endTime - freshSpeechWordsRange.startTime : null,
        freshSpeechStartTime !== null && freshSpeechEndTime !== null ? freshSpeechEndTime - freshSpeechStartTime : null,
      ].filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)
    : [];
  const freshProjectVoiceoverDuration =
    freshProjectVoiceoverDurationCandidates.length > 0
      ? Math.max(...freshProjectVoiceoverDurationCandidates)
      : null;
  const liveDurationMode = normalizeWorkspaceSegmentDurationMode(liveSegment.durationMode);
  const liveManualDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(liveSegment.manualDurationSeconds);
  const liveSlotDurationSeconds = getWorkspaceSegmentCanonicalSlotDurationSeconds(liveSegment);
  const freshSlotDurationSeconds =
    normalizeWorkspaceSegmentManualDurationSeconds(normalizedFreshSegment.manualDurationSeconds) ??
    normalizeWorkspaceSegmentManualDurationSeconds(normalizedFreshSegment.duration);
  const liveDurationExtensionSourceDurationSeconds =
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(liveSegment);
  const freshDurationExtensionSourceDurationSeconds =
    getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(normalizedFreshSegment);
  const freshManualDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(
    normalizedFreshSegment.manualDurationSeconds,
  );
  const liveVoiceSourceDuration = getWorkspaceSegmentVoiceSourceDurationSeconds(liveSegment);
  const hasUserSelectedLiveDuration = liveSegment.durationSyncModeUserSelected === true;
  const shouldAdoptFreshProjectVoiceoverSourceDuration =
    shouldUseFreshProjectVoiceoverTiming &&
    freshVoiceSourceDuration !== null &&
    !hasUserSelectedLiveDuration &&
    (liveVoiceSourceDuration === null ||
      !areWorkspaceSegmentDurationValuesEqual(liveVoiceSourceDuration, freshVoiceSourceDuration) ||
      (liveSlotDurationSeconds !== null &&
        !areWorkspaceSegmentDurationValuesEqual(liveSlotDurationSeconds, freshVoiceSourceDuration)));
  const shouldAdoptFreshVideoSourceDuration =
    liveSegment.durationSyncModeUserSelected !== true &&
    getWorkspaceSegmentSelectedVisualPreviewKind(liveSegment) === "video" &&
    normalizeWorkspaceSegmentMediaType(normalizedFreshSegment.mediaType) === "video" &&
    liveSlotDurationSeconds !== null &&
    freshSlotDurationSeconds !== null &&
    !areWorkspaceSegmentDurationValuesEqual(freshSlotDurationSeconds, liveSlotDurationSeconds);
  const shouldAdoptFreshShorterServerSceneDuration =
    liveSegment.durationSyncModeUserSelected !== true &&
    liveDurationMode === "manual" &&
    liveManualDurationSeconds !== null &&
    liveDurationExtensionSourceDurationSeconds !== null &&
    freshManualDurationSeconds !== null &&
    freshDurationExtensionSourceDurationSeconds !== null &&
    areWorkspaceSegmentDurationValuesEqual(liveManualDurationSeconds, liveDurationExtensionSourceDurationSeconds) &&
    areWorkspaceSegmentDurationValuesEqual(
      liveDurationExtensionSourceDurationSeconds,
      freshDurationExtensionSourceDurationSeconds,
    ) &&
    freshManualDurationSeconds + WORKSPACE_SEGMENT_EXTENSION_EPSILON_SECONDS < liveManualDurationSeconds;
  const shouldPreserveLiveDuration =
    !shouldAdoptFreshProjectVoiceoverSourceDuration &&
    !shouldAdoptFreshVideoSourceDuration &&
    !shouldAdoptFreshShorterServerSceneDuration &&
    (hasUserSelectedLiveDuration ||
      (baselineSegment
        ? isWorkspaceSegmentDraftDurationEdited(liveSegment, baselineSegment)
        : options?.preserveUnbaselinedManualDuration !== false &&
          (liveDurationMode === "manual" || liveManualDurationSeconds !== null)));
  const nextDurationExtensionSourceDurationSeconds =
    shouldAdoptFreshProjectVoiceoverSourceDuration
      ? null
      : shouldPreserveLiveDuration
      ? liveDurationExtensionSourceDurationSeconds
      : freshDurationExtensionSourceDurationSeconds !== null && !hasWorkspaceSegmentExplicitDraftVisual(liveSegment)
        ? freshDurationExtensionSourceDurationSeconds
        : liveDurationExtensionSourceDurationSeconds;
  const currentVisualSegment = liveSegment.visualReset ? liveSegment : normalizedFreshSegment;
  const originalVisualSegment = shouldPreserveWorkspaceSegmentLiveOriginalVisualOnRefresh(liveSegment)
    ? liveSegment
    : normalizedFreshSegment;
  const liveVoiceOverrideId = getWorkspaceSegmentVoiceOverrideId(liveSegment);
  const freshVoiceOverrideId = getWorkspaceSegmentVoiceOverrideId(normalizedFreshSegment);
  const voiceOverrideId = resolveWorkspaceSegmentProjectVoiceoverVoiceOverrideId(
    {
      ...normalizedFreshSegment,
      voiceType: liveVoiceOverrideId ?? freshVoiceOverrideId,
    },
    {
      hasProjectVoiceoverTiming: shouldUseFreshProjectVoiceoverTiming,
      sessionTtsAssetId: fallbackTtsAssetId,
      sessionVoiceType: fallbackVoiceType,
      voiceoverAsset: shouldPreserveLiveVoiceover ? liveSegment.voiceoverAsset : freshVoiceoverAsset,
    },
  );
  const liveSceneSoundAsset =
    cloneStudioCustomVideoFile(liveSegment.sceneSoundAsset) ??
    cloneStudioCustomVideoFile(liveSegment.sceneSound ?? null);
  const shouldPreserveSceneSoundReset = liveSegment.sceneSoundReset === true;
  const nextSceneSoundAsset = shouldPreserveSceneSoundReset
    ? null
    : freshSceneSoundAsset ?? liveSceneSoundAsset;
  const nextSceneSoundAssetId =
    shouldPreserveSceneSoundReset
      ? null
      : freshSceneSoundAssetId ??
        getWorkspaceSegmentSceneSoundStateAssetId(liveSegment) ??
        null;
  const nextSceneSoundPayload =
    shouldPreserveSceneSoundReset
      ? null
      : freshSceneSoundPayload ??
        cloneWorkspaceSegmentSceneSoundPayload(liveSegment.scene_sound) ??
        buildWorkspaceSegmentSceneSoundPayloadFromAsset(nextSceneSoundAsset, nextSceneSoundAssetId);
  const freshInfographic = normalizeWorkspaceSegmentInfographic(normalizedFreshSegment.infographic);
  const baselineInfographic = normalizeWorkspaceSegmentInfographic(baselineSegment?.infographic);
  const shouldPreserveLiveInfographic = Boolean(
    liveSegment.infographicRemoved ||
      (baselineSegment
        ? !areWorkspaceSegmentInfographicsEqual(liveSegment.infographic, baselineInfographic)
        : liveSegment.infographic),
  );
  const nextInfographic = shouldPreserveLiveInfographic
    ? cloneWorkspaceSegmentInfographic(liveSegment.infographic)
    : freshInfographic;
  const nextVoiceLanguage = freshVoiceoverAsset || shouldUseFreshProjectVoiceoverTiming
    ? normalizeStudioLanguageValue(normalizedFreshSegment.voiceLanguage ?? normalizedFreshSegment.voice_language) ??
      normalizeStudioLanguageValue(normalizedFreshSegment.voiceoverLanguage) ??
      fallbackLanguage
    : normalizeStudioLanguageValue(liveSegment.voiceLanguage ?? liveSegment.voice_language) ??
      (liveSegment.voiceoverAsset ? normalizeStudioLanguageValue(liveSegment.voiceoverLanguage) : null);

  return {
    ...normalizedFreshSegment,
    aiPhotoAsset: cloneStudioCustomVideoFile(liveSegment.aiPhotoAsset),
    aiPhotoGeneratedFromPrompt: liveSegment.aiPhotoGeneratedFromPrompt,
    aiPhotoPrompt: liveSegment.aiPhotoPrompt,
    aiPhotoPromptInitialized: liveSegment.aiPhotoPromptInitialized,
    aiVideoAsset: shouldUseFreshServerVideo
      ? freshPhotoAnimationAsset ?? cloneStudioCustomVideoFile(liveSegment.aiVideoAsset)
      : shouldUseFreshServerAiVideo
        ? freshAiVideoAsset ?? cloneStudioCustomVideoFile(liveSegment.aiVideoAsset)
      : cloneStudioCustomVideoFile(liveSegment.aiVideoAsset),
    aiVideoGeneratedMode: shouldUseFreshServerVideo
      ? freshServerVideoMode
      : shouldUseFreshServerAiVideo
        ? "ai_video"
        : liveSegment.aiVideoGeneratedMode,
    aiVideoGeneratedFromPrompt: liveSegment.aiVideoGeneratedFromPrompt,
    aiVideoPrompt: liveSegment.aiVideoPrompt,
    aiVideoPromptInitialized: shouldUseFreshServerVideo || shouldUseFreshServerAiVideo ? true : liveSegment.aiVideoPromptInitialized,
    customVideo: cloneStudioCustomVideoFile(liveSegment.customVideo),
    currentAsset: cloneWorkspaceMediaAssetRef(currentVisualSegment.currentAsset),
    currentExternalPlaybackUrl: currentVisualSegment.currentExternalPlaybackUrl,
    currentExternalPreviewUrl: currentVisualSegment.currentExternalPreviewUrl,
    currentPlaybackUrl: currentVisualSegment.currentPlaybackUrl,
    currentPosterUrl: currentVisualSegment.currentPosterUrl,
    currentPreviewUrl: currentVisualSegment.currentPreviewUrl,
    currentSourceKind: currentVisualSegment.currentSourceKind,
    durationMode: shouldAdoptFreshProjectVoiceoverSourceDuration
      ? "auto"
      : shouldPreserveLiveDuration
      ? liveDurationMode
      : normalizeWorkspaceSegmentDurationMode(normalizedFreshSegment.durationMode),
    durationSyncMode: shouldAdoptFreshProjectVoiceoverSourceDuration
      ? "voiceover"
      : shouldPreserveLiveDuration
      ? liveSegment.durationSyncMode
      : normalizedFreshDraftSegment.durationSyncMode,
    durationSyncModeUserSelected: shouldAdoptFreshProjectVoiceoverSourceDuration
      ? false
      : shouldPreserveLiveDuration
      ? liveSegment.durationSyncModeUserSelected
      : normalizedFreshDraftSegment.durationSyncModeUserSelected,
    durationExtensionSourceDurationSeconds: nextDurationExtensionSourceDurationSeconds,
    imageEditAsset: cloneStudioCustomVideoFile(liveSegment.imageEditAsset),
    imageEditGeneratedFromPrompt: liveSegment.imageEditGeneratedFromPrompt,
    imageEditPrompt: liveSegment.imageEditPrompt,
    imageEditPromptInitialized: liveSegment.imageEditPromptInitialized,
    infographic: nextInfographic,
    infographicRemoved: shouldPreserveLiveInfographic ? liveSegment.infographicRemoved : false,
    infographicSourceWarningDismissedForIdentity: liveSegment.infographicSourceWarningDismissedForIdentity,
    infographicStylePromptDraft: liveSegment.infographicStylePromptDraft,
    infographicTextDraft: liveSegment.infographicTextDraft,
    manualDurationSeconds: shouldAdoptFreshProjectVoiceoverSourceDuration
      ? null
      : shouldPreserveLiveDuration
      ? liveManualDurationSeconds
      : normalizeWorkspaceSegmentManualDurationSeconds(normalizedFreshSegment.manualDurationSeconds),
    mediaType: liveSegment.visualReset ? liveSegment.mediaType : normalizedFreshSegment.mediaType,
    originalText: liveSegment.originalText,
    originalTextByLanguage: cloneWorkspaceSegmentEditorLocalizedTextMap(
      liveSegment.originalTextByLanguage,
      liveSegment.originalText,
      fallbackLanguage,
    ),
    originalAsset: cloneWorkspaceMediaAssetRef(originalVisualSegment.originalAsset),
    originalExternalPlaybackUrl: originalVisualSegment.originalExternalPlaybackUrl,
    originalExternalPreviewUrl: originalVisualSegment.originalExternalPreviewUrl,
    originalPlaybackUrl: originalVisualSegment.originalPlaybackUrl,
    originalPosterUrl: originalVisualSegment.originalPosterUrl,
    originalPreviewUrl: originalVisualSegment.originalPreviewUrl,
    originalSourceKind: originalVisualSegment.originalSourceKind,
    photoAnimationSourceAsset: cloneStudioCustomVideoFile(liveSegment.photoAnimationSourceAsset),
    sceneSound: cloneStudioCustomVideoFile(nextSceneSoundAsset),
    sceneSoundAsset: nextSceneSoundAsset,
    sceneSoundAssetId: nextSceneSoundAssetId,
    scene_sound: nextSceneSoundPayload,
    scene_sound_asset_id: nextSceneSoundAssetId ?? nextSceneSoundPayload?.media_asset_id ?? null,
    sceneSoundGeneratedFromPrompt: liveSegment.sceneSoundGeneratedFromPrompt,
    sceneSoundPrompt: liveSegment.sceneSoundPrompt,
    sceneSoundPromptInitialized: shouldPreserveSceneSoundReset
      ? false
      : freshSceneSoundAsset
        ? true
        : liveSegment.sceneSoundPromptInitialized,
    sceneSoundReset: shouldPreserveSceneSoundReset,
    speechDuration: shouldPreserveLiveVoiceover
      ? liveSegment.speechDuration
      : freshProjectVoiceoverDuration ?? normalizedFreshSegment.speechDuration,
    speechDurationSource: shouldPreserveLiveVoiceover
      ? liveSegment.speechDurationSource ?? null
      : freshProjectVoiceoverDuration !== null
        ? "audio"
        : normalizedFreshSegment.speechDurationSource ?? null,
    speechEndTime: shouldPreserveLiveVoiceover ? liveSegment.speechEndTime : normalizedFreshSegment.speechEndTime,
    speechStartTime: shouldPreserveLiveVoiceover ? liveSegment.speechStartTime : normalizedFreshSegment.speechStartTime,
    speechWords: shouldPreserveLiveVoiceover
      ? liveSegment.speechWords.map((word) => ({ ...word }))
      : normalizedFreshSegment.speechWords.map((word) => ({ ...word })),
    voiceSourceDuration: shouldPreserveLiveVoiceover ? liveSegment.voiceSourceDuration : freshVoiceSourceDuration,
    voiceSourceEndTime: shouldPreserveLiveVoiceover ? liveSegment.voiceSourceEndTime : freshVoiceSourceEndTime,
    voiceSourceStartTime: shouldPreserveLiveVoiceover ? liveSegment.voiceSourceStartTime : freshVoiceSourceStartTime,
    subtitleColor: getWorkspaceSegmentSubtitleColorOverrideId(liveSegment),
    subtitleStyle: getWorkspaceSegmentSubtitleStyleOverrideId(liveSegment),
    subtitleType: getWorkspaceSegmentSubtitleTypeOverrideId(liveSegment),
    text: liveSegment.text,
    textByLanguage: cloneWorkspaceSegmentEditorLocalizedTextMap(
      liveSegment.textByLanguage,
      liveSegment.text,
      fallbackLanguage,
    ),
    voiceLanguage: nextVoiceLanguage,
    voice_language: nextVoiceLanguage,
    voiceoverAsset: freshVoiceoverAsset ?? (shouldUseFreshProjectVoiceoverTiming ? null : cloneStudioCustomVideoFile(liveSegment.voiceoverAsset)),
    voiceoverLanguage: freshVoiceoverAsset || shouldUseFreshProjectVoiceoverTiming
      ? normalizedFreshSegment.voiceoverLanguage ?? fallbackLanguage
      : liveSegment.voiceoverLanguage,
    voiceoverTextHash: freshVoiceoverAsset || shouldUseFreshProjectVoiceoverTiming
      ? normalizedFreshSegment.voiceoverTextHash ?? getWorkspaceSegmentVoiceoverTextHash(liveSegment.text)
      : liveSegment.voiceoverTextHash,
    voiceoverVoiceType: freshVoiceoverAsset || shouldUseFreshProjectVoiceoverTiming
      ? normalizedFreshSegment.voiceoverVoiceType ??
        voiceOverrideId ??
        normalizeWorkspaceSegmentEditorSetting(fallbackVoiceType) ??
        null
      : liveSegment.voiceoverVoiceType,
    videoAction: shouldUseFreshServerVideo
      ? freshServerVideoMode === "talking_photo"
        ? "talking_photo"
        : "photo_animation"
      : shouldUseFreshServerAiVideo
        ? "ai"
        : liveSegment.videoAction,
    voiceType: voiceOverrideId,
    voice_type: voiceOverrideId,
    visualReset: liveSegment.visualReset,
  };
};

export const refreshWorkspaceSegmentEditorDraftWithFreshSession = (
  liveDraft: WorkspaceSegmentEditorDraftSession,
  freshSession: WorkspaceSegmentEditorSession,
  options?: {
    baselineSession?: WorkspaceSegmentEditorSession | null;
    preserveUnbaselinedManualDuration?: boolean;
    preserveLiveStructure?: boolean;
  },
): WorkspaceSegmentEditorDraftSession => {
  const normalizedFreshSession = normalizeWorkspaceSegmentEditorSessionVoiceInheritance(
    normalizeWorkspaceSegmentEditorSession(freshSession),
  );
  const fallbackLanguage =
    normalizeStudioLanguageValue(liveDraft.language) ??
    normalizeStudioLanguageValue(normalizedFreshSession.language) ??
    getStudioLanguageForVoiceId(liveDraft.voiceType || normalizedFreshSession.voiceType) ??
    "ru";
  const normalizedLiveMusicState = sanitizeWorkspaceSegmentEditorCustomMusicState(liveDraft, {
    allowEphemeralCustomMusic: true,
  });
  const normalizedBaselineSession =
    options?.baselineSession && options.baselineSession.projectId === liveDraft.projectId
      ? normalizeWorkspaceSegmentEditorSessionVoiceInheritance(normalizeWorkspaceSegmentEditorSession(options.baselineSession))
      : null;
  const liveVoiceType = normalizeWorkspaceSegmentEditorSetting(liveDraft.voiceType) ?? "";
  const freshVoiceType = normalizeWorkspaceSegmentEditorSetting(normalizedFreshSession.voiceType) ?? "";
  const baselineVoiceType = normalizeWorkspaceSegmentEditorSetting(normalizedBaselineSession?.voiceType) ?? "";
  const freshTtsAssetId = getPositiveWorkspaceMediaAssetId(normalizedFreshSession.ttsAssetId);
  const baselineTtsAssetId = getPositiveWorkspaceMediaAssetId(normalizedBaselineSession?.ttsAssetId);
  const hasFreshProjectVoiceoverTiming =
    freshTtsAssetId !== null && normalizedFreshSession.segments.some(hasWorkspaceSegmentProjectVoiceoverTimingData);
  const hasLiveVoiceEdit = Boolean(normalizedBaselineSession) && liveVoiceType !== baselineVoiceType;
  const hasFreshVoiceUpdate =
    Boolean(freshVoiceType) &&
    (hasFreshProjectVoiceoverTiming ||
      freshTtsAssetId !== baselineTtsAssetId ||
      (Boolean(normalizedBaselineSession) && freshVoiceType !== baselineVoiceType));
  const shouldAdoptFreshVoiceState = hasFreshVoiceUpdate && !hasLiveVoiceEdit;
  const nextVoiceType = shouldAdoptFreshVoiceState ? normalizedFreshSession.voiceType : liveDraft.voiceType;
  const nextLanguage = shouldAdoptFreshVoiceState ? normalizedFreshSession.language : liveDraft.language;
  const shouldPreserveLiveMusicState = normalizedBaselineSession
    ? !areWorkspaceSegmentEditorMusicStatesEqual(normalizedLiveMusicState, normalizedBaselineSession)
    : !areWorkspaceSegmentEditorMusicStatesEqual(normalizedLiveMusicState, normalizedFreshSession);
  const nextMusicState = shouldPreserveLiveMusicState ? normalizedLiveMusicState : normalizedFreshSession;
  const shouldPreserveLiveStructure =
    Boolean(options?.preserveLiveStructure) ||
    shouldPreserveWorkspaceSegmentEditorLiveStructureOnRefresh(
      liveDraft,
      normalizedFreshSession,
      normalizedBaselineSession,
    );
  const freshSegmentsByIndex = new Map(normalizedFreshSession.segments.map((segment) => [segment.index, segment] as const));
  const baselineSegmentsByIndex = new Map(
    (normalizedBaselineSession?.segments ?? []).map((segment) => [segment.index, segment] as const),
  );
  const mergedSegments: WorkspaceSegmentEditorDraftSegment[] = [];
  const handledSegmentIndexes = new Set<number>();

  liveDraft.segments.forEach((segment) => {
    const freshSegment = freshSegmentsByIndex.get(segment.index);
    if (!freshSegment) {
      mergedSegments.push(cloneWorkspaceSegmentEditorDraftSegment(segment, fallbackLanguage));
      return;
    }

    handledSegmentIndexes.add(segment.index);
    mergedSegments.push(
      mergeWorkspaceSegmentEditorDraftSegmentWithFreshSession(
        segment,
        freshSegment,
        fallbackLanguage,
        nextVoiceType,
        normalizedFreshSession.ttsAssetId,
        baselineSegmentsByIndex.get(segment.index) ?? null,
        {
          preserveUnbaselinedManualDuration: options?.preserveUnbaselinedManualDuration,
        },
      ),
    );
  });

  if (!shouldPreserveLiveStructure) {
    normalizedFreshSession.segments.forEach((segment) => {
      if (handledSegmentIndexes.has(segment.index)) {
        return;
      }

      mergedSegments.push(createWorkspaceSegmentEditorDraftSession({
        ...normalizedFreshSession,
        segments: [segment],
      }).segments[0]);
    });
  }

  return rebuildWorkspaceSegmentEditorDraftSessionTimeline({
    ...normalizedFreshSession,
    customMusicAssetId: nextMusicState.customMusicAssetId ?? null,
    customMusicFileName: nextMusicState.customMusicFileName ?? null,
    description: liveDraft.description,
    language: nextLanguage,
    musicAssetId: nextMusicState.musicAssetId ?? null,
    musicName: nextMusicState.musicName ?? null,
    musicType: nextMusicState.musicType,
    segments: mergedSegments,
    subtitleColor: liveDraft.subtitleColor,
    subtitleStyle: liveDraft.subtitleStyle,
    subtitleType: liveDraft.subtitleType,
    title: liveDraft.title,
    voiceType: nextVoiceType,
  });
};

export const createWorkspaceSegmentEditorResetDraftFromBaseline = (
  _draft: WorkspaceSegmentEditorDraftSession,
  baseline: WorkspaceSegmentEditorDraftSession,
): WorkspaceSegmentEditorDraftSession => cloneWorkspaceSegmentEditorDraftSession(baseline);

export const getWorkspaceSegmentEditorNextSegmentIndex = (
  segments: WorkspaceSegmentEditorDraftSegment[],
  reservedSegmentIndexes: readonly number[] = [],
) => {
  const maxExistingIndex = [...segments.map((segment) => segment.index), ...reservedSegmentIndexes]
    .filter((segmentIndex) => Number.isInteger(segmentIndex) && segmentIndex >= 0)
    .reduce((maxIndex, segmentIndex) => Math.max(maxIndex, segmentIndex), -1);

  return maxExistingIndex + 1;
};

export const getWorkspaceSegmentEditorReservedSegmentIndexes = (
  ...sessions: Array<Pick<WorkspaceSegmentEditorDraftSession, "segments"> | null | undefined>
) =>
  Array.from(
    new Set(
      sessions
        .flatMap((session) => session?.segments.map((segment) => segment.index) ?? [])
        .filter((segmentIndex) => Number.isInteger(segmentIndex) && segmentIndex >= 0),
    ),
  );

export const getWorkspaceSegmentEditorInsertedSegmentTiming = (
  segments: WorkspaceSegmentEditorDraftSegment[],
  insertAt: number,
) => {
  const previousSegment = insertAt > 0 ? segments[insertAt - 1] ?? null : null;
  const startTime = previousSegment ? getWorkspaceSegmentEditorDisplayEndTime(previousSegment) : 0;

  return {
    duration: 0,
    endTime: startTime,
    startTime,
  };
};

export const createWorkspaceSegmentEditorInsertedSegment = (options: {
  draft: WorkspaceSegmentEditorDraftSession;
  insertAt: number;
  reservedSegmentIndexes?: readonly number[];
  sourceSegment?: WorkspaceSegmentEditorDraftSegment | null;
}): WorkspaceSegmentEditorDraftSegment => {
  const { draft, insertAt } = options;
  const nextIndex = getWorkspaceSegmentEditorNextSegmentIndex(draft.segments, options.reservedSegmentIndexes);
  const baseText = "";
  const fallbackLanguage = getWorkspaceSegmentEditorSessionLanguage(draft);
  const textByLanguage = cloneWorkspaceSegmentEditorLocalizedTextMap(null, baseText, fallbackLanguage);
  const { duration, endTime, startTime } = getWorkspaceSegmentEditorInsertedSegmentTiming(draft.segments, insertAt);

  return {
    aiPhotoAsset: null,
    aiPhotoGeneratedFromPrompt: null,
    aiPhotoPrompt: "",
    aiPhotoPromptInitialized: false,
    aiVideoAsset: null,
    aiVideoGeneratedMode: null,
    aiVideoGeneratedFromPrompt: null,
    aiVideoPrompt: "",
    aiVideoPromptInitialized: false,
    currentAsset: null,
    currentExternalPlaybackUrl: null,
    currentExternalPreviewUrl: null,
    currentPlaybackUrl: null,
    currentPosterUrl: null,
    currentPreviewUrl: null,
    currentSourceKind: "unknown",
    customVideo: null,
    duration,
    durationExtensionSourceDurationSeconds: null,
    durationMode: "auto",
    endTime,
    index: nextIndex,
    imageEditAsset: null,
    imageEditGeneratedFromPrompt: null,
    imageEditPrompt: "",
    imageEditPromptInitialized: false,
    infographic: null,
    infographicRemoved: false,
    infographicSourceWarningDismissedForIdentity: null,
    infographicStylePromptDraft: "",
    infographicTextDraft: "",
    manualDurationSeconds: null,
    mediaType: "video",
    originalAsset: null,
    originalExternalPlaybackUrl: null,
    originalExternalPreviewUrl: null,
    originalPlaybackUrl: null,
    originalPosterUrl: null,
    originalPreviewUrl: null,
    originalSourceKind: "unknown",
    originalText: baseText,
    originalTextByLanguage: { ...textByLanguage },
    photoAnimationSourceAsset: null,
    sceneSound: null,
    sceneSoundAsset: null,
    sceneSoundAssetId: null,
    scene_sound: null,
    scene_sound_asset_id: null,
    sceneSoundGeneratedFromPrompt: null,
    sceneSoundPrompt: "",
    sceneSoundPromptInitialized: false,
    speechDuration: null,
    speechDurationSource: null,
    speechEndTime: null,
    speechStartTime: null,
    speechWords: [],
    voiceSourceDuration: null,
    voiceSourceEndTime: null,
    voiceSourceStartTime: null,
    startTime,
    subtitleColor: null,
    subtitleStyle: null,
    subtitleType: null,
    text: baseText,
    textByLanguage: { ...textByLanguage },
    voiceLanguage: null,
    voice_language: null,
    voiceoverAsset: null,
    voiceoverLanguage: null,
    voiceoverTextHash: null,
    voiceoverVoiceType: null,
    videoAction: "original",
    visualReset: false,
  };
};

export const createWorkspaceSegmentEditorScratchDraftSession = (options?: {
  description?: string;
  language?: StudioLanguage;
  title?: string;
}): WorkspaceSegmentEditorDraftSession => {
  const language = normalizeStudioLanguageValue(options?.language) ?? "ru";
  const description = String(options?.description ?? "").trim();
  const baseDraft: WorkspaceSegmentEditorDraftSession = {
    customMusicAssetId: null,
    customMusicFileName: null,
    description,
    draftId: createWorkspaceSegmentEditorScratchDraftId(),
    language,
    musicAssetId: null,
    musicName: null,
    musicType: "none",
    projectId: WORKSPACE_SEGMENT_EDITOR_SCRATCH_PROJECT_ID,
    segments: [],
    subtitleColor: fallbackStudioSubtitleColorOption.id,
    subtitleStyle: fallbackStudioSubtitleStyleOption.id,
    subtitleType: "none",
    title: String(options?.title ?? "").trim() || "New Shorts",
    ttsAssetId: null,
    voiceType: "none",
  };
  const firstSegment = createWorkspaceSegmentEditorInsertedSegment({
    draft: baseDraft,
    insertAt: 0,
  });

  return rebuildWorkspaceSegmentEditorDraftSessionTimeline({
    ...baseDraft,
    segments: [firstSegment],
  });
};

export const resolveWorkspaceSegmentEditorSegmentsAfterDelete = (
  draft: WorkspaceSegmentEditorDraftSession,
  targetSegmentIndex: number,
  options?: { reservedSegmentIndexes?: readonly number[] },
): WorkspaceSegmentEditorDraftSegment[] => {
  const targetSegment = draft.segments.find((segment) => segment.index === targetSegmentIndex) ?? null;
  if (!targetSegment) {
    return draft.segments;
  }

  if (draft.segments.length <= WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS) {
    if (isWorkspaceSegmentEditorDraftSegmentEmpty(targetSegment)) {
      return draft.segments;
    }

    return [
      createWorkspaceSegmentEditorInsertedSegment({
        draft,
        insertAt: 0,
        reservedSegmentIndexes: options?.reservedSegmentIndexes,
      }),
    ];
  }

  return draft.segments.filter((segment) => segment.index !== targetSegmentIndex);
};

export const shouldConfirmWorkspaceSegmentEditorSegmentDelete = (
  draft: WorkspaceSegmentEditorDraftSession | null | undefined,
  targetSegmentIndex: number | null | undefined,
) => {
  if (!draft || typeof targetSegmentIndex !== "number") {
    return false;
  }

  const targetSegment = draft.segments.find((segment) => segment.index === targetSegmentIndex) ?? null;
  return Boolean(targetSegment && !isWorkspaceSegmentEditorDraftSegmentVisualEmpty(targetSegment));
};

export const resetWorkspaceSegmentEditorDraftTrackSettingsForBlankScene = (
  draft: WorkspaceSegmentEditorDraftSession,
): WorkspaceSegmentEditorDraftSession => {
  const fallbackLanguage = getWorkspaceSegmentEditorSessionLanguage(draft);
  const emptyTextByLanguage = cloneWorkspaceSegmentEditorLocalizedTextMap(null, "", fallbackLanguage);

  return {
    ...draft,
    customMusicAssetId: null,
    customMusicFileName: null,
    musicAssetId: null,
    musicName: null,
    musicType: "none",
    segments: draft.segments.map((segment) => ({
      ...segment,
      infographic: null,
      infographicRemoved: Boolean(segment.infographic),
      infographicSourceWarningDismissedForIdentity: null,
      infographicStylePromptDraft: "",
      infographicTextDraft: "",
      originalText: "",
      originalTextByLanguage: { ...emptyTextByLanguage },
      sceneSound: null,
      sceneSoundAsset: null,
      sceneSoundAssetId: null,
      scene_sound: null,
      scene_sound_asset_id: null,
      sceneSoundGeneratedFromPrompt: null,
      sceneSoundPrompt: "",
      sceneSoundPromptInitialized: false,
      speechDuration: null,
      speechDurationSource: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      subtitleColor: null,
      subtitleStyle: null,
      subtitleType: null,
      text: "",
      textByLanguage: { ...emptyTextByLanguage },
      voiceLanguage: null,
      voice_language: null,
      voiceoverAsset: null,
      voiceoverLanguage: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
      voiceType: null,
    })),
    subtitleColor: fallbackStudioSubtitleColorOption.id,
    subtitleStyle: fallbackStudioSubtitleStyleOption.id,
    subtitleType: "none",
    ttsAssetId: null,
    voiceType: "none",
  };
};

export const shouldResetWorkspaceSegmentEditorDraftTrackSettingsForBlankScene = (
  draft: Pick<WorkspaceSegmentEditorDraftSession, "segments"> | null | undefined,
) => Boolean(draft?.segments.length === 1 && isWorkspaceSegmentEditorDraftSegmentEmpty(draft.segments[0]));

export type WorkspaceSegmentEditorCleanEmptyDraftCandidate = Pick<WorkspaceSegmentEditorDraftSession, "segments"> &
  Partial<
    Pick<
      WorkspaceSegmentEditorDraftSession,
      | "customMusicAssetId"
      | "customMusicFileName"
      | "musicAssetId"
      | "musicName"
      | "musicType"
      | "subtitleType"
      | "ttsAssetId"
      | "voiceType"
    >
  >;

export const isWorkspaceSegmentEditorCleanEmptyDraft = (
  draft: WorkspaceSegmentEditorCleanEmptyDraftCandidate | null | undefined,
) =>
  Boolean(
    draft &&
      draft.segments.length > 0 &&
      draft.segments.every(
        (segment) =>
          isWorkspaceSegmentEditorDraftSegmentEmpty(segment) &&
          !getWorkspaceSegmentVoiceOverrideId(segment) &&
          !normalizeWorkspaceSegmentEditorTextForCompare(segment.originalText) &&
          !normalizeWorkspaceSegmentEditorTextForCompare(segment.sceneSoundPrompt) &&
          !segment.sceneSoundPromptInitialized &&
          !segment.speechDuration &&
          !segment.speechEndTime &&
          !segment.speechStartTime &&
          !segment.voiceSourceDuration &&
          !segment.voiceSourceEndTime &&
          !segment.voiceSourceStartTime &&
          !getWorkspaceSegmentCustomAssetId(segment.voiceoverAsset) &&
          !normalizeWorkspaceSegmentEditorTextForCompare(segment.voiceoverTextHash ?? "") &&
          !normalizeWorkspaceSegmentEditorTextForCompare(segment.voiceoverVoiceType ?? "") &&
          !getWorkspaceSegmentSubtitleTypeOverrideId(segment) &&
          !getWorkspaceSegmentSubtitleStyleOverrideId(segment) &&
          !getWorkspaceSegmentSubtitleColorOverrideId(segment) &&
          (segment.speechWords ?? []).length === 0,
      ) &&
      (normalizeWorkspaceSegmentEditorSetting(draft.musicType) ?? "none") === "none" &&
      !getPositiveWorkspaceMediaAssetId(draft.customMusicAssetId) &&
      !String(draft.customMusicFileName ?? "").trim() &&
      !getPositiveWorkspaceMediaAssetId(draft.musicAssetId) &&
      !String(draft.musicName ?? "").trim() &&
      ["default", "none"].includes(normalizeWorkspaceSegmentEditorSetting(draft.subtitleType) ?? "default") &&
      !getPositiveWorkspaceMediaAssetId(draft.ttsAssetId) &&
      (normalizeWorkspaceSegmentEditorSetting(draft.voiceType) ?? "none") === "none",
  );

export const shouldSuppressWorkspaceSegmentEditorEmptyDraftChanges = (
  draft: WorkspaceSegmentEditorCleanEmptyDraftCandidate | null | undefined,
) =>
  Boolean(
    shouldResetWorkspaceSegmentEditorDraftTrackSettingsForBlankScene(draft) ||
      isWorkspaceSegmentEditorCleanEmptyDraft(draft),
  );

export const getWorkspaceSegmentEditorEffectiveSubtitleSelection = (
  draft:
    | (WorkspaceSegmentEditorCleanEmptyDraftCandidate &
        Pick<WorkspaceSegmentEditorDraftSession, "subtitleColor" | "subtitleStyle">)
    | null
    | undefined,
  fallbackSelection: {
    subtitleColorId: string;
    subtitleStyleId: string;
  },
) => {
  if (isWorkspaceSegmentEditorCleanEmptyDraft(draft)) {
    return {
      subtitleColorId: fallbackStudioSubtitleColorOption.id,
      subtitleStyleId: fallbackStudioSubtitleStyleOption.id,
    };
  }

  return {
    subtitleColorId:
      normalizeWorkspaceSegmentEditorSetting(draft?.subtitleColor) ??
      normalizeWorkspaceSegmentEditorSetting(fallbackSelection.subtitleColorId) ??
      fallbackStudioSubtitleColorOption.id,
    subtitleStyleId:
      normalizeWorkspaceSegmentEditorSetting(draft?.subtitleStyle) ??
      normalizeWorkspaceSegmentEditorSetting(fallbackSelection.subtitleStyleId) ??
      fallbackStudioSubtitleStyleOption.id,
  };
};

export type WorkspaceSegmentEditorCarouselSlot =
  | {
      kind: "segment";
      offset: number;
      segmentArrayIndex: number;
    }
  | {
      kind: "add";
      offset: 1;
      segmentArrayIndex: number;
    }
  | {
      kind: "empty";
      offset: number;
      segmentArrayIndex: number;
    };

export const normalizeWorkspaceSegmentEditorCarouselSegmentCount = (segmentCount: number) =>
  Number.isFinite(segmentCount) ? Math.max(0, Math.trunc(segmentCount)) : 0;

export const normalizeWorkspaceSegmentEditorCarouselActiveIndex = (
  activeSegmentIndex: number,
  segmentCount: number,
) => {
  const safeSegmentCount = normalizeWorkspaceSegmentEditorCarouselSegmentCount(segmentCount);
  const safeActiveSegmentIndex = Number.isFinite(activeSegmentIndex) ? Math.trunc(activeSegmentIndex) : 0;

  return safeSegmentCount > 0
    ? Math.max(0, Math.min(safeActiveSegmentIndex, safeSegmentCount - 1))
    : 0;
};

export const getWorkspaceSegmentEditorCarouselNavigation = (options: {
  activeSegmentIndex: number;
  segmentCount: number;
}) => {
  const segmentCount = normalizeWorkspaceSegmentEditorCarouselSegmentCount(options.segmentCount);
  const activeSegmentIndex = normalizeWorkspaceSegmentEditorCarouselActiveIndex(
    options.activeSegmentIndex,
    segmentCount,
  );

  return {
    canNavigateNext: segmentCount > 0 && activeSegmentIndex < segmentCount - 1,
    canNavigatePrevious: segmentCount > 0 && activeSegmentIndex > 0,
  };
};

export const getWorkspaceSegmentEditorCarouselSlots = (options: {
  activeSegmentIndex: number;
  canAddSegment: boolean;
  forwardPreloadCount?: number;
  segmentCount: number;
}): WorkspaceSegmentEditorCarouselSlot[] => {
  const segmentCount = normalizeWorkspaceSegmentEditorCarouselSegmentCount(options.segmentCount);
  const activeSegmentIndex = normalizeWorkspaceSegmentEditorCarouselActiveIndex(
    options.activeSegmentIndex,
    segmentCount,
  );
  const rawForwardPreloadCount = options.forwardPreloadCount;
  const forwardPreloadCount =
    typeof rawForwardPreloadCount === "number" && Number.isFinite(rawForwardPreloadCount)
      ? Math.max(1, Math.trunc(rawForwardPreloadCount))
      : 1;
  const offsets = [
    -1,
    0,
    ...Array.from({ length: forwardPreloadCount }, (_, index) => index + 1),
  ];

  return offsets.map((offset) => {
    const segmentArrayIndex = activeSegmentIndex + offset;
    if (segmentArrayIndex >= 0 && segmentArrayIndex < segmentCount) {
      return {
        kind: "segment",
        offset,
        segmentArrayIndex,
      };
    }

    if (offset > 0 && options.canAddSegment && segmentArrayIndex === segmentCount) {
      return {
        kind: "add",
        offset: 1,
        segmentArrayIndex,
      };
    }

    return {
      kind: "empty",
      offset,
      segmentArrayIndex,
    };
  });
};

export const normalizeWorkspaceSegmentEditorSession = (
  session: WorkspaceSegmentEditorSession,
): WorkspaceSegmentEditorSession => {
  const sanitizedSession = sanitizeWorkspaceSegmentEditorCustomMusicState(session);
  const language = getWorkspaceSegmentEditorSessionLanguage(sanitizedSession);
  const segments = sanitizedSession.segments.map((segment) => {
    const normalizedSegment = normalizeWorkspaceSegmentEditorSegmentUrls(segment);
    return {
      ...normalizedSegment,
      durationMode: normalizeWorkspaceSegmentDurationMode(segment.durationMode),
      manualDurationSeconds: normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds),
      mediaType: normalizeWorkspaceSegmentMediaType(segment.mediaType),
      voiceSourceDuration: getWorkspaceSegmentVoiceSourceDurationSeconds(segment),
      voiceSourceEndTime: getWorkspaceSegmentVoiceSourceEndTime(segment),
      voiceSourceStartTime: getWorkspaceSegmentVoiceSourceStartTime(segment),
      voiceType: getWorkspaceSegmentVoiceOverrideId(segment),
      voice_type: getWorkspaceSegmentVoiceOverrideId(segment),
    };
  });

  return {
    ...sanitizedSession,
    language,
    segments: repairWorkspaceSegmentEditorSpeechWordBoundaries(segments),
  };
};

export const normalizeLegacyWorkspaceSegmentEditorDraftSession = (
  session: WorkspaceSegmentEditorDraftSession,
): WorkspaceSegmentEditorDraftSession => {
  let hasChanges = false;
  const fallbackLanguage = getWorkspaceSegmentEditorSessionLanguage(session);

  const segments = session.segments.map((segment) => {
    const normalizedSegment = normalizeWorkspaceSegmentEditorSegmentUrls(segment);
    const normalizedOriginalText =
      typeof segment.originalText === "string" && segment.originalText.trim() ? segment.originalText : segment.text;
    const normalizedVideoAction: WorkspaceSegmentEditorVideoAction =
      segment.videoAction === "ai" ||
      segment.videoAction === "ai_photo" ||
      segment.videoAction === "custom" ||
      segment.videoAction === "image_edit" ||
      segment.videoAction === "talking_photo" ||
      segment.videoAction === "photo_animation"
        ? segment.videoAction
        : "original";
    const normalizedAiPhotoPrompt = typeof segment.aiPhotoPrompt === "string" ? segment.aiPhotoPrompt : "";
    const normalizedAiPhotoGeneratedFromPrompt =
      typeof segment.aiPhotoGeneratedFromPrompt === "string" && segment.aiPhotoGeneratedFromPrompt.trim()
        ? segment.aiPhotoGeneratedFromPrompt
        : null;
    const normalizedAiPhotoPromptInitialized =
      Boolean(segment.aiPhotoPromptInitialized) ||
      Boolean(normalizedAiPhotoPrompt) ||
      Boolean(normalizedAiPhotoGeneratedFromPrompt);
    const normalizedAiVideoPrompt = typeof segment.aiVideoPrompt === "string" ? segment.aiVideoPrompt : "";
    const normalizedAiVideoGeneratedFromPrompt =
      typeof segment.aiVideoGeneratedFromPrompt === "string" && segment.aiVideoGeneratedFromPrompt.trim()
        ? segment.aiVideoGeneratedFromPrompt
        : null;
    const normalizedAiVideoGeneratedMode =
      segment.aiVideoGeneratedMode === "photo_animation" ||
      segment.aiVideoGeneratedMode === "talking_photo" ||
      segment.aiVideoGeneratedMode === "ai_video"
        ? segment.aiVideoGeneratedMode
        : null;
    const normalizedAiVideoPromptInitialized =
      Boolean(segment.aiVideoPromptInitialized) ||
      Boolean(normalizedAiVideoPrompt) ||
      Boolean(normalizedAiVideoGeneratedFromPrompt);
    const normalizedImageEditPrompt = typeof segment.imageEditPrompt === "string" ? segment.imageEditPrompt : "";
    const normalizedImageEditGeneratedFromPrompt =
      typeof segment.imageEditGeneratedFromPrompt === "string" && segment.imageEditGeneratedFromPrompt.trim()
        ? segment.imageEditGeneratedFromPrompt
        : null;
    const normalizedImageEditPromptInitialized =
      Boolean(segment.imageEditPromptInitialized) ||
      Boolean(normalizedImageEditPrompt) ||
      Boolean(normalizedImageEditGeneratedFromPrompt);
    const normalizedSceneSoundAsset =
      cloneStudioCustomVideoFile(segment.sceneSoundAsset) ??
      createWorkspaceSegmentSceneSoundAsset(normalizedSegment, normalizedSegment.index);
    const normalizedVoiceoverAsset =
      cloneStudioCustomVideoFile(segment.voiceoverAsset) ??
      createWorkspaceSegmentVoiceoverAsset(normalizedSegment, normalizedSegment.index);
    const normalizedVoiceType = getWorkspaceSegmentVoiceOverrideId(segment);
    const hasReusableProjectVoiceoverTiming =
      !normalizedVoiceoverAsset &&
      getPositiveWorkspaceMediaAssetId(session.ttsAssetId) !== null &&
      hasWorkspaceSegmentProjectVoiceoverTimingData(normalizedSegment);
    const normalizedVoiceoverTextHash =
      typeof segment.voiceoverTextHash === "string" && segment.voiceoverTextHash.trim()
        ? segment.voiceoverTextHash
        : normalizedVoiceoverAsset || hasReusableProjectVoiceoverTiming
          ? getWorkspaceSegmentVoiceoverTextHash(segment.text)
          : null;
    const normalizedVoiceoverVoiceType =
      typeof segment.voiceoverVoiceType === "string" && segment.voiceoverVoiceType.trim()
        ? segment.voiceoverVoiceType
        : normalizedVoiceoverAsset || hasReusableProjectVoiceoverTiming
          ? normalizedVoiceType ?? normalizeWorkspaceSegmentEditorSetting(session.voiceType) ?? null
          : null;
    const normalizedVoiceoverLanguage =
      typeof segment.voiceoverLanguage === "string" && segment.voiceoverLanguage.trim()
        ? segment.voiceoverLanguage
        : normalizedVoiceoverAsset || hasReusableProjectVoiceoverTiming
          ? getWorkspaceSegmentEditorSessionLanguage(session)
          : null;
    const normalizedVoiceLanguage =
      normalizeStudioLanguageValue(segment.voiceLanguage ?? segment.voice_language) ??
      normalizeStudioLanguageValue(normalizedVoiceoverLanguage);
    const normalizedSceneSoundPrompt = typeof segment.sceneSoundPrompt === "string" ? segment.sceneSoundPrompt : "";
    const normalizedSceneSoundGeneratedFromPrompt =
      typeof segment.sceneSoundGeneratedFromPrompt === "string" && segment.sceneSoundGeneratedFromPrompt.trim()
        ? segment.sceneSoundGeneratedFromPrompt
        : null;
    const normalizedSceneSoundPromptInitialized =
      Boolean(segment.sceneSoundPromptInitialized) ||
      Boolean(normalizedSceneSoundPrompt) ||
      Boolean(normalizedSceneSoundGeneratedFromPrompt) ||
      Boolean(normalizedSceneSoundAsset);
    const normalizedSubtitleColor = getWorkspaceSegmentSubtitleColorOverrideId(segment);
    const normalizedSubtitleStyle = getWorkspaceSegmentSubtitleStyleOverrideId(segment);
    const normalizedSubtitleType = getWorkspaceSegmentSubtitleTypeOverrideId(segment);
    const normalizedMediaType = normalizeWorkspaceSegmentMediaType(segment.mediaType);
    const normalizedDurationMode = normalizeWorkspaceSegmentDurationMode(segment.durationMode);
    const normalizedDurationSyncMode = normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode);
    const normalizedDurationSyncModeUserSelected = segment.durationSyncModeUserSelected === true;
    const normalizedDurationExtensionSourceDurationSeconds =
      getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment);
    const normalizedVoiceSourceDuration = getWorkspaceSegmentVoiceSourceDurationSeconds(segment);
    const normalizedVoiceSourceEndTime = getWorkspaceSegmentVoiceSourceEndTime(segment);
    const normalizedVoiceSourceStartTime = getWorkspaceSegmentVoiceSourceStartTime(segment);
    const shouldDiscardLegacyVoiceRenderManualDuration =
      shouldDiscardWorkspaceSegmentLegacyVoiceRenderManualDuration(segment);
    const normalizedDurationModeForSegment = shouldDiscardLegacyVoiceRenderManualDuration
      ? "auto"
      : normalizedDurationMode;
    const normalizedDurationSyncModeForSegment = shouldDiscardLegacyVoiceRenderManualDuration
      ? "voiceover"
      : normalizedDurationSyncMode;
    const normalizedManualDurationSeconds = shouldDiscardLegacyVoiceRenderManualDuration
      ? null
      : normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
    const normalizedDuration = shouldDiscardLegacyVoiceRenderManualDuration && normalizedVoiceSourceDuration !== null
      ? normalizedVoiceSourceDuration
      : normalizedSegment.duration;
    const normalizedTextByLanguage = cloneWorkspaceSegmentEditorLocalizedTextMap(
      segment.textByLanguage,
      segment.text,
      fallbackLanguage,
    );
    const normalizedOriginalTextByLanguage = cloneWorkspaceSegmentEditorLocalizedTextMap(
      segment.originalTextByLanguage,
      normalizedOriginalText,
      fallbackLanguage,
    );
    const hasUrlChanges =
      normalizedSegment.currentExternalPlaybackUrl !== segment.currentExternalPlaybackUrl ||
      normalizedSegment.currentExternalPreviewUrl !== segment.currentExternalPreviewUrl ||
      normalizedSegment.currentPlaybackUrl !== segment.currentPlaybackUrl ||
      normalizedSegment.currentPosterUrl !== segment.currentPosterUrl ||
      normalizedSegment.currentPreviewUrl !== segment.currentPreviewUrl ||
      normalizedSegment.currentSourceKind !== segment.currentSourceKind ||
      normalizedSegment.originalExternalPlaybackUrl !== segment.originalExternalPlaybackUrl ||
      normalizedSegment.originalExternalPreviewUrl !== segment.originalExternalPreviewUrl ||
      normalizedSegment.originalPlaybackUrl !== segment.originalPlaybackUrl ||
      normalizedSegment.originalPosterUrl !== segment.originalPosterUrl ||
      normalizedSegment.originalPreviewUrl !== segment.originalPreviewUrl ||
      normalizedSegment.originalSourceKind !== segment.originalSourceKind;
    const hasOriginalTextChanges = normalizedOriginalText !== segment.originalText;
    const hasLocalizedTextChanges =
      !areWorkspaceSegmentEditorLocalizedTextMapsEqual(normalizedTextByLanguage, segment.textByLanguage) ||
      !areWorkspaceSegmentEditorLocalizedTextMapsEqual(normalizedOriginalTextByLanguage, segment.originalTextByLanguage);
    const hasAiPhotoChanges =
      normalizedAiPhotoPrompt !== segment.aiPhotoPrompt ||
      normalizedAiPhotoGeneratedFromPrompt !== segment.aiPhotoGeneratedFromPrompt ||
      normalizedAiPhotoPromptInitialized !== segment.aiPhotoPromptInitialized ||
      normalizedAiVideoPrompt !== segment.aiVideoPrompt ||
      normalizedAiVideoGeneratedFromPrompt !== segment.aiVideoGeneratedFromPrompt ||
      normalizedAiVideoGeneratedMode !== segment.aiVideoGeneratedMode ||
      normalizedAiVideoPromptInitialized !== segment.aiVideoPromptInitialized ||
      normalizedImageEditPrompt !== segment.imageEditPrompt ||
      normalizedImageEditGeneratedFromPrompt !== segment.imageEditGeneratedFromPrompt ||
      normalizedImageEditPromptInitialized !== segment.imageEditPromptInitialized ||
      Boolean(normalizedSceneSoundAsset) !== Boolean(segment.sceneSoundAsset) ||
      normalizedSceneSoundPrompt !== segment.sceneSoundPrompt ||
      normalizedSceneSoundGeneratedFromPrompt !== segment.sceneSoundGeneratedFromPrompt ||
      normalizedSceneSoundPromptInitialized !== segment.sceneSoundPromptInitialized ||
      Boolean(normalizedVoiceoverAsset) !== Boolean(segment.voiceoverAsset) ||
      normalizedVoiceoverTextHash !== segment.voiceoverTextHash ||
      normalizedVoiceoverVoiceType !== segment.voiceoverVoiceType ||
      normalizedVoiceoverLanguage !== segment.voiceoverLanguage ||
      normalizedVoiceLanguage !== normalizeStudioLanguageValue(segment.voiceLanguage ?? segment.voice_language) ||
      normalizedSubtitleColor !== (segment.subtitleColor ?? null) ||
      normalizedSubtitleStyle !== (segment.subtitleStyle ?? null) ||
      normalizedSubtitleType !== (segment.subtitleType ?? null) ||
      normalizedVoiceType !== getWorkspaceSegmentVoiceOverrideId(segment) ||
      normalizedVideoAction !== segment.videoAction ||
      normalizedMediaType !== segment.mediaType ||
      normalizedDurationSyncModeForSegment !== normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) ||
      normalizedDurationSyncModeUserSelected !== (segment.durationSyncModeUserSelected === true) ||
      !areWorkspaceSegmentDurationValuesEqual(normalizedVoiceSourceDuration, segment.voiceSourceDuration ?? null) ||
      !areWorkspaceSegmentDurationValuesEqual(normalizedVoiceSourceEndTime, segment.voiceSourceEndTime ?? null) ||
      !areWorkspaceSegmentDurationValuesEqual(normalizedVoiceSourceStartTime, segment.voiceSourceStartTime ?? null) ||
      normalizedDurationModeForSegment !== segment.durationMode ||
      !areWorkspaceSegmentDurationValuesEqual(
        normalizedManualDurationSeconds,
        normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds),
      ) ||
      !areWorkspaceSegmentDurationValuesEqual(
        normalizedDurationExtensionSourceDurationSeconds,
        getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment),
      );

    if (
      segment.customVideo ||
      segment.aiPhotoAsset ||
      segment.aiVideoAsset ||
      segment.imageEditAsset ||
      segment.photoAnimationSourceAsset ||
      segment.sceneSoundAsset ||
      normalizedSceneSoundAsset ||
      normalizedVideoAction === "original" ||
      normalizedVideoAction === "ai" ||
      normalizedVideoAction === "custom" ||
      normalizedVideoAction === "ai_photo" ||
      normalizedVideoAction === "image_edit" ||
      normalizedVideoAction === "talking_photo" ||
      normalizedVideoAction === "photo_animation"
    ) {
      if (!hasUrlChanges && !hasOriginalTextChanges && !hasLocalizedTextChanges && !hasAiPhotoChanges) {
        return segment;
      }

      hasChanges = true;
      return {
        ...normalizedSegment,
        duration: normalizedDuration,
        aiPhotoAsset: cloneStudioCustomVideoFile(segment.aiPhotoAsset),
        aiPhotoGeneratedFromPrompt: normalizedAiPhotoGeneratedFromPrompt,
        aiPhotoPrompt: normalizedAiPhotoPrompt,
        aiPhotoPromptInitialized: normalizedAiPhotoPromptInitialized,
        aiVideoAsset: cloneStudioCustomVideoFile(segment.aiVideoAsset),
        aiVideoGeneratedMode: normalizedAiVideoGeneratedMode,
        aiVideoGeneratedFromPrompt: normalizedAiVideoGeneratedFromPrompt,
        aiVideoPrompt: normalizedAiVideoPrompt,
        aiVideoPromptInitialized: normalizedAiVideoPromptInitialized,
        customVideo: cloneStudioCustomVideoFile(segment.customVideo),
        durationSyncMode: normalizedDurationSyncModeForSegment,
        durationSyncModeUserSelected: normalizedDurationSyncModeUserSelected,
        durationExtensionSourceDurationSeconds: normalizedDurationExtensionSourceDurationSeconds,
        durationMode: normalizedDurationModeForSegment,
        imageEditAsset: cloneStudioCustomVideoFile(segment.imageEditAsset),
        imageEditGeneratedFromPrompt: normalizedImageEditGeneratedFromPrompt,
        imageEditPrompt: normalizedImageEditPrompt,
        imageEditPromptInitialized: normalizedImageEditPromptInitialized,
        manualDurationSeconds: normalizedManualDurationSeconds,
        mediaType: normalizedMediaType,
        originalText: normalizedOriginalText,
        originalTextByLanguage: normalizedOriginalTextByLanguage,
        photoAnimationSourceAsset: cloneStudioCustomVideoFile(segment.photoAnimationSourceAsset),
        sceneSoundAsset: normalizedSceneSoundAsset,
        sceneSoundGeneratedFromPrompt: normalizedSceneSoundGeneratedFromPrompt,
        sceneSoundPrompt: normalizedSceneSoundPrompt,
        sceneSoundPromptInitialized: normalizedSceneSoundPromptInitialized,
        subtitleColor: normalizedSubtitleColor,
        subtitleStyle: normalizedSubtitleStyle,
        subtitleType: normalizedSubtitleType,
        textByLanguage: normalizedTextByLanguage,
        voiceSourceDuration: normalizedVoiceSourceDuration,
        voiceSourceEndTime: normalizedVoiceSourceEndTime,
        voiceSourceStartTime: normalizedVoiceSourceStartTime,
        voiceLanguage: normalizedVoiceLanguage,
        voice_language: normalizedVoiceLanguage,
        voiceoverAsset: normalizedVoiceoverAsset,
        voiceoverLanguage: normalizedVoiceoverLanguage,
        voiceoverTextHash: normalizedVoiceoverTextHash,
        voiceoverVoiceType: normalizedVoiceoverVoiceType,
        videoAction: normalizedVideoAction,
        voiceType: normalizedVoiceType,
        visualReset: Boolean(segment.visualReset),
      };
    }

    hasChanges = true;
    return {
      ...normalizedSegment,
      duration: normalizedDuration,
      aiPhotoAsset: null,
      aiPhotoGeneratedFromPrompt: normalizedAiPhotoGeneratedFromPrompt,
      aiPhotoPrompt: normalizedAiPhotoPrompt,
      aiPhotoPromptInitialized: normalizedAiPhotoPromptInitialized,
      aiVideoAsset: null,
      aiVideoGeneratedMode: normalizedAiVideoGeneratedMode,
      aiVideoGeneratedFromPrompt: normalizedAiVideoGeneratedFromPrompt,
      aiVideoPrompt: normalizedAiVideoPrompt,
      aiVideoPromptInitialized: normalizedAiVideoPromptInitialized,
      durationExtensionSourceDurationSeconds: normalizedDurationExtensionSourceDurationSeconds,
      durationSyncMode: normalizedDurationSyncModeForSegment,
      durationSyncModeUserSelected: normalizedDurationSyncModeUserSelected,
      durationMode: normalizedDurationModeForSegment,
      imageEditAsset: null,
      imageEditGeneratedFromPrompt: normalizedImageEditGeneratedFromPrompt,
      imageEditPrompt: normalizedImageEditPrompt,
      imageEditPromptInitialized: normalizedImageEditPromptInitialized,
      manualDurationSeconds: normalizedManualDurationSeconds,
      mediaType: normalizedMediaType,
      originalText: normalizedOriginalText,
      originalTextByLanguage: normalizedOriginalTextByLanguage,
      photoAnimationSourceAsset: null,
      sceneSoundAsset: normalizedSceneSoundAsset,
      sceneSoundGeneratedFromPrompt: normalizedSceneSoundGeneratedFromPrompt,
      sceneSoundPrompt: normalizedSceneSoundPrompt,
      sceneSoundPromptInitialized: normalizedSceneSoundPromptInitialized,
      subtitleColor: normalizedSubtitleColor,
      subtitleStyle: normalizedSubtitleStyle,
      subtitleType: normalizedSubtitleType,
      textByLanguage: normalizedTextByLanguage,
      voiceSourceDuration: normalizedVoiceSourceDuration,
      voiceSourceEndTime: normalizedVoiceSourceEndTime,
      voiceSourceStartTime: normalizedVoiceSourceStartTime,
      voiceLanguage: normalizedVoiceLanguage,
      voice_language: normalizedVoiceLanguage,
      voiceoverAsset: normalizedVoiceoverAsset,
      voiceoverLanguage: normalizedVoiceoverLanguage,
      voiceoverTextHash: normalizedVoiceoverTextHash,
      voiceoverVoiceType: normalizedVoiceoverVoiceType,
      videoAction: "original" as const,
      voiceType: normalizedVoiceType,
      visualReset: Boolean(segment.visualReset),
    };
  });

  const visualResetSegments = segments.map((segment) => {
    if (!segment.visualReset) {
      return segment;
    }

    hasChanges = true;
    return resetWorkspaceSegmentDraftVisualToOriginal(segment, session.projectId);
  });
  const shouldRepairUserSelectedStillDurations = visualResetSegments.some((segment) => {
    const manualDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
    if (
      manualDurationSeconds === null ||
      segment.durationSyncModeUserSelected !== true ||
      normalizeWorkspaceSegmentDurationMode(segment.durationMode) !== "manual" ||
      normalizeWorkspaceSegmentDurationSyncMode(segment.durationSyncMode) !== "visual" ||
      getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "image"
    ) {
      return false;
    }

    const startTime = normalizeWorkspaceSegmentManualDurationSeconds(segment.startTime);
    const endTime = normalizeWorkspaceSegmentManualDurationSeconds(segment.endTime);
    const timelineDurationSeconds =
      startTime !== null && endTime !== null && endTime > startTime
        ? normalizeWorkspaceSegmentManualDurationSeconds(endTime - startTime)
        : null;
    const storedDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.duration);

    return [timelineDurationSeconds, storedDurationSeconds].some(
      (durationSeconds) =>
        durationSeconds !== null &&
        !areWorkspaceSegmentDurationValuesEqual(durationSeconds, manualDurationSeconds),
    );
  });
  const normalizedSegments = rebuildWorkspaceSegmentEditorDraftTimeline(visualResetSegments, session, {
    preserveSourceTimelineEnd: !shouldRepairUserSelectedStillDurations,
  });

  return hasChanges || normalizedSegments !== visualResetSegments
    ? {
        ...session,
        segments: normalizedSegments,
      }
    : session;
};
