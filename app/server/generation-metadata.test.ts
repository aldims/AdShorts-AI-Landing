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

  it("does not use cyrillic prompt text as the title for english generations", () => {
    const metadata = resolveGenerationPresentation({
      fallbackTitle: "Ready video",
      language: "en",
      prompt: "футуристичный белый дракон в заснежных горах",
      title: "футуристичный белый дракон в заснежных горах",
    });

    expect(metadata.language).toBe("en");
    expect(metadata.title).toBe("Ready video");
  });

  it("keeps english titles for english generations", () => {
    const metadata = resolveGenerationPresentation({
      fallbackTitle: "Ready video",
      language: "en",
      prompt: "futuristic white dragon in snowy mountains",
      title: "The Ice Dragon Awakens",
    });

    expect(metadata.title).toBe("The Ice Dragon Awakens");
  });

  it("preserves explicit hashtags when they are returned", () => {
    expect(parseGenerationHashtags("#shorts #marketing #ads")).toEqual(["#shorts", "#marketing", "#ads"]);
  });
});
