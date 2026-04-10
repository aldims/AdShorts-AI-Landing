import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { extname, join } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { createAssetPreparationQueue } from "./asset-preparation-queue.js";
import { env } from "./env.js";
import { logServerEvent } from "./logger.js";
import { createPreparedAssetStore, } from "./prepared-asset-store.js";
import { fetchUpstreamResponse, upstreamPolicies, } from "./upstream-client.js";
export class WorkspaceProjectPlaybackPreparationDeferredError extends Error {
    constructor() {
        super("Project playback cache is temporarily unavailable.");
        this.name = "WorkspaceProjectPlaybackPreparationDeferredError";
    }
}
const execFileAsync = promisify(execFile);
const PROJECT_PLAYBACK_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const PROJECT_PLAYBACK_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const PROJECT_PLAYBACK_FFMPEG_MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const PROJECT_PLAYBACK_FAILURE_TTL_MS = 10 * 60 * 1000;
const PROJECT_PLAYBACK_INTERACTIVE_CONCURRENCY = 2;
const PROJECT_PLAYBACK_BACKGROUND_CONCURRENCY = 1;
const PROJECT_PLAYBACK_ROOT_DIR = join(env.assetCacheDir, "project-playback");
const PROJECT_PLAYBACK_FFMPEG_TIMEOUT_MS = env.upstreamPlaybackPreparationTimeoutMs;
const FFMPEG_BINARY = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
const playbackStore = createPreparedAssetStore({
    cleanupIntervalMs: PROJECT_PLAYBACK_CLEANUP_INTERVAL_MS,
    maxAgeMs: PROJECT_PLAYBACK_MAX_AGE_MS,
    name: "project-playback",
    rootDir: PROJECT_PLAYBACK_ROOT_DIR,
});
const playbackQueue = createAssetPreparationQueue({
    backgroundConcurrency: PROJECT_PLAYBACK_BACKGROUND_CONCURRENCY,
    interactiveConcurrency: PROJECT_PLAYBACK_INTERACTIVE_CONCURRENCY,
    name: "project-playback",
});
const projectPlaybackRecentFailures = new Map();
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const hasRecentWorkspaceProjectPlaybackFailure = (cacheKey) => {
    const expiresAt = projectPlaybackRecentFailures.get(cacheKey);
    if (!expiresAt) {
        return false;
    }
    if (expiresAt <= Date.now()) {
        projectPlaybackRecentFailures.delete(cacheKey);
        return false;
    }
    return true;
};
const markWorkspaceProjectPlaybackFailure = (cacheKey) => {
    projectPlaybackRecentFailures.set(cacheKey, Date.now() + PROJECT_PLAYBACK_FAILURE_TTL_MS);
};
const clearWorkspaceProjectPlaybackFailure = (cacheKey) => {
    projectPlaybackRecentFailures.delete(cacheKey);
};
const inferWorkspaceProjectPlaybackContentType = (value, upstreamUrl) => {
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
const inferWorkspaceProjectPlaybackExtension = (contentType, upstreamUrl) => {
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
const downloadWorkspaceProjectPlaybackSource = async (source) => {
    const response = await fetchUpstreamResponse(source.upstreamUrl, {
        headers: {
            connection: "close",
        },
    }, upstreamPolicies.playbackPreparation, {
        assetKind: "playback",
        endpoint: "playback.prepare.download",
        projectId: source.projectId,
    });
    if (!response.ok || !response.body) {
        throw new Error(`Failed to download project playback source (${response.status}).`);
    }
    const contentType = inferWorkspaceProjectPlaybackContentType(response.headers.get("content-type"), source.upstreamUrl);
    const sourceExtension = inferWorkspaceProjectPlaybackExtension(contentType, source.upstreamUrl);
    const tempBasePath = join(PROJECT_PLAYBACK_ROOT_DIR, `${process.pid}-${Date.now()}-${randomUUID()}`);
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
const remuxWorkspaceProjectPlaybackFile = async (inputPath, outputPath) => {
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
        maxBuffer: PROJECT_PLAYBACK_FFMPEG_MAX_BUFFER_BYTES,
        timeout: PROJECT_PLAYBACK_FFMPEG_TIMEOUT_MS,
    });
};
const prepareWorkspaceProjectPlaybackAsset = async (source) => {
    playbackStore.scheduleCleanup();
    await mkdir(PROJECT_PLAYBACK_ROOT_DIR, { recursive: true });
    const cachedAsset = await peekWorkspaceProjectPlaybackAsset(source.cacheKey);
    if (cachedAsset) {
        logServerEvent("info", "prepared-asset.cache-hit", {
            assetKind: "playback",
            cacheHit: true,
            cacheKey: source.cacheKey,
            projectId: source.projectId,
        });
        return cachedAsset;
    }
    const downloadedSource = await downloadWorkspaceProjectPlaybackSource(source);
    const tempRemuxPath = `${downloadedSource.tempBasePath}-faststart.mp4`;
    let finalContentType = downloadedSource.contentType;
    let finalFileName = `video${downloadedSource.sourceExtension}`;
    let tempOutputPath = downloadedSource.tempDownloadPath;
    try {
        await remuxWorkspaceProjectPlaybackFile(downloadedSource.tempDownloadPath, tempRemuxPath);
        finalContentType = "video/mp4";
        finalFileName = "video.mp4";
        tempOutputPath = tempRemuxPath;
        await rm(downloadedSource.tempDownloadPath, { force: true }).catch(() => undefined);
    }
    catch (error) {
        logServerEvent("warn", "playback.remux-fallback", {
            assetKind: "playback",
            error,
            projectId: source.projectId,
        });
        await rm(tempRemuxPath, { force: true }).catch(() => undefined);
    }
    const finalPath = await playbackStore.commitFile(source.cacheKey, tempOutputPath, {
        contentType: finalContentType,
        fileName: finalFileName,
        savedAt: new Date().toISOString(),
    });
    return {
        absolutePath: finalPath,
        contentType: finalContentType,
    };
};
const ensureWorkspaceProjectPlaybackQueued = (source, priority) => playbackQueue.schedule(source.cacheKey, priority, async () => {
    const startedAt = Date.now();
    try {
        const asset = await prepareWorkspaceProjectPlaybackAsset(source);
        clearWorkspaceProjectPlaybackFailure(source.cacheKey);
        logServerEvent("info", "prepared-asset.ready", {
            assetKind: "playback",
            cacheHit: false,
            cacheKey: source.cacheKey,
            elapsedMs: Date.now() - startedAt,
            projectId: source.projectId,
        });
        return asset;
    }
    catch (error) {
        markWorkspaceProjectPlaybackFailure(source.cacheKey);
        logServerEvent("warn", "prepared-asset.failed", {
            assetKind: "playback",
            cacheKey: source.cacheKey,
            elapsedMs: Date.now() - startedAt,
            error,
            projectId: source.projectId,
        });
        throw error;
    }
});
export const getWorkspaceProjectPlaybackCacheKey = (source) => {
    const normalizedProjectId = normalizeText(source.projectId);
    const normalizedUpdatedAt = normalizeText(source.updatedAt);
    const normalizedTargetUrl = new URL(source.targetUrl.toString());
    normalizedTargetUrl.searchParams.delete("admin_token");
    return `${normalizedProjectId}:${normalizedUpdatedAt}:${normalizedTargetUrl.toString()}`;
};
export async function peekWorkspaceProjectPlaybackAsset(cacheKey) {
    playbackStore.scheduleCleanup();
    const cachedAsset = await playbackStore.read(cacheKey);
    if (!cachedAsset) {
        return null;
    }
    return {
        absolutePath: cachedAsset.absolutePath,
        contentType: cachedAsset.metadata.contentType,
    };
}
export async function ensureWorkspaceProjectPlayback(source) {
    playbackStore.scheduleCleanup();
    const cachedAsset = await peekWorkspaceProjectPlaybackAsset(source.cacheKey);
    if (cachedAsset) {
        clearWorkspaceProjectPlaybackFailure(source.cacheKey);
        return cachedAsset;
    }
    if (hasRecentWorkspaceProjectPlaybackFailure(source.cacheKey)) {
        throw new WorkspaceProjectPlaybackPreparationDeferredError();
    }
    const asset = await ensureWorkspaceProjectPlaybackQueued(source, "interactive");
    clearWorkspaceProjectPlaybackFailure(source.cacheKey);
    return asset;
}
export async function warmWorkspaceProjectPlayback(source) {
    if (env.disableBackgroundWarming) {
        return;
    }
    playbackStore.scheduleCleanup();
    if (hasRecentWorkspaceProjectPlaybackFailure(source.cacheKey)) {
        return;
    }
    const cachedAsset = await peekWorkspaceProjectPlaybackAsset(source.cacheKey);
    if (cachedAsset) {
        clearWorkspaceProjectPlaybackFailure(source.cacheKey);
        return;
    }
    try {
        await ensureWorkspaceProjectPlaybackQueued(source, "background");
        clearWorkspaceProjectPlaybackFailure(source.cacheKey);
    }
    catch (error) {
        markWorkspaceProjectPlaybackFailure(source.cacheKey);
        throw error;
    }
}
