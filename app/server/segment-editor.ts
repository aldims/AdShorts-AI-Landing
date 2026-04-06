import { env } from "./env.js";
import { getWorkspaceProjects } from "./projects.js";
import { listWorkspaceGenerationHistory } from "./workspace-history.js";

type SegmentEditorUser = {
  email?: string | null;
  id?: string | null;
  name?: string | null;
};

type AdsflowSegmentEditorSpeechWordPayload = {
  confidence?: number | string | null;
  end_time?: number | string | null;
  start_time?: number | string | null;
  text?: string | null;
};

type AdsflowSegmentEditorSegmentPayload = {
  current_video?: string | null;
  duration?: number | string | null;
  end_time?: number | string | null;
  index?: number | string | null;
  media_type?: string | null;
  original_video?: string | null;
  speech_duration?: number | string | null;
  speech_end_time?: number | string | null;
  speech_start_time?: number | string | null;
  speech_words?: AdsflowSegmentEditorSpeechWordPayload[] | null;
  start_time?: number | string | null;
  text?: string | null;
};

type AdsflowSegmentEditorResponse = {
  description?: string | null;
  music_type?: string | null;
  project_id?: number | string | null;
  segments?: AdsflowSegmentEditorSegmentPayload[] | null;
  subtitle_color?: string | null;
  subtitle_style?: string | null;
  subtitle_type?: string | null;
  title?: string | null;
  voice_type?: string | null;
};

export type WorkspaceSegmentEditorVideoSource = "current" | "original";
export type WorkspaceSegmentEditorVideoDelivery = "preview" | "playback";

export type WorkspaceSegmentEditorSpeechWord = {
  confidence: number;
  endTime: number;
  startTime: number;
  text: string;
};

export type WorkspaceSegmentEditorMediaType = "photo" | "video";

export type WorkspaceSegmentEditorSegment = {
  currentPlaybackUrl: string | null;
  currentPreviewUrl: string | null;
  duration: number;
  endTime: number;
  index: number;
  mediaType: WorkspaceSegmentEditorMediaType;
  originalPlaybackUrl: string | null;
  originalPreviewUrl: string | null;
  speechDuration: number | null;
  speechEndTime: number | null;
  speechStartTime: number | null;
  speechWords: WorkspaceSegmentEditorSpeechWord[];
  startTime: number;
  text: string;
};

export type WorkspaceSegmentEditorSession = {
  description: string;
  musicType: string;
  projectId: number;
  segments: WorkspaceSegmentEditorSegment[];
  subtitleColor: string;
  subtitleStyle: string;
  subtitleType: string;
  title: string;
  voiceType: string;
};

export class WorkspaceSegmentEditorError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "WorkspaceSegmentEditorError";
    this.statusCode = statusCode;
  }
}

class AdsflowRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AdsflowRequestError";
    this.statusCode = statusCode;
  }
}

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizeInteger = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  const rounded = Math.trunc(numeric);
  return rounded >= 0 ? rounded : null;
};

const normalizeNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeMediaType = (value: unknown): WorkspaceSegmentEditorMediaType =>
  String(value ?? "").trim().toLowerCase() === "photo" ? "photo" : "video";

const normalizeSpeechWords = (value: unknown): WorkspaceSegmentEditorSpeechWord[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as AdsflowSegmentEditorSpeechWordPayload;
      const text = normalizeText(record.text);
      const startTime = normalizeNumber(record.start_time);
      const endTime = normalizeNumber(record.end_time);
      const confidence = normalizeNumber(record.confidence);

      if (!text || startTime === null || endTime === null || endTime <= startTime) {
        return null;
      }

      return {
        confidence: confidence !== null ? Math.max(0, confidence) : 0,
        endTime: Math.max(startTime, endTime),
        startTime: Math.max(0, startTime),
        text,
      };
    })
    .filter((item): item is WorkspaceSegmentEditorSpeechWord => Boolean(item));
};

const PROJECT_ACCESS_CACHE_TTL_MS = 5 * 60_000;
const SEGMENT_EDITOR_SESSION_CACHE_TTL_MS = 60_000;
const PROJECT_ACCESS_FALLBACK_TIMEOUT_MS = 8_000;
const SEGMENT_EDITOR_SESSION_TIMEOUT_MS = 15_000;
const PROJECT_ACCESS_TIMEOUT_ERROR_MESSAGE = "Список проектов загружается слишком долго. Попробуйте ещё раз.";
const SEGMENT_EDITOR_TIMEOUT_ERROR_MESSAGE = "Сегменты загружаются слишком долго. Попробуйте ещё раз.";
const WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS = 1;
const WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS = 8;
const projectAccessCache = new Map<string, number>();
const segmentEditorSessionCache = new Map<string, { expiresAt: number; session: WorkspaceSegmentEditorSession }>();
const segmentEditorSessionInFlight = new Map<string, Promise<WorkspaceSegmentEditorSession>>();

