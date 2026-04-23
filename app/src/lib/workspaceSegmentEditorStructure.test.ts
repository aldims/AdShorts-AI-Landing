import { describe, expect, it } from "vitest";

import { hasWorkspaceSegmentEditorStructureChanged } from "./workspaceSegmentEditorStructure";

describe("workspace segment editor structure", () => {
  it("does not flag identical segment order", () => {
    expect(hasWorkspaceSegmentEditorStructureChanged([0, 1, 2], [0, 1, 2])).toBe(false);
  });

  it("flags deleted segments", () => {
    expect(hasWorkspaceSegmentEditorStructureChanged([0, 2], [0, 1, 2])).toBe(true);
  });

  it("flags reordered segments", () => {
    expect(hasWorkspaceSegmentEditorStructureChanged([1, 0, 2], [0, 1, 2])).toBe(true);
  });

  it("flags inserted segments", () => {
    expect(hasWorkspaceSegmentEditorStructureChanged([0, 1, 2, 5], [0, 1, 2])).toBe(true);
  });
});
