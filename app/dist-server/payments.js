import { createHmac } from "node:crypto";
import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
export const checkoutProductIds = ["start", "pro", "ultra"];
export class CheckoutConfigError extends Error {
}
const checkoutLinks = {
    start: env.paymentLinkStart,
    pro: env.paymentLinkPro,
    ultra: env.paymentLinkUltra,
};
const normalizeText = (value) => String(value ?? "").trim();
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
const assertAdsflowConfigured = () => {
    if (!env.adsflowApiBaseUrl || !env.adsflowAdminToken) {
        throw new CheckoutConfigError("AdsFlow payment integration is not configured.");
    }
};
const postAdsflowText = async (path, body) => {
    assertAdsflowConfigured();
    const response = await fetch(new URL(path, env.adsflowApiBaseUrl), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    const payload = await response.text();
    if (!response.ok) {
        throw new CheckoutConfigError(extractErrorDetail(payload) ?? `AdsFlow request failed (${response.status}).`);
    }
    if (!payload) {
        throw new CheckoutConfigError("AdsFlow returned an empty response.");
    }
    return payload;
};
const resolvePreferredExternalUserId = async (user) => {
    try {
        return (await resolveExternalUserIdentity(user)).preferred;
    }
    catch {
        return buildExternalUserId(user);
    }
};
const getAdsflowWebUserId = async (user) => {
    const externalUserId = await resolvePreferredExternalUserId(user);
    const payload = await postAdsflowText("/api/web/bootstrap", {
        admin_token: env.adsflowAdminToken,
        external_user_id: externalUserId,
        language: "ru",
        referral_source: "landing_site",
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
    });
    const userId = extractBootstrapUserId(payload);
    if (!userId || !/^\d+$/.test(userId)) {
        throw new CheckoutConfigError("AdsFlow did not return a valid payment user.");
    }
    return userId;
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
const buildDynamicCheckoutUrl = async (productId, user) => {
    const adsflowUserId = await getAdsflowWebUserId(user);
    const params = {
        user_id: adsflowUserId,
        plan_code: productId,
        ts: String(Math.floor(Date.now() / 1000)),
        source: "pricing_site",
        origin_screen: "pricing_page_web",
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
    const checkoutLink = checkoutLinks[productId]?.trim();
    if (checkoutLink) {
        try {
            return new URL(checkoutLink).toString();
        }
        catch {
            throw new CheckoutConfigError(`Checkout URL for ${productId.toUpperCase()} is invalid.`);
        }
    }
    return buildDynamicCheckoutUrl(productId, user);
};
