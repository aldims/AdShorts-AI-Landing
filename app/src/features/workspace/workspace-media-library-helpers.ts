import {
  areStudioCustomVideoFilesSameIdentity,
  buildWorkspaceMediaAssetPlaybackUrl,
  buildWorkspaceMediaAssetProxyUrl,
  buildWorkspaceMediaLibraryAssetPosterUrl,
  cloneWorkspaceProject,
  cloneWorkspaceSegmentEditorDraftSegment,
  getPositiveWorkspaceMediaAssetId,
  getStudioCustomAssetPreviewUrl,
  getStudioCustomVideoFileIdentityKey,
  getStudioLanguageForVoiceId,
  getUniqueWorkspaceSegmentPreviewUrls,
  getWorkspaceMediaAssetDurablePreviewUrl,
  getWorkspaceMediaAssetIdentityKey,
  getWorkspaceMediaAssetResolvedPreviewUrl,
  getWorkspaceSegmentPhotoAnimationSourceAsset,
  getWorkspaceSegmentPreferredStillPreviewUrl,
  getWorkspaceSegmentStillPreviewUrls,
  hasWorkspaceSegmentExplicitDraftVisual,
  isWorkspaceSegmentEditorDraftSegmentEmpty,
} from "./workspace-segment-editor";
import type {
  StudioCustomVideoFile,
  WorkspaceProject,
  WorkspaceSegmentAiVideoMode,
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentEditorDraftSession,
  WorkspaceSegmentEditorVideoAction,
} from "./workspace-types";
import type { Locale } from "../../lib/i18n";
import {
  createWorkspaceMediaLibraryItem,
  getWorkspaceImageDownloadName,
  getWorkspaceProjectDisplayTitle,
  getWorkspaceVideoDownloadName,
  hasWorkspaceMediaLibraryLegacyFallbackDownloadUrl,
  isWorkspaceMediaLibraryItemDurableForStorage,
  normalizeWorkspaceMediaLibraryCreatedAt,
  type WorkspaceMediaLibraryItem,
  type WorkspaceMediaLibraryItemKind,
  type WorkspaceMediaLibraryItemSource,
  type WorkspaceMediaLibraryPreviewKind,
} from "../../lib/workspaceMediaLibrary";
import {
  resolveWorkspaceMediaSurface,
  type WorkspaceResolvedMediaContext,
  type WorkspaceResolvedMediaSurface,
} from "../../lib/workspaceResolvedMedia";

const workspaceText = (locale: Locale, ru: string, en: string) => (locale === "en" ? en : ru);
const normalizeWorkspaceEmail = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();
const getVideoDownloadName = getWorkspaceVideoDownloadName;
const getImageDownloadName = getWorkspaceImageDownloadName;

const getWorkspaceMediaAssetPosterUrlAssetId = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(normalizedValue, "http://localhost");
    const match = url.pathname.match(/^\/api\/workspace\/media-assets\/(\d+)\/poster$/i);
    return match ? getPositiveWorkspaceMediaAssetId(match[1]) : null;
  } catch {
    return null;
  }
};

const getStableWorkspaceMediaAssetPosterUrl = (
  asset: Pick<StudioCustomVideoFile, "assetId"> | null | undefined,
  posterUrl: string,
) => {
  const posterAssetId = getWorkspaceMediaAssetPosterUrlAssetId(posterUrl);
  if (!posterAssetId) {
    return posterUrl;
  }

  const assetId = getPositiveWorkspaceMediaAssetId(asset?.assetId);
  if (assetId && assetId !== posterAssetId) {
    return posterUrl;
  }

  try {
    const url = new URL(posterUrl, "http://localhost");
    const version = url.searchParams.get("v");
    return !version || version.includes(":")
      ? `/api/workspace/media-assets/${posterAssetId}/poster`
      : posterUrl;
  } catch {
    return posterUrl;
  }
};

export type WorkspaceGeneratedMediaLibraryEntry = {
  createdAt: number;
  id: string;
  item: WorkspaceMediaLibraryItem;
  sourceJobId: string;
};

export type StoredWorkspaceGeneratedMediaLibraryEntry = {
  createdAt: number;
  id: string;
  item: WorkspaceMediaLibraryItem;
  sourceJobId: string;
};

export const shouldShowWorkspaceMediaLibraryLoadingState = (options: {
  hasVisibleItems: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasError: boolean;
  hasNextCursor: boolean;
  displayTotalCount: number | null;
}) => {
  if (options.hasError || !options.isLoading) {
    return false;
  }

  if (options.hasVisibleItems) {
    return true;
  }

  if (!options.isLoadingMore) {
    return true;
  }

  return options.hasNextCursor && (options.displayTotalCount === null || options.displayTotalCount > 0);
};

export const getStudioCustomAssetPosterUrl = (
  asset: Pick<StudioCustomVideoFile, "assetId" | "fileName" | "mimeType" | "posterUrl"> | null | undefined,
) => {
  const posterUrl = typeof asset?.posterUrl === "string" ? asset.posterUrl.trim() : "";
  if (posterUrl) {
    return getStableWorkspaceMediaAssetPosterUrl(asset, posterUrl);
  }

  const assetId = getPositiveWorkspaceMediaAssetId(asset?.assetId);
  const fileName = String(asset?.fileName ?? "").trim().toLowerCase();
  const mimeType = String(asset?.mimeType ?? "").trim().toLowerCase();
  const isVideoAsset =
    mimeType.startsWith("video/") ||
    /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(fileName);

  return assetId && isVideoAsset ? `/api/workspace/media-assets/${assetId}/poster` : null;
};

