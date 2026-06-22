import { describe, expect, it } from "vitest";

import { shouldDisplayWorkspaceSegmentGeneratedVoiceoverEdited } from "./workspace-utils";

describe("workspace voice timeline edit display", () => {
  it("does not mark every inherited scene voice as edited after a global voice change", () => {
    expect(
      shouldDisplayWorkspaceSegmentGeneratedVoiceoverEdited({
        hasExplicitSegmentVoiceOverride: false,
        isGeneratedVoiceoverEdited: true,
        isGlobalVoiceEdited: true,
        isTextEdited: false,
        isUnrenderedSceneVoiceoverAsset: true,
      }),
    ).toBe(false);
  });

  it("keeps scene-scoped voice changes visible", () => {
    expect(
      shouldDisplayWorkspaceSegmentGeneratedVoiceoverEdited({
        hasExplicitSegmentVoiceOverride: true,
        isGeneratedVoiceoverEdited: true,
        isGlobalVoiceEdited: true,
        isTextEdited: false,
        isUnrenderedSceneVoiceoverAsset: false,
      }),
    ).toBe(true);
  });

  it("keeps edited text voice generation visible", () => {
    expect(
      shouldDisplayWorkspaceSegmentGeneratedVoiceoverEdited({
        hasExplicitSegmentVoiceOverride: false,
        isGeneratedVoiceoverEdited: true,
        isGlobalVoiceEdited: true,
        isTextEdited: true,
        isUnrenderedSceneVoiceoverAsset: false,
      }),
    ).toBe(true);
  });

  it("does not mark inherited audio refreshes as scene voice changes", () => {
    expect(
      shouldDisplayWorkspaceSegmentGeneratedVoiceoverEdited({
        hasExplicitSegmentVoiceOverride: false,
        isGeneratedVoiceoverEdited: false,
        isGlobalVoiceEdited: false,
        isTextEdited: false,
        isUnrenderedSceneVoiceoverAsset: true,
      }),
    ).toBe(false);
  });
});
