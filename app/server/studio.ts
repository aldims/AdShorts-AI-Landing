import { env } from "./env.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
import { pathToFileURL } from "node:url";
import {
  ensureWorkspaceProjectPlayback,
  getWorkspaceProjectPlaybackCacheKey,
  warmWorkspaceProjectPlayback,
  type WorkspaceProjectPlaybackAsset,
  type WorkspaceProjectPlaybackSource,
} from "./project-playback.js";
import {
  ensureWorkspaceVideoPoster,
  getWorkspaceVideoPosterCacheKey,
  warmWorkspaceVideoPoster,
  type WorkspaceVideoPosterSource,
} from "./project-posters.js";
import { getWorkspaceProjects, type WorkspaceProject } from "./projects.js";
import {
  listWorkspaceGenerationHistory,
  saveWorkspaceGenerationHistory,
  type WorkspaceGenerationHistoryEntry,
} from "./workspace-history.js";

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
  task_type?: string | null;
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

type AdsflowSegmentAiPhotoAssetPayload = {
  data_url?: string | null;
  download_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  remote_url?: string | null;
  url?: string | null;
};

type AdsflowSegmentAiPhotoGenerateResponse = {
  asset?: AdsflowSegmentAiPhotoAssetPayload | null;
};

type AdsflowSegmentAiPhotoJobCreateResponse = {
  job_id?: string;
  status?: string;
  user?: AdsflowWebUserPayload | null;
};

type AdsflowSegmentAiPhotoJobStatusResponse = {
  asset?: AdsflowSegmentAiPhotoAssetPayload | null;
  error?: string | null;
  job_id?: string;
  status?: string;
  user?: AdsflowWebUserPayload | null;
};

type AdsflowSegmentAiVideoAssetPayload = {
  download_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  remote_url?: string | null;
  url?: string | null;
};

type AdsflowSegmentAiVideoJobCreateResponse = {
  job_id?: string;
  status?: string;
  user?: AdsflowWebUserPayload | null;
};

type AdsflowSegmentAiVideoJobStatusResponse = {
  asset?: AdsflowSegmentAiVideoAssetPayload | null;
  error?: string | null;
  job_id?: string;
  status?: string;
  user?: AdsflowWebUserPayload | null;
};

type WorkspaceCreditConsumption = {
  purchased: number;
  subscription: number;
};

const STUDIO_GENERATION_CREDIT_COST = 10;
const STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST = 7;
const STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST = 5;
const STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST = 2;

export type WorkspaceProfile = {
  balance: number;
  expiresAt: string | null;
  plan: string;
};

export type StudioGeneratedImageAsset = {
  dataUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export type StudioGeneratedVideoAsset = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  posterUrl: string;
  remoteUrl: string;
};

export type StudioSegmentAiPhotoGenerationResult = {
  asset: StudioGeneratedImageAsset;
  profile: WorkspaceProfile;
};

