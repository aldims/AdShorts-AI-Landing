import type { Locale } from "../../lib/i18n";
import { workspaceText } from "./workspace-page-model";

type WorkspaceStudioInlinePreviewActionsOptions = {
  downloadName: string;
  isExpanded: boolean;
  isProjectReadyForActions: boolean;
  isSegmentEditorLoading: boolean;
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
  isSegmentEditorLoading,
  locale,
  onDismiss,
  onOpenSegmentEditor,
  onPublish,
  playbackUrl,
  projectPreparingTitle,
}: WorkspaceStudioInlinePreviewActionsOptions) => {
  if (!playbackUrl) {
    return null;
  }

  return isExpanded ? (
    <div className="studio-canvas-preview__generated-actions studio-canvas-preview__generated-actions--expanded">
      <button
        className="studio-canvas-preview__quick-action studio-canvas-preview__quick-action--expanded"
        type="button"
        aria-label={workspaceText(locale, "Улучшить", "Improve")}
        title={
          isProjectReadyForActions
            ? workspaceText(locale, "Улучшить", "Improve")
            : projectPreparingTitle
        }
        disabled={!isProjectReadyForActions || isSegmentEditorLoading}
        onClick={() => void onOpenSegmentEditor()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m13 7 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>{workspaceText(locale, "Улучшить", "Improve")}</span>
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
        aria-label={workspaceText(locale, "Редактировать сцены", "Edit scenes")}
        title={
          isProjectReadyForActions
            ? workspaceText(locale, "Редактировать сцены", "Edit scenes")
            : projectPreparingTitle
        }
        disabled={!isProjectReadyForActions || isSegmentEditorLoading}
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
  <div className="studio-canvas-preview__generation-status">
    <span className="studio-segment-editor__generation-spinner" aria-hidden="true"></span>
    <strong>{locale === "en" ? "Generating Shorts" : "Генерируем Shorts"}</strong>
    <span>{locale === "en" ? "Assembling segments into a video" : "Собираем сегменты в видео"}</span>
  </div>
);
