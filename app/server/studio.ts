import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
import { getWorkspaceProjects, type WorkspaceProject } from "./projects.js";
import { saveWorkspaceGenerationHistory } from "./workspace-history.js";

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
  subscription_expires_at?: string | null;
  user_id?: number | string | null;
};

type AdsflowAdminUserDetailsResponse = {
  user?: {
    subscription_type?: string | null;
    subscription_expires_at?: string | null;
  };
  payments?: Array<{
    paid_at?: string | null;
    plan_code?: string | null;
    status?: string | null;
  }>;
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

type AdsflowSubtitleStylePayload = {
  default_color?: string | null;
  description?: string | null;
  font_family?: string | null;
  font_size?: number | null;
  id?: string | null;
  label?: string | null;
  logic_mode?: string | null;
  margin_bottom?: number | null;
  outline_width?: number | null;
  position?: string | null;
  transition_mode?: string | null;
  uses_accent_color?: boolean | null;
  window_size?: number | null;
  word_effect?: string | null;
};

type AdsflowSubtitleColorPayload = {
  hex?: string | null;
  id?: string | null;
  label?: string | null;
};

type AdsflowStudioOptionsPayload = {
  subtitle_colors?: AdsflowSubtitleColorPayload[] | null;
  subtitle_styles?: AdsflowSubtitleStylePayload[] | null;
};

type AdsflowBootstrapResponse = {
  latest_generation?: AdsflowLatestGenerationPayload | null;
  studio_options?: AdsflowStudioOptionsPayload | null;
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
  expiresAt: string | null;
  plan: string;
};

export type WorkspaceSubtitleStyleOption = {
  defaultColorId: string;
  description: string;
  fontFamily: string;
  fontSize: number;
  id: string;
  label: string;
  logicMode: string;
  marginBottom: number;
  outlineWidth: number;
  position: string;
  transitionMode: string;
  usesAccentColor: boolean;
  windowSize: number;
  wordEffect: string;
};

export type WorkspaceSubtitleColorOption = {
  hex: string;
  id: string;
  label: string;
};

export type WorkspaceStudioOptions = {
  subtitleColors: WorkspaceSubtitleColorOption[];
  subtitleStyles: WorkspaceSubtitleStyleOption[];
};

export type WorkspaceBootstrap = {
  latestGeneration: StudioGenerationStatus | null;
  profile: WorkspaceProfile;
  studioOptions: WorkspaceStudioOptions;
};

export class WorkspaceCreditLimitError extends Error {
  constructor(message = "На тарифе FREE доступна 1 бесплатная генерация. Обновите тариф, чтобы продолжить.") {
    super(message);
    this.name = "WorkspaceCreditLimitError";
  }
}

export type StudioGeneration = {
  adId: number | null;
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

const studioSupportedMusicTypes = new Set([
  "ai",
  "business",
  "calm",
  "custom",
  "dramatic",
  "energetic",
  "fun",
  "inspirational",
  "luxury",
  "none",
  "tech",
  "upbeat",
]);

const studioSupportedSubtitleStyleIds = new Set([
  "modern",
  "impact",
  "story",
  "editorial",
  "cinema",
  "karaoke",
]);

const studioSupportedSubtitleColorIds = new Set([
  "purple",
  "yellow",
  "orange",
  "pink",
  "blue",
  "cyan",
  "green",
  "red",
  "gold",
  "white",
  "black",
]);

const studioSupportedVideoModes = new Set([
  "ai_photo",
  "ai_video",
  "custom",
  "standard",
]);

const studioSupportedLanguages = new Set(["en", "ru"]);

const normalizePrompt = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizeGenerationText = (value: string | null | undefined) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizeStudioMusicType = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return studioSupportedMusicTypes.has(normalized) ? normalized : "ai";
};

const normalizeStudioSubtitleStyle = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return studioSupportedSubtitleStyleIds.has(normalized) ? normalized : "modern";
};