export type StudioSegmentAiPhotoJob = {
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

export type StudioSegmentAiPhotoJobStatus = {
  asset?: StudioGeneratedImageAsset;
  error?: string;
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

export type StudioSegmentAiVideoJob = {
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

export type StudioSegmentAiVideoJobStatus = {
  asset?: StudioGeneratedVideoAsset;
  error?: string;
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

export type StudioSegmentAiPhotoPromptImproveResult = {
  prompt: string;
};

export type StudioSegmentTextTranslateResult = {
  texts: string[];
};

export type StudioContentPlanIdea = {
  prompt: string;
  summary: string;
  title: string;
};

export type StudioContentPlanGenerationResult = {
  ideas: StudioContentPlanIdea[];
  language: "en" | "ru";
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

type WorkspaceBootstrapCacheEntry = {
  bootstrap: WorkspaceBootstrap;
  expiresAt: number;
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
  videoFallbackUrl: string | null;
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

export type StudioSegmentEditorVideoAction = "ai" | "custom" | "original";

export type StudioSegmentEditorSegment = {
  customVideoFileDataUrl?: string;
  customVideoFileMimeType?: string;
  customVideoFileName?: string;
  duration?: number;
  endTime?: number;
  index: number;
  startTime?: number;
  text: string;
  videoAction: StudioSegmentEditorVideoAction;
};

export type StudioSegmentEditorPayload = {
  projectId: number;
  segments: StudioSegmentEditorSegment[];
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

const studioSupportedSegmentVideoActions = new Set(["ai", "custom", "original"]);

const studioSupportedLanguages = new Set(["en", "ru"]);
const WORKSPACE_BOOTSTRAP_CACHE_TTL_MS = 5 * 60_000;
const WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS = 1;
const WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS = 8;
const workspaceBootstrapCache = new Map<string, WorkspaceBootstrapCacheEntry>();
const OPENROUTER_STUDIO_PROMPT_TIMEOUT_MS = 30_000;
const OPENROUTER_STUDIO_PROMPT_HTTP_REFERER = "https://adshorts.ai";
const OPENROUTER_STUDIO_PROMPT_TITLE = "AdShorts Studio Prompt Enhancer";

const normalizePrompt = (value: string) => value.replace(/\s+/g, " ").trim();

const sanitizeStudioContentPlanIdeaPrompt = (value: unknown) => {
  const fallbackPrompt = normalizePrompt(String(value ?? ""));
  if (!fallbackPrompt) {
    return "";
  }

  let normalized = fallbackPrompt
    .replace(/^```[\w-]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();

  const leadingInstructionPatterns = [
    /^(?:напиши|создай|сделай)\s+(?:мне\s+)?(?:сценарий\s+)?(?:для\s+)?(?:shorts|шортс)(?:\s+(?:ролика|видео))?\s*(?:[,:-]\s*)?(?:где\s+|про\s+|о\s+|об\s+|на\s+тему\s+)?/i,
    /^(?:создай|сделай)\s+(?:мне\s+)?(?:shorts|шортс|ролик|видео)(?:\s+(?:о|об|про|на\s+тему))?\s*(?:[,:-]\s*)?/i,
    /^write\s+(?:a\s+)?(?:shorts?\s+)?script(?:\s+for\s+(?:a\s+)?)?(?:shorts?\s+video)?\s*(?:[,:-]\s*)?(?:about\s+|on\s+|where\s+)?/i,
    /^(?:create|make)\s+(?:a\s+)?shorts?(?:\s+video)?\s*(?:[,:-]\s*)?(?:about\s+|on\s+)?/i,
  ];

  for (const pattern of leadingInstructionPatterns) {
    const nextValue = normalized.replace(pattern, "").trim();
    if (nextValue && nextValue !== normalized) {
      normalized = nextValue;
      break;
    }
  }

  normalized = normalized.replace(/^[\s,.:;-]+/, "").replace(/^["'`]+|["'`]+$/g, "").trim();
  return normalized || fallbackPrompt;
};

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

const normalizeStudioLanguage = (value: string | null | undefined): "en" | "ru" => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return studioSupportedLanguages.has(normalized) ? (normalized as "en" | "ru") : "ru";
};

const normalizePositiveInteger = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  const rounded = Math.trunc(numeric);
  return rounded > 0 ? rounded : null;
};

const normalizeNonNegativeInteger = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  const rounded = Math.trunc(numeric);
  return rounded >= 0 ? rounded : null;
};

const normalizeNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeStudioSegmentVideoAction = (value: unknown): StudioSegmentEditorVideoAction => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return studioSupportedSegmentVideoActions.has(normalized) ? (normalized as StudioSegmentEditorVideoAction) : "original";
};

const normalizeStudioSegmentEditorPayload = (
  value: unknown,
  fallbackProjectId?: number,
): StudioSegmentEditorPayload | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as {
    projectId?: unknown;
    segments?: unknown;
  };
  const projectId = normalizePositiveInteger(record.projectId) ?? fallbackProjectId;
  const rawSegments = Array.isArray(record.segments) ? record.segments : [];

  if (!projectId || rawSegments.length === 0) {
    return undefined;
  }

  const segments: StudioSegmentEditorSegment[] = [];

  rawSegments.forEach((segment) => {
    if (!segment || typeof segment !== "object") {
      return;
    }

    const segmentRecord = segment as {
      customVideoFileDataUrl?: unknown;
      customVideoFileMimeType?: unknown;
      customVideoFileName?: unknown;
      duration?: unknown;
      endTime?: unknown;
      index?: unknown;
      startTime?: unknown;
      text?: unknown;
      videoAction?: unknown;
    };
    const index = normalizeNonNegativeInteger(segmentRecord.index);
    if (index === null) {
      return;
    }

    const videoAction = normalizeStudioSegmentVideoAction(segmentRecord.videoAction);
    const customVideoFileDataUrl = String(segmentRecord.customVideoFileDataUrl ?? "").trim() || undefined;
    const customVideoFileMimeType = String(segmentRecord.customVideoFileMimeType ?? "").trim() || undefined;
    const customVideoFileName = String(segmentRecord.customVideoFileName ?? "").trim() || undefined;
    const startTime = normalizeNumber(segmentRecord.startTime) ?? undefined;
    const endTime = normalizeNumber(segmentRecord.endTime) ?? undefined;
    const duration = normalizeNumber(segmentRecord.duration) ?? undefined;

    if (videoAction === "custom" && (!customVideoFileDataUrl || !customVideoFileName)) {
      throw new Error(`Upload a custom video for segment ${index + 1} or choose a different source.`);
    }

    segments.push({
      customVideoFileDataUrl: videoAction === "custom" ? customVideoFileDataUrl : undefined,
      customVideoFileMimeType: videoAction === "custom" ? customVideoFileMimeType : undefined,
      customVideoFileName: videoAction === "custom" ? customVideoFileName : undefined,
      duration,
      endTime,
      index,
      startTime,
      text: normalizeGenerationText(String(segmentRecord.text ?? "")),
      videoAction,
    });
  });

  if (segments.length === 0) {
    return undefined;
  }

  if (segments.length < WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS) {
    throw new Error(`Segment editor requires at least ${WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS} segment.`);
  }

  if (segments.length > WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS) {
    throw new Error(`Segment editor supports up to ${WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS} segments.`);
  }

  return {
    projectId,
    segments,
  };
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

const cloneStudioGeneration = (generation: StudioGeneration): StudioGeneration => ({
  ...generation,
  hashtags: [...generation.hashtags],
});

const cloneStudioGenerationStatus = (status: StudioGenerationStatus): StudioGenerationStatus => ({
  ...status,
  generation: status.generation ? cloneStudioGeneration(status.generation) : undefined,
});

const cloneWorkspaceBootstrap = (bootstrap: WorkspaceBootstrap): WorkspaceBootstrap => ({
  latestGeneration: bootstrap.latestGeneration ? cloneStudioGenerationStatus(bootstrap.latestGeneration) : null,
  profile: { ...bootstrap.profile },
  studioOptions: {
    subtitleColors: bootstrap.studioOptions.subtitleColors.map((color) => ({ ...color })),
    subtitleStyles: bootstrap.studioOptions.subtitleStyles.map((style) => ({ ...style })),
  },
});

const getCachedWorkspaceBootstrap = (cacheKey: string) => {
  const cachedEntry = workspaceBootstrapCache.get(cacheKey);
  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    workspaceBootstrapCache.delete(cacheKey);
    return null;
  }

  return cloneWorkspaceBootstrap(cachedEntry.bootstrap);
};

const setCachedWorkspaceBootstrap = (cacheKey: string, bootstrap: WorkspaceBootstrap) => {
  workspaceBootstrapCache.set(cacheKey, {
    bootstrap: cloneWorkspaceBootstrap(bootstrap),
    expiresAt: Date.now() + WORKSPACE_BOOTSTRAP_CACHE_TTL_MS,
  });
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
      pathname.includes("/api/web/video/") ||
      /\.(mp4|mov|webm|m4v)$/i.test(pathname)
    );
  } catch {
    return false;
  }
};

const buildTrustedStudioVideoTarget = (value: string | null | undefined) => {
  const normalized = normalizeGenerationText(value);
  if (!normalized) {
    throw new Error("Video path is required.");
  }

  const upstreamUrl = buildAdsflowUrl(normalized);
  const hostname = upstreamUrl.hostname.toLowerCase();
  if (hostname === "youtu.be" || hostname.endsWith(".youtube.com") || hostname === "youtube.com") {
    throw new Error("Video path is not a direct media file.");
  }

  const adsflowBaseUrl = new URL(env.adsflowApiBaseUrl as string);
  if (upstreamUrl.origin === adsflowBaseUrl.origin) {
    upstreamUrl.searchParams.set("admin_token", env.adsflowAdminToken ?? "");
  }

  return upstreamUrl;
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

const buildStudioJobVideoProxyUrl = (jobId: string | null | undefined) => {
  const normalizedJobId = normalizeGenerationText(jobId);
  if (!normalizedJobId) {
    return null;
  }

  const proxyUrl = new URL(`/api/studio/video/${encodeURIComponent(normalizedJobId)}`, env.appUrl);
  return `${proxyUrl.pathname}${proxyUrl.search}`;
};

const buildStudioSegmentAiVideoJobVideoProxyUrl = (jobId: string | null | undefined) => {
  const normalizedJobId = normalizeGenerationText(jobId);
  if (!normalizedJobId) {
    return null;
  }

  const proxyUrl = new URL(`/api/studio/segment-ai-video/jobs/${encodeURIComponent(normalizedJobId)}/video`, env.appUrl);
  return `${proxyUrl.pathname}${proxyUrl.search}`;
};

const buildStudioSegmentAiVideoJobPosterProxyUrl = (jobId: string | null | undefined) => {
  const normalizedJobId = normalizeGenerationText(jobId);
  if (!normalizedJobId) {
    return null;
  }

  const proxyUrl = new URL(`/api/studio/segment-ai-video/jobs/${encodeURIComponent(normalizedJobId)}/poster`, env.appUrl);
  proxyUrl.searchParams.set("v", normalizedJobId);
  return `${proxyUrl.pathname}${proxyUrl.search}`;
};

const buildStudioSegmentPhotoAnimationJobVideoProxyUrl = (jobId: string | null | undefined) => {
  const normalizedJobId = normalizeGenerationText(jobId);
  if (!normalizedJobId) {
    return null;
  }

  const proxyUrl = new URL(`/api/studio/segment-photo-animation/jobs/${encodeURIComponent(normalizedJobId)}/video`, env.appUrl);
  return `${proxyUrl.pathname}${proxyUrl.search}`;
};

const buildStudioSegmentPhotoAnimationJobPosterProxyUrl = (jobId: string | null | undefined) => {
  const normalizedJobId = normalizeGenerationText(jobId);
  if (!normalizedJobId) {
    return null;
  }

  const proxyUrl = new URL(`/api/studio/segment-photo-animation/jobs/${encodeURIComponent(normalizedJobId)}/poster`, env.appUrl);
  proxyUrl.searchParams.set("v", normalizedJobId);
  return `${proxyUrl.pathname}${proxyUrl.search}`;
};

const buildStudioPlaybackUrl = (jobId: string | null | undefined, version?: string | null) => {
  const normalizedJobId = normalizeGenerationText(jobId);
  if (!normalizedJobId) {
    return null;
  }

  const playbackUrl = new URL(`/api/studio/playback/${encodeURIComponent(normalizedJobId)}`, env.appUrl);
  const normalizedVersion = normalizeGenerationText(version);
  if (normalizedVersion) {
    playbackUrl.searchParams.set("v", normalizedVersion);
  }

  return `${playbackUrl.pathname}${playbackUrl.search}`;
};

const buildStudioGenerationVideoUrls = (options: {
  downloadPath: string | null | undefined;
  generatedAt?: string | null;
  jobId: string | null | undefined;
}) => {
  const videoFallbackUrl = buildStudioVideoProxyUrl(options.downloadPath);
  const videoUrl = buildStudioPlaybackUrl(options.jobId, options.generatedAt);
  if (!videoFallbackUrl || !videoUrl) {
    return null;
  }

  return {
    videoFallbackUrl,
    videoUrl,
  };
};

const buildWorkspaceProfile = (payload?: AdsflowWebUserPayload): WorkspaceProfile => ({
  balance: Math.max(0, Number(payload?.balance ?? 0)),
  expiresAt: normalizeGenerationText(payload?.subscription_expires_at) || null,
  plan: String(payload?.plan ?? "FREE").trim().toUpperCase() || "FREE",
});

const normalizeStudioGeneratedImageMimeType = (value: string | null | undefined, fallback = "image/png") => {
  const normalized = normalizeGenerationText(value).toLowerCase().split(";")[0]?.trim() ?? "";
  if (normalized.startsWith("image/")) {
    return normalized;
  }

  return fallback;
};

const getStudioGeneratedImageExtension = (mimeType: string) => {
  const normalized = normalizeStudioGeneratedImageMimeType(mimeType);
  if (normalized === "image/jpeg") return ".jpg";
  if (normalized === "image/webp") return ".webp";
  if (normalized === "image/avif") return ".avif";
  if (normalized === "image/gif") return ".gif";
  return ".png";
};

const extractMimeTypeFromDataUrl = (value: string) => {
  const match = /^data:(?<mime>[^;,]+);base64,/i.exec(value.trim());
  return normalizeStudioGeneratedImageMimeType(match?.groups?.mime ?? "");
};

const decodeDataUrlBytes = (value: string) => {
  const match = /^data:(?<mime>[^;,]+);base64,(?<data>.+)$/i.exec(value.trim());
  if (!match?.groups?.data) {
    throw new Error("Generated image data URL is invalid.");
  }

  return {
    bytes: Buffer.from(match.groups.data, "base64"),
    mimeType: extractMimeTypeFromDataUrl(value),
  };
};

const buildDataUrlFromBytes = (bytes: Buffer, mimeType: string) =>
  `data:${normalizeStudioGeneratedImageMimeType(mimeType)};base64,${bytes.toString("base64")}`;

const inferStudioGeneratedImageMimeType = (
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
  urlValue?: string | null,
) => {
  const normalizedMimeType = normalizeStudioGeneratedImageMimeType(mimeType, "");
  if (normalizedMimeType) {
    return normalizedMimeType;
  }

  const target = `${normalizeGenerationText(fileName)} ${normalizeGenerationText(urlValue)}`.toLowerCase();
  if (target.endsWith(".jpg") || target.endsWith(".jpeg")) return "image/jpeg";
  if (target.endsWith(".webp")) return "image/webp";
  if (target.endsWith(".avif")) return "image/avif";
  if (target.endsWith(".gif")) return "image/gif";
  return "image/png";
};

const normalizeStudioGeneratedImageFileName = (fileName: string | null | undefined, mimeType: string) => {
  const normalized = String(fileName ?? "").trim().split(/[\\/]/).pop() ?? "";
  if (normalized) {
    return normalized;
  }

  return `segment-ai-photo${getStudioGeneratedImageExtension(mimeType)}`;
};

const resolveAdsflowAssetUrl = (value: string | null | undefined) => {
  const normalized = normalizeGenerationText(value);
  if (!normalized) {
    return null;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return new URL(normalized);
  }

  if (normalized.startsWith("/")) {
    return buildAdsflowUrl(normalized);
  }

  return null;
};

const DEAPI_IMAGE_API_URL = "https://api.deapi.ai/api/v1/client/txt2img";
const DEAPI_IMAGE_STATUS_URL = "https://api.deapi.ai/api/v1/client/request-status";
const DEAPI_IMAGE_MODEL_SLUG = "ZImageTurbo_INT8";
const DEAPI_IMAGE_WIDTH = 768;
const DEAPI_IMAGE_HEIGHT = 1280;
const DEAPI_IMAGE_STEPS = 8;
const DEAPI_IMAGE_TIMEOUT_MS = 120_000;
const DEAPI_IMAGE_POLL_INITIAL_MS = 1_000;
const DEAPI_IMAGE_POLL_MAX_MS = 2_500;
const DEAPI_NO_TEXT_POSITIVE_CLAUSE =
  "no text, no letters, no words, no captions, no subtitles, no logos, no watermark, no signature, no signage";
const DEAPI_PERSON_APPEARANCE_CLAUSE = "European appearance, Caucasian ethnicity";
const DEAPI_NO_TEXT_NEGATIVE_PROMPT =
  "text, letters, words, numbers, writing, caption, subtitle, typography, font, watermark, signature, logo, inscription, label, stamp, banner, headline, title, sign, signage, road sign, poster, magazine cover, newspaper, book page, ui, interface, chat bubble, speech bubble, handwriting, hieroglyphs, kanji, chinese, japanese, korean, cyrillic, latin characters, alphabet, symbols";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeStudioSegmentAiPhotoPromptEnhancementOutput = (value: unknown) =>
  String(value ?? "")
    .replace(/^```[\w-]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^prompt\s*:\s*/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const buildStudioSegmentAiPhotoPromptEnhancementFallback = (
  value: string,
  language: "en" | "ru",
) => {
  const normalizedPrompt = normalizePrompt(value).replace(/[.!?]+$/g, "");
  if (!normalizedPrompt) {
    return "";
  }

  const descriptors =
    language === "en"
      ? [
          "cinematic vertical 9:16 composition",
          "photorealistic",
          "dramatic lighting",
          "clear focal subject",
          "high detail",
        ]
      : [
          "кинематографичная вертикальная композиция 9:16",
          "фотореализм",
          "драматичный свет",
          "четкий главный объект",
          "высокая детализация",
        ];

  return [normalizedPrompt.charAt(0).toUpperCase() + normalizedPrompt.slice(1), ...descriptors].join(", ");
};

const buildStudioSegmentAiPhotoPromptEnhancementSystemPrompt = (language: "en" | "ru") =>
  language === "en"
    ? [
        "You are an expert prompt engineer for AI image generation.",
        "Rewrite the user's rough scene description into one strong production-ready prompt for a vertical 9:16 image.",
        "Return exactly one prompt in English with no quotes, labels, markdown, or explanations.",
        "Focus only on visible details: subject, action, setting, composition, camera framing, lighting, mood, textures, and product visibility when relevant.",
        "Prefer cinematic, realistic, premium-looking imagery unless the user explicitly asks for fantasy, stylization, or surrealism.",
        "Keep it compact and clear: one sentence or a tight comma-separated phrase, under 320 characters.",
        "Do not mention captions, subtitles, logos, watermarks, UI, split screens, or multiple unrelated scenes.",
      ].join(" ")
    : [
        "Ты эксперт по созданию промтов для генерации изображений.",
        "Преобразуй черновое описание пользователя в один сильный готовый промт для вертикального изображения 9:16.",
        "Верни ровно один промт на русском языке без кавычек, меток, markdown и пояснений.",
        "Описывай только видимые детали: главный объект, действие, окружение, композицию, ракурс, свет, атмосферу, фактуры и продукт, если он важен.",
        "По умолчанию делай сцену кинематографичной, реалистичной и визуально дорогой, если пользователь явно не просит фантазию или стилизацию.",
        "Промт должен быть компактным и ясным: одно предложение или плотная фраза до 320 символов.",
        "Не упоминай титры, текст на экране, логотипы, водяные знаки, интерфейсы, коллажи и несколько несвязанных сцен.",
      ].join(" ");

const buildStudioSegmentAiPhotoPromptEnhancementUserPrompt = (prompt: string, language: "en" | "ru") =>
  language === "en"
    ? [`Raw scene description:`, prompt, "", `Return only the final prompt.`].join("\n")
    : [`Черновое описание сцены:`, prompt, "", `Верни только итоговый промт.`].join("\n");

type OpenRouterChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            text?: string | null;
            type?: string | null;
          }>;
    };
  }>;
  error?:
    | string
    | {
        message?: string | null;
      };
};

const extractOpenRouterChatCompletionText = (payload: OpenRouterChatCompletionResponse | null) => {
  const message = payload?.choices?.[0]?.message;
  if (!message) {
    return "";
  }

  if (typeof message.content === "string") {
    return message.content;
  }

  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .map((part) => (part?.type === "text" || !part?.type ? String(part?.text ?? "") : ""))
    .join(" ")
    .trim();
};

const extractOpenRouterErrorMessage = (payload: OpenRouterChatCompletionResponse | null) => {
  if (typeof payload?.error === "string") {
    return payload.error.trim();
  }

  return String(payload?.error?.message ?? "").trim();
};

const getStudioLanguageLabel = (language: "en" | "ru") => (language === "en" ? "English" : "Russian");

const STUDIO_CONTENT_PLAN_IDEA_COUNT_MIN = 3;
const STUDIO_CONTENT_PLAN_IDEA_COUNT_MAX = 30;
const STUDIO_CONTENT_PLAN_IDEA_COUNT_DEFAULT = 10;

const normalizeStudioContentPlanIdeaCount = (value: unknown) => {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) {
    return STUDIO_CONTENT_PLAN_IDEA_COUNT_DEFAULT;
  }

  return Math.max(STUDIO_CONTENT_PLAN_IDEA_COUNT_MIN, Math.min(STUDIO_CONTENT_PLAN_IDEA_COUNT_MAX, parsed));
};

const sanitizeStudioTranslationResponseText = (value: string) =>
  value
    .replace(/^```[\w-]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const parseStudioContentPlanResponse = (value: string, expectedCount: number) => {
  const normalizedValue = sanitizeStudioTranslationResponseText(value);
  const jsonCandidate = normalizedValue.startsWith("{")
    ? normalizedValue
    : normalizedValue.slice(
        Math.max(0, normalizedValue.indexOf("{")),
        normalizedValue.lastIndexOf("}") >= 0 ? normalizedValue.lastIndexOf("}") + 1 : normalizedValue.length,
      );
  const parsed = JSON.parse(jsonCandidate) as
    | {
        ideas?: unknown;
      }
    | null;
  const ideas = Array.isArray(parsed?.ideas) ? parsed.ideas : null;

  if (!ideas || ideas.length !== expectedCount) {
    throw new Error("OpenRouter returned an invalid content plan payload.");
  }

  return ideas.map((idea, index) => {
    const record = idea && typeof idea === "object" ? (idea as Record<string, unknown>) : null;
    const title = normalizePrompt(String(record?.title ?? ""));
    const summary = normalizePrompt(String(record?.summary ?? ""));
    const prompt = sanitizeStudioContentPlanIdeaPrompt(record?.prompt);

    if (!title || !summary || !prompt) {
      throw new Error(`OpenRouter returned an invalid content plan idea at position ${index + 1}.`);
    }

    return {
      prompt,
      summary,
      title,
    } satisfies StudioContentPlanIdea;
  });
};

const parseStudioTextTranslationResponse = (value: string, expectedCount: number) => {
  const normalizedValue = sanitizeStudioTranslationResponseText(value);
  const jsonCandidate = normalizedValue.startsWith("{")
    ? normalizedValue
    : normalizedValue.slice(
        Math.max(0, normalizedValue.indexOf("{")),
        normalizedValue.lastIndexOf("}") >= 0 ? normalizedValue.lastIndexOf("}") + 1 : normalizedValue.length,
      );

  const parsed = JSON.parse(jsonCandidate) as
    | {
        items?: unknown;
      }
    | unknown[];
  const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : null;

  if (!items || items.length !== expectedCount) {
    throw new Error("OpenRouter returned an invalid translation payload.");
  }

  return items.map((item) => String(item ?? ""));
};

const buildStudioTextTranslationSystemPrompt = (
  sourceLanguage: "en" | "ru",
  targetLanguage: "en" | "ru",
) =>
  [
    "You are a precise translator for short-form video scripts and subtitle lines.",
    `Translate each item from ${getStudioLanguageLabel(sourceLanguage)} to ${getStudioLanguageLabel(targetLanguage)}.`,
    "Return strict JSON only in the format {\"items\":[\"...\"]}.",
    "Keep the same item count and order.",
    "Preserve meaning, CTA intent, brand names, numbers, and concise short-video rhythm.",
    "Do not add explanations, notes, markdown, or extra keys.",
    "If an item is empty, return an empty string for that item.",
  ].join(" ");

const buildStudioTextTranslationUserPrompt = (texts: string[]) =>
  JSON.stringify(
    {
      items: texts,
    },
    null,
    2,
  );

const buildStudioContentPlanSystemPrompt = (language: "en" | "ru", count: number, hasExistingIdeas: boolean) =>
  language === "en"
    ? [
        "You are a senior strategist for viral short-form vertical videos.",
        `Generate exactly ${count} distinct Shorts ideas for the user's topic.`,
        "Return strict JSON only in the format {\"ideas\":[{\"title\":\"...\",\"summary\":\"...\",\"prompt\":\"...\"}]} with no markdown or extra keys.",
        "Write every field in English.",
        "Each title must be short and scannable.",
        "Each summary must be one concise sentence explaining the hook or angle.",
        "Each prompt must be only the raw idea or angle ready for the generator field, not an instruction to the model.",
        "Do not start prompt with verbs like write, create, make or phrases like 'Write a Shorts script about'.",
        "Keep the ideas concrete, varied, non-repetitive, and useful for real content production.",
        hasExistingIdeas ? "Do not repeat, rephrase, or lightly remix the existing ideas already provided by the user." : "",
        "Do not number the ideas, do not add explanations, and do not wrap the JSON in code fences.",
      ].join(" ")
    : [
        "Ты senior-стратег по viral short-form вертикальным видео.",
        `Сгенерируй ровно ${count} разных идей для Shorts по теме пользователя.`,
        "Верни только строгий JSON в формате {\"ideas\":[{\"title\":\"...\",\"summary\":\"...\",\"prompt\":\"...\"}]} без markdown и без лишних ключей.",
        "Пиши все поля на русском языке.",
        "Каждый title должен быть коротким и удобным для быстрого просмотра.",
        "Каждый summary должен быть одним коротким предложением с углом подачи или хуком.",
        "Каждый prompt должен быть не командой модели, а чистой формулировкой идеи или угла подачи для поля генерации.",
        "Не начинай prompt со слов 'напиши', 'создай', 'сделай', 'write', 'create', 'make' и не пиши фразы вроде 'Напиши сценарий Shorts о...'.",
        "Идеи должны быть конкретными, разнообразными, без повторов и пригодными для реального контент-плана.",
        hasExistingIdeas ? "Не повторяй, не перефразируй и не делай слегка изменённые версии уже существующих идей пользователя." : "",
        "Не нумеруй идеи, не добавляй пояснения и не оборачивай JSON в code fences.",
      ].join(" ");

const buildStudioContentPlanUserPrompt = (
  query: string,
  language: "en" | "ru",
  count: number,
  existingIdeas: StudioContentPlanIdea[] = [],
) =>
  JSON.stringify(
    language === "en"
      ? {
          avoid_ideas:
            existingIdeas.length > 0
              ? existingIdeas.slice(0, 24).map((idea) => ({
                  prompt: idea.prompt,
                  title: idea.title,
                }))
              : undefined,
          count,
          topic: query,
          task: `Generate ${count} Shorts ideas for this topic. In prompt, store only the raw idea or angle without imperative wording.`,
        }
      : {
          avoid_ideas:
            existingIdeas.length > 0
              ? existingIdeas.slice(0, 24).map((idea) => ({
                  prompt: idea.prompt,
                  title: idea.title,
                }))
              : undefined,
          count,
          task: `Сгенерируй ${count} идей для Shorts по этой теме. В поле prompt сохрани только саму идею или угол подачи без командной формы.`,
          topic: query,
        },
    null,
    2,
  );

const detectStudioPromptLanguage = (prompt: string, fallbackLanguage?: string): "en" | "ru" => {
  if (/[А-Яа-яЁё]/.test(prompt)) {
    return "ru";
  }

  if (/[A-Za-z]/.test(prompt)) {
    return "en";
  }

  return normalizeStudioLanguage(fallbackLanguage);
};

const getStudioOpenRouterModelCandidates = () =>
  Array.from(
    new Set(
      [env.openrouterMainModel, env.openrouterFallbackModel]
        .map((model) => normalizePrompt(model ?? ""))
        .filter(Boolean),
    ),
  );

const buildStudioVisualPromptEnglishTranslationSystemPrompt = (sourceLanguage: "en" | "ru") =>
  [
    "You are an expert translator for AI image and AI video generation prompts.",
    `Translate the user's visual prompt from ${getStudioLanguageLabel(sourceLanguage)} to English.`,
    "Return exactly one English prompt with no quotes, markdown, labels, or explanations.",
    "Preserve the original intent, prompt structure, camera/style terms, pacing, and prompt-engineering phrasing when useful.",
    "Preserve brand names, product names, proper nouns, character names, shot types, aspect ratios, and technical keywords.",
    "Do not add unrelated details, safety notes, or extra explanation.",
  ].join(" ");

const buildStudioVisualPromptEnglishTranslationUserPrompt = (prompt: string) =>
  [`Visual generation prompt:`, prompt, "", `Return only the final English prompt.`].join("\n");

const sanitizeStudioVisualPromptEnglishTranslationOutput = (value: string) =>
  sanitizeStudioTranslationResponseText(value).replace(/^["'`]+|["'`]+$/g, "").trim();

const requestStudioSegmentAiPhotoPromptEnhancement = async (
  prompt: string,
  language: "en" | "ru",
  model: string,
) => {
  const response = await fetch(`${env.openrouterBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.openrouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": OPENROUTER_STUDIO_PROMPT_HTTP_REFERER,
      "X-Title": OPENROUTER_STUDIO_PROMPT_TITLE,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: buildStudioSegmentAiPhotoPromptEnhancementSystemPrompt(language),
        },
        {
          role: "user",
          content: buildStudioSegmentAiPhotoPromptEnhancementUserPrompt(prompt, language),
        },
      ],
      temperature: 0.35,
      max_tokens: 220,
    }),
    signal: AbortSignal.timeout(OPENROUTER_STUDIO_PROMPT_TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => null)) as OpenRouterChatCompletionResponse | null;
  if (!response.ok) {
    throw new Error(
      extractOpenRouterErrorMessage(payload) || `OpenRouter prompt enhancement failed (${response.status}).`,
    );
  }

  const improvedPrompt = sanitizeStudioSegmentAiPhotoPromptEnhancementOutput(
    extractOpenRouterChatCompletionText(payload),
  );
  if (!improvedPrompt) {
    throw new Error("OpenRouter returned an empty prompt.");
  }

  return improvedPrompt;
};

const requestStudioVisualPromptEnglishTranslation = async (
  prompt: string,
  sourceLanguage: "en" | "ru",
  model: string,
) => {
  const response = await fetch(`${env.openrouterBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.openrouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": OPENROUTER_STUDIO_PROMPT_HTTP_REFERER,
      "X-Title": OPENROUTER_STUDIO_PROMPT_TITLE,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: buildStudioVisualPromptEnglishTranslationSystemPrompt(sourceLanguage),
        },
        {
          role: "user",
          content: buildStudioVisualPromptEnglishTranslationUserPrompt(prompt),
        },
      ],
      temperature: 0.1,
      max_tokens: 260,
    }),
    signal: AbortSignal.timeout(OPENROUTER_STUDIO_PROMPT_TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => null)) as OpenRouterChatCompletionResponse | null;
  if (!response.ok) {
    throw new Error(
      extractOpenRouterErrorMessage(payload) || `OpenRouter visual prompt translation failed (${response.status}).`,
    );
  }

  const translatedPrompt = sanitizeStudioVisualPromptEnglishTranslationOutput(extractOpenRouterChatCompletionText(payload));
  if (!translatedPrompt) {
    throw new Error("OpenRouter returned an empty translated prompt.");
  }

  return translatedPrompt;
};

const requestStudioTextTranslation = async (
  texts: string[],
  sourceLanguage: "en" | "ru",
  targetLanguage: "en" | "ru",
  model: string,
) => {
  const response = await fetch(`${env.openrouterBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.openrouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": OPENROUTER_STUDIO_PROMPT_HTTP_REFERER,
      "X-Title": OPENROUTER_STUDIO_PROMPT_TITLE,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: buildStudioTextTranslationSystemPrompt(sourceLanguage, targetLanguage),
        },
        {
          role: "user",
          content: buildStudioTextTranslationUserPrompt(texts),
        },
      ],
      temperature: 0.1,
      max_tokens: Math.max(240, Math.min(1600, texts.length * 160)),
    }),
    signal: AbortSignal.timeout(OPENROUTER_STUDIO_PROMPT_TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => null)) as OpenRouterChatCompletionResponse | null;
  if (!response.ok) {
    throw new Error(extractOpenRouterErrorMessage(payload) || `OpenRouter translation failed (${response.status}).`);
  }

  return parseStudioTextTranslationResponse(extractOpenRouterChatCompletionText(payload), texts.length);
};

const requestStudioContentPlanIdeas = async (
  query: string,
  language: "en" | "ru",
  count: number,
  model: string,
  existingIdeas: StudioContentPlanIdea[] = [],
) => {
  const response = await fetch(`${env.openrouterBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.openrouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": OPENROUTER_STUDIO_PROMPT_HTTP_REFERER,
      "X-Title": OPENROUTER_STUDIO_PROMPT_TITLE,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: buildStudioContentPlanSystemPrompt(language, count, existingIdeas.length > 0),
        },
        {
          role: "user",
          content: buildStudioContentPlanUserPrompt(query, language, count, existingIdeas),
        },
      ],
      temperature: 0.8,
      max_tokens: Math.max(1200, Math.min(3200, 320 + count * 170)),
    }),
    signal: AbortSignal.timeout(OPENROUTER_STUDIO_PROMPT_TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => null)) as OpenRouterChatCompletionResponse | null;
  if (!response.ok) {
    throw new Error(
      extractOpenRouterErrorMessage(payload) || `OpenRouter content plan generation failed (${response.status}).`,
    );
  }

  return parseStudioContentPlanResponse(extractOpenRouterChatCompletionText(payload), count);
};

