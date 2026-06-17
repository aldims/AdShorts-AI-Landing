const WORKSPACE_SEGMENT_VIDEO_ROUTE_PATTERN = /\/api\/workspace\/project-segment-video(?:[/?#]|$)/i;
const WORKSPACE_MEDIA_ASSET_PLAYBACK_ROUTE_PATTERN = /\/api\/workspace\/media-assets\/\d+\/playback(?:[/?#]|$)/i;
const MEDIA_DOWNLOAD_VIDEO_ROUTE_PATTERN = /\/api\/media\/\d+\/download(?:[/?#]|$)/i;
const VIDEO_ASSET_URL_PATTERN = /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i;

const getStableWorkspaceMediaAssetPosterUrl = (value: string) => {
  try {
    const url = new URL(value, "http://localhost");
    const match = url.pathname.match(/^\/api\/workspace\/media-assets\/(\d+)\/poster$/i);
    if (!match) {
      return value;
    }

    const version = url.searchParams.get("v");
    return !version || version.includes(":")
      ? `/api/workspace/media-assets/${match[1]}/poster`
      : value;
  } catch {
    return value;
  }
};

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

  const stablePosterUrl = getStableWorkspaceMediaAssetPosterUrl(normalizedPosterUrl);
  if (stablePosterUrl !== normalizedPosterUrl) {
    return stablePosterUrl;
  }

  if (normalizedPosterUrl === normalizedPreviewUrl || isLikelyVideoAssetUrl(normalizedPosterUrl)) {
    return "";
  }

  return normalizedPosterUrl;
};

export const shouldAllowWorkspaceSegmentPreviewVideoPlayback = (options: {
  allowVideoPlayback?: boolean;
  autoplay?: boolean;
  isPlaybackRequested?: boolean;
  previewKind: "image" | "video";
}) =>
  options.previewKind === "video" &&
  (options.allowVideoPlayback ?? true) &&
  Boolean(options.autoplay || options.isPlaybackRequested);
