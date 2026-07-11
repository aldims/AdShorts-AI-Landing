import { describe, expect, it } from "vitest";

import {
  buildStudioVoiceoverTextAdaptationSystemPrompt,
  getStudioVoiceoverAdaptationTarget,
} from "./studio.js";

describe("getStudioVoiceoverAdaptationTarget", () => {
  it("keeps a 15 percent duration reserve before voiceover is generated", () => {
    expect(getStudioVoiceoverAdaptationTarget(10)).toEqual({
      maxWords: 20,
      targetDurationSeconds: 8.5,
      visualDurationSeconds: 10,
      wordsPerSecond: 1 / 0.42,
    });
  });

  it("uses the measured speed of the selected voice", () => {
    expect(getStudioVoiceoverAdaptationTarget(5, 10 / 6.5)).toEqual({
      maxWords: 6,
      targetDurationSeconds: 4.25,
      visualDurationSeconds: 5,
      wordsPerSecond: 10 / 6.5,
    });
  });

  it("keeps a usable minimum for very short visuals", () => {
    expect(getStudioVoiceoverAdaptationTarget(1).maxWords).toBe(3);
  });
});

describe("buildStudioVoiceoverTextAdaptationSystemPrompt", () => {
  it("forbids changing a character's perceived status into an objective fact", () => {
    const prompt = buildStudioVoiceoverTextAdaptationSystemPrompt({
      language: "ru",
      maxWords: 12,
      targetDurationSeconds: 5.1,
      visualDurationSeconds: 6,
    });

    expect(prompt).toContain("Preserve every essential event, actor, action, object, causal relationship");
    expect(prompt).toContain("'Город решил, что Барсик герой' must not become 'Барсик стал героем'");
    expect(prompt).toContain("shorten only as much as necessary");
  });
});