const translateStudioGenerationPromptToEnglish = async (
  prompt: string,
  options?: {
    sourceLanguage?: string;
  },
) => {
  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    return "";
  }

  const sourceLanguage = detectStudioPromptLanguage(normalizedPrompt, options?.sourceLanguage);
  if (sourceLanguage === "en") {
    return normalizedPrompt;
  }

  const modelCandidates = getStudioOpenRouterModelCandidates();
  let lastError: Error | null = null;

  if (env.openrouterApiKey && modelCandidates.length > 0) {
    for (const model of modelCandidates) {
      try {
        return await requestStudioVisualPromptEnglishTranslation(normalizedPrompt, sourceLanguage, model);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("OpenRouter visual prompt translation failed.");
        console.warn(`[studio] Failed to translate visual prompt with ${model}`, lastError);
      }
    }
  }

  if (lastError) {
    console.warn("[studio] Falling back to original visual prompt because English translation is unavailable.");
  }

  return normalizedPrompt;
};

const sanitizeDirectStudioAiPhotoPrompt = (value: string) => {
  let cleaned = String(value ?? "").replace(/\r/g, " ").replace(/\n/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim().replace(/^["'`]+|["'`]+$/g, "").replace(/[,. ]+$/g, "");
  if (!cleaned) {
    return "";
  }
  if (!cleaned.toLowerCase().includes("european appearance")) {
    cleaned = `${cleaned}, ${DEAPI_PERSON_APPEARANCE_CLAUSE}`;
  }
  if (!cleaned.toLowerCase().includes("no text")) {
    cleaned = `${cleaned}, ${DEAPI_NO_TEXT_POSITIVE_CLAUSE}`;
  }
  return cleaned;
};

const parseStudioJsonPayload = async <T>(response: Response) => {
  return (await response.json().catch(() => null)) as T | null;
};

const extractDirectDeapiRequestId = (payload: Record<string, unknown> | null) => {
  const inner = payload && typeof payload.data === "object" && payload.data ? (payload.data as Record<string, unknown>) : payload;
  return (
    (inner && typeof inner.request_id === "string" ? inner.request_id : null) ||
    (payload && typeof payload.request_id === "string" ? payload.request_id : null) ||
    null
  );
};

const extractDirectDeapiImageUrl = (payload: Record<string, unknown> | null) => {
  const root = payload ?? {};
  const inner = typeof root.data === "object" && root.data ? (root.data as Record<string, unknown>) : root;
  const directUrl =
    (typeof inner.result_url === "string" && inner.result_url) ||
    (typeof inner.output_url === "string" && inner.output_url) ||
    (typeof inner.output === "string" && inner.output) ||
    (typeof inner.image_url === "string" && inner.image_url) ||
    (typeof inner.url === "string" && inner.url) ||
    (typeof root.result_url === "string" && root.result_url) ||
    (typeof root.output_url === "string" && root.output_url);

  if (directUrl) {
    return directUrl;
  }

  const outputs = Array.isArray(inner.outputs) ? inner.outputs : Array.isArray(root.outputs) ? root.outputs : [];
  const firstOutput = outputs[0];
  if (typeof firstOutput === "string" && firstOutput) {
    return firstOutput;
  }
  if (
    firstOutput &&
    typeof firstOutput === "object" &&
    "url" in firstOutput &&
    typeof (firstOutput as { url?: unknown }).url === "string"
  ) {
    return (firstOutput as { url: string }).url;
  }

  return null;
};

const extractDirectDeapiError = (payload: Record<string, unknown> | null) => {
  const inner = payload && typeof payload.data === "object" && payload.data ? (payload.data as Record<string, unknown>) : payload;
  return (
    (inner && typeof inner.error === "string" ? inner.error : null) ||
    (payload && typeof payload.error === "string" ? payload.error : null) ||
    null
  );
};

const pollDirectDeapiImageUrl = async (requestId: string) => {
  const startedAt = Date.now();
  let delayMs = DEAPI_IMAGE_POLL_INITIAL_MS;

  while (Date.now() - startedAt < DEAPI_IMAGE_TIMEOUT_MS) {
    const response = await fetch(`${DEAPI_IMAGE_STATUS_URL}/${encodeURIComponent(requestId)}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env.deapiApiKey}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 429) {
      await sleep(Math.min(30_000, delayMs * 2));
      continue;
    }

    if (!response.ok) {
      await sleep(delayMs);
      delayMs = Math.min(DEAPI_IMAGE_POLL_MAX_MS, Math.round(delayMs * 1.2));
      continue;
    }

    const payload = await parseStudioJsonPayload<Record<string, unknown>>(response);
    const inner = payload && typeof payload.data === "object" && payload.data ? (payload.data as Record<string, unknown>) : payload;
    const status =
      (inner && typeof inner.status === "string" ? inner.status : null) ||
      (payload && typeof payload.status === "string" ? payload.status : null) ||
      "";

    if (status === "completed" || status === "done") {
      return extractDirectDeapiImageUrl(payload);
    }

    if (status === "failed" || status === "error") {
      throw new Error(extractDirectDeapiError(payload) || "DEAPI image generation failed.");
    }

    await sleep(delayMs);
    delayMs = Math.min(DEAPI_IMAGE_POLL_MAX_MS, Math.round(delayMs * 1.2));
  }

  throw new Error("DEAPI image generation timed out.");
};

const generateDirectStudioSegmentAiPhoto = async (
  prompt: string,
  options?: { segmentIndex?: number | null },
): Promise<StudioGeneratedImageAsset> => {
  if (!env.deapiApiKey) {
    throw new Error("DEAPI image fallback is not configured.");
  }

  const sanitizedPrompt = sanitizeDirectStudioAiPhotoPrompt(prompt);
  if (!sanitizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const createResponse = await fetch(DEAPI_IMAGE_API_URL, {
    body: JSON.stringify({
      prompt: sanitizedPrompt,
      negative_prompt: DEAPI_NO_TEXT_NEGATIVE_PROMPT,
      model: DEAPI_IMAGE_MODEL_SLUG,
      width: DEAPI_IMAGE_WIDTH,
      height: DEAPI_IMAGE_HEIGHT,
      seed: Math.max(1, Math.floor(Math.random() * 2_147_483_647)),
      steps: DEAPI_IMAGE_STEPS,
    }),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.deapiApiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(30_000),
  });

  const createPayload = await parseStudioJsonPayload<Record<string, unknown>>(createResponse);
  if (!createResponse.ok) {
    throw new Error(extractDirectDeapiError(createPayload) || `DEAPI image request failed (${createResponse.status}).`);
  }

  const directUrl = extractDirectDeapiImageUrl(createPayload);
  const requestId = extractDirectDeapiRequestId(createPayload);
  const imageUrl = directUrl || (requestId ? await pollDirectDeapiImageUrl(requestId) : null);
  if (!imageUrl) {
    throw new Error("DEAPI did not return an image URL.");
  }

  const downloadResponse = await fetch(imageUrl, {
    headers: {
      Accept: "image/*,application/octet-stream",
    },
    signal: AbortSignal.timeout(60_000),
  });

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download generated image (${downloadResponse.status}).`);
  }

  const bytes = Buffer.from(await downloadResponse.arrayBuffer());
  if (!bytes.length) {
    throw new Error("Generated image is empty.");
  }

  const mimeType = inferStudioGeneratedImageMimeType(
    downloadResponse.headers.get("content-type"),
    null,
    imageUrl,
  );

  return {
    dataUrl: buildDataUrlFromBytes(bytes, mimeType),
    fileName: `segment-ai-photo-${(options?.segmentIndex ?? 0) + 1}${getStudioGeneratedImageExtension(mimeType)}`,
    fileSize: bytes.length,
    mimeType,
  };
};

const fetchRemoteStudioGeneratedImage = async (url: URL) => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(ADSFLOW_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Failed to download generated image (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    mimeType: normalizeStudioGeneratedImageMimeType(response.headers.get("content-type")),
  };
};

const normalizeAdsflowSegmentAiPhotoAsset = async (
  payload?: AdsflowSegmentAiPhotoAssetPayload | null,
): Promise<StudioGeneratedImageAsset> => {
  const inlineDataUrl = normalizeGenerationText(payload?.data_url);
  const remoteUrl = resolveAdsflowAssetUrl(payload?.remote_url ?? payload?.download_url ?? payload?.url);

  if (!inlineDataUrl && !remoteUrl) {
    throw new Error("AdsFlow did not return a generated image.");
  }

  let bytes: Buffer;
  let mimeType: string;

  if (inlineDataUrl) {
    const decoded = decodeDataUrlBytes(inlineDataUrl);
    bytes = decoded.bytes;
    mimeType = inferStudioGeneratedImageMimeType(decoded.mimeType, payload?.file_name, payload?.remote_url ?? payload?.download_url ?? payload?.url);
  } else if (remoteUrl) {
    const downloaded = await fetchRemoteStudioGeneratedImage(remoteUrl);
    bytes = downloaded.bytes;
    mimeType = inferStudioGeneratedImageMimeType(downloaded.mimeType, payload?.file_name, remoteUrl.toString());
  } else {
    throw new Error("Generated image is unavailable.");
  }

  if (!bytes.length) {
    throw new Error("Generated image is empty.");
  }

  const fileName = normalizeStudioGeneratedImageFileName(payload?.file_name, mimeType);

  return {
    dataUrl: inlineDataUrl || buildDataUrlFromBytes(bytes, mimeType),
    fileName,
    fileSize: Math.max(0, Number(payload?.file_size ?? bytes.length)),
    mimeType,
  };
};

const normalizeAdsflowSegmentAiVideoAsset = (
  jobId: string,
  payload?: AdsflowSegmentAiVideoAssetPayload | null,
): StudioGeneratedVideoAsset => {
  const remoteUrl = buildStudioSegmentAiVideoJobVideoProxyUrl(jobId);
  const posterUrl = buildStudioSegmentAiVideoJobPosterProxyUrl(jobId);
  if (!remoteUrl || !posterUrl) {
    throw new Error("Generated video is unavailable.");
  }

  return {
    fileName: normalizeGenerationText(payload?.file_name) || `segment-ai-video-${jobId}.mp4`,
    fileSize: Math.max(0, Number(payload?.file_size ?? 0)),
    mimeType: normalizeGenerationText(payload?.mime_type) || "video/mp4",
    posterUrl,
    remoteUrl,
  };
};

const normalizeAdsflowSegmentPhotoAnimationAsset = (
  jobId: string,
  payload?: AdsflowSegmentAiVideoAssetPayload | null,
): StudioGeneratedVideoAsset => {
  const remoteUrl = buildStudioSegmentPhotoAnimationJobVideoProxyUrl(jobId);
  const posterUrl = buildStudioSegmentPhotoAnimationJobPosterProxyUrl(jobId);
  if (!remoteUrl || !posterUrl) {
    throw new Error("Generated video is unavailable.");
  }

  return {
    fileName: normalizeGenerationText(payload?.file_name) || `segment-photo-animation-${jobId}.mp4`,
    fileSize: Math.max(0, Number(payload?.file_size ?? 0)),
    mimeType: normalizeGenerationText(payload?.mime_type) || "video/mp4",
    posterUrl,
    remoteUrl,
  };
};

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
  const videoUrls = buildStudioGenerationVideoUrls({
    downloadPath: payload.download_path,
    generatedAt: payload.generated_at,
    jobId,
  });

  if (!videoUrls) {
    return null;
  }

  return {
    adId: payload.ad_id ?? null,
    id: jobId,
    prompt,
    title,
    description,
    hashtags,
    videoFallbackUrl: videoUrls.videoFallbackUrl,
    videoUrl: videoUrls.videoUrl,
    durationLabel: "Ready",
    modelLabel: "AdsFlow pipeline",
    aspectRatio: "9:16",
    generatedAt: payload.generated_at ?? new Date().toISOString(),
  };
};

const isAdsflowLatestVideoGenerationTask = (value: string | null | undefined) => {
  const normalized = normalizeGenerationText(value).toLowerCase();
  return !normalized || normalized === "video.generate" || normalized === "video.edit";
};

const buildStudioGenerationFromLatest = (payload: AdsflowLatestGenerationPayload): StudioGeneration | null => {
  if (!isAdsflowLatestVideoGenerationTask(payload.task_type)) {
    return null;
  }

  const prompt = normalizePrompt(payload.prompt ?? "");
  const jobId = String(payload.job_id ?? "");
  const description = normalizeGenerationText(payload.description);
  const hashtags = parseGenerationHashtags(payload.hashtags);
  const title = normalizeGenerationText(payload.title);
  const videoUrls = buildStudioGenerationVideoUrls({
    downloadPath: payload.download_path,
    generatedAt: payload.generated_at,
    jobId,
  });

  if (!videoUrls) {
    return null;
  }

  return {
    adId: payload.ad_id ?? null,
    id: jobId,
    prompt,
    title,
    description,
    hashtags,
    videoFallbackUrl: videoUrls.videoFallbackUrl,
    videoUrl: videoUrls.videoUrl,
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
    videoFallbackUrl: project.videoFallbackUrl,
    videoUrl,
  };
};

const buildStudioGenerationFromHistoryEntry = (entry: WorkspaceGenerationHistoryEntry): StudioGeneration | null => {
  const jobId = normalizeGenerationText(entry.jobId);
  if (!jobId) {
    return null;
  }

  const normalizedStatus = normalizeGenerationText(entry.status).toLowerCase();
  if (!["completed", "done", "ready"].includes(normalizedStatus)) {
    return null;
  }

  const videoUrls = buildStudioGenerationVideoUrls({
    downloadPath: entry.downloadPath,
    generatedAt: entry.generatedAt ?? entry.updatedAt ?? entry.createdAt,
    jobId,
  });
  if (!videoUrls) {
    return null;
  }

  const prompt = normalizePrompt(entry.prompt);
  const description = normalizeGenerationText(entry.description);

  return {
    adId: entry.adId,
    aspectRatio: "9:16",
    description,
    durationLabel: "Ready",
    generatedAt: entry.generatedAt ?? entry.updatedAt ?? entry.createdAt,
    hashtags: [],
    id: jobId,
    modelLabel: "AdsFlow pipeline",
    prompt,
    title: normalizeGenerationText(entry.title) || description || prompt || "Готовое видео",
    videoFallbackUrl: videoUrls.videoFallbackUrl,
    videoUrl: videoUrls.videoUrl,
  };
};

const buildLatestGenerationStatus = (
  payload?: AdsflowLatestGenerationPayload | null,
): StudioGenerationStatus | null => {
  if (!payload?.job_id) {
    return null;
  }

  if (!isAdsflowLatestVideoGenerationTask(payload.task_type)) {
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

const STUDIO_VIDEO_PROBE_RANGE = "bytes=0-1";

const extractStudioVideoPathFromProxyUrl = (value: string | null | undefined) => {
  const normalized = normalizeGenerationText(value);
  if (!normalized) {
    return null;
  }

  try {
    const baseUrl = env.appUrl ? new URL(env.appUrl) : new URL("http://localhost");
    const resolvedUrl = new URL(normalized, baseUrl);
    return normalizeGenerationText(resolvedUrl.searchParams.get("path")) || null;
  } catch {
    return null;
  }
};

const isStudioJobVideoProxyUrl = (value: string | null | undefined) => {
  const normalized = normalizeGenerationText(value);
  if (!normalized) {
    return false;
  }

  try {
    const baseUrl = env.appUrl ? new URL(env.appUrl) : new URL("http://localhost");
    const resolvedUrl = new URL(normalized, baseUrl);
    return /^\/api\/studio\/video\/[^/]+$/i.test(resolvedUrl.pathname);
  } catch {
    return false;
  }
};

const isStudioPlaybackUrl = (value: string | null | undefined) => {
  const normalized = normalizeGenerationText(value);
  if (!normalized) {
    return false;
  }

  try {
    const baseUrl = env.appUrl ? new URL(env.appUrl) : new URL("http://localhost");
    const resolvedUrl = new URL(normalized, baseUrl);
    return /^\/api\/studio\/playback\/[^/]+$/i.test(resolvedUrl.pathname);
  } catch {
    return false;
  }
};

const isWorkspaceProjectPlaybackUrl = (value: string | null | undefined) => {
  const normalized = normalizeGenerationText(value);
  if (!normalized) {
    return false;
  }

  try {
    const baseUrl = env.appUrl ? new URL(env.appUrl) : new URL("http://localhost");
    const resolvedUrl = new URL(normalized, baseUrl);
    return /^\/api\/workspace\/projects\/[^/]+\/playback$/i.test(resolvedUrl.pathname);
  } catch {
    return false;
  }
};

const isStudioVideoTargetReachable = async (upstreamUrl: URL) => {
  try {
    const response = await fetch(upstreamUrl, {
      headers: {
        Range: STUDIO_VIDEO_PROBE_RANGE,
      },
    });

    if (!response.ok) {
      void response.body?.cancel();
      return false;
    }

    const contentType = normalizeGenerationText(response.headers.get("content-type")).toLowerCase();
    void response.body?.cancel();
    return !contentType || contentType.startsWith("video/");
  } catch {
    return false;
  }
};

const isStudioGenerationReachable = async (generation: StudioGeneration | null | undefined) => {
  if (!generation?.videoUrl) {
    return false;
  }

  if (
    isStudioJobVideoProxyUrl(generation.videoUrl) ||
    isStudioPlaybackUrl(generation.videoUrl) ||
    isWorkspaceProjectPlaybackUrl(generation.videoUrl)
  ) {
    return true;
  }

  const upstreamPath = extractStudioVideoPathFromProxyUrl(generation.videoUrl);
  if (!upstreamPath) {
    return false;
  }

  try {
    return await isStudioVideoTargetReachable(getStudioVideoProxyTargetByPath(upstreamPath));
  } catch {
    return false;
  }
};

const findReachableWorkspaceFallbackGeneration = async (
  user: StudioUser,
  excludedVideoUrls: string[] = [],
) => {
  const excludedVideoUrlSet = new Set(
    excludedVideoUrls
      .map((value) => normalizeGenerationText(value))
      .filter(Boolean),
  );
  const projects = await getWorkspaceProjects(user);

  for (const project of projects) {
    if (project.status !== "ready" || !project.videoUrl) {
      continue;
    }

    const fallbackGeneration = buildStudioGenerationFromWorkspaceProject(project);
    if (!fallbackGeneration) {
      continue;
    }

    if (excludedVideoUrlSet.has(fallbackGeneration.videoUrl)) {
      continue;
    }

    if (await isStudioGenerationReachable(fallbackGeneration)) {
      return {
        fallbackGeneration,
        fallbackProject: project,
      };
    }
  }

  return {
    fallbackGeneration: null,
    fallbackProject: null,
  };
};

const findWorkspaceHistoryFallbackGeneration = async (
  user: StudioUser,
  excludedVideoUrls: string[] = [],
) => {
  const excludedVideoUrlSet = new Set(
    excludedVideoUrls
      .map((value) => normalizeGenerationText(value))
      .filter(Boolean),
  );

  const historyEntries = await listWorkspaceGenerationHistory(user, 60);
  for (const historyEntry of historyEntries) {
    const fallbackGeneration = buildStudioGenerationFromHistoryEntry(historyEntry);
    if (!fallbackGeneration) {
      continue;
    }

    if (excludedVideoUrlSet.has(normalizeGenerationText(fallbackGeneration.videoUrl))) {
      continue;
    }

    return fallbackGeneration;
  }

  return null;
};

const ADSFLOW_FETCH_RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 502, 503, 504]);
const ADSFLOW_FETCH_RETRY_DELAYS_MS = [250, 700];
const ADSFLOW_FETCH_TIMEOUT_MS = 20_000;

type AdsflowRequestOptions = {
  retryDelaysMs?: number[];
  timeoutMs?: number;
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

const fetchAdsflowResponse = async (url: URL, init?: RequestInit, options?: AdsflowRequestOptions): Promise<Response> => {
  let lastError: unknown = null;
  const retryDelaysMs = options?.retryDelaysMs ?? ADSFLOW_FETCH_RETRY_DELAYS_MS;
  const timeoutMs = options?.timeoutMs ?? ADSFLOW_FETCH_TIMEOUT_MS;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!ADSFLOW_FETCH_RETRYABLE_STATUS_CODES.has(response.status) || attempt === retryDelaysMs.length) {
        return response;
      }

      console.warn(
        `[studio] AdsFlow responded with ${response.status} for ${url.pathname}, retry ${attempt + 1}/${retryDelaysMs.length}`,
      );
    } catch (error) {
      lastError = error;

      if (attempt === retryDelaysMs.length) {
        throw new Error(describeAdsflowFetchFailure(url, error));
      }

      console.warn(
        `[studio] AdsFlow fetch error for ${url.pathname}, retry ${attempt + 1}/${retryDelaysMs.length}`,
        error,
      );
    }

    await wait(retryDelaysMs[attempt] ?? 0);
  }

  throw new Error(lastError ? describeAdsflowFetchFailure(url, lastError) : `AdsFlow unavailable for ${url.origin}${url.pathname}.`);
};

