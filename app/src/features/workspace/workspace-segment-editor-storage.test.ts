// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  findOldestStoredWorkspaceSegmentJobForDraft,
  isStoredWorkspaceSegmentJobForDraft,
  readStoredWorkspaceSegmentEditorDraft,
  readStoredWorkspaceSegmentEditorRuntimeState,
  readStoredWorkspaceSegmentEditorScratchDraft,
  readStoredWorkspaceSegmentEditorExplicitReset,
  readStoredWorkspaceSegmentAiPhotoJobs,
  readStoredWorkspaceSegmentAiVideoJobs,
  readStoredWorkspaceSegmentPhotoAnimationJobs,
  readStoredWorkspaceSegmentSceneSoundJobs,
  readStoredWorkspaceSegmentVoiceoverJobs,
  readWorkspaceSegmentEditorStorageCandidates,
  removeStoredWorkspaceSegmentEditorDraft,
  removeStoredWorkspaceSegmentEditorExplicitReset,
  removeStoredWorkspaceSegmentAiPhotoJobsForSegment,
  removeStoredWorkspaceSegmentPhotoAnimationJobsForSegment,
  removeStoredWorkspaceSegmentVoiceoverJob,
  WORKSPACE_SEGMENT_EDITOR_SCRATCH_DRAFT_STORAGE_KEY_PREFIX,
  upsertStoredWorkspaceSegmentSceneSoundJob,
  upsertStoredWorkspaceSegmentAiPhotoJob,
  upsertStoredWorkspaceSegmentAiVideoJob,
  upsertStoredWorkspaceSegmentPhotoAnimationJob,
  upsertStoredWorkspaceSegmentVoiceoverJob,
  writeStoredWorkspaceSegmentEditorExplicitReset,
  writeStoredWorkspaceSegmentEditorDraft,
  writeStoredWorkspaceSegmentEditorRuntimeState,
  writeStoredWorkspaceSegmentEditorScratchDraft,
  writeWorkspaceSegmentEditorStorageValue,
} from "./workspace-segment-editor-storage";
import { createWorkspaceSegmentEditorScratchDraftSession } from "./workspace-segment-editor";

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
};

