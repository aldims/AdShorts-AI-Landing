import type {
  CSSProperties,
  ChangeEvent,
  ReactNode,
  RefObject,
} from "react";
import { createPortal } from "react-dom";
import { STUDIO_SEGMENT_VOICEOVER_MAX_TEXT_CHARS } from "../../../shared/studio-credit-costs";
import type { Locale } from "../../lib/i18n";
import { workspaceText } from "./workspace-page-model";
import { getStudioVoiceOptionCopy } from "./workspace-segment-editor";
import {
  getStudioSubtitleColorDisplayLabel,
  getStudioSubtitleStyleDisplayLabel,
} from "./workspace-subtitle-preview-helpers";
import type { WorkspaceSegmentVisualModalTab } from "./workspace-segment-visual-helpers";
import type {
  StudioLanguage,
  StudioSubtitleColorOption,
  StudioSubtitleStyleOption,
  StudioVoiceOption,
  WorkspaceSegmentEditorDraftSegment,
} from "./workspace-types";

type WorkspaceTimelineSpan = {
  endTime: number;
  startTime: number;
};

type WorkspaceSegmentTimelineDurationMenuProps = {
  aiPrompt: string;
  aiPromptRef: RefObject<HTMLTextAreaElement | null>;
  applyDurationLabel: string;
  canRequestAiExtension: boolean;
  canTrimToVoiceover: boolean;
  customDurationRangeLabel: string | null;
  durationSwitch: ReactNode;
  extensionButtonLabel: string;
  extensionCreditLabel: string;
  hasExtensionPlan: boolean;
  inputId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  inputValue: string;
  isCustomDurationSelected: boolean;
  isExtensionDisabled: boolean;
  isExtensionPending: boolean;
  isPhoto: boolean;
  locale: Locale;
  menuRef: RefObject<HTMLDivElement | null>;
  onAiExtensionClick: () => void;
  onAiPromptChange: (value: string) => void;
  onApplyDuration: (segmentIndex: number, options?: { trimToVoiceover?: boolean }) => unknown;
  onClose: () => void;
  onCustomDurationSelect: (() => void) | null;
  onInputValueChange: (value: string) => void;
  onPreviewDurationModeSelect: ((trimToVoiceover: boolean) => void) | null;
  onTrimToVoiceoverToggle: (trimToVoiceover: boolean) => void;
  qualitySwitch: ReactNode;
  segment: WorkspaceSegmentEditorDraftSegment | null;
  segmentArrayIndex: number;
  shouldShowManualDurationInput: boolean;
  subtitle: string | null;
  title: string;
  trimToVoiceover: boolean;
  trimToVoiceoverLabels: {
    fullDurationLabel: string;
    fullResultDurationLabel: string;
    fullResultLoopsToVoiceover: boolean;
    voiceoverDurationLabel: string;
  } | null;
};

