import { areWorkspaceMediaLibraryUrlsEqual, createWorkspaceMediaLibraryItem, getWorkspaceMediaLibraryUrlMarker, getWorkspaceImageDownloadName, getWorkspaceProjectDisplayTitle, getWorkspaceVideoDownloadName, } from "../src/lib/workspaceMediaLibrary.js";
import { env } from "./env.js";
import { ensureWorkspaceVideoPoster, getWorkspaceVideoPosterCacheKey, } from "./project-posters.js";
import { ensureWorkspacePreviewImage, getWorkspacePreviewImageCacheKey, } from "./preview-images.js";
import { getWorkspaceProjects } from "./projects.js";
import { getWorkspaceProjectSegmentVideoProxyTarget, getWorkspaceSegmentEditorSession, getWorkspaceSegmentEditorSessionForAccessibleProject, } from "./segment-editor.js";
import { clearWorkspaceMediaIndex, getWorkspaceMediaIndexProjectEntry, listWorkspaceMediaIndexProjectEntries, pruneWorkspaceMediaIndexProjects, upsertWorkspaceMediaIndexProjectEntry, } from "./workspace-media-index.js";
const WORKSPACE_MEDIA_LIBRARY_CACHE_TTL_MS = 60_000;
const WORKSPACE_MEDIA_LIBRARY_SEGMENT_CONCURRENCY = 6;
const WORKSPACE_MEDIA_LIBRARY_DEFAULT_LIMIT = 24;
const WORKSPACE_MEDIA_LIBRARY_MAX_LIMIT = 96;
const WORKSPACE_MEDIA_LIBRARY_INDEX_SCHEMA_VERSION = "media-v3";
const workspaceMediaLibraryCache = new Map();
const workspaceMediaLibraryInFlight = new Map();
const workspaceMediaLibraryIndexWarmInFlight = new Set();
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const isWorkspaceRenderableMediaPreviewUrl = (value) => {
    const normalized = normalizeText(value);
    if (!normalized) {
        return false;
    }
    if (normalized.startsWith("/")) {
        return true;
    }
    try {
        const resolvedUrl = new URL(normalized);
        return (resolvedUrl.protocol === "http:" ||
            resolvedUrl.protocol === "https:" ||
            resolvedUrl.protocol === "file:");
    }
    catch {
        return false;
    }
};
const isWorkspaceMediaLibraryItemKind = (value) => value === "ai_photo" || value === "ai_video" || value === "photo_animation" || value === "image_edit";
const isWorkspaceSegmentEditorVideoSource = (value) => value === "current" || value === "original";
const isWorkspaceSegmentEditorVideoDelivery = (value) => value === "preview" || value === "playback";
const getWorkspaceMediaLibraryCacheKey = (user) => {
    const userId = normalizeText(user.id);
    if (userId) {
        return `user:${userId}:workspace-media-library`;
    }
    const email = normalizeText(user.email).toLowerCase();
    return email ? `email:${email}:workspace-media-library` : null;
};
const cloneWorkspaceMediaLibraryItems = (items) => items.map((item) => ({ ...item }));
const cloneWorkspaceMediaLibraryPage = (page) => ({
    items: cloneWorkspaceMediaLibraryItems(page.items),
    nextCursor: page.nextCursor,
    total: page.total,
});
const buildWorkspaceMediaLibraryPreviewUrl = (options) => {
    const previewUrl = new URL("/api/workspace/media-library-preview", env.appUrl);
    previewUrl.searchParams.set("kind", options.kind);
    previewUrl.searchParams.set("projectId", String(options.projectId));
    previewUrl.searchParams.set("segmentIndex", String(options.segmentIndex));
    if (options.version) {
        previewUrl.searchParams.set("v", options.version);
    }
    return `${previewUrl.pathname}${previewUrl.search}`;
};
const buildWorkspaceMediaLibraryPreviewVersion = (value, fallbackToken) => getWorkspaceMediaLibraryUrlMarker(value) || normalizeText(fallbackToken);
const appendUrlToken = (value, key, token) => {
    const normalizedValue = String(value ?? "").trim();
    const normalizedToken = String(token ?? "").trim();
    if (!normalizedValue || !normalizedToken) {
        return normalizedValue || null;
    }
    try {
        const resolvedUrl = new URL(normalizedValue, "http://localhost");
        resolvedUrl.searchParams.set(key, normalizedToken);
        if (/^https?:\/\//i.test(normalizedValue)) {
            return resolvedUrl.toString();
        }
        return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
    }
    catch {
        return normalizedValue;
    }
};
const mapWithConcurrencyLimit = async (items, concurrencyLimit, mapper) => {
    if (!items.length) {
        return [];
    }
    const nextResults = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.max(1, Math.min(concurrencyLimit, items.length));
    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            nextResults[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    }));
    return nextResults;
};
const parseWorkspaceMediaLibraryLimit = (value) => {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized <= 0) {
        return WORKSPACE_MEDIA_LIBRARY_DEFAULT_LIMIT;
    }
    return Math.max(1, Math.min(Math.trunc(normalized), WORKSPACE_MEDIA_LIBRARY_MAX_LIMIT));
};
const parseWorkspaceMediaLibraryCursor = (value) => {
    const normalized = normalizeText(value);
    if (!normalized) {
        return 0;
    }
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return 0;
    }
    return Math.trunc(numeric);
};
const buildWorkspaceMediaLibraryNextCursor = (offset) => String(Math.max(0, offset));
const getWorkspaceMediaLibraryProjectVersion = (project) => `${normalizeText(project.updatedAt || project.generatedAt || project.createdAt || project.id)}:${WORKSPACE_MEDIA_LIBRARY_INDEX_SCHEMA_VERSION}`;
const getWorkspaceMediaLibraryIndexWarmKey = (user, projectId) => {
    const cacheKey = getWorkspaceMediaLibraryCacheKey(user);
    return cacheKey ? `${cacheKey}:project:${projectId}` : `anonymous:project:${projectId}`;
};
const buildWorkspaceMediaLibraryDownloadName = (projectTitle, segmentListIndex, kind) => {
    const segmentLabel = `${projectTitle}-segment-${segmentListIndex + 1}`;
    if (kind === "ai_video") {
        return getWorkspaceVideoDownloadName(`${segmentLabel}-ai-video`);
    }
    if (kind === "photo_animation") {
        return getWorkspaceVideoDownloadName(`${segmentLabel}-animation`);
    }
    if (kind === "image_edit") {
        return getWorkspaceImageDownloadName(`${segmentLabel}-edit`);
    }
    return getWorkspaceImageDownloadName(segmentLabel);
};
const getWorkspacePhotoOriginalPreviewUrl = (segment) => segment.originalExternalPreviewUrl ??
    segment.originalExternalPlaybackUrl ??
    null;
