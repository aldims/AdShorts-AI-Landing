import { describe, expect, it } from "vitest";

import { DEFAULT_STUDIO_VOICE_ID } from "../../../shared/locales";
import {
  getWorkspaceSegmentEffectiveVoiceId,
  getWorkspaceSegmentEffectiveSubtitleSettings,
  getWorkspaceSegmentVoiceoverAudioPreviewSource,
  getWorkspaceSegmentTimelineVoiceoverDurationInfo,
  getStudioSceneSoundAssetPreviewMediaKind,
  hasWorkspaceSegmentProjectVoiceoverTimingData,
  isWorkspaceSegmentProjectTimelineVoiceoverAvailable,
  rebuildWorkspaceSegmentEditorDraftSessionTimeline,
} from "./workspace-segment-editor";
import {
  applyWorkspaceSegmentSceneSoundVisualAssetId,
  getWorkspaceSegmentSceneSoundVisualAssetId,
} from "./workspace-segment-visual-helpers";
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

describe("workspace segment editor scene sound preview", () => {
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

describe("workspace segment editor project voiceover timeline", () => {
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
      shouldClip: true,
      sourceKind: "project",
    }));
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
      previewRange: { endTime: 12.309, startTime: 0 },
      shouldClip: true,
      sourceKind: "project",
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
      endTime: 10.8,
      startTime: 5.25,
    }));
  });
});
