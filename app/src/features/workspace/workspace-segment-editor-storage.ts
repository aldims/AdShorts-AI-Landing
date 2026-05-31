import {
  cloneWorkspaceSegmentEditorDraftSegment,
  cloneWorkspaceSegmentEditorDraftSession,
  getPositiveWorkspaceMediaAssetId,
  getStudioCustomAssetPreviewUrl,
  getWorkspaceMediaAssetDurablePreviewUrl,
  getWorkspaceSegmentCustomPreviewKind,
  getWorkspaceSegmentDraftVisualAsset,
  getWorkspaceSegmentEditorSessionLanguage,
  getWorkspaceSegmentSelectedVisualPreviewKind,
  getWorkspaceSegmentStillPreviewUrls,
  normalizeWorkspaceSegmentAiPhotoPrompt,
  normalizeWorkspaceSegmentAiPhotoPrompt as normalizeWorkspaceSegmentAiVideoPrompt,
  normalizeWorkspaceSegmentEditorSession,
  preserveWorkspaceSegmentEditorOriginalVisualReferences,
  rebuildWorkspaceSegmentEditorDraftSessionTimeline,
} from "./workspace-segment-editor";
import { normalizeWorkspaceVideoSourceUrl } from "./workspace-utils";
import type {
  StudioCustomVideoFile,
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentEditorDraftSession,
  WorkspaceSegmentEditorSession,
} from "./workspace-types";
import { sanitizeWorkspaceSegmentEditorCustomMusicState } from "../../lib/workspaceSegmentEditorMusic";
import {
  normalizeWorkspaceSegmentManualDurationSeconds,
  roundWorkspaceSegmentTimelineSeconds,
} from "../../lib/workspaceSegmentEditorTimeline";

export type StoredWorkspaceSegmentPhotoAnimationJob = {
  createdAt: number;
  durationExtensionSourceDurationSeconds?: number | null;
  durationExtensionTargetDurationSeconds?: number | null;
  jobId: string;
  projectId: number;
  prompt: string;
  segmentIndex: number;
  sourceAsset: StudioCustomVideoFile | null;
  status: string;
};

export type StoredWorkspaceSegmentTalkingPhotoJob = {
  createdAt: number;
  jobId: string;
  projectId: number;
  script: string;
  segmentIndex: number;
  sourceAsset: StudioCustomVideoFile | null;
  status: string;
};

export type StoredWorkspaceSegmentAiPhotoJob = {
  createdAt: number;
  jobId: string;
  projectId: number;
  prompt: string;
  segmentIndex: number;
  status: string;
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

  WORKSPACE_SEGMENT_EDITOR_STORAGE_NAMES.forEach((storageName) => {
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
    } else {
      sessionStorage.setItem(storageKey, rawValue);
    }
  } catch {
    // Ignore storage write errors.
  }
};

const isStoredWorkspaceSegmentEditorSession = (value: unknown): value is WorkspaceSegmentEditorSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<WorkspaceSegmentEditorSession>;
  return Number.isFinite(Number(payload.projectId)) && Array.isArray(payload.segments);
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
      if (normalizedSession.projectId !== normalizedProjectId) {
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
const WORKSPACE_SEGMENT_EDITOR_EXPLICIT_STRUCTURE_STORAGE_KEY_PREFIX = "adshorts.segment-editor-explicit-structure:";
const WORKSPACE_SEGMENT_EDITOR_BRAND_STORAGE_KEY_PREFIX = "adshorts.segment-editor-brand:";
const WORKSPACE_SEGMENT_EDITOR_PERSISTED_DATA_URL_MAX_CHARS = 512_000;
export const WORKSPACE_SEGMENT_TALKING_PHOTO_DURATION_OVERFLOW_TOLERANCE_SECONDS = 0.1;
const WORKSPACE_SEGMENT_AI_PHOTO_PENDING_STORAGE_KEY_PREFIX = "adshorts.segment-ai-photo-pending:";
const WORKSPACE_SEGMENT_AI_PHOTO_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const WORKSPACE_SEGMENT_PHOTO_ANIMATION_PENDING_STORAGE_KEY_PREFIX = "adshorts.segment-photo-animation-pending:";
const WORKSPACE_SEGMENT_PHOTO_ANIMATION_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const WORKSPACE_SEGMENT_TALKING_PHOTO_PENDING_STORAGE_KEY_PREFIX = "adshorts.segment-talking-photo-pending:";
const WORKSPACE_SEGMENT_TALKING_PHOTO_PENDING_TTL_MS = 24 * 60 * 60 * 1000;

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

const getWorkspaceSegmentEditorExplicitStructureStorageKey = (email: string, projectId: number) =>
  `${WORKSPACE_SEGMENT_EDITOR_EXPLICIT_STRUCTURE_STORAGE_KEY_PREFIX}${email}:${projectId}`;

export const getWorkspaceSegmentEditorBrandStorageKey = (email: string, projectId: number) =>
  `${WORKSPACE_SEGMENT_EDITOR_BRAND_STORAGE_KEY_PREFIX}${email}:${projectId}`;

const getWorkspaceSegmentAiPhotoPendingStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_AI_PHOTO_PENDING_STORAGE_KEY_PREFIX}${email}`;

const getWorkspaceSegmentPhotoAnimationPendingStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_PHOTO_ANIMATION_PENDING_STORAGE_KEY_PREFIX}${email}`;

