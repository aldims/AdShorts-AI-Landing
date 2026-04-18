export const MEDIA_LIBRARY_PAGE_SIZE = 24;

const normalizeText = (value: unknown) => String(value ?? "").trim();
const SAME_ORIGIN_VIDEO_PROXY_ROUTE_PATTERN =
  /^\/api\/(?:workspace\/project-segment-video|workspace\/project-video|workspace\/media-assets\/\d+|studio\/playback\/|studio\/segment-ai-video\/jobs\/[^/]+\/video|studio\/segment-photo-animation\/jobs\/[^/]+\/video)/i;

export const canCapturePosterInBrowser = (videoUrl: string | null | undefined) => {
  const normalizedVideoUrl = normalizeText(videoUrl);
  const normalizedVideoUrlLower = normalizedVideoUrl.toLowerCase();
  return (
    normalizedVideoUrlLower.startsWith("blob:") ||
    normalizedVideoUrlLower.startsWith("data:") ||
    SAME_ORIGIN_VIDEO_PROXY_ROUTE_PATTERN.test(normalizedVideoUrl)
  );
};

export const shouldLoadWorkspaceMediaLibraryView = (
  activeTab: string | null | undefined,
  studioView: string | null | undefined,
) => normalizeText(activeTab) === "studio" && normalizeText(studioView) === "media";

export const buildWorkspaceMediaLibraryRequestPath = (options?: {
  cursor?: string | null;
  limit?: number;
  reload?: boolean;
}) => {
  const requestUrl = new URL("/api/workspace/media-library", "http://localhost");
  const limit = Number.isFinite(options?.limit) ? Math.max(1, Math.trunc(Number(options?.limit))) : MEDIA_LIBRARY_PAGE_SIZE;

  requestUrl.searchParams.set("limit", String(limit));

  const cursor = normalizeText(options?.cursor);
  if (cursor) {
    requestUrl.searchParams.set("cursor", cursor);
  }

  if (options?.reload) {
    requestUrl.searchParams.set("reload", "1");
  }

  return `${requestUrl.pathname}${requestUrl.search}`;
};
