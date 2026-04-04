import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
import {
  ensureWorkspaceProjectPlayback,
  getWorkspaceProjectPlaybackCacheKey,
  warmWorkspaceProjectPlayback,
  type WorkspaceProjectPlaybackAsset,
  type WorkspaceProjectPlaybackSource,
} from "./project-playback.js";
import {
  ensureWorkspaceProjectPoster,
  getWorkspaceProjectPosterCacheKey,
  warmWorkspaceProjectPoster,
  type WorkspaceProjectPosterSource,
} from "./project-posters.js";
import {
  listWorkspaceDeletedProjects,
  listWorkspaceGenerationHistory,
  markWorkspaceProjectDeleted,
  type WorkspaceDeletedProjectEntry,
  type WorkspaceGenerationHistoryEntry,
} from "./workspace-history.js";

type WorkspaceUser = {
  email?: string | null;
  id?: string | null;
  name?: string | null;
};

type AdsflowLatestGenerationPayload = {
  ad_id?: number | null;
  description?: string | null;
  download_path?: string | null;
  error?: string | null;
  generated_at?: string | null;
  hashtags?: string | null;
  job_id?: string;
  prompt?: string | null;
  status?: string;
  task_type?: string | null;
  title?: string | null;
};

type AdsflowBootstrapResponse = {
  latest_generation?: AdsflowLatestGenerationPayload | null;
  remoteUserId: string | null;
};

type AdsflowAdminVideoItem = {
  ai_title?: string | null;
  created_at?: string | null;
  description?: string | null;
  download_path?: string | null;
  id?: number;
  status?: string | null;
  user_id?: number;
  youtube_channel_name?: string | null;
  youtube_publish_state?: string | null;
  youtube_published_at?: string | null;
  youtube_published_link?: string | null;
  youtube_scheduled_at?: string | null;
  youtube_video_id?: string | null;
};

type AdsflowAdminVideosResponse = {
  items?: AdsflowAdminVideoItem[];
};

export type WorkspaceProjectYouTubePublication = {
  channelName: string | null;
  link: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  state: string | null;
  youtubeVideoId: string | null;
};

export type WorkspaceProject = {
  adId: number | null;
  createdAt: string;
  description: string;
  generatedAt: string | null;
  hashtags: string[];
  id: string;
  jobId: string | null;
  prompt: string;
  source: "project" | "task";
  status: string;
  title: string;
  updatedAt: string;
  posterUrl: string | null;
  videoFallbackUrl: string | null;
  videoUrl: string | null;
  youtubePublication: WorkspaceProjectYouTubePublication | null;
};

export class WorkspaceProjectNotFoundError extends Error {
  constructor() {
    super("Project not found.");
    this.name = "WorkspaceProjectNotFoundError";
  }
}

const MAX_PROJECTS = 60;
const MAX_PROJECT_FETCH_LIMIT = 200;
const ADSFLOW_ADMIN_VIDEOS_MAX_PAGE_SIZE = 100;
const PROJECTS_CACHE_TTL_MS = 15_000;
const workspaceProjectsCache = new Map<string, { expiresAt: number; projects: WorkspaceProject[] }>();
const workspaceProjectsInFlight = new Map<string, Promise<WorkspaceProject[]>>();

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizePrompt = (value: unknown) => normalizeText(value);

