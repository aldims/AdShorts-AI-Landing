import { describe, expect, it } from "vitest";

import {
  getWorkspaceSegmentEditorPlaybackDuration,
  rebuildWorkspaceSegmentEditorTimeline,
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
});
