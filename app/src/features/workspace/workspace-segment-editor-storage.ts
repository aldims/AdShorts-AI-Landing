import {
  cloneWorkspaceSegmentEditorDraftSegment,
  cloneWorkspaceSegmentEditorDraftSession,
  ensureWorkspaceSegmentEditorDraftId,
  getPositiveWorkspaceMediaAssetId,
  getStudioCustomAssetPreviewUrl,
  getWorkspaceSegmentEditorDraftId,
  getWorkspaceMediaAssetDurablePreviewUrl,
  getWorkspaceSegmentCustomPreviewKind,
  getWorkspaceSegmentDraftVisualAsset,
  getWorkspaceSegmentEditorSessionLanguage,
  getWorkspaceSegmentSelectedVisualPreviewKind,
  getWorkspaceSegmentStillPreviewUrls,
  getWorkspaceSegmentVoiceSourceDurationSeconds,
  normalizeLegacyWorkspaceSegmentEditorDraftSession,
  normalizeWorkspaceSegmentDurationMode,
  normalizeWorkspaceSegmentAiPhotoPrompt,
  normalizeWorkspaceSegmentAiPhotoPrompt as normalizeWorkspaceSegmentAiVideoPrompt,
  normalizeWorkspaceSegmentEditorSession,
  preserveWorkspaceSegmentEditorOriginalVisualReferences,
  rebuildWorkspaceSegmentEditorDraftSessionTimeline,
} from "./workspace-segment-editor";
import { normalizeWorkspaceVideoSourceUrl } from "./workspace-utils";
import { truncateWorkspaceSegmentInfographicText } from "./workspace-infographic-helpers";
import type {
  StudioLanguage,
  StudioCustomVideoFile,
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentEditorDraftSession,
  WorkspaceSegmentEditorSession,
} from "./workspace-types";
import { sanitizeWorkspaceSegmentEditorCustomMusicState } from "../../lib/workspaceSegmentEditorMusic";
import {
  estimateWorkspaceSegmentEditorSpeechDuration,
  isWorkspaceSegmentEditorLegacyPunctuationEstimatedDuration,
  normalizeWorkspaceSegmentManualDurationSeconds,
  roundWorkspaceSegmentTimelineSeconds,
} from "../../lib/workspaceSegmentEditorTimeline";

export type StoredWorkspaceSegmentPhotoAnimationJob = {
  createdAt: number;
  draftId?: string;
  durationExtensionSourceDurationSeconds?: number | null;
  durationExtensionTargetDurationSeconds?: number | null;
  durationSeconds?: number | null;
  jobId: string;
  projectId: number;
  prompt: string;
  refreshSceneSoundPrompt?: string;
  segmentIndex: number;
  sourceAsset: StudioCustomVideoFile | null;
  sourceVisualIdentity?: string;
  status: string;
};

export type StoredWorkspaceSegmentTalkingPhotoJob = {
  createdAt: number;
  draftId?: string;
  jobId: string;
  language?: StudioLanguage;
  projectId: number;
  script: string;
  segmentIndex: number;
  sourceAsset: StudioCustomVideoFile | null;
  sourceVisualIdentity?: string;
  status: string;
  voiceType?: string;
};

export type StoredWorkspaceSegmentImageEditJob = {
  createdAt: number;
  draftId?: string;
  jobId: string;
  projectId: number;
  prompt: string;
  segmentIndex: number;
  sourceVisualIdentity?: string;
  status: string;
};

export type StoredWorkspaceSegmentSceneSoundJob = {
  createdAt: number;
  draftId?: string;
  jobId: string;
  previousAssetId?: number | null;
  projectId: number;
  prompt: string;
  segmentIndex: number;
  sourceVisualIdentity?: string;
  status: string;
};

export type StoredWorkspaceSegmentAiPhotoJob = {
  createdAt: number;
  draftId?: string;
  jobId: string;
  projectId: number;
  prompt: string;
  segmentIndex: number;
  status: string;
};

export type StoredWorkspaceSegmentAiVideoJob = {
  createdAt: number;
  draftId?: string;
  durationSeconds?: number;
  jobId: string;
  projectId: number;
  prompt: string;
  segmentIndex: number;
  status: string;
};

export type StoredWorkspaceSegmentImageUpscaleJob = {
  createdAt: number;
  draftId?: string;
  jobId: string;
  projectId: number;
  segmentIndex: number;
  status: string;
};

export type StoredWorkspaceSegmentInfographicJob = {
  createdAt: number;
  draftId?: string;
  idempotencyKey: string;
  jobId: string;
  projectId: number;
  requestFingerprint: string;
  serverRequestFingerprint: string;
  segmentIndex: number;
  sourceMediaAssetId: number;
  sourceVisualIdentity: string;
  status: string;
  stylePrompt: string;
  text: string;
};

export type StoredWorkspaceSegmentVoiceoverJob = {
  createdAt: number;
  draftId?: string;
  jobId: string;
  language: StudioLanguage;
  projectId: number;
  segmentIndex: number;
  status: string;
  text: string;
  voiceType: string;
};

export type StoredWorkspaceSegmentBatchVoiceoverSegment = {
  language: StudioLanguage;
  segmentIndex: number;
  text: string;
  voiceType: string;
};

export type StoredWorkspaceSegmentBatchVoiceoverJob = {
  createdAt: number;
  draftId?: string;
  jobId: string;
  projectId: number;
  segments: StoredWorkspaceSegmentBatchVoiceoverSegment[];
  source: "create-shorts" | "global-voiceover";
  status: string;
};

export const isStoredWorkspaceSegmentJobForDraft = (
  job: Pick<StoredWorkspaceSegmentAiPhotoJob, "draftId" | "projectId">,
  draft: Pick<WorkspaceSegmentEditorDraftSession, "draftId" | "projectId"> | null | undefined,
) => {
  if (!draft || job.projectId !== draft.projectId) {
    return false;
  }

  const jobDraftId = String(job.draftId ?? "").trim();
  if (!jobDraftId) {
    // A project id uniquely identifies persisted drafts, but every scratch draft
    // uses project id 0. Legacy scratch jobs cannot be attached safely without
    // their originating draft id.
    return draft.projectId > 0;
  }
  return getWorkspaceSegmentEditorDraftId(draft) === jobDraftId;
};

type StoredWorkspaceSegmentJobDraftIdentity = Pick<StoredWorkspaceSegmentAiPhotoJob, "draftId" | "projectId">;
type StoredWorkspaceSegmentJobTargetIdentity = StoredWorkspaceSegmentJobDraftIdentity & {
  segmentIndex: number;
};

const isSameStoredWorkspaceSegmentJobDraft = (
  left: StoredWorkspaceSegmentJobDraftIdentity,
  right: StoredWorkspaceSegmentJobDraftIdentity,
) => {
  if (left.projectId !== right.projectId) {
    return false;
  }
  if (left.projectId > 0) {
    return true;
  }

  const leftDraftId = String(left.draftId ?? "").trim();
  const rightDraftId = String(right.draftId ?? "").trim();
  return Boolean(leftDraftId && rightDraftId && leftDraftId === rightDraftId);
};

const isSameStoredWorkspaceSegmentJobTarget = (
  left: StoredWorkspaceSegmentJobTargetIdentity,
  right: StoredWorkspaceSegmentJobTargetIdentity,
) => left.segmentIndex === right.segmentIndex && isSameStoredWorkspaceSegmentJobDraft(left, right);

export const findOldestStoredWorkspaceSegmentJobForDraft = <
  T extends StoredWorkspaceSegmentJobDraftIdentity & { createdAt: number },
>(
  jobs: readonly T[],
  draft: Pick<WorkspaceSegmentEditorDraftSession, "draftId" | "projectId"> | null | undefined,
): T | null => {
  let oldestJob: T | null = null;
  jobs.forEach((job) => {
    if (
      isStoredWorkspaceSegmentJobForDraft(job, draft) &&
      (!oldestJob || job.createdAt < oldestJob.createdAt)
    ) {
      oldestJob = job;
    }
  });
  return oldestJob;
};

const buildStoredWorkspaceSegmentJobTarget = (
  projectId: number | null | undefined,
  segmentIndex: number | null | undefined,
  draftId?: string | null,
): StoredWorkspaceSegmentJobTargetIdentity | null => {
  const normalizedProjectId = Number(projectId);
  const normalizedSegmentIndex = Number(segmentIndex);
  if (
    !Number.isInteger(normalizedProjectId) ||
    normalizedProjectId < 0 ||
    !Number.isInteger(normalizedSegmentIndex) ||
    normalizedSegmentIndex < 0
  ) {
    return null;
  }
  return {
    draftId: normalizeStoredWorkspaceSegmentJobDraftId(draftId),
    projectId: normalizedProjectId,
    segmentIndex: normalizedSegmentIndex,
  };
};

const WORKSPACE_SEGMENT_EDITOR_SESSION_STORAGE_KEY_PREFIX = "adshorts.segment-editor-session:";

export const normalizeWorkspaceSegmentEditorStorageEmail = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();

const getWorkspaceSegmentEditorSessionStorageKey = (email: string, projectId: number) =>
  `${WORKSPACE_SEGMENT_EDITOR_SESSION_STORAGE_KEY_PREFIX}${email}:${projectId}`;

type WorkspaceSegmentEditorStorageName = "localStorage" | "sessionStorage";

type WorkspaceSegmentEditorStorageCandidate = {
  rawValue: string;
  storageName: WorkspaceSegmentEditorStorageName;
};

type WorkspaceSegmentEditorStorageEntry = WorkspaceSegmentEditorStorageCandidate & {
  storageKey: string;
};

const WORKSPACE_SEGMENT_EDITOR_STORAGE_NAMES: WorkspaceSegmentEditorStorageName[] = ["localStorage", "sessionStorage"];
const WORKSPACE_SEGMENT_EDITOR_STORAGE_READ_PRIORITY: WorkspaceSegmentEditorStorageName[] = ["sessionStorage", "localStorage"];

const getWorkspaceSegmentEditorBrowserStorage = (storageName: WorkspaceSegmentEditorStorageName) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window[storageName];
  } catch {
    return null;
  }
};

const WORKSPACE_SEGMENT_VISUAL_DURATION_CACHE_STORAGE_KEY_PREFIX = "adshorts.segment-visual-duration:";

const getWorkspaceSegmentVisualDurationCacheStorageKey = (sourceUrl: string) =>
  `${WORKSPACE_SEGMENT_VISUAL_DURATION_CACHE_STORAGE_KEY_PREFIX}${sourceUrl}`;

export const readWorkspaceSegmentVisualDurationCache = (sourceUrl: string | null | undefined) => {
  const normalizedSourceUrl = normalizeWorkspaceVideoSourceUrl(sourceUrl);
  if (!normalizedSourceUrl) {
    return null;
  }

  for (const storageName of WORKSPACE_SEGMENT_EDITOR_STORAGE_NAMES) {
    const storage = getWorkspaceSegmentEditorBrowserStorage(storageName);
    if (!storage) {
      continue;
    }

    try {
      const durationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(
        storage.getItem(getWorkspaceSegmentVisualDurationCacheStorageKey(normalizedSourceUrl)),
      );
      if (durationSeconds !== null) {
        return roundWorkspaceSegmentTimelineSeconds(durationSeconds);
      }
    } catch {
      // Ignore unavailable browser storage.
    }
  }

  return null;
};

export const writeWorkspaceSegmentVisualDurationCache = (
  sourceUrl: string | null | undefined,
  durationSeconds: number | null | undefined,
) => {
  const normalizedSourceUrl = normalizeWorkspaceVideoSourceUrl(sourceUrl);
  const normalizedDurationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(durationSeconds);
  if (!normalizedSourceUrl || normalizedDurationSeconds === null) {
    return;
  }

  const storageKey = getWorkspaceSegmentVisualDurationCacheStorageKey(normalizedSourceUrl);
  const rawValue = String(roundWorkspaceSegmentTimelineSeconds(normalizedDurationSeconds));
  const localStorage = getWorkspaceSegmentEditorBrowserStorage("localStorage");

  try {
    if (localStorage) {
      localStorage.setItem(storageKey, rawValue);
      return;
    }
  } catch {
    // Fall back to sessionStorage below.
  }

  const sessionStorage = getWorkspaceSegmentEditorBrowserStorage("sessionStorage");
  try {
    sessionStorage?.setItem(storageKey, rawValue);
  } catch {
    // Ignore storage write errors.
  }
};

