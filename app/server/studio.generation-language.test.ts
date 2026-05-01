import { describe, expect, it } from "vitest";

import { getStudioVoiceCreditCost, normalizeStudioVoiceIdForLanguage, resolveStudioGenerationLanguage } from "./studio.js";

describe("studio generation language resolution", () => {
  it("keeps the requested English language even for Cyrillic prompts", () => {
    expect(
      resolveStudioGenerationLanguage(
        "Механизм сверхбыстрой реакции кошачьей нервной системы",
        "en",
      ),
    ).toBe("en");
  });

  it("keeps an explicit English request written in Russian", () => {
    expect(
      resolveStudioGenerationLanguage("Сделай видео на английском про кошачьи рефлексы", "en"),
    ).toBe("en");
  });

  it("keeps Russian when the user selected Russian for a Latin prompt", () => {
    expect(resolveStudioGenerationLanguage("cat reflexes and reaction speed", "ru")).toBe("ru");
  });

  it("replaces a mismatched voice with the default voice for the requested language", () => {
    expect(normalizeStudioVoiceIdForLanguage("Bys_24000", "en")).toBe("Aiden");
    expect(normalizeStudioVoiceIdForLanguage("Aiden", "ru")).toBe("Bys_24000");
  });

  it("keeps the explicit ElevenLabs premium voice for Russian generation", () => {
    expect(normalizeStudioVoiceIdForLanguage("Liam", "ru")).toBe("Liam");
    expect(normalizeStudioVoiceIdForLanguage("liam", "ru")).toBe("Liam");
    expect(getStudioVoiceCreditCost("Liam")).toBe(5);
    expect(getStudioVoiceCreditCost("liam")).toBe(5);
  });

  it("keeps explicit MiniMax premium voices for Russian generation", () => {
    expect(normalizeStudioVoiceIdForLanguage("English_ManWithDeepVoice", "ru")).toBe("English_ManWithDeepVoice");
    expect(normalizeStudioVoiceIdForLanguage("Russian_BrightHeroine", "ru")).toBe("Russian_BrightHeroine");
    expect(normalizeStudioVoiceIdForLanguage("Russian_HandsomeChildhoodFriend", "ru")).toBe("Bys_24000");
    expect(normalizeStudioVoiceIdForLanguage("Russian_BrightHeroine", "en")).toBe("Aiden");
    expect(getStudioVoiceCreditCost("English_ManWithDeepVoice")).toBe(5);
    expect(getStudioVoiceCreditCost("Russian_BrightHeroine")).toBe(5);
    expect(getStudioVoiceCreditCost("Russian_HandsomeChildhoodFriend")).toBe(0);
  });
});
