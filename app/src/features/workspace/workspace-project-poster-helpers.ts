import { canCapturePosterInBrowser } from "./hot-path";
import { getWorkspaceSegmentPausedPreviewTime } from "../../lib/workspaceSegmentPreview";

const projectPosterCache = new Map<string, string>();
const projectPosterCaptureRequests = new Map<string, Promise<string>>();
const projectPosterCaptureQueue: Array<() => void> = [];
const PROJECT_POSTER_CACHE_MAX_ITEMS = 40;
const PROJECT_POSTER_CAPTURE_CONCURRENCY = 1;
const PROJECT_POSTER_CAPTURE_MAX_DIMENSION = 540;
const PROJECT_POSTER_CAPTURE_QUALITY = 0.72;
let activeProjectPosterCaptureCount = 0;

export const getProjectPosterCacheValue = (videoUrl: string | null | undefined) => {
  const normalized = String(videoUrl ?? "").trim();
  if (!normalized) {
    return null;
  }

  const cachedPoster = projectPosterCache.get(normalized) ?? null;
  if (!cachedPoster) {
    return null;
  }

  projectPosterCache.delete(normalized);
  projectPosterCache.set(normalized, cachedPoster);
  return cachedPoster;
};

export const setProjectPosterCacheValue = (videoUrl: string | null | undefined, posterUrl: string | null | undefined) => {
  const normalizedVideoUrl = String(videoUrl ?? "").trim();
  const normalizedPosterUrl = String(posterUrl ?? "").trim();
  if (!normalizedVideoUrl || !normalizedPosterUrl) {
    return;
  }

  if (projectPosterCache.has(normalizedVideoUrl)) {
    projectPosterCache.delete(normalizedVideoUrl);
  }

  projectPosterCache.set(normalizedVideoUrl, normalizedPosterUrl);

  while (projectPosterCache.size > PROJECT_POSTER_CACHE_MAX_ITEMS) {
    const oldestKey = projectPosterCache.keys().next().value;
    if (typeof oldestKey !== "string") {
      break;
    }

    projectPosterCache.delete(oldestKey);
  }
};

const getPosterCaptureSize = (width: number, height: number) => {
  const longestSide = Math.max(width, height);

  if (!Number.isFinite(longestSide) || longestSide <= PROJECT_POSTER_CAPTURE_MAX_DIMENSION) {
    return {
      height,
      width,
    };
  }

  const scale = PROJECT_POSTER_CAPTURE_MAX_DIMENSION / longestSide;
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
};

const flushProjectPosterCaptureQueue = () => {
  while (activeProjectPosterCaptureCount < PROJECT_POSTER_CAPTURE_CONCURRENCY && projectPosterCaptureQueue.length > 0) {
    const nextTask = projectPosterCaptureQueue.shift();
    if (!nextTask) {
      break;
    }

    activeProjectPosterCaptureCount += 1;
    nextTask();
  }
};

const enqueueProjectPosterCapture = (task: () => Promise<string>) =>
  new Promise<string>((resolve, reject) => {
    const runTask = () => {
      void task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeProjectPosterCaptureCount = Math.max(0, activeProjectPosterCaptureCount - 1);
          flushProjectPosterCaptureQueue();
        });
    };

    projectPosterCaptureQueue.push(runTask);
    flushProjectPosterCaptureQueue();
  });

const captureProjectPoster = (
  videoUrl: string,
  options?: {
    previewTime?: number;
    useSegmentPreviewTime?: boolean;
  },
) =>
  new Promise<string>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Document is not available."));
      return;
    }

    const video = document.createElement("video");
    let settled = false;
    let shouldSeekPreviewFrame = true;
    const timeoutId = window.setTimeout(() => {
      fail(new Error("Poster capture timed out."));
    }, 12000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const drawFrame = () => {
      if (settled) return;

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        fail(new Error("Video dimensions are unavailable."));
        return;
      }

      const targetSize = getPosterCaptureSize(width, height);
      const canvas = document.createElement("canvas");
      canvas.width = targetSize.width;
      canvas.height = targetSize.height;
      const context = canvas.getContext("2d");

      if (!context) {
        fail(new Error("Canvas context is unavailable."));
        return;
      }

      context.drawImage(video, 0, 0, targetSize.width, targetSize.height);
      settled = true;
      cleanup();
      resolve(canvas.toDataURL("image/jpeg", PROJECT_POSTER_CAPTURE_QUALITY));
    };

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    video.onloadeddata = () => {
      if (settled) return;

      const preferredPreviewTime = Number.isFinite(options?.previewTime)
        ? Math.max(0, Number(options?.previewTime))
        : options?.useSegmentPreviewTime
          ? getWorkspaceSegmentPausedPreviewTime(video.duration)
          : 0.15;
      const previewTime = Number.isFinite(video.duration) && video.duration > preferredPreviewTime ? preferredPreviewTime : 0;
      if (shouldSeekPreviewFrame && previewTime > 0) {
        shouldSeekPreviewFrame = false;

        try {
          video.currentTime = previewTime;
          return;
        } catch {
          drawFrame();
          return;
        }
      }

      drawFrame();
    };

    video.onseeked = () => {
      drawFrame();
    };

    video.onerror = () => {
      fail(new Error("Failed to load project preview frame."));
    };
  });

export const captureProjectPosterFrameFromVideoElement = (video: HTMLVideoElement) => {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    return null;
  }

  const targetSize = getPosterCaptureSize(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = targetSize.width;
  canvas.height = targetSize.height;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  try {
    context.drawImage(video, 0, 0, targetSize.width, targetSize.height);
    return canvas.toDataURL("image/jpeg", PROJECT_POSTER_CAPTURE_QUALITY);
  } catch {
    return null;
  }
};

export const captureProjectPosterOnce = (
  videoUrl: string,
  options?: {
    cacheKey?: string;
    previewTime?: number;
    useSegmentPreviewTime?: boolean;
  },
) => {
  const normalizedVideoUrl = String(videoUrl ?? "").trim();
  if (!normalizedVideoUrl) {
    return Promise.reject(new Error("Video URL is required for poster capture."));
  }

  if (!canCapturePosterInBrowser(normalizedVideoUrl)) {
    return Promise.reject(new Error("Remote video poster capture is disabled."));
  }

  const normalizedCacheKey = String(options?.cacheKey ?? normalizedVideoUrl).trim() || normalizedVideoUrl;

  const cachedPoster = getProjectPosterCacheValue(normalizedCacheKey);
  if (cachedPoster) {
    return Promise.resolve(cachedPoster);
  }

  const inFlightRequest = projectPosterCaptureRequests.get(normalizedCacheKey);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const nextRequest = enqueueProjectPosterCapture(() => captureProjectPoster(normalizedVideoUrl, options))
    .then((capturedPosterUrl) => {
      setProjectPosterCacheValue(normalizedCacheKey, capturedPosterUrl);
      return capturedPosterUrl;
    })
    .finally(() => {
      projectPosterCaptureRequests.delete(normalizedCacheKey);
    });

  projectPosterCaptureRequests.set(normalizedCacheKey, nextRequest);
  return nextRequest;
};
