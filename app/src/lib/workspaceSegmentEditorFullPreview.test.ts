import { describe, expect, it } from "vitest";

import {
  clampWorkspaceSegmentEditorFullPreviewTime,
  getWorkspaceSegmentEditorFullPreviewDuration,
  getWorkspaceSegmentEditorFullPreviewPlaybackEndTime,
  getWorkspaceSegmentEditorFullPreviewSegmentRatio,
  getWorkspaceSegmentEditorFullPreviewTimeFromSegmentRatio,
  getWorkspaceSegmentEditorFullPreviewTimeRatio,
  getWorkspaceSegmentEditorFullPreviewTimelineTimeFromAudioSourceTime,
  isWorkspaceSegmentEditorFullPreviewAudioPlaybackStartConfirmed,
  mergeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges,
  resolveWorkspaceSegmentEditorFullPreviewAudioStartGateKeepAliveTracks,
  resolveWorkspaceSegmentEditorFullPreviewAudioStartGate,
  resolveWorkspaceSegmentEditorFullPreviewSegment,
  selectWorkspaceSegmentEditorFullPreviewAudibleTracksForVoiceStart,
  selectWorkspaceSegmentEditorFullPreviewAudibleAudioTracks,
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

  it("keeps music audible and sound muted while an active voice track is still starting", () => {
    const activeTracks = [
      { key: "music", kind: "music", timelineEndTime: 12, timelineStartTime: 0 },
      { key: "sound-1", kind: "sound", timelineEndTime: 4, timelineStartTime: 0 },
      { key: "voice-1", kind: "voice", timelineEndTime: 4, timelineStartTime: 0 },
    ];

    expect(selectWorkspaceSegmentEditorFullPreviewAudibleTracksForVoiceStart(activeTracks, true)).toEqual([
      { key: "music", kind: "music", timelineEndTime: 12, timelineStartTime: 0 },
      { key: "voice-1", kind: "voice", timelineEndTime: 4, timelineStartTime: 0 },
    ]);
    expect(selectWorkspaceSegmentEditorFullPreviewAudibleTracksForVoiceStart(activeTracks, false)).toEqual(activeTracks);
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
