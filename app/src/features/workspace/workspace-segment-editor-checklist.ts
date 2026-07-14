import type { Locale } from "../../lib/i18n";
import {
  createWorkspaceSegmentSceneSoundAsset,
  getCanonicalStudioVoiceOptionId,
  getStudioVoiceOptionCopy,
  getStudioCustomVideoFileIdentityKey,
  getWorkspaceSegmentCurrentVisualIdentityKey,
  getWorkspaceSegmentCustomAssetId,
  getWorkspaceSegmentEditorProjectVoiceType,
  getWorkspaceSegmentEffectiveVoiceEnabled,
  getWorkspaceSegmentEffectiveVoiceId,
  getWorkspaceSegmentLatestVisualAction,
  getWorkspaceSegmentSubtitleColorOverrideId,
  getWorkspaceSegmentSubtitleStyleOverrideId,
  getWorkspaceSegmentSubtitleTypeOverrideId,
  getWorkspaceSegmentVoiceOverrideId,
  hasWorkspaceSegmentExplicitDraftVisual,
  isWorkspaceSegmentCurrentVisualDifferentFromOriginal,
  isWorkspaceSegmentDraftDurationEdited,
  isWorkspaceSegmentDraftTextEdited,
  isWorkspaceSegmentProjectTimelineVoiceoverAvailable,
  isWorkspaceSegmentServerPhotoAnimationOverride,
  isWorkspaceSegmentVisualResetApplied,
  normalizeWorkspaceSegmentEditorSetting,
  normalizeWorkspaceSegmentEditorTextForCompare,
  studioVoiceOptionsByLanguage,
} from "./workspace-segment-editor";
import { getStudioSubtitleStyleDisplayLabel } from "./workspace-subtitle-preview-helpers";
import { areWorkspaceSegmentInfographicsEqual } from "./workspace-infographic-helpers";
import { getStudioMusicOptionCopy, studioMusicOptions } from "./workspace-studio-options";
import { formatWorkspaceSegmentDurationInputValue } from "./workspace-utils";
import type {
  StudioCustomVideoFile,
  StudioLanguage,
  StudioSubtitleColorOption,
  StudioSubtitleStyleOption,
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentEditorDraftSession,
  WorkspaceSegmentEditorSegment,
} from "./workspace-types";

export const isWorkspaceSegmentDraftSubtitleEdited = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) => {
  if (!baselineSegment) {
    return Boolean(
      getWorkspaceSegmentSubtitleTypeOverrideId(segment) ||
        getWorkspaceSegmentSubtitleStyleOverrideId(segment) ||
        getWorkspaceSegmentSubtitleColorOverrideId(segment),
    );
  }

  return (
    getWorkspaceSegmentSubtitleTypeOverrideId(segment) !== getWorkspaceSegmentSubtitleTypeOverrideId(baselineSegment) ||
    getWorkspaceSegmentSubtitleStyleOverrideId(segment) !== getWorkspaceSegmentSubtitleStyleOverrideId(baselineSegment) ||
    getWorkspaceSegmentSubtitleColorOverrideId(segment) !== getWorkspaceSegmentSubtitleColorOverrideId(baselineSegment)
  );
};

export const isWorkspaceSegmentDraftInfographicEdited = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) =>
  segment.infographicRemoved === true ||
  !areWorkspaceSegmentInfographicsEqual(segment.infographic, baselineSegment?.infographic);

const isWorkspaceSegmentDraftVisualEdited = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (isWorkspaceSegmentServerPhotoAnimationOverride(segment)) {
    return true;
  }

  if (segment.videoAction === "ai" || segment.videoAction === "photo_animation" || segment.videoAction === "talking_photo") {
    return Boolean(segment.aiVideoAsset);
  }

  if (segment.videoAction === "image_edit") {
    return Boolean(segment.imageEditAsset);
  }

  if (segment.videoAction === "ai_photo") {
    return Boolean(segment.aiPhotoAsset);
  }

  if (segment.videoAction === "custom") {
    return Boolean(segment.customVideo) || isWorkspaceSegmentCurrentVisualDifferentFromOriginal(segment);
  }

  if (isWorkspaceSegmentCurrentVisualDifferentFromOriginal(segment)) {
    return true;
  }

  if (
    segment.currentSourceKind !== "unknown" &&
    segment.originalSourceKind !== "unknown" &&
    segment.currentSourceKind !== segment.originalSourceKind
  ) {
    return true;
  }

  return segment.currentSourceKind === "upload" && segment.originalSourceKind !== "upload";
};

export const isWorkspaceSegmentDraftVisualResettable = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (isWorkspaceSegmentVisualResetApplied(segment)) {
    return false;
  }

  if (segment.visualReset) {
    return true;
  }

  if (hasWorkspaceSegmentExplicitDraftVisual(segment)) {
    return true;
  }

  if (segment.videoAction !== "original") {
    return true;
  }

  return isWorkspaceSegmentDraftVisualEdited(segment);
};

