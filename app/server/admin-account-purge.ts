import type { DatabaseSync as SqliteDatabaseSync } from "node:sqlite";

import { Pool, type PoolClient } from "pg";

import { database, type AuthDatabase } from "./database.js";

type QueryRow = Record<string, unknown>;

type SqlExecutor = {
  isPostgres: boolean;
  columnNames(tableName: string): Promise<Set<string>>;
  queryRows<TRow extends QueryRow>(sql: string, params?: readonly unknown[]): Promise<TRow[]>;
  runStatement(sql: string, params?: readonly unknown[]): Promise<number>;
  tableExists(tableName: string): Promise<boolean>;
};

export type AdminAccountPurgeInput = {
  authUserId?: unknown;
  authUserIds?: readonly unknown[] | null;
  email?: unknown;
  emails?: readonly unknown[] | null;
  externalUserId?: unknown;
  externalUserIds?: readonly unknown[] | null;
  ownerKeys?: readonly unknown[] | null;
  providerAccountId?: unknown;
  providerAccountIds?: readonly unknown[] | null;
};

export type AdminAccountPurgeResult = {
  authUserIds: string[];
  cacheFragments: string[];
  counts: Record<string, number>;
  emails: string[];
  externalUserIds: string[];
  ownerKeys: string[];
  providerAccountIds: string[];
};

type ExternalIdentity = {
  accountId: string;
  provider: string;
  raw: string;
};

const AUTH_WORKSPACE_TABLES = new Set([
  "account",
  "session",
  "user",
  "verification",
  "workspace_content_plan_ideas",
  "workspace_content_plans",
  "workspace_deleted_projects",
  "workspace_generation_history",
]);

const isPgPool = (value: AuthDatabase): value is Pool => value instanceof Pool;

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizeEmail = (value: unknown) => {
  const normalized = normalizeText(value).toLowerCase();
  return normalized.includes("@") ? normalized : "";
};

const uniqueValues = (values: Iterable<string>) => Array.from(new Set(Array.from(values).filter(Boolean))).sort();

const normalizeList = (values: readonly unknown[] | null | undefined) =>
  Array.isArray(values) ? values.map(normalizeText).filter(Boolean) : [];

const addNormalized = (values: Set<string>, value: unknown) => {
  const normalized = normalizeText(value);
  if (normalized) {
    values.add(normalized);
  }
};

const addNormalizedEmail = (values: Set<string>, value: unknown) => {
  const normalized = normalizeEmail(value);
  if (normalized) {
    values.add(normalized);
  }
};

const parseExternalIdentity = (value: unknown): ExternalIdentity | null => {
  const raw = normalizeText(value);
  if (!raw) return null;

  if (!raw.includes(":")) {
    return { accountId: raw, provider: "", raw };
  }

  const [providerValue, ...accountParts] = raw.split(":");
  const provider = normalizeText(providerValue).toLowerCase();
  const accountId = normalizeText(accountParts.join(":"));
  if (!accountId) {
    return null;
  }

  return { accountId, provider, raw };
};

const assertSafeTableName = (tableName: string) => {
  if (!AUTH_WORKSPACE_TABLES.has(tableName)) {
    throw new Error(`Unexpected table name for account purge: ${tableName}`);
  }
};

const quoteSqliteIdentifier = (identifier: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe sqlite identifier: ${identifier}`);
  }

  return `"${identifier.replace(/"/g, '""')}"`;
};

const normalizeSqliteParam = (value: unknown) => {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return value ?? null;
};

const normalizeSqliteParams = (params: readonly unknown[]) => params.map((param) => normalizeSqliteParam(param));

const buildInClause = (executor: SqlExecutor, count: number, startIndex = 1) => {
  if (count <= 0) {
    throw new Error("IN clause requires at least one value.");
  }

  return Array.from({ length: count }, (_, index) => (executor.isPostgres ? `$${startIndex + index}` : "?")).join(", ");
};

const appendInClause = (
  executor: SqlExecutor,
  clauses: string[],
  params: unknown[],
  expression: string,
  values: readonly string[],
) => {
  if (!values.length) return;
  clauses.push(`${expression} IN (${buildInClause(executor, values.length, params.length + 1)})`);
  params.push(...values);
};

