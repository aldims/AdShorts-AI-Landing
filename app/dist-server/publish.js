import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
const ADSFLOW_FETCH_RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 502, 503, 504]);
const ADSFLOW_FETCH_RETRY_DELAYS_MS = [250, 700];
const ADSFLOW_FETCH_TIMEOUT_MS = 20_000;
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const assertAdsflowConfigured = () => {
    if (!env.adsflowApiBaseUrl || !env.adsflowAdminToken) {
        throw new Error("AdsFlow API is not configured.");
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
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
const fetchAdsflowResponse = async (url, init) => {
    let lastError = null;
    for (let attempt = 0; attempt <= ADSFLOW_FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
        try {
            const response = await fetch(url, {
                ...init,
                signal: AbortSignal.timeout(ADSFLOW_FETCH_TIMEOUT_MS),
            });
            if (!ADSFLOW_FETCH_RETRYABLE_STATUS_CODES.has(response.status) || attempt === ADSFLOW_FETCH_RETRY_DELAYS_MS.length) {
                return response;
            }
        }
        catch (error) {
            lastError = error;
            if (attempt === ADSFLOW_FETCH_RETRY_DELAYS_MS.length) {
                throw new Error(describeAdsflowFetchFailure(url, error));
            }
        }
        await wait(ADSFLOW_FETCH_RETRY_DELAYS_MS[attempt] ?? 0);
    }
    throw new Error(lastError ? describeAdsflowFetchFailure(url, lastError) : `AdsFlow unavailable for ${url.origin}${url.pathname}.`);
};
const fetchAdsflowJson = async (url, init) => {
    const response = await fetchAdsflowResponse(url, init);
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
    assertAdsflowConfigured();
    return fetchAdsflowJson(buildAdsflowUrl(path), {
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
const normalizePublication = (value) => {
    if (!value || typeof value !== "object")
        return null;
    const channelPkRaw = value.channel_pk;
    const channelPk = typeof channelPkRaw === "number" && Number.isFinite(channelPkRaw)
        ? channelPkRaw
        : typeof channelPkRaw === "string" && /^\d+$/.test(channelPkRaw)
            ? Number(channelPkRaw)
            : null;
    const normalized = {
        channelName: normalizeText(value.channel_name) || null,
        channelPk,
        link: normalizeText(value.link) || null,
        publishedAt: normalizeText(value.published_at) || null,
        scheduledAt: normalizeText(value.scheduled_at) || null,
        state: normalizeText(value.state).toLowerCase() || null,
        youtubeVideoId: normalizeText(value.youtube_video_id) || null,
    };
    return normalized.link ||
        normalized.youtubeVideoId ||
        normalized.state ||
        normalized.publishedAt ||
        normalized.scheduledAt ||
        normalized.channelName
        ? normalized
        : null;
};
export async function getWorkspacePublishBootstrap(user, videoProjectId) {
    const externalUserId = await resolvePreferredExternalUserId(user);
    const payload = await postAdsflowJson("/api/web/publish/bootstrap", {
        admin_token: env.adsflowAdminToken,
        external_user_id: externalUserId,
        language: "ru",
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
        video_project_id: videoProjectId,
    });
    const normalizedVideoProjectId = Number(payload.video_project_id ?? videoProjectId);
    if (!Number.isFinite(normalizedVideoProjectId) || normalizedVideoProjectId <= 0) {
        throw new Error("AdsFlow did not return a valid video project id.");
    }
    const channels = Array.isArray(payload.channels)
        ? payload.channels
            .map((channel) => {
            const pk = Number(channel?.pk ?? 0);
            if (!Number.isFinite(pk) || pk <= 0)
                return null;
            return {
                channelId: normalizeText(channel?.channel_id) || null,
                channelName: normalizeText(channel?.channel_name) || "YouTube",
                pk,
            };
        })
            .filter((channel) => Boolean(channel))
        : [];
    const selectedChannelPkRaw = Number(payload.selected_channel_pk ?? 0);
    const selectedChannelPk = Number.isFinite(selectedChannelPkRaw) && selectedChannelPkRaw > 0 ? selectedChannelPkRaw : null;
    return {
        channels,
        defaults: {
            description: normalizeText(payload.defaults?.description),
            hashtags: normalizeText(payload.defaults?.hashtags),
            publishAt: normalizeText(payload.defaults?.publish_at) || null,
            title: normalizeText(payload.defaults?.title) || "Shorts",
        },
        publication: normalizePublication(payload.publication),
        selectedChannelPk,
        videoProjectId: normalizedVideoProjectId,
    };
}
export async function getWorkspaceYoutubeConnectUrl(user, options) {
    const externalUserId = await resolvePreferredExternalUserId(user);
    const returnTo = new URL("/app/studio", env.appUrl);
    const normalizedVideoProjectId = Number(options?.videoProjectId ?? 0);
    if (Number.isFinite(normalizedVideoProjectId) && normalizedVideoProjectId > 0) {
        returnTo.searchParams.set("publish", String(normalizedVideoProjectId));
    }
    const payload = await postAdsflowJson("/api/web/youtube/connect-url", {
        admin_token: env.adsflowAdminToken,
        external_user_id: externalUserId,
        language: "ru",
        return_to: returnTo.toString(),
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
        video_project_id: Number.isFinite(normalizedVideoProjectId) && normalizedVideoProjectId > 0 ? normalizedVideoProjectId : undefined,
    });
    const url = normalizeText(payload.url);
    if (!url) {
        throw new Error("AdsFlow did not return YouTube connect url.");
    }
    return url;
}
export async function disconnectWorkspaceYoutubeChannel(user, options) {
    const externalUserId = await resolvePreferredExternalUserId(user);
    const payload = await postAdsflowJson("/api/web/youtube/disconnect", {
        admin_token: env.adsflowAdminToken,
        channel_pk: options.channelPk,
        external_user_id: externalUserId,
        language: "ru",
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
        video_project_id: options.videoProjectId,
    });
    const normalizedVideoProjectId = Number(payload.video_project_id ?? options.videoProjectId);
    if (!Number.isFinite(normalizedVideoProjectId) || normalizedVideoProjectId <= 0) {
        throw new Error("AdsFlow did not return a valid video project id.");
    }
    const channels = Array.isArray(payload.channels)
        ? payload.channels
            .map((channel) => {
            const pk = Number(channel?.pk ?? 0);
            if (!Number.isFinite(pk) || pk <= 0)
                return null;
            return {
                channelId: normalizeText(channel?.channel_id) || null,
                channelName: normalizeText(channel?.channel_name) || "YouTube",
                pk,
            };
        })
            .filter((channel) => Boolean(channel))
        : [];
    const selectedChannelPkRaw = Number(payload.selected_channel_pk ?? 0);
    const selectedChannelPk = Number.isFinite(selectedChannelPkRaw) && selectedChannelPkRaw > 0 ? selectedChannelPkRaw : null;
    return {
        channels,
        defaults: {
            description: normalizeText(payload.defaults?.description),
            hashtags: normalizeText(payload.defaults?.hashtags),
            publishAt: normalizeText(payload.defaults?.publish_at) || null,
            title: normalizeText(payload.defaults?.title) || "Shorts",
        },
        publication: normalizePublication(payload.publication),
        selectedChannelPk,
        videoProjectId: normalizedVideoProjectId,
    };
}
export async function startWorkspaceYoutubePublish(user, options) {
    const externalUserId = await resolvePreferredExternalUserId(user);
    const payload = await postAdsflowJson("/api/web/publish/youtube", {
        admin_token: env.adsflowAdminToken,
        channel_pk: options.channelPk,
        description: options.description,
        external_user_id: externalUserId,
        hashtags: options.hashtags,
        language: "ru",
        publish_at: options.publishAt || undefined,
        title: options.title,
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
        video_project_id: options.videoProjectId,
    });
    const jobId = normalizeText(payload.job_id);
    if (!jobId) {
        throw new Error("AdsFlow did not return a publish job id.");
    }
    return {
        enqueueError: normalizeText(payload.enqueue_error) || null,
        jobId,
        status: normalizeText(payload.status) || "queued",
        videoProjectId: Number(payload.video_project_id ?? options.videoProjectId) || options.videoProjectId,
    };
}
export async function getWorkspacePublishJobStatus(user, jobId) {
    const externalUserId = await resolvePreferredExternalUserId(user);
    const payload = await fetchAdsflowJson(buildAdsflowUrl(`/api/web/publish/jobs/${encodeURIComponent(jobId)}`, {
        admin_token: env.adsflowAdminToken ?? "",
        external_user_id: externalUserId,
    }));
    return {
        error: normalizeText(payload.error) || undefined,
        jobId: normalizeText(payload.job_id) || jobId,
        publication: normalizePublication(payload.publication),
        status: normalizeText(payload.status) || "queued",
        videoProjectId: Number(payload.video_project_id ?? 0) || null,
    };
}
