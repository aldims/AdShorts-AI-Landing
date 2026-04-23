import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createSchema = (database: DatabaseSync) => {
  database.exec(`
    CREATE TABLE "user" (
      id TEXT PRIMARY KEY,
      email TEXT
    );

    CREATE TABLE workspace_generation_history (
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
    );

    CREATE TABLE workspace_deleted_projects (
      owner_key TEXT NOT NULL,
      project_id TEXT NOT NULL,
      ad_id BIGINT,
      job_id TEXT,
      deleted_at TEXT NOT NULL,
      PRIMARY KEY (owner_key, project_id)
    );
  `);
};

describe("workspace owner key migration integration", () => {
  let database: DatabaseSync;

  beforeEach(() => {
    vi.resetModules();
    database = new DatabaseSync(":memory:");
    createSchema(database);

    vi.doMock("./database.js", () => ({
      database,
    }));
  });

  afterEach(() => {
    vi.doUnmock("./database.js");
    database.close();
  });

  it("moves legacy owner keys to the canonical Better Auth user id", async () => {
    database.prepare(`INSERT INTO "user" (id, email) VALUES (?, ?)`).run(
      "EZ1NwuqMeyTydVsu4DMrm6ZJxvYOnsU7",
      "aldima@mail.com",
    );

    database
      .prepare(
        `
          INSERT INTO workspace_generation_history (
            job_id,
            owner_key,
            prompt,
            title,
            description,
            status,
            ad_id,
            hashtags,
            download_path,
            generated_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "job-legacy",
        "user:aldima@mail.com",
        "Legacy prompt",
        "Legacy title",
        "Legacy description",
        "done",
        2943,
        "#cats,#shorts",
        "/api/web/video/job-legacy",
        "2026-04-12T13:02:40.309Z",
        "2026-04-12T12:59:05.782Z",
        "2026-04-12T13:02:40.309Z",
      );

    database
      .prepare(
        `
          INSERT INTO workspace_deleted_projects (
            owner_key,
            project_id,
            ad_id,
            job_id,
            deleted_at
          )
          VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run("user:aldima@mail.com", "project:2943", 2943, "job-legacy", "2026-04-12T14:00:00.000Z");

    database
      .prepare(
        `
          INSERT INTO workspace_deleted_projects (
            owner_key,
            project_id,
            ad_id,
            job_id,
            deleted_at
          )
          VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run(
        "user:EZ1NwuqMeyTydVsu4DMrm6ZJxvYOnsU7",
        "project:2943",
        2943,
        null,
        "2026-04-12T13:00:00.000Z",
      );

    const historyModule = await import("./workspace-history.js");
    const result = await historyModule.runWorkspaceOwnerKeyMigration();

    expect(result).toEqual({
      migratedDeletedOwners: 1,
      migratedHistoryOwners: 1,
      scannedUsers: 1,
    });

    const migratedHistoryRow = database
      .prepare(`SELECT owner_key, job_id FROM workspace_generation_history WHERE job_id = ?`)
      .get("job-legacy") as { job_id: string; owner_key: string };
    expect(migratedHistoryRow).toEqual({
      job_id: "job-legacy",
      owner_key: "user:EZ1NwuqMeyTydVsu4DMrm6ZJxvYOnsU7",
    });

    const deletedRows = database
      .prepare(`SELECT owner_key, project_id, job_id, deleted_at FROM workspace_deleted_projects ORDER BY owner_key, project_id`)
      .all() as Array<{ deleted_at: string; job_id: string | null; owner_key: string; project_id: string }>;
    expect(deletedRows).toEqual([
      {
        deleted_at: "2026-04-12T14:00:00.000Z",
        job_id: "job-legacy",
        owner_key: "user:EZ1NwuqMeyTydVsu4DMrm6ZJxvYOnsU7",
        project_id: "project:2943",
      },
    ]);

    const historyEntries = await historyModule.listWorkspaceGenerationHistory(
      { id: "EZ1NwuqMeyTydVsu4DMrm6ZJxvYOnsU7", email: "aldima@mail.com" },
      20,
    );
    expect(historyEntries).toHaveLength(1);
    expect(historyEntries[0]).toMatchObject({
      adId: 2943,
      jobId: "job-legacy",
      title: "Legacy title",
    });

    const deletedEntries = await historyModule.listWorkspaceDeletedProjects({
      id: "EZ1NwuqMeyTydVsu4DMrm6ZJxvYOnsU7",
      email: "aldima@mail.com",
    });
    expect(deletedEntries).toEqual([
      {
        adId: 2943,
        deletedAt: "2026-04-12T14:00:00.000Z",
        jobId: "job-legacy",
        projectId: "project:2943",
      },
    ]);
  });

  it("migrates lineage columns and preserves them across later upserts", async () => {
    const historyModule = await import("./workspace-history.js");
    const user = {
      email: "aldima@mail.com",
      id: "EZ1NwuqMeyTydVsu4DMrm6ZJxvYOnsU7",
    };

    await historyModule.saveWorkspaceGenerationHistory(user, {
      description: "Edited version",
      editedFromProjectAdId: 42,
      jobId: "job-lineage",
      prompt: "Prompt",
      status: "queued",
      title: "Version",
      versionRootProjectAdId: 42,
    });

    const historyColumns = database
      .prepare(`PRAGMA table_info(workspace_generation_history)`)
      .all() as Array<{ name: string }>;
    expect(historyColumns.some((column) => column.name === "edited_from_project_ad_id")).toBe(true);
    expect(historyColumns.some((column) => column.name === "version_root_project_ad_id")).toBe(true);

    await historyModule.saveWorkspaceGenerationHistory(user, {
      adId: 77,
      jobId: "job-lineage",
      status: "done",
      updatedAt: "2026-04-12T13:02:40.309Z",
    });

    const savedEntry = await historyModule.getWorkspaceGenerationHistoryEntry(user, "job-lineage");
    expect(savedEntry).toMatchObject({
      adId: 77,
      editedFromProjectAdId: 42,
      jobId: "job-lineage",
      status: "done",
      versionRootProjectAdId: 42,
    });
  });
});
