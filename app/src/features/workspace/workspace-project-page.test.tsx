// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

const renderProjectPage = (overrides?: Partial<Parameters<typeof WorkspaceProjectPage>[0]>) => {
  const props: Parameters<typeof WorkspaceProjectPage>[0] = {
    isActionBusy: false,
    isLoading: false,
    onBack: vi.fn(),
    onEdit: vi.fn(),
    onPublish: vi.fn(),
    onRegenerate: vi.fn(),
    onRetryLoad: vi.fn(),
    onVolumeChange: vi.fn(),
    project: readyProject,
    projectsError: null,
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
    expect(screen.getByRole("button", { name: "Сгенерировать заново" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Скачать" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Опубликовать" })).toBeTruthy();
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
