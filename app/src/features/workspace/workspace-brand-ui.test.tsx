// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkspaceSegmentEditorBrandOverlay } from "./workspace-brand-ui";

describe("workspace segment editor brand UI", () => {
  it("renders an applied brand as passive preview content", () => {
    render(
      <WorkspaceSegmentEditorBrandOverlay
        brandLogoPreviewUrl={null}
        brandSummary="Текст: Acme"
        brandText="Acme"
        hasBranding
      />,
    );

    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not render the system watermark as brand text", () => {
    render(
      <WorkspaceSegmentEditorBrandOverlay
        brandLogoPreviewUrl={null}
        brandSummary=""
        brandText=""
        hasBranding={false}
      />,
    );

    expect(screen.queryByText("Сделано в adshortsai.com")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
