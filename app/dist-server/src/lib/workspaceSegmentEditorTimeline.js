export const WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS = 1;
const WORKSPACE_SEGMENT_TIMELINE_ESTIMATED_DURATION_FLOOR_SECONDS = 1.8;
const WORKSPACE_SEGMENT_TIMELINE_SECONDS_PER_WORD = 0.34;
const WORKSPACE_SEGMENT_TIMELINE_AVERAGE_SPOKEN_CHARS_PER_WORD = 7;
const WORKSPACE_SEGMENT_TIMELINE_SECONDS_PER_INLINE_PAUSE = 0.55;
const WORKSPACE_SEGMENT_TIMELINE_SECONDS_PER_SENTENCE_PAUSE = 0.35;
const WORKSPACE_SEGMENT_TIMELINE_EPSILON = 1e-6;
const WORKSPACE_SEGMENT_TIMELINE_STALE_SPEECH_BOUNDARY_THRESHOLD_SECONDS = 0.35;
export const roundWorkspaceSegmentTimelineSeconds = (value) => Number(value.toFixed(3));
const normalizeWorkspaceSegmentTimelineTimeValue = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
};
const normalizeWorkspaceSegmentTimelineOptionalTimeValue = (value) => {
    if (value === null || typeof value === "undefined") {
        return null;
    }
    return normalizeWorkspaceSegmentTimelineTimeValue(value);
};
const normalizeWorkspaceSegmentPositiveDuration = (value) => {
    const normalizedValue = normalizeWorkspaceSegmentTimelineOptionalTimeValue(value);
    return normalizedValue !== null && normalizedValue > 0
        ? roundWorkspaceSegmentTimelineSeconds(normalizedValue)
        : null;
};
export const normalizeWorkspaceSegmentSpeechTimingCoordinateSpace = (value) => {
    const normalizedValue = String(value ?? "").trim().toLowerCase();
    if (normalizedValue === "asset_local" || normalizedValue === "source_local") {
        return "asset_local";
    }
    if (normalizedValue === "final_timeline" ||
        normalizedValue === "global_timeline" ||
        normalizedValue === "global_audio" ||
        normalizedValue === "global" ||
        normalizedValue === "batch_audio") {
        return "global_timeline";
    }
    return null;
};
export const normalizeWorkspaceSegmentVoiceSourceCoordinateSpace = (value) => {
    const normalizedValue = String(value ?? "").trim().toLowerCase();
    if (normalizedValue === "asset_local" || normalizedValue === "source_local") {
        return "asset_local";
    }
    if (normalizedValue === "global_audio" ||
        normalizedValue === "global" ||
        normalizedValue === "batch_audio" ||
        normalizedValue === "final_timeline" ||
        normalizedValue === "global_timeline") {
        return "global_audio";
    }
    return null;
};
/**
 * Converts timing reported for a standalone audio asset into the project timeline.
 * Speech boundaries and words become global; the audio source window always remains
 * local to the asset (0..duration).
 */
