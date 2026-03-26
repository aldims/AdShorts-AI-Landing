import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";

type StudioUser = {
  email?: string | null;
  emailVerified?: boolean | null;
  id?: string | null;
  name?: string | null;
};

type AdsflowCreateJobResponse = {
  enqueue_error?: string | null;
  job_id?: string;
  status?: string;
  title?: string;
};

type AdsflowJobStatusResponse = {
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

type AdsflowWebUserPayload = {
  balance?: number;
  plan?: string;
  user_id?: number;
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
  user?: AdsflowWebUserPayload;
};

type AdsflowCreditConsumeResponse = {
  consumed?: {
    purchased?: number;
    subscription?: number;
  };
  user?: AdsflowWebUserPayload;
};

type AdsflowCreditRefundResponse = {
  refunded?: {
    purchased?: number;
    subscription?: number;
  };
  user?: AdsflowWebUserPayload;
};

type WorkspaceCreditConsumption = {
  purchased: number;
  subscription: number;
};

export type WorkspaceProfile = {
  balance: number;
  plan: string;
};

export type WorkspaceBootstrap = {
  latestGeneration: StudioGenerationStatus | null;
  profile: WorkspaceProfile;
};

export class WorkspaceCreditLimitError extends Error {
  constructor(message = "На тарифе FREE доступна 1 бесплатная генерация. Обновите тариф, чтобы продолжить.") {
    super(message);
    this.name = "WorkspaceCreditLimitError";
  }
}

export type StudioGeneration = {
  aspectRatio: string;
  description: string;
  durationLabel: string;
  generatedAt: string;
  hashtags: string[];
  id: string;
  modelLabel: string;
  prompt: string;
  title: string;
  videoUrl: string;
};

export type StudioGenerationJob = {
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
  title: string;
};

export type StudioGenerationStatus = {
  error?: string;
  generation?: StudioGeneration;
  jobId: string;
  status: string;
};

const normalizePrompt = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizeGenerationText = (value: string | null | undefined) => String(value ?? "").replace(/\s+/g, " ").trim();

const parseGenerationHashtags = (value: string | null | undefined) => {
  const rawValue = normalizeGenerationText(value);
  if (!rawValue) return [];

  const explicitTags = rawValue.match(/#[^\s#]+/g);
  if (explicitTags?.length) {
    return Array.from(new Set(explicitTags));
  }

  return Array.from(
    new Set(
      rawValue
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => `#${item.replace(/^#+/, "")}`),
    ),
  );
};

const assertAdsflowConfigured = () => {
  if (!env.adsflowApiBaseUrl || !env.adsflowAdminToken) {
    throw new Error("AdsFlow API is not configured.");
  }
};

const resolveStudioExternalUserId = async (user: StudioUser) => {
  try {
    return (await resolveExternalUserIdentity(user)).preferred;
  } catch {
    return buildExternalUserId(user);
  }
};

const buildAdsflowUrl = (path: string, params?: Record<string, string>) => {
  const url = new URL(path, env.adsflowApiBaseUrl);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  return url;
};

const buildWorkspaceProfile = (payload?: AdsflowWebUserPayload): WorkspaceProfile => ({
  balance: Math.max(0, Number(payload?.balance ?? 1)),
  plan: String(payload?.plan ?? "FREE").trim().toUpperCase() || "FREE",
});

const buildStudioGeneration = (payload: AdsflowJobStatusResponse): StudioGeneration => {
  const prompt = normalizePrompt(payload.prompt ?? "");
  const jobId = String(payload.job_id ?? "");
  const description = normalizeGenerationText(payload.description);
  const hashtags = parseGenerationHashtags(payload.hashtags);
  const title = normalizeGenerationText(payload.title);

  return {
    id: jobId,
    prompt,
    title,
    description,
    hashtags,
    videoUrl: `/api/studio/video/${encodeURIComponent(jobId)}`,
    durationLabel: "Ready",
    modelLabel: "AdsFlow pipeline",
    aspectRatio: "9:16",
    generatedAt: payload.generated_at ?? new Date().toISOString(),
  };
};

const buildStudioGenerationFromLatest = (payload: AdsflowLatestGenerationPayload): StudioGeneration => {
  const prompt = normalizePrompt(payload.prompt ?? "");
  const jobId = String(payload.job_id ?? "");
  const description = normalizeGenerationText(payload.description);
  const hashtags = parseGenerationHashtags(payload.hashtags);
  const title = normalizeGenerationText(payload.title);

  return {
    id: jobId,
    prompt,
    title,
    description,
    hashtags,
    videoUrl: `/api/studio/video/${encodeURIComponent(jobId)}`,
    durationLabel: "Ready",
    modelLabel: "AdsFlow pipeline",
    aspectRatio: "9:16",
    generatedAt: payload.generated_at ?? new Date().toISOString(),
  };
};

const buildLatestGenerationStatus = (
  payload?: AdsflowLatestGenerationPayload | null,
): StudioGenerationStatus | null => {
  if (!payload?.job_id) {
    return null;
  }

  const status = String(payload.status ?? "queued");
  const generationReady = status === "done" && Boolean(String(payload.download_path ?? "").trim());

  return {
    error: payload.error ?? undefined,
    generation: generationReady ? buildStudioGenerationFromLatest(payload) : undefined,
    jobId: String(payload.job_id),
    status,
  };
};

const fetchAdsflowJson = async <T>(url: URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as T | { detail?: string } | null;

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
        ? payload.detail
        : `AdsFlow request failed (${response.status}).`;

    if (response.status === 402) {
      throw new WorkspaceCreditLimitError(detail);
    }

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

const fetchAdsflowJobStatus = async (jobId: string, user: StudioUser) => {
  assertAdsflowConfigured();

  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const externalUserId = await resolveStudioExternalUserId(user);

  return fetchAdsflowJson<AdsflowJobStatusResponse>(
    buildAdsflowUrl(`/api/web/generations/${encodeURIComponent(safeJobId)}`, {
      admin_token: env.adsflowAdminToken ?? "",
      external_user_id: externalUserId,
    }),
  );
};

const consumeWorkspaceGenerationCredit = async (user: StudioUser, amount = 1) => {
  const externalUserId = await resolveStudioExternalUserId(user);
  const payload = await postAdsflowJson<AdsflowCreditConsumeResponse>("/api/web/credits/consume", {
    admin_token: env.adsflowAdminToken,
    amount: Math.max(1, Math.trunc(amount || 1)),
    external_user_id: externalUserId,
    language: "ru",
    referral_source: "landing_site",
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  });

  if (!payload.user || !payload.consumed) {
    throw new Error("AdsFlow did not return consumed web credits.");
  }

  return {
    consumed: {
      purchased: Math.max(0, Number(payload.consumed.purchased ?? 0)),
      subscription: Math.max(0, Number(payload.consumed.subscription ?? 0)),
    } satisfies WorkspaceCreditConsumption,
    profile: buildWorkspaceProfile(payload.user),
  };
};

const refundWorkspaceGenerationCredit = async (
  user: StudioUser,
  consumed: WorkspaceCreditConsumption,
): Promise<WorkspaceProfile> => {
  if (consumed.purchased <= 0 && consumed.subscription <= 0) {
    return buildWorkspaceProfile();
  }

  const externalUserId = await resolveStudioExternalUserId(user);
  const payload = await postAdsflowJson<AdsflowCreditRefundResponse>("/api/web/credits/refund", {
    admin_token: env.adsflowAdminToken,
    consumed_purchased: Math.max(0, Math.trunc(consumed.purchased || 0)),
    consumed_subscription: Math.max(0, Math.trunc(consumed.subscription || 0)),
    external_user_id: externalUserId,
    language: "ru",
    referral_source: "landing_site",
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  });

  if (!payload.user) {
    throw new Error("AdsFlow did not return refunded web profile.");
  }

  return buildWorkspaceProfile(payload.user);
};

export async function getWorkspaceBootstrap(user: StudioUser): Promise<WorkspaceBootstrap> {
  const externalUserId = await resolveStudioExternalUserId(user);
  const payload = await postAdsflowJson<AdsflowBootstrapResponse>("/api/web/bootstrap", {
    admin_token: env.adsflowAdminToken,
    external_user_id: externalUserId,
    language: "ru",
    referral_source: "landing_site",
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  });

  if (!payload.user) {
    throw new Error("AdsFlow did not return web user profile.");
  }

  return {
    latestGeneration: buildLatestGenerationStatus(payload.latest_generation),
    profile: buildWorkspaceProfile(payload.user),
  };
}

export async function createStudioGenerationJob(prompt: string, user: StudioUser): Promise<StudioGenerationJob> {
  assertAdsflowConfigured();

  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const creditReservation = await consumeWorkspaceGenerationCredit(user);
  const externalUserId = await resolveStudioExternalUserId(user);
  let jobCreated = false;

  try {
    const payload = await fetchAdsflowJson<AdsflowCreateJobResponse>(buildAdsflowUrl("/api/web/generations"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        admin_token: env.adsflowAdminToken,
        external_user_id: externalUserId,
        prompt: normalizedPrompt,
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
        language: "ru",
        credit_cost: 0,
      }),
    });

    const jobId = String(payload.job_id ?? "").trim();
    if (!jobId) {
      throw new Error("AdsFlow did not return a job id.");
    }

    jobCreated = true;

    if (payload.enqueue_error) {
      console.warn("[studio] AdsFlow enqueue warning:", payload.enqueue_error);
    }

    return {
      jobId,
      profile: creditReservation.profile,
      status: String(payload.status ?? "queued"),
      title: normalizeGenerationText(payload.title) || "Studio generation",
    };
  } catch (error) {
    if (!jobCreated) {
      try {
        await refundWorkspaceGenerationCredit(user, creditReservation.consumed);
      } catch (refundError) {
        console.error("[studio] Failed to refund reserved credits", refundError);
      }
    }

    throw error;
  }
}

