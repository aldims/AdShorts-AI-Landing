import { type FormEvent, useEffect, useId, useState } from "react";

import { logClientEvent } from "../lib/client-log";

type FirstVideoSuccessOfferProps = {
  locale: "ru" | "en";
  onDismiss: () => void;
  onUpgrade: () => void;
  plan: string | null;
  projectId: number | null;
};

type FeedbackStatus = "idle" | "sending" | "sent";

export function FirstVideoSuccessOffer({
  locale,
  onDismiss,
  onUpgrade,
  plan,
  projectId,
}: FirstVideoSuccessOfferProps) {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>("idle");
  const feedbackId = useId();
  const text = (ru: string, en: string) => (locale === "en" ? en : ru);

  useEffect(() => {
    logClientEvent("first_free_video_offer_viewed", {
      path: `${window.location.pathname}${window.location.search}`,
      plan,
      projectId,
    });
  }, [plan, projectId]);

  const handleUpgrade = () => {
    logClientEvent("first_free_video_offer_clicked", {
      path: `${window.location.pathname}${window.location.search}`,
      plan,
      projectId,
      target: "plans",
    });
    onUpgrade();
  };

  const handleDismiss = () => {
    logClientEvent("first_free_video_offer_dismissed", {
      plan,
      projectId,
    });
    onDismiss();
  };

  const handleFeedbackToggle = () => {
    const nextIsOpen = !isFeedbackOpen;
    setIsFeedbackOpen(nextIsOpen);
    setFeedbackError(null);
    if (nextIsOpen) {
      logClientEvent("first_free_video_feedback_opened", { plan, projectId });
    }
  };

  const handleFeedbackSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = feedback.trim();
    if (message.length < 3) {
      setFeedbackError(text("Напишите хотя бы несколько слов.", "Write at least a few words."));
      return;
    }

    setFeedbackError(null);
    setFeedbackStatus("sending");

    try {
      const response = await fetch("/api/contact/product-feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          plan,
          projectId,
          source: "/app/studio:first-free-video",
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || text("Не удалось отправить отзыв.", "Could not send feedback."));
      }

      setFeedbackStatus("sent");
      logClientEvent("first_free_video_feedback_submitted", {
        messageLength: message.length,
        plan,
        projectId,
      });
    } catch (error) {
      setFeedbackStatus("idle");
      setFeedbackError(
        error instanceof Error
          ? error.message
          : text("Не удалось отправить отзыв. Попробуйте ещё раз.", "Could not send feedback. Try again."),
      );
    }
  };

  return (
    <section className={`first-video-success-offer${isFeedbackOpen ? " is-feedback-open" : ""}`} aria-labelledby={`${feedbackId}-title`}>
      <button
        className="first-video-success-offer__dismiss"
        type="button"
        aria-label={text("Закрыть предложение", "Close offer")}
        onClick={handleDismiss}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <div className="first-video-success-offer__main">
        <span className="first-video-success-offer__eyebrow">
          <span aria-hidden="true">✓</span>
          {text("Первое бесплатное видео готово", "Your first free video is ready")}
        </span>
        <h2 id={`${feedbackId}-title`}>{text("Продолжите с готовой идеей", "Keep the momentum going")}</h2>
        <p>
          {text(
            "На START хватит до 5 новых Shorts — без водяного знака.",
            "Choose a plan to create more Shorts without a watermark.",
          )}
        </p>
        <div className="first-video-success-offer__value" aria-label={text("Условия тарифа START", "START plan terms")}>
          <strong>50 ⚡</strong>
          <span>{text("390 ₽", "START")}</span>
          <small>{text("разовая оплата", "plan options")}</small>
        </div>
        <button className="first-video-success-offer__upgrade" type="button" onClick={handleUpgrade}>
          {text("Продолжить со START", "View plans")}
          {locale === "ru" ? <span>390 ₽</span> : null}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <small className="first-video-success-offer__renewal-note">
          {text("Без автопродления", "See current availability on pricing")}
        </small>
      </div>

      <div className="first-video-success-offer__feedback">
        {feedbackStatus === "sent" ? (
          <div className="first-video-success-offer__thanks" role="status">
            <span aria-hidden="true">♥</span>
            <strong>{text("Спасибо за отзыв!", "Thanks for your feedback!")}</strong>
            <p>{text("Он поможет нам сделать сервис удобнее.", "It will help us improve the product.")}</p>
          </div>
        ) : (
          <>
            <button
              className="first-video-success-offer__feedback-toggle"
              type="button"
              aria-expanded={isFeedbackOpen}
              aria-controls={`${feedbackId}-form`}
              onClick={handleFeedbackToggle}
            >
              <span>
                <strong>{text("Помогите нам стать лучше", "Help us improve")}</strong>
                <small>{text("Оставьте короткий отзыв", "Share a quick note")}</small>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {isFeedbackOpen ? (
              <form id={`${feedbackId}-form`} onSubmit={handleFeedbackSubmit}>
                <label htmlFor={`${feedbackId}-message`}>
                  {text("Что понравилось? Что можно улучшить?", "What did you like? What could be improved?")}
                </label>
                <textarea
                  id={`${feedbackId}-message`}
                  value={feedback}
                  maxLength={2000}
                  rows={3}
                  autoFocus
                  placeholder={text("Например: результат понравился, но…", "For example: I liked the result, but…")}
                  onChange={(event) => setFeedback(event.target.value)}
                />
                <div className="first-video-success-offer__feedback-actions">
                  {feedbackError ? <span role="alert">{feedbackError}</span> : <span />}
                  <button type="submit" disabled={feedbackStatus === "sending"}>
                    {feedbackStatus === "sending" ? text("Отправляем…", "Sending…") : text("Отправить", "Send")}
                  </button>
                </div>
              </form>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
