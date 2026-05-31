export type WorkspaceTalkingCharacterTarget = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type WorkspaceTalkingTargetResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const WORKSPACE_TALKING_CHARACTER_TARGET_MIN_SIZE = 0.06;
const WORKSPACE_TALKING_CHARACTER_TARGET_DRAFT_MIN_SIZE = 0.004;
const WORKSPACE_TALKING_CHARACTER_TARGET_DEFAULT_WIDTH = 0.28;
const WORKSPACE_TALKING_CHARACTER_TARGET_DEFAULT_HEIGHT = 0.34;
export const WORKSPACE_TALKING_TARGET_RESIZE_HANDLES: readonly WorkspaceTalkingTargetResizeHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

export const clampWorkspaceUnitValue = (value: number) => Math.min(1, Math.max(0, value));

export const isWorkspaceTalkingTargetResizeHandle = (
  value: string | null | undefined,
): value is WorkspaceTalkingTargetResizeHandle =>
  !!value && WORKSPACE_TALKING_TARGET_RESIZE_HANDLES.includes(value as WorkspaceTalkingTargetResizeHandle);

export const normalizeWorkspaceTalkingCharacterTarget = (
  value: Partial<WorkspaceTalkingCharacterTarget> | null | undefined,
): WorkspaceTalkingCharacterTarget | null => {
  const x = Number(value?.x);
  const y = Number(value?.y);
  const width = Number(value?.width);
  const height = Number(value?.height);
  if (![x, y, width, height].every(Number.isFinite)) {
    return null;
  }

  const normalizedWidth = Math.min(1, Math.max(WORKSPACE_TALKING_CHARACTER_TARGET_MIN_SIZE, width));
  const normalizedHeight = Math.min(1, Math.max(WORKSPACE_TALKING_CHARACTER_TARGET_MIN_SIZE, height));
  return {
    height: normalizedHeight,
    width: normalizedWidth,
    x: Math.min(1 - normalizedWidth, Math.max(0, x)),
    y: Math.min(1 - normalizedHeight, Math.max(0, y)),
  };
};

export const mapWorkspaceTalkingCharacterTargetToSourceFrame = (
  target: Partial<WorkspaceTalkingCharacterTarget> | null | undefined,
  frame: {
    containerHeight: number;
    containerWidth: number;
    fit?: "contain" | "cover";
    sourceHeight: number;
    sourceWidth: number;
  },
): WorkspaceTalkingCharacterTarget | null => {
  const normalizedTarget = normalizeWorkspaceTalkingCharacterTarget(target);
  const containerWidth = Number(frame.containerWidth);
  const containerHeight = Number(frame.containerHeight);
  const sourceWidth = Number(frame.sourceWidth);
  const sourceHeight = Number(frame.sourceHeight);
  if (
    !normalizedTarget ||
    ![containerWidth, containerHeight, sourceWidth, sourceHeight].every(Number.isFinite) ||
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    return normalizedTarget;
  }

  const scale =
    frame.fit === "contain"
      ? Math.min(containerWidth / sourceWidth, containerHeight / sourceHeight)
      : Math.max(containerWidth / sourceWidth, containerHeight / sourceHeight);
  if (!Number.isFinite(scale) || scale <= 0) {
    return normalizedTarget;
  }

  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const offsetX = (containerWidth - renderedWidth) / 2;
  const offsetY = (containerHeight - renderedHeight) / 2;

  const targetLeft = normalizedTarget.x * containerWidth;
  const targetTop = normalizedTarget.y * containerHeight;
  const targetRight = (normalizedTarget.x + normalizedTarget.width) * containerWidth;
  const targetBottom = (normalizedTarget.y + normalizedTarget.height) * containerHeight;

  return createWorkspaceTalkingCharacterTargetFromEdges(
    (targetLeft - offsetX) / renderedWidth,
    (targetTop - offsetY) / renderedHeight,
    (targetRight - offsetX) / renderedWidth,
    (targetBottom - offsetY) / renderedHeight,
  );
};

