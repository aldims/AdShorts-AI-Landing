import {
  normalizeWorkspaceSegmentManualDurationSeconds,
  roundWorkspaceSegmentTimelineSeconds,
} from "../../lib/workspaceSegmentEditorTimeline";
import {
  WORKSPACE_SEGMENT_PHOTO_DURATION_AUDIO_GUARD_EPSILON_SECONDS,
  WORKSPACE_SEGMENT_PHOTO_DURATION_VOICEOVER_PAUSE_SECONDS,
  WORKSPACE_STUDIO_VIDEO_MODE_IDS,
} from "./workspace-constants";
import type {
  StudioVideoMode,
  WorkspaceSegmentVoiceTimelineHistoryKind,
  WorkspaceSegmentVoiceTimelineState,
} from "./workspace-types";

type WorkspaceSegmentBulkSubtitleTextResult = {
  error: string | null;
  texts: string[];
};

export const normalizeWorkspaceVideoSourceUrl = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "";
  }

  if (typeof window === "undefined") {
    return normalized;
  }

  try {
    return new URL(normalized, window.location.href).href;
  } catch {
    return normalized;
  }
};

export const formatWorkspaceSegmentDurationInputValue = (value: number | null | undefined) => {
  const normalizedValue = normalizeWorkspaceSegmentManualDurationSeconds(value);
  return normalizedValue === null ? "" : String(Number(normalizedValue.toFixed(1)));
};

export const normalizeWorkspaceSegmentBulkSubtitleText = (value: string | null | undefined) =>
  String(value ?? "").replace(/\s+/g, " ").trim();

export const splitWorkspaceSegmentBulkSubtitleWords = (value: string) => {
  const normalizedValue = normalizeWorkspaceSegmentBulkSubtitleText(value);
  return normalizedValue ? normalizedValue.split(" ") : [];
};

