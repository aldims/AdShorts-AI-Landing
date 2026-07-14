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
  it("fades the complete infographic as one visual while playback is active", () => {
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
        localTimeSeconds={1}
        segmentDurationSeconds={5}
      />,
    );
    const overlay = view.getByTestId("segment-infographic-overlay");
    const parts = overlay.querySelectorAll(".studio-segment-infographic__image");

    expect(parts).toHaveLength(1);
    expect(Number(overlay.style.getPropertyValue("--workspace-infographic-opacity"))).toBeCloseTo(0.5);
  });

  it("reveals semantic parts independently and shows all parts while paused", () => {
    const infographic = createWorkspaceSegmentInfographic({
      inputHash: "e".repeat(64),
      intrinsicHeight: 800,
      intrinsicWidth: 1000,
      mediaAssetId: 70,
      parts: [
        {
          frame: { height: 0.4, width: 0.9, x: 0.05, y: 0.05 },
          intrinsicHeight: 320,
          intrinsicWidth: 900,
          mediaAssetId: 71,
          reveal: { delaySeconds: 0, durationSeconds: 0.65 },
          text: "Не пьёт таблетки?",
        },
        {
          frame: { height: 0.35, width: 0.75, x: 0.125, y: 0.6 },
          intrinsicHeight: 280,
          intrinsicWidth: 750,
          mediaAssetId: 72,
          reveal: { delaySeconds: 0.85, durationSeconds: 0.65 },
          text: "Есть решение",
        },
      ],
      sourceVisualIdentity: "asset:14",
      text: "Не пьёт таблетки? Есть решение",
    });
    const view = render(
      <WorkspaceSegmentInfographicOverlay
        editable={false}
        infographic={infographic}
        isPlaying
        localTimeSeconds={0.8}
        segmentDurationSeconds={5}
      />,
    );
    const images = view.container.querySelectorAll<HTMLElement>(".studio-segment-infographic__image.is-part");

    expect(images).toHaveLength(2);
    expect(Number(images[0]?.style.getPropertyValue("--workspace-infographic-part-opacity"))).toBeGreaterThan(0.5);
    expect(Number(images[1]?.style.getPropertyValue("--workspace-infographic-part-opacity"))).toBe(0);

    view.rerender(
      <WorkspaceSegmentInfographicOverlay
        editable={false}
        infographic={infographic}
        isPlaying={false}
        localTimeSeconds={0}
        segmentDurationSeconds={5}
      />,
    );
    const pausedImages = view.container.querySelectorAll<HTMLElement>(".studio-segment-infographic__image.is-part");
    expect(Array.from(pausedImages).map((image) => Number(
      image.style.getPropertyValue("--workspace-infographic-part-opacity"),
    ))).toEqual([1, 1]);
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
    fireEvent.lostPointerCapture(overlay, { pointerId: 7 });

    expect(onTransformCommit).toHaveBeenCalledTimes(1);
  });

  it("commits the latest transform when pointer capture is lost", () => {
    const onTransformCommit = vi.fn();
    const infographic = createWorkspaceSegmentInfographic({
      inputHash: "d".repeat(64),
      intrinsicHeight: 1024,
      intrinsicWidth: 1024,
      mediaAssetId: 58,
      sourceVisualIdentity: "asset:13",
      text: "Position",
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
    const image = view.getByAltText("Position");

    fireEvent.pointerDown(image, { button: 0, clientX: 100, clientY: 100, pointerId: 9 });
    fireEvent.pointerMove(overlay, { clientX: 136, clientY: 164, pointerId: 9 });
    fireEvent.lostPointerCapture(overlay, { pointerId: 9 });

    expect(onTransformCommit).toHaveBeenCalledTimes(1);
    expect(onTransformCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        centerX: expect.closeTo(infographic.transform.centerX + 0.1, 5),
        centerY: expect.closeTo(infographic.transform.centerY + 0.1, 5),
      }),
    );
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

  it("stages the last visible transform before pointerup", () => {
    const onTransformCommit = vi.fn();
    const onTransformPreview = vi.fn();
    const infographic = createWorkspaceSegmentInfographic({
      inputHash: "f".repeat(64),
      intrinsicHeight: 1024,
      intrinsicWidth: 1024,
      mediaAssetId: 59,
      sourceVisualIdentity: "asset:15",
      text: "Position",
    });
    const view = render(
      <WorkspaceSegmentInfographicOverlay
        editable
        infographic={infographic}
        isPlaying={false}
        localTimeSeconds={0}
        onTransformCommit={onTransformCommit}
        onTransformPreview={onTransformPreview}
        segmentDurationSeconds={5}
      />,
    );
    const overlay = view.getByTestId("segment-infographic-overlay");
    const image = view.getByAltText("Position");

    fireEvent.pointerDown(image, { button: 0, clientX: 100, clientY: 100, pointerId: 11 });
    fireEvent.pointerMove(overlay, { clientX: 154, clientY: 164, pointerId: 11 });

    expect(onTransformPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        centerX: expect.closeTo(infographic.transform.centerX + 0.15, 5),
        centerY: expect.closeTo(infographic.transform.centerY + 0.1, 5),
      }),
    );
    expect(onTransformCommit).not.toHaveBeenCalled();
  });

  it("keeps history and deletion available from the keyboard without rendering action buttons", () => {
    const onDelete = vi.fn();
    const onRedo = vi.fn();
    const onUndo = vi.fn();
    const infographic = createWorkspaceSegmentInfographic({
      inputHash: "1".repeat(64),
      intrinsicHeight: 1024,
      intrinsicWidth: 1024,
      mediaAssetId: 60,
      sourceVisualIdentity: "asset:16",
      text: "Keyboard controls",
    });
    const view = render(
      <WorkspaceSegmentInfographicOverlay
        editable
        infographic={infographic}
        isPlaying={false}
        localTimeSeconds={0}
        onDelete={onDelete}
        onRedo={onRedo}
        onUndo={onUndo}
        segmentDurationSeconds={5}
      />,
    );
    const object = view.getByRole("group");

    expect(view.queryByRole("button")).toBeNull();
    fireEvent.keyDown(object, { ctrlKey: true, key: "z" });
    fireEvent.keyDown(object, { ctrlKey: true, key: "z", shiftKey: true });
    fireEvent.keyDown(object, { key: "Delete" });

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
