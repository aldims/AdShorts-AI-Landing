import { describe, expect, it } from "vitest";
import { filterWorkspaceStillAssetUrls, isLikelyVideoAssetUrl, sanitizeWorkspaceSegmentPosterUrl } from "./workspaceSegmentPreview";

describe("workspace segment preview helpers", () => {
  it("treats workspace segment proxy routes as video assets", () => {
    expect(isLikelyVideoAssetUrl("/api/workspace/project-segment-video?projectId=2890&segmentIndex=1")).toBe(true);
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
});