const parseJson = (value: string) => {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const formatErrorDetailEntry = (value: unknown): string | null => {
  if (typeof value === "string") {
    const normalized = normalizeText(value);
    return normalized || null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as {
    error?: unknown;
    loc?: unknown;
    msg?: unknown;
  };
  const loc = Array.isArray(record.loc)
    ? record.loc
        .map((entry) => normalizeText(entry))
        .filter(Boolean)
        .join(".")
    : "";
  const message =
    (typeof record.msg === "string" && normalizeText(record.msg)) ||
    (typeof record.error === "string" && normalizeText(record.error)) ||
    "";

  if (loc && message) {
    return `${loc}: ${message}`;
  }

  return message || null;
};

const extractErrorDetail = (value: unknown) => {
  const payload =
    typeof value === "string"
      ? parseJson(value)
      : value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : null;

  if (!payload || typeof payload !== "object") {
    const normalized = normalizeText(value);
    return normalized && !normalized.startsWith("<") ? normalized : null;
  }

  const detail = "detail" in payload ? payload.detail : undefined;
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  if (Array.isArray(detail)) {
    const parts = detail.map(formatErrorDetailEntry).filter(Boolean);
    if (parts.length > 0) {
      return parts.join("; ");
    }
  }

  const error = "error" in payload ? payload.error : undefined;
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return formatErrorDetailEntry(detail) || formatErrorDetailEntry(error);
};

const extractBootstrapUserId = (value: string) => {
  const match = value.match(/"user"\s*:\s*\{[\s\S]*?"user_id"\s*:\s*(\d+)/);
  return match?.[1]?.trim() || null;
};

const parseHashtags = (value: unknown) => {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  const explicitTags = normalized.match(/#[^\s#]+/g);
  if (explicitTags?.length) {
    return Array.from(new Set(explicitTags));
  }

  return Array.from(
    new Set(
      normalized
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => `#${item.replace(/^#+/, "")}`),
    ),
  );
};

const cloneWorkspaceProject = (project: WorkspaceProject): WorkspaceProject => ({
  ...project,
  hashtags: [...project.hashtags],
  youtubePublication: project.youtubePublication ? { ...project.youtubePublication } : null,
});

const cloneWorkspaceProjects = (projects: WorkspaceProject[]) => projects.map(cloneWorkspaceProject);

const buildPromptTitle = (prompt: string, fallback = "Проект") => {
  const normalized = normalizePrompt(prompt);

  if (!normalized) return fallback;
  if (normalized.length <= 72) return normalized;

  const compact = normalized.slice(0, 69).trim();
  return compact ? `${compact}...` : fallback;
};

const isWorkspaceTaskPlaceholderTitle = (value: unknown) => normalizeText(value).toLowerCase() === "studio generation";

const resolveWorkspaceTaskTitle = ({
  adId,
  prompt,
  title,
}: {
  adId?: number | null;
  prompt: string;
  title: unknown;
}) => {
  const normalizedTitle = normalizeText(title);
  if (normalizedTitle && !isWorkspaceTaskPlaceholderTitle(normalizedTitle)) {
    return normalizedTitle;
  }

  return buildPromptTitle(prompt, adId ? `Проект #${adId}` : "Проект");
};

const toIsoString = (value: unknown) => {
  if (!value) return null;

  const normalized = normalizeText(value);
  if (!normalized) return null;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
};

const normalizeProjectStatus = (value: unknown) => {
  const normalized = normalizeText(value).toLowerCase();

  switch (normalized) {
    case "ready":
    case "completed":
    case "done":
      return "ready";
    case "queued":
      return "queued";
    case "processing":
    case "rendering":
    case "retrying":
      return "processing";
    case "failed":
      return "failed";
    case "draft":
      return "draft";
    default:
      return normalized || "draft";
  }
};

const isAdsflowLatestVideoGenerationTask = (value: unknown) => {
  const normalized = normalizeText(value).toLowerCase();
  return !normalized || normalized === "video.generate" || normalized === "video.edit";
};

const buildAbsoluteAdsflowUrl = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  try {
    return new URL(normalized, getAdsflowBaseUrl()).toString();
  } catch {
    return normalized;
  }
};

const isPlayableWorkspaceVideoPath = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) return false;

  try {
    const resolvedUrl = new URL(normalized, getAdsflowBaseUrl());
    const hostname = resolvedUrl.hostname.toLowerCase();
    const pathname = resolvedUrl.pathname.toLowerCase();

    if (hostname === "youtu.be" || hostname.endsWith(".youtube.com") || hostname === "youtube.com") {
      return false;
    }

    return (
      pathname.includes("/api/video/download/") ||
      pathname.includes("/api/web/video/") ||
      /\.(mp4|mov|webm|m4v)$/i.test(pathname)
    );
  } catch {
    return false;
  }
};

const buildWorkspaceProjectVideoProxyUrl = (
  value: string | null | undefined,
  version?: string | null,
) => {
  if (!isPlayableWorkspaceVideoPath(value)) {
    return null;
  }

  const resolvedUrl = buildAbsoluteAdsflowUrl(value);
  if (!resolvedUrl) return null;

  const proxyUrl = new URL("/api/workspace/project-video", env.appUrl);
  proxyUrl.searchParams.set("path", resolvedUrl);
  const normalizedVersion = normalizeText(version);
  if (normalizedVersion) {
    proxyUrl.searchParams.set("v", normalizedVersion);
  }
  return `${proxyUrl.pathname}${proxyUrl.search}`;
};

