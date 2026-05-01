// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "../lib/i18n";
import { PrimarySiteNav } from "./PrimarySiteNav";

const renderPrimarySiteNav = (element: ReactElement) =>
  render(
    <MemoryRouter>
      <LocaleProvider locale="ru">{element}</LocaleProvider>
    </MemoryRouter>,
  );

describe("PrimarySiteNav", () => {
  it("keeps studio sections visible when pricing is opened from studio", () => {
    renderPrimarySiteNav(
      <PrimarySiteNav
        activeItem="pricing"
        onOpenStudio={() => undefined}
        onOpenStudioSection={() => undefined}
        preferStudioSections
      />,
    );

    expect(screen.getByRole("navigation", { name: "Разделы студии" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Создать Shorts" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Проекты" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Медиатека" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Тарифы" }).className).toContain("site-nav__item--active");
    expect(screen.queryByRole("link", { name: "Главная" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Примеры" })).toBeNull();
  });
});
