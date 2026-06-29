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
  kind?: string;
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
  voicePlayingSeekToleranceSeconds?: number;
};

export type WorkspaceSegmentEditorFullPreviewAudioStartGateSeekOptions = {
  currentSourceTime: number;
  expectedSourceTime: number;
  isPaused: boolean;
  syncToleranceSeconds: number;
};

export type WorkspaceSegmentEditorFullPreviewAudioStartGateHoldOptions = {
  gateHoldTime: number;
  runStartTime: number;
  toleranceSeconds: number;
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

export type WorkspaceSegmentEditorFullPreviewAudioPreparationResult = "ready" | "not-ready" | "unlock-required";

export type WorkspaceSegmentEditorFullPreviewRejectedAudioPreparationOptions = {
  activeTrackCount: number;
  isAudioUnlockRequired: boolean;
  rejectedPlayTrackCount: number;
};

export type WorkspaceSegmentEditorFullPreviewAudioClockTrack = {
  sourceKind: "isolated" | "timeline";
  sourceStartTime: number;
  timelineEndTime: number;
  timelineStartTime: number;
};

export type WorkspaceSegmentEditorFullPreviewVoiceQueueTrack = {
  key: string;
  kind: string;
  previewArrayIndex?: number | null;
  segmentIndex?: number | null;
  sourceKind?: string;
  sourceStartTime?: number | null;
  timelineEndTime: number;
  timelineStartTime: number;
  url?: string | null;
};

export type WorkspaceSegmentEditorFullPreviewSharedAudioSourceSegment = {
  assetKey?: string | null;
  durationSeconds?: number | null;
  segmentIndex: number;
};

export type WorkspaceSegmentEditorFullPreviewVoiceBoundarySegment = WorkspaceSegmentEditorFullPreviewSegment & {
  voiceBoundaryEndTime?: number | null;
  voiceBoundaryStartTime?: number | null;
};

const normalizePreviewTime = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
};

const roundPreviewTime = (value: number) => Number(value.toFixed(3));

const getWorkspaceSegmentEditorFullPreviewAudioSourceIdentityKey = (url: string | null | undefined) => {
  const trimmedUrl = String(url ?? "").trim();
  if (!trimmedUrl) {
    return "";
  }

  const hashIndex = trimmedUrl.indexOf("#");
  const withoutHash = hashIndex >= 0 ? trimmedUrl.slice(0, hashIndex) : trimmedUrl;
  const queryIndex = withoutHash.indexOf("?");
  return queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
};

