import type { Locale } from "../../lib/i18n";
import {
  normalizeWorkspaceLocalizedTextForCompare,
  type getWorkspaceSegmentDurationExtensionPlan,
} from "./workspace-segment-editor";

const workspaceText = (locale: Locale, ru: string, en: string) => (locale === "en" ? en : ru);

const getWorkspaceSegmentEditorDisplayedTimeTenths = (value: number) => {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  return Math.round(safeValue * 10);
};

const formatWorkspaceSegmentDecimalPart = (tenths: number) =>
  tenths > 0 ? `.${tenths}` : "";

const formatWorkspaceSegmentDurationNumber = (seconds: number, _locale: Locale) => {
  const totalTenths = getWorkspaceSegmentEditorDisplayedTimeTenths(seconds);
  const wholeSeconds = Math.floor(totalTenths / 10);
  const tenths = totalTenths % 10;
  const label = `${wholeSeconds}${formatWorkspaceSegmentDecimalPart(tenths)}`;

  return label;
};

export const formatWorkspaceSegmentEditorTime = (value: number) => {
  const totalTenths = getWorkspaceSegmentEditorDisplayedTimeTenths(value);
  const wholeTotalSeconds = Math.floor(totalTenths / 10);
  const tenths = totalTenths % 10;
  const hours = Math.floor(wholeTotalSeconds / 3600);
  const minutes = Math.floor((wholeTotalSeconds % 3600) / 60);
  const seconds = wholeTotalSeconds % 60;
  const secondsLabel = `${String(seconds).padStart(2, "0")}${formatWorkspaceSegmentDecimalPart(tenths)}`;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${secondsLabel}`;
  }

  return `${String(minutes).padStart(2, "0")}:${secondsLabel}`;
};

const getWorkspaceVideoPlayerDisplayedSeconds = (value: number, mode: "current" | "duration" = "current") => {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  return mode === "duration" ? Math.ceil(safeValue) : Math.floor(safeValue);
};

export const formatWorkspaceVideoPlayerTime = (value: number, mode?: "current" | "duration") => {
  const wholeTotalSeconds = getWorkspaceVideoPlayerDisplayedSeconds(value, mode);
  const hours = Math.floor(wholeTotalSeconds / 3600);
  const minutes = Math.floor((wholeTotalSeconds % 3600) / 60);
  const seconds = wholeTotalSeconds % 60;
  const secondsLabel = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${secondsLabel}`;
  }

  return `${String(minutes).padStart(2, "0")}:${secondsLabel}`;
};

export const formatWorkspaceSegmentEditorSegmentTimeRange = (
  startTime: number,
  endTime: number,
  _options?: {
    isFirstSegment?: boolean;
  },
) => {
  const startLabel = formatWorkspaceSegmentEditorTime(startTime);
  const endLabel = formatWorkspaceSegmentEditorTime(endTime);

  return `${startLabel} - ${endLabel}`;
};

export const formatWorkspaceSegmentEditorSegmentDurationLabel = (
  startTime: number,
  endTime: number,
  locale: Locale,
  _options?: {
    isFirstSegment?: boolean;
  },
) => {
  const durationSeconds = Math.max(0, endTime - startTime);
  const durationLabel = formatWorkspaceSegmentDurationNumber(durationSeconds, locale);
  return locale === "en" ? `${durationLabel}s` : `${durationLabel} с`;
};

export const formatWorkspaceSegmentEditorDurationBadgeLabel = (seconds: number, locale: Locale) => {
  const durationLabel = formatWorkspaceSegmentDurationNumber(seconds, locale);
  return locale === "en" ? `${durationLabel}s` : `${durationLabel} сек`;
};

export const formatWorkspaceSegmentExtensionDurationLabel = (seconds: number, locale: Locale) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const roundedSeconds = safeSeconds >= 10 ? Math.round(safeSeconds) : Math.round(safeSeconds * 10) / 10;
  const normalizedLabel = Number.isInteger(roundedSeconds)
    ? String(roundedSeconds)
    : String(roundedSeconds).replace(".", ",");

  return locale === "en" ? `+${normalizedLabel}s` : `+${normalizedLabel} с`;
};

export const buildWorkspaceSegmentAiExtensionPrompt = (
  extensionPlan: NonNullable<ReturnType<typeof getWorkspaceSegmentDurationExtensionPlan>>,
  locale: Locale,
) =>
  workspaceText(
    locale,
    `Продли сцену из последнего кадра на ${formatWorkspaceSegmentExtensionDurationLabel(extensionPlan.extraDurationSeconds, locale)}. Сохрани стиль, объект, свет и плавное естественное движение без резких переходов.`,
    `Extend the scene from the last frame by ${formatWorkspaceSegmentExtensionDurationLabel(extensionPlan.extraDurationSeconds, locale)}. Keep the same style, subject, lighting, and smooth natural motion without abrupt cuts.`,
  );

export const isWorkspaceSegmentDefaultAiExtensionPrompt = (value: string | null | undefined) => {
  const normalizedValue = normalizeWorkspaceLocalizedTextForCompare(value).toLowerCase();
  return (
    normalizedValue.startsWith("продли сцену из последнего кадра на +") ||
    normalizedValue.startsWith("extend the scene from the last frame by +")
  );
};

const parseWorkspaceSegmentEditorTimeInput = (value: string) => {
  const normalizedValue = value.trim().replace(",", ".");
  if (!normalizedValue) {
    return null;
  }

  if (!normalizedValue.includes(":")) {
    const seconds = Number(normalizedValue);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }

  const parts = normalizedValue.split(":").map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => part === "")) {
    return null;
  }

  const numbers = parts.map((part) => Number(part));
  if (numbers.some((part) => !Number.isFinite(part) || part < 0)) {
    return null;
  }

  if (numbers.length === 2) {
    const [minutes, seconds] = numbers;
    return minutes * 60 + seconds;
  }

  const [hours, minutes, seconds] = numbers;
  return hours * 3600 + minutes * 60 + seconds;
};

export const parseWorkspaceSegmentEditorDurationInput = (value: string) => {
  const normalizedValue = value
    .trim()
    .replace(/\s*(?:сек(?:\.|унд[аы]?)?|seconds?|secs?|s|с)$/iu, "")
    .trim();

  return parseWorkspaceSegmentEditorTimeInput(normalizedValue);
};
