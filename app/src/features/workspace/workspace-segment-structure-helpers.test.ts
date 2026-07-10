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
        targets: [
          { left: 0, right: 100 },
          { left: 100, right: 200 },
          { left: 200, right: 300 },
          { left: 300, right: 400 },
        ],
      }),
    ).toBe(3);
  });

  it("switches slots after crossing one quarter of the neighboring scene", () => {
    const options = {
      currentScrollLeft: 0,
      draggedIndex: 1,
      initialScrollLeft: 0,
      targets: [
        { left: 0, right: 100 },
        { left: 200, right: 300 },
        { left: 300, right: 400 },
      ],
    };

    expect(resolveWorkspaceSegmentDragInsertIndex({ ...options, clientX: 224.9 })).toBe(2);
    expect(resolveWorkspaceSegmentDragInsertIndex({ ...options, clientX: 225.1 })).toBe(3);
    expect(resolveWorkspaceSegmentDragInsertIndex({ ...options, clientX: 75.1 })).toBe(2);
    expect(resolveWorkspaceSegmentDragInsertIndex({ ...options, clientX: 74.9 })).toBe(0);
  });
});