const fetchAdsflowJson = async <T>(url: URL, init?: RequestInit, options?: AdsflowRequestOptions): Promise<T> => {
  const response = await fetchAdsflowResponse(url, init, options);
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

const postAdsflowText = async (path: string, body: Record<string, unknown>, options?: AdsflowRequestOptions) => {
  assertAdsflowConfigured();

  const response = await fetchAdsflowResponse(buildAdsflowUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, options);

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

const postAdsflowJson = async <T>(path: string, body: Record<string, unknown>, options?: AdsflowRequestOptions): Promise<T> => {
  assertAdsflowConfigured();

  return fetchAdsflowJson<T>(buildAdsflowUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, options);
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

const fetchAdsflowSegmentAiPhotoJobStatus = async (jobId: string, user: StudioUser) => {
  assertAdsflowConfigured();

  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const externalUserId = await resolveStudioExternalUserId(user);

  return fetchAdsflowJson<AdsflowSegmentAiPhotoJobStatusResponse>(
    buildAdsflowUrl(`/api/web/segment-ai-photo/jobs/${encodeURIComponent(safeJobId)}`, {
      admin_token: env.adsflowAdminToken ?? "",
      external_user_id: externalUserId,
    }),
  );
};

const fetchAdsflowSegmentAiVideoJobStatus = async (jobId: string, user: StudioUser) => {
  assertAdsflowConfigured();

  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const externalUserId = await resolveStudioExternalUserId(user);

  return fetchAdsflowJson<AdsflowSegmentAiVideoJobStatusResponse>(
    buildAdsflowUrl(`/api/web/segment-ai-video/jobs/${encodeURIComponent(safeJobId)}`, {
      admin_token: env.adsflowAdminToken ?? "",
      external_user_id: externalUserId,
    }),
  );
};

const fetchAdsflowSegmentPhotoAnimationJobStatus = async (jobId: string, user: StudioUser) => {
  assertAdsflowConfigured();

  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const externalUserId = await resolveStudioExternalUserId(user);

  return fetchAdsflowJson<AdsflowSegmentAiVideoJobStatusResponse>(
    buildAdsflowUrl(`/api/web/segment-photo-animation/jobs/${encodeURIComponent(safeJobId)}`, {
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
  const cachedBootstrap = getCachedWorkspaceBootstrap(externalUserId);

  try {
    const payloadText = await postAdsflowText(
      "/api/web/bootstrap",
      {
        admin_token: env.adsflowAdminToken,
        external_user_id: externalUserId,
        language: "ru",
        referral_source: "landing_site",
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
      },
      {
        retryDelaysMs: [],
        timeoutMs: 5_000,
      },
    );
    const payload = parseJson<AdsflowBootstrapResponse>(payloadText);

    if (!payload?.user) {
      throw new Error("AdsFlow did not return web user profile.");
    }

    const profile = await enrichWorkspaceProfile(payload.user, {
      rawUserId: extractAdsflowUserId(payloadText),
    });

    let latestGeneration = buildLatestGenerationStatus(payload.latest_generation);
    const excludedFallbackVideoUrls: string[] = [];

    if (latestGeneration?.generation && !(await isStudioGenerationReachable(latestGeneration.generation))) {
      excludedFallbackVideoUrls.push(latestGeneration.generation.videoUrl);
      latestGeneration = {
        ...latestGeneration,
        generation: undefined,
      };
    }

    if (!latestGeneration?.generation && (!latestGeneration || latestGeneration.status === "done")) {
      try {
        const { fallbackGeneration, fallbackProject } = await findReachableWorkspaceFallbackGeneration(
          user,
          excludedFallbackVideoUrls,
        );

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

    const bootstrap = {
      latestGeneration,
      profile,
      studioOptions: buildWorkspaceStudioOptions(payload.studio_options),
    } satisfies WorkspaceBootstrap;

    if (latestGeneration?.generation) {
      warmStudioGenerationPlayback(latestGeneration.generation, user);
    }

    setCachedWorkspaceBootstrap(externalUserId, bootstrap);
    return bootstrap;
  } catch (error) {
    console.error("[studio] Falling back to local workspace bootstrap", error);

    let latestGeneration = cachedBootstrap?.latestGeneration ?? null;
    const excludedFallbackVideoUrls = latestGeneration?.generation ? [latestGeneration.generation.videoUrl] : [];

    if (!latestGeneration?.generation) {
      try {
        const historyGeneration = await findWorkspaceHistoryFallbackGeneration(user, excludedFallbackVideoUrls);
        if (historyGeneration) {
          latestGeneration = {
            error: latestGeneration?.error,
            generation: historyGeneration,
            jobId: historyGeneration.id,
            status: "done",
          };
        }
      } catch (historyError) {
        console.error("[studio] Failed to load workspace history fallback generation", historyError);
      }
    }

    if (latestGeneration?.generation) {
      warmStudioGenerationPlayback(latestGeneration.generation, user);
    }

    return {
      latestGeneration,
      profile: cachedBootstrap?.profile ?? buildWorkspaceProfile(),
      studioOptions: cachedBootstrap?.studioOptions ?? fallbackWorkspaceStudioOptions,
    };
  }
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
    projectId?: number;
    segmentEditor?: unknown;
    subtitleEnabled?: boolean;
    subtitleColorId?: string;
    subtitleStyleId?: string;
    videoMode?: string;
    voiceEnabled?: boolean;
    voiceId?: string;
  },
): Promise<StudioGenerationJob> {
  assertAdsflowConfigured();

  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
    sourceLanguage: normalizedLanguage,
  });
  const normalizedVideoMode = normalizeStudioVideoMode(options?.videoMode);
  const requiredCredits = STUDIO_GENERATION_CREDIT_COST;
  const creditReservation = await consumeWorkspaceGenerationCredit(user, requiredCredits, normalizedLanguage);
  const externalUserId = await resolveStudioExternalUserId(user);
  const shouldAddWatermark =
    creditReservation.profile.plan === "FREE" &&
    creditReservation.consumed.subscription > 0 &&
    creditReservation.consumed.purchased <= 0;
  const isVoiceEnabled = options?.voiceEnabled !== false;
  const normalizedVoiceId = isVoiceEnabled ? String(options?.voiceId ?? "").trim() || undefined : undefined;
  const normalizedMusicType = normalizeStudioMusicType(options?.musicType);
  const isSubtitleEnabled = options?.subtitleEnabled !== false;
  const normalizedSubtitleStyleId = isSubtitleEnabled ? normalizeStudioSubtitleStyle(options?.subtitleStyleId) : undefined;
  const normalizedSubtitleColorId =
    isSubtitleEnabled && normalizedSubtitleStyleId
      ? normalizeStudioSubtitleColor(
          options?.subtitleColorId,
          getDefaultStudioSubtitleColorForStyle(normalizedSubtitleStyleId),
        )
      : undefined;
  const normalizedCustomMusicFileName = String(options?.customMusicFileName ?? "").trim() || undefined;
  const normalizedCustomMusicFileDataUrl = String(options?.customMusicFileDataUrl ?? "").trim() || undefined;
  const normalizedCustomVideoFileName = String(options?.customVideoFileName ?? "").trim() || undefined;
  const normalizedCustomVideoFileMimeType = String(options?.customVideoFileMimeType ?? "").trim() || undefined;
  const normalizedCustomVideoFileDataUrl = String(options?.customVideoFileDataUrl ?? "").trim() || undefined;
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const normalizedSegmentEditor = normalizeStudioSegmentEditorPayload(options?.segmentEditor, normalizedProjectId ?? undefined);

  if (normalizedMusicType === "custom" && (!normalizedCustomMusicFileName || !normalizedCustomMusicFileDataUrl)) {
    throw new Error("Upload a custom music track or choose a different music mode.");
  }

  if (normalizedVideoMode === "custom" && (!normalizedCustomVideoFileName || !normalizedCustomVideoFileDataUrl)) {
    throw new Error("Upload a custom video or choose a different video mode.");
  }

  if (normalizedSegmentEditor && !options?.isRegeneration) {
    throw new Error("Segment editor can only be used during regeneration.");
  }

  if (normalizedSegmentEditor && !normalizedProjectId) {
    throw new Error("Project id is required for segment editor regeneration.");
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
        prompt: upstreamPrompt,
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
        project_id: normalizedProjectId,
        segment_editor: normalizedSegmentEditor
          ? {
              segments: normalizedSegmentEditor.segments.map((segment) => ({
                custom_video_data_url: segment.customVideoFileDataUrl,
                custom_video_mime_type: segment.customVideoFileMimeType,
                custom_video_original_name: segment.customVideoFileName,
                duration: segment.duration,
                end_time: segment.endTime,
                index: segment.index,
                start_time: segment.startTime,
                text: segment.text,
                video_action: segment.videoAction,
              })),
            }
          : undefined,
        custom_music_data_url: normalizedMusicType === "custom" ? normalizedCustomMusicFileDataUrl : undefined,
        custom_music_original_name: normalizedMusicType === "custom" ? normalizedCustomMusicFileName : undefined,
        subtitle_type: isSubtitleEnabled ? undefined : "none",
        subtitle_color: normalizedSubtitleColorId,
        subtitle_style: normalizedSubtitleStyleId,
        video_mode: normalizedVideoMode,
        voice_type: isVoiceEnabled ? undefined : "none",
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

export async function generateStudioSegmentAiPhoto(
  prompt: string,
  user: StudioUser,
  options?: {
    language?: string;
    projectId?: number;
    segmentIndex?: number;
  },
): Promise<StudioSegmentAiPhotoGenerationResult> {
  assertAdsflowConfigured();

  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
    sourceLanguage: normalizedLanguage,
  });
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
  const creditReservation = await consumeWorkspaceGenerationCredit(user, STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST, normalizedLanguage);
  const externalUserId = await resolveStudioExternalUserId(user);
  let assetReady = false;

  try {
    const payload = await postAdsflowJson<AdsflowSegmentAiPhotoGenerateResponse>("/api/web/segment-ai-photo/generate", {
      admin_token: env.adsflowAdminToken,
      external_user_id: externalUserId,
      language: normalizedLanguage,
      project_id: normalizedProjectId,
      prompt: upstreamPrompt,
      segment_index: normalizedSegmentIndex,
      user_email: user.email ?? undefined,
      user_name: user.name ?? undefined,
    });
    const asset = await normalizeAdsflowSegmentAiPhotoAsset(payload.asset);
    assetReady = true;

    return {
      asset,
      profile: creditReservation.profile,
    };
  } catch (error) {
    if (!(error instanceof WorkspaceCreditLimitError)) {
      try {
        const fallbackAsset = await generateDirectStudioSegmentAiPhoto(upstreamPrompt, {
          segmentIndex: normalizedSegmentIndex,
        });
        assetReady = true;

        return {
          asset: fallbackAsset,
          profile: creditReservation.profile,
        };
      } catch (fallbackError) {
        const upstreamMessage = error instanceof Error ? error.message : "AdsFlow fallback failed.";
        const directMessage =
          fallbackError instanceof Error ? fallbackError.message : "Direct image fallback failed.";
        error = new Error(`Не удалось сгенерировать ИИ фото. AdsFlow: ${upstreamMessage}. DEAPI: ${directMessage}.`);
      }
    }

    if (!assetReady) {
      try {
        await refundWorkspaceGenerationCredit(user, creditReservation.consumed, normalizedLanguage);
      } catch (refundError) {
        console.error("[studio] Failed to refund AI photo credits", refundError);
      }
    }

    throw error;
  }
}

export async function improveStudioSegmentAiPhotoPrompt(
  prompt: string,
  options?: {
    language?: string;
  },
): Promise<StudioSegmentAiPhotoPromptImproveResult> {
  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const modelCandidates = getStudioOpenRouterModelCandidates();
  let lastError: Error | null = null;

  if (env.openrouterApiKey && modelCandidates.length > 0) {
    for (const model of modelCandidates) {
      try {
        const improvedPrompt = await requestStudioSegmentAiPhotoPromptEnhancement(
          normalizedPrompt,
          normalizedLanguage,
          model,
        );
        return {
          prompt: improvedPrompt,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("OpenRouter prompt enhancement failed.");
        console.warn(`[studio] Failed to improve segment AI photo prompt with ${model}`, lastError);
      }
    }
  }

  const fallbackPrompt = buildStudioSegmentAiPhotoPromptEnhancementFallback(normalizedPrompt, normalizedLanguage);
  if (fallbackPrompt) {
    return {
      prompt: fallbackPrompt,
    };
  }

  throw lastError ?? new Error("Failed to improve segment AI photo prompt.");
}

export async function generateStudioContentPlanIdeas(
  query: string,
  options?: {
    count?: number;
    existingIdeas?: StudioContentPlanIdea[];
    language?: string;
  },
): Promise<StudioContentPlanGenerationResult> {
  const normalizedQuery = normalizePrompt(query);
  if (!normalizedQuery) {
    throw new Error("Query is required.");
  }

  const normalizedLanguage = detectStudioPromptLanguage(normalizedQuery, options?.language);
  const requestedCount = normalizeStudioContentPlanIdeaCount(options?.count);
  const modelCandidates = getStudioOpenRouterModelCandidates();
  let lastError: Error | null = null;

  if (env.openrouterApiKey && modelCandidates.length > 0) {
    for (const model of modelCandidates) {
      try {
        const ideas = await requestStudioContentPlanIdeas(
          normalizedQuery,
          normalizedLanguage,
          requestedCount,
          model,
          options?.existingIdeas ?? [],
        );
        return {
          ideas,
          language: normalizedLanguage,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("OpenRouter content plan generation failed.");
        console.warn(`[studio] Failed to generate content plan with ${model}`, lastError);
      }
    }
  }

  throw lastError ?? new Error("Не удалось сгенерировать контент-план.");
}

export async function translateStudioTexts(
  texts: string[],
  options?: {
    sourceLanguage?: string;
    targetLanguage?: string;
  },
): Promise<StudioSegmentTextTranslateResult> {
  const normalizedTexts = texts.map((text) => String(text ?? ""));
  if (normalizedTexts.length === 0) {
    return {
      texts: [],
    };
  }

  const normalizedSourceLanguage = normalizeStudioLanguage(options?.sourceLanguage);
  const normalizedTargetLanguage = normalizeStudioLanguage(options?.targetLanguage);
  if (normalizedSourceLanguage === normalizedTargetLanguage) {
    return {
      texts: normalizedTexts,
    };
  }

  const modelCandidates = getStudioOpenRouterModelCandidates();
  let lastError: Error | null = null;

  if (env.openrouterApiKey && modelCandidates.length > 0) {
    for (const model of modelCandidates) {
      try {
        const translatedTexts = await requestStudioTextTranslation(
          normalizedTexts,
          normalizedSourceLanguage,
          normalizedTargetLanguage,
          model,
        );
        return {
          texts: translatedTexts,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("OpenRouter text translation failed.");
        console.warn(`[studio] Failed to translate segment texts with ${model}`, lastError);
      }
    }
  }

  throw lastError ?? new Error("Text translation is unavailable.");
}

export async function createStudioSegmentAiPhotoJob(
  prompt: string,
  user: StudioUser,
  options?: {
    language?: string;
    projectId?: number;
    segmentIndex?: number;
  },
): Promise<StudioSegmentAiPhotoJob> {
  assertAdsflowConfigured();

  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
    sourceLanguage: normalizedLanguage,
  });
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
  const externalUserId = await resolveStudioExternalUserId(user);
  const payload = await postAdsflowJson<AdsflowSegmentAiPhotoJobCreateResponse>("/api/web/segment-ai-photo/jobs", {
    admin_token: env.adsflowAdminToken,
    credit_cost: STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST,
    external_user_id: externalUserId,
    language: normalizedLanguage,
    project_id: normalizedProjectId,
    prompt: upstreamPrompt,
    segment_index: normalizedSegmentIndex,
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  });

  const jobId = String(payload.job_id ?? "").trim();
  if (!jobId) {
    throw new Error("AdsFlow did not return a segment AI photo job id.");
  }

  return {
    jobId,
    profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
      rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
    }),
    status: String(payload.status ?? "queued"),
  };
}

export async function createStudioSegmentAiVideoJob(
  prompt: string,
  user: StudioUser,
  options?: {
    language?: string;
    projectId?: number;
    segmentIndex?: number;
  },
): Promise<StudioSegmentAiVideoJob> {
  assertAdsflowConfigured();

  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
    sourceLanguage: normalizedLanguage,
  });
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
  const externalUserId = await resolveStudioExternalUserId(user);
  const payload = await postAdsflowJson<AdsflowSegmentAiVideoJobCreateResponse>("/api/web/segment-ai-video/jobs", {
    admin_token: env.adsflowAdminToken,
    credit_cost: STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST,
    external_user_id: externalUserId,
    language: normalizedLanguage,
    project_id: normalizedProjectId,
    prompt: upstreamPrompt,
    segment_index: normalizedSegmentIndex,
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  });

  const jobId = String(payload.job_id ?? "").trim();
  if (!jobId) {
    throw new Error("AdsFlow did not return a segment AI video job id.");
  }

  return {
    jobId,
    profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
      rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
    }),
    status: String(payload.status ?? "queued"),
  };
}

