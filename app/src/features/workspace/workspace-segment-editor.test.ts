import { describe, expect, it } from "vitest";

import { DEFAULT_STUDIO_VOICE_ID } from "../../../shared/locales";
import {
  getStudioSceneSoundAssetPreviewMediaKind,
  rebuildWorkspaceSegmentEditorDraftSessionTimeline,
} from "./workspace-segment-editor";
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

  it("keeps regular audio scene sound assets on an audio element", () => {
    expect(getStudioSceneSoundAssetPreviewMediaKind({
      fileName: "scene-sound.wav",
      mimeType: "audio/wav",
    })).toBe("audio");
  });
});

describe("workspace segment editor project voiceover timeline", () => {
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
