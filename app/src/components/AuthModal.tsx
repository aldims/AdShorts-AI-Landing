import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import googleLogoUrl from "../assets/google-g-logo.svg";
import telegramLogoUrl from "../assets/telegram-logo.svg";
import { authClient } from "../lib/auth-client";
import { logClientEvent } from "../lib/client-log";
import { useLocale, type Locale } from "../lib/i18n";

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

type TelegramAuthConfig = {
  authorizationUrl?: string;
  botId: string;
  botUsername: string;
  clientId: string;
  flow?: "code" | "post_message";
  nonce?: string;
  requestAccess?: string[];
};

type TelegramLoginResult = {
  error?: string;
  id_token?: string;
  redirectTo?: string;
  signedIn?: boolean;
  user?: unknown;
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

const copy: Record<AuthMode, Record<Locale, {
  eyebrow: string;
  title: string;
  lead: string;
  submit: string;
  switchLabel: string;
  switchMode: string;
}>> = {
  signup: {
    ru: {
    eyebrow: "Регистрация",
    title: "Создайте аккаунт",
    lead: "",
    submit: "Создать аккаунт",
    switchLabel: "Уже есть аккаунт?",
    switchMode: "Войти",
    },
    en: {
      eyebrow: "Sign up",
      title: "Create an account",
      lead: "",
      submit: "Create account",
      switchLabel: "Already have an account?",
      switchMode: "Sign in",
    },
  },
  signin: {
    ru: {
      eyebrow: "Вход",
      title: "Войдите в AdShorts AI",
      lead: "",
      submit: "Войти",
      switchLabel: "Новый пользователь?",
      switchMode: "Создать аккаунт",
    },
    en: {
      eyebrow: "Sign in",
      title: "Sign in to AdShorts AI",
      lead: "",
      submit: "Sign in",
      switchLabel: "New user?",
      switchMode: "Create account",
    },
  },
};

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

const TELEGRAM_OIDC_ORIGIN = "https://oauth.telegram.org";
const TELEGRAM_AUTH_MESSAGE_TYPE = "adshorts.telegramAuth";
const TELEGRAM_POPUP_CLOSE_GRACE_MS = 5_000;

const readResponseErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: unknown };
    const message = typeof payload.error === "string" ? payload.error.trim() : "";
    return message || fallback;
  } catch {
    return fallback;
  }
};

const buildTelegramLoginUrl = (config: TelegramAuthConfig, locale: Locale) => {
  const scopes = ["openid", "profile"];
  for (const access of config.requestAccess ?? []) {
    if (access === "write") scopes.push("telegram:bot_access");
    if (access === "phone") scopes.push("phone");
  }

  const redirectUri = `${window.location.origin}/`;
  const params = new URLSearchParams({
    client_id: config.clientId || config.botId,
    redirect_uri: redirectUri,
    response_type: "post_message",
    scope: scopes.join(" "),
  });

  if (config.nonce) params.set("nonce", config.nonce);
  if (config.nonce) {
    params.set("code_challenge", config.nonce);
    params.set("code_challenge_method", "plain");
  }
  if (locale) params.set("lang", locale);

  return `${TELEGRAM_OIDC_ORIGIN}/auth?${params.toString()}`;
};

const readTelegramSignedInResult = async (): Promise<TelegramLoginResult | null> => {
  try {
    const response = await fetch("/api/me", { credentials: "include" });
    if (!response.ok) return null;

    return {
      redirectTo: "/app/studio",
      signedIn: true,
    };
  } catch {
    return null;
  }
};

