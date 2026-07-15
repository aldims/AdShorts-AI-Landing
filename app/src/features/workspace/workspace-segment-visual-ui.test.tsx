// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  renderWorkspaceSegmentSeedanceSettings,
  type WorkspaceSegmentSeedanceSettingsOptions,
} from "./workspace-segment-visual-ui";

afterEach(cleanup);

describe("renderWorkspaceSegmentSeedanceSettings", () => {
  const renderSettings = (overrides: Partial<WorkspaceSegmentSeedanceSettingsOptions> = {}) => {
    const onDurationChange = vi.fn();
    const onDurationModeChange = vi.fn();

    render(
      renderWorkspaceSegmentSeedanceSettings("ru", {
        durationMode: "manual",
        generateAudio: false,
        onDurationChange,
        onDurationModeChange,
        onGenerateAudioChange: vi.fn(),
        value: 5,
        voiceoverDurationSeconds: 7,
        ...overrides,
      }),
    );

    return { onDurationChange, onDurationModeChange };
  };

  it("offers every manual duration from 4 to 12 seconds in a dropdown", () => {
    const { onDurationChange, onDurationModeChange } = renderSettings();
    const durationSelect = screen.getByRole("combobox", { name: "Ручная длительность видео" });

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "4 сек",
      "5 сек",
      "6 сек",
      "7 сек",
      "8 сек",
      "9 сек",
      "10 сек",
      "11 сек",
      "12 сек",
    ]);

    fireEvent.change(durationSelect, { target: { value: "12" } });

    expect(onDurationModeChange).toHaveBeenCalledWith("manual");
    expect(onDurationChange).toHaveBeenCalledWith(12);
  });

  it("marks voiceover extension as unnecessary when video and voiceover already match", () => {
    renderSettings({ voiceoverDurationSeconds: 0, voiceoverMatched: true });

    const voiceoverOption = screen.getByRole("radio", { name: /По озвучке/ }) as HTMLButtonElement;
    expect(voiceoverOption.disabled).toBe(true);
    expect(voiceoverOption.textContent).toContain("Совпадает");
  });

  it("keeps the sound price immediately after its label", () => {
    renderSettings({ voiceoverDurationSeconds: 7 });

    const soundCopy = screen.getByRole("switch").querySelector(".studio-segment-seedance-settings__audio-copy");
    expect(soundCopy?.textContent).toBe("Звук+5 ⚡");
  });

  it("explains duration and sound in the extension panel layout", () => {
    renderSettings({ layout: "panel", voiceoverDurationSeconds: 0, voiceoverMatched: true });

    expect(screen.getByText("Длительность фрагмента")).toBeTruthy();
    expect(screen.getByText("4–12 сек или по озвучке")).toBeTruthy();
    expect(screen.getByText("Звук в видео")).toBeTruthy();
    expect(screen.getByText("1 кредит / сек")).toBeTruthy();
    expect(screen.getByRole("switch", { name: /Добавить звук/ })).toBeTruthy();
  });
});
