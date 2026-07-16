import type { Locale } from "../../lib/i18n";
import { workspaceText } from "./workspace-page-model";

type WorkspaceStudioInlinePreviewActionsOptions = {
  downloadName: string;
  isExpanded: boolean;
  isProjectReadyForActions: boolean;
  isSegmentEditorLoading?: boolean;
  isEditHideEnabled?: boolean;
  locale: Locale;
  onDismiss: () => void;
  onOpenSegmentEditor: () => void | Promise<void>;
  onPublish: () => void | Promise<void>;
  playbackUrl: string | null;
  projectPreparingTitle: string;
};

export const renderWorkspaceStudioInlinePreviewActions = ({
  downloadName,
  isExpanded,
  isProjectReadyForActions,
  isSegmentEditorLoading = false,
  isEditHideEnabled = false,
  locale,
  onDismiss,
  onOpenSegmentEditor,
  onPublish,
  playbackUrl,
  projectPreparingTitle,
}: WorkspaceStudioInlinePreviewActionsOptions) => {
  const editLabel = workspaceText(locale, "Редактировать", "Edit");
  const editSoonLabel = workspaceText(locale, "Редактировать (Скоро)", "Edit (Soon)");
  const editMobileLabel = editLabel;
  const isEditActionDisabled = isEditHideEnabled || !isProjectReadyForActions || isSegmentEditorLoading;
  const shouldHideEditAction = isEditHideEnabled;
  const editActionDisabledLabel = workspaceText(locale, "Скоро", "Coming soon");

  if (!playbackUrl) {
    return null;
  }

  return isExpanded ? (
    <div className="studio-canvas-preview__generated-actions studio-canvas-preview__generated-actions--expanded">
      <button
        className="studio-canvas-preview__quick-action studio-canvas-preview__quick-action--expanded"
        type="button"
        aria-label={shouldHideEditAction ? editSoonLabel : editLabel}
        title={
          shouldHideEditAction
            ? editActionDisabledLabel
            : isProjectReadyForActions
              ? editLabel
              : editActionDisabledLabel
        }
        disabled={isEditActionDisabled}
        onClick={() => void onOpenSegmentEditor()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m13 7 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>{shouldHideEditAction ? editSoonLabel : editLabel}</span>
      </button>
      <button
        className="studio-canvas-preview__quick-action studio-canvas-preview__quick-action--expanded"
        type="button"
        aria-label={workspaceText(locale, "Опубликовать", "Publish")}
        title={isProjectReadyForActions ? workspaceText(locale, "Опубликовать", "Publish") : projectPreparingTitle}
        disabled={!isProjectReadyForActions}
        onClick={() => void onPublish()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 19V5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="m6.5 10.5 5.5-5.5 5.5 5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{workspaceText(locale, "Опубликовать", "Publish")}</span>
      </button>
      <a
        className="studio-canvas-preview__quick-action studio-canvas-preview__quick-action--expanded"
        href={playbackUrl}
        download={downloadName}
        aria-label={workspaceText(locale, "Скачать", "Download")}
        title={workspaceText(locale, "Скачать", "Download")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{workspaceText(locale, "Скачать", "Download")}</span>
      </a>
      <button
        className="studio-canvas-preview__quick-action studio-canvas-preview__quick-action--close"
        type="button"
        aria-label={workspaceText(locale, "Закрыть видео", "Close video")}
        title={workspaceText(locale, "Закрыть видео", "Close video")}
        onClick={onDismiss}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  ) : (
    <div className="studio-canvas-preview__generated-actions studio-canvas-preview__generated-actions--compact">
      <button
        className="studio-canvas-preview__quick-action"
        type="button"
        aria-label={shouldHideEditAction ? workspaceText(locale, "Скоро", "Soon") : editMobileLabel}
        title={
          shouldHideEditAction
            ? workspaceText(locale, "Скоро", "Soon")
            : isProjectReadyForActions
              ? editMobileLabel
              : editActionDisabledLabel
        }
        disabled={isEditActionDisabled}
        onClick={() => void onOpenSegmentEditor()}
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
        title={isProjectReadyForActions ? workspaceText(locale, "Опубликовать в YouTube", "Publish to YouTube") : projectPreparingTitle}
        disabled={!isProjectReadyForActions}
        onClick={() => void onPublish()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 19V5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="m6.5 10.5 5.5-5.5 5.5 5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <a
        className="studio-canvas-preview__quick-action"
        href={playbackUrl}
        download={downloadName}
        aria-label={workspaceText(locale, "Скачать", "Download")}
        title={workspaceText(locale, "Скачать", "Download")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
      <button
        className="studio-canvas-preview__quick-action studio-canvas-preview__quick-action--close"
        type="button"
        aria-label={workspaceText(locale, "Закрыть видео", "Close video")}
        title={workspaceText(locale, "Закрыть видео", "Close video")}
        onClick={onDismiss}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
};

export const renderWorkspaceStudioShortsGenerationStatus = (locale: Locale) => (
  <>
    <video
      className="studio-generation-background"
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      poster="/studio/generation-background-poster.webp"
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src="/studio/generation-background.mp4" type="video/mp4" />
    </video>
    <div className="studio-canvas-preview__generation-status">
      <span className="studio-canvas-preview__generation-kicker">
        {locale === "en" ? "AI render in progress" : "AI-рендер в процессе"}
      </span>
      <strong>{locale === "en" ? "Creating your Short" : "Создаём ваш Shorts"}</strong>
      <span className="studio-canvas-preview__generation-copy">
        {locale === "en"
          ? "Assembling scenes, voiceover and subtitles"
          : "Собираем сцены, озвучку и субтитры"}
      </span>
    </div>
  </>
);