export const isStudioSegmentPhotoAnimationPosterUrl = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue.includes("/api/studio/segment-photo-animation/jobs/") && normalizedValue.includes("/poster");
};

export const isStudioSegmentTalkingPhotoPosterUrl = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue.includes("/api/studio/segment-talking-photo/jobs/") && normalizedValue.includes("/poster");
};

export const isStudioSegmentAiVideoPosterUrl = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue.includes("/api/studio/segment-ai-video/jobs/") && normalizedValue.includes("/poster");
};

export const getWorkspaceAiVideoPreferredPosterUrl = (
  segment: WorkspaceSegmentEditorDraftSegment,
  asset: Pick<StudioCustomVideoFile, "assetId" | "fileName" | "mimeType" | "posterUrl"> | null | undefined,
) => {
  const assetPosterUrl = getStudioCustomAssetPosterUrl(asset);
  if (!assetPosterUrl || isStudioSegmentAiVideoPosterUrl(assetPosterUrl)) {
    return null;
  }

  if (assetPosterUrl && getWorkspaceSegmentStillPreviewUrls(segment).includes(assetPosterUrl)) {
    return null;
  }

  return assetPosterUrl;
};

export const getWorkspacePhotoAnimationSourcePosterUrl = (segment: WorkspaceSegmentEditorDraftSegment) =>
  getStudioCustomAssetPreviewUrl(getWorkspaceSegmentPhotoAnimationSourceAsset(segment)) ??
  getWorkspaceSegmentPreferredStillPreviewUrl(segment);

export const getWorkspacePhotoAnimationPreferredPosterUrl = (
  segment: WorkspaceSegmentEditorDraftSegment,
  asset: Pick<StudioCustomVideoFile, "assetId" | "fileName" | "mimeType" | "posterUrl"> | null | undefined,
) => {
  const sourcePosterUrl = getWorkspacePhotoAnimationSourcePosterUrl(segment);
  if (sourcePosterUrl) {
    return sourcePosterUrl;
  }

  const assetPosterUrl = getStudioCustomAssetPosterUrl(asset);
  if (!assetPosterUrl || isStudioSegmentPhotoAnimationPosterUrl(assetPosterUrl) || isStudioSegmentTalkingPhotoPosterUrl(assetPosterUrl)) {
    return null;
  }

  return assetPosterUrl;
};

const isWorkspaceMediaLibraryGeneratedPosterProxyUrl = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue.includes("/api/workspace/media-library-preview");
};

const getWorkspaceMediaLibraryResolvedPosterUrl = (item: WorkspaceMediaLibraryItem) => {
  const assetPosterUrl = buildWorkspaceMediaLibraryAssetPosterUrl(item);
  const shouldPreferAssetPoster =
    item.previewKind === "video" &&
    Boolean(assetPosterUrl) &&
    (isWorkspaceMediaLibraryGeneratedPosterProxyUrl(item.previewPosterUrl) ||
      (item.kind === "photo_animation" && isStudioSegmentPhotoAnimationPosterUrl(item.previewPosterUrl)) ||
      (item.kind === "talking_photo" && isStudioSegmentTalkingPhotoPosterUrl(item.previewPosterUrl)) ||
      (item.kind === "ai_video" && isStudioSegmentAiVideoPosterUrl(item.previewPosterUrl)));

  if (shouldPreferAssetPoster) {
    return assetPosterUrl;
  }

  return item.previewPosterUrl || assetPosterUrl;
};

const isWorkspaceMediaLibraryTileContext = (context: WorkspaceResolvedMediaContext) =>
  context === "media-library-tile" || context === "segment-modal-library-tile";

const getWorkspaceMediaLibraryPositiveAssetId = (item: WorkspaceMediaLibraryItem) =>
  typeof item.assetId === "number" && Number.isFinite(item.assetId) && item.assetId > 0
    ? Math.trunc(item.assetId)
    : null;

export const getWorkspaceMediaLibraryTileImageUrl = (item: WorkspaceMediaLibraryItem) => {
  if (item.previewKind !== "image") {
    return item.previewUrl;
  }

  const assetId = getWorkspaceMediaLibraryPositiveAssetId(item);
  if (assetId) {
    return `/api/workspace/media-assets/${assetId}/preview`;
  }

  if (isWorkspaceMediaLibraryGeneratedPosterProxyUrl(item.previewPosterUrl)) {
    return item.previewPosterUrl ?? item.previewUrl;
  }

  return item.previewPosterUrl || item.previewUrl;
};

export const getWorkspaceMediaLibraryTilePosterUrl = (item: WorkspaceMediaLibraryItem) => {
  if (item.previewKind !== "video") {
    return null;
  }

  const assetId = getWorkspaceMediaLibraryPositiveAssetId(item);
  return assetId
    ? `/api/workspace/media-assets/${assetId}/poster?tile=1`
    : getWorkspaceMediaLibraryResolvedPosterUrl(item);
};

const getWorkspaceMediaLibrarySelectionPosterUrl = (item: WorkspaceMediaLibraryItem) => {
  if (item.previewKind !== "video") {
    return undefined;
  }

  const posterUrl = String(item.previewPosterUrl ?? "").trim();
  return posterUrl || undefined;
};

export const getWorkspaceMediaLibraryResolvedMediaSurface = (
  item: WorkspaceMediaLibraryItem,
  context: WorkspaceResolvedMediaContext,
): WorkspaceResolvedMediaSurface =>
  resolveWorkspaceMediaSurface({
    context,
    displayUrl:
      isWorkspaceMediaLibraryTileContext(context) && item.previewKind === "image"
        ? getWorkspaceMediaLibraryTileImageUrl(item)
        : item.previewUrl,
    isGeneratedVideo: item.kind === "ai_video" || item.kind === "photo_animation" || item.kind === "talking_photo",
    posterUrl:
      item.previewKind === "video"
        ? isWorkspaceMediaLibraryTileContext(context)
          ? getWorkspaceMediaLibraryTilePosterUrl(item)
          : getWorkspaceMediaLibraryResolvedPosterUrl(item)
        : null,
    previewKind: item.previewKind,
    viewerUrl: item.previewUrl,
  });

