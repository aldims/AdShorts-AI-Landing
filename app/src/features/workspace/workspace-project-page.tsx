import { useEffect, useState } from "react";

import { useLocale, type Locale } from "../../lib/i18n";
import { getWorkspaceProjectDisplayTitle, getWorkspaceVideoDownloadName } from "../../lib/workspaceMediaLibrary";
import { appendUrlToken } from "./workspace-media-library-helpers";
import { WorkspaceModalVideoPlayer } from "./workspace-preview-components";
import { formatProjectDate, getPublicationMetaLabel } from "./workspace-publish-helpers";
import type { WorkspaceProject } from "./workspace-types";

type WorkspaceProjectPageProps = {
  isActionBusy: boolean;
  isLoading: boolean;
  onBack: () => void;
  onEdit: (project: WorkspaceProject) => void;
  onPublish: (project: WorkspaceProject) => void;
  onRegenerate: (project: WorkspaceProject) => void;
  onRetryLoad: () => void;
  onVolumeChange: (nextVolume: number) => void;
  project: WorkspaceProject | null;
  projectsError: string | null;
  volume: number;
};

const workspaceText = (locale: Locale, ru: string, en: string) => (locale === "en" ? en : ru);

export function WorkspaceProjectPage({
  isActionBusy,
  isLoading,
  onBack,
  onEdit,
  onPublish,
  onRegenerate,
  onRetryLoad,
  onVolumeChange,
  project,
  projectsError,
  volume,
}: WorkspaceProjectPageProps) {
  const { locale } = useLocale();
  const [useFallbackVideo, setUseFallbackVideo] = useState(false);
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
  const canRegenerate = Boolean(project?.prompt.trim() && primaryVideoUrl);
  const canPublish = Boolean(project?.adId && project.status === "ready" && primaryVideoUrl);
  const publication = project?.instagramPublication ?? project?.youtubePublication ?? null;
  const publicationMeta = getPublicationMetaLabel(publication, locale);

  useEffect(() => {
    setUseFallbackVideo(false);
  }, [project?.id, project?.updatedAt, project?.videoUrl]);

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
          <div className="studio-project-page__meta">
            <span className={`studio-project-page__status is-${project.status}`}>{statusLabel}</span>
            <span>{workspaceText(locale, `Обновлено ${updateLabel}`, `Updated ${updateLabel}`)}</span>
            {publicationMeta ? <span>{publicationMeta}</span> : null}
          </div>
        </div>
      </header>

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
          disabled={!canRegenerate || isActionBusy}
          onClick={() => onRegenerate(project)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 7v5h-5" />
            <path d="M18.2 16.3A8 8 0 1 1 19.5 9" />
          </svg>
          <span>{workspaceText(locale, "Сгенерировать заново", "Generate again")}</span>
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
      </div>

      {project.prompt || project.description || project.hashtags.length > 0 ? (
        <section className="studio-project-page__details" aria-label={workspaceText(locale, "Информация о проекте", "Project information")}>
          {project.prompt ? (
            <div>
              <span>{workspaceText(locale, "Идея", "Idea")}</span>
              <p>{project.prompt}</p>
            </div>
          ) : null}
          {project.description ? (
            <div>
              <span>{workspaceText(locale, "Описание", "Description")}</span>
              <p>{project.description}</p>
            </div>
          ) : null}
          {project.hashtags.length > 0 ? (
            <div>
              <span>{workspaceText(locale, "Хэштеги", "Hashtags")}</span>
              <div className="studio-project-page__hashtags">
                {project.hashtags.map((hashtag) => (
                  <span key={hashtag}>{hashtag}</span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
