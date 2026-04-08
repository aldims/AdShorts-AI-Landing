import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

import sharp from "sharp";

import { createAssetPreparationQueue } from "./asset-preparation-queue.js";
import { env } from "./env.js";
import { logServerEvent } from "./logger.js";
import {
  createPreparedAssetStore,
  type PreparedAssetMetadata,
} from "./prepared-asset-store.js";
import {
  fetchUpstreamResponse,
  upstreamPolicies,
} from "./upstream-client.js";

type WorkspacePreviewImageSource = {
  cacheKey: string;
  upstreamHeaders?: Record<string, string>;
  upstreamUrl: URL;
};

type WorkspacePreviewImageMetadata = PreparedAssetMetadata;

const WORKSPACE_PREVIEW_IMAGES_ROOT_DIR = join(env.assetCacheDir, "workspace-preview-images");
const WORKSPACE_PREVIEW_IMAGE_CONCURRENCY = 4;
const WORKSPACE_PREVIEW_IMAGE_MAX_DIMENSION = 640;
const WORKSPACE_PREVIEW_IMAGE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const WORKSPACE_PREVIEW_IMAGE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const previewImageStore = createPreparedAssetStore({
  cleanupIntervalMs: WORKSPACE_PREVIEW_IMAGE_CLEANUP_INTERVAL_MS,
  maxAgeMs: WORKSPACE_PREVIEW_IMAGE_MAX_AGE_MS,
  name: "workspace-preview-images",
  rootDir: WORKSPACE_PREVIEW_IMAGES_ROOT_DIR,
});
const previewImageQueue = createAssetPreparationQueue<string>({
  backgroundConcurrency: 1,
  interactiveConcurrency: WORKSPACE_PREVIEW_IMAGE_CONCURRENCY,
  name: "workspace-preview-images",
});

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const transformToPreviewBuffer = async (source: WorkspacePreviewImageSource) => {
  const transformer = sharp()
    .rotate()
    .resize({
      fit: "inside",
      height: WORKSPACE_PREVIEW_IMAGE_MAX_DIMENSION,
      width: WORKSPACE_PREVIEW_IMAGE_MAX_DIMENSION,
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82 });

  if (source.upstreamUrl.protocol === "file:") {
    return sharp(fileURLToPath(source.upstreamUrl))
      .rotate()
      .resize({
        fit: "inside",
        height: WORKSPACE_PREVIEW_IMAGE_MAX_DIMENSION,
        width: WORKSPACE_PREVIEW_IMAGE_MAX_DIMENSION,
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer();
  }

  const response = await fetchUpstreamResponse(
    source.upstreamUrl,
    {
      headers: source.upstreamHeaders,
    },
    upstreamPolicies.previewPreparation,
    {
      assetKind: "preview-image",
      endpoint: "preview-image.prepare",
    },
  );

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download preview image source (${response.status}).`);
  }

  const imageBufferPromise = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    transformer.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    transformer.once("end", () => {
      resolve(Buffer.concat(chunks));
    });
    transformer.once("error", reject);
  });

  await pipeline(Readable.fromWeb(response.body as never), transformer);
  const imageBuffer = await imageBufferPromise;

  if (!imageBuffer.byteLength) {
    throw new Error("Preview image generation returned an empty image.");
  }

  return imageBuffer;
};

export const getWorkspacePreviewImageCacheKey = (source: {
  previewId: string;
  targetUrl: URL;
  version: string;
}) => {
  const normalizedVersion = normalizeText(source.version);
  const normalizedTargetUrl = new URL(source.targetUrl.toString());
  normalizedTargetUrl.searchParams.delete("admin_token");

  return `${normalizedVersion}:${normalizedTargetUrl.toString()}`;
};

export async function ensureWorkspacePreviewImage(source: WorkspacePreviewImageSource): Promise<string> {
  previewImageStore.scheduleCleanup();
  await mkdir(WORKSPACE_PREVIEW_IMAGES_ROOT_DIR, { recursive: true });

  const cachedRecord = await previewImageStore.read<WorkspacePreviewImageMetadata>(source.cacheKey);
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
      const absolutePath = await previewImageStore.writeBufferToFile<WorkspacePreviewImageMetadata>(
        source.cacheKey,
        buffer,
        {
          contentType: "image/jpeg",
          fileName: "preview.jpg",
          savedAt: new Date().toISOString(),
        },
      );

      logServerEvent("info", "prepared-asset.ready", {
        assetKind: "preview-image",
        cacheHit: false,
        cacheKey: source.cacheKey,
        elapsedMs: Date.now() - startedAt,
      });

      return absolutePath;
    } catch (error) {
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
