import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildWorkspaceSegmentEditorSessionFromPayload,
  buildWorkspaceSegmentEditorSegment,
  getWorkspaceSegmentEditorSessionForAccessibleProject,
  readWorkspaceAudioDurationSecondsFromBuffer,
  resolveWorkspaceSegmentEditorCustomMusicMetadata,
} from "./segment-editor.js";
import type { WorkspaceMediaAssetRef } from "../shared/workspace-media-assets.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const createPcmWavBuffer = (durationSeconds: number) => {
  const sampleRate = 24_000;
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = Math.max(1, Math.round(durationSeconds * sampleRate * channels * bytesPerSample));
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
};

describe("segment editor audio duration parser", () => {
  it("counts MP3 frames instead of relying on rounded metadata", () => {
    const frameCount = 114;
    const frameLength = 576;
    const buffer = Buffer.alloc(10 + frameCount * frameLength);
    buffer.write("ID3", 0, "ascii");
    buffer[3] = 4;

    for (let index = 0; index < frameCount; index += 1) {
      const offset = 10 + index * frameLength;
      buffer[offset] = 0xff;
      buffer[offset + 1] = 0xfb;
      buffer[offset + 2] = 0x98;
      buffer[offset + 3] = 0xc0;
    }

    expect(readWorkspaceAudioDurationSecondsFromBuffer(buffer)).toBe(4.104);
  });

  it("prefers WAV container duration even when PCM data contains MP3-like bytes", () => {
    const buffer = createPcmWavBuffer(2.25);
    buffer[44] = 0xff;
    buffer[45] = 0xfb;
    buffer[46] = 0x98;
    buffer[47] = 0xc0;

    expect(readWorkspaceAudioDurationSecondsFromBuffer(buffer)).toBe(2.25);
  });
});

