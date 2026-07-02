import { describe, expect, it } from "vitest";

import {
  estimateWorkspaceSegmentEditorSpeechDuration,
  getWorkspaceSegmentEditorPlaybackDuration,
  getWorkspaceSegmentTimelineSpeechRange,
  isWorkspaceSegmentEditorLegacyPunctuationEstimatedDuration,
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

  it("moves speech metadata with its segment when a rebuild shifts the timeline", () => {
    const firstSegment = createSegment({
      duration: 4,
      endTime: 4,
      mediaType: "photo",
      text: "first scene",
    });
    const shiftedSegment = createSegment({
      duration: 3,
      endTime: 11,
      mediaType: "photo",
      speechDuration: 2,
      speechEndTime: 10.2,
      speechStartTime: 8.2,
      speechWords: [
        { startTime: 8.2, endTime: 8.5 },
        { startTime: 9.8, endTime: 10.2 },
      ],
      startTime: 8,
      text: "shifted scene",
    });

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([firstSegment, shiftedSegment], {
      preserveExistingStillDurations: true,
      visualKind: () => "image",
      voiceEnabled: true,
    });

    expect(rebuilt[1]).toEqual(expect.objectContaining({
      duration: 3,
      endTime: 7,
      speechEndTime: 6.2,
      speechStartTime: 4.2,
      startTime: 4,
    }));
    expect(rebuilt[1]?.speechWords).toEqual([
      { startTime: 4.2, endTime: 4.5 },
      { startTime: 5.8, endTime: 6.2 },
    ]);
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

  it("does not count standalone punctuation as spoken words", () => {
    expect(
      estimateWorkspaceSegmentEditorSpeechDuration(
        "Один прыжок — и монстр уже летит на землю, не успев понять, что случилось.",
      ),
    ).toBeCloseTo(5.87, 6);
    expect(
      isWorkspaceSegmentEditorLegacyPunctuationEstimatedDuration(
        "Один прыжок — и монстр уже летит на землю, не успев понять, что случилось.",
        6.21,
      ),
    ).toBe(true);
    expect(
      isWorkspaceSegmentEditorLegacyPunctuationEstimatedDuration(
        "Один прыжок — и монстр уже летит на землю, не успев понять, что случилось.",
        5.87,
      ),
    ).toBe(false);
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

  it("uses the caller-provided minimum as the initial still scene duration", () => {
    const segment = createSegment({
      duration: 6.9,
      durationMode: "auto",
      endTime: 6.9,
      mediaType: "photo",
      speechDuration: 6.9,
      speechEndTime: 6.9,
      speechStartTime: 0,
      startTime: 0,
      text: "voice needs a small hold after it finishes",
    });

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([segment], {
      minimumDurationSeconds: () => 7.1,
      visualKind: () => "image",
      voiceDurationSeconds: () => 6.9,
      voiceEnabled: true,
    });

    expect(rebuilt[0]).toEqual(expect.objectContaining({
      duration: 7.1,
      endTime: 7.1,
      startTime: 0,
    }));
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

  it("keeps another still scene duration when one scene is edited manually", () => {
    const editedSegment = createSegment({
      duration: 4.4,
      durationMode: "manual",
      endTime: 4.4,
      manualDurationSeconds: 5.4,
      mediaType: "photo",
      startTime: 0,
      text: "edited scene",
    });
    const trailingStillSegment = createSegment({
      duration: 9.7,
      endTime: 14.1,
      mediaType: "photo",
      speechDuration: 3.8,
      speechEndTime: 8.2,
      speechStartTime: 4.4,
      startTime: 4.4,
      text: "short voiceover in a longer still scene",
    });

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([editedSegment, trailingStillSegment], {
      preserveExistingStillDurations: true,
      preserveSourceTimelineEnd: true,
      speechBoundaryEnabled: true,
      visualKind: () => "image",
      voiceEnabled: true,
    });

    expect(rebuilt[0]).toEqual(expect.objectContaining({
      duration: 5.4,
      endTime: 5.4,
      startTime: 0,
    }));
    expect(rebuilt[1]).toEqual(expect.objectContaining({
      duration: 9.7,
      endTime: 15.1,
      startTime: 5.4,
    }));
  });

  it("keeps another manual still scene duration when its stored manual value is stale", () => {
    const editedSegment = createSegment({
      duration: 5.4,
      durationMode: "manual",
      endTime: 5.4,
      manualDurationSeconds: 5.4,
      mediaType: "photo",
      startTime: 0,
      text: "edited scene",
    });
    const trailingStillSegment = createSegment({
      duration: 9.7,
      durationMode: "manual",
      endTime: 14.1,
      manualDurationSeconds: 3.8,
      mediaType: "photo",
      speechDuration: 3.8,
      speechEndTime: 8.2,
      speechStartTime: 4.4,
      startTime: 4.4,
      text: "manual value is older than the displayed still duration",
    });

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([editedSegment, trailingStillSegment], {
      preserveExistingStillDurations: true,
      preserveSourceTimelineEnd: true,
      speechBoundaryEnabled: true,
      visualKind: () => "image",
      voiceEnabled: true,
    });

    expect(rebuilt[0]).toEqual(expect.objectContaining({
      duration: 5.4,
      endTime: 5.4,
      startTime: 0,
    }));
    expect(rebuilt[1]).toEqual(expect.objectContaining({
      duration: 9.7,
      endTime: 15.1,
      startTime: 5.4,
    }));
  });

  it("allows an edited still scene to shrink when its timeline already matches the new manual duration", () => {
    const segment = createSegment({
      duration: 5,
      durationMode: "manual",
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "photo",
      speechDuration: 3.8,
      speechEndTime: 3.8,
      speechStartTime: 0,
      startTime: 0,
      text: "shorter edited still",
    });

    expect(
      resolveWorkspaceSegmentDuration(segment, {
        preserveExistingStillDuration: true,
        visualKind: "image",
        voiceEnabled: true,
      }),
    ).toBe(5);
  });

  it("allows an explicitly edited still scene to shrink below its previous timeline duration", () => {
    const segment = createSegment({
      duration: 9,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 9,
      manualDurationSeconds: 8,
      mediaType: "photo",
      speechDuration: 4.1,
      speechEndTime: 4.1,
      speechStartTime: 0,
      startTime: 0,
      text: "shorter edited still",
    });

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([segment], {
      preserveExistingStillDurations: true,
      visualKind: () => "image",
      voiceEnabled: true,
    });

    expect(rebuilt[0]).toEqual(expect.objectContaining({
      duration: 8,
      endTime: 8,
      startTime: 0,
    }));
  });

  it("does not preserve the old source end when a manual edit shortens a timeline without later speech", () => {
    const firstSegment = createSegment({
      duration: 10,
      endTime: 10,
      mediaType: "photo",
      startTime: 0,
    });
    const middleVideo = createSegment({
      duration: 3.8,
      endTime: 13.8,
      mediaType: "video",
      startTime: 10,
    });
    const editedSegment = createSegment({
      duration: 5.6,
      durationMode: "manual",
      endTime: 23.6,
      manualDurationSeconds: 5.6,
      mediaType: "photo",
      startTime: 18,
      text: "shortened scene",
    });
    const followingStill = createSegment({
      duration: 4.8,
      endTime: 29.4,
      mediaType: "photo",
      startTime: 24.6,
    });
    const lastStill = createSegment({
      duration: 3.8,
      durationMode: "manual",
      endTime: 33.2,
      manualDurationSeconds: 3.8,
      mediaType: "photo",
      startTime: 29.4,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline(
      [
        firstSegment,
        middleVideo,
        createSegment({ duration: 4.2, endTime: 18, mediaType: "video", startTime: 13.8 }),
        editedSegment,
        followingStill,
        lastStill,
      ],
      {
        preserveExistingStillDurations: true,
        preserveSourceTimelineEnd: false,
        speechBoundaryEnabled: true,
        visualKind: (segment) => segment.mediaType === "video" ? "video" : "image",
        voiceEnabled: true,
      },
    );

    expect(rebuilt[3]).toEqual(expect.objectContaining({
      duration: 5.6,
      endTime: 23.6,
      startTime: 18,
    }));
    expect(rebuilt[5]).toEqual(expect.objectContaining({
      duration: 3.8,
      endTime: 32.2,
      startTime: 28.4,
    }));
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

  it("keeps known video duration for automatic timing when voice is shorter", () => {
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
    ).toBeCloseTo(10, 6);
  });

  it("trims known video duration only when voiceover sync mode is explicit", () => {
    const segment = createSegment({
      durationSyncMode: "voiceover",
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
      speechEndTime: 9.66,
      speechStartTime: 4.22,
      startTime: 4.22,
    }));
  });

  it("preserves contiguous source-window boundaries for project voiceover segments", () => {
    const firstSegment = createSegment({
      duration: 4.7,
      endTime: 4.7,
      speechDuration: 4.7,
      speechEndTime: 4.7,
      speechStartTime: 0,
      text: "first scene",
    });
    const secondSegment = createSegment({
      duration: 5.4,
      endTime: 10.1,
      speechDuration: 5.4,
      speechEndTime: 10.1,
      speechStartTime: 4.7,
      startTime: 4.7,
      text: "second scene",
    });
    const speechRange = (segment: WorkspaceSegmentTimelineSegment) => {
      if (segment === firstSegment) {
        return { endTime: 5, startTime: 0 };
      }
      if (segment === secondSegment) {
        return { endTime: 10.5, startTime: 5 };
      }
      return null;
    };

    expect(
      resolveWorkspaceSegmentTimelineSpeechBoundaryTime(firstSegment, secondSegment, {
        preserveTouchingBoundary: true,
        speechRange,
      }),
    ).toBe(5);

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline([firstSegment, secondSegment], {
      preserveSourceTimelineEnd: true,
      speechBoundaryEnabled: true,
      speechRange,
      voiceEnabled: true,
    });

    expect(rebuilt[0]).toEqual(expect.objectContaining({
      duration: 5,
      endTime: 5,
      startTime: 0,
    }));
    expect(rebuilt[1]).toEqual(expect.objectContaining({
      duration: 5.5,
      endTime: 10.5,
      startTime: 5,
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

  it("does not let speech boundaries squeeze an automatic scene below its voice duration after earlier manual edits", () => {
    const firstSegment = createSegment({
      duration: 3.88,
      durationMode: "manual",
      endTime: 3.88,
      manualDurationSeconds: 5,
      mediaType: "photo",
      speechDuration: 3.16,
      speechEndTime: 3.16,
      speechStartTime: 0,
      text: "first scene",
    });
    const secondSegment = createSegment({
      duration: 4.78,
      durationMode: "manual",
      endTime: 8.66,
      manualDurationSeconds: 5,
      mediaType: "video",
      speechDuration: 4.22,
      speechEndTime: 8.1,
      speechStartTime: 3.88,
      startTime: 3.88,
      text: "second scene",
    });
    const thirdSegment = createSegment({
      duration: 3.92,
      endTime: 12.58,
      mediaType: "photo",
      speechDuration: 3.66,
      speechEndTime: 12.32,
      speechStartTime: 8.66,
      startTime: 8.66,
      text: "third scene",
    });
    const fourthSegment = createSegment({
      duration: 4.48,
      endTime: 17.06,
      mediaType: "photo",
      speechDuration: 4.12,
      speechEndTime: 16.7,
      speechStartTime: 12.58,
      startTime: 12.58,
      text: "fourth scene",
    });

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline(
      [firstSegment, secondSegment, thirdSegment, fourthSegment],
      {
        speechBoundaryEnabled: true,
        visualKind: (segment) => segment.mediaType === "video" ? "video" : "image",
        voiceEnabled: true,
      },
    );

    expect(rebuilt[0]).toEqual(expect.objectContaining({
      duration: 5,
      endTime: 5,
      startTime: 0,
    }));
    expect(rebuilt[1]).toEqual(expect.objectContaining({
      duration: 5,
      endTime: 10,
      startTime: 5,
    }));
    expect(rebuilt[2]).toEqual(expect.objectContaining({
      duration: 3.66,
      endTime: 13.66,
      startTime: 10,
    }));
  });

  it("keeps following still durations after a user-selected manual edit shifts the timeline", () => {
    const editedSegment = createSegment({
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 5,
      manualDurationSeconds: 3,
      mediaType: "photo",
      speechDuration: 2,
      speechEndTime: 2,
      speechStartTime: 0,
      startTime: 0,
      text: "edited scene",
    });
    const followingStillSegment = createSegment({
      duration: 5,
      endTime: 10,
      mediaType: "photo",
      speechDuration: 2,
      speechEndTime: 7,
      speechStartTime: 5,
      startTime: 5,
      text: "following scene",
    });
    const nextStillSegment = createSegment({
      duration: 5,
      endTime: 15,
      mediaType: "photo",
      speechDuration: 2,
      speechEndTime: 14,
      speechStartTime: 12,
      startTime: 10,
      text: "next scene",
    });

    const rebuilt = rebuildWorkspaceSegmentEditorTimeline(
      [editedSegment, followingStillSegment, nextStillSegment],
      {
        preserveExistingStillDurations: true,
        preserveSourceTimelineEnd: false,
        speechBoundaryEnabled: true,
        visualKind: () => "image",
        voiceEnabled: true,
      },
    );

    expect(rebuilt[0]).toEqual(expect.objectContaining({
      duration: 3,
      endTime: 3,
      startTime: 0,
    }));
    expect(rebuilt[1]).toEqual(expect.objectContaining({
      duration: 5,
      endTime: 8,
      startTime: 3,
    }));
    expect(rebuilt[2]).toEqual(expect.objectContaining({
      duration: 5,
      endTime: 13,
      startTime: 8,
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