export async function createStudioSegmentPhotoAnimationJob(
  prompt: string,
  user: StudioUser,
  options?: {
    language?: string;
    projectId?: number;
    segmentIndex?: number;
  },
): Promise<StudioSegmentAiVideoJob> {
  assertAdsflowConfigured();

  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
    sourceLanguage: normalizedLanguage,
  });
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
  const externalUserId = await resolveStudioExternalUserId(user);
  const payload = await postAdsflowJson<AdsflowSegmentAiVideoJobCreateResponse>("/api/web/segment-photo-animation/jobs", {
    admin_token: env.adsflowAdminToken,
    credit_cost: STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST,
    external_user_id: externalUserId,
    language: normalizedLanguage,
    project_id: normalizedProjectId,
    prompt: upstreamPrompt,
    segment_index: normalizedSegmentIndex,
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  });

  const jobId = String(payload.job_id ?? "").trim();
  if (!jobId) {
    throw new Error("AdsFlow did not return a segment photo animation job id.");
  }

  return {
    jobId,
    profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
      rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
    }),
    status: String(payload.status ?? "queued"),
  };
}

export async function getStudioSegmentAiPhotoJobStatus(
  jobId: string,
  user: StudioUser,
): Promise<StudioSegmentAiPhotoJobStatus> {
  const payload = await fetchAdsflowSegmentAiPhotoJobStatus(jobId, user);
  const status = String(payload.status ?? "queued").trim() || "queued";
  const safeJobId = String(payload.job_id ?? jobId).trim() || String(jobId ?? "").trim();
  const asset = payload.asset ? await normalizeAdsflowSegmentAiPhotoAsset(payload.asset) : undefined;

  return {
    asset,
    error: normalizeGenerationText(payload.error) || undefined,
    jobId: safeJobId,
    profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
      rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
    }),
    status,
  };
}

