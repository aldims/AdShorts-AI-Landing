import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isWorkspaceReferenceKind } from "../shared/workspace-references.js";
import { env } from "./env.js";
const WORKSPACE_REFERENCES_ROOT_DIR = join(env.dataDir, "workspace-references");
const workspaceReferenceWriteQueues = new Map();
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeNullableText = (value) => {
    const normalized = normalizeText(value);
    return normalized || null;
};
const normalizePositiveInteger = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
};
const normalizeNonNegativeInteger = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
};
const resolveWorkspaceReferenceEmailKey = (user) => {
    const email = normalizeText(user.email).toLowerCase();
    return email ? `email:${email}` : null;
};
const resolveWorkspaceReferenceIdKey = (user) => {
    const userId = normalizeText(user.id);
    if (userId) {
        return `id:${userId}`;
    }
    return null;
};
const resolveWorkspaceReferenceCanonicalUserKey = (user) => resolveWorkspaceReferenceEmailKey(user) ?? resolveWorkspaceReferenceIdKey(user) ?? "anonymous";
const resolveWorkspaceReferenceUserKeys = (user) => {
    const canonicalKey = resolveWorkspaceReferenceCanonicalUserKey(user);
    const keys = [canonicalKey];
    for (const key of [resolveWorkspaceReferenceIdKey(user), resolveWorkspaceReferenceEmailKey(user)]) {
        if (key && !keys.includes(key)) {
            keys.push(key);
        }
    }
    return keys;
};
const getWorkspaceReferencePathForUserKey = (userKey) => join(WORKSPACE_REFERENCES_ROOT_DIR, `${createHash("sha1").update(userKey).digest("hex")}.json`);
const getWorkspaceReferencePath = (user) => getWorkspaceReferencePathForUserKey(resolveWorkspaceReferenceCanonicalUserKey(user));
const getWorkspaceReferencePaths = (user) => resolveWorkspaceReferenceUserKeys(user).map(getWorkspaceReferencePathForUserKey);
const buildWorkspaceReferenceDocumentOwner = (user) => ({
    canonicalKey: resolveWorkspaceReferenceCanonicalUserKey(user),
    email: normalizeText(user.email).toLowerCase() || null,
    id: normalizeText(user.id) || null,
    keys: resolveWorkspaceReferenceUserKeys(user),
});
const withWorkspaceReferenceWriteLock = async (user, operation) => {
    const userKey = resolveWorkspaceReferenceCanonicalUserKey(user);
    const previousQueue = workspaceReferenceWriteQueues.get(userKey) ?? Promise.resolve();
    let releaseCurrentQueue = () => undefined;
    const currentQueue = new Promise((resolve) => {
        releaseCurrentQueue = resolve;
    });
    const nextQueue = previousQueue.catch(() => undefined).then(() => currentQueue);
    workspaceReferenceWriteQueues.set(userKey, nextQueue);
    await previousQueue.catch(() => undefined);
    try {
        return await operation();
    }
    finally {
        releaseCurrentQueue();
        if (workspaceReferenceWriteQueues.get(userKey) === nextQueue) {
            workspaceReferenceWriteQueues.delete(userKey);
        }
    }
};
const normalizeWorkspaceSavedReference = (value) => {
    if (!value || typeof value !== "object") {
        return null;
    }
    const record = value;
    const id = normalizeText(record.id);
    const kind = record.kind;
    const assetId = normalizePositiveInteger(record.assetId);
    const name = normalizeText(record.name);
    if (!id || !isWorkspaceReferenceKind(kind) || !assetId || !name) {
        return null;
    }
    const now = new Date().toISOString();
    const createdAt = normalizeText(record.createdAt) || now;
    const updatedAt = normalizeText(record.updatedAt) || createdAt;
    return {
        assetId,
        createdAt,
        description: normalizeNullableText(record.description),
        id,
        kind,
        name,
        sourceProjectId: normalizePositiveInteger(record.sourceProjectId),
        sourceSegmentIndex: normalizeNonNegativeInteger(record.sourceSegmentIndex),
        updatedAt,
    };
};
const readWorkspaceReferenceDocumentFromPath = async (path) => {
    try {
        const rawValue = await readFile(path, "utf8");
        const payload = JSON.parse(rawValue);
        const references = Array.isArray(payload?.references)
            ? payload.references.map(normalizeWorkspaceSavedReference).filter(Boolean)
            : [];
        return { references };
    }
    catch {
        return { references: [] };
    }
};
const mergeWorkspaceReferenceDocuments = (documents) => {
    const referencesById = new Map();
    for (const document of documents) {
        for (const reference of document.references) {
            const existingReference = referencesById.get(reference.id);
            if (!existingReference || Date.parse(reference.updatedAt) >= Date.parse(existingReference.updatedAt)) {
                referencesById.set(reference.id, reference);
            }
        }
    }
    return { references: sortWorkspaceReferencesNewestFirst([...referencesById.values()]) };
};
const readWorkspaceReferenceDocument = async (user) => {
    await mkdir(WORKSPACE_REFERENCES_ROOT_DIR, { recursive: true });
    const documents = await Promise.all(getWorkspaceReferencePaths(user).map(readWorkspaceReferenceDocumentFromPath));
    return mergeWorkspaceReferenceDocuments(documents);
};
const writeWorkspaceReferenceDocument = async (user, payload) => {
    await mkdir(WORKSPACE_REFERENCES_ROOT_DIR, { recursive: true });
    const outputPath = getWorkspaceReferencePath(user);
    const tempPath = `${outputPath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
    try {
        await writeFile(tempPath, JSON.stringify({ ...payload, owner: buildWorkspaceReferenceDocumentOwner(user) }, null, 2), "utf8");
        await rename(tempPath, outputPath);
        await Promise.all(getWorkspaceReferencePaths(user)
            .filter((path) => path !== outputPath)
            .map((path) => rm(path, { force: true }).catch(() => undefined)));
    }
    catch (error) {
        await rm(tempPath, { force: true }).catch(() => undefined);
        throw error;
    }
};
const getReferenceKindDefaultPrefix = (kind) => kind === "character" ? "Персонаж" : "Сцена";
const getNextDefaultReferenceName = (references, kind) => {
    const prefix = getReferenceKindDefaultPrefix(kind);
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^${escapedPrefix}\\s+(\\d+)$`, "i");
    const maxExistingNumber = references
        .filter((reference) => reference.kind === kind)
        .reduce((maxValue, reference) => {
        const match = reference.name.match(pattern);
        const parsed = match ? Number(match[1]) : Number.NaN;
        return Number.isFinite(parsed) && parsed > maxValue ? parsed : maxValue;
    }, 0);
    return `${prefix} ${maxExistingNumber + 1}`;
};
const sortWorkspaceReferencesNewestFirst = (references) => references.slice().sort((left, right) => {
    const updatedDifference = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    if (Number.isFinite(updatedDifference) && updatedDifference !== 0) {
        return updatedDifference;
    }
    return right.id.localeCompare(left.id);
});
export const listWorkspaceSavedReferences = async (user, options) => {
    const document = await readWorkspaceReferenceDocument(user);
    const references = options?.kind
        ? document.references.filter((reference) => reference.kind === options.kind)
        : document.references;
    return sortWorkspaceReferencesNewestFirst(references);
};
export const createWorkspaceSavedReference = async (user, options) => withWorkspaceReferenceWriteLock(user, async () => {
    const document = await readWorkspaceReferenceDocument(user);
    const kind = options.kind;
    const assetId = normalizePositiveInteger(options.assetId);
    if (!isWorkspaceReferenceKind(kind)) {
        throw new Error("Reference kind is invalid.");
    }
    if (!assetId) {
        throw new Error("Reference asset id is required.");
    }
    const now = new Date().toISOString();
    const reference = {
        assetId,
        createdAt: now,
        description: normalizeNullableText(options.description),
        id: randomUUID(),
        kind,
        name: normalizeText(options.name) || getNextDefaultReferenceName(document.references, kind),
        sourceProjectId: normalizePositiveInteger(options.sourceProjectId),
        sourceSegmentIndex: normalizeNonNegativeInteger(options.sourceSegmentIndex),
        updatedAt: now,
    };
    const references = [reference, ...document.references];
    await writeWorkspaceReferenceDocument(user, { references });
    return reference;
});
export const updateWorkspaceSavedReference = async (user, referenceId, patch) => withWorkspaceReferenceWriteLock(user, async () => {
    const normalizedId = normalizeText(referenceId);
    if (!normalizedId) {
        throw new Error("Reference id is required.");
    }
    const document = await readWorkspaceReferenceDocument(user);
    const referenceIndex = document.references.findIndex((reference) => reference.id === normalizedId);
    if (referenceIndex < 0) {
        return null;
    }
    const existingReference = document.references[referenceIndex];
    const nextReference = {
        ...existingReference,
        description: Object.prototype.hasOwnProperty.call(patch, "description")
            ? normalizeNullableText(patch.description)
            : existingReference.description,
        name: normalizeText(patch.name) || existingReference.name,
        updatedAt: new Date().toISOString(),
    };
    const references = [...document.references];
    references[referenceIndex] = nextReference;
    await writeWorkspaceReferenceDocument(user, { references });
    return nextReference;
});
export const deleteWorkspaceSavedReference = async (user, referenceId) => withWorkspaceReferenceWriteLock(user, async () => {
    const normalizedId = normalizeText(referenceId);
    if (!normalizedId) {
        throw new Error("Reference id is required.");
    }
    const document = await readWorkspaceReferenceDocument(user);
    const references = document.references.filter((reference) => reference.id !== normalizedId);
    if (references.length === document.references.length) {
        return null;
    }
    await writeWorkspaceReferenceDocument(user, { references });
    return { referenceId: normalizedId };
});
export const clearWorkspaceSavedReferences = async (user) => {
    await withWorkspaceReferenceWriteLock(user, async () => {
        await Promise.all(getWorkspaceReferencePaths(user).map((path) => rm(path, { force: true }).catch(() => undefined)));
    });
};
