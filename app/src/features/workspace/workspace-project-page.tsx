import { useEffect, useRef, useState } from "react";

import { useLocale, type Locale } from "../../lib/i18n";
import { getWorkspaceProjectDisplayTitle, getWorkspaceVideoDownloadName } from "../../lib/workspaceMediaLibrary";
import { appendUrlToken } from "./workspace-media-library-helpers";
import { WorkspaceModalVideoPlayer } from "./workspace-preview-components";
import { formatProjectDate, getPublicationMetaLabel } from "./workspace-publish-helpers";
import { getStudioVoiceOptionById } from "./workspace-studio-defaults-helpers";
import { getStudioMusicOptionCopy, studioMusicOptions } from "./workspace-studio-options";
import { getStudioVoiceOptionCopy } from "./workspace-segment-editor";
import type {
  StudioSubtitleColorOption,
  StudioSubtitleStyleOption,
  WorkspaceProject,
} from "./workspace-types";

type WorkspaceProjectPageProps = {
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
  subtitleColorOptions: StudioSubtitleColorOption[];
  subtitleStyleOptions: StudioSubtitleStyleOption[];
  versions: WorkspaceProject[];
  volume: number;
};

type VideoDurationState =
  | { kind: "available"; seconds: number }
  | { kind: "pending" }
  | { kind: "unavailable" };

const workspaceText = (locale: Locale, ru: string, en: string) => (locale === "en" ? en : ru);

const getUnavailableLabel = (locale: Locale) => workspaceText(locale, "Нет данных", "Unavailable");

const getCreationModeLabel = (project: WorkspaceProject, locale: Locale) => {
  const creationMode = project.prefillSettings?.creationMode;
  if (creationMode === "idea") {
    return workspaceText(locale, "Из идеи", "From idea");
  }
  if (creationMode === "scenes" || project.editedFromProjectAdId !== null) {
    return workspaceText(locale, "По сценам", "By scenes");
  }
  return getUnavailableLabel(locale);
};

const getLanguageLabel = (project: WorkspaceProject, locale: Locale) => {
  if (project.prefillSettings?.language === "ru") {
    return workspaceText(locale, "Русский", "Russian");
  }
  if (project.prefillSettings?.language === "en") {
    return workspaceText(locale, "Английский", "English");
  }
  return getUnavailableLabel(locale);
};

const getVideoModeLabel = (project: WorkspaceProject, locale: Locale) => {
  switch (project.prefillSettings?.videoMode) {
    case "ai_photo":
      return workspaceText(locale, "ИИ-фото", "AI photos");
    case "ai_video":
      return project.prefillSettings.aiVideoGenerateAudioEnabled === true
        ? workspaceText(locale, "ИИ-видео со звуком", "AI video with sound")
        : workspaceText(locale, "ИИ-видео", "AI video");
    case "custom":
      return workspaceText(locale, "Свой визуал", "Custom visual");
    case "standard":
      return workspaceText(locale, "Сцены проекта", "Project scenes");
    default:
      return getUnavailableLabel(locale);
  }
};

const getMusicLabel = (project: WorkspaceProject, locale: Locale) => {
  const musicType = project.prefillSettings?.musicType;
  if (!musicType) {
    return getUnavailableLabel(locale);
  }

  const option = studioMusicOptions.find((candidate) => candidate.id === musicType);
  return option ? getStudioMusicOptionCopy(option, locale).label : musicType;
};

const getVoiceLabel = (project: WorkspaceProject, locale: Locale) => {
  const settings = project.prefillSettings;
  if (!settings || typeof settings.voiceEnabled !== "boolean") {
    return getUnavailableLabel(locale);
  }
  if (!settings.voiceEnabled) {
    return workspaceText(locale, "Выключена", "Off");
  }

  const voiceId = String(settings.voiceId ?? "").trim();
  if (!voiceId) {
    return workspaceText(locale, "Включена · голос не указан", "On · voice unavailable");
  }

  const voiceOption = getStudioVoiceOptionById(voiceId);
  return voiceOption ? getStudioVoiceOptionCopy(voiceOption, locale).label : voiceId;
};

const getSubtitleLabel = (
  project: WorkspaceProject,
  locale: Locale,
  subtitleColorOptions: StudioSubtitleColorOption[],
  subtitleStyleOptions: StudioSubtitleStyleOption[],
) => {
  const settings = project.prefillSettings;
  if (!settings || typeof settings.subtitleEnabled !== "boolean") {
    return getUnavailableLabel(locale);
  }
  if (!settings.subtitleEnabled) {
    return workspaceText(locale, "Выключены", "Off");
  }

  const styleId = String(settings.subtitleStyleId ?? "").trim();
  const colorId = String(settings.subtitleColorId ?? "").trim();
  const styleLabel = subtitleStyleOptions.find((option) => option.id === styleId)?.label || styleId;
  const colorLabel = subtitleColorOptions.find((option) => option.id === colorId)?.label || colorId;
  const details = [styleLabel, colorLabel].filter(Boolean).join(" · ");
  return details || workspaceText(locale, "Включены", "On");
};

