// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../lib/i18n";
import {
  fallbackStudioSubtitleColorOption,
  fallbackStudioSubtitleStyleOption,
} from "./workspace-segment-editor";
import { StudioSubtitleSelectorChip, StudioVoiceSelectorChip } from "./workspace-selector-chips";

describe("StudioVoiceSelectorChip", () => {
  it("passes the selected visible voice to whole-video generation", async () => {
    const onGenerateVoiceover = vi.fn();

    render(
      <LocaleProvider locale="ru">
        <StudioVoiceSelectorChip
          bulkTextSegmentCount={6}
          bulkTextValue="Текст для озвучки"
          generateVoiceoverCostLabel="1 ⚡"
          isEnabled
          onBulkTextChange={vi.fn()}
          onGenerateVoiceover={onGenerateVoiceover}
          onSelect={vi.fn()}
          onSelectLanguage={vi.fn()}
          onToggleEnabled={vi.fn()}
          selectedLanguage="ru"
          selectedVoiceId="Bys_24000"
          voiceOptions={[
            {
              description: "Базовый мужской голос",
              id: "Bys_24000",
              label: "Борис",
              previewSampleUrl: "/voice-previews/boris.wav",
            },
            {
              badgeLabel: "Premium",
              creditCost: 5,
              description: "Глубокий premium-голос",
              id: "English_ManWithDeepVoice",
              label: "Глеб",
              previewSampleUrl: "/voice-previews/gleb-premium.wav",
            },
          ]}
        />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Озвучка\s*Борис/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Сгенерировать озвучку" }));

    expect(onGenerateVoiceover).toHaveBeenCalledWith({
      isEnabled: true,
      language: "ru",
      voiceId: "Bys_24000",
    });
  });
});

describe("StudioSubtitleSelectorChip", () => {
  it("shows a Russian label for the default subtitle style", () => {
    render(
      <LocaleProvider locale="ru">
        <StudioSubtitleSelectorChip
          isEnabled
          onSelectColor={vi.fn()}
          onSelectExample={vi.fn()}
          onSelectStyle={vi.fn()}
          onToggleEnabled={vi.fn()}
          selectedColorId="purple"
          selectedExampleId="hook"
          selectedStyleId="modern"
          subtitleColorOptions={[fallbackStudioSubtitleColorOption]}
          subtitleStyleOptions={[fallbackStudioSubtitleStyleOption]}
        />
      </LocaleProvider>,
    );

    const trigger = screen.getByRole("button", { name: /Субтитры\s*Современный/ });
    expect(trigger).toBeTruthy();
    expect(screen.queryByText("Modern")).toBeNull();

    fireEvent.click(trigger);

    expect(screen.getByRole("button", { name: /Современный\s*Универсальный стиль для Shorts\./ })).toBeTruthy();
  });
});
