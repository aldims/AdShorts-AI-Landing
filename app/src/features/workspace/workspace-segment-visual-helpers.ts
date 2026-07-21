import type { WorkspaceSavedReference } from "../../../shared/workspace-references";
import {
  getPositiveWorkspaceMediaAssetId,
  getStudioCustomVideoFileIdentityKey,
  getWorkspaceMediaAssetDurablePreviewUrl,
  getWorkspaceSegmentCustomPreviewKind,
  getWorkspaceSegmentDraftVisualAsset,
  getWorkspaceSegmentLatestEditablePhotoAsset,
  getWorkspaceSegmentLatestVisualAction,
  getWorkspaceSegmentPhotoAnimationSourceAsset,
  getWorkspaceSegmentSelectedVisualPreviewKind,
  isWorkspacePhotoMediaAsset,
  isWorkspaceVideoMediaAsset,
  normalizeWorkspaceSegmentAiPhotoPrompt,
  truncateStudioCustomAssetName,
} from "./workspace-segment-editor";
import { getStudioMusicOptionCopy, studioMusicOptions, type StudioMusicType } from "./workspace-studio-options";
import type {
  StudioCustomMusicFile,
  StudioCustomVideoFile,
  WorkspaceSegmentAiVideoMode,
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentEditorSegment,
} from "./workspace-types";

export type WorkspaceSegmentVisualModalTab =
  | "ai_photo"
  | "library"
  | "upload"
  | "ai_video"
  | "image_edit"
  | "image_upscale"
  | "infographic"
  | "photo_animation"
  | "scene_sound"
  | "talking_photo"
  | "voiceover";
export type WorkspaceSegmentEditorPromptToolTab = WorkspaceSegmentVisualModalTab;

export type WorkspaceProjectCharacter = {
  aliases: string[];
  characterId: number;
  description: string | null;
  label: string;
  referenceAssetIds: number[];
  sourceSegmentIds: number[];
};

export const getStudioMusicChipValue = (musicType: StudioMusicType, customMusicFile: StudioCustomMusicFile | null, locale = "ru") => {
  if (musicType === "custom") {
    return customMusicFile ? truncateStudioCustomAssetName(customMusicFile.fileName) : locale === "en" ? "Custom music" : "Своя музыка";
  }

  const option = studioMusicOptions.find((item) => item.id === musicType);
  return option ? getStudioMusicOptionCopy(option, locale).label : locale === "en" ? "Auto" : "Авто";
};

export const getWorkspaceSegmentAiPhotoPromptPrefill = (segment: Pick<WorkspaceSegmentEditorSegment, "text">) =>
  String(segment.text ?? "").trim();

export const isWorkspaceSegmentAiPhotoReady = (segment: Pick<
  WorkspaceSegmentEditorDraftSegment,
  "aiPhotoAsset" | "aiPhotoGeneratedFromPrompt" | "aiPhotoPrompt"
>) =>
  Boolean(segment.aiPhotoAsset) &&
  normalizeWorkspaceSegmentAiPhotoPrompt(segment.aiPhotoGeneratedFromPrompt) ===
    normalizeWorkspaceSegmentAiPhotoPrompt(segment.aiPhotoPrompt);

export const normalizeWorkspaceSegmentImageEditPrompt = normalizeWorkspaceSegmentAiPhotoPrompt;

export const isWorkspaceSegmentImageEditReady = (segment: Pick<
  WorkspaceSegmentEditorDraftSegment,
  "imageEditAsset" | "imageEditGeneratedFromPrompt" | "imageEditPrompt"
>) =>
  Boolean(segment.imageEditAsset) &&
  normalizeWorkspaceSegmentImageEditPrompt(segment.imageEditGeneratedFromPrompt) ===
    normalizeWorkspaceSegmentImageEditPrompt(segment.imageEditPrompt);

