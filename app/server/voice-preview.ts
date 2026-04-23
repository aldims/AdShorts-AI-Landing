import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import type { IncomingHttpHeaders } from "node:http";
import { Agent, request as httpsRequest } from "node:https";
import { join } from "node:path";

import { env } from "./env.js";
import { generateWaveSpeedSpeechPreview } from "./wavespeed-worker.js";

type StudioVoicePreviewResult = {
  audio: Buffer;
  contentType: string;
};

const DEAPI_TTS_API_URL = "https://api.deapi.ai/api/v1/client/txt2audio";
const DEAPI_TTS_STATUS_URL = "https://api.deapi.ai/api/v1/client/request-status";
const DEAPI_TTS_MODEL_SLUG = "Qwen3_TTS_12Hz_1_7B_CustomVoice";
const DEAPI_PREVIEW_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const DEAPI_PREVIEW_CACHE_DIR = join(env.dataDir, "voice-previews");
const DEAPI_PREVIEW_TEXT_EN = "Listen to how the voice sounds — its pace, intonation, and overall quality.";
const WAVESPEED_PREVIEW_TEXT_RU = "Послушайте, как звучит голос, его темп, интонация и общее восприятие.";

const deapiPreviewAgent = new Agent({
  rejectUnauthorized: env.deapiVerifySsl,
});

const englishVoiceAliases = new Map<string, string>([
  ["male", "Aiden"],
  ["female", "Serena"],
  ["aiden", "Aiden"],
  ["ryan", "Ryan"],
  ["serena", "Serena"],
  ["vivian", "Vivian"],
  ["uncle_fu", "Uncle_Fu"],
  ["uncle fu", "Uncle_Fu"],
  ["dylan", "Dylan"],
  ["eric", "Eric"],
  ["ono_anna", "Ono_Anna"],
  ["ono anna", "Ono_Anna"],
  ["sohee", "Sohee"],
]);

const russianWaveSpeedVoiceAliases = new Map<string, string>([
  ["bys_24000", "Bys_24000"],
  ["nec_24000", "Nec_24000"],
  ["tur_24000", "Tur_24000"],
  ["may_24000", "May_24000"],
  ["ost_24000", "Ost_24000"],
  ["pon_24000", "Pon_24000"],
  ["rma_24000", "Rma_24000"],
  ["rnu_24000", "Rnu_24000"],
  ["male-qn-jingying", "male-qn-jingying"],
  ["aleksey", "male-qn-jingying"],
  ["alexey", "male-qn-jingying"],
  ["алексей", "male-qn-jingying"],
]);

mkdirSync(DEAPI_PREVIEW_CACHE_DIR, { recursive: true });

const normalizePreviewLanguage = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "en" ? "en" : "ru";
};

const normalizeEnglishVoiceId = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[-\s]+/g, "_");
  return englishVoiceAliases.get(normalized) ?? null;
};

const normalizeRussianWaveSpeedVoiceId = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[-\s]+/g, "-");
  return russianWaveSpeedVoiceAliases.get(normalized) ?? null;
};

const getDefaultPreviewText = (language: string) => (language === "en" ? DEAPI_PREVIEW_TEXT_EN : WAVESPEED_PREVIEW_TEXT_RU);
const normalizePreviewText = (value: string | null | undefined) => String(value ?? "").replace(/\s+/g, " ").trim();

const getPreviewCachePath = (voiceId: string, language: string, previewText: string) => {
  const hash = createHash("sha1").update(`${voiceId}:${language}:${previewText}`).digest("hex");
  return join(DEAPI_PREVIEW_CACHE_DIR, `${hash}.wav`);
};

