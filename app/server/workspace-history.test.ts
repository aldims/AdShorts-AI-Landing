import { describe, expect, it } from "vitest";

import { buildWorkspaceOwnerKeyMigration } from "./workspace-history.js";

describe("workspace owner key migration", () => {
  it("builds canonical and legacy keys for email-based legacy rows", () => {
    expect(
      buildWorkspaceOwnerKeyMigration({
        id: "EZ1NwuqMeyTydVsu4DMrm6ZJxvYOnsU7",
        email: "aldima@mail.com",
      }),
    ).toEqual({
      canonicalOwnerKey: "user:EZ1NwuqMeyTydVsu4DMrm6ZJxvYOnsU7",
      legacyOwnerKeys: ["email:aldima@mail.com", "user:aldima@mail.com"],
    });
  });

  it("returns null when there is no canonical auth user id", () => {
    expect(
      buildWorkspaceOwnerKeyMigration({
        email: "test@example.com",
      }),
    ).toBeNull();
  });
});