const openTelegramLoginPopup = (config: TelegramAuthConfig, locale: Locale) =>
  new Promise<TelegramLoginResult>((resolve, reject) => {
    const width = 550;
    const height = 650;
    const screenOffset = window.screen as Screen & { availLeft?: number; availTop?: number };
    const left = Math.max(0, (window.screen.width - width) / 2) + (screenOffset.availLeft || 0);
    const top = Math.max(0, (window.screen.height - height) / 2) + (screenOffset.availTop || 0);
    const popup = window.open(
      config.authorizationUrl || buildTelegramLoginUrl(config, locale),
      "telegram_oidc_login",
      `width=${width},height=${height},left=${left},top=${top},status=0,location=0,menubar=0,toolbar=0`,
    );

    if (!popup) {
      reject(new Error(locale === "en" ? "Telegram popup was blocked." : "Окно Telegram было заблокировано браузером."));
      return;
    }

    let isFinished = false;
    let closeTimer: number | null = null;
    let closedAt: number | null = null;
    let closeCheckPending = false;

    const cleanup = () => {
      isFinished = true;
      window.removeEventListener("message", onMessage);
      if (closeTimer !== null) {
        window.clearInterval(closeTimer);
      }
    };

    const finish = (result: TelegramLoginResult) => {
      if (isFinished) return;
      cleanup();
      resolve(result);
    };

    const fail = (error: Error) => {
      if (isFinished) return;
      cleanup();
      reject(error);
    };

    function onMessage(event: MessageEvent) {
      let data: { event?: unknown; error?: unknown; result?: unknown };
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (event.origin === window.location.origin && data && (data as { type?: unknown }).type === TELEGRAM_AUTH_MESSAGE_TYPE) {
        const redirectTo = typeof (data as { redirectTo?: unknown }).redirectTo === "string" ? (data as { redirectTo: string }).redirectTo : "/app/studio";
        const message = typeof data.error === "string" ? data.error : "";
        if (message) {
          finish({ error: message });
          return;
        }

        finish({ redirectTo, signedIn: true });
        return;
      }

      if (event.origin !== TELEGRAM_OIDC_ORIGIN) return;
      if (!data || data.event !== "auth_result") return;
      if (typeof data.error === "string" && data.error) {
        finish({ error: data.error });
        return;
      }
      if (typeof data.result === "string" && data.result) {
        finish({ id_token: data.result });
        return;
      }
      if (data.result && typeof data.result === "object" && "id_token" in data.result && typeof data.result.id_token === "string") {
        finish({ id_token: data.result.id_token });
        return;
      }

      finish({ error: "missing id_token" });
    }

    window.addEventListener("message", onMessage);
    popup.focus();
    closeTimer = window.setInterval(() => {
      if (!popup.closed) {
        closedAt = null;
        return;
      }

      closedAt ??= Date.now();
      if (Date.now() - closedAt >= TELEGRAM_POPUP_CLOSE_GRACE_MS) {
        if (config.flow === "code" && !closeCheckPending) {
          closeCheckPending = true;
          void readTelegramSignedInResult().then((result) => {
            closeCheckPending = false;
            if (result) {
              finish(result);
              return;
            }

            fail(new Error(locale === "en" ? "Telegram authorization was cancelled." : "Авторизация Telegram отменена."));
          });
          return;
        }

        fail(new Error(locale === "en" ? "Telegram authorization was cancelled." : "Авторизация Telegram отменена."));
      }
    }, 250);
  });