const splitWorkspaceSegmentBulkSubtitleSentences = (value: string) => {
  const normalizedValue = normalizeWorkspaceSegmentBulkSubtitleText(value);
  if (!normalizedValue) {
    return [];
  }

  return (
    normalizedValue.match(/[^.!?…]+[.!?…]+(?:["'»”)\]]+)?|[^.!?…]+$/g) ?? [normalizedValue]
  )
    .map((sentence) => normalizeWorkspaceSegmentBulkSubtitleText(sentence))
    .filter(Boolean);
};

const splitWorkspaceSegmentBulkSubtitleWordsEvenly = (words: string[], chunkCount: number) => {
  const normalizedChunkCount = Math.max(0, Math.floor(chunkCount));
  if (normalizedChunkCount <= 0) {
    return [];
  }

  const baseWordsPerChunk = Math.floor(words.length / normalizedChunkCount);
  const remainder = words.length % normalizedChunkCount;
  const chunks: string[] = [];
  let cursor = 0;

  for (let index = 0; index < normalizedChunkCount; index += 1) {
    const wordsForChunk = baseWordsPerChunk + (index < remainder ? 1 : 0);
    chunks.push(words.slice(cursor, cursor + wordsForChunk).join(" "));
    cursor += wordsForChunk;
  }

  return chunks;
};

const groupWorkspaceSegmentBulkSubtitleSentencesByWords = (sentences: string[], segmentCount: number) => {
  const sentenceCount = sentences.length;
  if (sentenceCount <= segmentCount) {
    return sentences;
  }

  const wordCounts = sentences.map((sentence) => Math.max(1, splitWorkspaceSegmentBulkSubtitleWords(sentence).length));
  const totalWords = wordCounts.reduce((sum, count) => sum + count, 0);
  const targetWordsPerSegment = totalWords / segmentCount;
  const targetSentencesPerSegment = sentenceCount / segmentCount;
  const prefixWordCounts = [0];

  for (const count of wordCounts) {
    prefixWordCounts.push(prefixWordCounts[prefixWordCounts.length - 1] + count);
  }

  const getGroupCost = (start: number, end: number) => {
    const groupWords = prefixWordCounts[end] - prefixWordCounts[start];
    const groupSentences = end - start;
    return (
      (groupWords - targetWordsPerSegment) ** 2 +
      (groupSentences - targetSentencesPerSegment) ** 2 * 0.05
    );
  };

  const costs = Array.from({ length: sentenceCount + 1 }, () => Array(segmentCount + 1).fill(Number.POSITIVE_INFINITY));
  const previousSplit = Array.from({ length: sentenceCount + 1 }, () => Array(segmentCount + 1).fill(-1));
  costs[0][0] = 0;

  for (let usedSentences = 1; usedSentences <= sentenceCount; usedSentences += 1) {
    const maxGroups = Math.min(usedSentences, segmentCount);

    for (let groupCount = 1; groupCount <= maxGroups; groupCount += 1) {
      const minimumPreviousSentences = groupCount - 1;
      const maximumPreviousSentences = usedSentences - 1;

      for (let splitIndex = minimumPreviousSentences; splitIndex <= maximumPreviousSentences; splitIndex += 1) {
        const previousCost = costs[splitIndex][groupCount - 1];
        if (!Number.isFinite(previousCost)) {
          continue;
        }

        const nextCost = previousCost + getGroupCost(splitIndex, usedSentences);
        if (nextCost < costs[usedSentences][groupCount]) {
          costs[usedSentences][groupCount] = nextCost;
          previousSplit[usedSentences][groupCount] = splitIndex;
        }
      }
    }
  }

  const groupedSentences: string[] = [];
  let cursor = sentenceCount;

  for (let groupIndex = segmentCount; groupIndex > 0; groupIndex -= 1) {
    const splitIndex = previousSplit[cursor][groupIndex];
    if (splitIndex < 0) {
      return splitWorkspaceSegmentBulkSubtitleWordsEvenly(sentences.flatMap(splitWorkspaceSegmentBulkSubtitleWords), segmentCount);
    }

    groupedSentences.unshift(sentences.slice(splitIndex, cursor).join(" "));
    cursor = splitIndex;
  }

  return groupedSentences;
};

const splitWorkspaceSegmentBulkSubtitleSentencesIntoSegments = (sentences: string[], segmentCount: number) => {
  if (sentences.length >= segmentCount) {
    return groupWorkspaceSegmentBulkSubtitleSentencesByWords(sentences, segmentCount);
  }

  const wordGroups = sentences.map(splitWorkspaceSegmentBulkSubtitleWords);
  const segmentsPerSentence = wordGroups.map(() => 1);
  let remainingSegments = segmentCount - sentences.length;

  while (remainingSegments > 0) {
    let targetSentenceIndex = 0;
    let largestCurrentWordsPerSegment = -1;

    wordGroups.forEach((words, index) => {
      const currentWordsPerSegment = words.length / segmentsPerSentence[index];
      if (currentWordsPerSegment > largestCurrentWordsPerSegment) {
        largestCurrentWordsPerSegment = currentWordsPerSegment;
        targetSentenceIndex = index;
      }
    });

    segmentsPerSentence[targetSentenceIndex] += 1;
    remainingSegments -= 1;
  }

  return wordGroups.flatMap((words, index) =>
    splitWorkspaceSegmentBulkSubtitleWordsEvenly(words, segmentsPerSentence[index]),
  );
};

export const buildWorkspaceSegmentBulkSubtitleText = (segments: Array<{ text?: string | null }>) =>
  normalizeWorkspaceSegmentBulkSubtitleText(segments.map((segment) => segment.text ?? "").join(" "));

export const distributeWorkspaceSegmentBulkSubtitleText = (
  text: string,
  segmentCount: number,
): WorkspaceSegmentBulkSubtitleTextResult => {
  const normalizedText = normalizeWorkspaceSegmentBulkSubtitleText(text);
  const normalizedSegmentCount = Number.isFinite(segmentCount) ? Math.max(0, Math.floor(segmentCount)) : 0;

  if (normalizedSegmentCount <= 0) {
    return { error: "Нет сегментов для обновления.", texts: [] };
  }

  if (!normalizedText) {
    return { error: "Введите текст субтитров.", texts: [] };
  }

  const words = splitWorkspaceSegmentBulkSubtitleWords(normalizedText);

  if (words.length < normalizedSegmentCount) {
    return { error: `Для ${normalizedSegmentCount} сегментов нужно минимум ${normalizedSegmentCount} слов.`, texts: [] };
  }

  const sentences = splitWorkspaceSegmentBulkSubtitleSentences(normalizedText);
  const texts = sentences.length > 0
    ? splitWorkspaceSegmentBulkSubtitleSentencesIntoSegments(sentences, normalizedSegmentCount)
    : splitWorkspaceSegmentBulkSubtitleWordsEvenly(words, normalizedSegmentCount);

  return { error: null, texts };
};

export const resolveWorkspaceSegmentGeneratedVoiceoverEdited = (options: {
  baselineVoiceoverAssetKey?: string | null;
  baselineVoiceoverLanguage?: string | null;
  baselineVoiceoverTextHash?: string | null;
  baselineVoiceoverVoiceType?: string | null;
  currentVoiceoverAssetKey?: string | null;
  currentVoiceoverLanguage?: string | null;
  currentVoiceoverTextHash?: string | null;
  currentVoiceoverVoiceType?: string | null;
  hasBaseline: boolean;
  isVoiceoverFresh: boolean;
}) =>
  Boolean(
    options.hasBaseline &&
      options.isVoiceoverFresh &&
      options.currentVoiceoverAssetKey &&
      (options.currentVoiceoverAssetKey !== (options.baselineVoiceoverAssetKey ?? null) ||
        (options.currentVoiceoverTextHash ?? null) !== (options.baselineVoiceoverTextHash ?? null) ||
        (options.currentVoiceoverVoiceType ?? null) !== (options.baselineVoiceoverVoiceType ?? null) ||
        (options.currentVoiceoverLanguage ?? null) !== (options.baselineVoiceoverLanguage ?? null)),
  );

export const resolveWorkspaceSegmentVoiceTimelineState = (options: {
  canForwardText: boolean;
  canForwardVoice: boolean;
  isGeneratedVoiceoverEdited: boolean;
  isTextEdited: boolean;
  isVoiceSettingsEdited: boolean;
}): WorkspaceSegmentVoiceTimelineState => {
  const historyKind: WorkspaceSegmentVoiceTimelineHistoryKind =
    options.isTextEdited || options.canForwardText ? "text" : "voice";
  const canBackVoice = options.isVoiceSettingsEdited || options.isGeneratedVoiceoverEdited;
  const canBack = historyKind === "text" ? options.isTextEdited : canBackVoice;
  const canForward = historyKind === "text" ? options.canForwardText : options.canForwardVoice;

  return {
    canBack,
    canForward,
    hasHistory: canBack || canForward,
    historyKind,
    isEdited: options.isGeneratedVoiceoverEdited || options.isVoiceSettingsEdited,
  };
};

export const resolveWorkspaceProjectVoiceoverPendingSegments = <T>(targets: T[], targetsToGenerate: T[]) =>
  targetsToGenerate.length > 0 ? targets : [];

const workspaceStudioVideoModeIds = new Set<StudioVideoMode>(WORKSPACE_STUDIO_VIDEO_MODE_IDS);

const normalizeWorkspaceStudioVideoModeValue = (value: unknown): StudioVideoMode | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return workspaceStudioVideoModeIds.has(normalized as StudioVideoMode) ? (normalized as StudioVideoMode) : null;
};

export const resolveWorkspaceGenerationEffectiveVideoMode = (options: {
  hasSelectedCustomVideo?: boolean;
  isSegmentEditorGeneration?: boolean;
  requestedVideoMode?: StudioVideoMode | string | null;
  selectedVideoMode: StudioVideoMode;
}): StudioVideoMode => {
  const requestedVideoMode = normalizeWorkspaceStudioVideoModeValue(options.requestedVideoMode);
  const effectiveVideoMode = requestedVideoMode ?? options.selectedVideoMode;
  if (options.isSegmentEditorGeneration && effectiveVideoMode === "custom" && !options.hasSelectedCustomVideo) {
    return "standard";
  }

  return effectiveVideoMode;
};

export const resolveWorkspaceRegenerationVideoMode = (options: {
  selectedVideoMode: StudioVideoMode;
  wasVideoModeExplicitlyChanged?: boolean;
}): StudioVideoMode => (options.wasVideoModeExplicitlyChanged ? options.selectedVideoMode : "standard");

export const getWorkspaceSegmentPhotoDurationVoiceoverMinimumSeconds = (
  voiceoverDurationSeconds: number | null | undefined,
) => {
  const voiceoverDuration = normalizeWorkspaceSegmentManualDurationSeconds(voiceoverDurationSeconds);
  if (voiceoverDuration === null) {
    return null;
  }

  return roundWorkspaceSegmentTimelineSeconds(
    voiceoverDuration + WORKSPACE_SEGMENT_PHOTO_DURATION_VOICEOVER_PAUSE_SECONDS,
  );
};

export const resolveWorkspaceSegmentPhotoDurationVoiceoverGuard = (
  requestedDurationSeconds: number | null | undefined,
  voiceoverDurationSeconds: number | null | undefined,
) => {
  const requestedDuration = normalizeWorkspaceSegmentManualDurationSeconds(requestedDurationSeconds);
  const minimumDuration = getWorkspaceSegmentPhotoDurationVoiceoverMinimumSeconds(voiceoverDurationSeconds);
  if (requestedDuration === null || minimumDuration === null) {
    return null;
  }

  if (
    formatWorkspaceSegmentDurationInputValue(requestedDuration) ===
    formatWorkspaceSegmentDurationInputValue(minimumDuration)
  ) {
    return null;
  }

  if (requestedDuration + WORKSPACE_SEGMENT_PHOTO_DURATION_AUDIO_GUARD_EPSILON_SECONDS >= minimumDuration) {
    return null;
  }

  return {
    minimumDurationSeconds: minimumDuration,
    requestedDurationSeconds: roundWorkspaceSegmentTimelineSeconds(requestedDuration),
  };
};

const normalizeWorkspaceSegmentEditorTextForCompare = (value: string) => value.replace(/\s+/g, " ").trim();

export const getWorkspaceSegmentVoiceoverTextHash = (value: string) =>
  normalizeWorkspaceSegmentEditorTextForCompare(value).toLowerCase();

export const getWorkspaceSegmentVoiceoverGenerationKey = (options: {
  language?: string | null;
  text?: string | null;
  voiceType?: string | null;
}) =>
  [
    getWorkspaceSegmentVoiceoverTextHash(options.text ?? ""),
    String(options.voiceType ?? "").trim(),
    String(options.language ?? "").trim().toLowerCase(),
  ].join(":");

export const resolveWorkspaceSegmentActivationPlaybackIndex = (
  segments: Array<{ index: number }>,
  boundedSegmentArrayIndex: number,
  options?: { pendingPlaybackIndex?: number | null },
) => {
  if (options && "pendingPlaybackIndex" in options) {
    return options.pendingPlaybackIndex ?? null;
  }

  return segments[boundedSegmentArrayIndex] ? boundedSegmentArrayIndex : null;
};

export const resolveWorkspaceSegmentThumbFinalInsertIndex = (
  isDragActive: boolean,
  previewInsertIndex: number | null,
  pointerInsertIndex: number | null,
) => (isDragActive ? previewInsertIndex ?? pointerInsertIndex : null);
