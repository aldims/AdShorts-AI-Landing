import { useEffect, useRef, useState } from "react";

import { useLocale, type Locale } from "../../lib/i18n";
import { getWorkspaceProjectDisplayTitle, getWorkspaceVideoDownloadName } from "../../lib/workspaceMediaLibrary";
import { appendUrlToken } from "./workspace-media-library-helpers";
import { getWorkspaceSegmentEditorSessionUrl, type WorkspaceSegmentEditorResponse } from "./workspace-page-model";
import { WorkspaceModalVideoPlayer } from "./workspace-preview-components";
import { formatProjectDate, getPublicationMetaLabel } from "./workspace-publish-helpers";
import type { WorkspaceProject } from "./workspace-types";

type WorkspaceProjectPageProps = {
  firstVideoOffer: {
    checkoutError: string | null;
    isCheckoutPending: boolean;
    onCheckoutStart: () => void;
    onComparePlans: () => void;
    onDismiss: () => void;
  } | null;
  isActionBusy: boolean;
  isDeleteBusy: boolean;
  isLoading: boolean;
  onBack: () => void;
  onCreateNew: () => void;
  onDelete: (project: WorkspaceProject) => void;
  onEdit: (project: WorkspaceProject) => void;
  onPublish: (project: WorkspaceProject) => void;
  onRegenerate: (project: WorkspaceProject) => void;
  onRetryLoad: () => void;
  onSelectVersion: (project: WorkspaceProject) => void;
  onVolumeChange: (nextVolume: number) => void;
  project: WorkspaceProject | null;
  projectsError: string | null;
  versions: WorkspaceProject[];
  volume: number;
};

type SceneCountState =
  | { count: number; kind: "available" }
  | { kind: "pending" }
  | { kind: "unavailable" };

const workspaceText = (locale: Locale, ru: string, en: string) => (locale === "en" ? en : ru);

const formatSceneCount = (sceneCount: SceneCountState, locale: Locale) => {
  if (sceneCount.kind === "pending") {
    return workspaceText(locale, "Определяется…", "Detecting…");
  }
  if (sceneCount.kind === "unavailable") {
    return workspaceText(locale, "Нет данных", "Unavailable");
  }

  if (locale === "en") {
    return `${sceneCount.count} ${sceneCount.count === 1 ? "scene" : "scenes"}`;
  }

  const modulo100 = sceneCount.count % 100;
  const modulo10 = sceneCount.count % 10;
  const suffix =
    modulo100 >= 11 && modulo100 <= 14
      ? "сцен"
      : modulo10 === 1
        ? "сцена"
        : modulo10 >= 2 && modulo10 <= 4
          ? "сцены"
          : "сцен";
  return `${sceneCount.count} ${suffix}`;
};

