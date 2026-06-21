import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import googleLogoUrl from "../assets/google-g-logo.svg";
import telegramLogoUrl from "../assets/telegram-logo.svg";
import { authClient } from "../lib/auth-client";
import { clearPendingAuthFlow, writePendingAuthFlow } from "../lib/auth-funnel";
import { logClientEvent } from "../lib/client-log";
import { useLocale, type Locale } from "../lib/i18n";

type AuthMode = "signup" | "signin";
type EmailCodeStep = "email" | "code";

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
  flow?: "code" | "post_message" | "widget";
  nonce?: string;
  requestAccess?: string[];
};

type TelegramWidgetAuthData = {
  auth_date?: number | string;
  first_name?: string;
  hash?: string;
  id?: number | string;
  last_name?: string;
  photo_url?: string;
  username?: string;
};

type TelegramLoginResult = {
  authData?: TelegramWidgetAuthData;
  error?: string;
  id_token?: string;
  redirectTo?: string;
  signedIn?: boolean;
  user?: unknown;
};

type TelegramLoginApi = {
  auth: (
    options: {
      bot_id: number | string;
      lang?: string;
      request_access?: string;
    },
    callback: (authData: TelegramWidgetAuthData | false) => void,
  ) => void;
};

declare global {
  interface Window {
    Telegram?: {
      Login?: TelegramLoginApi;
    };
  }
}

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
  onSignedIn: () => void;
};

const copy: Record<Locale, {
  title: string;
  lead: string;
  submit: string;
}> = {
  ru: {
    title: "Войдите в AdShorts AI",
    lead: "Если аккаунта ещё нет, мы создадим его автоматически.",
    submit: "Войти",
  },
  en: {
    title: "Sign in to AdShorts AI",
    lead: "If you do not have an account yet, we will create it automatically.",
    submit: "Sign in",
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
const TELEGRAM_WIDGET_SCRIPT_SRC = "https://telegram.org/js/telegram-widget.js?22";

let telegramWidgetScriptPromise: Promise<void> | null = null;

const readResponseErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: unknown };
    const message = typeof payload.error === "string" ? payload.error.trim() : "";
    return message || fallback;
  } catch {
    return fallback;
  }
};

const normalizeEmailCode = (value: string) => value.replace(/\D/g, "").slice(0, 6);

const getAuthAnalyticsPath = () => {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`;
};

const getAuthAnalyticsErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return message.trim().slice(0, 240) || null;
};

const hasTelegramAuthorizationUrl = (
  config: TelegramAuthConfig | null,
): config is TelegramAuthConfig & { authorizationUrl: string } =>
  typeof config?.authorizationUrl === "string" && config.authorizationUrl.trim().length > 0;

const hasTelegramWidgetConfig = (config: TelegramAuthConfig | null) =>
  config?.flow === "widget" && typeof config.botId === "string" && config.botId.trim().length > 0;

const isTelegramConfigReady = (config: TelegramAuthConfig | null) =>
  hasTelegramWidgetConfig(config) || hasTelegramAuthorizationUrl(config);

const loadTelegramWidgetScript = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Telegram login is unavailable outside the browser."));
  }

  if (window.Telegram?.Login?.auth) {
    return Promise.resolve();
  }

  if (telegramWidgetScriptPromise) {
    return telegramWidgetScriptPromise;
  }

  telegramWidgetScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${TELEGRAM_WIDGET_SCRIPT_SRC}"]`);
    const script = existingScript ?? document.createElement("script");

    const cleanup = () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      cleanup();
      if (window.Telegram?.Login?.auth) {
        resolve();
        return;
      }

      telegramWidgetScriptPromise = null;
      reject(new Error("Telegram login widget did not initialize."));
    };
    const handleError = () => {
      cleanup();
      telegramWidgetScriptPromise = null;
      reject(new Error("Could not load Telegram login widget."));
    };

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    if (!existingScript) {
      script.async = true;
      script.src = TELEGRAM_WIDGET_SCRIPT_SRC;
      document.head.appendChild(script);
    }
  });

  return telegramWidgetScriptPromise;
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