export const getWorkspaceMediaLibraryItemStorageKey = (item: WorkspaceMediaLibraryItem) => item.itemKey;

export const getWorkspaceMediaLibraryItemKindLabel = (
  kind: WorkspaceMediaLibraryItemKind,
  assetKind?: string | null,
  locale: Locale = "ru",
) => {
  const normalizedAssetKind = String(assetKind ?? "").trim().toLowerCase();
  if (normalizedAssetKind === "final_video") {
    return workspaceText(locale, "Готовое видео", "Finished video");
  }

  if (normalizedAssetKind === "custom_video" || normalizedAssetKind === "segment_source") {
    return workspaceText(locale, "Загруженное видео", "Uploaded video");
  }

  if (normalizedAssetKind === "brand_logo" || normalizedAssetKind === "uploaded_photo") {
    return workspaceText(locale, "Загруженное фото", "Uploaded photo");
  }

  if (kind === "photo_animation") {
    return workspaceText(locale, "ИИ анимация фото", "AI photo animation");
  }

  if (kind === "talking_photo") {
    return workspaceText(locale, "Говорящий персонаж", "Talking character");
  }

  if (kind === "ai_video") {
    return workspaceText(locale, "ИИ видео", "AI video");
  }

  if (kind === "image_edit") {
    return workspaceText(locale, "Дорисовать", "Image edit");
  }

  if (kind === "character_reference") {
    return workspaceText(locale, "Персонаж", "Character");
  }

  if (kind === "scene_reference") {
    return workspaceText(locale, "Сцена", "Scene");
  }

  return workspaceText(locale, "ИИ фото", "AI photo");
};

export const getWorkspaceMediaLibraryDisplayItemKindLabel = (
  kind: WorkspaceMediaLibraryItemKind,
  assetKind?: string | null,
  locale: Locale = "ru",
) =>
  kind === "photo_animation"
    ? workspaceText(locale, "ИИ видео", "AI video")
    : getWorkspaceMediaLibraryItemKindLabel(kind, assetKind, locale);

const getWorkspaceMediaLibraryItemMimeType = (item: WorkspaceMediaLibraryItem) =>
  item.previewKind === "video" ? "video/mp4" : "image/jpeg";

const getWorkspaceMediaLibraryItemAssetId = (item: Pick<WorkspaceMediaLibraryItem, "assetId">) =>
  getPositiveWorkspaceMediaAssetId(item.assetId);

const getWorkspaceMediaLibraryCanonicalAssetRouteId = (
  value: string | null | undefined,
  previewKind: WorkspaceMediaLibraryPreviewKind,
) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(normalizedValue, "http://localhost");
    const match = url.pathname.match(/^\/api\/workspace\/media-assets\/(\d+)(?:\/(playback))?$/i);
    if (!match) {
      return null;
    }

    const assetId = getPositiveWorkspaceMediaAssetId(match[1]);
    if (!assetId) {
      return null;
    }

    const isPlaybackRoute = match[2] === "playback";
    if (previewKind === "video" && !isPlaybackRoute) {
      return null;
    }

    if (previewKind === "image" && isPlaybackRoute) {
      return null;
    }

    return assetId;
  } catch {
    return null;
  }
};

export const getWorkspaceMediaLibraryItemRemoteUrl = (item: WorkspaceMediaLibraryItem) => {
  const assetId = getWorkspaceMediaLibraryItemAssetId(item);
  const mimeType = getWorkspaceMediaLibraryItemMimeType(item);

  if (item.source === "persisted" && assetId) {
    return getWorkspaceMediaAssetResolvedPreviewUrl({
      assetId,
      fileName: item.downloadName,
      mimeType,
    });
  }

  const previewUrl = String(item.previewUrl ?? "").trim();
  if (previewUrl) {
    return previewUrl;
  }

  return getWorkspaceMediaAssetResolvedPreviewUrl({
    assetId,
    fileName: item.downloadName,
    mimeType,
    remoteUrl: item.downloadUrl,
  });
};

export const getWorkspaceMediaLibrarySelectionAssetId = (item: WorkspaceMediaLibraryItem) => {
  const assetId = getWorkspaceMediaLibraryItemAssetId(item);
  if (!assetId) {
    return undefined;
  }

  if (item.source === "persisted") {
    return assetId;
  }

  const selectionRemoteUrl = getWorkspaceMediaLibraryItemRemoteUrl(item);
  return getWorkspaceMediaLibraryCanonicalAssetRouteId(selectionRemoteUrl, item.previewKind) === assetId
    ? assetId
    : undefined;
};

export const createStudioCustomVideoFileFromMediaLibraryItem = (
  item: WorkspaceMediaLibraryItem,
): StudioCustomVideoFile => ({
  assetId: getWorkspaceMediaLibrarySelectionAssetId(item),
  fileName: item.downloadName,
  fileSize: 0,
  libraryItemKey: getWorkspaceMediaLibraryItemStorageKey(item),
  mimeType: getWorkspaceMediaLibraryItemMimeType(item),
  posterUrl: getWorkspaceMediaLibrarySelectionPosterUrl(item),
  remoteUrl: getWorkspaceMediaLibraryItemRemoteUrl(item) ?? undefined,
  source: "media-library",
});