export const removeWorkspaceSegmentEditorStorageValueFrom = (
  storageName: WorkspaceSegmentEditorStorageName,
  storageKey: string,
) => {
  const storage = getWorkspaceSegmentEditorBrowserStorage(storageName);
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(storageKey);
  } catch {
    // Ignore storage cleanup errors.
  }
};

export const removeWorkspaceSegmentEditorStorageValue = (storageKey: string) => {
  WORKSPACE_SEGMENT_EDITOR_STORAGE_NAMES.forEach((storageName) => {
    removeWorkspaceSegmentEditorStorageValueFrom(storageName, storageKey);
  });
};

export const readWorkspaceSegmentEditorStorageCandidates = (storageKey: string): WorkspaceSegmentEditorStorageCandidate[] => {
  const candidates: WorkspaceSegmentEditorStorageCandidate[] = [];

  WORKSPACE_SEGMENT_EDITOR_STORAGE_READ_PRIORITY.forEach((storageName) => {
    const storage = getWorkspaceSegmentEditorBrowserStorage(storageName);
    if (!storage) {
      return;
    }

    try {
      const rawValue = storage.getItem(storageKey);
      if (rawValue) {
        candidates.push({ rawValue, storageName });
      }
    } catch {
      // Ignore storage read errors.
    }
  });

  return candidates;
};

const readWorkspaceSegmentEditorStorageEntries = (storageKeyPrefix: string): WorkspaceSegmentEditorStorageEntry[] => {
  const entries: WorkspaceSegmentEditorStorageEntry[] = [];

  WORKSPACE_SEGMENT_EDITOR_STORAGE_NAMES.forEach((storageName) => {
    const storage = getWorkspaceSegmentEditorBrowserStorage(storageName);
    if (!storage) {
      return;
    }

    const storageKeys: string[] = [];
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const storageKey = storage.key(index);
        if (storageKey?.startsWith(storageKeyPrefix)) {
          storageKeys.push(storageKey);
        }
      }
    } catch {
      return;
    }

    storageKeys.forEach((storageKey) => {
      try {
        const rawValue = storage.getItem(storageKey);
        if (rawValue) {
          entries.push({ rawValue, storageKey, storageName });
        }
      } catch {
        // Ignore storage read errors.
      }
    });
  });

  return entries;
};

export const writeWorkspaceSegmentEditorStorageValue = (storageKey: string, rawValue: string) => {
  const localStorage = getWorkspaceSegmentEditorBrowserStorage("localStorage");
  let didWriteLocalStorage = false;

  if (localStorage) {
    try {
      localStorage.setItem(storageKey, rawValue);
      didWriteLocalStorage = true;
    } catch {
      // Fall back to sessionStorage below.
    }
  }

  const sessionStorage = getWorkspaceSegmentEditorBrowserStorage("sessionStorage");
  if (!sessionStorage) {
    return;
  }

  try {
    if (didWriteLocalStorage) {
      sessionStorage.removeItem(storageKey);
      return;
    }

    sessionStorage.setItem(storageKey, rawValue);
    removeWorkspaceSegmentEditorStorageValueFrom("localStorage", storageKey);
  } catch {
    // Ignore storage write errors.
  }
};

export const readStoredWorkspaceSegmentEditorSession = (email: string | null | undefined, projectId: number | null | undefined) => {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return null;
  }

  const storageKey = getWorkspaceSegmentEditorSessionStorageKey(normalizedEmail, normalizedProjectId);
  for (const candidate of readWorkspaceSegmentEditorStorageCandidates(storageKey)) {
    try {
      const parsedValue = JSON.parse(candidate.rawValue) as unknown;
      if (!isStoredWorkspaceSegmentEditorSession(parsedValue)) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      const normalizedSession = normalizeWorkspaceSegmentEditorSession(parsedValue);
      if (Number(normalizedSession.projectId) !== normalizedProjectId) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      if (candidate.storageName === "sessionStorage") {
        writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedSession));
      }

      return normalizedSession;
    } catch {
      removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
    }
  }

  return null;
};

export const writeStoredWorkspaceSegmentEditorSession = (
  email: string | null | undefined,
  session: WorkspaceSegmentEditorSession | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(session?.projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0 || !session) {
    return;
  }

  const normalizedSession = normalizeWorkspaceSegmentEditorSession(session);
  const storedBaselineSession = readStoredWorkspaceSegmentEditorSession(normalizedEmail, normalizedProjectId);
  const sessionToStore = preserveWorkspaceSegmentEditorOriginalVisualReferences(
    normalizedSession,
    storedBaselineSession,
  );

  writeWorkspaceSegmentEditorStorageValue(
    getWorkspaceSegmentEditorSessionStorageKey(normalizedEmail, normalizedProjectId),
    JSON.stringify(sessionToStore),
  );
};

export const removeStoredWorkspaceSegmentEditorSession = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return;
  }

  removeWorkspaceSegmentEditorStorageValue(getWorkspaceSegmentEditorSessionStorageKey(normalizedEmail, normalizedProjectId));
};

export const WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_KEY_PREFIX = "adshorts.segment-editor-draft:";
export const WORKSPACE_SEGMENT_EDITOR_SCRATCH_DRAFT_STORAGE_KEY_PREFIX = "adshorts.segment-editor-scratch-draft:";
export const WORKSPACE_SEGMENT_EDITOR_SCRATCH_BASELINE_STORAGE_KEY_PREFIX = "adshorts.segment-editor-scratch-baseline:";
const WORKSPACE_SEGMENT_EDITOR_EXPLICIT_STRUCTURE_STORAGE_KEY_PREFIX = "adshorts.segment-editor-explicit-structure:";
const WORKSPACE_SEGMENT_EDITOR_EXPLICIT_RESET_STORAGE_KEY_PREFIX = "adshorts.segment-editor-explicit-reset:";
const WORKSPACE_SEGMENT_EDITOR_BRAND_STORAGE_KEY_PREFIX = "adshorts.segment-editor-brand:";
const WORKSPACE_SEGMENT_EDITOR_CONSUMED_SOURCE_STORAGE_KEY_PREFIX = "adshorts.segment-editor-consumed-source:";
const WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_VERSION = 3;
const WORKSPACE_SEGMENT_EDITOR_PERSISTED_DATA_URL_MAX_CHARS = 512_000;
export const WORKSPACE_SEGMENT_TALKING_PHOTO_DURATION_OVERFLOW_TOLERANCE_SECONDS = 0.1;
const WORKSPACE_SEGMENT_AI_PHOTO_PENDING_STORAGE_KEY_PREFIX = "adshorts.segment-ai-photo-pending:";
const WORKSPACE_SEGMENT_AI_PHOTO_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const WORKSPACE_SEGMENT_AI_VIDEO_PENDING_STORAGE_KEY_PREFIX = "adshorts.segment-ai-video-pending:";
const WORKSPACE_SEGMENT_AI_VIDEO_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const WORKSPACE_SEGMENT_PHOTO_ANIMATION_PENDING_STORAGE_KEY_PREFIX = "adshorts.segment-photo-animation-pending:";
const WORKSPACE_SEGMENT_PHOTO_ANIMATION_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const WORKSPACE_SEGMENT_TALKING_PHOTO_PENDING_STORAGE_KEY_PREFIX = "adshorts.segment-talking-photo-pending:";
const WORKSPACE_SEGMENT_TALKING_PHOTO_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const WORKSPACE_SEGMENT_IMAGE_EDIT_PENDING_STORAGE_KEY_PREFIX = "adshorts.segment-image-edit-pending:";
const WORKSPACE_SEGMENT_IMAGE_EDIT_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const WORKSPACE_SEGMENT_IMAGE_UPSCALE_PENDING_STORAGE_KEY_PREFIX = "adshorts.segment-image-upscale-pending:";
const WORKSPACE_SEGMENT_IMAGE_UPSCALE_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const WORKSPACE_SEGMENT_INFOGRAPHIC_PENDING_STORAGE_KEY_PREFIX = "adshorts.segment-infographic-pending:";
const WORKSPACE_SEGMENT_INFOGRAPHIC_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const WORKSPACE_SEGMENT_SCENE_SOUND_PENDING_STORAGE_KEY_PREFIX = "adshorts.segment-scene-sound-pending:";
const WORKSPACE_SEGMENT_SCENE_SOUND_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const WORKSPACE_SEGMENT_VOICEOVER_PENDING_STORAGE_KEY_PREFIX = "adshorts.segment-voiceover-pending:";
const WORKSPACE_SEGMENT_VOICEOVER_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const WORKSPACE_SEGMENT_BATCH_VOICEOVER_PENDING_STORAGE_KEY_PREFIX = "adshorts.segment-batch-voiceover-pending:";
const WORKSPACE_SEGMENT_BATCH_VOICEOVER_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const normalizeStoredWorkspaceSegmentJobDraftId = (value: unknown) => String(value ?? "").trim() || undefined;

export const getWorkspaceSegmentEditorProjectOpenOptions = (options?: { forceRefresh?: boolean }) => {
  const forceRefresh = Boolean(options?.forceRefresh);

  return {
    bypassCache: forceRefresh,
    discardLocalDraft: forceRefresh,
    forceRefresh,
  };
};

const getWorkspaceSegmentEditorDraftStorageKey = (email: string, projectId: number) =>
  `${WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_KEY_PREFIX}${email}:${projectId}`;

const getWorkspaceSegmentEditorScratchDraftStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_EDITOR_SCRATCH_DRAFT_STORAGE_KEY_PREFIX}${email}`;

const getWorkspaceSegmentEditorScratchBaselineStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_EDITOR_SCRATCH_BASELINE_STORAGE_KEY_PREFIX}${email}`;

const getWorkspaceSegmentEditorExplicitStructureStorageKey = (email: string, projectId: number) =>
  `${WORKSPACE_SEGMENT_EDITOR_EXPLICIT_STRUCTURE_STORAGE_KEY_PREFIX}${email}:${projectId}`;

const getWorkspaceSegmentEditorExplicitResetStorageKey = (email: string, projectId: number) =>
  `${WORKSPACE_SEGMENT_EDITOR_EXPLICIT_RESET_STORAGE_KEY_PREFIX}${email}:${projectId}`;

export const getWorkspaceSegmentEditorBrandStorageKey = (email: string, projectId: number) =>
  `${WORKSPACE_SEGMENT_EDITOR_BRAND_STORAGE_KEY_PREFIX}${email}:${projectId}`;

const getWorkspaceSegmentEditorConsumedSourceStorageKey = (email: string, projectId: number) =>
  `${WORKSPACE_SEGMENT_EDITOR_CONSUMED_SOURCE_STORAGE_KEY_PREFIX}${email}:${projectId}`;

const getWorkspaceSegmentAiPhotoPendingStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_AI_PHOTO_PENDING_STORAGE_KEY_PREFIX}${email}`;

const getWorkspaceSegmentAiVideoPendingStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_AI_VIDEO_PENDING_STORAGE_KEY_PREFIX}${email}`;

const getWorkspaceSegmentPhotoAnimationPendingStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_PHOTO_ANIMATION_PENDING_STORAGE_KEY_PREFIX}${email}`;

const getWorkspaceSegmentTalkingPhotoPendingStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_TALKING_PHOTO_PENDING_STORAGE_KEY_PREFIX}${email}`;

const getWorkspaceSegmentImageEditPendingStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_IMAGE_EDIT_PENDING_STORAGE_KEY_PREFIX}${email}`;

const getWorkspaceSegmentImageUpscalePendingStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_IMAGE_UPSCALE_PENDING_STORAGE_KEY_PREFIX}${email}`;

const getWorkspaceSegmentInfographicPendingStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_INFOGRAPHIC_PENDING_STORAGE_KEY_PREFIX}${email}`;

const getWorkspaceSegmentSceneSoundPendingStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_SCENE_SOUND_PENDING_STORAGE_KEY_PREFIX}${email}`;

