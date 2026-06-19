import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env.js";
const VIDEO_PROXY_TOKEN_TTL_MS = 10 * 60 * 1000;
const VIDEO_PROXY_TOKEN_CLOCK_SKEW_MS = 30 * 1000;
const signVideoProxyPath = (scope, path, expiresAt) => createHmac("sha256", env.authSecret)
    .update(`${scope}\n${expiresAt}\n${path}`)
    .digest("base64url");
export const appendVideoProxyToken = (url, scope, path) => {
    const expiresAt = Date.now() + VIDEO_PROXY_TOKEN_TTL_MS;
    url.searchParams.set("expiresAt", String(expiresAt));
    url.searchParams.set("token", signVideoProxyPath(scope, path, expiresAt));
};
export const verifyVideoProxyToken = (scope, path, expiresAtValue, tokenValue) => {
    const expiresAt = Number(expiresAtValue);
    const token = typeof tokenValue === "string" ? tokenValue.trim() : "";
    if (!path || !Number.isFinite(expiresAt) || !token) {
        return false;
    }
    const now = Date.now();
    if (expiresAt < now - VIDEO_PROXY_TOKEN_CLOCK_SKEW_MS ||
        expiresAt > now + VIDEO_PROXY_TOKEN_TTL_MS + VIDEO_PROXY_TOKEN_CLOCK_SKEW_MS) {
        return false;
    }
    const expectedToken = signVideoProxyPath(scope, path, Math.trunc(expiresAt));
    const received = Buffer.from(token);
    const expected = Buffer.from(expectedToken);
    return received.length === expected.length && timingSafeEqual(received, expected);
};