export function AuthModal({ isOpen, mode, onClose, onModeChange, onSignedIn }: Props) {
  const { locale } = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<AuthStatus>(emptyStatus);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [devEmailPreview, setDevEmailPreview] = useState<DevEmailPreview | null>(null);
  const [authBackendIssue, setAuthBackendIssue] = useState<string | null>(null);
  const [telegramConfig, setTelegramConfig] = useState<TelegramAuthConfig | null>(null);
  const [isTelegramReady, setIsTelegramReady] = useState(false);

  const content = copy[mode][locale];
  const closeLabel = locale === "en" ? "Close" : "Закрыть";
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

  useEffect(() => {
    if (!isOpen || !status.telegramEnabled || authBackendIssue) {
      setTelegramConfig(null);
      setIsTelegramReady(false);
      return;
    }

    let isCancelled = false;

    const prepareTelegramLogin = async () => {
      setTelegramConfig(null);
      setIsTelegramReady(false);

      try {
        const origin = typeof window === "undefined" ? "" : window.location.origin;
        const configUrl = origin ? `/api/auth/telegram/config?origin=${encodeURIComponent(origin)}` : "/api/auth/telegram/config";
        const configResponse = await fetch(configUrl, { credentials: "include" });
        if (!configResponse.ok) return;

        const config = (await configResponse.json()) as TelegramAuthConfig;

        if (!isCancelled) {
          setTelegramConfig(config);
          setIsTelegramReady(Boolean(config.clientId || config.botId));
        }
      } catch {
        if (!isCancelled) {
          setTelegramConfig(null);
          setIsTelegramReady(false);
        }
      }
    };

    void prepareTelegramLogin();

    return () => {
      isCancelled = true;
    };
  }, [authBackendIssue, isOpen, status.telegramEnabled]);

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
            message: resolveAuthActionErrorMessage(error, locale === "en" ? "Could not create the account." : "Не удалось создать аккаунт."),
          });
          setBusyAction(null);
          return;
        }

        void logClientEvent("signup_complete", {
          authProvider: "email",
          lang: locale,
          path: typeof window === "undefined" ? null : `${window.location.pathname}${window.location.search}`,
        });

        setFeedback({
          kind: "success",
          message:
            status.mailMode === "smtp"
              ? locale === "en"
                ? "Confirmation email sent. Check Inbox and Spam. The account will activate after confirmation."
                : "Письмо с подтверждением отправлено — проверьте «Входящие» и папку «Спам». После подтверждения аккаунт будет активирован."
              : locale === "en"
                ? "Account created. For local testing, open the email preview below and confirm the email."
                : "Аккаунт создан. Для локальной проверки откройте превью письма ниже и подтвердите почту.",
        });

        if (status.mailMode === "ethereal") {
          await loadDevEmailPreview();
        }
      } catch (error) {
        setFeedback({
          kind: "error",
          message: resolveAuthActionErrorMessage(error, locale === "en" ? "Could not create the account." : "Не удалось создать аккаунт."),
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
            message: locale === "en" ? "Email is not confirmed yet. Send the email again and finish verification." : "Почта еще не подтверждена. Отправьте письмо повторно и завершите верификацию.",
          });

          if (status.mailMode === "ethereal") {
            await loadDevEmailPreview();
          }
        } else {
          setFeedback({
            kind: "error",
            message: resolveAuthActionErrorMessage(error, locale === "en" ? "Could not sign in." : "Не удалось войти в аккаунт."),
          });
        }
      }
    } catch (error) {
      setFeedback({
        kind: "error",
        message: resolveAuthActionErrorMessage(error, locale === "en" ? "Could not sign in." : "Не удалось войти в аккаунт."),
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
          message: resolveAuthActionErrorMessage(error, locale === "en" ? "Could not start Google sign-in." : "Не удалось запустить вход через Google."),
        });
        setBusyAction(null);
      }
    } catch (error) {
      setFeedback({
        kind: "error",
        message: resolveAuthActionErrorMessage(error, locale === "en" ? "Could not start Google sign-in." : "Не удалось запустить вход через Google."),
      });
      setBusyAction(null);
    }
  };

  const handleTelegramSignIn = async () => {
    setBusyAction("telegram");
    setFeedback(null);

    if (authBackendIssue) {
      setFeedback({ kind: "error", message: authBackendIssue });
      setBusyAction(null);
      return;
    }

    if (!status.telegramEnabled) {
      setFeedback({
        kind: "error",
        message: locale === "en" ? "Telegram sign-in is not configured." : "Вход через Telegram не настроен.",
      });
      setBusyAction(null);
      return;
    }

    try {
      if (!telegramConfig || !isTelegramReady) {
        throw new Error(
          locale === "en"
            ? "Telegram sign-in is still loading. Try again in a second."
            : "Вход через Telegram ещё загружается. Попробуйте через секунду.",
        );
      }

      const loginPayload = await openTelegramLoginPopup(telegramConfig, locale);
      if (loginPayload.error) {
        throw new Error(loginPayload.error);
      }

      if (loginPayload.signedIn) {
        void logClientEvent(mode === "signup" ? "signup_complete" : "signin_complete", {
          authProvider: "telegram",
          lang: locale,
          path: typeof window === "undefined" ? null : `${window.location.pathname}${window.location.search}`,
        });

        onClose();
        onSignedIn();
        window.location.assign(loginPayload.redirectTo || "/app/studio");
        return;
      }

      if (!loginPayload.id_token) {
        throw new Error(locale === "en" ? "Telegram did not return an ID token." : "Telegram не вернул ID token.");
      }

      const callbackResponse = await fetch("/api/auth/telegram/callback", {
        body: JSON.stringify({ id_token: loginPayload.id_token }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!callbackResponse.ok) {
        throw new Error(
          await readResponseErrorMessage(
            callbackResponse,
            locale === "en" ? "Could not sign in with Telegram." : "Не удалось войти через Telegram.",
          ),
        );
      }

      const result = (await callbackResponse.json()) as { redirectTo?: unknown };
      void logClientEvent(mode === "signup" ? "signup_complete" : "signin_complete", {
        authProvider: "telegram",
        lang: locale,
        path: typeof window === "undefined" ? null : `${window.location.pathname}${window.location.search}`,
      });

      onClose();
      onSignedIn();
      const redirectTo = typeof result.redirectTo === "string" && result.redirectTo ? result.redirectTo : "/app/studio";
      window.location.assign(redirectTo);
    } catch (error) {
      setFeedback({
        kind: "error",
        message: resolveAuthActionErrorMessage(error, locale === "en" ? "Could not sign in with Telegram." : "Не удалось войти через Telegram."),
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
        aria-label={closeLabel}
        onClick={onClose}
      />
      <div className="signup-modal__panel" role="document">
        <button className="signup-modal__close route-close" type="button" aria-label={closeLabel} onClick={onClose}>
          ×
        </button>
        <p className="signup-modal__eyebrow">{content.eyebrow}</p>
        <h2 id="signup-modal-title">{content.title}</h2>
        {content.lead ? <p className="signup-modal__lead">{content.lead}</p> : null}

        <div className={`signup-modal__social${status.telegramEnabled ? " signup-modal__social--paired" : ""}`}>
          <button
            className="signup-social__button route-button"
            type="button"
            disabled={!status.googleEnabled || isBusy || Boolean(authBackendIssue)}
            onClick={handleGoogleSignIn}
          >
            <span className="signup-social__icon signup-social__icon--google" aria-hidden="true">
              <img src={googleLogoUrl} alt="" />
            </span>
            <span className="signup-social__copy">
              <span>Google</span>
              {!status.googleEnabled ? <small>{locale === "en" ? "Not configured" : "Не настроено"}</small> : null}
            </span>
          </button>
          {status.telegramEnabled ? (
            <button
              className="signup-social__button route-button"
              type="button"
              disabled={!isTelegramReady || isBusy || Boolean(authBackendIssue)}
              onClick={handleTelegramSignIn}
            >
              <span className="signup-social__icon signup-social__icon--telegram" aria-hidden="true">
                <img src={telegramLogoUrl} alt="" />
              </span>
              <span className="signup-social__copy">
                <span>Telegram</span>
                {!isTelegramReady ? <small>{locale === "en" ? "Loading" : "Загрузка"}</small> : null}
              </span>
            </button>
          ) : null}
        </div>

        <div className="signup-modal__divider">
          <span>{locale === "en" ? "or use email" : "или через email"}</span>
        </div>

        <form className="signup-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label className="signup-field">
              <span>{locale === "en" ? "Name" : "Имя"}</span>
              <input
                autoComplete="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={locale === "en" ? "Your name" : "Ваше имя"}
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
            <span>{locale === "en" ? "Password" : "Пароль"}</span>
            <input
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={locale === "en" ? "At least 8 characters" : "Минимум 8 символов"}
              minLength={8}
              required
            />
          </label>

          <button
            className={`btn ${mode === "signin" ? "signup-form__submit--dark" : "btn--primary"} signup-form__submit route-button`}
            type="submit"
            disabled={isBusy || Boolean(authBackendIssue)}
          >
            {busyAction === "signup" || busyAction === "signin" ? (locale === "en" ? "Please wait..." : "Подождите...") : content.submit}
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
            {locale === "en" ? "Open email preview" : "Открыть preview письма"}
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
