import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";

type WorkspaceUser = {
  email?: string | null;
  id?: string | null;
  name?: string | null;
};

type AdsflowPublishChannelPayload = {
  channel_id?: string | null;
  channel_name?: string | null;
  pk?: number | null;
};

type AdsflowYouTubePublicationPayload = {
  channel_name?: string | null;
  channel_pk?: number | null;
  link?: string | null;
  published_at?: string | null;
  scheduled_at?: string | null;
  state?: string | null;
  youtube_video_id?: string | null;
};

type AdsflowPublishBootstrapResponse = {
  channels?: AdsflowPublishChannelPayload[] | null;
  defaults?: {
    description?: string | null;
    hashtags?: string | null;
    publish_at?: string | null;
    title?: string | null;
  } | null;
  publication?: AdsflowYouTubePublicationPayload | null;
  selected_channel_pk?: number | null;
  video_project_id?: number | null;
};

type AdsflowPublishStartResponse = {
  enqueue_error?: string | null;
  job_id?: string | null;
  status?: string | null;
  video_project_id?: number | null;
};

type AdsflowPublishJobStatusResponse = {
  error?: string | null;
  job_id?: string | null;
  publication?: AdsflowYouTubePublicationPayload | null;
  status?: string | null;
  video_project_id?: number | null;
};

type AdsflowYouTubeConnectUrlResponse = {
  url?: string | null;
};

export const normalizeWorkspacePublishStatus = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const isWorkspacePublishSuccessStatus = (status: string) =>
  ["complete", "completed", "done", "published", "scheduled", "success", "succeeded"].includes(
    normalizeWorkspacePublishStatus(status),
  );

export type WorkspaceYouTubePublication = {
  channelName: string | null;
  channelPk: number | null;
  link: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  state: string | null;
  youtubeVideoId: string | null;
};

export type WorkspacePublishChannel = {
  channelId: string | null;
  channelName: string;
  pk: number;
};

export type WorkspacePublishBootstrap = {
  channels: WorkspacePublishChannel[];
  defaults: {
    description: string;
    hashtags: string;
    publishAt: string | null;
    title: string;
  };
  publication: WorkspaceYouTubePublication | null;
  selectedChannelPk: number | null;
  videoProjectId: number;
};

export type WorkspacePublishJob = {
  enqueueError?: string | null;
  jobId: string;
  status: string;
  videoProjectId: number;
};

export type WorkspacePublishJobStatus = {
  error?: string;
  jobId: string;
  publication: WorkspaceYouTubePublication | null;
  status: string;
  videoProjectId: number | null;
};

const ADSFLOW_FETCH_RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 502, 503, 504]);
const ADSFLOW_FETCH_RETRY_DELAYS_MS = [250, 700];
const ADSFLOW_FETCH_TIMEOUT_MS = 20_000;

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const assertAdsflowConfigured = () => {
  if (!env.adsflowApiBaseUrl || !env.adsflowAdminToken) {
    throw new Error("AdsFlow API is not configured.");
  }
};

const buildAdsflowUrl = (path: string, params?: Record<string, string>) => {
  const url = new URL(path, env.adsflowApiBaseUrl);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  return url;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const describeAdsflowFetchFailure = (url: URL, error: unknown) => {
  const target = `${url.origin}${url.pathname}`;
  if (!(error instanceof Error)) {
    return `AdsFlow unavailable for ${target}.`;
  }

  const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
  const causeCode = typeof cause?.code === "string" ? cause.code : "";
  const causeMessage = typeof cause?.message === "string" ? cause.message : "";
  const detail = causeCode || causeMessage || error.message || "Network error";

  return `AdsFlow unavailable for ${target}: ${detail}.`;
};

const fetchAdsflowResponse = async (url: URL, init?: RequestInit): Promise<Response> => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= ADSFLOW_FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(ADSFLOW_FETCH_TIMEOUT_MS),
      });

      if (!ADSFLOW_FETCH_RETRYABLE_STATUS_CODES.has(response.status) || attempt === ADSFLOW_FETCH_RETRY_DELAYS_MS.length) {
        return response;
      }
    } catch (error) {
      lastError = error;

      if (attempt === ADSFLOW_FETCH_RETRY_DELAYS_MS.length) {
        throw new Error(describeAdsflowFetchFailure(url, error));
      }
    }

    await wait(ADSFLOW_FETCH_RETRY_DELAYS_MS[attempt] ?? 0);
  }

  throw new Error(lastError ? describeAdsflowFetchFailure(url, lastError) : `AdsFlow unavailable for ${url.origin}${url.pathname}.`);
};