const getWorkspaceSegmentVoiceoverPendingStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_VOICEOVER_PENDING_STORAGE_KEY_PREFIX}${email}`;

const getWorkspaceSegmentBatchVoiceoverPendingStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_BATCH_VOICEOVER_PENDING_STORAGE_KEY_PREFIX}${email}`;

const isWorkspaceSegmentEditorPersistableRemoteUrl = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) && !normalized.startsWith("data:") && !normalized.startsWith("blob:");
};

const normalizePersistedStudioCustomVideoFile = (value: StudioCustomVideoFile | null | undefined): StudioCustomVideoFile | null => {
  if (!value) {
    return null;
  }

  const dataUrl = typeof value.dataUrl === "string" ? value.dataUrl.trim() : "";
  const assetId = Number.isFinite(Number(value.assetId)) && Number(value.assetId) > 0 ? Math.trunc(Number(value.assetId)) : null;
  const durationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(value.durationSeconds);
  const fileName = typeof value.fileName === "string" ? value.fileName : "";
  const fileSize = Number.isFinite(value.fileSize) ? Math.max(0, value.fileSize) : 0;
  const libraryItemKey = typeof value.libraryItemKey === "string" ? value.libraryItemKey.trim() : "";
  const mimeType = typeof value.mimeType === "string" && value.mimeType.trim() ? value.mimeType : "application/octet-stream";
  const rawPosterUrl = typeof value.posterUrl === "string" ? value.posterUrl.trim() : "";
  const posterUrl = assetId && getWorkspaceSegmentCustomPreviewKind(value) === "video"
    ? `/api/workspace/media-assets/${assetId}/poster`
    : isWorkspaceSegmentEditorPersistableRemoteUrl(rawPosterUrl)
      ? rawPosterUrl
      : "";
  const rawRemoteUrl = typeof value.remoteUrl === "string" ? value.remoteUrl.trim() : "";
  const remoteUrl = getWorkspaceMediaAssetDurablePreviewUrl({
    assetId,
    fileName,
    mimeType,
    remoteUrl: isWorkspaceSegmentEditorPersistableRemoteUrl(rawRemoteUrl) ? rawRemoteUrl : "",
  }) ?? "";
  const shouldPersistDataUrl =
    Boolean(dataUrl) &&
    !assetId &&
    !remoteUrl &&
    !libraryItemKey &&
    dataUrl.length <= WORKSPACE_SEGMENT_EDITOR_PERSISTED_DATA_URL_MAX_CHARS;
  const source =
    value.source === "media-library" || value.source === "upload"
      ? value.source
      : undefined;

  if (!assetId && !shouldPersistDataUrl && !remoteUrl && !libraryItemKey) {
    return null;
  }

  return {
    assetId: assetId ?? undefined,
    dataUrl: shouldPersistDataUrl ? dataUrl : undefined,
    durationSeconds: durationSeconds ?? undefined,
    fileName,
    fileSize,
    generateAudio: value.generateAudio === true ? true : undefined,
    libraryItemKey: libraryItemKey || undefined,
    mimeType,
    posterUrl: posterUrl || undefined,
    remoteUrl: remoteUrl || undefined,
    source,
  };
};

const isStoredWorkspaceSegmentEditorDraftSession = (value: unknown): value is WorkspaceSegmentEditorDraftSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<WorkspaceSegmentEditorDraftSession> & { storageVersion?: unknown };
  return (
    payload.storageVersion === WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_VERSION &&
    Number.isFinite(Number(payload.projectId)) &&
    Array.isArray(payload.segments)
  );
};

const isStoredWorkspaceSegmentEditorSession = (value: unknown): value is WorkspaceSegmentEditorSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<WorkspaceSegmentEditorSession>;
  return Number.isFinite(Number(payload.projectId)) && Array.isArray(payload.segments);
};

const hasWorkspaceSegmentImmediateImagePreview = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const currentVisualAsset = getWorkspaceSegmentDraftVisualAsset(segment);
  const currentVisualAssetPreviewUrl =
    getWorkspaceSegmentCustomPreviewKind(currentVisualAsset) === "image"
      ? getStudioCustomAssetPreviewUrl(currentVisualAsset)
      : null;

  return (
    Boolean(currentVisualAssetPreviewUrl) ||
    getWorkspaceSegmentStillPreviewUrls(segment).length > 0
  );
};

const canRestoreStoredWorkspaceSegmentEditorDraftSession = (session: WorkspaceSegmentEditorDraftSession) =>
  session.segments.every((segment) => {
    const selectedVisualPreviewKind = getWorkspaceSegmentSelectedVisualPreviewKind(segment);
    if (selectedVisualPreviewKind !== "image") {
      return true;
    }

    return hasWorkspaceSegmentImmediateImagePreview(segment);
  });

const hasStoredWorkspaceSegmentSpeechTiming = (segment: WorkspaceSegmentEditorDraftSegment) =>
  normalizeWorkspaceSegmentManualDurationSeconds(segment.speechDuration) !== null ||
  normalizeWorkspaceSegmentManualDurationSeconds(segment.speechStartTime) !== null ||
  normalizeWorkspaceSegmentManualDurationSeconds(segment.speechEndTime) !== null ||
  getWorkspaceSegmentVoiceSourceDurationSeconds(segment) !== null ||
  (Array.isArray(segment.speechWords) && segment.speechWords.length > 0);

const normalizeStoredWorkspaceSegmentTimelineTime = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

const normalizeStoredWorkspaceSegmentLegacyEstimatedDuration = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentEditorDraftSegment => {
  const durationSeconds = normalizeWorkspaceSegmentManualDurationSeconds(segment.duration);
  if (
    durationSeconds === null ||
    normalizeWorkspaceSegmentDurationMode(segment.durationMode) !== "auto" ||
    normalizeWorkspaceSegmentManualDurationSeconds(segment.manualDurationSeconds) !== null ||
    segment.durationSyncModeUserSelected === true ||
    hasStoredWorkspaceSegmentSpeechTiming(segment) ||
    !isWorkspaceSegmentEditorLegacyPunctuationEstimatedDuration(segment.text, durationSeconds)
  ) {
    return segment;
  }

  const duration = estimateWorkspaceSegmentEditorSpeechDuration(segment.text);
  const startTime = normalizeStoredWorkspaceSegmentTimelineTime(segment.startTime) ?? 0;
  return {
    ...segment,
    duration,
    endTime: roundWorkspaceSegmentTimelineSeconds(startTime + duration),
    startTime,
  };
};

export const normalizeStoredWorkspaceSegmentEditorDraftSession = (
  session: WorkspaceSegmentEditorDraftSession,
): WorkspaceSegmentEditorDraftSession => {
  const fallbackLanguage = getWorkspaceSegmentEditorSessionLanguage(session);
  const clonedSession = ensureWorkspaceSegmentEditorDraftId(
    sanitizeWorkspaceSegmentEditorCustomMusicState(
      cloneWorkspaceSegmentEditorDraftSession(session),
    ),
  );
  return normalizeLegacyWorkspaceSegmentEditorDraftSession(rebuildWorkspaceSegmentEditorDraftSessionTimeline({
    ...clonedSession,
    segments: clonedSession.segments.map((segment) =>
      normalizeStoredWorkspaceSegmentLegacyEstimatedDuration({
        ...cloneWorkspaceSegmentEditorDraftSegment(segment, fallbackLanguage),
        aiPhotoAsset: normalizePersistedStudioCustomVideoFile(segment.aiPhotoAsset),
        aiVideoAsset: normalizePersistedStudioCustomVideoFile(segment.aiVideoAsset),
        customVideo: normalizePersistedStudioCustomVideoFile(segment.customVideo),
        imageEditAsset: normalizePersistedStudioCustomVideoFile(segment.imageEditAsset),
        photoAnimationSourceAsset: normalizePersistedStudioCustomVideoFile(segment.photoAnimationSourceAsset),
        sceneSoundAsset: normalizePersistedStudioCustomVideoFile(segment.sceneSoundAsset),
        voiceoverAsset: normalizePersistedStudioCustomVideoFile(segment.voiceoverAsset),
      }),
    ),
  }));
};

const isStoredWorkspaceSegmentAiPhotoJob = (value: unknown): value is StoredWorkspaceSegmentAiPhotoJob => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<StoredWorkspaceSegmentAiPhotoJob>;
  return (
    typeof payload.jobId === "string" &&
    payload.jobId.trim().length > 0 &&
    Number.isInteger(Number(payload.projectId)) &&
    Number(payload.projectId) >= 0 &&
    Number.isInteger(Number(payload.segmentIndex)) &&
    Number(payload.segmentIndex) >= 0
  );
};

const normalizeStoredWorkspaceSegmentAiPhotoJob = (
  value: StoredWorkspaceSegmentAiPhotoJob,
): StoredWorkspaceSegmentAiPhotoJob => ({
  createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
  draftId: normalizeStoredWorkspaceSegmentJobDraftId(value.draftId),
  jobId: String(value.jobId ?? "").trim(),
  projectId: Math.trunc(Number(value.projectId)),
  prompt: normalizeWorkspaceSegmentAiPhotoPrompt(value.prompt),
  segmentIndex: Math.trunc(Number(value.segmentIndex)),
  status: String(value.status ?? "queued").trim() || "queued",
});

export const readStoredWorkspaceSegmentAiPhotoJobs = (
  email: string | null | undefined,
): StoredWorkspaceSegmentAiPhotoJob[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const storageKey = getWorkspaceSegmentAiPhotoPendingStorageKey(normalizedEmail);
  const candidate = readWorkspaceSegmentEditorStorageCandidates(storageKey)[0];
  if (!candidate) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(candidate.rawValue) as unknown;
    const rawJobs = Array.isArray(parsedValue) ? parsedValue : [];
    const now = Date.now();
    const jobs = rawJobs
      .filter(isStoredWorkspaceSegmentAiPhotoJob)
      .map(normalizeStoredWorkspaceSegmentAiPhotoJob)
      .filter((job) => now - job.createdAt <= WORKSPACE_SEGMENT_AI_PHOTO_PENDING_TTL_MS);

    if (jobs.length !== rawJobs.length || candidate.storageName === "sessionStorage") {
      writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(jobs));
    }

    return jobs;
  } catch {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return [];
  }
};

const writeStoredWorkspaceSegmentAiPhotoJobs = (
  email: string | null | undefined,
  jobs: StoredWorkspaceSegmentAiPhotoJob[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return;
  }

  const storageKey = getWorkspaceSegmentAiPhotoPendingStorageKey(normalizedEmail);
  const normalizedJobs = jobs
    .filter(isStoredWorkspaceSegmentAiPhotoJob)
    .map(normalizeStoredWorkspaceSegmentAiPhotoJob)
    .filter((job) => Date.now() - job.createdAt <= WORKSPACE_SEGMENT_AI_PHOTO_PENDING_TTL_MS);

  if (!normalizedJobs.length) {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedJobs));
};

export const upsertStoredWorkspaceSegmentAiPhotoJob = (
  email: string | null | undefined,
  job: StoredWorkspaceSegmentAiPhotoJob,
) => {
  const normalizedJob = normalizeStoredWorkspaceSegmentAiPhotoJob(job);
  const jobs = readStoredWorkspaceSegmentAiPhotoJobs(email).filter(
    (item) =>
      item.jobId !== normalizedJob.jobId &&
      !isSameStoredWorkspaceSegmentJobTarget(item, normalizedJob),
  );
  writeStoredWorkspaceSegmentAiPhotoJobs(email, [normalizedJob, ...jobs]);
};

export const removeStoredWorkspaceSegmentAiPhotoJob = (
  email: string | null | undefined,
  jobId: string | null | undefined,
) => {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentAiPhotoJobs(email).filter((job) => job.jobId !== safeJobId);
  writeStoredWorkspaceSegmentAiPhotoJobs(email, jobs);
};

