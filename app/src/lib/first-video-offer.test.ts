import { describe, expect, it } from "vitest";

import { isFirstVideoOfferEligible, normalizeFirstVideoOfferVariant } from "./first-video-offer";

const eligibleInput = {
  firstVideoActionsExpanded: true,
  hasLoadedProjects: true,
  hasVisibleVideo: true,
  locale: "ru" as const,
  plan: "FREE",
  projectsFailed: false,
  readyProjectsCount: 1,
  startPlanUsed: false,
};

describe("first video offer", () => {
  it("accepts only known experiment variants", () => {
    expect(normalizeFirstVideoOfferVariant("start_direct_v1")).toBe("start_direct_v1");
    expect(normalizeFirstVideoOfferVariant("force_paid")).toBeNull();
  });

  it("shows only for the first eligible RU free result", () => {
    expect(isFirstVideoOfferEligible(eligibleInput)).toBe(true);
    expect(isFirstVideoOfferEligible({ ...eligibleInput, locale: "en" })).toBe(false);
    expect(isFirstVideoOfferEligible({ ...eligibleInput, plan: "START" })).toBe(false);
    expect(isFirstVideoOfferEligible({ ...eligibleInput, startPlanUsed: true })).toBe(false);
    expect(isFirstVideoOfferEligible({ ...eligibleInput, readyProjectsCount: 2 })).toBe(false);
  });
});
