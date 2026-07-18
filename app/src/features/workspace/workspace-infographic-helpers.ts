import type {
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentInfographic,
  WorkspaceSegmentInfographicPart,
  WorkspaceSegmentInfographicTransform,
} from "./workspace-types";
import { createWorkspaceClientJobId } from "./workspace-utils";

export const WORKSPACE_SEGMENT_INFOGRAPHIC_TEXT_MAX_CHARS = 160;
export const WORKSPACE_SEGMENT_INFOGRAPHIC_STYLE_MAX_CHARS = 300;
export const WORKSPACE_SEGMENT_INFOGRAPHIC_DEFAULT_WIDTH = 0.7;
export const WORKSPACE_SEGMENT_INFOGRAPHIC_MIN_WIDTH = 0.12;
export const WORKSPACE_SEGMENT_INFOGRAPHIC_MAX_WIDTH = 0.96;
export const WORKSPACE_SEGMENT_INFOGRAPHIC_FADE_SECONDS = 1;
export const WORKSPACE_SEGMENT_INFOGRAPHIC_HOLD_SECONDS = 1;
export const WORKSPACE_SEGMENT_INFOGRAPHIC_PART_REVEAL_SECONDS = 1.3;
export const WORKSPACE_SEGMENT_INFOGRAPHIC_LEGACY_PART_REVEAL_SECONDS = 0.65;
export const WORKSPACE_SEGMENT_INFOGRAPHIC_TIMING_SCALE = 2;
export const WORKSPACE_SEGMENT_INFOGRAPHIC_FRAME_ASPECT_RATIO = 9 / 16;
export const WORKSPACE_SEGMENT_INFOGRAPHIC_HISTORY_LIMIT = 40;

export const getWorkspaceSegmentInfographicCharacterCount = (value: string | null | undefined) =>
  Array.from(String(value ?? "")).length;

export const truncateWorkspaceSegmentInfographicText = (
  value: string | null | undefined,
  maxCharacters: number,
) => Array.from(String(value ?? "")).slice(0, Math.max(0, Math.trunc(maxCharacters))).join("");

export const createWorkspaceSegmentInfographicIdempotencyKey = createWorkspaceClientJobId;

const WORKSPACE_SEGMENT_INFOGRAPHIC_STALE_SOURCE_ERROR =
  "Source media asset is not the current visual for this segment";

export const getWorkspaceSegmentInfographicCreateErrorMessage = (
  value: string | null | undefined,
  locale: string,
) => {
  const message = String(value ?? "").trim();
  if (message.includes(WORKSPACE_SEGMENT_INFOGRAPHIC_STALE_SOURCE_ERROR)) {
    return locale === "en"
      ? "The scene visual was not synchronized. Save the visual and try creating the infographic again."
      : "Визуал сцены не синхронизирован. Сохраните визуал и попробуйте создать инфографику ещё раз.";
  }

  return message || (locale === "en"
    ? "Failed to start infographic generation."
    : "Не удалось запустить создание инфографики.");
};

const finiteNumber = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const positiveInteger = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
};