const formatVideoDuration = (durationState: VideoDurationState, locale: Locale) => {
  if (durationState.kind === "pending") {
    return workspaceText(locale, "Определяется…", "Detecting…");
  }
  if (durationState.kind === "unavailable") {
    return getUnavailableLabel(locale);
  }

  const roundedSeconds = Math.max(0, Math.round(durationState.seconds));
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export function WorkspaceProjectPage({
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
  subtitleColorOptions,
  subtitleStyleOptions,
  versions,
  volume,
}: WorkspaceProjectPageProps) {
  const { locale } = useLocale();
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [useFallbackVideo, setUseFallbackVideo] = useState(false);
  const [videoDuration, setVideoDuration] = useState<VideoDurationState>({ kind: "pending" });
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
  const safeVersions = versions.length > 0 ? versions : project ? [project] : [];

  useEffect(() => {
    setUseFallbackVideo(false);
    setIsPromptExpanded(false);
    setIsProjectMenuOpen(false);
    setVideoDuration(project?.videoUrl ? { kind: "pending" } : { kind: "unavailable" });
  }, [project?.id, project?.updatedAt, project?.videoUrl]);

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
  const prompt = project.prompt.trim();
  const canExpandPrompt = prompt.length > 170;

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
                      setVideoDuration({ kind: "pending" });
                      return;
                    }
                    setVideoDuration({ kind: "unavailable" });
                  }}
                  onLoadedMetadata={(event) => {
                    const duration = event.currentTarget.duration;
                    setVideoDuration(
                      Number.isFinite(duration) && duration > 0
                        ? { kind: "available", seconds: duration }
                        : { kind: "unavailable" },
                    );
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
            <button
              className="studio-project-page__action studio-project-page__action--quiet"
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
            <button
              className="studio-project-page__create-new"
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

        <aside
          className="studio-project-page__info"
          aria-label={workspaceText(locale, "Информация о проекте", "Project information")}
        >
          <div className="studio-project-page__info-head">
            <div>
              <span>{workspaceText(locale, "Проект", "Project")}</span>
              <h2>{workspaceText(locale, "Информация", "Information")}</h2>
            </div>
            <span className="studio-project-page__version-count">
              {safeVersions.length}
              <small>{workspaceText(locale, "верс.", "ver.")}</small>
            </span>
          </div>

          <dl className="studio-project-page__facts">
            <div>
              <dt>{workspaceText(locale, "Способ создания", "Creation method")}</dt>
              <dd>{getCreationModeLabel(project, locale)}</dd>
            </div>
            <div>
              <dt>{workspaceText(locale, "Длительность", "Duration")}</dt>
              <dd>{formatVideoDuration(videoDuration, locale)}</dd>
            </div>
            <div>
              <dt>{workspaceText(locale, "Язык", "Language")}</dt>
              <dd>{getLanguageLabel(project, locale)}</dd>
            </div>
            <div>
              <dt>{workspaceText(locale, "Озвучка", "Voice")}</dt>
              <dd>{getVoiceLabel(project, locale)}</dd>
            </div>
            <div>
              <dt>{workspaceText(locale, "Визуал", "Visual")}</dt>
              <dd>{getVideoModeLabel(project, locale)}</dd>
            </div>
            <div>
              <dt>{workspaceText(locale, "Музыка", "Music")}</dt>
              <dd>{getMusicLabel(project, locale)}</dd>
            </div>
            <div className="studio-project-page__fact-wide">
              <dt>{workspaceText(locale, "Субтитры", "Subtitles")}</dt>
              <dd>{getSubtitleLabel(project, locale, subtitleColorOptions, subtitleStyleOptions)}</dd>
            </div>
          </dl>

          <div className="studio-project-page__dates">
            <div>
              <span>{workspaceText(locale, "Обновлено", "Updated")}</span>
              <strong>{updateLabel}</strong>
            </div>
            <div>
              <span>{workspaceText(locale, "Опубликовано", "Published")}</span>
              <strong>{publicationMeta || workspaceText(locale, "Не опубликовано", "Not published")}</strong>
            </div>
          </div>

          <section className="studio-project-page__prompt">
            <span>{workspaceText(locale, "Промпт", "Prompt")}</span>
            <p className={isPromptExpanded ? "is-expanded" : undefined}>
              {prompt || getUnavailableLabel(locale)}
            </p>
            {canExpandPrompt ? (
              <button type="button" onClick={() => setIsPromptExpanded((current) => !current)}>
                {isPromptExpanded
                  ? workspaceText(locale, "Свернуть", "Collapse")
                  : workspaceText(locale, "Показать полностью", "Show full prompt")}
              </button>
            ) : null}
          </section>

          {project.description || project.hashtags.length > 0 ? (
            <section className="studio-project-page__summary">
              {project.description ? <p>{project.description}</p> : null}
              {project.hashtags.length > 0 ? (
                <div className="studio-project-page__hashtags">
                  {project.hashtags.map((hashtag) => (
                    <span key={hashtag}>{hashtag}</span>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

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