export function WorkspaceSegmentTimelineDurationMenu({
  aiPrompt,
  aiPromptRef,
  applyDurationLabel,
  canRequestAiExtension,
  canTrimToVoiceover,
  customDurationRangeLabel,
  durationSwitch,
  extensionButtonLabel,
  extensionCreditLabel,
  hasExtensionPlan,
  inputId,
  inputRef,
  inputValue,
  isCustomDurationSelected,
  isExtensionDisabled,
  isExtensionPending,
  isPhoto,
  locale,
  menuRef,
  onAiExtensionClick,
  onAiPromptChange,
  onApplyDuration,
  onClose,
  onCustomDurationSelect,
  onInputValueChange,
  onPreviewDurationModeSelect,
  onTrimToVoiceoverToggle,
  qualitySwitch,
  segment,
  segmentArrayIndex,
  shouldShowManualDurationInput,
  subtitle,
  title,
  trimToVoiceover,
  trimToVoiceoverLabels,
}: WorkspaceSegmentTimelineDurationMenuProps) {
  if (!segment || isPhoto || segmentArrayIndex < 0 || typeof document === "undefined") {
    return null;
  }

  const applyDuration = () => {
    const timing = onApplyDuration(segment.index);
    if (timing) {
      onClose();
    }
  };
  const fullVideoResultDurationLabel =
    trimToVoiceoverLabels?.fullResultDurationLabel ?? trimToVoiceoverLabels?.fullDurationLabel;
  const fullVideoResultLoopsToVoiceover = trimToVoiceoverLabels?.fullResultLoopsToVoiceover === true;
  const shouldShowDurationModeChoices =
    canTrimToVoiceover && trimToVoiceoverLabels !== null && !fullVideoResultLoopsToVoiceover;
  const shouldShowLoopedDurationSummary = trimToVoiceoverLabels !== null && fullVideoResultLoopsToVoiceover;
  const shouldShowCustomDurationChoice = shouldShowManualDurationInput && shouldShowDurationModeChoices;
  const shouldShowStandaloneManualDurationInput = shouldShowManualDurationInput && !shouldShowCustomDurationChoice;
  const selectDurationMode = (nextTrimToVoiceover: boolean) => {
    if (trimToVoiceover !== nextTrimToVoiceover) {
      onTrimToVoiceoverToggle(nextTrimToVoiceover);
    }

    if (shouldShowCustomDurationChoice) {
      const timing = onApplyDuration(segment.index, { trimToVoiceover: nextTrimToVoiceover });
      if (timing) {
        onClose();
      }
      return;
    }

    if (shouldShowManualDurationInput && onPreviewDurationModeSelect) {
      onPreviewDurationModeSelect(nextTrimToVoiceover);
      return;
    }

    const timing = onApplyDuration(segment.index, { trimToVoiceover: nextTrimToVoiceover });
    if (timing) {
      onClose();
    }
  };
  const selectCustomDuration = () => {
    if (onCustomDurationSelect) {
      onCustomDurationSelect();
    }

    window.requestAnimationFrame(() => inputRef.current?.focus());
  };
  const renderDurationInputField = (variant: "primary" | "custom") => {
    const label = workspaceText(
      locale,
      variant === "custom"
        ? "Задать длину сцены"
        : isPhoto
          ? "Длительность визуала"
          : "Длительность сцены",
      variant === "custom"
        ? "Set scene duration"
        : isPhoto
          ? "Visual duration"
          : "Scene duration",
    );

    return (
      <div
        className={`studio-segment-editor__timeline-duration-menu-field studio-segment-editor__timeline-duration-menu-field--${variant}`}
      >
        <label htmlFor={inputId}>{label}</label>
        <div className="studio-segment-editor__timeline-duration-menu-input-row">
          <input
            ref={inputRef}
            id={inputId}
            className="studio-segment-editor__timeline-duration-menu-input"
            type="text"
            inputMode="decimal"
            value={inputValue}
            placeholder="4.5"
            aria-label={label}
            title={workspaceText(
              locale,
              "Можно ввести 4, 4.5 или 00:04.",
              "Enter 4, 4.5, or 00:04.",
            )}
            onChange={(event) => {
              onInputValueChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyDuration();
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
          />
          <button type="button" onClick={applyDuration}>
            {applyDurationLabel}
          </button>
        </div>
      </div>
    );
  };

  return createPortal(
    <div
      className="studio-segment-editor__timeline-duration-dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={menuRef}
        className="studio-segment-editor__timeline-text-menu studio-segment-editor__timeline-duration-menu"
        role="dialog"
        aria-modal="true"
        aria-label={workspaceText(
          locale,
          `Длительность сцены ${segmentArrayIndex + 1}`,
          `Scene ${segmentArrayIndex + 1} duration`,
        )}
      >
        <div className="studio-segment-editor__timeline-text-menu-head">
          <span>
            <strong>{title}</strong>
            {subtitle ? <small>{subtitle}</small> : null}
          </span>
        </div>
        {shouldShowStandaloneManualDurationInput ? renderDurationInputField("primary") : null}
        {shouldShowLoopedDurationSummary && trimToVoiceoverLabels ? (
          <>
            <div className="studio-segment-editor__timeline-duration-summary">
              <div>
                <span>{workspaceText(locale, "Текущее видео", "Current video")}</span>
                <strong>{trimToVoiceoverLabels.fullDurationLabel}</strong>
              </div>
              <div>
                <span>{workspaceText(locale, "Текущая озвучка", "Current voiceover")}</span>
                <strong>{trimToVoiceoverLabels.voiceoverDurationLabel}</strong>
              </div>
            </div>
            <p className="studio-segment-editor__timeline-duration-loop-note" role="status">
              {workspaceText(
                locale,
                "Без ИИ-продления видео повторится с начала до конца озвучки. Чтобы убрать повтор, продлите видео с ИИ.",
                "Without AI extension, the video will replay from the beginning until the voiceover ends. Extend with AI to remove the repeat.",
              )}
            </p>
          </>
        ) : null}
        {shouldShowDurationModeChoices && trimToVoiceoverLabels ? (
          <div
            className={`studio-segment-editor__timeline-duration-menu-modes${
              shouldShowCustomDurationChoice ? " studio-segment-editor__timeline-duration-menu-modes--with-custom" : ""
            }`}
            role="radiogroup"
            aria-label={workspaceText(locale, "Как синхронизировать видео и озвучку", "How to sync video and voiceover")}
          >
            <button
              className={`studio-segment-editor__timeline-duration-menu-mode${
                !trimToVoiceover && !isCustomDurationSelected ? " is-selected" : ""
              }`}
              type="button"
              role="radio"
              aria-checked={!trimToVoiceover && !isCustomDurationSelected}
              onClick={() => {
                selectDurationMode(false);
              }}
            >
              <strong>
                {workspaceText(
                  locale,
                  "По длине видео",
                  "Use video length",
                )}
              </strong>
              <small>
                {workspaceText(
                  locale,
                  fullVideoResultLoopsToVoiceover
                    ? `${fullVideoResultDurationLabel} с повтором`
                    : trimToVoiceoverLabels.fullDurationLabel,
                  fullVideoResultLoopsToVoiceover
                    ? `${fullVideoResultDurationLabel}, looped`
                    : trimToVoiceoverLabels.fullDurationLabel,
                )}
              </small>
            </button>
            <button
              className={`studio-segment-editor__timeline-duration-menu-mode${
                trimToVoiceover && !isCustomDurationSelected ? " is-selected" : ""
              }`}
              type="button"
              role="radio"
              aria-checked={trimToVoiceover && !isCustomDurationSelected}
              onClick={() => {
                selectDurationMode(true);
              }}
            >
              <strong>
                {workspaceText(
                  locale,
                  "По длине озвучки",
                  "Use voiceover length",
                )}
              </strong>
              <small>
                {workspaceText(
                  locale,
                  trimToVoiceoverLabels.voiceoverDurationLabel,
                  trimToVoiceoverLabels.voiceoverDurationLabel,
                )}
              </small>
            </button>
            {shouldShowCustomDurationChoice ? (
              <button
                className={`studio-segment-editor__timeline-duration-menu-mode${
                  isCustomDurationSelected ? " is-selected" : ""
                }`}
                type="button"
                role="radio"
                aria-checked={isCustomDurationSelected}
                onClick={selectCustomDuration}
              >
                <strong>{workspaceText(locale, "Задать длину", "Custom length")}</strong>
                <small>
                  {customDurationRangeLabel ??
                    workspaceText(locale, "между озвучкой и видео", "between voiceover and video")}
                </small>
              </button>
            ) : null}
          </div>
        ) : null}
        {shouldShowCustomDurationChoice && isCustomDurationSelected ? renderDurationInputField("custom") : null}
        {hasExtensionPlan ? (
          <div className="studio-segment-editor__timeline-duration-menu-field studio-segment-editor__timeline-duration-prompt-card">
            <textarea
              ref={aiPromptRef}
              id={`${inputId}-ai`}
              className="studio-segment-editor__timeline-duration-menu-textarea"
              value={aiPrompt}
              rows={3}
              aria-label={workspaceText(locale, "Опишите сцену продления", "Describe the extension scene")}
              placeholder={workspaceText(locale, "Опишите сцену продления", "Describe the extension scene")}
              onChange={(event) => {
                onAiPromptChange(event.target.value);
              }}
            />
            <div className="studio-segment-editor__timeline-duration-prompt-actions">
              <div className="studio-segment-editor__timeline-duration-action-cluster">
                <div className="studio-segment-editor__timeline-duration-generation-settings">
                  <div className="studio-segment-editor__timeline-duration-generation-heading">
                    <strong>{workspaceText(locale, "Параметры продления", "Extension settings")}</strong>
                    <span>
                      {workspaceText(
                        locale,
                        "Настройте длительность и звук нового фрагмента",
                        "Set the duration and sound for the new clip",
                      )}
                    </span>
                  </div>
                  <div className="studio-segment-editor__timeline-duration-generation-controls">
                    {qualitySwitch}
                    {durationSwitch}
                  </div>
                </div>
                <div className="studio-segment-editor__timeline-duration-generation-footer">
                  {shouldShowLoopedDurationSummary ? (
                    <button
                      className="studio-segment-editor__timeline-duration-keep-button"
                      type="button"
                      onClick={onClose}
                    >
                      {workspaceText(locale, "Оставить с повтором", "Keep replaying")}
                    </button>
                  ) : null}
                  <button
                    className="studio-segment-editor__timeline-duration-extend-button"
                    type="button"
                    disabled={isExtensionDisabled}
                    title={
                      canRequestAiExtension
                        ? workspaceText(locale, "Сгенерировать ИИ-продление", "Generate AI extension")
                        : workspaceText(locale, "Нет доступного кадра для ИИ-продления", "No available frame for AI extension")
                    }
                    onClick={onAiExtensionClick}
                  >
                    {isExtensionPending ? (
                      <span className="studio-segment-editor__prompt-action-spinner" aria-hidden="true"></span>
                    ) : (
                      <>
                        <span>{extensionButtonLabel}</span>
                        <small>{extensionCreditLabel}</small>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {!hasExtensionPlan && !shouldShowManualDurationInput && !shouldShowDurationModeChoices && !shouldShowLoopedDurationSummary ? (
          <div className="studio-segment-editor__timeline-text-menu-actions studio-segment-editor__timeline-duration-menu-actions">
            <button type="button" onClick={applyDuration}>
              {workspaceText(locale, "Сохранить", "Save")}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export type WorkspaceSegmentTimelineVisualMenuOption = {
  action?: "video_extension";
  description: string;
  groupLabel: string;
  icon: string;
  tab: WorkspaceSegmentVisualModalTab;
  title: string;
};

type WorkspaceSegmentTimelineVisualMenuProps = {
  activeSegmentIndex: number | null;
  activeToolTab: WorkspaceSegmentVisualModalTab;
  getDisabledReason: (segment: WorkspaceSegmentEditorDraftSegment, tab: WorkspaceSegmentVisualModalTab) => string | null;
  isSegmentBusy: (segmentIndex: number) => boolean;
  locale: Locale;
  menuRef: RefObject<HTMLDivElement | null>;
  onSelectTool: (segmentArrayIndex: number, tab: WorkspaceSegmentVisualModalTab) => void;
  onSelectVideoExtension: (segmentArrayIndex: number) => void;
  options: WorkspaceSegmentTimelineVisualMenuOption[];
  segment: WorkspaceSegmentEditorDraftSegment | null;
  segmentArrayIndex: number;
  style: CSSProperties | null;
};

export function WorkspaceSegmentTimelineVisualMenu({
  activeSegmentIndex,
  activeToolTab,
  getDisabledReason,
  isSegmentBusy,
  locale,
  menuRef,
  onSelectTool,
  onSelectVideoExtension,
  options,
  segment,
  segmentArrayIndex,
  style,
}: WorkspaceSegmentTimelineVisualMenuProps) {
  if (!segment || segmentArrayIndex < 0 || !style || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="studio-segment-editor__timeline-visual-menu"
      role="dialog"
      aria-label={workspaceText(
        locale,
        `Визуал сцены ${segmentArrayIndex + 1}`,
        `Scene ${segmentArrayIndex + 1} visual`,
      )}
      style={style}
    >
      <div className="studio-segment-editor__timeline-visual-menu-strip">
        {options.map((option) => {
          const isVideoExtensionAction = option.action === "video_extension";
          const disabledReason = isVideoExtensionAction
            ? isSegmentBusy(segment.index)
              ? workspaceText(locale, "Дождитесь завершения генерации", "Wait for generation to finish")
              : null
            : getDisabledReason(segment, option.tab);
          const isSelected =
            !isVideoExtensionAction &&
            activeSegmentIndex === segment.index &&
            activeToolTab === option.tab;

          return (
            <button
              className={`studio-segment-editor__timeline-visual-menu-option${
                isSelected ? " is-selected" : ""
              }`}
              key={`timeline-visual-tool:${option.action ?? option.tab}`}
              type="button"
              disabled={Boolean(disabledReason)}
              aria-pressed={isVideoExtensionAction ? undefined : isSelected}
              aria-label={`${option.title}: ${disabledReason ?? option.description}`}
              title={`${option.groupLabel}: ${disabledReason ?? option.description}`}
              onClick={() =>
                isVideoExtensionAction
                  ? onSelectVideoExtension(segmentArrayIndex)
                  : onSelectTool(segmentArrayIndex, option.tab)
              }
            >
              <span
                className={`studio-segment-editor__timeline-visual-menu-icon is-${option.tab.replace(/_/g, "-")}`}
                aria-hidden="true"
              >
                {option.icon}
              </span>
              <span className="studio-segment-editor__timeline-visual-menu-copy">
                <strong>{option.title}</strong>
              </span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

type WorkspaceSegmentTimelineVoiceLanguageOption = {
  id: StudioLanguage;
};

type WorkspaceSegmentTimelineVoiceMenuProps = {
  effectiveVoiceId: StudioVoiceOption["id"] | null;
  generateCostLabel: string | null;
  generateDisabledReason: string | null;
  generateLabel: string;
  isGeneratingVoiceover: boolean;
  isAdaptingText: boolean;
  canRestoreAdaptedText: boolean;
  isVoiceDisabled: boolean;
  language: StudioLanguage;
  languageOptions: WorkspaceSegmentTimelineVoiceLanguageOption[];
  locale: Locale;
  menuRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onGenerateVoiceover: () => void;
  onAdaptTextToVisual: () => void;
  onRestoreAdaptedText: () => void;
  onLanguageSelect: (segmentIndex: number, language: StudioLanguage) => void;
  onTextChange: (segmentIndex: number, event: ChangeEvent<HTMLTextAreaElement>) => void;
  onUseGlobalVoice: (segmentIndex: number) => void;
  onVoicePreview: (voice: StudioVoiceOption) => void | Promise<void>;
  onVoiceSelect: (segmentIndex: number, voiceId: StudioVoiceOption["id"]) => void;
  previewingVoiceId: StudioVoiceOption["id"] | null;
  segment: WorkspaceSegmentEditorDraftSegment | null;
  segmentArrayIndex: number;
  style: CSSProperties | null;
  textAreaId: string;
  visualAudioWarningText: string | null;
  voiceOptions: StudioVoiceOption[];
};

const getWorkspaceSegmentTimelineVoiceLanguageLabel = (locale: Locale, language: StudioLanguage) =>
  locale === "en" ? (language === "en" ? "English" : "Russian") : language === "en" ? "Английский" : "Русский";

const getWorkspaceSegmentTimelineVoiceLanguageDescription = (locale: Locale, language: StudioLanguage) =>
  locale === "en"
    ? language === "en"
      ? "English voices"
      : "Russian voices"
    : language === "en"
      ? "Англоязычные голоса"
      : "Русскоязычные голоса";

export function WorkspaceSegmentTimelineVoiceMenu({
  effectiveVoiceId,
  generateCostLabel,
  generateDisabledReason,
  generateLabel,
  isGeneratingVoiceover,
  isAdaptingText,
  canRestoreAdaptedText,
  isVoiceDisabled,
  language,
  languageOptions,
  locale,
  menuRef,
  onClose,
  onGenerateVoiceover,
  onAdaptTextToVisual,
  onRestoreAdaptedText,
  onLanguageSelect,
  onTextChange,
  onUseGlobalVoice,
  onVoicePreview,
  onVoiceSelect,
  previewingVoiceId,
  segment,
  segmentArrayIndex,
  style,
  textAreaId,
  visualAudioWarningText,
  voiceOptions,
}: WorkspaceSegmentTimelineVoiceMenuProps) {
  if (!segment || !style || typeof document === "undefined") {
    return null;
  }

  const saveTextDisabledReason = generateDisabledReason;

  return createPortal(
    <div
      ref={menuRef}
      className="studio-voice-selector__menu studio-voice-selector__menu--with-text studio-segment-editor__timeline-voice-menu"
      role="dialog"
      aria-modal="false"
      aria-label={workspaceText(
        locale,
        `Голос сцены ${segmentArrayIndex + 1}`,
        `Scene ${segmentArrayIndex + 1} voice`,
      )}
      style={style}
    >
      <span className="studio-voice-selector__menu-title">
        {workspaceText(
          locale,
          `Голос сцены ${segmentArrayIndex + 1}`,
          `Scene ${segmentArrayIndex + 1} voice`,
        )}
      </span>
      <div className="studio-voice-selector__language-panel studio-segment-editor__timeline-voice-language">
        <span className="studio-voice-selector__language-title">
          {workspaceText(locale, "Язык озвучки", "Voice language")}
        </span>
        <div
          className="studio-voice-selector__language-options"
          role="radiogroup"
          aria-label={workspaceText(locale, "Язык озвучки", "Voice language")}
        >
          {languageOptions.map((option) => {
            const isSelectedLanguage = option.id === language;

            return (
              <button
                key={`timeline-voice-language:${option.id}`}
                className={`studio-voice-selector__language-option${isSelectedLanguage ? " is-selected" : ""}`}
                type="button"
                role="radio"
                aria-checked={isSelectedLanguage}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onLanguageSelect(segment.index, option.id);
                }}
              >
                <span>{getWorkspaceSegmentTimelineVoiceLanguageLabel(locale, option.id)}</span>
                <small>{getWorkspaceSegmentTimelineVoiceLanguageDescription(locale, option.id)}</small>
              </button>
            );
          })}
        </div>
      </div>
      <div
        className="studio-voice-selector__voice-grid"
        role="radiogroup"
        aria-label={workspaceText(locale, "Голос сцены", "Scene voice")}
      >
        <div className={`studio-voice-selector__option studio-voice-selector__option--no-voice${isVoiceDisabled ? " is-selected" : ""}`}>
          <button
            className="studio-voice-selector__option-main"
            type="button"
            role="radio"
            aria-checked={isVoiceDisabled}
            onClick={() => onUseGlobalVoice(segment.index)}
          >
            <span className="studio-voice-selector__option-title">
              <span>{workspaceText(locale, "Без озвучки", "No voiceover")}</span>
            </span>
            <small>
              {workspaceText(
                locale,
                "Отключить голос только для этой сцены",
                "Turn voice off only for this scene",
              )}
            </small>
          </button>
        </div>
        {voiceOptions.map((voice) => {
          const canPreviewVoice = Boolean(voice.previewSampleUrl);
          const isSelectedSceneVoice = !isVoiceDisabled && effectiveVoiceId === voice.id;
          const voiceCopy = getStudioVoiceOptionCopy(voice, locale);

          return (
            <div
              className={`studio-voice-selector__option${isSelectedSceneVoice ? " is-selected" : ""}`}
              key={`timeline-scene-voice:${voice.id}`}
            >
              <button
                className="studio-voice-selector__option-main"
                type="button"
                role="radio"
                aria-checked={isSelectedSceneVoice}
                onClick={() => onVoiceSelect(segment.index, voice.id)}
              >
                <span className="studio-voice-selector__option-title">
                  <span>{voiceCopy.label}</span>
                  {voice.badgeLabel ? (
                    <span className="studio-voice-selector__badge">{voice.badgeLabel}</span>
                  ) : null}
                </span>
                <small>{voiceCopy.description}</small>
              </button>
              <button
                className={`studio-voice-selector__preview${
                  previewingVoiceId === voice.id ? " is-playing" : ""
                }`}
                type="button"
                aria-label={
                  !canPreviewVoice
                    ? `${workspaceText(locale, "Превью недоступно", "Preview unavailable")}: ${voiceCopy.label}`
                    : previewingVoiceId === voice.id
                      ? `${workspaceText(locale, "Остановить", "Stop")}: ${voiceCopy.label}`
                      : `${workspaceText(locale, "Прослушать", "Listen")}: ${voiceCopy.label}`
                }
                title={
                  !canPreviewVoice
                    ? workspaceText(locale, "Превью недоступно", "Preview unavailable")
                    : previewingVoiceId === voice.id
                      ? workspaceText(locale, "Остановить", "Stop")
                      : workspaceText(locale, "Прослушать", "Listen")
                }
                disabled={!canPreviewVoice}
                onClick={() => void onVoicePreview(voice)}
              >
                {previewingVoiceId === voice.id ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <rect x="3.25" y="3.25" width="7.5" height="7.5" rx="1.2" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M4.2 3.5v7l5.8-3.5-5.8-3.5Z" fill="currentColor" />
                  </svg>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <div className="studio-voice-selector__bulk-text studio-segment-editor__timeline-voice-text">
        <div className="studio-voice-selector__bulk-head studio-segment-editor__timeline-voice-text-title">
          <label htmlFor={textAreaId}>
            {workspaceText(locale, "Текст озвучки", "Voiceover text")}
          </label>
        </div>
        {visualAudioWarningText ? (
          <div className="studio-segment-editor__timeline-voice-loop-warning">
            <div className="studio-segment-editor__timeline-voice-loop-warning-copy" role="status">
              <span className="studio-segment-editor__timeline-duration-warning" aria-hidden="true">!</span>
              <span>{visualAudioWarningText}</span>
            </div>
            <div className="studio-segment-editor__timeline-voice-adapt-actions">
              <button className="studio-segment-editor__timeline-voice-adapt-button" type="button" disabled={isAdaptingText} aria-busy={isAdaptingText || undefined} onClick={onAdaptTextToVisual}>
                <span className="studio-segment-editor__timeline-voice-adapt-icon" aria-hidden="true">✦</span>
                <span>{isAdaptingText ? workspaceText(locale, "Подстраиваем…", "Adapting…") : workspaceText(locale, "Подстроить текст под длину визуала", "Adapt text to visual length")}</span>
              </button>
              <span className="studio-segment-editor__timeline-voice-adapt-help">
                <button type="button" aria-label={workspaceText(locale, "Как рассчитывается длина текста", "How text length is calculated")} aria-describedby={`${textAreaId}-adapt-help`}>i</button>
                <span id={`${textAreaId}-adapt-help`} role="tooltip">
                  {workspaceText(
                    locale,
                    "Это примерная подстройка по скорости выбранного голоса. После генерации длительность может немного отличаться из-за пауз и произношения.",
                    "This is an estimate based on the selected voice speed. The generated duration may vary slightly because of pauses and pronunciation.",
                  )}
                </span>
              </span>
            </div>
          </div>
        ) : null}
        <div className="studio-voice-selector__bulk-head studio-segment-editor__timeline-voice-text-counter">
          {canRestoreAdaptedText ? (
            <button type="button" onClick={onRestoreAdaptedText}>
              <span aria-hidden="true">↶</span>
              <span>{workspaceText(locale, "Вернуть исходный текст", "Restore original text")}</span>
            </button>
          ) : null}
          <small>{workspaceText(locale, `Сцена ${segmentArrayIndex + 1} · ${segment.text.length}/${STUDIO_SEGMENT_VOICEOVER_MAX_TEXT_CHARS}`, `Scene ${segmentArrayIndex + 1} · ${segment.text.length}/${STUDIO_SEGMENT_VOICEOVER_MAX_TEXT_CHARS}`)}</small>
        </div>
        <textarea
          id={textAreaId}
          className="studio-voice-selector__bulk-textarea studio-segment-editor__timeline-voice-textarea"
          value={segment.text}
          rows={5}
          maxLength={STUDIO_SEGMENT_VOICEOVER_MAX_TEXT_CHARS}
          placeholder={workspaceText(locale, "Введите текст для этой сцены", "Enter text for this scene")}
          onChange={(event) => onTextChange(segment.index, event)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <div className="studio-voice-selector__bulk-actions studio-segment-editor__timeline-voice-text-actions">
          <button
            className="studio-segment-editor__timeline-voice-text-save"
            type="button"
            disabled={Boolean(saveTextDisabledReason)}
            aria-label={
              saveTextDisabledReason
                ? `${workspaceText(locale, "Сохранить", "Save")}. ${saveTextDisabledReason}`
                : workspaceText(locale, "Сохранить", "Save")
            }
            title={saveTextDisabledReason ?? undefined}
            onClick={onClose}
          >
            {workspaceText(locale, "Сохранить", "Save")}
          </button>
          <button
            className="studio-segment-editor__timeline-voice-text-generate"
            type="button"
            disabled={Boolean(generateDisabledReason)}
            aria-busy={isGeneratingVoiceover ? true : undefined}
            aria-label={
              generateDisabledReason
                ? `${generateLabel}. ${generateDisabledReason}`
                : generateLabel
            }
            title={generateDisabledReason ?? undefined}
            onClick={onGenerateVoiceover}
          >
            {isGeneratingVoiceover ? (
              <span className="studio-segment-editor__prompt-action-spinner" aria-hidden="true"></span>
            ) : null}
            <span>{generateLabel}</span>
            {generateCostLabel ? <small>{generateCostLabel}</small> : null}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type WorkspaceSegmentTimelineSoundMenuProps = {
  canDelete: boolean;
  creditLabel: string;
  isActionDisabled: boolean;
  isPending: boolean;
  isStructureActionBusy: boolean;
  locale: Locale;
  menuRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onDelete: (segmentIndex: number) => void;
  onGenerate: (segmentIndex: number, prompt: string) => void;
  onPromptChange: (segmentIndex: number, event: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  previewUrl: string | null;
  prompt: string;
  segment: WorkspaceSegmentEditorDraftSegment | null;
  segmentArrayIndex: number;
  span: WorkspaceTimelineSpan | null;
  spanLabel: string;
  style: CSSProperties | null;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

export function WorkspaceSegmentTimelineSoundMenu({
  canDelete,
  creditLabel,
  isActionDisabled,
  isPending,
  isStructureActionBusy,
  locale,
  menuRef,
  onClose,
  onDelete,
  onGenerate,
  onPromptChange,
  placeholder,
  previewUrl,
  prompt,
  segment,
  segmentArrayIndex,
  span,
  spanLabel,
  style,
  textareaRef,
}: WorkspaceSegmentTimelineSoundMenuProps) {
  if (!segment || segmentArrayIndex < 0 || !style || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="studio-segment-editor__timeline-text-menu studio-segment-editor__timeline-sound-menu"
      role="dialog"
      aria-modal="false"
      aria-label={workspaceText(
        locale,
        `Звук сцены ${segmentArrayIndex + 1}`,
        `Scene ${segmentArrayIndex + 1} sound`,
      )}
      style={style}
    >
      <div className="studio-segment-editor__timeline-text-menu-head">
        <span>
          <strong>
            {workspaceText(
              locale,
              `Звук сцены ${segmentArrayIndex + 1}`,
              `Scene ${segmentArrayIndex + 1} sound`,
            )}
          </strong>
          <small>
            {span ? spanLabel : workspaceText(locale, "Звуки сцены", "Scene sounds")}
          </small>
        </span>
        <button
          className="studio-segment-editor__timeline-text-menu-close"
          type="button"
          aria-label={workspaceText(locale, "Закрыть редактор звука", "Close sound editor")}
          onClick={onClose}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 7l10 10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            <path d="M17 7 7 17" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="studio-segment-editor__timeline-text-menu-field">
        <label htmlFor={`studio-segment-editor-scene-sound-${segment.index}`}>
          {workspaceText(locale, "Описание звука (необязательно)", "Sound prompt (optional)")}
        </label>
        <textarea
          id={`studio-segment-editor-scene-sound-${segment.index}`}
          ref={textareaRef}
          className="studio-segment-editor__timeline-text-menu-textarea"
          value={prompt}
          rows={5}
          placeholder={placeholder}
          onChange={(event) => onPromptChange(segment.index, event)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !isActionDisabled) {
              event.preventDefault();
              onGenerate(segment.index, prompt);
            }
          }}
        />
        <div className="studio-segment-editor__timeline-text-menu-actions studio-segment-editor__timeline-sound-menu-actions">
          {canDelete ? (
            <button
              type="button"
              disabled={isStructureActionBusy}
              onClick={() => onDelete(segment.index)}
            >
              {workspaceText(locale, "Удалить звук", "Delete sound")}
            </button>
          ) : null}
          <button
            type="button"
            disabled={isActionDisabled}
            aria-busy={isPending ? "true" : undefined}
            onClick={() => onGenerate(segment.index, prompt)}
          >
            {isPending ? (
              <>
                <span className="studio-segment-editor__prompt-action-spinner" aria-hidden="true"></span>
                <span>{workspaceText(locale, "Генерируем", "Generating")}</span>
              </>
            ) : (
              <>
                <span>
                  {previewUrl
                    ? workspaceText(locale, "Перегенерировать", "Regenerate")
                    : workspaceText(locale, "Добавить звук", "Add sound")}
                </span>
                <small>{creditLabel}</small>
              </>
            )}
          </button>
        </div>
      </div>
      {isPending ? (
        <div className="studio-segment-editor__timeline-sound-menu-status is-processing" role="status" aria-live="polite">
          <span className="studio-segment-editor__prompt-action-spinner" aria-hidden="true"></span>
          <span>{workspaceText(locale, "Генерируем звук сцены", "Generating scene sound")}</span>
        </div>
      ) : previewUrl ? (
        <div className="studio-segment-editor__timeline-sound-menu-preview">
          <span>{workspaceText(locale, "Текущий звук", "Current sound")}</span>
          <audio controls src={previewUrl} preload="metadata" />
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

type WorkspaceSegmentTimelineSubtitleMenuSettings = {
  subtitleColorId: StudioSubtitleColorOption["id"];
  subtitleStyleId: StudioSubtitleStyleOption["id"];
  voiceEnabled: boolean;
};

type WorkspaceSegmentTimelineSubtitleMenuProps = {
  colorOptions: StudioSubtitleColorOption[];
  locale: Locale;
  menuRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onColorSelect: (segmentIndex: number, colorId: StudioSubtitleColorOption["id"]) => void;
  onDisable: (segmentIndex: number) => void;
  onStyleSelect: (segmentIndex: number, styleId: StudioSubtitleStyleOption["id"]) => void;
  segment: WorkspaceSegmentEditorDraftSegment | null;
  segmentArrayIndex: number;
  settings: WorkspaceSegmentTimelineSubtitleMenuSettings | null;
  span: WorkspaceTimelineSpan | null;
  spanLabel: string;
  style: CSSProperties | null;
  styleOptions: StudioSubtitleStyleOption[];
  subtitleMenuType: string | null | undefined;
};

export function WorkspaceSegmentTimelineSubtitleMenu({
  colorOptions,
  locale,
  menuRef,
  onClose,
  onColorSelect,
  onDisable,
  onStyleSelect,
  segment,
  segmentArrayIndex,
  settings,
  span,
  spanLabel,
  style,
  styleOptions,
  subtitleMenuType,
}: WorkspaceSegmentTimelineSubtitleMenuProps) {
  if (!segment || segmentArrayIndex < 0 || !settings || !style || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="studio-segment-editor__timeline-text-menu studio-segment-editor__timeline-subtitle-menu"
      role="dialog"
      aria-modal="false"
      aria-label={workspaceText(
        locale,
        `Субтитры сцены ${segmentArrayIndex + 1}`,
        `Scene ${segmentArrayIndex + 1} subtitles`,
      )}
      style={style}
    >
      <div className="studio-segment-editor__timeline-text-menu-head">
        <span>
          <strong>
            {workspaceText(
              locale,
              `Субтитры сцены ${segmentArrayIndex + 1}`,
              `Scene ${segmentArrayIndex + 1} subtitles`,
            )}
          </strong>
          <small>
            {span ? spanLabel : workspaceText(locale, "Настройки субтитров", "Subtitle settings")}
          </small>
        </span>
        <button
          className="studio-segment-editor__timeline-text-menu-close"
          type="button"
          aria-label={workspaceText(locale, "Закрыть настройки субтитров", "Close subtitle settings")}
          onClick={onClose}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 7l10 10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            <path d="M17 7 7 17" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {!settings.voiceEnabled ? (
        <div className="studio-segment-editor__timeline-subtitle-menu-status">
          {workspaceText(
            locale,
            "В этой сцене нет озвучки. Субтитры недоступны.",
            "This scene has no voiceover, so subtitles are unavailable.",
          )}
        </div>
      ) : null}
      <div className="studio-segment-editor__timeline-subtitle-menu-section">
        <span className="studio-segment-editor__timeline-subtitle-menu-title">
          {workspaceText(locale, "Режим", "Mode")}
        </span>
        <div className="studio-subtitle-selector__styles">
          <button
            className={`studio-subtitle-selector__style${
              subtitleMenuType === "none" ? " is-selected" : ""
            }`}
            type="button"
            aria-pressed={subtitleMenuType === "none"}
            onClick={() => onDisable(segment.index)}
          >
            <span>{workspaceText(locale, "Без субтитров", "No subtitles")}</span>
          </button>
        </div>
      </div>
      <div className="studio-segment-editor__timeline-subtitle-menu-section">
        <span className="studio-segment-editor__timeline-subtitle-menu-title">
          {workspaceText(locale, "Стиль", "Style")}
        </span>
        <div className="studio-subtitle-selector__styles">
          {styleOptions.map((styleOption) => (
            <button
              key={`timeline-scene-subtitle-style:${styleOption.id}`}
              className={`studio-subtitle-selector__style${
                styleOption.id === settings.subtitleStyleId && subtitleMenuType !== "none"
                  ? " is-selected"
                  : ""
              }`}
              type="button"
              aria-pressed={styleOption.id === settings.subtitleStyleId && subtitleMenuType !== "none"}
              disabled={!settings.voiceEnabled}
              onClick={() => onStyleSelect(segment.index, styleOption.id)}
            >
              <span>{getStudioSubtitleStyleDisplayLabel(locale, styleOption)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="studio-segment-editor__timeline-subtitle-menu-section">
        <span className="studio-segment-editor__timeline-subtitle-menu-title">
          {workspaceText(locale, "Цвет", "Color")}
        </span>
        <div className="studio-subtitle-selector__colors">
          {colorOptions.map((color) => {
            const colorLabel = getStudioSubtitleColorDisplayLabel(locale, color);

            return (
              <button
                key={`timeline-scene-subtitle-color:${color.id}`}
                className={`studio-subtitle-selector__color${
                  color.id === settings.subtitleColorId && subtitleMenuType !== "none"
                    ? " is-selected"
                    : ""
                }`}
                type="button"
                aria-label={colorLabel}
                aria-pressed={color.id === settings.subtitleColorId && subtitleMenuType !== "none"}
                disabled={!settings.voiceEnabled}
                onClick={() => onColorSelect(segment.index, color.id)}
              >
                <span className="studio-subtitle-selector__color-swatch" style={{ background: color.accent }} aria-hidden="true"></span>
                <span>{colorLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="studio-segment-editor__timeline-text-menu-actions">
        <button type="button" onClick={onClose}>
          {workspaceText(locale, "Готово", "Done")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
