import { describe, expect, it } from "vitest";

import { DEFAULT_STUDIO_VOICE_ID } from "../../../shared/locales";
import { STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST } from "../../../shared/studio-credit-costs";
import {
  applyWorkspaceSegmentEditorBulkVoiceText,
  applyWorkspaceSegmentEditorJobResult,
  applyWorkspaceSegmentEditorGlobalSubtitleSelection,
  applyWorkspaceSegmentPendingInfographicTransforms,
  applyWorkspaceSegmentSceneSoundAsset,
  buildWorkspaceSegmentKnownVideoDurationPatch,
  applyWorkspaceSegmentEditorGlobalVoiceSelection,
  applyWorkspaceSegmentEditorGlobalVoiceToSegments,
  applyWorkspaceSegmentEditorSceneVoiceOverride,
  applyWorkspaceSegmentEditorSceneVoiceSelection,
  getWorkspaceSegmentVoiceLanguage,
  getWorkspaceSegmentVoiceLanguageSelectionPatch,
  getWorkspaceSegmentEffectiveVoiceId,
  getWorkspaceSegmentEffectiveSubtitleSettings,
  getWorkspaceSegmentKnownVisualDurationSeconds,
  getWorkspaceSegmentLatestVisualAction,
  getWorkspaceSegmentDurationExtensionPlan,
  getWorkspaceSegmentEditorProjectVoiceType,
  getWorkspaceSegmentEditorGenerationRequiredCredits,
  getWorkspaceSegmentEditorBulkSceneSoundCreditCost,
  getWorkspaceSegmentSceneSoundSelectionSyncKey,
  getWorkspaceSegmentEditorVisibleTimelineDisplayRange,
  getWorkspaceSegmentEmbeddedVisualSoundAsset,
  getWorkspaceSegmentEstimatedVoiceoverLabelDurationSeconds,
  getStudioSceneSoundAssetPreviewUrl,
  hasWorkspaceSegmentEditorUnreflectedLiveGeneratedVideo,
  getWorkspaceSegmentPreviewKind,
  getWorkspaceSegmentSelectedVisualPreviewKind,
  getWorkspaceSegmentVoiceoverAudioPreviewSource,
  getWorkspaceSegmentVoiceoverPreviewRange,
  getWorkspaceSegmentTimelineVoiceoverDurationInfo,
  getWorkspaceSegmentVisualAudioDurationMismatchInfo,
  getStudioSceneSoundAssetPreviewMediaKind,
  hasWorkspaceSegmentProjectVoiceoverTimingData,
  canWorkspaceSegmentUseVideoExtensionTool,
  isWorkspaceTalkingPhotoMediaAsset,
  isWorkspaceSegmentProjectTimelineVoiceoverAvailable,
  isWorkspaceSegmentCachedLanguageTextUsable,
  isWorkspaceSegmentStaleFinalizedVoiceTrim,
  isWorkspaceSegmentStaleMeasuredRenderedPhotoDuration,
  isWorkspaceSegmentVoiceoverPlaybackFresh,
  invalidateWorkspaceSegmentSceneSoundForVisualChange,
  createWorkspaceSegmentSceneSoundAsset,
  createWorkspaceSegmentTimelineSoundAsset,
  createWorkspaceSegmentEditorInsertedSegment,
  createWorkspaceSegmentEditorDraftSession,
  createWorkspaceSegmentEditorScratchDraftSession,
  clearWorkspaceSegmentEditorVoiceoverGenerationState,
  ensureWorkspaceSegmentEditorDraftId,
  getWorkspaceSegmentEditorDraftId,
  isWorkspaceSegmentEditorJobTargetDraft,
  normalizeLegacyWorkspaceSegmentEditorDraftSession,
  rebuildWorkspaceSegmentEditorDraftSessionTimeline,
  repairWorkspaceSegmentEditorSpeechWordBoundaries,
  refreshWorkspaceSegmentEditorDraftWithFreshSession,
  restoreWorkspaceSegmentStaleMeasuredRenderedPhotoDuration,
  doesWorkspaceSegmentEditorDraftReflectFreshVoiceoverAssets,
  restoreWorkspaceSegmentEditorDraftProjectTtsAsset,
  restoreWorkspaceSegmentEffectiveVoiceFromBaseline,
  restoreWorkspaceSegmentSceneSoundState,
  resetWorkspaceSegmentDraftVisualToOriginal,
  resolveWorkspaceSegmentEditorSegmentsAfterDelete,
  resolveWorkspaceSegmentSceneSoundPrompt,
  resolveWorkspaceGeneratedVideoAudioIntent,
  resolveWorkspaceSegmentBoundaryTiming,
  resolveWorkspaceSegmentVideoExtensionMenuSourceDurationSeconds,
  pushWorkspaceSegmentTimelineVisualHistorySnapshot,
  restoreWorkspaceSegmentTimelineSnapshot,
  restoreWorkspaceSegmentVoiceTextDraftSnapshot,
  shouldAutoTrimWorkspaceSegmentVideoToVoiceover,
  shouldIgnoreWorkspaceSegmentMeasuredVoiceoverDuration,
  stepWorkspaceSegmentTimelineVisualHistoryBack,
  stepWorkspaceSegmentTimelineVisualHistoryForward,
  syncWorkspaceSegmentMeasuredVideoVisualDuration,
  waitForWorkspaceSegmentSceneSoundSelectionSync,
} from "./workspace-segment-editor";
import {
  applyWorkspaceSegmentSceneSoundVisualAssetId,
  canWorkspaceSegmentCreateInfographic,
  getWorkspaceSegmentCurrentVideoSourceAsset,
  getWorkspaceSegmentInfographicSourceAsset,
  getWorkspaceSegmentInfographicSourceIdentity,
  getWorkspaceSegmentSceneReferenceVideoAssetId,
  getWorkspaceSegmentSceneSoundVisualAssetId,
  isWorkspaceSegmentInfographicJobSourceCurrent,
  isWorkspaceSegmentReadyVisualSelectionTab,
} from "./workspace-segment-visual-helpers";
import {
  canReuseWorkspaceSegmentProjectTimelineVoiceover,
  getWorkspaceSegmentDraftVisualHistoryIdentity,
} from "./workspace-segment-editor-checklist";
import { normalizeStoredWorkspaceSegmentEditorDraftSession } from "./workspace-segment-editor-storage";
import type {
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentEditorDraftSession,
} from "./workspace-types";
import { getWorkspaceSegmentVoiceoverTextHash } from "./workspace-utils";
import { hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary } from "./workspace-media-library-helpers";

describe("resolveWorkspaceSegmentSceneSoundPrompt", () => {
  it("uses the ambient sound prompt when the optional description is empty", () => {
    expect(resolveWorkspaceSegmentSceneSoundPrompt("  ")).toBe(
      "Generate realistic synchronized sound effects and ambient audio.\nNo speech, no narration, no vocals, no background music.",
    );
  });

  it("keeps a user-provided sound description", () => {
    expect(resolveWorkspaceSegmentSceneSoundPrompt("  rain   on glass ")).toBe("rain on glass");
  });
});

describe("isWorkspaceSegmentCachedLanguageTextUsable", () => {
  it("rejects Russian source text that was incorrectly cached as English", () => {
    expect(
      isWorkspaceSegmentCachedLanguageTextUsable(
        "Представьте мир, где астероид пролетел мимо Земли.",
        "en",
        "Представьте мир, где астероид пролетел мимо Земли.",
      ),
    ).toBe(false);
  });

  it("accepts a translated English cache entry", () => {
    expect(
      isWorkspaceSegmentCachedLanguageTextUsable(
        "Imagine a world where the asteroid missed Earth.",
        "en",
        "Представьте мир, где астероид пролетел мимо Земли.",
      ),
    ).toBe(true);
  });

  it("accepts an English translation that preserves a Cyrillic proper name", () => {
    expect(
      isWorkspaceSegmentCachedLanguageTextUsable(
        "The story begins in Москва.",
        "en",
        "История начинается в Москве.",
      ),
    ).toBe(true);
  });
});

describe("getWorkspaceSegmentEditorBulkSceneSoundCreditCost", () => {
  it("sums two credits for every started five-second block in each scene", () => {
    expect(getWorkspaceSegmentEditorBulkSceneSoundCreditCost([4.5, 5, 5.1, 10, 10.1])).toBe(2 + 2 + 4 + 4 + 6);
  });

  it("returns zero when there are no scenes", () => {
    expect(getWorkspaceSegmentEditorBulkSceneSoundCreditCost([])).toBe(0);
  });
});

describe("scene sound removal intent", () => {
  it("does not mark an originally empty scene as explicitly removed", () => {
    const segment = createProjectVoiceoverSegment({
      index: 0,
      sceneSoundAsset: null,
      sceneSoundReset: true,
    });

    const restored = restoreWorkspaceSegmentSceneSoundState(segment, null);

    expect(restored.sceneSoundAsset).toBeNull();
    expect(restored.sceneSoundReset).toBe(false);
  });

  it("waits only for selection writes from the rendered project", async () => {
    const currentProjectSync = Promise.resolve();
    const otherProjectSync = new Promise<void>(() => undefined);
    const syncs = {
      [getWorkspaceSegmentSceneSoundSelectionSyncKey(42, 0)]: currentProjectSync,
      [getWorkspaceSegmentSceneSoundSelectionSyncKey(99, 0)]: otherProjectSync,
    };

    await expect(waitForWorkspaceSegmentSceneSoundSelectionSync(syncs, 42)).resolves.toBeUndefined();
  });

  it("blocks rendering when the current project selection write failed", async () => {
    const syncs = {
      [getWorkspaceSegmentSceneSoundSelectionSyncKey(42, 1)]: Promise.reject(
        new Error("selection failed"),
      ),
    };

    await expect(waitForWorkspaceSegmentSceneSoundSelectionSync(syncs, 42)).rejects.toThrow(
      "selection failed",
    );
  });
});

describe("scene sound refresh isolation", () => {
  it("does not restore a server sound after the user cleared that scene", () => {
    const baselineSegment = createProjectVoiceoverSegment({
      index: 0,
      sceneSoundAsset: null,
      sceneSoundReset: false,
    });
    const liveSegment = {
      ...baselineSegment,
      sceneSoundReset: true,
    };
    const freshSegment = {
      ...baselineSegment,
      sceneSoundAsset: {
        assetId: 812,
        fileName: "stale-scene-sound.wav",
        fileSize: 100,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/812",
        source: "media-library" as const,
      },
      sceneSoundAssetId: 812,
      scene_sound_asset_id: 812,
    };
    const baseline = createProjectVoiceoverDraft([baselineSegment]);
    const refreshed = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      createProjectVoiceoverDraft([liveSegment]),
      createProjectVoiceoverDraft([freshSegment]),
      { baselineSession: baseline },
    );

    expect(refreshed.segments[0]?.sceneSoundAsset).toBeNull();
    expect(refreshed.segments[0]?.sceneSoundAssetId).toBeNull();
    expect(refreshed.segments[0]?.scene_sound_asset_id).toBeNull();
    expect(refreshed.segments[0]?.sceneSoundReset).toBe(true);
  });
});

const createProjectVoiceoverSegment = (
  overrides: Partial<WorkspaceSegmentEditorDraftSegment> = {},
): WorkspaceSegmentEditorDraftSegment => {
  const text = overrides.text ?? "Segment";
  const startTime = overrides.startTime ?? 0;
  const endTime = overrides.endTime ?? 4;

  return {
    aiPhotoAsset: null,
    aiPhotoGeneratedFromPrompt: null,
    aiPhotoPrompt: "",
    aiPhotoPromptInitialized: false,
    aiVideoAsset: null,
    aiVideoGeneratedMode: null,
    aiVideoGeneratedFromPrompt: null,
    aiVideoPrompt: "",
    aiVideoPromptInitialized: false,
    infographic: null,
    infographicRemoved: false,
    infographicSourceWarningDismissedForIdentity: null,
    infographicStylePromptDraft: "",
    infographicTextDraft: "",
    currentAsset: null,
    currentExternalPlaybackUrl: null,
    currentExternalPreviewUrl: null,
    currentPlaybackUrl: null,
    currentPosterUrl: null,
    currentPreviewUrl: null,
    currentSourceKind: "unknown",
    customVideo: null,
    duration: endTime - startTime,
    durationMode: "auto",
    endTime,
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
    originalText: text,
    originalTextByLanguage: { ru: text },
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
    startTime,
    text,
    textByLanguage: { ru: text },
    voiceoverAsset: {
      assetId: 777,
      durationSeconds: 35.2,
      fileName: "project-voiceover.mp3",
      fileSize: 0,
      mimeType: "audio/mpeg",
      remoteUrl: "/api/workspace/media-assets/777",
      source: "media-library",
    },
    voiceoverLanguage: "ru",
    voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
    voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    videoAction: "original",
    visualReset: false,
    ...overrides,
  };
};

describe("segment infographic availability", () => {
  it("is available for durable and reloadable visuals and disabled for an empty segment", () => {
    const photo = createProjectVoiceoverSegment({
      currentAsset: { assetId: 101 } as any,
      mediaType: "photo",
    });
    const video = createProjectVoiceoverSegment({
      currentAsset: { assetId: 202 } as any,
      mediaType: "video",
    });
    const reloadedVideo = createProjectVoiceoverSegment({
      currentPlaybackUrl:
        "/api/workspace/project-segment-video?projectId=4271&segmentIndex=1&source=original&delivery=playback",
      mediaType: "video",
      videoAction: "original",
    });
    const empty = createProjectVoiceoverSegment();

    expect(canWorkspaceSegmentCreateInfographic(photo)).toBe(true);
    expect(canWorkspaceSegmentCreateInfographic(video)).toBe(true);
    expect(canWorkspaceSegmentCreateInfographic(reloadedVideo)).toBe(true);
    expect(getWorkspaceSegmentInfographicSourceAsset(reloadedVideo)).toEqual(
      expect.objectContaining({
        mimeType: "video/mp4",
        remoteUrl: reloadedVideo.currentPlaybackUrl,
      }),
    );
    expect(getWorkspaceSegmentInfographicSourceIdentity(reloadedVideo)).toBe(
      `url:${reloadedVideo.currentPlaybackUrl}`,
    );
    expect(
      isWorkspaceSegmentInfographicJobSourceCurrent(
        reloadedVideo,
        "asset:9901",
        `url:${reloadedVideo.currentPlaybackUrl}`,
      ),
    ).toBe(true);
    expect(
      isWorkspaceSegmentInfographicJobSourceCurrent(
        { ...reloadedVideo, currentPlaybackUrl: `${reloadedVideo.currentPlaybackUrl}&v=changed` },
        "asset:9901",
        `url:${reloadedVideo.currentPlaybackUrl}`,
      ),
    ).toBe(false);
    expect(canWorkspaceSegmentCreateInfographic(empty)).toBe(false);
  });
});

describe("workspace segment ready visual selection tabs", () => {
  it("allows upload and media library selection outside the AI visual job lock", () => {
    expect(isWorkspaceSegmentReadyVisualSelectionTab("upload")).toBe(true);
    expect(isWorkspaceSegmentReadyVisualSelectionTab("library")).toBe(true);
    expect(isWorkspaceSegmentReadyVisualSelectionTab("ai_photo")).toBe(false);
    expect(isWorkspaceSegmentReadyVisualSelectionTab("ai_video")).toBe(false);
    expect(isWorkspaceSegmentReadyVisualSelectionTab("image_edit")).toBe(false);
    expect(isWorkspaceSegmentReadyVisualSelectionTab("image_upscale")).toBe(false);
    expect(isWorkspaceSegmentReadyVisualSelectionTab("photo_animation")).toBe(false);
    expect(isWorkspaceSegmentReadyVisualSelectionTab("scene_sound")).toBe(false);
    expect(isWorkspaceSegmentReadyVisualSelectionTab("talking_photo")).toBe(false);
    expect(isWorkspaceSegmentReadyVisualSelectionTab("voiceover")).toBe(false);
  });
});

const createProjectVoiceoverDraft = (
  segments: WorkspaceSegmentEditorDraftSegment[],
): WorkspaceSegmentEditorDraftSession => ({
  customMusicAssetId: null,
  customMusicFileName: "",
  description: "",
  language: "ru",
  musicType: "ai",
  projectId: 77,
  segments,
  subtitleColor: "purple",
  subtitleStyle: "modern",
  subtitleType: "karaoke",
  title: "Session",
  ttsAssetId: 777,
  voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
});

describe("workspace segment editor draft identity", () => {
  it("derives a deterministic identity for a persisted project draft", () => {
    const draft = createProjectVoiceoverDraft([createProjectVoiceoverSegment()]);

    expect(getWorkspaceSegmentEditorDraftId(draft)).toBe("project:77");
    expect(ensureWorkspaceSegmentEditorDraftId(draft)).toEqual({
      ...draft,
      draftId: "project:77",
    });
  });

  it("assigns a stable unique identity to a scratch draft", () => {
    const draft = createWorkspaceSegmentEditorScratchDraftSession();

    expect(draft.draftId).toMatch(/^scratch:/);
    expect(getWorkspaceSegmentEditorDraftId(draft)).toBe(draft.draftId);
    expect(ensureWorkspaceSegmentEditorDraftId(draft)).toBe(draft);
  });

  it("matches completed jobs to a persisted project even if its transient draft id changed", () => {
    const draft = {
      ...createProjectVoiceoverDraft([createProjectVoiceoverSegment()]),
      draftId: "scratch:promoted-before-save",
    };

    expect(
      isWorkspaceSegmentEditorJobTargetDraft(draft, {
        allowPersistedProjectDraftIdMismatch: true,
        draftId: "project:77",
        projectId: 77,
      }),
    ).toBe(true);
    expect(
      isWorkspaceSegmentEditorJobTargetDraft(draft, {
        draftId: "project:77",
        projectId: 77,
      }),
    ).toBe(false);
    expect(
      isWorkspaceSegmentEditorJobTargetDraft(draft, {
        projectId: 77,
      }),
    ).toBe(true);
  });

  it("keeps scratch job results isolated by their unique draft id", () => {
    const draft = createWorkspaceSegmentEditorScratchDraftSession();

    expect(
      isWorkspaceSegmentEditorJobTargetDraft(draft, {
        draftId: draft.draftId,
        projectId: 0,
      }),
    ).toBe(true);
    expect(
      isWorkspaceSegmentEditorJobTargetDraft(draft, {
        draftId: "scratch:another-draft",
        projectId: 0,
      }),
    ).toBe(false);
  });
});

describe("applyWorkspaceSegmentEditorJobResult", () => {
  it("updates the stable segment index without overwriting a newer prompt", () => {
    const unrelatedSegment = createProjectVoiceoverSegment({
      aiPhotoPrompt: "unrelated prompt",
      index: 3,
    });
    const targetSegment = createProjectVoiceoverSegment({
      aiPhotoPrompt: "newer prompt typed while the job was running",
      index: 8,
    });
    const draft = createProjectVoiceoverDraft([unrelatedSegment, targetSegment]);

    const result = applyWorkspaceSegmentEditorJobResult(draft, {
      expectedProjectId: 77,
      segmentIndex: 8,
      updater: (segment) => ({
        ...segment,
        aiPhotoGeneratedFromPrompt: "captured job prompt",
      }),
    });

    expect(result.status).toBe("applied");
    expect(result.draft.segments.find((segment) => segment.index === 8)).toMatchObject({
      aiPhotoGeneratedFromPrompt: "captured job prompt",
      aiPhotoPrompt: "newer prompt typed while the job was running",
    });
    expect(result.draft.segments.find((segment) => segment.index === 3)?.aiPhotoGeneratedFromPrompt).toBeNull();
  });

  it("passes the matching draft to the result updater for freshness checks", () => {
    const targetSegment = createProjectVoiceoverSegment({ index: 8 });
    const draft = createProjectVoiceoverDraft([targetSegment]);
    let updaterDraft: typeof draft | null = null;

    const result = applyWorkspaceSegmentEditorJobResult(draft, {
      expectedProjectId: 77,
      segmentIndex: 8,
      updater: (segment, matchingDraft) => {
        updaterDraft = matchingDraft;
        return segment;
      },
    });

    expect(result.status).toBe("applied");
    expect(updaterDraft).toBe(draft);
    expect(result.draft).toBe(draft);
  });

  it("does not fall back to the array position when the stable segment index is missing", () => {
    const draft = createProjectVoiceoverDraft([
      createProjectVoiceoverSegment({ index: 9 }),
    ]);

    const result = applyWorkspaceSegmentEditorJobResult(draft, {
      expectedProjectId: 77,
      segmentIndex: 0,
      updater: (segment) => ({ ...segment, aiPhotoGeneratedFromPrompt: "stale result" }),
    });

    expect(result).toEqual({ draft, status: "segment-missing" });
  });

  it("leaves a different project draft untouched", () => {
    const draft = createProjectVoiceoverDraft([createProjectVoiceoverSegment({ index: 0 })]);

    const result = applyWorkspaceSegmentEditorJobResult(draft, {
      expectedProjectId: 78,
      segmentIndex: 0,
      updater: (segment) => ({ ...segment, aiPhotoGeneratedFromPrompt: "stale result" }),
    });

    expect(result).toEqual({ draft, status: "project-mismatch" });
  });
});

describe("segment infographic refresh isolation", () => {
  it("preserves a generated layer when a concurrent fresh session still has no infographic", () => {
    const baselineSegment = createProjectVoiceoverSegment({ index: 0 });
    const infographic = {
      animation: { durationSeconds: 1 as const, type: "fade" as const },
      inputHash: "b".repeat(64),
      intrinsicHeight: 400,
      intrinsicWidth: 800,
      mediaAssetId: 8952,
      parts: [],
      sourceVisualIdentity: "asset:7824",
      stylePrompt: null,
      text: "Рост продаж на 42%",
      transform: { centerX: 0.5, centerY: 0.3, width: 0.7 },
      version: 1 as const,
    };
    const liveDraft = createProjectVoiceoverDraft([
      { ...baselineSegment, infographic, infographicTextDraft: infographic.text },
    ]);
    const baseline = createProjectVoiceoverDraft([baselineSegment]);
    const freshSession = createProjectVoiceoverDraft([baselineSegment]);

    const refreshed = refreshWorkspaceSegmentEditorDraftWithFreshSession(liveDraft, freshSession, {
      baselineSession: baseline,
    });

    expect(refreshed.segments[0]?.infographic).toEqual(infographic);
  });

  it("replaces a cached baked original with the infographic source asset", () => {
    const infographic = {
      animation: { durationSeconds: 1 as const, type: "fade" as const },
      inputHash: "d".repeat(64),
      intrinsicHeight: 480,
      intrinsicWidth: 376,
      mediaAssetId: 10244,
      parts: [],
      sourceVisualIdentity: "asset:10222",
      stylePrompt: null,
      text: "Создайте атмосферу уюта",
      transform: { centerX: 0.5, centerY: 0.3, width: 0.6 },
      version: 1 as const,
    };
    const mediaAsset = (assetId: number, role: string) => ({
      assetId,
      createdAt: null,
      deletedAt: null,
      downloadPath: null,
      downloadUrl: `/api/workspace/media-assets/${assetId}`,
      expiresAt: null,
      isCurrent: false,
      kind: "rendered_segment",
      libraryKind: "photo_animation",
      lifecycle: "ready" as const,
      mediaType: "video",
      mimeType: "video/mp4",
      originalUrl: null,
      playbackUrl: `/api/workspace/media-assets/${assetId}/playback`,
      projectId: 77,
      role,
      segmentIndex: 0,
      sourceKind: "ai_generated",
      status: "ready",
      storageKey: null,
    });
    const staleSegment = createProjectVoiceoverSegment({
      infographic,
      mediaType: "video",
      originalAsset: mediaAsset(10485, "final_video"),
      originalPlaybackUrl: "/api/workspace/media-assets/10485/playback",
      originalPosterUrl: "/api/workspace/media-assets/10485/poster",
      originalPreviewUrl: "/api/workspace/media-assets/10485/playback",
      videoAction: "photo_animation",
    });
    const freshSegment = createProjectVoiceoverSegment({
      ...staleSegment,
      originalAsset: mediaAsset(10222, "source_upload"),
      originalPlaybackUrl: "/api/workspace/media-assets/10222/playback",
      originalPosterUrl: "/api/workspace/media-assets/10222/poster",
      originalPreviewUrl: "/api/workspace/media-assets/10222/playback",
    });
    const staleDraft = createProjectVoiceoverDraft([staleSegment]);

    const refreshed = refreshWorkspaceSegmentEditorDraftWithFreshSession(
      staleDraft,
      createProjectVoiceoverDraft([freshSegment]),
      { baselineSession: staleDraft },
    );

    expect(refreshed.segments[0]?.infographic).toEqual(infographic);
    expect(refreshed.segments[0]?.originalAsset?.assetId).toBe(10222);
    expect(refreshed.segments[0]?.originalPlaybackUrl).toBe(
      "/api/workspace/media-assets/10222/playback",
    );
    expect(refreshed.segments[0]?.originalPosterUrl).toBe(
      "/api/workspace/media-assets/10222/poster",
    );
  });

  it("applies the last visible transform before rendering without changing other scenes", () => {
    const firstSegment = createProjectVoiceoverSegment({ index: 0 });
    const secondSegment = createProjectVoiceoverSegment({ index: 1 });
    const infographic = {
      animation: { durationSeconds: 1 as const, type: "fade" as const },
      inputHash: "c".repeat(64),
      intrinsicHeight: 1453,
      intrinsicWidth: 908,
      mediaAssetId: 9133,
      parts: [],
      sourceVisualIdentity: "asset:7824",
      stylePrompt: null,
      text: "Хочешь больше силы? Есть решение!",
      transform: { centerX: 0.62, centerY: 0.315043, width: 0.7 },
      version: 1 as const,
    };
    const draft = createProjectVoiceoverDraft([
      { ...firstSegment, infographic },
      secondSegment,
    ]);

    const result = applyWorkspaceSegmentPendingInfographicTransforms(draft, {
      0: { centerX: 0.38, centerY: 0.68, width: 0.52 },
      1: { centerX: 0.5, centerY: 0.5, width: 0.4 },
    });

    expect(result.changedSegmentIndexes).toEqual([0]);
    expect(result.draft.segments[0]?.infographic?.transform).toEqual({
      centerX: 0.38,
      centerY: 0.68,
      width: 0.52,
    });
    expect(result.draft.segments[1]).toBe(secondSegment);
  });
});

