// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { DEFAULT_STUDIO_VOICE_ID } from "../../shared/locales";
import {
  createStudioCustomVideoFileFromMediaLibraryItem,
  getWorkspaceMediaLibraryItemRemoteUrl,
  getStudioLanguageForVoiceId,
  getWorkspaceInitialStudioDefaults,
  getWorkspaceSegmentDraftPreviewFallbackUrls,
  getWorkspaceSegmentDraftPreviewUrl,
  getWorkspaceSegmentDraftVideoUrl,
  getWorkspaceSegmentMediaIdentityKey,
  hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary,
  isWorkspaceSegmentDraftVisualResettable,
  preserveWorkspaceSegmentEditorOriginalVisualReferences,
  refreshWorkspaceSegmentEditorDraftWithFreshSession,
  resetWorkspaceSegmentDraftVisualToOriginal,
  resolveWorkspaceSegmentActivationPlaybackIndex,
  resolveStudioVoiceIdForLanguage,
} from "./WorkspacePage";

type DraftSegment = Parameters<typeof isWorkspaceSegmentDraftVisualResettable>[0];
type DraftSession = Parameters<typeof refreshWorkspaceSegmentEditorDraftWithFreshSession>[0];
type FreshSession = Parameters<typeof refreshWorkspaceSegmentEditorDraftWithFreshSession>[1];
type GeneratedMediaLibraryEntry = Parameters<typeof hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary>[1][number];
type MediaLibraryItem = Parameters<typeof createStudioCustomVideoFileFromMediaLibraryItem>[0];

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
  currentPreviewUrl: null,
  currentSourceKind: "unknown",
  customVideo: null,
  duration: 4,
  endTime: 4,
  imageEditAsset: null,
  imageEditGeneratedFromPrompt: null,
  imageEditPrompt: "",
  imageEditPromptInitialized: false,
  index: 0,
  mediaType: "photo",
  originalAsset: null,
  originalExternalPlaybackUrl: null,
  originalExternalPreviewUrl: null,
  originalPlaybackUrl: null,
  originalPreviewUrl: null,
  originalSourceKind: "unknown",
  originalText: "Segment",
  originalTextByLanguage: { ru: "Segment" },
  photoAnimationSourceAsset: null,
  speechDuration: null,
  speechEndTime: null,
  speechStartTime: null,
  speechWords: [],
  startTime: 0,
  text: "Segment",
  textByLanguage: { ru: "Segment" },
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
      currentPreviewUrl: segment.currentPreviewUrl,
      currentSourceKind: segment.currentSourceKind,
      duration: segment.duration,
      endTime: segment.endTime,
      index: segment.index,
      mediaType: segment.mediaType,
      originalAsset: segment.originalAsset,
      originalExternalPlaybackUrl: segment.originalExternalPlaybackUrl,
      originalExternalPreviewUrl: segment.originalExternalPreviewUrl,
      originalPlaybackUrl: segment.originalPlaybackUrl,
      originalPreviewUrl: segment.originalPreviewUrl,
      originalSourceKind: segment.originalSourceKind,
      speechDuration: segment.speechDuration,
      speechEndTime: segment.speechEndTime,
      speechStartTime: segment.speechStartTime,
      speechWords: segment.speechWords,
      startTime: segment.startTime,
      text: segment.text,
    },
  ],
  subtitleColor: "purple",
  subtitleStyle: "modern",
  subtitleType: "karaoke",
  title: "Session",
  voiceType: DEFAULT_STUDIO_VOICE_ID.ru,
});

const createGeneratedMediaLibraryEntry = (
  assetId: number,
  kind: GeneratedMediaLibraryEntry["item"]["kind"] = "ai_photo",
): GeneratedMediaLibraryEntry => ({
  createdAt: 1,
  id: `live:${kind}:job:test-job`,
  item: {
    assetExpiresAt: null,
    assetId,
    assetKind: null,
    assetLifecycle: null,
    assetMediaType: kind === "ai_photo" || kind === "image_edit" ? "photo" : "video",
    createdAt: 1,
    dedupeKey: `live:${kind}:job:test-job`,
    downloadName: "segment-ai-photo-1.jpg",
    downloadUrl: `/api/workspace/media-assets/${assetId}`,
    itemKey: `live:${kind}:job:test-job`,
    kind,
    previewKind: kind === "ai_photo" || kind === "image_edit" ? "image" : "video",
    previewPosterUrl: `/api/workspace/media-assets/${assetId}`,
    previewUrl: `/api/workspace/media-assets/${assetId}`,
    projectId: 77,
    projectTitle: "Session",
    segmentIndex: 0,
    segmentListIndex: 0,
    segmentNumber: 1,
    source: "live",
  },
  sourceJobId: "test-job",
});

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
    expect(resolveStudioVoiceIdForLanguage("en", DEFAULT_STUDIO_VOICE_ID.ru)).toBe(DEFAULT_STUDIO_VOICE_ID.en);
    expect(resolveStudioVoiceIdForLanguage("ru", DEFAULT_STUDIO_VOICE_ID.en)).toBe(DEFAULT_STUDIO_VOICE_ID.ru);
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
    expect(getWorkspaceSegmentDraftPreviewFallbackUrls(segment, "video")).toEqual([
      "/api/workspace/media-assets/909/playback",
    ]);
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

    expect(resolveWorkspaceSegmentActivationPlaybackIndex(segments, 1)).toBe(7);
    expect(resolveWorkspaceSegmentActivationPlaybackIndex(segments, 2)).toBe(12);
  });

  it("allows silent carousel activation when pending playback is explicitly disabled", () => {
    const segments = [{ index: 0 }, { index: 7 }];

    expect(resolveWorkspaceSegmentActivationPlaybackIndex(segments, 1, { pendingPlaybackIndex: null })).toBeNull();
    expect(resolveWorkspaceSegmentActivationPlaybackIndex(segments, 1, { pendingPlaybackIndex: 42 })).toBe(42);
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
