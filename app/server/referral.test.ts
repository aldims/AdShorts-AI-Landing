import { describe, expect, it } from "vitest";

import { normalizeWebReferralSource } from "./referral.js";

describe("normalizeWebReferralSource", () => {
  it("keeps default and English referral counters separate", () => {
    expect(normalizeWebReferralSource("test1")).toBe("test1");
    expect(normalizeWebReferralSource("en/test1")).toBe("en/test1");
    expect(normalizeWebReferralSource("/en/test1/")).toBe("en/test1");
  });

  it("rejects invalid referral sources", () => {
    expect(normalizeWebReferralSource("en/test-1")).toBe("");
    expect(normalizeWebReferralSource("two/segments")).toBe("");
    expect(normalizeWebReferralSource("x")).toBe("");
  });
});
