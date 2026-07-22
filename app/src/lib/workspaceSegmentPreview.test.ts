import { describe, expect, it } from "vitest";
import {
  clearWorkspaceSegmentPreviewTimes,
  filterWorkspaceStillAssetUrls,
  getWorkspaceSegmentPausedPreviewTime,
  isLikelyVideoAssetUrl,
  resolveWorkspaceSegmentIdleVideoPreload,
  sanitizeWorkspaceSegmentPosterUrl,
} from "./workspaceSegmentPreview";

describe("workspace segment preview helpers", () => {
  it("treats workspace segment proxy routes as video assets", () => {
    expect(isLikelyVideoAssetUrl("/api/workspace/project-segment-video?projectId=2890&segmentIndex=1")).toBe(true);
    expect(isLikelyVideoAssetUrl("/api/workspace/media-assets/153/playback")).toBe(true);
    expect(isLikelyVideoAssetUrl("/api/media/4/download")).toBe(true);
    expect(isLikelyVideoAssetUrl("https://cdn.example.com/video.mp4")).toBe(true);
    expect(isLikelyVideoAssetUrl("https://cdn.example.com/poster.jpg")).toBe(false);
  });

  it("rejects video urls when choosing a poster for video previews", () => {
    const previewUrl = "/api/workspace/project-segment-video?projectId=2890&segmentIndex=1";

    expect(sanitizeWorkspaceSegmentPosterUrl("video", previewUrl, previewUrl)).toBe("");
    expect(
      sanitizeWorkspaceSegmentPosterUrl("video", previewUrl, "https://cdn.example.com/segments/1/video.mp4"),
    ).toBe("");
    expect(
      sanitizeWorkspaceSegmentPosterUrl("video", previewUrl, "https://cdn.example.com/segments/1/poster.jpg"),
    ).toBe("https://cdn.example.com/segments/1/poster.jpg");
    expect(
      sanitizeWorkspaceSegmentPosterUrl("video", previewUrl, "/api/workspace/media-assets/903/poster?tile=1"),
    ).toBe("/api/workspace/media-assets/903/poster?tile=1");
  });

  it("filters proxy video routes out of still-image candidate lists", () => {
    expect(
      filterWorkspaceStillAssetUrls([
        "/api/workspace/project-segment-video?projectId=2890&segmentIndex=2&delivery=preview",
        "https://cdn.example.com/segments/2/poster.jpg",
        "https://cdn.example.com/segments/2/poster.jpg",
        "https://cdn.example.com/segments/2/frame.png",
      ]),
    ).toEqual([
      "https://cdn.example.com/segments/2/poster.jpg",
      "https://cdn.example.com/segments/2/frame.png",
    ]);
  });

  it("samples paused video previews deeper into the clip to avoid identical opening frames", () => {
    expect(getWorkspaceSegmentPausedPreviewTime(null)).toBe(0.001);
    expect(getWorkspaceSegmentPausedPreviewTime(0.2)).toBeCloseTo(0.1, 3);
    expect(getWorkspaceSegmentPausedPreviewTime(0.6)).toBeCloseTo(0.408, 3);
    expect(getWorkspaceSegmentPausedPreviewTime(2)).toBeCloseTo(1.36, 3);
    expect(getWorkspaceSegmentPausedPreviewTime(8)).toBeCloseTo(3.2, 3);
  });

  it("keeps empty preview-time resets idempotent", () => {
    const emptyTimes: Record<number, number> = {};
    const populatedTimes = { 0: 1.2, 2: 0.4 };

    expect(clearWorkspaceSegmentPreviewTimes(emptyTimes)).toBe(emptyTimes);
    expect(clearWorkspaceSegmentPreviewTimes(populatedTimes)).toEqual({});
    expect(clearWorkspaceSegmentPreviewTimes(populatedTimes)).not.toBe(populatedTimes);
  });

  it("keeps loading an active carousel video until its first poster frame is ready", () => {
    expect(
      resolveWorkspaceSegmentIdleVideoPreload({
        hasPosterFrame: false,
        isActiveCarouselCard: true,
        preload: "metadata",
      }),
    ).toBe("metadata");
    expect(
      resolveWorkspaceSegmentIdleVideoPreload({
        hasPosterFrame: false,
        isActiveCarouselCard: true,
        preload: "auto",
      }),
    ).toBe("metadata");
    expect(
      resolveWorkspaceSegmentIdleVideoPreload({
        hasPosterFrame: true,
        isActiveCarouselCard: true,
        preload: "metadata",
      }),
    ).toBe("none");
    expect(
      resolveWorkspaceSegmentIdleVideoPreload({
        hasPosterFrame: false,
        isActiveCarouselCard: false,
        preload: "metadata",
      }),
    ).toBe("none");
  });
});