it("recognizes talking photo assets by library kind", () => {
  expect(
    isWorkspaceTalkingPhotoMediaAsset({
      assetId: 909,
      createdAt: null,
      deletedAt: null,
      downloadPath: "/api/media/909/download",
      downloadUrl: null,
      expiresAt: null,
      isCurrent: true,
      kind: "segment_current",
      libraryKind: "talking_photo",
      lifecycle: "ready",
      mediaType: "video",
      mimeType: "video/mp4",
      originalUrl: null,
      playbackUrl: "/api/media/909/download",
      projectId: 77,
      role: "segment_current",
      segmentIndex: 0,
      sourceKind: "generated",
      status: "ready",
      storageKey: null,
    }),
  ).toBe(true);
});

it("applies a voice override only to the selected scene", () => {
  const firstSegment = createProjectVoiceoverSegment({
    index: 0,
    voiceoverAsset: {
      assetId: 801,
      durationSeconds: 4.1,
      fileName: "scene-1.mp3",
      fileSize: 0,
      mimeType: "audio/mpeg",
      remoteUrl: "/api/workspace/media-assets/801",
      source: "media-library",
    },
  });
  const secondSegment = createProjectVoiceoverSegment({
    index: 1,
    startTime: 4.1,
    endTime: 8.2,
    voiceoverAsset: {
      assetId: 802,
      durationSeconds: 4.1,
      fileName: "scene-2.mp3",
      fileSize: 0,
      mimeType: "audio/mpeg",
      remoteUrl: "/api/workspace/media-assets/802",
      source: "media-library",
    },
  });
  const draft = createProjectVoiceoverDraft([firstSegment, secondSegment]);

  const updatedDraft = applyWorkspaceSegmentEditorSceneVoiceOverride(draft, 0, "Russian_BrightHeroine");

  expect(updatedDraft.voiceType).toBe(draft.voiceType);
  expect(updatedDraft.segments[0]).toEqual(
    expect.objectContaining({
      duration: 1.8,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 1.8,
      estimatedVoiceoverDurationSeconds: 1.8,
      manualDurationSeconds: null,
      startTime: 0,
      voiceType: "Russian_BrightHeroine",
      voice_type: "Russian_BrightHeroine",
      voiceoverAsset: null,
      voiceoverLanguage: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    }),
  );
  expect(updatedDraft.segments[1]).toBe(secondSegment);
});

it("clears both scene voice aliases when the selected voice matches the project voice", () => {
  const projectVoiceType = "Russian_BrightHeroine";
  const previousSceneVoiceType = DEFAULT_STUDIO_VOICE_ID.ru;
  const segment = createProjectVoiceoverSegment({
    voiceType: previousSceneVoiceType,
    voice_type: previousSceneVoiceType,
  });
  const draft = {
    ...createProjectVoiceoverDraft([segment]),
    voiceType: projectVoiceType,
  };

  const updatedDraft = applyWorkspaceSegmentEditorSceneVoiceSelection(
    draft,
    segment.index,
    projectVoiceType,
  );

  expect(updatedDraft.segments[0]).toEqual(expect.objectContaining({
    voiceType: null,
    voice_type: null,
  }));
  expect(getWorkspaceSegmentEffectiveVoiceId(updatedDraft.segments[0]!, updatedDraft)).toBe(projectVoiceType);
});

it("restores the original voiceover and keeps final closing padding", () => {
  const text = "It was an ordinary day in the animal city.";
  const baselineSegment = createProjectVoiceoverSegment({
    duration: 4.4,
    endTime: 4.4,
    speechDuration: 4.4,
    speechDurationSource: "audio",
    speechEndTime: 4.4,
    speechStartTime: 0,
    text,
    voiceSourceDuration: 4.4,
    voiceSourceEndTime: 4.4,
    voiceSourceStartTime: 0,
    voiceoverAsset: {
      assetId: 801,
      durationSeconds: 4.4,
      fileName: "scene-1.mp3",
      fileSize: 0,
      mimeType: "audio/mpeg",
      remoteUrl: "/api/workspace/media-assets/801",
      source: "media-library",
    },
    voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
  });
  const baselineDraft = createProjectVoiceoverDraft([baselineSegment]);
  const changedDraft = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
    applyWorkspaceSegmentEditorSceneVoiceOverride(baselineDraft, 0, "Russian_BrightHeroine"),
  );

  const restoredDraft = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
    applyWorkspaceSegmentEditorSceneVoiceSelection(
      changedDraft,
      0,
      DEFAULT_STUDIO_VOICE_ID.ru,
      baselineDraft,
    ),
  );

  expect(changedDraft.segments[0]?.voiceoverAsset).toBeNull();
  expect(restoredDraft.segments[0]).toEqual(expect.objectContaining({
    duration: 4.7,
    endTime: 4.7,
    estimatedVoiceoverDurationSeconds: null,
    estimatedVoiceoverTextHash: null,
    speechDuration: 4.4,
    voiceType: null,
    voiceoverAsset: expect.objectContaining({ assetId: 801, durationSeconds: 4.4 }),
    voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
  }));
});

it("does not restore a baseline voiceover when the scene text changed", () => {
  const baselineText = "Original scene text";
  const editedText = "Edited scene text that needs a new recording";
  const baselineSegment = createProjectVoiceoverSegment({
    duration: 4.4,
    endTime: 4.4,
    speechDuration: 4.4,
    speechDurationSource: "audio",
    speechEndTime: 4.4,
    speechStartTime: 0,
    text: baselineText,
    voiceSourceDuration: 4.4,
    voiceSourceEndTime: 4.4,
    voiceSourceStartTime: 0,
    voiceoverAsset: {
      assetId: 801,
      durationSeconds: 4.4,
      fileName: "scene-1.mp3",
      fileSize: 0,
      mimeType: "audio/mpeg",
      remoteUrl: "/api/workspace/media-assets/801",
      source: "media-library",
    },
    voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(baselineText),
  });
  const baselineDraft = createProjectVoiceoverDraft([baselineSegment]);
  const changedVoiceDraft = applyWorkspaceSegmentEditorSceneVoiceOverride(
    baselineDraft,
    0,
    "Russian_BrightHeroine",
  );
  const editedDraft = {
    ...changedVoiceDraft,
    segments: changedVoiceDraft.segments.map((segment) => ({
      ...segment,
      text: editedText,
      textByLanguage: { ru: editedText },
    })),
  };

  const restoredDraft = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
    applyWorkspaceSegmentEditorSceneVoiceSelection(
      editedDraft,
      0,
      DEFAULT_STUDIO_VOICE_ID.ru,
      baselineDraft,
    ),
  );

  expect(restoredDraft.segments[0]).toEqual(expect.objectContaining({
    text: editedText,
    voiceType: null,
    voiceoverAsset: null,
    voiceoverTextHash: null,
    voiceoverVoiceType: null,
  }));
  expect(restoredDraft.segments[0]?.duration).not.toBe(4.4);
});

it("keeps a fresh generated voiceover when the already selected voice is selected again", () => {
  const text = "Keep the current generated take";
  const baselineDraft = createProjectVoiceoverDraft([
    createProjectVoiceoverSegment({ text }),
  ]);
  const currentSegment = createProjectVoiceoverSegment({
    text,
    voiceType: "Russian_BrightHeroine",
    voiceoverAsset: {
      assetId: 802,
      durationSeconds: 3.8,
      fileName: "scene-1-new.mp3",
      fileSize: 0,
      mimeType: "audio/mpeg",
      remoteUrl: "/api/workspace/media-assets/802",
      source: "media-library",
    },
    voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
    voiceoverVoiceType: "Russian_BrightHeroine",
  });
  const currentDraft = createProjectVoiceoverDraft([currentSegment]);

  const selectedDraft = applyWorkspaceSegmentEditorSceneVoiceSelection(
    currentDraft,
    0,
    "Russian_BrightHeroine",
    baselineDraft,
  );

  expect(selectedDraft).toBe(currentDraft);
  expect(selectedDraft.segments[0]?.voiceoverAsset?.assetId).toBe(802);
});

it("changes a scene voice language independently when Russian and English share the same voice id", () => {
  const text = "The language flag must not be inferred from the shared voice id";
  const currentSegment = createProjectVoiceoverSegment({
    text,
    voiceLanguage: "ru",
    voice_language: "ru",
    voiceoverAsset: {
      assetId: 803,
      durationSeconds: 3.8,
      fileName: "scene-1-ru.mp3",
      fileSize: 0,
      mimeType: "audio/mpeg",
      remoteUrl: "/api/workspace/media-assets/803",
      source: "media-library",
    },
    voiceoverLanguage: "ru",
    voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
    voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
  });
  const currentDraft = createProjectVoiceoverDraft([currentSegment]);

  const selectedDraft = applyWorkspaceSegmentEditorSceneVoiceSelection(
    currentDraft,
    0,
    DEFAULT_STUDIO_VOICE_ID.en,
    null,
    { language: "en" },
  );
  const selectedSegment = selectedDraft.segments[0]!;

  expect(DEFAULT_STUDIO_VOICE_ID.en).toBe(DEFAULT_STUDIO_VOICE_ID.ru);
  expect(getWorkspaceSegmentVoiceLanguage(selectedSegment, "ru")).toBe("en");
  expect(selectedSegment.voiceLanguage).toBe("en");
  expect(selectedSegment.voiceoverAsset).toBeNull();
  expect(selectedSegment.voiceoverLanguage).toBeNull();
});

it("removes stale source-language metadata when an inherited voice switches language", () => {
  const inheritedVoiceSegment = createProjectVoiceoverSegment({
    voiceLanguage: "ru",
    voiceType: null,
    voice_language: "ru",
    voice_type: null,
  });
  const sharedVoiceOverrideSegment = createProjectVoiceoverSegment({
    voiceLanguage: "ru",
    voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    voice_language: "ru",
    voice_type: DEFAULT_STUDIO_VOICE_ID.ru,
  });

  const inheritedPatch = getWorkspaceSegmentVoiceLanguageSelectionPatch(inheritedVoiceSegment, "en");
  const sharedOverridePatch = getWorkspaceSegmentVoiceLanguageSelectionPatch(sharedVoiceOverrideSegment, "en");

  expect(inheritedPatch).toEqual({
    voiceLanguage: null,
    voiceType: null,
    voice_language: null,
    voice_type: null,
  });
  expect(getWorkspaceSegmentVoiceLanguage({ ...inheritedVoiceSegment, ...inheritedPatch }, "en")).toBe("en");
  expect(sharedOverridePatch).toEqual({
    voiceLanguage: "en",
    voiceType: DEFAULT_STUDIO_VOICE_ID.en,
    voice_language: "en",
    voice_type: DEFAULT_STUDIO_VOICE_ID.en,
  });
});

it("resets scene duration to pending voiceover estimate after a global voice change", () => {
  const segment = createProjectVoiceoverSegment({
    customVideo: {
      assetId: 4404,
      durationSeconds: 5.5,
      fileName: "uploaded-scene.mp4",
      fileSize: 0,
      mimeType: "video/mp4",
      remoteUrl: "/api/workspace/media-assets/4404/playback",
      source: "upload",
    },
    duration: 5.5,
    durationMode: "manual",
    durationSyncMode: "visual",
    durationSyncModeUserSelected: false,
    endTime: 5.5,
    manualDurationSeconds: 5.5,
    mediaType: "video",
    startTime: 0,
    text: "один два три четыре пять шесть",
    videoAction: "custom",
  });
  const draft = createProjectVoiceoverDraft([segment]);

  const updatedDraft = applyWorkspaceSegmentEditorGlobalVoiceToSegments(draft, "Russian_BrightHeroine");

  expect(updatedDraft.segments[0]).toEqual(expect.objectContaining({
    duration: 2.04,
    durationExtensionSourceDurationSeconds: 5.5,
    durationMode: "auto",
    durationSyncMode: "voiceover",
    endTime: 2.04,
    estimatedVoiceoverDurationSeconds: 2.04,
    manualDurationSeconds: null,
    startTime: 0,
  }));
});

it("preserves an explicit visual duration when bulk voice text and the global voice change", () => {
  const segment = createProjectVoiceoverSegment({
    customVideo: {
      assetId: 4404,
      durationSeconds: 5.5,
      fileName: "uploaded-scene.mp4",
      fileSize: 0,
      mimeType: "video/mp4",
      remoteUrl: "/api/workspace/media-assets/4404/playback",
      source: "upload",
    },
    duration: 5.5,
    durationMode: "manual",
    durationSyncMode: "visual",
    durationSyncModeUserSelected: true,
    endTime: 5.5,
    manualDurationSeconds: 5.5,
    mediaType: "video",
    startTime: 0,
    text: "Исходный текст",
    textByLanguage: { ru: "Исходный текст" },
    videoAction: "custom",
  });
  const draft = createProjectVoiceoverDraft([segment]);

  const withUpdatedText = applyWorkspaceSegmentEditorBulkVoiceText(
    draft,
    ["Обновлённый текст"],
    "ru",
  );
  const withUpdatedVoice = applyWorkspaceSegmentEditorGlobalVoiceToSegments(
    withUpdatedText,
    "Russian_BrightHeroine",
  );

  expect(withUpdatedVoice.segments[0]).toEqual(expect.objectContaining({
    duration: 5.5,
    durationMode: "manual",
    durationSyncMode: "visual",
    durationSyncModeUserSelected: true,
    endTime: 5.5,
    manualDurationSeconds: 5.5,
    startTime: 0,
    text: "Обновлённый текст",
  }));
  expect(withUpdatedVoice.segments[0]?.voiceoverAsset).toBeNull();
  expect(withUpdatedVoice.ttsAssetId).toBeNull();
});

it("keeps a selected global voice when another segment edit follows", () => {
  const baseline = createProjectVoiceoverDraft([
    createProjectVoiceoverSegment({
      text: "Исходный текст",
      textByLanguage: { ru: "Исходный текст" },
    }),
  ]);

  const withSelectedVoice = applyWorkspaceSegmentEditorGlobalVoiceSelection(
    baseline,
    "Russian_BrightHeroine",
    "ru",
  );
  const withLaterTextEdit = applyWorkspaceSegmentEditorBulkVoiceText(
    withSelectedVoice,
    ["Текст после выбора голоса"],
    "ru",
  );

  expect(withLaterTextEdit.voiceType).toBe("Russian_BrightHeroine");
  expect(getWorkspaceSegmentEffectiveVoiceId(withLaterTextEdit.segments[0]!, withLaterTextEdit)).toBe(
    "Russian_BrightHeroine",
  );
});

it("keeps a persisted local voice selection through a fresh project refresh", () => {
  const segment = createProjectVoiceoverSegment({
    duration: 4.1,
    durationMode: "manual",
    durationSyncMode: "visual",
    durationSyncModeUserSelected: true,
    endTime: 4.1,
    manualDurationSeconds: 4.1,
  });
  const baseline = createProjectVoiceoverDraft([segment]);
  const localDraft = {
    ...applyWorkspaceSegmentEditorGlobalVoiceToSegments(baseline, "Alisa"),
    clientUpdatedAt: 1_722_000_000_000,
  };

  const refreshed = refreshWorkspaceSegmentEditorDraftWithFreshSession(localDraft, baseline, {
    baselineSession: baseline,
    preserveUnbaselinedManualDuration: true,
  });

  expect(refreshed.voiceType).toBe("Alisa");
  expect(refreshed.clientUpdatedAt).toBe(localDraft.clientUpdatedAt);
  expect(refreshed.segments[0]).toEqual(expect.objectContaining({
    duration: 4.1,
    durationMode: "manual",
    durationSyncMode: "visual",
    durationSyncModeUserSelected: true,
    endTime: 4.1,
    manualDurationSeconds: 4.1,
  }));
});

it("clears both stored scene voice aliases when applying a global voice to all scenes", () => {
  const previousVoiceType = DEFAULT_STUDIO_VOICE_ID.ru;
  const nextVoiceType = "Vika";
  const segment = createProjectVoiceoverSegment({
    voiceType: previousVoiceType,
    voice_type: previousVoiceType,
  });
  const draft = createProjectVoiceoverDraft([segment]);

  const updatedDraft = applyWorkspaceSegmentEditorGlobalVoiceToSegments(draft, nextVoiceType);

  expect(updatedDraft.voiceType).toBe(nextVoiceType);
  expect(updatedDraft.segments[0]).toEqual(expect.objectContaining({
    voiceType: null,
    voice_type: null,
    voiceoverVoiceType: null,
  }));
  expect(getWorkspaceSegmentEffectiveVoiceId(updatedDraft.segments[0], updatedDraft)).toBe(nextVoiceType);
});

it("infers the project voice from uniform scene voiceovers when the stored project voice is stale", () => {
  const firstSegment = createProjectVoiceoverSegment({
    index: 0,
    voiceoverAsset: {
      assetId: 811,
      durationSeconds: 4.1,
      fileName: "scene-1.mp3",
      fileSize: 0,
      mimeType: "audio/mpeg",
      remoteUrl: "/api/workspace/media-assets/811",
      source: "media-library",
    },
    voiceoverVoiceType: "Russian_BrightHeroine",
    voiceType: null,
  });
  const secondSegment = createProjectVoiceoverSegment({
    index: 1,
    startTime: 4.1,
    endTime: 8.2,
    voiceoverAsset: {
      assetId: 812,
      durationSeconds: 4.1,
      fileName: "scene-2.mp3",
      fileSize: 0,
      mimeType: "audio/mpeg",
      remoteUrl: "/api/workspace/media-assets/812",
      source: "media-library",
    },
    voiceoverVoiceType: "Russian_BrightHeroine",
    voiceType: null,
  });

  expect(
    getWorkspaceSegmentEditorProjectVoiceType({
      ...createProjectVoiceoverDraft([firstSegment, secondSegment]),
      ttsAssetId: null,
      voiceType: "English_ManWithDeepVoice",
    }),
  ).toBe("Russian_BrightHeroine");
});

it("repairs repeated speech words that leaked into the next project voiceover scene", () => {
  const sceneFive = createProjectVoiceoverSegment({
    duration: 6.72,
    endTime: 30.52,
    index: 4,
    speechDuration: 6.72,
    speechEndTime: 30.52,
    speechStartTime: 23.8,
    speechWords: [
      { confidence: 0, endTime: 24.02, startTime: 23.8, text: "Но" },
      { confidence: 0, endTime: 24.44, startTime: 24.02, text: "против" },
      { confidence: 0, endTime: 25.04, startTime: 24.44, text: "мощи" },
      { confidence: 0, endTime: 25.68, startTime: 25.04, text: "Сусаноо" },
      { confidence: 0, endTime: 26.42, startTime: 25.68, text: "обычные" },
      { confidence: 0, endTime: 27.16, startTime: 26.42, text: "технологии" },
      { confidence: 0, endTime: 27.84, startTime: 27.16, text: "Готэма" },
      { confidence: 0, endTime: 28.78, startTime: 27.84, text: "окажутся" },
      { confidence: 0, endTime: 29.3, startTime: 28.78, text: "практически" },
      { confidence: 0, endTime: 30.52, startTime: 30, text: "бесполезными" },
    ],
    startTime: 23.8,
    text: "Но против мощи Сусаноо обычные технологии Готэма окажутся практически бесполезными в финале.",
    voiceoverAsset: null,
    voiceoverAssetId: null,
    voiceoverTextHash: null,
    voiceoverVoiceType: null,
    voiceover_asset_id: null,
  });
  const sceneSix = createProjectVoiceoverSegment({
    duration: 7.793,
    endTime: 38.313,
    index: 5,
    speechDuration: 7.24,
    speechEndTime: 37.76,
    speechStartTime: 30.52,
    speechWords: [
      { confidence: 0, endTime: 30.7, startTime: 30.52, text: "в" },
      { confidence: 0, endTime: 30.96, startTime: 30.7, text: "финале." },
      { confidence: 0, endTime: 31.18, startTime: 30.96, text: "В" },
      { confidence: 0, endTime: 32.44, startTime: 31.88, text: "этой" },
      { confidence: 0, endTime: 33.02, startTime: 32.44, text: "битве" },
      { confidence: 0, endTime: 33.82, startTime: 33.02, text: "гениальный" },
      { confidence: 0, endTime: 34.4, startTime: 33.82, text: "интеллект" },
      { confidence: 0, endTime: 35.18, startTime: 34.4, text: "проигрывает" },
      { confidence: 0, endTime: 35.94, startTime: 35.18, text: "божественной" },
      { confidence: 0, endTime: 36.44, startTime: 35.94, text: "силе" },
      { confidence: 0, endTime: 36.88, startTime: 36.44, text: "клана" },
      { confidence: 0, endTime: 37.76, startTime: 36.88, text: "Учиха." },
    ],
    startTime: 30.52,
    text: "В этой битве гениальный интеллект проигрывает божественной силе клана Учиха.",
    voiceoverAsset: null,
    voiceoverAssetId: null,
    voiceoverTextHash: null,
    voiceoverVoiceType: null,
    voiceover_asset_id: null,
  });

  const repaired = repairWorkspaceSegmentEditorSpeechWordBoundaries([sceneFive, sceneSix]);

  expect(repaired[0]?.speechWords.slice(-2).map((word) => word.text)).toEqual(["в", "финале."]);
  expect(repaired[0]).toEqual(expect.objectContaining({
    duration: 7.16,
    endTime: 30.96,
    speechDuration: 7.16,
    speechEndTime: 30.96,
    speechStartTime: 23.8,
    voiceSourceDuration: 7.16,
    voiceSourceEndTime: 30.96,
    voiceSourceStartTime: 23.8,
  }));
  expect(repaired[1]?.speechWords[0]?.text).toBe("В");
  expect(repaired[1]).toEqual(expect.objectContaining({
    duration: 7.353,
    speechDuration: 6.8,
    speechEndTime: 37.76,
    speechStartTime: 30.96,
    startTime: 30.96,
    voiceSourceDuration: 6.8,
    voiceSourceEndTime: 37.76,
    voiceSourceStartTime: 30.96,
  }));
});