const getWorkspaceSegmentDraftVisualChangeIdentity = (segment: WorkspaceSegmentEditorDraftSegment) =>
  JSON.stringify([
    getWorkspaceSegmentCurrentVisualIdentityKey(segment),
    segment.currentSourceKind,
    segment.mediaType,
    segment.videoAction,
    segment.aiVideoGeneratedMode ?? null,
    getWorkspaceSegmentCustomAssetIdentityKey(segment.customVideo),
    getWorkspaceSegmentCustomAssetIdentityKey(segment.aiPhotoAsset),
    getWorkspaceSegmentCustomAssetIdentityKey(segment.aiVideoAsset),
    getWorkspaceSegmentCustomAssetIdentityKey(segment.imageEditAsset),
    getWorkspaceSegmentCustomAssetIdentityKey(segment.photoAnimationSourceAsset),
    Boolean(segment.visualReset && !isWorkspaceSegmentVisualResetApplied(segment)),
  ]);

export const isWorkspaceSegmentDraftVisualChangedFromBaseline = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) => {
  if (!baselineSegment) {
    return isWorkspaceSegmentDraftVisualResettable(segment);
  }

  if (isWorkspaceSegmentAppliedVisualResetChange(segment, baselineSegment)) {
    return false;
  }

  return getWorkspaceSegmentDraftVisualChangeIdentity(segment) !== getWorkspaceSegmentDraftVisualChangeIdentity(baselineSegment);
};

export const getWorkspaceSegmentDraftVisualStatus = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
): "changed" | "reset" | "none" => {
  if (isWorkspaceSegmentAppliedVisualResetChange(segment, baselineSegment)) {
    return "reset";
  }

  return isWorkspaceSegmentDraftVisualChangedFromBaseline(segment, baselineSegment) ? "changed" : "none";
};

export const reorderWorkspaceSegmentEditorSegmentsByIndex = (
  segments: WorkspaceSegmentEditorDraftSegment[],
  orderedSegmentIndices: number[],
) => {
  if (segments.length !== orderedSegmentIndices.length) {
    return segments;
  }

  const segmentsByIndex = new Map(segments.map((segment) => [segment.index, segment]));
  const nextSegments = orderedSegmentIndices
    .map((segmentIndex) => segmentsByIndex.get(segmentIndex))
    .filter((segment): segment is WorkspaceSegmentEditorDraftSegment => Boolean(segment));

  return nextSegments.length === segments.length ? nextSegments : segments;
};

export const areWorkspaceSegmentEditorSegmentOrdersEqual = (
  left?: Pick<WorkspaceSegmentEditorDraftSession, "segments"> | null,
  right?: Pick<WorkspaceSegmentEditorDraftSession, "segments"> | null,
) => {
  if (!left || !right || left.segments.length !== right.segments.length) {
    return false;
  }

  return left.segments.every((segment, index) => segment.index === right.segments[index]?.index);
};

export const getWorkspaceSegmentEditorPendingInsertedSegmentIndices = (
  draft: WorkspaceSegmentEditorDraftSession,
  baseline?: WorkspaceSegmentEditorDraftSession | null,
) => {
  if (!baseline) {
    return new Set<number>();
  }

  const baselineSegmentIndices = new Set(baseline.segments.map((segment) => segment.index));
  const pendingSegmentIndices = new Set<number>();

  draft.segments.forEach((segment) => {
    if (baselineSegmentIndices.has(segment.index)) {
      return;
    }

    if (
      !isWorkspaceSegmentDraftTextEdited(segment) &&
      !isWorkspaceSegmentDraftSubtitleEdited(segment, null) &&
      !isWorkspaceSegmentDraftVisualEdited(segment) &&
      !isWorkspaceSegmentDraftInfographicEdited(segment, null) &&
      !isWorkspaceSegmentDraftDurationEdited(segment, null)
    ) {
      pendingSegmentIndices.add(segment.index);
    }
  });

  return pendingSegmentIndices;
};

export const createWorkspaceSegmentEditorComparableDraftSession = (
  draft: WorkspaceSegmentEditorDraftSession,
  baseline?: WorkspaceSegmentEditorDraftSession | null,
) => {
  const pendingInsertedSegmentIndices = getWorkspaceSegmentEditorPendingInsertedSegmentIndices(draft, baseline);
  if (pendingInsertedSegmentIndices.size === 0) {
    return draft;
  }

  return {
    ...draft,
    segments: draft.segments.filter((segment) => !pendingInsertedSegmentIndices.has(segment.index)),
  };
};

export type WorkspaceSegmentEditorChecklistSettingId = "music" | "subtitle" | "voice";

export type WorkspaceSegmentEditorChecklistItem =
  | {
      key: string;
      kind: "segment";
      label: string;
      resetDuration: boolean;
      resetInfographic: boolean;
      resetText: boolean;
      resetSubtitle: boolean;
      resetSceneSound: boolean;
      resetVoice: boolean;
      resetVisual: boolean;
      restoreVisual: boolean;
      segmentIndex: number;
    }
  | {
      key: string;
      kind: "global";
      label: string;
      resetOrder: boolean;
      resetSettingIds: WorkspaceSegmentEditorChecklistSettingId[];
    }
  | {
      key: string;
      kind: "brand";
      label: string;
    };

export type WorkspaceSegmentEditorChecklistBuildOptions = {
  locale?: Locale;
  subtitleColorOptions?: StudioSubtitleColorOption[];
  subtitleStyleOptions?: StudioSubtitleStyleOption[];
};

const workspaceChecklistText = (locale: Locale, russian: string, english: string) =>
  locale === "en" ? english : russian;