const isWorkspaceSegmentInfographicInputHash = (value: string) => /^[0-9a-f]{64}$/i.test(value);
const isWorkspaceSegmentInfographicSourceIdentity = (value: string) => /^asset:[1-9]\d*$/.test(value);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeWorkspaceSegmentInfographicParts = (value: unknown): WorkspaceSegmentInfographicPart[] => {
  if (!Array.isArray(value) || value.length > 4) {
    return [];
  }
  const parts: WorkspaceSegmentInfographicPart[] = [];
  let previousDelay = -1;
  for (const rawPart of value) {
    if (!rawPart || typeof rawPart !== "object") {
      return [];
    }
    const record = rawPart as Record<string, unknown>;
    const frame = record.frame && typeof record.frame === "object"
      ? record.frame as Record<string, unknown>
      : {};
    const reveal = record.reveal && typeof record.reveal === "object"
      ? record.reveal as Record<string, unknown>
      : {};
    const mediaAssetId = positiveInteger(record.mediaAssetId ?? record.media_asset_id);
    const intrinsicWidth = positiveInteger(record.intrinsicWidth ?? record.intrinsic_width);
    const intrinsicHeight = positiveInteger(record.intrinsicHeight ?? record.intrinsic_height);
    const text = String(record.text ?? "").trim();
    const x = finiteNumber(frame.x, Number.NaN);
    const y = finiteNumber(frame.y, Number.NaN);
    const width = finiteNumber(frame.width, Number.NaN);
    const height = finiteNumber(frame.height, Number.NaN);
    const delaySeconds = finiteNumber(reveal.delaySeconds ?? reveal.delay_seconds, Number.NaN);
    const rawRevealDurationSeconds = finiteNumber(
      reveal.durationSeconds ?? reveal.duration_seconds,
      Number.NaN,
    );
    const normalizedDelaySeconds = delaySeconds * (
      !Number.isFinite(rawRevealDurationSeconds) ||
      rawRevealDurationSeconds <= WORKSPACE_SEGMENT_INFOGRAPHIC_LEGACY_PART_REVEAL_SECONDS + 0.000001
        ? WORKSPACE_SEGMENT_INFOGRAPHIC_TIMING_SCALE
        : 1
    );
    if (
      !mediaAssetId || !intrinsicWidth || !intrinsicHeight || !text ||
      ![x, y, width, height, delaySeconds].every(Number.isFinite) ||
      x < 0 || y < 0 || width <= 0 || height <= 0 ||
      x + width > 1.000001 || y + height > 1.000001 ||
      normalizedDelaySeconds < previousDelay
    ) {
      return [];
    }
    previousDelay = normalizedDelaySeconds;
    parts.push({
      frame: { height, width, x, y },
      intrinsicHeight,
      intrinsicWidth,
      mediaAssetId,
      reveal: {
        delaySeconds: normalizedDelaySeconds,
        durationSeconds: WORKSPACE_SEGMENT_INFOGRAPHIC_PART_REVEAL_SECONDS,
      },
      text,
    });
  }
  return parts;
};

export const getWorkspaceInfographicNormalizedHeight = (
  infographic: Pick<WorkspaceSegmentInfographic, "intrinsicHeight" | "intrinsicWidth" | "transform">,
) => {
  const intrinsicWidth = Math.max(1, finiteNumber(infographic.intrinsicWidth, 1));
  const intrinsicHeight = Math.max(1, finiteNumber(infographic.intrinsicHeight, 1));
  return infographic.transform.width * WORKSPACE_SEGMENT_INFOGRAPHIC_FRAME_ASPECT_RATIO * (intrinsicHeight / intrinsicWidth);
};

export const clampWorkspaceSegmentInfographicTransform = (
  transform: Partial<WorkspaceSegmentInfographicTransform> | null | undefined,
  intrinsicWidth: number,
  intrinsicHeight: number,
): WorkspaceSegmentInfographicTransform => {
  const safeIntrinsicWidth = Math.max(1, finiteNumber(intrinsicWidth, 1));
  const safeIntrinsicHeight = Math.max(1, finiteNumber(intrinsicHeight, 1));
  const maxWidthForHeight = 0.96 / (
    WORKSPACE_SEGMENT_INFOGRAPHIC_FRAME_ASPECT_RATIO * (safeIntrinsicHeight / safeIntrinsicWidth)
  );
  const maximumWidth = Math.max(
    WORKSPACE_SEGMENT_INFOGRAPHIC_MIN_WIDTH,
    Math.min(WORKSPACE_SEGMENT_INFOGRAPHIC_MAX_WIDTH, maxWidthForHeight),
  );
  const width = clamp(
    finiteNumber(transform?.width, WORKSPACE_SEGMENT_INFOGRAPHIC_DEFAULT_WIDTH),
    WORKSPACE_SEGMENT_INFOGRAPHIC_MIN_WIDTH,
    maximumWidth,
  );
  const normalizedHeight = width * WORKSPACE_SEGMENT_INFOGRAPHIC_FRAME_ASPECT_RATIO *
    (safeIntrinsicHeight / safeIntrinsicWidth);

  return {
    centerX: clamp(finiteNumber(transform?.centerX, 0.5), width / 2, 1 - width / 2),
    centerY: clamp(finiteNumber(transform?.centerY, 0.28), normalizedHeight / 2, 1 - normalizedHeight / 2),
    width,
  };
};

