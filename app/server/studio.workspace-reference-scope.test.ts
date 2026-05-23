import { describe, expect, it } from "vitest";

import { normalizeStudioMediaSegmentIndexForScope } from "./studio.js";

describe("studio workspace reference media scope", () => {
  it("omits segment indexes for workspace reference generation", () => {
    expect(
      normalizeStudioMediaSegmentIndexForScope(7, {
        purpose: "workspace_reference",
      }),
    ).toBeUndefined();
  });

  it("omits segment indexes for workspace reference uploads", () => {
    expect(
      normalizeStudioMediaSegmentIndexForScope(7, {
        kind: "workspace_reference_source",
        role: "character_reference_source",
      }),
    ).toBeUndefined();
  });

  it("keeps segment indexes for segment-scoped media", () => {
    expect(
      normalizeStudioMediaSegmentIndexForScope(7, {
        kind: "segment_source",
        role: "segment_source",
      }),
    ).toBe(7);
  });
});
