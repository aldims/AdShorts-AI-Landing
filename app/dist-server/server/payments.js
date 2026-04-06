import { createHmac } from "node:crypto";
import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
export const checkoutProductIds = ["start", "pro", "ultra", "package_10", "package_50", "package_100"];
export class CheckoutConfigError extends Error {
}
const checkoutLinks = {
    start: env.paymentLinkStart,
    pro: env.paymentLinkPro,
    ultra: env.paymentLinkUltra,
    package_10: env.paymentLinkPackage10,
    package_50: env.paymentLinkPackage50,
    package_100: env.paymentLinkPackage100,
};
const normalizeText = (value) => String(value ?? "").trim();
const normalizePlan = (value) => normalizeText(value).toUpperCase();
const isPackageCheckoutProductId = (value) => value.startsWith("package_");
const canBuyGenerationPacks = (plan) => plan === "PRO" || plan === "ULTRA";
const checkoutRedirectStatuses = new Set([301, 302, 303, 307, 308]);
const adsflowPostFallbackStatuses = new Set([500, 502, 503, 504]);
const checkoutUpstreamFallbackStatuses = new Set([500, 502, 503, 504]);
const ADSFLOW_POST_TIMEOUT_MS = 10_000;
const CHECKOUT_RESOLVE_TIMEOUT_MS = 15_000;
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
    const match = value.match(/"user"\s*:\s*\{[\s\S]*?"user_id"\s*:\s*("?)(\d+)\1/);
    return match?.[2]?.trim() || null;
};
const assertAdsflowConfigured = () => {
    if ((!env.adsflowApiBaseUrl && !env.paymentBaseUrl) || !env.adsflowAdminToken) {
        throw new CheckoutConfigError("AdsFlow payment integration is not configured.");
    }
};
const buildAdsflowPostCandidateUrls = (path) => {
    const candidates = [env.adsflowApiBaseUrl, env.paymentBaseUrl]
        .map((baseUrl) => normalizeText(baseUrl))
        .filter(Boolean)
        .map((baseUrl) => new URL(path, baseUrl).toString());
    return Array.from(new Set(candidates));
};
const postAdsflowText = async (path, body) => {
    assertAdsflowConfigured();
    const candidateUrls = buildAdsflowPostCandidateUrls(path);
    let lastError = null;
    for (let index = 0; index < candidateUrls.length; index += 1) {
        const candidateUrl = candidateUrls[index];
        const isLastCandidate = index === candidateUrls.length - 1;
        try {
            const response = await fetch(candidateUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(ADSFLOW_POST_TIMEOUT_MS),
            });
            const payload = await response.text();
            if (!response.ok) {
                const error = new CheckoutConfigError(extractErrorDetail(payload) ?? `AdsFlow request failed (${response.status}).`);
                if (!isLastCandidate && adsflowPostFallbackStatuses.has(response.status)) {
                    lastError = error;
                    continue;
                }
                throw error;
            }
            if (!payload) {
                throw new CheckoutConfigError("AdsFlow returned an empty response.");
            }
            return payload;
        }
        catch (error) {
            const normalizedError = error instanceof CheckoutConfigError
                ? error
                : new CheckoutConfigError(error instanceof Error ? `AdsFlow unavailable: ${error.message}` : "AdsFlow unavailable.");
            if (!isLastCandidate) {
                lastError = normalizedError;
                continue;
            }
            throw normalizedError;
        }
    }
    throw lastError ?? new CheckoutConfigError("AdsFlow unavailable.");
};
const resolvePreferredExternalUserId = async (user) => {
    try {
        return (await resolveExternalUserIdentity(user)).preferred;
    }
    catch {
        return buildExternalUserId(user);
    }
};
const getAdsflowCheckoutContext = async (user) => {
    const externalUserId = await resolvePreferredExternalUserId(user);
    const payload = await postAdsflowText("/api/web/bootstrap", {
        admin_token: env.adsflowAdminToken,
        external_user_id: externalUserId,
        language: "ru",
        referral_source: "landing_site",
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
    });
    const parsedPayload = parseJson(payload);
    const userId = extractBootstrapUserId(payload) || normalizeText(parsedPayload?.user?.user_id);
    const plan = normalizePlan(parsedPayload?.user?.plan) || null;
    if (!userId || !/^\d+$/.test(userId)) {
        throw new CheckoutConfigError("AdsFlow did not return a valid payment user.");
    }
    return {
        plan,
        userId,
    };
};
const signCheckoutParams = (params) => {
    const secret = normalizeText(env.adsflowAdminToken);
    if (!secret) {
        throw new CheckoutConfigError("AdsFlow payment secret is not configured.");
    }
    const payload = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&");
    return createHmac("sha256", secret).update(payload).digest("hex");
};
const getBaseCheckoutUrl = () => {
    const baseUrl = normalizeText(env.paymentBaseUrl) || normalizeText(env.adsflowApiBaseUrl);
    if (!baseUrl) {
        throw new CheckoutConfigError("Payment base URL is not configured.");
    }
    return baseUrl;
};
const buildAdsflowDirectFallbackUrl = (url) => {
    const publicBaseUrl = normalizeText(env.paymentBaseUrl);
    const directBaseUrl = normalizeText(env.adsflowApiBaseUrl);
    if (!publicBaseUrl || !directBaseUrl) {
        return null;
    }
    try {
        const targetUrl = new URL(url);
        const publicBase = new URL(publicBaseUrl);
        const directBase = new URL(directBaseUrl);
        if (targetUrl.origin !== publicBase.origin || targetUrl.origin === directBase.origin) {
            return null;
        }
        return new URL(`${targetUrl.pathname}${targetUrl.search}`, directBase).toString();
    }
    catch {
        return null;
    }
};
const resolveManualRedirectLocation = async (url, label) => {
    const fallbackUrl = buildAdsflowDirectFallbackUrl(url);
    const candidateUrls = fallbackUrl ? [url, fallbackUrl] : [url];
    let lastError = null;
    for (const candidateUrl of candidateUrls) {
        try {
            const response = await fetch(candidateUrl, {
                method: "GET",
                redirect: "manual",
                signal: AbortSignal.timeout(CHECKOUT_RESOLVE_TIMEOUT_MS),
                headers: {
                    Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
                },
            });
            if (checkoutRedirectStatuses.has(response.status)) {
                const redirectLocation = normalizeText(response.headers.get("location"));
                if (!redirectLocation) {
                    throw new CheckoutConfigError(`${label} redirect URL is missing.`);
                }
                try {
                    return {
                        ok: true,
                        location: new URL(redirectLocation, candidateUrl).toString(),
                        response,
                    };
                }
                catch {
                    throw new CheckoutConfigError(`${label} redirect URL is invalid.`);
                }
            }
            if (!response.ok) {
                const payload = await response.text().catch(() => "");
                const error = new CheckoutConfigError(extractErrorDetail(payload) ?? `${label} request failed (${response.status}).`);
                if (candidateUrl !== fallbackUrl && fallbackUrl && checkoutUpstreamFallbackStatuses.has(response.status)) {
                    lastError = error;
                    continue;
                }
                throw error;
            }
            return {
                ok: false,
                location: candidateUrl,
                response,
            };
        }
        catch (error) {
            const normalizedError = error instanceof CheckoutConfigError
                ? error
                : new CheckoutConfigError(error instanceof Error ? `${label} unavailable: ${error.message}` : `${label} unavailable.`);
            if (candidateUrl !== fallbackUrl && fallbackUrl) {
                lastError = normalizedError;
                continue;
            }
            throw normalizedError;
        }
    }
    throw lastError ?? new CheckoutConfigError(`${label} unavailable.`);
};
const resolveDynamicCheckoutUrl = async (checkoutUrl) => {
    const firstHop = await resolveManualRedirectLocation(checkoutUrl, "Payment checkout");
    if (!firstHop.ok) {
        return checkoutUrl;
    }
    return firstHop.location;
};
const buildDynamicCheckoutUrl = async (productId, user, checkoutContext) => {
    const resolvedCheckoutContext = checkoutContext ?? (await getAdsflowCheckoutContext(user));
    const params = {
        user_id: resolvedCheckoutContext.userId,
        plan_code: productId,
        ts: String(Math.floor(Date.now() / 1000)),
        source: isPackageCheckoutProductId(productId) ? "pricing_addons_web" : "pricing_site",
        origin_screen: isPackageCheckoutProductId(productId) ? "pricing_addons_web" : "pricing_page_web",
    };
    const checkoutUrl = new URL("/payment/start-subscription", getBaseCheckoutUrl());
    Object.entries(params).forEach(([key, value]) => {
        checkoutUrl.searchParams.set(key, value);
    });
    checkoutUrl.searchParams.set("sig", signCheckoutParams(params));
    return checkoutUrl.toString();
};
export const isCheckoutProductId = (value) => checkoutProductIds.includes(value);
export const getCheckoutUrl = async (productId, user) => {
    const checkoutContext = isPackageCheckoutProductId(productId) ? await getAdsflowCheckoutContext(user) : null;
    if (checkoutContext && !canBuyGenerationPacks(checkoutContext.plan)) {
        throw new CheckoutConfigError("Дополнительные кредиты можно покупать только на тарифах PRO и ULTRA.");
    }
    const checkoutLink = checkoutLinks[productId]?.trim();
    if (checkoutLink) {
        try {
            return new URL(checkoutLink).toString();
        }
        catch {
            throw new CheckoutConfigError(`Checkout URL for ${productId.toUpperCase()} is invalid.`);
        }
    }
    return resolveDynamicCheckoutUrl(await buildDynamicCheckoutUrl(productId, user, checkoutContext ?? undefined));
};
