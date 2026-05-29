import { describe, expect, it } from "vitest";

import {
  STUDIO_CREDIT_COST_BY_ACTION,
  STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_VIDEO_GENERATION_CREDIT_COST,
  getStudioSegmentVoiceoverCreditCost,
  getStudioSegmentPhotoAnimationCreditCost,
  getStudioSegmentPhotoAnimationDurationOptions,
  normalizeStudioSegmentPhotoAnimationDurationSeconds,
} from "./studio-credit-costs";

describe("video generation credit costs", () => {
  it("prices standard Create Shorts generation at ten credits", () => {
    expect(STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST).toBe(10);
    expect(STUDIO_VIDEO_GENERATION_CREDIT_COST).toBe(10);
    expect(STUDIO_CREDIT_COST_BY_ACTION.video_generation).toBe(10);
  });
});

describe("photo animation credit costs", () => {
  it("prices standard 5s and 8s animation durations", () => {
    expect(getStudioSegmentPhotoAnimationDurationOptions("standard")).toEqual([5, 8]);
    expect(getStudioSegmentPhotoAnimationCreditCost("standard", 5)).toBe(5);
    expect(getStudioSegmentPhotoAnimationCreditCost("standard", 8)).toBe(8);
  });

  it("prices premium 5s and 10s animation durations", () => {
    expect(getStudioSegmentPhotoAnimationDurationOptions("premium")).toEqual([5, 10]);
    expect(getStudioSegmentPhotoAnimationCreditCost("premium", 5)).toBe(10);
    expect(getStudioSegmentPhotoAnimationCreditCost("premium", 10)).toBe(20);
  });

  it("normalizes unsupported durations to the nearest option for the selected quality", () => {
    expect(normalizeStudioSegmentPhotoAnimationDurationSeconds("standard", 10)).toBe(8);
    expect(normalizeStudioSegmentPhotoAnimationDurationSeconds("premium", 8)).toBe(10);
    expect(normalizeStudioSegmentPhotoAnimationDurationSeconds("premium", 6)).toBe(5);
  });
});

describe("segment voiceover credit costs", () => {
  it("prices standard, premium, and disabled scene voiceover generation", () => {
    expect(getStudioSegmentVoiceoverCreditCost("Bys_24000")).toBe(1);
    expect(getStudioSegmentVoiceoverCreditCost("Liam")).toBe(5);
    expect(getStudioSegmentVoiceoverCreditCost("English_ManWithDeepVoice")).toBe(5);
    expect(getStudioSegmentVoiceoverCreditCost("Russian_BrightHeroine")).toBe(5);
    expect(getStudioSegmentVoiceoverCreditCost("none")).toBe(0);
    expect(getStudioSegmentVoiceoverCreditCost(null)).toBe(0);
  });
});
