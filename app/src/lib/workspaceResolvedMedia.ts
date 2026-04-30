import { canCapturePosterInBrowser } from "../features/workspace/hot-path";
import { sanitizeWorkspaceSegmentPosterUrl } from "./workspaceSegmentPreview";

export type WorkspaceResolvedMediaPreviewKind = "image" | "video";
export type WorkspaceResolvedMediaPreloadPolicy = "auto" | "metadata" | "none";
export type WorkspaceResolvedMediaSubtitleMode = "active-only" | "none";
export type WorkspaceResolvedMediaContext =
  | "segment-carousel-card"
  | "segment-thumb"
  | "segment-drag-ghost"
  | "segment-visual-preview"
  | "media-library-tile"
  | "segment-modal-library-tile"
  | "media-viewer";

export type WorkspaceResolvedMediaSurface = {
  allowBrowserPosterCapture: boolean;
  displayUrl: string | null;
  fallbackPosterUrl: string | null;
  fallbackUrls: string[];
  mountVideoWhenIdle: boolean;
  posterUrl: string | null;
  preferMutedAutoplay: boolean;
  preferPosterFrame: boolean;
  preloadPolicy: WorkspaceResolvedMediaPreloadPolicy;
  previewKind: WorkspaceResolvedMediaPreviewKind;
  primePausedFrame: boolean;
  subtitleMode: WorkspaceResolvedMediaSubtitleMode;
  viewerUrl: string | null;
};

type WorkspaceResolvedMediaSurfaceInput = {
  context: WorkspaceResolvedMediaContext;
  displayUrl: string | null | undefined;
  fallbackPosterUrl?: string | null | undefined;
  fallbackUrls?: Array<string | null | undefined>;
  forceMountVideoWhenIdle?: boolean;
  isGeneratedVideo?: boolean;
  isPlaybackRequested?: boolean;
  posterUrl?: string | null | undefined;
  previewKind: WorkspaceResolvedMediaPreviewKind;
  viewerUrl?: string | null | undefined;
};

const normalizeResolvedMediaUrl = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue || null;
};

const getUniqueResolvedMediaUrls = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      values
        .map((value) => normalizeResolvedMediaUrl(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );

export const resolveWorkspaceMediaSurface = (
  input: WorkspaceResolvedMediaSurfaceInput,
): WorkspaceResolvedMediaSurface => {
  const displayUrl = normalizeResolvedMediaUrl(input.displayUrl);
  const viewerUrl = normalizeResolvedMediaUrl(input.viewerUrl) ?? displayUrl;
  const surfaceReferenceUrl = viewerUrl ?? displayUrl ?? "";
  const previewKind = input.previewKind;
  const rawPosterUrl = normalizeResolvedMediaUrl(input.posterUrl);
  const rawFallbackPosterUrl = normalizeResolvedMediaUrl(input.fallbackPosterUrl);
  const posterUrl =
    previewKind === "video" && surfaceReferenceUrl
      ? sanitizeWorkspaceSegmentPosterUrl(previewKind, surfaceReferenceUrl, rawPosterUrl)
      : rawPosterUrl;
  const fallbackPosterUrl =
    previewKind === "video" && surfaceReferenceUrl
      ? sanitizeWorkspaceSegmentPosterUrl(previewKind, surfaceReferenceUrl, rawFallbackPosterUrl)
      : rawFallbackPosterUrl;
  const fallbackUrls = getUniqueResolvedMediaUrls(input.fallbackUrls ?? []);
  const isPlaybackRequested = previewKind === "video" && Boolean(input.isPlaybackRequested);
  const forceMountVideoWhenIdle = previewKind === "video" && Boolean(input.forceMountVideoWhenIdle);

  let mountVideoWhenIdle = false;
  let preferPosterFrame = false;
  let primePausedFrame = false;
  let preloadPolicy: WorkspaceResolvedMediaPreloadPolicy = "none";
  let preferMutedAutoplay = false;
  let subtitleMode: WorkspaceResolvedMediaSubtitleMode = "none";
  let allowBrowserPosterCapture = false;

  if (previewKind === "video") {
    switch (input.context) {
      case "segment-carousel-card": {
        const hasStablePosterFrame = Boolean(posterUrl || fallbackPosterUrl);
        mountVideoWhenIdle = isPlaybackRequested || forceMountVideoWhenIdle;
        preloadPolicy = isPlaybackRequested ? "auto" : mountVideoWhenIdle ? "metadata" : "none";
        preferPosterFrame = !isPlaybackRequested;
        primePausedFrame = !isPlaybackRequested && forceMountVideoWhenIdle && !hasStablePosterFrame;
        subtitleMode = "active-only";
        allowBrowserPosterCapture = true;
        break;
      }
      case "segment-thumb": {
        mountVideoWhenIdle = false;
        preloadPolicy = "none";
        preferPosterFrame = true;
        primePausedFrame = false;
        break;
      }
      case "segment-drag-ghost": {
        mountVideoWhenIdle = false;
        preloadPolicy = "none";
        preferPosterFrame = true;
        break;
      }
      case "segment-visual-preview": {
        mountVideoWhenIdle = true;
        preloadPolicy = "auto";
        allowBrowserPosterCapture = true;
        break;
      }
      case "media-library-tile":
      case "segment-modal-library-tile": {
        mountVideoWhenIdle = false;
        preloadPolicy = "none";
        preferPosterFrame = true;
        primePausedFrame = false;
        break;
      }
      case "media-viewer": {
        mountVideoWhenIdle = true;
        preloadPolicy = "auto";
        preferMutedAutoplay = true;
        allowBrowserPosterCapture = true;
        break;
      }
    }
  }

  return {
    allowBrowserPosterCapture:
      allowBrowserPosterCapture && previewKind === "video" && Boolean(viewerUrl) && canCapturePosterInBrowser(viewerUrl),
    displayUrl,
    fallbackPosterUrl: fallbackPosterUrl || null,
    fallbackUrls,
    mountVideoWhenIdle,
    posterUrl: posterUrl || null,
    preferMutedAutoplay,
    preferPosterFrame,
    preloadPolicy,
    previewKind,
    primePausedFrame,
    subtitleMode,
    viewerUrl,
  };
};
