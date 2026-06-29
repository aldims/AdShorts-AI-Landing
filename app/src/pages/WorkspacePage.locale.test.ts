// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { DEFAULT_STUDIO_VOICE_ID } from "../../shared/locales";
import { STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST } from "../../shared/studio-credit-costs";
import {
  applyWorkspaceSegmentEditorGlobalVoiceToSegments,
  clearWorkspaceSegmentEditorVoiceoverGenerationState,
  createWorkspaceSegmentEditorDraftSession,
  getWorkspaceSegmentEmbeddedTalkingPhotoAudioDurationSeconds,
  getWorkspaceSegmentEditorProjectVoiceType,
  getWorkspaceSegmentLatestVisualAction,
  getWorkspaceSegmentVoiceOverrideId,
  hasWorkspaceSegmentEditorGeneratedShortsFromProject,
  isWorkspaceSegmentVoiceoverPlaybackFresh,
  isWorkspaceSegmentPersistedForVisualJobBinding,
} from "../features/workspace/workspace-segment-editor";
import {
  readStoredWorkspaceSegmentEditorDraft,
  readStoredWorkspaceSegmentEditorDrafts,
  readStoredWorkspaceSegmentEditorSession,
  readStoredWorkspaceSegmentImageEditJobs,
  readStoredWorkspaceSegmentEditorConsumedSourceProject,
  readStoredWorkspaceSegmentPhotoAnimationJobs,
  readStoredWorkspaceSegmentTalkingPhotoJobs,
  removeStoredWorkspaceSegmentEditorConsumedSourceProject,
  writeStoredWorkspaceSegmentEditorDraft,
  writeStoredWorkspaceSegmentEditorConsumedSourceProject,
  writeStoredWorkspaceSegmentEditorSession,
  upsertStoredWorkspaceSegmentImageEditJob,
  upsertStoredWorkspaceSegmentPhotoAnimationJob,
  upsertStoredWorkspaceSegmentTalkingPhotoJob,
} from "../features/workspace/workspace-segment-editor-storage";
import {
  getWorkspaceSegmentVisualTimelineHistoryState,
  isWorkspaceSegmentDraftVoiceEdited,
} from "../features/workspace/workspace-segment-editor-checklist";
import { buildWorkspaceSegmentEditorTracks } from "../lib/workspaceSegmentEditorTracks";
import {
  createWorkspaceSegmentEditorProjectBrandState,
  resolveWorkspaceSegmentEditorEffectiveBrandState,
} from "../features/workspace/workspace-brand-helpers";
import {
  applyWorkspaceSegmentMeasuredSceneVoiceoverDuration,
  applyWorkspaceSegmentEditorSceneVoiceOverride,
  buildWorkspaceSegmentEditorPayload,
  buildStudioRouteUrl,
  buildWorkspaceSegmentEditorChangeChecklist,
  buildWorkspaceSegmentVisualReferenceRequest,
  canWorkspaceSegmentUseVideoExtensionTool,
  clearWorkspaceSegmentSceneSoundState,
  createStudioCustomVideoFileFromMediaLibraryItem,
  buildWorkspaceReferenceAiPrompt,
  buildWorkspacePromptCharacterMentionTokens,
  buildWorkspacePromptRichEditorHtml,
  clearStoredWorkspaceSegmentEditorTemporaryStateExcept,
  createWorkspaceSegmentEditorInsertedSegment,
  createWorkspaceSegmentEditorResetDraftFromBaseline,
  createWorkspaceSegmentEditorScratchDraftSession,
  distributeWorkspaceSegmentBulkSubtitleText,
  doesWorkspaceSegmentEditorPayloadMatchSessionStructure,
  getWorkspacePromptRichEditorSelectionRange,
  getWorkspaceMediaLibraryItemRemoteUrl,
  getStudioLanguageForVoiceId,
  getStudioVoiceCreditCost,
  getWorkspaceGenerationRequiredCredits,
  getNextWorkspaceReferenceDefaultName,
  buildWorkspaceReferenceGenerationMediaScope,
  formatWorkspaceSegmentEditorSegmentDurationLabel,
  formatWorkspaceSegmentEditorSegmentTimeRange,
  getWorkspaceSegmentEditorEffectiveSubtitleSelection,
  getWorkspaceSegmentEffectiveSubtitleSettings,
  insertWorkspacePromptCharacterMentionText,
  mapWorkspaceTalkingCharacterTargetToSourceFrame,
  removeWorkspacePromptCharacterMentionText,
  resolveWorkspacePromptCharacterBillingQuality,
  resolveWorkspacePromptMentionedCharacterOptions,
  createWorkspaceTalkingCharacterTargetFromPoints,
  createWorkspaceTalkingCharacterDraftTargetFromPoints,
  getWorkspaceSegmentDraftVisualStatus,
  getWorkspaceSegmentDurationExtensionPlan,
  getWorkspaceSegmentDurationExtensionSourceDurationSeconds,
  getWorkspaceSegmentDraftSourceLabel,
  getWorkspaceSegmentDraftSourceDisplayLabel,
  getWorkspaceSegmentEditorVisualDurationMaxSeconds,
  WORKSPACE_SEGMENT_EDITOR_MAX_VISUAL_DURATION_SECONDS,
  resolveWorkspaceSegmentAiDurationExtensionEffectiveTargetSeconds,
  resolveWorkspaceSegmentAiDurationExtensionTargetSeconds,
  getWorkspaceSegmentVisualAudioDurationMismatchInfo,
  resolveWorkspaceSegmentTimelineVisualAudioMismatchInfo,
  restoreWorkspaceSegmentSceneSoundState,
  shouldPreserveWorkspaceSegmentManualVisualDurationForVoiceover,
  shouldPreserveWorkspaceSegmentUserVisualDurationForVoiceover,
  getWorkspaceSegmentVoiceoverDurationSeconds,
  getWorkspaceSegmentTimelineVoiceoverDurationInfo,
  getWorkspaceSegmentVoiceoverAudioPreviewSource,
  getWorkspaceSegmentVideoVisualDurationSeconds,
  getWorkspaceSegmentVideoVisualSourceDurationSeconds,
  resolveWorkspaceSegmentProjectVoiceoverFullPreviewAudioRange,
  shouldUseWorkspaceSegmentProjectVoiceoverSegmentProxyInFullPreview,
  getWorkspaceSegmentVoiceoverPreviewRange,
  getWorkspaceSegmentVoiceoverTextHash,
  getWorkspaceSegmentRecommendedDurationSeconds,
  getWorkspaceSegmentSceneSoundRefreshPrompt,
  getWorkspaceSegmentSceneSoundDurationSeconds,
  normalizeWorkspaceTalkingCharacterTarget,
  getWorkspaceInitialStudioDefaults,
  getWorkspaceSegmentEditorGenerationOverrides,
  getWorkspaceSegmentVisualGenerationDurationSeconds,
  getWorkspaceSegmentDraftPosterUrl,
  getWorkspaceSegmentDraftPreviewFallbackUrls,
  getWorkspaceSegmentDraftPreviewUrl,
  getWorkspaceSegmentDraftVideoUrl,
  getWorkspaceSegmentVisualDurationMeasurementUrl,
  getWorkspaceSegmentEditorCarouselNavigation,
  getWorkspaceSegmentEditorCarouselSlots,
  getWorkspaceSegmentEditorProjectOpenOptions,
  getStudioRouteState,
  getWorkspaceSegmentMediaIdentityKey,
  getWorkspaceSegmentResolvedMediaSurface,
  buildWorkspaceGeneratedMediaLibraryEntry,
  buildWorkspaceGeneratedMediaLibraryEntriesFromMediaLibraryItems,
  hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary,
  readStoredWorkspaceSegmentEditorBrandSnapshot,
  isWorkspaceSegmentEditorCleanEmptyDraft,
  isWorkspaceSegmentEditorDraftSegmentEmpty,
  isWorkspaceSegmentDraftVisualChangedFromBaseline,
  isWorkspaceSegmentDraftVisualResettable,
  normalizeStoredWorkspaceSegmentEditorDraftSession,
  preserveWorkspaceSegmentEditorOriginalVisualReferences,
  refreshWorkspaceSegmentEditorDraftWithFreshSession,
  resolveWorkspaceSegmentEditorSegmentsAfterDelete,
  resolveWorkspaceSegmentEditorMediaUploadScope,
  resolveWorkspaceSegmentEditorProjectBrandSnapshot,
  resolveWorkspaceSegmentEditorChangeDisplayBaselineSession,
  resolveWorkspaceSegmentEditorLoadedBaselineSession,
  resolveWorkspaceSegmentEditorPendingRouteSync,
  resolveWorkspaceSegmentEditorScratchDraftOpenSource,
  shouldResetWorkspaceSegmentEditorConsumedSourceProject,
  shouldRequestWorkspaceSegmentEditorOpenRouteRefresh,
  shouldRequestWorkspaceSegmentEditorFreshRouteSession,
  shouldSkipWorkspaceSegmentEditorActiveDraftReopen,
  resolveWorkspaceGenerationEffectiveVideoMode,
  resolveWorkspaceExamplePrefillInitialStudioState,
  resolveWorkspaceRegenerationVideoMode,
  resetWorkspaceSegmentEditorDraftTrackSettingsForBlankScene,
  resetWorkspaceSegmentDraftVisualToOriginal,
  resolveWorkspaceSegmentBoundaryTiming,
  resolveWorkspaceSegmentThumbFinalInsertIndex,
  resolveWorkspaceGenerationVoiceRequest,
  resolveWorkspaceExamplePrefillSubtitleSelection,
  resolveWorkspaceSegmentActivationPlaybackIndex,
  resolveWorkspaceSegmentEditorStructureChangePermission,
  resolveWorkspaceSegmentDurationMenuTrimLabels,
  resolveWorkspaceSegmentDurationExtensionRequestTiming,
  resolveWorkspaceSegmentVideoTrimDuration,
  resolveWorkspaceSegmentTimelineVisualDurationDisplay,
  resolveWorkspaceSegmentGeneratedVoiceoverEdited,
  resolveWorkspaceProjectVoiceoverPendingSegments,
  rebuildWorkspaceSegmentEditorDraftSessionTimeline,
  resolveWorkspaceSegmentPhotoDurationVoiceoverGuard,
  resolveWorkspaceSegmentVisualDurationMaxGuard,
  resolveWorkspaceSegmentVoiceTimelineState,
  restoreWorkspaceSegmentVoiceTextDraftSnapshot,
  restoreWorkspaceSegmentVoiceTextDraftSessionSnapshot,
  restoreWorkspaceSegmentTimelineSnapshot,
  resolveStudioVoiceIdForLanguage,
  shouldConfirmWorkspaceSegmentEditorSegmentDelete,
  shouldShowWorkspaceSegmentAiDurationExtensionVoiceoverTrim,
  shouldAllowWorkspaceSegmentEditorStructureChange,
  shouldRecoverWorkspaceSegmentEditorExplicitStructureChange,
  shouldResetWorkspaceSegmentEditorDraftTrackSettingsForBlankScene,
  shouldSuppressWorkspaceSegmentEditorEmptyDraftChanges,
  shouldAllowWorkspaceSegmentPreviewVideoPlayback,
  shouldDeferSegmentEditorRouteRestore,
  shouldShowWorkspaceMediaLibraryLoadingState,
  studioVoiceOptionsByLanguage,
  writeStoredWorkspaceSegmentEditorBrandSnapshot,
} from "./WorkspacePage";

type DraftSegment = Parameters<typeof isWorkspaceSegmentDraftVisualResettable>[0];
type DraftSession = Parameters<typeof refreshWorkspaceSegmentEditorDraftWithFreshSession>[0];
type FreshSession = Parameters<typeof refreshWorkspaceSegmentEditorDraftWithFreshSession>[1];
type GeneratedMediaLibraryEntry = Parameters<typeof hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary>[1][number];
type MediaLibraryItem = Parameters<typeof createStudioCustomVideoFileFromMediaLibraryItem>[0];

describe("WorkspacePage segment timeline drag drop", () => {
  it("commits the previewed drop position when pointerup coordinates drift", () => {
    expect(resolveWorkspaceSegmentThumbFinalInsertIndex(true, 4, 1)).toBe(4);
  });

  it("falls back to the pointer position when no preview position exists", () => {
    expect(resolveWorkspaceSegmentThumbFinalInsertIndex(true, null, 3)).toBe(3);
  });

  it("does not commit a drop when dragging never started", () => {
    expect(resolveWorkspaceSegmentThumbFinalInsertIndex(false, 4, 3)).toBeNull();
  });
});

const createMediaAsset = (
  assetId: number,
  options: {
    kind?: string;
    mediaType?: "photo" | "video";
    role?: string;
    sourceKind?: "ai_generated" | "stock" | "upload" | "unknown";
  } = {},
): NonNullable<DraftSegment["currentAsset"]> => {
  const mediaType = options.mediaType ?? "photo";
  const extension = mediaType === "photo" ? "jpg" : "mp4";

  return {
    assetId,
    createdAt: "2026-04-09T00:00:00.000Z",
    deletedAt: null,
    downloadPath: `/api/media/${assetId}/download`,
    downloadUrl: null,
    expiresAt: null,
    isCurrent: true,
    kind: options.kind ?? "segment_original",
    lifecycle: "ready",
    libraryKind: null,
    mediaType,
    mimeType: mediaType === "photo" ? "image/jpeg" : "video/mp4",
    originalUrl: null,
    playbackUrl: `/api/media/${assetId}/download`,
    projectId: 77,
    role: options.role ?? "segment_original",
    segmentIndex: 0,
    sourceKind: options.sourceKind ?? "ai_generated",
    status: "ready",
    storageKey: `users/1/projects/77/${assetId}.${extension}`,
  };
};

const createDraftSegment = (overrides: Partial<DraftSegment> = {}): DraftSegment => ({
  aiPhotoAsset: null,
  aiPhotoGeneratedFromPrompt: null,
  aiPhotoPrompt: "",
  aiPhotoPromptInitialized: false,
  aiVideoAsset: null,
  aiVideoGeneratedMode: null,
  aiVideoGeneratedFromPrompt: null,
  aiVideoPrompt: "",
  aiVideoPromptInitialized: false,
  currentAsset: null,
  currentExternalPlaybackUrl: null,
  currentExternalPreviewUrl: null,
  currentPlaybackUrl: null,
  currentPosterUrl: null,
  currentPreviewUrl: null,
  currentSourceKind: "unknown",
  customVideo: null,
  duration: 4,
  durationMode: "auto",
  endTime: 4,
  imageEditAsset: null,
  imageEditGeneratedFromPrompt: null,
  imageEditPrompt: "",
  imageEditPromptInitialized: false,
  index: 0,
  manualDurationSeconds: null,
  mediaType: "photo",
  originalAsset: null,
  originalExternalPlaybackUrl: null,
  originalExternalPreviewUrl: null,
  originalPlaybackUrl: null,
  originalPosterUrl: null,
  originalPreviewUrl: null,
  originalSourceKind: "unknown",
  originalText: "Segment",
  originalTextByLanguage: { ru: "Segment" },
  photoAnimationSourceAsset: null,
  sceneSoundAsset: null,
  sceneSoundGeneratedFromPrompt: null,
  sceneSoundPrompt: "",
  sceneSoundPromptInitialized: false,
  speechDuration: null,
  speechDurationSource: null,
  speechEndTime: null,
  speechStartTime: null,
  speechWords: [],
  startTime: 0,
  text: "Segment",
  textByLanguage: { ru: "Segment" },
  voiceoverAsset: null,
  voiceoverLanguage: null,
  voiceoverTextHash: null,
  voiceoverVoiceType: null,
  voiceSourceDuration: null,
  voiceSourceEndTime: null,
  voiceSourceStartTime: null,
  videoAction: "original",
  visualReset: false,
  ...overrides,
});

const createDraftSession = (segment: DraftSegment): DraftSession => ({
  customMusicAssetId: null,
  customMusicFileName: "",
  description: "",
  language: "ru",
  musicType: "ai",
  projectId: 77,
  segments: [segment],
  subtitleColor: "purple",
  subtitleStyle: "modern",
  subtitleType: "karaoke",
  title: "Session",
  voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
});

const createFreshSession = (segment: DraftSegment): FreshSession => ({
  customMusicAssetId: null,
  customMusicFileName: "",
  description: "",
  language: "ru",
  musicType: "ai",
  projectId: 77,
  segments: [
    {
      currentAsset: segment.currentAsset,
      currentExternalPlaybackUrl: segment.currentExternalPlaybackUrl,
      currentExternalPreviewUrl: segment.currentExternalPreviewUrl,
      currentPlaybackUrl: segment.currentPlaybackUrl,
      currentPosterUrl: segment.currentPosterUrl,
      currentPreviewUrl: segment.currentPreviewUrl,
      currentSourceKind: segment.currentSourceKind,
      duration: segment.duration,
      durationExtensionSourceDurationSeconds: segment.durationExtensionSourceDurationSeconds,
      durationMode: segment.durationMode,
      endTime: segment.endTime,
      index: segment.index,
      manualDurationSeconds: segment.manualDurationSeconds,
      mediaType: segment.mediaType,
      originalAsset: segment.originalAsset,
      originalExternalPlaybackUrl: segment.originalExternalPlaybackUrl,
      originalExternalPreviewUrl: segment.originalExternalPreviewUrl,
      originalPlaybackUrl: segment.originalPlaybackUrl,
      originalPosterUrl: segment.originalPosterUrl,
      originalPreviewUrl: segment.originalPreviewUrl,
      originalSourceKind: segment.originalSourceKind,
      speechDuration: segment.speechDuration,
      speechDurationSource: segment.speechDurationSource ?? null,
      speechEndTime: segment.speechEndTime,
      speechStartTime: segment.speechStartTime,
      speechWords: segment.speechWords,
      startTime: segment.startTime,
      text: segment.text,
      voiceSourceDuration: segment.voiceSourceDuration ?? null,
      voiceSourceEndTime: segment.voiceSourceEndTime ?? null,
      voiceSourceStartTime: segment.voiceSourceStartTime ?? null,
    },
  ],
  subtitleColor: "purple",
  subtitleStyle: "modern",
  subtitleType: "karaoke",
  title: "Session",
  voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
});

const createFreshSessionFromDraftSegments = (segments: DraftSegment[]): FreshSession => ({
  ...createFreshSession(segments[0] ?? createDraftSegment()),
  segments: segments.map((segment) => createFreshSession(segment).segments[0]!),
});

describe("WorkspacePage generation credits", () => {
  it("uses segment-editor scene voice overrides for the final generation cost", () => {
    const draft = {
      ...createDraftSession(createDraftSegment({ voiceType: "Liam" })),
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    };

    expect(
      getWorkspaceGenerationRequiredCredits("standard", {
        isSegmentEditorGeneration: true,
        segmentEditorSession: draft,
        voiceEnabled: true,
        voiceId: DEFAULT_STUDIO_VOICE_ID.ru,
      }),
    ).toBe(STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST + getStudioVoiceCreditCost("Liam"));
  });
});

const createGeneratedMediaLibraryEntry = (
  assetId: number,
  kind: GeneratedMediaLibraryEntry["item"]["kind"] = "ai_photo",
  overrides: Partial<GeneratedMediaLibraryEntry["item"]> = {},
): GeneratedMediaLibraryEntry => {
  const segmentIndex = typeof overrides.segmentIndex === "number" ? overrides.segmentIndex : 0;
  const sourceJobId = `test-job-${assetId}`;
  const item: GeneratedMediaLibraryEntry["item"] = {
    assetExpiresAt: null,
    assetId,
    assetKind: null,
    assetLifecycle: null,
    assetMediaType: kind === "ai_photo" || kind === "image_edit" ? "photo" : "video",
    createdAt: 1,
    dedupeKey: `live:${kind}:job:${sourceJobId}`,
    downloadName: "segment-ai-photo-1.jpg",
    downloadUrl: `/api/workspace/media-assets/${assetId}`,
    itemKey: `live:${kind}:job:${sourceJobId}`,
    kind,
    previewKind: kind === "ai_photo" || kind === "image_edit" ? "image" : "video",
    previewPosterUrl: `/api/workspace/media-assets/${assetId}`,
    previewUrl: `/api/workspace/media-assets/${assetId}`,
    projectId: 77,
    projectTitle: "Session",
    segmentIndex,
    segmentListIndex: segmentIndex,
    segmentNumber: segmentIndex + 1,
    source: "live",
    ...overrides,
  };

  return {
    createdAt: 1,
    id: item.itemKey,
    item,
    sourceJobId,
  };
};

const createMediaLibraryItem = (overrides: Partial<MediaLibraryItem> = {}): MediaLibraryItem => ({
  assetExpiresAt: null,
  assetId: null,
  assetKind: null,
  assetLifecycle: "ready",
  assetMediaType: "photo",
  createdAt: 1,
  dedupeKey: "draft:asset",
  downloadName: "library-image.jpg",
  downloadUrl: null,
  itemKey: "draft:asset",
  kind: "ai_photo",
  previewKind: "image",
  previewPosterUrl: "/api/studio/segment-ai-photo/jobs/job-1/image",
  previewUrl: "/api/studio/segment-ai-photo/jobs/job-1/image",
  projectId: 77,
  projectTitle: "Session",
  segmentIndex: 0,
  segmentListIndex: 0,
  segmentNumber: 1,
  source: "draft",
  ...overrides,
});

describe("WorkspacePage segment subtitle bulk text", () => {
  it("keeps one sentence per segment when sentence and segment counts match", () => {
    const text = "Первое. Второе. Третье. Четвертое. Пятое. Шестое.";
    const result = distributeWorkspaceSegmentBulkSubtitleText(text, 6);

    expect(result.error).toBeNull();
    expect(result.texts).toEqual(["Первое.", "Второе.", "Третье.", "Четвертое.", "Пятое.", "Шестое."]);
  });

  it("splits fewer sentences into enough non-empty segments by words", () => {
    const text = "Первое предложение про героя задает ритм. Второе предложение завершает историю красиво сейчас.";
    const result = distributeWorkspaceSegmentBulkSubtitleText(text, 5);

    expect(result.error).toBeNull();
    expect(result.texts).toEqual([
      "Первое предложение",
      "про героя",
      "задает ритм.",
      "Второе предложение завершает",
      "историю красиво сейчас.",
    ]);
    expect(result.texts.join(" ")).toBe(text);
  });

  it("groups extra sentences into neighboring segment text", () => {
    const result = distributeWorkspaceSegmentBulkSubtitleText("One. Two. Three. Four. Five. Six.", 3);

    expect(result.error).toBeNull();
    expect(result.texts).toEqual(["One. Two.", "Three. Four.", "Five. Six."]);
  });

  it("splits a text without sentence punctuation evenly by words", () => {
    const result = distributeWorkspaceSegmentBulkSubtitleText("one two three four five six seven eight nine ten", 3);

    expect(result.error).toBeNull();
    expect(result.texts).toEqual([
      "one two three four",
      "five six seven",
      "eight nine ten",
    ]);
  });

  it("normalizes extra spaces and line breaks", () => {
    const result = distributeWorkspaceSegmentBulkSubtitleText("  one \n\n two\t three   four  ", 2);

    expect(result.error).toBeNull();
    expect(result.texts).toEqual(["one two", "three four"]);
  });

  it("rejects empty input without producing draft texts", () => {
    const result = distributeWorkspaceSegmentBulkSubtitleText("   \n\t  ", 3);

    expect(result.error).toBe("Введите текст субтитров.");
    expect(result.texts).toEqual([]);
  });

  it("rejects text with fewer words than segments", () => {
    const result = distributeWorkspaceSegmentBulkSubtitleText("one two", 5);

    expect(result.error).toBe("Для 5 сегментов нужно минимум 5 слов.");
    expect(result.texts).toEqual([]);
  });
});

describe("WorkspacePage segment visual references payload", () => {
  it("uses project character ids without duplicating them as asset references", () => {
    expect(
      buildWorkspaceSegmentVisualReferenceRequest({
        characterIds: [12, 12, "bad", 0],
        referenceAssetIds: [],
        sceneReferenceAssetIds: [],
      }),
    ).toEqual({
      characterContinuityMode: "force",
      characterIds: [12],
      preserveCharacters: true,
      referenceAssetIds: [],
      sceneReferenceAssetIds: [],
    });
  });

  it("uses saved character assets as referenceAssetIds", () => {
    expect(
      buildWorkspaceSegmentVisualReferenceRequest({
        characterIds: [],
        referenceAssetIds: [501],
        sceneReferenceAssetIds: [],
      }),
    ).toMatchObject({
      characterContinuityMode: "force",
      characterIds: [],
      preserveCharacters: true,
      referenceAssetIds: [501],
    });
  });

  it("allows character and scene references together", () => {
    expect(
      buildWorkspaceSegmentVisualReferenceRequest({
        characterIds: [],
        referenceAssetIds: [501],
        sceneReferenceAssetIds: [901],
      }),
    ).toEqual({
      characterContinuityMode: "force",
      characterIds: [],
      preserveCharacters: true,
      referenceAssetIds: [501],
      sceneReferenceAssetIds: [901],
    });
  });
});

