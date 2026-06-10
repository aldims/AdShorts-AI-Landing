import type { Locale } from "../../lib/i18n";
import { getWorkspaceMediaLibraryAssetIdentityKey } from "../../lib/workspaceMediaLibrary";
import {
  resolveWorkspaceMediaSurface,
  type WorkspaceResolvedMediaContext,
  type WorkspaceResolvedMediaSurface,
} from "../../lib/workspaceResolvedMedia";
import {
  getStudioCustomAssetPosterUrl,
  getWorkspaceAiVideoPreferredPosterUrl,
  getWorkspacePhotoAnimationPreferredPosterUrl,
  getWorkspacePhotoAnimationSourcePosterUrl,
} from "./workspace-media-library-helpers";
import {
  fallbackStudioSubtitleColorOption,
  fallbackStudioSubtitleStyleOption,
  buildWorkspaceMediaAssetPlaybackUrl,
  getPositiveWorkspaceMediaAssetId,
  getStudioCustomAssetPreviewUrl,
  getStudioLanguageForVoiceId,
  getUniqueWorkspaceSegmentPreviewUrls,
  getWorkspaceSegmentEffectiveSubtitleSettings,
  getWorkspaceSegmentEffectiveVoiceEnabled,
  getWorkspaceSegmentCurrentPosterUrl,
  getWorkspaceSegmentCurrentVisualIdentityKey,
  getWorkspaceSegmentCustomPreviewKind,
  getWorkspaceSegmentDisplayAiVideoAssetUrl,
  getWorkspaceSegmentDraftVisualAsset,
  getWorkspaceSegmentLatestVisualAction,
  getWorkspaceSegmentOriginalPosterUrl,
  getWorkspaceSegmentOriginalVisualIdentityKey,
  getWorkspaceSegmentPendingImageEditSourceAsset,
  getWorkspaceSegmentPreferredStillPreviewUrl,
  getWorkspaceSegmentPreviewKind,
  getWorkspaceSegmentSelectedVisualPreviewKind,
  getWorkspaceSegmentStillPreviewUrls,
  getWorkspaceSegmentVideoAssetPosterUrl,
  hasWorkspaceSegmentExplicitDraftVisual,
  isWorkspaceSegmentServerPhotoAnimationOverride,
  isWorkspaceSegmentStaleUploadOriginalVisual,
  isWorkspaceSegmentVisualResetApplied,
  isWorkspaceSegmentVoiceoverAssetFresh,
  normalizeStudioLanguageValue,
  normalizeWorkspaceSegmentEditorSetting,
  normalizeWorkspaceSegmentSourceKind,
  shouldUseWorkspaceSegmentAiPhotoRenderedStillPreview,
} from "./workspace-segment-editor";
import type {
  StudioCustomVideoFile,
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentEditorDraftSession,
  WorkspaceSegmentPreviewKind,
  WorkspaceSegmentSourceKind,
} from "./workspace-types";

const getWorkspaceSegmentExternalVideoFallbackUrls = (segment: WorkspaceSegmentEditorDraftSegment) =>
  getUniqueWorkspaceSegmentPreviewUrls([
    segment.currentExternalPlaybackUrl,
    segment.originalExternalPlaybackUrl,
    segment.currentExternalPreviewUrl,
    segment.originalExternalPreviewUrl,
  ]);

