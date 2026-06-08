import {
  getWorkspaceSegmentEditorDisplayEndTime,
  getWorkspaceSegmentEditorDisplayStartTime,
  normalizeWorkspaceSegmentManualDurationSeconds,
  roundWorkspaceSegmentTimelineSeconds,
  type WorkspaceSegmentDurationMode,
} from "../../lib/workspaceSegmentEditorTimeline";
import {
  ensureStudioUploadedAssetId,
  resolveStudioCustomAssetDataUrl,
} from "./workspace-upload-helpers";
import {
  fallbackStudioSubtitleColorOption,
  fallbackStudioSubtitleStyleOption,
  getStudioCustomVideoFileDurationSeconds,
  getStudioCustomVideoFileIdentityKey,
  getWorkspaceSegmentCurrentVisualIdentityKey,
  getWorkspaceSegmentCustomAssetId,
  getWorkspaceSegmentCustomPreviewKind,
  getWorkspaceSegmentEffectiveSubtitleSettings,
  getWorkspaceSegmentOriginalVisualIdentityKey,
  getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds,
  getWorkspaceSegmentSubtitleColorOverrideId,
  getWorkspaceSegmentSubtitleStyleOverrideId,
  getWorkspaceSegmentSubtitleTypeOverrideId,
  getWorkspaceSegmentVoiceSourceDurationSeconds,
  getWorkspaceSegmentVoiceSourceEndTime,
  getWorkspaceSegmentVoiceSourceStartTime,
  getWorkspaceSegmentVoiceOverrideId,
  hasWorkspaceSegmentDisplayAiVideoAsset,
  hasWorkspaceSegmentPersistedMediaReference,
  isWorkspaceSegmentCurrentVisualDifferentFromOriginal,
  isWorkspaceSegmentVoiceoverAssetFresh,
  normalizeWorkspaceSegmentDurationMode,
  normalizeWorkspaceSegmentEditorSetting,
  rebuildWorkspaceSegmentEditorDraftTimeline,
  resolveWorkspaceSegmentEditorMediaUploadScope,
} from "./workspace-segment-editor";
import { getWorkspaceSegmentSceneSoundAssetId } from "./workspace-segment-editor-checklist";
import { WORKSPACE_SEGMENT_TALKING_PHOTO_DURATION_OVERFLOW_TOLERANCE_SECONDS } from "./workspace-segment-editor-storage";
import {
  isWorkspaceSegmentAiPhotoReady,
  isWorkspaceSegmentImageEditReady,
} from "./workspace-segment-visual-helpers";
import type {
  StudioCustomVideoFile,
  StudioLanguage,
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentEditorDraftSession,
  WorkspaceSegmentEditorVideoAction,
} from "./workspace-types";

export type WorkspaceSegmentEditorPayloadVideoAction = "ai" | "custom" | "original" | "talking_photo";

export type WorkspaceSegmentEditorPayloadSegment = {
  customVideoAssetId?: number;
  customVideoFileDataUrl?: string;
  customVideoFileMimeType?: string;
  customVideoFileName?: string;
  customVideoRemoteUrl?: string;
  customVideoFileUploadKey?: string;
  duration?: number;
  durationExtensionSourceDurationSeconds?: number | null;
  durationMode?: WorkspaceSegmentDurationMode;
  endTime?: number;
  index: number;
  manualDurationSeconds?: number | null;
  resetVisual?: boolean;
  sceneSoundAssetId?: number;
  startTime?: number;
  subtitleColor?: string | null;
  subtitleStyle?: string | null;
  subtitleType?: string | null;
  text: string;
  videoAction: WorkspaceSegmentEditorPayloadVideoAction;
  voiceoverAssetId?: number;
  voiceSourceDuration?: number | null;
  voiceSourceEndTime?: number | null;
  voiceSourceStartTime?: number | null;
  voiceType?: string | null;
};

export type WorkspaceSegmentEditorPayload = {
  allowStructureChange?: boolean;
  projectId?: number | null;
  segments: WorkspaceSegmentEditorPayloadSegment[];
  source?: "project" | "scratch";
};

export type WorkspaceSegmentEditorUploadFile = {
  fieldName: string;
  file: File;
  fileName: string;
};

