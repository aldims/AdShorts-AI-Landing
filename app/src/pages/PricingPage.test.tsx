// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider, type Locale } from "../lib/i18n";
import { PricingPage } from "./PricingPage";

const renderPricingPage = (locale: Locale = "en") => {
  const onOpenSignup = vi.fn();
  const onOpenSignin = vi.fn();
  const onLogout = vi.fn();
  const onOpenWorkspace = vi.fn();

  const result = render(
    <MemoryRouter initialEntries={[locale === "en" ? "/en/pricing" : "/pricing"]}>
      <LocaleProvider locale={locale}>
        <PricingPage
          session={null}
          onOpenSignup={onOpenSignup}
          onOpenSignin={onOpenSignin}
          onLogout={onLogout}
          onOpenWorkspace={onOpenWorkspace}
        />
      </LocaleProvider>
    </MemoryRouter>,
  );

  return {
    ...result,
    onOpenSignin,
    onOpenSignup,
    onOpenWorkspace,
  };
};

describe("PricingPage international pricing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replaces ruble checkout pricing with an email waitlist in English", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ data: { ok: true } }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderPricingPage("en");

    expect(screen.getByRole("heading", { name: "Pricing" })).toBeTruthy();
    expect(screen.getByText("International payments are coming soon.")).toBeTruthy();
    expect(screen.getByText(/You can try AdShorts AI for free now/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Join waitlist" })).toBeTruthy();
    expect(container.textContent).not.toContain("₽");
    expect(screen.queryByText("START")).toBeNull();
    expect(screen.queryByText("Coming soon")).toBeNull();
    expect(screen.queryByText("How plans work")).toBeNull();
    expect(screen.queryByText("Buy pack")).toBeNull();
    expect(screen.queryByText("Opening checkout...")).toBeNull();

    fireEvent.change(screen.getByLabelText("Email for international payments waitlist"), {
      target: { value: "buyer@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join waitlist" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/contact/international-payments-waitlist",
        expect.objectContaining({
          body: JSON.stringify({
            email: "buyer@example.com",
            source: "/en/pricing",
          }),
          method: "POST",
        }),
      );
    });
    expect(screen.getByText("You're on the list. We'll email you when international payments open.")).toBeTruthy();
  });

  it("keeps ruble prices on the Russian pricing page", () => {
    const { container } = renderPricingPage("ru");

    expect(container.textContent).toContain("390 ₽");
    expect(container.textContent).toContain("1 490 ₽");
    expect(container.textContent).toContain("4 990 ₽");
    expect(screen.queryByText("International payments are coming soon.")).toBeNull();
    expect(screen.getAllByText("Разовая оплата · Без подписки и автосписаний")).toHaveLength(3);
  });
});