const getWorkspaceVideoPlaybackRouteUrl = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const isAbsoluteUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(normalizedValue);
    const url = new URL(normalizedValue, "http://localhost");

    const mediaAssetMatch = url.pathname.match(/^\/api\/workspace\/media-assets\/(\d+)$/i);
    if (mediaAssetMatch) {
      const assetId = getPositiveWorkspaceMediaAssetId(mediaAssetMatch[1]);
      if (!assetId) {
        return null;
      }

      return `${isAbsoluteUrl ? url.origin : ""}${buildWorkspaceMediaAssetPlaybackUrl(assetId)}${url.search}${url.hash}`;
    }

    if (
      url.pathname.toLowerCase() === "/api/workspace/project-segment-video" &&
      url.searchParams.get("delivery")?.toLowerCase() === "preview"
    ) {
      url.searchParams.set("delivery", "playback");
      return `${isAbsoluteUrl ? url.origin : ""}${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return null;
  }

  return null;
};

const getStudioCustomVideoAssetPlaybackUrl = (asset: StudioCustomVideoFile | null | undefined) => {
  if (!asset) {
    return null;
  }

  const previewUrl = getStudioCustomAssetPreviewUrl(asset);
  if (getWorkspaceSegmentCustomPreviewKind(asset) !== "video") {
    return previewUrl;
  }

  if (asset.objectUrl?.trim() || asset.dataUrl?.trim()) {
    return previewUrl;
  }

  const assetId = getPositiveWorkspaceMediaAssetId(asset.assetId);
  if (assetId) {
    return buildWorkspaceMediaAssetPlaybackUrl(assetId);
  }

  return getWorkspaceVideoPlaybackRouteUrl(asset.remoteUrl ?? previewUrl) ?? previewUrl;
};

const getWorkspaceSegmentDisplayAiVideoAssetPlaybackUrl = (
  segment: WorkspaceSegmentEditorDraftSegment,
  mode: "ai_video" | "photo_animation" | "talking_photo",
) => {
  if (!getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, mode)) {
    return null;
  }

  return getStudioCustomVideoAssetPlaybackUrl(segment.aiVideoAsset);
};

const getWorkspaceSegmentPersistedSourceKind = (segment: WorkspaceSegmentEditorDraftSegment): WorkspaceSegmentSourceKind =>
  [
    segment.currentSourceKind,
    segment.currentAsset?.sourceKind,
    segment.originalSourceKind,
    segment.originalAsset?.sourceKind,
  ]
    .map(normalizeWorkspaceSegmentSourceKind)
    .find((sourceKind) => sourceKind !== "unknown") ?? "unknown";

const getWorkspaceSegmentVisualResetPreviewUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (!segment.visualReset) {
    return null;
  }

  if (isWorkspaceSegmentStaleUploadOriginalVisual(segment)) {
    return (
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      null
    );
  }

  return (
    segment.originalPreviewUrl ??
    segment.originalExternalPreviewUrl ??
    segment.originalPlaybackUrl ??
    segment.originalExternalPlaybackUrl ??
    null
  );
};

const getWorkspaceSegmentVisualResetVideoUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (!segment.visualReset) {
    return null;
  }

  if (isWorkspaceSegmentStaleUploadOriginalVisual(segment)) {
    return (
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl ??
      null
    );
  }

  return (
    segment.originalPlaybackUrl ??
    segment.originalExternalPlaybackUrl ??
    segment.originalPreviewUrl ??
    segment.originalExternalPreviewUrl ??
    null
  );
};

export const getWorkspaceSegmentDraftPreviewUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (segment.visualReset && !hasWorkspaceSegmentExplicitDraftVisual(segment)) {
    return getWorkspaceSegmentVisualResetPreviewUrl(segment);
  }

  if (shouldUseWorkspaceSegmentAiPhotoRenderedStillPreview(segment)) {
    return (
      getWorkspaceSegmentVideoAssetPosterUrl(segment) ??
      getWorkspaceSegmentPreferredStillPreviewUrl(segment) ??
      null
    );
  }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);
  const preferredStillPreviewUrl = getWorkspaceSegmentPreferredStillPreviewUrl(segment);
  const fallbackStillPreviewUrl =
    preferredStillPreviewUrl ??
    (segment.mediaType === "photo"
      ? null
      : segment.currentPreviewUrl ??
        segment.originalPreviewUrl ??
        segment.currentExternalPreviewUrl ??
        segment.originalExternalPreviewUrl);
  const fallbackPreviewUrl =
    fallbackStillPreviewUrl ??
    segment.currentPlaybackUrl ??
    segment.originalPlaybackUrl ??
    segment.currentExternalPlaybackUrl ??
    segment.originalExternalPlaybackUrl;

  if (latestVisualAction === "ai") {
    const displayGeneratedVideoUrl = getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "ai_video");
    return (
      (displayGeneratedVideoUrl ? getWorkspaceAiVideoPreferredPosterUrl(segment, segment.aiVideoAsset) : null) ??
      displayGeneratedVideoUrl ??
      fallbackStillPreviewUrl ??
      fallbackPreviewUrl
    );
  }

  if (latestVisualAction === "photo_animation") {
    const displayGeneratedVideoUrl = getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "photo_animation");
    const sourcePreviewUrl = getWorkspacePhotoAnimationSourcePosterUrl(segment);
    return (
      (displayGeneratedVideoUrl ? getWorkspacePhotoAnimationPreferredPosterUrl(segment, segment.aiVideoAsset) : null) ??
      displayGeneratedVideoUrl ??
      sourcePreviewUrl ??
      fallbackStillPreviewUrl ??
      fallbackPreviewUrl
    );
  }

  if (latestVisualAction === "talking_photo") {
    const displayGeneratedVideoUrl = getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "talking_photo");
    const sourcePreviewUrl = getWorkspacePhotoAnimationSourcePosterUrl(segment);
    return (
      (displayGeneratedVideoUrl ? getWorkspacePhotoAnimationPreferredPosterUrl(segment, segment.aiVideoAsset) : null) ??
      displayGeneratedVideoUrl ??
      sourcePreviewUrl ??
      fallbackStillPreviewUrl ??
      fallbackPreviewUrl
    );
  }

  if (segment.videoAction === "custom") {
    const customPreviewUrl = getStudioCustomAssetPreviewUrl(segment.customVideo);
    if (segment.customVideo?.source === "media-library") {
      if (getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "video") {
        return getStudioCustomAssetPosterUrl(segment.customVideo) ?? customPreviewUrl;
      }

      return customPreviewUrl;
    }

    if (getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "video") {
      return getStudioCustomAssetPosterUrl(segment.customVideo) ?? customPreviewUrl ?? fallbackPreviewUrl;
    }

    return customPreviewUrl ?? fallbackPreviewUrl;
  }

  if (segment.videoAction === "image_edit") {
    return (
      getStudioCustomAssetPreviewUrl(segment.imageEditAsset) ??
      getStudioCustomAssetPreviewUrl(getWorkspaceSegmentPendingImageEditSourceAsset(segment)) ??
      fallbackPreviewUrl
    );
  }

  if (segment.videoAction === "ai_photo") {
    return (
      getStudioCustomAssetPreviewUrl(segment.aiPhotoAsset) ??
      fallbackPreviewUrl
    );
  }

  if (segment.videoAction === "original") {
    if (isWorkspaceSegmentServerPhotoAnimationOverride(segment)) {
      return (
        getWorkspacePhotoAnimationSourcePosterUrl(segment) ??
        segment.currentPreviewUrl ??
        segment.currentExternalPreviewUrl ??
        segment.currentPlaybackUrl ??
        segment.currentExternalPlaybackUrl ??
        fallbackStillPreviewUrl ??
        fallbackPreviewUrl
      );
    }

    if (segment.mediaType === "video") {
      return (
        segment.originalPreviewUrl ??
        segment.originalPlaybackUrl ??
        segment.currentPreviewUrl ??
        segment.currentPlaybackUrl ??
        preferredStillPreviewUrl ??
        segment.originalExternalPreviewUrl ??
        segment.currentExternalPreviewUrl ??
        segment.originalExternalPlaybackUrl ??
        segment.currentExternalPlaybackUrl
      );
    }

    return (
      preferredStillPreviewUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl
    );
  }

  if (segment.mediaType === "photo") {
    return preferredStillPreviewUrl;
  }

  return (
    segment.currentPreviewUrl ??
    segment.currentPlaybackUrl ??
    preferredStillPreviewUrl ??
    segment.currentExternalPreviewUrl ??
    segment.currentExternalPlaybackUrl ??
    segment.originalPreviewUrl ??
    segment.originalPlaybackUrl ??
    segment.originalExternalPreviewUrl ??
    segment.originalExternalPlaybackUrl
  );
};

export const getWorkspaceSegmentDraftPosterUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (segment.visualReset && !hasWorkspaceSegmentExplicitDraftVisual(segment)) {
    return getWorkspaceSegmentOriginalPosterUrl(segment);
  }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (latestVisualAction === "ai") {
    return (
      getWorkspaceAiVideoPreferredPosterUrl(segment, segment.aiVideoAsset) ??
      getWorkspaceSegmentCurrentPosterUrl(segment) ??
      getWorkspaceSegmentOriginalPosterUrl(segment)
    );
  }

  if (latestVisualAction === "photo_animation") {
    return (
      getWorkspacePhotoAnimationPreferredPosterUrl(segment, segment.aiVideoAsset) ??
      getWorkspacePhotoAnimationSourcePosterUrl(segment) ??
      getWorkspaceSegmentCurrentPosterUrl(segment) ??
      getWorkspaceSegmentOriginalPosterUrl(segment)
    );
  }

  if (latestVisualAction === "talking_photo") {
    return (
      getWorkspacePhotoAnimationPreferredPosterUrl(segment, segment.aiVideoAsset) ??
      getWorkspacePhotoAnimationSourcePosterUrl(segment) ??
      getWorkspaceSegmentCurrentPosterUrl(segment) ??
      getWorkspaceSegmentOriginalPosterUrl(segment)
    );
  }

  if (segment.videoAction === "custom" && getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "video") {
    return getStudioCustomAssetPosterUrl(segment.customVideo);
  }

  if (segment.videoAction === "original") {
    return isWorkspaceSegmentServerPhotoAnimationOverride(segment)
      ? getWorkspaceSegmentCurrentPosterUrl(segment)
      : getWorkspaceSegmentOriginalPosterUrl(segment);
  }

  return getWorkspaceSegmentCurrentPosterUrl(segment) ?? getWorkspaceSegmentOriginalPosterUrl(segment);
};

const getWorkspaceSegmentDraftFallbackPosterUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (segment.visualReset && !hasWorkspaceSegmentExplicitDraftVisual(segment)) {
    return null;
  }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (latestVisualAction === "photo_animation" || latestVisualAction === "talking_photo") {
    return (
      getWorkspacePhotoAnimationSourcePosterUrl(segment) ??
      getWorkspaceSegmentCurrentPosterUrl(segment) ??
      getWorkspaceSegmentOriginalPosterUrl(segment) ??
      segment.currentExternalPreviewUrl ??
      segment.originalExternalPreviewUrl ??
      segment.currentPreviewUrl ??
      segment.originalPreviewUrl ??
      null
    );
  }

  if (segment.videoAction === "original" && segment.mediaType === "video") {
    if (isWorkspaceSegmentServerPhotoAnimationOverride(segment)) {
      return (
        getWorkspaceSegmentCurrentPosterUrl(segment) ??
        segment.currentExternalPreviewUrl ??
        segment.currentPreviewUrl ??
        null
      );
    }

    return (
      getWorkspaceSegmentOriginalPosterUrl(segment) ??
      segment.originalExternalPreviewUrl ??
      null
    );
  }

  if (segment.videoAction === "custom" && getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "video") {
    // A user-selected custom video must not inherit the previous segment still frame.
    // Otherwise the carousel keeps showing the old photo until playback starts.
    return null;
  }

  return null;
};

export const getWorkspaceSegmentDraftPreviewFallbackUrls = (
  segment: WorkspaceSegmentEditorDraftSegment,
  previewKind: WorkspaceSegmentPreviewKind,
) => {
  if (segment.visualReset && !hasWorkspaceSegmentExplicitDraftVisual(segment)) {
    return getUniqueWorkspaceSegmentPreviewUrls([
      segment.originalPlaybackUrl,
      segment.originalPreviewUrl,
      ...(isWorkspaceSegmentStaleUploadOriginalVisual(segment)
        ? []
        : [segment.originalExternalPlaybackUrl, segment.originalExternalPreviewUrl]),
    ]);
  }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (previewKind === "image") {
    const stillPreviewFallbackUrls = getWorkspaceSegmentStillPreviewUrls(segment);

    if (shouldUseWorkspaceSegmentAiPhotoRenderedStillPreview(segment)) {
      return getUniqueWorkspaceSegmentPreviewUrls([
        getWorkspaceSegmentVideoAssetPosterUrl(segment),
        ...stillPreviewFallbackUrls,
      ]);
    }

    if (latestVisualAction === "custom") {
      if (segment.customVideo?.source === "media-library") {
        return getUniqueWorkspaceSegmentPreviewUrls([
          getStudioCustomAssetPreviewUrl(segment.customVideo),
        ]);
      }

      return getUniqueWorkspaceSegmentPreviewUrls([
        getStudioCustomAssetPreviewUrl(segment.customVideo),
        ...stillPreviewFallbackUrls,
      ]);
    }

    if (latestVisualAction === "ai_photo") {
      return getUniqueWorkspaceSegmentPreviewUrls([
        getStudioCustomAssetPreviewUrl(segment.aiPhotoAsset),
        ...stillPreviewFallbackUrls,
      ]);
    }

    if (latestVisualAction === "image_edit") {
      return getUniqueWorkspaceSegmentPreviewUrls([
        getStudioCustomAssetPreviewUrl(segment.imageEditAsset),
        getStudioCustomAssetPreviewUrl(getWorkspaceSegmentPendingImageEditSourceAsset(segment)),
        ...stillPreviewFallbackUrls,
      ]);
    }

    if (latestVisualAction === "original") {
      return stillPreviewFallbackUrls;
    }

    if (latestVisualAction === "photo_animation" || latestVisualAction === "talking_photo") {
      return getUniqueWorkspaceSegmentPreviewUrls([
        getWorkspacePhotoAnimationSourcePosterUrl(segment),
        ...stillPreviewFallbackUrls,
      ]);
    }

    return stillPreviewFallbackUrls;
  }

  if (latestVisualAction === "ai" || latestVisualAction === "photo_animation" || latestVisualAction === "talking_photo") {
    const displayGeneratedVideoUrl =
      latestVisualAction === "ai"
        ? getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "ai_video")
        : latestVisualAction === "talking_photo"
          ? getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "talking_photo")
          : getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "photo_animation");

    if (!displayGeneratedVideoUrl) {
      return getUniqueWorkspaceSegmentPreviewUrls([
        segment.currentPlaybackUrl,
        segment.originalPlaybackUrl,
        segment.currentPreviewUrl,
        segment.originalPreviewUrl,
        ...getWorkspaceSegmentExternalVideoFallbackUrls(segment),
      ]);
    }

    // Generated video previews must never silently fall back to the original segment media.
    // Otherwise the UI can display the old source clip/photo when the generated asset
    // has a transient loading issue, which looks like the generation used the wrong source.
    return [];
  }

  if (latestVisualAction === "custom") {
    if (segment.customVideo?.source === "media-library" && getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "video") {
      return getUniqueWorkspaceSegmentPreviewUrls([getStudioCustomAssetPreviewUrl(segment.customVideo)]);
    }

    return getUniqueWorkspaceSegmentPreviewUrls([
      getStudioCustomAssetPreviewUrl(segment.customVideo),
      segment.currentPlaybackUrl,
      segment.originalPlaybackUrl,
      segment.currentPreviewUrl,
      segment.originalPreviewUrl,
      ...getWorkspaceSegmentExternalVideoFallbackUrls(segment),
    ]);
  }

  if (latestVisualAction === "original") {
    if (isWorkspaceSegmentServerPhotoAnimationOverride(segment)) {
      return getUniqueWorkspaceSegmentPreviewUrls([
        segment.currentPlaybackUrl,
        segment.currentExternalPlaybackUrl,
        segment.currentPreviewUrl,
        segment.currentExternalPreviewUrl,
      ]);
    }

    return getUniqueWorkspaceSegmentPreviewUrls([
      segment.originalPlaybackUrl,
      segment.originalExternalPlaybackUrl,
      segment.currentPlaybackUrl,
      segment.currentExternalPlaybackUrl,
      segment.originalPreviewUrl,
      segment.currentPreviewUrl,
      segment.originalExternalPreviewUrl,
      segment.currentExternalPreviewUrl,
    ]);
  }

  return getUniqueWorkspaceSegmentPreviewUrls([
    segment.currentPlaybackUrl,
    segment.originalPlaybackUrl,
    segment.currentPreviewUrl,
    segment.originalPreviewUrl,
    ...getWorkspaceSegmentExternalVideoFallbackUrls(segment),
  ]);
};

export const getWorkspaceSegmentDraftVideoUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (segment.visualReset && !hasWorkspaceSegmentExplicitDraftVisual(segment)) {
    return getWorkspaceSegmentVisualResetVideoUrl(segment);
  }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (latestVisualAction === "ai") {
    return (
      getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "ai_video") ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl
    );
  }

  if (latestVisualAction === "photo_animation") {
    return (
      getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "photo_animation") ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl
    );
  }

  if (latestVisualAction === "talking_photo") {
    return (
      getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "talking_photo") ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl
    );
  }

  if (segment.videoAction === "custom") {
    if (segment.customVideo?.source === "media-library") {
      return getStudioCustomAssetPreviewUrl(segment.customVideo);
    }

    return (
      getStudioCustomAssetPreviewUrl(segment.customVideo) ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl
    );
  }

  if (segment.videoAction === "image_edit") {
    return (
      getStudioCustomAssetPreviewUrl(segment.imageEditAsset) ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl
    );
  }

  if (segment.videoAction === "ai_photo") {
    return (
      getStudioCustomAssetPreviewUrl(segment.aiPhotoAsset) ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl
    );
  }

  if (segment.videoAction === "original") {
    if (isWorkspaceSegmentServerPhotoAnimationOverride(segment)) {
      return (
        segment.currentPlaybackUrl ??
        segment.currentExternalPlaybackUrl ??
        segment.currentPreviewUrl ??
        segment.currentExternalPreviewUrl ??
        segment.originalPlaybackUrl ??
        segment.originalExternalPlaybackUrl ??
        segment.originalPreviewUrl ??
        segment.originalExternalPreviewUrl
      );
    }

    return (
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl
    );
  }

  return (
    segment.currentPlaybackUrl ??
    segment.currentExternalPlaybackUrl ??
    segment.originalPlaybackUrl ??
    segment.originalExternalPlaybackUrl ??
    segment.currentPreviewUrl ??
    segment.currentExternalPreviewUrl ??
    segment.originalPreviewUrl ??
    segment.originalExternalPreviewUrl
  );
};

const getWorkspaceSegmentDraftPlaybackVideoUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (segment.visualReset && !hasWorkspaceSegmentExplicitDraftVisual(segment)) {
    return getWorkspaceSegmentVisualResetVideoUrl(segment);
  }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (latestVisualAction === "ai") {
    return (
      getWorkspaceSegmentDisplayAiVideoAssetPlaybackUrl(segment, "ai_video") ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      getWorkspaceSegmentDraftVideoUrl(segment)
    );
  }

  if (latestVisualAction === "photo_animation") {
    const generatedPlaybackUrl = getWorkspaceSegmentDisplayAiVideoAssetPlaybackUrl(segment, "photo_animation");
    if (!generatedPlaybackUrl && getWorkspaceSegmentCustomPreviewKind(segment.photoAnimationSourceAsset) === "image") {
      return null;
    }

    return (
      generatedPlaybackUrl ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      getWorkspaceSegmentDraftVideoUrl(segment)
    );
  }

  if (latestVisualAction === "talking_photo") {
    const generatedPlaybackUrl = getWorkspaceSegmentDisplayAiVideoAssetPlaybackUrl(segment, "talking_photo");
    if (!generatedPlaybackUrl && getWorkspaceSegmentCustomPreviewKind(segment.photoAnimationSourceAsset) === "image") {
      return null;
    }

    return (
      generatedPlaybackUrl ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      getWorkspaceSegmentDraftVideoUrl(segment)
    );
  }

  if (segment.videoAction === "custom") {
    if (getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "image") {
      return null;
    }

    return (
      getStudioCustomVideoAssetPlaybackUrl(segment.customVideo) ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      getWorkspaceSegmentDraftVideoUrl(segment)
    );
  }

  if (segment.videoAction === "image_edit") {
    if (getWorkspaceSegmentCustomPreviewKind(segment.imageEditAsset) === "image") {
      return null;
    }

    return (
      getStudioCustomVideoAssetPlaybackUrl(segment.imageEditAsset) ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      getWorkspaceSegmentDraftVideoUrl(segment)
    );
  }

  if (segment.videoAction === "ai_photo") {
    if (getWorkspaceSegmentCustomPreviewKind(segment.aiPhotoAsset) === "image") {
      return null;
    }

    return (
      getStudioCustomVideoAssetPlaybackUrl(segment.aiPhotoAsset) ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      getWorkspaceSegmentDraftVideoUrl(segment)
    );
  }

  return getWorkspaceSegmentDraftVideoUrl(segment);
};

const getStudioCustomAssetMediaIdentityKey = (asset: StudioCustomVideoFile | null | undefined) => {
  if (!asset) {
    return null;
  }

  const previewUrl = getStudioCustomAssetPreviewUrl(asset);
  return [
    asset.source ? `source:${asset.source}` : "",
    asset.libraryItemKey ? `library:${asset.libraryItemKey}` : "",
    asset.assetId ? `asset:${asset.assetId}` : "",
    asset.mimeType ? `mime:${asset.mimeType}` : "",
    asset.fileName ? `file:${asset.fileName}` : "",
    previewUrl ? `preview:${getWorkspaceMediaLibraryAssetIdentityKey(previewUrl)}` : "",
    asset.posterUrl ? `poster:${getWorkspaceMediaLibraryAssetIdentityKey(asset.posterUrl)}` : "",
  ]
    .filter(Boolean)
    .join(",");
};

export const getWorkspaceSegmentMediaIdentityKey = (
  segment: WorkspaceSegmentEditorDraftSegment,
  mediaSurface?: Pick<WorkspaceResolvedMediaSurface, "displayUrl" | "posterUrl" | "previewKind" | "viewerUrl"> | null,
) => {
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);
  const previewKind = mediaSurface?.previewKind ?? getWorkspaceSegmentPreviewKind(segment);
  const draftVisualAsset = getWorkspaceSegmentDraftVisualAsset(segment);
  const draftVisualIdentity = getStudioCustomAssetMediaIdentityKey(draftVisualAsset);
  const displayUrl = mediaSurface?.displayUrl ?? getWorkspaceSegmentDraftPreviewUrl(segment);
  const viewerUrl = mediaSurface?.viewerUrl ?? (previewKind === "video" ? getWorkspaceSegmentDraftVideoUrl(segment) : displayUrl);
  const posterUrl = mediaSurface?.posterUrl ?? (previewKind === "video" ? getWorkspaceSegmentDraftPosterUrl(segment) : null);

  return [
    `segment:${segment.index}`,
    `action:${segment.videoAction}`,
    `latest:${latestVisualAction}`,
    `kind:${previewKind}`,
    `reset:${segment.visualReset ? "1" : "0"}`,
    draftVisualIdentity ? `visual:${draftVisualIdentity}` : "",
    `current:${getWorkspaceSegmentCurrentVisualIdentityKey(segment) ?? "none"}`,
    `original:${getWorkspaceSegmentOriginalVisualIdentityKey(segment) ?? "none"}`,
    displayUrl ? `display:${getWorkspaceMediaLibraryAssetIdentityKey(displayUrl)}` : "display:none",
    viewerUrl ? `viewer:${getWorkspaceMediaLibraryAssetIdentityKey(viewerUrl)}` : "viewer:none",
    posterUrl ? `poster:${getWorkspaceMediaLibraryAssetIdentityKey(posterUrl)}` : "poster:none",
  ]
    .filter(Boolean)
    .join("|");
};

export const getWorkspaceSegmentResolvedMediaSurface = (
  segment: WorkspaceSegmentEditorDraftSegment,
  context: WorkspaceResolvedMediaContext,
  options?: { isPlaybackRequested?: boolean },
): WorkspaceResolvedMediaSurface => {
  const previewKind = getWorkspaceSegmentPreviewKind(segment);
  const previewUrl = getWorkspaceSegmentDraftPreviewUrl(segment);
  const viewerUrl =
    previewKind === "video"
      ? options?.isPlaybackRequested
        ? getWorkspaceSegmentDraftPlaybackVideoUrl(segment)
        : getWorkspaceSegmentDraftVideoUrl(segment)
      : previewUrl;
  const posterUrl = previewKind === "video" ? getWorkspaceSegmentDraftPosterUrl(segment) : null;
  const fallbackPosterUrl = previewKind === "video" ? getWorkspaceSegmentDraftFallbackPosterUrl(segment) : null;
  const fallbackUrls = getWorkspaceSegmentDraftPreviewFallbackUrls(segment, previewKind);
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  return resolveWorkspaceMediaSurface({
    context,
    displayUrl: previewKind === "image" ? previewUrl : viewerUrl,
    fallbackPosterUrl,
    fallbackUrls,
    isGeneratedVideo:
      latestVisualAction === "ai" || latestVisualAction === "photo_animation" || latestVisualAction === "talking_photo",
    isPlaybackRequested: options?.isPlaybackRequested,
    posterUrl,
    previewKind,
    viewerUrl,
  });
};

export const getWorkspaceSegmentVisualDurationMeasurementUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "video") {
    return null;
  }

  const visualAsset = getWorkspaceSegmentDraftVisualAsset(segment);
  const visualAssetPreviewUrl = getStudioCustomAssetPreviewUrl(visualAsset);
  if (visualAssetPreviewUrl) {
    return visualAssetPreviewUrl;
  }

  const visualAssetId =
    getPositiveWorkspaceMediaAssetId(visualAsset?.assetId) ??
    getPositiveWorkspaceMediaAssetId(segment.currentAsset?.assetId) ??
    getPositiveWorkspaceMediaAssetId(segment.originalAsset?.assetId);
  if (visualAssetId) {
    return buildWorkspaceMediaAssetPlaybackUrl(visualAssetId);
  }

  const externalPlaybackUrl =
    segment.currentExternalPlaybackUrl ??
    segment.originalExternalPlaybackUrl ??
    segment.currentExternalPreviewUrl ??
    segment.originalExternalPreviewUrl;
  if (externalPlaybackUrl) {
    return externalPlaybackUrl;
  }

  return getWorkspaceSegmentDraftVideoUrl(segment);
};

const getWorkspaceSegmentPersistedSourceLabel = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const persistedSourceKind = getWorkspaceSegmentPersistedSourceKind(segment);

  if (persistedSourceKind === "ai_generated") {
    return segment.mediaType === "photo" ? "ИИ фото" : "ИИ видео";
  }

  if (persistedSourceKind === "upload") {
    return "Свой визуал";
  }

  return "Сток";
};

export const getWorkspaceSegmentDraftSourceLabel = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (isWorkspaceSegmentVisualResetApplied(segment)) {
    return getWorkspaceSegmentPersistedSourceLabel(segment);
  }

  if (shouldUseWorkspaceSegmentAiPhotoRenderedStillPreview(segment)) {
    return "ИИ фото";
  }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (latestVisualAction === "custom") {
    return segment.customVideo?.source === "media-library" ? "Медиатека" : "Свой визуал";
  }

  if (latestVisualAction === "image_edit") {
    return "Дорисовка";
  }

  if (latestVisualAction === "ai_photo") {
    return "ИИ фото";
  }

  if (latestVisualAction === "photo_animation") {
    return "ИИ анимация";
  }

  if (latestVisualAction === "talking_photo") {
    return "Говорящий персонаж";
  }

  if (latestVisualAction === "ai") {
    return "ИИ видео";
  }

  return getWorkspaceSegmentPersistedSourceLabel(segment);
};

export const getWorkspaceSegmentDraftSourceDisplayLabel = (sourceLabel: string, locale: Locale) => {
  if (locale !== "en") {
    return sourceLabel;
  }

  switch (sourceLabel) {
    case "Сток":
      return "Stock";
    case "ИИ фото":
      return "AI photo";
    case "Медиатека":
      return "Media library";
    case "Свой визуал":
      return "Custom visual";
    case "Дорисовка":
      return "Image edit";
    case "ИИ анимация":
      return "AI animation";
    case "Говорящий персонаж":
      return "Talking character";
    case "ИИ видео":
      return "AI video";
    default:
      return sourceLabel;
  }
};

export const getWorkspaceSegmentEditorGenerationOverrides = (
  session?: WorkspaceSegmentEditorDraftSession | null,
) => {
  const normalizedGlobalVoiceType = normalizeWorkspaceSegmentEditorSetting(session?.voiceType);
  const globalVoiceEnabled = normalizedGlobalVoiceType !== "none";
  const hasSceneVoice = Boolean(
    session?.segments?.some(
      (segment) =>
        getWorkspaceSegmentEffectiveVoiceEnabled(segment, session) ||
        isWorkspaceSegmentVoiceoverAssetFresh(segment, session),
    ),
  );
  const voiceEnabled = globalVoiceEnabled || hasSceneVoice;
  const globalSubtitleEnabled = globalVoiceEnabled && normalizeWorkspaceSegmentEditorSetting(session?.subtitleType) !== "none";
  const hasSceneSubtitle = Boolean(
    session?.segments?.some((segment) =>
      getWorkspaceSegmentEffectiveSubtitleSettings(session, segment, {
        subtitleColorId: fallbackStudioSubtitleColorOption.id,
        subtitleStyleId: fallbackStudioSubtitleStyleOption.id,
      }).isEnabled,
    ),
  );
  const subtitleEnabled = voiceEnabled && (globalSubtitleEnabled || hasSceneSubtitle);

  return {
    language:
      normalizeStudioLanguageValue(session?.language) ?? getStudioLanguageForVoiceId(session?.voiceType) ?? undefined,
    musicType: normalizeWorkspaceSegmentEditorSetting(session?.musicType),
    subtitleEnabled,
    subtitleColorId: subtitleEnabled
      ? normalizeWorkspaceSegmentEditorSetting(session?.subtitleColor) ?? fallbackStudioSubtitleColorOption.id
      : undefined,
    subtitleStyleId: subtitleEnabled
      ? normalizeWorkspaceSegmentEditorSetting(session?.subtitleStyle) ?? fallbackStudioSubtitleStyleOption.id
      : undefined,
    voiceEnabled,
    voiceId: globalVoiceEnabled ? normalizedGlobalVoiceType : undefined,
  };
};