const assertAdsflowConfigured = () => {
  if (!env.adsflowApiBaseUrl || !env.adsflowAdminToken) {
    throw new Error("AdsFlow API is not configured.");
  }
};

const getProjectAccessCacheKey = (user: SegmentEditorUser, projectId: number) => {
  const userId = normalizeText(user.id);
  if (userId) {
    return `user:${userId}:project:${projectId}`;
  }

  const email = normalizeText(user.email).toLowerCase();
  return email ? `email:${email}:project:${projectId}` : null;
};

const hasCachedProjectAccess = (user: SegmentEditorUser, projectId: number) => {
  const cacheKey = getProjectAccessCacheKey(user, projectId);
  if (!cacheKey) {
    return false;
  }

  const expiresAt = projectAccessCache.get(cacheKey);
  if (!expiresAt) {
    return false;
  }

  if (expiresAt <= Date.now()) {
    projectAccessCache.delete(cacheKey);
    return false;
  }

  return true;
};

const cacheProjectAccess = (user: SegmentEditorUser, projectId: number) => {
  const cacheKey = getProjectAccessCacheKey(user, projectId);
  if (!cacheKey) {
    return;
  }

  projectAccessCache.set(cacheKey, Date.now() + PROJECT_ACCESS_CACHE_TTL_MS);
};

const getSegmentEditorSessionCacheKey = (user: SegmentEditorUser, projectId: number) => {
  const userId = normalizeText(user.id);
  if (userId) {
    return `user:${userId}:segment-editor:${projectId}`;
  }

  const email = normalizeText(user.email).toLowerCase();
  return email ? `email:${email}:segment-editor:${projectId}` : null;
};

const getCachedSegmentEditorSession = (user: SegmentEditorUser, projectId: number) => {
  const cacheKey = getSegmentEditorSessionCacheKey(user, projectId);
  if (!cacheKey) {
    return null;
  }

  const cachedEntry = segmentEditorSessionCache.get(cacheKey);
  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    segmentEditorSessionCache.delete(cacheKey);
    return null;
  }

  return cachedEntry.session;
};

const setCachedSegmentEditorSession = (
  user: SegmentEditorUser,
  projectId: number,
  session: WorkspaceSegmentEditorSession,
) => {
  const cacheKey = getSegmentEditorSessionCacheKey(user, projectId);
  if (!cacheKey) {
    return;
  }

  segmentEditorSessionCache.set(cacheKey, {
    expiresAt: Date.now() + SEGMENT_EDITOR_SESSION_CACHE_TTL_MS,
    session,
  });
};

export const invalidateWorkspaceSegmentEditorSessionCache = (user: SegmentEditorUser, projectId?: number) => {
  const exactCacheKey =
    typeof projectId === "number" && Number.isFinite(projectId) && projectId > 0
      ? getSegmentEditorSessionCacheKey(user, projectId)
      : null;

  if (exactCacheKey) {
    segmentEditorSessionCache.delete(exactCacheKey);
    segmentEditorSessionInFlight.delete(exactCacheKey);
    return;
  }

  const userId = normalizeText(user.id);
  const email = normalizeText(user.email).toLowerCase();
  const cachePrefix = userId ? `user:${userId}:segment-editor:` : email ? `email:${email}:segment-editor:` : null;

  if (!cachePrefix) {
    return;
  }

  for (const key of segmentEditorSessionCache.keys()) {
    if (key.startsWith(cachePrefix)) {
      segmentEditorSessionCache.delete(key);
    }
  }

  for (const key of segmentEditorSessionInFlight.keys()) {
    if (key.startsWith(cachePrefix)) {
      segmentEditorSessionInFlight.delete(key);
    }
  }
};

const buildAdsflowUrl = (path: string, params?: Record<string, string>) => {
  assertAdsflowConfigured();

  const url = new URL(path, env.adsflowApiBaseUrl);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url;
};

