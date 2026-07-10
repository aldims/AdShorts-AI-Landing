import { describe, expect, it } from "vitest";

import {
  resolveWorkspaceSegmentVoiceTimelineState,
  shouldDisplayWorkspaceSegmentGeneratedVoiceoverEdited,
  shouldDisplayWorkspaceSegmentSubtitleCellEdited,
  shouldDisplayWorkspaceSegmentVoiceCellEdited,
} from "./workspace-utils";
import { isWorkspaceSegmentEffectiveVoiceEdited } from "./workspace-segment-editor-checklist";

describe("workspace voice timeline edit display", () => {
  it("detects an inherited global voice change against a disabled baseline", () => {
    const segment = { voiceType: null, voice_type: null, voiceoverVoiceType: null } as any;
    const baselineSegment = { voiceType: null, voice_type: null, voiceoverVoiceType: null } as any;

    expect(
      isWorkspaceSegmentEffectiveVoiceEdited(segment, baselineSegment, {
        baselineSession: { voiceType: "none" },
        draftSession: { voiceType: "Misha" },
      }),
    ).toBe(true);
    expect(
      isWorkspaceSegmentEffectiveVoiceEdited({ ...segment, voiceType: "none" }, baselineSegment, {
        baselineSession: { voiceType: "none" },
        draftSession: { voiceType: "Misha" },
      }),
    ).toBe(false);
  });

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

  it("keeps one-step voice undo available when the previous state matches the display baseline", () => {
    expect(
      resolveWorkspaceSegmentVoiceTimelineState({
        canForwardText: false,
        canForwardVoice: false,
        hasVoiceUndoSnapshot: true,
        isGeneratedVoiceoverEdited: false,
        isTextEdited: false,
        isVoiceSettingsEdited: false,
      }),
    ).toMatchObject({
      canBack: true,
      hasHistory: true,
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

  it("shows the voice timeline edited badge when the scene's effective voice changed", () => {
    expect(
      shouldDisplayWorkspaceSegmentVoiceCellEdited({
        isEffectiveVoiceEdited: true,
        isGeneratedVoiceoverEdited: false,
      }),
    ).toBe(true);
  });

  it("hides the edited badge when a scene override restores its effective baseline voice", () => {
    expect(
      shouldDisplayWorkspaceSegmentVoiceCellEdited({
        isEffectiveVoiceEdited: false,
        isGeneratedVoiceoverEdited: false,
      }),
    ).toBe(false);
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
