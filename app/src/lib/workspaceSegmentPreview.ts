const WORKSPACE_SEGMENT_VIDEO_ROUTE_PATTERN = /\/api\/workspace\/project-segment-video(?:[/?#]|$)/i;
const VIDEO_ASSET_URL_PATTERN = /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i;

export const isLikelyVideoAssetUrl = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return false;
  }

  return WORKSPACE_SEGMENT_VIDEO_ROUTE_PATTERN.test(normalizedValue) || VIDEO_ASSET_URL_PATTERN.test(normalizedValue);
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
