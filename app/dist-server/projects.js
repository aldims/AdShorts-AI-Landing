import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
import { listWorkspaceGenerationHistory } from "./workspace-history.js";
const MAX_PROJECTS = 60;
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
const extractErrorDetail = (value) => {
    const payload = parseJson(value);
    if (!payload || typeof payload !== "object") {
        const normalized = normalizeText(value);
        return normalized && !normalized.startsWith("<") ? normalized : null;
    }
    const detail = payload.detail;
    if (typeof detail === "string" && detail.trim()) {
        return detail.trim();
    }
    const error = payload.error;
    if (typeof error === "string" && error.trim()) {
        return error.trim();
    }
    return null;
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
        return pathname.includes("/api/video/download/") || /\.(mp4|mov|webm|m4v)$/i.test(pathname);
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
        const detail = payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
            ? payload.detail
            : `AdsFlow request failed (${response.status}).`;
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
const fetchAdminVideos = async (userId) => {
    const url = new URL("/api/admin/videos", getAdsflowBaseUrl());
    url.searchParams.set("user_id", userId);
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", String(MAX_PROJECTS));
    const payload = await fetchAdsflowJson(url, {
        headers: {
            "X-Admin-Token": env.adsflowAdminToken ?? "",
        },
    });
    return payload.items ?? [];
};
const buildProjectFromAdminVideo = (item) => {
    const adId = Number(item.id ?? 0);
    if (!Number.isFinite(adId) || adId <= 0)
        return null;
    const prompt = normalizePrompt(item.description ?? "");
    const createdAt = toIsoString(item.created_at) ?? new Date().toISOString();
    const description = normalizeText(item.description) || prompt || "Описание проекта недоступно.";
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
        jobId: null,
        prompt,
        source: "project",
        status: normalizeProjectStatus(item.status),
        title: normalizeText(item.ai_title) || buildPromptTitle(prompt, `Проект #${adId}`),
        updatedAt: createdAt,
        videoUrl: buildWorkspaceProjectVideoProxyUrl(item.download_path, createdAt),
        youtubePublication,
    };
};
const buildProjectFromLatestGeneration = (item) => {
    const jobId = normalizeText(item.job_id);
    if (!jobId)
        return null;
    const prompt = normalizePrompt(item.prompt ?? "");
    const generatedAt = toIsoString(item.generated_at);
    const createdAt = generatedAt ?? new Date().toISOString();
    const adId = item.ad_id && Number.isFinite(Number(item.ad_id)) ? Number(item.ad_id) : null;
    const status = normalizeProjectStatus(item.status);
    const videoUrl = status === "ready" ? buildWorkspaceProjectVideoProxyUrl(item.download_path, generatedAt ?? createdAt) : null;
    if (status === "ready" && !videoUrl) {
        return null;
    }
    const title = normalizeText(item.title) || buildPromptTitle(prompt, adId ? `Проект #${adId}` : "Проект");
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
        videoUrl,
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
    const videoUrl = status === "ready" ? buildWorkspaceProjectVideoProxyUrl(item.downloadPath, updatedAt) : null;
    if (status === "ready" && !videoUrl) {
        return null;
    }
    const title = normalizeText(item.title) || buildPromptTitle(prompt, adId ? `Проект #${adId}` : "Проект");
    const description = normalizeText(item.description) ||
        prompt ||
        (status === "failed" ? "Генерация не завершилась успешно." : "Описание проекта появится после завершения генерации.");
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
        videoUrl,
        youtubePublication: null,
    };
};
const getSortTime = (value) => {
    const timestamp = Date.parse(value.updatedAt || value.createdAt);
    return Number.isNaN(timestamp) ? 0 : timestamp;
};
const loadWorkspaceProjects = async (user, externalUserId) => {
    const [bootstrapPayload, historyEntries] = await Promise.all([
        fetchBootstrapPayload(user, externalUserId),
        listWorkspaceGenerationHistory(user, MAX_PROJECTS).catch((error) => {
            console.error("[workspace] Failed to load local workspace history", error);
            return [];
        }),
    ]);
    const projects = new Map();
    if (bootstrapPayload.remoteUserId) {
        for (const item of await fetchAdminVideos(bootstrapPayload.remoteUserId)) {
            const project = buildProjectFromAdminVideo(item);
            if (!project)
                continue;
            projects.set(project.id, project);
        }
    }
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
    if (bootstrapPayload.latest_generation) {
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
        return cloneWorkspaceProjects(cachedEntry.projects);
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
        return projects;
    })
        .finally(() => {
        workspaceProjectsInFlight.delete(cacheKey);
    });
    workspaceProjectsInFlight.set(cacheKey, request);
    return cloneWorkspaceProjects(await request);
}
