import { describe, expect, it } from "vitest";

import { checkoutClientChannel, isCheckoutAttributionSource, isCheckoutOfferVariant } from "./payments.js";

describe("checkout attribution", () => {
  it("accepts only known sources and variants", () => {
    expect(isCheckoutAttributionSource("first_free_video_offer")).toBe(true);
    expect(isCheckoutAttributionSource("forged_source")).toBe(false);
    expect(isCheckoutOfferVariant("start_direct_v1")).toBe(true);
    expect(isCheckoutOfferVariant("force_paid")).toBe(false);
  });

  it("marks dynamic checkout as a web-client flow", () => {
    expect(checkoutClientChannel).toBe("web");
  });
});