export const removeStoredWorkspaceSegmentAiPhotoJobsForSegment = (
  email: string | null | undefined,
  projectId: number | null | undefined,
  segmentIndex: number | null | undefined,
  draftId?: string | null,
) => {
  const target = buildStoredWorkspaceSegmentJobTarget(projectId, segmentIndex, draftId);
  if (!target) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentAiPhotoJobs(email).filter(
    (job) => !isSameStoredWorkspaceSegmentJobTarget(job, target),
  );
  writeStoredWorkspaceSegmentAiPhotoJobs(email, jobs);
};

const isStoredWorkspaceSegmentAiVideoJob = (value: unknown): value is StoredWorkspaceSegmentAiVideoJob => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<StoredWorkspaceSegmentAiVideoJob>;
  return (
    typeof payload.jobId === "string" &&
    payload.jobId.trim().length > 0 &&
    Number.isInteger(Number(payload.projectId)) &&
    Number(payload.projectId) >= 0 &&
    Number.isInteger(Number(payload.segmentIndex)) &&
    Number(payload.segmentIndex) >= 0
  );
};

const normalizeStoredWorkspaceSegmentAiVideoJob = (
  value: StoredWorkspaceSegmentAiVideoJob,
): StoredWorkspaceSegmentAiVideoJob => ({
  createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
  draftId: normalizeStoredWorkspaceSegmentJobDraftId(value.draftId),
  durationSeconds: normalizeWorkspaceSegmentManualDurationSeconds(value.durationSeconds) ?? undefined,
  jobId: String(value.jobId ?? "").trim(),
  projectId: Math.max(0, Math.trunc(Number(value.projectId))),
  prompt: normalizeWorkspaceSegmentAiVideoPrompt(value.prompt),
  segmentIndex: Math.trunc(Number(value.segmentIndex)),
  status: String(value.status ?? "queued").trim() || "queued",
});

export const readStoredWorkspaceSegmentAiVideoJobs = (
  email: string | null | undefined,
): StoredWorkspaceSegmentAiVideoJob[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const storageKey = getWorkspaceSegmentAiVideoPendingStorageKey(normalizedEmail);
  const candidate = readWorkspaceSegmentEditorStorageCandidates(storageKey)[0];
  if (!candidate) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(candidate.rawValue) as unknown;
    const rawJobs = Array.isArray(parsedValue) ? parsedValue : [];
    const now = Date.now();
    const jobs = rawJobs
      .filter(isStoredWorkspaceSegmentAiVideoJob)
      .map(normalizeStoredWorkspaceSegmentAiVideoJob)
      .filter((job) => now - job.createdAt <= WORKSPACE_SEGMENT_AI_VIDEO_PENDING_TTL_MS);

    if (jobs.length !== rawJobs.length || candidate.storageName === "sessionStorage") {
      writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(jobs));
    }

    return jobs;
  } catch {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return [];
  }
};

const writeStoredWorkspaceSegmentAiVideoJobs = (
  email: string | null | undefined,
  jobs: StoredWorkspaceSegmentAiVideoJob[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return;
  }

  const storageKey = getWorkspaceSegmentAiVideoPendingStorageKey(normalizedEmail);
  const normalizedJobs = jobs
    .filter(isStoredWorkspaceSegmentAiVideoJob)
    .map(normalizeStoredWorkspaceSegmentAiVideoJob)
    .filter((job) => Date.now() - job.createdAt <= WORKSPACE_SEGMENT_AI_VIDEO_PENDING_TTL_MS);

  if (!normalizedJobs.length) {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedJobs));
};

export const upsertStoredWorkspaceSegmentAiVideoJob = (
  email: string | null | undefined,
  job: StoredWorkspaceSegmentAiVideoJob,
) => {
  const normalizedJob = normalizeStoredWorkspaceSegmentAiVideoJob(job);
  const jobs = readStoredWorkspaceSegmentAiVideoJobs(email).filter(
    (item) =>
      item.jobId !== normalizedJob.jobId &&
      !isSameStoredWorkspaceSegmentJobTarget(item, normalizedJob),
  );
  writeStoredWorkspaceSegmentAiVideoJobs(email, [normalizedJob, ...jobs]);
};

export const removeStoredWorkspaceSegmentAiVideoJob = (
  email: string | null | undefined,
  jobId: string | null | undefined,
) => {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentAiVideoJobs(email).filter((job) => job.jobId !== safeJobId);
  writeStoredWorkspaceSegmentAiVideoJobs(email, jobs);
};

export const removeStoredWorkspaceSegmentAiVideoJobsForSegment = (
  email: string | null | undefined,
  projectId: number | null | undefined,
  segmentIndex: number | null | undefined,
  draftId?: string | null,
) => {
  const target = buildStoredWorkspaceSegmentJobTarget(projectId, segmentIndex, draftId);
  if (!target) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentAiVideoJobs(email).filter(
    (job) => !isSameStoredWorkspaceSegmentJobTarget(job, target),
  );
  writeStoredWorkspaceSegmentAiVideoJobs(email, jobs);
};

const isStoredWorkspaceSegmentImageEditJob = (value: unknown): value is StoredWorkspaceSegmentImageEditJob => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<StoredWorkspaceSegmentImageEditJob>;
  return (
    typeof payload.jobId === "string" &&
    payload.jobId.trim().length > 0 &&
    Number.isInteger(Number(payload.projectId)) &&
    Number(payload.projectId) >= 0 &&
    Number.isInteger(Number(payload.segmentIndex)) &&
    Number(payload.segmentIndex) >= 0
  );
};

const normalizeStoredWorkspaceSegmentImageEditJob = (
  value: StoredWorkspaceSegmentImageEditJob,
): StoredWorkspaceSegmentImageEditJob => ({
  createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
  draftId: normalizeStoredWorkspaceSegmentJobDraftId(value.draftId),
  jobId: String(value.jobId ?? "").trim(),
  projectId: Math.max(0, Math.trunc(Number(value.projectId))),
  prompt: normalizeWorkspaceSegmentAiPhotoPrompt(value.prompt),
  segmentIndex: Math.trunc(Number(value.segmentIndex)),
  sourceVisualIdentity: String(value.sourceVisualIdentity ?? "").trim() || undefined,
  status: String(value.status ?? "queued").trim() || "queued",
});

export const readStoredWorkspaceSegmentImageEditJobs = (
  email: string | null | undefined,
): StoredWorkspaceSegmentImageEditJob[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const storageKey = getWorkspaceSegmentImageEditPendingStorageKey(normalizedEmail);
  const candidate = readWorkspaceSegmentEditorStorageCandidates(storageKey)[0];
  if (!candidate) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(candidate.rawValue) as unknown;
    const rawJobs = Array.isArray(parsedValue) ? parsedValue : [];
    const now = Date.now();
    const jobs = rawJobs
      .filter(isStoredWorkspaceSegmentImageEditJob)
      .map(normalizeStoredWorkspaceSegmentImageEditJob)
      .filter((job) => now - job.createdAt <= WORKSPACE_SEGMENT_IMAGE_EDIT_PENDING_TTL_MS);

    if (jobs.length !== rawJobs.length || candidate.storageName === "sessionStorage") {
      writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(jobs));
    }

    return jobs;
  } catch {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return [];
  }
};

const writeStoredWorkspaceSegmentImageEditJobs = (
  email: string | null | undefined,
  jobs: StoredWorkspaceSegmentImageEditJob[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return;
  }

  const storageKey = getWorkspaceSegmentImageEditPendingStorageKey(normalizedEmail);
  const normalizedJobs = jobs
    .filter(isStoredWorkspaceSegmentImageEditJob)
    .map(normalizeStoredWorkspaceSegmentImageEditJob)
    .filter((job) => Date.now() - job.createdAt <= WORKSPACE_SEGMENT_IMAGE_EDIT_PENDING_TTL_MS);

  if (!normalizedJobs.length) {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedJobs));
};

export const upsertStoredWorkspaceSegmentImageEditJob = (
  email: string | null | undefined,
  job: StoredWorkspaceSegmentImageEditJob,
) => {
  const normalizedJob = normalizeStoredWorkspaceSegmentImageEditJob(job);
  const jobs = readStoredWorkspaceSegmentImageEditJobs(email).filter(
    (item) =>
      item.jobId !== normalizedJob.jobId &&
      !isSameStoredWorkspaceSegmentJobTarget(item, normalizedJob),
  );
  writeStoredWorkspaceSegmentImageEditJobs(email, [normalizedJob, ...jobs]);
};

export const removeStoredWorkspaceSegmentImageEditJob = (
  email: string | null | undefined,
  jobId: string | null | undefined,
) => {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentImageEditJobs(email).filter((job) => job.jobId !== safeJobId);
  writeStoredWorkspaceSegmentImageEditJobs(email, jobs);
};

export const removeStoredWorkspaceSegmentImageEditJobsForSegment = (
  email: string | null | undefined,
  projectId: number | null | undefined,
  segmentIndex: number | null | undefined,
  draftId?: string | null,
) => {
  const target = buildStoredWorkspaceSegmentJobTarget(projectId, segmentIndex, draftId);
  if (!target) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentImageEditJobs(email).filter(
    (job) => !isSameStoredWorkspaceSegmentJobTarget(job, target),
  );
  writeStoredWorkspaceSegmentImageEditJobs(email, jobs);
};

const isStoredWorkspaceSegmentImageUpscaleJob = (value: unknown): value is StoredWorkspaceSegmentImageUpscaleJob => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<StoredWorkspaceSegmentImageUpscaleJob>;
  return (
    typeof payload.jobId === "string" &&
    payload.jobId.trim().length > 0 &&
    Number.isInteger(Number(payload.projectId)) &&
    Number(payload.projectId) >= 0 &&
    Number.isInteger(Number(payload.segmentIndex)) &&
    Number(payload.segmentIndex) >= 0
  );
};

const normalizeStoredWorkspaceSegmentImageUpscaleJob = (
  value: StoredWorkspaceSegmentImageUpscaleJob,
): StoredWorkspaceSegmentImageUpscaleJob => ({
  createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
  draftId: normalizeStoredWorkspaceSegmentJobDraftId(value.draftId),
  jobId: String(value.jobId ?? "").trim(),
  projectId: Math.max(0, Math.trunc(Number(value.projectId))),
  segmentIndex: Math.trunc(Number(value.segmentIndex)),
  status: String(value.status ?? "queued").trim() || "queued",
});

export const readStoredWorkspaceSegmentImageUpscaleJobs = (
  email: string | null | undefined,
): StoredWorkspaceSegmentImageUpscaleJob[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const storageKey = getWorkspaceSegmentImageUpscalePendingStorageKey(normalizedEmail);
  const candidate = readWorkspaceSegmentEditorStorageCandidates(storageKey)[0];
  if (!candidate) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(candidate.rawValue) as unknown;
    const rawJobs = Array.isArray(parsedValue) ? parsedValue : [];
    const now = Date.now();
    const jobs = rawJobs
      .filter(isStoredWorkspaceSegmentImageUpscaleJob)
      .map(normalizeStoredWorkspaceSegmentImageUpscaleJob)
      .filter((job) => now - job.createdAt <= WORKSPACE_SEGMENT_IMAGE_UPSCALE_PENDING_TTL_MS);

    if (jobs.length !== rawJobs.length || candidate.storageName === "sessionStorage") {
      writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(jobs));
    }

    return jobs;
  } catch {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return [];
  }
};

const writeStoredWorkspaceSegmentImageUpscaleJobs = (
  email: string | null | undefined,
  jobs: StoredWorkspaceSegmentImageUpscaleJob[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return;
  }

  const storageKey = getWorkspaceSegmentImageUpscalePendingStorageKey(normalizedEmail);
  const normalizedJobs = jobs
    .filter(isStoredWorkspaceSegmentImageUpscaleJob)
    .map(normalizeStoredWorkspaceSegmentImageUpscaleJob)
    .filter((job) => Date.now() - job.createdAt <= WORKSPACE_SEGMENT_IMAGE_UPSCALE_PENDING_TTL_MS);

  if (!normalizedJobs.length) {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedJobs));
};

