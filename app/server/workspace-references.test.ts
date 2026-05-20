import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import {
  clearWorkspaceSavedReferences,
  createWorkspaceSavedReference,
  deleteWorkspaceSavedReference,
  listWorkspaceSavedReferences,
  updateWorkspaceSavedReference,
  type WorkspaceReferenceUser,
} from "./workspace-references.js";

const testUsers: WorkspaceReferenceUser[] = [];

const createTestUser = (): WorkspaceReferenceUser => {
  const user = {
    email: `workspace-reference-${randomUUID()}@example.test`,
    id: `workspace-reference-${randomUUID()}`,
  };
  testUsers.push(user);
  return user;
};

afterEach(async () => {
  await Promise.all(testUsers.splice(0).map((user) => clearWorkspaceSavedReferences(user)));
});

describe("workspace references", () => {
  it("creates default names per reference kind", async () => {
    const user = createTestUser();

    const firstCharacter = await createWorkspaceSavedReference(user, {
      assetId: 101,
      kind: "character",
    });
    const secondCharacter = await createWorkspaceSavedReference(user, {
      assetId: 102,
      kind: "character",
    });
    const firstScene = await createWorkspaceSavedReference(user, {
      assetId: 201,
      kind: "scene",
    });

    expect(firstCharacter.name).toBe("Персонаж 1");
    expect(secondCharacter.name).toBe("Персонаж 2");
    expect(firstScene.name).toBe("Сцена 1");
  });

  it("keeps references isolated by owner", async () => {
    const firstUser = createTestUser();
    const secondUser = createTestUser();

    await createWorkspaceSavedReference(firstUser, {
      assetId: 301,
      kind: "character",
      name: "First owner character",
    });
    await createWorkspaceSavedReference(secondUser, {
      assetId: 302,
      kind: "character",
      name: "Second owner character",
    });

    expect((await listWorkspaceSavedReferences(firstUser)).map((reference) => reference.name)).toEqual([
      "First owner character",
    ]);
    expect((await listWorkspaceSavedReferences(secondUser)).map((reference) => reference.name)).toEqual([
      "Second owner character",
    ]);
  });

  it("updates and deletes saved references without touching other records", async () => {
    const user = createTestUser();
    const character = await createWorkspaceSavedReference(user, {
      assetId: 401,
      kind: "character",
    });
    const scene = await createWorkspaceSavedReference(user, {
      assetId: 402,
      kind: "scene",
    });

    const updatedCharacter = await updateWorkspaceSavedReference(user, character.id, {
      description: "Updated description",
      name: "Hero",
    });
    await deleteWorkspaceSavedReference(user, scene.id);

    expect(updatedCharacter).toMatchObject({
      description: "Updated description",
      id: character.id,
      name: "Hero",
    });
    expect((await listWorkspaceSavedReferences(user)).map((reference) => reference.id)).toEqual([
      character.id,
    ]);
  });
});

