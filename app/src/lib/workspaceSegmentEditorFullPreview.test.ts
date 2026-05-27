import { describe, expect, it } from "vitest";

import {
  clampWorkspaceSegmentEditorFullPreviewTime,
  getWorkspaceSegmentEditorFullPreviewDuration,
  getWorkspaceSegmentEditorFullPreviewSegmentRatio,
  getWorkspaceSegmentEditorFullPreviewTimeFromSegmentRatio,
  getWorkspaceSegmentEditorFullPreviewTimeRatio,
  mergeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges,
  resolveWorkspaceSegmentEditorFullPreviewSegment,
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
    ).toEqual([{ endTime: 14.35, startTime: 0, url: "/voice.mp3" }]);
  });

  it("keeps separate timeline audio ranges when the source changes", () => {
    expect(
      mergeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges([
        { endTime: 5.15, startTime: 0, url: "/voice.mp3" },
        { endTime: 9.7, startTime: 5.15, url: "/custom-scene.wav" },
      ]),
    ).toEqual([
      { endTime: 5.15, startTime: 0, url: "/voice.mp3" },
      { endTime: 9.7, startTime: 5.15, url: "/custom-scene.wav" },
    ]);
  });
});