/** If the user opened a generation mode but never produced an asset, export uses the segment's original media. */
const resolveWorkspaceSegmentExportVideoAction = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentEditorVideoAction => {
  const { videoAction } = segment;
  if (videoAction === "ai" && !hasWorkspaceSegmentDisplayAiVideoAsset(segment, "ai_video")) {
    return "original";
  }
  if (videoAction === "photo_animation" && !hasWorkspaceSegmentDisplayAiVideoAsset(segment, "photo_animation")) {
    return "original";
  }
  if (videoAction === "talking_photo" && !hasWorkspaceSegmentDisplayAiVideoAsset(segment, "talking_photo")) {
    return "original";
  }
  if (videoAction === "ai_photo" && !isWorkspaceSegmentAiPhotoReady(segment)) {
    return "original";
  }
  if (videoAction === "image_edit" && !isWorkspaceSegmentImageEditReady(segment)) {
    return "original";
  }
  if (videoAction === "custom" && !segment.customVideo) {
    return "original";
  }
  return videoAction;
};

const isWorkspaceSegmentCustomVisualSameAsOriginal = (
  segment: WorkspaceSegmentEditorDraftSegment,
  asset: StudioCustomVideoFile | null | undefined,
) => {
  const assetIdentity = getStudioCustomVideoFileIdentityKey(asset);
  if (!assetIdentity) {
    return false;
  }

  return getWorkspaceSegmentOriginalVisualIdentityKey(segment) === assetIdentity;
};

const isWorkspaceSegmentCustomVisualSameAsCurrent = (
  segment: WorkspaceSegmentEditorDraftSegment,
  asset: StudioCustomVideoFile | null | undefined,
) => {
  const assetIdentity = getStudioCustomVideoFileIdentityKey(asset);
  if (!assetIdentity) {
    return false;
  }

  return getWorkspaceSegmentCurrentVisualIdentityKey(segment) === assetIdentity;
};

