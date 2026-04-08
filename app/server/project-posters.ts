import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { createAssetPreparationQueue, type AssetPreparationPriority } from "./asset-preparation-queue.js";
import { env } from "./env.js";
import { logServerEvent } from "./logger.js";
import {
  createPreparedAssetStore,
  type PreparedAssetMetadata,
} from "./prepared-asset-store.js";

type WorkspacePosterSource = {
  cacheKey: string;
  upstreamHeaders?: Record<string, string>;
  upstreamUrl: URL;
};

export type WorkspaceVideoPosterSource = WorkspacePosterSource & {
  posterId: string;
};

export type WorkspaceProjectPosterSource = WorkspacePosterSource & {
  projectId: string;
};

type WorkspacePosterMetadata = PreparedAssetMetadata;

const execFileAsync = promisify(execFile);

const PROJECT_POSTER_CAPTURE_CONCURRENCY = 4;
const PROJECT_POSTER_CAPTURE_MAX_DIMENSION = 1280;
const PROJECT_POSTER_FFMPEG_TIMEOUT_MS = env.upstreamPlaybackPreparationTimeoutMs;
const PROJECT_POSTER_FFMPEG_MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const PROJECT_POSTER_FRAME_TIMES_SECONDS = [0.15, 0];
const PROJECT_POSTER_ROOT_DIR = join(env.assetCacheDir, "project-posters");
const PROJECT_POSTER_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const PROJECT_POSTER_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const FFMPEG_BINARY = process.env.FFMPEG_PATH?.trim() || "ffmpeg";

const posterStore = createPreparedAssetStore({
  cleanupIntervalMs: PROJECT_POSTER_CLEANUP_INTERVAL_MS,
  maxAgeMs: PROJECT_POSTER_MAX_AGE_MS,
  name: "project-posters",
  rootDir: PROJECT_POSTER_ROOT_DIR,
});
const posterQueue = createAssetPreparationQueue<string>({
  backgroundConcurrency: 1,
  interactiveConcurrency: PROJECT_POSTER_CAPTURE_CONCURRENCY,
  name: "project-posters",
});

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const describeProjectPosterError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return fallbackMessage;
  }

  if (error instanceof Error) {
    const normalizedMessage = error.message.trim().toLowerCase();
    if (
      normalizedMessage.includes("timed out") ||
      normalizedMessage.includes("timeout") ||
      normalizedMessage.includes("command failed:")
    ) {
      return fallbackMessage;
    }

    return error.message.trim() || fallbackMessage;
  }

  return fallbackMessage;
};

const resolvePosterCaptureInput = (upstreamUrl: URL) =>
  upstreamUrl.protocol === "file:" ? fileURLToPath(upstreamUrl) : upstreamUrl.toString();

const buildFfmpegHeaderArgs = (upstreamUrl: URL, upstreamHeaders?: Record<string, string>) => {
  if ((upstreamUrl.protocol !== "http:" && upstreamUrl.protocol !== "https:") || !upstreamHeaders) {
    return [] as string[];
  }

  const headerLines = Object.entries(upstreamHeaders)
    .map(([key, value]) => [normalizeText(key), normalizeText(value)] as const)
    .filter(([key, value]) => key && value)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\r\n");

  return headerLines ? ["-headers", `${headerLines}\r\n`] : [];
};

const runPosterCaptureCommand = async (source: WorkspacePosterSource, frameTimeSeconds: number) => {
  let stdout: Buffer;

  try {
    ({ stdout } = await execFileAsync(
      FFMPEG_BINARY,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        String(frameTimeSeconds),
        ...buildFfmpegHeaderArgs(source.upstreamUrl, source.upstreamHeaders),
        "-i",
        resolvePosterCaptureInput(source.upstreamUrl),
        "-frames:v",
        "1",
        "-vf",
        `scale=${PROJECT_POSTER_CAPTURE_MAX_DIMENSION}:${PROJECT_POSTER_CAPTURE_MAX_DIMENSION}:force_original_aspect_ratio=decrease`,
        "-q:v",
        "2",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "pipe:1",
      ],
      {
        encoding: "buffer",
        maxBuffer: PROJECT_POSTER_FFMPEG_MAX_BUFFER_BYTES,
        timeout: PROJECT_POSTER_FFMPEG_TIMEOUT_MS,
      },
    ));
  } catch (error) {
    throw new Error(describeProjectPosterError(error, "Project poster capture timed out."));
  }

  if (!Buffer.isBuffer(stdout) || stdout.byteLength === 0) {
    throw new Error("Poster capture returned an empty image.");
  }

  return stdout;
};

