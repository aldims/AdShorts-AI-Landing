// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider, type Locale } from "../lib/i18n";
import { ExamplesPage } from "./ExamplesPage";

const renderExamplesPage = (locale: Locale = "ru") => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      json: async () => ({ data: { enabled: false } }),
      ok: true,
    })),
  );

  return render(
    <MemoryRouter initialEntries={[locale === "en" ? "/en/examples?filter=expert" : "/examples?filter=expert"]}>
      <LocaleProvider locale={locale}>
        <ExamplesPage
          session={null}
          onOpenSignup={() => undefined}
          onOpenSignin={() => undefined}
          onLogout={() => undefined}
          onOpenWorkspace={() => undefined}
        />
      </LocaleProvider>
    </MemoryRouter>,
  );
};

describe("ExamplesPage copy", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses educational Shorts copy for the former expert category", async () => {
    renderExamplesPage();

    expect(await screen.findByRole("button", { name: "🎓 Обучение" })).toBeTruthy();
    expect(screen.getAllByText("🎓 Обучение").length).toBeGreaterThan(0);
    expect(screen.queryByText("🎓 Экспертиза")).toBeNull();
    expect(screen.queryByText("🎓 Экспертные Shorts")).toBeNull();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/examples/local"));
  });
});
