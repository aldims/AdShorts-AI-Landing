export type WorkspaceSegmentEditorFullPreviewSegment = {
  endTime?: number | null;
  index: number;
  startTime?: number | null;
};

export type WorkspaceSegmentEditorFullPreviewResolvedSegment = {
  arrayIndex: number;
  duration: number;
  endTime: number;
  localTime: number;
  progress: number;
  segmentIndex: number;
  startTime: number;
};

const normalizePreviewTime = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
};

export const clampWorkspaceSegmentEditorFullPreviewTime = (
  currentTime: number,
  duration: number,
) => {
  const safeDuration = normalizePreviewTime(duration) ?? 0;
  const safeTime = normalizePreviewTime(currentTime) ?? 0;
  return Math.min(safeDuration, safeTime);
};

export const getWorkspaceSegmentEditorFullPreviewTimeRatio = (
  currentTime: number,
  duration: number,
) => {
  const safeDuration = normalizePreviewTime(duration) ?? 0;
  if (safeDuration <= 0) {
    return 0;
  }

  return clampWorkspaceSegmentEditorFullPreviewTime(currentTime, safeDuration) / safeDuration;
};

export const getWorkspaceSegmentEditorFullPreviewSegmentRatio = (
  segments: WorkspaceSegmentEditorFullPreviewSegment[],
  currentTime: number,
) => {
  if (segments.length === 0) {
    return 0;
  }

  const resolvedSegment = resolveWorkspaceSegmentEditorFullPreviewSegment(segments, currentTime);
  if (!resolvedSegment) {
    return 0;
  }

  return Math.min(1, Math.max(0, (resolvedSegment.arrayIndex + resolvedSegment.progress) / segments.length));
};

export const getWorkspaceSegmentEditorFullPreviewTimeFromSegmentRatio = (
  segments: WorkspaceSegmentEditorFullPreviewSegment[],
  ratio: number,
) => {
  if (segments.length === 0) {
    return 0;
  }

  const safeRatio = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const duration = getWorkspaceSegmentEditorFullPreviewDuration(segments);
  if (safeRatio >= 1) {
    return duration;
  }

  const segmentPosition = safeRatio * segments.length;
  const arrayIndex = Math.min(segments.length - 1, Math.max(0, Math.floor(segmentPosition)));
  const segmentProgress = Math.min(1, Math.max(0, segmentPosition - arrayIndex));
  const segment = segments[arrayIndex];
  const startTime = normalizePreviewTime(segment.startTime) ?? 0;
  const fallbackEndTime = arrayIndex === segments.length - 1 ? duration : startTime;
  const endTime = Math.max(startTime, normalizePreviewTime(segment.endTime) ?? fallbackEndTime);

  return startTime + (endTime - startTime) * segmentProgress;
};

export const getWorkspaceSegmentEditorFullPreviewDuration = (
  segments: WorkspaceSegmentEditorFullPreviewSegment[],
) =>
  Math.max(
    0,
    ...segments.map((segment) => normalizePreviewTime(segment.endTime) ?? 0),
  );

export const resolveWorkspaceSegmentEditorFullPreviewSegment = (
  segments: WorkspaceSegmentEditorFullPreviewSegment[],
  currentTime: number,
): WorkspaceSegmentEditorFullPreviewResolvedSegment | null => {
  if (segments.length === 0) {
    return null;
  }

  const duration = getWorkspaceSegmentEditorFullPreviewDuration(segments);
  const safeTime = clampWorkspaceSegmentEditorFullPreviewTime(currentTime, duration);

  for (let arrayIndex = 0; arrayIndex < segments.length; arrayIndex += 1) {
    const segment = segments[arrayIndex];
    const startTime = normalizePreviewTime(segment.startTime) ?? 0;
    const fallbackEndTime = arrayIndex === segments.length - 1 ? duration : startTime;
    const endTime = Math.max(startTime, normalizePreviewTime(segment.endTime) ?? fallbackEndTime);
    const isLastSegment = arrayIndex === segments.length - 1;
    const containsTime = safeTime >= startTime && (safeTime < endTime || (isLastSegment && safeTime <= endTime));

    if (!containsTime) {
      continue;
    }

    const segmentDuration = Math.max(0, endTime - startTime);
    const localTime = Math.min(segmentDuration, Math.max(0, safeTime - startTime));
    const progress = segmentDuration > 0 ? localTime / segmentDuration : 0;

    return {
      arrayIndex,
      duration: segmentDuration,
      endTime,
      localTime,
      progress,
      segmentIndex: segment.index,
      startTime,
    };
  }

  const fallbackSegment = segments[segments.length - 1];
  const fallbackStartTime = normalizePreviewTime(fallbackSegment.startTime) ?? 0;
  const fallbackEndTime = Math.max(fallbackStartTime, normalizePreviewTime(fallbackSegment.endTime) ?? duration);
  const fallbackDuration = Math.max(0, fallbackEndTime - fallbackStartTime);

  return {
    arrayIndex: segments.length - 1,
    duration: fallbackDuration,
    endTime: fallbackEndTime,
    localTime: fallbackDuration,
    progress: fallbackDuration > 0 ? 1 : 0,
    segmentIndex: fallbackSegment.index,
    startTime: fallbackStartTime,
  };
};
