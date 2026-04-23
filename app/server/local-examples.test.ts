import { beforeEach, describe, expect, it, vi } from "vitest";

const studioMocks = vi.hoisted(() => ({
  getStudioVideoProxyTarget: vi.fn(),
  getStudioVideoProxyTargetByPath: vi.fn(),
}));

const projectMocks = vi.hoisted(() => ({
  getWorkspaceProjectPlaybackAsset: vi.fn(),
  getWorkspaceProjectVideoProxyTarget: vi.fn(),
}));

vi.mock("./studio.js", () => ({
  getStudioVideoProxyTarget: studioMocks.getStudioVideoProxyTarget,
  getStudioVideoProxyTargetByPath: studioMocks.getStudioVideoProxyTargetByPath,
}));

vi.mock("./projects.js", () => ({
  getWorkspaceProjectPlaybackAsset: projectMocks.getWorkspaceProjectPlaybackAsset,
  getWorkspaceProjectVideoProxyTarget: projectMocks.getWorkspaceProjectVideoProxyTarget,
}));

import { resolveLocalExampleVideoTarget } from "./local-examples.js";

describe("local examples video source resolution", () => {
  beforeEach(() => {
    studioMocks.getStudioVideoProxyTarget.mockReset();
    studioMocks.getStudioVideoProxyTargetByPath.mockReset();
    projectMocks.getWorkspaceProjectPlaybackAsset.mockReset();
    projectMocks.getWorkspaceProjectVideoProxyTarget.mockReset();
  });

  it("resolves studio playback urls through the upstream proxy target", async () => {
    const sourceUrl = new URL("https://cdn.example.com/generated/job-123.mp4");
    studioMocks.getStudioVideoProxyTarget.mockResolvedValue(sourceUrl);

    const user = {
      email: "adshortsai@gmail.com",
      id: "admin-1",
      name: "Admin",
    };

    await expect(resolveLocalExampleVideoTarget("/api/studio/playback/job-123?v=2026-04-21T10%3A00%3A00.000Z", user)).resolves.toEqual({
      sourceUrl,
    });
    expect(studioMocks.getStudioVideoProxyTarget).toHaveBeenCalledWith("job-123", user);
  });
});