const buildWorkspaceJobVideoProxyUrl = (jobId: string | null | undefined, version?: string | null) => {
  const normalizedJobId = normalizeText(jobId);
  if (!normalizedJobId) return null;

  const proxyUrl = new URL(`/api/studio/video/${encodeURIComponent(normalizedJobId)}`, env.appUrl);
  const normalizedVersion = normalizeText(version);
  if (normalizedVersion) {
    proxyUrl.searchParams.set("v", normalizedVersion);
  }

  return `${proxyUrl.pathname}${proxyUrl.search}`;
};

const buildWorkspaceProjectPosterUrl = (projectId: string | null | undefined, version?: string | null) => {
  const normalizedProjectId = normalizeText(projectId);
  if (!normalizedProjectId) return null;

  const proxyUrl = new URL(`/api/workspace/projects/${encodeURIComponent(normalizedProjectId)}/poster`, env.appUrl);
  const normalizedVersion = normalizeText(version);
  if (normalizedVersion) {
    proxyUrl.searchParams.set("v", normalizedVersion);
  }

  return `${proxyUrl.pathname}${proxyUrl.search}`;
};

const buildWorkspaceProjectLocalPlaybackUrl = (projectId: string | null | undefined, version?: string | null) => {
  const normalizedProjectId = normalizeText(projectId);
  if (!normalizedProjectId) return null;

  const proxyUrl = new URL(`/api/workspace/projects/${encodeURIComponent(normalizedProjectId)}/playback`, env.appUrl);
  const normalizedVersion = normalizeText(version);
  if (normalizedVersion) {
    proxyUrl.searchParams.set("v", normalizedVersion);
  }

  return `${proxyUrl.pathname}${proxyUrl.search}`;
};

const buildWorkspaceProjectPlaybackTargets = ({
  projectId,
  downloadPath,
  jobId,
  version,
}: {
  projectId: string | null | undefined;
  downloadPath: string | null | undefined;
  jobId?: string | null;
  version?: string | null;
}) => {
  const localPlaybackUrl = buildWorkspaceProjectLocalPlaybackUrl(projectId, version);
  const jobVideoUrl = buildWorkspaceJobVideoProxyUrl(jobId, version);
  const directVideoUrl = buildWorkspaceProjectVideoProxyUrl(downloadPath, version);
  const videoFallbackUrl = directVideoUrl ?? jobVideoUrl;

  return {
    videoFallbackUrl,
    videoUrl: videoFallbackUrl ? localPlaybackUrl ?? videoFallbackUrl : null,
  };
};

const assertAdsflowConfigured = () => {
  if (!env.adsflowApiBaseUrl || !env.adsflowAdminToken) {
    throw new Error("AdsFlow API is not configured.");
  }
};

const getAdsflowBaseUrl = () => {
  assertAdsflowConfigured();
  return env.adsflowApiBaseUrl as string;
};

const fetchAdsflowJson = async <T>(url: URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as T | Record<string, unknown> | null;

  if (!response.ok) {
    const detail = extractErrorDetail(payload) ?? `AdsFlow request failed (${response.status}).`;

    throw new Error(detail);
  }

  if (!payload) {
    throw new Error("AdsFlow returned an empty response.");
  }

  return payload as T;
};

