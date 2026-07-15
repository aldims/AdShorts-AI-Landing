import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../../lib/i18n";
import {
  getStudioSegmentSeedanceAudioCreditCost,
  getStudioSegmentPhotoAnimationDurationOptions,
  normalizeStudioSegmentPhotoAnimationDurationSeconds,
  resolveStudioSegmentSeedanceDurationSeconds,
  type StudioSegmentPhotoAnimationDurationSeconds,
  type StudioSegmentSeedanceDurationMode,
  type StudioSegmentVisualQuality,
} from "../../../shared/studio-credit-costs";
import { workspaceText } from "./workspace-page-model";

export type WorkspaceSegmentVisualQualityTooltip = {
  id: string;
  left: number;
  placement: "top" | "bottom";
  text: string;
  top: number;
};

export type WorkspaceSegmentVisualQualitySwitchOptions = {
  ariaLabel: string;
  className?: string;
  costForQuality: (quality: StudioSegmentVisualQuality) => number;
  disabled?: boolean;
  forcedPremiumDescription?: string;
  label?: string;
  onChange: (quality: StudioSegmentVisualQuality) => void;
  value: StudioSegmentVisualQuality;
};

export type WorkspaceSegmentPhotoAnimationDurationSwitchOptions = {
  className?: string;
  disabled?: boolean;
  label?: string;
  onChange: (durationSeconds: StudioSegmentPhotoAnimationDurationSeconds) => void;
  quality: StudioSegmentVisualQuality;
  value: StudioSegmentPhotoAnimationDurationSeconds;
};

export type WorkspaceSegmentSeedanceSettingsOptions = {
  className?: string;
  disabled?: boolean;
  durationMode: StudioSegmentSeedanceDurationMode;
  generateAudio: boolean;
  onDurationChange: (durationSeconds: StudioSegmentPhotoAnimationDurationSeconds) => void;
  onDurationModeChange: (mode: StudioSegmentSeedanceDurationMode) => void;
  onGenerateAudioChange: (generateAudio: boolean) => void;
  value: StudioSegmentPhotoAnimationDurationSeconds;
  voiceoverDurationSeconds?: number | null;
  voiceoverMatched?: boolean;
};

export const formatSegmentVisualCreditsLabel = (credits: number) => `${credits} ⚡`;

export const renderSegmentPaidActionContent = (
  _actionLabel: string,
  credits: number,
  isBusy: boolean,
  _busyLabel: string,
) =>
  isBusy ? (
    <span className="studio-ai-photo-modal__action-spinner" aria-hidden="true"></span>
  ) : (
    <span className="studio-ai-photo-modal__action-cost" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{formatSegmentVisualCreditsLabel(credits)}</span>
    </span>
  );

