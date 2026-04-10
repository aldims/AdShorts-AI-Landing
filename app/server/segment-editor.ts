import { env } from "./env.js";
import { getWorkspaceProjects } from "./projects.js";
import {
  assertAdsflowConfigured,
  buildAdsflowUrl,
  fetchAdsflowJson as fetchAdsflowJsonWithPolicy,
  UpstreamFetchError,
  UpstreamHttpError,
  upstreamPolicies,
} from "./upstream-client.js";
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

type AdsflowProjectMediaEntryPayload = {
  download_url?: string | null;
  id?: number | string | null;
  local_path?: string | null;
  media_type?: string | null;
  preview?: string | null;
  source?: string | null;
  url?: string | null;
};

type AdsflowProjectGenerationSettingsPayload = {
  background_urls?: AdsflowProjectMediaEntryPayload[] | null;
  original_videos?: AdsflowProjectMediaEntryPayload[] | null;
  video_urls?: AdsflowProjectMediaEntryPayload[] | null;
};

type AdsflowProjectDetailsResponse = {
  background_urls?: AdsflowProjectMediaEntryPayload[] | null;
  generation_settings?: AdsflowProjectGenerationSettingsPayload | null;
  source_video_urls?: AdsflowProjectMediaEntryPayload[] | null;
  video_urls?: AdsflowProjectMediaEntryPayload[] | null;
};

export type WorkspaceSegmentEditorVideoSource = "current" | "original";
export type WorkspaceSegmentEditorVideoDelivery = "preview" | "playback";
export type WorkspaceSegmentEditorSourceKind = "ai_generated" | "stock" | "upload" | "unknown";

export type WorkspaceSegmentEditorSpeechWord = {
  confidence: number;
  endTime: number;
  startTime: number;
  text: string;
};

export type WorkspaceSegmentEditorMediaType = "photo" | "video";

export type WorkspaceSegmentEditorSegment = {
  currentExternalPlaybackUrl: string | null;
  currentExternalPreviewUrl: string | null;
  currentPlaybackUrl: string | null;
  currentPreviewUrl: string | null;
  currentSourceKind: WorkspaceSegmentEditorSourceKind;
  duration: number;
  endTime: number;
  index: number;
  mediaType: WorkspaceSegmentEditorMediaType;
  originalExternalPlaybackUrl: string | null;
  originalExternalPreviewUrl: string | null;
  originalPlaybackUrl: string | null;
  originalPreviewUrl: string | null;
  originalSourceKind: WorkspaceSegmentEditorSourceKind;
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

const normalizeUrl = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
};

const isWorkspaceRenderableMediaUrl = (value: string | null | undefined) => {
  const normalized = normalizeUrl(value);
  if (!normalized) {
    return false;
  }

  if (normalized.startsWith("/")) {
    return true;
  }

  try {
    const resolvedUrl = new URL(normalized);
    return (
      resolvedUrl.protocol === "http:" ||
      resolvedUrl.protocol === "https:" ||
      resolvedUrl.protocol === "file:"
    );
  } catch {
    return false;
  }
};

const pickWorkspaceRenderableMediaUrl = (...candidates: Array<string | null | undefined>) => {
  for (const candidate of candidates) {
    if (isWorkspaceRenderableMediaUrl(candidate)) {
      return normalizeUrl(candidate);
    }
  }

  return null;
};

const normalizeProjectMediaEntries = (value: unknown): AdsflowProjectMediaEntryPayload[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is AdsflowProjectMediaEntryPayload => Boolean(item && typeof item === "object"));
};

const pickProjectMediaEntries = (...candidates: unknown[]) => {
  for (const candidate of candidates) {
    const entries = normalizeProjectMediaEntries(candidate);
    if (entries.length > 0) {
      return entries;
    }
  }

  return [] as AdsflowProjectMediaEntryPayload[];
};

const detectWorkspaceSegmentSourceKind = (
  entry?: AdsflowProjectMediaEntryPayload | null,
): WorkspaceSegmentEditorSourceKind => {
  const source = normalizeText(entry?.source).toLowerCase();
  if (source === "ai_generated" || source === "ai" || source === "generated") {
    return "ai_generated";
  }

  if (
    source === "pexels" ||
    source === "pixabay" ||
    source === "stock" ||
    source === "stock_photo" ||
    source === "stock_video" ||
    source === "unsplash"
  ) {
    return "stock";
  }

  if (
    source.includes("upload") ||
    source.includes("telegram") ||
    source.includes("user") ||
    source.includes("library")
  ) {
    return "upload";
  }

  const identifier = normalizeText(entry?.id).toLowerCase();
  const localPath = normalizeText(entry?.local_path).toLowerCase();
  const joinedUrls = [entry?.url, entry?.download_url, entry?.preview].map((value) => normalizeText(value).toLowerCase()).join(" ");

  if (identifier.startsWith("aiimg_") || localPath.includes("wavespeed") || localPath.includes("deapi")) {
    return "ai_generated";
  }

  if (joinedUrls.includes("pexels.com") || joinedUrls.includes("pixabay.com") || joinedUrls.includes("unsplash.com")) {
    return "stock";
  }

  return "unknown";
};

const getProjectMediaEntryPreviewUrl = (entry?: AdsflowProjectMediaEntryPayload | null) =>
  pickWorkspaceRenderableMediaUrl(entry?.preview, entry?.download_url, entry?.url);

const getProjectMediaEntryPlaybackUrl = (entry?: AdsflowProjectMediaEntryPayload | null) =>
  pickWorkspaceRenderableMediaUrl(entry?.download_url, entry?.url, entry?.preview);

