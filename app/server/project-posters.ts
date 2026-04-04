import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { env } from "./env.js";

type WorkspacePosterSource = {
  cacheKey: string;
  upstreamUrl: URL;
};

export type WorkspaceVideoPosterSource = WorkspacePosterSource & {
  posterId: string;
};

export type WorkspaceProjectPosterSource = WorkspacePosterSource & {
  projectId: string;
};

const execFileAsync = promisify(execFile);

const PROJECT_POSTERS_ROOT_DIR = join(env.dataDir, "project-posters");
const PROJECT_POSTER_CAPTURE_CONCURRENCY = 4;
const PROJECT_POSTER_CAPTURE_MAX_DIMENSION = 1280;
const PROJECT_POSTER_FFMPEG_TIMEOUT_MS = 45_000;
const PROJECT_POSTER_FFMPEG_MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const PROJECT_POSTER_FRAME_TIMES_SECONDS = [0.15, 0];
const projectPosterGenerationQueue: Array<() => void> = [];
const projectPosterGenerationRequests = new Map<string, Promise<string>>();
let activeProjectPosterGenerationCount = 0;
const FFMPEG_BINARY = process.env.FFMPEG_PATH?.trim() || "ffmpeg";

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const getProjectPosterFileHash = (cacheKey: string) => createHash("sha256").update(cacheKey).digest("hex");

const getProjectPosterFilePath = (cacheKey: string) =>
  join(PROJECT_POSTERS_ROOT_DIR, `${getProjectPosterFileHash(cacheKey)}.jpg`);

const projectPosterExists = async (cacheKey: string) => {
  try {
    await access(getProjectPosterFilePath(cacheKey), fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const flushProjectPosterGenerationQueue = () => {
  while (
    activeProjectPosterGenerationCount < PROJECT_POSTER_CAPTURE_CONCURRENCY &&
    projectPosterGenerationQueue.length > 0
  ) {
    const nextTask = projectPosterGenerationQueue.shift();
    if (!nextTask) {
      break;
    }

    activeProjectPosterGenerationCount += 1;
    nextTask();
  }
};

const enqueueProjectPosterGeneration = <T>(task: () => Promise<T>) =>
  new Promise<T>((resolve, reject) => {
    const runTask = () => {
      void task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeProjectPosterGenerationCount = Math.max(0, activeProjectPosterGenerationCount - 1);
          flushProjectPosterGenerationQueue();
        });
    };

    projectPosterGenerationQueue.push(runTask);
    flushProjectPosterGenerationQueue();
  });

const resolvePosterCaptureInput = (upstreamUrl: URL) =>
  upstreamUrl.protocol === "file:" ? fileURLToPath(upstreamUrl) : upstreamUrl.toString();

const runPosterCaptureCommand = async (upstreamUrl: URL, frameTimeSeconds: number) => {
  const { stdout } = await execFileAsync(
    FFMPEG_BINARY,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      String(frameTimeSeconds),
      "-i",
      resolvePosterCaptureInput(upstreamUrl),
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
  );

  if (!Buffer.isBuffer(stdout) || stdout.byteLength === 0) {
    throw new Error("Poster capture returned an empty image.");
  }

  return stdout;
};

const capturePosterBuffer = async (upstreamUrl: URL) => {
  let lastError: Error | null = null;

  for (const frameTimeSeconds of PROJECT_POSTER_FRAME_TIMES_SECONDS) {
    try {
      return await runPosterCaptureCommand(upstreamUrl, frameTimeSeconds);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Poster capture failed.");
    }
  }

  throw lastError ?? new Error("Poster capture failed.");
};

const generateProjectPosterFile = async (source: WorkspacePosterSource) => {
  await mkdir(PROJECT_POSTERS_ROOT_DIR, { recursive: true });

  const outputPath = getProjectPosterFilePath(source.cacheKey);
  if (await projectPosterExists(source.cacheKey)) {
    return outputPath;
  }

  const tempFilePath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;

  try {
    const posterBuffer = await capturePosterBuffer(source.upstreamUrl);
    await writeFile(tempFilePath, posterBuffer);
    await rename(tempFilePath, outputPath);
    return outputPath;
  } catch (error) {
    await rm(tempFilePath, { force: true }).catch(() => undefined);
    throw error;
  }
};

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

export async function ensureWorkspaceVideoPoster(source: WorkspacePosterSource): Promise<string> {
  if (await projectPosterExists(source.cacheKey)) {
    return getProjectPosterFilePath(source.cacheKey);
  }

  const inFlightRequest = projectPosterGenerationRequests.get(source.cacheKey);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = enqueueProjectPosterGeneration(() => generateProjectPosterFile(source)).finally(() => {
    projectPosterGenerationRequests.delete(source.cacheKey);
  });

  projectPosterGenerationRequests.set(source.cacheKey, request);
  return request;
}

export async function ensureWorkspaceProjectPoster(source: WorkspaceProjectPosterSource): Promise<string> {
  return ensureWorkspaceVideoPoster(source);
}

export async function warmWorkspaceVideoPoster(source: WorkspacePosterSource): Promise<void> {
  await ensureWorkspaceVideoPoster(source);
}

export async function warmWorkspaceProjectPoster(source: WorkspaceProjectPosterSource): Promise<void> {
  await warmWorkspaceVideoPoster(source);
}
