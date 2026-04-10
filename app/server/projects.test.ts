import { describe, expect, it } from "vitest";

import { applyLatestGenerationHistoryToAdIdIndex } from "./projects.js";
import type { WorkspaceGenerationHistoryEntry } from "./workspace-history.js";

const buildHistoryEntry = (overrides: Partial<WorkspaceGenerationHistoryEntry> = {}): WorkspaceGenerationHistoryEntry => ({
  adId: null,
  createdAt: "2026-04-10T12:00:00.000Z",
  description: "Русское описание",
  downloadPath: null,
  error: null,
  generatedAt: null,
  hashtags: ["#русский"],
  jobId: "job-123",
  prompt: "Русская тема видео",
  status: "queued",
  title: "Русская тема видео",
  updatedAt: "2026-04-10T12:00:00.000Z",
  ...overrides,
});

describe("projects latest generation history mapping", () => {
  it("links the latest generation job history to the admin video ad id", () => {
    const historyEntry = buildHistoryEntry();
    const historyEntriesByAdId = new Map<number, WorkspaceGenerationHistoryEntry>();
    const historyEntriesByJobId = new Map<string, WorkspaceGenerationHistoryEntry>([[historyEntry.jobId, historyEntry]]);

    applyLatestGenerationHistoryToAdIdIndex(
      {
        ad_id: 42,
        job_id: historyEntry.jobId,
      },
      historyEntriesByAdId,
      historyEntriesByJobId,
    );

    expect(historyEntriesByAdId.get(42)).toBe(historyEntry);
    expect(historyEntriesByAdId.get(42)?.prompt).toBe("Русская тема видео");
  });
});