export const resizeWorkspaceSegmentInfographicFromCorner = (options: {
  deltaX: number;
  deltaY: number;
  handle: "ne" | "nw" | "se" | "sw";
  intrinsicHeight: number;
  intrinsicWidth: number;
  origin: WorkspaceSegmentInfographicTransform;
}): WorkspaceSegmentInfographicTransform => {
  const intrinsicWidth = Math.max(1, finiteNumber(options.intrinsicWidth, 1));
  const intrinsicHeight = Math.max(1, finiteNumber(options.intrinsicHeight, 1));
  const heightPerWidth = WORKSPACE_SEGMENT_INFOGRAPHIC_FRAME_ASPECT_RATIO *
    (intrinsicHeight / intrinsicWidth);
  const directionX = options.handle.endsWith("e") ? 1 : -1;
  const directionY = options.handle.startsWith("s") ? 1 : -1;
  const originHeight = options.origin.width * heightPerWidth;
  const anchorX = options.origin.centerX - directionX * options.origin.width / 2;
  const anchorY = options.origin.centerY - directionY * originHeight / 2;
  const projectedWidthDelta = (
    directionX * finiteNumber(options.deltaX, 0) +
    directionY * heightPerWidth * finiteNumber(options.deltaY, 0)
  ) / (1 + heightPerWidth * heightPerWidth);
  const requestedWidth = options.origin.width + projectedWidthDelta;
  const globallyClampedWidth = clampWorkspaceSegmentInfographicTransform(
    { centerX: 0.5, centerY: 0.5, width: requestedWidth },
    intrinsicWidth,
    intrinsicHeight,
  ).width;
  const maximumWidthFromHorizontalAnchor = directionX > 0 ? 1 - anchorX : anchorX;
  const maximumWidthFromVerticalAnchor = (
    directionY > 0 ? 1 - anchorY : anchorY
  ) / heightPerWidth;
  const width = Math.max(
    WORKSPACE_SEGMENT_INFOGRAPHIC_MIN_WIDTH,
    Math.min(
      globallyClampedWidth,
      maximumWidthFromHorizontalAnchor,
      maximumWidthFromVerticalAnchor,
    ),
  );

  return clampWorkspaceSegmentInfographicTransform(
    {
      centerX: anchorX + directionX * width / 2,
      centerY: anchorY + directionY * width * heightPerWidth / 2,
      width,
    },
    intrinsicWidth,
    intrinsicHeight,
  );
};

