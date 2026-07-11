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
  it("allows saving empty bulk text to clear every scene without a selected voice", () => {
    const onBulkTextSave = vi.fn(() => true);

    render(
      <LocaleProvider locale="ru">
        <StudioVoiceSelectorChip
          bulkTextSegmentCount={5}
          bulkTextValue=""
          isEnabled={false}
          onBulkTextChange={vi.fn()}
          onBulkTextSave={onBulkTextSave}
          onGenerateVoiceover={vi.fn()}
          onSelect={vi.fn()}
          onToggleEnabled={vi.fn()}
          selectedVoiceId="none"
          voiceOptions={[]}
        />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Озвучка\s*Выкл/ }));
    const saveButton = screen.getByRole("button", { name: "Сохранить" }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
    fireEvent.click(saveButton);
    expect(onBulkTextSave).toHaveBeenCalledOnce();
  });

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
    expect(screen.getByText("Стоимость озвучки")).toBeTruthy();
    expect(screen.getAllByText("1 ⚡")).toHaveLength(2);
    expect(screen.queryByText("5 ⚡")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Сгенерировать озвучку" }));

    expect(onGenerateVoiceover).toHaveBeenCalledWith({
      isEnabled: true,
      language: "ru",
      voiceId: "Bys_24000",
    });
  });

  it("shows an unknown cost when bulk text cannot be split into scenes", () => {
    render(
      <LocaleProvider locale="ru">
        <StudioVoiceSelectorChip
          bulkTextError="Не удалось распределить текст по сценам"
          bulkTextValue="Текст для озвучки"
          generateVoiceoverCostLabel="2 ⚡"
          isEnabled
          onBulkTextChange={vi.fn()}
          onGenerateVoiceover={vi.fn()}
          onSelect={vi.fn()}
          onToggleEnabled={vi.fn()}
          selectedVoiceId="Bys_24000"
          voiceOptions={[
            {
              description: "Базовый мужской голос",
              id: "Bys_24000",
              label: "Борис",
            },
          ]}
        />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Озвучка\s*Борис/ }));
    expect(screen.getByText("Стоимость озвучки")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
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
    const aiVideoOption = screen.getByRole("menuitemradio", { name: /AI видео.*80 ⚡.*Скоро.*3–5 минут/ }) as HTMLButtonElement;
    expect(aiVideoOption.disabled).toBe(true);
    expect(screen.getByText("1–2 минуты")).toBeTruthy();
    expect(screen.getByText("3–5 минут")).toBeTruthy();
    const brandHeading = screen.getByText("Текст бренда").parentElement;
    expect(brandHeading?.className).toContain("studio-video-selector__brand-field-heading");
    expect(brandHeading?.querySelector(".studio-video-selector__brand-meta")?.textContent).toContain("0/50");
    expect(screen.queryByText("Premium")).toBeNull();
    expect(screen.queryByText("Загрузить свой визуал")).toBeNull();
    expect(screen.queryByText("Лого: .jpg, .png, .webp, .avif")).toBeNull();
  });

  it("localizes the creation-mode durations in the English UI", () => {
    render(
      <LocaleProvider locale="en">
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

    fireEvent.click(screen.getByRole("button", { name: /Visual\s*AI photos/ }));

    expect(screen.getByText("1–2 minutes")).toBeTruthy();
    expect(screen.getByText("3–5 minutes")).toBeTruthy();
    expect(screen.queryByText("Logo: .jpg, .png, .webp, .avif")).toBeNull();
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