export async function getStudioGenerationStatus(jobId: string, user: StudioUser): Promise<StudioGenerationStatus> {
  const payload = await fetchAdsflowJobStatus(jobId, user);
  const status = String(payload.status ?? "queued");
  const safeJobId = String(payload.job_id ?? jobId).trim();

  if (status === "done") {
    if (!payload.download_path) {
      throw new Error("AdsFlow finished the job without a video path.");
    }

    return {
      jobId: safeJobId,
      status,
      generation: buildStudioGeneration(payload),
    };
  }

  return {
    jobId: safeJobId,
    status,
    error: payload.error ?? undefined,
  };
}

export async function getLatestStudioGeneration(user: StudioUser): Promise<StudioGenerationStatus | null> {
  return (await getWorkspaceBootstrap(user)).latestGeneration;
}

export async function getStudioVideoProxyTarget(jobId: string, user: StudioUser): Promise<URL> {
  const payload = await fetchAdsflowJobStatus(jobId, user);

  if (String(payload.status ?? "") !== "done") {
    throw new Error("Video is not ready yet.");
  }

  const downloadPath = String(payload.download_path ?? "").trim();
  if (!downloadPath) {
    throw new Error("AdsFlow did not return a download path.");
  }

  return buildAdsflowUrl(downloadPath, {
    admin_token: env.adsflowAdminToken ?? "",
  });
}