export const normalizeWorkspaceSegmentInfographic = (value: unknown): WorkspaceSegmentInfographic | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const mediaAssetId = positiveInteger(record.mediaAssetId ?? record.media_asset_id);
  const rawText = String(record.text ?? "").trim();
  const rawStylePrompt = String(record.stylePrompt ?? record.style_prompt ?? "").trim();
  const intrinsicWidth = positiveInteger(record.intrinsicWidth ?? record.intrinsic_width);
  const intrinsicHeight = positiveInteger(record.intrinsicHeight ?? record.intrinsic_height);
  const inputHash = String(record.inputHash ?? record.input_hash ?? "").trim().toLowerCase();
  const sourceVisualIdentity = String(
    record.sourceVisualIdentity ?? record.source_visual_identity ?? "",
  ).trim();
  const version = Number(record.version);
  if (
    version !== 1 ||
    !mediaAssetId ||
    !intrinsicWidth ||
    !intrinsicHeight ||
    !rawText ||
    getWorkspaceSegmentInfographicCharacterCount(rawText) > WORKSPACE_SEGMENT_INFOGRAPHIC_TEXT_MAX_CHARS ||
    getWorkspaceSegmentInfographicCharacterCount(rawStylePrompt) > WORKSPACE_SEGMENT_INFOGRAPHIC_STYLE_MAX_CHARS ||
    !isWorkspaceSegmentInfographicInputHash(inputHash) ||
    !isWorkspaceSegmentInfographicSourceIdentity(sourceVisualIdentity)
  ) {
    return null;
  }

  const transformRecord =
    record.transform && typeof record.transform === "object"
      ? (record.transform as Partial<WorkspaceSegmentInfographicTransform>)
      : null;
  const parts = normalizeWorkspaceSegmentInfographicParts(record.parts);

  return {
    animation: {
      durationSeconds: WORKSPACE_SEGMENT_INFOGRAPHIC_FADE_SECONDS,
      type: "fade",
    },
    inputHash,
    intrinsicHeight,
    intrinsicWidth,
    mediaAssetId,
    parts,
    sourceVisualIdentity,
    stylePrompt: rawStylePrompt
      ? truncateWorkspaceSegmentInfographicText(rawStylePrompt, WORKSPACE_SEGMENT_INFOGRAPHIC_STYLE_MAX_CHARS)
      : null,
    text: rawText,
    transform: clampWorkspaceSegmentInfographicTransform(transformRecord, intrinsicWidth, intrinsicHeight),
    version: 1,
  };
};

export const cloneWorkspaceSegmentInfographic = (
  infographic: WorkspaceSegmentInfographic | null | undefined,
): WorkspaceSegmentInfographic | null => {
  const normalized = normalizeWorkspaceSegmentInfographic(infographic);
  return normalized
    ? {
        ...normalized,
        animation: { ...normalized.animation },
        parts: normalized.parts.map((part) => ({
          ...part,
          frame: { ...part.frame },
          reveal: { ...part.reveal },
        })),
        transform: { ...normalized.transform },
      }
    : null;
};

export const createWorkspaceSegmentInfographic = (options: {
  inputHash: string;
  intrinsicHeight?: number | null;
  intrinsicWidth?: number | null;
  initialTransform?: Partial<WorkspaceSegmentInfographicTransform> | null;
  mediaAssetId: number;
  parts?: unknown;
  previousTransform?: WorkspaceSegmentInfographicTransform | null;
  sourceVisualIdentity: string;
  stylePrompt?: string | null;
  text: string;
}): WorkspaceSegmentInfographic => {
  const intrinsicWidth = positiveInteger(options.intrinsicWidth);
  const intrinsicHeight = positiveInteger(options.intrinsicHeight);
  const mediaAssetId = positiveInteger(options.mediaAssetId);
  const inputHash = String(options.inputHash ?? "").trim().toLowerCase();
  const sourceVisualIdentity = String(options.sourceVisualIdentity ?? "").trim();
  const text = String(options.text ?? "").trim();
  const stylePrompt = String(options.stylePrompt ?? "").trim();
  if (
    !intrinsicWidth ||
    !intrinsicHeight ||
    !mediaAssetId ||
    !text ||
    getWorkspaceSegmentInfographicCharacterCount(text) > WORKSPACE_SEGMENT_INFOGRAPHIC_TEXT_MAX_CHARS ||
    getWorkspaceSegmentInfographicCharacterCount(stylePrompt) > WORKSPACE_SEGMENT_INFOGRAPHIC_STYLE_MAX_CHARS ||
    !isWorkspaceSegmentInfographicInputHash(inputHash) ||
    !isWorkspaceSegmentInfographicSourceIdentity(sourceVisualIdentity)
  ) {
    throw new Error("Infographic generation result is incomplete or invalid.");
  }
  return {
    animation: { durationSeconds: WORKSPACE_SEGMENT_INFOGRAPHIC_FADE_SECONDS, type: "fade" },
    inputHash,
    intrinsicHeight,
    intrinsicWidth,
    mediaAssetId,
    parts: normalizeWorkspaceSegmentInfographicParts(options.parts),
    sourceVisualIdentity,
    stylePrompt: stylePrompt || null,
    text,
    transform: clampWorkspaceSegmentInfographicTransform(
      options.previousTransform ?? options.initialTransform ?? {
        centerX: 0.5,
        centerY: 0.28,
        width: WORKSPACE_SEGMENT_INFOGRAPHIC_DEFAULT_WIDTH,
      },
      intrinsicWidth,
      intrinsicHeight,
    ),
    version: 1,
  };
};

