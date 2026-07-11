import { describe, expect, it } from "vitest";

import { WORKSPACE_SEGMENT_SCENE_SOUND_DEFAULT_PROMPT } from "./workspace-segment-editor";
import {
  getWorkspaceSegmentTimelineSoundLabel,
  getWorkspaceSegmentTimelineVoiceLabel,
  getWorkspaceSegmentTimelineVoiceOption,
  getWorkspaceSegmentTimelineVoiceDisplayLabel,
} from "./workspace-segment-timeline-labels";

describe("getWorkspaceSegmentTimelineSoundLabel", () => {
  const segment = {
    sceneSoundGeneratedFromPrompt: null,
    sceneSoundPrompt: "",
  } as any;

  it("shows a clear progress label while scene sound is generating", () => {
    expect(getWorkspaceSegmentTimelineSoundLabel("ru", segment, { isPending: true })).toBe("Создаём звук");
    expect(getWorkspaceSegmentTimelineSoundLabel("en", segment, { isPending: true })).toBe("Creating sound");
  });

  it("shows Auto for the default scene sound prompt", () => {
    const autoSegment = {
      ...segment,
      sceneSoundGeneratedFromPrompt: WORKSPACE_SEGMENT_SCENE_SOUND_DEFAULT_PROMPT,
    };

    expect(getWorkspaceSegmentTimelineSoundLabel("ru", autoSegment)).toBe("Авто");
    expect(getWorkspaceSegmentTimelineSoundLabel("en", autoSegment)).toBe("Auto");
  });

  it("keeps a custom scene sound description visible", () => {
    const customSegment = {
      ...segment,
      sceneSoundPrompt: "Шаги по мокрому асфальту",
    };

    expect(getWorkspaceSegmentTimelineSoundLabel("ru", customSegment)).toBe("Шаги по мокрому асфальту");
  });
});

describe("getWorkspaceSegmentTimelineVoiceLabel", () => {
  const voices = [
    { description: "", id: "Bys_24000", label: "Борис" },
    { description: "", id: "Russian_BrightHeroine", label: "Тим" },
  ];
  const settings = {
    getVoiceOptionById: (voiceId: string | null | undefined) =>
      voices.find((voice) => voice.id === voiceId) ?? null,
    selectedVoiceOptions: voices,
    studioSidebarVoiceEnabled: true,
    studioSidebarVoiceId: "Bys_24000",
  };

  it("shows the generated segment voice instead of the sidebar voice", () => {
    const segment = {
      voiceType: null,
      voiceoverVoiceType: "Russian_BrightHeroine",
    } as any;

    expect(getWorkspaceSegmentTimelineVoiceLabel("ru", segment, settings)).toBe("Тим");
    expect(getWorkspaceSegmentTimelineVoiceOption(segment, settings)?.id).toBe("Russian_BrightHeroine");
  });

  it("falls back to global voice lookup for a sidebar voice not in selected options", () => {
    const segment = {
      voiceType: null,
      voiceoverVoiceType: null,
    } as any;
    const fallbackSettings = {
      ...settings,
      selectedVoiceOptions: [{ description: "", id: "Russian_BrightHeroine", label: "Тим" }],
    };

    expect(getWorkspaceSegmentTimelineVoiceLabel("ru", segment, fallbackSettings)).toBe("Борис");
    expect(getWorkspaceSegmentTimelineVoiceOption(segment, fallbackSettings)?.id).toBe("Bys_24000");
  });

  it("does not show a fallback voice when voiceover is disabled", () => {
    const segment = {
      voiceType: null,
      voiceoverVoiceType: null,
    } as any;
    const disabledSettings = {
      ...settings,
      studioSidebarVoiceEnabled: false,
    };

    expect(getWorkspaceSegmentTimelineVoiceLabel("ru", segment, disabledSettings)).toBe("Добавить озвучку");
    expect(getWorkspaceSegmentTimelineVoiceOption(segment, disabledSettings)).toBeNull();
  });

  it("shows 'Добавить озвучку' in the full timeline label when text is empty", () => {
    const segment = {
      text: "   ",
      voiceType: null,
      voiceoverVoiceType: null,
    } as any;

    expect(getWorkspaceSegmentTimelineVoiceDisplayLabel("ru", segment, settings)).toBe("Добавить озвучку");
    expect(getWorkspaceSegmentTimelineVoiceDisplayLabel("en", segment, settings)).toBe("Add voiceover");
  });
});
