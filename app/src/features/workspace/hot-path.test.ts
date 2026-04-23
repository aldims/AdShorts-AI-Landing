import { describe, expect, it } from "vitest";

import {
  buildWorkspaceMediaLibraryRequestPath,
  canCapturePosterInBrowser,
  MEDIA_LIBRARY_PAGE_SIZE,
  shouldLoadWorkspaceMediaLibraryView,
} from "./hot-path";

describe("workspace hot path helpers", () => {
  it("loads media library only for the media studio view", () => {
    expect(shouldLoadWorkspaceMediaLibraryView("studio", "media")).toBe(true);
    expect(shouldLoadWorkspaceMediaLibraryView("studio", "projects")).toBe(false);
    expect(shouldLoadWorkspaceMediaLibraryView("overview", "media")).toBe(false);
  });

  it("allows browser poster capture for local draft media and same-origin video proxy routes", () => {
    expect(canCapturePosterInBrowser("blob:http://localhost/video")).toBe(true);
    expect(canCapturePosterInBrowser("data:video/mp4;base64,AAAA")).toBe(true);
    expect(canCapturePosterInBrowser("/api/workspace/project-segment-video?projectId=2893&segmentIndex=0")).toBe(true);
    expect(canCapturePosterInBrowser("/api/workspace/project-video?projectId=2893")).toBe(true);
    expect(canCapturePosterInBrowser("/api/workspace/media-assets/153")).toBe(true);
    expect(canCapturePosterInBrowser("/api/workspace/media-assets/153/playback")).toBe(true);
    expect(canCapturePosterInBrowser("/api/studio/playback/job-123")).toBe(true);
    expect(canCapturePosterInBrowser("/api/studio/segment-ai-video/jobs/job-123/video")).toBe(true);
    expect(canCapturePosterInBrowser("/api/studio/segment-photo-animation/jobs/job-456/video")).toBe(true);
    expect(canCapturePosterInBrowser("https://cdn.example.com/video.mp4")).toBe(false);
    expect(canCapturePosterInBrowser("/api/studio/video/123")).toBe(false);
  });

  it("builds paginated media library request paths", () => {
    expect(buildWorkspaceMediaLibraryRequestPath()).toBe(`/api/workspace/media-library?limit=${MEDIA_LIBRARY_PAGE_SIZE}`);
    expect(
      buildWorkspaceMediaLibraryRequestPath({
        cursor: "24",
        reload: true,
      }),
    ).toBe(`/api/workspace/media-library?limit=${MEDIA_LIBRARY_PAGE_SIZE}&cursor=24&reload=1`);
  });
});