export const hasOnlyWorkspaceSegmentEditorDurationChecklistChanges = (
  items: WorkspaceSegmentEditorChecklistItem[] | null | undefined,
) =>
  Boolean(
    items?.length &&
      items.every(
        (item) =>
          item.kind === "segment" &&
          item.resetDuration &&
          !item.resetInfographic &&
          !item.resetSceneSound &&
          !item.resetSubtitle &&
          !item.resetText &&
          !item.resetVoice &&
          !item.resetVisual &&
          !item.restoreVisual,
      ),
  );

const getWorkspaceSegmentEditorSettingsSnapshot = (session?: WorkspaceSegmentEditorDraftSession | null) => {
  const voiceEnabled = normalizeWorkspaceSegmentEditorSetting(session?.voiceType) !== "none";
  const subtitleEnabled = voiceEnabled && normalizeWorkspaceSegmentEditorSetting(session?.subtitleType) !== "none";
  const musicType = normalizeWorkspaceSegmentEditorSetting(session?.musicType) ?? "ai";
  const customMusicAssetId =
    musicType === "custom" && Number.isFinite(Number(session?.customMusicAssetId)) && Number(session?.customMusicAssetId) > 0
      ? Math.trunc(Number(session?.customMusicAssetId))
      : null;
  const customMusicFileName =
    musicType === "custom" ? String(session?.customMusicFileName ?? "").replace(/\s+/g, " ").trim() || null : null;
  const musicAssetId =
    musicType !== "custom" && Number.isFinite(Number(session?.musicAssetId)) && Number(session?.musicAssetId) > 0
      ? Math.trunc(Number(session?.musicAssetId))
      : null;
  const musicName =
    musicType !== "custom" ? String(session?.musicName ?? "").replace(/\s+/g, " ").trim() || null : null;

  return {
    customMusicAssetId,
    customMusicFileName,
    musicAssetId,
    musicName,
    musicType,
    subtitleColorId: subtitleEnabled ? normalizeWorkspaceSegmentEditorSetting(session?.subtitleColor) ?? "purple" : null,
    subtitleEnabled,
    subtitleStyleId: subtitleEnabled ? normalizeWorkspaceSegmentEditorSetting(session?.subtitleStyle) ?? "modern" : null,
    voiceEnabled,
    voiceId: voiceEnabled ? normalizeWorkspaceSegmentEditorSetting(session?.voiceType) ?? "" : null,
  };
};

export const formatWorkspaceSegmentEditorChecklistPreview = (value: string, maxChars = 52) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
};

const getWorkspaceSegmentEditorChecklistVoiceLabel = (
  voiceId: string | null | undefined,
  locale: Locale,
) => {
  const safeVoiceId = getCanonicalStudioVoiceOptionId(voiceId);
  if (!safeVoiceId) {
    return workspaceChecklistText(locale, "выключена", "disabled");
  }

  for (const voiceOptions of Object.values(studioVoiceOptionsByLanguage)) {
    const matchedVoice = voiceOptions.find((voice) => voice.id === safeVoiceId);
    if (matchedVoice) {
      return workspaceChecklistText(
        locale,
        `голос ${matchedVoice.label}`,
        `voice ${getStudioVoiceOptionCopy(matchedVoice, locale).label}`,
      );
    }
  }

  return workspaceChecklistText(locale, `голос ${safeVoiceId}`, `voice ${safeVoiceId}`);
};

const getWorkspaceSegmentEditorChecklistMusicLabel = (
  musicType: string | null | undefined,
  locale: Locale,
) => {
  const safeMusicType = normalizeWorkspaceSegmentEditorSetting(musicType) ?? "ai";
  const option = studioMusicOptions.find((candidate) => candidate.id === safeMusicType);
  return option ? getStudioMusicOptionCopy(option, locale).label : safeMusicType;
};

const getWorkspaceSegmentEditorChecklistSubtitleStyleLabel = (
  styleId: string | null,
  locale: Locale,
  styleOptions?: StudioSubtitleStyleOption[],
) => {
  const safeStyleId = normalizeWorkspaceSegmentEditorSetting(styleId);
  if (!safeStyleId) {
    return workspaceChecklistText(locale, "без стиля", "no style");
  }

  const styleOption = styleOptions?.find((style) => style.id === safeStyleId);
  return getStudioSubtitleStyleDisplayLabel(locale, styleOption) || safeStyleId;
};

const getWorkspaceSegmentEditorChecklistSubtitleColorLabel = (
  colorId: string | null,
  locale: Locale,
  colorOptions?: StudioSubtitleColorOption[],
) => {
  const safeColorId = normalizeWorkspaceSegmentEditorSetting(colorId);
  if (!safeColorId) {
    return workspaceChecklistText(locale, "без цвета", "no color");
  }

  return colorOptions?.find((color) => color.id === safeColorId)?.label ?? safeColorId;
};

const getWorkspaceSegmentEditorChecklistTextLabel = (
  segment: WorkspaceSegmentEditorDraftSegment,
  locale: Locale,
) => {
  if (!formatWorkspaceSegmentEditorChecklistPreview(segment.text)) {
    return workspaceChecklistText(locale, "текст очищен", "text cleared");
  }

  return workspaceChecklistText(locale, "обновлен текст", "text updated");
};

