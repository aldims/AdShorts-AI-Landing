import { describe, expect, it } from "vitest";

import {
  createWorkspaceSegmentEditorProjectBrandState,
  getStudioBrandSummary,
  resolveWorkspaceSegmentEditorEffectiveBrandState,
  shouldSendWorkspaceSegmentEditorBrandChangeForGeneration,
} from "./workspace-brand-helpers";

describe("workspace brand helpers", () => {
  it("localizes brand summary copy", () => {
    expect(getStudioBrandSummary({}, "en")).toBe("Logo or brand text");
    expect(getStudioBrandSummary({ brandText: "adshortsai.com" }, "en")).toBe("Text: adshortsai.com");
    expect(getStudioBrandSummary({ brandText: "adshortsai.com" }, "ru")).toBe("Текст: adshortsai.com");
  });

  it("sends applied segment-editor branding during generation even when unchanged", () => {
    const appliedBrand = createWorkspaceSegmentEditorProjectBrandState({
      brandText: "adshortsai.com",
    });
    const state = resolveWorkspaceSegmentEditorEffectiveBrandState({
      applied: appliedBrand,
      baseline: appliedBrand,
      current: appliedBrand,
    });

    expect(state.hasBranding).toBe(true);
    expect(state.hasBrandChange).toBe(false);
    expect(shouldSendWorkspaceSegmentEditorBrandChangeForGeneration(state)).toBe(true);
  });

  it("does not send an unchanged empty segment-editor brand", () => {
    const emptyBrand = createWorkspaceSegmentEditorProjectBrandState();
    const state = resolveWorkspaceSegmentEditorEffectiveBrandState({
      applied: emptyBrand,
      baseline: emptyBrand,
      current: emptyBrand,
    });

    expect(shouldSendWorkspaceSegmentEditorBrandChangeForGeneration(state)).toBe(false);
  });
});
