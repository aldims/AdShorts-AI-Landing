import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { env } from "./env.js";

export type TelegramLoginData = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

const MAX_AUTH_AGE_SECONDS = 86400;
const MAX_AUTH_FUTURE_SKEW_SECONDS = 300;
export const TELEGRAM_LOGIN_NONCE_COOKIE_NAME = "adshorts.telegram_login_nonce";
export const TELEGRAM_OIDC_SESSION_COOKIE_NAME = "adshorts.telegram_oidc_session";
export const TELEGRAM_LOGIN_NONCE_MAX_AGE_MS = 10 * 60 * 1000;
const TELEGRAM_OIDC_ISSUER = "https://oauth.telegram.org";
const TELEGRAM_OIDC_JWKS = createRemoteJWKSet(new URL("https://oauth.telegram.org/.well-known/jwks.json"));

export type TelegramOidcSession = {
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
  state: string;
};

type TelegramIdTokenPayload = JWTPayload & {
  id?: number;
  name?: string;
  picture?: string;
  preferred_username?: string;
  nonce?: string;
};

const toBase64Url = (value: Buffer) =>
  value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");

const fromBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64");
};

const signNonce = (nonce: string) => toBase64Url(createHmac("sha256", env.authSecret).update(nonce).digest());

const serializeSignedValue = (value: string) => `${value}.${signNonce(value)}`;

const parseSignedValue = (value: string | null | undefined) => {
  const [payload, signature, ...rest] = String(value ?? "").split(".");
  if (!payload || !signature || rest.length > 0) return null;

  const expectedSignature = signNonce(payload);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  return payload;
};

export const createTelegramLoginNonce = () => toBase64Url(randomBytes(24));

export const serializeTelegramLoginNonce = (nonce: string) => serializeSignedValue(nonce);

export const parseTelegramLoginNonce = (value: string | null | undefined) => {
  return parseSignedValue(value);
};

export const createTelegramOidcSession = (redirectUri: string) => {
  const codeVerifier = toBase64Url(randomBytes(32));
  const session: TelegramOidcSession = {
    codeVerifier,
    nonce: createTelegramLoginNonce(),
    redirectUri,
    state: createTelegramLoginNonce(),
  };

  const codeChallenge = toBase64Url(createHash("sha256").update(codeVerifier).digest());

  return { codeChallenge, session };
};

export const serializeTelegramOidcSession = (session: TelegramOidcSession) =>
  serializeSignedValue(toBase64Url(Buffer.from(JSON.stringify(session), "utf8")));

export const parseTelegramOidcSession = (value: string | null | undefined): TelegramOidcSession | null => {
  const payload = parseSignedValue(value);
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payload).toString("utf8")) as Partial<TelegramOidcSession>;
    if (
      typeof parsed.codeVerifier !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.redirectUri !== "string" ||
      typeof parsed.state !== "string" ||
      !parsed.codeVerifier ||
      !parsed.nonce ||
      !parsed.redirectUri ||
      !parsed.state
    ) {
      return null;
    }

    return {
      codeVerifier: parsed.codeVerifier,
      nonce: parsed.nonce,
      redirectUri: parsed.redirectUri,
      state: parsed.state,
    };
  } catch {
    return null;
  }
};

const buildTelegramCheckString = (data: TelegramLoginData) => {
  return Object.entries(data)
    .filter(([key, value]) => key !== "hash" && value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n");
};

export function verifyTelegramLogin(
  data: TelegramLoginData,
  options: { botToken?: string; nowSeconds?: number } = {},
): boolean {
  const botToken = options.botToken ?? env.telegramBotToken;
  if (!botToken) return false;

  const { hash, ...rest } = data;
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return false;
  if (!Number.isFinite(data.id) || !Number.isFinite(data.auth_date)) return false;

  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const authAge = nowSeconds - data.auth_date;
  if (authAge > MAX_AUTH_AGE_SECONDS || authAge < -MAX_AUTH_FUTURE_SKEW_SECONDS) return false;

  const checkString = buildTelegramCheckString({ ...rest, hash });
  const secretKey = createHash("sha256").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(checkString).digest("hex");

  const receivedHash = Buffer.from(hash, "hex");
  const expectedHash = Buffer.from(computedHash, "hex");

  return receivedHash.length === expectedHash.length && timingSafeEqual(receivedHash, expectedHash);
}

export function getTelegramUserProfile(data: TelegramLoginData) {
  const telegramId = String(data.id);
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ");

  return {
    telegramId,
    email: `telegram-${telegramId}@users.adshorts.local`,
    name: name || (data.username ? `@${data.username}` : "Telegram User"),
    image: data.photo_url ?? null,
    username: data.username,
  };
}

export async function getTelegramUserProfileFromIdToken(
  idToken: string,
  options: { clientId?: string; nonce?: string } = {},
) {
  const clientId = options.clientId ?? env.telegramBotId;
  if (!clientId) {
    throw new Error("Telegram client id is not configured.");
  }

  const { payload } = await jwtVerify(idToken, TELEGRAM_OIDC_JWKS, {
    algorithms: ["RS256"],
    audience: clientId,
    issuer: TELEGRAM_OIDC_ISSUER,
    maxTokenAge: "10 minutes",
    requiredClaims: ["aud", "exp", "iat", "iss", "sub"],
  });
  const telegramPayload = payload as TelegramIdTokenPayload;

  if (options.nonce && telegramPayload.nonce !== options.nonce) {
    throw new Error("Telegram login nonce mismatch.");
  }

  const telegramId = typeof telegramPayload.id === "number" ? String(telegramPayload.id) : String(telegramPayload.sub ?? "");
  if (!telegramId) {
    throw new Error("Telegram id token is missing a user identifier.");
  }

  const username = typeof telegramPayload.preferred_username === "string" ? telegramPayload.preferred_username : undefined;
  const name =
    typeof telegramPayload.name === "string" && telegramPayload.name.trim()
      ? telegramPayload.name.trim()
      : username
        ? `@${username}`
        : "Telegram User";

  return {
    telegramId,
    email: `telegram-${telegramId}@users.adshorts.local`,
    name,
    image: typeof telegramPayload.picture === "string" && telegramPayload.picture ? telegramPayload.picture : null,
    username,
  };
}