const getWorkspacePhotoOriginalDownloadUrl = (segment) => segment.originalExternalPlaybackUrl ??
    segment.originalExternalPreviewUrl ??
    null;
const getWorkspacePhotoOriginalComparisonPreviewUrl = (segment) => segment.originalExternalPreviewUrl ??
    segment.originalExternalPlaybackUrl ??
    segment.originalPreviewUrl ??
    segment.originalPlaybackUrl ??
    null;
const getWorkspacePhotoOriginalComparisonPlaybackUrl = (segment) => segment.originalExternalPlaybackUrl ??
    segment.originalExternalPreviewUrl ??
    segment.originalPlaybackUrl ??
    segment.originalPreviewUrl ??
    null;
const getWorkspacePhotoCurrentComparisonPreviewUrl = (segment) => segment.currentExternalPreviewUrl ??
    segment.currentExternalPlaybackUrl ??
    segment.currentPreviewUrl ??
    segment.currentPlaybackUrl ??
    null;
const getWorkspacePhotoCurrentComparisonPlaybackUrl = (segment) => segment.currentExternalPlaybackUrl ??
    segment.currentExternalPreviewUrl ??
    segment.currentPlaybackUrl ??
    segment.currentPreviewUrl ??
    null;
const getWorkspacePhotoAnimationPreviewUrl = (segment) => segment.currentPreviewUrl ??
    segment.currentPlaybackUrl ??
    segment.currentExternalPreviewUrl ??
    segment.currentExternalPlaybackUrl ??
    null;
