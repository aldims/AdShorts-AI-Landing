import { describe, expect, it } from "vitest";

import { buildWorkspaceSegmentEditorSegment } from "./segment-editor.js";

describe("workspace segment editor infographic hydration", () => {
  it("hydrates the durable infographic overlay from an AdsFlow segment", () => {
    const segment = buildWorkspaceSegmentEditorSegment(42, {
      current_video: "segment-current",
      duration: 4,
      end_time: 4,
      index: 0,
      infographic: {
        animation: { duration_seconds: 0.55, type: "fade" },
        input_hash: "a".repeat(64),
        intrinsic_height: 640,
        intrinsic_width: 1280,
        media_asset_id: 901,
        source_visual_identity: "asset:101",
        style_prompt: "редакционный стиль",
        text: "Главный факт",
        transform: { center_x: 0.5, center_y: 0.25, width: 0.6 },
        version: 1,
      },
      media_type: "photo",
      original_video: "segment-original",
      start_time: 0,
      text: "Сцена",
    });

    expect(segment?.infographic).toEqual({
      animation: { durationSeconds: 0.55, type: "fade" },
      inputHash: "a".repeat(64),
      intrinsicHeight: 640,
      intrinsicWidth: 1280,
      mediaAssetId: 901,
      sourceVisualIdentity: "asset:101",
      stylePrompt: "редакционный стиль",
      text: "Главный факт",
      transform: { centerX: 0.5, centerY: 0.25, width: 0.6 },
      version: 1,
    });
  });
});