const getWorkspaceGeneratedMediaLibraryRestoreKey = (
  projectId: number,
  segmentIndex: number,
  kind: WorkspaceMediaLibraryItemKind,
) => `${projectId}:${segmentIndex}:${kind}`;

const doesWorkspaceGeneratedMediaLibraryItemMatchSegmentVisual = (
  segment: WorkspaceSegmentEditorDraftSegment,
  item: WorkspaceMediaLibraryItem,
) => {
  const itemAssetId = Number(item.assetId);
  const itemAssetIdentity = Number.isFinite(itemAssetId) && itemAssetId > 0 ? `asset:${Math.trunc(itemAssetId)}` : null;
  if (itemAssetIdentity) {
    const segmentAssetIdentities = [
      getWorkspaceMediaAssetIdentityKey(segment.currentAsset),
      getWorkspaceMediaAssetIdentityKey(segment.originalAsset),
    ].filter(Boolean);
    if (segmentAssetIdentities.includes(itemAssetIdentity)) {
      return true;
    }
  }

  const itemUrls = getUniqueWorkspaceSegmentPreviewUrls([item.previewUrl, item.previewPosterUrl, item.downloadUrl]);
  if (!itemUrls.length) {
    return false;
  }

  const segmentUrls = getUniqueWorkspaceSegmentPreviewUrls([
    segment.currentExternalPlaybackUrl,
    segment.currentExternalPreviewUrl,
    segment.currentPlaybackUrl,
    segment.currentPreviewUrl,
    segment.originalExternalPlaybackUrl,
    segment.originalExternalPreviewUrl,
    segment.originalPlaybackUrl,
    segment.originalPreviewUrl,
  ]);

  return itemUrls.some((itemUrl) => segmentUrls.includes(itemUrl));
};

const shouldHydrateWorkspaceGeneratedMediaLibraryItem = (
  segment: WorkspaceSegmentEditorDraftSegment,
  item: WorkspaceMediaLibraryItem,
  options: {
    allowPersistedGeneratedVideoRecovery?: boolean;
    allowExplicitDraftVisual?: boolean;
    videoAction: WorkspaceSegmentEditorVideoAction;
    aiVideoMode?: WorkspaceSegmentAiVideoMode;
  },
) => {
  if (isWorkspaceSegmentEditorDraftSegmentEmpty(segment)) {
    return false;
  }

  if (segment.visualReset) {
    return false;
  }

  const hasExplicitDraftVisual = hasWorkspaceSegmentExplicitDraftVisual(segment);
  if (hasExplicitDraftVisual && !options.allowExplicitDraftVisual) {
    return false;
  }

  if (
    segment.videoAction === options.videoAction ||
    (options.aiVideoMode && segment.aiVideoGeneratedMode === options.aiVideoMode)
  ) {
    return true;
  }

  if (
    options.allowPersistedGeneratedVideoRecovery &&
    item.source === "persisted" &&
    item.previewKind === "video" &&
    item.kind === "talking_photo" &&
    !segment.aiVideoAsset &&
    !hasExplicitDraftVisual
  ) {
    return true;
  }

  if (hasExplicitDraftVisual || segment.videoAction !== "original" || item.source !== "live") {
    return false;
  }

  return doesWorkspaceGeneratedMediaLibraryItemMatchSegmentVisual(segment, item);
};

export const buildWorkspaceGeneratedMediaLibraryEntriesFromMediaLibraryItems = (
  items: WorkspaceMediaLibraryItem[],
): WorkspaceGeneratedMediaLibraryEntry[] =>
  items
    .filter(
      (item) =>
        item.source === "persisted" &&
        (item.kind === "ai_video" || item.kind === "photo_animation" || item.kind === "talking_photo"),
    )
    .map((item) => ({
      createdAt: item.createdAt,
      id: item.itemKey,
      item,
      sourceJobId: item.itemKey,
    }));

