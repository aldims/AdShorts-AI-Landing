import { describe, expect, it } from "vitest";
import { STUDIO_SEGMENT_INFOGRAPHIC_CREDIT_COST } from "../../../shared/studio-credit-costs";

import {
  clampWorkspaceSegmentInfographicTransform,
  createWorkspaceSegmentInfographicIdempotencyKey,
  createWorkspaceSegmentInfographic,
  createWorkspaceSegmentInfographicStateSnapshot,
  getWorkspaceSegmentInfographicCharacterCount,
  getWorkspaceInfographicNormalizedHeight,
  getWorkspaceSegmentInfographicFadeDuration,
  getWorkspaceSegmentInfographicOpacity,
  getWorkspaceSegmentInfographicSourceVisualIdentity,
  getWorkspaceSegmentInfographicStatusFailureAction,
  isWorkspaceSegmentInfographicJobResultContextValid,
  isWorkspaceSegmentInfographicStale,
  normalizeWorkspaceSegmentInfographic,
  pushWorkspaceSegmentInfographicHistory,
  redoWorkspaceSegmentInfographicHistory,
  resizeWorkspaceSegmentInfographicFromCorner,
  truncateWorkspaceSegmentInfographicText,
  undoWorkspaceSegmentInfographicHistory,
} from "./workspace-infographic-helpers";
import { buildWorkspaceSegmentEditorPayload } from "./workspace-segment-payload-helpers";
import { createWorkspaceSegmentEditorScratchDraftSession } from "./workspace-segment-editor";

const TEST_INPUT_HASH = "a".repeat(64);

