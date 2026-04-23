import { describe, expect, it } from "vitest";
import {
  filterWorkspaceStillAssetUrls,
  getWorkspaceSegmentPausedPreviewTime,
  isLikelyVideoAssetUrl,
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
});
