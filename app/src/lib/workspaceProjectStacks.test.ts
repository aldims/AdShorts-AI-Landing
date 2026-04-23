import { describe, expect, it } from "vitest";

import { buildWorkspaceProjectStackGroups } from "./workspaceProjectStacks";

type TestProject = {
  adId: number | null;
  editedFromProjectAdId: number | null;
  id: string;
  updatedAt: string;
  versionRootProjectAdId: number | null;
};

const createProject = (overrides: Partial<TestProject> = {}): TestProject => ({
  adId: 1,
  editedFromProjectAdId: null,
  id: "project-1",
  updatedAt: "2026-04-10T12:00:00.000Z",
  versionRootProjectAdId: null,
  ...overrides,
});

describe("workspace project stacks", () => {
  it("keeps ordinary projects as standalone cards", () => {
    const groups = buildWorkspaceProjectStackGroups([
      createProject({ adId: 10, id: "project-10", updatedAt: "2026-04-10T10:00:00.000Z" }),
      createProject({ adId: 11, id: "project-11", updatedAt: "2026-04-11T10:00:00.000Z" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => ({ isStack: group.isStack, key: group.key }))).toEqual([
      { isStack: false, key: "11" },
      { isStack: false, key: "10" },
    ]);
  });

  it("groups an original project with a single edit version", () => {
    const groups = buildWorkspaceProjectStackGroups([
      createProject({ adId: 42, id: "project-42", updatedAt: "2026-04-10T10:00:00.000Z" }),
      createProject({
        adId: 57,
        editedFromProjectAdId: 42,
        id: "project-57",
        updatedAt: "2026-04-11T10:00:00.000Z",
        versionRootProjectAdId: 42,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      isStack: true,
      key: "42",
    });
    expect(groups[0]?.projects.map((project) => project.id)).toEqual(["project-57", "project-42"]);
    expect(groups[0]?.leadProject.id).toBe("project-57");
  });

  it("keeps an edit chain in one stack with the newest version on top", () => {
    const groups = buildWorkspaceProjectStackGroups([
      createProject({ adId: 42, id: "project-42", updatedAt: "2026-04-10T10:00:00.000Z" }),
      createProject({
        adId: 57,
        editedFromProjectAdId: 42,
        id: "project-57",
        updatedAt: "2026-04-11T10:00:00.000Z",
        versionRootProjectAdId: 42,
      }),
      createProject({
        adId: 73,
        editedFromProjectAdId: 57,
        id: "project-73",
        updatedAt: "2026-04-12T10:00:00.000Z",
        versionRootProjectAdId: 42,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.isStack).toBe(true);
    expect(groups[0]?.projects.map((project) => project.id)).toEqual([
      "project-73",
      "project-57",
      "project-42",
    ]);
  });

  it("does not group legacy projects without lineage metadata", () => {
    const groups = buildWorkspaceProjectStackGroups([
      createProject({ adId: null, id: "legacy-a", updatedAt: "2026-04-12T10:00:00.000Z" }),
      createProject({ adId: null, id: "legacy-b", updatedAt: "2026-04-13T10:00:00.000Z" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.every((group) => !group.isStack)).toBe(true);
    expect(groups.map((group) => group.key)).toEqual(["legacy:legacy-b", "legacy:legacy-a"]);
  });

  it("keeps remaining edit versions stacked after the original is removed", () => {
    const groups = buildWorkspaceProjectStackGroups([
      createProject({
        adId: 57,
        editedFromProjectAdId: 42,
        id: "project-57",
        updatedAt: "2026-04-11T10:00:00.000Z",
        versionRootProjectAdId: 42,
      }),
      createProject({
        adId: 73,
        editedFromProjectAdId: 57,
        id: "project-73",
        updatedAt: "2026-04-12T10:00:00.000Z",
        versionRootProjectAdId: 42,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe("42");
    expect(groups[0]?.isStack).toBe(true);
    expect(groups[0]?.leadProject.id).toBe("project-73");
  });
});
