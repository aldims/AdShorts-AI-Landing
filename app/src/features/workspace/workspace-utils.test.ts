import { describe, expect, it } from "vitest";

import {
  resolveWorkspaceSegmentVoiceTimelineState,
  shouldDisplayWorkspaceSegmentGeneratedVoiceoverEdited,
  shouldDisplayWorkspaceSegmentSubtitleCellEdited,
  shouldDisplayWorkspaceSegmentVoiceCellEdited,
} from "./workspace-utils";

describe("workspace voice timeline edit display", () => {
  it("keeps voice undo available while a reverted text change can be restored", () => {
    expect(
      resolveWorkspaceSegmentVoiceTimelineState({
        canForwardText: true,
        canForwardVoice: false,
        isGeneratedVoiceoverEdited: false,
        isTextEdited: false,
        isVoiceSettingsEdited: true,
      }),
    ).toMatchObject({
      canBack: true,
      historyKind: "voice",
    });
  });

  it("prefers undoing current text edits before voice history", () => {
    expect(
      resolveWorkspaceSegmentVoiceTimelineState({
        canForwardText: false,
        canForwardVoice: true,
        isGeneratedVoiceoverEdited: false,
        isTextEdited: true,
        isVoiceSettingsEdited: false,
      }),
    ).toMatchObject({
      canBack: true,
      historyKind: "text",
    });
  });

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

  it("shows the voice timeline edited badge for global voice changes", () => {
    expect(
      shouldDisplayWorkspaceSegmentVoiceCellEdited({
        isGeneratedVoiceoverEdited: false,
        isGlobalVoiceEdited: true,
        isVoiceSettingsEdited: false,
      }),
    ).toBe(true);
  });

  it("shows the subtitle timeline edited badge for global subtitle changes", () => {
    expect(
      shouldDisplayWorkspaceSegmentSubtitleCellEdited({
        isGlobalSubtitleEdited: true,
        isSubtitleSettingsEdited: false,
      }),
    ).toBe(true);
  });
});
