// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  WorkspaceSegmentTimelineDurationMenu,
  WorkspaceSegmentTimelineSoundMenu,
  WorkspaceSegmentTimelineVoiceMenu,
} from "./workspace-timeline-menus";

const baseProps = {
  effectiveVoiceId: "ru_alexey",
  generateCostLabel: "1 ⚡",
  generateDisabledReason: null,
  generateLabel: "Сгенерировать озвучку",
  isGeneratingVoiceover: false,
  isVoiceDisabled: false,
  language: "ru" as const,
  languageOptions: [{ id: "ru" as const }, { id: "en" as const }],
  locale: "ru" as const,
  menuRef: { current: null },
  onClose: vi.fn(),
  onGenerateVoiceover: vi.fn(),
  onLanguageSelect: vi.fn(),
  onTextChange: vi.fn(),
  onUseGlobalVoice: vi.fn(),
  onVoicePreview: vi.fn(),
  onVoiceSelect: vi.fn(),
  previewingVoiceId: null,
  segment: {
    index: 0,
    text: "Текст сцены",
  } as any,
  segmentArrayIndex: 0,
  style: { left: 0, top: 0 },
  textAreaId: "voice-text",
  visualAudioWarningText: null,
  voiceOptions: [
    {
      description: "Выразительный мужской голос",
      id: "ru_alexey",
      label: "Алексей",
      previewSampleUrl: "/voice.wav",
    },
  ] as any,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WorkspaceSegmentTimelineVoiceMenu", () => {
  it("exposes an explicit save action for scene text edits", () => {
    const onClose = vi.fn();
    render(<WorkspaceSegmentTimelineVoiceMenu {...baseProps} onClose={onClose} />);

    screen.getByRole("button", { name: "Сохранить" }).click();

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not show a credit cost when the scene voiceover is already ready", () => {
    render(
      <WorkspaceSegmentTimelineVoiceMenu
        {...baseProps}
        generateCostLabel={null}
        generateDisabledReason="Актуальная озвучка уже готова."
        generateLabel="Озвучка готова"
      />,
    );

    const button = screen.getByRole("button", {
      name: "Озвучка готова. Актуальная озвучка уже готова.",
    }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(screen.queryByText("1 ⚡")).toBeNull();
  });

  it("exposes busy state while scene voiceover is generating", () => {
    render(
      <WorkspaceSegmentTimelineVoiceMenu
        {...baseProps}
        generateDisabledReason="Озвучка сцены уже создаётся."
        isGeneratingVoiceover
      />,
    );

    const button = screen.getByRole("button", {
      name: "Сгенерировать озвучку. Озвучка сцены уже создаётся.",
    });

    expect(button.getAttribute("aria-busy")).toBe("true");
  });
});

describe("WorkspaceSegmentTimelineDurationMenu", () => {
  const baseDurationProps = {
    aiPrompt: "extend the shot",
    aiPromptRef: { current: null },
    canRequestAiExtension: true,
    canTrimToVoiceover: true,
    durationSwitch: null,
    extensionCreditLabel: "1 ⚡",
    hasExtensionPlan: true,
    inputId: "duration-input",
    inputRef: { current: null },
    inputValue: "5",
    isExtensionDisabled: false,
    isExtensionPending: false,
    isPhoto: false,
    locale: "ru" as const,
    menuRef: { current: null },
    onAiExtensionClick: vi.fn(),
    onAiPromptChange: vi.fn(),
    onApplyDuration: vi.fn(),
    onClose: vi.fn(),
    onInputValueChange: vi.fn(),
    onTrimToVoiceoverToggle: vi.fn(),
    qualitySwitch: null,
    segment: {
      index: 0,
      text: "Текст сцены",
    } as any,
    segmentArrayIndex: 0,
    shouldShowManualDurationInput: false,
    subtitle: "0с -> 5с",
    title: "Продлить видео на 5 секунд",
    trimToVoiceover: true,
    trimToVoiceoverLabels: {
      fullDurationLabel: "5с",
      voiceoverDurationLabel: "3с",
    },
  };

  it("applies the selected full video duration or voiceover trim mode", () => {
    const onTrimToVoiceoverToggle = vi.fn();
    const onApplyDuration = vi.fn(() => ({ duration: 5 }));
    const onClose = vi.fn();

    render(
      <WorkspaceSegmentTimelineDurationMenu
        {...baseDurationProps}
        onApplyDuration={onApplyDuration}
        onClose={onClose}
        onTrimToVoiceoverToggle={onTrimToVoiceoverToggle}
      />,
    );

    expect(screen.getByRole("radio", { name: /Видео 5с/ }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("radio", { name: /Озвучка 3с/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("button", { name: /Сохранить длину/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Продлить/ })).toBeTruthy();

    screen.getByRole("radio", { name: /Видео 5с/ }).click();

    expect(onTrimToVoiceoverToggle).toHaveBeenCalledWith(false);
    expect(onApplyDuration).toHaveBeenCalledWith(0, { trimToVoiceover: false });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not show a save button when trim mode selection applies immediately", () => {
    render(
      <WorkspaceSegmentTimelineDurationMenu
        {...baseDurationProps}
        hasExtensionPlan={false}
      />,
    );

    expect(screen.getByRole("radio", { name: /Видео 5с/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Сохранить/ })).toBeNull();
  });
});

describe("WorkspaceSegmentTimelineSoundMenu", () => {
  const baseSoundProps = {
    canDelete: true,
    creditLabel: "1 ⚡",
    isActionDisabled: false,
    isPending: false,
    isStructureActionBusy: false,
    locale: "ru" as const,
    menuRef: { current: null },
    onClose: vi.fn(),
    onDelete: vi.fn(),
    onGenerate: vi.fn(),
    onPromptChange: vi.fn(),
    placeholder: "Описание звука",
    previewUrl: null,
    prompt: "тихий городской фон",
    segment: { index: 0 } as any,
    segmentArrayIndex: 0,
    span: null,
    spanLabel: "",
    style: { left: 0, top: 0 },
    textareaRef: { current: null },
  };

  it("keeps the generate button readable and busy while scene sound is generating", () => {
    render(
      <WorkspaceSegmentTimelineSoundMenu
        {...baseSoundProps}
        isActionDisabled
        isPending
      />,
    );

    const button = screen.getByRole("button", { name: "Генерируем" });

    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("Генерируем звук сцены");
    expect(screen.queryByText("1 ⚡")).toBeNull();
  });
});
