// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingStudioPrompt,
  readPendingStudioPrompt,
  writePendingStudioPrompt,
} from "./pending-studio-prompt";

describe("pending studio prompt", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it("keeps the guest prompt across the authentication remount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T10:00:00.000Z"));

    writePendingStudioPrompt("Как выбрать квартиру в новостройке");

    expect(readPendingStudioPrompt()).toEqual({
      prompt: "Как выбрать квартиру в новостройке",
      updatedAt: "2026-07-16T10:00:00.000Z",
    });
  });

  it("removes the draft after it is cleared", () => {
    writePendingStudioPrompt("Черновик запроса");
    clearPendingStudioPrompt();

    expect(readPendingStudioPrompt()).toBeNull();
  });

  it("discards stale prompt drafts", () => {
    window.sessionStorage.setItem(
      "adshorts.pending-studio-prompt",
      JSON.stringify({
        prompt: "Устаревший запрос",
        updatedAt: "2026-07-16T09:00:00.000Z",
      }),
    );

    expect(readPendingStudioPrompt(Date.parse("2026-07-16T10:00:00.000Z"))).toBeNull();
    expect(window.sessionStorage.getItem("adshorts.pending-studio-prompt")).toBeNull();
  });
});
