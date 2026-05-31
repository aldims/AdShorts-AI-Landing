import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../../lib/i18n";
import {
  getStudioSegmentPhotoAnimationDurationOptions,
  normalizeStudioSegmentPhotoAnimationDurationSeconds,
  type StudioSegmentPhotoAnimationDurationSeconds,
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
