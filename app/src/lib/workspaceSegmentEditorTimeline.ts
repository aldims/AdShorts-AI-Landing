export type WorkspaceSegmentTimelineWord = {
  endTime?: number | null;
  startTime?: number | null;
};

export type WorkspaceSegmentDurationMode = "auto" | "manual";

export type WorkspaceSegmentTimelineSegment = {
  duration?: number | null;
  durationMode?: WorkspaceSegmentDurationMode | null;
  durationSyncMode?: "voiceover" | "visual" | null;
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
const WORKSPACE_SEGMENT_TIMELINE_SECONDS_PER_INLINE_PAUSE = 0.55;
const WORKSPACE_SEGMENT_TIMELINE_SECONDS_PER_SENTENCE_PAUSE = 0.35;
const WORKSPACE_SEGMENT_TIMELINE_EPSILON = 1e-6;
const WORKSPACE_SEGMENT_TIMELINE_STALE_SPEECH_BOUNDARY_THRESHOLD_SECONDS = 0.35;

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

export const estimateWorkspaceSegmentEditorSpeechDuration = (
  text: string | null | undefined,
  fallbackWordCount?: number,
) => {
  const normalizedText = String(text ?? "");
  const resolvedWordCount = Math.max(
    1,
    fallbackWordCount ?? tokenizeWorkspaceSegmentTimelineText(normalizedText).length,
  );
  const inlinePauseCount = normalizedText.match(/[,;:]/g)?.length ?? 0;
  const sentencePauseCount = normalizedText.match(/[.!?…]+/g)?.length ?? 0;
  const punctuationPauseSeconds =
    inlinePauseCount * WORKSPACE_SEGMENT_TIMELINE_SECONDS_PER_INLINE_PAUSE +
    sentencePauseCount * WORKSPACE_SEGMENT_TIMELINE_SECONDS_PER_SENTENCE_PAUSE;

  return roundWorkspaceSegmentTimelineSeconds(
    Math.max(
      WORKSPACE_SEGMENT_TIMELINE_ESTIMATED_DURATION_FLOOR_SECONDS,
      resolvedWordCount * WORKSPACE_SEGMENT_TIMELINE_SECONDS_PER_WORD + punctuationPauseSeconds,
    ),
  );
};

const areTimelineNumbersEqual = (left: number | null, right: number | null) =>
  left !== null && right !== null && Math.abs(left - right) <= WORKSPACE_SEGMENT_TIMELINE_EPSILON;

const getWorkspaceSegmentTimelineSpeechWordsRange = <T extends WorkspaceSegmentTimelineSegment>(segment: T) => {
  const speechWords = Array.isArray(segment.speechWords) ? segment.speechWords : [];
  const firstSpeechWord = speechWords[0] ?? null;
  const lastSpeechWord = speechWords[speechWords.length - 1] ?? null;
  const startTime = normalizeWorkspaceSegmentTimelineTimeValue(firstSpeechWord?.startTime);
  const endTime = normalizeWorkspaceSegmentTimelineTimeValue(lastSpeechWord?.endTime);
  if (startTime === null || endTime === null || endTime <= startTime) {
    return null;
  }

  return { endTime, startTime };
};

export const getWorkspaceSegmentTimelineSpeechRange = <T extends WorkspaceSegmentTimelineSegment>(segment: T) => {
  const speechWordsRange = getWorkspaceSegmentTimelineSpeechWordsRange(segment);
  const speechStartTime = normalizeWorkspaceSegmentTimelineTimeValue(segment.speechStartTime);
  const speechEndTime = normalizeWorkspaceSegmentTimelineTimeValue(segment.speechEndTime);
  const hasStaleSpeechBoundary =
    speechWordsRange !== null &&
    speechStartTime !== null &&
    Math.abs(speechStartTime - speechWordsRange.startTime) >
      WORKSPACE_SEGMENT_TIMELINE_STALE_SPEECH_BOUNDARY_THRESHOLD_SECONDS;
  if (hasStaleSpeechBoundary) {
    return speechWordsRange;
  }

  const speechDuration =
    typeof segment.speechDuration === "number" && Number.isFinite(segment.speechDuration) && segment.speechDuration > 0
      ? segment.speechDuration
      : null;
  const startTimeCandidates = [speechStartTime, speechWordsRange?.startTime].filter(
    (value): value is number => value !== null && typeof value !== "undefined",
  );
  const startTime = startTimeCandidates.length > 0 ? Math.min(...startTimeCandidates) : null;
  const endTimeCandidates = [speechEndTime, speechWordsRange?.endTime].filter(
    (value): value is number => value !== null && typeof value !== "undefined",
  );
  if (startTime !== null && speechDuration !== null) {
    endTimeCandidates.push(startTime + speechDuration);
  }
  const endTime = endTimeCandidates.length > 0 ? Math.max(...endTimeCandidates) : null;
  if (startTime === null || endTime === null || endTime <= startTime) {
    return null;
  }

  return {
    endTime: roundWorkspaceSegmentTimelineSeconds(endTime),
    startTime: roundWorkspaceSegmentTimelineSeconds(startTime),
  };
};

export const resolveWorkspaceSegmentTimelineSpeechBoundaryTime = <T extends WorkspaceSegmentTimelineSegment>(
  previousSegment: T,
  nextSegment: T,
) => {
  const previousSpeechRange = getWorkspaceSegmentTimelineSpeechRange(previousSegment);
  const nextSpeechRange = getWorkspaceSegmentTimelineSpeechRange(nextSegment);
  if (
    previousSpeechRange === null ||
    nextSpeechRange === null ||
    nextSpeechRange.startTime <= previousSpeechRange.endTime + WORKSPACE_SEGMENT_TIMELINE_EPSILON
  ) {
    return null;
  }

  return roundWorkspaceSegmentTimelineSeconds(
    previousSpeechRange.endTime + (nextSpeechRange.startTime - previousSpeechRange.endTime) / 2,
  );
};

export const getWorkspaceSegmentEditorDisplayStartTime = <T extends WorkspaceSegmentTimelineSegment>(segment: T) => {
  const speechRange = getWorkspaceSegmentTimelineSpeechRange(segment);
  return (
    normalizeWorkspaceSegmentTimelineTimeValue(segment.startTime) ??
    speechRange?.startTime ??
    0
  );
};

export const getWorkspaceSegmentEditorDisplayEndTime = <T extends WorkspaceSegmentTimelineSegment>(segment: T) => {
  const speechRange = getWorkspaceSegmentTimelineSpeechRange(segment);
  return (
    normalizeWorkspaceSegmentTimelineTimeValue(segment.endTime) ??
    speechRange?.endTime ??
    getWorkspaceSegmentEditorDisplayStartTime(segment)
  );
};

export const getWorkspaceSegmentEditorSpeechDuration = <T extends WorkspaceSegmentTimelineSegment>(segment: T) => {
  const speechRange = getWorkspaceSegmentTimelineSpeechRange(segment);
  const speechTimelineDuration =
    speechRange !== null && speechRange.endTime > speechRange.startTime ? speechRange.endTime - speechRange.startTime : null;
  const explicitSpeechDuration =
    typeof segment.speechDuration === "number" && Number.isFinite(segment.speechDuration) && segment.speechDuration > 0
      ? segment.speechDuration
      : null;
  const candidates = [explicitSpeechDuration, speechTimelineDuration].filter((value): value is number => value !== null);

  return candidates.length > 0 ? Math.max(...candidates) : null;
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
  const estimatedDurationFloor = estimateWorkspaceSegmentEditorSpeechDuration(segment.text, resolvedWordCount);
  const speechRange = getWorkspaceSegmentTimelineSpeechRange(segment);
  const speechTimelineDuration =
    speechRange !== null && speechRange.endTime > speechRange.startTime ? speechRange.endTime - speechRange.startTime : null;
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
    preserveExistingStillDuration?: boolean;
    stillNoTextFallbackDuration?: number | null;
    subtitleEnabled?: boolean;
    visualDurationSeconds?: number | null;
    visualKind?: "image" | "video" | null;
    voiceDurationSeconds?: number | null;
    voiceEnabled?: boolean;
  },
) => {
  const speechDuration = getWorkspaceSegmentEditorSpeechDuration(segment);
  const voiceEnabled = options?.voiceEnabled !== false;
  const explicitVoiceDuration = normalizeWorkspaceSegmentManualDurationSeconds(options?.voiceDurationSeconds);
  const voiceDurationCandidates = voiceEnabled
    ? [speechDuration, explicitVoiceDuration].filter((value): value is number => value !== null)
    : [];
  const voiceDuration = voiceDurationCandidates.length > 0 ? Math.max(...voiceDurationCandidates) : null;
  const voiceMinimumDuration = voiceDuration !== null ? voiceDuration : null;
  const minimumDuration = Math.max(
    WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS,
    voiceMinimumDuration ?? WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS,
  );
  const manualDuration = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
  const visualKind = options?.visualKind ?? (String(segment.mediaType ?? "").trim().toLowerCase() === "photo" ? "image" : null);
  const visualDuration = normalizeWorkspaceSegmentTimelineTimeValue(options?.visualDurationSeconds);
  const durationSyncMode = String(segment.durationSyncMode ?? "").trim().toLowerCase();
  const shouldSyncVideoToVoiceover = visualKind === "video" && durationSyncMode === "voiceover";
  const timelineDuration =
    getWorkspaceSegmentEditorDisplayEndTime(segment) - getWorkspaceSegmentEditorDisplayStartTime(segment);
  const existingStillDuration =
    visualKind === "image"
      ? normalizeWorkspaceSegmentManualDurationSeconds(timelineDuration) ??
        normalizeWorkspaceSegmentManualDurationSeconds(visualDuration) ??
        normalizeWorkspaceSegmentManualDurationSeconds(segment.duration) ??
        normalizeWorkspaceSegmentManualDurationSeconds(options?.fallbackDuration)
      : null;

  if (segment.durationMode === "manual" && manualDuration !== null) {
    return Math.max(
      minimumDuration,
      manualDuration,
      options?.preserveExistingStillDuration && existingStillDuration !== null ? existingStillDuration : 0,
    );
  }

  if (shouldSyncVideoToVoiceover && voiceDuration !== null) {
    return Math.max(WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS, voiceDuration);
  }

  if (visualKind === "video" && visualDuration !== null && visualDuration > 0) {
    return Math.max(minimumDuration, visualDuration);
  }

  if (voiceDuration !== null) {
    if (options?.preserveExistingStillDuration && existingStillDuration !== null) {
      return Math.max(
        WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS,
        voiceDuration,
        existingStillDuration,
      );
    }

    return Math.max(WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS, voiceDuration);
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
    voiceDurationSeconds?: (segment: T) => number | null | undefined;
    voiceEnabled?: boolean | ((segment: T) => boolean);
    speechBoundaryEnabled?: boolean | ((previousSegment: T, nextSegment: T) => boolean);
    preserveSourceTimelineEnd?: boolean;
    preserveExistingStillDurations?: boolean | ((segment: T) => boolean);
  },
) => {
  let cursor = 0;
  let hasChanges = false;

  const nextSegments = segments.map((segment) => {
    const voiceEnabled =
      typeof options?.voiceEnabled === "function" ? options.voiceEnabled(segment) : options?.voiceEnabled;
    const subtitleEnabled =
      typeof options?.subtitleEnabled === "function" ? options.subtitleEnabled(segment) : options?.subtitleEnabled;
    const preserveExistingStillDuration =
      typeof options?.preserveExistingStillDurations === "function"
        ? options.preserveExistingStillDurations(segment)
        : options?.preserveExistingStillDurations;
    const duration = roundWorkspaceSegmentTimelineSeconds(resolveWorkspaceSegmentDuration(segment, {
      fallbackDuration: segment.duration,
      preferEstimatedDuration: options?.preferEstimatedDuration?.(segment) ?? false,
      preserveExistingStillDuration: preserveExistingStillDuration ?? false,
      stillNoTextFallbackDuration: options?.stillNoTextFallbackDuration,
      subtitleEnabled,
      visualDurationSeconds: options?.visualDurationSeconds?.(segment) ?? null,
      visualKind: options?.visualKind?.(segment) ?? null,
      voiceDurationSeconds: options?.voiceDurationSeconds?.(segment) ?? null,
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

  if (options?.speechBoundaryEnabled && nextSegments.length > 1) {
    const boundaries: number[] = [0];
    for (let index = 0; index < nextSegments.length - 1; index += 1) {
      const previousSegment = segments[index];
      const nextSegment = segments[index + 1];
      const rebuiltBoundary = normalizeWorkspaceSegmentTimelineTimeValue(nextSegments[index]?.endTime);
      const boundaryEnabled =
        typeof options.speechBoundaryEnabled === "function"
          ? previousSegment !== undefined &&
            nextSegment !== undefined &&
            options.speechBoundaryEnabled(previousSegment, nextSegment)
          : options.speechBoundaryEnabled;
      const hasManualDurationBoundary = [nextSegments[index], nextSegments[index + 1]].some(
        (segment) =>
          segment?.durationMode === "manual" &&
          normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds) !== null,
      );
      const speechBoundary =
        boundaryEnabled && !hasManualDurationBoundary && previousSegment !== undefined && nextSegment !== undefined
          ? resolveWorkspaceSegmentTimelineSpeechBoundaryTime(previousSegment, nextSegment)
          : null;
      boundaries.push(speechBoundary ?? rebuiltBoundary ?? boundaries[boundaries.length - 1] ?? 0);
    }

    const lastSourceSegment = segments[segments.length - 1];
    const lastRebuiltSegment = nextSegments[nextSegments.length - 1];
    const lastSpeechRange = lastSourceSegment ? getWorkspaceSegmentTimelineSpeechRange(lastSourceSegment) : null;
    const rebuiltTimelineEnd = normalizeWorkspaceSegmentTimelineTimeValue(lastRebuiltSegment?.endTime) ?? cursor;
    const sourceTimelineEnd =
      options.preserveSourceTimelineEnd && lastSourceSegment
        ? normalizeWorkspaceSegmentTimelineTimeValue(lastSourceSegment.endTime) ??
          getWorkspaceSegmentEditorDisplayEndTime(lastSourceSegment)
        : null;
    boundaries.push(
      roundWorkspaceSegmentTimelineSeconds(
        Math.max(rebuiltTimelineEnd, sourceTimelineEnd ?? 0, lastSpeechRange?.endTime ?? 0),
      ),
    );

    const hasValidBoundaryOrder = boundaries.every(
      (boundary, index) =>
        Number.isFinite(boundary) &&
        boundary >= 0 &&
        (index === 0 || boundary > boundaries[index - 1] + WORKSPACE_SEGMENT_TIMELINE_EPSILON),
    );
    if (hasValidBoundaryOrder) {
      const boundarySegments = nextSegments.map((segment, index) => {
        const startTime = roundWorkspaceSegmentTimelineSeconds(boundaries[index] ?? 0);
        const endTime = roundWorkspaceSegmentTimelineSeconds(boundaries[index + 1] ?? startTime);
        const duration = roundWorkspaceSegmentTimelineSeconds(Math.max(0, endTime - startTime));
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

      return hasChanges ? boundarySegments : segments;
    }
  }

  return hasChanges ? nextSegments : segments;
};
