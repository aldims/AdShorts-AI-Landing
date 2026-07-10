import { describe, expect, it } from "vitest";

import {
  STUDIO_AI_PHOTO_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_AI_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_CREDIT_COST_BY_ACTION,
  STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_SEGMENT_AI_PHOTO_PREMIUM_CREDIT_COST,
  STUDIO_SEGMENT_AI_VIDEO_PREMIUM_CREDIT_COST,
  buildStudioBatchVoiceoverBillingRuns,
  buildStudioVoiceoverProviderText,
  getStudioBatchVoiceoverCreditCost,
  getStudioSegmentTalkingPhotoCreditCost,
  getStudioSegmentTalkingPhotoCreditCostForDuration,
  getStudioSegmentVoiceoverCreditCost,
  getStudioVoiceoverCharacterCount,
  getStudioVoiceoverCreditCostForText,
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
  it("exposes one credit as the minimum enabled voiceover price", () => {
    expect(getStudioSegmentVoiceoverCreditCost("Bys_24000")).toBe(1);
    expect(getStudioSegmentVoiceoverCreditCost("Liam")).toBe(1);
    expect(getStudioSegmentVoiceoverCreditCost("Liam_Timing")).toBe(1);
    expect(getStudioSegmentVoiceoverCreditCost("Elena")).toBe(1);
    expect(getStudioSegmentVoiceoverCreditCost("English_ManWithDeepVoice")).toBe(1);
    expect(getStudioSegmentVoiceoverCreditCost("Russian_BrightHeroine")).toBe(1);
    expect(getStudioSegmentVoiceoverCreditCost("none")).toBe(0);
    expect(getStudioSegmentVoiceoverCreditCost(null)).toBe(0);
  });

  it("prices normalized provider text by each started one hundred Unicode characters", () => {
    expect(getStudioVoiceoverCreditCostForText("")).toBe(0);
    expect(getStudioVoiceoverCreditCostForText("я")).toBe(1);
    expect(getStudioVoiceoverCreditCostForText("я".repeat(100))).toBe(1);
    expect(getStudioVoiceoverCreditCostForText("я".repeat(101))).toBe(2);
    expect(getStudioVoiceoverCreditCostForText("я".repeat(157))).toBe(2);
    expect(getStudioVoiceoverCharacterCount("  Привет\n\nмир!  ")).toBe(11);
    expect(getStudioVoiceoverCharacterCount("😀".repeat(100))).toBe(100);
  });

  it("prices the exact text sent for adjacent batch targets", () => {
    const providerText = buildStudioVoiceoverProviderText(["а".repeat(59), "б".repeat(59)]);
    expect(getStudioVoiceoverCharacterCount(providerText)).toBe(121);
    expect(getStudioBatchVoiceoverCreditCost([
      {
        language: "ru",
        voiceType: "Liam_Timing",
        segments: [
          { segmentIndex: 0, text: "а".repeat(59) },
          { segmentIndex: 1, text: "б".repeat(59) },
        ],
      },
    ])).toBe(2);
  });

  it("rounds separate provider runs independently", () => {
    const runs = buildStudioBatchVoiceoverBillingRuns([
      {
        language: "ru",
        voiceType: "Liam_Timing",
        segments: [
          { segmentIndex: 0, text: "а".repeat(40) },
          { segmentIndex: 2, text: "в".repeat(40) },
        ],
      },
      {
        language: "ru",
        voiceType: "Elena",
        segments: [{ segmentIndex: 1, text: "б".repeat(40) }],
      },
    ]);

    expect(runs.map((run) => run.creditCost)).toEqual([1, 1, 1]);
    expect(runs.map((run) => run.segmentIndexes)).toEqual([[0], [1], [2]]);
    expect(getStudioBatchVoiceoverCreditCost([
      {
        language: "ru",
        voiceType: "Liam_Timing",
        segments: [
          { segmentIndex: 0, text: "а".repeat(40) },
          { segmentIndex: 2, text: "в".repeat(40) },
        ],
      },
      {
        language: "ru",
        voiceType: "Elena",
        segments: [{ segmentIndex: 1, text: "б".repeat(40) }],
      },
    ])).toBe(3);
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