export const normalizeWorkspaceSegmentAiVideoPrompt = normalizeWorkspaceSegmentAiPhotoPrompt;
export const isWorkspaceSegmentAiVideoReady = (segment: Pick<
  WorkspaceSegmentEditorDraftSegment,
  "aiVideoAsset" | "aiVideoGeneratedFromPrompt" | "aiVideoGeneratedMode" | "aiVideoPrompt"
>, mode?: WorkspaceSegmentAiVideoMode) =>
  Boolean(segment.aiVideoAsset) &&
  (!mode || segment.aiVideoGeneratedMode === mode) &&
  normalizeWorkspaceSegmentAiVideoPrompt(segment.aiVideoGeneratedFromPrompt) ===
    normalizeWorkspaceSegmentAiVideoPrompt(segment.aiVideoPrompt);

export const getWorkspaceSegmentSceneSoundVisualAssetId = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) => {
  if (!segment) {
    return undefined;
  }

  const getAssetIdFromMediaUrl = (value: unknown) => {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) {
      return null;
    }

    const workspaceMatch = normalized.match(/\/api\/workspace\/media-assets\/(\d+)(?:[/?#]|$)/i);
    if (workspaceMatch) {
      return getPositiveWorkspaceMediaAssetId(workspaceMatch[1]);
    }

    const adsflowMatch = normalized.match(/\/api\/media\/(\d+)\/download(?:[/?#]|$)/i);
    if (adsflowMatch) {
      return getPositiveWorkspaceMediaAssetId(adsflowMatch[1]);
    }

    return null;
  };

  const getAssetIdFromMediaUrls = (...values: unknown[]) => {
    for (const value of values) {
      const assetId = getAssetIdFromMediaUrl(value);
      if (assetId) {
        return assetId;
      }
    }
    return null;
  };

  const draftVisualAsset = getWorkspaceSegmentDraftVisualAsset(segment);
  const draftVisualAssetId = getPositiveWorkspaceMediaAssetId(draftVisualAsset?.assetId);
  if (draftVisualAssetId) {
    return draftVisualAssetId;
  }
  const draftVisualUrlAssetId = getAssetIdFromMediaUrls(draftVisualAsset?.remoteUrl, draftVisualAsset?.objectUrl);
  if (draftVisualUrlAssetId) {
    return draftVisualUrlAssetId;
  }
  if (draftVisualAsset) {
    return undefined;
  }

  const currentAssetId = getPositiveWorkspaceMediaAssetId(segment.currentAsset?.assetId);
  if (currentAssetId) {
    return currentAssetId;
  }
  const currentUrlAssetId = getAssetIdFromMediaUrls(
    segment.currentAsset?.playbackUrl,
    segment.currentAsset?.downloadUrl,
    segment.currentAsset?.downloadPath,
    segment.currentPlaybackUrl,
    segment.currentPreviewUrl,
    segment.currentExternalPlaybackUrl,
    segment.currentExternalPreviewUrl,
  );
  if (currentUrlAssetId) {
    return currentUrlAssetId;
  }

  const originalAssetId = getPositiveWorkspaceMediaAssetId(segment.originalAsset?.assetId);
  if (originalAssetId) {
    return originalAssetId;
  }

  return getAssetIdFromMediaUrls(
    segment.originalAsset?.playbackUrl,
    segment.originalAsset?.downloadUrl,
    segment.originalAsset?.downloadPath,
    segment.originalPlaybackUrl,
    segment.originalPreviewUrl,
    segment.originalExternalPlaybackUrl,
    segment.originalExternalPreviewUrl,
  ) ?? undefined;
};

export const getWorkspaceSegmentSceneSoundVisualJobSource = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) => {
  const visualAsset = segment ? getWorkspaceSegmentDraftVisualAsset(segment) : null;
  const remoteUrl = String(visualAsset?.remoteUrl ?? "").trim();
  if (!remoteUrl) {
    return null;
  }

  try {
    const url = new URL(remoteUrl, "http://localhost");
    const match = url.pathname.match(
      /^\/api\/studio\/(segment-ai-video|segment-photo-animation|segment-talking-photo)\/jobs\/([^/]+)\/video$/i,
    );
    if (!match) {
      return null;
    }

    const visualSourceJobId = decodeURIComponent(match[2] ?? "").trim();
    if (!visualSourceJobId) {
      return null;
    }

    return {
      visualSourceJobId,
      visualSourceKind: match[1] as "segment-ai-video" | "segment-photo-animation" | "segment-talking-photo",
    };
  } catch {
    return null;
  }
};

export const getWorkspaceSegmentSceneSoundSourceVisualIdentity = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) => {
  const mediaAssetId = getWorkspaceSegmentSceneSoundVisualAssetId(segment);
  if (mediaAssetId) {
    return `asset:${mediaAssetId}`;
  }

  const jobSource = getWorkspaceSegmentSceneSoundVisualJobSource(segment);
  if (jobSource) {
    return `job:${jobSource.visualSourceKind}:${jobSource.visualSourceJobId}`;
  }

  return segment ? getStudioCustomVideoFileIdentityKey(getWorkspaceSegmentDraftVisualAsset(segment)) : null;
};

export const applyWorkspaceSegmentSceneSoundVisualAssetId = (
  segment: WorkspaceSegmentEditorDraftSegment,
  assetId: number | null | undefined,
): WorkspaceSegmentEditorDraftSegment => {
  const normalizedAssetId = getPositiveWorkspaceMediaAssetId(assetId);
  if (!normalizedAssetId) {
    return segment;
  }

  const attachAssetId = (asset: StudioCustomVideoFile | null): StudioCustomVideoFile | null =>
    asset ? { ...asset, assetId: normalizedAssetId } : asset;
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (latestVisualAction === "custom") {
    return { ...segment, customVideo: attachAssetId(segment.customVideo) };
  }

  if (latestVisualAction === "ai_photo") {
    return { ...segment, aiPhotoAsset: attachAssetId(segment.aiPhotoAsset) };
  }

  if (latestVisualAction === "image_edit") {
    return { ...segment, imageEditAsset: attachAssetId(segment.imageEditAsset) };
  }

  if (
    latestVisualAction === "ai" ||
    latestVisualAction === "photo_animation" ||
    latestVisualAction === "talking_photo"
  ) {
    return { ...segment, aiVideoAsset: attachAssetId(segment.aiVideoAsset) };
  }

  return segment;
};

export const getWorkspaceSegmentCurrentVideoSourceAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
): StudioCustomVideoFile | null => {
  const draftVisualAsset = getWorkspaceSegmentDraftVisualAsset(segment);
  if (getWorkspaceSegmentCustomPreviewKind(draftVisualAsset) === "video" && draftVisualAsset) {
    return draftVisualAsset;
  }

  const currentAssetId = getPositiveWorkspaceMediaAssetId(segment.currentAsset?.assetId);
  if (currentAssetId && isWorkspaceVideoMediaAsset(segment.currentAsset)) {
    return {
      assetId: currentAssetId,
      fileName: `segment-video-${segment.index + 1}.mp4`,
      fileSize: 0,
      mimeType: segment.currentAsset?.mimeType || "video/mp4",
      remoteUrl:
        getWorkspaceMediaAssetDurablePreviewUrl({
          assetId: currentAssetId,
          mimeType: segment.currentAsset?.mimeType || "video/mp4",
          remoteUrl: segment.currentAsset?.playbackUrl || segment.currentAsset?.downloadUrl,
        }) ?? undefined,
    };
  }

  const originalAssetId = getPositiveWorkspaceMediaAssetId(segment.originalAsset?.assetId);
  if (originalAssetId && isWorkspaceVideoMediaAsset(segment.originalAsset)) {
    return {
      assetId: originalAssetId,
      fileName: `segment-video-${segment.index + 1}.mp4`,
      fileSize: 0,
      mimeType: segment.originalAsset?.mimeType || "video/mp4",
      remoteUrl:
        getWorkspaceMediaAssetDurablePreviewUrl({
          assetId: originalAssetId,
          mimeType: segment.originalAsset?.mimeType || "video/mp4",
          remoteUrl: segment.originalAsset?.playbackUrl || segment.originalAsset?.downloadUrl,
        }) ?? undefined,
    };
  }

  const remoteUrl =
    segment.currentExternalPlaybackUrl ??
    segment.currentPlaybackUrl ??
    segment.originalExternalPlaybackUrl ??
    segment.originalPlaybackUrl ??
    "";
  if (getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "video" || !remoteUrl) {
    return null;
  }

  return {
    fileName: `segment-video-${segment.index + 1}.mp4`,
    fileSize: 0,
    mimeType: "video/mp4",
    remoteUrl,
  };
};

export const getWorkspaceSegmentTalkingCharacterSourceAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
): StudioCustomVideoFile | null => {
  return getWorkspaceSegmentCurrentVideoSourceAsset(segment) ?? getWorkspaceSegmentPhotoAnimationSourceAsset(segment);
};

export const getWorkspaceSegmentInfographicSourceAsset = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
): StudioCustomVideoFile | null => {
  if (!segment) {
    return null;
  }

  const draftVisualAsset = getWorkspaceSegmentDraftVisualAsset(segment);
  if (draftVisualAsset) {
    return draftVisualAsset;
  }

  return getWorkspaceSegmentCurrentVideoSourceAsset(segment) ?? getWorkspaceSegmentLatestEditablePhotoAsset(segment);
};