export const upsertStoredWorkspaceSegmentImageUpscaleJob = (
  email: string | null | undefined,
  job: StoredWorkspaceSegmentImageUpscaleJob,
) => {
  const normalizedJob = normalizeStoredWorkspaceSegmentImageUpscaleJob(job);
  const jobs = readStoredWorkspaceSegmentImageUpscaleJobs(email).filter(
    (item) =>
      item.jobId !== normalizedJob.jobId &&
      !isSameStoredWorkspaceSegmentJobTarget(item, normalizedJob),
  );
  writeStoredWorkspaceSegmentImageUpscaleJobs(email, [normalizedJob, ...jobs]);
};

export const removeStoredWorkspaceSegmentImageUpscaleJob = (
  email: string | null | undefined,
  jobId: string | null | undefined,
) => {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentImageUpscaleJobs(email).filter((job) => job.jobId !== safeJobId);
  writeStoredWorkspaceSegmentImageUpscaleJobs(email, jobs);
};

export const removeStoredWorkspaceSegmentImageUpscaleJobsForSegment = (
  email: string | null | undefined,
  projectId: number | null | undefined,
  segmentIndex: number | null | undefined,
  draftId?: string | null,
) => {
  const target = buildStoredWorkspaceSegmentJobTarget(projectId, segmentIndex, draftId);
  if (!target) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentImageUpscaleJobs(email).filter(
    (job) => !isSameStoredWorkspaceSegmentJobTarget(job, target),
  );
  writeStoredWorkspaceSegmentImageUpscaleJobs(email, jobs);
};

const normalizeStoredWorkspaceSegmentInfographicJob = (
  value: StoredWorkspaceSegmentInfographicJob,
): StoredWorkspaceSegmentInfographicJob => ({
  createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
  draftId: normalizeStoredWorkspaceSegmentJobDraftId(value.draftId),
  idempotencyKey: String(value.idempotencyKey ?? "").trim(),
  jobId: String(value.jobId ?? "").trim(),
  projectId: Math.max(0, Math.trunc(Number(value.projectId))),
  requestFingerprint: String(value.requestFingerprint ?? "").trim(),
  serverRequestFingerprint: String(value.serverRequestFingerprint ?? "").trim().toLowerCase(),
  segmentIndex: Math.max(0, Math.trunc(Number(value.segmentIndex))),
  sourceMediaAssetId: Math.max(0, Math.trunc(Number(value.sourceMediaAssetId))),
  sourceVisualIdentity: String(value.sourceVisualIdentity ?? "").trim(),
  status: String(value.status ?? "queued").trim() || "queued",
  stylePrompt: truncateWorkspaceSegmentInfographicText(value.stylePrompt, 300),
  text: truncateWorkspaceSegmentInfographicText(String(value.text ?? "").trim(), 160),
});

const isStoredWorkspaceSegmentInfographicJob = (value: unknown): value is StoredWorkspaceSegmentInfographicJob => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const job = normalizeStoredWorkspaceSegmentInfographicJob(value as StoredWorkspaceSegmentInfographicJob);
  return Boolean(
    job.jobId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(job.idempotencyKey) &&
      job.requestFingerprint &&
      /^[0-9a-f]{64}$/i.test(job.serverRequestFingerprint) &&
      job.text &&
      job.sourceMediaAssetId > 0 &&
      /^asset:[1-9]\d*$/.test(job.sourceVisualIdentity) &&
      Number.isInteger(job.projectId) &&
      (
        job.projectId > 0 ||
        (job.projectId === 0 && /^scratch:[A-Za-z0-9:_-]{1,192}$/.test(job.draftId ?? ""))
      ) &&
      Number.isInteger(job.segmentIndex),
  );
};

const writeStoredWorkspaceSegmentInfographicJobs = (
  email: string | null | undefined,
  jobs: StoredWorkspaceSegmentInfographicJob[],
) => {
  if (typeof window === "undefined") {
    return;
  }
  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return;
  }
  const normalizedJobs = jobs
    .filter(isStoredWorkspaceSegmentInfographicJob)
    .map(normalizeStoredWorkspaceSegmentInfographicJob)
    .filter((job) => Date.now() - job.createdAt <= WORKSPACE_SEGMENT_INFOGRAPHIC_PENDING_TTL_MS);
  const storageKey = getWorkspaceSegmentInfographicPendingStorageKey(normalizedEmail);
  if (!normalizedJobs.length) {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return;
  }
  writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedJobs));
};

export const readStoredWorkspaceSegmentInfographicJobs = (
  email: string | null | undefined,
): StoredWorkspaceSegmentInfographicJob[] => {
  if (typeof window === "undefined") {
    return [];
  }
  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return [];
  }
  const storageKey = getWorkspaceSegmentInfographicPendingStorageKey(normalizedEmail);
  const candidate = readWorkspaceSegmentEditorStorageCandidates(storageKey)[0];
  if (!candidate) {
    return [];
  }
  try {
    const parsed = JSON.parse(candidate.rawValue) as unknown;
    const rawJobs = Array.isArray(parsed) ? parsed : [];
    const jobs = rawJobs
      .filter(isStoredWorkspaceSegmentInfographicJob)
      .map(normalizeStoredWorkspaceSegmentInfographicJob)
      .filter((job) => Date.now() - job.createdAt <= WORKSPACE_SEGMENT_INFOGRAPHIC_PENDING_TTL_MS);
    if (jobs.length !== rawJobs.length || candidate.storageName === "sessionStorage") {
      writeStoredWorkspaceSegmentInfographicJobs(normalizedEmail, jobs);
    }
    return jobs;
  } catch {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return [];
  }
};

export const upsertStoredWorkspaceSegmentInfographicJob = (
  email: string | null | undefined,
  job: StoredWorkspaceSegmentInfographicJob,
) => {
  const normalizedJob = normalizeStoredWorkspaceSegmentInfographicJob(job);
  const jobs = readStoredWorkspaceSegmentInfographicJobs(email).filter(
    (item) =>
      item.jobId !== normalizedJob.jobId &&
      !isSameStoredWorkspaceSegmentJobTarget(item, normalizedJob),
  );
  writeStoredWorkspaceSegmentInfographicJobs(email, [normalizedJob, ...jobs]);
};

export const persistStoredWorkspaceSegmentInfographicJobBeforePolling = (
  email: string | null | undefined,
  job: StoredWorkspaceSegmentInfographicJob,
  canStartPolling: () => boolean,
) => {
  upsertStoredWorkspaceSegmentInfographicJob(email, job);
  return canStartPolling();
};

export const removeStoredWorkspaceSegmentInfographicJob = (
  email: string | null | undefined,
  jobId: string | null | undefined,
) => {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    return;
  }
  writeStoredWorkspaceSegmentInfographicJobs(
    email,
    readStoredWorkspaceSegmentInfographicJobs(email).filter((job) => job.jobId !== safeJobId),
  );
};

export const removeStoredWorkspaceSegmentInfographicJobsForSegment = (
  email: string | null | undefined,
  projectId: number | null | undefined,
  segmentIndex: number | null | undefined,
  draftId?: string | null,
) => {
  const target = buildStoredWorkspaceSegmentJobTarget(projectId, segmentIndex, draftId);
  if (!target) {
    return;
  }
  writeStoredWorkspaceSegmentInfographicJobs(
    email,
    readStoredWorkspaceSegmentInfographicJobs(email).filter(
      (job) => !isSameStoredWorkspaceSegmentJobTarget(job, target),
    ),
  );
};

const isStoredWorkspaceSegmentSceneSoundJob = (value: unknown): value is StoredWorkspaceSegmentSceneSoundJob => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<StoredWorkspaceSegmentSceneSoundJob>;
  return (
    typeof payload.jobId === "string" &&
    payload.jobId.trim().length > 0 &&
    Number.isInteger(Number(payload.projectId)) &&
    Number(payload.projectId) >= 0 &&
    Number.isInteger(Number(payload.segmentIndex)) &&
    Number(payload.segmentIndex) >= 0
  );
};

const normalizeStoredWorkspaceSegmentSceneSoundJob = (
  value: StoredWorkspaceSegmentSceneSoundJob,
): StoredWorkspaceSegmentSceneSoundJob => {
  const normalizedJob: StoredWorkspaceSegmentSceneSoundJob = {
    createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
    draftId: normalizeStoredWorkspaceSegmentJobDraftId(value.draftId),
    jobId: String(value.jobId ?? "").trim(),
    projectId: Math.max(0, Math.trunc(Number(value.projectId))),
    prompt: normalizeWorkspaceSegmentAiPhotoPrompt(value.prompt),
    segmentIndex: Math.trunc(Number(value.segmentIndex)),
    sourceVisualIdentity: String(value.sourceVisualIdentity ?? "").trim(),
    status: String(value.status ?? "queued").trim() || "queued",
  };
  if (Object.prototype.hasOwnProperty.call(value, "previousAssetId")) {
    normalizedJob.previousAssetId = getPositiveWorkspaceMediaAssetId(value.previousAssetId);
  }
  return normalizedJob;
};

export const hasStoredWorkspaceSegmentSceneSoundAssetChangedSinceStart = (
  job: StoredWorkspaceSegmentSceneSoundJob,
  currentAssetId: number | null | undefined,
) => {
  const normalizedCurrentAssetId = getPositiveWorkspaceMediaAssetId(currentAssetId);
  return (
    Object.prototype.hasOwnProperty.call(job, "previousAssetId") &&
    normalizedCurrentAssetId !== null &&
    normalizedCurrentAssetId !== getPositiveWorkspaceMediaAssetId(job.previousAssetId)
  );
};

export const hasStoredWorkspaceSegmentSceneSoundVisualChangedSinceStart = (
  job: StoredWorkspaceSegmentSceneSoundJob,
  currentSourceVisualIdentity: string | null | undefined,
) => {
  const expectedIdentity = String(job.sourceVisualIdentity ?? "").trim();
  const currentIdentity = String(currentSourceVisualIdentity ?? "").trim();
  return !expectedIdentity || expectedIdentity !== currentIdentity;
};

export const readStoredWorkspaceSegmentSceneSoundJobs = (
  email: string | null | undefined,
): StoredWorkspaceSegmentSceneSoundJob[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const storageKey = getWorkspaceSegmentSceneSoundPendingStorageKey(normalizedEmail);
  const candidate = readWorkspaceSegmentEditorStorageCandidates(storageKey)[0];
  if (!candidate) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(candidate.rawValue) as unknown;
    const rawJobs = Array.isArray(parsedValue) ? parsedValue : [];
    const now = Date.now();
    const jobs = rawJobs
      .filter(isStoredWorkspaceSegmentSceneSoundJob)
      .map(normalizeStoredWorkspaceSegmentSceneSoundJob)
      .filter((job) => now - job.createdAt <= WORKSPACE_SEGMENT_SCENE_SOUND_PENDING_TTL_MS);

    if (jobs.length !== rawJobs.length || candidate.storageName === "sessionStorage") {
      writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(jobs));
    }

    return jobs;
  } catch {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return [];
  }
};

const writeStoredWorkspaceSegmentSceneSoundJobs = (
  email: string | null | undefined,
  jobs: StoredWorkspaceSegmentSceneSoundJob[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return;
  }

  const storageKey = getWorkspaceSegmentSceneSoundPendingStorageKey(normalizedEmail);
  const normalizedJobs = jobs
    .filter(isStoredWorkspaceSegmentSceneSoundJob)
    .map(normalizeStoredWorkspaceSegmentSceneSoundJob)
    .filter((job) => Date.now() - job.createdAt <= WORKSPACE_SEGMENT_SCENE_SOUND_PENDING_TTL_MS);

  if (!normalizedJobs.length) {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedJobs));
};

export const upsertStoredWorkspaceSegmentSceneSoundJob = (
  email: string | null | undefined,
  job: StoredWorkspaceSegmentSceneSoundJob,
) => {
  const normalizedJob = normalizeStoredWorkspaceSegmentSceneSoundJob(job);
  const jobs = readStoredWorkspaceSegmentSceneSoundJobs(email).filter(
    (item) =>
      item.jobId !== normalizedJob.jobId &&
      !isSameStoredWorkspaceSegmentJobTarget(item, normalizedJob),
  );
  writeStoredWorkspaceSegmentSceneSoundJobs(email, [normalizedJob, ...jobs]);
};

