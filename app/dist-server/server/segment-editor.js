import { env } from "./env.js";
import { getWorkspaceProjects } from "./projects.js";
import { buildWorkspaceMediaAssetRef, fetchProjectMediaEnvelope, mergeWorkspaceMediaAssetRefs, } from "./media-assets.js";
import { assertAdsflowConfigured, buildAdsflowUrl, fetchAdsflowJson as fetchAdsflowJsonWithPolicy, UpstreamFetchError, UpstreamHttpError, upstreamPolicies, } from "./upstream-client.js";
import { listWorkspaceGenerationHistory } from "./workspace-history.js";
export class WorkspaceSegmentEditorError extends Error {
    statusCode;
    constructor(message, statusCode = 400) {
        super(message);
        this.name = "WorkspaceSegmentEditorError";
        this.statusCode = statusCode;
    }
}
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeInteger = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return null;
    const rounded = Math.trunc(numeric);
    return rounded >= 0 ? rounded : null;
};
const normalizeNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};
const normalizeMediaType = (value) => String(value ?? "").trim().toLowerCase() === "photo" ? "photo" : "video";
const normalizeUrl = (value) => {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || null;
};
const isWorkspaceRenderableMediaUrl = (value) => {
    const normalized = normalizeUrl(value);
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
const pickWorkspaceRenderableMediaUrl = (...candidates) => {
    for (const candidate of candidates) {
        if (isWorkspaceRenderableMediaUrl(candidate)) {
            return normalizeUrl(candidate);
        }
    }
    return null;
};
const ADSFLOW_MEDIA_DOWNLOAD_PATH_PATTERN = /\/api\/media\/(\d+)\/download(?:[/?#]|$)/i;
const buildWorkspaceMediaAssetProxyUrl = (assetId) => `/api/workspace/media-assets/${assetId}`;
const getProjectMediaEntryAssetId = (entry) => normalizeInteger(entry?.media_asset_id) ?? normalizeInteger(entry?.id);
const normalizeWorkspaceProjectMediaUrl = (entry, value) => {
    const normalizedUrl = normalizeUrl(value);
    if (!normalizedUrl) {
        return null;
    }
    const assetId = getProjectMediaEntryAssetId(entry);
    if (!assetId || normalizeMediaType(entry?.media_type) !== "photo") {
        return normalizedUrl;
    }
    const matchedPath = normalizedUrl.match(ADSFLOW_MEDIA_DOWNLOAD_PATH_PATTERN);
    if (matchedPath) {
        return buildWorkspaceMediaAssetProxyUrl(assetId);
    }
    try {
        const resolvedUrl = new URL(normalizedUrl);
        return ADSFLOW_MEDIA_DOWNLOAD_PATH_PATTERN.test(resolvedUrl.pathname)
            ? buildWorkspaceMediaAssetProxyUrl(assetId)
            : normalizedUrl;
    }
    catch {
        return normalizedUrl;
    }
};
const getProjectMediaEntryRenderableUrl = (entry, ...candidates) => normalizeWorkspaceProjectMediaUrl(entry, pickWorkspaceRenderableMediaUrl(...candidates));
const normalizeProjectMediaEntries = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item) => Boolean(item && typeof item === "object"));
};
const pickProjectMediaEntries = (...candidates) => {
    for (const candidate of candidates) {
        const entries = normalizeProjectMediaEntries(candidate);
        if (entries.length > 0) {
            return entries;
        }
    }
    return [];
};
const detectWorkspaceSegmentSourceKind = (entry) => {
    const source = normalizeText(entry?.source_kind || entry?.source).toLowerCase();
    if (source === "ai_generated" || source === "ai" || source === "generated") {
        return "ai_generated";
    }
    if (source === "pexels" ||
        source === "pixabay" ||
        source === "stock" ||
        source === "stock_photo" ||
        source === "stock_video" ||
        source === "unsplash") {
        return "stock";
    }
    if (source.includes("upload") ||
        source.includes("telegram") ||
        source.includes("user") ||
        source.includes("library")) {
        return "upload";
    }
    const identifier = normalizeText(entry?.id).toLowerCase();
    const localPath = normalizeText(entry?.local_path).toLowerCase();
    const storageKey = normalizeText(entry?.storage_key).toLowerCase();
    const joinedUrls = [entry?.url, entry?.download_url, entry?.preview].map((value) => normalizeText(value).toLowerCase()).join(" ");
    if (identifier.startsWith("aiimg_") ||
        localPath.includes("wavespeed") ||
        localPath.includes("deapi") ||
        storageKey.includes("wavespeed") ||
        storageKey.includes("deapi") ||
        storageKey.includes("rendered_segment")) {
        return "ai_generated";
    }
    if (joinedUrls.includes("pexels.com") || joinedUrls.includes("pixabay.com") || joinedUrls.includes("unsplash.com")) {
        return "stock";
    }
    return "unknown";
};
const getProjectMediaEntryPreviewUrl = (entry) => getProjectMediaEntryRenderableUrl(entry, entry?.preview, entry?.download_url, entry?.url);
const getProjectMediaEntryPlaybackUrl = (entry) => pickWorkspaceRenderableMediaUrl(entry?.download_url, entry?.url, entry?.preview);
const getProjectOriginalMediaEntries = (payload) => pickProjectMediaEntries(payload?.source_video_urls, payload?.generation_settings?.original_videos, payload?.generation_settings?.video_urls, payload?.generation_settings?.background_urls, payload?.video_urls, payload?.background_urls);
const getProjectCurrentMediaEntries = (payload, originalEntries) => pickProjectMediaEntries(payload?.generation_settings?.current_rendered_segments, payload?.video_urls, payload?.background_urls, payload?.generation_settings?.video_urls, payload?.generation_settings?.background_urls, originalEntries);
const buildProjectMediaAssetIndex = (assets) => new Map(assets
    .filter((asset) => typeof asset.assetId === "number" && asset.assetId > 0)
    .map((asset) => [asset.assetId, asset]));
