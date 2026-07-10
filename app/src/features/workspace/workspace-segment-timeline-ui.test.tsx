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
});
