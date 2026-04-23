import { describe, expect, it } from "vitest";

import {
  normalizeExamplePrefillIntent,
  normalizeExamplePrefillStudioSettings,
} from "./example-prefill";

describe("example prefill normalization", () => {
  it("keeps valid studio settings and removes empty values", () => {
    expect(
      normalizeExamplePrefillStudioSettings({
        brandText: "  Brand copy  ",
        language: "ru",
        musicType: "ai",
        subtitleColorId: "purple",
        subtitleEnabled: true,
        subtitleStyleId: "modern",
        videoMode: "standard",
        voiceEnabled: false,
        voiceId: " Bys_24000 ",
      }),
    ).toEqual({
      brandText: "Brand copy",
      language: "ru",
      musicType: "ai",
      subtitleColorId: "purple",
      subtitleEnabled: true,
      subtitleStyleId: "modern",
      videoMode: "standard",
      voiceEnabled: false,
      voiceId: "Bys_24000",
    });
  });

  it("normalizes a complete prefill intent payload", () => {
    expect(
      normalizeExamplePrefillIntent({
        exampleId: "  example-1 ",
        prompt: "  Сделай Shorts про кошек ",
        settings: {
          language: "en",
          voiceId: " Ryan ",
        },
      }),
    ).toEqual({
      exampleId: "example-1",
      prompt: "Сделай Shorts про кошек",
      settings: {
        language: "en",
        voiceId: "Ryan",
      },
    });
  });
});