export const removeStoredWorkspaceSegmentSceneSoundJob = (
  email: string | null | undefined,
  jobId: string | null | undefined,
) => {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentSceneSoundJobs(email).filter((job) => job.jobId !== safeJobId);
  writeStoredWorkspaceSegmentSceneSoundJobs(email, jobs);
};

export const removeStoredWorkspaceSegmentSceneSoundJobsForSegment = (
  email: string | null | undefined,
  projectId: number | null | undefined,
  segmentIndex: number | null | undefined,
  draftId?: string | null,
) => {
  const target = buildStoredWorkspaceSegmentJobTarget(projectId, segmentIndex, draftId);
  if (!target) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentSceneSoundJobs(email).filter(
    (job) => !isSameStoredWorkspaceSegmentJobTarget(job, target),
  );
  writeStoredWorkspaceSegmentSceneSoundJobs(email, jobs);
};

const isStoredWorkspaceSegmentPhotoAnimationJob = (value: unknown): value is StoredWorkspaceSegmentPhotoAnimationJob => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<StoredWorkspaceSegmentPhotoAnimationJob>;
  return (
    typeof payload.jobId === "string" &&
    payload.jobId.trim().length > 0 &&
    Number.isInteger(Number(payload.projectId)) &&
    Number(payload.projectId) >= 0 &&
    Number.isInteger(Number(payload.segmentIndex)) &&
    Number(payload.segmentIndex) >= 0
  );
};

const normalizeStoredWorkspaceSegmentPhotoAnimationJob = (
  value: StoredWorkspaceSegmentPhotoAnimationJob,
): StoredWorkspaceSegmentPhotoAnimationJob => ({
  createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
  draftId: normalizeStoredWorkspaceSegmentJobDraftId(value.draftId),
  durationExtensionSourceDurationSeconds: normalizeWorkspaceSegmentManualDurationSeconds(
    value.durationExtensionSourceDurationSeconds,
  ),
  durationExtensionTargetDurationSeconds: normalizeWorkspaceSegmentManualDurationSeconds(
    value.durationExtensionTargetDurationSeconds,
  ),
  durationSeconds: normalizeWorkspaceSegmentManualDurationSeconds(value.durationSeconds),
  jobId: String(value.jobId ?? "").trim(),
  projectId: Math.trunc(Number(value.projectId)),
  prompt: normalizeWorkspaceSegmentAiVideoPrompt(value.prompt),
  refreshSceneSoundPrompt: normalizeWorkspaceSegmentAiPhotoPrompt(value.refreshSceneSoundPrompt) || undefined,
  segmentIndex: Math.trunc(Number(value.segmentIndex)),
  sourceAsset: normalizePersistedStudioCustomVideoFile(value.sourceAsset),
  sourceVisualIdentity: String(value.sourceVisualIdentity ?? "").trim() || undefined,
  status: String(value.status ?? "queued").trim() || "queued",
});

export const readStoredWorkspaceSegmentPhotoAnimationJobs = (
  email: string | null | undefined,
): StoredWorkspaceSegmentPhotoAnimationJob[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const storageKey = getWorkspaceSegmentPhotoAnimationPendingStorageKey(normalizedEmail);
  const candidate = readWorkspaceSegmentEditorStorageCandidates(storageKey)[0];
  if (!candidate) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(candidate.rawValue) as unknown;
    const rawJobs = Array.isArray(parsedValue) ? parsedValue : [];
    const now = Date.now();
    const jobs = rawJobs
      .filter(isStoredWorkspaceSegmentPhotoAnimationJob)
      .map(normalizeStoredWorkspaceSegmentPhotoAnimationJob)
      .filter((job) => now - job.createdAt <= WORKSPACE_SEGMENT_PHOTO_ANIMATION_PENDING_TTL_MS);

    if (jobs.length !== rawJobs.length || candidate.storageName === "sessionStorage") {
      writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(jobs));
    }

    return jobs;
  } catch {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return [];
  }
};

const writeStoredWorkspaceSegmentPhotoAnimationJobs = (
  email: string | null | undefined,
  jobs: StoredWorkspaceSegmentPhotoAnimationJob[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return;
  }

  const storageKey = getWorkspaceSegmentPhotoAnimationPendingStorageKey(normalizedEmail);
  const normalizedJobs = jobs
    .filter(isStoredWorkspaceSegmentPhotoAnimationJob)
    .map(normalizeStoredWorkspaceSegmentPhotoAnimationJob)
    .filter((job) => Date.now() - job.createdAt <= WORKSPACE_SEGMENT_PHOTO_ANIMATION_PENDING_TTL_MS);

  if (!normalizedJobs.length) {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedJobs));
};

export const upsertStoredWorkspaceSegmentPhotoAnimationJob = (
  email: string | null | undefined,
  job: StoredWorkspaceSegmentPhotoAnimationJob,
) => {
  const normalizedJob = normalizeStoredWorkspaceSegmentPhotoAnimationJob(job);
  const jobs = readStoredWorkspaceSegmentPhotoAnimationJobs(email).filter(
    (item) =>
      item.jobId !== normalizedJob.jobId &&
      !isSameStoredWorkspaceSegmentJobTarget(item, normalizedJob),
  );
  writeStoredWorkspaceSegmentPhotoAnimationJobs(email, [normalizedJob, ...jobs]);
};

export const removeStoredWorkspaceSegmentPhotoAnimationJob = (
  email: string | null | undefined,
  jobId: string | null | undefined,
) => {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentPhotoAnimationJobs(email).filter((job) => job.jobId !== safeJobId);
  writeStoredWorkspaceSegmentPhotoAnimationJobs(email, jobs);
};

export const removeStoredWorkspaceSegmentPhotoAnimationJobsForSegment = (
  email: string | null | undefined,
  projectId: number | null | undefined,
  segmentIndex: number | null | undefined,
  draftId?: string | null,
) => {
  const target = buildStoredWorkspaceSegmentJobTarget(projectId, segmentIndex, draftId);
  if (!target) {
    return;
  }

  writeStoredWorkspaceSegmentPhotoAnimationJobs(
    email,
    readStoredWorkspaceSegmentPhotoAnimationJobs(email).filter(
      (job) => !isSameStoredWorkspaceSegmentJobTarget(job, target),
    ),
  );
};

const isStoredWorkspaceSegmentTalkingPhotoJob = (value: unknown): value is StoredWorkspaceSegmentTalkingPhotoJob => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<StoredWorkspaceSegmentTalkingPhotoJob>;
  return (
    typeof payload.jobId === "string" &&
    payload.jobId.trim().length > 0 &&
    Number.isInteger(Number(payload.projectId)) &&
    Number(payload.projectId) >= 0 &&
    Number.isInteger(Number(payload.segmentIndex)) &&
    Number(payload.segmentIndex) >= 0
  );
};

const normalizeStoredWorkspaceSegmentTalkingPhotoJob = (
  value: StoredWorkspaceSegmentTalkingPhotoJob,
): StoredWorkspaceSegmentTalkingPhotoJob => ({
  createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
  draftId: normalizeStoredWorkspaceSegmentJobDraftId(value.draftId),
  jobId: String(value.jobId ?? "").trim(),
  language: value.language === "en" ? "en" : value.language === "ru" ? "ru" : undefined,
  projectId: Math.max(0, Math.trunc(Number(value.projectId))),
  script: normalizeWorkspaceSegmentAiPhotoPrompt(value.script),
  segmentIndex: Math.trunc(Number(value.segmentIndex)),
  sourceAsset: normalizePersistedStudioCustomVideoFile(value.sourceAsset),
  sourceVisualIdentity: String(value.sourceVisualIdentity ?? "").trim() || undefined,
  status: String(value.status ?? "queued").trim() || "queued",
  voiceType: String(value.voiceType ?? "").trim() || undefined,
});

export const readStoredWorkspaceSegmentTalkingPhotoJobs = (
  email: string | null | undefined,
): StoredWorkspaceSegmentTalkingPhotoJob[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const storageKey = getWorkspaceSegmentTalkingPhotoPendingStorageKey(normalizedEmail);
  const candidate = readWorkspaceSegmentEditorStorageCandidates(storageKey)[0];
  if (!candidate) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(candidate.rawValue) as unknown;
    const rawJobs = Array.isArray(parsedValue) ? parsedValue : [];
    const now = Date.now();
    const jobs = rawJobs
      .filter(isStoredWorkspaceSegmentTalkingPhotoJob)
      .map(normalizeStoredWorkspaceSegmentTalkingPhotoJob)
      .filter((job) => now - job.createdAt <= WORKSPACE_SEGMENT_TALKING_PHOTO_PENDING_TTL_MS);

    if (jobs.length !== rawJobs.length || candidate.storageName === "sessionStorage") {
      writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(jobs));
    }

    return jobs;
  } catch {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return [];
  }
};

const writeStoredWorkspaceSegmentTalkingPhotoJobs = (
  email: string | null | undefined,
  jobs: StoredWorkspaceSegmentTalkingPhotoJob[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return;
  }

  const storageKey = getWorkspaceSegmentTalkingPhotoPendingStorageKey(normalizedEmail);
  const normalizedJobs = jobs
    .filter(isStoredWorkspaceSegmentTalkingPhotoJob)
    .map(normalizeStoredWorkspaceSegmentTalkingPhotoJob)
    .filter((job) => Date.now() - job.createdAt <= WORKSPACE_SEGMENT_TALKING_PHOTO_PENDING_TTL_MS);

  if (!normalizedJobs.length) {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedJobs));
};

export const upsertStoredWorkspaceSegmentTalkingPhotoJob = (
  email: string | null | undefined,
  job: StoredWorkspaceSegmentTalkingPhotoJob,
) => {
  const normalizedJob = normalizeStoredWorkspaceSegmentTalkingPhotoJob(job);
  const jobs = readStoredWorkspaceSegmentTalkingPhotoJobs(email).filter(
    (item) =>
      item.jobId !== normalizedJob.jobId &&
      !isSameStoredWorkspaceSegmentJobTarget(item, normalizedJob),
  );
  writeStoredWorkspaceSegmentTalkingPhotoJobs(email, [normalizedJob, ...jobs]);
};

export const removeStoredWorkspaceSegmentTalkingPhotoJob = (
  email: string | null | undefined,
  jobId: string | null | undefined,
) => {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentTalkingPhotoJobs(email).filter((job) => job.jobId !== safeJobId);
  writeStoredWorkspaceSegmentTalkingPhotoJobs(email, jobs);
};

export const removeStoredWorkspaceSegmentTalkingPhotoJobsForSegment = (
  email: string | null | undefined,
  projectId: number | null | undefined,
  segmentIndex: number | null | undefined,
  draftId?: string | null,
) => {
  const target = buildStoredWorkspaceSegmentJobTarget(projectId, segmentIndex, draftId);
  if (!target) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentTalkingPhotoJobs(email).filter(
    (job) => !isSameStoredWorkspaceSegmentJobTarget(job, target),
  );
  writeStoredWorkspaceSegmentTalkingPhotoJobs(email, jobs);
};

const normalizeStoredWorkspaceSegmentBatchVoiceoverSource = (
  value: unknown,
): StoredWorkspaceSegmentBatchVoiceoverJob["source"] =>
  value === "create-shorts" ? "create-shorts" : "global-voiceover";

const normalizeStoredWorkspaceSegmentBatchVoiceoverLanguage = (value: unknown): StudioLanguage =>
  value === "en" ? "en" : "ru";

const isStoredWorkspaceSegmentVoiceoverJob = (
  value: unknown,
): value is StoredWorkspaceSegmentVoiceoverJob => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<StoredWorkspaceSegmentVoiceoverJob>;
  return (
    typeof payload.jobId === "string" &&
    payload.jobId.trim().length > 0 &&
    Number.isInteger(Number(payload.projectId)) &&
    Number(payload.projectId) >= 0 &&
    Number.isInteger(Number(payload.segmentIndex)) &&
    Number(payload.segmentIndex) >= 0 &&
    String(payload.text ?? "").trim().length > 0 &&
    String(payload.voiceType ?? "").trim().length > 0 &&
    String(payload.voiceType ?? "").trim() !== "none"
  );
};