describe("WorkspacePage talking character target selection", () => {
  it("creates a draggable normalized target area", () => {
    expect(createWorkspaceTalkingCharacterTargetFromPoints({ x: 0.2, y: 0.3 }, { x: 0.5, y: 0.7 })).toEqual({
      height: 0.39999999999999997,
      width: 0.3,
      x: 0.2,
      y: 0.3,
    });
  });

  it("uses a face-sized default box for click selection", () => {
    expect(createWorkspaceTalkingCharacterTargetFromPoints({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toEqual({
      height: 0.34,
      width: 0.28,
      x: 0.36,
      y: 0.32999999999999996,
    });
  });

  it("draws a draft target from the pointer instead of showing the click default", () => {
    expect(createWorkspaceTalkingCharacterDraftTargetFromPoints({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBeNull();
    expect(createWorkspaceTalkingCharacterDraftTargetFromPoints({ x: 0.5, y: 0.5 }, { x: 0.52, y: 0.53 })).toEqual({
      height: 0.030000000000000027,
      width: 0.020000000000000018,
      x: 0.5,
      y: 0.5,
    });
  });

  it("clamps target areas to the frame", () => {
    expect(normalizeWorkspaceTalkingCharacterTarget({ height: 0.5, width: 0.5, x: 0.9, y: -0.2 })).toEqual({
      height: 0.5,
      width: 0.5,
      x: 0.5,
      y: 0,
    });
  });

  it("maps a visible cover-cropped target back to source-frame coordinates", () => {
    expect(
      mapWorkspaceTalkingCharacterTargetToSourceFrame(
        { height: 0.5, width: 0.5, x: 0.25, y: 0.25 },
        {
          containerHeight: 200,
          containerWidth: 200,
          fit: "cover",
          sourceHeight: 200,
          sourceWidth: 400,
        },
      ),
    ).toEqual({
      height: 0.5,
      width: 0.25,
      x: 0.375,
      y: 0.25,
    });
  });

  it("maps portrait source coordinates when the card crops top and bottom", () => {
    expect(
      mapWorkspaceTalkingCharacterTargetToSourceFrame(
        { height: 0.5, width: 0.5, x: 0.25, y: 0.25 },
        {
          containerHeight: 200,
          containerWidth: 200,
          fit: "cover",
          sourceHeight: 400,
          sourceWidth: 200,
        },
      ),
    ).toEqual({
      height: 0.25,
      width: 0.5,
      x: 0.25,
      y: 0.375,
    });
  });
});

describe("WorkspacePage segment visual job binding", () => {
  it("does not bind a new project scene to a server segment just because it has generated media", () => {
    const generatedInsertedSegment = createDraftSegment({
      currentAsset: createMediaAsset(909, { mediaType: "photo", role: "segment_generated" }),
      index: 7,
    });
    const savedSegment = createDraftSegment({ currentAsset: createMediaAsset(101), index: 0 });
    const currentDraft = { ...createDraftSession(savedSegment), segments: [savedSegment, generatedInsertedSegment] };
    const baseline = createDraftSession(savedSegment);

    expect(isWorkspaceSegmentPersistedForVisualJobBinding(currentDraft, 7, baseline)).toBe(false);
    expect(isWorkspaceSegmentPersistedForVisualJobBinding(currentDraft, 0, baseline)).toBe(true);
  });

  it("falls back to media references when no matching baseline is available", () => {
    const generatedSegment = createDraftSegment({
      currentAsset: createMediaAsset(909, { mediaType: "photo", role: "segment_generated" }),
      index: 7,
    });

    expect(isWorkspaceSegmentPersistedForVisualJobBinding(createDraftSession(generatedSegment), 7, null)).toBe(true);
  });
});

describe("WorkspacePage prompt character mentions", () => {
  type PromptMentionOption = Parameters<typeof buildWorkspacePromptCharacterMentionTokens>[1][number];

  const createMentionOption = (key: string, label: string): PromptMentionOption => ({
    assetId: null,
    key,
    kind: "character" as const,
    label,
    previewKind: "image" as const,
    source: "saved" as const,
    sourceProjectId: null,
    sourceSegmentIndex: null,
    subtitle: "",
  } as PromptMentionOption);

  it("maps the caret to the end of text after multiple inline character chips", () => {
    const options = [
      createMentionOption("henry", "Генри"),
      createMentionOption("barsik", "Барсик"),
    ];
    const value = "Генри и Барсик идут по лесу смеясь и смотря друг на друга";
    const root = document.createElement("div");
    root.innerHTML = buildWorkspacePromptRichEditorHtml(
      buildWorkspacePromptCharacterMentionTokens(value, options),
      () => null,
    );
    document.body.append(root);

    const trailingTextNode = root.lastChild;
    expect(trailingTextNode?.nodeType).toBe(Node.TEXT_NODE);

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(trailingTextNode as Text, trailingTextNode?.textContent?.length ?? 0);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const editorSelectionRange = getWorkspacePromptRichEditorSelectionRange(root);
    const nextValue = insertWorkspacePromptCharacterMentionText(
      value,
      "Серан",
      editorSelectionRange ?? { end: value.length, start: value.length },
    );

    expect(editorSelectionRange).toEqual({ end: value.length, start: value.length });
    expect(nextValue).toBe(`${value} Серан`);

    root.remove();
  });

  it("uses only prompt-mentioned characters when selected characters include extras", () => {
    const options = [
      createMentionOption("henry", "Генри"),
      createMentionOption("barsik", "Барсик"),
      createMentionOption("seran", "Серан"),
    ];

    const mentionedOptions = resolveWorkspacePromptMentionedCharacterOptions(
      "Генри и Барсик идут по лесу смеясь и смотря друг на друга",
      options,
    );

    expect(mentionedOptions.map((option) => option.label)).toEqual(["Генри", "Барсик"]);
  });

  it("bills prompt-mentioned characters as premium without changing selected quality", () => {
    const options = [
      createMentionOption("henry", "Генри"),
      createMentionOption("barsik", "Барсик"),
    ];

    expect(resolveWorkspacePromptCharacterBillingQuality("Генри идет по лесу", options, "standard")).toBe("premium");
    expect(resolveWorkspacePromptCharacterBillingQuality("Пустая сцена в лесу", options, "standard")).toBe("standard");
  });

  it("removes a selected character mention from rich prompt text", () => {
    const options = [
      createMentionOption("henry", "Генри"),
      createMentionOption("barsik", "Барсик"),
    ];

    expect(
      removeWorkspacePromptCharacterMentionText(
        "Генри и Барсик идут по лесу, Барсик машет лапой.",
        options[1],
        options,
      ),
    ).toBe("Генри и идут по лесу, машет лапой.");
  });
});

describe("WorkspacePage reference creation defaults", () => {
  it("does not bind generated reference media to the active segment", () => {
    const mediaScope = buildWorkspaceReferenceGenerationMediaScope(3439);

    expect(mediaScope).toEqual({ projectId: 3439 });
    expect("segmentIndex" in mediaScope).toBe(false);
  });

  it("uses the next default character and scene names independently", () => {
    const references = [
      { kind: "character" as const, name: "Персонаж 1" },
      { kind: "character" as const, name: "Персонаж 3" },
      { kind: "character" as const, name: "Hero" },
      { kind: "scene" as const, name: "Сцена 2" },
    ];

    expect(getNextWorkspaceReferenceDefaultName(references, "character")).toBe("Персонаж 4");
    expect(getNextWorkspaceReferenceDefaultName(references, "scene")).toBe("Сцена 3");
  });

  it("builds character prompts from structured creation fields", () => {
    const prompt = buildWorkspaceReferenceAiPrompt({
      character: {
        ageRange: "1",
        description: "Темные волосы, студийный портрет.",
        gender: "male",
        style: "Реалистичный",
      },
      kind: "character",
    });

    expect(prompt).toContain("Создай референс персонажа: Темные волосы");
    expect(prompt).toContain("Пол персонажа: мужской");
    expect(prompt).toContain("Возраст: 1 год");
  });

  it("does not add human defaults to free-form character prompts", () => {
    const prompt = buildWorkspaceReferenceAiPrompt({
      character: {
        description: "катенок качок",
      },
      kind: "character",
    });

    expect(prompt).toContain("катенок качок");
    expect(prompt).not.toContain("мужской");
    expect(prompt).not.toContain("25");
    expect(prompt).not.toContain("Темные волосы");
    expect(prompt).not.toContain("Стиль");
  });

  it("builds scene prompts from structured creation fields", () => {
    const prompt = buildWorkspaceReferenceAiPrompt({
      kind: "scene",
      scene: {
        description: "Кафе у окна, детальная композиция.",
        lightingMood: "Теплый вечерний свет",
        placeType: "Интерьер",
        style: "Кинематографичная",
      },
    });

    expect(prompt).toContain("Тип сцены: Интерьер");
    expect(prompt).toContain("Свет и атмосфера: Теплый вечерний свет");
  });
});

describe("WorkspacePage example prefill settings", () => {
  it("keeps the system watermark disabled by default", () => {
    expect(createWorkspaceSegmentEditorProjectBrandState()).toMatchObject({
      brandLogoFile: null,
      brandText: "",
      systemWatermarkEnabled: false,
    });
  });

  it("treats dirty segment-editor brand draft as a generation change", () => {
    const baseline = createWorkspaceSegmentEditorProjectBrandState();
    const applied = createWorkspaceSegmentEditorProjectBrandState();
    const current = createWorkspaceSegmentEditorProjectBrandState({
      brandText: "Acme",
    });

    const result = resolveWorkspaceSegmentEditorEffectiveBrandState({
      applied,
      baseline,
      current,
      useCurrentDraft: true,
    });

    expect(result.brandSnapshot.brandText).toBe("Acme");
    expect(result.hasBranding).toBe(true);
    expect(result.hasBrandChange).toBe(true);
  });

  it("uses example settings as the initial Studio state", () => {
    expect(
      resolveWorkspaceExamplePrefillInitialStudioState({
        prefillSettings: {
          brandText: "adshortsai.com",
          language: "ru",
          musicType: "dramatic",
          subtitleColorId: "cyan",
          subtitleEnabled: true,
          subtitleStyleId: "karaoke",
          videoMode: "ai_photo",
          voiceEnabled: true,
          voiceId: "Liam",
        },
        routeDefaults: getWorkspaceInitialStudioDefaults("ru"),
      }),
    ).toMatchObject({
      brandText: "adshortsai.com",
      language: "ru",
      musicType: "dramatic",
      subtitleColorId: "cyan",
      subtitleEnabled: true,
      subtitleStyleId: "karaoke",
      videoMode: "ai_photo",
      voiceEnabled: true,
      voiceId: "Liam",
    });
  });

  it("turns subtitles off when example voiceover is disabled", () => {
    expect(
      resolveWorkspaceExamplePrefillInitialStudioState({
        prefillSettings: {
          subtitleEnabled: true,
          voiceEnabled: false,
        },
        routeDefaults: getWorkspaceInitialStudioDefaults("ru"),
      }),
    ).toMatchObject({
      subtitleEnabled: false,
      voiceEnabled: false,
    });
  });

  it("keeps example subtitle style and color when workspace bootstrap arrives later", () => {
    const styleBase = {
      defaultColorId: "purple",
      description: "",
      fontFamily: "Manrope",
      fontSize: 96,
      label: "",
      logicMode: "block",
      marginBottom: 420,
      outlineWidth: 3,
      position: "bottom_center",
      transitionMode: "hard_cut",
      usesAccentColor: true,
      windowSize: 3,
      wordEffect: "none",
    };

    const selection = resolveWorkspaceExamplePrefillSubtitleSelection({
      prefillSettings: {
        subtitleColorId: "cyan",
        subtitleStyleId: "story",
      },
      selectedSubtitleColorId: "purple",
      selectedSubtitleStyleId: "modern",
      subtitleColorOptions: [
        { accent: "#8B5CF6", id: "purple", label: "Purple", outline: "", surface: "", text: "" },
        { accent: "#22D3EE", id: "cyan", label: "Cyan", outline: "", surface: "", text: "" },
      ],
      subtitleStyleOptions: [
        { ...styleBase, id: "modern", label: "Modern" },
        { ...styleBase, defaultColorId: "cyan", id: "story", label: "Story" },
      ],
    });

    expect(selection).toEqual({
      subtitleColorId: "cyan",
      subtitleStyleId: "story",
    });
  });
});

describe("WorkspacePage segment editor draft persistence", () => {
  it("preserves local drafts when a project is opened from the projects list", () => {
    expect(getWorkspaceSegmentEditorProjectOpenOptions()).toEqual({
      bypassCache: false,
      discardLocalDraft: false,
      forceRefresh: false,
    });
  });

  it("only discards local drafts for an explicit refresh", () => {
    expect(getWorkspaceSegmentEditorProjectOpenOptions({ forceRefresh: true })).toEqual({
      bypassCache: true,
      discardLocalDraft: true,
      forceRefresh: true,
    });
  });

  it("keeps the first loaded segment editor session as the reset baseline during fresh refreshes", () => {
    const baselineText = "Исходная озвучка сцены";
    const freshText = "Исходная озвучка сцены. Новая длинная фраза.";
    const originalAsset = createMediaAsset(101, { mediaType: "photo", sourceKind: "stock" });
    const generatedAsset = createMediaAsset(303, { mediaType: "video", sourceKind: "ai_generated" });
    const baselineSession = createFreshSession(createDraftSegment({
      currentAsset: originalAsset,
      currentPreviewUrl: "/api/workspace/media-assets/101",
      currentSourceKind: "stock",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      speechDuration: 6.5,
      text: baselineText,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(baselineText),
    }));
    const refreshedSession = createFreshSession(createDraftSegment({
      currentAsset: generatedAsset,
      currentPreviewUrl: "/api/workspace/media-assets/303",
      currentSourceKind: "ai_generated",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      speechDuration: 12.4,
      text: freshText,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(freshText),
    }));

    const loadedBaseline = resolveWorkspaceSegmentEditorLoadedBaselineSession(refreshedSession, baselineSession);

    expect(loadedBaseline.segments[0]?.text).toBe(baselineText);
    expect(loadedBaseline.segments[0]?.speechDuration).toBe(6.5);
    expect(loadedBaseline.segments[0]?.currentAsset?.assetId).toBe(101);
  });

  it("restores original segment text and visual when a reset baseline already contains fresh edits", () => {
    const originalText = "Исходная озвучка сцены";
    const editedText = "Исходная озвучка сцены. Новая длинная фраза.";
    const originalAsset = createMediaAsset(101, { mediaType: "photo", sourceKind: "stock" });
    const generatedAsset = createMediaAsset(303, { mediaType: "video", sourceKind: "ai_generated" });
    const editedSegment = createDraftSegment({
      currentAsset: generatedAsset,
      currentPreviewUrl: "/api/workspace/media-assets/303",
      currentSourceKind: "ai_generated",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      originalText,
      originalTextByLanguage: { ru: originalText },
      speechDuration: 12.4,
      text: editedText,
      textByLanguage: { ru: editedText },
      voiceoverAsset: {
        assetId: 901,
        durationSeconds: 12.4,
        fileName: "generated-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/901/playback",
      },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(editedText),
    });
    const pollutedBaseline = createDraftSession(editedSegment);

    const resetDraft = createWorkspaceSegmentEditorResetDraftFromBaseline(
      createDraftSession(editedSegment),
      pollutedBaseline,
    );
    const resetSegment = resetDraft.segments[0]!;

    expect(resetSegment.text).toBe(originalText);
    expect(resetSegment.speechDuration).toBeNull();
    expect(resetSegment.voiceoverAsset).toBeNull();
    expect(resetSegment.currentAsset?.assetId).toBe(101);
    expect(getWorkspaceSegmentDraftPreviewUrl(resetSegment)).toBe("/api/workspace/media-assets/101");
  });

  it("clears temporary editor state for other projects after a project is created", () => {
    const createMemoryStorage = (): Storage => {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => {
          values.delete(key);
        },
        setItem: (key: string, value: string) => {
          values.set(key, String(value));
        },
      };
    };
    const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
    const originalSessionStorage = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    const localStorageMock = createMemoryStorage();
    const sessionStorageMock = createMemoryStorage();
    const email = "Draft-Reset@Example.test";
    const storageEmail = "draft-reset@example.test";
    const draft101Key = `adshorts.segment-editor-draft:${storageEmail}:101`;
    const draft102Key = `adshorts.segment-editor-draft:${storageEmail}:102`;
    const structure101Key = `adshorts.segment-editor-explicit-structure:${storageEmail}:101`;
    const structure102Key = `adshorts.segment-editor-explicit-structure:${storageEmail}:102`;
    const aiPhotoJobsKey = `adshorts.segment-ai-photo-pending:${storageEmail}`;
    const animationJobsKey = `adshorts.segment-photo-animation-pending:${storageEmail}`;
    const talkingPhotoJobsKey = `adshorts.segment-talking-photo-pending:${storageEmail}`;
    const draft101 = { ...createDraftSession(createDraftSegment({ text: "Old draft" })), projectId: 101 };
    const draft102 = { ...createDraftSession(createDraftSegment({ text: "Kept draft" })), projectId: 102 };

    try {
      Object.defineProperty(window, "localStorage", { configurable: true, value: localStorageMock });
      Object.defineProperty(window, "sessionStorage", { configurable: true, value: sessionStorageMock });
      window.localStorage.setItem(draft101Key, JSON.stringify(draft101));
      window.sessionStorage.setItem(draft102Key, JSON.stringify(draft102));
      window.localStorage.setItem(structure101Key, "1");
      window.sessionStorage.setItem(structure102Key, "1");
      window.localStorage.setItem(
        aiPhotoJobsKey,
        JSON.stringify([
          { createdAt: Date.now(), jobId: "old-photo", projectId: 101, prompt: "old", segmentIndex: 0, status: "queued" },
          { createdAt: Date.now(), jobId: "kept-photo", projectId: 102, prompt: "kept", segmentIndex: 0, status: "queued" },
        ]),
      );
      window.localStorage.setItem(
        animationJobsKey,
        JSON.stringify([
          { createdAt: Date.now(), jobId: "old-animation", projectId: 101, prompt: "old", segmentIndex: 0, sourceAsset: null, status: "queued" },
          { createdAt: Date.now(), jobId: "kept-animation", projectId: 102, prompt: "kept", segmentIndex: 0, sourceAsset: null, status: "queued" },
        ]),
      );
      window.localStorage.setItem(
        talkingPhotoJobsKey,
        JSON.stringify([
          { createdAt: Date.now(), jobId: "old-talking", projectId: 101, script: "old", segmentIndex: 0, sourceAsset: null, status: "queued" },
          { createdAt: Date.now(), jobId: "kept-talking", projectId: 102, script: "kept", segmentIndex: 0, sourceAsset: null, status: "queued" },
        ]),
      );

      expect(clearStoredWorkspaceSegmentEditorTemporaryStateExcept(email, [102])).toEqual([101]);
      expect(window.localStorage.getItem(draft101Key)).toBeNull();
      expect(window.localStorage.getItem(structure101Key)).toBeNull();
      expect(window.sessionStorage.getItem(draft102Key)).not.toBeNull();
      expect(window.sessionStorage.getItem(structure102Key)).toBe("1");
      expect(JSON.parse(window.localStorage.getItem(aiPhotoJobsKey) ?? "[]")).toEqual([
        expect.objectContaining({ jobId: "kept-photo", projectId: 102 }),
      ]);
      expect(JSON.parse(window.localStorage.getItem(animationJobsKey) ?? "[]")).toEqual([
        expect.objectContaining({ jobId: "kept-animation", projectId: 102 }),
      ]);
      expect(JSON.parse(window.localStorage.getItem(talkingPhotoJobsKey) ?? "[]")).toEqual([
        expect.objectContaining({ jobId: "kept-talking", projectId: 102 }),
      ]);
    } finally {
      if (originalLocalStorage) {
        Object.defineProperty(window, "localStorage", originalLocalStorage);
      }
      if (originalSessionStorage) {
        Object.defineProperty(window, "sessionStorage", originalSessionStorage);
      }
    }
  });

  it("restores stored segment editor drafts and sessions after a refresh", () => {
    const createMemoryStorage = (): Storage => {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => {
          values.delete(key);
        },
        setItem: (key: string, value: string) => {
          values.set(key, String(value));
        },
      };
    };
    const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
    const originalSessionStorage = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    const localStorageMock = createMemoryStorage();
    const sessionStorageMock = createMemoryStorage();
    const email = "Duration-Draft@Example.test";
    const projectId = 3870;
    const baselineSegment = createDraftSegment({
      duration: 3.6,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 3.6,
      index: 5,
      manualDurationSeconds: 3.6,
      mediaType: "video",
      text: "Baseline scene",
    });
    const draftSegment = createDraftSegment({
      ...baselineSegment,
      duration: 4,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      endTime: 4,
      manualDurationSeconds: 4,
      speechDuration: 4,
      speechEndTime: 4,
      speechStartTime: 0,
    });
    const baselineSession = {
      ...createDraftSession(baselineSegment),
      projectId,
      segments: [baselineSegment],
    };
    const draftSession = {
      ...createDraftSession(draftSegment),
      projectId,
      segments: [draftSegment],
    };

    try {
      Object.defineProperty(window, "localStorage", { configurable: true, value: localStorageMock });
      Object.defineProperty(window, "sessionStorage", { configurable: true, value: sessionStorageMock });

      writeStoredWorkspaceSegmentEditorSession(email, baselineSession);
      writeStoredWorkspaceSegmentEditorDraft(email, draftSession);

      expect(readStoredWorkspaceSegmentEditorSession(email.toLowerCase(), projectId)?.segments[0]).toEqual(
        expect.objectContaining({
          duration: 3.6,
          durationMode: "manual",
          manualDurationSeconds: 3.6,
        }),
      );
      expect(readStoredWorkspaceSegmentEditorDraft(email.toLowerCase(), projectId)?.segments[0]).toEqual(
        expect.objectContaining({
          duration: 4,
          durationMode: "manual",
          durationSyncMode: "voiceover",
          durationSyncModeUserSelected: true,
          manualDurationSeconds: 4,
        }),
      );
      expect(readStoredWorkspaceSegmentEditorDrafts(email).map((draft) => draft.projectId)).toContain(projectId);
    } finally {
      if (originalLocalStorage) {
        Object.defineProperty(window, "localStorage", originalLocalStorage);
      }
      if (originalSessionStorage) {
        Object.defineProperty(window, "sessionStorage", originalSessionStorage);
      }
    }
  });

  it("marks a source project as consumed after Shorts creation starts", () => {
    const createMemoryStorage = (): Storage => {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => {
          values.delete(key);
        },
        setItem: (key: string, value: string) => {
          values.set(key, String(value));
        },
      };
    };
    const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
    const localStorageMock = createMemoryStorage();

    try {
      Object.defineProperty(window, "localStorage", { configurable: true, value: localStorageMock });

      expect(readStoredWorkspaceSegmentEditorConsumedSourceProject("Consumed@Example.test", 3727)).toBe(false);
      writeStoredWorkspaceSegmentEditorConsumedSourceProject("Consumed@Example.test", 3727);

      expect(readStoredWorkspaceSegmentEditorConsumedSourceProject("consumed@example.test", 3727)).toBe(true);
      expect(readStoredWorkspaceSegmentEditorConsumedSourceProject("consumed@example.test", 3728)).toBe(false);

      removeStoredWorkspaceSegmentEditorConsumedSourceProject("consumed@example.test", 3727);
      expect(readStoredWorkspaceSegmentEditorConsumedSourceProject("consumed@example.test", 3727)).toBe(false);
    } finally {
      if (originalLocalStorage) {
        Object.defineProperty(window, "localStorage", originalLocalStorage);
      }
    }
  });

  it("detects projects that already generated child Shorts", () => {
    expect(
      hasWorkspaceSegmentEditorGeneratedShortsFromProject(
        [
          { adId: 3727, editedFromProjectAdId: null, versionRootProjectAdId: null },
          { adId: 3728, editedFromProjectAdId: 3727, versionRootProjectAdId: 3727 },
        ],
        3727,
      ),
    ).toBe(true);
    expect(
      hasWorkspaceSegmentEditorGeneratedShortsFromProject(
        [
          { adId: 3727, editedFromProjectAdId: null, versionRootProjectAdId: null },
          { adId: 3728, editedFromProjectAdId: null, versionRootProjectAdId: 3727 },
        ],
        3727,
      ),
    ).toBe(true);
    expect(
      hasWorkspaceSegmentEditorGeneratedShortsFromProject(
        [
          { adId: 3727, editedFromProjectAdId: null, versionRootProjectAdId: 3727 },
          { adId: 3729, editedFromProjectAdId: 3728, versionRootProjectAdId: 3728 },
        ],
        3727,
      ),
    ).toBe(false);
  });

  it("persists pending visual jobs for scratch drafts", () => {
    const createMemoryStorage = (): Storage => {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => {
          values.delete(key);
        },
        setItem: (key: string, value: string) => {
          values.set(key, String(value));
        },
      };
    };
    const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");

    try {
      Object.defineProperty(window, "localStorage", { configurable: true, value: createMemoryStorage() });
      upsertStoredWorkspaceSegmentTalkingPhotoJob("Scratch@Example.test", {
        createdAt: Date.now(),
        jobId: "scratch-talking",
        projectId: 0,
        script: "scratch script",
        segmentIndex: 1,
        sourceAsset: null,
        status: "queued",
      });
      upsertStoredWorkspaceSegmentImageEditJob("Scratch@Example.test", {
        createdAt: Date.now(),
        jobId: "scratch-image-edit",
        projectId: 0,
        prompt: "add milk",
        segmentIndex: 3,
        status: "queued",
      });

      expect(readStoredWorkspaceSegmentTalkingPhotoJobs("scratch@example.test")).toEqual([
        expect.objectContaining({
          jobId: "scratch-talking",
          projectId: 0,
          script: "scratch script",
          segmentIndex: 1,
          status: "queued",
        }),
      ]);
      expect(readStoredWorkspaceSegmentImageEditJobs("scratch@example.test")).toEqual([
        expect.objectContaining({
          jobId: "scratch-image-edit",
          projectId: 0,
          prompt: "add milk",
          segmentIndex: 3,
          status: "queued",
        }),
      ]);
    } finally {
      if (originalLocalStorage) {
        Object.defineProperty(window, "localStorage", originalLocalStorage);
      }
    }
  });

  it("preserves requested duration for pending photo animation jobs", () => {
    const createMemoryStorage = (): Storage => {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => {
          values.delete(key);
        },
        setItem: (key: string, value: string) => {
          values.set(key, String(value));
        },
      };
    };
    const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");

    try {
      Object.defineProperty(window, "localStorage", { configurable: true, value: createMemoryStorage() });
      upsertStoredWorkspaceSegmentPhotoAnimationJob("Photo-Duration@Example.test", {
        createdAt: Date.now(),
        durationSeconds: 5,
        jobId: "photo-animation-duration",
        projectId: 901,
        prompt: "animate pancakes",
        segmentIndex: 2,
        sourceAsset: null,
        status: "processing",
      });

      expect(readStoredWorkspaceSegmentPhotoAnimationJobs("photo-duration@example.test")).toEqual([
        expect.objectContaining({
          durationSeconds: 5,
          jobId: "photo-animation-duration",
          projectId: 901,
          segmentIndex: 2,
          status: "processing",
        }),
      ]);
    } finally {
      if (originalLocalStorage) {
        Object.defineProperty(window, "localStorage", originalLocalStorage);
      }
    }
  });

  it("restores project-scoped brand removal after refresh", () => {
    const createMemoryStorage = (): Storage => {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => {
          values.delete(key);
        },
        setItem: (key: string, value: string) => {
          values.set(key, String(value));
        },
      };
    };
    const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
    const originalSessionStorage = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    const localStorageMock = createMemoryStorage();
    const sessionStorageMock = createMemoryStorage();
    const email = "Brand-Removal@Example.test";
    const projectId = 711;
    const baseline = createWorkspaceSegmentEditorProjectBrandState({
      brandText: "Old brand",
      systemWatermarkEnabled: true,
    });
    const applied = createWorkspaceSegmentEditorProjectBrandState({
      brandText: "",
      systemWatermarkEnabled: false,
    });

    try {
      Object.defineProperty(window, "localStorage", { configurable: true, value: localStorageMock });
      Object.defineProperty(window, "sessionStorage", { configurable: true, value: sessionStorageMock });
      writeStoredWorkspaceSegmentEditorBrandSnapshot(email, projectId, { applied, baseline });

      expect(readStoredWorkspaceSegmentEditorBrandSnapshot(email, projectId)).toEqual({
        applied,
        baseline,
      });
    } finally {
      if (originalLocalStorage) {
        Object.defineProperty(window, "localStorage", originalLocalStorage);
      }
      if (originalSessionStorage) {
        Object.defineProperty(window, "sessionStorage", originalSessionStorage);
      }
    }
  });

  it("prefers a stored project brand snapshot over default editor brand state", () => {
    const defaultState = createWorkspaceSegmentEditorProjectBrandState({
      brandText: "Global saved brand",
      systemWatermarkEnabled: true,
    });
    const baseline = createWorkspaceSegmentEditorProjectBrandState({
      brandText: "Project brand",
      systemWatermarkEnabled: true,
    });
    const applied = createWorkspaceSegmentEditorProjectBrandState({
      brandText: "",
      systemWatermarkEnabled: false,
    });

    expect(
      resolveWorkspaceSegmentEditorProjectBrandSnapshot({
        defaultState,
        storedSnapshot: { applied, baseline },
      }),
    ).toEqual({ applied, baseline });
  });

  it("allows saved draft segment structure changes during Shorts creation", () => {
    const firstSegment = createDraftSegment({ index: 0, text: "First" });
    const secondSegment = createDraftSegment({ index: 1, startTime: 4, endTime: 8, duration: 4, text: "Second" });
    const baseline = createDraftSession(firstSegment);
    const draft = {
      ...baseline,
      segments: [secondSegment, firstSegment],
    };

    expect(shouldAllowWorkspaceSegmentEditorStructureChange(draft, baseline)).toBe(true);
  });

  it("uses the current draft as display baseline while the project baseline is unavailable", () => {
    const currentAsset = createMediaAsset(301, { sourceKind: "ai_generated" });
    const draftSegment = createDraftSegment({
      currentAsset,
      currentPlaybackUrl: currentAsset.playbackUrl,
      currentPreviewUrl: currentAsset.playbackUrl,
      currentSourceKind: "ai_generated",
      mediaType: "photo",
    });
    const draft = {
      ...createDraftSession(draftSegment),
      musicType: "upbeat",
    };

    const displayBaseline = resolveWorkspaceSegmentEditorChangeDisplayBaselineSession(draft, null);

    expect(displayBaseline).toBe(draft);
    expect(buildWorkspaceSegmentEditorChangeChecklist(draft, displayBaseline)).toEqual([]);

    const tracks = buildWorkspaceSegmentEditorTracks(
      draft.segments,
      displayBaseline?.segments ?? [],
      draft,
      displayBaseline,
      {
        isVisualEdited: (segment, baselineSegment) =>
          getWorkspaceSegmentDraftVisualStatus(segment, baselineSegment) === "changed",
      },
    );

    expect(tracks.rows.find((row) => row.kind === "visual")?.spans[0]?.isEdited).toBe(false);
    expect(tracks.rows.find((row) => row.kind === "music")?.spans[0]?.isEdited).toBe(false);
  });

  it("uses the matching loaded project baseline for display comparisons", () => {
    const baseline = createDraftSession(createDraftSegment({ index: 0, text: "Original" }));
    const draft = {
      ...baseline,
      segments: [createDraftSegment({ index: 0, text: "Edited" })],
    };

    expect(resolveWorkspaceSegmentEditorChangeDisplayBaselineSession(draft, baseline)).toBe(baseline);
    expect(
      resolveWorkspaceSegmentEditorChangeDisplayBaselineSession(draft, {
        ...baseline,
        projectId: baseline.projectId + 1,
      }),
    ).toBe(draft);
  });

  it("treats an added scene sound as a Shorts edit", () => {
    const baselineSegment = createDraftSegment({ index: 0 });
    const draftSegment = createDraftSegment({
      index: 0,
      sceneSoundAsset: {
        assetId: 101,
        fileName: "scene-sound.wav",
        fileSize: 2048,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/101",
        source: "media-library",
      },
      sceneSoundGeneratedFromPrompt: "busy cafe ambience",
      sceneSoundPrompt: "busy cafe ambience",
      sceneSoundPromptInitialized: true,
    });

    const checklist = buildWorkspaceSegmentEditorChangeChecklist(
      createDraftSession(draftSegment),
      createDraftSession(baselineSegment),
    );

    expect(checklist.map((item) => item.label)).toContain("Сегмент 1: добавлен звук сцены");
  });

  it("treats a generated scene sound as changed when a refreshed baseline already sees its asset", () => {
    const sceneSoundAsset = {
      assetId: 202,
      fileName: "scene-sound.wav",
      fileSize: 2048,
      mimeType: "audio/wav",
      remoteUrl: "/api/workspace/media-assets/202",
      source: "media-library" as const,
    };
    const baselineSegment = createDraftSegment({
      index: 0,
      sceneSoundAsset,
      sceneSoundPromptInitialized: true,
    });
    const draftSegment = createDraftSegment({
      index: 0,
      sceneSoundAsset,
      sceneSoundGeneratedFromPrompt: "kitten eating crunchy food",
      sceneSoundPrompt: "kitten eating crunchy food",
      sceneSoundPromptInitialized: true,
    });

    const checklist = buildWorkspaceSegmentEditorChangeChecklist(
      createDraftSession(draftSegment),
      createDraftSession(baselineSegment),
    );

    expect(checklist.map((item) => item.label)).toContain("Сегмент 1: обновлен звук сцены");
  });

  it("does not treat a prompt-only scene sound draft as a Shorts edit", () => {
    const baselineSegment = createDraftSegment({ index: 0 });
    const draftSegment = createDraftSegment({
      index: 0,
      sceneSoundPrompt: "quiet room tone",
      sceneSoundPromptInitialized: true,
    });

    const checklist = buildWorkspaceSegmentEditorChangeChecklist(
      createDraftSession(draftSegment),
      createDraftSession(baselineSegment),
    );

    expect(checklist.map((item) => item.label)).not.toContain("Сегмент 1: добавлен звук сцены");
    expect(checklist).toHaveLength(0);
  });

  it("clears scene sound ids when deleting a sound from the timeline", () => {
    const segment = createDraftSegment({
      index: 0,
      sceneSound: {
        assetId: 303,
        fileName: "scene-sound.wav",
        fileSize: 2048,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/303",
      },
      sceneSoundAsset: {
        assetId: 303,
        fileName: "scene-sound.wav",
        fileSize: 2048,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/303",
      },
      sceneSoundAssetId: 303,
      scene_sound: {
        media_asset_id: 303,
        remote_url: "/api/workspace/media-assets/303",
      },
      scene_sound_asset_id: 303,
      sceneSoundGeneratedFromPrompt: "busy cafe ambience",
      sceneSoundPrompt: "busy cafe ambience",
      sceneSoundPromptInitialized: true,
    });

    const cleared = clearWorkspaceSegmentSceneSoundState(segment);
    const tracks = buildWorkspaceSegmentEditorTracks([cleared], [], null, null, {
      isSoundEdited: () => false,
    });

    expect(cleared.sceneSoundAsset).toBeNull();
    expect(cleared.sceneSoundAssetId).toBeNull();
    expect(cleared.scene_sound).toBeNull();
    expect(cleared.scene_sound_asset_id).toBeNull();
    expect(tracks.rows.find((row) => row.kind === "sound")?.spans[0]?.isEmpty).toBe(true);
  });

  it("restores scene sound ids from a timeline snapshot", () => {
    const currentSegment = clearWorkspaceSegmentSceneSoundState(createDraftSegment({ index: 0 }));
    const snapshotSegment = createDraftSegment({
      index: 0,
      sceneSoundAsset: {
        assetId: 404,
        fileName: "scene-sound.wav",
        fileSize: 2048,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/404",
      },
      sceneSoundGeneratedFromPrompt: "soft rain",
      sceneSoundPrompt: "soft rain",
      sceneSoundPromptInitialized: true,
    });

    const restored = restoreWorkspaceSegmentSceneSoundState(currentSegment, snapshotSegment);

    expect(restored.sceneSoundAsset?.assetId).toBe(404);
    expect(restored.sceneSoundAssetId).toBe(404);
    expect(restored.scene_sound_asset_id).toBe(404);
    expect(restored.sceneSoundPrompt).toBe("soft rain");
  });

  it("treats a manual photo duration change as a Shorts edit", () => {
    const baselineSegment = createDraftSegment({
      duration: 4.9,
      durationMode: "auto",
      endTime: 4.9,
      index: 0,
      manualDurationSeconds: null,
      mediaType: "photo",
      startTime: 0,
    });
    const draftSegment = createDraftSegment({
      ...baselineSegment,
      duration: 10,
      durationMode: "manual",
      endTime: 10,
      manualDurationSeconds: 10,
    });

    const draftSession = createDraftSession(draftSegment);
    const baselineSession = createDraftSession(baselineSegment);
    const resetTargetSession = createWorkspaceSegmentEditorResetDraftFromBaseline(draftSession, baselineSession);

    expect(buildWorkspaceSegmentEditorChangeChecklist(draftSession, baselineSession)).toEqual([
      expect.objectContaining({
        kind: "segment",
        label: "Сегмент 1: длина: 10 сек",
        resetDuration: true,
        segmentIndex: 0,
      }),
    ]);
    expect(buildWorkspaceSegmentEditorChangeChecklist(draftSession, resetTargetSession)).toEqual([
      expect.objectContaining({
        kind: "segment",
        label: "Сегмент 1: длина: 10 сек",
        resetDuration: true,
        segmentIndex: 0,
      }),
    ]);
  });

  it("treats an automatic photo duration change as a Shorts edit", () => {
    const baselineSegment = createDraftSegment({
      duration: 9.7,
      durationMode: "auto",
      endTime: 9.7,
      index: 0,
      manualDurationSeconds: null,
      mediaType: "photo",
      startTime: 0,
    });
    const draftSegment = createDraftSegment({
      ...baselineSegment,
      duration: 8.7,
      endTime: 8.7,
    });

    expect(
      buildWorkspaceSegmentEditorChangeChecklist(
        createDraftSession(draftSegment),
        createDraftSession(baselineSegment),
      ),
    ).toEqual([
      expect.objectContaining({
        kind: "segment",
        label: "Сегмент 1: длина: 8.7 сек",
        resetDuration: true,
        segmentIndex: 0,
      }),
    ]);
  });

  it("does not treat a blank inserted segment duration as a Shorts edit", () => {
    const baselineSegment = createDraftSegment({ index: 0 });
    const baselineSession = {
      ...createDraftSession(baselineSegment),
      segments: [baselineSegment],
    };
    const insertedSegment = createWorkspaceSegmentEditorInsertedSegment({
      draft: baselineSession,
      insertAt: 1,
    });
    const draftSession = {
      ...baselineSession,
      segments: [baselineSegment, insertedSegment],
    };

    expect(buildWorkspaceSegmentEditorChangeChecklist(draftSession, baselineSession)).toEqual([]);
  });

  it("treats a scene voice override as a Shorts edit", () => {
    const baselineSegment = createDraftSegment({ index: 0, voiceType: null });
    const draftSegment = createDraftSegment({ index: 0, voiceType: "Liam" });

    const checklist = buildWorkspaceSegmentEditorChangeChecklist(
      createDraftSession(draftSegment),
      createDraftSession(baselineSegment),
    );

    expect(checklist).toEqual([
      expect.objectContaining({
        kind: "segment",
        label: "Сегмент 1: озвучка: голос Александр",
        resetVoice: true,
        segmentIndex: 0,
      }),
    ]);
  });

  it("does not treat recovered project TTS metadata as a scene voice edit", () => {
    const text = "Сегодня покажу рецепт";
    const baselineSegment = createDraftSegment({
      index: 0,
      originalText: text,
      originalTextByLanguage: { ru: text },
      text,
      textByLanguage: { ru: text },
      voiceType: null,
      voiceoverAsset: null,
      voiceoverLanguage: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const draftSegment = createDraftSegment({
      ...baselineSegment,
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(baselineSegment.text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    expect(isWorkspaceSegmentDraftVoiceEdited(draftSegment, baselineSegment)).toBe(false);
    expect(
      buildWorkspaceSegmentEditorChangeChecklist(
        createDraftSession(draftSegment),
        createDraftSession(baselineSegment),
      ),
    ).toEqual([]);
  });

  it("infers the project voice from a recovered project TTS asset", () => {
    const text = "Сегодня покажу рецепт";
    const projectVoiceSegment = createDraftSegment({
      index: 0,
      originalText: text,
      originalTextByLanguage: { ru: text },
      text,
      textByLanguage: { ru: text },
      voiceType: null,
      voiceoverAsset: {
        assetId: 4946,
        fileName: "project-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/4946",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const baselineSession = {
      ...createDraftSession(projectVoiceSegment),
      ttsAssetId: 4946,
      voiceType: "",
    };

    expect(getWorkspaceSegmentEditorProjectVoiceType(baselineSession)).toBe(DEFAULT_STUDIO_VOICE_ID.ru);
  });

  it("treats a uniform legacy segment voice_type as the project voice baseline", () => {
    const firstSegment = createFreshSession(createDraftSegment({
      duration: 3,
      endTime: 3,
      index: 0,
      text: "Первый сегмент.",
    })).segments[0]!;
    const secondSegment = createFreshSession(createDraftSegment({
      duration: 2,
      endTime: 5,
      index: 1,
      startTime: 3,
      text: "Второй сегмент.",
    })).segments[0]!;
    const session = {
      ...createFreshSession(createDraftSegment()),
      segments: [
        { ...firstSegment, voice_type: "Russian_BrightHeroine" },
        { ...secondSegment, voice_type: "Russian_BrightHeroine" },
      ],
      voiceType: "Bys_24000",
    } satisfies FreshSession;

    const draft = createWorkspaceSegmentEditorDraftSession(session);

    expect(draft.voiceType).toBe("Russian_BrightHeroine");
    expect(draft.segments.map((segment) => getWorkspaceSegmentVoiceOverrideId(segment))).toEqual([null, null]);
    expect(draft.segments.map((segment) => segment.voiceType)).toEqual([null, null]);
    expect(draft.segments.map((segment) => segment.voice_type ?? null)).toEqual([null, null]);
    expect(buildWorkspaceSegmentEditorChangeChecklist(draft, draft)).toEqual([]);
  });

  it("ignores stale baseline voice_type when it matches the inherited project voice", () => {
    const text = "Сегодня покажу рецепт";
    const draftSegment = createDraftSegment({
      index: 0,
      originalText: text,
      text,
      voiceType: null,
      voice_type: null,
      voiceoverAsset: {
        assetId: 4946,
        fileName: "project-tts.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/4946",
      },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: "Russian_BrightHeroine",
    });
    const baselineSegment = createDraftSegment({
      ...draftSegment,
      voiceType: null,
      voice_type: "Russian_BrightHeroine",
    });
    const draftSession = {
      ...createDraftSession(draftSegment),
      ttsAssetId: 4946,
      voiceType: "Russian_BrightHeroine",
    };
    const baselineSession = {
      ...createDraftSession(baselineSegment),
      ttsAssetId: 4946,
      voiceType: "Russian_BrightHeroine",
    };

    expect(
      isWorkspaceSegmentDraftVoiceEdited(draftSegment, baselineSegment, {
        baselineSession,
        draftSession,
      }),
    ).toBe(false);
  });

  it("uses the server baseline for structure changes even when an applied draft already matches", () => {
    const firstSegment = createDraftSegment({ index: 0, text: "First" });
    const secondSegment = createDraftSegment({ index: 1, startTime: 4, endTime: 8, duration: 4, text: "Second" });
    const thirdSegment = createDraftSegment({ index: 2, startTime: 8, endTime: 12, duration: 4, text: "Third" });
    const serverBaseline = {
      ...createDraftSession(firstSegment),
      segments: [firstSegment, secondSegment, thirdSegment],
    };
    const appliedBaseline = {
      ...serverBaseline,
      segments: [firstSegment, thirdSegment, secondSegment],
    };

    expect(shouldAllowWorkspaceSegmentEditorStructureChange(appliedBaseline, [appliedBaseline, serverBaseline])).toBe(true);
  });

  it("allows non-canonical restored segment order even when only the applied draft baseline is available", () => {
    const firstSegment = createDraftSegment({ index: 0, text: "First" });
    const secondSegment = createDraftSegment({ index: 1, startTime: 4, endTime: 8, duration: 4, text: "Second" });
    const sixthSegment = createDraftSegment({ index: 5, startTime: 20, endTime: 24, duration: 4, text: "Sixth" });
    const restoredDraft = {
      ...createDraftSession(firstSegment),
      segments: [firstSegment, sixthSegment, secondSegment],
    };

    expect(shouldAllowWorkspaceSegmentEditorStructureChange(restoredDraft, restoredDraft)).toBe(true);
  });

  it("creates a blank segment instead of inheriting the source project visual", () => {
    const sourceSegment = createDraftSegment({
      currentAsset: createMediaAsset(101, { mediaType: "video" }),
      currentPlaybackUrl: "/api/workspace/media-assets/101",
      index: 0,
      mediaType: "video",
      originalAsset: createMediaAsset(100, { mediaType: "video" }),
      originalPlaybackUrl: "/api/workspace/media-assets/100",
      text: "Source segment",
    });
    const insertedSegment = createWorkspaceSegmentEditorInsertedSegment({
      draft: createDraftSession(sourceSegment),
      insertAt: 1,
      sourceSegment,
    });

    expect(insertedSegment.text).toBe("");
    expect(insertedSegment.currentAsset).toBeNull();
    expect(insertedSegment.originalAsset).toBeNull();
    expect(getWorkspaceSegmentDraftPreviewUrl(insertedSegment)).toBeNull();
    expect(getWorkspaceSegmentDraftVideoUrl(insertedSegment)).toBeNull();
    expect(isWorkspaceSegmentEditorDraftSegmentEmpty(insertedSegment)).toBe(true);
  });

  it("replaces the last deleted segment with one empty segment", () => {
    const sourceSegment = createDraftSegment({
      currentAsset: createMediaAsset(201, { mediaType: "video" }),
      currentPlaybackUrl: "/api/workspace/media-assets/201",
      index: 0,
      mediaType: "video",
      originalAsset: createMediaAsset(200, { mediaType: "video" }),
      originalPlaybackUrl: "/api/workspace/media-assets/200",
      text: "Only segment",
    });
    const nextSegments = resolveWorkspaceSegmentEditorSegmentsAfterDelete(createDraftSession(sourceSegment), sourceSegment.index);

    expect(nextSegments).toHaveLength(1);
    expect(nextSegments[0]?.index).toBe(1);
    expect(nextSegments[0]?.text).toBe("");
    expect(getWorkspaceSegmentDraftPreviewUrl(nextSegments[0]!)).toBeNull();
    expect(isWorkspaceSegmentEditorDraftSegmentEmpty(nextSegments[0])).toBe(true);
  });

  it("resets track settings when the last segment is replaced by a blank scene", () => {
    const sourceSegment = createDraftSegment({
      index: 0,
      sceneSoundPrompt: "Door slam",
      sceneSoundPromptInitialized: true,
      text: "Only segment",
      voiceType: "Boris",
    });
    const session = {
      ...createDraftSession(sourceSegment),
      customMusicAssetId: 501,
      customMusicFileName: "custom-track.mp3",
      musicAssetId: 502,
      musicName: "custom-track",
      musicType: "custom",
      subtitleColor: "gold",
      subtitleStyle: "impact",
      subtitleType: "karaoke",
      ttsAssetId: 503,
      voiceType: "Boris",
    };
    const nextSegments = resolveWorkspaceSegmentEditorSegmentsAfterDelete(session, sourceSegment.index);
    const resetDraft = resetWorkspaceSegmentEditorDraftTrackSettingsForBlankScene({
      ...session,
      segments: nextSegments,
    });

    expect(resetDraft.musicType).toBe("none");
    expect(resetDraft.customMusicAssetId).toBeNull();
    expect(resetDraft.customMusicFileName).toBeNull();
    expect(resetDraft.musicAssetId).toBeNull();
    expect(resetDraft.musicName).toBeNull();
    expect(resetDraft.voiceType).toBe("none");
    expect(resetDraft.ttsAssetId).toBeNull();
    expect(resetDraft.subtitleType).toBe("none");
    expect(resetDraft.subtitleStyle).toBe("modern");
    expect(resetDraft.subtitleColor).toBe("purple");
    expect(resetDraft.segments[0]?.text).toBe("");
    expect(resetDraft.segments[0]?.voiceType).toBeNull();
    expect(resetDraft.segments[0]?.sceneSoundPrompt).toBe("");
    expect(resetDraft.segments[0]?.speechWords).toEqual([]);
    expect(isWorkspaceSegmentEditorDraftSegmentEmpty(resetDraft.segments[0])).toBe(true);
    expect(shouldResetWorkspaceSegmentEditorDraftTrackSettingsForBlankScene(resetDraft)).toBe(true);
    expect(getWorkspaceSegmentEditorGenerationOverrides(resetDraft)).toMatchObject({
      subtitleColorId: undefined,
      subtitleEnabled: false,
      subtitleStyleId: undefined,
    });
    expect(
      buildWorkspaceSegmentEditorTracks(resetDraft.segments, resetDraft.segments, resetDraft, resetDraft).rows
        .flatMap((row) => row.spans)
        .some((span) => span.isEdited),
    ).toBe(false);
  });

  it("suppresses changed track states for a single blank scene with stale global settings", () => {
    const blankSegment = createDraftSegment({
      originalText: "Deleted scene",
      originalTextByLanguage: { ru: "Deleted scene" },
      text: "",
      textByLanguage: { ru: "" },
    });
    const blankDraft = {
      ...createDraftSession(blankSegment),
      customMusicAssetId: 601,
      customMusicFileName: "old-track.mp3",
      musicAssetId: 602,
      musicName: "old-track",
      musicType: "custom",
      subtitleType: "karaoke",
      ttsAssetId: 603,
      voiceType: "Boris",
    };
    const baseline = {
      ...createDraftSession(createDraftSegment({ index: 0, text: "Source scene" })),
      customMusicAssetId: null,
      customMusicFileName: "",
      musicAssetId: null,
      musicName: null,
      musicType: "ai",
      subtitleType: "karaoke",
      ttsAssetId: null,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    };

    expect(shouldResetWorkspaceSegmentEditorDraftTrackSettingsForBlankScene(blankDraft)).toBe(true);
    expect(isWorkspaceSegmentEditorCleanEmptyDraft(blankDraft)).toBe(false);
    expect(shouldSuppressWorkspaceSegmentEditorEmptyDraftChanges(blankDraft)).toBe(true);

    const shouldSuppressEditedState = shouldSuppressWorkspaceSegmentEditorEmptyDraftChanges(blankDraft);
    const tracks = buildWorkspaceSegmentEditorTracks(
      blankDraft.segments,
      shouldSuppressEditedState ? blankDraft.segments : baseline.segments,
      blankDraft,
      shouldSuppressEditedState ? blankDraft : baseline,
      {
        isSoundEdited: () => true,
        isTextEdited: () => true,
        isVisualEdited: () => true,
        isVoiceEdited: () => true,
        suppressEditedState: shouldSuppressEditedState,
      },
    );

    expect(tracks.rows.flatMap((row) => row.spans).some((span) => span.isEdited)).toBe(false);
  });

  it("keeps tracks unedited after adding another empty scene to a clean blank draft", () => {
    const sourceSegment = createDraftSegment({
      index: 0,
      text: "Only segment",
    });
    const sourceSession = {
      ...createDraftSession(sourceSegment),
      customMusicAssetId: 601,
      customMusicFileName: "old-track.mp3",
      musicAssetId: 602,
      musicName: "old-track",
      musicType: "custom",
      subtitleType: "karaoke",
      ttsAssetId: 603,
      voiceType: "Boris",
    };
    const resetDraft = resetWorkspaceSegmentEditorDraftTrackSettingsForBlankScene({
      ...sourceSession,
      segments: resolveWorkspaceSegmentEditorSegmentsAfterDelete(sourceSession, sourceSegment.index),
    });
    const addedSegment = createWorkspaceSegmentEditorInsertedSegment({
      draft: resetDraft,
      insertAt: 1,
      reservedSegmentIndexes: [sourceSegment.index, resetDraft.segments[0]!.index],
    });
    const draftWithAddedEmptyScene = {
      ...resetDraft,
      segments: [...resetDraft.segments, addedSegment],
    };
    const trackBaseline = isWorkspaceSegmentEditorCleanEmptyDraft(draftWithAddedEmptyScene)
      ? draftWithAddedEmptyScene
      : sourceSession;

    expect(isWorkspaceSegmentEditorCleanEmptyDraft(draftWithAddedEmptyScene)).toBe(true);
    expect(
      buildWorkspaceSegmentEditorTracks(
        draftWithAddedEmptyScene.segments,
        trackBaseline.segments,
        draftWithAddedEmptyScene,
        trackBaseline,
      ).rows
        .flatMap((row) => row.spans)
        .some((span) => span.isEdited),
    ).toBe(false);
  });

  it("uses modern subtitles as the default selection for a clean blank draft", () => {
    const resetDraft = resetWorkspaceSegmentEditorDraftTrackSettingsForBlankScene({
      ...createDraftSession(createDraftSegment({ index: 0, text: "Only segment" })),
      segments: [createDraftSegment({ index: 0, text: "" })],
    });
    const blankDraftWithStaleSubtitleSelection = {
      ...resetDraft,
      subtitleColor: "gold",
      subtitleStyle: "impact",
    };

    expect(isWorkspaceSegmentEditorCleanEmptyDraft(blankDraftWithStaleSubtitleSelection)).toBe(true);
    expect(
      getWorkspaceSegmentEditorEffectiveSubtitleSelection(blankDraftWithStaleSubtitleSelection, {
        subtitleColorId: "gold",
        subtitleStyleId: "impact",
      }),
    ).toEqual({
      subtitleColorId: "purple",
      subtitleStyleId: "modern",
    });
  });

  it("treats a blank draft with omitted global settings as clean", () => {
    const blankDraft = {
      ...resetWorkspaceSegmentEditorDraftTrackSettingsForBlankScene({
        ...createDraftSession(createDraftSegment({ index: 0, text: "Only segment" })),
        segments: [createDraftSegment({ index: 0, originalText: "", text: "" })],
      }),
      musicType: undefined,
      subtitleType: undefined,
      voiceType: undefined,
    };

    expect(isWorkspaceSegmentEditorCleanEmptyDraft(blankDraft)).toBe(true);
  });

  it("keeps reset music assets empty when a fresh server session still has old generated music", () => {
    const sourceSegment = createDraftSegment({ index: 0, text: "Only segment" });
    const nextSegments = resolveWorkspaceSegmentEditorSegmentsAfterDelete(
      createDraftSession(sourceSegment),
      sourceSegment.index,
    );
    const resetDraft = resetWorkspaceSegmentEditorDraftTrackSettingsForBlankScene({
      ...createDraftSession(nextSegments[0]!),
      musicAssetId: 701,
      musicName: "seran-meridiany-muzyka.mp3",
      segments: nextSegments,
    });
    const freshSessionWithOldMusic = {
      ...createFreshSession(createDraftSegment({ index: nextSegments[0]!.index, text: "Fresh server segment" })),
      musicAssetId: 701,
      musicName: "seran-meridiany-muzyka.mp3",
      musicType: "ai",
    };

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      resetDraft,
      freshSessionWithOldMusic,
      {
        baselineSession: freshSessionWithOldMusic,
        preserveLiveStructure: true,
      },
    );

    expect(refreshedDraft.musicType).toBe("none");
    expect(refreshedDraft.musicAssetId).toBeNull();
    expect(refreshedDraft.musicName).toBeNull();
    expect(refreshedDraft.customMusicAssetId).toBeNull();
    expect(refreshedDraft.customMusicFileName).toBeNull();
    expect(isWorkspaceSegmentEditorDraftSegmentEmpty(refreshedDraft.segments[0])).toBe(true);
  });

  it("keeps the add card as a non-navigable right carousel slot for one blank scene", () => {
    const slots = getWorkspaceSegmentEditorCarouselSlots({
      activeSegmentIndex: 0,
      canAddSegment: true,
      segmentCount: 1,
    });
    const navigation = getWorkspaceSegmentEditorCarouselNavigation({
      activeSegmentIndex: 0,
      segmentCount: 1,
    });

    expect(slots).toEqual([
      { kind: "empty", offset: -1, segmentArrayIndex: -1 },
      { kind: "segment", offset: 0, segmentArrayIndex: 0 },
      { kind: "add", offset: 1, segmentArrayIndex: 1 },
    ]);
    expect(navigation.canNavigatePrevious).toBe(false);
    expect(navigation.canNavigateNext).toBe(false);
  });

  it("can include an extra forward carousel slot for full-preview video preloading", () => {
    const slots = getWorkspaceSegmentEditorCarouselSlots({
      activeSegmentIndex: 1,
      canAddSegment: true,
      forwardPreloadCount: 2,
      segmentCount: 5,
    });

    expect(slots).toEqual([
      { kind: "segment", offset: -1, segmentArrayIndex: 0 },
      { kind: "segment", offset: 0, segmentArrayIndex: 1 },
      { kind: "segment", offset: 1, segmentArrayIndex: 2 },
      { kind: "segment", offset: 2, segmentArrayIndex: 3 },
    ]);
  });

  it("keeps a single empty segment when delete is requested again", () => {
    const sourceSegment = createDraftSegment({ index: 0, text: "Source segment" });
    const emptySegment = createWorkspaceSegmentEditorInsertedSegment({
      draft: createDraftSession(sourceSegment),
      insertAt: 0,
    });
    const draft = {
      ...createDraftSession(emptySegment),
      segments: [emptySegment],
    };

    expect(resolveWorkspaceSegmentEditorSegmentsAfterDelete(draft, emptySegment.index)).toBe(draft.segments);
  });

  it("does not require delete confirmation for a blank segment", () => {
    const sourceSegment = createDraftSegment({ index: 0, text: "Source segment" });
    const emptySegment = createWorkspaceSegmentEditorInsertedSegment({
      draft: createDraftSession(sourceSegment),
      insertAt: 1,
    });
    const draft = {
      ...createDraftSession(sourceSegment),
      segments: [sourceSegment, emptySegment],
    };

    expect(shouldConfirmWorkspaceSegmentEditorSegmentDelete(draft, emptySegment.index)).toBe(false);
  });

  it("does not require delete confirmation for a segment without a visual", () => {
    const sourceSegment = createDraftSegment({ index: 0, text: "Source segment" });
    const textOnlySegment = createDraftSegment({
      index: 1,
      originalText: "Voiceover draft",
      text: "Voiceover draft",
      textByLanguage: { ru: "Voiceover draft" },
    });
    const draft = {
      ...createDraftSession(sourceSegment),
      segments: [sourceSegment, textOnlySegment],
    };

    expect(shouldConfirmWorkspaceSegmentEditorSegmentDelete(draft, textOnlySegment.index)).toBe(false);
  });

  it("requires delete confirmation for a segment with content", () => {
    const sourceSegment = createDraftSegment({ index: 0, text: "Source segment" });
    const contentSegment = createDraftSegment({
      currentAsset: createMediaAsset(202, { mediaType: "video" }),
      currentPlaybackUrl: "/api/workspace/media-assets/202",
      index: 1,
      text: "Segment with content",
    });
    const draft = {
      ...createDraftSession(sourceSegment),
      segments: [sourceSegment, contentSegment],
    };

    expect(shouldConfirmWorkspaceSegmentEditorSegmentDelete(draft, contentSegment.index)).toBe(true);
  });

  it("allocates new blank segments outside reserved project segment indexes", () => {
    const sourceSegment = createDraftSegment({ index: 0, text: "Source segment" });
    const insertedSegment = createWorkspaceSegmentEditorInsertedSegment({
      draft: createDraftSession(sourceSegment),
      insertAt: 1,
      reservedSegmentIndexes: [0, 1],
    });

    expect(insertedSegment.index).toBe(2);
    expect(isWorkspaceSegmentEditorDraftSegmentEmpty(insertedSegment)).toBe(true);
  });

  it("uses reserved project segment indexes when replacing the last segment", () => {
    const sourceSegment = createDraftSegment({ index: 0, text: "Only segment" });
    const nextSegments = resolveWorkspaceSegmentEditorSegmentsAfterDelete(
      createDraftSession(sourceSegment),
      sourceSegment.index,
      { reservedSegmentIndexes: [0, 1] },
    );

    expect(nextSegments).toHaveLength(1);
    expect(nextSegments[0]?.index).toBe(2);
    expect(isWorkspaceSegmentEditorDraftSegmentEmpty(nextSegments[0])).toBe(true);
  });

  it("does not stretch later segments after deleting a middle scene and editing earlier voice text", () => {
    const sourceSegments = [
      {
        duration: 6.44,
        speechDuration: 6.12,
        text: "Чемпионат мира 2026 года в Северной Америке перевернет все футбольные расклады!",
      },
      {
        duration: 6.2,
        speechDuration: 5.78,
        text: "Третье место забирает дерзкая Колумбия благодаря своей невероятной физике и дисциплине.",
      },
      {
        duration: 5.96,
        speechDuration: 5.62,
        text: "Вторыми станут французы, ведь глубина их состава позволяет выставить два равноценных ростера.",
      },
      {
        duration: 6.92,
        speechDuration: 6.92,
        text: "Но скептики уверены, что европейский прагматизм всегда побеждает южноамериканский яркий карнавал.",
      },
      {
        duration: 8.14,
        speechDuration: 7.78,
        text: "Однако нынешняя Бразилия нашла идеальный баланс между техникой Винисиуса и железной обороной.",
      },
      {
        duration: 5.895,
        speechDuration: 5.44,
        text: "Именно пентакампеоны выглядят главными претендентами на золото. А какой ваш топ три?",
      },
    ].reduce<{
      cursor: number;
      segments: DraftSegment[];
    }>((result, source, index) => {
      const startTime = Number(result.cursor.toFixed(3));
      const endTime = Number((startTime + source.duration).toFixed(3));
      result.segments.push(createDraftSegment({
        currentAsset: createMediaAsset(900 + index, { mediaType: "photo", sourceKind: "ai_generated" }),
        currentPreviewUrl: `/api/workspace/project-segment-poster?projectId=4056&segmentIndex=${index}`,
        currentSourceKind: "ai_generated",
        duration: source.duration,
        durationMode: "auto",
        endTime,
        index,
        mediaType: "photo",
        originalAsset: createMediaAsset(800 + index, { mediaType: "photo", sourceKind: "ai_generated" }),
        originalPreviewUrl: `/api/workspace/project-segment-poster?projectId=4056&segmentIndex=${index}&source=original`,
        originalSourceKind: "ai_generated",
        speechDuration: source.speechDuration,
        speechDurationSource: "audio",
        speechEndTime: Number((startTime + source.speechDuration).toFixed(3)),
        speechStartTime: startTime,
        speechWords: [
          { confidence: 1, endTime: Number((startTime + source.speechDuration).toFixed(3)), startTime, text: "word" },
        ],
        startTime,
        text: source.text,
        textByLanguage: { ru: source.text },
      }));
      result.cursor = endTime;
      return result;
    }, { cursor: 0, segments: [] }).segments;
    const sourceDraft = {
      ...createDraftSession(sourceSegments[0]!),
      projectId: 4056,
      segments: sourceSegments,
      ttsAssetId: 123,
    };
    const afterDelete = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...sourceDraft,
      segments: resolveWorkspaceSegmentEditorSegmentsAfterDelete(sourceDraft, 4),
    }, {
      preserveSpeechBoundaries: false,
      preserveSourceTimelineEnd: false,
    });
    const editedFirstText = "Чемпионат мира 2026 в Северной Америке перевернет все футбольные расклады!";
    const afterTextEdit = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...afterDelete,
      segments: afterDelete.segments.map((segment) =>
        segment.index === 0
          ? clearWorkspaceSegmentEditorVoiceoverGenerationState({
              ...segment,
              text: editedFirstText,
              textByLanguage: { ru: editedFirstText },
            }, {
              preserveUserSelectedVisualDuration: false,
              previousText: segment.text,
              resetTimelineToEstimatedVoiceover: true,
              session: afterDelete,
            })
          : segment,
      ),
      ttsAssetId: null,
    }, {
      preserveExistingStillDurations: false,
      preserveSpeechBoundaries: false,
      preserveSourceTimelineEnd: false,
    });

    expect(afterTextEdit.segments.map((segment) => Number(segment.duration.toFixed(1)))).toEqual([
      5.8,
      5.8,
      5.6,
      6.9,
      5.4,
    ]);
    expect(afterTextEdit.segments[3]).toEqual(expect.objectContaining({
      duration: 6.92,
      text: sourceSegments[3]?.text,
    }));
    expect(afterTextEdit.segments[4]).toEqual(expect.objectContaining({
      duration: 5.44,
      text: sourceSegments[5]?.text,
    }));

    const corruptedLiveDraft = {
      ...afterDelete,
      segments: afterDelete.segments.map((segment) => {
        if (segment.index === 3) {
          return {
            ...segment,
            duration: 11,
            endTime: 29.2,
            startTime: 18.2,
          };
        }
        if (segment.index === 5) {
          return {
            ...segment,
            duration: 9.5,
            endTime: 38.7,
            startTime: 29.2,
          };
        }
        return segment;
      }),
    };
    const repairedLiveDraft = rebuildWorkspaceSegmentEditorDraftSessionTimeline(corruptedLiveDraft, {
      preserveExistingStillDurations: false,
      preserveSpeechBoundaries: false,
      preserveSourceTimelineEnd: false,
    });

    expect(repairedLiveDraft.segments[3]).toEqual(expect.objectContaining({
      duration: 6.92,
      text: sourceSegments[3]?.text,
    }));
    expect(repairedLiveDraft.segments[4]).toEqual(expect.objectContaining({
      duration: 5.44,
      text: sourceSegments[5]?.text,
    }));
  });

  it("does not hydrate a blank inserted segment from a generated media entry with the same index", () => {
    const sourceSegment = createDraftSegment({ index: 0, text: "Source segment" });
    const emptySegment = createWorkspaceSegmentEditorInsertedSegment({
      draft: createDraftSession(sourceSegment),
      insertAt: 1,
    });
    const draft = {
      ...createDraftSession(emptySegment),
      segments: [emptySegment],
    };

    const hydratedDraft = hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary(
      draft,
      [createGeneratedMediaLibraryEntry(303, "ai_photo", { segmentIndex: emptySegment.index })],
    );

    expect(hydratedDraft?.segments[0]?.videoAction).toBe("original");
    expect(hydratedDraft?.segments[0]?.aiPhotoAsset).toBeNull();
    expect(getWorkspaceSegmentDraftPreviewUrl(hydratedDraft!.segments[0]!)).toBeNull();
  });

  it("does not merge server visual data back into a blank inserted segment during refresh", () => {
    const sourceSegment = createDraftSegment({
      currentAsset: createMediaAsset(401, { mediaType: "photo", sourceKind: "ai_generated" }),
      currentPreviewUrl: "/api/workspace/media-assets/401",
      currentSourceKind: "ai_generated",
      index: 1,
      mediaType: "photo",
      originalAsset: createMediaAsset(401, { mediaType: "photo", sourceKind: "ai_generated" }),
      originalPreviewUrl: "/api/workspace/media-assets/401",
      originalSourceKind: "ai_generated",
      text: "Fresh server segment",
    });
    const emptySegment = createWorkspaceSegmentEditorInsertedSegment({
      draft: {
        ...createDraftSession(createDraftSegment({ index: 0 })),
        segments: [createDraftSegment({ index: 0 })],
      },
      insertAt: 1,
    });
    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      {
        ...createDraftSession(emptySegment),
        segments: [emptySegment],
      },
      createFreshSessionFromDraftSegments([createDraftSegment({ index: 0 }), sourceSegment]),
      { preserveLiveStructure: true },
    );

    expect(refreshedDraft.segments[0]?.index).toBe(emptySegment.index);
    expect(refreshedDraft.segments[0]?.currentAsset).toBeNull();
    expect(refreshedDraft.segments[0]?.originalAsset).toBeNull();
    expect(getWorkspaceSegmentDraftPreviewUrl(refreshedDraft.segments[0]!)).toBeNull();
    expect(isWorkspaceSegmentEditorDraftSegmentEmpty(refreshedDraft.segments[0])).toBe(true);
  });

  it("adds fresh tail segments to a stale stored draft when no baseline session exists", () => {
    const staleSegments = [0, 1, 2, 3].map((index) =>
      createDraftSegment({
        duration: 4,
        endTime: (index + 1) * 4,
        index,
        startTime: index * 4,
        text: `Stored ${index + 1}`,
      }),
    );
    const freshSegments = [0, 1, 2, 3, 4, 5].map((index) =>
      createDraftSegment({
        duration: 4,
        endTime: (index + 1) * 4,
        index,
        startTime: index * 4,
        text: `Fresh ${index + 1}`,
      }),
    );

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      {
        ...createDraftSession(staleSegments[0]!),
        segments: staleSegments,
      },
      createFreshSessionFromDraftSegments(freshSegments),
    );

    expect(refreshedDraft.segments.map((segment) => segment.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(refreshedDraft.segments[0]?.text).toBe("Stored 1");
    expect(refreshedDraft.segments[4]?.text).toBe("Fresh 5");
  });

  it("preserves a short-prefix draft when the current session explicitly changed structure", () => {
    const liveSegments = [0, 1, 2, 3].map((index) =>
      createDraftSegment({
        duration: 4,
        endTime: (index + 1) * 4,
        index,
        startTime: index * 4,
        text: `Live ${index + 1}`,
      }),
    );
    const freshSegments = [0, 1, 2, 3, 4, 5].map((index) =>
      createDraftSegment({
        duration: 4,
        endTime: (index + 1) * 4,
        index,
        startTime: index * 4,
        text: `Fresh ${index + 1}`,
      }),
    );

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      {
        ...createDraftSession(liveSegments[0]!),
        segments: liveSegments,
      },
      createFreshSessionFromDraftSegments(freshSegments),
      { preserveLiveStructure: true },
    );

    expect(refreshedDraft.segments.map((segment) => segment.index)).toEqual([0, 1, 2, 3]);
  });

  it("keeps non-prefix local structure during a fresh refresh without a baseline session", () => {
    const liveSegments = [
      createDraftSegment({ index: 0, text: "First" }),
      createDraftSegment({ index: 2, startTime: 8, endTime: 12, duration: 4, text: "Third" }),
    ];
    const freshSegments = [
      createDraftSegment({ index: 0, text: "First" }),
      createDraftSegment({ index: 1, startTime: 4, endTime: 8, duration: 4, text: "Second" }),
      createDraftSegment({ index: 2, startTime: 8, endTime: 12, duration: 4, text: "Third" }),
    ];

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      {
        ...createDraftSession(liveSegments[0]!),
        segments: liveSegments,
      },
      createFreshSessionFromDraftSegments(freshSegments),
    );

    expect(refreshedDraft.segments.map((segment) => segment.index)).toEqual([0, 2]);
  });

  it("detects accidental payload structure changes before upload", () => {
    const firstSegment = createDraftSegment({ index: 0, text: "First" });
    const secondSegment = createDraftSegment({ index: 1, startTime: 4, endTime: 8, duration: 4, text: "Second" });
    const draft = {
      ...createDraftSession(firstSegment),
      segments: [secondSegment, firstSegment],
    };

    expect(
      doesWorkspaceSegmentEditorPayloadMatchSessionStructure(draft, {
        segments: [
          { index: 1, text: "Second", videoAction: "original" },
          { index: 0, text: "First", videoAction: "original" },
        ],
      }),
    ).toBe(true);
    expect(
      doesWorkspaceSegmentEditorPayloadMatchSessionStructure(draft, {
        segments: [
          { index: 0, text: "First", videoAction: "original" },
          { index: 1, text: "Second", videoAction: "original" },
        ],
      }),
    ).toBe(false);
  });

  it("marks replacing custom music with another custom file as a change", () => {
    const segment = createDraftSegment({ index: 0, text: "First" });
    const baseline = {
      ...createDraftSession(segment),
      customMusicAssetId: 441,
      customMusicFileName: "old-track.mp3",
      musicType: "custom",
    };
    const draft = {
      ...baseline,
      customMusicAssetId: null,
      customMusicFileName: "new-track.mp3",
      musicType: "custom",
    };

    expect(buildWorkspaceSegmentEditorChangeChecklist(draft, baseline)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "global",
          resetSettingIds: expect.arrayContaining(["music"]),
        }),
      ]),
    );
  });
});

