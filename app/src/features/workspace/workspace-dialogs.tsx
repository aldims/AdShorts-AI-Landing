import { createPortal } from "react-dom";
import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Locale } from "../../lib/i18n";
import {
  formatWorkspaceMediaLibraryCreatedAt,
  getWorkspaceProjectDisplayTitle,
  type WorkspaceMediaLibraryItem,
} from "../../lib/workspaceMediaLibrary";
import {
  getWorkspaceLocalExampleGoalCopy,
  workspaceLocalExampleGoalOptions,
  workspaceText,
  type WorkspaceLocalExampleGoal,
  type WorkspaceLocalExampleSource,
} from "./workspace-page-model";
import type { WorkspaceProject } from "./workspace-types";

const workspaceDialogFocusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=\"hidden\"])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable=\"true\"]",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

const getWorkspaceDialogFocusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(workspaceDialogFocusableSelector)).filter(
    (element) => !element.closest('[aria-hidden="true"]'),
  );

const useWorkspaceDialogFocusManagement = (isOpen: boolean): RefObject<HTMLDivElement | null> => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return undefined;
    }

    const returnFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    if (!panel) {
      return undefined;
    }

    const initialFocusTarget =
      panel.querySelector<HTMLElement>("[data-dialog-initial-focus]:not([disabled])") ??
      getWorkspaceDialogFocusableElements(panel)[0] ??
      panel;
    initialFocusTarget.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getWorkspaceDialogFocusableElements(panel);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const firstFocusableElement = focusableElements[0]!;
      const lastFocusableElement = focusableElements[focusableElements.length - 1]!;
      const activeElement = document.activeElement;
      const focusIsOutsidePanel = !(activeElement instanceof Node) || !panel.contains(activeElement);

      if (event.shiftKey && (focusIsOutsidePanel || activeElement === firstFocusableElement)) {
        event.preventDefault();
        lastFocusableElement.focus({ preventScroll: true });
        return;
      }

      if (!event.shiftKey && (focusIsOutsidePanel || activeElement === lastFocusableElement)) {
        event.preventDefault();
        firstFocusableElement.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (returnFocusTarget?.isConnected && !returnFocusTarget.hasAttribute("disabled")) {
        returnFocusTarget.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  return panelRef;
};

type WorkspaceLocalExampleModalProps = {
  isOpen: boolean;
  isSaving: boolean;
  locale: Locale;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  saveError: string | null;
  selectedGoal: WorkspaceLocalExampleGoal;
  setSelectedGoal: Dispatch<SetStateAction<WorkspaceLocalExampleGoal>>;
  source: WorkspaceLocalExampleSource | null;
};

export function WorkspaceLocalExampleModal({
  isOpen,
  isSaving,
  locale,
  onClose,
  onSave,
  saveError,
  selectedGoal,
  setSelectedGoal,
  source,
}: WorkspaceLocalExampleModalProps) {
  if (!isOpen || !source || typeof document === "undefined") {
    return null;
  }

  const selectedGoalOption =
    workspaceLocalExampleGoalOptions.find((option) => option.id === selectedGoal) ??
    workspaceLocalExampleGoalOptions[0]!;
  const selectedGoalOptionCopy = getWorkspaceLocalExampleGoalCopy(selectedGoalOption, locale);

  return createPortal(
    <div className="studio-local-example-modal" role="dialog" aria-modal="true" aria-labelledby="studio-local-example-title">
      <button
        className="studio-local-example-modal__backdrop route-close"
        type="button"
        aria-label={workspaceText(locale, "Закрыть окно добавления в примеры", "Close add-to-examples dialog")}
        onClick={onClose}
      />

      <div className="studio-local-example-modal__panel" role="document">
        <button
          className="studio-local-example-modal__close route-close"
          type="button"
          aria-label={workspaceText(locale, "Закрыть окно добавления в примеры", "Close add-to-examples dialog")}
          onClick={onClose}
          disabled={isSaving}
        >
          ×
        </button>

        <div className="studio-local-example-modal__hero">
          <span className="studio-local-example-modal__eyebrow">{workspaceText(locale, "Локальные примеры", "Local examples")}</span>
          <strong id="studio-local-example-title">{workspaceText(locale, "Добавить видео в примеры", "Add video to examples")}</strong>
          <p>
            {workspaceText(
              locale,
              "Видео сохранится локально для вашего аккаунта и останется в примерах даже после удаления проекта.",
              "The video will be saved locally for your account and remain in examples even after the project is deleted.",
            )}
          </p>
        </div>

        <div className="studio-local-example-modal__summary">
          <span>{workspaceText(locale, "Заголовок видео", "Video title")}</span>
          <strong>{source.title}</strong>
          <p>{source.prompt || workspaceText(locale, "Тема будет сохранена из выбранного проекта.", "The topic will be saved from the selected project.")}</p>
        </div>

        <div className="studio-local-example-modal__section">
          <div className="studio-local-example-modal__section-head">
            <strong>{workspaceText(locale, "Куда добавить", "Where to add")}</strong>
            <span>{workspaceText(locale, "При нажатии «Использовать» в примерах в студию подставится эта тема из базы.", "When Use is clicked in examples, this topic will be inserted into the studio from the database.")}</span>
          </div>

          <div className="studio-local-example-modal__goal-grid" role="list" aria-label={workspaceText(locale, "Раздел примеров", "Examples section")}>
            {workspaceLocalExampleGoalOptions.map((option) => {
              const optionCopy = getWorkspaceLocalExampleGoalCopy(option, locale);
              return (
                <button
                  key={option.id}
                  className={`studio-local-example-modal__goal${selectedGoal === option.id ? " is-selected" : ""}`}
                  type="button"
                  onClick={() => setSelectedGoal(option.id)}
                >
                  <strong>{optionCopy.label}</strong>
                  <span>{optionCopy.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="studio-local-example-modal__hint">
          {workspaceText(locale, "Раздел", "Section")}: <strong>{selectedGoalOptionCopy.label}</strong>. {selectedGoalOptionCopy.description}
        </p>

        {saveError ? (
          <p className="studio-local-example-modal__error" role="alert">
            {saveError}
          </p>
        ) : null}

        <div className="studio-local-example-modal__actions">
          <button
            className="studio-local-example-modal__action studio-local-example-modal__action--secondary"
            type="button"
            onClick={onClose}
            disabled={isSaving}
          >
            {workspaceText(locale, "Отмена", "Cancel")}
          </button>
          <button
            className="studio-local-example-modal__action studio-local-example-modal__action--primary"
            type="button"
            onClick={() => void onSave()}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <span className="studio-local-example-modal__spinner" aria-hidden="true"></span>
                {workspaceText(locale, "Сохраняем...", "Saving...")}
              </>
            ) : (
              workspaceText(locale, "Добавить в примеры", "Add to examples")
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type WorkspaceProjectDeleteModalProps = {
  error: string | null;
  isSubmitting: boolean;
  locale: Locale;
  onClose: () => void;
  onDelete: () => void | Promise<void>;
  project: WorkspaceProject | null;
  projectCount: number;
};

export function WorkspaceProjectDeleteModal({
  error,
  isSubmitting,
  locale,
  onClose,
  onDelete,
  project,
  projectCount,
}: WorkspaceProjectDeleteModalProps) {
  if (!project || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="workspace-confirm-modal" role="dialog" aria-modal="true" aria-label={workspaceText(locale, "Удаление проекта", "Project deletion")}>
      <button
        className="workspace-confirm-modal__backdrop route-close"
        type="button"
        aria-label={workspaceText(locale, "Закрыть подтверждение удаления проекта", "Close project deletion confirmation")}
        onClick={onClose}
      />
      <div className="workspace-confirm-modal__panel" role="document">
        <button
          className="workspace-confirm-modal__close route-close"
          type="button"
          aria-label={workspaceText(locale, "Закрыть подтверждение удаления проекта", "Close project deletion confirmation")}
          onClick={onClose}
          disabled={isSubmitting}
        >
          ×
        </button>

        <div className="workspace-confirm-modal__header">
          <div className="workspace-confirm-modal__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 7h16" strokeLinecap="round" />
              <path d="M9 3h6" strokeLinecap="round" />
              <path d="M10 11v6" strokeLinecap="round" />
              <path d="M14 11v6" strokeLinecap="round" />
              <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="workspace-confirm-modal__copy">
            <h2 className="workspace-confirm-modal__title">
              {projectCount > 1
                ? workspaceText(locale, "Удалить проекты?", "Delete projects?")
                : workspaceText(locale, "Удалить проект?", "Delete project?")}
            </h2>
            {projectCount > 1 ? (
              <p className="workspace-confirm-modal__message">
                {workspaceText(
                  locale,
                  `Будет удалено проектов: ${projectCount}. Действие нельзя отменить.`,
                  `${projectCount} projects will be deleted. This cannot be undone.`,
                )}
              </p>
            ) : null}
          </div>
        </div>

        <p className="workspace-confirm-modal__project">
          {getWorkspaceProjectDisplayTitle(project)}
        </p>

        {error ? (
          <p className="workspace-confirm-modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="workspace-confirm-modal__actions">
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--secondary"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {workspaceText(locale, "Отмена", "Cancel")}
          </button>
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--danger"
            type="button"
            onClick={() => void onDelete()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="workspace-confirm-modal__spinner" aria-hidden="true"></span>
                {workspaceText(locale, "Удаляем...", "Deleting...")}
              </>
            ) : (
              workspaceText(locale, "Удалить", "Delete")
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type WorkspaceMediaLibraryDeleteConfirmModalProps = {
  error: string | null;
  isSubmitting: boolean;
  item: WorkspaceMediaLibraryItem | null;
  itemLabel: string;
  locale: Locale;
  onClose: () => void;
  onDelete: () => void | Promise<void>;
};

export function WorkspaceMediaLibraryDeleteConfirmModal({
  error,
  isSubmitting,
  item,
  itemLabel,
  locale,
  onClose,
  onDelete,
}: WorkspaceMediaLibraryDeleteConfirmModalProps) {
  if (!item || typeof document === "undefined") {
    return null;
  }

  const isReference = item.kind === "character_reference" || item.kind === "scene_reference";
  const hasDurableAsset = typeof item.assetId === "number" && item.assetId > 0;
  const createdAtLabel = formatWorkspaceMediaLibraryCreatedAt(item.createdAt, locale);
  const title = isReference
    ? workspaceText(locale, "Удалить референс?", "Delete reference?")
    : hasDurableAsset
      ? workspaceText(locale, "Удалить media asset?", "Delete media asset?")
      : workspaceText(locale, "Скрыть карточку?", "Hide card?");
  const message = isReference
    ? workspaceText(
      locale,
      "Референс будет удалён из медиатеки. Исходный media asset не удаляется.",
      "The reference will be removed from the media library. The source media asset is not deleted.",
    )
    : hasDurableAsset
      ? workspaceText(
        locale,
        "Будет удалён media asset из медиатеки. Это действие нельзя отменить.",
        "The media asset will be deleted from the media library. This cannot be undone.",
      )
      : workspaceText(
        locale,
        "Карточка будет скрыта только в этом браузере. Media asset не удаляется.",
        "This card will be hidden only in this browser. The media asset is not deleted.",
      );

  return createPortal(
    <div className="workspace-confirm-modal" role="dialog" aria-modal="true" aria-label={workspaceText(locale, "Удаление из медиатеки", "Media library deletion")}>
      <button
        className="workspace-confirm-modal__backdrop route-close"
        type="button"
        aria-label={workspaceText(locale, "Закрыть подтверждение удаления из медиатеки", "Close media library deletion confirmation")}
        onClick={onClose}
        disabled={isSubmitting}
      />
      <div className="workspace-confirm-modal__panel" role="document">
        <button
          className="workspace-confirm-modal__close route-close"
          type="button"
          aria-label={workspaceText(locale, "Закрыть подтверждение удаления из медиатеки", "Close media library deletion confirmation")}
          onClick={onClose}
          disabled={isSubmitting}
        >
          ×
        </button>

        <div className="workspace-confirm-modal__header">
          <div className="workspace-confirm-modal__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 7h16" strokeLinecap="round" />
              <path d="M9 3h6" strokeLinecap="round" />
              <path d="M10 11v6" strokeLinecap="round" />
              <path d="M14 11v6" strokeLinecap="round" />
              <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="workspace-confirm-modal__copy">
            <h2 className="workspace-confirm-modal__title">{title}</h2>
            <p className="workspace-confirm-modal__message">{message}</p>
          </div>
        </div>

        <p className="workspace-confirm-modal__project">
          {itemLabel} · {createdAtLabel} · {workspaceText(locale, `сегмент ${item.segmentNumber}`, `segment ${item.segmentNumber}`)}
        </p>

        {error ? (
          <p className="workspace-confirm-modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="workspace-confirm-modal__actions">
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--secondary"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {workspaceText(locale, "Отмена", "Cancel")}
          </button>
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--danger"
            type="button"
            onClick={() => void onDelete()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="workspace-confirm-modal__spinner" aria-hidden="true"></span>
                {workspaceText(locale, "Удаляем...", "Deleting...")}
              </>
            ) : (
              workspaceText(locale, "Удалить", "Delete")
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type WorkspaceSegmentEditorResetConfirmModalProps = {
  changeItems: readonly { key: string; label: string }[];
  changesCount: number;
  hasResettableChanges: boolean;
  isBusy: boolean;
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
  onConfirm: () => void;
};

export function WorkspaceSegmentEditorResetConfirmModal({
  changeItems,
  changesCount,
  hasResettableChanges,
  isBusy,
  isOpen,
  locale,
  onClose,
  onConfirm,
}: WorkspaceSegmentEditorResetConfirmModalProps) {
  const panelRef = useWorkspaceDialogFocusManagement(isOpen);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="workspace-confirm-modal" role="dialog" aria-modal="true" aria-label={workspaceText(locale, "Сброс изменений", "Reset changes")}>
      <button
        className="workspace-confirm-modal__backdrop route-close"
        type="button"
        aria-label={workspaceText(locale, "Закрыть подтверждение сброса изменений", "Close reset changes confirmation")}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="workspace-confirm-modal__panel workspace-confirm-modal__panel--reset"
        role="document"
        tabIndex={-1}
      >
        <button
          className="workspace-confirm-modal__close route-close"
          type="button"
          aria-label={workspaceText(locale, "Закрыть подтверждение сброса изменений", "Close reset changes confirmation")}
          onClick={onClose}
        >
          ×
        </button>

        <div className="workspace-confirm-modal__header">
          <div className="workspace-confirm-modal__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M20 11a8 8 0 1 1-2.34-5.66L20 8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 4v4h-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="workspace-confirm-modal__copy">
            <h2 className="workspace-confirm-modal__title">
              {workspaceText(locale, "Сбросить все изменения?", "Reset all changes?")}
            </h2>
            <p className="workspace-confirm-modal__message">
              {workspaceText(
                locale,
                "Черновик вернётся к состоянию исходного видео. Текст, визуалы, порядок сцен, настройки и бренд будут восстановлены.",
                "The draft will return to the original video's state. Text, visuals, scene order, settings, and branding will be restored.",
              )}
            </p>
          </div>
        </div>

        <p className="workspace-confirm-modal__project">
          {workspaceText(
            locale,
            `Будет отменено изменений: ${changesCount}`,
            `${changesCount} changes will be reset`,
          )}
        </p>

        <div className="workspace-confirm-modal__change-list">
          <span className="workspace-confirm-modal__change-list-title">
            {workspaceText(locale, "Список изменений", "Changes")}
          </span>
          <ul>
            {changeItems.map((item) => (
              <li key={item.key}>
                <span aria-hidden="true"></span>
                <strong>{item.label}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="workspace-confirm-modal__actions">
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--secondary"
            type="button"
            data-dialog-initial-focus
            onClick={onClose}
          >
            {workspaceText(locale, "Отмена", "Cancel")}
          </button>
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--danger"
            type="button"
            onClick={onConfirm}
            disabled={isBusy || !hasResettableChanges}
          >
            {workspaceText(locale, "Сбросить", "Reset")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type WorkspaceSegmentEditorStartFreshConfirmModalProps = {
  isBusy: boolean;
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
  onConfirm: () => void;
};

export function WorkspaceSegmentEditorStartFreshConfirmModal({
  isBusy,
  isOpen,
  locale,
  onClose,
  onConfirm,
}: WorkspaceSegmentEditorStartFreshConfirmModalProps) {
  const panelRef = useWorkspaceDialogFocusManagement(isOpen);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="workspace-confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-label={workspaceText(locale, "Новый проект по сценам", "New scenes project")}
    >
      <button
        className="workspace-confirm-modal__backdrop route-close"
        type="button"
        aria-label={workspaceText(locale, "Закрыть подтверждение", "Close confirmation")}
        onClick={onClose}
      />
      <div ref={panelRef} className="workspace-confirm-modal__panel" role="document" tabIndex={-1}>
        <button
          className="workspace-confirm-modal__close route-close"
          type="button"
          aria-label={workspaceText(locale, "Закрыть подтверждение", "Close confirmation")}
          onClick={onClose}
          disabled={isBusy}
        >
          ×
        </button>

        <div className="workspace-confirm-modal__header">
          <div className="workspace-confirm-modal__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              <path d="M4 4h16v16H4z" strokeLinejoin="round" opacity=".5" />
            </svg>
          </div>
          <div className="workspace-confirm-modal__copy">
            <h2 className="workspace-confirm-modal__title">
              {workspaceText(locale, "Начать новый проект?", "Start a new project?")}
            </h2>
            <p className="workspace-confirm-modal__message">
              {workspaceText(
                locale,
                "Откроется чистый режим «По сценам». Все несохранённые изменения текущего монтажа будут потеряны.",
                "A clean By scenes workspace will open. All unsaved changes in the current edit will be lost.",
              )}
            </p>
          </div>
        </div>

        <div className="workspace-confirm-modal__actions">
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--secondary"
            type="button"
            data-dialog-initial-focus
            onClick={onClose}
            disabled={isBusy}
          >
            {workspaceText(locale, "Отмена", "Cancel")}
          </button>
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--danger"
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
          >
            {workspaceText(locale, "Начать заново", "Start fresh")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type WorkspaceSegmentEditorDeleteConfirmModalProps = {
  canDelete: boolean;
  isBusy: boolean;
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
  onConfirm: () => void;
  segmentSummary: string;
};

export function WorkspaceSegmentEditorDeleteConfirmModal({
  canDelete,
  isBusy,
  isOpen,
  locale,
  onClose,
  onConfirm,
  segmentSummary,
}: WorkspaceSegmentEditorDeleteConfirmModalProps) {
  const panelRef = useWorkspaceDialogFocusManagement(isOpen);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="workspace-confirm-modal" role="dialog" aria-modal="true" aria-label={workspaceText(locale, "Удаление сцены", "Scene deletion")}>
      <button
        className="workspace-confirm-modal__backdrop route-close"
        type="button"
        aria-label={workspaceText(locale, "Закрыть подтверждение удаления сцены", "Close scene deletion confirmation")}
        onClick={onClose}
      />
      <div ref={panelRef} className="workspace-confirm-modal__panel" role="document" tabIndex={-1}>
        <button
          className="workspace-confirm-modal__close route-close"
          type="button"
          aria-label={workspaceText(locale, "Закрыть подтверждение удаления сцены", "Close scene deletion confirmation")}
          onClick={onClose}
        >
          ×
        </button>

        <div className="workspace-confirm-modal__header">
          <div className="workspace-confirm-modal__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 7h16" strokeLinecap="round" />
              <path d="M9 3h6" strokeLinecap="round" />
              <path d="M10 11v6" strokeLinecap="round" />
              <path d="M14 11v6" strokeLinecap="round" />
              <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="workspace-confirm-modal__copy">
            <h2 className="workspace-confirm-modal__title">
              {workspaceText(locale, "Удалить сцену?", "Delete scene?")}
            </h2>
            <p className="workspace-confirm-modal__message">
              {workspaceText(
                locale,
                "Сцена исчезнет из текущего монтажа, а тайминг следующих сцен пересчитается.",
                "The scene will be removed from the current edit and following scene timing will be recalculated.",
              )}
            </p>
          </div>
        </div>

        <p className="workspace-confirm-modal__project">
          {segmentSummary}
        </p>

        <div className="workspace-confirm-modal__actions">
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--secondary"
            type="button"
            data-dialog-initial-focus
            onClick={onClose}
          >
            {workspaceText(locale, "Отмена", "Cancel")}
          </button>
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--danger"
            type="button"
            onClick={onConfirm}
            disabled={isBusy || !canDelete}
          >
            {workspaceText(locale, "Удалить", "Delete")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type WorkspaceSegmentEditorInfographicDeleteConfirmModalProps = {
  infographicText: string;
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
  onConfirm: () => void;
  segmentNumber: number;
};

export function WorkspaceSegmentEditorInfographicDeleteConfirmModal({
  infographicText,
  isOpen,
  locale,
  onClose,
  onConfirm,
  segmentNumber,
}: WorkspaceSegmentEditorInfographicDeleteConfirmModalProps) {
  const panelRef = useWorkspaceDialogFocusManagement(isOpen);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  const titleId = "workspace-infographic-delete-title";
  const descriptionId = "workspace-infographic-delete-description";

  return createPortal(
    <div
      className="workspace-confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <button
        className="workspace-confirm-modal__backdrop route-close"
        type="button"
        aria-label={workspaceText(
          locale,
          "Закрыть подтверждение удаления инфографики",
          "Close infographic deletion confirmation",
        )}
        onClick={onClose}
      />
      <div ref={panelRef} className="workspace-confirm-modal__panel" role="document" tabIndex={-1}>
        <button
          className="workspace-confirm-modal__close route-close"
          type="button"
          aria-label={workspaceText(
            locale,
            "Закрыть подтверждение удаления инфографики",
            "Close infographic deletion confirmation",
          )}
          onClick={onClose}
        >
          ×
        </button>

        <div className="workspace-confirm-modal__header">
          <div className="workspace-confirm-modal__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 7h16" strokeLinecap="round" />
              <path d="M9 3h6" strokeLinecap="round" />
              <path d="M10 11v6" strokeLinecap="round" />
              <path d="M14 11v6" strokeLinecap="round" />
              <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="workspace-confirm-modal__copy">
            <h2 className="workspace-confirm-modal__title" id={titleId}>
              {workspaceText(locale, "Удалить инфографику?", "Delete infographic?")}
            </h2>
            <p className="workspace-confirm-modal__message" id={descriptionId}>
              {workspaceText(
                locale,
                "Слой исчезнет из этой сцены. Кредиты за его создание не возвращаются.",
                "The layer will be removed from this scene. Credits spent on its creation are not refunded.",
              )}
            </p>
          </div>
        </div>

        <p className="workspace-confirm-modal__project">
          {workspaceText(locale, `Сцена ${segmentNumber}`, `Scene ${segmentNumber}`)}
          {infographicText ? ` · «${infographicText}»` : ""}
        </p>

        <div className="workspace-confirm-modal__actions">
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--secondary"
            type="button"
            data-dialog-initial-focus
            onClick={onClose}
          >
            {workspaceText(locale, "Отмена", "Cancel")}
          </button>
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--danger"
            type="button"
            onClick={onConfirm}
          >
            {workspaceText(locale, "Удалить", "Delete")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type WorkspaceSegmentEditorVoiceoverGenerationRequiredModalProps = {
  disabledReason: string | null;
  generateCostLabel?: string;
  isGenerating: boolean;
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
  onGenerate: () => void;
};

export function WorkspaceSegmentEditorVoiceoverGenerationRequiredModal({
  disabledReason,
  generateCostLabel,
  isGenerating,
  isOpen,
  locale,
  onClose,
  onGenerate,
}: WorkspaceSegmentEditorVoiceoverGenerationRequiredModalProps) {
  const panelRef = useWorkspaceDialogFocusManagement(isOpen);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="workspace-confirm-modal" role="dialog" aria-modal="true" aria-label={workspaceText(locale, "Требуется озвучка", "Voiceover required")}>
      <button
        className="workspace-confirm-modal__backdrop route-close"
        type="button"
        aria-label={workspaceText(locale, "Закрыть окно с предупреждением о озвучке", "Close voiceover warning")}
        onClick={onClose}
      />
      <div ref={panelRef} className="workspace-confirm-modal__panel" role="document" tabIndex={-1}>
        <button
          className="workspace-confirm-modal__close route-close"
          type="button"
          aria-label={workspaceText(locale, "Закрыть окно с предупреждением о озвучке", "Close voiceover warning")}
          onClick={onClose}
        >
          ×
        </button>

        <div className="workspace-confirm-modal__header">
          <div className="workspace-confirm-modal__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 4 4 20h16L12 4Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 9v4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
          </div>
          <div className="workspace-confirm-modal__copy">
            <h2 className="workspace-confirm-modal__title">
              {workspaceText(locale, "Озвучка некоторых сцен еще не сгенерирована", "Voiceover for some scenes has not been generated")}
            </h2>
            <p className="workspace-confirm-modal__message">
              {workspaceText(
                locale,
                "Для предварительного просмотра сгенерируйте озвучку.",
                "Generate voiceover to enable preview playback.",
              )}
            </p>
            {disabledReason ? <p className="workspace-confirm-modal__message" role="alert">{disabledReason}</p> : null}
          </div>
        </div>

        <div className="workspace-confirm-modal__actions">
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--secondary"
            type="button"
            data-dialog-initial-focus
            onClick={onClose}
          >
            {workspaceText(locale, "Позже", "Later")}
          </button>
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--primary"
            type="button"
            disabled={isGenerating || Boolean(disabledReason)}
            onClick={onGenerate}
          >
            {isGenerating ? (
              <>
                <span className="workspace-confirm-modal__spinner" aria-hidden="true"></span>
                {workspaceText(locale, "Генерируем озвучку...", "Generating voiceover...")}
              </>
            ) : (
              workspaceText(
                locale,
                generateCostLabel ? `Сгенерировать озвучку за ${generateCostLabel}` : "Сгенерировать озвучку",
                generateCostLabel ? `Generate voiceover for ${generateCostLabel}` : "Generate voiceover",
              )
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type WorkspaceSegmentEditorBulkSceneSoundModalProps = {
  completedCount: number;
  failedCount: number;
  isGenerating: boolean;
  isOpen: boolean;
  locale: Locale;
  onClose: () => void;
  onGenerate: () => void;
  sceneCount: number;
  totalCredits: number;
};

export function WorkspaceSegmentEditorBulkSceneSoundModal({
  completedCount,
  failedCount,
  isGenerating,
  isOpen,
  locale,
  onClose,
  onGenerate,
  sceneCount,
  totalCredits,
}: WorkspaceSegmentEditorBulkSceneSoundModalProps) {
  const panelRef = useWorkspaceDialogFocusManagement(isOpen);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  const processedCount = completedCount + failedCount;
  const progressPercent = sceneCount > 0 ? Math.min(100, (processedCount / sceneCount) * 100) : 0;

  return createPortal(
    <div
      className="workspace-confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-bulk-scene-sound-title"
    >
      <button
        className="workspace-confirm-modal__backdrop route-close"
        type="button"
        aria-label={workspaceText(locale, "Закрыть массовую генерацию звуков", "Close bulk sound generation")}
        onClick={onClose}
        disabled={isGenerating}
      />
      <div
        ref={panelRef}
        className="workspace-confirm-modal__panel workspace-confirm-modal__panel--bulk-sound"
        role="document"
        tabIndex={-1}
      >
        <button
          className="workspace-confirm-modal__close route-close"
          type="button"
          aria-label={workspaceText(locale, "Закрыть массовую генерацию звуков", "Close bulk sound generation")}
          onClick={onClose}
          disabled={isGenerating}
        >
          ×
        </button>

        <div className="workspace-confirm-modal__header">
          <div className="workspace-confirm-modal__icon workspace-confirm-modal__icon--sound" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 12h3l4-4v8l-4-4H4Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 9.5c.8.7 1.2 1.5 1.2 2.5s-.4 1.8-1.2 2.5M18 7c1.5 1.3 2.3 3 2.3 5s-.8 3.7-2.3 5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="workspace-confirm-modal__copy">
            <h2 className="workspace-confirm-modal__title" id="workspace-bulk-scene-sound-title">
              {workspaceText(locale, "Создать звуки для всех сцен?", "Create sounds for all scenes?")}
            </h2>
            <p className="workspace-confirm-modal__message">
              {workspaceText(
                locale,
                "ИИ подберёт эффекты по визуалу каждой сцены — вводить описание не нужно. Уже добавленные звуки будут заменены.",
                "AI will match effects to each scene visual — no description is needed. Existing sounds will be replaced.",
              )}
            </p>
          </div>
        </div>

        <div
          className="workspace-confirm-modal__bulk-sound-cost"
          aria-label={workspaceText(locale, "Стоимость генерации", "Generation cost")}
        >
          <span>
            {workspaceText(
              locale,
              `${sceneCount} сцен · цена зависит от длительности`,
              `${sceneCount} scenes · duration-based price`,
            )}
          </span>
          <strong>{totalCredits} ⚡</strong>
        </div>

        {isGenerating ? (
          <div className="workspace-confirm-modal__bulk-sound-progress" role="status" aria-live="polite">
            <div>
              <span>{workspaceText(locale, "Создаём звуки", "Creating sounds")}</span>
              <strong>{processedCount}/{sceneCount}</strong>
            </div>
            <span className="workspace-confirm-modal__bulk-sound-progress-track" aria-hidden="true">
              <span style={{ width: `${progressPercent}%` }} />
            </span>
          </div>
        ) : null}

        <div className="workspace-confirm-modal__actions">
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--secondary"
            type="button"
            data-dialog-initial-focus
            onClick={onClose}
            disabled={isGenerating}
          >
            {workspaceText(locale, "Отмена", "Cancel")}
          </button>
          <button
            className="workspace-confirm-modal__action workspace-confirm-modal__action--primary"
            type="button"
            onClick={onGenerate}
            disabled={isGenerating || sceneCount === 0}
          >
            {isGenerating ? (
              <>
                <span className="workspace-confirm-modal__spinner" aria-hidden="true"></span>
                {workspaceText(locale, "Генерируем...", "Generating...")}
              </>
            ) : (
              workspaceText(locale, `Создать звуки · ${totalCredits} ⚡`, `Create sounds · ${totalCredits} ⚡`)
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
