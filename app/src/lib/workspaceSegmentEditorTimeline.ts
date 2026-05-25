export type WorkspaceSegmentTimelineWord = {
  endTime?: number | null;
  startTime?: number | null;
};

export type WorkspaceSegmentDurationMode = "auto" | "manual";

export type WorkspaceSegmentTimelineSegment = {
  duration?: number | null;
  durationMode?: WorkspaceSegmentDurationMode | null;
  endTime?: number | null;
  manualDurationSeconds?: number | null;
  mediaType?: string | null;
  speechDuration?: number | null;
  speechEndTime?: number | null;
  speechStartTime?: number | null;
  speechWords?: WorkspaceSegmentTimelineWord[] | null;
  startTime?: number | null;
  text?: string | null;
};

export const WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS = 1;
const WORKSPACE_SEGMENT_TIMELINE_ESTIMATED_DURATION_FLOOR_SECONDS = 1.8;
const WORKSPACE_SEGMENT_TIMELINE_SECONDS_PER_WORD = 0.34;
const WORKSPACE_SEGMENT_TIMELINE_EPSILON = 1e-6;

export const roundWorkspaceSegmentTimelineSeconds = (value: number) => Number(value.toFixed(3));

const normalizeWorkspaceSegmentTimelineTimeValue = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
};

export const normalizeWorkspaceSegmentManualDurationSeconds = (value: unknown) => {
  const normalizedValue = normalizeWorkspaceSegmentTimelineTimeValue(value);
  return normalizedValue !== null && normalizedValue >= WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS
    ? normalizedValue
    : null;
};

const tokenizeWorkspaceSegmentTimelineText = (value: string) =>
  value
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

const areTimelineNumbersEqual = (left: number | null, right: number | null) =>
  left !== null && right !== null && Math.abs(left - right) <= WORKSPACE_SEGMENT_TIMELINE_EPSILON;

export const getWorkspaceSegmentEditorDisplayStartTime = <T extends WorkspaceSegmentTimelineSegment>(segment: T) => {
  const speechWords = Array.isArray(segment.speechWords) ? segment.speechWords : [];
  return (
    normalizeWorkspaceSegmentTimelineTimeValue(segment.startTime) ??
    normalizeWorkspaceSegmentTimelineTimeValue(segment.speechStartTime) ??
    normalizeWorkspaceSegmentTimelineTimeValue(speechWords[0]?.startTime) ??
    0
  );
};

export const getWorkspaceSegmentEditorDisplayEndTime = <T extends WorkspaceSegmentTimelineSegment>(segment: T) => {
  const speechWords = Array.isArray(segment.speechWords) ? segment.speechWords : [];
  return (
    normalizeWorkspaceSegmentTimelineTimeValue(segment.endTime) ??
    normalizeWorkspaceSegmentTimelineTimeValue(segment.speechEndTime) ??
    normalizeWorkspaceSegmentTimelineTimeValue(speechWords[speechWords.length - 1]?.endTime) ??
    getWorkspaceSegmentEditorDisplayStartTime(segment)
  );
};

export const getWorkspaceSegmentEditorSpeechDuration = <T extends WorkspaceSegmentTimelineSegment>(segment: T) => {
  const speechWords = Array.isArray(segment.speechWords) ? segment.speechWords : [];
  const speechStart =
    normalizeWorkspaceSegmentTimelineTimeValue(segment.speechStartTime) ??
    normalizeWorkspaceSegmentTimelineTimeValue(speechWords[0]?.startTime);
  const speechEnd =
    normalizeWorkspaceSegmentTimelineTimeValue(segment.speechEndTime) ??
    normalizeWorkspaceSegmentTimelineTimeValue(speechWords[speechWords.length - 1]?.endTime);
  const speechTimelineDuration =
    speechStart !== null && speechEnd !== null && speechEnd > speechStart ? speechEnd - speechStart : null;

  return (
    (typeof segment.speechDuration === "number" && Number.isFinite(segment.speechDuration) && segment.speechDuration > 0
      ? segment.speechDuration
      : null) ?? speechTimelineDuration
  );
};

export const getWorkspaceSegmentEditorPlaybackDuration = <T extends WorkspaceSegmentTimelineSegment>(
  segment: T,
  fallbackWordCount?: number,
  options?: {
    preferEstimatedDuration?: boolean;
  },
) => {
  const resolvedWordCount = Math.max(
    1,
    fallbackWordCount ?? tokenizeWorkspaceSegmentTimelineText(String(segment.text ?? "")).length,
  );
  const estimatedDurationFloor = Math.max(
    WORKSPACE_SEGMENT_TIMELINE_ESTIMATED_DURATION_FLOOR_SECONDS,
    resolvedWordCount * WORKSPACE_SEGMENT_TIMELINE_SECONDS_PER_WORD,
  );
  const speechWords = Array.isArray(segment.speechWords) ? segment.speechWords : [];
  const speechStart =
    normalizeWorkspaceSegmentTimelineTimeValue(segment.speechStartTime) ??
    normalizeWorkspaceSegmentTimelineTimeValue(speechWords[0]?.startTime);
  const speechEnd =
    normalizeWorkspaceSegmentTimelineTimeValue(segment.speechEndTime) ??
    normalizeWorkspaceSegmentTimelineTimeValue(speechWords[speechWords.length - 1]?.endTime);
  const speechTimelineDuration =
    speechStart !== null && speechEnd !== null && speechEnd > speechStart ? speechEnd - speechStart : null;
  const timelineDuration = getWorkspaceSegmentEditorDisplayEndTime(segment) - getWorkspaceSegmentEditorDisplayStartTime(segment);
  const candidates = [
    typeof segment.speechDuration === "number" && Number.isFinite(segment.speechDuration) && segment.speechDuration > 0
      ? segment.speechDuration
      : null,
    speechTimelineDuration,
    options?.preferEstimatedDuration
      ? null
      : typeof segment.duration === "number" && Number.isFinite(segment.duration) && segment.duration > 0
        ? segment.duration
        : null,
    options?.preferEstimatedDuration
      ? null
      : Number.isFinite(timelineDuration) && timelineDuration > 0
        ? timelineDuration
        : null,
    estimatedDurationFloor,
  ].filter((value): value is number => value !== null);

  return Math.max(...candidates);
};

