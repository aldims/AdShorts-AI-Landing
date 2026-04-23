const WORKSPACE_SEGMENT_VIDEO_ROUTE_PATTERN = /\/api\/workspace\/project-segment-video(?:[/?#]|$)/i;
const WORKSPACE_MEDIA_ASSET_PLAYBACK_ROUTE_PATTERN = /\/api\/workspace\/media-assets\/\d+\/playback(?:[/?#]|$)/i;
const MEDIA_DOWNLOAD_VIDEO_ROUTE_PATTERN = /\/api\/media\/\d+\/download(?:[/?#]|$)/i;
const VIDEO_ASSET_URL_PATTERN = /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i;

export const getWorkspaceSegmentPausedPreviewTime = (duration: number | null | undefined) => {
  const normalizedDuration = Number(duration);
  if (!Number.isFinite(normalizedDuration) || normalizedDuration <= 0.04) {
    return 0.001;
  }

  const safeDuration = Math.max(0, normalizedDuration);
  const preferredPreviewTime = Math.min(3.2, safeDuration * 0.68);
  const maxSafePreviewTime = safeDuration > 0.24 ? safeDuration - 0.16 : safeDuration * 0.5;

  return Math.max(0.001, Math.min(preferredPreviewTime, maxSafePreviewTime));
};

export const isLikelyVideoAssetUrl = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return false;
  }

  return (
    WORKSPACE_SEGMENT_VIDEO_ROUTE_PATTERN.test(normalizedValue) ||
    WORKSPACE_MEDIA_ASSET_PLAYBACK_ROUTE_PATTERN.test(normalizedValue) ||
    MEDIA_DOWNLOAD_VIDEO_ROUTE_PATTERN.test(normalizedValue) ||
    VIDEO_ASSET_URL_PATTERN.test(normalizedValue)
  );
};

export const filterWorkspaceStillAssetUrls = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter((value) => Boolean(value) && !isLikelyVideoAssetUrl(value)),
    ),
  );

export const sanitizeWorkspaceSegmentPosterUrl = (
  previewKind: "image" | "video",
  previewUrl: string,
  posterUrl: string | null | undefined,
) => {
  const normalizedPreviewUrl = previewUrl.trim();
  const normalizedPosterUrl = String(posterUrl ?? "").trim();

  if (!normalizedPosterUrl) {
    return "";
  }

  if (previewKind !== "video") {
    return normalizedPosterUrl;
  }

  if (normalizedPosterUrl === normalizedPreviewUrl || isLikelyVideoAssetUrl(normalizedPosterUrl)) {
    return "";
  }

  return normalizedPosterUrl;
};