const normalizeStudioSubtitleColor = (value: string | null | undefined, fallback = "purple") => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (studioSupportedSubtitleColorIds.has(normalized)) {
    return normalized;
  }

  const normalizedFallback = String(fallback ?? "").trim().toLowerCase();
  return studioSupportedSubtitleColorIds.has(normalizedFallback) ? normalizedFallback : "purple";
};

const getDefaultStudioSubtitleColorForStyle = (styleId: string) =>
  fallbackWorkspaceStudioOptions.subtitleStyles.find((style) => style.id === styleId)?.defaultColorId ?? "purple";

const normalizeStudioVideoMode = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return studioSupportedVideoModes.has(normalized) ? normalized : "standard";
};

const normalizeStudioLanguage = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return studioSupportedLanguages.has(normalized) ? normalized : "ru";
};

const parseJson = <T>(value: string) => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const extractErrorDetail = (value: string) => {
  const payload = parseJson<{ detail?: unknown; error?: unknown }>(value);
  if (!payload || typeof payload !== "object") {
    const normalized = normalizeGenerationText(value);
    return normalized && !normalized.startsWith("<") ? normalized : null;
  }

  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail.trim();
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }

  return null;
};

const extractAdsflowUserId = (value: string) => {
  const exactUserMatch = value.match(/"user"\s*:\s*\{[\s\S]*?"user_id"\s*:\s*(\d+)/);
  if (exactUserMatch?.[1]) {
    return exactUserMatch[1].trim();
  }

  const fallbackMatch = value.match(/"user_id"\s*:\s*(\d+)/);
  return fallbackMatch?.[1]?.trim() || null;
};

const fallbackWorkspaceStudioOptions: WorkspaceStudioOptions = {
  subtitleStyles: [
    {
      defaultColorId: "purple",
      description: "Текущий дефолт для Shorts на Manrope.",
      fontFamily: "Manrope",
      fontSize: 96,
      id: "modern",
      label: "Modern",
      logicMode: "block",
      marginBottom: 420,
      outlineWidth: 3,
      position: "bottom_center",
      transitionMode: "hard_cut",
      usesAccentColor: true,
      windowSize: 3,
      wordEffect: "none",
    },
    {
      defaultColorId: "yellow",
      description: "Агрессивный viral-стиль с тяжелым контуром и плотной посадкой.",
      fontFamily: "Manrope",
      fontSize: 108,
      id: "impact",
      label: "Impact",
      logicMode: "block",
      marginBottom: 300,
      outlineWidth: 4,
      position: "bottom_center",
      transitionMode: "hard_cut",
      usesAccentColor: true,
      windowSize: 3,
      wordEffect: "scale",
    },
    {
      defaultColorId: "pink",
      description: "Мягкий social/UGC стиль с более легкой анимацией.",
      fontFamily: "Manrope",
      fontSize: 84,
      id: "story",
      label: "Story",
      logicMode: "block",
      marginBottom: 360,
      outlineWidth: 2,
      position: "bottom_center",
      transitionMode: "slide_up",
      usesAccentColor: true,
      windowSize: 4,
      wordEffect: "slide",
    },
    {
      defaultColorId: "blue",
      description: "Спокойный explanatory-пресет с большим количеством воздуха.",
      fontFamily: "DejaVu Sans",
      fontSize: 72,
      id: "editorial",
      label: "Editorial",
      logicMode: "sliding",
      marginBottom: 240,
      outlineWidth: 2,
      position: "bottom_center",
      transitionMode: "soft_fade",
      usesAccentColor: true,
      windowSize: 6,
      wordEffect: "fade",
    },
    {
      defaultColorId: "white",
      description: "Чистый lower-third с мягким crossfade без цветового акцента.",
      fontFamily: "DejaVu Sans",
      fontSize: 68,
      id: "cinema",
      label: "Cinema",
      logicMode: "crossfade",
      marginBottom: 190,
      outlineWidth: 1,
      position: "bottom_center",
      transitionMode: "soft_crossfade",
      usesAccentColor: false,
      windowSize: 7,
      wordEffect: "none",
    },
    {
      defaultColorId: "orange",
      description: "Фразовый caption с явной подсветкой активного слова.",
      fontFamily: "Manrope",
      fontSize: 86,
      id: "karaoke",
      label: "Karaoke",
      logicMode: "phrase",
      marginBottom: 235,
      outlineWidth: 3,
      position: "bottom_center",
      transitionMode: "karaoke_follow",
      usesAccentColor: true,
      windowSize: 8,
      wordEffect: "fade",
    },
  ],
  subtitleColors: [
    { hex: "8B5CF6", id: "purple", label: "Фиолетовый" },
    { hex: "EAB308", id: "yellow", label: "Желтый" },
    { hex: "F97316", id: "orange", label: "Оранжевый" },
    { hex: "EC4899", id: "pink", label: "Розовый" },
    { hex: "3B82F6", id: "blue", label: "Синий" },
    { hex: "06B6D4", id: "cyan", label: "Голубой" },
    { hex: "10B981", id: "green", label: "Зеленый" },
    { hex: "EF4444", id: "red", label: "Красный" },
    { hex: "FFD700", id: "gold", label: "Золотой" },
    { hex: "FFFFFF", id: "white", label: "Белый" },
    { hex: "000000", id: "black", label: "Черный" },
  ],
};

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

const isPlayableStudioVideoPath = (value: string | null | undefined) => {
  const normalized = normalizeGenerationText(value);
  if (!normalized) return false;

  try {
    const resolvedUrl = buildAdsflowUrl(normalized);
    const hostname = resolvedUrl.hostname.toLowerCase();
    const pathname = resolvedUrl.pathname.toLowerCase();

    if (hostname === "youtu.be" || hostname.endsWith(".youtube.com") || hostname === "youtube.com") {
      return false;
    }

    return (
      pathname.includes("/api/video/download/") ||
      /\.(mp4|mov|webm|m4v)$/i.test(pathname)
    );
  } catch {
    return false;
  }
};

const buildStudioVideoProxyUrl = (value: string | null | undefined) => {
  const normalized = normalizeGenerationText(value);
  if (!normalized) {
    return null;
  }

  if (!isPlayableStudioVideoPath(normalized)) {
    return null;
  }

  const upstreamUrl = buildAdsflowUrl(normalized);
  const proxyUrl = new URL("/api/studio/video", env.appUrl);
  proxyUrl.searchParams.set("path", upstreamUrl.toString());
  return `${proxyUrl.pathname}${proxyUrl.search}`;
};

const buildWorkspaceProfile = (payload?: AdsflowWebUserPayload): WorkspaceProfile => ({
  balance: Math.max(0, Number(payload?.balance ?? 0)),
  expiresAt: normalizeGenerationText(payload?.subscription_expires_at) || null,
  plan: String(payload?.plan ?? "FREE").trim().toUpperCase() || "FREE",
});

const buildWorkspaceStudioOptions = (payload?: AdsflowStudioOptionsPayload | null): WorkspaceStudioOptions => {
  const subtitleStyles = Array.isArray(payload?.subtitle_styles)
    ? payload.subtitle_styles
        .map((style) => {
          const id = normalizeStudioSubtitleStyle(style?.id);
          return {
            defaultColorId: normalizeStudioSubtitleColor(style?.default_color, "purple"),
            description: normalizeGenerationText(style?.description) || "Subtitle style",
            fontFamily: normalizeGenerationText(style?.font_family) || "Manrope",
            fontSize: Math.max(32, Number(style?.font_size ?? 96) || 96),
            id,
            label: normalizeGenerationText(style?.label) || id,
            logicMode: normalizeGenerationText(style?.logic_mode) || "block",
            marginBottom: Math.max(0, Number(style?.margin_bottom ?? 240) || 240),
            outlineWidth: Math.max(0, Number(style?.outline_width ?? 2) || 2),
            position: normalizeGenerationText(style?.position) || "bottom_center",
            transitionMode: normalizeGenerationText(style?.transition_mode) || "hard_cut",
            usesAccentColor: Boolean(style?.uses_accent_color ?? true),
            windowSize: Math.max(1, Number(style?.window_size ?? 3) || 3),
            wordEffect: normalizeGenerationText(style?.word_effect) || "none",
          } satisfies WorkspaceSubtitleStyleOption;
        })
        .filter((style, index, list) => list.findIndex((candidate) => candidate.id === style.id) === index)
    : [];

  const subtitleColors = Array.isArray(payload?.subtitle_colors)
    ? payload.subtitle_colors
        .map((color) => {
          const id = normalizeStudioSubtitleColor(color?.id);
          const hex = String(color?.hex ?? "").replace(/[^a-fA-F0-9]/g, "").slice(0, 6).toUpperCase();
          return {
            hex: hex.length === 6 ? hex : fallbackWorkspaceStudioOptions.subtitleColors.find((item) => item.id === id)?.hex ?? "8B5CF6",
            id,
            label: normalizeGenerationText(color?.label) || id,
          } satisfies WorkspaceSubtitleColorOption;
        })
        .filter((color, index, list) => list.findIndex((candidate) => candidate.id === color.id) === index)
    : [];

  return {
    subtitleStyles: subtitleStyles.length ? subtitleStyles : fallbackWorkspaceStudioOptions.subtitleStyles,
    subtitleColors: subtitleColors.length ? subtitleColors : fallbackWorkspaceStudioOptions.subtitleColors,
  };
};

const fetchAdsflowSubscriptionExpiry = async (userId: string | number | null | undefined) => {
  const normalizedUserId = String(userId ?? "").trim();
  if (!/^\d+$/.test(normalizedUserId)) {
    return null;
  }

  const payload = await fetchAdsflowJson<AdsflowAdminUserDetailsResponse>(
    buildAdsflowUrl(`/api/admin/users/${encodeURIComponent(normalizedUserId)}`),
    {
      headers: {
        "X-Admin-Token": env.adsflowAdminToken ?? "",
      },
    },
  );

  const directExpiry = normalizeGenerationText(payload.user?.subscription_expires_at) || null;
  if (directExpiry) {
    return directExpiry;
  }

  const currentPlan = String(payload.user?.subscription_type ?? "").trim().toLowerCase();
  const planDurationDays =
    currentPlan === "start" ? 30 : currentPlan === "pro" ? 30 : currentPlan === "ultra" ? 30 : 0;
  if (!planDurationDays || !Array.isArray(payload.payments)) {
    return null;
  }

  const latestSuccessfulPayment = payload.payments
    .filter((payment) => String(payment?.status ?? "").trim().toLowerCase() === "succeeded")
    .filter((payment) => String(payment?.plan_code ?? "").trim().toLowerCase() === currentPlan)
    .map((payment) => {
      const paidAt = normalizeGenerationText(payment.paid_at);
      const parsedPaidAt = paidAt ? new Date(paidAt) : null;
      return Number.isNaN(parsedPaidAt?.getTime?.() ?? Number.NaN) ? null : parsedPaidAt;
    })
    .filter((value): value is Date => value instanceof Date)
    .sort((left, right) => right.getTime() - left.getTime())[0];

  if (!latestSuccessfulPayment) {
    return null;
  }

  const derivedExpiry = new Date(latestSuccessfulPayment.getTime());
  derivedExpiry.setUTCDate(derivedExpiry.getUTCDate() + planDurationDays);
  return derivedExpiry.toISOString();
};

const enrichWorkspaceProfile = async (
  payload?: AdsflowWebUserPayload,
  options?: { rawUserId?: string | null },
): Promise<WorkspaceProfile> => {
  const profile = buildWorkspaceProfile(payload);
  if (profile.plan === "FREE" || profile.expiresAt) {
    return profile;
  }

  try {
    const expiresAt = await fetchAdsflowSubscriptionExpiry(options?.rawUserId ?? payload?.user_id);
    return {
      ...profile,
      expiresAt,
    };
  } catch (error) {
    console.error("[studio] Failed to enrich workspace profile with expiry", error);
    return profile;
  }
};

const buildStudioGeneration = (payload: AdsflowJobStatusResponse): StudioGeneration | null => {
  const prompt = normalizePrompt(payload.prompt ?? "");
  const jobId = String(payload.job_id ?? "");
  const description = normalizeGenerationText(payload.description);
  const hashtags = parseGenerationHashtags(payload.hashtags);
  const title = normalizeGenerationText(payload.title);
  const videoUrl = buildStudioVideoProxyUrl(payload.download_path);

  if (!videoUrl) {
    return null;
  }

  return {
    adId: payload.ad_id ?? null,
    id: jobId,
    prompt,
    title,
    description,
    hashtags,
    videoUrl,
    durationLabel: "Ready",
    modelLabel: "AdsFlow pipeline",
    aspectRatio: "9:16",
    generatedAt: payload.generated_at ?? new Date().toISOString(),
  };
};

const buildStudioGenerationFromLatest = (payload: AdsflowLatestGenerationPayload): StudioGeneration | null => {
  const prompt = normalizePrompt(payload.prompt ?? "");
  const jobId = String(payload.job_id ?? "");
  const description = normalizeGenerationText(payload.description);
  const hashtags = parseGenerationHashtags(payload.hashtags);
  const title = normalizeGenerationText(payload.title);
  const videoUrl = buildStudioVideoProxyUrl(payload.download_path);

  if (!videoUrl) {
    return null;
  }

  return {
    adId: payload.ad_id ?? null,
    id: jobId,
    prompt,
    title,
    description,
    hashtags,
    videoUrl,
    durationLabel: "Ready",
    modelLabel: "AdsFlow pipeline",
    aspectRatio: "9:16",
    generatedAt: payload.generated_at ?? new Date().toISOString(),
  };
};

const buildStudioGenerationFromWorkspaceProject = (project: WorkspaceProject): StudioGeneration | null => {
  const videoUrl = normalizeGenerationText(project.videoUrl);

  if (!videoUrl) {
    return null;
  }

  return {
    adId: project.adId,
    aspectRatio: "9:16",
    description: normalizeGenerationText(project.description),
    durationLabel: "Ready",
    generatedAt: project.generatedAt ?? project.updatedAt ?? project.createdAt,
    hashtags: [...project.hashtags],
    id: normalizeGenerationText(project.jobId) || project.id,
    modelLabel: "AdsFlow pipeline",
    prompt: normalizePrompt(project.prompt),
    title: normalizeGenerationText(project.title),
    videoUrl,
  };
};

const buildLatestGenerationStatus = (
  payload?: AdsflowLatestGenerationPayload | null,
): StudioGenerationStatus | null => {
  if (!payload?.job_id) {
    return null;
  }

  const status = String(payload.status ?? "queued");
  const generation = status === "done" ? buildStudioGenerationFromLatest(payload) : null;

  return {
    error: payload.error ?? undefined,
    generation: generation ?? undefined,
    jobId: String(payload.job_id),
    status,
  };
};

const ADSFLOW_FETCH_RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 502, 503, 504]);
const ADSFLOW_FETCH_RETRY_DELAYS_MS = [250, 700];
const ADSFLOW_FETCH_TIMEOUT_MS = 20_000;

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

      console.warn(
        `[studio] AdsFlow responded with ${response.status} for ${url.pathname}, retry ${attempt + 1}/${ADSFLOW_FETCH_RETRY_DELAYS_MS.length}`,
      );
    } catch (error) {
      lastError = error;

      if (attempt === ADSFLOW_FETCH_RETRY_DELAYS_MS.length) {
        throw new Error(describeAdsflowFetchFailure(url, error));
      }

      console.warn(
        `[studio] AdsFlow fetch error for ${url.pathname}, retry ${attempt + 1}/${ADSFLOW_FETCH_RETRY_DELAYS_MS.length}`,
        error,
      );
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

const postAdsflowText = async (path: string, body: Record<string, unknown>) => {
  assertAdsflowConfigured();

  const response = await fetchAdsflowResponse(buildAdsflowUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.text();
  if (!response.ok) {
    const detail = extractErrorDetail(payload) ?? `AdsFlow request failed (${response.status}).`;

    if (response.status === 402) {
      throw new WorkspaceCreditLimitError(detail);
    }

    throw new Error(detail);
  }

  if (!payload) {
    throw new Error("AdsFlow returned an empty response.");
  }

  return payload;
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

const consumeWorkspaceGenerationCredit = async (user: StudioUser, amount = 1, language?: string) => {
  const externalUserId = await resolveStudioExternalUserId(user);
  const payloadText = await postAdsflowText("/api/web/credits/consume", {
    admin_token: env.adsflowAdminToken,
    amount: Math.max(1, Math.trunc(amount || 1)),
    external_user_id: externalUserId,
    language: normalizeStudioLanguage(language),
    referral_source: "landing_site",
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  });
  const payload = parseJson<AdsflowCreditConsumeResponse>(payloadText);

  if (!payload?.user || !payload.consumed) {
    throw new Error("AdsFlow did not return consumed web credits.");
  }

  return {
    consumed: {
      purchased: Math.max(0, Number(payload.consumed.purchased ?? 0)),
      subscription: Math.max(0, Number(payload.consumed.subscription ?? 0)),
    } satisfies WorkspaceCreditConsumption,
    profile: await enrichWorkspaceProfile(payload.user, {
      rawUserId: extractAdsflowUserId(payloadText),
    }),
  };
};

const refundWorkspaceGenerationCredit = async (
  user: StudioUser,
  consumed: WorkspaceCreditConsumption,
  language?: string,
): Promise<WorkspaceProfile> => {
  if (consumed.purchased <= 0 && consumed.subscription <= 0) {
    return buildWorkspaceProfile();
  }

  const externalUserId = await resolveStudioExternalUserId(user);
  const payloadText = await postAdsflowText("/api/web/credits/refund", {
    admin_token: env.adsflowAdminToken,
    consumed_purchased: Math.max(0, Math.trunc(consumed.purchased || 0)),
    consumed_subscription: Math.max(0, Math.trunc(consumed.subscription || 0)),
    external_user_id: externalUserId,
    language: normalizeStudioLanguage(language),
    referral_source: "landing_site",
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  });
  const payload = parseJson<AdsflowCreditRefundResponse>(payloadText);

  if (!payload?.user) {
    throw new Error("AdsFlow did not return refunded web profile.");
  }

  return await enrichWorkspaceProfile(payload.user, {
    rawUserId: extractAdsflowUserId(payloadText),
  });
};

export async function getWorkspaceBootstrap(user: StudioUser): Promise<WorkspaceBootstrap> {
  const externalUserId = await resolveStudioExternalUserId(user);
  const payloadText = await postAdsflowText("/api/web/bootstrap", {
    admin_token: env.adsflowAdminToken,
    external_user_id: externalUserId,
    language: "ru",
    referral_source: "landing_site",
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  });
  const payload = parseJson<AdsflowBootstrapResponse>(payloadText);

  if (!payload?.user) {
    throw new Error("AdsFlow did not return web user profile.");
  }

  const profile = await enrichWorkspaceProfile(payload.user, {
    rawUserId: extractAdsflowUserId(payloadText),
  });

  if (payload.latest_generation?.job_id) {
    try {
      await saveWorkspaceGenerationHistory(user, {
        adId: payload.latest_generation.ad_id ?? null,
        description: payload.latest_generation.description ?? payload.latest_generation.prompt ?? "",
        downloadPath: payload.latest_generation.download_path ?? null,
        error: payload.latest_generation.error ?? null,
        generatedAt: payload.latest_generation.generated_at ?? null,
        jobId: payload.latest_generation.job_id,
        prompt: payload.latest_generation.prompt ?? "",
        status: payload.latest_generation.status ?? "queued",
        title: payload.latest_generation.title ?? payload.latest_generation.prompt ?? "",
        updatedAt: payload.latest_generation.generated_at ?? new Date().toISOString(),
      });
    } catch (error) {
      console.error("[studio] Failed to sync workspace history from bootstrap", error);
    }
  }

  let latestGeneration = buildLatestGenerationStatus(payload.latest_generation);

  if (!latestGeneration?.generation && (!latestGeneration || latestGeneration.status === "done")) {
    try {
      const fallbackProject = (await getWorkspaceProjects(user)).find(
        (project) => project.status === "ready" && Boolean(project.videoUrl),
      );
      const fallbackGeneration = fallbackProject ? buildStudioGenerationFromWorkspaceProject(fallbackProject) : null;

      if (fallbackGeneration) {
        latestGeneration = latestGeneration
          ? {
              ...latestGeneration,
              generation: fallbackGeneration,
            }
          : {
              generation: fallbackGeneration,
              jobId: fallbackProject?.jobId ?? fallbackProject?.id ?? fallbackGeneration.id,
              status: "done",
            };
      }
    } catch (error) {
      console.error("[studio] Failed to backfill latest generation from workspace projects", error);
    }
  }

  return {
    latestGeneration,
    profile,
    studioOptions: buildWorkspaceStudioOptions(payload.studio_options),
  };
}

export async function createStudioGenerationJob(
  prompt: string,
  user: StudioUser,
  options?: {
    customMusicFileDataUrl?: string;
    customMusicFileName?: string;
    customVideoFileDataUrl?: string;
    customVideoFileMimeType?: string;
    customVideoFileName?: string;
    isRegeneration?: boolean;
    language?: string;
    musicType?: string;
    subtitleColorId?: string;
    subtitleStyleId?: string;
    videoMode?: string;
    voiceId?: string;
  },
): Promise<StudioGenerationJob> {
  assertAdsflowConfigured();

  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const normalizedVideoMode = normalizeStudioVideoMode(options?.videoMode);
  const requiredCredits = normalizedVideoMode === "ai_video" ? 3 : 1;
  const creditReservation = await consumeWorkspaceGenerationCredit(user, requiredCredits, normalizedLanguage);
  const externalUserId = await resolveStudioExternalUserId(user);
  const shouldAddWatermark =
    creditReservation.profile.plan === "FREE" &&
    creditReservation.consumed.subscription > 0 &&
    creditReservation.consumed.purchased <= 0;
  const normalizedVoiceId = String(options?.voiceId ?? "").trim() || undefined;
  const normalizedMusicType = normalizeStudioMusicType(options?.musicType);
  const normalizedSubtitleStyleId = normalizeStudioSubtitleStyle(options?.subtitleStyleId);
  const normalizedSubtitleColorId = normalizeStudioSubtitleColor(
    options?.subtitleColorId,
    getDefaultStudioSubtitleColorForStyle(normalizedSubtitleStyleId),
  );
  const normalizedCustomMusicFileName = String(options?.customMusicFileName ?? "").trim() || undefined;
  const normalizedCustomMusicFileDataUrl = String(options?.customMusicFileDataUrl ?? "").trim() || undefined;
  const normalizedCustomVideoFileName = String(options?.customVideoFileName ?? "").trim() || undefined;
  const normalizedCustomVideoFileMimeType = String(options?.customVideoFileMimeType ?? "").trim() || undefined;
  const normalizedCustomVideoFileDataUrl = String(options?.customVideoFileDataUrl ?? "").trim() || undefined;

  if (normalizedMusicType === "custom" && (!normalizedCustomMusicFileName || !normalizedCustomMusicFileDataUrl)) {
    throw new Error("Upload a custom music track or choose a different music mode.");
  }

  if (normalizedVideoMode === "custom" && (!normalizedCustomVideoFileName || !normalizedCustomVideoFileDataUrl)) {
    throw new Error("Upload a custom video or choose a different video mode.");
  }

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
        language: normalizedLanguage,
        add_watermark: shouldAddWatermark,
        credit_cost: requiredCredits,
        custom_video_data_url: normalizedVideoMode === "custom" ? normalizedCustomVideoFileDataUrl : undefined,
        custom_video_mime_type: normalizedVideoMode === "custom" ? normalizedCustomVideoFileMimeType : undefined,
        custom_video_original_name: normalizedVideoMode === "custom" ? normalizedCustomVideoFileName : undefined,
        is_regeneration: Boolean(options?.isRegeneration),
        music_type: normalizedMusicType,
        custom_music_data_url: normalizedMusicType === "custom" ? normalizedCustomMusicFileDataUrl : undefined,
        custom_music_original_name: normalizedMusicType === "custom" ? normalizedCustomMusicFileName : undefined,
        subtitle_color: normalizedSubtitleColorId,
        subtitle_style: normalizedSubtitleStyleId,
        video_mode: normalizedVideoMode,
        voice_code: normalizedVoiceId,
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

    try {
      await saveWorkspaceGenerationHistory(user, {
        description: normalizedPrompt,
        jobId,
        prompt: normalizedPrompt,
        status: String(payload.status ?? "queued"),
        title: normalizeGenerationText(payload.title) || normalizedPrompt,
      });
    } catch (error) {
      console.error("[studio] Failed to persist queued generation", error);
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
        await refundWorkspaceGenerationCredit(user, creditReservation.consumed, normalizedLanguage);
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

  try {
    await saveWorkspaceGenerationHistory(user, {
      adId: payload.ad_id ?? null,
      description: payload.description ?? payload.prompt ?? "",
      downloadPath: payload.download_path ?? null,
      error: payload.error ?? null,
      generatedAt: payload.generated_at ?? null,
      jobId: safeJobId,
      prompt: payload.prompt ?? "",
      status,
      title: payload.title ?? payload.prompt ?? "",
      updatedAt: payload.generated_at ?? new Date().toISOString(),
    });
  } catch (error) {
    console.error("[studio] Failed to sync generation history", error);
  }

  if (status === "done") {
    if (!payload.download_path) {
      throw new Error("AdsFlow finished the job without a video path.");
    }

    const generation = buildStudioGeneration(payload);
    if (!generation) {
      return {
        jobId: safeJobId,
        status,
        error: "Готовое видео недоступно как прямой media-файл.",
      };
    }

    return {
      jobId: safeJobId,
      status,
      generation,
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

export function getStudioVideoProxyTargetByPath(value: string): URL {
  const normalized = normalizeGenerationText(value);
  if (!normalized) {
    throw new Error("Video path is required.");
  }

  if (!isPlayableStudioVideoPath(normalized)) {
    throw new Error("Video path is not a direct media file.");
  }

  const upstreamUrl = buildAdsflowUrl(normalized);
  const adsflowBaseUrl = new URL(env.adsflowApiBaseUrl as string);

  if (upstreamUrl.origin === adsflowBaseUrl.origin) {
    upstreamUrl.searchParams.set("admin_token", env.adsflowAdminToken ?? "");
  }

  return upstreamUrl;
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

  if (!isPlayableStudioVideoPath(downloadPath)) {
    throw new Error("AdsFlow returned a non-playable video path.");
  }

  return buildAdsflowUrl(downloadPath, {
    admin_token: env.adsflowAdminToken ?? "",
  });
}
