import { describe, expect, it } from "vitest";

import {
  buildWorkspaceSegmentDragPreviewLayout,
  resolveWorkspaceSegmentDragInsertIndex,
} from "./workspace-segment-structure-helpers";

describe("workspace segment drag preview", () => {
  it("packs the remaining scenes around the full-width destination slot", () => {
    expect(
      buildWorkspaceSegmentDragPreviewLayout(
        [
          { segmentIndex: 10, widthRatio: 0.2 },
          { segmentIndex: 11, widthRatio: 0.3 },
          { segmentIndex: 12, widthRatio: 0.5 },
        ],
        0,
        3,
      ),
    ).toEqual([
      { leftRatio: 0, segmentIndex: 11, widthRatio: 0.3 },
      { leftRatio: 0.3, segmentIndex: 12, widthRatio: 0.5 },
      { leftRatio: 0.8, segmentIndex: 10, widthRatio: 0.2 },
    ]);
  });

  it("keeps the original layout while the pointer remains in the source slot", () => {
    expect(
      buildWorkspaceSegmentDragPreviewLayout(
        [
          { segmentIndex: 10, widthRatio: 0.4 },
          { segmentIndex: 11, widthRatio: 0.6 },
        ],
        0,
        1,
      ),
    ).toEqual([
      { leftRatio: 0, segmentIndex: 10, widthRatio: 0.4 },
      { leftRatio: 0.4, segmentIndex: 11, widthRatio: 0.6 },
    ]);
  });

  it("uses the captured scene centers and compensates for timeline scrolling", () => {
    expect(
      resolveWorkspaceSegmentDragInsertIndex({
        clientX: 115,
        currentScrollLeft: 40,
        draggedIndex: 1,
        initialScrollLeft: 0,
        targetCenters: [50, 150, 250, 350],
      }),
    ).toBe(3);
  });
});