const createWorkspaceTalkingCharacterTargetFromEdges = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): WorkspaceTalkingCharacterTarget => {
  const clampedLeft = clampWorkspaceUnitValue(left);
  const clampedTop = clampWorkspaceUnitValue(top);
  const clampedRight = clampWorkspaceUnitValue(right);
  const clampedBottom = clampWorkspaceUnitValue(bottom);
  const x = Math.min(clampedLeft, clampedRight);
  const y = Math.min(clampedTop, clampedBottom);

  return normalizeWorkspaceTalkingCharacterTarget({
    height: Math.abs(clampedBottom - clampedTop),
    width: Math.abs(clampedRight - clampedLeft),
    x,
    y,
  }) as WorkspaceTalkingCharacterTarget;
};

export const createWorkspaceTalkingCharacterTargetFromPoints = (
  start: { x: number; y: number },
  end: { x: number; y: number },
): WorkspaceTalkingCharacterTarget => {
  const startX = clampWorkspaceUnitValue(start.x);
  const startY = clampWorkspaceUnitValue(start.y);
  const endX = clampWorkspaceUnitValue(end.x);
  const endY = clampWorkspaceUnitValue(end.y);
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  const isDragSelection =
    width >= WORKSPACE_TALKING_CHARACTER_TARGET_MIN_SIZE &&
    height >= WORKSPACE_TALKING_CHARACTER_TARGET_MIN_SIZE;

  if (isDragSelection) {
    return normalizeWorkspaceTalkingCharacterTarget({
      height,
      width,
      x: left,
      y: top,
    }) as WorkspaceTalkingCharacterTarget;
  }

  const defaultWidth = WORKSPACE_TALKING_CHARACTER_TARGET_DEFAULT_WIDTH;
  const defaultHeight = WORKSPACE_TALKING_CHARACTER_TARGET_DEFAULT_HEIGHT;
  return normalizeWorkspaceTalkingCharacterTarget({
    height: defaultHeight,
    width: defaultWidth,
    x: endX - defaultWidth / 2,
    y: endY - defaultHeight / 2,
  }) as WorkspaceTalkingCharacterTarget;
};

export const createWorkspaceTalkingCharacterDraftTargetFromPoints = (
  start: { x: number; y: number },
  end: { x: number; y: number },
): WorkspaceTalkingCharacterTarget | null => {
  const startX = clampWorkspaceUnitValue(start.x);
  const startY = clampWorkspaceUnitValue(start.y);
  const endX = clampWorkspaceUnitValue(end.x);
  const endY = clampWorkspaceUnitValue(end.y);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  if (width <= 0 && height <= 0) {
    return null;
  }

  const visibleWidth = Math.max(width, WORKSPACE_TALKING_CHARACTER_TARGET_DRAFT_MIN_SIZE);
  const visibleHeight = Math.max(height, WORKSPACE_TALKING_CHARACTER_TARGET_DRAFT_MIN_SIZE);
  return {
    height: visibleHeight,
    width: visibleWidth,
    x: Math.min(1 - visibleWidth, Math.min(startX, endX)),
    y: Math.min(1 - visibleHeight, Math.min(startY, endY)),
  };
};

export const moveWorkspaceTalkingCharacterTarget = (
  target: WorkspaceTalkingCharacterTarget,
  deltaX: number,
  deltaY: number,
): WorkspaceTalkingCharacterTarget =>
  normalizeWorkspaceTalkingCharacterTarget({
    ...target,
    x: target.x + deltaX,
    y: target.y + deltaY,
  }) as WorkspaceTalkingCharacterTarget;

export const resizeWorkspaceTalkingCharacterTarget = (
  target: WorkspaceTalkingCharacterTarget,
  handle: WorkspaceTalkingTargetResizeHandle,
  point: { x: number; y: number },
): WorkspaceTalkingCharacterTarget => {
  let left = target.x;
  let top = target.y;
  let right = target.x + target.width;
  let bottom = target.y + target.height;

  if (handle.includes("w")) {
    left = point.x;
  }
  if (handle.includes("e")) {
    right = point.x;
  }
  if (handle.includes("n")) {
    top = point.y;
  }
  if (handle.includes("s")) {
    bottom = point.y;
  }

  return createWorkspaceTalkingCharacterTargetFromEdges(left, top, right, bottom);
};
