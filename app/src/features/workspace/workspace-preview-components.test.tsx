// @vitest-environment jsdom

import { act } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceSegmentPreviewCardMedia } from "./workspace-preview-components";

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
