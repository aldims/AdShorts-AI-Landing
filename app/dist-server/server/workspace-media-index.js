import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "./env.js";
const WORKSPACE_MEDIA_INDEX_ROOT_DIR = join(env.dataDir, "workspace-media-index");
const workspaceMediaIndexUserWriteQueues = new Map();
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const resolveWorkspaceMediaIndexUserKey = (user) => {
    const normalizedId = normalizeText(user.id);
    if (normalizedId) {
        return `id:${normalizedId}`;
    }
    const normalizedEmail = normalizeText(user.email).toLowerCase();
    if (normalizedEmail) {
        return `email:${normalizedEmail}`;
    }
    return "anonymous";
};
const getWorkspaceMediaIndexPath = (user) => join(WORKSPACE_MEDIA_INDEX_ROOT_DIR, `${createHash("sha1").update(resolveWorkspaceMediaIndexUserKey(user)).digest("hex")}.json`);
const withWorkspaceMediaIndexUserWriteLock = async (user, operation) => {
    const userKey = resolveWorkspaceMediaIndexUserKey(user);
    const previousQueue = workspaceMediaIndexUserWriteQueues.get(userKey) ?? Promise.resolve();
    let releaseCurrentQueue = () => undefined;
    const currentQueue = new Promise((resolve) => {
        releaseCurrentQueue = resolve;
    });
    const nextQueue = previousQueue.catch(() => undefined).then(() => currentQueue);
    workspaceMediaIndexUserWriteQueues.set(userKey, nextQueue);
    await previousQueue.catch(() => undefined);
    try {
        return await operation();
    }
    finally {
        releaseCurrentQueue();
        if (workspaceMediaIndexUserWriteQueues.get(userKey) === nextQueue) {
            workspaceMediaIndexUserWriteQueues.delete(userKey);
        }
    }
};
const readWorkspaceMediaIndexDocument = async (user) => {
    await mkdir(WORKSPACE_MEDIA_INDEX_ROOT_DIR, { recursive: true });
    try {
        const rawValue = await readFile(getWorkspaceMediaIndexPath(user), "utf8");
        const payload = JSON.parse(rawValue);
        if (!payload || !Array.isArray(payload.projects)) {
            return { projects: [] };
        }
        return {
            projects: payload.projects.filter((entry) => entry && typeof entry === "object"),
        };
    }
    catch {
        return { projects: [] };
    }
};
export const listWorkspaceMediaIndexProjectEntries = async (user) => {
    const document = await readWorkspaceMediaIndexDocument(user);
    return document.projects;
};
const writeWorkspaceMediaIndexDocument = async (user, payload) => {
    await mkdir(WORKSPACE_MEDIA_INDEX_ROOT_DIR, { recursive: true });
    const outputPath = getWorkspaceMediaIndexPath(user);
    const tempPath = `${outputPath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
    try {
        await writeFile(tempPath, JSON.stringify(payload, null, 2), "utf8");
        await rename(tempPath, outputPath);
    }
    catch (error) {
        await rm(tempPath, { force: true }).catch(() => undefined);
        throw error;
    }
};
export const getWorkspaceMediaIndexProjectEntry = async (user, projectId, projectVersion) => {
    const normalizedProjectVersion = normalizeText(projectVersion);
    if (!Number.isFinite(projectId) || projectId <= 0 || !normalizedProjectVersion) {
        return null;
    }
    const document = await readWorkspaceMediaIndexDocument(user);
    return (document.projects.find((entry) => entry.projectId === projectId &&
        normalizeText(entry.projectVersion) === normalizedProjectVersion) ?? null);
};
export const upsertWorkspaceMediaIndexProjectEntry = async (user, entry) => {
    await withWorkspaceMediaIndexUserWriteLock(user, async () => {
        const document = await readWorkspaceMediaIndexDocument(user);
        const filteredProjects = document.projects.filter((project) => project.projectId !== entry.projectId);
        filteredProjects.push(entry);
        await writeWorkspaceMediaIndexDocument(user, {
            projects: filteredProjects.sort((left, right) => right.projectId - left.projectId),
        });
    });
};
export const pruneWorkspaceMediaIndexProjects = async (user, validProjectVersions) => {
    await withWorkspaceMediaIndexUserWriteLock(user, async () => {
        const document = await readWorkspaceMediaIndexDocument(user);
        const nextProjects = document.projects.filter((entry) => {
            const nextVersion = validProjectVersions.get(entry.projectId);
            return nextVersion && normalizeText(nextVersion) === normalizeText(entry.projectVersion);
        });
        if (nextProjects.length === document.projects.length) {
            return;
        }
        await writeWorkspaceMediaIndexDocument(user, {
            projects: nextProjects,
        });
    });
};
export const clearWorkspaceMediaIndex = async (user) => {
    await withWorkspaceMediaIndexUserWriteLock(user, async () => {
        await rm(getWorkspaceMediaIndexPath(user), { force: true }).catch(() => undefined);
    });
};
