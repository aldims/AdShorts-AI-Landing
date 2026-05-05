import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildWorkspaceSegmentEditorSessionFromPayload,
  buildWorkspaceSegmentEditorSegment,
  getWorkspaceSegmentEditorSessionForAccessibleProject,
  resolveWorkspaceSegmentEditorCustomMusicMetadata,
} from "./segment-editor.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    expect(segment?.currentPosterUrl).toContain("/api/workspace/media-assets/1201/poster");
    expect(segment?.originalAsset?.mediaType).toBe("photo");
    expect(segment?.originalPosterUrl).toBeNull();
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

  it("does not reuse the whole final video poster for timeline fallback segments", () => {
    const segment = buildWorkspaceSegmentEditorSegment(
      3311,
      {
        current_video: "/api/media/2405/download",
        duration: 5,
        index: 4,
        media_type: "video",
        original_video: "/api/media/2405/download",
        start_time: 18,
        end_time: 23,
        text: "Timeline fallback segment",
      },
      {
        currentEntries: [
          {},
          {},
          {},
          {},
          {
            download_url: "/api/media/2405/download",
            media_asset_id: 2405,
            media_type: "video",
            role: "final_video",
            source: "final_video",
          },
        ],
        originalEntries: [
          {},
          {},
          {},
          {},
          {
            download_url: "/api/media/2405/download",
            media_asset_id: 2405,
            media_type: "video",
            role: "final_video",
            source: "final_video",
          },
        ],
        projectMediaByAssetId: new Map(),
        projectMediaLoaded: false,
      },
    );

    expect(segment?.currentAsset?.assetId).toBe(2405);
    expect(segment?.currentPreviewUrl).toContain("segmentIndex=4");
    expect(segment?.currentPosterUrl).toContain("/api/workspace/project-segment-poster");
    expect(segment?.currentPosterUrl).toContain("segmentIndex=4");
    expect(segment?.currentPosterUrl).toContain("source=current");
    expect(segment?.currentPosterUrl).not.toContain("/api/workspace/media-assets/2405/poster");
    expect(segment?.originalPosterUrl).toContain("/api/workspace/project-segment-poster");
    expect(segment?.originalPosterUrl).toContain("source=original");
  });

  it("does not treat a current upload as the original visual when an original marker exists", () => {
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
            download_url: "/api/media/1001/download",
            media_asset_id: 1001,
            media_type: "photo",
            role: "segment_current",
            source_kind: "upload",
          },
        ],
        originalEntries: [],
        projectMediaByAssetId: new Map(),
        projectMediaLoaded: false,
      },
    );

    expect(segment?.currentSourceKind).toBe("upload");
    expect(segment?.originalAsset?.assetId).not.toBe(1001);
    expect(segment?.originalAsset?.lifecycle).toBe("unavailable");
    expect(segment?.originalSourceKind).toBe("unknown");
    expect(segment?.originalPlaybackUrl).toContain("source=original");
  });

  it("keeps the requested project id when upstream returns a different segment-editor project_id", () => {
    const session = buildWorkspaceSegmentEditorSessionFromPayload(3127, {
      project_id: 3117,
      segments: [
        {
          current_video: "current-marker",
          duration: 4,
          index: 0,
          media_type: "photo",
          original_video: "original-marker",
          text: "Segment",
        },
      ],
      title: "Selected project",
    });

    expect(session.projectId).toBe(3127);
    expect(session.title).toBe("Selected project");
    expect(session.segments[0]?.currentPlaybackUrl).toContain("projectId=3127");
    expect(session.segments[0]?.originalPlaybackUrl).toContain("projectId=3127");
  });

  it("uses generation_settings.source_video_urls as original source before rendered original_videos", () => {
    const session = buildWorkspaceSegmentEditorSessionFromPayload(
      3201,
      {
        project_id: 3201,
        segments: [
          {
            current_video: "current-marker",
            duration: 4,
            index: 0,
            media_type: "video",
            original_video: "original-marker",
            text: "Segment",
          },
        ],
        title: "Edited project",
      },
      {
        projectDetailsPayload: {
          generation_settings: {
            current_rendered_segments: [
              {
                download_url: "/api/media/1692/download",
                media_asset_id: 1692,
                media_type: "video",
                source: "rendered_segment",
              },
            ],
            original_videos: [
              {
                download_url: "/api/media/1692/download",
                media_asset_id: 1692,
                media_type: "video",
                source: "rendered_segment",
              },
            ],
            source_video_urls: [
              {
                download_url: "/api/media/1632/download",
                media_asset_id: 1632,
                media_type: "photo",
                source: "ai_generated",
              },
            ],
          },
        },
      },
    );

    expect(session.segments[0]?.currentAsset?.assetId).toBe(1692);
    expect(session.segments[0]?.currentAsset?.mediaType).toBe("video");
    expect(session.segments[0]?.originalAsset?.assetId).toBe(1632);
    expect(session.segments[0]?.originalAsset?.mediaType).toBe("photo");
  });

  it("resolves custom music metadata from project details for segment editor reuse", () => {
    const metadata = resolveWorkspaceSegmentEditorCustomMusicMetadata({
      generation_settings: {
        custom_music_asset_id: 7788,
        custom_music_original_name: "ambient-loop.mp3",
        music_type: "custom",
      },
      music_name: "fallback-name.mp3",
    });

    expect(metadata.customMusicAssetId).toBe(7788);
    expect(metadata.customMusicFileName).toBe("ambient-loop.mp3");
  });

  it("does not treat generated auto music assets as custom music", () => {
    const metadata = resolveWorkspaceSegmentEditorCustomMusicMetadata({
      generation_settings: {
        music_asset_id: 649,
        music_type: "ai",
      },
      music_name: "upbeat_10.mp3",
      music_type: "upbeat",
    });

    expect(metadata.customMusicAssetId).toBeNull();
    expect(metadata.customMusicFileName).toBe("");
  });

  it("keeps legacy explicit custom music metadata even when music type is absent", () => {
    const metadata = resolveWorkspaceSegmentEditorCustomMusicMetadata({
      generation_settings: {
        custom_music_asset_id: 7788,
        custom_music_original_name: "ambient-loop.mp3",
      },
      music_name: "rendered-name.mp3",
    });

    expect(metadata.customMusicAssetId).toBe(7788);
    expect(metadata.customMusicFileName).toBe("ambient-loop.mp3");
  });

  it("propagates upstream preparing responses as retryable workspace conflicts", async () => {
    const preparingMessage = "Project components are still being prepared";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/segment-editor")) {
        return new Response(JSON.stringify({ detail: preparingMessage }), {
          headers: { "Content-Type": "application/json" },
          status: 409,
        });
      }

      if (url.includes("/media")) {
        return new Response(JSON.stringify({ assets: [], project_id: 4321 }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      return new Response(JSON.stringify({ generation_settings: {}, project_id: 4321 }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getWorkspaceSegmentEditorSessionForAccessibleProject(
        { id: "user-preparing" },
        4321,
        { bypassCache: true },
      ),
    ).rejects.toMatchObject({
      message: preparingMessage,
      name: "WorkspaceSegmentEditorError",
      statusCode: 409,
    });
  });

  it("opens from project details when upstream readiness is stale but final media is present", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/segment-editor")) {
        return new Response(JSON.stringify({ detail: "Project components are still being prepared" }), {
          headers: { "Content-Type": "application/json" },
          status: 409,
        });
      }

      if (url.includes("/media")) {
        return new Response(JSON.stringify({ assets: [], project_id: 3311 }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      return new Response(
        JSON.stringify({
          ai_title: "Ready final video",
          description: "Project details fallback",
          generation_settings: {
            content_language: "en",
            original_video_segments: [
              {
                duration: 3,
                end_time: 3,
                segment_index: 0,
                start_time: 0,
                text: "First scene.",
              },
              {
                duration: 3,
                end_time: 6,
                segment_index: 1,
                start_time: 3,
                text: "Second scene.",
              },
            ],
            source_video_urls: [
              {
                download_url: "/api/media/2406/download",
                media_asset_id: 2406,
                media_type: "video",
                segment_index: 0,
                source: "stock",
              },
              {
                download_url: "/api/media/2405/download",
                media_asset_id: 2405,
                media_type: "video",
                source: "final_video",
              },
            ],
          },
          id: 3311,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await getWorkspaceSegmentEditorSessionForAccessibleProject(
      { id: "user-stale-readiness" },
      3311,
      { bypassCache: true },
    );

    expect(session.projectId).toBe(3311);
    expect(session.title).toBe("Ready final video");
    expect(session.segments).toHaveLength(2);
    expect(session.segments[0]?.text).toBe("First scene.");
    expect(session.segments[1]?.currentPlaybackUrl).toContain("projectId=3311");
  });
});
