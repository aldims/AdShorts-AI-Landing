import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";

import {
  signAdminImpersonationToken,
  verifyAdminImpersonationToken,
} from "./admin-impersonation.js";
import {
  getBetterAuthSessionCookieName,
  setBetterAuthSessionCookie,
  signBetterAuthSessionCookieValue,
} from "./auth.js";

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

  it("sets the Better Auth session cookie as a signed root cookie", () => {
    const res = {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as Response;

    setBetterAuthSessionCookie(res, "session-token", new Date("2026-05-09T12:00:00.000Z"));

    expect(res.cookie).toHaveBeenCalledWith(
      getBetterAuthSessionCookieName(),
      signBetterAuthSessionCookieValue("session-token"),
      expect.objectContaining({
        encode: String,
        expires: new Date("2026-05-09T12:00:00.000Z"),
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      }),
    );
    expect(signBetterAuthSessionCookieValue("session-token")).not.toBe("session-token");
    expect(res.clearCookie).toHaveBeenCalledWith(
      "better-auth.session_token",
      expect.objectContaining({ path: "/api/auth" }),
    );
  });
});
