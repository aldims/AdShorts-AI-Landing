import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, readdir, rename, rm, stat, utimes, writeFile, } from "node:fs/promises";
import { join } from "node:path";
import { logServerEvent } from "./logger.js";
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const hashCacheKey = (cacheKey) => createHash("sha256").update(cacheKey).digest("hex");
export const createPreparedAssetStore = (options) => {
    let cleanupPromise = null;
    let lastCleanupAt = 0;
    const getAssetHash = (cacheKey) => hashCacheKey(cacheKey);
    const getMetadataPath = (cacheKey) => join(options.rootDir, `${getAssetHash(cacheKey)}.json`);
    const getAssetPath = (cacheKey, fileName) => join(options.rootDir, `${getAssetHash(cacheKey)}-${normalizeText(fileName)}`);
    const touchFiles = async (absolutePath, metadataPath) => {
        const touchedAt = new Date();
        await Promise.allSettled([
            utimes(absolutePath, touchedAt, touchedAt),
            utimes(metadataPath, touchedAt, touchedAt),
        ]);
    };
    const ensureDir = async () => {
        await mkdir(options.rootDir, { recursive: true });
    };
    const exists = async (cacheKey) => {
        try {
            const metadataPath = getMetadataPath(cacheKey);
            const rawMetadata = await readFile(metadataPath, "utf8");
            const metadata = JSON.parse(rawMetadata);
            const fileName = normalizeText(metadata?.fileName);
            if (!fileName) {
                return false;
            }
            await access(getAssetPath(cacheKey, fileName), fsConstants.R_OK);
            return true;
        }
        catch {
            return false;
        }
    };
    const read = async (cacheKey) => {
        const metadataPath = getMetadataPath(cacheKey);
        try {
            const rawMetadata = await readFile(metadataPath, "utf8");
            const metadata = JSON.parse(rawMetadata);
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
        }
        catch {
            return null;
        }
    };
    const writeMetadata = async (cacheKey, metadata) => {
        const metadataPath = getMetadataPath(cacheKey);
        const tempMetadataPath = `${metadataPath}.${process.pid}.${Date.now()}.tmp`;
        await writeFile(tempMetadataPath, JSON.stringify(metadata, null, 2), "utf8");
        await rename(tempMetadataPath, metadataPath);
    };
    const commitFile = async (cacheKey, tempPath, metadata) => {
        await ensureDir();
        const finalPath = getAssetPath(cacheKey, metadata.fileName);
        try {
            await rename(tempPath, finalPath);
        }
        catch (error) {
            await rm(tempPath, { force: true }).catch(() => undefined);
            throw error;
        }
        try {
            await writeMetadata(cacheKey, metadata);
        }
        catch (error) {
            await rm(finalPath, { force: true }).catch(() => undefined);
            throw error;
        }
        return finalPath;
    };
    const writeBufferToFile = async (cacheKey, buffer, metadata) => {
        await ensureDir();
        const outputPath = getAssetPath(cacheKey, metadata.fileName);
        const tempPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
        try {
            await writeFile(tempPath, buffer);
            return await commitFile(cacheKey, tempPath, metadata);
        }
        catch (error) {
            await rm(tempPath, { force: true }).catch(() => undefined);
            throw error;
        }
    };
    const remove = async (cacheKey) => {
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
        await Promise.all(entries.map(async (entry) => {
            if (!entry.isFile()) {
                return;
            }
            const absolutePath = join(options.rootDir, entry.name);
            try {
                const fileStats = await stat(absolutePath);
                if (fileStats.mtimeMs < expirationThreshold) {
                    await rm(absolutePath, { force: true });
                }
            }
            catch {
                // Ignore cleanup failures per file.
            }
        }));
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
