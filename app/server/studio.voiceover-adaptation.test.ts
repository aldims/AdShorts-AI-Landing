import { describe, expect, it } from "vitest";

import { getStudioVoiceoverAdaptationTarget } from "./studio.js";

describe("getStudioVoiceoverAdaptationTarget", () => {
  it("keeps a 15 percent duration reserve before voiceover is generated", () => {
    expect(getStudioVoiceoverAdaptationTarget(10)).toEqual({
      maxWords: 20,
      targetDurationSeconds: 8.5,
      visualDurationSeconds: 10,
    });
  });

  it("keeps a usable minimum for very short visuals", () => {
    expect(getStudioVoiceoverAdaptationTarget(1).maxWords).toBe(3);
  });
});