export const getWorkspaceSegmentInfographicSourceIdentity = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) => getStudioCustomVideoFileIdentityKey(getWorkspaceSegmentInfographicSourceAsset(segment));

export const isWorkspaceSegmentInfographicJobSourceCurrent = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  sourceVisualIdentity: string | null | undefined,
  sourceClientVisualIdentity?: string | null,
) => {
  const currentIdentity = getWorkspaceSegmentInfographicSourceIdentity(segment);
  const expectedIdentities = [sourceVisualIdentity, sourceClientVisualIdentity]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  return Boolean(currentIdentity && expectedIdentities.includes(currentIdentity));
};

export const getWorkspaceSegmentSceneReferenceAssetId = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) => {
  if (!segment) {
    return undefined;
  }

  const latestPhotoAssetId = getPositiveWorkspaceMediaAssetId(getWorkspaceSegmentLatestEditablePhotoAsset(segment)?.assetId);
  if (latestPhotoAssetId) {
    return latestPhotoAssetId;
  }

  const draftVisualAsset = getWorkspaceSegmentDraftVisualAsset(segment);
  if (getWorkspaceSegmentCustomPreviewKind(draftVisualAsset) === "image") {
    const draftVisualAssetId = getPositiveWorkspaceMediaAssetId(draftVisualAsset?.assetId);
    if (draftVisualAssetId) {
      return draftVisualAssetId;
    }
  }

  const currentAssetId = isWorkspacePhotoMediaAsset(segment.currentAsset)
    ? getPositiveWorkspaceMediaAssetId(segment.currentAsset?.assetId)
    : undefined;
  return currentAssetId ?? (isWorkspacePhotoMediaAsset(segment.originalAsset)
    ? getPositiveWorkspaceMediaAssetId(segment.originalAsset?.assetId)
    : undefined);
};

