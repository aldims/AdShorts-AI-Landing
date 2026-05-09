import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { database } from "./database.js";
import { getCurrentAdsflowWebSignalContext } from "./web-device.js";
export const REFERRAL_COOKIE_NAME = "adshorts_referral";
export const REFERRAL_COOKIE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const ADMIN_EMAILS = new Set(["adshortsai@gmail.com", "aldima@mail.com"]);
const REFERRAL_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/;
const REFERRAL_CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
const isPgPool = (value) => value instanceof Pool;
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeEmail = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    return normalized.includes("@") ? normalized : "";
};
const normalizeNullableText = (value) => normalizeText(value) || null;
const normalizeNullableEmail = (value) => normalizeEmail(value) || null;
const normalizeIsoString = (value, fallback = new Date().toISOString()) => {
    const normalized = normalizeText(value);
    if (!normalized)
        return fallback;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
};
const normalizeSqliteParams = (params) => params.map((param) => param ?? null);
const runStatement = async (sql, params = []) => {
    if (isPgPool(database)) {
        await database.query(sql, [...params]);
        return;
    }
    database.prepare(sql).run(...normalizeSqliteParams(params));
};
const queryRows = async (sql, params = []) => {
    if (isPgPool(database)) {
        const result = await database.query(sql, [...params]);
        return result.rows;
    }
    return database.prepare(sql).all(...normalizeSqliteParams(params));
};
let referralTablesReady = false;
let referralTablesReadyPromise = null;
const ensureReferralTables = async () => {
    if (referralTablesReady)
        return;
    if (referralTablesReadyPromise) {
        await referralTablesReadyPromise;
        return;
    }
    referralTablesReadyPromise = (async () => {
        const createLinksTableSql = `
      CREATE TABLE IF NOT EXISTS referral_links (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL DEFAULT '',
        assigned_user_id TEXT,
        assigned_user_email TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_by_user_id TEXT,
        created_by_user_email TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;
        const createLinksStatusIndexSql = `
      CREATE INDEX IF NOT EXISTS referral_links_status_updated_idx
      ON referral_links (status, updated_at DESC)
    `;
        const createEventsTableSql = `
      CREATE TABLE IF NOT EXISTS referral_events (
        id TEXT PRIMARY KEY,
        link_id TEXT NOT NULL,
        code TEXT NOT NULL,
        type TEXT NOT NULL,
        web_device_id TEXT,
        auth_user_id TEXT,
        auth_user_email TEXT,
        product_id TEXT,
        payment_id TEXT,
        plan TEXT,
        source_path TEXT,
        landing_url TEXT,
        referrer TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL
      )
    `;
        const createEventsLinkIndexSql = `
      CREATE INDEX IF NOT EXISTS referral_events_link_type_created_idx
      ON referral_events (link_id, type, created_at DESC)
    `;
        const createEventsPaymentIndexSql = `
      CREATE INDEX IF NOT EXISTS referral_events_payment_idx
      ON referral_events (link_id, payment_id)
    `;
        if (isPgPool(database)) {
            await database.query(createLinksTableSql);
            await database.query(createLinksStatusIndexSql);
            await database.query(createEventsTableSql);
            await database.query(createEventsLinkIndexSql);
            await database.query(createEventsPaymentIndexSql);
        }
        else {
            database.exec(createLinksTableSql);
            database.exec(createLinksStatusIndexSql);
            database.exec(createEventsTableSql);
            database.exec(createEventsLinkIndexSql);
            database.exec(createEventsPaymentIndexSql);
        }
        referralTablesReady = true;
    })().finally(() => {
        referralTablesReadyPromise = null;
    });
    await referralTablesReadyPromise;
};
export const isReferralAdminUser = (user) => ADMIN_EMAILS.has(normalizeEmail(user?.email));
export const normalizeReferralCode = (value) => {
    const normalized = normalizeText(value)
        .toLowerCase()
        .replace(/[\s.]+/g, "-")
        .replace(/[^a-z0-9_-]/g, "")
        .replace(/-{2,}/g, "-")
        .replace(/_{2,}/g, "_")
        .replace(/^[-_]+|[-_]+$/g, "");
    return REFERRAL_CODE_PATTERN.test(normalized) ? normalized : "";
};
const createGeneratedReferralCode = () => Array.from({ length: 10 }, () => REFERRAL_CODE_CHARS[Math.floor(Math.random() * REFERRAL_CODE_CHARS.length)]).join("");
const isUniqueConstraintError = (error) => {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    return code === "23505" || message.includes("unique constraint") || message.includes("duplicate key");
};
const productLabels = {
    package_10: "Pack 100",
    package_50: "Pack 500",
    package_100: "Pack 1000",
    pro: "PRO",
    start: "START",
    ultra: "ULTRA",
};
const getProductLabel = (productId) => productLabels[productId] ?? productId.toUpperCase();
const rowToLink = (row) => {
    const status = normalizeText(row.status).toLowerCase() === "archived" ? "archived" : "active";
    return {
        assignedUserEmail: normalizeNullableEmail(row.assignedUserEmail),
        assignedUserId: normalizeNullableText(row.assignedUserId),
        code: normalizeText(row.code),
        createdAt: normalizeIsoString(row.createdAt),
        createdByUserEmail: normalizeNullableEmail(row.createdByUserEmail),
        createdByUserId: normalizeNullableText(row.createdByUserId),
        id: normalizeText(row.id),
        label: normalizeText(row.label),
        status,
        updatedAt: normalizeIsoString(row.updatedAt),
    };
};
const rowToEvent = (row) => ({
    authUserEmail: normalizeNullableEmail(row.authUserEmail),
    authUserId: normalizeNullableText(row.authUserId),
    code: normalizeText(row.code),
    createdAt: normalizeIsoString(row.createdAt),
    id: normalizeText(row.id),
    landingUrl: normalizeNullableText(row.landingUrl),
    linkId: normalizeText(row.linkId),
    metadata: normalizeNullableText(row.metadata),
    paymentId: normalizeNullableText(row.paymentId),
    plan: normalizeNullableText(row.plan),
    productId: normalizeText(row.productId),
    referrer: normalizeNullableText(row.referrer),
    sourcePath: normalizeNullableText(row.sourcePath),
    type: normalizeText(row.type),
    webDeviceId: normalizeNullableText(row.webDeviceId),
});
const getReferralLinkByCode = async (code) => {
    await ensureReferralTables();
    const rows = await queryRows(isPgPool(database)
        ? `
          SELECT
            id,
            code,
            label,
            assigned_user_id AS "assignedUserId",
            assigned_user_email AS "assignedUserEmail",
            status,
            created_by_user_id AS "createdByUserId",
            created_by_user_email AS "createdByUserEmail",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM referral_links
          WHERE code = $1 AND status = 'active'
          LIMIT 1
        `
        : `
          SELECT
            id,
            code,
            label,
            assigned_user_id AS "assignedUserId",
            assigned_user_email AS "assignedUserEmail",
            status,
            created_by_user_id AS "createdByUserId",
            created_by_user_email AS "createdByUserEmail",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM referral_links
          WHERE code = ? AND status = 'active'
          LIMIT 1
        `, [code]);
    return rows[0] ? rowToLink(rows[0]) : null;
};
const buildIdentityKey = (event) => event.authUserId || event.authUserEmail || event.webDeviceId || event.id;
const buildLinkStats = (linkId, events) => {
    const linkEvents = events.filter((event) => event.linkId === linkId);
    const clickEvents = linkEvents.filter((event) => event.type === "click");
    const purchaseEvents = linkEvents.filter((event) => event.type === "purchase");
    const uniqueVisitors = new Set(clickEvents.map(buildIdentityKey).filter(Boolean));
    const uniqueBuyers = new Set(purchaseEvents.map(buildIdentityKey).filter(Boolean));
    const productCounts = new Map();
    purchaseEvents.forEach((event) => {
        const productId = event.productId || "unknown";
        productCounts.set(productId, (productCounts.get(productId) ?? 0) + 1);
    });
    return {
        clicks: clickEvents.length,
        products: Array.from(productCounts.entries())
            .map(([productId, count]) => ({
            count,
            label: getProductLabel(productId),
            productId,
        }))
            .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
        purchases: purchaseEvents.length,
        recentPurchases: purchaseEvents
            .slice()
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .slice(0, 5)
            .map((event) => ({
            authUserEmail: event.authUserEmail,
            createdAt: event.createdAt,
            paymentId: event.paymentId,
            plan: event.plan,
            productId: event.productId || "unknown",
            productLabel: getProductLabel(event.productId || "unknown"),
        })),
        uniqueBuyers: uniqueBuyers.size,
        uniqueVisitors: uniqueVisitors.size,
    };
};
export async function listReferralLinks() {
    await ensureReferralTables();
    const linkRows = await queryRows(`
    SELECT
      id,
      code,
      label,
      assigned_user_id AS "assignedUserId",
      assigned_user_email AS "assignedUserEmail",
      status,
      created_by_user_id AS "createdByUserId",
      created_by_user_email AS "createdByUserEmail",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM referral_links
    ORDER BY updated_at DESC, created_at DESC
  `);
    const links = linkRows.map(rowToLink);
    if (!links.length) {
        return [];
    }
    const eventRows = await queryRows(`
    SELECT
      id,
      link_id AS "linkId",
      code,
      type,
      web_device_id AS "webDeviceId",
      auth_user_id AS "authUserId",
      auth_user_email AS "authUserEmail",
      product_id AS "productId",
      payment_id AS "paymentId",
      plan,
      source_path AS "sourcePath",
      landing_url AS "landingUrl",
      referrer,
      metadata,
      created_at AS "createdAt"
    FROM referral_events
    ORDER BY created_at DESC
  `);
    const events = eventRows.map(rowToEvent);
    return links.map((link) => ({
        ...link,
        stats: buildLinkStats(link.id, events),
    }));
}
export async function createReferralLink(input, user) {
    await ensureReferralTables();
    const requestedCode = normalizeReferralCode(input.code);
    if (normalizeText(input.code) && !requestedCode) {
        throw new Error("Referral code must be 3-64 latin letters, digits, dashes or underscores.");
    }
    const label = normalizeText(input.label);
    const assignedUserId = normalizeNullableText(input.assignedUserId);
    const assignedUserEmail = normalizeNullableEmail(input.assignedUserEmail);
    const now = new Date().toISOString();
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const code = requestedCode || createGeneratedReferralCode();
        try {
            await runStatement(isPgPool(database)
                ? `
              INSERT INTO referral_links (
                id,
                code,
                label,
                assigned_user_id,
                assigned_user_email,
                status,
                created_by_user_id,
                created_by_user_email,
                created_at,
                updated_at
              ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $8)
            `
                : `
              INSERT INTO referral_links (
                id,
                code,
                label,
                assigned_user_id,
                assigned_user_email,
                status,
                created_by_user_id,
                created_by_user_email,
                created_at,
                updated_at
              ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
            `, [
                randomUUID(),
                code,
                label || code,
                assignedUserId,
                assignedUserEmail,
                normalizeNullableText(user.id),
                normalizeNullableEmail(user.email),
                now,
                ...(isPgPool(database) ? [] : [now]),
            ]);
            return (await listReferralLinks()).find((link) => link.code === code);
        }
        catch (error) {
            if (requestedCode || !isUniqueConstraintError(error) || attempt === 5) {
                if (isUniqueConstraintError(error)) {
                    throw new Error("Referral code already exists.");
                }
                throw error;
            }
        }
    }
    throw new Error("Could not generate a unique referral code.");
}
export async function updateReferralLink(linkId, input) {
    const normalizedLinkId = normalizeText(linkId);
    if (!normalizedLinkId) {
        throw new Error("Referral link id is required.");
    }
    const statusInput = normalizeText(input.status).toLowerCase();
    const status = statusInput === "archived" ? "archived" : "active";
    const label = normalizeText(input.label);
    const assignedUserId = normalizeNullableText(input.assignedUserId);
    const assignedUserEmail = normalizeNullableEmail(input.assignedUserEmail);
    const now = new Date().toISOString();
    await ensureReferralTables();
    await runStatement(isPgPool(database)
        ? `
          UPDATE referral_links
          SET
            label = $2,
            assigned_user_id = $3,
            assigned_user_email = $4,
            status = $5,
            updated_at = $6
          WHERE id = $1
        `
        : `
          UPDATE referral_links
          SET
            label = ?,
            assigned_user_id = ?,
            assigned_user_email = ?,
            status = ?,
            updated_at = ?
          WHERE id = ?
        `, isPgPool(database)
        ? [normalizedLinkId, label, assignedUserId, assignedUserEmail, status, now]
        : [label, assignedUserId, assignedUserEmail, status, now, normalizedLinkId]);
    const nextLink = (await listReferralLinks()).find((link) => link.id === normalizedLinkId);
    if (!nextLink) {
        throw new Error("Referral link not found.");
    }
    return nextLink;
}
export async function recordReferralClick(input, user) {
    const code = normalizeReferralCode(input.code);
    if (!code)
        return null;
    const link = await getReferralLinkByCode(code);
    if (!link)
        return null;
    const webSignal = getCurrentAdsflowWebSignalContext();
    const now = new Date().toISOString();
    await runStatement(isPgPool(database)
        ? `
          INSERT INTO referral_events (
            id,
            link_id,
            code,
            type,
            web_device_id,
            auth_user_id,
            auth_user_email,
            source_path,
            landing_url,
            referrer,
            created_at
          ) VALUES ($1, $2, $3, 'click', $4, $5, $6, $7, $8, $9, $10)
        `
        : `
          INSERT INTO referral_events (
            id,
            link_id,
            code,
            type,
            web_device_id,
            auth_user_id,
            auth_user_email,
            source_path,
            landing_url,
            referrer,
            created_at
          ) VALUES (?, ?, ?, 'click', ?, ?, ?, ?, ?, ?, ?)
        `, [
        randomUUID(),
        link.id,
        link.code,
        webSignal?.webDeviceId ?? null,
        normalizeNullableText(user?.id),
        normalizeNullableEmail(user?.email),
        normalizeNullableText(input.sourcePath),
        normalizeNullableText(input.landingUrl),
        normalizeNullableText(input.referrer),
        now,
    ]);
    return (await listReferralLinks()).find((nextLink) => nextLink.id === link.id) ?? null;
}
export async function recordReferralPurchase(input, user) {
    const code = normalizeReferralCode(input.code);
    const productId = normalizeText(input.productId).toLowerCase();
    if (!code || !productId)
        return null;
    const link = await getReferralLinkByCode(code);
    if (!link)
        return null;
    const paymentId = normalizeNullableText(input.paymentId);
    if (paymentId) {
        const existingRows = await queryRows(isPgPool(database)
            ? "SELECT id FROM referral_events WHERE link_id = $1 AND payment_id = $2 AND type = 'purchase' LIMIT 1"
            : "SELECT id FROM referral_events WHERE link_id = ? AND payment_id = ? AND type = 'purchase' LIMIT 1", [link.id, paymentId]);
        if (existingRows.length) {
            return (await listReferralLinks()).find((nextLink) => nextLink.id === link.id) ?? null;
        }
    }
    const webSignal = getCurrentAdsflowWebSignalContext();
    const now = new Date().toISOString();
    const metadata = JSON.stringify({
        balance: normalizeNullableText(input.balance),
    });
    await runStatement(isPgPool(database)
        ? `
          INSERT INTO referral_events (
            id,
            link_id,
            code,
            type,
            web_device_id,
            auth_user_id,
            auth_user_email,
            product_id,
            payment_id,
            plan,
            metadata,
            created_at
          ) VALUES ($1, $2, $3, 'purchase', $4, $5, $6, $7, $8, $9, $10, $11)
        `
        : `
          INSERT INTO referral_events (
            id,
            link_id,
            code,
            type,
            web_device_id,
            auth_user_id,
            auth_user_email,
            product_id,
            payment_id,
            plan,
            metadata,
            created_at
          ) VALUES (?, ?, ?, 'purchase', ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
        randomUUID(),
        link.id,
        link.code,
        webSignal?.webDeviceId ?? null,
        normalizeNullableText(user?.id),
        normalizeNullableEmail(user?.email),
        productId,
        paymentId,
        normalizeNullableText(input.plan),
        metadata,
        now,
    ]);
    return (await listReferralLinks()).find((nextLink) => nextLink.id === link.id) ?? null;
}
export const readReferralCodeFromCookieHeader = (cookieHeader) => {
    const normalizedCookieHeader = typeof cookieHeader === "string" ? cookieHeader : "";
    if (!normalizedCookieHeader.trim()) {
        return "";
    }
    const prefix = `${REFERRAL_COOKIE_NAME}=`;
    const rawCookie = normalizedCookieHeader
        .split(";")
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(prefix));
    if (!rawCookie) {
        return "";
    }
    try {
        return normalizeReferralCode(decodeURIComponent(rawCookie.slice(prefix.length)));
    }
    catch {
        return normalizeReferralCode(rawCookie.slice(prefix.length));
    }
};
