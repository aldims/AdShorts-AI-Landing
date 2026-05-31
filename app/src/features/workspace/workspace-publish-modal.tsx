import { createPortal } from "react-dom";
import type { CSSProperties, Dispatch, RefObject, SetStateAction } from "react";
import type { Locale } from "../../lib/i18n";
import {
  formatPublishCalendarMonth,
  isSamePublishDay,
  shiftPublishMonth,
} from "./workspace-publish-helpers";
import {
  workspaceText,
  type WorkspacePublishBootstrapPayload,
  type WorkspacePublishChannel,
} from "./workspace-page-model";

type WorkspacePublishCalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isPast: boolean;
  isToday: boolean;
};

type WorkspacePublishSuccessNotice = {
  link: string | null;
  text: string;
  title: string;
} | null;

type WorkspacePublishModalProps = {
  bootstrap: WorkspacePublishBootstrapPayload | null;
  bootstrapError: string | null;
  calendarDays: WorkspacePublishCalendarDay[];
  calendarMonth: Date;
  canSubmit: boolean;
  channels: WorkspacePublishChannel[];
  description: string;
  descriptionFieldId: string;
  hashtags: string;
  hashtagsFieldId: string;
  isBootstrapLoading: boolean;
  isDisconnectingChannel: boolean;
  isInFlight: boolean;
  isOpen: boolean;
  isPlannerOpen: boolean;
  locale: Locale;
  mode: "now" | "schedule";
  onCalendarDaySelect: (nextDate: Date) => void;
  onClose: () => void;
  onDescriptionChange: Dispatch<SetStateAction<string>>;
  onDisconnectChannel: () => void | Promise<void>;
  onHashtagsChange: Dispatch<SetStateAction<string>>;
  onModeChange: (nextMode: "now" | "schedule") => void;
  onStartYouTubeConnect: () => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
  onTimeSelect: (nextTime: string) => void;
  onTitleChange: Dispatch<SetStateAction<string>>;
  plannerPopoverId: string;
  plannerPopoverRef: RefObject<HTMLDivElement | null>;
  plannerStyle: CSSProperties | null;
  plannerTriggerRef: RefObject<HTMLButtonElement | null>;
  primaryActionLabel: string;
  publishError: string | null;
  scheduleSummary: string;
  scheduledDate: Date | null;
  selectedChannel: WorkspacePublishChannel | null;
  selectedChannelPk: number | null;
  setCalendarMonth: Dispatch<SetStateAction<Date>>;
  setIsPlannerOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedChannelPk: Dispatch<SetStateAction<number | null>>;
  successNotice: WorkspacePublishSuccessNotice;
  targetTitle: string;
  timeFieldId: string;
  timeValue: string;
  title: string;
  titleFieldId: string;
  weekdayLabels: string[];
};