export const normalizeWorkspaceProjectCharacter = (value: unknown): WorkspaceProjectCharacter | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const characterId = getPositiveWorkspaceMediaAssetId(record.characterId ?? record.character_id);
  const label = String(record.label ?? "").trim();
  if (!characterId || !label) {
    return null;
  }
  const normalizeTextList = (source: unknown) =>
    (Array.isArray(source) ? source : [])
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  const normalizeSegmentIds = (source: unknown) => {
    const result: number[] = [];
    for (const item of Array.isArray(source) ? source : []) {
      const numeric = Number(item);
      if (!Number.isFinite(numeric)) {
        continue;
      }
      const normalized = Math.trunc(numeric);
      if (normalized >= 0 && !result.includes(normalized)) {
        result.push(normalized);
      }
    }
    return result;
  };

  const rawReferenceAssetIds = Array.isArray(record.referenceAssetIds)
    ? record.referenceAssetIds
    : Array.isArray(record.reference_asset_ids)
      ? record.reference_asset_ids
      : [];

  return {
    aliases: normalizeTextList(record.aliases),
    characterId,
    description: String(record.description ?? "").trim() || null,
    label,
    referenceAssetIds: rawReferenceAssetIds
      .map(getPositiveWorkspaceMediaAssetId)
      .filter((assetId): assetId is number => Boolean(assetId)),
    sourceSegmentIds: normalizeSegmentIds(record.sourceSegmentIds ?? record.source_segment_ids),
  };
};