export const resolveWorkspaceSegmentEditorFullPreviewSharedAudioSourceStartTimes = (
  segments: WorkspaceSegmentEditorFullPreviewSharedAudioSourceSegment[],
) => {
  const normalizedSegments = segments.map((segment) => ({
    assetKey: String(segment.assetKey ?? "").trim(),
    durationSeconds: normalizePreviewTime(segment.durationSeconds) ?? 0,
    segmentIndex: segment.segmentIndex,
  }));
  const assetUseCounts = normalizedSegments.reduce((counts, segment) => {
    if (!segment.assetKey) {
      return counts;
    }

    counts.set(segment.assetKey, (counts.get(segment.assetKey) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const cursorByAssetKey = new Map<string, number>();
  const startTimeBySegmentIndex = new Map<number, number>();

  normalizedSegments.forEach((segment) => {
    if (!segment.assetKey || (assetUseCounts.get(segment.assetKey) ?? 0) <= 1) {
      return;
    }

    const cursor = cursorByAssetKey.get(segment.assetKey) ?? 0;
    startTimeBySegmentIndex.set(segment.segmentIndex, roundPreviewTime(cursor));
    cursorByAssetKey.set(segment.assetKey, roundPreviewTime(cursor + segment.durationSeconds));
  });

  return startTimeBySegmentIndex;
};

export const resolveWorkspaceSegmentEditorFullPreviewProjectVoiceSourceStartTime = (options: {
  durationDerivedSourceStartTime?: number | null;
  explicitSourceStartTime?: number | null;
}) => {
  const normalizeOptionalSourceStartTime = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return null;
    }

    return normalizePreviewTime(value);
  };
  const explicitSourceStartTime = normalizeOptionalSourceStartTime(options.explicitSourceStartTime);
  if (explicitSourceStartTime !== null) {
    return roundPreviewTime(explicitSourceStartTime);
  }

  const durationDerivedSourceStartTime = normalizeOptionalSourceStartTime(options.durationDerivedSourceStartTime);
  return durationDerivedSourceStartTime !== null ? roundPreviewTime(durationDerivedSourceStartTime) : null;
};

export const resolveWorkspaceSegmentEditorFullPreviewProjectVoiceTimelineEndTime = (options: {
  timelineEndTime?: number | null;
  timelineStartTime: number;
  voiceDurationSeconds?: number | null;
}) => {
  const timelineStartTime = normalizePreviewTime(options.timelineStartTime) ?? 0;
  const voiceDurationSeconds = normalizePreviewTime(options.voiceDurationSeconds);
  if (voiceDurationSeconds === null || voiceDurationSeconds <= 0) {
    return null;
  }

  const timelineEndTime = normalizePreviewTime(options.timelineEndTime);
  const durationEndTime = timelineStartTime + voiceDurationSeconds;
  const resolvedEndTime = timelineEndTime !== null
    ? Math.min(timelineEndTime, durationEndTime)
    : durationEndTime;
  return resolvedEndTime > timelineStartTime ? roundPreviewTime(resolvedEndTime) : null;
};

export const resolveWorkspaceSegmentEditorFullPreviewProjectVoiceTrackTimelineEndTime = (options: {
  fallbackTimelineEndTimeCandidates: Array<number | null | undefined>;
  hasTimingData: boolean;
  timedTimelineEndTimeCandidates: Array<number | null | undefined>;
  timelineStartTime: number;
}) => {
  const timelineStartTime = normalizePreviewTime(options.timelineStartTime) ?? 0;
  const normalizeCandidates = (candidates: Array<number | null | undefined>) =>
    candidates
      .map((value) => normalizePreviewTime(value))
      .filter((value): value is number => value !== null && value > timelineStartTime);

  const timedCandidates = normalizeCandidates(options.timedTimelineEndTimeCandidates);
  if (options.hasTimingData && timedCandidates.length > 0) {
    return roundPreviewTime(Math.max(...timedCandidates));
  }

  const fallbackCandidates = normalizeCandidates(options.fallbackTimelineEndTimeCandidates);
  return fallbackCandidates.length > 0 ? roundPreviewTime(Math.max(...fallbackCandidates)) : null;
};

export const resolveWorkspaceSegmentEditorFullPreviewVoiceBoundarySegments = <
  Segment extends WorkspaceSegmentEditorFullPreviewVoiceBoundarySegment,
>(
  segments: Segment[],
  options?: {
    enabled?: boolean;
  },
): Segment[] => {
  if (options?.enabled === false) {
    return segments;
  }

  if (segments.length === 0) {
    return segments;
  }

  const normalizedSegments = segments.map((segment) => {
    const startTime = normalizePreviewTime(segment.startTime) ?? 0;
    const endTime = Math.max(startTime, normalizePreviewTime(segment.endTime) ?? startTime);
    const voiceBoundaryStartTime = normalizePreviewTime(segment.voiceBoundaryStartTime);
    const voiceBoundaryEndTime = normalizePreviewTime(segment.voiceBoundaryEndTime);

    return {
      endTime,
      segment,
      startTime,
      voiceBoundaryEndTime,
      voiceBoundaryStartTime,
    };
  });

  if (
    normalizedSegments.some(
      ({ voiceBoundaryEndTime, voiceBoundaryStartTime }) =>
        voiceBoundaryStartTime === null ||
        voiceBoundaryEndTime === null ||
        voiceBoundaryEndTime <= voiceBoundaryStartTime,
    )
  ) {
    return segments;
  }

  for (let index = 1; index < normalizedSegments.length; index += 1) {
    const previousStartTime = normalizedSegments[index - 1]?.voiceBoundaryStartTime;
    const nextStartTime = normalizedSegments[index]?.voiceBoundaryStartTime;
    if (
      previousStartTime === null ||
      nextStartTime === null ||
      nextStartTime < previousStartTime - 0.001
    ) {
      return segments;
    }
  }

  return normalizedSegments.map(({ segment, startTime: baseStartTime, voiceBoundaryEndTime, voiceBoundaryStartTime }, index) => {
    const resolvedStartTime =
      index === 0
        ? Math.min(baseStartTime, voiceBoundaryStartTime ?? baseStartTime)
        : voiceBoundaryStartTime ?? baseStartTime;
    const nextVoiceBoundaryStartTime = normalizedSegments[index + 1]?.voiceBoundaryStartTime ?? null;
    const resolvedEndTime =
      nextVoiceBoundaryStartTime !== null && nextVoiceBoundaryStartTime > resolvedStartTime
        ? nextVoiceBoundaryStartTime
        : Math.max(resolvedStartTime, voiceBoundaryEndTime ?? resolvedStartTime);

    if (resolvedEndTime <= resolvedStartTime) {
      return segment;
    }

    return {
      ...segment,
      endTime: roundPreviewTime(resolvedEndTime),
      startTime: roundPreviewTime(resolvedStartTime),
    };
  });
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

export const getWorkspaceSegmentEditorFullPreviewAudioFadeOptions = (
  track: Pick<WorkspaceSegmentEditorFullPreviewVolumeEnvelopeTrack, "kind">,
  fadeSeconds: number,
) => {
  const safeFadeSeconds = normalizePreviewTime(fadeSeconds) ?? 0;
  const isVoiceTrack = track.kind === "voice" || track.kind === "embedded_voice";
  return {
    fadeInSeconds: isVoiceTrack ? Math.min(0.025, safeFadeSeconds) : safeFadeSeconds,
    fadeOutSeconds: isVoiceTrack ? 0 : safeFadeSeconds,
  };
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

export const resolveWorkspaceSegmentEditorFullPreviewVoiceDurationSeconds = (options: {
  fallbackDurationSeconds?: number | null;
  measuredDurationSeconds?: number | null;
}) => {
  const measuredDurationSeconds = normalizePreviewTime(options.measuredDurationSeconds);
  const fallbackDurationSeconds = normalizePreviewTime(options.fallbackDurationSeconds);
  if (measuredDurationSeconds !== null && measuredDurationSeconds > 0) {
    return fallbackDurationSeconds !== null && fallbackDurationSeconds > 0
      ? Math.max(measuredDurationSeconds, fallbackDurationSeconds)
      : measuredDurationSeconds;
  }

  return fallbackDurationSeconds !== null && fallbackDurationSeconds > 0 ? fallbackDurationSeconds : null;
};

export const resolveWorkspaceSegmentEditorFullPreviewVoiceTrackQueue = <
  Track extends WorkspaceSegmentEditorFullPreviewVoiceQueueTrack,
>(
  tracks: Track[],
  options?: {
    overlapToleranceSeconds?: number;
    sourceBoundaryToleranceSeconds?: number;
  },
): Track[] => {
  const overlapToleranceSeconds = normalizePreviewTime(options?.overlapToleranceSeconds) ?? 0;
  const sourceBoundaryToleranceSeconds = normalizePreviewTime(options?.sourceBoundaryToleranceSeconds) ?? 0.001;
  const normalizedTracks = tracks
    .flatMap((track) => {
      const timelineStartTime = normalizePreviewTime(track.timelineStartTime);
      const timelineEndTime = normalizePreviewTime(track.timelineEndTime);
      if (timelineStartTime === null || timelineEndTime === null || timelineEndTime <= timelineStartTime) {
        return [];
      }

      return [
        {
          durationSeconds: timelineEndTime - timelineStartTime,
          sourceStartTime: normalizePreviewTime(track.sourceStartTime),
          track,
        },
      ];
    })
    .sort((left, right) => {
      if (left.track.timelineStartTime !== right.track.timelineStartTime) {
        return left.track.timelineStartTime - right.track.timelineStartTime;
      }

      return left.track.key.localeCompare(right.track.key);
    });

  const queuedTracks: Track[] = [];
  normalizedTracks.forEach(({ durationSeconds, sourceStartTime, track }, trackIndex) => {
    const nextSameSourceTrack = normalizedTracks
      .slice(trackIndex + 1)
      .find((candidate) => {
        if (
          track.sourceKind !== "timeline" ||
          candidate.track.sourceKind !== "timeline" ||
          !getWorkspaceSegmentEditorFullPreviewAudioSourceIdentityKey(track.url) ||
          getWorkspaceSegmentEditorFullPreviewAudioSourceIdentityKey(track.url) !==
            getWorkspaceSegmentEditorFullPreviewAudioSourceIdentityKey(candidate.track.url) ||
          sourceStartTime === null ||
          candidate.sourceStartTime === null
        ) {
          return false;
        }

        return candidate.sourceStartTime > sourceStartTime + sourceBoundaryToleranceSeconds;
      });
    const sourceLimitedDurationSeconds =
      nextSameSourceTrack && sourceStartTime !== null && nextSameSourceTrack.sourceStartTime !== null
        ? Math.max(0, nextSameSourceTrack.sourceStartTime - sourceStartTime)
        : durationSeconds;
    const safeDurationSeconds = Math.min(durationSeconds, sourceLimitedDurationSeconds);
    if (safeDurationSeconds <= 0) {
      return;
    }

    const previousTrack = queuedTracks[queuedTracks.length - 1] ?? null;
    const originalStartTime = normalizePreviewTime(track.timelineStartTime) ?? 0;
    const previousEndTime = previousTrack ? normalizePreviewTime(previousTrack.timelineEndTime) ?? 0 : 0;
    const nextStartTime =
      previousTrack && previousEndTime > originalStartTime + overlapToleranceSeconds
        ? previousEndTime
        : previousTrack && previousEndTime > originalStartTime
          ? previousEndTime
          : originalStartTime;
    queuedTracks.push({
      ...track,
      timelineEndTime: roundPreviewTime(nextStartTime + safeDurationSeconds),
      timelineStartTime: roundPreviewTime(nextStartTime),
    });
  });

  return queuedTracks;
};

export const mergeWorkspaceSegmentEditorFullPreviewContinuousVoiceTracks = <
  Track extends WorkspaceSegmentEditorFullPreviewVoiceQueueTrack,
>(
  tracks: Track[],
  options?: {
    joinToleranceSeconds?: number;
  },
): Track[] => {
  const joinToleranceSeconds = normalizePreviewTime(options?.joinToleranceSeconds) ?? 0.05;
  const mergedTracks: Track[] = [];

  tracks.forEach((track) => {
    const timelineStartTime = normalizePreviewTime(track.timelineStartTime);
    const timelineEndTime = normalizePreviewTime(track.timelineEndTime);
    const sourceStartTime = normalizePreviewTime(track.sourceStartTime);
    const sourceIdentityKey = getWorkspaceSegmentEditorFullPreviewAudioSourceIdentityKey(track.url);
    if (
      timelineStartTime === null ||
      timelineEndTime === null ||
      timelineEndTime <= timelineStartTime ||
      sourceStartTime === null ||
      track.sourceKind !== "timeline" ||
      !sourceIdentityKey
    ) {
      mergedTracks.push(track);
      return;
    }

    const previousTrack = mergedTracks[mergedTracks.length - 1] ?? null;
    const previousTimelineStartTime = normalizePreviewTime(previousTrack?.timelineStartTime);
    const previousTimelineEndTime = normalizePreviewTime(previousTrack?.timelineEndTime);
    const previousSourceStartTime = normalizePreviewTime(previousTrack?.sourceStartTime);
    const previousSourceIdentityKey = getWorkspaceSegmentEditorFullPreviewAudioSourceIdentityKey(previousTrack?.url);
    if (
      !previousTrack ||
      previousTrack.sourceKind !== "timeline" ||
      previousTimelineStartTime === null ||
      previousTimelineEndTime === null ||
      previousSourceStartTime === null ||
      previousSourceIdentityKey !== sourceIdentityKey
    ) {
      mergedTracks.push(track);
      return;
    }

    const previousSourceEndTime = previousSourceStartTime + (previousTimelineEndTime - previousTimelineStartTime);
    const previousSourceOffset = previousSourceStartTime - previousTimelineStartTime;
    const nextSourceOffset = sourceStartTime - timelineStartTime;
    const shouldMerge =
      timelineStartTime <= previousTimelineEndTime + joinToleranceSeconds &&
      sourceStartTime <= previousSourceEndTime + joinToleranceSeconds &&
      Math.abs(previousSourceOffset - nextSourceOffset) <= joinToleranceSeconds;
    if (!shouldMerge) {
      mergedTracks.push(track);
      return;
    }

    mergedTracks[mergedTracks.length - 1] = {
      ...previousTrack,
      timelineEndTime: roundPreviewTime(Math.max(previousTimelineEndTime, timelineEndTime)),
    };
  });

  return mergedTracks;
};

export const resolveWorkspaceSegmentEditorFullPreviewVoiceAlignedSegments = <
  Segment extends WorkspaceSegmentEditorFullPreviewSegment,
  Track extends WorkspaceSegmentEditorFullPreviewVoiceQueueTrack,
>(
  segments: Segment[],
  voiceTracks: Track[],
): Segment[] => {
  const requiredDurationByArrayIndex = new Map<number, number>();
  voiceTracks.forEach((track) => {
    const previewArrayIndex =
      typeof track.previewArrayIndex === "number" && Number.isInteger(track.previewArrayIndex)
        ? track.previewArrayIndex
        : typeof track.segmentIndex === "number"
          ? segments.findIndex((segment) => segment.index === track.segmentIndex)
          : -1;
    if (previewArrayIndex < 0 || previewArrayIndex >= segments.length) {
      return;
    }

    const timelineStartTime = normalizePreviewTime(track.timelineStartTime);
    const timelineEndTime = normalizePreviewTime(track.timelineEndTime);
    if (timelineStartTime === null || timelineEndTime === null || timelineEndTime <= timelineStartTime) {
      return;
    }

    requiredDurationByArrayIndex.set(
      previewArrayIndex,
      Math.max(requiredDurationByArrayIndex.get(previewArrayIndex) ?? 0, timelineEndTime - timelineStartTime),
    );
  });

  let cursor = normalizePreviewTime(segments[0]?.startTime) ?? 0;
  return segments.map((segment, arrayIndex) => {
    const originalStartTime = normalizePreviewTime(segment.startTime) ?? cursor;
    const originalEndTime = normalizePreviewTime(segment.endTime) ?? originalStartTime;
    const baseDuration = Math.max(0, originalEndTime - originalStartTime);
    const requiredDuration = requiredDurationByArrayIndex.get(arrayIndex) ?? 0;
    const startTime = roundPreviewTime(cursor);
    const endTime = roundPreviewTime(startTime + Math.max(baseDuration, requiredDuration));
    cursor = endTime;

    return {
      ...segment,
      endTime,
      startTime,
    };
  });
};

export const extendWorkspaceSegmentEditorFullPreviewAudioTimelineRangeTails = (
  ranges: WorkspaceSegmentEditorFullPreviewAudioTimelineRange[],
  tailSeconds: number,
): WorkspaceSegmentEditorFullPreviewAudioTimelineRange[] => {
  const safeTailSeconds = normalizePreviewTime(tailSeconds) ?? 0;
  if (safeTailSeconds <= 0 || ranges.length === 0) {
    return ranges;
  }

  const normalizedRanges = ranges.map((range, index) => {
    const startTime = normalizePreviewTime(range.startTime);
    const endTime = normalizePreviewTime(range.endTime);
    const sourceStartTime = normalizePreviewTime(range.sourceStartTime) ?? startTime;
    const url = range.url.trim();
    return startTime !== null &&
      endTime !== null &&
      endTime > startTime &&
      sourceStartTime !== null &&
      url
      ? {
          duration: endTime - startTime,
          endTime,
          index,
          sourceStartTime,
          startTime,
          url,
        }
      : null;
  });
  const rangesByUrl = new Map<string, NonNullable<(typeof normalizedRanges)[number]>[]>();

  normalizedRanges.forEach((range) => {
    if (!range) {
      return;
    }

    const rangesForUrl = rangesByUrl.get(range.url) ?? [];
    rangesForUrl.push(range);
    rangesByUrl.set(range.url, rangesForUrl);
  });

  const nextSourceStartTimeByIndex = new Map<number, number>();
  rangesByUrl.forEach((rangesForUrl) => {
    const sortedRanges = [...rangesForUrl].sort(
      (left, right) => left.sourceStartTime - right.sourceStartTime || left.startTime - right.startTime,
    );
    sortedRanges.forEach((range, rangeIndex) => {
      const nextRange = sortedRanges
        .slice(rangeIndex + 1)
        .find((candidate) => candidate.sourceStartTime > range.sourceStartTime + 0.001);
      if (nextRange) {
        nextSourceStartTimeByIndex.set(range.index, nextRange.sourceStartTime);
      }
    });
  });

  return ranges.map((range, index) => {
    const normalizedRange = normalizedRanges[index];
    if (!normalizedRange) {
      return range;
    }

    const nextSourceStartTime = nextSourceStartTimeByIndex.get(index) ?? null;
    const sourceDurationLimit =
      nextSourceStartTime !== null
        ? Math.max(normalizedRange.duration, nextSourceStartTime - normalizedRange.sourceStartTime)
        : normalizedRange.duration + safeTailSeconds;
    const extendedDuration = Math.min(normalizedRange.duration + safeTailSeconds, sourceDurationLimit);

    return {
      ...range,
      endTime: roundPreviewTime(normalizedRange.startTime + extendedDuration),
    };
  });
};

export const serializeWorkspaceSegmentEditorFullPreviewAudioTimelineRanges = (
  ranges: WorkspaceSegmentEditorFullPreviewAudioTimelineRange[],
  overlapToleranceSeconds = 0.05,
): WorkspaceSegmentEditorFullPreviewAudioTimelineRange[] => {
  const tolerance = normalizePreviewTime(overlapToleranceSeconds) ?? 0;
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

  const serializedRanges: Array<WorkspaceSegmentEditorFullPreviewAudioTimelineRange & { sourceStartTime: number }> = [];
  const lastRangeByUrl = new Map<string, WorkspaceSegmentEditorFullPreviewAudioTimelineRange & { sourceStartTime: number }>();

  normalizedRanges.forEach((range) => {
    const previousRange = lastRangeByUrl.get(range.url);
    const previousSourceOffset = previousRange ? previousRange.sourceStartTime - previousRange.startTime : null;
    const nextSourceOffset = range.sourceStartTime - range.startTime;
    const duration = range.endTime - range.startTime;
    const shouldMoveAfterPrevious =
      previousRange &&
      range.startTime < previousRange.endTime - tolerance &&
      previousSourceOffset !== null &&
      Math.abs(previousSourceOffset - nextSourceOffset) > tolerance;
    const startTime = shouldMoveAfterPrevious ? previousRange.endTime : range.startTime;
    const serializedRange = {
      ...range,
      endTime: roundPreviewTime(startTime + duration),
      sourceStartTime: roundPreviewTime(range.sourceStartTime),
      startTime: roundPreviewTime(startTime),
    };
    serializedRanges.push(serializedRange);

    const cursorRange = lastRangeByUrl.get(serializedRange.url);
    if (!cursorRange) {
      lastRangeByUrl.set(serializedRange.url, serializedRange);
      return;
    }

    const cursorSourceOffset = cursorRange.sourceStartTime - cursorRange.startTime;
    const serializedSourceOffset = serializedRange.sourceStartTime - serializedRange.startTime;
    if (
      serializedRange.startTime <= cursorRange.endTime + tolerance &&
      Math.abs(cursorSourceOffset - serializedSourceOffset) <= tolerance
    ) {
      lastRangeByUrl.set(serializedRange.url, {
        ...cursorRange,
        endTime: Math.max(cursorRange.endTime, serializedRange.endTime),
      });
      return;
    }

    if (serializedRange.endTime >= cursorRange.endTime) {
      lastRangeByUrl.set(serializedRange.url, serializedRange);
    }
  });

  return serializedRanges;
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
): Track[] => tracks;

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
  _hasPendingVoiceStart: boolean,
): Track[] => activeTracks;

export const shouldSeekWorkspaceSegmentEditorFullPreviewAudioTrack = (
  options: WorkspaceSegmentEditorFullPreviewAudioSeekSyncOptions,
) => {
  if (!Number.isFinite(options.currentSourceTime) || !Number.isFinite(options.nextSourceTime)) {
    return false;
  }

  const driftSeconds = Math.abs(options.currentSourceTime - options.nextSourceTime);
  if (options.isVoiceTrack) {
    if (options.isPaused) {
      return driftSeconds > options.voicePausedSeekToleranceSeconds;
    }

    const playingToleranceSeconds = normalizePreviewTime(options.voicePlayingSeekToleranceSeconds);
    return playingToleranceSeconds !== null && driftSeconds > playingToleranceSeconds;
  }

  const toleranceSeconds =
    options.trackKind === "music" ? options.musicSeekToleranceSeconds : options.audioSeekToleranceSeconds;
  return driftSeconds > toleranceSeconds;
};

export const shouldSeekWorkspaceSegmentEditorFullPreviewAudioStartGateTrack = (
  options: WorkspaceSegmentEditorFullPreviewAudioStartGateSeekOptions,
) => {
  if (!Number.isFinite(options.expectedSourceTime)) {
    return false;
  }

  if (options.isPaused || !Number.isFinite(options.currentSourceTime)) {
    return true;
  }

  const toleranceSeconds = normalizePreviewTime(options.syncToleranceSeconds) ?? 0;
  return Math.abs(options.currentSourceTime - options.expectedSourceTime) > toleranceSeconds;
};

export const shouldHoldWorkspaceSegmentEditorFullPreviewAudioStartGate = (
  options: WorkspaceSegmentEditorFullPreviewAudioStartGateHoldOptions,
) => {
  const gateHoldTime = normalizePreviewTime(options.gateHoldTime);
  const runStartTime = normalizePreviewTime(options.runStartTime);
  if (gateHoldTime === null || runStartTime === null) {
    return false;
  }

  const toleranceSeconds = normalizePreviewTime(options.toleranceSeconds) ?? 0;
  return Math.abs(gateHoldTime - runStartTime) <= toleranceSeconds;
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

export const resolveWorkspaceSegmentEditorFullPreviewRejectedAudioPreparationResult = ({
  activeTrackCount,
  isAudioUnlockRequired,
  rejectedPlayTrackCount,
}: WorkspaceSegmentEditorFullPreviewRejectedAudioPreparationOptions): WorkspaceSegmentEditorFullPreviewAudioPreparationResult => {
  if (activeTrackCount > 0 && rejectedPlayTrackCount > 0 && isAudioUnlockRequired) {
    return "unlock-required";
  }

  return "ready";
};

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
