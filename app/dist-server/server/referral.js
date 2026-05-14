const WEB_REFERRAL_SOURCE_PATTERN = /^(?:[A-Za-z0-9_]{2,64}|en\/[A-Za-z0-9_]{2,61})$/;
export const normalizeWebReferralSource = (value) => {
    const rawValue = Array.isArray(value) ? value[0] : value;
    const normalized = String(rawValue ?? "").trim().replace(/^\/+|\/+$/g, "");
    return WEB_REFERRAL_SOURCE_PATTERN.test(normalized) ? normalized : "";
};
