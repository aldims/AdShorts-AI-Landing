import { describe, expect, it } from "vitest";

import {
  normalizeExamplePrefillIntent,
  normalizeExamplePrefillStudioSettings,
} from "./example-prefill";

describe("example prefill normalization", () => {
  it("keeps valid studio settings and removes empty values", () => {
    expect(
      normalizeExamplePrefillStudioSettings({
        aiVideoGenerateAudioEnabled: true,
        brandText: "  Brand copy  ",
        creationMode: "scenes",
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
      aiVideoGenerateAudioEnabled: true,
      brandText: "Brand copy",
      creationMode: "scenes",
      language: "ru",
      musicType: "ai",
      subtitleColorId: "purple",
      subtitleEnabled: false,
      subtitleStyleId: "modern",
      videoMode: "standard",
      voiceEnabled: false,
      voiceId: "Bys_24000",
    });
  });

  it("drops unknown creation modes instead of inventing project metadata", () => {
    expect(
      normalizeExamplePrefillStudioSettings({
        creationMode: "automatic",
        language: "ru",
      }),
    ).toEqual({
      language: "ru",
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
