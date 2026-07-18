// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createStudioDurableGeneratedVisualAsset,
  ensureStudioDurableGeneratedVisualAsset,
  ensureStudioUploadedAssetIdWithInlineFallback,
  extractStudioUploadedVideoAudio,
  resolveWorkspaceVideoReferenceFrameTime,
} from "./workspace-upload-helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ensureStudioUploadedAssetIdWithInlineFallback", () => {
  it("aborts an incomplete direct upload and returns inline data when storage PUT fails", async () => {
    const sourceDataUrl = "data:image/png;base64,AQID";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === sourceDataUrl) {
        return new Response(Uint8Array.from([1, 2, 3]), {
          headers: {
            "content-type": "image/png",
          },
        });
      }

      if (url === "/api/studio/media-upload/init") {
        return Response.json({
          data: {
            asset: {
              id: 77,
            },
            upload: {
              method: "PUT",
              url: "https://storage.example/upload",
            },
          },
        });
      }

      if (url === "https://storage.example/upload") {
        throw new TypeError("Failed to fetch");
      }

      if (url === "/api/studio/media-upload/abort") {
        return Response.json({
          data: {
            asset_id: 77,
            status: "aborted",
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      ensureStudioUploadedAssetIdWithInlineFallback(
        {
          dataUrl: sourceDataUrl,
          fileName: "frame.png",
          mimeType: "image/png",
        },
        {
          fallbackFileName: "frame.png",
          kind: "segment_source",
          language: "ru",
          mediaType: "photo",
          role: "segment_source",
        },
      ),
    ).resolves.toEqual({
      assetId: null,
      dataUrl: sourceDataUrl,
    });

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      sourceDataUrl,
      "/api/studio/media-upload/init",
      "https://storage.example/upload",
      "/api/studio/media-upload/abort",
    ]);
  });

  it("uses objectUrl as inline fallback when storage upload fails", async () => {
    const objectUrl = "blob:http://127.0.0.1/generated-video";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === objectUrl) {
        return new Response(Uint8Array.from([1, 2, 3]), {
          headers: {
            "content-type": "video/mp4",
          },
        });
      }

      if (url === "/api/studio/media-upload/init") {
        return Response.json({
          data: {
            asset: {
              id: 88,
            },
            upload: {
              method: "PUT",
              url: "https://storage.example/video-upload",
            },
          },
        });
      }

      if (url === "https://storage.example/video-upload") {
        throw new TypeError("Failed to fetch");
      }

      if (url === "/api/studio/media-upload/abort") {
        return Response.json({
          data: {
            asset_id: 88,
            status: "aborted",
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      ensureStudioUploadedAssetIdWithInlineFallback(
        {
          fileName: "talking-photo.mp4",
          mimeType: "video/mp4",
          objectUrl,
        },
        {
          fallbackFileName: "talking-photo.mp4",
          kind: "segment_generated",
          language: "ru",
          mediaType: "video",
          role: "segment_generated",
        },
      ),
    ).resolves.toEqual({
      assetId: null,
      dataUrl: "data:video/mp4;base64,AQID",
    });

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      objectUrl,
      "/api/studio/media-upload/init",
      "https://storage.example/video-upload",
      "/api/studio/media-upload/abort",
      objectUrl,
    ]);
  });
});

describe("createStudioDurableGeneratedVisualAsset", () => {
  it("replaces transient generated video sources with durable media routes", () => {
    const file = new File([Uint8Array.from([1, 2, 3])], "generated.mp4", { type: "video/mp4" });

    expect(createStudioDurableGeneratedVisualAsset({
      dataUrl: "data:video/mp4;base64,AQID",
      durationSeconds: 5,
      file,
      fileName: "generated.mp4",
      fileSize: 3,
      mimeType: "video/mp4",
      objectUrl: "blob:http://127.0.0.1/generated-video",
      posterUrl: "/api/studio/segment-ai-video/jobs/job-1/poster",
      remoteUrl: "/api/studio/segment-ai-video/jobs/job-1/video",
    }, 741, "video")).toEqual({
      assetId: 741,
      dataUrl: undefined,
      durationSeconds: 5,
      file: undefined,
      fileName: "generated.mp4",
      fileSize: 3,
      mimeType: "video/mp4",
      objectUrl: undefined,
      posterUrl: "/api/workspace/media-assets/741/poster",
      remoteUrl: "/api/workspace/media-assets/741/playback",
      source: "media-library",
    });
  });

  it("uses the durable raw media route for generated photos", () => {
    expect(createStudioDurableGeneratedVisualAsset({
      dataUrl: "data:image/png;base64,AQID",
      fileName: "generated.png",
      fileSize: 3,
      mimeType: "image/png",
      remoteUrl: "/api/studio/segment-ai-photo/jobs/job-2/image",
    }, 742, "photo")).toMatchObject({
      assetId: 742,
      dataUrl: undefined,
      posterUrl: undefined,
      remoteUrl: "/api/workspace/media-assets/742",
      source: "media-library",
    });
  });
});