const readCachedPreview = (cachePath: string) => {
  if (!existsSync(cachePath)) {
    return null;
  }

  const fileStat = statSync(cachePath);
  const ageMs = Date.now() - fileStat.mtimeMs;
  if (ageMs > DEAPI_PREVIEW_CACHE_TTL_MS || fileStat.size <= 0) {
    return null;
  }

  return readFileSync(cachePath);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchAdsflowVoicePreview = async (options: {
  language: string;
  previewText: string;
  voiceId: string;
}) => {
  if (!env.adsflowApiBaseUrl || !env.adsflowAdminToken) {
    throw new Error("AdsFlow voice preview is not configured on this server.");
  }

  const previewUrl = new URL("/api/web/voice-preview", env.adsflowApiBaseUrl);
  previewUrl.searchParams.set("admin_token", env.adsflowAdminToken);
  previewUrl.searchParams.set("language", options.language);
  previewUrl.searchParams.set("text", options.previewText);
  previewUrl.searchParams.set("voice_id", options.voiceId);

  const response = await fetch(previewUrl, {
    headers: {
      Accept: "audio/wav,audio/mpeg,audio/*,application/octet-stream",
      "X-Admin-Token": env.adsflowAdminToken,
    },
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const errorText = (await response.text()).trim();
    throw new Error(errorText || `AdsFlow voice preview request failed (${response.status}).`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.byteLength <= 0) {
    throw new Error("AdsFlow voice preview returned an empty audio file.");
  }

  return {
    audio,
    contentType: String(response.headers.get("content-type") || "audio/wav"),
  };
};

const requestHttps = (
  urlValue: URL | string,
  options?: {
    body?: Buffer | string;
    headers?: Record<string, string>;
    method?: string;
    timeoutMs?: number;
  },
) =>
  new Promise<{
    body: Buffer;
    headers: IncomingHttpHeaders;
    status: number;
  }>((resolve, reject) => {
    const targetUrl = typeof urlValue === "string" ? new URL(urlValue) : urlValue;
    const bodyBuffer =
      typeof options?.body === "string" ? Buffer.from(options.body) : options?.body ? Buffer.from(options.body) : null;

    const request = httpsRequest(
      {
        agent: deapiPreviewAgent,
        headers: {
          Accept: "application/json",
          ...(bodyBuffer ? { "Content-Length": String(bodyBuffer.length) } : {}),
          ...(options?.headers ?? {}),
        },
        hostname: targetUrl.hostname,
        method: options?.method ?? "GET",
        path: `${targetUrl.pathname}${targetUrl.search}`,
        port: targetUrl.port ? Number(targetUrl.port) : 443,
        protocol: targetUrl.protocol,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          resolve({
            body: Buffer.concat(chunks),
            headers: response.headers,
            status: response.statusCode ?? 500,
          });
        });
      },
    );

    request.setTimeout(options?.timeoutMs ?? 30_000, () => {
      request.destroy(new Error(`DEAPI request timed out after ${options?.timeoutMs ?? 30_000}ms.`));
    });
    request.on("error", reject);

    if (bodyBuffer) {
      request.write(bodyBuffer);
    }

    request.end();
  });

const parseJsonResponse = <T>(value: Buffer) => {
  try {
    return JSON.parse(value.toString("utf-8")) as T;
  } catch {
    return null;
  }
};

const extractDeapiAudioUrl = (payload: Record<string, unknown> | null) => {
  const root = payload ?? {};
  const inner = typeof root.data === "object" && root.data ? (root.data as Record<string, unknown>) : root;
  const directUrl =
    (typeof inner.result_url === "string" && inner.result_url) ||
    (typeof inner.output_url === "string" && inner.output_url) ||
    (typeof inner.output === "string" && inner.output) ||
    (typeof inner.audio_url === "string" && inner.audio_url) ||
    (typeof inner.url === "string" && inner.url) ||
    (typeof root.result_url === "string" && root.result_url) ||
    (typeof root.output_url === "string" && root.output_url);

  if (directUrl) {
    return directUrl;
  }

  const outputs = Array.isArray(inner.outputs) ? inner.outputs : Array.isArray(root.outputs) ? root.outputs : [];
  const firstOutput = outputs[0];
  if (typeof firstOutput === "string" && firstOutput) {
    return firstOutput;
  }
  if (firstOutput && typeof firstOutput === "object" && "url" in firstOutput && typeof firstOutput.url === "string") {
    return firstOutput.url;
  }

  return null;
};

const pollDeapiPreviewResult = async (requestId: string) => {
  const startedAt = Date.now();
  let pollDelayMs = 1000;

  while (Date.now() - startedAt < 90_000) {
    const response = await requestHttps(`${DEAPI_TTS_STATUS_URL}/${encodeURIComponent(requestId)}`, {
      headers: {
        Authorization: `Bearer ${env.deapiApiKey}`,
      },
      timeoutMs: 15_000,
    });

    if (response.status === 429) {
      await sleep(Math.min(30_000, pollDelayMs * 2));
      continue;
    }

    if (response.status !== 200) {
      await sleep(pollDelayMs);
      pollDelayMs = Math.min(3000, Math.round(pollDelayMs * 1.2));
      continue;
    }

    const payload = parseJsonResponse<Record<string, unknown>>(response.body);
    const inner = payload && typeof payload.data === "object" && payload.data ? (payload.data as Record<string, unknown>) : payload;
    const status =
      (inner && typeof inner.status === "string" ? inner.status : null) ||
      (payload && typeof payload.status === "string" ? payload.status : null) ||
      "";

    if (status === "completed" || status === "done") {
      return extractDeapiAudioUrl(payload);
    }

    if (status === "failed" || status === "error") {
      const errorMessage =
        (inner && typeof inner.error === "string" ? inner.error : null) ||
        (payload && typeof payload.error === "string" ? payload.error : null) ||
        "DEAPI preview generation failed.";
      throw new Error(errorMessage);
    }

    await sleep(pollDelayMs);
    pollDelayMs = Math.min(3000, Math.round(pollDelayMs * 1.2));
  }

  throw new Error("DEAPI preview timed out.");
};

export async function getStudioVoicePreview(options?: {
  language?: string | null;
  voiceId?: string | null;
  previewText?: string | null;
}): Promise<StudioVoicePreviewResult> {
  const language = normalizePreviewLanguage(options?.language);
  const previewText = normalizePreviewText(options?.previewText) || getDefaultPreviewText(language);

  if (language === "ru") {
    const normalizedVoiceId = normalizeRussianWaveSpeedVoiceId(options?.voiceId);
    if (!normalizedVoiceId) {
      throw new Error("Unsupported Russian voice.");
    }

    const cachePath = getPreviewCachePath(normalizedVoiceId, language, previewText);
    const cachedAudio = readCachedPreview(cachePath);
    if (cachedAudio) {
      return {
        audio: cachedAudio,
        contentType: "audio/wav",
      };
    }

    try {
      const preview = await fetchAdsflowVoicePreview({
        language,
        previewText,
        voiceId: normalizedVoiceId,
      });
      writeFileSync(cachePath, preview.audio);
      return preview;
    } catch (adsflowError) {
      console.warn("[workspace] AdsFlow voice preview failed, falling back to direct WaveSpeed", {
        error: adsflowError instanceof Error ? adsflowError.message : String(adsflowError),
        voiceId: normalizedVoiceId,
      });

      if (normalizedVoiceId !== "male-qn-jingying") {
        throw adsflowError instanceof Error ? adsflowError : new Error("Russian voice preview failed.");
      }
    }

    return generateWaveSpeedSpeechPreview({
      format: "wav",
      languageBoost: "Russian",
      text: previewText,
      voiceId: normalizedVoiceId,
    });
  }

  const normalizedVoiceId = normalizeEnglishVoiceId(options?.voiceId);
  if (!normalizedVoiceId) {
    throw new Error("Unsupported DEAPI voice.");
  }

  const cachePath = getPreviewCachePath(normalizedVoiceId, language, previewText);
  const cachedAudio = readCachedPreview(cachePath);
  if (cachedAudio) {
    return {
      audio: cachedAudio,
      contentType: "audio/wav",
    };
  }

  try {
    const preview = await fetchAdsflowVoicePreview({
      language,
      previewText,
      voiceId: normalizedVoiceId,
    });
    writeFileSync(cachePath, preview.audio);
    return preview;
  } catch (adsflowError) {
    console.warn("[workspace] AdsFlow English voice preview failed, falling back to direct DEAPI", {
      error: adsflowError instanceof Error ? adsflowError.message : String(adsflowError),
      voiceId: normalizedVoiceId,
    });
  }

  if (!env.deapiApiKey) {
    throw new Error("DEAPI preview is not configured on this server.");
  }

  const createResponse = await requestHttps(DEAPI_TTS_API_URL, {
    body: JSON.stringify({
      format: "wav",
      lang: "English",
      model: DEAPI_TTS_MODEL_SLUG,
      sample_rate: 24000,
      speed: 1,
      text: previewText,
      voice: normalizedVoiceId,
    }),
    headers: {
      Authorization: `Bearer ${env.deapiApiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    timeoutMs: 30_000,
  });

  if (createResponse.status !== 200) {
    const payloadText = createResponse.body.toString("utf-8").trim();
    throw new Error(payloadText || `DEAPI preview request failed (${createResponse.status}).`);
  }

  const createPayload = parseJsonResponse<Record<string, unknown>>(createResponse.body);
  const requestId =
    (createPayload && typeof createPayload.request_id === "string" ? createPayload.request_id : null) ||
    (createPayload &&
    typeof createPayload.data === "object" &&
    createPayload.data &&
    "request_id" in createPayload.data &&
    typeof createPayload.data.request_id === "string"
      ? createPayload.data.request_id
      : null);

  if (!requestId) {
    throw new Error("DEAPI preview did not return request_id.");
  }

  const audioUrl = await pollDeapiPreviewResult(requestId);
  if (!audioUrl) {
    throw new Error("DEAPI preview did not return an audio URL.");
  }

  const audioResponse = await requestHttps(audioUrl, {
    headers: {
      Accept: "audio/wav,application/octet-stream",
    },
    timeoutMs: 60_000,
  });

  if (audioResponse.status !== 200 || !audioResponse.body.length) {
    throw new Error(`Failed to download DEAPI preview audio (${audioResponse.status}).`);
  }

  writeFileSync(cachePath, audioResponse.body);

  return {
    audio: audioResponse.body,
    contentType: String(audioResponse.headers["content-type"] || "audio/wav"),
  };
}
