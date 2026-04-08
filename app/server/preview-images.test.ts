import { describe, expect, it } from "vitest";

import { getWorkspacePreviewImageCacheKey } from "./preview-images.js";

describe("preview image cache key", () => {
  it("deduplicates identical upstream images across different media cards", () => {
    const targetUrl = new URL("https://cdn.example.com/assets/preview.png?admin_token=secret");

    const left = getWorkspacePreviewImageCacheKey({
      previewId: "workspace-media:2875:0:ai_photo",
      targetUrl,
      version: "v1",
    });
    const right = getWorkspacePreviewImageCacheKey({
      previewId: "workspace-media:2878:2:ai_photo",
      targetUrl,
      version: "v1",
    });

    expect(left).toBe(right);
    expect(left).not.toContain("admin_token");
  });
});
