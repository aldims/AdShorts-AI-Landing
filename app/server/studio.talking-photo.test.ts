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

describe("studio talking photo speaker confirmation", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("previews the selected speaker and forwards the confirmation token to job creation", async () => {
    const { createStudioSegmentTalkingPhotoJob } = await loadStudioModule();
    const calls: Array<{ body: Record<string, unknown>; pathname: string }> = [];
    const target = { height: 0.24, width: 0.18, x: 0.31, y: 0.22 };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        calls.push({ body, pathname: url.pathname });

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/segment-talking-photo/preview") {
          expect(body).toEqual(expect.objectContaining({
            admin_token: "admin-token",
            custom_video_asset_id: 123,
            external_user_id: "email:alexmamondi@gmail.com",
            speaker_target: target,
          }));
          return jsonResponse({
            confirmation_token: "v1.2000000000.preview-signature",
            overlay: {
              box: { height: 240, width: 180, x: 310, y: 220 },
              data_url: "data:image/jpeg;base64,ZmFrZQ==",
              height: 1000,
              mime_type: "image/jpeg",
              width: 1000,
            },
            source_asset_id: 321,
            source_media_type: "video",
            speaker_target: target,
          });
        }

        if (url.pathname === "/api/web/segment-talking-photo/jobs") {
          return jsonResponse({
            job_id: "talking-job-1",
            status: "queued",
            user: {
              balance: 50,
              plan: "START",
              start_plan_used: true,
              user_id: "8160048802147561000",
            },
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    const job = await createStudioSegmentTalkingPhotoJob("Hello from the selected speaker", {
      email: "alexmamondi@gmail.com",
      name: "Alex",
    }, {
      customVideoAssetId: 123,
      customVideoMediaType: "photo",
      durationSeconds: 6.48,
      language: "en",
      projectId: 3559,
      segmentIndex: 3,
      speakerTarget: target,
    });

    expect(job).toEqual(expect.objectContaining({
      jobId: "talking-job-1",
      status: "queued",
    }));
    const previewCall = calls.find((call) => call.pathname === "/api/web/segment-talking-photo/preview");
    const jobCall = calls.find((call) => call.pathname === "/api/web/segment-talking-photo/jobs");
    expect(previewCall).toBeTruthy();
    expect(jobCall?.body).toEqual(expect.objectContaining({
      custom_video_asset_id: 321,
      custom_video_media_type: "video",
      resolution: "480p",
      speaker_confirmation_token: "v1.2000000000.preview-signature",
      speaker_target: target,
    }));
    expect(jobCall?.body).not.toHaveProperty("custom_video_data_url");
  });

  it("uses a client-confirmed speaker token without silently creating a legacy job", async () => {
    const { createStudioSegmentTalkingPhotoJob } = await loadStudioModule();
    const calls: Array<{ body: Record<string, unknown>; pathname: string }> = [];
    const target = { height: 0.24, width: 0.18, x: 0.31, y: 0.22 };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        calls.push({ body, pathname: url.pathname });

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/segment-talking-photo/jobs") {
          return jsonResponse({
            job_id: "talking-job-2",
            status: "queued",
            user: {
              balance: 40,
              plan: "START",
              start_plan_used: true,
              user_id: "8160048802147561000",
            },
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    await createStudioSegmentTalkingPhotoJob("Hello from the confirmed speaker", {
      email: "alexmamondi@gmail.com",
    }, {
      customVideoAssetId: 123,
      customVideoMediaType: "photo",
      language: "en",
      projectId: 3559,
      segmentIndex: 3,
      speakerConfirmationToken: "v1.2000000000.client-signature",
      speakerTarget: target,
    });

    expect(calls.some((call) => call.pathname === "/api/web/segment-talking-photo/preview")).toBe(false);
    expect(calls.find((call) => call.pathname === "/api/web/segment-talking-photo/jobs")?.body).toEqual(
      expect.objectContaining({
        custom_video_asset_id: 123,
        speaker_confirmation_token: "v1.2000000000.client-signature",
        speaker_target: target,
      }),
    );
  });
});
