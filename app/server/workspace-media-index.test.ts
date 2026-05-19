import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  clearWorkspaceMediaIndex,
  listWorkspaceMediaIndexProjectEntries,
  pruneWorkspaceMediaIndexProjects,
  upsertWorkspaceMediaIndexProjectEntry,
  type WorkspaceMediaIndexProjectEntry,
  type WorkspaceMediaIndexUser,
} from "./workspace-media-index.js";

const testUsers: WorkspaceMediaIndexUser[] = [];

const createTestUser = (): WorkspaceMediaIndexUser => {
  const user = {
    email: `workspace-media-index-${randomUUID()}@example.test`,
    id: `workspace-media-index-${randomUUID()}`,
  };
  testUsers.push(user);
  return user;
};

const createEntry = (projectId: number): WorkspaceMediaIndexProjectEntry => ({
  items: [
    {
      assetExpiresAt: null,
      assetId: projectId,
      assetKind: "segment_original",
      assetLifecycle: "ready",
      assetMediaType: "photo",
      createdAt: `2026-05-19T00:00:${String(projectId).padStart(2, "0")}.000Z`,
      kind: "ai_photo",
      previewKind: "image",
      previewPosterUrl: null,
      previewUrl: `/api/workspace/media-assets/${projectId}/download`,
      segmentIndex: 0,
      segmentListIndex: 0,
    },
  ],
  projectId,
  projectVersion: `version-${projectId}`,
  updatedAt: `2026-05-19T00:00:${String(projectId).padStart(2, "0")}.000Z`,
});

afterEach(async () => {
  await Promise.all(testUsers.splice(0).map((user) => clearWorkspaceMediaIndex(user)));
});

describe("workspace media index persistence", () => {
  it("serializes concurrent project updates for the same user", async () => {
    const user = createTestUser();
    const projectIds = Array.from({ length: 32 }, (_, index) => index + 1);

    await Promise.all(
      projectIds.map((projectId) => upsertWorkspaceMediaIndexProjectEntry(user, createEntry(projectId))),
    );

    const entries = await listWorkspaceMediaIndexProjectEntries(user);
    expect(entries.map((entry) => entry.projectId)).toEqual(projectIds.slice().reverse());
  });

  it("serializes pruning with concurrent updates", async () => {
    const user = createTestUser();
    const projectIds = Array.from({ length: 12 }, (_, index) => index + 1);

    await Promise.all(
      projectIds.map((projectId) => upsertWorkspaceMediaIndexProjectEntry(user, createEntry(projectId))),
    );

    await Promise.all([
      pruneWorkspaceMediaIndexProjects(
        user,
        new Map(
          [...projectIds.filter((projectId) => projectId % 2 === 0), 13].map((projectId) => [
            projectId,
            `version-${projectId}`,
          ]),
        ),
      ),
      upsertWorkspaceMediaIndexProjectEntry(user, createEntry(13)),
    ]);

    const entries = await listWorkspaceMediaIndexProjectEntries(user);
    expect(entries.map((entry) => entry.projectId)).toEqual([13, 12, 10, 8, 6, 4, 2]);
  });
});