const getWorkspaceSegmentTalkingPhotoPendingStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_TALKING_PHOTO_PENDING_STORAGE_KEY_PREFIX}${email}`;

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
  const posterUrl = typeof value.posterUrl === "string" ? value.posterUrl.trim() : "";
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

  const payload = value as Partial<WorkspaceSegmentEditorDraftSession>;
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

export const normalizeStoredWorkspaceSegmentEditorDraftSession = (
  session: WorkspaceSegmentEditorDraftSession,
): WorkspaceSegmentEditorDraftSession => {
  const fallbackLanguage = getWorkspaceSegmentEditorSessionLanguage(session);
  const clonedSession = sanitizeWorkspaceSegmentEditorCustomMusicState(
    cloneWorkspaceSegmentEditorDraftSession(session),
  );
  return rebuildWorkspaceSegmentEditorDraftSessionTimeline({
    ...clonedSession,
    segments: clonedSession.segments.map((segment) => ({
      ...cloneWorkspaceSegmentEditorDraftSegment(segment, fallbackLanguage),
      aiPhotoAsset: normalizePersistedStudioCustomVideoFile(segment.aiPhotoAsset),
      aiVideoAsset: normalizePersistedStudioCustomVideoFile(segment.aiVideoAsset),
      customVideo: normalizePersistedStudioCustomVideoFile(segment.customVideo),
      imageEditAsset: normalizePersistedStudioCustomVideoFile(segment.imageEditAsset),
      photoAnimationSourceAsset: normalizePersistedStudioCustomVideoFile(segment.photoAnimationSourceAsset),
      sceneSoundAsset: normalizePersistedStudioCustomVideoFile(segment.sceneSoundAsset),
      voiceoverAsset: normalizePersistedStudioCustomVideoFile(segment.voiceoverAsset),
    })),
  });
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
    Number(payload.projectId) > 0 &&
    Number.isInteger(Number(payload.segmentIndex)) &&
    Number(payload.segmentIndex) >= 0
  );
};

const normalizeStoredWorkspaceSegmentAiPhotoJob = (
  value: StoredWorkspaceSegmentAiPhotoJob,
): StoredWorkspaceSegmentAiPhotoJob => ({
  createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
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
      !(item.projectId === normalizedJob.projectId && item.segmentIndex === normalizedJob.segmentIndex),
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
) => {
  const normalizedProjectId = Number(projectId);
  const normalizedSegmentIndex = Number(segmentIndex);
  if (
    !Number.isInteger(normalizedProjectId) ||
    normalizedProjectId <= 0 ||
    !Number.isInteger(normalizedSegmentIndex) ||
    normalizedSegmentIndex < 0
  ) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentAiPhotoJobs(email).filter(
    (job) => !(job.projectId === normalizedProjectId && job.segmentIndex === normalizedSegmentIndex),
  );
  writeStoredWorkspaceSegmentAiPhotoJobs(email, jobs);
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
    Number(payload.projectId) > 0 &&
    Number.isInteger(Number(payload.segmentIndex)) &&
    Number(payload.segmentIndex) >= 0
  );
};

const normalizeStoredWorkspaceSegmentPhotoAnimationJob = (
  value: StoredWorkspaceSegmentPhotoAnimationJob,
): StoredWorkspaceSegmentPhotoAnimationJob => ({
  createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
  durationExtensionSourceDurationSeconds: normalizeWorkspaceSegmentManualDurationSeconds(
    value.durationExtensionSourceDurationSeconds,
  ),
  durationExtensionTargetDurationSeconds: normalizeWorkspaceSegmentManualDurationSeconds(
    value.durationExtensionTargetDurationSeconds,
  ),
  jobId: String(value.jobId ?? "").trim(),
  projectId: Math.trunc(Number(value.projectId)),
  prompt: normalizeWorkspaceSegmentAiVideoPrompt(value.prompt),
  segmentIndex: Math.trunc(Number(value.segmentIndex)),
  sourceAsset: normalizePersistedStudioCustomVideoFile(value.sourceAsset),
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
  const jobs = readStoredWorkspaceSegmentPhotoAnimationJobs(email).filter((item) => item.jobId !== normalizedJob.jobId);
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

const isStoredWorkspaceSegmentTalkingPhotoJob = (value: unknown): value is StoredWorkspaceSegmentTalkingPhotoJob => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<StoredWorkspaceSegmentTalkingPhotoJob>;
  return (
    typeof payload.jobId === "string" &&
    payload.jobId.trim().length > 0 &&
    Number.isInteger(Number(payload.projectId)) &&
    Number(payload.projectId) > 0 &&
    Number.isInteger(Number(payload.segmentIndex)) &&
    Number(payload.segmentIndex) >= 0
  );
};

const normalizeStoredWorkspaceSegmentTalkingPhotoJob = (
  value: StoredWorkspaceSegmentTalkingPhotoJob,
): StoredWorkspaceSegmentTalkingPhotoJob => ({
  createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
  jobId: String(value.jobId ?? "").trim(),
  projectId: Math.trunc(Number(value.projectId)),
  script: normalizeWorkspaceSegmentAiPhotoPrompt(value.script),
  segmentIndex: Math.trunc(Number(value.segmentIndex)),
  sourceAsset: normalizePersistedStudioCustomVideoFile(value.sourceAsset),
  status: String(value.status ?? "queued").trim() || "queued",
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
      !(item.projectId === normalizedJob.projectId && item.segmentIndex === normalizedJob.segmentIndex),
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
) => {
  const normalizedProjectId = Number(projectId);
  const normalizedSegmentIndex = Number(segmentIndex);
  if (
    !Number.isInteger(normalizedProjectId) ||
    normalizedProjectId <= 0 ||
    !Number.isInteger(normalizedSegmentIndex) ||
    normalizedSegmentIndex < 0
  ) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentTalkingPhotoJobs(email).filter(
    (job) => !(job.projectId === normalizedProjectId && job.segmentIndex === normalizedSegmentIndex),
  );
  writeStoredWorkspaceSegmentTalkingPhotoJobs(email, jobs);
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
      if (normalizedDraft.projectId !== normalizedProjectId) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      if (!canRestoreStoredWorkspaceSegmentEditorDraftSession(normalizedDraft)) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      if (candidate.storageName === "sessionStorage") {
        writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedDraft));
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
  const handledStorageKeys = new Set<string>();

  readWorkspaceSegmentEditorStorageEntries(storageKeyPrefix).forEach((entry) => {
    if (handledStorageKeys.has(entry.storageKey)) {
      removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
      return;
    }

    const storageProjectId = Number(entry.storageKey.slice(storageKeyPrefix.length));
    if (!Number.isInteger(storageProjectId) || storageProjectId <= 0) {
      removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
      return;
    }

    try {
      const parsedValue = JSON.parse(entry.rawValue) as unknown;
      if (!isStoredWorkspaceSegmentEditorDraftSession(parsedValue)) {
        removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
        return;
      }

      const normalizedDraft = normalizeStoredWorkspaceSegmentEditorDraftSession(parsedValue);
      if (normalizedDraft.projectId !== storageProjectId) {
        removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
        return;
      }

      if (!canRestoreStoredWorkspaceSegmentEditorDraftSession(normalizedDraft)) {
        removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
        return;
      }

      if (entry.storageName === "sessionStorage") {
        writeWorkspaceSegmentEditorStorageValue(entry.storageKey, JSON.stringify(normalizedDraft));
      }

      draftsByProjectId.set(normalizedDraft.projectId, normalizedDraft);
      handledStorageKeys.add(entry.storageKey);
    } catch {
      removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
    }
  });

  return Array.from(draftsByProjectId.values()).sort((left, right) => right.projectId - left.projectId);
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
    JSON.stringify(normalizeStoredWorkspaceSegmentEditorDraftSession(session)),
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

  const nextAiPhotoJobs = readStoredWorkspaceSegmentAiPhotoJobs(normalizedEmail).filter((job) => {
    const shouldKeep = keptProjectIds.has(job.projectId);
    if (!shouldKeep) {
      clearedProjectIds.add(job.projectId);
    }
    return shouldKeep;
  });
  writeStoredWorkspaceSegmentAiPhotoJobs(normalizedEmail, nextAiPhotoJobs);

  const nextPhotoAnimationJobs = readStoredWorkspaceSegmentPhotoAnimationJobs(normalizedEmail).filter((job) => {
    const shouldKeep = keptProjectIds.has(job.projectId);
    if (!shouldKeep) {
      clearedProjectIds.add(job.projectId);
    }
    return shouldKeep;
  });
  writeStoredWorkspaceSegmentPhotoAnimationJobs(normalizedEmail, nextPhotoAnimationJobs);

  const nextTalkingPhotoJobs = readStoredWorkspaceSegmentTalkingPhotoJobs(normalizedEmail).filter((job) => {
    const shouldKeep = keptProjectIds.has(job.projectId);
    if (!shouldKeep) {
      clearedProjectIds.add(job.projectId);
    }
    return shouldKeep;
  });
  writeStoredWorkspaceSegmentTalkingPhotoJobs(normalizedEmail, nextTalkingPhotoJobs);

  return Array.from(clearedProjectIds).sort((left, right) => left - right);
};
