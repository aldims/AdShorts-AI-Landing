import { Pool } from "pg";

import { database, type AuthDatabase } from "./database.js";
import { parseGenerationHashtags, serializeGenerationHashtags } from "./generation-metadata.js";

type WorkspaceHistoryUser = {
  email?: string | null;
  id?: string | null;
};

type QueryRow = Record<string, unknown>;

export type WorkspaceGenerationHistoryEntry = {
  adId: number | null;
  createdAt: string;
  description: string;
  downloadPath: string | null;
  error: string | null;
  finalAssetExpiresAt: string | null;
  finalAssetId: number | null;
  finalAssetKind: string | null;
  finalAssetStatus: string | null;
  generatedAt: string | null;
  hashtags: string[];
  jobId: string;
  prompt: string;
  status: string;
  title: string;
  updatedAt: string;
};

type WorkspaceGenerationHistorySnapshot = {
  adId?: number | null;
  createdAt?: string | null;
  description?: string | null;
  downloadPath?: string | null;
  error?: string | null;
  finalAssetExpiresAt?: string | null;
  finalAssetId?: number | null;
  finalAssetKind?: string | null;
  finalAssetStatus?: string | null;
  generatedAt?: string | null;
  hashtags?: string[] | string | null;
  jobId: string;
  prompt?: string | null;
  status?: string | null;
  title?: string | null;
  updatedAt?: string | null;
};

export type WorkspaceDeletedProjectEntry = {
  adId: number | null;
  deletedAt: string;
  jobId: string | null;
  projectId: string;
};

type WorkspaceDeletedProjectSnapshot = {
  adId?: number | null;
  deletedAt?: string | null;
  jobId?: string | null;
  projectId: string;
};

const isPgPool = (value: AuthDatabase): value is Pool => value instanceof Pool;

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizeIsoString = (value: unknown, fallback = new Date().toISOString()) => {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
};

const toNullableInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
};

const getWorkspaceHistoryOwnerKey = (user: WorkspaceHistoryUser) => {
  const userId = normalizeText(user.id);
  if (userId) return `user:${userId}`;

  const email = normalizeText(user.email).toLowerCase();
  return email ? `email:${email}` : null;
};

let workspaceHistoryTableReady = false;
let workspaceHistoryTableReadyPromise: Promise<void> | null = null;
let workspaceDeletedProjectsTableReady = false;
let workspaceDeletedProjectsTableReadyPromise: Promise<void> | null = null;

const runStatement = async (sql: string, params: readonly unknown[] = []) => {
  if (isPgPool(database)) {
    await database.query(sql, [...params]);
    return;
  }

  database.prepare(sql).run(...(params as never[]));
};

const queryRows = async <TRow extends QueryRow>(sql: string, params: readonly unknown[] = []) => {
  if (isPgPool(database)) {
    const result = await database.query<TRow>(sql, [...params]);
    return result.rows;
  }

  return database.prepare(sql).all(...(params as never[])) as TRow[];
};