const openTelegramWidgetAuth = async (config: TelegramAuthConfig, locale: Locale) => {
  const botId = config.botId.trim();
  if (!botId) {
    throw new Error(locale === "en" ? "Telegram sign-in is not configured correctly." : "Вход через Telegram настроен некорректно.");
  }

  await loadTelegramWidgetScript();

  const telegramLogin = window.Telegram?.Login;
  if (!telegramLogin?.auth) {
    throw new Error(locale === "en" ? "Telegram sign-in is unavailable." : "Вход через Telegram недоступен.");
  }

  return new Promise<TelegramLoginResult>((resolve, reject) => {
    let isSettled = false;
    let popupWasOpened = true;
    const originalOpen = window.open;
    const timeoutId = window.setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      reject(new Error(locale === "en" ? "Telegram authorization timed out." : "Авторизация Telegram не завершилась вовремя."));
    }, 120_000);

    const settle = (callback: () => void) => {
      if (isSettled) return;
      isSettled = true;
      window.clearTimeout(timeoutId);
      callback();
    };

    window.open = ((...args: Parameters<typeof window.open>) => {
      const popup = originalOpen.apply(window, args);
      popupWasOpened = Boolean(popup);
      return popup;
    }) as typeof window.open;

    try {
      telegramLogin.auth(
        {
          bot_id: botId,
          lang: locale,
          request_access: config.requestAccess?.includes("write") ? "write" : undefined,
        },
        (authData) => {
          if (!authData) {
            settle(() => reject(new Error(locale === "en" ? "Telegram authorization was cancelled." : "Авторизация Telegram отменена.")));
            return;
          }

          settle(() => resolve({ authData }));
        },
      );
    } catch (error) {
      settle(() => reject(error instanceof Error ? error : new Error(String(error))));
    } finally {
      window.open = originalOpen;
    }

    if (!popupWasOpened) {
      settle(() => reject(new Error(locale === "en" ? "Telegram popup was blocked." : "Окно Telegram было заблокировано браузером.")));
    }
  });
};

