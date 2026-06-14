import { describe, expect, it } from "vitest";

import { DEFAULT_STUDIO_VOICE_ID } from "../../../shared/locales";
import {
  getWorkspaceSegmentEffectiveVoiceId,
  getWorkspaceSegmentEffectiveSubtitleSettings,
  getWorkspaceSegmentKnownVisualDurationSeconds,
  getWorkspaceSegmentEditorVisibleTimelineDisplayRange,
  getWorkspaceSegmentVoiceoverAudioPreviewSource,
  getWorkspaceSegmentTimelineVoiceoverDurationInfo,
  getWorkspaceSegmentVisualAudioDurationMismatchInfo,
  getStudioSceneSoundAssetPreviewMediaKind,
  hasWorkspaceSegmentProjectVoiceoverTimingData,
  isWorkspaceSegmentProjectTimelineVoiceoverAvailable,
  createWorkspaceSegmentEditorInsertedSegment,
  createWorkspaceSegmentEditorDraftSession,
  rebuildWorkspaceSegmentEditorDraftSessionTimeline,
  refreshWorkspaceSegmentEditorDraftWithFreshSession,
  resolveWorkspaceSegmentVideoExtensionMenuSourceDurationSeconds,
  shouldAutoTrimWorkspaceSegmentVideoToVoiceover,
  syncWorkspaceSegmentMeasuredVideoVisualDuration,
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
    ).toBeNull();
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
      duration: 2.4,
      startTime: 16.7,
    }));
    expect(withInsertedSegment.segments[2]?.endTime).toBeCloseTo(19.1);
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

  it("preserves an uploaded video visual duration after a freshly generated scene voiceover", () => {
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
      duration: 5,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 5,
      manualDurationSeconds: 5,
      startTime: 0,
    }));
  });

  it("normalizes a manual video visual with a stale voiceover sync flag back to visual duration", () => {
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
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 5,
      manualDurationSeconds: 5,
      speechDuration: 4.7,
      startTime: 0,
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

  it("preserves an intentionally extended uploaded video visual after a fresh scene voiceover", () => {
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
      duration: 10,
      durationMode: "manual",
      durationSyncMode: "visual",
      endTime: 10,
      manualDurationSeconds: 10,
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