const postAdsflowText = async (path: string, body: Record<string, unknown>) => {
  const response = await fetch(new URL(path, getAdsflowBaseUrl()), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.text();

  if (!response.ok) {
    throw new Error(extractErrorDetail(payload) ?? `AdsFlow request failed (${response.status}).`);
  }

  if (!payload) {
    throw new Error("AdsFlow returned an empty response.");
  }

  return payload;
};

const postAdsflowJson = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  return fetchAdsflowJson<T>(new URL(path, getAdsflowBaseUrl()), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
};

const resolvePreferredExternalUserId = async (user: WorkspaceUser) => {
  try {
    return (await resolveExternalUserIdentity(user)).preferred;
  } catch {
    return buildExternalUserId(user);
  }
};

const fetchBootstrapPayload = async (user: WorkspaceUser, externalUserId?: string) => {
  const resolvedExternalUserId = externalUserId ?? (await resolvePreferredExternalUserId(user));

  const payloadText = await postAdsflowText("/api/web/bootstrap", {
    admin_token: env.adsflowAdminToken,
    external_user_id: resolvedExternalUserId,
    language: "ru",
    referral_source: "landing_site",
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  });

  const payload = parseJson(payloadText);
  const remoteUserId = extractBootstrapUserId(payloadText);

  if (!payload || typeof payload !== "object") {
    throw new Error("AdsFlow returned an invalid bootstrap response.");
  }

  if (!remoteUserId || !/^\d+$/.test(remoteUserId)) {
    throw new Error("AdsFlow did not return web user profile.");
  }

  return {
    latest_generation:
      "latest_generation" in payload ? (payload.latest_generation as AdsflowLatestGenerationPayload | null | undefined) : null,
    remoteUserId,
  } satisfies AdsflowBootstrapResponse;
};

const getWorkspaceProjectFetchLimit = (deletedProjectsCount: number) =>
  Math.max(MAX_PROJECTS, Math.min(MAX_PROJECTS + Math.max(0, Math.trunc(deletedProjectsCount || 0)), MAX_PROJECT_FETCH_LIMIT));

const fetchAdminVideos = async (userId: string, limit = MAX_PROJECTS) => {
  const requestedLimit = Math.max(1, Math.min(Math.trunc(limit || MAX_PROJECTS), MAX_PROJECT_FETCH_LIMIT));
  const items: AdsflowAdminVideoItem[] = [];
  let page = 1;

  while (items.length < requestedLimit) {
    const pageSize = Math.min(ADSFLOW_ADMIN_VIDEOS_MAX_PAGE_SIZE, requestedLimit - items.length);
    const url = new URL("/api/admin/videos", getAdsflowBaseUrl());
    url.searchParams.set("user_id", userId);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));

    const payload = await fetchAdsflowJson<AdsflowAdminVideosResponse>(url, {
      headers: {
        "X-Admin-Token": env.adsflowAdminToken ?? "",
      },
    });
    const batch = payload.items ?? [];
    if (batch.length === 0) {
      break;
    }

    items.push(...batch);
    if (batch.length < pageSize) {
      break;
    }

    page += 1;
  }

  return items.slice(0, requestedLimit);
};

const buildProjectFromAdminVideo = (
  item: AdsflowAdminVideoItem,
  historyEntry?: WorkspaceGenerationHistoryEntry | null,
): WorkspaceProject | null => {
  const adId = Number(item.id ?? 0);
  if (!Number.isFinite(adId) || adId <= 0) return null;

  const prompt = normalizePrompt(item.description ?? "");
  const createdAt = toIsoString(item.created_at) ?? new Date().toISOString();
  const historyJobId = normalizeText(historyEntry?.jobId);
  const historyUpdatedAt = toIsoString(historyEntry?.updatedAt);
  const updatedAt = historyUpdatedAt ?? createdAt;
  const status = normalizeProjectStatus(item.status);
  const playbackTargets = buildWorkspaceProjectPlaybackTargets({
    projectId: `project:${adId}`,
    downloadPath: item.download_path,
    jobId: historyJobId || null,
    version: updatedAt,
  });
  const description = normalizeText(item.description) || prompt || "Описание проекта недоступно.";
  const videoUrl = status === "ready" ? playbackTargets.videoUrl : null;
  const videoFallbackUrl = status === "ready" ? playbackTargets.videoFallbackUrl : null;
  const youtubePublication =
    normalizeText(item.youtube_publish_state) ||
    normalizeText(item.youtube_published_link) ||
    normalizeText(item.youtube_video_id) ||
    normalizeText(item.youtube_published_at) ||
    normalizeText(item.youtube_scheduled_at) ||
    normalizeText(item.youtube_channel_name)
      ? {
          channelName: normalizeText(item.youtube_channel_name) || null,
          link: normalizeText(item.youtube_published_link) || null,
          publishedAt: toIsoString(item.youtube_published_at),
          scheduledAt: toIsoString(item.youtube_scheduled_at),
          state: normalizeText(item.youtube_publish_state).toLowerCase() || null,
          youtubeVideoId: normalizeText(item.youtube_video_id) || null,
        }
      : null;

  return {
    adId,
    createdAt,
    description,
    generatedAt: createdAt,
    hashtags: [],
    id: `project:${adId}`,
    jobId: historyJobId || null,
    prompt,
    source: "project",
    status,
    title: normalizeText(item.ai_title) || buildPromptTitle(prompt, `Проект #${adId}`),
    updatedAt,
    posterUrl: status === "ready" && videoUrl ? buildWorkspaceProjectPosterUrl(`project:${adId}`, updatedAt) : null,
    videoFallbackUrl,
    videoUrl,
    youtubePublication,
  };
};

