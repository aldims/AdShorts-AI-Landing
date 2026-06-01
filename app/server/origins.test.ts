import { describe, expect, it } from "vitest";

import {
  getConfiguredOrigins,
  getTrustedAuthOrigins,
  isAllowedCorsOrigin,
} from "./origins.js";

describe("server origins", () => {
  const configuredOrigins = getConfiguredOrigins(
    "https://adshorts.ai",
    "https://auth.adshorts.ai",
    false,
  );

  it("allows dynamic loopback ports only in development", () => {
    expect(isAllowedCorsOrigin("http://localhost:4176", configuredOrigins, true)).toBe(true);
    expect(isAllowedCorsOrigin("http://127.0.0.1:5183", configuredOrigins, true)).toBe(true);
    expect(isAllowedCorsOrigin("http://[::1]:4176", configuredOrigins, true)).toBe(true);
    expect(isAllowedCorsOrigin("http://localhost:4176", configuredOrigins, false)).toBe(false);
  });

  it("rejects non-loopback and non-http development origins", () => {
    expect(isAllowedCorsOrigin("http://localhost.example.com:4176", configuredOrigins, true)).toBe(false);
    expect(isAllowedCorsOrigin("https://localhost:4176", configuredOrigins, true)).toBe(false);
    expect(isAllowedCorsOrigin("invalid-origin", configuredOrigins, true)).toBe(false);
  });

  it("adds Better Auth loopback wildcard patterns only outside production", () => {
    expect(getTrustedAuthOrigins("https://adshorts.ai", "https://auth.adshorts.ai", false)).toContain(
      "http://localhost:*",
    );
    expect(getTrustedAuthOrigins("https://adshorts.ai", "https://auth.adshorts.ai", true)).not.toContain(
      "http://localhost:*",
    );
  });
});
