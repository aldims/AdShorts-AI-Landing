import { type FormEvent, useEffect, useId, useState } from "react";

import { logClientEvent } from "../lib/client-log";
import type { FirstVideoOfferVariant } from "../lib/first-video-offer";

type FirstVideoSuccessOfferProps = {
  checkoutError: string | null;
  isCheckoutPending: boolean;
  locale: "ru" | "en";
  onCheckoutStart: () => void;
  onComparePlans: () => void;
  onDismiss: () => void;
  plan: string | null;
  projectId: number | null;
  variant: FirstVideoOfferVariant;
};

type FeedbackStatus = "idle" | "sending" | "sent";

export function FirstVideoSuccessOffer({
  checkoutError,
  isCheckoutPending,
  locale,
  onCheckoutStart,
  onComparePlans,
  onDismiss,
  plan,
  projectId,
  variant,
}: FirstVideoSuccessOfferProps) {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>("idle");
  const feedbackId = useId();
  const text = (ru: string, en: string) => (locale === "en" ? en : ru);
  const analyticsContext = {
    plan,
    productId: "start",
    projectId,
    source: "first_free_video_offer",
    variant,
  } as const;

  useEffect(() => {
    logClientEvent("first_free_video_offer_viewed", {
      ...analyticsContext,
      path: `${window.location.pathname}${window.location.search}`,
    });
  }, [plan, projectId, variant]);

  const handleCheckout = () => {
    logClientEvent("first_video_offer_checkout_clicked", {
      ...analyticsContext,
      path: `${window.location.pathname}${window.location.search}`,
    });
    onCheckoutStart();
  };

  const handleComparePlans = () => {
    logClientEvent("first_video_offer_compare_plans_clicked", analyticsContext);
    onComparePlans();
  };

  const handleDismiss = () => {
    logClientEvent("first_free_video_offer_dismissed", analyticsContext);
    onDismiss();
  };

  const handleFeedbackToggle = () => {
    const nextIsOpen = !isFeedbackOpen;
    setIsFeedbackOpen(nextIsOpen);
    setFeedbackError(null);
    if (nextIsOpen) {
      logClientEvent("first_free_video_feedback_opened", analyticsContext);
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
          source: `/app/studio:first-free-video:${variant}`,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || text("Не удалось отправить отзыв.", "Could not send feedback."));
      }

      setFeedbackStatus("sent");
      logClientEvent("first_free_video_feedback_submitted", {
        ...analyticsContext,
        messageLength: message.length,
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

  const checkoutLabel =
    variant === "start_direct_v1"
      ? text("Получить 50 кредитов", "Get 50 credits")
      : text("Продолжить со START", "Continue with START");
  const feedbackSection = (
    <div className="first-video-success-offer__feedback">
      {feedbackStatus === "sent" ? (
        <span className="first-video-success-offer__thanks" role="status">
          {text("Спасибо — отзыв поможет улучшить сервис.", "Thanks — your feedback will help us improve.")}
        </span>
      ) : (
        <>
          <button
            className="first-video-success-offer__feedback-toggle"
            type="button"
            aria-expanded={isFeedbackOpen}
            aria-controls={`${feedbackId}-form`}
            onClick={handleFeedbackToggle}
          >
            {text("Что можно улучшить? Написать", "What could be improved? Tell us")}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {isFeedbackOpen ? (
            <form id={`${feedbackId}-form`} onSubmit={handleFeedbackSubmit}>
              <label htmlFor={`${feedbackId}-message`}>
                {text("Что понравилось? Что можно улучшить?", "What did you like? What could be improved?")}
              </label>
              <div className="first-video-success-offer__feedback-input">
                <textarea
                  id={`${feedbackId}-message`}
                  value={feedback}
                  maxLength={2000}
                  rows={3}
                  autoFocus
                  placeholder={text("Например: результат понравился, но…", "For example: I liked the result, but…")}
                  onChange={(event) => setFeedback(event.target.value)}
                />
                {feedbackError ? (
                  <span className="first-video-success-offer__feedback-error" role="alert">
                    {feedbackError}
                  </span>
                ) : null}
                <button
                  className="first-video-success-offer__feedback-submit"
                  type="submit"
                  disabled={feedbackStatus === "sending"}
                >
                  {feedbackStatus === "sending" ? text("Отправляем…", "Sending…") : text("Отправить", "Send")}
                </button>
              </div>
            </form>
          ) : null}
        </>
      )}
    </div>
  );

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
          {text("Ваш первый Shorts готов.", "Your first Short is ready.")}
        </span>
        <h2 id={`${feedbackId}-title`}>
          {text("Создайте ещё до 5 Shorts без водяного знака", "Create up to 5 more Shorts without a watermark")}
        </h2>
        <p>
          {text(
            "Раскройте больше тем, воплотите новые идеи и попробуйте разные форматы.",
            "Explore more topics, bring new ideas to life, and try different formats.",
          )}
        </p>
      </div>

      <aside className="first-video-success-offer__purchase" aria-label={text("Оплата START", "START checkout")}>
        <div className="first-video-success-offer__price">
          <div className="first-video-success-offer__price-copy">
            <span>START</span>
          </div>
          <strong>{text("390 ₽", "View pricing")}</strong>
        </div>
        <button
          className="first-video-success-offer__upgrade"
          type="button"
          disabled={isCheckoutPending}
          onClick={handleCheckout}
        >
          {isCheckoutPending ? (
            <>
              <span className="first-video-success-offer__spinner" aria-hidden="true" />
              {text("Открываем безопасную оплату…", "Opening secure checkout…")}
            </>
          ) : (
            <>
              {checkoutLabel}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </button>
        {checkoutError ? (
          <div className="first-video-success-offer__checkout-error" role="alert">
            <span>{checkoutError}</span>
            <button type="button" disabled={isCheckoutPending} onClick={handleCheckout}>
              {text("Повторить", "Try again")}
            </button>
          </div>
        ) : (
          <div className="first-video-success-offer__purchase-meta">
            <small className="first-video-success-offer__trust">
              {text(
                "Разовая оплата · без автосписаний",
                "One-time payment · no auto-renewal",
              )}
            </small>
            <button className="first-video-success-offer__compare" type="button" onClick={handleComparePlans}>
              {text("Сравнить тарифы", "Compare plans")}
            </button>
          </div>
        )}
        {feedbackSection}
      </aside>

      <div className="first-video-success-offer__details">
        <ul className="first-video-success-offer__facts" aria-label={text("Что входит в START", "What's included in START")}>
          <li><strong>50</strong> {text("кредитов", "credits")}</li>
          <li>{text("до 5 Shorts", "up to 5 Shorts")}</li>
        </ul>
      </div>

    </section>
  );
}
