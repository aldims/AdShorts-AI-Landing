export const normalizeOrigin = (value) => {
    if (!value) {
        return null;
    }
    try {
        return new URL(value).origin;
    }
    catch {
        return null;
    }
};
export const isLoopbackHostname = (hostname) => {
    const normalized = hostname.trim().toLowerCase();
    return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
};
export const getConfiguredOrigins = (appUrl, authBaseUrl, isProduction) => Array.from(new Set([
    normalizeOrigin(appUrl),
    normalizeOrigin(authBaseUrl),
    isProduction ? null : "http://localhost:4174",
    isProduction ? null : "http://127.0.0.1:4174",
].filter((value) => Boolean(value))));
export const getTrustedAuthOrigins = (appUrl, authBaseUrl, isProduction) => [
    ...getConfiguredOrigins(appUrl, authBaseUrl, isProduction),
    ...(isProduction ? [] : ["http://localhost:*", "http://127.0.0.1:*", "http://[::1]:*"]),
];
export const isAllowedCorsOrigin = (origin, allowedOrigins, allowDevelopmentLoopback) => {
    if (!origin || allowedOrigins.includes(origin)) {
        return true;
    }
    if (!allowDevelopmentLoopback) {
        return false;
    }
    try {
        const parsed = new URL(origin);
        return parsed.protocol === "http:" && isLoopbackHostname(parsed.hostname);
    }
    catch {
        return false;
    }
};
