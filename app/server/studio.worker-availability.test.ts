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
            consumed: { purchased: 5, subscription: 0 },
            user: { balance: 95, plan: "PRO", user_id: "123" },
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
            refunded: { purchased: 5, subscription: 0 },
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
        consumed_purchased: 5,
        consumed_subscription: 0,
      }),
    );
  });
});
