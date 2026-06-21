// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { clearPendingAuthFlow, readPendingAuthFlow, writePendingAuthFlow } from "./auth-funnel";

describe("auth funnel pending flow", () => {
  afterEach(() => {
    clearPendingAuthFlow();
  });

  it("stores and clears a pending OAuth flow", () => {
    writePendingAuthFlow({
      authMode: "signup",
      authProvider: "google",
      lang: "ru",
      path: "/app/studio",
    });

    expect(readPendingAuthFlow()).toMatchObject({
      authMode: "signup",
      authProvider: "google",
      lang: "ru",
      path: "/app/studio",
    });

    clearPendingAuthFlow();
    expect(readPendingAuthFlow()).toBeNull();
  });

  it("drops stale pending OAuth flows", () => {
    writePendingAuthFlow({
      authMode: "signin",
      authProvider: "google",
      lang: "en",
      path: "/en/app/studio",
    });

    const pending = readPendingAuthFlow();
    expect(pending).toBeTruthy();

    const startedAtMs = Date.parse(pending?.startedAt ?? "");
    expect(readPendingAuthFlow(startedAtMs + 31 * 60 * 1000)).toBeNull();
  });
});
