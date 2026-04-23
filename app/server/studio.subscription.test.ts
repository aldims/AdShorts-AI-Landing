import { describe, expect, it } from "vitest";

import { resolveWorkspaceSubscriptionDetailsFromAdminPayload } from "./studio.js";

describe("studio subscription expiry resolution", () => {
  it("derives paid plan expiry from the latest successful payment when admin payload misses subscription_type", () => {
    const details = resolveWorkspaceSubscriptionDetailsFromAdminPayload(
      {
        payments: [
          {
            paid_at: "2026-02-14T12:00:00.000Z",
            plan_code: "start",
            status: "succeeded",
          },
          {
            paid_at: "2026-04-02T15:30:00.000Z",
            plan_code: "pro",
            status: "succeeded",
          },
        ],
        user: {
          subscription_expires_at: null,
          subscription_type: null,
        },
      },
      {
        currentPlanHint: "PRO",
      },
    );

    expect(details).toEqual({
      expiresAt: "2026-05-02T15:30:00.000Z",
      startPlanUsed: true,
    });
  });

  it("falls back to the latest known paid plan payment when no plan hint is available", () => {
    const details = resolveWorkspaceSubscriptionDetailsFromAdminPayload({
      payments: [
        {
          paid_at: "2026-03-01T08:00:00.000Z",
          plan_code: "package_50",
          status: "succeeded",
        },
        {
          paid_at: "2026-04-10T09:45:00.000Z",
          plan_code: "ultra",
          status: "succeeded",
        },
      ],
      user: {
        subscription_expires_at: null,
        subscription_type: null,
      },
    });

    expect(details).toEqual({
      expiresAt: "2026-05-10T09:45:00.000Z",
      startPlanUsed: false,
    });
  });

  it("prefers the direct subscription expiry when AdsFlow returns it", () => {
    const details = resolveWorkspaceSubscriptionDetailsFromAdminPayload({
      payments: [
        {
          paid_at: "2026-04-10T09:45:00.000Z",
          plan_code: "ultra",
          status: "succeeded",
        },
      ],
      user: {
        subscription_expires_at: "2026-06-01T00:00:00.000Z",
        subscription_type: "ultra",
      },
    });

    expect(details).toEqual({
      expiresAt: "2026-06-01T00:00:00.000Z",
      startPlanUsed: false,
    });
  });
});
