import { describe, expect, it } from "vitest";

import {
  buildStudioSegmentVisualDurationExtensionPayload,
  buildStudioSegmentVisualDurationPayload,
  canExposeStudioFinalVideoFromStatus,
  getStudioVoiceCreditCost,
  normalizeStudioSegmentEditorPayload,
  normalizeStudioVoiceIdForLanguage,
  resolveStudioSegmentEditorGenerationMediaFlags,
  resolveStudioSegmentEditorAdsflowVoiceType,
  resolveAdsflowFinalVideoDownloadPath,
  resolveStudioGenerationLanguage,
} from "./studio.js";

describe("studio generation language resolution", () => {
  it("keeps the requested English language even for Cyrillic prompts", () => {
    expect(
      resolveStudioGenerationLanguage(
        "Механизм сверхбыстрой реакции кошачьей нервной системы",
        "en",
      ),
    ).toBe("en");
  });

  it("keeps an explicit English request written in Russian", () => {
    expect(
      resolveStudioGenerationLanguage("Сделай видео на английском про кошачьи рефлексы", "en"),
    ).toBe("en");
  });

  it("keeps Russian when the user selected Russian for a Latin prompt", () => {
    expect(resolveStudioGenerationLanguage("cat reflexes and reaction speed", "ru")).toBe("ru");
  });

  it("allows a finished final MP4 even when the edit snapshot rejects mixed language text", () => {
    expect(
      canExposeStudioFinalVideoFromStatus({
        downloadPath: "/api/media/3154/download",
        error: "Project components saved but edit snapshot is not ready: reason=language_text_mismatch",
        projectStatus: "rendering",
        readyReason: "project_not_ready",
        status: "failed",
      }),
    ).toBe(true);
  });

  it("does not expose failed generations without a final video file", () => {
    expect(
      canExposeStudioFinalVideoFromStatus({
        error: "Generation failed.",
        status: "failed",
      }),
    ).toBe(false);
  });

  it("resolves a playable final video path from a media asset id when AdsFlow omits download_path", () => {
    expect(resolveAdsflowFinalVideoDownloadPath({ media_asset_id: 4433 })).toBe("/api/media/4433/download");
  });

  it("resolves a playable final video path from nested AdsFlow asset payloads", () => {
    expect(
      resolveAdsflowFinalVideoDownloadPath({
        final_video_asset: {
          id: "4434",
        },
      }),
    ).toBe("/api/media/4434/download");
  });

  it("replaces a mismatched voice with the default voice for the requested language", () => {
    expect(normalizeStudioVoiceIdForLanguage("Bys_24000", "en")).toBe("Aiden");
    expect(normalizeStudioVoiceIdForLanguage("Aiden", "ru")).toBe("Bys_24000");
  });

  it("keeps the explicit ElevenLabs premium voice for Russian generation", () => {
    expect(normalizeStudioVoiceIdForLanguage("Liam", "ru")).toBe("Liam");
    expect(normalizeStudioVoiceIdForLanguage("liam", "ru")).toBe("Liam");
    expect(getStudioVoiceCreditCost("Liam")).toBe(5);
    expect(getStudioVoiceCreditCost("liam")).toBe(5);
  });

  it("keeps explicit MiniMax premium voices for Russian generation", () => {
    expect(normalizeStudioVoiceIdForLanguage("English_ManWithDeepVoice", "ru")).toBe("English_ManWithDeepVoice");
    expect(normalizeStudioVoiceIdForLanguage("Russian_BrightHeroine", "ru")).toBe("Russian_BrightHeroine");
    expect(normalizeStudioVoiceIdForLanguage("Russian_HandsomeChildhoodFriend", "ru")).toBe("Bys_24000");
    expect(normalizeStudioVoiceIdForLanguage("Russian_BrightHeroine", "en")).toBe("Aiden");
    expect(getStudioVoiceCreditCost("English_ManWithDeepVoice")).toBe(5);
    expect(getStudioVoiceCreditCost("Russian_BrightHeroine")).toBe(5);
    expect(getStudioVoiceCreditCost("Russian_HandsomeChildhoodFriend")).toBe(0);
  });

  it("forwards inherited segment editor voices explicitly to AdsFlow", () => {
    expect(
      resolveStudioSegmentEditorAdsflowVoiceType({
        globalVoiceEnabled: true,
        globalVoiceId: "English_ManWithDeepVoice",
        language: "ru",
        segmentVoiceType: null,
      }),
    ).toBe("English_ManWithDeepVoice");
    expect(
      resolveStudioSegmentEditorAdsflowVoiceType({
        globalVoiceEnabled: true,
        globalVoiceId: "English_ManWithDeepVoice",
        language: "ru",
        segmentVoiceType: "none",
      }),
    ).toBe("none");
    expect(
      resolveStudioSegmentEditorAdsflowVoiceType({
        globalVoiceEnabled: true,
        globalVoiceId: "English_ManWithDeepVoice",
        language: "ru",
        segmentVoiceType: "Aiden",
      }),
    ).toBe("Aiden");
    expect(
      resolveStudioSegmentEditorAdsflowVoiceType({
        globalVoiceEnabled: false,
        globalVoiceId: "English_ManWithDeepVoice",
        language: "ru",
        segmentVoiceType: null,
      }),
    ).toBe("none");
    expect(
      resolveStudioSegmentEditorAdsflowVoiceType({
        globalVoiceEnabled: true,
        globalVoiceId: null,
        language: "ru",
        segmentVoiceType: null,
      }),
    ).toBe("Bys_24000");
  });

  it("keeps generation media enabled when segment editor scenes carry voice overrides", () => {
    expect(
      resolveStudioSegmentEditorGenerationMediaFlags({
        requestedSubtitleEnabled: false,
        requestedVoiceEnabled: false,
        segmentEditor: {
          projectId: 42,
          source: "project",
          segments: [
            {
              duration: 3,
              index: 0,
              subtitleType: "default",
              text: "Scene voice",
              videoAction: "original",
              voiceType: "male-qn-jingying",
            },
          ],
        },
      }),
    ).toEqual({
      subtitleEnabled: true,
      voiceEnabled: true,
    });
  });

  it("locks segment editor timeline durations for generation", () => {
    const normalized = normalizeStudioSegmentEditorPayload(
      {
        projectId: 42,
        segments: [
          {
            duration: 3,
            durationExtensionSourceDurationSeconds: 3,
            durationMode: "manual",
            endTime: 13,
            index: 0,
            manualDurationSeconds: 13,
            startTime: 0,
            text: "Manual scene",
            videoAction: "original",
          },
          {
            duration: 3,
            endTime: 16,
            index: 1,
            startTime: 13,
            text: "Legacy scene",
            videoAction: "original",
          },
        ],
      },
      "ru",
    );

    expect(normalized?.segments[0]).toEqual(
      expect.objectContaining({
        duration: 13,
        durationExtensionSourceDurationSeconds: 3,
        endTime: 13,
        durationMode: "manual",
        manualDurationSeconds: 13,
      }),
    );
    expect(normalized?.segments[1]).toEqual(
      expect.objectContaining({
        duration: 3,
        durationMode: "manual",
        endTime: 16,
        manualDurationSeconds: 3,
      }),
    );
  });

  it("normalizes segment editor timing drift before forwarding generation payload", () => {
    const normalized = normalizeStudioSegmentEditorPayload(
      {
        projectId: 42,
        segments: [
          {
            duration: 6.455328798185941,
            durationMode: "manual",
            endTime: 27.455,
            index: 3,
            manualDurationSeconds: 6.455328798185941,
            startTime: 21,
            text: "Talking photo",
            videoAction: "custom",
            customVideoAssetId: 909,
            voiceType: "none",
          },
          {
            duration: 6.0396712018140555,
            durationMode: "manual",
            endTime: 33.495,
            index: 4,
            manualDurationSeconds: 6.0396712018140555,
            startTime: 27.455328798185942,
            text: "Next scene",
            videoAction: "original",
          },
        ],
      },
      "ru",
    );

    expect(normalized?.segments.map((segment) => ({
      duration: segment.duration,
      endTime: segment.endTime,
      manualDurationSeconds: segment.manualDurationSeconds,
      startTime: segment.startTime,
    }))).toEqual([
      { duration: 6.455, endTime: 6.455, manualDurationSeconds: 6.455, startTime: 0 },
      { duration: 6.04, endTime: 12.495, manualDurationSeconds: 6.04, startTime: 6.455 },
    ]);
  });

  it("accepts scratch scene-editor payloads without a project id", () => {
    const normalized = normalizeStudioSegmentEditorPayload(
      {
        allowStructureChange: true,
        source: "scratch",
        segments: [
          {
            duration: 5,
            endTime: 5,
            index: 0,
            startTime: 0,
            text: "Opening product shot",
            videoAction: "ai",
          },
        ],
      },
      "en",
    );

    expect(normalized).toEqual(
      expect.objectContaining({
        allowStructureChange: true,
        projectId: null,
        source: "scratch",
      }),
    );
    expect(normalized?.segments[0]).toEqual(
      expect.objectContaining({
        duration: 5,
        index: 0,
        text: "Opening product shot",
        videoAction: "ai",
      }),
    );
  });

  it("keeps per-scene subtitle overrides in normalized segment editor payload", () => {
    const normalized = normalizeStudioSegmentEditorPayload(
      {
        projectId: 42,
        segments: [
          {
            duration: 3,
            index: 0,
            subtitleType: "none",
            text: "Disabled subtitles, voice text remains",
            videoAction: "original",
          },
          {
            duration: 3,
            index: 1,
            subtitle_color: "cyan",
            subtitle_style: "impact",
            text: "Styled subtitles",
            videoAction: "original",
          },
        ],
      },
      "ru",
    );

    expect(normalized?.segments[0]).toEqual(
      expect.objectContaining({
        subtitleType: "none",
        text: "Disabled subtitles, voice text remains",
      }),
    );
    expect(normalized?.segments[1]).toEqual(
      expect.objectContaining({
        subtitleColor: "cyan",
        subtitleStyle: "impact",
        text: "Styled subtitles",
      }),
    );
  });

  it("keeps per-scene voice language overrides in normalized segment editor payload", () => {
    const normalized = normalizeStudioSegmentEditorPayload(
      {
        projectId: 42,
        segments: [
          {
            duration: 3,
            index: 0,
            text: "English voice inside a Russian project",
            videoAction: "original",
            voiceType: "Aiden",
          },
          {
            duration: 3,
            index: 1,
            text: "Muted scene",
            videoAction: "original",
            voiceType: "none",
          },
        ],
      },
      "ru",
    );

    expect(normalized?.segments[0]?.voiceType).toBe("Aiden");
    expect(normalized?.segments[1]?.voiceType).toBe("none");
  });

  it("disables segment subtitles when the segment has no voiceover", () => {
    const normalized = normalizeStudioSegmentEditorPayload(
      {
        projectId: 42,
        segments: [
          {
            duration: 3,
            index: 0,
            subtitleColor: "cyan",
            subtitleStyle: "impact",
            subtitleType: "default",
            text: "Muted scene",
            videoAction: "original",
            voiceType: "none",
          },
          {
            duration: 3,
            index: 1,
            subtitleColor: "cyan",
            subtitleStyle: "impact",
            subtitleType: "default",
            text: "Override voice scene",
            videoAction: "original",
            voiceType: "Aiden",
          },
        ],
      },
      "ru",
      undefined,
      { globalVoiceEnabled: false },
    );

    expect(normalized?.segments[0]).toEqual(
      expect.objectContaining({
        subtitleColor: null,
        subtitleStyle: null,
        subtitleType: "none",
        voiceType: "none",
      }),
    );
    expect(normalized?.segments[1]).toEqual(
      expect.objectContaining({
        subtitleColor: "cyan",
        subtitleStyle: "impact",
        subtitleType: "default",
        voiceType: "Aiden",
      }),
    );
  });

  it("forwards visual generation target duration with the upstream field name", () => {
    expect(buildStudioSegmentVisualDurationPayload(13)).toEqual({ duration: 13 });
    expect(buildStudioSegmentVisualDurationPayload(0.5)).toEqual({});
  });

  it("forwards AI duration extension stitch metadata upstream", () => {
    expect(
      buildStudioSegmentVisualDurationExtensionPayload({
        baseDurationSeconds: 5,
        mode: "stitch",
        tailDurationSeconds: 3,
        targetDurationSeconds: 8,
      }),
    ).toEqual({
      duration_extension_base_duration_seconds: 5,
      duration_extension_mode: "stitch",
      duration_extension_tail_duration_seconds: 3,
      duration_extension_target_duration_seconds: 8,
    });
  });
});