export async function getStudioSegmentAiVideoJobStatus(
  jobId: string,
  user: StudioUser,
): Promise<StudioSegmentAiVideoJobStatus> {
  const payload = await fetchAdsflowSegmentAiVideoJobStatus(jobId, user);
  const status = String(payload.status ?? "queued").trim() || "queued";
  const safeJobId = String(payload.job_id ?? jobId).trim() || String(jobId ?? "").trim();
  const asset = payload.asset ? normalizeAdsflowSegmentAiVideoAsset(safeJobId, payload.asset) : undefined;
  if (asset) {
    warmStudioGeneratedVideoPlayback("segment-ai-video", safeJobId, user);
    warmStudioGeneratedVideoPoster("segment-ai-video", safeJobId, user);
  }

  return {
    asset,
    error: normalizeGenerationText(payload.error) || undefined,
    jobId: safeJobId,
    profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
      rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
    }),
    status,
  };
}

export async function getStudioSegmentPhotoAnimationJobStatus(
  jobId: string,
  user: StudioUser,
): Promise<StudioSegmentAiVideoJobStatus> {
  const payload = await fetchAdsflowSegmentPhotoAnimationJobStatus(jobId, user);
  const status = String(payload.status ?? "queued").trim() || "queued";
  const safeJobId = String(payload.job_id ?? jobId).trim() || String(jobId ?? "").trim();
  const asset = payload.asset ? normalizeAdsflowSegmentPhotoAnimationAsset(safeJobId, payload.asset) : undefined;
  if (asset) {
    warmStudioGeneratedVideoPlayback("segment-photo-animation", safeJobId, user);
    warmStudioGeneratedVideoPoster("segment-photo-animation", safeJobId, user);
  }

  return {
    asset,
    error: normalizeGenerationText(payload.error) || undefined,
    jobId: safeJobId,
    profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
      rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
    }),
    status,
  };
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
      console.warn("[studio] Done generation is missing playable preview metadata", {
        adId: payload.ad_id ?? null,
        downloadPath: payload.download_path ?? null,
        jobId: safeJobId,
        status,
      });
      return {
        jobId: safeJobId,
        status,
        error: "Готовое видео недоступно как прямой media-файл.",
      };
    }

    warmStudioGenerationPlayback(generation, user);

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

  return buildTrustedStudioVideoTarget(normalized);
}

