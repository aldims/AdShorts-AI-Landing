import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { createAssetPreparationQueue } from "./asset-preparation-queue.js";
import { env } from "./env.js";
import { logServerEvent } from "./logger.js";
import { createPreparedAssetStore, } from "./prepared-asset-store.js";
export class WorkspaceProjectSegmentPlaybackPreparationDeferredError extends Error {
    constructor() {
        super("Project segment playback cache is temporarily unavailable.");
        this.name = "WorkspaceProjectSegmentPlaybackPreparationDeferredError";
    }
}
const execFileAsync = promisify(execFile);
const PROJECT_SEGMENT_PLAYBACK_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const PROJECT_SEGMENT_PLAYBACK_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const PROJECT_SEGMENT_PLAYBACK_FFMPEG_MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const PROJECT_SEGMENT_PLAYBACK_FAILURE_TTL_MS = 10 * 60 * 1000;
const PROJECT_SEGMENT_PLAYBACK_INTERACTIVE_CONCURRENCY = 3;
const PROJECT_SEGMENT_PLAYBACK_BACKGROUND_CONCURRENCY = 1;
const PROJECT_SEGMENT_PLAYBACK_ROOT_DIR = join(env.assetCacheDir, "project-segment-playback");
const PROJECT_SEGMENT_PLAYBACK_FFMPEG_TIMEOUT_MS = env.upstreamPlaybackPreparationTimeoutMs;
const PROJECT_SEGMENT_PLAYBACK_CACHE_VERSION = "v2-subtitle-scrub";
const PROJECT_SEGMENT_PLAYBACK_SUBTITLE_SCRUB_TOP_RATIO = 0.7;
const PROJECT_SEGMENT_PLAYBACK_SUBTITLE_SCRUB_BLUR_RADIUS = 26;
const PROJECT_SEGMENT_PLAYBACK_SUBTITLE_SCRUB_BLUR_POWER = 2;
const PROJECT_SEGMENT_PLAYBACK_SUBTITLE_SCRUB_DARKEN_ALPHA = 0.22;
const FFMPEG_BINARY = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
const segmentPlaybackStore = createPreparedAssetStore({
    cleanupIntervalMs: PROJECT_SEGMENT_PLAYBACK_CLEANUP_INTERVAL_MS,
    maxAgeMs: PROJECT_SEGMENT_PLAYBACK_MAX_AGE_MS,
    name: "project-segment-playback",
    rootDir: PROJECT_SEGMENT_PLAYBACK_ROOT_DIR,
});
const segmentPlaybackQueue = createAssetPreparationQueue({
    backgroundConcurrency: PROJECT_SEGMENT_PLAYBACK_BACKGROUND_CONCURRENCY,
    interactiveConcurrency: PROJECT_SEGMENT_PLAYBACK_INTERACTIVE_CONCURRENCY,
    name: "project-segment-playback",
});
const recentSegmentPlaybackFailures = new Map();
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeSegmentBoundary = (value) => {
    const numeric = Number.isFinite(value) ? Math.max(0, value) : 0;
    return Number(numeric.toFixed(3));
};
const formatFfmpegTime = (value) => normalizeSegmentBoundary(value).toFixed(3);
const buildWorkspaceProjectSegmentPlaybackVideoFilter = () => {
    const scrubTopRatio = PROJECT_SEGMENT_PLAYBACK_SUBTITLE_SCRUB_TOP_RATIO.toFixed(2);
    const scrubHeightRatio = (1 - PROJECT_SEGMENT_PLAYBACK_SUBTITLE_SCRUB_TOP_RATIO).toFixed(2);
    return [
        // These clips are derived from the final project playback, so we scrub the lower subtitle band.
        "[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,split=2[base][subtitle_band_source]",
        `[subtitle_band_source]crop=iw:ih*${scrubHeightRatio}:0:ih*${scrubTopRatio},boxblur=${PROJECT_SEGMENT_PLAYBACK_SUBTITLE_SCRUB_BLUR_RADIUS}:${PROJECT_SEGMENT_PLAYBACK_SUBTITLE_SCRUB_BLUR_POWER}[subtitle_band]`,
        `[base][subtitle_band]overlay=0:H-h,drawbox=x=0:y=ih*${scrubTopRatio}:w=iw:h=ih*${scrubHeightRatio}:color=black@${PROJECT_SEGMENT_PLAYBACK_SUBTITLE_SCRUB_DARKEN_ALPHA}:t=fill[video]`,
    ].join(";");
};
const hasRecentWorkspaceProjectSegmentPlaybackFailure = (cacheKey) => {
    const expiresAt = recentSegmentPlaybackFailures.get(cacheKey);
    if (!expiresAt) {
        return false;
    }
    if (expiresAt <= Date.now()) {
        recentSegmentPlaybackFailures.delete(cacheKey);
        return false;
    }
    return true;
};
const markWorkspaceProjectSegmentPlaybackFailure = (cacheKey) => {
    recentSegmentPlaybackFailures.set(cacheKey, Date.now() + PROJECT_SEGMENT_PLAYBACK_FAILURE_TTL_MS);
};
const clearWorkspaceProjectSegmentPlaybackFailure = (cacheKey) => {
    recentSegmentPlaybackFailures.delete(cacheKey);
};
const clipWorkspaceProjectSegmentPlaybackFile = async (source, outputPath) => {
    await execFileAsync(FFMPEG_BINARY, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        source.inputPath,
        "-ss",
        formatFfmpegTime(source.startTime),
        "-t",
        formatFfmpegTime(source.duration),
        "-filter_complex",
        buildWorkspaceProjectSegmentPlaybackVideoFilter(),
        "-map",
        "[video]",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        outputPath,
    ], {
        maxBuffer: PROJECT_SEGMENT_PLAYBACK_FFMPEG_MAX_BUFFER_BYTES,
        timeout: PROJECT_SEGMENT_PLAYBACK_FFMPEG_TIMEOUT_MS,
    });
};
const prepareWorkspaceProjectSegmentPlaybackAsset = async (source) => {
    segmentPlaybackStore.scheduleCleanup();
    await mkdir(PROJECT_SEGMENT_PLAYBACK_ROOT_DIR, { recursive: true });
    const cachedAsset = await peekWorkspaceProjectSegmentPlaybackAsset(source.cacheKey);
    if (cachedAsset) {
        logServerEvent("info", "prepared-asset.cache-hit", {
            assetKind: "segment-playback",
            cacheHit: true,
            cacheKey: source.cacheKey,
            projectId: source.projectId,
            segmentIndex: source.segmentIndex,
        });
        return cachedAsset;
    }
    const tempOutputPath = join(PROJECT_SEGMENT_PLAYBACK_ROOT_DIR, `${process.pid}-${Date.now()}-${randomUUID()}-segment.mp4`);
    try {
        await clipWorkspaceProjectSegmentPlaybackFile(source, tempOutputPath);
        const finalPath = await segmentPlaybackStore.commitFile(source.cacheKey, tempOutputPath, {
            contentType: "video/mp4",
            fileName: "video.mp4",
            savedAt: new Date().toISOString(),
        });
        return {
            absolutePath: finalPath,
            contentType: "video/mp4",
        };
    }
    catch (error) {
        await rm(tempOutputPath, { force: true }).catch(() => undefined);
        throw error;
    }
};
const ensureWorkspaceProjectSegmentPlaybackQueued = (source, priority) => segmentPlaybackQueue.schedule(source.cacheKey, priority, async () => {
    const startedAt = Date.now();
    try {
        const asset = await prepareWorkspaceProjectSegmentPlaybackAsset(source);
        clearWorkspaceProjectSegmentPlaybackFailure(source.cacheKey);
        logServerEvent("info", "prepared-asset.ready", {
            assetKind: "segment-playback",
            cacheHit: false,
            cacheKey: source.cacheKey,
            elapsedMs: Date.now() - startedAt,
            projectId: source.projectId,
            segmentIndex: source.segmentIndex,
        });
        return asset;
    }
    catch (error) {
        markWorkspaceProjectSegmentPlaybackFailure(source.cacheKey);
        logServerEvent("warn", "prepared-asset.failed", {
            assetKind: "segment-playback",
            cacheKey: source.cacheKey,
            elapsedMs: Date.now() - startedAt,
            error,
            projectId: source.projectId,
            segmentIndex: source.segmentIndex,
        });
        throw error;
    }
});
export const getWorkspaceProjectSegmentPlaybackCacheKey = (source) => [
    PROJECT_SEGMENT_PLAYBACK_CACHE_VERSION,
    normalizeText(source.projectId),
    normalizeText(source.segmentIndex),
    normalizeSegmentBoundary(source.startTime).toFixed(3),
    normalizeSegmentBoundary(source.duration).toFixed(3),
    normalizeText(source.inputPath),
].join(":");
export async function peekWorkspaceProjectSegmentPlaybackAsset(cacheKey) {
    segmentPlaybackStore.scheduleCleanup();
    const cachedAsset = await segmentPlaybackStore.read(cacheKey);
    if (!cachedAsset) {
        return null;
    }
    return {
        absolutePath: cachedAsset.absolutePath,
        contentType: cachedAsset.metadata.contentType,
    };
}
export async function ensureWorkspaceProjectSegmentPlayback(source) {
    segmentPlaybackStore.scheduleCleanup();
    const cachedAsset = await peekWorkspaceProjectSegmentPlaybackAsset(source.cacheKey);
    if (cachedAsset) {
        clearWorkspaceProjectSegmentPlaybackFailure(source.cacheKey);
        return cachedAsset;
    }
    if (hasRecentWorkspaceProjectSegmentPlaybackFailure(source.cacheKey)) {
        throw new WorkspaceProjectSegmentPlaybackPreparationDeferredError();
    }
    const asset = await ensureWorkspaceProjectSegmentPlaybackQueued(source, "interactive");
    clearWorkspaceProjectSegmentPlaybackFailure(source.cacheKey);
    return asset;
}
