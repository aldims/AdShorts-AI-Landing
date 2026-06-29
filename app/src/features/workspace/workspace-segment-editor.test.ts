import { describe, expect, it } from "vitest";

import { DEFAULT_STUDIO_VOICE_ID } from "../../../shared/locales";
import { STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST } from "../../../shared/studio-credit-costs";
import {
  applyWorkspaceSegmentEditorGlobalSubtitleSelection,
  applyWorkspaceSegmentEditorSceneVoiceOverride,
  getWorkspaceSegmentEffectiveVoiceId,
  getWorkspaceSegmentEffectiveSubtitleSettings,
  getWorkspaceSegmentKnownVisualDurationSeconds,
  getWorkspaceSegmentEditorProjectVoiceType,
  getWorkspaceSegmentEditorGenerationRequiredCredits,
  getWorkspaceSegmentEditorVisibleTimelineDisplayRange,
  getWorkspaceSegmentPreviewKind,
  getWorkspaceSegmentSelectedVisualPreviewKind,
  getWorkspaceSegmentVoiceoverAudioPreviewSource,
  getWorkspaceSegmentVoiceoverPreviewRange,
  getWorkspaceSegmentTimelineVoiceoverDurationInfo,
  getWorkspaceSegmentVisualAudioDurationMismatchInfo,
  getStudioSceneSoundAssetPreviewMediaKind,
  hasWorkspaceSegmentProjectVoiceoverTimingData,
  isWorkspaceTalkingPhotoMediaAsset,
  isWorkspaceSegmentProjectTimelineVoiceoverAvailable,
  isWorkspaceSegmentVoiceoverPlaybackFresh,
  createWorkspaceSegmentEditorInsertedSegment,
  createWorkspaceSegmentEditorDraftSession,
  clearWorkspaceSegmentEditorVoiceoverGenerationState,
  normalizeLegacyWorkspaceSegmentEditorDraftSession,
  rebuildWorkspaceSegmentEditorDraftSessionTimeline,
  repairWorkspaceSegmentEditorSpeechWordBoundaries,
  refreshWorkspaceSegmentEditorDraftWithFreshSession,
  restoreWorkspaceSegmentEditorDraftProjectTtsAsset,
  resetWorkspaceSegmentDraftVisualToOriginal,
  resolveWorkspaceSegmentEditorSegmentsAfterDelete,
  resolveWorkspaceSegmentBoundaryTiming,
  resolveWorkspaceSegmentVideoExtensionMenuSourceDurationSeconds,
  restoreWorkspaceSegmentTimelineSnapshot,
  shouldAutoTrimWorkspaceSegmentVideoToVoiceover,
  shouldIgnoreWorkspaceSegmentMeasuredVoiceoverDuration,
  syncWorkspaceSegmentMeasuredVideoVisualDuration,
} from "./workspace-segment-editor";
import {
  applyWorkspaceSegmentSceneSoundVisualAssetId,
  getWorkspaceSegmentCurrentVideoSourceAsset,
  getWorkspaceSegmentSceneSoundVisualAssetId,
} from "./workspace-segment-visual-helpers";
import { canReuseWorkspaceSegmentProjectTimelineVoiceover } from "./workspace-segment-editor-checklist";
import { normalizeStoredWorkspaceSegmentEditorDraftSession } from "./workspace-segment-editor-storage";
import type {
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentEditorDraftSession,
} from "./workspace-types";
import { getWorkspaceSegmentVoiceoverTextHash } from "./workspace-utils";

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
      voiceType: "Russian_BrightHeroine",
      voiceoverAsset: null,
      voiceoverLanguage: null,
      voiceoverTextHash: null,
      voiceoverVoiceType: null,
    }),
  );
  expect(updatedDraft.segments[1]).toBe(secondSegment);
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

  it("keeps regular audio scene sound assets on an audio element", () => {
    expect(getStudioSceneSoundAssetPreviewMediaKind({
      fileName: "scene-sound.wav",
      mimeType: "audio/wav",
    })).toBe("audio");
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
});