export const hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary = (
  draft: WorkspaceSegmentEditorDraftSession | null | undefined,
  generatedEntries: WorkspaceGeneratedMediaLibraryEntry[],
): WorkspaceSegmentEditorDraftSession | null => {
  if (!draft) {
    return null;
  }

  if (!generatedEntries.length) {
    return draft;
  }

  const latestItemsByRestoreKey = new Map<string, WorkspaceMediaLibraryItem>();
  generatedEntries
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt)
    .forEach((entry) => {
      const projectId = Number(entry.item.projectId);
      const segmentIndex = Number(entry.item.segmentIndex);
      if (!Number.isInteger(projectId) || projectId < 0 || !Number.isInteger(segmentIndex) || segmentIndex < 0) {
        return;
      }

      const restoreKey = getWorkspaceGeneratedMediaLibraryRestoreKey(projectId, segmentIndex, entry.item.kind);
      if (!latestItemsByRestoreKey.has(restoreKey)) {
        latestItemsByRestoreKey.set(restoreKey, entry.item);
      }
    });

  let hasChanges = false;
  const nextSegments = draft.segments.map((segment) => {
    let nextSegment = segment;

    const applyPatch = (patch: Partial<WorkspaceSegmentEditorDraftSegment>) => {
      hasChanges = true;
      nextSegment = {
        ...nextSegment,
        ...patch,
      };
    };

    const resolveItem = (kind: WorkspaceMediaLibraryItemKind) =>
      latestItemsByRestoreKey.get(getWorkspaceGeneratedMediaLibraryRestoreKey(draft.projectId, segment.index, kind)) ?? null;

    const isMediaLibraryItemCanonicalCurrentVisual = (item: WorkspaceMediaLibraryItem) => {
      if (item.source !== "persisted") {
        return false;
      }

      const itemAsset = createStudioCustomVideoFileFromMediaLibraryItem(item);
      return getStudioCustomVideoFileIdentityKey(itemAsset) === getWorkspaceMediaAssetIdentityKey(nextSegment.currentAsset);
    };

    const applyGeneratedVisualAsset = (
      item: WorkspaceMediaLibraryItem,
      currentAsset: StudioCustomVideoFile | null,
      patch: (asset: StudioCustomVideoFile) => Partial<WorkspaceSegmentEditorDraftSegment>,
      canonicalPatch: Partial<WorkspaceSegmentEditorDraftSegment>,
    ) => {
      if (!item) {
        return false;
      }

      const nextAsset = createStudioCustomVideoFileFromMediaLibraryItem(item);
      const assetMatchesCurrentVisual = isMediaLibraryItemCanonicalCurrentVisual(item);
      if (assetMatchesCurrentVisual) {
        const shouldApplyCanonicalPatch = Object.entries(canonicalPatch).some(
          ([key, value]) => nextSegment[key as keyof WorkspaceSegmentEditorDraftSegment] !== value,
        );
        if (shouldApplyCanonicalPatch) {
          applyPatch(canonicalPatch);
        }
        return true;
      }

      if (areStudioCustomVideoFilesSameIdentity(currentAsset, nextAsset)) {
        return true;
      }

      applyPatch(patch(nextAsset));
      return true;
    };

    const aiVideoItem = resolveItem("ai_video");
    if (
      aiVideoItem &&
      (isMediaLibraryItemCanonicalCurrentVisual(aiVideoItem) ||
        shouldHydrateWorkspaceGeneratedMediaLibraryItem(nextSegment, aiVideoItem, {
          allowExplicitDraftVisual: true,
          aiVideoMode: "ai_video",
          videoAction: "ai",
        }))
    ) {
      applyGeneratedVisualAsset(
        aiVideoItem,
        nextSegment.aiVideoAsset,
        (asset) => ({
          aiVideoAsset: asset,
          aiVideoGeneratedMode: "ai_video",
          durationExtensionSourceDurationSeconds: null,
          visualReset: false,
          videoAction: "ai",
        }),
        {
          aiVideoAsset: null,
          aiVideoGeneratedMode: null,
          videoAction: "original",
        },
      );
    } else {
      const photoAnimationItem = resolveItem("photo_animation");
      if (
        photoAnimationItem &&
        (isMediaLibraryItemCanonicalCurrentVisual(photoAnimationItem) ||
          shouldHydrateWorkspaceGeneratedMediaLibraryItem(nextSegment, photoAnimationItem, {
            aiVideoMode: "photo_animation",
            videoAction: "photo_animation",
          }))
      ) {
        applyGeneratedVisualAsset(
          photoAnimationItem,
          nextSegment.aiVideoAsset,
          (asset) => ({
            aiVideoAsset: asset,
            aiVideoGeneratedMode: "photo_animation",
            durationExtensionSourceDurationSeconds: null,
            visualReset: false,
            videoAction: "photo_animation",
          }),
          {
            aiVideoAsset: null,
            aiVideoGeneratedMode: null,
            videoAction: "original",
          },
        );
      } else {
        const talkingPhotoItem = resolveItem("talking_photo");
        if (
          talkingPhotoItem &&
          (isMediaLibraryItemCanonicalCurrentVisual(talkingPhotoItem) ||
            shouldHydrateWorkspaceGeneratedMediaLibraryItem(nextSegment, talkingPhotoItem, {
              allowPersistedGeneratedVideoRecovery: true,
              aiVideoMode: "talking_photo",
              videoAction: "talking_photo",
            }))
        ) {
          applyGeneratedVisualAsset(
            talkingPhotoItem,
            nextSegment.aiVideoAsset,
            (asset) => ({
              aiVideoAsset: asset,
              aiVideoGeneratedMode: "talking_photo",
              durationExtensionSourceDurationSeconds: null,
              visualReset: false,
              videoAction: "talking_photo",
            }),
            {
              aiVideoAsset: null,
              aiVideoGeneratedMode: nextSegment.videoAction === "talking_photo" ? "talking_photo" : null,
              videoAction: nextSegment.videoAction === "talking_photo" ? "talking_photo" : "original",
            },
          );
        }
      }
    }

    const aiPhotoItem = resolveItem("ai_photo");
    if (
      aiPhotoItem &&
      (isMediaLibraryItemCanonicalCurrentVisual(aiPhotoItem) ||
        shouldHydrateWorkspaceGeneratedMediaLibraryItem(nextSegment, aiPhotoItem, {
          allowExplicitDraftVisual: true,
          videoAction: "ai_photo",
        }))
    ) {
      applyGeneratedVisualAsset(
        aiPhotoItem,
        nextSegment.aiPhotoAsset,
        (asset) => ({
          aiVideoAsset: null,
          aiVideoGeneratedMode: null,
          aiPhotoAsset: asset,
          durationExtensionSourceDurationSeconds: null,
          visualReset: false,
          videoAction: "ai_photo",
        }),
        { aiPhotoAsset: null, videoAction: "original" },
      );
    }

    const imageEditItem = resolveItem("image_edit");
    if (
      imageEditItem &&
      (isMediaLibraryItemCanonicalCurrentVisual(imageEditItem) ||
        shouldHydrateWorkspaceGeneratedMediaLibraryItem(nextSegment, imageEditItem, {
          allowExplicitDraftVisual: true,
          videoAction: "image_edit",
        }))
    ) {
      applyGeneratedVisualAsset(
        imageEditItem,
        nextSegment.imageEditAsset,
        (asset) => ({
          aiVideoAsset: null,
          aiVideoGeneratedMode: null,
          imageEditAsset: asset,
          durationExtensionSourceDurationSeconds: null,
          visualReset: false,
          videoAction: "image_edit",
        }),
        { imageEditAsset: null, videoAction: "original" },
      );
    }

    return nextSegment;
  });

  return hasChanges
    ? {
        ...draft,
        segments: nextSegments,
      }
    : draft;
};

