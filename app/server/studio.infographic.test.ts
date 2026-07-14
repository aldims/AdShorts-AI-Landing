import { describe, expect, it } from "vitest";

import { normalizeStudioSegmentEditorPayload } from "./studio.js";

const infographic = {
  animation: { durationSeconds: 2.2, type: "fade" },
  inputHash: "a".repeat(64),
  intrinsicHeight: 600,
  intrinsicWidth: 1200,
  mediaAssetId: 501,
  parts: [
    {
      frame: { height: 0.4, width: 0.9, x: 0.05, y: 0.05 },
      intrinsicHeight: 240,
      intrinsicWidth: 900,
      mediaAssetId: 502,
      reveal: { delaySeconds: 0, durationSeconds: 1.3 },
      text: "Три простых",
    },
    {
      frame: { height: 0.35, width: 0.7, x: 0.15, y: 0.6 },
      intrinsicHeight: 210,
      intrinsicWidth: 700,
      mediaAssetId: 503,
      reveal: { delaySeconds: 1.7, durationSeconds: 1.3 },
      text: "шага",
    },
  ],
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
