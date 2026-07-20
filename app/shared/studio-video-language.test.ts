import { describe, expect, it } from "vitest";

import { detectStudioVideoLanguage, resolveStudioVideoLanguage } from "./studio-video-language.js";

describe("studio video language detection", () => {
  it("detects Russian text independently of the interface language", () => {
    expect(detectStudioVideoLanguage("Как кошки реагируют на опасность", "en")).toBe("ru");
  });

  it("detects English text independently of the interface language", () => {
    expect(detectStudioVideoLanguage("How cats react to danger", "ru")).toBe("en");
  });

  it("uses the script with more letters for mixed text", () => {
    expect(detectStudioVideoLanguage("Кошки react to danger quickly", "ru")).toBe("en");
    expect(detectStudioVideoLanguage("Cats быстро реагируют на опасность", "en")).toBe("ru");
  });

  it("falls back to the interface for short, unclear, or evenly mixed text", () => {
    expect(detectStudioVideoLanguage("AI", "ru")).toBe("ru");
    expect(detectStudioVideoLanguage("42?!", "en")).toBe("en");
    expect(detectStudioVideoLanguage("cat кот", "en")).toBe("en");
    expect(detectStudioVideoLanguage("cat кот", "ru")).toBe("ru");
  });

  it("falls back to the interface when the field is empty", () => {
    expect(detectStudioVideoLanguage("", "ru")).toBe("ru");
    expect(detectStudioVideoLanguage("   ", "en")).toBe("en");
  });

  it("keeps a manually selected language when the text or interface changes", () => {
    expect(
      resolveStudioVideoLanguage({
        interfaceLanguage: "en",
        manuallySelectedLanguage: "ru",
        text: "A fully English video idea",
      }),
    ).toBe("ru");
    expect(
      resolveStudioVideoLanguage({
        interfaceLanguage: "ru",
        manuallySelectedLanguage: "en",
        text: "Полностью русская идея для видео",
      }),
    ).toBe("en");
  });

  it("re-detects the language after every text change when there is no manual selection", () => {
    expect(
      resolveStudioVideoLanguage({
        interfaceLanguage: "ru",
        text: "Русская идея для видео",
      }),
    ).toBe("ru");
    expect(
      resolveStudioVideoLanguage({
        interfaceLanguage: "ru",
        text: "An English idea for a video",
      }),
    ).toBe("en");
  });
});
