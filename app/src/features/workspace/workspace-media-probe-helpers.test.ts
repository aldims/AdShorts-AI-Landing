// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ensureVideoElementLoading,
  videoElementUsesAnyWorkspaceSourceUrl,
  waitForWorkspaceAttachedVideoElement,
  waitForWorkspaceAttachedVideoElementReady,
} from "./workspace-media-probe-helpers";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ensureVideoElementLoading", () => {
  it("does not restart an auto-preloaded video while the browser is decoding an idle response", () => {
    const element = document.createElement("video");
    element.preload = "auto";
    Object.defineProperty(element, "networkState", {
      configurable: true,
      value: HTMLMediaElement.NETWORK_IDLE,
    });
    Object.defineProperty(element, "readyState", {
      configurable: true,
      value: HTMLMediaElement.HAVE_NOTHING,
    });
    const load = vi.spyOn(element, "load").mockImplementation(() => undefined);

    ensureVideoElementLoading(element, HTMLMediaElement.HAVE_FUTURE_DATA);

    expect(load).not.toHaveBeenCalled();
  });

  it("reloads an idle video once when preload is upgraded to auto", () => {
    const element = document.createElement("video");
    element.preload = "metadata";
    Object.defineProperty(element, "networkState", {
      configurable: true,
      value: HTMLMediaElement.NETWORK_IDLE,
    });
    Object.defineProperty(element, "readyState", {
      configurable: true,
      value: HTMLMediaElement.HAVE_METADATA,
    });
    const load = vi.spyOn(element, "load").mockImplementation(() => undefined);

    ensureVideoElementLoading(element, HTMLMediaElement.HAVE_FUTURE_DATA);
    ensureVideoElementLoading(element, HTMLMediaElement.HAVE_FUTURE_DATA);

    expect(load).toHaveBeenCalledTimes(1);
    expect(element.preload).toBe("auto");
  });
});

describe("waitForWorkspaceAttachedVideoElementReady", () => {
  it("accepts metadata as the preparation boundary before playback starts decoding", async () => {
    const element = document.createElement("video");
    element.src = "/api/workspace/media-assets/9829/playback";
    Object.defineProperty(element, "readyState", {
      configurable: true,
      value: HTMLMediaElement.HAVE_METADATA,
    });

    const result = waitForWorkspaceAttachedVideoElementReady(
      () => element,
      [element.src],
      {
        minimumReadyState: HTMLMediaElement.HAVE_METADATA,
        timeoutMs: 50,
      },
    );

    await expect(result).resolves.toBe(true);
  });

  it("follows a React-replaced video element and accepts a ready fallback source", async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
      window.setTimeout(() => callback(window.performance.now()), 1),
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
      window.clearTimeout(frameId);
    });

    const primaryElement = document.createElement("video");
    primaryElement.src = "/api/workspace/project-segment-video?projectId=4249&segmentIndex=1";
    Object.defineProperty(primaryElement, "readyState", {
      configurable: true,
      value: HTMLMediaElement.HAVE_METADATA,
    });

    const fallbackElement = document.createElement("video");
    fallbackElement.src = "/api/workspace/media-assets/9820/playback";
    Object.defineProperty(fallbackElement, "readyState", {
      configurable: true,
      value: HTMLMediaElement.HAVE_FUTURE_DATA,
    });

    let attachedElement = primaryElement;
    const result = waitForWorkspaceAttachedVideoElementReady(
      () => attachedElement,
      [primaryElement.src, fallbackElement.src],
      {
        minimumReadyState: HTMLMediaElement.HAVE_FUTURE_DATA,
        timeoutMs: 50,
      },
    );

    window.setTimeout(() => {
      attachedElement = fallbackElement;
    }, 5);
    await vi.advanceTimersByTimeAsync(10);

    await expect(result).resolves.toBe(true);
  });
});

describe("waitForWorkspaceAttachedVideoElement", () => {
  it("matches a ready video against any primary or fallback source url", () => {
    const element = document.createElement("video");
    element.src = `${window.location.origin}/api/workspace/project-segment-video?projectId=3753&segmentIndex=1&source=original&delivery=preview&v=ready`;

    expect(videoElementUsesAnyWorkspaceSourceUrl(element, [
      "/api/workspace/project-segment-video?projectId=3753&segmentIndex=1&source=original&delivery=playback&v=ready",
      "/api/workspace/project-segment-video?projectId=3753&segmentIndex=1&source=original&delivery=preview&v=ready",
    ])).toBe(true);
  });

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
