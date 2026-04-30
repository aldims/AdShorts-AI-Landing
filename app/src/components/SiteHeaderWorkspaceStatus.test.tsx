// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LocaleProvider, type Locale } from "../lib/i18n";
import { SiteHeaderWorkspaceStatus } from "./SiteHeaderWorkspaceStatus";

const renderWorkspaceStatus = (
  locale: Locale,
  profile: {
    balance: number;
    expiresAt: string | null;
    plan: string;
    startPlanUsed: boolean;
  },
) =>
  render(
    <MemoryRouter>
      <LocaleProvider locale={locale}>
        <SiteHeaderWorkspaceStatus profile={profile} />
      </LocaleProvider>
    </MemoryRouter>,
  );

describe("SiteHeaderWorkspaceStatus", () => {
  it("shows the paid PRO expiry date in the plan tooltip", () => {
    renderWorkspaceStatus("ru", {
      balance: 120,
      expiresAt: "2026-05-02T12:00:00.000Z",
      plan: "PRO",
      startPlanUsed: false,
    });

    expect(screen.getByText("Тариф активен до 02.05.2026.")).toBeTruthy();
  });

  it("keeps the generic active tooltip for START", () => {
    renderWorkspaceStatus("ru", {
      balance: 50,
      expiresAt: null,
      plan: "START",
      startPlanUsed: true,
    });

    expect(screen.getByText("Тариф активен.")).toBeTruthy();
  });
});
