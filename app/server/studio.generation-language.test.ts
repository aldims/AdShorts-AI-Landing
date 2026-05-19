import { describe, expect, it } from "vitest";

import {
  buildStudioSegmentVisualDurationPayload,
  canExposeStudioFinalVideoFromStatus,
  getStudioVoiceCreditCost,
  normalizeStudioSegmentEditorPayload,
  normalizeStudioVoiceIdForLanguage,
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

  it("locks segment editor timeline durations for generation", () => {
    const normalized = normalizeStudioSegmentEditorPayload(
      {
        projectId: 42,
        segments: [
          {
            duration: 3,
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

  it("forwards visual generation target duration with the upstream field name", () => {
    expect(buildStudioSegmentVisualDurationPayload(13)).toEqual({ duration: 13 });
    expect(buildStudioSegmentVisualDurationPayload(0.5)).toEqual({});
  });
});
