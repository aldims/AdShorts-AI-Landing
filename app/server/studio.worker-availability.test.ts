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
    expect(calls.find((call) => call.pathname === "/api/web/credits/refund")?.body).toEqual(
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
    expect(calls.find((call) => call.pathname === "/api/web/credits/refund")?.body).toEqual(
      expect.objectContaining({
        consumed_purchased: 10,
        consumed_subscription: 0,
      }),
    );
  });

  it("forwards manual segment timing aliases to AdsFlow generation", async () => {
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
              startTime: 0,
              text: "Manual opening scene",
              videoAction: "original",
            },
            {
              duration: 4,
              endTime: 14,
              index: 1,
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
        source_duration_seconds: 3.26,
        start_time: 0,
        startTime: 0,
        targetDurationSeconds: 10,
        target_duration_seconds: 10,
        timeline_duration_seconds: 10,
      }),
    );
    expect(segmentEditor?.segments?.[1]).toEqual(
      expect.objectContaining({
        duration: 4,
        durationSeconds: 4,
        duration_mode: "manual",
        duration_seconds: 4,
        end_time: 14,
        manual_duration_seconds: 4,
        start_time: 10,
        target_duration_seconds: 4,
        timeline_duration_seconds: 4,
      }),
    );
  });
});
