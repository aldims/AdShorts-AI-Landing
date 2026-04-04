import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
import { ensureWorkspaceProjectPlayback, getWorkspaceProjectPlaybackCacheKey, warmWorkspaceProjectPlayback, } from "./project-playback.js";
import { ensureWorkspaceProjectPoster, getWorkspaceProjectPosterCacheKey, warmWorkspaceProjectPoster, } from "./project-posters.js";
import { listWorkspaceDeletedProjects, listWorkspaceGenerationHistory, markWorkspaceProjectDeleted, } from "./workspace-history.js";
export class WorkspaceProjectNotFoundError extends Error {
    constructor() {
        super("Project not found.");
        this.name = "WorkspaceProjectNotFoundError";
    }
}
const MAX_PROJECTS = 60;
const MAX_PROJECT_FETCH_LIMIT = 200;
const ADSFLOW_ADMIN_VIDEOS_MAX_PAGE_SIZE = 100;
const PROJECTS_CACHE_TTL_MS = 15_000;
const workspaceProjectsCache = new Map();
const workspaceProjectsInFlight = new Map();
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizePrompt = (value) => normalizeText(value);
const parseJson = (value) => {
    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
};
const formatErrorDetailEntry = (value) => {
    if (typeof value === "string") {
        const normalized = normalizeText(value);
        return normalized || null;
    }
    if (!value || typeof value !== "object") {
        return null;
    }
    const record = value;
    const loc = Array.isArray(record.loc)
        ? record.loc
            .map((entry) => normalizeText(entry))
            .filter(Boolean)
            .join(".")
        : "";
    const message = (typeof record.msg === "string" && normalizeText(record.msg)) ||
        (typeof record.error === "string" && normalizeText(record.error)) ||
        "";
    if (loc && message) {
        return `${loc}: ${message}`;
    }
    return message || null;
};
const extractErrorDetail = (value) => {
    const payload = typeof value === "string"
        ? parseJson(value)
        : value && typeof value === "object"
            ? value
            : null;
    if (!payload || typeof payload !== "object") {
        const normalized = normalizeText(value);
        return normalized && !normalized.startsWith("<") ? normalized : null;
    }
    const detail = "detail" in payload ? payload.detail : undefined;
    if (typeof detail === "string" && detail.trim()) {
        return detail.trim();
    }
    if (Array.isArray(detail)) {
        const parts = detail.map(formatErrorDetailEntry).filter(Boolean);
        if (parts.length > 0) {
            return parts.join("; ");
        }
    }
    const error = "error" in payload ? payload.error : undefined;
    if (typeof error === "string" && error.trim()) {
        return error.trim();
    }
    return formatErrorDetailEntry(detail) || formatErrorDetailEntry(error);
};
const extractBootstrapUserId = (value) => {
    const match = value.match(/"user"\s*:\s*\{[\s\S]*?"user_id"\s*:\s*(\d+)/);
    return match?.[1]?.trim() || null;
};
const parseHashtags = (value) => {
    const normalized = normalizeText(value);
    if (!normalized)
        return [];
    const explicitTags = normalized.match(/#[^\s#]+/g);
    if (explicitTags?.length) {
        return Array.from(new Set(explicitTags));
    }
    return Array.from(new Set(normalized
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => `#${item.replace(/^#+/, "")}`)));
};
const cloneWorkspaceProject = (project) => ({
    ...project,
    hashtags: [...project.hashtags],
    youtubePublication: project.youtubePublication ? { ...project.youtubePublication } : null,
});
const cloneWorkspaceProjects = (projects) => projects.map(cloneWorkspaceProject);
const buildPromptTitle = (prompt, fallback = "Проект") => {
    const normalized = normalizePrompt(prompt);
    if (!normalized)
        return fallback;
    if (normalized.length <= 72)
        return normalized;
    const compact = normalized.slice(0, 69).trim();
    return compact ? `${compact}...` : fallback;
};
const isWorkspaceTaskPlaceholderTitle = (value) => normalizeText(value).toLowerCase() === "studio generation";
const resolveWorkspaceTaskTitle = ({ adId, prompt, title, }) => {
    const normalizedTitle = normalizeText(title);
    if (normalizedTitle && !isWorkspaceTaskPlaceholderTitle(normalizedTitle)) {
        return normalizedTitle;
    }
    return buildPromptTitle(prompt, adId ? `Проект #${adId}` : "Проект");
};
const toIsoString = (value) => {
    if (!value)
        return null;
    const normalized = normalizeText(value);
    if (!normalized)
        return null;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
};
const normalizeProjectStatus = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    switch (normalized) {
        case "ready":
        case "completed":
        case "done":
            return "ready";
        case "queued":
            return "queued";
        case "processing":
        case "rendering":
        case "retrying":
            return "processing";
        case "failed":
            return "failed";
        case "draft":
            return "draft";
        default:
            return normalized || "draft";
    }
};
const isAdsflowLatestVideoGenerationTask = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    return !normalized || normalized === "video.generate" || normalized === "video.edit";
};
const buildAbsoluteAdsflowUrl = (value) => {
    const normalized = normalizeText(value);
    if (!normalized)
        return null;
    try {
        return new URL(normalized, getAdsflowBaseUrl()).toString();
    }
    catch {
        return normalized;
    }
};
const isPlayableWorkspaceVideoPath = (value) => {
    const normalized = normalizeText(value);
    if (!normalized)
        return false;
    try {
        const resolvedUrl = new URL(normalized, getAdsflowBaseUrl());
        const hostname = resolvedUrl.hostname.toLowerCase();
        const pathname = resolvedUrl.pathname.toLowerCase();
        if (hostname === "youtu.be" || hostname.endsWith(".youtube.com") || hostname === "youtube.com") {
            return false;
        }
        return (pathname.includes("/api/video/download/") ||
            pathname.includes("/api/web/video/") ||
            /\.(mp4|mov|webm|m4v)$/i.test(pathname));
    }
    catch {
        return false;
    }
};
const buildWorkspaceProjectVideoProxyUrl = (value, version) => {
    if (!isPlayableWorkspaceVideoPath(value)) {
        return null;
    }
    const resolvedUrl = buildAbsoluteAdsflowUrl(value);
    if (!resolvedUrl)
        return null;
    const proxyUrl = new URL("/api/workspace/project-video", env.appUrl);
    proxyUrl.searchParams.set("path", resolvedUrl);
    const normalizedVersion = normalizeText(version);
    if (normalizedVersion) {
        proxyUrl.searchParams.set("v", normalizedVersion);
    }
    return `${proxyUrl.pathname}${proxyUrl.search}`;
};
const buildWorkspaceJobVideoProxyUrl = (jobId, version) => {
    const normalizedJobId = normalizeText(jobId);
    if (!normalizedJobId)
        return null;
    const proxyUrl = new URL(`/api/studio/video/${encodeURIComponent(normalizedJobId)}`, env.appUrl);
    const normalizedVersion = normalizeText(version);
    if (normalizedVersion) {
        proxyUrl.searchParams.set("v", normalizedVersion);
    }
    return `${proxyUrl.pathname}${proxyUrl.search}`;
};
const buildWorkspaceProjectPosterUrl = (projectId, version) => {
    const normalizedProjectId = normalizeText(projectId);
    if (!normalizedProjectId)
        return null;
    const proxyUrl = new URL(`/api/workspace/projects/${encodeURIComponent(normalizedProjectId)}/poster`, env.appUrl);
    const normalizedVersion = normalizeText(version);
    if (normalizedVersion) {
        proxyUrl.searchParams.set("v", normalizedVersion);
    }
    return `${proxyUrl.pathname}${proxyUrl.search}`;
};
const buildWorkspaceProjectLocalPlaybackUrl = (projectId, version) => {
    const normalizedProjectId = normalizeText(projectId);
    if (!normalizedProjectId)
        return null;
    const proxyUrl = new URL(`/api/workspace/projects/${encodeURIComponent(normalizedProjectId)}/playback`, env.appUrl);
    const normalizedVersion = normalizeText(version);
    if (normalizedVersion) {
        proxyUrl.searchParams.set("v", normalizedVersion);
    }
    return `${proxyUrl.pathname}${proxyUrl.search}`;
};
const buildWorkspaceProjectPlaybackTargets = ({ projectId, downloadPath, jobId, version, }) => {
    const localPlaybackUrl = buildWorkspaceProjectLocalPlaybackUrl(projectId, version);
    const jobVideoUrl = buildWorkspaceJobVideoProxyUrl(jobId, version);
    const directVideoUrl = buildWorkspaceProjectVideoProxyUrl(downloadPath, version);
    const videoFallbackUrl = directVideoUrl ?? jobVideoUrl;
    return {
        videoFallbackUrl,
        videoUrl: videoFallbackUrl ? localPlaybackUrl ?? videoFallbackUrl : null,
    };
};
const assertAdsflowConfigured = () => {
    if (!env.adsflowApiBaseUrl || !env.adsflowAdminToken) {
        throw new Error("AdsFlow API is not configured.");
    }
};
const getAdsflowBaseUrl = () => {
    assertAdsflowConfigured();
    return env.adsflowApiBaseUrl;
};
const fetchAdsflowJson = async (url, init) => {
    const response = await fetch(url, init);
    const payload = (await response.json().catch(() => null));
    if (!response.ok) {
        const detail = extractErrorDetail(payload) ?? `AdsFlow request failed (${response.status}).`;
        throw new Error(detail);
    }
    if (!payload) {
        throw new Error("AdsFlow returned an empty response.");
    }
    return payload;
};
const postAdsflowText = async (path, body) => {
    const response = await fetch(new URL(path, getAdsflowBaseUrl()), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    const payload = await response.text();
    if (!response.ok) {
        throw new Error(extractErrorDetail(payload) ?? `AdsFlow request failed (${response.status}).`);
    }
    if (!payload) {
        throw new Error("AdsFlow returned an empty response.");
    }
    return payload;
};
const postAdsflowJson = async (path, body) => {
    return fetchAdsflowJson(new URL(path, getAdsflowBaseUrl()), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
};
const resolvePreferredExternalUserId = async (user) => {
    try {
        return (await resolveExternalUserIdentity(user)).preferred;
    }
    catch {
        return buildExternalUserId(user);
    }
};
const fetchBootstrapPayload = async (user, externalUserId) => {
    const resolvedExternalUserId = externalUserId ?? (await resolvePreferredExternalUserId(user));
    const payloadText = await postAdsflowText("/api/web/bootstrap", {
        admin_token: env.adsflowAdminToken,
        external_user_id: resolvedExternalUserId,
        language: "ru",
        referral_source: "landing_site",
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
    });
    const payload = parseJson(payloadText);
    const remoteUserId = extractBootstrapUserId(payloadText);
    if (!payload || typeof payload !== "object") {
        throw new Error("AdsFlow returned an invalid bootstrap response.");
    }
    if (!remoteUserId || !/^\d+$/.test(remoteUserId)) {
        throw new Error("AdsFlow did not return web user profile.");
    }
    return {
        latest_generation: "latest_generation" in payload ? payload.latest_generation : null,
        remoteUserId,
    };
};
const getWorkspaceProjectFetchLimit = (deletedProjectsCount) => Math.max(MAX_PROJECTS, Math.min(MAX_PROJECTS + Math.max(0, Math.trunc(deletedProjectsCount || 0)), MAX_PROJECT_FETCH_LIMIT));
const fetchAdminVideos = async (userId, limit = MAX_PROJECTS) => {
    const requestedLimit = Math.max(1, Math.min(Math.trunc(limit || MAX_PROJECTS), MAX_PROJECT_FETCH_LIMIT));
    const items = [];
    let page = 1;
    while (items.length < requestedLimit) {
        const pageSize = Math.min(ADSFLOW_ADMIN_VIDEOS_MAX_PAGE_SIZE, requestedLimit - items.length);
        const url = new URL("/api/admin/videos", getAdsflowBaseUrl());
        url.searchParams.set("user_id", userId);
        url.searchParams.set("page", String(page));
        url.searchParams.set("page_size", String(pageSize));
        const payload = await fetchAdsflowJson(url, {
            headers: {
                "X-Admin-Token": env.adsflowAdminToken ?? "",
            },
        });
        const batch = payload.items ?? [];
        if (batch.length === 0) {
            break;
        }
        items.push(...batch);
        if (batch.length < pageSize) {
            break;
        }
        page += 1;
    }
    return items.slice(0, requestedLimit);
};
const buildProjectFromAdminVideo = (item, historyEntry) => {
    const adId = Number(item.id ?? 0);
    if (!Number.isFinite(adId) || adId <= 0)
        return null;
    const prompt = normalizePrompt(item.description ?? "");
    const createdAt = toIsoString(item.created_at) ?? new Date().toISOString();
    const historyJobId = normalizeText(historyEntry?.jobId);
    const historyUpdatedAt = toIsoString(historyEntry?.updatedAt);
    const updatedAt = historyUpdatedAt ?? createdAt;
    const status = normalizeProjectStatus(item.status);
    const playbackTargets = buildWorkspaceProjectPlaybackTargets({
        projectId: `project:${adId}`,
        downloadPath: item.download_path,
        jobId: historyJobId || null,
        version: updatedAt,
    });
    const description = normalizeText(item.description) || prompt || "Описание проекта недоступно.";
    const videoUrl = status === "ready" ? playbackTargets.videoUrl : null;
    const videoFallbackUrl = status === "ready" ? playbackTargets.videoFallbackUrl : null;
    const youtubePublication = normalizeText(item.youtube_publish_state) ||
        normalizeText(item.youtube_published_link) ||
        normalizeText(item.youtube_video_id) ||
        normalizeText(item.youtube_published_at) ||
        normalizeText(item.youtube_scheduled_at) ||
        normalizeText(item.youtube_channel_name)
        ? {
            channelName: normalizeText(item.youtube_channel_name) || null,
            link: normalizeText(item.youtube_published_link) || null,
            publishedAt: toIsoString(item.youtube_published_at),
            scheduledAt: toIsoString(item.youtube_scheduled_at),
            state: normalizeText(item.youtube_publish_state).toLowerCase() || null,
            youtubeVideoId: normalizeText(item.youtube_video_id) || null,
        }
        : null;
    return {
        adId,
        createdAt,
        description,
        generatedAt: createdAt,
        hashtags: [],
        id: `project:${adId}`,
        jobId: historyJobId || null,
        prompt,
        source: "project",
        status,
        title: normalizeText(item.ai_title) || buildPromptTitle(prompt, `Проект #${adId}`),
        updatedAt,
        posterUrl: status === "ready" && videoUrl ? buildWorkspaceProjectPosterUrl(`project:${adId}`, updatedAt) : null,
        videoFallbackUrl,
        videoUrl,
        youtubePublication,
    };
};
const buildProjectFromLatestGeneration = (item) => {
    if (!isAdsflowLatestVideoGenerationTask(item.task_type)) {
        return null;
    }
    const jobId = normalizeText(item.job_id);
    if (!jobId)
        return null;
    const prompt = normalizePrompt(item.prompt ?? "");
    const generatedAt = toIsoString(item.generated_at);
    const createdAt = generatedAt ?? new Date().toISOString();
    const adId = item.ad_id && Number.isFinite(Number(item.ad_id)) ? Number(item.ad_id) : null;
    const status = normalizeProjectStatus(item.status);
    if (status !== "ready") {
        return null;
    }
    const playbackTargets = buildWorkspaceProjectPlaybackTargets({
        projectId: `task:${jobId}`,
        downloadPath: item.download_path,
        jobId,
        version: generatedAt ?? createdAt,
    });
    if (!playbackTargets.videoUrl) {
        return null;
    }
    const title = resolveWorkspaceTaskTitle({
        adId,
        prompt,
        title: item.title,
    });
    const description = normalizeText(item.description) || prompt || "Описание проекта появится после завершения генерации.";
    return {
        adId,
        createdAt,
        description,
        generatedAt,
        hashtags: parseHashtags(item.hashtags),
        id: `task:${jobId}`,
        jobId,
        prompt,
        source: "task",
        status,
        title,
        updatedAt: generatedAt ?? createdAt,
        posterUrl: playbackTargets.videoUrl ? buildWorkspaceProjectPosterUrl(`task:${jobId}`, generatedAt ?? createdAt) : null,
        videoFallbackUrl: playbackTargets.videoFallbackUrl,
        videoUrl: playbackTargets.videoUrl,
        youtubePublication: null,
    };
};
const buildProjectFromHistoryEntry = (item) => {
    const jobId = normalizeText(item.jobId);
    if (!jobId)
        return null;
    const prompt = normalizePrompt(item.prompt ?? "");
    const generatedAt = toIsoString(item.generatedAt);
    const createdAt = toIsoString(item.createdAt) ?? generatedAt ?? new Date().toISOString();
    const updatedAt = toIsoString(item.updatedAt) ?? generatedAt ?? createdAt;
    const adId = item.adId && Number.isFinite(Number(item.adId)) ? Number(item.adId) : null;
    const status = normalizeProjectStatus(item.status);
    if (status !== "ready") {
        return null;
    }
    const playbackTargets = buildWorkspaceProjectPlaybackTargets({
        projectId: `task:${jobId}`,
        downloadPath: item.downloadPath,
        jobId,
        version: updatedAt,
    });
    if (!playbackTargets.videoUrl) {
        return null;
    }
    const title = resolveWorkspaceTaskTitle({
        adId,
        prompt,
        title: item.title,
    });
    const description = normalizeText(item.description) ||
        prompt ||
        "Описание проекта появится после завершения генерации.";
    return {
        adId,
        createdAt,
        description,
        generatedAt,
        hashtags: [],
        id: `task:${jobId}`,
        jobId,
        prompt,
        source: "task",
        status,
        title,
        updatedAt,
        posterUrl: playbackTargets.videoUrl ? buildWorkspaceProjectPosterUrl(`task:${jobId}`, updatedAt) : null,
        videoFallbackUrl: playbackTargets.videoFallbackUrl,
        videoUrl: playbackTargets.videoUrl,
        youtubePublication: null,
    };
};
const getSortTime = (value) => {
    const timestamp = Date.parse(value.updatedAt || value.createdAt);
    return Number.isNaN(timestamp) ? 0 : timestamp;
};
const resolveWorkspaceProjectHistoryVideoTarget = async (jobId, user) => {
    const normalizedJobId = normalizeText(jobId);
    if (!normalizedJobId) {
        return null;
    }
    const historyEntries = await listWorkspaceGenerationHistory(user, MAX_PROJECT_FETCH_LIMIT).catch((error) => {
        console.error("[workspace] Failed to load workspace history for project poster", error);
        return [];
    });
    const historyEntry = historyEntries.find((entry) => normalizeText(entry.jobId) === normalizedJobId) ?? null;
    const downloadPath = normalizeText(historyEntry?.downloadPath);
    return downloadPath ? getWorkspaceProjectVideoProxyTarget(downloadPath) : null;
};
const resolveWorkspaceProjectUpstreamTargetFromVideoUrl = async (playbackUrl, user) => {
    const normalizedPlaybackUrl = normalizeText(playbackUrl);
    if (!normalizedPlaybackUrl) {
        return null;
    }
    let resolvedUrl;
    try {
        resolvedUrl = new URL(normalizedPlaybackUrl, env.appUrl);
    }
    catch {
        return null;
    }
    if (resolvedUrl.pathname === "/api/workspace/project-video" || resolvedUrl.pathname === "/api/studio/video") {
        const path = normalizeText(resolvedUrl.searchParams.get("path"));
        return path ? getWorkspaceProjectVideoProxyTarget(path) : null;
    }
    if (resolvedUrl.pathname.startsWith("/api/studio/video/")) {
        const jobId = decodeURIComponent(resolvedUrl.pathname.slice("/api/studio/video/".length));
        return resolveWorkspaceProjectHistoryVideoTarget(jobId, user);
    }
    if (resolvedUrl.protocol === "http:" || resolvedUrl.protocol === "https:") {
        return resolvedUrl;
    }
    return null;
};
const getWorkspaceProjectPlaybackSource = async (project, user) => {
    if (project.status !== "ready" || !project.videoUrl) {
        return null;
    }
    const upstreamUrl = await resolveWorkspaceProjectUpstreamTargetFromVideoUrl(project.videoFallbackUrl ?? project.videoUrl, user);
    if (!upstreamUrl) {
        return null;
    }
    return {
        cacheKey: getWorkspaceProjectPlaybackCacheKey({
            projectId: project.id,
            targetUrl: upstreamUrl,
            updatedAt: project.updatedAt || project.createdAt,
        }),
        projectId: project.id,
        upstreamUrl,
    };
};
const getWorkspaceProjectPosterSource = async (project, user) => {
    if (project.status !== "ready" || !project.videoUrl || !project.posterUrl) {
        return null;
    }
    for (const candidateUrl of [project.videoFallbackUrl, project.videoUrl]) {
        const upstreamUrl = await resolveWorkspaceProjectUpstreamTargetFromVideoUrl(candidateUrl, user);
        if (!upstreamUrl) {
            continue;
        }
        return {
            cacheKey: getWorkspaceProjectPosterCacheKey({
                projectId: project.id,
                targetUrl: upstreamUrl,
                updatedAt: project.updatedAt || project.createdAt,
            }),
            projectId: project.id,
            upstreamUrl,
        };
    }
    return null;
};
const warmWorkspaceProjectPlaybacks = (projects, user) => {
    for (const project of projects) {
        if (!project.videoUrl || project.status !== "ready") {
            continue;
        }
        void getWorkspaceProjectPlaybackSource(project, user)
            .then((playbackSource) => {
            if (!playbackSource) {
                return;
            }
            return warmWorkspaceProjectPlayback(playbackSource);
        })
            .catch((error) => {
            console.error("[workspace] Failed to warm project playback cache", {
                error: error instanceof Error ? error.message : "Unknown project playback warmup error.",
                projectId: project.id,
            });
        });
    }
};
const warmWorkspaceProjectPosters = (projects, user) => {
    for (const project of projects) {
        if (!project.posterUrl || !project.videoUrl || project.status !== "ready") {
            continue;
        }
        void getWorkspaceProjectPosterSource(project, user)
            .then((posterSource) => {
            if (!posterSource) {
                return;
            }
            return warmWorkspaceProjectPoster(posterSource);
        })
            .catch((error) => {
            console.error("[workspace] Failed to warm project poster", {
                error: error instanceof Error ? error.message : "Unknown project poster warmup error.",
                projectId: project.id,
            });
        });
    }
};
const getWorkspaceHistoryEntrySortTime = (entry) => {
    const timestamp = Date.parse(entry.updatedAt || entry.generatedAt || entry.createdAt);
    return Number.isNaN(timestamp) ? 0 : timestamp;
};
const isWorkspaceProjectDeleted = (project, deletedProjects) => deletedProjects.some((deletedProject) => {
    if (deletedProject.projectId && deletedProject.projectId === project.id) {
        return true;
    }
    if (deletedProject.adId !== null && project.adId !== null && deletedProject.adId === project.adId) {
        return true;
    }
    if (deletedProject.jobId && project.jobId && deletedProject.jobId === project.jobId) {
        return true;
    }
    return false;
});
const loadWorkspaceProjects = async (user, externalUserId) => {
    const [bootstrapPayload, deletedProjects] = await Promise.all([
        fetchBootstrapPayload(user, externalUserId),
        listWorkspaceDeletedProjects(user).catch((error) => {
            console.error("[workspace] Failed to load deleted workspace projects", error);
            return [];
        }),
    ]);
    const fetchLimit = getWorkspaceProjectFetchLimit(deletedProjects.length);
    const historyEntriesPromise = listWorkspaceGenerationHistory(user, fetchLimit).catch((error) => {
        console.error("[workspace] Failed to load local workspace history", error);
        return [];
    });
    const adminVideosPromise = bootstrapPayload.remoteUserId
        ? fetchAdminVideos(bootstrapPayload.remoteUserId, fetchLimit)
            .then((items) => ({
            items,
            isFallback: false,
        }))
            .catch((error) => {
            console.warn("[workspace] Failed to load admin videos from AdsFlow, using local fallbacks only", {
                error: error instanceof Error ? error.message : "Unknown AdsFlow admin videos error.",
                fetchLimit,
                remoteUserId: bootstrapPayload.remoteUserId,
            });
            return {
                items: [],
                isFallback: true,
            };
        })
        : Promise.resolve({
            items: [],
            isFallback: true,
        });
    const [historyEntries, adminVideosResult] = await Promise.all([historyEntriesPromise, adminVideosPromise]);
    const adminVideos = adminVideosResult.items;
    const shouldUseLocalFallbackProjects = adminVideosResult.isFallback || adminVideos.length === 0;
    const projects = new Map();
    const historyEntriesByAdId = new Map();
    for (const entry of historyEntries) {
        const adId = entry.adId && Number.isFinite(Number(entry.adId)) ? Number(entry.adId) : null;
        if (adId === null) {
            continue;
        }
        const currentEntry = historyEntriesByAdId.get(adId);
        if (!currentEntry || getWorkspaceHistoryEntrySortTime(entry) > getWorkspaceHistoryEntrySortTime(currentEntry)) {
            historyEntriesByAdId.set(adId, entry);
        }
    }
    if (adminVideos.length > 0) {
        for (const item of adminVideos) {
            const adId = Number(item.id ?? 0);
            const historyEntry = Number.isFinite(adId) && adId > 0 ? historyEntriesByAdId.get(adId) ?? null : null;
            const project = buildProjectFromAdminVideo(item, historyEntry);
            if (!project)
                continue;
            projects.set(project.id, project);
        }
    }
    if (shouldUseLocalFallbackProjects) {
        for (const item of historyEntries) {
            const project = buildProjectFromHistoryEntry(item);
            if (!project)
                continue;
            const duplicateByAdId = project.adId !== null &&
                Array.from(projects.values()).some((existingProject) => existingProject.adId !== null && existingProject.adId === project.adId);
            if (!duplicateByAdId && !projects.has(project.id)) {
                projects.set(project.id, project);
            }
        }
    }
    if (shouldUseLocalFallbackProjects && bootstrapPayload.latest_generation) {
        const latestProject = buildProjectFromLatestGeneration(bootstrapPayload.latest_generation);
        if (latestProject) {
            const duplicateByAdId = latestProject.adId !== null &&
                Array.from(projects.values()).some((project) => project.adId !== null && project.adId === latestProject.adId);
            if (!duplicateByAdId && !projects.has(latestProject.id)) {
                projects.set(latestProject.id, latestProject);
            }
        }
    }
    return Array.from(projects.values())
        .filter((project) => !isWorkspaceProjectDeleted(project, deletedProjects))
        .sort((left, right) => getSortTime(right) - getSortTime(left))
        .slice(0, MAX_PROJECTS);
};
export function getWorkspaceProjectVideoProxyTarget(value) {
    const normalized = normalizeText(value);
    if (!normalized) {
        throw new Error("Project video path is missing.");
    }
    const upstreamUrl = new URL(normalized, getAdsflowBaseUrl());
    const adsflowBaseUrl = new URL(getAdsflowBaseUrl());
    if (!isPlayableWorkspaceVideoPath(normalized)) {
        throw new Error("Project video path is not a direct media file.");
    }
    if (upstreamUrl.origin === adsflowBaseUrl.origin) {
        upstreamUrl.searchParams.set("admin_token", env.adsflowAdminToken ?? "");
    }
    return upstreamUrl;
}
export async function invalidateWorkspaceProjectsCache(user) {
    const cacheKey = await resolvePreferredExternalUserId(user);
    workspaceProjectsCache.delete(cacheKey);
    workspaceProjectsInFlight.delete(cacheKey);
}
export async function getWorkspaceProjects(user) {
    const cacheKey = await resolvePreferredExternalUserId(user);
    const cachedEntry = workspaceProjectsCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
        const projects = cloneWorkspaceProjects(cachedEntry.projects);
        warmWorkspaceProjectPlaybacks(projects, user);
        warmWorkspaceProjectPosters(projects, user);
        return projects;
    }
    const inFlightRequest = workspaceProjectsInFlight.get(cacheKey);
    if (inFlightRequest) {
        return cloneWorkspaceProjects(await inFlightRequest);
    }
    const request = loadWorkspaceProjects(user, cacheKey)
        .then((projects) => {
        workspaceProjectsCache.set(cacheKey, {
            expiresAt: Date.now() + PROJECTS_CACHE_TTL_MS,
            projects: cloneWorkspaceProjects(projects),
        });
        warmWorkspaceProjectPlaybacks(projects, user);
        warmWorkspaceProjectPosters(projects, user);
        return projects;
    })
        .finally(() => {
        workspaceProjectsInFlight.delete(cacheKey);
    });
    workspaceProjectsInFlight.set(cacheKey, request);
    return cloneWorkspaceProjects(await request);
}
export async function getWorkspaceProjectPlaybackAsset(user, projectId) {
    const normalizedProjectId = normalizeText(projectId);
    if (!normalizedProjectId) {
        throw new WorkspaceProjectNotFoundError();
    }
    const projects = await getWorkspaceProjects(user);
    const project = projects.find((item) => item.id === normalizedProjectId) ?? null;
    if (!project) {
        throw new WorkspaceProjectNotFoundError();
    }
    const playbackSource = await getWorkspaceProjectPlaybackSource(project, user);
    if (!playbackSource) {
        throw new Error("Project playback source is unavailable.");
    }
    return ensureWorkspaceProjectPlayback(playbackSource);
}
export async function getWorkspaceProjectPosterPath(user, projectId) {
    const normalizedProjectId = normalizeText(projectId);
    if (!normalizedProjectId) {
        throw new WorkspaceProjectNotFoundError();
    }
    const projects = await getWorkspaceProjects(user);
    const project = projects.find((item) => item.id === normalizedProjectId) ?? null;
    if (!project) {
        throw new WorkspaceProjectNotFoundError();
    }
    const posterSource = await getWorkspaceProjectPosterSource(project, user);
    if (!posterSource) {
        throw new Error("Project poster source is unavailable.");
    }
    return ensureWorkspaceProjectPoster(posterSource);
}
export async function deleteWorkspaceProject(user, projectId) {
    const normalizedProjectId = normalizeText(projectId);
    if (!normalizedProjectId) {
        throw new WorkspaceProjectNotFoundError();
    }
    const projects = await getWorkspaceProjects(user);
    const project = projects.find((item) => item.id === normalizedProjectId) ?? null;
    if (!project) {
        throw new WorkspaceProjectNotFoundError();
    }
    await markWorkspaceProjectDeleted(user, {
        adId: project.adId,
        jobId: project.jobId,
        projectId: project.id,
    });
    await invalidateWorkspaceProjectsCache(user);
}
