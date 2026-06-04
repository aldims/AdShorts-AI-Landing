import { describe, expect, it } from "vitest";

import {
  getWorkspaceSegmentTimelineSoundLabel,
  getWorkspaceSegmentTimelineVoiceLabel,
  getWorkspaceSegmentTimelineVoiceOption,
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
});
