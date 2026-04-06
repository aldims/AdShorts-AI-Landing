import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { database, type AuthDatabase } from "./database.js";

type WorkspaceContentPlanUser = {
  email?: string | null;
  id?: string | null;
  name?: string | null;
};

type QueryRow = Record<string, unknown>;

export type WorkspaceContentPlanIdea = {
  createdAt: string;
  id: string;
  isUsed: boolean;
  planId: string;
  position: number;
  prompt: string;
  summary: string;
  title: string;
  updatedAt: string;
  usedAt: string | null;
};

export type WorkspaceContentPlan = {
  createdAt: string;
  id: string;
  ideas: WorkspaceContentPlanIdea[];
  language: "en" | "ru";
  query: string;
  updatedAt: string;
};

type WorkspaceContentPlanIdeaSeed = {
  prompt: string;
  summary: string;
  title: string;
};

type NormalizedWorkspaceContentPlanIdeaInsert = {
  id: string;
  position: number;
  prompt: string;
  summary: string;
  title: string;
};

type WorkspaceContentPlanJoinRow = {
  createdAt: unknown;
  ideaCreatedAt: unknown;
  ideaId: unknown;
  ideaUpdatedAt: unknown;
  isUsed: unknown;
  language: unknown;
  planId: unknown;
  planQuery: unknown;
  position: unknown;
  prompt: unknown;
  summary: unknown;
  title: unknown;
  updatedAt: unknown;
  usedAt: unknown;
};

type TransactionQuery = <TRow extends QueryRow>(sql: string, params?: readonly unknown[]) => Promise<TRow[]>;
type TransactionRun = (sql: string, params?: readonly unknown[]) => Promise<void>;

