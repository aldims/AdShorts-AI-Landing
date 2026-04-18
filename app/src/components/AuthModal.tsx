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
    title: "Создайте аккаунт",
    lead: "",
    submit: "Создать аккаунт",
    switchLabel: "Уже есть аккаунт?",
    switchMode: "Войти",
  },
  signin: {
    eyebrow: "Вход",
    title: "Войдите в личный кабинет AdShorts AI",
    lead: "",
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

const getAuthBackendUnavailableMessage = () => {
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "Локальный auth backend недоступен. Для входа запустите API-сервер на 127.0.0.1:4175 командой `npm run dev` или `npm run preview` в папке `app/`.";
  }

  return "Сервис авторизации временно недоступен. Попробуйте позже.";
};

const resolveAuthActionErrorMessage = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) {
    return fallback;
  }

  const normalizedMessage = message.toLowerCase();
  if (
    normalizedMessage.includes("fetch") ||
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("502") ||
    normalizedMessage.includes("503") ||
    normalizedMessage.includes("504")
  ) {
    return getAuthBackendUnavailableMessage();
  }

  return message;
};

export function AuthModal({ isOpen, mode, onClose, onModeChange, onSignedIn }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<AuthStatus>(emptyStatus);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [devEmailPreview, setDevEmailPreview] = useState<DevEmailPreview | null>(null);
  const [authBackendIssue, setAuthBackendIssue] = useState<string | null>(null);

  const content = copy[mode];
  const isBusy = busyAction !== null;
  const callbackURL = useMemo(() => {
    if (typeof window === "undefined") return "http://127.0.0.1:4174/";
    return `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
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
      try {
        const response = await fetch("/api/auth/status");
        if (!response.ok) {
          const message = resolveAuthActionErrorMessage(new Error(String(response.status)), getAuthBackendUnavailableMessage());
          setAuthBackendIssue(message);
          setFeedback({ kind: "error", message });
          return;
        }

        const data = (await response.json()) as AuthStatus;
        setStatus(data);
        setAuthBackendIssue(null);
      } catch (error) {
        const message = resolveAuthActionErrorMessage(error, getAuthBackendUnavailableMessage());
        setAuthBackendIssue(message);
        setFeedback({ kind: "error", message });
      }
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

    if (authBackendIssue) {
      setFeedback({ kind: "error", message: authBackendIssue });
      return;
    }

    if (mode === "signup") {
      setBusyAction("signup");
      try {
        const { error } = await authClient.signUp.email({
          callbackURL,
          email,
          name,
          password,
        });

        if (error) {
          setFeedback({
            kind: "error",
            message: resolveAuthActionErrorMessage(error, "Не удалось создать аккаунт."),
          });
          setBusyAction(null);
          return;
        }

        setFeedback({
          kind: "success",
          message:
            status.mailMode === "smtp"
              ? "Письмо с подтверждением отправлено — проверьте «Входящие» и папку «Спам». После подтверждения аккаунт будет активирован."
              : "Аккаунт создан. Для локальной проверки откройте превью письма ниже и подтвердите почту.",
        });

        if (status.mailMode === "ethereal") {
          await loadDevEmailPreview();
        }
      } catch (error) {
        setFeedback({
          kind: "error",
          message: resolveAuthActionErrorMessage(error, "Не удалось создать аккаунт."),
        });
        setBusyAction(null);
        return;
      }

      setBusyAction(null);
      return;
    }

    setBusyAction("signin");
    try {
      const { error } = await authClient.signIn.email(
        {
          callbackURL,
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
          setFeedback({
            kind: "error",
            message: resolveAuthActionErrorMessage(error, "Не удалось войти в аккаунт."),
          });
        }
      }
    } catch (error) {
      setFeedback({
        kind: "error",
        message: resolveAuthActionErrorMessage(error, "Не удалось войти в аккаунт."),
      });
    }

    setBusyAction(null);
  };

  const handleGoogleSignIn = async () => {
    setBusyAction("google");
    setFeedback(null);
    if (authBackendIssue) {
      setFeedback({ kind: "error", message: authBackendIssue });
      setBusyAction(null);
      return;
    }

    try {
      const { error } = await authClient.signIn.social({
        callbackURL,
        provider: "google",
      });

      if (error) {
        setFeedback({
          kind: "error",
          message: resolveAuthActionErrorMessage(error, "Не удалось запустить вход через Google."),
        });
        setBusyAction(null);
      }
    } catch (error) {
      setFeedback({
        kind: "error",
        message: resolveAuthActionErrorMessage(error, "Не удалось запустить вход через Google."),
      });
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
        {content.lead ? <p className="signup-modal__lead">{content.lead}</p> : null}

        <div className="signup-modal__social">
          <button
            className="signup-social__button route-button"
            type="button"
            disabled={!status.googleEnabled || isBusy || Boolean(authBackendIssue)}
            onClick={handleGoogleSignIn}
          >
            <span className="signup-social__icon signup-social__icon--google" aria-hidden="true">
              <img src="/google-g-logo.svg" alt="" />
            </span>
            <span className="signup-social__copy">
              <span>Google</span>
              {!status.googleEnabled ? <small>Не настроено</small> : null}
            </span>
          </button>
          <button
            className="signup-social__button route-button"
            type="button"
            disabled
          >
            <span className="signup-social__icon signup-social__icon--telegram" aria-hidden="true">
              <img src="/telegram-2019-logo.svg" alt="" />
            </span>
            <span className="signup-social__copy">
              <span>Telegram</span>
              <small>Скоро</small>
            </span>
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
                placeholder="Ваше имя"
                required
              />
            </label>
          )}

          <label className="signup-field">
            <span>Email</span>
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

          <button
            className={`btn ${mode === "signin" ? "signup-form__submit--dark" : "btn--primary"} signup-form__submit route-button`}
            type="submit"
            disabled={isBusy || Boolean(authBackendIssue)}
          >
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
      </div>
    </div>
  );
}
