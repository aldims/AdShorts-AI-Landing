import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { env } from "./env.js";

type WaveSpeedPredictionPayload = {
  code?: number;
  data?: {
    error?: string | null;
    id?: string | null;
    outputs?: unknown;
    status?: string | null;
  } | null;
  message?: string | null;
};

type WaveSpeedMediaUploadPayload = {
  code?: number;
  data?: {
    download_url?: string | null;
    filename?: string | null;
    type?: string | null;
    url?: string | null;
  } | null;
  message?: string | null;
};

type WaveSpeedImageToVideoOptions = {
  duration?: 5 | 10;
  image: Buffer;
  imageFileName?: string;
  imageMimeType?: string;
  negativePrompt?: string;
  prompt: string;
};

export type WaveSpeedPredictionStatusResult = {
  error?: string;
  id: string;
  outputUrl: string | null;
  status: string;
};

export type WaveSpeedImageToVideoJob = WaveSpeedPredictionStatusResult;

type WaveSpeedSpeechPreviewOptions = {
  format?: "flac" | "mp3" | "wav";
  languageBoost?: string;
  pitch?: number;
  speed?: number;
  text: string;
  voiceId: string;
  volume?: number;
};

type WaveSpeedSpeechPreviewResult = {
  audio: Buffer;
  contentType: string;
};

const WAVESPEED_API_BASE_URL = "https://api.wavespeed.ai/api/v3/";
export const WAVESPEED_KLING_V2_6_STD_IMAGE_TO_VIDEO_MODEL = "kwaivgi/kling-v2.6-std/image-to-video";
const WAVESPEED_PREVIEW_CACHE_DIR = join(env.dataDir, "voice-previews", "wavespeed");
const WAVESPEED_PREVIEW_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const WAVESPEED_KLING_IMAGE_TO_VIDEO_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

mkdirSync(WAVESPEED_PREVIEW_CACHE_DIR, { recursive: true });

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const getPreviewCachePath = (options: WaveSpeedSpeechPreviewOptions) => {
  const hash = createHash("sha1")
    .update(
      JSON.stringify({
        format: options.format ?? "wav",
        languageBoost: options.languageBoost ?? "",
        pitch: options.pitch ?? 0,
        speed: options.speed ?? 1,
        text: options.text,
        voiceId: options.voiceId,
        volume: options.volume ?? 1,
      }),
    )
    .digest("hex");

  return join(WAVESPEED_PREVIEW_CACHE_DIR, `${hash}.${options.format ?? "wav"}`);
};

