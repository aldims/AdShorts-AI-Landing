import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const importProductionEnv = async (infographicFlag: string) => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_URL", "https://adshortsai.test");
  vi.stubEnv("BETTER_AUTH_URL", "https://adshortsai.test");
  vi.stubEnv("BETTER_AUTH_SECRET", "production-test-secret");
  vi.stubEnv("STUDIO_SEGMENT_INFOGRAPHIC_ENABLED", infographicFlag);

  const { env } = await import("./env.js");
  return env;
};

describe("server environment", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("enables segment infographics by default in production", async () => {
    const env = await importProductionEnv("");

    expect(env.studioSegmentInfographicEnabled).toBe(true);
  });

  it("preserves the production kill switch", async () => {
    const env = await importProductionEnv("false");

    expect(env.studioSegmentInfographicEnabled).toBe(false);
  });
});
