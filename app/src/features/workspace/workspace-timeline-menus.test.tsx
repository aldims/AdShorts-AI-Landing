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
  canRestoreAdaptedText: false,
  isAdaptingText: false,
  isGeneratingVoiceover: false,
  isVoiceDisabled: false,
  language: "ru" as const,
  languageOptions: [{ id: "ru" as const }, { id: "en" as const }],
  locale: "ru" as const,
  menuRef: { current: null },
  onClose: vi.fn(),
  onGenerateVoiceover: vi.fn(),
  onAdaptTextToVisual: vi.fn(),
  onRestoreAdaptedText: vi.fn(),
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
  it("uses dialog and radio semantics for the mixed voiceover form", () => {
    render(<WorkspaceSegmentTimelineVoiceMenu {...baseProps} />);

    expect(screen.getByRole("dialog", { name: "Голос сцены 1" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Язык озвучки" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Русский/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radiogroup", { name: "Голос сцены" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Алексей/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("menu")).toBeNull();
  });

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

  it("limits scene voiceover text to 200 characters", () => {
    render(<WorkspaceSegmentTimelineVoiceMenu {...baseProps} />);

    const textarea = screen.getByRole("textbox", { name: "Текст озвучки" }) as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(200);
    expect(screen.getByText("Сцена 1 · 11/200")).toBeTruthy();
  });

  it("offers AI text adaptation when voiceover is longer than the visual", () => {
    const onAdaptTextToVisual = vi.fn();
    render(
      <WorkspaceSegmentTimelineVoiceMenu
        {...baseProps}
        onAdaptTextToVisual={onAdaptTextToVisual}
        visualAudioWarningText="Видео сцена короче озвучки."
      />,
    );

    screen.getByRole("button", { name: "Подстроить текст под длину визуала" }).click();
    expect(onAdaptTextToVisual).toHaveBeenCalledOnce();
    expect(screen.getByRole("tooltip").textContent).toContain("примерная подстройка");
  });

  it("offers restoring the original text after AI adaptation", () => {
    const onRestoreAdaptedText = vi.fn();
    render(
      <WorkspaceSegmentTimelineVoiceMenu
        {...baseProps}
        canRestoreAdaptedText
        onRestoreAdaptedText={onRestoreAdaptedText}
      />,
    );

    screen.getByRole("button", { name: "Вернуть исходный текст" }).click();
    expect(onRestoreAdaptedText).toHaveBeenCalledOnce();
  });
});

describe("WorkspaceSegmentTimelineDurationMenu", () => {
  const baseDurationProps = {
    aiPrompt: "extend the shot",
    aiPromptRef: { current: null },
    applyDurationLabel: "Применить 5с",
    canRequestAiExtension: true,
    canTrimToVoiceover: true,
    customDurationRangeLabel: "от 3с до 5с",
    durationSwitch: null,
    extensionButtonLabel: "Продлить с ИИ на 5с",
    extensionCreditLabel: "1 ⚡",
    hasExtensionPlan: true,
    inputId: "duration-input",
    inputRef: { current: null },
    inputValue: "5",
    isCustomDurationSelected: false,
    isExtensionDisabled: false,
    isExtensionPending: false,
    isPhoto: false,
    locale: "ru" as const,
    menuRef: { current: null },
    onAiExtensionClick: vi.fn(),
    onAiPromptChange: vi.fn(),
    onApplyDuration: vi.fn(),
    onClose: vi.fn(),
    onCustomDurationSelect: vi.fn(),
    onInputValueChange: vi.fn(),
    onPreviewDurationModeSelect: null,
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
      fullResultDurationLabel: "5с",
      fullResultHoldsToVoiceover: false,
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

    expect(screen.getByRole("radio", { name: /По длине видео/ }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("radio", { name: /По длине озвучки/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("button", { name: /Сохранить длину/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Продлить с ИИ на 5с/ })).toBeTruthy();

    screen.getByRole("radio", { name: /По длине видео/ }).click();

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

    expect(screen.getByRole("radio", { name: /По длине видео/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Сохранить/ })).toBeNull();
  });

  it("does not visually highlight the video-length option", () => {
    render(
      <WorkspaceSegmentTimelineDurationMenu
        {...baseDurationProps}
        hasExtensionPlan={false}
        trimToVoiceover={false}
      />,
    );

    const videoLengthOption = screen.getByRole("radio", { name: /По длине видео/ });
    expect(videoLengthOption.getAttribute("aria-checked")).toBe("true");
    expect(videoLengthOption.classList.contains("is-selected")).toBe(false);
  });

  it("keeps extension settings and the primary action in one concise row", () => {
    render(
      <WorkspaceSegmentTimelineDurationMenu
        {...baseDurationProps}
        durationSwitch={<div>Seedance controls</div>}
      />,
    );

    expect(screen.queryByText("Параметры продления")).toBeNull();
    expect(screen.queryByText("Настройте длительность и звук нового фрагмента")).toBeNull();
    expect(
      document
        .querySelector(".studio-segment-editor__timeline-duration-action-cluster")
        ?.contains(screen.getByText("Seedance controls")),
    ).toBe(true);
    expect(
      document
        .querySelector(".studio-segment-editor__timeline-duration-action-cluster")
        ?.contains(screen.getByRole("button", { name: /Продлить с ИИ на 5с/ })),
    ).toBe(true);
  });

  it("allows custom video trim duration alongside video and voiceover presets", () => {
    const onApplyDuration = vi.fn(() => ({ duration: 7 }));
    const onClose = vi.fn();
    const onPreviewDurationModeSelect = vi.fn();
    const onCustomDurationSelect = vi.fn();

    render(
      <WorkspaceSegmentTimelineDurationMenu
        {...baseDurationProps}
        applyDurationLabel="Применить 7с"
        customDurationRangeLabel="от 5с до 60с"
        hasExtensionPlan={false}
        isCustomDurationSelected={true}
        inputValue="7"
        onApplyDuration={onApplyDuration}
        onClose={onClose}
        onCustomDurationSelect={onCustomDurationSelect}
        onPreviewDurationModeSelect={onPreviewDurationModeSelect}
        shouldShowManualDurationInput={true}
        trimToVoiceover={true}
        trimToVoiceoverLabels={{
          fullDurationLabel: "60с",
          fullResultDurationLabel: "60с",
          fullResultHoldsToVoiceover: false,
          voiceoverDurationLabel: "5с",
        }}
      />,
    );

    expect(screen.getByRole("radio", { name: /По длине видео/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /По длине озвучки/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Задать длину/ }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getByRole("textbox", { name: "Задать длину сцены" }) as HTMLInputElement).value).toBe("7");

    screen.getByRole("radio", { name: /Задать длину/ }).click();

    expect(onCustomDurationSelect).toHaveBeenCalledOnce();
    expect(onPreviewDurationModeSelect).not.toHaveBeenCalled();
    expect(onApplyDuration).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    screen.getByRole("button", { name: "Применить 7с" }).click();

    expect(onApplyDuration).toHaveBeenCalledWith(0);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps AI extension available while offering the video-to-voiceover duration range", () => {
    render(
      <WorkspaceSegmentTimelineDurationMenu
        {...baseDurationProps}
        hasExtensionPlan={true}
        shouldShowManualDurationInput={true}
        trimToVoiceoverLabels={{
          fullDurationLabel: "5.5с",
          fullResultDurationLabel: "5.5с",
          fullResultHoldsToVoiceover: false,
          voiceoverDurationLabel: "≈1.8с",
        }}
      />,
    );

    expect(screen.getByRole("radio", { name: /По длине видео/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /По длине озвучки/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Задать длину/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Продлить с ИИ на 5с/ })).toBeTruthy();
  });

  it("applies a video-length preset immediately when custom trim is available", () => {
    const onApplyDuration = vi.fn(() => ({ duration: 60 }));
    const onClose = vi.fn();
    const onPreviewDurationModeSelect = vi.fn();

    render(
      <WorkspaceSegmentTimelineDurationMenu
        {...baseDurationProps}
        hasExtensionPlan={false}
        onApplyDuration={onApplyDuration}
        onClose={onClose}
        onPreviewDurationModeSelect={onPreviewDurationModeSelect}
        shouldShowManualDurationInput={true}
        trimToVoiceover={true}
        trimToVoiceoverLabels={{
          fullDurationLabel: "60с",
          fullResultDurationLabel: "60с",
          fullResultHoldsToVoiceover: false,
          voiceoverDurationLabel: "5с",
        }}
      />,
    );

    screen.getByRole("radio", { name: /По длине видео/ }).click();

    expect(onPreviewDurationModeSelect).not.toHaveBeenCalled();
    expect(onApplyDuration).toHaveBeenCalledWith(0, { trimToVoiceover: false });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the held-frame result as a summary when voiceover is longer than video", () => {
    render(
      <WorkspaceSegmentTimelineDurationMenu
        {...baseDurationProps}
        trimToVoiceover={false}
        trimToVoiceoverLabels={{
          fullDurationLabel: "5с",
          fullResultDurationLabel: "5.9с",
          fullResultHoldsToVoiceover: true,
          voiceoverDurationLabel: "5.9с",
        }}
      />,
    );

    expect(screen.queryByRole("radio", { name: /Видео 5с/ })).toBeNull();
    expect(screen.queryByRole("radio", { name: /Озвучка 5.9с/ })).toBeNull();
    expect(screen.getByText("Текущее видео")).toBeTruthy();
    expect(screen.getByText("5с")).toBeTruthy();
    expect(screen.getByText("Текущая озвучка")).toBeTruthy();
    expect(screen.getByText("5.9с")).toBeTruthy();
    expect(
      screen.getByText(
        "Без ИИ-продления последний кадр будет удерживаться до конца озвучки. Чтобы сохранить движение, продлите видео с ИИ.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Оставить с удержанием кадра" })).toBeTruthy();
  });

  it("describes the same held final frame for every short video", () => {
    render(
      <WorkspaceSegmentTimelineDurationMenu
        {...baseDurationProps}
        trimToVoiceover={false}
        trimToVoiceoverLabels={{
          fullDurationLabel: "4с",
          fullResultDurationLabel: "5с",
          fullResultHoldsToVoiceover: true,
          voiceoverDurationLabel: "5с",
        }}
      />,
    );

    expect(
      screen.getByText(
        "Без ИИ-продления последний кадр будет удерживаться до конца озвучки. Чтобы сохранить движение, продлите видео с ИИ.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Оставить с удержанием кадра" })).toBeTruthy();
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

  it("does not show delete sound for an empty scene sound slot", () => {
    render(
      <WorkspaceSegmentTimelineSoundMenu
        {...baseSoundProps}
        canDelete={false}
        prompt=""
      />,
    );

    expect(screen.queryByRole("button", { name: "Удалить звук" })).toBeNull();
    expect(screen.getByRole("button", { name: /Добавить звук/ })).toBeTruthy();
    expect(screen.getByText("Описание звука (необязательно)")).toBeTruthy();
  });
});
