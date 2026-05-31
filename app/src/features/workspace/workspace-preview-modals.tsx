import type { CSSProperties, SyntheticEvent as ReactSyntheticEvent } from "react";
import type { Locale } from "../../lib/i18n";
import type { WorkspaceMediaLibraryItem } from "../../lib/workspaceMediaLibrary";
import type { WorkspaceResolvedMediaSurface } from "../../lib/workspaceResolvedMedia";
import { workspaceText } from "./workspace-page-model";
import { WorkspaceModalVideoPlayer } from "./workspace-preview-components";

type WorkspaceMediaLibraryPreviewModalProps = {
  item: WorkspaceMediaLibraryItem | null;
  locale: Locale;
  onClose: () => void;
  onVideoRef: (element: HTMLVideoElement | null) => void;
  posterUrl: string | null;
  surface: WorkspaceResolvedMediaSurface | null;
  title: string;
  volume: number;
  onVolumeChange: (nextVolume: number) => void;
};

export function WorkspaceMediaLibraryPreviewModal({
  item,
  locale,
  onClose,
  onVideoRef,
  posterUrl,
  surface,
  title,
  volume,
  onVolumeChange,
}: WorkspaceMediaLibraryPreviewModalProps) {
  if (!item) {
    return null;
  }

  return (
    <div
      className="studio-video-modal is-open"
      role="dialog"
      aria-modal="true"
      aria-label={workspaceText(locale, "Просмотр медиа из медиатеки", "Media library preview")}
    >
      <button
        className="studio-video-modal__backdrop route-close"
        type="button"
        aria-label={workspaceText(locale, "Закрыть просмотр визуала", "Close visual preview")}
        onClick={onClose}
      />
      <div className="studio-video-modal__panel studio-video-modal__panel--video-only" role="document">
        <button className="studio-video-modal__close route-close" type="button" aria-label={workspaceText(locale, "Закрыть просмотр визуала", "Close visual preview")} onClick={onClose}>
          ×
        </button>
        <div className="studio-video-modal__layout studio-video-modal__layout--video-only">
          <div className="studio-video-modal__player-slot">
            {surface?.previewKind === "image" ? (
              <div className="studio-video-modal__player is-image is-cover-media">
                <img
                  src={surface.displayUrl ?? item.previewUrl}
                  alt={title}
                  draggable={false}
                />
              </div>
            ) : (
              <WorkspaceModalVideoPlayer
                autoPlay
                fitMode="cover"
                poster={surface?.posterUrl ?? posterUrl ?? undefined}
                preload={surface?.preloadPolicy ?? "auto"}
                preferMutedAutoplay={surface?.preferMutedAutoplay ?? true}
                src={surface?.viewerUrl ?? item.previewUrl}
                topActions={
                  <a
                    className="studio-video-modal__top-action"
                    href={item.downloadUrl ?? item.previewUrl}
                    download={item.downloadName}
                    aria-label={workspaceText(locale, "Скачать визуал", "Download visual")}
                    title={workspaceText(locale, "Скачать визуал", "Download visual")}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                }
                videoKey={`media-library-preview:${item.itemKey}:${surface?.viewerUrl ?? item.previewUrl}`}
                videoRef={onVideoRef}
                volume={volume}
                onVolumeChange={onVolumeChange}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type WorkspaceVideoPreviewModalProps = {
  canPublish: boolean;
  description: string;
  downloadName: string;
  error: string | null;
  hasDescription: boolean;
  hasHashtags: boolean;
  hashtags: string[];
  isOpen: boolean;
  isProjectPreview: boolean;
  locale: Locale;
  onCanPlay: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onClose: () => void;
  onError: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onLoadedData: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onLoadedMetadata: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onPlay: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onPublish: () => void | Promise<void>;
  onRegenerate: () => void | Promise<void>;
  onRetryPlayback: () => void;
  onVideoRef: (element: HTMLVideoElement | null) => void;
  panelStyle?: CSSProperties;
  preparingTitle: string;
  sourceUrl: string | null;
  statusLabel: string;
  statusLink: string | null;
  statusMeta: string;
  statusTone: string;
  title: string;
  topic: string;
  videoKey: string;
  volume: number;
  onVolumeChange: (nextVolume: number) => void;
};

export function WorkspaceVideoPreviewModal({
  canPublish,
  description,
  downloadName,
  error,
  hasDescription,
  hasHashtags,
  hashtags,
  isOpen,
  isProjectPreview,
  locale,
  onCanPlay,
  onClose,
  onError,
  onLoadedData,
  onLoadedMetadata,
  onPlay,
  onPublish,
  onRegenerate,
  onRetryPlayback,
  onVideoRef,
  panelStyle,
  preparingTitle,
  sourceUrl,
  statusLabel,
  statusLink,
  statusMeta,
  statusTone,
  title,
  topic,
  videoKey,
  volume,
  onVolumeChange,
}: WorkspaceVideoPreviewModalProps) {
  if (!sourceUrl) {
    return null;
  }

  return (
    <div
      className={`studio-video-modal${isOpen ? " is-open" : ""}`}
      role="dialog"
      aria-hidden={!isOpen}
      aria-modal={isOpen ? "true" : undefined}
      aria-labelledby={isProjectPreview ? undefined : "studio-video-modal-title"}
      aria-label={isProjectPreview ? workspaceText(locale, "Просмотр видео проекта", "Project video preview") : undefined}
    >
      <button
        className="studio-video-modal__backdrop route-close"
        type="button"
        aria-label={workspaceText(locale, "Закрыть превью", "Close preview")}
        onClick={onClose}
      />
      <div
        className={`studio-video-modal__panel${isProjectPreview ? " studio-video-modal__panel--video-only" : ""}`}
        role="document"
        style={panelStyle}
      >
        <button className="studio-video-modal__close route-close" type="button" aria-label={workspaceText(locale, "Закрыть превью", "Close preview")} onClick={onClose}>
          ×
        </button>
        <div className={`studio-video-modal__layout${isProjectPreview ? " studio-video-modal__layout--video-only" : ""}`}>
          <div className="studio-video-modal__player-slot">
            <WorkspaceModalVideoPlayer
              autoPlay={isOpen}
              errorOverlay={
                error ? (
                  <div className="studio-video-modal__error" role="alert">
                    <p>{error}</p>
                    <div className="studio-video-modal__error-actions">
                      <button className="studio-video-modal__error-btn" type="button" onClick={onRetryPlayback}>
                        {workspaceText(locale, "Повторить", "Retry")}
                      </button>
                      <a
                        className="studio-video-modal__error-btn"
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {workspaceText(locale, "Открыть напрямую", "Open directly")}
                      </a>
                    </div>
                  </div>
                ) : null
              }
              onCanPlay={onCanPlay}
              onError={onError}
              onLoadedData={onLoadedData}
              onLoadedMetadata={onLoadedMetadata}
              onPlay={onPlay}
              preload="metadata"
              src={sourceUrl}
              topActions={
                isProjectPreview ? null : (
                  <a
                    className="studio-video-modal__top-action"
                    href={sourceUrl}
                    download={downloadName}
                    aria-label={workspaceText(locale, "Скачать видео", "Download video")}
                    title={workspaceText(locale, "Скачать видео", "Download video")}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                )
              }
              videoKey={videoKey}
              videoRef={onVideoRef}
              volume={volume}
              onVolumeChange={onVolumeChange}
            />
          </div>

          {isProjectPreview ? null : (
          <div className="studio-video-modal__sidebar">
            <div className="studio-video-modal__section studio-video-modal__section--hero">
              <div className="studio-video-modal__title-block">
                <p className="studio-video-modal__eyebrow">{workspaceText(locale, "Готово к публикации", "Ready to publish")}</p>
                <strong id="studio-video-modal-title">{title}</strong>
              </div>
              {statusLink ? (
                <a
                  className={`studio-video-modal__header-status is-clickable is-${statusTone}`}
                  href={statusLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="studio-video-modal__header-status-label">{statusLabel}</span>
                  <small>{statusMeta}</small>
                </a>
              ) : (
                <div className={`studio-video-modal__header-status is-${statusTone}`}>
                  <span className="studio-video-modal__header-status-label">{statusLabel}</span>
                  <small>{statusMeta}</small>
                </div>
              )}
            </div>

            <div className="studio-video-modal__section">
              <div className="studio-video-modal__meta">
                <span className="studio-video-modal__label">{workspaceText(locale, "Тема", "Topic")}</span>
                <p className="studio-video-modal__description">{topic || workspaceText(locale, "Без темы", "No topic")}</p>
              </div>
              <div className="studio-video-modal__meta">
                <span className="studio-video-modal__label">{workspaceText(locale, "Заголовок", "Title")}</span>
                <p className="studio-video-modal__description">{title}</p>
              </div>
              {hasDescription ? (
                <div className="studio-video-modal__meta">
                  <span className="studio-video-modal__label">{workspaceText(locale, "Описание", "Description")}</span>
                  <p className="studio-video-modal__description">{description}</p>
                </div>
              ) : null}
              <div className="studio-video-modal__meta">
                <span className="studio-video-modal__label">{workspaceText(locale, "Хэштеги", "Hashtags")}</span>
                {hasHashtags ? (
                  <div className="studio-video-modal__hashtags" aria-label={workspaceText(locale, "Хэштеги", "Hashtags")}>
                    {hashtags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : (
                  <p className="studio-video-modal__description studio-video-modal__description--subtle">
                    {workspaceText(locale, "Хэштеги не добавлены", "No hashtags added")}
                  </p>
                )}
              </div>
            </div>

            <div className="studio-video-modal__actions" aria-label={workspaceText(locale, "Действия с видео", "Video actions")}>
                  <button
                    className="studio-video-modal__action studio-video-modal__action--primary route-button"
                    type="button"
                    disabled={!canPublish}
                    title={canPublish ? workspaceText(locale, "Опубликовать", "Publish") : preparingTitle}
                    onClick={() => void onPublish()}
                  >
                    {workspaceText(locale, "Опубликовать", "Publish")}
                  </button>
                  <button className="studio-video-modal__action route-button" type="button" onClick={() => void onRegenerate()}>
                    {workspaceText(locale, "Перегенерировать", "Regenerate")}
                  </button>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
