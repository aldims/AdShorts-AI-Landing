// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../lib/i18n";
import {
  fallbackStudioSubtitleColorOption,
  fallbackStudioSubtitleStyleOption,
} from "./workspace-segment-editor";
import { StudioSubtitleSelectorChip, StudioVideoSelectorChip, StudioVoiceSelectorChip } from "./workspace-selector-chips";

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

  it("shows English voice copy for Russian voice options in the English UI", () => {
    render(
      <LocaleProvider locale="en">
        <StudioVoiceSelectorChip
          isEnabled
          onSelect={vi.fn()}
          onToggleEnabled={vi.fn()}
          selectedVoiceId="Bys_24000"
          voiceOptions={[
            {
              description: "Базовый мужской голос",
              id: "Bys_24000",
              label: "Борис",
              previewSampleUrl: "/voice-previews/boris.wav",
            },
          ]}
        />
      </LocaleProvider>,
    );

    const trigger = screen.getByRole("button", { name: /Voiceover\s*Boris/ });
    expect(trigger).toBeTruthy();
    expect(screen.queryByText("Борис")).toBeNull();

    fireEvent.click(trigger);

    expect(screen.getByText("Basic male voice")).toBeTruthy();
    expect(screen.queryByText("Базовый мужской голос")).toBeNull();
  });
});

describe("StudioVideoSelectorChip", () => {
  it("shows the two AI creation modes without premium or custom visual controls", () => {
    render(
      <LocaleProvider locale="ru">
        <StudioVideoSelectorChip
          brandLogoFile={null}
          brandText=""
          brandUploadError={null}
          customVideoFile={null}
          isPreparingBrandLogo={false}
          onBrandLogoSelect={vi.fn()}
          onBrandTextChange={vi.fn()}
          onClearBrandText={vi.fn()}
          onRemoveBrandLogo={vi.fn()}
          onSelectVideoMode={vi.fn()}
          selectedVideoMode="ai_photo"
        />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Визуал\s*AI фото/ }));

    expect(screen.getByRole("menuitemradio", { name: /AI фото.*10 ⚡/ })).toBeTruthy();
    const aiVideoOption = screen.getByRole("menuitemradio", { name: /AI видео.*Скоро.*80 ⚡/ }) as HTMLButtonElement;
    expect(aiVideoOption.disabled).toBe(true);
    expect(screen.queryByText("Premium")).toBeNull();
    expect(screen.queryByText("Загрузить свой визуал")).toBeNull();
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

  it("shows English subtitle style, color and example copy in the English UI", () => {
    render(
      <LocaleProvider locale="en">
        <StudioSubtitleSelectorChip
          isEnabled
          onSelectColor={vi.fn()}
          onSelectExample={vi.fn()}
          onSelectStyle={vi.fn()}
          onToggleEnabled={vi.fn()}
          selectedColorId="purple"
          selectedExampleId="cta"
          selectedStyleId="modern"
          subtitleColorOptions={[fallbackStudioSubtitleColorOption]}
          subtitleStyleOptions={[fallbackStudioSubtitleStyleOption]}
        />
      </LocaleProvider>,
    );

    const trigger = screen.getByRole("button", { name: /Subtitles\s*Modern/ });
    expect(trigger).toBeTruthy();

    fireEvent.click(trigger);

    expect(screen.getByRole("button", { name: /Modern\s*Current default for Shorts in Manrope\./ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Purple" })).toBeTruthy();
    expect(screen.getByText("Final call to action")).toBeTruthy();
    expect(screen.getByText("Grab")).toBeTruthy();
    expect(screen.queryByText("Фиолетовый")).toBeNull();
    expect(screen.queryByText("Финальный призыв")).toBeNull();
  });
});