export const getWorkspaceSegmentInfographicIdentityKey = (
  infographic: WorkspaceSegmentInfographic | null | undefined,
) => {
  const normalized = normalizeWorkspaceSegmentInfographic(infographic);
  return normalized
    ? JSON.stringify([
        normalized.mediaAssetId,
        normalized.parts,
        normalized.text,
        normalized.stylePrompt,
        normalized.sourceVisualIdentity,
        normalized.inputHash,
        normalized.intrinsicWidth,
        normalized.intrinsicHeight,
        normalized.transform.centerX,
        normalized.transform.centerY,
        normalized.transform.width,
        normalized.animation.type,
        normalized.animation.durationSeconds,
      ])
    : "";
};

export const areWorkspaceSegmentInfographicsEqual = (
  left: WorkspaceSegmentInfographic | null | undefined,
  right: WorkspaceSegmentInfographic | null | undefined,
) => getWorkspaceSegmentInfographicIdentityKey(left) === getWorkspaceSegmentInfographicIdentityKey(right);

export const isWorkspaceSegmentInfographicStale = (
  infographic: WorkspaceSegmentInfographic | null | undefined,
  currentVisualIdentity: string | null | undefined,
) => {
  const normalized = normalizeWorkspaceSegmentInfographic(infographic);
  const currentIdentity = String(currentVisualIdentity ?? "").trim();
  return Boolean(
    normalized?.sourceVisualIdentity &&
      currentIdentity &&
      normalized.sourceVisualIdentity !== currentIdentity,
  );
};

export const getWorkspaceSegmentInfographicFadeDuration = (
  segmentDurationSeconds: number,
  configuredDurationSeconds = WORKSPACE_SEGMENT_INFOGRAPHIC_FADE_SECONDS,
) => getWorkspaceSegmentInfographicTiming(
  segmentDurationSeconds,
  configuredDurationSeconds,
).fadeOutDurationSeconds;

