import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadStudioModule = async () => {
  vi.resetModules();
  vi.stubEnv("ADSFLOW_API_BASE_URL", "https://adsflow.test");
  vi.stubEnv("ADSFLOW_ADMIN_TOKEN", "admin-token");
  vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
  return import("./studio.js");
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status,
  });

describe("studio AI video source image", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("forwards the extracted scene frame asset as the direct i2v source", async () => {
    const { createStudioSegmentAiVideoJob } = await loadStudioModule();
    const calls: Array<{ body: Record<string, unknown>; pathname: string }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        calls.push({ body, pathname: url.pathname });

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/segment-ai-video/jobs") {
          return jsonResponse({
            job_id: "ai-video-direct-i2v-1",
            status: "queued",
            user: {
              balance: 30,
              plan: "FREE",
              user_id: "8160048802147561000",
            },
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    await createStudioSegmentAiVideoJob("Camera pulls back", {
      email: "alex@example.test",
      name: "Alex",
    }, {
      imageAssetId: 9548,
      language: "en",
      sceneReferenceAssetIds: [9548],
      segmentIndex: 1,
    });

    const request = calls.find((call) => call.pathname === "/api/web/segment-ai-video/jobs");
    expect(request?.body).toEqual(expect.objectContaining({
      image_asset_id: 9548,
      scene_reference_asset_ids: [9548],
      segment_index: 1,
    }));
  });
});
