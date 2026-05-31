import { createPortal } from "react-dom";
import type { Dispatch, SetStateAction } from "react";
import type { Locale } from "../../lib/i18n";
import { getWorkspaceProjectDisplayTitle } from "../../lib/workspaceMediaLibrary";
import {
  getWorkspaceLocalExampleGoalCopy,
  workspaceLocalExampleGoalOptions,
  workspaceText,
  type WorkspaceLocalExampleGoal,
  type WorkspaceLocalExampleSource,
} from "./workspace-page-model";
import type { WorkspaceProject } from "./workspace-types";

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
