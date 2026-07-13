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

const adsflowHealthyPayload = {
  components: {
    database: "healthy",
    redis: "healthy",
    task_queue: { status: "healthy" },
    workers: { online_count: 1, status: "healthy" },
  },
  status: "healthy",
};

describe("studio generation worker availability", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("reports unavailable when AdsFlow health has no online workers", async () => {
    const { getStudioGenerationAvailability } = await loadStudioModule();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          components: {
            database: "healthy",
            redis: "healthy",
            task_queue: { status: "healthy" },
            workers: { online_count: 0, status: "warning" },
          },
          status: "degraded",
        }, 503),
      ),
    );

    await expect(getStudioGenerationAvailability()).resolves.toEqual({
      available: false,
      reason: "adsflow_health_unavailable",
      status: "degraded",
      workersOnline: 0,
    });
  });

  it("treats failed AdsFlow health probes as indeterminate instead of unavailable", async () => {
    const { getStudioGenerationAvailability } = await loadStudioModule();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("The operation was aborted due to timeout");
      }),
    );

    await expect(getStudioGenerationAvailability()).resolves.toEqual({
      available: true,
      reason: "adsflow_health_check_indeterminate",
      status: null,
      workersOnline: null,
    });
  });

  it("does not consume credits when workers are unavailable before generation", async () => {
    const {
      STUDIO_GENERATION_UNAVAILABLE_MESSAGE,
      createStudioGenerationJob,
    } = await loadStudioModule();
    const paths: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        paths.push(url.pathname);

        if (url.pathname === "/health") {
          return jsonResponse({
            components: {
              database: "healthy",
              redis: "healthy",
              task_queue: { status: "healthy" },
              workers: { online_count: 0, status: "warning" },
            },
            status: "degraded",
          }, 503);
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    await expect(
      createStudioGenerationJob("A short video about focus", {
        email: "alex@example.test",
        name: "Alex",
      }, {
        language: "en",
      }),
    ).rejects.toThrow(STUDIO_GENERATION_UNAVAILABLE_MESSAGE);

    expect(paths).toEqual(["/health"]);
    expect(paths).not.toContain("/api/web/credits/consume");
  });

  it("refunds reserved credits when the health probe is indeterminate and enqueue is unavailable", async () => {
    const {
      STUDIO_GENERATION_UNAVAILABLE_MESSAGE,
      createStudioGenerationJob,
    } = await loadStudioModule();
    const calls: Array<{ body: Record<string, unknown>; pathname: string }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        calls.push({ body, pathname: url.pathname });

        if (url.pathname === "/health") {
          throw new Error("The operation was aborted due to timeout");
        }

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/credits/consume") {
          return jsonResponse({
            consumed: { purchased: 10, subscription: 0 },
            user: { balance: 90, plan: "PRO", user_id: "123" },
          });
        }

        if (url.pathname === "/api/web/generations") {
          return jsonResponse({ detail: "Generation workers are unavailable." }, 503);
        }

        if (url.pathname === "/api/web/credits/refund") {
          return jsonResponse({
            refunded: { purchased: 10, subscription: 0 },
            user: { balance: 100, plan: "PRO", user_id: "123" },
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    await expect(
      createStudioGenerationJob("A short video about focus", {
        email: "alex@example.test",
        name: "Alex",
      }, {
        language: "en",
      }),
    ).rejects.toThrow(STUDIO_GENERATION_UNAVAILABLE_MESSAGE);

    expect(calls.map((call) => call.pathname)).toContain("/api/web/credits/consume");
    expect(calls.map((call) => call.pathname)).toContain("/api/web/generations");
    expect(calls.map((call) => call.pathname)).toContain("/api/web/credits/refund");
    const consumeBody = calls.find((call) => call.pathname === "/api/web/credits/consume")?.body;
    const generationBody = calls.find((call) => call.pathname === "/api/web/generations")?.body;
    const refundBody = calls.find((call) => call.pathname === "/api/web/credits/refund")?.body;
    expect(consumeBody?.usage_event_key).toEqual(expect.stringMatching(/^usage:web-video-generation:/));
    expect(generationBody?.usage_event_key).toBe(consumeBody?.usage_event_key);
    expect(refundBody?.usage_event_key).toBe(`${consumeBody?.usage_event_key}:refund`);
    expect(refundBody).toEqual(
      expect.objectContaining({
        consumed_purchased: 10,
        consumed_subscription: 0,
      }),
    );
  });

  it("refunds reserved credits when AdsFlow cannot enqueue the created job", async () => {
    const {
      STUDIO_GENERATION_UNAVAILABLE_MESSAGE,
      createStudioGenerationJob,
    } = await loadStudioModule();
    const calls: Array<{ body: Record<string, unknown>; pathname: string }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        calls.push({ body, pathname: url.pathname });

        if (url.pathname === "/health") {
          return jsonResponse(adsflowHealthyPayload);
        }

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/credits/consume") {
          return jsonResponse({
            consumed: { purchased: 10, subscription: 0 },
            user: { balance: 90, plan: "PRO", user_id: "123" },
          });
        }

        if (url.pathname === "/api/web/generations") {
          return jsonResponse({
            enqueue_error: "Redis stream unavailable",
            job_id: "job-1",
            status: "queued",
          });
        }

        if (url.pathname === "/api/web/credits/refund") {
          return jsonResponse({
            refunded: { purchased: 10, subscription: 0 },
            user: { balance: 100, plan: "PRO", user_id: "123" },
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    await expect(
      createStudioGenerationJob("A short video about focus", {
        email: "alex@example.test",
        name: "Alex",
      }, {
        language: "en",
      }),
    ).rejects.toThrow(STUDIO_GENERATION_UNAVAILABLE_MESSAGE);

    expect(calls.map((call) => call.pathname)).toContain("/api/web/credits/consume");
    expect(calls.map((call) => call.pathname)).toContain("/api/web/credits/refund");
    const consumeBody = calls.find((call) => call.pathname === "/api/web/credits/consume")?.body;
    const generationBody = calls.find((call) => call.pathname === "/api/web/generations")?.body;
    const refundBody = calls.find((call) => call.pathname === "/api/web/credits/refund")?.body;
    expect(consumeBody?.usage_event_key).toEqual(expect.stringMatching(/^usage:web-video-generation:/));
    expect(generationBody?.usage_event_key).toBe(consumeBody?.usage_event_key);
    expect(refundBody?.job_id).toBe("job-1");
    expect(refundBody?.usage_event_key).toBe("usage:job-1:refund");
    expect(refundBody).toEqual(
      expect.objectContaining({
        consumed_purchased: 10,
        consumed_subscription: 0,
      }),
    );
  });

  it("keeps the watermark on FREE subscription-credit generations even when false is requested", async () => {
    const { createStudioGenerationJob } = await loadStudioModule();
    const calls: Array<{ body: Record<string, unknown>; pathname: string }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        calls.push({ body, pathname: url.pathname });

        if (url.pathname === "/health") {
          return jsonResponse(adsflowHealthyPayload);
        }

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/credits/consume") {
          return jsonResponse({
            consumed: { purchased: 0, subscription: 10 },
            user: { balance: 0, plan: "FREE", user_id: "123" },
          });
        }

        if (url.pathname === "/api/web/generations") {
          return jsonResponse({
            job_id: "job-free-watermark",
            status: "queued",
            title: "Free generation",
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    await expect(
      createStudioGenerationJob("A short video about focus", {
        email: "alex@example.test",
        name: "Alex",
      }, {
        addWatermark: false,
        language: "en",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        jobId: "job-free-watermark",
        status: "queued",
      }),
    );

    const consumeBody = calls.find((call) => call.pathname === "/api/web/credits/consume")?.body;
    const generationBody = calls.find((call) => call.pathname === "/api/web/generations")?.body;
    expect(consumeBody?.usage_event_key).toEqual(expect.stringMatching(/^usage:web-video-generation:/));
    expect(generationBody?.usage_event_key).toBe(consumeBody?.usage_event_key);
    expect(generationBody).toEqual(
      expect.objectContaining({
        add_watermark: true,
      }),
    );
  });

  it("forwards manual segment timing and scene sound changes to AdsFlow generation", async () => {
    const { createStudioGenerationJob } = await loadStudioModule();
    const calls: Array<{ body: Record<string, unknown>; pathname: string }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        calls.push({ body, pathname: url.pathname });

        if (url.pathname === "/health") {
          return jsonResponse(adsflowHealthyPayload);
        }

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/credits/consume") {
          return jsonResponse({
            consumed: { purchased: 10, subscription: 0 },
            user: { balance: 90, plan: "PRO", user_id: "123" },
          });
        }

        if (url.pathname === "/api/web/generations") {
          return jsonResponse({
            job_id: "job-manual-duration",
            status: "queued",
            title: "Manual segment edit",
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    await expect(
      createStudioGenerationJob("A short video about focus", {
        email: "alex@example.test",
        name: "Alex",
      }, {
        isRegeneration: true,
        language: "en",
        projectId: 42,
        segmentEditor: {
          projectId: 42,
          segments: [
            {
              duration: 10,
              durationExtensionSourceDurationSeconds: 3.26,
              durationMode: "manual",
              endTime: 10,
              index: 0,
              manualDurationSeconds: 10,
              sceneSoundRemoved: true,
              startTime: 0,
              text: "Manual opening scene",
              videoAction: "original",
            },
            {
              duration: 4,
              endTime: 14,
              index: 1,
              sceneSoundAssetId: 902,
              startTime: 10,
              text: "Second scene",
              videoAction: "original",
            },
          ],
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        jobId: "job-manual-duration",
        status: "queued",
      }),
    );

    const generationBody = calls.find((call) => call.pathname === "/api/web/generations")?.body;
    expect(generationBody).toEqual(
      expect.objectContaining({
        is_regeneration: true,
        project_id: 42,
      }),
    );

    const segmentEditor = generationBody?.segment_editor as {
      allowStructureChange?: boolean;
      allow_structure_change?: boolean;
      projectId?: number;
      project_id?: number;
      segments?: Array<Record<string, unknown>>;
    } | undefined;
    expect(segmentEditor).toEqual(
      expect.objectContaining({
        allowStructureChange: false,
        allow_structure_change: false,
        projectId: 42,
        project_id: 42,
      }),
    );
    expect(segmentEditor?.segments?.[0]).toEqual(
      expect.objectContaining({
        duration: 10,
        durationMode: "manual",
        durationSeconds: 10,
        duration_extension_source_duration_seconds: 3.26,
        duration_mode: "manual",
        duration_seconds: 10,
        end_time: 10,
        endTime: 10,
        manualDurationSeconds: 10,
        manual_duration_seconds: 10,
        scene_sound_removed: true,
        source_duration_seconds: 3.26,
        start_time: 0,
        startTime: 0,
        targetDurationSeconds: 10,
        target_duration_seconds: 10,
        timeline_duration_seconds: 10,
        effective_voice_type: "Liam_Timing",
      }),
    );
    expect(segmentEditor?.segments?.[0]).not.toHaveProperty("voice_type");
    expect(segmentEditor?.segments?.[1]).toEqual(
      expect.objectContaining({
        duration: 4,
        durationSeconds: 4,
        duration_mode: "manual",
        duration_seconds: 4,
        end_time: 14,
        manual_duration_seconds: 4,
        scene_sound_asset_id: 902,
        scene_sound_removed: false,
        start_time: 10,
        target_duration_seconds: 4,
        timeline_duration_seconds: 4,
        effective_voice_type: "Liam_Timing",
      }),
    );
    expect(segmentEditor?.segments?.[1]).not.toHaveProperty("voice_type");
  });

  it("forwards talking photo segment assets to AdsFlow generation", async () => {
    const { createStudioGenerationJob } = await loadStudioModule();
    const calls: Array<{ body: Record<string, unknown>; pathname: string }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        calls.push({ body, pathname: url.pathname });

        if (url.pathname === "/health") {
          return jsonResponse(adsflowHealthyPayload);
        }

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/credits/consume") {
          return jsonResponse({
            consumed: { purchased: 10, subscription: 0 },
            user: { balance: 90, plan: "PRO", user_id: "123" },
          });
        }

        if (url.pathname === "/api/web/generations") {
          return jsonResponse({
            job_id: "job-talking-photo-segment",
            status: "queued",
            title: "Talking photo segment",
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    await expect(
      createStudioGenerationJob("A short video about pancakes", {
        email: "alex@example.test",
        name: "Alex",
      }, {
        isRegeneration: true,
        language: "ru",
        projectId: 42,
        segmentEditor: {
          allowStructureChange: true,
          projectId: 42,
          segments: [
            {
              customVideoAssetId: 909,
              duration: 3.4,
              durationMode: "manual",
              endTime: 44.8,
              index: 7,
              manualDurationSeconds: 3.4,
              startTime: 41.4,
              text: "Попробуйте, это очень вкусно!",
              videoAction: "talking_photo",
              voiceType: "none",
            },
          ],
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        jobId: "job-talking-photo-segment",
        status: "queued",
      }),
    );

    const generationBody = calls.find((call) => call.pathname === "/api/web/generations")?.body;
    const segmentEditor = generationBody?.segment_editor as {
      segments?: Array<Record<string, unknown>>;
    } | undefined;

    expect(segmentEditor?.segments?.[0]).toEqual(
      expect.objectContaining({
        custom_video_asset_id: 909,
        effective_voice_type: "none",
        video_action: "talking_photo",
        voice_type: "none",
      }),
    );
    expect(calls.map((call) => call.pathname)).not.toContain("/api/web/media-assets/direct-upload/init");
  });

  it("forwards visual-only scratch segment asset ids to AdsFlow generation", async () => {
    const { createStudioGenerationJob } = await loadStudioModule();
    const calls: Array<{ body: Record<string, unknown>; pathname: string }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        calls.push({ body, pathname: url.pathname });

        if (url.pathname === "/health") {
          return jsonResponse(adsflowHealthyPayload);
        }

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/credits/consume") {
          return jsonResponse({
            consumed: { purchased: 5, subscription: 0 },
            user: { balance: 95, plan: "PRO", user_id: "123" },
          });
        }

        if (url.pathname === "/api/web/generations") {
          return jsonResponse({
            job_id: "job-visual-only-scratch",
            status: "queued",
            title: "Visual-only scratch",
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    await expect(
      createStudioGenerationJob("Create Shorts from the visual scenes in the editor.", {
        email: "alex@example.test",
        name: "Alex",
      }, {
        language: "ru",
        segmentEditor: {
          allowStructureChange: true,
          source: "scratch",
          segments: [
            {
              customVideoAssetId: 707,
              duration: 5,
              durationMode: "manual",
              endTime: 5,
              index: 0,
              manualDurationSeconds: 5,
              startTime: 0,
              text: "",
              videoAction: "custom",
              voiceType: "none",
            },
          ],
        },
        subtitleEnabled: false,
        videoMode: "standard",
        voiceEnabled: false,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        jobId: "job-visual-only-scratch",
        status: "queued",
      }),
    );

    const generationBody = calls.find((call) => call.pathname === "/api/web/generations")?.body;
    const segmentEditor = generationBody?.segment_editor as {
      segments?: Array<Record<string, unknown>>;
      source?: string;
    } | undefined;

    expect(segmentEditor).toEqual(
      expect.objectContaining({
        allow_structure_change: true,
        source: "scratch",
      }),
    );
    expect(segmentEditor?.segments?.[0]).toEqual(
      expect.objectContaining({
        custom_video_asset_id: 707,
        text: "",
        video_action: "custom",
        voice_type: "none",
      }),
    );
    expect(calls.map((call) => call.pathname)).not.toContain("/api/web/media-assets/direct-upload/init");
  });

  it("forwards visual-only top-level custom media without prompt text", async () => {
    const { createStudioGenerationJob } = await loadStudioModule();
    const calls: Array<{ body: Record<string, unknown>; pathname: string }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        calls.push({ body, pathname: url.pathname });

        if (url.pathname === "/health") {
          return jsonResponse(adsflowHealthyPayload);
        }

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/credits/consume") {
          return jsonResponse({
            consumed: { purchased: 10, subscription: 0 },
            user: { balance: 90, plan: "PRO", user_id: "123" },
          });
        }

        if (url.pathname === "/api/web/generations") {
          return jsonResponse({
            job_id: "job-visual-only-custom",
            status: "queued",
            title: "Visual-only custom",
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    await expect(
      createStudioGenerationJob("", {
        email: "alex@example.test",
        name: "Alex",
      }, {
        customVideoAssetId: 808,
        customVideoFileMimeType: "image/jpeg",
        customVideoFileName: "scene.jpg",
        language: "ru",
        subtitleEnabled: false,
        videoMode: "custom",
        voiceEnabled: false,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        jobId: "job-visual-only-custom",
        status: "queued",
      }),
    );

    const generationBody = calls.find((call) => call.pathname === "/api/web/generations")?.body;
    expect(generationBody).toEqual(
      expect.objectContaining({
        custom_video_asset_id: 808,
        custom_video_mime_type: "image/jpeg",
        custom_video_original_name: "scene.jpg",
        prompt: "",
        video_mode: "custom",
        voice_type: "none",
      }),
    );
    expect(generationBody).not.toHaveProperty("segment_editor");
    expect(calls.map((call) => call.pathname)).not.toContain("/api/web/media-assets/direct-upload/init");
  });
});
