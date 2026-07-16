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

  it("orders example filters as growth, ads, education", async () => {
    renderExamplesPage();

    const growthFilter = await screen.findByRole("button", { name: "📈 Рост канала" });
    const adsFilter = screen.getByRole("button", { name: "📣 Реклама" });
    const educationFilter = screen.getByRole("button", { name: "🎓 Обучение" });

    expect(growthFilter.compareDocumentPosition(adsFilter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(adsFilter.compareDocumentPosition(educationFilter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("honors curated catalog positions before inferred video priorities", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          data: {
            canManage: false,
            enabled: true,
            items: [
              {
                goal: "ads",
                id: "local-ad",
                isLocal: true,
                promptHint: "Рекламный ролик",
                seedPrompt: "рекламный Shorts про сервис",
                summary: "Реклама сервиса",
                tags: ["Реклама"],
                title: "Про рекламу",
                videoSrc: "/api/examples/local-video/local-ad",
              },
              {
                catalogOrder: 2,
                goal: "growth",
                id: "local-dino",
                isLocal: true,
                promptHint: "Динозавр",
                seedPrompt: "маленький динозавр-пират",
                summary: "История про динозавра",
                tags: ["Динозавр"],
                title: "Про динозавра",
                videoSrc: "/api/examples/local-video/local-dino",
              },
              {
                goal: "expert",
                id: "local-lava",
                isLocal: true,
                promptHint: "Лава",
                seedPrompt: "футуристическая лава и вулканические взрывы",
                summary: "Объяснение про лаву",
                tags: ["Лава"],
                title: "Про лаву",
                videoSrc: "/api/examples/local-video/local-lava",
              },
              {
                catalogOrder: 1,
                goal: "growth",
                id: "local-dragon",
                isLocal: true,
                promptHint: "Дракон",
                seedPrompt: "футуристичный белый дракон в заснеженных горах",
                summary: "История про дракона",
                tags: ["Дракон"],
                title: "Про дракона",
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
            session={null}
            onOpenSignup={() => undefined}
            onOpenSignin={() => undefined}
            onLogout={() => undefined}
            onOpenWorkspace={() => undefined}
          />
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Про дракона" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Про дракона",
      "Про динозавра",
      "Про лаву",
      "Про рекламу",
    ]);
  });

  it("shows local examples only for their saved language", async () => {
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
                id: "local-ru",
                isLocal: true,
                prefillSettings: { language: "ru" },
                promptHint: "Русский пример",
                seedPrompt: "русский пример",
                summary: "Русский пример",
                tags: ["RU"],
                title: "Русский пример",
                videoSrc: "/api/examples/local-video/local-ru",
              },
              {
                goal: "growth",
                id: "local-en",
                isLocal: true,
                prefillSettings: { language: "en" },
                promptHint: "English example",
                seedPrompt: "English example",
                summary: "English example",
                tags: ["EN"],
                title: "English example",
                videoSrc: "/api/examples/local-video/local-en",
              },
            ],
          },
        }),
        ok: true,
      })),
    );

    render(
      <MemoryRouter initialEntries={["/en/examples"]}>
        <LocaleProvider locale="en">
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

    expect(await screen.findByRole("heading", { name: "English example" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Русский пример" })).toBeNull();
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

  it("renders disabled local example actions with a custom label", async () => {
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
                id: "scene-built-jeep",
                isLocal: true,
                promptHint: "Готовые сцены",
                seedPrompt: "джип едет в горах",
                summary: "Видео создано из сцен",
                tags: ["Локально"],
                title: "Джип едет в горах",
                useDisabled: true,
                useLabel: "Создано из сцен",
                videoSrc: "/api/examples/local-video/scene-built-jeep",
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

    const useButton = await screen.findByRole("button", { name: "Создано из сцен" });
    expect((useButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(useButton);
    expect(window.sessionStorage.getItem("adshorts.example-prefill-intent")).toBeNull();
  });
});