export const normalizeWorkspaceSavedReference = (value: unknown): WorkspaceSavedReference | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const kind = record.kind === "character" || record.kind === "scene" ? record.kind : null;
  const id = String(record.id ?? "").trim();
  const name = String(record.name ?? "").trim();
  const assetId = getPositiveWorkspaceMediaAssetId(record.assetId ?? record.asset_id);
  if (!kind || !id || !name || !assetId) {
    return null;
  }

  const createdAt = String(record.createdAt ?? record.created_at ?? "").trim() || new Date().toISOString();
  const updatedAt = String(record.updatedAt ?? record.updated_at ?? "").trim() || createdAt;

  return {
    assetId,
    createdAt,
    description: String(record.description ?? "").trim() || null,
    id,
    kind,
    name,
    sourceProjectId: getPositiveWorkspaceMediaAssetId(record.sourceProjectId ?? record.source_project_id) ?? null,
    sourceSegmentIndex:
      typeof record.sourceSegmentIndex === "number"
        ? Math.max(0, Math.trunc(record.sourceSegmentIndex))
        : typeof record.source_segment_index === "number"
          ? Math.max(0, Math.trunc(record.source_segment_index))
          : null,
    updatedAt,
  };
};

const shouldForceFreshPhotoAnimationSourceUpload = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  sourceAsset: StudioCustomVideoFile | null | undefined,
) => {
  if (!segment || !sourceAsset || getWorkspaceSegmentCustomPreviewKind(sourceAsset) !== "image") {
    return false;
  }

  const hasUploadableBytes = Boolean(sourceAsset.file || sourceAsset.dataUrl || sourceAsset.objectUrl);
  if (!hasUploadableBytes) {
    return false;
  }

  if (sourceAsset.source === "media-library" || sourceAsset.source === "upload") {
    return false;
  }

  return (
    (segment.videoAction === "ai_photo" && segment.aiPhotoAsset === sourceAsset) ||
    (segment.videoAction === "image_edit" && segment.imageEditAsset === sourceAsset) ||
    ((segment.videoAction === "photo_animation" || segment.videoAction === "talking_photo") &&
      segment.photoAnimationSourceAsset === sourceAsset)
  );
};

export const getWorkspacePhotoAnimationUploadSourceAsset = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  sourceAsset: StudioCustomVideoFile | null | undefined,
) => {
  if (!sourceAsset) {
      return null;
    }

  if (!shouldForceFreshPhotoAnimationSourceUpload(segment, sourceAsset)) {
    return sourceAsset;
  }

    return {
    ...sourceAsset,
    assetId: undefined,
    };
};

export const getWorkspaceSegmentImageEditSource = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const sourceAsset = getWorkspaceSegmentLatestEditablePhotoAsset(segment);
  if (!sourceAsset) {
      return null;
    }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);
  const defaultFileName =
    latestVisualAction === "image_edit"
      ? `segment-image-edit-${segment.index + 1}.png`
      : latestVisualAction === "ai_photo"
        ? `segment-ai-photo-${segment.index + 1}.png`
        : latestVisualAction === "custom"
          ? `segment-visual-${segment.index + 1}.png`
          : `segment-photo-${segment.index + 1}.png`;

    return {
    asset: sourceAsset,
    fileName: sourceAsset.fileName || defaultFileName,
  };
};