const openTelegramLoginPopup = (config: TelegramAuthConfig, locale: Locale) =>
  new Promise<TelegramLoginResult>((resolve, reject) => {
    const authorizationUrl = config.authorizationUrl?.trim();
    if (!authorizationUrl) {
      reject(
        new Error(
          locale === "en"
            ? "Telegram sign-in is not configured correctly."
            : "Вход через Telegram настроен некорректно.",
        ),
      );
      return;
    }

    const width = 550;
    const height = 650;
    const screenOffset = window.screen as Screen & { availLeft?: number; availTop?: number };
    const left = Math.max(0, (window.screen.width - width) / 2) + (screenOffset.availLeft || 0);
    const top = Math.max(0, (window.screen.height - height) / 2) + (screenOffset.availTop || 0);
    const popup = window.open(
      authorizationUrl,
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

export function AuthModal({ isOpen, mode, onClose, onSignedIn }: Props) {
  const { locale } = useLocale();
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailCodeStep, setEmailCodeStep] = useState<EmailCodeStep>("email");
  const [status, setStatus] = useState<AuthStatus>(emptyStatus);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [devEmailPreview, setDevEmailPreview] = useState<DevEmailPreview | null>(null);
  const [authBackendIssue, setAuthBackendIssue] = useState<string | null>(null);
  const [telegramConfig, setTelegramConfig] = useState<TelegramAuthConfig | null>(null);
  const [isTelegramReady, setIsTelegramReady] = useState(false);

  const content = copy[locale];
  const closeLabel = locale === "en" ? "Close" : "Закрыть";
  const isBusy = busyAction !== null;
  const callbackURL = useMemo(() => {
    if (typeof window === "undefined") return "http://127.0.0.1:4174/";
    return `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
  }, []);

  const trackAuthEvent = (
    eventName: string,
    payload: Record<string, unknown> = {},
    level: Parameters<typeof logClientEvent>[2] = "info",
  ) => {
    void logClientEvent(
      eventName,
      {
        authMode: mode,
        emailCodeStep,
        lang: locale,
        path: getAuthAnalyticsPath(),
        ...payload,
      },
      level,
    );
  };

  const handleUserClose = (reason: "backdrop" | "button" | "escape") => {
    clearPendingAuthFlow();
    trackAuthEvent("auth_modal_close", {
      busyAction,
      reason,
    });
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleUserClose("escape");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busyAction, emailCodeStep, isOpen, locale, mode, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/auth/status");
        if (!response.ok) {
          const message = resolveAuthActionErrorMessage(new Error(String(response.status)), getAuthBackendUnavailableMessage());
          setAuthBackendIssue(message);
          setFeedback({ kind: "error", message });
          trackAuthEvent("auth_status_error", { statusCode: response.status }, "warn");
          return;
        }

        const data = (await response.json()) as AuthStatus;
        setStatus(data);
        setAuthBackendIssue(null);
      } catch (error) {
        const message = resolveAuthActionErrorMessage(error, getAuthBackendUnavailableMessage());
        setAuthBackendIssue(message);
        setFeedback({ kind: "error", message });
        trackAuthEvent("auth_status_error", { errorMessage: getAuthAnalyticsErrorMessage(error) }, "warn");
      }
    };

    void fetchStatus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setFeedback(null);
    setDevEmailPreview(null);
    setEmailCode("");
    setEmailCodeStep("email");
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
          setIsTelegramReady(isTelegramConfigReady(config));
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
      clearPendingAuthFlow();
      trackAuthEvent("auth_email_code_request_blocked", { reason: "backend_issue" }, "warn");
      setFeedback({ kind: "error", message: authBackendIssue });
      return;
    }

    if (emailCodeStep === "email") {
      clearPendingAuthFlow();
      trackAuthEvent("auth_email_code_request_start", {
        hasEmail: Boolean(email.trim()),
      });
      setBusyAction("email-code-request");
      try {
        const response = await fetch("/api/auth/email-code/request", {
          body: JSON.stringify({ email }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        if (!response.ok) {
          const message = await readResponseErrorMessage(
            response,
            locale === "en" ? "Could not send the sign-in code." : "Не удалось отправить код для входа.",
          );
          trackAuthEvent("auth_email_code_request_error", {
            errorMessage: message,
            statusCode: response.status,
          }, "warn");
          setFeedback({
            kind: "error",
            message,
          });
          setBusyAction(null);
          return;
        }

        trackAuthEvent("auth_email_code_request_success", {
          mailMode: status.mailMode,
        });
        setEmailCode("");
        setEmailCodeStep("code");
        setFeedback({
          kind: "success",
          message:
            status.mailMode === "smtp"
              ? locale === "en"
                ? "Code sent. Check Inbox and Spam."
                : "Код отправлен. Проверьте «Входящие» и папку «Спам»."
              : locale === "en"
                ? "Code sent. For local testing, open the email preview below."
                : "Код отправлен. Для локальной проверки откройте preview письма ниже.",
        });

        if (status.mailMode === "ethereal") {
          await loadDevEmailPreview();
        }
      } catch (error) {
        trackAuthEvent("auth_email_code_request_error", {
          errorMessage: getAuthAnalyticsErrorMessage(error),
        }, "warn");
        setFeedback({
          kind: "error",
          message: resolveAuthActionErrorMessage(error, locale === "en" ? "Could not send the sign-in code." : "Не удалось отправить код для входа."),
        });
        setBusyAction(null);
        return;
      }

      setBusyAction(null);
      return;
    }

    const normalizedEmailCode = normalizeEmailCode(emailCode);
    if (normalizedEmailCode !== emailCode) {
      setEmailCode(normalizedEmailCode);
    }

    if (normalizedEmailCode.length !== 6) {
      trackAuthEvent("auth_email_code_verify_invalid", {
        codeLength: normalizedEmailCode.length,
      }, "warn");
      setFeedback({
        kind: "error",
        message: locale === "en" ? "Enter the 6-digit code from the email." : "Введите 6-значный код из письма.",
      });
      return;
    }

    trackAuthEvent("auth_email_code_verify_start");
    setBusyAction("email-code-verify");
    try {
      const response = await fetch("/api/auth/email-code/verify", {
        body: JSON.stringify({ code: normalizedEmailCode, email }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const message = await readResponseErrorMessage(
          response,
          locale === "en" ? "Could not verify the sign-in code." : "Не удалось проверить код.",
        );
        trackAuthEvent("auth_email_code_verify_error", {
          errorMessage: message,
          statusCode: response.status,
        }, "warn");
        setFeedback({
          kind: "error",
          message,
        });
        setBusyAction(null);
        return;
      }

      const result = (await response.json()) as { redirectTo?: unknown };
      trackAuthEvent("auth_email_code_verify_success");
      void logClientEvent(mode === "signup" ? "signup_complete" : "signin_complete", {
        authProvider: "email-code",
        lang: locale,
        path: typeof window === "undefined" ? null : `${window.location.pathname}${window.location.search}`,
      });

      onClose();
      onSignedIn();
      const redirectTo = typeof result.redirectTo === "string" && result.redirectTo ? result.redirectTo : "/app/studio";
      window.location.assign(redirectTo);
    } catch (error) {
      trackAuthEvent("auth_email_code_verify_error", {
        errorMessage: getAuthAnalyticsErrorMessage(error),
      }, "warn");
      setFeedback({
        kind: "error",
        message: resolveAuthActionErrorMessage(error, locale === "en" ? "Could not verify the sign-in code." : "Не удалось проверить код."),
      });
    }

    setBusyAction(null);
  };

  const handleGoogleSignIn = async () => {
    trackAuthEvent("auth_provider_start", { authProvider: "google" });
    setBusyAction("google");
    setFeedback(null);
    if (authBackendIssue) {
      trackAuthEvent("auth_provider_blocked", {
        authProvider: "google",
        reason: "backend_issue",
      }, "warn");
      clearPendingAuthFlow();
      setFeedback({ kind: "error", message: authBackendIssue });
      setBusyAction(null);
      return;
    }

    try {
      writePendingAuthFlow({
        authMode: mode,
        authProvider: "google",
        lang: locale,
        path: getAuthAnalyticsPath(),
      });
      const { error } = await authClient.signIn.social({
        callbackURL,
        provider: "google",
      });

      if (error) {
        clearPendingAuthFlow();
        trackAuthEvent("auth_provider_error", {
          authProvider: "google",
          errorMessage: getAuthAnalyticsErrorMessage(error),
        }, "warn");
        setFeedback({
          kind: "error",
          message: resolveAuthActionErrorMessage(error, locale === "en" ? "Could not start Google sign-in." : "Не удалось запустить вход через Google."),
        });
        setBusyAction(null);
        return;
      }

      trackAuthEvent("auth_provider_redirect_started", { authProvider: "google" });
    } catch (error) {
      clearPendingAuthFlow();
      trackAuthEvent("auth_provider_error", {
        authProvider: "google",
        errorMessage: getAuthAnalyticsErrorMessage(error),
      }, "warn");
      setFeedback({
        kind: "error",
        message: resolveAuthActionErrorMessage(error, locale === "en" ? "Could not start Google sign-in." : "Не удалось запустить вход через Google."),
      });
      setBusyAction(null);
    }
  };

  const handleTelegramSignIn = async () => {
    trackAuthEvent("auth_provider_start", {
      authProvider: "telegram",
      flow: telegramConfig?.flow ?? null,
    });
    clearPendingAuthFlow();
    setBusyAction("telegram");
    setFeedback(null);

    if (authBackendIssue) {
      trackAuthEvent("auth_provider_blocked", {
        authProvider: "telegram",
        reason: "backend_issue",
      }, "warn");
      setFeedback({ kind: "error", message: authBackendIssue });
      setBusyAction(null);
      return;
    }

    if (!status.telegramEnabled) {
      trackAuthEvent("auth_provider_blocked", {
        authProvider: "telegram",
        reason: "not_configured",
      }, "warn");
      setFeedback({
        kind: "error",
        message: locale === "en" ? "Telegram sign-in is not configured." : "Вход через Telegram не настроен.",
      });
      setBusyAction(null);
      return;
    }

    let didTrackProviderError = false;
    try {
      if (!telegramConfig || !isTelegramReady) {
        trackAuthEvent("auth_provider_blocked", {
          authProvider: "telegram",
          reason: "not_ready",
        }, "warn");
        throw new Error(
          locale === "en"
            ? "Telegram sign-in is still loading. Try again in a second."
            : "Вход через Telegram ещё загружается. Попробуйте через секунду.",
        );
      }

      const loginPayload =
        telegramConfig.flow === "widget"
          ? await openTelegramWidgetAuth(telegramConfig, locale)
          : await openTelegramLoginPopup(telegramConfig, locale);
      if (loginPayload.error) {
        throw new Error(loginPayload.error);
      }

      if (loginPayload.signedIn) {
        trackAuthEvent("auth_provider_success", {
          authProvider: "telegram",
          flow: telegramConfig.flow ?? null,
        });
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

      const callbackBody = loginPayload.authData ?? (loginPayload.id_token ? { id_token: loginPayload.id_token } : null);
      if (!callbackBody) {
        throw new Error(locale === "en" ? "Telegram did not return an ID token." : "Telegram не вернул ID token.");
      }

      trackAuthEvent("auth_provider_callback_start", {
        authProvider: "telegram",
        flow: telegramConfig.flow ?? null,
      });
      const callbackResponse = await fetch("/api/auth/telegram/callback", {
        body: JSON.stringify(callbackBody),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!callbackResponse.ok) {
        const message = await readResponseErrorMessage(
          callbackResponse,
          locale === "en" ? "Could not sign in with Telegram." : "Не удалось войти через Telegram.",
        );
        didTrackProviderError = true;
        trackAuthEvent("auth_provider_error", {
          authProvider: "telegram",
          errorMessage: message,
          flow: telegramConfig.flow ?? null,
          statusCode: callbackResponse.status,
        }, "warn");
        throw new Error(
          message,
        );
      }

      const result = (await callbackResponse.json()) as { redirectTo?: unknown };
      trackAuthEvent("auth_provider_success", {
        authProvider: "telegram",
        flow: telegramConfig.flow ?? null,
      });
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
      if (!didTrackProviderError) {
        trackAuthEvent("auth_provider_error", {
          authProvider: "telegram",
          errorMessage: getAuthAnalyticsErrorMessage(error),
          flow: telegramConfig?.flow ?? null,
        }, "warn");
      }
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
        onClick={() => handleUserClose("backdrop")}
      />
      <div className="signup-modal__panel" role="document">
        <button className="signup-modal__close route-close" type="button" aria-label={closeLabel} onClick={() => handleUserClose("button")}>
          ×
        </button>
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
          <span>{locale === "en" ? "or by email" : "или по email"}</span>
        </div>

        <form className="signup-form" onSubmit={handleSubmit} noValidate>
          <label className="signup-field">
            <span>Email</span>
            <input
              id="signup-email"
              autoComplete="email"
              disabled={isBusy || emailCodeStep === "code"}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={locale === "en" ? "Enter email" : "Введите email"}
              required
            />
          </label>

          {emailCodeStep === "code" ? (
            <>
              <label className="signup-field">
                <span>{locale === "en" ? "Email code" : "Код из письма"}</span>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  type="text"
                  value={emailCode}
                  onChange={(event) => setEmailCode(normalizeEmailCode(event.target.value))}
                  placeholder={locale === "en" ? "Enter code" : "Введите код"}
                  required
                />
              </label>

              <button
                className="signup-email-code__change route-button"
                type="button"
                disabled={isBusy}
                onClick={() => {
                  trackAuthEvent("auth_email_code_change");
                  setEmailCode("");
                  setEmailCodeStep("email");
                  setFeedback(null);
                  setDevEmailPreview(null);
                }}
              >
                {locale === "en" ? "Change email" : "Изменить email"}
              </button>
            </>
          ) : null}

          <button
            className="btn btn--primary signup-form__submit route-button"
            type="submit"
            disabled={isBusy || Boolean(authBackendIssue)}
          >
            {busyAction === "email-code-request"
              ? locale === "en"
                ? "Sending..."
                : "Отправляем..."
              : busyAction === "email-code-verify"
                ? locale === "en"
                  ? "Checking..."
                  : "Проверяем..."
                : emailCodeStep === "email"
                  ? locale === "en"
                    ? "Get code"
                    : "Получить код"
                  : content.submit}
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
      </div>
    </div>
  );
}
