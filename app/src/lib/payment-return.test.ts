// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import {
  buildPaymentReturnUrl,
  evaluateCheckoutPaymentProfile,
  pollCheckoutPaymentProfile,
  readPaymentReturnAttribution,
  removePaymentReturnParams,
} from "./payment-return";

describe("payment return", () => {
  it("recognizes START activation and added credits", () => {
    expect(
      evaluateCheckoutPaymentProfile({
        previousProfile: { balance: 0, plan: "FREE" },
        productId: "start",
        profile: { balance: 50, plan: "START" },
      }),
    ).toEqual({
      addedCredits: 50,
      balance: 50,
      plan: "START",
      productId: "start",
      status: "success",
    });
  });

  it("polls until the payment profile changes", async () => {
    const fetchProfile = vi
      .fn()
      .mockResolvedValueOnce({ balance: 0, plan: "FREE" })
      .mockResolvedValueOnce({ balance: 50, plan: "START" });
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      pollCheckoutPaymentProfile({
        attempts: 4,
        delayMs: 2_000,
        fetchProfile,
        previousProfile: { balance: 0, plan: "FREE" },
        productId: "start",
        wait,
      }),
    ).resolves.toMatchObject({ addedCredits: 50, status: "success" });
    expect(fetchProfile).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it("stops without side effects when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchProfile = vi.fn();

    await expect(
      pollCheckoutPaymentProfile({
        attempts: 2,
        delayMs: 0,
        fetchProfile,
        previousProfile: null,
        productId: "start",
        signal: controller.signal,
      }),
    ).resolves.toBeNull();
    expect(fetchProfile).not.toHaveBeenCalled();
  });

  it("round-trips offer attribution and removes only payment parameters", () => {
    const returnUrl = buildPaymentReturnUrl({
      paymentId: "payment-1",
      pricingPath: "/app/studio?mode=idea",
      productId: "start",
      source: "first_free_video_offer",
      variant: "start_direct_v1",
    });
    const url = new URL(returnUrl);

    expect(readPaymentReturnAttribution(url.search)).toEqual({
      source: "first_free_video_offer",
      variant: "start_direct_v1",
    });
    expect(removePaymentReturnParams(url.search)).toBe("?mode=idea");
  });
});
