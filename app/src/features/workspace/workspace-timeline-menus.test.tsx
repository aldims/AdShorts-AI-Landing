// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceSegmentTimelineSoundMenu, WorkspaceSegmentTimelineVoiceMenu } from "./workspace-timeline-menus";

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

    screen.getByRole("button", { name: "Сохранить текст" }).click();

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