const ensureWorkspaceHistoryTable = async () => {
  if (workspaceHistoryTableReady) return;
  if (workspaceHistoryTableReadyPromise) {
    await workspaceHistoryTableReadyPromise;
    return;
  }

  workspaceHistoryTableReadyPromise = (async () => {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS workspace_generation_history (
        job_id TEXT PRIMARY KEY,
        owner_key TEXT NOT NULL,
        prompt TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'queued',
        error TEXT,
        ad_id BIGINT,
        hashtags TEXT NOT NULL DEFAULT '',
        download_path TEXT,
        final_asset_id BIGINT,
        final_asset_kind TEXT,
        final_asset_status TEXT,
        final_asset_expires_at TEXT,
        generated_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;
    const createIndexSql = `
      CREATE INDEX IF NOT EXISTS workspace_generation_history_owner_updated_idx
      ON workspace_generation_history (owner_key, updated_at DESC)
    `;
    const addHashtagsColumnSql = `
      ALTER TABLE workspace_generation_history
      ADD COLUMN hashtags TEXT NOT NULL DEFAULT ''
    `;
    const addHashtagsColumnIfNotExistsSql = `
      ALTER TABLE workspace_generation_history
      ADD COLUMN IF NOT EXISTS hashtags TEXT NOT NULL DEFAULT ''
    `;
    const addFinalAssetIdColumnSql = `
      ALTER TABLE workspace_generation_history
      ADD COLUMN final_asset_id BIGINT
    `;
    const addFinalAssetIdColumnIfNotExistsSql = `
      ALTER TABLE workspace_generation_history
      ADD COLUMN IF NOT EXISTS final_asset_id BIGINT
    `;
    const addFinalAssetKindColumnSql = `
      ALTER TABLE workspace_generation_history
      ADD COLUMN final_asset_kind TEXT
    `;
    const addFinalAssetKindColumnIfNotExistsSql = `
      ALTER TABLE workspace_generation_history
      ADD COLUMN IF NOT EXISTS final_asset_kind TEXT
    `;
    const addFinalAssetStatusColumnSql = `
      ALTER TABLE workspace_generation_history
      ADD COLUMN final_asset_status TEXT
    `;
    const addFinalAssetStatusColumnIfNotExistsSql = `
      ALTER TABLE workspace_generation_history
      ADD COLUMN IF NOT EXISTS final_asset_status TEXT
    `;
    const addFinalAssetExpiresAtColumnSql = `
      ALTER TABLE workspace_generation_history
      ADD COLUMN final_asset_expires_at TEXT
    `;
    const addFinalAssetExpiresAtColumnIfNotExistsSql = `
      ALTER TABLE workspace_generation_history
      ADD COLUMN IF NOT EXISTS final_asset_expires_at TEXT
    `;

    if (isPgPool(database)) {
      await database.query(createTableSql);
      await database.query(createIndexSql);
      await database.query(addHashtagsColumnIfNotExistsSql);
      await database.query(addFinalAssetIdColumnIfNotExistsSql);
      await database.query(addFinalAssetKindColumnIfNotExistsSql);
      await database.query(addFinalAssetStatusColumnIfNotExistsSql);
      await database.query(addFinalAssetExpiresAtColumnIfNotExistsSql);
    } else {
      database.exec(createTableSql);
      database.exec(createIndexSql);
      try {
        database.exec(addHashtagsColumnSql);
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (!message.includes("duplicate column name")) {
          throw error;
        }
      }
      for (const statement of [
        addFinalAssetIdColumnSql,
        addFinalAssetKindColumnSql,
        addFinalAssetStatusColumnSql,
        addFinalAssetExpiresAtColumnSql,
      ]) {
        try {
          database.exec(statement);
        } catch (error) {
          const message = error instanceof Error ? error.message.toLowerCase() : "";
          if (!message.includes("duplicate column name")) {
            throw error;
          }
        }
      }
    }

    workspaceHistoryTableReady = true;
  })().finally(() => {
    workspaceHistoryTableReadyPromise = null;
  });

  await workspaceHistoryTableReadyPromise;
};

const ensureWorkspaceDeletedProjectsTable = async () => {
  if (workspaceDeletedProjectsTableReady) return;
  if (workspaceDeletedProjectsTableReadyPromise) {
    await workspaceDeletedProjectsTableReadyPromise;
    return;
  }

  workspaceDeletedProjectsTableReadyPromise = (async () => {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS workspace_deleted_projects (
        owner_key TEXT NOT NULL,
        project_id TEXT NOT NULL,
        ad_id BIGINT,
        job_id TEXT,
        deleted_at TEXT NOT NULL,
        PRIMARY KEY (owner_key, project_id)
      )
    `;
    const createIndexSql = `
      CREATE INDEX IF NOT EXISTS workspace_deleted_projects_owner_deleted_idx
      ON workspace_deleted_projects (owner_key, deleted_at DESC)
    `;

    if (isPgPool(database)) {
      await database.query(createTableSql);
      await database.query(createIndexSql);
    } else {
      database.exec(createTableSql);
      database.exec(createIndexSql);
    }

    workspaceDeletedProjectsTableReady = true;
  })().finally(() => {
    workspaceDeletedProjectsTableReadyPromise = null;
  });

  await workspaceDeletedProjectsTableReadyPromise;
};

export async function saveWorkspaceGenerationHistory(
  user: WorkspaceHistoryUser,
  snapshot: WorkspaceGenerationHistorySnapshot,
): Promise<void> {
  const ownerKey = getWorkspaceHistoryOwnerKey(user);
  const jobId = normalizeText(snapshot.jobId);
  if (!ownerKey || !jobId) return;

  await ensureWorkspaceHistoryTable();

  const createdAt = normalizeIsoString(snapshot.createdAt);
  const updatedAt = normalizeIsoString(snapshot.updatedAt, createdAt);
  const prompt = normalizeText(snapshot.prompt);
  const title = normalizeText(snapshot.title);
  const description = normalizeText(snapshot.description);
  const status = normalizeText(snapshot.status) || "queued";
  const error = normalizeText(snapshot.error) || null;
  const adId = toNullableInteger(snapshot.adId);
  const downloadPath = normalizeText(snapshot.downloadPath) || null;
  const finalAssetId = toNullableInteger(snapshot.finalAssetId);
  const finalAssetKind = normalizeText(snapshot.finalAssetKind) || null;
  const finalAssetStatus = normalizeText(snapshot.finalAssetStatus) || null;
  const finalAssetExpiresAt = normalizeText(snapshot.finalAssetExpiresAt)
    ? normalizeIsoString(snapshot.finalAssetExpiresAt)
    : null;
  const generatedAt = normalizeText(snapshot.generatedAt) ? normalizeIsoString(snapshot.generatedAt) : null;
  const hashtags = serializeGenerationHashtags(snapshot.hashtags);

  const sql = isPgPool(database)
    ? `
        INSERT INTO workspace_generation_history (
          job_id,
          owner_key,
          prompt,
          title,
          description,
          status,
          error,
          ad_id,
          hashtags,
          download_path,
          final_asset_id,
          final_asset_kind,
          final_asset_status,
          final_asset_expires_at,
          generated_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (job_id) DO UPDATE SET
          owner_key = EXCLUDED.owner_key,
          prompt = CASE
            WHEN workspace_generation_history.prompt <> '' THEN workspace_generation_history.prompt
            WHEN EXCLUDED.prompt <> '' THEN EXCLUDED.prompt
            ELSE workspace_generation_history.prompt
          END,
          title = CASE WHEN EXCLUDED.title <> '' THEN EXCLUDED.title ELSE workspace_generation_history.title END,
          description = CASE
            WHEN EXCLUDED.description <> '' THEN EXCLUDED.description
            ELSE workspace_generation_history.description
          END,
          hashtags = CASE
            WHEN EXCLUDED.hashtags <> '' THEN EXCLUDED.hashtags
            ELSE workspace_generation_history.hashtags
          END,
          status = EXCLUDED.status,
          error = EXCLUDED.error,
          ad_id = COALESCE(EXCLUDED.ad_id, workspace_generation_history.ad_id),
          download_path = COALESCE(EXCLUDED.download_path, workspace_generation_history.download_path),
          final_asset_id = COALESCE(EXCLUDED.final_asset_id, workspace_generation_history.final_asset_id),
          final_asset_kind = COALESCE(EXCLUDED.final_asset_kind, workspace_generation_history.final_asset_kind),
          final_asset_status = COALESCE(EXCLUDED.final_asset_status, workspace_generation_history.final_asset_status),
          final_asset_expires_at = COALESCE(
            EXCLUDED.final_asset_expires_at,
            workspace_generation_history.final_asset_expires_at
          ),
          generated_at = COALESCE(EXCLUDED.generated_at, workspace_generation_history.generated_at),
          updated_at = EXCLUDED.updated_at
      `
    : `
        INSERT INTO workspace_generation_history (
          job_id,
          owner_key,
          prompt,
          title,
          description,
          status,
          error,
          ad_id,
          hashtags,
          download_path,
          final_asset_id,
          final_asset_kind,
          final_asset_status,
          final_asset_expires_at,
          generated_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(job_id) DO UPDATE SET
          owner_key = excluded.owner_key,
          prompt = CASE
            WHEN workspace_generation_history.prompt <> '' THEN workspace_generation_history.prompt
            WHEN excluded.prompt <> '' THEN excluded.prompt
            ELSE workspace_generation_history.prompt
          END,
          title = CASE WHEN excluded.title <> '' THEN excluded.title ELSE workspace_generation_history.title END,
          description = CASE
            WHEN excluded.description <> '' THEN excluded.description
            ELSE workspace_generation_history.description
          END,
          hashtags = CASE
            WHEN excluded.hashtags <> '' THEN excluded.hashtags
            ELSE workspace_generation_history.hashtags
          END,
          status = excluded.status,
          error = excluded.error,
          ad_id = COALESCE(excluded.ad_id, workspace_generation_history.ad_id),
          download_path = COALESCE(excluded.download_path, workspace_generation_history.download_path),
          final_asset_id = COALESCE(excluded.final_asset_id, workspace_generation_history.final_asset_id),
          final_asset_kind = COALESCE(excluded.final_asset_kind, workspace_generation_history.final_asset_kind),
          final_asset_status = COALESCE(excluded.final_asset_status, workspace_generation_history.final_asset_status),
          final_asset_expires_at = COALESCE(
            excluded.final_asset_expires_at,
            workspace_generation_history.final_asset_expires_at
          ),
          generated_at = COALESCE(excluded.generated_at, workspace_generation_history.generated_at),
          updated_at = excluded.updated_at
      `;

  await runStatement(sql, [
    jobId,
    ownerKey,
    prompt,
    title,
    description,
    status,
    error,
    adId,
    hashtags,
    downloadPath,
    finalAssetId,
    finalAssetKind,
    finalAssetStatus,
    finalAssetExpiresAt,
    generatedAt,
    createdAt,
    updatedAt,
  ]);
}

export async function listWorkspaceGenerationHistory(
  user: WorkspaceHistoryUser,
  limit = 60,
): Promise<WorkspaceGenerationHistoryEntry[]> {
  const ownerKey = getWorkspaceHistoryOwnerKey(user);
  if (!ownerKey) return [];

  await ensureWorkspaceHistoryTable();

  const safeLimit = Math.max(1, Math.min(Math.trunc(limit || 60), 200));
  const sql = isPgPool(database)
    ? `
        SELECT
          job_id AS "jobId",
          prompt AS "prompt",
          title AS "title",
          description AS "description",
          status AS "status",
          error AS "error",
          ad_id AS "adId",
          hashtags AS "hashtags",
          download_path AS "downloadPath",
          final_asset_id AS "finalAssetId",
          final_asset_kind AS "finalAssetKind",
          final_asset_status AS "finalAssetStatus",
          final_asset_expires_at AS "finalAssetExpiresAt",
          generated_at AS "generatedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM workspace_generation_history
        WHERE owner_key = $1
        ORDER BY updated_at DESC, created_at DESC
        LIMIT $2
      `
    : `
        SELECT
          job_id AS "jobId",
          prompt AS "prompt",
          title AS "title",
          description AS "description",
          status AS "status",
          error AS "error",
          ad_id AS "adId",
          hashtags AS "hashtags",
          download_path AS "downloadPath",
          final_asset_id AS "finalAssetId",
          final_asset_kind AS "finalAssetKind",
          final_asset_status AS "finalAssetStatus",
          final_asset_expires_at AS "finalAssetExpiresAt",
          generated_at AS "generatedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM workspace_generation_history
        WHERE owner_key = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT ?
      `;

  const rows = await queryRows<QueryRow>(sql, [ownerKey, safeLimit]);
  return rows.map((row) => ({
    adId: toNullableInteger(row.adId),
    createdAt: normalizeIsoString(row.createdAt),
    description: normalizeText(row.description),
    downloadPath: normalizeText(row.downloadPath) || null,
    error: normalizeText(row.error) || null,
    finalAssetExpiresAt: normalizeText(row.finalAssetExpiresAt)
      ? normalizeIsoString(row.finalAssetExpiresAt)
      : null,
    finalAssetId: toNullableInteger(row.finalAssetId),
    finalAssetKind: normalizeText(row.finalAssetKind) || null,
    finalAssetStatus: normalizeText(row.finalAssetStatus) || null,
    generatedAt: normalizeText(row.generatedAt) ? normalizeIsoString(row.generatedAt) : null,
    hashtags: parseGenerationHashtags(row.hashtags as string | null | undefined),
    jobId: normalizeText(row.jobId),
    prompt: normalizeText(row.prompt),
    status: normalizeText(row.status) || "queued",
    title: normalizeText(row.title),
    updatedAt: normalizeIsoString(row.updatedAt, normalizeIsoString(row.createdAt)),
  }));
}

export async function getWorkspaceGenerationHistoryEntry(
  user: WorkspaceHistoryUser,
  jobId: string,
): Promise<WorkspaceGenerationHistoryEntry | null> {
  const ownerKey = getWorkspaceHistoryOwnerKey(user);
  const safeJobId = normalizeText(jobId);
  if (!ownerKey || !safeJobId) {
    return null;
  }

  await ensureWorkspaceHistoryTable();

  const sql = isPgPool(database)
    ? `
        SELECT
          job_id AS "jobId",
          prompt AS "prompt",
          title AS "title",
          description AS "description",
          status AS "status",
          error AS "error",
          ad_id AS "adId",
          hashtags AS "hashtags",
          download_path AS "downloadPath",
          final_asset_id AS "finalAssetId",
          final_asset_kind AS "finalAssetKind",
          final_asset_status AS "finalAssetStatus",
          final_asset_expires_at AS "finalAssetExpiresAt",
          generated_at AS "generatedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM workspace_generation_history
        WHERE owner_key = $1 AND job_id = $2
        LIMIT 1
      `
    : `
        SELECT
          job_id AS "jobId",
          prompt AS "prompt",
          title AS "title",
          description AS "description",
          status AS "status",
          error AS "error",
          ad_id AS "adId",
          hashtags AS "hashtags",
          download_path AS "downloadPath",
          final_asset_id AS "finalAssetId",
          final_asset_kind AS "finalAssetKind",
          final_asset_status AS "finalAssetStatus",
          final_asset_expires_at AS "finalAssetExpiresAt",
          generated_at AS "generatedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM workspace_generation_history
        WHERE owner_key = ? AND job_id = ?
        LIMIT 1
      `;

  const rows = await queryRows<QueryRow>(sql, [ownerKey, safeJobId]);
  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    adId: toNullableInteger(row.adId),
    createdAt: normalizeIsoString(row.createdAt),
    description: normalizeText(row.description),
    downloadPath: normalizeText(row.downloadPath) || null,
    error: normalizeText(row.error) || null,
    finalAssetExpiresAt: normalizeText(row.finalAssetExpiresAt)
      ? normalizeIsoString(row.finalAssetExpiresAt)
      : null,
    finalAssetId: toNullableInteger(row.finalAssetId),
    finalAssetKind: normalizeText(row.finalAssetKind) || null,
    finalAssetStatus: normalizeText(row.finalAssetStatus) || null,
    generatedAt: normalizeText(row.generatedAt) ? normalizeIsoString(row.generatedAt) : null,
    hashtags: parseGenerationHashtags(row.hashtags as string | null | undefined),
    jobId: normalizeText(row.jobId),
    prompt: normalizeText(row.prompt),
    status: normalizeText(row.status) || "queued",
    title: normalizeText(row.title),
    updatedAt: normalizeIsoString(row.updatedAt, normalizeIsoString(row.createdAt)),
  };
}

export async function markWorkspaceProjectDeleted(
  user: WorkspaceHistoryUser,
  snapshot: WorkspaceDeletedProjectSnapshot,
): Promise<void> {
  const ownerKey = getWorkspaceHistoryOwnerKey(user);
  const projectId = normalizeText(snapshot.projectId);
  if (!ownerKey || !projectId) return;

  await ensureWorkspaceDeletedProjectsTable();

  const adId = toNullableInteger(snapshot.adId);
  const jobId = normalizeText(snapshot.jobId) || null;
  const deletedAt = normalizeIsoString(snapshot.deletedAt);

  const sql = isPgPool(database)
    ? `
        INSERT INTO workspace_deleted_projects (
          owner_key,
          project_id,
          ad_id,
          job_id,
          deleted_at
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (owner_key, project_id) DO UPDATE SET
          ad_id = COALESCE(EXCLUDED.ad_id, workspace_deleted_projects.ad_id),
          job_id = COALESCE(EXCLUDED.job_id, workspace_deleted_projects.job_id),
          deleted_at = EXCLUDED.deleted_at
      `
    : `
        INSERT INTO workspace_deleted_projects (
          owner_key,
          project_id,
          ad_id,
          job_id,
          deleted_at
        )
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(owner_key, project_id) DO UPDATE SET
          ad_id = COALESCE(excluded.ad_id, workspace_deleted_projects.ad_id),
          job_id = COALESCE(excluded.job_id, workspace_deleted_projects.job_id),
          deleted_at = excluded.deleted_at
      `;

  await runStatement(sql, [ownerKey, projectId, adId, jobId, deletedAt]);
}

export async function listWorkspaceDeletedProjects(user: WorkspaceHistoryUser): Promise<WorkspaceDeletedProjectEntry[]> {
  const ownerKey = getWorkspaceHistoryOwnerKey(user);
  if (!ownerKey) return [];

  await ensureWorkspaceDeletedProjectsTable();

  const sql = isPgPool(database)
    ? `
        SELECT
          project_id AS "projectId",
          ad_id AS "adId",
          job_id AS "jobId",
          deleted_at AS "deletedAt"
        FROM workspace_deleted_projects
        WHERE owner_key = $1
        ORDER BY deleted_at DESC
      `
    : `
        SELECT
          project_id AS "projectId",
          ad_id AS "adId",
          job_id AS "jobId",
          deleted_at AS "deletedAt"
        FROM workspace_deleted_projects
        WHERE owner_key = ?
        ORDER BY deleted_at DESC
      `;

  const rows = await queryRows<WorkspaceDeletedProjectEntry>(sql, [ownerKey]);
  return rows.map((row) => ({
    adId: toNullableInteger(row.adId),
    deletedAt: normalizeIsoString(row.deletedAt),
    jobId: normalizeText(row.jobId) || null,
    projectId: normalizeText(row.projectId),
  }));
}