const fetchAdsflowJson = async <T>(url: URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as T | { detail?: string; error?: string } | null;

  if (!response.ok) {
    const payloadRecord =
      payload && typeof payload === "object" ? (payload as { detail?: string; error?: string }) : null;
    const detail =
      payloadRecord
        ? typeof payloadRecord.detail === "string" && payloadRecord.detail.trim()
          ? payloadRecord.detail.trim()
          : typeof payloadRecord.error === "string" && payloadRecord.error.trim()
            ? payloadRecord.error.trim()
            : ""
        : "";

    throw new AdsflowRequestError(detail || `AdsFlow request failed (${response.status}).`, response.status);
  }

  if (!payload) {
    throw new Error("AdsFlow returned an empty response.");
  }

  return payload as T;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const assertWorkspaceProjectAccess = async (user: SegmentEditorUser, projectId: number) => {
  if (hasCachedProjectAccess(user, projectId)) {
    return;
  }

  const historyEntries = await listWorkspaceGenerationHistory(user, 120).catch(() => []);
  if (historyEntries.some((entry) => entry.adId === projectId)) {
    cacheProjectAccess(user, projectId);
    return;
  }

  let projects: Awaited<ReturnType<typeof getWorkspaceProjects>>;
  try {
    projects = await withTimeout(
      getWorkspaceProjects(user),
      PROJECT_ACCESS_FALLBACK_TIMEOUT_MS,
      PROJECT_ACCESS_TIMEOUT_ERROR_MESSAGE,
    );
  } catch (error) {
    if (error instanceof Error && error.message === PROJECT_ACCESS_TIMEOUT_ERROR_MESSAGE) {
      throw new WorkspaceSegmentEditorError(error.message, 504);
    }

    throw error;
  }
  const project = projects.find((item) => item.adId === projectId) ?? null;

  if (!project) {
    throw new WorkspaceSegmentEditorError("Проект не найден или недоступен для редактирования.", 404);
  }

  cacheProjectAccess(user, projectId);

  return project;
};

const buildWorkspaceSegmentEditorVideoUrl = (
  projectId: number,
  segmentIndex: number,
  source: WorkspaceSegmentEditorVideoSource,
  delivery: WorkspaceSegmentEditorVideoDelivery,
  marker?: string,
) => {
  const previewUrl = new URL("/api/workspace/project-segment-video", env.appUrl);
  previewUrl.searchParams.set("projectId", String(projectId));
  previewUrl.searchParams.set("segmentIndex", String(segmentIndex));
  previewUrl.searchParams.set("source", source);
  previewUrl.searchParams.set("delivery", delivery);
  if (marker) {
    previewUrl.searchParams.set("v", marker);
  }
  return `${previewUrl.pathname}${previewUrl.search}`;
};

const buildWorkspaceSegmentEditorSegment = (
  projectId: number,
  payload: AdsflowSegmentEditorSegmentPayload,
): WorkspaceSegmentEditorSegment | null => {
  const index = normalizeInteger(payload.index);
  if (index === null) {
    return null;
  }

  const startTime = normalizeNumber(payload.start_time) ?? 0;
  const endTime = normalizeNumber(payload.end_time) ?? Math.max(startTime, startTime + (normalizeNumber(payload.duration) ?? 0));
  const duration = normalizeNumber(payload.duration) ?? Math.max(0, endTime - startTime);
  const speechStartTime = normalizeNumber(payload.speech_start_time);
  const speechEndTime = normalizeNumber(payload.speech_end_time);
  const speechDuration =
    normalizeNumber(payload.speech_duration) ??
    (speechStartTime !== null && speechEndTime !== null ? Math.max(0, speechEndTime - speechStartTime) : null);
  const speechWords = normalizeSpeechWords(payload.speech_words);
  const currentVideoMarker = normalizeText(payload.current_video);
  const originalVideoMarker = normalizeText(payload.original_video);
  const hasCurrentVideo = Boolean(currentVideoMarker);
  const hasOriginalVideo = Boolean(originalVideoMarker);

  return {
    currentPlaybackUrl: hasCurrentVideo
      ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "current", "playback", currentVideoMarker)
      : null,
    currentPreviewUrl: hasCurrentVideo
      ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "current", "preview", currentVideoMarker)
      : null,
    duration: duration > 0 ? duration : Math.max(0, endTime - startTime),
    endTime,
    index,
    mediaType: normalizeMediaType(payload.media_type),
    originalPlaybackUrl: hasOriginalVideo
      ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "original", "playback", originalVideoMarker)
      : null,
    originalPreviewUrl: hasOriginalVideo
      ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "original", "preview", originalVideoMarker)
      : null,
    speechDuration: speechDuration !== null ? Math.max(0, speechDuration) : null,
    speechEndTime:
      speechStartTime !== null && speechEndTime !== null ? Math.max(speechStartTime, speechEndTime) : null,
    speechStartTime: speechStartTime !== null ? Math.max(0, speechStartTime) : null,
    speechWords,
    startTime,
    text: normalizeText(payload.text),
  };
};

