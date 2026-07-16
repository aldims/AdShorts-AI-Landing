// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  findOldestStoredWorkspaceSegmentJobForDraft,
  isStoredWorkspaceSegmentJobForDraft,
  readStoredWorkspaceSegmentEditorScratchDraft,
  readStoredWorkspaceSegmentEditorExplicitReset,
  readStoredWorkspaceSegmentAiPhotoJobs,
  readStoredWorkspaceSegmentAiVideoJobs,
  readStoredWorkspaceSegmentPhotoAnimationJobs,
  readStoredWorkspaceSegmentSceneSoundJobs,
  readStoredWorkspaceSegmentVoiceoverJobs,
  readWorkspaceSegmentEditorStorageCandidates,
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

  it("round-trips a client-assigned AI video job before the create response arrives", () => {
    const email = "editor@example.test";
    const jobId = "8d2c30ec-e96f-49e7-8fcb-81f44971748e";
    const createdAt = Date.now();

    upsertStoredWorkspaceSegmentAiVideoJob(email, {
      createdAt,
      draftId: "project:42",
      durationSeconds: 4,
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