describe("WorkspacePage studio route transitions", () => {
  it("defers edit-route restoration while navigation to another studio section is pending", () => {
    expect(shouldDeferSegmentEditorRouteRestore("create")).toBe(true);
    expect(shouldDeferSegmentEditorRouteRestore("projects")).toBe(true);
    expect(shouldDeferSegmentEditorRouteRestore("media")).toBe(true);
    expect(shouldDeferSegmentEditorRouteRestore("edit")).toBe(false);
    expect(shouldDeferSegmentEditorRouteRestore(null)).toBe(false);
  });

  it("defers stale edit-route restoration until the selected scene URL is current", () => {
    expect(resolveWorkspaceSegmentEditorPendingRouteSync("3643:2", "3643:1")).toEqual({
      didReachPendingRoute: false,
      nextPendingRouteSyncKey: "3643:2",
      shouldDeferRestore: true,
    });
  });

  it("consumes the pending edit-route sync when the selected scene URL arrives", () => {
    expect(resolveWorkspaceSegmentEditorPendingRouteSync("3643:2", "3643:2")).toEqual({
      didReachPendingRoute: true,
      nextPendingRouteSyncKey: null,
      shouldDeferRestore: false,
    });
  });

  it("resets a consumed source project once so edit-route restoration cannot loop", () => {
    const resetProjectIds = new Set<number>();

    expect(shouldResetWorkspaceSegmentEditorConsumedSourceProject(3731, true, resetProjectIds)).toBe(true);

    resetProjectIds.add(3731);

    expect(shouldResetWorkspaceSegmentEditorConsumedSourceProject(3731, true, resetProjectIds)).toBe(false);
    expect(shouldResetWorkspaceSegmentEditorConsumedSourceProject(3732, false, resetProjectIds)).toBe(false);
  });

  it("requests only one fresh edit-route session per route key", () => {
    expect(shouldRequestWorkspaceSegmentEditorFreshRouteSession("3731:1", null, null)).toBe(true);
    expect(shouldRequestWorkspaceSegmentEditorFreshRouteSession("3731:1", "3731:1", null)).toBe(false);
    expect(shouldRequestWorkspaceSegmentEditorFreshRouteSession("3731:1", null, "3731:1")).toBe(false);
    expect(shouldRequestWorkspaceSegmentEditorFreshRouteSession("3731:2", null, "3731:1")).toBe(true);
    expect(shouldRequestWorkspaceSegmentEditorFreshRouteSession("", null, null)).toBe(false);
  });

  it("does not refresh an already open edit route after local scene navigation", () => {
    expect(shouldRequestWorkspaceSegmentEditorOpenRouteRefresh(true, false, false)).toBe(false);
    expect(shouldRequestWorkspaceSegmentEditorOpenRouteRefresh(false, true, false)).toBe(false);
    expect(shouldRequestWorkspaceSegmentEditorOpenRouteRefresh(false, false, true)).toBe(false);
    expect(shouldRequestWorkspaceSegmentEditorOpenRouteRefresh(false, false, false)).toBe(true);
  });

  it("does not reopen an already handled active edit-route draft", () => {
    expect(
      shouldSkipWorkspaceSegmentEditorActiveDraftReopen(3731, 1, 3731, 1, null, null, true, true),
    ).toBe(true);
    expect(
      shouldSkipWorkspaceSegmentEditorActiveDraftReopen(3731, 1, null, null, "3731:1", "3731:1", true, true),
    ).toBe(true);
    expect(
      shouldSkipWorkspaceSegmentEditorActiveDraftReopen(3731, 2, 3731, 1, "3731:1", "3731:1", true, true),
    ).toBe(false);
    expect(
      shouldSkipWorkspaceSegmentEditorActiveDraftReopen(3731, 1, 3731, 1, "3731:1", "3731:1", false, true),
    ).toBe(false);
    expect(
      shouldSkipWorkspaceSegmentEditorActiveDraftReopen(3731, 1, 3731, 1, "3731:1", "3731:1", true, false),
    ).toBe(false);
  });

  it("keeps scene creation mode on the create route only", () => {
    expect(getStudioRouteState("?mode=scenes")).toEqual(
      expect.objectContaining({
        mode: "scenes",
        projectId: null,
        section: "create",
        segmentIndex: null,
      }),
    );
    expect(buildStudioRouteUrl("", "create", { mode: "scenes" })).toBe("/app/studio?mode=scenes");
    expect(buildStudioRouteUrl("?mode=scenes", "edit", { projectId: 42, segmentIndex: 1 })).toBe(
      "/app/studio?section=edit&projectId=42&segment=1",
    );
  });

  it("starts scene creation from a fresh draft when requested explicitly", () => {
    expect(
      resolveWorkspaceSegmentEditorScratchDraftOpenSource({
        forceFreshDraft: true,
        hasCurrentScratchDraft: true,
        hasStoredScratchDraft: true,
      }),
    ).toBe("fresh");
    expect(
      resolveWorkspaceSegmentEditorScratchDraftOpenSource({
        hasCurrentScratchDraft: true,
        hasStoredScratchDraft: true,
      }),
    ).toBe("current");
    expect(
      resolveWorkspaceSegmentEditorScratchDraftOpenSource({
        hasStoredScratchDraft: true,
      }),
    ).toBe("stored");
    expect(resolveWorkspaceSegmentEditorScratchDraftOpenSource({})).toBe("fresh");
  });
});

