import { describe, expect, it } from "vitest";

import { readWebReferralSourceFromPathname } from "./App";

describe("readWebReferralSourceFromPathname", () => {
  it("accepts custom one-segment referral links without the legacy rf_ prefix", () => {
    expect(readWebReferralSourceFromPathname("/slr")).toBe("slr");
    expect(readWebReferralSourceFromPathname("/slr/")).toBe("slr");
    expect(readWebReferralSourceFromPathname("/rf_slr")).toBe("rf_slr");
    expect(readWebReferralSourceFromPathname("/en/slr")).toBe("en/slr");
    expect(readWebReferralSourceFromPathname("/my_campaign")).toBe("my_campaign");
    expect(readWebReferralSourceFromPathname("/en/my_campaign")).toBe("en/my_campaign");
  });

  it("rejects reserved app paths and invalid path shapes", () => {
    expect(readWebReferralSourceFromPathname("/app")).toBe("");
    expect(readWebReferralSourceFromPathname("/pricing")).toBe("");
    expect(readWebReferralSourceFromPathname("/en/app")).toBe("");
    expect(readWebReferralSourceFromPathname("/en/pricing")).toBe("");
    expect(readWebReferralSourceFromPathname("/privacy")).toBe("");
    expect(readWebReferralSourceFromPathname("/two/segments")).toBe("");
    expect(readWebReferralSourceFromPathname("/x")).toBe("");
    expect(readWebReferralSourceFromPathname("/en/x")).toBe("");
    expect(readWebReferralSourceFromPathname("/bad-code")).toBe("");
    expect(readWebReferralSourceFromPathname("/en/bad-code")).toBe("");
    expect(readWebReferralSourceFromPathname("/bad.code")).toBe("");
  });
});
