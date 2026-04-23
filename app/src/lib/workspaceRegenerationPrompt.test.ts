import { describe, expect, it } from "vitest";

import { resolveWorkspaceRegenerationPrompt } from "./workspaceRegenerationPrompt";

describe("resolveWorkspaceRegenerationPrompt", () => {
  it("prefers the current generated video prompt for the same project", () => {
    expect(
      resolveWorkspaceRegenerationPrompt({
        draftDescription: "draft description",
        generatedVideoAdId: 3117,
        generatedVideoPrompt: "generated prompt",
        projectId: 3117,
        projectPrompt: "project prompt",
        topicInput: "topic input",
      }),
    ).toBe("generated prompt");
  });

  it("falls back to the stored project prompt when generated video is for another project", () => {
    expect(
      resolveWorkspaceRegenerationPrompt({
        draftDescription: "draft description",
        generatedVideoAdId: 3001,
        generatedVideoPrompt: "generated prompt",
        projectId: 3117,
        projectPrompt: "project prompt",
        topicInput: "topic input",
      }),
    ).toBe("project prompt");
  });

  it("uses the segment editor draft description on direct edit route when project prompt is not loaded", () => {
    expect(
      resolveWorkspaceRegenerationPrompt({
        draftDescription: "О натуральных числах",
        generatedVideoAdId: null,
        generatedVideoPrompt: null,
        projectId: 3117,
        projectPrompt: "",
        topicInput: "",
      }),
    ).toBe("О натуральных числах");
  });
});