const getWorkspaceSegmentEditorChecklistVisualLabel = (
  segment: WorkspaceSegmentEditorDraftSegment,
  locale: Locale,
) => {
  if (segment.visualReset && isWorkspaceSegmentVisualResetApplied(segment)) {
    return workspaceChecklistText(locale, "сброшен визуал", "visual reset");
  }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (latestVisualAction === "ai") {
    return workspaceChecklistText(locale, "обновлено видео", "video updated");
  }

  if (latestVisualAction === "photo_animation") {
    return workspaceChecklistText(locale, "добавлено движение в фото", "motion added to photo");
  }

  if (latestVisualAction === "talking_photo") {
    return workspaceChecklistText(locale, "добавлен говорящий персонаж", "talking character added");
  }

  if (latestVisualAction === "custom") {
    return segment.customVideo?.source === "media-library"
      ? workspaceChecklistText(locale, "выбран визуал из медиатеки", "visual selected from media library")
      : workspaceChecklistText(locale, "добавлен свой визуал", "custom visual added");
  }

  if (latestVisualAction === "image_edit") {
    return workspaceChecklistText(locale, "отредактировано фото", "photo edited");
  }

  if (latestVisualAction === "ai_photo") {
    return workspaceChecklistText(locale, "обновлено изображение", "image updated");
  }

  return workspaceChecklistText(locale, "обновлен визуал", "visual updated");
};

const getWorkspaceSegmentCustomAssetIdentityKey = (asset: StudioCustomVideoFile | null | undefined) => {
  if (!asset) {
    return null;
  }

  const record = asset as StudioCustomVideoFile & {
    downloadUrl?: unknown;
    download_url?: unknown;
    file_name?: unknown;
    mime_type?: unknown;
    remote_url?: unknown;
    url?: unknown;
  };
  const assetId = getWorkspaceSegmentCustomAssetId(asset);
  if (assetId) {
    return `asset:${assetId}`;
  }

  const sourceUrl = [
    asset.remoteUrl,
    record.remote_url,
    record.url,
    record.downloadUrl,
    record.download_url,
    asset.dataUrl,
    asset.objectUrl,
  ]
    .map((value) => String(value ?? "").trim())
    .find(Boolean);
  if (sourceUrl) {
    return `url:${sourceUrl}`;
  }

  const fallbackIdentity = [asset.fileName, record.file_name, asset.mimeType, record.mime_type]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(":");
  return fallbackIdentity || null;
};

const getWorkspaceSegmentSceneSoundIdentityKey = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) =>
  getWorkspaceSegmentCustomAssetIdentityKey(
    segment ? createWorkspaceSegmentSceneSoundAsset(segment, segment.index) : null,
  );

const getWorkspaceSegmentSceneSoundGenerationKey = (
  segment:
    | Pick<WorkspaceSegmentEditorDraftSegment, "sceneSoundGeneratedFromPrompt">
    | null
    | undefined,
) => {
  const generatedPrompt =
    typeof segment?.sceneSoundGeneratedFromPrompt === "string"
      ? normalizeWorkspaceSegmentEditorTextForCompare(segment.sceneSoundGeneratedFromPrompt)
      : "";

  return generatedPrompt || null;
};

export const isWorkspaceSegmentDraftSceneSoundEdited = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) => {
  const currentIdentity = getWorkspaceSegmentSceneSoundIdentityKey(segment);
  const baselineIdentity = getWorkspaceSegmentSceneSoundIdentityKey(baselineSegment);

  if (currentIdentity !== baselineIdentity) {
    return true;
  }

  if (!currentIdentity) {
    return false;
  }

  return (
    getWorkspaceSegmentSceneSoundGenerationKey(segment) !==
    getWorkspaceSegmentSceneSoundGenerationKey(baselineSegment)
  );
};

const normalizeWorkspaceSegmentVoiceOverrideForLanguage = (
  voiceId: string | null | undefined,
  language: StudioLanguage,
) => {
  const normalizedVoiceId = getCanonicalStudioVoiceOptionId(voiceId);
  if (!normalizedVoiceId || normalizedVoiceId === "none") {
    return null;
  }

  const normalizedVoiceKey = normalizedVoiceId.toLowerCase();
  return (
    studioVoiceOptionsByLanguage[language].find((voice) => voice.id.toLowerCase() === normalizedVoiceKey)?.id ?? null
  );
};

export const getWorkspaceSegmentVoiceOverrideForLanguage = (
  segment: Pick<WorkspaceSegmentEditorSegment, "voiceType" | "voice_type"> | null | undefined,
  language: StudioLanguage,
) => normalizeWorkspaceSegmentVoiceOverrideForLanguage(getWorkspaceSegmentVoiceOverrideId(segment), language);

