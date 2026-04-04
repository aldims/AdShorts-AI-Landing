import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { constants as fsConstants } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  access,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { extname, join } from "node:path";
import { promisify } from "node:util";

import { env } from "./env.js";

export type WorkspaceProjectPlaybackSource = {
  cacheKey: string;
  projectId: string;
  upstreamUrl: URL;
};

export type WorkspaceProjectPlaybackAsset = {
  absolutePath: string;
  contentType: string;
};

type WorkspaceProjectPlaybackPriority = "background" | "interactive";

type WorkspaceProjectPlaybackTask = {
  priority: WorkspaceProjectPlaybackPriority;
  promise: Promise<WorkspaceProjectPlaybackAsset>;
  reject: (error: unknown) => void;
  resolve: (asset: WorkspaceProjectPlaybackAsset) => void;
  run: () => void;
  source: WorkspaceProjectPlaybackSource;
  started: boolean;
};

type WorkspaceProjectPlaybackMetadata = {
  contentType: string;
  fileName: string;
  savedAt: string;
};

const execFileAsync = promisify(execFile);

const PROJECT_PLAYBACK_ROOT_DIR = join(env.dataDir, "project-playback");
const PROJECT_PLAYBACK_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const PROJECT_PLAYBACK_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const PROJECT_PLAYBACK_DOWNLOAD_TIMEOUT_MS = 120_000;
const PROJECT_PLAYBACK_FFMPEG_TIMEOUT_MS = 120_000;
const PROJECT_PLAYBACK_FFMPEG_MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const PROJECT_PLAYBACK_INTERACTIVE_CONCURRENCY = 2;
const PROJECT_PLAYBACK_BACKGROUND_CONCURRENCY = 1;
const projectPlaybackInteractiveQueue: WorkspaceProjectPlaybackTask[] = [];
const projectPlaybackBackgroundQueue: WorkspaceProjectPlaybackTask[] = [];
const projectPlaybackTasks = new Map<string, WorkspaceProjectPlaybackTask>();
let activeProjectPlaybackInteractiveCount = 0;
let activeProjectPlaybackBackgroundCount = 0;
let projectPlaybackCleanupPromise: Promise<void> | null = null;
let lastProjectPlaybackCleanupAt = 0;
const FFMPEG_BINARY = process.env.FFMPEG_PATH?.trim() || "ffmpeg";

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const getWorkspaceProjectPlaybackHash = (cacheKey: string) =>
  createHash("sha256").update(cacheKey).digest("hex");

const getWorkspaceProjectPlaybackMetadataPath = (cacheKey: string) =>
  join(PROJECT_PLAYBACK_ROOT_DIR, `${getWorkspaceProjectPlaybackHash(cacheKey)}.json`);

const getWorkspaceProjectPlaybackAbsolutePath = (cacheKey: string, fileName: string) =>
  join(PROJECT_PLAYBACK_ROOT_DIR, `${getWorkspaceProjectPlaybackHash(cacheKey)}-${fileName}`);