const readCachedPreview = (cachePath: string) => {
  if (!existsSync(cachePath)) {
    return null;
  }

  const fileStat = statSync(cachePath);
  const ageMs = Date.now() - fileStat.mtimeMs;
  if (ageMs > WAVESPEED_PREVIEW_CACHE_TTL_MS || fileStat.size <= 0) {
    return null;
  }

  return readFileSync(cachePath);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWaveSpeed = async (path: string, init?: RequestInit, timeoutMs = 30_000) => {
  if (!env.wavespeedApiKey) {
    throw new Error("WaveSpeed API is not configured on this server.");
  }

  const normalizedPath = path.replace(/^\/+/u, "");
  const response = await fetch(new URL(normalizedPath, WAVESPEED_API_BASE_URL), {
    ...init,
    headers: {
      Authorization: `Bearer ${env.wavespeedApiKey}`,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  return response;
};

const parseWaveSpeedJson = async <T>(response: Response) => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const getWaveSpeedErrorMessage = (payload: WaveSpeedPredictionPayload | null, fallback: string) => {
  return (
    normalizeText(payload?.data?.error) ||
    normalizeText(payload?.message) ||
    fallback
  );
};

const getWaveSpeedMediaUploadErrorMessage = (payload: WaveSpeedMediaUploadPayload | null, fallback: string) => {
  return normalizeText(payload?.message) || fallback;
};

const extractWaveSpeedOutputUrl = (payload: WaveSpeedPredictionPayload | null) => {
  const outputs = payload?.data?.outputs;
  if (!Array.isArray(outputs) || outputs.length === 0) {
    return null;
  }

  const firstOutput = outputs[0];
  if (typeof firstOutput === "string" && firstOutput.trim()) {
    return firstOutput.trim();
  }

  if (
    firstOutput &&
    typeof firstOutput === "object" &&
    "url" in firstOutput &&
    typeof firstOutput.url === "string" &&
    firstOutput.url.trim()
  ) {
    return firstOutput.url.trim();
  }

  return null;
};

const extractWaveSpeedMediaUploadUrl = (payload: WaveSpeedMediaUploadPayload | null) => {
  const candidates = [payload?.data?.download_url, payload?.data?.url];
  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const assertValidWaveSpeedHttpUrl = (value: string, fallbackError: string) => {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // Fall through to the shared error below.
  }

  throw new Error(fallbackError);
};

const pollWaveSpeedPrediction = async (predictionId: string) => {
  const startedAt = Date.now();
  let delayMs = 1000;

  while (Date.now() - startedAt < 90_000) {
    const response = await fetchWaveSpeed(`/predictions/${encodeURIComponent(predictionId)}/result`, undefined, 20_000);
    const payload = await parseWaveSpeedJson<WaveSpeedPredictionPayload>(response);

    if (!response.ok) {
      throw new Error(getWaveSpeedErrorMessage(payload, `WaveSpeed prediction polling failed (${response.status}).`));
    }

    const status = normalizeText(payload?.data?.status).toLowerCase();
    const outputUrl = extractWaveSpeedOutputUrl(payload);

    if (status === "completed" && outputUrl) {
      return outputUrl;
    }

    if (status === "failed") {
      throw new Error(getWaveSpeedErrorMessage(payload, "WaveSpeed prediction failed."));
    }

    await sleep(delayMs);
    delayMs = Math.min(3000, Math.round(delayMs * 1.2));
  }

  throw new Error("WaveSpeed preview timed out.");
};

const uploadWaveSpeedMedia = async (options: {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
}) => {
  const normalizedFileName = normalizeText(options.fileName) || "wavespeed-source.png";
  const normalizedMimeType = normalizeText(options.mimeType) || "image/png";
  if (options.bytes.byteLength <= 0) {
    throw new Error("WaveSpeed source file is empty.");
  }

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(options.bytes)], {
      type: normalizedMimeType,
    }),
    normalizedFileName,
  );

  const response = await fetchWaveSpeed(
    "/media/upload/binary",
    {
      body: formData,
      method: "POST",
    },
    90_000,
  );
  const payload = await parseWaveSpeedJson<WaveSpeedMediaUploadPayload>(response);

  if (!response.ok) {
    throw new Error(getWaveSpeedMediaUploadErrorMessage(payload, `WaveSpeed media upload failed (${response.status}).`));
  }

  const uploadedUrl = extractWaveSpeedMediaUploadUrl(payload);
  if (!uploadedUrl) {
    throw new Error("WaveSpeed media upload did not return a file URL.");
  }

  return assertValidWaveSpeedHttpUrl(uploadedUrl, "WaveSpeed media upload returned an invalid file URL.");
};

export async function getWaveSpeedPredictionStatus(
  predictionId: string,
): Promise<WaveSpeedPredictionStatusResult> {
  const normalizedPredictionId = normalizeText(predictionId);
  if (!normalizedPredictionId) {
    throw new Error("WaveSpeed prediction id is required.");
  }

  const response = await fetchWaveSpeed(
    `/predictions/${encodeURIComponent(normalizedPredictionId)}/result`,
    undefined,
    30_000,
  );
  const payload = await parseWaveSpeedJson<WaveSpeedPredictionPayload>(response);

  if (!response.ok) {
    throw new Error(getWaveSpeedErrorMessage(payload, `WaveSpeed prediction status failed (${response.status}).`));
  }

  const outputUrl = extractWaveSpeedOutputUrl(payload);
  return {
    error: normalizeText(payload?.data?.error) || undefined,
    id: normalizeText(payload?.data?.id) || normalizedPredictionId,
    outputUrl: outputUrl ? assertValidWaveSpeedHttpUrl(outputUrl, "WaveSpeed prediction returned an invalid output URL.") : null,
    status: normalizeText(payload?.data?.status).toLowerCase() || "processing",
  };
}

export async function getWaveSpeedPredictionOutputUrl(predictionId: string): Promise<string | null> {
  const status = await getWaveSpeedPredictionStatus(predictionId);
  if (status.status === "failed") {
    throw new Error(status.error || "WaveSpeed prediction failed.");
  }

  return status.outputUrl;
}

export async function createWaveSpeedKlingImageToVideoJob(
  options: WaveSpeedImageToVideoOptions,
): Promise<WaveSpeedImageToVideoJob> {
  const normalizedPrompt = normalizeText(options.prompt);
  if (!normalizedPrompt) {
    throw new Error("WaveSpeed image-to-video prompt is required.");
  }

  if (options.image.byteLength <= 0) {
    throw new Error("WaveSpeed image-to-video source image is empty.");
  }

  if (options.image.byteLength > WAVESPEED_KLING_IMAGE_TO_VIDEO_MAX_IMAGE_BYTES) {
    throw new Error("WaveSpeed image-to-video source image must be 10MB or smaller.");
  }

  const imageUrl = await uploadWaveSpeedMedia({
    bytes: options.image,
    fileName: options.imageFileName || "segment-ai-video-source.png",
    mimeType: options.imageMimeType || "image/png",
  });
  const negativePrompt = normalizeText(options.negativePrompt);
  const response = await fetchWaveSpeed(
    `/${WAVESPEED_KLING_V2_6_STD_IMAGE_TO_VIDEO_MODEL}`,
    {
      body: JSON.stringify({
        duration: options.duration ?? 5,
        image: imageUrl,
        ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
        prompt: normalizedPrompt,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
    60_000,
  );
  const payload = await parseWaveSpeedJson<WaveSpeedPredictionPayload>(response);

  if (!response.ok) {
    throw new Error(getWaveSpeedErrorMessage(payload, `WaveSpeed image-to-video request failed (${response.status}).`));
  }

  const predictionId = normalizeText(payload?.data?.id);
  if (!predictionId) {
    throw new Error("WaveSpeed did not return an image-to-video prediction id.");
  }

  const outputUrl = extractWaveSpeedOutputUrl(payload);
  return {
    error: normalizeText(payload?.data?.error) || undefined,
    id: predictionId,
    outputUrl: outputUrl ? assertValidWaveSpeedHttpUrl(outputUrl, "WaveSpeed prediction returned an invalid output URL.") : null,
    status: normalizeText(payload?.data?.status).toLowerCase() || "created",
  };
}

export async function generateWaveSpeedSpeechPreview(
  options: WaveSpeedSpeechPreviewOptions,
): Promise<WaveSpeedSpeechPreviewResult> {
  const normalizedText = normalizeText(options.text);
  const normalizedVoiceId = normalizeText(options.voiceId);
  if (!normalizedText) {
    throw new Error("Preview text is required.");
  }

  if (!normalizedVoiceId) {
    throw new Error("WaveSpeed voice id is required.");
  }

  const cachePath = getPreviewCachePath({
    ...options,
    text: normalizedText,
    voiceId: normalizedVoiceId,
  });
  const cachedAudio = readCachedPreview(cachePath);
  if (cachedAudio) {
    return {
      audio: cachedAudio,
      contentType: options.format === "mp3" ? "audio/mpeg" : "audio/wav",
    };
  }

  const response = await fetchWaveSpeed(
    "/minimax/speech-02-turbo",
    {
      body: JSON.stringify({
        enable_sync_mode: true,
        format: options.format ?? "wav",
        language_boost: options.languageBoost ?? "Russian",
        pitch: options.pitch ?? 0,
        speed: options.speed ?? 1,
        text: normalizedText,
        voice_id: normalizedVoiceId,
        volume: options.volume ?? 1,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
    60_000,
  );

  const payload = await parseWaveSpeedJson<WaveSpeedPredictionPayload>(response);

  if (!response.ok) {
    throw new Error(getWaveSpeedErrorMessage(payload, `WaveSpeed preview request failed (${response.status}).`));
  }

  const outputUrl =
    extractWaveSpeedOutputUrl(payload) ||
    (payload?.data?.id ? await pollWaveSpeedPrediction(payload.data.id) : null);

  if (!outputUrl) {
    throw new Error("WaveSpeed preview did not return an audio URL.");
  }

  const audioResponse = await fetch(outputUrl, {
    headers: {
      Accept: "audio/wav,audio/mpeg,audio/*,application/octet-stream",
    },
    signal: AbortSignal.timeout(60_000),
  });

  if (!audioResponse.ok) {
    throw new Error(`Failed to download WaveSpeed preview audio (${audioResponse.status}).`);
  }

  const audio = Buffer.from(await audioResponse.arrayBuffer());
  if (audio.byteLength <= 0) {
    throw new Error("WaveSpeed preview returned an empty audio file.");
  }

  writeFileSync(cachePath, audio);

  return {
    audio,
    contentType: String(audioResponse.headers.get("content-type") || (options.format === "mp3" ? "audio/mpeg" : "audio/wav")),
  };
}
