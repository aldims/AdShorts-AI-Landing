import { env } from "./env.js";
import { getWorkspaceProjects } from "./projects.js";
import { listWorkspaceGenerationHistory } from "./workspace-history.js";
export class WorkspaceSegmentEditorError extends Error {
    statusCode;
    constructor(message, statusCode = 400) {
        super(message);
        this.name = "WorkspaceSegmentEditorError";
        this.statusCode = statusCode;
    }
}
class AdsflowRequestError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.name = "AdsflowRequestError";
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
const PROJECT_ACCESS_FALLBACK_TIMEOUT_MS = 8_000;
const SEGMENT_EDITOR_SESSION_TIMEOUT_MS = 15_000;
const PROJECT_ACCESS_TIMEOUT_ERROR_MESSAGE = "Список проектов загружается слишком долго. Попробуйте ещё раз.";
const SEGMENT_EDITOR_TIMEOUT_ERROR_MESSAGE = "Сегменты загружаются слишком долго. Попробуйте ещё раз.";
const WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS = 1;
const WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS = 8;
const projectAccessCache = new Map();
const assertAdsflowConfigured = () => {
    if (!env.adsflowApiBaseUrl || !env.adsflowAdminToken) {
        throw new Error("AdsFlow API is not configured.");
    }
};
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
const buildAdsflowUrl = (path, params) => {
    assertAdsflowConfigured();
    const url = new URL(path, env.adsflowApiBaseUrl);
    Object.entries(params ?? {}).forEach(([key, value]) => {
        if (value) {
            url.searchParams.set(key, value);
        }
    });
    return url;
};
const fetchAdsflowJson = async (url, init) => {
    const response = await fetch(url, init);
    const payload = (await response.json().catch(() => null));
    if (!response.ok) {
        const payloadRecord = payload && typeof payload === "object" ? payload : null;
        const detail = payloadRecord
            ? typeof payloadRecord.detail === "string" && payloadRecord.detail.trim()
                ? payloadRecord.detail.trim()
                : typeof payloadRecord.error === "string" && payloadRecord.error.trim()
                    ? payloadRecord.error.trim()
                    : ""
            : "";
        throw new AdsflowRequestError(detail || `AdsFlow request failed (${response.status}).`, response.status);
    }
    if (!payload) {
        throw new Error("AdsFlow returned an empty response.");
    }
    return payload;
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
const buildWorkspaceSegmentEditorSegment = (projectId, payload) => {
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
    return {
        currentPlaybackUrl: hasCurrentVideo
            ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "current", "playback", currentVideoMarker)
            : null,
        currentPreviewUrl: hasCurrentVideo
            ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "current", "preview", currentVideoMarker)
            : null,
        duration: duration > 0 ? duration : Math.max(0, endTime - startTime),
        endTime,
        index,
        mediaType: normalizeMediaType(payload.media_type),
        originalPlaybackUrl: hasOriginalVideo
            ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "original", "playback", originalVideoMarker)
            : null,
        originalPreviewUrl: hasOriginalVideo
            ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "original", "preview", originalVideoMarker)
            : null,
        speechDuration: speechDuration !== null ? Math.max(0, speechDuration) : null,
        speechEndTime: speechStartTime !== null && speechEndTime !== null ? Math.max(speechStartTime, speechEndTime) : null,
        speechStartTime: speechStartTime !== null ? Math.max(0, speechStartTime) : null,
        speechWords,
        startTime,
        text: normalizeText(payload.text),
    };
};
export async function getWorkspaceSegmentEditorSession(user, projectId) {
    assertAdsflowConfigured();
    await assertWorkspaceProjectAccess(user, projectId);
    let payload;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEGMENT_EDITOR_SESSION_TIMEOUT_MS);
    try {
        payload = await fetchAdsflowJson(buildAdsflowUrl(`/api/projects/${projectId}/segment-editor`), {
            headers: {
                "X-Admin-Token": env.adsflowAdminToken ?? "",
            },
            signal: controller.signal,
        });
    }
    catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new WorkspaceSegmentEditorError(SEGMENT_EDITOR_TIMEOUT_ERROR_MESSAGE, 504);
        }
        if (error instanceof AdsflowRequestError && error.statusCode === 404) {
            throw new WorkspaceSegmentEditorError("Для этого проекта сегменты пока недоступны.", 404);
        }
        const message = error instanceof Error ? error.message.trim().toLowerCase() : "";
        if (message === "not found" || message.includes("404")) {
            throw new WorkspaceSegmentEditorError("Для этого проекта сегменты пока недоступны.", 404);
        }
        throw error;
    }
    finally {
        clearTimeout(timeoutId);
    }
    const normalizedProjectId = normalizeInteger(payload.project_id) ?? projectId;
    const segments = (payload.segments ?? [])
        .map((segment) => buildWorkspaceSegmentEditorSegment(normalizedProjectId, segment))
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
