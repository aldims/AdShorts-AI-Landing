import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "./env.js";
const WAVESPEED_API_BASE_URL = "https://api.wavespeed.ai/api/v3";
const WAVESPEED_PREVIEW_CACHE_DIR = join(env.dataDir, "voice-previews", "wavespeed");
const WAVESPEED_PREVIEW_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
mkdirSync(WAVESPEED_PREVIEW_CACHE_DIR, { recursive: true });
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const getPreviewCachePath = (options) => {
    const hash = createHash("sha1")
        .update(JSON.stringify({
        format: options.format ?? "wav",
        languageBoost: options.languageBoost ?? "",
        pitch: options.pitch ?? 0,
        speed: options.speed ?? 1,
        text: options.text,
        voiceId: options.voiceId,
        volume: options.volume ?? 1,
    }))
        .digest("hex");
    return join(WAVESPEED_PREVIEW_CACHE_DIR, `${hash}.${options.format ?? "wav"}`);
};
const readCachedPreview = (cachePath) => {
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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fetchWaveSpeed = async (path, init, timeoutMs = 30_000) => {
    if (!env.wavespeedApiKey) {
        throw new Error("WaveSpeed preview is not configured on this server.");
    }
    const response = await fetch(new URL(path, WAVESPEED_API_BASE_URL), {
        ...init,
        headers: {
            Authorization: `Bearer ${env.wavespeedApiKey}`,
            ...(init?.headers ?? {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
    });
    return response;
};
const parseWaveSpeedJson = async (response) => {
    try {
        return (await response.json());
    }
    catch {
        return null;
    }
};
const getWaveSpeedErrorMessage = (payload, fallback) => {
    return (normalizeText(payload?.data?.error) ||
        normalizeText(payload?.message) ||
        fallback);
};
const extractWaveSpeedOutputUrl = (payload) => {
    const outputs = payload?.data?.outputs;
    if (!Array.isArray(outputs) || outputs.length === 0) {
        return null;
    }
    const firstOutput = outputs[0];
    if (typeof firstOutput === "string" && firstOutput.trim()) {
        return firstOutput.trim();
    }
    if (firstOutput &&
        typeof firstOutput === "object" &&
        "url" in firstOutput &&
        typeof firstOutput.url === "string" &&
        firstOutput.url.trim()) {
        return firstOutput.url.trim();
    }
    return null;
};
const pollWaveSpeedPrediction = async (predictionId) => {
    const startedAt = Date.now();
    let delayMs = 1000;
    while (Date.now() - startedAt < 90_000) {
        const response = await fetchWaveSpeed(`/predictions/${encodeURIComponent(predictionId)}/result`, undefined, 20_000);
        const payload = await parseWaveSpeedJson(response);
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
export async function generateWaveSpeedSpeechPreview(options) {
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
    const response = await fetchWaveSpeed("/minimax/speech-02-turbo", {
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
    }, 60_000);
    const payload = await parseWaveSpeedJson(response);
    if (!response.ok) {
        throw new Error(getWaveSpeedErrorMessage(payload, `WaveSpeed preview request failed (${response.status}).`));
    }
    const outputUrl = extractWaveSpeedOutputUrl(payload) ||
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