const normalizeStoredWorkspaceSegmentVoiceoverJob = (
  value: StoredWorkspaceSegmentVoiceoverJob,
): StoredWorkspaceSegmentVoiceoverJob => ({
  createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
  draftId: normalizeStoredWorkspaceSegmentJobDraftId(value.draftId),
  jobId: String(value.jobId ?? "").trim(),
  language: normalizeStoredWorkspaceSegmentBatchVoiceoverLanguage(value.language),
  projectId: Math.max(0, Math.trunc(Number(value.projectId))),
  segmentIndex: Math.max(0, Math.trunc(Number(value.segmentIndex))),
  status: String(value.status ?? "queued").trim() || "queued",
  text: String(value.text ?? "").replace(/\s+/g, " ").trim(),
  voiceType: String(value.voiceType ?? "").trim(),
});

export const readStoredWorkspaceSegmentVoiceoverJobs = (
  email: string | null | undefined,
): StoredWorkspaceSegmentVoiceoverJob[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const storageKey = getWorkspaceSegmentVoiceoverPendingStorageKey(normalizedEmail);
  const candidate = readWorkspaceSegmentEditorStorageCandidates(storageKey)[0];
  if (!candidate) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(candidate.rawValue) as unknown;
    const rawJobs = Array.isArray(parsedValue) ? parsedValue : [];
    const now = Date.now();
    const jobs = rawJobs
      .filter(isStoredWorkspaceSegmentVoiceoverJob)
      .map(normalizeStoredWorkspaceSegmentVoiceoverJob)
      .filter((job) => now - job.createdAt <= WORKSPACE_SEGMENT_VOICEOVER_PENDING_TTL_MS);
    if (jobs.length !== rawJobs.length || candidate.storageName === "sessionStorage") {
      writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(jobs));
    }
    return jobs;
  } catch {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return [];
  }
};

const writeStoredWorkspaceSegmentVoiceoverJobs = (
  email: string | null | undefined,
  jobs: StoredWorkspaceSegmentVoiceoverJob[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return;
  }

  const storageKey = getWorkspaceSegmentVoiceoverPendingStorageKey(normalizedEmail);
  const normalizedJobs = jobs
    .filter(isStoredWorkspaceSegmentVoiceoverJob)
    .map(normalizeStoredWorkspaceSegmentVoiceoverJob)
    .filter((job) => Date.now() - job.createdAt <= WORKSPACE_SEGMENT_VOICEOVER_PENDING_TTL_MS);
  if (!normalizedJobs.length) {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return;
  }
  writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedJobs));
};

export const upsertStoredWorkspaceSegmentVoiceoverJob = (
  email: string | null | undefined,
  job: StoredWorkspaceSegmentVoiceoverJob,
) => {
  const normalizedJob = normalizeStoredWorkspaceSegmentVoiceoverJob(job);
  const jobs = readStoredWorkspaceSegmentVoiceoverJobs(email).filter(
    (item) =>
      item.jobId !== normalizedJob.jobId &&
      !isSameStoredWorkspaceSegmentJobTarget(item, normalizedJob),
  );
  writeStoredWorkspaceSegmentVoiceoverJobs(email, [normalizedJob, ...jobs]);
};

export const removeStoredWorkspaceSegmentVoiceoverJob = (
  email: string | null | undefined,
  jobId: string | null | undefined,
) => {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    return;
  }
  writeStoredWorkspaceSegmentVoiceoverJobs(
    email,
    readStoredWorkspaceSegmentVoiceoverJobs(email).filter((job) => job.jobId !== safeJobId),
  );
};

export const removeStoredWorkspaceSegmentVoiceoverJobsForSegment = (
  email: string | null | undefined,
  projectId: number | null | undefined,
  segmentIndex: number | null | undefined,
  draftId?: string | null,
) => {
  const target = buildStoredWorkspaceSegmentJobTarget(projectId, segmentIndex, draftId);
  if (!target) {
    return;
  }
  writeStoredWorkspaceSegmentVoiceoverJobs(
    email,
    readStoredWorkspaceSegmentVoiceoverJobs(email).filter(
      (job) => !isSameStoredWorkspaceSegmentJobTarget(job, target),
    ),
  );
};

const normalizeStoredWorkspaceSegmentBatchVoiceoverSegment = (
  value: unknown,
): StoredWorkspaceSegmentBatchVoiceoverSegment | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Partial<StoredWorkspaceSegmentBatchVoiceoverSegment>;
  const segmentIndex = Number(payload.segmentIndex);
  const text = String(payload.text ?? "").replace(/\s+/g, " ").trim();
  const voiceType = String(payload.voiceType ?? "").trim();
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || !text || !voiceType || voiceType === "none") {
    return null;
  }

  return {
    language: normalizeStoredWorkspaceSegmentBatchVoiceoverLanguage(payload.language),
    segmentIndex: Math.trunc(segmentIndex),
    text,
    voiceType,
  };
};

const isStoredWorkspaceSegmentBatchVoiceoverJob = (
  value: unknown,
): value is StoredWorkspaceSegmentBatchVoiceoverJob => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<StoredWorkspaceSegmentBatchVoiceoverJob>;
  return (
    typeof payload.jobId === "string" &&
    payload.jobId.trim().length > 0 &&
    Number.isInteger(Number(payload.projectId)) &&
    Number(payload.projectId) >= 0 &&
    Array.isArray(payload.segments) &&
    payload.segments.some((segment) => normalizeStoredWorkspaceSegmentBatchVoiceoverSegment(segment))
  );
};

const normalizeStoredWorkspaceSegmentBatchVoiceoverJob = (
  value: StoredWorkspaceSegmentBatchVoiceoverJob,
): StoredWorkspaceSegmentBatchVoiceoverJob => ({
  createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
  draftId: normalizeStoredWorkspaceSegmentJobDraftId(value.draftId),
  jobId: String(value.jobId ?? "").trim(),
  projectId: Math.max(0, Math.trunc(Number(value.projectId))),
  segments: (value.segments ?? [])
    .map(normalizeStoredWorkspaceSegmentBatchVoiceoverSegment)
    .filter((segment): segment is StoredWorkspaceSegmentBatchVoiceoverSegment => Boolean(segment)),
  source: normalizeStoredWorkspaceSegmentBatchVoiceoverSource(value.source),
  status: String(value.status ?? "queued").trim() || "queued",
});

export const readStoredWorkspaceSegmentBatchVoiceoverJobs = (
  email: string | null | undefined,
): StoredWorkspaceSegmentBatchVoiceoverJob[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const storageKey = getWorkspaceSegmentBatchVoiceoverPendingStorageKey(normalizedEmail);
  const candidate = readWorkspaceSegmentEditorStorageCandidates(storageKey)[0];
  if (!candidate) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(candidate.rawValue) as unknown;
    const rawJobs = Array.isArray(parsedValue) ? parsedValue : [];
    const now = Date.now();
    const jobs = rawJobs
      .filter(isStoredWorkspaceSegmentBatchVoiceoverJob)
      .map(normalizeStoredWorkspaceSegmentBatchVoiceoverJob)
      .filter((job) => job.segments.length > 0)
      .filter((job) => now - job.createdAt <= WORKSPACE_SEGMENT_BATCH_VOICEOVER_PENDING_TTL_MS);

    if (jobs.length !== rawJobs.length || candidate.storageName === "sessionStorage") {
      writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(jobs));
    }

    return jobs;
  } catch {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return [];
  }
};

const writeStoredWorkspaceSegmentBatchVoiceoverJobs = (
  email: string | null | undefined,
  jobs: StoredWorkspaceSegmentBatchVoiceoverJob[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return;
  }

  const storageKey = getWorkspaceSegmentBatchVoiceoverPendingStorageKey(normalizedEmail);
  const normalizedJobs = jobs
    .filter(isStoredWorkspaceSegmentBatchVoiceoverJob)
    .map(normalizeStoredWorkspaceSegmentBatchVoiceoverJob)
    .filter((job) => job.segments.length > 0)
    .filter((job) => Date.now() - job.createdAt <= WORKSPACE_SEGMENT_BATCH_VOICEOVER_PENDING_TTL_MS);

  if (!normalizedJobs.length) {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedJobs));
};

export const upsertStoredWorkspaceSegmentBatchVoiceoverJob = (
  email: string | null | undefined,
  job: StoredWorkspaceSegmentBatchVoiceoverJob,
) => {
  const normalizedJob = normalizeStoredWorkspaceSegmentBatchVoiceoverJob(job);
  const jobs = readStoredWorkspaceSegmentBatchVoiceoverJobs(email).filter(
    (item) =>
      item.jobId !== normalizedJob.jobId &&
      !(item.source === normalizedJob.source && isSameStoredWorkspaceSegmentJobDraft(item, normalizedJob)),
  );
  writeStoredWorkspaceSegmentBatchVoiceoverJobs(email, [normalizedJob, ...jobs]);
};

export const removeStoredWorkspaceSegmentBatchVoiceoverJob = (
  email: string | null | undefined,
  jobId: string | null | undefined,
) => {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentBatchVoiceoverJobs(email).filter((job) => job.jobId !== safeJobId);
  writeStoredWorkspaceSegmentBatchVoiceoverJobs(email, jobs);
};

export const readStoredWorkspaceSegmentEditorDraft = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return null;
  }

  const storageKey = getWorkspaceSegmentEditorDraftStorageKey(normalizedEmail, normalizedProjectId);
  for (const candidate of readWorkspaceSegmentEditorStorageCandidates(storageKey)) {
    try {
      const parsedValue = JSON.parse(candidate.rawValue) as unknown;
      if (!isStoredWorkspaceSegmentEditorDraftSession(parsedValue)) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      const normalizedDraft = normalizeStoredWorkspaceSegmentEditorDraftSession(parsedValue);
      if (normalizedDraft.projectId !== normalizedProjectId || !canRestoreStoredWorkspaceSegmentEditorDraftSession(normalizedDraft)) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      if (candidate.storageName === "sessionStorage") {
        writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify({
          ...normalizedDraft,
          storageVersion: WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_VERSION,
        }));
      }

      return normalizedDraft;
    } catch {
      removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
    }
  }

  return null;
};

export const readStoredWorkspaceSegmentEditorDrafts = (
  email: string | null | undefined,
): WorkspaceSegmentEditorDraftSession[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const storageKeyPrefix = `${WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_KEY_PREFIX}${normalizedEmail}:`;
  const draftsByProjectId = new Map<number, WorkspaceSegmentEditorDraftSession>();

  readWorkspaceSegmentEditorStorageEntries(storageKeyPrefix).forEach((entry) => {
    try {
      const parsedValue = JSON.parse(entry.rawValue) as unknown;
      if (!isStoredWorkspaceSegmentEditorDraftSession(parsedValue)) {
        removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
        return;
      }

      const normalizedDraft = normalizeStoredWorkspaceSegmentEditorDraftSession(parsedValue);
      const normalizedProjectId = Number(normalizedDraft.projectId);
      if (
        !Number.isInteger(normalizedProjectId) ||
        normalizedProjectId <= 0 ||
        !entry.storageKey.endsWith(`:${normalizedProjectId}`) ||
        !canRestoreStoredWorkspaceSegmentEditorDraftSession(normalizedDraft)
      ) {
        removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
        return;
      }

      if (draftsByProjectId.has(normalizedProjectId)) {
        return;
      }

      if (entry.storageName === "sessionStorage") {
        writeWorkspaceSegmentEditorStorageValue(entry.storageKey, JSON.stringify({
          ...normalizedDraft,
          storageVersion: WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_VERSION,
        }));
      }

      draftsByProjectId.set(normalizedProjectId, normalizedDraft);
    } catch {
      removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
    }
  });

  return Array.from(draftsByProjectId.values());
};

