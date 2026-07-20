// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  persistStoredWorkspaceSegmentInfographicJobBeforePolling,
  readStoredWorkspaceSegmentInfographicJobs,
  upsertStoredWorkspaceSegmentInfographicJob,
  type StoredWorkspaceSegmentInfographicJob,
} from "./workspace-segment-editor-storage";

const EMAIL = "infographic-storage@example.com";

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

const buildJob = (
  overrides: Partial<StoredWorkspaceSegmentInfographicJob> = {},
): StoredWorkspaceSegmentInfographicJob => ({
  createdAt: Date.now(),
  idempotencyKey: "bb6473b9-837d-43d0-a905-6e20c5fc94a8",
  jobId: "job-infographic-storage",
  projectId: 4178,
  requestFingerprint: '{"projectId":4178,"segmentIndex":2}',
  segmentIndex: 2,
  serverRequestFingerprint: "a".repeat(64),
  sourceMediaAssetId: 55,
  sourceVisualIdentity: "asset:55",
  status: "queued",
  stylePrompt: "",
  templateId: "focus",
  text: "Рост 42%",
  ...overrides,
});

describe("workspace infographic pending-job storage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
  });

  it("round-trips both local and server request fingerprints for refresh recovery", () => {
    const job = buildJob();
    upsertStoredWorkspaceSegmentInfographicJob(EMAIL, job);

    expect(readStoredWorkspaceSegmentInfographicJobs(EMAIL)).toEqual([job]);
  });

  it("persists a paid job before deciding that its UI run should not poll", () => {
    const job = buildJob();
    let storedDuringPollingDecision: StoredWorkspaceSegmentInfographicJob[] = [];

    const canStartPolling = persistStoredWorkspaceSegmentInfographicJobBeforePolling(
      EMAIL,
      job,
      () => {
        storedDuringPollingDecision = readStoredWorkspaceSegmentInfographicJobs(EMAIL);
        return false;
      },
    );

    expect(canStartPolling).toBe(false);
    expect(storedDuringPollingDecision).toEqual([job]);
    expect(readStoredWorkspaceSegmentInfographicJobs(EMAIL)).toEqual([job]);
  });

  it("does not resume a record without a valid server request fingerprint", () => {
    upsertStoredWorkspaceSegmentInfographicJob(
      EMAIL,
      buildJob({ serverRequestFingerprint: "missing" }),
    );

    expect(readStoredWorkspaceSegmentInfographicJobs(EMAIL)).toEqual([]);
  });

  it("round-trips scratch jobs only when they carry their stable draft id", () => {
    const scratchJob = buildJob({
      draftId: "scratch:infographic-draft",
      projectId: 0,
      requestFingerprint: '{"projectId":0,"draftId":"scratch:infographic-draft"}',
    });
    upsertStoredWorkspaceSegmentInfographicJob(EMAIL, scratchJob);

    expect(readStoredWorkspaceSegmentInfographicJobs(EMAIL)).toEqual([scratchJob]);

    upsertStoredWorkspaceSegmentInfographicJob(EMAIL, buildJob({ draftId: undefined, projectId: 0 }));
    expect(readStoredWorkspaceSegmentInfographicJobs(EMAIL)).toEqual([]);

    upsertStoredWorkspaceSegmentInfographicJob(EMAIL, buildJob({ draftId: "project:42", projectId: 0 }));
    expect(readStoredWorkspaceSegmentInfographicJobs(EMAIL)).toEqual([]);
  });
});