describe("WorkspacePage studio locale defaults", () => {
  it("uses the current site locale for initial Studio language and voice", () => {
    expect(getWorkspaceInitialStudioDefaults("ru")).toEqual({
      language: "ru",
      voiceId: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    expect(getWorkspaceInitialStudioDefaults("en")).toEqual({
      language: "en",
      voiceId: DEFAULT_STUDIO_VOICE_ID.en,
    });
  });

  it("keeps voice ids inside the selected Studio language", () => {
    expect(getStudioLanguageForVoiceId(DEFAULT_STUDIO_VOICE_ID.ru)).toBe("ru");
    expect(getStudioLanguageForVoiceId(DEFAULT_STUDIO_VOICE_ID.en)).toBe("en");
    expect(getStudioLanguageForVoiceId("Liam")).toBe("ru");
    expect(getStudioLanguageForVoiceId("liam")).toBe("ru");
    expect(getStudioLanguageForVoiceId("English_ManWithDeepVoice")).toBe("ru");
    expect(getStudioLanguageForVoiceId("Russian_BrightHeroine")).toBe("ru");
    expect(getStudioLanguageForVoiceId("Russian_HandsomeChildhoodFriend")).toBeNull();
    expect(getStudioLanguageForVoiceId("Rma_24000")).toBeNull();
    expect(getStudioLanguageForVoiceId("Rnu_24000")).toBeNull();
    expect(resolveStudioVoiceIdForLanguage("en", DEFAULT_STUDIO_VOICE_ID.ru)).toBe(DEFAULT_STUDIO_VOICE_ID.en);
    expect(resolveStudioVoiceIdForLanguage("ru", DEFAULT_STUDIO_VOICE_ID.en)).toBe(DEFAULT_STUDIO_VOICE_ID.ru);
    expect(resolveStudioVoiceIdForLanguage("ru", "Liam")).toBe("Liam");
    expect(resolveStudioVoiceIdForLanguage("ru", "liam")).toBe("Liam");
    expect(resolveStudioVoiceIdForLanguage("ru", "Russian_BrightHeroine")).toBe("Russian_BrightHeroine");
    expect(getStudioVoiceCreditCost("Liam")).toBe(5);
    expect(getStudioVoiceCreditCost("liam")).toBe(5);
    expect(getStudioVoiceCreditCost("English_ManWithDeepVoice")).toBe(5);
    expect(getStudioVoiceCreditCost("Russian_BrightHeroine")).toBe(5);
    expect(getStudioVoiceCreditCost("Russian_HandsomeChildhoodFriend")).toBe(0);
  });

  it("restores the last valid voice for the target Studio language", () => {
    expect(resolveStudioVoiceIdForLanguage("en", DEFAULT_STUDIO_VOICE_ID.ru, "Ryan")).toBe("Ryan");
    expect(resolveStudioVoiceIdForLanguage("ru", DEFAULT_STUDIO_VOICE_ID.en, "Rma_24000")).toBe(
      DEFAULT_STUDIO_VOICE_ID.ru,
    );
    expect(resolveStudioVoiceIdForLanguage("en", DEFAULT_STUDIO_VOICE_ID.ru, "invalid")).toBe(
      DEFAULT_STUDIO_VOICE_ID.en,
    );
  });

  it("keeps a just-selected voice enabled for generation even when old state was silent", () => {
    const voiceRequest = resolveWorkspaceGenerationVoiceRequest({
      currentLanguage: "ru",
      currentVoiceEnabled: false,
      explicitVoiceSelection: { language: "ru", voiceId: "male-qn-jingying" },
      generationLanguage: "ru",
      selectedVoiceId: DEFAULT_STUDIO_VOICE_ID.ru,
      selectedVoiceIdForLanguage: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    expect(voiceRequest).toEqual({
      voiceEnabled: true,
      voiceId: "male-qn-jingying",
    });
  });

  it("keeps voice disabled when the user explicitly requests a silent generation", () => {
    const voiceRequest = resolveWorkspaceGenerationVoiceRequest({
      currentLanguage: "ru",
      currentVoiceEnabled: true,
      explicitVoiceSelection: { language: "ru", voiceId: "male-qn-jingying" },
      generationLanguage: "ru",
      requestedVoiceEnabled: false,
      selectedVoiceId: "male-qn-jingying",
      selectedVoiceIdForLanguage: "male-qn-jingying",
    });

    expect(voiceRequest).toEqual({
      voiceEnabled: false,
      voiceId: undefined,
    });
  });

  it("uses bundled voice preview files instead of generated API previews", () => {
    for (const voiceOptions of Object.values(studioVoiceOptionsByLanguage)) {
      for (const voice of voiceOptions) {
        expect(voice.previewSampleUrl).toMatch(/^\/voice-previews\/[^?]+\.wav\?v=/);
        expect(voice.previewSampleUrl).not.toContain("/api/workspace/voice-preview");
        expect(Object.prototype.hasOwnProperty.call(voice, "previewText")).toBe(false);
      }
    }
  });

  it("carries the segment editor language with the selected voice for regeneration", () => {
    const overrides = getWorkspaceSegmentEditorGenerationOverrides({
      ...createDraftSession(createDraftSegment()),
      language: "en",
      voiceType: "Ryan",
    });

    expect(overrides.language).toBe("en");
    expect(overrides.voiceEnabled).toBe(true);
    expect(overrides.voiceId).toBe("Ryan");
  });

  it("turns segment editor subtitles off when global voiceover is disabled", () => {
    const overrides = getWorkspaceSegmentEditorGenerationOverrides({
      ...createDraftSession(createDraftSegment()),
      subtitleType: "default",
      voiceType: "none",
    });

    expect(overrides.subtitleEnabled).toBe(false);
    expect(overrides.subtitleColorId).toBeUndefined();
    expect(overrides.subtitleStyleId).toBeUndefined();
    expect(overrides.voiceEnabled).toBe(false);
  });

  it("keeps segment editor voice and subtitles enabled when a scene has its own voice", () => {
    const overrides = getWorkspaceSegmentEditorGenerationOverrides({
      ...createDraftSession(
        createDraftSegment({
          subtitleType: "default",
          voiceType: "male-qn-jingying",
        }),
      ),
      subtitleType: "none",
      voiceType: "none",
    });

    expect(overrides.voiceEnabled).toBe(true);
    expect(overrides.voiceId).toBeUndefined();
    expect(overrides.subtitleEnabled).toBe(true);
    expect(overrides.subtitleColorId).toBe("purple");
    expect(overrides.subtitleStyleId).toBe("modern");
  });

  it("preserves existing visuals for regeneration until the video mode is explicitly changed", () => {
    expect(
      resolveWorkspaceRegenerationVideoMode({
        selectedVideoMode: "ai_photo",
        wasVideoModeExplicitlyChanged: false,
      }),
    ).toBe("standard");

    expect(
      resolveWorkspaceRegenerationVideoMode({
        selectedVideoMode: "ai_photo",
        wasVideoModeExplicitlyChanged: true,
      }),
    ).toBe("ai_photo");
  });

  it("lets regeneration options override the selected studio video mode", () => {
    expect(
      resolveWorkspaceGenerationEffectiveVideoMode({
        requestedVideoMode: "standard",
        selectedVideoMode: "ai_photo",
      }),
    ).toBe("standard");
  });

  it("falls back from segment editor custom visual mode when no custom file is selected", () => {
    expect(
      resolveWorkspaceGenerationEffectiveVideoMode({
        hasSelectedCustomVideo: false,
        isSegmentEditorGeneration: true,
        requestedVideoMode: "custom",
        selectedVideoMode: "custom",
      }),
    ).toBe("standard");
  });

  it("blocks implicit segment structure changes before export", () => {
    const firstSegment = createDraftSegment({ index: 0 });
    const secondSegment = createDraftSegment({ index: 1 });
    const baseline = {
      ...createDraftSession(firstSegment),
      segments: [firstSegment, secondSegment],
    };
    const draft = {
      ...baseline,
      segments: [firstSegment],
    };

    expect(
      resolveWorkspaceSegmentEditorStructureChangePermission({
        baselineOrBaselines: baseline,
        draft,
        isExplicitStructureChange: false,
      }),
    ).toEqual({
      allowStructureChange: false,
      hasStructureChange: true,
      shouldBlockImplicitStructureChange: true,
    });
  });

  it("allows explicit segment structure changes after add, delete, or reorder", () => {
    const firstSegment = createDraftSegment({ index: 0 });
    const secondSegment = createDraftSegment({ index: 1 });
    const baseline = {
      ...createDraftSession(firstSegment),
      segments: [firstSegment, secondSegment],
    };
    const draft = {
      ...baseline,
      segments: [secondSegment, firstSegment],
    };

    expect(
      resolveWorkspaceSegmentEditorStructureChangePermission({
        baselineOrBaselines: baseline,
        draft,
        isExplicitStructureChange: true,
      }),
    ).toEqual({
      allowStructureChange: true,
      hasStructureChange: true,
      shouldBlockImplicitStructureChange: false,
    });
  });

  it("recovers explicit structure changes from a restored draft after a failed generation attempt", () => {
    const segments = [0, 1, 2, 3, 4, 5].map((index) => createDraftSegment({ index }));
    const insertedSegment = createDraftSegment({ index: 6 });
    const baseline = {
      ...createDraftSession(segments[0]),
      segments,
    };
    const restoredDraft = {
      ...baseline,
      segments: [segments[0], segments[1], segments[2], insertedSegment, segments[3], segments[4], segments[5]],
    };

    expect(shouldRecoverWorkspaceSegmentEditorExplicitStructureChange(restoredDraft, baseline)).toBe(true);
    expect(
      resolveWorkspaceSegmentEditorStructureChangePermission({
        baselineOrBaselines: baseline,
        draft: restoredDraft,
        isExplicitStructureChange: shouldRecoverWorkspaceSegmentEditorExplicitStructureChange(restoredDraft, baseline),
      }),
    ).toEqual({
      allowStructureChange: true,
      hasStructureChange: true,
      shouldBlockImplicitStructureChange: false,
    });
  });

  it("does not bind inserted segment uploads to unsaved project segment indexes", () => {
    const persistedSegment = createDraftSegment({
      currentAsset: createMediaAsset(101),
      index: 0,
      originalAsset: createMediaAsset(101),
    });
    const insertedSegment = createDraftSegment({
      currentAsset: null,
      currentPreviewUrl: null,
      currentSourceKind: "unknown",
      index: 9,
      originalAsset: null,
      originalPreviewUrl: null,
      originalSourceKind: "unknown",
    });
    const session = {
      ...createDraftSession(persistedSegment),
      projectId: 3439,
      segments: [persistedSegment, insertedSegment],
    };

    expect(
      resolveWorkspaceSegmentEditorMediaUploadScope(session, persistedSegment, {
        allowStructureChange: true,
        persistedSegmentIndexes: [0],
      }),
    ).toEqual({ projectId: 3439, segmentIndex: 0 });
    expect(
      resolveWorkspaceSegmentEditorMediaUploadScope(session, insertedSegment, {
        allowStructureChange: true,
        persistedSegmentIndexes: [0],
      }),
    ).toEqual({});
  });

  it("does not recover an implicit tail deletion as an explicit structure change", () => {
    const firstSegment = createDraftSegment({ index: 0 });
    const secondSegment = createDraftSegment({ index: 1 });
    const baseline = {
      ...createDraftSession(firstSegment),
      segments: [firstSegment, secondSegment],
    };
    const draft = {
      ...baseline,
      segments: [firstSegment],
    };

    expect(shouldRecoverWorkspaceSegmentEditorExplicitStructureChange(draft, baseline)).toBe(false);
  });

  it("does not mark untouched generated source media as resettable", () => {
    const originalAsset = createMediaAsset(101);
    const segment = createDraftSegment({
      currentAsset: originalAsset,
      currentSourceKind: "ai_generated",
      mediaType: "photo",
      originalAsset,
      originalSourceKind: "ai_generated",
    });

    expect(isWorkspaceSegmentDraftVisualResettable(segment)).toBe(false);
  });

  it("does not mark saved current visuals as new visual changes against the editor baseline", () => {
    const originalAsset = createMediaAsset(101, {
      mediaType: "photo",
      sourceKind: "stock",
    });
    const savedGeneratedAsset = createMediaAsset(303, {
      kind: "source_ai_video",
      mediaType: "video",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const savedSegment = createDraftSegment({
      currentAsset: savedGeneratedAsset,
      currentPlaybackUrl: "/api/workspace/media-assets/303",
      currentSourceKind: "ai_generated",
      mediaType: "video",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      videoAction: "original",
    });

    expect(isWorkspaceSegmentDraftVisualResettable(savedSegment)).toBe(true);
    expect(isWorkspaceSegmentDraftVisualChangedFromBaseline(savedSegment, savedSegment)).toBe(false);
    expect(buildWorkspaceSegmentEditorChangeChecklist(createDraftSession(savedSegment), createDraftSession(savedSegment))).toEqual([]);
  });

  it("marks only the generated segment as a visual change when the other segment already had saved media", () => {
    const originalAsset = createMediaAsset(101, {
      mediaType: "photo",
      sourceKind: "stock",
    });
    const savedGeneratedAsset = createMediaAsset(303, {
      kind: "source_ai_video",
      mediaType: "video",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const untouchedSavedSegment = createDraftSegment({
      currentAsset: savedGeneratedAsset,
      currentPlaybackUrl: "/api/workspace/media-assets/303",
      currentSourceKind: "ai_generated",
      index: 0,
      mediaType: "video",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      videoAction: "original",
    });
    const photoSegment = createDraftSegment({
      currentAsset: originalAsset,
      currentPreviewUrl: "/api/workspace/media-assets/101",
      currentSourceKind: "stock",
      index: 1,
      mediaType: "photo",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      videoAction: "original",
    });
    const animatedSegment = createDraftSegment({
      ...photoSegment,
      aiVideoAsset: {
        assetId: 404,
        fileName: "segment-2-animation.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/404",
      },
      aiVideoGeneratedMode: "photo_animation",
      currentAsset: createMediaAsset(404, {
        kind: "source_ai_video",
        mediaType: "video",
        role: "segment_current",
        sourceKind: "ai_generated",
      }),
      currentPlaybackUrl: "/api/workspace/media-assets/404",
      currentSourceKind: "ai_generated",
      mediaType: "video",
      videoAction: "photo_animation",
    });
    const baseline = {
      ...createDraftSession(untouchedSavedSegment),
      segments: [untouchedSavedSegment, photoSegment],
    };
    const draft = {
      ...baseline,
      segments: [untouchedSavedSegment, animatedSegment],
    };

    expect(isWorkspaceSegmentDraftVisualChangedFromBaseline(untouchedSavedSegment, untouchedSavedSegment)).toBe(false);
    expect(isWorkspaceSegmentDraftVisualChangedFromBaseline(animatedSegment, photoSegment)).toBe(true);
    expect(getWorkspaceSegmentDraftVisualStatus(animatedSegment, photoSegment)).toBe("changed");
    expect(
      isWorkspaceSegmentDraftVisualChangedFromBaseline(animatedSegment, {
        ...animatedSegment,
        aiVideoAsset: null,
        aiVideoGeneratedMode: null,
        videoAction: "original",
      }),
    ).toBe(true);
    expect(buildWorkspaceSegmentEditorChangeChecklist(draft, baseline)).toEqual([
      expect.objectContaining({
        label: "Сегмент 2: добавлено движение в фото",
        resetVisual: true,
        segmentIndex: 1,
      }),
    ]);
  });

  it("keeps AI photo replacements resettable after a fresh session refresh", () => {
    const originalAsset = createMediaAsset(101);
    const generatedAsset = createMediaAsset(303, {
      kind: "segment_current",
      mediaType: "photo",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const liveSegment = createDraftSegment({
      aiPhotoAsset: {
        assetId: 303,
        fileName: "segment-ai-photo-1.png",
        fileSize: 0,
        mimeType: "image/png",
        remoteUrl: "/api/workspace/media-assets/303",
      },
      currentAsset: originalAsset,
      currentSourceKind: "ai_generated",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "ai_generated",
      videoAction: "ai_photo",
    });
    const collapsedFreshSegment = createDraftSegment({
      currentAsset: generatedAsset,
      currentPreviewUrl: "/api/workspace/media-assets/303",
      currentSourceKind: "ai_generated",
      originalAsset: generatedAsset,
      originalPreviewUrl: "/api/workspace/media-assets/303",
      originalSourceKind: "ai_generated",
    });

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      createDraftSession(liveSegment),
      createFreshSession(collapsedFreshSegment),
    );
    const refreshedSegment = refreshedDraft.segments[0];

    expect(refreshedSegment?.originalAsset?.assetId).toBe(101);
    expect(refreshedSegment?.originalPreviewUrl).toBe("/api/workspace/media-assets/101");
    expect(refreshedSegment && isWorkspaceSegmentDraftVisualResettable(refreshedSegment)).toBe(true);
  });

  it("repairs stale custom music metadata when the fresh project uses auto music", () => {
    const segment = createDraftSegment({ index: 0, text: "First" });
    const staleDraft = {
      ...createDraftSession(segment),
      customMusicAssetId: 649,
      customMusicFileName: "upbeat_10.mp3",
      musicType: "custom",
    };
    const freshSession = {
      ...createFreshSession(segment),
      customMusicAssetId: null,
      customMusicFileName: "",
      musicType: "upbeat",
    };
    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(staleDraft, freshSession, {
      baselineSession: staleDraft,
    });

    expect(refreshedDraft.musicType).toBe("upbeat");
    expect(refreshedDraft.customMusicAssetId).toBeNull();
    expect(refreshedDraft.customMusicFileName).toBeNull();
  });

  it("preserves a newly selected custom music file during a fresh session refresh", () => {
    const segment = createDraftSegment({ index: 0, text: "First" });
    const baseline = {
      ...createDraftSession(segment),
      musicType: "upbeat",
    };
    const liveDraft = {
      ...baseline,
      customMusicAssetId: null,
      customMusicFileName: "new-track.mp3",
      musicType: "custom",
    };
    const freshSession = {
      ...createFreshSession(segment),
      musicType: "upbeat",
    };
    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(liveDraft, freshSession, {
      baselineSession: baseline,
    });

    expect(refreshedDraft.musicType).toBe("custom");
    expect(refreshedDraft.customMusicAssetId).toBeNull();
    expect(refreshedDraft.customMusicFileName).toBe("new-track.mp3");
  });

  it("preserves a local scene sound when a fresh project voiceover arrives", () => {
    const baselineSegment = createDraftSegment({ index: 0, text: "Voiceover scene" });
    const liveSegment = createDraftSegment({
      ...baselineSegment,
      sceneSoundAsset: {
        assetId: 4636,
        fileName: "segment-sound.mp3",
        fileSize: 0,
        mimeType: "audio/mpeg",
        remoteUrl: "/api/workspace/media-assets/4636",
      },
      sceneSoundGeneratedFromPrompt: "soft wind",
      sceneSoundPrompt: "soft wind",
      sceneSoundPromptInitialized: true,
    });
    const freshSegment = createDraftSegment({
      ...baselineSegment,
      speechDuration: 3.2,
      speechEndTime: 3.2,
      speechStartTime: 0,
    });
    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      createDraftSession(liveSegment),
      {
        ...createFreshSession(freshSegment),
        ttsAssetId: 801,
        voiceType: "Boris",
      },
      {
        baselineSession: createFreshSession(baselineSegment),
      },
    );

    expect(refreshedDraft.ttsAssetId).toBe(801);
    expect(refreshedDraft.voiceType).toBe("Boris");
    expect(refreshedDraft.segments[0]?.sceneSoundAsset).toEqual(liveSegment.sceneSoundAsset);
    expect(refreshedDraft.segments[0]?.sceneSoundPrompt).toBe("soft wind");
  });

  it("preserves manual segment timing during a fresh session refresh", () => {
    const manualLiveSegment = createDraftSegment({
      duration: 6.5,
      durationMode: "manual",
      endTime: 6.5,
      index: 0,
      manualDurationSeconds: 6.5,
      startTime: 0,
      text: "Manual segment",
    });
    const nextLiveSegment = createDraftSegment({
      duration: 4,
      endTime: 10.5,
      index: 1,
      startTime: 6.5,
      text: "Next segment",
    });
    const staleFreshManualSegment = createDraftSegment({
      duration: 4,
      durationMode: "auto",
      endTime: 4,
      index: 0,
      manualDurationSeconds: null,
      startTime: 0,
      text: "Manual segment",
    });
    const staleFreshNextSegment = createDraftSegment({
      duration: 4,
      endTime: 8,
      index: 1,
      startTime: 4,
      text: "Next segment",
    });
    const staleFreshManualSession = createFreshSession(staleFreshManualSegment);
    const staleFreshNextSession = createFreshSession(staleFreshNextSegment);

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      {
        ...createDraftSession(manualLiveSegment),
        segments: [manualLiveSegment, nextLiveSegment],
      },
      {
        ...staleFreshManualSession,
        segments: [staleFreshManualSession.segments[0]!, staleFreshNextSession.segments[0]!],
      },
    );

    expect(refreshedDraft.segments[0]).toMatchObject({
      duration: 6.5,
      durationMode: "manual",
      endTime: 6.5,
      manualDurationSeconds: 6.5,
      startTime: 0,
    });
    expect(refreshedDraft.segments[1]).toMatchObject({
      startTime: 6.5,
    });
  });

  it("adopts fresh manual timing during refresh when no baseline is available", () => {
    const staleLiveSegment = createDraftSegment({
      duration: 13.6,
      durationMode: "manual",
      endTime: 13.6,
      index: 0,
      manualDurationSeconds: 13.6,
      startTime: 0,
      text: "Manual segment",
    });
    const freshSegment = createDraftSegment({
      duration: 13.04,
      durationMode: "manual",
      endTime: 13.04,
      index: 0,
      manualDurationSeconds: 13.04,
      startTime: 0,
      text: "Manual segment",
    });

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      createDraftSession(staleLiveSegment),
      createFreshSession(freshSegment),
      {
        baselineSession: null,
        preserveUnbaselinedManualDuration: false,
      },
    );

    expect(refreshedDraft.segments[0]).toMatchObject({
      duration: 13.04,
      durationMode: "manual",
      endTime: 13.04,
      manualDurationSeconds: 13.04,
      startTime: 0,
    });
  });

  it("adopts fresh shorter server timing instead of keeping a stale cached source duration", () => {
    const staleLiveSegment = createDraftSegment({
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 47.323,
      index: 7,
      manualDurationSeconds: 5,
      startTime: 42.323,
      text: "Final scene",
    });
    const freshServerSegment = createDraftSegment({
      duration: 2.9,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 45.223,
      index: 7,
      manualDurationSeconds: 2.9,
      startTime: 42.323,
      text: "Final scene",
    });
    const freshSession = createFreshSession(freshServerSegment);

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      createDraftSession(staleLiveSegment),
      freshSession,
      {
        baselineSession: freshSession,
      },
    );

    expect(refreshedDraft.segments[0]).toMatchObject({
      duration: 2.9,
      durationMode: "manual",
      endTime: 2.9,
      manualDurationSeconds: 2.9,
      startTime: 0,
    });
  });

  it("does not expand a fresh shorter server video scene back to its source duration", () => {
    const videoAsset = createMediaAsset(808, {
      kind: "segment_current",
      mediaType: "video",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const freshServerSegment = createDraftSegment({
      currentAsset: videoAsset,
      currentPlaybackUrl: "/api/workspace/media-assets/808/playback",
      currentPreviewUrl: "/api/workspace/media-assets/808/poster",
      currentSourceKind: "ai_generated",
      duration: 2.9,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      endTime: 45.223,
      index: 7,
      manualDurationSeconds: 2.9,
      mediaType: "video",
      startTime: 42.323,
      text: "Final scene",
    });

    const draft = createWorkspaceSegmentEditorDraftSession(createFreshSession(freshServerSegment));

    expect(draft.segments[0]).toMatchObject({
      duration: 2.9,
      durationMode: "manual",
      endTime: 2.9,
      manualDurationSeconds: 2.9,
      startTime: 0,
    });
  });

  it("preserves an explicitly selected visual duration during fresh session refresh", () => {
    const liveSegment = createDraftSegment({
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 47.323,
      index: 7,
      manualDurationSeconds: 5,
      startTime: 42.323,
      text: "Final scene",
    });
    const freshServerSegment = createDraftSegment({
      duration: 2.9,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 45.223,
      index: 7,
      manualDurationSeconds: 2.9,
      startTime: 42.323,
      text: "Final scene",
    });
    const freshSession = createFreshSession(freshServerSegment);

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      createDraftSession(liveSegment),
      freshSession,
      {
        baselineSession: freshSession,
      },
    );

    expect(refreshedDraft.segments[0]).toMatchObject({
      duration: 5,
      durationMode: "manual",
      endTime: 5,
      manualDurationSeconds: 5,
      startTime: 0,
    });
  });

  it("adopts fresh auto timing during refresh even when no stored baseline is available", () => {
    const staleLiveSegments = [
      createDraftSegment({
        duration: 4.7,
        durationMode: null,
        endTime: 4.7,
        index: 0,
        manualDurationSeconds: null,
        speechDuration: 4.7,
        startTime: 0,
        text: "First",
      }),
      createDraftSegment({
        duration: 4.7,
        durationMode: null,
        endTime: 9.4,
        index: 1,
        manualDurationSeconds: null,
        speechDuration: 4.7,
        startTime: 4.7,
        text: "Second",
      }),
    ];
    const freshSegments = [
      createDraftSegment({
        duration: 5.62,
        durationMode: null,
        endTime: 5.62,
        index: 0,
        manualDurationSeconds: null,
        speechDuration: 5.62,
        startTime: 0,
        text: "First",
      }),
      createDraftSegment({
        duration: 5.043,
        durationMode: null,
        endTime: 10.663,
        index: 1,
        manualDurationSeconds: null,
        speechDuration: 5.043,
        startTime: 5.62,
        text: "Second",
      }),
    ];

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      {
        ...createDraftSession(staleLiveSegments[0]!),
        segments: staleLiveSegments,
      },
      createFreshSessionFromDraftSegments(freshSegments),
    );

    expect(refreshedDraft.segments[0]).toMatchObject({
      duration: 5.62,
      endTime: 5.62,
      manualDurationSeconds: null,
      startTime: 0,
    });
    expect(refreshedDraft.segments[1]).toMatchObject({
      duration: 5.043,
      endTime: 10.663,
      manualDurationSeconds: null,
      startTime: 5.62,
    });
  });

  it("drops a stale scene voiceover asset when fresh project voiceover timing is available", () => {
    const staleLiveSegments = [
      createDraftSegment({
        duration: 5,
        endTime: 5,
        index: 0,
        speechDuration: 4.6,
        speechEndTime: 4.6,
        speechStartTime: 0,
        startTime: 0,
        text: "First",
        voiceoverAsset: {
          durationSeconds: 4.6,
          fileName: "old-segment-voiceover.wav",
          fileSize: 0,
          mimeType: "audio/wav",
          remoteUrl: "/api/workspace/project-segment-voiceover?projectId=77&segmentIndex=0",
          source: "media-library",
        },
        voiceoverLanguage: "ru",
        voiceoverTextHash: "old-hash",
        voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
      }),
      createDraftSegment({
        duration: 4.7,
        endTime: 9.7,
        index: 1,
        speechDuration: 4.7,
        speechEndTime: 9.7,
        speechStartTime: 5,
        startTime: 5,
        text: "Second",
      }),
    ];
    const freshSegments = [
      createDraftSegment({
        duration: 5.62,
        endTime: 5.62,
        index: 0,
        speechDuration: 5.16,
        speechEndTime: 5.16,
        speechStartTime: 0,
        speechWords: [{ confidence: 1, endTime: 5.04, startTime: 0.1, text: "First" }],
        startTime: 0,
        text: "First",
      }),
      createDraftSegment({
        duration: 5.043,
        endTime: 10.663,
        index: 1,
        speechDuration: 4.78,
        speechEndTime: 10.4,
        speechStartTime: 5.62,
        speechWords: [{ confidence: 1, endTime: 10.28, startTime: 5.7, text: "Second" }],
        startTime: 5.62,
        text: "Second",
      }),
    ];

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      {
        ...createDraftSession(staleLiveSegments[0]!),
        segments: staleLiveSegments,
      },
      {
        ...createFreshSessionFromDraftSegments(freshSegments),
        ttsAssetId: 123,
      },
    );

    expect(refreshedDraft.segments[0]).toMatchObject({
      speechDuration: 5.16,
      speechDurationSource: "audio",
      speechEndTime: 5.16,
      speechStartTime: 0,
      startTime: 0,
      voiceoverAsset: null,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("First"),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    expect(refreshedDraft.segments[1]).toMatchObject({
      speechDuration: 4.78,
      speechDurationSource: "audio",
      speechEndTime: 10.17,
      speechStartTime: 5.39,
      voiceoverAsset: null,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("Second"),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    expect(refreshedDraft.segments[1]?.speechWords).toEqual([
      { confidence: 1, endTime: 10.05, startTime: 5.47, text: "Second" },
    ]);
  });

  it("adopts the fresh project voice after whole-video voiceover generation", () => {
    const staleLiveSegment = createDraftSegment({
      duration: 5,
      endTime: 5,
      index: 0,
      speechDuration: 4.6,
      speechEndTime: 4.6,
      speechStartTime: 0,
      startTime: 0,
      text: "First",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("First"),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const freshSegment = createDraftSegment({
      duration: 5.2,
      endTime: 5.2,
      index: 0,
      speechDuration: 4.9,
      speechEndTime: 4.9,
      speechStartTime: 0,
      startTime: 0,
      text: "First",
    });
    const baseline = {
      ...createDraftSession(staleLiveSegment),
      ttsAssetId: 100,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    };
    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      {
        ...baseline,
        segments: [staleLiveSegment],
      },
      {
        ...createFreshSession(freshSegment),
        ttsAssetId: 200,
        voiceType: "Tur_24000",
      },
      {
        baselineSession: baseline,
      },
    );

    expect(refreshedDraft.voiceType).toBe("Tur_24000");
    expect(refreshedDraft.ttsAssetId).toBe(200);
    expect(refreshedDraft.segments[0]).toMatchObject({
      speechDuration: 4.9,
      speechDurationSource: "audio",
      speechEndTime: 4.9,
      voiceoverAsset: null,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("First"),
      voiceoverVoiceType: "Tur_24000",
    });
  });

  it("does not inflate fresh project voiceover timing to a longer manual scene duration", () => {
    const liveSegment = createDraftSegment({
      duration: 10,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 10,
      index: 0,
      manualDurationSeconds: 10,
      speechDuration: 10,
      speechEndTime: 10,
      speechStartTime: 0,
      startTime: 0,
      text: "First",
    });
    const freshSegment = createDraftSegment({
      duration: 10,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 10,
      index: 0,
      manualDurationSeconds: 10,
      speechDuration: 4,
      speechEndTime: 4,
      speechStartTime: 0,
      startTime: 0,
      text: "First",
    });

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      {
        ...createDraftSession(liveSegment),
        segments: [liveSegment],
      },
      {
        ...createFreshSessionFromDraftSegments([freshSegment]),
        ttsAssetId: 123,
      },
    );

    expect(refreshedDraft.segments[0]).toMatchObject({
      duration: 10,
      durationMode: "manual",
      endTime: 10,
      manualDurationSeconds: 10,
      speechDuration: 4,
      speechDurationSource: "audio",
      speechEndTime: 4,
      speechStartTime: 0,
      startTime: 0,
    });
  });

  it("adopts fresh server timing when the live draft still matches its baseline", () => {
    const baselineSegments = [
      createDraftSegment({
        duration: 4.1,
        durationMode: "manual",
        endTime: 4.1,
        index: 0,
        manualDurationSeconds: 4.1,
        startTime: 0,
        text: "First",
      }),
      createDraftSegment({
        duration: 4,
        durationMode: "manual",
        endTime: 8.1,
        index: 1,
        manualDurationSeconds: 4,
        startTime: 4.1,
        text: "Second",
      }),
    ];
    const freshSegments = [
      createDraftSegment({
        duration: 3.932,
        durationMode: "manual",
        endTime: 3.932,
        index: 0,
        manualDurationSeconds: 3.932,
        startTime: 0,
        text: "First",
      }),
      createDraftSegment({
        duration: 4.591,
        durationMode: "manual",
        endTime: 8.523,
        index: 1,
        manualDurationSeconds: 4.591,
        startTime: 3.932,
        text: "Second",
      }),
    ];

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      {
        ...createDraftSession(baselineSegments[0]!),
        segments: baselineSegments,
      },
      createFreshSessionFromDraftSegments(freshSegments),
      {
        baselineSession: createFreshSessionFromDraftSegments(baselineSegments),
      },
    );

    expect(refreshedDraft.segments[0]).toMatchObject({
      duration: 3.932,
      durationMode: "manual",
      endTime: 3.932,
      manualDurationSeconds: 3.932,
      startTime: 0,
    });
    expect(refreshedDraft.segments[1]).toMatchObject({
      duration: 4.591,
      durationMode: "manual",
      endTime: 8.523,
      manualDurationSeconds: 4.591,
      startTime: 3.932,
    });
  });

  it("preserves a user-edited manual duration when fresh server timing changes", () => {
    const baselineSegment = createDraftSegment({
      duration: 4,
      durationMode: "manual",
      endTime: 4,
      index: 0,
      manualDurationSeconds: 4,
      startTime: 0,
      text: "Manual segment",
    });
    const liveSegment = createDraftSegment({
      duration: 6.5,
      durationMode: "manual",
      endTime: 6.5,
      index: 0,
      manualDurationSeconds: 6.5,
      startTime: 0,
      text: "Manual segment",
    });
    const freshSegment = createDraftSegment({
      duration: 5,
      durationMode: "manual",
      endTime: 5,
      index: 0,
      manualDurationSeconds: 5,
      startTime: 0,
      text: "Manual segment",
    });

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      createDraftSession(liveSegment),
      createFreshSession(freshSegment),
      {
        baselineSession: createFreshSession(baselineSegment),
      },
    );

    expect(refreshedDraft.segments[0]).toMatchObject({
      duration: 6.5,
      durationMode: "manual",
      endTime: 6.5,
      manualDurationSeconds: 6.5,
      startTime: 0,
    });
  });

  it("formats adjacent fractional segment ranges with a shared displayed boundary", () => {
    expect(formatWorkspaceSegmentEditorSegmentTimeRange(0, 6.5, { isFirstSegment: true })).toBe("00:00 - 00:06.5");
    expect(formatWorkspaceSegmentEditorSegmentTimeRange(6.5, 15, { isFirstSegment: false })).toBe("00:06.5 - 00:15");
    expect(formatWorkspaceSegmentEditorSegmentTimeRange(0, 6.38, { isFirstSegment: true })).toBe("00:00 - 00:06.4");
  });

  it("formats segment duration labels from the same displayed boundaries as the ruler", () => {
    expect(formatWorkspaceSegmentEditorSegmentDurationLabel(0, 2.4, "ru", { isFirstSegment: true })).toBe("2.4 с");
    expect(formatWorkspaceSegmentEditorSegmentDurationLabel(2.4, 4.6, "ru", { isFirstSegment: false })).toBe("2.2 с");
    expect(formatWorkspaceSegmentEditorSegmentDurationLabel(0, 2.4, "en", { isFirstSegment: true })).toBe("2.4s");
    expect(formatWorkspaceSegmentEditorSegmentDurationLabel(0, 3.2, "ru")).toBe("3.2 с");
    expect(formatWorkspaceSegmentEditorSegmentDurationLabel(0, 6.38, "ru")).toBe("6.4 с");
  });

  it("detects generated video shorter than scene voiceover", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 5,
        fileName: "segment-ai-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-ai-video/jobs/job/video",
      },
      duration: 6.5,
      endTime: 6.5,
      mediaType: "photo",
      speechDuration: 6.5,
      videoAction: "ai",
    });

    expect(getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, createDraftSession(segment))).toEqual({
      visualDurationSeconds: 5,
      voiceoverDurationSeconds: 6.5,
      voiceoverDurationSource: "actual",
    });
  });

  it("does not warn when generated video covers the voiceover", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 7,
        fileName: "segment-ai-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-ai-video/jobs/job/video",
      },
      duration: 6.5,
      endTime: 6.5,
      mediaType: "photo",
      speechDuration: 6.5,
      videoAction: "ai",
    });

    expect(getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, createDraftSession(segment))).toBeNull();
  });

  it("can suppress estimated video and voiceover mismatch until voiceover timings are known", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 5,
        fileName: "segment-ai-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-ai-video/jobs/job/video",
      },
      duration: 5,
      endTime: 5,
      mediaType: "photo",
      text: "Раз два три четыре пять шесть семь восемь девять десять одиннадцать двенадцать тринадцать четырнадцать пятнадцать шестнадцать",
      videoAction: "ai",
    });

    expect(getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, createDraftSession(segment))).toEqual(
      expect.objectContaining({
        visualDurationSeconds: 5,
        voiceoverDurationSource: "estimated",
      }),
    );
    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, createDraftSession(segment), {
        allowEstimatedVoiceover: false,
      }),
    ).toBeNull();
  });

  it("shows a visual warning when estimated punctuated voiceover is longer than the video", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 5,
        fileName: "segment-ai-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-ai-video/jobs/job/video",
      },
      duration: 5,
      endTime: 5,
      mediaType: "photo",
      text: "Вы когда-нибудь задумывались, что было бы, если бы динозавры не вымерли, а продолжили жить рядом с нами сегодня?",
      videoAction: "ai",
    });

    expect(
      resolveWorkspaceSegmentTimelineVisualAudioMismatchInfo(segment, createDraftSession(segment), {
        includeAnyVideoVisual: true,
      }),
    ).toEqual(
      expect.objectContaining({
        visualDurationSeconds: 5,
        voiceoverDurationSource: "estimated",
      }),
    );
  });

  it("detects generated video shorter than voiceover from measured metadata", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        fileName: "segment-ai-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-ai-video/jobs/job/video",
      },
      duration: 6.5,
      endTime: 6.5,
      mediaType: "photo",
      speechDuration: 6.5,
      videoAction: "ai",
    });

    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, createDraftSession(segment), {
        visualDurationSeconds: 5,
      }),
    ).toEqual({
      visualDurationSeconds: 5,
      voiceoverDurationSeconds: 6.5,
      voiceoverDurationSource: "actual",
    });
  });

  it("detects persisted AI-generated video shorter than voiceover from measured metadata", () => {
    const segment = createDraftSegment({
      currentAsset: createMediaAsset(3429, {
        mediaType: "video",
        role: "segment_current",
        sourceKind: "ai_generated",
      }),
      currentSourceKind: "ai_generated",
      duration: 6.5,
      endTime: 6.5,
      mediaType: "video",
      speechDuration: 6.5,
      videoAction: "original",
    });

    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, createDraftSession(segment), {
        visualDurationSeconds: 5,
      }),
    ).toEqual({
      visualDurationSeconds: 5,
      voiceoverDurationSeconds: 6.5,
      voiceoverDurationSource: "actual",
    });
  });

  it("can warn on the visual track when any video visual is shorter than voiceover", () => {
    const segment = createDraftSegment({
      customVideo: {
        durationSeconds: 5,
        fileName: "custom-clip.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/505/playback",
      },
      duration: 5,
      endTime: 5,
      mediaType: "video",
      speechDuration: 6.5,
      videoAction: "custom",
    });

    expect(getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, createDraftSession(segment))).toBeNull();
    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, createDraftSession(segment), {
        includeAnyVideoVisual: true,
      }),
    ).toEqual({
      visualDurationSeconds: 5,
      voiceoverDurationSeconds: 6.5,
      voiceoverDurationSource: "actual",
    });
  });

  it("does not warn when a talking character clip is shorter than its manual scene slot", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 2.9,
        fileName: "segment-talking-photo.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-talking-photo/jobs/job/video",
      },
      aiVideoGeneratedMode: "talking_photo",
      duration: 5,
      durationMode: "manual",
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "video",
      speechDuration: 5,
      text: "Попробуйте, это очень вкусно!",
      videoAction: "talking_photo",
    });

    expect(
      resolveWorkspaceSegmentTimelineVisualAudioMismatchInfo(segment, createDraftSession(segment), {
        includeAnyVideoVisual: true,
        visualDurationSeconds: 2.9,
      }),
    ).toBeNull();
  });

  it("keeps the video visual duration when voiceover stretches the scene duration", () => {
    const segment = createDraftSegment({
      currentAsset: createMediaAsset(505, {
        mediaType: "video",
        sourceKind: "ai_generated",
      }),
      currentSourceKind: "ai_generated",
      duration: 7,
      durationExtensionSourceDurationSeconds: 6.5,
      endTime: 7,
      mediaType: "video",
      speechDuration: 6.8,
      videoAction: "original",
    });

    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, createDraftSession(segment), {
        includeAnyVideoVisual: true,
      }),
    ).toEqual({
      visualDurationSeconds: 6.5,
      voiceoverDurationSeconds: 6.8,
      voiceoverDurationSource: "actual",
    });
  });

  it("uses the baseline video duration for the visual badge when voiceover loops the scene", () => {
    const videoAsset = createMediaAsset(505, {
      mediaType: "video",
      sourceKind: "ai_generated",
    });
    const baselineSegment = createDraftSegment({
      currentAsset: videoAsset,
      currentSourceKind: "ai_generated",
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      endTime: 5,
      mediaType: "video",
      videoAction: "original",
    });
    const stretchedSegment = createDraftSegment({
      currentAsset: videoAsset,
      currentSourceKind: "ai_generated",
      duration: 12.4,
      endTime: 12.4,
      mediaType: "video",
      speechDuration: 12.4,
      videoAction: "original",
    });

    expect(getWorkspaceSegmentVideoVisualDurationSeconds(stretchedSegment, {
      baselineSegment,
      session: createDraftSession(stretchedSegment),
    })).toBe(5);
    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(stretchedSegment, createDraftSession(stretchedSegment), {
        baselineSegment,
        includeAnyVideoVisual: true,
      }),
    ).toEqual({
      visualDurationSeconds: 5,
      voiceoverDurationSeconds: 12.4,
      voiceoverDurationSource: "actual",
    });
  });

  it("shows the video duration in the visual badge instead of the looped scene duration", () => {
    const segment = createDraftSegment({
      currentPlaybackUrl: "/api/workspace/media-assets/505/playback",
      currentSourceKind: "upload",
      duration: 5.9,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 5.9,
      manualDurationSeconds: 5.9,
      mediaType: "video",
      videoAction: "custom",
    });

    expect(getWorkspaceSegmentVideoVisualDurationSeconds(segment, {
      measuredVisualDurationSeconds: 5,
      session: createDraftSession(segment),
    })).toBe(5.9);
    expect(getWorkspaceSegmentVideoVisualSourceDurationSeconds(segment, {
      measuredVisualDurationSeconds: 5,
    })).toBe(5);
    expect(
      resolveWorkspaceSegmentTimelineVisualDurationDisplay({
        isImageDurationSegment: false,
        locale: "ru",
        segmentSlotDurationSeconds: 5.9,
        videoVisualDurationSeconds: 5,
      }),
    ).toEqual({
      badgeLabel: "5 сек",
      durationLabel: "5 с",
    });

    expect(
      resolveWorkspaceSegmentTimelineVisualDurationDisplay({
        isImageDurationSegment: true,
        locale: "ru",
        segmentSlotDurationSeconds: 5.9,
        videoVisualDurationSeconds: 5,
      }).badgeLabel,
    ).toBe("5.9 сек");
  });

  it("does not show the scene slot duration as the video duration before metadata is known", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        fileName: "segment-animation.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-photo-animation/jobs/test-job-505/video",
      },
      aiVideoGeneratedMode: "photo_animation",
      duration: 4,
      endTime: 4,
      mediaType: "video",
      speechDuration: 6.2,
      videoAction: "photo_animation",
    });

    expect(getWorkspaceSegmentVideoVisualDurationSeconds(segment, {
      session: createDraftSession(segment),
    })).toBeNull();
    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, createDraftSession(segment), {
        includeAnyVideoVisual: true,
      }),
    ).toBeNull();
  });

  it("warns on the visual timeline when a generated animation is shorter than a known voiceover asset", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        assetId: 505,
        durationSeconds: 5,
        fileName: "segment-animation.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-photo-animation/jobs/test-job-505/video",
      },
      aiVideoGeneratedMode: "photo_animation",
      currentSourceKind: "ai_generated",
      duration: 7.5,
      endTime: 7.5,
      mediaType: "video",
      originalText: "Вы когда-нибудь задумывались, что было бы, если бы динозавры не вымерли?",
      originalTextByLanguage: { ru: "Вы когда-нибудь задумывались, что было бы, если бы динозавры не вымерли?" },
      text: "Вы когда-нибудь задумывались, что было бы, если бы динозавры не вымерли?",
      textByLanguage: { ru: "Вы когда-нибудь задумывались, что было бы, если бы динозавры не вымерли?" },
      videoAction: "photo_animation",
      voiceoverAsset: {
        assetId: 777,
        durationSeconds: 7.5,
        fileName: "segment-voiceover.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/777/playback",
      },
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });

    expect(
      resolveWorkspaceSegmentTimelineVisualAudioMismatchInfo(segment, createDraftSession(segment), {
        includeAnyVideoVisual: true,
        visualDurationSeconds: 5,
      }),
    ).toEqual({
      visualDurationSeconds: 5,
      voiceoverDurationSeconds: 7.5,
      voiceoverDurationSource: "actual",
    });
  });

  it("measures video visual duration from the raw asset instead of the looped segment preview", () => {
    const segment = createDraftSegment({
      currentExternalPlaybackUrl: "/api/workspace/media-assets/505/playback",
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=3&source=current&delivery=playback",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=3&source=current&delivery=preview",
      currentSourceKind: "ai_generated",
      duration: 6.5,
      endTime: 6.5,
      mediaType: "video",
      videoAction: "original",
    });

    expect(getWorkspaceSegmentDraftVideoUrl(segment)).toBe(segment.currentPlaybackUrl);
    expect(getWorkspaceSegmentVisualDurationMeasurementUrl(segment)).toBe("/api/workspace/media-assets/505/playback");
  });

  it("persists premium AI photo drafts with durable asset routes instead of data urls", () => {
    const largeDataUrl = `data:image/png;base64,${"a".repeat(900_000)}`;
    const segment = createDraftSegment({
      aiPhotoAsset: {
        assetId: 303,
        dataUrl: largeDataUrl,
        fileName: "premium-ai-photo.png",
        fileSize: 700_000,
        mimeType: "image/png",
      },
      aiPhotoGeneratedFromPrompt: "icy mountain dragon",
      aiPhotoPrompt: "icy mountain dragon",
      aiPhotoPromptInitialized: true,
      videoAction: "ai_photo",
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession(createDraftSession(segment));
    const normalizedSegment = normalized.segments[0];
    const asset = normalizedSegment?.aiPhotoAsset;

    expect(asset?.assetId).toBe(303);
    expect(asset?.dataUrl).toBeUndefined();
    expect(asset?.remoteUrl).toBe("/api/workspace/media-assets/303");
    expect(normalizedSegment && getWorkspaceSegmentDraftPreviewUrl(normalizedSegment)).toBe("/api/workspace/media-assets/303");
    expect(JSON.stringify(normalized)).not.toContain("data:image/png");
  });

  it("persists uploaded custom video drafts with a durable playback route", () => {
    const largeDataUrl = `data:video/mp4;base64,${"a".repeat(900_000)}`;
    const segment = createDraftSegment({
      customVideo: {
        assetId: 404,
        dataUrl: largeDataUrl,
        durationSeconds: 5,
        fileName: "uploaded-scene.mp4",
        fileSize: 700_000,
        mimeType: "video/mp4",
        objectUrl: "blob:http://localhost/uploaded-scene",
        remoteUrl: "blob:http://localhost/uploaded-scene",
        source: "upload",
      },
      mediaType: "video",
      videoAction: "custom",
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession(createDraftSession(segment));
    const normalizedSegment = normalized.segments[0];
    const asset = normalizedSegment?.customVideo;

    expect(asset?.assetId).toBe(404);
    expect(asset?.dataUrl).toBeUndefined();
    expect(asset?.objectUrl).toBeUndefined();
    expect(asset?.remoteUrl).toBe("/api/workspace/media-assets/404/playback");
    expect(normalizedSegment && getWorkspaceSegmentDraftVideoUrl(normalizedSegment)).toBe("/api/workspace/media-assets/404/playback");
    expect(JSON.stringify(normalized)).not.toContain("blob:http://localhost/uploaded-scene");
    expect(JSON.stringify(normalized)).not.toContain("data:video/mp4");
  });

  it("preserves manual duration in stored drafts and rebuilds the draft timeline", () => {
    const firstSegment = createDraftSegment({
      duration: 4,
      durationMode: "manual",
      endTime: 4,
      index: 0,
      manualDurationSeconds: 6.5,
      startTime: 0,
      text: "Manual segment",
    });
    const secondSegment = createDraftSegment({
      duration: 4,
      endTime: 8,
      index: 1,
      startTime: 4,
      text: "Auto segment",
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession({
      ...createDraftSession(firstSegment),
      segments: [firstSegment, secondSegment],
    });

    expect(normalized.segments[0]?.durationMode).toBe("manual");
    expect(normalized.segments[0]?.manualDurationSeconds).toBe(6.5);
    expect(normalized.segments[0]?.duration).toBe(6.5);
    expect(normalized.segments[0]?.endTime).toBe(6.5);
    expect(normalized.segments[1]?.startTime).toBe(6.5);
  });

  it("uses cinematic hold when a manual video segment is longer than its source visual", () => {
    const baselineSegment = createDraftSegment({
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=0",
      currentPosterUrl: "/api/workspace/project-segment-poster?projectId=77&segmentIndex=0",
      duration: 3.2,
      endTime: 3.2,
      mediaType: "video",
    });
    const extendedSegment = createDraftSegment({
      ...baselineSegment,
      duration: 5,
      durationMode: "manual",
      endTime: 5,
      manualDurationSeconds: 5,
    });

    expect(getWorkspaceSegmentDurationExtensionPlan(extendedSegment, baselineSegment)).toMatchObject({
      canRequestAiExtension: true,
      extraDurationSeconds: 1.8,
      mode: "cinematic_hold",
      slotDurationSeconds: 5,
      sourceDurationSeconds: 3.2,
    });
  });

  it("keeps cinematic hold visible after a manual timeline rebuild stores the original visual length", () => {
    const segment = createDraftSegment({
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=0",
      currentPosterUrl: "/api/workspace/project-segment-poster?projectId=77&segmentIndex=0",
      duration: 50,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      endTime: 50,
      manualDurationSeconds: 50,
      mediaType: "video",
    });

    expect(getWorkspaceSegmentDurationExtensionPlan(segment)).toMatchObject({
      canRequestAiExtension: true,
      extraDurationSeconds: 45,
      mode: "cinematic_hold",
      slotDurationSeconds: 50,
      sourceDurationSeconds: 5,
    });
  });

  it("uses the measured visual duration when opening AI extension from a timeline badge", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 4,
        fileName: "segment.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-photo-animation/jobs/job/video",
      },
      duration: 10,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 10,
      manualDurationSeconds: 10,
      mediaType: "photo",
      videoAction: "photo_animation",
    });

    expect(getWorkspaceSegmentDurationExtensionPlan(segment, null, { sourceDurationSeconds: 5 })).toMatchObject({
      extraDurationSeconds: 5,
      mode: "cinematic_hold",
      slotDurationSeconds: 10,
      sourceDurationSeconds: 5,
    });
    expect(
      resolveWorkspaceSegmentAiDurationExtensionTargetSeconds(segment, null, 5, {
        extensionStepSeconds: 5,
        sourceDurationSeconds: 5,
      }),
    ).toBe(10);
  });

  it("shows video extension tools only when a video visual has an extendable frame source", () => {
    expect(
      canWorkspaceSegmentUseVideoExtensionTool(createDraftSegment({
        mediaType: "video",
        videoAction: "original",
      })),
    ).toBe(false);
    expect(
      canWorkspaceSegmentUseVideoExtensionTool(createDraftSegment({
        currentPosterUrl: "/api/workspace/media-assets/101/poster",
        mediaType: "video",
        videoAction: "original",
      })),
    ).toBe(true);
    expect(
      canWorkspaceSegmentUseVideoExtensionTool(createDraftSegment({
        aiVideoGeneratedMode: "photo_animation",
        mediaType: "video",
        photoAnimationSourceAsset: {
          fileName: "source-frame.jpg",
          fileSize: 0,
          mimeType: "image/jpeg",
          remoteUrl: "/api/workspace/media-assets/102/source-frame",
          source: "media-library",
        },
        videoAction: "photo_animation",
      })),
    ).toBe(true);
    expect(
      canWorkspaceSegmentUseVideoExtensionTool(createDraftSegment({
        mediaType: "photo",
        videoAction: "original",
      })),
    ).toBe(false);
  });

  it("shows cinematic hold for still-preview segments extended beyond their baseline slot", () => {
    const baselineSegment = createDraftSegment({
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=0&delivery=preview",
      duration: 5,
      endTime: 5,
      mediaType: "photo",
    });
    const segment = createDraftSegment({
      ...baselineSegment,
      duration: 50,
      durationMode: "manual",
      endTime: 50,
      manualDurationSeconds: 50,
    });

    expect(getWorkspaceSegmentDurationExtensionPlan(segment, baselineSegment)).toMatchObject({
      canRequestAiExtension: true,
      extraDurationSeconds: 45,
      mode: "cinematic_hold",
      slotDurationSeconds: 50,
      sourceDurationSeconds: 5,
    });
  });

  it("does not keep cinematic hold after a generated video already matches the extended slot", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 50,
        fileName: "extended-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/media/extended-scene.mp4",
      },
      aiVideoGeneratedMode: "photo_animation",
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=0",
      currentPosterUrl: "/api/workspace/project-segment-poster?projectId=77&segmentIndex=0",
      duration: 50,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      endTime: 50,
      manualDurationSeconds: 50,
      mediaType: "video",
      videoAction: "photo_animation",
    });

    expect(getWorkspaceSegmentDurationExtensionPlan(segment)).toBeNull();
  });

  it("ignores stale extension source duration from a failed AI extension on an original video", () => {
    const baselineSegment = createDraftSegment({
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=0",
      currentPosterUrl: "/api/workspace/project-segment-poster?projectId=77&segmentIndex=0",
      duration: 5,
      endTime: 5,
      mediaType: "video",
    });
    const segment = createDraftSegment({
      ...baselineSegment,
      duration: 10,
      durationExtensionSourceDurationSeconds: 10,
      durationMode: "manual",
      endTime: 10,
      manualDurationSeconds: 10,
      videoAction: "original",
    });

    expect(getWorkspaceSegmentDurationExtensionPlan(segment, baselineSegment)).toMatchObject({
      canRequestAiExtension: true,
      extraDurationSeconds: 5,
      mode: "cinematic_hold",
      slotDurationSeconds: 10,
      sourceDurationSeconds: 5,
    });
  });

  it("does not show a duration extension plan when a segment stays within source length", () => {
    const baselineSegment = createDraftSegment({
      duration: 4,
      endTime: 4,
      mediaType: "video",
    });
    const segment = createDraftSegment({
      ...baselineSegment,
      duration: 4,
      durationMode: "manual",
      endTime: 4,
      manualDurationSeconds: 4,
    });

    expect(getWorkspaceSegmentDurationExtensionPlan(segment, baselineSegment)).toBeNull();
  });

  it("recommends duration from voiceover only when it is longer than the video", () => {
    const longVoiceSegment = createDraftSegment({
      duration: 5,
      endTime: 5,
      mediaType: "video",
      speechDuration: 8,
    });
    const shortVoiceSegment = createDraftSegment({
      duration: 5,
      endTime: 5,
      mediaType: "video",
      speechDuration: 3,
    });
    const soundOnlySegment = createDraftSegment({
      duration: 5,
      endTime: 5,
      mediaType: "video",
      sceneSoundAsset: {
        durationSeconds: 9,
        fileName: "scene-sound.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/media/scene-sound.wav",
      },
    });

    expect(getWorkspaceSegmentRecommendedDurationSeconds(longVoiceSegment, createDraftSession(longVoiceSegment))).toBe(8);
    expect(getWorkspaceSegmentRecommendedDurationSeconds(shortVoiceSegment, createDraftSession(shortVoiceSegment))).toBe(5);
    expect(getWorkspaceSegmentRecommendedDurationSeconds(soundOnlySegment, createDraftSession(soundOnlySegment))).toBe(5);
    expect(getWorkspaceSegmentSceneSoundDurationSeconds(soundOnlySegment)).toBe(9);
  });

  it("builds voiceover preview range from full project TTS with a small safety tail", () => {
    const segment = createDraftSegment({
      duration: 5,
      endTime: 5,
      speechEndTime: 4.8,
      speechStartTime: 0.4,
      startTime: 0,
    });

    expect(getWorkspaceSegmentVoiceoverPreviewRange(segment, createDraftSession(segment))).toEqual({
      endTime: 5.25,
      startTime: 0.32,
    });
  });

  it("builds voiceover preview range from speech duration when speech end is missing", () => {
    const segment = createDraftSegment({
      duration: 5,
      endTime: undefined,
      speechDuration: 4.6,
      speechEndTime: null,
      speechStartTime: 5.2,
      startTime: 5.2,
    });

    expect(getWorkspaceSegmentVoiceoverPreviewRange(segment, createDraftSession(segment))).toEqual({
      endTime: 10.25,
      startTime: 5.12,
    });
  });

  it("uses ASR word timings before stale segment speech boundaries for project voiceover ranges", () => {
    const segment = createDraftSegment({
      duration: 4.72,
      endTime: 15.04,
      speechDuration: 4.39,
      speechEndTime: 14.016,
      speechStartTime: 9.624,
      speechWords: [
        { confidence: 0.95, endTime: 10.82, startTime: 10.32, text: "Оказалось," },
        { confidence: 0.74, endTime: 14.52, startTime: 14.02, text: "соседям." },
      ],
      startTime: 10.32,
      text: "Оказалось, этот пушистый аферист ежедневно пробирается через дыру в заборе к соседям.",
    });

    expect(getWorkspaceSegmentVoiceoverDurationSeconds(segment, createDraftSession(segment))).toBe(4.2);
    expect(getWorkspaceSegmentVoiceoverPreviewRange(segment, createDraftSession(segment))).toEqual({
      endTime: 14.97,
      startTime: 10.24,
    });
  });

  it("keeps full-preview project voiceover on the timeline clock while source timings still match", () => {
    const segment = createDraftSegment({
      duration: 5.7,
      endTime: 9.92,
      index: 1,
      speechDuration: 5.44,
      speechEndTime: 9.86,
      speechStartTime: 4.42,
      speechWords: [{ confidence: 1, endTime: 9.86, startTime: 4.42, text: "Second" }],
      startTime: 4.22,
      text: "Second",
    });
    const previewRange = getWorkspaceSegmentVoiceoverPreviewRange(segment, createDraftSession(segment));

    expect(previewRange).toEqual({
      endTime: 10.31,
      startTime: 4.34,
    });
    expect(
      resolveWorkspaceSegmentProjectVoiceoverFullPreviewAudioRange({
        previewRange,
        segment,
        timelineEndTime: 9.92,
        timelineStartTime: 4.22,
      }),
    ).toEqual({
      sourceStartTime: 4.22,
      timelineEndTime: 9.86,
    });
  });

  it("maps shifted full-preview project voiceover back to the original speech source range", () => {
    const segment = createDraftSegment({
      duration: 5.9,
      endTime: 11.1,
      index: 1,
      speechDuration: 5.44,
      speechEndTime: 10.64,
      speechStartTime: 5.2,
      speechWords: [{ confidence: 1, endTime: 9.86, startTime: 4.42, text: "Second" }],
      startTime: 5.2,
      text: "Second",
    });
    const previewRange = getWorkspaceSegmentVoiceoverPreviewRange(segment, createDraftSession(segment));

    expect(previewRange).toEqual({
      endTime: 10.31,
      startTime: 4.34,
    });
    expect(
      resolveWorkspaceSegmentProjectVoiceoverFullPreviewAudioRange({
        previewRange,
        segment,
        timelineEndTime: 11.1,
        timelineStartTime: 5.2,
      }),
    ).toEqual({
      sourceStartTime: 4.42,
      timelineEndTime: 10.64,
    });
  });

  it("does not stretch full-preview project voiceover audio to a longer manual visual slot", () => {
    const segment = createDraftSegment({
      duration: 10,
      durationMode: "manual",
      endTime: 10,
      index: 0,
      manualDurationSeconds: 10,
      speechDuration: 5,
      speechEndTime: 5,
      speechStartTime: 0,
      startTime: 0,
      text: "First",
    });
    const previewRange = getWorkspaceSegmentVoiceoverPreviewRange(segment, createDraftSession(segment));

    expect(previewRange).toEqual({
      endTime: 5.45,
      startTime: 0,
    });
    expect(
      resolveWorkspaceSegmentProjectVoiceoverFullPreviewAudioRange({
        previewRange,
        segment,
        timelineEndTime: 10,
        timelineStartTime: 0,
      }),
    ).toEqual({
      sourceStartTime: 0,
      timelineEndTime: 5,
    });
  });

  it("uses exact project voice source window before stale visible speech boundaries", () => {
    const segment = createDraftSegment({
      duration: 5,
      durationMode: "manual",
      endTime: 18.6,
      index: 1,
      manualDurationSeconds: 5,
      speechDuration: 5,
      speechEndTime: 18.6,
      speechStartTime: 13.6,
      startTime: 13.6,
      text: "Second",
      voiceSourceEndTime: 16.12,
      voiceSourceStartTime: 13.04,
    });
    const previewRange = getWorkspaceSegmentVoiceoverPreviewRange(segment, createDraftSession(segment));

    expect(getWorkspaceSegmentVoiceoverDurationSeconds(segment, createDraftSession(segment))).toBe(3.08);
    expect(previewRange).toEqual({
      endTime: 16.12,
      startTime: 13.04,
    });
    expect(
      resolveWorkspaceSegmentProjectVoiceoverFullPreviewAudioRange({
        previewRange,
        segment,
        timelineEndTime: 18.6,
        timelineStartTime: 13.6,
      }),
    ).toEqual({
      sourceStartTime: 13.04,
      timelineEndTime: 16.68,
    });
  });

  it("keeps exact project voice source window even when visual drift is small", () => {
    const segment = createDraftSegment({
      duration: 6.71,
      endTime: 17.72,
      index: 2,
      speechDuration: 6.88,
      speechEndTime: 18.06,
      speechStartTime: 11.18,
      startTime: 11.01,
      text: "Third",
      voiceSourceEndTime: 18.06,
      voiceSourceStartTime: 11.18,
    });
    const previewRange = getWorkspaceSegmentVoiceoverPreviewRange(segment, createDraftSession(segment));

    expect(previewRange).toEqual({
      endTime: 18.06,
      startTime: 11.18,
    });
    expect(
      resolveWorkspaceSegmentProjectVoiceoverFullPreviewAudioRange({
        previewRange,
        segment,
        timelineEndTime: 17.72,
        timelineStartTime: 11.01,
      }),
    ).toEqual({
      sourceStartTime: 11.18,
      timelineEndTime: 17.89,
    });
  });

  it("normalizes project voice source aliases from fresh segment refreshes", () => {
    const segment = createDraftSegment({
      duration: 5,
      endTime: 18.6,
      index: 1,
      startTime: 13.6,
      text: "Second",
    });
    const freshSession = createFreshSession(segment);
    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      createDraftSession(segment),
      {
        ...freshSession,
        segments: [
          {
            ...freshSession.segments[0]!,
            voice_source_end_time: 16.12,
            voice_source_start_time: 13.04,
          },
        ],
      },
    );

    expect(refreshedDraft.segments[0]).toMatchObject({
      voiceSourceDuration: 3.08,
      voiceSourceEndTime: 16.12,
      voiceSourceStartTime: 13.04,
    });
  });

  it("uses the scene voiceover proxy in full preview after a prior non-project voiceover", () => {
    const segment = createDraftSegment({
      index: 1,
      speechDuration: 5.44,
      speechEndTime: 11.1,
      speechStartTime: 5.2,
      startTime: 5.2,
      text: "Second",
    });

    expect(
      shouldUseWorkspaceSegmentProjectVoiceoverSegmentProxyInFullPreview(segment, createDraftSession(segment), {
        hasPriorNonProjectVoiceover: true,
      }),
    ).toBe(true);
  });

  it("uses segment voiceover proxy in full preview when a manual visual slot creates a voice pause", () => {
    const segment = createDraftSegment({
      duration: 10,
      durationMode: "manual",
      endTime: 10,
      index: 0,
      manualDurationSeconds: 10,
      speechDuration: 2.8,
      speechEndTime: 2.8,
      speechStartTime: 0,
      startTime: 0,
      text: "First",
    });
    const previewRange = getWorkspaceSegmentVoiceoverPreviewRange(segment, createDraftSession(segment));

    expect(previewRange).toEqual({
      endTime: 3.25,
      startTime: 0,
    });
    expect(
      shouldUseWorkspaceSegmentProjectVoiceoverSegmentProxyInFullPreview(segment, createDraftSession(segment), {
        previewRange,
        timelineEndTime: 10,
        timelineStartTime: 0,
      }),
    ).toBe(true);
  });

  it("uses segment voiceover proxy when a manual voice pause has a project TTS asset", () => {
    const segment = createDraftSegment({
      duration: 10,
      durationMode: "manual",
      endTime: 10,
      index: 0,
      manualDurationSeconds: 10,
      speechDuration: 2.8,
      speechEndTime: 2.8,
      speechStartTime: 0,
      startTime: 0,
      text: "First",
    });
    const previewRange = getWorkspaceSegmentVoiceoverPreviewRange(segment, createDraftSession(segment));

    expect(
      shouldUseWorkspaceSegmentProjectVoiceoverSegmentProxyInFullPreview(segment, createDraftSession(segment), {
        hasProjectVoiceoverAsset: true,
        previewRange,
        timelineEndTime: 10,
        timelineStartTime: 0,
      }),
    ).toBe(true);
  });

  it("uses segment voiceover proxy in full preview when a prior manual scene shifts the project voice source", () => {
    const segment = createDraftSegment({
      duration: 3.5,
      endTime: 13.5,
      index: 1,
      speechDuration: 3.5,
      speechEndTime: 6.3,
      speechStartTime: 2.8,
      speechWords: [{ confidence: 1, endTime: 6.3, startTime: 2.8, text: "Second" }],
      startTime: 10,
      text: "Second",
    });
    const previewRange = getWorkspaceSegmentVoiceoverPreviewRange(segment, createDraftSession(segment));

    expect(previewRange).toEqual({
      endTime: 6.75,
      startTime: 2.72,
    });
    expect(
      shouldUseWorkspaceSegmentProjectVoiceoverSegmentProxyInFullPreview(segment, createDraftSession(segment), {
        previewRange,
        timelineEndTime: 13.5,
        timelineStartTime: 10,
      }),
    ).toBe(true);
  });

  it("uses segment voiceover proxy in full preview when a scene voice override differs from the project voice", () => {
    const segment = createDraftSegment({
      index: 0,
      text: "First",
      voiceType: "gleb",
    });
    const session = {
      ...createDraftSession(segment),
      voiceType: "boris",
    };

    expect(shouldUseWorkspaceSegmentProjectVoiceoverSegmentProxyInFullPreview(segment, session)).toBe(true);
  });

  it("uses segment voiceover proxy in full preview when the scene voice still matches the project voice", () => {
    const segment = createDraftSegment({
      index: 0,
      text: "First",
      voiceType: "boris",
    });
    const session = {
      ...createDraftSession(segment),
      voiceType: "boris",
    };

    expect(shouldUseWorkspaceSegmentProjectVoiceoverSegmentProxyInFullPreview(segment, session)).toBe(true);
  });

  it("uses a segment voiceover proxy when a preview explicitly prefers scene-isolated audio", () => {
    const segment = createDraftSegment({
      duration: 4.4,
      endTime: 12.4,
      index: 2,
      speechDuration: 4.36,
      speechEndTime: 12.36,
      speechStartTime: 8,
      startTime: 8,
      text: "Этот древний ящер использует свою мощь, чтобы защитить планету от угроз.",
    });
    const session = {
      ...createDraftSession(segment),
      projectId: 3457,
      ttsAssetId: 3473,
    };

    const source = getWorkspaceSegmentVoiceoverAudioPreviewSource({
      isVoiceAudioStale: false,
      segment,
      session,
      voiceEnabled: true,
      voiceOption: studioVoiceOptionsByLanguage.ru[0],
    });

    expect(source.sourceKind).toBe("project");
    expect(source.audioUrl).toBe(source.projectVoiceoverAudioUrl);
    expect(source.audioUrl).toContain("/api/workspace/media-assets/3473?v=");
    expect(source.segmentVoiceoverAudioUrl).toContain("/api/workspace/project-segment-voiceover?");
    expect(source.projectVoiceoverAudioUrl).toContain("/api/workspace/media-assets/3473?v=");
    expect(source.shouldClip).toBe(true);
    expect(source.previewRange).toEqual({
      endTime: 12.81,
      startTime: 7.92,
    });

    const timelineSource = getWorkspaceSegmentVoiceoverAudioPreviewSource({
      isVoiceAudioStale: false,
      preferSegmentProxy: true,
      segment,
      session,
      voiceEnabled: true,
      voiceOption: studioVoiceOptionsByLanguage.ru[0],
    });

    expect(timelineSource.sourceKind).toBe("segment");
    expect(timelineSource.audioUrl).toBe(timelineSource.segmentVoiceoverAudioUrl);
    expect(timelineSource.audioUrl).toContain("/api/workspace/project-segment-voiceover?");
    expect(timelineSource.segmentVoiceoverAudioUrl).toContain("/api/workspace/project-segment-voiceover?");
    expect(timelineSource.projectVoiceoverAudioUrl).toContain("/api/workspace/media-assets/3473?v=");
    expect(timelineSource.shouldClip).toBe(false);
  });

  it("allows segment voiceover preview from project TTS timing even when the voice option is legacy", () => {
    const text = "Жарьте на хорошо разогретой сковороде.";
    const segment = createDraftSegment({
      duration: 5.3,
      endTime: 38.5,
      index: 6,
      speechDuration: 5.28,
      speechEndTime: 38.48,
      speechStartTime: 33.2,
      startTime: 33.2,
      text,
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: "Tim",
    });
    const session = {
      ...createDraftSession(segment),
      projectId: 3727,
      ttsAssetId: 4946,
      voiceType: "Tim",
    };

    expect(isWorkspaceSegmentVoiceoverPlaybackFresh(segment, session)).toBe(true);

    const source = getWorkspaceSegmentVoiceoverAudioPreviewSource({
      isVoiceAudioStale: !isWorkspaceSegmentVoiceoverPlaybackFresh(segment, session),
      preferSegmentProxy: true,
      segment,
      session,
      voiceEnabled: true,
      voiceOption: null,
    });

    expect(source.sourceKind).toBe("segment");
    expect(source.audioUrl).toContain("/api/workspace/project-segment-voiceover?");
    expect(source.segmentVoiceoverAudioUrl).toContain("projectId=3727");
    expect(source.segmentVoiceoverAudioUrl).toContain("segmentIndex=6");
    expect(source.projectVoiceoverAudioUrl).toContain("/api/workspace/media-assets/4946?v=");
    expect(source.shouldClip).toBe(false);
  });

  it("does not play the full project TTS asset as a scene voiceover without timing", () => {
    const text = "Сегодня покажу вам рецепт очень вкусных блинов.";
    const segment = createDraftSegment({
      duration: 6.2,
      endTime: 6.2,
      index: 0,
      text,
      voiceoverAsset: {
        assetId: 4946,
        fileName: "project-tts.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/4946",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: "Russian_BrightHeroine",
    });
    const session = {
      ...createDraftSession(segment),
      ttsAssetId: 4946,
      voiceType: "Russian_BrightHeroine",
    };

    const source = getWorkspaceSegmentVoiceoverAudioPreviewSource({
      isVoiceAudioStale: !isWorkspaceSegmentVoiceoverPlaybackFresh(segment, session),
      segment,
      session,
      voiceEnabled: true,
      voiceOption: studioVoiceOptionsByLanguage.ru.find((voice) => voice.id === "Russian_BrightHeroine"),
    });

    expect(isWorkspaceSegmentVoiceoverPlaybackFresh(segment, session)).toBe(false);
    expect(source.sourceKind).toBeNull();
    expect(source.audioUrl).toBeNull();
    expect(source.projectVoiceoverAudioUrl).toBeNull();
    expect(source.segmentVoiceoverAudioUrl).toBeNull();
  });

  it("keeps project voiceover in full preview when loaded segments have stale scene voice overrides", () => {
    const text = "На экране появляется новая сцена с проектной озвучкой.";
    const projectVoiceOption = studioVoiceOptionsByLanguage.ru.find((voice) => voice.id === "Bys_24000");
    const buildLoadedDraft = (segment: DraftSegment) =>
      createWorkspaceSegmentEditorDraftSession({
        ...createDraftSession(segment),
        projectId: 3727,
        segments: [segment],
        ttsAssetId: 4946,
        voiceType: "Bys_24000",
      });
    const createLoadedSegment = (overrides: Partial<DraftSegment> = {}) =>
      createDraftSegment({
        duration: 3.2,
        endTime: 3.2,
        speechDuration: 3.239,
        speechDurationSource: "audio",
        speechEndTime: 3.239,
        speechStartTime: 0,
        text,
        textByLanguage: { ru: text },
        voiceType: "Russian_BrightHeroine",
        voiceoverLanguage: "ru",
        voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
        voiceoverVoiceType: "Bys_24000",
        ...overrides,
      });

    for (const loadedDraft of [
      buildLoadedDraft(createLoadedSegment()),
      buildLoadedDraft(createLoadedSegment({ voiceoverAssetId: 4946 })),
    ]) {
      const loadedSegment = loadedDraft.segments[0]!;
      const isVoiceAudioStale = !isWorkspaceSegmentVoiceoverPlaybackFresh(loadedSegment, loadedDraft);
      const source = getWorkspaceSegmentVoiceoverAudioPreviewSource({
        isVoiceAudioStale,
        segment: loadedSegment,
        session: loadedDraft,
        voiceEnabled: true,
        voiceOption: projectVoiceOption,
      });

      expect(getWorkspaceSegmentVoiceOverrideId(loadedSegment)).toBeNull();
      expect(isVoiceAudioStale).toBe(false);
      expect(source.sourceKind).toBe("project");
      expect(source.audioUrl).toContain("/api/workspace/media-assets/4946?v=");
    }
  });

  it("does not build segment voiceover proxy without project voiceover audio", () => {
    const segment = createDraftSegment({
      duration: 4,
      endTime: 14,
      index: 1,
      speechDuration: 4,
      speechEndTime: 14,
      speechStartTime: 10,
      startTime: 10,
      text: "Second",
    });
    const session = {
      ...createDraftSession(segment),
      projectId: 3647,
      ttsAssetId: null,
    };

    const source = getWorkspaceSegmentVoiceoverAudioPreviewSource({
      isVoiceAudioStale: true,
      preferSegmentProxy: true,
      segment,
      session,
      voiceEnabled: true,
      voiceOption: studioVoiceOptionsByLanguage.ru[0],
    });

    expect(source.sourceKind).toBeNull();
    expect(source.audioUrl).toBeNull();
    expect(source.projectVoiceoverAudioUrl).toBeNull();
    expect(source.segmentVoiceoverAudioUrl).toBeNull();
  });

  it("does not build project voiceover audio from scene boundaries without exact timing", () => {
    const segment = createDraftSegment({
      duration: 13.6,
      endTime: 13.6,
      index: 0,
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      startTime: 0,
      text: "Сегодня покажу вам рецепт очень вкусных блинов.",
    });
    const session = {
      ...createDraftSession(segment),
      projectId: 3727,
      ttsAssetId: 4946,
      voiceType: "Bys_24000",
    };

    const source = getWorkspaceSegmentVoiceoverAudioPreviewSource({
      isVoiceAudioStale: false,
      segment,
      session,
      voiceEnabled: true,
      voiceOption: studioVoiceOptionsByLanguage.ru[0],
    });

    expect(source.audioUrl).toBeNull();
    expect(source.sourceKind).toBeNull();
    expect(source.projectVoiceoverAudioUrl).toBeNull();
    expect(source.segmentVoiceoverAudioUrl).toBeNull();
  });

  it("does not play stale project voiceover audio after voice or text changes", () => {
    const segment = createDraftSegment({
      duration: 4,
      endTime: 14,
      index: 1,
      speechDuration: 4,
      speechEndTime: 14,
      speechStartTime: 10,
      startTime: 10,
      text: "Updated scene text",
    });
    const session = {
      ...createDraftSession(segment),
      projectId: 3647,
      ttsAssetId: 3473,
    };

    const source = getWorkspaceSegmentVoiceoverAudioPreviewSource({
      isVoiceAudioStale: true,
      preferSegmentProxy: true,
      segment,
      session,
      voiceEnabled: true,
      voiceOption: studioVoiceOptionsByLanguage.ru[0],
    });

    expect(source.audioUrl).toBeNull();
    expect(source.sourceKind).toBeNull();
    expect(source.projectVoiceoverAudioUrl).toContain("/api/workspace/media-assets/3473?v=");
    expect(source.segmentVoiceoverAudioUrl).toContain("/api/workspace/project-segment-voiceover?");
    expect(source.shouldClip).toBe(false);
  });

  it("keeps voiceover preview source URLs stable when only local timeline timing changes", () => {
    const segment = createDraftSegment({
      duration: 4.4,
      endTime: 12.4,
      index: 2,
      speechDuration: 4.36,
      speechEndTime: 12.36,
      speechStartTime: 8,
      startTime: 8,
      text: "Этот древний ящер использует свою мощь, чтобы защитить планету от угроз.",
    });
    const shiftedSegment = {
      ...segment,
      endTime: 16.4,
      speechEndTime: 16.36,
      speechStartTime: 12,
      startTime: 12,
    };
    const session = {
      ...createDraftSession(segment),
      projectId: 3457,
      segments: [segment],
      ttsAssetId: 3473,
    };
    const shiftedSession = {
      ...session,
      segments: [shiftedSegment],
    };

    const source = getWorkspaceSegmentVoiceoverAudioPreviewSource({
      isVoiceAudioStale: false,
      preferSegmentProxy: true,
      segment,
      session,
      voiceEnabled: true,
      voiceOption: studioVoiceOptionsByLanguage.ru[0],
    });
    const shiftedSource = getWorkspaceSegmentVoiceoverAudioPreviewSource({
      isVoiceAudioStale: false,
      preferSegmentProxy: true,
      segment: shiftedSegment,
      session: shiftedSession,
      voiceEnabled: true,
      voiceOption: studioVoiceOptionsByLanguage.ru[0],
    });

    expect(shiftedSource.version).toBe(source.version);
    expect(shiftedSource.segmentVoiceoverAudioUrl).toBe(source.segmentVoiceoverAudioUrl);
    expect(shiftedSource.previewRange).not.toEqual(source.previewRange);
  });

  it("does not fall back to the segment voiceover proxy when project voiceover is stale", () => {
    const segment = createDraftSegment({
      index: 2,
      speechDuration: 4.36,
      speechEndTime: 12.36,
      speechStartTime: 8,
      startTime: 8,
      text: "Этот древний ящер использует свою мощь, чтобы защитить планету от угроз.",
    });
    const session = {
      ...createDraftSession(segment),
      projectId: 3457,
      ttsAssetId: 3473,
    };

    const source = getWorkspaceSegmentVoiceoverAudioPreviewSource({
      isVoiceAudioStale: true,
      segment,
      session,
      voiceEnabled: true,
      voiceOption: studioVoiceOptionsByLanguage.ru[0],
    });

    expect(source.sourceKind).toBeNull();
    expect(source.audioUrl).toBeNull();
    expect(source.segmentVoiceoverAudioUrl).toContain("/api/workspace/project-segment-voiceover?");
    expect(source.shouldClip).toBe(false);
  });

  it("does not treat scene boundaries as the actual voiceover duration", () => {
    const segment = createDraftSegment({
      duration: 5.2,
      endTime: 5.2,
      speechDuration: null,
      speechEndTime: 5.2,
      speechStartTime: 0,
      startTime: 0,
    });

    expect(getWorkspaceSegmentVoiceoverDurationSeconds(segment, createDraftSession(segment))).toBeNull();
    expect(
      getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, createDraftSession(segment), {
        allowEstimated: false,
      }),
    ).toBeNull();
  });

  it("does not treat a non-audio scene duration echo as the voiceover minimum", () => {
    const segment = createDraftSegment({
      duration: 8,
      durationMode: "manual",
      endTime: 8,
      manualDurationSeconds: 8,
      speechDuration: 8,
      speechDurationSource: null,
      speechEndTime: 8,
      speechStartTime: 0,
      startTime: 0,
    });
    const session = createDraftSession(segment);

    expect(getWorkspaceSegmentVoiceoverDurationSeconds(segment, session)).toBeNull();
    expect(
      getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session, {
        allowEstimated: false,
      }),
    ).toBeNull();

    const resolved = resolveWorkspaceSegmentBoundaryTiming(segment, 4.9, session);

    expect(resolved.status).toBe("valid");
    if (resolved.status === "valid") {
      expect(resolved.clamped).toBe(false);
    }
    expect(resolved.duration).toBeCloseTo(4.9, 6);
    expect(resolved.boundaryTime).toBeCloseTo(4.9, 6);
  });

  it("trusts measured audio duration even when it matches the scene boundary", () => {
    const segment = createDraftSegment({
      duration: 4.104,
      endTime: 4.104,
      speechDuration: 4.104,
      speechDurationSource: "audio",
      speechEndTime: 4.104,
      speechStartTime: 0,
      startTime: 0,
      voiceoverAsset: {
        assetId: 503,
        durationSeconds: 27.4,
        fileName: "project-tts.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/503",
      },
    });
    const session = {
      ...createDraftSession(segment),
      ttsAssetId: 503,
    };

    expect(getWorkspaceSegmentVoiceoverDurationSeconds(segment, session)).toBe(4.104);
    expect(getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session, { allowEstimated: false })).toEqual({
      durationSeconds: 4.104,
      source: "actual",
    });
  });

  it("does not use the full project TTS asset duration as a scene voiceover duration", () => {
    const segment = createDraftSegment({
      duration: 5.2,
      endTime: 5.2,
      speechDuration: null,
      speechEndTime: 5.2,
      speechStartTime: 0,
      startTime: 0,
      text: "Вы когда-нибудь задумывались, что было бы, если бы динозавры не вымерли?",
      voiceoverAsset: {
        assetId: 503,
        durationSeconds: 27.4,
        fileName: "project-tts.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/503",
      },
    });
    const session = {
      ...createDraftSession(segment),
      ttsAssetId: 503,
    };

    expect(getWorkspaceSegmentVoiceoverDurationSeconds(segment, session)).toBeNull();
    expect(
      getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session, {
        allowEstimated: false,
      }),
    ).toBeNull();
    expect(getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session)).toEqual({
      durationSeconds: 5.19,
      source: "estimated",
    });
  });

  it("does not stretch one scene to the full project voiceover duration", () => {
    const segment = createDraftSegment({
      duration: 5.2,
      endTime: 5.2,
      speechDuration: 27.4,
      speechDurationSource: "audio",
      speechEndTime: 27.4,
      speechStartTime: 0,
      startTime: 0,
      text: "Вы когда-нибудь задумывались, что было бы, если бы динозавры не вымерли?",
      voiceoverAsset: {
        assetId: 503,
        durationSeconds: 27.4,
        fileName: "project-tts.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/503",
      },
    });
    const session = {
      ...createDraftSession(segment),
      ttsAssetId: 503,
    };

    expect(getWorkspaceSegmentVoiceoverDurationSeconds(segment, session)).toBeNull();
    expect(getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session)).toEqual({
      durationSeconds: 5.19,
      source: "estimated",
    });
  });

  it("does not use the full project voice source window as one scene voiceover duration", async () => {
    const segment = createDraftSegment({
      duration: 12,
      durationMode: "manual",
      endTime: 12,
      manualDurationSeconds: 12,
      mediaType: "video",
      speechDuration: null,
      speechEndTime: 44.8,
      speechStartTime: 0,
      startTime: 0,
      text: "Попробуйте, это очень вкусно!",
      voiceoverAsset: {
        assetId: 503,
        durationSeconds: 44.8,
        fileName: "project-tts.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/503",
      },
      voiceSourceDuration: 44.8,
      voiceSourceEndTime: 44.8,
      voiceSourceStartTime: 0,
    });
    const session = {
      ...createDraftSession(segment),
      ttsAssetId: 503,
    };

    expect(getWorkspaceSegmentVoiceoverDurationSeconds(segment, session)).toBeNull();
    expect(
      getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session, {
        allowEstimated: false,
      }),
    ).toBeNull();
    expect(
      resolveWorkspaceSegmentTimelineVisualAudioMismatchInfo(segment, session, {
        includeAnyVideoVisual: true,
        visualDurationSeconds: 12,
      }),
    ).toBeNull();

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(session);
    expect(rebuilt.segments[0]).toMatchObject({
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
    });

    const result = await buildWorkspaceSegmentEditorPayload(session, { language: "ru" });
    expect(result.payload.segments[0]?.voiceSourceDuration).toBeUndefined();
    expect(result.payload.segments[0]?.voiceSourceEndTime).toBeUndefined();
    expect(result.payload.segments[0]?.voiceSourceStartTime).toBeUndefined();
  });

  it("uses voiceover plus pause as the photo visual duration floor", () => {
    expect(resolveWorkspaceSegmentPhotoDurationVoiceoverGuard(2.4, 3.2)).toEqual({
      minimumDurationSeconds: 3.4,
      requestedDurationSeconds: 2.4,
    });
    expect(resolveWorkspaceSegmentPhotoDurationVoiceoverGuard(3.15, 3.2)).toEqual({
      minimumDurationSeconds: 3.4,
      requestedDurationSeconds: 3.15,
    });
    expect(resolveWorkspaceSegmentPhotoDurationVoiceoverGuard(2, 3.3)).toEqual({
      minimumDurationSeconds: 3.5,
      requestedDurationSeconds: 2,
    });
    expect(resolveWorkspaceSegmentPhotoDurationVoiceoverGuard(3.2, 3.2)).toEqual({
      minimumDurationSeconds: 3.4,
      requestedDurationSeconds: 3.2,
    });
    expect(resolveWorkspaceSegmentPhotoDurationVoiceoverGuard(3.3995, 3.2)).toBeNull();
    expect(resolveWorkspaceSegmentPhotoDurationVoiceoverGuard(4.9, 4.949)).toEqual({
      minimumDurationSeconds: 5.149,
      requestedDurationSeconds: 4.9,
    });
    expect(resolveWorkspaceSegmentPhotoDurationVoiceoverGuard(2.4, null)).toBeNull();
  });

  it("allows AI photo scenes to use the full visual timeline duration", () => {
    const aiPhotoSegment = createDraftSegment({
      aiPhotoAsset: {
        assetId: 909,
        fileName: "segment-ai-photo.jpg",
        fileSize: 0,
        mimeType: "image/jpeg",
        remoteUrl: "/api/studio/segment-ai-photo/jobs/job-1/image",
      },
      mediaType: "photo",
      videoAction: "ai_photo",
    });
    const stockPhotoSegment = createDraftSegment({
      currentSourceKind: "stock",
      mediaType: "photo",
      originalSourceKind: "stock",
    });
    const generatedStillSegment = createDraftSegment({
      currentAsset: createMediaAsset(303, { mediaType: "photo", sourceKind: "ai_generated" }),
      currentSourceKind: "ai_generated",
      mediaType: "photo",
      originalSourceKind: "stock",
    });

    expect(getWorkspaceSegmentEditorVisualDurationMaxSeconds(aiPhotoSegment)).toBe(
      WORKSPACE_SEGMENT_EDITOR_MAX_VISUAL_DURATION_SECONDS,
    );
    expect(getWorkspaceSegmentEditorVisualDurationMaxSeconds(generatedStillSegment)).toBe(
      WORKSPACE_SEGMENT_EDITOR_MAX_VISUAL_DURATION_SECONDS,
    );
    expect(getWorkspaceSegmentEditorVisualDurationMaxSeconds(stockPhotoSegment)).toBe(
      WORKSPACE_SEGMENT_EDITOR_MAX_VISUAL_DURATION_SECONDS,
    );
    expect(resolveWorkspaceSegmentVisualDurationMaxGuard(aiPhotoSegment, 51)).toEqual({
      limitKind: "visual",
      maximumDurationSeconds: WORKSPACE_SEGMENT_EDITOR_MAX_VISUAL_DURATION_SECONDS,
      requestedDurationSeconds: 51,
    });
    expect(resolveWorkspaceSegmentVisualDurationMaxGuard(aiPhotoSegment, 12)).toBeNull();
    expect(resolveWorkspaceSegmentVisualDurationMaxGuard(stockPhotoSegment, 12)).toBeNull();
  });

  it("keeps generated scene voiceover as the segment duration floor", () => {
    const segment = createDraftSegment({
      duration: 2,
      endTime: 2,
      speechDuration: 6.4,
      speechEndTime: 6.4,
      speechStartTime: 0,
      text: "Готовая озвучка длиннее визуала",
      voiceoverAsset: {
        assetId: 777,
        durationSeconds: 6.4,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/studio/segment-voiceover/jobs/job-1/audio",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("Готовая озвучка длиннее визуала"),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession(createDraftSession(segment));

    expect(getWorkspaceSegmentVoiceoverDurationSeconds(normalized.segments[0]!, normalized)).toBe(6.4);
    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 6.4,
      endTime: 6.4,
      startTime: 0,
    }));
  });

  it("uses generated voiceover audio duration when speech metadata is shorter", () => {
    const voiceText = "Фактический файл озвучки немного длиннее speech-разметки";
    const segment = createDraftSegment({
      duration: 2,
      endTime: 2,
      speechDuration: 4.8,
      speechEndTime: 4.8,
      speechStartTime: 0,
      text: voiceText,
      voiceoverAsset: {
        assetId: 780,
        durationSeconds: 5.24,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/studio/segment-voiceover/jobs/job-4/audio",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(voiceText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession(createDraftSession(segment));

    expect(getWorkspaceSegmentVoiceoverDurationSeconds(normalized.segments[0]!, normalized)).toBe(5.24);
    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 5.24,
      endTime: 5.24,
      startTime: 0,
    }));
  });

  it("preserves a manual photo duration longer than the fresh voiceover", () => {
    const voiceText = "Озвучка короче ручной длительности фото";
    const segment = createDraftSegment({
      duration: 10,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 10,
      manualDurationSeconds: 10,
      mediaType: "photo",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=0&delivery=preview",
      speechDuration: 5,
      speechDurationSource: "audio",
      speechEndTime: 5,
      speechStartTime: 0,
      text: voiceText,
      voiceoverAsset: {
        assetId: 781,
        durationSeconds: 5,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/studio/segment-voiceover/jobs/job-5/audio",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(voiceText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession(createDraftSession(segment));

    expect(getWorkspaceSegmentVoiceoverDurationSeconds(normalized.segments[0]!, normalized)).toBe(5);
    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 10,
      durationMode: "manual",
      endTime: 10,
      manualDurationSeconds: 10,
      startTime: 0,
    }));
  });

  it("keeps a manually extended photo duration when background audio measurement completes", () => {
    const segment = createDraftSegment({
      duration: 12,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 12,
      manualDurationSeconds: 12,
      mediaType: "photo",
    });

    expect(shouldPreserveWorkspaceSegmentManualVisualDurationForVoiceover(segment, 4.9)).toBe(true);
    expect(shouldPreserveWorkspaceSegmentManualVisualDurationForVoiceover(segment, 12.1)).toBe(false);
  });

  it("keeps a user-selected photo duration when measured scene voiceover is longer", () => {
    const voiceText = "Длинная озвучка для короткой фото сцены";
    const segment = createDraftSegment({
      duration: 4,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 4,
      index: 0,
      manualDurationSeconds: 4,
      mediaType: "photo",
      speechDuration: null,
      speechDurationSource: null,
      speechEndTime: null,
      speechStartTime: null,
      startTime: 0,
      text: voiceText,
      voiceoverAsset: {
        assetId: 781,
        durationSeconds: 4,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/studio/segment-voiceover/jobs/job-6/audio",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(voiceText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    const measured = applyWorkspaceSegmentMeasuredSceneVoiceoverDuration(segment, {
      durationSeconds: 6.1,
      latestSceneVoiceoverAudioUrl: "/api/studio/segment-voiceover/jobs/job-6/audio",
      speechStartTime: 0,
    });

    expect(measured).toEqual(expect.objectContaining({
      duration: 4,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 4,
      manualDurationSeconds: 4,
      speechDuration: 6.1,
      speechDurationSource: "audio",
      speechEndTime: 6.1,
      speechStartTime: 0,
      startTime: 0,
      voiceoverAsset: expect.objectContaining({
        durationSeconds: 6.1,
      }),
    }));
  });

  it("keeps a user-selected full video duration when voiceover is shorter", () => {
    const voiceText = "Короткая озвучка";
    const segment = createDraftSegment({
      customVideo: {
        assetId: 4404,
        durationSeconds: 5,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 5,
      index: 0,
      manualDurationSeconds: 5,
      mediaType: "video",
      speechDuration: 2.6,
      speechDurationSource: "audio",
      speechEndTime: 2.6,
      speechStartTime: 0,
      startTime: 0,
      text: voiceText,
      textByLanguage: { ru: voiceText },
      videoAction: "custom",
      voiceoverAsset: {
        assetId: 780,
        durationSeconds: 2.6,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/studio/segment-voiceover/jobs/job-5/audio",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(voiceText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    expect(shouldPreserveWorkspaceSegmentManualVisualDurationForVoiceover(segment, 2.6)).toBe(false);
    expect(shouldPreserveWorkspaceSegmentUserVisualDurationForVoiceover(segment, 2.6)).toBe(true);

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession({
      ...createDraftSession(segment),
      ttsAssetId: null,
      voiceType: "none",
    });

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 5,
      manualDurationSeconds: 5,
      startTime: 0,
    }));
  });

  it("trims a generated video duration to a freshly generated shorter voiceover", () => {
    const voiceText = "Короткая озвучка";
    const segment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 5,
        fileName: "segment-photo-animation.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-photo-animation/jobs/job-5/video",
      },
      aiVideoGeneratedMode: "photo_animation",
      duration: 5,
      durationMode: "manual",
      endTime: 5,
      index: 0,
      manualDurationSeconds: 5,
      mediaType: "video",
      speechDuration: 3,
      speechEndTime: 3,
      speechStartTime: 0,
      startTime: 0,
      text: voiceText,
      videoAction: "photo_animation",
      voiceoverAsset: {
        assetId: 780,
        durationSeconds: 3,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/studio/segment-voiceover/jobs/job-5/audio",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(voiceText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    expect(shouldPreserveWorkspaceSegmentManualVisualDurationForVoiceover(segment, 3)).toBe(true);

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession(createDraftSession(segment));

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 3,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 3,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("resets a stale extended video duration to a freshly generated voiceover", () => {
    const voiceText = "Взбейте яйца с сахаром и солью.";
    const firstSegment = createDraftSegment({
      customVideo: {
        assetId: 4404,
        durationSeconds: 5,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 9,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      endTime: 9,
      index: 0,
      manualDurationSeconds: 9,
      mediaType: "video",
      speechDuration: 2.3,
      speechDurationSource: "audio",
      speechEndTime: 2.3,
      speechStartTime: 0,
      startTime: 0,
      text: voiceText,
      videoAction: "custom",
      voiceoverAsset: {
        assetId: 880,
        durationSeconds: 2.3,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/880",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(voiceText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const secondSegment = createDraftSegment({
      duration: 4,
      endTime: 13,
      index: 1,
      startTime: 9,
      text: "Следующая сцена",
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession({
      ...createDraftSession(firstSegment),
      segments: [firstSegment, secondSegment],
    });

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 2.3,
      durationExtensionSourceDurationSeconds: null,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 2.3,
      manualDurationSeconds: null,
      startTime: 0,
    }));
    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      startTime: 2.3,
    }));
  });

  it("resets a stale extended video duration from project voiceover timing", () => {
    const voiceText = "Взбейте яйца с сахаром и солью.";
    const firstSegment = createDraftSegment({
      customVideo: {
        assetId: 4404,
        durationSeconds: 5,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 9,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      endTime: 9,
      index: 0,
      manualDurationSeconds: 9,
      mediaType: "video",
      speechDuration: 2.3,
      speechDurationSource: "audio",
      speechEndTime: 2.3,
      speechStartTime: 0,
      startTime: 0,
      text: voiceText,
      videoAction: "custom",
      voiceoverAsset: null,
      voiceoverLanguage: "ru",
      voiceoverTextHash: null,
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const secondSegment = createDraftSegment({
      duration: 4,
      endTime: 13,
      index: 1,
      startTime: 9,
      text: "Следующая сцена",
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession({
      ...createDraftSession(firstSegment),
      segments: [firstSegment, secondSegment],
      ttsAssetId: 8800,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 5,
      manualDurationSeconds: 5,
      startTime: 0,
    }));
    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      startTime: 5,
    }));
  });

  it("does not restore the stale timeline tail after resetting the last extended video scene", () => {
    const voiceText = "Взбейте яйца с сахаром и солью.";
    const firstSegment = createDraftSegment({
      duration: 11.4,
      endTime: 11.4,
      index: 0,
      startTime: 0,
      text: "Первая сцена",
    });
    const secondSegment = createDraftSegment({
      customVideo: {
        assetId: 4404,
        durationSeconds: 5,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 9,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      endTime: 20.4,
      index: 1,
      manualDurationSeconds: 9,
      mediaType: "video",
      speechDuration: 2.3,
      speechDurationSource: "audio",
      speechEndTime: 2.3,
      speechStartTime: 0,
      startTime: 11.4,
      text: voiceText,
      videoAction: "custom",
      voiceoverAsset: {
        assetId: 880,
        durationSeconds: 2.3,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/880",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(voiceText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession({
      ...createDraftSession(firstSegment),
      segments: [firstSegment, secondSegment],
    });

    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      duration: 2.3,
      durationExtensionSourceDurationSeconds: null,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 13.7,
      manualDurationSeconds: null,
      startTime: 11.4,
    }));
  });

  it("resets a stale auto timeline tail to the source video duration when voiceover is shorter", () => {
    const voiceText = "Взбейте яйца с сахаром и солью.";
    const firstSegment = createDraftSegment({
      duration: 11.4,
      endTime: 11.4,
      index: 0,
      startTime: 0,
      text: "Первая сцена",
    });
    const secondSegment = createDraftSegment({
      customVideo: {
        assetId: 4404,
        durationSeconds: 5,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 9,
      durationExtensionSourceDurationSeconds: null,
      durationMode: "auto",
      endTime: 20.4,
      index: 1,
      manualDurationSeconds: null,
      mediaType: "video",
      speechDuration: 2.3,
      speechDurationSource: "audio",
      speechEndTime: 2.3,
      speechStartTime: 0,
      startTime: 11.4,
      text: voiceText,
      videoAction: "custom",
      voiceoverAsset: {
        assetId: 880,
        durationSeconds: 2.3,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/880",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(voiceText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession({
      ...createDraftSession(firstSegment),
      segments: [firstSegment, secondSegment],
    });

    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      duration: 2.3,
      durationExtensionSourceDurationSeconds: null,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 13.7,
      manualDurationSeconds: null,
      startTime: 11.4,
    }));
  });

  it("preserves a user-selected full video duration over a shorter voiceover", () => {
    const voiceText = "Взбейте яйца с сахаром и солью.";
    const firstSegment = createDraftSegment({
      duration: 11.4,
      endTime: 11.4,
      index: 0,
      startTime: 0,
      text: "Первая сцена",
    });
    const secondSegment = createDraftSegment({
      customVideo: {
        assetId: 4404,
        durationSeconds: 5,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 5,
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      durationMode: "manual",
      endTime: 16.4,
      index: 1,
      manualDurationSeconds: 5,
      mediaType: "video",
      speechDuration: 2.3,
      speechDurationSource: "audio",
      speechEndTime: 2.3,
      speechStartTime: 0,
      startTime: 11.4,
      text: voiceText,
      videoAction: "custom",
      voiceoverAsset: {
        assetId: 880,
        durationSeconds: 2.3,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/880",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(voiceText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession({
      ...createDraftSession(firstSegment),
      segments: [firstSegment, secondSegment],
    });

    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 16.4,
      manualDurationSeconds: 5,
      startTime: 11.4,
    }));
  });

  it("trims a voiceover-owned video duration back to the shorter voiceover", () => {
    const voiceText = "Взбейте яйца с сахаром и солью.";
    const segment = createDraftSegment({
      customVideo: {
        assetId: 4404,
        durationSeconds: 5,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 5,
      durationSyncMode: "voiceover",
      durationMode: "manual",
      endTime: 5,
      index: 0,
      manualDurationSeconds: 5,
      mediaType: "video",
      speechDuration: 2.3,
      speechDurationSource: "audio",
      speechEndTime: 2.3,
      speechStartTime: 0,
      startTime: 0,
      text: voiceText,
      videoAction: "custom",
      voiceoverAsset: {
        assetId: 880,
        durationSeconds: 2.3,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/880",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(voiceText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession(createDraftSession(segment));

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 2.3,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 2.3,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("syncs scene timing when a freshly generated voiceover is shorter", () => {
    const voiceText = "Короткая озвучка задает новый тайминг";
    const firstSegment = createDraftSegment({
      duration: 8,
      durationMode: "manual",
      endTime: 8,
      index: 0,
      manualDurationSeconds: 8,
      mediaType: "video",
      speechDuration: 3.2,
      speechEndTime: 3.2,
      speechStartTime: 0,
      startTime: 0,
      text: voiceText,
      voiceoverAsset: {
        assetId: 778,
        durationSeconds: 3.2,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/studio/segment-voiceover/jobs/job-2/audio",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(voiceText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const secondSegment = createDraftSegment({
      duration: 4,
      endTime: 12,
      index: 1,
      startTime: 8,
      text: "Следующая сцена",
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession({
      ...createDraftSession(firstSegment),
      segments: [firstSegment, secondSegment],
    });

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 3.2,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 3.2,
      manualDurationSeconds: null,
      startTime: 0,
    }));
    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      startTime: 3.2,
    }));
  });

  it("uses the voiceover asset duration when speech metadata is missing", () => {
    const voiceText = "Длительность есть только в аудиофайле";
    const segment = createDraftSegment({
      duration: 2,
      endTime: 2,
      text: voiceText,
      voiceoverAsset: {
        assetId: 779,
        durationSeconds: 4.7,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/studio/segment-voiceover/jobs/job-3/audio",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(voiceText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession(createDraftSession(segment));

    expect(getWorkspaceSegmentVoiceoverDurationSeconds(normalized.segments[0]!, normalized)).toBe(4.7);
    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 4.7,
      endTime: 4.7,
      speechDuration: 4.7,
    }));
  });

  it("refreshes scene sound only when an existing generated sound has a prompt", () => {
    const generatedSoundSegment = createDraftSegment({
      duration: 5,
      endTime: 5,
      sceneSoundAsset: {
        durationSeconds: 5,
        fileName: "scene-sound.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/media/scene-sound.wav",
      },
      sceneSoundGeneratedFromPrompt: "soft rain and distant cars",
      sceneSoundPrompt: "soft rain",
      sceneSoundPromptInitialized: true,
    });
    const uploadedSoundSegment = createDraftSegment({
      duration: 5,
      endTime: 5,
      sceneSoundAsset: {
        durationSeconds: 5,
        fileName: "uploaded.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/media/uploaded.wav",
      },
    });

    expect(getWorkspaceSegmentSceneSoundRefreshPrompt(generatedSoundSegment)).toBe("soft rain and distant cars");
    expect(getWorkspaceSegmentSceneSoundRefreshPrompt(uploadedSoundSegment)).toBe("");
  });

  it("targets a five second AI extension when a video duration has not been manually expanded", () => {
    const videoSegment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 8,
        fileName: "segment.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-photo-animation/jobs/job/video",
      },
      duration: 8,
      endTime: 8,
      mediaType: "photo",
      videoAction: "photo_animation",
    });

    expect(resolveWorkspaceSegmentAiDurationExtensionTargetSeconds(videoSegment, null, 8)).toBe(13);
    expect(
      resolveWorkspaceSegmentAiDurationExtensionTargetSeconds(videoSegment, null, 8, {
        extensionStepSeconds: 8,
      }),
    ).toBe(16);
    expect(resolveWorkspaceSegmentAiDurationExtensionTargetSeconds(videoSegment, null, 12)).toBe(12);
  });

  it("keeps AI duration extension request source and target durations separate", () => {
    expect(
      resolveWorkspaceSegmentDurationExtensionRequestTiming({
        requestedExtensionDurationSeconds: 5,
        slotDurationSeconds: 10,
        sourceDurationSeconds: 5,
      }),
    ).toEqual({
      sourceDurationSeconds: 5,
      tailDurationSeconds: 5,
      targetDurationSeconds: 10,
    });

    expect(
      resolveWorkspaceSegmentDurationExtensionRequestTiming({
        requestedExtensionDurationSeconds: 8,
        slotDurationSeconds: 10,
        sourceDurationSeconds: 5,
      }),
    ).toEqual({
      sourceDurationSeconds: 5,
      tailDurationSeconds: 5,
      targetDurationSeconds: 10,
    });
  });

  it("caps an AI duration extension target at the maximum visual duration", () => {
    const videoSegment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 48,
        fileName: "segment.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-photo-animation/jobs/job/video",
      },
      duration: 48,
      endTime: 48,
      mediaType: "photo",
      videoAction: "photo_animation",
    });

    expect(resolveWorkspaceSegmentAiDurationExtensionTargetSeconds(videoSegment, null, 48)).toBe(
      WORKSPACE_SEGMENT_EDITOR_MAX_VISUAL_DURATION_SECONDS,
    );
    expect(
      resolveWorkspaceSegmentAiDurationExtensionTargetSeconds(videoSegment, null, 55, {
        extensionStepSeconds: 8,
      }),
    ).toBe(WORKSPACE_SEGMENT_EDITOR_MAX_VISUAL_DURATION_SECONDS);
  });

  it("trims an AI duration extension target to voiceover when requested", () => {
    const videoSegment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 8,
        fileName: "segment.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-photo-animation/jobs/job/video",
      },
      duration: 8,
      endTime: 8,
      mediaType: "photo",
      speechDuration: 10.2,
      videoAction: "photo_animation",
    });

    expect(
      resolveWorkspaceSegmentAiDurationExtensionEffectiveTargetSeconds(videoSegment, null, 13, {
        trimToVoiceover: true,
        voiceoverDurationSeconds: 10.2,
      }),
    ).toBe(10.2);
    expect(
      resolveWorkspaceSegmentAiDurationExtensionEffectiveTargetSeconds(videoSegment, null, 13, {
        trimToVoiceover: false,
        voiceoverDurationSeconds: 10.2,
      }),
    ).toBe(13);
    expect(
      resolveWorkspaceSegmentAiDurationExtensionEffectiveTargetSeconds(videoSegment, null, 13, {
        trimToVoiceover: true,
        voiceoverDurationSeconds: 5,
      }),
    ).toBe(5);
    expect(
      resolveWorkspaceSegmentAiDurationExtensionEffectiveTargetSeconds(videoSegment, null, 13, {
        trimToVoiceover: true,
        voiceoverDurationSeconds: 15,
      }),
    ).toBe(15);
  });

  it("applies full-video duration mode from the current source video, not the AI extension target", () => {
    const videoSegment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 5,
        fileName: "segment.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-photo-animation/jobs/job/video",
      },
      duration: 10,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      endTime: 10,
      manualDurationSeconds: 10,
      mediaType: "photo",
      speechDuration: 2.5,
      videoAction: "photo_animation",
    });
    const sourceDuration = getWorkspaceSegmentDurationExtensionSourceDurationSeconds(videoSegment);

    expect(sourceDuration).toBe(5);
    expect(
      resolveWorkspaceSegmentAiDurationExtensionEffectiveTargetSeconds(videoSegment, null, sourceDuration, {
        trimToVoiceover: false,
        voiceoverDurationSeconds: 2.5,
      }),
    ).toBe(5);
    expect(
      resolveWorkspaceSegmentAiDurationExtensionEffectiveTargetSeconds(videoSegment, null, 10, {
        trimToVoiceover: true,
        voiceoverDurationSeconds: 2.5,
      }),
    ).toBe(2.5);
  });

  it("keeps an effective AI duration extension target within the maximum visual duration", () => {
    const videoSegment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 8,
        fileName: "segment.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-photo-animation/jobs/job/video",
      },
      duration: 8,
      endTime: 8,
      mediaType: "photo",
      speechDuration: 60,
      videoAction: "photo_animation",
    });

    expect(
      resolveWorkspaceSegmentAiDurationExtensionEffectiveTargetSeconds(videoSegment, null, 55, {
        trimToVoiceover: false,
        voiceoverDurationSeconds: 60,
      }),
    ).toBe(WORKSPACE_SEGMENT_EDITOR_MAX_VISUAL_DURATION_SECONDS);
    expect(
      resolveWorkspaceSegmentAiDurationExtensionEffectiveTargetSeconds(videoSegment, null, 55, {
        trimToVoiceover: true,
        voiceoverDurationSeconds: 60,
      }),
    ).toBe(WORKSPACE_SEGMENT_EDITOR_MAX_VISUAL_DURATION_SECONDS);
    expect(
      resolveWorkspaceSegmentAiDurationExtensionEffectiveTargetSeconds(videoSegment, null, 55, {
        trimToVoiceover: true,
        voiceoverDurationSeconds: 49.2,
      }),
    ).toBe(49.2);
  });

  it("shows AI extension voiceover trim when voiceover is shorter than the requested video duration", () => {
    const videoSegment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 8,
        fileName: "segment.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-photo-animation/jobs/job/video",
      },
      duration: 8,
      endTime: 8,
      mediaType: "photo",
      videoAction: "photo_animation",
    });

    expect(shouldShowWorkspaceSegmentAiDurationExtensionVoiceoverTrim(videoSegment, null, 13, 10.2)).toBe(true);
    expect(shouldShowWorkspaceSegmentAiDurationExtensionVoiceoverTrim(videoSegment, null, 13, 3.2)).toBe(true);
    expect(
      resolveWorkspaceSegmentAiDurationExtensionEffectiveTargetSeconds(videoSegment, null, 13, {
        trimToVoiceover: true,
        voiceoverDurationSeconds: 3.2,
      }),
    ).toBe(3.2);
    expect(shouldShowWorkspaceSegmentAiDurationExtensionVoiceoverTrim(videoSegment, null, 13, 13)).toBe(true);
    expect(shouldShowWorkspaceSegmentAiDurationExtensionVoiceoverTrim(videoSegment, null, 13, 15)).toBe(true);
    expect(shouldShowWorkspaceSegmentAiDurationExtensionVoiceoverTrim(videoSegment, null, 13, 8)).toBe(true);
    expect(shouldShowWorkspaceSegmentAiDurationExtensionVoiceoverTrim(videoSegment, null, 8, 8)).toBe(false);
    expect(shouldShowWorkspaceSegmentAiDurationExtensionVoiceoverTrim(videoSegment, null, 13, null)).toBe(false);
  });

  it("labels the video trim mode with the current video duration, not the AI extension target", () => {
    const currentVideoDurationSeconds = 5;
    const aiExtensionTargetSeconds = 10;
    const labels = resolveWorkspaceSegmentDurationMenuTrimLabels({
      currentVideoDurationSeconds,
      locale: "ru",
      voiceoverDurationSeconds: 2.4,
      voiceoverDurationSource: "actual",
    });

    expect(labels).toEqual({
      fullDurationLabel: "5с",
      fullResultDurationLabel: "5с",
      fullResultLoopsToVoiceover: false,
      voiceoverDurationLabel: "2.4с",
    });
    expect(labels?.fullDurationLabel).not.toBe(
      formatWorkspaceSegmentEditorSegmentDurationLabel(0, aiExtensionTargetSeconds, "ru").replace(/\s+/g, ""),
    );
  });

  it("labels the video mode result as looped when voiceover is longer than video", () => {
    expect(
      resolveWorkspaceSegmentDurationMenuTrimLabels({
        currentVideoDurationSeconds: 5,
        locale: "ru",
        voiceoverDurationSeconds: 5.9,
        voiceoverDurationSource: "actual",
      }),
    ).toEqual({
      fullDurationLabel: "5с",
      fullResultDurationLabel: "5.9с",
      fullResultLoopsToVoiceover: true,
      voiceoverDurationLabel: "5.9с",
    });
  });

  it("resolves custom source video trim durations between voiceover and full video", () => {
    expect(
      resolveWorkspaceSegmentVideoTrimDuration({
        requestedDurationSeconds: 7,
        sourceVideoDurationSeconds: 60,
        voiceoverDurationSeconds: 5,
      }),
    ).toEqual({
      durationSeconds: 7,
      durationSyncMode: "visual",
      maximumDurationSeconds: 60,
      minimumDurationSeconds: 5,
    });
    expect(
      resolveWorkspaceSegmentVideoTrimDuration({
        requestedDurationSeconds: 3,
        sourceVideoDurationSeconds: 60,
        voiceoverDurationSeconds: 5,
      })?.durationSeconds,
    ).toBe(5);
    expect(
      resolveWorkspaceSegmentVideoTrimDuration({
        requestedDurationSeconds: 70,
        sourceVideoDurationSeconds: 60,
        voiceoverDurationSeconds: 5,
      })?.durationSeconds,
    ).toBe(60);
    expect(
      resolveWorkspaceSegmentVideoTrimDuration({
        requestedDurationSeconds: 7,
        sourceVideoDurationSeconds: 60,
        trimToVoiceover: true,
        voiceoverDurationSeconds: 5,
      }),
    ).toMatchObject({
      durationSeconds: 5,
      durationSyncMode: "voiceover",
    });
    expect(
      resolveWorkspaceSegmentVideoTrimDuration({
        requestedDurationSeconds: 7,
        sourceVideoDurationSeconds: 60,
        trimToVoiceover: false,
        voiceoverDurationSeconds: 5,
      }),
    ).toMatchObject({
      durationSeconds: 60,
      durationSyncMode: "visual",
    });
  });

  it("shows AI extension voiceover trim from estimated voiceover duration while audio duration is not measured yet", () => {
    const videoSegment = createDraftSegment({
      aiVideoAsset: {
        durationSeconds: 2.4,
        fileName: "segment.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-photo-animation/jobs/job/video",
      },
      duration: 2.4,
      endTime: 2.4,
      mediaType: "photo",
      text: "Взбейте яйца с сахаром и солью.",
      videoAction: "photo_animation",
    });
    const voiceoverDurationInfo = getWorkspaceSegmentTimelineVoiceoverDurationInfo(
      videoSegment,
      createDraftSession(videoSegment),
    );

    expect(voiceoverDurationInfo?.source).toBe("estimated");
    expect(
      shouldShowWorkspaceSegmentAiDurationExtensionVoiceoverTrim(
        videoSegment,
        null,
        7.4,
        voiceoverDurationInfo?.durationSeconds ?? null,
        { sourceDurationSeconds: 2.4 },
      ),
    ).toBe(true);
  });

  it("rejects segment boundary timing before the edited segment start", () => {
    const segment = createDraftSegment({
      duration: 4,
      durationMode: "manual",
      endTime: 9,
      index: 1,
      manualDurationSeconds: 4,
      startTime: 5,
    });

    const resolved = resolveWorkspaceSegmentBoundaryTiming(segment, 3, createDraftSession(segment));

    expect(resolved.status).toBe("invalid");
    expect(resolved.boundaryTime).toBe(9);
    expect(resolved.duration).toBe(4);
    expect(resolved.segmentStartTime).toBe(5);
  });

  it("clamps segment boundary timing to the voiceover plus pause minimum duration", () => {
    const segment = createDraftSegment({
      duration: 4,
      endTime: 9,
      index: 1,
      speechDuration: 2.4,
      startTime: 5,
    });

    const resolved = resolveWorkspaceSegmentBoundaryTiming(segment, 6, createDraftSession(segment));

    expect(resolved.status).toBe("valid");
    if (resolved.status === "valid") {
      expect(resolved.clamped).toBe(true);
    }
    expect(resolved.duration).toBeCloseTo(2.6, 6);
    expect(resolved.boundaryTime).toBeCloseTo(7.6, 6);
  });

  it("clamps photo visual duration from a shorter manual request to voiceover plus pause", () => {
    const segment = createDraftSegment({
      duration: 10,
      durationMode: "manual",
      endTime: 10,
      index: 0,
      manualDurationSeconds: 10,
      speechDuration: 3.3,
      speechEndTime: 3.3,
      speechStartTime: 0,
      startTime: 0,
    });

    const resolved = resolveWorkspaceSegmentBoundaryTiming(segment, 2, createDraftSession(segment));

    expect(resolved.status).toBe("valid");
    if (resolved.status === "valid") {
      expect(resolved.clamped).toBe(true);
    }
    expect(resolved.duration).toBeCloseTo(3.5, 6);
    expect(resolved.boundaryTime).toBeCloseTo(3.5, 6);
  });

  it("allows shrinking a talking photo video below the generated video duration", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        assetId: 909,
        durationSeconds: 5.5,
        fileName: "segment-talking-photo.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-talking-photo/jobs/test-job-909/video",
      },
      aiVideoGeneratedMode: "talking_photo",
      duration: 5.5,
      durationMode: "manual",
      endTime: 5.5,
      manualDurationSeconds: 5.5,
      text: "Говорящий персонаж",
      videoAction: "talking_photo",
    });

    const resolved = resolveWorkspaceSegmentBoundaryTiming(segment, 3, createDraftSession(segment));

    expect(resolved.status).toBe("valid");
    expect(resolved.duration).toBe(3);
    expect(resolved.minimumDuration).toBe(1);
  });

  it("keeps slot timings when a manual photo segment becomes a talking photo video", () => {
    const talkingPhotoSegment = createDraftSegment({
      aiVideoAsset: {
        assetId: 909,
        durationSeconds: 3.2,
        fileName: "segment-talking-photo.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-talking-photo/jobs/test-job-909/video",
      },
      aiVideoGeneratedMode: "talking_photo",
      duration: 5,
      durationMode: "manual",
      endTime: 5,
      index: 0,
      manualDurationSeconds: 5,
      speechDuration: 5,
      startTime: 0,
      videoAction: "talking_photo",
    });
    const nextSegment = createDraftSegment({
      duration: 4,
      durationMode: "manual",
      endTime: 9,
      index: 1,
      manualDurationSeconds: 4,
      startTime: 5,
      text: "Next segment",
    });

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession({
      ...createDraftSession(talkingPhotoSegment),
      segments: [talkingPhotoSegment, nextSegment],
    });
    const tracks = buildWorkspaceSegmentEditorTracks(
      normalized.segments,
      normalized.segments,
      normalized,
      normalized,
    );

    expect(normalized.segments[0]).toMatchObject({
      duration: 5,
      durationMode: "manual",
      endTime: 5,
      manualDurationSeconds: 5,
      startTime: 0,
    });
    expect(normalized.segments[0]?.aiVideoAsset?.durationSeconds).toBe(3.2);
    expect(normalized.segments[1]?.startTime).toBe(5);
    expect(tracks.segmentSpans.map((span) => span.duration)).toEqual([5, 4]);
    expect(tracks.totalDuration).toBe(9);
  });

  it("includes manual duration fields and resolved timeline duration in segment editor payload", async () => {
    const segment = createDraftSegment({
      duration: 4,
      durationExtensionSourceDurationSeconds: 4,
      durationMode: "manual",
      manualDurationSeconds: 7.2,
      text: "Manual payload segment",
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]).toEqual(
      expect.objectContaining({
        duration: 7.2,
        durationExtensionSourceDurationSeconds: 4,
        durationMode: "manual",
        endTime: 7.2,
        manualDurationSeconds: 7.2,
        startTime: 0,
      }),
    );
  });

  it("exports scratch scene drafts as scene-controlled generation payloads without a project id", async () => {
    const scratchDraft = createWorkspaceSegmentEditorScratchDraftSession({
      language: "ru",
      title: "Новый Shorts",
    });
    const scratchSceneDraft = {
      ...scratchDraft,
      segments: scratchDraft.segments.map((segment) => ({
        ...segment,
        text: "Крупный план продукта на светлом столе",
      })),
    };

    const result = await buildWorkspaceSegmentEditorPayload(scratchSceneDraft, {
      allowStructureChange: true,
      language: "ru",
    });

    expect(result.payload).toEqual(
      expect.objectContaining({
        allowStructureChange: true,
        source: "scratch",
      }),
    );
    expect(result.payload.projectId).toBeUndefined();
    expect(result.payload.segments[0]).toEqual(
      expect.objectContaining({
        index: 0,
        text: "Крупный план продукта на светлом столе",
        videoAction: "ai",
      }),
    );
  });

  it("marks the voice timeline as edited for text-only changes", () => {
    const textOnlyState = resolveWorkspaceSegmentVoiceTimelineState({
      canForwardText: false,
      canForwardVoice: false,
      isGeneratedVoiceoverEdited: false,
      isTextEdited: true,
      isVoiceSettingsEdited: false,
    });
    const generatedVoiceoverState = resolveWorkspaceSegmentVoiceTimelineState({
      canForwardText: false,
      canForwardVoice: false,
      isGeneratedVoiceoverEdited: true,
      isTextEdited: false,
      isVoiceSettingsEdited: true,
    });
    const voiceSettingsState = resolveWorkspaceSegmentVoiceTimelineState({
      canForwardText: false,
      canForwardVoice: false,
      isGeneratedVoiceoverEdited: false,
      isTextEdited: false,
      isVoiceSettingsEdited: true,
    });

    expect(textOnlyState).toMatchObject({
      canBack: true,
      hasHistory: true,
      historyKind: "text",
      isEdited: true,
    });
    expect(generatedVoiceoverState).toMatchObject({
      canBack: true,
      hasHistory: true,
      historyKind: "voice",
      isEdited: true,
    });
    expect(voiceSettingsState).toMatchObject({
      canBack: true,
      hasHistory: true,
      historyKind: "voice",
      isEdited: true,
    });
  });

  it("hides voice timeline history for embedded talking character audio", () => {
    const state = resolveWorkspaceSegmentVoiceTimelineState({
      canForwardText: true,
      canForwardVoice: true,
      isGeneratedVoiceoverEdited: true,
      isTextEdited: true,
      isVoiceHistoryDisabled: true,
      isVoiceSettingsEdited: true,
    });

    expect(state).toEqual({
      canBack: false,
      canForward: false,
      hasHistory: false,
      historyKind: "text",
      isEdited: true,
    });
  });

  it("shows project voiceover progress on every segment sent to generation", () => {
    const targets = [{ index: 0 }, { index: 1 }, { index: 2 }];

    expect(resolveWorkspaceProjectVoiceoverPendingSegments(targets, [targets[1]])).toEqual(targets);
    expect(resolveWorkspaceProjectVoiceoverPendingSegments(targets, [])).toEqual([]);
  });

  it("keeps project voiceover timing when a scene voice is toggled off and back on", () => {
    const text = "Речь идет о полноценном нейроинтерфейсе.";
    const segment = createDraftSegment({
      duration: 4.3,
      endTime: 4.3,
      speechDuration: 4.3,
      speechDurationSource: "audio",
      speechEndTime: 4.3,
      speechStartTime: 0,
      speechWords: [{ confidence: 1, endTime: 4.3, startTime: 0, text }],
      text,
      textByLanguage: { ru: text },
      voiceoverAsset: {
        assetId: 777,
        durationSeconds: 31.7,
        fileName: "project-voiceover.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/777",
        source: "media-library",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const draft = {
      ...createDraftSession(segment),
      ttsAssetId: 777,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    };
    const staleSceneVoiceDraft = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      applyWorkspaceSegmentEditorSceneVoiceOverride(draft, segment.index, "English_ManWithDeepVoice"),
    );
    const disabledDraft = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      applyWorkspaceSegmentEditorSceneVoiceOverride(staleSceneVoiceDraft, segment.index, "none", {
        subtitleType: "none",
      }),
    );
    const restoredDraft = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      applyWorkspaceSegmentEditorSceneVoiceOverride(disabledDraft, segment.index, null),
    );
    const staleSceneVoiceSegment = staleSceneVoiceDraft.segments[0]!;
    const restoredSegment = restoredDraft.segments[0]!;

    expect(disabledDraft.ttsAssetId).toBe(777);
    expect(staleSceneVoiceSegment.speechDuration).toBe(4.3);
    expect(
      getWorkspaceSegmentTimelineVoiceoverDurationInfo(staleSceneVoiceSegment, staleSceneVoiceDraft, {
        isStale: true,
      }),
    ).toMatchObject({
      source: "estimated",
    });
    expect(restoredSegment.speechDuration).toBe(4.3);
    expect(getWorkspaceSegmentTimelineVoiceoverDurationInfo(restoredSegment, restoredDraft)).toMatchObject({
      durationSeconds: 4.3,
      source: "actual",
    });
  });

  it("does not apply scene voice overrides to talking character audio", () => {
    const text = "Говорящий персонаж уже содержит озвучку.";
    const talkingSegment = createDraftSegment({
      aiVideoAsset: {
        assetId: 914,
        durationSeconds: 6.2,
        fileName: "talking-photo.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/914/playback",
        source: "media-library",
      },
      aiVideoGeneratedMode: "talking_photo",
      text,
      textByLanguage: { ru: text },
      videoAction: "talking_photo",
      voiceoverAsset: {
        assetId: 915,
        durationSeconds: 6.2,
        fileName: "embedded-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/915",
        source: "media-library",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const draft = createDraftSession(talkingSegment);

    const updatedDraft = applyWorkspaceSegmentEditorSceneVoiceOverride(
      draft,
      talkingSegment.index,
      "English_ManWithDeepVoice",
    );

    expect(updatedDraft.segments[0]).toEqual(talkingSegment);
  });

  it("skips talking character scenes when applying a global voice", async () => {
    const talkingText = "Встроенная озвучка не должна сбрасываться.";
    const talkingSegment = createDraftSegment({
      aiVideoAsset: {
        assetId: 916,
        durationSeconds: 5.5,
        fileName: "talking-photo.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/916/playback",
        source: "media-library",
      },
      aiVideoGeneratedMode: "talking_photo",
      index: 0,
      text: talkingText,
      textByLanguage: { ru: talkingText },
      videoAction: "talking_photo",
      voiceoverAsset: {
        assetId: 917,
        durationSeconds: 5.5,
        fileName: "embedded-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/917",
        source: "media-library",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(talkingText),
      voiceoverVoiceType: "Russian_BrightHeroine",
      voiceType: "Russian_BrightHeroine",
    });
    const regularSegment = createDraftSegment({
      index: 1,
      text: "Обычная сцена меняет голос.",
      voiceoverAsset: {
        assetId: 918,
        durationSeconds: 3,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/918",
        source: "media-library",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("Обычная сцена меняет голос."),
      voiceoverVoiceType: "Russian_BrightHeroine",
      voiceType: "Russian_BrightHeroine",
    });
    const draft = {
      ...createDraftSession(talkingSegment),
      segments: [talkingSegment, regularSegment],
      voiceType: "Russian_BrightHeroine",
    };

    const updatedDraft = applyWorkspaceSegmentEditorGlobalVoiceToSegments(draft, DEFAULT_STUDIO_VOICE_ID.ru);

    expect(updatedDraft.voiceType).toBe(DEFAULT_STUDIO_VOICE_ID.ru);
    expect(updatedDraft.segments[0]).toEqual(talkingSegment);
    expect(updatedDraft.segments[1]).toEqual(expect.objectContaining({
      voiceType: null,
      voiceoverAsset: null,
      voiceoverLanguage: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    }));

    const result = await buildWorkspaceSegmentEditorPayload(updatedDraft, { language: "ru" });

    expect(result.payload.segments[0]).toEqual(expect.objectContaining({
      videoAction: "talking_photo",
      voiceType: "none",
    }));
  });

  it("restores generated voiceover timing together with voice text history", () => {
    const baselineText = "Исходная озвучка сцены";
    const generatedText = "Исходная озвучка сцены. Новая длинная фраза для проверки.";
    const currentSegment = createDraftSegment({
      speechDuration: 12.4,
      text: generatedText,
      textByLanguage: { ru: generatedText },
      voiceoverAsset: {
        assetId: 901,
        durationSeconds: 12.4,
        fileName: "generated-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/901/playback",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(generatedText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const baselineSegment = createDraftSegment({
      speechDuration: 6.5,
      text: baselineText,
      textByLanguage: { ru: baselineText },
      voiceoverAsset: {
        assetId: 777,
        durationSeconds: 6.5,
        fileName: "baseline-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/777/playback",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(baselineText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    expect(restoreWorkspaceSegmentTimelineSnapshot(currentSegment, baselineSegment, "text")).toEqual(
      expect.objectContaining({
        speechDuration: 6.5,
        text: baselineText,
        textByLanguage: { ru: baselineText },
        voiceoverAsset: expect.objectContaining({ assetId: 777 }),
        voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(baselineText),
      }),
    );
    expect(restoreWorkspaceSegmentTimelineSnapshot(currentSegment, baselineSegment, "voice")).toEqual(
      expect.objectContaining({
        speechDuration: 6.5,
        text: baselineText,
        textByLanguage: { ru: baselineText },
        voiceoverAsset: expect.objectContaining({ assetId: 777 }),
        voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(baselineText),
      }),
    );
  });

  it("restores ungenerated voice text edits from the timeline menu snapshot", () => {
    const originalText = "Исходный текст озвучки";
    const editedText = "Новый текст без генерации озвучки";
    const snapshotSegment = createDraftSegment({
      speechDuration: 6.4,
      text: originalText,
      textByLanguage: { ru: originalText },
      voiceoverAsset: {
        assetId: 777,
        durationSeconds: 6.4,
        fileName: "baseline-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/777/playback",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(originalText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const editedSegment = {
      ...snapshotSegment,
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      text: editedText,
      textByLanguage: { ru: editedText },
    };

    expect(restoreWorkspaceSegmentVoiceTextDraftSnapshot(editedSegment, snapshotSegment)).toEqual(
      expect.objectContaining({
        speechDuration: 6.4,
        text: originalText,
        textByLanguage: { ru: originalText },
        voiceoverAsset: expect.objectContaining({ assetId: 777 }),
        voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(originalText),
      }),
    );
  });

  it("restores the project voiceover id when reverting ungenerated voice text edits", () => {
    const originalText = "Исходный текст озвучки";
    const editedText = "Новый текст без генерации озвучки";
    const snapshotSegment = createDraftSegment({
      index: 0,
      speechDuration: 6.4,
      text: originalText,
      textByLanguage: { ru: originalText },
      voiceoverAsset: {
        assetId: 777,
        durationSeconds: 6.4,
        fileName: "baseline-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/777/playback",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(originalText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const editedSegment = {
      ...snapshotSegment,
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      text: editedText,
      textByLanguage: { ru: editedText },
    };
    const restoredDraft = restoreWorkspaceSegmentVoiceTextDraftSessionSnapshot(
      {
        ...createDraftSession(editedSegment),
        ttsAssetId: null,
      },
      {
        segment: snapshotSegment,
        segmentIndex: 0,
        ttsAssetId: 777,
      },
    );

    expect(restoredDraft?.ttsAssetId).toBe(777);
    expect(restoredDraft?.segments[0]?.text).toBe(originalText);
    expect(restoredDraft?.segments[0]?.voiceoverAsset?.assetId).toBe(777);
  });

  it("keeps a visible voice duration after text changes make generated voiceover stale", () => {
    const generatedText = "Короткий исходный текст";
    const editedText = "Новый текст озвучки стал заметно длиннее и должен иметь расчетную длительность.";
    const segment = {
      ...createDraftSegment({
        speechDuration: 4.2,
        text: generatedText,
        voiceoverAsset: {
          assetId: 901,
          durationSeconds: 4.2,
          fileName: "generated-voice.wav",
          fileSize: 0,
          mimeType: "audio/wav",
          remoteUrl: "/api/workspace/media-assets/901/playback",
        },
        voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(generatedText),
        voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
      }),
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      text: editedText,
      textByLanguage: { ru: editedText },
    };

    const durationInfo = getWorkspaceSegmentTimelineVoiceoverDurationInfo(
      segment,
      createDraftSession(segment),
      { isStale: true },
    );

    expect(durationInfo?.source).toBe("estimated");
    expect(durationInfo?.durationSeconds).toBeGreaterThan(0);
  });

  it("marks generated voiceover as edited only when a fresh asset differs from baseline", () => {
    const unchangedOptions = {
      baselineVoiceoverAssetKey: "asset:888",
      baselineVoiceoverLanguage: "ru",
      baselineVoiceoverTextHash: "hash:old",
      baselineVoiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
      currentVoiceoverAssetKey: "asset:888",
      currentVoiceoverLanguage: "ru",
      currentVoiceoverTextHash: "hash:old",
      currentVoiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
      hasBaseline: true,
      isVoiceoverFresh: true,
    };

    expect(resolveWorkspaceSegmentGeneratedVoiceoverEdited(unchangedOptions)).toBe(false);
    expect(
      resolveWorkspaceSegmentGeneratedVoiceoverEdited({
        ...unchangedOptions,
        currentVoiceoverAssetKey: "asset:889",
        currentVoiceoverTextHash: "hash:new",
      }),
    ).toBe(true);
    expect(
      resolveWorkspaceSegmentGeneratedVoiceoverEdited({
        ...unchangedOptions,
        currentVoiceoverAssetKey: "asset:889",
        isVoiceoverFresh: false,
      }),
    ).toBe(false);
  });

  it("exports scene voiceover asset only while text, voice, and language still match", async () => {
    const freshSegment = createDraftSegment({
      text: "Подписывайтесь на канал",
      voiceoverAsset: {
        assetId: 888,
        durationSeconds: 2.6,
        fileName: "scene-voice.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/studio/segment-voiceover/jobs/job-1/audio",
      },
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("Подписывайтесь на канал"),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const staleTextSegment = {
      ...freshSegment,
      text: "Подписывайтесь на канал прямо сейчас",
    };
    const staleVoiceSegment = {
      ...freshSegment,
      voiceType: "Marfa",
    };

    const freshResult = await buildWorkspaceSegmentEditorPayload(createDraftSession(freshSegment), { language: "ru" });
    const staleTextResult = await buildWorkspaceSegmentEditorPayload(createDraftSession(staleTextSegment), { language: "ru" });
    const staleVoiceResult = await buildWorkspaceSegmentEditorPayload(createDraftSession(staleVoiceSegment), { language: "ru" });
    const staleLanguageResult = await buildWorkspaceSegmentEditorPayload(
      {
        ...createDraftSession(freshSegment),
        language: "en",
      },
      { language: "en" },
    );

    expect(freshResult.payload.segments[0]).toEqual(expect.objectContaining({
      voiceoverAssetId: 888,
    }));
    expect(staleTextResult.payload.segments[0]?.voiceoverAssetId).toBeUndefined();
    expect(staleVoiceResult.payload.segments[0]?.voiceoverAssetId).toBeUndefined();
    expect(staleLanguageResult.payload.segments[0]?.voiceoverAssetId).toBeUndefined();
  });

  it("exports the selected visual duration sync mode for reload-safe saves", async () => {
    const segment = createDraftSegment({
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      mediaType: "video",
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]).toEqual(expect.objectContaining({
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      duration_sync_mode: "voiceover",
      duration_sync_mode_user_selected: true,
    }));
  });

  it("marks only user-selected segment durations as manual timing changes", async () => {
    const autoVisualSegment = createDraftSegment({
      duration: 3.8,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 3.8,
      manualDurationSeconds: 3.8,
      mediaType: "video",
    });
    const userSelectedSegment = createDraftSegment({
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "video",
    });

    const autoResult = await buildWorkspaceSegmentEditorPayload(createDraftSession(autoVisualSegment), { language: "ru" });
    const userSelectedResult = await buildWorkspaceSegmentEditorPayload(createDraftSession(userSelectedSegment), { language: "ru" });

    expect(autoResult.payload.segments[0]).toEqual(expect.objectContaining({
      durationMode: "manual",
      durationSyncModeUserSelected: false,
      manualDurationSeconds: 3.8,
      manualTimingUserChanged: false,
      manual_timing_user_changed: false,
    }));
    expect(userSelectedResult.payload.segments[0]).toEqual(expect.objectContaining({
      durationMode: "manual",
      durationSyncModeUserSelected: true,
      manualDurationSeconds: 5,
      manualTimingUserChanged: true,
      manual_timing_user_changed: true,
    }));
  });

  it("includes per-scene subtitle disable override without changing the shared segment text", async () => {
    const segment = createDraftSegment({
      subtitleType: "none",
      text: "Shared voice and subtitle text",
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]).toEqual(
      expect.objectContaining({
        subtitleType: "none",
        text: "Shared voice and subtitle text",
        voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
      }),
    );
  });

  it("allows a scene subtitle override when global subtitles are off", async () => {
    const segment = createDraftSegment({
      subtitleColor: "cyan",
      subtitleStyle: "impact",
      text: "Scene-level subtitles remain available",
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const session = {
      ...createDraftSession(segment),
      subtitleType: "none",
    };
    const effectiveSettings = getWorkspaceSegmentEffectiveSubtitleSettings(session, segment, {
      subtitleColorId: "purple",
      subtitleStyleId: "modern",
    });

    expect(effectiveSettings).toMatchObject({
      globalEnabled: false,
      isEnabled: true,
      subtitleColorId: "cyan",
      subtitleStyleId: "impact",
      subtitleType: "default",
      voiceEnabled: true,
    });

    const result = await buildWorkspaceSegmentEditorPayload(session, { language: "ru" });

    expect(result.payload.segments[0]).toEqual(
      expect.objectContaining({
        subtitleColor: "cyan",
        subtitleStyle: "impact",
        subtitleType: "default",
        text: "Scene-level subtitles remain available",
      }),
    );
  });

  it("keeps inherited scene subtitles off when global subtitles are off", () => {
    const segment = createDraftSegment({
      text: "Scene inherits global subtitle defaults",
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const effectiveSettings = getWorkspaceSegmentEffectiveSubtitleSettings(
      {
        ...createDraftSession(segment),
        subtitleType: "none",
      },
      segment,
      {
        subtitleColorId: "purple",
        subtitleStyleId: "modern",
      },
    );

    expect(effectiveSettings).toMatchObject({
      globalEnabled: false,
      isEnabled: false,
      subtitleType: "none",
      voiceEnabled: true,
    });
  });

  it("exports a scene voice from another language without changing the project language", async () => {
    const segment = createDraftSegment({
      text: "Scene keeps its own voice language",
      voiceType: DEFAULT_STUDIO_VOICE_ID.en,
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]?.voiceType).toBe(DEFAULT_STUDIO_VOICE_ID.en);
  });

  it("exports per-scene subtitle style and color only when a scene has overrides", async () => {
    const firstSegment = createDraftSegment({
      index: 0,
      subtitleColor: "cyan",
      subtitleStyle: "impact",
      text: "Styled scene",
    });
    const secondSegment = createDraftSegment({
      index: 1,
      startTime: 4,
      endTime: 8,
      duration: 4,
      text: "Inherited scene",
    });

    const result = await buildWorkspaceSegmentEditorPayload(
      {
        ...createDraftSession(firstSegment),
        segments: [firstSegment, secondSegment],
      },
      { language: "ru" },
    );

    expect(result.payload.segments[0]).toEqual(
      expect.objectContaining({
        subtitleColor: "cyan",
        subtitleStyle: "impact",
        text: "Styled scene",
      }),
    );
    expect(result.payload.segments[1]).not.toHaveProperty("subtitleColor");
    expect(result.payload.segments[1]).not.toHaveProperty("subtitleStyle");
    expect(result.payload.segments[1]).not.toHaveProperty("subtitleType");
    expect(result.payload.segments[1]?.text).toBe("Inherited scene");
  });

  it("uses current manual scene timing for segment visual generation jobs", () => {
    const segment = createDraftSegment({
      duration: 3,
      durationMode: "manual",
      endTime: 13,
      manualDurationSeconds: 13,
      startTime: 0,
      text: "Manual visual timing",
    });

    expect(getWorkspaceSegmentVisualGenerationDurationSeconds(segment)).toBe(13);
  });

  it("exports the editor-selected manual duration even when the stored media duration is stale", async () => {
    const firstSegment = createDraftSegment({
      duration: 13,
      durationMode: "manual",
      endTime: 13,
      index: 0,
      manualDurationSeconds: 13,
      mediaType: "video",
      speechDuration: 10.7,
      startTime: 0,
      text: "сегодня покажу вам рецепт очень вкусных блинов",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("сегодня покажу вам рецепт очень вкусных блинов"),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const shortenedSegment = createDraftSegment({
      duration: 10,
      durationMode: "manual",
      endTime: 18,
      index: 1,
      manualDurationSeconds: 5,
      mediaType: "video",
      speechDuration: 2.5,
      startTime: 13,
      text: "Взбейте яйца с сахаром и солью.",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("Взбейте яйца с сахаром и солью."),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const result = await buildWorkspaceSegmentEditorPayload(
      {
        ...createDraftSession(firstSegment),
        segments: [firstSegment, shortenedSegment],
        ttsAssetId: 4980,
        voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
      },
      { language: "ru" },
    );

    expect(result.payload.segments[1]).toEqual(expect.objectContaining({
      duration: 5,
      durationMode: "manual",
      endTime: 18,
      manualDurationSeconds: 5,
      startTime: 13,
      text: "Взбейте яйца с сахаром и солью.",
    }));
    expect(result.payload.segments[1]?.voiceoverAssetId).toBeUndefined();
  });

  it("exports talking photo with embedded audio and canonical slot duration", async () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        assetId: 909,
        durationSeconds: 3.2,
        fileName: "segment-talking-photo.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-talking-photo/jobs/test-job-909/video",
      },
      aiVideoGeneratedFromPrompt: "Говорящий персонаж",
      aiVideoGeneratedMode: "talking_photo",
      aiVideoPrompt: "Говорящий персонаж",
      aiVideoPromptInitialized: true,
      duration: 5,
      durationMode: "manual",
      endTime: 5,
      manualDurationSeconds: 5,
      speechDuration: 5,
      text: "Говорящий персонаж",
      videoAction: "talking_photo",
      voiceType: "Boris",
    });

    const session = createDraftSession(segment);
    const result = await buildWorkspaceSegmentEditorPayload(session, { language: "ru" });

    expect(result.payload.segments[0]).toMatchObject({
      customVideoAssetId: 909,
      duration: 5,
      durationMode: "manual",
      endTime: 5,
      manualDurationSeconds: 5,
      startTime: 0,
      videoAction: "talking_photo",
      voiceType: "none",
    });
    expect(result.payload.segments[0]?.subtitleType).not.toBe("none");
    expect(getWorkspaceSegmentEffectiveSubtitleSettings(session, segment, {
      subtitleColorId: "purple",
      subtitleStyleId: "modern",
    })).toMatchObject({
      isEnabled: true,
      voiceEnabled: true,
    });
  });

  it("uses talking photo speech duration before the generated video duration", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        assetId: 909,
        durationSeconds: 5.5,
        fileName: "segment-talking-photo.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-talking-photo/jobs/test-job-909/video",
      },
      aiVideoGeneratedMode: "talking_photo",
      duration: 5.5,
      durationMode: "manual",
      endTime: 5.5,
      manualDurationSeconds: 5.5,
      speechDuration: 2.1,
      speechDurationSource: "audio",
      speechEndTime: 2.1,
      speechStartTime: 0,
      text: "Говорящий персонаж",
      videoAction: "talking_photo",
      voiceSourceDuration: 2.1,
      voiceSourceEndTime: 2.1,
      voiceSourceStartTime: 0,
    });

    expect(
      getWorkspaceSegmentEmbeddedTalkingPhotoAudioDurationSeconds(segment, {
        allowVisualFallback: false,
      }),
    ).toBe(2.1);
    expect(
      getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, createDraftSession(segment), {
        allowEstimated: false,
      }),
    ).toEqual({
      durationSeconds: 2.1,
      source: "actual",
    });
  });

  it("falls back to talking photo generated video duration when embedded audio timing is unknown", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        assetId: 909,
        durationSeconds: 6.7,
        fileName: "segment-talking-photo.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-talking-photo/jobs/test-job-909/video",
      },
      aiVideoGeneratedMode: "talking_photo",
      duration: 6.48,
      durationMode: "manual",
      endTime: 6.48,
      manualDurationSeconds: 6.48,
      text: "Говорящий персонаж",
      videoAction: "talking_photo",
    });

    expect(
      getWorkspaceSegmentEmbeddedTalkingPhotoAudioDurationSeconds(segment, {
        allowVisualFallback: false,
      }),
    ).toBeNull();
    expect(
      getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, createDraftSession(segment), {
        allowEstimated: false,
      }),
    ).toEqual({
      durationSeconds: 6.7,
      source: "actual",
    });
    expect(
      getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, createDraftSession(segment), {
        allowEmbeddedVisualFallback: false,
        allowEstimated: false,
      }),
    ).toBeNull();
    expect(
      getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, createDraftSession(segment), {
        allowEmbeddedVisualFallback: false,
      }),
    ).toMatchObject({
      source: "estimated",
    });
  });

  it("keeps the project timeline stable when a talking photo asset is shorter than the fourth segment slot", async () => {
    const durations = [6.38, 8.22, 6.4, 6.48, 6.04, 5.24];
    let cursor = 0;
    const segments = durations.map((duration, index) => {
      const startTime = cursor;
      const endTime = Number((startTime + duration).toFixed(3));
      cursor = endTime;

      return createDraftSegment({
        aiVideoAsset:
          index === 3
            ? {
                assetId: 909,
                durationSeconds: 6.455328798185941,
                fileName: "segment-talking-photo.mp4",
                fileSize: 0,
                mimeType: "video/mp4",
                remoteUrl: "/api/studio/segment-talking-photo/jobs/test-job-909/video",
              }
            : null,
        aiVideoGeneratedMode: index === 3 ? "talking_photo" : null,
        duration,
        durationMode: "manual",
        endTime,
        index,
        manualDurationSeconds: duration,
        startTime,
        text: `Segment ${index + 1}`,
        videoAction: index === 3 ? "talking_photo" : "original",
      });
    });

    const result = await buildWorkspaceSegmentEditorPayload(
      {
        ...createDraftSession(segments[0]!),
        segments,
      },
      { language: "ru" },
    );

    expect(result.payload.segments.map((segment) => ({
      duration: segment.duration,
      endTime: segment.endTime,
      startTime: segment.startTime,
    }))).toEqual([
      { duration: 6.38, endTime: 6.38, startTime: 0 },
      { duration: 8.22, endTime: 14.6, startTime: 6.38 },
      { duration: 6.4, endTime: 21, startTime: 14.6 },
      { duration: 6.48, endTime: 27.48, startTime: 21 },
      { duration: 6.04, endTime: 33.52, startTime: 27.48 },
      { duration: 5.24, endTime: 38.76, startTime: 33.52 },
    ]);
    expect(result.payload.segments[3]).toEqual(
      expect.objectContaining({
        customVideoAssetId: 909,
        duration: 6.48,
        manualDurationSeconds: 6.48,
        videoAction: "talking_photo",
        voiceType: "none",
      }),
    );
  });

  it("extends talking photo export when the generated media is materially longer than the segment slot", async () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        assetId: 909,
        durationSeconds: 6.7,
        fileName: "segment-talking-photo.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-talking-photo/jobs/test-job-909/video",
      },
      aiVideoGeneratedMode: "talking_photo",
      duration: 6.48,
      durationMode: "manual",
      endTime: 6.48,
      index: 0,
      manualDurationSeconds: 6.48,
      text: "Говорящий персонаж",
      videoAction: "talking_photo",
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]).toEqual(
      expect.objectContaining({
        customVideoAssetId: 909,
        duration: 6.7,
        durationMode: "manual",
        endTime: 6.7,
        manualDurationSeconds: 6.7,
        startTime: 0,
        videoAction: "talking_photo",
        voiceType: "none",
      }),
    );
  });

  it("keeps a user-trimmed talking photo export when embedded speech fits the scene", async () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        assetId: 909,
        durationSeconds: 5.5,
        fileName: "segment-talking-photo.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-talking-photo/jobs/test-job-909/video",
      },
      aiVideoGeneratedMode: "talking_photo",
      duration: 3,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 3,
      index: 0,
      manualDurationSeconds: 3,
      speechDuration: 1.8,
      speechDurationSource: "audio",
      speechEndTime: 1.8,
      speechStartTime: 0,
      text: "Говорящий персонаж",
      videoAction: "talking_photo",
      voiceSourceDuration: 1.8,
      voiceSourceEndTime: 1.8,
      voiceSourceStartTime: 0,
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]).toEqual(
      expect.objectContaining({
        customVideoAssetId: 909,
        duration: 3,
        durationMode: "manual",
        endTime: 3,
        manualDurationSeconds: 3,
        startTime: 0,
        videoAction: "talking_photo",
        voiceType: "none",
      }),
    );
  });

  it("restores a live generated AI photo when server state lost the draft video action", () => {
    const generatedAsset = createMediaAsset(303, {
      kind: "segment_current",
      mediaType: "photo",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const draft = createDraftSession(createDraftSegment({
      currentAsset: generatedAsset,
      currentPreviewUrl: "/api/workspace/media-assets/303",
      currentSourceKind: "ai_generated",
      originalAsset: generatedAsset,
      originalPreviewUrl: "/api/workspace/media-assets/303",
      originalSourceKind: "ai_generated",
      videoAction: "original",
    }));

    const hydratedDraft = hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary(
      draft,
      [createGeneratedMediaLibraryEntry(303, "ai_photo")],
    );
    const hydratedSegment = hydratedDraft?.segments[0];

    expect(hydratedSegment?.videoAction).toBe("ai_photo");
    expect(hydratedSegment?.aiPhotoAsset?.assetId).toBe(303);
    expect(hydratedSegment && isWorkspaceSegmentDraftVisualResettable(hydratedSegment)).toBe(true);
  });

  it("replaces a stale AI photo asset with the latest generated media entry", () => {
    const stockAsset = createMediaAsset(3543, {
      mediaType: "video",
      sourceKind: "stock",
    });
    const draft = createDraftSession(createDraftSegment({
      aiPhotoAsset: {
        assetId: 3543,
        fileName: "old-stock.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/3543",
      },
      currentAsset: stockAsset,
      currentPreviewUrl: "/api/workspace/media-assets/3543",
      currentSourceKind: "stock",
      originalAsset: stockAsset,
      originalPreviewUrl: "/api/workspace/media-assets/3543",
      originalSourceKind: "stock",
      videoAction: "ai_photo",
    }));

    const hydratedDraft = hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary(
      draft,
      [createGeneratedMediaLibraryEntry(3553, "ai_photo")],
    );

    expect(hydratedDraft?.segments[0]?.aiPhotoAsset?.assetId).toBe(3553);
    expect(hydratedDraft?.segments[0]?.aiPhotoAsset?.remoteUrl).toBe("/api/workspace/media-assets/3553");
  });

  it("builds generated image edit media entries for scratch drafts", () => {
    const scratchProject: Parameters<typeof buildWorkspaceGeneratedMediaLibraryEntry>[0]["project"] = {
      adId: 0,
      createdAt: "2026-06-03T00:00:00.000Z",
      description: "",
      editedFromProjectAdId: null,
      finalAsset: null,
      generatedAt: null,
      hashtags: [],
      id: "scratch",
      jobId: null,
      posterUrl: null,
      prompt: "",
      source: "project",
      status: "draft",
      title: "Scratch",
      updatedAt: "2026-06-03T00:00:00.000Z",
      versionRootProjectAdId: null,
      videoFallbackUrl: null,
      videoUrl: null,
      youtubePublication: null,
    };

    const entry = buildWorkspaceGeneratedMediaLibraryEntry({
      asset: {
        dataUrl: "data:image/png;base64,abc",
        fileName: "segment-image-edit.png",
        fileSize: 3,
        mimeType: "image/png",
      },
      kind: "image_edit",
      project: scratchProject,
      segment: createDraftSegment({ index: 3 }),
      segmentListIndex: 2,
      sourceJobId: "scratch-image-edit-job",
    });

    expect(entry?.item.projectId).toBe(0);
    expect(entry?.item.kind).toBe("image_edit");
    expect(entry?.item.previewUrl).toBe("data:image/png;base64,abc");
    expect(entry?.item.itemKey).toBe("live:image_edit:job:scratch-image-edit-job");
  });

  it("exports distinct AI photo asset ids for multiple edited segments", async () => {
    const firstOriginalAsset = createMediaAsset(3542, {
      mediaType: "video",
      sourceKind: "stock",
    });
    const secondOriginalAsset = createMediaAsset(3543, {
      mediaType: "video",
      sourceKind: "stock",
    });
    const firstSegment = createDraftSegment({
      aiPhotoAsset: {
        assetId: 3551,
        fileName: "segment-ai-photo-1.png",
        fileSize: 0,
        mimeType: "image/png",
        remoteUrl: "/api/workspace/media-assets/3551",
      },
      currentAsset: firstOriginalAsset,
      currentPreviewUrl: "/api/workspace/media-assets/3542",
      currentSourceKind: "stock",
      index: 0,
      originalAsset: firstOriginalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/3542",
      originalSourceKind: "stock",
      text: "First segment",
      videoAction: "ai_photo",
    });
    const secondSegment = createDraftSegment({
      aiPhotoAsset: {
        assetId: 3553,
        fileName: "segment-ai-photo-2.png",
        fileSize: 0,
        mimeType: "image/png",
        remoteUrl: "/api/workspace/media-assets/3553",
      },
      currentAsset: secondOriginalAsset,
      currentPreviewUrl: "/api/workspace/media-assets/3543",
      currentSourceKind: "stock",
      index: 1,
      originalAsset: secondOriginalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/3543",
      originalSourceKind: "stock",
      text: "Second segment",
      videoAction: "ai_photo",
    });

    const result = await buildWorkspaceSegmentEditorPayload(
      {
        ...createDraftSession(firstSegment),
        segments: [firstSegment, secondSegment],
      },
      { language: "ru" },
    );

    expect(result.payload.segments.map((segment) => segment.customVideoAssetId)).toEqual([3551, 3553]);
    expect(result.payload.segments.map((segment) => segment.videoAction)).toEqual(["custom", "custom"]);
  });

  it("keeps the original visual when AI photo asset is still the original visual", async () => {
    const stockAsset = createMediaAsset(3543, {
      mediaType: "video",
      sourceKind: "stock",
    });
    const staleSegment = createDraftSegment({
      aiPhotoAsset: {
        assetId: 3543,
        fileName: "old-stock.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/3543",
      },
      currentAsset: stockAsset,
      currentPreviewUrl: "/api/workspace/media-assets/3543",
      currentSourceKind: "stock",
      originalAsset: stockAsset,
      originalPreviewUrl: "/api/workspace/media-assets/3543",
      originalSourceKind: "stock",
      videoAction: "ai_photo",
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(staleSegment), { language: "ru" });

    expect(result.payload.segments[0]?.videoAction).toBe("original");
    expect(result.payload.segments[0]?.customVideoAssetId).toBeUndefined();
  });

  it("keeps the original visual when custom media matches the original segment media", async () => {
    const originalAsset = createMediaAsset(101, {
      kind: "segment_original",
      mediaType: "video",
      role: "segment_original",
      sourceKind: "stock",
    });
    const currentAsset = createMediaAsset(303, {
      kind: "source_ai_video",
      mediaType: "video",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const segment = createDraftSegment({
      currentAsset,
      currentPreviewUrl: "/api/workspace/media-assets/303",
      currentSourceKind: "ai_generated",
      customVideo: {
        assetId: 101,
        fileName: "original-stock.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/101",
        source: "media-library",
      },
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      text: "Updated voice text",
      videoAction: "custom",
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]?.videoAction).toBe("original");
    expect(result.payload.segments[0]?.customVideoAssetId).toBeUndefined();
  });

  it("keeps the existing visual when custom media already matches the current segment media", async () => {
    const originalAsset = createMediaAsset(101, {
      kind: "segment_original",
      mediaType: "photo",
      role: "segment_original",
      sourceKind: "stock",
    });
    const currentAsset = createMediaAsset(303, {
      kind: "source_ai_image",
      mediaType: "photo",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const segment = createDraftSegment({
      currentAsset,
      currentPreviewUrl: "/api/workspace/media-assets/303",
      currentSourceKind: "ai_generated",
      customVideo: {
        assetId: 303,
        fileName: "applied-ai-photo.jpg",
        fileSize: 0,
        mimeType: "image/jpeg",
        remoteUrl: "/api/workspace/media-assets/303",
      },
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      text: "Updated text",
      videoAction: "custom",
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]?.videoAction).toBe("original");
    expect(result.payload.segments[0]?.customVideoAssetId).toBeUndefined();
  });

  it("keeps an already-applied talking photo as talking photo for export", async () => {
    const originalAsset = createMediaAsset(101, {
      mediaType: "photo",
      sourceKind: "stock",
    });
    const currentAsset = createMediaAsset(303, {
      kind: "talking_photo",
      mediaType: "video",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const segment = createDraftSegment({
      aiVideoAsset: {
        assetId: 303,
        durationSeconds: 3.4,
        fileName: "talking-photo.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/segment-talking-photo/jobs/test-job-303/video",
      },
      aiVideoGeneratedFromPrompt: "Говорящий персонаж",
      aiVideoGeneratedMode: "talking_photo",
      aiVideoPrompt: "Говорящий персонаж",
      aiVideoPromptInitialized: true,
      currentAsset,
      currentPreviewUrl: "/api/workspace/media-assets/303",
      currentSourceKind: "ai_generated",
      duration: 3.4,
      durationMode: "manual",
      endTime: 3.4,
      manualDurationSeconds: 3.4,
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      text: "Попробуйте, это очень вкусно!",
      videoAction: "talking_photo",
      voiceType: "Boris",
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]).toMatchObject({
      customVideoAssetId: 303,
      videoAction: "talking_photo",
      voiceType: "none",
    });
  });

  it("keeps the original visual when talking photo asset is still the original visual", async () => {
    const originalAsset = createMediaAsset(101, {
      mediaType: "video",
      sourceKind: "stock",
    });
    const currentAsset = createMediaAsset(303, {
      kind: "source_ai_video",
      mediaType: "video",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const segment = createDraftSegment({
      aiVideoAsset: {
        assetId: 101,
        durationSeconds: 4,
        fileName: "original-stock.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/101/playback",
      },
      aiVideoGeneratedMode: "talking_photo",
      currentAsset,
      currentPlaybackUrl: "/api/workspace/media-assets/303/playback",
      currentPreviewUrl: "/api/workspace/media-assets/303/playback",
      currentSourceKind: "ai_generated",
      originalAsset,
      originalPlaybackUrl: "/api/workspace/media-assets/101/playback",
      originalPreviewUrl: "/api/workspace/media-assets/101/playback",
      originalSourceKind: "stock",
      text: "Updated voice text",
      videoAction: "talking_photo",
      voiceType: "Boris",
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]).toMatchObject({
      customVideoAssetId: undefined,
      videoAction: "original",
      voiceType: "Boris",
    });
  });

  it("keeps an already-applied AI photo when it matches the current segment media", async () => {
    const originalAsset = createMediaAsset(101, {
      mediaType: "photo",
      sourceKind: "stock",
    });
    const currentAsset = createMediaAsset(303, {
      kind: "source_ai_image",
      mediaType: "photo",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const segment = createDraftSegment({
      aiPhotoAsset: {
        assetId: 303,
        fileName: "applied-ai-photo.jpg",
        fileSize: 0,
        mimeType: "image/jpeg",
        remoteUrl: "/api/workspace/media-assets/303",
      },
      aiPhotoGeneratedFromPrompt: "new photo",
      aiPhotoPrompt: "new photo",
      aiPhotoPromptInitialized: true,
      currentAsset,
      currentPreviewUrl: "/api/workspace/media-assets/303",
      currentSourceKind: "ai_generated",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      videoAction: "ai_photo",
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]).toMatchObject({
      customVideoAssetId: undefined,
      videoAction: "original",
    });
  });

  it("keeps an already-applied image edit when it matches the current segment media", async () => {
    const originalAsset = createMediaAsset(101, {
      mediaType: "photo",
      sourceKind: "stock",
    });
    const currentAsset = createMediaAsset(404, {
      kind: "source_ai_image",
      mediaType: "photo",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const segment = createDraftSegment({
      currentAsset,
      currentPreviewUrl: "/api/workspace/media-assets/404",
      currentSourceKind: "ai_generated",
      imageEditAsset: {
        assetId: 404,
        fileName: "applied-image-edit.jpg",
        fileSize: 0,
        mimeType: "image/jpeg",
        remoteUrl: "/api/workspace/media-assets/404",
      },
      imageEditGeneratedFromPrompt: "extend background",
      imageEditPrompt: "extend background",
      imageEditPromptInitialized: true,
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      videoAction: "image_edit",
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]).toMatchObject({
      customVideoAssetId: undefined,
      videoAction: "original",
    });
  });

  it("keeps an already-applied AI video when it matches the current segment media", async () => {
    const originalAsset = createMediaAsset(101, {
      mediaType: "video",
      sourceKind: "stock",
    });
    const currentAsset = createMediaAsset(707, {
      mediaType: "video",
      sourceKind: "ai_generated",
    });
    const segment = createDraftSegment({
      aiVideoAsset: {
        assetId: 707,
        fileName: "segment-ai-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/707/playback",
      },
      aiVideoGeneratedFromPrompt: "hearts",
      aiVideoGeneratedMode: "ai_video",
      aiVideoPrompt: "hearts",
      aiVideoPromptInitialized: true,
      currentAsset,
      currentPlaybackUrl: "/api/workspace/media-assets/707/playback",
      currentPreviewUrl: "/api/workspace/media-assets/707/playback",
      currentSourceKind: "ai_generated",
      originalAsset,
      originalPlaybackUrl: "/api/workspace/media-assets/101/playback",
      originalPreviewUrl: "/api/workspace/media-assets/101/playback",
      originalSourceKind: "stock",
      videoAction: "ai",
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]).toMatchObject({
      customVideoAssetId: undefined,
      videoAction: "original",
    });
  });

  it("keeps an explicit AI video action ahead of stale photo animation asset metadata", () => {
    const staleAnimationAsset = {
      ...createMediaAsset(7001, {
        mediaType: "video",
        sourceKind: "ai_generated",
      }),
      libraryKind: "photo_animation",
    };
    const segment = createDraftSegment({
      aiVideoAsset: {
        assetId: 7002,
        fileName: "segment-ai-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/7002/playback",
      },
      aiVideoGeneratedMode: "ai_video",
      currentAsset: staleAnimationAsset,
      currentPlaybackUrl: "/api/workspace/media-assets/7001/playback",
      currentPreviewUrl: "/api/workspace/media-assets/7001/playback",
      mediaType: "video",
      videoAction: "ai",
    });

    expect(getWorkspaceSegmentLatestVisualAction(segment)).toBe("ai");
  });

  it("preserves an already-applied AI animation while adding scene sound", async () => {
    const originalAsset = createMediaAsset(3543, {
      mediaType: "photo",
      sourceKind: "stock",
    });
    const animationAsset = createMediaAsset(7001, {
      mediaType: "video",
      sourceKind: "ai_generated",
    });
    const segment = createDraftSegment({
      aiVideoAsset: {
        assetId: 7001,
        fileName: "segment-photo-animation.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/7001",
      },
      aiVideoGeneratedMode: "photo_animation",
      aiVideoGeneratedFromPrompt: "slow camera push",
      aiVideoPrompt: "slow camera push",
      aiVideoPromptInitialized: true,
      currentAsset: animationAsset,
      currentPreviewUrl: "/api/workspace/media-assets/7001",
      currentSourceKind: "ai_generated",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/3543",
      originalSourceKind: "stock",
      sceneSoundAsset: {
        assetId: 8801,
        fileName: "segment-scene-sound.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/8801",
      },
      videoAction: "photo_animation",
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]).toMatchObject({
      customVideoAssetId: undefined,
      sceneSoundAssetId: 8801,
      videoAction: "original",
    });
  });

  it("sends AdsFlow-shaped scene sound asset ids in the generation payload", async () => {
    const segment = createDraftSegment({
      sceneSoundAsset: {
        fileName: "segment-scene-sound.wav",
        fileSize: 0,
        media_asset_id: 9902,
        mimeType: "audio/wav",
        remote_url: "/api/workspace/media-assets/9902",
      } as NonNullable<DraftSegment["sceneSoundAsset"]>,
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]).toMatchObject({
      sceneSoundAssetId: 9902,
    });
  });

  it("uploads generated scene sound audio before building the generation payload when asset id is missing", async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: Array<{ body?: BodyInit | null; url: string }> = [];
    globalThis.fetch = (async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      fetchCalls.push({ body: init?.body ?? null, url });

      if (url === "/api/studio/segment-scene-sound/jobs/job-scene/audio") {
        return new Response(new Blob(["wav-data"], { type: "audio/wav" }), { status: 200 });
      }

      if (url === "/api/studio/media-upload/init") {
        return new Response(
          JSON.stringify({
            data: {
              asset: { id: 8803 },
              upload: { headers: {}, method: "PUT", url: "https://uploads.test/scene-sound" },
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        );
      }

      if (url === "https://uploads.test/scene-sound") {
        return new Response(null, { status: 200 });
      }

      if (url === "/api/studio/media-upload/complete") {
        return new Response(
          JSON.stringify({
            data: {
              asset: { id: 8803 },
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const segment = createDraftSegment({
        index: 1,
        sceneSoundAsset: {
          fileName: "segment-scene-sound.wav",
          fileSize: 0,
          mimeType: "audio/wav",
          remoteUrl: "/api/studio/segment-scene-sound/jobs/job-scene/audio",
        },
      });
      const scratchSession = {
        ...createDraftSession(segment),
        projectId: 0,
      };

      const result = await buildWorkspaceSegmentEditorPayload(scratchSession, { language: "ru" });

      expect(result.payload.segments[0]).toMatchObject({
        sceneSoundAssetId: 8803,
      });
      const initBody = JSON.parse(String(fetchCalls.find((call) => call.url === "/api/studio/media-upload/init")?.body));
      expect(initBody).toMatchObject({
        kind: "segment_sound",
        mediaType: "audio",
        role: "segment_sound",
      });
      expect(initBody.projectId).toBeUndefined();
      expect(initBody.segmentIndex).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps the latest AI photo visible while image edit is pending", () => {
    const segment = createDraftSegment({
      aiPhotoAsset: {
        assetId: 303,
        fileName: "segment-ai-photo.png",
        fileSize: 0,
        mimeType: "image/png",
        remoteUrl: "/api/workspace/media-assets/303",
      },
      aiPhotoGeneratedFromPrompt: "icy dragon",
      aiPhotoPrompt: "icy dragon",
      aiPhotoPromptInitialized: true,
      currentPreviewUrl: "/original.jpg",
      imageEditAsset: null,
      imageEditPrompt: "add glowing runes",
      imageEditPromptInitialized: true,
      originalPreviewUrl: "/original.jpg",
      videoAction: "image_edit",
    });

    expect(getWorkspaceSegmentDraftPreviewUrl(segment)).toBe("/api/workspace/media-assets/303");
    expect(getWorkspaceSegmentDraftPreviewFallbackUrls(segment, "image")[0]).toBe("/api/workspace/media-assets/303");
    expect(getWorkspaceSegmentResolvedMediaSurface(segment, "segment-carousel-card")).toMatchObject({
      displayUrl: "/api/workspace/media-assets/303",
      previewKind: "image",
    });
  });

  it("restores AI video playback from a fresh server session when a pending draft lost its local asset", () => {
    const originalAsset = createMediaAsset(101, {
      kind: "segment_original",
      mediaType: "photo",
      role: "segment_original",
      sourceKind: "stock",
    });
    const generatedVideoAsset = createMediaAsset(707, {
      kind: "segment_current",
      mediaType: "video",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const liveSegment = createDraftSegment({
      aiVideoGeneratedFromPrompt: "A futuristic city fly-through",
      aiVideoPrompt: "A futuristic city fly-through",
      aiVideoPromptInitialized: true,
      currentAsset: originalAsset,
      currentPreviewUrl: "/api/workspace/media-assets/101",
      currentSourceKind: "stock",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      videoAction: "ai",
    });
    const freshSegment = createDraftSegment({
      currentAsset: generatedVideoAsset,
      currentPlaybackUrl: "/api/workspace/media-assets/707/playback",
      currentPreviewUrl: "/api/workspace/media-assets/707/playback",
      currentSourceKind: "ai_generated",
      mediaType: "video",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      videoAction: "original",
    });

    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      createDraftSession(liveSegment),
      createFreshSession(freshSegment),
    );
    const refreshedSegment = refreshedDraft.segments[0];

    expect(refreshedSegment?.videoAction).toBe("ai");
    expect(refreshedSegment?.aiVideoGeneratedMode).toBe("ai_video");
    expect(refreshedSegment?.aiVideoAsset?.assetId).toBe(707);
    expect(refreshedSegment?.aiVideoAsset?.remoteUrl).toBe("/api/workspace/media-assets/707/playback");
    expect(getWorkspaceSegmentDraftVideoUrl(refreshedSegment!)).toBe("/api/workspace/media-assets/707/playback");
  });

  it("hydrates a completed talking photo from persisted media library when the pending job was lost", () => {
    const segment = createDraftSegment({
      aiVideoAsset: null,
      aiVideoGeneratedMode: null,
      aiVideoPrompt: "Эта история началась 1000 лет назад",
      aiVideoPromptInitialized: true,
      customVideo: null,
      text: "Эта история началась 1000 лет назад",
      videoAction: "custom",
    });
    const persistedTalkingPhotoItem = createMediaLibraryItem({
      assetId: 909,
      assetKind: "rendered_segment",
      assetMediaType: "video",
      createdAt: Date.now(),
      downloadName: "segment-talking-photo.mp4",
      itemKey: "persisted:talking-photo:909",
      kind: "talking_photo",
      previewKind: "video",
      previewPosterUrl: "/api/workspace/media-assets/909/poster",
      previewUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=0&source=current&delivery=playback",
      projectId: 77,
      segmentIndex: 0,
      source: "persisted",
    });

    const restoredDraft = hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary(
      createDraftSession(segment),
      buildWorkspaceGeneratedMediaLibraryEntriesFromMediaLibraryItems([persistedTalkingPhotoItem]),
    );
    const restoredSegment = restoredDraft?.segments[0];

    expect(restoredSegment?.videoAction).toBe("talking_photo");
    expect(restoredSegment?.aiVideoGeneratedMode).toBe("talking_photo");
    expect(restoredSegment?.aiVideoAsset?.assetId).toBe(909);
    expect(restoredSegment?.aiVideoAsset?.remoteUrl).toBe("/api/workspace/media-assets/909/playback");
    expect(getWorkspaceSegmentDraftVideoUrl(restoredSegment!)).toBe("/api/workspace/media-assets/909/playback");
  });

  it("applies draft and live media-library items by the visible preview url instead of stale asset ids", () => {
    const item = createMediaLibraryItem({
      assetId: 303,
      downloadUrl: "/api/workspace/media-assets/303",
      itemKey: "live:ai_photo:job:job-1",
      previewUrl: "/api/studio/segment-ai-photo/jobs/job-1/image",
      source: "live",
    });

    const customAsset = createStudioCustomVideoFileFromMediaLibraryItem(item);

    expect(getWorkspaceMediaLibraryItemRemoteUrl(item)).toBe("/api/studio/segment-ai-photo/jobs/job-1/image");
    expect(customAsset.assetId).toBeUndefined();
    expect(customAsset.libraryItemKey).toBe("live:ai_photo:job:job-1");
    expect(customAsset.remoteUrl).toBe("/api/studio/segment-ai-photo/jobs/job-1/image");
    expect(customAsset.source).toBe("media-library");
  });

  it("keeps durable asset ids for persisted media-library image and video items", () => {
    const imageItem = createMediaLibraryItem({
      assetId: 404,
      downloadName: "persisted-image.jpg",
      itemKey: "persisted:asset:404",
      previewUrl: "/stale-visible-url.jpg",
      source: "persisted",
    });
    const videoItem = createMediaLibraryItem({
      assetId: 505,
      assetMediaType: "video",
      downloadName: "persisted-video.mp4",
      itemKey: "persisted:asset:505",
      kind: "ai_video",
      previewKind: "video",
      previewPosterUrl: "/api/workspace/media-assets/505/poster",
      previewUrl: "/stale-visible-video.mp4",
      source: "persisted",
    });

    const imageAsset = createStudioCustomVideoFileFromMediaLibraryItem(imageItem);
    const videoAsset = createStudioCustomVideoFileFromMediaLibraryItem(videoItem);

    expect(getWorkspaceMediaLibraryItemRemoteUrl(imageItem)).toBe("/api/workspace/media-assets/404");
    expect(imageAsset.assetId).toBe(404);
    expect(imageAsset.remoteUrl).toBe("/api/workspace/media-assets/404");
    expect(getWorkspaceMediaLibraryItemRemoteUrl(videoItem)).toBe("/api/workspace/media-assets/505/playback");
    expect(videoAsset.assetId).toBe(505);
    expect(videoAsset.posterUrl).toBe("/api/workspace/media-assets/505/poster");
    expect(videoAsset.remoteUrl).toBe("/api/workspace/media-assets/505/playback");
  });

  it("does not fall back to previous segment media for media-library custom images", () => {
    const customAsset = createStudioCustomVideoFileFromMediaLibraryItem(createMediaLibraryItem({
      assetId: 303,
      itemKey: "live:ai_photo:job:job-1",
      previewUrl: "/api/studio/segment-ai-photo/jobs/job-1/image",
      source: "live",
    }));
    const segment = createDraftSegment({
      currentPreviewUrl: "/old-current.jpg",
      customVideo: customAsset,
      originalPreviewUrl: "/old-original.jpg",
      visualReset: true,
      videoAction: "custom",
    });

    expect(getWorkspaceSegmentDraftPreviewUrl(segment)).toBe("/api/studio/segment-ai-photo/jobs/job-1/image");
    expect(getWorkspaceSegmentDraftPreviewFallbackUrls(segment, "image")).toEqual([
      "/api/studio/segment-ai-photo/jobs/job-1/image",
    ]);
  });

  it("does not play previous segment media for media-library custom videos", () => {
    const customAsset = createStudioCustomVideoFileFromMediaLibraryItem(createMediaLibraryItem({
      assetId: 909,
      assetMediaType: "video",
      downloadName: "library-animation.mp4",
      itemKey: "persisted:asset:909",
      kind: "photo_animation",
      previewKind: "video",
      previewPosterUrl: "/api/workspace/media-assets/909/poster",
      previewUrl: "/api/workspace/media-assets/909/playback",
      source: "persisted",
    }));
    const segment = createDraftSegment({
      currentPlaybackUrl: "/old-current.mp4",
      currentPreviewUrl: "/old-current.jpg",
      customVideo: customAsset,
      mediaType: "video",
      originalPlaybackUrl: "/old-original.mp4",
      originalPreviewUrl: "/old-original.jpg",
      visualReset: true,
      videoAction: "custom",
    });

    expect(getWorkspaceSegmentDraftVideoUrl(segment)).toBe("/api/workspace/media-assets/909/playback");
    expect(getWorkspaceSegmentDraftPosterUrl(segment)).toBe("/api/workspace/media-assets/909/poster");
    expect(getWorkspaceSegmentDraftPreviewFallbackUrls(segment, "video")).toEqual([
      "/api/workspace/media-assets/909/playback",
    ]);
  });

  it("uses durable playback media for generated carousel videos when playback is requested", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        assetId: 1692,
        fileName: "talking-photo.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        posterUrl: "/api/workspace/media-assets/1692/poster?v=current",
        remoteUrl: "/api/workspace/project-segment-video?projectId=3203&segmentIndex=1&source=current&delivery=preview&v=ready",
      },
      aiVideoGeneratedMode: "talking_photo",
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=3203&segmentIndex=1&source=current&delivery=playback&v=ready",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=3203&segmentIndex=1&source=current&delivery=preview&v=ready",
      mediaType: "video",
      videoAction: "talking_photo",
    });

    const idleSurface = getWorkspaceSegmentResolvedMediaSurface(segment, "segment-carousel-card", {
      isPlaybackRequested: false,
    });
    const playbackSurface = getWorkspaceSegmentResolvedMediaSurface(segment, "segment-carousel-card", {
      isPlaybackRequested: true,
    });

    expect(idleSurface.displayUrl).toContain("delivery=preview");
    expect(playbackSurface.displayUrl).toBe("/api/workspace/media-assets/1692/playback");
    expect(playbackSurface.viewerUrl).toBe("/api/workspace/media-assets/1692/playback");
    expect(playbackSurface.preloadPolicy).toBe("auto");
  });

  it("derives a stable poster for talking photo video assets without explicit poster urls", () => {
    const segment = createDraftSegment({
      aiVideoAsset: {
        assetId: 6067,
        fileName: "talking-photo.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/6067/playback",
      },
      aiVideoGeneratedMode: "talking_photo",
      mediaType: "video",
      videoAction: "talking_photo",
    });

    const idleSurface = getWorkspaceSegmentResolvedMediaSurface(segment, "segment-carousel-card", {
      isPlaybackRequested: false,
    });

    expect(getWorkspaceSegmentDraftPosterUrl(segment)).toBe("/api/workspace/media-assets/6067/poster");
    expect(idleSurface.posterUrl).toBe("/api/workspace/media-assets/6067/poster");
    expect(idleSurface.mountVideoWhenIdle).toBe(false);
    expect(idleSurface.preloadPolicy).toBe("none");
  });

  it("rewrites project segment preview delivery for playback-only custom videos", () => {
    const segment = createDraftSegment({
      customVideo: {
        fileName: "segment-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/project-segment-video?projectId=3753&segmentIndex=2&source=current&delivery=preview&v=clip",
      },
      mediaType: "video",
      videoAction: "custom",
    });

    const playbackSurface = getWorkspaceSegmentResolvedMediaSurface(segment, "segment-carousel-card", {
      isPlaybackRequested: true,
    });

    expect(playbackSurface.displayUrl).toBe(
      "/api/workspace/project-segment-video?projectId=3753&segmentIndex=2&source=current&delivery=playback&v=clip",
    );
    expect(playbackSurface.viewerUrl).toBe(playbackSurface.displayUrl);
  });

  it("uses server-provided posters for video segment previews", () => {
    const segment = createDraftSegment({
      currentAsset: createMediaAsset(707, { mediaType: "video", role: "segment_current" }),
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=0&source=current&delivery=playback",
      currentPosterUrl: "/api/workspace/media-assets/707/poster?v=current",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=0&source=current&delivery=preview",
      mediaType: "video",
      originalAsset: createMediaAsset(101, { mediaType: "video", role: "segment_original" }),
      originalPlaybackUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=0&source=original&delivery=playback",
      originalPosterUrl: "/api/workspace/media-assets/101/poster?v=original",
      originalPreviewUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=0&source=original&delivery=preview",
    });

    expect(getWorkspaceSegmentDraftPreviewUrl(segment)).toContain("/api/workspace/project-segment-video");
    expect(getWorkspaceSegmentDraftPosterUrl(segment)).toBe("/api/workspace/media-assets/101/poster?v=original");
  });

  it("ignores stale full-video posters and derives scoped posters for timeline fallback previews", () => {
    const segment = createDraftSegment({
      currentAsset: createMediaAsset(2405, {
        kind: "final_video",
        mediaType: "video",
        role: "final_video",
      }),
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=3311&segmentIndex=4&source=current&delivery=playback",
      currentPosterUrl: "/api/workspace/media-assets/2405/poster?v=stale-first-frame",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=3311&segmentIndex=4&source=current&delivery=preview",
      mediaType: "video",
      originalAsset: createMediaAsset(2405, {
        kind: "final_video",
        mediaType: "video",
        role: "final_video",
      }),
      originalPlaybackUrl: "/api/workspace/project-segment-video?projectId=3311&segmentIndex=4&source=original&delivery=playback",
      originalPosterUrl: "/api/workspace/media-assets/2405/poster?v=stale-first-frame",
      originalPreviewUrl: "/api/workspace/project-segment-video?projectId=3311&segmentIndex=4&source=original&delivery=preview",
    });

    expect(getWorkspaceSegmentDraftPosterUrl(segment)).toBe(
      "/api/workspace/project-segment-poster?projectId=3311&segmentIndex=4&source=original",
    );

    const surface = getWorkspaceSegmentResolvedMediaSurface(segment, "segment-thumb");

    expect(surface.posterUrl).toBe(
      "/api/workspace/project-segment-poster?projectId=3311&segmentIndex=4&source=original",
    );
    expect(surface.displayUrl).toBe(segment.originalPlaybackUrl);
    expect(surface.mountVideoWhenIdle).toBe(false);
  });

  it("uses segment-scoped posters for timeline fallback segment previews", () => {
    const segment = createDraftSegment({
      currentAsset: createMediaAsset(2405, {
        kind: "final_video",
        mediaType: "video",
        role: "final_video",
      }),
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=3311&segmentIndex=4&source=current&delivery=playback",
      currentPosterUrl: "/api/workspace/project-segment-poster?projectId=3311&segmentIndex=4&source=current&v=segment",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=3311&segmentIndex=4&source=current&delivery=preview",
      mediaType: "video",
      originalAsset: createMediaAsset(2405, {
        kind: "final_video",
        mediaType: "video",
        role: "final_video",
      }),
      originalPlaybackUrl: "/api/workspace/project-segment-video?projectId=3311&segmentIndex=4&source=original&delivery=playback",
      originalPosterUrl: "/api/workspace/project-segment-poster?projectId=3311&segmentIndex=4&source=original&v=segment",
      originalPreviewUrl: "/api/workspace/project-segment-video?projectId=3311&segmentIndex=4&source=original&delivery=preview",
    });

    expect(getWorkspaceSegmentDraftPosterUrl(segment)).toContain("/api/workspace/project-segment-poster");

    const surface = getWorkspaceSegmentResolvedMediaSurface(segment, "segment-thumb");

    expect(surface.posterUrl).toBe(segment.originalPosterUrl);
    expect(surface.displayUrl).toBe(segment.originalPlaybackUrl);
  });

  it("does not use a video asset proxy as a still poster for server photo animations", () => {
    const segment = createDraftSegment({
      currentAsset: createMediaAsset(1692, {
        kind: "rendered_segment",
        mediaType: "video",
        role: "rendered_segment",
        sourceKind: "ai_generated",
      }),
      currentExternalPlaybackUrl: "/api/workspace/media-assets/1692",
      currentExternalPreviewUrl: "/api/workspace/media-assets/1692",
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=3203&segmentIndex=0&source=current&delivery=playback",
      currentPosterUrl: "/api/workspace/media-assets/1692/poster?v=current",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=3203&segmentIndex=0&source=current&delivery=preview",
      mediaType: "video",
      originalAsset: createMediaAsset(1632, {
        kind: "source_ai_image",
        mediaType: "photo",
        role: "source_ai_image",
        sourceKind: "ai_generated",
      }),
      originalExternalPlaybackUrl: "/api/workspace/media-assets/1632",
      originalExternalPreviewUrl: "/api/workspace/media-assets/1632",
      originalPreviewUrl: "/api/workspace/project-segment-video?projectId=3203&segmentIndex=0&source=original&delivery=preview",
      videoAction: "original",
    });

    expect(getWorkspaceSegmentDraftPreviewUrl(segment)).toBe("/api/workspace/media-assets/1632");
    expect(getWorkspaceSegmentDraftPosterUrl(segment)).toBe("/api/workspace/media-assets/1632");

    const surface = getWorkspaceSegmentResolvedMediaSurface(segment, "segment-carousel-card", {
      isPlaybackRequested: false,
    });

    expect(surface.previewKind).toBe("video");
    expect(surface.displayUrl).toBe(segment.currentPlaybackUrl);
    expect(surface.viewerUrl).toBe(segment.currentPlaybackUrl);
    expect(surface.posterUrl).toBe("/api/workspace/media-assets/1632");
  });

  it("changes segment media identity when only the media-library item key changes", () => {
    const firstSegment = createDraftSegment({
      customVideo: {
        fileName: "library-image.jpg",
        fileSize: 0,
        libraryItemKey: "live:ai_photo:job:first",
        mimeType: "image/jpeg",
        remoteUrl: "/api/studio/segment-ai-photo/jobs/same/image",
        source: "media-library",
      },
      videoAction: "custom",
    });
    const secondSegment = createDraftSegment({
      customVideo: {
        ...firstSegment.customVideo!,
        libraryItemKey: "live:ai_photo:job:second",
      },
      videoAction: "custom",
    });

    expect(getWorkspaceSegmentMediaIdentityKey(firstSegment)).not.toBe(getWorkspaceSegmentMediaIdentityKey(secondSegment));
  });

  it("queues playback by default when activating another carousel segment", () => {
    const segments = [{ index: 0 }, { index: 7 }, { index: 12 }];

    expect(resolveWorkspaceSegmentActivationPlaybackIndex(segments, 1)).toBe(1);
    expect(resolveWorkspaceSegmentActivationPlaybackIndex(segments, 2)).toBe(2);
  });

  it("allows silent carousel activation when pending playback is explicitly disabled", () => {
    const segments = [{ index: 0 }, { index: 7 }];

    expect(resolveWorkspaceSegmentActivationPlaybackIndex(segments, 1, { pendingPlaybackIndex: null })).toBeNull();
    expect(resolveWorkspaceSegmentActivationPlaybackIndex(segments, 1, { pendingPlaybackIndex: 42 })).toBe(42);
  });

  it("blocks segment preview video playback when the surface is not allowed to play", () => {
    expect(
      shouldAllowWorkspaceSegmentPreviewVideoPlayback({
        allowVideoPlayback: false,
        isPlaybackRequested: true,
        previewKind: "video",
      }),
    ).toBe(false);
    expect(
      shouldAllowWorkspaceSegmentPreviewVideoPlayback({
        allowVideoPlayback: true,
        isPlaybackRequested: true,
        previewKind: "video",
      }),
    ).toBe(true);
    expect(
      shouldAllowWorkspaceSegmentPreviewVideoPlayback({
        allowVideoPlayback: true,
        isPlaybackRequested: true,
        previewKind: "image",
      }),
    ).toBe(false);
  });

  it("keeps media library loading visible while media is still resolving", () => {
    expect(
      shouldShowWorkspaceMediaLibraryLoadingState({
        displayTotalCount: null,
        hasError: false,
        hasNextCursor: false,
        hasVisibleItems: false,
        isLoading: true,
        isLoadingMore: false,
      }),
    ).toBe(true);
    expect(
      shouldShowWorkspaceMediaLibraryLoadingState({
        displayTotalCount: 12,
        hasError: false,
        hasNextCursor: true,
        hasVisibleItems: true,
        isLoading: true,
        isLoadingMore: false,
      }),
    ).toBe(true);
    expect(
      shouldShowWorkspaceMediaLibraryLoadingState({
        displayTotalCount: 12,
        hasError: false,
        hasNextCursor: true,
        hasVisibleItems: false,
        isLoading: true,
        isLoadingMore: true,
      }),
    ).toBe(true);
  });

  it("does not show media library loading after load completion or errors", () => {
    expect(
      shouldShowWorkspaceMediaLibraryLoadingState({
        displayTotalCount: 0,
        hasError: false,
        hasNextCursor: false,
        hasVisibleItems: false,
        isLoading: false,
        isLoadingMore: false,
      }),
    ).toBe(false);
    expect(
      shouldShowWorkspaceMediaLibraryLoadingState({
        displayTotalCount: null,
        hasError: true,
        hasNextCursor: true,
        hasVisibleItems: false,
        isLoading: true,
        isLoadingMore: true,
      }),
    ).toBe(false);
  });

  it("resets a media-library replacement back to the original visual", () => {
    const originalAsset = createMediaAsset(101);
    const mediaLibraryAsset = createStudioCustomVideoFileFromMediaLibraryItem(createMediaLibraryItem({
      itemKey: "live:ai_photo:job:job-1",
      previewUrl: "/api/studio/segment-ai-photo/jobs/job-1/image",
      source: "live",
    }));
    const segment = createDraftSegment({
      currentAsset: originalAsset,
      currentPreviewUrl: "/api/workspace/media-assets/101",
      currentSourceKind: "ai_generated",
      customVideo: mediaLibraryAsset,
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "ai_generated",
      videoAction: "custom",
    });

    const resetSegment = resetWorkspaceSegmentDraftVisualToOriginal(segment, 77);

    expect(resetSegment.customVideo).toBeNull();
    expect(resetSegment.aiPhotoAsset).toBeNull();
    expect(resetSegment.aiVideoAsset).toBeNull();
    expect(resetSegment.imageEditAsset).toBeNull();
    expect(resetSegment.videoAction).toBe("original");
    expect(getWorkspaceSegmentDraftPreviewUrl(resetSegment)).toBe("/api/workspace/media-assets/101");
  });

  it("keeps the original AI visual type visible after resetting a replacement", () => {
    const originalPhotoAsset = createMediaAsset(101, {
      mediaType: "photo",
      sourceKind: "ai_generated",
    });
    const mediaLibraryAsset = createStudioCustomVideoFileFromMediaLibraryItem(createMediaLibraryItem({
      itemKey: "live:ai_photo:job:job-1",
      previewUrl: "/api/studio/segment-ai-photo/jobs/job-1/image",
      source: "live",
    }));
    const segment = createDraftSegment({
      currentAsset: originalPhotoAsset,
      currentPreviewUrl: "/api/workspace/media-assets/101",
      currentSourceKind: "ai_generated",
      customVideo: mediaLibraryAsset,
      originalAsset: originalPhotoAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "ai_generated",
      videoAction: "custom",
    });

    const resetSegment = resetWorkspaceSegmentDraftVisualToOriginal(segment, 77);

    expect(getWorkspaceSegmentDraftSourceLabel(resetSegment)).toBe("ИИ фото");
    expect(getWorkspaceSegmentDraftSourceDisplayLabel(getWorkspaceSegmentDraftSourceLabel(resetSegment), "en")).toBe("AI photo");
  });

  it("shows stock only when the persisted media source is actually known", () => {
    const stockSegment = createDraftSegment({
      currentSourceKind: "stock",
      mediaType: "photo",
      originalSourceKind: "stock",
    });
    const unknownSegment = createDraftSegment({
      currentSourceKind: "unknown",
      originalSourceKind: "unknown",
    });

    expect(getWorkspaceSegmentDraftSourceLabel(stockSegment)).toBe("Сток");
    expect(getWorkspaceSegmentDraftSourceDisplayLabel(getWorkspaceSegmentDraftSourceLabel(stockSegment), "en")).toBe("Stock");
    expect(getWorkspaceSegmentDraftSourceLabel(unknownSegment)).toBe("");
  });

  it("keeps an applied AI photo reset as a pending segment change", () => {
    const originalAsset = createMediaAsset(101, {
      mediaType: "photo",
      sourceKind: "stock",
    });
    const generatedAsset = createMediaAsset(303, {
      kind: "source_ai_image",
      mediaType: "photo",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const appliedSegment = createDraftSegment({
      currentAsset: generatedAsset,
      currentPreviewUrl: "/api/workspace/media-assets/303",
      currentSourceKind: "ai_generated",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      videoAction: "original",
    });

    const resetSegment = resetWorkspaceSegmentDraftVisualToOriginal(appliedSegment, 77);
    const checklist = buildWorkspaceSegmentEditorChangeChecklist(
      createDraftSession(resetSegment),
      createDraftSession(appliedSegment),
    );

    expect(getWorkspaceSegmentDraftPreviewUrl(resetSegment)).toBe("/api/workspace/media-assets/101");
    expect(isWorkspaceSegmentDraftVisualResettable(resetSegment)).toBe(false);
    expect(isWorkspaceSegmentDraftVisualChangedFromBaseline(resetSegment, appliedSegment)).toBe(false);
    expect(getWorkspaceSegmentDraftVisualStatus(resetSegment, appliedSegment)).toBe("reset");
    expect(checklist).toEqual([
      expect.objectContaining({
        label: "Сегмент 1: сброшен визуал",
        resetVisual: false,
        restoreVisual: true,
        segmentIndex: 0,
      }),
    ]);
  });

  it("compares reset-all visual changes with the original source visual", () => {
    const originalAsset = createMediaAsset(101, {
      mediaType: "photo",
      sourceKind: "stock",
    });
    const generatedAsset = createMediaAsset(303, {
      kind: "source_ai_image",
      mediaType: "photo",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const appliedSegment = createDraftSegment({
      currentAsset: generatedAsset,
      currentPreviewUrl: "/api/workspace/media-assets/303",
      currentSourceKind: "ai_generated",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      videoAction: "original",
    });
    const resetSegment = resetWorkspaceSegmentDraftVisualToOriginal(appliedSegment, 77);
    const resetTarget = createWorkspaceSegmentEditorResetDraftFromBaseline(
      createDraftSession(resetSegment),
      createDraftSession(appliedSegment),
    );

    expect(buildWorkspaceSegmentEditorChangeChecklist(createDraftSession(resetSegment), resetTarget)).toEqual([]);
    expect(buildWorkspaceSegmentEditorChangeChecklist(createDraftSession(appliedSegment), resetTarget)).toEqual([
      expect.objectContaining({
        label: "Сегмент 1: обновлен визуал",
        resetVisual: true,
        restoreVisual: false,
        segmentIndex: 0,
      }),
    ]);
  });

  it("keeps a reset visual after refreshing the live draft from the server", () => {
    const originalAsset = createMediaAsset(101, {
      mediaType: "photo",
      sourceKind: "stock",
    });
    const generatedAsset = createMediaAsset(303, {
      kind: "source_ai_video",
      mediaType: "video",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const appliedSegment = createDraftSegment({
      currentAsset: generatedAsset,
      currentPlaybackUrl: "/api/workspace/media-assets/303/playback",
      currentPreviewUrl: "/api/workspace/media-assets/303",
      currentSourceKind: "ai_generated",
      mediaType: "video",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      videoAction: "original",
    });
    const resetSegment = resetWorkspaceSegmentDraftVisualToOriginal(appliedSegment, 77);
    const refreshedDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      createDraftSession(resetSegment),
      createFreshSession(appliedSegment),
    );
    const refreshedSegment = refreshedDraft.segments[0]!;

    expect(refreshedSegment.visualReset).toBe(true);
    expect(refreshedSegment.mediaType).toBe("photo");
    expect(refreshedSegment.currentAsset?.assetId).toBe(101);
    expect(refreshedSegment.currentPreviewUrl).toBe("/api/workspace/media-assets/101");
    expect(getWorkspaceSegmentDraftPreviewUrl(refreshedSegment)).toBe("/api/workspace/media-assets/101");
    expect(getWorkspaceSegmentDraftVisualStatus(refreshedSegment, appliedSegment)).toBe("reset");
  });

  it("shows visual reset restore on the forward arrow even after redo state is gone", () => {
    const originalAsset = createMediaAsset(101, {
      kind: "source_ai_image",
      mediaType: "photo",
      role: "segment_original",
      sourceKind: "ai_generated",
    });
    const talkingPhotoAsset = {
      ...createMediaAsset(7339, {
        kind: "rendered_segment",
        mediaType: "video",
        role: "segment_current",
        sourceKind: "ai_generated",
      }),
      libraryKind: "talking_photo",
    };
    const talkingPhotoSegment = createDraftSegment({
      aiVideoGeneratedMode: "talking_photo",
      currentAsset: talkingPhotoAsset,
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=4064&segmentIndex=0&source=current",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=4064&segmentIndex=0&source=current&delivery=preview",
      currentSourceKind: "ai_generated",
      mediaType: "video",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "ai_generated",
      videoAction: "talking_photo",
    });
    const resetSegment = resetWorkspaceSegmentDraftVisualToOriginal(talkingPhotoSegment, 4064);

    expect(getWorkspaceSegmentDraftVisualStatus(resetSegment, talkingPhotoSegment)).toBe("reset");
    expect(getWorkspaceSegmentDraftPreviewUrl(resetSegment)).toBe("/api/workspace/media-assets/101");
    expect(getWorkspaceSegmentVisualTimelineHistoryState(resetSegment, talkingPhotoSegment, false)).toEqual({
      canBack: false,
      canForward: true,
    });
  });

  it("does not keep a draft-only AI photo undo as a pending segment change", () => {
    const originalAsset = createMediaAsset(101, {
      mediaType: "photo",
      sourceKind: "stock",
    });
    const baselineSegment = createDraftSegment({
      currentAsset: originalAsset,
      currentPreviewUrl: "/api/workspace/media-assets/101",
      currentSourceKind: "stock",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      videoAction: "original",
    });
    const draftAiPhotoSegment = createDraftSegment({
      ...baselineSegment,
      aiPhotoAsset: {
        assetId: 303,
        fileName: "segment-ai-photo-1.png",
        fileSize: 0,
        mimeType: "image/png",
        remoteUrl: "/api/workspace/media-assets/303",
      },
      videoAction: "ai_photo",
    });

    const resetSegment = resetWorkspaceSegmentDraftVisualToOriginal(draftAiPhotoSegment, 77);
    const checklist = buildWorkspaceSegmentEditorChangeChecklist(
      createDraftSession(resetSegment),
      createDraftSession(baselineSegment),
    );

    expect(getWorkspaceSegmentDraftPreviewUrl(resetSegment)).toBe("/api/workspace/media-assets/101");
    expect(isWorkspaceSegmentDraftVisualChangedFromBaseline(resetSegment, baselineSegment)).toBe(false);
    expect(getWorkspaceSegmentDraftVisualStatus(resetSegment, baselineSegment)).toBe("none");
    expect(checklist).toEqual([]);
  });

  it("preserves stored original visual references when a fresh server session collapses them into current", () => {
    const originalAsset = createMediaAsset(101);
    const generatedAsset = createMediaAsset(303, {
      kind: "source_ai_image",
      mediaType: "photo",
      role: "segment_current",
      sourceKind: "ai_generated",
    });
    const baselineSession = createFreshSession(createDraftSegment({
      currentAsset: originalAsset,
      currentPreviewUrl: "/api/workspace/media-assets/101",
      currentSourceKind: "ai_generated",
      originalAsset,
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "ai_generated",
    }));
    const collapsedFreshSession = createFreshSession(createDraftSegment({
      currentAsset: generatedAsset,
      currentPreviewUrl: "/api/workspace/media-assets/303",
      currentSourceKind: "ai_generated",
      originalAsset: generatedAsset,
      originalPreviewUrl: "/api/workspace/media-assets/303",
      originalSourceKind: "ai_generated",
    }));

    const preservedSession = preserveWorkspaceSegmentEditorOriginalVisualReferences(
      collapsedFreshSession,
      baselineSession,
    );

    expect(preservedSession.segments[0]?.currentAsset?.assetId).toBe(303);
    expect(preservedSession.segments[0]?.originalAsset?.assetId).toBe(101);
    expect(preservedSession.segments[0]?.originalPreviewUrl).toBe("/api/workspace/media-assets/101");
  });
});