export const isWorkspaceSegmentDraftVoiceEdited = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  options?: {
    baselineSession?: Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId" | "voiceType"> | null;
    draftSession?: Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId" | "voiceType"> | null;
  },
) => {
  const normalizeInheritedVoiceOverride = (
    voiceId: string | null,
    session?: Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> | null,
  ) => {
    const sessionVoiceId = normalizeWorkspaceSegmentEditorSetting(session?.voiceType) ?? null;
    return voiceId && sessionVoiceId && voiceId === sessionVoiceId ? null : voiceId;
  };
  const voiceOverrideChanged =
    normalizeInheritedVoiceOverride(getWorkspaceSegmentVoiceOverrideId(segment), options?.draftSession) !==
    normalizeInheritedVoiceOverride(getWorkspaceSegmentVoiceOverrideId(baselineSegment), options?.baselineSession);
  const getSceneVoiceoverAssetKey = (
    asset: WorkspaceSegmentEditorDraftSegment["voiceoverAsset"],
    session?: Pick<WorkspaceSegmentEditorDraftSession, "ttsAssetId"> | null,
  ) => {
    const assetId = getWorkspaceSegmentCustomAssetId(asset);
    const ttsAssetId = Number(session?.ttsAssetId);
    if (assetId !== null && Number.isFinite(ttsAssetId) && ttsAssetId > 0 && assetId === Math.trunc(ttsAssetId)) {
      return "";
    }

    return getStudioCustomVideoFileIdentityKey(asset);
  };
  const currentVoiceoverAssetKey = getSceneVoiceoverAssetKey(segment.voiceoverAsset, options?.draftSession);
  const baselineVoiceoverAssetKey = getSceneVoiceoverAssetKey(baselineSegment?.voiceoverAsset ?? null, options?.baselineSession);
  const voiceoverAssetChanged = currentVoiceoverAssetKey !== baselineVoiceoverAssetKey;

  if (voiceOverrideChanged || voiceoverAssetChanged) {
    return true;
  }

  if (!currentVoiceoverAssetKey && !baselineVoiceoverAssetKey) {
    return false;
  }

  return (
    segment.voiceoverTextHash !== baselineSegment?.voiceoverTextHash ||
    segment.voiceoverVoiceType !== baselineSegment?.voiceoverVoiceType ||
    segment.voiceoverLanguage !== baselineSegment?.voiceoverLanguage
  );
};

export const isWorkspaceSegmentEffectiveVoiceEdited = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  options: {
    baselineSession: Pick<WorkspaceSegmentEditorDraftSession, "voiceType"> | null | undefined;
    draftSession: Pick<WorkspaceSegmentEditorDraftSession, "voiceType">;
  },
) => {
  const currentVoiceEnabled = getWorkspaceSegmentEffectiveVoiceEnabled(segment, options.draftSession);
  const baselineProjectVoiceId = normalizeWorkspaceSegmentEditorSetting(options.baselineSession?.voiceType);
  const baselineVoiceEnabled = baselineSegment
    ? getWorkspaceSegmentEffectiveVoiceEnabled(baselineSegment, options.baselineSession)
    : Boolean(baselineProjectVoiceId && baselineProjectVoiceId !== "none");
  if (currentVoiceEnabled !== baselineVoiceEnabled) {
    return true;
  }
  if (!currentVoiceEnabled) {
    return false;
  }

  const currentVoiceId = getWorkspaceSegmentEffectiveVoiceId(segment, options.draftSession);
  const baselineVoiceId = baselineSegment
    ? getWorkspaceSegmentEffectiveVoiceId(baselineSegment, options.baselineSession)
    : baselineProjectVoiceId;
  return currentVoiceId !== baselineVoiceId;
};

export const canReuseWorkspaceSegmentProjectTimelineVoiceover = (
  segment: WorkspaceSegmentEditorDraftSegment,
  draft: WorkspaceSegmentEditorDraftSession,
  options?: {
    baselineSession?: WorkspaceSegmentEditorDraftSession | null;
    isGlobalVoiceEdited?: boolean;
  },
) => {
  const baselineSession = options?.baselineSession?.projectId === draft.projectId ? options.baselineSession : null;
  const baselineSegment = baselineSession?.segments.find((candidate) => candidate.index === segment.index) ?? null;
  const isDraftGlobalVoiceEdited = Boolean(
    baselineSession &&
      getWorkspaceSegmentEditorProjectVoiceType(draft) !== getWorkspaceSegmentEditorProjectVoiceType(baselineSession),
  );
  const isVoiceSettingsEdited = baselineSession
    ? isWorkspaceSegmentDraftVoiceEdited(segment, baselineSegment, {
        baselineSession,
        draftSession: draft,
      })
    : false;
  const isTextEdited = isWorkspaceSegmentDraftTextEdited(segment);

  if (
    options?.isGlobalVoiceEdited === true ||
    isDraftGlobalVoiceEdited ||
    isVoiceSettingsEdited ||
    isTextEdited
  ) {
    return isWorkspaceSegmentProjectTimelineVoiceoverAvailable(segment, draft);
  }

  return isWorkspaceSegmentProjectTimelineVoiceoverAvailable(segment, draft, {
    allowFinalVideoStaleWithMissingVoiceoverMetadata: true,
    allowMissingVoiceoverMetadata: true,
  });
};

const getWorkspaceSegmentEditorChecklistSceneSoundLabel = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  locale: Locale,
) => {
  const currentIdentity = getWorkspaceSegmentSceneSoundIdentityKey(segment);
  const baselineIdentity = getWorkspaceSegmentSceneSoundIdentityKey(baselineSegment);

  if (currentIdentity && !baselineIdentity) {
    return workspaceChecklistText(locale, "добавлен звук сцены", "scene sound added");
  }

  if (!currentIdentity && baselineIdentity) {
    return workspaceChecklistText(locale, "удален звук сцены", "scene sound removed");
  }

  return workspaceChecklistText(locale, "обновлен звук сцены", "scene sound updated");
};

