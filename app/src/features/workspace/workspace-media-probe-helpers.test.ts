// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { waitForWorkspaceAttachedVideoElement } from "./workspace-media-probe-helpers";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("waitForWorkspaceAttachedVideoElement", () => {
  it("times out when animation frames are paused in a background tab", async () => {
    vi.useFakeTimers();
    const cancelAnimationFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 42);

    const result = waitForWorkspaceAttachedVideoElement(
      () => null,
      "/api/studio/segment-photo-animation/jobs/job-1/video",
      {
        timeoutMs: 25,
      },
    );

    await vi.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toBeNull();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
  });
});
