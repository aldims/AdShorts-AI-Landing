import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { extname, join } from "node:path";

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

export type WorkspaceSegmentVideoCacheSource = {
  cacheKey: string;
  delivery: string;
  projectId: string;
  segmentIndex: number;
  source: string;
  upstreamHeaders?: Record<string, string>;
  upstreamUrl: URL;
};

export type WorkspaceSegmentVideoCacheAsset = {
  absolutePath: string;
  contentType: string;
};

type WorkspaceSegmentVideoCacheMetadata = PreparedAssetMetadata;

const SEGMENT_VIDEO_CACHE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const SEGMENT_VIDEO_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SEGMENT_VIDEO_CACHE_ROOT_DIR = join(env.assetCacheDir, "segment-videos");
const SEGMENT_VIDEO_CACHE_INTERACTIVE_CONCURRENCY = 3;
const SEGMENT_VIDEO_CACHE_BACKGROUND_CONCURRENCY = 1;

const segmentVideoStore = createPreparedAssetStore({
  cleanupIntervalMs: SEGMENT_VIDEO_CACHE_CLEANUP_INTERVAL_MS,
  maxAgeMs: SEGMENT_VIDEO_CACHE_MAX_AGE_MS,
  name: "segment-videos",
  rootDir: SEGMENT_VIDEO_CACHE_ROOT_DIR,
});
const segmentVideoQueue = createAssetPreparationQueue<WorkspaceSegmentVideoCacheAsset>({
  backgroundConcurrency: SEGMENT_VIDEO_CACHE_BACKGROUND_CONCURRENCY,
  interactiveConcurrency: SEGMENT_VIDEO_CACHE_INTERACTIVE_CONCURRENCY,
  name: "segment-videos",
});

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const inferSegmentVideoContentType = (value: string | null | undefined, upstreamUrl: URL) => {
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

const inferSegmentVideoExtension = (contentType: string, upstreamUrl: URL) => {
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

const downloadWorkspaceSegmentVideo = async (source: WorkspaceSegmentVideoCacheSource) => {
  const response = await fetchUpstreamResponse(
    source.upstreamUrl,
    {
      headers: {
        ...(source.upstreamHeaders ?? {}),
        connection: "close",
      },
    },
    upstreamPolicies.playbackPreparation,
    {
      assetKind: "segment-video",
      endpoint: "segment-video.prepare.download",
      projectId: source.projectId,
    },
  );

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download segment video source (${response.status}).`);
  }

  const contentType = inferSegmentVideoContentType(response.headers.get("content-type"), source.upstreamUrl);
  const extension = inferSegmentVideoExtension(contentType, source.upstreamUrl);
  const tempPath = join(
    SEGMENT_VIDEO_CACHE_ROOT_DIR,
    `${process.pid}-${Date.now()}-${randomUUID()}${extension}`,
  );

  try {
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(tempPath));
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }

  return {
    contentType,
    extension,
    tempPath,
  };
};

const prepareWorkspaceSegmentVideoCacheAsset = async (
  source: WorkspaceSegmentVideoCacheSource,
): Promise<WorkspaceSegmentVideoCacheAsset> => {
  segmentVideoStore.scheduleCleanup();
  await mkdir(SEGMENT_VIDEO_CACHE_ROOT_DIR, { recursive: true });

  const cachedAsset = await peekWorkspaceSegmentVideoCacheAsset(source.cacheKey);
  if (cachedAsset) {
    logServerEvent("info", "prepared-asset.cache-hit", {
      assetKind: "segment-video",
      cacheHit: true,
      cacheKey: source.cacheKey,
      projectId: source.projectId,
      segmentIndex: source.segmentIndex,
    });
    return cachedAsset;
  }

  const downloaded = await downloadWorkspaceSegmentVideo(source);
  const finalPath = await segmentVideoStore.commitFile<WorkspaceSegmentVideoCacheMetadata>(
    source.cacheKey,
    downloaded.tempPath,
    {
      contentType: downloaded.contentType,
      fileName: `segment-video${downloaded.extension}`,
      savedAt: new Date().toISOString(),
    },
  );

  return {
    absolutePath: finalPath,
    contentType: downloaded.contentType,
  };
};

export const getWorkspaceSegmentVideoCacheKey = (source: {
  delivery: string;
  projectId: string;
  segmentIndex: number;
  source: string;
  targetUrl: URL;
  version: string;
}) => {
  const normalizedTargetUrl = new URL(source.targetUrl.toString());
  normalizedTargetUrl.searchParams.delete("admin_token");

  return [
    normalizeText(source.projectId),
    normalizeText(source.segmentIndex),
    normalizeText(source.source),
    normalizeText(source.delivery),
    normalizeText(source.version),
    normalizedTargetUrl.toString(),
  ].join(":");
};

export async function peekWorkspaceSegmentVideoCacheAsset(
  cacheKey: string,
): Promise<WorkspaceSegmentVideoCacheAsset | null> {
  segmentVideoStore.scheduleCleanup();
  const cachedAsset = await segmentVideoStore.read<WorkspaceSegmentVideoCacheMetadata>(cacheKey);
  if (!cachedAsset) {
    return null;
  }

  return {
    absolutePath: cachedAsset.absolutePath,
    contentType: cachedAsset.metadata.contentType,
  };
}

export async function ensureWorkspaceSegmentVideoCache(
  source: WorkspaceSegmentVideoCacheSource,
): Promise<WorkspaceSegmentVideoCacheAsset> {
  segmentVideoStore.scheduleCleanup();

  const cachedAsset = await peekWorkspaceSegmentVideoCacheAsset(source.cacheKey);
  if (cachedAsset) {
    return cachedAsset;
  }

  return segmentVideoQueue.schedule(source.cacheKey, "interactive", async () => {
    const startedAt = Date.now();
    const asset = await prepareWorkspaceSegmentVideoCacheAsset(source);
    logServerEvent("info", "prepared-asset.ready", {
      assetKind: "segment-video",
      cacheHit: false,
      cacheKey: source.cacheKey,
      elapsedMs: Date.now() - startedAt,
      projectId: source.projectId,
      segmentIndex: source.segmentIndex,
    });
    return asset;
  });
}