const buildProjectFromLatestGeneration = (item: AdsflowLatestGenerationPayload): WorkspaceProject | null => {
  if (!isAdsflowLatestVideoGenerationTask(item.task_type)) {
    return null;
  }

  const jobId = normalizeText(item.job_id);
  if (!jobId) return null;

  const prompt = normalizePrompt(item.prompt ?? "");
  const generatedAt = toIsoString(item.generated_at);
  const createdAt = generatedAt ?? new Date().toISOString();
  const adId = item.ad_id && Number.isFinite(Number(item.ad_id)) ? Number(item.ad_id) : null;
  const status = normalizeProjectStatus(item.status);
  if (status !== "ready") {
    return null;
  }

  const playbackTargets = buildWorkspaceProjectPlaybackTargets({
    projectId: `task:${jobId}`,
    downloadPath: item.download_path,
    jobId,
    version: generatedAt ?? createdAt,
  });
  if (!playbackTargets.videoUrl) {
    return null;
  }
  const title = resolveWorkspaceTaskTitle({
    adId,
    prompt,
    title: item.title,
  });
  const description = normalizeText(item.description) || prompt || "Описание проекта появится после завершения генерации.";

  return {
    adId,
    createdAt,
    description,
    generatedAt,
    hashtags: parseHashtags(item.hashtags),
    id: `task:${jobId}`,
    jobId,
    prompt,
    source: "task",
    status,
    title,
    updatedAt: generatedAt ?? createdAt,
    posterUrl: playbackTargets.videoUrl ? buildWorkspaceProjectPosterUrl(`task:${jobId}`, generatedAt ?? createdAt) : null,
    videoFallbackUrl: playbackTargets.videoFallbackUrl,
    videoUrl: playbackTargets.videoUrl,
    youtubePublication: null,
  };
};

const buildProjectFromHistoryEntry = (item: WorkspaceGenerationHistoryEntry): WorkspaceProject | null => {
  const jobId = normalizeText(item.jobId);
  if (!jobId) return null;

  const prompt = normalizePrompt(item.prompt ?? "");
  const generatedAt = toIsoString(item.generatedAt);
  const createdAt = toIsoString(item.createdAt) ?? generatedAt ?? new Date().toISOString();
  const updatedAt = toIsoString(item.updatedAt) ?? generatedAt ?? createdAt;
  const adId = item.adId && Number.isFinite(Number(item.adId)) ? Number(item.adId) : null;
  const status = normalizeProjectStatus(item.status);
  if (status !== "ready") {
    return null;
  }

  const playbackTargets = buildWorkspaceProjectPlaybackTargets({
    projectId: `task:${jobId}`,
    downloadPath: item.downloadPath,
    jobId,
    version: updatedAt,
  });
  if (!playbackTargets.videoUrl) {
    return null;
  }
  const title = resolveWorkspaceTaskTitle({
    adId,
    prompt,
    title: item.title,
  });
  const description =
    normalizeText(item.description) ||
    prompt ||
    "Описание проекта появится после завершения генерации.";

  return {
    adId,
    createdAt,
    description,
    generatedAt,
    hashtags: [],
    id: `task:${jobId}`,
    jobId,
    prompt,
    source: "task",
    status,
    title,
    updatedAt,
    posterUrl: playbackTargets.videoUrl ? buildWorkspaceProjectPosterUrl(`task:${jobId}`, updatedAt) : null,
    videoFallbackUrl: playbackTargets.videoFallbackUrl,
    videoUrl: playbackTargets.videoUrl,
    youtubePublication: null,
  };
};

