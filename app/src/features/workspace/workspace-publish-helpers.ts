import type { Locale } from "../../lib/i18n";
import type { WorkspaceProjectPublication } from "./workspace-types";

const workspaceText = (locale: Locale, ru: string, en: string) => (locale === "en" ? en : ru);

export const formatProjectDate = (value: string, locale: Locale = "ru") => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return workspaceText(locale, "Дата недоступна", "Date unavailable");
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

export const formatDateTimeLocalValue = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";

  const timezoneOffsetMs = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

export const publishCalendarWeekdayLabels: Record<Locale, string[]> = {
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

export type PublishCalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isPast: boolean;
  isToday: boolean;
};

export const parsePublishDateTimeLocalValue = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const buildPublishDateTimeLocalValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const createDefaultPublishScheduleDate = () => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(12, 0, 0, 0);
  return next;
};

export const startOfPublishDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

export const startOfPublishMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);

export const shiftPublishMonth = (value: Date, delta: number) => new Date(value.getFullYear(), value.getMonth() + delta, 1);

export const isSamePublishDay = (left: Date | null | undefined, right: Date | null | undefined) =>
  Boolean(
    left &&
      right &&
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate(),
  );

export const formatPublishCalendarMonth = (value: Date, locale: Locale = "ru") =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    month: "long",
    year: "numeric",
  }).format(value);

export const formatPublishTimeValue = (value: Date | null | undefined) => {
  if (!value) return "";

  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
};

export const applyPublishScheduleDatePart = (currentValue: string, selectedDate: Date) => {
  const baseDate = parsePublishDateTimeLocalValue(currentValue) ?? createDefaultPublishScheduleDate();
  return buildPublishDateTimeLocalValue(
    new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      baseDate.getHours(),
      baseDate.getMinutes(),
      0,
      0,
    ),
  );
};

export const applyPublishScheduleTimePart = (currentValue: string, nextTime: string) => {
  const normalized = nextTime.trim();
  if (!normalized) return "";

  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return currentValue;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return currentValue;
  }

  const baseDate = parsePublishDateTimeLocalValue(currentValue) ?? createDefaultPublishScheduleDate();
  baseDate.setHours(hours, minutes, 0, 0);
  return buildPublishDateTimeLocalValue(baseDate);
};

export const buildPublishCalendarDays = (month: Date): PublishCalendarDay[] => {
  const monthStart = startOfPublishMonth(month);
  const gridStart = new Date(monthStart);
  const weekDayIndex = (monthStart.getDay() + 6) % 7;
  gridStart.setDate(monthStart.getDate() - weekDayIndex);

  const today = startOfPublishDay(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dayStart = startOfPublishDay(date);

    return {
      date,
      isCurrentMonth: date.getMonth() === monthStart.getMonth(),
      isPast: dayStart.getTime() < today.getTime(),
      isToday: isSamePublishDay(dayStart, today),
    } satisfies PublishCalendarDay;
  });
};

export const normalizePublishDateTimeInput = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const getPublicationMetaLabel = (
  publication: WorkspaceProjectPublication | null | undefined,
  locale: Locale = "ru",
) => {
  if (!publication) return "";

  if (publication.state === "scheduled" && publication.scheduledAt) {
    return workspaceText(
      locale,
      `Выход: ${formatProjectDate(publication.scheduledAt, locale)}`,
      `Scheduled: ${formatProjectDate(publication.scheduledAt, locale)}`,
    );
  }

  if (publication.state === "published" && publication.publishedAt) {
    return workspaceText(
      locale,
      `Опубликовано: ${formatProjectDate(publication.publishedAt, locale)}`,
      `Published: ${formatProjectDate(publication.publishedAt, locale)}`,
    );
  }

  return publication.channelName
    ? workspaceText(locale, `Канал: ${publication.channelName}`, `Channel: ${publication.channelName}`)
    : "";
};

export const getYouTubePublicationMetaLabel = getPublicationMetaLabel;

export const normalizePublishJobStatus = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const isPublishJobProgressStatus = (status: string) =>
  ["pending", "queued", "processing", "running", "started", "uploading", "in_progress"].includes(status);

export const isPublishJobSuccessStatus = (status: string) =>
  ["complete", "completed", "done", "published", "scheduled", "success", "succeeded"].includes(status);

export const isPublishJobFailureStatus = (status: string) =>
  ["canceled", "cancelled", "error", "errored", "failed", "timeout"].includes(status);

export const hasConfirmedPublication = (publication: WorkspaceProjectPublication | null | undefined) => {
  if (!publication) return false;

  const state = normalizePublishJobStatus(publication.state);
  if (state === "published") {
    return Boolean(publication.link || publication.providerMediaId || publication.youtubeVideoId || publication.publishedAt);
  }

  if (state === "scheduled") {
    return Boolean(publication.scheduledAt || publication.link || publication.providerMediaId || publication.youtubeVideoId);
  }

  return Boolean(publication.link || publication.providerMediaId || publication.youtubeVideoId || publication.publishedAt || publication.scheduledAt);
};

export const hasConfirmedYouTubePublication = hasConfirmedPublication;
