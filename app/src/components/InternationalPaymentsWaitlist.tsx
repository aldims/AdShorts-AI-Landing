import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "react-router-dom";

import { defineMessages, useLocale } from "../lib/i18n";

type WaitlistFeedback = {
  kind: "error" | "success";
  message: string;
} | null;

type WaitlistResponse = {
  data?: {
    ok: boolean;
  };
  error?: string;
};

type Props = {
  defaultEmail?: string | null;
};

const WAITLIST_REQUEST_TIMEOUT_MS = 20_000;

const waitlistMessages = defineMessages({
  body: {
    ru: "",
    en: "You can try AdShorts AI for free now. Create Shorts, test the studio, voiceover, subtitles and publishing tools while international card payments are being prepared.",
  },
  checkoutTimeout: {
    ru: "",
    en: "Checkout is taking too long. Try again in a few seconds.",
  },
  emailLabel: {
    ru: "",
    en: "Email for international payments waitlist",
  },
  error: {
    ru: "",
    en: "Could not join the waitlist. Try again in a moment.",
  },
  eyebrow: {
    ru: "",
    en: "International checkout",
  },
  hint: {
    ru: "",
    en: "We'll only use this email for international checkout updates.",
  },
  invalidEmail: {
    ru: "",
    en: "Enter a valid email.",
  },
  placeholder: {
    ru: "",
    en: "you@company.com",
  },
  submit: {
    ru: "",
    en: "Join waitlist",
  },
  submitting: {
    ru: "",
    en: "Joining...",
  },
  success: {
    ru: "",
    en: "You're on the list. We'll email you when international payments open.",
  },
  title: {
    ru: "",
    en: "International payments are coming soon.",
  },
});

export function InternationalPaymentsWaitlist({ defaultEmail = "" }: Props) {
  const location = useLocation();
  const { t } = useLocale();
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [feedback, setFeedback] = useState<WaitlistFeedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!defaultEmail || email.trim()) {
      return;
    }

    setEmail(defaultEmail);
  }, [defaultEmail, email]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(normalizedEmail)) {
      setFeedback({
        kind: "error",
        message: t(waitlistMessages.invalidEmail),
      });
      return;
    }

    setFeedback(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact/international-payments-waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          source: `${location.pathname}${location.search}`,
        }),
        signal: AbortSignal.timeout(WAITLIST_REQUEST_TIMEOUT_MS),
      });
      const payload = (await response.json().catch(() => null)) as WaitlistResponse | null;

      if (!response.ok || !payload?.data?.ok) {
        throw new Error(payload?.error ?? t(waitlistMessages.error));
      }

      setEmail(normalizedEmail);
      setFeedback({
        kind: "success",
        message: t(waitlistMessages.success),
      });
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "TimeoutError"
          ? t(waitlistMessages.checkoutTimeout)
          : error instanceof Error
            ? error.message
            : t(waitlistMessages.error);

      setFeedback({
        kind: "error",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pricing-max-international-hero" role="note">
      <span className="pricing-max-international-hero__eyebrow">{t(waitlistMessages.eyebrow)}</span>
      <strong>{t(waitlistMessages.title)}</strong>
      <p>{t(waitlistMessages.body)}</p>
      <form className="pricing-max-international-waitlist" onSubmit={handleSubmit}>
        <div className="pricing-max-international-waitlist__field">
          <input
            aria-label={t(waitlistMessages.emailLabel)}
            autoComplete="email"
            inputMode="email"
            maxLength={180}
            onChange={(event) => {
              setEmail(event.target.value);
              if (feedback?.kind === "error") {
                setFeedback(null);
              }
            }}
            placeholder={t(waitlistMessages.placeholder)}
            type="email"
            value={email}
            required
          />
          <button
            className="btn pricing-max-international-waitlist__submit route-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? t(waitlistMessages.submitting) : t(waitlistMessages.submit)}
          </button>
        </div>
        <p
          className={`pricing-max-international-waitlist__status${
            feedback ? ` pricing-max-international-waitlist__status--${feedback.kind}` : ""
          }`}
          role={feedback?.kind === "error" ? "alert" : "status"}
        >
          {feedback?.message ?? t(waitlistMessages.hint)}
        </p>
      </form>
    </div>
  );
}