export function WorkspaceProjectPage({
  firstVideoOffer,
  isActionBusy,
  isDeleteBusy,
  isLoading,
  onBack,
  onCreateNew,
  onDelete,
  onEdit,
  onPublish,
  onRegenerate,
  onRetryLoad,
  onSelectVersion,
  onVolumeChange,
  project,
  projectsError,
  versions,
  volume,
}: WorkspaceProjectPageProps) {
  const { locale } = useLocale();
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [useFallbackVideo, setUseFallbackVideo] = useState(false);
  const [sceneCount, setSceneCount] = useState<SceneCountState>({ kind: "pending" });
  const title = project ? getWorkspaceProjectDisplayTitle(project) : "";
  const playbackToken = project
    ? project.updatedAt || project.generatedAt || project.createdAt || project.id
    : "";
  const primaryVideoUrl = project?.videoUrl ?? null;
  const fallbackVideoUrl = project?.videoFallbackUrl ?? null;
  const sourceVideoUrl = useFallbackVideo && fallbackVideoUrl ? fallbackVideoUrl : primaryVideoUrl;
  const playbackUrl = appendUrlToken(sourceVideoUrl, "playback", playbackToken);
  const downloadUrl = appendUrlToken(primaryVideoUrl, "download", playbackToken);
  const downloadName = getWorkspaceVideoDownloadName(title);
  const canEdit = Boolean(project?.adId && project.status === "ready" && primaryVideoUrl);
  const shouldShowRegenerate = project?.prefillSettings?.creationMode === "idea";
  const canRegenerate = Boolean(shouldShowRegenerate && project?.prompt.trim() && primaryVideoUrl);
  const canPublish = Boolean(project?.adId && project.status === "ready" && primaryVideoUrl);
  const publication = project?.instagramPublication ?? project?.youtubePublication ?? null;
  const publicationMeta = getPublicationMetaLabel(publication, locale);
  const safeVersions = versions.length > 0 ? versions : project ? [project] : [];

  useEffect(() => {
    setUseFallbackVideo(false);
    setIsProjectMenuOpen(false);
  }, [project?.id, project?.updatedAt, project?.videoUrl]);

  useEffect(() => {
    const projectId = Number(project?.adId ?? 0);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      setSceneCount({ kind: "unavailable" });
      return undefined;
    }

    const controller = new AbortController();
    setSceneCount({ kind: "pending" });

    void (async () => {
      try {
        const response = await fetch(getWorkspaceSegmentEditorSessionUrl(projectId), {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as WorkspaceSegmentEditorResponse | null;
        if (!response.ok || !Array.isArray(payload?.data?.segments)) {
          throw new Error(payload?.error || "Project scenes are unavailable.");
        }
        setSceneCount({ count: payload.data.segments.length, kind: "available" });
      } catch (error) {
        if (!controller.signal.aborted) {
          setSceneCount({ kind: "unavailable" });
        }
      }
    })();

    return () => controller.abort("project-page-replaced");
  }, [project?.adId, project?.updatedAt]);

  useEffect(() => {
    if (!isProjectMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!projectMenuRef.current?.contains(event.target as Node)) {
        setIsProjectMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProjectMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProjectMenuOpen]);

  if (isLoading) {
    return (
      <section className="studio-project-page studio-project-page--state" aria-live="polite">
        <span className="studio-canvas-preview__spinner" aria-hidden="true" />
        <p>{workspaceText(locale, "Загружаем проект…", "Loading project…")}</p>
      </section>
    );
  }

  if (!project) {
    return (
      <section className="studio-project-page studio-project-page--state">
        <div className="studio-project-page__state-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 7.5h6l2 2h8v9.5H4V7.5Z" />
            <path d="m9.5 13 5 5m0-5-5 5" />
          </svg>
        </div>
        <h1>{workspaceText(locale, "Проект не найден", "Project not found")}</h1>
        <p>
          {projectsError ||
            workspaceText(
              locale,
              "Возможно, проект был удалён или ссылка больше недоступна.",
              "The project may have been deleted or the link is no longer available.",
            )}
        </p>
        <div className="studio-project-page__state-actions">
          {projectsError ? (
            <button type="button" onClick={onRetryLoad}>
              {workspaceText(locale, "Повторить", "Retry")}
            </button>
          ) : null}
          <button type="button" onClick={onBack}>
            {workspaceText(locale, "К проектам", "Back to projects")}
          </button>
        </div>
      </section>
    );
  }

  const updateLabel = formatProjectDate(project.updatedAt || project.generatedAt || project.createdAt, locale);
  const statusLabel =
    project.status === "ready"
      ? workspaceText(locale, "Готово", "Ready")
      : project.status === "failed"
        ? workspaceText(locale, "Ошибка генерации", "Generation failed")
        : workspaceText(locale, "Создаётся", "Generating");
  return (
    <article className="studio-project-page">
      <header className="studio-project-page__header">
        <button
          className="studio-project-page__back"
          type="button"
          aria-label={workspaceText(locale, "Вернуться к проектам", "Back to projects")}
          onClick={onBack}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 6-6 6 6 6" />
          </svg>
          <span>{workspaceText(locale, "Проекты", "Projects")}</span>
        </button>
        <div className="studio-project-page__heading">
          <h1>{title}</h1>
          <span className={`studio-project-page__status is-${project.status}`}>{statusLabel}</span>
        </div>
      </header>

      <div className="studio-project-page__workspace">
        <div className="studio-project-page__center">
          <div className="studio-project-page__viewer">
            <div className="studio-project-page__ambient" aria-hidden="true" />
            <div className="studio-project-page__player-shell">
              {playbackUrl ? (
                <WorkspaceModalVideoPlayer
                  autoPlay={false}
                  fitMode="contain"
                  onError={() => {
                    if (!useFallbackVideo && fallbackVideoUrl) {
                      setUseFallbackVideo(true);
                      return;
                    }
                  }}
                  poster={project.posterUrl}
                  preload="metadata"
                  src={playbackUrl}
                  uiRevealMode="always"
                  videoKey={`project-page:${project.id}:${useFallbackVideo ? "fallback" : "primary"}:${playbackToken}`}
                  volume={volume}
                  onVolumeChange={onVolumeChange}
                />
              ) : (
                <div className="studio-project-page__video-placeholder">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="3" />
                    <path d="m10 9 5 3-5 3V9Z" />
                  </svg>
                  <strong>{workspaceText(locale, "Видео ещё не готово", "Video is not ready yet")}</strong>
                  <span>{workspaceText(locale, "Здесь появится итоговый Shorts после рендера.", "The final Short will appear here after rendering.")}</span>
                </div>
              )}
            </div>
          </div>

          <div
            className="studio-project-page__actions"
            aria-label={workspaceText(locale, "Действия с видео", "Video actions")}
          >
            <div className="studio-project-page__action-row studio-project-page__action-row--main">
              <button
                className="studio-project-page__action studio-project-page__action--primary"
                type="button"
                disabled={!canEdit || isActionBusy}
                title={
                  canEdit
                    ? workspaceText(locale, "Открыть редактор сцен", "Open scene editor")
                    : workspaceText(locale, "Редактирование доступно после готовности видео", "Editing is available when the video is ready")
                }
                onClick={() => onEdit(project)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                  <path d="m13 7 4 4" />
                </svg>
                <span>{workspaceText(locale, "Редактировать видео", "Edit video")}</span>
              </button>
              <button
                className="studio-project-page__action"
                type="button"
                disabled={!canPublish || isActionBusy}
                onClick={() => onPublish(project)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 19V5" />
                  <path d="m6.5 10.5 5.5-5.5 5.5 5.5" />
                </svg>
                <span>{workspaceText(locale, "Опубликовать", "Publish")}</span>
              </button>
              <a
                className={`studio-project-page__action${downloadUrl ? "" : " is-disabled"}`}
                href={downloadUrl ?? undefined}
                download={downloadName}
                aria-disabled={!downloadUrl}
                tabIndex={downloadUrl ? 0 : -1}
                onClick={(event) => {
                  if (!downloadUrl) {
                    event.preventDefault();
                  }
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14" />
                </svg>
                <span>{workspaceText(locale, "Скачать", "Download")}</span>
              </a>
            </div>
            <div
              className={`studio-project-page__action-row studio-project-page__action-row--secondary${
                shouldShowRegenerate ? "" : " is-single"
              }`}
            >
              {shouldShowRegenerate ? (
                <button
                  className="studio-project-page__action studio-project-page__action--secondary"
                  type="button"
                  disabled={!canRegenerate || isActionBusy}
                  onClick={() => onRegenerate(project)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 7v5h-5" />
                    <path d="M18.2 16.3A8 8 0 1 1 19.5 9" />
                  </svg>
                  <span>{workspaceText(locale, "Сгенерировать заново", "Generate again")}</span>
                </button>
              ) : null}
              <button
                className="studio-project-page__action studio-project-page__action--secondary"
                type="button"
                onClick={onCreateNew}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>{workspaceText(locale, "Создать новое", "Create new")}</span>
              </button>
            </div>
          </div>
        </div>

        <aside
          className="studio-project-page__info"
          aria-label={workspaceText(locale, "Информация о проекте", "Project information")}
        >
          <div className="studio-project-page__info-head">
            <div>
              <span>{workspaceText(locale, "Проект", "Project")}</span>
              <h2>{workspaceText(locale, "Сведения", "Details")}</h2>
            </div>
            <div className="studio-project-page__menu" ref={projectMenuRef}>
              <button
                className="studio-project-page__menu-trigger"
                type="button"
                aria-label={workspaceText(locale, "Меню проекта", "Project menu")}
                aria-expanded={isProjectMenuOpen}
                aria-haspopup="menu"
                onClick={() => setIsProjectMenuOpen((current) => !current)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.45" />
                  <circle cx="12" cy="12" r="1.45" />
                  <circle cx="12" cy="19" r="1.45" />
                </svg>
              </button>
              {isProjectMenuOpen ? (
                <div className="studio-project-page__menu-popover" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={isDeleteBusy}
                    onClick={() => {
                      setIsProjectMenuOpen(false);
                      onDelete(project);
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 7h16M9 3h6m-8 4 1 13h8l1-13M10 11v5m4-5v5" />
                    </svg>
                    <span>{workspaceText(locale, "Удалить проект", "Delete project")}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <section className="studio-project-page__info-section studio-project-page__info-section--summary">
            <div className="studio-project-page__section-head">
              <span>{workspaceText(locale, "Промпт", "Prompt")}</span>
            </div>
            <p className="studio-project-page__prompt">
              {project.prompt.trim() || workspaceText(locale, "Промпт не сохранён", "Prompt unavailable")}
            </p>
            <div className="studio-project-page__scene-count">
              <span>{workspaceText(locale, "Сцены", "Scenes")}</span>
              <strong aria-live="polite">{formatSceneCount(sceneCount, locale)}</strong>
            </div>
          </section>

          {firstVideoOffer ? (
            <section
              className="studio-project-page__offer"
              aria-label={workspaceText(locale, "Предложение тарифа START", "START plan offer")}
            >
              <button
                className="studio-project-page__offer-dismiss"
                type="button"
                aria-label={workspaceText(locale, "Скрыть предложение", "Dismiss offer")}
                onClick={firstVideoOffer.onDismiss}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m7 7 10 10M17 7 7 17" />
                </svg>
              </button>
              <span className="studio-project-page__offer-eyebrow">
                {workspaceText(locale, "Первый Shorts готов", "Your first Short is ready")}
              </span>
              <strong>
                {workspaceText(
                  locale,
                  "Создайте ещё до 5 Shorts без водяного знака",
                  "Create up to 5 more Shorts without a watermark",
                )}
              </strong>
              <span className="studio-project-page__offer-plan">
                START · 50 {workspaceText(locale, "кредитов", "credits")} · 390 ₽
              </span>
              <button
                className="studio-project-page__offer-cta"
                type="button"
                disabled={firstVideoOffer.isCheckoutPending}
                onClick={firstVideoOffer.onCheckoutStart}
              >
                {firstVideoOffer.isCheckoutPending
                  ? workspaceText(locale, "Открываем оплату…", "Opening checkout…")
                  : workspaceText(locale, "Получить 50 кредитов", "Get 50 credits")}
              </button>
              {firstVideoOffer.checkoutError ? (
                <p className="studio-project-page__offer-error" role="alert">
                  {firstVideoOffer.checkoutError}
                </p>
              ) : (
                <span className="studio-project-page__offer-trust">
                  {workspaceText(locale, "Разовая оплата · без автосписаний", "One-time payment · no auto-renewal")}
                </span>
              )}
              <button
                className="studio-project-page__offer-compare"
                type="button"
                onClick={firstVideoOffer.onComparePlans}
              >
                {workspaceText(locale, "Сравнить тарифы", "Compare plans")}
              </button>
            </section>
          ) : null}

          <section className="studio-project-page__info-section">
            <div className="studio-project-page__section-head">
              <span>{workspaceText(locale, "Активность", "Activity")}</span>
            </div>
            <div className="studio-project-page__dates">
              <div>
                <span>{workspaceText(locale, "Обновлено", "Updated")}</span>
                <strong>{updateLabel}</strong>
              </div>
              <div>
                <span>{workspaceText(locale, "Публикация", "Publication")}</span>
                <strong>{publicationMeta || workspaceText(locale, "Не опубликовано", "Not published")}</strong>
              </div>
            </div>
          </section>

          <section className="studio-project-page__versions">
            <div className="studio-project-page__section-head">
              <span>{workspaceText(locale, "Версии видео", "Video versions")}</span>
              <strong>{safeVersions.length}</strong>
            </div>
            <div className="studio-project-page__version-list">
              {safeVersions.map((version, index) => {
                const versionNumber = safeVersions.length - index;
                const isCurrent = version.id === project.id;
                return (
                  <button
                    className={isCurrent ? "is-current" : undefined}
                    type="button"
                    key={version.id}
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={() => {
                      if (!isCurrent) {
                        onSelectVersion(version);
                      }
                    }}
                  >
                    <span>{versionNumber}</span>
                    <div>
                      <strong>
                        {workspaceText(locale, `Версия ${versionNumber}`, `Version ${versionNumber}`)}
                      </strong>
                      <small>{formatProjectDate(version.generatedAt || version.createdAt || version.updatedAt, locale)}</small>
                    </div>
                    {isCurrent ? <em>{workspaceText(locale, "Открыта", "Open")}</em> : null}
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </article>
  );
}
