import { describe, expect, it } from "vitest";

import {
  filterWorkspaceProjectsByDeletionSnapshots,
  mergeWorkspaceProjectDeletionSnapshots,
  removeWorkspaceProjectDeletionSnapshots,
} from "./workspace-project-cards";

const projectIdentity = (overrides: Partial<{ adId: number | null; id: string; jobId: string | null }> = {}) => ({
  adId: overrides.adId ?? null,
  id: overrides.id ?? "project:1",
  jobId: overrides.jobId ?? null,
});

describe("workspace project deletion snapshots", () => {
  it("filters stale project payloads by id, ad id, or job id", () => {
    const projects = [
      projectIdentity({ adId: 41, id: "project:41", jobId: "job-41" }),
      projectIdentity({ adId: 42, id: "project:42", jobId: "job-42" }),
      projectIdentity({ adId: null, id: "task:alpha", jobId: "job-alpha" }),
      projectIdentity({ adId: 43, id: "project:43", jobId: "job-43" }),
    ];

    const filteredProjects = filterWorkspaceProjectsByDeletionSnapshots(projects, [
      projectIdentity({ adId: 42, id: "old-project-id", jobId: null }),
      projectIdentity({ adId: null, id: "old-task-id", jobId: "job-alpha" }),
    ]);

    expect(filteredProjects.map((project) => project.id)).toEqual(["project:41", "project:43"]);
  });

  it("deduplicates deletion snapshots by project identity", () => {
    const currentSnapshots = [projectIdentity({ adId: 42, id: "project:42", jobId: "job-42" })];

    const mergedSnapshots = mergeWorkspaceProjectDeletionSnapshots(currentSnapshots, [
      projectIdentity({ adId: 42, id: "project:renamed", jobId: null }),
      projectIdentity({ adId: 43, id: "project:43", jobId: "job-43" }),
    ]);

    expect(mergedSnapshots.map((project) => project.id)).toEqual(["project:42", "project:43"]);
  });

  it("removes failed deletion snapshots without restoring successful ones", () => {
    const currentSnapshots = [
      projectIdentity({ adId: 42, id: "project:42", jobId: "job-42" }),
      projectIdentity({ adId: 43, id: "project:43", jobId: "job-43" }),
    ];

    const remainingSnapshots = removeWorkspaceProjectDeletionSnapshots(currentSnapshots, [
      projectIdentity({ adId: null, id: "failed-project", jobId: "job-42" }),
    ]);

    expect(remainingSnapshots.map((project) => project.id)).toEqual(["project:43"]);
  });
});
