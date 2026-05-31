import type { ChangeEvent, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../../lib/i18n";
import { workspaceText } from "./workspace-page-model";
import type { WorkspaceReferenceVisualOption } from "./workspace-prompt-helpers";

type WorkspaceReferenceOptionCardProps = {
  allowDelete?: boolean;
  canUseReference: boolean;
  editingName: string;
  isCharacterLimitReached: boolean;
  isDeleteDisabled: boolean;
  isDeleting: boolean;
  isEditingName: boolean;
  isSavingName: boolean;
  isSelected: boolean;
  locale: Locale;
  onCancelEditingName: () => void;
  onDelete: () => void;
  onEditingNameChange: (value: string) => void;
  onFinishEditingName: () => void;
  onSelect: () => void;
  onStartEditingName: () => void;
  option: WorkspaceReferenceVisualOption;
  renderPreview: (option: WorkspaceReferenceVisualOption, keyPrefix: string) => ReactNode;
};

export function WorkspaceReferenceOptionCard({
  allowDelete,
  canUseReference,
  editingName,
  isCharacterLimitReached,
  isDeleteDisabled,
  isDeleting,
  isEditingName,
  isSavingName,
  isSelected,
  locale,
  onCancelEditingName,
  onDelete,
  onEditingNameChange,
  onFinishEditingName,
  onSelect,
  onStartEditingName,
  option,
  renderPreview,
}: WorkspaceReferenceOptionCardProps) {
  const isSavedReferenceCard = Boolean(allowDelete && option.savedReference);

  if (isSavedReferenceCard) {
    return (
      <div
        key={`segment-reference-option:${option.kind}:${option.key}`}
        className={`studio-segment-references__option studio-segment-references__option--saved${isSelected ? " is-selected" : ""}`}
      >
        <div className={`studio-segment-references__card studio-segment-references__card--saved${isSelected ? " is-selected" : ""}`}>
          <button
            className="studio-segment-references__card-select"
            type="button"
            aria-label={option.label}
            aria-pressed={isSelected}
            disabled={!canUseReference || isSavingName || isCharacterLimitReached}
            onClick={onSelect}
          >
            {renderPreview(option, `reference-option:${option.key}`)}
            {option.previewKind === "video" && option.videoReferenceUrl ? (
              <span className="studio-segment-references__badge">{workspaceText(locale, "Кадр", "Frame")}</span>
            ) : null}
          </button>
          <button
            className="studio-segment-references__delete-icon"
            type="button"
            aria-label={workspaceText(locale, "Удалить", "Delete")}
            disabled={isDeleteDisabled || isSavingName}
            onClick={onDelete}
          >
            {isDeleting ? (
              <span className="studio-ai-photo-modal__action-spinner" aria-hidden="true"></span>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 4h6m-9 4h12m-10 0 .7 11h6.6L16 8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <span className="studio-segment-references__card-copy studio-segment-references__card-copy--editable">
            {isEditingName ? (
              <input
                className="studio-segment-references__name-input"
                type="text"
                value={editingName}
                disabled={isSavingName}
                autoFocus
                onChange={(event) => onEditingNameChange(event.currentTarget.value)}
                onBlur={onFinishEditingName}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelEditingName();
                  }
                }}
              />
            ) : (
              <button
                className="studio-segment-references__name-button"
                type="button"
                onClick={onStartEditingName}
              >
                {option.label}
              </button>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      key={`segment-reference-option:${option.kind}:${option.key}`}
      className={`studio-segment-references__option${isSelected ? " is-selected" : ""}`}
    >
      <button
        className="studio-segment-references__card"
        type="button"
        aria-pressed={isSelected}
        disabled={!canUseReference || isCharacterLimitReached}
        onClick={onSelect}
      >
        {renderPreview(option, `reference-option:${option.key}`)}
        {option.previewKind === "video" && option.videoReferenceUrl ? (
          <span className="studio-segment-references__badge">{workspaceText(locale, "Кадр", "Frame")}</span>
        ) : null}
        <span className="studio-segment-references__card-copy">
          <strong>{option.label}</strong>
          <small>{option.subtitle}</small>
        </span>
      </button>
      {allowDelete && option.savedReference ? (
        <div className="studio-segment-references__option-actions">
          <button type="button" disabled={isDeleteDisabled} onClick={onDelete}>
            {isDeleting ? workspaceText(locale, "Удаляем...", "Deleting...") : workspaceText(locale, "Удалить", "Delete")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type WorkspaceSegmentVisualReferencesPanelProps = {
  canRenderModal: boolean;
  characterPickerIconUrl: string;
  isModalOpen: boolean;
  locale: Locale;
  mentionCharacterKeys: readonly string[];
  onInsertMention: (option: WorkspaceReferenceVisualOption) => void;
  onOpen: () => void;
  onRemoveReference: (option: WorkspaceReferenceVisualOption) => void;
  renderModalContent: () => ReactNode;
  renderPreview: (option: WorkspaceReferenceVisualOption, keyPrefix: string) => ReactNode;
  segmentReferenceSummary: string;
  selectedCount: number;
  selectedOptions: WorkspaceReferenceVisualOption[];
  variant?: "editor" | "modal";
};

export function WorkspaceSegmentVisualReferencesPanel({
  canRenderModal,
  characterPickerIconUrl,
  isModalOpen,
  locale,
  mentionCharacterKeys,
  onInsertMention,
  onOpen,
  onRemoveReference,
  renderModalContent,
  renderPreview,
  segmentReferenceSummary,
  selectedCount,
  selectedOptions,
  variant = "editor",
}: WorkspaceSegmentVisualReferencesPanelProps) {
  return (
    <section className={`studio-segment-references studio-segment-references--${variant}`}>
      {variant === "editor" ? (
        <div
          className="studio-segment-references__compact-row"
          aria-label={workspaceText(locale, "Персонажи для описания", "Characters for prompt")}
        >
          <button
            className="studio-segment-references__compact-trigger"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isModalOpen}
            aria-label={workspaceText(locale, "Выбрать персонажей", "Choose characters")}
            title={workspaceText(locale, "Выбрать персонажей", "Choose characters")}
            onClick={onOpen}
          >
            <img
              className="studio-segment-references__compact-icon"
              src={characterPickerIconUrl}
              alt=""
              width="34"
              height="34"
              decoding="async"
              draggable={false}
              aria-hidden="true"
            />
            <span>{workspaceText(locale, "Персонажи", "Characters")}</span>
          </button>
          {selectedOptions.length > 0 ? (
            <div className="studio-segment-references__mention-icons">
              {selectedOptions.map((option) => {
                const isInserted = mentionCharacterKeys.includes(option.key);

                return (
                  <span
                    key={`segment-reference-mention-icon:${option.key}`}
                    className="studio-segment-references__mention-chip"
                  >
                    <button
                      className={`studio-segment-references__mention-icon${isInserted ? " is-inserted" : ""}`}
                      type="button"
                      aria-pressed={isInserted}
                      aria-label={workspaceText(
                        locale,
                        `Добавить ${option.label} в описание`,
                        `Add ${option.label} to prompt`,
                      )}
                      title={workspaceText(
                        locale,
                        `Добавить ${option.label} в описание`,
                        `Add ${option.label} to prompt`,
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onInsertMention(option)}
                    >
                      <span className="studio-segment-references__mention-icon-media">
                        {renderPreview(option, `segment-reference-mention-icon:${option.key}`)}
                      </span>
                      <span>{option.label}</span>
                    </button>
                    <button
                      className="studio-segment-references__mention-remove"
                      type="button"
                      aria-label={workspaceText(locale, `Убрать ${option.label}`, `Remove ${option.label}`)}
                      title={workspaceText(locale, `Убрать ${option.label}`, `Remove ${option.label}`)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveReference(option);
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                      </svg>
                    </button>
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <button
          className="studio-segment-references__summary"
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isModalOpen}
          onClick={onOpen}
        >
          <span>
            <strong>{workspaceText(locale, "Персонажи", "Characters")}</strong>
            <small>{segmentReferenceSummary}</small>
          </span>
          <em>
            {selectedCount > 0
              ? workspaceText(locale, `${selectedCount} выбрано`, `${selectedCount} selected`)
              : workspaceText(locale, "С нуля", "From scratch")}
          </em>
        </button>
      )}
      {isModalOpen && canRenderModal && typeof document !== "undefined"
        ? createPortal(renderModalContent(), document.body)
        : null}
    </section>
  );
}

type WorkspaceReferenceSavedSectionProps = {
  createLabel: string;
  isLoading: boolean;
  loadingLabel: string;
  onCreate: () => void;
  options: WorkspaceReferenceVisualOption[];
  renderOption: (option: WorkspaceReferenceVisualOption) => ReactNode;
  title: string;
};

export function WorkspaceReferenceSavedSection({
  createLabel,
  isLoading,
  loadingLabel,
  onCreate,
  options,
  renderOption,
  title,
}: WorkspaceReferenceSavedSectionProps) {
  return (
    <section className="studio-reference-modal__saved-section">
      <div className="studio-reference-modal__section-title">
        <div>
          <strong>{title}</strong>
        </div>
      </div>
      {isLoading ? (
        <div className="studio-segment-references__empty">{loadingLabel}</div>
      ) : (
        <div className="studio-segment-references__grid studio-segment-references__grid--saved">
          {options.map((option) => renderOption(option))}
          <button
            className="studio-reference-modal__add-card"
            type="button"
            onClick={onCreate}
          >
            <span>+</span>
            <strong>{createLabel}</strong>
          </button>
        </div>
      )}
    </section>
  );
}

type WorkspaceReferenceSelectedCardProps = {
  emptyLabel: string;
  limit: number;
  locale: Locale;
  options: WorkspaceReferenceVisualOption[];
  renderPreview: (option: WorkspaceReferenceVisualOption, keyPrefix: string) => ReactNode;
  title: string;
};

export function WorkspaceReferenceSelectedCard({
  emptyLabel,
  limit,
  locale,
  options,
  renderPreview,
  title,
}: WorkspaceReferenceSelectedCardProps) {
  const visibleOptions = options.slice(0, limit);
  const selectedLabel = visibleOptions.length > 0
    ? visibleOptions.map((option) => option.label).join(", ")
    : emptyLabel;

  return (
    <div className={`studio-reference-modal__selected-card${visibleOptions.length > 0 ? "" : " is-empty"}${visibleOptions.length > 1 ? " has-multiple" : ""}`}>
      {visibleOptions.length > 0 ? (
        <span className="studio-reference-modal__selected-media-stack">
          {visibleOptions.map((option) => (
            <span key={`selected-reference-stack:${option.key}`} className="studio-reference-modal__selected-media-item">
              {renderPreview(option, `selected-reference:${option.key}`)}
            </span>
          ))}
        </span>
      ) : null}
      <span>
        <small>{title}</small>
        <strong>{selectedLabel}</strong>
        {visibleOptions.length > 1 ? (
          <em>{workspaceText(locale, `${visibleOptions.length} персонажа`, `${visibleOptions.length} characters`)}</em>
        ) : null}
      </span>
    </div>
  );
}

type WorkspaceReferenceModalShellProps = {
  creatorDialog: ReactNode;
  error: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  isCreatorOpen: boolean;
  locale: Locale;
  onClear: () => void;
  onClose: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  savedSection: ReactNode;
  selectedCard: ReactNode;
  selectedCount: number;
  segmentReferenceSummary: string;
  selectionSubmitLabel: string;
};

export function WorkspaceReferenceModalShell({
  creatorDialog,
  error,
  fileInputRef,
  isCreatorOpen,
  locale,
  onClear,
  onClose,
  onFileChange,
  savedSection,
  selectedCard,
  selectedCount,
  segmentReferenceSummary,
  selectionSubmitLabel,
}: WorkspaceReferenceModalShellProps) {
  return (
    <div className="studio-reference-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="studio-reference-modal"
        role="dialog"
        aria-modal="true"
        aria-label={workspaceText(locale, "Персонажи", "Characters")}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="studio-reference-modal__head">
          <div>
            <strong>{workspaceText(locale, "Персонажи", "Characters")}</strong>
            <span>{workspaceText(locale, "Выберите персонажей или создайте новых.", "Choose characters or create new ones.")}</span>
          </div>
          <div className="studio-reference-modal__head-actions">
            <button
              className="studio-reference-modal__ghost"
              type="button"
              disabled={selectedCount === 0}
              onClick={onClear}
            >
              {workspaceText(locale, "Очистить", "Clear")}
            </button>
            <button
              className="studio-reference-modal__close"
              type="button"
              aria-label={workspaceText(locale, "Закрыть", "Close")}
              onClick={onClose}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <div className="studio-reference-modal__layout studio-reference-modal__layout--library-only">
          <div className="studio-reference-modal__catalog">
            {savedSection}

            <section className="studio-reference-modal__selected">
              <div className="studio-reference-modal__section-title">
                <div>
                  <strong>{workspaceText(locale, "Выбрано", "Selected")}</strong>
                  <span>{segmentReferenceSummary}</span>
                </div>
              </div>
              <div className="studio-reference-modal__selected-grid studio-reference-modal__selected-grid--characters-only">
                {selectedCard}
              </div>
            </section>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onFileChange}
        />

        {!isCreatorOpen && error ? (
          <div className="studio-segment-references__error" role="alert">
            {error}
          </div>
        ) : null}

        <footer className="studio-reference-modal__footer">
          <button className="studio-reference-modal__footer-cancel" type="button" onClick={onClose}>
            {workspaceText(locale, "Отмена", "Cancel")}
          </button>
          <button
            className="studio-reference-modal__footer-submit"
            type="button"
            disabled={selectedCount === 0}
            onClick={onClose}
          >
            {selectionSubmitLabel}
          </button>
        </footer>

        {creatorDialog}
      </div>
    </div>
  );
}
