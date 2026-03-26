import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
export class WorkspaceCreditLimitError extends Error {
    constructor(message = "На тарифе FREE доступна 1 бесплатная генерация. Обновите тариф, чтобы продолжить.") {
        super(message);
        this.name = "WorkspaceCreditLimitError";
    }
}
const normalizePrompt = (value) => value.replace(/\s+/g, " ").trim();
const normalizeGenerationText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const parseGenerationHashtags = (value) => {
    const rawValue = normalizeGenerationText(value);
    if (!rawValue)
        return [];
    const explicitTags = rawValue.match(/#[^\s#]+/g);
    if (explicitTags?.length) {
        return Array.from(new Set(explicitTags));
    }
    return Array.from(new Set(rawValue
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => `#${item.replace(/^#+/, "")}`)));
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
const buildAdsflowUrl = (path, params) => {
    const url = new URL(path, env.adsflowApiBaseUrl);
    Object.entries(params ?? {}).forEach(([key, value]) => {
        if (value)
            url.searchParams.set(key, value);
    });
    return url;
};
const buildWorkspaceProfile = (payload) => ({
    balance: Math.max(0, Number(payload?.balance ?? 1)),
    plan: String(payload?.plan ?? "FREE").trim().toUpperCase() || "FREE",
});
const buildStudioGeneration = (payload) => {
    const prompt = normalizePrompt(payload.prompt ?? "");
    const jobId = String(payload.job_id ?? "");
    const description = normalizeGenerationText(payload.description);
    const hashtags = parseGenerationHashtags(payload.hashtags);
    const title = normalizeGenerationText(payload.title);
    return {
        id: jobId,
        prompt,
        title,
        description,
        hashtags,
        videoUrl: `/api/studio/video/${encodeURIComponent(jobId)}`,
        durationLabel: "Ready",
        modelLabel: "AdsFlow pipeline",
        aspectRatio: "9:16",
        generatedAt: payload.generated_at ?? new Date().toISOString(),
    };
};
const buildStudioGenerationFromLatest = (payload) => {
    const prompt = normalizePrompt(payload.prompt ?? "");
    const jobId = String(payload.job_id ?? "");
    const description = normalizeGenerationText(payload.description);
    const hashtags = parseGenerationHashtags(payload.hashtags);
    const title = normalizeGenerationText(payload.title);
    return {
        id: jobId,
        prompt,
        title,
        description,
        hashtags,
        videoUrl: `/api/studio/video/${encodeURIComponent(jobId)}`,
        durationLabel: "Ready",
        modelLabel: "AdsFlow pipeline",
        aspectRatio: "9:16",
        generatedAt: payload.generated_at ?? new Date().toISOString(),
    };
};
const buildLatestGenerationStatus = (payload) => {
    if (!payload?.job_id) {
        return null;
    }
    const status = String(payload.status ?? "queued");
    const generationReady = status === "done" && Boolean(String(payload.download_path ?? "").trim());
    return {
        error: payload.error ?? undefined,
        generation: generationReady ? buildStudioGenerationFromLatest(payload) : undefined,
        jobId: String(payload.job_id),
        status,
    };
};
const fetchAdsflowJson = async (url, init) => {
    const response = await fetch(url, init);
    const payload = (await response.json().catch(() => null));
    if (!response.ok) {
        const detail = payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
            ? payload.detail
            : `AdsFlow request failed (${response.status}).`;
        if (response.status === 402) {
            throw new WorkspaceCreditLimitError(detail);
        }
        throw new Error(detail);
    }
    if (!payload) {
        throw new Error("AdsFlow returned an empty response.");
    }
    return payload;
};
const postAdsflowJson = async (path, body) => {
    assertAdsflowConfigured();
    return fetchAdsflowJson(buildAdsflowUrl(path), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
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
const consumeWorkspaceGenerationCredit = async (user, amount = 1) => {
    const externalUserId = await resolveStudioExternalUserId(user);
    const payload = await postAdsflowJson("/api/web/credits/consume", {
        admin_token: env.adsflowAdminToken,
        amount: Math.max(1, Math.trunc(amount || 1)),
        external_user_id: externalUserId,
        language: "ru",
        referral_source: "landing_site",
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
    });
    if (!payload.user || !payload.consumed) {
        throw new Error("AdsFlow did not return consumed web credits.");
    }
    return {
        consumed: {
            purchased: Math.max(0, Number(payload.consumed.purchased ?? 0)),
            subscription: Math.max(0, Number(payload.consumed.subscription ?? 0)),
        },
        profile: buildWorkspaceProfile(payload.user),
    };
};
const refundWorkspaceGenerationCredit = async (user, consumed) => {
    if (consumed.purchased <= 0 && consumed.subscription <= 0) {
        return buildWorkspaceProfile();
    }
    const externalUserId = await resolveStudioExternalUserId(user);
    const payload = await postAdsflowJson("/api/web/credits/refund", {
        admin_token: env.adsflowAdminToken,
        consumed_purchased: Math.max(0, Math.trunc(consumed.purchased || 0)),
        consumed_subscription: Math.max(0, Math.trunc(consumed.subscription || 0)),
        external_user_id: externalUserId,
        language: "ru",
        referral_source: "landing_site",
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
    });
    if (!payload.user) {
        throw new Error("AdsFlow did not return refunded web profile.");
    }
    return buildWorkspaceProfile(payload.user);
};
export async function getWorkspaceBootstrap(user) {
    const externalUserId = await resolveStudioExternalUserId(user);
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
    return {
        latestGeneration: buildLatestGenerationStatus(payload.latest_generation),
        profile: buildWorkspaceProfile(payload.user),
    };
}
export async function createStudioGenerationJob(prompt, user) {
    assertAdsflowConfigured();
    const normalizedPrompt = normalizePrompt(prompt);
    if (!normalizedPrompt) {
        throw new Error("Prompt is required.");
    }
    const creditReservation = await consumeWorkspaceGenerationCredit(user);
    const externalUserId = await resolveStudioExternalUserId(user);
    let jobCreated = false;
    try {
        const payload = await fetchAdsflowJson(buildAdsflowUrl("/api/web/generations"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                admin_token: env.adsflowAdminToken,
                external_user_id: externalUserId,
                prompt: normalizedPrompt,
                user_email: user.email ?? undefined,
                user_name: user.name ?? undefined,
                language: "ru",
                credit_cost: 0,
            }),
        });
        const jobId = String(payload.job_id ?? "").trim();
        if (!jobId) {
            throw new Error("AdsFlow did not return a job id.");
        }
        jobCreated = true;
        if (payload.enqueue_error) {
            console.warn("[studio] AdsFlow enqueue warning:", payload.enqueue_error);
        }
        return {
            jobId,
            profile: creditReservation.profile,
            status: String(payload.status ?? "queued"),
            title: normalizeGenerationText(payload.title) || "Studio generation",
        };
    }
    catch (error) {
        if (!jobCreated) {
            try {
                await refundWorkspaceGenerationCredit(user, creditReservation.consumed);
            }
            catch (refundError) {
                console.error("[studio] Failed to refund reserved credits", refundError);
            }
        }
        throw error;
    }
}
export async function getStudioGenerationStatus(jobId, user) {
    const payload = await fetchAdsflowJobStatus(jobId, user);
    const status = String(payload.status ?? "queued");
    const safeJobId = String(payload.job_id ?? jobId).trim();
    if (status === "done") {
        if (!payload.download_path) {
            throw new Error("AdsFlow finished the job without a video path.");
        }
        return {
            jobId: safeJobId,
            status,
            generation: buildStudioGeneration(payload),
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
export async function getStudioVideoProxyTarget(jobId, user) {
    const payload = await fetchAdsflowJobStatus(jobId, user);
    if (String(payload.status ?? "") !== "done") {
        throw new Error("Video is not ready yet.");
    }
    const downloadPath = String(payload.download_path ?? "").trim();
    if (!downloadPath) {
        throw new Error("AdsFlow did not return a download path.");
    }
    return buildAdsflowUrl(downloadPath, {
        admin_token: env.adsflowAdminToken ?? "",
    });
}
