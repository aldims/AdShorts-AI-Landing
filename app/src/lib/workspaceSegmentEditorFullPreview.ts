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

export type WorkspaceSegmentEditorFullPreviewAudioTimelineRange = {
  endTime: number;
  sourceStartTime?: number | null;
  startTime: number;
  url: string;
};

export type WorkspaceSegmentEditorFullPreviewAudioStartGateTrack = {
  key: string;
  kind: string;
  timelineEndTime: number;
  timelineStartTime: number;
};

export type WorkspaceSegmentEditorFullPreviewAudioStartGate = {
  holdTime: number;
  trackKey: string;
};

export type WorkspaceSegmentEditorFullPreviewAudibleAudioTrack = {
  key: string;
  kind: string;
  timelineEndTime: number;
  timelineStartTime: number;
};

export type WorkspaceSegmentEditorFullPreviewAudioSeekSyncOptions = {
  audioSeekToleranceSeconds: number;
  currentSourceTime: number;
  isPaused: boolean;
  isVoiceTrack: boolean;
  musicSeekToleranceSeconds: number;
  nextSourceTime: number;
  trackKind: string;
  voicePausedSeekToleranceSeconds: number;
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

export const getWorkspaceSegmentEditorFullPreviewPlaybackEndTime = (
  visualDuration: number,
  tracks: WorkspaceSegmentEditorFullPreviewAudibleAudioTrack[],
  options?: {
    finalVoiceGraceSeconds?: number;
  },
) => {
  const safeVisualDuration = normalizePreviewTime(visualDuration) ?? 0;
  const finalVoiceGraceSeconds = normalizePreviewTime(options?.finalVoiceGraceSeconds) ?? 0;
  const audioEndTime = Math.max(
    safeVisualDuration,
    ...tracks.map((track) => {
      if (track.kind === "voice" || track.kind === "embedded_voice") {
        return (normalizePreviewTime(track.timelineEndTime) ?? 0) + finalVoiceGraceSeconds;
      }

      return 0;
    }),
  );

  return Math.max(safeVisualDuration, audioEndTime);
};

export const mergeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges = (
  ranges: WorkspaceSegmentEditorFullPreviewAudioTimelineRange[],
  joinToleranceSeconds = 0.05,
): WorkspaceSegmentEditorFullPreviewAudioTimelineRange[] => {
  const tolerance = normalizePreviewTime(joinToleranceSeconds) ?? 0;
  const normalizedRanges = ranges
    .flatMap((range): Array<WorkspaceSegmentEditorFullPreviewAudioTimelineRange & { sourceStartTime: number }> => {
      const startTime = normalizePreviewTime(range.startTime);
      const endTime = normalizePreviewTime(range.endTime);
      const sourceStartTime = normalizePreviewTime(range.sourceStartTime) ?? startTime;
      const url = range.url.trim();

      return startTime !== null && endTime !== null && endTime > startTime && url
        ? [{ endTime, sourceStartTime: sourceStartTime ?? startTime, startTime, url }]
        : [];
    })
    .sort((left, right) => left.startTime - right.startTime || left.endTime - right.endTime);

  const mergedRanges: Array<WorkspaceSegmentEditorFullPreviewAudioTimelineRange & { sourceStartTime: number }> = [];
  normalizedRanges.forEach((range) => {
    const previousRange = mergedRanges[mergedRanges.length - 1];
    const previousSourceEndTime = previousRange
      ? previousRange.sourceStartTime + Math.max(0, previousRange.endTime - previousRange.startTime)
      : null;
    const previousSourceOffset = previousRange ? previousRange.sourceStartTime - previousRange.startTime : null;
    const nextSourceOffset = range.sourceStartTime - range.startTime;
    if (
      previousRange &&
      previousRange.url === range.url &&
      previousSourceEndTime !== null &&
      range.startTime <= previousRange.endTime + tolerance &&
      range.sourceStartTime <= previousSourceEndTime + tolerance &&
      previousSourceOffset !== null &&
      Math.abs(previousSourceOffset - nextSourceOffset) <= tolerance
    ) {
      previousRange.endTime = Math.max(previousRange.endTime, range.endTime);
      return;
    }

    mergedRanges.push({ ...range });
  });

  return mergedRanges;
};

export const resolveWorkspaceSegmentEditorFullPreviewAudioStartGate = (
  tracks: WorkspaceSegmentEditorFullPreviewAudioStartGateTrack[],
  currentTime: number,
  nextTime: number,
  isTrackStarted: (track: WorkspaceSegmentEditorFullPreviewAudioStartGateTrack) => boolean,
  options?: {
    startWindowSeconds?: number;
    timeToleranceSeconds?: number;
  },
): WorkspaceSegmentEditorFullPreviewAudioStartGate | null => {
  const safeCurrentTime = normalizePreviewTime(currentTime) ?? 0;
  const safeNextTime = normalizePreviewTime(nextTime) ?? safeCurrentTime;
  const startWindowSeconds = normalizePreviewTime(options?.startWindowSeconds) ?? 2;
  const tolerance = normalizePreviewTime(options?.timeToleranceSeconds) ?? 0.025;

  const candidateTracks = tracks
    .filter((track) => {
      if (track.kind !== "voice" && track.kind !== "embedded_voice") {
        return false;
      }

      const trackStartTime = normalizePreviewTime(track.timelineStartTime);
      const trackEndTime = normalizePreviewTime(track.timelineEndTime);
      if (trackStartTime === null || trackEndTime === null || trackEndTime <= trackStartTime) {
        return false;
      }

      if (safeNextTime + tolerance < trackStartTime || safeCurrentTime > trackStartTime + startWindowSeconds) {
        return false;
      }

      return !isTrackStarted(track);
    })
    .sort((left, right) => left.timelineStartTime - right.timelineStartTime || left.key.localeCompare(right.key));

  const blockedTrack = candidateTracks[0] ?? null;
  if (!blockedTrack) {
    return null;
  }

  return {
    holdTime: normalizePreviewTime(blockedTrack.timelineStartTime) ?? 0,
    trackKey: blockedTrack.key,
  };
};

export const selectWorkspaceSegmentEditorFullPreviewAudibleAudioTracks = <
  Track extends WorkspaceSegmentEditorFullPreviewAudibleAudioTrack,
>(
  tracks: Track[],
): Track[] => {
  const nonVoiceTracks = tracks.filter((track) => track.kind !== "voice" && track.kind !== "embedded_voice");
  const voiceTracks = tracks.filter((track) => track.kind === "voice" || track.kind === "embedded_voice");
  if (voiceTracks.length <= 1) {
    return [...nonVoiceTracks, ...voiceTracks];
  }

  const selectedVoiceTrack = [...voiceTracks].sort(
    (left, right) =>
      right.timelineStartTime - left.timelineStartTime ||
      left.timelineEndTime - right.timelineEndTime ||
      left.key.localeCompare(right.key),
  )[0];

  return [
    ...nonVoiceTracks,
    selectedVoiceTrack,
  ];
};

export const resolveWorkspaceSegmentEditorFullPreviewAudioStartGateKeepAliveTracks = <
  Track extends WorkspaceSegmentEditorFullPreviewAudibleAudioTrack,
>(
  activeTracks: Track[],
  gateTrackKey: string,
): Track[] => {
  const selectedTracks = selectWorkspaceSegmentEditorFullPreviewAudibleAudioTracks(activeTracks);
  const selectedTrackByKey = new Map(selectedTracks.map((track) => [track.key, track]));
  const gateTrack = activeTracks.find((track) => track.key === gateTrackKey);
  if (gateTrack) {
    selectedTrackByKey.set(gateTrack.key, gateTrack);
  }

  return Array.from(selectedTrackByKey.values());
};

export const shouldSeekWorkspaceSegmentEditorFullPreviewAudioTrack = (
  options: WorkspaceSegmentEditorFullPreviewAudioSeekSyncOptions,
) => {
  if (!Number.isFinite(options.currentSourceTime) || !Number.isFinite(options.nextSourceTime)) {
    return false;
  }

  const driftSeconds = Math.abs(options.currentSourceTime - options.nextSourceTime);
  if (options.isVoiceTrack) {
    return options.isPaused && driftSeconds > options.voicePausedSeekToleranceSeconds;
  }

  const toleranceSeconds =
    options.trackKind === "music" ? options.musicSeekToleranceSeconds : options.audioSeekToleranceSeconds;
  return driftSeconds > toleranceSeconds;
};

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
