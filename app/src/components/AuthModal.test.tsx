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

  it("uses the Telegram widget signed payload without the server OIDC exchange", async () => {
    const telegramAuth = vi.fn((_options, callback) => {
      callback({
        auth_date: 1_700_000_000,
        first_name: "Telegram",
        hash: "signed-hash",
        id: 12345,
        username: "telegram_user",
      });
    });
    vi.stubGlobal("Telegram", {
      Login: {
        auth: telegramAuth,
      },
    });
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
            botId: "123",
            botUsername: "AuthBot",
            clientId: "123",
            flow: "widget",
            requestAccess: ["write"],
          }),
          ok: true,
        } as Response;
      }

      if (url === "/api/auth/telegram/callback") {
        return {
          json: async () => ({ error: "test-stop" }),
          ok: false,
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
    await waitFor(() => expect(telegramAuth).toHaveBeenCalledWith(expect.objectContaining({ bot_id: "123" }), expect.any(Function)));
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/auth/telegram/callback",
        expect.objectContaining({
          body: expect.stringContaining("signed-hash"),
          method: "POST",
        }),
      ),
    );
    expect(await screen.findByText("test-stop")).toBeTruthy();
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
