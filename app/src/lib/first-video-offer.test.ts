import { describe, expect, it } from "vitest";

import {
  activeFirstVideoOfferVariant,
  isFirstVideoOfferEligible,
  isProjectFirstVideoOfferEligible,
} from "./first-video-offer";

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
  it("uses the direct START offer for every eligible user", () => {
    expect(activeFirstVideoOfferVariant).toBe("start_direct_v1");
  });

  it("shows only for the first eligible RU free result", () => {
    expect(isFirstVideoOfferEligible(eligibleInput)).toBe(true);
    expect(isFirstVideoOfferEligible({ ...eligibleInput, locale: "en" })).toBe(false);
    expect(isFirstVideoOfferEligible({ ...eligibleInput, plan: "START" })).toBe(false);
    expect(isFirstVideoOfferEligible({ ...eligibleInput, startPlanUsed: true })).toBe(false);
    expect(isFirstVideoOfferEligible({ ...eligibleInput, readyProjectsCount: 2 })).toBe(false);
  });

  it("reuses the same eligibility for a ready project without requiring expanded generation actions", () => {
    const projectInput = {
      hasLoadedProjects: true,
      hasReadyProject: true,
      locale: "ru" as const,
      plan: "FREE",
      projectsFailed: false,
      readyProjectsCount: 1,
      startPlanUsed: false,
    };

    expect(isProjectFirstVideoOfferEligible(projectInput)).toBe(true);
    expect(isProjectFirstVideoOfferEligible({ ...projectInput, hasReadyProject: false })).toBe(false);
    expect(isProjectFirstVideoOfferEligible({ ...projectInput, plan: "START" })).toBe(false);
    expect(isProjectFirstVideoOfferEligible({ ...projectInput, readyProjectsCount: 2 })).toBe(false);
  });
});
