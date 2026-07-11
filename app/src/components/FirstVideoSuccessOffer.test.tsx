// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FirstVideoSuccessOffer } from "./FirstVideoSuccessOffer";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FirstVideoSuccessOffer", () => {
  it("keeps feedback secondary until the user opens it", () => {
    render(
      <FirstVideoSuccessOffer locale="ru" onDismiss={vi.fn()} onUpgrade={vi.fn()} plan="FREE" projectId={4171} />,
    );

    expect(screen.getByRole("button", { name: /Продолжить со START/i })).toBeTruthy();
    expect(screen.queryByLabelText("Что понравилось? Что можно улучшить?")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Помогите нам стать лучше/i }));
    expect(screen.getByLabelText("Что понравилось? Что можно улучшить?")).toBeTruthy();
  });

  it("submits feedback without trusting client identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ data: { ok: true } }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <FirstVideoSuccessOffer locale="ru" onDismiss={vi.fn()} onUpgrade={vi.fn()} plan="FREE" projectId={4171} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Помогите нам стать лучше/i }));
    fireEvent.change(screen.getByLabelText("Что понравилось? Что можно улучшить?"), {
      target: { value: "Очень понравился результат" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => expect(screen.getByText("Спасибо за отзыв!")).toBeTruthy());
    const request = JSON.parse(fetchMock.mock.calls.find(([url]) => url === "/api/contact/product-feedback")?.[1]?.body as string);
    expect(request).toMatchObject({ message: "Очень понравился результат", plan: "FREE", projectId: 4171 });
    expect(request).not.toHaveProperty("userEmail");
    expect(request).not.toHaveProperty("userId");
  });
});
