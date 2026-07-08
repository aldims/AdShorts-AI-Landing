import { afterEach, describe, expect, it, vi } from "vitest";

import { env } from "./env.js";
import { createOpenAIImageEdit, createOpenAIImageGeneration } from "./openai-image-worker.js";

const originalFetch = globalThis.fetch;
const originalOpenAIApiKey = env.openaiApiKey;
const originalModel = env.openaiCharacterReferenceModel;
const originalQuality = env.openaiCharacterReferenceQuality;
const originalSize = env.openaiCharacterReferenceSize;
const originalOutputFormat = env.openaiCharacterReferenceOutputFormat;

afterEach(() => {
  globalThis.fetch = originalFetch;
  env.openaiApiKey = originalOpenAIApiKey;
  env.openaiCharacterReferenceModel = originalModel;
  env.openaiCharacterReferenceQuality = originalQuality;
  env.openaiCharacterReferenceSize = originalSize;
  env.openaiCharacterReferenceOutputFormat = originalOutputFormat;
});

describe("openai image worker", () => {
  it("uses direct GPT Image 2 payload for character text-to-image", async () => {
    const requests: Array<{ body: unknown; url: string }> = [];
    env.openaiApiKey = "test-openai-key";
    env.openaiCharacterReferenceModel = "gpt-image-2";
    env.openaiCharacterReferenceQuality = "medium";
    env.openaiCharacterReferenceSize = "2048x2048";
    env.openaiCharacterReferenceOutputFormat = "png";
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        body: JSON.parse(String(init?.body ?? "{}")),
        url: input.toString(),
      });

      return new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("generated image").toString("base64") }],
          usage: { total_tokens: 123 },
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "x-request-id": "req-generation-1",
          },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = await createOpenAIImageGeneration({
      prompt: "professional character reference sheet",
    });

    expect(requests).toEqual([
      {
        body: {
          model: "gpt-image-2",
          n: 1,
          output_format: "png",
          prompt: "professional character reference sheet",
          quality: "medium",
          size: "2048x2048",
        },
        url: "https://api.openai.com/v1/images/generations",
      },
    ]);
    expect(result.bytes.toString()).toBe("generated image");
    expect(result.mimeType).toBe("image/png");
    expect(result.meta).toMatchObject({
      model: "gpt-image-2",
      outputFormat: "png",
      provider: "openai",
      quality: "medium",
      requestId: "req-generation-1",
      size: "2048x2048",
    });
  });

  it("uses direct GPT Image 2 multipart payload for character image edit", async () => {
    const requests: Array<{ body: FormData; contentType: string | undefined; url: string }> = [];
    env.openaiApiKey = "test-openai-key";
    env.openaiCharacterReferenceModel = "gpt-image-2";
    env.openaiCharacterReferenceQuality = "medium";
    env.openaiCharacterReferenceSize = "2048x2048";
    env.openaiCharacterReferenceOutputFormat = "png";
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        body: init?.body as FormData,
        contentType: (init?.headers as Record<string, string> | undefined)?.["Content-Type"],
        url: input.toString(),
      });

      return new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("edited image").toString("base64") }],
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "x-request-id": "req-edit-1",
          },
          status: 200,
        },
      );
    }) as typeof fetch;

    const result = await createOpenAIImageEdit({
      image: Buffer.from("source image"),
      imageFileName: "source.png",
      imageMimeType: "image/png",
      prompt: "preserve identity and build a character sheet",
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://api.openai.com/v1/images/edits");
    expect(requests[0].contentType).toBeUndefined();
    expect(requests[0].body.get("model")).toBe("gpt-image-2");
    expect(requests[0].body.get("quality")).toBe("medium");
    expect(requests[0].body.get("size")).toBe("2048x2048");
    expect(requests[0].body.get("output_format")).toBe("png");
    expect(requests[0].body.get("prompt")).toBe("preserve identity and build a character sheet");
    const sourceFile = requests[0].body.get("image[]");
    expect(sourceFile).toBeInstanceOf(File);
    expect((sourceFile as File).name).toBe("source.png");
    expect((sourceFile as File).type).toBe("image/png");
    expect(Buffer.from(await (sourceFile as File).arrayBuffer()).toString()).toBe("source image");
    expect(result.bytes.toString()).toBe("edited image");
    expect(result.meta.requestId).toBe("req-edit-1");
  });
});