describe("workspace segment editor storage fallback", () => {
  let localStorage: Storage;
  let sessionStorage: Storage;

  beforeEach(() => {
    localStorage = createMemoryStorage();
    sessionStorage = createMemoryStorage();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorage,
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: sessionStorage,
    });
  });

  it("keeps the session fallback as the only source when local storage is full", () => {
    const storageKey = "adshorts.segment-editor-draft:test:4197";
    localStorage.setItem(storageKey, "stale-scene-video");
    localStorage.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };

    writeWorkspaceSegmentEditorStorageValue(storageKey, "latest-scene-video");

    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(sessionStorage.getItem(storageKey)).toBe("latest-scene-video");
  });

  it("prefers an existing session fallback over a stale local value", () => {
    const storageKey = "adshorts.segment-editor-draft:test:4197";
    localStorage.setItem(storageKey, "stale-scene-video");
    sessionStorage.setItem(storageKey, "latest-scene-video");

    expect(readWorkspaceSegmentEditorStorageCandidates(storageKey)).toEqual([
      { rawValue: "latest-scene-video", storageName: "sessionStorage" },
      { rawValue: "stale-scene-video", storageName: "localStorage" },
    ]);
  });

  it("persists an explicit reset marker until it is deliberately cleared", () => {
    expect(readStoredWorkspaceSegmentEditorExplicitReset("editor@example.test", 4205)).toBe(false);

    writeStoredWorkspaceSegmentEditorExplicitReset("editor@example.test", 4205);

    expect(readStoredWorkspaceSegmentEditorExplicitReset("EDITOR@example.test", 4205)).toBe(true);

    removeStoredWorkspaceSegmentEditorExplicitReset("editor@example.test", 4205);

    expect(readStoredWorkspaceSegmentEditorExplicitReset("editor@example.test", 4205)).toBe(false);
  });

  it("matches a pending job only to its originating scratch draft", () => {
    const draft = {
      ...createWorkspaceSegmentEditorScratchDraftSession(),
      draftId: "scratch:current",
    };

    expect(isStoredWorkspaceSegmentJobForDraft({ draftId: "scratch:current", projectId: 0 }, draft)).toBe(true);
    expect(isStoredWorkspaceSegmentJobForDraft({ draftId: "scratch:other", projectId: 0 }, draft)).toBe(false);
    expect(isStoredWorkspaceSegmentJobForDraft({ draftId: "scratch:current", projectId: 1 }, draft)).toBe(false);
    expect(isStoredWorkspaceSegmentJobForDraft({ projectId: 0 }, draft)).toBe(false);
    expect(isStoredWorkspaceSegmentJobForDraft({ projectId: 42 }, { ...draft, projectId: 42 })).toBe(true);
    expect(
      isStoredWorkspaceSegmentJobForDraft(
        { draftId: "project:older-tab", projectId: 42 },
        { ...draft, draftId: "project:newer-tab", projectId: 42 },
      ),
    ).toBe(true);
    expect(isStoredWorkspaceSegmentJobForDraft({ draftId: "scratch:current", projectId: 0 }, null)).toBe(false);
  });

  it("restores and clears pending jobs only within their originating scratch draft", () => {
    const email = "editor@example.test";
    const currentDraft = {
      ...createWorkspaceSegmentEditorScratchDraftSession(),
      draftId: "scratch:current",
    };
    const now = Date.now();

    upsertStoredWorkspaceSegmentAiPhotoJob(email, {
      createdAt: now,
      draftId: "scratch:current",
      jobId: "current-job",
      projectId: 0,
      prompt: "current draft prompt",
      segmentIndex: 0,
      status: "processing",
    });
    upsertStoredWorkspaceSegmentAiPhotoJob(email, {
      createdAt: now - 1_000,
      draftId: "scratch:other",
      jobId: "other-job",
      projectId: 0,
      prompt: "other draft prompt",
      segmentIndex: 0,
      status: "queued",
    });

    const storedJobs = readStoredWorkspaceSegmentAiPhotoJobs(email);
    expect(storedJobs).toHaveLength(2);
    expect(findOldestStoredWorkspaceSegmentJobForDraft(storedJobs, currentDraft)).toMatchObject({
      draftId: "scratch:current",
      jobId: "current-job",
    });

    removeStoredWorkspaceSegmentAiPhotoJobsForSegment(email, 0, 0, "scratch:current");

    expect(readStoredWorkspaceSegmentAiPhotoJobs(email)).toEqual([
      expect.objectContaining({
        draftId: "scratch:other",
        jobId: "other-job",
      }),
    ]);
  });

  it("skips an older ineligible receipt when resuming a persisted project job", () => {
    const draft = {
      ...createWorkspaceSegmentEditorScratchDraftSession(),
      draftId: "project:new-tab",
      projectId: 42,
    };
    const jobs = [
      {
        createdAt: 100,
        draftId: "project:old-tab",
        jobId: "stale-inputs",
        projectId: 42,
      },
      {
        createdAt: 200,
        draftId: "project:new-tab",
        jobId: "current-inputs",
        projectId: 42,
      },
    ];

    expect(
      findOldestStoredWorkspaceSegmentJobForDraft(
        jobs,
        draft,
        (job) => job.jobId === "current-inputs",
      ),
    ).toMatchObject({
      jobId: "current-inputs",
    });
  });

  it("round-trips a client-assigned AI video job before the create response arrives", () => {
    const email = "editor@example.test";
    const jobId = "8d2c30ec-e96f-49e7-8fcb-81f44971748e";
    const createdAt = Date.now();

    upsertStoredWorkspaceSegmentAiVideoJob(email, {
      createdAt,
      draftId: "project:42",
      durationSeconds: 4,
      generateAudio: true,
      jobId,
      projectId: 42,
      prompt: "Camera pulls back",
      segmentIndex: 3,
      status: "submitting",
    });

    expect(readStoredWorkspaceSegmentAiVideoJobs("EDITOR@example.test")).toEqual([
      {
        createdAt,
        draftId: "project:42",
        durationSeconds: 4,
        generateAudio: true,
        jobId,
        projectId: 42,
        prompt: "Camera pulls back",
        segmentIndex: 3,
        status: "submitting",
      },
    ]);
  });

  it("keeps a generated scratch video on durable media routes across storage round trips", () => {
    const draft = createWorkspaceSegmentEditorScratchDraftSession();
    draft.segments[0].aiVideoAsset = {
      assetId: 741,
      fileName: "seedance.mp4",
      fileSize: 1024,
      generateAudio: true,
      mimeType: "video/mp4",
      posterUrl: "/api/studio/segment-ai-video/jobs/job-1/poster",
      remoteUrl: "/api/studio/segment-ai-video/jobs/job-1/video",
    };

    writeStoredWorkspaceSegmentEditorScratchDraft("editor@example.test", draft);

    const restoredDraft = readStoredWorkspaceSegmentEditorScratchDraft("EDITOR@example.test");
    expect(restoredDraft?.draftId).toBe(draft.draftId);
    expect(restoredDraft?.segments[0].aiVideoAsset).toMatchObject({
      assetId: 741,
      generateAudio: true,
      posterUrl: "/api/workspace/media-assets/741/poster",
      remoteUrl: "/api/workspace/media-assets/741/playback",
    });
  });

  it("restores the complete applied scene state after a page refresh", () => {
    const draft = {
      ...createWorkspaceSegmentEditorScratchDraftSession(),
      customMusicAssetId: 905,
      customMusicFileName: "project-music.mp3",
      draftId: "project:4201",
      musicAssetId: 905,
      musicName: "Project music",
      musicType: "custom",
      projectId: 4201,
    };
    draft.segments[0] = {
      ...draft.segments[0],
      customVideo: {
        assetId: 701,
        durationSeconds: 6.4,
        fileName: "scene.mp4",
        fileSize: 0,
        mimeType: "video/mp4",
        remoteUrl: "/api/studio/uploads/temporary-scene",
      },
      duration: 5.2,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      endTime: 5.2,
      manualDurationSeconds: 5.2,
      sceneSoundAsset: {
        assetId: 702,
        fileName: "rain.wav",
        fileSize: 0,
        mimeType: "audio/wav",
        remoteUrl: "/api/studio/scene-sound/jobs/job-1/audio",
      },
      sceneSoundGeneratedFromPrompt: "rain on glass",
      sceneSoundPrompt: "rain on glass",
      sceneSoundPromptInitialized: true,
      speechDuration: 4.8,
      speechEndTime: 4.9,
      speechStartTime: 0.1,
      speechWords: [
        { confidence: 0.97, endTime: 0.7, startTime: 0.1, text: "Первое" },
      ],
      subtitleColor: "yellow",
      subtitleStyle: "bold",
      subtitleType: "modern",
      videoAction: "custom",
      visualReset: false,
    };

    writeStoredWorkspaceSegmentEditorDraft("editor@example.test", draft);

    const restoredDraft = readStoredWorkspaceSegmentEditorDraft("EDITOR@example.test", 4201);
    expect(restoredDraft).toMatchObject({
      customMusicAssetId: 905,
      musicAssetId: 905,
      musicType: "custom",
    });
    expect(restoredDraft?.segments[0]).toMatchObject({
      customVideo: {
        assetId: 701,
        durationSeconds: 6.4,
        remoteUrl: "/api/workspace/media-assets/701/playback",
      },
      duration: 5.2,
      durationMode: "manual",
      durationSyncMode: "voiceover",
      durationSyncModeUserSelected: true,
      manualDurationSeconds: 5.2,
      sceneSoundAsset: {
        assetId: 702,
        remoteUrl: "/api/workspace/media-assets/702",
      },
      sceneSoundPrompt: "rain on glass",
      speechDuration: 4.8,
      subtitleColor: "yellow",
      subtitleStyle: "bold",
      subtitleType: "modern",
      videoAction: "custom",
    });
    expect(restoredDraft?.segments[0].speechWords[0]).toMatchObject({ text: "Первое" });
  });

  it("restores per-scene undo and redo history for the same draft only", () => {
    const baseDraft = createWorkspaceSegmentEditorScratchDraftSession();
    const firstSegment = {
      ...baseDraft.segments[0],
      sceneSoundPrompt: "before rain",
      sceneSoundPromptInitialized: true,
    };
    const secondSegment = {
      ...baseDraft.segments[0],
      duration: 4.5,
      endTime: 8.5,
      index: 1,
      sceneSoundPrompt: "after rain",
      sceneSoundPromptInitialized: true,
      startTime: 4,
    };
    const previousSecondSegment = {
      ...secondSegment,
      sceneSoundPrompt: "before rain",
    };
    const draft = {
      ...baseDraft,
      draftId: "project:4202",
      projectId: 4202,
      segments: [firstSegment, secondSegment],
    };
    const infographicSnapshot = {
      infographic: null,
      infographicRemoved: false,
      infographicSourceWarningDismissedForIdentity: null,
      infographicStylePromptDraft: "minimal",
      infographicTextDraft: "42%",
    };

    writeStoredWorkspaceSegmentEditorRuntimeState("editor@example.test", draft, {
      activeSegmentIndex: 1,
      dismissedVisualHistory: { "visual:1": true },
      infographicHistory: {
        1: { future: [infographicSnapshot], past: [infographicSnapshot] },
      },
      redoSnapshots: {
        "sound:1": { kind: "sound", segment: secondSegment, segmentIndex: 1 },
      },
      soundPromptDraft: { prompt: "wind and rain", segmentIndex: 1 },
      visualDurationInputDraft: { segmentIndex: 1, value: "4.75" },
      visualHistory: {
        "visual:1": { future: [secondSegment], past: [previousSecondSegment] },
      },
      voiceHistory: {
        "voice:1": {
          future: [{ segment: secondSegment, segmentIndex: 1 }],
          past: [{ segment: previousSecondSegment, segmentIndex: 1 }],
        },
      },
    });

    const restoredRuntime = readStoredWorkspaceSegmentEditorRuntimeState("EDITOR@example.test", draft);
    expect(restoredRuntime).toMatchObject({
      activeSegmentIndex: 1,
      dismissedVisualHistory: { "visual:1": true },
      soundPromptDraft: { prompt: "wind and rain", segmentIndex: 1 },
      visualDurationInputDraft: { segmentIndex: 1, value: "4.75" },
    });
    expect(restoredRuntime?.visualHistory["visual:1"]?.past[0]).toMatchObject({
      sceneSoundPrompt: "before rain",
    });
    expect(restoredRuntime?.voiceHistory["voice:1"]?.future[0]).toMatchObject({
      segmentIndex: 1,
      segment: expect.objectContaining({ sceneSoundPrompt: "after rain" }),
    });
    expect(restoredRuntime?.redoSnapshots["sound:1"]).toMatchObject({
      kind: "sound",
      segmentIndex: 1,
    });
    expect(restoredRuntime?.infographicHistory[1]?.past[0]).toMatchObject({
      infographicStylePromptDraft: "minimal",
      infographicTextDraft: "42%",
    });

    expect(
      readStoredWorkspaceSegmentEditorRuntimeState("editor@example.test", {
        ...draft,
        draftId: "project:4202:new",
      }),
    ).toBeNull();

    writeStoredWorkspaceSegmentEditorRuntimeState("editor@example.test", draft, {
      ...restoredRuntime!,
      activeSegmentIndex: 1,
    });
    removeStoredWorkspaceSegmentEditorDraft("editor@example.test", draft.projectId);
    expect(readStoredWorkspaceSegmentEditorRuntimeState("editor@example.test", draft)).toBeNull();
  });

  it("persists the source visual identity of a pending scene sound job", () => {
    upsertStoredWorkspaceSegmentSceneSoundJob("editor@example.test", {
      createdAt: Date.now(),
      draftId: "scratch:scene-sound",
      jobId: "scene-sound-job-1",
      previousAssetId: 42,
      projectId: 0,
      prompt: "  quiet rain  ",
      segmentIndex: 3,
      sourceVisualIdentity: "  asset:271  ",
      status: "queued",
    });

    expect(readStoredWorkspaceSegmentSceneSoundJobs("EDITOR@example.test")).toEqual([
      expect.objectContaining({
        draftId: "scratch:scene-sound",
        jobId: "scene-sound-job-1",
        previousAssetId: 42,
        projectId: 0,
        prompt: "quiet rain",
        segmentIndex: 3,
        sourceVisualIdentity: "asset:271",
        status: "queued",
      }),
    ]);
  });

  it("replaces and clears pending photo animation jobs by scene", () => {
    const buildJob = (jobId: string) => ({
      createdAt: Date.now(),
      draftId: "project:42",
      generateAudio: true,
      jobId,
      projectId: 42,
      prompt: "animate the frame",
      refreshSceneSoundPrompt: "rain on glass",
      segmentIndex: 3,
      sourceAsset: null,
      sourceVisualIdentity: "asset:501",
      status: "queued",
    });

    upsertStoredWorkspaceSegmentPhotoAnimationJob("editor@example.test", buildJob("animation-1"));
    upsertStoredWorkspaceSegmentPhotoAnimationJob("editor@example.test", buildJob("animation-2"));

    expect(readStoredWorkspaceSegmentPhotoAnimationJobs("editor@example.test")).toHaveLength(1);
    expect(readStoredWorkspaceSegmentPhotoAnimationJobs("editor@example.test")[0]).toMatchObject({
      jobId: "animation-2",
      generateAudio: true,
      refreshSceneSoundPrompt: "rain on glass",
      sourceVisualIdentity: "asset:501",
    });

    removeStoredWorkspaceSegmentPhotoAnimationJobsForSegment("editor@example.test", 42, 3);

    expect(readStoredWorkspaceSegmentPhotoAnimationJobs("editor@example.test")).toEqual([]);
  });

  it("clears a pending AI photo job from a scratch scene after a durable visual replacement", () => {
    upsertStoredWorkspaceSegmentAiPhotoJob("editor@example.test", {
      createdAt: Date.now(),
      draftId: "scratch:ai-photo",
      jobId: "ai-photo-job-1",
      projectId: 0,
      prompt: "product on a marble table",
      segmentIndex: 0,
      status: "queued",
    });

    removeStoredWorkspaceSegmentAiPhotoJobsForSegment("editor@example.test", 0, 0, "scratch:ai-photo");

    expect(readStoredWorkspaceSegmentAiPhotoJobs("editor@example.test")).toEqual([]);
  });

  it("round-trips, replaces, and removes a pending single-scene voiceover job", () => {
    const email = "editor@example.test";
    upsertStoredWorkspaceSegmentVoiceoverJob(email, {
      createdAt: Date.now(),
      draftId: "scratch:voiceover",
      jobId: "voiceover-job-1",
      language: "en",
      projectId: 0,
      segmentIndex: 2,
      status: "queued",
      text: "  First   voiceover text  ",
      voiceType: "  Adam  ",
    });

    expect(readStoredWorkspaceSegmentVoiceoverJobs(email)).toEqual([
      expect.objectContaining({
        draftId: "scratch:voiceover",
        jobId: "voiceover-job-1",
        language: "en",
        projectId: 0,
        segmentIndex: 2,
        status: "queued",
        text: "First voiceover text",
        voiceType: "Adam",
      }),
    ]);

    upsertStoredWorkspaceSegmentVoiceoverJob(email, {
      createdAt: Date.now(),
      draftId: "scratch:voiceover",
      jobId: "voiceover-job-2",
      language: "en",
      projectId: 0,
      segmentIndex: 2,
      status: "processing",
      text: "Updated voiceover text",
      voiceType: "Adam",
    });

    expect(readStoredWorkspaceSegmentVoiceoverJobs(email)).toEqual([
      expect.objectContaining({
        jobId: "voiceover-job-2",
        status: "processing",
        text: "Updated voiceover text",
      }),
    ]);

    removeStoredWorkspaceSegmentVoiceoverJob(email, "voiceover-job-2");

    expect(readStoredWorkspaceSegmentVoiceoverJobs(email)).toEqual([]);
  });

  it("migrates a legacy scratch draft once and persists the assigned identity", () => {
    const email = "editor@example.test";
    const storageKey = `${WORKSPACE_SEGMENT_EDITOR_SCRATCH_DRAFT_STORAGE_KEY_PREFIX}${email}`;
    const legacyDraft = { ...createWorkspaceSegmentEditorScratchDraftSession() };
    delete legacyDraft.draftId;
    localStorage.setItem(storageKey, JSON.stringify({ ...legacyDraft, storageVersion: 3 }));

    const firstRead = readStoredWorkspaceSegmentEditorScratchDraft(email);
    const secondRead = readStoredWorkspaceSegmentEditorScratchDraft(email);

    expect(firstRead?.draftId).toMatch(/^scratch:/);
    expect(secondRead?.draftId).toBe(firstRead?.draftId);
    expect(JSON.parse(localStorage.getItem(storageKey) ?? "null")?.draftId).toBe(firstRead?.draftId);
  });
});
