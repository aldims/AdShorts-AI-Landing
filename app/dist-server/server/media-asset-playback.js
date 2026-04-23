import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { createAssetPreparationQueue } from "./asset-preparation-queue.js";
import { env } from "./env.js";
import { logServerEvent } from "./logger.js";
import { createPreparedAssetStore, } from "./prepared-asset-store.js";
import { fetchUpstreamResponse, upstreamPolicies, } from "./upstream-client.js";
export class WorkspaceMediaAssetPlaybackPreparationDeferredError extends Error {
    constructor() {
        super("Media asset playback cache is temporarily unavailable.");
        this.name = "WorkspaceMediaAssetPlaybackPreparationDeferredError";
    }
}
const execFileAsync = promisify(execFile);
const MEDIA_ASSET_PLAYBACK_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const MEDIA_ASSET_PLAYBACK_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MEDIA_ASSET_PLAYBACK_FFMPEG_MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const MEDIA_ASSET_PLAYBACK_FAILURE_TTL_MS = 10 * 60 * 1000;
const MEDIA_ASSET_PLAYBACK_RETRYABLE_FAILURE_TTL_MS = 5_000;
const MEDIA_ASSET_PLAYBACK_INTERACTIVE_CONCURRENCY = 3;
const MEDIA_ASSET_PLAYBACK_BACKGROUND_CONCURRENCY = 1;
const MEDIA_ASSET_PLAYBACK_ROOT_DIR = join(env.assetCacheDir, "media-asset-playback");
const MEDIA_ASSET_PLAYBACK_FFMPEG_TIMEOUT_MS = env.upstreamPlaybackPreparationTimeoutMs;
const MEDIA_ASSET_PLAYBACK_CACHE_VERSION = "v1";
const FFMPEG_BINARY = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
const mediaAssetPlaybackStore = createPreparedAssetStore({
    cleanupIntervalMs: MEDIA_ASSET_PLAYBACK_CLEANUP_INTERVAL_MS,
    maxAgeMs: MEDIA_ASSET_PLAYBACK_MAX_AGE_MS,
    name: "media-asset-playback",
    rootDir: MEDIA_ASSET_PLAYBACK_ROOT_DIR,
});
const mediaAssetPlaybackQueue = createAssetPreparationQueue({
    backgroundConcurrency: MEDIA_ASSET_PLAYBACK_BACKGROUND_CONCURRENCY,
    interactiveConcurrency: MEDIA_ASSET_PLAYBACK_INTERACTIVE_CONCURRENCY,
    name: "media-asset-playback",
});
const recentMediaAssetPlaybackFailures = new Map();
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const hasRecentWorkspaceMediaAssetPlaybackFailure = (cacheKey) => {
    const expiresAt = recentMediaAssetPlaybackFailures.get(cacheKey);
    if (!expiresAt) {
        return false;
    }
    if (expiresAt <= Date.now()) {
        recentMediaAssetPlaybackFailures.delete(cacheKey);
        return false;
    }
    return true;
};
const isWorkspaceMediaAssetPlaybackRetryableError = (error) => {
    const message = normalizeText(error instanceof Error ? error.message : error).toLowerCase();
    return (message.includes("timeout") ||
        message.includes("aborted") ||
        message.includes("failed to download media asset playback source"));
};
const markWorkspaceMediaAssetPlaybackFailure = (cacheKey, error) => {
    const failureTtlMs = isWorkspaceMediaAssetPlaybackRetryableError(error)
        ? MEDIA_ASSET_PLAYBACK_RETRYABLE_FAILURE_TTL_MS
        : MEDIA_ASSET_PLAYBACK_FAILURE_TTL_MS;
    recentMediaAssetPlaybackFailures.set(cacheKey, Date.now() + failureTtlMs);
};
const clearWorkspaceMediaAssetPlaybackFailure = (cacheKey) => {
    recentMediaAssetPlaybackFailures.delete(cacheKey);
};
const inferWorkspaceMediaAssetPlaybackContentType = (value, upstreamUrl) => {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized.startsWith("video/")) {
        return normalized;
    }
    const extension = extname(upstreamUrl.pathname).toLowerCase();
    if (extension === ".webm") {
        return "video/webm";
    }
    if (extension === ".mov") {
        return "video/quicktime";
    }
    if (extension === ".m4v") {
        return "video/x-m4v";
    }
    return "video/mp4";
};
const inferWorkspaceMediaAssetPlaybackExtension = (contentType, upstreamUrl) => {
    const normalizedContentType = normalizeText(contentType).toLowerCase();
    const extension = extname(upstreamUrl.pathname).toLowerCase();
    if (normalizedContentType === "video/webm" || extension === ".webm") {
        return ".webm";
    }
    if (normalizedContentType === "video/quicktime" || extension === ".mov") {
        return ".mov";
    }
    if (normalizedContentType === "video/x-m4v" || extension === ".m4v") {
        return ".m4v";
    }
    return ".mp4";
};
const downloadWorkspaceMediaAssetPlaybackSource = async (source) => {
    const response = await fetchUpstreamResponse(source.upstreamUrl, {
        headers: {
            connection: "close",
        },
    }, upstreamPolicies.playbackPreparation, {
        assetKind: "media-asset-playback",
        endpoint: "media-asset-playback.prepare.download",
        projectId: null,
    });
    if (!response.ok || !response.body) {
        throw new Error(`Failed to download media asset playback source (${response.status}).`);
    }
    const contentType = inferWorkspaceMediaAssetPlaybackContentType(response.headers.get("content-type"), source.upstreamUrl);
    const sourceExtension = inferWorkspaceMediaAssetPlaybackExtension(contentType, source.upstreamUrl);
    const tempBasePath = join(MEDIA_ASSET_PLAYBACK_ROOT_DIR, `${process.pid}-${Date.now()}-${randomUUID()}`);
    const tempDownloadPath = `${tempBasePath}-download${sourceExtension}`;
    try {
        await pipeline(Readable.fromWeb(response.body), createWriteStream(tempDownloadPath));
    }
    catch (error) {
        await rm(tempDownloadPath, { force: true }).catch(() => undefined);
        throw error;
    }
    return {
        contentType,
        sourceExtension,
        tempBasePath,
        tempDownloadPath,
    };
};
const remuxWorkspaceMediaAssetPlaybackFile = async (inputPath, outputPath) => {
    await execFileAsync(FFMPEG_BINARY, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        outputPath,
    ], {
        maxBuffer: MEDIA_ASSET_PLAYBACK_FFMPEG_MAX_BUFFER_BYTES,
        timeout: MEDIA_ASSET_PLAYBACK_FFMPEG_TIMEOUT_MS,
    });
};
const prepareWorkspaceMediaAssetPlaybackAsset = async (source) => {
    mediaAssetPlaybackStore.scheduleCleanup();
    await mkdir(MEDIA_ASSET_PLAYBACK_ROOT_DIR, { recursive: true });
    const cachedAsset = await peekWorkspaceMediaAssetPlaybackAsset(source.cacheKey);
    if (cachedAsset) {
        logServerEvent("info", "prepared-asset.cache-hit", {
            assetId: source.assetId,
            assetKind: "media-asset-playback",
            cacheHit: true,
            cacheKey: source.cacheKey,
            projectId: null,
        });
        return cachedAsset;
    }
    const downloadedSource = await downloadWorkspaceMediaAssetPlaybackSource(source);
    const tempRemuxPath = `${downloadedSource.tempBasePath}-faststart.mp4`;
    let finalContentType = downloadedSource.contentType;
    let finalFileName = `video${downloadedSource.sourceExtension}`;
    let tempOutputPath = downloadedSource.tempDownloadPath;
    try {
        await remuxWorkspaceMediaAssetPlaybackFile(downloadedSource.tempDownloadPath, tempRemuxPath);
        finalContentType = "video/mp4";
        finalFileName = "video.mp4";
        tempOutputPath = tempRemuxPath;
        await rm(downloadedSource.tempDownloadPath, { force: true }).catch(() => undefined);
    }
    catch (error) {
        logServerEvent("warn", "playback.remux-fallback", {
            assetKind: "media-asset-playback",
            error,
            projectId: null,
        });
        await rm(tempRemuxPath, { force: true }).catch(() => undefined);
    }
    const finalPath = await mediaAssetPlaybackStore.commitFile(source.cacheKey, tempOutputPath, {
        contentType: finalContentType,
        fileName: finalFileName,
        savedAt: new Date().toISOString(),
    });
    return {
        absolutePath: finalPath,
        contentType: finalContentType,
    };
};
const ensureWorkspaceMediaAssetPlaybackQueued = (source, priority) => mediaAssetPlaybackQueue.schedule(source.cacheKey, priority, async () => {
    const startedAt = Date.now();
    try {
        const asset = await prepareWorkspaceMediaAssetPlaybackAsset(source);
        clearWorkspaceMediaAssetPlaybackFailure(source.cacheKey);
        logServerEvent("info", "prepared-asset.ready", {
            assetId: source.assetId,
            assetKind: "media-asset-playback",
            cacheHit: false,
            cacheKey: source.cacheKey,
            elapsedMs: Date.now() - startedAt,
            projectId: null,
        });
        return asset;
    }
    catch (error) {
        markWorkspaceMediaAssetPlaybackFailure(source.cacheKey, error);
        logServerEvent("warn", "prepared-asset.failed", {
            assetId: source.assetId,
            assetKind: "media-asset-playback",
            cacheKey: source.cacheKey,
            elapsedMs: Date.now() - startedAt,
            error,
            projectId: null,
        });
        throw error;
    }
});
export const getWorkspaceMediaAssetPlaybackCacheKey = (source) => {
    const normalizedTargetUrl = new URL(source.targetUrl.toString());
    normalizedTargetUrl.searchParams.delete("admin_token");
    normalizedTargetUrl.searchParams.delete("external_user_id");
    return [
        MEDIA_ASSET_PLAYBACK_CACHE_VERSION,
        normalizeText(source.externalUserId),
        normalizeText(source.assetId),
        normalizedTargetUrl.toString(),
    ].join(":");
};
export async function peekWorkspaceMediaAssetPlaybackAsset(cacheKey) {
    mediaAssetPlaybackStore.scheduleCleanup();
    const cachedAsset = await mediaAssetPlaybackStore.read(cacheKey);
    if (!cachedAsset) {
        return null;
    }
    return {
        absolutePath: cachedAsset.absolutePath,
        contentType: cachedAsset.metadata.contentType,
    };
}
export async function ensureWorkspaceMediaAssetPlayback(source) {
    mediaAssetPlaybackStore.scheduleCleanup();
    const cachedAsset = await peekWorkspaceMediaAssetPlaybackAsset(source.cacheKey);
    if (cachedAsset) {
        clearWorkspaceMediaAssetPlaybackFailure(source.cacheKey);
        return cachedAsset;
    }
    if (hasRecentWorkspaceMediaAssetPlaybackFailure(source.cacheKey)) {
        throw new WorkspaceMediaAssetPlaybackPreparationDeferredError();
    }
    const asset = await ensureWorkspaceMediaAssetPlaybackQueued(source, "interactive");
    clearWorkspaceMediaAssetPlaybackFailure(source.cacheKey);
    return asset;
}
export async function warmWorkspaceMediaAssetPlayback(source) {
    if (env.disableBackgroundWarming) {
        return;
    }
    mediaAssetPlaybackStore.scheduleCleanup();
    if (hasRecentWorkspaceMediaAssetPlaybackFailure(source.cacheKey)) {
        return;
    }
    const cachedAsset = await peekWorkspaceMediaAssetPlaybackAsset(source.cacheKey);
    if (cachedAsset) {
        clearWorkspaceMediaAssetPlaybackFailure(source.cacheKey);
        return;
    }
    void ensureWorkspaceMediaAssetPlaybackQueued(source, "background")
        .then(() => {
        clearWorkspaceMediaAssetPlaybackFailure(source.cacheKey);
    })
        .catch((error) => {
        markWorkspaceMediaAssetPlaybackFailure(source.cacheKey, error);
    });
}
