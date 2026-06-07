// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { ensureStudioUploadedAssetIdWithInlineFallback } from "./workspace-upload-helpers";

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