export function WorkspacePublishModal({
  bootstrap,
  bootstrapError,
  calendarDays,
  calendarMonth,
  canSubmit,
  channels,
  description,
  descriptionFieldId,
  hashtags,
  hashtagsFieldId,
  isBootstrapLoading,
  isDisconnectingChannel,
  isInFlight,
  isOpen,
  isPlannerOpen,
  locale,
  mode,
  onCalendarDaySelect,
  onClose,
  onDescriptionChange,
  onDisconnectChannel,
  onHashtagsChange,
  onModeChange,
  onStartYouTubeConnect,
  onSubmit,
  onTimeSelect,
  onTitleChange,
  plannerPopoverId,
  plannerPopoverRef,
  plannerStyle,
  plannerTriggerRef,
  primaryActionLabel,
  publishError,
  scheduleSummary,
  scheduledDate,
  selectedChannel,
  selectedChannelPk,
  setCalendarMonth,
  setIsPlannerOpen,
  setSelectedChannelPk,
  successNotice,
  targetTitle,
  timeFieldId,
  timeValue,
  title,
  titleFieldId,
  weekdayLabels,
}: WorkspacePublishModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="studio-publish-modal" role="dialog" aria-modal="true" aria-labelledby="studio-publish-modal-title">
      <button className="studio-publish-modal__backdrop route-close" type="button" aria-label={workspaceText(locale, "Закрыть публикацию", "Close publishing")} onClick={onClose} />
      <div className="studio-publish-modal__panel" role="document">
        <button className="studio-publish-modal__close route-close" type="button" aria-label={workspaceText(locale, "Закрыть публикацию", "Close publishing")} onClick={onClose}>
          ×
        </button>

        <div className="studio-publish-modal__header">
          <div className="studio-publish-modal__header-copy">
            <p className="studio-publish-modal__eyebrow">{workspaceText(locale, "Публикация в YouTube", "YouTube publishing")}</p>
            <strong id="studio-publish-modal-title">{targetTitle || workspaceText(locale, "Готово к публикации", "Ready to publish")}</strong>
          </div>
        </div>

        {isBootstrapLoading && !bootstrap ? (
          <div className="studio-publish-modal__loading">
            <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
            <p>{workspaceText(locale, "Загружаем настройки публикации...", "Loading publishing settings...")}</p>
          </div>
        ) : bootstrapError && !bootstrap ? (
          <div className="studio-publish-modal__error">
            <strong>{workspaceText(locale, "Не удалось открыть публикацию", "Could not open publishing")}</strong>
            <p>{bootstrapError}</p>
          </div>
        ) : (
          <>
            <div className="studio-publish-modal__body">
              <div className="studio-publish-modal__main">
                {publishError ? (
                  <div className="studio-publish-modal__inline-state is-error">
                    <div>
                      <strong>{workspaceText(locale, "Ошибка публикации", "Publishing error")}</strong>
                      <p>{publishError}</p>
                    </div>
                  </div>
                ) : null}
                {successNotice ? (
                  <div className="studio-publish-modal__inline-state is-success">
                    <div>
                      <strong>{successNotice.title}</strong>
                      <p>{successNotice.text}</p>
                      {successNotice.link ? (
                        <a href={successNotice.link} target="_blank" rel="noopener noreferrer">
                          {workspaceText(locale, "Открыть на YouTube", "Open on YouTube")}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <section className="studio-publish-modal__section">
                  <div className="studio-publish-modal__section-head">
                    <div>
                      <span className="studio-publish-modal__section-kicker">{workspaceText(locale, "Канал", "Channel")}</span>
                    </div>
                    <div className="studio-publish-modal__section-tools">
                      {selectedChannel ? (
                        <button
                          className="studio-publish-modal__utility-btn studio-publish-modal__utility-btn--icon"
                          type="button"
                          disabled={isDisconnectingChannel || isInFlight}
                          aria-label={workspaceText(locale, "Отключить канал", "Disconnect channel")}
                          title={workspaceText(locale, "Отключить канал", "Disconnect channel")}
                          onClick={() => void onDisconnectChannel()}
                        >
                          {isDisconnectingChannel ? "…" : "−"}
                        </button>
                      ) : null}
                      {channels.length ? (
                        <button
                          className="studio-publish-modal__utility-btn studio-publish-modal__utility-btn--icon"
                          type="button"
                          disabled={isDisconnectingChannel || isInFlight}
                          aria-label={workspaceText(locale, "Подключить ещё канал", "Connect another channel")}
                          title={workspaceText(locale, "Подключить ещё канал", "Connect another channel")}
                          onClick={() => void onStartYouTubeConnect()}
                        >
                          +
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {channels.length ? (
                    <div className="studio-publish-modal__channel-grid" role="radiogroup" aria-label={workspaceText(locale, "Канал YouTube", "YouTube channel")}>
                      {channels.map((channel) => {
                        const isSelected = channel.pk === selectedChannelPk;

                        return (
                          <button
                            key={channel.pk}
                            className={`studio-publish-modal__channel-card${isSelected ? " is-selected" : ""}`}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => setSelectedChannelPk(channel.pk)}
                          >
                            <span className="studio-publish-modal__channel-avatar" aria-hidden="true">
                              {channel.channelName.trim().slice(0, 1).toUpperCase() || "Y"}
                            </span>
                            <span className="studio-publish-modal__channel-copy">
                              <strong>{channel.channelName}</strong>
                            </span>
                            <span className="studio-publish-modal__channel-indicator" aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  ) : isBootstrapLoading ? (
                    <div className="studio-publish-modal__inline-state">
                      <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                      <div>
                        <strong>{workspaceText(locale, "Синхронизируем каналы", "Syncing channels")}</strong>
                        <p>{workspaceText(locale, "Окно уже готово, список подключённых YouTube-каналов подтягивается фоном.", "The dialog is ready while connected YouTube channels load in the background.")}</p>
                      </div>
                    </div>
                  ) : bootstrapError ? (
                    <div className="studio-publish-modal__inline-state is-error">
                      <div>
                        <strong>{workspaceText(locale, "Не удалось получить каналы", "Could not load channels")}</strong>
                        <p>{bootstrapError}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="studio-publish-modal__empty-state">
                      <div className="studio-publish-modal__empty-icon" aria-hidden="true">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <path d="M8 6h8m-8 6h8m-8 6h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                          <path d="M19 8v8M15 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="studio-publish-modal__empty-copy">
                        <strong>{workspaceText(locale, "Канал ещё не подключён", "No channel connected yet")}</strong>
                        <p>{workspaceText(locale, "Подключите YouTube-канал и публикуйте Shorts прямо из студии.", "Connect a YouTube channel and publish Shorts directly from the studio.")}</p>
                      </div>
                      <button className="studio-publish-modal__primary-btn" type="button" onClick={() => void onStartYouTubeConnect()}>
                        {workspaceText(locale, "Подключить YouTube", "Connect YouTube")}
                      </button>
                    </div>
                  )}
                </section>

                <section className="studio-publish-modal__section">
                  <div className="studio-publish-modal__section-head">
                    <div>
                      <span className="studio-publish-modal__section-kicker">{workspaceText(locale, "НАСТРОЙКИ ПУБЛИКАЦИИ", "PUBLISHING SETTINGS")}</span>
                    </div>
                  </div>

                  <div className="studio-publish-modal__field-grid">
                    <label className="studio-publish-modal__field studio-publish-modal__field--full" htmlFor={titleFieldId}>
                      <span className="studio-publish-modal__field-label">
                        <span>{workspaceText(locale, "Заголовок", "Title")}</span>
                        <small>{title.length}/100</small>
                      </span>
                      <input
                        id={titleFieldId}
                        value={title}
                        onChange={(event) => onTitleChange(event.target.value)}
                        maxLength={100}
                        placeholder={workspaceText(locale, "Например: 3 секрета viral Shorts", "For example: 3 secrets of viral Shorts")}
                      />
                    </label>

                    <label className="studio-publish-modal__field studio-publish-modal__field--full" htmlFor={descriptionFieldId}>
                      <span className="studio-publish-modal__field-label">
                        <span>{workspaceText(locale, "Описание", "Description")}</span>
                        <small>{description.length}/5000</small>
                      </span>
                      <textarea
                        id={descriptionFieldId}
                        value={description}
                        onChange={(event) => onDescriptionChange(event.target.value)}
                        rows={5}
                        maxLength={5000}
                        placeholder={workspaceText(locale, "Добавьте описание ролика, CTA и полезный контекст.", "Add a video description, CTA and useful context.")}
                      />
                    </label>

                    <label className="studio-publish-modal__field studio-publish-modal__field--full" htmlFor={hashtagsFieldId}>
                      <span className="studio-publish-modal__field-label">
                        <span>{workspaceText(locale, "Хэштеги", "Hashtags")}</span>
                      </span>
                      <input
                        id={hashtagsFieldId}
                        value={hashtags}
                        onChange={(event) => onHashtagsChange(event.target.value)}
                        placeholder="#shorts #adsflow"
                      />
                    </label>
                  </div>
                </section>

                <section className="studio-publish-modal__section">
                  <div className="studio-publish-modal__section-head">
                    <div>
                      <span className="studio-publish-modal__section-kicker">{workspaceText(locale, "Планирование", "Scheduling")}</span>
                    </div>
                  </div>

                  <div className="studio-publish-modal__mode-grid">
                    <button
                      className={`studio-publish-modal__mode-card${mode === "now" ? " is-active" : ""}`}
                      type="button"
                      onClick={() => onModeChange("now")}
                    >
                      <span>{workspaceText(locale, "Сразу", "Now")}</span>
                      <strong>{workspaceText(locale, "Опубликовать сейчас", "Publish now")}</strong>
                      <p>{workspaceText(locale, "Shorts уйдёт в канал сразу после подтверждения.", "The Shorts will go to the channel right after confirmation.")}</p>
                    </button>
                    <button
                      className={`studio-publish-modal__mode-card${mode === "schedule" ? " is-active" : ""}`}
                      type="button"
                      onClick={() => onModeChange("schedule")}
                    >
                      <span>{workspaceText(locale, "По расписанию", "Schedule")}</span>
                      <strong>{workspaceText(locale, "Запланировать публикацию", "Schedule publication")}</strong>
                      <p>{workspaceText(locale, "Выберите день и точное время выхода в ленту.", "Choose the exact date and time for publishing.")}</p>
                    </button>
                  </div>

                  {mode === "schedule" ? (
                    <>
                      <div className="studio-publish-modal__schedule-inline">
                        <div className="studio-publish-modal__schedule-preview">
                          <span>{workspaceText(locale, "Дата и время", "Date and time")}</span>
                          <strong>{scheduleSummary}</strong>
                        </div>
                        <button
                          ref={plannerTriggerRef}
                          className={`studio-publish-modal__planner-toggle${isPlannerOpen ? " is-open" : ""}`}
                          type="button"
                          aria-haspopup="dialog"
                          aria-expanded={isPlannerOpen}
                          aria-controls={plannerPopoverId}
                          onClick={() => setIsPlannerOpen((open) => !open)}
                        >
                          <span>
                            {isPlannerOpen
                              ? workspaceText(locale, "Скрыть календарь", "Hide calendar")
                              : workspaceText(locale, "Открыть календарь", "Open calendar")}
                          </span>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                            <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>

                      {isPlannerOpen && plannerStyle && typeof document !== "undefined"
                        ? createPortal(
                            <div
                              ref={plannerPopoverRef}
                              className="studio-publish-modal__planner-popover"
                              id={plannerPopoverId}
                              role="dialog"
                              aria-label={workspaceText(locale, "Календарь публикации", "Publication calendar")}
                              style={plannerStyle}
                            >
                              <div className="studio-publish-modal__planner-popover-grid">
                                <div className="studio-publish-modal__calendar-card">
                                  <div className="studio-publish-modal__calendar-toolbar">
                                    <button
                                      className="studio-publish-modal__calendar-nav"
                                      type="button"
                                      aria-label={workspaceText(locale, "Предыдущий месяц", "Previous month")}
                                      onClick={() => setCalendarMonth((currentMonth) => shiftPublishMonth(currentMonth, -1))}
                                    >
                                      ‹
                                    </button>
                                    <strong>{formatPublishCalendarMonth(calendarMonth, locale)}</strong>
                                    <button
                                      className="studio-publish-modal__calendar-nav"
                                      type="button"
                                      aria-label={workspaceText(locale, "Следующий месяц", "Next month")}
                                      onClick={() => setCalendarMonth((currentMonth) => shiftPublishMonth(currentMonth, 1))}
                                    >
                                      ›
                                    </button>
                                  </div>

                                  <div className="studio-publish-modal__calendar-weekdays" aria-hidden="true">
                                    {weekdayLabels.map((weekday) => (
                                      <span key={weekday}>{weekday}</span>
                                    ))}
                                  </div>

                                  <div className="studio-publish-modal__calendar-grid">
                                    {calendarDays.map((day) => {
                                      const isSelected = isSamePublishDay(day.date, scheduledDate);

                                      return (
                                        <button
                                          key={day.date.toISOString()}
                                          className={`studio-publish-modal__calendar-day${day.isCurrentMonth ? "" : " is-outside"}${day.isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}`}
                                          type="button"
                                          disabled={day.isPast}
                                          onClick={() => onCalendarDaySelect(day.date)}
                                        >
                                          <span>{day.date.getDate()}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="studio-publish-modal__time-card">
                                  <label className="studio-publish-modal__field studio-publish-modal__field--time" htmlFor={timeFieldId}>
                                    <span className="studio-publish-modal__field-label">
                                      <span>{workspaceText(locale, "Время публикации", "Publication time")}</span>
                                    </span>
                                    <input
                                      aria-label={workspaceText(locale, "Время публикации", "Publication time")}
                                      id={timeFieldId}
                                      type="time"
                                      step={300}
                                      value={timeValue}
                                      onChange={(event) => onTimeSelect(event.target.value)}
                                    />
                                  </label>

                                  <button className="studio-publish-modal__utility-btn" type="button" onClick={() => setIsPlannerOpen(false)}>
                                    {workspaceText(locale, "Готово", "Done")}
                                  </button>
                                </div>
                              </div>
                            </div>,
                            document.body,
                          )
                        : null}
                    </>
                  ) : null}
                </section>
              </div>
            </div>

            <div className="studio-publish-modal__footer">
              <div className="studio-publish-modal__actions">
                <button className="studio-publish-modal__secondary-btn" type="button" onClick={onClose}>
                  {workspaceText(locale, "Отмена", "Cancel")}
                </button>
                <button
                  className="studio-publish-modal__primary-btn"
                  type="button"
                  disabled={!canSubmit || !channels.length}
                  onClick={() => void onSubmit()}
                >
                  {isInFlight ? workspaceText(locale, "Публикуем...", "Publishing...") : primaryActionLabel}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
