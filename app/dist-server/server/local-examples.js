import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { env } from "./env.js";
import { getWorkspaceProjectPlaybackAsset, getWorkspaceProjectVideoProxyTarget } from "./projects.js";
import { getStudioVideoProxyTarget, getStudioVideoProxyTargetByPath } from "./studio.js";
const LOCAL_EXAMPLES_ROOT_DIR = join(env.dataDir, "local-examples");
const LOCAL_EXAMPLES_INDEX_PATH = join(LOCAL_EXAMPLES_ROOT_DIR, "examples.json");
const LOCAL_EXAMPLE_FETCH_TIMEOUT_MS = 60_000;
const LOCAL_EXAMPLES_ADMIN_EMAIL = "adshortsai@gmail.com";
const LOCAL_EXAMPLES_SHARED_OWNER_KEY = `email:${LOCAL_EXAMPLES_ADMIN_EMAIL}`;
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeLocalExamplesAdminEmail = (value) => normalizeText(value).toLowerCase();
const normalizeLocalExampleGoal = (value) => {
    const normalized = normalizeText(value);
    switch (normalized) {
        case "stories":
        case "fun":
        case "ads":
        case "fantasy":
        case "interesting":
        case "effects":
            return normalized;
        case "ad_product":
            return "ads";
        case "cinematic":
            return "stories";
        case "entertainment":
            return "interesting";
        case "wow_fantasy":
            return "fantasy";
        default:
            return null;
    }
};
const isLocalExamplesEnabled = () => !env.isProduction;
const isLocalExamplesAdmin = (user) => normalizeLocalExamplesAdminEmail(user?.email) === LOCAL_EXAMPLES_ADMIN_EMAIL;
const resolveLocalExamplesOwnerKey = (user) => {
    const normalizedId = normalizeText(user.id);
    if (normalizedId) {
        return `id:${normalizedId}`;
    }
    const normalizedEmail = normalizeText(user.email).toLowerCase();
    if (normalizedEmail) {
        return `email:${normalizedEmail}`;
    }
    throw new Error("User identity is required to manage local examples.");
};
const buildLocalExamplesOwnerDir = (ownerKey) => join(LOCAL_EXAMPLES_ROOT_DIR, createHash("sha1").update(ownerKey).digest("hex").slice(0, 16));
const ensureLocalExamplesStorage = async () => {
    await mkdir(LOCAL_EXAMPLES_ROOT_DIR, { recursive: true });
};
const moveLocalExampleMediaFile = async (sourcePath, destinationPath) => {
    try {
        await rename(sourcePath, destinationPath);
    }
    catch (error) {
        await copyFile(sourcePath, destinationPath);
        await rm(sourcePath, { force: true }).catch(() => undefined);
    }
};
const readLocalExamplesIndex = async () => {
    await ensureLocalExamplesStorage();
    try {
        const rawValue = await readFile(LOCAL_EXAMPLES_INDEX_PATH, "utf8");
        const payload = JSON.parse(rawValue);
        if (!payload || !Array.isArray(payload.items)) {
            return { items: [] };
        }
        return {
            items: payload.items.filter((item) => item && typeof item === "object"),
        };
    }
    catch {
        return { items: [] };
    }
};
const writeLocalExamplesIndex = async (payload) => {
    await ensureLocalExamplesStorage();
    await writeFile(LOCAL_EXAMPLES_INDEX_PATH, JSON.stringify(payload, null, 2), "utf8");
};
const getLegacyLocalExampleOwnerKeys = (index) => Array.from(new Set(index.items
    .map((item) => normalizeText(item.ownerKey))
    .filter((ownerKey) => ownerKey && ownerKey !== LOCAL_EXAMPLES_SHARED_OWNER_KEY)));