export const writeStoredWorkspaceSegmentEditorDraft = (
  email: string | null | undefined,
  session: WorkspaceSegmentEditorDraftSession | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(session?.projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0 || !session) {
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(
    getWorkspaceSegmentEditorDraftStorageKey(normalizedEmail, normalizedProjectId),
    JSON.stringify({
      ...normalizeStoredWorkspaceSegmentEditorDraftSession(session),
      storageVersion: WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_VERSION,
    }),
  );
};

export const removeStoredWorkspaceSegmentEditorDraft = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return;
  }

  removeWorkspaceSegmentEditorStorageValue(getWorkspaceSegmentEditorDraftStorageKey(normalizedEmail, normalizedProjectId));
};

export const readStoredWorkspaceSegmentEditorScratchDraft = (
  email: string | null | undefined,
) => {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const storageKey = getWorkspaceSegmentEditorScratchDraftStorageKey(normalizedEmail);

  for (const candidate of readWorkspaceSegmentEditorStorageCandidates(storageKey)) {
    try {
      const parsedValue = JSON.parse(candidate.rawValue) as unknown;
      if (!isStoredWorkspaceSegmentEditorDraftSession(parsedValue)) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      const normalizedDraft = normalizeStoredWorkspaceSegmentEditorDraftSession(parsedValue);
      if (!canRestoreStoredWorkspaceSegmentEditorDraftSession(normalizedDraft)) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      if (
        candidate.storageName === "sessionStorage" ||
        String((parsedValue as Partial<WorkspaceSegmentEditorDraftSession>).draftId ?? "").trim() !== normalizedDraft.draftId
      ) {
        writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify({
          ...normalizedDraft,
          storageVersion: WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_VERSION,
        }));
      }

      return normalizedDraft;
    } catch {
      removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
    }
  }

  return null;
};

export const writeStoredWorkspaceSegmentEditorScratchDraft = (
  email: string | null | undefined,
  session: WorkspaceSegmentEditorDraftSession | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail || !session) {
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(
    getWorkspaceSegmentEditorScratchDraftStorageKey(normalizedEmail),
    JSON.stringify({
      ...normalizeStoredWorkspaceSegmentEditorDraftSession(session),
      storageVersion: WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_VERSION,
    }),
  );
};

export const readStoredWorkspaceSegmentEditorScratchBaseline = (
  email: string | null | undefined,
) => {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const storageKey = getWorkspaceSegmentEditorScratchBaselineStorageKey(normalizedEmail);

  for (const candidate of readWorkspaceSegmentEditorStorageCandidates(storageKey)) {
    try {
      const parsedValue = JSON.parse(candidate.rawValue) as unknown;
      if (!isStoredWorkspaceSegmentEditorDraftSession(parsedValue)) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      const normalizedDraft = normalizeStoredWorkspaceSegmentEditorDraftSession(parsedValue);
      if (
        candidate.storageName === "sessionStorage" ||
        String((parsedValue as Partial<WorkspaceSegmentEditorDraftSession>).draftId ?? "").trim() !== normalizedDraft.draftId
      ) {
        writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify({
          ...normalizedDraft,
          storageVersion: WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_VERSION,
        }));
      }

      return normalizedDraft;
    } catch {
      removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
    }
  }

  return null;
};

export const writeStoredWorkspaceSegmentEditorScratchBaseline = (
  email: string | null | undefined,
  session: WorkspaceSegmentEditorDraftSession | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail || !session) {
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(
    getWorkspaceSegmentEditorScratchBaselineStorageKey(normalizedEmail),
    JSON.stringify({
      ...normalizeStoredWorkspaceSegmentEditorDraftSession(session),
      storageVersion: WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_VERSION,
    }),
  );
};

export const removeStoredWorkspaceSegmentEditorScratchBaseline = (
  email: string | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return;
  }

  removeWorkspaceSegmentEditorStorageValue(getWorkspaceSegmentEditorScratchBaselineStorageKey(normalizedEmail));
};

export const removeStoredWorkspaceSegmentEditorScratchDraft = (
  email: string | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return;
  }

  removeWorkspaceSegmentEditorStorageValue(getWorkspaceSegmentEditorScratchDraftStorageKey(normalizedEmail));
};

export const readStoredWorkspaceSegmentEditorExplicitStructureChange = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return false;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return false;
  }

  const storageKey = getWorkspaceSegmentEditorExplicitStructureStorageKey(normalizedEmail, normalizedProjectId);
  return readWorkspaceSegmentEditorStorageCandidates(storageKey).some((candidate) => candidate.rawValue === "1");
};

export const writeStoredWorkspaceSegmentEditorExplicitStructureChange = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(
    getWorkspaceSegmentEditorExplicitStructureStorageKey(normalizedEmail, normalizedProjectId),
    "1",
  );
};

export const removeStoredWorkspaceSegmentEditorExplicitStructureChange = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return;
  }

  removeWorkspaceSegmentEditorStorageValue(
    getWorkspaceSegmentEditorExplicitStructureStorageKey(normalizedEmail, normalizedProjectId),
  );
};

export const readStoredWorkspaceSegmentEditorExplicitReset = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return false;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return false;
  }

  const storageKey = getWorkspaceSegmentEditorExplicitResetStorageKey(normalizedEmail, normalizedProjectId);
  return readWorkspaceSegmentEditorStorageCandidates(storageKey).some((candidate) => candidate.rawValue === "1");
};

export const writeStoredWorkspaceSegmentEditorExplicitReset = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(
    getWorkspaceSegmentEditorExplicitResetStorageKey(normalizedEmail, normalizedProjectId),
    "1",
  );
};

export const removeStoredWorkspaceSegmentEditorExplicitReset = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return;
  }

  removeWorkspaceSegmentEditorStorageValue(
    getWorkspaceSegmentEditorExplicitResetStorageKey(normalizedEmail, normalizedProjectId),
  );
};

export const readStoredWorkspaceSegmentEditorConsumedSourceProject = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return false;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return false;
  }

  const storageKey = getWorkspaceSegmentEditorConsumedSourceStorageKey(normalizedEmail, normalizedProjectId);
  return readWorkspaceSegmentEditorStorageCandidates(storageKey).some((candidate) => candidate.rawValue === "1");
};

export const writeStoredWorkspaceSegmentEditorConsumedSourceProject = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(
    getWorkspaceSegmentEditorConsumedSourceStorageKey(normalizedEmail, normalizedProjectId),
    "1",
  );
};

export const removeStoredWorkspaceSegmentEditorConsumedSourceProject = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return;
  }

  removeWorkspaceSegmentEditorStorageValue(
    getWorkspaceSegmentEditorConsumedSourceStorageKey(normalizedEmail, normalizedProjectId),
  );
};

export const clearStoredWorkspaceSegmentEditorTemporaryStateExcept = (
  email: string | null | undefined,
  keepProjectIds: readonly (number | null | undefined)[] = [],
) => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const keptProjectIds = new Set(
    keepProjectIds
      .map(getPositiveWorkspaceMediaAssetId)
      .filter((projectId): projectId is number => projectId !== null),
  );
  const clearedProjectIds = new Set<number>();
  const clearStoragePrefix = (storageKeyPrefix: string) => {
    readWorkspaceSegmentEditorStorageEntries(storageKeyPrefix).forEach((entry) => {
      const projectId = getPositiveWorkspaceMediaAssetId(entry.storageKey.slice(storageKeyPrefix.length));
      if (!projectId) {
        removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
        return;
      }

      if (keptProjectIds.has(projectId)) {
        return;
      }

      removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
      clearedProjectIds.add(projectId);
    });
  };

  clearStoragePrefix(`${WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_KEY_PREFIX}${normalizedEmail}:`);
  clearStoragePrefix(`${WORKSPACE_SEGMENT_EDITOR_EXPLICIT_STRUCTURE_STORAGE_KEY_PREFIX}${normalizedEmail}:`);
  clearStoragePrefix(`${WORKSPACE_SEGMENT_EDITOR_EXPLICIT_RESET_STORAGE_KEY_PREFIX}${normalizedEmail}:`);

  const nextAiPhotoJobs = readStoredWorkspaceSegmentAiPhotoJobs(normalizedEmail).filter((job) => {
    const shouldKeep = keptProjectIds.has(job.projectId);
    if (!shouldKeep) {
      clearedProjectIds.add(job.projectId);
    }
    return shouldKeep;
  });
  writeStoredWorkspaceSegmentAiPhotoJobs(normalizedEmail, nextAiPhotoJobs);

  const nextAiVideoJobs = readStoredWorkspaceSegmentAiVideoJobs(normalizedEmail).filter((job) => {
    const shouldKeep = keptProjectIds.has(job.projectId);
    if (!shouldKeep) {
      clearedProjectIds.add(job.projectId);
    }
    return shouldKeep;
  });
  writeStoredWorkspaceSegmentAiVideoJobs(normalizedEmail, nextAiVideoJobs);

  const nextPhotoAnimationJobs = readStoredWorkspaceSegmentPhotoAnimationJobs(normalizedEmail).filter((job) => {
    const shouldKeep = keptProjectIds.has(job.projectId);
    if (!shouldKeep) {
      clearedProjectIds.add(job.projectId);
    }
    return shouldKeep;
  });
  writeStoredWorkspaceSegmentPhotoAnimationJobs(normalizedEmail, nextPhotoAnimationJobs);

  const nextImageEditJobs = readStoredWorkspaceSegmentImageEditJobs(normalizedEmail).filter((job) => {
    const shouldKeep = keptProjectIds.has(job.projectId);
    if (!shouldKeep) {
      clearedProjectIds.add(job.projectId);
    }
    return shouldKeep;
  });
  writeStoredWorkspaceSegmentImageEditJobs(normalizedEmail, nextImageEditJobs);

  const nextImageUpscaleJobs = readStoredWorkspaceSegmentImageUpscaleJobs(normalizedEmail).filter((job) => {
    const shouldKeep = keptProjectIds.has(job.projectId);
    if (!shouldKeep) {
      clearedProjectIds.add(job.projectId);
    }
    return shouldKeep;
  });
  writeStoredWorkspaceSegmentImageUpscaleJobs(normalizedEmail, nextImageUpscaleJobs);

  const nextInfographicJobs = readStoredWorkspaceSegmentInfographicJobs(normalizedEmail).filter((job) => {
    const shouldKeep = keptProjectIds.has(job.projectId);
    if (!shouldKeep) {
      clearedProjectIds.add(job.projectId);
    }
    return shouldKeep;
  });
  writeStoredWorkspaceSegmentInfographicJobs(normalizedEmail, nextInfographicJobs);

  const nextSceneSoundJobs = readStoredWorkspaceSegmentSceneSoundJobs(normalizedEmail).filter((job) => {
    const shouldKeep = keptProjectIds.has(job.projectId);
    if (!shouldKeep) {
      clearedProjectIds.add(job.projectId);
    }
    return shouldKeep;
  });
  writeStoredWorkspaceSegmentSceneSoundJobs(normalizedEmail, nextSceneSoundJobs);

  const nextTalkingPhotoJobs = readStoredWorkspaceSegmentTalkingPhotoJobs(normalizedEmail).filter((job) => {
    const shouldKeep = keptProjectIds.has(job.projectId);
    if (!shouldKeep) {
      clearedProjectIds.add(job.projectId);
    }
    return shouldKeep;
  });
  writeStoredWorkspaceSegmentTalkingPhotoJobs(normalizedEmail, nextTalkingPhotoJobs);

  const nextVoiceoverJobs = readStoredWorkspaceSegmentVoiceoverJobs(normalizedEmail).filter((job) => {
    const shouldKeep = keptProjectIds.has(job.projectId);
    if (!shouldKeep) {
      clearedProjectIds.add(job.projectId);
    }
    return shouldKeep;
  });
  writeStoredWorkspaceSegmentVoiceoverJobs(normalizedEmail, nextVoiceoverJobs);

  const nextBatchVoiceoverJobs = readStoredWorkspaceSegmentBatchVoiceoverJobs(normalizedEmail).filter((job) => {
    const shouldKeep = keptProjectIds.has(job.projectId);
    if (!shouldKeep) {
      clearedProjectIds.add(job.projectId);
    }
    return shouldKeep;
  });
  writeStoredWorkspaceSegmentBatchVoiceoverJobs(normalizedEmail, nextBatchVoiceoverJobs);

  return Array.from(clearedProjectIds).sort((left, right) => left - right);
};
