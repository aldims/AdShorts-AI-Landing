import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocale } from "../lib/i18n";

type Feedback =
  | {
      kind: "error" | "success";
      message: string;
    }
  | null;

type AgencyContactResponse = {
  data?: {
    ok: boolean;
  };
  error?: string;
};

type Props = {
  defaultEmail?: string | null;
  defaultName?: string | null;
  isOpen: boolean;
  onClose: () => void;
};

const REQUEST_TIMEOUT_MS = 20_000;

export function AgencyContactModal({ defaultEmail = null, defaultName = null, isOpen, onClose }: Props) {
  const { locale } = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    if (typeof document !== "undefined") {
      document.body.classList.add("modal-open");
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      if (typeof document !== "undefined") {
        document.body.classList.remove("modal-open");
      }
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    setName(String(defaultName ?? "").trim());
    setEmail(String(defaultEmail ?? "").trim());
    setCompany("");
    setMessage("");
    setFeedback(null);
    setIsSubmitting(false);
  }, [defaultEmail, defaultName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact/agency", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company,
          email,
          message,
          name,
          source: typeof window === "undefined" ? "/pricing" : window.location.pathname,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const payload = (await response.json().catch(() => null)) as AgencyContactResponse | null;
      if (!response.ok || !payload?.data?.ok) {
        throw new Error(payload?.error ?? (locale === "en" ? "Could not send the request." : "Не удалось отправить заявку."));
      }

      setFeedback({
        kind: "success",
        message: locale === "en" ? "Request sent. We will reply to the specified email after reviewing the task." : "Заявка отправлена. Мы ответим на указанный email после просмотра задачи.",
      });
      setCompany("");
      setMessage("");
    } catch (error) {
      const messageText =
        error instanceof DOMException && error.name === "TimeoutError"
          ? locale === "en"
            ? "The server is taking too long. Try sending the form again."
            : "Сервер отвечает слишком долго. Попробуйте отправить форму ещё раз."
          : error instanceof Error
            ? error.message
            : locale === "en"
              ? "Could not send the request."
              : "Не удалось отправить заявку.";

      setFeedback({
        kind: "error",
        message: messageText,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`agency-modal${isOpen ? " is-open" : ""}`}
      id="agency-contact-modal"
      aria-hidden={!isOpen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agency-contact-modal-title"
    >
      <button className="agency-modal__backdrop route-close" type="button" aria-label={locale === "en" ? "Close" : "Закрыть"} onClick={onClose} />
      <div className="agency-modal__panel" role="document">
        <button className="agency-modal__close route-close" type="button" aria-label={locale === "en" ? "Close" : "Закрыть"} onClick={onClose}>
          ×
        </button>

        <p className="agency-modal__eyebrow">Agency / Teams</p>
        <h2 id="agency-contact-modal-title">{locale === "en" ? "Send a short request" : "Оставьте короткую заявку"}</h2>
        <p className="agency-modal__lead">{locale === "en" ? "Tell us which team or client workflow you plan to launch." : "Напишите, для какой команды или клиентского потока вы планируете запуск."}</p>

        <form className="agency-form" onSubmit={handleSubmit}>
          <label className="agency-field">
            <span>{locale === "en" ? "Name" : "Имя"}</span>
            <input
              autoComplete="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={locale === "en" ? "Your name" : "Ваше имя"}
              maxLength={120}
              required
            />
          </label>

          <label className="agency-field">
            <span>Email</span>
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              maxLength={180}
              required
            />
          </label>

          <label className="agency-field">
            <span>{locale === "en" ? "Company / team" : "Компания / команда"}</span>
            <input
              autoComplete="organization"
              type="text"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder={locale === "en" ? "Company or team name" : "Название компании или команды"}
              maxLength={160}
              required
            />
          </label>

          <label className="agency-field agency-field--textarea">
            <span>{locale === "en" ? "What you want to launch" : "Что хотите запускать"}</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={locale === "en" ? "Video volume and what matters in the process" : "Какой объём роликов и что важно в процессе"}
              rows={5}
              maxLength={2000}
              minLength={10}
              required
            />
          </label>

          <button className="btn btn--primary agency-form__submit route-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (locale === "en" ? "Sending..." : "Отправляем...") : locale === "en" ? "Send request" : "Отправить заявку"}
          </button>
        </form>

        {feedback ? (
          <p className={`agency-modal__status agency-modal__status--${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>
            {feedback.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
