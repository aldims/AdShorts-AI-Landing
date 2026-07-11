import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testDirectories: string[] = [];

const configureStudioTestEnv = () => {
  vi.stubEnv("ADSFLOW_API_BASE_URL", "https://adsflow.test");
  vi.stubEnv("ADSFLOW_ADMIN_TOKEN", "admin-token");
  vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
};

const loadStudioModule = async () => {
  vi.resetModules();
  configureStudioTestEnv();
  return import("./studio.js");
};

const loadStudioModuleWithDataDir = async (dataDir: string) => {
  vi.resetModules();
  configureStudioTestEnv();
  const { env } = await import("./env.js");
  env.dataDir = dataDir;
  return import("./studio.js");
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status,
  });

describe("studio scene sound jobs", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await Promise.all(testDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
  });

  it("requires a project id or explicit visual source before contacting AdsFlow", async () => {
    const { createStudioSegmentSceneSoundJob } = await loadStudioModule();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createStudioSegmentSceneSoundJob("quiet kitchen ambience", {
        email: "alex@example.test",
        name: "Alex",
      }, {
        language: "en",
        segmentIndex: 0,
      }),
    ).rejects.toThrow("Project id or visual source is required for scene sound generation.");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows a scratch scene sound job with an explicit visual asset", async () => {
    const { createStudioSegmentSceneSoundJob } = await loadStudioModule();
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

        if (url.pathname === "/api/web/segment-scene-sound/jobs") {
          return jsonResponse({
            job_id: "scratch-scene-sound-job-1",
            status: "queued",
            user: {
              balance: 11,
              plan: "FREE",
              user_id: "8160048802147561000",
            },
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    const job = await createStudioSegmentSceneSoundJob("quiet kitchen ambience", {
      email: "alex@example.test",
      name: "Alex",
    }, {
      durationSeconds: 5,
      language: "en",
      segmentIndex: 1,
      visualMediaAssetId: 909,
    });

    expect(job).toEqual(expect.objectContaining({
      jobId: "scratch-scene-sound-job-1",
      status: "queued",
    }));

    const sceneSoundCall = calls.find((call) => call.pathname === "/api/web/segment-scene-sound/jobs");
    expect(sceneSoundCall?.body).toEqual(
      expect.objectContaining({
        credit_cost: 2,
        segment_index: 1,
        visual_media_asset_id: 909,
      }),
    );
    expect(sceneSoundCall?.body).not.toHaveProperty("project_id");
  });

  it("forwards project id and visual source data to AdsFlow", async () => {
    const { createStudioSegmentSceneSoundJob } = await loadStudioModule();
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

        if (url.pathname === "/api/web/segment-scene-sound/jobs") {
          return jsonResponse({
            job_id: "scene-sound-job-1",
            status: "queued",
            user: {
              balance: 12,
              plan: "FREE",
              user_id: "8160048802147561000",
            },
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    const job = await createStudioSegmentSceneSoundJob("quiet kitchen ambience", {
      email: "alex@example.test",
      name: "Alex",
    }, {
      durationSeconds: 7,
      language: "en",
      projectId: 3576,
      segmentIndex: 0,
      visualMediaAssetId: 909,
      visualSourceJobId: "talking-job-1",
      visualSourceKind: "segment-talking-photo",
    });

    expect(job).toEqual(expect.objectContaining({
      jobId: "scene-sound-job-1",
      status: "queued",
    }));
    expect(calls.find((call) => call.pathname === "/api/web/segment-scene-sound/jobs")?.body).toEqual(
      expect.objectContaining({
        credit_cost: 4,
        project_id: 3576,
        segment_index: 0,
        visual_media_asset_id: 909,
        visual_source_job_id: "talking-job-1",
        visual_source_kind: "segment-talking-photo",
      }),
    );
  });
});

describe("studio segment voiceover jobs", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("allows a draft segment voiceover without a project id", async () => {
    const { createStudioSegmentVoiceoverJob } = await loadStudioModule();
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

        if (url.pathname === "/api/web/segment-voiceover/jobs") {
          return jsonResponse({
            job_id: "segment-voiceover-draft-job-1",
            status: "queued",
            user: {
              balance: 7,
              plan: "FREE",
              user_id: "8160048802147561000",
            },
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    const job = await createStudioSegmentVoiceoverJob("Subscribe to the channel", {
      email: "alex@example.test",
      name: "Alex",
    }, {
      language: "en",
      segmentIndex: 0,
      voiceType: "Boris",
    });

    expect(job).toEqual(expect.objectContaining({
      jobId: "segment-voiceover-draft-job-1",
      status: "queued",
    }));
    expect(calls.find((call) => call.pathname === "/api/web/segment-voiceover/jobs")?.body).toEqual(
      expect.objectContaining({
        admin_token: "admin-token",
        external_user_id: "email:alex@example.test",
        language: "en",
        segment_index: 0,
        text: "Subscribe to the channel",
        credit_cost: 1,
        voice_type: "Liam_Timing",
      }),
    );
    expect(calls.find((call) => call.pathname === "/api/web/segment-voiceover/jobs")?.body).not.toHaveProperty("project_id");
  });

  it("requires text and a real voice before contacting AdsFlow", async () => {
    const { createStudioSegmentVoiceoverJob } = await loadStudioModule();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createStudioSegmentVoiceoverJob("", {
        email: "alex@example.test",
        name: "Alex",
      }, {
        language: "en",
        projectId: 3576,
        segmentIndex: 0,
        voiceType: "Boris",
      }),
    ).rejects.toThrow("Voiceover text is required.");

    await expect(
      createStudioSegmentVoiceoverJob("Subscribe to the channel", {
        email: "alex@example.test",
        name: "Alex",
      }, {
        language: "en",
        projectId: 3576,
        segmentIndex: 0,
        voiceType: "none",
      }),
    ).rejects.toThrow("Voice type is required for segment voiceover generation.");

    await expect(
      createStudioSegmentVoiceoverJob("x".repeat(201), {
        email: "alex@example.test",
        name: "Alex",
      }, {
        language: "ru",
        projectId: 3576,
        segmentIndex: 0,
        voiceType: "Liam_Timing",
      }),
    ).rejects.toThrow("must not exceed 200 characters");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards credit cost and segment voiceover payload to AdsFlow", async () => {
    const { createStudioSegmentVoiceoverJob } = await loadStudioModule();
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

        if (url.pathname === "/api/web/segment-voiceover/jobs") {
          return jsonResponse({
            job_id: "segment-voiceover-job-1",
            status: "queued",
            user: {
              balance: 7,
              plan: "FREE",
              user_id: "8160048802147561000",
            },
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    const voiceoverText = "x".repeat(157);
    const job = await createStudioSegmentVoiceoverJob(voiceoverText, {
      email: "alex@example.test",
      name: "Alex",
    }, {
      language: "ru",
      projectId: 3576,
      segmentIndex: 4,
      voiceType: "Liam",
    });

    expect(job).toEqual(expect.objectContaining({
      jobId: "segment-voiceover-job-1",
      status: "queued",
    }));
    expect(calls.find((call) => call.pathname === "/api/web/segment-voiceover/jobs")?.body).toEqual(
      expect.objectContaining({
        admin_token: "admin-token",
        credit_cost: 2,
        external_user_id: "email:alex@example.test",
        language: "ru",
        project_id: 3576,
        segment_index: 4,
        text: voiceoverText,
        voice_type: "Liam_Timing",
      }),
    );
  });

  it("forwards one project voiceover job with scene texts and one voiceover credit cost", async () => {
    const { createStudioProjectVoiceoverJob } = await loadStudioModule();
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

        if (url.pathname === "/api/web/project-voiceover/jobs") {
          return jsonResponse({
            job_id: "project-voiceover-job-1",
            status: "queued",
            user: {
              balance: 12,
              plan: "FREE",
              user_id: "8160048802147561000",
            },
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    const job = await createStudioProjectVoiceoverJob("First scene Second scene", {
      email: "alex@example.test",
      name: "Alex",
    }, {
      language: "ru",
      projectId: 3657,
      segments: [
        { segmentIndex: 0, targetDurationSeconds: 3.5, text: "First scene" },
        { segmentIndex: 1, targetDurationSeconds: 4.1, text: "Second scene" },
      ],
      voiceType: "Liam",
    });

    expect(job).toEqual(expect.objectContaining({
      jobId: "project-voiceover-job-1",
      status: "queued",
    }));
    expect(calls.find((call) => call.pathname === "/api/web/project-voiceover/jobs")?.body).toEqual(
      expect.objectContaining({
        admin_token: "admin-token",
        credit_cost: 1,
        external_user_id: "email:alex@example.test",
        language: "ru",
        persist_as_segment_assets: true,
        project_id: 3657,
        text: "First scene Second scene",
        voice_type: "Liam_Timing",
      }),
    );
    expect(calls.find((call) => call.pathname === "/api/web/project-voiceover/jobs")?.body.segments).toEqual([
      {
        duration: 3.5,
        segment_index: 0,
        target_duration: 3.5,
        text: "First scene",
      },
      {
        duration: 4.1,
        segment_index: 1,
        target_duration: 4.1,
        text: "Second scene",
      },
    ]);
  });

  it("uses the durable media proxy for native batch voiceover segment assets", async () => {
    const { createStudioBatchVoiceoverJob, getStudioBatchVoiceoverJobStatus } = await loadStudioModule();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/voiceover/batch-jobs") {
          return jsonResponse({
            job_id: "batch-job-1",
            status: "queued",
            user: { balance: 11, plan: "FREE", user_id: "8160048802147561000" },
          });
        }

        if (url.pathname === "/api/web/voiceover/batch-jobs/batch-job-1") {
          return jsonResponse({
            job_id: "batch-job-1",
            segments: [
              {
                asset: {
                  download_url: "https://storage.example.test/signed-segment.wav",
                  file_name: "scene-5.wav",
                  media_asset_id: 8740,
                  mime_type: "audio/wav",
                },
                job_id: "project-voiceover-child-job",
                language: "ru",
                segment_index: 4,
                speech_duration: 3.96,
                status: "done",
                text: "Последняя сцена.",
                voice_source_duration: 3.971,
                voice_type: "Liam_Timing",
              },
            ],
            status: "done",
            user: { balance: 11, plan: "FREE", user_id: "8160048802147561000" },
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    const job = await createStudioBatchVoiceoverJob({ email: "alex@example.test", name: "Alex" }, {
      groups: [
        {
          language: "ru",
          segments: [{ segmentIndex: 4, targetDurationSeconds: 6.051, text: "Последняя сцена." }],
          voiceType: "Liam_Timing",
        },
      ],
      projectId: 4178,
    });
    const status = await getStudioBatchVoiceoverJobStatus(job.jobId, {
      email: "alex@example.test",
      name: "Alex",
    });

    expect(status.status).toBe("done");
    expect(status.segments[0]?.asset).toEqual(expect.objectContaining({
      assetId: 8740,
      remoteUrl: "/api/workspace/media-assets/8740",
    }));
  });

  it("does not apply a whole-project voiceover segment as the first scene in fallback batch jobs", async () => {
    const { createStudioBatchVoiceoverJob, getStudioBatchVoiceoverJobStatus } = await loadStudioModule();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/voiceover/batch-jobs") {
          return jsonResponse({ detail: "not found" }, 404);
        }

        if (url.pathname === "/api/web/project-voiceover/jobs") {
          return jsonResponse({
            job_id: "project-voiceover-job-1",
            status: "queued",
            user: {
              balance: 12,
              plan: "FREE",
              user_id: "8160048802147561000",
            },
          });
        }

        if (url.pathname === "/api/web/project-voiceover/jobs/project-voiceover-job-1") {
          return jsonResponse({
            asset: {
              file_name: "whole-video.wav",
              media_asset_id: 902,
              mime_type: "audio/wav",
            },
            job_id: "project-voiceover-job-1",
            segments: [
              {
                segment_index: 0,
                speech_duration: 31.5,
                speech_end_time: 31.5,
                speech_start_time: 0,
                text: "Scene one Scene two",
              },
            ],
            status: "completed",
            user: {
              balance: 12,
              plan: "FREE",
              user_id: "8160048802147561000",
            },
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    const job = await createStudioBatchVoiceoverJob({
      email: "alex@example.test",
      name: "Alex",
    }, {
      groups: [
        {
          language: "ru",
          segments: [
            { segmentIndex: 0, targetDurationSeconds: 7.9, text: "Scene one" },
            { segmentIndex: 1, targetDurationSeconds: 5, text: "Scene two" },
          ],
          voiceType: "Liam",
        },
      ],
      projectId: 3657,
    });

    const status = await getStudioBatchVoiceoverJobStatus(job.jobId, {
      email: "alex@example.test",
      name: "Alex",
    });

    expect(status.status).not.toBe("done");
    expect(status.segments).toEqual([
      expect.objectContaining({
        asset: undefined,
        segmentIndex: 0,
        speechDuration: null,
        speechEndTime: null,
        speechStartTime: null,
        text: "Scene one",
      }),
      expect.objectContaining({
        asset: undefined,
        segmentIndex: 1,
        speechDuration: null,
        speechEndTime: null,
        speechStartTime: null,
        text: "Scene two",
      }),
    ]);
  });

  it("restores fallback batch voiceover jobs after a server module reload", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "adshorts-batch-voiceover-"));
    testDirectories.push(dataDir);
    const calls: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const method = String(init?.method ?? "GET").toUpperCase();
        calls.push(`${method} ${url.pathname}`);

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (method === "POST" && url.pathname === "/api/web/voiceover/batch-jobs") {
          return jsonResponse({ detail: "not found" }, 404);
        }

        if (method === "POST" && url.pathname === "/api/web/project-voiceover/jobs") {
          return jsonResponse({
            job_id: "project-voiceover-job-1",
            status: "queued",
            user: {
              balance: 12,
              plan: "FREE",
              user_id: "8160048802147561000",
            },
          });
        }

        if (method === "GET" && url.pathname === "/api/web/project-voiceover/jobs/project-voiceover-job-1") {
          return jsonResponse({
            asset: {
              file_name: "project-voiceover.wav",
              media_asset_id: 902,
              mime_type: "audio/wav",
            },
            job_id: "project-voiceover-job-1",
            segments: [
              {
                asset: {
                  file_name: "segment-voiceover-1.wav",
                  media_asset_id: 903,
                  mime_type: "audio/wav",
                  remote_url: "https://cdn.example.test/segment-voiceover-1.wav",
                },
                segment_index: 0,
                speech_duration: 3.5,
                speech_end_time: 3.5,
                speech_start_time: 0,
                text: "Scene one",
              },
              {
                asset: {
                  file_name: "segment-voiceover-2.wav",
                  media_asset_id: 904,
                  mime_type: "audio/wav",
                  remote_url: "https://cdn.example.test/segment-voiceover-2.wav",
                },
                segment_index: 1,
                speech_duration: 4.1,
                speech_end_time: 7.6,
                speech_start_time: 3.5,
                text: "Scene two",
              },
            ],
            status: "completed",
            user: {
              balance: 12,
              plan: "FREE",
              user_id: "8160048802147561000",
            },
          });
        }

        if (method === "GET" && url.pathname.startsWith("/api/web/voiceover/batch-jobs/")) {
          return jsonResponse({ detail: "batch status unavailable" }, 404);
        }

        return jsonResponse({ detail: `unexpected ${method} ${url.pathname}` }, 500);
      }),
    );

    const firstStudio = await loadStudioModuleWithDataDir(dataDir);
    const job = await firstStudio.createStudioBatchVoiceoverJob({
      email: "alex@example.test",
      name: "Alex",
    }, {
      groups: [
        {
          language: "ru",
          segments: [
            { segmentIndex: 0, targetDurationSeconds: 3.5, text: "Scene one" },
            { segmentIndex: 1, targetDurationSeconds: 4.1, text: "Scene two" },
          ],
          voiceType: "Liam",
        },
      ],
      projectId: 3657,
    });

    expect(job.jobId).toMatch(/^voiceover-batch-/);

    const secondStudio = await loadStudioModuleWithDataDir(dataDir);
    const status = await secondStudio.getStudioBatchVoiceoverJobStatus(job.jobId, {
      email: "alex@example.test",
      name: "Alex",
    });

    expect(status.status).toBe("done");
    expect(status.segments).toEqual([
      expect.objectContaining({
        asset: expect.objectContaining({
          assetId: 903,
        }),
        segmentIndex: 0,
        text: "Scene one",
      }),
      expect.objectContaining({
        asset: expect.objectContaining({
          assetId: 904,
        }),
        segmentIndex: 1,
        text: "Scene two",
      }),
    ]);
    expect(calls.some((call) => call === `GET /api/web/voiceover/batch-jobs/${job.jobId}`)).toBe(false);
  });

  it("normalizes speech metadata from AdsFlow status responses", async () => {
    const { getStudioSegmentVoiceoverJobStatus } = await loadStudioModule();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/segment-voiceover/jobs/segment-voiceover-job-1") {
          return jsonResponse({
            asset: {
              file_name: "scene-voice.wav",
              media_asset_id: 901,
              mime_type: "audio/wav",
            },
            job_id: "segment-voiceover-job-1",
            speech_end_time: "3.25",
            speech_start_time: "0.25",
            speech_words: [
              { confidence: "0.93", end_time: "0.9", start_time: "0.25", text: "Subscribe" },
              { confidence: "0.9", end_time: "0.8", start_time: "0.9", text: "bad" },
            ],
            status: "completed",
            user: {
              balance: 7,
              plan: "FREE",
              user_id: "8160048802147561000",
            },
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    const status = await getStudioSegmentVoiceoverJobStatus("segment-voiceover-job-1", {
      email: "alex@example.test",
      name: "Alex",
    });

    expect(status).toEqual(expect.objectContaining({
      jobId: "segment-voiceover-job-1",
      speechDuration: 3,
      speechEndTime: 3.25,
      speechStartTime: 0.25,
      status: "completed",
    }));
    expect(status.asset).toEqual(expect.objectContaining({
      assetId: 901,
      fileName: "scene-voice.wav",
      mimeType: "audio/wav",
      remoteUrl: "/api/studio/segment-voiceover/jobs/segment-voiceover-job-1/audio",
    }));
    expect(status.speechWords).toEqual([
      {
        confidence: 0.93,
        endTime: 0.9,
        startTime: 0.25,
        text: "Subscribe",
      },
    ]);
  });

  it("keeps batch voiceover processing until every segment has an asset", async () => {
    const { getStudioBatchVoiceoverJobStatus } = await loadStudioModule();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));

        if (url.pathname.startsWith("/api/admin/users")) {
          return jsonResponse({ items: [] });
        }

        if (url.pathname === "/api/web/voiceover/batch-jobs/batch-voiceover-job-1") {
          return jsonResponse({
            job_id: "batch-voiceover-job-1",
            segments: [
              {
                job_id: "project-voiceover-child-1",
                language: "ru",
                segment_index: 0,
                speech_duration: 3.4,
                speech_end_time: 3.6,
                speech_start_time: 0.2,
                status: "done",
                text: "Первая сцена",
                voice_source_duration: 3.7,
                voice_source_end_time: 3.7,
                voice_source_start_time: 0,
                voice_type: "Liam",
              },
            ],
            status: "done",
            user: {
              balance: 7,
              plan: "FREE",
              start_plan_used: true,
              user_id: "8160048802147561000",
            },
          });
        }

        return jsonResponse({ detail: `unexpected ${url.pathname}` }, 500);
      }),
    );

    const status = await getStudioBatchVoiceoverJobStatus("batch-voiceover-job-1", {
      email: "alex@example.test",
      name: "Alex",
    });

    expect(status.status).toBe("processing");
    expect(status.segments).toEqual([
      expect.objectContaining({
        asset: undefined,
        jobId: "project-voiceover-child-1",
        segmentIndex: 0,
        speechDuration: 3.4,
        speechEndTime: 3.6,
        speechStartTime: 0.2,
        status: "done",
        voiceSourceDuration: 3.7,
        voiceSourceEndTime: 3.7,
        voiceSourceStartTime: 0,
      }),
    ]);
  });
});
