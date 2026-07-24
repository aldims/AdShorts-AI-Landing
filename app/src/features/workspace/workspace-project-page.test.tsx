// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../lib/i18n";
import { WorkspaceProjectCard } from "./workspace-project-cards";
import type { WorkspaceProject } from "./workspace-types";
import { WorkspaceProjectPage } from "./workspace-project-page";

const readyProject: WorkspaceProject = {
  adId: 42,
  createdAt: "2026-07-20T12:00:00.000Z",
  description: "Короткое описание ролика",
  editedFromProjectAdId: null,
  generatedAt: "2026-07-20T12:05:00.000Z",
  hashtags: ["#shorts", "#ai"],
  id: "project:42",
  instagramPublication: null,
  jobId: "job-42",
  posterUrl: "/poster.jpg",
  prefillSettings: {
    creationMode: "idea",
    language: "ru",
    musicType: "calm",
    subtitleColorId: "white",
    subtitleEnabled: true,
    subtitleStyleId: "classic",
    videoMode: "ai_video",
    voiceEnabled: true,
    voiceId: "Liam_Timing",
  },
  prompt: "Как подготовить сильный хук",
  source: "project",
  status: "ready",
  title: "Сильный хук за 30 секунд",
  updatedAt: "2026-07-20T12:05:00.000Z",
  versionRootProjectAdId: 42,
  videoFallbackUrl: null,
  videoUrl: "/video.mp4",
  youtubePublication: null,
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          segments: [{ index: 0 }, { index: 1 }, { index: 2 }],
        },
      }),
      ok: true,
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderProjectPage = (overrides?: Partial<Parameters<typeof WorkspaceProjectPage>[0]>) => {
  const props: Parameters<typeof WorkspaceProjectPage>[0] = {
    firstVideoOffer: null,
    isActionBusy: false,
    isDeleteBusy: false,
    isLoading: false,
    onBack: vi.fn(),
    onCreateNew: vi.fn(),
    onDelete: vi.fn(),
    onEdit: vi.fn(),
    onPublish: vi.fn(),
    onRegenerate: vi.fn(),
    onRetryLoad: vi.fn(),
    onSelectVersion: vi.fn(),
    onVolumeChange: vi.fn(),
    project: readyProject,
    projectsError: null,
    versions: [readyProject],
    volume: 0.8,
    ...overrides,
  };

  render(
    <LocaleProvider locale="ru">
      <WorkspaceProjectPage {...props} />
    </LocaleProvider>,
  );

  return props;
};

