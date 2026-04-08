import { describe, expect, it } from "vitest";

import { parseGenerationHashtags, resolveGenerationPresentation } from "./generation-metadata.js";

describe("generation metadata", () => {
  it("falls back to russian prompt metadata when upstream returns english text", () => {
    const metadata = resolveGenerationPresentation({
      description: "A cinematic story about productivity hacks",
      hashtags: "",
      prompt: "Как перестать прокрастинировать и начать действовать",
      title: "Productivity hacks",
    });

    expect(metadata.prompt).toBe("Как перестать прокрастинировать и начать действовать");
    expect(metadata.title).toContain("Как перестать прокрастинировать");
    expect(metadata.description).toBe("Как перестать прокрастинировать и начать действовать");
    expect(metadata.hashtags.length).toBeGreaterThan(0);
  });

  it("preserves explicit hashtags when they are returned", () => {
    expect(parseGenerationHashtags("#shorts #marketing #ads")).toEqual(["#shorts", "#marketing", "#ads"]);
  });
});
