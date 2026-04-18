import { describe, expect, it } from "vitest";

import { resolveWorkspaceMediaSurface } from "./workspaceResolvedMedia";

describe("workspace resolved media surface", () => {
  it("keeps generated carousel video idle until playback is requested", () => {
    const surface = resolveWorkspaceMediaSurface({
      context: "segment-carousel-card",
      displayUrl: "/api/studio/segment-ai-video/jobs/job-1/video",
      isGeneratedVideo: true,
      previewKind: "video",
      viewerUrl: "/api/studio/segment-ai-video/jobs/job-1/video",
    });

    expect(surface.mountVideoWhenIdle).toBe(false);
    expect(surface.preloadPolicy).toBe("none");
    expect(surface.posterUrl).toBeNull();
    expect(surface.allowBrowserPosterCapture).toBe(true);
    expect(surface.subtitleMode).toBe("active-only");
  });

  it("mounts carousel video for playback after the card is clicked", () => {
    const surface = resolveWorkspaceMediaSurface({
      context: "segment-carousel-card",
      displayUrl: "/api/studio/segment-ai-video/jobs/job-1/video",
      isGeneratedVideo: true,
      isPlaybackRequested: true,
      previewKind: "video",
      viewerUrl: "/api/studio/segment-ai-video/jobs/job-1/video",
    });

    expect(surface.mountVideoWhenIdle).toBe(true);
    expect(surface.preloadPolicy).toBe("auto");
    expect(surface.preferPosterFrame).toBe(false);
    expect(surface.primePausedFrame).toBe(false);
  });

  it("keeps generated AI video poster routes when the poster comes from the generated video", () => {
    const surface = resolveWorkspaceMediaSurface({
      context: "segment-carousel-card",
      displayUrl: "/api/studio/segment-ai-video/jobs/job-1/video",
      isGeneratedVideo: true,
      posterUrl: "/api/studio/segment-ai-video/jobs/job-1/poster?v=job-1",
      previewKind: "video",
      viewerUrl: "/api/studio/segment-ai-video/jobs/job-1/video",
    });

    expect(surface.posterUrl).toBe("/api/studio/segment-ai-video/jobs/job-1/poster?v=job-1");
    expect(surface.mountVideoWhenIdle).toBe(false);
    expect(surface.preloadPolicy).toBe("none");
    expect(surface.preferPosterFrame).toBe(true);
  });

  it("prefers still poster for thumb video when a stable poster exists", () => {
    const surface = resolveWorkspaceMediaSurface({
      context: "segment-thumb",
      displayUrl: "/api/workspace/project-segment-video?projectId=2890&segmentIndex=1",
      fallbackPosterUrl: "https://cdn.example.com/fallback.jpg",
      posterUrl: "https://cdn.example.com/poster.jpg",
      previewKind: "video",
      viewerUrl: "/api/workspace/project-segment-video?projectId=2890&segmentIndex=1",
    });

    expect(surface.mountVideoWhenIdle).toBe(false);
    expect(surface.preloadPolicy).toBe("none");
    expect(surface.posterUrl).toBe("https://cdn.example.com/poster.jpg");
    expect(surface.preferPosterFrame).toBe(true);
  });

  it("keeps thumb video idle when a segment has no poster", () => {
    const surface = resolveWorkspaceMediaSurface({
      context: "segment-thumb",
      displayUrl: "/api/workspace/project-segment-video?projectId=2890&segmentIndex=1",
      isGeneratedVideo: true,
      previewKind: "video",
      viewerUrl: "/api/workspace/project-segment-video?projectId=2890&segmentIndex=1",
    });

    expect(surface.mountVideoWhenIdle).toBe(false);
    expect(surface.preloadPolicy).toBe("none");
    expect(surface.preferPosterFrame).toBe(true);
    expect(surface.primePausedFrame).toBe(false);
  });

  it("always mounts media-library video tiles and primes a paused frame", () => {
    const surface = resolveWorkspaceMediaSurface({
      context: "media-library-tile",
      displayUrl: "/api/studio/segment-photo-animation/jobs/job-2/video",
      previewKind: "video",
      viewerUrl: "/api/studio/segment-photo-animation/jobs/job-2/video",
    });

    expect(surface.mountVideoWhenIdle).toBe(true);
    expect(surface.preloadPolicy).toBe("auto");
    expect(surface.preferPosterFrame).toBe(true);
    expect(surface.primePausedFrame).toBe(true);
    expect(surface.allowBrowserPosterCapture).toBe(true);
  });

  it("configures viewer video for direct playback instead of poster-only mode", () => {
    const surface = resolveWorkspaceMediaSurface({
      context: "media-viewer",
      displayUrl: "/api/workspace/project-segment-video?projectId=2893&segmentIndex=0",
      posterUrl: "https://cdn.example.com/poster.jpg",
      previewKind: "video",
      viewerUrl: "/api/workspace/project-segment-video?projectId=2893&segmentIndex=0",
    });

    expect(surface.mountVideoWhenIdle).toBe(true);
    expect(surface.preloadPolicy).toBe("auto");
    expect(surface.preferMutedAutoplay).toBe(true);
    expect(surface.preferPosterFrame).toBe(false);
  });

  it("leaves image surfaces free from video-specific policies", () => {
    const surface = resolveWorkspaceMediaSurface({
      context: "segment-visual-preview",
      displayUrl: "https://cdn.example.com/frame.jpg",
      previewKind: "image",
      viewerUrl: "https://cdn.example.com/frame.jpg",
    });

    expect(surface.displayUrl).toBe("https://cdn.example.com/frame.jpg");
    expect(surface.viewerUrl).toBe("https://cdn.example.com/frame.jpg");
    expect(surface.mountVideoWhenIdle).toBe(false);
    expect(surface.preloadPolicy).toBe("none");
    expect(surface.allowBrowserPosterCapture).toBe(false);
  });
});