export class LocalExamplesPermissionError extends Error {
    statusCode;
    constructor(message = "Only the admin account can manage shared examples.", statusCode = 403) {
        super(message);
        this.name = "LocalExamplesPermissionError";
        this.statusCode = statusCode;
    }
}
const assertLocalExamplesAdmin = (user) => {
    if (!isLocalExamplesAdmin(user)) {
        throw new LocalExamplesPermissionError("Только админ может добавлять и удалять примеры.");
    }
};
const migrateAdminExamplesToSharedOwner = async (index, user) => {
    if (!user || !isLocalExamplesAdmin(user)) {
        return index;
    }
    const legacyOwnerKeys = new Set();
    const currentOwnerKey = resolveLocalExamplesOwnerKey(user);
    if (currentOwnerKey && currentOwnerKey !== LOCAL_EXAMPLES_SHARED_OWNER_KEY) {
        legacyOwnerKeys.add(currentOwnerKey);
    }
    const hasSharedExamples = index.items.some((item) => item.ownerKey === LOCAL_EXAMPLES_SHARED_OWNER_KEY);
    if (!hasSharedExamples) {
        const availableLegacyOwnerKeys = getLegacyLocalExampleOwnerKeys(index);
        if (availableLegacyOwnerKeys.length === 1) {
            legacyOwnerKeys.add(availableLegacyOwnerKeys[0] ?? "");
        }
    }
    if (!legacyOwnerKeys.size) {
        return index;
    }
    const itemsToMigrate = index.items.filter((item) => legacyOwnerKeys.has(item.ownerKey));
    if (!itemsToMigrate.length) {
        return index;
    }
    const sharedOwnerDir = buildLocalExamplesOwnerDir(LOCAL_EXAMPLES_SHARED_OWNER_KEY);
    await mkdir(sharedOwnerDir, { recursive: true });
    for (const item of itemsToMigrate) {
        const legacyOwnerDir = buildLocalExamplesOwnerDir(item.ownerKey);
        const sourcePath = join(legacyOwnerDir, item.mediaFileName);
        const destinationPath = join(sharedOwnerDir, item.mediaFileName);
        await moveLocalExampleMediaFile(sourcePath, destinationPath).catch(() => undefined);
        item.ownerKey = LOCAL_EXAMPLES_SHARED_OWNER_KEY;
    }
    await writeLocalExamplesIndex(index);
    return index;
};
const truncateText = (value, maxLength) => {
    if (value.length <= maxLength) {
        return value;
    }
    const clipped = value.slice(0, Math.max(1, maxLength - 1)).trimEnd();
    return `${clipped}…`;
};
const buildLocalExamplePromptHint = (prompt) => truncateText(prompt || "Локальный пример из Studio.", 96);
const buildLocalExampleSummary = (prompt) => truncateText(prompt || "Локально сохранённый пример из обычной генерации.", 160);
const sanitizeLocalExampleTitle = (title, prompt) => {
    const normalizedTitle = normalizeText(title);
    if (normalizedTitle) {
        return truncateText(normalizedTitle, 110);
    }
    return truncateText(prompt || "Локальный пример", 110);
};
const inferLocalExampleVideoContentType = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) {
        return "video/mp4";
    }
    if (normalized.includes("webm")) {
        return "video/webm";
    }
    if (normalized.includes("quicktime")) {
        return "video/quicktime";
    }
    return "video/mp4";
};
const inferLocalExampleVideoExtension = (contentType, url) => {
    const normalizedContentType = inferLocalExampleVideoContentType(contentType);
    const pathname = normalizeText(url.pathname).toLowerCase();
    if (pathname.endsWith(".webm") || normalizedContentType === "video/webm") {
        return ".webm";
    }
    if (pathname.endsWith(".mov") || normalizedContentType === "video/quicktime") {
        return ".mov";
    }
    return ".mp4";
};
const resolveLocalExampleVideoTarget = async (videoUrl, user) => {
    const normalizedVideoUrl = normalizeText(videoUrl);
    if (!normalizedVideoUrl) {
        throw new Error("Video URL is required.");
    }
    const resolvedUrl = new URL(normalizedVideoUrl, env.appUrl);
    if (resolvedUrl.pathname === "/api/studio/video") {
        const path = normalizeText(resolvedUrl.searchParams.get("path"));
        if (!path) {
            throw new Error("Studio video path is missing.");
        }
        return {
            sourceUrl: getStudioVideoProxyTargetByPath(path),
        };
    }
    if (resolvedUrl.pathname.startsWith("/api/studio/video/")) {
        const jobId = decodeURIComponent(resolvedUrl.pathname.slice("/api/studio/video/".length));
        return {
            sourceUrl: await getStudioVideoProxyTarget(jobId, user),
        };
    }
    if (resolvedUrl.pathname === "/api/workspace/project-video") {
        const path = normalizeText(resolvedUrl.searchParams.get("path"));
        if (!path) {
            throw new Error("Project video path is missing.");
        }
        return {
            sourceUrl: getWorkspaceProjectVideoProxyTarget(path),
        };
    }
    const workspacePlaybackMatch = resolvedUrl.pathname.match(/^\/api\/workspace\/projects\/([^/]+)\/playback$/i);
    if (workspacePlaybackMatch) {
        const projectId = decodeURIComponent(workspacePlaybackMatch[1] ?? "");
        const asset = await getWorkspaceProjectPlaybackAsset(user, projectId);
        return {
            absolutePath: asset.absolutePath,
            contentType: asset.contentType,
        };
    }
    if (resolvedUrl.protocol === "http:" || resolvedUrl.protocol === "https:") {
        return {
            sourceUrl: resolvedUrl,
        };
    }
    throw new Error("Unsupported local example video source.");
};
const downloadLocalExampleVideo = async (options) => {
    const { ownerKey, source } = options;
    const ownerDir = buildLocalExamplesOwnerDir(ownerKey);
    await mkdir(ownerDir, { recursive: true });
    const exampleId = randomUUID();
    if ("absolutePath" in source) {
        const contentType = inferLocalExampleVideoContentType(source.contentType);
        const extension = inferLocalExampleVideoExtension(contentType, pathToFileURL(source.absolutePath));
        const mediaFileName = `${exampleId}${extension}`;
        const absolutePath = join(ownerDir, mediaFileName);
        const tempPath = `${absolutePath}.tmp`;
        try {
            await copyFile(source.absolutePath, tempPath);
            await rename(tempPath, absolutePath);
        }
        catch (error) {
            await rm(tempPath, { force: true }).catch(() => undefined);
            throw error;
        }
        return {
            contentType,
            exampleId,
            mediaFileName,
        };
    }
    const response = await fetch(source.sourceUrl, {
        headers: {
            connection: "close",
        },
        signal: AbortSignal.timeout(LOCAL_EXAMPLE_FETCH_TIMEOUT_MS),
    });
    if (!response.ok || !response.body) {
        throw new Error(`Failed to download local example video (${response.status}).`);
    }
    const contentType = inferLocalExampleVideoContentType(response.headers.get("content-type"));
    const extension = inferLocalExampleVideoExtension(contentType, source.sourceUrl);
    const mediaFileName = `${exampleId}${extension}`;
    const absolutePath = join(ownerDir, mediaFileName);
    const tempPath = `${absolutePath}.tmp`;
    try {
        await pipeline(Readable.fromWeb(response.body), createWriteStream(tempPath));
        await rename(tempPath, absolutePath);
    }
    catch (error) {
        await rm(tempPath, { force: true }).catch(() => undefined);
        throw error;
    }
    return {
        contentType,
        exampleId,
        mediaFileName,
    };
};
const buildLocalExampleVideoUrl = (exampleId) => {
    const url = new URL(`/api/examples/local-video/${encodeURIComponent(exampleId)}`, env.appUrl);
    return `${url.pathname}${url.search}`;
};
const toLocalExampleClientItem = (item) => ({
    goal: normalizeLocalExampleGoal(item.goal) ?? "interesting",
    id: item.id,
    isLocal: true,
    promptHint: buildLocalExamplePromptHint(item.prompt),
    seedPrompt: item.prompt,
    summary: buildLocalExampleSummary(item.prompt),
    tags: ["Локально", "Studio"],
    title: item.title,
    videoSrc: buildLocalExampleVideoUrl(item.id),
});
export const getLocalExamplesState = async (user) => {
    if (!isLocalExamplesEnabled()) {
        return {
            canManage: false,
            enabled: false,
            items: [],
        };
    }
    const index = await migrateAdminExamplesToSharedOwner(await readLocalExamplesIndex(), user);
    return {
        canManage: isLocalExamplesAdmin(user),
        enabled: true,
        items: index.items
            .filter((item) => item.ownerKey === LOCAL_EXAMPLES_SHARED_OWNER_KEY)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .map(toLocalExampleClientItem),
    };
};
export const saveLocalExample = async (user, input) => {
    if (!isLocalExamplesEnabled()) {
        throw new Error("Local examples are disabled.");
    }
    assertLocalExamplesAdmin(user);
    const ownerKey = LOCAL_EXAMPLES_SHARED_OWNER_KEY;
    const goal = normalizeLocalExampleGoal(input.goal);
    const prompt = normalizeText(input.prompt);
    const title = sanitizeLocalExampleTitle(input.title, prompt);
    const sourceId = normalizeText(input.sourceId) || null;
    if (!goal) {
        throw new Error("Local example section is required.");
    }
    if (!prompt) {
        throw new Error("Video topic is required.");
    }
    const source = await resolveLocalExampleVideoTarget(input.videoUrl, user);
    const downloadedVideo = await downloadLocalExampleVideo({
        ownerKey,
        source,
    });
    const index = await migrateAdminExamplesToSharedOwner(await readLocalExamplesIndex(), user);
    const nextItem = {
        createdAt: new Date().toISOString(),
        goal,
        id: downloadedVideo.exampleId,
        mediaContentType: downloadedVideo.contentType,
        mediaFileName: downloadedVideo.mediaFileName,
        ownerKey,
        prompt,
        sourceId,
        title,
    };
    index.items.push(nextItem);
    await writeLocalExamplesIndex(index);
    return toLocalExampleClientItem(nextItem);
};
export const getLocalExampleVideoAsset = async (user, exampleId) => {
    if (!isLocalExamplesEnabled()) {
        throw new Error("Local examples are disabled.");
    }
    const normalizedExampleId = normalizeText(exampleId);
    if (!normalizedExampleId) {
        throw new Error("Local example id is required.");
    }
    const index = await migrateAdminExamplesToSharedOwner(await readLocalExamplesIndex(), user);
    const item = index.items.find((entry) => entry.id === normalizedExampleId && entry.ownerKey === LOCAL_EXAMPLES_SHARED_OWNER_KEY) ?? null;
    if (!item) {
        throw new Error("Local example not found.");
    }
    const ownerDir = buildLocalExamplesOwnerDir(LOCAL_EXAMPLES_SHARED_OWNER_KEY);
    const absolutePath = join(ownerDir, item.mediaFileName);
    await stat(absolutePath);
    return {
        absolutePath,
        contentType: inferLocalExampleVideoContentType(item.mediaContentType),
        stream: () => createReadStream(absolutePath),
    };
};
export const deleteLocalExample = async (user, exampleId) => {
    if (!isLocalExamplesEnabled()) {
        throw new Error("Local examples are disabled.");
    }
    assertLocalExamplesAdmin(user);
    const normalizedExampleId = normalizeText(exampleId);
    if (!normalizedExampleId) {
        throw new Error("Local example id is required.");
    }
    const ownerKey = LOCAL_EXAMPLES_SHARED_OWNER_KEY;
    const index = await migrateAdminExamplesToSharedOwner(await readLocalExamplesIndex(), user);
    const itemIndex = index.items.findIndex((entry) => entry.id === normalizedExampleId && entry.ownerKey === ownerKey);
    if (itemIndex < 0) {
        throw new Error("Local example not found.");
    }
    const [item] = index.items.splice(itemIndex, 1);
    await writeLocalExamplesIndex(index);
    const ownerDir = buildLocalExamplesOwnerDir(ownerKey);
    const absolutePath = join(ownerDir, item.mediaFileName);
    await rm(absolutePath, { force: true }).catch(() => undefined);
    return {
        exampleId: normalizedExampleId,
    };
};