const getStudioVideoProxyTargetFromWorkspaceHistory = async (jobId: string, user: StudioUser) => {
  const safeJobId = normalizeGenerationText(jobId);
  if (!safeJobId) {
    return null;
  }

  const historyEntries = await listWorkspaceGenerationHistory(user, 200);
  const historyEntry =
    historyEntries.find((entry) => normalizeGenerationText(entry.jobId) === safeJobId) ?? null;
  const downloadPath = normalizeGenerationText(historyEntry?.downloadPath);

  if (!downloadPath) {
    return null;
  }

  return buildTrustedStudioVideoTarget(downloadPath);
};

export async function getStudioVideoProxyTarget(jobId: string, user: StudioUser): Promise<URL> {
  let fallbackError: Error | null = null;

  try {
    const payload = await fetchAdsflowJobStatus(jobId, user);

    if (String(payload.status ?? "") !== "done") {
      throw new Error("Video is not ready yet.");
    }

    const downloadPath = String(payload.download_path ?? "").trim();
    if (!downloadPath) {
      throw new Error("AdsFlow did not return a download path.");
    }

    return buildTrustedStudioVideoTarget(downloadPath);
  } catch (error) {
    fallbackError = error instanceof Error ? error : new Error("Failed to resolve generated video.");
  }

  try {
    const fallbackTarget = await getStudioVideoProxyTargetFromWorkspaceHistory(jobId, user);
    if (fallbackTarget) {
      return fallbackTarget;
    }
  } catch (error) {
    console.error("[studio] Failed to resolve generated video from workspace history", error);
  }

  throw fallbackError ?? new Error("Failed to resolve generated video.");
}

