import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { authClient } from "../lib/auth-client";

type AuthMode = "signup" | "signin";

type AuthStatus = {
  googleEnabled: boolean;
  mailMode: "smtp" | "ethereal";
  smtpConfigured: boolean;
  telegramEnabled: boolean;
};

type DevEmailPreview = {
  createdAt: string;
  mode: "smtp" | "ethereal";
  previewUrl: string | null;
  subject: string;
  to: string;
};

type Feedback =
  | {
      kind: "error" | "info" | "success";
      message: string;
    }
  | null;

type Props = {
  isOpen: boolean;
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  onSignedIn: () => void;
};

const copy = {
  signup: {
    eyebrow: "Регистрация",
    title: "Создайте аккаунт и откройте web-версию AdShorts AI",
    lead: "Email + подтверждение почты, а также быстрый вход через Google и Telegram.",
    submit: "Создать аккаунт",
    switchLabel: "Уже есть аккаунт?",
    switchMode: "Войти",
  },
  signin: {
    eyebrow: "Вход",
    title: "Войдите в личный кабинет AdShorts AI",
    lead: "Используйте email и пароль, либо быстрый вход через подключенные OAuth-провайдеры.",
    submit: "Войти",
    switchLabel: "Новый пользователь?",
    switchMode: "Создать аккаунт",
  },
} as const;

const emptyStatus: AuthStatus = {
  googleEnabled: false,
  mailMode: "ethereal",
  smtpConfigured: false,
  telegramEnabled: false,
};

