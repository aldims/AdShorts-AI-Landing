import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
import { buildWorkspaceMediaAssetRef, mergeWorkspaceMediaAssetRefs, } from "./media-assets.js";
import { STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST, STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST, STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST, STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST, STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST, STUDIO_VIDEO_GENERATION_CREDIT_COST as STUDIO_GENERATION_CREDIT_COST, } from "../shared/studio-credit-costs.js";
import { normalizeExamplePrefillStudioSettings, } from "../shared/example-prefill.js";
import { ensureWorkspaceProjectPlayback, getWorkspaceProjectPlaybackCacheKey, warmWorkspaceProjectPlayback, } from "./project-playback.js";
import { ensureWorkspaceVideoPoster, getWorkspaceVideoPosterCacheKey, warmWorkspaceVideoPoster, } from "./project-posters.js";
import { getWorkspaceGenerationHistoryEntry, listWorkspaceGenerationHistory, saveWorkspaceGenerationHistory, } from "./workspace-history.js";
import { resolveGenerationPresentation } from "./generation-metadata.js";
import { postAdsflowText as postAdsflowTextWithPolicy, upstreamPolicies } from "./upstream-client.js";
const normalizeWorkspaceSubscriptionPlanCode = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "start" || normalized === "pro" || normalized === "ultra" ? normalized : null;
};
const getWorkspaceSubscriptionPlanDurationDays = (planCode) => planCode === "start" || planCode === "pro" || planCode === "ultra" ? 30 : 0;
export const resolveWorkspaceSubscriptionDetailsFromAdminPayload = (payload, options) => {
    const successfulPayments = Array.isArray(payload.payments)
        ? payload.payments.filter((payment) => String(payment?.status ?? "").trim().toLowerCase() === "succeeded")
        : [];
    const startPlanUsed = successfulPayments.some((payment) => String(payment?.plan_code ?? "").trim().toLowerCase() === "start");
    const directExpiry = normalizeGenerationText(payload.user?.subscription_expires_at) || null;
    if (directExpiry) {
        return {
            expiresAt: directExpiry,
            startPlanUsed,
        };
    }
    const currentPlan = normalizeWorkspaceSubscriptionPlanCode(payload.user?.subscription_type) ??
        normalizeWorkspaceSubscriptionPlanCode(options?.currentPlanHint);
    const candidatePayments = currentPlan
        ? successfulPayments.filter((payment) => normalizeWorkspaceSubscriptionPlanCode(payment?.plan_code) === currentPlan)
        : successfulPayments.filter((payment) => normalizeWorkspaceSubscriptionPlanCode(payment?.plan_code) !== null);
    const latestSuccessfulPayment = candidatePayments
        .map((payment) => {
        const paidAt = normalizeGenerationText(payment.paid_at);
        const parsedPaidAt = paidAt ? new Date(paidAt) : null;
        return Number.isNaN(parsedPaidAt?.getTime?.() ?? Number.NaN)
            ? null
            : {
                paidAt: parsedPaidAt,
                planCode: normalizeWorkspaceSubscriptionPlanCode(payment.plan_code),
            };
    })
        .filter((value) => value instanceof Object && value.paidAt instanceof Date)
        .sort((left, right) => right.paidAt.getTime() - left.paidAt.getTime())[0] ?? null;
    const effectivePlanCode = currentPlan ?? latestSuccessfulPayment?.planCode ?? null;
    const planDurationDays = getWorkspaceSubscriptionPlanDurationDays(effectivePlanCode);
    if (!planDurationDays || !latestSuccessfulPayment) {
        return {
            expiresAt: null,
            startPlanUsed,
        };
    }
    const derivedExpiry = new Date(latestSuccessfulPayment.paidAt.getTime());
    derivedExpiry.setUTCDate(derivedExpiry.getUTCDate() + planDurationDays);
    return {
        expiresAt: derivedExpiry.toISOString(),
        startPlanUsed,
    };
};
export class WorkspaceCreditLimitError extends Error {
    constructor(message = "На тарифе FREE доступна 1 бесплатная генерация. Обновите тариф, чтобы продолжить.") {
        super(message);
        this.name = "WorkspaceCreditLimitError";
    }
}
const studioSupportedMusicTypes = new Set([
    "ai",
    "business",
    "calm",
    "custom",
    "dramatic",
    "energetic",
    "fun",
    "inspirational",
    "luxury",
    "none",
    "tech",
    "upbeat",
]);
const studioSupportedSubtitleStyleIds = new Set([
    "modern",
    "impact",
    "story",
    "editorial",
    "cinema",
    "karaoke",
]);
const studioSupportedSubtitleColorIds = new Set([
    "purple",
    "yellow",
    "orange",
    "pink",
    "blue",
    "cyan",
    "green",
    "red",
    "gold",
    "white",
    "black",
]);
const studioSupportedVideoModes = new Set([
    "ai_photo",
    "ai_video",
    "custom",
    "standard",
]);
const studioSupportedPromptImproveModes = new Set([
    "ai_photo",
    "ai_video",
    "photo_animation",
    "image_edit",
]);
const studioSupportedSegmentVideoActions = new Set(["ai", "custom", "original"]);
const studioSupportedLanguages = new Set(["en", "ru"]);
const WORKSPACE_BOOTSTRAP_CACHE_TTL_MS = 5 * 60_000;
const WORKSPACE_SUBSCRIPTION_EXPIRY_CACHE_TTL_MS = 10 * 60_000;
const WORKSPACE_SUBSCRIPTION_EXPIRY_TIMEOUT_MS = 5_000;
const FALLBACK_WORKSPACE_SUBSCRIPTION_DETAILS = {
    expiresAt: null,
    startPlanUsed: false,
};
const WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS = 1;
const WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS = 8;
const STUDIO_GENERATION_PREPARING_PREVIEW_STATUS = "preparing_preview";
const workspaceBootstrapCache = new Map();
const workspaceSubscriptionExpiryCache = new Map();
const workspaceSubscriptionExpiryInFlight = new Map();
const OPENROUTER_STUDIO_PROMPT_TIMEOUT_MS = 30_000;
const OPENROUTER_STUDIO_PROMPT_HTTP_REFERER = "https://adshorts.ai";
const OPENROUTER_STUDIO_PROMPT_TITLE = "AdShorts Studio Prompt Enhancer";
const OPENROUTER_STUDIO_PROMPT_ENHANCEMENT_PRIMARY_MODEL = "google/gemini-3-flash-preview";
const STUDIO_OPENROUTER_MISSING_CONFIG_ERROR = "OpenRouter is not configured on this server. Set a valid OPENROUTER_API_KEY or ADSHORTS_SHARED_ENV_FILE.";
const normalizePrompt = (value) => value.replace(/\s+/g, " ").trim();
const hasUsableOpenRouterApiKey = (value) => {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
        return false;
    }
    const lowered = normalized.toLowerCase();
    if (lowered === "your_api_key" ||
        lowered === "your-openrouter-api-key" ||
        lowered === "openrouter_api_key" ||
        lowered === "changeme" ||
        lowered === "change-me" ||
        lowered === "replace_me" ||
        lowered === "replace-me" ||
        lowered.includes("your_api") ||
        lowered.includes("placeholder")) {
        return false;
    }
    return true;
};
const sanitizeStudioContentPlanIdeaPrompt = (value) => {
    const fallbackPrompt = normalizePrompt(String(value ?? ""));
    if (!fallbackPrompt) {
        return "";
    }
    let normalized = fallbackPrompt
        .replace(/^```[\w-]*\s*/i, "")
        .replace(/\s*```$/i, "")
        .replace(/^["'`]+|["'`]+$/g, "")
        .trim();
    const leadingInstructionPatterns = [
        /^(?:напиши|создай|сделай)\s+(?:мне\s+)?(?:сценарий\s+)?(?:для\s+)?(?:shorts|шортс)(?:\s+(?:ролика|видео))?\s*(?:[,:-]\s*)?(?:где\s+|про\s+|о\s+|об\s+|на\s+тему\s+)?/i,
        /^(?:создай|сделай)\s+(?:мне\s+)?(?:shorts|шортс|ролик|видео)(?:\s+(?:о|об|про|на\s+тему))?\s*(?:[,:-]\s*)?/i,
        /^write\s+(?:a\s+)?(?:shorts?\s+)?script(?:\s+for\s+(?:a\s+)?)?(?:shorts?\s+video)?\s*(?:[,:-]\s*)?(?:about\s+|on\s+|where\s+)?/i,
        /^(?:create|make)\s+(?:a\s+)?shorts?(?:\s+video)?\s*(?:[,:-]\s*)?(?:about\s+|on\s+)?/i,
    ];
    for (const pattern of leadingInstructionPatterns) {
        const nextValue = normalized.replace(pattern, "").trim();
        if (nextValue && nextValue !== normalized) {
            normalized = nextValue;
            break;
        }
    }
    normalized = normalized.replace(/^[\s,.:;-]+/, "").replace(/^["'`]+|["'`]+$/g, "").trim();
    return normalized || fallbackPrompt;
};
const normalizeGenerationText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeStudioMusicType = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return studioSupportedMusicTypes.has(normalized) ? normalized : "ai";
};
const normalizeStudioSubtitleStyle = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return studioSupportedSubtitleStyleIds.has(normalized) ? normalized : "modern";
};
const normalizeStudioSubtitleColor = (value, fallback = "purple") => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (studioSupportedSubtitleColorIds.has(normalized)) {
        return normalized;
    }
    const normalizedFallback = String(fallback ?? "").trim().toLowerCase();
    return studioSupportedSubtitleColorIds.has(normalizedFallback) ? normalizedFallback : "purple";
};
const getDefaultStudioSubtitleColorForStyle = (styleId) => fallbackWorkspaceStudioOptions.subtitleStyles.find((style) => style.id === styleId)?.defaultColorId ?? "purple";
const normalizeStudioVideoMode = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return studioSupportedVideoModes.has(normalized) ? normalized : "standard";
};
const normalizeStudioLanguage = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return studioSupportedLanguages.has(normalized) ? normalized : "ru";
};
const normalizePositiveInteger = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return null;
    const rounded = Math.trunc(numeric);
    return rounded > 0 ? rounded : null;
};
const normalizeNonNegativeInteger = (value) => {
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
const normalizeStudioSegmentVideoAction = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return studioSupportedSegmentVideoActions.has(normalized) ? normalized : "original";
};
const normalizeStudioSegmentEditorPayload = (value, fallbackProjectId) => {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    const record = value;
    const projectId = normalizePositiveInteger(record.projectId) ?? fallbackProjectId;
    const rawSegments = Array.isArray(record.segments) ? record.segments : [];
    if (!projectId || rawSegments.length === 0) {
        return undefined;
    }
    const segments = [];
    rawSegments.forEach((segment) => {
        if (!segment || typeof segment !== "object") {
            return;
        }
        const segmentRecord = segment;
        const index = normalizeNonNegativeInteger(segmentRecord.index);
        if (index === null) {
            return;
        }
        const videoAction = normalizeStudioSegmentVideoAction(segmentRecord.videoAction);
        const customVideoAssetId = normalizePositiveInteger(segmentRecord.customVideoAssetId) ?? undefined;
        const customVideoFileDataUrl = String(segmentRecord.customVideoFileDataUrl ?? "").trim() || undefined;
        const customVideoFileMimeType = String(segmentRecord.customVideoFileMimeType ?? "").trim() || undefined;
        const customVideoFileName = String(segmentRecord.customVideoFileName ?? "").trim() || undefined;
        const startTime = normalizeNumber(segmentRecord.startTime) ?? undefined;
        const endTime = normalizeNumber(segmentRecord.endTime) ?? undefined;
        const duration = normalizeNumber(segmentRecord.duration) ?? undefined;
        if (videoAction === "custom" && !customVideoAssetId && (!customVideoFileDataUrl || !customVideoFileName)) {
            throw new Error(`Upload a custom video for segment ${index + 1} or choose a different source.`);
        }
        segments.push({
            customVideoAssetId: videoAction === "custom" ? customVideoAssetId : undefined,
            customVideoFileDataUrl: videoAction === "custom" ? customVideoFileDataUrl : undefined,
            customVideoFileMimeType: videoAction === "custom" ? customVideoFileMimeType : undefined,
            customVideoFileName: videoAction === "custom" ? customVideoFileName : undefined,
            duration,
            endTime,
            index,
            resetVisual: Boolean(segmentRecord.resetVisual),
            startTime,
            text: normalizeGenerationText(String(segmentRecord.text ?? "")),
            videoAction,
        });
    });
    if (segments.length === 0) {
        return undefined;
    }
    if (segments.length < WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS) {
        throw new Error(`Segment editor requires at least ${WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS} segment.`);
    }
    if (segments.length > WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS) {
        throw new Error(`Segment editor supports up to ${WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS} segments.`);
    }
    return {
        projectId,
        segments,
    };
};
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
        const normalized = normalizeGenerationText(value);
        return normalized && !normalized.startsWith("<") ? normalized : null;
    }
    if (typeof payload.detail === "string" && payload.detail.trim()) {
        return payload.detail.trim();
    }
    if (typeof payload.error === "string" && payload.error.trim()) {
        return payload.error.trim();
    }
    return null;
};
const extractAdsflowUserId = (value) => {
    const exactUserMatch = value.match(/"user"\s*:\s*\{[\s\S]*?"user_id"\s*:\s*(\d+)/);
    if (exactUserMatch?.[1]) {
        return exactUserMatch[1].trim();
    }
    const fallbackMatch = value.match(/"user_id"\s*:\s*(\d+)/);
    return fallbackMatch?.[1]?.trim() || null;
};
const fallbackWorkspaceStudioOptions = {
    subtitleStyles: [
        {
            defaultColorId: "purple",
            description: "Текущий дефолт для Shorts на Manrope.",
            fontFamily: "Manrope",
            fontSize: 96,
            id: "modern",
            label: "Modern",
            logicMode: "block",
            marginBottom: 420,
            outlineWidth: 3,
            position: "bottom_center",
            transitionMode: "hard_cut",
            usesAccentColor: true,
            windowSize: 3,
            wordEffect: "none",
        },
        {
            defaultColorId: "yellow",
            description: "Агрессивный viral-стиль с тяжелым контуром и плотной посадкой.",
            fontFamily: "Manrope",
            fontSize: 108,
            id: "impact",
            label: "Impact",
            logicMode: "block",
            marginBottom: 300,
            outlineWidth: 4,
            position: "bottom_center",
            transitionMode: "hard_cut",
            usesAccentColor: true,
            windowSize: 3,
            wordEffect: "scale",
        },
        {
            defaultColorId: "pink",
            description: "Мягкий social/UGC стиль с более легкой анимацией.",
            fontFamily: "Manrope",
            fontSize: 84,
            id: "story",
            label: "Story",
            logicMode: "block",
            marginBottom: 360,
            outlineWidth: 2,
            position: "bottom_center",
            transitionMode: "slide_up",
            usesAccentColor: true,
            windowSize: 4,
            wordEffect: "slide",
        },
        {
            defaultColorId: "blue",
            description: "Спокойный explanatory-пресет с большим количеством воздуха.",
            fontFamily: "DejaVu Sans",
            fontSize: 72,
            id: "editorial",
            label: "Editorial",
            logicMode: "sliding",
            marginBottom: 240,
            outlineWidth: 2,
            position: "bottom_center",
            transitionMode: "soft_fade",
            usesAccentColor: true,
            windowSize: 6,
            wordEffect: "fade",
        },
        {
            defaultColorId: "white",
            description: "Чистый lower-third с мягким crossfade без цветового акцента.",
            fontFamily: "DejaVu Sans",
            fontSize: 68,
            id: "cinema",
            label: "Cinema",
            logicMode: "crossfade",
            marginBottom: 190,
            outlineWidth: 1,
            position: "bottom_center",
            transitionMode: "soft_crossfade",
            usesAccentColor: false,
            windowSize: 7,
            wordEffect: "none",
        },
        {
            defaultColorId: "orange",
            description: "Фразовый caption с явной подсветкой активного слова.",
            fontFamily: "Manrope",
            fontSize: 86,
            id: "karaoke",
            label: "Karaoke",
            logicMode: "phrase",
            marginBottom: 235,
            outlineWidth: 3,
            position: "bottom_center",
            transitionMode: "karaoke_follow",
            usesAccentColor: true,
            windowSize: 8,
            wordEffect: "fade",
        },
    ],
    subtitleColors: [
        { hex: "8B5CF6", id: "purple", label: "Фиолетовый" },
        { hex: "EAB308", id: "yellow", label: "Желтый" },
        { hex: "F97316", id: "orange", label: "Оранжевый" },
        { hex: "EC4899", id: "pink", label: "Розовый" },
        { hex: "3B82F6", id: "blue", label: "Синий" },
        { hex: "06B6D4", id: "cyan", label: "Голубой" },
        { hex: "10B981", id: "green", label: "Зеленый" },
        { hex: "EF4444", id: "red", label: "Красный" },
        { hex: "FFD700", id: "gold", label: "Золотой" },
        { hex: "FFFFFF", id: "white", label: "Белый" },
        { hex: "000000", id: "black", label: "Черный" },
    ],
};
const cloneStudioGeneration = (generation) => ({
    ...generation,
    finalAsset: generation.finalAsset ? { ...generation.finalAsset } : null,
    hashtags: [...generation.hashtags],
});
const cloneStudioGenerationStatus = (status) => ({
    ...status,
    generation: status.generation ? cloneStudioGeneration(status.generation) : undefined,
});
const cloneWorkspaceBootstrap = (bootstrap) => ({
    latestGeneration: bootstrap.latestGeneration ? cloneStudioGenerationStatus(bootstrap.latestGeneration) : null,
    profile: { ...bootstrap.profile },
    studioOptions: {
        subtitleColors: bootstrap.studioOptions.subtitleColors.map((color) => ({ ...color })),
        subtitleStyles: bootstrap.studioOptions.subtitleStyles.map((style) => ({ ...style })),
    },
});
const getCachedWorkspaceBootstrap = (cacheKey) => {
    const cachedEntry = workspaceBootstrapCache.get(cacheKey);
    if (!cachedEntry) {
        return null;
    }
    if (cachedEntry.expiresAt <= Date.now()) {
        workspaceBootstrapCache.delete(cacheKey);
        return null;
    }
    return cloneWorkspaceBootstrap(cachedEntry.bootstrap);
};
const setCachedWorkspaceBootstrap = (cacheKey, bootstrap) => {
    workspaceBootstrapCache.set(cacheKey, {
        bootstrap: cloneWorkspaceBootstrap(bootstrap),
        expiresAt: Date.now() + WORKSPACE_BOOTSTRAP_CACHE_TTL_MS,
    });
};
const getWorkspaceSubscriptionExpiryCacheKey = (userId) => {
    const normalizedUserId = String(userId ?? "").trim();
    return /^\d+$/.test(normalizedUserId) ? normalizedUserId : null;
};
const getCachedWorkspaceSubscriptionExpiry = (userId) => {
    const cacheKey = getWorkspaceSubscriptionExpiryCacheKey(userId);
    if (!cacheKey) {
        return undefined;
    }
    const cachedEntry = workspaceSubscriptionExpiryCache.get(cacheKey);
    if (!cachedEntry) {
        return undefined;
    }
    if (cachedEntry.expiresAt <= Date.now()) {
        workspaceSubscriptionExpiryCache.delete(cacheKey);
        return undefined;
    }
    return cachedEntry.value;
};
const setCachedWorkspaceSubscriptionExpiry = (userId, value) => {
    const cacheKey = getWorkspaceSubscriptionExpiryCacheKey(userId);
    if (!cacheKey) {
        return;
    }
    workspaceSubscriptionExpiryCache.set(cacheKey, {
        expiresAt: Date.now() + WORKSPACE_SUBSCRIPTION_EXPIRY_CACHE_TTL_MS,
        value,
    });
};
const assertAdsflowConfigured = () => {
    if (!env.adsflowApiBaseUrl || !env.adsflowAdminToken) {
        throw new Error("AdsFlow API is not configured.");
    }
};
const resolveStudioExternalUserId = async (user) => {
    try {
        return (await resolveExternalUserIdentity(user)).preferred;
    }
    catch {
        return buildExternalUserId(user);
    }
};
export async function invalidateWorkspaceBootstrapCache(user) {
    const externalUserId = await resolveStudioExternalUserId(user);
    workspaceBootstrapCache.delete(externalUserId);
}
const buildAdsflowUrl = (path, params) => {
    const url = new URL(path, env.adsflowApiBaseUrl);
    Object.entries(params ?? {}).forEach(([key, value]) => {
        if (value)
            url.searchParams.set(key, value);
    });
    return url;
};
const isPlayableStudioVideoPath = (value) => {
    const normalized = normalizeGenerationText(value);
    if (!normalized)
        return false;
    try {
        const resolvedUrl = buildAdsflowUrl(normalized);
        const hostname = resolvedUrl.hostname.toLowerCase();
        const pathname = resolvedUrl.pathname.toLowerCase();
        if (hostname === "youtu.be" || hostname.endsWith(".youtube.com") || hostname === "youtube.com") {
            return false;
        }
        return (pathname.includes("/api/video/download/") ||
            /\/api\/media\/\d+\/download(?:\/)?$/i.test(pathname) ||
            pathname.includes("/api/web/video/") ||
            /\.(mp4|mov|webm|m4v)$/i.test(pathname));
    }
    catch {
        return false;
    }
};
const buildTrustedStudioVideoTarget = (value) => {
    const normalized = normalizeGenerationText(value);
    if (!normalized) {
        throw new Error("Video path is required.");
    }
    const upstreamUrl = buildAdsflowUrl(normalized);
    const hostname = upstreamUrl.hostname.toLowerCase();
    if (hostname === "youtu.be" || hostname.endsWith(".youtube.com") || hostname === "youtube.com") {
        throw new Error("Video path is not a direct media file.");
    }
    const adsflowBaseUrl = new URL(env.adsflowApiBaseUrl);
    if (upstreamUrl.origin === adsflowBaseUrl.origin) {
        upstreamUrl.searchParams.set("admin_token", env.adsflowAdminToken ?? "");
    }
    return upstreamUrl;
};
const buildStudioVideoProxyUrl = (value) => {
    const normalized = normalizeGenerationText(value);
    if (!normalized) {
        return null;
    }
    if (!isPlayableStudioVideoPath(normalized)) {
        return null;
    }
    const upstreamUrl = buildAdsflowUrl(normalized);
    const proxyUrl = new URL("/api/studio/video", env.appUrl);
    proxyUrl.searchParams.set("path", upstreamUrl.toString());
    return `${proxyUrl.pathname}${proxyUrl.search}`;
};
const buildStudioJobVideoProxyUrl = (jobId) => {
    const normalizedJobId = normalizeGenerationText(jobId);
    if (!normalizedJobId) {
        return null;
    }
    const proxyUrl = new URL(`/api/studio/video/${encodeURIComponent(normalizedJobId)}`, env.appUrl);
    return `${proxyUrl.pathname}${proxyUrl.search}`;
};
const buildStudioSegmentAiVideoJobVideoProxyUrl = (jobId) => {
    const normalizedJobId = normalizeGenerationText(jobId);
    if (!normalizedJobId) {
        return null;
    }
    const proxyUrl = new URL(`/api/studio/segment-ai-video/jobs/${encodeURIComponent(normalizedJobId)}/video`, env.appUrl);
    return `${proxyUrl.pathname}${proxyUrl.search}`;
};
const buildStudioSegmentAiVideoJobPosterProxyUrl = (jobId) => {
    const normalizedJobId = normalizeGenerationText(jobId);
    if (!normalizedJobId) {
        return null;
    }
    const proxyUrl = new URL(`/api/studio/segment-ai-video/jobs/${encodeURIComponent(normalizedJobId)}/poster`, env.appUrl);
    proxyUrl.searchParams.set("v", normalizedJobId);
    return `${proxyUrl.pathname}${proxyUrl.search}`;
};
const buildStudioSegmentPhotoAnimationJobVideoProxyUrl = (jobId) => {
    const normalizedJobId = normalizeGenerationText(jobId);
    if (!normalizedJobId) {
        return null;
    }
    const proxyUrl = new URL(`/api/studio/segment-photo-animation/jobs/${encodeURIComponent(normalizedJobId)}/video`, env.appUrl);
    return `${proxyUrl.pathname}${proxyUrl.search}`;
};
const buildStudioSegmentPhotoAnimationJobPosterProxyUrl = (jobId) => {
    const normalizedJobId = normalizeGenerationText(jobId);
    if (!normalizedJobId) {
        return null;
    }
    const proxyUrl = new URL(`/api/studio/segment-photo-animation/jobs/${encodeURIComponent(normalizedJobId)}/poster`, env.appUrl);
    proxyUrl.searchParams.set("v", normalizedJobId);
    return `${proxyUrl.pathname}${proxyUrl.search}`;
};
const buildStudioPlaybackUrl = (jobId, version) => {
    const normalizedJobId = normalizeGenerationText(jobId);
    if (!normalizedJobId) {
        return null;
    }
    const playbackUrl = new URL(`/api/studio/playback/${encodeURIComponent(normalizedJobId)}`, env.appUrl);
    const normalizedVersion = normalizeGenerationText(version);
    if (normalizedVersion) {
        playbackUrl.searchParams.set("v", normalizedVersion);
    }
    return `${playbackUrl.pathname}${playbackUrl.search}`;
};
const buildStudioGenerationVideoUrls = (options) => {
    const videoFallbackUrl = buildStudioVideoProxyUrl(options.downloadPath);
    const videoUrl = buildStudioPlaybackUrl(options.jobId, options.generatedAt);
    if (!videoFallbackUrl || !videoUrl) {
        return null;
    }
    return {
        videoFallbackUrl,
        videoUrl,
    };
};
const buildStudioFinalAsset = (options) => {
    const payloadAsset = buildWorkspaceMediaAssetRef({
        created_at: options.generatedAt ?? null,
        download_path: options.downloadPath ?? null,
        id: options.mediaAssetId ?? null,
        kind: options.kind ?? "final_video",
        media_type: "video",
        project_id: options.adId ?? null,
        role: "final_video",
        status: options.status ?? null,
    });
    const historyAsset = buildWorkspaceMediaAssetRef({
        created_at: options.historyEntry?.generatedAt ?? options.historyEntry?.updatedAt ?? options.historyEntry?.createdAt ?? null,
        download_path: options.historyEntry?.downloadPath ?? null,
        expires_at: options.historyEntry?.finalAssetExpiresAt ?? null,
        id: options.historyEntry?.finalAssetId ?? null,
        kind: options.historyEntry?.finalAssetKind ?? options.kind ?? "final_video",
        media_type: "video",
        project_id: options.adId ?? null,
        role: "final_video",
        status: options.historyEntry?.finalAssetStatus ?? options.status ?? null,
    });
    return mergeWorkspaceMediaAssetRefs(payloadAsset, historyAsset);
};
const normalizeWorkspaceBooleanFlag = (value) => {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return value !== 0;
    }
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) {
        return null;
    }
    if (["1", "true", "yes", "y", "on"].includes(normalized)) {
        return true;
    }
    if (["0", "false", "no", "n", "off"].includes(normalized)) {
        return false;
    }
    return null;
};
const extractAdsflowStartPlanUsed = (payload, plan) => {
    const explicitUsed = normalizeWorkspaceBooleanFlag(payload?.start_plan_used ?? payload?.startPlanUsed);
    if (explicitUsed !== null) {
        return explicitUsed;
    }
    const explicitAvailable = normalizeWorkspaceBooleanFlag(payload?.start_plan_available ?? payload?.startPlanAvailable);
    if (explicitAvailable !== null) {
        return !explicitAvailable;
    }
    return plan === "START";
};
const buildWorkspaceProfile = (payload) => {
    const plan = String(payload?.plan ?? "FREE").trim().toUpperCase() || "FREE";
    return {
        balance: Math.max(0, Number(payload?.balance ?? 0)),
        expiresAt: normalizeGenerationText(payload?.subscription_expires_at) || null,
        plan,
        startPlanUsed: extractAdsflowStartPlanUsed(payload, plan),
    };
};
const normalizeStudioGeneratedImageMimeType = (value, fallback = "image/png") => {
    const normalized = normalizeGenerationText(value).toLowerCase().split(";")[0]?.trim() ?? "";
    if (normalized.startsWith("image/")) {
        return normalized;
    }
    return fallback;
};
const normalizeStudioSegmentPromptImproveMode = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return studioSupportedPromptImproveModes.has(normalized) ? normalized : "ai_photo";
};
const getStudioGeneratedImageExtension = (mimeType) => {
    const normalized = normalizeStudioGeneratedImageMimeType(mimeType);
    if (normalized === "image/jpeg")
        return ".jpg";
    if (normalized === "image/webp")
        return ".webp";
    if (normalized === "image/avif")
        return ".avif";
    if (normalized === "image/gif")
        return ".gif";
    return ".png";
};
const extractMimeTypeFromDataUrl = (value) => {
    const match = /^data:(?<mime>[^;,]+);base64,/i.exec(value.trim());
    return normalizeStudioGeneratedImageMimeType(match?.groups?.mime ?? "");
};
const decodeDataUrlBytes = (value) => {
    const match = /^data:(?<mime>[^;,]+);base64,(?<data>.+)$/i.exec(value.trim());
    if (!match?.groups?.data) {
        throw new Error("Generated image data URL is invalid.");
    }
    return {
        bytes: Buffer.from(match.groups.data, "base64"),
        mimeType: extractMimeTypeFromDataUrl(value),
    };
};
const buildDataUrlFromBytes = (bytes, mimeType) => `data:${normalizeStudioGeneratedImageMimeType(mimeType)};base64,${bytes.toString("base64")}`;
const decodeBinaryDataUrl = (value) => {
    const match = /^data:(?<mime>[^;,]+)?;base64,(?<data>.+)$/i.exec(String(value ?? "").trim());
    if (!match?.groups?.data) {
        throw new Error("Uploaded file data URL is invalid.");
    }
    return {
        bytes: Buffer.from(match.groups.data, "base64"),
        mimeType: String(match.groups.mime ?? "").trim(),
    };
};
const inferStudioUploadMediaType = (mimeType, fileName) => {
    const normalizedMimeType = normalizeGenerationText(mimeType).toLowerCase();
    if (normalizedMimeType.startsWith("audio/")) {
        return "audio";
    }
    if (normalizedMimeType.startsWith("image/")) {
        return "photo";
    }
    if (normalizedMimeType.startsWith("video/")) {
        return "video";
    }
    const target = normalizeGenerationText(fileName).toLowerCase();
    if (/\.(aac|m4a|mp3|wav)$/i.test(target))
        return "audio";
    if (/\.(avif|gif|jpe?g|png|webp)$/i.test(target))
        return "photo";
    if (/\.(m4v|mov|mp4|mpeg|webm)$/i.test(target))
        return "video";
    return "binary";
};
const inferStudioGeneratedImageMimeType = (mimeType, fileName, urlValue) => {
    const normalizedMimeType = normalizeStudioGeneratedImageMimeType(mimeType, "");
    if (normalizedMimeType) {
        return normalizedMimeType;
    }
    const normalizedFileName = normalizeGenerationText(fileName).toLowerCase();
    const normalizedUrlValue = normalizeGenerationText(urlValue).toLowerCase();
    const pathname = normalizedUrlValue
        ? (() => {
            try {
                return new URL(normalizedUrlValue).pathname.toLowerCase();
            }
            catch {
                return normalizedUrlValue.split(/[?#]/u, 1)[0] ?? normalizedUrlValue;
            }
        })()
        : "";
    const candidates = [normalizedFileName, pathname];
    if (candidates.some((candidate) => candidate.endsWith(".jpg") || candidate.endsWith(".jpeg")))
        return "image/jpeg";
    if (candidates.some((candidate) => candidate.endsWith(".webp")))
        return "image/webp";
    if (candidates.some((candidate) => candidate.endsWith(".avif")))
        return "image/avif";
    if (candidates.some((candidate) => candidate.endsWith(".gif")))
        return "image/gif";
    return "image/png";
};
const normalizeStudioGeneratedImageFileName = (fileName, mimeType) => {
    const normalized = String(fileName ?? "").trim().split(/[\\/]/).pop() ?? "";
    if (normalized) {
        const targetExtension = getStudioGeneratedImageExtension(mimeType);
        const currentExtensionMatch = normalized.match(/(\.[^.]+)$/u);
        const currentExtension = currentExtensionMatch?.[1]?.toLowerCase() ?? "";
        if (!currentExtension) {
            return `${normalized}${targetExtension}`;
        }
        if (currentExtension === ".jpeg" && targetExtension === ".jpg") {
            return normalized;
        }
        if (currentExtension === targetExtension) {
            return normalized;
        }
        return `${normalized.slice(0, -currentExtension.length)}${targetExtension}`;
    }
    return `segment-ai-photo${getStudioGeneratedImageExtension(mimeType)}`;
};
const buildStudioUpscaledImageFileName = (fileName, mimeType, options) => {
    const normalized = String(fileName ?? "").trim().split(/[\\/]/).pop() ?? "";
    const extension = getStudioGeneratedImageExtension(mimeType);
    const fallbackBaseName = typeof options?.segmentIndex === "number" && options.segmentIndex >= 0
        ? `segment-${options.segmentIndex + 1}`
        : "segment-image";
    const baseName = (normalized ? normalized.replace(/\.[^.]+$/u, "") : fallbackBaseName).trim() || fallbackBaseName;
    return `${baseName}-upscaled${extension}`;
};
const resolveAdsflowAssetUrl = (value) => {
    const normalized = normalizeGenerationText(value);
    if (!normalized) {
        return null;
    }
    if (/^https?:\/\//i.test(normalized)) {
        return new URL(normalized);
    }
    if (normalized.startsWith("/")) {
        return buildAdsflowUrl(normalized);
    }
    return null;
};
const DEAPI_IMAGE_API_URL = "https://api.deapi.ai/api/v1/client/txt2img";
const DEAPI_IMAGE_STATUS_URL = "https://api.deapi.ai/api/v1/client/request-status";
const DEAPI_IMAGE_MODEL_SLUG = "ZImageTurbo_INT8";
const DEAPI_IMAGE_WIDTH = 768;
const DEAPI_IMAGE_HEIGHT = 1280;
const DEAPI_IMAGE_STEPS = 8;
const DEAPI_IMAGE_TIMEOUT_MS = 120_000;
const DEAPI_IMAGE_POLL_INITIAL_MS = 1_000;
const DEAPI_IMAGE_POLL_MAX_MS = 2_500;
const DEAPI_NO_TEXT_POSITIVE_CLAUSE = "no text, no letters, no words, no captions, no subtitles, no logos, no watermark, no signature, no signage";
const DEAPI_PERSON_APPEARANCE_CLAUSE = "European appearance, Caucasian ethnicity";
const DEAPI_NO_TEXT_NEGATIVE_PROMPT = "text, letters, words, numbers, writing, caption, subtitle, typography, font, watermark, signature, logo, inscription, label, stamp, banner, headline, title, sign, signage, road sign, poster, magazine cover, newspaper, book page, ui, interface, chat bubble, speech bubble, handwriting, hieroglyphs, kanji, chinese, japanese, korean, cyrillic, latin characters, alphabet, symbols";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sanitizeStudioSegmentPromptEnhancementOutput = (value) => String(value ?? "")
    .replace(/^```[\w-]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^prompt\s*:\s*/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
const buildStudioSegmentPromptEnhancementFallback = (value, language, mode) => {
    const normalizedPrompt = normalizePrompt(value).replace(/[.!?]+$/g, "");
    if (!normalizedPrompt) {
        return "";
    }
    const descriptors = language === "en"
        ? mode === "ai_video"
            ? [
                "cinematic vertical 9:16 video",
                "natural subject motion",
                "clear focal action",
                "subtle camera movement",
                "realistic detail",
            ]
            : mode === "photo_animation"
                ? [
                    "image-to-video animation from a single source photo",
                    "natural motion",
                    "gentle camera push-in or parallax",
                    "preserve subject identity and setting",
                    "realistic detail",
                ]
                : mode === "image_edit"
                    ? [
                        "seamless image edit or outpaint",
                        "preserve the original subject and composition",
                        "matching lighting and perspective",
                        "clean realistic detail",
                    ]
                    : [
                        "cinematic vertical 9:16 composition",
                        "photorealistic",
                        "dramatic lighting",
                        "clear focal subject",
                        "high detail",
                    ]
        : mode === "ai_video"
            ? [
                "кинематографичное вертикальное видео 9:16",
                "естественное движение объекта",
                "четкое главное действие",
                "мягкое движение камеры",
                "реалистичная детализация",
            ]
            : mode === "photo_animation"
                ? [
                    "i2v анимация из одного исходного фото",
                    "естественное движение",
                    "легкий наезд камеры или параллакс",
                    "сохранить героя и окружение",
                    "реалистичная детализация",
                ]
                : mode === "image_edit"
                    ? [
                        "аккуратная дорисовка или редактирование фото",
                        "сохранить исходного героя и композицию",
                        "совпадающий свет и перспектива",
                        "чистая реалистичная детализация",
                    ]
                    : [
                        "кинематографичная вертикальная композиция 9:16",
                        "фотореализм",
                        "драматичный свет",
                        "четкий главный объект",
                        "высокая детализация",
                    ];
    return [normalizedPrompt.charAt(0).toUpperCase() + normalizedPrompt.slice(1), ...descriptors].join(", ");
};
const buildStudioSegmentPromptEnhancementSystemPrompt = (language, mode) => {
    if (language === "en") {
        switch (mode) {
            case "ai_video":
                return [
                    "You are an expert prompt engineer for text-to-video generation.",
                    "Rewrite the user's rough description into one strong production-ready prompt for a short vertical 9:16 video.",
                    "Return exactly one prompt in English with no quotes, labels, markdown, or explanations.",
                    "Describe the visible scene, subject, action, environment, camera framing, camera movement, motion, lighting, and mood.",
                    "Prefer one continuous cinematic shot with believable motion and a clear focal action.",
                    "Avoid dialogue, voiceover, sound effects, editing instructions, cuts, multi-shot sequences, captions, subtitles, logos, watermarks, and UI.",
                    "Keep it compact and clear: one sentence or a tight comma-separated phrase, under 360 characters.",
                ].join(" ");
            case "photo_animation":
                return [
                    "You are an expert prompt engineer for image-to-video generation.",
                    "Rewrite the user's rough description into one strong production-ready prompt for animating a single source photo into a short vertical 9:16 video.",
                    "Return exactly one prompt in English with no quotes, labels, markdown, or explanations.",
                    "Base the result on the existing photo: preserve identity, outfit, location, framing, and composition unless the user explicitly asks to change them.",
                    "Focus on motion directions only: subject movement, facial expression, hair or clothing movement, environmental motion, depth, parallax, and subtle camera movement.",
                    "Avoid new unrelated objects, scene changes, hard cuts, impossible transformations, captions, subtitles, logos, watermarks, and UI.",
                    "Keep it compact and clear: one sentence or a tight comma-separated phrase, under 360 characters.",
                ].join(" ");
            case "image_edit":
                return [
                    "You are an expert prompt engineer for AI image editing and outpainting.",
                    "Rewrite the user's rough edit request into one strong production-ready prompt for editing an existing vertical 9:16 image.",
                    "Return exactly one prompt in English with no quotes, labels, markdown, or explanations.",
                    "Describe the final visible result only: what should be added, extended, replaced, or refined in the existing image.",
                    "Preserve the original subject identity, style, lighting, perspective, and composition unless the user explicitly asks to change them.",
                    "Avoid mentioning masks, tools, UI, processing steps, captions, subtitles, logos, or watermarks.",
                    "Keep it compact and clear: one sentence or a tight comma-separated phrase, under 340 characters.",
                ].join(" ");
            case "ai_photo":
            default:
                return [
                    "You are an expert prompt engineer for AI image generation.",
                    "Rewrite the user's rough scene description into one strong production-ready prompt for a vertical 9:16 image.",
                    "Return exactly one prompt in English with no quotes, labels, markdown, or explanations.",
                    "Focus only on visible details: subject, action, setting, composition, camera framing, lighting, mood, textures, and product visibility when relevant.",
                    "Prefer cinematic, realistic, premium-looking imagery unless the user explicitly asks for fantasy, stylization, or surrealism.",
                    "Keep it compact and clear: one sentence or a tight comma-separated phrase, under 320 characters.",
                    "Do not mention captions, subtitles, logos, watermarks, UI, split screens, or multiple unrelated scenes.",
                ].join(" ");
        }
    }
    switch (mode) {
        case "ai_video":
            return [
                "Ты эксперт по созданию промтов для text-to-video генерации.",
                "Преобразуй черновое описание пользователя в один сильный готовый промт для короткого вертикального видео 9:16.",
                "Верни ровно один промт на русском языке без кавычек, меток, markdown и пояснений.",
                "Описывай видимую сцену: героя, действие, окружение, композицию, ракурс, движение камеры, движение объектов, свет и атмосферу.",
                "По умолчанию делай сцену как один цельный кинематографичный шот с понятным главным действием и правдоподобным движением.",
                "Не добавляй реплики, озвучку, звуки, монтажные команды, смены сцен, титры, текст на экране, логотипы, водяные знаки и интерфейсы.",
                "Промт должен быть компактным и ясным: одно предложение или плотная фраза до 360 символов.",
            ].join(" ");
        case "photo_animation":
            return [
                "Ты эксперт по созданию промтов для image-to-video анимации фото.",
                "Преобразуй черновое описание пользователя в один сильный готовый промт для анимации одного исходного фото в короткое вертикальное видео 9:16.",
                "Верни ровно один промт на русском языке без кавычек, меток, markdown и пояснений.",
                "Опирайся на исходное фото: сохраняй личность героя, одежду, локацию, ракурс и композицию, если пользователь явно не просит изменить их.",
                "Фокусируйся именно на движении: жесты, мимика, ветер в волосах или одежде, движение фона, глубина, параллакс и мягкое движение камеры.",
                "Не добавляй новые несвязанные объекты, смены сцен, резкие трансформации, титры, текст на экране, логотипы, водяные знаки и интерфейсы.",
                "Промт должен быть компактным и ясным: одно предложение или плотная фраза до 360 символов.",
            ].join(" ");
        case "image_edit":
            return [
                "Ты эксперт по созданию промтов для редактирования и дорисовки изображений.",
                "Преобразуй черновой запрос пользователя в один сильный готовый промт для редактирования существующего вертикального изображения 9:16.",
                "Верни ровно один промт на русском языке без кавычек, меток, markdown и пояснений.",
                "Описывай только итоговый видимый результат: что нужно добавить, расширить, заменить или уточнить в исходном изображении.",
                "По умолчанию сохраняй исходного героя, стиль, свет, перспективу и композицию, если пользователь явно не просит другого.",
                "Не упоминай маски, инструменты, интерфейсы, шаги обработки, титры, текст на экране, логотипы и водяные знаки.",
                "Промт должен быть компактным и ясным: одно предложение или плотная фраза до 340 символов.",
            ].join(" ");
        case "ai_photo":
        default:
            return [
                "Ты эксперт по созданию промтов для генерации изображений.",
                "Преобразуй черновое описание пользователя в один сильный готовый промт для вертикального изображения 9:16.",
                "Верни ровно один промт на русском языке без кавычек, меток, markdown и пояснений.",
                "Описывай только видимые детали: главный объект, действие, окружение, композицию, ракурс, свет, атмосферу, фактуры и продукт, если он важен.",
                "По умолчанию делай сцену кинематографичной, реалистичной и визуально дорогой, если пользователь явно не просит фантазию или стилизацию.",
                "Промт должен быть компактным и ясным: одно предложение или плотная фраза до 320 символов.",
                "Не упоминай титры, текст на экране, логотипы, водяные знаки, интерфейсы, коллажи и несколько несвязанных сцен.",
            ].join(" ");
    }
};
const buildStudioSegmentPromptEnhancementUserPrompt = (prompt, language, mode) => {
    const label = language === "en"
        ? mode === "ai_video"
            ? "Raw video scene description:"
            : mode === "photo_animation"
                ? "Raw photo animation instruction:"
                : mode === "image_edit"
                    ? "Raw image edit request:"
                    : "Raw scene description:"
        : mode === "ai_video"
            ? "Черновое описание видео-сцены:"
            : mode === "photo_animation"
                ? "Черновое описание анимации фото:"
                : mode === "image_edit"
                    ? "Черновой запрос на дорисовку фото:"
                    : "Черновое описание сцены:";
    const returnInstruction = language === "en" ? "Return only the final prompt." : "Верни только итоговый промт.";
    return [label, prompt, "", returnInstruction].join("\n");
};
const extractOpenRouterChatCompletionText = (payload) => {
    const message = payload?.choices?.[0]?.message;
    if (!message) {
        return "";
    }
    if (typeof message.content === "string") {
        return message.content;
    }
    if (!Array.isArray(message.content)) {
        return "";
    }
    return message.content
        .map((part) => (part?.type === "text" || !part?.type ? String(part?.text ?? "") : ""))
        .join(" ")
        .trim();
};
const extractOpenRouterErrorMessage = (payload) => {
    if (typeof payload?.error === "string") {
        return payload.error.trim();
    }
    return String(payload?.error?.message ?? "").trim();
};
const getStudioLanguageLabel = (language) => (language === "en" ? "English" : "Russian");
const STUDIO_CONTENT_PLAN_IDEA_COUNT_MIN = 3;
const STUDIO_CONTENT_PLAN_IDEA_COUNT_MAX = 30;
const STUDIO_CONTENT_PLAN_IDEA_COUNT_DEFAULT = 10;
const normalizeStudioContentPlanIdeaCount = (value) => {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed)) {
        return STUDIO_CONTENT_PLAN_IDEA_COUNT_DEFAULT;
    }
    return Math.max(STUDIO_CONTENT_PLAN_IDEA_COUNT_MIN, Math.min(STUDIO_CONTENT_PLAN_IDEA_COUNT_MAX, parsed));
};
const sanitizeStudioTranslationResponseText = (value) => value
    .replace(/^```[\w-]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
const parseStudioContentPlanResponse = (value, expectedCount) => {
    const normalizedValue = sanitizeStudioTranslationResponseText(value);
    const jsonCandidate = normalizedValue.startsWith("{")
        ? normalizedValue
        : normalizedValue.slice(Math.max(0, normalizedValue.indexOf("{")), normalizedValue.lastIndexOf("}") >= 0 ? normalizedValue.lastIndexOf("}") + 1 : normalizedValue.length);
    const parsed = JSON.parse(jsonCandidate);
    const ideas = Array.isArray(parsed?.ideas) ? parsed.ideas : null;
    if (!ideas || ideas.length !== expectedCount) {
        throw new Error("OpenRouter returned an invalid content plan payload.");
    }
    return ideas.map((idea, index) => {
        const record = idea && typeof idea === "object" ? idea : null;
        const title = normalizePrompt(String(record?.title ?? ""));
        const summary = normalizePrompt(String(record?.summary ?? ""));
        const prompt = sanitizeStudioContentPlanIdeaPrompt(record?.prompt);
        if (!title || !summary || !prompt) {
            throw new Error(`OpenRouter returned an invalid content plan idea at position ${index + 1}.`);
        }
        return {
            prompt,
            summary,
            title,
        };
    });
};
const parseStudioTextTranslationResponse = (value, expectedCount) => {
    const normalizedValue = sanitizeStudioTranslationResponseText(value);
    const jsonCandidate = normalizedValue.startsWith("{")
        ? normalizedValue
        : normalizedValue.slice(Math.max(0, normalizedValue.indexOf("{")), normalizedValue.lastIndexOf("}") >= 0 ? normalizedValue.lastIndexOf("}") + 1 : normalizedValue.length);
    const parsed = JSON.parse(jsonCandidate);
    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : null;
    if (!items || items.length !== expectedCount) {
        throw new Error("OpenRouter returned an invalid translation payload.");
    }
    return items.map((item) => String(item ?? ""));
};
const buildStudioTextTranslationSystemPrompt = (sourceLanguage, targetLanguage) => [
    "You are a precise translator for short-form video scripts and subtitle lines.",
    `Translate each item from ${getStudioLanguageLabel(sourceLanguage)} to ${getStudioLanguageLabel(targetLanguage)}.`,
    "Return strict JSON only in the format {\"items\":[\"...\"]}.",
    "Keep the same item count and order.",
    "Preserve meaning, CTA intent, brand names, numbers, and concise short-video rhythm.",
    "Do not add explanations, notes, markdown, or extra keys.",
    "If an item is empty, return an empty string for that item.",
].join(" ");
const buildStudioTextTranslationUserPrompt = (texts) => JSON.stringify({
    items: texts,
}, null, 2);
const buildStudioContentPlanSystemPrompt = (language, count, hasExistingIdeas) => language === "en"
    ? [
        "You are a senior strategist for viral short-form vertical videos.",
        `Generate exactly ${count} distinct Shorts ideas for the user's topic.`,
        "Return strict JSON only in the format {\"ideas\":[{\"title\":\"...\",\"summary\":\"...\",\"prompt\":\"...\"}]} with no markdown or extra keys.",
        "Write every field in English.",
        "Each title must be short and scannable.",
        "Each summary must be one concise sentence explaining the hook or angle.",
        "Each prompt must be only the raw idea or angle ready for the generator field, not an instruction to the model.",
        "Do not start prompt with verbs like write, create, make or phrases like 'Write a Shorts script about'.",
        "Keep the ideas concrete, varied, non-repetitive, and useful for real content production.",
        hasExistingIdeas ? "Do not repeat, rephrase, or lightly remix the existing ideas already provided by the user." : "",
        "Do not number the ideas, do not add explanations, and do not wrap the JSON in code fences.",
    ].join(" ")
    : [
        "Ты senior-стратег по viral short-form вертикальным видео.",
        `Сгенерируй ровно ${count} разных идей для Shorts по теме пользователя.`,
        "Верни только строгий JSON в формате {\"ideas\":[{\"title\":\"...\",\"summary\":\"...\",\"prompt\":\"...\"}]} без markdown и без лишних ключей.",
        "Пиши все поля на русском языке.",
        "Каждый title должен быть коротким и удобным для быстрого просмотра.",
        "Каждый summary должен быть одним коротким предложением с углом подачи или хуком.",
        "Каждый prompt должен быть не командой модели, а чистой формулировкой идеи или угла подачи для поля генерации.",
        "Не начинай prompt со слов 'напиши', 'создай', 'сделай', 'write', 'create', 'make' и не пиши фразы вроде 'Напиши сценарий Shorts о...'.",
        "Идеи должны быть конкретными, разнообразными, без повторов и пригодными для реального контент-плана.",
        hasExistingIdeas ? "Не повторяй, не перефразируй и не делай слегка изменённые версии уже существующих идей пользователя." : "",
        "Не нумеруй идеи, не добавляй пояснения и не оборачивай JSON в code fences.",
    ].join(" ");
const buildStudioContentPlanUserPrompt = (query, language, count, existingIdeas = []) => JSON.stringify(language === "en"
    ? {
        avoid_ideas: existingIdeas.length > 0
            ? existingIdeas.slice(0, 24).map((idea) => ({
                prompt: idea.prompt,
                title: idea.title,
            }))
            : undefined,
        count,
        topic: query,
        task: `Generate ${count} Shorts ideas for this topic. In prompt, store only the raw idea or angle without imperative wording.`,
    }
    : {
        avoid_ideas: existingIdeas.length > 0
            ? existingIdeas.slice(0, 24).map((idea) => ({
                prompt: idea.prompt,
                title: idea.title,
            }))
            : undefined,
        count,
        task: `Сгенерируй ${count} идей для Shorts по этой теме. В поле prompt сохрани только саму идею или угол подачи без командной формы.`,
        topic: query,
    }, null, 2);
const detectStudioPromptLanguage = (prompt, fallbackLanguage) => {
    if (/[А-Яа-яЁё]/.test(prompt)) {
        return "ru";
    }
    if (/[A-Za-z]/.test(prompt)) {
        return "en";
    }
    return normalizeStudioLanguage(fallbackLanguage);
};
const getStudioOpenRouterModelCandidates = () => Array.from(new Set([env.openrouterMainModel, env.openrouterFallbackModel]
    .map((model) => normalizePrompt(model ?? ""))
    .filter(Boolean)));
const getStudioOpenRouterPromptEnhancementModelCandidates = () => Array.from(new Set([
    OPENROUTER_STUDIO_PROMPT_ENHANCEMENT_PRIMARY_MODEL,
    env.openrouterMainModel,
    env.openrouterFallbackModel,
]
    .map((model) => normalizePrompt(model ?? ""))
    .filter(Boolean)));
const createStudioOpenRouterMissingConfigError = () => new Error(STUDIO_OPENROUTER_MISSING_CONFIG_ERROR);
const requireStudioOpenRouterModels = () => {
    const modelCandidates = getStudioOpenRouterModelCandidates();
    if (!hasUsableOpenRouterApiKey(env.openrouterApiKey)) {
        throw createStudioOpenRouterMissingConfigError();
    }
    if (modelCandidates.length === 0) {
        throw new Error("OpenRouter is configured without any usable models.");
    }
    return modelCandidates;
};
const buildStudioVisualPromptEnglishTranslationSystemPrompt = (sourceLanguage) => [
    "You are an expert translator for AI image and AI video generation prompts.",
    `Translate the user's visual prompt from ${getStudioLanguageLabel(sourceLanguage)} to English.`,
    "Return exactly one English prompt with no quotes, markdown, labels, or explanations.",
    "Preserve the original intent, prompt structure, camera/style terms, pacing, and prompt-engineering phrasing when useful.",
    "Preserve brand names, product names, proper nouns, character names, shot types, aspect ratios, and technical keywords.",
    "Do not add unrelated details, safety notes, or extra explanation.",
].join(" ");
const buildStudioVisualPromptEnglishTranslationUserPrompt = (prompt) => [`Visual generation prompt:`, prompt, "", `Return only the final English prompt.`].join("\n");
const sanitizeStudioVisualPromptEnglishTranslationOutput = (value) => sanitizeStudioTranslationResponseText(value).replace(/^["'`]+|["'`]+$/g, "").trim();
const requestStudioSegmentPromptEnhancement = async (prompt, language, mode, model) => {
    const response = await fetch(`${env.openrouterBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${env.openrouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": OPENROUTER_STUDIO_PROMPT_HTTP_REFERER,
            "X-Title": OPENROUTER_STUDIO_PROMPT_TITLE,
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "system",
                    content: buildStudioSegmentPromptEnhancementSystemPrompt(language, mode),
                },
                {
                    role: "user",
                    content: buildStudioSegmentPromptEnhancementUserPrompt(prompt, language, mode),
                },
            ],
            temperature: 0.35,
            max_tokens: 220,
        }),
        signal: AbortSignal.timeout(OPENROUTER_STUDIO_PROMPT_TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => null));
    if (!response.ok) {
        throw new Error(extractOpenRouterErrorMessage(payload) || `OpenRouter prompt enhancement failed (${response.status}).`);
    }
    const improvedPrompt = sanitizeStudioSegmentPromptEnhancementOutput(extractOpenRouterChatCompletionText(payload));
    if (!improvedPrompt) {
        throw new Error("OpenRouter returned an empty prompt.");
    }
    return improvedPrompt;
};
const requestStudioVisualPromptEnglishTranslation = async (prompt, sourceLanguage, model) => {
    const response = await fetch(`${env.openrouterBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${env.openrouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": OPENROUTER_STUDIO_PROMPT_HTTP_REFERER,
            "X-Title": OPENROUTER_STUDIO_PROMPT_TITLE,
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "system",
                    content: buildStudioVisualPromptEnglishTranslationSystemPrompt(sourceLanguage),
                },
                {
                    role: "user",
                    content: buildStudioVisualPromptEnglishTranslationUserPrompt(prompt),
                },
            ],
            temperature: 0.1,
            max_tokens: 260,
        }),
        signal: AbortSignal.timeout(OPENROUTER_STUDIO_PROMPT_TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => null));
    if (!response.ok) {
        throw new Error(extractOpenRouterErrorMessage(payload) || `OpenRouter visual prompt translation failed (${response.status}).`);
    }
    const translatedPrompt = sanitizeStudioVisualPromptEnglishTranslationOutput(extractOpenRouterChatCompletionText(payload));
    if (!translatedPrompt) {
        throw new Error("OpenRouter returned an empty translated prompt.");
    }
    return translatedPrompt;
};
const requestStudioTextTranslation = async (texts, sourceLanguage, targetLanguage, model) => {
    const response = await fetch(`${env.openrouterBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${env.openrouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": OPENROUTER_STUDIO_PROMPT_HTTP_REFERER,
            "X-Title": OPENROUTER_STUDIO_PROMPT_TITLE,
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "system",
                    content: buildStudioTextTranslationSystemPrompt(sourceLanguage, targetLanguage),
                },
                {
                    role: "user",
                    content: buildStudioTextTranslationUserPrompt(texts),
                },
            ],
            temperature: 0.1,
            max_tokens: Math.max(240, Math.min(1600, texts.length * 160)),
        }),
        signal: AbortSignal.timeout(OPENROUTER_STUDIO_PROMPT_TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => null));
    if (!response.ok) {
        throw new Error(extractOpenRouterErrorMessage(payload) || `OpenRouter translation failed (${response.status}).`);
    }
    return parseStudioTextTranslationResponse(extractOpenRouterChatCompletionText(payload), texts.length);
};
const requestStudioContentPlanIdeas = async (query, language, count, model, existingIdeas = []) => {
    const response = await fetch(`${env.openrouterBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${env.openrouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": OPENROUTER_STUDIO_PROMPT_HTTP_REFERER,
            "X-Title": OPENROUTER_STUDIO_PROMPT_TITLE,
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "system",
                    content: buildStudioContentPlanSystemPrompt(language, count, existingIdeas.length > 0),
                },
                {
                    role: "user",
                    content: buildStudioContentPlanUserPrompt(query, language, count, existingIdeas),
                },
            ],
            temperature: 0.8,
            max_tokens: Math.max(1200, Math.min(3200, 320 + count * 170)),
        }),
        signal: AbortSignal.timeout(OPENROUTER_STUDIO_PROMPT_TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => null));
    if (!response.ok) {
        throw new Error(extractOpenRouterErrorMessage(payload) || `OpenRouter content plan generation failed (${response.status}).`);
    }
    return parseStudioContentPlanResponse(extractOpenRouterChatCompletionText(payload), count);
};
const translateStudioGenerationPromptToEnglish = async (prompt, options) => {
    const normalizedPrompt = normalizePrompt(prompt);
    if (!normalizedPrompt) {
        return "";
    }
    const sourceLanguage = detectStudioPromptLanguage(normalizedPrompt, options?.sourceLanguage);
    if (sourceLanguage === "en") {
        return normalizedPrompt;
    }
    const modelCandidates = getStudioOpenRouterModelCandidates();
    let lastError = null;
    if (env.openrouterApiKey && modelCandidates.length > 0) {
        for (const model of modelCandidates) {
            try {
                return await requestStudioVisualPromptEnglishTranslation(normalizedPrompt, sourceLanguage, model);
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error("OpenRouter visual prompt translation failed.");
                console.warn(`[studio] Failed to translate visual prompt with ${model}`, lastError);
            }
        }
    }
    if (lastError) {
        console.warn("[studio] Falling back to original visual prompt because English translation is unavailable.");
    }
    return normalizedPrompt;
};
const sanitizeDirectStudioAiPhotoPrompt = (value) => {
    let cleaned = String(value ?? "").replace(/\r/g, " ").replace(/\n/g, " ");
    cleaned = cleaned.replace(/\s+/g, " ").trim().replace(/^["'`]+|["'`]+$/g, "").replace(/[,. ]+$/g, "");
    if (!cleaned) {
        return "";
    }
    if (!cleaned.toLowerCase().includes("european appearance")) {
        cleaned = `${cleaned}, ${DEAPI_PERSON_APPEARANCE_CLAUSE}`;
    }
    if (!cleaned.toLowerCase().includes("no text")) {
        cleaned = `${cleaned}, ${DEAPI_NO_TEXT_POSITIVE_CLAUSE}`;
    }
    return cleaned;
};
const parseStudioJsonPayload = async (response) => {
    return (await response.json().catch(() => null));
};
const extractDirectDeapiRequestId = (payload) => {
    const inner = payload && typeof payload.data === "object" && payload.data ? payload.data : payload;
    return ((inner && typeof inner.request_id === "string" ? inner.request_id : null) ||
        (payload && typeof payload.request_id === "string" ? payload.request_id : null) ||
        null);
};
const extractDirectDeapiImageUrl = (payload) => {
    const root = payload ?? {};
    const inner = typeof root.data === "object" && root.data ? root.data : root;
    const directUrl = (typeof inner.result_url === "string" && inner.result_url) ||
        (typeof inner.output_url === "string" && inner.output_url) ||
        (typeof inner.output === "string" && inner.output) ||
        (typeof inner.image_url === "string" && inner.image_url) ||
        (typeof inner.url === "string" && inner.url) ||
        (typeof root.result_url === "string" && root.result_url) ||
        (typeof root.output_url === "string" && root.output_url);
    if (directUrl) {
        return directUrl;
    }
    const outputs = Array.isArray(inner.outputs) ? inner.outputs : Array.isArray(root.outputs) ? root.outputs : [];
    const firstOutput = outputs[0];
    if (typeof firstOutput === "string" && firstOutput) {
        return firstOutput;
    }
    if (firstOutput &&
        typeof firstOutput === "object" &&
        "url" in firstOutput &&
        typeof firstOutput.url === "string") {
        return firstOutput.url;
    }
    return null;
};
const extractDirectDeapiError = (payload) => {
    const inner = payload && typeof payload.data === "object" && payload.data ? payload.data : payload;
    return ((inner && typeof inner.error === "string" ? inner.error : null) ||
        (payload && typeof payload.error === "string" ? payload.error : null) ||
        null);
};
const pollDirectDeapiImageUrl = async (requestId) => {
    const startedAt = Date.now();
    let delayMs = DEAPI_IMAGE_POLL_INITIAL_MS;
    while (Date.now() - startedAt < DEAPI_IMAGE_TIMEOUT_MS) {
        const response = await fetch(`${DEAPI_IMAGE_STATUS_URL}/${encodeURIComponent(requestId)}`, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${env.deapiApiKey}`,
            },
            signal: AbortSignal.timeout(15_000),
        });
        if (response.status === 429) {
            await sleep(Math.min(30_000, delayMs * 2));
            continue;
        }
        if (!response.ok) {
            await sleep(delayMs);
            delayMs = Math.min(DEAPI_IMAGE_POLL_MAX_MS, Math.round(delayMs * 1.2));
            continue;
        }
        const payload = await parseStudioJsonPayload(response);
        const inner = payload && typeof payload.data === "object" && payload.data ? payload.data : payload;
        const status = (inner && typeof inner.status === "string" ? inner.status : null) ||
            (payload && typeof payload.status === "string" ? payload.status : null) ||
            "";
        if (status === "completed" || status === "done") {
            return extractDirectDeapiImageUrl(payload);
        }
        if (status === "failed" || status === "error") {
            throw new Error(extractDirectDeapiError(payload) || "DEAPI image generation failed.");
        }
        await sleep(delayMs);
        delayMs = Math.min(DEAPI_IMAGE_POLL_MAX_MS, Math.round(delayMs * 1.2));
    }
    throw new Error("DEAPI image generation timed out.");
};
const generateDirectStudioSegmentAiPhoto = async (prompt, options) => {
    if (!env.deapiApiKey) {
        throw new Error("DEAPI image fallback is not configured.");
    }
    const sanitizedPrompt = sanitizeDirectStudioAiPhotoPrompt(prompt);
    if (!sanitizedPrompt) {
        throw new Error("Prompt is required.");
    }
    const createResponse = await fetch(DEAPI_IMAGE_API_URL, {
        body: JSON.stringify({
            prompt: sanitizedPrompt,
            negative_prompt: DEAPI_NO_TEXT_NEGATIVE_PROMPT,
            model: DEAPI_IMAGE_MODEL_SLUG,
            width: DEAPI_IMAGE_WIDTH,
            height: DEAPI_IMAGE_HEIGHT,
            seed: Math.max(1, Math.floor(Math.random() * 2_147_483_647)),
            steps: DEAPI_IMAGE_STEPS,
        }),
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${env.deapiApiKey}`,
            "Content-Type": "application/json",
        },
        method: "POST",
        signal: AbortSignal.timeout(30_000),
    });
    const createPayload = await parseStudioJsonPayload(createResponse);
    if (!createResponse.ok) {
        throw new Error(extractDirectDeapiError(createPayload) || `DEAPI image request failed (${createResponse.status}).`);
    }
    const directUrl = extractDirectDeapiImageUrl(createPayload);
    const requestId = extractDirectDeapiRequestId(createPayload);
    const imageUrl = directUrl || (requestId ? await pollDirectDeapiImageUrl(requestId) : null);
    if (!imageUrl) {
        throw new Error("DEAPI did not return an image URL.");
    }
    const downloadResponse = await fetch(imageUrl, {
        headers: {
            Accept: "image/*,application/octet-stream",
        },
        signal: AbortSignal.timeout(60_000),
    });
    if (!downloadResponse.ok) {
        throw new Error(`Failed to download generated image (${downloadResponse.status}).`);
    }
    const bytes = Buffer.from(await downloadResponse.arrayBuffer());
    if (!bytes.length) {
        throw new Error("Generated image is empty.");
    }
    const mimeType = inferStudioGeneratedImageMimeType(downloadResponse.headers.get("content-type"), null, imageUrl);
    return {
        dataUrl: buildDataUrlFromBytes(bytes, mimeType),
        fileName: `segment-ai-photo-${(options?.segmentIndex ?? 0) + 1}${getStudioGeneratedImageExtension(mimeType)}`,
        fileSize: bytes.length,
        mimeType,
    };
};
const fetchRemoteStudioGeneratedImage = async (url) => {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(ADSFLOW_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new Error(`Failed to download generated image (${response.status}).`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return {
        bytes: Buffer.from(arrayBuffer),
        mimeType: normalizeStudioGeneratedImageMimeType(response.headers.get("content-type")),
    };
};
const normalizeAdsflowSegmentAiPhotoAsset = async (payload) => {
    const inlineDataUrl = normalizeGenerationText(payload?.data_url);
    const remoteUrl = resolveAdsflowAssetUrl(payload?.remote_url ?? payload?.download_url ?? payload?.url);
    if (!inlineDataUrl && !remoteUrl) {
        throw new Error("AdsFlow did not return a generated image.");
    }
    let bytes;
    let mimeType;
    if (inlineDataUrl) {
        const decoded = decodeDataUrlBytes(inlineDataUrl);
        bytes = decoded.bytes;
        mimeType = inferStudioGeneratedImageMimeType(decoded.mimeType, payload?.file_name, payload?.remote_url ?? payload?.download_url ?? payload?.url);
    }
    else if (remoteUrl) {
        const downloaded = await fetchRemoteStudioGeneratedImage(remoteUrl);
        bytes = downloaded.bytes;
        mimeType = inferStudioGeneratedImageMimeType(downloaded.mimeType, payload?.file_name, remoteUrl.toString());
    }
    else {
        throw new Error("Generated image is unavailable.");
    }
    if (!bytes.length) {
        throw new Error("Generated image is empty.");
    }
    const fileName = normalizeStudioGeneratedImageFileName(payload?.file_name, mimeType);
    return {
        assetId: normalizePositiveInteger(payload?.media_asset_id) ?? null,
        dataUrl: inlineDataUrl || buildDataUrlFromBytes(bytes, mimeType),
        fileName,
        fileSize: Math.max(0, Number(payload?.file_size ?? bytes.length)),
        mimeType,
    };
};
const normalizeAdsflowSegmentAiVideoAsset = (jobId, payload) => {
    const remoteUrl = buildStudioSegmentAiVideoJobVideoProxyUrl(jobId);
    if (!remoteUrl) {
        throw new Error("Generated video is unavailable.");
    }
    return {
        assetId: normalizePositiveInteger(payload?.media_asset_id) ?? null,
        fileName: normalizeGenerationText(payload?.file_name) || `segment-ai-video-${jobId}.mp4`,
        fileSize: Math.max(0, Number(payload?.file_size ?? 0)),
        mimeType: normalizeGenerationText(payload?.mime_type) || "video/mp4",
        posterUrl: buildStudioSegmentAiVideoJobPosterProxyUrl(jobId),
        remoteUrl,
    };
};
const normalizeAdsflowSegmentPhotoAnimationAsset = (jobId, payload) => {
    const remoteUrl = buildStudioSegmentPhotoAnimationJobVideoProxyUrl(jobId);
    if (!remoteUrl) {
        throw new Error("Generated video is unavailable.");
    }
    return {
        assetId: normalizePositiveInteger(payload?.media_asset_id) ?? null,
        fileName: normalizeGenerationText(payload?.file_name) || `segment-photo-animation-${jobId}.mp4`,
        fileSize: Math.max(0, Number(payload?.file_size ?? 0)),
        mimeType: normalizeGenerationText(payload?.mime_type) || "video/mp4",
        posterUrl: null,
        remoteUrl,
    };
};
const buildWorkspaceStudioOptions = (payload) => {
    const subtitleStyles = Array.isArray(payload?.subtitle_styles)
        ? payload.subtitle_styles
            .map((style) => {
            const id = normalizeStudioSubtitleStyle(style?.id);
            return {
                defaultColorId: normalizeStudioSubtitleColor(style?.default_color, "purple"),
                description: normalizeGenerationText(style?.description) || "Subtitle style",
                fontFamily: normalizeGenerationText(style?.font_family) || "Manrope",
                fontSize: Math.max(32, Number(style?.font_size ?? 96) || 96),
                id,
                label: normalizeGenerationText(style?.label) || id,
                logicMode: normalizeGenerationText(style?.logic_mode) || "block",
                marginBottom: Math.max(0, Number(style?.margin_bottom ?? 240) || 240),
                outlineWidth: Math.max(0, Number(style?.outline_width ?? 2) || 2),
                position: normalizeGenerationText(style?.position) || "bottom_center",
                transitionMode: normalizeGenerationText(style?.transition_mode) || "hard_cut",
                usesAccentColor: Boolean(style?.uses_accent_color ?? true),
                windowSize: Math.max(1, Number(style?.window_size ?? 3) || 3),
                wordEffect: normalizeGenerationText(style?.word_effect) || "none",
            };
        })
            .filter((style, index, list) => list.findIndex((candidate) => candidate.id === style.id) === index)
        : [];
    const subtitleColors = Array.isArray(payload?.subtitle_colors)
        ? payload.subtitle_colors
            .map((color) => {
            const id = normalizeStudioSubtitleColor(color?.id);
            const hex = String(color?.hex ?? "").replace(/[^a-fA-F0-9]/g, "").slice(0, 6).toUpperCase();
            return {
                hex: hex.length === 6 ? hex : fallbackWorkspaceStudioOptions.subtitleColors.find((item) => item.id === id)?.hex ?? "8B5CF6",
                id,
                label: normalizeGenerationText(color?.label) || id,
            };
        })
            .filter((color, index, list) => list.findIndex((candidate) => candidate.id === color.id) === index)
        : [];
    return {
        subtitleStyles: subtitleStyles.length ? subtitleStyles : fallbackWorkspaceStudioOptions.subtitleStyles,
        subtitleColors: subtitleColors.length ? subtitleColors : fallbackWorkspaceStudioOptions.subtitleColors,
    };
};
const fetchAdsflowSubscriptionDetails = async (userId, options) => {
    const cacheKey = getWorkspaceSubscriptionExpiryCacheKey(userId);
    if (!cacheKey) {
        return FALLBACK_WORKSPACE_SUBSCRIPTION_DETAILS;
    }
    const cachedValue = getCachedWorkspaceSubscriptionExpiry(cacheKey);
    if (cachedValue !== undefined) {
        return cachedValue;
    }
    const inFlightRequest = workspaceSubscriptionExpiryInFlight.get(cacheKey);
    if (inFlightRequest) {
        return inFlightRequest;
    }
    const request = (async () => {
        let payload;
        try {
            payload = await fetchAdsflowJson(buildAdsflowUrl(`/api/admin/users/${encodeURIComponent(cacheKey)}`), {
                headers: {
                    "X-Admin-Token": env.adsflowAdminToken ?? "",
                },
            }, {
                retryDelaysMs: [],
                silentStatuses: [404],
                timeoutMs: WORKSPACE_SUBSCRIPTION_EXPIRY_TIMEOUT_MS,
            });
        }
        catch (error) {
            if (isAdsflowHttpStatusError(error, 404)) {
                const details = { ...FALLBACK_WORKSPACE_SUBSCRIPTION_DETAILS };
                setCachedWorkspaceSubscriptionExpiry(cacheKey, details);
                return details;
            }
            throw error;
        }
        const details = resolveWorkspaceSubscriptionDetailsFromAdminPayload(payload, {
            currentPlanHint: options?.currentPlanHint,
        });
        setCachedWorkspaceSubscriptionExpiry(cacheKey, details);
        return details;
    })().finally(() => {
        workspaceSubscriptionExpiryInFlight.delete(cacheKey);
    });
    workspaceSubscriptionExpiryInFlight.set(cacheKey, request);
    return request;
};
const enrichWorkspaceProfile = async (payload, options) => {
    const profile = buildWorkspaceProfile(payload);
    if (profile.startPlanUsed && (profile.plan === "FREE" || profile.expiresAt)) {
        return profile;
    }
    try {
        const details = await fetchAdsflowSubscriptionDetails(options?.rawUserId ?? payload?.user_id, {
            currentPlanHint: profile.plan,
        });
        return {
            ...profile,
            expiresAt: profile.expiresAt ?? details.expiresAt,
            startPlanUsed: profile.startPlanUsed || details.startPlanUsed,
        };
    }
    catch {
        return profile;
    }
};
const buildStudioGeneration = (payload, options) => {
    const metadata = resolveGenerationPresentation({
        description: options?.description ?? payload.description,
        fallbackTitle: "Готовое видео",
        hashtags: options?.hashtags ?? payload.hashtags,
        prompt: options?.prompt ?? payload.prompt,
        title: options?.title ?? payload.title,
    });
    const jobId = String(payload.job_id ?? "");
    const finalAsset = buildStudioFinalAsset({
        adId: payload.ad_id ?? null,
        downloadPath: payload.download_path ?? null,
        generatedAt: payload.generated_at ?? null,
        historyEntry: options?.historyEntry ?? null,
        kind: "final_video",
        mediaAssetId: payload.media_asset_id ?? null,
        status: payload.status ?? null,
    });
    const videoUrls = buildStudioGenerationVideoUrls({
        downloadPath: finalAsset?.downloadPath ?? payload.download_path,
        generatedAt: payload.generated_at,
        jobId,
    });
    if (!videoUrls) {
        return null;
    }
    return {
        adId: payload.ad_id ?? null,
        id: jobId,
        prompt: metadata.prompt,
        title: metadata.title,
        description: metadata.description,
        hashtags: metadata.hashtags,
        finalAsset,
        videoFallbackUrl: videoUrls.videoFallbackUrl,
        videoUrl: videoUrls.videoUrl,
        durationLabel: "Ready",
        modelLabel: "AdsFlow pipeline",
        prefillSettings: options?.historyEntry?.prefillSettings ?? null,
        aspectRatio: "9:16",
        generatedAt: payload.generated_at ?? new Date().toISOString(),
    };
};
const isAdsflowLatestVideoGenerationTask = (value) => {
    const normalized = normalizeGenerationText(value).toLowerCase();
    return !normalized || normalized === "video.generate" || normalized === "video.edit";
};
const buildStudioGenerationFromLatest = (payload, historyEntry) => {
    if (!isAdsflowLatestVideoGenerationTask(payload.task_type)) {
        return null;
    }
    const metadata = resolveGenerationPresentation({
        description: historyEntry?.description || payload.description,
        fallbackTitle: "Готовое видео",
        hashtags: historyEntry?.hashtags.length ? historyEntry.hashtags : payload.hashtags,
        prompt: historyEntry?.prompt || payload.prompt,
        title: historyEntry?.title || payload.title,
    });
    const jobId = String(payload.job_id ?? "");
    const finalAsset = buildStudioFinalAsset({
        adId: payload.ad_id ?? null,
        downloadPath: payload.download_path ?? null,
        generatedAt: payload.generated_at ?? null,
        historyEntry,
        kind: "final_video",
        mediaAssetId: payload.media_asset_id ?? null,
        status: payload.status ?? null,
    });
    const videoUrls = buildStudioGenerationVideoUrls({
        downloadPath: finalAsset?.downloadPath ?? payload.download_path,
        generatedAt: payload.generated_at,
        jobId,
    });
    if (!videoUrls) {
        return null;
    }
    return {
        adId: payload.ad_id ?? null,
        id: jobId,
        prompt: metadata.prompt,
        title: metadata.title,
        description: metadata.description,
        hashtags: metadata.hashtags,
        finalAsset,
        videoFallbackUrl: videoUrls.videoFallbackUrl,
        videoUrl: videoUrls.videoUrl,
        durationLabel: "Ready",
        modelLabel: "AdsFlow pipeline",
        prefillSettings: historyEntry?.prefillSettings ?? null,
        aspectRatio: "9:16",
        generatedAt: payload.generated_at ?? new Date().toISOString(),
    };
};
const buildStudioGenerationFromHistoryEntry = (entry) => {
    const jobId = normalizeGenerationText(entry.jobId);
    if (!jobId) {
        return null;
    }
    const normalizedStatus = normalizeGenerationText(entry.status).toLowerCase();
    if (!["completed", "done", "ready"].includes(normalizedStatus)) {
        return null;
    }
    const finalAsset = buildStudioFinalAsset({
        adId: entry.adId,
        downloadPath: entry.downloadPath ?? null,
        generatedAt: entry.generatedAt ?? entry.updatedAt ?? entry.createdAt,
        historyEntry: entry,
        kind: entry.finalAssetKind ?? "final_video",
        mediaAssetId: entry.finalAssetId ?? null,
        status: entry.finalAssetStatus ?? entry.status,
    });
    const videoUrls = buildStudioGenerationVideoUrls({
        downloadPath: finalAsset?.downloadPath ?? entry.downloadPath,
        generatedAt: entry.generatedAt ?? entry.updatedAt ?? entry.createdAt,
        jobId,
    });
    if (!videoUrls) {
        return null;
    }
    const metadata = resolveGenerationPresentation({
        description: entry.description,
        fallbackTitle: "Готовое видео",
        hashtags: entry.hashtags,
        prompt: entry.prompt,
        title: entry.title,
    });
    return {
        adId: entry.adId,
        aspectRatio: "9:16",
        description: metadata.description,
        durationLabel: "Ready",
        generatedAt: entry.generatedAt ?? entry.updatedAt ?? entry.createdAt,
        hashtags: metadata.hashtags,
        id: jobId,
        modelLabel: "AdsFlow pipeline",
        prefillSettings: entry.prefillSettings ?? null,
        prompt: metadata.prompt,
        title: metadata.title,
        finalAsset,
        videoFallbackUrl: videoUrls.videoFallbackUrl,
        videoUrl: videoUrls.videoUrl,
    };
};
const buildLatestGenerationStatus = (payload, historyEntry) => {
    if (!payload?.job_id) {
        return null;
    }
    if (!isAdsflowLatestVideoGenerationTask(payload.task_type)) {
        return null;
    }
    const status = String(payload.status ?? "queued");
    const generation = status === "done" ? buildStudioGenerationFromLatest(payload, historyEntry) : null;
    return {
        error: payload.error ?? undefined,
        generation: generation ?? undefined,
        jobId: String(payload.job_id),
        status,
    };
};
const buildStudioGenerationStatusFromHistoryEntry = (entry, options) => {
    const safeJobId = normalizeGenerationText(entry.jobId);
    const normalizedStatus = normalizeGenerationText(entry.status).toLowerCase();
    const generation = buildStudioGenerationFromHistoryEntry(entry);
    if (generation) {
        return {
            generation,
            jobId: safeJobId,
            status: "done",
        };
    }
    const status = normalizedStatus || normalizeGenerationText(options?.fallbackStatus) || "queued";
    return {
        error: entry.error ?? undefined,
        jobId: safeJobId,
        status,
    };
};
const extractStudioVideoPathFromProxyUrl = (value) => {
    const normalized = normalizeGenerationText(value);
    if (!normalized) {
        return null;
    }
    try {
        const baseUrl = env.appUrl ? new URL(env.appUrl) : new URL("http://localhost");
        const resolvedUrl = new URL(normalized, baseUrl);
        return normalizeGenerationText(resolvedUrl.searchParams.get("path")) || null;
    }
    catch {
        return null;
    }
};
const isStudioJobVideoProxyUrl = (value) => {
    const normalized = normalizeGenerationText(value);
    if (!normalized) {
        return false;
    }
    try {
        const baseUrl = env.appUrl ? new URL(env.appUrl) : new URL("http://localhost");
        const resolvedUrl = new URL(normalized, baseUrl);
        return /^\/api\/studio\/video\/[^/]+$/i.test(resolvedUrl.pathname);
    }
    catch {
        return false;
    }
};
const isStudioPlaybackUrl = (value) => {
    const normalized = normalizeGenerationText(value);
    if (!normalized) {
        return false;
    }
    try {
        const baseUrl = env.appUrl ? new URL(env.appUrl) : new URL("http://localhost");
        const resolvedUrl = new URL(normalized, baseUrl);
        return /^\/api\/studio\/playback\/[^/]+$/i.test(resolvedUrl.pathname);
    }
    catch {
        return false;
    }
};
const isWorkspaceProjectPlaybackUrl = (value) => {
    const normalized = normalizeGenerationText(value);
    if (!normalized) {
        return false;
    }
    try {
        const baseUrl = env.appUrl ? new URL(env.appUrl) : new URL("http://localhost");
        const resolvedUrl = new URL(normalized, baseUrl);
        return /^\/api\/workspace\/projects\/[^/]+\/playback$/i.test(resolvedUrl.pathname);
    }
    catch {
        return false;
    }
};
const findWorkspaceHistoryFallbackGeneration = async (user, excludedVideoUrls = []) => {
    const excludedVideoUrlSet = new Set(excludedVideoUrls
        .map((value) => normalizeGenerationText(value))
        .filter(Boolean));
    const historyEntries = await listWorkspaceGenerationHistory(user, 60);
    for (const historyEntry of historyEntries) {
        const fallbackGeneration = buildStudioGenerationFromHistoryEntry(historyEntry);
        if (!fallbackGeneration) {
            continue;
        }
        if (excludedVideoUrlSet.has(normalizeGenerationText(fallbackGeneration.videoUrl))) {
            continue;
        }
        return fallbackGeneration;
    }
    return null;
};
const ADSFLOW_FETCH_RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 502, 503, 504]);
const ADSFLOW_FETCH_RETRY_DELAYS_MS = [250, 700];
const ADSFLOW_FETCH_TIMEOUT_MS = 20_000;
const ADSFLOW_MUTATION_TIMEOUT_MS = 90_000;
class AdsflowHttpError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.name = "AdsflowHttpError";
        this.statusCode = statusCode;
    }
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isAdsflowHttpStatusError = (error, ...statusCodes) => error instanceof AdsflowHttpError && statusCodes.includes(error.statusCode);
const describeAdsflowFetchFailure = (url, error) => {
    const target = `${url.origin}${url.pathname}`;
    if (!(error instanceof Error)) {
        return `AdsFlow unavailable for ${target}.`;
    }
    const cause = error.cause;
    const causeCode = typeof cause?.code === "string" ? cause.code : "";
    const causeMessage = typeof cause?.message === "string" ? cause.message : "";
    const detail = causeCode || causeMessage || error.message || "Network error";
    return `AdsFlow unavailable for ${target}: ${detail}.`;
};
const fetchAdsflowResponse = async (url, init, options) => {
    let lastError = null;
    const retryDelaysMs = options?.retryDelaysMs ?? ADSFLOW_FETCH_RETRY_DELAYS_MS;
    const timeoutMs = options?.timeoutMs ?? ADSFLOW_FETCH_TIMEOUT_MS;
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
        try {
            const response = await fetch(url, {
                ...init,
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (!ADSFLOW_FETCH_RETRYABLE_STATUS_CODES.has(response.status) || attempt === retryDelaysMs.length) {
                return response;
            }
            console.warn(`[studio] AdsFlow responded with ${response.status} for ${url.pathname}, retry ${attempt + 1}/${retryDelaysMs.length}`);
        }
        catch (error) {
            lastError = error;
            if (attempt === retryDelaysMs.length) {
                throw new Error(describeAdsflowFetchFailure(url, error));
            }
            console.warn(`[studio] AdsFlow fetch error for ${url.pathname}, retry ${attempt + 1}/${retryDelaysMs.length}`, error);
        }
        await wait(retryDelaysMs[attempt] ?? 0);
    }
    throw new Error(lastError ? describeAdsflowFetchFailure(url, lastError) : `AdsFlow unavailable for ${url.origin}${url.pathname}.`);
};
const fetchAdsflowJson = async (url, init, options) => {
    const response = await fetchAdsflowResponse(url, init, options);
    const payload = (await response.json().catch(() => null));
    if (!response.ok) {
        const detail = payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
            ? payload.detail
            : `AdsFlow request failed (${response.status}).`;
        if (!(options?.silentStatuses ?? []).includes(response.status)) {
            console.error("[adsflow] HTTP error", url.pathname, response.status, JSON.stringify(payload));
        }
        if (response.status === 402) {
            throw new WorkspaceCreditLimitError(detail);
        }
        throw new AdsflowHttpError(detail, response.status);
    }
    if (!payload) {
        throw new Error("AdsFlow returned an empty response.");
    }
    return payload;
};
const postAdsflowText = async (path, body, options) => {
    assertAdsflowConfigured();
    const response = await fetchAdsflowResponse(buildAdsflowUrl(path), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    }, options);
    const payload = await response.text();
    if (!response.ok) {
        const detail = extractErrorDetail(payload) ?? `AdsFlow request failed (${response.status}).`;
        if (response.status === 402) {
            throw new WorkspaceCreditLimitError(detail);
        }
        throw new AdsflowHttpError(detail, response.status);
    }
    if (!payload) {
        throw new Error("AdsFlow returned an empty response.");
    }
    return payload;
};
const postAdsflowJson = async (path, body, options) => {
    assertAdsflowConfigured();
    return fetchAdsflowJson(buildAdsflowUrl(path), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    }, options);
};
const uploadStudioMediaAsset = async (user, options) => {
    const normalizedDataUrl = String(options.dataUrl ?? "").trim();
    if (!normalizedDataUrl) {
        throw new Error("Uploaded media data URL is required.");
    }
    const normalizedFileName = String(options.fileName ?? "").trim();
    if (!normalizedFileName) {
        throw new Error("Uploaded media file name is required.");
    }
    const decoded = decodeBinaryDataUrl(normalizedDataUrl);
    if (!decoded.bytes.length) {
        throw new Error("Uploaded media file is empty.");
    }
    const normalizedMimeType = normalizeGenerationText(options.mimeType) || decoded.mimeType || "application/octet-stream";
    const normalizedMediaType = options.mediaType || inferStudioUploadMediaType(normalizedMimeType, normalizedFileName);
    const initPayload = await postAdsflowJson("/api/media/uploads/init", {
        admin_token: env.adsflowAdminToken,
        external_user_id: options.externalUserId,
        file_name: normalizedFileName,
        kind: options.kind,
        language: options.language,
        media_type: normalizedMediaType,
        mime_type: normalizedMimeType,
        project_id: options.projectId ?? undefined,
        role: options.role ?? undefined,
        segment_index: options.segmentIndex ?? undefined,
        size_bytes: decoded.bytes.length,
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
    }, {
        retryDelaysMs: [],
        timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
    });
    const assetId = normalizePositiveInteger(initPayload.asset?.id);
    if (!assetId) {
        throw new Error("AdsFlow did not return a media asset id.");
    }
    const uploadUrl = normalizeGenerationText(initPayload.upload?.url);
    if (!uploadUrl) {
        throw new Error("AdsFlow did not return a direct media upload URL.");
    }
    const uploadHeaders = new Headers();
    Object.entries(initPayload.upload?.headers ?? {}).forEach(([key, value]) => {
        if (value) {
            uploadHeaders.set(key, value);
        }
    });
    if (!uploadHeaders.has("content-type")) {
        uploadHeaders.set("content-type", normalizedMimeType);
    }
    const uploadResponse = await fetch(uploadUrl, {
        body: new Blob([decoded.bytes], { type: normalizedMimeType }),
        headers: uploadHeaders,
        method: normalizeGenerationText(initPayload.upload?.method) || "PUT",
        signal: AbortSignal.timeout(ADSFLOW_MUTATION_TIMEOUT_MS),
    });
    if (!uploadResponse.ok) {
        throw new Error(`Direct media upload failed (${uploadResponse.status}).`);
    }
    await postAdsflowJson("/api/media/uploads/complete", {
        admin_token: env.adsflowAdminToken,
        asset_id: assetId,
        external_user_id: options.externalUserId,
        language: options.language,
        project_id: options.projectId ?? undefined,
        role: options.role ?? undefined,
        segment_index: options.segmentIndex ?? undefined,
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
    }, {
        retryDelaysMs: [],
        timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
    });
    return assetId;
};
const fetchAdsflowJobStatus = async (jobId, user) => {
    assertAdsflowConfigured();
    const safeJobId = String(jobId ?? "").trim();
    if (!safeJobId) {
        throw new Error("Job id is required.");
    }
    const externalUserId = await resolveStudioExternalUserId(user);
    return fetchAdsflowJson(buildAdsflowUrl(`/api/web/generations/${encodeURIComponent(safeJobId)}`, {
        admin_token: env.adsflowAdminToken ?? "",
        external_user_id: externalUserId,
    }));
};
const fetchAdsflowSegmentAiPhotoJobStatus = async (jobId, user) => {
    assertAdsflowConfigured();
    const safeJobId = String(jobId ?? "").trim();
    if (!safeJobId) {
        throw new Error("Job id is required.");
    }
    const externalUserId = await resolveStudioExternalUserId(user);
    return fetchAdsflowJson(buildAdsflowUrl(`/api/web/segment-ai-photo/jobs/${encodeURIComponent(safeJobId)}`, {
        admin_token: env.adsflowAdminToken ?? "",
        external_user_id: externalUserId,
    }));
};
const fetchAdsflowSegmentAiVideoJobStatus = async (jobId, user) => {
    assertAdsflowConfigured();
    const safeJobId = String(jobId ?? "").trim();
    if (!safeJobId) {
        throw new Error("Job id is required.");
    }
    const externalUserId = await resolveStudioExternalUserId(user);
    return fetchAdsflowJson(buildAdsflowUrl(`/api/web/segment-ai-video/jobs/${encodeURIComponent(safeJobId)}`, {
        admin_token: env.adsflowAdminToken ?? "",
        external_user_id: externalUserId,
    }));
};
const fetchAdsflowSegmentPhotoAnimationJobStatus = async (jobId, user) => {
    assertAdsflowConfigured();
    const safeJobId = String(jobId ?? "").trim();
    if (!safeJobId) {
        throw new Error("Job id is required.");
    }
    const externalUserId = await resolveStudioExternalUserId(user);
    return fetchAdsflowJson(buildAdsflowUrl(`/api/web/segment-photo-animation/jobs/${encodeURIComponent(safeJobId)}`, {
        admin_token: env.adsflowAdminToken ?? "",
        external_user_id: externalUserId,
    }));
};
const fetchAdsflowSegmentImageEditJobStatus = async (jobId, user) => {
    assertAdsflowConfigured();
    const safeJobId = String(jobId ?? "").trim();
    if (!safeJobId) {
        throw new Error("Job id is required.");
    }
    const externalUserId = await resolveStudioExternalUserId(user);
    return fetchAdsflowJson(buildAdsflowUrl(`/api/web/segment-image-edit/jobs/${encodeURIComponent(safeJobId)}`, {
        admin_token: env.adsflowAdminToken ?? "",
        external_user_id: externalUserId,
    }));
};
const fetchAdsflowSegmentImageUpscaleJobStatus = async (jobId, user) => {
    assertAdsflowConfigured();
    const safeJobId = String(jobId ?? "").trim();
    if (!safeJobId) {
        throw new Error("Job id is required.");
    }
    const externalUserId = await resolveStudioExternalUserId(user);
    return fetchAdsflowJson(buildAdsflowUrl(`/api/web/segment-image-upscale/jobs/${encodeURIComponent(safeJobId)}`, {
        admin_token: env.adsflowAdminToken ?? "",
        external_user_id: externalUserId,
    }));
};
const consumeWorkspaceGenerationCredit = async (user, amount = 1, language) => {
    const externalUserId = await resolveStudioExternalUserId(user);
    const payloadText = await postAdsflowText("/api/web/credits/consume", {
        admin_token: env.adsflowAdminToken,
        amount: Math.max(1, Math.trunc(amount || 1)),
        external_user_id: externalUserId,
        language: normalizeStudioLanguage(language),
        referral_source: "landing_site",
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
    });
    const payload = parseJson(payloadText);
    if (!payload?.user || !payload.consumed) {
        throw new Error("AdsFlow did not return consumed web credits.");
    }
    return {
        consumed: {
            purchased: Math.max(0, Number(payload.consumed.purchased ?? 0)),
            subscription: Math.max(0, Number(payload.consumed.subscription ?? 0)),
        },
        profile: await enrichWorkspaceProfile(payload.user, {
            rawUserId: extractAdsflowUserId(payloadText),
        }),
    };
};
const refundWorkspaceGenerationCredit = async (user, consumed, language) => {
    if (consumed.purchased <= 0 && consumed.subscription <= 0) {
        return buildWorkspaceProfile();
    }
    const externalUserId = await resolveStudioExternalUserId(user);
    const payloadText = await postAdsflowText("/api/web/credits/refund", {
        admin_token: env.adsflowAdminToken,
        consumed_purchased: Math.max(0, Math.trunc(consumed.purchased || 0)),
        consumed_subscription: Math.max(0, Math.trunc(consumed.subscription || 0)),
        external_user_id: externalUserId,
        language: normalizeStudioLanguage(language),
        referral_source: "landing_site",
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
    });
    const payload = parseJson(payloadText);
    if (!payload?.user) {
        throw new Error("AdsFlow did not return refunded web profile.");
    }
    return await enrichWorkspaceProfile(payload.user, {
        rawUserId: extractAdsflowUserId(payloadText),
    });
};
export async function getWorkspaceBootstrap(user) {
    const externalUserId = await resolveStudioExternalUserId(user);
    const cachedBootstrap = getCachedWorkspaceBootstrap(externalUserId);
    try {
        const payloadText = await postAdsflowTextWithPolicy("/api/web/bootstrap", {
            admin_token: env.adsflowAdminToken,
            external_user_id: externalUserId,
            language: "ru",
            referral_source: "landing_site",
            user_email: user.email ?? undefined,
            user_email_verified: user.emailVerified === true,
            user_name: user.name ?? undefined,
        }, upstreamPolicies.adsflowBootstrap, {
            endpoint: "studio.bootstrap",
            projectId: externalUserId,
        });
        const payload = parseJson(payloadText);
        if (!payload?.user) {
            throw new Error("AdsFlow did not return web user profile.");
        }
        const profile = await enrichWorkspaceProfile(payload.user, {
            rawUserId: extractAdsflowUserId(payloadText),
        });
        const latestHistoryEntry = payload.latest_generation?.job_id
            ? await getWorkspaceGenerationHistoryEntry(user, String(payload.latest_generation.job_id)).catch(() => null)
            : null;
        const latestGeneration = await prepareStudioLatestGenerationForBootstrap(buildLatestGenerationStatus(payload.latest_generation, latestHistoryEntry), user);
        const bootstrap = {
            latestGeneration,
            profile,
            studioOptions: buildWorkspaceStudioOptions(payload.studio_options),
        };
        if (latestGeneration?.generation) {
            warmStudioGenerationPlayback(latestGeneration.generation, user);
        }
        setCachedWorkspaceBootstrap(externalUserId, bootstrap);
        return bootstrap;
    }
    catch (error) {
        console.error("[studio] Falling back to local workspace bootstrap", error);
        let latestGeneration = cachedBootstrap?.latestGeneration ?? null;
        const excludedFallbackVideoUrls = latestGeneration?.generation ? [latestGeneration.generation.videoUrl] : [];
        if (!latestGeneration?.generation) {
            try {
                const historyGeneration = await findWorkspaceHistoryFallbackGeneration(user, excludedFallbackVideoUrls);
                if (historyGeneration) {
                    latestGeneration = {
                        error: latestGeneration?.error,
                        generation: historyGeneration,
                        jobId: historyGeneration.id,
                        status: "done",
                    };
                }
            }
            catch (historyError) {
                console.error("[studio] Failed to load workspace history fallback generation", historyError);
            }
        }
        latestGeneration = await prepareStudioLatestGenerationForBootstrap(latestGeneration, user);
        if (latestGeneration?.generation) {
            warmStudioGenerationPlayback(latestGeneration.generation, user);
        }
        return {
            latestGeneration,
            profile: cachedBootstrap?.profile ?? buildWorkspaceProfile(),
            studioOptions: cachedBootstrap?.studioOptions ?? fallbackWorkspaceStudioOptions,
        };
    }
}
export async function createStudioGenerationJob(prompt, user, options) {
    assertAdsflowConfigured();
    const normalizedPrompt = normalizePrompt(prompt);
    if (!normalizedPrompt) {
        throw new Error("Prompt is required.");
    }
    const normalizedLanguage = normalizeStudioLanguage(options?.language);
    const normalizedVideoMode = normalizeStudioVideoMode(options?.videoMode);
    const requiredCredits = STUDIO_GENERATION_CREDIT_COST;
    const creditReservation = await consumeWorkspaceGenerationCredit(user, requiredCredits, normalizedLanguage);
    const externalUserId = await resolveStudioExternalUserId(user);
    const shouldAddWatermark = creditReservation.profile.plan === "FREE" &&
        creditReservation.consumed.subscription > 0 &&
        creditReservation.consumed.purchased <= 0;
    const isVoiceEnabled = options?.voiceEnabled !== false;
    const normalizedVoiceId = isVoiceEnabled ? String(options?.voiceId ?? "").trim() || undefined : undefined;
    const normalizedMusicType = normalizeStudioMusicType(options?.musicType);
    const isSubtitleEnabled = options?.subtitleEnabled !== false;
    const normalizedSubtitleStyleId = isSubtitleEnabled ? normalizeStudioSubtitleStyle(options?.subtitleStyleId) : undefined;
    const normalizedSubtitleColorId = isSubtitleEnabled && normalizedSubtitleStyleId
        ? normalizeStudioSubtitleColor(options?.subtitleColorId, getDefaultStudioSubtitleColorForStyle(normalizedSubtitleStyleId))
        : undefined;
    const normalizedBrandLogoFileName = String(options?.brandLogoFileName ?? "").trim() || undefined;
    const normalizedBrandLogoFileMimeType = String(options?.brandLogoFileMimeType ?? "").trim() || undefined;
    const normalizedBrandLogoFileDataUrl = String(options?.brandLogoFileDataUrl ?? "").trim() || undefined;
    const normalizedBrandLogoAssetId = normalizePositiveInteger(options?.brandLogoAssetId) ?? undefined;
    const normalizedBrandText = String(options?.brandText ?? "").trim() || undefined;
    const normalizedCustomMusicFileName = String(options?.customMusicFileName ?? "").trim() || undefined;
    const normalizedCustomMusicFileDataUrl = String(options?.customMusicFileDataUrl ?? "").trim() || undefined;
    const normalizedCustomMusicAssetId = normalizePositiveInteger(options?.customMusicAssetId) ?? undefined;
    const normalizedCustomVideoFileName = String(options?.customVideoFileName ?? "").trim() || undefined;
    const normalizedCustomVideoFileMimeType = String(options?.customVideoFileMimeType ?? "").trim() || undefined;
    const normalizedCustomVideoFileDataUrl = String(options?.customVideoFileDataUrl ?? "").trim() || undefined;
    const normalizedCustomVideoAssetId = normalizePositiveInteger(options?.customVideoAssetId) ?? undefined;
    const normalizedEditedFromProjectAdId = normalizePositiveInteger(options?.editedFromProjectAdId) ?? undefined;
    const normalizedProjectId = normalizePositiveInteger(options?.projectId);
    const normalizedSegmentEditor = normalizeStudioSegmentEditorPayload(options?.segmentEditor, normalizedProjectId ?? undefined);
    const normalizedVersionRootProjectAdId = normalizePositiveInteger(options?.versionRootProjectAdId) ?? undefined;
    const prefillSettings = normalizeExamplePrefillStudioSettings({
        brandText: normalizedBrandText,
        language: normalizedLanguage,
        musicType: normalizedMusicType,
        subtitleColorId: normalizedSubtitleColorId,
        subtitleEnabled: isSubtitleEnabled,
        subtitleStyleId: normalizedSubtitleStyleId,
        videoMode: normalizedVideoMode,
        voiceEnabled: isVoiceEnabled,
        voiceId: normalizedVoiceId,
    });
    if (normalizedMusicType === "custom" && !normalizedCustomMusicAssetId && (!normalizedCustomMusicFileName || !normalizedCustomMusicFileDataUrl)) {
        throw new Error("Загрузите свой музыкальный трек или выберите другой режим музыки.");
    }
    if (normalizedVideoMode === "custom" && !normalizedCustomVideoAssetId && (!normalizedCustomVideoFileName || !normalizedCustomVideoFileDataUrl)) {
        throw new Error("Загрузите своё видео или выберите другой режим видео.");
    }
    if (normalizedSegmentEditor && !options?.isRegeneration) {
        throw new Error("Редактор сегментов можно использовать только при перегенерации.");
    }
    if (normalizedSegmentEditor && !normalizedProjectId) {
        throw new Error("Для перегенерации из редактора сегментов нужен project id.");
    }
    let jobCreated = false;
    try {
        console.info("[studio] adsflow.brand-payload", {
            brandLogoDataUrlLength: normalizedBrandLogoFileDataUrl?.length ?? 0,
            brandLogoFileName: normalizedBrandLogoFileName ?? null,
            brandLogoMimeType: normalizedBrandLogoFileMimeType ?? null,
            brandTextLength: normalizedBrandText?.length ?? 0,
            hasBrandLogo: Boolean(normalizedBrandLogoFileDataUrl),
            hasBrandText: Boolean(normalizedBrandText),
            isRegeneration: Boolean(options?.isRegeneration),
            projectId: normalizedProjectId ?? null,
            segmentEditorActive: Boolean(normalizedSegmentEditor),
        });
        const brandLogoAssetId = normalizedBrandLogoAssetId ?? (normalizedBrandLogoFileDataUrl && normalizedBrandLogoFileName
            ? await uploadStudioMediaAsset(user, {
                dataUrl: normalizedBrandLogoFileDataUrl,
                externalUserId,
                fileName: normalizedBrandLogoFileName,
                kind: "brand_logo",
                language: normalizedLanguage,
                mediaType: "photo",
                mimeType: normalizedBrandLogoFileMimeType,
                projectId: normalizedProjectId,
                role: "brand_logo",
            })
            : undefined);
        const customMusicAssetId = normalizedMusicType === "custom" && normalizedCustomMusicAssetId
            ? normalizedCustomMusicAssetId
            : normalizedMusicType === "custom" && normalizedCustomMusicFileDataUrl && normalizedCustomMusicFileName
                ? await uploadStudioMediaAsset(user, {
                    dataUrl: normalizedCustomMusicFileDataUrl,
                    externalUserId,
                    fileName: normalizedCustomMusicFileName,
                    kind: "custom_music",
                    language: normalizedLanguage,
                    mediaType: "audio",
                    projectId: normalizedProjectId,
                    role: "music",
                })
                : undefined;
        const customVideoAssetId = normalizedVideoMode === "custom" && normalizedCustomVideoAssetId
            ? normalizedCustomVideoAssetId
            : normalizedVideoMode === "custom" && normalizedCustomVideoFileDataUrl && normalizedCustomVideoFileName
                ? await uploadStudioMediaAsset(user, {
                    dataUrl: normalizedCustomVideoFileDataUrl,
                    externalUserId,
                    fileName: normalizedCustomVideoFileName,
                    kind: "custom_video",
                    language: normalizedLanguage,
                    mediaType: inferStudioUploadMediaType(normalizedCustomVideoFileMimeType, normalizedCustomVideoFileName),
                    mimeType: normalizedCustomVideoFileMimeType,
                    projectId: normalizedProjectId,
                    role: "custom_video",
                })
                : undefined;
        const normalizedSegmentEditorAssetPayload = normalizedSegmentEditor
            ? {
                segments: await Promise.all(normalizedSegmentEditor.segments.map(async (segment) => {
                    const segmentAssetId = segment.videoAction === "custom" && segment.customVideoAssetId
                        ? segment.customVideoAssetId
                        : segment.videoAction === "custom" && segment.customVideoFileDataUrl && segment.customVideoFileName
                            ? await uploadStudioMediaAsset(user, {
                                dataUrl: segment.customVideoFileDataUrl,
                                externalUserId,
                                fileName: segment.customVideoFileName,
                                kind: "segment_source",
                                language: normalizedLanguage,
                                mediaType: inferStudioUploadMediaType(segment.customVideoFileMimeType, segment.customVideoFileName),
                                mimeType: segment.customVideoFileMimeType,
                                projectId: normalizedProjectId,
                                role: "segment_source",
                                segmentIndex: segment.index,
                            })
                            : undefined;
                    return {
                        custom_video_asset_id: segmentAssetId,
                        custom_video_mime_type: segment.customVideoFileMimeType,
                        custom_video_original_name: segment.customVideoFileName,
                        duration: segment.duration,
                        end_time: segment.endTime,
                        index: segment.index,
                        reset_visual: Boolean(segment.resetVisual),
                        start_time: segment.startTime,
                        text: segment.text,
                        video_action: segment.videoAction,
                    };
                })),
            }
            : undefined;
        const payload = await fetchAdsflowJson(buildAdsflowUrl("/api/web/generations"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                admin_token: env.adsflowAdminToken,
                external_user_id: externalUserId,
                // Preserve the user's original topic language in AdsFlow.
                // The worker already receives requested/content language separately.
                prompt: normalizedPrompt,
                user_email: user.email ?? undefined,
                user_name: user.name ?? undefined,
                language: normalizedLanguage,
                add_watermark: shouldAddWatermark,
                credit_cost: requiredCredits,
                brand_logo_asset_id: brandLogoAssetId,
                brand_logo_mime_type: normalizedBrandLogoFileMimeType,
                brand_logo_original_name: normalizedBrandLogoFileName,
                brand_text: normalizedBrandText,
                custom_video_asset_id: normalizedVideoMode === "custom" ? customVideoAssetId : undefined,
                custom_video_mime_type: normalizedVideoMode === "custom" ? normalizedCustomVideoFileMimeType : undefined,
                custom_video_original_name: normalizedVideoMode === "custom" ? normalizedCustomVideoFileName : undefined,
                is_regeneration: Boolean(options?.isRegeneration),
                music_type: normalizedMusicType,
                project_id: normalizedProjectId,
                segment_editor: normalizedSegmentEditorAssetPayload,
                custom_music_asset_id: normalizedMusicType === "custom" ? customMusicAssetId : undefined,
                custom_music_original_name: normalizedMusicType === "custom" ? normalizedCustomMusicFileName : undefined,
                subtitle_type: isSubtitleEnabled ? undefined : "none",
                subtitle_color: normalizedSubtitleColorId,
                subtitle_style: normalizedSubtitleStyleId,
                video_mode: normalizedVideoMode,
                voice_type: isVoiceEnabled ? undefined : "none",
                voice_code: normalizedVoiceId,
            }),
        }, {
            // This endpoint is not idempotent: a timeout after upstream accepted the request
            // can create duplicate jobs and double-spend credits on retry.
            retryDelaysMs: [],
            timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
        });
        const jobId = String(payload.job_id ?? "").trim();
        if (!jobId) {
            throw new Error("AdsFlow did not return a job id.");
        }
        jobCreated = true;
        if (payload.enqueue_error) {
            console.warn("[studio] AdsFlow enqueue warning:", payload.enqueue_error);
        }
        const queuedMetadata = resolveGenerationPresentation({
            description: normalizedPrompt,
            fallbackTitle: "Готовое видео",
            hashtags: null,
            prompt: normalizedPrompt,
            title: normalizeGenerationText(payload.title) || normalizedPrompt,
        });
        try {
            await saveWorkspaceGenerationHistory(user, {
                editedFromProjectAdId: normalizedEditedFromProjectAdId ?? null,
                description: queuedMetadata.description,
                hashtags: queuedMetadata.hashtags,
                jobId,
                prefillSettings,
                prompt: queuedMetadata.prompt,
                status: String(payload.status ?? "queued"),
                title: queuedMetadata.title,
                versionRootProjectAdId: normalizedVersionRootProjectAdId ?? null,
            });
        }
        catch (error) {
            console.error("[studio] Failed to persist queued generation", error);
        }
        return {
            jobId,
            profile: creditReservation.profile,
            status: String(payload.status ?? "queued"),
            title: queuedMetadata.title || "Studio generation",
        };
    }
    catch (error) {
        if (!jobCreated) {
            try {
                await refundWorkspaceGenerationCredit(user, creditReservation.consumed, normalizedLanguage);
            }
            catch (refundError) {
                console.error("[studio] Failed to refund reserved credits", refundError);
            }
        }
        throw error;
    }
}
export async function generateStudioSegmentAiPhoto(prompt, user, options) {
    assertAdsflowConfigured();
    const normalizedPrompt = normalizePrompt(prompt);
    if (!normalizedPrompt) {
        throw new Error("Prompt is required.");
    }
    const normalizedLanguage = normalizeStudioLanguage(options?.language);
    const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
        sourceLanguage: normalizedLanguage,
    });
    const normalizedProjectId = normalizePositiveInteger(options?.projectId);
    const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
    const creditReservation = await consumeWorkspaceGenerationCredit(user, STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST, normalizedLanguage);
    const externalUserId = await resolveStudioExternalUserId(user);
    let assetReady = false;
    try {
        const payload = await postAdsflowJson("/api/web/segment-ai-photo/generate", {
            admin_token: env.adsflowAdminToken,
            external_user_id: externalUserId,
            language: normalizedLanguage,
            project_id: normalizedProjectId,
            prompt: upstreamPrompt,
            segment_index: normalizedSegmentIndex,
            user_email: user.email ?? undefined,
            user_name: user.name ?? undefined,
        });
        const asset = await normalizeAdsflowSegmentAiPhotoAsset(payload.asset);
        assetReady = true;
        return {
            asset,
            profile: creditReservation.profile,
        };
    }
    catch (error) {
        if (!(error instanceof WorkspaceCreditLimitError)) {
            try {
                const fallbackAsset = await generateDirectStudioSegmentAiPhoto(upstreamPrompt, {
                    segmentIndex: normalizedSegmentIndex,
                });
                assetReady = true;
                return {
                    asset: fallbackAsset,
                    profile: creditReservation.profile,
                };
            }
            catch (fallbackError) {
                const upstreamMessage = error instanceof Error ? error.message : "AdsFlow fallback failed.";
                const directMessage = fallbackError instanceof Error ? fallbackError.message : "Direct image fallback failed.";
                error = new Error(`Не удалось сгенерировать ИИ фото. AdsFlow: ${upstreamMessage}. DEAPI: ${directMessage}.`);
            }
        }
        if (!assetReady) {
            try {
                await refundWorkspaceGenerationCredit(user, creditReservation.consumed, normalizedLanguage);
            }
            catch (refundError) {
                console.error("[studio] Failed to refund AI photo credits", refundError);
            }
        }
        throw error;
    }
}
export async function createStudioSegmentImageEditJob(prompt, imageDataUrl, user, options) {
    assertAdsflowConfigured();
    const normalizedPrompt = normalizePrompt(prompt);
    if (!normalizedPrompt) {
        throw new Error("Prompt is required.");
    }
    const normalizedImageDataUrl = String(imageDataUrl ?? "").trim() || undefined;
    const normalizedImageAssetId = normalizePositiveInteger(options?.imageAssetId);
    if (!normalizedImageAssetId && !normalizedImageDataUrl) {
        throw new Error("Image asset id or image data URL is required.");
    }
    const normalizedLanguage = normalizeStudioLanguage(options?.language);
    const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
        sourceLanguage: normalizedLanguage,
    });
    const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
    const normalizedProjectId = normalizePositiveInteger(options?.projectId);
    const normalizedMimeType = normalizedImageDataUrl
        ? (() => {
            const decodedImage = decodeDataUrlBytes(normalizedImageDataUrl);
            if (!decodedImage.bytes.length) {
                throw new Error("Image data URL is empty.");
            }
            return inferStudioGeneratedImageMimeType(decodedImage.mimeType, options?.fileName, null);
        })()
        : inferStudioGeneratedImageMimeType(null, options?.fileName, null);
    const normalizedFileName = normalizeStudioGeneratedImageFileName(options?.fileName, normalizedMimeType) ||
        `segment-image-edit-${(normalizedSegmentIndex ?? 0) + 1}${getStudioGeneratedImageExtension(normalizedMimeType)}`;
    const externalUserId = await resolveStudioExternalUserId(user);
    const imageAssetId = normalizedImageAssetId
        ? normalizedImageAssetId
        : await uploadStudioMediaAsset(user, {
            dataUrl: normalizedImageDataUrl,
            externalUserId,
            fileName: normalizedFileName,
            kind: "segment_image",
            language: normalizedLanguage,
            mediaType: "photo",
            mimeType: normalizedMimeType,
            projectId: normalizedProjectId,
            role: "segment_source",
            segmentIndex: normalizedSegmentIndex,
        });
    console.info("[studio] segment-image-edit: sending job request", JSON.stringify({
        imageAssetId,
        imageFileName: normalizedFileName,
        imageMimeType: normalizedMimeType,
        projectId: normalizedProjectId,
        segmentIndex: normalizedSegmentIndex,
        externalUserId,
    }));
    let payload;
    try {
        payload = await postAdsflowJson("/api/web/segment-image-edit/jobs", {
            admin_token: env.adsflowAdminToken,
            credit_cost: STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST,
            external_user_id: externalUserId,
            image_asset_id: imageAssetId,
            image_mime_type: normalizedMimeType,
            image_original_name: normalizedFileName,
            language: normalizedLanguage,
            project_id: normalizedProjectId,
            prompt: upstreamPrompt,
            segment_index: normalizedSegmentIndex,
            user_email: user.email ?? undefined,
            user_name: user.name ?? undefined,
        }, {
            retryDelaysMs: [],
            timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
        });
        console.info("[studio] segment-image-edit: job created successfully", JSON.stringify({ jobId: payload.job_id, status: payload.status }));
    }
    catch (err) {
        console.error("[studio] segment-image-edit: postAdsflowJson failed", err);
        throw err;
    }
    const jobId = String(payload.job_id ?? "").trim();
    if (!jobId) {
        throw new Error("AdsFlow did not return a segment image edit job id.");
    }
    return {
        jobId,
        profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
            rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
        }),
        status: String(payload.status ?? "queued"),
    };
}
export async function createStudioSegmentImageUpscaleJob(imageDataUrl, user, options) {
    assertAdsflowConfigured();
    const normalizedImageDataUrl = String(imageDataUrl ?? "").trim() || undefined;
    const normalizedImageAssetId = normalizePositiveInteger(options?.imageAssetId);
    if (!normalizedImageAssetId && !normalizedImageDataUrl) {
        throw new Error("Image asset id or image data URL is required.");
    }
    const normalizedLanguage = normalizeStudioLanguage(options?.language);
    const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
    const normalizedProjectId = normalizePositiveInteger(options?.projectId);
    const normalizedMimeType = normalizedImageDataUrl
        ? (() => {
            const decodedImage = decodeDataUrlBytes(normalizedImageDataUrl);
            if (!decodedImage.bytes.length) {
                throw new Error("Image data URL is empty.");
            }
            return inferStudioGeneratedImageMimeType(decodedImage.mimeType, options?.fileName, null);
        })()
        : inferStudioGeneratedImageMimeType(null, options?.fileName, null);
    const normalizedFileName = buildStudioUpscaledImageFileName(options?.fileName, normalizedMimeType, {
        segmentIndex: normalizedSegmentIndex,
    });
    const externalUserId = await resolveStudioExternalUserId(user);
    const imageAssetId = normalizedImageAssetId
        ? normalizedImageAssetId
        : await uploadStudioMediaAsset(user, {
            dataUrl: normalizedImageDataUrl,
            externalUserId,
            fileName: normalizedFileName,
            kind: "segment_image",
            language: normalizedLanguage,
            mediaType: "photo",
            mimeType: normalizedMimeType,
            projectId: normalizedProjectId,
            role: "segment_source",
            segmentIndex: normalizedSegmentIndex,
        });
    const payload = await postAdsflowJson("/api/web/segment-image-upscale/jobs", {
        admin_token: env.adsflowAdminToken,
        credit_cost: STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST,
        external_user_id: externalUserId,
        image_asset_id: imageAssetId,
        image_mime_type: normalizedMimeType,
        image_original_name: normalizedFileName,
        language: normalizedLanguage,
        project_id: normalizedProjectId,
        segment_index: normalizedSegmentIndex,
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
    }, {
        retryDelaysMs: [],
        timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
    });
    const jobId = String(payload.job_id ?? "").trim();
    if (!jobId) {
        throw new Error("AdsFlow did not return a segment image upscale job id.");
    }
    return {
        jobId,
        profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
            rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
        }),
        status: String(payload.status ?? "queued"),
    };
}
export async function getStudioSegmentImageUpscaleJobStatus(jobId, user) {
    const payload = await fetchAdsflowSegmentImageUpscaleJobStatus(jobId, user);
    const status = String(payload.status ?? "queued").trim() || "queued";
    const safeJobId = String(payload.job_id ?? jobId).trim() || String(jobId ?? "").trim();
    const asset = payload.asset ? await normalizeAdsflowSegmentAiPhotoAsset(payload.asset) : undefined;
    return {
        asset,
        error: normalizeGenerationText(payload.error) || undefined,
        jobId: safeJobId,
        profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
            rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
        }),
        status,
    };
}
export async function getStudioSegmentImageEditJobStatus(jobId, user) {
    const payload = await fetchAdsflowSegmentImageEditJobStatus(jobId, user);
    const status = String(payload.status ?? "queued").trim() || "queued";
    const safeJobId = String(payload.job_id ?? jobId).trim() || String(jobId ?? "").trim();
    const asset = payload.asset ? await normalizeAdsflowSegmentAiPhotoAsset(payload.asset) : undefined;
    const error = normalizeGenerationText(payload.error) || undefined;
    if (error || status === "failed") {
        console.warn("[studio] segment-image-edit job status has error", JSON.stringify({
            jobId: safeJobId,
            status,
            error,
            payloadKeys: Object.keys(payload),
        }));
    }
    return {
        asset,
        error,
        jobId: safeJobId,
        profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
            rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
        }),
        status,
    };
}
export async function improveStudioSegmentAiPhotoPrompt(prompt, options) {
    const normalizedPrompt = normalizePrompt(prompt);
    if (!normalizedPrompt) {
        throw new Error("Prompt is required.");
    }
    const normalizedLanguage = normalizeStudioLanguage(options?.language);
    const normalizedMode = normalizeStudioSegmentPromptImproveMode(options?.mode);
    const modelCandidates = getStudioOpenRouterPromptEnhancementModelCandidates();
    let lastError = null;
    const hasConfiguredOpenRouterKey = Boolean(String(env.openrouterApiKey ?? "").trim());
    const hasOpenRouter = hasUsableOpenRouterApiKey(env.openrouterApiKey);
    if (hasConfiguredOpenRouterKey && !hasOpenRouter) {
        throw createStudioOpenRouterMissingConfigError();
    }
    if (hasOpenRouter && modelCandidates.length > 0) {
        for (const model of modelCandidates) {
            try {
                const improvedPrompt = await requestStudioSegmentPromptEnhancement(normalizedPrompt, normalizedLanguage, normalizedMode, model);
                return {
                    prompt: improvedPrompt,
                };
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error("OpenRouter prompt enhancement failed.");
                console.warn(`[studio] Failed to improve segment AI photo prompt with ${model}`, lastError);
            }
        }
    }
    if (hasOpenRouter) {
        throw lastError ?? new Error("Failed to improve segment AI photo prompt with OpenRouter.");
    }
    const fallbackPrompt = buildStudioSegmentPromptEnhancementFallback(normalizedPrompt, normalizedLanguage, normalizedMode);
    if (fallbackPrompt) {
        return {
            prompt: fallbackPrompt,
        };
    }
    throw lastError ?? new Error("Failed to improve segment AI photo prompt.");
}
export async function generateStudioContentPlanIdeas(query, options) {
    const normalizedQuery = normalizePrompt(query);
    if (!normalizedQuery) {
        throw new Error("Query is required.");
    }
    const normalizedLanguage = detectStudioPromptLanguage(normalizedQuery, options?.language);
    const requestedCount = normalizeStudioContentPlanIdeaCount(options?.count);
    const modelCandidates = requireStudioOpenRouterModels();
    let lastError = null;
    for (const model of modelCandidates) {
        try {
            const ideas = await requestStudioContentPlanIdeas(normalizedQuery, normalizedLanguage, requestedCount, model, options?.existingIdeas ?? []);
            return {
                ideas,
                language: normalizedLanguage,
            };
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error("OpenRouter content plan generation failed.");
            console.warn(`[studio] Failed to generate content plan with ${model}`, lastError);
        }
    }
    throw lastError ?? new Error("Не удалось сгенерировать контент-план.");
}
export async function translateStudioTexts(texts, options) {
    const normalizedTexts = texts.map((text) => String(text ?? ""));
    if (normalizedTexts.length === 0) {
        return {
            texts: [],
        };
    }
    const normalizedSourceLanguage = normalizeStudioLanguage(options?.sourceLanguage);
    const normalizedTargetLanguage = normalizeStudioLanguage(options?.targetLanguage);
    if (normalizedSourceLanguage === normalizedTargetLanguage) {
        return {
            texts: normalizedTexts,
        };
    }
    const modelCandidates = requireStudioOpenRouterModels();
    let lastError = null;
    for (const model of modelCandidates) {
        try {
            const translatedTexts = await requestStudioTextTranslation(normalizedTexts, normalizedSourceLanguage, normalizedTargetLanguage, model);
            return {
                texts: translatedTexts,
            };
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error("OpenRouter text translation failed.");
            console.warn(`[studio] Failed to translate segment texts with ${model}`, lastError);
        }
    }
    throw lastError ?? new Error("Text translation is unavailable.");
}
export async function createStudioSegmentAiPhotoJob(prompt, user, options) {
    assertAdsflowConfigured();
    const normalizedPrompt = normalizePrompt(prompt);
    if (!normalizedPrompt) {
        throw new Error("Prompt is required.");
    }
    const normalizedLanguage = normalizeStudioLanguage(options?.language);
    const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
        sourceLanguage: normalizedLanguage,
    });
    const normalizedProjectId = normalizePositiveInteger(options?.projectId);
    const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
    const externalUserId = await resolveStudioExternalUserId(user);
    const payload = await postAdsflowJson("/api/web/segment-ai-photo/jobs", {
        admin_token: env.adsflowAdminToken,
        credit_cost: STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST,
        external_user_id: externalUserId,
        language: normalizedLanguage,
        project_id: normalizedProjectId,
        prompt: upstreamPrompt,
        segment_index: normalizedSegmentIndex,
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
    });
    const jobId = String(payload.job_id ?? "").trim();
    if (!jobId) {
        throw new Error("AdsFlow did not return a segment AI photo job id.");
    }
    return {
        jobId,
        profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
            rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
        }),
        status: String(payload.status ?? "queued"),
    };
}
export async function createStudioSegmentAiVideoJob(prompt, user, options) {
    assertAdsflowConfigured();
    const normalizedPrompt = normalizePrompt(prompt);
    if (!normalizedPrompt) {
        throw new Error("Prompt is required.");
    }
    const normalizedLanguage = normalizeStudioLanguage(options?.language);
    const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
        sourceLanguage: normalizedLanguage,
    });
    const normalizedProjectId = normalizePositiveInteger(options?.projectId);
    const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
    const externalUserId = await resolveStudioExternalUserId(user);
    // Same billing model as /api/web/segment-ai-photo/generate: debit via /api/web/credits/consume first so the
    // amount matches STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST. Upstream previously debited a lower default (e.g. 3) from job creation alone.
    const creditReservation = await consumeWorkspaceGenerationCredit(user, STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST, normalizedLanguage);
    try {
        const payload = await postAdsflowJson("/api/web/segment-ai-video/jobs", {
            admin_token: env.adsflowAdminToken,
            credit_cost: 0,
            external_user_id: externalUserId,
            language: normalizedLanguage,
            project_id: normalizedProjectId,
            prompt: upstreamPrompt,
            segment_index: normalizedSegmentIndex,
            user_email: user.email ?? undefined,
            user_name: user.name ?? undefined,
        });
        const jobId = String(payload.job_id ?? "").trim();
        if (!jobId) {
            throw new Error("AdsFlow did not return a segment AI video job id.");
        }
        return {
            jobId,
            profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
                rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
            }),
            status: String(payload.status ?? "queued"),
        };
    }
    catch (error) {
        try {
            await refundWorkspaceGenerationCredit(user, creditReservation.consumed, normalizedLanguage);
        }
        catch (refundError) {
            console.error("[studio] Failed to refund segment AI video credits", refundError);
        }
        throw error;
    }
}
export async function createStudioSegmentPhotoAnimationJob(prompt, user, options) {
    assertAdsflowConfigured();
    const normalizedPrompt = normalizePrompt(prompt);
    if (!normalizedPrompt) {
        throw new Error("Prompt is required.");
    }
    const normalizedLanguage = normalizeStudioLanguage(options?.language);
    const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
        sourceLanguage: normalizedLanguage,
    });
    const normalizedCustomVideoAssetId = normalizePositiveInteger(options?.customVideoAssetId);
    const normalizedCustomVideoFileDataUrl = String(options?.customVideoFileDataUrl ?? "").trim() || undefined;
    const normalizedCustomVideoFileMimeType = String(options?.customVideoFileMimeType ?? "").trim() || undefined;
    const normalizedCustomVideoFileName = String(options?.customVideoFileName ?? "").trim() || undefined;
    if (!normalizedCustomVideoAssetId && !normalizedCustomVideoFileDataUrl) {
        throw new Error("Photo source asset id or image data URL is required.");
    }
    const normalizedProjectId = normalizePositiveInteger(options?.projectId);
    const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
    const externalUserId = await resolveStudioExternalUserId(user);
    const customVideoAssetId = normalizedCustomVideoAssetId
        ? normalizedCustomVideoAssetId
        : normalizedCustomVideoFileDataUrl && normalizedCustomVideoFileName
            ? await uploadStudioMediaAsset(user, {
                dataUrl: normalizedCustomVideoFileDataUrl,
                externalUserId,
                fileName: normalizedCustomVideoFileName,
                kind: "segment_source",
                language: normalizedLanguage,
                mediaType: inferStudioUploadMediaType(normalizedCustomVideoFileMimeType, normalizedCustomVideoFileName),
                mimeType: normalizedCustomVideoFileMimeType,
                projectId: normalizedProjectId,
                role: "segment_source",
                segmentIndex: normalizedSegmentIndex,
            })
            : undefined;
    const payload = await postAdsflowJson("/api/web/segment-photo-animation/jobs", {
        admin_token: env.adsflowAdminToken,
        credit_cost: STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST,
        custom_video_asset_id: customVideoAssetId,
        custom_video_mime_type: normalizedCustomVideoFileMimeType,
        custom_video_original_name: normalizedCustomVideoFileName,
        external_user_id: externalUserId,
        language: normalizedLanguage,
        project_id: normalizedProjectId,
        prompt: upstreamPrompt,
        segment_index: normalizedSegmentIndex,
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
    }, {
        // This endpoint is not idempotent: a timeout after upstream accepted the request
        // can create duplicate jobs and double-spend credits on retry.
        retryDelaysMs: [],
        timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
    });
    const jobId = String(payload.job_id ?? "").trim();
    if (!jobId) {
        throw new Error("AdsFlow did not return a segment photo animation job id.");
    }
    return {
        jobId,
        profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
            rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
        }),
        status: String(payload.status ?? "queued"),
    };
}
export async function getStudioSegmentAiPhotoJobStatus(jobId, user) {
    const payload = await fetchAdsflowSegmentAiPhotoJobStatus(jobId, user);
    const status = String(payload.status ?? "queued").trim() || "queued";
    const safeJobId = String(payload.job_id ?? jobId).trim() || String(jobId ?? "").trim();
    const asset = payload.asset ? await normalizeAdsflowSegmentAiPhotoAsset(payload.asset) : undefined;
    return {
        asset,
        error: normalizeGenerationText(payload.error) || undefined,
        jobId: safeJobId,
        profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
            rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
        }),
        status,
    };
}
export async function getStudioSegmentAiVideoJobStatus(jobId, user) {
    const safeJobId = String(jobId ?? "").trim();
    try {
        const payload = await fetchAdsflowSegmentAiVideoJobStatus(jobId, user);
        const status = String(payload.status ?? "queued").trim() || "queued";
        const resolvedJobId = String(payload.job_id ?? jobId).trim() || safeJobId;
        const asset = payload.asset ? normalizeAdsflowSegmentAiVideoAsset(resolvedJobId, payload.asset) : undefined;
        if (asset) {
            warmStudioGeneratedVideoPlayback("segment-ai-video", resolvedJobId, user);
            warmStudioGeneratedVideoPoster("segment-ai-video", resolvedJobId, user);
        }
        return {
            asset,
            error: normalizeGenerationText(payload.error) || undefined,
            jobId: resolvedJobId,
            profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
                rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
            }),
            status,
        };
    }
    catch (error) {
        if (isAdsflowHttpStatusError(error, 500)) {
            console.warn("[studio] Segment AI video status returned 500, probing file endpoint", {
                error: error instanceof Error ? error.message : "Unknown AdsFlow status error.",
                jobId: safeJobId,
            });
            return recoverStudioSegmentGeneratedVideoJobStatus("segment-ai-video", safeJobId, user, {
                fallbackError: "Генерация ИИ видео завершилась с ошибкой в AdsFlow. Попробуйте ещё раз.",
            });
        }
        throw error;
    }
}
export async function getStudioSegmentPhotoAnimationJobStatus(jobId, user) {
    const safeJobId = String(jobId ?? "").trim();
    try {
        const payload = await fetchAdsflowSegmentPhotoAnimationJobStatus(jobId, user);
        const status = String(payload.status ?? "queued").trim() || "queued";
        const resolvedJobId = String(payload.job_id ?? jobId).trim() || safeJobId;
        const asset = payload.asset ? normalizeAdsflowSegmentPhotoAnimationAsset(resolvedJobId, payload.asset) : undefined;
        if (asset) {
            warmStudioGeneratedVideoPlayback("segment-photo-animation", resolvedJobId, user);
            warmStudioGeneratedVideoPoster("segment-photo-animation", resolvedJobId, user);
        }
        return {
            asset,
            error: normalizeGenerationText(payload.error) || undefined,
            jobId: resolvedJobId,
            profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
                rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
            }),
            status,
        };
    }
    catch (error) {
        if (isAdsflowHttpStatusError(error, 500)) {
            console.warn("[studio] Segment photo animation status returned 500, probing file endpoint", {
                error: error instanceof Error ? error.message : "Unknown AdsFlow status error.",
                jobId: safeJobId,
            });
            return recoverStudioSegmentGeneratedVideoJobStatus("segment-photo-animation", safeJobId, user, {
                fallbackError: "Анимация фото завершилась с ошибкой в AdsFlow. Попробуйте ещё раз.",
            });
        }
        throw error;
    }
}
export async function getStudioGenerationStatus(jobId, user) {
    let payload;
    try {
        payload = await fetchAdsflowJobStatus(jobId, user);
    }
    catch (error) {
        const historyEntry = await getWorkspaceGenerationHistoryEntry(user, jobId).catch(() => null);
        if (historyEntry) {
            const historyStatus = buildStudioGenerationStatusFromHistoryEntry(historyEntry);
            if (historyStatus.generation) {
                warmStudioGenerationPlayback(historyStatus.generation, user);
            }
            console.warn("[studio] Falling back to local generation history status", {
                error: error instanceof Error ? error.message : "Unknown AdsFlow status error.",
                jobId: normalizeGenerationText(jobId),
                status: historyStatus.status,
            });
            return historyStatus;
        }
        throw error;
    }
    const status = String(payload.status ?? "queued");
    const safeJobId = String(payload.job_id ?? jobId).trim();
    const existingHistoryEntry = await getWorkspaceGenerationHistoryEntry(user, safeJobId).catch(() => null);
    const resolvedMetadata = resolveGenerationPresentation({
        description: payload.description ?? existingHistoryEntry?.description ?? "",
        fallbackTitle: "Готовое видео",
        hashtags: payload.hashtags ?? existingHistoryEntry?.hashtags ?? [],
        prompt: existingHistoryEntry?.prompt ?? payload.prompt ?? "",
        title: payload.title ?? existingHistoryEntry?.title ?? "",
    });
    try {
        await saveWorkspaceGenerationHistory(user, {
            adId: payload.ad_id ?? null,
            description: resolvedMetadata.description,
            downloadPath: payload.download_path ?? null,
            editedFromProjectAdId: existingHistoryEntry?.editedFromProjectAdId ?? null,
            error: payload.error ?? null,
            finalAssetId: payload.media_asset_id ?? existingHistoryEntry?.finalAssetId ?? null,
            finalAssetKind: "final_video",
            finalAssetStatus: status,
            generatedAt: payload.generated_at ?? null,
            hashtags: resolvedMetadata.hashtags,
            jobId: safeJobId,
            prompt: resolvedMetadata.prompt,
            status,
            title: resolvedMetadata.title,
            updatedAt: payload.generated_at ?? new Date().toISOString(),
            versionRootProjectAdId: existingHistoryEntry?.versionRootProjectAdId ?? null,
        });
    }
    catch (error) {
        console.error("[studio] Failed to sync generation history", error);
    }
    if (status === "done") {
        if (!payload.download_path) {
            throw new Error("AdsFlow finished the job without a video path.");
        }
        const generation = buildStudioGeneration(payload, {
            ...resolvedMetadata,
            historyEntry: existingHistoryEntry,
        });
        if (!generation) {
            console.warn("[studio] Done generation is missing playable preview metadata", {
                adId: payload.ad_id ?? null,
                downloadPath: payload.download_path ?? null,
                jobId: safeJobId,
                status,
            });
            return {
                jobId: safeJobId,
                status,
                error: "Готовое видео недоступно как прямой media-файл.",
            };
        }
        warmStudioGenerationPlayback(generation, user);
        return {
            jobId: safeJobId,
            status,
            generation,
        };
    }
    return {
        jobId: safeJobId,
        status,
        error: payload.error ?? undefined,
    };
}
export async function getLatestStudioGeneration(user) {
    return (await getWorkspaceBootstrap(user)).latestGeneration;
}
export function getStudioVideoProxyTargetByPath(value) {
    const normalized = normalizeGenerationText(value);
    if (!normalized) {
        throw new Error("Video path is required.");
    }
    if (!isPlayableStudioVideoPath(normalized)) {
        throw new Error("Video path is not a direct media file.");
    }
    return buildTrustedStudioVideoTarget(normalized);
}
const getStudioVideoProxyTargetFromWorkspaceHistory = async (jobId, user) => {
    const safeJobId = normalizeGenerationText(jobId);
    if (!safeJobId) {
        return null;
    }
    const historyEntries = await listWorkspaceGenerationHistory(user, 200);
    const historyEntry = historyEntries.find((entry) => normalizeGenerationText(entry.jobId) === safeJobId) ?? null;
    const downloadPath = normalizeGenerationText(historyEntry?.downloadPath);
    if (!downloadPath) {
        return null;
    }
    return buildTrustedStudioVideoTarget(downloadPath);
};
export async function getStudioVideoProxyTarget(jobId, user) {
    let fallbackError = null;
    try {
        const payload = await fetchAdsflowJobStatus(jobId, user);
        if (String(payload.status ?? "") !== "done") {
            throw new Error("Video is not ready yet.");
        }
        const downloadPath = String(payload.download_path ?? "").trim();
        if (!downloadPath) {
            throw new Error("AdsFlow did not return a download path.");
        }
        return buildTrustedStudioVideoTarget(downloadPath);
    }
    catch (error) {
        fallbackError = error instanceof Error ? error : new Error("Failed to resolve generated video.");
    }
    try {
        const fallbackTarget = await getStudioVideoProxyTargetFromWorkspaceHistory(jobId, user);
        if (fallbackTarget) {
            return fallbackTarget;
        }
    }
    catch (error) {
        console.error("[studio] Failed to resolve generated video from workspace history", error);
    }
    throw fallbackError ?? new Error("Failed to resolve generated video.");
}
const getCachedWorkspaceProfileForUser = async (user) => {
    const externalUserId = await resolveStudioExternalUserId(user);
    return getCachedWorkspaceBootstrap(externalUserId)?.profile ?? buildWorkspaceProfile();
};
const probeStudioGeneratedVideoFileAvailability = async (kind, jobId, user) => {
    try {
        const upstreamUrl = kind === "segment-ai-video"
            ? await getStudioSegmentAiVideoJobFileProxyTarget(jobId, user)
            : await getStudioSegmentPhotoAnimationJobFileProxyTarget(jobId, user);
        const response = await fetchAdsflowResponse(upstreamUrl, {
            headers: {
                connection: "close",
                range: "bytes=0-0",
            },
        }, {
            retryDelaysMs: [],
            timeoutMs: 15_000,
        });
        if ("cancel" in (response.body ?? {})) {
            void response.body.cancel().catch(() => undefined);
        }
        return response.ok;
    }
    catch {
        return false;
    }
};
const recoverStudioSegmentGeneratedVideoJobStatus = async (kind, jobId, user, options) => {
    const safeJobId = String(jobId ?? "").trim();
    const profile = await getCachedWorkspaceProfileForUser(user);
    const isFileAvailable = await probeStudioGeneratedVideoFileAvailability(kind, safeJobId, user);
    if (isFileAvailable) {
        const asset = kind === "segment-ai-video"
            ? normalizeAdsflowSegmentAiVideoAsset(safeJobId)
            : normalizeAdsflowSegmentPhotoAnimationAsset(safeJobId);
        warmStudioGeneratedVideoPlayback(kind, safeJobId, user);
        warmStudioGeneratedVideoPoster(kind, safeJobId, user);
        return {
            asset,
            jobId: safeJobId,
            profile,
            status: "ready",
        };
    }
    return {
        error: options.fallbackError,
        jobId: safeJobId,
        profile,
        status: "failed",
    };
};
export async function getStudioSegmentAiVideoJobFileProxyTarget(jobId, user) {
    assertAdsflowConfigured();
    const safeJobId = normalizeGenerationText(jobId);
    if (!safeJobId) {
        throw new Error("Job id is required.");
    }
    const externalUserId = await resolveStudioExternalUserId(user);
    return buildAdsflowUrl(`/api/web/segment-ai-video/jobs/${encodeURIComponent(safeJobId)}/file`, {
        admin_token: env.adsflowAdminToken ?? "",
        external_user_id: externalUserId,
    });
}
export async function getStudioSegmentPhotoAnimationJobFileProxyTarget(jobId, user) {
    assertAdsflowConfigured();
    const safeJobId = String(jobId ?? "").trim();
    if (!safeJobId) {
        throw new Error("Job id is required.");
    }
    const externalUserId = await resolveStudioExternalUserId(user);
    return buildAdsflowUrl(`/api/web/segment-photo-animation/jobs/${encodeURIComponent(safeJobId)}/file`, {
        admin_token: env.adsflowAdminToken ?? "",
        external_user_id: externalUserId,
    });
}
const getStudioGeneratedVideoPlaybackSource = async (kind, jobId, user) => {
    const safeJobId = normalizeGenerationText(jobId);
    if (!safeJobId) {
        throw new Error("Job id is required.");
    }
    const upstreamUrl = kind === "segment-ai-video"
        ? await getStudioSegmentAiVideoJobFileProxyTarget(safeJobId, user)
        : await getStudioSegmentPhotoAnimationJobFileProxyTarget(safeJobId, user);
    return {
        cacheKey: getWorkspaceProjectPlaybackCacheKey({
            projectId: `${kind}:${safeJobId}`,
            targetUrl: upstreamUrl,
            updatedAt: safeJobId,
        }),
        projectId: `${kind}:${safeJobId}`,
        upstreamUrl,
    };
};
const warmStudioGeneratedVideoPlayback = (kind, jobId, user) => {
    void getStudioGeneratedVideoPlaybackSource(kind, jobId, user)
        .then((playbackSource) => warmWorkspaceProjectPlayback(playbackSource))
        .catch((error) => {
        const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
        if (message.includes("the operation was aborted due to timeout") ||
            message.includes("timed out") ||
            message.includes("timeout")) {
            return;
        }
        console.warn("[studio] Failed to warm generated segment video playback cache", {
            error: error instanceof Error ? error.message : "Unknown generated segment video playback warmup error.",
            jobId,
            kind,
        });
    });
};
const getStudioGeneratedVideoPlaybackAsset = async (kind, jobId, user) => {
    return ensureWorkspaceProjectPlayback(await getStudioGeneratedVideoPlaybackSource(kind, jobId, user));
};
const getStudioGeneratedVideoPosterSource = async (kind, jobId, user) => {
    const safeJobId = normalizeGenerationText(jobId);
    if (!safeJobId) {
        throw new Error("Job id is required.");
    }
    const upstreamUrl = kind === "segment-ai-video"
        ? await getStudioSegmentAiVideoJobFileProxyTarget(safeJobId, user)
        : await getStudioSegmentPhotoAnimationJobFileProxyTarget(safeJobId, user);
    return {
        cacheKey: getWorkspaceVideoPosterCacheKey({
            posterId: `${kind}:${safeJobId}`,
            targetUrl: upstreamUrl,
            version: safeJobId,
        }),
        posterId: `${kind}:${safeJobId}`,
        upstreamUrl,
    };
};
const warmStudioGeneratedVideoPoster = (kind, jobId, user) => {
    void getStudioGeneratedVideoPosterSource(kind, jobId, user)
        .then((posterSource) => warmWorkspaceVideoPoster(posterSource))
        .catch((error) => {
        const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
        if (message.includes("the operation was aborted due to timeout") ||
            message.includes("timed out") ||
            message.includes("timeout")) {
            return;
        }
        console.warn("[studio] Failed to warm generated video poster", {
            error: error instanceof Error ? error.message : "Unknown generated video poster warmup error.",
            jobId,
            kind,
        });
    });
};
export async function getStudioSegmentAiVideoJobPosterPath(jobId, user) {
    return ensureWorkspaceVideoPoster(await getStudioGeneratedVideoPosterSource("segment-ai-video", jobId, user));
}
export async function getStudioSegmentPhotoAnimationJobPosterPath(jobId, user) {
    return ensureWorkspaceVideoPoster(await getStudioGeneratedVideoPosterSource("segment-photo-animation", jobId, user));
}
export async function getStudioSegmentAiVideoPlaybackAsset(jobId, user) {
    return getStudioGeneratedVideoPlaybackAsset("segment-ai-video", jobId, user);
}
export async function getStudioSegmentPhotoAnimationPlaybackAsset(jobId, user) {
    return getStudioGeneratedVideoPlaybackAsset("segment-photo-animation", jobId, user);
}
const getStudioPlaybackSource = async (options, user) => {
    const safeJobId = normalizeGenerationText(options.jobId);
    if (!safeJobId) {
        throw new Error("Studio job id is required.");
    }
    const upstreamUrl = options.preferredPath
        ? getStudioVideoProxyTargetByPath(options.preferredPath)
        : await getStudioVideoProxyTarget(safeJobId, user);
    return {
        cacheKey: getWorkspaceProjectPlaybackCacheKey({
            projectId: `studio:${safeJobId}`,
            targetUrl: upstreamUrl,
            updatedAt: normalizeGenerationText(options.version) || safeJobId,
        }),
        projectId: `studio:${safeJobId}`,
        upstreamUrl,
    };
};
async function getStudioGenerationPlaybackSource(generation, user) {
    const safeJobId = normalizeGenerationText(generation.id);
    if (!safeJobId || !generation.videoUrl || !isStudioPlaybackUrl(generation.videoUrl)) {
        throw new Error("Studio generation playback source is unavailable.");
    }
    const preferredPath = extractStudioVideoPathFromProxyUrl(generation.videoFallbackUrl ?? generation.videoUrl);
    return getStudioPlaybackSource({
        jobId: safeJobId,
        preferredPath,
        version: generation.generatedAt,
    }, user);
}
async function prepareStudioLatestGenerationForBootstrap(latestGeneration, user) {
    if (!latestGeneration?.generation || latestGeneration.status !== "done") {
        return latestGeneration;
    }
    warmStudioGenerationPlayback(latestGeneration.generation, user);
    return latestGeneration;
}
const warmStudioGenerationPlayback = (generation, user) => {
    const safeJobId = normalizeGenerationText(generation?.id);
    if (!safeJobId || !generation?.videoUrl || !isStudioPlaybackUrl(generation.videoUrl)) {
        return;
    }
    const preferredPath = extractStudioVideoPathFromProxyUrl(generation.videoFallbackUrl ?? generation.videoUrl);
    void getStudioPlaybackSource({
        jobId: safeJobId,
        preferredPath,
        version: generation.generatedAt,
    }, user)
        .then((playbackSource) => warmWorkspaceProjectPlayback(playbackSource))
        .catch((error) => {
        const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
        if (message.includes("the operation was aborted due to timeout") ||
            message.includes("timed out") ||
            message.includes("timeout")) {
            return;
        }
        console.warn("[studio] Failed to warm studio playback cache", {
            error: error instanceof Error ? error.message : "Unknown studio playback warmup error.",
            jobId: safeJobId,
        });
    });
};
export async function getStudioPlaybackAsset(jobId, user, options) {
    const playbackSource = await getStudioPlaybackSource({
        jobId,
        preferredPath: options?.preferredPath,
        version: options?.version,
    }, user);
    return ensureWorkspaceProjectPlayback(playbackSource);
}
