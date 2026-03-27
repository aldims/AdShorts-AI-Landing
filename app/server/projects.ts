import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
import { listWorkspaceGenerationHistory, type WorkspaceGenerationHistoryEntry } from "./workspace-history.js";

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
};

type AdsflowAdminVideosResponse = {
  items?: AdsflowAdminVideoItem[];
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
  videoUrl: string | null;
};

const MAX_PROJECTS = 60;
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

const extractErrorDetail = (value: string) => {
  const payload = parseJson(value);
  if (!payload || typeof payload !== "object") {
    const normalized = normalizeText(value);
    return normalized && !normalized.startsWith("<") ? normalized : null;
  }

  const detail = payload.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  const error = payload.error;
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return null;
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
});

const cloneWorkspaceProjects = (projects: WorkspaceProject[]) => projects.map(cloneWorkspaceProject);

const buildPromptTitle = (prompt: string, fallback = "Проект") => {
  const normalized = normalizePrompt(prompt);

  if (!normalized) return fallback;
  if (normalized.length <= 72) return normalized;

  const compact = normalized.slice(0, 69).trim();
  return compact ? `${compact}...` : fallback;
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

const buildAbsoluteAdsflowUrl = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  try {
    return new URL(normalized, getAdsflowBaseUrl()).toString();
  } catch {
    return normalized;
  }
};

const buildWorkspaceProjectVideoProxyUrl = (value: string | null | undefined) => {
  const resolvedUrl = buildAbsoluteAdsflowUrl(value);
  if (!resolvedUrl) return null;

  const proxyUrl = new URL("/api/workspace/project-video", env.appUrl);
  proxyUrl.searchParams.set("path", resolvedUrl);
  return `${proxyUrl.pathname}${proxyUrl.search}`;
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
  const payload = (await response.json().catch(() => null)) as T | { detail?: string } | null;

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
        ? payload.detail
        : `AdsFlow request failed (${response.status}).`;

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

const fetchAdminVideos = async (userId: string) => {
  const url = new URL("/api/admin/videos", getAdsflowBaseUrl());
  url.searchParams.set("user_id", userId);
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", String(MAX_PROJECTS));

  const payload = await fetchAdsflowJson<AdsflowAdminVideosResponse>(url, {
    headers: {
      "X-Admin-Token": env.adsflowAdminToken ?? "",
    },
  });

  return payload.items ?? [];
};

const buildProjectFromAdminVideo = (item: AdsflowAdminVideoItem): WorkspaceProject | null => {
  const adId = Number(item.id ?? 0);
  if (!Number.isFinite(adId) || adId <= 0) return null;

  const prompt = normalizePrompt(item.description ?? "");
  const createdAt = toIsoString(item.created_at) ?? new Date().toISOString();
  const description = normalizeText(item.description) || prompt || "Описание проекта недоступно.";

  return {
    adId,
    createdAt,
    description,
    generatedAt: createdAt,
    hashtags: [],
    id: `project:${adId}`,
    jobId: null,
    prompt,
    source: "project",
    status: normalizeProjectStatus(item.status),
    title: normalizeText(item.ai_title) || buildPromptTitle(prompt, `Проект #${adId}`),
    updatedAt: createdAt,
    videoUrl: buildWorkspaceProjectVideoProxyUrl(item.download_path),
  };
};

const buildProjectFromLatestGeneration = (item: AdsflowLatestGenerationPayload): WorkspaceProject | null => {
  const jobId = normalizeText(item.job_id);
  if (!jobId) return null;

  const prompt = normalizePrompt(item.prompt ?? "");
  const generatedAt = toIsoString(item.generated_at);
  const createdAt = generatedAt ?? new Date().toISOString();
  const adId = item.ad_id && Number.isFinite(Number(item.ad_id)) ? Number(item.ad_id) : null;
  const title = normalizeText(item.title) || buildPromptTitle(prompt, adId ? `Проект #${adId}` : "Проект");
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
    status: normalizeProjectStatus(item.status),
    title,
    updatedAt: generatedAt ?? createdAt,
    videoUrl: normalizeProjectStatus(item.status) === "ready" ? buildWorkspaceProjectVideoProxyUrl(item.download_path) : null,
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
  const title = normalizeText(item.title) || buildPromptTitle(prompt, adId ? `Проект #${adId}` : "Проект");
  const description =
    normalizeText(item.description) ||
    prompt ||
    (status === "failed" ? "Генерация не завершилась успешно." : "Описание проекта появится после завершения генерации.");

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
    videoUrl: status === "ready" ? buildWorkspaceProjectVideoProxyUrl(item.downloadPath) : null,
  };
};

const getSortTime = (value: WorkspaceProject) => {
  const timestamp = Date.parse(value.updatedAt || value.createdAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const loadWorkspaceProjects = async (user: WorkspaceUser, externalUserId: string) => {
  const [bootstrapPayload, historyEntries] = await Promise.all([
    fetchBootstrapPayload(user, externalUserId),
    listWorkspaceGenerationHistory(user, MAX_PROJECTS).catch((error) => {
      console.error("[workspace] Failed to load local workspace history", error);
      return [] as WorkspaceGenerationHistoryEntry[];
    }),
  ]);
  const projects = new Map<string, WorkspaceProject>();

  if (bootstrapPayload.remoteUserId) {
    for (const item of await fetchAdminVideos(bootstrapPayload.remoteUserId)) {
      const project = buildProjectFromAdminVideo(item);
      if (!project) continue;
      projects.set(project.id, project);
    }
  }

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

  if (bootstrapPayload.latest_generation) {
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
    return cloneWorkspaceProjects(cachedEntry.projects);
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

      return projects;
    })
    .finally(() => {
      workspaceProjectsInFlight.delete(cacheKey);
    });

  workspaceProjectsInFlight.set(cacheKey, request);

  return cloneWorkspaceProjects(await request);
}