const capturePosterBuffer = async (source: WorkspacePosterSource) => {
  let lastError: Error | null = null;

  for (const frameTimeSeconds of PROJECT_POSTER_FRAME_TIMES_SECONDS) {
    try {
      return await runPosterCaptureCommand(source, frameTimeSeconds);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Poster capture failed.");
    }
  }

  throw lastError ?? new Error("Poster capture failed.");
};

const ensureWorkspacePoster = async (
  source: WorkspacePosterSource,
  priority: AssetPreparationPriority,
  assetKind: string,
  assetId: string,
) =>
  posterQueue.schedule(source.cacheKey, priority, async () => {
    posterStore.scheduleCleanup();
    await mkdir(PROJECT_POSTER_ROOT_DIR, { recursive: true });

    const cachedRecord = await posterStore.read<WorkspacePosterMetadata>(source.cacheKey);
    if (cachedRecord) {
      logServerEvent("info", "prepared-asset.cache-hit", {
        assetId,
        assetKind,
        cacheHit: true,
        cacheKey: source.cacheKey,
      });
      return cachedRecord.absolutePath;
    }

    const startedAt = Date.now();
    try {
      const posterBuffer = await capturePosterBuffer(source);
      const absolutePath = await posterStore.writeBufferToFile<WorkspacePosterMetadata>(
        source.cacheKey,
        posterBuffer,
        {
          contentType: "image/jpeg",
          fileName: "poster.jpg",
          savedAt: new Date().toISOString(),
        },
      );

      logServerEvent("info", "prepared-asset.ready", {
        assetId,
        assetKind,
        cacheHit: false,
        cacheKey: source.cacheKey,
        elapsedMs: Date.now() - startedAt,
      });

      return absolutePath;
    } catch (error) {
      logServerEvent("warn", "prepared-asset.failed", {
        assetId,
        assetKind,
        cacheKey: source.cacheKey,
        elapsedMs: Date.now() - startedAt,
        error,
      });
      throw error;
    }
  });

export const getWorkspaceVideoPosterCacheKey = (source: {
  posterId: string;
  targetUrl: URL;
  version: string;
}) => {
  const normalizedPosterId = normalizeText(source.posterId);
  const normalizedVersion = normalizeText(source.version);
  const normalizedTargetUrl = new URL(source.targetUrl.toString());
  normalizedTargetUrl.searchParams.delete("admin_token");

  return `${normalizedPosterId}:${normalizedVersion}:${normalizedTargetUrl.toString()}`;
};

export const getWorkspaceProjectPosterCacheKey = (source: {
  projectId: string;
  targetUrl: URL;
  updatedAt: string;
}) =>
  getWorkspaceVideoPosterCacheKey({
    posterId: source.projectId,
    targetUrl: source.targetUrl,
    version: source.updatedAt,
  });

export async function peekWorkspaceVideoPosterPath(cacheKey: string): Promise<string | null> {
  posterStore.scheduleCleanup();
  const record = await posterStore.read<WorkspacePosterMetadata>(cacheKey);
  return record?.absolutePath ?? null;
}

export async function ensureWorkspaceVideoPoster(source: WorkspacePosterSource): Promise<string> {
  return ensureWorkspacePoster(source, "interactive", "poster", source.cacheKey);
}

export async function ensureWorkspaceProjectPoster(source: WorkspaceProjectPosterSource): Promise<string> {
  return ensureWorkspacePoster(source, "interactive", "project-poster", source.projectId);
}

export async function warmWorkspaceVideoPoster(source: WorkspacePosterSource): Promise<void> {
  if (env.disableBackgroundWarming) {
    return;
  }

  const cachedPath = await peekWorkspaceVideoPosterPath(source.cacheKey);
  if (cachedPath) {
    return;
  }

  await ensureWorkspacePoster(source, "background", "poster", source.cacheKey);
}

export async function warmWorkspaceProjectPoster(source: WorkspaceProjectPosterSource): Promise<void> {
  if (env.disableBackgroundWarming) {
    return;
  }

  const cachedPath = await peekWorkspaceVideoPosterPath(source.cacheKey);
  if (cachedPath) {
    return;
  }

  await ensureWorkspacePoster(source, "background", "project-poster", source.projectId);
}
