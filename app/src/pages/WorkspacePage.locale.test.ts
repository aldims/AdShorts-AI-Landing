// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { DEFAULT_STUDIO_VOICE_ID } from "../../shared/locales";
import {
  buildWorkspaceSegmentEditorPayload,
  buildWorkspaceSegmentEditorChangeChecklist,
  createStudioCustomVideoFileFromMediaLibraryItem,
  distributeWorkspaceSegmentBulkSubtitleText,
  doesWorkspaceSegmentEditorPayloadMatchSessionStructure,
  getWorkspaceMediaLibraryItemRemoteUrl,
  getStudioLanguageForVoiceId,
  getStudioVoiceCreditCost,
  getWorkspaceInitialStudioDefaults,
  getWorkspaceSegmentEditorGenerationOverrides,
  getWorkspaceSegmentVisualGenerationDurationSeconds,
  getWorkspaceSegmentDraftPosterUrl,
  getWorkspaceSegmentDraftPreviewFallbackUrls,
  getWorkspaceSegmentDraftPreviewUrl,
  getWorkspaceSegmentDraftVideoUrl,
  getWorkspaceSegmentEditorProjectOpenOptions,
  getWorkspaceSegmentMediaIdentityKey,
  getWorkspaceSegmentResolvedMediaSurface,
  hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary,
  isWorkspaceSegmentDraftVisualResettable,
  normalizeStoredWorkspaceSegmentEditorDraftSession,
  preserveWorkspaceSegmentEditorOriginalVisualReferences,
  refreshWorkspaceSegmentEditorDraftWithFreshSession,
  resolveWorkspaceGenerationEffectiveVideoMode,
  resolveWorkspaceExamplePrefillInitialStudioState,
  resolveWorkspaceRegenerationVideoMode,
  resetWorkspaceSegmentDraftVisualToOriginal,
  resolveWorkspaceExamplePrefillSubtitleSelection,
  resolveWorkspaceSegmentActivationPlaybackIndex,
  resolveWorkspaceSegmentEditorStructureChangePermission,
  resolveStudioVoiceIdForLanguage,
  shouldAllowWorkspaceSegmentEditorStructureChange,
  shouldAllowWorkspaceSegmentPreviewVideoPlayback,
  shouldDeferSegmentEditorRouteRestore,
  shouldShowWorkspaceMediaLibraryLoadingState,
  studioVoiceOptionsByLanguage,
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
      currentPosterUrl: segment.currentPosterUrl,
      currentPreviewUrl: segment.currentPreviewUrl,
      currentSourceKind: segment.currentSourceKind,
      duration: segment.duration,
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

const createFreshSessionFromDraftSegments = (segments: DraftSegment[]): FreshSession => ({
  ...createFreshSession(segments[0] ?? createDraftSegment()),
  segments: segments.map((segment) => createFreshSession(segment).segments[0]!),
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

describe("WorkspacePage example prefill settings", () => {
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

  it("includes manual duration fields and resolved timeline duration in segment editor payload", async () => {
    const segment = createDraftSegment({
      duration: 4,
      durationMode: "manual",
      manualDurationSeconds: 7.2,
      text: "Manual payload segment",
    });

    const result = await buildWorkspaceSegmentEditorPayload(createDraftSession(segment), { language: "ru" });

    expect(result.payload.segments[0]).toEqual(
      expect.objectContaining({
        duration: 7.2,
        durationMode: "manual",
        endTime: 7.2,
        manualDurationSeconds: 7.2,
        startTime: 0,
      }),
    );
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

  it("blocks AI photo export when the selected asset is still the original visual", async () => {
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

    await expect(
      buildWorkspaceSegmentEditorPayload(createDraftSession(staleSegment), { language: "ru" }),
    ).rejects.toThrow("Визуал сегмента 1 не обновился");
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

  it("allows exporting an already-applied AI animation while adding scene sound", async () => {
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
      customVideoAssetId: 7001,
      sceneSoundAssetId: 8801,
      videoAction: "custom",
    });
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
    expect(checklist).toEqual([
      expect.objectContaining({
        label: "Сегмент 1: сброшен визуал",
        resetVisual: false,
        restoreVisual: true,
        segmentIndex: 0,
      }),
    ]);
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