export const getWorkspaceSegmentInfographicTiming = (
  segmentDurationSeconds: number,
  configuredFadeSeconds = WORKSPACE_SEGMENT_INFOGRAPHIC_FADE_SECONDS,
  parts: readonly WorkspaceSegmentInfographicPart[] = [],
) => {
  const duration = Math.max(0, finiteNumber(segmentDurationSeconds, 0));
  const fade = Math.max(0, finiteNumber(configuredFadeSeconds, 0));
  const naturalRevealEnd = parts.length > 0
    ? Math.max(...parts.map((part) => (
        Math.max(0, finiteNumber(part.reveal.delaySeconds, 0)) +
        Math.max(0.05, finiteNumber(part.reveal.durationSeconds, WORKSPACE_SEGMENT_INFOGRAPHIC_PART_REVEAL_SECONDS))
      )))
    : fade;
  if (duration <= 0 || fade <= 0 || naturalRevealEnd <= 0) {
    return {
      endSeconds: duration,
      fadeOutDurationSeconds: 0,
      fadeOutStartSeconds: duration,
      holdSeconds: 0,
      revealEndSeconds: 0,
      transitionScale: 0,
    };
  }

  // Keep a real fade on both sides even when the segment is shorter than the
  // preferred one-second reveal + one-second hold + one-second fade-out
  // sequence. Semantic parts still reveal sequentially, but their complete
  // reveal is scaled into the same one-second reveal phase.
  const minimumTransitionBudget = Math.min(duration, 0.1);
  const holdSeconds = Math.min(
    WORKSPACE_SEGMENT_INFOGRAPHIC_HOLD_SECONDS,
    Math.max(0, duration - minimumTransitionBudget),
  );
  const transitionBudget = Math.max(0, duration - holdSeconds);
  const phaseScale = Math.min(1, transitionBudget / (fade * 2));
  const revealEndSeconds = fade * phaseScale;
  const transitionScale = revealEndSeconds / naturalRevealEnd;
  const fadeOutDurationSeconds = fade * phaseScale;
  const fadeOutStartSeconds = revealEndSeconds + holdSeconds;

  return {
    endSeconds: Math.min(duration, fadeOutStartSeconds + fadeOutDurationSeconds),
    fadeOutDurationSeconds,
    fadeOutStartSeconds,
    holdSeconds,
    revealEndSeconds,
    transitionScale,
  };
};

export const getWorkspaceSegmentInfographicOpacity = (
  localTimeSeconds: number,
  segmentDurationSeconds: number,
  configuredDurationSeconds = WORKSPACE_SEGMENT_INFOGRAPHIC_FADE_SECONDS,
) => {
  const duration = Math.max(0, finiteNumber(segmentDurationSeconds, 0));
  if (duration <= 0) {
    return 1;
  }
  const time = clamp(finiteNumber(localTimeSeconds, 0), 0, duration);
  const timing = getWorkspaceSegmentInfographicTiming(duration, configuredDurationSeconds);
  const fadeInDuration = timing.revealEndSeconds;
  if (fadeInDuration <= 0 || timing.fadeOutDurationSeconds <= 0) {
    return 1;
  }
  const fadeInOpacity = clamp(time / fadeInDuration, 0, 1);
  const fadeOutOpacity = clamp(
    (timing.endSeconds - time) / timing.fadeOutDurationSeconds,
    0,
    1,
  );
  return Math.min(fadeInOpacity, fadeOutOpacity);
};

export const getWorkspaceSegmentInfographicPartOpacity = (
  part: WorkspaceSegmentInfographicPart,
  localTimeSeconds: number,
  segmentDurationSeconds: number,
  configuredFadeSeconds = WORKSPACE_SEGMENT_INFOGRAPHIC_FADE_SECONDS,
  allParts: readonly WorkspaceSegmentInfographicPart[] = [part],
) => {
  const duration = Math.max(0, finiteNumber(segmentDurationSeconds, 0));
  if (duration <= 0) {
    return 1;
  }
  const time = clamp(finiteNumber(localTimeSeconds, 0), 0, duration);
  const timing = getWorkspaceSegmentInfographicTiming(duration, configuredFadeSeconds, allParts);
  const delay = Math.max(0, finiteNumber(part.reveal.delaySeconds, 0)) * timing.transitionScale;
  const revealDuration = Math.max(
    0.001,
    finiteNumber(part.reveal.durationSeconds, WORKSPACE_SEGMENT_INFOGRAPHIC_PART_REVEAL_SECONDS) *
      timing.transitionScale,
  );
  const fadeInOpacity = clamp((time - delay) / revealDuration, 0, 1);
  const fadeOutOpacity = timing.fadeOutDurationSeconds > 0
    ? clamp((timing.endSeconds - time) / timing.fadeOutDurationSeconds, 0, 1)
    : 1;
  return Math.min(fadeInOpacity, fadeOutOpacity);
};

export const getWorkspaceSegmentInfographicAssetUrl = (mediaAssetId: number) =>
  `/api/workspace/media-assets/${Math.max(1, Math.trunc(mediaAssetId))}`;