describe("segment editor asset lifecycle mapping", () => {
  const createMediaAsset = (overrides: Partial<WorkspaceMediaAssetRef> = {}): WorkspaceMediaAssetRef => ({
    assetId: 333,
    createdAt: null,
    deletedAt: null,
    downloadPath: "/api/media/333/download",
    downloadUrl: null,
    expiresAt: null,
    isCurrent: true,
    kind: "segment_scene_sound",
    libraryKind: null,
    lifecycle: "ready",
    mediaType: "audio",
    mimeType: "audio/wav",
    originalUrl: null,
    playbackUrl: "/api/media/333/download",
    projectId: 42,
    role: "segment_scene_sound",
    segmentIndex: 0,
    sourceKind: null,
    status: "ready",
    storageKey: "projects/42/segment-scene-sound-333.wav",
    ...overrides,
  });

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

  it("restores the original video source duration separately from the voice-trimmed slot", () => {
    const segment = buildWorkspaceSegmentEditorSegment(
      42,
      {
        current_video: "current-marker",
        duration: 2.7,
        duration_mode: "auto",
        index: 1,
        media_type: "video",
        original_video: "original-marker",
        text: "Whisk eggs with sugar and salt.",
      },
      {
        currentEntries: [
          {},
          {
            download_url: "/api/media/1202/download",
            duration_seconds: 4.1,
            media_type: "video",
            mime_type: "video/mp4",
            role: "segment_current",
            source_kind: "ai_generated",
          },
        ],
        originalEntries: [
          {},
          {
            download_url: "/api/media/1202/download",
            duration_seconds: 4.1,
            media_type: "video",
            mime_type: "video/mp4",
            role: "segment_original",
            source_kind: "ai_generated",
          },
        ],
        projectMediaByAssetId: new Map(),
        projectMediaLoaded: false,
      },
    );

    expect(segment?.duration).toBe(2.7);
    expect(segment?.durationExtensionSourceDurationSeconds).toBe(5);
    expect(segment?.duration_extension_source_duration_seconds).toBe(5);
    expect(segment?.currentSourceKind).toBe("ai_generated");
  });

  it("keeps generated video source duration at the default when upstream sends a trimmed source duration", () => {
    const segment = buildWorkspaceSegmentEditorSegment(
      42,
      {
        current_video: "current-marker",
        duration: 4.1,
        index: 1,
        media_type: "video",
        original_video: "original-marker",
        source_duration_seconds: 4.1,
        text: "Whisk eggs with sugar and salt.",
      },
      {
        currentEntries: [
          {},
          {
            download_url: "/api/media/1202/download",
            duration_seconds: 4.1,
            media_type: "video",
            mime_type: "video/mp4",
            role: "segment_current",
            source_kind: "ai_generated",
          },
        ],
        originalEntries: [],
        projectMediaByAssetId: new Map(),
        projectMediaLoaded: false,
      },
    );

    expect(segment?.duration).toBe(4.1);
    expect(segment?.durationExtensionSourceDurationSeconds).toBe(5);
    expect(segment?.duration_extension_source_duration_seconds).toBe(5);
  });

  it("prefers explicit editor source duration from upstream payload over media entry duration", () => {
    const segment = buildWorkspaceSegmentEditorSegment(
      42,
      {
        current_video: "current-marker",
        duration: 4.1,
        duration_extension_source_duration_seconds: 5,
        index: 1,
        media_type: "video",
        original_video: "original-marker",
        text: "Whisk eggs with sugar and salt.",
      },
      {
        currentEntries: [
          {
            duration_seconds: 4.1,
            media_type: "video",
            mime_type: "video/mp4",
            role: "segment_current",
          },
        ],
        originalEntries: [],
        projectMediaByAssetId: new Map(),
        projectMediaLoaded: false,
      },
    );

    expect(segment?.duration).toBe(4.1);
    expect(segment?.durationExtensionSourceDurationSeconds).toBe(5);
  });

  it("restores a scene sound asset from project media into the editor segment", () => {
    const segment = buildWorkspaceSegmentEditorSegment(
      42,
      {
        current_video: "current-marker",
        duration: 5,
        index: 0,
        text: "Segment",
      },
      {
        currentEntries: [],
        originalEntries: [],
        projectMediaAssets: [createMediaAsset()],
        projectMediaByAssetId: new Map(),
        projectMediaLoaded: true,
      },
    );

    expect(segment?.sceneSoundAssetId).toBe(333);
    expect(segment?.scene_sound?.media_asset_id).toBe(333);
    expect(segment?.scene_sound?.mime_type).toBe("audio/wav");
  });

  it("restores a current segment_sound media asset into the matching editor segment", () => {
    const segment = buildWorkspaceSegmentEditorSegment(
      42,
      {
        current_video: "current-marker",
        duration: 5,
        index: 1,
        text: "Segment",
      },
      {
        currentEntries: [],
        originalEntries: [],
        projectMediaAssets: [
          createMediaAsset({
            assetId: 7712,
            kind: "segment_sound",
            libraryKind: "scene_sound",
            role: "segment_sound",
            segmentIndex: 1,
            sourceKind: "ai_scene_sound",
            storageKey: "projects/42/segment-2-sound.wav",
          }),
        ],
        projectMediaByAssetId: new Map(),
        projectMediaLoaded: true,
      },
    );

    expect(segment?.sceneSoundAssetId).toBe(7712);
    expect(segment?.scene_sound).toEqual(expect.objectContaining({
      file_name: "segment-2-sound.wav",
      media_asset_id: 7712,
      mime_type: "audio/wav",
    }));
  });

  it("restores embedded scene sound metadata from the upstream segment payload", () => {
    const segment = buildWorkspaceSegmentEditorSegment(
      42,
      {
        current_video: "current-marker",
        duration: 5,
        index: 0,
        scene_sound: {
          download_url: "/api/media/444/download",
          file_name: "rain.wav",
          media_asset_id: 444,
          mime_type: "audio/wav",
        },
        text: "Segment",
      },
      {
        currentEntries: [],
        originalEntries: [],
        projectMediaByAssetId: new Map(),
        projectMediaLoaded: true,
      },
    );

    expect(segment?.sceneSoundAssetId).toBe(444);
    expect(segment?.scene_sound?.file_name).toBe("rain.wav");
  });

  it("restores scene sound metadata from final project generation settings", () => {
    const session = buildWorkspaceSegmentEditorSessionFromPayload(
      3678,
      {
        project_id: 3678,
        segments: [
          {
            current_video: "current-marker",
            duration: 5,
            end_time: 5,
            index: 0,
            start_time: 0,
            text: "First scene.",
          },
        ],
      },
      {
        projectDetailsPayload: {
          generation_settings: {
            segment_scene_sounds: [
              {
                download_url: "/api/media/4651/download",
                library_kind: "scene_sound",
                media_asset_id: 4651,
                media_type: "audio",
                mime_type: "video/mp4",
                segment_index: 0,
                source_kind: "ai_scene_sound",
              },
            ],
          },
          project_id: 3678,
          source_project_id: 3677,
        },
        projectMediaEnvelope: {
          assets: [],
          loaded: true,
          projectId: 3678,
        },
      },
    );

    expect(session.segments[0]?.sceneSoundAssetId).toBe(4651);
    expect(session.segments[0]?.scene_sound).toEqual(expect.objectContaining({
      download_url: "/api/media/4651/download",
      media_asset_id: 4651,
      mime_type: "video/mp4",
    }));
  });

  it("restores scene voiceover asset and speech metadata into the editor segment", () => {
    const segment = buildWorkspaceSegmentEditorSegment(
      42,
      {
        current_video: "current-marker",
        duration: 5,
        index: 0,
        speech_duration: 2.8,
        speech_end_time: 2.8,
        speech_start_time: 0,
        speech_words: [
          { end_time: 0.8, start_time: 0, text: "Subscribe" },
          { end_time: 1.4, start_time: 0.8, text: "now" },
        ],
        text: "Subscribe now",
        voiceover_language: "en",
        voiceover_text_hash: "subscribe now",
        voiceover_voice_type: "Liam",
      },
      {
        currentEntries: [],
        originalEntries: [],
        projectMediaAssets: [
          createMediaAsset({
            assetId: 555,
            kind: "segment_voiceover",
            role: "segment_voiceover",
            storageKey: "projects/42/segment-voiceover-555.wav",
          }),
        ],
        projectMediaByAssetId: new Map(),
        projectMediaLoaded: true,
      },
    );

    expect(segment?.voiceoverAssetId).toBe(555);
    expect(segment?.voiceover_asset_id).toBe(555);
    expect(segment?.voiceover?.media_asset_id).toBe(555);
    expect(segment?.voiceoverLanguage).toBe("en");
    expect(segment?.voiceoverTextHash).toBe("subscribe now");
    expect(segment?.voiceoverVoiceType).toBe("Liam");
    expect(segment?.speechDuration).toBe(2.8);
    expect(segment?.speechWords).toEqual([
      { confidence: 0, endTime: 0.8, startTime: 0, text: "Subscribe" },
      { confidence: 0, endTime: 1.4, startTime: 0.8, text: "now" },
    ]);
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

  it("restores manual duration from upstream timeline metadata", () => {
    const segment = buildWorkspaceSegmentEditorSegment(42, {
      duration: 10,
      duration_mode: "manual",
      end_time: 10,
      index: 0,
      manual_duration_seconds: 10,
      media_type: "video",
      start_time: 0,
      text: "Locked timing",
    });

    expect(segment).toEqual(
      expect.objectContaining({
        duration: 10,
        durationMode: "manual",
        endTime: 10,
        manualDurationSeconds: 10,
        startTime: 0,
      }),
    );
  });

  it("derives manual duration when upstream marks a segment manual without the explicit field", () => {
    const segment = buildWorkspaceSegmentEditorSegment(42, {
      duration: 10,
      duration_mode: "manual",
      end_time: 10,
      index: 0,
      media_type: "video",
      start_time: 0,
      text: "Legacy locked timing",
    });

    expect(segment?.durationMode).toBe("manual");
    expect(segment?.manualDurationSeconds).toBe(10);
  });

  it("restores duration sync mode from upstream timeline metadata", () => {
    const segment = buildWorkspaceSegmentEditorSegment(42, {
      duration: 5,
      duration_sync_mode: "voiceover",
      duration_sync_mode_user_selected: true,
      end_time: 5,
      index: 0,
      media_type: "video",
      start_time: 0,
      text: "Voice timed scene",
    });

    expect(segment?.durationSyncMode).toBe("voiceover");
    expect(segment?.durationSyncModeUserSelected).toBe(true);
    expect(segment?.duration_sync_mode).toBe("voiceover");
    expect(segment?.duration_sync_mode_user_selected).toBe(true);
  });

  it("restores duration sync mode from final project generation settings", () => {
    const session = buildWorkspaceSegmentEditorSessionFromPayload(
      42,
      {
        project_id: 42,
        segments: [
          {
            duration: 5,
            end_time: 5,
            index: 0,
            start_time: 0,
            text: "Voice timed scene",
          },
        ],
      },
      {
        projectDetailsPayload: {
          generation_settings: {
            original_video_segments: [
              {
                duration: 5,
                duration_sync_mode: "voiceover",
                duration_sync_mode_user_selected: true,
                end_time: 5,
                segment_index: 0,
                start_time: 0,
                text: "Voice timed scene",
              },
            ],
          },
          project_id: 42,
        },
      },
    );

    expect(session.segments[0]?.durationSyncMode).toBe("voiceover");
    expect(session.segments[0]?.durationSyncModeUserSelected).toBe(true);
    expect(session.segments[0]?.duration_sync_mode).toBe("voiceover");
    expect(session.segments[0]?.duration_sync_mode_user_selected).toBe(true);
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

  it("preserves rendered photo animation metadata on segment media assets", () => {
    const session = buildWorkspaceSegmentEditorSessionFromPayload(
      3957,
      {
        project_id: 3957,
        segments: [
          {
            current_video: "current-marker",
            duration: 6.52,
            index: 0,
            media_type: "video",
            original_video: "original-marker",
            text: "Segment",
          },
        ],
        title: "Rendered photo project",
      },
      {
        projectDetailsPayload: {
          generation_settings: {
            current_rendered_segments: [
              {
                download_url: "/api/media/6670/download",
                duration: 6.52,
                library_kind: "photo_animation",
                media_asset_id: 6670,
                media_type: "video",
                rendered_animation_mode: "ffmpeg",
                rendered_via_i2v: false,
                source: "rendered_segment",
              },
            ],
            source_video_urls: [
              {
                download_url: "/api/media/6610/download",
                media_asset_id: 6610,
                media_type: "photo",
                source: "ai_generated",
              },
            ],
          },
        },
      },
    );

    expect(session.segments[0]?.currentAsset?.libraryKind).toBe("photo_animation");
    expect(session.segments[0]?.currentAsset?.renderedAnimationMode).toBe("ffmpeg");
    expect(session.segments[0]?.currentAsset?.renderedViaI2v).toBe(false);
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

  it("opens a fast segment editor session without waiting for slow durable media enrichment", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/media")) {
        return new Promise<Response>(() => undefined);
      }

      if (url.includes("/segment-editor")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              project_id: 4455,
              segments: [
                {
                  current_video: "current-marker",
                  duration: 4,
                  index: 0,
                  text: "Fast scene.",
                },
              ],
              title: "Fast project",
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 200,
            },
          ),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            ai_title: "Fast project",
            generation_settings: {
              current_rendered_segments: [
                {
                  download_url: "/api/media/7788/download",
                  media_asset_id: 7788,
                  media_type: "video",
                  segment_index: 0,
                },
              ],
            },
            project_id: 4455,
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const sessionPromise = getWorkspaceSegmentEditorSessionForAccessibleProject(
      { id: "user-slow-durable-media" },
      4455,
      { bypassCache: true },
    );
    await vi.advanceTimersByTimeAsync(3_000);

    const session = await sessionPromise;
    expect(session.projectId).toBe(4455);
    expect(session.title).toBe("Fast project");
    expect(session.segments).toHaveLength(1);
    expect(session.segments[0]?.currentAsset?.assetId).toBe(7788);
  });

  it("does not probe segment voiceover durations without a project TTS asset", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/segments/") && url.includes("/voiceover")) {
        return new Response(null, { status: 500 });
      }

      if (url.includes("/segment-editor")) {
        return new Response(
          JSON.stringify({
            project_id: 3647,
            segments: [
              {
                duration: 10,
                end_time: 10,
                index: 0,
                start_time: 0,
                text: "First scene.",
              },
              {
                duration: 3.4,
                end_time: 13.4,
                index: 1,
                start_time: 10,
                text: "Second scene.",
              },
            ],
            title: "No project TTS",
            tts_asset_id: null,
            voice_type: "Bys_24000",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      if (url.includes("/media")) {
        return new Response(JSON.stringify({ assets: [], project_id: 3647 }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      return new Response(JSON.stringify({ generation_settings: {}, project_id: 3647 }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await getWorkspaceSegmentEditorSessionForAccessibleProject(
      { email: "alexmamondi@gmail.com", id: "8160048802147561000" },
      3647,
      { bypassCache: true },
    );

    expect(session.ttsAssetId).toBeNull();
    expect(session.segments).toHaveLength(2);
    const fetchedUrls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(fetchedUrls.some((url) => url.includes("/segments/0/voiceover"))).toBe(false);
    expect(fetchedUrls.some((url) => url.includes("/segments/1/voiceover"))).toBe(false);
  });

  it("does not use segment timeline bounds as project TTS ranges when exact voice timing is missing", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/segments/") && url.includes("/voiceover")) {
        return new Response(null, { status: 500 });
      }

      if (url.includes("/segment-editor")) {
        return new Response(
          JSON.stringify({
            project_id: 3727,
            segments: [
              {
                duration: 13.6,
                end_time: 13.6,
                index: 0,
                start_time: 0,
                text: "First scene with no authoritative speech timing.",
                voice_type: "Bys_24000",
              },
              {
                duration: 3.2,
                end_time: 16.8,
                index: 1,
                start_time: 13.6,
                text: "Second scene.",
                voice_type: "Bys_24000",
              },
            ],
            title: "Project TTS without segment timing",
            tts_asset_id: 4946,
            voice_type: "Bys_24000",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      if (url.includes("/media")) {
        return new Response(JSON.stringify({ assets: [], project_id: 3727 }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      return new Response(JSON.stringify({ generation_settings: {}, project_id: 3727 }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await getWorkspaceSegmentEditorSessionForAccessibleProject(
      { email: "alexmamondi@gmail.com", id: "8160048802147561000" },
      3727,
      { bypassCache: true },
    );

    expect(session.ttsAssetId).toBe(4946);
    expect(session.segments[0]).toEqual(expect.objectContaining({
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceType: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    }));
    expect(session.segments[1]).toEqual(expect.objectContaining({
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceType: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    }));
    const fetchedUrls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(fetchedUrls.some((url) => url.includes("/segments/0/voiceover"))).toBe(false);
    expect(fetchedUrls.some((url) => url.includes("/segments/1/voiceover"))).toBe(false);
  });

  it("uses current project voice metadata when project TTS replaces stale scene voice metadata", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/projects/3661/segment-editor")) {
        return new Response(
          JSON.stringify({
            language: "ru",
            project_id: 3661,
            segments: [
              {
                duration: 10,
                end_time: 10,
                index: 0,
                speech_duration: 3.4,
                speech_end_time: 3.4,
                speech_start_time: 0,
                start_time: 0,
                text: "First scene.",
                voiceover_language: "ru",
                voiceover_text_hash: "old-scene-hash",
                voiceover_voice_type: "Boris",
              },
            ],
            title: "Project voice changed",
            tts_asset_id: 9001,
            voice_type: "Gleb",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      if (url.includes("/media")) {
        return new Response(JSON.stringify({ assets: [], project_id: 3661 }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      return new Response(
        JSON.stringify({
          generation_settings: {
            tts_asset_id: 9001,
            voice_type: "Gleb",
          },
          language: "ru",
          project_id: 3661,
          voice_type: "Gleb",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await getWorkspaceSegmentEditorSessionForAccessibleProject(
      { email: "alexmamondi@gmail.com", id: "8160048802147561000" },
      3661,
      { bypassCache: true },
    );

    expect(session.ttsAssetId).toBe(9001);
    expect(session.voiceType).toBe("Gleb");
    expect(session.segments[0]).toEqual(expect.objectContaining({
      speechDuration: 3.4,
      speechEndTime: 3.4,
      speechStartTime: 0,
      voiceoverLanguage: "ru",
      voiceoverTextHash: "first scene.",
      voiceoverVoiceType: "Gleb",
    }));
  });

  it("does not measure the project TTS asset as a per-scene voiceover duration", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/media/4980/download")) {
        return new Response(createPcmWavBuffer(11.859), {
          headers: { "Content-Type": "audio/x-wav" },
          status: 200,
        });
      }

      if (url.includes("/api/projects/3732/media")) {
        return new Response(
          JSON.stringify({
            assets: [
              {
                download_path: "/api/media/4980/download",
                id: 4980,
                kind: "tts",
                media_type: "audio",
                mime_type: "audio/x-wav",
                project_id: 3732,
                role: "tts",
                segment_index: 0,
                status: "ready",
                storage_key: "users/1/assets/4980/tts/4980-voice.wav",
              },
            ],
            project_id: 3732,
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      if (url.includes("/api/projects/3732/segment-editor")) {
        return new Response(
          JSON.stringify({
            language: "ru",
            project_id: 3732,
            segments: [
              {
                duration: 12.957,
                duration_mode: "manual",
                end_time: 12.957,
                index: 0,
                manual_duration_seconds: 12.957,
                speech_duration: 10.739,
                start_time: 0,
                text: "сегодня покажу вам рецепт очень вкусных блинов",
                voiceover_text_hash: "сегодня покажу вам рецепт очень вкусных блинов",
                voiceover_voice_type: "Russian_BrightHeroine",
              },
              {
                duration: 2.508,
                end_time: 15.465,
                index: 1,
                speech_duration: 2.508,
                start_time: 12.957,
                text: "Взбейте яйца с сахаром и солью.",
              },
            ],
            title: "Segment indexed TTS",
            tts_asset_id: 4980,
            voice_type: "Russian_BrightHeroine",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      return new Response(
        JSON.stringify({
          generation_settings: {
            tts_asset_id: 4980,
            voice_type: "Russian_BrightHeroine",
          },
          language: "ru",
          project_id: 3732,
          voice_type: "Russian_BrightHeroine",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await getWorkspaceSegmentEditorSessionForAccessibleProject(
      { email: "alexmamondi@gmail.com", id: "8160048802147561000" },
      3732,
      { bypassCache: true },
    );

    expect(session.ttsAssetId).toBe(4980);
    expect(session.segments[0]).toEqual(expect.objectContaining({
      speechDuration: 10.739,
      speechDurationSource: null,
      speechEndTime: null,
      speechStartTime: null,
      voiceSourceDuration: null,
      voiceoverAssetId: 4980,
    }));
    expect(session.segments[1]).toEqual(expect.objectContaining({
      speechDuration: 2.508,
      speechDurationSource: null,
      speechEndTime: null,
      speechStartTime: null,
      voiceSourceDuration: null,
      voiceoverAssetId: null,
    }));
    const fetchedUrls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(fetchedUrls.some((url) => url.includes("/api/media/4980/download"))).toBe(false);
  });

  it("treats a uniform segment voice as the project baseline voice", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/projects/3727/segment-editor")) {
        return new Response(
          JSON.stringify({
            language: "ru",
            project_id: 3727,
            segments: [
              {
                duration: 5,
                end_time: 5,
                index: 0,
                speech_duration: 3.1,
                speech_end_time: 3.1,
                speech_start_time: 0,
                start_time: 0,
                text: "Первый сегмент.",
                voice_type: "Russian_BrightHeroine",
              },
              {
                duration: 4,
                end_time: 9,
                index: 1,
                speech_duration: 2.2,
                speech_end_time: 5.3,
                speech_start_time: 3.1,
                start_time: 5,
                text: "Второй сегмент.",
                voice_type: "Russian_BrightHeroine",
              },
            ],
            title: "Uniform segment voice",
            tts_asset_id: 4946,
            voice_type: "Bys_24000",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      if (url.includes("/media")) {
        return new Response(JSON.stringify({ assets: [], project_id: 3727 }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      return new Response(
        JSON.stringify({
          generation_settings: {
            voice_type: "Bys_24000",
          },
          language: "ru",
          project_id: 3727,
          voice_type: "Bys_24000",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await getWorkspaceSegmentEditorSessionForAccessibleProject(
      { email: "alexmamondi@gmail.com", id: "8160048802147561000" },
      3727,
      { bypassCache: true },
    );

    expect(session.voiceType).toBe("Russian_BrightHeroine");
    expect(session.segments.map((segment) => segment.voiceType)).toEqual([null, null]);
    expect(session.segments.map((segment) => segment.voiceoverVoiceType)).toEqual([
      "Russian_BrightHeroine",
      "Russian_BrightHeroine",
    ]);
  });

  it("inherits source project audio and source voice ranges for edited project previews", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/projects/3647/segment-editor")) {
        return new Response(
          JSON.stringify({
            music_asset_id: null,
            music_name: "energetic_7.mp3",
            music_type: "energetic",
            project_id: 3647,
            segments: [
              {
                duration: 10,
                end_time: 10,
                index: 0,
                start_time: 0,
                text: "First scene.",
              },
              {
                duration: 3.3,
                end_time: 13.3,
                index: 1,
                start_time: 10,
                text: "Second scene.",
              },
            ],
            title: "Edited project",
            tts_asset_id: null,
            voice_type: "Bys_24000",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      if (url.includes("/api/projects/3646/segment-editor")) {
        return new Response(
          JSON.stringify({
            music_asset_id: 4468,
            music_name: "energetic_7.mp3",
            music_type: "energetic",
            project_id: 3646,
            segments: [
              {
                duration: 4,
                end_time: 4,
                index: 0,
                speech_duration: 4,
                speech_end_time: 4,
                speech_start_time: 0,
                start_time: 0,
                text: "First scene.",
              },
              {
                duration: 3.8,
                end_time: 7.8,
                index: 1,
                speech_duration: 3.8,
                speech_end_time: 7.8,
                speech_start_time: 4,
                speech_words: [
                  {
                    end_time: 4.4,
                    start_time: 4,
                    text: "Second",
                  },
                  {
                    end_time: 7.8,
                    start_time: 4.5,
                    text: "scene.",
                  },
                ],
                start_time: 4,
                text: "Second scene.",
              },
            ],
            tts_asset_id: 4467,
            voice_type: "Bys_24000",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      if (url.includes("/media")) {
        return new Response(JSON.stringify({ assets: [], project_id: 3647 }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      return new Response(
        JSON.stringify({
          generation_settings: {
            original_video_segments: [
              {
                _voice_source_end_time: 4,
                _voice_source_start_time: 0,
                duration: 10,
                end_time: 10,
                index: 0,
                start_time: 0,
                text: "First scene.",
              },
              {
                _voice_source_end_time: 7.8,
                _voice_source_start_time: 4,
                duration: 3.3,
                end_time: 13.3,
                index: 1,
                start_time: 10,
                text: "Second scene.",
              },
            ],
            source_project_id: 3646,
          },
          music_name: "energetic_7.mp3",
          music_type: "energetic",
          project_id: 3647,
          source_project_id: 3646,
          voice_type: "Bys_24000",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await getWorkspaceSegmentEditorSessionForAccessibleProject(
      { email: "alexmamondi@gmail.com", id: "8160048802147561000" },
      3647,
      { bypassCache: true },
    );

    expect(session.ttsAssetId).toBe(4467);
    expect(session.musicAssetId).toBe(4468);
    expect(session.musicName).toBe("energetic_7.mp3");
    expect(session.segments[0]).toEqual(expect.objectContaining({
      endTime: 10,
      speechEndTime: 4,
      speechStartTime: 0,
      startTime: 0,
      voiceSourceDuration: 4,
      voiceSourceEndTime: 4,
      voiceSourceStartTime: 0,
      voiceoverTextHash: "first scene.",
      voiceoverVoiceType: "Bys_24000",
    }));
    expect(session.segments[1]).toEqual(expect.objectContaining({
      endTime: 13.3,
      speechDuration: 3.8,
      speechEndTime: 7.8,
      speechStartTime: 4,
      startTime: 10,
      voiceSourceDuration: 3.8,
      voiceSourceEndTime: 7.8,
      voiceSourceStartTime: 4,
      voiceoverTextHash: "second scene.",
      voiceoverVoiceType: "Bys_24000",
    }));
    expect(session.segments[1]?.speechWords).toHaveLength(2);
    const fetchedUrls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(fetchedUrls.some((url) => url.includes("/api/projects/3646/segment-editor"))).toBe(true);
    expect(fetchedUrls.some((url) => url.includes("/segments/0/voiceover"))).toBe(false);
    expect(fetchedUrls.some((url) => url.includes("/segments/1/voiceover"))).toBe(false);
  });

  it("inherits source voice ranges when the edited project already exposes the reused TTS asset", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/projects/3653/segment-editor")) {
        return new Response(
          JSON.stringify({
            music_asset_id: 4468,
            music_name: "energetic_7.mp3",
            music_type: "energetic",
            project_id: 3653,
            segments: [
              {
                duration: 10,
                duration_mode: "manual",
                end_time: 10,
                index: 0,
                manual_duration_seconds: 10,
                speech_duration: 10,
                speech_end_time: 10,
                speech_start_time: 0,
                start_time: 0,
                text: "First scene.",
              },
              {
                duration: 3.3,
                end_time: 13.3,
                index: 1,
                speech_duration: 3.3,
                speech_end_time: 13.3,
                speech_start_time: 10,
                start_time: 10,
                text: "Second scene.",
              },
            ],
            title: "Edited project with exposed TTS",
            tts_asset_id: 4467,
            voice_type: "Bys_24000",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      if (url.includes("/api/projects/3646/segment-editor")) {
        return new Response(
          JSON.stringify({
            music_asset_id: 4468,
            music_name: "energetic_7.mp3",
            music_type: "energetic",
            project_id: 3646,
            segments: [
              {
                duration: 4,
                end_time: 4,
                index: 0,
                speech_duration: 4,
                speech_end_time: 4,
                speech_start_time: 0,
                start_time: 0,
                text: "First scene.",
              },
              {
                duration: 3.8,
                end_time: 7.8,
                index: 1,
                speech_duration: 3.8,
                speech_end_time: 7.8,
                speech_start_time: 4,
                speech_words: [
                  {
                    end_time: 4.4,
                    start_time: 4,
                    text: "Second",
                  },
                  {
                    end_time: 7.8,
                    start_time: 4.5,
                    text: "scene.",
                  },
                ],
                start_time: 4,
                text: "Second scene.",
              },
            ],
            tts_asset_id: 4467,
            voice_type: "Bys_24000",
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      if (url.includes("/media")) {
        return new Response(JSON.stringify({ assets: [], project_id: 3653 }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      return new Response(
        JSON.stringify({
          generation_settings: {
            source_project_id: 3646,
          },
          music_name: "energetic_7.mp3",
          music_type: "energetic",
          project_id: 3653,
          source_project_id: 3646,
          voice_type: "Bys_24000",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await getWorkspaceSegmentEditorSessionForAccessibleProject(
      { email: "alexmamondi@gmail.com", id: "8160048802147561000" },
      3653,
      { bypassCache: true },
    );

    expect(session.ttsAssetId).toBe(4467);
    expect(session.segments[0]).toEqual(expect.objectContaining({
      duration: 10,
      durationMode: "manual",
      endTime: 10,
      manualDurationSeconds: 10,
      speechDuration: 4,
      speechEndTime: 4,
      speechStartTime: 0,
      startTime: 0,
      voiceSourceDuration: 4,
      voiceSourceEndTime: 4,
      voiceSourceStartTime: 0,
    }));
    expect(session.segments[1]).toEqual(expect.objectContaining({
      endTime: 13.3,
      speechDuration: 3.8,
      speechEndTime: 7.8,
      speechStartTime: 4,
      startTime: 10,
      voiceSourceDuration: 3.8,
      voiceSourceEndTime: 7.8,
      voiceSourceStartTime: 4,
    }));
    expect(session.segments[1]?.speechWords).toHaveLength(2);
    const fetchedUrls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(fetchedUrls.some((url) => url.includes("/api/projects/3646/segment-editor"))).toBe(true);
    expect(fetchedUrls.some((url) => url.includes("/segments/0/voiceover"))).toBe(false);
    expect(fetchedUrls.some((url) => url.includes("/segments/1/voiceover"))).toBe(false);
  });

  it("restores generated music settings from project generation metadata", () => {
    const session = buildWorkspaceSegmentEditorSessionFromPayload(
      42,
      {
        project_id: 42,
        segments: [
          {
            current_video: "current-marker",
            duration: 5,
            index: 0,
            text: "Segment",
          },
        ],
      },
      {
        projectDetailsPayload: {
          generation_settings: {
            music_asset_id: 649,
            music_type: "upbeat",
          },
          music_name: "upbeat_10.mp3",
        },
        projectMediaEnvelope: {
          assets: [],
          loaded: true,
          projectId: 42,
        },
      },
    );

    expect(session.musicAssetId).toBe(649);
    expect(session.musicName).toBe("upbeat_10.mp3");
    expect(session.musicType).toBe("upbeat");
  });

  it("normalizes public project voice source aliases from segment payloads", () => {
    const session = buildWorkspaceSegmentEditorSessionFromPayload(
      42,
      {
        project_id: 42,
        segments: [
          {
            current_video: "current-marker",
            duration: 5,
            end_time: 18.6,
            index: 0,
            start_time: 13.6,
            text: "Segment",
            voice_source_end_time: 16.12,
            voice_source_start_time: 13.04,
          },
        ],
      },
      {
        projectMediaEnvelope: {
          assets: [],
          loaded: true,
          projectId: 42,
        },
      },
    );

    expect(session.segments[0]).toEqual(expect.objectContaining({
      voiceSourceDuration: 3.08,
      voiceSourceEndTime: 16.12,
      voiceSourceStartTime: 13.04,
    }));
  });

  it("repairs saved speech word boundaries before they reach the preview session", () => {
    const session = buildWorkspaceSegmentEditorSessionFromPayload(
      3940,
      {
        project_id: 3940,
        segments: [
          {
            duration: 6.72,
            end_time: 30.52,
            index: 4,
            speech_duration: 6.72,
            speech_end_time: 30.52,
            speech_start_time: 23.8,
            speech_words: [
              { end_time: 24.08, start_time: 23.8, text: "Но" },
              { end_time: 24.56, start_time: 24.12, text: "против" },
              { end_time: 25.04, start_time: 24.6, text: "скрытых" },
              { end_time: 25.64, start_time: 25.08, text: "гендзюцу" },
              { end_time: 25.86, start_time: 25.68, text: "и" },
              { end_time: 26.48, start_time: 25.9, text: "внезапных" },
              { end_time: 26.92, start_time: 26.52, text: "атак" },
              { end_time: 27.22, start_time: 26.96, text: "его" },
              { end_time: 27.82, start_time: 27.26, text: "гаджеты" },
              { end_time: 28.24, start_time: 27.86, text: "могли" },
              { end_time: 28.48, start_time: 28.28, text: "бы" },
              { end_time: 29.2, start_time: 28.52, text: "оказаться" },
              { end_time: 30.52, start_time: 29.24, text: "бесполезными" },
            ],
            start_time: 23.8,
            text: "Но против скрытых гендзюцу и внезапных атак его гаджеты могли бы оказаться бесполезными в финале.",
          },
          {
            duration: 7.793,
            end_time: 38.313,
            index: 5,
            speech_duration: 7.36,
            speech_end_time: 37.88,
            speech_start_time: 30.52,
            speech_words: [
              { end_time: 30.7, start_time: 30.52, text: "в" },
              { end_time: 30.96, start_time: 30.72, text: "финале." },
              { end_time: 31.14, start_time: 30.96, text: "В" },
              { end_time: 31.46, start_time: 31.18, text: "этой" },
              { end_time: 31.92, start_time: 31.5, text: "битве" },
              { end_time: 32.5, start_time: 31.96, text: "победила" },
              { end_time: 32.76, start_time: 32.54, text: "бы" },
              { end_time: 33.44, start_time: 32.8, text: "стратегия" },
              { end_time: 37.88, start_time: 33.48, text: "Учиха." },
            ],
            start_time: 30.52,
            text: "В этой битве победила бы стратегия Учиха.",
          },
        ],
        tts_asset_id: 394000,
        voice_type: "Boris",
      },
      {
        projectMediaEnvelope: {
          assets: [],
          loaded: true,
          projectId: 3940,
        },
      },
    );

    const sceneFive = session.segments[0];
    const sceneSix = session.segments[1];
    expect(sceneFive?.speechWords.slice(-2).map((word) => word.text)).toEqual(["в", "финале."]);
    expect(sceneFive).toEqual(expect.objectContaining({
      duration: 7.16,
      endTime: 30.96,
      speechDuration: 7.16,
      speechEndTime: 30.96,
      speechStartTime: 23.8,
      voiceSourceDuration: 7.16,
      voiceSourceEndTime: 30.96,
      voiceSourceStartTime: 23.8,
    }));
    expect(sceneSix?.speechWords[0]?.text).toBe("В");
    expect(sceneSix).toEqual(expect.objectContaining({
      duration: 7.353,
      speechDuration: 6.92,
      speechEndTime: 37.88,
      speechStartTime: 30.96,
      startTime: 30.96,
      voiceSourceDuration: 6.92,
      voiceSourceEndTime: 37.88,
      voiceSourceStartTime: 30.96,
    }));
  });

  it("uses project details timeline over a stale voiceover-trimmed segment editor payload", () => {
    const session = buildWorkspaceSegmentEditorSessionFromPayload(
      3813,
      {
        project_id: 3813,
        segments: [
          {
            duration: 4.7,
            duration_mode: "auto",
            end_time: 26.939,
            index: 3,
            media_type: "video",
            speech_duration: 4.7,
            start_time: 22.239,
            text: "Добавьте растительное масло.",
          },
        ],
      },
      {
        projectDetailsPayload: {
          generation_settings: {
            original_video_segments: [
              {
                duration: 5.042,
                duration_mode: "manual",
                end_time: 27.281,
                index: 3,
                manual_duration_seconds: 5.042,
                media_type: "video",
                speech_duration: 4.7,
                start_time: 22.239,
                text: "Добавьте растительное масло.",
              },
            ],
          },
          id: 3813,
        },
        projectMediaEnvelope: {
          assets: [],
          loaded: true,
          projectId: 3813,
        },
      },
    );

    expect(session.segments[0]).toEqual(expect.objectContaining({
      duration: 5.042,
      durationMode: "manual",
      endTime: 27.281,
      manualDurationSeconds: 5.042,
      speechDuration: 4.7,
      startTime: 22.239,
    }));
  });

  it("keeps segment editor manual timing over stale project details timing", () => {
    const session = buildWorkspaceSegmentEditorSessionFromPayload(
      3821,
      {
        project_id: 3821,
        segments: [
          {
            duration: 5,
            duration_mode: "manual",
            end_time: 42.323,
            index: 6,
            manual_duration_seconds: 5,
            media_type: "video",
            speech_duration: 4,
            start_time: 37.323,
            text: "Жарьте на хорошо разогретой сковороде.",
          },
        ],
      },
      {
        projectDetailsPayload: {
          generation_settings: {
            original_video_segments: [
              {
                duration: 5.5,
                duration_mode: "manual",
                end_time: 42.865,
                index: 6,
                manual_duration_seconds: 5.5,
                media_type: "video",
                speech_duration: 4,
                start_time: 37.323,
                text: "Жарьте на хорошо разогретой сковороде.",
              },
            ],
          },
          id: 3821,
        },
        projectMediaEnvelope: {
          assets: [],
          loaded: true,
          projectId: 3821,
        },
      },
    );

    expect(session.segments[0]).toEqual(expect.objectContaining({
      duration: 5,
      durationMode: "manual",
      endTime: 42.323,
      manualDurationSeconds: 5,
      speechDuration: 4,
      startTime: 37.323,
    }));
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
