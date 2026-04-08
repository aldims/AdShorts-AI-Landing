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

  it("allows browser poster capture only for local draft media", () => {
    expect(canCapturePosterInBrowser("blob:http://localhost/video")).toBe(true);
    expect(canCapturePosterInBrowser("data:video/mp4;base64,AAAA")).toBe(true);
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
