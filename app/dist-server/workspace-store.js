import { database } from "./database.js";
const DEFAULT_WORKSPACE_PLAN = "FREE";
const DEFAULT_WORKSPACE_BALANCE = 1;
database.exec(`
  CREATE TABLE IF NOT EXISTS workspace_profile (
    userId TEXT NOT NULL PRIMARY KEY,
    plan TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS studio_generation (
    jobId TEXT NOT NULL PRIMARY KEY,
    userId TEXT NOT NULL,
    status TEXT NOT NULL,
    prompt TEXT NOT NULL,
    title TEXT NOT NULL,
    error TEXT,
    downloadPath TEXT,
    generatedAt TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS studio_generation_user_updated_idx
    ON studio_generation (userId, updatedAt DESC);
`);
const getWorkspaceUserId = (user) => {
    const userId = String(user.id ?? "").trim();
    if (!userId) {
        throw new Error("Authenticated user id is missing.");
    }
    return userId;
};
const nowIso = () => new Date().toISOString();
export class WorkspaceCreditLimitError extends Error {
    constructor(message = "На тарифе FREE доступна 1 бесплатная генерация. Обновите тариф, чтобы продолжить.") {
        super(message);
        this.name = "WorkspaceCreditLimitError";
    }
}
const buildDefaultWorkspaceProfile = () => ({
    balance: DEFAULT_WORKSPACE_BALANCE,
    plan: DEFAULT_WORKSPACE_PLAN,
});
const readWorkspaceProfile = (userId) => database.prepare("SELECT plan, balance FROM workspace_profile WHERE userId = ?").get(userId);
const normalizeWorkspaceProfile = (row) => ({
    balance: Number(row.balance),
    plan: String(row.plan),
});
// Preserve real paid/custom profiles, but upgrade the old placeholder defaults.
database
    .prepare(`
      UPDATE workspace_profile
      SET plan = ?, balance = ?, updatedAt = ?
      WHERE plan IN ('Creator trial', 'Pending verification') AND balance = 184
    `)
    .run(DEFAULT_WORKSPACE_PLAN, DEFAULT_WORKSPACE_BALANCE, nowIso());
export function getOrCreateWorkspaceProfile(user) {
    const userId = getWorkspaceUserId(user);
    const existing = readWorkspaceProfile(userId);
    if (existing) {
        return normalizeWorkspaceProfile(existing);
    }
    const profile = buildDefaultWorkspaceProfile();
    const timestamp = nowIso();
    database
        .prepare(`
        INSERT INTO workspace_profile (userId, plan, balance, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?)
      `)
        .run(userId, profile.plan, profile.balance, timestamp, timestamp);
    return profile;
}
export function consumeWorkspaceGenerationCredit(user, amount = 1) {
    const userId = getWorkspaceUserId(user);
    const safeAmount = Math.max(1, Math.trunc(amount || 1));
    const timestamp = nowIso();
    getOrCreateWorkspaceProfile(user);
    const result = database
        .prepare(`
        UPDATE workspace_profile
        SET balance = balance - ?, updatedAt = ?
        WHERE userId = ? AND balance >= ?
      `)
        .run(safeAmount, timestamp, userId, safeAmount);
    if (!result.changes) {
        throw new WorkspaceCreditLimitError();
    }
    const updated = readWorkspaceProfile(userId);
    if (!updated) {
        throw new Error("Workspace profile is missing after balance update.");
    }
    return normalizeWorkspaceProfile(updated);
}
export function refundWorkspaceGenerationCredit(user, amount = 1) {
    const userId = getWorkspaceUserId(user);
    const safeAmount = Math.max(1, Math.trunc(amount || 1));
    const timestamp = nowIso();
    getOrCreateWorkspaceProfile(user);
    database
        .prepare(`
        UPDATE workspace_profile
        SET balance = balance + ?, updatedAt = ?
        WHERE userId = ?
      `)
        .run(safeAmount, timestamp, userId);
    const updated = readWorkspaceProfile(userId);
    if (!updated) {
        throw new Error("Workspace profile is missing after balance refund.");
    }
    return normalizeWorkspaceProfile(updated);
}
export function saveStudioGeneration(user, generation) {
    const userId = getWorkspaceUserId(user);
    const timestamp = nowIso();
    database
        .prepare(`
        INSERT INTO studio_generation (
          jobId,
          userId,
          status,
          prompt,
          title,
          error,
          downloadPath,
          generatedAt,
          createdAt,
          updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(jobId) DO UPDATE SET
          userId = excluded.userId,
          status = excluded.status,
          prompt = excluded.prompt,
          title = excluded.title,
          error = excluded.error,
          downloadPath = excluded.downloadPath,
          generatedAt = excluded.generatedAt,
          updatedAt = excluded.updatedAt
      `)
        .run(generation.jobId, userId, generation.status, generation.prompt, generation.title, generation.error ?? null, generation.downloadPath ?? null, generation.generatedAt, timestamp, timestamp);
}
export function getLatestStudioGeneration(user) {
    const userId = getWorkspaceUserId(user);
    const row = database
        .prepare(`
        SELECT jobId, status, prompt, title, error, downloadPath, generatedAt
        FROM studio_generation
        WHERE userId = ?
        ORDER BY updatedAt DESC
        LIMIT 1
      `)
        .get(userId);
    if (!row) {
        return null;
    }
    return {
        downloadPath: row.downloadPath,
        error: row.error,
        generatedAt: row.generatedAt,
        jobId: row.jobId,
        prompt: row.prompt,
        status: row.status,
        title: row.title,
    };
}