const inferWorkspaceProjectPlaybackContentType = (value: string | null | undefined, upstreamUrl: URL) => {
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

const inferWorkspaceProjectPlaybackExtension = (contentType: string, upstreamUrl: URL) => {
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

const touchWorkspaceProjectPlaybackFile = async (absolutePath: string, metadataPath: string) => {
  const nextTimestamp = new Date();
  await Promise.allSettled([
    utimes(absolutePath, nextTimestamp, nextTimestamp),
    utimes(metadataPath, nextTimestamp, nextTimestamp),
  ]);
};

const readWorkspaceProjectPlaybackMetadata = async (
  cacheKey: string,
): Promise<WorkspaceProjectPlaybackAsset | null> => {
  const metadataPath = getWorkspaceProjectPlaybackMetadataPath(cacheKey);

  try {
    const rawValue = await readFile(metadataPath, "utf8");
    const payload = JSON.parse(rawValue) as WorkspaceProjectPlaybackMetadata | null;
    const fileName = normalizeText(payload?.fileName);
    const contentType = normalizeText(payload?.contentType);
    if (!fileName || !contentType) {
      return null;
    }

    const absolutePath = getWorkspaceProjectPlaybackAbsolutePath(cacheKey, fileName);
    await access(absolutePath, fsConstants.R_OK);
    await touchWorkspaceProjectPlaybackFile(absolutePath, metadataPath).catch(() => undefined);

    return {
      absolutePath,
      contentType,
    };
  } catch {
    return null;
  }
};

const writeWorkspaceProjectPlaybackMetadata = async (
  cacheKey: string,
  metadata: WorkspaceProjectPlaybackMetadata,
) => {
  const metadataPath = getWorkspaceProjectPlaybackMetadataPath(cacheKey);
  const tempMetadataPath = `${metadataPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempMetadataPath, JSON.stringify(metadata, null, 2), "utf8");
  await rename(tempMetadataPath, metadataPath);
};

const removeWorkspaceProjectPlaybackTaskFromQueue = (
  queue: WorkspaceProjectPlaybackTask[],
  task: WorkspaceProjectPlaybackTask,
) => {
  const taskIndex = queue.indexOf(task);
  if (taskIndex >= 0) {
    queue.splice(taskIndex, 1);
  }
};

const flushWorkspaceProjectPlaybackQueues = () => {
  while (
    activeProjectPlaybackInteractiveCount < PROJECT_PLAYBACK_INTERACTIVE_CONCURRENCY &&
    projectPlaybackInteractiveQueue.length > 0
  ) {
    const nextTask = projectPlaybackInteractiveQueue.shift();
    if (!nextTask) {
      break;
    }

    activeProjectPlaybackInteractiveCount += 1;
    nextTask.run();
  }

  while (
    activeProjectPlaybackBackgroundCount < PROJECT_PLAYBACK_BACKGROUND_CONCURRENCY &&
    projectPlaybackBackgroundQueue.length > 0 &&
    projectPlaybackInteractiveQueue.length === 0
  ) {
    const nextTask = projectPlaybackBackgroundQueue.shift();
    if (!nextTask) {
      break;
    }

    activeProjectPlaybackBackgroundCount += 1;
    nextTask.run();
  }
};

const scheduleWorkspaceProjectPlaybackCleanup = () => {
  const now = Date.now();
  if (
    projectPlaybackCleanupPromise ||
    lastProjectPlaybackCleanupAt > 0 && now - lastProjectPlaybackCleanupAt < PROJECT_PLAYBACK_CLEANUP_INTERVAL_MS
  ) {
    return;
  }

  lastProjectPlaybackCleanupAt = now;
  projectPlaybackCleanupPromise = (async () => {
    await mkdir(PROJECT_PLAYBACK_ROOT_DIR, { recursive: true });

    const entries = await readdir(PROJECT_PLAYBACK_ROOT_DIR, { withFileTypes: true });
    const expirationThreshold = Date.now() - PROJECT_PLAYBACK_MAX_AGE_MS;

    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isFile()) {
          return;
        }

        const absolutePath = join(PROJECT_PLAYBACK_ROOT_DIR, entry.name);
        try {
          const fileStats = await stat(absolutePath);
          if (fileStats.mtimeMs < expirationThreshold) {
            await rm(absolutePath, { force: true });
          }
        } catch {
          // Ignore cleanup failures for individual files.
        }
      }),
    );
  })()
    .catch((error) => {
      console.error("[workspace] Failed to cleanup project playback cache", error);
    })
    .finally(() => {
      projectPlaybackCleanupPromise = null;
    });
};

const downloadWorkspaceProjectPlaybackSource = async (source: WorkspaceProjectPlaybackSource) => {
  const response = await fetch(source.upstreamUrl, {
    headers: {
      connection: "close",
    },
    signal: AbortSignal.timeout(PROJECT_PLAYBACK_DOWNLOAD_TIMEOUT_MS),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download project playback source (${response.status}).`);
  }

  const contentType = inferWorkspaceProjectPlaybackContentType(
    response.headers.get("content-type"),
    source.upstreamUrl,
  );
  const sourceExtension = inferWorkspaceProjectPlaybackExtension(contentType, source.upstreamUrl);
  const tempBasePath = join(
    PROJECT_PLAYBACK_ROOT_DIR,
    `${getWorkspaceProjectPlaybackHash(source.cacheKey)}-${process.pid}-${Date.now()}-${randomUUID()}`,
  );
  const tempDownloadPath = `${tempBasePath}-download${sourceExtension}`;

  try {
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(tempDownloadPath));
  } catch (error) {
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

const remuxWorkspaceProjectPlaybackFile = async (inputPath: string, outputPath: string) => {
  await execFileAsync(
    FFMPEG_BINARY,
    [
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
    ],
    {
      timeout: PROJECT_PLAYBACK_FFMPEG_TIMEOUT_MS,
      maxBuffer: PROJECT_PLAYBACK_FFMPEG_MAX_BUFFER_BYTES,
    },
  );
};

const prepareWorkspaceProjectPlaybackAsset = async (
  source: WorkspaceProjectPlaybackSource,
): Promise<WorkspaceProjectPlaybackAsset> => {
  await mkdir(PROJECT_PLAYBACK_ROOT_DIR, { recursive: true });
  const cachedAsset = await readWorkspaceProjectPlaybackMetadata(source.cacheKey);
  if (cachedAsset) {
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
  } catch (error) {
    console.warn("[workspace] Failed to remux project playback source, using raw file fallback", {
      error: error instanceof Error ? error.message : "Unknown project playback remux error.",
      projectId: source.projectId,
    });
    await rm(tempRemuxPath, { force: true }).catch(() => undefined);
  }

  const finalAbsolutePath = getWorkspaceProjectPlaybackAbsolutePath(source.cacheKey, finalFileName);

  try {
    await rename(tempOutputPath, finalAbsolutePath);
  } catch (error) {
    await rm(tempOutputPath, { force: true }).catch(() => undefined);
    throw error;
  }

  try {
    await writeWorkspaceProjectPlaybackMetadata(source.cacheKey, {
      contentType: finalContentType,
      fileName: finalFileName,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    await rm(finalAbsolutePath, { force: true }).catch(() => undefined);
    throw error;
  }

  return {
    absolutePath: finalAbsolutePath,
    contentType: finalContentType,
  };
};

const createWorkspaceProjectPlaybackTask = (
  source: WorkspaceProjectPlaybackSource,
  priority: WorkspaceProjectPlaybackPriority,
): WorkspaceProjectPlaybackTask => {
  let resolveTask!: (asset: WorkspaceProjectPlaybackAsset) => void;
  let rejectTask!: (error: unknown) => void;
  const promise = new Promise<WorkspaceProjectPlaybackAsset>((resolve, reject) => {
    resolveTask = resolve;
    rejectTask = reject;
  });

  const task: WorkspaceProjectPlaybackTask = {
    priority,
    promise,
    reject: rejectTask,
    resolve: resolveTask,
    run: () => {
      task.started = true;

      void prepareWorkspaceProjectPlaybackAsset(source)
        .then(task.resolve)
        .catch(task.reject)
        .finally(() => {
          projectPlaybackTasks.delete(source.cacheKey);

          if (task.priority === "interactive") {
            activeProjectPlaybackInteractiveCount = Math.max(0, activeProjectPlaybackInteractiveCount - 1);
          } else {
            activeProjectPlaybackBackgroundCount = Math.max(0, activeProjectPlaybackBackgroundCount - 1);
          }

          flushWorkspaceProjectPlaybackQueues();
        });
    },
    source,
    started: false,
  };

  return task;
};

const promoteWorkspaceProjectPlaybackTaskToInteractive = (task: WorkspaceProjectPlaybackTask) => {
  if (task.started || task.priority === "interactive") {
    return;
  }

  removeWorkspaceProjectPlaybackTaskFromQueue(projectPlaybackBackgroundQueue, task);
  task.priority = "interactive";
  projectPlaybackInteractiveQueue.push(task);
  flushWorkspaceProjectPlaybackQueues();
};

const ensureWorkspaceProjectPlaybackQueued = (
  source: WorkspaceProjectPlaybackSource,
  priority: WorkspaceProjectPlaybackPriority,
) => {
  const existingTask = projectPlaybackTasks.get(source.cacheKey);
  if (existingTask) {
    if (priority === "interactive") {
      promoteWorkspaceProjectPlaybackTaskToInteractive(existingTask);
    }

    return existingTask.promise;
  }

  const nextTask = createWorkspaceProjectPlaybackTask(source, priority);
  projectPlaybackTasks.set(source.cacheKey, nextTask);

  if (priority === "interactive") {
    projectPlaybackInteractiveQueue.push(nextTask);
  } else {
    projectPlaybackBackgroundQueue.push(nextTask);
  }

  flushWorkspaceProjectPlaybackQueues();
  return nextTask.promise;
};

export const getWorkspaceProjectPlaybackCacheKey = (source: {
  projectId: string;
  targetUrl: URL;
  updatedAt: string;
}) => {
  const normalizedProjectId = normalizeText(source.projectId);
  const normalizedUpdatedAt = normalizeText(source.updatedAt);
  const normalizedTargetUrl = new URL(source.targetUrl.toString());
  normalizedTargetUrl.searchParams.delete("admin_token");

  return `${normalizedProjectId}:${normalizedUpdatedAt}:${normalizedTargetUrl.toString()}`;
};

export async function ensureWorkspaceProjectPlayback(
  source: WorkspaceProjectPlaybackSource,
): Promise<WorkspaceProjectPlaybackAsset> {
  scheduleWorkspaceProjectPlaybackCleanup();

  const cachedAsset = await readWorkspaceProjectPlaybackMetadata(source.cacheKey);
  if (cachedAsset) {
    return cachedAsset;
  }

  return ensureWorkspaceProjectPlaybackQueued(source, "interactive");
}

export async function warmWorkspaceProjectPlayback(source: WorkspaceProjectPlaybackSource): Promise<void> {
  scheduleWorkspaceProjectPlaybackCleanup();

  const cachedAsset = await readWorkspaceProjectPlaybackMetadata(source.cacheKey);
  if (cachedAsset) {
    return;
  }

  await ensureWorkspaceProjectPlaybackQueued(source, "background");
}