const getSortTime = (value: WorkspaceProject) => {
  const timestamp = Date.parse(value.updatedAt || value.createdAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const resolveWorkspaceProjectHistoryVideoTarget = async (jobId: string | null | undefined, user: WorkspaceUser) => {
  const normalizedJobId = normalizeText(jobId);
  if (!normalizedJobId) {
    return null;
  }

  const historyEntries = await listWorkspaceGenerationHistory(user, MAX_PROJECT_FETCH_LIMIT).catch((error) => {
    console.error("[workspace] Failed to load workspace history for project poster", error);
    return [] as WorkspaceGenerationHistoryEntry[];
  });
  const historyEntry =
    historyEntries.find((entry) => normalizeText(entry.jobId) === normalizedJobId) ?? null;
  const downloadPath = normalizeText(historyEntry?.downloadPath);

  return downloadPath ? getWorkspaceProjectVideoProxyTarget(downloadPath) : null;
};

const resolveWorkspaceProjectUpstreamTargetFromVideoUrl = async (
  playbackUrl: string | null | undefined,
  user: WorkspaceUser,
): Promise<URL | null> => {
  const normalizedPlaybackUrl = normalizeText(playbackUrl);
  if (!normalizedPlaybackUrl) {
    return null;
  }

  let resolvedUrl: URL;
  try {
    resolvedUrl = new URL(normalizedPlaybackUrl, env.appUrl);
  } catch {
    return null;
  }

  if (resolvedUrl.pathname === "/api/workspace/project-video" || resolvedUrl.pathname === "/api/studio/video") {
    const path = normalizeText(resolvedUrl.searchParams.get("path"));
    return path ? getWorkspaceProjectVideoProxyTarget(path) : null;
  }

  if (resolvedUrl.pathname.startsWith("/api/studio/video/")) {
    const jobId = decodeURIComponent(resolvedUrl.pathname.slice("/api/studio/video/".length));
    return resolveWorkspaceProjectHistoryVideoTarget(jobId, user);
  }

  if (resolvedUrl.protocol === "http:" || resolvedUrl.protocol === "https:") {
    return resolvedUrl;
  }

  return null;
};

const getWorkspaceProjectPlaybackSource = async (
  project: WorkspaceProject,
  user: WorkspaceUser,
): Promise<WorkspaceProjectPlaybackSource | null> => {
  if (project.status !== "ready" || !project.videoUrl) {
    return null;
  }

  const upstreamUrl = await resolveWorkspaceProjectUpstreamTargetFromVideoUrl(
    project.videoFallbackUrl ?? project.videoUrl,
    user,
  );
  if (!upstreamUrl) {
    return null;
  }

  return {
    cacheKey: getWorkspaceProjectPlaybackCacheKey({
      projectId: project.id,
      targetUrl: upstreamUrl,
      updatedAt: project.updatedAt || project.createdAt,
    }),
    projectId: project.id,
    upstreamUrl,
  };
};

const getWorkspaceProjectPosterSource = async (
  project: WorkspaceProject,
  user: WorkspaceUser,
): Promise<WorkspaceProjectPosterSource | null> => {
  if (project.status !== "ready" || !project.videoUrl || !project.posterUrl) {
    return null;
  }

  for (const candidateUrl of [project.videoFallbackUrl, project.videoUrl]) {
    const upstreamUrl = await resolveWorkspaceProjectUpstreamTargetFromVideoUrl(candidateUrl, user);
    if (!upstreamUrl) {
      continue;
    }

    return {
      cacheKey: getWorkspaceProjectPosterCacheKey({
        projectId: project.id,
        targetUrl: upstreamUrl,
        updatedAt: project.updatedAt || project.createdAt,
      }),
      projectId: project.id,
      upstreamUrl,
    };
  }

  return null;
};

const warmWorkspaceProjectPlaybacks = (projects: WorkspaceProject[], user: WorkspaceUser) => {
  for (const project of projects) {
    if (!project.videoUrl || project.status !== "ready") {
      continue;
    }

    void getWorkspaceProjectPlaybackSource(project, user)
      .then((playbackSource) => {
        if (!playbackSource) {
          return;
        }

        return warmWorkspaceProjectPlayback(playbackSource);
      })
      .catch((error) => {
        console.error("[workspace] Failed to warm project playback cache", {
          error: error instanceof Error ? error.message : "Unknown project playback warmup error.",
          projectId: project.id,
        });
      });
  }
};

const warmWorkspaceProjectPosters = (projects: WorkspaceProject[], user: WorkspaceUser) => {
  for (const project of projects) {
    if (!project.posterUrl || !project.videoUrl || project.status !== "ready") {
      continue;
    }

    void getWorkspaceProjectPosterSource(project, user)
      .then((posterSource) => {
        if (!posterSource) {
          return;
        }

        return warmWorkspaceProjectPoster(posterSource);
      })
      .catch((error) => {
        console.error("[workspace] Failed to warm project poster", {
          error: error instanceof Error ? error.message : "Unknown project poster warmup error.",
          projectId: project.id,
        });
      });
  }
};

const getWorkspaceHistoryEntrySortTime = (entry: WorkspaceGenerationHistoryEntry) => {
  const timestamp = Date.parse(entry.updatedAt || entry.generatedAt || entry.createdAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const isWorkspaceProjectDeleted = (project: WorkspaceProject, deletedProjects: WorkspaceDeletedProjectEntry[]) =>
  deletedProjects.some((deletedProject) => {
    if (deletedProject.projectId && deletedProject.projectId === project.id) {
      return true;
    }

    if (deletedProject.adId !== null && project.adId !== null && deletedProject.adId === project.adId) {
      return true;
    }

    if (deletedProject.jobId && project.jobId && deletedProject.jobId === project.jobId) {
      return true;
    }

    return false;
  });

const loadWorkspaceProjects = async (user: WorkspaceUser, externalUserId: string) => {
  const [bootstrapPayload, deletedProjects] = await Promise.all([
    fetchBootstrapPayload(user, externalUserId),
    listWorkspaceDeletedProjects(user).catch((error) => {
      console.error("[workspace] Failed to load deleted workspace projects", error);
      return [] as WorkspaceDeletedProjectEntry[];
    }),
  ]);
  const fetchLimit = getWorkspaceProjectFetchLimit(deletedProjects.length);
  const historyEntriesPromise = listWorkspaceGenerationHistory(user, fetchLimit).catch((error) => {
      console.error("[workspace] Failed to load local workspace history", error);
      return [] as WorkspaceGenerationHistoryEntry[];
    });
  const adminVideosPromise = bootstrapPayload.remoteUserId
    ? fetchAdminVideos(bootstrapPayload.remoteUserId, fetchLimit)
        .then((items) => ({
          items,
          isFallback: false,
        }))
        .catch((error) => {
          console.warn("[workspace] Failed to load admin videos from AdsFlow, using local fallbacks only", {
            error: error instanceof Error ? error.message : "Unknown AdsFlow admin videos error.",
            fetchLimit,
            remoteUserId: bootstrapPayload.remoteUserId,
          });
          return {
            items: [] as AdsflowAdminVideoItem[],
            isFallback: true,
          };
        })
    : Promise.resolve({
        items: [] as AdsflowAdminVideoItem[],
        isFallback: true,
      });
  const [historyEntries, adminVideosResult] = await Promise.all([historyEntriesPromise, adminVideosPromise]);
  const adminVideos = adminVideosResult.items;
  const shouldUseLocalFallbackProjects = adminVideosResult.isFallback || adminVideos.length === 0;
  const projects = new Map<string, WorkspaceProject>();
  const historyEntriesByAdId = new Map<number, WorkspaceGenerationHistoryEntry>();

  for (const entry of historyEntries) {
    const adId = entry.adId && Number.isFinite(Number(entry.adId)) ? Number(entry.adId) : null;
    if (adId === null) {
      continue;
    }

    const currentEntry = historyEntriesByAdId.get(adId);
    if (!currentEntry || getWorkspaceHistoryEntrySortTime(entry) > getWorkspaceHistoryEntrySortTime(currentEntry)) {
      historyEntriesByAdId.set(adId, entry);
    }
  }

  if (adminVideos.length > 0) {
    for (const item of adminVideos) {
      const adId = Number(item.id ?? 0);
      const historyEntry = Number.isFinite(adId) && adId > 0 ? historyEntriesByAdId.get(adId) ?? null : null;
      const project = buildProjectFromAdminVideo(item, historyEntry);
      if (!project) continue;
      projects.set(project.id, project);
    }
  }

  if (shouldUseLocalFallbackProjects) {
    for (const item of historyEntries) {
      const project = buildProjectFromHistoryEntry(item);
      if (!project) continue;

      const duplicateByAdId =
        project.adId !== null &&
        Array.from(projects.values()).some((existingProject) => existingProject.adId !== null && existingProject.adId === project.adId);

      if (!duplicateByAdId && !projects.has(project.id)) {
        projects.set(project.id, project);
      }
    }
  }

  if (shouldUseLocalFallbackProjects && bootstrapPayload.latest_generation) {
    const latestProject = buildProjectFromLatestGeneration(bootstrapPayload.latest_generation);

    if (latestProject) {
      const duplicateByAdId =
        latestProject.adId !== null &&
        Array.from(projects.values()).some((project) => project.adId !== null && project.adId === latestProject.adId);

      if (!duplicateByAdId && !projects.has(latestProject.id)) {
        projects.set(latestProject.id, latestProject);
      }
    }
  }

  return Array.from(projects.values())
    .filter((project) => !isWorkspaceProjectDeleted(project, deletedProjects))
    .sort((left, right) => getSortTime(right) - getSortTime(left))
    .slice(0, MAX_PROJECTS);
};

export function getWorkspaceProjectVideoProxyTarget(value: string): URL {
  const normalized = normalizeText(value);
  if (!normalized) {
    throw new Error("Project video path is missing.");
  }

  const upstreamUrl = new URL(normalized, getAdsflowBaseUrl());
  const adsflowBaseUrl = new URL(getAdsflowBaseUrl());

  if (!isPlayableWorkspaceVideoPath(normalized)) {
    throw new Error("Project video path is not a direct media file.");
  }

  if (upstreamUrl.origin === adsflowBaseUrl.origin) {
    upstreamUrl.searchParams.set("admin_token", env.adsflowAdminToken ?? "");
  }

  return upstreamUrl;
}

export async function invalidateWorkspaceProjectsCache(user: WorkspaceUser) {
  const cacheKey = await resolvePreferredExternalUserId(user);
  workspaceProjectsCache.delete(cacheKey);
  workspaceProjectsInFlight.delete(cacheKey);
}

export async function getWorkspaceProjects(user: WorkspaceUser): Promise<WorkspaceProject[]> {
  const cacheKey = await resolvePreferredExternalUserId(user);
  const cachedEntry = workspaceProjectsCache.get(cacheKey);

  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    const projects = cloneWorkspaceProjects(cachedEntry.projects);
    warmWorkspaceProjectPlaybacks(projects, user);
    warmWorkspaceProjectPosters(projects, user);
    return projects;
  }

  const inFlightRequest = workspaceProjectsInFlight.get(cacheKey);
  if (inFlightRequest) {
    return cloneWorkspaceProjects(await inFlightRequest);
  }

  const request = loadWorkspaceProjects(user, cacheKey)
    .then((projects) => {
      workspaceProjectsCache.set(cacheKey, {
        expiresAt: Date.now() + PROJECTS_CACHE_TTL_MS,
        projects: cloneWorkspaceProjects(projects),
      });

      warmWorkspaceProjectPlaybacks(projects, user);
      warmWorkspaceProjectPosters(projects, user);
      return projects;
    })
    .finally(() => {
      workspaceProjectsInFlight.delete(cacheKey);
    });

  workspaceProjectsInFlight.set(cacheKey, request);

  return cloneWorkspaceProjects(await request);
}

export async function getWorkspaceProjectPlaybackAsset(
  user: WorkspaceUser,
  projectId: string,
): Promise<WorkspaceProjectPlaybackAsset> {
  const normalizedProjectId = normalizeText(projectId);
  if (!normalizedProjectId) {
    throw new WorkspaceProjectNotFoundError();
  }

  const projects = await getWorkspaceProjects(user);
  const project = projects.find((item) => item.id === normalizedProjectId) ?? null;
  if (!project) {
    throw new WorkspaceProjectNotFoundError();
  }

  const playbackSource = await getWorkspaceProjectPlaybackSource(project, user);
  if (!playbackSource) {
    throw new Error("Project playback source is unavailable.");
  }

  return ensureWorkspaceProjectPlayback(playbackSource);
}

export async function getWorkspaceProjectPosterPath(user: WorkspaceUser, projectId: string): Promise<string> {
  const normalizedProjectId = normalizeText(projectId);
  if (!normalizedProjectId) {
    throw new WorkspaceProjectNotFoundError();
  }

  const projects = await getWorkspaceProjects(user);
  const project = projects.find((item) => item.id === normalizedProjectId) ?? null;
  if (!project) {
    throw new WorkspaceProjectNotFoundError();
  }

  const posterSource = await getWorkspaceProjectPosterSource(project, user);
  if (!posterSource) {
    throw new Error("Project poster source is unavailable.");
  }

  return ensureWorkspaceProjectPoster(posterSource);
}

export async function deleteWorkspaceProject(user: WorkspaceUser, projectId: string): Promise<void> {
  const normalizedProjectId = normalizeText(projectId);
  if (!normalizedProjectId) {
    throw new WorkspaceProjectNotFoundError();
  }

  const projects = await getWorkspaceProjects(user);
  const project = projects.find((item) => item.id === normalizedProjectId) ?? null;
  if (!project) {
    throw new WorkspaceProjectNotFoundError();
  }

  await markWorkspaceProjectDeleted(user, {
    adId: project.adId,
    jobId: project.jobId,
    projectId: project.id,
  });

  await invalidateWorkspaceProjectsCache(user);
}
