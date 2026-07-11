// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FirstVideoSuccessOffer } from "./FirstVideoSuccessOffer";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FirstVideoSuccessOffer", () => {
  const renderOffer = (overrides: Partial<ComponentProps<typeof FirstVideoSuccessOffer>> = {}) =>
    render(
      <FirstVideoSuccessOffer
        checkoutError={null}
        isCheckoutPending={false}
        locale="ru"
        onCheckoutStart={vi.fn()}
        onComparePlans={vi.fn()}
        onDismiss={vi.fn()}
        plan="FREE"
        projectId={4171}
        variant="start_direct_v1"
        {...overrides}
      />,
    );

  it("keeps feedback secondary until the user opens it", () => {
    renderOffer();

    expect(screen.getByRole("button", { name: /Получить 50 кредитов/i })).toBeTruthy();
    expect(screen.queryByLabelText("Что понравилось? Что можно улучшить?")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Что можно улучшить/i }));
    expect(screen.getByLabelText("Что понравилось? Что можно улучшить?")).toBeTruthy();
  });

  it("exposes one primary checkout action and a secondary plan comparison", () => {
    const onCheckoutStart = vi.fn();
    const onComparePlans = vi.fn();
    renderOffer({ onCheckoutStart, onComparePlans });

    fireEvent.click(screen.getByRole("button", { name: /Получить 50 кредитов/i }));
    fireEvent.click(screen.getByRole("button", { name: "Сравнить тарифы" }));

    expect(onCheckoutStart).toHaveBeenCalledTimes(1);
    expect(onComparePlans).toHaveBeenCalledTimes(1);
  });

  it("submits feedback without trusting client identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ data: { ok: true } }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    renderOffer();
    fireEvent.click(screen.getByRole("button", { name: /Что можно улучшить/i }));
    fireEvent.change(screen.getByLabelText("Что понравилось? Что можно улучшить?"), {
      target: { value: "Очень понравился результат" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => expect(screen.getByText(/Спасибо — отзыв поможет/i)).toBeTruthy());
    const request = JSON.parse(fetchMock.mock.calls.find(([url]) => url === "/api/contact/product-feedback")?.[1]?.body as string);
    expect(request).toMatchObject({ message: "Очень понравился результат", plan: "FREE", projectId: 4171 });
    expect(request).not.toHaveProperty("userEmail");
    expect(request).not.toHaveProperty("userId");
  });
});
