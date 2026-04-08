import { env } from "./env.js";
import { logServerEvent } from "./logger.js";
export class UpstreamHttpError extends Error {
    responseText;
    statusCode;
    target;
    constructor(message, options) {
        super(message);
        this.name = "UpstreamHttpError";
        this.responseText = options.responseText ?? "";
        this.statusCode = options.statusCode;
        this.target = options.target;
    }
}
export class UpstreamFetchError extends Error {
    code;
    isTimeout;
    target;
    constructor(message, options) {
        super(message);
        this.name = "UpstreamFetchError";
        this.code = options.code ?? null;
        this.isTimeout = Boolean(options.isTimeout);
        this.target = options.target;
    }
}
const DEFAULT_RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
export const upstreamPolicies = {
    adsflowBootstrap: {
        name: "adsflow-bootstrap",
        retryDelaysMs: [160],
        retryableStatusCodes: DEFAULT_RETRYABLE_STATUS_CODES,
        timeoutMs: env.upstreamBootstrapTimeoutMs,
    },
    adsflowMetadata: {
        name: "adsflow-metadata",
        retryDelaysMs: [180, 420],
        retryableStatusCodes: DEFAULT_RETRYABLE_STATUS_CODES,
        timeoutMs: env.upstreamProjectsTimeoutMs,
    },
    adsflowMutation: {
        name: "adsflow-mutation",
        retryDelaysMs: [],
        retryableStatusCodes: DEFAULT_RETRYABLE_STATUS_CODES,
        timeoutMs: 90_000,
    },
    proxyInteractive: {
        name: "proxy-interactive",
        retryDelaysMs: [120],
        retryableStatusCodes: new Set([408, 425, 429, 502, 503, 504]),
        timeoutMs: env.upstreamProxyTimeoutMs,
    },
    reachabilityProbe: {
        name: "reachability-probe",
        retryDelaysMs: [],
        retryableStatusCodes: DEFAULT_RETRYABLE_STATUS_CODES,
        timeoutMs: env.upstreamProbeTimeoutMs,
    },
    playbackPreparation: {
        name: "playback-preparation",
        retryDelaysMs: [250],
        retryableStatusCodes: DEFAULT_RETRYABLE_STATUS_CODES,
        timeoutMs: env.upstreamPlaybackPreparationTimeoutMs,
    },
    previewPreparation: {
        name: "preview-preparation",
        retryDelaysMs: [180],
        retryableStatusCodes: DEFAULT_RETRYABLE_STATUS_CODES,
        timeoutMs: env.upstreamPlaybackPreparationTimeoutMs,
    },
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const buildUpstreamTarget = (url) => `${url.origin}${url.pathname}`;
const getErrorCode = (error) => {
    if (!error || typeof error !== "object") {
        return "";
    }
    if ("code" in error && typeof error.code === "string") {
        return error.code;
    }
    if ("cause" in error) {
        return getErrorCode(error.cause);
    }
    return "";
};
const getErrorMessage = (error) => {
    if (error instanceof Error) {
        return normalizeText(error.message);
    }
    return normalizeText(error);
};
const isAbortLikeError = (error) => {
    const message = getErrorMessage(error).toLowerCase();
    const code = getErrorCode(error).toUpperCase();
    return (error instanceof DOMException &&
        (error.name === "AbortError" || error.name === "TimeoutError") ||
        code === "ABORT_ERR" ||
        code === "ETIMEDOUT" ||
        code === "UND_ERR_CONNECT_TIMEOUT" ||
        code === "UND_ERR_HEADERS_TIMEOUT" ||
        message.includes("timeout") ||
        message.includes("aborted"));
};
const combineAbortSignals = (signals) => {
    const activeSignals = signals.filter((signal) => Boolean(signal));
    if (activeSignals.length === 0) {
        return undefined;
    }
    if (activeSignals.length === 1) {
        return activeSignals[0];
    }
    const controller = new AbortController();
    const abort = (reason) => {
        if (!controller.signal.aborted) {
            controller.abort(reason);
        }
    };
    activeSignals.forEach((signal) => {
        if (signal.aborted) {
            abort(signal.reason);
            return;
        }
        signal.addEventListener("abort", () => abort(signal.reason), { once: true });
    });
    return controller.signal;
};
export const assertAdsflowConfigured = () => {
    if (!env.adsflowApiBaseUrl || !env.adsflowAdminToken) {
        throw new Error("AdsFlow API is not configured.");
    }
};
export const buildAdsflowUrl = (path, params) => {
    assertAdsflowConfigured();
    const url = new URL(path, env.adsflowApiBaseUrl);
    Object.entries(params ?? {}).forEach(([key, value]) => {
        const normalizedValue = normalizeText(value);
        if (normalizedValue) {
            url.searchParams.set(key, normalizedValue);
        }
    });
    return url;
};
export const extractUpstreamErrorDetail = (payload) => {
    if (typeof payload === "string") {
        return normalizeText(payload) || null;
    }
    if (!payload || typeof payload !== "object") {
        return null;
    }
    const record = payload;
    const detail = normalizeText(record.detail);
    if (detail) {
        return detail;
    }
    const error = normalizeText(record.error);
    if (error) {
        return error;
    }
    const message = normalizeText(record.message);
    return message || null;
};
export const fetchUpstreamResponse = async (url, init, policy, context) => {
    const deadline = Date.now() + policy.timeoutMs;
    let lastError = null;
    let lastStatusCode = null;
    const target = buildUpstreamTarget(url);
    for (let attempt = 0; attempt <= policy.retryDelaysMs.length; attempt += 1) {
        const remainingMs = Math.max(0, deadline - Date.now());
        const attemptNumber = attempt + 1;
        if (remainingMs <= 0) {
            throw new UpstreamFetchError(`Upstream request timed out for ${target}.`, {
                code: "TIMEOUT",
                isTimeout: true,
                target,
            });
        }
        const timeoutSignal = AbortSignal.timeout(remainingMs);
        const signal = combineAbortSignals([init?.signal, timeoutSignal]);
        const startedAt = Date.now();
        try {
            const response = await fetch(url, {
                ...init,
                signal,
            });
            const elapsedMs = Date.now() - startedAt;
            lastStatusCode = response.status;
            logServerEvent(response.ok ? "info" : "warn", "upstream.response", {
                attempt: attemptNumber,
                assetKind: context.assetKind ?? null,
                cacheHit: false,
                elapsedMs,
                endpoint: context.endpoint,
                jobId: context.jobId ?? null,
                policy: policy.name,
                projectId: context.projectId ?? null,
                statusCode: response.status,
                target,
            });
            if (!policy.retryableStatusCodes.has(response.status) || attempt === policy.retryDelaysMs.length) {
                return response;
            }
            void response.body?.cancel();
        }
        catch (error) {
            lastError = error;
            const elapsedMs = Date.now() - startedAt;
            logServerEvent("warn", "upstream.error", {
                attempt: attemptNumber,
                assetKind: context.assetKind ?? null,
                code: getErrorCode(error) || null,
                elapsedMs,
                endpoint: context.endpoint,
                error: getErrorMessage(error),
                jobId: context.jobId ?? null,
                policy: policy.name,
                projectId: context.projectId ?? null,
                target,
                timeout: isAbortLikeError(error),
            });
            if (attempt === policy.retryDelaysMs.length || !isAbortLikeError(error)) {
                throw new UpstreamFetchError(getErrorMessage(error) || `Upstream request failed for ${target}.`, {
                    code: getErrorCode(error) || null,
                    isTimeout: isAbortLikeError(error),
                    target,
                });
            }
        }
        const delayMs = policy.retryDelaysMs[attempt] ?? 0;
        const nextRemainingMs = Math.max(0, deadline - Date.now());
        if (delayMs > 0 && nextRemainingMs > delayMs) {
            await wait(delayMs);
        }
    }
    if (lastStatusCode !== null) {
        throw new UpstreamHttpError(`Upstream request failed (${lastStatusCode}) for ${target}.`, {
            statusCode: lastStatusCode,
            target,
        });
    }
    throw new UpstreamFetchError(lastError ? getErrorMessage(lastError) : `Upstream request failed for ${target}.`, {
        code: getErrorCode(lastError) || null,
        isTimeout: isAbortLikeError(lastError),
        target,
    });
};
export const fetchUpstreamJson = async (url, init, policy, context) => {
    const response = await fetchUpstreamResponse(url, init, policy, context);
    const payload = (await response.json().catch(() => null));
    if (!response.ok) {
        throw new UpstreamHttpError(extractUpstreamErrorDetail(payload) ?? `Upstream request failed (${response.status}) for ${buildUpstreamTarget(url)}.`, {
            responseText: payload ? JSON.stringify(payload) : "",
            statusCode: response.status,
            target: buildUpstreamTarget(url),
        });
    }
    if (!payload) {
        throw new UpstreamFetchError(`Upstream returned an empty response for ${buildUpstreamTarget(url)}.`, {
            target: buildUpstreamTarget(url),
        });
    }
    return payload;
};
export const fetchUpstreamText = async (url, init, policy, context) => {
    const response = await fetchUpstreamResponse(url, init, policy, context);
    const payload = await response.text().catch(() => "");
    if (!response.ok) {
        throw new UpstreamHttpError(extractUpstreamErrorDetail(payload) ?? `Upstream request failed (${response.status}) for ${buildUpstreamTarget(url)}.`, {
            responseText: payload,
            statusCode: response.status,
            target: buildUpstreamTarget(url),
        });
    }
    if (!normalizeText(payload)) {
        throw new UpstreamFetchError(`Upstream returned an empty response for ${buildUpstreamTarget(url)}.`, {
            target: buildUpstreamTarget(url),
        });
    }
    return payload;
};
export const fetchAdsflowJson = async (options) => {
    const url = options.url ?? buildAdsflowUrl(options.path ?? "", options.params);
    return fetchUpstreamJson(url, options.init, options.policy, options.context);
};
export const postAdsflowText = async (path, body, policy, context) => {
    return fetchUpstreamText(buildAdsflowUrl(path), {
        body: JSON.stringify(body),
        headers: {
            "Content-Type": "application/json",
        },
        method: "POST",
    }, policy, context);
};
export const postAdsflowJson = async (path, body, policy, context) => {
    return fetchAdsflowJson({
        context,
        init: {
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json",
            },
            method: "POST",
        },
        path,
        policy,
    });
};
