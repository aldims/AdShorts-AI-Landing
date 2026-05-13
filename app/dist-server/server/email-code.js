import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";
import { database } from "./database.js";
import { env } from "./env.js";
export const EMAIL_LOGIN_CODE_TTL_MINUTES = 10;
const EMAIL_LOGIN_CODE_TTL_MS = EMAIL_LOGIN_CODE_TTL_MINUTES * 60 * 1000;
const EMAIL_LOGIN_CODE_MAX_ATTEMPTS = 5;
const SQLITE_BUSY_RETRY_COUNT = 20;
const SQLITE_BUSY_RETRY_DELAY_MS = 150;
let emailLoginCodeSchemaReady = false;
let emailLoginCodeSchemaPromise = null;
const isPgPool = (value) => value instanceof Pool;
const placeholder = (index) => (isPgPool(database) ? `$${index}` : "?");
const wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));
const isSqliteBusyError = (error) => error instanceof Error &&
    error.message.toLowerCase().includes("database is locked") &&
    "code" in error &&
    error.code === "ERR_SQLITE_ERROR";
const runStatement = async (sql, params = []) => {
    if (isPgPool(database)) {
        await database.query(sql, [...params]);
        return;
    }
    for (let attempt = 0; attempt <= SQLITE_BUSY_RETRY_COUNT; attempt += 1) {
        try {
            database.prepare(sql).run(...params);
            return;
        }
        catch (error) {
            if (!isSqliteBusyError(error) || attempt === SQLITE_BUSY_RETRY_COUNT) {
                throw error;
            }
            await wait(SQLITE_BUSY_RETRY_DELAY_MS);
        }
    }
};
const queryRows = async (sql, params = []) => {
    if (isPgPool(database)) {
        const result = await database.query(sql, [...params]);
        return result.rows;
    }
    for (let attempt = 0; attempt <= SQLITE_BUSY_RETRY_COUNT; attempt += 1) {
        try {
            return database.prepare(sql).all(...params);
        }
        catch (error) {
            if (!isSqliteBusyError(error) || attempt === SQLITE_BUSY_RETRY_COUNT) {
                throw error;
            }
            await wait(SQLITE_BUSY_RETRY_DELAY_MS);
        }
    }
    return [];
};
const hashEmailLoginCode = (email, code) => createHmac("sha256", env.authSecret).update(`${email}:${code}`).digest("hex");
const safeEqual = (left, right) => {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};
export const normalizeEmailLoginAddress = (value) => {
    const email = String(value ?? "").trim().toLowerCase();
    if (!email || email.length > 254)
        return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return null;
    return email;
};
export const ensureEmailLoginCodeSchema = async () => {
    if (emailLoginCodeSchemaReady)
        return;
    if (emailLoginCodeSchemaPromise) {
        await emailLoginCodeSchemaPromise;
        return;
    }
    emailLoginCodeSchemaPromise = (async () => {
        await runStatement(`
      CREATE TABLE IF NOT EXISTS "emailLoginCode" (
        "email" TEXT PRIMARY KEY,
        "codeHash" TEXT NOT NULL,
        "expiresAt" TEXT NOT NULL,
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TEXT NOT NULL
      )
    `);
        await runStatement(`
      CREATE INDEX IF NOT EXISTS "emailLoginCode_expiresAt_idx"
      ON "emailLoginCode" ("expiresAt")
    `);
        emailLoginCodeSchemaReady = true;
    })();
    await emailLoginCodeSchemaPromise;
};
export const createEmailLoginCode = async (rawEmail) => {
    const email = normalizeEmailLoginAddress(rawEmail);
    if (!email) {
        throw new Error("Invalid email address.");
    }
    await ensureEmailLoginCodeSchema();
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + EMAIL_LOGIN_CODE_TTL_MS).toISOString();
    const codeHash = hashEmailLoginCode(email, code);
    await runStatement(`
      INSERT INTO "emailLoginCode" (
        "email",
        "codeHash",
        "expiresAt",
        "attempts",
        "createdAt"
      ) VALUES (
        ${placeholder(1)},
        ${placeholder(2)},
        ${placeholder(3)},
        0,
        ${placeholder(4)}
      )
      ON CONFLICT ("email") DO UPDATE SET
        "codeHash" = excluded."codeHash",
        "expiresAt" = excluded."expiresAt",
        "attempts" = 0,
        "createdAt" = excluded."createdAt"
    `, [email, codeHash, expiresAt, createdAt]);
    return {
        code,
        email,
        expiresAt,
    };
};
export const verifyEmailLoginCode = async (rawEmail, rawCode) => {
    const email = normalizeEmailLoginAddress(rawEmail);
    const code = String(rawCode ?? "").trim();
    if (!email || !/^\d{6}$/.test(code)) {
        return { ok: false, reason: "invalid" };
    }
    await ensureEmailLoginCodeSchema();
    const rows = await queryRows(`
      SELECT
        "email" AS "email",
        "codeHash" AS "codeHash",
        "expiresAt" AS "expiresAt",
        "attempts" AS "attempts",
        "createdAt" AS "createdAt"
      FROM "emailLoginCode"
      WHERE "email" = ${placeholder(1)}
      LIMIT 1
    `, [email]);
    const row = rows[0];
    if (!row) {
        return { ok: false, reason: "invalid" };
    }
    const expiresAt = new Date(row.expiresAt).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        await runStatement(`DELETE FROM "emailLoginCode" WHERE "email" = ${placeholder(1)}`, [email]);
        return { ok: false, reason: "expired" };
    }
    const attempts = Number(row.attempts) || 0;
    if (attempts >= EMAIL_LOGIN_CODE_MAX_ATTEMPTS) {
        await runStatement(`DELETE FROM "emailLoginCode" WHERE "email" = ${placeholder(1)}`, [email]);
        return { ok: false, reason: "too_many_attempts" };
    }
    if (!safeEqual(row.codeHash, hashEmailLoginCode(email, code))) {
        const nextAttempts = attempts + 1;
        if (nextAttempts >= EMAIL_LOGIN_CODE_MAX_ATTEMPTS) {
            await runStatement(`DELETE FROM "emailLoginCode" WHERE "email" = ${placeholder(1)}`, [email]);
            return { ok: false, reason: "too_many_attempts" };
        }
        await runStatement(`
        UPDATE "emailLoginCode"
        SET "attempts" = ${placeholder(2)}
        WHERE "email" = ${placeholder(1)}
      `, [email, nextAttempts]);
        return { ok: false, reason: "invalid" };
    }
    await runStatement(`DELETE FROM "emailLoginCode" WHERE "email" = ${placeholder(1)}`, [email]);
    return { ok: true };
};
