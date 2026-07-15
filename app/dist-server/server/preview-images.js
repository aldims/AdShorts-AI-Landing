import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { createAssetPreparationQueue } from "./asset-preparation-queue.js";
import { env } from "./env.js";
import { logServerEvent } from "./logger.js";
import { createPreparedAssetStore, } from "./prepared-asset-store.js";
import { fetchUpstreamResponse, upstreamPolicies, } from "./upstream-client.js";
const WORKSPACE_PREVIEW_IMAGES_ROOT_DIR = join(env.assetCacheDir, "workspace-preview-images");
const WORKSPACE_PREVIEW_IMAGE_CONCURRENCY = 4;
export const WORKSPACE_PREVIEW_IMAGE_MAX_DIMENSION = 480;
const WORKSPACE_PREVIEW_IMAGE_SCHEMA_VERSION = "preview-v2-480-webp";
const WORKSPACE_PREVIEW_IMAGE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const WORKSPACE_PREVIEW_IMAGE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const previewImageStore = createPreparedAssetStore({
    cleanupIntervalMs: WORKSPACE_PREVIEW_IMAGE_CLEANUP_INTERVAL_MS,
    maxAgeMs: WORKSPACE_PREVIEW_IMAGE_MAX_AGE_MS,
    name: "workspace-preview-images",
    rootDir: WORKSPACE_PREVIEW_IMAGES_ROOT_DIR,
});
const previewImageQueue = createAssetPreparationQueue({
    backgroundConcurrency: 1,
    interactiveConcurrency: WORKSPACE_PREVIEW_IMAGE_CONCURRENCY,
    name: "workspace-preview-images",
});
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const configureWorkspacePreviewImageTransformer = (transformer) => transformer
    .rotate()
    .resize({
    fit: "inside",
    height: WORKSPACE_PREVIEW_IMAGE_MAX_DIMENSION,
    width: WORKSPACE_PREVIEW_IMAGE_MAX_DIMENSION,
    withoutEnlargement: true,
})
    .webp({ effort: 4, quality: 78 });
export const transformWorkspacePreviewImageBuffer = (source) => configureWorkspacePreviewImageTransformer(sharp(source)).toBuffer();
const transformToPreviewBuffer = async (source) => {
    const transformer = configureWorkspacePreviewImageTransformer(sharp());
    if (source.upstreamUrl.protocol === "file:") {
        return configureWorkspacePreviewImageTransformer(sharp(fileURLToPath(source.upstreamUrl))).toBuffer();
    }
    const response = await fetchUpstreamResponse(source.upstreamUrl, {
        headers: source.upstreamHeaders,
    }, upstreamPolicies.previewPreparation, {
        assetKind: "preview-image",
        endpoint: "preview-image.prepare",
    });
    if (!response.ok || !response.body) {
        throw new Error(`Failed to download preview image source (${response.status}).`);
    }
    const imageBufferPromise = new Promise((resolve, reject) => {
        const chunks = [];
        transformer.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        transformer.once("end", () => {
            resolve(Buffer.concat(chunks));
        });
        transformer.once("error", reject);
    });
    await pipeline(Readable.fromWeb(response.body), transformer);
    const imageBuffer = await imageBufferPromise;
    if (!imageBuffer.byteLength) {
        throw new Error("Preview image generation returned an empty image.");
    }
    return imageBuffer;
};
export const getWorkspacePreviewImageCacheKey = (source) => {
    const normalizedVersion = normalizeText(source.version);
    const normalizedTargetUrl = new URL(source.targetUrl.toString());
    normalizedTargetUrl.searchParams.delete("admin_token");
    return `${WORKSPACE_PREVIEW_IMAGE_SCHEMA_VERSION}:${normalizedVersion}:${normalizedTargetUrl.toString()}`;
};
export async function ensureWorkspacePreviewImage(source) {
    previewImageStore.scheduleCleanup();
    await mkdir(WORKSPACE_PREVIEW_IMAGES_ROOT_DIR, { recursive: true });
    const cachedRecord = await previewImageStore.read(source.cacheKey);
    if (cachedRecord) {
        logServerEvent("info", "prepared-asset.cache-hit", {
            assetKind: "preview-image",
            cacheHit: true,
            cacheKey: source.cacheKey,
        });
        return cachedRecord.absolutePath;
    }
    return previewImageQueue.schedule(source.cacheKey, "interactive", async () => {
        const startedAt = Date.now();
        try {
            const buffer = await transformToPreviewBuffer(source);
            const absolutePath = await previewImageStore.writeBufferToFile(source.cacheKey, buffer, {
                contentType: "image/webp",
                fileName: "preview.webp",
                savedAt: new Date().toISOString(),
            });
            logServerEvent("info", "prepared-asset.ready", {
                assetKind: "preview-image",
                cacheHit: false,
                cacheKey: source.cacheKey,
                elapsedMs: Date.now() - startedAt,
            });
            return absolutePath;
        }
        catch (error) {
            logServerEvent("warn", "prepared-asset.failed", {
                assetKind: "preview-image",
                cacheKey: source.cacheKey,
                elapsedMs: Date.now() - startedAt,
                error,
            });
            throw error;
        }
    });
}
