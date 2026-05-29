import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const loadStudioModule = async () => {
  vi.resetModules();
  vi.stubEnv("ADSFLOW_API_BASE_URL", "https://adsflow.test");
  vi.stubEnv("ADSFLOW_ADMIN_TOKEN", "admin-token");
  vi.stubEnv("AUTH_DATABASE_PATH", join(tmpdir(), `adshorts-status-${Date.now()}-${Math.random()}.sqlite`));
  vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
  return import("./studio.js");
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status,
  });

describe("studio final video status", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns a ready generation when AdsFlow finishes without download_path but project media has final video", async () => {
    const { getStudioGenerationStatus } = await loadStudioModule();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));

        if (url.pathname === "/api/web/generations/job-media-only") {
          return jsonResponse({
            ad_id: 3643,
            generated_at: "2026-05-29T19:00:00.000Z",
            job_id: "job-media-only",
            status: "done",
          });
        }

        if (url.pathname === "/api/projects/3643/media") {
          return jsonResponse({
            assets: [
              {
                download_path: "/api/media/4433/download",
                id: 4433,
                kind: "final_video",
                media_type: "video",
                mime_type: "video/mp4",
                role: "final_video",
                status: "ready",
                storage_key: "users/1/assets/4433/final_video/4433-web_video_job-media-only.mp4",
              },
            ],
            project_id: 3643,
          });
        }

        if (url.pathname === "/api/media/4433/download") {
          return new Response(new Uint8Array([0, 0, 0, 0]), {
            headers: {
              "Content-Length": "4",
              "Content-Type": "video/mp4",
            },
            status: 200,
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    const status = await getStudioGenerationStatus("job-media-only", {
      email: "media-only@example.test",
      name: "Media Only",
    });

    const fallbackUrl = new URL(status.generation?.videoFallbackUrl ?? "", "http://localhost");

    expect(status.status).toBe("done");
    expect(status.generation?.finalAsset?.downloadPath).toBe("/api/media/4433/download");
    expect(fallbackUrl.searchParams.get("path")).toBe("https://adsflow.test/api/media/4433/download");

    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it("resolves a done latest generation during workspace bootstrap when only project media has the final video", async () => {
    const { getWorkspaceBootstrap } = await loadStudioModule();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));

        if (url.pathname === "/api/web/bootstrap") {
          return jsonResponse({
            latest_generation: {
              ad_id: 3643,
              generated_at: "2026-05-29T19:00:00.000Z",
              job_id: "bootstrap-media-only",
              status: "done",
              task_type: "video.generate",
            },
            studio_options: {},
            user: {
              balance: 10,
              plan: "START",
              start_plan_used: true,
              user_id: 123,
            },
          });
        }

        if (url.pathname === "/api/web/generations/bootstrap-media-only") {
          return jsonResponse({
            ad_id: 3643,
            generated_at: "2026-05-29T19:00:00.000Z",
            job_id: "bootstrap-media-only",
            status: "done",
            task_type: "video.generate",
          });
        }

        if (url.pathname === "/api/projects/3643/media") {
          return jsonResponse({
            assets: [
              {
                download_path: "/api/media/4433/download",
                id: 4433,
                kind: "final_video",
                media_type: "video",
                mime_type: "video/mp4",
                role: "final_video",
                status: "ready",
                storage_key: "users/1/assets/4433/final_video/4433-web_video_bootstrap-media-only.mp4",
              },
            ],
            project_id: 3643,
          });
        }

        if (url.pathname === "/api/media/4433/download") {
          return new Response(new Uint8Array([0, 0, 0, 0]), {
            headers: {
              "Content-Length": "4",
              "Content-Type": "video/mp4",
            },
            status: 200,
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    const bootstrap = await getWorkspaceBootstrap({
      id: "bootstrap-user",
      name: "Bootstrap User",
    });

    const latestGeneration = bootstrap.latestGeneration;

    expect(latestGeneration?.status).toBe("done");
    expect(latestGeneration?.generation?.id).toBe("bootstrap-media-only");
    expect(latestGeneration?.generation?.finalAsset?.downloadPath).toBe("/api/media/4433/download");

    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});
