import { type FocusEvent as ReactFocusEvent, useEffect, useRef, useState } from "react";
import { useLocale, type Locale } from "../../lib/i18n";
import { getWorkspaceProjectDisplayTitle, getWorkspaceVideoDownloadName } from "../../lib/workspaceMediaLibrary";
import { ensureVideoElementLoading } from "./workspace-media-probe-helpers";
import { appendUrlToken } from "./workspace-media-library-helpers";
import { formatProjectDate } from "./workspace-publish-helpers";
import type { WorkspaceProject } from "./workspace-types";

const workspaceText = (locale: Locale, ru: string, en: string) => (locale === "en" ? en : ru);
const getVideoDownloadName = getWorkspaceVideoDownloadName;

export type WorkspaceProjectStudioGeneration = {
  adId: number | null;
  aspectRatio: string;
  description: string;
  durationLabel: string;
  generatedAt: string;
  hashtags: string[];
  id: string;
  modelLabel: string;
  prefillSettings: WorkspaceProject["prefillSettings"] | null;
  prompt: string;
  title: string;
  videoFallbackUrl: string | null;
  videoUrl: string;
};

export const buildStudioGenerationFromProject = (project: WorkspaceProject): WorkspaceProjectStudioGeneration | null => {
  if (!project.videoUrl) return null;

  return {
    adId: project.adId,
    aspectRatio: "9:16",
    description: project.description,
    durationLabel: "Ready",
    generatedAt: project.generatedAt ?? project.updatedAt ?? project.createdAt,
    hashtags: project.hashtags,
    id: project.jobId ?? project.id,
    modelLabel: "AdsFlow pipeline",
    prefillSettings: project.prefillSettings ?? null,
    prompt: project.prompt,
    title: project.title,
    videoFallbackUrl: project.videoFallbackUrl,
    videoUrl: project.videoUrl,
  };
};

export const getStudioStatusLabel = (value: string, locale: Locale = "ru") => {
  switch (value) {
    case "queued":
      return workspaceText(locale, "В очереди", "Task queued");
    case "processing":
      return workspaceText(locale, "Генерация видео...", "Generating video...");
    case "preparing_preview":
      return workspaceText(locale, "Подготавливаем видео...", "Preparing video...");
    case "retrying":
      return workspaceText(locale, "Повторяем генерацию...", "Retrying generation...");
    case "done":
      return "";
    case "failed":
      return workspaceText(locale, "Генерация не удалась", "Generation failed");
    default:
      return workspaceText(locale, "Генерация видео...", "Generating video...");
  }
};

export const getProjectStatusLabel = (value: string, locale: Locale = "ru") => {
  switch (value) {
    case "ready":
      return workspaceText(locale, "Готов", "Ready");
    case "queued":
      return workspaceText(locale, "В очереди", "Queued");
    case "processing":
      return workspaceText(locale, "Генерация", "Generating");
    case "failed":
      return workspaceText(locale, "Ошибка", "Failed");
    case "draft":
      return workspaceText(locale, "Черновик", "Draft");
    default:
      return workspaceText(locale, "Проект", "Project");
  }
};

export const getProjectStatusClassName = (value: string) => {
  switch (value) {
    case "ready":
      return "account-status--ready";
    case "queued":
    case "processing":
      return "account-status--processing";
    case "failed":
      return "account-status--failed";
    default:
      return "account-status--draft";
  }
};

export const shouldShowProjectStatusBadge = (value: string) => value !== "ready";

export const getProjectPreviewNote = (project: WorkspaceProject, locale: Locale = "ru") => {
  if (project.videoUrl) {
    return "";
  }

  switch (project.status) {
    case "queued":
      return workspaceText(locale, "В очереди на генерацию", "Queued for generation");
    case "processing":
      return workspaceText(locale, "Собираем превью", "Preparing preview");
    case "failed":
      return workspaceText(locale, "Видео не готово", "Video is not ready");
    default:
      return workspaceText(locale, "Превью появится после рендера", "Preview appears after rendering");
  }
};