const loadWorkspaceSegmentEditorSession = async (projectId: number): Promise<WorkspaceSegmentEditorSession> => {
  assertAdsflowConfigured();
  let payload: AdsflowSegmentEditorResponse;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEGMENT_EDITOR_SESSION_TIMEOUT_MS);

  try {
    payload = await fetchAdsflowJson<AdsflowSegmentEditorResponse>(
      buildAdsflowUrl(`/api/projects/${projectId}/segment-editor`),
      {
        headers: {
          "X-Admin-Token": env.adsflowAdminToken ?? "",
        },
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new WorkspaceSegmentEditorError(SEGMENT_EDITOR_TIMEOUT_ERROR_MESSAGE, 504);
    }

    if (error instanceof AdsflowRequestError && error.statusCode === 404) {
      throw new WorkspaceSegmentEditorError("Для этого проекта сегменты пока недоступны.", 404);
    }

    const message = error instanceof Error ? error.message.trim().toLowerCase() : "";
    if (message === "not found" || message.includes("404")) {
      throw new WorkspaceSegmentEditorError("Для этого проекта сегменты пока недоступны.", 404);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const normalizedProjectId = normalizeInteger(payload.project_id) ?? projectId;
  const segments = (payload.segments ?? [])
    .map((segment) => buildWorkspaceSegmentEditorSegment(normalizedProjectId, segment))
    .filter((segment): segment is WorkspaceSegmentEditorSegment => Boolean(segment))
    .sort((left, right) => left.index - right.index);

  if (segments.length < WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS) {
    throw new WorkspaceSegmentEditorError("Для этого проекта пока нет данных сегментов.", 409);
  }

  if (segments.length > WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS) {
    throw new WorkspaceSegmentEditorError(
      `Редактор сегментов пока поддерживает проекты до ${WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS} сегментов.`,
      409,
    );
  }

  return {
    description: normalizeText(payload.description),
    musicType: normalizeText(payload.music_type),
    projectId: normalizedProjectId,
    segments,
    subtitleColor: normalizeText(payload.subtitle_color),
    subtitleStyle: normalizeText(payload.subtitle_style),
    subtitleType: normalizeText(payload.subtitle_type),
    title: normalizeText(payload.title) || `Проект #${normalizedProjectId}`,
    voiceType: normalizeText(payload.voice_type),
  };
};

const getWorkspaceSegmentEditorSessionInternal = async (
  user: SegmentEditorUser,
  projectId: number,
  options?: {
    bypassCache?: boolean;
    skipProjectAccessCheck?: boolean;
  },
): Promise<WorkspaceSegmentEditorSession> => {
  const shouldBypassCache = Boolean(options?.bypassCache);
  const cacheKey = getSegmentEditorSessionCacheKey(user, projectId);
  const shouldTrackInFlight = Boolean(cacheKey && !shouldBypassCache);

  if (!shouldBypassCache) {
    const cachedSession = getCachedSegmentEditorSession(user, projectId);
    if (cachedSession) {
      return cachedSession;
    }

    if (cacheKey) {
      const inFlightRequest = segmentEditorSessionInFlight.get(cacheKey);
      if (inFlightRequest) {
        return inFlightRequest;
      }
    }
  }

  const request = (async () => {
    if (!options?.skipProjectAccessCheck) {
      await assertWorkspaceProjectAccess(user, projectId);
    }

    return loadWorkspaceSegmentEditorSession(projectId);
  })();

  if (shouldTrackInFlight && cacheKey) {
    segmentEditorSessionInFlight.set(cacheKey, request);
  }

  try {
    const session = await request;
    setCachedSegmentEditorSession(user, projectId, session);
    return session;
  } finally {
    if (shouldTrackInFlight && cacheKey) {
      segmentEditorSessionInFlight.delete(cacheKey);
    }
  }
};

export async function getWorkspaceSegmentEditorSession(
  user: SegmentEditorUser,
  projectId: number,
): Promise<WorkspaceSegmentEditorSession> {
  return getWorkspaceSegmentEditorSessionInternal(user, projectId);
}

export async function getWorkspaceSegmentEditorSessionForAccessibleProject(
  user: SegmentEditorUser,
  projectId: number,
  options?: {
    bypassCache?: boolean;
  },
): Promise<WorkspaceSegmentEditorSession> {
  return getWorkspaceSegmentEditorSessionInternal(user, projectId, {
    bypassCache: options?.bypassCache,
    skipProjectAccessCheck: true,
  });
}

export async function getWorkspaceProjectSegmentVideoProxyTarget(
  user: SegmentEditorUser,
  options: {
    delivery: WorkspaceSegmentEditorVideoDelivery;
    projectId: number;
    segmentIndex: number;
    source: WorkspaceSegmentEditorVideoSource;
  },
) {
  assertAdsflowConfigured();
  await assertWorkspaceProjectAccess(user, options.projectId);

  return {
    headers: {
      "X-Admin-Token": env.adsflowAdminToken ?? "",
    },
    url: buildAdsflowUrl(`/api/projects/${options.projectId}/segments/${options.segmentIndex}/video`, {
      delivery: options.delivery,
      source: options.source,
    }),
  };
}
