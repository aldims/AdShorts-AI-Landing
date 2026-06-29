import { describe, expect, it } from "vitest";

import {
  clampWorkspaceSegmentEditorFullPreviewTime,
  getWorkspaceSegmentEditorFullPreviewAudioFadeOptions,
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
  extendWorkspaceSegmentEditorFullPreviewAudioTimelineRangeTails,
  mergeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges,
  mergeWorkspaceSegmentEditorFullPreviewContinuousVoiceTracks,
  resolveWorkspaceSegmentEditorFullPreviewIsolatedVoiceTimelineEndTime,
  resolveWorkspaceSegmentEditorFullPreviewVoiceDurationSeconds,
  resolveWorkspaceSegmentEditorFullPreviewAudioStartGateKeepAliveTracks,
  resolveWorkspaceSegmentEditorFullPreviewAudioStartGate,
  resolveWorkspaceSegmentEditorFullPreviewVoiceBoundarySegments,
  resolveWorkspaceSegmentEditorFullPreviewSegment,
  resolveWorkspaceSegmentEditorFullPreviewProjectVoiceSourceStartTime,
  resolveWorkspaceSegmentEditorFullPreviewProjectVoiceTimelineEndTime,
  resolveWorkspaceSegmentEditorFullPreviewProjectVoiceTrackTimelineEndTime,
  resolveWorkspaceSegmentEditorFullPreviewSharedAudioSourceStartTimes,
  resolveWorkspaceSegmentEditorFullPreviewVoiceAlignedSegments,
  resolveWorkspaceSegmentEditorFullPreviewVoiceTrackQueue,
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

  it("resolves shared audio source starts by concatenating scene voice durations", () => {
    expect(
      Array.from(
        resolveWorkspaceSegmentEditorFullPreviewSharedAudioSourceStartTimes([
          { assetKey: "project-voice", durationSeconds: 7.4, segmentIndex: 0 },
          { assetKey: "project-voice", durationSeconds: 2.1, segmentIndex: 1 },
          { assetKey: "scene-only", durationSeconds: 4, segmentIndex: 2 },
          { assetKey: "project-voice", durationSeconds: 1.7, segmentIndex: 3 },
        ]).entries(),
      ),
    ).toEqual([
      [0, 0],
      [1, 7.4],
      [3, 9.5],
    ]);
  });

  it("keeps shared project voiceover source windows aligned with manual visual scene timings", () => {
    const sourceStartTimes = resolveWorkspaceSegmentEditorFullPreviewSharedAudioSourceStartTimes([
      { assetKey: "project-voice", durationSeconds: 3.2, segmentIndex: 0 },
      { assetKey: "project-voice", durationSeconds: 4.2, segmentIndex: 1 },
    ]);

    expect(
      resolveWorkspaceSegmentEditorFullPreviewVoiceTrackQueue([
        {
          key: "voice-1",
          kind: "voice",
          sourceKind: "timeline",
          sourceStartTime: sourceStartTimes.get(0),
          timelineEndTime: 5,
          timelineStartTime: 0,
          url: "/project-voice.mp3?v=scene-1",
        },
        {
          key: "voice-2",
          kind: "voice",
          sourceKind: "timeline",
          sourceStartTime: sourceStartTimes.get(1),
          timelineEndTime: 9.2,
          timelineStartTime: 5,
          url: "/project-voice.mp3?v=scene-2",
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        key: "voice-1",
        sourceStartTime: 0,
        timelineEndTime: 3.2,
        timelineStartTime: 0,
      }),
      expect.objectContaining({
        key: "voice-2",
        sourceStartTime: 3.2,
        timelineEndTime: 9.2,
        timelineStartTime: 5,
      }),
    ]);
  });

  it("prefers explicit project voice source starts over duration-derived starts", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewProjectVoiceSourceStartTime({
        durationDerivedSourceStartTime: 3.16,
        explicitSourceStartTime: 3.88,
      }),
    ).toBe(3.88);

    expect(
      resolveWorkspaceSegmentEditorFullPreviewProjectVoiceSourceStartTime({
        durationDerivedSourceStartTime: 3.16,
        explicitSourceStartTime: null,
      }),
    ).toBe(3.16);
  });

  it("ends project voice tracks by their own speech duration instead of the next source boundary", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewProjectVoiceTimelineEndTime({
        timelineEndTime: 5,
        timelineStartTime: 0,
        voiceDurationSeconds: 3.16,
      }),
    ).toBe(3.16);

    expect(
      resolveWorkspaceSegmentEditorFullPreviewProjectVoiceTimelineEndTime({
        timelineEndTime: 10,
        timelineStartTime: 5,
        voiceDurationSeconds: 4.22,
      }),
    ).toBe(9.22);
  });

  it("prefers timed project voice ends over visual duration fallbacks", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewProjectVoiceTrackTimelineEndTime({
        fallbackTimelineEndTimeCandidates: [15.759],
        hasTimingData: true,
        timedTimelineEndTimeCandidates: [15.579, 15.67],
        timelineStartTime: 10.499,
      }),
    ).toBe(15.67);
  });

  it("uses project voice duration fallback when no timing data exists", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewProjectVoiceTrackTimelineEndTime({
        fallbackTimelineEndTimeCandidates: [15.759],
        hasTimingData: false,
        timedTimelineEndTimeCandidates: [15.579],
        timelineStartTime: 10.499,
      }),
    ).toBe(15.759);
  });

  it("keeps project voice tracks bounded by the visual scene end", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewProjectVoiceTimelineEndTime({
        timelineEndTime: 12.45,
        timelineStartTime: 10.04,
        voiceDurationSeconds: 3.66,
      }),
    ).toBe(12.45);
  });

  it("uses project voice boundaries instead of stretched visual starts for full-preview scene timing", () => {
    const visualSegments = [
      { endTime: 5.1, index: 0, startTime: 0, voiceBoundaryEndTime: 4.82, voiceBoundaryStartTime: 0 },
      { endTime: 11.01, index: 1, startTime: 5.1, voiceBoundaryEndTime: 10.84, voiceBoundaryStartTime: 5.1 },
      { endTime: 17.72, index: 2, startTime: 11.01, voiceBoundaryEndTime: 18.06, voiceBoundaryStartTime: 11.18 },
      { endTime: 25.753, index: 3, startTime: 17.72, voiceBoundaryEndTime: 23.48, voiceBoundaryStartTime: 18.36 },
      { endTime: 32.913, index: 4, startTime: 25.753, voiceBoundaryEndTime: 30.96, voiceBoundaryStartTime: 23.8 },
      { endTime: 39.713, index: 5, startTime: 32.913, voiceBoundaryEndTime: 37.76, voiceBoundaryStartTime: 30.96 },
    ];

    expect(resolveWorkspaceSegmentEditorFullPreviewVoiceBoundarySegments(visualSegments)).toEqual([
      expect.objectContaining({ endTime: 5.1, index: 0, startTime: 0 }),
      expect.objectContaining({ endTime: 11.18, index: 1, startTime: 5.1 }),
      expect.objectContaining({ endTime: 18.36, index: 2, startTime: 11.18 }),
      expect.objectContaining({ endTime: 23.8, index: 3, startTime: 18.36 }),
      expect.objectContaining({ endTime: 30.96, index: 4, startTime: 23.8 }),
      expect.objectContaining({ endTime: 37.76, index: 5, startTime: 30.96 }),
    ]);
  });

  it("keeps visual segment timing when a complete project voice boundary set is unavailable", () => {
    const visualSegments = [
      { endTime: 4, index: 0, startTime: 0, voiceBoundaryEndTime: 3.8, voiceBoundaryStartTime: 0 },
      { endTime: 8, index: 1, startTime: 4 },
    ];

    expect(resolveWorkspaceSegmentEditorFullPreviewVoiceBoundarySegments(visualSegments)).toBe(visualSegments);
  });

  it("keeps visual segment timing when project voice boundaries are disabled", () => {
    const visualSegments = [
      { endTime: 5, index: 0, startTime: 0, voiceBoundaryEndTime: 3, voiceBoundaryStartTime: 0 },
      { endTime: 10, index: 1, startTime: 5, voiceBoundaryEndTime: 8, voiceBoundaryStartTime: 3 },
    ];

    expect(
      resolveWorkspaceSegmentEditorFullPreviewVoiceBoundarySegments(visualSegments, { enabled: false }),
    ).toBe(visualSegments);
  });

  it("adds a small voice tail without crossing into the next shared audio source window", () => {
    expect(
      extendWorkspaceSegmentEditorFullPreviewAudioTimelineRangeTails(
        [
          { endTime: 2, sourceStartTime: 0, startTime: 0, url: "/voice.wav" },
          { endTime: 7, sourceStartTime: 2.1, startTime: 5, url: "/voice.wav" },
          { endTime: 4, sourceStartTime: 0, startTime: 3, url: "/other.wav" },
        ],
        0.22,
      ),
    ).toEqual([
      { endTime: 2.1, sourceStartTime: 0, startTime: 0, url: "/voice.wav" },
      { endTime: 7.22, sourceStartTime: 2.1, startTime: 5, url: "/voice.wav" },
      { endTime: 4.22, sourceStartTime: 0, startTime: 3, url: "/other.wav" },
    ]);
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

  it("extends playback end for a final embedded voice tail", () => {
    expect(
      getWorkspaceSegmentEditorFullPreviewPlaybackEndTime(
        9,
        [
          { key: "music", kind: "music", timelineEndTime: 9, timelineStartTime: 0 },
          { key: "embedded-3", kind: "embedded_voice", timelineEndTime: 9.25, timelineStartTime: 6 },
        ],
        { finalVoiceGraceSeconds: 0.45 },
      ),
    ).toBeCloseTo(9.7, 6);
  });

  it("queues voice tracks so a long line does not overlap the next scene voice", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewVoiceTrackQueue(
        [
          {
            key: "voice-7",
            kind: "voice",
            sourceKind: "timeline",
            sourceStartTime: 35.727,
            timelineEndTime: 41.219,
            timelineStartTime: 35.727,
            url: "/project-voice.mp3",
          },
          {
            key: "embedded-8",
            kind: "embedded_voice",
            sourceKind: "isolated",
            sourceStartTime: 0,
            timelineEndTime: 46.269,
            timelineStartTime: 40.769,
            url: "/talking-scene.mp4",
          },
        ],
        { overlapToleranceSeconds: 0.02 },
      ),
    ).toEqual([
      expect.objectContaining({
        key: "voice-7",
        timelineEndTime: 41.219,
        timelineStartTime: 35.727,
      }),
      expect.objectContaining({
        key: "embedded-8",
        timelineEndTime: 46.719,
        timelineStartTime: 41.219,
      }),
    ]);
  });

  it("keeps all voice kinds in chronological order before resolving overlaps", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewVoiceTrackQueue([
        {
          key: "embedded-8",
          kind: "embedded_voice",
          sourceKind: "isolated",
          sourceStartTime: 0,
          timelineEndTime: 47,
          timelineStartTime: 42,
          url: "/talking-scene.mp4",
        },
        {
          key: "voice-2",
          kind: "voice",
          sourceKind: "timeline",
          sourceStartTime: 11.599,
          timelineEndTime: 16.2,
          timelineStartTime: 12.4,
          url: "/project-voice.mp3",
        },
        {
          key: "voice-3",
          kind: "voice",
          sourceKind: "timeline",
          sourceStartTime: 16.641,
          timelineEndTime: 21.2,
          timelineStartTime: 17.5,
          url: "/project-voice.mp3",
        },
      ]).map((track) => track.key),
    ).toEqual(["voice-2", "voice-3", "embedded-8"]);
  });

  it("does not play a project voice tail into the next source window", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewVoiceTrackQueue([
        {
          key: "voice-1",
          kind: "voice",
          sourceKind: "timeline",
          sourceStartTime: 0,
          timelineEndTime: 5.45,
          timelineStartTime: 0,
          url: "/project-voice.mp3?v=scene-1",
        },
        {
          key: "voice-2",
          kind: "voice",
          sourceKind: "timeline",
          sourceStartTime: 5,
          timelineEndTime: 10,
          timelineStartTime: 5,
          url: "/project-voice.mp3?v=scene-2",
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        key: "voice-1",
        timelineEndTime: 5,
        timelineStartTime: 0,
      }),
      expect.objectContaining({
        key: "voice-2",
        timelineEndTime: 10,
        timelineStartTime: 5,
      }),
    ]);
  });

  it("merges continuous project voice tracks from the same source with different cache keys", () => {
    expect(
      mergeWorkspaceSegmentEditorFullPreviewContinuousVoiceTracks([
        {
          key: "voice-2",
          kind: "voice",
          sourceKind: "timeline",
          sourceStartTime: 11.599,
          timelineEndTime: 16.641,
          timelineStartTime: 11.599,
          url: "/api/workspace/media-assets/6131?v=scene-2",
        },
        {
          key: "voice-3",
          kind: "voice",
          sourceKind: "timeline",
          sourceStartTime: 16.641,
          timelineEndTime: 21.683,
          timelineStartTime: 16.641,
          url: "/api/workspace/media-assets/6131?v=scene-3",
        },
        {
          key: "voice-4",
          kind: "voice",
          sourceKind: "timeline",
          sourceStartTime: 21.683,
          timelineEndTime: 26.725,
          timelineStartTime: 21.683,
          url: "/api/workspace/media-assets/6131?v=scene-4",
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        key: "voice-2",
        sourceStartTime: 11.599,
        timelineEndTime: 26.725,
        timelineStartTime: 11.599,
      }),
    ]);
  });

  it("keeps separate project voice tracks when the source offset is not continuous", () => {
    expect(
      mergeWorkspaceSegmentEditorFullPreviewContinuousVoiceTracks([
        {
          key: "voice-1",
          kind: "voice",
          sourceKind: "timeline",
          sourceStartTime: 0,
          timelineEndTime: 4,
          timelineStartTime: 0,
          url: "/project-voice.mp3",
        },
        {
          key: "voice-2",
          kind: "voice",
          sourceKind: "timeline",
          sourceStartTime: 4.4,
          timelineEndTime: 8,
          timelineStartTime: 4,
          url: "/project-voice.mp3",
        },
      ]),
    ).toHaveLength(2);
  });

  it("extends visual preview segments to the queued voice duration instead of overlapping the next scene", () => {
    const baseSegments = [
      { endTime: 35.727, index: 6, startTime: 31.767 },
      { endTime: 40.727, index: 7, startTime: 35.727 },
      { endTime: 46.227, index: 8, startTime: 40.727 },
    ];
    const queuedVoiceTracks = resolveWorkspaceSegmentEditorFullPreviewVoiceTrackQueue([
      {
        key: "voice-7",
        kind: "voice",
        previewArrayIndex: 1,
        sourceKind: "timeline",
        sourceStartTime: 35.727,
        timelineEndTime: 41.177,
        timelineStartTime: 35.727,
        url: "/project-voice.mp3",
      },
      {
        key: "embedded-8",
        kind: "embedded_voice",
        previewArrayIndex: 2,
        sourceKind: "isolated",
        sourceStartTime: 0,
        timelineEndTime: 46.227,
        timelineStartTime: 40.727,
        url: "/talking-scene.mp4",
      },
    ]);

    expect(resolveWorkspaceSegmentEditorFullPreviewVoiceAlignedSegments(baseSegments, queuedVoiceTracks)).toEqual([
      { endTime: 35.727, index: 6, startTime: 31.767 },
      { endTime: 41.177, index: 7, startTime: 35.727 },
      { endTime: 46.677, index: 8, startTime: 41.177 },
    ]);
  });

  it("keeps the next scene after an isolated segment voice proxy that is longer than the visual slot", () => {
    const baseSegments = [
      { endTime: 2.4, index: 0, startTime: 0 },
      { endTime: 6.4, index: 1, startTime: 2.4 },
    ];
    const queuedVoiceTracks = resolveWorkspaceSegmentEditorFullPreviewVoiceTrackQueue([
      {
        key: "voice-0-proxy",
        kind: "voice",
        previewArrayIndex: 0,
        sourceKind: "isolated",
        sourceStartTime: 0,
        timelineEndTime: 3.7,
        timelineStartTime: 0,
        url: "/api/workspace/project-segment-voiceover?segmentIndex=0",
      },
    ]);

    expect(resolveWorkspaceSegmentEditorFullPreviewVoiceAlignedSegments(baseSegments, queuedVoiceTracks)).toEqual([
      { endTime: 3.7, index: 0, startTime: 0 },
      { endTime: 7.7, index: 1, startTime: 3.7 },
    ]);
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

  it("does not fade out voice tracks before the final word", () => {
    expect(getWorkspaceSegmentEditorFullPreviewAudioFadeOptions({ kind: "voice" }, 0.2)).toEqual({
      fadeInSeconds: 0.025,
      fadeOutSeconds: 0,
    });
    expect(getWorkspaceSegmentEditorFullPreviewAudioFadeOptions({ kind: "embedded_voice" }, 0.2)).toEqual({
      fadeInSeconds: 0.025,
      fadeOutSeconds: 0,
    });
    expect(getWorkspaceSegmentEditorFullPreviewAudioFadeOptions({ kind: "sound" }, 0.2)).toEqual({
      fadeInSeconds: 0.2,
      fadeOutSeconds: 0.2,
    });

    expect(
      getWorkspaceSegmentEditorFullPreviewAudioFadeMultiplier(
        { kind: "voice", timelineEndTime: 5, timelineStartTime: 1 },
        4.9,
        getWorkspaceSegmentEditorFullPreviewAudioFadeOptions({ kind: "voice" }, 0.2),
      ),
    ).toBe(1);
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

  it("keeps an embedded voice track long enough when the generated video is longer than the visual slot", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewIsolatedVoiceTimelineEndTime({
        timelineEndTime: 6.48,
        timelineStartTime: 0,
        voiceDurationSeconds: 6.7,
      }),
    ).toBe(6.7);
  });

  it("uses measured scene voice duration when it is longer than saved metadata", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewVoiceDurationSeconds({
        fallbackDurationSeconds: 4.4,
        measuredDurationSeconds: 4.644,
      }),
    ).toBe(4.644);
  });

  it("falls back to saved voice metadata when measured duration is missing", () => {
    expect(
      resolveWorkspaceSegmentEditorFullPreviewVoiceDurationSeconds({
        fallbackDurationSeconds: 4.4,
        measuredDurationSeconds: null,
      }),
    ).toBe(4.4);
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

  it("keeps overlapping voice tails audible at a segment boundary", () => {
    expect(
      selectWorkspaceSegmentEditorFullPreviewAudibleAudioTracks([
        { key: "music", kind: "music", timelineEndTime: 12, timelineStartTime: 0 },
        { key: "voice-1", kind: "voice", timelineEndTime: 4.55, timelineStartTime: 0 },
        { key: "voice-2", kind: "voice", timelineEndTime: 8.4, timelineStartTime: 4 },
      ]),
    ).toEqual([
      { key: "music", kind: "music", timelineEndTime: 12, timelineStartTime: 0 },
      { key: "voice-1", kind: "voice", timelineEndTime: 4.55, timelineStartTime: 0 },
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
      { key: "voice-1", kind: "voice", timelineEndTime: 4.45, timelineStartTime: 0 },
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

  it("re-syncs a playing voice track after a large source-time drift", () => {
    expect(
      shouldSeekWorkspaceSegmentEditorFullPreviewAudioTrack({
        audioSeekToleranceSeconds: 0.09,
        currentSourceTime: 2,
        isPaused: false,
        isVoiceTrack: true,
        musicSeekToleranceSeconds: 0.75,
        nextSourceTime: 11,
        trackKind: "voice",
        voicePausedSeekToleranceSeconds: 0.04,
        voicePlayingSeekToleranceSeconds: 0.75,
      }),
    ).toBe(true);
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