export const getWorkspaceSegmentImageUpscaleSource = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const sourceAsset = getWorkspaceSegmentLatestEditablePhotoAsset(segment);
  if (!sourceAsset) {
      return null;
    }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);
  const target =
    latestVisualAction === "ai_photo" && sourceAsset === segment.aiPhotoAsset
      ? ("ai_photo" as const)
      : latestVisualAction === "image_edit" && sourceAsset === segment.imageEditAsset
        ? ("image_edit" as const)
        : latestVisualAction === "custom" && sourceAsset === segment.customVideo
          ? ("custom" as const)
          : ("original" as const);

  const defaultFileName =
    target === "ai_photo"
      ? `segment-ai-photo-${segment.index + 1}.png`
      : target === "image_edit"
        ? `segment-image-edit-${segment.index + 1}.png`
        : target === "custom"
          ? `segment-visual-${segment.index + 1}.png`
          : `segment-photo-${segment.index + 1}.png`;

    return {
    asset: sourceAsset,
    fileName: sourceAsset.fileName || defaultFileName,
    target,
  };
};

const createWorkspaceSegmentGeneratedImageAsset = (
  asset: Pick<StudioCustomVideoFile, "assetId" | "dataUrl" | "fileName" | "fileSize" | "mimeType" | "remoteUrl">,
): StudioCustomVideoFile => ({
  assetId: asset.assetId,
  dataUrl: asset.dataUrl,
  fileName: asset.fileName,
  fileSize: asset.fileSize,
  mimeType: asset.mimeType,
  remoteUrl: getWorkspaceMediaAssetDurablePreviewUrl({
    assetId: asset.assetId ?? null,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    remoteUrl: asset.remoteUrl,
  }) ?? undefined,
});

export const applyWorkspaceSegmentUpscaledImageAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
  asset: Pick<StudioCustomVideoFile, "assetId" | "dataUrl" | "fileName" | "fileSize" | "mimeType" | "remoteUrl">,
): WorkspaceSegmentEditorDraftSegment => {
  const nextAsset = createWorkspaceSegmentGeneratedImageAsset(asset);

  if (segment.videoAction === "ai_photo" && getWorkspaceSegmentCustomPreviewKind(segment.aiPhotoAsset) === "image") {
    return {
      ...segment,
      aiPhotoAsset: nextAsset,
      durationExtensionSourceDurationSeconds: null,
      visualReset: false,
      videoAction: "ai_photo",
    };
  }

  if (segment.videoAction === "image_edit" && getWorkspaceSegmentCustomPreviewKind(segment.imageEditAsset) === "image") {
    return {
      ...segment,
      durationExtensionSourceDurationSeconds: null,
      imageEditAsset: nextAsset,
      visualReset: false,
      videoAction: "image_edit",
    };
  }

  return {
    ...segment,
    customVideo: nextAsset,
    durationExtensionSourceDurationSeconds: null,
    visualReset: false,
    videoAction: "custom",
  };
};

export const canWorkspaceSegmentUsePhotoEditingTools = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) =>
  Boolean(
    segment &&
      getWorkspaceSegmentSelectedVisualPreviewKind(segment) === "image",
  );

export const canWorkspaceSegmentAnimatePhoto = (segment: WorkspaceSegmentEditorDraftSegment | null | undefined) =>
  Boolean(segment && getWorkspaceSegmentPhotoAnimationSourceAsset(segment));

export const canWorkspaceSegmentUsePhotoAnimationTool = (segment: WorkspaceSegmentEditorDraftSegment | null | undefined) =>
  canWorkspaceSegmentAnimatePhoto(segment);

export const canWorkspaceSegmentCreateTalkingPhoto = (segment: WorkspaceSegmentEditorDraftSegment | null | undefined) =>
  Boolean(segment && getWorkspaceSegmentTalkingCharacterSourceAsset(segment));

