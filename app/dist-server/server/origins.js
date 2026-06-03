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
const isPlainHostname = (hostname) => {
    const normalized = hostname.trim().toLowerCase();
    return (normalized.includes(".") &&
        !normalized.endsWith(".local") &&
        !normalized.includes(":") &&
        !/^\d+\.\d+\.\d+\.\d+$/.test(normalized));
};
const getWwwOriginVariant = (origin) => {
    if (!origin)
        return null;
    try {
        const parsed = new URL(origin);
        const hostname = parsed.hostname.trim().toLowerCase();
        if (!isPlainHostname(hostname))
            return null;
        parsed.hostname = hostname.startsWith("www.") ? hostname.slice(4) : `www.${hostname}`;
        return parsed.origin;
    }
    catch {
        return null;
    }
};
export const isLoopbackHostname = (hostname) => {
    const normalized = hostname.trim().toLowerCase();
    return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
};
export const getConfiguredOrigins = (appUrl, authBaseUrl, isProduction) => Array.from(new Set((() => {
    const appOrigin = normalizeOrigin(appUrl);
    const authOrigin = normalizeOrigin(authBaseUrl);
    return [
        appOrigin,
        getWwwOriginVariant(appOrigin),
        authOrigin,
        isProduction ? null : "http://localhost:4174",
        isProduction ? null : "http://127.0.0.1:4174",
    ];
})().filter((value) => Boolean(value))));
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
