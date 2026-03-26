import { Pool } from "pg";

import { database, type AuthDatabase } from "./database.js";

type WorkspaceUser = {
  email?: string | null;
  id?: string | null;
};

type QueryRow = Record<string, unknown>;

type AccountRow = {
  accountId: string;
  createdAt: unknown;
  providerId: string;
};

export type ExternalUserIdentity = {
  aliases: string[];
  preferred: string;
};

const TELEGRAM_OAUTH_EMAIL_RE = /^telegram-[^@]+@users\.adshorts\.local$/i;

const isPgPool = (value: AuthDatabase): value is Pool => value instanceof Pool;

const normalizeText = (value: unknown) => String(value ?? "").trim();

const queryRows = async <TRow extends QueryRow>(sql: string, params: readonly unknown[] = []) => {
  if (isPgPool(database)) {
    const result = await database.query<TRow>(sql, [...params]);
    return result.rows;
  }

  return database.prepare(sql).all(...(params as never[])) as TRow[];
};

const getAccountRows = async (userId: string) => {
  if (!userId) return [] as AccountRow[];

  return queryRows<AccountRow>(
    `
      SELECT
        "providerId" AS "providerId",
        "accountId" AS "accountId",
        "createdAt" AS "createdAt"
      FROM "account"
      WHERE "userId" = ${isPgPool(database) ? "$1" : "?"}
    `,
    [userId],
  );
};

const getProviderPriority = (providerId: string) => {
  const normalized = providerId.toLowerCase();

  switch (normalized) {
    case "google":
      return 0;
    case "telegram":
      return 1;
    case "credential":
      return 3;
    default:
      return 2;
  }
};

const addIdentity = (values: string[], nextValue: string) => {
  const normalized = normalizeText(nextValue);
  if (!normalized || values.includes(normalized)) return;
  values.push(normalized);
};

export const buildExternalUserId = (user: WorkspaceUser) => {
  const userId = normalizeText(user.id);
  if (userId) return `better-auth:${userId}`;

  const email = normalizeText(user.email).toLowerCase();
  if (email) return `email:${email}`;

  throw new Error("Authenticated user identifier is missing.");
};

export async function resolveExternalUserIdentity(user: WorkspaceUser): Promise<ExternalUserIdentity> {
  const userId = normalizeText(user.id);
  const email = normalizeText(user.email).toLowerCase();
  const aliases: string[] = [];

  const accountRows = userId
    ? (await getAccountRows(userId)).sort((left, right) => {
        const priorityDiff = getProviderPriority(left.providerId) - getProviderPriority(right.providerId);
        if (priorityDiff !== 0) return priorityDiff;
        return normalizeText(left.createdAt).localeCompare(normalizeText(right.createdAt));
      })
    : [];

  for (const row of accountRows) {
    const providerId = normalizeText(row.providerId).toLowerCase();
    const accountId = normalizeText(row.accountId);

    if (!providerId || !accountId || providerId === "credential") continue;
    addIdentity(aliases, `${providerId}:${accountId}`);
  }

  if (email && !TELEGRAM_OAUTH_EMAIL_RE.test(email)) {
    addIdentity(aliases, `email:${email}`);
  }

  for (const row of accountRows) {
    const providerId = normalizeText(row.providerId).toLowerCase();
    const accountId = normalizeText(row.accountId);

    if (!providerId || !accountId || providerId !== "credential") continue;
    addIdentity(aliases, `${providerId}:${accountId}`);
  }

  if (userId) {
    addIdentity(aliases, `better-auth:${userId}`);
  }

  if (!aliases.length) {
    addIdentity(aliases, buildExternalUserId(user));
  }

  return {
    aliases,
    preferred: aliases[0],
  };
}