const buildSegmentMediaAssetFromEntry = (entry, projectMediaByAssetId, options) => {
    const assetId = getProjectMediaEntryAssetId(entry);
    const linkedAsset = assetId !== null ? projectMediaByAssetId.get(assetId) ?? null : null;
    const entryKind = normalizeText(entry?.kind || entry?.asset_kind) || options?.role || null;
    const entryRole = normalizeText(entry?.role || entry?.link_role) || options?.role || entryKind;
    const entryAsset = buildWorkspaceMediaAssetRef({
        download_path: entry?.download_url ?? entry?.url ?? null,
        download_url: entry?.download_url ?? null,
        id: assetId,
        kind: entryKind,
        media_type: entry?.media_type ?? null,
        mime_type: entry?.mime_type ?? null,
        original_url: entry?.url ?? null,
        project_id: options?.projectId ?? null,
        role: entryRole,
        segment_index: options?.segmentIndex ?? null,
        source_kind: detectWorkspaceSegmentSourceKind(entry),
        status: linkedAsset?.status ?? "ready",
        storage_key: entry?.storage_key ?? null,
    });
    return mergeWorkspaceMediaAssetRefs(linkedAsset, entryAsset);
};
const normalizeSpeechWords = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => {
        if (!item || typeof item !== "object") {
            return null;
        }
        const record = item;
        const text = normalizeText(record.text);
        const startTime = normalizeNumber(record.start_time);
        const endTime = normalizeNumber(record.end_time);
        const confidence = normalizeNumber(record.confidence);
        if (!text || startTime === null || endTime === null || endTime <= startTime) {
            return null;
        }
        return {
            confidence: confidence !== null ? Math.max(0, confidence) : 0,
            endTime: Math.max(startTime, endTime),
            startTime: Math.max(0, startTime),
            text,
        };
    })
        .filter((item) => Boolean(item));
};
const PROJECT_ACCESS_CACHE_TTL_MS = 5 * 60_000;
const SEGMENT_EDITOR_SESSION_CACHE_TTL_MS = 10 * 60_000;
const PROJECT_ACCESS_FALLBACK_TIMEOUT_MS = 8_000;
const PROJECT_ACCESS_TIMEOUT_ERROR_MESSAGE = "Список проектов загружается слишком долго. Попробуйте ещё раз.";
const SEGMENT_EDITOR_TIMEOUT_ERROR_MESSAGE = "Сегменты загружаются слишком долго. Попробуйте ещё раз.";
const WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS = 1;
const WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS = 8;
const projectAccessCache = new Map();
const segmentEditorSessionCache = new Map();
const segmentEditorSessionInFlight = new Map();
const getProjectAccessCacheKey = (user, projectId) => {
    const userId = normalizeText(user.id);
    if (userId) {
        return `user:${userId}:project:${projectId}`;
    }
    const email = normalizeText(user.email).toLowerCase();
    return email ? `email:${email}:project:${projectId}` : null;
};
const hasCachedProjectAccess = (user, projectId) => {
    const cacheKey = getProjectAccessCacheKey(user, projectId);
    if (!cacheKey) {
        return false;
    }
    const expiresAt = projectAccessCache.get(cacheKey);
    if (!expiresAt) {
        return false;
    }
    if (expiresAt <= Date.now()) {
        projectAccessCache.delete(cacheKey);
        return false;
    }
    return true;
};
const cacheProjectAccess = (user, projectId) => {
    const cacheKey = getProjectAccessCacheKey(user, projectId);
    if (!cacheKey) {
        return;
    }
    projectAccessCache.set(cacheKey, Date.now() + PROJECT_ACCESS_CACHE_TTL_MS);
};
const getSegmentEditorSessionCacheKey = (user, projectId) => {
    const userId = normalizeText(user.id);
    if (userId) {
        return `user:${userId}:segment-editor:${projectId}`;
    }
    const email = normalizeText(user.email).toLowerCase();
    return email ? `email:${email}:segment-editor:${projectId}` : null;
};
const getCachedSegmentEditorSession = (user, projectId) => {
    const cacheKey = getSegmentEditorSessionCacheKey(user, projectId);
    if (!cacheKey) {
        return null;
    }
    const cachedEntry = segmentEditorSessionCache.get(cacheKey);
    if (!cachedEntry) {
        return null;
    }
    if (cachedEntry.expiresAt <= Date.now()) {
        segmentEditorSessionCache.delete(cacheKey);
        return null;
    }
    return cachedEntry.session;
};
const setCachedSegmentEditorSession = (user, projectId, session) => {
    const cacheKey = getSegmentEditorSessionCacheKey(user, projectId);
    if (!cacheKey) {
        return;
    }
    segmentEditorSessionCache.set(cacheKey, {
        expiresAt: Date.now() + SEGMENT_EDITOR_SESSION_CACHE_TTL_MS,
        session,
    });
};
export const invalidateWorkspaceSegmentEditorSessionCache = (user, projectId) => {
    const exactCacheKey = typeof projectId === "number" && Number.isFinite(projectId) && projectId > 0
        ? getSegmentEditorSessionCacheKey(user, projectId)
        : null;
    if (exactCacheKey) {
        segmentEditorSessionCache.delete(exactCacheKey);
        segmentEditorSessionInFlight.delete(exactCacheKey);
        return;
    }
    const userId = normalizeText(user.id);
    const email = normalizeText(user.email).toLowerCase();
    const cachePrefix = userId ? `user:${userId}:segment-editor:` : email ? `email:${email}:segment-editor:` : null;
    if (!cachePrefix) {
        return;
    }
    for (const key of segmentEditorSessionCache.keys()) {
        if (key.startsWith(cachePrefix)) {
            segmentEditorSessionCache.delete(key);
        }
    }
    for (const key of segmentEditorSessionInFlight.keys()) {
        if (key.startsWith(cachePrefix)) {
            segmentEditorSessionInFlight.delete(key);
        }
    }
};
const withTimeout = async (promise, timeoutMs, errorMessage) => {
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(errorMessage));
        }, timeoutMs);
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    }
    finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
};
const assertWorkspaceProjectAccess = async (user, projectId) => {
    if (hasCachedProjectAccess(user, projectId)) {
        return;
    }
    const historyEntries = await listWorkspaceGenerationHistory(user, 120).catch(() => []);
    if (historyEntries.some((entry) => entry.adId === projectId)) {
        cacheProjectAccess(user, projectId);
        return;
    }
    let projects;
    try {
        projects = await withTimeout(getWorkspaceProjects(user), PROJECT_ACCESS_FALLBACK_TIMEOUT_MS, PROJECT_ACCESS_TIMEOUT_ERROR_MESSAGE);
    }
    catch (error) {
        if (error instanceof Error && error.message === PROJECT_ACCESS_TIMEOUT_ERROR_MESSAGE) {
            throw new WorkspaceSegmentEditorError(error.message, 504);
        }
        throw error;
    }
    const project = projects.find((item) => item.adId === projectId) ?? null;
    if (!project) {
        throw new WorkspaceSegmentEditorError("Проект не найден или недоступен для редактирования.", 404);
    }
    cacheProjectAccess(user, projectId);
    return project;
};
const buildWorkspaceSegmentEditorVideoUrl = (projectId, segmentIndex, source, delivery, marker) => {
    const previewUrl = new URL("/api/workspace/project-segment-video", env.appUrl);
    previewUrl.searchParams.set("projectId", String(projectId));
    previewUrl.searchParams.set("segmentIndex", String(segmentIndex));
    previewUrl.searchParams.set("source", source);
    previewUrl.searchParams.set("delivery", delivery);
    if (marker) {
        previewUrl.searchParams.set("v", marker);
    }
    return `${previewUrl.pathname}${previewUrl.search}`;
};
const buildWorkspaceSegmentEditorSegment = (projectId, payload, projectSources) => {
    const index = normalizeInteger(payload.index);
    if (index === null) {
        return null;
    }
    const startTime = normalizeNumber(payload.start_time) ?? 0;
    const endTime = normalizeNumber(payload.end_time) ?? Math.max(startTime, startTime + (normalizeNumber(payload.duration) ?? 0));
    const duration = normalizeNumber(payload.duration) ?? Math.max(0, endTime - startTime);
    const speechStartTime = normalizeNumber(payload.speech_start_time);
    const speechEndTime = normalizeNumber(payload.speech_end_time);
    const speechDuration = normalizeNumber(payload.speech_duration) ??
        (speechStartTime !== null && speechEndTime !== null ? Math.max(0, speechEndTime - speechStartTime) : null);
    const speechWords = normalizeSpeechWords(payload.speech_words);
    const currentVideoMarker = normalizeText(payload.current_video);
    const originalVideoMarker = normalizeText(payload.original_video);
    const hasCurrentVideo = Boolean(currentVideoMarker);
    const hasOriginalVideo = Boolean(originalVideoMarker);
    const currentEntry = projectSources?.currentEntries[index] ?? null;
    const originalEntry = projectSources?.originalEntries[index] ?? currentEntry;
    const currentAsset = buildSegmentMediaAssetFromEntry(currentEntry, projectSources?.projectMediaByAssetId ?? new Map(), {
        projectId,
        role: "segment_current",
        segmentIndex: index,
    });
    const originalAsset = buildSegmentMediaAssetFromEntry(originalEntry, projectSources?.projectMediaByAssetId ?? new Map(), {
        projectId,
        role: "segment_original",
        segmentIndex: index,
    });
    return {
        currentAsset,
        currentExternalPlaybackUrl: getProjectMediaEntryPlaybackUrl(currentEntry),
        currentExternalPreviewUrl: getProjectMediaEntryPreviewUrl(currentEntry),
        currentPlaybackUrl: hasCurrentVideo
            ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "current", "playback", currentVideoMarker)
            : null,
        currentPreviewUrl: hasCurrentVideo
            ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "current", "preview", currentVideoMarker)
            : null,
        currentSourceKind: detectWorkspaceSegmentSourceKind(currentEntry),
        duration: duration > 0 ? duration : Math.max(0, endTime - startTime),
        endTime,
        index,
        mediaType: normalizeMediaType(payload.media_type),
        originalAsset,
        originalExternalPlaybackUrl: getProjectMediaEntryPlaybackUrl(originalEntry),
        originalExternalPreviewUrl: getProjectMediaEntryPreviewUrl(originalEntry),
        originalPlaybackUrl: hasOriginalVideo
            ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "original", "playback", originalVideoMarker)
            : null,
        originalPreviewUrl: hasOriginalVideo
            ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "original", "preview", originalVideoMarker)
            : null,
        originalSourceKind: detectWorkspaceSegmentSourceKind(originalEntry),
        speechDuration: speechDuration !== null ? Math.max(0, speechDuration) : null,
        speechEndTime: speechStartTime !== null && speechEndTime !== null ? Math.max(speechStartTime, speechEndTime) : null,
        speechStartTime: speechStartTime !== null ? Math.max(0, speechStartTime) : null,
        speechWords,
        startTime,
        text: normalizeText(payload.text),
    };
};
const loadWorkspaceSegmentEditorSession = async (projectId) => {
    assertAdsflowConfigured();
    let payload;
    let projectDetailsPayload = null;
    let projectMediaEnvelope = { assets: [], projectId };
    try {
        const [segmentEditorPayload, projectPayload, mediaEnvelope] = await Promise.all([
            fetchAdsflowJsonWithPolicy({
                context: {
                    endpoint: "segment-editor.session",
                    projectId,
                },
                init: {
                    headers: {
                        "X-Admin-Token": env.adsflowAdminToken ?? "",
                    },
                },
                path: `/api/projects/${projectId}/segment-editor`,
                policy: upstreamPolicies.adsflowMetadata,
            }),
            fetchAdsflowJsonWithPolicy({
                context: {
                    endpoint: "segment-editor.project-details",
                    projectId,
                },
                params: {
                    admin_token: env.adsflowAdminToken ?? "",
                },
                path: `/api/projects/${projectId}`,
                policy: upstreamPolicies.adsflowMetadata,
            }).catch((error) => {
                console.warn(`[segment-editor] Failed to load source metadata for project ${projectId}`, error);
                return null;
            }),
            fetchProjectMediaEnvelope(projectId).catch((error) => {
                console.warn(`[segment-editor] Failed to load durable media for project ${projectId}`, error);
                return { assets: [], projectId };
            }),
        ]);
        payload = segmentEditorPayload;
        projectDetailsPayload = projectPayload;
        projectMediaEnvelope = mediaEnvelope;
    }
    catch (error) {
        if (error instanceof UpstreamFetchError && error.isTimeout) {
            throw new WorkspaceSegmentEditorError(SEGMENT_EDITOR_TIMEOUT_ERROR_MESSAGE, 504);
        }
        if (error instanceof UpstreamHttpError && error.statusCode === 404) {
            throw new WorkspaceSegmentEditorError("Для этого проекта сегменты пока недоступны.", 404);
        }
        const message = error instanceof Error ? error.message.trim().toLowerCase() : "";
        if (message === "not found" || message.includes("404")) {
            throw new WorkspaceSegmentEditorError("Для этого проекта сегменты пока недоступны.", 404);
        }
        throw error;
    }
    const normalizedProjectId = normalizeInteger(payload.project_id) ?? projectId;
    const originalEntries = getProjectOriginalMediaEntries(projectDetailsPayload);
    const currentEntries = getProjectCurrentMediaEntries(projectDetailsPayload, originalEntries);
    const projectMediaByAssetId = buildProjectMediaAssetIndex(projectMediaEnvelope.assets);
    const segments = (payload.segments ?? [])
        .map((segment) => buildWorkspaceSegmentEditorSegment(normalizedProjectId, segment, {
        currentEntries,
        projectMediaByAssetId,
        originalEntries,
    }))
        .filter((segment) => Boolean(segment))
        .sort((left, right) => left.index - right.index);
    if (segments.length < WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS) {
        throw new WorkspaceSegmentEditorError("Для этого проекта пока нет данных сегментов.", 409);
    }
    if (segments.length > WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS) {
        throw new WorkspaceSegmentEditorError(`Редактор сегментов пока поддерживает проекты до ${WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS} сегментов.`, 409);
    }
    return {
        description: normalizeText(payload.description),
        musicType: normalizeText(payload.music_type),
        projectId: normalizedProjectId,
        segments,
        subtitleColor: normalizeText(payload.subtitle_color),
        subtitleStyle: normalizeText(payload.subtitle_style),
        subtitleType: normalizeText(payload.subtitle_type),
        title: normalizeText(payload.title) || `Проект #${normalizedProjectId}`,
        voiceType: normalizeText(payload.voice_type),
    };
};
const getWorkspaceSegmentEditorSessionInternal = async (user, projectId, options) => {
    const shouldBypassCache = Boolean(options?.bypassCache);
    const cacheKey = getSegmentEditorSessionCacheKey(user, projectId);
    const shouldTrackInFlight = Boolean(cacheKey && !shouldBypassCache);
    if (!shouldBypassCache) {
        const cachedSession = getCachedSegmentEditorSession(user, projectId);
        if (cachedSession) {
            return cachedSession;
        }
        if (cacheKey) {
            const inFlightRequest = segmentEditorSessionInFlight.get(cacheKey);
            if (inFlightRequest) {
                return inFlightRequest;
            }
        }
    }
    const request = (async () => {
        if (!options?.skipProjectAccessCheck) {
            await assertWorkspaceProjectAccess(user, projectId);
        }
        return loadWorkspaceSegmentEditorSession(projectId);
    })();
    if (shouldTrackInFlight && cacheKey) {
        segmentEditorSessionInFlight.set(cacheKey, request);
    }
    try {
        const session = await request;
        setCachedSegmentEditorSession(user, projectId, session);
        return session;
    }
    finally {
        if (shouldTrackInFlight && cacheKey) {
            segmentEditorSessionInFlight.delete(cacheKey);
        }
    }
};
export async function getWorkspaceSegmentEditorSession(user, projectId, options) {
    return getWorkspaceSegmentEditorSessionInternal(user, projectId, {
        bypassCache: options?.bypassCache,
    });
}
export async function getWorkspaceSegmentEditorSessionForAccessibleProject(user, projectId, options) {
    return getWorkspaceSegmentEditorSessionInternal(user, projectId, {
        bypassCache: options?.bypassCache,
        skipProjectAccessCheck: true,
    });
}
export async function getWorkspaceProjectSegmentVideoProxyTarget(user, options) {
    assertAdsflowConfigured();
    await assertWorkspaceProjectAccess(user, options.projectId);
    return {
        headers: {
            "X-Admin-Token": env.adsflowAdminToken ?? "",
        },
        url: buildAdsflowUrl(`/api/projects/${options.projectId}/segments/${options.segmentIndex}/video`, {
            delivery: options.delivery,
            source: options.source,
        }),
    };
}
export async function getWorkspaceProjectSegmentVideoAsset(user, options) {
    void user;
    void options;
    return null;
}
