import { describe, expect, it } from "vitest";

import {
  signAdminImpersonationToken,
  verifyAdminImpersonationToken,
} from "./admin-impersonation.js";

describe("admin impersonation tokens", () => {
  it("verifies a signed short-lived token", () => {
    const token = signAdminImpersonationToken(
      {
        adsflowUserId: "8005260980905781000",
        email: "alekigr@yandex.ru",
        exp: 1_800,
        externalUserId: "better-auth:auth-user-1",
        iat: 1_000,
      },
      "test-secret",
    );

    expect(verifyAdminImpersonationToken(token, { nowSeconds: 1_200, secret: "test-secret" })).toMatchObject({
      adsflowUserId: "8005260980905781000",
      email: "alekigr@yandex.ru",
      externalUserId: "better-auth:auth-user-1",
    });
  });

  it("rejects expired and incorrectly signed tokens", () => {
    const token = signAdminImpersonationToken(
      {
        email: "alekigr@yandex.ru",
        exp: 1_100,
        externalUserId: "email:alekigr@yandex.ru",
        iat: 1_000,
      },
      "test-secret",
    );

    expect(() => verifyAdminImpersonationToken(token, { nowSeconds: 1_200, secret: "test-secret" })).toThrow(
      "expired",
    );
    expect(() => verifyAdminImpersonationToken(token, { nowSeconds: 1_050, secret: "wrong-secret" })).toThrow(
      "signature",
    );
  });
});
