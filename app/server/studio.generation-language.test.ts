import { describe, expect, it } from "vitest";

import { normalizeStudioVoiceIdForLanguage, resolveStudioGenerationLanguage } from "./studio.js";

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
});
