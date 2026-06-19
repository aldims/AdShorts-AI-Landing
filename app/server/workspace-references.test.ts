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

  it("keeps references stable when the auth user id changes for the same email", async () => {
    const email = `workspace-reference-${randomUUID()}@example.test`;
    const firstAuthUser = {
      email,
      id: `workspace-reference-${randomUUID()}`,
    };
    const secondAuthUser = {
      email,
      id: `workspace-reference-${randomUUID()}`,
    };
    testUsers.push(firstAuthUser, secondAuthUser);

    await createWorkspaceSavedReference(firstAuthUser, {
      assetId: 351,
      kind: "character",
      name: "Stable email character",
    });

    expect((await listWorkspaceSavedReferences(secondAuthUser)).map((reference) => reference.name)).toEqual([
      "Stable email character",
    ]);
  });

  it("reads legacy id-only references after email is attached to the same auth user", async () => {
    const userId = `workspace-reference-${randomUUID()}`;
    const legacyUser = { id: userId };
    const currentUser = {
      email: `workspace-reference-${randomUUID()}@example.test`,
      id: userId,
    };
    testUsers.push(legacyUser, currentUser);

    await createWorkspaceSavedReference(legacyUser, {
      assetId: 361,
      kind: "character",
      name: "Legacy id character",
    });
    await createWorkspaceSavedReference(currentUser, {
      assetId: 362,
      kind: "scene",
      name: "Current email scene",
    });

    expect((await listWorkspaceSavedReferences(currentUser)).map((reference) => reference.name).sort()).toEqual([
      "Current email scene",
      "Legacy id character",
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
