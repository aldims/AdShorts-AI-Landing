import { normalizeWorkspaceSegmentManualDurationSeconds } from "../../lib/workspaceSegmentEditorTimeline";
import { normalizeWorkspaceVideoSourceUrl } from "./workspace-utils";

export const ensureVideoElementLoading = (
  element: HTMLMediaElement,
  minimumReadyState: number = HTMLMediaElement.HAVE_CURRENT_DATA,
) => {
  if (element.preload !== "auto") {
    element.preload = "auto";
  }

  if (element.networkState === HTMLMediaElement.NETWORK_EMPTY) {
    element.load();
    return;
  }

  if (
    element.readyState < minimumReadyState &&
    element.networkState !== HTMLMediaElement.NETWORK_LOADING
  ) {
    element.load();
  }
};

export const WORKSPACE_SEGMENT_GENERATED_VIDEO_WARMUP_ATTACH_TIMEOUT_MS = 480;
export const WORKSPACE_SEGMENT_GENERATED_VIDEO_WARMUP_TIMEOUT_MS = 4_500;

export const videoElementUsesWorkspaceSourceUrl = (element: HTMLVideoElement, sourceUrl: string) => {
  const normalizedSourceUrl = normalizeWorkspaceVideoSourceUrl(sourceUrl);
  if (!normalizedSourceUrl) {
    return false;
  }

  return [element.currentSrc, element.src, element.getAttribute("src")]
    .map((candidate) => normalizeWorkspaceVideoSourceUrl(candidate))
    .some((candidate) => candidate === normalizedSourceUrl);
};

export const waitForWorkspaceAttachedVideoElement = (
  resolveElement: () => HTMLVideoElement | null,
  sourceUrl: string,
  options?: {
    timeoutMs?: number;
  },
) =>
  new Promise<HTMLVideoElement | null>((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }

    const timeoutMs = options?.timeoutMs ?? WORKSPACE_SEGMENT_GENERATED_VIDEO_WARMUP_ATTACH_TIMEOUT_MS;
    let settled = false;
    let animationFrameId = 0;
    const timeoutId = window.setTimeout(() => {
      finish(null);
    }, timeoutMs);

    const finish = (element: HTMLVideoElement | null) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      resolve(element);
    };

    const tryResolve = () => {
      const candidate = resolveElement();
      if (candidate && videoElementUsesWorkspaceSourceUrl(candidate, sourceUrl)) {
        finish(candidate);
        return;
      }

      animationFrameId = window.requestAnimationFrame(tryResolve);
    };

    tryResolve();
  });

export const disposeWorkspaceDetachedVideoElement = (element: HTMLVideoElement | null | undefined) => {
  if (!element) {
    return;
  }

  element.pause();
  element.removeAttribute("src");

  try {
    element.load();
  } catch {
    // Ignore cleanup errors while the browser is tearing down the detached element.
  }
};

export const waitForWorkspaceVideoElementReady = (
  element: HTMLMediaElement,
  options?: {
    minimumReadyState?: number;
    timeoutMs?: number;
  },
) =>
  new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    const minimumReadyState = options?.minimumReadyState ?? HTMLMediaElement.HAVE_CURRENT_DATA;
    const timeoutMs = options?.timeoutMs ?? WORKSPACE_SEGMENT_GENERATED_VIDEO_WARMUP_TIMEOUT_MS;

    if (element.readyState >= minimumReadyState) {
      resolve(true);
      return;
    }

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      settle(element.readyState >= minimumReadyState);
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      element.removeEventListener("loadedmetadata", handlePotentialReady);
      element.removeEventListener("loadeddata", handlePotentialReady);
      element.removeEventListener("canplay", handlePotentialReady);
      element.removeEventListener("error", handleError);
    };

    const settle = (result: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(result);
    };

    const handlePotentialReady = () => {
      if (element.readyState >= minimumReadyState) {
        settle(true);
      }
    };

    const handleError = () => {
      settle(false);
    };

    element.addEventListener("loadedmetadata", handlePotentialReady);
    element.addEventListener("loadeddata", handlePotentialReady);
    element.addEventListener("canplay", handlePotentialReady);
    element.addEventListener("error", handleError);
    ensureVideoElementLoading(element, minimumReadyState);
    handlePotentialReady();
  });

export const readWorkspaceVideoDurationSeconds = async (sourceUrl: string) => {
  if (typeof document === "undefined") {
    return null;
  }

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.style.position = "fixed";
  video.style.left = "-9999px";
  video.style.top = "0";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";
  video.src = sourceUrl;
  document.body?.appendChild(video);

  try {
    const isReady = await waitForWorkspaceVideoElementReady(video, {
      minimumReadyState: HTMLMediaElement.HAVE_METADATA,
      timeoutMs: 9000,
    });
    const duration = isReady && Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
    return duration;
  } finally {
    video.remove();
    disposeWorkspaceDetachedVideoElement(video);
  }
};