export const buildWorkspaceSegmentEditorPayload = async (
  session: WorkspaceSegmentEditorDraftSession,
  options: {
    allowStructureChange?: boolean;
    language: StudioLanguage;
    persistedSegmentIndexes?: readonly number[];
  },
): Promise<{ payload: WorkspaceSegmentEditorPayload; uploads: WorkspaceSegmentEditorUploadFile[] }> => {
  const segments: WorkspaceSegmentEditorPayloadSegment[] = [];
  const uploads: WorkspaceSegmentEditorUploadFile[] = [];
  const normalizedSegments = rebuildWorkspaceSegmentEditorDraftTimeline(session.segments, session);
  const isScratchSession = !Number.isInteger(session.projectId) || session.projectId <= 0;
  let timelineCursor = 0;

  for (const segment of normalizedSegments) {
    const mediaUploadScope = isScratchSession
      ? {}
      : resolveWorkspaceSegmentEditorMediaUploadScope(session, segment, {
          allowStructureChange: options.allowStructureChange,
          persistedSegmentIndexes: options.persistedSegmentIndexes,
        });
    const resolvedExportAction = resolveWorkspaceSegmentExportVideoAction(segment);
    const exportAction =
      isScratchSession && resolvedExportAction === "original" && !hasWorkspaceSegmentPersistedMediaReference(segment)
        ? "ai"
        : resolvedExportAction;
    const selectedAiVideoAsset =
      exportAction === "ai"
        ? hasWorkspaceSegmentDisplayAiVideoAsset(segment, "ai_video")
          ? segment.aiVideoAsset
          : null
        : exportAction === "photo_animation"
          ? hasWorkspaceSegmentDisplayAiVideoAsset(segment, "photo_animation")
            ? segment.aiVideoAsset
            : null
        : exportAction === "talking_photo"
          ? hasWorkspaceSegmentDisplayAiVideoAsset(segment, "talking_photo")
            ? segment.aiVideoAsset
            : null
          : null;
    const customVisualAsset =
      exportAction === "custom"
        ? segment.customVideo
        : exportAction === "image_edit"
          ? segment.imageEditAsset
          : exportAction === "ai_photo"
            ? segment.aiPhotoAsset
            : selectedAiVideoAsset
              ? selectedAiVideoAsset
              : null;
    const isTalkingPhotoExport = exportAction === "talking_photo" && Boolean(selectedAiVideoAsset);
    const payloadVideoAction: WorkspaceSegmentEditorPayloadVideoAction =
      isTalkingPhotoExport
        ? "talking_photo"
        : exportAction === "ai_photo" || exportAction === "image_edit" || Boolean(selectedAiVideoAsset)
        ? "custom"
        : exportAction === "photo_animation" || exportAction === "talking_photo"
          ? "original"
          : exportAction;
    let customVideoFileDataUrl: string | undefined;
    let customVideoAssetId: number | undefined;
    let customVideoFileUploadKey: string | undefined;
    let customVideoRemoteUrl: string | undefined;
    let sceneSoundAssetId = getWorkspaceSegmentSceneSoundAssetId(segment.sceneSoundAsset) ?? undefined;
    const payloadVideoActionForSegment: WorkspaceSegmentEditorPayloadVideoAction =
      !isTalkingPhotoExport &&
      payloadVideoAction === "custom" &&
      isWorkspaceSegmentCustomVisualSameAsCurrent(segment, customVisualAsset) &&
      isWorkspaceSegmentCurrentVisualDifferentFromOriginal(segment)
        ? "original"
        : payloadVideoAction;
    const shouldAttachCustomVisualAsset = payloadVideoActionForSegment === "custom" || isTalkingPhotoExport;

    if (shouldAttachCustomVisualAsset) {
      if (isWorkspaceSegmentCustomVisualSameAsOriginal(segment, customVisualAsset)) {
        throw new Error(
          `Визуал сегмента ${segment.index + 1} не обновился. Сгенерируйте ИИ фото ещё раз или обновите редактор.`,
        );
      }

      if (customVisualAsset?.assetId) {
        customVideoAssetId = customVisualAsset.assetId;
      } else if (customVisualAsset) {
        customVideoAssetId = (await ensureStudioUploadedAssetId(customVisualAsset, {
          fallbackFileName: customVisualAsset.fileName || `segment-visual-${segment.index + 1}.bin`,
          fallbackMimeType: customVisualAsset.mimeType,
          kind: isTalkingPhotoExport ? "talking_photo" : "segment_source",
          language: options.language,
          mediaType: getWorkspaceSegmentCustomPreviewKind(customVisualAsset) === "image" ? "photo" : "video",
          projectId: mediaUploadScope.projectId,
          role: isTalkingPhotoExport ? "talking_photo" : "segment_source",
          segmentIndex: mediaUploadScope.segmentIndex,
        })) ?? undefined;
      }

      if (!customVideoAssetId && typeof customVisualAsset?.remoteUrl === "string" && customVisualAsset.remoteUrl.trim()) {
        customVideoRemoteUrl = customVisualAsset.remoteUrl.trim();
      } else {
        customVideoFileDataUrl = customVideoAssetId ? undefined : await resolveStudioCustomAssetDataUrl(customVisualAsset);
      }
    }

    if (!sceneSoundAssetId && segment.sceneSoundAsset) {
      sceneSoundAssetId = (await ensureStudioUploadedAssetId(segment.sceneSoundAsset, {
        fallbackFileName: segment.sceneSoundAsset.fileName || `segment-${segment.index + 1}-scene-sound.wav`,
        fallbackMimeType: segment.sceneSoundAsset.mimeType || "audio/wav",
        kind: "segment_sound",
        language: options.language,
        mediaType: "audio",
        projectId: mediaUploadScope.projectId,
        role: "segment_sound",
        segmentIndex: mediaUploadScope.segmentIndex,
      })) ?? undefined;
    }

    const durationMode =
      isTalkingPhotoExport
        ? "manual"
        : normalizeWorkspaceSegmentDurationMode(segment.durationMode);
    const manualDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds);
    const startTime = timelineCursor;
    const sourceStartTime = getWorkspaceSegmentEditorDisplayStartTime(segment);
    const timelineDuration = getWorkspaceSegmentEditorDisplayEndTime(segment) - sourceStartTime;
    const normalizedTimelineDuration = normalizeWorkspaceSegmentManualDurationSeconds(timelineDuration);
    const normalizedSegmentDuration = normalizeWorkspaceSegmentManualDurationSeconds(segment.duration);
    const manualDurationCandidates = [manualDurationSeconds, normalizedTimelineDuration, normalizedSegmentDuration].filter(
      (value): value is number => value !== null,
    );
    const resolvedManualDurationSeconds =
      durationMode === "manual" && manualDurationCandidates.length > 0
          ? Math.max(...manualDurationCandidates)
          : null;
    const rawDuration =
      durationMode === "manual" && resolvedManualDurationSeconds !== null
        ? resolvedManualDurationSeconds
        : normalizedSegmentDuration ?? normalizedTimelineDuration ?? undefined;
    const duration = typeof rawDuration === "number" ? roundWorkspaceSegmentTimelineSeconds(rawDuration) : undefined;
    const endTime = typeof duration === "number" ? roundWorkspaceSegmentTimelineSeconds(startTime + duration) : segment.endTime;
    const roundedManualDurationSeconds =
      durationMode === "manual" && resolvedManualDurationSeconds !== null
        ? roundWorkspaceSegmentTimelineSeconds(resolvedManualDurationSeconds)
        : null;
    const talkingPhotoMediaDurationSeconds = isTalkingPhotoExport
      ? getStudioCustomVideoFileDurationSeconds(selectedAiVideoAsset)
      : null;
    if (
      isTalkingPhotoExport &&
      typeof duration === "number" &&
      talkingPhotoMediaDurationSeconds !== null &&
      talkingPhotoMediaDurationSeconds > duration + WORKSPACE_SEGMENT_TALKING_PHOTO_DURATION_OVERFLOW_TOLERANCE_SECONDS
    ) {
      throw new Error(
        `Говорящий персонаж сегмента ${segment.index + 1} длиннее таймлайна сцены. Увеличьте длительность сегмента и попробуйте экспорт снова.`,
      );
    }
    const roundedStartTime = roundWorkspaceSegmentTimelineSeconds(startTime);
    if (typeof duration === "number") {
      timelineCursor = endTime;
    }
    const segmentVoiceType = isTalkingPhotoExport ? "none" : getWorkspaceSegmentVoiceOverrideId(segment);
    const segmentHasVoice =
      segmentVoiceType === "none"
        ? false
        : normalizeWorkspaceSegmentEditorSetting(session.voiceType) !== "none" || Boolean(segmentVoiceType);
    const segmentSubtitleTypeOverride = getWorkspaceSegmentSubtitleTypeOverrideId(segment);
    const segmentSubtitleStyle = segmentHasVoice ? getWorkspaceSegmentSubtitleStyleOverrideId(segment) : null;
    const segmentSubtitleColor = segmentHasVoice ? getWorkspaceSegmentSubtitleColorOverrideId(segment) : null;
    const segmentEffectiveSubtitleSettings = getWorkspaceSegmentEffectiveSubtitleSettings(session, segment, {
      subtitleColorId: fallbackStudioSubtitleColorOption.id,
      subtitleStyleId: fallbackStudioSubtitleStyleOption.id,
    });
    const segmentSubtitleType = segmentHasVoice
      ? segmentSubtitleTypeOverride ??
        (!segmentEffectiveSubtitleSettings.globalEnabled &&
        segmentEffectiveSubtitleSettings.isEnabled &&
        (segmentSubtitleStyle || segmentSubtitleColor)
          ? "default"
          : null)
      : "none";
    const voiceoverAssetId = isWorkspaceSegmentVoiceoverAssetFresh(segment, session)
      ? getWorkspaceSegmentCustomAssetId(segment.voiceoverAsset) ?? undefined
      : undefined;
    const shouldPreserveProjectVoiceSource = !voiceoverAssetId;
    const voiceSourceDuration = shouldPreserveProjectVoiceSource
      ? getWorkspaceSegmentVoiceSourceDurationSeconds(segment)
      : null;
    const voiceSourceEndTime = shouldPreserveProjectVoiceSource
      ? getWorkspaceSegmentVoiceSourceEndTime(segment)
      : null;
    const voiceSourceStartTime = shouldPreserveProjectVoiceSource
      ? getWorkspaceSegmentVoiceSourceStartTime(segment)
      : null;

    segments.push({
      customVideoAssetId,
      customVideoFileDataUrl,
      customVideoFileMimeType: shouldAttachCustomVisualAsset ? customVisualAsset?.mimeType : undefined,
      customVideoFileName: shouldAttachCustomVisualAsset ? customVisualAsset?.fileName : undefined,
      customVideoRemoteUrl,
      customVideoFileUploadKey,
      duration,
      durationExtensionSourceDurationSeconds: getWorkspaceSegmentStoredDurationExtensionSourceDurationSeconds(segment),
      durationMode,
      endTime,
      // Keep the original segment identity in `index`; array order carries the new sequence after reorder.
      index: segment.index,
      manualDurationSeconds: roundedManualDurationSeconds,
      resetVisual: Boolean(segment.visualReset),
      sceneSoundAssetId,
      startTime: roundedStartTime,
      ...(segmentSubtitleColor ? { subtitleColor: segmentSubtitleColor } : {}),
      ...(segmentSubtitleStyle ? { subtitleStyle: segmentSubtitleStyle } : {}),
      ...(segmentSubtitleType ? { subtitleType: segmentSubtitleType } : {}),
      text: segment.text,
      videoAction: payloadVideoActionForSegment,
      voiceoverAssetId,
      ...(voiceSourceDuration !== null ? { voiceSourceDuration } : {}),
      ...(voiceSourceEndTime !== null ? { voiceSourceEndTime } : {}),
      ...(voiceSourceStartTime !== null ? { voiceSourceStartTime } : {}),
      voiceType: segmentVoiceType,
    });
  }

  return {
    payload: {
      allowStructureChange: Boolean(options.allowStructureChange),
      ...(isScratchSession ? {} : { projectId: session.projectId }),
      segments,
      source: isScratchSession ? "scratch" : "project",
    },
    uploads,
  };
};
