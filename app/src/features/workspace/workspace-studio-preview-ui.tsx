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
  const improveLabel = workspaceText(locale, "Улучшить", "Improve");
  const improveSoonLabel = workspaceText(locale, "Улучшить (Скоро)", "Improve (Soon)");
  const improveMobileLabel = improveLabel;
  const isImproveActionDisabled = isEditHideEnabled || !isProjectReadyForActions || isSegmentEditorLoading;
  const shouldHideImproveAction = isEditHideEnabled;
  const editActionDisabledLabel = workspaceText(locale, "Скоро", "Coming soon");

  if (!playbackUrl) {
    return null;
  }

  return isExpanded ? (
    <div className="studio-canvas-preview__generated-actions studio-canvas-preview__generated-actions--expanded">
      <button
        className="studio-canvas-preview__quick-action studio-canvas-preview__quick-action--expanded"
        type="button"
        aria-label={shouldHideImproveAction ? improveSoonLabel : improveLabel}
        title={
          shouldHideImproveAction
            ? editActionDisabledLabel
            : isProjectReadyForActions
              ? improveLabel
              : editActionDisabledLabel
        }
        disabled={isImproveActionDisabled}
        onClick={() => void onOpenSegmentEditor()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m13 7 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>{shouldHideImproveAction ? improveSoonLabel : improveLabel}</span>
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
        aria-label={shouldHideImproveAction ? workspaceText(locale, "Скоро", "Soon") : improveMobileLabel}
        title={
          shouldHideImproveAction
            ? workspaceText(locale, "Скоро", "Soon")
            : isProjectReadyForActions
              ? improveMobileLabel
              : editActionDisabledLabel
        }
        disabled={isImproveActionDisabled}
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
    <span className="studio-generation-visual" aria-hidden="true">
      <span className="studio-generation-visual__ambient"></span>
      <span className="studio-generation-visual__orbit studio-generation-visual__orbit--outer">
        <i></i>
        <i></i>
      </span>
      <span className="studio-generation-visual__orbit studio-generation-visual__orbit--inner">
        <i></i>
      </span>
      <span className="studio-generation-visual__echo studio-generation-visual__echo--left"></span>
      <span className="studio-generation-visual__echo studio-generation-visual__echo--right"></span>
      <span className="studio-generation-visual__core">
        <img
          src="/studio/generation-render-core.webp"
          alt=""
          width="514"
          height="900"
          decoding="async"
          draggable={false}
        />
        <span className="studio-generation-visual__scan"></span>
        <span className="studio-generation-visual__glint"></span>
      </span>
      <span className="studio-generation-visual__beam"></span>
      <span className="studio-generation-visual__particle studio-generation-visual__particle--one"></span>
      <span className="studio-generation-visual__particle studio-generation-visual__particle--two"></span>
      <span className="studio-generation-visual__particle studio-generation-visual__particle--three"></span>
    </span>
    <span className="studio-canvas-preview__generation-kicker">
      <i aria-hidden="true"></i>
      {locale === "en" ? "AI render in progress" : "AI-рендер в процессе"}
    </span>
    <strong>{locale === "en" ? "Creating your Short" : "Создаём ваш Shorts"}</strong>
    <span className="studio-canvas-preview__generation-copy">
      {locale === "en"
        ? "Assembling scenes, voiceover and subtitles"
        : "Собираем сцены, озвучку и субтитры"}
    </span>
    <span className="studio-canvas-preview__generation-progress" aria-hidden="true">
      <i></i>
      <b></b>
      <b></b>
      <b></b>
    </span>
  </div>
);