export const resolveWorkspaceSegmentDuration = <T extends WorkspaceSegmentTimelineSegment>(
  segment: T,
  options?: {
    fallbackDuration?: number | null;
    preferEstimatedDuration?: boolean;
    stillNoTextFallbackDuration?: number | null;
    subtitleEnabled?: boolean;
    visualDurationSeconds?: number | null;
    visualKind?: "image" | "video" | null;
    voiceEnabled?: boolean;
  },
) => {
  const speechDuration = getWorkspaceSegmentEditorSpeechDuration(segment);
  const voiceEnabled = options?.voiceEnabled !== false;
  const voiceMinimumDuration = voiceEnabled && speechDuration !== null ? speechDuration : null;
  const minimumDuration = Math.max(
    WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS,
    voiceMinimumDuration ?? WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS,
  );
  const manualDuration = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
  const visualKind = options?.visualKind ?? (String(segment.mediaType ?? "").trim().toLowerCase() === "photo" ? "image" : null);
  const visualDuration = normalizeWorkspaceSegmentTimelineTimeValue(options?.visualDurationSeconds);

  if (segment.durationMode === "manual" && manualDuration !== null) {
    return Math.max(minimumDuration, manualDuration);
  }

  if (visualKind === "video" && visualDuration !== null && visualDuration > 0) {
    return Math.max(minimumDuration, visualDuration);
  }

  if (voiceEnabled && speechDuration !== null) {
    return Math.max(WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS, speechDuration);
  }

  if (options?.subtitleEnabled === false && visualKind === "image") {
    const fallbackDuration = normalizeWorkspaceSegmentTimelineTimeValue(options.fallbackDuration);
    const stillFallbackDuration = normalizeWorkspaceSegmentTimelineTimeValue(options.stillNoTextFallbackDuration);
    return Math.max(
      WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS,
      options.preferEstimatedDuration
        ? stillFallbackDuration ?? fallbackDuration ?? WORKSPACE_SEGMENT_TIMELINE_ESTIMATED_DURATION_FLOOR_SECONDS
        : fallbackDuration ?? stillFallbackDuration ?? WORKSPACE_SEGMENT_TIMELINE_ESTIMATED_DURATION_FLOOR_SECONDS,
    );
  }

  return Math.max(
    WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS,
    getWorkspaceSegmentEditorPlaybackDuration(segment, undefined, {
      preferEstimatedDuration: options?.preferEstimatedDuration ?? false,
    }),
  );
};

export const rebuildWorkspaceSegmentEditorTimeline = <T extends WorkspaceSegmentTimelineSegment>(
  segments: T[],
  options?: {
    preferEstimatedDuration?: (segment: T) => boolean;
    stillNoTextFallbackDuration?: number | null;
    subtitleEnabled?: boolean | ((segment: T) => boolean);
    visualDurationSeconds?: (segment: T) => number | null | undefined;
    visualKind?: (segment: T) => "image" | "video" | null | undefined;
    voiceEnabled?: boolean | ((segment: T) => boolean);
  },
) => {
  let cursor = 0;
  let hasChanges = false;

  const nextSegments = segments.map((segment) => {
    const voiceEnabled =
      typeof options?.voiceEnabled === "function" ? options.voiceEnabled(segment) : options?.voiceEnabled;
    const subtitleEnabled =
      typeof options?.subtitleEnabled === "function" ? options.subtitleEnabled(segment) : options?.subtitleEnabled;
    const duration = roundWorkspaceSegmentTimelineSeconds(resolveWorkspaceSegmentDuration(segment, {
      fallbackDuration: segment.duration,
      preferEstimatedDuration: options?.preferEstimatedDuration?.(segment) ?? false,
      stillNoTextFallbackDuration: options?.stillNoTextFallbackDuration,
      subtitleEnabled,
      visualDurationSeconds: options?.visualDurationSeconds?.(segment) ?? null,
      visualKind: options?.visualKind?.(segment) ?? null,
      voiceEnabled,
    }));
    const startTime = cursor;
    const endTime = roundWorkspaceSegmentTimelineSeconds(startTime + duration);
    cursor = endTime;

    const currentDuration = normalizeWorkspaceSegmentTimelineTimeValue(segment.duration);
    const currentStartTime = normalizeWorkspaceSegmentTimelineTimeValue(segment.startTime);
    const currentEndTime = normalizeWorkspaceSegmentTimelineTimeValue(segment.endTime);
    if (
      areTimelineNumbersEqual(currentDuration, duration) &&
      areTimelineNumbersEqual(currentStartTime, startTime) &&
      areTimelineNumbersEqual(currentEndTime, endTime)
    ) {
      return segment;
    }

    hasChanges = true;
    return {
      ...segment,
      duration,
      endTime,
      startTime,
    };
  });

  return hasChanges ? nextSegments : segments;
};
