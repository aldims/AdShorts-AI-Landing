import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  getWorkspacePreviewImageCacheKey,
  transformWorkspacePreviewImageBuffer,
  WORKSPACE_PREVIEW_IMAGE_MAX_DIMENSION,
} from "./preview-images.js";

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

  it("creates compact WebP previews bounded for high-density media tiles", async () => {
    const source = await sharp({
      create: {
        background: { alpha: 1, b: 80, g: 40, r: 20 },
        channels: 4,
        height: 1600,
        width: 900,
      },
    }).png().toBuffer();

    const preview = await transformWorkspacePreviewImageBuffer(source);
    const metadata = await sharp(preview).metadata();

    expect(metadata.format).toBe("webp");
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBe(WORKSPACE_PREVIEW_IMAGE_MAX_DIMENSION);
    expect(preview.byteLength).toBeLessThan(source.byteLength);
  });
});