const getWorkspaceSegmentEditorChecklistInfographicLabel = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  locale: Locale,
) => {
  if (segment.infographic && !baselineSegment?.infographic) {
    return workspaceChecklistText(locale, "добавлена инфографика", "infographic added");
  }
  if (!segment.infographic && baselineSegment?.infographic) {
    return workspaceChecklistText(locale, "удалена инфографика", "infographic removed");
  }
  return workspaceChecklistText(locale, "обновлена инфографика", "infographic updated");
};

const getWorkspaceSegmentEditorChecklistSceneVoiceLabel = (
  segment: WorkspaceSegmentEditorDraftSegment,
  locale: Locale,
) => {
  const voiceId = getWorkspaceSegmentVoiceOverrideId(segment);
  if (segment.voiceoverAsset) {
    return workspaceChecklistText(locale, "озвучка сгенерирована", "voiceover generated");
  }
  if (!voiceId) {
    return workspaceChecklistText(locale, "озвучка как в видео", "voiceover inherited from video");
  }

  return workspaceChecklistText(
    locale,
    `озвучка: ${getWorkspaceSegmentEditorChecklistVoiceLabel(voiceId, locale)}`,
    `voiceover: ${getWorkspaceSegmentEditorChecklistVoiceLabel(voiceId, locale)}`,
  );
};

const getWorkspaceSegmentEditorChecklistSceneSubtitleLabel = (
  segment: WorkspaceSegmentEditorDraftSegment,
  options?: WorkspaceSegmentEditorChecklistBuildOptions,
) => {
  const locale = options?.locale ?? "ru";
  const subtitleType = getWorkspaceSegmentSubtitleTypeOverrideId(segment);
  const subtitleStyleId = getWorkspaceSegmentSubtitleStyleOverrideId(segment);
  const subtitleColorId = getWorkspaceSegmentSubtitleColorOverrideId(segment);

  if (subtitleType === "none") {
    return workspaceChecklistText(locale, "субтитры выключены", "subtitles disabled");
  }

  const changes: string[] = [];
  if (subtitleStyleId) {
    changes.push(
      workspaceChecklistText(
        locale,
        `стиль ${getWorkspaceSegmentEditorChecklistSubtitleStyleLabel(subtitleStyleId, locale, options?.subtitleStyleOptions)}`,
        `style ${getWorkspaceSegmentEditorChecklistSubtitleStyleLabel(subtitleStyleId, locale, options?.subtitleStyleOptions)}`,
      ),
    );
  }

  if (subtitleColorId) {
    changes.push(
      workspaceChecklistText(
        locale,
        `цвет ${getWorkspaceSegmentEditorChecklistSubtitleColorLabel(subtitleColorId, locale, options?.subtitleColorOptions)}`,
        `color ${getWorkspaceSegmentEditorChecklistSubtitleColorLabel(subtitleColorId, locale, options?.subtitleColorOptions)}`,
      ),
    );
  }

  return changes.length > 0
    ? workspaceChecklistText(locale, `субтитры: ${changes.join(", ")}`, `subtitles: ${changes.join(", ")}`)
    : workspaceChecklistText(locale, "субтитры: глобальные настройки", "subtitles: global settings");
};

const getWorkspaceSegmentEditorChecklistDurationLabel = (
  segment: WorkspaceSegmentEditorDraftSegment,
  locale: Locale,
) =>
  workspaceChecklistText(
    locale,
    `длина: ${formatWorkspaceSegmentDurationInputValue(segment.manualDurationSeconds || segment.duration)} сек`,
    `duration: ${formatWorkspaceSegmentDurationInputValue(segment.manualDurationSeconds || segment.duration)} sec`,
  );

