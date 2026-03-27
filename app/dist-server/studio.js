import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
import { saveWorkspaceGenerationHistory } from "./workspace-history.js";
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
const buildStudioVideoProxyUrl = (value) => {
    const normalized = normalizeGenerationText(value);
    if (!normalized) {
        throw new Error("AdsFlow did not return a download path.");
    }
    const upstreamUrl = buildAdsflowUrl(normalized);
    const proxyUrl = new URL("/api/studio/video", env.appUrl);
    proxyUrl.searchParams.set("path", upstreamUrl.toString());
    return `${proxyUrl.pathname}${proxyUrl.search}`;
};
const buildWorkspaceProfile = (payload) => ({
    balance: Math.max(0, Number(payload?.balance ?? 0)),
    expiresAt: normalizeGenerationText(payload?.subscription_expires_at) || null,
    plan: String(payload?.plan ?? "FREE").trim().toUpperCase() || "FREE",
});
const fetchAdsflowSubscriptionExpiry = async (userId) => {
    const normalizedUserId = Number(userId);
    if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
        return null;
    }
    const payload = await fetchAdsflowJson(buildAdsflowUrl(`/api/admin/users/${encodeURIComponent(String(Math.trunc(normalizedUserId)))}`), {
        headers: {
            "X-Admin-Token": env.adsflowAdminToken ?? "",
        },
    });
    const directExpiry = normalizeGenerationText(payload.user?.subscription_expires_at) || null;
    if (directExpiry) {
        return directExpiry;
    }
    const currentPlan = String(payload.user?.subscription_type ?? "").trim().toLowerCase();
    const planDurationDays = currentPlan === "start" ? 30 : currentPlan === "pro" ? 30 : currentPlan === "ultra" ? 30 : 0;
    if (!planDurationDays || !Array.isArray(payload.payments)) {
        return null;
    }
    const latestSuccessfulPayment = payload.payments
        .filter((payment) => String(payment?.status ?? "").trim().toLowerCase() === "succeeded")
        .filter((payment) => String(payment?.plan_code ?? "").trim().toLowerCase() === currentPlan)
        .map((payment) => {
        const paidAt = normalizeGenerationText(payment.paid_at);
        const parsedPaidAt = paidAt ? new Date(paidAt) : null;
        return Number.isNaN(parsedPaidAt?.getTime?.() ?? Number.NaN) ? null : parsedPaidAt;
    })
        .filter((value) => value instanceof Date)
        .sort((left, right) => right.getTime() - left.getTime())[0];
    if (!latestSuccessfulPayment) {
        return null;
    }
    const derivedExpiry = new Date(latestSuccessfulPayment.getTime());
    derivedExpiry.setUTCDate(derivedExpiry.getUTCDate() + planDurationDays);
    return derivedExpiry.toISOString();
};
const enrichWorkspaceProfile = async (payload) => {
    const profile = buildWorkspaceProfile(payload);
    if (profile.plan === "FREE" || profile.expiresAt) {
        return profile;
    }
    try {
        const expiresAt = await fetchAdsflowSubscriptionExpiry(payload?.user_id);
        return {
            ...profile,
            expiresAt,
        };
    }
    catch (error) {
        console.error("[studio] Failed to enrich workspace profile with expiry", error);
        return profile;
    }
};
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
        videoUrl: buildStudioVideoProxyUrl(payload.download_path),
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
        videoUrl: buildStudioVideoProxyUrl(payload.download_path),
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
        profile: await enrichWorkspaceProfile(payload.user),
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
    return await enrichWorkspaceProfile(payload.user);
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
    const profile = await enrichWorkspaceProfile(payload.user);
    if (payload.latest_generation?.job_id) {
        try {
            await saveWorkspaceGenerationHistory(user, {
                adId: payload.latest_generation.ad_id ?? null,
                description: payload.latest_generation.description ?? payload.latest_generation.prompt ?? "",
                downloadPath: payload.latest_generation.download_path ?? null,
                error: payload.latest_generation.error ?? null,
                generatedAt: payload.latest_generation.generated_at ?? null,
                jobId: payload.latest_generation.job_id,
                prompt: payload.latest_generation.prompt ?? "",
                status: payload.latest_generation.status ?? "queued",
                title: payload.latest_generation.title ?? payload.latest_generation.prompt ?? "",
                updatedAt: payload.latest_generation.generated_at ?? new Date().toISOString(),
            });
        }
        catch (error) {
            console.error("[studio] Failed to sync workspace history from bootstrap", error);
        }
    }
    return {
        latestGeneration: buildLatestGenerationStatus(payload.latest_generation),
        profile,
    };
}
export async function createStudioGenerationJob(prompt, user, options) {
    assertAdsflowConfigured();
    const normalizedPrompt = normalizePrompt(prompt);
    if (!normalizedPrompt) {
        throw new Error("Prompt is required.");
    }
    const creditReservation = await consumeWorkspaceGenerationCredit(user);
    const externalUserId = await resolveStudioExternalUserId(user);
    const shouldAddWatermark = creditReservation.profile.plan === "FREE" &&
        creditReservation.consumed.subscription > 0 &&
        creditReservation.consumed.purchased <= 0;
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
                add_watermark: shouldAddWatermark,
                credit_cost: 0,
                is_regeneration: Boolean(options?.isRegeneration),
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
        try {
            await saveWorkspaceGenerationHistory(user, {
                description: normalizedPrompt,
                jobId,
                prompt: normalizedPrompt,
                status: String(payload.status ?? "queued"),
                title: normalizeGenerationText(payload.title) || normalizedPrompt,
            });
        }
        catch (error) {
            console.error("[studio] Failed to persist queued generation", error);
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
    try {
        await saveWorkspaceGenerationHistory(user, {
            adId: payload.ad_id ?? null,
            description: payload.description ?? payload.prompt ?? "",
            downloadPath: payload.download_path ?? null,
            error: payload.error ?? null,
            generatedAt: payload.generated_at ?? null,
            jobId: safeJobId,
            prompt: payload.prompt ?? "",
            status,
            title: payload.title ?? payload.prompt ?? "",
            updatedAt: payload.generated_at ?? new Date().toISOString(),
        });
    }
    catch (error) {
        console.error("[studio] Failed to sync generation history", error);
    }
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
export function getStudioVideoProxyTargetByPath(value) {
    const normalized = normalizeGenerationText(value);
    if (!normalized) {
        throw new Error("Video path is required.");
    }
    const upstreamUrl = buildAdsflowUrl(normalized);
    const adsflowBaseUrl = new URL(env.adsflowApiBaseUrl);
    if (upstreamUrl.origin === adsflowBaseUrl.origin) {
        upstreamUrl.searchParams.set("admin_token", env.adsflowAdminToken ?? "");
    }
    return upstreamUrl;
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
