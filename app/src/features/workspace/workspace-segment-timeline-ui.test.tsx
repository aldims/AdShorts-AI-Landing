// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWorkspaceSegmentTimelineHistoryButtons } from "./workspace-segment-timeline-ui";

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
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
