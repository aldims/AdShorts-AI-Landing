import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { purgeAdminAccountData } from "./admin-account-purge.js";

const countRows = (database: DatabaseSync, sql: string) => {
  const row = database.prepare(sql).get() as { count?: unknown } | undefined;
  return Number(row?.count ?? 0);
};

const createPurgeTestDatabase = () => {
  const database = new DatabaseSync(":memory:");

  database.exec(`
    CREATE TABLE "user" (
      id TEXT PRIMARY KEY,
      email TEXT
    );
    CREATE TABLE "account" (
      "userId" TEXT,
      "providerId" TEXT,
      "accountId" TEXT
    );
    CREATE TABLE "session" (
      id TEXT PRIMARY KEY,
      "userId" TEXT
    );
    CREATE TABLE "verification" (
      identifier TEXT
    );
    CREATE TABLE workspace_generation_history (
      job_id TEXT PRIMARY KEY,
      owner_key TEXT
    );
    CREATE TABLE workspace_deleted_projects (
      project_id TEXT PRIMARY KEY,
      owner_key TEXT
    );
    CREATE TABLE workspace_content_plans (
      id TEXT PRIMARY KEY,
      owner_key TEXT
    );
    CREATE TABLE workspace_content_plan_ideas (
      id TEXT PRIMARY KEY,
      plan_id TEXT
    );

    INSERT INTO "user" (id, email) VALUES
      ('auth-old', 'alexmamondi@gmail.com'),
      ('auth-survivor', 'survivor@example.com');
    INSERT INTO "account" ("userId", "providerId", "accountId") VALUES
      ('auth-old', 'google', '106678161078508174850'),
      ('auth-survivor', 'google', 'survivor-account');
    INSERT INTO "session" (id, "userId") VALUES
      ('session-old', 'auth-old'),
      ('session-survivor', 'auth-survivor');
    INSERT INTO "verification" (identifier) VALUES
      ('alexmamondi@gmail.com'),
      ('survivor@example.com');
    INSERT INTO workspace_generation_history (job_id, owner_key) VALUES
      ('job-auth', 'user:auth-old'),
      ('job-provider', 'google:106678161078508174850'),
      ('job-survivor', 'user:auth-survivor');
    INSERT INTO workspace_deleted_projects (project_id, owner_key) VALUES
      ('project-auth', 'user:auth-old'),
      ('project-survivor', 'user:auth-survivor');
    INSERT INTO workspace_content_plans (id, owner_key) VALUES
      ('plan-auth', 'user:auth-old'),
      ('plan-survivor', 'user:auth-survivor');
    INSERT INTO workspace_content_plan_ideas (id, plan_id) VALUES
      ('idea-auth', 'plan-auth'),
      ('idea-survivor', 'plan-survivor');
  `);

  return database;
};

describe("admin account purge", () => {
  it("removes auth and workspace rows resolved from email and provider account", async () => {
    const database = createPurgeTestDatabase();

    try {
      const result = await purgeAdminAccountData(
        {
          email: "AlexMamondi@Gmail.com",
          externalUserIds: ["google:106678161078508174850"],
        },
        database,
      );

      expect(result.authUserIds).toEqual(["auth-old"]);
      expect(result.ownerKeys).toContain("user:auth-old");
      expect(result.ownerKeys).toContain("google:106678161078508174850");
      expect(result.counts).toMatchObject({
        better_auth_accounts: 1,
        better_auth_sessions: 1,
        better_auth_users: 1,
        better_auth_verifications: 1,
        workspace_content_plan_ideas: 1,
        workspace_content_plans: 1,
        workspace_deleted_projects: 1,
        workspace_generation_history: 2,
      });

      expect(countRows(database, `SELECT count(*) AS count FROM "user" WHERE id = 'auth-old'`)).toBe(0);
      expect(countRows(database, `SELECT count(*) AS count FROM "account" WHERE "userId" = 'auth-old'`)).toBe(0);
      expect(countRows(database, `SELECT count(*) AS count FROM "session" WHERE "userId" = 'auth-old'`)).toBe(0);
      expect(countRows(database, `SELECT count(*) AS count FROM workspace_generation_history`)).toBe(1);
      expect(countRows(database, `SELECT count(*) AS count FROM workspace_deleted_projects`)).toBe(1);
      expect(countRows(database, `SELECT count(*) AS count FROM workspace_content_plans`)).toBe(1);
      expect(countRows(database, `SELECT count(*) AS count FROM workspace_content_plan_ideas`)).toBe(1);
      expect(countRows(database, `SELECT count(*) AS count FROM "user" WHERE id = 'auth-survivor'`)).toBe(1);
    } finally {
      database.close();
    }
  });
});
