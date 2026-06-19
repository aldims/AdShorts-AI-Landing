import { describe, expect, it } from "vitest";

import { appendVideoProxyToken, verifyVideoProxyToken } from "./video-proxy-token.js";

describe("video proxy token", () => {
  it("accepts server-signed paths and rejects tampered paths", () => {
    const path = "https://adsflow.example.test/api/media/123/download";
    const url = new URL("https://adshorts.example.test/api/studio/video");
    appendVideoProxyToken(url, "studio-video-path", path);

    const expiresAt = url.searchParams.get("expiresAt");
    const token = url.searchParams.get("token");

    expect(verifyVideoProxyToken("studio-video-path", path, expiresAt, token)).toBe(true);
    expect(verifyVideoProxyToken("studio-video-path", `${path}?asset=456`, expiresAt, token)).toBe(false);
    expect(verifyVideoProxyToken("workspace-project-video", path, expiresAt, token)).toBe(false);
  });
});
