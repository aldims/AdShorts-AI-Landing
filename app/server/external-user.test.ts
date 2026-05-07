import { describe, expect, it } from "vitest";

import { buildAuthScopedCacheKey } from "./external-user.js";

describe("auth scoped cache keys", () => {
  it("separates cache entries for recreated auth users with the same provider identity", () => {
    const identity = "google:106678161078508174850";

    expect(buildAuthScopedCacheKey({ id: "old-auth-user", email: "alexmamondi@gmail.com" }, identity)).toBe(
      "user:old-auth-user|identity:google:106678161078508174850",
    );
    expect(buildAuthScopedCacheKey({ id: "new-auth-user", email: "alexmamondi@gmail.com" }, identity)).toBe(
      "user:new-auth-user|identity:google:106678161078508174850",
    );
  });

  it("uses normalized email when auth user id is unavailable", () => {
    expect(buildAuthScopedCacheKey({ email: " AlexMamondi@Gmail.com " }, "email:alexmamondi@gmail.com")).toBe(
      "email:alexmamondi@gmail.com|identity:email:alexmamondi@gmail.com",
    );
  });
});