const WORKSPACE_GENERATED_MEDIA_LIBRARY_STORAGE_KEY_PREFIX = "adshorts.generated-media-library:";
export const WORKSPACE_GENERATED_MEDIA_LIBRARY_MAX_ENTRIES = 80;

export const getWorkspaceGeneratedMediaLibraryStorageKey = (email: string) =>
  `${WORKSPACE_GENERATED_MEDIA_LIBRARY_STORAGE_KEY_PREFIX}${email}`;

const isWorkspaceMediaLibraryPreviewKind = (value: unknown): value is WorkspaceMediaLibraryPreviewKind =>
  value === "image" || value === "video";

const isWorkspaceMediaLibraryItemSource = (value: unknown): value is WorkspaceMediaLibraryItemSource =>
  value === "draft" || value === "live" || value === "persisted";

const isStoredWorkspaceGeneratedMediaLibraryEntry = (value: unknown): value is StoredWorkspaceGeneratedMediaLibraryEntry => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<StoredWorkspaceGeneratedMediaLibraryEntry>;
  const item = payload.item as Partial<WorkspaceMediaLibraryItem> | undefined;

  return (
    Number.isFinite(Number(payload.createdAt)) &&
    typeof payload.id === "string" &&
    typeof payload.sourceJobId === "string" &&
    Boolean(item) &&
    typeof item?.itemKey === "string" &&
    typeof item?.dedupeKey === "string" &&
    typeof item?.downloadName === "string" &&
    (typeof item?.downloadUrl === "string" || item?.downloadUrl === null) &&
    (item?.kind === "ai_photo" ||
      item?.kind === "ai_video" ||
      item?.kind === "photo_animation" ||
      item?.kind === "talking_photo" ||
      item?.kind === "image_edit") &&
    isWorkspaceMediaLibraryPreviewKind(item?.previewKind) &&
    (typeof item?.previewPosterUrl === "string" || item?.previewPosterUrl === null) &&
    typeof item?.previewUrl === "string" &&
    (typeof item?.createdAt === "number" || typeof item?.createdAt === "string" || typeof item?.createdAt === "undefined") &&
    Number.isFinite(Number(item?.projectId)) &&
    typeof item?.projectTitle === "string" &&
    Number.isFinite(Number(item?.segmentIndex)) &&
    Number.isFinite(Number(item?.segmentListIndex)) &&
    Number.isFinite(Number(item?.segmentNumber)) &&
    isWorkspaceMediaLibraryItemSource(item?.source)
  );
};

const normalizeStoredWorkspaceGeneratedMediaLibraryEntry = (
  entry: StoredWorkspaceGeneratedMediaLibraryEntry,
): WorkspaceGeneratedMediaLibraryEntry => {
  const assetId =
    Number.isFinite(Number(entry.item.assetId)) && Number(entry.item.assetId) > 0
      ? Math.trunc(Number(entry.item.assetId))
      : null;
  const previewUrl = assetId
    ? entry.item.previewKind === "video"
      ? buildWorkspaceMediaAssetPlaybackUrl(assetId)
      : buildWorkspaceMediaAssetProxyUrl(assetId)
    : entry.item.previewUrl;
  const downloadUrl = assetId ? buildWorkspaceMediaAssetProxyUrl(assetId) : entry.item.downloadUrl ?? null;

  return {
    createdAt: Math.max(0, Number(entry.createdAt) || 0),
    id: String(entry.id),
    item: {
      ...entry.item,
      assetId,
      createdAt: normalizeWorkspaceMediaLibraryCreatedAt(entry.item.createdAt ?? entry.createdAt),
      downloadUrl,
      previewPosterUrl: entry.item.previewPosterUrl ?? null,
      previewUrl,
      source: "persisted",
    },
    sourceJobId: String(entry.sourceJobId),
  };
};

export const readStoredGeneratedMediaLibraryEntries = (
  email: string | null | undefined,
): WorkspaceGeneratedMediaLibraryEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(getWorkspaceGeneratedMediaLibraryStorageKey(normalizedEmail));
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isStoredWorkspaceGeneratedMediaLibraryEntry)
      .filter((entry) => !hasWorkspaceMediaLibraryLegacyFallbackDownloadUrl(entry.item))
      .map((entry) => normalizeStoredWorkspaceGeneratedMediaLibraryEntry(entry))
      .filter((entry) => isWorkspaceMediaLibraryItemDurableForStorage(entry.item))
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, WORKSPACE_GENERATED_MEDIA_LIBRARY_MAX_ENTRIES);
  } catch {
    return [];
  }
};

export const persistGeneratedMediaLibraryEntries = (
  email: string | null | undefined,
  entries: WorkspaceGeneratedMediaLibraryEntry[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return;
  }

  try {
    const storageKey = getWorkspaceGeneratedMediaLibraryStorageKey(normalizedEmail);
    const normalizedEntries = entries
      .slice()
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, WORKSPACE_GENERATED_MEDIA_LIBRARY_MAX_ENTRIES)
      .filter((entry) => !hasWorkspaceMediaLibraryLegacyFallbackDownloadUrl(entry.item))
      .map((entry) => normalizeStoredWorkspaceGeneratedMediaLibraryEntry(entry))
      .filter((entry) => isWorkspaceMediaLibraryItemDurableForStorage(entry.item));

    if (normalizedEntries.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(normalizedEntries));
  } catch {
    // Ignore storage write errors.
  }
};

