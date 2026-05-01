// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ data: { enabled: false } }),
        ok: true,
      })),
    );
  });

  afterEach(() => {
    window.sessionStorage.clear();
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

  it("stores the example studio settings together with the prompt", async () => {
    render(
      <MemoryRouter initialEntries={["/examples"]}>
        <LocaleProvider locale="ru">
          <ExamplesPage
            session={{ email: "user@example.com", name: "User", plan: "FREE" }}
            onOpenSignup={() => undefined}
            onOpenSignin={() => undefined}
            onLogout={() => undefined}
            onOpenWorkspace={() => undefined}
          />
        </LocaleProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findAllByRole("button", { name: "Использовать" }).then((buttons) => buttons[0]));

    const storedIntent = JSON.parse(window.sessionStorage.getItem("adshorts.example-prefill-intent") ?? "{}");
    expect(storedIntent.prompt).toContain("AI меняет привычный город");
    expect(storedIntent.settings).toMatchObject({
      language: "ru",
      musicType: "inspirational",
      subtitleColorId: "cyan",
      subtitleEnabled: true,
      subtitleStyleId: "story",
      videoMode: "standard",
      voiceEnabled: true,
      voiceId: "Nec_24000",
    });
  });

  it("stores local example settings for the selected video", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          data: {
            canManage: false,
            enabled: true,
            items: [
              {
                goal: "growth",
                id: "local-dragon",
                isLocal: true,
                prefillSettings: {
                  language: "ru",
                  musicType: "dramatic",
                  subtitleColorId: "cyan",
                  subtitleEnabled: true,
                  subtitleStyleId: "karaoke",
                  videoMode: "ai_photo",
                  voiceEnabled: true,
                  voiceId: "Liam",
                },
                promptHint: "Подсказка",
                seedPrompt: "футуристичный белый дракон",
                summary: "Описание",
                tags: ["Локально"],
                title: "Ледяной дракон",
                videoSrc: "/api/examples/local-video/local-dragon",
              },
            ],
          },
        }),
        ok: true,
      })),
    );

    render(
      <MemoryRouter initialEntries={["/examples"]}>
        <LocaleProvider locale="ru">
          <ExamplesPage
            session={{ email: "user@example.com", name: "User", plan: "FREE" }}
            onOpenSignup={() => undefined}
            onOpenSignin={() => undefined}
            onLogout={() => undefined}
            onOpenWorkspace={() => undefined}
          />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ледяной дракон")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Использовать" }));

    const storedIntent = JSON.parse(window.sessionStorage.getItem("adshorts.example-prefill-intent") ?? "{}");
    expect(storedIntent.prompt).toBe("футуристичный белый дракон");
    expect(storedIntent.settings).toMatchObject({
      musicType: "dramatic",
      subtitleColorId: "cyan",
      subtitleStyleId: "karaoke",
      videoMode: "ai_photo",
      voiceId: "Liam",
    });
  });
});
