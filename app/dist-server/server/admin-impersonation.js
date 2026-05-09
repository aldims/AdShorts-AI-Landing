import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";
import { database } from "./database.js";
import { env } from "./env.js";
const IMPERSONATION_PURPOSE = "admin_impersonation";
const IMPERSONATION_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const isPgPool = (value) => value instanceof Pool;
const normalizeText = (value) => String(value ?? "").trim();
const encodeBase64Url = (value) => Buffer.from(value).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
const decodeBase64Url = (value) => {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return Buffer.from(padded, "base64");
};
const hmacSignature = (payloadBase64, secret) => createHmac("sha256", secret).update(payloadBase64).digest();
const secureEqual = (left, right) => left.length === right.length && timingSafeEqual(left, right);
export const signAdminImpersonationToken = (payload, secret) => {
    const payloadBase64 = encodeBase64Url(JSON.stringify({
        ...payload,
        purpose: payload.purpose ?? IMPERSONATION_PURPOSE,
        version: payload.version ?? 1,
    }));
    const signatureBase64 = encodeBase64Url(hmacSignature(payloadBase64, secret));
    return `${payloadBase64}.${signatureBase64}`;
};
export const verifyAdminImpersonationToken = (token, options = {}) => {
    const secret = normalizeText(options.secret ?? env.adsflowAdminToken);
    if (!secret) {
        throw new Error("Admin impersonation secret is not configured.");
    }
    const [payloadBase64, signatureBase64, extra] = normalizeText(token).split(".");
    if (!payloadBase64 || !signatureBase64 || extra !== undefined) {
        throw new Error("Invalid impersonation token format.");
    }
    const expectedSignature = hmacSignature(payloadBase64, secret);
    const providedSignature = decodeBase64Url(signatureBase64);
    if (!secureEqual(expectedSignature, providedSignature)) {
        throw new Error("Invalid impersonation token signature.");
    }
    const payload = JSON.parse(decodeBase64Url(payloadBase64).toString("utf8"));
    if (payload.purpose !== IMPERSONATION_PURPOSE || payload.version !== 1) {
        throw new Error("Invalid impersonation token purpose.");
    }
    const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (!Number.isFinite(payload.exp) || Number(payload.exp) <= nowSeconds) {
        throw new Error("Impersonation token has expired.");
    }
    if (Number.isFinite(payload.iat) && Number(payload.iat) > nowSeconds + 60) {
        throw new Error("Impersonation token is not valid yet.");
    }
    if (!normalizeText(payload.externalUserId) && !normalizeText(payload.email)) {
        throw new Error("Impersonation target is missing.");
    }
    return payload;
};
const queryRows = async (sql, params = []) => {
    if (isPgPool(database)) {
        const result = await database.query(sql, [...params]);
        return result.rows;
    }
    return database.prepare(sql).all(...params);
};
const queryFirst = async (sql, params = []) => (await queryRows(sql, params))[0] ?? null;
const userSelectSql = (whereClause) => `
  SELECT
    id,
    email,
    name
  FROM "user"
  WHERE ${whereClause}
  LIMIT 1
`;
const accountUserSelectSql = (whereClause) => `
  SELECT
    u.id AS id,
    u.email AS email,
    u.name AS name
  FROM "account" a
  JOIN "user" u ON u.id = a."userId"
  WHERE ${whereClause}
  LIMIT 1
`;
const placeholder = (index) => (isPgPool(database) ? `$${index}` : "?");
const toUser = (row) => {
    if (!row)
        return null;
    const id = normalizeText(row.id);
    if (!id)
        return null;
    return {
        email: normalizeText(row.email),
        id,
        name: normalizeText(row.name) || normalizeText(row.email) || id,
    };
};
const parseExternalUserId = (value) => {
    const normalized = normalizeText(value);
    if (!normalized)
        return { provider: "", providerId: "" };
    if (!normalized.includes(":"))
        return { provider: "better-auth", providerId: normalized };
    const [provider, ...providerIdParts] = normalized.split(":");
    return {
        provider: normalizeText(provider).toLowerCase(),
        providerId: normalizeText(providerIdParts.join(":")),
    };
};
export const resolveAdminImpersonationUser = async (payload) => {
    const { provider, providerId } = parseExternalUserId(payload.externalUserId);
    const email = normalizeText(payload.email).toLowerCase();
    let user = null;
    if (provider === "better-auth" && providerId) {
        user = toUser(await queryFirst(userSelectSql(`id = ${placeholder(1)}`), [providerId]));
    }
    if (!user && provider === "email" && providerId) {
        user = toUser(await queryFirst(userSelectSql(`lower(email) = ${placeholder(1)}`), [providerId.toLowerCase()]));
    }
    if (!user && provider && providerId && provider !== "better-auth" && provider !== "email") {
        user = toUser(await queryFirst(accountUserSelectSql(`a."providerId" = ${placeholder(1)} AND a."accountId" = ${placeholder(2)}`), [provider, providerId]));
    }
    if (!user && email) {
        user = toUser(await queryFirst(userSelectSql(`lower(email) = ${placeholder(1)}`), [email]));
    }
    if (!user) {
        throw new Error("Impersonation target user was not found.");
    }
    return user;
};
const toDatabaseDateValue = (value) => (isPgPool(database) ? value : value.toISOString());
const insertSession = async (session) => {
    const nowValue = toDatabaseDateValue(session.updatedAt);
    const expiresValue = toDatabaseDateValue(session.expiresAt);
    const sql = `
    INSERT INTO "session" (
      id,
      "expiresAt",
      token,
      "createdAt",
      "updatedAt",
      "ipAddress",
      "userAgent",
      "userId"
    ) VALUES (
      ${placeholder(1)},
      ${placeholder(2)},
      ${placeholder(3)},
      ${placeholder(4)},
      ${placeholder(5)},
      ${placeholder(6)},
      ${placeholder(7)},
      ${placeholder(8)}
    )
  `;
    const params = [
        session.id,
        expiresValue,
        session.token,
        nowValue,
        nowValue,
        session.ipAddress,
        session.userAgent,
        session.userId,
    ];
    if (isPgPool(database)) {
        await database.query(sql, params);
        return;
    }
    database.prepare(sql).run(...params);
};
export const startAdminImpersonationSession = async (payload, req, res) => {
    const user = await resolveAdminImpersonationUser(payload);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + IMPERSONATION_SESSION_TTL_MS);
    const sessionToken = randomUUID();
    await insertSession({
        expiresAt,
        id: randomUUID(),
        ipAddress: req.ip ?? null,
        token: sessionToken,
        updatedAt: now,
        userAgent: req.header("user-agent") ?? null,
        userId: user.id,
    });
    res.cookie("better-auth.session_token", sessionToken, {
        expires: expiresAt,
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: env.isProduction,
    });
    res.cookie("adshorts.impersonation", encodeBase64Url(JSON.stringify({
        adsflowUserId: normalizeText(payload.adsflowUserId),
        email: user.email,
        expiresAt: expiresAt.toISOString(),
    })), {
        expires: expiresAt,
        httpOnly: false,
        path: "/",
        sameSite: "lax",
        secure: env.isProduction,
    });
    return {
        expiresAt,
        token: sessionToken,
        user,
    };
};
