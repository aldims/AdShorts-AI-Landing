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
        parts: [
          {
            frame: { height: 0.4, width: 0.9, x: 0.05, y: 0.05 },
            intrinsic_height: 220,
            intrinsic_width: 720,
            media_asset_id: 902,
            reveal: { delay_seconds: 0, duration_seconds: 0.65 },
            text: "Главный",
          },
          {
            frame: { height: 0.35, width: 0.7, x: 0.15, y: 0.6 },
            intrinsic_height: 180,
            intrinsic_width: 560,
            media_asset_id: 903,
            reveal: { delay_seconds: 0.85, duration_seconds: 0.65 },
            text: "факт",
          },
        ],
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
      animation: { durationSeconds: 1, type: "fade" },
      inputHash: "a".repeat(64),
      intrinsicHeight: 640,
      intrinsicWidth: 1280,
      mediaAssetId: 901,
      parts: [
        {
          frame: { height: 0.4, width: 0.9, x: 0.05, y: 0.05 },
          intrinsicHeight: 220,
          intrinsicWidth: 720,
          mediaAssetId: 902,
          reveal: { delaySeconds: 0, durationSeconds: 1.3 },
          text: "Главный",
        },
        {
          frame: { height: 0.35, width: 0.7, x: 0.15, y: 0.6 },
          intrinsicHeight: 180,
          intrinsicWidth: 560,
          mediaAssetId: 903,
          reveal: { delaySeconds: 1.7, durationSeconds: 1.3 },
          text: "факт",
        },
      ],
      sourceVisualIdentity: "asset:101",
      stylePrompt: "редакционный стиль",
      text: "Главный факт",
      transform: { centerX: 0.5, centerY: 0.25, width: 0.6 },
      version: 1,
    });
  });

  it("uses the infographic source asset instead of a baked legacy original", () => {
    const cleanSourceAssetId = 10222;
    const segment = buildWorkspaceSegmentEditorSegment(
      4284,
      {
        current_video: "asset:10485",
        duration: 4,
        end_time: 4,
        index: 0,
        infographic: {
          input_hash: "b".repeat(64),
          intrinsic_height: 640,
          intrinsic_width: 1280,
          media_asset_id: 10244,
          source_visual_identity: `asset:${cleanSourceAssetId}`,
          text: "Создайте атмосферу уюта",
          transform: { center_x: 0.5, center_y: 0.25, width: 0.6 },
          version: 1,
        },
        media_type: "video",
        original_video: "asset:10485",
        start_time: 0,
        text: "Сцена",
      },
      {
        currentEntries: [
          {
            media_asset_id: 10485,
            media_type: "video",
            role: "final_video",
            segment_index: 0,
          },
        ],
        originalEntries: [
          {
            media_asset_id: 10485,
            media_type: "video",
            role: "final_video",
            segment_index: 0,
          },
        ],
        projectMediaByAssetId: new Map([
          [
            cleanSourceAssetId,
            {
              assetId: cleanSourceAssetId,
              createdAt: "2026-07-19T10:59:00.000Z",
              deletedAt: null,
              downloadPath: "/api/media/10222/download",
              downloadUrl: null,
              durationSeconds: 4,
              expiresAt: null,
              isCurrent: false,
              kind: "rendered_segment",
              libraryKind: "photo_animation",
              lifecycle: "ready",
              mediaType: "video",
              mimeType: "video/mp4",
              originalUrl: null,
              playbackUrl: "/api/media/10222/download",
              projectId: 4271,
              renderedAnimationMode: null,
              renderedViaI2v: true,
              role: "source_upload",
              segmentIndex: 0,
              sourceKind: "ai_generated",
              status: "ready",
              storageKey: "projects/4284/segments/0/source.mp4",
            },
          ],
        ]),
        projectMediaLoaded: true,
      },
    );

    expect(segment?.infographic?.mediaAssetId).toBe(10244);
    expect(segment?.originalAsset?.assetId).toBe(cleanSourceAssetId);
    expect(segment?.originalPlaybackUrl).toBe(
      `/api/workspace/media-assets/${cleanSourceAssetId}/playback`,
    );
    expect(segment?.originalPreviewUrl).toBe(
      `/api/workspace/media-assets/${cleanSourceAssetId}/playback`,
    );
    expect(segment?.originalPosterUrl).toContain(
      `/api/workspace/media-assets/${cleanSourceAssetId}/poster`,
    );
  });
});