export const appendUrlToken = (value: string | null | undefined, key: string, token: string | number | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  const normalizedToken = String(token ?? "").trim();
  if (!normalizedValue || !normalizedToken) return normalizedValue || null;

  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const resolvedUrl = new URL(normalizedValue, baseUrl);
    resolvedUrl.searchParams.set(key, normalizedToken);

    if (/^https?:\/\//i.test(normalizedValue)) {
      return resolvedUrl.toString();
    }

    return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
  } catch {
    return normalizedValue;
  }
};

const WORKSPACE_MEDIA_LIBRARY_FALLBACK_TIMESTAMP = "1970-01-01T00:00:00.000Z";

const getWorkspaceMediaLibraryDownloadToken = (
  project: Pick<WorkspaceProject, "createdAt" | "generatedAt" | "id" | "updatedAt">,
) => {
  const token = project.updatedAt || project.generatedAt || project.createdAt || project.id;
  return token.startsWith(WORKSPACE_MEDIA_LIBRARY_FALLBACK_TIMESTAMP) ? project.id : token;
};

type WorkspaceMediaLibraryStudioGeneration = {
  adId: number | null;
  generatedAt: string;
  id: string;
  prompt: string;
  title: string;
  videoFallbackUrl?: string | null;
  videoUrl: string | null;
};

export const createWorkspaceMediaLibraryProjectFromDraft = (
  draft: WorkspaceSegmentEditorDraftSession,
  options?: {
    generatedVideo?: WorkspaceMediaLibraryStudioGeneration | null;
    project?: WorkspaceProject | null;
  },
): WorkspaceProject => {
  if (options?.project) {
    return options.project;
  }

  const matchingGeneration =
    options?.generatedVideo && options.generatedVideo.adId === draft.projectId ? options.generatedVideo : null;
  const normalizedGeneratedAt = String(matchingGeneration?.generatedAt ?? "").trim() || null;
  const fallbackTimestamp = normalizedGeneratedAt ?? WORKSPACE_MEDIA_LIBRARY_FALLBACK_TIMESTAMP;

  return {
    adId: draft.projectId,
    createdAt: fallbackTimestamp,
    description: draft.description,
    editedFromProjectAdId: null,
    generatedAt: normalizedGeneratedAt,
    hashtags: [],
    id: String(matchingGeneration?.id ?? `draft:${draft.projectId}`),
    jobId: matchingGeneration?.id ?? null,
    prompt: matchingGeneration?.prompt ?? "",
    source: "project",
    status: "ready",
    title: matchingGeneration?.title ?? draft.title,
    updatedAt: fallbackTimestamp,
    versionRootProjectAdId: null,
    posterUrl: null,
    videoFallbackUrl: matchingGeneration?.videoFallbackUrl ?? null,
    videoUrl: matchingGeneration?.videoUrl ?? null,
    instagramPublication: null,
    youtubePublication: null,
  };
};