export const resolveWorkspaceSegmentAssetLocalSpeechTiming = (segment, timing) => {
    const visualStartTime = roundWorkspaceSegmentTimelineSeconds(normalizeWorkspaceSegmentTimelineOptionalTimeValue(segment.startTime) ?? 0);
    const speechWords = Array.isArray(timing.speechWords) ? timing.speechWords : [];
    const localWordStartTimes = speechWords
        .map((word) => normalizeWorkspaceSegmentTimelineOptionalTimeValue(word.startTime))
        .filter((value) => value !== null);
    const localWordEndTimes = speechWords
        .map((word) => normalizeWorkspaceSegmentTimelineOptionalTimeValue(word.endTime))
        .filter((value) => value !== null);
    const localSpeechStartTime = normalizeWorkspaceSegmentTimelineOptionalTimeValue(timing.speechStartTime) ??
        (localWordStartTimes.length > 0 ? Math.min(...localWordStartTimes) : 0);
    const explicitLocalSpeechEndTime = normalizeWorkspaceSegmentTimelineOptionalTimeValue(timing.speechEndTime);
    const explicitSpeechDuration = normalizeWorkspaceSegmentPositiveDuration(timing.speechDuration);
    const localSpeechEndTime = explicitLocalSpeechEndTime !== null && explicitLocalSpeechEndTime > localSpeechStartTime
        ? explicitLocalSpeechEndTime
        : localWordEndTimes.length > 0 && Math.max(...localWordEndTimes) > localSpeechStartTime
            ? Math.max(...localWordEndTimes)
            : explicitSpeechDuration !== null
                ? localSpeechStartTime + explicitSpeechDuration
                : null;
    const boundarySpeechDuration = localSpeechEndTime !== null
        ? normalizeWorkspaceSegmentPositiveDuration(localSpeechEndTime - localSpeechStartTime)
        : null;
    const speechDuration = boundarySpeechDuration ?? explicitSpeechDuration;
    const voiceSourceDuration = normalizeWorkspaceSegmentPositiveDuration(timing.voiceSourceDuration) ?? explicitSpeechDuration ?? speechDuration;
    const hasSpeechTiming = speechDuration !== null ||
        localSpeechEndTime !== null ||
        localWordStartTimes.length > 0 ||
        localWordEndTimes.length > 0;
    return {
        speechTimingCoordinateSpace: "global_timeline",
        speechDuration,
        speechEndTime: localSpeechEndTime !== null
            ? roundWorkspaceSegmentTimelineSeconds(visualStartTime + localSpeechEndTime)
            : null,
        speechStartTime: hasSpeechTiming
            ? roundWorkspaceSegmentTimelineSeconds(visualStartTime + localSpeechStartTime)
            : null,
        speechWords: speechWords.map((word) => {
            const localStartTime = normalizeWorkspaceSegmentTimelineOptionalTimeValue(word.startTime);
            const localEndTime = normalizeWorkspaceSegmentTimelineOptionalTimeValue(word.endTime);
            return {
                ...word,
                endTime: localEndTime !== null
                    ? roundWorkspaceSegmentTimelineSeconds(visualStartTime + localEndTime)
                    : word.endTime,
                startTime: localStartTime !== null
                    ? roundWorkspaceSegmentTimelineSeconds(visualStartTime + localStartTime)
                    : word.startTime,
            };
        }),
        voiceSourceCoordinateSpace: "asset_local",
        voiceSourceDuration,
        voiceSourceEndTime: voiceSourceDuration,
        voiceSourceStartTime: voiceSourceDuration !== null ? 0 : null,
    };
};
export const normalizeWorkspaceSegmentManualDurationSeconds = (value) => {
    const normalizedValue = normalizeWorkspaceSegmentTimelineTimeValue(value);
    return normalizedValue !== null && normalizedValue >= WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS
        ? normalizedValue
        : null;
};
const tokenizeWorkspaceSegmentTimelineText = (value) => value
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
const tokenizeLegacyWorkspaceSegmentTimelineText = (value) => value
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
export const estimateWorkspaceSegmentEditorSpeechDuration = (text, fallbackWordCount) => {
    const normalizedText = String(text ?? "");
    const spokenCharacterCount = normalizedText.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
    const characterBasedWordCount = Math.ceil(spokenCharacterCount / WORKSPACE_SEGMENT_TIMELINE_AVERAGE_SPOKEN_CHARS_PER_WORD);
    const resolvedWordCount = Math.max(1, fallbackWordCount ?? 0, tokenizeWorkspaceSegmentTimelineText(normalizedText).length, characterBasedWordCount);
    const inlinePauseCount = normalizedText.match(/[,;:]/g)?.length ?? 0;
    const sentencePauseCount = normalizedText.match(/[.!?…]+/g)?.length ?? 0;
    const punctuationPauseSeconds = inlinePauseCount * WORKSPACE_SEGMENT_TIMELINE_SECONDS_PER_INLINE_PAUSE +
        sentencePauseCount * WORKSPACE_SEGMENT_TIMELINE_SECONDS_PER_SENTENCE_PAUSE;
    return roundWorkspaceSegmentTimelineSeconds(Math.max(WORKSPACE_SEGMENT_TIMELINE_ESTIMATED_DURATION_FLOOR_SECONDS, resolvedWordCount * WORKSPACE_SEGMENT_TIMELINE_SECONDS_PER_WORD + punctuationPauseSeconds));
};
export const isWorkspaceSegmentEditorLegacyPunctuationEstimatedDuration = (text, durationSeconds) => {
    if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        return false;
    }
    const normalizedText = String(text ?? "");
    const currentWordCount = tokenizeWorkspaceSegmentTimelineText(normalizedText).length;
    const legacyWordCount = tokenizeLegacyWorkspaceSegmentTimelineText(normalizedText).length;
    if (legacyWordCount <= currentWordCount) {
        return false;
    }
    const currentEstimate = estimateWorkspaceSegmentEditorSpeechDuration(normalizedText, currentWordCount);
    const legacyEstimate = estimateWorkspaceSegmentEditorSpeechDuration(normalizedText, legacyWordCount);
    return (legacyEstimate > currentEstimate + WORKSPACE_SEGMENT_TIMELINE_EPSILON &&
        Math.abs(durationSeconds - legacyEstimate) <= 0.005);
};
const areTimelineNumbersEqual = (left, right) => left !== null && right !== null && Math.abs(left - right) <= WORKSPACE_SEGMENT_TIMELINE_EPSILON;
const normalizeWorkspaceSegmentTimelineRange = (range) => {
    const startTime = normalizeWorkspaceSegmentTimelineTimeValue(range?.startTime);
    const endTime = normalizeWorkspaceSegmentTimelineTimeValue(range?.endTime);
    if (startTime === null || endTime === null || endTime <= startTime) {
        return null;
    }
    return {
        endTime: roundWorkspaceSegmentTimelineSeconds(endTime),
        startTime: roundWorkspaceSegmentTimelineSeconds(startTime),
    };
};
const hasUserSelectedManualTimelineDuration = (segment) => segment?.durationMode === "manual" &&
    segment.durationSyncModeUserSelected === true &&
    normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds) !== null;
