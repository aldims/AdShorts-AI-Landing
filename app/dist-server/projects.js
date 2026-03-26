import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
const MAX_PROJECTS = 60;
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizePrompt = (value) => normalizeText(value);
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
const fetchBootstrapPayload = async (user) => {
    const externalUserId = await resolvePreferredExternalUserId(user);
    const payload = await postAdsflowJson("/api/web/bootstrap", {
        admin_token: env.adsflowAdminToken,
        external_user_id: externalUserId,
        language: "ru",
        referral_source: "landing_site",
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
    });
    if (!payload.user) {
        throw new Error("AdsFlow did not return web user profile.");
    }
    return payload;
};
const fetchAdminVideos = async (userId) => {
    const url = new URL("/api/admin/videos", getAdsflowBaseUrl());
    url.searchParams.set("user_id", String(userId));
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
        videoUrl: buildAbsoluteAdsflowUrl(item.download_path),
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
        status: normalizeProjectStatus(item.status),
        title,
        updatedAt: generatedAt ?? createdAt,
        videoUrl: normalizeProjectStatus(item.status) === "ready" ? buildAbsoluteAdsflowUrl(item.download_path) : null,
    };
};
const getSortTime = (value) => {
    const timestamp = Date.parse(value.updatedAt || value.createdAt);
    return Number.isNaN(timestamp) ? 0 : timestamp;
};
export async function getWorkspaceProjects(user) {
    const bootstrapPayload = await fetchBootstrapPayload(user);
    const remoteUserId = Number(bootstrapPayload.user?.user_id ?? 0);
    const projects = new Map();
    if (Number.isFinite(remoteUserId) && remoteUserId > 0) {
        for (const item of await fetchAdminVideos(remoteUserId)) {
            const project = buildProjectFromAdminVideo(item);
            if (!project)
                continue;
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
}
