import { afterEach, describe, expect, it, vi } from "vitest";

import { env } from "./env.js";
import { createWaveSpeedGptImage2TextToImageJob } from "./wavespeed-worker.js";

const originalFetch = globalThis.fetch;
const originalWaveSpeedApiKey = env.wavespeedApiKey;

afterEach(() => {
  globalThis.fetch = originalFetch;
  env.wavespeedApiKey = originalWaveSpeedApiKey;
});

describe("wavespeed worker", () => {
  it("uses the GPT Image 2 text-to-image endpoint when creating text-only image jobs", async () => {
    const requestedUrls: string[] = [];
    env.wavespeedApiKey = "test-wavespeed-key";
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrls.push(input.toString());

      return new Response(
        JSON.stringify({
          data: {
            id: "prediction-1",
            status: "created",
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      );
    }) as typeof fetch;

    await createWaveSpeedGptImage2TextToImageJob({
      prompt: "cinematic cafe interior",
    });

    expect(requestedUrls).toEqual(["https://api.wavespeed.ai/api/v3/openai/gpt-image-2/text-to-image"]);
  });
});
