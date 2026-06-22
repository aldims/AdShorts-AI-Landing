import { describe, expect, it } from "vitest";

import {
  buildWorkspaceSegmentSubtitlePreviewLines,
  type StudioSubtitlePreviewWord,
} from "./workspace-subtitle-preview-helpers";
import type {
  StudioSubtitleStyleOption,
  WorkspaceSegmentEditorDraftSegment,
} from "./workspace-types";

const subtitleStyle: StudioSubtitleStyleOption = {
  defaultColorId: "purple",
  description: "Test style",
  fontFamily: "Manrope",
  fontSize: 96,
  id: "modern",
  label: "Modern",
  logicMode: "block",
  marginBottom: 420,
  outlineWidth: 3,
  position: "bottom_center",
  transitionMode: "hard_cut",
  usesAccentColor: true,
  windowSize: 3,
  wordEffect: "none",
};

const createSegment = (
  overrides: Partial<WorkspaceSegmentEditorDraftSegment> = {},
): WorkspaceSegmentEditorDraftSegment =>
  ({
    duration: 10,
    endTime: 10,
    index: 1,
    originalText: "one two three",
    speechDuration: 3.3,
    speechDurationSource: "audio",
    speechEndTime: 10,
    speechStartTime: 0,
    speechWords: [],
    startTime: 0,
    text: "one two three",
    ...overrides,
  }) as WorkspaceSegmentEditorDraftSegment;

const flattenWords = (lines: StudioSubtitlePreviewWord[][]) => lines.flat();

describe("workspace segment subtitle preview helpers", () => {
  it("uses speech duration instead of stretched visual duration for synthetic subtitle progress", () => {
    const words = flattenWords(
      buildWorkspaceSegmentSubtitlePreviewLines({
        clipCurrentTime: 4,
        isPlaying: true,
        segment: createSegment(),
        style: subtitleStyle,
      }),
    );

    expect(words.map((word) => word.text)).toEqual(["one", "two", "three"]);
    expect(words.find((word) => word.state === "active")?.text).toBe("three");
  });

  it("uses local word timings for a scene voiceover that starts later on the project timeline", () => {
    const words = flattenWords(
      buildWorkspaceSegmentSubtitlePreviewLines({
        clipCurrentTime: 1.5,
        isPlaying: true,
        segment: createSegment({
          startTime: 7,
          endTime: 12,
          speechStartTime: 7,
          speechEndTime: 10,
          speechWords: [
            { confidence: 1, startTime: 0, endTime: 1, text: "one" },
            { confidence: 1, startTime: 1, endTime: 2, text: "two" },
            { confidence: 1, startTime: 2, endTime: 3, text: "three" },
          ],
        }),
        style: subtitleStyle,
      }),
    );

    expect(words.map((word) => `${word.text}:${word.state}`)).toEqual([
      "one:past",
      "two:active",
      "three:future",
    ]);
  });
});
