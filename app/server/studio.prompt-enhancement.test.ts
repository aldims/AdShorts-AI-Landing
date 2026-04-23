import { afterEach, describe, expect, it } from "vitest";

import { env } from "./env.js";
import { improveStudioSegmentAiPhotoPrompt } from "./studio.js";

const originalOpenRouterApiKey = env.openrouterApiKey;
const originalFetch = globalThis.fetch;

afterEach(() => {
  env.openrouterApiKey = originalOpenRouterApiKey;
  globalThis.fetch = originalFetch;
});

describe("studio prompt enhancement", () => {
  it("uses ai photo fallback guidance for ai_photo mode", async () => {
    env.openrouterApiKey = undefined;

    const result = await improveStudioSegmentAiPhotoPrompt("barista in a cozy coffee shop", {
      language: "en",
      mode: "ai_photo",
    });

    expect(result.prompt).toContain("cinematic vertical 9:16 composition");
    expect(result.prompt).toContain("photorealistic");
  });

  it("throws when OpenRouter key is a placeholder instead of silently using fallback", async () => {
    env.openrouterApiKey = "your_api_key";

    await expect(
      improveStudioSegmentAiPhotoPrompt("barista in a cozy coffee shop", {
        language: "en",
        mode: "ai_photo",
      }),
    ).rejects.toThrow("OpenRouter is not configured");
  });

  it("uses motion-oriented fallback guidance for ai_video mode", async () => {
    env.openrouterApiKey = undefined;

    const result = await improveStudioSegmentAiPhotoPrompt("barista in a cozy coffee shop", {
      language: "en",
      mode: "ai_video",
    });

    expect(result.prompt).toContain("cinematic vertical 9:16 video");
    expect(result.prompt).toContain("natural subject motion");
  });

  it("uses source-photo-safe fallback guidance for photo animation mode", async () => {
    env.openrouterApiKey = undefined;

    const result = await improveStudioSegmentAiPhotoPrompt("barista in a cozy coffee shop", {
      language: "en",
      mode: "photo_animation",
    });

    expect(result.prompt).toContain("image-to-video animation from a single source photo");
    expect(result.prompt).toContain("preserve subject identity and setting");
  });

  it("uses edit-oriented fallback guidance for image_edit mode", async () => {
    env.openrouterApiKey = undefined;

    const result = await improveStudioSegmentAiPhotoPrompt("extend the cafe background and add warm window light", {
      language: "en",
      mode: "image_edit",
    });

    expect(result.prompt).toContain("seamless image edit or outpaint");
    expect(result.prompt).toContain("preserve the original subject and composition");
  });

  it("throws instead of silently falling back when a configured OpenRouter key fails", async () => {
    env.openrouterApiKey = "sk-or-v1-real-looking-key";
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: "Missing Authentication header" } }), {
        headers: {
          "Content-Type": "application/json",
        },
        status: 401,
      });

    await expect(
      improveStudioSegmentAiPhotoPrompt("barista in a cozy coffee shop", {
        language: "en",
        mode: "ai_video",
      }),
    ).rejects.toThrow("Missing Authentication header");
  });
});