export const buildWorkspaceMediaLibraryDraftItems = (
  project: WorkspaceProject,
  draft: WorkspaceSegmentEditorDraftSession,
): WorkspaceMediaLibraryItem[] => {
  const projectId = project.adId ?? draft.projectId;
  const projectTitle = getWorkspaceProjectDisplayTitle(project);
  const downloadToken = getWorkspaceMediaLibraryDownloadToken(project);
  const createdAt = normalizeWorkspaceMediaLibraryCreatedAt(project.updatedAt || project.generatedAt || project.createdAt);

  return draft.segments.flatMap((segment, segmentListIndex) => {
    const items: WorkspaceMediaLibraryItem[] = [];
    const aiPhotoPreviewUrl = getStudioCustomAssetPreviewUrl(segment.aiPhotoAsset);
    const imageEditPreviewUrl = getStudioCustomAssetPreviewUrl(segment.imageEditAsset);
    const aiVideoPreviewUrl = getStudioCustomAssetPreviewUrl(segment.aiVideoAsset);
    const aiVideoPosterUrl =
      segment.aiVideoGeneratedMode === "photo_animation" || segment.aiVideoGeneratedMode === "talking_photo"
        ? getWorkspacePhotoAnimationPreferredPosterUrl(segment, segment.aiVideoAsset)
        : getWorkspaceAiVideoPreferredPosterUrl(segment, segment.aiVideoAsset);

    if (aiPhotoPreviewUrl) {
      items.push(createWorkspaceMediaLibraryItem({
        assetId: segment.aiPhotoAsset?.assetId ?? undefined,
        createdAt,
        downloadName: getImageDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-ai-photo`),
        downloadUrl: appendUrlToken(aiPhotoPreviewUrl, "download", `${downloadToken}:${segment.index}:draft-ai-photo`),
        kind: "ai_photo",
        previewKind: "image",
        previewPosterUrl: aiPhotoPreviewUrl,
        previewUrl: aiPhotoPreviewUrl,
        projectId,
        projectTitle,
        segmentIndex: segment.index,
        segmentListIndex,
        source: "draft",
      }));
    }

    if (imageEditPreviewUrl) {
      items.push(createWorkspaceMediaLibraryItem({
        assetId: segment.imageEditAsset?.assetId ?? undefined,
        createdAt,
        downloadName: getImageDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-i2i`),
        downloadUrl: appendUrlToken(imageEditPreviewUrl, "download", `${downloadToken}:${segment.index}:draft-image-edit`),
        kind: "image_edit",
        previewKind: "image",
        previewPosterUrl: imageEditPreviewUrl,
        previewUrl: imageEditPreviewUrl,
        projectId,
        projectTitle,
        segmentIndex: segment.index,
        segmentListIndex,
        source: "draft",
      }));
    }

    if (aiVideoPreviewUrl && segment.aiVideoGeneratedMode === "ai_video") {
      items.push(createWorkspaceMediaLibraryItem({
        assetId: segment.aiVideoAsset?.assetId ?? undefined,
        createdAt,
        downloadName: getVideoDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-ai-video`),
        downloadUrl: appendUrlToken(aiVideoPreviewUrl, "download", `${downloadToken}:${segment.index}:draft-ai-video`),
        kind: "ai_video",
        previewKind: "video",
        previewPosterUrl: aiVideoPosterUrl,
        previewUrl: aiVideoPreviewUrl,
        projectId,
        projectTitle,
        segmentIndex: segment.index,
        segmentListIndex,
        source: "draft",
      }));
    }

    if (aiVideoPreviewUrl && segment.aiVideoGeneratedMode === "photo_animation") {
      items.push(createWorkspaceMediaLibraryItem({
        assetId: segment.aiVideoAsset?.assetId ?? undefined,
        createdAt,
        downloadName: getVideoDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-animation`),
        downloadUrl: appendUrlToken(aiVideoPreviewUrl, "download", `${downloadToken}:${segment.index}:draft-animation`),
        kind: "photo_animation",
        previewKind: "video",
        previewPosterUrl: aiVideoPosterUrl,
        previewUrl: aiVideoPreviewUrl,
        projectId,
        projectTitle,
        segmentIndex: segment.index,
        segmentListIndex,
        source: "draft",
      }));
    }

    if (aiVideoPreviewUrl && segment.aiVideoGeneratedMode === "talking_photo") {
      items.push(createWorkspaceMediaLibraryItem({
        assetId: segment.aiVideoAsset?.assetId ?? undefined,
        createdAt,
        downloadName: getVideoDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-talking-photo`),
        downloadUrl: appendUrlToken(aiVideoPreviewUrl, "download", `${downloadToken}:${segment.index}:draft-talking-photo`),
        kind: "talking_photo",
        previewKind: "video",
        previewPosterUrl: aiVideoPosterUrl,
        previewUrl: aiVideoPreviewUrl,
        projectId,
        projectTitle,
        segmentIndex: segment.index,
        segmentListIndex,
        source: "draft",
      }));
    }

    return items;
  });
};

export const buildWorkspaceGeneratedMediaLibraryEntry = (options: {
  asset: StudioCustomVideoFile;
  kind: WorkspaceMediaLibraryItemKind;
  project: WorkspaceProject;
  segment: WorkspaceSegmentEditorDraftSegment;
  segmentListIndex: number;
  sourceJobId: string;
}) => {
  const previewUrl =
    getWorkspaceMediaAssetDurablePreviewUrl({
      assetId: options.asset.assetId ?? null,
      fileName: options.asset.fileName,
      mimeType: options.asset.mimeType,
      remoteUrl: options.asset.remoteUrl,
    }) ?? getStudioCustomAssetPreviewUrl(options.asset);
  if (!previewUrl) {
    return null;
  }

  const project = cloneWorkspaceProject(options.project);
  const projectId = project.adId ?? 0;
  if (!Number.isInteger(projectId) || projectId < 0) {
    return null;
  }

  const projectTitle = getWorkspaceProjectDisplayTitle(project);
  const segment = cloneWorkspaceSegmentEditorDraftSegment(
    options.segment,
    project.prefillSettings?.language ?? getStudioLanguageForVoiceId(options.project.prefillSettings?.voiceId) ?? "ru",
  );
  const segmentNumber = options.segmentListIndex + 1;
  const downloadToken = getWorkspaceMediaLibraryDownloadToken(project);
  const previewKind = options.kind === "ai_photo" || options.kind === "image_edit" ? "image" : "video";
  const previewPosterUrl =
    options.kind === "ai_photo" || options.kind === "image_edit"
      ? previewUrl
      : options.kind === "photo_animation" || options.kind === "talking_photo"
        ? getWorkspacePhotoAnimationPreferredPosterUrl(segment, options.asset)
        : getWorkspaceAiVideoPreferredPosterUrl(segment, options.asset);
  const downloadName =
    options.kind === "ai_photo"
      ? getImageDownloadName(`${projectTitle}-segment-${segmentNumber}-ai-photo`)
      : options.kind === "image_edit"
        ? getImageDownloadName(`${projectTitle}-segment-${segmentNumber}-i2i`)
      : options.kind === "photo_animation"
        ? getVideoDownloadName(`${projectTitle}-segment-${segmentNumber}-animation`)
      : options.kind === "talking_photo"
        ? getVideoDownloadName(`${projectTitle}-segment-${segmentNumber}-talking-photo`)
        : getVideoDownloadName(`${projectTitle}-segment-${segmentNumber}-ai-video`);
  const downloadUrl = appendUrlToken(previewUrl, "download", `${downloadToken}:${segment.index}:${options.sourceJobId}`);
  const item = createWorkspaceMediaLibraryItem({
    assetId: options.asset.assetId ?? undefined,
    createdAt: Date.now(),
    downloadName,
    downloadUrl,
    kind: options.kind,
    previewKind,
    previewPosterUrl,
    previewUrl,
    projectId,
    projectTitle,
    segmentIndex: segment.index,
    segmentListIndex: options.segmentListIndex,
    source: "live",
    sourceJobId: options.sourceJobId,
  });

  return {
    createdAt: item.createdAt,
    id: item.itemKey,
    item,
    sourceJobId: options.sourceJobId,
  } satisfies WorkspaceGeneratedMediaLibraryEntry;
};