type WorkspaceProjectCardProps = {
  canUseLocalExamples: boolean;
  isChild?: boolean;
  isProjectActionBusy: boolean;
  isPreviewing: boolean;
  showStackCollapseHandle?: boolean;
  isStackExpanded?: boolean;
  isStackLead?: boolean;
  onAddToExamples: (project: WorkspaceProject) => void;
  onActivate: (projectId: string, hasVideo: boolean) => void;
  onBlur: (event: ReactFocusEvent<HTMLElement>) => void;
  onDeactivate: (projectId: string) => void;
  onDelete: (project: WorkspaceProject) => void;
  onEdit: (project: WorkspaceProject) => void;
  onOpenPreview: (project: WorkspaceProject) => void;
  onPublish: (project: WorkspaceProject) => void;
  onToggleStack?: () => void;
  project: WorkspaceProject;
  stackBadgeLabel?: string | null;
};

export function WorkspaceProjectCard({
  canUseLocalExamples,
  isChild = false,
  isProjectActionBusy,
  isPreviewing,
  showStackCollapseHandle = false,
  isStackExpanded = false,
  isStackLead = false,
  onAddToExamples,
  onActivate,
  onBlur,
  onDeactivate,
  onDelete,
  onEdit,
  onOpenPreview,
  onPublish,
  onToggleStack,
  project,
  stackBadgeLabel = null,
}: WorkspaceProjectCardProps) {
  const { locale } = useLocale();
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const projectPreviewNote = getProjectPreviewNote(project, locale);
  const projectTitle = getWorkspaceProjectDisplayTitle(project);
  const projectDownloadUrl = appendUrlToken(project.videoUrl, "download", project.updatedAt || project.generatedAt || project.id);
  const projectDownloadName = getVideoDownloadName(projectTitle);
  const canUseReadyProjectActions = project.status === "ready" && Boolean(project.videoUrl);
  const canDownloadProject = Boolean(projectDownloadUrl);
  const canAddProjectToExamples = canUseLocalExamples && Boolean(project.videoUrl);
  const canPublishProject = Boolean(project.adId) && canUseReadyProjectActions;
  const projectSoonTooltip = workspaceText(locale, "Скоро", "Soon");
  const [shouldLoadPreview, setShouldLoadPreview] = useState(false);
  const [hasPreviewFrame, setHasPreviewFrame] = useState(false);
  const [isPreviewVideoReady, setIsPreviewVideoReady] = useState(false);
  const [isPosterLoadFailed, setIsPosterLoadFailed] = useState(false);
  const posterUrl = isPosterLoadFailed ? null : project.posterUrl;
  const handleToggleStack = typeof onToggleStack === "function" ? onToggleStack : null;
  const hasStackBadge = Boolean(stackBadgeLabel);
  const hasCollapseHandle = Boolean(handleToggleStack && showStackCollapseHandle);
  const shouldToggleStackFromCard = Boolean(handleToggleStack && hasStackBadge);
  const shouldShowStatusBadge = shouldShowProjectStatusBadge(project.status);

  useEffect(() => {
    if (!project.videoUrl) {
      setShouldLoadPreview(false);
      setHasPreviewFrame(false);
      setIsPreviewVideoReady(false);
      setIsPosterLoadFailed(false);
      return;
    }

    setHasPreviewFrame(false);
    setIsPreviewVideoReady(false);
    setIsPosterLoadFailed(false);
  }, [project.posterUrl, project.videoUrl]);

  useEffect(() => {
    if (!project.videoUrl || !shouldLoadPreview || !isPreviewing) return;

    const videoElement = previewVideoRef.current;
    if (!videoElement) return;

    if (
      videoElement.networkState === HTMLMediaElement.NETWORK_EMPTY ||
      videoElement.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
    ) {
      ensureVideoElementLoading(videoElement, HTMLMediaElement.HAVE_FUTURE_DATA);
    }
  }, [isPreviewing, project.videoUrl, shouldLoadPreview]);

  useEffect(() => {
    const videoElement = previewVideoRef.current;
    if (!videoElement || !project.videoUrl || !shouldLoadPreview) return;

    if (!isPreviewing) {
      videoElement.pause();
      try {
        videoElement.currentTime = 0;
      } catch {
        // Ignore reset errors until metadata is available.
      }
      return;
    }

    void videoElement.play().catch(() => {
      // Ignore autoplay rejection for hover preview.
    });
  }, [isPreviewing, project.videoUrl, shouldLoadPreview]);

  return (
    <article
      className={[
        "studio-project-card",
        hasPreviewFrame ? "has-preview-frame" : "",
        hasStackBadge ? "has-stack-badge" : "",
        hasCollapseHandle ? "has-stack-collapse-handle" : "",
        isChild ? "is-stack-child" : "",
        isPreviewing ? "is-previewing" : "",
        isPreviewing && isPreviewVideoReady ? "is-preview-ready" : "",
        isStackLead ? "is-stack-lead" : "",
      ].filter(Boolean).join(" ")}
      onMouseEnter={() => {
        if (project.videoUrl) {
          setShouldLoadPreview(true);
        }
        onActivate(project.id, Boolean(project.videoUrl));
      }}
      onMouseLeave={() => onDeactivate(project.id)}
      onFocusCapture={() => {
        if (project.videoUrl) {
          setShouldLoadPreview(true);
        }
        onActivate(project.id, Boolean(project.videoUrl));
      }}
      onBlurCapture={onBlur}
    >
      <div className="studio-project-card__thumb">
        {project.videoUrl && shouldLoadPreview ? (
          <div className="studio-project-card__thumb-media">
            <video
              ref={previewVideoRef}
              src={project.videoUrl}
              muted
              playsInline
              loop
              poster={posterUrl ?? undefined}
              preload={isPreviewing ? "auto" : "none"}
              onLoadedData={() => {
                setHasPreviewFrame(true);
                setIsPreviewVideoReady(true);
              }}
              onCanPlay={() => {
                setIsPreviewVideoReady(true);
              }}
              onError={() => {
                setHasPreviewFrame(false);
                setIsPreviewVideoReady(false);
              }}
            />
          </div>
        ) : null}
        <div className="studio-project-card__thumb-poster" aria-hidden={isPreviewing && isPreviewVideoReady}>
          {posterUrl ? (
            <img
              className="studio-project-card__thumb-image"
              src={posterUrl}
              alt=""
              decoding="async"
              onError={() => setIsPosterLoadFailed(true)}
            />
          ) : null}
          <div className={`studio-project-card__thumb-placeholder${posterUrl || hasPreviewFrame ? " has-image" : ""}`}>
            {!posterUrl && !hasPreviewFrame ? (
              <div className="studio-project-card__thumb-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
                </svg>
              </div>
            ) : null}
            <div className="studio-project-card__thumb-copy">
              {projectPreviewNote ? <span className="studio-project-card__thumb-note">{projectPreviewNote}</span> : null}
              <strong>{project.title || workspaceText(locale, "Без названия", "Untitled")}</strong>
            </div>
          </div>
        </div>
        {project.videoUrl ? (
          <button
            className="studio-project-card__thumb-trigger"
            type="button"
            aria-label={
              shouldToggleStackFromCard
                ? isStackExpanded
                  ? workspaceText(locale, `Свернуть версии: ${projectTitle}`, `Collapse versions: ${projectTitle}`)
                  : workspaceText(locale, `Показать версии: ${projectTitle}`, `Show versions: ${projectTitle}`)
                : workspaceText(locale, `Открыть превью: ${projectTitle}`, `Open preview: ${projectTitle}`)
            }
            onClick={() => {
              if (shouldToggleStackFromCard) {
                handleToggleStack?.();
                return;
              }

              setShouldLoadPreview(true);
              onOpenPreview(project);
            }}
          />
        ) : null}
        {stackBadgeLabel ? <span className="studio-project-card__stack-label">{stackBadgeLabel}</span> : null}
      <div className="studio-project-card__quick-actions" onClick={(event) => event.stopPropagation()}>
          <button
            className="studio-canvas-preview__quick-action"
            type="button"
            aria-label={projectSoonTooltip}
            title={
              projectSoonTooltip
            }
            disabled
            onClick={() => onEdit(project)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="m13 7 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className="studio-canvas-preview__quick-action"
            type="button"
            aria-label={workspaceText(locale, "Опубликовать в YouTube", "Publish to YouTube")}
            title={
              canPublishProject
                ? workspaceText(locale, "Опубликовать", "Publish")
                : workspaceText(
                    locale,
                    "Публикация доступна после готовности проекта",
                    "Publishing is available after the project is ready",
                  )
            }
            disabled={!canPublishProject || isProjectActionBusy}
            onClick={() => onPublish(project)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 19V5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              <path d="m6.5 10.5 5.5-5.5 5.5 5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {canUseLocalExamples ? (
            <button
              className="studio-canvas-preview__quick-action studio-canvas-preview__quick-action--accent"
              type="button"
              aria-label={workspaceText(locale, "Добавить видео в локальные примеры", "Add video to local examples")}
              title={workspaceText(locale, "Добавить в примеры", "Add to examples")}
              disabled={!canAddProjectToExamples || isProjectActionBusy}
              onClick={() => onAddToExamples(project)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 4.75 14.16 9.13l4.84.7-3.5 3.41.83 4.82L12 15.8 7.67 18.06l.83-4.82L5 9.83l4.84-.7L12 4.75Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
          <a
            className={`studio-canvas-preview__quick-action${canDownloadProject ? "" : " is-disabled"}`}
            href={projectDownloadUrl ?? undefined}
            download={projectDownloadName}
            aria-label={workspaceText(locale, "Скачать видео", "Download video")}
            aria-disabled={!canDownloadProject}
            tabIndex={canDownloadProject ? 0 : -1}
            title={
              canDownloadProject
                ? workspaceText(locale, "Скачать", "Download")
                : workspaceText(locale, "Видео ещё не готово для скачивания", "Video is not ready for download yet")
            }
            onClick={(event) => {
              event.stopPropagation();
              if (!canDownloadProject) {
                event.preventDefault();
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
        {shouldShowStatusBadge ? (
          <span className={`studio-project-card__status studio-project-card__status--${project.status}`}>
            {getProjectStatusLabel(project.status, locale)}
          </span>
        ) : null}
        <div className="studio-project-card__thumb-footer">
          <div className="studio-project-card__thumb-meta">
            <span className="studio-project-card__date">{formatProjectDate(project.updatedAt, locale)}</span>
          </div>
          <button
            className="studio-project-card__delete workspace-delete-btn"
            type="button"
            aria-label={workspaceText(locale, "Удалить проект", "Delete project")}
            title={workspaceText(locale, "Удалить проект", "Delete project")}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(project);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 7h16" strokeLinecap="round" />
              <path d="M9 3h6" strokeLinecap="round" />
              <path d="M10 11v6" strokeLinecap="round" />
              <path d="M14 11v6" strokeLinecap="round" />
              <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      {hasCollapseHandle ? (
        <button
          className="workspace-project-stack__collapse-handle studio-project-card__stack-collapse"
          type="button"
          aria-label={workspaceText(locale, "Свернуть стопку проектов", "Collapse project stack")}
          title={workspaceText(locale, "Свернуть стопку", "Collapse stack")}
          onClick={(event) => {
            event.stopPropagation();
            handleToggleStack?.();
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <path d="M14 7l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </article>
  );
}

export const doesWorkspaceProjectMatch = (
  project: Pick<WorkspaceProject, "id" | "adId" | "jobId">,
  target: Pick<WorkspaceProject, "id" | "adId" | "jobId">,
) => {
  if (project.id === target.id) {
    return true;
  }

  if (project.adId !== null && target.adId !== null && project.adId === target.adId) {
    return true;
  }

  if (project.jobId && target.jobId && project.jobId === target.jobId) {
    return true;
  }

  return false;
};

export const mergeWorkspaceProjectDeletionSnapshots = <TProject extends Pick<WorkspaceProject, "id" | "adId" | "jobId">>(
  currentSnapshots: TProject[],
  targetProjects: TProject[],
) =>
  targetProjects.reduce((snapshots, targetProject) => {
    if (snapshots.some((snapshot) => doesWorkspaceProjectMatch(snapshot, targetProject))) {
      return snapshots;
    }

    return [...snapshots, targetProject];
  }, currentSnapshots);

export const removeWorkspaceProjectDeletionSnapshots = <TProject extends Pick<WorkspaceProject, "id" | "adId" | "jobId">>(
  currentSnapshots: TProject[],
  targetProjects: TProject[],
) =>
  currentSnapshots.filter(
    (snapshot) => !targetProjects.some((targetProject) => doesWorkspaceProjectMatch(snapshot, targetProject)),
  );

export const filterWorkspaceProjectsByDeletionSnapshots = <TProject extends Pick<WorkspaceProject, "id" | "adId" | "jobId">>(
  projects: TProject[],
  deletionSnapshots: ReadonlyArray<Pick<WorkspaceProject, "id" | "adId" | "jobId">>,
) => {
  if (deletionSnapshots.length === 0) {
    return projects;
  }

  return projects.filter(
    (project) => !deletionSnapshots.some((snapshot) => doesWorkspaceProjectMatch(project, snapshot)),
  );
};

export const doesStudioGenerationMatchWorkspaceProject = (
  generation: Pick<WorkspaceProjectStudioGeneration, "adId" | "id">,
  project: Pick<WorkspaceProject, "id" | "adId" | "jobId">,
) => {
  if (generation.adId !== null && project.adId !== null && generation.adId === project.adId) {
    return true;
  }

  if (generation.id && project.jobId && generation.id === project.jobId) {
    return true;
  }

  return generation.id === project.id;
};

export const formatProjectVersionsLabel = (count: number, locale: Locale = "ru") => {
  const absoluteCount = Math.abs(Math.trunc(count));
  if (locale === "en") {
    return `${absoluteCount} ${absoluteCount === 1 ? "version" : "versions"}`;
  }

  const lastTwoDigits = absoluteCount % 100;
  const lastDigit = absoluteCount % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${absoluteCount} версий`;
  }

  if (lastDigit === 1) {
    return `${absoluteCount} версия`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${absoluteCount} версии`;
  }

  return `${absoluteCount} версий`;
};

type AccountProjectListCardProps = {
  isChild?: boolean;
  isStackExpanded?: boolean;
  isStackLead?: boolean;
  onDelete: (project: WorkspaceProject) => void;
  onToggleStack?: () => void;
  project: WorkspaceProject;
  showStackCollapseHandle?: boolean;
  stackBadgeLabel?: string | null;
};

export function AccountProjectListCard({
  isChild = false,
  isStackExpanded = false,
  isStackLead = false,
  onDelete,
  onToggleStack,
  project,
  showStackCollapseHandle = false,
  stackBadgeLabel = null,
}: AccountProjectListCardProps) {
  const { locale } = useLocale();
  const handleToggleStack = typeof onToggleStack === "function" ? onToggleStack : null;
  const hasCollapseHandle = Boolean(handleToggleStack && showStackCollapseHandle);
  const isToggleable = Boolean(handleToggleStack && stackBadgeLabel);
  const shouldShowStatusBadge = shouldShowProjectStatusBadge(project.status);

  return (
    <article
      className={[
        "account-library__item",
        "account-project-card",
        isChild ? "account-project-card--child" : "",
        isStackLead ? "account-project-card--stack-lead" : "",
        hasCollapseHandle ? "has-stack-collapse-handle" : "",
        isToggleable ? "is-toggleable" : "",
      ].filter(Boolean).join(" ")}
      aria-expanded={isToggleable ? isStackExpanded : undefined}
      onClick={isToggleable ? () => handleToggleStack?.() : undefined}
      onKeyDown={
        isToggleable
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") {
                return;
              }

              event.preventDefault();
              handleToggleStack?.();
            }
          : undefined
      }
      role={isToggleable ? "button" : undefined}
      tabIndex={isToggleable ? 0 : undefined}
    >
      <div className="account-project-card__meta">
        <span className="account-library__label">
          {project.adId ? workspaceText(locale, `Проект #${project.adId}`, `Project #${project.adId}`) : `Job ${project.jobId?.slice(0, 8) ?? "N/A"}`}
        </span>
        <div className="account-project-card__meta-actions">
          {stackBadgeLabel ? (
            <span className="account-project-stack__badge">{stackBadgeLabel}</span>
          ) : null}
          {shouldShowStatusBadge ? (
            <span className={`account-status ${getProjectStatusClassName(project.status)}`}>
              {getProjectStatusLabel(project.status, locale)}
            </span>
          ) : null}
        </div>
      </div>

      <h4>{getWorkspaceProjectDisplayTitle(project)}</h4>
      <p>{project.description}</p>

      <div className="account-project-card__details">
        <div className="account-project-card__detail">
          <span>{workspaceText(locale, "Тема", "Topic")}</span>
          <strong>{project.prompt || workspaceText(locale, "Без темы", "No topic")}</strong>
        </div>
        <div className="account-project-card__detail">
          <span>{workspaceText(locale, "Источник", "Source")}</span>
          <strong>
            {project.source === "task"
              ? workspaceText(locale, "Задача генерации", "Generation task")
              : workspaceText(locale, "Сохраненный проект", "Saved project")}
          </strong>
        </div>
        <div className="account-project-card__detail">
          <span>{workspaceText(locale, "Обновлен", "Updated")}</span>
          <strong>{formatProjectDate(project.updatedAt, locale)}</strong>
        </div>
      </div>

      {project.hashtags.length ? (
        <div className="account-project-card__tags" aria-label={workspaceText(locale, "Хэштеги проекта", "Project hashtags")}>
          {project.hashtags.map((tag) => (
            <span key={`${project.id}-${tag}`}>{tag}</span>
          ))}
        </div>
      ) : null}

      <div className="account-project-card__footer">
        <span>
          {workspaceText(locale, "Создан", "Created")}: {formatProjectDate(project.createdAt, locale)}
          {project.generatedAt ? ` · ${workspaceText(locale, "Готов", "Ready")}: ${formatProjectDate(project.generatedAt, locale)}` : ""}
        </span>

        <div className="account-project-card__actions">
          <button
            className="account-linkbtn account-linkbtn--subtle-danger workspace-delete-btn"
            type="button"
            aria-label={workspaceText(locale, "Удалить проект", "Delete project")}
            title={workspaceText(locale, "Удалить проект", "Delete project")}
            onKeyDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(project);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 7h16" strokeLinecap="round" />
              <path d="M9 3h6" strokeLinecap="round" />
              <path d="M10 11v6" strokeLinecap="round" />
              <path d="M14 11v6" strokeLinecap="round" />
              <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      {hasCollapseHandle ? (
        <button
          className="workspace-project-stack__collapse-handle account-project-card__stack-collapse"
          type="button"
          aria-label={workspaceText(locale, "Свернуть стопку проектов", "Collapse project stack")}
          title={workspaceText(locale, "Свернуть стопку", "Collapse stack")}
          onClick={(event) => {
            event.stopPropagation();
            handleToggleStack?.();
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <path d="M14 7l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </article>
  );
}