const readWorkspaceDecodedAudioDurationSeconds = async (sourceUrl: string) => {
  if (typeof window === "undefined" || typeof window.fetch !== "function") {
    return null;
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    return null;
  }

  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => abortController.abort(), 7000);
  let audioContext: AudioContext | null = null;

  try {
    const response = await window.fetch(sourceUrl, {
      credentials: "include",
      signal: abortController.signal,
    });
    if (!response.ok) {
      return null;
    }

    const audioBytes = await response.arrayBuffer();
    if (audioBytes.byteLength === 0) {
      return null;
    }

    audioContext = new AudioContextConstructor();
    const audioBuffer = await audioContext.decodeAudioData(audioBytes.slice(0));
    return Number.isFinite(audioBuffer.duration) && audioBuffer.duration > 0 ? audioBuffer.duration : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
    if (audioContext) {
      void audioContext.close().catch(() => undefined);
    }
  }
};

export const readWorkspaceSegmentVoiceoverDurationSeconds = async (sourceUrl: string) => {
  if (typeof window === "undefined" || typeof window.fetch !== "function") {
    return null;
  }

  let url: URL;
  try {
    url = new URL(sourceUrl, window.location.origin);
  } catch {
    return null;
  }

  if (url.pathname !== "/api/workspace/project-segment-voiceover") {
    return null;
  }

  const projectId = url.searchParams.get("projectId");
  const segmentIndex = url.searchParams.get("segmentIndex");
  if (!projectId || !segmentIndex) {
    return null;
  }

  const durationUrl = new URL("/api/workspace/project-segment-voiceover-duration", window.location.origin);
  durationUrl.searchParams.set("projectId", projectId);
  durationUrl.searchParams.set("segmentIndex", segmentIndex);
  const version = url.searchParams.get("v");
  if (version) {
    durationUrl.searchParams.set("v", version);
  }

  try {
    const response = await window.fetch(`${durationUrl.pathname}${durationUrl.search}`, {
      credentials: "include",
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as {
      data?: {
        durationSeconds?: unknown;
      };
    } | null;
    return normalizeWorkspaceSegmentManualDurationSeconds(payload?.data?.durationSeconds);
  } catch {
    return null;
  }
};

const encodeWorkspaceAudioBufferAsWavBlob = (audioBuffer: AudioBuffer, tailPaddingSeconds: number) => {
  const channelCount = Math.max(1, Math.min(2, audioBuffer.numberOfChannels));
  const sampleRate = audioBuffer.sampleRate;
  const paddingFrameCount = Math.max(0, Math.ceil(sampleRate * tailPaddingSeconds));
  const sourceFrameCount = audioBuffer.length;
  const frameCount = sourceFrameCount + paddingFrameCount;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  const channelData = Array.from({ length: channelCount }, (_, channelIndex) =>
    audioBuffer.getChannelData(Math.min(channelIndex, audioBuffer.numberOfChannels - 1)),
  );
  let offset = 44;
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = frameIndex < sourceFrameCount ? channelData[channelIndex]?.[frameIndex] ?? 0 : 0;
      const clampedSample = Math.max(-1, Math.min(1, sample));
      const pcmSample = clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff;
      view.setInt16(offset, Math.round(pcmSample), true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
};

export const createWorkspacePaddedAudioPreviewObjectUrl = async (sourceUrl: string, tailPaddingSeconds: number) => {
  if (typeof window === "undefined" || typeof window.fetch !== "function") {
    return null;
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    return null;
  }

  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => abortController.abort(), 7000);
  let audioContext: AudioContext | null = null;

  try {
    const response = await window.fetch(sourceUrl, {
      credentials: "include",
      signal: abortController.signal,
    });
    if (!response.ok) {
      return null;
    }

    const audioBytes = await response.arrayBuffer();
    if (audioBytes.byteLength === 0) {
      return null;
    }

    audioContext = new AudioContextConstructor();
    const audioBuffer = await audioContext.decodeAudioData(audioBytes.slice(0));
    if (!Number.isFinite(audioBuffer.duration) || audioBuffer.duration <= 0) {
      return null;
    }

    return URL.createObjectURL(encodeWorkspaceAudioBufferAsWavBlob(audioBuffer, tailPaddingSeconds));
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
    if (audioContext) {
      void audioContext.close().catch(() => undefined);
    }
  }
};

export const readWorkspaceAudioDurationSeconds = async (sourceUrl: string) => {
  if (typeof document === "undefined") {
    return null;
  }

  const serverDuration = await readWorkspaceSegmentVoiceoverDurationSeconds(sourceUrl);
  if (serverDuration !== null) {
    return serverDuration;
  }

  const audio = document.createElement("audio");
  audio.preload = "metadata";
  audio.style.position = "fixed";
  audio.style.left = "-9999px";
  audio.style.top = "0";
  audio.style.width = "1px";
  audio.style.height = "1px";
  audio.style.opacity = "0";
  audio.style.pointerEvents = "none";
  audio.src = sourceUrl;
  document.body?.appendChild(audio);

  try {
    const isReady = await waitForWorkspaceVideoElementReady(audio, {
      minimumReadyState: HTMLMediaElement.HAVE_METADATA,
      timeoutMs: 3500,
    });
    const metadataDuration = isReady && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
    return await readWorkspaceDecodedAudioDurationSeconds(sourceUrl) ?? metadataDuration;
  } finally {
    audio.remove();
  }
};
