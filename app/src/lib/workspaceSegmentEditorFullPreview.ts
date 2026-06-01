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

export type WorkspaceSegmentEditorFullPreviewVolumeEnvelopeTrack = {
  loop?: boolean;
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

export type WorkspaceSegmentEditorFullPreviewAudioPlaybackStartOptions = {
  currentSourceTime: number;
  expectedSourceTime: number;
  isEnded: boolean;
  isPaused: boolean;
  isPlaying: boolean;
  isSeeking: boolean;
  leadToleranceSeconds: number;
  minimumProgressSeconds: number;
  minimumReadyState: number;
  readyState: number;
  syncToleranceSeconds: number;
};

export type WorkspaceSegmentEditorFullPreviewAudioClockTrack = {
  sourceKind: "isolated" | "timeline";
  sourceStartTime: number;
  timelineEndTime: number;
  timelineStartTime: number;
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

const clampWorkspaceSegmentEditorFullPreviewUnitValue = (value: number) =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export const getWorkspaceSegmentEditorFullPreviewAudioFadeMultiplier = (
  track: WorkspaceSegmentEditorFullPreviewVolumeEnvelopeTrack,
  currentTime: number,
  options?: {
    fadeInSeconds?: number;
    fadeOutSeconds?: number;
    fadeSeconds?: number;
  },
) => {
  const timelineStartTime = normalizePreviewTime(track.timelineStartTime) ?? 0;
  const timelineEndTime = Math.max(
    timelineStartTime,
    normalizePreviewTime(track.timelineEndTime) ?? timelineStartTime,
  );
  const safeCurrentTime = normalizePreviewTime(currentTime);
  if (safeCurrentTime === null || safeCurrentTime < timelineStartTime || safeCurrentTime >= timelineEndTime) {
    return 0;
  }

  const duration = timelineEndTime - timelineStartTime;
  const requestedFadeSeconds = normalizePreviewTime(options?.fadeSeconds) ?? 0;
  const requestedFadeInSeconds = normalizePreviewTime(options?.fadeInSeconds) ?? requestedFadeSeconds;
  const requestedFadeOutSeconds = normalizePreviewTime(options?.fadeOutSeconds) ?? requestedFadeSeconds;
  const fadeInSeconds = Math.min(requestedFadeInSeconds, duration / 2);
  const fadeOutSeconds = Math.min(requestedFadeOutSeconds, duration / 2);
  if (track.loop || (fadeInSeconds <= 0 && fadeOutSeconds <= 0)) {
    return 1;
  }

  const fadeIn =
    fadeInSeconds > 0
      ? clampWorkspaceSegmentEditorFullPreviewUnitValue(
          (safeCurrentTime - timelineStartTime) / fadeInSeconds,
        )
      : 1;
  const fadeOut =
    fadeOutSeconds > 0
      ? clampWorkspaceSegmentEditorFullPreviewUnitValue(
          (timelineEndTime - safeCurrentTime) / fadeOutSeconds,
        )
      : 1;
  return Math.min(fadeIn, fadeOut);
};

export const getWorkspaceSegmentEditorFullPreviewVoiceDuckingStrength = <
  Track extends WorkspaceSegmentEditorFullPreviewAudibleAudioTrack,
>(
  tracks: Track[],
  currentTime: number,
  options?: {
    attackSeconds?: number;
    releaseSeconds?: number;
  },
) => {
  const safeCurrentTime = normalizePreviewTime(currentTime) ?? 0;
  const attackSeconds = normalizePreviewTime(options?.attackSeconds) ?? 0;
  const releaseSeconds = normalizePreviewTime(options?.releaseSeconds) ?? 0;

  return tracks.reduce((strength, track) => {
    if (track.kind !== "voice" && track.kind !== "embedded_voice") {
      return strength;
    }

    const timelineStartTime = normalizePreviewTime(track.timelineStartTime);
    const timelineEndTime = normalizePreviewTime(track.timelineEndTime);
    if (timelineStartTime === null || timelineEndTime === null || timelineEndTime <= timelineStartTime) {
      return strength;
    }

    let trackStrength = 0;
    if (safeCurrentTime >= timelineStartTime && safeCurrentTime < timelineEndTime) {
      trackStrength = 1;
    } else if (
      attackSeconds > 0 &&
      safeCurrentTime >= timelineStartTime - attackSeconds &&
      safeCurrentTime < timelineStartTime
    ) {
      trackStrength = 1 - (timelineStartTime - safeCurrentTime) / attackSeconds;
    } else if (
      releaseSeconds > 0 &&
      safeCurrentTime >= timelineEndTime &&
      safeCurrentTime < timelineEndTime + releaseSeconds
    ) {
      trackStrength = 1 - (safeCurrentTime - timelineEndTime) / releaseSeconds;
    }

    return Math.max(strength, clampWorkspaceSegmentEditorFullPreviewUnitValue(trackStrength));
  }, 0);
};

export const getWorkspaceSegmentEditorFullPreviewDuckedVolume = (options: {
  baseVolume: number;
  duckedVolume: number;
  duckingStrength: number;
}) => {
  const baseVolume = Math.max(0, Number.isFinite(options.baseVolume) ? options.baseVolume : 0);
  const duckedVolume = Math.max(0, Number.isFinite(options.duckedVolume) ? options.duckedVolume : 0);
  const duckingStrength = clampWorkspaceSegmentEditorFullPreviewUnitValue(options.duckingStrength);
  return baseVolume + (duckedVolume - baseVolume) * duckingStrength;
};

export const resolveWorkspaceSegmentEditorFullPreviewIsolatedVoiceTimelineEndTime = (options: {
  timelineEndTime: number;
  timelineStartTime: number;
  voiceDurationSeconds?: number | null;
}) => {
  const timelineStartTime = normalizePreviewTime(options.timelineStartTime) ?? 0;
  const timelineEndTime = Math.max(
    timelineStartTime,
    normalizePreviewTime(options.timelineEndTime) ?? timelineStartTime,
  );
  const voiceDurationSeconds = normalizePreviewTime(options.voiceDurationSeconds);
  if (voiceDurationSeconds === null || voiceDurationSeconds <= 0) {
    return timelineEndTime;
  }

  return timelineStartTime + voiceDurationSeconds;
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

export const selectWorkspaceSegmentEditorFullPreviewRequiredAudioTracksForStart = <
  Track extends WorkspaceSegmentEditorFullPreviewAudibleAudioTrack,
>(
  _tracks: Track[],
  activeTracks: Track[],
  _currentTime: number,
): Track[] => activeTracks;

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

export const selectWorkspaceSegmentEditorFullPreviewAudibleTracksForVoiceStart = <
  Track extends WorkspaceSegmentEditorFullPreviewAudibleAudioTrack,
>(
  activeTracks: Track[],
  hasPendingVoiceStart: boolean,
): Track[] => {
  if (!hasPendingVoiceStart) {
    return activeTracks;
  }

  return activeTracks.filter(
    (track) => track.kind === "music" || track.kind === "voice" || track.kind === "embedded_voice",
  );
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

export const isWorkspaceSegmentEditorFullPreviewAudioPlaybackStartConfirmed = (
  options: WorkspaceSegmentEditorFullPreviewAudioPlaybackStartOptions,
) => {
  if (
    !options.isPlaying ||
    options.isPaused ||
    options.isEnded ||
    options.isSeeking ||
    options.readyState < options.minimumReadyState ||
    !Number.isFinite(options.currentSourceTime) ||
    !Number.isFinite(options.expectedSourceTime)
  ) {
    return false;
  }

  const currentSourceTime = Math.max(0, options.currentSourceTime);
  const expectedSourceTime = Math.max(0, options.expectedSourceTime);
  const syncToleranceSeconds = normalizePreviewTime(options.syncToleranceSeconds) ?? 0;
  const leadToleranceSeconds = normalizePreviewTime(options.leadToleranceSeconds) ?? 0;
  const minimumProgressSeconds = normalizePreviewTime(options.minimumProgressSeconds) ?? 0;

  if (currentSourceTime + syncToleranceSeconds < expectedSourceTime) {
    return false;
  }

  if (currentSourceTime - expectedSourceTime > leadToleranceSeconds) {
    return false;
  }

  return currentSourceTime >= expectedSourceTime + minimumProgressSeconds;
};

export const isWorkspaceSegmentEditorFullPreviewAudioReadyState = (
  readyState: number,
  minimumReadyState: number,
) =>
  Number.isFinite(readyState) &&
  Number.isFinite(minimumReadyState) &&
  readyState >= Math.max(0, minimumReadyState);

export const getWorkspaceSegmentEditorFullPreviewTimelineTimeFromAudioSourceTime = (
  track: WorkspaceSegmentEditorFullPreviewAudioClockTrack,
  sourceTime: number,
) => {
  const normalizedSourceTime = normalizePreviewTime(sourceTime);
  if (normalizedSourceTime === null) {
    return null;
  }

  const timelineStartTime = normalizePreviewTime(track.timelineStartTime) ?? 0;
  const timelineEndTime = Math.max(
    timelineStartTime,
    normalizePreviewTime(track.timelineEndTime) ?? timelineStartTime,
  );
  const sourceStartTime = normalizePreviewTime(track.sourceStartTime) ?? 0;
  const elapsedSourceTime =
    track.sourceKind === "timeline"
      ? Math.max(0, normalizedSourceTime - sourceStartTime)
      : normalizedSourceTime;

  return Math.min(timelineEndTime, Math.max(timelineStartTime, timelineStartTime + elapsedSourceTime));
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