describe("ensureStudioDurableGeneratedVisualAsset", () => {
  it("uses an existing generated asset without trying to publish it again", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureStudioDurableGeneratedVisualAsset({
      assetId: 744,
      fileName: "generated.png",
      fileSize: 3,
      mimeType: "image/png",
      remoteUrl: "/api/workspace/media-assets/744",
    }, {
      fallbackFileName: "generated.png",
      kind: "segment_generated",
      language: "ru",
      mediaType: "photo",
      projectId: 91,
      role: "segment_generated",
      segmentIndex: 1,
    })).resolves.toMatchObject({
      assetId: 744,
      remoteUrl: "/api/workspace/media-assets/744",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("materializes a transient generated video before returning it to the editor", async () => {
    const transientUrl = "/api/studio/segment-ai-video/jobs/job-3/video";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === transientUrl) {
        return new Response(Uint8Array.from([1, 2, 3]), {
          headers: { "content-type": "video/mp4" },
        });
      }

      if (url === "/api/studio/media-upload/init") {
        return Response.json({
          data: {
            asset: { id: 743 },
            upload: { method: "PUT", url: "https://storage.example/generated-video" },
          },
        });
      }

      if (url === "https://storage.example/generated-video") {
        return new Response(null, { status: 200 });
      }

      if (url === "/api/studio/media-upload/complete") {
        return Response.json({ data: { asset: { id: 743 } } });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureStudioDurableGeneratedVisualAsset({
      fileName: "generated.mp4",
      fileSize: 0,
      mimeType: "video/mp4",
      posterUrl: "/api/studio/segment-ai-video/jobs/job-3/poster",
      remoteUrl: transientUrl,
    }, {
      fallbackFileName: "generated.mp4",
      kind: "segment_generated",
      language: "ru",
      mediaType: "video",
      projectId: 91,
      role: "segment_generated",
      segmentIndex: 1,
    })).resolves.toMatchObject({
      assetId: 743,
      posterUrl: "/api/workspace/media-assets/743/poster",
      remoteUrl: "/api/workspace/media-assets/743/playback",
      source: "media-library",
    });

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      transientUrl,
      "/api/studio/media-upload/init",
      "https://storage.example/generated-video",
      "/api/studio/media-upload/complete",
    ]);
  });
});

describe("extractStudioUploadedVideoAudio", () => {
  it("returns a durable scene sound asset when the uploaded video contains audio", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      data: {
        asset: {
          assetId: 981,
          fileName: "camera-audio.m4a",
          fileSize: 4096,
          mimeType: "audio/mp4",
          remoteUrl: "/api/workspace/media-assets/981/playback",
        },
        hasAudio: true,
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(extractStudioUploadedVideoAudio({
      fileName: "camera.mp4",
      language: "ru",
      projectId: 72,
      segmentIndex: 3,
      sourceAssetId: 980,
    })).resolves.toEqual({
      assetId: 981,
      fileName: "camera-audio.m4a",
      fileSize: 4096,
      mimeType: "audio/mp4",
      remoteUrl: "/api/workspace/media-assets/981/playback",
      source: "media-library",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/studio/media-upload/extract-audio",
      expect.objectContaining({
        body: JSON.stringify({
          fileName: "camera.mp4",
          language: "ru",
          projectId: 72,
          segmentIndex: 3,
          sourceAssetId: 980,
        }),
        method: "POST",
      }),
    );
  });

  it("does not create a scene sound asset for a silent video", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      data: {
        asset: null,
        hasAudio: false,
      },
    })));

    await expect(extractStudioUploadedVideoAudio({
      fileName: "silent.mp4",
      language: "en",
      segmentIndex: 0,
      sourceAssetId: 982,
    })).resolves.toBeNull();
  });
});

describe("resolveWorkspaceVideoReferenceFrameTime", () => {
  it("uses a frame 0.25 seconds before the end for scene continuity", () => {
    expect(resolveWorkspaceVideoReferenceFrameTime(8, { seekFromEndSeconds: 0.25 })).toBe(7.75);
  });

  it("keeps the existing frame near the start for other video references", () => {
    expect(resolveWorkspaceVideoReferenceFrameTime(8)).toBe(0.25);
  });

  it("does not seek past the latest decodable point", () => {
    expect(resolveWorkspaceVideoReferenceFrameTime(0.2, { seekSeconds: 1 })).toBeCloseTo(0.15);
  });
});
