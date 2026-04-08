import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import { logServerEvent } from "./logger.js";

export type PreparedAssetMetadata = {
  contentType: string;
  fileName: string;
  savedAt: string;
};

export type PreparedAssetFile<TMetadata extends PreparedAssetMetadata = PreparedAssetMetadata> = {
  absolutePath: string;
  metadata: TMetadata;
};

type PreparedAssetStoreOptions = {
  cleanupIntervalMs: number;
  maxAgeMs: number;
  name: string;
  rootDir: string;
};

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const hashCacheKey = (cacheKey: string) => createHash("sha256").update(cacheKey).digest("hex");

export const createPreparedAssetStore = (options: PreparedAssetStoreOptions) => {
  let cleanupPromise: Promise<void> | null = null;
  let lastCleanupAt = 0;

  const getAssetHash = (cacheKey: string) => hashCacheKey(cacheKey);
  const getMetadataPath = (cacheKey: string) => join(options.rootDir, `${getAssetHash(cacheKey)}.json`);
  const getAssetPath = (cacheKey: string, fileName: string) =>
    join(options.rootDir, `${getAssetHash(cacheKey)}-${normalizeText(fileName)}`);

  const touchFiles = async (absolutePath: string, metadataPath: string) => {
    const touchedAt = new Date();
    await Promise.allSettled([
      utimes(absolutePath, touchedAt, touchedAt),
      utimes(metadataPath, touchedAt, touchedAt),
    ]);
  };

  const ensureDir = async () => {
    await mkdir(options.rootDir, { recursive: true });
  };

  const exists = async (cacheKey: string) => {
    try {
      const metadataPath = getMetadataPath(cacheKey);
      const rawMetadata = await readFile(metadataPath, "utf8");
      const metadata = JSON.parse(rawMetadata) as PreparedAssetMetadata | null;
      const fileName = normalizeText(metadata?.fileName);
      if (!fileName) {
        return false;
      }

      await access(getAssetPath(cacheKey, fileName), fsConstants.R_OK);
      return true;
    } catch {
      return false;
    }
  };

  const read = async <TMetadata extends PreparedAssetMetadata>(cacheKey: string): Promise<PreparedAssetFile<TMetadata> | null> => {
    const metadataPath = getMetadataPath(cacheKey);

    try {
      const rawMetadata = await readFile(metadataPath, "utf8");
      const metadata = JSON.parse(rawMetadata) as TMetadata | null;
      const fileName = normalizeText(metadata?.fileName);
      if (!metadata || !fileName) {
        return null;
      }

      const absolutePath = getAssetPath(cacheKey, fileName);
      await access(absolutePath, fsConstants.R_OK);
      await touchFiles(absolutePath, metadataPath).catch(() => undefined);

      return {
        absolutePath,
        metadata,
      };
    } catch {
      return null;
    }
  };

  const writeMetadata = async <TMetadata extends PreparedAssetMetadata>(cacheKey: string, metadata: TMetadata) => {
    const metadataPath = getMetadataPath(cacheKey);
    const tempMetadataPath = `${metadataPath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempMetadataPath, JSON.stringify(metadata, null, 2), "utf8");
    await rename(tempMetadataPath, metadataPath);
  };

  const commitFile = async <TMetadata extends PreparedAssetMetadata>(
    cacheKey: string,
    tempPath: string,
    metadata: TMetadata,
  ) => {
    await ensureDir();

    const finalPath = getAssetPath(cacheKey, metadata.fileName);
    try {
      await rename(tempPath, finalPath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }

    try {
      await writeMetadata(cacheKey, metadata);
    } catch (error) {
      await rm(finalPath, { force: true }).catch(() => undefined);
      throw error;
    }

    return finalPath;
  };

  const writeBufferToFile = async <TMetadata extends PreparedAssetMetadata>(
    cacheKey: string,
    buffer: Buffer,
    metadata: TMetadata,
  ) => {
    await ensureDir();
    const outputPath = getAssetPath(cacheKey, metadata.fileName);
    const tempPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;

    try {
      await writeFile(tempPath, buffer);
      return await commitFile(cacheKey, tempPath, metadata);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  };

  const remove = async (cacheKey: string) => {
    const record = await read(cacheKey);
    await Promise.allSettled([
      rm(getMetadataPath(cacheKey), { force: true }),
      record ? rm(record.absolutePath, { force: true }) : Promise.resolve(),
    ]);
  };

  const runCleanup = async () => {
    await ensureDir();
    const entries = await readdir(options.rootDir, { withFileTypes: true });
    const expirationThreshold = Date.now() - options.maxAgeMs;

    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isFile()) {
          return;
        }

        const absolutePath = join(options.rootDir, entry.name);
        try {
          const fileStats = await stat(absolutePath);
          if (fileStats.mtimeMs < expirationThreshold) {
            await rm(absolutePath, { force: true });
          }
        } catch {
          // Ignore cleanup failures per file.
        }
      }),
    );
  };

  const scheduleCleanup = () => {
    const now = Date.now();
    if (cleanupPromise || (lastCleanupAt > 0 && now - lastCleanupAt < options.cleanupIntervalMs)) {
      return cleanupPromise ?? Promise.resolve();
    }

    lastCleanupAt = now;
    cleanupPromise = runCleanup()
      .catch((error) => {
        logServerEvent("warn", "prepared-asset-store.cleanup-failed", {
          error,
          store: options.name,
        });
      })
      .finally(() => {
        cleanupPromise = null;
      });
  };

  return {
    commitFile,
    exists,
    getAssetPath,
    getMetadataPath,
    read,
    remove,
    runCleanup,
    scheduleCleanup,
    writeBufferToFile,
  };
};