describe("workspace segment editor scene sound preview", () => {
  it("uses generated AI video audio as the timeline sound without creating a separate scene sound", () => {
    const segment = createProjectVoiceoverSegment({
      aiVideoAsset: {
        assetId: 817,
        fileName: "generated-with-audio.mp4",
        fileSize: 4096,
        generateAudio: true,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/817/playback",
      },
      aiVideoGeneratedMode: "ai_video",
      sceneSoundAsset: null,
      sceneSoundAssetId: null,
      scene_sound_asset_id: null,
      videoAction: "ai",
    });

    expect(getWorkspaceSegmentEmbeddedVisualSoundAsset(segment)?.assetId).toBe(817);
    expect(createWorkspaceSegmentTimelineSoundAsset(segment, segment.index)).toMatchObject({
      assetId: 817,
      generateAudio: true,
      mimeType: "video/mp4",
    });
    expect(createWorkspaceSegmentSceneSoundAsset(segment, segment.index)).toBeNull();
    expect(segment.sceneSoundAsset).toBeNull();
    expect(segment.sceneSoundAssetId).toBeNull();
  });

  it("preserves the requested generated-audio intent when the provider omits it from the asset", () => {
    expect(resolveWorkspaceGeneratedVideoAudioIntent({
      assetId: 819,
      fileName: "generated.mp4",
      fileSize: 4096,
      mimeType: "video/mp4",
    }, true)).toMatchObject({
      assetId: 819,
      generateAudio: true,
    });
  });

  it("uses generated photo-animation audio as the timeline sound", () => {
    const segment = createProjectVoiceoverSegment({
      aiVideoAsset: {
        assetId: 820,
        fileName: "animated-with-audio.mp4",
        fileSize: 4096,
        generateAudio: true,
        mimeType: "video/mp4",
      },
      aiVideoGeneratedMode: "photo_animation",
      videoAction: "photo_animation",
    });

    expect(createWorkspaceSegmentTimelineSoundAsset(segment, segment.index)?.assetId).toBe(820);
  });

  it("attaches extracted video audio to every persisted scene sound field", () => {
    const segment = createProjectVoiceoverSegment({
      sceneSoundGeneratedFromPrompt: "old generated ambience",
      sceneSoundPrompt: "old prompt",
      sceneSoundPromptInitialized: true,
      sceneSoundReset: true,
    });
    const asset = {
      assetId: 818,
      fileName: "uploaded-video-audio.m4a",
      fileSize: 4096,
      mimeType: "audio/mp4",
      remoteUrl: "/api/workspace/media-assets/818/playback",
      source: "media-library" as const,
    };

    const updated = applyWorkspaceSegmentSceneSoundAsset(segment, asset, {
      generatedFromPrompt: null,
      prompt: "",
    });

    expect(updated).toMatchObject({
      sceneSound: asset,
      sceneSoundAsset: asset,
      sceneSoundAssetId: 818,
      sceneSoundGeneratedFromPrompt: null,
      sceneSoundPrompt: "",
      sceneSoundPromptInitialized: true,
      sceneSoundReset: false,
      scene_sound: {
        file_name: "uploaded-video-audio.m4a",
        media_asset_id: 818,
        mime_type: "audio/mp4",
      },
      scene_sound_asset_id: 818,
    });
  });

  it("invalidates a generated scene sound when the scene visual changes and keeps its prompt", () => {
    const segment = createProjectVoiceoverSegment({
      sceneSoundAsset: {
        assetId: 812,
        fileName: "scene-sound.wav",
        fileSize: 2048,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/812/playback",
      },
      sceneSoundAssetId: 812,
      sceneSoundGeneratedFromPrompt: "rain on glass",
      sceneSoundPrompt: "",
      sceneSoundPromptInitialized: true,
      sceneSoundReset: false,
      scene_sound_asset_id: 812,
    });

    const updated = invalidateWorkspaceSegmentSceneSoundForVisualChange(segment);

    expect(updated.sceneSoundAsset).toBeNull();
    expect(updated.sceneSoundAssetId).toBeNull();
    expect(updated.scene_sound_asset_id).toBeNull();
    expect(updated.sceneSoundPrompt).toBe("rain on glass");
    expect(updated.sceneSoundPromptInitialized).toBe(true);
    expect(updated.sceneSoundReset).toBe(true);
  });

  it("displays empty scene timeline ranges as zero-length without changing real slot timing", () => {
    const emptySegment = createProjectVoiceoverSegment({
      duration: 2.4,
      endTime: 12.4,
      originalText: "",
      originalTextByLanguage: { ru: "" },
      startTime: 10,
      text: "",
      textByLanguage: { ru: "" },
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const visibleRange = getWorkspaceSegmentEditorVisibleTimelineDisplayRange(emptySegment, {
      endTime: 12.4,
      startTime: 10,
    });

    expect(visibleRange).toEqual({ endTime: 10, startTime: 10 });

    const filledSegment = createProjectVoiceoverSegment({
      duration: 2.4,
      endTime: 12.4,
      startTime: 10,
    });

    expect(
      getWorkspaceSegmentEditorVisibleTimelineDisplayRange(filledSegment, {
        endTime: 12.4,
        startTime: 10,
      }),
    ).toEqual({ endTime: 12.4, startTime: 10 });
  });

  it("uses a video element for scene sound assets stored as mp4", () => {
    expect(getStudioSceneSoundAssetPreviewMediaKind({
      fileName: "scene-sound.mp4",
      mimeType: "video/mp4",
    })).toBe("video");
  });

  it("resolves the visual asset id from durable workspace media urls", () => {
    const segment = createProjectVoiceoverSegment({
      currentPlaybackUrl: "/api/workspace/media-assets/4984/playback",
      currentPreviewUrl: "/api/workspace/media-assets/4984/poster",
      mediaType: "video",
    });

    expect(getWorkspaceSegmentSceneSoundVisualAssetId(segment)).toBe(4984);
  });

  it("uses the current generated video asset for server-side scene frame extraction", () => {
    const segment = createProjectVoiceoverSegment({
      aiVideoAsset: {
        assetId: 10433,
        fileName: "segment-1-ai-video.mp4",
        fileSize: 1024,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/10433/playback",
        source: "media-library",
      },
      currentAsset: { assetId: 10432, mediaType: "photo" } as any,
      mediaType: "video",
      videoAction: "photo_animation",
    });

    expect(getWorkspaceSegmentSceneReferenceVideoAssetId(segment)).toBe(10433);
  });

  it("keeps regular audio scene sound assets on an audio element", () => {
    expect(getStudioSceneSoundAssetPreviewMediaKind({
      fileName: "scene-sound.wav",
      mimeType: "audio/wav",
    })).toBe("audio");
  });

  it("rebuilds a playable scene sound asset from a persisted asset id", () => {
    const segment = createProjectVoiceoverSegment({
      sceneSoundAsset: null,
      sceneSoundAssetId: 812,
      scene_sound_asset_id: 812,
    });

    const asset = createWorkspaceSegmentSceneSoundAsset(segment, segment.index);

    expect(asset?.assetId).toBe(812);
    expect(asset?.fileName).toBe("segment-1-scene-sound.wav");
    expect(getStudioSceneSoundAssetPreviewUrl(asset)).toBe("/api/workspace/media-assets/812/playback");
  });

  it("rebuilds a playable scene sound asset from AdsFlow-shaped persisted sound metadata", () => {
    const segment = createProjectVoiceoverSegment({
      sceneSoundAsset: null,
      scene_sound: {
        media_asset_id: 913,
        file_name: "scene-sound.mp3",
        mime_type: "audio/mpeg",
      },
      scene_sound_asset_id: 913,
    });

    const asset = createWorkspaceSegmentSceneSoundAsset(segment, segment.index);

    expect(asset).toMatchObject({
      assetId: 913,
      fileName: "scene-sound.mp3",
      mimeType: "audio/mpeg",
    });
    expect(getStudioSceneSoundAssetPreviewUrl(asset)).toBe("/api/workspace/media-assets/913/playback");
  });

  it("keeps the same draft reference when generated media hydration has no visual changes", () => {
    const segment = createProjectVoiceoverSegment({
      aiVideoAsset: {
        assetId: 812,
        fileName: "segment-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/812/playback",
        source: "media-library",
      },
      mediaType: "video",
      videoAction: "ai",
    });
    const draft = createProjectVoiceoverDraft([segment]);

    const hydrated = hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary(draft, [
      {
        createdAt: 1234,
        id: "ai-video-812",
        item: {
          assetExpiresAt: null,
          assetId: 812,
          assetKind: "segment_current",
          assetLifecycle: "ready",
          assetMediaType: "video",
          createdAt: 1234,
          dedupeKey: "ai-video-812",
          downloadName: "segment-video.mp4",
          downloadUrl: "/api/workspace/media-assets/812/download",
          itemKey: "ai-video-812",
          kind: "ai_video",
          previewKind: "video",
          previewPosterUrl: null,
          previewUrl: "/api/workspace/media-assets/812/playback",
          projectId: 77,
          projectTitle: "Session",
          segmentIndex: 0,
          segmentListIndex: 0,
          segmentNumber: 1,
          source: "persisted",
        },
        sourceJobId: "ai-video-812",
      },
    ]);

    expect(hydrated).toBe(draft);
  });

  it("removes a recovered draft asset when media library already points to the canonical current visual", () => {
    const segment = createProjectVoiceoverSegment({
      aiVideoAsset: {
        assetId: 812,
        fileName: "segment-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/812/playback",
        source: "media-library",
      },
      aiVideoGeneratedMode: "photo_animation",
      currentAsset: { assetId: 812 } as WorkspaceSegmentEditorDraftSegment["currentAsset"],
      currentSourceKind: "ai_generated",
      mediaType: "video",
      videoAction: "photo_animation",
    });
    const draft = createProjectVoiceoverDraft([segment]);

    const hydrated = hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary(draft, [
      {
        createdAt: 1234,
        id: "photo-animation-812",
        item: {
          assetExpiresAt: null,
          assetId: 812,
          assetKind: "segment_current",
          assetLifecycle: "ready",
          assetMediaType: "video",
          createdAt: 1234,
          dedupeKey: "photo-animation-812",
          downloadName: "segment-video.mp4",
          downloadUrl: "/api/workspace/media-assets/812/download",
          itemKey: "photo-animation-812",
          kind: "photo_animation",
          previewKind: "video",
          previewPosterUrl: null,
          previewUrl: "/api/workspace/media-assets/812/playback",
          projectId: 77,
          projectTitle: "Session",
          segmentIndex: 0,
          segmentListIndex: 0,
          segmentNumber: 1,
          source: "persisted",
        },
        sourceJobId: "photo-animation-812",
      },
    ]);

    expect(hydrated).not.toBe(draft);
    expect(hydrated?.segments[0]?.aiVideoAsset).toBeNull();
    expect(hydrated?.segments[0]?.aiVideoGeneratedMode).toBeNull();
    expect(hydrated?.segments[0]?.videoAction).toBe("original");
  });

  it("attaches an uploaded visual source id to custom visual drafts", () => {
    const segment = createProjectVoiceoverSegment({
      customVideo: {
        durationSeconds: 5,
        fileName: "draft-visual.mp4",
        fileSize: 1024,
        mimeType: "video/mp4",
        objectUrl: "blob:http://localhost/draft-visual",
        source: "upload",
      },
      mediaType: "video",
      videoAction: "custom",
    });

    const updated = applyWorkspaceSegmentSceneSoundVisualAssetId(segment, 9912);

    expect(updated.customVideo?.assetId).toBe(9912);
    expect(segment.customVideo?.assetId).toBeUndefined();
  });
});

describe("workspace segment editor subtitle availability", () => {
  it("clears stale scene subtitle overrides when global subtitle color changes", () => {
    const firstSegment = createProjectVoiceoverSegment({
      index: 0,
      subtitleColor: "cyan",
      subtitleStyle: "impact",
      subtitleType: "default",
    });
    const disabledSegment = createProjectVoiceoverSegment({
      index: 1,
      startTime: 4,
      endTime: 8,
      subtitleColor: "pink",
      subtitleStyle: "story",
      subtitleType: "none",
    });
    const nextDraft = applyWorkspaceSegmentEditorGlobalSubtitleSelection(
      createProjectVoiceoverDraft([firstSegment, disabledSegment]),
      {
        subtitleColor: "gold",
      },
    );

    expect(nextDraft.subtitleColor).toBe("gold");
    expect(nextDraft.segments[0]).toMatchObject({
      subtitleColor: null,
      subtitleStyle: null,
      subtitleType: null,
    });
    expect(
      getWorkspaceSegmentEffectiveSubtitleSettings(nextDraft, nextDraft.segments[0], {
        subtitleColorId: "purple",
        subtitleStyleId: "modern",
      }),
    ).toMatchObject({
      isEnabled: true,
      subtitleColorId: "gold",
      subtitleStyleId: "modern",
    });
    expect(nextDraft.segments[1]).toMatchObject({
      subtitleColor: null,
      subtitleStyle: null,
      subtitleType: "none",
    });
  });

  it("treats a fresh per-scene voiceover asset as available when the project voice is disabled", () => {
    const text = "Взбейте яйца с сахаром и солью.";
    const segment = createProjectVoiceoverSegment({
      originalText: text,
      originalTextByLanguage: { ru: text },
      text,
      textByLanguage: { ru: text },
      voiceType: null,
      voiceoverAsset: {
        assetId: 888,
        durationSeconds: 2.4,
        fileName: "scene-voiceover.mp3",
        fileSize: 0,
        mimeType: "audio/mpeg",
        remoteUrl: "/api/workspace/media-assets/888",
        source: "media-library",
      },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const session = {
      ...createProjectVoiceoverDraft([segment]),
      subtitleType: "none",
      ttsAssetId: null,
      voiceType: "none",
    };

    expect(
      getWorkspaceSegmentEffectiveSubtitleSettings(session, segment, {
        subtitleColorId: "purple",
        subtitleStyleId: "modern",
      }),
    ).toMatchObject({
      isEnabled: false,
      voiceEnabled: true,
    });

    expect(
      getWorkspaceSegmentEffectiveSubtitleSettings(session, { ...segment, text: `${text} Изменено.` }, {
        subtitleColorId: "purple",
        subtitleStyleId: "modern",
      }).voiceEnabled,
    ).toBe(false);
  });

  it("keeps generated scene voiceover duration estimable when the project voice is disabled", () => {
    const text = "Взбейте яйца с сахаром и солью.";
    const segment = createProjectVoiceoverSegment({
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      text,
      textByLanguage: { ru: text },
      voiceType: null,
      voiceoverAsset: null,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const session = {
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: null,
      voiceType: "none",
    };

    expect(getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session)).toMatchObject({
      source: "estimated",
    });
  });

  it("uses the previous generated scene voice for regeneration when the project voice is disabled", () => {
    const originalText = "Взбейте яйца с сахаром и солью.";
    const updatedText = "Взбейте яйца с сахаром и щепоткой соли.";
    const segment = createProjectVoiceoverSegment({
      originalText,
      originalTextByLanguage: { ru: originalText },
      text: updatedText,
      textByLanguage: { ru: updatedText },
      voiceType: null,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(originalText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const session = {
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: null,
      voiceType: "none",
    };

    expect(getWorkspaceSegmentEffectiveVoiceId(segment, session)).toBe(DEFAULT_STUDIO_VOICE_ID.ru);
  });

  it("restores a scene to disabled voice when the current global voice was enabled later", () => {
    const currentSegment = createProjectVoiceoverSegment({
      text: "Текст сцены сохраняется",
      textByLanguage: { ru: "Текст сцены сохраняется" },
      voiceType: null,
    });
    const baselineSegment = {
      ...createProjectVoiceoverSegment({
        text: "",
        textByLanguage: { ru: "" },
        voiceType: null,
      }),
      voiceoverVoiceType: null,
    };

    expect(
      restoreWorkspaceSegmentEffectiveVoiceFromBaseline(currentSegment, baselineSegment, {
        baselineSession: { voiceType: "none" },
        draftSession: { voiceType: "Misha" },
      }),
    ).toMatchObject({
      text: "Текст сцены сохраняется",
      textByLanguage: { ru: "Текст сцены сохраняется" },
      voiceType: "none",
      voice_type: "none",
    });
  });
});

describe("workspace segment editor visual and voiceover mismatch", () => {
  it("ignores a per-scene voiceover render tail when AI video covers the authoritative scene", () => {
    const text = "Представьте мир, где астероид пролетел мимо Земли.";
    const segment = createProjectVoiceoverSegment({
      currentAsset: {
        assetId: 9395,
        durationSeconds: 7.041,
        kind: "source_ai_video",
        libraryKind: "ai_video",
        mediaType: "video",
        mimeType: "video/mp4",
        role: "source_ai_video",
        sourceKind: "ai_generated",
      } as any,
      duration: 6.98,
      endTime: 6.98,
      mediaType: "video",
      speechDuration: 6.92,
      speechEndTime: 6.92,
      speechStartTime: 0,
      speechWords: [
        {
          confidence: 1,
          endTime: 6.8,
          startTime: 0,
          text,
        },
      ],
      text,
      voiceSourceDuration: 7.22,
      voiceSourceEndTime: 7.22,
      voiceSourceStartTime: 0,
      voiceover: {
        download_url: "/api/workspace/media-assets/9399",
        file_name: "segment-voiceover.wav",
        file_size: 0,
        media_asset_id: 9399,
        mime_type: "audio/wav",
      },
      voiceoverAsset: {
        assetId: 9399,
        durationSeconds: 7.22,
        fileName: "segment-voiceover.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/9399",
        source: "media-library",
      },
      voiceoverAssetId: 9399,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const draft = createProjectVoiceoverDraft([segment]);

    expect(
      shouldIgnoreWorkspaceSegmentMeasuredVoiceoverDuration(
        segment,
        draft,
        "/api/workspace/media-assets/9399",
        7.22,
      ),
    ).toBe(true);
    expect(
      shouldIgnoreWorkspaceSegmentMeasuredVoiceoverDuration(
        { ...segment, text: `${text} Обновлено.` },
        draft,
        "/api/workspace/media-assets/9399",
        7.22,
      ),
    ).toBe(false);

    expect(getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, draft, { allowEstimated: false })).toEqual({
      durationSeconds: 6.98,
      source: "actual",
    });
    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, draft, {
        includeAnyVideoVisual: true,
        visualDurationSeconds: 7.041,
      }),
    ).toBeNull();
    const hydratedDraft = createWorkspaceSegmentEditorDraftSession(draft);
    expect(hydratedDraft.segments[0]).toEqual(expect.objectContaining({
      duration: 7.341,
      endTime: 7.341,
    }));
    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(hydratedDraft.segments[0]!, hydratedDraft, {
        includeAnyVideoVisual: true,
        visualDurationSeconds: 7.041,
      }),
    ).toBeNull();

    const previouslyStretchedSegment = {
      ...segment,
      currentAsset: {
        ...segment.currentAsset!,
        durationSeconds: null,
      },
      duration: 7.22,
      durationSyncMode: "voiceover" as const,
      endTime: 7.22,
    };
    expect(
      getWorkspaceSegmentTimelineVoiceoverDurationInfo(
        previouslyStretchedSegment,
        createProjectVoiceoverDraft([previouslyStretchedSegment]),
        { allowEstimated: false },
      ),
    ).toEqual({
      durationSeconds: 7.22,
      source: "actual",
    });
    const repairedPreviouslyStretchedSegment = syncWorkspaceSegmentMeasuredVideoVisualDuration(
      previouslyStretchedSegment,
      7.041,
      { voiceoverDurationSeconds: 7.22 },
    );
    expect(repairedPreviouslyStretchedSegment).toEqual(expect.objectContaining({
      duration: 7.041,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 7.041,
      manualDurationSeconds: null,
    }));
    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(
        repairedPreviouslyStretchedSegment,
        createProjectVoiceoverDraft([repairedPreviouslyStretchedSegment]),
        {
          includeAnyVideoVisual: true,
          visualDurationSeconds: 7.041,
        },
      ),
    ).toBeNull();
  });

  it("still warns when AI video is shorter than the logical spoken scene", () => {
    const text = "Полная озвучка сцены.";
    const segment = createProjectVoiceoverSegment({
      currentAsset: {
        assetId: 9395,
        durationSeconds: 6.5,
        kind: "source_ai_video",
        libraryKind: "ai_video",
        mediaType: "video",
        mimeType: "video/mp4",
        role: "source_ai_video",
        sourceKind: "ai_generated",
      } as any,
      duration: 6.98,
      endTime: 6.98,
      mediaType: "video",
      speechDuration: 6.92,
      speechEndTime: 6.92,
      speechStartTime: 0,
      speechWords: [
        {
          confidence: 1,
          endTime: 6.8,
          startTime: 0,
          text,
        },
      ],
      text,
      voiceSourceDuration: 7.22,
      voiceSourceEndTime: 7.22,
      voiceSourceStartTime: 0,
      voiceover: {
        download_url: "/api/workspace/media-assets/9399",
        file_name: "segment-voiceover.wav",
        file_size: 0,
        media_asset_id: 9399,
        mime_type: "audio/wav",
      },
      voiceoverAsset: {
        assetId: 9399,
        durationSeconds: 7.22,
        fileName: "segment-voiceover.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/workspace/media-assets/9399",
        source: "media-library",
      },
      voiceoverAssetId: 9399,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const draft = createProjectVoiceoverDraft([segment]);

    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, draft, {
        includeAnyVideoVisual: true,
        visualDurationSeconds: 6.5,
      }),
    ).toEqual({
      visualDurationSeconds: 6.5,
      voiceoverDurationSeconds: 6.92,
      voiceoverDurationSource: "actual",
    });
  });

  it("does not warn about visual and voiceover mismatch when video is explicitly synced to voiceover", () => {
    const visualSyncedSegment = createProjectVoiceoverSegment({
      customVideo: {
        durationSeconds: 5,
        fileName: "scene-video.mp4",
        fileSize: 1024,
        mimeType: "video/mp4",
        objectUrl: "blob:http://localhost/scene-video",
        source: "upload",
      },
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      mediaType: "video",
      speechDuration: 6.2,
      speechDurationSource: "audio",
      speechEndTime: 6.2,
      speechStartTime: 0,
      videoAction: "custom",
    });
    const voiceoverSyncedSegment = createProjectVoiceoverSegment({
      customVideo: {
        durationSeconds: 5,
        fileName: "scene-video.mp4",
        fileSize: 1024,
        mimeType: "video/mp4",
        objectUrl: "blob:http://localhost/scene-video",
        source: "upload",
      },
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      mediaType: "video",
      speechDuration: 6.2,
      speechDurationSource: "audio",
      speechEndTime: 6.2,
      speechStartTime: 0,
      videoAction: "custom",
    });
    const draft = createProjectVoiceoverDraft([visualSyncedSegment]);

    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(visualSyncedSegment, draft, {
        includeAnyVideoVisual: true,
        visualDurationSeconds: 5,
      }),
    ).not.toBeNull();
    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(voiceoverSyncedSegment, draft, {
        includeAnyVideoVisual: true,
        visualDurationSeconds: 5,
      }),
    ).toMatchObject({
      visualDurationSeconds: 5,
      voiceoverDurationSeconds: 6.2,
    });
  });
});

describe("workspace segment editor project voiceover timeline", () => {
  it("recognizes a fresh server voiceover version already reflected by the live draft", () => {
    const baselineSegment = createProjectVoiceoverSegment({
      voiceoverAsset: {
        ...createProjectVoiceoverSegment().voiceoverAsset!,
        assetId: 777,
      },
    });
    const freshSegment = createProjectVoiceoverSegment({
      voiceoverAsset: {
        ...baselineSegment.voiceoverAsset!,
        assetId: 778,
      },
    });
    const baselineSession = createProjectVoiceoverDraft([baselineSegment]);
    const freshSession = createProjectVoiceoverDraft([freshSegment]);

    expect(
      doesWorkspaceSegmentEditorDraftReflectFreshVoiceoverAssets(
        createProjectVoiceoverDraft([freshSegment]),
        freshSession,
        baselineSession,
      ),
    ).toBe(true);
    expect(
      doesWorkspaceSegmentEditorDraftReflectFreshVoiceoverAssets(
        createProjectVoiceoverDraft([baselineSegment]),
        freshSession,
        baselineSession,
      ),
    ).toBe(false);
  });

  it("treats an ffmpeg-rendered photo wrapper as a still visual", () => {
    const segment = createProjectVoiceoverSegment({
      currentAsset: {
        assetId: 8519,
        kind: "rendered_segment",
        libraryKind: "photo_animation",
        mediaType: "video",
        mimeType: "video/mp4",
        renderedAnimationMode: "ffmpeg",
        renderedViaI2v: false,
        role: "rendered_segment",
        sourceKind: "ai_generated",
      } as any,
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=4170&segmentIndex=0&source=current&delivery=playback",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=4170&segmentIndex=0&source=current&delivery=preview",
      currentSourceKind: "ai_generated",
      mediaType: "photo",
      originalAsset: {
        assetId: 8512,
        kind: "source_ai_image",
        mediaType: "photo",
        mimeType: "image/png",
        role: "source_ai_image",
        sourceKind: "ai_generated",
      } as any,
      originalPreviewUrl: "/api/workspace/media-assets/8512",
      originalSourceKind: "ai_generated",
      videoAction: "original",
    });

    expect(getWorkspaceSegmentLatestVisualAction(segment)).toBe("original");
    expect(getWorkspaceSegmentPreviewKind(segment)).toBe("image");
    expect(getWorkspaceSegmentSelectedVisualPreviewKind(segment)).toBe("image");
  });

  it("does not treat an existing scene slot as the source video duration", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 3.8,
      endTime: 3.8,
      mediaType: "video",
      speechDuration: 2.1,
      speechEndTime: 2.1,
      speechStartTime: 0,
    });

    expect(getWorkspaceSegmentKnownVisualDurationSeconds(segment)).toBeNull();
  });

  it("uses the standard generated-video source duration for the extension menu when only the scene slot is known", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 2.6,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      endTime: 19.5,
      manualDurationSeconds: 2.6,
      mediaType: "video",
      speechDuration: 1.9,
      speechEndTime: 18.8,
      speechStartTime: 16.9,
      startTime: 16.9,
      videoAction: "custom",
    });

    expect(getWorkspaceSegmentKnownVisualDurationSeconds(segment)).toBeNull();
    expect(resolveWorkspaceSegmentVideoExtensionMenuSourceDurationSeconds(segment)).toBe(5);
  });

  it("uses the actual video duration for extension when the voiceover makes the scene longer", () => {
    const segment = createProjectVoiceoverSegment({
      currentAsset: {
        assetId: 505,
        durationSeconds: 5,
        kind: "current_rendered_segment",
        mediaType: "video",
        mimeType: "video/mp4",
      } as any,
      duration: 5.9,
      durationExtensionSourceDurationSeconds: 5.9,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      endTime: 5.9,
      manualDurationSeconds: 5.9,
      mediaType: "video",
      speechDuration: 5.9,
      speechEndTime: 5.9,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "custom",
    });
    const draft = createProjectVoiceoverDraft([segment]);

    expect(resolveWorkspaceSegmentVideoExtensionMenuSourceDurationSeconds(segment)).toBe(5);
    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, draft, {
        includeAnyVideoVisual: true,
        visualDurationSeconds: 5,
      }),
    ).toMatchObject({
      visualDurationSeconds: 5,
      voiceoverDurationSeconds: 5.9,
    });
  });

  it("does not preserve stale project voiceover speech boundaries after auto visual duration repair", () => {
    const firstSegment = createProjectVoiceoverSegment({
      duration: 7,
      endTime: 7,
      mediaType: "photo",
      speechDuration: 4.4,
      speechDurationSource: "audio",
      speechEndTime: 4.4,
      speechStartTime: 0,
      voiceoverAsset: null,
    });
    const secondSegment = createProjectVoiceoverSegment({
      duration: 5,
      endTime: 12,
      index: 1,
      mediaType: "photo",
      speechDuration: 5,
      speechDurationSource: "audio",
      speechEndTime: 14.4,
      speechStartTime: 9.4,
      startTime: 7,
      voiceoverAsset: null,
    });

    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([firstSegment, secondSegment]),
      ttsAssetId: 777,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 4.4,
      durationMode: "auto",
      endTime: 4.4,
      manualDurationSeconds: null,
      startTime: 0,
    }));
    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      startTime: 4.4,
    }));
  });

  it("preserves project voiceover source-window pauses when segment speech timings are local", () => {
    const firstSegment = createProjectVoiceoverSegment({
      duration: 4.7,
      endTime: 4.7,
      index: 0,
      mediaType: "video",
      speechDuration: 4.7,
      speechDurationSource: "audio",
      speechEndTime: 4.7,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "custom",
      voiceSourceDuration: 4.7,
      voiceSourceEndTime: 5,
      voiceSourceStartTime: 0,
    });
    const secondSegment = createProjectVoiceoverSegment({
      duration: 5.4,
      endTime: 10.1,
      index: 1,
      mediaType: "video",
      speechDuration: 5.4,
      speechDurationSource: "audio",
      speechEndTime: 10.1,
      speechStartTime: 4.7,
      startTime: 4.7,
      videoAction: "custom",
      voiceSourceDuration: 5.4,
      voiceSourceEndTime: 10.5,
      voiceSourceStartTime: 5,
    });

    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      createProjectVoiceoverDraft([firstSegment, secondSegment]),
    );

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 5,
      endTime: 5,
      startTime: 0,
    }));
    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      duration: 5.8,
      endTime: 10.8,
      startTime: 5,
    }));
  });

  it("does not append a stale project timeline tail to the last voice-owned scene", () => {
    const firstSegment = createProjectVoiceoverSegment({
      duration: 4.5,
      durationSyncMode: "voiceover",
      endTime: 4.5,
      index: 0,
      mediaType: "video",
      startTime: 0,
      videoAction: "custom",
      voiceoverAsset: null,
      voiceSourceDuration: 4,
      voiceSourceEndTime: 4,
      voiceSourceStartTime: 0,
    });
    const secondSegment = createProjectVoiceoverSegment({
      duration: 6.5,
      durationSyncMode: "voiceover",
      endTime: 11,
      index: 1,
      mediaType: "video",
      startTime: 4.5,
      videoAction: "custom",
      voiceoverAsset: null,
      voiceSourceDuration: 4.8,
      voiceSourceEndTime: 8.8,
      voiceSourceStartTime: 4,
    });
    const session = {
      ...createProjectVoiceoverDraft([firstSegment, secondSegment]),
      ttsAssetId: 777,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    };

    const normalized = createWorkspaceSegmentEditorDraftSession(session);

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 4,
      endTime: 4,
      startTime: 0,
    }));
    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      duration: 5.1,
      endTime: 9.1,
      startTime: 4,
    }));
  });

  it("keeps the rendered timeline and project settings when a finalized project has stale voice-owned flags", () => {
    const firstSegment = createProjectVoiceoverSegment({
      currentPlaybackUrl: "/api/workspace/media-assets/1001/content",
      duration: 5.042,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      endTime: 5.042,
      index: 0,
      manualDurationSeconds: 5.042,
      mediaType: "video",
      startTime: 0,
      voiceoverAsset: null,
      voiceSourceDuration: 4.3,
      voiceSourceEndTime: 4.3,
      voiceSourceStartTime: 0,
    });
    const secondSegment = createProjectVoiceoverSegment({
      currentPlaybackUrl: "/api/workspace/media-assets/1002/content",
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      endTime: 10.042,
      index: 1,
      manualDurationSeconds: 5,
      mediaType: "video",
      startTime: 5.042,
      voiceoverAsset: null,
      voiceSourceDuration: 3.64,
      voiceSourceEndTime: 3.64,
      voiceSourceStartTime: 0,
    });
    const session = {
      ...createProjectVoiceoverDraft([firstSegment, secondSegment]),
      finalVideoAssetId: 9001,
      finalVideoStale: false,
      musicName: "energetic_9.mp3",
      musicType: "energetic",
      subtitleColor: "purple",
      subtitleStyle: "modern",
      subtitleType: "ai",
      voiceType: "Liam_Timing",
    };

    const normalized = createWorkspaceSegmentEditorDraftSession(session);

    expect(normalized.segments.map((segment) => ({
      duration: segment.duration,
      durationMode: segment.durationMode,
      durationSyncMode: segment.durationSyncMode,
      endTime: segment.endTime,
      manualDurationSeconds: segment.manualDurationSeconds,
      startTime: segment.startTime,
    }))).toEqual([
      {
        duration: 5.042,
        durationMode: "manual",
        durationSyncMode: "visual",
        endTime: 5.042,
        manualDurationSeconds: 5.042,
        startTime: 0,
      },
      {
        duration: 5,
        durationMode: "manual",
        durationSyncMode: "visual",
        endTime: 10.042,
        manualDurationSeconds: 5,
        startTime: 5.042,
      },
    ]);
    expect(normalized).toEqual(expect.objectContaining({
      musicName: "energetic_9.mp3",
      musicType: "energetic",
      subtitleColor: "purple",
      subtitleStyle: "modern",
      subtitleType: "ai",
      voiceType: "Liam_Timing",
    }));

    const restoredStoredDraft = normalizeLegacyWorkspaceSegmentEditorDraftSession(session);
    expect(restoredStoredDraft.segments.map((segment) => segment.durationSyncMode)).toEqual([
      "visual",
      "visual",
    ]);
    expect(restoredStoredDraft.segments.map((segment) => segment.duration)).toEqual([5.042, 5]);

    const normalizedStoredDraft = normalizeStoredWorkspaceSegmentEditorDraftSession({
      ...session,
      storageVersion: 3,
    } as WorkspaceSegmentEditorDraftSession);
    expect(normalizedStoredDraft.segments.map((segment) => segment.durationSyncMode)).toEqual([
      "visual",
      "visual",
    ]);
    expect(normalizedStoredDraft.segments.map((segment) => segment.duration)).toEqual([5.042, 5]);

    const staleStoredSegment = {
      ...normalized.segments[0],
      duration: 4.3,
      durationMode: "auto" as const,
      durationSyncMode: "voiceover" as const,
      durationSyncModeUserSelected: true,
      endTime: 4.3,
      manualDurationSeconds: null,
    };
    expect(
      isWorkspaceSegmentStaleFinalizedVoiceTrim(staleStoredSegment, normalized.segments[0], normalized),
    ).toBe(true);

    const staleStoredDraft = {
      ...normalized,
      segments: normalized.segments.map((segment, index) => {
        const duration = index === 0 ? 4.3 : 3.64;
        const startTime = index === 0 ? 0 : 4.3;
        return {
          ...segment,
          duration,
          durationMode: "auto" as const,
          durationSyncMode: "voiceover" as const,
          durationSyncModeUserSelected: true,
          endTime: startTime + duration,
          manualDurationSeconds: null,
          startTime,
        };
      }),
    };
    const refreshedStoredDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(staleStoredDraft, session, {
      repairStaleFinalizedVoiceTrim: true,
    });
    expect(refreshedStoredDraft.segments.map((segment) => segment.duration)).toEqual([5.042, 5]);
    expect(refreshedStoredDraft.segments.map((segment) => segment.durationSyncMode)).toEqual([
      "visual",
      "visual",
    ]);
  });

  it("does not warn when an ffmpeg-rendered photo segment is shorter than voiceover", () => {
    const segment = createProjectVoiceoverSegment({
      currentAsset: {
        assetId: 6670,
        durationSeconds: 6.52,
        kind: "current_rendered_segment",
        libraryKind: "photo_animation",
        mediaType: "video",
        mimeType: "video/mp4",
        renderedAnimationMode: "ffmpeg",
        renderedViaI2v: false,
        role: "rendered_segment",
        sourceKind: "ai_generated",
      } as any,
      duration: 8.46,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      endTime: 8.46,
      manualDurationSeconds: 8.46,
      mediaType: "video",
      speechDuration: 8.46,
      speechEndTime: 8.46,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "original",
    });

    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, createProjectVoiceoverDraft([segment]), {
        includeAnyVideoVisual: true,
        visualDurationSeconds: 6.52,
      }),
    ).toBeNull();
  });

  it("keeps warning when a real i2v photo animation is shorter than voiceover", () => {
    const segment = createProjectVoiceoverSegment({
      currentAsset: {
        assetId: 6671,
        durationSeconds: 6.52,
        kind: "current_rendered_segment",
        libraryKind: "photo_animation",
        mediaType: "video",
        mimeType: "video/mp4",
        renderedAnimationMode: "i2v",
        renderedViaI2v: true,
        role: "rendered_segment",
        sourceKind: "ai_generated",
      } as any,
      duration: 8.46,
      endTime: 8.46,
      mediaType: "video",
      speechDuration: 8.46,
      speechEndTime: 8.46,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "original",
    });

    expect(
      getWorkspaceSegmentVisualAudioDurationMismatchInfo(segment, createProjectVoiceoverDraft([segment]), {
        includeAnyVideoVisual: true,
        visualDurationSeconds: 6.52,
      }),
    ).toEqual({
      visualDurationSeconds: 6.52,
      voiceoverDurationSeconds: 8.46,
      voiceoverDurationSource: "actual",
    });
  });

  it("uses the selected draft video as the AI duration extension base source", () => {
    const selectedVideo = {
      assetId: 606,
      durationSeconds: 5,
      fileName: "library-video.mp4",
      fileSize: 0,
      mimeType: "video/mp4",
      posterUrl: "/api/workspace/media-assets/606/poster",
      remoteUrl: "/api/workspace/media-assets/606/playback",
      source: "media-library" as const,
    };
    const segment = createProjectVoiceoverSegment({
      customVideo: selectedVideo,
      duration: 5.9,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      endTime: 5.9,
      manualDurationSeconds: 5.9,
      mediaType: "video",
      speechDuration: 5.9,
      speechEndTime: 5.9,
      videoAction: "custom",
    });

    expect(getWorkspaceSegmentCurrentVideoSourceAsset(segment)).toEqual(selectedVideo);
    expect(canWorkspaceSegmentUseVideoExtensionTool(segment)).toBe(true);
    expect(resolveWorkspaceSegmentVideoExtensionMenuSourceDurationSeconds(segment)).toBe(5);
  });

  it("offers AI video extension for generated photo animations", () => {
    const segment = createProjectVoiceoverSegment({
      aiVideoAsset: {
        assetId: 611,
        durationSeconds: 4.6,
        fileName: "segment-photo-animation.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        posterUrl: "/api/workspace/media-assets/611/poster",
        remoteUrl: "/api/workspace/media-assets/611/playback",
        source: "media-library",
      },
      aiVideoGeneratedMode: "photo_animation",
      duration: 4.6,
      endTime: 4.6,
      mediaType: "photo",
      photoAnimationSourceAsset: {
        assetId: 610,
        fileName: "segment-ai-photo.jpg",
        fileSize: 0,
        mimeType: "image/jpeg",
        remoteUrl: "/api/workspace/media-assets/610",
        source: "media-library",
      },
      videoAction: "photo_animation",
    });

    expect(getWorkspaceSegmentSelectedVisualPreviewKind(segment)).toBe("video");
    expect(canWorkspaceSegmentUseVideoExtensionTool(segment)).toBe(true);
    expect(getWorkspaceSegmentCurrentVideoSourceAsset(segment)).toEqual(segment.aiVideoAsset);
  });

  it("uses the longer current video slot for the extension menu over a stale stored source duration", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 11.8,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 11.8,
      manualDurationSeconds: 11.8,
      mediaType: "video",
      speechDuration: 11.7,
      speechEndTime: 11.7,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "custom",
    });

    expect(resolveWorkspaceSegmentVideoExtensionMenuSourceDurationSeconds(segment)).toBe(11.8);
  });

  it("keeps a longer stored source duration available after trimming a video", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 7,
      durationExtensionSourceDurationSeconds: 60,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 7,
      manualDurationSeconds: 7,
      mediaType: "video",
      speechDuration: 5,
      speechEndTime: 5,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "custom",
    });

    expect(getWorkspaceSegmentKnownVisualDurationSeconds(segment)).toBe(7);
    expect(resolveWorkspaceSegmentVideoExtensionMenuSourceDurationSeconds(segment)).toBe(60);
  });

  it("keeps pending video extension previews as video even when the source frame is an image", () => {
    const segment = createProjectVoiceoverSegment({
      currentAsset: {
        assetId: 610,
        kind: "current_rendered_segment",
        libraryKind: "ai_photo",
        mediaType: "video",
        mimeType: "video/mp4",
        role: "source_ai_image",
        sourceKind: "ai_generated",
      } as any,
      duration: 10,
      durationExtensionSourceDurationSeconds: 10,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 10,
      manualDurationSeconds: 10,
      mediaType: "photo",
      photoAnimationSourceAsset: {
        durationSeconds: 5,
        fileName: "segment-extension-source.jpg",
        fileSize: 0,
        mimeType: "image/jpeg",
        remoteUrl: "/api/workspace/media-assets/610/source",
        source: "media-library",
      },
      videoAction: "photo_animation",
    });

    expect(getWorkspaceSegmentSelectedVisualPreviewKind(segment)).toBe("video");
    expect(getWorkspaceSegmentPreviewKind(segment)).toBe("video");
    expect(getWorkspaceSegmentKnownVisualDurationSeconds(segment)).toBe(10);
  });

  it("restores visual timeline duration from a visual snapshot", () => {
    const currentSegment = createProjectVoiceoverSegment({
      aiPhotoAsset: {
        assetId: 301,
        fileName: "generated-photo.png",
        fileSize: 1024,
        mimeType: "image/png",
        remoteUrl: "/api/workspace/media-assets/301",
        source: "media-library",
      },
      duration: 4.7,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 4.7,
      manualDurationSeconds: null,
      mediaType: "photo",
      videoAction: "ai_photo",
    });
    const snapshot = createProjectVoiceoverSegment({
      customVideo: {
        durationSeconds: 5,
        fileName: "previous-video.mp4",
        fileSize: 2048,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/300",
        source: "media-library",
      },
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "video",
      videoAction: "custom",
    });

    const restored = restoreWorkspaceSegmentTimelineSnapshot(currentSegment, snapshot, "visual");

    expect(restored).toEqual(expect.objectContaining({
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 5,
      manualDurationSeconds: 5,
      startTime: 0,
      videoAction: "custom",
    }));
  });

  it("walks through consecutive visual replacements instead of jumping to the baseline", () => {
    const originalSegment = createProjectVoiceoverSegment({
      currentPlaybackUrl: "/api/workspace/media-assets/100",
      currentPreviewUrl: "/api/workspace/media-assets/100",
      videoAction: "original",
    });
    const firstVisualSegment = createProjectVoiceoverSegment({
      customVideo: {
        assetId: 101,
        fileName: "first.png",
        fileSize: 1024,
        mimeType: "image/png",
        remoteUrl: "/api/workspace/media-assets/101",
        source: "media-library",
      },
      videoAction: "custom",
    });
    const secondVisualSegment = createProjectVoiceoverSegment({
      customVideo: {
        assetId: 102,
        fileName: "second.png",
        fileSize: 1024,
        mimeType: "image/png",
        remoteUrl: "/api/workspace/media-assets/102",
        source: "media-library",
      },
      videoAction: "custom",
    });

    let history = pushWorkspaceSegmentTimelineVisualHistorySnapshot(undefined, originalSegment, 50);
    history = pushWorkspaceSegmentTimelineVisualHistorySnapshot(history, firstVisualSegment, 50);

    const firstBack = stepWorkspaceSegmentTimelineVisualHistoryBack(history, secondVisualSegment, 50);
    expect(firstBack?.snapshot.customVideo?.assetId).toBe(101);

    const secondBack = stepWorkspaceSegmentTimelineVisualHistoryBack(
      firstBack?.history,
      firstBack?.snapshot ?? firstVisualSegment,
      50,
    );
    expect(secondBack?.snapshot.currentPreviewUrl).toBe("/api/workspace/media-assets/100");

    const firstForward = stepWorkspaceSegmentTimelineVisualHistoryForward(
      secondBack?.history,
      secondBack?.snapshot ?? originalSegment,
      50,
    );
    expect(firstForward?.snapshot.customVideo?.assetId).toBe(101);
  });

  it("does not treat durable upload metadata as another visual replacement", () => {
    const pendingUpload = createProjectVoiceoverSegment({
      customVideo: {
        fileName: "visual.png",
        fileSize: 1024,
        mimeType: "image/png",
        objectUrl: "blob:visual-upload",
        source: "upload",
      },
      videoAction: "custom",
    });
    const durableUpload = createProjectVoiceoverSegment({
      customVideo: {
        ...pendingUpload.customVideo!,
        assetId: 103,
        remoteUrl: "/api/workspace/media-assets/103",
      },
      videoAction: "custom",
    });

    expect(getWorkspaceSegmentDraftVisualHistoryIdentity(durableUpload)).toBe(
      getWorkspaceSegmentDraftVisualHistoryIdentity(pendingUpload),
    );
  });

  it("restores talking photo visual snapshots with embedded audio timing", () => {
    const currentSegment = createProjectVoiceoverSegment({
      currentPlaybackUrl: "/api/workspace/projects/77/segments/0/original",
      currentPreviewUrl: "/api/workspace/projects/77/segments/0/original",
      duration: 4,
      endTime: 4,
      mediaType: "video",
      speechDuration: null,
      speechDurationSource: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      videoAction: "original",
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
    });
    const snapshot = createProjectVoiceoverSegment({
      aiVideoAsset: {
        assetId: 909,
        durationSeconds: 4.9,
        fileName: "talking-photo.mp4",
        fileSize: 2048,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/909",
        source: "media-library",
      },
      aiVideoGeneratedFromPrompt: "Привет от ведущего",
      aiVideoGeneratedMode: "talking_photo",
      aiVideoPrompt: "Привет от ведущего",
      aiVideoPromptInitialized: true,
      currentAsset: {
        assetId: 909,
        durationSeconds: 4.9,
        kind: "segment_current",
        libraryKind: "talking_photo",
        mediaType: "video",
        mimeType: "video/mp4",
        sourceKind: "generated",
      } as any,
      currentPlaybackUrl: "/api/workspace/media-assets/909/playback",
      currentPreviewUrl: "/api/workspace/media-assets/909/preview",
      duration: 4.9,
      endTime: 4.9,
      mediaType: "video",
      photoAnimationSourceAsset: {
        assetId: 808,
        fileName: "speaker.png",
        fileSize: 1024,
        mimeType: "image/png",
        remoteUrl: "/api/workspace/media-assets/808",
        source: "media-library",
      },
      speechDuration: 4.6,
      speechDurationSource: "audio",
      speechEndTime: 4.6,
      speechStartTime: 0,
      speechWords: [{ confidence: 0.95, endTime: 0.55, startTime: 0, text: "Привет" }],
      videoAction: "talking_photo",
      voiceSourceDuration: 4.6,
      voiceSourceEndTime: 4.6,
      voiceSourceStartTime: 0,
    });

    const restored = restoreWorkspaceSegmentTimelineSnapshot(currentSegment, snapshot, "visual");

    expect(restored).toEqual(expect.objectContaining({
      aiVideoGeneratedFromPrompt: "Привет от ведущего",
      aiVideoGeneratedMode: "talking_photo",
      aiVideoPrompt: "Привет от ведущего",
      aiVideoPromptInitialized: true,
      currentPlaybackUrl: "/api/workspace/media-assets/909/playback",
      currentPreviewUrl: "/api/workspace/media-assets/909/preview",
      duration: 4.9,
      endTime: 4.9,
      mediaType: "video",
      speechDuration: 4.6,
      speechDurationSource: "audio",
      speechEndTime: 4.6,
      speechStartTime: 0,
      videoAction: "talking_photo",
      voiceSourceDuration: 4.6,
      voiceSourceEndTime: 4.6,
      voiceSourceStartTime: 0,
    }));
    expect(restored.aiVideoAsset).toEqual(expect.objectContaining({ assetId: 909 }));
    expect(restored.photoAnimationSourceAsset).toEqual(expect.objectContaining({ assetId: 808 }));
    expect(restored.speechWords).toEqual([{ confidence: 0.95, endTime: 0.55, startTime: 0, text: "Привет" }]);
    expect(restored.speechWords).not.toBe(snapshot.speechWords);
  });

  it("restores voice timing coordinate markers atomically with the snapshot timing", () => {
    const currentSegment = createProjectVoiceoverSegment({
      endTime: 7,
      index: 1,
      speechDuration: 3,
      speechEndTime: 7,
      speechStartTime: 4,
      speechTimingCoordinateSpace: "asset_local",
      startTime: 4,
      voiceSourceCoordinateSpace: "global_audio",
      voiceSourceDuration: 3,
      voiceSourceEndTime: 7,
      voiceSourceStartTime: 4,
    });
    const snapshot = createProjectVoiceoverSegment({
      endTime: 7,
      index: 1,
      speechDuration: 2.8,
      speechEndTime: 6.9,
      speechStartTime: 4.1,
      speechTimingCoordinateSpace: "global_timeline",
      startTime: 4,
      voiceSourceCoordinateSpace: "asset_local",
      voiceSourceDuration: 3,
      voiceSourceEndTime: 3,
      voiceSourceStartTime: 0,
    });

    const restored = restoreWorkspaceSegmentVoiceTextDraftSnapshot(currentSegment, snapshot);

    expect(restored).toEqual(expect.objectContaining({
      speechDuration: 2.8,
      speechEndTime: 6.9,
      speechStartTime: 4.1,
      speechTimingCoordinateSpace: "global_timeline",
      voiceSourceCoordinateSpace: "asset_local",
      voiceSourceDuration: 3,
      voiceSourceEndTime: 3,
      voiceSourceStartTime: 0,
    }));
  });

  it("restores baseline visual timeline duration when resetting generated visual to original", () => {
    const currentSegment = createProjectVoiceoverSegment({
      aiPhotoAsset: {
        assetId: 301,
        fileName: "generated-photo.png",
        fileSize: 1024,
        mimeType: "image/png",
        remoteUrl: "/api/workspace/media-assets/301",
        source: "media-library",
      },
      duration: 4.7,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 4.7,
      manualDurationSeconds: null,
      originalPreviewUrl: "/api/workspace/projects/77/segments/0/original",
      videoAction: "ai_photo",
    });
    const baselineSegment = createProjectVoiceoverSegment({
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 5,
      manualDurationSeconds: 5,
      originalPreviewUrl: "/api/workspace/projects/77/segments/0/original",
      videoAction: "original",
    });

    const restored = resetWorkspaceSegmentDraftVisualToOriginal(currentSegment, 77, baselineSegment);

    expect(restored).toEqual(expect.objectContaining({
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 5,
      manualDurationSeconds: 5,
      startTime: 0,
      videoAction: "original",
      visualReset: true,
    }));
  });

  it("auto-trims to voiceover only when the video tail is shorter than one second", () => {
    expect(shouldAutoTrimWorkspaceSegmentVideoToVoiceover(11.8, 11.7)).toBe(true);
    expect(shouldAutoTrimWorkspaceSegmentVideoToVoiceover(12.7, 11.7)).toBe(false);
    expect(shouldAutoTrimWorkspaceSegmentVideoToVoiceover(11.7, 11.8)).toBe(false);
  });

  it("trims a default manual video tail to a fresh voiceover duration", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 11.8,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 11.8,
      manualDurationSeconds: 11.8,
      mediaType: "video",
      speechDuration: 11.7,
      speechDurationSource: "audio",
      speechEndTime: 11.7,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "original",
    });

    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: 777,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    }, { preserveSourceTimelineEnd: false });

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 12,
      durationExtensionSourceDurationSeconds: null,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 12,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("extends a manual visual slot when regenerated voiceover is longer", () => {
    const segment = createProjectVoiceoverSegment({
      customVideo: {
        durationSeconds: 5,
        fileName: "scene-video.mp4",
        fileSize: 1024,
        mimeType: "video/mp4",
        objectUrl: "blob:http://localhost/scene-video",
        source: "upload",
      },
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "video",
      speechDuration: 16.6,
      speechDurationSource: "audio",
      speechEndTime: 16.6,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "custom",
      voiceoverAsset: {
        assetId: 778,
        durationSeconds: 16.6,
        fileName: "scene-voiceover.mp3",
        fileSize: 0,
        mimeType: "audio/mpeg",
        remoteUrl: "/api/workspace/media-assets/778",
        source: "media-library",
      },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("Segment"),
      voiceoverVoiceType: "Russian_BrightHeroine",
    });

    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: null,
      voiceType: "none",
    }, { preserveSourceTimelineEnd: false });

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 16.9,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 16.9,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("preserves a user-selected full source video duration when the voiceover tail is short", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "video",
      speechDuration: 4.4,
      speechDurationSource: "audio",
      speechEndTime: 4.4,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "original",
    });

    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: 777,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    }, { preserveSourceTimelineEnd: false });

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

  it("does not inflate a generated-video visual slot when its measured duration is not loaded yet", () => {
    const firstSegment = createProjectVoiceoverSegment({
      duration: 11.8,
      durationMode: "manual",
      endTime: 11.8,
      index: 0,
      manualDurationSeconds: 11.8,
      mediaType: "video",
      startTime: 0,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const secondSegment = createProjectVoiceoverSegment({
      currentPlaybackUrl: "/api/workspace/projects/77/segments/1/video",
      currentSourceKind: "ai_generated",
      duration: 4,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 15.8,
      index: 1,
      manualDurationSeconds: 4,
      mediaType: "video",
      speechDuration: 2.7,
      speechEndTime: 14.5,
      speechStartTime: 11.8,
      startTime: 11.8,
      videoAction: "original",
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });

    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([firstSegment, secondSegment]),
      ttsAssetId: null,
      voiceType: "none",
    }, { preserveSourceTimelineEnd: false });

    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      duration: 4,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 15.8,
      manualDurationSeconds: 4,
      startTime: 11.8,
    }));
  });

  it("does not expand a voiceover-trimmed generated-video slot to the default source duration", () => {
    const segment = createProjectVoiceoverSegment({
      currentPlaybackUrl: "/api/workspace/projects/77/segments/1/video",
      currentSourceKind: "ai_generated",
      duration: 2.7,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      endTime: 14.5,
      index: 1,
      manualDurationSeconds: 2.7,
      mediaType: "video",
      speechDuration: 2.7,
      speechEndTime: 14.5,
      speechStartTime: 11.8,
      startTime: 11.8,
      videoAction: "original",
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });

    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: null,
      voiceType: "none",
    }, { preserveSourceTimelineEnd: false });

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 2.7,
      durationSyncMode: "voiceover",
      endTime: 2.7,
      manualDurationSeconds: 2.7,
      startTime: 0,
    }));
  });

  it("keeps an unmeasured generated-video slot at its existing duration when a blank scene is appended", () => {
    const firstSegment = createProjectVoiceoverSegment({
      duration: 11.7,
      durationMode: "manual",
      endTime: 11.7,
      index: 0,
      manualDurationSeconds: 11.7,
      mediaType: "video",
      speechDuration: 11.7,
      speechEndTime: 11.7,
      speechStartTime: 0,
      startTime: 0,
    });
    const secondSegment = createProjectVoiceoverSegment({
      currentPlaybackUrl: "/api/workspace/projects/77/segments/1/video",
      currentSourceKind: "ai_generated",
      duration: 4.1,
      durationMode: "auto",
      durationSyncMode: "visual",
      endTime: 15.8,
      index: 1,
      manualDurationSeconds: null,
      mediaType: "video",
      speechDuration: 2.7,
      speechEndTime: 14.4,
      speechStartTime: 11.7,
      startTime: 11.7,
      videoAction: "original",
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([firstSegment, secondSegment]),
      segments: [firstSegment, secondSegment],
    }, { preserveSourceTimelineEnd: false });
    const insertedSegment = createWorkspaceSegmentEditorInsertedSegment({
      draft: normalized,
      insertAt: normalized.segments.length,
    });
    const withInsertedSegment = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...normalized,
      segments: [...normalized.segments, insertedSegment],
    }, { preserveSourceTimelineEnd: false });

    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      duration: 4.1,
      durationMode: "auto",
      durationSyncMode: "visual",
      endTime: 15.8,
      manualDurationSeconds: null,
      startTime: 11.7,
    }));
    expect(withInsertedSegment.segments[1]).toEqual(expect.objectContaining({
      duration: 4.1,
      durationMode: "auto",
      durationSyncMode: "visual",
      endTime: 15.8,
      manualDurationSeconds: null,
      startTime: 11.7,
    }));
    expect(withInsertedSegment.segments[2]).toEqual(expect.objectContaining({
      duration: 0,
      endTime: 15.8,
      startTime: 15.8,
    }));
  });

  it("repairs a stale generated-video slot to its measured media duration when a blank scene is appended", () => {
    const firstSegment = createProjectVoiceoverSegment({
      duration: 11.7,
      durationMode: "manual",
      endTime: 11.7,
      index: 0,
      manualDurationSeconds: 11.7,
      mediaType: "video",
      speechDuration: 11.7,
      speechEndTime: 11.7,
      speechStartTime: 0,
      startTime: 0,
    });
    const secondSegment = createProjectVoiceoverSegment({
      currentAsset: {
        assetId: 5025,
        createdAt: null,
        deletedAt: null,
        downloadPath: "/api/media/5025/download",
        downloadUrl: null,
        durationSeconds: 4.1,
        expiresAt: null,
        isCurrent: true,
        kind: "segment_current",
        libraryKind: null,
        lifecycle: "ready",
        mediaType: "video",
        mimeType: "video/mp4",
        originalUrl: null,
        playbackUrl: "/api/media/5025/download",
        projectId: 77,
        role: "segment_current",
        segmentIndex: 1,
        sourceKind: "ai_generated",
        status: "ready",
        storageKey: null,
      },
      currentPlaybackUrl: "/api/workspace/projects/77/segments/1/video",
      currentSourceKind: "ai_generated",
      duration: 4.1,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "auto",
      durationSyncMode: "visual",
      endTime: 15.8,
      index: 1,
      manualDurationSeconds: null,
      mediaType: "video",
      speechDuration: 2.7,
      speechEndTime: 14.4,
      speechStartTime: 11.7,
      startTime: 11.7,
      videoAction: "original",
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([firstSegment, secondSegment]),
      segments: [firstSegment, secondSegment],
    }, { preserveSourceTimelineEnd: false });
    const insertedSegment = createWorkspaceSegmentEditorInsertedSegment({
      draft: normalized,
      insertAt: normalized.segments.length,
    });
    const withInsertedSegment = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...normalized,
      segments: [...normalized.segments, insertedSegment],
    }, { preserveSourceTimelineEnd: false });

    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      duration: 4.1,
      durationExtensionSourceDurationSeconds: null,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 15.8,
      manualDurationSeconds: 4.1,
      startTime: 11.7,
    }));
    expect(withInsertedSegment.segments[1]).toEqual(expect.objectContaining({
      duration: 4.1,
      durationExtensionSourceDurationSeconds: null,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 15.8,
      manualDurationSeconds: 4.1,
      startTime: 11.7,
    }));
    expect(withInsertedSegment.segments[2]).toEqual(expect.objectContaining({
      duration: 0,
      endTime: 15.8,
      startTime: 15.8,
    }));
  });

  it("refreshes stored original-video source duration from the fresh server session", () => {
    const segment = createProjectVoiceoverSegment({
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=1&source=original",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=1&source=original&delivery=preview",
      currentSourceKind: "ai_generated",
      duration: 2.7,
      durationMode: "auto",
      endTime: 14.4,
      index: 1,
      mediaType: "video",
      originalPlaybackUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=1&source=original",
      originalPreviewUrl: "/api/workspace/project-segment-video?projectId=77&segmentIndex=1&source=original&delivery=preview",
      originalSourceKind: "ai_generated",
      speechDuration: 2.7,
      speechEndTime: 14.4,
      speechStartTime: 11.7,
      startTime: 11.7,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const liveDraft = createProjectVoiceoverDraft([segment]);
    const freshSession = {
      ...liveDraft,
      segments: [
        {
          ...segment,
          durationExtensionSourceDurationSeconds: 5,
        },
      ],
    };

    const refreshed = refreshWorkspaceSegmentEditorDraftWithFreshSession(liveDraft, freshSession, {
      preserveUnbaselinedManualDuration: false,
    });

    expect(refreshed.segments[0]).toEqual(expect.objectContaining({
      duration: 3,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      manualDurationSeconds: null,
    }));
    expect(getWorkspaceSegmentKnownVisualDurationSeconds(refreshed.segments[0])).toBe(5);
  });

  it("keeps a completed photo animation live when a refresh still returns the old image", () => {
    const originalSegment = createProjectVoiceoverSegment({
      currentPreviewUrl: "/api/workspace/media-assets/101",
      currentSourceKind: "stock",
      mediaType: "photo",
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const liveAnimatedSegment = {
      ...originalSegment,
      aiVideoAsset: {
        assetId: 505,
        durationSeconds: 5.1,
        fileName: "scene-1-animation.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/505/playback",
      },
      aiVideoGeneratedMode: "photo_animation" as const,
      videoAction: "photo_animation" as const,
    };
    const liveDraft = createProjectVoiceoverDraft([liveAnimatedSegment]);
    const staleFreshSession = createProjectVoiceoverDraft([originalSegment]);

    expect(
      hasWorkspaceSegmentEditorUnreflectedLiveGeneratedVideo(
        liveDraft,
        staleFreshSession,
        createProjectVoiceoverDraft([originalSegment]),
      ),
    ).toBe(true);

    const refreshed = refreshWorkspaceSegmentEditorDraftWithFreshSession(liveDraft, staleFreshSession, {
      baselineSession: createProjectVoiceoverDraft([originalSegment]),
    });

    expect(refreshed.segments[0]?.videoAction).toBe("photo_animation");
    expect(refreshed.segments[0]?.aiVideoAsset?.assetId).toBe(505);
    expect(getWorkspaceSegmentPreviewKind(refreshed.segments[0]!)).toBe("video");
    expect(getWorkspaceSegmentSelectedVisualPreviewKind(refreshed.segments[0]!)).toBe("video");
  });

  it("allows a clean refresh once the server snapshot contains the generated video", () => {
    const sourcePhotoSegment = createProjectVoiceoverSegment({
      currentPreviewUrl: "/api/workspace/media-assets/101",
      currentSourceKind: "stock",
      mediaType: "photo",
      originalPreviewUrl: "/api/workspace/media-assets/101",
      originalSourceKind: "stock",
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const liveAnimatedSegment = {
      ...sourcePhotoSegment,
      aiVideoAsset: {
        assetId: 505,
        durationSeconds: 5.1,
        fileName: "scene-1-animation.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/505/playback",
      },
      aiVideoGeneratedMode: "photo_animation" as const,
      videoAction: "photo_animation" as const,
    };
    const persistedServerSegment = {
      ...sourcePhotoSegment,
      currentAsset: {
        assetId: 505,
        createdAt: null,
        deletedAt: null,
        downloadPath: null,
        downloadUrl: "/api/workspace/media-assets/505",
        expiresAt: null,
        isCurrent: true,
        kind: "rendered_segment",
        libraryKind: "photo_animation",
        lifecycle: "ready" as const,
        mediaType: "video",
        mimeType: "video/mp4",
        originalUrl: null,
        playbackUrl: "/api/workspace/media-assets/505/playback",
        projectId: 77,
        renderedAnimationMode: "i2v",
        renderedViaI2v: true,
        role: "rendered_segment",
        segmentIndex: 0,
        sourceKind: "ai_generated",
        status: "ready",
        storageKey: "users/1/projects/77/505.mp4",
      },
      currentPlaybackUrl: "/api/workspace/media-assets/505/playback",
      currentPreviewUrl: "/api/workspace/media-assets/505/playback",
      currentSourceKind: "ai_generated" as const,
      mediaType: "video" as const,
    };

    expect(
      hasWorkspaceSegmentEditorUnreflectedLiveGeneratedVideo(
        createProjectVoiceoverDraft([liveAnimatedSegment]),
        createProjectVoiceoverDraft([persistedServerSegment]),
        createProjectVoiceoverDraft([sourcePhotoSegment]),
      ),
    ).toBe(false);
  });

  it("keeps the scene synced to voiceover when a fresh server video source is longer", () => {
    const liveSegment = createProjectVoiceoverSegment({
      currentSourceKind: "upload",
      duration: 2.7,
      durationMode: "manual",
      endTime: 14.3,
      index: 1,
      manualDurationSeconds: 2.7,
      mediaType: "video",
      speechDuration: 2.7,
      speechEndTime: 14.3,
      speechStartTime: 11.7,
      startTime: 11.7,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const freshSegment = createProjectVoiceoverSegment({
      ...liveSegment,
      duration: 5.042,
      durationMode: "manual",
      endTime: 16.742,
      manualDurationSeconds: 5.042,
    });
    const liveDraft = createProjectVoiceoverDraft([liveSegment]);
    const freshSession = createProjectVoiceoverDraft([freshSegment]);

    const refreshed = refreshWorkspaceSegmentEditorDraftWithFreshSession(liveDraft, freshSession, {
      baselineSession: freshSession,
      preserveLiveStructure: true,
      preserveUnbaselinedManualDuration: true,
    });

    expect(refreshed.segments[0]).toEqual(expect.objectContaining({
      duration: 3,
      durationExtensionSourceDurationSeconds: 5.042,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 3,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("adopts fresh project voiceover source windows over stale live draft durations", () => {
    const liveFirstSegment = createProjectVoiceoverSegment({
      duration: 4.7,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 4.7,
      index: 0,
      manualDurationSeconds: 4.7,
      mediaType: "video",
      speechDuration: 4.7,
      speechEndTime: 4.7,
      speechStartTime: 0,
      startTime: 0,
      voiceSourceDuration: 4.7,
      voiceSourceEndTime: 4.7,
      voiceSourceStartTime: 0,
    });
    const liveSecondSegment = createProjectVoiceoverSegment({
      duration: 5.4,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 10.1,
      index: 1,
      manualDurationSeconds: 5.4,
      mediaType: "video",
      speechDuration: 5.4,
      speechEndTime: 10.1,
      speechStartTime: 4.7,
      startTime: 4.7,
      voiceSourceDuration: 5.4,
      voiceSourceEndTime: 10.1,
      voiceSourceStartTime: 4.7,
    });
    const freshFirstSegment = createProjectVoiceoverSegment({
      ...liveFirstSegment,
      voiceSourceDuration: 5,
      voiceSourceEndTime: 5,
      voiceSourceStartTime: 0,
    });
    const freshSecondSegment = createProjectVoiceoverSegment({
      ...liveSecondSegment,
      voiceSourceDuration: 5.5,
      voiceSourceEndTime: 10.5,
      voiceSourceStartTime: 5,
    });
    const liveDraft = createProjectVoiceoverDraft([liveFirstSegment, liveSecondSegment]);
    const freshSession = createProjectVoiceoverDraft([freshFirstSegment, freshSecondSegment]);

    const refreshed = refreshWorkspaceSegmentEditorDraftWithFreshSession(liveDraft, freshSession, {
      baselineSession: liveDraft,
      preserveLiveStructure: true,
      preserveUnbaselinedManualDuration: true,
    });

    expect(refreshed.segments[0]).toEqual(expect.objectContaining({
      duration: 5,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 5,
      manualDurationSeconds: null,
      startTime: 0,
      voiceSourceDuration: 5,
      voiceSourceEndTime: 5,
      voiceSourceStartTime: 0,
    }));
    expect(refreshed.segments[1]).toEqual(expect.objectContaining({
      duration: 5.8,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 10.8,
      manualDurationSeconds: null,
      startTime: 5,
      voiceSourceDuration: 5.5,
      voiceSourceEndTime: 10.5,
      voiceSourceStartTime: 5,
    }));
  });

  it("adopts a shorter fresh server video duration over a stale measured live draft duration", () => {
    const liveSegment = createProjectVoiceoverSegment({
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=3821&segmentIndex=6&source=original",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=3821&segmentIndex=6&source=original&delivery=preview",
      currentSourceKind: "upload",
      duration: 5.5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 42.9,
      index: 6,
      manualDurationSeconds: 5.5,
      mediaType: "video",
      startTime: 37.4,
    });
    const freshSegment = createProjectVoiceoverSegment({
      ...liveSegment,
      duration: 5,
      endTime: 42.4,
      manualDurationSeconds: 5,
    });
    const liveDraft = createProjectVoiceoverDraft([liveSegment]);
    const freshSession = createProjectVoiceoverDraft([freshSegment]);

    const refreshed = refreshWorkspaceSegmentEditorDraftWithFreshSession(liveDraft, freshSession, {
      baselineSession: freshSession,
      preserveLiveStructure: true,
      preserveUnbaselinedManualDuration: true,
    });

    expect(refreshed.segments[0]).toEqual(expect.objectContaining({
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 5,
      manualDurationSeconds: 5,
      startTime: 0,
    }));
  });

  it("preserves a user-selected video duration during a server refresh", () => {
    const liveSegment = createProjectVoiceoverSegment({
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=3821&segmentIndex=6&source=original",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=3821&segmentIndex=6&source=original&delivery=preview",
      currentSourceKind: "upload",
      duration: 5.5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 42.9,
      index: 6,
      manualDurationSeconds: 5.5,
      mediaType: "video",
      startTime: 37.4,
    });
    const freshSegment = createProjectVoiceoverSegment({
      ...liveSegment,
      duration: 5,
      durationSyncModeUserSelected: false,
      endTime: 42.4,
      manualDurationSeconds: 5,
    });
    const liveDraft = createProjectVoiceoverDraft([liveSegment]);
    const freshSession = createProjectVoiceoverDraft([freshSegment]);

    const refreshed = refreshWorkspaceSegmentEditorDraftWithFreshSession(liveDraft, freshSession, {
      baselineSession: freshSession,
      preserveLiveStructure: true,
      preserveUnbaselinedManualDuration: true,
    });

    expect(refreshed.segments[0]).toEqual(expect.objectContaining({
      duration: 5.5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 5.5,
      manualDurationSeconds: 5.5,
      startTime: 0,
    }));
  });

  it("preserves a user-selected photo duration during an unbaselined server refresh", () => {
    const liveFirstSegment = createProjectVoiceoverSegment({
      duration: 4,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 4,
      index: 0,
      manualDurationSeconds: 4,
      mediaType: "photo",
      startTime: 0,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const liveSecondSegment = createProjectVoiceoverSegment({
      duration: 6.2,
      endTime: 10.2,
      index: 1,
      mediaType: "photo",
      startTime: 4,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const freshFirstSegment = createProjectVoiceoverSegment({
      ...liveFirstSegment,
      duration: 6.1,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 6.1,
      manualDurationSeconds: null,
    });
    const freshSecondSegment = createProjectVoiceoverSegment({
      ...liveSecondSegment,
      endTime: 12.3,
      startTime: 6.1,
    });
    const liveDraft = {
      ...createProjectVoiceoverDraft([liveFirstSegment, liveSecondSegment]),
      ttsAssetId: null,
      voiceType: "none",
    };
    const freshSession = {
      ...createProjectVoiceoverDraft([freshFirstSegment, freshSecondSegment]),
      ttsAssetId: null,
      voiceType: "none",
    };

    const refreshed = refreshWorkspaceSegmentEditorDraftWithFreshSession(liveDraft, freshSession, {
      preserveUnbaselinedManualDuration: false,
    });

    expect(refreshed.segments[0]).toEqual(expect.objectContaining({
      duration: 4,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 4,
      manualDurationSeconds: 4,
      startTime: 0,
    }));
    expect(refreshed.segments[1]).toEqual(expect.objectContaining({
      startTime: 4,
    }));
  });

  it("preserves a user-selected voiceover duration during a server refresh", () => {
    const liveSegment = createProjectVoiceoverSegment({
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=3821&segmentIndex=6&source=original",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=3821&segmentIndex=6&source=original&delivery=preview",
      currentSourceKind: "upload",
      duration: 4,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      endTime: 37.4,
      index: 6,
      manualDurationSeconds: 4,
      mediaType: "video",
      speechDuration: 4,
      speechEndTime: 37.4,
      speechStartTime: 33.4,
      startTime: 33.4,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const freshSegment = createProjectVoiceoverSegment({
      ...liveSegment,
      duration: 3.6,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 37,
      manualDurationSeconds: 3.6,
    });
    const liveDraft = createProjectVoiceoverDraft([liveSegment]);
    const freshSession = createProjectVoiceoverDraft([freshSegment]);

    const refreshed = refreshWorkspaceSegmentEditorDraftWithFreshSession(liveDraft, freshSession, {
      baselineSession: freshSession,
      preserveLiveStructure: true,
      preserveUnbaselinedManualDuration: true,
    });

    expect(refreshed.segments[0]).toEqual(expect.objectContaining({
      duration: 4.3,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      endTime: 4.3,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("does not let project voiceover speech boundaries override a user-selected voiceover duration", () => {
    const firstSegment = createProjectVoiceoverSegment({
      currentSourceKind: "upload",
      duration: 4.82,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      endTime: 4.82,
      index: 0,
      mediaType: "video",
      speechDuration: 4.82,
      speechEndTime: 4.82,
      speechStartTime: 0,
      startTime: 0,
      voiceSourceDuration: 4.82,
      voiceSourceEndTime: 4.82,
      voiceSourceStartTime: 0,
    });
    const secondSegment = createProjectVoiceoverSegment({
      duration: 6,
      endTime: 11.1,
      index: 1,
      speechDuration: 5.6,
      speechEndTime: 10.7,
      speechStartTime: 5.1,
      startTime: 5.1,
    });

    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      createProjectVoiceoverDraft([firstSegment, secondSegment]),
      { preserveSourceTimelineEnd: false },
    );

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 4.82,
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      endTime: 4.82,
      startTime: 0,
      voiceSourceDuration: 4.82,
    }));
    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      startTime: 4.82,
    }));
  });

  it("compresses the timeline after deleting a scene instead of preserving removed speech gaps", () => {
    const firstSegment = createProjectVoiceoverSegment({
      duration: 6.4,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 6.4,
      index: 0,
      manualDurationSeconds: 6.4,
      speechDuration: 6.1,
      speechDurationSource: "audio",
      speechEndTime: 6.1,
      speechStartTime: 0,
      startTime: 0,
    });
    const secondSegment = createProjectVoiceoverSegment({
      duration: 6.2,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 12.6,
      index: 1,
      manualDurationSeconds: 6.2,
      speechDuration: 5.8,
      speechDurationSource: "audio",
      speechEndTime: 12.2,
      speechStartTime: 6.4,
      startTime: 6.4,
    });
    const thirdSegment = createProjectVoiceoverSegment({
      duration: 6,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 18.6,
      index: 2,
      manualDurationSeconds: 6,
      speechDuration: 5.6,
      speechDurationSource: "audio",
      speechEndTime: 18.2,
      speechStartTime: 12.6,
      startTime: 12.6,
    });
    const previousFourthDuration = 8.1;
    const fourthSegment = createProjectVoiceoverSegment({
      duration: previousFourthDuration,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 26.7,
      index: 3,
      manualDurationSeconds: previousFourthDuration,
      speechDuration: 6.9,
      speechDurationSource: "audio",
      speechEndTime: 25.5,
      speechStartTime: 18.6,
      startTime: 18.6,
    });
    const deletedSegment = createProjectVoiceoverSegment({
      duration: 7.1,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 33.8,
      index: 4,
      manualDurationSeconds: 7.1,
      speechDuration: 6.6,
      speechDurationSource: "audio",
      speechEndTime: 33.3,
      speechStartTime: 26.7,
      startTime: 26.7,
    });
    const nextSegment = createProjectVoiceoverSegment({
      duration: 5.9,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 39.7,
      index: 5,
      manualDurationSeconds: 5.9,
      speechDuration: 5.4,
      speechDurationSource: "audio",
      speechEndTime: 39.2,
      speechStartTime: 33.8,
      startTime: 33.8,
    });
    const sourceSession = createProjectVoiceoverDraft([
      firstSegment,
      secondSegment,
      thirdSegment,
      fourthSegment,
      deletedSegment,
      nextSegment,
    ]);
    const remainingSegments = resolveWorkspaceSegmentEditorSegmentsAfterDelete(sourceSession, deletedSegment.index);

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      {
        ...sourceSession,
        segments: remainingSegments,
      },
      {
        preserveSpeechBoundaries: false,
        preserveSourceTimelineEnd: false,
      },
    );

    expect(rebuilt.segments.find((segment) => segment.index === fourthSegment.index)).toEqual(expect.objectContaining({
      duration: previousFourthDuration,
      endTime: 26.7,
      startTime: 18.6,
    }));
    expect(rebuilt.segments.find((segment) => segment.index === nextSegment.index)).toEqual(expect.objectContaining({
      duration: 5.9,
      endTime: 32.6,
      startTime: 26.7,
    }));
    expect(rebuilt.segments.at(-1)?.endTime).toBe(32.6);
  });

  it("adopts a fresh server duration sync mode during a server refresh", () => {
    const liveSegment = createProjectVoiceoverSegment({
      currentSourceKind: "upload",
      duration: 5,
      durationMode: "auto",
      durationSyncMode: null,
      durationSyncModeUserSelected: false,
      endTime: 5,
      manualDurationSeconds: null,
      mediaType: "video",
      startTime: 0,
    });
    const freshSegment = createProjectVoiceoverSegment({
      ...liveSegment,
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
    });
    const liveDraft = createProjectVoiceoverDraft([liveSegment]);
    const freshSession = createProjectVoiceoverDraft([freshSegment]);

    const refreshed = refreshWorkspaceSegmentEditorDraftWithFreshSession(liveDraft, freshSession, {
      baselineSession: freshSession,
      preserveLiveStructure: true,
      preserveUnbaselinedManualDuration: false,
    });

    expect(refreshed.segments[0]?.durationSyncMode).toBe("voiceover");
    expect(refreshed.segments[0]?.durationSyncModeUserSelected).toBe(true);
  });

  it("does not overwrite a custom visual source duration during a server refresh", () => {
    const segment = createProjectVoiceoverSegment({
      customVideo: {
        assetId: 4404,
        durationSeconds: 6,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 6,
      durationExtensionSourceDurationSeconds: 6,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 6,
      manualDurationSeconds: 6,
      mediaType: "video",
      videoAction: "custom",
    });
    const liveDraft = createProjectVoiceoverDraft([segment]);
    const freshSession = {
      ...liveDraft,
      segments: [
        {
          ...segment,
          customVideo: null,
          durationExtensionSourceDurationSeconds: 5,
          videoAction: "original" as const,
        },
      ],
    };

    const refreshed = refreshWorkspaceSegmentEditorDraftWithFreshSession(liveDraft, freshSession, {
      preserveUnbaselinedManualDuration: false,
    });

    expect(refreshed.segments[0]).toEqual(expect.objectContaining({
      durationExtensionSourceDurationSeconds: 6,
      videoAction: "custom",
    }));
  });

  it("uses a draft video asset duration as the source visual duration", () => {
    const segment = createProjectVoiceoverSegment({
      customVideo: {
        assetId: 4404,
        durationSeconds: 5,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 3.8,
      endTime: 3.8,
      mediaType: "video",
      videoAction: "custom",
    });

    expect(getWorkspaceSegmentKnownVisualDurationSeconds(segment)).toBe(5);
  });

  it("replaces a stale five-second slot with the measured AI video duration", () => {
    const segment = createProjectVoiceoverSegment({
      aiVideoAsset: {
        durationSeconds: 4.042,
        fileName: "segment-ai-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/9642/playback",
      },
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 14.084,
      index: 2,
      manualDurationSeconds: 5,
      mediaType: "video",
      startTime: 9.084,
      videoAction: "ai",
    });

    expect(buildWorkspaceSegmentKnownVideoDurationPatch(segment, 4.042)).toEqual({
      duration: 4.042,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 13.126,
      manualDurationSeconds: 4.042,
      startTime: 9.084,
    });
  });

  it("uses measured AI video duration when deciding that a stale slot needs extension", () => {
    const segment = createProjectVoiceoverSegment({
      aiVideoAsset: {
        durationSeconds: 4.042,
        fileName: "segment-ai-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/9642/playback",
      },
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "video",
      videoAction: "ai",
    });

    expect(getWorkspaceSegmentDurationExtensionPlan(segment)).toEqual(expect.objectContaining({
      extraDurationSeconds: 0.958,
      mode: "cinematic_hold",
      slotDurationSeconds: 5,
      sourceDurationSeconds: 4.042,
    }));
  });

  it("repairs a persisted AI video slot that silently held a stale final frame", () => {
    const segment = createProjectVoiceoverSegment({
      aiVideoAsset: {
        fileName: "segment-ai-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/9642/playback",
      },
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 14.084,
      index: 2,
      manualDurationSeconds: 5,
      mediaType: "video",
      startTime: 9.084,
      videoAction: "ai",
    });

    expect(syncWorkspaceSegmentMeasuredVideoVisualDuration(segment, 4.042, {
      voiceoverDurationSeconds: 3.786,
    })).toEqual(expect.objectContaining({
      duration: 4.042,
      durationExtensionSourceDurationSeconds: null,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 13.126,
      manualDurationSeconds: 4.042,
      startTime: 9.084,
    }));
  });

  it("does not let measured media metadata rewrite an authoritative finalized timeline slot", () => {
    const segment = createProjectVoiceoverSegment({
      aiVideoAsset: {
        fileName: "segment-ai-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/9820/playback",
      },
      duration: 4,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 9.042,
      index: 1,
      manualDurationSeconds: 4,
      mediaType: "video",
      startTime: 5.042,
      videoAction: "ai",
    });

    expect(syncWorkspaceSegmentMeasuredVideoVisualDuration(segment, 5, {
      preserveAuthoritativeTimelineDuration: true,
      voiceoverDurationSeconds: 3.64,
    })).toBe(segment);
  });

  it("preserves an explicitly extended AI video slot after measuring its source", () => {
    const segment = createProjectVoiceoverSegment({
      aiVideoAsset: {
        fileName: "segment-ai-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/9642/playback",
      },
      duration: 5,
      durationExtensionSourceDurationSeconds: 4.042,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "video",
      videoAction: "ai",
    });

    expect(syncWorkspaceSegmentMeasuredVideoVisualDuration(segment, 4.042)).toBe(segment);
  });

  it("records the measured source when a stale AI video slot must keep a longer voiceover", () => {
    const segment = createProjectVoiceoverSegment({
      aiVideoAsset: {
        fileName: "segment-ai-video.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/9642/playback",
      },
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "video",
      videoAction: "ai",
    });

    expect(syncWorkspaceSegmentMeasuredVideoVisualDuration(segment, 4.042, {
      voiceoverDurationSeconds: 5,
    })).toEqual(expect.objectContaining({
      duration: 5,
      durationExtensionSourceDurationSeconds: 4.042,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 5,
      manualDurationSeconds: null,
    }));
  });

  it("uses a persisted media asset duration as the source visual duration", () => {
    const segment = createProjectVoiceoverSegment({
      currentAsset: {
        assetId: 5025,
        createdAt: null,
        deletedAt: null,
        downloadPath: "/api/media/5025/download",
        downloadUrl: null,
        durationSeconds: 5,
        expiresAt: null,
        isCurrent: true,
        kind: "segment_current",
        libraryKind: null,
        lifecycle: "ready",
        mediaType: "video",
        mimeType: "video/mp4",
        originalUrl: null,
        playbackUrl: "/api/media/5025/download",
        projectId: 3737,
        role: "segment_current",
        segmentIndex: 1,
        sourceKind: "upload",
        status: "ready",
        storageKey: null,
      },
      duration: 3.8,
      endTime: 3.8,
      mediaType: "video",
    });

    expect(getWorkspaceSegmentKnownVisualDurationSeconds(segment)).toBe(5);
  });

  it("uses the manual visual slot duration over a longer video asset duration", () => {
    const segment = createProjectVoiceoverSegment({
      currentAsset: {
        assetId: 5026,
        createdAt: null,
        deletedAt: null,
        downloadPath: "/api/media/5026/download",
        downloadUrl: null,
        durationSeconds: 5.5,
        expiresAt: null,
        isCurrent: true,
        kind: "segment_current",
        libraryKind: null,
        lifecycle: "ready",
        mediaType: "video",
        mimeType: "video/mp4",
        originalUrl: null,
        playbackUrl: "/api/media/5026/download",
        projectId: 3737,
        role: "segment_current",
        segmentIndex: 6,
        sourceKind: "upload",
        status: "ready",
        storageKey: null,
      },
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "video",
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: null,
      voiceType: "none",
    }, { preserveSourceTimelineEnd: false });

    expect(getWorkspaceSegmentKnownVisualDurationSeconds(segment)).toBe(5);
    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 5,
      endTime: 5,
      manualDurationSeconds: 5,
    }));
  });

  it("does not expand a manual video visual slot to stale speech timing", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 42.323,
      manualDurationSeconds: 5,
      mediaType: "video",
      speechDuration: 5.532,
      speechEndTime: 31.681,
      speechStartTime: 26.149,
      startTime: 37.323,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: null,
      voiceType: "none",
    }, { preserveSourceTimelineEnd: false });

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 5,
      endTime: 5,
      manualDurationSeconds: 5,
      startTime: 0,
    }));
  });

  it("uses the measured media asset duration over a stale generated-video source duration", () => {
    const segment = createProjectVoiceoverSegment({
      currentAsset: {
        assetId: 5025,
        createdAt: null,
        deletedAt: null,
        downloadPath: "/api/media/5025/download",
        downloadUrl: null,
        durationSeconds: 4.1,
        expiresAt: null,
        isCurrent: true,
        kind: "segment_current",
        libraryKind: null,
        lifecycle: "ready",
        mediaType: "video",
        mimeType: "video/mp4",
        originalUrl: null,
        playbackUrl: "/api/media/5025/download",
        projectId: 3737,
        role: "segment_current",
        segmentIndex: 1,
        sourceKind: "ai_generated",
        status: "ready",
        storageKey: null,
      },
      currentSourceKind: "ai_generated",
      duration: 4.1,
      durationExtensionSourceDurationSeconds: 5,
      endTime: 4.1,
      mediaType: "video",
    });

    expect(getWorkspaceSegmentKnownVisualDurationSeconds(segment)).toBe(4.1);
  });

  it("syncs an auto video scene slot to the measured source video duration", () => {
    const firstSegment = createProjectVoiceoverSegment({
      duration: 11.1,
      durationMode: "manual",
      endTime: 11.1,
      index: 0,
      manualDurationSeconds: 11.1,
      startTime: 0,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const secondSegment = createProjectVoiceoverSegment({
      customVideo: {
        assetId: 4404,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 3.8,
      endTime: 14.9,
      index: 1,
      mediaType: "video",
      speechDuration: 2.1,
      speechEndTime: 2.1,
      speechStartTime: 0,
      startTime: 11.1,
      videoAction: "custom",
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });

    const syncedSecondSegment = syncWorkspaceSegmentMeasuredVideoVisualDuration(secondSegment, 5);
    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([firstSegment, secondSegment]),
      ttsAssetId: null,
      voiceType: "none",
      segments: [firstSegment, syncedSecondSegment],
    }, { preserveSourceTimelineEnd: false });

    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 16.1,
      manualDurationSeconds: 5,
      startTime: 11.1,
    }));
  });

  it("keeps the server timeline for persisted ffmpeg photo renders with transition handles", () => {
    const currentAsset = {
      assetId: 6670,
      durationSeconds: null,
      kind: "rendered_segment",
      libraryKind: "photo_animation",
      mediaType: "video",
      mimeType: "video/mp4",
      renderedAnimationMode: "ffmpeg",
      renderedViaI2v: false,
      role: "rendered_segment",
      sourceKind: "ai_generated",
    } as any;
    const baselineSegment = createProjectVoiceoverSegment({
      currentAsset,
      currentSourceKind: "ai_generated",
      duration: 4.104,
      durationMode: "auto",
      endTime: 4.104,
      mediaType: "photo",
      speechDuration: 3.96,
      speechDurationSource: "audio",
      speechEndTime: 3.96,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "original",
      voiceSourceDuration: 4.104,
      voiceSourceEndTime: 4.104,
      voiceSourceStartTime: 0,
    });
    const staleMeasuredSegment = createProjectVoiceoverSegment({
      ...baselineSegment,
      currentAsset: { assetId: 6670 } as any,
      duration: 4.604,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 4.604,
      manualDurationSeconds: 4.604,
      speechDuration: 4.624,
      speechEndTime: 4.624,
      voiceSourceDuration: 4.624,
      voiceSourceEndTime: 4.624,
    });

    expect(syncWorkspaceSegmentMeasuredVideoVisualDuration(baselineSegment, 4.604)).toBe(baselineSegment);
    expect(
      isWorkspaceSegmentStaleMeasuredRenderedPhotoDuration(staleMeasuredSegment, baselineSegment),
    ).toBe(true);
    expect(
      isWorkspaceSegmentStaleMeasuredRenderedPhotoDuration(
        { ...staleMeasuredSegment, currentAsset },
        { ...baselineSegment, currentAsset: { assetId: 6670 } as any },
      ),
    ).toBe(true);
    expect(
      restoreWorkspaceSegmentStaleMeasuredRenderedPhotoDuration(staleMeasuredSegment, baselineSegment),
    ).toEqual(expect.objectContaining({
      duration: 4.104,
      durationMode: "auto",
      durationSyncMode: null,
      endTime: 4.104,
      manualDurationSeconds: null,
      speechDuration: 3.96,
      speechEndTime: 3.96,
      voiceSourceDuration: 4.104,
      voiceSourceEndTime: 4.104,
    }));
    expect(
      isWorkspaceSegmentStaleMeasuredRenderedPhotoDuration(
        { ...staleMeasuredSegment, durationSyncModeUserSelected: true },
        baselineSegment,
      ),
    ).toBe(false);

    const regeneratedVoiceoverSegment = {
      ...staleMeasuredSegment,
      voiceoverAsset: {
        ...staleMeasuredSegment.voiceoverAsset!,
        assetId: 778,
      },
    };
    expect(
      isWorkspaceSegmentStaleMeasuredRenderedPhotoDuration(
        regeneratedVoiceoverSegment,
        baselineSegment,
      ),
    ).toBe(false);
    expect(
      restoreWorkspaceSegmentStaleMeasuredRenderedPhotoDuration(
        regeneratedVoiceoverSegment,
        baselineSegment,
      ),
    ).toBe(regeneratedVoiceoverSegment);

    const audioMeasuredVoiceoverSegment = {
      ...staleMeasuredSegment,
      duration: 4.745,
      durationMode: "auto" as const,
      durationSyncMode: "voiceover" as const,
      endTime: 4.745,
      manualDurationSeconds: null,
      speechDuration: 4.745,
      speechEndTime: 4.745,
      voiceoverAsset: {
        ...staleMeasuredSegment.voiceoverAsset!,
        durationSeconds: 4.745,
      },
    };
    expect(
      isWorkspaceSegmentStaleMeasuredRenderedPhotoDuration(
        audioMeasuredVoiceoverSegment,
        baselineSegment,
      ),
    ).toBe(false);
    expect(
      restoreWorkspaceSegmentStaleMeasuredRenderedPhotoDuration(
        audioMeasuredVoiceoverSegment,
        baselineSegment,
      ),
    ).toBe(audioMeasuredVoiceoverSegment);
  });

  it("does not replace a voiceover-trimmed video scene with measured visual duration", () => {
    const segment = createProjectVoiceoverSegment({
      customVideo: {
        assetId: 4404,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 2.1,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 2.1,
      index: 0,
      mediaType: "video",
      speechDuration: 2.1,
      speechEndTime: 2.1,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "custom",
    });

    expect(syncWorkspaceSegmentMeasuredVideoVisualDuration(segment, 5)).toBe(segment);
  });

  it("syncs a measured video that is shorter than voiceover to the voiceover slot", () => {
    const segment = createProjectVoiceoverSegment({
      customVideo: {
        assetId: 4404,
        fileName: "library-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "media-library",
      },
      duration: 10,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 10,
      index: 0,
      manualDurationSeconds: 10,
      mediaType: "video",
      startTime: 0,
      videoAction: "custom",
    });

    expect(
      syncWorkspaceSegmentMeasuredVideoVisualDuration(segment, 5, {
        voiceoverDurationSeconds: 5.9,
      }),
    ).toEqual(expect.objectContaining({
      duration: 5.9,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 5.9,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("does not collapse a stored AI extension when measured video is shorter than voiceover", () => {
    const segment = createProjectVoiceoverSegment({
      customVideo: {
        assetId: 4404,
        fileName: "extended-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "media-library",
      },
      duration: 10,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 10,
      index: 0,
      manualDurationSeconds: 10,
      mediaType: "video",
      startTime: 0,
      videoAction: "custom",
    });

    expect(
      syncWorkspaceSegmentMeasuredVideoVisualDuration(segment, 5, {
        voiceoverDurationSeconds: 5.9,
      }),
    ).toBe(segment);
  });

  it("syncs an uploaded video visual duration to freshly generated scene voiceover", () => {
    const segment = createProjectVoiceoverSegment({
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
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 5,
      index: 0,
      manualDurationSeconds: 5,
      mediaType: "video",
      speechDuration: 2.2,
      speechDurationSource: "audio",
      speechEndTime: 2.2,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "custom",
      voiceoverAsset: {
        assetId: 889,
        durationSeconds: 2.2,
        fileName: "scene-voiceover.mp3",
        fileSize: 0,
        mimeType: "audio/mpeg",
        remoteUrl: "/api/workspace/media-assets/889",
        source: "media-library",
      },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("Segment"),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: null,
      voiceType: "none",
    }, { preserveSourceTimelineEnd: false });

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 2.5,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 2.5,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("syncs a manual video visual to the fresh voiceover even when the old slot was visual", () => {
    const segment = createProjectVoiceoverSegment({
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
      durationMode: "manual",
      durationSyncMode: "voiceover",
      endTime: 5,
      index: 0,
      manualDurationSeconds: 5,
      mediaType: "video",
      speechDuration: 4.7,
      speechDurationSource: "audio",
      speechEndTime: 4.7,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "custom",
      voiceoverAsset: {
        assetId: 889,
        durationSeconds: 4.7,
        fileName: "scene-voiceover.mp3",
        fileSize: 0,
        mimeType: "audio/mpeg",
        remoteUrl: "/api/workspace/media-assets/889",
        source: "media-library",
      },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("Segment"),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: null,
      voiceType: "none",
    }, { preserveSourceTimelineEnd: false });

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 5,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 5,
      manualDurationSeconds: null,
      speechDuration: 4.7,
      startTime: 0,
    }));
  });

  it("syncs a persisted photo visual slot to freshly generated scene voiceover", () => {
    const firstSegment = createProjectVoiceoverSegment({
      currentAsset: {
        assetId: 9901,
        durationSeconds: 6.4,
        kind: "segment_current",
        mediaType: "photo",
        mimeType: "image/jpeg",
        sourceKind: "stock",
      } as any,
      duration: 6.4,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 6.4,
      index: 0,
      manualDurationSeconds: 6.4,
      mediaType: "photo",
      speechDuration: 7.939,
      speechDurationSource: "audio",
      speechEndTime: 7.939,
      speechStartTime: 0,
      startTime: 0,
      voiceoverAsset: {
        assetId: 889,
        durationSeconds: 7.939,
        fileName: "scene-voiceover.mp3",
        fileSize: 0,
        mimeType: "audio/mpeg",
        remoteUrl: "/api/workspace/media-assets/889",
        source: "media-library",
      },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("Segment"),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const secondSegment = createProjectVoiceoverSegment({
      duration: 5,
      endTime: 11.4,
      index: 1,
      mediaType: "photo",
      startTime: 6.4,
      text: "Second",
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: "none",
    });

    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([firstSegment, secondSegment]),
      ttsAssetId: null,
      voiceType: "none",
    }, { preserveSourceTimelineEnd: false });

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 7.939,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 7.939,
      manualDurationSeconds: null,
      startTime: 0,
    }));
    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      duration: 5,
      endTime: 12.939,
      startTime: 7.939,
    }));
  });

  it("keeps a stale voiceover-trimmed video draft trimmed while preserving the known visual duration", () => {
    const segment = createProjectVoiceoverSegment({
      customVideo: {
        assetId: 4404,
        durationSeconds: 5,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 4.7,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 4.7,
      index: 0,
      manualDurationSeconds: null,
      mediaType: "video",
      speechDuration: 4.7,
      speechDurationSource: "audio",
      speechEndTime: 4.7,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "custom",
      voiceoverAsset: {
        assetId: 889,
        durationSeconds: 4.7,
        fileName: "scene-voiceover.mp3",
        fileSize: 0,
        mimeType: "audio/mpeg",
        remoteUrl: "/api/workspace/media-assets/889",
        source: "media-library",
      },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("Segment"),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: null,
      voiceType: "none",
    }, { preserveSourceTimelineEnd: false });

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 5,
      durationExtensionSourceDurationSeconds: null,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 5,
      manualDurationSeconds: null,
      speechDuration: 4.7,
      startTime: 0,
    }));
  });

  it("syncs an extended uploaded video visual to a fresh scene voiceover", () => {
    const segment = createProjectVoiceoverSegment({
      customVideo: {
        assetId: 4404,
        durationSeconds: 5,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 10,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 10,
      index: 0,
      manualDurationSeconds: 10,
      mediaType: "video",
      speechDuration: 2.2,
      speechDurationSource: "audio",
      speechEndTime: 2.2,
      speechStartTime: 0,
      startTime: 0,
      videoAction: "custom",
      voiceoverAsset: {
        assetId: 889,
        durationSeconds: 2.2,
        fileName: "scene-voiceover.mp3",
        fileSize: 0,
        mimeType: "audio/mpeg",
        remoteUrl: "/api/workspace/media-assets/889",
        source: "media-library",
      },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("Segment"),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });

    const normalized = rebuildWorkspaceSegmentEditorDraftSessionTimeline({
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: null,
      voiceType: "none",
    }, { preserveSourceTimelineEnd: false });

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 2.5,
      durationExtensionSourceDurationSeconds: 10,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 2.5,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("does not overwrite a manual visual slot with a later measured video duration", () => {
    const segment = createProjectVoiceoverSegment({
      customVideo: {
        assetId: 4404,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 3.8,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 14.9,
      index: 1,
      manualDurationSeconds: 3.8,
      mediaType: "video",
      startTime: 11.1,
      videoAction: "custom",
    });

    expect(syncWorkspaceSegmentMeasuredVideoVisualDuration(segment, 5)).toEqual(expect.objectContaining({
      duration: 3.8,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 14.9,
      manualDurationSeconds: 3.8,
      startTime: 11.1,
    }));
  });

  it("does not shrink an intentionally extended visual duration to the measured source video duration", () => {
    const segment = createProjectVoiceoverSegment({
      customVideo: {
        assetId: 4404,
        fileName: "uploaded-scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/4404/playback",
        source: "upload",
      },
      duration: 10,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 21.1,
      index: 1,
      manualDurationSeconds: 10,
      mediaType: "video",
      startTime: 11.1,
      videoAction: "custom",
    });

    expect(syncWorkspaceSegmentMeasuredVideoVisualDuration(segment, 5)).toBe(segment);
  });

  it("does not use duration-only speech metadata as a seekable project voiceover range", () => {
    const text = "Взбейте яйца с сахаром и солью.";
    const segment = createProjectVoiceoverSegment({
      duration: 10,
      durationMode: "manual",
      endTime: 22.957,
      index: 1,
      manualDurationSeconds: 10,
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: 2.508,
      speechDurationSource: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      startTime: 12.957,
      text,
      textByLanguage: { ru: text },
      voiceSourceDuration: 2.508,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: null,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const session = createProjectVoiceoverDraft([segment]);

    expect(hasWorkspaceSegmentProjectVoiceoverTimingData(segment)).toBe(false);
    expect(getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session, { allowEstimated: false })).toEqual({
      durationSeconds: 2.508,
      source: "actual",
    });
    expect(
      getWorkspaceSegmentVoiceoverAudioPreviewSource({
        isVoiceAudioStale: false,
        preferSegmentProxy: true,
        segment,
        session,
        voiceEnabled: true,
        voiceOption: null,
      }),
    ).toEqual(expect.objectContaining({
      audioUrl: null,
      projectVoiceoverAudioUrl: null,
      segmentVoiceoverAudioUrl: null,
      shouldClip: false,
      sourceKind: null,
    }));

    expect(isWorkspaceSegmentProjectTimelineVoiceoverAvailable(segment, session)).toBe(false);
    expect(
      getWorkspaceSegmentVoiceoverAudioPreviewSource({
        allowProjectTimelineFallback: true,
        isVoiceAudioStale: false,
        preferSegmentProxy: true,
        segment,
        session,
        voiceEnabled: true,
        voiceOption: null,
      }),
    ).toEqual(expect.objectContaining({
      audioUrl: null,
      projectVoiceoverAudioUrl: null,
      segmentVoiceoverAudioUrl: null,
      shouldClip: false,
      sourceKind: null,
    }));
  });

  it("does not use the project TTS timeline when legacy segment voiceover metadata is missing", () => {
    const text = "Влейте молоко и перемешайте.";
    const segment = createProjectVoiceoverSegment({
      duration: 1.962,
      durationMode: "manual",
      endTime: 24.919,
      index: 2,
      manualDurationSeconds: 1.962,
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      startTime: 22.957,
      text,
      textByLanguage: { ru: text },
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const session = {
      ...createProjectVoiceoverDraft([segment]),
      finalVideoStale: false,
    };

    expect(isWorkspaceSegmentProjectTimelineVoiceoverAvailable(segment, session)).toBe(false);
    expect(
      isWorkspaceSegmentProjectTimelineVoiceoverAvailable(segment, session, {
        allowMissingVoiceoverMetadata: true,
      }),
    ).toBe(false);
    expect(
      getWorkspaceSegmentVoiceoverAudioPreviewSource({
        allowProjectTimelineFallback: true,
        isVoiceAudioStale: false,
        preferSegmentProxy: true,
        segment,
        session,
        voiceEnabled: true,
        voiceOption: null,
      }),
    ).toEqual(expect.objectContaining({
      audioUrl: null,
      projectVoiceoverAudioUrl: null,
      segmentVoiceoverAudioUrl: null,
      shouldClip: false,
      sourceKind: null,
    }));
  });

  it("keeps project TTS timing fresh while normalizing drafts without scene voiceover assets", () => {
    const text = "Но главным претендентом выглядит Франция.";
    const segment = createProjectVoiceoverSegment({
      duration: 6.1,
      endTime: 22.7,
      index: 3,
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: 5.7,
      speechDurationSource: "audio",
      speechEndTime: 22.3,
      speechStartTime: 16.6,
      speechWords: [
        { confidence: 0.96, endTime: 16.82, startTime: 16.6, text: "Но" },
        { confidence: 0.95, endTime: 17.3, startTime: 16.82, text: "главным" },
        { confidence: 0.95, endTime: 17.92, startTime: 17.3, text: "претендентом" },
        { confidence: 0.95, endTime: 18.45, startTime: 17.92, text: "выглядит" },
        { confidence: 0.96, endTime: 22.3, startTime: 18.45, text: "Франция." },
      ],
      startTime: 16.6,
      text,
      textByLanguage: { ru: text },
      voiceSourceDuration: 5.7,
      voiceSourceEndTime: 22.3,
      voiceSourceStartTime: 16.6,
      voiceoverAsset: null,
      voiceoverLanguage: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const normalized = normalizeLegacyWorkspaceSegmentEditorDraftSession(createProjectVoiceoverDraft([segment]));

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    }));
    expect(isWorkspaceSegmentVoiceoverPlaybackFresh(normalized.segments[0], normalized)).toBe(true);
    expect(getWorkspaceSegmentEditorGenerationRequiredCredits(normalized)).toBe(
      STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST,
    );
  });

  it("restores a lost project TTS asset id for unchanged project-timeline voiceover segments", () => {
    const text = "Но главным претендентом выглядит Франция.";
    const segment = createProjectVoiceoverSegment({
      duration: 6.1,
      endTime: 22.7,
      index: 3,
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: 5.7,
      speechDurationSource: "audio",
      speechEndTime: 22.3,
      speechStartTime: 16.6,
      speechWords: [],
      startTime: 16.6,
      text,
      textByLanguage: { ru: text },
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: null,
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const baseline = createProjectVoiceoverDraft([segment]);
    const dirtyDraft = {
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: null,
    };

    const restored = restoreWorkspaceSegmentEditorDraftProjectTtsAsset(dirtyDraft, baseline);

    expect(restored.ttsAssetId).toBe(777);
    expect(isWorkspaceSegmentVoiceoverPlaybackFresh(restored.segments[0], restored)).toBe(true);
    expect(getWorkspaceSegmentEditorGenerationRequiredCredits(restored)).toBe(
      STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST,
    );
  });

  it("does not restore a project TTS asset id when the segment timing range no longer matches baseline", () => {
    const text = "Но главным претендентом выглядит Франция.";
    const baselineSegment = createProjectVoiceoverSegment({
      duration: 6.1,
      endTime: 22.7,
      index: 3,
      speechDuration: 5.7,
      speechEndTime: 22.3,
      speechStartTime: 16.6,
      speechWords: [],
      startTime: 16.6,
      text,
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: null,
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const shiftedSegment = createProjectVoiceoverSegment({
      ...baselineSegment,
      endTime: 18.7,
      speechEndTime: 18.3,
      speechStartTime: 12.6,
      startTime: 12.6,
    });
    const dirtyDraft = {
      ...createProjectVoiceoverDraft([shiftedSegment]),
      ttsAssetId: null,
    };

    const restored = restoreWorkspaceSegmentEditorDraftProjectTtsAsset(
      dirtyDraft,
      createProjectVoiceoverDraft([baselineSegment]),
    );

    expect(restored.ttsAssetId).toBeNull();
    expect(isWorkspaceSegmentVoiceoverPlaybackFresh(restored.segments[0], restored)).toBe(false);
  });

  it("does not restore a project TTS asset id when any reusable segment has an unsafe range", () => {
    const safeText = "Вторую строчку уверенно держит Аргентина.";
    const unsafeText = "Но главным претендентом выглядит Франция.";
    const safeSegment = createProjectVoiceoverSegment({
      index: 2,
      speechDuration: 5.9,
      speechEndTime: 16.3,
      speechStartTime: 10.4,
      speechWords: [],
      startTime: 10.4,
      endTime: 16.6,
      text: safeText,
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: null,
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(safeText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const baselineUnsafeSegment = createProjectVoiceoverSegment({
      index: 3,
      speechDuration: 5.7,
      speechEndTime: 22.3,
      speechStartTime: 16.6,
      speechWords: [],
      startTime: 16.6,
      endTime: 22.7,
      text: unsafeText,
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: null,
      voiceoverLanguage: "ru",
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(unsafeText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const shiftedUnsafeSegment = createProjectVoiceoverSegment({
      ...baselineUnsafeSegment,
      speechEndTime: 18.3,
      speechStartTime: 12.6,
      startTime: 12.6,
      endTime: 18.7,
    });
    const baseline = createProjectVoiceoverDraft([safeSegment, baselineUnsafeSegment]);
    const dirtyDraft = {
      ...createProjectVoiceoverDraft([safeSegment, shiftedUnsafeSegment]),
      ttsAssetId: null,
    };

    const restored = restoreWorkspaceSegmentEditorDraftProjectTtsAsset(dirtyDraft, baseline);

    expect(restored.ttsAssetId).toBeNull();
  });

  it("does not use stale project TTS without timing metadata", () => {
    const text = "Влейте молоко и перемешайте.";
    const segment = createProjectVoiceoverSegment({
      duration: 1.962,
      durationMode: "manual",
      endTime: 24.919,
      index: 2,
      manualDurationSeconds: 1.962,
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      startTime: 22.957,
      text,
      textByLanguage: { ru: text },
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const session = {
      ...createProjectVoiceoverDraft([segment]),
      finalVideoStale: true,
    };

    expect(
      isWorkspaceSegmentProjectTimelineVoiceoverAvailable(segment, session, {
        allowMissingVoiceoverMetadata: true,
      }),
    ).toBe(false);
    expect(
      getWorkspaceSegmentVoiceoverAudioPreviewSource({
        allowProjectTimelineFallback: true,
        isVoiceAudioStale: false,
        preferSegmentProxy: true,
        segment,
        session,
        voiceEnabled: true,
        voiceOption: null,
      }),
    ).toEqual(expect.objectContaining({
      audioUrl: null,
      projectVoiceoverAudioUrl: null,
      shouldClip: false,
      sourceKind: null,
    }));

    expect(
      getWorkspaceSegmentVoiceoverAudioPreviewSource({
        allowFinalVideoStaleProjectTimelineFallback: true,
        allowProjectTimelineFallback: true,
        isVoiceAudioStale: false,
        preferSegmentProxy: true,
        segment,
        session,
        voiceEnabled: true,
        voiceOption: null,
      }),
    ).toEqual(expect.objectContaining({
      audioUrl: null,
      projectVoiceoverAudioUrl: null,
      segmentVoiceoverAudioUrl: null,
      shouldClip: false,
      sourceKind: null,
    }));
  });

  it("does not reuse stale project TTS without metadata when only the visual changed", () => {
    const text = "Влейте молоко и перемешайте.";
    const segment = createProjectVoiceoverSegment({
      duration: 1.962,
      durationMode: "manual",
      endTime: 24.919,
      index: 2,
      manualDurationSeconds: 1.962,
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      startTime: 22.957,
      text,
      textByLanguage: { ru: text },
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const session = {
      ...createProjectVoiceoverDraft([segment]),
      finalVideoStale: true,
    };
    const baselineSession = {
      ...session,
      finalVideoStale: false,
    };

    expect(
      canReuseWorkspaceSegmentProjectTimelineVoiceover(segment, session, {
        baselineSession,
        isGlobalVoiceEdited: false,
      }),
    ).toBe(false);
  });

  it("does not reuse project TTS without timing metadata after one scene text edit", () => {
    const firstOriginalText = "Влейте молоко и перемешайте.";
    const firstEditedText = "Влейте молоко и тщательно перемешайте.";
    const secondText = "Поставьте тесто на десять минут.";
    const baselineFirstSegment = createProjectVoiceoverSegment({
      duration: 1.962,
      durationMode: "manual",
      endTime: 1.962,
      index: 0,
      manualDurationSeconds: 1.962,
      originalText: firstOriginalText,
      originalTextByLanguage: { ru: firstOriginalText },
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      text: firstOriginalText,
      textByLanguage: { ru: firstOriginalText },
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const baselineSecondSegment = createProjectVoiceoverSegment({
      duration: 2.4,
      durationMode: "manual",
      endTime: 4.362,
      index: 1,
      manualDurationSeconds: 2.4,
      originalText: secondText,
      originalTextByLanguage: { ru: secondText },
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      startTime: 1.962,
      text: secondText,
      textByLanguage: { ru: secondText },
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const editedFirstSegment = {
      ...baselineFirstSegment,
      text: firstEditedText,
      textByLanguage: { ru: firstEditedText },
    };
    const baselineSession = {
      ...createProjectVoiceoverDraft([baselineFirstSegment, baselineSecondSegment]),
      finalVideoStale: false,
    };
    const session = {
      ...createProjectVoiceoverDraft([editedFirstSegment, baselineSecondSegment]),
      finalVideoStale: true,
    };

    expect(
      canReuseWorkspaceSegmentProjectTimelineVoiceover(editedFirstSegment, session, {
        baselineSession,
        isGlobalVoiceEdited: false,
      }),
    ).toBe(false);
    expect(
      canReuseWorkspaceSegmentProjectTimelineVoiceover(baselineSecondSegment, session, {
        baselineSession,
        isGlobalVoiceEdited: false,
      }),
    ).toBe(false);
  });

  it("does not reuse stale project TTS without metadata after a scene voice override", () => {
    const text = "Влейте молоко и перемешайте.";
    const baselineSegment = createProjectVoiceoverSegment({
      duration: 1.962,
      durationMode: "manual",
      endTime: 24.919,
      index: 2,
      manualDurationSeconds: 1.962,
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      startTime: 22.957,
      text,
      textByLanguage: { ru: text },
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const segment = {
      ...baselineSegment,
      voiceType: "Russian_BrightHeroine",
    };
    const baselineSession = {
      ...createProjectVoiceoverDraft([baselineSegment]),
      finalVideoStale: false,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    };
    const session = {
      ...createProjectVoiceoverDraft([segment]),
      finalVideoStale: true,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    };

    expect(
      canReuseWorkspaceSegmentProjectTimelineVoiceover(segment, session, {
        baselineSession,
        isGlobalVoiceEdited: false,
      }),
    ).toBe(false);
  });

  it("does not reuse stale project TTS without metadata after a global voice change", () => {
    const text = "Влейте молоко и перемешайте.";
    const baselineSegment = createProjectVoiceoverSegment({
      duration: 1.962,
      durationMode: "manual",
      endTime: 24.919,
      index: 2,
      manualDurationSeconds: 1.962,
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      startTime: 22.957,
      text,
      textByLanguage: { ru: text },
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    });
    const segment = {
      ...baselineSegment,
    };
    const baselineSession = {
      ...createProjectVoiceoverDraft([baselineSegment]),
      finalVideoStale: false,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    };
    const session = {
      ...createProjectVoiceoverDraft([segment]),
      finalVideoStale: true,
      voiceType: "Russian_BrightHeroine",
    };

    expect(
      canReuseWorkspaceSegmentProjectTimelineVoiceover(segment, session, {
        baselineSession,
        isGlobalVoiceEdited: true,
      }),
    ).toBe(false);
  });

  it("does not reuse project TTS when only the global voice language changed", () => {
    const segment = createProjectVoiceoverSegment({
      voiceSourceDuration: 4,
      voiceSourceEndTime: 4,
      voiceSourceStartTime: 0,
    });
    const baselineSession = createProjectVoiceoverDraft([segment]);
    const unchangedSession = {
      ...baselineSession,
      finalVideoStale: true,
    };
    const englishSession = {
      ...unchangedSession,
      language: "en" as const,
    };

    expect(
      canReuseWorkspaceSegmentProjectTimelineVoiceover(segment, unchangedSession, {
        baselineSession,
        isGlobalVoiceEdited: false,
      }),
    ).toBe(true);
    expect(
      canReuseWorkspaceSegmentProjectTimelineVoiceover(segment, englishSession, {
        baselineSession,
        isGlobalVoiceEdited: false,
      }),
    ).toBe(false);
  });

  it("does not use the project TTS timeline when voiceover metadata conflicts with the current scene", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 5,
      durationMode: "manual",
      endTime: 18,
      index: 1,
      manualDurationSeconds: 5,
      originalText: "Взбейте яйца с сахаром и солью.",
      originalTextByLanguage: { ru: "Взбейте яйца с сахаром и солью." },
      speechDuration: 2.508,
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      startTime: 13,
      text: "Новый текст озвучки еще не сгенерирован.",
      textByLanguage: { ru: "Новый текст озвучки еще не сгенерирован." },
      voiceoverAsset: null,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("Взбейте яйца с сахаром и солью."),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const session = createProjectVoiceoverDraft([segment]);

    expect(
      isWorkspaceSegmentProjectTimelineVoiceoverAvailable(segment, session, {
        allowMissingVoiceoverMetadata: true,
      }),
    ).toBe(false);
    expect(
      getWorkspaceSegmentVoiceoverAudioPreviewSource({
        allowProjectTimelineFallback: true,
        isVoiceAudioStale: false,
        preferSegmentProxy: true,
        segment,
        session,
        voiceEnabled: true,
        voiceOption: null,
      }),
    ).toEqual(expect.objectContaining({
      audioUrl: null,
      projectVoiceoverAudioUrl: null,
      segmentVoiceoverAudioUrl: null,
      shouldClip: false,
      sourceKind: null,
    }));
  });

  it("uses measured segment-indexed TTS duration for project voiceover preview ranges", () => {
    const text = "сегодня покажу вам рецепт очень вкусных блинов";
    const segment = createProjectVoiceoverSegment({
      duration: 12.957,
      durationMode: "manual",
      endTime: 12.957,
      manualDurationSeconds: 12.957,
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: 11.859,
      speechDurationSource: "audio",
      speechEndTime: 11.859,
      speechStartTime: 0,
      speechWords: [],
      startTime: 0,
      text,
      textByLanguage: { ru: text },
      voiceSourceDuration: 11.859,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: {
        assetId: 777,
        durationSeconds: 11.859,
        fileName: "project-voiceover.wav",
        fileSize: 0,
        mimeType: "audio/x-wav",
        remoteUrl: "/api/workspace/media-assets/777",
        source: "media-library",
      },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const session = createProjectVoiceoverDraft([segment]);

    expect(hasWorkspaceSegmentProjectVoiceoverTimingData(segment)).toBe(true);
    expect(
      getWorkspaceSegmentVoiceoverAudioPreviewSource({
        isVoiceAudioStale: false,
        preferSegmentProxy: true,
        segment,
        session,
        voiceEnabled: true,
        voiceOption: null,
      }),
    ).toEqual(expect.objectContaining({
      audioUrl: expect.stringContaining("/api/workspace/project-segment-voiceover?"),
      previewRange: { endTime: 12.309, startTime: 0 },
      segmentVoiceoverAudioUrl: expect.stringContaining("segmentIndex=0"),
      shouldClip: false,
      sourceKind: "segment",
    }));
  });

  it("clips a batch voiceover asset attached directly to a segment", () => {
    const text = "second scene text";
    const segment = createProjectVoiceoverSegment({
      duration: 5.4,
      durationMode: "manual",
      endTime: 10.8,
      index: 1,
      manualDurationSeconds: 5.4,
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: 5.4,
      speechDurationSource: "audio",
      speechEndTime: 10.8,
      speechStartTime: 5.4,
      speechWords: [{ confidence: 1, endTime: 10.8, startTime: 5.4, text: "second" }],
      startTime: 5.4,
      text,
      textByLanguage: { ru: text },
      voiceSourceDuration: 5.4,
      voiceSourceEndTime: 10.8,
      voiceSourceStartTime: 5.4,
      voiceoverAsset: {
        assetId: 888,
        durationSeconds: 35.2,
        fileName: "project-voiceover-group.wav",
        fileSize: 0,
        mimeType: "audio/x-wav",
        remoteUrl: "/api/workspace/media-assets/888",
        source: "media-library",
      },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const session = {
      ...createProjectVoiceoverDraft([segment]),
      projectId: 0,
      ttsAssetId: null,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    };

    expect(
      getWorkspaceSegmentVoiceoverAudioPreviewSource({
        isVoiceAudioStale: false,
        preferSegmentProxy: true,
        segment,
        session,
        voiceEnabled: true,
        voiceOption: null,
      }),
    ).toEqual(expect.objectContaining({
      audioUrl: "/api/workspace/media-assets/888/playback",
      latestSceneVoiceoverAudioUrl: null,
      previewRange: { endTime: 10.8, startTime: 5.4 },
      projectVoiceoverAudioUrl: "/api/workspace/media-assets/888/playback",
      segmentVoiceoverAudioUrl: null,
      shouldClip: true,
      sourceKind: "project",
    }));
  });

  it("extends project voiceover preview beyond synthetic word timings", () => {
    const text = "По логике он должен пройти через одну щель — левую или правую. Но появляется волновой узор…";
    const segment = createProjectVoiceoverSegment({
      duration: 4.82,
      durationMode: "manual",
      endTime: 10.32,
      index: 1,
      manualDurationSeconds: 4.82,
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: 4.48,
      speechDurationSource: "audio",
      speechEndTime: 9.98,
      speechStartTime: 5.5,
      speechWords: [
        { confidence: 0, endTime: 5.78, startTime: 5.5, text: "По" },
        { confidence: 0, endTime: 8.86, startTime: 8.58, text: "правую." },
        { confidence: 0, endTime: 9.14, startTime: 8.86, text: "Но" },
        { confidence: 0, endTime: 9.42, startTime: 9.14, text: "появляется" },
        { confidence: 0, endTime: 9.7, startTime: 9.42, text: "волновой" },
        { confidence: 0, endTime: 9.98, startTime: 9.7, text: "узор…" },
      ],
      startTime: 5.5,
      text,
      textByLanguage: { ru: text },
      voiceoverAsset: {
        assetId: 888,
        durationSeconds: 36.943,
        fileName: "project-voiceover-group.wav",
        fileSize: 0,
        mimeType: "audio/x-wav",
        remoteUrl: "/api/workspace/media-assets/888",
        source: "media-library",
      },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const session = {
      ...createProjectVoiceoverDraft([segment]),
      projectId: 0,
      ttsAssetId: null,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    };

    expect(getWorkspaceSegmentVoiceoverPreviewRange(segment, session)).toEqual({
      endTime: 11.75,
      startTime: 5.42,
    });
    expect(
      getWorkspaceSegmentVoiceoverAudioPreviewSource({
        isVoiceAudioStale: false,
        preferSegmentProxy: true,
        segment,
        session,
        voiceEnabled: true,
        voiceOption: null,
      }),
    ).toEqual(expect.objectContaining({
      audioUrl: "/api/workspace/media-assets/888/playback",
      previewRange: { endTime: 11.75, startTime: 5.42 },
      shouldClip: true,
      sourceKind: "project",
    }));
  });

  it("uses the segment voiceover proxy for a saved project windowed voiceover asset", () => {
    const text = "second scene text";
    const segment = createProjectVoiceoverSegment({
      duration: 5.4,
      durationMode: "manual",
      endTime: 10.8,
      index: 1,
      manualDurationSeconds: 5.4,
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: 5.4,
      speechDurationSource: "audio",
      speechEndTime: 10.8,
      speechStartTime: 5.4,
      speechWords: [{ confidence: 1, endTime: 10.8, startTime: 5.4, text: "second" }],
      startTime: 5.4,
      text,
      textByLanguage: { ru: text },
      voiceSourceDuration: 5.4,
      voiceSourceEndTime: 10.8,
      voiceSourceStartTime: 5.4,
      voiceoverAsset: {
        assetId: 888,
        durationSeconds: 35.2,
        fileName: "project-voiceover-group.wav",
        fileSize: 0,
        mimeType: "audio/x-wav",
        remoteUrl: "/api/workspace/media-assets/888",
        source: "media-library",
      },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const session = {
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: null,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    };

    expect(
      getWorkspaceSegmentVoiceoverAudioPreviewSource({
        isVoiceAudioStale: false,
        preferSegmentProxy: true,
        segment,
        session,
        voiceEnabled: true,
        voiceOption: null,
      }),
    ).toEqual(expect.objectContaining({
      audioUrl: expect.stringContaining("/api/workspace/project-segment-voiceover?"),
      latestSceneVoiceoverAudioUrl: null,
      previewRange: { endTime: 10.8, startTime: 5.4 },
      projectVoiceoverAudioUrl: "/api/workspace/media-assets/888/playback",
      segmentVoiceoverAudioUrl: expect.stringContaining("/api/workspace/project-segment-voiceover?"),
      shouldClip: false,
      sourceKind: "segment",
    }));
  });

  it("does not treat a shared full voiceover asset as an isolated scene voiceover", () => {
    const firstText = "Scene one text";
    const secondText = "Scene two text";
    const sharedVoiceoverAsset = {
      assetId: 888,
      durationSeconds: 31.5,
      fileName: "whole-project-voiceover.wav",
      fileSize: 0,
      mimeType: "audio/x-wav",
      remoteUrl: "/api/workspace/media-assets/888",
      source: "media-library" as const,
    };
    const firstSegment = createProjectVoiceoverSegment({
      duration: 7.9,
      durationMode: "manual",
      endTime: 7.9,
      index: 0,
      manualDurationSeconds: 7.9,
      originalText: firstText,
      originalTextByLanguage: { ru: firstText },
      speechDuration: 31.5,
      speechDurationSource: "audio",
      speechEndTime: 31.5,
      speechStartTime: 0,
      speechWords: [],
      startTime: 0,
      text: firstText,
      textByLanguage: { ru: firstText },
      voiceSourceDuration: 31.5,
      voiceSourceEndTime: 31.5,
      voiceSourceStartTime: 0,
      voiceoverAsset: sharedVoiceoverAsset,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(firstText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const secondSegment = createProjectVoiceoverSegment({
      duration: 5,
      durationMode: "manual",
      endTime: 12.9,
      index: 1,
      manualDurationSeconds: 5,
      originalText: secondText,
      originalTextByLanguage: { ru: secondText },
      speechDuration: 5,
      speechDurationSource: "audio",
      speechEndTime: 12.9,
      speechStartTime: 7.9,
      speechWords: [],
      startTime: 7.9,
      text: secondText,
      textByLanguage: { ru: secondText },
      voiceSourceDuration: 5,
      voiceSourceEndTime: 12.9,
      voiceSourceStartTime: 7.9,
      voiceoverAsset: sharedVoiceoverAsset,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(secondText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const session = {
      ...createProjectVoiceoverDraft([firstSegment, secondSegment]),
      ttsAssetId: null,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    };

    expect(
      getWorkspaceSegmentVoiceoverAudioPreviewSource({
        isVoiceAudioStale: false,
        preferSegmentProxy: true,
        segment: firstSegment,
        session,
        voiceEnabled: true,
        voiceOption: null,
      }),
    ).toEqual(expect.objectContaining({
      audioUrl: "/api/workspace/media-assets/888/playback",
      latestSceneVoiceoverAudioUrl: null,
      previewRange: { endTime: 2.25, startTime: 0 },
      projectVoiceoverAudioUrl: "/api/workspace/media-assets/888/playback",
      segmentVoiceoverAudioUrl: null,
      shouldClip: true,
      sourceKind: "project",
    }));
  });

  it("routes a shared batch voiceover asset through the project segment proxy even before asset duration is stored", () => {
    const firstText = "Сегодня покажу вам рецепт очень вкусных блинов.";
    const secondText = "Взбейте яйца с сахаром и солью.";
    const sharedVoiceoverAsset = {
      assetId: 888,
      fileName: "whole-project-voiceover.wav",
      fileSize: 0,
      mimeType: "audio/x-wav",
      remoteUrl: "/api/workspace/media-assets/888",
      source: "media-library" as const,
    };
    const firstSegment = createProjectVoiceoverSegment({
      duration: 12,
      durationMode: "manual",
      endTime: 12,
      index: 0,
      manualDurationSeconds: 12,
      originalText: firstText,
      originalTextByLanguage: { ru: firstText },
      speechDuration: 7.4,
      speechDurationSource: "audio",
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      startTime: 0,
      text: firstText,
      textByLanguage: { ru: firstText },
      voiceSourceDuration: 7.4,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: sharedVoiceoverAsset,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(firstText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const secondSegment = createProjectVoiceoverSegment({
      duration: 5,
      durationMode: "manual",
      endTime: 17,
      index: 1,
      manualDurationSeconds: 5,
      originalText: secondText,
      originalTextByLanguage: { ru: secondText },
      speechDuration: 2.1,
      speechDurationSource: "audio",
      speechEndTime: null,
      speechStartTime: null,
      speechWords: [],
      startTime: 12,
      text: secondText,
      textByLanguage: { ru: secondText },
      voiceSourceDuration: 2.1,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voiceoverAsset: sharedVoiceoverAsset,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(secondText),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const session = {
      ...createProjectVoiceoverDraft([firstSegment, secondSegment]),
      ttsAssetId: null,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    };

    expect(
      getWorkspaceSegmentVoiceoverAudioPreviewSource({
        isVoiceAudioStale: false,
        segment: secondSegment,
        session,
        voiceEnabled: true,
        voiceOption: null,
      }),
    ).toEqual(expect.objectContaining({
      audioUrl: "/api/workspace/media-assets/888/playback",
      latestSceneVoiceoverAudioUrl: null,
      projectVoiceoverAudioUrl: "/api/workspace/media-assets/888/playback",
      segmentVoiceoverAudioUrl: expect.stringContaining("/api/workspace/project-segment-voiceover?"),
      shouldClip: true,
      sourceKind: "project",
    }));

    expect(
      getWorkspaceSegmentVoiceoverAudioPreviewSource({
        isVoiceAudioStale: false,
        preferSegmentProxy: true,
        segment: secondSegment,
        session,
        voiceEnabled: true,
        voiceOption: null,
      }),
    ).toEqual(expect.objectContaining({
      audioUrl: expect.stringContaining("/api/workspace/project-segment-voiceover?"),
      latestSceneVoiceoverAudioUrl: null,
      segmentVoiceoverAudioUrl: expect.stringContaining("segmentIndex=1"),
      shouldClip: false,
      sourceKind: "segment",
    }));
  });

  it("ignores measured full project audio duration when a scene already has shorter voice timing", () => {
    const text = "Сегодня покажу вам рецепт очень вкусных блинов.";
    const segment = createProjectVoiceoverSegment({
      duration: 5,
      endTime: 5,
      index: 0,
      manualDurationSeconds: 5,
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: 7.9,
      speechEndTime: null,
      speechStartTime: null,
      startTime: 0,
      text,
      textByLanguage: { ru: text },
      voiceoverAsset: {
        assetId: 6004,
        fileName: "project-tts.wav",
        fileSize: 0,
        mimeType: "audio/x-wav",
        remoteUrl: "/api/workspace/media-assets/6004",
        source: "media-library",
      },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const session = {
      ...createProjectVoiceoverDraft([segment]),
      ttsAssetId: null,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    };

    expect(
      shouldIgnoreWorkspaceSegmentMeasuredVoiceoverDuration(segment, session, "/api/workspace/media-assets/6004", 31.532),
    ).toBe(true);
    expect(
      shouldIgnoreWorkspaceSegmentMeasuredVoiceoverDuration(segment, session, "/api/workspace/media-assets/6004", 8.1),
    ).toBe(false);
    expect(
      shouldIgnoreWorkspaceSegmentMeasuredVoiceoverDuration(
        segment,
        session,
        "/api/workspace/project-segment-voiceover?projectId=77&segmentIndex=0",
        31.532,
      ),
    ).toBe(false);
  });

  it("uses the segment voiceover proxy for single-scene project voiceover preview", () => {
    const text = "second scene text";
    const segment = createProjectVoiceoverSegment({
      duration: 5.4,
      durationMode: "manual",
      endTime: 10.8,
      index: 1,
      manualDurationSeconds: 5.4,
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: 5.4,
      speechDurationSource: "audio",
      speechEndTime: 10.8,
      speechStartTime: 5.4,
      speechWords: [{ confidence: 1, endTime: 10.8, startTime: 5.4, text: "second" }],
      startTime: 5.4,
      text,
      textByLanguage: { ru: text },
      voiceSourceDuration: 5.4,
      voiceSourceEndTime: 10.8,
      voiceSourceStartTime: 5.4,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
    });
    const session = createProjectVoiceoverDraft([segment]);

    expect(
      getWorkspaceSegmentVoiceoverAudioPreviewSource({
        isVoiceAudioStale: false,
        preferSegmentProxy: true,
        segment,
        session,
        voiceEnabled: true,
        voiceOption: null,
      }),
    ).toEqual(expect.objectContaining({
      audioUrl: expect.stringContaining("/api/workspace/project-segment-voiceover?"),
      projectVoiceoverAudioUrl: "/api/workspace/media-assets/777/playback",
      segmentVoiceoverAudioUrl: expect.stringContaining("projectId=77"),
      shouldClip: false,
      sourceKind: "segment",
    }));
  });

  it("keeps saved talking photo slot duration when the media asset is longer", () => {
    const text = "Попробуйте, это очень вкусно!";
    const segment = createProjectVoiceoverSegment({
      aiVideoAsset: {
        assetId: 909,
        durationSeconds: 5,
        fileName: "segment-talking-photo.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/909",
      },
      aiVideoGeneratedMode: "talking_photo",
      currentAsset: {
        assetId: 909,
        createdAt: null,
        deletedAt: null,
        downloadPath: "/api/media/909/download",
        downloadUrl: null,
        durationSeconds: 5,
        expiresAt: null,
        isCurrent: true,
        kind: "segment_current",
        libraryKind: "talking_photo",
        lifecycle: "ready",
        mediaType: "video",
        mimeType: "video/mp4",
        originalUrl: null,
        playbackUrl: "/api/media/909/download",
        projectId: 77,
        role: "segment_current",
        segmentIndex: 7,
        sourceKind: "generated",
        status: "ready",
        storageKey: null,
      },
      duration: 2.9,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      endTime: 45.223,
      index: 7,
      manualDurationSeconds: 2.9,
      mediaType: "video",
      startTime: 42.323,
      text,
      textByLanguage: { ru: text },
      videoAction: "talking_photo",
      voiceoverAsset: null,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
      voiceoverVoiceType: DEFAULT_STUDIO_VOICE_ID.ru,
      voiceType: null,
    });
    const session = createProjectVoiceoverDraft([segment]);

    const [rebuiltSegment] = createWorkspaceSegmentEditorDraftSession(session).segments;

    expect(rebuiltSegment).toEqual(expect.objectContaining({
      duration: 2.9,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      endTime: 2.9,
      manualDurationSeconds: 2.9,
      startTime: 0,
    }));
  });

  it("uses measured voiceover duration when shrinking a still scene with stale speech duration", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 10,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 10,
      manualDurationSeconds: 10,
      mediaType: "photo",
      speechDuration: 10,
      speechDurationSource: null,
      speechEndTime: 10,
      speechStartTime: 0,
      startTime: 0,
      text: "А как вы думаете, это физика или намёк на симуляцию?",
    });
    const session = createProjectVoiceoverDraft([segment]);

    const timing = resolveWorkspaceSegmentBoundaryTiming(segment, 8, session, {
      voiceoverDurationSeconds: 4.1,
    });

    expect(timing).toEqual(expect.objectContaining({
      boundaryTime: 8,
      duration: 8,
      minimumDuration: 4.1,
      requestedDuration: 8,
      status: "valid",
    }));
  });

  it("does not fall back to stale scene-duration speech echo after resolving no reliable voice duration", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 10,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 10,
      manualDurationSeconds: 10,
      mediaType: "photo",
      speechDuration: 10,
      speechDurationSource: null,
      speechEndTime: 10,
      speechStartTime: 0,
      startTime: 0,
      text: "А как вы думаете, это физика или намёк на симуляцию?",
    });
    const session = createProjectVoiceoverDraft([segment]);

    const timing = resolveWorkspaceSegmentBoundaryTiming(segment, 8, session, {
      voiceoverDurationSeconds: null,
    });

    expect(timing).toEqual(expect.objectContaining({
      boundaryTime: 8,
      duration: 8,
      minimumDuration: 1,
      requestedDuration: 8,
      status: "valid",
    }));
  });

  it("keeps a user-shrunk still visual duration below the previous media slot duration", () => {
    const segment = createProjectVoiceoverSegment({
      currentAsset: {
        assetId: 910,
        createdAt: null,
        deletedAt: null,
        downloadPath: "/api/media/910/download",
        downloadUrl: null,
        durationSeconds: 10,
        expiresAt: null,
        isCurrent: true,
        kind: "segment_current",
        libraryKind: "image",
        lifecycle: "ready",
        mediaType: "image",
        mimeType: "image/png",
        originalUrl: null,
        playbackUrl: "/api/media/910/download",
        projectId: 77,
        role: "segment_current",
        segmentIndex: 5,
        sourceKind: "generated",
        status: "ready",
        storageKey: null,
      },
      duration: 8,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 8,
      index: 5,
      manualDurationSeconds: 8,
      mediaType: "photo",
      speechDuration: 4.1,
      speechDurationSource: "audio",
      speechEndTime: 4.1,
      speechStartTime: 0,
      startTime: 0,
      text: "А как вы думаете, это физика или намёк на симуляцию?",
      voiceSourceDuration: 4.1,
    });
    const session = createProjectVoiceoverDraft([segment]);

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(session);

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 8,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 8,
      manualDurationSeconds: 8,
      startTime: 0,
    }));
  });

  it("repairs a dirty still scene whose manual duration is shorter than its stale timeline slot", () => {
    const session = createProjectVoiceoverDraft([
      createProjectVoiceoverSegment({
        duration: 8,
        durationMode: "manual",
        durationSyncMode: "visual",
        durationSyncModeUserSelected: true,
        endTime: 8,
        index: 0,
        manualDurationSeconds: 8,
        mediaType: "photo",
        speechDuration: 5.08,
        startTime: 0,
        voiceSourceDuration: 5.181,
      }),
      createProjectVoiceoverSegment({
        duration: 9,
        durationMode: "manual",
        durationSyncMode: "visual",
        durationSyncModeUserSelected: true,
        endTime: 17,
        index: 1,
        manualDurationSeconds: 9,
        mediaType: "photo",
        speechDuration: 5.864,
        speechDurationSource: "audio",
        startTime: 8,
        voiceSourceDuration: 5.864,
      }),
      createProjectVoiceoverSegment({
        duration: 9,
        durationMode: "manual",
        durationSyncMode: "visual",
        durationSyncModeUserSelected: true,
        endTime: 26,
        index: 2,
        manualDurationSeconds: 9,
        mediaType: "photo",
        speechDuration: 5.983,
        speechDurationSource: "audio",
        startTime: 17,
        voiceSourceDuration: 5.983,
      }),
      createProjectVoiceoverSegment({
        duration: 8.53,
        durationMode: "manual",
        durationSyncMode: "visual",
        durationSyncModeUserSelected: true,
        endTime: 34.53,
        index: 3,
        manualDurationSeconds: 8.53,
        mediaType: "photo",
        speechDuration: 5.232,
        speechDurationSource: "audio",
        startTime: 26,
        voiceSourceDuration: 5.232,
      }),
      createProjectVoiceoverSegment({
        duration: 9,
        durationMode: "manual",
        durationSyncMode: "visual",
        durationSyncModeUserSelected: true,
        endTime: 43.53,
        index: 4,
        manualDurationSeconds: 9,
        mediaType: "photo",
        speechDuration: 6.552,
        speechDurationSource: "audio",
        startTime: 34.53,
        voiceSourceDuration: 7.61,
      }),
      createProjectVoiceoverSegment({
        duration: 10,
        durationMode: "manual",
        durationSyncMode: "visual",
        durationSyncModeUserSelected: true,
        endTime: 53.53,
        index: 5,
        manualDurationSeconds: 8,
        mediaType: "photo",
        speechDuration: 3.744,
        speechDurationSource: "audio",
        speechEndTime: 48.164,
        speechStartTime: 44.42,
        speechWords: [
          { confidence: 1, endTime: 44.58, startTime: 44.42, text: "А" },
          { confidence: 1, endTime: 47.9, startTime: 47.54, text: "симуляцию?" },
        ],
        startTime: 43.53,
        text: "А как вы думаете, это физика или намёк на симуляцию?",
        voiceSourceDuration: 4.104,
        voiceSourceEndTime: 48.02,
        voiceSourceStartTime: 44.42,
      }),
    ]);

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(session);

    expect(rebuilt.segments[5]).toEqual(expect.objectContaining({
      duration: 8,
      endTime: 51.53,
      manualDurationSeconds: 8,
      startTime: 43.53,
    }));
  });

  it("repairs a legacy draft load where a user-selected still duration conflicts with the old slot", () => {
    const session = createProjectVoiceoverDraft([
      createProjectVoiceoverSegment({
        duration: 4,
        durationMode: "manual",
        durationSyncMode: "visual",
        durationSyncModeUserSelected: true,
        endTime: 4,
        index: 0,
        manualDurationSeconds: 4,
        mediaType: "photo",
        speechDuration: 2,
        speechDurationSource: "audio",
        speechEndTime: 2,
        speechStartTime: 0,
        startTime: 0,
        voiceSourceDuration: 2,
      }),
      createProjectVoiceoverSegment({
        duration: 10,
        durationMode: "manual",
        durationSyncMode: "visual",
        durationSyncModeUserSelected: true,
        endTime: 14,
        index: 1,
        manualDurationSeconds: 8,
        mediaType: "photo",
        speechDuration: 4.104,
        speechDurationSource: "audio",
        speechEndTime: 8.104,
        speechStartTime: 4,
        startTime: 4,
        voiceSourceDuration: 4.104,
      }),
    ]);

    const normalized = normalizeLegacyWorkspaceSegmentEditorDraftSession(session);

    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      duration: 8,
      endTime: 12,
      manualDurationSeconds: 8,
      startTime: 4,
    }));
  });

  it("repairs persisted still duration conflicts while normalizing stored drafts", () => {
    const session = createProjectVoiceoverDraft([
      createProjectVoiceoverSegment({
        duration: 4,
        durationMode: "manual",
        durationSyncMode: "visual",
        durationSyncModeUserSelected: true,
        endTime: 4,
        index: 0,
        manualDurationSeconds: 4,
        mediaType: "photo",
        startTime: 0,
      }),
      createProjectVoiceoverSegment({
        duration: 10,
        durationMode: "manual",
        durationSyncMode: "visual",
        durationSyncModeUserSelected: true,
        endTime: 14,
        index: 1,
        manualDurationSeconds: 8,
        mediaType: "photo",
        startTime: 4,
      }),
    ]);

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession({
      ...session,
      storageVersion: 3,
    } as WorkspaceSegmentEditorDraftSession);

    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      duration: 8,
      endTime: 12,
      manualDurationSeconds: 8,
      startTime: 4,
    }));
  });

  it("repairs stored auto durations inflated by standalone punctuation tokens", () => {
    const session = createProjectVoiceoverDraft([
      createProjectVoiceoverSegment({
        duration: 6.21,
        durationMode: "auto",
        durationSyncMode: "voiceover",
        durationSyncModeUserSelected: false,
        endTime: 6.21,
        index: 0,
        manualDurationSeconds: null,
        mediaType: "photo",
        startTime: 0,
        text: "Один прыжок — и монстр уже летит на землю, не успев понять, что случилось.",
        voiceoverAsset: null,
        voiceoverLanguage: null,
        voiceoverTextHash: null,
        voiceoverVoiceType: null,
      }),
      createProjectVoiceoverSegment({
        duration: 4.64,
        durationMode: "auto",
        durationSyncMode: "voiceover",
        durationSyncModeUserSelected: false,
        endTime: 10.85,
        index: 1,
        manualDurationSeconds: null,
        mediaType: "photo",
        startTime: 6.21,
        text: "Город встречал героя, а он просто играл со своей новой игрушкой.",
        voiceoverAsset: null,
        voiceoverLanguage: null,
        voiceoverTextHash: null,
        voiceoverVoiceType: null,
      }),
    ]);

    const normalized = normalizeStoredWorkspaceSegmentEditorDraftSession({
      ...session,
      ttsAssetId: null,
      voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
      storageVersion: 3,
    } as WorkspaceSegmentEditorDraftSession);

    expect(normalized.segments[0]).toEqual(expect.objectContaining({
      duration: 5.87,
      endTime: 5.87,
      manualDurationSeconds: null,
      startTime: 0,
    }));
    expect(normalized.segments[1]).toEqual(expect.objectContaining({
      startTime: 5.87,
    }));
  });

  it("does not stretch a scene to the full project voiceover asset duration", () => {
    const firstSegment = createProjectVoiceoverSegment({
      duration: 5.4,
      endTime: 5.4,
      speechDuration: 35.2,
      speechEndTime: 5.1,
      speechStartTime: 0,
      speechWords: [{ confidence: 1, endTime: 5.1, startTime: 0, text: "first" }],
      startTime: 0,
      text: "first",
      textByLanguage: { ru: "first" },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("first"),
    });
    const secondSegment = createProjectVoiceoverSegment({
      duration: 5.4,
      endTime: 10.8,
      index: 1,
      originalText: "second",
      originalTextByLanguage: { ru: "second" },
      speechDuration: 5.4,
      speechEndTime: 10.8,
      speechStartTime: 5.4,
      speechWords: [{ confidence: 1, endTime: 10.8, startTime: 5.4, text: "second" }],
      startTime: 5.4,
      text: "second",
      textByLanguage: { ru: "second" },
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("second"),
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      createProjectVoiceoverDraft([firstSegment, secondSegment]),
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 5.25,
      endTime: 5.25,
      speechDuration: 5.1,
      startTime: 0,
    }));
    expect(rebuilt.segments[1]).toEqual(expect.objectContaining({
      endTime: 10.95,
      startTime: 5.25,
    }));
  });

  it("drops a legacy voice render window duration from a short photo voiceover scene", () => {
    const text = "Попробуйте, это очень вкусно!";
    const segment = createProjectVoiceoverSegment({
      duration: 18.24,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 58.187,
      index: 7,
      manualDurationSeconds: 18.24,
      mediaType: "photo",
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: 2.22,
      speechDurationSource: "audio",
      speechEndTime: 2.22,
      speechStartTime: 0,
      startTime: 39.947,
      text,
      textByLanguage: { ru: text },
      voiceSourceDuration: 2.22,
      voiceSourceEndTime: 2.22,
      voiceSourceStartTime: 0,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      createProjectVoiceoverDraft([segment]),
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 2.52,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 2.52,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("does not reset a photo scene with valid voiceover timing to the empty-scene default duration", () => {
    const text = "Сегодня покажу вам рецепт очень вкусных блинов, нам понадобятся: Молоко, Яйца, Мука, Сахар, Соль, Растительное масло и Кипяток.";
    const segment = createProjectVoiceoverSegment({
      duration: 58.2,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 58.2,
      manualDurationSeconds: 58.2,
      mediaType: "photo",
      originalText: text,
      originalTextByLanguage: { ru: text },
      speechDuration: 58.2,
      speechEndTime: 58.2,
      speechStartTime: 0,
      startTime: 0,
      text,
      textByLanguage: { ru: text },
      voiceSourceDuration: 11.2,
      voiceSourceEndTime: 11.2,
      voiceSourceStartTime: 0,
      voiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash(text),
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      createProjectVoiceoverDraft([segment]),
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 11.5,
      durationMode: "auto",
      durationSyncMode: "visual",
      endTime: 11.5,
      manualDurationSeconds: null,
      startTime: 0,
      voiceSourceDuration: 11.2,
    }));
  });

  it("extends a photo scene to a longer generated voiceover duration", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "photo",
      speechDuration: 11.2,
      speechDurationSource: "audio",
      speechEndTime: 11.2,
      speechStartTime: 0,
      startTime: 0,
      voiceSourceDuration: 11.2,
      voiceSourceEndTime: 11.2,
      voiceSourceStartTime: 0,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      createProjectVoiceoverDraft([segment]),
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 11.5,
      durationMode: "auto",
      endTime: 11.5,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("normalizes photo scene duration to the same voiceover minimum used by manual edits", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 6.8,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 6.8,
      manualDurationSeconds: null,
      mediaType: "photo",
      speechDuration: 6.9,
      speechDurationSource: "audio",
      speechEndTime: 6.9,
      speechStartTime: 0,
      startTime: 0,
      voiceSourceDuration: 6.9,
      voiceSourceEndTime: 6.9,
      voiceSourceStartTime: 0,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      createProjectVoiceoverDraft([segment]),
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 7.2,
      durationMode: "auto",
      endTime: 7.2,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("shortens an inherited photo scene duration to a shorter generated voiceover duration", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "photo",
      speechDuration: 2.2,
      speechDurationSource: "audio",
      speechEndTime: 2.2,
      speechStartTime: 0,
      startTime: 0,
      voiceSourceDuration: 2.2,
      voiceSourceEndTime: 2.2,
      voiceSourceStartTime: 0,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      createProjectVoiceoverDraft([segment]),
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 2.5,
      durationMode: "auto",
      endTime: 2.5,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("resets an inherited photo duration to pending voiceover text estimate", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 6.2,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 6.2,
      manualDurationSeconds: 6.2,
      mediaType: "photo",
      startTime: 0,
      text: "a",
    });
    const session = createProjectVoiceoverDraft([segment]);
    const clearedSegment = clearWorkspaceSegmentEditorVoiceoverGenerationState(segment, {
      resetTimelineToEstimatedVoiceover: true,
      session,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      {
        ...session,
        segments: [clearedSegment],
      },
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 1.8,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 1.8,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("resets an inherited video duration to pending voiceover text estimate", () => {
    const segment = createProjectVoiceoverSegment({
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
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "video",
      startTime: 0,
      text: "a",
      videoAction: "custom",
    });
    const session = createProjectVoiceoverDraft([segment]);
    const clearedSegment = clearWorkspaceSegmentEditorVoiceoverGenerationState(segment, {
      resetTimelineToEstimatedVoiceover: true,
      session,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      {
        ...session,
        segments: [clearedSegment],
      },
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 1.8,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 1.8,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("syncs an uploaded video visual to pending voiceover text estimate", () => {
    const segment = createProjectVoiceoverSegment({
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
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "video",
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      startTime: 0,
      text: "a",
      videoAction: "custom",
      voiceoverAsset: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      createProjectVoiceoverDraft([segment]),
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 1.8,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 1.8,
      estimatedVoiceoverDurationSeconds: 1.8,
      estimatedVoiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("a"),
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("scales pending voiceover duration from the previous measured word duration", () => {
    const previousText = "Чемпионат мира 2026 года в Северной Америке перевернет все футбольные расклады!";
    const nextText = "Чемпионат мира 2026 в Северной Америке перевернет все футбольные расклады!";
    const segment = createProjectVoiceoverSegment({
      duration: 6.4,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 6.4,
      manualDurationSeconds: 6.4,
      mediaType: "photo",
      speechDuration: 6.1,
      speechDurationSource: "audio",
      speechEndTime: 6.1,
      speechStartTime: 0,
      startTime: 0,
      text: nextText,
      voiceSourceDuration: 6.1,
      voiceSourceEndTime: 6.1,
      voiceSourceStartTime: 0,
    });
    const session = createProjectVoiceoverDraft([segment]);
    const clearedSegment = clearWorkspaceSegmentEditorVoiceoverGenerationState(segment, {
      previousText,
      resetTimelineToEstimatedVoiceover: true,
      session,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      {
        ...session,
        segments: [clearedSegment],
      },
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      manualDurationSeconds: null,
      startTime: 0,
    }));
    expect(rebuilt.segments[0]?.duration).toBeCloseTo(5.545, 3);
    expect(rebuilt.segments[0]?.endTime).toBeCloseTo(5.545, 3);
    expect(rebuilt.segments[0]?.estimatedVoiceoverDurationSeconds).toBeCloseTo(5.545, 3);
    expect(rebuilt.segments[0]?.estimatedVoiceoverTextHash).toBe(
      getWorkspaceSegmentVoiceoverTextHash(nextText),
    );
  });

  it("drops every stale voice source alias when edited text rebuilds the final scene", () => {
    const text = "Город встречал героя, а Барсик просто играл со своей игрушкой.";
    const segment = createProjectVoiceoverSegment({
      customVideo: {
        durationSeconds: 5,
        fileName: "scene-five.mp4",
        fileSize: 1024,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/505/playback",
        source: "upload",
      },
      duration: 9.7,
      endTime: 24.4,
      index: 4,
      mediaType: "video",
      speechDuration: 9.7,
      speechEndTime: 24.4,
      speechStartTime: 14.7,
      startTime: 14.7,
      text,
      videoAction: "custom",
      voiceSourceDuration: 9.7,
      voiceSourceEndTime: 24.4,
      voiceSourceStartTime: 14.7,
      voice_source_duration: 9.7,
      voice_source_end_time: 24.4,
      voice_source_start_time: 14.7,
      _voice_source_duration: 9.7,
      _voice_source_end_time: 24.4,
      _voice_source_start_time: 14.7,
      _voice_render_source_end_time: 24.4,
      _voice_render_source_start_time: 14.7,
    });
    const session = createProjectVoiceoverDraft([segment]);

    const cleared = clearWorkspaceSegmentEditorVoiceoverGenerationState(segment, {
      preserveUserSelectedVisualDuration: false,
      previousText: "Старый короткий текст",
      resetTimelineToEstimatedVoiceover: true,
      session,
    });

    expect(cleared.duration).toBeLessThan(5);
    expect(cleared.endTime).toBeCloseTo(14.7 + cleared.duration, 3);
    expect(cleared.durationExtensionSourceDurationSeconds).toBe(5);
    expect(cleared).toEqual(expect.objectContaining({
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
      voice_source_duration: null,
      voice_source_end_time: null,
      voice_source_start_time: null,
      _voice_source_duration: null,
      _voice_source_end_time: null,
      _voice_source_start_time: null,
      _voice_render_source_end_time: null,
      _voice_render_source_start_time: null,
    }));
  });

  it("ignores a stale pending voiceover estimate from another text", () => {
    const segment = createProjectVoiceoverSegment({
      estimatedVoiceoverDurationSeconds: 9,
      estimatedVoiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("старый текст"),
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      text: "один два три четыре пять шесть",
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
    });

    const voiceoverDurationInfo = getWorkspaceSegmentTimelineVoiceoverDurationInfo(
      segment,
      createProjectVoiceoverDraft([segment]),
    );

    expect(voiceoverDurationInfo).toEqual({
      durationSeconds: 2.04,
      source: "estimated",
    });
  });

  it("uses the same estimated voiceover duration for timeline and label", () => {
    const segment = createProjectVoiceoverSegment({
      estimatedVoiceoverDurationSeconds: null,
      estimatedVoiceoverTextHash: null,
      speechDuration: null,
      speechEndTime: null,
      speechStartTime: null,
      text: "один два три четыре пять шесть",
      voiceSourceDuration: null,
      voiceSourceEndTime: null,
      voiceSourceStartTime: null,
    });
    const session = createProjectVoiceoverDraft([segment]);
    const voiceoverDurationInfo = getWorkspaceSegmentTimelineVoiceoverDurationInfo(segment, session);
    const labelDuration = getWorkspaceSegmentEstimatedVoiceoverLabelDurationSeconds(segment, session);

    expect(voiceoverDurationInfo).toEqual({
      durationSeconds: 2.04,
      source: "estimated",
    });
    expect(labelDuration).toBe(voiceoverDurationInfo?.durationSeconds);
  });

  it("preserves a user-selected photo duration when pending voiceover text is shorter", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 6.2,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 6.2,
      manualDurationSeconds: 6.2,
      mediaType: "photo",
      startTime: 0,
      text: "a",
    });
    const session = createProjectVoiceoverDraft([segment]);
    const clearedSegment = clearWorkspaceSegmentEditorVoiceoverGenerationState(segment, {
      resetTimelineToEstimatedVoiceover: true,
      session,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      {
        ...session,
        segments: [clearedSegment],
      },
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 6.2,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 6.2,
      manualDurationSeconds: 6.2,
      startTime: 0,
    }));
  });

  it("preserves a user-selected video duration when pending voiceover text is shorter", () => {
    const segment = createProjectVoiceoverSegment({
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
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "video",
      startTime: 0,
      text: "a",
      videoAction: "custom",
    });
    const session = createProjectVoiceoverDraft([segment]);
    const clearedSegment = clearWorkspaceSegmentEditorVoiceoverGenerationState(segment, {
      resetTimelineToEstimatedVoiceover: true,
      session,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      {
        ...session,
        segments: [clearedSegment],
      },
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 5,
      manualDurationSeconds: 5,
      startTime: 0,
    }));
  });

  it("resets a user-selected visual duration when voice text edit invalidates the old voiceover", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 6.9,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 6.9,
      manualDurationSeconds: 6.9,
      mediaType: "photo",
      speechDuration: 6.1,
      speechDurationSource: "audio",
      speechEndTime: 6.1,
      speechStartTime: 0,
      startTime: 0,
      text: "a",
      voiceSourceDuration: 6.1,
      voiceSourceEndTime: 6.1,
      voiceSourceStartTime: 0,
    });
    const session = createProjectVoiceoverDraft([segment]);
    const clearedSegment = clearWorkspaceSegmentEditorVoiceoverGenerationState(segment, {
      preserveUserSelectedVisualDuration: false,
      previousText: "Чемпионат мира 2026 года в Северной Америке перевернет все футбольные расклады!",
      resetTimelineToEstimatedVoiceover: true,
      session,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      {
        ...session,
        segments: [clearedSegment],
      },
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 1.8,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: false,
      endTime: 1.8,
      estimatedVoiceoverDurationSeconds: 1.8,
      estimatedVoiceoverTextHash: getWorkspaceSegmentVoiceoverTextHash("a"),
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("preserves a user-selected photo scene duration over a shorter generated voiceover duration", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 5,
      manualDurationSeconds: 5,
      mediaType: "photo",
      speechDuration: 2.2,
      speechDurationSource: "audio",
      speechEndTime: 2.2,
      speechStartTime: 0,
      startTime: 0,
      voiceSourceDuration: 2.2,
      voiceSourceEndTime: 2.2,
      voiceSourceStartTime: 0,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      createProjectVoiceoverDraft([segment]),
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 5,
      manualDurationSeconds: 5,
      startTime: 0,
    }));
  });

  it("preserves a loaded project photo slot duration when source kind metadata is missing", () => {
    const segment = createProjectVoiceoverSegment({
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=3978&segmentIndex=0&source=original",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=3978&segmentIndex=0&source=original&delivery=preview",
      currentSourceKind: "unknown",
      duration: 5.06,
      endTime: 5.06,
      mediaType: "photo",
      originalPlaybackUrl: "/api/workspace/project-segment-video?projectId=3978&segmentIndex=0&source=original",
      originalPreviewUrl: "/api/workspace/project-segment-video?projectId=3978&segmentIndex=0&source=original&delivery=preview",
      originalSourceKind: "unknown",
      speechDuration: 4.64,
      speechDurationSource: "audio",
      speechEndTime: 4.64,
      speechStartTime: 0,
      startTime: 0,
      voiceSourceDuration: 4.64,
      voiceSourceEndTime: 4.64,
      voiceSourceStartTime: 0,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      createProjectVoiceoverDraft([segment]),
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 5.06,
      durationMode: "auto",
      endTime: 5.06,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });

  it("keeps an untouched fifth project scene duration when another scene receives a long photo animation", () => {
    const firstSegment = createProjectVoiceoverSegment({
      duration: 3.9,
      endTime: 3.9,
      index: 0,
      mediaType: "photo",
      speechDuration: 3.7,
      speechDurationSource: "audio",
      speechEndTime: 3.7,
      speechStartTime: 0,
      voiceSourceDuration: 3.7,
      voiceSourceEndTime: 3.7,
      voiceSourceStartTime: 0,
    });
    const animatedSecondSegment = createProjectVoiceoverSegment({
      aiVideoAsset: {
        durationSeconds: 30,
        fileName: "scene-2-animation.mp4",
        fileSize: 1024,
        mimeType: "video/mp4",
        remoteUrl: "/api/workspace/media-assets/902/playback",
        source: "media-library",
      },
      aiVideoGeneratedMode: "photo_animation",
      duration: 30,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: true,
      endTime: 33.9,
      index: 1,
      manualDurationSeconds: 30,
      mediaType: "photo",
      speechDuration: 4.3,
      speechDurationSource: "audio",
      speechEndTime: 8.2,
      speechStartTime: 3.9,
      startTime: 3.9,
      videoAction: "photo_animation",
      voiceSourceDuration: 4.3,
      voiceSourceEndTime: 8.2,
      voiceSourceStartTime: 3.9,
    });
    const fifthSegment = createProjectVoiceoverSegment({
      currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=3999&segmentIndex=4&source=original",
      currentPreviewUrl: "/api/workspace/project-segment-video?projectId=3999&segmentIndex=4&source=original&delivery=preview",
      currentSourceKind: "unknown",
      duration: 4.9,
      endTime: 38.8,
      index: 4,
      mediaType: "photo",
      originalPlaybackUrl: "/api/workspace/project-segment-video?projectId=3999&segmentIndex=4&source=original",
      originalPreviewUrl: "/api/workspace/project-segment-video?projectId=3999&segmentIndex=4&source=original&delivery=preview",
      originalSourceKind: "unknown",
      speechDuration: 4.7,
      speechDurationSource: "audio",
      speechEndTime: 38.6,
      speechStartTime: 33.9,
      startTime: 33.9,
      voiceSourceDuration: 4.7,
      voiceSourceEndTime: 38.6,
      voiceSourceStartTime: 33.9,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      createProjectVoiceoverDraft([firstSegment, animatedSecondSegment, fifthSegment]),
      { preserveSourceTimelineEnd: false },
    );
    const rebuiltFifthSegment = rebuilt.segments.find((segment) => segment.index === 4);

    expect(rebuilt.segments.find((segment) => segment.index === 1)).toEqual(expect.objectContaining({
      duration: 30,
      manualDurationSeconds: 30,
    }));
    expect(rebuiltFifthSegment).toEqual(expect.objectContaining({
      duration: 5,
      manualDurationSeconds: null,
      startTime: 33.7,
    }));
  });

  it("drops a stale seven-second photo duration from a 1.7-second voiceover scene", () => {
    const segment = createProjectVoiceoverSegment({
      duration: 7,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 7,
      manualDurationSeconds: 7,
      mediaType: "photo",
      speechDuration: 1.7,
      speechDurationSource: "audio",
      speechEndTime: 1.7,
      speechStartTime: 0,
      startTime: 0,
      voiceSourceDuration: 1.7,
      voiceSourceEndTime: 1.7,
      voiceSourceStartTime: 0,
    });

    const rebuilt = rebuildWorkspaceSegmentEditorDraftSessionTimeline(
      createProjectVoiceoverDraft([segment]),
      { preserveSourceTimelineEnd: false },
    );

    expect(rebuilt.segments[0]).toEqual(expect.objectContaining({
      duration: 2,
      durationMode: "auto",
      endTime: 2,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });
});
