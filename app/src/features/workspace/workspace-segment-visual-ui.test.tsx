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
    const durationSelect = screen.getByRole("combobox", { name: "Длительность видео" });

    expect(screen.queryByRole("radio", { name: /По озвучке/ })).toBeNull();
    expect(screen.getByText("Длительность")).toBeTruthy();
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

  it("only shows the extension duration when voiceover does not exceed the video", () => {
    renderSettings({ voiceoverDurationSeconds: 0, voiceoverMatched: true });

    expect(screen.queryByRole("radio", { name: /По озвучке/ })).toBeNull();
    expect(screen.getByText("Продлить на")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "На сколько продлить видео" })).toBeTruthy();
  });

  it("keeps the sound price immediately after its label", () => {
    renderSettings({ voiceoverDurationSeconds: 7 });

    const soundCopy = screen.getByRole("switch").querySelector(".studio-segment-seedance-settings__audio-copy");
    expect(soundCopy?.textContent).toBe("Звуки+5 ⚡");
  });

});