export const getWorkspaceSegmentInfographicSourceVisualIdentity = (mediaAssetId: number | null | undefined) => {
  const normalizedAssetId = positiveInteger(mediaAssetId);
  return normalizedAssetId ? `asset:${normalizedAssetId}` : "";
};

export const shouldUploadWorkspaceSegmentInfographicSourceAsset = (
  sourceMediaAssetId: number | null | undefined,
  hasDraftVisualAsset: boolean,
) => !positiveInteger(sourceMediaAssetId) && hasDraftVisualAsset;

export const isWorkspaceSegmentInfographicJobResultContextValid = (options: {
  draftId?: string;
  expectedDraftId?: string;
  expectedProjectId: number;
  expectedRequestFingerprint: string;
  expectedSegmentIndex: number;
  projectId?: number;
  requestFingerprint?: string;
  segmentIndex?: number;
}) => {
  const expectedDraftId = String(options.expectedDraftId ?? "").trim();
  const draftId = String(options.draftId ?? "").trim();
  const requiresScratchDraftIdentity = options.expectedProjectId === 0;
  return (
    options.projectId === options.expectedProjectId &&
    (!requiresScratchDraftIdentity || (Boolean(expectedDraftId) && draftId === expectedDraftId)) &&
    options.requestFingerprint === options.expectedRequestFingerprint &&
    options.segmentIndex === options.expectedSegmentIndex
  );
};

export type WorkspaceSegmentInfographicStatusFailureAction = "preserve" | "remove" | "retry";

const WORKSPACE_SEGMENT_INFOGRAPHIC_INVALID_CONTEXT_STATUS_CODES = new Set([
  400,
  403,
  404,
  409,
  410,
  422,
]);

export const getWorkspaceSegmentInfographicStatusFailureAction = (options: {
  failureCount: number;
  maxTransientFailures?: number;
  statusCode?: number | null;
}): WorkspaceSegmentInfographicStatusFailureAction => {
  const statusCode = Number(options.statusCode);
  if (
    Number.isInteger(statusCode) &&
    WORKSPACE_SEGMENT_INFOGRAPHIC_INVALID_CONTEXT_STATUS_CODES.has(statusCode)
  ) {
    return "remove";
  }

  const failureCount = Math.max(1, Math.trunc(Number(options.failureCount) || 1));
  const rawMaxTransientFailures = Number(options.maxTransientFailures);
  const maxTransientFailures = Math.max(
    0,
    Number.isFinite(rawMaxTransientFailures) ? Math.trunc(rawMaxTransientFailures) : 5,
  );
  return failureCount > maxTransientFailures ? "preserve" : "retry";
};

export type WorkspaceSegmentInfographicStateSnapshot = {
  infographic: WorkspaceSegmentInfographic | null;
  infographicRemoved: boolean;
  infographicSourceWarningDismissedForIdentity: string | null;
  infographicStylePromptDraft: string;
  infographicTextDraft: string;
};

export type WorkspaceSegmentInfographicHistory = {
  future: WorkspaceSegmentInfographicStateSnapshot[];
  past: WorkspaceSegmentInfographicStateSnapshot[];
};

export const createWorkspaceSegmentInfographicStateSnapshot = (
  segment: Pick<
    WorkspaceSegmentEditorDraftSegment,
    | "infographic"
    | "infographicRemoved"
    | "infographicSourceWarningDismissedForIdentity"
    | "infographicStylePromptDraft"
    | "infographicTextDraft"
  >,
): WorkspaceSegmentInfographicStateSnapshot => ({
  infographic: cloneWorkspaceSegmentInfographic(segment.infographic),
  infographicRemoved: segment.infographicRemoved === true,
  infographicSourceWarningDismissedForIdentity: segment.infographicSourceWarningDismissedForIdentity,
  infographicStylePromptDraft: segment.infographicStylePromptDraft,
  infographicTextDraft: segment.infographicTextDraft,
});

