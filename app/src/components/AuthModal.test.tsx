// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../lib/i18n";
import { AuthModal } from "./AuthModal";

const renderAuthModal = (
  mode: "signup" | "signin",
  handlers: Partial<Pick<Parameters<typeof AuthModal>[0], "onClose" | "onSignedIn">> = {},
) =>
  render(
    <MemoryRouter>
      <LocaleProvider locale="ru">
        <AuthModal
          isOpen
          mode={mode}
          onClose={handlers.onClose ?? (() => undefined)}
          onSignedIn={handlers.onSignedIn ?? (() => undefined)}
        />
      </LocaleProvider>
    </MemoryRouter>,
  );

const readClientEventBodies = () =>
  vi.mocked(fetch).mock.calls
    .filter(([input]) => String(input) === "/api/client-events")
    .map(([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")) as { event?: string; payload?: Record<string, unknown> });

describe("AuthModal", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          googleEnabled: true,
          mailMode: "smtp",
          smtpConfigured: true,
          telegramEnabled: false,
        }),
        ok: true,
      })),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not show Telegram placeholder in signup", async () => {
    renderAuthModal("signup");

    await waitFor(() => expect(screen.getByText("Google")).toBeTruthy());
    expect(screen.queryByText("Telegram")).toBeNull();
    expect(screen.queryByText("Скоро")).toBeNull();
  });

  it("does not show Telegram placeholder in signin", async () => {
    renderAuthModal("signin");

    expect(screen.getByRole("heading", { name: "Войдите в AdShorts AI" })).toBeTruthy();
    expect(screen.getByText("Если аккаунта ещё нет, мы создадим его автоматически.")).toBeTruthy();
    expect(screen.queryByText("Войдите в личный кабинет AdShorts AI")).toBeNull();
    expect(screen.queryByText("Новый пользователь?")).toBeNull();
    expect(screen.queryByText("Создать аккаунт")).toBeNull();
    await waitFor(() => expect(screen.getByText("Google")).toBeTruthy());
    expect(screen.queryByText("Telegram")).toBeNull();
    expect(screen.queryByText("Скоро")).toBeNull();
  });

  it("shows Telegram sign-in when the provider is configured", async () => {
    vi.mocked(fetch).mockImplementationOnce(async () => ({
      json: async () => ({
        googleEnabled: true,
        mailMode: "smtp",
        smtpConfigured: true,
        telegramEnabled: true,
      }),
      ok: true,
    }) as Response);

    renderAuthModal("signup");

    await waitFor(() => expect(screen.getByText("Telegram")).toBeTruthy());
  });

  it("opens the current Telegram OIDC flow instead of the deprecated widget", async () => {
    const popup = {
      closed: false,
      focus: vi.fn(),
    } as unknown as Window;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(popup);
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/auth/status") {
        return {
          json: async () => ({
            googleEnabled: true,
            mailMode: "smtp",
            smtpConfigured: true,
            telegramEnabled: true,
          }),
          ok: true,
        } as Response;
      }

      if (url.startsWith("/api/auth/telegram/config")) {
        return {
          json: async () => ({
            authorizationUrl: "https://oauth.telegram.org/auth?client_id=123",
            botId: "123",
            botUsername: "AuthBot",
            clientId: "123",
            flow: "code",
            nonce: "nonce",
            requestAccess: ["write"],
          }),
          ok: true,
        } as Response;
      }

      return {
        json: async () => ({}),
        ok: true,
      } as Response;
    });

    renderAuthModal("signin");

    const telegramButton = await screen.findByRole<HTMLButtonElement>("button", { name: /Telegram/ });
    await waitFor(() => expect(telegramButton.disabled).toBe(false));

    fireEvent.click(telegramButton);
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        "https://oauth.telegram.org/auth?client_id=123",
        "telegram_oidc_login",
        expect.any(String),
      ),
    );
  });

  it("uses an email code instead of a password", async () => {
    renderAuthModal("signin");

    await waitFor(() => expect(screen.getByText("Google")).toBeTruthy());
    expect(screen.queryByLabelText("Пароль")).toBeNull();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Получить код" }));

    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/auth/email-code/request",
        expect.objectContaining({
          method: "POST",
        }),
      ),
    );
    expect((await screen.findByLabelText("Код из письма")).getAttribute("placeholder")).toBe("Введите код");
    expect(screen.getByRole("button", { name: "Войти" })).toBeTruthy();
  });

  it("logs email-code funnel events without sending the email address", async () => {
    renderAuthModal("signup");

    await waitFor(() => expect(screen.getByText("Google")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Получить код" }));

    await waitFor(() => {
      const events = readClientEventBodies().map((body) => body.event);
      expect(events).toContain("auth_email_code_request_start");
      expect(events).toContain("auth_email_code_request_success");
    });

    expect(JSON.stringify(readClientEventBodies())).not.toContain("user@example.com");
  });

  it("does not rely on native pattern validation for the email code", async () => {
    renderAuthModal("signin");

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Получить код" }));

    const codeInput = await screen.findByLabelText<HTMLInputElement>("Код из письма");
    fireEvent.change(codeInput, {
      target: { value: "973829" },
    });

    expect(codeInput.getAttribute("pattern")).toBeNull();
    expect(codeInput.closest("form")?.noValidate).toBe(true);
    expect(codeInput.checkValidity()).toBe(true);
  });

  it("shows an app error for an incomplete email code", async () => {
    renderAuthModal("signin");

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Получить код" }));

    const codeInput = await screen.findByLabelText<HTMLInputElement>("Код из письма");
    vi.mocked(fetch).mockClear();

    fireEvent.change(codeInput, {
      target: { value: "23485" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByText("Введите 6-значный код из письма.")).toBeTruthy();
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
      "/api/auth/email-code/verify",
      expect.anything(),
    );
  });
});