const getProjectOriginalMediaEntries = (payload: AdsflowProjectDetailsResponse | null | undefined) =>
  pickProjectMediaEntries(
    payload?.source_video_urls,
    payload?.generation_settings?.original_videos,
    payload?.generation_settings?.video_urls,
    payload?.generation_settings?.background_urls,
    payload?.video_urls,
    payload?.background_urls,
  );

const getProjectCurrentMediaEntries = (
  payload: AdsflowProjectDetailsResponse | null | undefined,
  originalEntries: AdsflowProjectMediaEntryPayload[],
) =>
  pickProjectMediaEntries(
    payload?.video_urls,
    payload?.background_urls,
    payload?.generation_settings?.video_urls,
    payload?.generation_settings?.background_urls,
    originalEntries,
  );

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
const PROJECT_ACCESS_TIMEOUT_ERROR_MESSAGE = "Список проектов загружается слишком долго. Попробуйте ещё раз.";
const SEGMENT_EDITOR_TIMEOUT_ERROR_MESSAGE = "Сегменты загружаются слишком долго. Попробуйте ещё раз.";
const WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS = 1;
const WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS = 8;
const projectAccessCache = new Map<string, number>();
const segmentEditorSessionCache = new Map<string, { expiresAt: number; session: WorkspaceSegmentEditorSession }>();
const segmentEditorSessionInFlight = new Map<string, Promise<WorkspaceSegmentEditorSession>>();

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
  projectSources?: {
    currentEntries: AdsflowProjectMediaEntryPayload[];
    originalEntries: AdsflowProjectMediaEntryPayload[];
  },
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
  const currentEntry = projectSources?.currentEntries[index] ?? null;
  const originalEntry = projectSources?.originalEntries[index] ?? currentEntry;

  return {
    currentExternalPlaybackUrl: getProjectMediaEntryPlaybackUrl(currentEntry),
    currentExternalPreviewUrl: getProjectMediaEntryPreviewUrl(currentEntry),
    currentPlaybackUrl: hasCurrentVideo
      ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "current", "playback", currentVideoMarker)
      : null,
    currentPreviewUrl: hasCurrentVideo
      ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "current", "preview", currentVideoMarker)
      : null,
    currentSourceKind: detectWorkspaceSegmentSourceKind(currentEntry),
    duration: duration > 0 ? duration : Math.max(0, endTime - startTime),
    endTime,
    index,
    mediaType: normalizeMediaType(payload.media_type),
    originalExternalPlaybackUrl: getProjectMediaEntryPlaybackUrl(originalEntry),
    originalExternalPreviewUrl: getProjectMediaEntryPreviewUrl(originalEntry),
    originalPlaybackUrl: hasOriginalVideo
      ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "original", "playback", originalVideoMarker)
      : null,
    originalPreviewUrl: hasOriginalVideo
      ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "original", "preview", originalVideoMarker)
      : null,
    originalSourceKind: detectWorkspaceSegmentSourceKind(originalEntry),
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
  let projectDetailsPayload: AdsflowProjectDetailsResponse | null = null;

  try {
    const [segmentEditorPayload, projectPayload] = await Promise.all([
      fetchAdsflowJsonWithPolicy<AdsflowSegmentEditorResponse>({
        context: {
          endpoint: "segment-editor.session",
          projectId,
        },
        init: {
          headers: {
            "X-Admin-Token": env.adsflowAdminToken ?? "",
          },
        },
        path: `/api/projects/${projectId}/segment-editor`,
        policy: upstreamPolicies.adsflowMetadata,
      }),
      fetchAdsflowJsonWithPolicy<AdsflowProjectDetailsResponse>({
        context: {
          endpoint: "segment-editor.project-details",
          projectId,
        },
        params: {
          admin_token: env.adsflowAdminToken ?? "",
        },
        path: `/api/projects/${projectId}`,
        policy: upstreamPolicies.adsflowMetadata,
      }).catch((error) => {
        console.warn(`[segment-editor] Failed to load source metadata for project ${projectId}`, error);
        return null;
      }),
    ]);

    payload = segmentEditorPayload;
    projectDetailsPayload = projectPayload;
  } catch (error) {
    if (error instanceof UpstreamFetchError && error.isTimeout) {
      throw new WorkspaceSegmentEditorError(SEGMENT_EDITOR_TIMEOUT_ERROR_MESSAGE, 504);
    }

    if (error instanceof UpstreamHttpError && error.statusCode === 404) {
      throw new WorkspaceSegmentEditorError("Для этого проекта сегменты пока недоступны.", 404);
    }

    const message = error instanceof Error ? error.message.trim().toLowerCase() : "";
    if (message === "not found" || message.includes("404")) {
      throw new WorkspaceSegmentEditorError("Для этого проекта сегменты пока недоступны.", 404);
    }

    throw error;
  }

  const normalizedProjectId = normalizeInteger(payload.project_id) ?? projectId;
  const originalEntries = getProjectOriginalMediaEntries(projectDetailsPayload);
  const currentEntries = getProjectCurrentMediaEntries(projectDetailsPayload, originalEntries);
  const segments = (payload.segments ?? [])
    .map((segment) =>
      buildWorkspaceSegmentEditorSegment(normalizedProjectId, segment, {
        currentEntries,
        originalEntries,
      }),
    )
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

export async function getWorkspaceProjectSegmentVideoAsset(
  user: SegmentEditorUser,
  options: {
    delivery: WorkspaceSegmentEditorVideoDelivery;
    projectId: number;
    segmentIndex: number;
    source: WorkspaceSegmentEditorVideoSource;
  },
): Promise<null> {
  void user;
  void options;
  return null;
}
