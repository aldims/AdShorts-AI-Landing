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
            job_id: "8d2c30ec-e96f-49e7-8fcb-81f44971748e",
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

    const job = await createStudioSegmentAiVideoJob("Camera pulls back", {
      email: "alex@example.test",
      name: "Alex",
    }, {
      imageAssetId: 9548,
      jobId: "8d2c30ec-e96f-49e7-8fcb-81f44971748e",
      language: "en",
      sceneReferenceAssetIds: [9548],
      segmentIndex: 1,
    });

    const request = calls.find((call) => call.pathname === "/api/web/segment-ai-video/jobs");
    expect(request?.body).toEqual(expect.objectContaining({
      image_asset_id: 9548,
      job_id: "8d2c30ec-e96f-49e7-8fcb-81f44971748e",
      scene_reference_asset_ids: [9548],
      segment_index: 1,
    }));
    expect(job.jobId).toBe("8d2c30ec-e96f-49e7-8fcb-81f44971748e");
  });

  it("preserves the measured AI video duration returned by AdsFlow", async () => {
    const { getStudioSegmentAiVideoJobStatus } = await loadStudioModule();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/segment-ai-video/jobs/job-duration") {
          return jsonResponse({
            asset: {
              duration_seconds: 4.042,
              file_name: "segment-ai-video.mp4",
              file_size: 1024,
              media_asset_id: 9642,
              mime_type: "video/mp4",
            },
            job_id: "job-duration",
            status: "done",
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

    const status = await getStudioSegmentAiVideoJobStatus("job-duration", {
      email: "alex@example.test",
      name: "Alex",
    });

    expect(status.asset).toMatchObject({
      assetId: 9642,
      durationSeconds: 4.042,
      fileName: "segment-ai-video.mp4",
    });
  });
});
