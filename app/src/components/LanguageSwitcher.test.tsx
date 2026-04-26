// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { LocaleProvider, type Locale } from "../lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

const renderLanguageSwitcher = (locale: Locale, path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LocaleProvider locale={locale}>
        <LanguageSwitcher />
      </LocaleProvider>
    </MemoryRouter>,
  );

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, String(value)),
      },
    });
  });

  it("preserves the current page when switching from Russian to English", () => {
    renderLanguageSwitcher("ru", "/pricing?plan=pro#top");

    fireEvent.click(screen.getByRole("button", { name: "Язык: Русский" }));
    const switcher = screen.getByRole("menu", { name: "Выбор языка" });

    expect(within(switcher).getByRole("menuitem", { name: "RU Русский" }).getAttribute("href")).toBe(
      "/pricing?plan=pro#top",
    );
    const englishLink = within(switcher).getByRole("menuitem", { name: "EN English" });

    expect(englishLink.getAttribute("href")).toBe("/en/pricing?plan=pro#top");

    fireEvent.click(englishLink);
    expect(window.localStorage.getItem("adshorts.locale")).toBe("en");
  });

  it("preserves the current page when switching from English to Russian", () => {
    renderLanguageSwitcher("en", "/en/app/studio?section=media");

    fireEvent.click(screen.getByRole("button", { name: "Language: English" }));
    const switcher = screen.getByRole("menu", { name: "Language selection" });

    const russianLink = within(switcher).getByRole("menuitem", { name: "RU Русский" });

    expect(russianLink.getAttribute("href")).toBe("/app/studio?section=media");
    expect(within(switcher).getByRole("menuitem", { name: "EN English" }).getAttribute("href")).toBe(
      "/en/app/studio?section=media",
    );

    fireEvent.click(russianLink);
    expect(window.localStorage.getItem("adshorts.locale")).toBe("ru");
  });
});
