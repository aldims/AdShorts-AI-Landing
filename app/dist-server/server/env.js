import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
const serverDir = dirname(fileURLToPath(import.meta.url));
const resolveRootDir = () => {
    let currentDir = serverDir;
    for (let index = 0; index < 4; index += 1) {
        if (existsSync(join(currentDir, "package.json"))) {
            return currentDir;
        }
        currentDir = join(currentDir, "..");
    }
    return join(serverDir, "..");
};
const rootDir = resolveRootDir();
const envFile = join(rootDir, ".env");
const dataDir = join(rootDir, "data");
dotenv.config({ path: envFile });
const trim = (value) => value?.trim() || undefined;
const resolveEnvFilePath = (value) => (isAbsolute(value) ? value : resolve(rootDir, value));
const loadSharedEnvFile = (configuredPath) => {
    const sharedEnvFile = resolveEnvFilePath(configuredPath);
    if (!existsSync(sharedEnvFile)) {
        throw new Error(`ADSHORTS_SHARED_ENV_FILE points to a missing file: ${sharedEnvFile}`);
    }
    dotenv.config({
        path: sharedEnvFile,
        override: false,
    });
};
const sharedEnvFile = trim(process.env.ADSHORTS_SHARED_ENV_FILE);
if (sharedEnvFile) {
    loadSharedEnvFile(sharedEnvFile);
}
mkdirSync(dataDir, { recursive: true });
const toBoolean = (value, fallback) => {
    if (value == null) {
        return fallback;
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        return fallback;
    }
    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }
    return fallback;
};
const toNumber = (value, fallback) => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";
const appUrl = trim(process.env.APP_URL) ?? "http://localhost:4174";
const authBaseUrl = trim(process.env.BETTER_AUTH_URL) ?? appUrl;
const authSecret = trim(process.env.BETTER_AUTH_SECRET) ?? "dev-only-secret-change-me";
if (isProduction && authSecret === "dev-only-secret-change-me") {
    throw new Error("BETTER_AUTH_SECRET must be set in production.");
}
if (isProduction && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(appUrl)) {
    throw new Error("APP_URL must point to the public site URL in production.");
}
if (isProduction && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(authBaseUrl)) {
    throw new Error("BETTER_AUTH_URL must point to the public site URL in production.");
}
const smtpHost = trim(process.env.SMTP_HOST);
const smtpPort = toNumber(process.env.SMTP_PORT, 587);
const smtpUser = trim(process.env.SMTP_USER);
const smtpPass = trim(process.env.SMTP_PASS);
const smtpFrom = trim(process.env.SMTP_FROM) ?? "AdShorts AI <no-reply@adshorts.ai>";
const smtpSecure = process.env.SMTP_SECURE === "true";
const assetCacheDir = trim(process.env.ASSET_CACHE_DIR) ?? dataDir;
mkdirSync(assetCacheDir, { recursive: true });
export const env = {
    nodeEnv,
    isProduction,
    rootDir,
    dataDir,
    assetCacheDir,
    appUrl,
    authBaseUrl,
    authSecret,
    authServerHost: trim(process.env.AUTH_SERVER_HOST) ?? "127.0.0.1",
    authServerPort: toNumber(process.env.AUTH_SERVER_PORT, 4175),
    authDatabaseUrl: trim(process.env.AUTH_DATABASE_URL),
    authDatabasePath: trim(process.env.AUTH_DATABASE_PATH) ?? "./data/auth.sqlite",
    authLegacyDatabasePath: trim(process.env.AUTH_LEGACY_DATABASE_PATH) ?? "./data/auth.sqlite",
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom,
    smtpSecure,
    googleClientId: trim(process.env.GOOGLE_CLIENT_ID),
    googleClientSecret: trim(process.env.GOOGLE_CLIENT_SECRET),
    telegramBotId: trim(process.env.TELEGRAM_BOT_ID),
    telegramBotUsername: trim(process.env.TELEGRAM_BOT_USERNAME),
    telegramBotToken: trim(process.env.TELEGRAM_BOT_TOKEN),
    adsflowApiBaseUrl: trim(process.env.ADSFLOW_API_BASE_URL),
    adsflowAdminToken: trim(process.env.ADSFLOW_ADMIN_TOKEN),
    paymentBaseUrl: trim(process.env.PAYMENT_BASE_URL),
    paymentLinkStart: trim(process.env.PAYMENT_LINK_START),
    paymentLinkPro: trim(process.env.PAYMENT_LINK_PRO),
    paymentLinkUltra: trim(process.env.PAYMENT_LINK_ULTRA),
    paymentLinkPackage10: trim(process.env.PAYMENT_LINK_PACKAGE_10),
    paymentLinkPackage50: trim(process.env.PAYMENT_LINK_PACKAGE_50),
    paymentLinkPackage100: trim(process.env.PAYMENT_LINK_PACKAGE_100),
    deapiApiKey: trim(process.env.DEAPI_API_KEY),
    deapiVerifySsl: process.env.DEAPI_VERIFY_SSL === "true" || (process.env.DEAPI_VERIFY_SSL == null && isProduction),
    wavespeedApiKey: trim(process.env.WAVESPEED_API_KEY),
    openrouterApiKey: trim(process.env.OPENROUTER_API_KEY),
    openrouterSharedEnvFile: sharedEnvFile ? resolveEnvFilePath(sharedEnvFile) : undefined,
    openrouterBaseUrl: trim(process.env.OPENROUTER_BASE_URL) ?? "https://openrouter.ai/api/v1",
    openrouterMainModel: trim(process.env.OPENROUTER_MAIN_MODEL) ?? "google/gemini-3-flash-preview",
    openrouterFallbackModel: trim(process.env.OPENROUTER_FALLBACK_MODEL) ?? "openai/gpt-4o-mini",
    redisUrl: trim(process.env.REDIS_URL),
    disableBackgroundWarming: toBoolean(process.env.DISABLE_BACKGROUND_WARMING, false),
    upstreamBootstrapTimeoutMs: toNumber(process.env.UPSTREAM_BOOTSTRAP_TIMEOUT_MS, 5_500),
    upstreamProjectsTimeoutMs: toNumber(process.env.UPSTREAM_PROJECTS_TIMEOUT_MS, 12_000),
    upstreamProbeTimeoutMs: toNumber(process.env.UPSTREAM_PROBE_TIMEOUT_MS, 1_800),
    upstreamProxyTimeoutMs: toNumber(process.env.UPSTREAM_PROXY_TIMEOUT_MS, 8_000),
    upstreamPlaybackPreparationTimeoutMs: toNumber(process.env.UPSTREAM_PLAYBACK_PREPARATION_TIMEOUT_MS, 60_000),
};
export const authProviderStatus = {
    googleEnabled: Boolean(env.googleClientId && env.googleClientSecret),
    telegramEnabled: Boolean(env.telegramBotId && env.telegramBotUsername && env.telegramBotToken),
    smtpConfigured: Boolean(env.smtpHost && env.smtpUser && env.smtpPass),
};