const fetchAdsflowJson = async <T>(url: URL, init?: RequestInit): Promise<T> => {
  const response = await fetchAdsflowResponse(url, init);
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

const postAdsflowJson = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  assertAdsflowConfigured();

  return fetchAdsflowJson<T>(buildAdsflowUrl(path), {
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

const normalizePublication = (value?: AdsflowYouTubePublicationPayload | null): WorkspaceYouTubePublication | null => {
  if (!value || typeof value !== "object") return null;

  const channelPkRaw = value.channel_pk;
  const channelPk =
    typeof channelPkRaw === "number" && Number.isFinite(channelPkRaw)
      ? channelPkRaw
      : typeof channelPkRaw === "string" && /^\d+$/.test(channelPkRaw)
        ? Number(channelPkRaw)
        : null;

  const normalized = {
    channelName: normalizeText(value.channel_name) || null,
    channelPk,
    link: normalizeText(value.link) || null,
    publishedAt: normalizeText(value.published_at) || null,
    scheduledAt: normalizeText(value.scheduled_at) || null,
    state: normalizeText(value.state).toLowerCase() || null,
    youtubeVideoId: normalizeText(value.youtube_video_id) || null,
  } satisfies WorkspaceYouTubePublication;

  return normalized.link ||
    normalized.youtubeVideoId ||
    normalized.state ||
    normalized.publishedAt ||
    normalized.scheduledAt ||
    normalized.channelName
    ? normalized
    : null;
};

export async function getWorkspacePublishBootstrap(
  user: WorkspaceUser,
  videoProjectId: number,
): Promise<WorkspacePublishBootstrap> {
  const externalUserId = await resolvePreferredExternalUserId(user);
  const payload = await postAdsflowJson<AdsflowPublishBootstrapResponse>("/api/web/publish/bootstrap", {
    admin_token: env.adsflowAdminToken,
    external_user_id: externalUserId,
    language: "ru",
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
    video_project_id: videoProjectId,
  });

  const normalizedVideoProjectId = Number(payload.video_project_id ?? videoProjectId);
  if (!Number.isFinite(normalizedVideoProjectId) || normalizedVideoProjectId <= 0) {
    throw new Error("AdsFlow did not return a valid video project id.");
  }

  const channels = Array.isArray(payload.channels)
    ? payload.channels
        .map((channel) => {
          const pk = Number(channel?.pk ?? 0);
          if (!Number.isFinite(pk) || pk <= 0) return null;
          return {
            channelId: normalizeText(channel?.channel_id) || null,
            channelName: normalizeText(channel?.channel_name) || "YouTube",
            pk,
          } satisfies WorkspacePublishChannel;
        })
        .filter((channel): channel is WorkspacePublishChannel => Boolean(channel))
    : [];

  const selectedChannelPkRaw = Number(payload.selected_channel_pk ?? 0);
  const selectedChannelPk = Number.isFinite(selectedChannelPkRaw) && selectedChannelPkRaw > 0 ? selectedChannelPkRaw : null;

  return {
    channels,
    defaults: {
      description: normalizeText(payload.defaults?.description),
      hashtags: normalizeText(payload.defaults?.hashtags),
      publishAt: normalizeText(payload.defaults?.publish_at) || null,
      title: normalizeText(payload.defaults?.title) || "Shorts",
    },
    publication: normalizePublication(payload.publication),
    selectedChannelPk,
    videoProjectId: normalizedVideoProjectId,
  };
}

export async function getWorkspaceYoutubeConnectUrl(
  user: WorkspaceUser,
  options?: {
    videoProjectId?: number | null;
  },
): Promise<string> {
  const externalUserId = await resolvePreferredExternalUserId(user);
  const returnTo = new URL("/app/studio", env.appUrl);
  const normalizedVideoProjectId = Number(options?.videoProjectId ?? 0);
  if (Number.isFinite(normalizedVideoProjectId) && normalizedVideoProjectId > 0) {
    returnTo.searchParams.set("publish", String(normalizedVideoProjectId));
  }

  const payload = await postAdsflowJson<AdsflowYouTubeConnectUrlResponse>("/api/web/youtube/connect-url", {
    admin_token: env.adsflowAdminToken,
    external_user_id: externalUserId,
    language: "ru",
    return_to: returnTo.toString(),
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
    video_project_id: Number.isFinite(normalizedVideoProjectId) && normalizedVideoProjectId > 0 ? normalizedVideoProjectId : undefined,
  });

  const url = normalizeText(payload.url);
  if (!url) {
    throw new Error("AdsFlow did not return YouTube connect url.");
  }

  return url;
}

export async function disconnectWorkspaceYoutubeChannel(
  user: WorkspaceUser,
  options: {
    channelPk: number;
    videoProjectId: number;
  },
): Promise<WorkspacePublishBootstrap> {
  const externalUserId = await resolvePreferredExternalUserId(user);
  const payload = await postAdsflowJson<AdsflowPublishBootstrapResponse>("/api/web/youtube/disconnect", {
    admin_token: env.adsflowAdminToken,
    channel_pk: options.channelPk,
    external_user_id: externalUserId,
    language: "ru",
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
    video_project_id: options.videoProjectId,
  });

  const normalizedVideoProjectId = Number(payload.video_project_id ?? options.videoProjectId);
  if (!Number.isFinite(normalizedVideoProjectId) || normalizedVideoProjectId <= 0) {
    throw new Error("AdsFlow did not return a valid video project id.");
  }

  const channels = Array.isArray(payload.channels)
    ? payload.channels
        .map((channel) => {
          const pk = Number(channel?.pk ?? 0);
          if (!Number.isFinite(pk) || pk <= 0) return null;
          return {
            channelId: normalizeText(channel?.channel_id) || null,
            channelName: normalizeText(channel?.channel_name) || "YouTube",
            pk,
          } satisfies WorkspacePublishChannel;
        })
        .filter((channel): channel is WorkspacePublishChannel => Boolean(channel))
    : [];

  const selectedChannelPkRaw = Number(payload.selected_channel_pk ?? 0);
  const selectedChannelPk = Number.isFinite(selectedChannelPkRaw) && selectedChannelPkRaw > 0 ? selectedChannelPkRaw : null;

  return {
    channels,
    defaults: {
      description: normalizeText(payload.defaults?.description),
      hashtags: normalizeText(payload.defaults?.hashtags),
      publishAt: normalizeText(payload.defaults?.publish_at) || null,
      title: normalizeText(payload.defaults?.title) || "Shorts",
    },
    publication: normalizePublication(payload.publication),
    selectedChannelPk,
    videoProjectId: normalizedVideoProjectId,
  };
}

export async function startWorkspaceYoutubePublish(
  user: WorkspaceUser,
  options: {
    channelPk: number;
    description: string;
    hashtags: string;
    publishAt: string | null;
    title: string;
    videoProjectId: number;
  },
): Promise<WorkspacePublishJob> {
  const externalUserId = await resolvePreferredExternalUserId(user);
  const payload = await postAdsflowJson<AdsflowPublishStartResponse>("/api/web/publish/youtube", {
    admin_token: env.adsflowAdminToken,
    channel_pk: options.channelPk,
    description: options.description,
    external_user_id: externalUserId,
    hashtags: options.hashtags,
    language: "ru",
    publish_at: options.publishAt || undefined,
    title: options.title,
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
    video_project_id: options.videoProjectId,
  });

  const jobId = normalizeText(payload.job_id);
  if (!jobId) {
    throw new Error("AdsFlow did not return a publish job id.");
  }

  const enqueueError = normalizeText(payload.enqueue_error) || null;
  if (enqueueError) {
    throw new Error(enqueueError);
  }

  return {
    enqueueError,
    jobId,
    status: normalizeText(payload.status) || "queued",
    videoProjectId: Number(payload.video_project_id ?? options.videoProjectId) || options.videoProjectId,
  };
}

export async function getWorkspacePublishJobStatus(
  user: WorkspaceUser,
  jobId: string,
): Promise<WorkspacePublishJobStatus> {
  const externalUserId = await resolvePreferredExternalUserId(user);
  const payload = await fetchAdsflowJson<AdsflowPublishJobStatusResponse>(
    buildAdsflowUrl(`/api/web/publish/jobs/${encodeURIComponent(jobId)}`, {
      admin_token: env.adsflowAdminToken ?? "",
      external_user_id: externalUserId,
    }),
  );

  return {
    error: normalizeText(payload.error) || undefined,
    jobId: normalizeText(payload.job_id) || jobId,
    publication: normalizePublication(payload.publication),
    status: normalizeText(payload.status) || "queued",
    videoProjectId: Number(payload.video_project_id ?? 0) || null,
  };
}