const lowerCaseWorkspaceChecklistLabelPrefix = (value: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  return `${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
};

const getWorkspaceSegmentEditorChecklistSubtitleLabel = (
  draftSettings: ReturnType<typeof getWorkspaceSegmentEditorSettingsSnapshot>,
  baselineSettings: ReturnType<typeof getWorkspaceSegmentEditorSettingsSnapshot>,
  options?: WorkspaceSegmentEditorChecklistBuildOptions,
) => {
  const locale = options?.locale ?? "ru";
  if (!baselineSettings.subtitleEnabled && !draftSettings.subtitleEnabled) {
    return workspaceChecklistText(locale, "Субтитры: выключены", "Subtitles: disabled");
  }

  if (!draftSettings.subtitleEnabled) {
    return workspaceChecklistText(locale, "Субтитры: выключены", "Subtitles: disabled");
  }

  const nextStyleLabel = getWorkspaceSegmentEditorChecklistSubtitleStyleLabel(
    draftSettings.subtitleStyleId,
    locale,
    options?.subtitleStyleOptions,
  );
  const nextColorLabel = getWorkspaceSegmentEditorChecklistSubtitleColorLabel(
    draftSettings.subtitleColorId,
    locale,
    options?.subtitleColorOptions,
  );

  if (!baselineSettings.subtitleEnabled) {
    return workspaceChecklistText(
      locale,
      `Субтитры: включены, стиль ${nextStyleLabel}, цвет ${nextColorLabel}`,
      `Subtitles: enabled, style ${nextStyleLabel}, color ${nextColorLabel}`,
    );
  }

  const changes: string[] = [];
  if (draftSettings.subtitleStyleId !== baselineSettings.subtitleStyleId) {
    changes.push(workspaceChecklistText(locale, `стиль ${nextStyleLabel}`, `style ${nextStyleLabel}`));
  }

  if (draftSettings.subtitleColorId !== baselineSettings.subtitleColorId) {
    changes.push(workspaceChecklistText(locale, `цвет ${nextColorLabel}`, `color ${nextColorLabel}`));
  }

  return changes.length > 0
    ? workspaceChecklistText(locale, `Субтитры: ${changes.join(", ")}`, `Subtitles: ${changes.join(", ")}`)
    : workspaceChecklistText(
        locale,
        `Субтитры: стиль ${nextStyleLabel}, цвет ${nextColorLabel}`,
        `Subtitles: style ${nextStyleLabel}, color ${nextColorLabel}`,
      );
};

const getWorkspaceSegmentEditorChecklistVoiceSettingsLabel = (
  draftSettings: ReturnType<typeof getWorkspaceSegmentEditorSettingsSnapshot>,
  locale: Locale,
) =>
  workspaceChecklistText(
    locale,
    `Озвучка: ${getWorkspaceSegmentEditorChecklistVoiceLabel(draftSettings.voiceId, locale)}`,
    `Voiceover: ${getWorkspaceSegmentEditorChecklistVoiceLabel(draftSettings.voiceId, locale)}`,
  );

const getWorkspaceSegmentEditorChecklistMusicSettingsLabel = (
  draftSettings: ReturnType<typeof getWorkspaceSegmentEditorSettingsSnapshot>,
  locale: Locale,
) => {
  const musicLabel = getWorkspaceSegmentEditorChecklistMusicLabel(draftSettings.musicType, locale);
  return draftSettings.musicType === "custom" && draftSettings.customMusicFileName
    ? workspaceChecklistText(
        locale,
        `Музыка: ${musicLabel} (${formatWorkspaceSegmentEditorChecklistPreview(draftSettings.customMusicFileName, 32)})`,
        `Music: ${musicLabel} (${formatWorkspaceSegmentEditorChecklistPreview(draftSettings.customMusicFileName, 32)})`,
      )
    : workspaceChecklistText(locale, `Музыка: ${musicLabel}`, `Music: ${musicLabel}`);
};

const getWorkspaceSegmentEditorChecklistOrderLabel = (
  draft: WorkspaceSegmentEditorDraftSession,
  baseline: WorkspaceSegmentEditorDraftSession,
  locale: Locale,
) => {
  const baselineSegmentIds = baseline.segments.map((segment) => segment.index).sort((left, right) => left - right);
  const draftSegmentIds = draft.segments.map((segment) => segment.index).sort((left, right) => left - right);
  const hasSameSegmentSet =
    baselineSegmentIds.length === draftSegmentIds.length &&
    baselineSegmentIds.every((segmentIndex, index) => segmentIndex === draftSegmentIds[index]);

  if (!hasSameSegmentSet) {
    return workspaceChecklistText(
      locale,
      `Сегменты: было ${baseline.segments.length}, стало ${draft.segments.length}`,
      `Scenes: ${baseline.segments.length} before, ${draft.segments.length} now`,
    );
  }

  return workspaceChecklistText(locale, "Сегменты: изменен порядок", "Scenes: order changed");
};

export const isWorkspaceSegmentAppliedVisualResetChange = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) =>
  Boolean(
    baselineSegment &&
      segment.visualReset &&
      isWorkspaceSegmentVisualResetApplied(segment) &&
      isWorkspaceSegmentDraftVisualResettable(baselineSegment),
  );

export const getWorkspaceSegmentVisualTimelineHistoryState = (
  segment: WorkspaceSegmentEditorDraftSegment,
  baselineSegment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  hasRedoSnapshot: boolean,
) => {
  const isVisualResetChange = isWorkspaceSegmentAppliedVisualResetChange(segment, baselineSegment);

  return {
    canBack: !isVisualResetChange && isWorkspaceSegmentDraftVisualChangedFromBaseline(segment, baselineSegment),
    canForward: hasRedoSnapshot || isVisualResetChange,
  };
};

export const buildWorkspaceSegmentEditorChangeChecklist = (
  draft: WorkspaceSegmentEditorDraftSession,
  baseline?: WorkspaceSegmentEditorDraftSession | null,
  options?: WorkspaceSegmentEditorChecklistBuildOptions,
) => {
  const locale = options?.locale ?? "ru";
  const pendingInsertedSegmentIndices = getWorkspaceSegmentEditorPendingInsertedSegmentIndices(draft, baseline);
  const comparableDraft = createWorkspaceSegmentEditorComparableDraftSession(draft, baseline);
  const baselineSegmentsByIndex = new Map((baseline?.segments ?? []).map((segment) => [segment.index, segment] as const));
  const items: WorkspaceSegmentEditorChecklistItem[] = [];

  draft.segments.forEach((segment, index) => {
    if (pendingInsertedSegmentIndices.has(segment.index)) {
      return;
    }

    const segmentNumber = index + 1;
    const segmentChanges: string[] = [];
    let resetDuration = false;
    let resetInfographic = false;
    let resetText = false;
    let resetVisual = false;
    let restoreVisual = false;
    let resetSceneSound = false;
    let resetSubtitle = false;
    let resetVoice = false;
    const baselineSegment = baselineSegmentsByIndex.get(segment.index);

    if (isWorkspaceSegmentDraftTextEdited(segment)) {
      segmentChanges.push(getWorkspaceSegmentEditorChecklistTextLabel(segment, locale));
      resetText = true;
    }

    const isVisualEdited = isWorkspaceSegmentDraftVisualChangedFromBaseline(segment, baselineSegment);
    const isVisualResetChange = isWorkspaceSegmentAppliedVisualResetChange(segment, baselineSegment);
    if (isVisualEdited || isVisualResetChange) {
      segmentChanges.push(getWorkspaceSegmentEditorChecklistVisualLabel(segment, locale));
      resetVisual = isVisualEdited;
      restoreVisual = isVisualResetChange;
    }

    if (isWorkspaceSegmentDraftInfographicEdited(segment, baselineSegment)) {
      segmentChanges.push(getWorkspaceSegmentEditorChecklistInfographicLabel(segment, baselineSegment, locale));
      resetInfographic = true;
    }

    if (isWorkspaceSegmentDraftSceneSoundEdited(segment, baselineSegment)) {
      segmentChanges.push(getWorkspaceSegmentEditorChecklistSceneSoundLabel(segment, baselineSegment, locale));
      resetSceneSound = true;
    }

    if (isWorkspaceSegmentDraftVoiceEdited(segment, baselineSegment)) {
      segmentChanges.push(getWorkspaceSegmentEditorChecklistSceneVoiceLabel(segment, locale));
      resetVoice = true;
    }

    if (isWorkspaceSegmentDraftSubtitleEdited(segment, baselineSegment)) {
      segmentChanges.push(getWorkspaceSegmentEditorChecklistSceneSubtitleLabel(segment, options));
      resetSubtitle = true;
    }

    if (isWorkspaceSegmentDraftDurationEdited(segment, baselineSegment)) {
      segmentChanges.push(getWorkspaceSegmentEditorChecklistDurationLabel(segment, locale));
      resetDuration = true;
    }

    if (segmentChanges.length > 0) {
      items.push({
        key: `segment-change:${segment.index}`,
        kind: "segment",
        label: workspaceChecklistText(
          locale,
          `Сегмент ${segmentNumber}: ${segmentChanges.join(", ")}`,
          `Scene ${segmentNumber}: ${segmentChanges.join(", ")}`,
        ),
        resetDuration,
        resetInfographic,
        resetSceneSound,
        resetSubtitle,
        resetText,
        resetVoice,
        resetVisual,
        restoreVisual,
        segmentIndex: segment.index,
      });
    }
  });

  const draftSettings = getWorkspaceSegmentEditorSettingsSnapshot(draft);
  const baselineSettings = getWorkspaceSegmentEditorSettingsSnapshot(baseline);
  const globalChanges: string[] = [];
  const resetSettingIds: WorkspaceSegmentEditorChecklistSettingId[] = [];
  let resetOrder = false;

  if (
    draftSettings.subtitleEnabled !== baselineSettings.subtitleEnabled ||
    draftSettings.subtitleStyleId !== baselineSettings.subtitleStyleId ||
    draftSettings.subtitleColorId !== baselineSettings.subtitleColorId
  ) {
    globalChanges.push(
      lowerCaseWorkspaceChecklistLabelPrefix(
        getWorkspaceSegmentEditorChecklistSubtitleLabel(draftSettings, baselineSettings, options),
      ),
    );
    resetSettingIds.push("subtitle");
  }

  if (draftSettings.voiceEnabled !== baselineSettings.voiceEnabled || draftSettings.voiceId !== baselineSettings.voiceId) {
    globalChanges.push(
      lowerCaseWorkspaceChecklistLabelPrefix(
        getWorkspaceSegmentEditorChecklistVoiceSettingsLabel(draftSettings, locale),
      ),
    );
    resetSettingIds.push("voice");
  }

  if (
    draftSettings.musicType !== baselineSettings.musicType ||
    draftSettings.musicAssetId !== baselineSettings.musicAssetId ||
    draftSettings.musicName !== baselineSettings.musicName ||
    draftSettings.customMusicAssetId !== baselineSettings.customMusicAssetId ||
    draftSettings.customMusicFileName !== baselineSettings.customMusicFileName
  ) {
    globalChanges.push(
      lowerCaseWorkspaceChecklistLabelPrefix(
        getWorkspaceSegmentEditorChecklistMusicSettingsLabel(draftSettings, locale),
      ),
    );
    resetSettingIds.push("music");
  }

  if (baseline && !areWorkspaceSegmentEditorSegmentOrdersEqual(comparableDraft, baseline)) {
    globalChanges.push(
      lowerCaseWorkspaceChecklistLabelPrefix(
        getWorkspaceSegmentEditorChecklistOrderLabel(comparableDraft, baseline, locale),
      ),
    );
    resetOrder = true;
  }

  if (globalChanges.length > 0) {
    items.push({
      key: "segment-settings:global",
      kind: "global",
      label: workspaceChecklistText(
        locale,
        `Общее: ${globalChanges.join(", ")}`,
        `General: ${globalChanges.join(", ")}`,
      ),
      resetOrder,
      resetSettingIds,
    });
  }

  return items;
};

export const resolveWorkspaceSegmentEditorChangeDisplayBaselineSession = (
  draft: WorkspaceSegmentEditorDraftSession | null | undefined,
  baseline: WorkspaceSegmentEditorDraftSession | null | undefined,
) => {
  if (!draft) {
    return null;
  }

  if (baseline?.projectId === draft.projectId && baseline.segments.length > 0) {
    return baseline;
  }

  return draft;
};