const cloneWorkspaceSegmentInfographicStateSnapshot = (
  snapshot: WorkspaceSegmentInfographicStateSnapshot,
): WorkspaceSegmentInfographicStateSnapshot => ({
  ...snapshot,
  infographic: cloneWorkspaceSegmentInfographic(snapshot.infographic),
});

const getWorkspaceSegmentInfographicStateSnapshotKey = (snapshot: WorkspaceSegmentInfographicStateSnapshot) =>
  JSON.stringify([
    getWorkspaceSegmentInfographicIdentityKey(snapshot.infographic),
    snapshot.infographicRemoved,
    snapshot.infographicSourceWarningDismissedForIdentity,
    snapshot.infographicStylePromptDraft,
    snapshot.infographicTextDraft,
  ]);

export const pushWorkspaceSegmentInfographicHistory = (
  history: WorkspaceSegmentInfographicHistory | null | undefined,
  snapshot: WorkspaceSegmentInfographicStateSnapshot,
): WorkspaceSegmentInfographicHistory => {
  const current = history ?? { future: [], past: [] };
  const previous = current.past.at(-1);
  if (previous && getWorkspaceSegmentInfographicStateSnapshotKey(previous) === getWorkspaceSegmentInfographicStateSnapshotKey(snapshot)) {
    return { future: [], past: current.past };
  }
  return {
    future: [],
    past: [...current.past, cloneWorkspaceSegmentInfographicStateSnapshot(snapshot)].slice(
      -WORKSPACE_SEGMENT_INFOGRAPHIC_HISTORY_LIMIT,
    ),
  };
};

export const undoWorkspaceSegmentInfographicHistory = (
  history: WorkspaceSegmentInfographicHistory | null | undefined,
  currentSnapshot: WorkspaceSegmentInfographicStateSnapshot,
) => {
  const current = history ?? { future: [], past: [] };
  const snapshot = current.past.at(-1);
  if (!snapshot) {
    return null;
  }
  return {
    history: {
      future: [...current.future, cloneWorkspaceSegmentInfographicStateSnapshot(currentSnapshot)].slice(
        -WORKSPACE_SEGMENT_INFOGRAPHIC_HISTORY_LIMIT,
      ),
      past: current.past.slice(0, -1),
    },
    snapshot: cloneWorkspaceSegmentInfographicStateSnapshot(snapshot),
  };
};

export const redoWorkspaceSegmentInfographicHistory = (
  history: WorkspaceSegmentInfographicHistory | null | undefined,
  currentSnapshot: WorkspaceSegmentInfographicStateSnapshot,
) => {
  const current = history ?? { future: [], past: [] };
  const snapshot = current.future.at(-1);
  if (!snapshot) {
    return null;
  }
  return {
    history: {
      future: current.future.slice(0, -1),
      past: [...current.past, cloneWorkspaceSegmentInfographicStateSnapshot(currentSnapshot)].slice(
        -WORKSPACE_SEGMENT_INFOGRAPHIC_HISTORY_LIMIT,
      ),
    },
    snapshot: cloneWorkspaceSegmentInfographicStateSnapshot(snapshot),
  };
};

export const applyWorkspaceSegmentInfographicStateSnapshot = (
  segment: WorkspaceSegmentEditorDraftSegment,
  snapshot: WorkspaceSegmentInfographicStateSnapshot,
): WorkspaceSegmentEditorDraftSegment => ({
  ...segment,
  infographic: cloneWorkspaceSegmentInfographic(snapshot.infographic),
  infographicRemoved: snapshot.infographicRemoved,
  infographicSourceWarningDismissedForIdentity: snapshot.infographicSourceWarningDismissedForIdentity,
  infographicStylePromptDraft: snapshot.infographicStylePromptDraft,
  infographicTextDraft: snapshot.infographicTextDraft,
});