const getWorkspacePhotoAnimationDownloadUrl = (segment) => segment.currentPlaybackUrl ??
    segment.currentExternalPlaybackUrl ??
    segment.currentPreviewUrl ??
    segment.currentExternalPreviewUrl ??
    null;
const toWorkspaceMediaIndexStoredItems = (items) => items.map((item) => ({
    kind: item.kind,
    previewKind: item.previewKind,
    previewPosterUrl: item.previewPosterUrl,
    previewUrl: item.previewUrl,
    segmentIndex: item.segmentIndex,
    segmentListIndex: item.segmentListIndex,
}));
const hydrateWorkspaceMediaLibraryIndexEntry = (project, entry) => {
    const projectTitle = getWorkspaceProjectDisplayTitle(project);
    const downloadToken = getWorkspaceMediaLibraryProjectVersion(project);
    return entry.items.map((item) => createWorkspaceMediaLibraryItem({
        downloadName: buildWorkspaceMediaLibraryDownloadName(projectTitle, item.segmentListIndex, item.kind),
        downloadUrl: appendUrlToken(item.previewUrl, "download", `${downloadToken}:${item.segmentIndex}:${item.kind}`),
        kind: item.kind,
        previewKind: item.previewKind,
        previewPosterUrl: item.previewPosterUrl,
        previewUrl: item.previewUrl,
        projectId: project.adId,
        projectTitle,
        segmentIndex: item.segmentIndex,
        segmentListIndex: item.segmentListIndex,
        source: "persisted",
    }));
};
const isWorkspaceMediaIndexEntryUsable = (entry) => entry.items.every((item) => {
    if (item.previewKind === "image") {
        return isWorkspaceRenderableMediaPreviewUrl(item.previewUrl);
    }
    return Boolean(normalizeText(item.previewUrl));
});
export const buildWorkspacePersistedMediaLibraryItems = (project, session) => {
    const projectId = project.adId;
    const projectTitle = getWorkspaceProjectDisplayTitle(project);
    const downloadToken = project.updatedAt || project.generatedAt || project.createdAt || project.id;
    return session.segments.flatMap((segment, segmentListIndex) => {
        const originalPreviewUrl = segment.originalPreviewUrl;
        const originalPlaybackUrl = segment.originalPlaybackUrl ?? segment.originalPreviewUrl;
        const currentPreviewUrl = segment.currentPreviewUrl ?? segment.currentPlaybackUrl;
        const currentPlaybackUrl = segment.currentPlaybackUrl ?? segment.currentPreviewUrl;
        const items = [];
        if (segment.mediaType !== "photo") {
            const hasAiVideoVariant = Boolean(currentPreviewUrl || currentPlaybackUrl) &&
                (!originalPreviewUrl ||
                    !originalPlaybackUrl ||
                    !areWorkspaceMediaLibraryUrlsEqual(currentPreviewUrl, originalPreviewUrl) ||
                    !areWorkspaceMediaLibraryUrlsEqual(currentPlaybackUrl, originalPlaybackUrl));
            if (hasAiVideoVariant) {
                const aiVideoPreviewUrl = currentPlaybackUrl ?? currentPreviewUrl;
                if (aiVideoPreviewUrl) {
                    items.push(createWorkspaceMediaLibraryItem({
                        downloadName: getWorkspaceVideoDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-ai-video`),
                        downloadUrl: appendUrlToken(currentPlaybackUrl ?? aiVideoPreviewUrl, "download", `${downloadToken}:${segment.index}:ai-video`),
                        kind: "ai_video",
                        previewKind: "video",
                        previewPosterUrl: buildWorkspaceMediaLibraryPreviewUrl({
                            kind: "ai_video",
                            projectId,
                            segmentIndex: segment.index,
                            version: buildWorkspaceMediaLibraryPreviewVersion(currentPreviewUrl ?? currentPlaybackUrl ?? originalPreviewUrl, `${downloadToken}:${segment.index}:ai-video`),
                        }),
                        previewUrl: aiVideoPreviewUrl,
                        projectId,
                        projectTitle,
                        segmentIndex: segment.index,
                        segmentListIndex,
                        source: "persisted",
                    }));
                }
            }
            return items;
        }
        const originalPhotoPreviewUrl = getWorkspacePhotoOriginalPreviewUrl(segment);
        const originalPhotoDownloadUrl = getWorkspacePhotoOriginalDownloadUrl(segment);
        if (originalPhotoPreviewUrl) {
            items.push(createWorkspaceMediaLibraryItem({
                downloadName: getWorkspaceImageDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}`),
                downloadUrl: appendUrlToken(originalPhotoDownloadUrl ?? originalPhotoPreviewUrl, "download", `${downloadToken}:${segment.index}:original`),
                kind: "ai_photo",
                previewKind: "image",
                previewPosterUrl: buildWorkspaceMediaLibraryPreviewUrl({
                    kind: "ai_photo",
                    projectId,
                    segmentIndex: segment.index,
                    version: buildWorkspaceMediaLibraryPreviewVersion(originalPhotoPreviewUrl, `${downloadToken}:${segment.index}:ai-photo`),
                }),
                previewUrl: originalPhotoPreviewUrl,
                projectId,
                projectTitle,
                segmentIndex: segment.index,
                segmentListIndex,
                source: "persisted",
            }));
        }
        const hasAnimatedVariant = Boolean(getWorkspacePhotoAnimationPreviewUrl(segment) ||
            getWorkspacePhotoAnimationDownloadUrl(segment)) &&
            (!areWorkspaceMediaLibraryUrlsEqual(getWorkspacePhotoCurrentComparisonPreviewUrl(segment), getWorkspacePhotoOriginalComparisonPreviewUrl(segment)) ||
                !areWorkspaceMediaLibraryUrlsEqual(getWorkspacePhotoCurrentComparisonPlaybackUrl(segment), getWorkspacePhotoOriginalComparisonPlaybackUrl(segment)));
        if (hasAnimatedVariant) {
            const animatedPreviewUrl = getWorkspacePhotoAnimationPreviewUrl(segment);
            const animatedDownloadUrl = getWorkspacePhotoAnimationDownloadUrl(segment);
            const animatedPosterUrl = originalPhotoPreviewUrl ??
                buildWorkspaceMediaLibraryPreviewUrl({
                    kind: "photo_animation",
                    projectId,
                    segmentIndex: segment.index,
                    version: buildWorkspaceMediaLibraryPreviewVersion(animatedPreviewUrl ?? animatedDownloadUrl ?? originalPhotoPreviewUrl, `${downloadToken}:${segment.index}:photo-animation`),
                });
            if (animatedPreviewUrl) {
                items.push(createWorkspaceMediaLibraryItem({
                    downloadName: getWorkspaceVideoDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-animation`),
                    downloadUrl: appendUrlToken(animatedDownloadUrl ?? animatedPreviewUrl, "download", `${downloadToken}:${segment.index}:animation`),
                    kind: "photo_animation",
                    previewKind: "video",
                    previewPosterUrl: animatedPosterUrl,
                    previewUrl: animatedPreviewUrl,
                    projectId,
                    projectTitle,
                    segmentIndex: segment.index,
                    segmentListIndex,
                    source: "persisted",
                }));
            }
        }
        return items;
    });
};
const buildWorkspaceMediaLibraryIndexEntry = async (user, project, options) => {
    const session = await getWorkspaceSegmentEditorSessionForAccessibleProject(user, project.adId, {
        bypassCache: options?.bypassCache,
    });
    const items = buildWorkspacePersistedMediaLibraryItems(project, session);
    const entry = {
        items: toWorkspaceMediaIndexStoredItems(items),
        projectId: project.adId,
        projectVersion: getWorkspaceMediaLibraryProjectVersion(project),
        updatedAt: new Date().toISOString(),
    };
    await upsertWorkspaceMediaIndexProjectEntry(user, entry);
    return entry;
};
const warmWorkspaceMediaLibraryProjectIndexEntries = (user, projects, options) => {
    if (!projects.length) {
        return;
    }
    void mapWithConcurrencyLimit(projects, 2, async (project) => {
        const warmKey = getWorkspaceMediaLibraryIndexWarmKey(user, project.adId);
        if (workspaceMediaLibraryIndexWarmInFlight.has(warmKey)) {
            return;
        }
        workspaceMediaLibraryIndexWarmInFlight.add(warmKey);
        try {
            await buildWorkspaceMediaLibraryIndexEntry(user, project, options);
        }
        catch (error) {
            console.warn("[workspace] Failed to warm media library index entry", {
                error: error instanceof Error ? error.message : "Unknown media library index warmup error.",
                projectId: project.adId,
            });
        }
        finally {
            workspaceMediaLibraryIndexWarmInFlight.delete(warmKey);
        }
    });
};
const loadWorkspaceMediaLibraryIndexEntries = async (user, options) => {
    const projects = await getWorkspaceProjects(user);
    const readyProjects = projects.filter((project) => project.status === "ready" && typeof project.adId === "number" && project.adId > 0);
    if (!readyProjects.length) {
        return {
            hasPendingProjects: false,
            records: [],
        };
    }
    if (options?.bypassCache) {
        await clearWorkspaceMediaIndex(user);
    }
    const validProjectVersions = new Map(readyProjects.map((project) => [project.adId, getWorkspaceMediaLibraryProjectVersion(project)]));
    await pruneWorkspaceMediaIndexProjects(user, validProjectVersions);
    const existingEntries = await listWorkspaceMediaIndexProjectEntries(user);
    const entriesByProjectId = new Map(existingEntries.map((entry) => [entry.projectId, entry]));
    const targetItemCount = Math.max(1, (options?.offset ?? 0) + (options?.limit ?? WORKSPACE_MEDIA_LIBRARY_DEFAULT_LIMIT));
    const resolvedEntries = [];
    const remainingProjects = [];
    let indexedItemCount = 0;
    let firstFailure = null;
    let hasSuccessfulProjectLoad = false;
    for (const project of readyProjects) {
        const projectVersion = getWorkspaceMediaLibraryProjectVersion(project);
        let entry = entriesByProjectId.get(project.adId) ?? null;
        if (entry && normalizeText(entry.projectVersion) !== projectVersion) {
            entry = null;
        }
        if (entry && !isWorkspaceMediaIndexEntryUsable(entry)) {
            entry = null;
        }
        if (!entry) {
            if (indexedItemCount >= targetItemCount) {
                remainingProjects.push(project);
                continue;
            }
            try {
                entry = await buildWorkspaceMediaLibraryIndexEntry(user, project, options);
                entriesByProjectId.set(entry.projectId, entry);
                hasSuccessfulProjectLoad = true;
            }
            catch (error) {
                if (!firstFailure) {
                    firstFailure = error instanceof Error ? error : new Error("Не удалось загрузить медиатеку сегментов.");
                }
                continue;
            }
        }
        resolvedEntries.push({ entry, project });
        indexedItemCount += entry.items.length;
    }
    if (resolvedEntries.length === 0 && firstFailure && !hasSuccessfulProjectLoad) {
        throw firstFailure;
    }
    if (remainingProjects.length > 0) {
        warmWorkspaceMediaLibraryProjectIndexEntries(user, remainingProjects, options);
    }
    return {
        hasPendingProjects: remainingProjects.length > 0,
        records: resolvedEntries,
    };
};
const findWorkspaceMediaLibrarySegment = (session, segmentIndex) => session.segments.find((segment) => segment.index === segmentIndex) ?? null;
export const getWorkspaceMediaLibrarySegmentPreviewUrl = (segment, kind) => {
    if (kind === "ai_photo") {
        return getWorkspacePhotoOriginalPreviewUrl(segment);
    }
    if (kind === "image_edit") {
        return (segment.currentExternalPreviewUrl ??
            segment.currentExternalPlaybackUrl ??
            segment.originalExternalPreviewUrl ??
            segment.originalExternalPlaybackUrl ??
            segment.currentPreviewUrl ??
            segment.currentPlaybackUrl ??
            segment.originalPreviewUrl ??
            segment.originalPlaybackUrl ??
            null);
    }
    return segment.currentPreviewUrl ?? segment.currentPlaybackUrl ?? segment.originalPreviewUrl ?? segment.originalPlaybackUrl ?? null;
};
const resolveWorkspaceMediaLibraryPreviewSource = async (user, rawPreviewUrl) => {
    const normalizedPreviewUrl = normalizeText(rawPreviewUrl);
    if (!normalizedPreviewUrl) {
        return null;
    }
    let resolvedUrl;
    try {
        resolvedUrl = new URL(normalizedPreviewUrl, env.appUrl);
    }
    catch {
        return null;
    }
    const version = getWorkspaceMediaLibraryUrlMarker(normalizedPreviewUrl) || normalizedPreviewUrl;
    if (resolvedUrl.pathname === "/api/workspace/project-segment-video") {
        const projectId = Number(resolvedUrl.searchParams.get("projectId") ?? 0);
        const segmentIndex = Number(resolvedUrl.searchParams.get("segmentIndex") ?? -1);
        const source = String(resolvedUrl.searchParams.get("source") ?? "").trim();
        const delivery = String(resolvedUrl.searchParams.get("delivery") ?? "").trim();
        if (!Number.isFinite(projectId) ||
            projectId <= 0 ||
            !Number.isFinite(segmentIndex) ||
            segmentIndex < 0 ||
            !isWorkspaceSegmentEditorVideoSource(source) ||
            !isWorkspaceSegmentEditorVideoDelivery(delivery)) {
            return null;
        }
        const target = await getWorkspaceProjectSegmentVideoProxyTarget(user, {
            delivery,
            projectId,
            segmentIndex,
            source,
        });
        return {
            headers: target.headers,
            upstreamUrl: target.url,
            version,
        };
    }
    if (resolvedUrl.protocol === "http:" || resolvedUrl.protocol === "https:" || resolvedUrl.protocol === "file:") {
        return {
            headers: undefined,
            upstreamUrl: resolvedUrl,
            version,
        };
    }
    return null;
};
export class WorkspaceMediaLibraryPreviewError extends Error {
    statusCode;
    constructor(message, statusCode = 400) {
        super(message);
        this.name = "WorkspaceMediaLibraryPreviewError";
        this.statusCode = statusCode;
    }
}
export const getWorkspaceMediaLibraryPreviewPath = async (user, options) => {
    if (!Number.isFinite(options.projectId) || options.projectId <= 0) {
        throw new WorkspaceMediaLibraryPreviewError("Project id is required.", 400);
    }
    if (!Number.isFinite(options.segmentIndex) || options.segmentIndex < 0) {
        throw new WorkspaceMediaLibraryPreviewError("Segment index is required.", 400);
    }
    if (!isWorkspaceMediaLibraryItemKind(options.kind)) {
        throw new WorkspaceMediaLibraryPreviewError("Media library preview kind is invalid.", 400);
    }
    const normalizedVersion = normalizeText(options.version);
    let rawPreviewUrl = null;
    if (normalizedVersion) {
        const indexEntry = await getWorkspaceMediaIndexProjectEntry(user, options.projectId, normalizedVersion);
        const indexedItem = indexEntry?.items.find((item) => item.kind === options.kind && item.segmentIndex === options.segmentIndex) ?? null;
        rawPreviewUrl = indexedItem?.previewUrl ?? null;
    }
    if (!rawPreviewUrl) {
        const session = await getWorkspaceSegmentEditorSession(user, options.projectId);
        const segment = findWorkspaceMediaLibrarySegment(session, options.segmentIndex);
        if (!segment) {
            throw new WorkspaceMediaLibraryPreviewError("Segment preview source is unavailable.", 404);
        }
        rawPreviewUrl = getWorkspaceMediaLibrarySegmentPreviewUrl(segment, options.kind);
    }
    if (!rawPreviewUrl) {
        throw new WorkspaceMediaLibraryPreviewError("Segment preview source is unavailable.", 404);
    }
    const previewSource = await resolveWorkspaceMediaLibraryPreviewSource(user, rawPreviewUrl);
    if (!previewSource) {
        throw new WorkspaceMediaLibraryPreviewError("Segment preview source is unavailable.", 404);
    }
    const previewId = `workspace-media:${options.projectId}:${options.segmentIndex}:${options.kind}`;
    if (options.kind === "ai_photo" || options.kind === "image_edit") {
        return ensureWorkspacePreviewImage({
            cacheKey: getWorkspacePreviewImageCacheKey({
                previewId,
                targetUrl: previewSource.upstreamUrl,
                version: previewSource.version,
            }),
            upstreamHeaders: previewSource.headers,
            upstreamUrl: previewSource.upstreamUrl,
        });
    }
    return ensureWorkspaceVideoPoster({
        cacheKey: getWorkspaceVideoPosterCacheKey({
            posterId: previewId,
            targetUrl: previewSource.upstreamUrl,
            version: previewSource.version,
        }),
        upstreamHeaders: previewSource.headers,
        upstreamUrl: previewSource.upstreamUrl,
    });
};
export const invalidateWorkspaceMediaLibraryCache = (user) => {
    const cacheKey = getWorkspaceMediaLibraryCacheKey(user);
    if (!cacheKey) {
        return;
    }
    workspaceMediaLibraryCache.delete(cacheKey);
    workspaceMediaLibraryInFlight.delete(cacheKey);
};
export const getWorkspaceMediaLibraryItems = async (user, options) => {
    const shouldBypassCache = Boolean(options?.bypassCache);
    const offset = parseWorkspaceMediaLibraryCursor(options?.cursor ?? null);
    const limit = parseWorkspaceMediaLibraryLimit(options?.limit);
    const baseCacheKey = getWorkspaceMediaLibraryCacheKey(user);
    const cacheKey = baseCacheKey ? `${baseCacheKey}:offset:${offset}:limit:${limit}` : null;
    if (!shouldBypassCache && cacheKey) {
        const cachedEntry = workspaceMediaLibraryCache.get(cacheKey);
        if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
            return cloneWorkspaceMediaLibraryPage(cachedEntry.page);
        }
        const inFlightRequest = workspaceMediaLibraryInFlight.get(cacheKey);
        if (inFlightRequest) {
            return cloneWorkspaceMediaLibraryPage(await inFlightRequest);
        }
    }
    const request = loadWorkspaceMediaLibraryIndexEntries(user, options).then((entries) => {
        const allItems = entries.records.flatMap(({ entry, project }) => hydrateWorkspaceMediaLibraryIndexEntry(project, entry));
        const pageItems = allItems.slice(offset, offset + limit);
        const total = entries.hasPendingProjects
            ? Math.max(allItems.length, offset + pageItems.length + 1)
            : allItems.length;
        return {
            items: pageItems,
            nextCursor: offset + pageItems.length < allItems.length || entries.hasPendingProjects
                ? buildWorkspaceMediaLibraryNextCursor(offset + pageItems.length)
                : null,
            total,
        };
    });
    const shouldTrackInFlight = Boolean(cacheKey && !shouldBypassCache);
    if (shouldTrackInFlight && cacheKey) {
        workspaceMediaLibraryInFlight.set(cacheKey, request);
    }
    try {
        const page = await request;
        if (cacheKey) {
            workspaceMediaLibraryCache.set(cacheKey, {
                expiresAt: Date.now() + WORKSPACE_MEDIA_LIBRARY_CACHE_TTL_MS,
                page: cloneWorkspaceMediaLibraryPage(page),
            });
        }
        return cloneWorkspaceMediaLibraryPage(page);
    }
    finally {
        if (shouldTrackInFlight && cacheKey) {
            workspaceMediaLibraryInFlight.delete(cacheKey);
        }
    }
};
