// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../lib/i18n";
import { AuthModal } from "./AuthModal";

const renderAuthModal = (mode: "signup" | "signin") =>
  render(
    <MemoryRouter>
      <LocaleProvider locale="ru">
        <AuthModal
          isOpen
          mode={mode}
          onClose={() => undefined}
          onModeChange={() => undefined}
          onSignedIn={() => undefined}
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
    expect(screen.queryByText("Войдите в личный кабинет AdShorts AI")).toBeNull();
    await waitFor(() => expect(screen.getByText("Google")).toBeTruthy());
    expect(screen.queryByText("Telegram")).toBeNull();
    expect(screen.queryByText("Скоро")).toBeNull();
  });
});
