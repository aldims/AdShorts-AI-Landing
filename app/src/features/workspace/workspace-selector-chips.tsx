import {
  type CSSProperties,
  type ChangeEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  STUDIO_PREMIUM_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST,
} from "../../../shared/studio-credit-costs";
import { useLocale } from "../../lib/i18n";
import {
  getStudioBrandSummary,
  STUDIO_BRAND_TEXT_MAX_CHARS,
} from "./workspace-brand-helpers";
import {
  fallbackStudioSubtitleColorOption,
  fallbackStudioSubtitleStyleOption,
  getStudioCustomAssetPreviewUrl,
  getStudioVideoChipValue,
  getStudioVideoOptionCopy,
  hasStudioBranding,
  studioVideoOptions,
  truncateStudioCustomAssetName,
} from "./workspace-segment-editor";
import { getStudioMusicChipValue } from "./workspace-segment-visual-helpers";
import {
  buildStudioSubtitlePreviewLines,
  getStudioSubtitleLogicLabel,
  getStudioSubtitlePreviewStyle,
  getStudioSubtitleStyleDisplayDescription,
  getStudioSubtitleStyleDisplayLabel,
  getStudioSubtitleTransitionLabel,
  studioSubtitleExampleOptions,
  studioSubtitleStyleUsesAccentColor,
  type StudioSubtitleExampleOption,
} from "./workspace-subtitle-preview-helpers";
import {
  getStudioMusicOptionCopy,
  studioMusicOptions,
  studioMusicStyleOptions,
  type StudioMusicType,
} from "./workspace-studio-options";
import type {
  StudioBrandLogoFile,
  StudioCustomMusicFile,
  StudioCustomVideoFile,
  StudioLanguage,
  StudioSubtitleColorOption,
  StudioSubtitleStyleOption,
  StudioVideoMode,
  StudioVoiceOption,
} from "./workspace-types";

type StudioLanguageOption = {
  description: string;
  id: StudioLanguage;
  label: string;
};

export const studioLanguageOptions: StudioLanguageOption[] = [
  {
    id: "ru",
    label: "Русский",
    description: "Русскоязычные голоса",
  },
  {
    id: "en",
    label: "Английский",
    description: "Англоязычные голоса",
  },
];

const STUDIO_PREMIUM_VIDEO_EXTRA_CREDIT_COST =
  STUDIO_PREMIUM_VIDEO_GENERATION_CREDIT_COST - STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST;

export type StudioMenuAnchorRect = Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width" | "height">;

export const getStudioMenuAnchorRect = (element: Element): StudioMenuAnchorRect => {
  const rect = element.getBoundingClientRect();
  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
};

export const getStudioCompactMenuStyle = ({
  estimatedMenuHeight,
  minWidth,
  preferredWidth,
  triggerRect,
}: {
  estimatedMenuHeight: number;
  minWidth: number;
  preferredWidth?: number;
  triggerRect: StudioMenuAnchorRect;
}): CSSProperties => {
  const safePreferredWidth = preferredWidth ?? triggerRect.width;
  const menuWidth = Math.min(
    Math.max(minWidth, Math.round(Math.max(triggerRect.width, safePreferredWidth))),
    window.innerWidth - 32,
  );
  const nextLeft = Math.min(Math.max(16, triggerRect.left), window.innerWidth - menuWidth - 16);
  const availableAbove = Math.max(96, triggerRect.top - 24);
  const availableBelow = Math.max(96, window.innerHeight - triggerRect.bottom - 24);
  const shouldOpenDownward = availableAbove < estimatedMenuHeight && availableBelow > availableAbove;

  if (shouldOpenDownward) {
    const nextTop = Math.min(window.innerHeight - 16, triggerRect.bottom + 12);
    return {
      left: `${nextLeft}px`,
      top: `${nextTop}px`,
      minWidth: `${menuWidth}px`,
      maxHeight: `${availableBelow}px`,
      transform: "none",
    };
  }

  const nextTop = Math.max(16, triggerRect.top - 12);
  return {
    left: `${nextLeft}px`,
    top: `${nextTop}px`,
    minWidth: `${menuWidth}px`,
    maxHeight: `${availableAbove}px`,
    transform: "translateY(-100%)",
  };
};

type StudioSubtitleSelectorChipProps = {
  closeRequestId?: number;
  disabledReason?: string;
  isDisabled?: boolean;
  isProgrammaticOnly?: boolean;
  isEnabled: boolean;
  openAnchorRect?: StudioMenuAnchorRect | null;
  openRequestId?: number;
  onOpenChange?: (isOpen: boolean) => void;
  onSelectColor: (colorId: StudioSubtitleColorOption["id"]) => void;
  onSelectExample: (exampleId: StudioSubtitleExampleOption["id"]) => void;
  onSelectStyle: (styleId: StudioSubtitleStyleOption["id"]) => void;
  onToggleEnabled: (enabled: boolean) => void;
  selectedColorId: StudioSubtitleColorOption["id"];
  selectedExampleId: StudioSubtitleExampleOption["id"];
  selectedStyleId: StudioSubtitleStyleOption["id"];
  subtitleColorOptions: StudioSubtitleColorOption[];
  subtitleStyleOptions: StudioSubtitleStyleOption[];
  variant?: "chip" | "sidebar";
};

type StudioLanguageSelectorChipProps = {
  onSelect: (language: StudioLanguage) => void;
  selectedLanguage: StudioLanguage;
  variant?: "chip" | "sidebar";
};

export type StudioVoiceSelectorGenerationSelection = {
  isEnabled: boolean;
  language: StudioLanguage | null;
  voiceId: StudioVoiceOption["id"] | null;
};

type StudioVoiceSelectorChipProps = {
  bulkTextError?: string | null;
  bulkTextSegmentCount?: number;
  bulkTextValue?: string;
  closeRequestId?: number;
  disabledValueLabel?: string;
  generateVoiceoverCostLabel?: string;
  generateVoiceoverDisabledReason?: string | null;
  generateVoiceoverLabel?: string;
  isProgrammaticOnly?: boolean;
  isGeneratingVoiceover?: boolean;
  isEnabled: boolean;
  openAnchorRect?: StudioMenuAnchorRect | null;
  openRequestId?: number;
  onBulkTextChange?: (value: string) => void;
  onBulkTextSave?: () => boolean | void;
  onGenerateVoiceover?: (selection: StudioVoiceSelectorGenerationSelection) => void;
  onOpenChange?: (isOpen: boolean) => void;
  onSelect: (voiceId: StudioVoiceOption["id"]) => void;
  onSelectLanguage?: (language: StudioLanguage) => void;
  onToggleEnabled: (enabled: boolean) => void;
  selectedLanguage?: StudioLanguage;
  selectedVoiceId: StudioVoiceOption["id"];
  triggerLabel?: string;
  voiceOptions: StudioVoiceOption[];
  variant?: "chip" | "sidebar";
};

type StudioMusicSelectorChipProps = {
  closeRequestId?: number;
  customMusicFile: StudioCustomMusicFile | null;
  isProgrammaticOnly?: boolean;
  isPreparingCustomMusic: boolean;
  openAnchorRect?: StudioMenuAnchorRect | null;
  openRequestId?: number;
  onOpenChange?: (isOpen: boolean) => void;
  onSelectCustomFile: (file: File) => Promise<boolean | void>;
  onSelectMusicType: (musicType: StudioMusicType) => void;
  selectedMusicType: StudioMusicType;
  uploadError: string | null;
  variant?: "chip" | "sidebar";
};

type StudioVideoSelectorChipProps = {
  brandLogoFile: StudioBrandLogoFile | null;
  brandText: string;
  brandUploadError: string | null;
  customVideoFile: StudioCustomVideoFile | null;
  isPreparingBrandLogo: boolean;
  isPreparingCustomVideo: boolean;
  onBrandLogoSelect: (file: File) => Promise<void>;
  onBrandTextChange: (value: string) => void;
  onClearBrandText: () => void;
  onRemoveBrandLogo: () => void;
  onSelectCustomFile: (file: File) => Promise<void>;
  onSelectVideoMode: (videoMode: StudioVideoMode) => void;
  selectedVideoMode: StudioVideoMode;
  uploadError: string | null;
};

