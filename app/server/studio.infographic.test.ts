import { describe, expect, it } from "vitest";

import { normalizeStudioSegmentEditorPayload } from "./studio.js";

const infographic = {
  animation: { durationSeconds: 0.55, type: "fade" },
  inputHash: "a".repeat(64),
  intrinsicHeight: 600,
  intrinsicWidth: 1200,
  mediaAssetId: 501,
  sourceVisualIdentity: "asset:100",
  stylePrompt: "яркий игровой интерфейс",
  text: "Три простых шага",
  transform: { centerX: 0.5, centerY: 0.28, width: 0.7 },
  version: 1,
};

const buildPayload = (segmentPatch: Record<string, unknown> = {}) => ({
  projectId: 42,
  segments: [
    {
      duration: 4,
      endTime: 4,
      index: 0,
      startTime: 0,
      text: "Сцена",
      videoAction: "original",
      ...segmentPatch,
    },
  ],
  source: "project",
});

describe("studio segment infographic payload", () => {
  it("preserves a valid infographic independently from the segment visual action", () => {
    const normalized = normalizeStudioSegmentEditorPayload(
      buildPayload({ infographic }),
      "ru",
      42,
    );

    expect(normalized?.segments[0]).toEqual(
      expect.objectContaining({
        infographic,
        infographicRemoved: false,
        videoAction: "original",
      }),
    );
  });

  it("uses an explicit removal marker without retaining stale infographic data", () => {
    const normalized = normalizeStudioSegmentEditorPayload(
      buildPayload({ infographic, infographicRemoved: true }),
      "ru",
      42,
    );

    expect(normalized?.segments[0]?.infographic).toBeUndefined();
    expect(normalized?.segments[0]?.infographicRemoved).toBe(true);
  });

  it("rejects transforms that place the infographic outside the video frame", () => {
    expect(() =>
      normalizeStudioSegmentEditorPayload(
        buildPayload({
          infographic: {
            ...infographic,
            transform: { centerX: 0.1, centerY: 0.28, width: 0.7 },
          },
        }),
        "ru",
        42,
      ),
    ).toThrow("inside the video frame");
  });
});