export async function getStudioSegmentAiVideoJobFileProxyTarget(jobId: string, user: StudioUser): Promise<URL> {
  assertAdsflowConfigured();

  const safeJobId = normalizeGenerationText(jobId);
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const externalUserId = await resolveStudioExternalUserId(user);
  return buildAdsflowUrl(`/api/web/segment-ai-video/jobs/${encodeURIComponent(safeJobId)}/file`, {
    admin_token: env.adsflowAdminToken ?? "",
    external_user_id: externalUserId,
  });
}

export async function getStudioSegmentPhotoAnimationJobFileProxyTarget(jobId: string, user: StudioUser): Promise<URL> {
  assertAdsflowConfigured();

  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const externalUserId = await resolveStudioExternalUserId(user);

  return buildAdsflowUrl(`/api/web/segment-photo-animation/jobs/${encodeURIComponent(safeJobId)}/file`, {
    admin_token: env.adsflowAdminToken ?? "",
    external_user_id: externalUserId,
  });
}

type StudioGeneratedVideoPosterKind = "segment-ai-video" | "segment-photo-animation";

const getStudioGeneratedVideoPlaybackSource = async (
  kind: StudioGeneratedVideoPosterKind,
  jobId: string,
  user: StudioUser,
): Promise<WorkspaceProjectPlaybackSource> => {
  const safeJobId = normalizeGenerationText(jobId);
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const upstreamUrl =
    kind === "segment-ai-video"
      ? await getStudioSegmentAiVideoJobFileProxyTarget(safeJobId, user)
      : await getStudioSegmentPhotoAnimationJobFileProxyTarget(safeJobId, user);

  return {
    cacheKey: getWorkspaceProjectPlaybackCacheKey({
      projectId: `${kind}:${safeJobId}`,
      targetUrl: upstreamUrl,
      updatedAt: safeJobId,
    }),
    projectId: `${kind}:${safeJobId}`,
    upstreamUrl,
  };
};

const warmStudioGeneratedVideoPlayback = (kind: StudioGeneratedVideoPosterKind, jobId: string, user: StudioUser) => {
  void getStudioGeneratedVideoPlaybackSource(kind, jobId, user)
    .then((playbackSource) => warmWorkspaceProjectPlayback(playbackSource))
    .catch((error) => {
      console.error("[studio] Failed to warm generated segment video playback cache", {
        error: error instanceof Error ? error.message : "Unknown generated segment video playback warmup error.",
        jobId,
        kind,
      });
    });
};

const getStudioGeneratedVideoPlaybackAsset = async (
  kind: StudioGeneratedVideoPosterKind,
  jobId: string,
  user: StudioUser,
): Promise<WorkspaceProjectPlaybackAsset> => {
  return ensureWorkspaceProjectPlayback(await getStudioGeneratedVideoPlaybackSource(kind, jobId, user));
};

const getStudioGeneratedVideoPosterSource = async (
  kind: StudioGeneratedVideoPosterKind,
  jobId: string,
  user: StudioUser,
): Promise<WorkspaceVideoPosterSource> => {
  const safeJobId = normalizeGenerationText(jobId);
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const playbackAsset = await getStudioGeneratedVideoPlaybackAsset(kind, safeJobId, user);

  return {
    cacheKey: getWorkspaceVideoPosterCacheKey({
      posterId: `${kind}:${safeJobId}`,
      targetUrl: pathToFileURL(playbackAsset.absolutePath),
      version: safeJobId,
    }),
    posterId: `${kind}:${safeJobId}`,
    upstreamUrl: pathToFileURL(playbackAsset.absolutePath),
  };
};

const warmStudioGeneratedVideoPoster = (kind: StudioGeneratedVideoPosterKind, jobId: string, user: StudioUser) => {
  void getStudioGeneratedVideoPosterSource(kind, jobId, user)
    .then((posterSource) => warmWorkspaceVideoPoster(posterSource))
    .catch((error) => {
      console.error("[studio] Failed to warm generated video poster", {
        error: error instanceof Error ? error.message : "Unknown generated video poster warmup error.",
        jobId,
        kind,
      });
    });
};

export async function getStudioSegmentAiVideoJobPosterPath(jobId: string, user: StudioUser): Promise<string> {
  return ensureWorkspaceVideoPoster(await getStudioGeneratedVideoPosterSource("segment-ai-video", jobId, user));
}

export async function getStudioSegmentPhotoAnimationJobPosterPath(jobId: string, user: StudioUser): Promise<string> {
  return ensureWorkspaceVideoPoster(await getStudioGeneratedVideoPosterSource("segment-photo-animation", jobId, user));
}

export async function getStudioSegmentAiVideoPlaybackAsset(
  jobId: string,
  user: StudioUser,
): Promise<WorkspaceProjectPlaybackAsset> {
  return getStudioGeneratedVideoPlaybackAsset("segment-ai-video", jobId, user);
}

export async function getStudioSegmentPhotoAnimationPlaybackAsset(
  jobId: string,
  user: StudioUser,
): Promise<WorkspaceProjectPlaybackAsset> {
  return getStudioGeneratedVideoPlaybackAsset("segment-photo-animation", jobId, user);
}

const getStudioPlaybackSource = async (
  options: {
    jobId: string;
    preferredPath?: string | null;
    version?: string | null;
  },
  user: StudioUser,
): Promise<WorkspaceProjectPlaybackSource> => {
  const safeJobId = normalizeGenerationText(options.jobId);
  if (!safeJobId) {
    throw new Error("Studio job id is required.");
  }

  const upstreamUrl = options.preferredPath
    ? getStudioVideoProxyTargetByPath(options.preferredPath)
    : await getStudioVideoProxyTarget(safeJobId, user);

  return {
    cacheKey: getWorkspaceProjectPlaybackCacheKey({
      projectId: `studio:${safeJobId}`,
      targetUrl: upstreamUrl,
      updatedAt: normalizeGenerationText(options.version) || safeJobId,
    }),
    projectId: `studio:${safeJobId}`,
    upstreamUrl,
  };
};

const warmStudioGenerationPlayback = (generation: StudioGeneration | null | undefined, user: StudioUser) => {
  const safeJobId = normalizeGenerationText(generation?.id);
  if (!safeJobId || !generation?.videoUrl || !isStudioPlaybackUrl(generation.videoUrl)) {
    return;
  }

  const preferredPath = extractStudioVideoPathFromProxyUrl(generation.videoFallbackUrl ?? generation.videoUrl);

  void getStudioPlaybackSource(
    {
      jobId: safeJobId,
      preferredPath,
      version: generation.generatedAt,
    },
    user,
  )
    .then((playbackSource) => warmWorkspaceProjectPlayback(playbackSource))
    .catch((error) => {
      console.error("[studio] Failed to warm studio playback cache", {
        error: error instanceof Error ? error.message : "Unknown studio playback warmup error.",
        jobId: safeJobId,
      });
    });
};

export async function getStudioPlaybackAsset(
  jobId: string,
  user: StudioUser,
  options?: {
    preferredPath?: string | null;
    version?: string | null;
  },
): Promise<WorkspaceProjectPlaybackAsset> {
  const playbackSource = await getStudioPlaybackSource(
    {
      jobId,
      preferredPath: options?.preferredPath,
      version: options?.version,
    },
    user,
  );

  return ensureWorkspaceProjectPlayback(playbackSource);
}
