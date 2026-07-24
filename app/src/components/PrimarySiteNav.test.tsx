// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

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

    const studioNavigation = screen.getByRole("navigation", { name: "Разделы студии" });

    expect(studioNavigation).toBeTruthy();
    expect(studioNavigation.querySelector(".site-nav__selection")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Создать Shorts" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Проекты" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Медиатека" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Тарифы" }).className).toContain("site-nav__item--active");
    expect(screen.queryByRole("link", { name: "Главная" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Примеры" })).toBeNull();
  });

  it("can hide pricing from the studio tab navigation", () => {
    renderPrimarySiteNav(
      <PrimarySiteNav
        activeItem="studio"
        onOpenStudio={() => undefined}
        onOpenStudioSection={() => undefined}
        showStudioPricingLink={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Создать Shorts" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Проекты" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Медиатека" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Тарифы" })).toBeNull();
  });

  it("shows the selected project name in the editor navigation context", () => {
    renderPrimarySiteNav(
      <PrimarySiteNav
        activeItem="studio"
        activeStudioSection="edit"
        onOpenStudio={() => undefined}
        onOpenStudioSection={() => undefined}
        showStudioPricingLink={false}
        studioSectionLabels={{ create: "Редактор · Сильный хук за 30 секунд" }}
      />,
    );

    expect(screen.getByRole("button", { name: "Редактор · Сильный хук за 30 секунд" })).toBeTruthy();
  });

  it("opens studio directly without expanding the intermediate menu", () => {
    const handleOpenStudioSection = vi.fn();

    renderPrimarySiteNav(
      <PrimarySiteNav
        activeItem="home"
        onOpenStudio={() => undefined}
        onOpenStudioSection={handleOpenStudioSection}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Студия" }));

    expect(handleOpenStudioSection).toHaveBeenCalledWith("create");
    expect(screen.getByRole("button", { name: "Студия" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the compact studio menu after an outside pointer interaction", () => {
    renderPrimarySiteNav(
      <PrimarySiteNav
        activeItem="studio"
        activeStudioSection="create"
        onOpenStudio={() => undefined}
        onOpenStudioSection={() => undefined}
      />,
    );

    const compactToggle = screen.getByRole("button", { name: "Разделы студии: Создать Shorts" });
    fireEvent.click(compactToggle);
    expect(compactToggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.pointerDown(document.body);
    expect(compactToggle.getAttribute("aria-expanded")).toBe("false");
  });
});