describe("workspace infographic helpers", () => {
  it("uses the fixed two-credit product price", () => {
    expect(STUDIO_SEGMENT_INFOGRAPHIC_CREDIT_COST).toBe(2);
  });

  it("accepts a job result only for the expected project, segment and request", () => {
    const expected = {
      expectedProjectId: 42,
      expectedRequestFingerprint: "request-42-3",
      expectedSegmentIndex: 3,
    };
    expect(isWorkspaceSegmentInfographicJobResultContextValid({
      ...expected,
      projectId: 42,
      requestFingerprint: "request-42-3",
      segmentIndex: 3,
    })).toBe(true);
    expect(isWorkspaceSegmentInfographicJobResultContextValid({
      ...expected,
      projectId: 42,
      segmentIndex: 3,
    })).toBe(false);
    expect(isWorkspaceSegmentInfographicJobResultContextValid({
      ...expected,
      projectId: 42,
      requestFingerprint: "request-42-4",
      segmentIndex: 4,
    })).toBe(false);
  });

  it("accepts a scratch job only for the originating draft", () => {
    const expected = {
      expectedDraftId: "scratch:current",
      expectedProjectId: 0,
      expectedRequestFingerprint: "scratch-request",
      expectedSegmentIndex: 0,
      projectId: 0,
      requestFingerprint: "scratch-request",
      segmentIndex: 0,
    };

    expect(isWorkspaceSegmentInfographicJobResultContextValid({
      ...expected,
      draftId: "scratch:current",
    })).toBe(true);
    expect(isWorkspaceSegmentInfographicJobResultContextValid({
      ...expected,
      draftId: "scratch:other",
    })).toBe(false);
    expect(isWorkspaceSegmentInfographicJobResultContextValid(expected)).toBe(false);
  });

  it("keeps persisted-project status compatible without a scratch draft id", () => {
    expect(isWorkspaceSegmentInfographicJobResultContextValid({
      expectedDraftId: "project:42",
      expectedProjectId: 42,
      expectedRequestFingerprint: "persisted-request",
      expectedSegmentIndex: 1,
      projectId: 42,
      requestFingerprint: "persisted-request",
      segmentIndex: 1,
    })).toBe(true);
  });

  it("preserves paid pending jobs when network or 5xx status polling is exhausted", () => {
    expect(getWorkspaceSegmentInfographicStatusFailureAction({
      failureCount: 5,
      maxTransientFailures: 5,
      statusCode: 503,
    })).toBe("retry");
    expect(getWorkspaceSegmentInfographicStatusFailureAction({
      failureCount: 6,
      maxTransientFailures: 5,
      statusCode: 503,
    })).toBe("preserve");
    expect(getWorkspaceSegmentInfographicStatusFailureAction({
      failureCount: 6,
      maxTransientFailures: 5,
      statusCode: null,
    })).toBe("preserve");
    expect(getWorkspaceSegmentInfographicStatusFailureAction({
      failureCount: 1,
      maxTransientFailures: 5,
      statusCode: 404,
    })).toBe("remove");
  });

  it("normalizes snake-case persisted data and clamps the transform inside a 9:16 frame", () => {
    const infographic = normalizeWorkspaceSegmentInfographic({
      animation: { duration_seconds: 0.55, type: "fade" },
      input_hash: TEST_INPUT_HASH,
      intrinsic_height: 600,
      intrinsic_width: 1200,
      media_asset_id: 42,
      source_visual_identity: "asset:7",
      style_prompt: "Clean",
      text: "Рост 47%",
      transform: { centerX: -2, centerY: 8, width: 4 },
      version: 1,
    });

    expect(infographic).not.toBeNull();
    expect(infographic?.animation.durationSeconds).toBe(1.1);
    expect(infographic?.mediaAssetId).toBe(42);
    expect(infographic?.transform.width).toBe(0.96);
    expect(infographic?.transform.centerX).toBe(0.48);
    expect(infographic?.transform.centerY).toBeLessThan(1);
  });

  it("keeps proportional resize geometry and never lets the layer leave the frame", () => {
    const transform = clampWorkspaceSegmentInfographicTransform(
      { centerX: 0.99, centerY: 0.01, width: 0.05 },
      1000,
      500,
    );
    const infographic = createWorkspaceSegmentInfographic({
      inputHash: TEST_INPUT_HASH,
      intrinsicHeight: 500,
      intrinsicWidth: 1000,
      mediaAssetId: 9,
      previousTransform: transform,
      sourceVisualIdentity: "asset:8",
      text: "Точный текст",
    });

    expect(transform.width).toBe(0.12);
    expect(transform.centerX).toBeLessThanOrEqual(0.94);
    expect(transform.centerY).toBeGreaterThanOrEqual(getWorkspaceInfographicNormalizedHeight(infographic) / 2);
  });

  it("uses the server-selected free zone for a new layer but preserves a prior user transform", () => {
    const generated = createWorkspaceSegmentInfographic({
      inputHash: TEST_INPUT_HASH,
      initialTransform: { centerX: 0.5, centerY: 0.78, width: 0.7 },
      intrinsicHeight: 400,
      intrinsicWidth: 800,
      mediaAssetId: 10,
      sourceVisualIdentity: "asset:8",
      text: "Точный текст",
    });
    const regenerated = createWorkspaceSegmentInfographic({
      inputHash: TEST_INPUT_HASH,
      initialTransform: { centerX: 0.5, centerY: 0.78, width: 0.7 },
      intrinsicHeight: 400,
      intrinsicWidth: 800,
      mediaAssetId: 11,
      previousTransform: { centerX: 0.5, centerY: 0.22, width: 0.5 },
      sourceVisualIdentity: "asset:8",
      text: "Точный текст",
    });

    expect(generated.transform).toEqual({ centerX: 0.5, centerY: 0.78, width: 0.7 });
    expect(regenerated.transform).toEqual({ centerX: 0.5, centerY: 0.22, width: 0.5 });
  });

  it("resizes from either pointer axis while keeping the opposite corner anchored", () => {
    const origin = { centerX: 0.5, centerY: 0.4, width: 0.4 };
    const originalHeight = origin.width * (9 / 16);
    const originalAnchor = {
      x: origin.centerX - origin.width / 2,
      y: origin.centerY - originalHeight / 2,
    };
    const resized = resizeWorkspaceSegmentInfographicFromCorner({
      deltaX: 0,
      deltaY: 0.18,
      handle: "se",
      intrinsicHeight: 1000,
      intrinsicWidth: 1000,
      origin,
    });
    const resizedHeight = resized.width * (9 / 16);

    expect(resized.width).toBeGreaterThan(origin.width);
    expect(resized.centerX - resized.width / 2).toBeCloseTo(originalAnchor.x);
    expect(resized.centerY - resizedHeight / 2).toBeCloseTo(originalAnchor.y);
  });

  it("uses symmetric fades and shortens them for short segments", () => {
    expect(getWorkspaceSegmentInfographicFadeDuration(0.5)).toBeCloseTo(0.2);
    expect(getWorkspaceSegmentInfographicFadeDuration(5)).toBeCloseTo(1.1);
    expect(getWorkspaceSegmentInfographicOpacity(0, 5)).toBe(0);
    expect(getWorkspaceSegmentInfographicOpacity(0.55, 5)).toBeCloseTo(0.5);
    expect(getWorkspaceSegmentInfographicOpacity(2.5, 5)).toBe(1);
    expect(getWorkspaceSegmentInfographicOpacity(5, 5)).toBe(0);
  });

  it("marks an infographic stale only when the current visual identity changed", () => {
    const infographic = createWorkspaceSegmentInfographic({
      inputHash: TEST_INPUT_HASH,
      intrinsicHeight: 1024,
      intrinsicWidth: 1024,
      mediaAssetId: 12,
      sourceVisualIdentity: "asset:1",
      text: "Текст",
    });

    expect(isWorkspaceSegmentInfographicStale(infographic, "asset:1")).toBe(false);
    expect(isWorkspaceSegmentInfographicStale(infographic, "asset:2")).toBe(true);
    expect(isWorkspaceSegmentInfographicStale(infographic, "")).toBe(false);
  });

  it("exports the applied layer without changing the visual action and emits explicit removal", async () => {
    const draft = createWorkspaceSegmentEditorScratchDraftSession({ language: "ru" });
    draft.projectId = 81;
    const segment = draft.segments[0]!;
    segment.infographic = createWorkspaceSegmentInfographic({
      inputHash: TEST_INPUT_HASH,
      intrinsicHeight: 1024,
      intrinsicWidth: 1024,
      mediaAssetId: 120,
      sourceVisualIdentity: "asset:44",
      text: "Точный текст",
    });

    const applied = await buildWorkspaceSegmentEditorPayload(draft, { language: "ru" });
    expect(applied.payload.segments[0]?.videoAction).toBe("original");
    expect(applied.payload.segments[0]?.infographic?.mediaAssetId).toBe(120);
    expect(applied.payload.segments[0]?.infographicRemoved).toBeUndefined();

    segment.infographic = null;
    segment.infographicRemoved = true;
    const removed = await buildWorkspaceSegmentEditorPayload(draft, { language: "ru" });
    expect(removed.payload.segments[0]?.infographic).toBeUndefined();
    expect(removed.payload.segments[0]?.infographicRemoved).toBe(true);
  });

  it("counts Unicode characters and always creates a valid fallback UUID v4", () => {
    expect(getWorkspaceSegmentInfographicCharacterCount("A😀Б")).toBe(3);
    expect(truncateWorkspaceSegmentInfographicText("A😀Б", 2)).toBe("A😀");
    expect(createWorkspaceSegmentInfographicIdempotencyKey({ crypto: null })).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(getWorkspaceSegmentInfographicSourceVisualIdentity(77)).toBe("asset:77");
  });

  it("keeps bounded per-segment snapshots and supports undo/redo for applied state", () => {
    const draft = createWorkspaceSegmentEditorScratchDraftSession({ language: "ru" });
    const segment = draft.segments[0]!;
    let history = pushWorkspaceSegmentInfographicHistory(
      undefined,
      createWorkspaceSegmentInfographicStateSnapshot(segment),
    );
    segment.infographic = createWorkspaceSegmentInfographic({
      inputHash: TEST_INPUT_HASH,
      intrinsicHeight: 1024,
      intrinsicWidth: 1024,
      mediaAssetId: 101,
      sourceVisualIdentity: "asset:10",
      text: "First",
    });
    segment.infographic.transform.width = 0.12;
    for (let index = 0; index < 50; index += 1) {
      segment.infographic.transform.centerX = 0.1 + index / 100;
      history = pushWorkspaceSegmentInfographicHistory(
        history,
        createWorkspaceSegmentInfographicStateSnapshot(segment),
      );
    }
    expect(history.past).toHaveLength(40);

    const current = createWorkspaceSegmentInfographicStateSnapshot(segment);
    const undo = undoWorkspaceSegmentInfographicHistory(history, current);
    expect(undo).not.toBeNull();
    const redo = undo
      ? redoWorkspaceSegmentInfographicHistory(undo.history, undo.snapshot)
      : null;
    expect(redo?.snapshot.infographic?.mediaAssetId).toBe(101);
  });
});