export const renderWorkspaceSegmentVisualQualitySwitch = (
  locale: Locale,
  segmentVisualQualityTooltip: WorkspaceSegmentVisualQualityTooltip | null,
  setSegmentVisualQualityTooltip: Dispatch<SetStateAction<WorkspaceSegmentVisualQualityTooltip | null>>,
  options: WorkspaceSegmentVisualQualitySwitchOptions,
) => {
  const premiumTooltipId = `${options.className ?? "default"}:${options.ariaLabel}:premium`;
  const premiumDescription =
    options.forcedPremiumDescription ??
    workspaceText(
      locale,
      "Используются продвинутые AI модели, качество визуала заметно выше.",
      "Uses advanced AI models, and visual quality is noticeably higher.",
    );
  const isPremium = options.value === "premium";
  const isPremiumForced = Boolean(options.forcedPremiumDescription && isPremium);
  const showPremiumTooltip = (button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const tooltipHalfWidth = 156;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, tooltipHalfWidth + 10),
      Math.max(tooltipHalfWidth + 10, viewportWidth - tooltipHalfWidth - 10),
    );
    const hasRoomAbove = rect.top > 96;

    setSegmentVisualQualityTooltip({
      id: premiumTooltipId,
      left,
      placement: hasRoomAbove ? "top" : "bottom",
      text: premiumDescription,
      top: hasRoomAbove ? rect.top : rect.bottom,
    });
  };
  const hidePremiumTooltip = () => {
    setSegmentVisualQualityTooltip((current) => (current?.id === premiumTooltipId ? null : current));
  };

  return (
    <>
      <div
        className={`studio-segment-visual-quality${options.className ? ` ${options.className}` : ""}`}
        role="group"
        aria-label={options.ariaLabel}
      >
        {options.label ? <span className="studio-segment-visual-quality__caption">{options.label}</span> : null}
        <div className="studio-segment-visual-quality__control">
          <button
            className={`studio-segment-visual-quality__switch${
              isPremium ? " is-active" : ""
            }`}
            type="button"
            role="switch"
            aria-label={`Premium. ${premiumDescription}`}
            aria-checked={isPremium}
            disabled={options.disabled}
            onBlur={hidePremiumTooltip}
            onClick={() => {
              if (isPremiumForced) {
                return;
              }
              options.onChange(isPremium ? "standard" : "premium");
            }}
            onFocus={(event) => {
              showPremiumTooltip(event.currentTarget);
            }}
            onMouseEnter={(event) => {
              showPremiumTooltip(event.currentTarget);
            }}
            onMouseLeave={hidePremiumTooltip}
          >
            <span className="studio-segment-visual-quality__switch-label">Premium</span>
            <span className="studio-segment-visual-quality__switch-track" aria-hidden="true">
              <span className="studio-segment-visual-quality__switch-thumb"></span>
            </span>
          </button>
        </div>
      </div>
      {segmentVisualQualityTooltip?.id === premiumTooltipId && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`studio-segment-visual-quality-tooltip is-${segmentVisualQualityTooltip.placement}`}
              role="tooltip"
              style={{
                left: segmentVisualQualityTooltip.left,
                top: segmentVisualQualityTooltip.top,
              }}
            >
              {segmentVisualQualityTooltip.text}
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

export const renderWorkspaceSegmentPhotoAnimationDurationSwitch = (
  locale: Locale,
  options: WorkspaceSegmentPhotoAnimationDurationSwitchOptions,
) => {
  const durationOptions = getStudioSegmentPhotoAnimationDurationOptions(options.quality);
  const normalizedValue = normalizeStudioSegmentPhotoAnimationDurationSeconds(options.quality, options.value);

  return (
    <div
      className={`studio-segment-photo-animation-duration${options.className ? ` ${options.className}` : ""}`}
      role="radiogroup"
      aria-label={workspaceText(locale, "Длительность ИИ анимации", "AI animation duration")}
    >
      {options.label ? <span className="studio-segment-photo-animation-duration__caption">{options.label}</span> : null}
      <div className="studio-segment-photo-animation-duration__control">
        {durationOptions.map((durationSeconds) => {
          const isActive = durationSeconds === normalizedValue;
          const durationLabel = workspaceText(locale, `${durationSeconds}с`, `${durationSeconds}s`);

          return (
            <button
              key={`${options.quality}-${durationSeconds}`}
              className={`studio-segment-photo-animation-duration__option${isActive ? " is-active" : ""}`}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={options.disabled}
              title={durationLabel}
              onClick={() => options.onChange(durationSeconds)}
            >
              <span>{durationLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const renderWorkspaceSegmentSeedanceSettings = (
  locale: Locale,
  options: WorkspaceSegmentSeedanceSettingsOptions,
) => {
  const normalizedManualDuration = normalizeStudioSegmentPhotoAnimationDurationSeconds("premium", options.value);
  const effectiveDuration = resolveStudioSegmentSeedanceDurationSeconds({
    durationMode: options.durationMode,
    manualDurationSeconds: normalizedManualDuration,
    voiceoverDurationSeconds: options.voiceoverDurationSeconds,
  });
  const voiceoverDuration = resolveStudioSegmentSeedanceDurationSeconds({
    durationMode: "voiceover",
    manualDurationSeconds: normalizedManualDuration,
    voiceoverDurationSeconds: options.voiceoverDurationSeconds,
  });
  const hasVoiceover = Number.isFinite(Number(options.voiceoverDurationSeconds)) && Number(options.voiceoverDurationSeconds) > 0;
  const isVoiceoverMode = options.durationMode === "voiceover";
  const isVoiceoverMatched = options.voiceoverMatched === true;
  const audioCreditCost = getStudioSegmentSeedanceAudioCreditCost(effectiveDuration, true);
  const manualDurationOptions = getStudioSegmentPhotoAnimationDurationOptions("premium");

  const durationControl = (
    <div
      className={`studio-segment-seedance-settings__duration${isVoiceoverMatched ? " is-manual-only" : ""}`}
      role="group"
      aria-label={workspaceText(locale, "Длительность видео", "Video duration")}
    >
      {!isVoiceoverMatched ? (
        <button
          className={`studio-segment-seedance-settings__voice${isVoiceoverMode ? " is-active" : ""}`}
          type="button"
          role="radio"
          aria-checked={isVoiceoverMode}
          disabled={options.disabled}
          title={
            hasVoiceover
              ? workspaceText(locale, "Длительность по текущей озвучке", "Match the current voiceover")
              : workspaceText(locale, "Озвучки нет — будет использовано 5 секунд", "No voiceover — 5 seconds will be used")
          }
          onClick={() => options.onDurationModeChange("voiceover")}
        >
          <span>{workspaceText(locale, "По озвучке", "Voiceover")}</span>
          <strong>{`${voiceoverDuration}${workspaceText(locale, "с", "s")}`}</strong>
        </button>
      ) : null}
      <label
        className={`studio-segment-seedance-settings__manual${!isVoiceoverMode || isVoiceoverMatched ? " is-active" : ""}`}
      >
        <span>
          {isVoiceoverMatched
            ? workspaceText(locale, "Продлить на", "Extend by")
            : workspaceText(locale, "Вручную", "Manual")}
        </span>
        <span className="studio-segment-seedance-settings__manual-value">
          <select
            value={normalizedManualDuration}
            disabled={options.disabled}
            aria-label={
              isVoiceoverMatched
                ? workspaceText(locale, "На сколько продлить видео", "Video extension duration")
                : workspaceText(locale, "Ручная длительность видео", "Manual video duration")
            }
            onFocus={() => options.onDurationModeChange("manual")}
            onPointerDown={() => options.onDurationModeChange("manual")}
            onChange={(event) => {
              options.onDurationModeChange("manual");
              options.onDurationChange(
                normalizeStudioSegmentPhotoAnimationDurationSeconds("premium", event.currentTarget.value),
              );
            }}
          >
            {manualDurationOptions.map((durationSeconds) => (
              <option key={durationSeconds} value={durationSeconds}>
                {durationSeconds} {workspaceText(locale, "сек", "sec")}
              </option>
            ))}
          </select>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="m3 4.75 3 3 3-3" />
          </svg>
        </span>
      </label>
    </div>
  );
  const audioControl = (
    <button
      className={`studio-segment-seedance-settings__audio${options.generateAudio ? " is-active" : ""}`}
      type="button"
      role="switch"
      aria-checked={options.generateAudio}
      disabled={options.disabled}
      title={workspaceText(
        locale,
        `Сгенерировать звук вместе с видео: +${audioCreditCost} кредитов`,
        `Generate sound with the video: +${audioCreditCost} credits`,
      )}
      onClick={() => options.onGenerateAudioChange(!options.generateAudio)}
    >
      <span className="studio-segment-seedance-settings__audio-copy">
        <strong>{workspaceText(locale, "Звук", "Sound")}</strong>
        <small>+{audioCreditCost} ⚡</small>
      </span>
      <span className="studio-segment-seedance-settings__audio-track" aria-hidden="true">
        <span />
      </span>
    </button>
  );

  return (
    <div
      className={`studio-segment-seedance-settings${options.className ? ` ${options.className}` : ""}`}
    >
      {durationControl}
      {audioControl}
    </div>
  );
};

export const renderSegmentAiPhotoModalSourceButton = ({
  title,
  description,
  footer,
  isActive = false,
  isSelectable = true,
  disabled = false,
  buttonTitle,
  onClick,
}: {
  title: string;
  description: string;
  footer?: ReactNode;
  isActive?: boolean;
  isSelectable?: boolean;
  disabled?: boolean;
  buttonTitle?: string;
  onClick: () => void;
}) => (
  <button
    className={`studio-ai-photo-modal__source-tab${isActive ? " is-active" : ""}`}
    type="button"
    aria-pressed={isSelectable ? isActive : undefined}
    disabled={disabled}
    title={buttonTitle}
    onClick={onClick}
  >
    <span className="studio-ai-photo-modal__source-copy">
      <strong>{title}</strong>
      <span>{description}</span>
    </span>
    {footer}
  </button>
);