describe("workspace segment editor visual and voiceover mismatch", () => {
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
    expect(resolveWorkspaceSegmentVideoExtensionMenuSourceDurationSeconds(segment)).toBe(5);
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

  it("preserves a short manual video tail after a fresh voiceover duration", () => {
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
      duration: 11.8,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 11.8,
      manualDurationSeconds: 11.8,
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
      duration: 16.6,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 16.6,
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

  it("normalizes a stale generated-video visual slot before browser measurement", () => {
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
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 16.8,
      manualDurationSeconds: 5,
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

  it("keeps a generated-video visual slot at the default source duration when a blank scene is appended", () => {
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
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 16.7,
      manualDurationSeconds: 5,
      startTime: 11.7,
    }));
    expect(withInsertedSegment.segments[1]).toEqual(expect.objectContaining({
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 16.7,
      manualDurationSeconds: 5,
      startTime: 11.7,
    }));
    expect(withInsertedSegment.segments[2]).toEqual(expect.objectContaining({
      duration: 0,
      endTime: 16.7,
      startTime: 16.7,
    }));
  });

  it("keeps a generated-video visual slot at its stored source duration when a blank scene is appended", () => {
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
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 16.7,
      manualDurationSeconds: 5,
      startTime: 11.7,
    }));
    expect(withInsertedSegment.segments[1]).toEqual(expect.objectContaining({
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 16.7,
      manualDurationSeconds: 5,
      startTime: 11.7,
    }));
    expect(withInsertedSegment.segments[2]).toEqual(expect.objectContaining({
      duration: 0,
      endTime: 16.7,
      startTime: 16.7,
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
      duration: 5,
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      manualDurationSeconds: 5,
    }));
    expect(refreshed.segments[0]?.durationSyncMode).not.toBe("voiceover");
    expect(getWorkspaceSegmentKnownVisualDurationSeconds(refreshed.segments[0])).toBe(5);
  });

  it("adopts a longer fresh server video duration over a stale live draft duration", () => {
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
      duration: 5.042,
      durationMode: "manual",
      endTime: 5.042,
      manualDurationSeconds: 5.042,
      startTime: 0,
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
      duration: 4,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      endTime: 4,
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

  it("uses the generated-video source duration over a trimmed media asset duration", () => {
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

    expect(getWorkspaceSegmentKnownVisualDurationSeconds(segment)).toBe(5);
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
      duration: 2.2,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 2.2,
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
      duration: 4.7,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 4.7,
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

  it("restores a stale voiceover-trimmed video draft to the known visual duration", () => {
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
      durationExtensionSourceDurationSeconds: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      durationSyncModeUserSelected: false,
      endTime: 5,
      manualDurationSeconds: 5,
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
      duration: 2.2,
      durationExtensionSourceDurationSeconds: null,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 2.2,
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

    expect(isWorkspaceSegmentProjectTimelineVoiceoverAvailable(segment, session)).toBe(true);
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
      audioUrl: expect.stringContaining("/api/workspace/media-assets/777?v="),
      previewRange: { endTime: 22.957, startTime: 12.957 },
      projectVoiceoverAudioUrl: expect.stringContaining("/api/workspace/media-assets/777?v="),
      segmentVoiceoverAudioUrl: null,
      shouldClip: true,
      sourceKind: "project",
    }));
  });

  it("uses the project TTS timeline when legacy segment voiceover metadata is missing", () => {
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
    ).toBe(true);
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
      audioUrl: expect.stringContaining("/api/workspace/media-assets/777?v="),
      previewRange: { endTime: 24.919, startTime: 22.957 },
      projectVoiceoverAudioUrl: expect.stringContaining("/api/workspace/media-assets/777?v="),
      segmentVoiceoverAudioUrl: null,
      shouldClip: true,
      sourceKind: "project",
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

  it("requires an explicit unchanged-track opt-in before using stale project TTS without metadata", () => {
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
      audioUrl: expect.stringContaining("/api/workspace/media-assets/777?v="),
      previewRange: { endTime: 24.919, startTime: 22.957 },
      projectVoiceoverAudioUrl: expect.stringContaining("/api/workspace/media-assets/777?v="),
      segmentVoiceoverAudioUrl: null,
      shouldClip: true,
      sourceKind: "project",
    }));
  });

  it("reuses stale project TTS without metadata when only the visual changed", () => {
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
    ).toBe(true);
  });

  it("reuses project TTS only for unchanged scenes after one scene text edit", () => {
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
    ).toBe(true);
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
      audioUrl: expect.stringContaining("/api/workspace/media-assets/888"),
      latestSceneVoiceoverAudioUrl: null,
      previewRange: { endTime: 10.8, startTime: 5.4 },
      projectVoiceoverAudioUrl: expect.stringContaining("/api/workspace/media-assets/888?v="),
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
      endTime: 12.09,
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
      audioUrl: expect.stringContaining("/api/workspace/media-assets/888"),
      previewRange: { endTime: 12.09, startTime: 5.42 },
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
      projectVoiceoverAudioUrl: expect.stringContaining("/api/workspace/media-assets/888?v="),
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
      audioUrl: expect.stringContaining("/api/workspace/media-assets/888"),
      latestSceneVoiceoverAudioUrl: null,
      previewRange: { endTime: 2.25, startTime: 0 },
      projectVoiceoverAudioUrl: expect.stringContaining("/api/workspace/media-assets/888?v="),
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
      audioUrl: expect.stringContaining("/api/workspace/media-assets/888?v="),
      latestSceneVoiceoverAudioUrl: null,
      projectVoiceoverAudioUrl: expect.stringContaining("/api/workspace/media-assets/888?v="),
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
      projectVoiceoverAudioUrl: expect.stringContaining("/api/workspace/media-assets/777?v="),
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
      minimumDuration: 4.3,
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
      duration: 5.3,
      endTime: 5.3,
      speechDuration: 5.1,
      startTime: 0,
    }));
    expect(rebuilt.segments[1]).toEqual(expect.objectContaining({
      endTime: 10.9,
      startTime: 5.3,
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
      duration: 2.42,
      durationMode: "auto",
      durationSyncMode: "voiceover",
      endTime: 2.42,
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
      duration: 11.4,
      durationMode: "auto",
      durationSyncMode: "visual",
      endTime: 11.4,
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
      duration: 11.4,
      durationMode: "auto",
      endTime: 11.4,
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
      duration: 7.1,
      durationMode: "auto",
      endTime: 7.1,
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
      duration: 2.4,
      durationMode: "auto",
      endTime: 2.4,
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
      duration: 4.9,
      manualDurationSeconds: null,
      startTime: 33.9,
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
      duration: 1.9,
      durationMode: "auto",
      endTime: 1.9,
      manualDurationSeconds: null,
      startTime: 0,
    }));
  });
});