export const canWorkspaceSegmentEditPhoto = (segment: WorkspaceSegmentEditorDraftSegment | null | undefined) =>
  Boolean(segment && canWorkspaceSegmentUsePhotoEditingTools(segment) && getWorkspaceSegmentImageEditSource(segment));

export const canWorkspaceSegmentUpscalePhoto = (segment: WorkspaceSegmentEditorDraftSegment | null | undefined) =>
  Boolean(segment && canWorkspaceSegmentUsePhotoEditingTools(segment) && getWorkspaceSegmentImageUpscaleSource(segment));

export const canWorkspaceSegmentCreateInfographic = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) => Boolean(
  segment &&
    (getWorkspaceSegmentSceneSoundVisualAssetId(segment) || getWorkspaceSegmentInfographicSourceAsset(segment)),
);

export const getWorkspaceSegmentVisualModalDefaultTab = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentVisualModalTab => {
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  return latestVisualAction === "custom"
    ? segment.customVideo?.source === "media-library"
      ? "library"
      : "upload"
    : latestVisualAction === "image_edit" && canWorkspaceSegmentEditPhoto(segment)
      ? "image_edit"
    : latestVisualAction === "ai_photo"
      ? "ai_photo"
    : latestVisualAction === "photo_animation" && canWorkspaceSegmentUsePhotoAnimationTool(segment)
      ? "photo_animation"
    : latestVisualAction === "talking_photo" && canWorkspaceSegmentCreateTalkingPhoto(segment)
      ? "talking_photo"
      : "ai_photo";
};

export const isWorkspaceSegmentVisualModalTabAllowed = (
  segment: WorkspaceSegmentEditorDraftSegment,
  tab: WorkspaceSegmentVisualModalTab,
) => {
  switch (tab) {
    case "photo_animation":
      return canWorkspaceSegmentUsePhotoAnimationTool(segment);
    case "talking_photo":
      return canWorkspaceSegmentCreateTalkingPhoto(segment);
    case "image_edit":
      return canWorkspaceSegmentEditPhoto(segment);
    case "image_upscale":
      return canWorkspaceSegmentUpscalePhoto(segment);
    case "infographic":
      return canWorkspaceSegmentCreateInfographic(segment);
    default:
      return true;
  }
};

export const isWorkspaceSegmentReadyVisualSelectionTab = (tab: WorkspaceSegmentVisualModalTab) =>
  tab === "library" || tab === "upload";

export const dispatchWorkspaceSegmentPromptVisualToolAction = (
  tab: WorkspaceSegmentVisualModalTab,
  actions: {
    openFilePicker: () => void;
    selectTab: (tab: WorkspaceSegmentVisualModalTab) => void;
  },
) => {
  if (tab === "upload") {
    actions.openFilePicker();
    return;
  }

  actions.selectTab(tab);
};

export const resolveWorkspaceSegmentVisualModalTab = (
  segment: WorkspaceSegmentEditorDraftSegment,
  tab: WorkspaceSegmentVisualModalTab,
): WorkspaceSegmentVisualModalTab =>
  isWorkspaceSegmentVisualModalTabAllowed(segment, tab) ? tab : getWorkspaceSegmentVisualModalDefaultTab(segment);

export const getWorkspaceSegmentPromptSceneModeForTab = (tab: WorkspaceSegmentEditorPromptToolTab): "create" | "edit" => {
  switch (tab) {
    case "photo_animation":
    case "talking_photo":
    case "image_edit":
    case "image_upscale":
    case "infographic":
    case "scene_sound":
    case "voiceover":
      return "edit";
    default:
      return "create";
  }
};

export const getWorkspaceSegmentPhotoToolUnavailableReason = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  fallbackReason: string,
) => {
  if (!segment) {
    return fallbackReason;
  }

  if (getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "image") {
    return "Сначала выберите фото";
  }

  return fallbackReason;
};