type StudioBrandSelectorChipProps = {
  appliedBrandLogoFile: StudioBrandLogoFile | null;
  appliedBrandText: string;
  appliedSystemWatermarkEnabled?: boolean;
  brandLogoFile: StudioBrandLogoFile | null;
  brandText: string;
  brandUploadError: string | null;
  closeRequestId?: number;
  isDirty: boolean;
  isProgrammaticOnly?: boolean;
  isPreparingBrandLogo: boolean;
  openAnchorRect?: StudioMenuAnchorRect | null;
  openRequestId?: number;
  onApplyBrand: () => void;
  onBrandLogoSelect: (file: File) => Promise<void>;
  onBrandTextChange: (value: string) => void;
  onClearBrandText: () => void;
  onOpenChange?: (isOpen: boolean) => void;
  onRemoveBrandLogo: () => void;
  onSystemWatermarkToggle?: (enabled: boolean) => void;
  showSystemWatermarkControl?: boolean;
  systemWatermarkEnabled?: boolean;
};

export function StudioSubtitleSelectorChip({
  closeRequestId = 0,
  disabledReason,
  isDisabled = false,
  isProgrammaticOnly = false,
  isEnabled,
  openAnchorRect = null,
  openRequestId = 0,
  onOpenChange,
  onSelectColor,
  onSelectExample,
  onSelectStyle,
  onToggleEnabled,
  selectedColorId,
  selectedExampleId,
  selectedStyleId,
  subtitleColorOptions,
  subtitleStyleOptions,
  variant = "chip",
}: StudioSubtitleSelectorChipProps) {
  const { locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [requestAnchorRect, setRequestAnchorRect] = useState<StudioMenuAnchorRect | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lastHandledOpenRequestIdRef = useRef(0);
  const lastReportedOpenRef = useRef(isOpen);
  const safeStyleOptions = subtitleStyleOptions.length ? subtitleStyleOptions : [fallbackStudioSubtitleStyleOption];
  const safeColorOptions = subtitleColorOptions.length ? subtitleColorOptions : [fallbackStudioSubtitleColorOption];
  const selectedStyle = safeStyleOptions.find((style) => style.id === selectedStyleId) ?? safeStyleOptions[0];
  const selectedColor = safeColorOptions.find((color) => color.id === selectedColorId) ?? safeColorOptions[0];
  const selectedStyleLabel = getStudioSubtitleStyleDisplayLabel(locale, selectedStyle);
  const previewStyle = getStudioSubtitlePreviewStyle(selectedStyle, selectedColor);
  const previewColorLabel = studioSubtitleStyleUsesAccentColor(selectedStyle)
    ? selectedColor.label
    : locale === "en"
      ? "White text"
      : "Белый текст";
  const styleLogicLabel = getStudioSubtitleLogicLabel(selectedStyle, locale);
  const transitionLabel = getStudioSubtitleTransitionLabel(selectedStyle, locale);
  const isSidebarVariant = variant === "sidebar";
  const resolvedDisabledReason =
    disabledReason ?? (locale === "en" ? "Turn voiceover on before using subtitles" : "Включите озвучку, чтобы использовать субтитры");

  useEffect(() => {
    if (openRequestId <= 0 || lastHandledOpenRequestIdRef.current === openRequestId) {
      return;
    }

    lastHandledOpenRequestIdRef.current = openRequestId;
    if (isDisabled) {
      setRequestAnchorRect(null);
      setIsOpen(false);
      return;
    }

    setRequestAnchorRect(openAnchorRect);
    setIsOpen(true);
    if (!openAnchorRect) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [isDisabled, openAnchorRect, openRequestId]);

  useEffect(() => {
    if (closeRequestId <= 0) {
      return;
    }

    setRequestAnchorRect(null);
    setIsOpen(false);
  }, [closeRequestId]);

  useEffect(() => {
    if (!isDisabled) {
      return;
    }

    setRequestAnchorRect(null);
    setIsOpen(false);
  }, [isDisabled]);

  useEffect(() => {
    if (lastReportedOpenRef.current === isOpen) {
      return;
    }

    lastReportedOpenRef.current = isOpen;
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const triggerRect = requestAnchorRect ?? triggerRef.current?.getBoundingClientRect();
      const menuRect = menuRef.current?.getBoundingClientRect();
      if (!triggerRect || !menuRect) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const menuWidth = Math.min(Math.max(680, Math.round(triggerRect.width * 2.4)), viewportWidth - 32, 760);
      const nextLeft = Math.min(Math.max(16, triggerRect.left), viewportWidth - menuWidth - 16);
      const availableAbove = triggerRect.top - 16;
      const availableBelow = viewportHeight - triggerRect.bottom - 16;
      const shouldOpenBelow = availableBelow >= menuRect.height || availableBelow > availableAbove;
      const nextTop = shouldOpenBelow
        ? Math.min(viewportHeight - menuRect.height - 16, triggerRect.bottom + 12)
        : Math.max(16, triggerRect.top - menuRect.height - 12);

      setMenuStyle({
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        width: `${menuWidth}px`,
      });
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, requestAnchorRect]);

  return (
    <div className={`studio-subtitle-selector${isSidebarVariant ? " studio-subtitle-selector--sidebar" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        className={
          isSidebarVariant
            ? `studio-subtitle-selector__trigger studio-subtitle-selector__trigger--sidebar studio-sidebar__item studio-sidebar__item--static${
                isOpen ? " is-open" : ""
              }${isDisabled ? " is-disabled" : ""}`
            : `studio-canvas-prompt__chip studio-subtitle-selector__trigger${isOpen ? " is-open" : ""}${
                isDisabled ? " is-disabled" : ""
              }`
        }
        type="button"
        tabIndex={isProgrammaticOnly ? -1 : undefined}
        aria-haspopup="menu"
        aria-expanded={!isDisabled && isOpen}
        aria-controls={menuId}
        disabled={isDisabled}
        title={isDisabled ? resolvedDisabledReason : undefined}
        onClick={() => {
          if (isDisabled) {
            return;
          }

          setRequestAnchorRect(null);
          setIsOpen((open) => !open);
        }}
      >
        {isSidebarVariant ? (
          <>
            <span className="studio-sidebar__item-icon studio-sidebar__item-icon--subtitles" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <rect x="3.25" y="5.25" width="17.5" height="13.5" rx="3.25" stroke="currentColor" strokeWidth="1.9" />
                <path d="M7 11.2h4.1M7 14.6h6.2M14.3 11.2H17M16 14.6h1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </span>
            <span className="studio-sidebar__item-copy">
              <strong>{locale === "en" ? "Subtitles" : "Субтитры"}</strong>
              <span className="studio-sidebar__item-value">{isEnabled ? selectedStyleLabel : locale === "en" ? "Off" : "Выкл"}</span>
            </span>
            <svg
              className="studio-subtitle-selector__icon studio-subtitle-selector__icon--sidebar"
              width="14"
              height="14"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          <>
            <span className="studio-subtitle-selector__label">{locale === "en" ? "Subtitles" : "Субтитры"}</span>
            <strong className="studio-subtitle-selector__value">{isEnabled ? selectedStyleLabel : locale === "en" ? "Off" : "Выкл"}</strong>
            <svg className="studio-subtitle-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="studio-subtitle-selector__menu"
              id={menuId}
              role="menu"
              aria-label={locale === "en" ? "Subtitle settings" : "Настройки субтитров"}
              style={
                menuStyle ?? {
                  left: "16px",
                  top: "16px",
                  visibility: "hidden",
                  pointerEvents: "none",
                }
              }
            >
              <div className="studio-subtitle-selector__section">
                <div className="studio-subtitle-selector__section-head">
                  <span>{locale === "en" ? "Mode" : "Режим"}</span>
                </div>
                <div className="studio-subtitle-selector__styles">
                  <button
                    className={`studio-subtitle-selector__style${!isEnabled ? " is-selected" : ""}`}
                    type="button"
                    onClick={() => {
                      onToggleEnabled(false);
                      setIsOpen(false);
                    }}
                  >
                    <span>{locale === "en" ? "No subtitles" : "Без субтитров"}</span>
                    <small>{locale === "en" ? "Hide captions completely in the video" : "Полностью скрыть титры в ролике"}</small>
                  </button>
                </div>
              </div>

              <div className="studio-subtitle-selector__section">
                <div className="studio-subtitle-selector__section-head">
                  <span>{locale === "en" ? "Style" : "Стиль"}</span>
                </div>
                <div className="studio-subtitle-selector__styles">
                  {safeStyleOptions.map((style) => (
                    <button
                      key={style.id}
                      className={`studio-subtitle-selector__style${style.id === selectedStyleId ? " is-selected" : ""}`}
                      type="button"
                      onClick={() => {
                        onToggleEnabled(true);
                        onSelectStyle(style.id);
                      }}
                    >
                      <span>{getStudioSubtitleStyleDisplayLabel(locale, style)}</span>
                      <small>{getStudioSubtitleStyleDisplayDescription(locale, style)}</small>
                    </button>
                ))}
                </div>
              </div>

              <div className="studio-subtitle-selector__section">
                <div className="studio-subtitle-selector__section-head">
                  <span>{locale === "en" ? "Color" : "Цвет"}</span>
                </div>
                <div className="studio-subtitle-selector__colors">
                  {safeColorOptions.map((color) => (
                    <button
                      key={color.id}
                      className={`studio-subtitle-selector__color${color.id === selectedColorId ? " is-selected" : ""}`}
                      type="button"
                      onClick={() => onSelectColor(color.id)}
                    >
                      <span className="studio-subtitle-selector__color-swatch" style={{ background: color.accent }} aria-hidden="true"></span>
                      <span>{color.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="studio-subtitle-selector__section">
                <div className="studio-subtitle-selector__section-head">
                  <span>{locale === "en" ? "Examples" : "Примеры"}</span>
                </div>
                <div className="studio-subtitle-selector__examples">
                  {studioSubtitleExampleOptions.map((example) => {
                    const previewLines = buildStudioSubtitlePreviewLines(example, selectedStyle);

                    return (
                      <button
                        key={example.id}
                        className={`studio-subtitle-selector__example${example.id === selectedExampleId ? " is-selected" : ""}`}
                        type="button"
                        onClick={() => onSelectExample(example.id)}
                      >
                        <span className="studio-subtitle-selector__example-label">{example.label}</span>
                        <small className="studio-subtitle-selector__example-note">{example.note}</small>
                        <div
                          className="studio-subtitle-selector__example-stage"
                          data-style={selectedStyle.id}
                          data-uses-accent={studioSubtitleStyleUsesAccentColor(selectedStyle) ? "true" : "false"}
                          style={previewStyle}
                          aria-hidden="true"
                        >
                          <div className="studio-subtitle-selector__example-video-meta">
                            <span>{selectedStyleLabel}</span>
                            <span>{previewColorLabel}</span>
                          </div>
                          <div
                            className="studio-subtitle-selector__example-caption"
                            data-logic={selectedStyle.logicMode}
                            data-style={selectedStyle.id}
                          >
                            {previewLines.map((line, lineIndex) => (
                              <span key={`${example.id}-line-${lineIndex}`} className="studio-subtitle-selector__example-line">
                                {line.map((word, wordIndex) => (
                                  <span
                                    key={`${example.id}-word-${lineIndex}-${wordIndex}`}
                                    className={`studio-subtitle-selector__example-word is-${word.state}`}
                                  >
                                    {word.text}
                                  </span>
                                ))}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="studio-subtitle-selector__example-tags" aria-hidden="true">
                          <span>{selectedStyle.fontFamily}</span>
                          <span>{styleLogicLabel}</span>
                          <span>{transitionLabel}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function StudioLanguageSelectorChip({ onSelect, selectedLanguage, variant = "chip" }: StudioLanguageSelectorChipProps) {
  const { locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = studioLanguageOptions.find((option) => option.id === selectedLanguage) ?? studioLanguageOptions[0];
  const getLanguageLabel = (language: StudioLanguage) =>
    locale === "en" ? (language === "en" ? "English" : "Russian") : language === "en" ? "Английский" : "Русский";
  const getLanguageDescription = (language: StudioLanguage) =>
    locale === "en"
      ? language === "en"
        ? "English voices"
        : "Russian voices"
      : language === "en"
        ? "Англоязычные голоса"
        : "Русскоязычные голоса";
  const isSidebarVariant = variant === "sidebar";

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const estimatedMenuHeight = Math.min(window.innerHeight - 32, 48 + studioLanguageOptions.length * 58);
      setMenuStyle(
        getStudioCompactMenuStyle({
          estimatedMenuHeight,
          minWidth: 228,
          triggerRect,
        }),
      );
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  return (
    <div
      className={`studio-voice-selector studio-voice-selector--language${isSidebarVariant ? " studio-voice-selector--sidebar" : ""}`}
      ref={rootRef}
    >
      <button
        ref={triggerRef}
        className={
          isSidebarVariant
            ? `studio-voice-selector__trigger studio-voice-selector__trigger--sidebar studio-sidebar__item studio-sidebar__item--static${
                isOpen ? " is-open" : ""
              }`
            : `studio-canvas-prompt__chip studio-voice-selector__trigger${isOpen ? " is-open" : ""}`
        }
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isSidebarVariant ? (
          <>
            <span className="studio-sidebar__item-icon studio-sidebar__item-icon--language" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.9" />
                <path d="M4 12h16M12 3.75c2.2 2.45 3.2 5.2 3.2 8.25S14.2 17.8 12 20.25M12 3.75C9.8 6.2 8.8 8.95 8.8 12s1 5.8 3.2 8.25" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
                <path d="M7.2 7.25c1.25.72 2.86 1.12 4.8 1.12s3.55-.4 4.8-1.12M7.2 16.75c1.25-.72 2.86-1.12 4.8-1.12s3.55.4 4.8 1.12" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" opacity="0.82" />
              </svg>
            </span>
            <span className="studio-sidebar__item-copy">
              <strong>{locale === "en" ? "Language" : "Язык"}</strong>
              <span className="studio-sidebar__item-value">{selectedOption ? getLanguageLabel(selectedOption.id) : getLanguageLabel("ru")}</span>
            </span>
            <svg className="studio-voice-selector__icon studio-voice-selector__icon--sidebar" width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          <>
            <span className="studio-voice-selector__label">{locale === "en" ? "Language" : "Язык"}</span>
            <strong className="studio-voice-selector__value">{selectedOption ? getLanguageLabel(selectedOption.id) : getLanguageLabel("ru")}</strong>
            <svg className="studio-voice-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>

      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="studio-voice-selector__menu"
              id={menuId}
              role="menu"
              aria-label={locale === "en" ? "Language selection" : "Выбор языка"}
              style={menuStyle}
            >
              <span className="studio-voice-selector__menu-title">{locale === "en" ? "Choose language" : "Выберите язык"}</span>
              {studioLanguageOptions.map((option) => (
                <div
                  key={option.id}
                  className={`studio-voice-selector__option${option.id === selectedLanguage ? " is-selected" : ""}`}
                >
                  <button
                    className="studio-voice-selector__option-main"
                    type="button"
                    role="menuitemradio"
                    aria-checked={option.id === selectedLanguage}
                    onClick={() => {
                      onSelect(option.id);
                      setIsOpen(false);
                    }}
                  >
                    <span>{getLanguageLabel(option.id)}</span>
                    <small>{getLanguageDescription(option.id)}</small>
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function StudioVoiceSelectorChip({
  bulkTextError = null,
  bulkTextSegmentCount,
  bulkTextValue,
  closeRequestId = 0,
  disabledValueLabel,
  generateVoiceoverCostLabel,
  generateVoiceoverDisabledReason = null,
  generateVoiceoverLabel,
  isProgrammaticOnly = false,
  isGeneratingVoiceover = false,
  isEnabled,
  openAnchorRect = null,
  openRequestId = 0,
  onBulkTextChange,
  onBulkTextSave,
  onGenerateVoiceover,
  onOpenChange,
  onSelect,
  onSelectLanguage,
  onToggleEnabled,
  selectedLanguage,
  selectedVoiceId,
  triggerLabel,
  voiceOptions,
  variant = "chip",
}: StudioVoiceSelectorChipProps) {
  const { locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [requestAnchorRect, setRequestAnchorRect] = useState<StudioMenuAnchorRect | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<StudioVoiceOption["id"] | null>(null);
  const menuId = useId();
  const bulkTextAreaId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastHandledOpenRequestIdRef = useRef(0);
  const lastReportedOpenRef = useRef(isOpen);
  const selectedVoice = voiceOptions.find((voice) => voice.id === selectedVoiceId) ?? voiceOptions[0];
  const isSidebarVariant = variant === "sidebar";
  const hasLanguageSelector = Boolean(selectedLanguage && onSelectLanguage);
  const hasBulkTextEditor =
    typeof bulkTextValue === "string" &&
    typeof onBulkTextChange === "function";
  const hasVoiceoverGenerator = typeof onGenerateVoiceover === "function";
  const resolvedTriggerLabel = triggerLabel ?? (locale === "en" ? "Voiceover" : "Озвучка");
  const resolvedDisabledValueLabel = disabledValueLabel ?? (locale === "en" ? "Off" : "Выкл");
  const resolvedGenerateVoiceoverLabel =
    generateVoiceoverLabel ?? (locale === "en" ? "Generate voiceover" : "Сгенерировать озвучку");
  const getVoiceLanguageLabel = (language: StudioLanguage) =>
    locale === "en" ? (language === "en" ? "English" : "Russian") : language === "en" ? "Английский" : "Русский";
  const getVoiceLanguageDescription = (language: StudioLanguage) =>
    locale === "en"
      ? language === "en"
        ? "English voices"
        : "Russian voices"
      : language === "en"
        ? "Англоязычные голоса"
        : "Русскоязычные голоса";

  const stopVoicePreview = () => {
    const previewAudio = previewAudioRef.current;
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      previewAudio.onended = null;
      previewAudio.onerror = null;
      previewAudioRef.current = null;
    }

    setPreviewingVoiceId(null);
  };

  useEffect(() => {
    return () => {
      stopVoicePreview();
    };
  }, []);

  useEffect(() => {
    if (openRequestId <= 0 || lastHandledOpenRequestIdRef.current === openRequestId) {
      return;
    }

    lastHandledOpenRequestIdRef.current = openRequestId;
    stopVoicePreview();
    setRequestAnchorRect(openAnchorRect);
    setIsOpen(true);
    if (!openAnchorRect) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [openAnchorRect, openRequestId]);

  useEffect(() => {
    if (closeRequestId <= 0) {
      return;
    }

    stopVoicePreview();
    setRequestAnchorRect(null);
    setIsOpen(false);
  }, [closeRequestId]);

  useEffect(() => {
    if (lastReportedOpenRef.current === isOpen) {
      return;
    }

    lastReportedOpenRef.current = isOpen;
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!previewingVoiceId) return;
    if (voiceOptions.some((voice) => voice.id === previewingVoiceId)) return;
    stopVoicePreview();
  }, [previewingVoiceId, voiceOptions]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        stopVoicePreview();
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        stopVoicePreview();
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const triggerRect = requestAnchorRect ?? triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const estimatedMenuHeight = Math.min(
        window.innerHeight - 32,
        (hasBulkTextEditor ? 270 : 48) + Math.ceil((voiceOptions.length + 1) / (hasBulkTextEditor ? 2 : 1)) * 58 + (hasLanguageSelector ? 76 : 0),
      );
      setMenuStyle(
        getStudioCompactMenuStyle({
          estimatedMenuHeight,
          minWidth: hasBulkTextEditor ? 540 : 228,
          preferredWidth: hasBulkTextEditor ? 620 : undefined,
          triggerRect,
        }),
      );
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [hasBulkTextEditor, hasLanguageSelector, isOpen, requestAnchorRect, voiceOptions.length]);

  const handlePreviewVoice = async (voice: StudioVoiceOption) => {
    if (typeof window === "undefined") {
      return;
    }

    if (previewingVoiceId === voice.id) {
      stopVoicePreview();
      return;
    }

    stopVoicePreview();

    const previewUrl = voice.previewSampleUrl ?? null;

    if (!previewUrl || typeof Audio === "undefined") {
      return;
    }

    const previewAudio = new Audio(previewUrl);
    previewAudio.preload = "auto";
    previewAudio.onended = () => {
      previewAudioRef.current = null;
      setPreviewingVoiceId((current) => (current === voice.id ? null : current));
    };
    previewAudio.onerror = () => {
      previewAudioRef.current = null;
      setPreviewingVoiceId((current) => (current === voice.id ? null : current));
    };

    previewAudioRef.current = previewAudio;
    setPreviewingVoiceId(voice.id);

    try {
      await previewAudio.play();
    } catch {
      stopVoicePreview();
    }
  };

  return (
    <div className={`studio-voice-selector${isSidebarVariant ? " studio-voice-selector--sidebar" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        className={
          isSidebarVariant
            ? `studio-voice-selector__trigger studio-voice-selector__trigger--sidebar studio-sidebar__item studio-sidebar__item--static${
                isOpen ? " is-open" : ""
              }`
            : `studio-canvas-prompt__chip studio-voice-selector__trigger${isOpen ? " is-open" : ""}`
        }
        type="button"
        tabIndex={isProgrammaticOnly ? -1 : undefined}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => {
          setRequestAnchorRect(null);
          setIsOpen((open) => !open);
        }}
      >
        {isSidebarVariant ? (
          <>
            <span className="studio-sidebar__item-icon studio-sidebar__item-icon--voice" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M12 4.2v9.2" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" />
                <rect x="8.75" y="3.25" width="6.5" height="11.6" rx="3.25" stroke="currentColor" strokeWidth="2.05" />
                <path d="M6.75 10.9a5.25 5.25 0 0 0 10.5 0M12 17.45v2.2M8.6 19.65h6.8" stroke="currentColor" strokeWidth="2.05" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="studio-sidebar__item-copy">
              <strong>{resolvedTriggerLabel}</strong>
              <span className="studio-sidebar__item-value">{isEnabled ? selectedVoice?.label ?? (locale === "en" ? "Choose voice" : "Выберите голос") : resolvedDisabledValueLabel}</span>
            </span>
            <svg className="studio-voice-selector__icon studio-voice-selector__icon--sidebar" width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          <>
            <span className="studio-voice-selector__label">{resolvedTriggerLabel}</span>
            <strong className="studio-voice-selector__value">{isEnabled ? selectedVoice?.label ?? (locale === "en" ? "Choose voice" : "Выберите голос") : resolvedDisabledValueLabel}</strong>
            <svg className="studio-voice-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>

      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className={`studio-voice-selector__menu${hasBulkTextEditor ? " studio-voice-selector__menu--with-text" : ""}`}
              id={menuId}
              role="menu"
              aria-label={locale === "en" ? "Voice selection" : "Выбор голоса"}
              style={menuStyle}
            >
              {hasLanguageSelector && selectedLanguage && onSelectLanguage ? (
                <div className="studio-voice-selector__language-panel">
                  <span className="studio-voice-selector__language-title">
                    {locale === "en" ? "Voice language" : "Язык озвучки"}
                  </span>
                  <div className="studio-voice-selector__language-options">
                    {studioLanguageOptions.map((option) => {
                      const isSelectedLanguage = option.id === selectedLanguage;

                      return (
                        <button
                          key={`voice-language:${option.id}`}
                          className={`studio-voice-selector__language-option${isSelectedLanguage ? " is-selected" : ""}`}
                          type="button"
                          role="menuitemradio"
                          aria-checked={isSelectedLanguage}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            stopVoicePreview();
                            onSelectLanguage(option.id);
                          }}
                        >
                          <span>{getVoiceLanguageLabel(option.id)}</span>
                          <small>{getVoiceLanguageDescription(option.id)}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <span className="studio-voice-selector__menu-title">{locale === "en" ? "Choose voice" : "Выберите голос"}</span>
              <div className="studio-voice-selector__voice-grid">
                <div className={`studio-voice-selector__option studio-voice-selector__option--no-voice${!isEnabled ? " is-selected" : ""}`}>
                  <button
                    className="studio-voice-selector__option-main"
                    type="button"
                    role="menuitemradio"
                    aria-checked={!isEnabled}
                    onClick={() => {
                      stopVoicePreview();
                      onToggleEnabled(false);
                      if (!hasBulkTextEditor) {
                        setIsOpen(false);
                      }
                    }}
                  >
                    <span>{locale === "en" ? "No voiceover" : "Без озвучки"}</span>
                    <small>{locale === "en" ? "Keep the video without a voice track" : "Оставить ролик без голосовой дорожки"}</small>
                  </button>
                </div>
                {voiceOptions.map((voice) => (
                  (() => {
                    const canPreviewVoice = Boolean(voice.previewSampleUrl);
                    const isVoiceSelected = isEnabled && voice.id === selectedVoiceId;

                    return (
                      <div
                        key={voice.id}
                        className={`studio-voice-selector__option${isVoiceSelected ? " is-selected" : ""}`}
                      >
                        <button
                          className="studio-voice-selector__option-main"
                          type="button"
                          role="menuitemradio"
                          aria-checked={isVoiceSelected}
                          onClick={() => {
                            stopVoicePreview();
                            onToggleEnabled(true);
                            onSelect(voice.id);
                            if (!hasBulkTextEditor) {
                              setIsOpen(false);
                            }
                          }}
                        >
                          <span className="studio-voice-selector__option-title">
                            <span>{voice.label}</span>
                            {voice.badgeLabel ? (
                              <span className="studio-voice-selector__badge">{voice.badgeLabel}</span>
                            ) : null}
                            {voice.creditCost ? (
                              <span className="studio-voice-selector__cost">{voice.creditCost} ⚡</span>
                            ) : null}
                          </span>
                          <small>{voice.description}</small>
                        </button>
                        <button
                          className={`studio-voice-selector__preview${previewingVoiceId === voice.id ? " is-playing" : ""}`}
                          type="button"
                          aria-label={
                            !canPreviewVoice
                              ? `${locale === "en" ? "Preview unavailable" : "Превью недоступно"}: ${voice.label}`
                              : previewingVoiceId === voice.id
                                ? `${locale === "en" ? "Stop" : "Остановить"}: ${voice.label}`
                                : `${locale === "en" ? "Listen" : "Прослушать"}: ${voice.label}`
                          }
                          title={!canPreviewVoice ? (locale === "en" ? "Preview unavailable" : "Превью недоступно") : previewingVoiceId === voice.id ? (locale === "en" ? "Stop" : "Остановить") : (locale === "en" ? "Listen" : "Прослушать")}
                          disabled={!canPreviewVoice}
                          onClick={() => void handlePreviewVoice(voice)}
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
                  })()
                ))}
              </div>
              {hasBulkTextEditor ? (
                <div className="studio-voice-selector__bulk-text">
                  <div className="studio-voice-selector__bulk-head">
                    <label htmlFor={bulkTextAreaId}>{locale === "en" ? "Voiceover text" : "Текст озвучки"}</label>
                    {typeof bulkTextSegmentCount === "number" ? (
                      <small>{locale === "en" ? `${bulkTextSegmentCount} segments` : `${bulkTextSegmentCount} сцен`}</small>
                    ) : null}
                  </div>
                  <textarea
                    id={bulkTextAreaId}
                    className="studio-voice-selector__bulk-textarea"
                    value={bulkTextValue}
                    rows={6}
                    placeholder={locale === "en" ? "Enter the full voiceover text" : "Введите полный текст озвучки"}
                    onChange={(event) => onBulkTextChange?.(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        event.preventDefault();
                        setIsOpen(false);
                      }
                    }}
                  />
                  {bulkTextError ? <p className="studio-voice-selector__bulk-error">{bulkTextError}</p> : null}
                  {hasVoiceoverGenerator ? (
                    <div className="studio-voice-selector__bulk-actions">
                      <button
                        className="studio-voice-selector__bulk-save"
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const didSave = onBulkTextSave?.();
                          if (didSave === false) {
                            return;
                          }
                          stopVoicePreview();
                          setRequestAnchorRect(null);
                          setIsOpen(false);
                        }}
                      >
                        {locale === "en" ? "Save text" : "Сохранить текст"}
                      </button>
                      <button
                        className="studio-voice-selector__bulk-generate"
                        type="button"
                        disabled={Boolean(generateVoiceoverDisabledReason)}
                        aria-busy={isGeneratingVoiceover ? true : undefined}
                        aria-label={
                          generateVoiceoverDisabledReason
                            ? `${resolvedGenerateVoiceoverLabel}. ${generateVoiceoverDisabledReason}`
                            : resolvedGenerateVoiceoverLabel
                        }
                        title={generateVoiceoverDisabledReason ?? undefined}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onGenerateVoiceover?.({
                            isEnabled,
                            language: selectedLanguage ?? null,
                            voiceId: isEnabled ? selectedVoice?.id ?? selectedVoiceId ?? null : null,
                          });
                        }}
                      >
                        {isGeneratingVoiceover ? (
                          <span className="studio-segment-editor__prompt-action-spinner" aria-hidden="true"></span>
                        ) : null}
                        <span>{resolvedGenerateVoiceoverLabel}</span>
                        {generateVoiceoverCostLabel ? <small>{generateVoiceoverCostLabel}</small> : null}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function StudioVideoSelectorChip({
  brandLogoFile,
  brandText,
  brandUploadError,
  customVideoFile,
  isPreparingBrandLogo,
  isPreparingCustomVideo,
  onBrandLogoSelect,
  onBrandTextChange,
  onClearBrandText,
  onRemoveBrandLogo,
  onSelectCustomFile,
  onSelectVideoMode,
  selectedVideoMode,
  uploadError,
}: StudioVideoSelectorChipProps) {
  const { locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const brandLogoInputRef = useRef<HTMLInputElement | null>(null);
  const selectedVideoLabel = getStudioVideoChipValue(selectedVideoMode, customVideoFile, {
    brandLogoFile,
    brandText,
    locale,
  });
  const selectedVideoTitle = [customVideoFile?.fileName ?? selectedVideoLabel, hasStudioBranding({ brandLogoFile, brandText }) ? getStudioBrandSummary({ brandLogoFile, brandText }) : ""]
    .filter(Boolean)
    .join(" · ");
  const customVideoFileLabel = customVideoFile ? truncateStudioCustomAssetName(customVideoFile.fileName) : null;
  const brandLogoPreviewUrl = getStudioCustomAssetPreviewUrl(brandLogoFile);
  const brandTextLength = brandText.length;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const estimatedMenuHeight = Math.min(window.innerHeight - 32, 560);
      setMenuStyle(
        getStudioCompactMenuStyle({
          estimatedMenuHeight,
          minWidth: 332,
          preferredWidth: 388,
          triggerRect,
        }),
      );
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  const openCustomVideoPicker = () => {
    fileInputRef.current?.click();
  };

  const openBrandLogoPicker = () => {
    brandLogoInputRef.current?.click();
  };

  const handleCustomVideoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) return;

    await onSelectCustomFile(file);
  };

  const handleBrandLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) return;

    await onBrandLogoSelect(file);
  };

  const handleCustomVideoSelect = () => {
    if (customVideoFile) {
      onSelectVideoMode("custom");
      setIsOpen(false);
      return;
    }

    openCustomVideoPicker();
  };

  return (
    <div className="studio-video-selector" ref={rootRef}>
      <input
        ref={fileInputRef}
        className="studio-video-selector__file-input"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.avif,.mp4,.mov,.webm,.m4v,image/*,video/*"
        onChange={(event) => {
          void handleCustomVideoChange(event);
        }}
      />
      <input
        ref={brandLogoInputRef}
        className="studio-video-selector__file-input"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.avif,image/*"
        onChange={(event) => {
          void handleBrandLogoChange(event);
        }}
      />

      <button
        ref={triggerRef}
        className={`studio-canvas-prompt__chip studio-video-selector__trigger${isOpen ? " is-open" : ""}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="studio-video-selector__label">{locale === "en" ? "Visual" : "Визуал"}</span>
        <strong className="studio-video-selector__value" title={selectedVideoTitle}>
          {selectedVideoLabel}
        </strong>
        <svg className="studio-video-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="studio-video-selector__menu"
              id={menuId}
              role="menu"
              aria-label={locale === "en" ? "Visual mode selection" : "Выбор режима визуала"}
              style={menuStyle}
            >
              <span className="studio-video-selector__menu-title">{locale === "en" ? "Creation mode" : "Режим создания"}</span>
              <div className="studio-video-selector__options">
                {studioVideoOptions
                  .filter((option) => option.id !== "custom")
                  .map((option) => {
                    const optionCopy = getStudioVideoOptionCopy(option, locale);
                    const isPremiumVisualOption = option.id === "ai_photo";
                    return (
                      <button
                        key={option.id}
                        className={`studio-video-selector__option${selectedVideoMode === option.id ? " is-selected" : ""}`}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selectedVideoMode === option.id}
                        onClick={() => {
                          onSelectVideoMode(option.id);
                          setIsOpen(false);
                        }}
                      >
                        <span className="studio-video-selector__option-row">
                          <span className="studio-video-selector__option-title">
                            <span>{isPremiumVisualOption ? "Premium" : optionCopy.label}</span>
                            {isPremiumVisualOption ? (
                              <span className="studio-video-selector__cost">
                                {STUDIO_PREMIUM_VIDEO_EXTRA_CREDIT_COST} ⚡
                              </span>
                            ) : null}
                          </span>
                          {optionCopy.duration ? (
                            <span className="studio-video-selector__option-duration">{optionCopy.duration}</span>
                          ) : null}
                        </span>
                        <small>{optionCopy.description}</small>
                        {optionCopy.detail ? <small className="studio-video-selector__option-detail">{optionCopy.detail}</small> : null}
                      </button>
                    );
                  })}
              </div>

              <div className="studio-video-selector__section">
                <span className="studio-video-selector__menu-title">{locale === "en" ? "Upload custom visual" : "Загрузить свой визуал"}</span>
                <div className={`studio-video-selector__custom${selectedVideoMode === "custom" ? " is-selected" : ""}`}>
                  <button
                    className="studio-video-selector__custom-main"
                    type="button"
                    onClick={handleCustomVideoSelect}
                  >
                    <span>{locale === "en" ? "Upload custom visual" : "Загрузить свой визуал"}</span>
                    <small title={customVideoFile?.fileName}>
                      {customVideoFileLabel ?? (locale === "en" ? "Supports .jpg, .png, .webp, .avif, .mp4, .mov, .webm, .m4v" : "Поддерживаются .jpg, .png, .webp, .avif, .mp4, .mov, .webm, .m4v")}
                    </small>
                  </button>
                  <button
                    className="studio-video-selector__custom-action"
                    type="button"
                    aria-label={customVideoFile ? (locale === "en" ? "Replace visual" : "Заменить визуал") : (locale === "en" ? "Upload visual" : "Загрузить визуал")}
                    title={customVideoFile ? (locale === "en" ? "Replace visual" : "Заменить визуал") : (locale === "en" ? "Upload visual" : "Загрузить визуал")}
                    onClick={openCustomVideoPicker}
                  >
                    {isPreparingCustomVideo ? (
                      <span className="studio-video-selector__spinner" aria-hidden="true"></span>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 18.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
                {uploadError ? <p className="studio-video-selector__error">{uploadError}</p> : null}
              </div>

              <div className="studio-video-selector__section">
                <span className="studio-video-selector__menu-title">{locale === "en" ? "Brand" : "Бренд"}</span>
                <div
                  className={`studio-video-selector__brand${
                    hasStudioBranding({ brandLogoFile, brandText }) ? " is-selected" : ""
                  }`}
                >
                  <div className="studio-video-selector__brand-head">
                    <div className="studio-video-selector__brand-preview" aria-hidden="true">
                      {brandLogoPreviewUrl ? (
                        <img src={brandLogoPreviewUrl} alt="" />
                      ) : (
                        <span className="studio-video-selector__brand-preview-placeholder">Logo</span>
                      )}
                    </div>
                    <div className="studio-video-selector__brand-copy">
                      <span>{hasStudioBranding({ brandLogoFile, brandText }) ? (locale === "en" ? "Brand added" : "Бренд добавлен") : (locale === "en" ? "Add brand" : "Добавить бренд")}</span>
                      <small title={brandLogoFile?.fileName ?? brandText}>{getStudioBrandSummary({ brandLogoFile, brandText })}</small>
                    </div>
                    <div className="studio-video-selector__brand-actions">
                      <button
                        className="studio-video-selector__custom-action"
                        type="button"
                        aria-label={brandLogoFile ? (locale === "en" ? "Replace logo" : "Заменить логотип") : (locale === "en" ? "Add logo" : "Добавить логотип")}
                        title={brandLogoFile ? (locale === "en" ? "Replace logo" : "Заменить логотип") : (locale === "en" ? "Add logo" : "Добавить логотип")}
                        onClick={openBrandLogoPicker}
                      >
                        {isPreparingBrandLogo ? (
                          <span className="studio-video-selector__spinner" aria-hidden="true"></span>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 18.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      {brandLogoFile ? (
                        <button
                          className="studio-video-selector__custom-action studio-video-selector__custom-action--danger"
                          type="button"
                          aria-label={locale === "en" ? "Remove logo" : "Убрать логотип"}
                          title={locale === "en" ? "Remove logo" : "Убрать логотип"}
                          onClick={onRemoveBrandLogo}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <label className="studio-video-selector__brand-field">
                    <span>{locale === "en" ? "Brand text" : "Текст бренда"}</span>
                    <input
                      className="studio-video-selector__brand-input"
                      type="text"
                      value={brandText}
                      maxLength={STUDIO_BRAND_TEXT_MAX_CHARS}
                      placeholder="Например, adshortsai.com"
                      onChange={(event) => onBrandTextChange(event.target.value)}
                    />
                  </label>
                  <div className="studio-video-selector__brand-meta">
                    <span>{brandTextLength}/{STUDIO_BRAND_TEXT_MAX_CHARS}</span>
                    {brandText ? (
                      <button className="studio-video-selector__brand-clear" type="button" onClick={onClearBrandText}>
                        {locale === "en" ? "Clear text" : "Очистить текст"}
                      </button>
                    ) : (
                      <span>{locale === "en" ? "Logo: .jpg, .png, .webp, .avif" : "Лого: .jpg, .png, .webp, .avif"}</span>
                    )}
                  </div>
                  <button
                    className="studio-video-selector__brand-apply"
                    type="button"
                    disabled={isPreparingBrandLogo}
                    onClick={() => {
                      setIsOpen(false);
                      triggerRef.current?.focus();
                    }}
                  >
                    {locale === "en" ? "Apply" : "Применить"}
                  </button>
                </div>
                {brandUploadError ? <p className="studio-video-selector__error">{brandUploadError}</p> : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function StudioBrandSelectorChip({
  appliedBrandLogoFile,
  appliedBrandText,
  appliedSystemWatermarkEnabled = false,
  brandLogoFile,
  brandText,
  brandUploadError,
  closeRequestId = 0,
  isDirty,
  isProgrammaticOnly = false,
  isPreparingBrandLogo,
  openAnchorRect = null,
  openRequestId = 0,
  onApplyBrand,
  onBrandLogoSelect,
  onBrandTextChange,
  onClearBrandText,
  onOpenChange,
  onRemoveBrandLogo,
  onSystemWatermarkToggle,
  showSystemWatermarkControl = false,
  systemWatermarkEnabled = false,
}: StudioBrandSelectorChipProps) {
  const { locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const brandLogoInputRef = useRef<HTMLInputElement | null>(null);
  const [requestAnchorRect, setRequestAnchorRect] = useState<StudioMenuAnchorRect | null>(null);
  const lastHandledOpenRequestIdRef = useRef(0);
  const lastReportedOpenRef = useRef(isOpen);
  const draftBrandSettings = { brandLogoFile, brandText };
  const appliedBrandSettings = {
    brandLogoFile: appliedBrandLogoFile,
    brandText: appliedBrandText,
  };
  const hasDraftBranding = hasStudioBranding(draftBrandSettings);
  const hasAppliedBranding = hasStudioBranding(appliedBrandSettings);
  const hasDraftSystemWatermark = showSystemWatermarkControl && systemWatermarkEnabled;
  const hasAppliedSystemWatermark = showSystemWatermarkControl && appliedSystemWatermarkEnabled;
  const brandLogoPreviewUrl = getStudioCustomAssetPreviewUrl(brandLogoFile);
  const brandTextLength = brandText.length;
  const systemWatermarkText = locale === "en" ? "Made with adshortsai.com" : "Сделано в adshortsai.com";
  const systemWatermarkTitle = locale === "en" ? "AdShorts AI watermark" : "Водяной знак AdShorts AI";
  const triggerValue = isDirty
    ? locale === "en"
      ? "Apply"
      : "Применить"
    : hasAppliedBranding
      ? getStudioBrandSummary(appliedBrandSettings)
      : hasAppliedSystemWatermark
        ? locale === "en"
          ? "Watermark"
          : "Водяной знак"
      : locale === "en"
        ? "Add"
        : "Добавить";
  const triggerTitle = [
    isDirty ? (locale === "en" ? "Unapplied brand changes" : "Есть неприменённые изменения бренда") : "",
    hasDraftBranding ? getStudioBrandSummary(draftBrandSettings) : "",
    hasDraftSystemWatermark ? systemWatermarkText : "",
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    if (openRequestId <= 0 || lastHandledOpenRequestIdRef.current === openRequestId) {
      return;
    }

    lastHandledOpenRequestIdRef.current = openRequestId;
    setRequestAnchorRect(openAnchorRect);
    setIsOpen(true);
    if (!openAnchorRect) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [openAnchorRect, openRequestId]);

  useEffect(() => {
    if (closeRequestId <= 0) {
      return;
    }

    setRequestAnchorRect(null);
    setIsOpen(false);
  }, [closeRequestId]);

  useEffect(() => {
    if (lastReportedOpenRef.current === isOpen) {
      return;
    }

    lastReportedOpenRef.current = isOpen;
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      const targetRect = requestAnchorRect ?? triggerRect;
      if (!targetRect) return;

      setMenuStyle(
        getStudioCompactMenuStyle({
          estimatedMenuHeight: Math.min(window.innerHeight - 32, 360),
          minWidth: 310,
          preferredWidth: 366,
          triggerRect: targetRect,
        }),
      );
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, requestAnchorRect]);

  const openBrandLogoPicker = () => {
    brandLogoInputRef.current?.click();
  };

  const handleBrandLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) return;

    await onBrandLogoSelect(file);
  };

  return (
    <div className="studio-video-selector studio-brand-selector" ref={rootRef}>
      <input
        ref={brandLogoInputRef}
        className="studio-video-selector__file-input"
        type="file"
        tabIndex={isProgrammaticOnly ? -1 : undefined}
        accept=".jpg,.jpeg,.png,.webp,.avif,image/*"
        onChange={(event) => {
          void handleBrandLogoChange(event);
        }}
      />

      <button
        ref={triggerRef}
        className={`studio-canvas-prompt__chip studio-video-selector__trigger studio-brand-selector__trigger${
          isOpen ? " is-open" : ""
        }${isDirty ? " is-dirty" : ""}`}
        type="button"
        tabIndex={isProgrammaticOnly ? -1 : undefined}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => {
          setRequestAnchorRect(null);
          setIsOpen((open) => !open);
        }}
      >
        <span className="studio-video-selector__label">{locale === "en" ? "Brand" : "Бренд"}</span>
        <strong className="studio-video-selector__value" title={triggerTitle || triggerValue}>
          {triggerValue}
        </strong>
        <svg className="studio-video-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="studio-video-selector__menu studio-brand-selector__menu"
              id={menuId}
              role="menu"
              aria-label={locale === "en" ? "Brand settings" : "Настройки бренда"}
              style={menuStyle}
            >
              <div className="studio-video-selector__section">
                <span className="studio-video-selector__menu-title">{locale === "en" ? "Brand on video" : "Бренд на видео"}</span>
                <div
                  className={`studio-video-selector__brand studio-brand-selector__brand${
                    hasDraftBranding || hasDraftSystemWatermark ? " is-selected" : ""
                  }${isDirty ? " is-dirty" : ""}`}
                >
                  <div className="studio-video-selector__brand-head">
                    <div className="studio-video-selector__brand-preview" aria-hidden="true">
                      {brandLogoPreviewUrl ? (
                        <img src={brandLogoPreviewUrl} alt="" />
                      ) : (
                        <span className="studio-video-selector__brand-preview-placeholder">Logo</span>
                      )}
                    </div>
                    <div className="studio-video-selector__brand-copy">
                      <span>
                        {isDirty
                          ? locale === "en"
                            ? "Changes pending"
                            : "Есть изменения"
                          : hasAppliedBranding
                            ? locale === "en"
                              ? "Brand applied"
                              : "Бренд применён"
                            : hasAppliedSystemWatermark
                              ? locale === "en"
                                ? "Watermark applied"
                                : "Водяной знак включён"
                            : hasDraftBranding
                              ? locale === "en"
                                ? "Brand added"
                                : "Бренд добавлен"
                              : locale === "en"
                                ? "Add brand"
                                : "Добавить бренд"}
                      </span>
                      <small title={brandLogoFile?.fileName ?? (brandText || (hasDraftSystemWatermark ? systemWatermarkText : undefined))}>
                        {hasDraftBranding
                          ? getStudioBrandSummary(draftBrandSettings)
                          : hasDraftSystemWatermark
                            ? systemWatermarkText
                            : getStudioBrandSummary(draftBrandSettings)}
                      </small>
                    </div>
                    <div className="studio-video-selector__brand-actions">
                      <button
                        className="studio-video-selector__custom-action"
                        type="button"
                        aria-label={brandLogoFile ? (locale === "en" ? "Replace logo" : "Заменить логотип") : (locale === "en" ? "Add logo" : "Добавить логотип")}
                        title={brandLogoFile ? (locale === "en" ? "Replace logo" : "Заменить логотип") : (locale === "en" ? "Add logo" : "Добавить логотип")}
                        onClick={openBrandLogoPicker}
                      >
                        {isPreparingBrandLogo ? (
                          <span className="studio-video-selector__spinner" aria-hidden="true"></span>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 18.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      {brandLogoFile ? (
                        <button
                          className="studio-video-selector__custom-action studio-video-selector__custom-action--danger"
                          type="button"
                          aria-label={locale === "en" ? "Remove logo" : "Убрать логотип"}
                          title={locale === "en" ? "Remove logo" : "Убрать логотип"}
                          onClick={onRemoveBrandLogo}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <label className="studio-video-selector__brand-field">
                    <span>{locale === "en" ? "Brand text" : "Текст бренда"}</span>
                    <input
                      className="studio-video-selector__brand-input"
                      type="text"
                      value={brandText}
                      maxLength={STUDIO_BRAND_TEXT_MAX_CHARS}
                      placeholder={locale === "en" ? "Example: adshortsai.com" : "Например, adshortsai.com"}
                      onChange={(event) => onBrandTextChange(event.target.value)}
                    />
                  </label>
                  <div className="studio-video-selector__brand-meta">
                    <span>{brandTextLength}/{STUDIO_BRAND_TEXT_MAX_CHARS}</span>
                    {brandText ? (
                      <button className="studio-video-selector__brand-clear" type="button" onClick={onClearBrandText}>
                        {locale === "en" ? "Clear text" : "Очистить текст"}
                      </button>
                    ) : (
                      <span>{locale === "en" ? "Logo: .jpg, .png, .webp, .avif" : "Лого: .jpg, .png, .webp, .avif"}</span>
                    )}
                  </div>
                  {showSystemWatermarkControl ? (
                    <div className={`studio-brand-selector__watermark${systemWatermarkEnabled ? " is-enabled" : " is-disabled"}`}>
                      <div className="studio-brand-selector__watermark-copy">
                        <span>{systemWatermarkTitle}</span>
                        <small>{systemWatermarkEnabled ? systemWatermarkText : locale === "en" ? "Will not be added to the rebuilt video" : "Не будет добавлен в пересобранное видео"}</small>
                      </div>
                      <button
                        className="studio-brand-selector__watermark-toggle"
                        type="button"
                        aria-pressed={systemWatermarkEnabled}
                        onClick={() => onSystemWatermarkToggle?.(!systemWatermarkEnabled)}
                      >
                        {systemWatermarkEnabled
                          ? locale === "en"
                            ? "Remove"
                            : "Убрать"
                          : locale === "en"
                            ? "Restore"
                            : "Вернуть"}
                      </button>
                    </div>
                  ) : null}
                  <button
                    className="studio-video-selector__brand-apply studio-brand-selector__apply"
                    type="button"
                    disabled={isPreparingBrandLogo || !isDirty}
                    onClick={() => {
                      onApplyBrand();
                      setIsOpen(false);
                      triggerRef.current?.focus();
                    }}
                  >
                    {isDirty
                      ? locale === "en"
                        ? "Apply to video"
                        : "Применить ко всему видео"
                      : locale === "en"
                        ? "Applied"
                        : "Применено"}
                  </button>
                </div>
                {brandUploadError ? <p className="studio-video-selector__error">{brandUploadError}</p> : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function StudioMusicSelectorChip({
  closeRequestId = 0,
  customMusicFile,
  isProgrammaticOnly = false,
  isPreparingCustomMusic,
  openAnchorRect = null,
  openRequestId = 0,
  onOpenChange,
  onSelectCustomFile,
  onSelectMusicType,
  selectedMusicType,
  uploadError,
  variant = "chip",
}: StudioMusicSelectorChipProps) {
  const { locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [requestAnchorRect, setRequestAnchorRect] = useState<StudioMenuAnchorRect | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastHandledOpenRequestIdRef = useRef(0);
  const lastReportedOpenRef = useRef(isOpen);
  const selectedMusicLabel = getStudioMusicChipValue(selectedMusicType, customMusicFile, locale);
  const selectedMusicTitle = customMusicFile?.fileName ?? selectedMusicLabel;
  const customMusicFileLabel = customMusicFile ? truncateStudioCustomAssetName(customMusicFile.fileName) : null;
  const isSidebarVariant = variant === "sidebar";

  useEffect(() => {
    if (openRequestId <= 0 || lastHandledOpenRequestIdRef.current === openRequestId) {
      return;
    }

    lastHandledOpenRequestIdRef.current = openRequestId;
    setRequestAnchorRect(openAnchorRect);
    setIsOpen(true);
    if (!openAnchorRect) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [openAnchorRect, openRequestId]);

  useEffect(() => {
    if (closeRequestId <= 0) {
      return;
    }

    setRequestAnchorRect(null);
    setIsOpen(false);
  }, [closeRequestId]);

  useEffect(() => {
    if (lastReportedOpenRef.current === isOpen) {
      return;
    }

    lastReportedOpenRef.current = isOpen;
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const triggerRect = requestAnchorRect ?? triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const estimatedMenuHeight = Math.min(window.innerHeight - 32, 460);
      setMenuStyle(
        getStudioCompactMenuStyle({
          estimatedMenuHeight,
          minWidth: 312,
          preferredWidth: 368,
          triggerRect,
        }),
      );
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, requestAnchorRect]);

  const openCustomMusicPicker = () => {
    fileInputRef.current?.click();
  };

  const handleCustomMusicChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) return;

    await onSelectCustomFile(file);
  };

  const handleCustomMusicSelect = () => {
    if (customMusicFile) {
      onSelectMusicType("custom");
      setIsOpen(false);
      return;
    }

    openCustomMusicPicker();
  };

  return (
    <div className={`studio-music-selector${isSidebarVariant ? " studio-music-selector--sidebar" : ""}`} ref={rootRef}>
      <input
        ref={fileInputRef}
        className="studio-music-selector__file-input"
        type="file"
        tabIndex={isProgrammaticOnly ? -1 : undefined}
        accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/*"
        onChange={(event) => {
          void handleCustomMusicChange(event);
        }}
      />

      <button
        ref={triggerRef}
        className={
          isSidebarVariant
            ? `studio-music-selector__trigger studio-music-selector__trigger--sidebar studio-sidebar__item studio-sidebar__item--static${
                isOpen ? " is-open" : ""
              }`
            : `studio-canvas-prompt__chip studio-music-selector__trigger${isOpen ? " is-open" : ""}`
        }
        type="button"
        tabIndex={isProgrammaticOnly ? -1 : undefined}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => {
          setRequestAnchorRect(null);
          setIsOpen((open) => !open);
        }}
      >
        {isSidebarVariant ? (
          <>
            <span className="studio-sidebar__item-icon studio-sidebar__item-icon--music" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M14 5.2v10.1a2.65 2.65 0 1 1-2.15-2.6V7.45l7.9-1.75v7.55a2.65 2.65 0 1 1-2.15-2.6V6.18L14 6.98" stroke="currentColor" strokeWidth="2.05" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="studio-sidebar__item-copy">
              <strong>{locale === "en" ? "Music" : "Музыка"}</strong>
              <span className="studio-sidebar__item-value" title={selectedMusicTitle}>{selectedMusicLabel}</span>
            </span>
            <svg className="studio-music-selector__icon studio-music-selector__icon--sidebar" width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          <>
            <span className="studio-music-selector__label">{locale === "en" ? "Music" : "Музыка"}</span>
            <strong className="studio-music-selector__value" title={selectedMusicTitle}>
              {selectedMusicLabel}
            </strong>
            <svg className="studio-music-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>

      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="studio-music-selector__menu"
              id={menuId}
              role="menu"
              aria-label={locale === "en" ? "Music selection" : "Выбор музыки"}
              style={menuStyle}
            >
              <div className="studio-music-selector__section">
                <span className="studio-music-selector__menu-title">{locale === "en" ? "Mode" : "Режим"}</span>
                <div className="studio-music-selector__presets">
                  {studioMusicOptions
                    .filter((option) => option.id === "ai" || option.id === "none")
                    .map((option) => (
                      <button
                        key={option.id}
                        className={`studio-music-selector__preset${selectedMusicType === option.id ? " is-selected" : ""}`}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selectedMusicType === option.id}
                        onClick={() => {
                          onSelectMusicType(option.id);
                          setIsOpen(false);
                        }}
                      >
                        <span>{getStudioMusicOptionCopy(option, locale).label}</span>
                        <small>{getStudioMusicOptionCopy(option, locale).description}</small>
                      </button>
                    ))}
                </div>
              </div>

              <div className="studio-music-selector__section">
                <span className="studio-music-selector__menu-title">{locale === "en" ? "Music style" : "Стиль музыки"}</span>
                <div className="studio-music-selector__styles">
                  {studioMusicStyleOptions.map((option) => (
                    <button
                      key={option.id}
                      className={`studio-music-selector__style${selectedMusicType === option.id ? " is-selected" : ""}`}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selectedMusicType === option.id}
                      onClick={() => {
                        onSelectMusicType(option.id);
                        setIsOpen(false);
                      }}
                    >
                      <span>{getStudioMusicOptionCopy(option, locale).label}</span>
                      <small>{getStudioMusicOptionCopy(option, locale).description}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="studio-music-selector__section">
                <span className="studio-music-selector__menu-title">{locale === "en" ? "Custom music" : "Своя музыка"}</span>
                <div className={`studio-music-selector__custom${selectedMusicType === "custom" ? " is-selected" : ""}`}>
                  <button
                    className="studio-music-selector__custom-main"
                    type="button"
                    onClick={handleCustomMusicSelect}
                  >
                    <span>{locale === "en" ? "Upload your track" : "Загрузить свой трек"}</span>
                    <small title={customMusicFile?.fileName}>
                      {customMusicFileLabel ?? (locale === "en" ? "Supports .mp3, .wav and .m4a" : "Поддерживаются .mp3, .wav и .m4a")}
                    </small>
                  </button>
                  <button
                    className="studio-music-selector__custom-action"
                    type="button"
                    aria-label={customMusicFile ? (locale === "en" ? "Replace audio file" : "Заменить аудиофайл") : (locale === "en" ? "Upload audio file" : "Загрузить аудиофайл")}
                    title={customMusicFile ? (locale === "en" ? "Replace file" : "Заменить файл") : (locale === "en" ? "Upload file" : "Загрузить файл")}
                    onClick={openCustomMusicPicker}
                  >
                    {isPreparingCustomMusic ? (
                      <span className="studio-music-selector__spinner" aria-hidden="true"></span>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 18.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
                {uploadError ? <p className="studio-music-selector__error">{uploadError}</p> : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
