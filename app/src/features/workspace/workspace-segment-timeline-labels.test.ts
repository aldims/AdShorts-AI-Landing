import { describe, expect, it } from "vitest";

import { getWorkspaceSegmentTimelineSoundLabel } from "./workspace-segment-timeline-labels";

describe("getWorkspaceSegmentTimelineSoundLabel", () => {
  const segment = {
    sceneSoundGeneratedFromPrompt: null,
    sceneSoundPrompt: "",
  } as any;

  it("shows a clear progress label while scene sound is generating", () => {
    expect(getWorkspaceSegmentTimelineSoundLabel("ru", segment, { isPending: true })).toBe("Создаём звук");
    expect(getWorkspaceSegmentTimelineSoundLabel("en", segment, { isPending: true })).toBe("Creating sound");
  });
});