describe("WorkspaceProjectPage", () => {
  it("keeps the project title calm and places all working actions below the video", () => {
    renderProjectPage();

    const heading = screen.getByRole("heading", { name: "Сильный хук за 30 секунд" });
    const actions = screen.getByLabelText("Действия с видео");
    const player = document.querySelector(".studio-project-page__player-shell");

    expect(heading.closest(".studio-project-page__header")).toBeTruthy();
    expect(player).toBeTruthy();
    expect((player as Element).compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Редактировать видео" })).toBeTruthy();
    const publish = screen.getByRole("button", { name: "Опубликовать" });
    const download = screen.getByRole("link", { name: "Скачать" });
    const regenerate = screen.getByRole("button", { name: "Сгенерировать заново" });
    const createNew = screen.getByRole("button", { name: "Создать новое" });
    const mainActionRow = publish.closest(".studio-project-page__action-row--main");
    const secondaryActionRow = regenerate.closest(".studio-project-page__action-row--secondary");
    expect(publish.compareDocumentPosition(download) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mainActionRow?.contains(download)).toBe(true);
    expect(secondaryActionRow?.contains(regenerate)).toBe(true);
    expect(secondaryActionRow?.contains(createNew)).toBe(true);
    expect(regenerate.className).toBe(createNew.className);
    expect(heading.closest(".studio-project-page__header")?.textContent).not.toContain("Обновлено");
    expect(heading.closest(".studio-project-page__header")?.textContent).not.toContain("Опубликовано");
  });

  it("connects the primary and secondary project actions", () => {
    const props = renderProjectPage();

    fireEvent.click(screen.getByRole("button", { name: "Редактировать видео" }));
    fireEvent.click(screen.getByRole("button", { name: "Сгенерировать заново" }));
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));

    expect(props.onEdit).toHaveBeenCalledWith(readyProject);
    expect(props.onRegenerate).toHaveBeenCalledWith(readyProject);
    expect(props.onPublish).toHaveBeenCalledWith(readyProject);
  });

  it.each([
    ["По сценам", { ...readyProject.prefillSettings, creationMode: "scenes" as const }],
    ["без сохранённого происхождения", { ...readyProject.prefillSettings, creationMode: undefined }],
  ])("hides regeneration and centers create new for a project created %s", (_label, prefillSettings) => {
    renderProjectPage({
      project: {
        ...readyProject,
        prefillSettings,
      },
    });

    expect(screen.queryByRole("button", { name: "Сгенерировать заново" })).toBeNull();
    const createNew = screen.getByRole("button", { name: "Создать новое" });
    expect(createNew.closest(".studio-project-page__action-row--secondary")?.className).toContain("is-single");
  });

  it("shows the saved prompt and canonical scene count without editor-level settings", async () => {
    renderProjectPage();

    expect(screen.getByText("Как подготовить сильный хук")).toBeTruthy();
    expect(await screen.findByText("3 сцены")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(
      "/api/workspace/projects/42/segment-editor",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByText("Обновлено")).toBeTruthy();
    expect(screen.getByText("Публикация")).toBeTruthy();
    expect(screen.queryByText("Короткое описание ролика")).toBeNull();
    expect(screen.queryByText("#shorts")).toBeNull();
    expect(screen.queryByText("Длительность")).toBeNull();
    expect(screen.queryByText("Язык")).toBeNull();
    expect(screen.queryByText("Визуал")).toBeNull();
    expect(screen.queryByText("Озвучка")).toBeNull();
    expect(screen.queryByText("Музыка")).toBeNull();
    expect(screen.queryByText("Субтитры")).toBeNull();
  });

  it("renders a non-blocking first-video offer inside project information", () => {
    const onCheckoutStart = vi.fn();
    const onComparePlans = vi.fn();
    const onDismiss = vi.fn();
    renderProjectPage({
      firstVideoOffer: {
        checkoutError: null,
        isCheckoutPending: false,
        onCheckoutStart,
        onComparePlans,
        onDismiss,
      },
    });

    const offer = screen.getByLabelText("Предложение тарифа START");
    expect(screen.getByLabelText("Информация о проекте").contains(offer)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Получить 50 кредитов" }));
    fireEvent.click(screen.getByRole("button", { name: "Сравнить тарифы" }));
    fireEvent.click(screen.getByRole("button", { name: "Скрыть предложение" }));
    expect(onCheckoutStart).toHaveBeenCalledOnce();
    expect(onComparePlans).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "YouTube",
      {
        instagramPublication: null,
        youtubePublication: {
          channelName: "AdShorts",
          channelPk: 7,
          link: "https://www.youtube.com/watch?v=video-42",
          platform: "youtube" as const,
          providerMediaId: "video-42",
          publishedAt: "2026-07-21T12:00:00.000Z",
          scheduledAt: null,
          state: "published",
          youtubeVideoId: "video-42",
        },
      },
      "Открыть на YouTube",
    ],
    [
      "Instagram",
      {
        instagramPublication: {
          channelName: "AdShorts",
          channelPk: 8,
          link: "https://www.instagram.com/reel/reel-42/",
          platform: "instagram" as const,
          providerMediaId: "reel-42",
          publishedAt: "2026-07-21T12:00:00.000Z",
          scheduledAt: null,
          state: "published",
          youtubeVideoId: null,
        },
        youtubePublication: null,
      },
      "Открыть в Instagram",
    ],
  ])("links a published project to its canonical %s URL", (_platform, publications, linkLabel) => {
    renderProjectPage({
      project: {
        ...readyProject,
        ...publications,
      },
    });

    const link = screen.getByRole("link", { name: linkLabel });
    expect(link.getAttribute("href")).toBe(
      publications.instagramPublication?.link ?? publications.youtubePublication?.link,
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it.each([
    ["не опубликован", "scheduled", "https://www.youtube.com/watch?v=video-42"],
    ["не имеет валидной ссылки", "published", "javascript:alert(1)"],
  ])("does not expose an external publication link when the project %s", (_label, state, link) => {
    renderProjectPage({
      project: {
        ...readyProject,
        youtubePublication: {
          channelName: "AdShorts",
          channelPk: 7,
          link,
          platform: "youtube",
          providerMediaId: "video-42",
          publishedAt: state === "published" ? "2026-07-21T12:00:00.000Z" : null,
          scheduledAt: state === "scheduled" ? "2026-07-22T12:00:00.000Z" : null,
          state,
          youtubeVideoId: "video-42",
        },
      },
    });

    expect(screen.queryByRole("link", { name: /Открыть на YouTube/ })).toBeNull();
  });

  it("switches real versions and exposes create and delete workflows", () => {
    const olderVersion: WorkspaceProject = {
      ...readyProject,
      adId: 41,
      createdAt: "2026-07-19T12:00:00.000Z",
      generatedAt: "2026-07-19T12:05:00.000Z",
      id: "project:41",
      jobId: "job-41",
      updatedAt: "2026-07-19T12:05:00.000Z",
    };
    const props = renderProjectPage({ versions: [readyProject, olderVersion] });

    expect(screen.getByText("Версии видео")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Версия 1/ }));
    expect(props.onSelectVersion).toHaveBeenCalledWith(olderVersion);

    fireEvent.click(screen.getByRole("button", { name: "Создать новое" }));
    expect(props.onCreateNew).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Меню проекта" }));
    expect(screen.getByRole("button", { name: "Меню проекта" }).closest("aside")).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Удалить проект" }));
    expect(props.onDelete).toHaveBeenCalledWith(readyProject);
  });

  it("renders a recoverable not-found state for a stale direct link", () => {
    const onBack = vi.fn();
    const onRetryLoad = vi.fn();
    renderProjectPage({
      onBack,
      onRetryLoad,
      project: null,
      projectsError: "Не удалось загрузить список проектов.",
    });

    expect(screen.getByRole("heading", { name: "Проект не найден" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    fireEvent.click(screen.getByRole("button", { name: "К проектам" }));
    expect(onRetryLoad).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe("WorkspaceProjectCard project navigation", () => {
  it("opens the project page even while the video is still processing", () => {
    const onOpenProject = vi.fn();
    const processingProject: WorkspaceProject = {
      ...readyProject,
      status: "processing",
      videoUrl: null,
    };

    render(
      <LocaleProvider locale="ru">
        <WorkspaceProjectCard
          canUseLocalExamples={false}
          isProjectActionBusy={false}
          isPreviewing={false}
          onActivate={() => undefined}
          onAddToExamples={() => undefined}
          onBlur={() => undefined}
          onDeactivate={() => undefined}
          onDelete={() => undefined}
          onEdit={() => undefined}
          onOpenProject={onOpenProject}
          onPublish={() => undefined}
          project={processingProject}
        />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Открыть проект: Сильный хук за 30 секунд" }));
    expect(onOpenProject).toHaveBeenCalledWith(processingProject);
  });

  it("keeps opening a stacked lead project separate from expanding its versions", () => {
    const onOpenProject = vi.fn();
    const onToggleStack = vi.fn();

    render(
      <LocaleProvider locale="ru">
        <WorkspaceProjectCard
          canUseLocalExamples={false}
          isProjectActionBusy={false}
          isPreviewing={false}
          onActivate={() => undefined}
          onAddToExamples={() => undefined}
          onBlur={() => undefined}
          onDeactivate={() => undefined}
          onDelete={() => undefined}
          onEdit={() => undefined}
          onOpenProject={onOpenProject}
          onPublish={() => undefined}
          onToggleStack={onToggleStack}
          project={readyProject}
          stackBadgeLabel="2 версии"
        />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Открыть проект: Сильный хук за 30 секунд" }));
    expect(onOpenProject).toHaveBeenCalledOnce();
    expect(onToggleStack).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Показать версии: Сильный хук за 30 секунд" }));
    expect(onToggleStack).toHaveBeenCalledOnce();
    expect(onOpenProject).toHaveBeenCalledOnce();
  });
});
