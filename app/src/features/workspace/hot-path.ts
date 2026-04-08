export const MEDIA_LIBRARY_PAGE_SIZE = 24;

const normalizeText = (value: unknown) => String(value ?? "").trim();

export const canCapturePosterInBrowser = (videoUrl: string | null | undefined) => {
  const normalizedVideoUrl = normalizeText(videoUrl).toLowerCase();
  return normalizedVideoUrl.startsWith("blob:") || normalizedVideoUrl.startsWith("data:");
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
