// @vitest-environment jsdom

import { act } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../lib/i18n";
import { WorkspaceModalVideoPlayer, WorkspaceSegmentPreviewCardMedia } from "./workspace-preview-components";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("WorkspaceSegmentPreviewCardMedia", () => {
  it("retries image previews after a transient load failure", () => {
    vi.useFakeTimers();

    const { container } = render(
      <WorkspaceSegmentPreviewCardMedia
        imageLoading="lazy"
        mediaKey="timeline-scene-backdrop:segment:4"
        previewKind="image"
        previewUrl="/api/workspace/media-assets/7396"
      />,
    );

    const initialImage = container.querySelector("img");
    expect(initialImage?.getAttribute("src")).toBe("/api/workspace/media-assets/7396");

    fireEvent.error(initialImage as HTMLImageElement);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".studio-segment-preview-card-media__idle-placeholder")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const retryImage = container.querySelector("img");
    expect(retryImage?.getAttribute("src")).toBe("/api/workspace/media-assets/7396");
  });
});

describe("WorkspaceModalVideoPlayer", () => {
  it("opens the complete player shell in fullscreen from the right-side control", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });

    try {
      const { container, getByRole } = render(
        <LocaleProvider locale="ru">
          <WorkspaceModalVideoPlayer src="/preview.mp4" videoKey="preview-1" />
        </LocaleProvider>,
      );

      const player = container.querySelector(".studio-video-modal__player");
      const fullscreenButton = await waitFor(() =>
        getByRole("button", { name: /во весь экран|fullscreen/i }),
      );
      expect(fullscreenButton.classList.contains("studio-video-modal__control-btn--fullscreen")).toBe(true);

      fireEvent.click(fullscreenButton);

      await waitFor(() => expect(requestFullscreen).toHaveBeenCalledOnce());
      expect(requestFullscreen.mock.instances[0]).toBe(player);
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).requestFullscreen;
    }
  });

  it("uses a viewport fullscreen fallback when the browser API is unavailable", async () => {
    const { container, getByRole } = render(
      <LocaleProvider locale="ru">
        <WorkspaceModalVideoPlayer src="/preview.mp4" videoKey="preview-fallback" />
      </LocaleProvider>,
    );

    const player = container.querySelector(".studio-video-modal__player");
    const openButton = getByRole("button", { name: "Открыть видео во весь экран" });

    fireEvent.click(openButton);

    await waitFor(() => expect(player?.classList.contains("is-fullscreen")).toBe(true));
    expect(getByRole("button", { name: "Выйти из полноэкранного режима" })).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.classList.contains("studio-video-fullscreen-open")).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(player?.classList.contains("is-fullscreen")).toBe(false));
    expect(document.body.style.overflow).toBe("");
    expect(document.body.classList.contains("studio-video-fullscreen-open")).toBe(false);
  });
});