const isPgPool = (value: AuthDatabase): value is Pool => value instanceof Pool;

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const sanitizeContentPlanIdeaPrompt = (value: unknown) => {
  const fallbackPrompt = normalizeText(value);
  if (!fallbackPrompt) {
    return "";
  }

  let normalized = fallbackPrompt.replace(/^["'`]+|["'`]+$/g, "").trim();

  const leadingInstructionPatterns = [
    /^(?:напиши|создай|сделай)\s+(?:мне\s+)?(?:сценарий\s+)?(?:для\s+)?(?:shorts|шортс)(?:\s+(?:ролика|видео))?\s*(?:[,:-]\s*)?(?:где\s+|про\s+|о\s+|об\s+|на\s+тему\s+)?/i,
    /^(?:создай|сделай)\s+(?:мне\s+)?(?:shorts|шортс|ролик|видео)(?:\s+(?:о|об|про|на\s+тему))?\s*(?:[,:-]\s*)?/i,
    /^write\s+(?:a\s+)?(?:shorts?\s+)?script(?:\s+for\s+(?:a\s+)?)?(?:shorts?\s+video)?\s*(?:[,:-]\s*)?(?:about\s+|on\s+|where\s+)?/i,
    /^(?:create|make)\s+(?:a\s+)?shorts?(?:\s+video)?\s*(?:[,:-]\s*)?(?:about\s+|on\s+)?/i,
  ];

  for (const pattern of leadingInstructionPatterns) {
    const nextValue = normalized.replace(pattern, "").trim();
    if (nextValue && nextValue !== normalized) {
      normalized = nextValue;
      break;
    }
  }

  normalized = normalized.replace(/^[\s,.:;-]+/, "").replace(/^["'`]+|["'`]+$/g, "").trim();
  return normalized || fallbackPrompt;
};

const normalizeSqliteParam = (value: unknown) => {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return value ?? null;
};

const normalizeSqliteParams = (params: readonly unknown[]) => params.map((param) => normalizeSqliteParam(param));

const toDatabaseBoolean = (value: boolean) => (isPgPool(database) ? value : value ? 1 : 0);

const normalizeIsoString = (value: unknown, fallback = new Date().toISOString()) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return fallback;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
};

const normalizeInteger = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

const normalizeBoolean = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  const normalized = normalizeText(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const normalizeContentPlanLanguage = (value: unknown): "en" | "ru" =>
  normalizeText(value).toLowerCase() === "en" ? "en" : "ru";

const normalizeWorkspaceContentPlanIdeaSeeds = (
  ideas: WorkspaceContentPlanIdeaSeed[],
  positionOffset = 0,
): NormalizedWorkspaceContentPlanIdeaInsert[] =>
  ideas.map((idea, index) => ({
    id: randomUUID(),
    position: Math.max(0, positionOffset + index),
    prompt: sanitizeContentPlanIdeaPrompt(idea.prompt),
    summary: normalizeText(idea.summary),
    title: normalizeText(idea.title),
  }));

const getWorkspaceContentPlanOwnerKey = (user: WorkspaceContentPlanUser) => {
  const userId = normalizeText(user.id);
  if (userId) {
    return `user:${userId}`;
  }

  const email = normalizeText(user.email).toLowerCase();
  return email ? `email:${email}` : null;
};

let workspaceContentPlansTableReady = false;
let workspaceContentPlansTableReadyPromise: Promise<void> | null = null;

const runStatement = async (sql: string, params: readonly unknown[] = []) => {
  if (isPgPool(database)) {
    await database.query(sql, [...params]);
    return;
  }

  database.prepare(sql).run(...(normalizeSqliteParams(params) as never[]));
};

const queryRows = async <TRow extends QueryRow>(sql: string, params: readonly unknown[] = []) => {
  if (isPgPool(database)) {
    const result = await database.query<TRow>(sql, [...params]);
    return result.rows;
  }

  return database.prepare(sql).all(...(normalizeSqliteParams(params) as never[])) as TRow[];
};

const runInTransaction = async <T>(callback: (query: TransactionQuery, run: TransactionRun) => Promise<T>) => {
  if (isPgPool(database)) {
    const client = await database.connect();

    try {
      await client.query("BEGIN");
      const result = await callback(
        async <TRow extends QueryRow>(sql: string, params: readonly unknown[] = []) => {
          const queryResult = await client.query<TRow>(sql, [...params]);
          return queryResult.rows;
        },
        async (sql: string, params: readonly unknown[] = []) => {
          await client.query(sql, [...params]);
        },
      );
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  const sqliteDatabase = database;
  if (isPgPool(sqliteDatabase)) {
    throw new Error("SQLite transaction expected a sqlite database.");
  }

  sqliteDatabase.exec("BEGIN IMMEDIATE");

  try {
    const result = await callback(
      async <TRow extends QueryRow>(sql: string, params: readonly unknown[] = []) =>
        sqliteDatabase.prepare(sql).all(...(normalizeSqliteParams(params) as never[])) as TRow[],
      async (sql: string, params: readonly unknown[] = []) => {
        sqliteDatabase.prepare(sql).run(...(normalizeSqliteParams(params) as never[]));
      },
    );
    sqliteDatabase.exec("COMMIT");
    return result;
  } catch (error) {
    sqliteDatabase.exec("ROLLBACK");
    throw error;
  }
};

const ensureWorkspaceContentPlanTables = async () => {
  if (workspaceContentPlansTableReady) {
    return;
  }

  if (workspaceContentPlansTableReadyPromise) {
    await workspaceContentPlansTableReadyPromise;
    return;
  }

  workspaceContentPlansTableReadyPromise = (async () => {
    const createPlansTableSql = `
      CREATE TABLE IF NOT EXISTS workspace_content_plans (
        id TEXT PRIMARY KEY,
        owner_key TEXT NOT NULL,
        query TEXT NOT NULL DEFAULT '',
        language TEXT NOT NULL DEFAULT 'ru',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;
    const createPlansIndexSql = `
      CREATE INDEX IF NOT EXISTS workspace_content_plans_owner_updated_idx
      ON workspace_content_plans (owner_key, updated_at DESC)
    `;
    const createIdeasTableSql = isPgPool(database)
      ? `
          CREATE TABLE IF NOT EXISTS workspace_content_plan_ideas (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL REFERENCES workspace_content_plans(id),
            position INTEGER NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            summary TEXT NOT NULL DEFAULT '',
            prompt TEXT NOT NULL DEFAULT '',
            is_used BOOLEAN NOT NULL DEFAULT FALSE,
            used_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (plan_id, position)
          )
        `
      : `
          CREATE TABLE IF NOT EXISTS workspace_content_plan_ideas (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            summary TEXT NOT NULL DEFAULT '',
            prompt TEXT NOT NULL DEFAULT '',
            is_used INTEGER NOT NULL DEFAULT 0,
            used_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (plan_id, position)
          )
        `;
    const createIdeasIndexSql = `
      CREATE INDEX IF NOT EXISTS workspace_content_plan_ideas_plan_position_idx
      ON workspace_content_plan_ideas (plan_id, position ASC)
    `;

    if (isPgPool(database)) {
      await database.query(createPlansTableSql);
      await database.query(createPlansIndexSql);
      await database.query(createIdeasTableSql);
      await database.query(createIdeasIndexSql);
    } else {
      database.exec(createPlansTableSql);
      database.exec(createPlansIndexSql);
      database.exec(createIdeasTableSql);
      database.exec(createIdeasIndexSql);
    }

    workspaceContentPlansTableReady = true;
  })().finally(() => {
    workspaceContentPlansTableReadyPromise = null;
  });

  await workspaceContentPlansTableReadyPromise;
};

const groupWorkspaceContentPlans = (rows: WorkspaceContentPlanJoinRow[]) => {
  const plans = new Map<string, WorkspaceContentPlan>();

  rows.forEach((row) => {
    const planId = normalizeText(row.planId);
    if (!planId) {
      return;
    }

    const existingPlan = plans.get(planId);
    if (!existingPlan) {
      plans.set(planId, {
        createdAt: normalizeIsoString(row.createdAt),
        id: planId,
        ideas: [],
        language: normalizeContentPlanLanguage(row.language),
        query: normalizeText(row.planQuery),
        updatedAt: normalizeIsoString(row.updatedAt, normalizeIsoString(row.createdAt)),
      });
    }

    const ideaId = normalizeText(row.ideaId);
    if (!ideaId) {
      return;
    }

    const plan = plans.get(planId);
    if (!plan) {
      return;
    }

    plan.ideas.push({
      createdAt: normalizeIsoString(row.ideaCreatedAt, normalizeIsoString(row.createdAt)),
      id: ideaId,
      isUsed: normalizeBoolean(row.isUsed),
      planId,
      position: Math.max(0, normalizeInteger(row.position)),
      prompt: sanitizeContentPlanIdeaPrompt(row.prompt),
      summary: normalizeText(row.summary),
      title: normalizeText(row.title),
      updatedAt: normalizeIsoString(row.ideaUpdatedAt, normalizeIsoString(row.updatedAt)),
      usedAt: normalizeText(row.usedAt) ? normalizeIsoString(row.usedAt) : null,
    });
  });

  return Array.from(plans.values()).map((plan) => ({
    ...plan,
    ideas: plan.ideas.sort((left, right) => left.position - right.position),
  }));
};

const getWorkspaceContentPlanById = async (
  ownerKey: string,
  planId: string,
): Promise<WorkspaceContentPlan | null> => {
  if (!ownerKey || !planId) {
    return null;
  }

  await ensureWorkspaceContentPlanTables();

  const sql = isPgPool(database)
    ? `
        SELECT
          p.id AS "planId",
          p.query AS "planQuery",
          p.language AS "language",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt",
          i.id AS "ideaId",
          i.position AS "position",
          i.title AS "title",
          i.summary AS "summary",
          i.prompt AS "prompt",
          i.is_used AS "isUsed",
          i.used_at AS "usedAt",
          i.created_at AS "ideaCreatedAt",
          i.updated_at AS "ideaUpdatedAt"
        FROM workspace_content_plans p
        LEFT JOIN workspace_content_plan_ideas i ON i.plan_id = p.id
        WHERE p.owner_key = $1 AND p.id = $2
        ORDER BY i.position ASC
      `
    : `
        SELECT
          p.id AS "planId",
          p.query AS "planQuery",
          p.language AS "language",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt",
          i.id AS "ideaId",
          i.position AS "position",
          i.title AS "title",
          i.summary AS "summary",
          i.prompt AS "prompt",
          i.is_used AS "isUsed",
          i.used_at AS "usedAt",
          i.created_at AS "ideaCreatedAt",
          i.updated_at AS "ideaUpdatedAt"
        FROM workspace_content_plans p
        LEFT JOIN workspace_content_plan_ideas i ON i.plan_id = p.id
        WHERE p.owner_key = ? AND p.id = ?
        ORDER BY i.position ASC
      `;

  const rows = await queryRows<WorkspaceContentPlanJoinRow>(sql, [ownerKey, planId]);
  return groupWorkspaceContentPlans(rows)[0] ?? null;
};

export async function getWorkspaceContentPlan(
  user: WorkspaceContentPlanUser,
  planId: string,
): Promise<WorkspaceContentPlan | null> {
  const ownerKey = getWorkspaceContentPlanOwnerKey(user);
  const normalizedPlanId = normalizeText(planId);
  if (!ownerKey || !normalizedPlanId) {
    return null;
  }

  return getWorkspaceContentPlanById(ownerKey, normalizedPlanId);
}

export async function listWorkspaceContentPlans(
  user: WorkspaceContentPlanUser,
  limit = 24,
): Promise<WorkspaceContentPlan[]> {
  const ownerKey = getWorkspaceContentPlanOwnerKey(user);
  if (!ownerKey) {
    return [];
  }

  await ensureWorkspaceContentPlanTables();

  const safeLimit = Math.max(1, Math.min(Math.trunc(limit || 24), 100));
  const sql = isPgPool(database)
    ? `
        SELECT
          p.id AS "planId",
          p.query AS "planQuery",
          p.language AS "language",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt",
          i.id AS "ideaId",
          i.position AS "position",
          i.title AS "title",
          i.summary AS "summary",
          i.prompt AS "prompt",
          i.is_used AS "isUsed",
          i.used_at AS "usedAt",
          i.created_at AS "ideaCreatedAt",
          i.updated_at AS "ideaUpdatedAt"
        FROM (
          SELECT id, query, language, created_at, updated_at
          FROM workspace_content_plans
          WHERE owner_key = $1
          ORDER BY updated_at DESC, created_at DESC
          LIMIT $2
        ) p
        LEFT JOIN workspace_content_plan_ideas i ON i.plan_id = p.id
        ORDER BY p.updated_at DESC, p.created_at DESC, i.position ASC
      `
    : `
        SELECT
          p.id AS "planId",
          p.query AS "planQuery",
          p.language AS "language",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt",
          i.id AS "ideaId",
          i.position AS "position",
          i.title AS "title",
          i.summary AS "summary",
          i.prompt AS "prompt",
          i.is_used AS "isUsed",
          i.used_at AS "usedAt",
          i.created_at AS "ideaCreatedAt",
          i.updated_at AS "ideaUpdatedAt"
        FROM (
          SELECT id, query, language, created_at, updated_at
          FROM workspace_content_plans
          WHERE owner_key = ?
          ORDER BY updated_at DESC, created_at DESC
          LIMIT ?
        ) p
        LEFT JOIN workspace_content_plan_ideas i ON i.plan_id = p.id
        ORDER BY p.updated_at DESC, p.created_at DESC, i.position ASC
      `;

  const rows = await queryRows<WorkspaceContentPlanJoinRow>(sql, [ownerKey, safeLimit]);
  return groupWorkspaceContentPlans(rows);
}

export async function createWorkspaceContentPlan(
  user: WorkspaceContentPlanUser,
  options: {
    ideas: WorkspaceContentPlanIdeaSeed[];
    language?: string;
    query: string;
  },
): Promise<WorkspaceContentPlan> {
  const ownerKey = getWorkspaceContentPlanOwnerKey(user);
  const normalizedQuery = normalizeText(options.query);
  if (!ownerKey || !normalizedQuery) {
    throw new Error("Query is required.");
  }

  const normalizedIdeas = normalizeWorkspaceContentPlanIdeaSeeds(options.ideas);
  if (!normalizedIdeas.length || normalizedIdeas.some((idea) => !idea.prompt || !idea.summary || !idea.title)) {
    throw new Error("Content plan ideas are invalid.");
  }

  await ensureWorkspaceContentPlanTables();

  const createdAt = new Date().toISOString();
  const planId = randomUUID();
  const language = normalizeContentPlanLanguage(options.language);
  const initialIdeaUsedState = toDatabaseBoolean(false);
  const insertPlanSql = isPgPool(database)
    ? `
        INSERT INTO workspace_content_plans (
          id,
          owner_key,
          query,
          language,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `
    : `
        INSERT INTO workspace_content_plans (
          id,
          owner_key,
          query,
          language,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `;
  const insertIdeaSql = isPgPool(database)
    ? `
        INSERT INTO workspace_content_plan_ideas (
          id,
          plan_id,
          position,
          title,
          summary,
          prompt,
          is_used,
          used_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `
    : `
        INSERT INTO workspace_content_plan_ideas (
          id,
          plan_id,
          position,
          title,
          summary,
          prompt,
          is_used,
          used_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

  await runInTransaction(async (_query, run) => {
    await run(insertPlanSql, [planId, ownerKey, normalizedQuery, language, createdAt, createdAt]);

    for (const idea of normalizedIdeas) {
      await run(insertIdeaSql, [
        idea.id,
        planId,
        idea.position,
        idea.title,
        idea.summary,
        idea.prompt,
        initialIdeaUsedState,
        null,
        createdAt,
        createdAt,
      ]);
    }
  });

  return {
    createdAt,
    id: planId,
    ideas: normalizedIdeas.map((idea) => ({
      createdAt,
      id: idea.id,
      isUsed: false,
      planId,
      position: idea.position,
      prompt: idea.prompt,
      summary: idea.summary,
      title: idea.title,
      updatedAt: createdAt,
      usedAt: null,
    })),
    language,
    query: normalizedQuery,
    updatedAt: createdAt,
  };
}

export async function appendWorkspaceContentPlanIdeas(
  user: WorkspaceContentPlanUser,
  options: {
    ideas: WorkspaceContentPlanIdeaSeed[];
    planId: string;
  },
): Promise<WorkspaceContentPlan | null> {
  const ownerKey = getWorkspaceContentPlanOwnerKey(user);
  const normalizedPlanId = normalizeText(options.planId);
  if (!ownerKey || !normalizedPlanId) {
    return null;
  }

  await ensureWorkspaceContentPlanTables();

  const existingPlan = await getWorkspaceContentPlanById(ownerKey, normalizedPlanId);
  if (!existingPlan) {
    return null;
  }

  const nextPosition = existingPlan.ideas.reduce((maxPosition, idea) => Math.max(maxPosition, idea.position), -1) + 1;
  const normalizedIdeas = normalizeWorkspaceContentPlanIdeaSeeds(options.ideas, nextPosition);
  if (!normalizedIdeas.length || normalizedIdeas.some((idea) => !idea.prompt || !idea.summary || !idea.title)) {
    throw new Error("Content plan ideas are invalid.");
  }

  const createdAt = new Date().toISOString();
  const initialIdeaUsedState = toDatabaseBoolean(false);
  const insertIdeaSql = isPgPool(database)
    ? `
        INSERT INTO workspace_content_plan_ideas (
          id,
          plan_id,
          position,
          title,
          summary,
          prompt,
          is_used,
          used_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `
    : `
        INSERT INTO workspace_content_plan_ideas (
          id,
          plan_id,
          position,
          title,
          summary,
          prompt,
          is_used,
          used_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
  const updatePlanSql = isPgPool(database)
    ? `
        UPDATE workspace_content_plans
        SET updated_at = $3
        WHERE owner_key = $1 AND id = $2
      `
    : `
        UPDATE workspace_content_plans
        SET updated_at = ?
        WHERE owner_key = ? AND id = ?
      `;

  await runInTransaction(async (_query, run) => {
    for (const idea of normalizedIdeas) {
      await run(insertIdeaSql, [
        idea.id,
        normalizedPlanId,
        idea.position,
        idea.title,
        idea.summary,
        idea.prompt,
        initialIdeaUsedState,
        null,
        createdAt,
        createdAt,
      ]);
    }

    await run(
      updatePlanSql,
      isPgPool(database) ? [ownerKey, normalizedPlanId, createdAt] : [createdAt, ownerKey, normalizedPlanId],
    );
  });

  return getWorkspaceContentPlanById(ownerKey, normalizedPlanId);
}

export async function updateWorkspaceContentPlanIdeaUsedState(
  user: WorkspaceContentPlanUser,
  options: {
    ideaId: string;
    isUsed: boolean;
    planId: string;
  },
) {
  const ownerKey = getWorkspaceContentPlanOwnerKey(user);
  const planId = normalizeText(options.planId);
  const ideaId = normalizeText(options.ideaId);
  if (!ownerKey || !planId || !ideaId) {
    return null;
  }

  await ensureWorkspaceContentPlanTables();

  const selectSql = isPgPool(database)
    ? `
        SELECT
          p.id AS "planId",
          i.id AS "ideaId"
        FROM workspace_content_plans p
        JOIN workspace_content_plan_ideas i ON i.plan_id = p.id
        WHERE p.owner_key = $1 AND p.id = $2 AND i.id = $3
        LIMIT 1
      `
    : `
        SELECT
          p.id AS "planId",
          i.id AS "ideaId"
        FROM workspace_content_plans p
        JOIN workspace_content_plan_ideas i ON i.plan_id = p.id
        WHERE p.owner_key = ? AND p.id = ? AND i.id = ?
        LIMIT 1
      `;

  const matchingRows = await queryRows<QueryRow>(selectSql, [ownerKey, planId, ideaId]);
  if (!matchingRows.length) {
    return null;
  }

  const updatedAt = new Date().toISOString();
  const usedAt = options.isUsed ? updatedAt : null;
  const nextUsedState = toDatabaseBoolean(options.isUsed);
  const updateIdeaSql = isPgPool(database)
    ? `
        UPDATE workspace_content_plan_ideas
        SET
          is_used = $1,
          used_at = $2,
          updated_at = $3
        WHERE id = $4 AND plan_id = $5
      `
    : `
        UPDATE workspace_content_plan_ideas
        SET
          is_used = ?,
          used_at = ?,
          updated_at = ?
        WHERE id = ? AND plan_id = ?
      `;
  const updatePlanSql = isPgPool(database)
    ? `
        UPDATE workspace_content_plans
        SET updated_at = $1
        WHERE id = $2 AND owner_key = $3
      `
    : `
        UPDATE workspace_content_plans
        SET updated_at = ?
        WHERE id = ? AND owner_key = ?
      `;

  await runInTransaction(async (_query, run) => {
    await run(updateIdeaSql, [nextUsedState, usedAt, updatedAt, ideaId, planId]);
    await run(updatePlanSql, [updatedAt, planId, ownerKey]);
  });

  return {
    ideaId,
    isUsed: options.isUsed,
    planId,
    updatedAt,
    usedAt,
  };
}

export async function deleteWorkspaceContentPlanIdea(
  user: WorkspaceContentPlanUser,
  options: {
    ideaId: string;
    planId: string;
  },
) {
  const ownerKey = getWorkspaceContentPlanOwnerKey(user);
  const planId = normalizeText(options.planId);
  const ideaId = normalizeText(options.ideaId);
  if (!ownerKey || !planId || !ideaId) {
    return null;
  }

  await ensureWorkspaceContentPlanTables();

  const selectSql = isPgPool(database)
    ? `
        SELECT
          p.id AS "planId",
          i.id AS "ideaId"
        FROM workspace_content_plans p
        JOIN workspace_content_plan_ideas i ON i.plan_id = p.id
        WHERE p.owner_key = $1 AND p.id = $2 AND i.id = $3
        LIMIT 1
      `
    : `
        SELECT
          p.id AS "planId",
          i.id AS "ideaId"
        FROM workspace_content_plans p
        JOIN workspace_content_plan_ideas i ON i.plan_id = p.id
        WHERE p.owner_key = ? AND p.id = ? AND i.id = ?
        LIMIT 1
      `;
  const matchingRows = await queryRows<QueryRow>(selectSql, [ownerKey, planId, ideaId]);
  if (!matchingRows.length) {
    return null;
  }

  const updatedAt = new Date().toISOString();
  const deleteIdeaSql = isPgPool(database)
    ? `
        DELETE FROM workspace_content_plan_ideas
        WHERE id = $1 AND plan_id = $2
      `
    : `
        DELETE FROM workspace_content_plan_ideas
        WHERE id = ? AND plan_id = ?
      `;
  const updatePlanSql = isPgPool(database)
    ? `
        UPDATE workspace_content_plans
        SET updated_at = $1
        WHERE id = $2 AND owner_key = $3
      `
    : `
        UPDATE workspace_content_plans
        SET updated_at = ?
        WHERE id = ? AND owner_key = ?
      `;

  await runInTransaction(async (_query, run) => {
    await run(deleteIdeaSql, [ideaId, planId]);
    await run(updatePlanSql, [updatedAt, planId, ownerKey]);
  });

  return {
    ideaId,
    planId,
    updatedAt,
  };
}

export async function deleteWorkspaceContentPlan(user: WorkspaceContentPlanUser, planId: string): Promise<boolean> {
  const ownerKey = getWorkspaceContentPlanOwnerKey(user);
  const normalizedPlanId = normalizeText(planId);
  if (!ownerKey || !normalizedPlanId) {
    return false;
  }

  await ensureWorkspaceContentPlanTables();

  const selectSql = isPgPool(database)
    ? `
        SELECT id AS "planId"
        FROM workspace_content_plans
        WHERE owner_key = $1 AND id = $2
        LIMIT 1
      `
    : `
        SELECT id AS "planId"
        FROM workspace_content_plans
        WHERE owner_key = ? AND id = ?
        LIMIT 1
      `;
  const existingRows = await queryRows<QueryRow>(selectSql, [ownerKey, normalizedPlanId]);
  if (!existingRows.length) {
    return false;
  }

  const deleteIdeasSql = isPgPool(database)
    ? `DELETE FROM workspace_content_plan_ideas WHERE plan_id = $1`
    : `DELETE FROM workspace_content_plan_ideas WHERE plan_id = ?`;
  const deletePlanSql = isPgPool(database)
    ? `DELETE FROM workspace_content_plans WHERE id = $1 AND owner_key = $2`
    : `DELETE FROM workspace_content_plans WHERE id = ? AND owner_key = ?`;

  await runInTransaction(async (_query, run) => {
    await run(deleteIdeasSql, [normalizedPlanId]);
    await run(deletePlanSql, [normalizedPlanId, ownerKey]);
  });

  return true;
}
