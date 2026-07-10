import { describe, expect, it } from "vitest";

import {
  STUDIO_AI_PHOTO_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_AI_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_CREDIT_COST_BY_ACTION,
  STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_SEGMENT_AI_PHOTO_PREMIUM_CREDIT_COST,
  STUDIO_SEGMENT_AI_VIDEO_PREMIUM_CREDIT_COST,
  getStudioSegmentTalkingPhotoCreditCost,
  getStudioSegmentTalkingPhotoCreditCostForDuration,
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
    expect(STUDIO_AI_PHOTO_VIDEO_GENERATION_CREDIT_COST).toBe(10);
    expect(STUDIO_AI_VIDEO_GENERATION_CREDIT_COST).toBe(80);
    expect(STUDIO_SEGMENT_AI_PHOTO_PREMIUM_CREDIT_COST).toBe(2);
    expect(STUDIO_SEGMENT_AI_VIDEO_PREMIUM_CREDIT_COST).toBe(15);
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
  it("prices every enabled scene voiceover at two credits", () => {
    expect(getStudioSegmentVoiceoverCreditCost("Bys_24000")).toBe(2);
    expect(getStudioSegmentVoiceoverCreditCost("Liam")).toBe(2);
    expect(getStudioSegmentVoiceoverCreditCost("Liam_Timing")).toBe(2);
    expect(getStudioSegmentVoiceoverCreditCost("Elena")).toBe(2);
    expect(getStudioSegmentVoiceoverCreditCost("English_ManWithDeepVoice")).toBe(2);
    expect(getStudioSegmentVoiceoverCreditCost("Russian_BrightHeroine")).toBe(2);
    expect(getStudioSegmentVoiceoverCreditCost("none")).toBe(0);
    expect(getStudioSegmentVoiceoverCreditCost(null)).toBe(0);
  });
});

describe("talking photo credit costs", () => {
  it("prices talking character generation by estimated duration with a ten credit minimum", () => {
    expect(getStudioSegmentTalkingPhotoCreditCostForDuration(5)).toBe(10);
    expect(getStudioSegmentTalkingPhotoCreditCostForDuration(7)).toBe(14);
    expect(getStudioSegmentTalkingPhotoCreditCostForDuration(10)).toBe(20);
  });

  it("prices non-empty talking character scripts and ignores empty text", () => {
    expect(getStudioSegmentTalkingPhotoCreditCost("")).toBe(0);
    expect(getStudioSegmentTalkingPhotoCreditCost("Короткий текст")).toBe(10);
    expect(
      getStudioSegmentTalkingPhotoCreditCost(
        "Раз два три четыре пять шесть семь восемь девять десять одиннадцать двенадцать тринадцать четырнадцать пятнадцать шестнадцать семнадцать восемнадцать девятнадцать двадцать",
      ),
    ).toBeGreaterThan(10);
  });
});
