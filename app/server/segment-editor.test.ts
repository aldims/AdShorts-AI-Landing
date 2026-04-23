import { describe, expect, it } from "vitest";

import {
  buildWorkspaceSegmentEditorSegment,
  resolveWorkspaceSegmentEditorCustomMusicMetadata,
} from "./segment-editor.js";

describe("segment editor asset lifecycle mapping", () => {
  it("downgrades upstream video segments to photo when linked entries only expose photo assets", () => {
    const segment = buildWorkspaceSegmentEditorSegment(
      42,
      {
        current_video: "current-marker",
        index: 0,
        media_type: "video",
        original_video: "original-marker",
        text: "Segment",
      },
      {
        currentEntries: [
          {
            download_url: "/api/media/1097/download",
            media_asset_id: 1097,
            media_type: "photo",
            mime_type: "image/jpeg",
            role: "segment_current",
          },
        ],
        originalEntries: [
          {
            download_url: "/api/media/1097/download",
            media_asset_id: 1097,
            media_type: "photo",
            mime_type: "image/jpeg",
            role: "segment_original",
          },
        ],
        projectMediaByAssetId: new Map(),
        projectMediaLoaded: false,
      },
    );

    expect(segment?.mediaType).toBe("photo");
    expect(segment?.currentAsset?.mediaType).toBe("photo");
    expect(segment?.originalAsset?.mediaType).toBe("photo");
  });

  it("keeps upstream video segments as video when the current entry resolves to a video asset", () => {
    const segment = buildWorkspaceSegmentEditorSegment(
      42,
      {
        current_video: "current-marker",
        index: 0,
        media_type: "video",
        original_video: "original-marker",
        text: "Segment",
      },
      {
        currentEntries: [
          {
            download_url: "/api/media/1201/download",
            media_asset_id: 1201,
            media_type: "video",
            mime_type: "video/mp4",
            role: "segment_current",
          },
        ],
        originalEntries: [
          {
            download_url: "/api/media/1097/download",
            media_asset_id: 1097,
            media_type: "photo",
            mime_type: "image/jpeg",
            role: "segment_original",
          },
        ],
        projectMediaByAssetId: new Map(),
        projectMediaLoaded: false,
      },
    );

    expect(segment?.mediaType).toBe("video");
    expect(segment?.currentAsset?.mediaType).toBe("video");
    expect(segment?.originalAsset?.mediaType).toBe("photo");
  });

  it("marks missing linked project assets as deleted when the media envelope was loaded", () => {
    const segment = buildWorkspaceSegmentEditorSegment(
      42,
      {
        current_video: "current-marker",
        index: 0,
        media_type: "photo",
        original_video: "original-marker",
        text: "Segment",
      },
      {
        currentEntries: [
          {
            download_url: "/api/media/900/download",
            media_asset_id: 900,
            media_type: "photo",
            role: "segment_current",
          },
        ],
        originalEntries: [
          {
            download_url: "/api/media/900/download",
            media_asset_id: 900,
            media_type: "photo",
            role: "segment_original",
          },
        ],
        projectMediaByAssetId: new Map(),
        projectMediaLoaded: true,
      },
    );

    expect(segment?.currentAsset?.assetId).toBe(900);
    expect(segment?.currentAsset?.lifecycle).toBe("deleted");
    expect(segment?.originalAsset?.assetId).toBe(900);
    expect(segment?.originalAsset?.lifecycle).toBe("deleted");
  });

  it("keeps entry-backed assets available when the media envelope did not load", () => {
    const segment = buildWorkspaceSegmentEditorSegment(
      42,
      {
        current_video: "current-marker",
        index: 0,
        media_type: "photo",
        original_video: "original-marker",
        text: "Segment",
      },
      {
        currentEntries: [
          {
            download_url: "/api/media/901/download",
            media_asset_id: 901,
            media_type: "photo",
            role: "segment_current",
          },
        ],
        originalEntries: [
          {
            download_url: "/api/media/901/download",
            media_asset_id: 901,
            media_type: "photo",
            role: "segment_original",
          },
        ],
        projectMediaByAssetId: new Map(),
        projectMediaLoaded: false,
      },
    );

    expect(segment?.currentAsset?.assetId).toBe(901);
    expect(segment?.currentAsset?.lifecycle).toBe("ready");
    expect(segment?.originalAsset?.assetId).toBe(901);
    expect(segment?.originalAsset?.lifecycle).toBe("ready");
  });

  it("resolves custom music metadata from project details for segment editor reuse", () => {
    const metadata = resolveWorkspaceSegmentEditorCustomMusicMetadata({
      generation_settings: {
        custom_music_asset_id: 7788,
        custom_music_original_name: "ambient-loop.mp3",
      },
      music_name: "fallback-name.mp3",
    });

    expect(metadata.customMusicAssetId).toBe(7788);
    expect(metadata.customMusicFileName).toBe("ambient-loop.mp3");
  });
});