const getWorkspaceSegmentTimelineSpeechWordsRange = (segment) => {
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
export const getWorkspaceSegmentTimelineSpeechRange = (segment) => {
    const speechWordsRange = getWorkspaceSegmentTimelineSpeechWordsRange(segment);
    const speechStartTime = normalizeWorkspaceSegmentTimelineTimeValue(segment.speechStartTime);
    const speechEndTime = normalizeWorkspaceSegmentTimelineTimeValue(segment.speechEndTime);
    const hasStaleSpeechBoundary = speechWordsRange !== null &&
        speechStartTime !== null &&
        Math.abs(speechStartTime - speechWordsRange.startTime) >
            WORKSPACE_SEGMENT_TIMELINE_STALE_SPEECH_BOUNDARY_THRESHOLD_SECONDS;
    if (hasStaleSpeechBoundary) {
        return speechWordsRange;
    }
    const speechDuration = typeof segment.speechDuration === "number" && Number.isFinite(segment.speechDuration) && segment.speechDuration > 0
        ? segment.speechDuration
        : null;
    const startTimeCandidates = [speechStartTime, speechWordsRange?.startTime].filter((value) => value !== null && typeof value !== "undefined");
    const startTime = startTimeCandidates.length > 0 ? Math.min(...startTimeCandidates) : null;
    const endTimeCandidates = [speechEndTime, speechWordsRange?.endTime].filter((value) => value !== null && typeof value !== "undefined");
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
const getWorkspaceSegmentResolvedTimelineSpeechRange = (segment, speechRange) => normalizeWorkspaceSegmentTimelineRange(speechRange?.(segment)) ?? getWorkspaceSegmentTimelineSpeechRange(segment);
const shiftWorkspaceSegmentTimelineOptionalTimeValue = (value, deltaSeconds) => {
    const normalizedValue = normalizeWorkspaceSegmentTimelineOptionalTimeValue(value);
    if (normalizedValue === null) {
        return value;
    }
    return roundWorkspaceSegmentTimelineSeconds(Math.max(0, normalizedValue + deltaSeconds));
};
const shiftWorkspaceSegmentSpeechTimingToStart = (segment, nextStartTime) => {
    const currentStartTime = normalizeWorkspaceSegmentTimelineOptionalTimeValue(segment.startTime) ??
        getWorkspaceSegmentTimelineSpeechRange(segment)?.startTime ??
        0;
    const deltaSeconds = roundWorkspaceSegmentTimelineSeconds(nextStartTime - currentStartTime);
    if (Math.abs(deltaSeconds) <= WORKSPACE_SEGMENT_TIMELINE_EPSILON) {
        return segment;
    }
    let hasChanges = false;
    const nextSegment = { ...segment };
    const nextSpeechStartTime = shiftWorkspaceSegmentTimelineOptionalTimeValue(segment.speechStartTime, deltaSeconds);
    const nextSpeechEndTime = shiftWorkspaceSegmentTimelineOptionalTimeValue(segment.speechEndTime, deltaSeconds);
    if (nextSpeechStartTime !== segment.speechStartTime) {
        nextSegment.speechStartTime = nextSpeechStartTime;
        hasChanges = true;
    }
    if (nextSpeechEndTime !== segment.speechEndTime) {
        nextSegment.speechEndTime = nextSpeechEndTime;
        hasChanges = true;
    }
    if (Array.isArray(segment.speechWords)) {
        let hasWordTimingChanges = false;
        const nextSpeechWords = segment.speechWords.map((word) => {
            const nextWordStartTime = shiftWorkspaceSegmentTimelineOptionalTimeValue(word.startTime, deltaSeconds);
            const nextWordEndTime = shiftWorkspaceSegmentTimelineOptionalTimeValue(word.endTime, deltaSeconds);
            if (nextWordStartTime === word.startTime && nextWordEndTime === word.endTime) {
                return word;
            }
            hasWordTimingChanges = true;
            return {
                ...word,
                endTime: nextWordEndTime,
                startTime: nextWordStartTime,
            };
        });
        if (hasWordTimingChanges) {
            nextSegment.speechWords = nextSpeechWords;
            hasChanges = true;
        }
    }
    return hasChanges ? nextSegment : segment;
};
export const resolveWorkspaceSegmentTimelineSpeechBoundaryTime = (previousSegment, nextSegment, options) => {
    const previousSpeechRange = getWorkspaceSegmentResolvedTimelineSpeechRange(previousSegment, options?.speechRange);
    const nextSpeechRange = getWorkspaceSegmentResolvedTimelineSpeechRange(nextSegment, options?.speechRange);
    if (previousSpeechRange === null || nextSpeechRange === null) {
        return null;
    }
    if (nextSpeechRange.startTime <= previousSpeechRange.endTime + WORKSPACE_SEGMENT_TIMELINE_EPSILON) {
        return options?.preserveTouchingBoundary &&
            nextSpeechRange.startTime + WORKSPACE_SEGMENT_TIMELINE_EPSILON >= previousSpeechRange.endTime
            ? roundWorkspaceSegmentTimelineSeconds(previousSpeechRange.endTime)
            : null;
    }
    return roundWorkspaceSegmentTimelineSeconds(previousSpeechRange.endTime + (nextSpeechRange.startTime - previousSpeechRange.endTime) / 2);
};
export const getWorkspaceSegmentEditorDisplayStartTime = (segment) => {
    const speechRange = getWorkspaceSegmentTimelineSpeechRange(segment);
    return (normalizeWorkspaceSegmentTimelineTimeValue(segment.startTime) ??
        speechRange?.startTime ??
        0);
};
export const getWorkspaceSegmentEditorDisplayEndTime = (segment) => {
    const speechRange = getWorkspaceSegmentTimelineSpeechRange(segment);
    return (normalizeWorkspaceSegmentTimelineTimeValue(segment.endTime) ??
        speechRange?.endTime ??
        getWorkspaceSegmentEditorDisplayStartTime(segment));
};
export const getWorkspaceSegmentEditorSpeechDuration = (segment) => {
    const speechRange = getWorkspaceSegmentTimelineSpeechRange(segment);
    const speechTimelineDuration = speechRange !== null && speechRange.endTime > speechRange.startTime ? speechRange.endTime - speechRange.startTime : null;
    const explicitSpeechDuration = typeof segment.speechDuration === "number" && Number.isFinite(segment.speechDuration) && segment.speechDuration > 0
        ? segment.speechDuration
        : null;
    const candidates = [explicitSpeechDuration, speechTimelineDuration].filter((value) => value !== null);
    return candidates.length > 0 ? Math.max(...candidates) : null;
};
export const getWorkspaceSegmentEditorPlaybackDuration = (segment, fallbackWordCount, options) => {
    const resolvedWordCount = Math.max(1, fallbackWordCount ?? tokenizeWorkspaceSegmentTimelineText(String(segment.text ?? "")).length);
    const estimatedDurationFloor = estimateWorkspaceSegmentEditorSpeechDuration(segment.text, resolvedWordCount);
    const speechRange = getWorkspaceSegmentTimelineSpeechRange(segment);
    const speechTimelineDuration = speechRange !== null && speechRange.endTime > speechRange.startTime ? speechRange.endTime - speechRange.startTime : null;
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
    ].filter((value) => value !== null);
    return Math.max(...candidates);
};
export const resolveWorkspaceSegmentDuration = (segment, options) => {
    const speechDuration = getWorkspaceSegmentEditorSpeechDuration(segment);
    const voiceEnabled = options?.voiceEnabled !== false;
    const explicitVoiceDuration = normalizeWorkspaceSegmentManualDurationSeconds(options?.voiceDurationSeconds);
    const voiceDurationCandidates = voiceEnabled
        ? [speechDuration, explicitVoiceDuration].filter((value) => value !== null)
        : [];
    const voiceDuration = voiceDurationCandidates.length > 0 ? Math.max(...voiceDurationCandidates) : null;
    const manualDuration = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
    const visualKind = options?.visualKind ?? (String(segment.mediaType ?? "").trim().toLowerCase() === "photo" ? "image" : null);
    const visualDuration = normalizeWorkspaceSegmentTimelineTimeValue(options?.visualDurationSeconds);
    const durationSyncMode = String(segment.durationSyncMode ?? "").trim().toLowerCase();
    const durationSyncModeUserSelected = segment.durationSyncModeUserSelected === true;
    const shouldSyncVideoToVoiceover = visualKind === "video" && durationSyncMode === "voiceover";
    const explicitMinimumDuration = normalizeWorkspaceSegmentManualDurationSeconds(options?.minimumDurationSeconds);
    const voiceMinimumDuration = voiceDuration;
    const minimumDuration = Math.max(WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS, voiceMinimumDuration ?? WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS, explicitMinimumDuration ?? WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS);
    const timelineDuration = getWorkspaceSegmentEditorDisplayEndTime(segment) - getWorkspaceSegmentEditorDisplayStartTime(segment);
    const existingStillDuration = visualKind === "image"
        ? normalizeWorkspaceSegmentManualDurationSeconds(timelineDuration) ??
            normalizeWorkspaceSegmentManualDurationSeconds(visualDuration) ??
            normalizeWorkspaceSegmentManualDurationSeconds(segment.duration) ??
            normalizeWorkspaceSegmentManualDurationSeconds(options?.fallbackDuration)
        : null;
    if (segment.durationMode === "manual" && manualDuration !== null) {
        if (visualKind === "video" && durationSyncMode === "visual") {
            return Math.max(minimumDuration, manualDuration);
        }
        const shouldPreserveLegacyManualStillDuration = visualKind === "image" &&
            options?.preserveExistingStillDuration &&
            !durationSyncModeUserSelected &&
            existingStillDuration !== null;
        if (shouldPreserveLegacyManualStillDuration && options?.preserveExistingStillDurationExact) {
            return Math.max(minimumDuration, existingStillDuration);
        }
        return Math.max(minimumDuration, manualDuration, shouldPreserveLegacyManualStillDuration ? existingStillDuration : 0);
    }
    if (shouldSyncVideoToVoiceover && voiceDuration !== null) {
        return Math.max(WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS, voiceDuration);
    }
    if (visualKind === "video" && visualDuration !== null && visualDuration > 0) {
        return Math.max(minimumDuration, visualDuration);
    }
    if (voiceDuration !== null) {
        if (options?.preserveExistingStillDuration && existingStillDuration !== null) {
            if (options.preserveExistingStillDurationExact) {
                return Math.max(minimumDuration, existingStillDuration);
            }
            return Math.max(WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS, minimumDuration, existingStillDuration);
        }
        return minimumDuration;
    }
    if (options?.subtitleEnabled === false && visualKind === "image") {
        const fallbackDuration = normalizeWorkspaceSegmentTimelineTimeValue(options.fallbackDuration);
        const stillFallbackDuration = normalizeWorkspaceSegmentTimelineTimeValue(options.stillNoTextFallbackDuration);
        return Math.max(WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS, options.preferEstimatedDuration
            ? stillFallbackDuration ?? fallbackDuration ?? WORKSPACE_SEGMENT_TIMELINE_ESTIMATED_DURATION_FLOOR_SECONDS
            : fallbackDuration ?? stillFallbackDuration ?? WORKSPACE_SEGMENT_TIMELINE_ESTIMATED_DURATION_FLOOR_SECONDS);
    }
    return Math.max(WORKSPACE_SEGMENT_TIMELINE_MIN_DURATION_SECONDS, getWorkspaceSegmentEditorPlaybackDuration(segment, undefined, {
        preferEstimatedDuration: options?.preferEstimatedDuration ?? false,
    }));
};
export const rebuildWorkspaceSegmentEditorTimeline = (segments, options) => {
    let cursor = 0;
    let hasChanges = false;
    const nextSegments = segments.map((segment) => {
        const voiceEnabled = typeof options?.voiceEnabled === "function" ? options.voiceEnabled(segment) : options?.voiceEnabled;
        const subtitleEnabled = typeof options?.subtitleEnabled === "function" ? options.subtitleEnabled(segment) : options?.subtitleEnabled;
        const preserveExistingStillDuration = typeof options?.preserveExistingStillDurations === "function"
            ? options.preserveExistingStillDurations(segment)
            : options?.preserveExistingStillDurations;
        const preserveExistingStillDurationExact = typeof options?.preserveExistingStillDurationsExact === "function"
            ? options.preserveExistingStillDurationsExact(segment)
            : options?.preserveExistingStillDurationsExact;
        const shouldUseZeroDuration = typeof options?.zeroDuration === "function" ? options.zeroDuration(segment) : options?.zeroDuration;
        const duration = shouldUseZeroDuration
            ? 0
            : roundWorkspaceSegmentTimelineSeconds(resolveWorkspaceSegmentDuration(segment, {
                fallbackDuration: segment.duration,
                minimumDurationSeconds: options?.minimumDurationSeconds?.(segment) ?? null,
                preferEstimatedDuration: options?.preferEstimatedDuration?.(segment) ?? false,
                preserveExistingStillDuration: preserveExistingStillDuration ?? false,
                preserveExistingStillDurationExact: preserveExistingStillDurationExact ?? false,
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
        const segmentWithShiftedSpeechTiming = shiftWorkspaceSegmentSpeechTimingToStart(segment, startTime);
        if (areTimelineNumbersEqual(currentDuration, duration) &&
            areTimelineNumbersEqual(currentStartTime, startTime) &&
            areTimelineNumbersEqual(currentEndTime, endTime) &&
            segmentWithShiftedSpeechTiming === segment) {
            return segment;
        }
        hasChanges = true;
        return {
            ...segmentWithShiftedSpeechTiming,
            duration,
            endTime,
            startTime,
        };
    });
    if (options?.speechBoundaryEnabled && options?.preserveSpeechBoundaries !== false && nextSegments.length > 1) {
        const boundaries = [0];
        let hasUserSelectedManualDurationBeforeBoundary = false;
        for (let index = 0; index < nextSegments.length - 1; index += 1) {
            const previousSegment = segments[index];
            const nextSegment = segments[index + 1];
            const rebuiltBoundary = normalizeWorkspaceSegmentTimelineTimeValue(nextSegments[index]?.endTime);
            const boundaryEnabled = typeof options.speechBoundaryEnabled === "function"
                ? previousSegment !== undefined &&
                    nextSegment !== undefined &&
                    options.speechBoundaryEnabled(previousSegment, nextSegment)
                : options.speechBoundaryEnabled;
            const hasManualDurationBoundary = [nextSegments[index], nextSegments[index + 1]].some((segment) => segment?.durationMode === "manual" &&
                normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds) !== null);
            const hasUserSelectedManualDurationAtBoundary = hasUserSelectedManualDurationBeforeBoundary ||
                hasUserSelectedManualTimelineDuration(previousSegment) ||
                hasUserSelectedManualTimelineDuration(nextSegments[index]);
            const shouldIgnoreSourceSpeechBoundary = options.preserveSourceTimelineEnd === false &&
                hasUserSelectedManualDurationAtBoundary;
            const speechBoundary = boundaryEnabled &&
                !hasManualDurationBoundary &&
                !shouldIgnoreSourceSpeechBoundary &&
                previousSegment !== undefined &&
                nextSegment !== undefined
                ? resolveWorkspaceSegmentTimelineSpeechBoundaryTime(previousSegment, nextSegment, {
                    preserveTouchingBoundary: Boolean(options?.speechRange),
                    speechRange: options?.speechRange,
                })
                : null;
            const previousBoundary = boundaries[boundaries.length - 1] ?? 0;
            const rebuiltDuration = normalizeWorkspaceSegmentTimelineTimeValue(nextSegments[index]?.duration);
            const minimumBoundary = rebuiltDuration !== null ? roundWorkspaceSegmentTimelineSeconds(previousBoundary + rebuiltDuration) : null;
            boundaries.push(roundWorkspaceSegmentTimelineSeconds(Math.max(speechBoundary ?? rebuiltBoundary ?? previousBoundary, minimumBoundary ?? previousBoundary)));
            hasUserSelectedManualDurationBeforeBoundary =
                hasUserSelectedManualDurationAtBoundary ||
                    hasUserSelectedManualTimelineDuration(segments[index + 1]);
        }
        const lastSourceSegment = segments[segments.length - 1];
        const lastRebuiltSegment = nextSegments[nextSegments.length - 1];
        const lastSpeechRange = lastSourceSegment
            ? getWorkspaceSegmentResolvedTimelineSpeechRange(lastSourceSegment, options?.speechRange)
            : null;
        const rebuiltTimelineEnd = normalizeWorkspaceSegmentTimelineTimeValue(lastRebuiltSegment?.endTime) ?? cursor;
        const lastDuration = normalizeWorkspaceSegmentTimelineTimeValue(lastRebuiltSegment?.duration);
        const lastMinimumTimelineEnd = roundWorkspaceSegmentTimelineSeconds((boundaries[boundaries.length - 1] ?? 0) + (lastDuration ?? 0));
        const sourceTimelineEnd = options.preserveSourceTimelineEnd && lastSourceSegment
            ? normalizeWorkspaceSegmentTimelineTimeValue(lastSourceSegment.endTime) ??
                getWorkspaceSegmentEditorDisplayEndTime(lastSourceSegment)
            : null;
        const sourceSpeechTimelineEnd = options.preserveSourceTimelineEnd === false && hasUserSelectedManualDurationBeforeBoundary
            ? null
            : lastSpeechRange?.endTime;
        boundaries.push(roundWorkspaceSegmentTimelineSeconds(Math.max(rebuiltTimelineEnd, sourceTimelineEnd ?? 0, sourceSpeechTimelineEnd ?? 0, lastMinimumTimelineEnd)));
        const hasValidBoundaryOrder = boundaries.every((boundary, index) => Number.isFinite(boundary) &&
            boundary >= 0 &&
            (index === 0 || boundary > boundaries[index - 1] + WORKSPACE_SEGMENT_TIMELINE_EPSILON));
        if (hasValidBoundaryOrder) {
            const boundarySegments = nextSegments.map((segment, index) => {
                const startTime = roundWorkspaceSegmentTimelineSeconds(boundaries[index] ?? 0);
                const endTime = roundWorkspaceSegmentTimelineSeconds(boundaries[index + 1] ?? startTime);
                const duration = roundWorkspaceSegmentTimelineSeconds(Math.max(0, endTime - startTime));
                const currentDuration = normalizeWorkspaceSegmentTimelineTimeValue(segment.duration);
                const currentStartTime = normalizeWorkspaceSegmentTimelineTimeValue(segment.startTime);
                const currentEndTime = normalizeWorkspaceSegmentTimelineTimeValue(segment.endTime);
                const segmentWithShiftedSpeechTiming = shiftWorkspaceSegmentSpeechTimingToStart(segment, startTime);
                if (areTimelineNumbersEqual(currentDuration, duration) &&
                    areTimelineNumbersEqual(currentStartTime, startTime) &&
                    areTimelineNumbersEqual(currentEndTime, endTime) &&
                    segmentWithShiftedSpeechTiming === segment) {
                    return segment;
                }
                hasChanges = true;
                return {
                    ...segmentWithShiftedSpeechTiming,
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