export function AuthModal({ isOpen, mode, onClose, onModeChange, onSignedIn }: Props) {
  const [name, setName] = useState("Alex Kumar");
  const [email, setEmail] = useState("alex@adshorts.ai");
  const [password, setPassword] = useState("password123");
  const [status, setStatus] = useState<AuthStatus>(emptyStatus);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [devEmailPreview, setDevEmailPreview] = useState<DevEmailPreview | null>(null);

  const content = copy[mode];
  const isBusy = busyAction !== null;
  const verificationCallbackURL = useMemo(() => {
    if (typeof window === "undefined") return "http://127.0.0.1:4174/app/studio";
    return `${window.location.origin}/app/studio`;
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchStatus = async () => {
      const response = await fetch("/api/auth/status");
      if (!response.ok) return;

      const data = (await response.json()) as AuthStatus;
      setStatus(data);
    };

    void fetchStatus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setFeedback(null);
    setDevEmailPreview(null);
  }, [isOpen, mode]);

  const loadDevEmailPreview = async () => {
    const response = await fetch("/api/auth/dev/last-email");
    if (!response.ok) {
      setDevEmailPreview(null);
      return;
    }

    const payload = (await response.json()) as { data: DevEmailPreview | null };
    setDevEmailPreview(payload.data);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setDevEmailPreview(null);

    if (mode === "signup") {
      setBusyAction("signup");

      const { error } = await authClient.signUp.email({
        callbackURL: verificationCallbackURL,
        email,
        name,
        password,
      });

      if (error) {
        setFeedback({ kind: "error", message: error.message ?? "Не удалось создать аккаунт." });
        setBusyAction(null);
        return;
      }

      setFeedback({
        kind: "success",
        message:
          status.mailMode === "smtp"
            ? "Аккаунт создан. Мы отправили письмо с подтверждением на вашу почту."
            : "Аккаунт создан. Для локальной проверки откройте превью письма ниже и подтвердите почту.",
      });

      if (status.mailMode === "ethereal") {
        await loadDevEmailPreview();
      }

      setBusyAction(null);
      return;
    }

    setBusyAction("signin");

    const { error } = await authClient.signIn.email(
      {
        callbackURL: verificationCallbackURL,
        email,
        password,
        rememberMe: true,
      },
      {
        onSuccess: () => {
          onClose();
          onSignedIn();
        },
      },
    );

    if (error) {
      if (error.status === 403) {
        setFeedback({
          kind: "info",
          message: "Почта еще не подтверждена. Отправьте письмо повторно и завершите верификацию.",
        });

        if (status.mailMode === "ethereal") {
          await loadDevEmailPreview();
        }
      } else {
        setFeedback({ kind: "error", message: error.message ?? "Не удалось войти в аккаунт." });
      }
    }

    setBusyAction(null);
  };

  const handleResendVerification = async () => {
    setBusyAction("resend-verification");
    setFeedback(null);

    const { error } = await authClient.sendVerificationEmail({
      callbackURL: verificationCallbackURL,
      email,
    });

    if (error) {
      setFeedback({ kind: "error", message: error.message ?? "Не удалось отправить письмо повторно." });
      setBusyAction(null);
      return;
    }

    setFeedback({
      kind: "success",
      message:
        status.mailMode === "smtp"
          ? "Письмо с подтверждением отправлено повторно."
          : "Новое письмо готово. Откройте превью ниже и завершите подтверждение.",
    });

    if (status.mailMode === "ethereal") {
      await loadDevEmailPreview();
    }

    setBusyAction(null);
  };

  const handleGoogleSignIn = async () => {
    setBusyAction("google");
    setFeedback(null);

    const { error } = await authClient.signIn.social({
      callbackURL: verificationCallbackURL,
      provider: "google",
    });

    if (error) {
      setFeedback({ kind: "error", message: error.message ?? "Не удалось запустить вход через Google." });
      setBusyAction(null);
    }
  };

  const handleTelegramSignIn = async () => {
    setBusyAction("telegram");
    setFeedback(null);

    const { error } = await authClient.signIn.oauth2({
      callbackURL: verificationCallbackURL,
      providerId: "telegram",
    });

    if (error) {
      setFeedback({ kind: "error", message: error.message ?? "Не удалось запустить вход через Telegram." });
      setBusyAction(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`signup-modal${isOpen ? " is-open" : ""}`}
      id="signup-modal"
      aria-hidden={!isOpen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-modal-title"
    >
      <button
        className="signup-modal__backdrop route-close"
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="signup-modal__panel" role="document">
        <button className="signup-modal__close route-close" type="button" aria-label="Закрыть" onClick={onClose}>
          ×
        </button>
        <p className="signup-modal__eyebrow">{content.eyebrow}</p>
        <h2 id="signup-modal-title">{content.title}</h2>
        <p className="signup-modal__lead">{content.lead}</p>

        <div className="signup-modal__social">
          <button
            className="signup-social__button route-button"
            type="button"
            disabled={!status.googleEnabled || isBusy}
            onClick={handleGoogleSignIn}
          >
            <span>Google</span>
            <small>{status.googleEnabled ? "OAuth" : "Not configured"}</small>
          </button>
          <button
            className="signup-social__button route-button"
            type="button"
            disabled={!status.telegramEnabled || isBusy}
            onClick={handleTelegramSignIn}
          >
            <span>Telegram</span>
            <small>{status.telegramEnabled ? "OIDC" : "Not configured"}</small>
          </button>
        </div>

        <div className="signup-modal__divider">
          <span>или через email</span>
        </div>

        <form className="signup-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label className="signup-field">
              <span>Имя</span>
              <input
                autoComplete="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Alex Kumar"
                required
              />
            </label>
          )}

          <label className="signup-field">
            <span>Рабочий email</span>
            <input
              id="signup-email"
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>

          <label className="signup-field">
            <span>Пароль</span>
            <input
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Минимум 8 символов"
              minLength={8}
              required
            />
          </label>

          <button className="btn btn--primary signup-form__submit route-button" type="submit" disabled={isBusy}>
            {busyAction === "signup" || busyAction === "signin" ? "Подождите..." : content.submit}
          </button>
        </form>

        {feedback && (
          <p
            className={`signup-modal__status signup-modal__status--${feedback.kind}`}
            role={feedback.kind === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        )}

        {devEmailPreview?.previewUrl && (
          <a
            className="signup-modal__preview route-linkbtn"
            href={devEmailPreview.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть preview письма
          </a>
        )}

        <div className="signup-modal__footer">
          <button
            className="signup-modal__secondary route-button"
            type="button"
            disabled={!email || isBusy}
            onClick={handleResendVerification}
          >
            Отправить письмо повторно
          </button>

          <p className="signup-modal__switch">
            <span>{content.switchLabel}</span>
            <button
              className="signup-modal__switchbtn route-button"
              type="button"
              disabled={isBusy}
              onClick={() => onModeChange(mode === "signup" ? "signin" : "signup")}
            >
              {content.switchMode}
            </button>
          </p>
        </div>

        <p className="signup-modal__meta">
          {status.mailMode === "smtp"
            ? "Email verification отправляется через SMTP."
            : "SMTP не настроен. В локальной разработке используется Ethereal preview inbox."}
        </p>
      </div>
    </div>
  );
}
