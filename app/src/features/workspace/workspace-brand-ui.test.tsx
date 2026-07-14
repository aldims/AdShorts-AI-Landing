// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  WorkspaceSegmentEditorBrandAddButton,
  WorkspaceSegmentEditorBrandOverlay,
} from "./workspace-brand-ui";

describe("workspace segment editor brand UI", () => {
  it("uses a clear add-brand action on the active carousel card", () => {
    render(<WorkspaceSegmentEditorBrandAddButton locale="ru" onClick={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Добавить бренд" });

    expect(button.textContent).toBe("Бренд");
  });

  it("uses the compact brand edit label on editable overlays", () => {
    render(
      <WorkspaceSegmentEditorBrandOverlay
        brandLogoPreviewUrl={null}
        brandSummary="Текст: Acme"
        brandText="Acme"
        editable
        hasBranding
        locale="ru"
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Бренд ✏️" }).textContent).toContain("Бренд ✏️");
    expect(screen.queryByText("Изменить бренд")).toBeNull();
  });

  it("does not render the system watermark as brand text", () => {
    render(
      <WorkspaceSegmentEditorBrandOverlay
        brandLogoPreviewUrl={null}
        brandSummary=""
        brandText=""
        editable
        hasBranding={false}
        locale="ru"
        onEdit={vi.fn()}
      />,
    );

    expect(screen.queryByText("Сделано в adshortsai.com")).toBeNull();
    expect(screen.queryByRole("button", { name: "Бренд ✏️" })).toBeNull();
  });
});
