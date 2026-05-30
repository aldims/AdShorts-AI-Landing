import { describe, expect, it } from "vitest";

import {
  estimateWorkspaceSegmentEditorSpeechDuration,
  getWorkspaceSegmentEditorPlaybackDuration,
  getWorkspaceSegmentTimelineSpeechRange,
  rebuildWorkspaceSegmentEditorTimeline,
  resolveWorkspaceSegmentTimelineSpeechBoundaryTime,
  resolveWorkspaceSegmentDuration,
  type WorkspaceSegmentTimelineSegment,
} from "./workspaceSegmentEditorTimeline";

const createSegment = (overrides: Partial<WorkspaceSegmentTimelineSegment> = {}): WorkspaceSegmentTimelineSegment => ({
  duration: 2,
  endTime: 2,
  speechDuration: null,
  speechEndTime: null,
  speechStartTime: null,
  speechWords: [],
  startTime: 0,
  text: "",
  ...overrides,
});

describe("workspace segment editor timeline", () => {
  it("rebuilds segment start and end times in the current array order", () => {
    const insertedSegment = createSegment({
      duration: 2.4,
      endTime: 16.4,
      startTime: 14,
      text: "любимые котики",
    });
    const originalFirstSegment = createSegment({
      duration: 3,
      endTime: 3,
      startTime: 0,
      text: "первый сегмент",
    });

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([insertedSegment, originalFirstSegment]);

    expect(rebuilt[0]?.startTime).toBe(0);
    expect(rebuilt[0]?.endTime).toBeCloseTo(2.4, 6);
    expect(rebuilt[1]?.startTime).toBeCloseTo(2.4, 6);
    expect(rebuilt[1]?.endTime).toBeCloseTo(5.4, 6);
  });

  it("prefers text-estimated duration for synthetic still segments", () => {
    const syntheticStillSegment = createSegment({
      duration: 6,
      endTime: 18,
      startTime: 12,
      text: "любимые котики",
    });

    const preservedDuration = getWorkspaceSegmentEditorPlaybackDuration(syntheticStillSegment);
    const estimatedDuration = getWorkspaceSegmentEditorPlaybackDuration(syntheticStillSegment, undefined, {
      preferEstimatedDuration: true,
    });
    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([syntheticStillSegment], {
      preferEstimatedDuration: () => true,
    });

    expect(preservedDuration).toBe(6);
    expect(estimatedDuration).toBeCloseTo(1.8, 6);
    expect(rebuilt[0]?.duration).toBeCloseTo(1.8, 6);
    expect(rebuilt[0]?.startTime).toBe(0);
    expect(rebuilt[0]?.endTime).toBeCloseTo(1.8, 6);
  });

  it("never shortens estimated text timing below the speech-informed floor", () => {
    const speechSegment = createSegment({
      duration: 8,
      endTime: 8,
      speechDuration: 3.2,
      speechEndTime: 3.2,
      speechStartTime: 0,
      startTime: 0,
      text: "очень длинный текст который не должен удлинять сегмент сверх речи",
    });

    expect(
      getWorkspaceSegmentEditorPlaybackDuration(speechSegment, undefined, {
        preferEstimatedDuration: true,
      }),
    ).toBeCloseTo(3.4, 6);
  });

  it("estimates speech duration from current segment text", () => {
    expect(estimateWorkspaceSegmentEditorSpeechDuration("одно два три четыре пять шесть семь восемь девять десять")).toBeCloseTo(
      3.4,
      6,
    );
  });

  it("adds pause time for punctuation when estimating speech duration", () => {
    expect(
      estimateWorkspaceSegmentEditorSpeechDuration(
        "Вы когда-нибудь задумывались, что было бы, если бы динозавры не вымерли?",
      ),
    ).toBeGreaterThan(5);
  });

  it("keeps manual segment duration and rebuilds following start/end times", () => {
    const firstSegment = createSegment({
      duration: 2,
      durationMode: "manual",
      endTime: 2,
      manualDurationSeconds: 6,
      startTime: 0,
      text: "manual visual",
    });
    const secondSegment = createSegment({
      duration: 3,
      endTime: 5,
      startTime: 2,
      text: "after manual",
    });

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([firstSegment, secondSegment], {
      voiceEnabled: false,
    });

    expect(rebuilt[0]?.duration).toBe(6);
    expect(rebuilt[0]?.startTime).toBe(0);
    expect(rebuilt[0]?.endTime).toBe(6);
    expect(rebuilt[1]?.startTime).toBe(6);
    expect(rebuilt[1]?.endTime).toBe(9);
  });

  it("rounds rebuilt timeline boundaries to milliseconds and keeps adjacent segments aligned", () => {
    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([
      createSegment({
        duration: 6.455328798185941,
        durationMode: "manual",
        manualDurationSeconds: 6.455328798185941,
      }),
      createSegment({
        duration: 6.0396712018140555,
        durationMode: "manual",
        manualDurationSeconds: 6.0396712018140555,
      }),
    ]);

    expect(rebuilt[0]).toEqual(expect.objectContaining({
      duration: 6.455,
      endTime: 6.455,
      startTime: 0,
    }));
    expect(rebuilt[1]).toEqual(expect.objectContaining({
      duration: 6.04,
      endTime: 12.495,
      startTime: 6.455,
    }));
  });

  it("clamps manual duration to speech length while voice is enabled", () => {
    const segment = createSegment({
      durationMode: "manual",
      manualDurationSeconds: 2,
      speechDuration: 4.25,
      text: "voice is longer",
    });

    expect(resolveWorkspaceSegmentDuration(segment, { voiceEnabled: true })).toBeCloseTo(4.25, 6);
  });

  it("allows manual duration longer than speech without extending speech timing", () => {
    const segment = createSegment({
      durationMode: "manual",
      manualDurationSeconds: 7,
      speechDuration: 3.2,
      text: "voice plays once",
    });

    expect(resolveWorkspaceSegmentDuration(segment, { voiceEnabled: true })).toBe(7);
    expect(getWorkspaceSegmentEditorPlaybackDuration(segment)).toBeCloseTo(3.2, 6);
  });

  it("uses known video duration when voice is disabled", () => {
    const segment = createSegment({
      duration: 8,
      mediaType: "video",
      text: "text should not define a silent video",
    });

    expect(
      resolveWorkspaceSegmentDuration(segment, {
        voiceEnabled: false,
        visualDurationSeconds: 5.5,
        visualKind: "video",
      }),
    ).toBeCloseTo(5.5, 6);
  });

  it("uses voice duration for automatic timing when video is longer", () => {
    const segment = createSegment({
      mediaType: "video",
      speechDuration: 3.75,
      text: "voice is shorter than this video segment",
    });

    expect(
      resolveWorkspaceSegmentDuration(segment, {
        visualDurationSeconds: 10,
        visualKind: "video",
        voiceEnabled: true,
      }),
    ).toBeCloseTo(3.75, 6);
  });

  it("extends video duration when voice is longer than the known video", () => {
    const segment = createSegment({
      mediaType: "video",
      speechDuration: 12,
      text: "voice is longer than this video segment",
    });

    expect(
      resolveWorkspaceSegmentDuration(segment, {
        visualDurationSeconds: 10,
        visualKind: "video",
        voiceEnabled: true,
      }),
    ).toBeCloseTo(12, 6);
  });

  it("uses explicit voice duration for automatic scene timing", () => {
    const firstSegment = createSegment({
      duration: 8,
      endTime: 8,
      mediaType: "photo",
      text: "voice estimate controls this still",
    });
    const secondSegment = createSegment({
      duration: 3,
      endTime: 11,
      mediaType: "photo",
      startTime: 8,
      text: "next scene",
    });

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([firstSegment, secondSegment], {
      voiceDurationSeconds: (segment) => (segment === firstSegment ? 4.2 : null),
      voiceEnabled: true,
    });

    expect(rebuilt[0]).toEqual(expect.objectContaining({
      duration: 4.2,
      endTime: 4.2,
      startTime: 0,
    }));
    expect(rebuilt[1]).toEqual(expect.objectContaining({
      startTime: 4.2,
    }));
  });

  it("uses the longer playable voice duration when speech metadata is shorter", () => {
    const segment = createSegment({
      duration: 4,
      endTime: 4,
      speechDuration: 4,
      speechEndTime: 4,
      speechStartTime: 0,
      text: "speech metadata is slightly shorter than the audio file",
    });

    expect(
      resolveWorkspaceSegmentDuration(segment, {
        voiceDurationSeconds: 4.45,
        voiceEnabled: true,
      }),
    ).toBeCloseTo(4.45, 6);

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([segment], {
      voiceDurationSeconds: () => 4.45,
      voiceEnabled: true,
    });

    expect(rebuilt[0]).toEqual(expect.objectContaining({
      duration: 4.45,
      endTime: 4.45,
      startTime: 0,
    }));
  });

  it("uses the latest known speech end when word timings stop before the audio tail", () => {
    const segment = createSegment({
      duration: 4.4,
      endTime: 4.4,
      speechDuration: 4.02,
      speechEndTime: 4.02,
      speechStartTime: 0,
      speechWords: [
        { startTime: 0, endTime: 0.3 },
        { startTime: 3.6, endTime: 3.9 },
      ],
      text: "last word has a tail",
    });

    expect(getWorkspaceSegmentTimelineSpeechRange(segment)).toEqual({
      endTime: 4.02,
      startTime: 0,
    });
    expect(getWorkspaceSegmentEditorPlaybackDuration(segment)).toBeCloseTo(4.4, 6);
    expect(
      resolveWorkspaceSegmentDuration(segment, {
        voiceEnabled: true,
      }),
    ).toBeCloseTo(4.02, 6);
  });

  it("places automatic project voiceover scene boundaries in the middle of speech gaps", () => {
    const firstSegment = createSegment({
      duration: 4.42,
      endTime: 4.42,
      speechDuration: 4.02,
      speechEndTime: 4.02,
      speechStartTime: 0,
      text: "first scene",
    });
    const secondSegment = createSegment({
      duration: 5.9,
      endTime: 10.32,
      speechDuration: 5.44,
      speechEndTime: 9.86,
      speechStartTime: 4.42,
      startTime: 4.42,
      text: "second scene",
    });

    expect(resolveWorkspaceSegmentTimelineSpeechBoundaryTime(firstSegment, secondSegment)).toBeCloseTo(4.22, 6);

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([firstSegment, secondSegment], {
      preserveSourceTimelineEnd: true,
      speechBoundaryEnabled: true,
      voiceEnabled: true,
    });

    expect(rebuilt[0]).toEqual(expect.objectContaining({
      duration: 4.22,
      endTime: 4.22,
      startTime: 0,
    }));
    expect(rebuilt[1]).toEqual(expect.objectContaining({
      duration: 6.1,
      endTime: 10.32,
      startTime: 4.22,
    }));
  });

  it("does not override a manual duration with automatic project voiceover boundaries", () => {
    const firstSegment = createSegment({
      duration: 4.9,
      durationMode: "manual",
      endTime: 4.9,
      manualDurationSeconds: 12,
      speechDuration: 4.6,
      speechEndTime: 4.6,
      speechStartTime: 0,
      text: "first scene",
    });
    const secondSegment = createSegment({
      duration: 4.4,
      endTime: 9.3,
      speechDuration: 4.1,
      speechEndTime: 9,
      speechStartTime: 4.9,
      startTime: 4.9,
      text: "second scene",
    });

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([firstSegment, secondSegment], {
      preserveSourceTimelineEnd: true,
      speechBoundaryEnabled: true,
      voiceEnabled: true,
    });

    expect(rebuilt[0]).toEqual(expect.objectContaining({
      duration: 12,
      endTime: 12,
      startTime: 0,
    }));
    expect(rebuilt[1]).toEqual(expect.objectContaining({
      duration: 4.1,
      endTime: 16.1,
      startTime: 12,
    }));
  });

  it("ignores text for silent stills when subtitles are disabled", () => {
    const segment = createSegment({
      duration: null,
      mediaType: "photo",
      text: "very long scene text that should not keep stretching a silent still",
    });

    expect(
      resolveWorkspaceSegmentDuration(segment, {
        stillNoTextFallbackDuration: 2.4,
        subtitleEnabled: false,
        visualKind: "image",
        voiceEnabled: false,
      }),
    ).toBeCloseTo(2.4, 6);
  });

  it("preserves current still duration in auto mode when silent subtitles are disabled", () => {
    const segment = createSegment({
      duration: 4.6,
      endTime: 4.6,
      mediaType: "photo",
      text: "a longer text no longer recalculates this scene",
    });

    expect(
      resolveWorkspaceSegmentDuration(segment, {
        fallbackDuration: segment.duration,
        stillNoTextFallbackDuration: 2.4,
        subtitleEnabled: false,
        visualKind: "image",
        voiceEnabled: false,
      }),
    ).toBeCloseTo(4.6, 6);
  });

  it("supports per-segment subtitle duration decisions while rebuilding the timeline", () => {
    const localSubtitleSegment = createSegment({
      duration: undefined,
      endTime: undefined,
      mediaType: "photo",
      text: "local subtitles should keep this still scene paced by readable text",
    });
    const silentStillSegment = createSegment({
      duration: undefined,
      endTime: undefined,
      mediaType: "photo",
      text: "this text should not stretch the still scene",
    });

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([localSubtitleSegment, silentStillSegment], {
      stillNoTextFallbackDuration: 1.2,
      subtitleEnabled: (segment) => segment === localSubtitleSegment,
      visualKind: () => "image",
      voiceEnabled: true,
    });

    expect(rebuilt[0]?.duration).toBeGreaterThan(1.8);
    expect(rebuilt[1]?.duration).toBeCloseTo(1.2, 6);
  });
});
