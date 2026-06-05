import { describe, expect, it } from "vitest";

import {
  clampWorkspaceSegmentEditorFullPreviewTime,
  getWorkspaceSegmentEditorFullPreviewAudioFadeMultiplier,
  getWorkspaceSegmentEditorFullPreviewDuckedVolume,
  getWorkspaceSegmentEditorFullPreviewDuration,
  getWorkspaceSegmentEditorFullPreviewPlaybackEndTime,
  getWorkspaceSegmentEditorFullPreviewSegmentRatio,
  getWorkspaceSegmentEditorFullPreviewTimeFromSegmentRatio,
  getWorkspaceSegmentEditorFullPreviewTimeRatio,
  getWorkspaceSegmentEditorFullPreviewTimelineTimeFromAudioSourceTime,
  getWorkspaceSegmentEditorFullPreviewVoiceDuckingStrength,
  isWorkspaceSegmentEditorFullPreviewAudioPlaybackStartConfirmed,
  isWorkspaceSegmentEditorFullPreviewAudioReadyState,
  mergeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges,
  resolveWorkspaceSegmentEditorFullPreviewIsolatedVoiceTimelineEndTime,
  resolveWorkspaceSegmentEditorFullPreviewAudioStartGateKeepAliveTracks,
  resolveWorkspaceSegmentEditorFullPreviewAudioStartGate,
  resolveWorkspaceSegmentEditorFullPreviewSegment,
  resolveWorkspaceSegmentEditorFullPreviewRejectedAudioPreparationResult,
  serializeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges,
  selectWorkspaceSegmentEditorFullPreviewRequiredAudioTracksForStart,
  selectWorkspaceSegmentEditorFullPreviewAudibleTracksForVoiceStart,
  selectWorkspaceSegmentEditorFullPreviewAudibleAudioTracks,
  shouldHoldWorkspaceSegmentEditorFullPreviewAudioStartGate,
  shouldSeekWorkspaceSegmentEditorFullPreviewAudioStartGateTrack,
  shouldSeekWorkspaceSegmentEditorFullPreviewAudioTrack,
} from "./workspaceSegmentEditorFullPreview";

