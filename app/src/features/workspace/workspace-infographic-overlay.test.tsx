/* @vitest-environment jsdom */

import { fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { createWorkspaceSegmentInfographic } from "./workspace-infographic-helpers";
import { WorkspaceSegmentInfographicOverlay } from "./workspace-infographic-overlay";

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => true,
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    bottom: 640,
    height: 640,
    left: 0,
    right: 360,
    toJSON: () => ({}),
    top: 0,
    width: 360,
    x: 0,
    y: 0,
  });
});

describe("WorkspaceSegmentInfographicOverlay", () => {
  it("renders three staggered visual parts while playback is active", () => {
    const infographic = createWorkspaceSegmentInfographic({
      inputHash: "c".repeat(64),
      intrinsicHeight: 512,
      intrinsicWidth: 1024,
      mediaAssetId: 57,
      sourceVisualIdentity: "asset:12",
      text: "Part reveal",
    });
    const view = render(
      <WorkspaceSegmentInfographicOverlay
        editable={false}
        infographic={infographic}
        isPlaying
        localTimeSeconds={0.275}
        segmentDurationSeconds={5}
      />,
    );
    const overlay = view.getByTestId("segment-infographic-overlay");
    const parts = overlay.querySelectorAll(".studio-segment-infographic__image");

    expect(parts).toHaveLength(3);
    expect(Number(overlay.style.getPropertyValue("--workspace-infographic-part-0-opacity"))).toBeGreaterThan(
      Number(overlay.style.getPropertyValue("--workspace-infographic-part-1-opacity")),
    );
    expect(Number(overlay.style.getPropertyValue("--workspace-infographic-part-1-opacity"))).toBeGreaterThan(
      Number(overlay.style.getPropertyValue("--workspace-infographic-part-2-opacity")),
    );
  });

  it("commits one transform after any number of pointer moves", () => {
    const onTransformCommit = vi.fn();
    const infographic = createWorkspaceSegmentInfographic({
      inputHash: "a".repeat(64),
      intrinsicHeight: 1024,
      intrinsicWidth: 1024,
      mediaAssetId: 55,
      sourceVisualIdentity: "asset:10",
      text: "Metric",
    });
    const view = render(
      <WorkspaceSegmentInfographicOverlay
        editable
        infographic={infographic}
        isPlaying={false}
        localTimeSeconds={0}
        onTransformCommit={onTransformCommit}
        segmentDurationSeconds={5}
      />,
    );
    const overlay = view.getByTestId("segment-infographic-overlay");
    const image = view.getByAltText("Metric");

    fireEvent.pointerDown(image, { button: 0, clientX: 100, clientY: 100, pointerId: 7 });
    fireEvent.pointerMove(overlay, { clientX: 120, clientY: 120, pointerId: 7 });
    fireEvent.pointerMove(overlay, { clientX: 145, clientY: 135, pointerId: 7 });
    fireEvent.pointerMove(overlay, { clientX: 160, clientY: 150, pointerId: 7 });
    fireEvent.pointerUp(overlay, { clientX: 160, clientY: 150, pointerId: 7 });

    expect(onTransformCommit).toHaveBeenCalledTimes(1);
  });

  it("stops playback through the interaction callback and keeps the drag active", () => {
    const onInteractionStart = vi.fn();
    const onTransformCommit = vi.fn();
    const infographic = createWorkspaceSegmentInfographic({
      inputHash: "b".repeat(64),
      intrinsicHeight: 1024,
      intrinsicWidth: 1024,
      mediaAssetId: 56,
      sourceVisualIdentity: "asset:11",
      text: "Growth",
    });
    const view = render(
      <WorkspaceSegmentInfographicOverlay
        editable
        infographic={infographic}
        isPlaying
        localTimeSeconds={0}
        onInteractionStart={onInteractionStart}
        onTransformCommit={onTransformCommit}
        segmentDurationSeconds={5}
      />,
    );
    const overlay = view.getByTestId("segment-infographic-overlay");
    const image = view.getByAltText("Growth");

    fireEvent.pointerDown(image, { button: 0, clientX: 100, clientY: 100, pointerId: 8 });
    fireEvent.pointerMove(overlay, { clientX: 140, clientY: 130, pointerId: 8 });
    fireEvent.pointerUp(overlay, { clientX: 140, clientY: 130, pointerId: 8 });

    expect(onInteractionStart).toHaveBeenCalledTimes(1);
    expect(onTransformCommit).toHaveBeenCalledTimes(1);
  });
});
