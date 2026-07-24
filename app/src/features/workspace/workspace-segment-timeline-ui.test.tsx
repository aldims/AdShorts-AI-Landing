// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  WorkspaceSegmentTimelineTrackLabel,
  renderWorkspaceSegmentTimelineHistoryButtons,
} from "./workspace-segment-timeline-ui";

describe("workspace segment timeline track label", () => {
  it("keeps a track without global settings fully non-interactive", () => {
    render(
      <WorkspaceSegmentTimelineTrackLabel
        icon={<span>visual icon</span>}
        label="Визуал"
      />,
    );

    expect(screen.getByText("Визуал")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("uses the sliders control as the only settings click target", () => {
    const onClick = vi.fn();
    const onPointerDown = vi.fn();
    const settingsLabel = "Настроить озвучку всего видео";

    render(
      <WorkspaceSegmentTimelineTrackLabel
        icon={<span>voice icon</span>}
        label="Озвучка"
        settings={{
          ariaExpanded: false,
          label: settingsLabel,
          onClick,
          onPointerDown,
        }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Озвучка" })).toBeNull();
    const settingsButton = screen.getByRole("button", { name: settingsLabel });
    expect(settingsButton.getAttribute("title")).toBe(settingsLabel);
    expect(settingsButton.getAttribute("aria-expanded")).toBe("false");

    fireEvent.pointerDown(settingsButton);
    fireEvent.click(settingsButton);

    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("exposes whole-video sound generation progress on its settings control", () => {
    render(
      <WorkspaceSegmentTimelineTrackLabel
        icon={<span>sound icon</span>}
        label="Звуки"
        settings={{
          ariaBusy: true,
          ariaControls: "workspace-bulk-scene-sound-title",
          ariaExpanded: true,
          isBusy: true,
          label: "Создать звуки для всех сцен · 5 ⚡",
          onClick: vi.fn(),
        }}
      />,
    );

    const settingsButton = screen.getByRole("button", { name: "Создать звуки для всех сцен · 5 ⚡" });
    expect(settingsButton.getAttribute("aria-busy")).toBe("true");
    expect(settingsButton.getAttribute("aria-controls")).toBe("workspace-bulk-scene-sound-title");
    expect(settingsButton.getAttribute("aria-expanded")).toBe("true");
    expect(settingsButton.querySelector(".studio-segment-editor__timeline-label-settings-busy")).toBeTruthy();
  });
});

describe("workspace segment timeline history buttons", () => {
  it("runs one undo action for a pointer click", () => {
    const onBack = vi.fn();

    render(
      renderWorkspaceSegmentTimelineHistoryButtons(
        "ru",
        false,
        {
          canBack: true,
          canForward: false,
          kind: "voice",
          label: "Озвучка сцены 1",
          segmentIndex: 0,
        },
        { onBack, onForward: vi.fn() },
      ),
    );

    const button = screen.getByRole("button", { name: "Откатить: Озвучка сцены 1" });
    fireEvent.pointerDown(button);
    fireEvent.click(button);

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledWith("voice", 0);
  });

  it("shows a history cleanup emoji at the beginning of the undo chain", () => {
    const onClear = vi.fn();

    render(
      renderWorkspaceSegmentTimelineHistoryButtons(
        "ru",
        false,
        {
          canBack: false,
          canClear: true,
          canForward: true,
          kind: "voice",
          label: "Озвучка сцены 1",
          onClear,
          segmentIndex: 0,
        },
        { onBack: vi.fn(), onForward: vi.fn() },
      ),
    );

    expect(screen.queryByRole("button", { name: "Откатить: Озвучка сцены 1" })).toBeNull();
    const clearButton = screen.getByRole("button", { name: "Очистить историю: Озвучка сцены 1" });
    expect(clearButton.textContent).toBe("🧹");
    fireEvent.click(clearButton);
    expect(onClear).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Нажмите ещё раз, чтобы очистить историю: Озвучка сцены 1" }),
    ).toBe(clearButton);
    fireEvent.click(clearButton);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("supports the cleanup action for non-voice timeline tracks", () => {
    const onClear = vi.fn();

    render(
      renderWorkspaceSegmentTimelineHistoryButtons(
        "ru",
        false,
        {
          canBack: false,
          canClear: true,
          canForward: true,
          kind: "visual",
          label: "Визуал сцены 1",
          onClear,
          segmentIndex: 0,
        },
        { onBack: vi.fn(), onForward: vi.fn() },
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Очистить историю: Визуал сцены 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Нажмите ещё раз, чтобы очистить историю: Визуал сцены 1" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
