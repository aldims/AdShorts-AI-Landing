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
});
