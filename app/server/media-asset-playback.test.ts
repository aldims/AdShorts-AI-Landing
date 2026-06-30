import { describe, expect, it } from "vitest";

import {
  getWorkspaceMediaAssetPlaybackCacheKey,
  inferWorkspaceMediaAssetPlaybackContentType,
  inferWorkspaceMediaAssetPlaybackExtension,
} from "./media-asset-playback.js";

describe("media asset playback", () => {
  it("keeps audio media assets as audio playback sources", () => {
    const signedMp3Url = new URL("https://cdn.example.com/assets/voiceover.mp3?token=abc");
    const signedWavUrl = new URL("https://cdn.example.com/assets/voiceover.wav?token=abc");

    expect(inferWorkspaceMediaAssetPlaybackContentType("audio/mpeg; charset=binary", signedMp3Url)).toBe(
      "audio/mpeg",
    );
    expect(inferWorkspaceMediaAssetPlaybackExtension("audio/mpeg", signedMp3Url)).toBe(".mp3");
    expect(inferWorkspaceMediaAssetPlaybackContentType("application/octet-stream", signedWavUrl)).toBe("audio/wav");
    expect(inferWorkspaceMediaAssetPlaybackExtension("audio/wav", signedWavUrl)).toBe(".wav");
  });

  it("keeps video media assets on the video playback path", () => {
    const signedVideoUrl = new URL("https://cdn.example.com/assets/clip.webm?token=abc");

    expect(inferWorkspaceMediaAssetPlaybackContentType("video/webm", signedVideoUrl)).toBe("video/webm");
    expect(inferWorkspaceMediaAssetPlaybackExtension("video/webm", signedVideoUrl)).toBe(".webm");
  });

  it("invalidates old media playback cache entries", () => {
    const cacheKey = getWorkspaceMediaAssetPlaybackCacheKey({
      assetId: 7399,
      externalUserId: "user-1",
      targetUrl: new URL("https://api.example.com/api/media/7399/download?admin_token=secret&external_user_id=user-1"),
    });

    expect(cacheKey).toBe("v2:user-1:7399:https://api.example.com/api/media/7399/download");
  });
});