describe("workspace segment editor full preview", () => {
  const segments = [
    { endTime: 2.5, index: 10, startTime: 0 },
    { endTime: 6, index: 20, startTime: 2.5 },
    { endTime: 9, index: 30, startTime: 6 },
  ];

  it("clamps preview time to the total duration", () => {
    expect(clampWorkspaceSegmentEditorFullPreviewTime(-1, 9)).toBe(0);
    expect(clampWorkspaceSegmentEditorFullPreviewTime(4, 9)).toBe(4);
    expect(clampWorkspaceSegmentEditorFullPreviewTime(12, 9)).toBe(9);
  });

  it("resolves total duration from segment end times", () => {
    expect(getWorkspaceSegmentEditorFullPreviewDuration(segments)).toBe(9);
  });

  it("extends playback end for a final voice tail without changing visual duration", () => {
    expect(
      getWorkspaceSegmentEditorFullPreviewPlaybackEndTime(
        9,
        [
          { key: "music", kind: "music", timelineEndTime: 9, timelineStartTime: 0 },
          { key: "voice-3", kind: "voice", timelineEndTime: 9.25, timelineStartTime: 6 },
        ],
        { finalVoiceGraceSeconds: 0.45 },
      ),
    ).toBeCloseTo(9.7, 6);
  });

  it("fades finite audio tracks at their preview boundaries", () => {
    const track = { key: "sound-1", kind: "sound", timelineEndTime: 5, timelineStartTime: 1 };

    expect(getWorkspaceSegmentEditorFullPreviewAudioFadeMultiplier(track, 0.9, { fadeSeconds: 0.4 })).toBe(0);
    expect(getWorkspaceSegmentEditorFullPreviewAudioFadeMultiplier(track, 1, { fadeSeconds: 0.4 })).toBe(0);
    expect(getWorkspaceSegmentEditorFullPreviewAudioFadeMultiplier(track, 1.2, { fadeSeconds: 0.4 })).toBeCloseTo(0.5, 6);
    expect(getWorkspaceSegmentEditorFullPreviewAudioFadeMultiplier(track, 2, { fadeSeconds: 0.4 })).toBe(1);
    expect(getWorkspaceSegmentEditorFullPreviewAudioFadeMultiplier(track, 4.8, { fadeSeconds: 0.4 })).toBeCloseTo(0.5, 6);
    expect(getWorkspaceSegmentEditorFullPreviewAudioFadeMultiplier(track, 5, { fadeSeconds: 0.4 })).toBe(0);
  });

  it("keeps looped music at stable volume inside the preview window", () => {
    const track = { key: "music", kind: "music", loop: true, timelineEndTime: 10, timelineStartTime: 0 };

    expect(getWorkspaceSegmentEditorFullPreviewAudioFadeMultiplier(track, 0, { fadeSeconds: 0.4 })).toBe(1);
    expect(getWorkspaceSegmentEditorFullPreviewAudioFadeMultiplier(track, 9.95, { fadeSeconds: 0.4 })).toBe(1);
    expect(getWorkspaceSegmentEditorFullPreviewAudioFadeMultiplier(track, 10, { fadeSeconds: 0.4 })).toBe(0);
  });

  it("supports a shorter voice fade-in while preserving the longer fade-out", () => {
    const track = { key: "voice-1", kind: "voice", timelineEndTime: 5, timelineStartTime: 1 };
    const options = { fadeInSeconds: 0.05, fadeOutSeconds: 0.2 };

    expect(getWorkspaceSegmentEditorFullPreviewAudioFadeMultiplier(track, 1.025, options)).toBeCloseTo(0.5, 6);
    expect(getWorkspaceSegmentEditorFullPreviewAudioFadeMultiplier(track, 4.9, options)).toBeCloseTo(0.5, 6);
  });

  it("ramps music ducking before and after voice instead of jumping at scene boundaries", () => {
    const tracks = [
      { key: "music", kind: "music", timelineEndTime: 12, timelineStartTime: 0 },
      { key: "voice-1", kind: "voice", timelineEndTime: 4, timelineStartTime: 1 },
      { key: "voice-2", kind: "voice", timelineEndTime: 8, timelineStartTime: 5 },
    ];
    const options = { attackSeconds: 0.2, releaseSeconds: 0.5 };

    expect(getWorkspaceSegmentEditorFullPreviewVoiceDuckingStrength(tracks, 0.7, options)).toBe(0);
    expect(getWorkspaceSegmentEditorFullPreviewVoiceDuckingStrength(tracks, 0.9, options)).toBeCloseTo(0.5, 6);
    expect(getWorkspaceSegmentEditorFullPreviewVoiceDuckingStrength(tracks, 2, options)).toBe(1);
    expect(getWorkspaceSegmentEditorFullPreviewVoiceDuckingStrength(tracks, 4.25, options)).toBeCloseTo(0.5, 6);
    expect(getWorkspaceSegmentEditorFullPreviewVoiceDuckingStrength(tracks, 4.75, options)).toBe(0);
    expect(getWorkspaceSegmentEditorFullPreviewVoiceDuckingStrength(tracks, 4.9, options)).toBeCloseTo(0.5, 6);
  });

  it("interpolates ducked preview volume by ducking strength", () => {
    expect(
      getWorkspaceSegmentEditorFullPreviewDuckedVolume({
        baseVolume: 0.22,
        duckedVolume: 0.08,
        duckingStrength: 0,
      }),
    ).toBeCloseTo(0.22, 6);
    expect(
      getWorkspaceSegmentEditorFullPreviewDuckedVolume({
        baseVolume: 0.22,
        duckedVolume: 0.08,
        duckingStrength: 0.5,
      }),
    ).toBeCloseTo(0.15, 6);
    expect(
      getWorkspaceSegmentEditorFullPreviewDuckedVolume({
        baseVolume: 0.22,
        duckedVolume: 0.08,
        duckingStrength: 1,
      }),
    ).toBeCloseTo(0.08, 6);
  });

  it("ends an isolated voice track by voice duration when the visual slot is longer", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewIsolatedVoiceTimelineEndTime({
        timelineEndTime: 10,
        timelineStartTime: 2,
        voiceDurationSeconds: 5,
      }),
    ).toBe(7);
  });

  it("keeps an isolated voice track long enough when voice is longer than the visual slot", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewIsolatedVoiceTimelineEndTime({
        timelineEndTime: 6,
        timelineStartTime: 2,
        voiceDurationSeconds: 5,
      }),
    ).toBe(7);
  });

  it("falls back to the visual slot when isolated voice duration is unknown", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewIsolatedVoiceTimelineEndTime({
        timelineEndTime: 10,
        timelineStartTime: 2,
        voiceDurationSeconds: null,
      }),
    ).toBe(10);
  });

  it("returns the playhead ratio for CSS positioning", () => {
    expect(getWorkspaceSegmentEditorFullPreviewTimeRatio(4.5, 9)).toBe(0.5);
    expect(getWorkspaceSegmentEditorFullPreviewTimeRatio(99, 9)).toBe(1);
    expect(getWorkspaceSegmentEditorFullPreviewTimeRatio(1, 0)).toBe(0);
  });

  it("maps playhead position through equal segment columns", () => {
    expect(getWorkspaceSegmentEditorFullPreviewSegmentRatio(segments, 0)).toBe(0);
    expect(getWorkspaceSegmentEditorFullPreviewSegmentRatio(segments, 2.5)).toBeCloseTo(1 / 3, 6);
    expect(getWorkspaceSegmentEditorFullPreviewSegmentRatio(segments, 7.5)).toBeCloseTo(2.5 / 3, 6);
    expect(getWorkspaceSegmentEditorFullPreviewSegmentRatio(segments, 9)).toBe(1);
  });

  it("resolves seek time from equal segment-column ratio", () => {
    expect(getWorkspaceSegmentEditorFullPreviewTimeFromSegmentRatio(segments, -1)).toBe(0);
    expect(getWorkspaceSegmentEditorFullPreviewTimeFromSegmentRatio(segments, 1 / 3)).toBeCloseTo(2.5, 6);
    expect(getWorkspaceSegmentEditorFullPreviewTimeFromSegmentRatio(segments, 2.5 / 3)).toBeCloseTo(7.5, 6);
    expect(getWorkspaceSegmentEditorFullPreviewTimeFromSegmentRatio(segments, 99)).toBe(9);
  });

  it("switches to the next segment on an exact boundary", () => {
    expect(resolveWorkspaceSegmentEditorFullPreviewSegment(segments, 2.5)).toMatchObject({
      arrayIndex: 1,
      localTime: 0,
      segmentIndex: 20,
    });
  });

  it("resolves local time inside the active segment", () => {
    expect(resolveWorkspaceSegmentEditorFullPreviewSegment(segments, 7.25)).toMatchObject({
      arrayIndex: 2,
      duration: 3,
      localTime: 1.25,
      progress: 1.25 / 3,
      segmentIndex: 30,
    });
  });

  it("keeps the final segment active at the exact end", () => {
    expect(resolveWorkspaceSegmentEditorFullPreviewSegment(segments, 9)).toMatchObject({
      arrayIndex: 2,
      localTime: 3,
      progress: 1,
      segmentIndex: 30,
    });
  });

  it("merges adjacent timeline audio ranges for continuous project voiceover", () => {
    expect(
      mergeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges([
        { endTime: 5.15, startTime: 0, url: "/voice.mp3" },
        { endTime: 9.7, startTime: 5.15, url: "/voice.mp3" },
        { endTime: 14.35, startTime: 9.7, url: "/voice.mp3" },
      ]),
    ).toEqual([{ endTime: 14.35, sourceStartTime: 0, startTime: 0, url: "/voice.mp3" }]);
  });

  it("keeps separate timeline audio ranges when the source changes", () => {
    expect(
      mergeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges([
        { endTime: 5.15, startTime: 0, url: "/voice.mp3" },
        { endTime: 9.7, startTime: 5.15, url: "/custom-scene.wav" },
      ]),
    ).toEqual([
      { endTime: 5.15, sourceStartTime: 0, startTime: 0, url: "/voice.mp3" },
      { endTime: 9.7, sourceStartTime: 5.15, startTime: 5.15, url: "/custom-scene.wav" },
    ]);
  });

  it("keeps separate project voiceover ranges when source and preview offsets differ", () => {
    expect(
      mergeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges([
        { endTime: 4.4, sourceStartTime: 0, startTime: 0, url: "/project-voice.mp3" },
        { endTime: 8.8, sourceStartTime: 4.8, startTime: 4.4, url: "/project-voice.mp3" },
      ]),
    ).toEqual([
      { endTime: 4.4, sourceStartTime: 0, startTime: 0, url: "/project-voice.mp3" },
      { endTime: 8.8, sourceStartTime: 4.8, startTime: 4.4, url: "/project-voice.mp3" },
    ]);
  });

  it("merges project voiceover ranges when the source offset is continuous", () => {
    expect(
      mergeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges([
        { endTime: 4, sourceStartTime: 10, startTime: 0, url: "/project-voice.mp3" },
        { endTime: 8, sourceStartTime: 14, startTime: 4, url: "/project-voice.mp3" },
      ]),
    ).toEqual([{ endTime: 8, sourceStartTime: 10, startTime: 0, url: "/project-voice.mp3" }]);
  });

  it("merges overlapping project voiceover ranges when they share the timeline source offset", () => {
    expect(
      mergeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges([
        { endTime: 4.35, sourceStartTime: 0, startTime: 0, url: "/project-voice.mp3" },
        { endTime: 9.92, sourceStartTime: 4.02, startTime: 4.02, url: "/project-voice.mp3" },
      ]),
    ).toEqual([{ endTime: 9.92, sourceStartTime: 0, startTime: 0, url: "/project-voice.mp3" }]);
  });

  it("serializes overlapping project voiceover ranges when a visual slot is shorter than speech", () => {
    const serializedRanges = serializeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges([
      { endTime: 29.2, sourceStartTime: 24.06, startTime: 23.8, url: "/project-voice.mp3" },
      { endTime: 34.36, sourceStartTime: 29.46, startTime: 28.7, url: "/project-voice.mp3" },
    ]);

    expect(serializedRanges).toEqual([
      { endTime: 29.2, sourceStartTime: 24.06, startTime: 23.8, url: "/project-voice.mp3" },
      { endTime: 34.86, sourceStartTime: 29.46, startTime: 29.2, url: "/project-voice.mp3" },
    ]);
    expect(mergeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges(serializedRanges)).toEqual([
      { endTime: 34.86, sourceStartTime: 24.06, startTime: 23.8, url: "/project-voice.mp3" },
    ]);
  });

  it("holds the playhead at a voice segment boundary until audio starts", () => {
    const tracks = [
      { key: "voice-1", kind: "voice", timelineEndTime: 4, timelineStartTime: 0 },
      { key: "voice-2", kind: "voice", timelineEndTime: 8, timelineStartTime: 4 },
    ];

    expect(
      resolveWorkspaceSegmentEditorFullPreviewAudioStartGate(
        tracks,
        3.98,
        4.05,
        (track) => track.key === "voice-1",
      ),
    ).toEqual({
      holdTime: 4,
      trackKey: "voice-2",
    });
  });

  it("does not hold the playhead when the boundary voice track is already started", () => {
    const tracks = [
      { key: "voice-2", kind: "voice", timelineEndTime: 8, timelineStartTime: 4 },
    ];

    expect(
      resolveWorkspaceSegmentEditorFullPreviewAudioStartGate(
        tracks,
        3.98,
        4.05,
        () => true,
      ),
    ).toBeNull();
  });

  it("prefers the newest voice track when voice tails overlap at a segment boundary", () => {
    expect(
      selectWorkspaceSegmentEditorFullPreviewAudibleAudioTracks([
        { key: "music", kind: "music", timelineEndTime: 12, timelineStartTime: 0 },
        { key: "voice-1", kind: "voice", timelineEndTime: 4.55, timelineStartTime: 0 },
        { key: "voice-2", kind: "voice", timelineEndTime: 8.4, timelineStartTime: 4 },
      ]),
    ).toEqual([
      { key: "music", kind: "music", timelineEndTime: 12, timelineStartTime: 0 },
      { key: "voice-2", kind: "voice", timelineEndTime: 8.4, timelineStartTime: 4 },
    ]);
  });

  it("keeps music alive while waiting for a boundary voice track to start", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewAudioStartGateKeepAliveTracks(
        [
          { key: "music", kind: "music", timelineEndTime: 12, timelineStartTime: 0 },
          { key: "voice-1", kind: "voice", timelineEndTime: 4.45, timelineStartTime: 0 },
          { key: "voice-2", kind: "voice", timelineEndTime: 8.4, timelineStartTime: 4 },
        ],
        "voice-2",
      ),
    ).toEqual([
      { key: "music", kind: "music", timelineEndTime: 12, timelineStartTime: 0 },
      { key: "voice-2", kind: "voice", timelineEndTime: 8.4, timelineStartTime: 4 },
    ]);
  });

  it("keeps music and scene sound audible while an active voice track is still starting", () => {
    const activeTracks = [
      { key: "music", kind: "music", timelineEndTime: 12, timelineStartTime: 0 },
      { key: "sound-1", kind: "sound", timelineEndTime: 4, timelineStartTime: 0 },
      { key: "voice-1", kind: "voice", timelineEndTime: 4, timelineStartTime: 0 },
    ];

    expect(selectWorkspaceSegmentEditorFullPreviewAudibleTracksForVoiceStart(activeTracks, true)).toEqual(activeTracks);
    expect(selectWorkspaceSegmentEditorFullPreviewAudibleTracksForVoiceStart(activeTracks, false)).toEqual(activeTracks);
  });

  it("holds the audio start gate only for the preview run start, not later scene boundaries", () => {
    expect(
      shouldHoldWorkspaceSegmentEditorFullPreviewAudioStartGate({
        gateHoldTime: 10.6,
        runStartTime: 0,
        toleranceSeconds: 0.04,
      }),
    ).toBe(false);
    expect(
      shouldHoldWorkspaceSegmentEditorFullPreviewAudioStartGate({
        gateHoldTime: 10.6,
        runStartTime: 10.62,
        toleranceSeconds: 0.04,
      }),
    ).toBe(true);
  });

  it("requires only active audio before starting full preview", () => {
    const tracks = [
      { key: "music", kind: "music", timelineEndTime: 16, timelineStartTime: 0 },
      { key: "sound-1", kind: "sound", timelineEndTime: 4, timelineStartTime: 0 },
      { key: "voice-1", kind: "voice", timelineEndTime: 3.5, timelineStartTime: 0 },
      { key: "voice-2", kind: "voice", timelineEndTime: 12, timelineStartTime: 8 },
      { key: "old-sound", kind: "sound", timelineEndTime: 1, timelineStartTime: 0 },
    ];
    const activeTracks = [
      { key: "music", kind: "music", timelineEndTime: 16, timelineStartTime: 0 },
      { key: "voice-1", kind: "voice", timelineEndTime: 3.5, timelineStartTime: 0 },
    ];

    expect(
      selectWorkspaceSegmentEditorFullPreviewRequiredAudioTracksForStart(tracks, activeTracks, 2),
    ).toEqual([
      { key: "music", kind: "music", timelineEndTime: 16, timelineStartTime: 0 },
      { key: "voice-1", kind: "voice", timelineEndTime: 3.5, timelineStartTime: 0 },
    ]);
  });

  it("treats preview audio as ready only at or above the required media ready state", () => {
    expect(isWorkspaceSegmentEditorFullPreviewAudioReadyState(3, 3)).toBe(true);
    expect(isWorkspaceSegmentEditorFullPreviewAudioReadyState(2, 3)).toBe(false);
    expect(isWorkspaceSegmentEditorFullPreviewAudioReadyState(Number.NaN, 3)).toBe(false);
  });

  it("does not treat a browser audio-unlock rejection as a ready full preview", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewRejectedAudioPreparationResult({
        activeTrackCount: 2,
        isAudioUnlockRequired: true,
        rejectedPlayTrackCount: 1,
      }),
    ).toBe("unlock-required");

    expect(
      resolveWorkspaceSegmentEditorFullPreviewRejectedAudioPreparationResult({
        activeTrackCount: 2,
        isAudioUnlockRequired: false,
        rejectedPlayTrackCount: 1,
      }),
    ).toBe("ready");
  });

  it("ignores old voice starts outside the startup gate window", () => {
    const tracks = [
      { key: "voice-1", kind: "voice", timelineEndTime: 8, timelineStartTime: 0 },
    ];

    expect(
      resolveWorkspaceSegmentEditorFullPreviewAudioStartGate(
        tracks,
        3,
        3.1,
        () => false,
        { startWindowSeconds: 1 },
      ),
    ).toBeNull();
  });

  it("does not continuously re-seek music for small playback drift", () => {
    expect(
      shouldSeekWorkspaceSegmentEditorFullPreviewAudioTrack({
        audioSeekToleranceSeconds: 0.09,
        currentSourceTime: 12.2,
        isPaused: false,
        isVoiceTrack: false,
        musicSeekToleranceSeconds: 0.75,
        nextSourceTime: 12,
        trackKind: "music",
        voicePausedSeekToleranceSeconds: 0.5,
      }),
    ).toBe(false);
  });

  it("still re-syncs music after a large playback drift", () => {
    expect(
      shouldSeekWorkspaceSegmentEditorFullPreviewAudioTrack({
        audioSeekToleranceSeconds: 0.09,
        currentSourceTime: 14,
        isPaused: false,
        isVoiceTrack: false,
        musicSeekToleranceSeconds: 0.75,
        nextSourceTime: 12,
        trackKind: "music",
        voicePausedSeekToleranceSeconds: 0.5,
      }),
    ).toBe(true);
  });

  it("keeps voice playback free from per-frame forward seeks", () => {
    expect(
      shouldSeekWorkspaceSegmentEditorFullPreviewAudioTrack({
        audioSeekToleranceSeconds: 0.09,
        currentSourceTime: 2,
        isPaused: false,
        isVoiceTrack: true,
        musicSeekToleranceSeconds: 0.75,
        nextSourceTime: 3,
        trackKind: "voice",
        voicePausedSeekToleranceSeconds: 0.5,
      }),
    ).toBe(false);
  });

  it("re-seeks a pre-armed voice track that is ahead of the expected start source time", () => {
    expect(
      shouldSeekWorkspaceSegmentEditorFullPreviewAudioStartGateTrack({
        currentSourceTime: 1.2,
        expectedSourceTime: 0,
        isPaused: false,
        syncToleranceSeconds: 0.04,
      }),
    ).toBe(true);
    expect(
      shouldSeekWorkspaceSegmentEditorFullPreviewAudioStartGateTrack({
        currentSourceTime: 0.02,
        expectedSourceTime: 0,
        isPaused: false,
        syncToleranceSeconds: 0.04,
      }),
    ).toBe(false);
  });

  it("does not confirm voice startup before the media clock advances", () => {
    expect(
      isWorkspaceSegmentEditorFullPreviewAudioPlaybackStartConfirmed({
        currentSourceTime: 0,
        expectedSourceTime: 0,
        isEnded: false,
        isPaused: false,
        isPlaying: true,
        isSeeking: false,
        leadToleranceSeconds: 0.75,
        minimumProgressSeconds: 0.02,
        minimumReadyState: 2,
        readyState: 4,
        syncToleranceSeconds: 0.03,
      }),
    ).toBe(false);

    expect(
      isWorkspaceSegmentEditorFullPreviewAudioPlaybackStartConfirmed({
        currentSourceTime: 0.024,
        expectedSourceTime: 0,
        isEnded: false,
        isPaused: false,
        isPlaying: true,
        isSeeking: false,
        leadToleranceSeconds: 0.75,
        minimumProgressSeconds: 0.02,
        minimumReadyState: 2,
        readyState: 4,
        syncToleranceSeconds: 0.03,
      }),
    ).toBe(true);
  });

  it("maps audio media time back to preview timeline time", () => {
    expect(
      getWorkspaceSegmentEditorFullPreviewTimelineTimeFromAudioSourceTime(
        {
          sourceKind: "isolated",
          sourceStartTime: 0,
          timelineEndTime: 9,
          timelineStartTime: 4,
        },
        1.5,
      ),
    ).toBe(5.5);

    expect(
      getWorkspaceSegmentEditorFullPreviewTimelineTimeFromAudioSourceTime(
        {
          sourceKind: "timeline",
          sourceStartTime: 12,
          timelineEndTime: 9,
          timelineStartTime: 4,
        },
        13.25,
      ),
    ).toBe(5.25);
  });
});