const createPostgresExecutor = (client: PoolClient): SqlExecutor => {
  const tableExistsCache = new Map<string, boolean>();
  const columnNamesCache = new Map<string, Set<string>>();

  return {
    isPostgres: true,
    async columnNames(tableName: string) {
      assertSafeTableName(tableName);
      const cached = columnNamesCache.get(tableName);
      if (cached) return cached;

      const result = await client.query<{ columnName: string }>(
        `
          SELECT column_name AS "columnName"
          FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = $1
        `,
        [tableName],
      );
      const columns = new Set(result.rows.map((row) => normalizeText(row.columnName)).filter(Boolean));
      columnNamesCache.set(tableName, columns);
      return columns;
    },
    async queryRows<TRow extends QueryRow>(sql: string, params: readonly unknown[] = []) {
      const result = await client.query<TRow>(sql, [...params]);
      return result.rows;
    },
    async runStatement(sql: string, params: readonly unknown[] = []) {
      const result = await client.query(sql, [...params]);
      return Math.max(0, Number(result.rowCount ?? 0));
    },
    async tableExists(tableName: string) {
      assertSafeTableName(tableName);
      const cached = tableExistsCache.get(tableName);
      if (cached != null) return cached;

      const result = await client.query<{ exists: boolean }>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema() AND table_name = $1
          ) AS "exists"
        `,
        [tableName],
      );
      const exists = Boolean(result.rows[0]?.exists);
      tableExistsCache.set(tableName, exists);
      return exists;
    },
  };
};

const createSqliteExecutor = (sqliteDatabase: SqliteDatabaseSync): SqlExecutor => {
  const tableExistsCache = new Map<string, boolean>();
  const columnNamesCache = new Map<string, Set<string>>();

  return {
    isPostgres: false,
    async columnNames(tableName: string) {
      assertSafeTableName(tableName);
      const cached = columnNamesCache.get(tableName);
      if (cached) return cached;

      const rows = sqliteDatabase.prepare(`PRAGMA table_info(${quoteSqliteIdentifier(tableName)})`).all() as Array<{
        name?: unknown;
      }>;
      const columns = new Set(rows.map((row) => normalizeText(row.name)).filter(Boolean));
      columnNamesCache.set(tableName, columns);
      return columns;
    },
    async queryRows<TRow extends QueryRow>(sql: string, params: readonly unknown[] = []) {
      return sqliteDatabase.prepare(sql).all(...(normalizeSqliteParams(params) as never[])) as TRow[];
    },
    async runStatement(sql: string, params: readonly unknown[] = []) {
      const result = sqliteDatabase.prepare(sql).run(...(normalizeSqliteParams(params) as never[]));
      return Math.max(0, Number(result.changes ?? 0));
    },
    async tableExists(tableName: string) {
      assertSafeTableName(tableName);
      const cached = tableExistsCache.get(tableName);
      if (cached != null) return cached;

      const row = sqliteDatabase
        .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
        .get(tableName) as { present?: unknown } | undefined;
      const exists = Boolean(row?.present);
      tableExistsCache.set(tableName, exists);
      return exists;
    },
  };
};

const runPurgeTransaction = async <T>(
  authDatabase: AuthDatabase,
  callback: (executor: SqlExecutor) => Promise<T>,
) => {
  if (isPgPool(authDatabase)) {
    const client = await authDatabase.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(createPostgresExecutor(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  authDatabase.exec("BEGIN IMMEDIATE");
  try {
    const result = await callback(createSqliteExecutor(authDatabase));
    authDatabase.exec("COMMIT");
    return result;
  } catch (error) {
    authDatabase.exec("ROLLBACK");
    throw error;
  }
};

const selectAuthUsers = async (executor: SqlExecutor, authUserIds: Set<string>, emails: Set<string>) => {
  if (!(await executor.tableExists("user"))) {
    return;
  }

  const columns = await executor.columnNames("user");
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (columns.has("id")) {
    appendInClause(executor, clauses, params, '"id"', uniqueValues(authUserIds));
  }
  if (columns.has("email")) {
    appendInClause(executor, clauses, params, 'lower("email")', uniqueValues(emails));
  }
  if (!clauses.length) {
    return;
  }

  const rows = await executor.queryRows<{ email?: unknown; id?: unknown }>(
    `
      SELECT
        ${columns.has("id") ? '"id"' : "NULL"} AS "id",
        ${columns.has("email") ? '"email"' : "NULL"} AS "email"
      FROM "user"
      WHERE ${clauses.join(" OR ")}
    `,
    params,
  );

  for (const row of rows) {
    addNormalized(authUserIds, row.id);
    addNormalizedEmail(emails, row.email);
  }
};

const selectAuthAccounts = async (
  executor: SqlExecutor,
  authUserIds: Set<string>,
  providerAccountIds: Set<string>,
) => {
  if (!(await executor.tableExists("account"))) {
    return;
  }

  const columns = await executor.columnNames("account");
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (columns.has("userId")) {
    appendInClause(executor, clauses, params, '"userId"', uniqueValues(authUserIds));
  }
  if (columns.has("accountId")) {
    appendInClause(executor, clauses, params, '"accountId"', uniqueValues(providerAccountIds));
  }
  if (!clauses.length) {
    return;
  }

  const rows = await executor.queryRows<{ accountId?: unknown; providerId?: unknown; userId?: unknown }>(
    `
      SELECT
        ${columns.has("userId") ? '"userId"' : "NULL"} AS "userId",
        ${columns.has("providerId") ? '"providerId"' : "NULL"} AS "providerId",
        ${columns.has("accountId") ? '"accountId"' : "NULL"} AS "accountId"
      FROM "account"
      WHERE ${clauses.join(" OR ")}
    `,
    params,
  );

  for (const row of rows) {
    addNormalized(authUserIds, row.userId);
    addNormalized(providerAccountIds, row.accountId);
  }
};

const deleteWhere = async (
  executor: SqlExecutor,
  tableName: string,
  clauses: string[],
  params: readonly unknown[],
) => {
  assertSafeTableName(tableName);
  if (!clauses.length || !(await executor.tableExists(tableName))) {
    return 0;
  }

  return executor.runStatement(`DELETE FROM ${quoteSqliteIdentifier(tableName)} WHERE ${clauses.join(" OR ")}`, params);
};

const deleteWorkspaceContentPlans = async (
  executor: SqlExecutor,
  ownerKeys: readonly string[],
  counts: Record<string, number>,
) => {
  if (!ownerKeys.length || !(await executor.tableExists("workspace_content_plans"))) {
    return;
  }

  const planColumns = await executor.columnNames("workspace_content_plans");
  if (!planColumns.has("id") || !planColumns.has("owner_key")) {
    return;
  }

  const ownerClause = buildInClause(executor, ownerKeys.length);
  const planRows = await executor.queryRows<{ id?: unknown }>(
    `SELECT id FROM workspace_content_plans WHERE owner_key IN (${ownerClause})`,
    ownerKeys,
  );
  const planIds = uniqueValues(planRows.map((row) => normalizeText(row.id)));

  if (planIds.length && (await executor.tableExists("workspace_content_plan_ideas"))) {
    const ideaColumns = await executor.columnNames("workspace_content_plan_ideas");
    if (ideaColumns.has("plan_id")) {
      const planIdClause = buildInClause(executor, planIds.length);
      counts.workspace_content_plan_ideas = await executor.runStatement(
        `DELETE FROM workspace_content_plan_ideas WHERE plan_id IN (${planIdClause})`,
        planIds,
      );
    }
  }

  counts.workspace_content_plans = await executor.runStatement(
    `DELETE FROM workspace_content_plans WHERE owner_key IN (${ownerClause})`,
    ownerKeys,
  );
};

const deleteWorkspaceOwnerRows = async (
  executor: SqlExecutor,
  tableName: "workspace_deleted_projects" | "workspace_generation_history",
  ownerKeys: readonly string[],
  counts: Record<string, number>,
) => {
  if (!ownerKeys.length || !(await executor.tableExists(tableName))) {
    return;
  }

  const columns = await executor.columnNames(tableName);
  if (!columns.has("owner_key")) {
    return;
  }

  const ownerClause = buildInClause(executor, ownerKeys.length);
  counts[tableName] = await executor.runStatement(
    `DELETE FROM ${tableName} WHERE owner_key IN (${ownerClause})`,
    ownerKeys,
  );
};

const deleteAuthRows = async (
  executor: SqlExecutor,
  authUserIds: readonly string[],
  providerAccountIds: readonly string[],
  emails: readonly string[],
  counts: Record<string, number>,
) => {
  if (authUserIds.length && (await executor.tableExists("session"))) {
    const columns = await executor.columnNames("session");
    if (columns.has("userId")) {
      const userIdClause = buildInClause(executor, authUserIds.length);
      counts.better_auth_sessions = await executor.runStatement(
        `DELETE FROM "session" WHERE "userId" IN (${userIdClause})`,
        authUserIds,
      );
    }
  }

  if ((authUserIds.length || providerAccountIds.length) && (await executor.tableExists("account"))) {
    const columns = await executor.columnNames("account");
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (columns.has("userId")) {
      appendInClause(executor, clauses, params, '"userId"', authUserIds);
    }
    if (columns.has("accountId")) {
      appendInClause(executor, clauses, params, '"accountId"', providerAccountIds);
    }
    counts.better_auth_accounts = await deleteWhere(executor, "account", clauses, params);
  }

  if (emails.length && (await executor.tableExists("verification"))) {
    const columns = await executor.columnNames("verification");
    if (columns.has("identifier")) {
      const emailClause = buildInClause(executor, emails.length);
      counts.better_auth_verifications = await executor.runStatement(
        `DELETE FROM "verification" WHERE lower("identifier") IN (${emailClause})`,
        emails,
      );
    }
  }

  if ((authUserIds.length || emails.length) && (await executor.tableExists("user"))) {
    const columns = await executor.columnNames("user");
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (columns.has("id")) {
      appendInClause(executor, clauses, params, '"id"', authUserIds);
    }
    if (columns.has("email")) {
      appendInClause(executor, clauses, params, 'lower("email")', emails);
    }
    counts.better_auth_users = await deleteWhere(executor, "user", clauses, params);
  }
};

export async function purgeAdminAccountData(
  input: AdminAccountPurgeInput,
  authDatabase: AuthDatabase = database,
): Promise<AdminAccountPurgeResult> {
  const authUserIds = new Set<string>(normalizeList(input.authUserIds));
  const providerAccountIds = new Set<string>(normalizeList(input.providerAccountIds));
  const emails = new Set<string>();
  const externalUserIds = new Set<string>(normalizeList(input.externalUserIds));
  const ownerKeys = new Set<string>(normalizeList(input.ownerKeys));

  addNormalized(authUserIds, input.authUserId);
  addNormalized(providerAccountIds, input.providerAccountId);
  addNormalized(externalUserIds, input.externalUserId);
  addNormalizedEmail(emails, input.email);
  for (const email of normalizeList(input.emails)) {
    addNormalizedEmail(emails, email);
  }

  for (const externalUserId of externalUserIds) {
    const identity = parseExternalIdentity(externalUserId);
    if (!identity) continue;

    addNormalized(providerAccountIds, identity.accountId);
    if (identity.provider === "better-auth" || identity.provider === "user") {
      addNormalized(authUserIds, identity.accountId);
    }
  }

  const counts: Record<string, number> = {};

  return runPurgeTransaction(authDatabase, async (executor) => {
    await selectAuthUsers(executor, authUserIds, emails);
    await selectAuthAccounts(executor, authUserIds, providerAccountIds);
    await selectAuthUsers(executor, authUserIds, emails);

    for (const authUserId of authUserIds) {
      ownerKeys.add(authUserId);
      ownerKeys.add(`user:${authUserId}`);
    }
    for (const email of emails) {
      ownerKeys.add(email);
      ownerKeys.add(`email:${email}`);
      ownerKeys.add(`user:${email}`);
    }
    for (const externalUserId of externalUserIds) {
      ownerKeys.add(externalUserId);
      const identity = parseExternalIdentity(externalUserId);
      if (!identity) continue;
      ownerKeys.add(identity.accountId);
      ownerKeys.add(`user:${identity.accountId}`);
      if (identity.provider) {
        ownerKeys.add(`${identity.provider}:${identity.accountId}`);
      }
    }

    const normalizedOwnerKeys = uniqueValues(ownerKeys);
    await deleteWorkspaceContentPlans(executor, normalizedOwnerKeys, counts);
    await deleteWorkspaceOwnerRows(executor, "workspace_deleted_projects", normalizedOwnerKeys, counts);
    await deleteWorkspaceOwnerRows(executor, "workspace_generation_history", normalizedOwnerKeys, counts);

    const normalizedAuthUserIds = uniqueValues(authUserIds);
    const normalizedProviderAccountIds = uniqueValues(providerAccountIds);
    const normalizedEmails = uniqueValues(emails);
    await deleteAuthRows(executor, normalizedAuthUserIds, normalizedProviderAccountIds, normalizedEmails, counts);

    const normalizedExternalUserIds = uniqueValues(externalUserIds);
    const cacheFragments = uniqueValues([
      ...normalizedAuthUserIds,
      ...normalizedProviderAccountIds,
      ...normalizedEmails,
      ...normalizedExternalUserIds,
      ...normalizedOwnerKeys,
    ]);

    return {
      authUserIds: normalizedAuthUserIds,
      cacheFragments,
      counts,
      emails: normalizedEmails,
      externalUserIds: normalizedExternalUserIds,
      ownerKeys: normalizedOwnerKeys,
      providerAccountIds: normalizedProviderAccountIds,
    };
  });
}
