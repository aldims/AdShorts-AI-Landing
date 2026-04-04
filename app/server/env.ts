import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const serverDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(serverDir, "..");
const envFile = join(rootDir, ".env");
const dataDir = join(rootDir, "data");

dotenv.config({ path: envFile });

const shouldUseSiblingSecret = (currentValue: string | undefined, siblingValue: string | undefined, minLength = 40) => {
  const normalizedSibling = siblingValue?.trim();
  if (!normalizedSibling) {
    return false;
  }

  const normalizedCurrent = currentValue?.trim();
  if (!normalizedCurrent || normalizedCurrent === "your_api_key_here") {
    return true;
  }

  return normalizedCurrent.length < minLength && normalizedSibling.length >= minLength;
};

const siblingAdsflowWorkerEnvFile = join(rootDir, "..", "..", "AdsFlow AI", "services", "worker", ".env");
if (existsSync(siblingAdsflowWorkerEnvFile)) {
  const siblingAdsflowWorkerEnv = dotenv.parse(readFileSync(siblingAdsflowWorkerEnvFile));

  if (!process.env.DEAPI_API_KEY && siblingAdsflowWorkerEnv.DEAPI_API_KEY) {
    process.env.DEAPI_API_KEY = siblingAdsflowWorkerEnv.DEAPI_API_KEY;
  }

  if (!process.env.DEAPI_VERIFY_SSL && siblingAdsflowWorkerEnv.DEAPI_VERIFY_SSL) {
    process.env.DEAPI_VERIFY_SSL = siblingAdsflowWorkerEnv.DEAPI_VERIFY_SSL;
  }

  if (shouldUseSiblingSecret(process.env.OPENROUTER_API_KEY, siblingAdsflowWorkerEnv.OPENROUTER_API_KEY)) {
    process.env.OPENROUTER_API_KEY = siblingAdsflowWorkerEnv.OPENROUTER_API_KEY;
  }

  if (!process.env.OPENROUTER_BASE_URL && siblingAdsflowWorkerEnv.OPENROUTER_BASE_URL) {
    process.env.OPENROUTER_BASE_URL = siblingAdsflowWorkerEnv.OPENROUTER_BASE_URL;
  }

  if (!process.env.OPENROUTER_MAIN_MODEL && siblingAdsflowWorkerEnv.OPENROUTER_MAIN_MODEL) {
    process.env.OPENROUTER_MAIN_MODEL = siblingAdsflowWorkerEnv.OPENROUTER_MAIN_MODEL;
  }

  if (!process.env.OPENROUTER_FALLBACK_MODEL && siblingAdsflowWorkerEnv.OPENROUTER_FALLBACK_MODEL) {
    process.env.OPENROUTER_FALLBACK_MODEL = siblingAdsflowWorkerEnv.OPENROUTER_FALLBACK_MODEL;
  }
}

mkdirSync(dataDir, { recursive: true });

const trim = (value: string | undefined) => value?.trim() || undefined;
const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

const appUrl = trim(process.env.APP_URL) ?? "http://127.0.0.1:4174";
const authBaseUrl = trim(process.env.BETTER_AUTH_URL) ?? appUrl;
const authSecret = trim(process.env.BETTER_AUTH_SECRET) ?? "dev-only-secret-change-me";

if (isProduction && authSecret === "dev-only-secret-change-me") {
  throw new Error("BETTER_AUTH_SECRET must be set in production.");
}

const smtpHost = trim(process.env.SMTP_HOST);
const smtpPort = toNumber(process.env.SMTP_PORT, 587);
const smtpUser = trim(process.env.SMTP_USER);
const smtpPass = trim(process.env.SMTP_PASS);
const smtpFrom = trim(process.env.SMTP_FROM) ?? "AdShorts AI <no-reply@adshorts.ai>";
const smtpSecure = process.env.SMTP_SECURE === "true";

export const env = {
  nodeEnv,
  isProduction,
  rootDir,
  dataDir,
  appUrl,
  authBaseUrl,
  authSecret,
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
  openrouterApiKey: trim(process.env.OPENROUTER_API_KEY),
  openrouterBaseUrl: trim(process.env.OPENROUTER_BASE_URL) ?? "https://openrouter.ai/api/v1",
  openrouterMainModel: trim(process.env.OPENROUTER_MAIN_MODEL) ?? "google/gemini-3-flash-preview",
  openrouterFallbackModel: trim(process.env.OPENROUTER_FALLBACK_MODEL) ?? "openai/gpt-4o-mini",
};

export const authProviderStatus = {
  googleEnabled: Boolean(env.googleClientId && env.googleClientSecret),
  telegramEnabled: Boolean(env.telegramBotId && env.telegramBotUsername && env.telegramBotToken),
  smtpConfigured: Boolean(env.smtpHost && env.smtpUser && env.smtpPass),
};
