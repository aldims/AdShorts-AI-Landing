import { env } from "./env.js";
import { buildAuthScopedCacheKey, buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
import {
  buildWorkspaceMediaAssetRef,
  mergeWorkspaceMediaAssetRefs,
} from "./media-assets.js";
import {
  STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST,
  STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST_BY_QUALITY,
  STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST,
  STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST_BY_QUALITY,
  STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST,
  STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST,
  getStudioSegmentPhotoAnimationCreditCost,
  getStudioSegmentVoiceoverCreditCost,
  normalizeStudioSegmentPhotoAnimationDurationSeconds,
  STUDIO_SEGMENT_SCENE_SOUND_CREDIT_COST,
  STUDIO_SEGMENT_TALKING_PHOTO_CREDIT_COST,
  STUDIO_WORKSPACE_CHARACTER_REFERENCE_CREDIT_COST,
  STUDIO_PREMIUM_VOICE_CREDIT_COST,
  STUDIO_PREMIUM_VIDEO_GENERATION_CREDIT_COST,
  STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST,
  type StudioSegmentVisualQuality,
} from "../shared/studio-credit-costs.js";
import {
  normalizeExamplePrefillStudioSettings,
  type ExamplePrefillStudioSettings,
} from "../shared/example-prefill.js";
import {
  DEFAULT_LOCALE,
  DEFAULT_STUDIO_VOICE_ID,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type Locale,
} from "../shared/locales.js";
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
import {
  getWorkspaceGenerationHistoryEntry,
  listWorkspaceDeletedProjects,
  listWorkspaceGenerationHistory,
  saveWorkspaceGenerationHistory,
  type WorkspaceDeletedProjectEntry,
  type WorkspaceGenerationHistoryEntry,
} from "./workspace-history.js";
import { resolveGenerationPresentation } from "./generation-metadata.js";
import { postAdsflowText as postAdsflowTextWithPolicy, upstreamPolicies } from "./upstream-client.js";
import {
  addCurrentAdsflowWebDeviceToBody,
  getCurrentAdsflowWebSignalHeaders,
} from "./web-device.js";
import {
  createWaveSpeedImageUpscaleJob,
  createWaveSpeedGptImage2EditJob,
  createWaveSpeedGptImage2TextToImageJob,
  getWaveSpeedPredictionOutputUrl,
  getWaveSpeedPredictionStatus,
  WAVESPEED_GPT_IMAGE_2_EDIT_MODEL,
  WAVESPEED_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL,
} from "./wavespeed-worker.js";
import { normalizeWebReferralSource } from "./referral.js";
import type { WorkspaceMediaAssetRef } from "../shared/workspace-media-assets.js";

type StudioUser = {
  email?: string | null;
  emailVerified?: boolean | null;
  id?: string | null;
  name?: string | null;
};

type WorkspaceBootstrapOptions = {
  referralSource?: string | null;
};

type AdsflowCreateJobResponse = {
  enqueue_error?: string | null;
  job_id?: string;
  status?: string;
  title?: string;
};

type AdsflowHealthResponse = {
  components?: {
    database?: unknown;
    redis?: unknown;
    task_queue?: unknown;
    workers?: unknown;
  } | null;
  status?: string | null;
};

type AdsflowMediaAssetPayload = {
  id?: number | null;
  kind?: string | null;
  media_type?: string | null;
  mime_type?: string | null;
  download_path?: string | null;
  download_url?: string | null;
};

type AdsflowMediaUploadResponse = {
  asset?: AdsflowMediaAssetPayload | null;
  success?: boolean;
};

type AdsflowMediaUploadInitResponse = AdsflowMediaUploadResponse & {
  upload?: {
    expires_in?: number | null;
    headers?: Record<string, string> | null;
    method?: string | null;
    url?: string | null;
  } | null;
};

type AdsflowJobStatusResponse = {
  ad_id?: number | null;
  description?: string | null;
  download_path?: string | null;
  error?: string | null;
  generated_at?: string | null;
  hashtags?: string | null;
  job_id?: string;
  media_asset_id?: number | null;
  prompt?: string | null;
  project_status?: string | null;
  ready?: boolean | null;
  ready_reason?: string | null;
  status?: string;
  title?: string | null;
};

type AdsflowWebUserPayload = {
  balance?: number;
  plan?: string;
  startPlanAvailable?: boolean | number | string | null;
  startPlanUsed?: boolean | number | string | null;
  start_plan_available?: boolean | number | string | null;
  start_plan_used?: boolean | number | string | null;
  subscription_expires_at?: string | null;
  user_id?: number | string | null;
};

type AdsflowAdminUserDetailsResponse = {
  user?: {
    user_id?: number | string | null;
    username?: string | null;
    subscription_type?: string | null;
    subscription_expires_at?: string | null;
  };
  payments?: Array<{
    paid_at?: string | null;
    plan_code?: string | null;
    status?: string | null;
  }>;
};

type AdsflowAdminUsersListResponse = {
  items?: Array<NonNullable<AdsflowAdminUserDetailsResponse["user"]> & {
    first_name?: string | null;
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
  media_asset_id?: number | null;
  prompt?: string | null;
  project_status?: string | null;
  ready?: boolean | null;
  ready_reason?: string | null;
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
  media_asset_id?: number | null;
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

type AdsflowProjectCharacterPayload = {
  aliases?: unknown;
  character_id?: number | string | null;
  characterId?: number | string | null;
  description?: string | null;
  label?: string | null;
  reference_asset_ids?: unknown;
  referenceAssetIds?: unknown;
  source_segment_ids?: unknown;
  sourceSegmentIds?: unknown;
};

type AdsflowProjectCharactersResponse = {
  characters?: AdsflowProjectCharacterPayload[] | null;
  project_id?: number | string | null;
};

type AdsflowSegmentAiVideoAssetPayload = {
  download_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  media_asset_id?: number | null;
  mime_type?: string | null;
  remote_url?: string | null;
  url?: string | null;
};

type AdsflowSegmentVoiceoverSpeechWordPayload = {
  confidence?: number | string | null;
  end_time?: number | string | null;
  start_time?: number | string | null;
  text?: string | null;
};

type AdsflowSegmentAiVideoJobCreateResponse = {
  job_id?: string;
  status?: string;
  user?: AdsflowWebUserPayload | null;
};

type AdsflowSegmentTalkingPhotoPreviewOverlayPayload = {
  box?: {
    height?: number | null;
    width?: number | null;
    x?: number | null;
    y?: number | null;
  } | null;
  data_url?: string | null;
  height?: number | null;
  mime_type?: string | null;
  width?: number | null;
};

type AdsflowSegmentTalkingPhotoPreviewResponse = {
  confirmation_token?: string | null;
  expires_in_seconds?: number | null;
  overlay?: AdsflowSegmentTalkingPhotoPreviewOverlayPayload | null;
  project_id?: number | string | null;
  segment_index?: number | string | null;
  source_asset_id?: number | string | null;
  source_media_type?: string | null;
  speaker_target?: unknown;
  user?: AdsflowWebUserPayload | null;
};

type AdsflowSegmentAiVideoJobStatusResponse = {
  asset?: AdsflowSegmentAiVideoAssetPayload | null;
  error?: string | null;
  job_id?: string;
  status?: string;
  user?: AdsflowWebUserPayload | null;
};

type AdsflowSegmentVoiceoverJobStatusResponse = AdsflowSegmentAiVideoJobStatusResponse & {
  speech_duration?: number | string | null;
  speech_end_time?: number | string | null;
  speech_start_time?: number | string | null;
  speech_words?: AdsflowSegmentVoiceoverSpeechWordPayload[] | null;
};

type WorkspaceCreditConsumption = {
  purchased: number;
  subscription: number;
};

export type WorkspaceProfile = {
  balance: number;
  expiresAt: string | null;
  plan: string;
  startPlanUsed: boolean;
  userId?: string | null;
};

const normalizeWorkspaceSubscriptionPlanCode = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "start" || normalized === "pro" || normalized === "ultra" ? normalized : null;
};

const getWorkspaceSubscriptionPlanDurationDays = (planCode: string | null | undefined) =>
  planCode === "pro" || planCode === "ultra" ? 30 : 0;

export const resolveWorkspaceSubscriptionDetailsFromAdminPayload = (
  payload: AdsflowAdminUserDetailsResponse,
  options?: {
    currentPlanHint?: string | null;
  },
): WorkspaceSubscriptionDetails => {
  const successfulPayments = Array.isArray(payload.payments)
    ? payload.payments.filter((payment) => String(payment?.status ?? "").trim().toLowerCase() === "succeeded")
    : [];
  const hasSuccessfulStartPayment = successfulPayments.some(
    (payment) => String(payment?.plan_code ?? "").trim().toLowerCase() === "start",
  );

  const currentPlan =
    normalizeWorkspaceSubscriptionPlanCode(payload.user?.subscription_type) ??
    normalizeWorkspaceSubscriptionPlanCode(options?.currentPlanHint);
  const userId = getWorkspaceSubscriptionExpiryCacheKey(payload.user?.user_id) ?? null;
  const startPlanUsed = hasSuccessfulStartPayment || currentPlan === "start";
  const resolvePlanLabel = (planCode: "start" | "pro" | "ultra" | null | undefined) =>
    planCode ? planCode.toUpperCase() : null;

  const directExpiry = currentPlan === "start" ? null : normalizeGenerationText(payload.user?.subscription_expires_at) || null;
  if (directExpiry) {
    return {
      expiresAt: directExpiry,
      plan: resolvePlanLabel(currentPlan),
      startPlanUsed,
      userId,
    };
  }

  const candidatePayments = currentPlan
    ? successfulPayments.filter((payment) => normalizeWorkspaceSubscriptionPlanCode(payment?.plan_code) === currentPlan)
    : successfulPayments.filter((payment) => normalizeWorkspaceSubscriptionPlanCode(payment?.plan_code) !== null);
  const latestSuccessfulPayment = candidatePayments
    .map((payment) => {
      const paidAt = normalizeGenerationText(payment.paid_at);
      const parsedPaidAt = paidAt ? new Date(paidAt) : null;
      return Number.isNaN(parsedPaidAt?.getTime?.() ?? Number.NaN)
        ? null
        : {
            paidAt: parsedPaidAt,
            planCode: normalizeWorkspaceSubscriptionPlanCode(payment.plan_code),
          };
    })
    .filter(
      (
        value,
      ): value is {
        paidAt: Date;
        planCode: "start" | "pro" | "ultra" | null;
      } => value instanceof Object && value.paidAt instanceof Date,
    )
    .sort((left, right) => right.paidAt.getTime() - left.paidAt.getTime())[0] ?? null;

  const effectivePlanCode = currentPlan ?? latestSuccessfulPayment?.planCode ?? null;
  const planDurationDays = getWorkspaceSubscriptionPlanDurationDays(effectivePlanCode);
  if (!planDurationDays || !latestSuccessfulPayment) {
    return {
      expiresAt: null,
      plan: resolvePlanLabel(effectivePlanCode),
      startPlanUsed,
      userId,
    };
  }

  const derivedExpiry = new Date(latestSuccessfulPayment.paidAt.getTime());
  derivedExpiry.setUTCDate(derivedExpiry.getUTCDate() + planDurationDays);

  return {
    expiresAt: derivedExpiry.toISOString(),
    plan: resolvePlanLabel(effectivePlanCode),
    startPlanUsed,
    userId,
  };
};

export type StudioGeneratedImageAsset = {
  assetId?: number | null;
  dataUrl?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  remoteUrl?: string;
};

export type StudioGeneratedVideoAsset = {
  assetId?: number | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  posterUrl: string | null;
  remoteUrl: string;
};

export type StudioGeneratedAudioAsset = {
  assetId?: number | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
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

export type StudioProjectCharacter = {
  aliases: string[];
  characterId: number;
  description: string | null;
  label: string;
  referenceAssetIds: number[];
  sourceSegmentIds: number[];
};

export type StudioProjectCharactersResult = {
  characters: StudioProjectCharacter[];
  projectId: number;
};

export type StudioSegmentSceneSoundJob = {
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

export type StudioSegmentSceneSoundJobStatus = {
  asset?: StudioGeneratedAudioAsset;
  error?: string;
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

export type StudioSegmentVoiceoverSpeechWord = {
  confidence: number;
  endTime: number;
  startTime: number;
  text: string;
};

export type StudioSegmentVoiceoverJob = {
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

export type StudioSegmentVoiceoverJobStatus = {
  asset?: StudioGeneratedAudioAsset;
  error?: string;
  jobId: string;
  profile: WorkspaceProfile;
  speechDuration: number | null;
  speechEndTime: number | null;
  speechStartTime: number | null;
  speechWords: StudioSegmentVoiceoverSpeechWord[];
  status: string;
};

type StudioSegmentPromptImproveMode = "ai_photo" | "ai_video" | "photo_animation" | "image_edit";

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

export type StudioGenerationAvailability = {
  available: boolean;
  reason: string | null;
  status: string | null;
  workersOnline: number | null;
};

type WorkspaceBootstrapCacheEntry = {
  bootstrap: WorkspaceBootstrap;
  expiresAt: number;
};

type WorkspaceSubscriptionDetails = {
  expiresAt: string | null;
  plan: string | null;
  startPlanUsed: boolean;
  userId: string | null;
};

type WorkspaceSubscriptionExpiryCacheEntry = {
  expiresAt: number;
  value: WorkspaceSubscriptionDetails;
};

export class WorkspaceCreditLimitError extends Error {
  constructor(message = "На тарифе FREE доступна 1 бесплатная генерация. Обновите тариф, чтобы продолжить.") {
    super(message);
    this.name = "WorkspaceCreditLimitError";
  }
}

export const STUDIO_GENERATION_UNAVAILABLE_ERROR_CODE = "generation_unavailable";
export const STUDIO_GENERATION_UNAVAILABLE_MESSAGE = "Генерация временно недоступна. Кредиты не списаны — попробуйте позже.";

export class StudioGenerationUnavailableError extends Error {
  code = STUDIO_GENERATION_UNAVAILABLE_ERROR_CODE;

  constructor(message = STUDIO_GENERATION_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "StudioGenerationUnavailableError";
  }
}

export type StudioGeneration = {
  adId: number | null;
  aspectRatio: string;
  description: string;
  durationLabel: string;
  finalAsset: WorkspaceMediaAssetRef | null;
  generatedAt: string;
  hashtags: string[];
  id: string;
  isReadyForEditor: boolean | null;
  modelLabel: string;
  prefillSettings: ExamplePrefillStudioSettings | null;
  prompt: string;
  projectStatus: string | null;
  readyReason: string | null;
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
  isReadyForEditor?: boolean | null;
  jobId: string;
  projectStatus?: string | null;
  readyReason?: string | null;
  status: string;
};

export type StudioSegmentEditorVideoAction = "ai" | "custom" | "original";
export type StudioSegmentEditorDurationMode = "auto" | "manual";

export type StudioSegmentEditorSegment = {
  customVideoAssetId?: number;
  customVideoFileDataUrl?: string;
  customVideoFileMimeType?: string;
  customVideoFileName?: string;
  duration?: number;
  durationExtensionSourceDurationSeconds?: number | null;
  durationMode?: StudioSegmentEditorDurationMode;
  endTime?: number;
  index: number;
  manualDurationSeconds?: number | null;
  resetVisual?: boolean;
  sceneSoundAssetId?: number;
  startTime?: number;
  subtitleColor?: string | null;
  subtitleStyle?: string | null;
  subtitleType?: string | null;
  text: string;
  videoAction: StudioSegmentEditorVideoAction;
  voiceoverAssetId?: number;
  voiceType?: string | null;
};

export type StudioSegmentEditorPayload = {
  allowStructureChange?: boolean;
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

const studioSupportedPromptImproveModes = new Set([
  "ai_photo",
  "ai_video",
  "photo_animation",
  "image_edit",
]);

const studioSupportedSegmentVisualQualities = new Set(["standard", "premium"]);

const studioSupportedSegmentVideoActions = new Set(["ai", "custom", "original"]);

const studioRussianVoiceIds = new Set([
  "Bys_24000",
  "Liam",
  "English_ManWithDeepVoice",
  "Russian_BrightHeroine",
  "Nec_24000",
  "Tur_24000",
  "May_24000",
  "Ost_24000",
  "Pon_24000",
  "male-qn-jingying",
]);
const studioEnglishVoiceIds = new Set([
  "Aiden",
  "Ryan",
  "Serena",
  "Vivian",
  "Uncle_Fu",
  "Dylan",
  "Eric",
  "Ono_Anna",
  "Sohee",
]);
const WORKSPACE_BOOTSTRAP_CACHE_TTL_MS = 5 * 60_000;
const WORKSPACE_SUBSCRIPTION_EXPIRY_CACHE_TTL_MS = 10 * 60_000;
const WORKSPACE_SUBSCRIPTION_EXPIRY_TIMEOUT_MS = 5_000;
const FALLBACK_WORKSPACE_SUBSCRIPTION_DETAILS: WorkspaceSubscriptionDetails = {
  expiresAt: null,
  plan: null,
  startPlanUsed: false,
  userId: null,
};
const WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS = 1;
const WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS = 8;
const STUDIO_GENERATION_PREPARING_PREVIEW_STATUS = "preparing_preview";
const workspaceBootstrapCache = new Map<string, WorkspaceBootstrapCacheEntry>();
const workspaceSubscriptionExpiryCache = new Map<string, WorkspaceSubscriptionExpiryCacheEntry>();
const workspaceSubscriptionExpiryInFlight = new Map<string, Promise<WorkspaceSubscriptionDetails>>();
const OPENROUTER_STUDIO_PROMPT_TIMEOUT_MS = 30_000;
const OPENROUTER_STUDIO_VISUAL_JOB_TRANSLATION_TIMEOUT_MS = 4_000;
const OPENROUTER_STUDIO_PROMPT_HTTP_REFERER = "https://adshorts.ai";
const OPENROUTER_STUDIO_PROMPT_TITLE = "AdShorts Studio Prompt Enhancer";
const OPENROUTER_STUDIO_PROMPT_ENHANCEMENT_PRIMARY_MODEL = "google/gemini-3-flash-preview";
const STUDIO_OPENROUTER_MISSING_CONFIG_ERROR =
  "OpenRouter is not configured on this server. Set a valid OPENROUTER_API_KEY or ADSHORTS_SHARED_ENV_FILE.";

const normalizePrompt = (value: string) => value.replace(/\s+/g, " ").trim();

const hasUsableOpenRouterApiKey = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  if (
    lowered === "your_api_key" ||
    lowered === "your-openrouter-api-key" ||
    lowered === "openrouter_api_key" ||
    lowered === "changeme" ||
    lowered === "change-me" ||
    lowered === "replace_me" ||
    lowered === "replace-me" ||
    lowered.includes("your_api") ||
    lowered.includes("placeholder")
  ) {
    return false;
  }

  return true;
};

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

const normalizeGenerationText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

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

const normalizeStudioSegmentVisualQuality = (value: unknown): StudioSegmentVisualQuality => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return studioSupportedSegmentVisualQualities.has(normalized)
    ? (normalized as StudioSegmentVisualQuality)
    : "standard";
};

const getStudioSegmentAiPhotoCreditCost = (quality: StudioSegmentVisualQuality) =>
  STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST_BY_QUALITY[quality] ?? STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST;

const getStudioSegmentAiVideoCreditCost = (quality: StudioSegmentVisualQuality) =>
  STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST_BY_QUALITY[quality] ?? STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST;

const getStudioSegmentPhotoAnimationRequiredCredits = (
  quality: StudioSegmentVisualQuality,
  durationSeconds: unknown,
) => getStudioSegmentPhotoAnimationCreditCost(quality, durationSeconds);

const studioPremiumVoiceIds = new Set([
  "Liam",
  "English_ManWithDeepVoice",
  "Russian_BrightHeroine",
]);

const getCanonicalStudioVoiceId = (voiceId: string | null | undefined) => {
  const normalizedVoiceId = normalizeGenerationText(voiceId);
  if (!normalizedVoiceId || normalizedVoiceId === "none") {
    return null;
  }

  const normalizedVoiceKey = normalizedVoiceId.toLowerCase();
  for (const candidateVoiceId of [...studioRussianVoiceIds, ...studioEnglishVoiceIds]) {
    if (candidateVoiceId.toLowerCase() === normalizedVoiceKey) {
      return candidateVoiceId;
    }
  }

  return null;
};

export const getStudioVoiceCreditCost = (voiceId: string | null | undefined) => {
  const canonicalVoiceId = getCanonicalStudioVoiceId(voiceId);
  return canonicalVoiceId && studioPremiumVoiceIds.has(canonicalVoiceId) ? STUDIO_PREMIUM_VOICE_CREDIT_COST : 0;
};

const buildStudioSegmentVisualQualityPayload = (quality: StudioSegmentVisualQuality) =>
  quality === "premium"
    ? {
        generation_quality: quality,
        quality,
      }
    : {};

const WAVESPEED_SEGMENT_AI_VIDEO_JOB_PREFIX = "wavespeed:";
const WAVESPEED_SEGMENT_AI_PHOTO_JOB_PREFIX = "wavespeed-image:";
const WORKSPACE_CHARACTER_REFERENCE_GPT_IMAGE_2_QUALITY = "medium" as const;
const WORKSPACE_CHARACTER_REFERENCE_GPT_IMAGE_2_RESOLUTION = "2k" as const;
type WaveSpeedSegmentAiPhotoJobContext = {
  asset?: StudioGeneratedImageAsset;
  baseOutputUrl?: string;
  consumed: WorkspaceCreditConsumption;
  language: "en" | "ru";
  ownerExternalUserId: string;
  profile: WorkspaceProfile;
  projectId?: number | null;
  refunded?: boolean;
  referenceKind?: string;
  segmentIndex?: number | null;
  upscalePredictionId?: string;
  upscaleRequired?: boolean;
};

const studioWaveSpeedSegmentAiVideoJobContexts = new Map<
  string,
  {
    ownerExternalUserId: string;
    profile: WorkspaceProfile;
  }
>();
const studioWaveSpeedSegmentAiPhotoJobContexts = new Map<string, WaveSpeedSegmentAiPhotoJobContext>();

const parseWaveSpeedSegmentAiVideoPredictionId = (jobId: string | null | undefined) => {
  const normalizedJobId = normalizeGenerationText(jobId);
  if (!normalizedJobId.startsWith(WAVESPEED_SEGMENT_AI_VIDEO_JOB_PREFIX)) {
    return null;
  }

  const predictionId = normalizeGenerationText(normalizedJobId.slice(WAVESPEED_SEGMENT_AI_VIDEO_JOB_PREFIX.length));
  return predictionId || null;
};

const parseWaveSpeedSegmentAiPhotoPredictionId = (jobId: string | null | undefined) => {
  const normalizedJobId = normalizeGenerationText(jobId);
  if (!normalizedJobId.startsWith(WAVESPEED_SEGMENT_AI_PHOTO_JOB_PREFIX)) {
    return null;
  }

  const predictionId = normalizeGenerationText(normalizedJobId.slice(WAVESPEED_SEGMENT_AI_PHOTO_JOB_PREFIX.length));
  return predictionId || null;
};

const normalizeWaveSpeedSegmentAiPhotoFileName = (jobId: string, referenceKind?: string) => {
  const normalizedKind = normalizeGenerationText(referenceKind).replace(/[^a-z0-9_-]+/gi, "-") || "reference";
  const normalizedJobId = normalizeGenerationText(jobId).replace(/[^a-z0-9_-]+/gi, "-") || "wavespeed";
  return `${normalizedKind}-image-${normalizedJobId}.png`;
};

const buildWorkspaceReferenceCharacterSheetPrompt = (
  prompt: string,
  options?: {
    sourceMode?: "reference_image" | "text";
  },
) => {
  const normalizedPrompt = normalizePrompt(prompt);
  const sourceInstruction =
    options?.sourceMode === "reference_image"
      ? "Use the provided source image as the identity and styling reference. Preserve the recognizable face, hair, body type, age, outfit silhouette, color palette, and overall character feel unless the user description explicitly changes them."
      : "Design the character from the user description only, with a coherent identity that stays identical across all views.";

  return [
    "Create one square 1:1 professional character reference sheet in a single image.",
    sourceInstruction,
    "Use one consistent visual style, one consistent character identity, one consistent outfit, and one consistent studio lighting setup across every panel.",
    "Layout: a large full-body hero view on the left; on the right, a clean grid with front view, three-quarter view, side/profile view, back view, two dynamic action poses, and two close-up head/face portraits.",
    "Use a dark neutral studio background with subtle panel dividers, high-detail production quality, sharp anatomy and clothing details.",
    "No text labels, no captions, no watermarks, no logos, no extra characters, no duplicated faces with changed identity.",
    normalizedPrompt ? `User character description: ${normalizedPrompt}` : "",
  ].map(normalizeGenerationText).filter(Boolean).join("\n");
};

const normalizeWaveSpeedSegmentAiVideoFileName = (jobId: string) =>
  `segment-ai-video-${normalizeGenerationText(jobId).replace(/[^a-z0-9_-]+/gi, "-") || "wavespeed"}.mp4`;

const normalizeWaveSpeedSegmentPhotoAnimationFileName = (jobId: string) =>
  `segment-photo-animation-${normalizeGenerationText(jobId).replace(/[^a-z0-9_-]+/gi, "-") || "wavespeed"}.mp4`;

const normalizeWaveSpeedSegmentTalkingPhotoFileName = (jobId: string) =>
  `segment-talking-photo-${normalizeGenerationText(jobId).replace(/[^a-z0-9_-]+/gi, "-") || "wavespeed"}.mp4`;

const getStudioGenerationCreditCost = (
  videoMode: string,
  options?: { isSegmentEditorGeneration?: boolean; voiceEnabled?: boolean; voiceId?: string | null },
) => {
  const baseCredits = options?.isSegmentEditorGeneration
    ? STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST
    : videoMode === "ai_photo"
      ? STUDIO_PREMIUM_VIDEO_GENERATION_CREDIT_COST
      : STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST;

  const voiceCredits = options?.voiceEnabled === false ? 0 : getStudioVoiceCreditCost(options?.voiceId);
  return baseCredits + voiceCredits;
};

const normalizeStudioLanguage = (value: string | null | undefined): Locale => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return isSupportedLocale(normalized) ? normalized : DEFAULT_LOCALE;
};

export const resolveStudioGenerationLanguage = (
  prompt: string,
  requestedLanguage?: string | null,
): Locale => normalizeStudioLanguage(requestedLanguage);

const getStudioVoiceLanguage = (voiceId: string | null | undefined): Locale | null => {
  const canonicalVoiceId = getCanonicalStudioVoiceId(voiceId);
  if (!canonicalVoiceId) {
    return null;
  }

  if (studioRussianVoiceIds.has(canonicalVoiceId)) {
    return "ru";
  }

  if (studioEnglishVoiceIds.has(canonicalVoiceId)) {
    return "en";
  }

  return null;
};

const getDefaultStudioVoiceId = (language: Locale) => DEFAULT_STUDIO_VOICE_ID[language];

for (const language of SUPPORTED_LOCALES) {
  if (getStudioVoiceLanguage(getDefaultStudioVoiceId(language)) !== language) {
    throw new Error(`Default studio voice is not configured for locale "${language}".`);
  }
}

export const normalizeStudioVoiceIdForLanguage = (
  voiceId: string | null | undefined,
  language: Locale,
) => {
  const normalizedVoiceId = normalizeGenerationText(voiceId);
  if (!normalizedVoiceId || normalizedVoiceId === "none") {
    return undefined;
  }

  const canonicalVoiceId = getCanonicalStudioVoiceId(normalizedVoiceId);
  const voiceLanguage = getStudioVoiceLanguage(canonicalVoiceId);
  return voiceLanguage === language && canonicalVoiceId ? canonicalVoiceId : getDefaultStudioVoiceId(language);
};

const normalizeStudioVoiceId = (voiceId: string | null | undefined) => {
  const normalizedVoiceId = normalizeGenerationText(voiceId);
  if (!normalizedVoiceId || normalizedVoiceId === "none") {
    return undefined;
  }

  return getCanonicalStudioVoiceId(normalizedVoiceId) ?? undefined;
};

const normalizePositiveInteger = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  const rounded = Math.trunc(numeric);
  return rounded > 0 ? rounded : null;
};

const normalizePositiveIntegerList = (value: unknown) => {
  const source = Array.isArray(value) ? value : [];
  const result: number[] = [];
  for (const item of source) {
    const normalized = normalizePositiveInteger(item);
    if (normalized && !result.includes(normalized)) {
      result.push(normalized);
    }
  }
  return result;
};

const normalizeTextList = (value: unknown) => {
  const source = Array.isArray(value) ? value : [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of source) {
    const text = String(item ?? "").trim();
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      result.push(text);
    }
  }
  return result;
};

const normalizeCharacterContinuityMode = (value: unknown, preserveCharacters: boolean) => {
  if (!preserveCharacters) {
    return "off";
  }
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "auto" || normalized === "force" ? normalized : "force";
};

const normalizeAdsflowProjectCharacter = (
  payload: AdsflowProjectCharacterPayload | null | undefined,
): StudioProjectCharacter | null => {
  const characterId = normalizePositiveInteger(payload?.character_id ?? payload?.characterId);
  const label = normalizeGenerationText(payload?.label);
  if (!characterId || !label) {
    return null;
  }

  return {
    aliases: normalizeTextList(payload?.aliases),
    characterId,
    description: normalizeGenerationText(payload?.description) || null,
    label,
    referenceAssetIds: normalizePositiveIntegerList(payload?.reference_asset_ids ?? payload?.referenceAssetIds),
    sourceSegmentIds: normalizeNonNegativeIntegerList(payload?.source_segment_ids ?? payload?.sourceSegmentIds),
  };
};

const normalizeNonNegativeInteger = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  const rounded = Math.trunc(numeric);
  return rounded >= 0 ? rounded : null;
};

const normalizeNonNegativeIntegerList = (value: unknown) => {
  const source = Array.isArray(value) ? value : [];
  const result: number[] = [];
  for (const item of source) {
    const normalized = normalizeNonNegativeInteger(item);
    if (normalized !== null && !result.includes(normalized)) {
      result.push(normalized);
    }
  }
  return result;
};

const normalizeNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const roundStudioTimelineSeconds = (value: number) => Number(value.toFixed(3));

const normalizeStudioSegmentVisualDurationSeconds = (value: unknown) => {
  const normalized = normalizeNumber(value);
  return normalized !== null && normalized >= 1 ? Number(normalized.toFixed(3)) : undefined;
};

export const buildStudioSegmentVisualDurationPayload = (durationSeconds: unknown) => {
  const normalizedDurationSeconds = normalizeStudioSegmentVisualDurationSeconds(durationSeconds);
  return normalizedDurationSeconds ? { duration: normalizedDurationSeconds } : {};
};

export const buildStudioSegmentVisualDurationExtensionPayload = (options?: {
  baseDurationSeconds?: unknown;
  mode?: unknown;
  tailDurationSeconds?: unknown;
  targetDurationSeconds?: unknown;
}) => {
  const mode = String(options?.mode ?? "").trim().toLowerCase();
  const baseDurationSeconds = normalizeStudioSegmentVisualDurationSeconds(options?.baseDurationSeconds);
  const targetDurationSeconds = normalizeStudioSegmentVisualDurationSeconds(options?.targetDurationSeconds);
  if (mode !== "stitch" || !baseDurationSeconds || !targetDurationSeconds || targetDurationSeconds <= baseDurationSeconds) {
    return {};
  }

  const maxTailDurationSeconds = roundStudioTimelineSeconds(targetDurationSeconds - baseDurationSeconds);
  const requestedTailDurationSeconds = normalizeStudioSegmentVisualDurationSeconds(options?.tailDurationSeconds);
  const tailDurationSeconds = requestedTailDurationSeconds
    ? Math.min(requestedTailDurationSeconds, maxTailDurationSeconds)
    : maxTailDurationSeconds;

  return {
    duration_extension_base_duration_seconds: baseDurationSeconds,
    duration_extension_mode: "stitch",
    duration_extension_tail_duration_seconds: roundStudioTimelineSeconds(tailDurationSeconds),
    duration_extension_target_duration_seconds: targetDurationSeconds,
  };
};

type StudioTalkingCharacterTarget = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type StudioTalkingCharacterPixelBox = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type StudioSegmentTalkingPhotoSpeakerPreviewOverlay = {
  box: StudioTalkingCharacterPixelBox | null;
  dataUrl: string;
  height: number | null;
  mimeType: string;
  width: number | null;
};

export type StudioSegmentTalkingPhotoSpeakerPreview = {
  confirmationToken: string;
  expiresInSeconds: number | null;
  overlay: StudioSegmentTalkingPhotoSpeakerPreviewOverlay;
  projectId: number | null;
  segmentIndex: number | null;
  sourceAssetId: number;
  sourceMediaType: "photo" | "video";
  speakerTarget: StudioTalkingCharacterTarget;
};

const normalizeStudioTalkingCharacterTarget = (value: unknown): StudioTalkingCharacterTarget | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const x = Number(source.x);
  const y = Number(source.y);
  const width = Number(source.width);
  const height = Number(source.height);
  if (![x, y, width, height].every(Number.isFinite)) {
    return undefined;
  }

  const normalizedWidth = Math.min(1, Math.max(0.06, width));
  const normalizedHeight = Math.min(1, Math.max(0.06, height));
  return {
    height: normalizedHeight,
    width: normalizedWidth,
    x: Math.min(1 - normalizedWidth, Math.max(0, x)),
    y: Math.min(1 - normalizedHeight, Math.max(0, y)),
  };
};

const normalizeStudioTalkingCharacterPixelBox = (
  value: AdsflowSegmentTalkingPhotoPreviewOverlayPayload["box"],
): StudioTalkingCharacterPixelBox | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const x = Math.trunc(Number(value.x));
  const y = Math.trunc(Number(value.y));
  const width = Math.trunc(Number(value.width));
  const height = Math.trunc(Number(value.height));
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    height,
    width,
    x: Math.max(0, x),
    y: Math.max(0, y),
  };
};

const normalizeStudioSegmentTalkingPhotoSourceMediaType = (value: unknown): "photo" | "video" =>
  normalizeGenerationText(value).toLowerCase() === "video" ? "video" : "photo";

const normalizeAdsflowSegmentTalkingPhotoPreview = (
  payload: AdsflowSegmentTalkingPhotoPreviewResponse,
  fallbackSpeakerTarget: StudioTalkingCharacterTarget,
): StudioSegmentTalkingPhotoSpeakerPreview => {
  const confirmationToken = normalizeGenerationText(payload.confirmation_token);
  if (!confirmationToken) {
    throw new Error("AdsFlow did not return a talking character speaker confirmation token.");
  }

  const sourceAssetId = normalizePositiveInteger(payload.source_asset_id);
  if (!sourceAssetId) {
    throw new Error("AdsFlow did not return a talking character source asset id.");
  }

  const overlayDataUrl = normalizeGenerationText(payload.overlay?.data_url);
  if (!overlayDataUrl) {
    throw new Error("AdsFlow did not return a talking character speaker overlay.");
  }

  return {
    confirmationToken,
    expiresInSeconds: normalizePositiveInteger(payload.expires_in_seconds) ?? null,
    overlay: {
      box: normalizeStudioTalkingCharacterPixelBox(payload.overlay?.box ?? null),
      dataUrl: overlayDataUrl,
      height: normalizePositiveInteger(payload.overlay?.height) ?? null,
      mimeType: normalizeGenerationText(payload.overlay?.mime_type) || "image/jpeg",
      width: normalizePositiveInteger(payload.overlay?.width) ?? null,
    },
    projectId: normalizePositiveInteger(payload.project_id) ?? null,
    segmentIndex: normalizeNonNegativeInteger(payload.segment_index) ?? null,
    sourceAssetId,
    sourceMediaType: normalizeStudioSegmentTalkingPhotoSourceMediaType(payload.source_media_type),
    speakerTarget: normalizeStudioTalkingCharacterTarget(payload.speaker_target) ?? fallbackSpeakerTarget,
  };
};

const normalizeStudioSegmentVideoAction = (value: unknown): StudioSegmentEditorVideoAction => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return studioSupportedSegmentVideoActions.has(normalized) ? (normalized as StudioSegmentEditorVideoAction) : "original";
};

const normalizeStudioSegmentDurationMode = (value: unknown): StudioSegmentEditorDurationMode => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "manual" ? "manual" : "auto";
};

const normalizeStudioSegmentManualDurationSeconds = (value: unknown) => {
  const normalized = normalizeNumber(value);
  return normalized !== null && normalized >= 1 ? normalized : null;
};

export const normalizeStudioSegmentEditorPayload = (
  value: unknown,
  language: Locale,
  fallbackProjectId?: number,
  options?: { globalVoiceEnabled?: boolean },
): StudioSegmentEditorPayload | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as {
    allowStructureChange?: unknown;
    projectId?: unknown;
    segments?: unknown;
  };
  const projectId = normalizePositiveInteger(record.projectId) ?? fallbackProjectId;
  const rawSegments = Array.isArray(record.segments) ? record.segments : [];

  if (!projectId || rawSegments.length === 0) {
    return undefined;
  }

  const segments: StudioSegmentEditorSegment[] = [];
  let timelineCursor = 0;
  let hasTimingDrift = false;

  rawSegments.forEach((segment) => {
    if (!segment || typeof segment !== "object") {
      return;
    }

    const segmentRecord = segment as {
      customVideoAssetId?: unknown;
      customVideoFileDataUrl?: unknown;
      customVideoFileMimeType?: unknown;
      customVideoFileName?: unknown;
      duration?: unknown;
      durationExtensionSourceDurationSeconds?: unknown;
      duration_extension_source_duration_seconds?: unknown;
      durationMode?: unknown;
      duration_mode?: unknown;
      endTime?: unknown;
      index?: unknown;
      manualDurationSeconds?: unknown;
      manual_duration_seconds?: unknown;
      resetVisual?: unknown;
      sceneSoundAssetId?: unknown;
      startTime?: unknown;
      subtitleColor?: unknown;
      subtitle_color?: unknown;
      subtitleStyle?: unknown;
      subtitle_style?: unknown;
      subtitleType?: unknown;
      subtitle_type?: unknown;
      text?: unknown;
      videoAction?: unknown;
      voiceoverAssetId?: unknown;
      voiceover_asset_id?: unknown;
      voiceType?: unknown;
      voice_type?: unknown;
    };
    const index = normalizeNonNegativeInteger(segmentRecord.index);
    if (index === null) {
      return;
    }

    const videoAction = normalizeStudioSegmentVideoAction(segmentRecord.videoAction);
    const customVideoAssetId = normalizePositiveInteger(segmentRecord.customVideoAssetId) ?? undefined;
    const customVideoFileDataUrl = String(segmentRecord.customVideoFileDataUrl ?? "").trim() || undefined;
    const customVideoFileMimeType = String(segmentRecord.customVideoFileMimeType ?? "").trim() || undefined;
    const customVideoFileName = String(segmentRecord.customVideoFileName ?? "").trim() || undefined;
    const rawStartTime = normalizeNumber(segmentRecord.startTime);
    const rawEndTime = normalizeNumber(segmentRecord.endTime);
    const rawDuration = normalizeNumber(segmentRecord.duration);
    const rawDurationMode = normalizeStudioSegmentDurationMode(segmentRecord.durationMode ?? segmentRecord.duration_mode);
    const rawDurationExtensionSourceDurationSeconds = normalizeStudioSegmentManualDurationSeconds(
      segmentRecord.durationExtensionSourceDurationSeconds ?? segmentRecord.duration_extension_source_duration_seconds,
    );
    const rawManualDurationSeconds = normalizeStudioSegmentManualDurationSeconds(
      segmentRecord.manualDurationSeconds ?? segmentRecord.manual_duration_seconds,
    );
    const timelineDuration =
      rawStartTime !== null && rawEndTime !== null && rawEndTime > rawStartTime ? rawEndTime - rawStartTime : null;
    // Generation must use the editor timeline snapshot. If an already resolved timeline is exported as "auto",
    // AdsFlow can infer the original media clip duration and cut a segment earlier than the editor shows.
    const manualDurationSeconds =
      rawManualDurationSeconds ??
      normalizeStudioSegmentManualDurationSeconds(timelineDuration) ??
      normalizeStudioSegmentManualDurationSeconds(rawDuration);
    const durationMode = manualDurationSeconds !== null ? "manual" : rawDurationMode;
    const duration =
      manualDurationSeconds !== null
        ? roundStudioTimelineSeconds(manualDurationSeconds)
        : rawDuration !== null
          ? roundStudioTimelineSeconds(rawDuration)
          : undefined;
    const startTime = duration !== undefined ? roundStudioTimelineSeconds(timelineCursor) : rawStartTime ?? undefined;
    const endTime =
      duration !== undefined && startTime !== undefined
        ? roundStudioTimelineSeconds(startTime + duration)
        : rawEndTime !== null
          ? roundStudioTimelineSeconds(rawEndTime)
          : undefined;
    const normalizedManualDurationSeconds =
      manualDurationSeconds !== null ? roundStudioTimelineSeconds(manualDurationSeconds) : null;
    if (duration !== undefined && startTime !== undefined && endTime !== undefined) {
      const startDrift = rawStartTime !== null ? Math.abs(rawStartTime - startTime) : 0;
      const endDrift = rawEndTime !== null ? Math.abs(rawEndTime - endTime) : 0;
      const durationDrift = rawDuration !== null ? Math.abs(rawDuration - duration) : 0;
      const manualDurationDrift =
        rawManualDurationSeconds !== null ? Math.abs(rawManualDurationSeconds - duration) : 0;
      if (Math.max(startDrift, endDrift, durationDrift, manualDurationDrift) > 0.01) {
        hasTimingDrift = true;
      }
      timelineCursor = endTime;
    }
    const segmentVoiceTypeRaw = segmentRecord.voiceType ?? segmentRecord.voice_type;
    const segmentVoiceTypeText = normalizeGenerationText(segmentVoiceTypeRaw);
    const segmentVoiceType =
      segmentVoiceTypeRaw === null
        ? null
        : segmentVoiceTypeText.toLowerCase() === "none"
          ? "none"
          : normalizeStudioVoiceId(segmentVoiceTypeText) ?? null;
    const segmentHasVoice =
      segmentVoiceType === "none" ? false : options?.globalVoiceEnabled !== false || Boolean(segmentVoiceType);
    const segmentSubtitleTypeRaw = normalizeGenerationText(segmentRecord.subtitleType ?? segmentRecord.subtitle_type).toLowerCase();
    const segmentSubtitleType = segmentHasVoice ? segmentSubtitleTypeRaw || null : "none";
    const segmentSubtitleStyleRaw = normalizeGenerationText(segmentRecord.subtitleStyle ?? segmentRecord.subtitle_style);
    const segmentSubtitleStyle = segmentHasVoice && segmentSubtitleStyleRaw ? normalizeStudioSubtitleStyle(segmentSubtitleStyleRaw) : null;
    const segmentSubtitleColorRaw = normalizeGenerationText(segmentRecord.subtitleColor ?? segmentRecord.subtitle_color);
    const segmentSubtitleColor = segmentHasVoice && segmentSubtitleColorRaw
      ? normalizeStudioSubtitleColor(
          segmentSubtitleColorRaw,
          getDefaultStudioSubtitleColorForStyle(segmentSubtitleStyle ?? "modern"),
        )
      : null;

    if (videoAction === "custom" && !customVideoAssetId && (!customVideoFileDataUrl || !customVideoFileName)) {
      throw new Error(`Upload a custom video for segment ${index + 1} or choose a different source.`);
    }

    segments.push({
      customVideoAssetId: videoAction === "custom" ? customVideoAssetId : undefined,
      customVideoFileDataUrl: videoAction === "custom" ? customVideoFileDataUrl : undefined,
      customVideoFileMimeType: videoAction === "custom" ? customVideoFileMimeType : undefined,
      customVideoFileName: videoAction === "custom" ? customVideoFileName : undefined,
      duration,
      durationExtensionSourceDurationSeconds: rawDurationExtensionSourceDurationSeconds,
      durationMode,
      endTime,
      index,
      manualDurationSeconds: normalizedManualDurationSeconds,
      resetVisual: Boolean(segmentRecord.resetVisual),
      sceneSoundAssetId: normalizePositiveInteger(segmentRecord.sceneSoundAssetId) ?? undefined,
      startTime,
      subtitleColor: segmentSubtitleColor,
      subtitleStyle: segmentSubtitleStyle,
      subtitleType: segmentSubtitleType,
      text: normalizeGenerationText(String(segmentRecord.text ?? "")),
      videoAction,
      voiceoverAssetId:
        normalizePositiveInteger(segmentRecord.voiceoverAssetId ?? segmentRecord.voiceover_asset_id) ?? undefined,
      voiceType: segmentVoiceType,
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

  if (hasTimingDrift) {
    console.warn("[studio] segment-editor timing drift normalized", {
      projectId,
      segmentCount: segments.length,
      segmentTimings: segments.map((segment) => ({
        duration: segment.duration ?? null,
        durationMode: segment.durationMode ?? null,
        endTime: segment.endTime ?? null,
        index: segment.index,
        manualDurationSeconds: segment.manualDurationSeconds ?? null,
        startTime: segment.startTime ?? null,
      })),
    });
  }

  return {
    allowStructureChange: Boolean(record.allowStructureChange),
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

const cloneStudioGeneration = (generation: StudioGeneration): StudioGeneration => ({
  ...generation,
  finalAsset: generation.finalAsset ? { ...generation.finalAsset } : null,
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

const getWorkspaceSubscriptionExpiryCacheKey = (userId: string | number | null | undefined) => {
  const normalizedUserId = String(userId ?? "").trim();
  return /^\d+$/.test(normalizedUserId) ? normalizedUserId : null;
};

const getCachedWorkspaceSubscriptionExpiry = (userId: string | number | null | undefined) => {
  const cacheKey = getWorkspaceSubscriptionExpiryCacheKey(userId);
  if (!cacheKey) {
    return undefined;
  }

  const cachedEntry = workspaceSubscriptionExpiryCache.get(cacheKey);
  if (!cachedEntry) {
    return undefined;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    workspaceSubscriptionExpiryCache.delete(cacheKey);
    return undefined;
  }

  return cachedEntry.value;
};

const setCachedWorkspaceSubscriptionExpiry = (
  userId: string | number | null | undefined,
  value: WorkspaceSubscriptionDetails,
) => {
  const cacheKey = getWorkspaceSubscriptionExpiryCacheKey(userId);
  if (!cacheKey) {
    return;
  }

  workspaceSubscriptionExpiryCache.set(cacheKey, {
    expiresAt: Date.now() + WORKSPACE_SUBSCRIPTION_EXPIRY_CACHE_TTL_MS,
    value,
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

const resolveStudioAuthScopedCacheKey = async (user: StudioUser, externalUserId?: string) => {
  const resolvedExternalUserId = externalUserId ?? (await resolveStudioExternalUserId(user));
  return buildAuthScopedCacheKey(user, resolvedExternalUserId) || resolvedExternalUserId;
};

export async function invalidateWorkspaceBootstrapCache(user: StudioUser): Promise<void> {
  const externalUserId = await resolveStudioExternalUserId(user);
  const cacheKey = await resolveStudioAuthScopedCacheKey(user, externalUserId);
  for (const key of new Set([cacheKey, externalUserId])) {
    workspaceBootstrapCache.delete(key);
  }
}

export function invalidateWorkspaceBootstrapCacheByIdentityFragments(fragments: readonly string[]) {
  const normalizedFragments = fragments.map(normalizePrompt).filter(Boolean);
  if (!normalizedFragments.length) {
    return;
  }

  for (const key of workspaceBootstrapCache.keys()) {
    if (normalizedFragments.some((fragment) => key === fragment || key.includes(fragment))) {
      workspaceBootstrapCache.delete(key);
    }
  }
}

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
      /\/api\/media\/\d+\/download(?:\/)?$/i.test(pathname) ||
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

const buildStudioSegmentTalkingPhotoJobVideoProxyUrl = (jobId: string | null | undefined) => {
  const normalizedJobId = normalizeGenerationText(jobId);
  if (!normalizedJobId) {
    return null;
  }

  const proxyUrl = new URL(`/api/studio/segment-talking-photo/jobs/${encodeURIComponent(normalizedJobId)}/video`, env.appUrl);
  return `${proxyUrl.pathname}${proxyUrl.search}`;
};

const buildStudioSegmentTalkingPhotoJobPosterProxyUrl = (jobId: string | null | undefined) => {
  const normalizedJobId = normalizeGenerationText(jobId);
  if (!normalizedJobId) {
    return null;
  }

  const proxyUrl = new URL(`/api/studio/segment-talking-photo/jobs/${encodeURIComponent(normalizedJobId)}/poster`, env.appUrl);
  proxyUrl.searchParams.set("v", normalizedJobId);
  return `${proxyUrl.pathname}${proxyUrl.search}`;
};

const buildStudioSegmentSceneSoundJobAudioProxyUrl = (jobId: string | null | undefined) => {
  const normalizedJobId = normalizeGenerationText(jobId);
  if (!normalizedJobId) {
    return null;
  }

  const proxyUrl = new URL(`/api/studio/segment-scene-sound/jobs/${encodeURIComponent(normalizedJobId)}/audio`, env.appUrl);
  return `${proxyUrl.pathname}${proxyUrl.search}`;
};

const buildStudioSegmentVoiceoverJobAudioProxyUrl = (jobId: string | null | undefined) => {
  const normalizedJobId = normalizeGenerationText(jobId);
  if (!normalizedJobId) {
    return null;
  }

  const proxyUrl = new URL(`/api/studio/segment-voiceover/jobs/${encodeURIComponent(normalizedJobId)}/audio`, env.appUrl);
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

const STUDIO_FINAL_VIDEO_READY_STATUSES = new Set(["completed", "done", "ready"]);
const STUDIO_FINAL_VIDEO_FAILED_STATUSES = new Set(["error", "failed"]);

const hasStudioFinalVideoDownload = (value: string | null | undefined) =>
  Boolean(normalizeGenerationText(value));

export const canExposeStudioFinalVideoFromStatus = (options: {
  downloadPath?: string | null;
  error?: string | null;
  projectStatus?: string | null;
  readyReason?: string | null;
  status?: string | null;
}) => {
  const normalizedStatus = normalizeGenerationText(options.status).toLowerCase();
  if (STUDIO_FINAL_VIDEO_READY_STATUSES.has(normalizedStatus)) {
    return true;
  }

  if (!hasStudioFinalVideoDownload(options.downloadPath) || !STUDIO_FINAL_VIDEO_FAILED_STATUSES.has(normalizedStatus)) {
    return false;
  }

  const normalizedError = normalizeGenerationText(options.error).toLowerCase();
  const normalizedProjectStatus = normalizeGenerationText(options.projectStatus).toLowerCase();
  const normalizedReadyReason = normalizeGenerationText(options.readyReason).toLowerCase();

  return (
    normalizedReadyReason === "project_not_ready" ||
    normalizedProjectStatus === "rendering" ||
    normalizedError.includes("edit snapshot is not ready") ||
    normalizedError.includes("has_final_video")
  );
};

const getStudioGenerationPublicStatus = (options: {
  downloadPath?: string | null;
  error?: string | null;
  projectStatus?: string | null;
  readyReason?: string | null;
  status?: string | null;
}) => (canExposeStudioFinalVideoFromStatus(options) ? "done" : String(options.status ?? "queued"));

const buildStudioFinalAsset = (options: {
  adId?: number | null;
  downloadPath?: string | null;
  generatedAt?: string | null;
  historyEntry?: WorkspaceGenerationHistoryEntry | null;
  kind?: string | null;
  mediaAssetId?: number | null;
  status?: string | null;
}) => {
  const payloadAsset = buildWorkspaceMediaAssetRef({
    created_at: options.generatedAt ?? null,
    download_path: options.downloadPath ?? null,
    id: options.mediaAssetId ?? null,
    kind: options.kind ?? "final_video",
    media_type: "video",
    project_id: options.adId ?? null,
    role: "final_video",
    status: options.status ?? null,
  });
  const historyAsset = buildWorkspaceMediaAssetRef({
    created_at: options.historyEntry?.generatedAt ?? options.historyEntry?.updatedAt ?? options.historyEntry?.createdAt ?? null,
    download_path: options.historyEntry?.downloadPath ?? null,
    expires_at: options.historyEntry?.finalAssetExpiresAt ?? null,
    id: options.historyEntry?.finalAssetId ?? null,
    kind: options.historyEntry?.finalAssetKind ?? options.kind ?? "final_video",
    media_type: "video",
    project_id: options.adId ?? null,
    role: "final_video",
    status: options.historyEntry?.finalAssetStatus ?? options.status ?? null,
  });

  return mergeWorkspaceMediaAssetRefs(payloadAsset, historyAsset);
};

const normalizeWorkspaceBooleanFlag = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return null;
};

const extractAdsflowStartPlanUsed = (payload: AdsflowWebUserPayload | undefined, plan: string) => {
  const explicitUsed = normalizeWorkspaceBooleanFlag(payload?.start_plan_used ?? payload?.startPlanUsed);
  if (explicitUsed !== null) {
    return explicitUsed;
  }

  const explicitAvailable = normalizeWorkspaceBooleanFlag(payload?.start_plan_available ?? payload?.startPlanAvailable);
  if (explicitAvailable !== null) {
    return !explicitAvailable;
  }

  return plan === "START";
};

const buildWorkspaceProfile = (payload?: AdsflowWebUserPayload): WorkspaceProfile => {
  const plan = String(payload?.plan ?? "FREE").trim().toUpperCase() || "FREE";
  const rawUserId = String(payload?.user_id ?? "").trim();

  return {
    balance: Math.max(0, Number(payload?.balance ?? 0)),
    expiresAt: plan === "START" ? null : normalizeGenerationText(payload?.subscription_expires_at) || null,
    plan,
    startPlanUsed: extractAdsflowStartPlanUsed(payload, plan),
    userId: rawUserId || null,
  };
};

export const applyWorkspaceSubscriptionDetailsToProfile = (
  profile: WorkspaceProfile,
  details: WorkspaceSubscriptionDetails | null | undefined,
): WorkspaceProfile => {
  const normalizedPlan = String(details?.plan ?? "").trim().toUpperCase();
  const hasAdminPlan = normalizedPlan === "START" || normalizedPlan === "PRO" || normalizedPlan === "ULTRA";
  const nextPlan = hasAdminPlan ? normalizedPlan : profile.plan;

  return {
    ...profile,
    expiresAt: nextPlan === "START" ? null : profile.expiresAt ?? details?.expiresAt ?? null,
    plan: nextPlan,
    startPlanUsed: profile.startPlanUsed || Boolean(details?.startPlanUsed) || nextPlan === "START",
    userId: profile.userId ?? details?.userId ?? null,
  };
};

const normalizeStudioGeneratedImageMimeType = (value: string | null | undefined, fallback = "image/png") => {
  const normalized = normalizeGenerationText(value).toLowerCase().split(";")[0]?.trim() ?? "";
  if (normalized.startsWith("image/")) {
    return normalized;
  }

  return fallback;
};

const normalizeStudioSegmentPromptImproveMode = (value: unknown): StudioSegmentPromptImproveMode => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return studioSupportedPromptImproveModes.has(normalized) ? (normalized as StudioSegmentPromptImproveMode) : "ai_photo";
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

const decodeBinaryDataUrl = (value: string) => {
  const match = /^data:(?<mime>[^;,]+)?;base64,(?<data>.+)$/i.exec(String(value ?? "").trim());
  if (!match?.groups?.data) {
    throw new Error("Uploaded file data URL is invalid.");
  }

  return {
    bytes: Buffer.from(match.groups.data, "base64"),
    mimeType: String(match.groups.mime ?? "").trim(),
  };
};

const inferStudioUploadMediaType = (
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
): "audio" | "photo" | "video" | "binary" => {
  const normalizedMimeType = normalizeGenerationText(mimeType).toLowerCase();
  if (normalizedMimeType.startsWith("audio/")) {
    return "audio";
  }
  if (normalizedMimeType.startsWith("image/")) {
    return "photo";
  }
  if (normalizedMimeType.startsWith("video/")) {
    return "video";
  }

  const target = normalizeGenerationText(fileName).toLowerCase();
  if (/\.(aac|m4a|mp3|wav)$/i.test(target)) return "audio";
  if (/\.(avif|gif|jpe?g|png|webp)$/i.test(target)) return "photo";
  if (/\.(m4v|mov|mp4|mpeg|webm)$/i.test(target)) return "video";
  return "binary";
};

const inferStudioGeneratedImageMimeType = (
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
  urlValue?: string | null,
) => {
  const normalizedMimeType = normalizeStudioGeneratedImageMimeType(mimeType, "");
  if (normalizedMimeType) {
    return normalizedMimeType;
  }

  const normalizedFileName = normalizeGenerationText(fileName).toLowerCase();
  const normalizedUrlValue = normalizeGenerationText(urlValue).toLowerCase();
  const pathname = normalizedUrlValue
    ? (() => {
        try {
          return new URL(normalizedUrlValue).pathname.toLowerCase();
        } catch {
          return normalizedUrlValue.split(/[?#]/u, 1)[0] ?? normalizedUrlValue;
        }
      })()
    : "";
  const candidates = [normalizedFileName, pathname];
  if (candidates.some((candidate) => candidate.endsWith(".jpg") || candidate.endsWith(".jpeg"))) return "image/jpeg";
  if (candidates.some((candidate) => candidate.endsWith(".webp"))) return "image/webp";
  if (candidates.some((candidate) => candidate.endsWith(".avif"))) return "image/avif";
  if (candidates.some((candidate) => candidate.endsWith(".gif"))) return "image/gif";
  return "image/png";
};

const normalizeStudioGeneratedImageFileName = (fileName: string | null | undefined, mimeType: string) => {
  const normalized = String(fileName ?? "").trim().split(/[\\/]/).pop() ?? "";
  if (normalized) {
    const targetExtension = getStudioGeneratedImageExtension(mimeType);
    const currentExtensionMatch = normalized.match(/(\.[^.]+)$/u);
    const currentExtension = currentExtensionMatch?.[1]?.toLowerCase() ?? "";
    if (!currentExtension) {
      return `${normalized}${targetExtension}`;
    }

    if (currentExtension === ".jpeg" && targetExtension === ".jpg") {
      return normalized;
    }

    if (currentExtension === targetExtension) {
      return normalized;
    }

    return `${normalized.slice(0, -currentExtension.length)}${targetExtension}`;
  }

  return `segment-ai-photo${getStudioGeneratedImageExtension(mimeType)}`;
};

const buildStudioUpscaledImageFileName = (
  fileName: string | null | undefined,
  mimeType: string,
  options?: { segmentIndex?: number | null },
) => {
  const normalized = String(fileName ?? "").trim().split(/[\\/]/).pop() ?? "";
  const extension = getStudioGeneratedImageExtension(mimeType);
  const fallbackBaseName =
    typeof options?.segmentIndex === "number" && options.segmentIndex >= 0
      ? `segment-${options.segmentIndex + 1}`
      : "segment-image";
  const baseName = (normalized ? normalized.replace(/\.[^.]+$/u, "") : fallbackBaseName).trim() || fallbackBaseName;
  return `${baseName}-upscaled${extension}`;
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

const sanitizeStudioSegmentPromptEnhancementOutput = (value: unknown) =>
  String(value ?? "")
    .replace(/^```[\w-]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^prompt\s*:\s*/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const buildStudioSegmentPromptEnhancementFallback = (
  value: string,
  language: "en" | "ru",
  mode: StudioSegmentPromptImproveMode,
) => {
  const normalizedPrompt = normalizePrompt(value).replace(/[.!?]+$/g, "");
  if (!normalizedPrompt) {
    return "";
  }

  const descriptors =
    language === "en"
      ? mode === "ai_video"
        ? [
            "cinematic vertical 9:16 video",
            "natural subject motion",
            "clear focal action",
            "subtle camera movement",
            "realistic detail",
          ]
        : mode === "photo_animation"
          ? [
              "image-to-video animation from a single source photo",
              "natural motion",
              "gentle camera push-in or parallax",
              "preserve subject identity and setting",
              "realistic detail",
            ]
          : mode === "image_edit"
            ? [
                "seamless image edit or outpaint",
                "preserve the original subject and composition",
                "matching lighting and perspective",
                "clean realistic detail",
              ]
            : [
                "cinematic vertical 9:16 composition",
                "photorealistic",
                "dramatic lighting",
                "clear focal subject",
                "high detail",
              ]
      : mode === "ai_video"
        ? [
            "кинематографичное вертикальное видео 9:16",
            "естественное движение объекта",
            "четкое главное действие",
            "мягкое движение камеры",
            "реалистичная детализация",
          ]
        : mode === "photo_animation"
          ? [
              "i2v анимация из одного исходного фото",
              "естественное движение",
              "легкий наезд камеры или параллакс",
              "сохранить героя и окружение",
              "реалистичная детализация",
            ]
          : mode === "image_edit"
            ? [
                "аккуратная дорисовка или редактирование фото",
                "сохранить исходного героя и композицию",
                "совпадающий свет и перспектива",
                "чистая реалистичная детализация",
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

const buildStudioSegmentPromptEnhancementSystemPrompt = (
  language: "en" | "ru",
  mode: StudioSegmentPromptImproveMode,
) => {
  if (language === "en") {
    switch (mode) {
      case "ai_video":
        return [
          "You are an expert prompt engineer for text-to-video generation.",
          "Rewrite the user's rough description into one strong production-ready prompt for a short vertical 9:16 video.",
          "Return exactly one prompt in English with no quotes, labels, markdown, or explanations.",
          "Describe the visible scene, subject, action, environment, camera framing, camera movement, motion, lighting, and mood.",
          "Prefer one continuous cinematic shot with believable motion and a clear focal action.",
          "Avoid dialogue, voiceover, sound effects, editing instructions, cuts, multi-shot sequences, captions, subtitles, logos, watermarks, and UI.",
          "Keep it compact and clear: one sentence or a tight comma-separated phrase, under 360 characters.",
        ].join(" ");
      case "photo_animation":
        return [
          "You are an expert prompt engineer for image-to-video generation.",
          "Rewrite the user's rough description into one strong production-ready prompt for animating a single source photo into a short vertical 9:16 video.",
          "Return exactly one prompt in English with no quotes, labels, markdown, or explanations.",
          "Base the result on the existing photo: preserve identity, outfit, location, framing, and composition unless the user explicitly asks to change them.",
          "Focus on motion directions only: subject movement, facial expression, hair or clothing movement, environmental motion, depth, parallax, and subtle camera movement.",
          "Avoid new unrelated objects, scene changes, hard cuts, impossible transformations, captions, subtitles, logos, watermarks, and UI.",
          "Keep it compact and clear: one sentence or a tight comma-separated phrase, under 360 characters.",
        ].join(" ");
      case "image_edit":
        return [
          "You are an expert prompt engineer for AI image editing and outpainting.",
          "Rewrite the user's rough edit request into one strong production-ready prompt for editing an existing vertical 9:16 image.",
          "Return exactly one prompt in English with no quotes, labels, markdown, or explanations.",
          "Describe the final visible result only: what should be added, extended, replaced, or refined in the existing image.",
          "Preserve the original subject identity, style, lighting, perspective, and composition unless the user explicitly asks to change them.",
          "Avoid mentioning masks, tools, UI, processing steps, captions, subtitles, logos, or watermarks.",
          "Keep it compact and clear: one sentence or a tight comma-separated phrase, under 340 characters.",
        ].join(" ");
      case "ai_photo":
      default:
        return [
          "You are an expert prompt engineer for AI image generation.",
          "Rewrite the user's rough scene description into one strong production-ready prompt for a vertical 9:16 image.",
          "Return exactly one prompt in English with no quotes, labels, markdown, or explanations.",
          "Focus only on visible details: subject, action, setting, composition, camera framing, lighting, mood, textures, and product visibility when relevant.",
          "Prefer cinematic, realistic, premium-looking imagery unless the user explicitly asks for fantasy, stylization, or surrealism.",
          "Keep it compact and clear: one sentence or a tight comma-separated phrase, under 320 characters.",
          "Do not mention captions, subtitles, logos, watermarks, UI, split screens, or multiple unrelated scenes.",
        ].join(" ");
    }
  }

  switch (mode) {
    case "ai_video":
      return [
        "Ты эксперт по созданию промтов для text-to-video генерации.",
        "Преобразуй черновое описание пользователя в один сильный готовый промт для короткого вертикального видео 9:16.",
        "Верни ровно один промт на русском языке без кавычек, меток, markdown и пояснений.",
        "Описывай видимую сцену: героя, действие, окружение, композицию, ракурс, движение камеры, движение объектов, свет и атмосферу.",
        "По умолчанию делай сцену как один цельный кинематографичный шот с понятным главным действием и правдоподобным движением.",
        "Не добавляй реплики, озвучку, звуки, монтажные команды, смены сцен, титры, текст на экране, логотипы, водяные знаки и интерфейсы.",
        "Промт должен быть компактным и ясным: одно предложение или плотная фраза до 360 символов.",
      ].join(" ");
    case "photo_animation":
      return [
        "Ты эксперт по созданию промтов для image-to-video анимации фото.",
        "Преобразуй черновое описание пользователя в один сильный готовый промт для анимации одного исходного фото в короткое вертикальное видео 9:16.",
        "Верни ровно один промт на русском языке без кавычек, меток, markdown и пояснений.",
        "Опирайся на исходное фото: сохраняй личность героя, одежду, локацию, ракурс и композицию, если пользователь явно не просит изменить их.",
        "Фокусируйся именно на движении: жесты, мимика, ветер в волосах или одежде, движение фона, глубина, параллакс и мягкое движение камеры.",
        "Не добавляй новые несвязанные объекты, смены сцен, резкие трансформации, титры, текст на экране, логотипы, водяные знаки и интерфейсы.",
        "Промт должен быть компактным и ясным: одно предложение или плотная фраза до 360 символов.",
      ].join(" ");
    case "image_edit":
      return [
        "Ты эксперт по созданию промтов для редактирования и дорисовки изображений.",
        "Преобразуй черновой запрос пользователя в один сильный готовый промт для редактирования существующего вертикального изображения 9:16.",
        "Верни ровно один промт на русском языке без кавычек, меток, markdown и пояснений.",
        "Описывай только итоговый видимый результат: что нужно добавить, расширить, заменить или уточнить в исходном изображении.",
        "По умолчанию сохраняй исходного героя, стиль, свет, перспективу и композицию, если пользователь явно не просит другого.",
        "Не упоминай маски, инструменты, интерфейсы, шаги обработки, титры, текст на экране, логотипы и водяные знаки.",
        "Промт должен быть компактным и ясным: одно предложение или плотная фраза до 340 символов.",
      ].join(" ");
    case "ai_photo":
    default:
      return [
        "Ты эксперт по созданию промтов для генерации изображений.",
        "Преобразуй черновое описание пользователя в один сильный готовый промт для вертикального изображения 9:16.",
        "Верни ровно один промт на русском языке без кавычек, меток, markdown и пояснений.",
        "Описывай только видимые детали: главный объект, действие, окружение, композицию, ракурс, свет, атмосферу, фактуры и продукт, если он важен.",
        "По умолчанию делай сцену кинематографичной, реалистичной и визуально дорогой, если пользователь явно не просит фантазию или стилизацию.",
        "Промт должен быть компактным и ясным: одно предложение или плотная фраза до 320 символов.",
        "Не упоминай титры, текст на экране, логотипы, водяные знаки, интерфейсы, коллажи и несколько несвязанных сцен.",
      ].join(" ");
  }
};

const buildStudioSegmentPromptEnhancementUserPrompt = (
  prompt: string,
  language: "en" | "ru",
  mode: StudioSegmentPromptImproveMode,
) => {
  const label =
    language === "en"
      ? mode === "ai_video"
        ? "Raw video scene description:"
        : mode === "photo_animation"
          ? "Raw photo animation instruction:"
          : mode === "image_edit"
            ? "Raw image edit request:"
            : "Raw scene description:"
      : mode === "ai_video"
        ? "Черновое описание видео-сцены:"
        : mode === "photo_animation"
          ? "Черновое описание анимации фото:"
          : mode === "image_edit"
            ? "Черновой запрос на дорисовку фото:"
            : "Черновое описание сцены:";

  const returnInstruction = language === "en" ? "Return only the final prompt." : "Верни только итоговый промт.";

  return [label, prompt, "", returnInstruction].join("\n");
};

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

const getStudioOpenRouterPromptEnhancementModelCandidates = () =>
  Array.from(
    new Set(
      [
        OPENROUTER_STUDIO_PROMPT_ENHANCEMENT_PRIMARY_MODEL,
        env.openrouterMainModel,
        env.openrouterFallbackModel,
      ]
        .map((model) => normalizePrompt(model ?? ""))
        .filter(Boolean),
    ),
  );

const createStudioOpenRouterMissingConfigError = () => new Error(STUDIO_OPENROUTER_MISSING_CONFIG_ERROR);

const requireStudioOpenRouterModels = () => {
  const modelCandidates = getStudioOpenRouterModelCandidates();
  if (!hasUsableOpenRouterApiKey(env.openrouterApiKey)) {
    throw createStudioOpenRouterMissingConfigError();
  }

  if (modelCandidates.length === 0) {
    throw new Error("OpenRouter is configured without any usable models.");
  }

  return modelCandidates;
};

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

const requestStudioSegmentPromptEnhancement = async (
  prompt: string,
  language: "en" | "ru",
  mode: StudioSegmentPromptImproveMode,
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
          content: buildStudioSegmentPromptEnhancementSystemPrompt(language, mode),
        },
        {
          role: "user",
          content: buildStudioSegmentPromptEnhancementUserPrompt(prompt, language, mode),
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

  const improvedPrompt = sanitizeStudioSegmentPromptEnhancementOutput(
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
  options?: {
    timeoutMs?: number;
  },
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
    signal: AbortSignal.timeout(options?.timeoutMs ?? OPENROUTER_STUDIO_PROMPT_TIMEOUT_MS),
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
    timeoutMs?: number;
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
  const timeoutBudgetMs = options?.timeoutMs;
  const timeoutStartedAt = typeof timeoutBudgetMs === "number" ? Date.now() : null;

  if (env.openrouterApiKey && modelCandidates.length > 0) {
    for (const model of modelCandidates) {
      const remainingTimeoutMs =
        typeof timeoutBudgetMs === "number" && timeoutStartedAt !== null
          ? timeoutBudgetMs - (Date.now() - timeoutStartedAt)
          : undefined;
      if (typeof remainingTimeoutMs === "number" && remainingTimeoutMs <= 0) {
        break;
      }

      try {
        return await requestStudioVisualPromptEnglishTranslation(normalizedPrompt, sourceLanguage, model, {
          timeoutMs: remainingTimeoutMs,
        });
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

const fetchStudioMediaAssetImage = async (assetId: number, externalUserId: string) => {
  const normalizedAssetId = normalizePositiveInteger(assetId);
  if (!normalizedAssetId) {
    throw new Error("Source media asset id is required.");
  }

  const response = await fetch(
    buildAdsflowUrl(`/api/media/${normalizedAssetId}/download`, {
      admin_token: env.adsflowAdminToken ?? "",
      external_user_id: externalUserId,
    }),
    {
      signal: AbortSignal.timeout(ADSFLOW_FETCH_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to download source media asset (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = inferStudioGeneratedImageMimeType(
    response.headers.get("content-type"),
    null,
    `/api/media/${normalizedAssetId}/download`,
  );
  const bytes = Buffer.from(arrayBuffer);
  if (!bytes.length) {
    throw new Error("Source media asset is empty.");
  }

  return {
    bytes,
    fileName: `character-source-${normalizedAssetId}${getStudioGeneratedImageExtension(mimeType)}`,
    mimeType,
  };
};

const normalizeAdsflowSegmentAiPhotoAsset = async (
  payload?: AdsflowSegmentAiPhotoAssetPayload | null,
  options?: {
    preferPortableResult?: boolean;
  },
): Promise<StudioGeneratedImageAsset> => {
  const assetId = normalizePositiveInteger(payload?.media_asset_id) ?? null;
  const inlineDataUrl = normalizeGenerationText(payload?.data_url);
  const remoteUrl = resolveAdsflowAssetUrl(payload?.remote_url ?? payload?.download_url ?? payload?.url);

  if (!assetId && !inlineDataUrl && !remoteUrl) {
    throw new Error("AdsFlow did not return a generated image.");
  }

  if (assetId && !(options?.preferPortableResult && (inlineDataUrl || remoteUrl))) {
    const mimeType = inferStudioGeneratedImageMimeType(
      payload?.mime_type,
      payload?.file_name,
      payload?.remote_url ?? payload?.download_url ?? payload?.url,
    );
    const fileName = normalizeStudioGeneratedImageFileName(payload?.file_name, mimeType);
    return {
      assetId,
      fileName,
      fileSize: Math.max(0, Number(payload?.file_size ?? 0)),
      mimeType,
      remoteUrl: `/api/workspace/media-assets/${assetId}`,
    };
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
  if (!remoteUrl) {
    throw new Error("Generated video is unavailable.");
  }

  return {
    assetId: normalizePositiveInteger(payload?.media_asset_id) ?? null,
    fileName: normalizeGenerationText(payload?.file_name) || `segment-ai-video-${jobId}.mp4`,
    fileSize: Math.max(0, Number(payload?.file_size ?? 0)),
    mimeType: normalizeGenerationText(payload?.mime_type) || "video/mp4",
    posterUrl: buildStudioSegmentAiVideoJobPosterProxyUrl(jobId),
    remoteUrl,
  };
};

const normalizeWaveSpeedSegmentAiVideoAsset = (jobId: string): StudioGeneratedVideoAsset => {
  const remoteUrl = buildStudioSegmentAiVideoJobVideoProxyUrl(jobId);
  if (!remoteUrl) {
    throw new Error("Generated video is unavailable.");
  }

  return {
    assetId: null,
    fileName: normalizeWaveSpeedSegmentAiVideoFileName(jobId),
    fileSize: 0,
    mimeType: "video/mp4",
    posterUrl: buildStudioSegmentAiVideoJobPosterProxyUrl(jobId),
    remoteUrl,
  };
};

const normalizeWaveSpeedSegmentPhotoAnimationAsset = (jobId: string): StudioGeneratedVideoAsset => {
  const remoteUrl = buildStudioSegmentPhotoAnimationJobVideoProxyUrl(jobId);
  if (!remoteUrl) {
    throw new Error("Generated video is unavailable.");
  }

  return {
    assetId: null,
    fileName: normalizeWaveSpeedSegmentPhotoAnimationFileName(jobId),
    fileSize: 0,
    mimeType: "video/mp4",
    posterUrl: buildStudioSegmentPhotoAnimationJobPosterProxyUrl(jobId),
    remoteUrl,
  };
};

const normalizeWaveSpeedSegmentTalkingPhotoAsset = (jobId: string): StudioGeneratedVideoAsset => {
  const remoteUrl = buildStudioSegmentTalkingPhotoJobVideoProxyUrl(jobId);
  if (!remoteUrl) {
    throw new Error("Generated talking character is unavailable.");
  }

  return {
    assetId: null,
    fileName: normalizeWaveSpeedSegmentTalkingPhotoFileName(jobId),
    fileSize: 0,
    mimeType: "video/mp4",
    posterUrl: buildStudioSegmentTalkingPhotoJobPosterProxyUrl(jobId),
    remoteUrl,
  };
};

const normalizeAdsflowSegmentPhotoAnimationAsset = (
  jobId: string,
  payload?: AdsflowSegmentAiVideoAssetPayload | null,
): StudioGeneratedVideoAsset => {
  const remoteUrl = buildStudioSegmentPhotoAnimationJobVideoProxyUrl(jobId);
  if (!remoteUrl) {
    throw new Error("Generated video is unavailable.");
  }

  return {
    assetId: normalizePositiveInteger(payload?.media_asset_id) ?? null,
    fileName: normalizeGenerationText(payload?.file_name) || `segment-photo-animation-${jobId}.mp4`,
    fileSize: Math.max(0, Number(payload?.file_size ?? 0)),
    mimeType: normalizeGenerationText(payload?.mime_type) || "video/mp4",
    posterUrl: null,
    remoteUrl,
  };
};

const normalizeAdsflowSegmentTalkingPhotoAsset = (
  jobId: string,
  payload?: AdsflowSegmentAiVideoAssetPayload | null,
): StudioGeneratedVideoAsset => {
  const remoteUrl = buildStudioSegmentTalkingPhotoJobVideoProxyUrl(jobId);
  if (!remoteUrl) {
    throw new Error("Generated talking character is unavailable.");
  }

  return {
    assetId: normalizePositiveInteger(payload?.media_asset_id) ?? null,
    fileName: normalizeGenerationText(payload?.file_name) || `segment-talking-photo-${jobId}.mp4`,
    fileSize: Math.max(0, Number(payload?.file_size ?? 0)),
    mimeType: normalizeGenerationText(payload?.mime_type) || "video/mp4",
    posterUrl: null,
    remoteUrl,
  };
};

const normalizeAdsflowSegmentSceneSoundAsset = (
  jobId: string,
  payload?: AdsflowSegmentAiVideoAssetPayload | null,
): StudioGeneratedAudioAsset => {
  const remoteUrl = buildStudioSegmentSceneSoundJobAudioProxyUrl(jobId);
  if (!remoteUrl) {
    throw new Error("Generated scene sound is unavailable.");
  }

  return {
    assetId: normalizePositiveInteger(payload?.media_asset_id) ?? null,
    fileName: normalizeGenerationText(payload?.file_name) || `segment-scene-sound-${jobId}.wav`,
    fileSize: Math.max(0, Number(payload?.file_size ?? 0)),
    mimeType: normalizeGenerationText(payload?.mime_type) || "audio/wav",
    remoteUrl,
  };
};

const normalizeAdsflowSegmentVoiceoverAsset = (
  jobId: string,
  payload?: AdsflowSegmentAiVideoAssetPayload | null,
): StudioGeneratedAudioAsset => {
  const remoteUrl = buildStudioSegmentVoiceoverJobAudioProxyUrl(jobId);
  if (!remoteUrl) {
    throw new Error("Generated voiceover is unavailable.");
  }

  return {
    assetId: normalizePositiveInteger(payload?.media_asset_id) ?? null,
    fileName: normalizeGenerationText(payload?.file_name) || `segment-voiceover-${jobId}.wav`,
    fileSize: Math.max(0, Number(payload?.file_size ?? 0)),
    mimeType: normalizeGenerationText(payload?.mime_type) || "audio/wav",
    remoteUrl,
  };
};

const normalizeSegmentVoiceoverSpeechWords = (
  value: unknown,
): StudioSegmentVoiceoverSpeechWord[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as AdsflowSegmentVoiceoverSpeechWordPayload;
      const text = normalizeGenerationText(record.text);
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
    .filter((item): item is StudioSegmentVoiceoverSpeechWord => Boolean(item));
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

const fetchAdsflowSubscriptionDetails = async (
  userId: string | number | null | undefined,
  options?: {
    currentPlanHint?: string | null;
  },
): Promise<WorkspaceSubscriptionDetails> => {
  const cacheKey = getWorkspaceSubscriptionExpiryCacheKey(userId);
  if (!cacheKey) {
    return FALLBACK_WORKSPACE_SUBSCRIPTION_DETAILS;
  }

  const cachedValue = getCachedWorkspaceSubscriptionExpiry(cacheKey);
  if (cachedValue !== undefined) {
    return cachedValue;
  }

  const inFlightRequest = workspaceSubscriptionExpiryInFlight.get(cacheKey);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = (async () => {
    let payload: AdsflowAdminUserDetailsResponse;
    try {
      payload = await fetchAdsflowJson<AdsflowAdminUserDetailsResponse>(
        buildAdsflowUrl(`/api/admin/users/${encodeURIComponent(cacheKey)}`),
        {
          headers: {
            "X-Admin-Token": env.adsflowAdminToken ?? "",
          },
        },
        {
          retryDelaysMs: [],
          silentStatuses: [404],
          timeoutMs: WORKSPACE_SUBSCRIPTION_EXPIRY_TIMEOUT_MS,
        },
      );
    } catch (error) {
      if (isAdsflowHttpStatusError(error, 404)) {
        const details = { ...FALLBACK_WORKSPACE_SUBSCRIPTION_DETAILS };
        setCachedWorkspaceSubscriptionExpiry(cacheKey, details);
        return details;
      }

      throw error;
    }

    const details = resolveWorkspaceSubscriptionDetailsFromAdminPayload(payload, {
      currentPlanHint: options?.currentPlanHint,
    });
    setCachedWorkspaceSubscriptionExpiry(cacheKey, details);
    return details;
  })().finally(() => {
    workspaceSubscriptionExpiryInFlight.delete(cacheKey);
  });

  workspaceSubscriptionExpiryInFlight.set(cacheKey, request);
  return request;
};

const fetchAdsflowSubscriptionDetailsForBootstrap = async (
  externalUserId: string,
  user: StudioUser,
): Promise<WorkspaceSubscriptionDetails | null> => {
  const externalAdsflowUserId = getWorkspaceSubscriptionExpiryCacheKey(externalUserId);
  if (externalAdsflowUserId) {
    return fetchAdsflowSubscriptionDetails(externalAdsflowUserId);
  }

  const email = normalizeGenerationText(user.email).toLowerCase();
  if (!email) {
    return null;
  }

  const payload = await fetchAdsflowJson<AdsflowAdminUsersListResponse>(
    buildAdsflowUrl("/api/admin/users", {
      page_size: "5",
      q: email,
    }),
    {
      headers: {
        "X-Admin-Token": env.adsflowAdminToken ?? "",
      },
    },
    {
      retryDelaysMs: [],
      silentStatuses: [404],
      timeoutMs: WORKSPACE_SUBSCRIPTION_EXPIRY_TIMEOUT_MS,
    },
  ).catch(() => null);

  const matchingUser = payload?.items?.find((item) => normalizeGenerationText(item.username).toLowerCase() === email);

  if (!matchingUser) {
    return null;
  }

  const details = resolveWorkspaceSubscriptionDetailsFromAdminPayload({
    user: matchingUser,
  });

  if (details.userId) {
    setCachedWorkspaceSubscriptionExpiry(details.userId, details);
  }

  return details;
};

const restoreAdsflowStartSubscriptionAfterBootstrap = async (
  details: WorkspaceSubscriptionDetails | null | undefined,
  bootstrapProfile: WorkspaceProfile,
) => {
  if (details?.plan !== "START" || !details.userId || bootstrapProfile.plan === "START") {
    return;
  }

  try {
    await fetchAdsflowJson(
      buildAdsflowUrl(`/api/admin/users/${encodeURIComponent(details.userId)}/change-subscription`, {
        days: "30",
        subscription_type: "start",
      }),
      {
        headers: {
          "X-Admin-Token": env.adsflowAdminToken ?? "",
        },
        method: "POST",
      },
      {
        retryDelaysMs: [],
        timeoutMs: WORKSPACE_SUBSCRIPTION_EXPIRY_TIMEOUT_MS,
      },
    );
    setCachedWorkspaceSubscriptionExpiry(details.userId, details);
  } catch (error) {
    console.warn("[studio] Failed to restore manual START subscription after AdsFlow bootstrap", {
      error: error instanceof Error ? error.message : "Unknown error.",
      userId: details.userId,
    });
  }
};

const fetchAdsflowSubscriptionDetailsForWebMutation = async (externalUserId: string, user: StudioUser) =>
  fetchAdsflowSubscriptionDetailsForBootstrap(externalUserId, user).catch((error) => {
    console.warn("[studio] Failed to load pre-mutation AdsFlow subscription details", {
      error: error instanceof Error ? error.message : "Unknown error.",
    });
    return null;
  });

const enrichWorkspaceProfileAfterAdsflowWebMutation = async (
  payload: AdsflowWebUserPayload | undefined,
  rawUserId: string | null | undefined,
  subscriptionDetails: WorkspaceSubscriptionDetails | null | undefined,
) => {
  const rawProfile = buildWorkspaceProfile(payload);
  const enrichedProfile = await enrichWorkspaceProfile(payload, {
    rawUserId,
  });
  const profile = applyWorkspaceSubscriptionDetailsToProfile(enrichedProfile, subscriptionDetails);
  await restoreAdsflowStartSubscriptionAfterBootstrap(subscriptionDetails, rawProfile);
  return profile;
};

const enrichWorkspaceProfile = async (
  payload?: AdsflowWebUserPayload,
  options?: { rawUserId?: string | null },
): Promise<WorkspaceProfile> => {
  const profile = buildWorkspaceProfile(payload);
  if (profile.startPlanUsed && (profile.plan === "FREE" || profile.plan === "START" || profile.expiresAt)) {
    return profile;
  }

  try {
    const details = await fetchAdsflowSubscriptionDetails(options?.rawUserId ?? payload?.user_id, {
      currentPlanHint: profile.plan,
    });
    return applyWorkspaceSubscriptionDetailsToProfile(profile, details);
  } catch {
    return profile;
  }
};

const buildStudioGeneration = (
  payload: AdsflowJobStatusResponse,
  options?: {
    description?: string | null;
    historyEntry?: WorkspaceGenerationHistoryEntry | null;
    hashtags?: string[] | string | null;
    prompt?: string | null;
    title?: string | null;
  },
): StudioGeneration | null => {
  const metadata = resolveGenerationPresentation({
    description: options?.description ?? payload.description,
    fallbackTitle: "Готовое видео",
    hashtags: options?.hashtags ?? payload.hashtags,
    language: options?.historyEntry?.prefillSettings?.language,
    prompt: options?.prompt ?? payload.prompt,
    title: options?.title ?? payload.title,
  });
  const jobId = String(payload.job_id ?? "");
  const finalAsset = buildStudioFinalAsset({
    adId: payload.ad_id ?? null,
    downloadPath: payload.download_path ?? null,
    generatedAt: payload.generated_at ?? null,
    historyEntry: options?.historyEntry ?? null,
    kind: "final_video",
    mediaAssetId: payload.media_asset_id ?? null,
    status: payload.status ?? null,
  });
  const videoUrls = buildStudioGenerationVideoUrls({
    downloadPath: finalAsset?.downloadPath ?? payload.download_path,
    generatedAt: payload.generated_at,
    jobId,
  });

  if (!videoUrls) {
    return null;
  }

  return {
    adId: payload.ad_id ?? null,
    id: jobId,
    prompt: metadata.prompt,
    title: metadata.title,
    description: metadata.description,
    hashtags: metadata.hashtags,
    finalAsset,
    videoFallbackUrl: videoUrls.videoFallbackUrl,
    videoUrl: videoUrls.videoUrl,
    durationLabel: "Ready",
    isReadyForEditor: typeof payload.ready === "boolean" ? payload.ready : null,
    modelLabel: "AdsFlow pipeline",
    prefillSettings: options?.historyEntry?.prefillSettings ?? null,
    projectStatus: normalizeGenerationText(payload.project_status) || null,
    readyReason: normalizeGenerationText(payload.ready_reason) || null,
    aspectRatio: "9:16",
    generatedAt: payload.generated_at ?? new Date().toISOString(),
  };
};

const isAdsflowLatestVideoGenerationTask = (value: string | null | undefined) => {
  const normalized = normalizeGenerationText(value).toLowerCase();
  return !normalized || normalized === "video.generate" || normalized === "video.edit";
};

const buildStudioGenerationFromLatest = (
  payload: AdsflowLatestGenerationPayload,
  historyEntry?: WorkspaceGenerationHistoryEntry | null,
): StudioGeneration | null => {
  if (!isAdsflowLatestVideoGenerationTask(payload.task_type)) {
    return null;
  }

  const metadata = resolveGenerationPresentation({
    description: historyEntry?.description || payload.description,
    fallbackTitle: "Готовое видео",
    hashtags: historyEntry?.hashtags.length ? historyEntry.hashtags : payload.hashtags,
    language: historyEntry?.prefillSettings?.language,
    prompt: historyEntry?.prompt || payload.prompt,
    title: historyEntry?.title || payload.title,
  });
  const jobId = String(payload.job_id ?? "");
  const finalAsset = buildStudioFinalAsset({
    adId: payload.ad_id ?? null,
    downloadPath: payload.download_path ?? null,
    generatedAt: payload.generated_at ?? null,
    historyEntry,
    kind: "final_video",
    mediaAssetId: payload.media_asset_id ?? null,
    status: payload.status ?? null,
  });
  const videoUrls = buildStudioGenerationVideoUrls({
    downloadPath: finalAsset?.downloadPath ?? payload.download_path,
    generatedAt: payload.generated_at,
    jobId,
  });

  if (!videoUrls) {
    return null;
  }

  return {
    adId: payload.ad_id ?? null,
    id: jobId,
    prompt: metadata.prompt,
    title: metadata.title,
    description: metadata.description,
    hashtags: metadata.hashtags,
    finalAsset,
    videoFallbackUrl: videoUrls.videoFallbackUrl,
    videoUrl: videoUrls.videoUrl,
    durationLabel: "Ready",
    isReadyForEditor: typeof payload.ready === "boolean" ? payload.ready : null,
    modelLabel: "AdsFlow pipeline",
    prefillSettings: historyEntry?.prefillSettings ?? null,
    projectStatus: normalizeGenerationText(payload.project_status) || null,
    readyReason: normalizeGenerationText(payload.ready_reason) || null,
    aspectRatio: "9:16",
    generatedAt: payload.generated_at ?? new Date().toISOString(),
  };
};

const buildStudioGenerationFromHistoryEntry = (entry: WorkspaceGenerationHistoryEntry): StudioGeneration | null => {
  const jobId = normalizeGenerationText(entry.jobId);
  if (!jobId) {
    return null;
  }

  const normalizedStatus = normalizeGenerationText(entry.status).toLowerCase();
  if (!canExposeStudioFinalVideoFromStatus({
    downloadPath: entry.downloadPath,
    error: entry.error,
    status: normalizedStatus,
  })) {
    return null;
  }

  const finalAsset = buildStudioFinalAsset({
    adId: entry.adId,
    downloadPath: entry.downloadPath ?? null,
    generatedAt: entry.generatedAt ?? entry.updatedAt ?? entry.createdAt,
    historyEntry: entry,
    kind: entry.finalAssetKind ?? "final_video",
    mediaAssetId: entry.finalAssetId ?? null,
    status: entry.finalAssetStatus ?? entry.status,
  });
  const videoUrls = buildStudioGenerationVideoUrls({
    downloadPath: finalAsset?.downloadPath ?? entry.downloadPath,
    generatedAt: entry.generatedAt ?? entry.updatedAt ?? entry.createdAt,
    jobId,
  });
  if (!videoUrls) {
    return null;
  }

  const metadata = resolveGenerationPresentation({
    description: entry.description,
    fallbackTitle: "Готовое видео",
    hashtags: entry.hashtags,
    prompt: entry.prompt,
    title: entry.title,
  });

  return {
    adId: entry.adId,
    aspectRatio: "9:16",
    description: metadata.description,
    durationLabel: "Ready",
    generatedAt: entry.generatedAt ?? entry.updatedAt ?? entry.createdAt,
    hashtags: metadata.hashtags,
    id: jobId,
    isReadyForEditor: null,
    modelLabel: "AdsFlow pipeline",
    prefillSettings: entry.prefillSettings ?? null,
    prompt: metadata.prompt,
    projectStatus: null,
    readyReason: null,
    title: metadata.title,
    finalAsset,
    videoFallbackUrl: videoUrls.videoFallbackUrl,
    videoUrl: videoUrls.videoUrl,
  };
};

const buildLatestGenerationStatus = (
  payload?: AdsflowLatestGenerationPayload | null,
  historyEntry?: WorkspaceGenerationHistoryEntry | null,
): StudioGenerationStatus | null => {
  if (!payload?.job_id) {
    return null;
  }

  if (!isAdsflowLatestVideoGenerationTask(payload.task_type)) {
    return null;
  }

  const status = String(payload.status ?? "queued");
  const publicStatus = getStudioGenerationPublicStatus({
    downloadPath: payload.download_path,
    error: payload.error,
    projectStatus: payload.project_status,
    readyReason: payload.ready_reason,
    status,
  });
  const generation = publicStatus === "done" ? buildStudioGenerationFromLatest(payload, historyEntry) : null;

  return {
    error: generation ? undefined : payload.error ?? undefined,
    generation: generation ?? undefined,
    isReadyForEditor: typeof payload.ready === "boolean" ? payload.ready : undefined,
    jobId: String(payload.job_id),
    projectStatus: normalizeGenerationText(payload.project_status) || undefined,
    readyReason: normalizeGenerationText(payload.ready_reason) || undefined,
    status: generation ? "done" : status,
  };
};

const buildStudioGenerationStatusFromHistoryEntry = (
  entry: WorkspaceGenerationHistoryEntry,
  options?: {
    fallbackStatus?: string;
  },
): StudioGenerationStatus => {
  const safeJobId = normalizeGenerationText(entry.jobId);
  const normalizedStatus = normalizeGenerationText(entry.status).toLowerCase();
  const generation = buildStudioGenerationFromHistoryEntry(entry);

  if (generation) {
    return {
      generation,
      jobId: safeJobId,
      status: "done",
    };
  }

  const status = normalizedStatus || normalizeGenerationText(options?.fallbackStatus) || "queued";
  return {
    error: entry.error ?? undefined,
    jobId: safeJobId,
    status,
  };
};

const isStudioGenerationStatusDeleted = (
  status: StudioGenerationStatus | null | undefined,
  deletedProjects: WorkspaceDeletedProjectEntry[],
) => {
  if (!status) {
    return false;
  }

  const generation = status.generation;
  const adId =
    typeof generation?.adId === "number" && Number.isFinite(generation.adId) && generation.adId > 0
      ? Math.trunc(generation.adId)
      : null;
  const jobId = normalizeGenerationText(generation?.id || status.jobId);
  const projectIds = new Set<string>();

  if (adId !== null) {
    projectIds.add(`project:${adId}`);
  }

  if (jobId) {
    projectIds.add(`task:${jobId}`);
  }

  return deletedProjects.some((deletedProject) => {
    if (deletedProject.projectId && projectIds.has(deletedProject.projectId)) {
      return true;
    }

    if (deletedProject.adId !== null && adId !== null && deletedProject.adId === adId) {
      return true;
    }

    if (deletedProject.jobId && jobId && deletedProject.jobId === jobId) {
      return true;
    }

    return false;
  });
};

const removeDeletedStudioGenerationStatus = (
  status: StudioGenerationStatus | null,
  deletedProjects: WorkspaceDeletedProjectEntry[],
) => (isStudioGenerationStatusDeleted(status, deletedProjects) ? null : status);

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

const findWorkspaceHistoryFallbackGeneration = async (
  user: StudioUser,
  excludedVideoUrls: string[] = [],
  deletedProjects: WorkspaceDeletedProjectEntry[] = [],
) => {
  const excludedVideoUrlSet = new Set(
    excludedVideoUrls
      .map((value) => normalizeGenerationText(value))
      .filter(Boolean),
  );

  const historyEntries = await listWorkspaceGenerationHistory(user, 60);
  for (const historyEntry of historyEntries) {
    const fallbackStatus = buildStudioGenerationStatusFromHistoryEntry(historyEntry);
    if (isStudioGenerationStatusDeleted(fallbackStatus, deletedProjects)) {
      continue;
    }

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
const ADSFLOW_MUTATION_TIMEOUT_MS = 90_000;

type AdsflowRequestOptions = {
  retryDelaysMs?: number[];
  silentStatuses?: number[];
  timeoutMs?: number;
};

class AdsflowHttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AdsflowHttpError";
    this.statusCode = statusCode;
  }
}

type StudioGeneratedVideoPosterKind = "segment-ai-video" | "segment-photo-animation" | "segment-talking-photo";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isAdsflowHttpStatusError = (error: unknown, ...statusCodes: number[]) =>
  error instanceof AdsflowHttpError && statusCodes.includes(error.statusCode);

const WORKSPACE_REFERENCE_MEDIA_ROLES = new Set([
  "character_reference",
  "character_reference_source",
  "scene_reference",
  "scene_reference_source",
]);

export const shouldUseProjectLevelWorkspaceReferenceMedia = (options?: {
  kind?: unknown;
  purpose?: unknown;
  role?: unknown;
}) => {
  const kind = normalizeGenerationText(options?.kind);
  const purpose = normalizeGenerationText(options?.purpose);
  const role = normalizeGenerationText(options?.role);

  return (
    purpose === "workspace_reference" ||
    kind === "workspace_reference" ||
    kind === "workspace_reference_source" ||
    WORKSPACE_REFERENCE_MEDIA_ROLES.has(role)
  );
};

export const normalizeStudioMediaSegmentIndexForScope = (
  segmentIndex: unknown,
  options?: {
    kind?: unknown;
    purpose?: unknown;
    role?: unknown;
  },
) => {
  if (shouldUseProjectLevelWorkspaceReferenceMedia(options)) {
    return undefined;
  }

  return normalizeNonNegativeInteger(segmentIndex) ?? undefined;
};

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

    if (!(options?.silentStatuses ?? []).includes(response.status)) {
      console.error("[adsflow] HTTP error", url.pathname, response.status, JSON.stringify(payload));
    }

    if (response.status === 402) {
      throw new WorkspaceCreditLimitError(detail);
    }

    throw new AdsflowHttpError(detail, response.status);
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
      ...getCurrentAdsflowWebSignalHeaders(),
    },
    body: JSON.stringify(addCurrentAdsflowWebDeviceToBody(body)),
  }, options);

  const payload = await response.text();
  if (!response.ok) {
    const detail = extractErrorDetail(payload) ?? `AdsFlow request failed (${response.status}).`;

    if (response.status === 402) {
      throw new WorkspaceCreditLimitError(detail);
    }

    throw new AdsflowHttpError(detail, response.status);
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
      ...getCurrentAdsflowWebSignalHeaders(),
    },
    body: JSON.stringify(addCurrentAdsflowWebDeviceToBody(body)),
  }, options);
};

const getAdsflowHealthComponentStatus = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return normalizeGenerationText(value).toLowerCase();
  }

  const statusValue = (value as { status?: unknown }).status;
  return normalizeGenerationText(statusValue).toLowerCase();
};

const isAdsflowHealthComponentHealthy = (value: unknown) => {
  const status = getAdsflowHealthComponentStatus(value);
  return status === "healthy" || status === "ok";
};

const getAdsflowHealthWorkersOnlineCount = (value: unknown): number | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const workerPayload = value as { online_count?: unknown; workers_count?: unknown };
  const rawCount = workerPayload.online_count ?? workerPayload.workers_count;
  const count = Number(rawCount);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : null;
};

export async function getStudioGenerationAvailability(): Promise<StudioGenerationAvailability> {
  try {
    assertAdsflowConfigured();

    const response = await fetchAdsflowResponse(
      buildAdsflowUrl("/health"),
      undefined,
      {
        retryDelaysMs: [],
        timeoutMs: Math.max(1_000, env.upstreamProbeTimeoutMs),
      },
    );
    const payload = (await response.json().catch(() => null)) as AdsflowHealthResponse | null;
    const components: NonNullable<AdsflowHealthResponse["components"]> = payload?.components ?? {};
    const workersOnline = getAdsflowHealthWorkersOnlineCount(components.workers);
    const workersHealthy = isAdsflowHealthComponentHealthy(components.workers) && (workersOnline === null || workersOnline > 0);
    const redisHealthy = isAdsflowHealthComponentHealthy(components.redis);
    const databaseHealthy = isAdsflowHealthComponentHealthy(components.database);
    const taskQueueHealthy = components.task_queue === undefined || isAdsflowHealthComponentHealthy(components.task_queue);
    const statusValue = normalizeGenerationText(payload?.status).toLowerCase() || null;
    const available =
      response.ok &&
      (statusValue === null || statusValue === "healthy") &&
      workersHealthy &&
      redisHealthy &&
      databaseHealthy &&
      taskQueueHealthy;

    return {
      available,
      reason: available ? null : "adsflow_health_unavailable",
      status: statusValue,
      workersOnline,
    };
  } catch (error) {
    console.warn("[studio] Failed to check generation worker availability", {
      error: error instanceof Error ? error.message : "Unknown worker availability error.",
    });

    return {
      available: false,
      reason: "adsflow_health_check_failed",
      status: null,
      workersOnline: null,
    };
  }
}

export async function ensureStudioGenerationWorkersAvailable(): Promise<void> {
  const availability = await getStudioGenerationAvailability();
  if (!availability.available) {
    throw new StudioGenerationUnavailableError();
  }
}

export async function getStudioProjectCharacters(
  projectId: number,
  _user: StudioUser,
  options?: { bootstrap?: boolean },
): Promise<StudioProjectCharactersResult> {
  assertAdsflowConfigured();

  const normalizedProjectId = normalizePositiveInteger(projectId);
  if (!normalizedProjectId) {
    throw new Error("Project id is required.");
  }

  const payload = await fetchAdsflowJson<AdsflowProjectCharactersResponse>(
    buildAdsflowUrl(`/api/projects/${encodeURIComponent(String(normalizedProjectId))}/characters`, {
      admin_token: env.adsflowAdminToken ?? "",
      bootstrap: options?.bootstrap === true ? "true" : "false",
    }),
    undefined,
    { retryDelaysMs: [], timeoutMs: ADSFLOW_FETCH_TIMEOUT_MS },
  );

  return {
    characters: (payload.characters ?? []).map(normalizeAdsflowProjectCharacter).filter(Boolean) as StudioProjectCharacter[],
    projectId: normalizedProjectId,
  };
}

export async function createStudioProjectCharacter(
  projectId: number,
  _user: StudioUser,
  options: {
    aliases?: string[];
    description?: string;
    label: string;
    referenceAssetIds: number[];
    segmentIndex?: number;
  },
): Promise<StudioProjectCharactersResult> {
  assertAdsflowConfigured();

  const normalizedProjectId = normalizePositiveInteger(projectId);
  const label = normalizeGenerationText(options.label);
  const referenceAssetIds = normalizePositiveIntegerList(options.referenceAssetIds);
  if (!normalizedProjectId) {
    throw new Error("Project id is required.");
  }
  if (!label) {
    throw new Error("Character name is required.");
  }
  if (referenceAssetIds.length === 0) {
    throw new Error("Character reference asset is required.");
  }

  const payload = await postAdsflowJson<AdsflowProjectCharactersResponse>(
    `/api/projects/${encodeURIComponent(String(normalizedProjectId))}/characters/upsert-from-generation`,
    {
      admin_token: env.adsflowAdminToken,
      aliases: normalizeTextList(options.aliases),
      description: normalizeGenerationText(options.description) || undefined,
      label,
      prompt: label,
      reference_asset_ids: referenceAssetIds,
      segment_index: normalizeNonNegativeInteger(options.segmentIndex),
    },
    { retryDelaysMs: [], timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS },
  );

  return {
    characters: (payload.characters ?? []).map(normalizeAdsflowProjectCharacter).filter(Boolean) as StudioProjectCharacter[],
    projectId: normalizedProjectId,
  };
}

const uploadStudioMediaAsset = async (
  user: StudioUser,
  options: {
    dataUrl: string;
    externalUserId: string;
    fileName: string;
    kind: string;
    language: "en" | "ru";
    mediaType?: "audio" | "photo" | "video" | "binary";
    mimeType?: string | null;
    projectId?: number | null;
    role?: string | null;
    segmentIndex?: number | null;
  },
): Promise<number> => {
  const normalizedDataUrl = String(options.dataUrl ?? "").trim();
  if (!normalizedDataUrl) {
    throw new Error("Uploaded media data URL is required.");
  }

  const normalizedFileName = String(options.fileName ?? "").trim();
  if (!normalizedFileName) {
    throw new Error("Uploaded media file name is required.");
  }

  const decoded = decodeBinaryDataUrl(normalizedDataUrl);
  if (!decoded.bytes.length) {
    throw new Error("Uploaded media file is empty.");
  }

  const normalizedMimeType = normalizeGenerationText(options.mimeType) || decoded.mimeType || "application/octet-stream";
  const normalizedMediaType =
    options.mediaType || inferStudioUploadMediaType(normalizedMimeType, normalizedFileName);
  const normalizedSegmentIndex = normalizeStudioMediaSegmentIndexForScope(options.segmentIndex, {
    kind: options.kind,
    role: options.role,
  });

  const initPayload = await postAdsflowJson<AdsflowMediaUploadInitResponse>("/api/media/uploads/init", {
    admin_token: env.adsflowAdminToken,
    external_user_id: options.externalUserId,
    file_name: normalizedFileName,
    kind: options.kind,
    language: options.language,
    media_type: normalizedMediaType,
    mime_type: normalizedMimeType,
    project_id: options.projectId ?? undefined,
    role: options.role ?? undefined,
    segment_index: normalizedSegmentIndex,
    size_bytes: decoded.bytes.length,
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  }, {
    retryDelaysMs: [],
    timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
  });

  const assetId = normalizePositiveInteger(initPayload.asset?.id);
  if (!assetId) {
    throw new Error("AdsFlow did not return a media asset id.");
  }

  const uploadUrl = normalizeGenerationText(initPayload.upload?.url);
  if (!uploadUrl) {
    throw new Error("AdsFlow did not return a direct media upload URL.");
  }

  const uploadHeaders = new Headers();
  Object.entries(initPayload.upload?.headers ?? {}).forEach(([key, value]) => {
    if (value) {
      uploadHeaders.set(key, value);
    }
  });
  if (!uploadHeaders.has("content-type")) {
    uploadHeaders.set("content-type", normalizedMimeType);
  }

  const uploadResponse = await fetch(uploadUrl, {
    body: new Blob([decoded.bytes], { type: normalizedMimeType }),
    headers: uploadHeaders,
    method: normalizeGenerationText(initPayload.upload?.method) || "PUT",
    signal: AbortSignal.timeout(ADSFLOW_MUTATION_TIMEOUT_MS),
  });
  if (!uploadResponse.ok) {
    throw new Error(`Direct media upload failed (${uploadResponse.status}).`);
  }

  await postAdsflowJson<AdsflowMediaUploadResponse>("/api/media/uploads/complete", {
    admin_token: env.adsflowAdminToken,
    asset_id: assetId,
    external_user_id: options.externalUserId,
    language: options.language,
    project_id: options.projectId ?? undefined,
    role: options.role ?? undefined,
    segment_index: normalizedSegmentIndex,
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  }, {
    retryDelaysMs: [],
    timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
  });

  return assetId;
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

const fetchAdsflowSegmentTalkingPhotoJobStatus = async (jobId: string, user: StudioUser) => {
  assertAdsflowConfigured();

  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const externalUserId = await resolveStudioExternalUserId(user);

  return fetchAdsflowJson<AdsflowSegmentAiVideoJobStatusResponse>(
    buildAdsflowUrl(`/api/web/segment-talking-photo/jobs/${encodeURIComponent(safeJobId)}`, {
      admin_token: env.adsflowAdminToken ?? "",
      external_user_id: externalUserId,
    }),
  );
};

const fetchAdsflowSegmentImageEditJobStatus = async (jobId: string, user: StudioUser) => {
  assertAdsflowConfigured();

  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const externalUserId = await resolveStudioExternalUserId(user);

  return fetchAdsflowJson<AdsflowSegmentAiPhotoJobStatusResponse>(
    buildAdsflowUrl(`/api/web/segment-image-edit/jobs/${encodeURIComponent(safeJobId)}`, {
      admin_token: env.adsflowAdminToken ?? "",
      external_user_id: externalUserId,
    }),
  );
};

const fetchAdsflowSegmentImageUpscaleJobStatus = async (jobId: string, user: StudioUser) => {
  assertAdsflowConfigured();

  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const externalUserId = await resolveStudioExternalUserId(user);

  return fetchAdsflowJson<AdsflowSegmentAiPhotoJobStatusResponse>(
    buildAdsflowUrl(`/api/web/segment-image-upscale/jobs/${encodeURIComponent(safeJobId)}`, {
      admin_token: env.adsflowAdminToken ?? "",
      external_user_id: externalUserId,
    }),
  );
};

const fetchAdsflowSegmentSceneSoundJobStatus = async (jobId: string, user: StudioUser) => {
  assertAdsflowConfigured();

  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const externalUserId = await resolveStudioExternalUserId(user);

  return fetchAdsflowJson<AdsflowSegmentAiVideoJobStatusResponse>(
    buildAdsflowUrl(`/api/web/segment-scene-sound/jobs/${encodeURIComponent(safeJobId)}`, {
      admin_token: env.adsflowAdminToken ?? "",
      external_user_id: externalUserId,
    }),
  );
};

const fetchAdsflowSegmentVoiceoverJobStatus = async (jobId: string, user: StudioUser) => {
  assertAdsflowConfigured();

  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const externalUserId = await resolveStudioExternalUserId(user);

  return fetchAdsflowJson<AdsflowSegmentVoiceoverJobStatusResponse>(
    buildAdsflowUrl(`/api/web/segment-voiceover/jobs/${encodeURIComponent(safeJobId)}`, {
      admin_token: env.adsflowAdminToken ?? "",
      external_user_id: externalUserId,
    }),
  );
};

const consumeWorkspaceGenerationCredit = async (user: StudioUser, amount = 1, language?: string) => {
  const externalUserId = await resolveStudioExternalUserId(user);
  const subscriptionDetails = await fetchAdsflowSubscriptionDetailsForWebMutation(externalUserId, user);
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
    profile: await enrichWorkspaceProfileAfterAdsflowWebMutation(payload.user, extractAdsflowUserId(payloadText), subscriptionDetails),
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
  const subscriptionDetails = await fetchAdsflowSubscriptionDetailsForWebMutation(externalUserId, user);
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

  return await enrichWorkspaceProfileAfterAdsflowWebMutation(payload.user, extractAdsflowUserId(payloadText), subscriptionDetails);
};

export async function getWorkspaceBootstrap(user: StudioUser, options: WorkspaceBootstrapOptions = {}): Promise<WorkspaceBootstrap> {
  const externalUserId = await resolveStudioExternalUserId(user);
  const referralSource = normalizeWebReferralSource(options.referralSource) || "landing_site";
  const cacheKey = await resolveStudioAuthScopedCacheKey(user, externalUserId);
  const cachedBootstrap = getCachedWorkspaceBootstrap(cacheKey);
  const deletedProjectsPromise = listWorkspaceDeletedProjects(user).catch((error) => {
    console.error("[studio] Failed to load deleted workspace projects for bootstrap", error);
    return [] as WorkspaceDeletedProjectEntry[];
  });
  const preBootstrapSubscriptionDetails = await fetchAdsflowSubscriptionDetailsForBootstrap(externalUserId, user).catch(
    (error) => {
      console.warn("[studio] Failed to load pre-bootstrap AdsFlow subscription details", {
        error: error instanceof Error ? error.message : "Unknown error.",
      });
      return null;
    },
  );

  try {
    const payloadText = await postAdsflowTextWithPolicy(
      "/api/web/bootstrap",
      {
        admin_token: env.adsflowAdminToken,
        external_user_id: externalUserId,
        language: "ru",
        referral_source: referralSource,
        user_email: user.email ?? undefined,
        user_email_verified: user.emailVerified === true,
        user_name: user.name ?? undefined,
      },
      upstreamPolicies.adsflowBootstrap,
      {
        endpoint: "studio.bootstrap",
        projectId: externalUserId,
      },
    );
    const payload = parseJson<AdsflowBootstrapResponse>(payloadText);

    if (!payload?.user) {
      throw new Error("AdsFlow did not return web user profile.");
    }

    const rawBootstrapProfile = buildWorkspaceProfile(payload.user);
    const bootstrapProfile = await enrichWorkspaceProfile(payload.user, {
      rawUserId: extractAdsflowUserId(payloadText),
    });
    const profile = applyWorkspaceSubscriptionDetailsToProfile(bootstrapProfile, preBootstrapSubscriptionDetails);
    await restoreAdsflowStartSubscriptionAfterBootstrap(preBootstrapSubscriptionDetails, rawBootstrapProfile);

    const latestHistoryEntry = payload.latest_generation?.job_id
      ? await getWorkspaceGenerationHistoryEntry(user, String(payload.latest_generation.job_id)).catch(() => null)
      : null;
    const deletedProjects = await deletedProjectsPromise;
    const latestGeneration = removeDeletedStudioGenerationStatus(
      await prepareStudioLatestGenerationForBootstrap(
        buildLatestGenerationStatus(payload.latest_generation, latestHistoryEntry),
        user,
      ),
      deletedProjects,
    );

    const bootstrap = {
      latestGeneration,
      profile,
      studioOptions: buildWorkspaceStudioOptions(payload.studio_options),
    } satisfies WorkspaceBootstrap;

    if (latestGeneration?.generation) {
      warmStudioGenerationPlayback(latestGeneration.generation, user);
    }

    setCachedWorkspaceBootstrap(cacheKey, bootstrap);
    return bootstrap;
  } catch (error) {
    console.error("[studio] Falling back to local workspace bootstrap", error);

    const deletedProjects = await deletedProjectsPromise;
    let latestGeneration = removeDeletedStudioGenerationStatus(cachedBootstrap?.latestGeneration ?? null, deletedProjects);
    const excludedFallbackVideoUrls = latestGeneration?.generation ? [latestGeneration.generation.videoUrl] : [];

    if (!latestGeneration?.generation) {
      try {
        const historyGeneration = await findWorkspaceHistoryFallbackGeneration(user, excludedFallbackVideoUrls, deletedProjects);
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

    latestGeneration = removeDeletedStudioGenerationStatus(
      await prepareStudioLatestGenerationForBootstrap(latestGeneration, user),
      deletedProjects,
    );

    if (latestGeneration?.generation) {
      warmStudioGenerationPlayback(latestGeneration.generation, user);
    }

    if (!cachedBootstrap) {
      throw error instanceof Error ? error : new Error("Workspace bootstrap failed and no cached profile is available.");
    }

    return {
      latestGeneration,
      profile: cachedBootstrap.profile,
      studioOptions: cachedBootstrap.studioOptions,
    };
  }
}

export async function createStudioGenerationJob(
  prompt: string,
  user: StudioUser,
  options?: {
    addWatermark?: boolean;
    brandChanged?: boolean;
    clearBranding?: boolean;
    brandLogoAssetId?: number;
    brandLogoFileDataUrl?: string;
    brandLogoFileMimeType?: string;
    brandLogoFileName?: string;
    brandText?: string;
    customMusicAssetId?: number;
    customMusicFileDataUrl?: string;
    customMusicFileName?: string;
    customVideoAssetId?: number;
    customVideoFileDataUrl?: string;
    customVideoFileMimeType?: string;
    customVideoFileName?: string;
    editedFromProjectAdId?: number;
    isRegeneration?: boolean;
    language?: string;
    musicType?: string;
    projectId?: number;
    segmentEditor?: unknown;
    subtitleEnabled?: boolean;
    subtitleColorId?: string;
    subtitleStyleId?: string;
    versionRootProjectAdId?: number;
    videoMode?: string;
    videoModeChanged?: boolean;
    voiceEnabled?: boolean;
    voiceId?: string;
  },
): Promise<StudioGenerationJob> {
  assertAdsflowConfigured();

  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const requestedLanguage = normalizeStudioLanguage(options?.language);
  const normalizedLanguage = resolveStudioGenerationLanguage(normalizedPrompt, requestedLanguage);
  const normalizedVideoMode = normalizeStudioVideoMode(options?.videoMode);
  const isVoiceEnabled = options?.voiceEnabled !== false;
  const normalizedVoiceId = isVoiceEnabled ? normalizeStudioVoiceIdForLanguage(options?.voiceId, normalizedLanguage) : undefined;
  const normalizedMusicType = normalizeStudioMusicType(options?.musicType);
  const isSubtitleEnabled = isVoiceEnabled && options?.subtitleEnabled !== false;
  const normalizedSubtitleStyleId = isSubtitleEnabled ? normalizeStudioSubtitleStyle(options?.subtitleStyleId) : undefined;
  const normalizedSubtitleColorId =
    isSubtitleEnabled && normalizedSubtitleStyleId
      ? normalizeStudioSubtitleColor(
          options?.subtitleColorId,
          getDefaultStudioSubtitleColorForStyle(normalizedSubtitleStyleId),
        )
      : undefined;
  const normalizedBrandLogoFileName = String(options?.brandLogoFileName ?? "").trim() || undefined;
  const normalizedBrandLogoFileMimeType = String(options?.brandLogoFileMimeType ?? "").trim() || undefined;
  const normalizedBrandLogoFileDataUrl = String(options?.brandLogoFileDataUrl ?? "").trim() || undefined;
  const normalizedBrandLogoAssetId = normalizePositiveInteger(options?.brandLogoAssetId) ?? undefined;
  const normalizedBrandText = String(options?.brandText ?? "").trim() || undefined;
  const normalizedCustomMusicFileName = String(options?.customMusicFileName ?? "").trim() || undefined;
  const normalizedCustomMusicFileDataUrl = String(options?.customMusicFileDataUrl ?? "").trim() || undefined;
  const normalizedCustomMusicAssetId = normalizePositiveInteger(options?.customMusicAssetId) ?? undefined;
  const normalizedCustomVideoFileName = String(options?.customVideoFileName ?? "").trim() || undefined;
  const normalizedCustomVideoFileMimeType = String(options?.customVideoFileMimeType ?? "").trim() || undefined;
  const normalizedCustomVideoFileDataUrl = String(options?.customVideoFileDataUrl ?? "").trim() || undefined;
  const normalizedCustomVideoAssetId = normalizePositiveInteger(options?.customVideoAssetId) ?? undefined;
  const normalizedEditedFromProjectAdId = normalizePositiveInteger(options?.editedFromProjectAdId) ?? undefined;
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const normalizedSegmentEditor = normalizeStudioSegmentEditorPayload(
    options?.segmentEditor,
    normalizedLanguage,
    normalizedProjectId ?? undefined,
    { globalVoiceEnabled: isVoiceEnabled },
  );
  const segmentEditorFinalVoiceCredits = normalizedSegmentEditor
    ? normalizedSegmentEditor.segments.map((segment) => {
        if (segment.voiceoverAssetId) {
          return 0;
        }

        if (segment.voiceType === "none") {
          return 0;
        }

        return getStudioVoiceCreditCost(segment.voiceType ?? normalizedVoiceId);
      })
    : [];
  const requiredCredits = normalizedSegmentEditor
    ? STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST +
      Math.max(0, ...segmentEditorFinalVoiceCredits)
    : getStudioGenerationCreditCost(normalizedVideoMode, {
        voiceEnabled: isVoiceEnabled,
        voiceId: normalizedVoiceId,
      });
  if (normalizedMusicType === "custom" && !normalizedCustomMusicAssetId && (!normalizedCustomMusicFileName || !normalizedCustomMusicFileDataUrl)) {
    throw new Error("Загрузите свой музыкальный трек или выберите другой режим музыки.");
  }

  if (normalizedVideoMode === "custom" && !normalizedCustomVideoAssetId && (!normalizedCustomVideoFileName || !normalizedCustomVideoFileDataUrl)) {
    throw new Error("Загрузите своё видео или выберите другой режим видео.");
  }

  if (normalizedSegmentEditor && !options?.isRegeneration) {
    throw new Error("Редактор сегментов можно использовать только при перегенерации.");
  }

  if (normalizedSegmentEditor && !normalizedProjectId) {
    throw new Error("Для перегенерации из редактора сегментов нужен project id.");
  }

  await ensureStudioGenerationWorkersAvailable();

  const creditReservation = await consumeWorkspaceGenerationCredit(user, requiredCredits, normalizedLanguage);
  const externalUserId = await resolveStudioExternalUserId(user);
  const shouldAddWatermark =
    typeof options?.addWatermark === "boolean"
      ? options.addWatermark
      : creditReservation.profile.plan === "FREE" &&
        creditReservation.consumed.subscription > 0 &&
        creditReservation.consumed.purchased <= 0;
  const normalizedVersionRootProjectAdId = normalizePositiveInteger(options?.versionRootProjectAdId) ?? undefined;
  const prefillSettings = normalizeExamplePrefillStudioSettings({
    brandText: normalizedBrandText,
    language: normalizedLanguage,
    musicType: normalizedMusicType,
    subtitleColorId: normalizedSubtitleColorId,
    subtitleEnabled: isSubtitleEnabled,
    subtitleStyleId: normalizedSubtitleStyleId,
    videoMode: normalizedVideoMode,
    voiceEnabled: isVoiceEnabled,
    voiceId: normalizedVoiceId,
  });

  let jobCreated = false;

  try {
    console.info("[studio] adsflow.brand-payload", {
      brandLogoDataUrlLength: normalizedBrandLogoFileDataUrl?.length ?? 0,
      brandLogoFileName: normalizedBrandLogoFileName ?? null,
      brandLogoMimeType: normalizedBrandLogoFileMimeType ?? null,
      brandTextLength: normalizedBrandText?.length ?? 0,
      hasBrandLogo: Boolean(normalizedBrandLogoFileDataUrl),
      hasBrandText: Boolean(normalizedBrandText),
      addWatermark: shouldAddWatermark,
      addWatermarkOverride: options?.addWatermark ?? null,
      brandChangedOverride: options?.brandChanged ?? null,
      clearBrandingOverride: options?.clearBranding ?? null,
      isRegeneration: Boolean(options?.isRegeneration),
      requestedLanguage,
      resolvedLanguage: normalizedLanguage,
      resolvedVoiceId: normalizedVoiceId ?? null,
      projectId: normalizedProjectId ?? null,
      segmentEditorActive: Boolean(normalizedSegmentEditor),
    });

    const brandLogoAssetId = normalizedBrandLogoAssetId ?? (normalizedBrandLogoFileDataUrl && normalizedBrandLogoFileName
      ? await uploadStudioMediaAsset(user, {
          dataUrl: normalizedBrandLogoFileDataUrl,
          externalUserId,
          fileName: normalizedBrandLogoFileName,
          kind: "brand_logo",
          language: normalizedLanguage,
          mediaType: "photo",
          mimeType: normalizedBrandLogoFileMimeType,
          projectId: normalizedProjectId,
          role: "brand_logo",
        })
      : undefined);
    const customMusicAssetId =
      normalizedMusicType === "custom" && normalizedCustomMusicAssetId
        ? normalizedCustomMusicAssetId
        : normalizedMusicType === "custom" && normalizedCustomMusicFileDataUrl && normalizedCustomMusicFileName
        ? await uploadStudioMediaAsset(user, {
            dataUrl: normalizedCustomMusicFileDataUrl,
            externalUserId,
            fileName: normalizedCustomMusicFileName,
            kind: "custom_music",
            language: normalizedLanguage,
            mediaType: "audio",
            projectId: normalizedProjectId,
            role: "music",
          })
        : undefined;
    const customVideoAssetId =
      normalizedVideoMode === "custom" && normalizedCustomVideoAssetId
        ? normalizedCustomVideoAssetId
        : normalizedVideoMode === "custom" && normalizedCustomVideoFileDataUrl && normalizedCustomVideoFileName
        ? await uploadStudioMediaAsset(user, {
            dataUrl: normalizedCustomVideoFileDataUrl,
            externalUserId,
            fileName: normalizedCustomVideoFileName,
            kind: "custom_video",
            language: normalizedLanguage,
            mediaType: inferStudioUploadMediaType(normalizedCustomVideoFileMimeType, normalizedCustomVideoFileName),
            mimeType: normalizedCustomVideoFileMimeType,
            projectId: normalizedProjectId,
            role: "custom_video",
          })
        : undefined;
    const normalizedSegmentEditorAssetPayload = normalizedSegmentEditor
      ? {
          allow_structure_change: Boolean(normalizedSegmentEditor.allowStructureChange),
          segments: await Promise.all(
            normalizedSegmentEditor.segments.map(async (segment) => {
              const uploadScopeProjectId = normalizedSegmentEditor.allowStructureChange ? undefined : normalizedProjectId;
              const uploadScopeSegmentIndex = normalizedSegmentEditor.allowStructureChange ? undefined : segment.index;
              const segmentAssetId =
                segment.videoAction === "custom" && segment.customVideoAssetId
                  ? segment.customVideoAssetId
                  : segment.videoAction === "custom" && segment.customVideoFileDataUrl && segment.customVideoFileName
                  ? await uploadStudioMediaAsset(user, {
                      dataUrl: segment.customVideoFileDataUrl,
                      externalUserId,
                      fileName: segment.customVideoFileName,
                      kind: "segment_source",
                      language: normalizedLanguage,
                      mediaType: inferStudioUploadMediaType(segment.customVideoFileMimeType, segment.customVideoFileName),
                      mimeType: segment.customVideoFileMimeType,
                      projectId: uploadScopeProjectId,
                      role: "segment_source",
                      segmentIndex: uploadScopeSegmentIndex,
                    })
                  : undefined;

              return {
                custom_video_asset_id: segmentAssetId,
                custom_video_mime_type: segment.customVideoFileMimeType,
                custom_video_original_name: segment.customVideoFileName,
                duration: segment.duration,
                duration_extension_source_duration_seconds: segment.durationExtensionSourceDurationSeconds ?? null,
                duration_mode: segment.durationMode,
                end_time: segment.endTime,
                index: segment.index,
                manual_duration_seconds: segment.manualDurationSeconds,
                reset_visual: Boolean(segment.resetVisual),
                scene_sound_asset_id: segment.sceneSoundAssetId,
                start_time: segment.startTime,
                subtitle_color: segment.subtitleColor ?? null,
                subtitle_style: segment.subtitleStyle ?? null,
                subtitle_type: segment.subtitleType ?? null,
                text: segment.text,
                video_action: segment.videoAction,
                voiceover_asset_id: segment.voiceoverAssetId,
                voice_type: segment.voiceType ?? null,
              };
            }),
          ),
        }
      : undefined;

    if (normalizedSegmentEditorAssetPayload) {
      console.info("[studio] adsflow.segment-editor-payload", {
        allowStructureChange: normalizedSegmentEditorAssetPayload.allow_structure_change,
        projectId: normalizedProjectId ?? null,
        segmentCount: normalizedSegmentEditorAssetPayload.segments.length,
        segmentOrder: normalizedSegmentEditorAssetPayload.segments.map((segment) => segment.index),
        segmentTimings: normalizedSegmentEditorAssetPayload.segments.map((segment) => ({
          duration: segment.duration ?? null,
          durationExtensionSourceDurationSeconds: segment.duration_extension_source_duration_seconds ?? null,
          durationMode: segment.duration_mode ?? null,
          endTime: segment.end_time ?? null,
          index: segment.index,
          manualDurationSeconds: segment.manual_duration_seconds ?? null,
          startTime: segment.start_time ?? null,
        })),
      });
    }

    const payload = await fetchAdsflowJson<AdsflowCreateJobResponse>(buildAdsflowUrl("/api/web/generations"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getCurrentAdsflowWebSignalHeaders(),
      },
      body: JSON.stringify(addCurrentAdsflowWebDeviceToBody({
        admin_token: env.adsflowAdminToken,
        external_user_id: externalUserId,
        // Preserve the user's original topic language in AdsFlow.
        // The worker already receives requested/content language separately.
        prompt: normalizedPrompt,
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
        language: normalizedLanguage,
        add_watermark: shouldAddWatermark,
        brand_changed: options?.brandChanged,
        clear_branding: options?.clearBranding,
        credit_cost: requiredCredits,
        brand_logo_asset_id: brandLogoAssetId,
        brand_logo_mime_type: normalizedBrandLogoFileMimeType,
        brand_logo_original_name: normalizedBrandLogoFileName,
        brand_text: normalizedBrandText,
        custom_video_asset_id: normalizedVideoMode === "custom" ? customVideoAssetId : undefined,
        custom_video_mime_type: normalizedVideoMode === "custom" ? normalizedCustomVideoFileMimeType : undefined,
        custom_video_original_name: normalizedVideoMode === "custom" ? normalizedCustomVideoFileName : undefined,
        is_regeneration: Boolean(options?.isRegeneration),
        music_type: normalizedMusicType,
        project_id: normalizedProjectId,
        segment_editor: normalizedSegmentEditorAssetPayload,
        custom_music_asset_id: normalizedMusicType === "custom" ? customMusicAssetId : undefined,
        custom_music_original_name: normalizedMusicType === "custom" ? normalizedCustomMusicFileName : undefined,
        subtitle_type: isSubtitleEnabled ? undefined : "none",
        subtitle_color: normalizedSubtitleColorId,
        subtitle_style: normalizedSubtitleStyleId,
        video_mode: normalizedVideoMode,
        video_mode_changed: Boolean(options?.videoModeChanged),
        voice_type: isVoiceEnabled ? undefined : "none",
        voice_code: normalizedVoiceId,
      })),
    }, {
      // This endpoint is not idempotent: a timeout after upstream accepted the request
      // can create duplicate jobs and double-spend credits on retry.
      retryDelaysMs: [],
      timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
    });

    const jobId = String(payload.job_id ?? "").trim();
    if (!jobId) {
      throw new Error("AdsFlow did not return a job id.");
    }

    const enqueueError = normalizeGenerationText(payload.enqueue_error);
    if (enqueueError) {
      console.warn("[studio] AdsFlow enqueue failed:", {
        enqueueError,
        jobId,
      });
      throw new StudioGenerationUnavailableError();
    }

    jobCreated = true;

    const queuedMetadata = resolveGenerationPresentation({
      description: normalizedPrompt,
      fallbackTitle: normalizedLanguage === "en" ? "Ready video" : "Готовое видео",
      hashtags: null,
      language: normalizedLanguage,
      prompt: normalizedPrompt,
      title: normalizeGenerationText(payload.title) || normalizedPrompt,
    });

    try {
      await saveWorkspaceGenerationHistory(user, {
        editedFromProjectAdId: normalizedEditedFromProjectAdId ?? null,
        description: queuedMetadata.description,
        hashtags: queuedMetadata.hashtags,
        jobId,
        prefillSettings,
        prompt: queuedMetadata.prompt,
        status: String(payload.status ?? "queued"),
        title: queuedMetadata.title,
        versionRootProjectAdId: normalizedVersionRootProjectAdId ?? null,
      });
    } catch (error) {
      console.error("[studio] Failed to persist queued generation", error);
    }

    return {
      jobId,
      profile: creditReservation.profile,
      status: String(payload.status ?? "queued"),
      title: queuedMetadata.title || "Studio generation",
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
    quality?: string;
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
  const normalizedQuality = normalizeStudioSegmentVisualQuality(options?.quality);
  const requiredCredits = getStudioSegmentAiPhotoCreditCost(normalizedQuality);
  const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
    sourceLanguage: normalizedLanguage,
    timeoutMs: OPENROUTER_STUDIO_VISUAL_JOB_TRANSLATION_TIMEOUT_MS,
  });
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
  const creditReservation = await consumeWorkspaceGenerationCredit(user, requiredCredits, normalizedLanguage);
  const externalUserId = await resolveStudioExternalUserId(user);
  let assetReady = false;

  try {
    const payload = await postAdsflowJson<AdsflowSegmentAiPhotoGenerateResponse>("/api/web/segment-ai-photo/generate", {
      admin_token: env.adsflowAdminToken,
      external_user_id: externalUserId,
      ...buildStudioSegmentVisualQualityPayload(normalizedQuality),
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
    if (!(error instanceof WorkspaceCreditLimitError) && normalizedQuality === "standard") {
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

export async function createStudioSegmentImageEditJob(
  prompt: string,
  imageDataUrl: string | undefined,
  user: StudioUser,
  options?: {
    fileName?: string;
    imageAssetId?: number;
    language?: string;
    characterContinuityMode?: string;
    characterIds?: number[];
    preserveCharacters?: boolean;
    projectId?: number;
    referenceAssetIds?: number[];
    sceneReferenceAssetIds?: number[];
    segmentIndex?: number;
  },
): Promise<StudioSegmentAiPhotoJob> {
  assertAdsflowConfigured();

  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const normalizedImageDataUrl = String(imageDataUrl ?? "").trim() || undefined;
  const normalizedImageAssetId = normalizePositiveInteger(options?.imageAssetId);
  if (!normalizedImageAssetId && !normalizedImageDataUrl) {
    throw new Error("Image asset id or image data URL is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
    sourceLanguage: normalizedLanguage,
    timeoutMs: OPENROUTER_STUDIO_VISUAL_JOB_TRANSLATION_TIMEOUT_MS,
  });
  const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const preserveCharacters = Boolean(options?.preserveCharacters);
  const characterReferenceMode = normalizeCharacterContinuityMode(options?.characterContinuityMode, preserveCharacters);
  const characterIds = normalizePositiveIntegerList(options?.characterIds);
  const referenceAssetIds = normalizePositiveIntegerList(options?.referenceAssetIds);
  const sceneReferenceAssetIds = normalizePositiveIntegerList(options?.sceneReferenceAssetIds);
  const normalizedMimeType = normalizedImageDataUrl
    ? (() => {
        const decodedImage = decodeDataUrlBytes(normalizedImageDataUrl);
        if (!decodedImage.bytes.length) {
          throw new Error("Image data URL is empty.");
        }
        return inferStudioGeneratedImageMimeType(decodedImage.mimeType, options?.fileName, null);
      })()
    : inferStudioGeneratedImageMimeType(null, options?.fileName, null);
  const normalizedFileName =
    normalizeStudioGeneratedImageFileName(options?.fileName, normalizedMimeType) ||
    `segment-image-edit-${(normalizedSegmentIndex ?? 0) + 1}${getStudioGeneratedImageExtension(normalizedMimeType)}`;
  const externalUserId = await resolveStudioExternalUserId(user);
  const subscriptionDetails = await fetchAdsflowSubscriptionDetailsForWebMutation(externalUserId, user);
  const imageAssetId = normalizedImageAssetId
    ? normalizedImageAssetId
    : await uploadStudioMediaAsset(user, {
        dataUrl: normalizedImageDataUrl as string,
        externalUserId,
        fileName: normalizedFileName,
        kind: "segment_image",
        language: normalizedLanguage,
        mediaType: "photo",
        mimeType: normalizedMimeType,
        projectId: normalizedProjectId,
        role: "segment_source",
        segmentIndex: normalizedSegmentIndex,
      });
  console.info("[studio] segment-image-edit: sending job request", JSON.stringify({
    imageAssetId,
    imageFileName: normalizedFileName,
    imageMimeType: normalizedMimeType,
    projectId: normalizedProjectId,
    segmentIndex: normalizedSegmentIndex,
    externalUserId,
  }));
  let payload: AdsflowSegmentAiPhotoJobCreateResponse;
  try {
    payload = await postAdsflowJson<AdsflowSegmentAiPhotoJobCreateResponse>("/api/web/segment-image-edit/jobs", {
      admin_token: env.adsflowAdminToken,
      credit_cost: STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST,
      external_user_id: externalUserId,
      image_asset_id: imageAssetId,
      image_mime_type: normalizedMimeType,
      image_original_name: normalizedFileName,
      language: normalizedLanguage,
      character_ids: characterIds,
      character_prompt: normalizedPrompt,
      preserve_characters: preserveCharacters,
      character_reference_mode: characterReferenceMode,
      project_id: normalizedProjectId,
      prompt: upstreamPrompt,
      reference_asset_ids: referenceAssetIds,
      scene_reference_asset_ids: sceneReferenceAssetIds,
      segment_index: normalizedSegmentIndex,
      user_email: user.email ?? undefined,
      user_name: user.name ?? undefined,
    }, {
      retryDelaysMs: [],
      timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
    });
    console.info("[studio] segment-image-edit: job created successfully", JSON.stringify({ jobId: payload.job_id, status: payload.status }));
  } catch (err) {
    console.error("[studio] segment-image-edit: postAdsflowJson failed", err);
    throw err;
  }

  const jobId = String(payload.job_id ?? "").trim();
  if (!jobId) {
    throw new Error("AdsFlow did not return a segment image edit job id.");
  }

  return {
    jobId,
    profile: await enrichWorkspaceProfileAfterAdsflowWebMutation(
      payload.user ?? undefined,
      payload.user?.user_id ? String(payload.user.user_id) : undefined,
      subscriptionDetails,
    ),
    status: String(payload.status ?? "queued"),
  };
}

export async function createStudioSegmentImageUpscaleJob(
  imageDataUrl: string | undefined,
  user: StudioUser,
  options?: {
    fileName?: string;
    imageAssetId?: number;
    language?: string;
    projectId?: number;
    segmentIndex?: number;
  },
) : Promise<StudioSegmentAiPhotoJob> {
  assertAdsflowConfigured();

  const normalizedImageDataUrl = String(imageDataUrl ?? "").trim() || undefined;
  const normalizedImageAssetId = normalizePositiveInteger(options?.imageAssetId);
  if (!normalizedImageAssetId && !normalizedImageDataUrl) {
    throw new Error("Image asset id or image data URL is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const normalizedMimeType = normalizedImageDataUrl
    ? (() => {
        const decodedImage = decodeDataUrlBytes(normalizedImageDataUrl);
        if (!decodedImage.bytes.length) {
          throw new Error("Image data URL is empty.");
        }
        return inferStudioGeneratedImageMimeType(decodedImage.mimeType, options?.fileName, null);
      })()
    : inferStudioGeneratedImageMimeType(null, options?.fileName, null);
  const normalizedFileName = buildStudioUpscaledImageFileName(options?.fileName, normalizedMimeType, {
    segmentIndex: normalizedSegmentIndex,
  });
  const externalUserId = await resolveStudioExternalUserId(user);
  const subscriptionDetails = await fetchAdsflowSubscriptionDetailsForWebMutation(externalUserId, user);
  const imageAssetId = normalizedImageAssetId
    ? normalizedImageAssetId
    : await uploadStudioMediaAsset(user, {
        dataUrl: normalizedImageDataUrl as string,
        externalUserId,
        fileName: normalizedFileName,
        kind: "segment_image",
        language: normalizedLanguage,
        mediaType: "photo",
        mimeType: normalizedMimeType,
        projectId: normalizedProjectId,
        role: "segment_source",
        segmentIndex: normalizedSegmentIndex,
      });
  const payload = await postAdsflowJson<AdsflowSegmentAiPhotoJobCreateResponse>("/api/web/segment-image-upscale/jobs", {
    admin_token: env.adsflowAdminToken,
    credit_cost: STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST,
    external_user_id: externalUserId,
    image_asset_id: imageAssetId,
    image_mime_type: normalizedMimeType,
    image_original_name: normalizedFileName,
    language: normalizedLanguage,
    project_id: normalizedProjectId,
    segment_index: normalizedSegmentIndex,
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  }, {
    retryDelaysMs: [],
    timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
  });

  const jobId = String(payload.job_id ?? "").trim();
  if (!jobId) {
    throw new Error("AdsFlow did not return a segment image upscale job id.");
  }

  return {
    jobId,
    profile: await enrichWorkspaceProfileAfterAdsflowWebMutation(
      payload.user ?? undefined,
      payload.user?.user_id ? String(payload.user.user_id) : undefined,
      subscriptionDetails,
    ),
    status: String(payload.status ?? "queued"),
  };
}

export async function getStudioSegmentImageUpscaleJobStatus(
  jobId: string,
  user: StudioUser,
): Promise<StudioSegmentAiPhotoJobStatus> {
  const payload = await fetchAdsflowSegmentImageUpscaleJobStatus(jobId, user);
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

export async function getStudioSegmentImageEditJobStatus(
  jobId: string,
  user: StudioUser,
): Promise<StudioSegmentAiPhotoJobStatus> {
  const payload = await fetchAdsflowSegmentImageEditJobStatus(jobId, user);
  const status = String(payload.status ?? "queued").trim() || "queued";
  const safeJobId = String(payload.job_id ?? jobId).trim() || String(jobId ?? "").trim();
  const asset = payload.asset
    ? await normalizeAdsflowSegmentAiPhotoAsset(payload.asset, { preferPortableResult: true })
    : undefined;
  const error = normalizeGenerationText(payload.error) || undefined;

  if (error || status === "failed") {
    console.warn("[studio] segment-image-edit job status has error", JSON.stringify({
      jobId: safeJobId,
      status,
      error,
      payloadKeys: Object.keys(payload),
    }));
  }

  return {
    asset,
    error,
    jobId: safeJobId,
    profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
      rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
    }),
    status,
  };
}

export async function improveStudioSegmentAiPhotoPrompt(
  prompt: string,
  options?: {
    language?: string;
    mode?: StudioSegmentPromptImproveMode | string;
  },
): Promise<StudioSegmentAiPhotoPromptImproveResult> {
  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const normalizedLanguage = resolveStudioGenerationLanguage(normalizedPrompt, options?.language);
  const normalizedMode = normalizeStudioSegmentPromptImproveMode(options?.mode);
  const modelCandidates = getStudioOpenRouterPromptEnhancementModelCandidates();
  let lastError: Error | null = null;
  const hasConfiguredOpenRouterKey = Boolean(String(env.openrouterApiKey ?? "").trim());
  const hasOpenRouter = hasUsableOpenRouterApiKey(env.openrouterApiKey);

  if (hasConfiguredOpenRouterKey && !hasOpenRouter) {
    throw createStudioOpenRouterMissingConfigError();
  }

  if (hasOpenRouter && modelCandidates.length > 0) {
    for (const model of modelCandidates) {
      try {
        const improvedPrompt = await requestStudioSegmentPromptEnhancement(
          normalizedPrompt,
          normalizedLanguage,
          normalizedMode,
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

  if (hasOpenRouter) {
    throw lastError ?? new Error("Failed to improve segment AI photo prompt with OpenRouter.");
  }

  const fallbackPrompt = buildStudioSegmentPromptEnhancementFallback(
    normalizedPrompt,
    normalizedLanguage,
    normalizedMode,
  );
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
  const modelCandidates = requireStudioOpenRouterModels();
  let lastError: Error | null = null;

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

  const modelCandidates = requireStudioOpenRouterModels();
  let lastError: Error | null = null;

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

  throw lastError ?? new Error("Text translation is unavailable.");
}

export async function createStudioSegmentAiPhotoJob(
  prompt: string,
  user: StudioUser,
  options?: {
    billingQuality?: string;
    quality?: string;
    language?: string;
    characterContinuityMode?: string;
    characterIds?: number[];
    preserveCharacters?: boolean;
    projectId?: number;
    purpose?: string;
    referenceKind?: string;
    referenceAssetIds?: number[];
    sceneReferenceAssetIds?: number[];
    segmentIndex?: number;
  },
): Promise<StudioSegmentAiPhotoJob> {
  assertAdsflowConfigured();

  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const normalizedQuality = normalizeStudioSegmentVisualQuality(options?.quality);
  const normalizedBillingQuality = normalizeStudioSegmentVisualQuality(options?.billingQuality || normalizedQuality);
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const preserveCharacters = Boolean(options?.preserveCharacters);
  const characterReferenceMode = normalizeCharacterContinuityMode(options?.characterContinuityMode, preserveCharacters);
  const characterIds = normalizePositiveIntegerList(options?.characterIds);
  const referenceAssetIds = normalizePositiveIntegerList(options?.referenceAssetIds);
  const sceneReferenceAssetIds = normalizePositiveIntegerList(options?.sceneReferenceAssetIds);
  const normalizedPurpose = normalizeGenerationText(options?.purpose);
  const normalizedReferenceKind = normalizeGenerationText(options?.referenceKind);
  const normalizedSegmentIndex = normalizeStudioMediaSegmentIndexForScope(options?.segmentIndex, {
    purpose: normalizedPurpose,
  });
  const externalUserId = await resolveStudioExternalUserId(user);
  const isWorkspaceCharacterReference =
    normalizedPurpose === "workspace_reference" &&
    normalizedReferenceKind === "character";
  const requiredCredits = isWorkspaceCharacterReference
    ? STUDIO_WORKSPACE_CHARACTER_REFERENCE_CREDIT_COST
    : getStudioSegmentAiPhotoCreditCost(normalizedBillingQuality);
  const workspaceCharacterReferencePrompt = isWorkspaceCharacterReference
    ? buildWorkspaceReferenceCharacterSheetPrompt(normalizedPrompt, {
        sourceMode: referenceAssetIds.length > 0 ? "reference_image" : "text",
      })
    : normalizedPrompt;
  if (
    isWorkspaceCharacterReference &&
    referenceAssetIds.length > 0
  ) {
    const sourceImage = await fetchStudioMediaAssetImage(referenceAssetIds[0], externalUserId);
    const creditReservation = await consumeWorkspaceGenerationCredit(user, requiredCredits, normalizedLanguage);
    let jobCreated = false;

    try {
      const prediction = await createWaveSpeedGptImage2EditJob({
        aspectRatio: "1:1",
        image: sourceImage.bytes,
        imageFileName: sourceImage.fileName,
        imageMimeType: sourceImage.mimeType,
        outputFormat: "png",
        prompt: workspaceCharacterReferencePrompt,
        quality: WORKSPACE_CHARACTER_REFERENCE_GPT_IMAGE_2_QUALITY,
        resolution: WORKSPACE_CHARACTER_REFERENCE_GPT_IMAGE_2_RESOLUTION,
      });
      const jobId = `${WAVESPEED_SEGMENT_AI_PHOTO_JOB_PREFIX}${prediction.id}`;
      const profile = { ...creditReservation.profile };
      studioWaveSpeedSegmentAiPhotoJobContexts.set(jobId, {
        consumed: creditReservation.consumed,
        language: normalizedLanguage,
        ownerExternalUserId: externalUserId,
        profile,
        projectId: normalizedProjectId,
        referenceKind: normalizedReferenceKind,
        segmentIndex: normalizedSegmentIndex,
        upscaleRequired: false,
      });
      jobCreated = true;

      console.info(
        JSON.stringify({
          event: "server.segment-ai-photo.wavespeed-edit.created",
          jobId,
          model: WAVESPEED_GPT_IMAGE_2_EDIT_MODEL,
          projectId: normalizedProjectId,
          quality: WORKSPACE_CHARACTER_REFERENCE_GPT_IMAGE_2_QUALITY,
          referenceAssetId: referenceAssetIds[0],
          resolution: WORKSPACE_CHARACTER_REFERENCE_GPT_IMAGE_2_RESOLUTION,
          segmentIndex: normalizedSegmentIndex,
        }),
      );

      return {
        jobId,
        profile,
        status: prediction.status || "created",
      };
    } catch (error) {
      if (!jobCreated) {
        try {
          await refundWorkspaceGenerationCredit(user, creditReservation.consumed, normalizedLanguage);
        } catch (refundError) {
          console.error("[studio] Failed to refund WaveSpeed GPT Image 2 edit credits", refundError);
        }
      }

      throw error;
    }
  }

  if (
    normalizedPurpose === "workspace_reference" &&
    referenceAssetIds.length === 0 &&
    sceneReferenceAssetIds.length === 0
  ) {
    const creditReservation = await consumeWorkspaceGenerationCredit(user, requiredCredits, normalizedLanguage);
    let jobCreated = false;

    try {
      const prediction = await createWaveSpeedGptImage2TextToImageJob({
        aspectRatio: "1:1",
        outputFormat: "png",
        prompt: isWorkspaceCharacterReference ? workspaceCharacterReferencePrompt : normalizedPrompt,
        quality: isWorkspaceCharacterReference ? WORKSPACE_CHARACTER_REFERENCE_GPT_IMAGE_2_QUALITY : "low",
        resolution: isWorkspaceCharacterReference ? WORKSPACE_CHARACTER_REFERENCE_GPT_IMAGE_2_RESOLUTION : "1k",
      });
      const jobId = `${WAVESPEED_SEGMENT_AI_PHOTO_JOB_PREFIX}${prediction.id}`;
      const profile = { ...creditReservation.profile };
      studioWaveSpeedSegmentAiPhotoJobContexts.set(jobId, {
        consumed: creditReservation.consumed,
        language: normalizedLanguage,
        ownerExternalUserId: externalUserId,
        profile,
        projectId: normalizedProjectId,
        referenceKind: normalizedReferenceKind,
        segmentIndex: normalizedSegmentIndex,
        upscaleRequired: false,
      });
      jobCreated = true;

      console.info(
        JSON.stringify({
          event: "server.segment-ai-photo.wavespeed-text-to-image.created",
          jobId,
          model: WAVESPEED_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL,
          projectId: normalizedProjectId,
          quality: isWorkspaceCharacterReference ? WORKSPACE_CHARACTER_REFERENCE_GPT_IMAGE_2_QUALITY : "low",
          referenceKind: normalizedReferenceKind,
          resolution: isWorkspaceCharacterReference ? WORKSPACE_CHARACTER_REFERENCE_GPT_IMAGE_2_RESOLUTION : "1k",
          segmentIndex: normalizedSegmentIndex,
        }),
      );

      return {
        jobId,
        profile,
        status: prediction.status || "created",
      };
    } catch (error) {
      if (!jobCreated) {
        try {
          await refundWorkspaceGenerationCredit(user, creditReservation.consumed, normalizedLanguage);
        } catch (refundError) {
          console.error("[studio] Failed to refund WaveSpeed GPT Image 2 credits", refundError);
        }
      }

      throw error;
    }
  }

  console.info(
    JSON.stringify({
      characterIds,
      event: "server.segment-ai-photo.prepare",
      language: normalizedLanguage,
      preserveCharacters,
      billingQuality: normalizedBillingQuality,
      promptLength: normalizedPrompt.length,
      projectId: normalizedProjectId,
      quality: normalizedQuality,
      referenceAssetIds,
      sceneReferenceAssetIds,
      segmentIndex: normalizedSegmentIndex,
    }),
  );

  const translationStartedAt = Date.now();
  const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
    sourceLanguage: normalizedLanguage,
    timeoutMs: OPENROUTER_STUDIO_VISUAL_JOB_TRANSLATION_TIMEOUT_MS,
  });
  console.info(
    JSON.stringify({
      elapsedMs: Date.now() - translationStartedAt,
      event: "server.segment-ai-photo.translation",
      promptLength: normalizedPrompt.length,
      translated: upstreamPrompt !== normalizedPrompt,
    }),
  );
  const subscriptionDetails = await fetchAdsflowSubscriptionDetailsForWebMutation(externalUserId, user);
  console.info(
    JSON.stringify({
      characterIds,
      event: "server.segment-ai-photo.upstream.request",
      projectId: normalizedProjectId,
      referenceAssetIds,
      sceneReferenceAssetIds,
      segmentIndex: normalizedSegmentIndex,
    }),
  );
  const payload = await postAdsflowJson<AdsflowSegmentAiPhotoJobCreateResponse>("/api/web/segment-ai-photo/jobs", {
    admin_token: env.adsflowAdminToken,
    credit_cost: requiredCredits,
    external_user_id: externalUserId,
    ...buildStudioSegmentVisualQualityPayload(normalizedQuality),
    character_ids: characterIds,
    character_reference_mode: characterReferenceMode,
    character_prompt: normalizedPrompt,
    language: normalizedLanguage,
    preserve_characters: preserveCharacters,
    project_id: normalizedProjectId,
    prompt: upstreamPrompt,
    generation_purpose: normalizedPurpose || undefined,
    library_kind:
      normalizedPurpose === "workspace_reference" && normalizedReferenceKind
        ? `${normalizedReferenceKind}_reference`
        : undefined,
    reference_asset_ids: referenceAssetIds,
    scene_reference_asset_ids: sceneReferenceAssetIds,
    segment_index: normalizedSegmentIndex,
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  });

  const jobId = String(payload.job_id ?? "").trim();
  if (!jobId) {
    throw new Error("AdsFlow did not return a segment AI photo job id.");
  }

  console.info(
    JSON.stringify({
      event: "server.segment-ai-photo.upstream.response",
      jobId,
      status: String(payload.status ?? "queued"),
    }),
  );

  return {
    jobId,
    profile: await enrichWorkspaceProfileAfterAdsflowWebMutation(
      payload.user ?? undefined,
      payload.user?.user_id ? String(payload.user.user_id) : undefined,
      subscriptionDetails,
    ),
    status: String(payload.status ?? "queued"),
  };
}

export async function createStudioSegmentAiVideoJob(
  prompt: string,
  user: StudioUser,
  options?: {
    billingQuality?: string;
    durationSeconds?: number;
    imageAssetId?: number;
    imageDataUrl?: string;
    imageFileName?: string;
    imageMimeType?: string;
    quality?: string;
    language?: string;
    characterContinuityMode?: string;
    characterIds?: number[];
    preserveCharacters?: boolean;
    projectId?: number;
    referenceAssetIds?: number[];
    sceneReferenceAssetIds?: number[];
    segmentIndex?: number;
  },
): Promise<StudioSegmentAiVideoJob> {
  assertAdsflowConfigured();

  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const normalizedQuality = normalizeStudioSegmentVisualQuality(options?.quality);
  const normalizedBillingQuality = normalizeStudioSegmentVisualQuality(options?.billingQuality || normalizedQuality);
  const normalizedDurationSeconds = normalizeStudioSegmentVisualDurationSeconds(options?.durationSeconds);
  const requiredCredits = getStudioSegmentAiVideoCreditCost(normalizedBillingQuality);
  const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
    sourceLanguage: normalizedLanguage,
    timeoutMs: OPENROUTER_STUDIO_VISUAL_JOB_TRANSLATION_TIMEOUT_MS,
  });
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
  const preserveCharacters = Boolean(options?.preserveCharacters);
  const characterReferenceMode = normalizeCharacterContinuityMode(options?.characterContinuityMode, preserveCharacters);
  const characterIds = normalizePositiveIntegerList(options?.characterIds);
  const referenceAssetIds = normalizePositiveIntegerList(options?.referenceAssetIds);
  const sceneReferenceAssetIds = normalizePositiveIntegerList(options?.sceneReferenceAssetIds);
  const externalUserId = await resolveStudioExternalUserId(user);
  const subscriptionDetails = await fetchAdsflowSubscriptionDetailsForWebMutation(externalUserId, user);
  const payload = await postAdsflowJson<AdsflowSegmentAiVideoJobCreateResponse>("/api/web/segment-ai-video/jobs", {
    admin_token: env.adsflowAdminToken,
    credit_cost: requiredCredits,
    external_user_id: externalUserId,
    ...buildStudioSegmentVisualDurationPayload(normalizedDurationSeconds),
    ...buildStudioSegmentVisualQualityPayload(normalizedQuality),
    character_ids: characterIds,
    character_reference_mode: characterReferenceMode,
    character_prompt: normalizedPrompt,
    language: normalizedLanguage,
    preserve_characters: preserveCharacters,
    project_id: normalizedProjectId,
    prompt: upstreamPrompt,
    reference_asset_ids: referenceAssetIds,
    scene_reference_asset_ids: sceneReferenceAssetIds,
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
    profile: await enrichWorkspaceProfileAfterAdsflowWebMutation(
      payload.user ?? undefined,
      payload.user?.user_id ? String(payload.user.user_id) : undefined,
      subscriptionDetails,
    ),
    status: String(payload.status ?? "queued"),
  };
}

export async function createStudioSegmentPhotoAnimationJob(
  prompt: string,
  user: StudioUser,
  options?: {
    customVideoAssetId?: number;
    customVideoFileDataUrl?: string;
    customVideoFileMimeType?: string;
    customVideoFileName?: string;
    durationExtensionBaseDurationSeconds?: number;
    durationExtensionMode?: string;
    durationExtensionTailDurationSeconds?: number;
    durationExtensionTargetDurationSeconds?: number;
    durationSeconds?: number;
    language?: string;
    projectId?: number;
    quality?: string;
    segmentIndex?: number;
  },
): Promise<StudioSegmentAiVideoJob> {
  assertAdsflowConfigured();

  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const normalizedQuality = normalizeStudioSegmentVisualQuality(options?.quality);
  const normalizedDurationSeconds = normalizeStudioSegmentVisualDurationSeconds(options?.durationSeconds);
  const normalizedPhotoAnimationDurationSeconds = normalizeStudioSegmentPhotoAnimationDurationSeconds(
    normalizedQuality,
    normalizedDurationSeconds,
  );
  const requiredCredits = getStudioSegmentPhotoAnimationRequiredCredits(
    normalizedQuality,
    normalizedPhotoAnimationDurationSeconds,
  );
  const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
    sourceLanguage: normalizedLanguage,
    timeoutMs: OPENROUTER_STUDIO_VISUAL_JOB_TRANSLATION_TIMEOUT_MS,
  });
  const normalizedCustomVideoAssetId = normalizePositiveInteger(options?.customVideoAssetId);
  const normalizedCustomVideoFileDataUrl = String(options?.customVideoFileDataUrl ?? "").trim() || undefined;
  const normalizedCustomVideoFileMimeType = String(options?.customVideoFileMimeType ?? "").trim() || undefined;
  const normalizedCustomVideoFileName = String(options?.customVideoFileName ?? "").trim() || undefined;
  if (!normalizedCustomVideoAssetId && !normalizedCustomVideoFileDataUrl) {
    throw new Error("Photo source asset id or image data URL is required.");
  }
  if (normalizedQuality === "premium" && !normalizedCustomVideoFileDataUrl) {
    throw new Error("Для премиум ИИ анимации нужно выбрать исходное фото.");
  }
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
  const externalUserId = await resolveStudioExternalUserId(user);
  const subscriptionDetails = await fetchAdsflowSubscriptionDetailsForWebMutation(externalUserId, user);
  const customVideoAssetId =
    normalizedCustomVideoAssetId
      ? normalizedCustomVideoAssetId
      : normalizedCustomVideoFileDataUrl && normalizedCustomVideoFileName
      ? await uploadStudioMediaAsset(user, {
          dataUrl: normalizedCustomVideoFileDataUrl,
          externalUserId,
          fileName: normalizedCustomVideoFileName,
          kind: "segment_source",
          language: normalizedLanguage,
          mediaType: inferStudioUploadMediaType(normalizedCustomVideoFileMimeType, normalizedCustomVideoFileName),
          mimeType: normalizedCustomVideoFileMimeType,
          projectId: normalizedProjectId,
          role: "segment_source",
          segmentIndex: normalizedSegmentIndex,
        })
      : undefined;
  const payload = await postAdsflowJson<AdsflowSegmentAiVideoJobCreateResponse>("/api/web/segment-photo-animation/jobs", {
    admin_token: env.adsflowAdminToken,
    credit_cost: requiredCredits,
    custom_video_asset_id: customVideoAssetId,
    custom_video_data_url: customVideoAssetId ? undefined : normalizedCustomVideoFileDataUrl,
    custom_video_mime_type: normalizedCustomVideoFileMimeType,
    custom_video_original_name: normalizedCustomVideoFileName,
    external_user_id: externalUserId,
    ...buildStudioSegmentVisualDurationExtensionPayload({
      baseDurationSeconds: options?.durationExtensionBaseDurationSeconds,
      mode: options?.durationExtensionMode,
      tailDurationSeconds: options?.durationExtensionTailDurationSeconds,
      targetDurationSeconds: options?.durationExtensionTargetDurationSeconds,
    }),
    ...buildStudioSegmentVisualDurationPayload(normalizedPhotoAnimationDurationSeconds),
    ...buildStudioSegmentVisualQualityPayload(normalizedQuality),
    language: normalizedLanguage,
    project_id: normalizedProjectId,
    prompt: upstreamPrompt,
    segment_index: normalizedSegmentIndex,
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
  }, {
    // This endpoint is not idempotent: a timeout after upstream accepted the request
    // can create duplicate jobs and double-spend credits on retry.
    retryDelaysMs: [],
    timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
  });

  const jobId = String(payload.job_id ?? "").trim();
  if (!jobId) {
    throw new Error("AdsFlow did not return a segment photo animation job id.");
  }

  return {
    jobId,
    profile: await enrichWorkspaceProfileAfterAdsflowWebMutation(
      payload.user ?? undefined,
      payload.user?.user_id ? String(payload.user.user_id) : undefined,
      subscriptionDetails,
    ),
    status: String(payload.status ?? "queued"),
  };
}

export async function previewStudioSegmentTalkingPhotoSpeaker(
  user: StudioUser,
  options?: {
    customVideoAssetId?: number;
    customVideoFileDataUrl?: string;
    customVideoMediaType?: "photo" | "video";
    customVideoFileMimeType?: string;
    customVideoFileName?: string;
    language?: string;
    projectId?: number;
    segmentIndex?: number;
    speakerTarget?: StudioTalkingCharacterTarget;
  },
): Promise<StudioSegmentTalkingPhotoSpeakerPreview> {
  assertAdsflowConfigured();

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const normalizedCustomVideoAssetId = normalizePositiveInteger(options?.customVideoAssetId);
  const normalizedCustomVideoFileDataUrl = String(options?.customVideoFileDataUrl ?? "").trim() || undefined;
  const normalizedCustomVideoMediaType = options?.customVideoMediaType === "video" ? "video" : options?.customVideoMediaType === "photo" ? "photo" : undefined;
  const normalizedCustomVideoFileMimeType = String(options?.customVideoFileMimeType ?? "").trim() || undefined;
  const normalizedCustomVideoFileName = String(options?.customVideoFileName ?? "").trim() || undefined;
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
  const normalizedSpeakerTarget = normalizeStudioTalkingCharacterTarget(options?.speakerTarget);

  if (!normalizedSpeakerTarget) {
    throw new Error("Speaker target is required.");
  }
  if (!normalizedCustomVideoAssetId && !normalizedCustomVideoFileDataUrl) {
    throw new Error("Photo or video source asset id or data URL is required.");
  }

  const externalUserId = await resolveStudioExternalUserId(user);
  const customVideoAssetId =
    normalizedCustomVideoAssetId
      ? normalizedCustomVideoAssetId
      : normalizedCustomVideoFileDataUrl && normalizedCustomVideoFileName
      ? await uploadStudioMediaAsset(user, {
          dataUrl: normalizedCustomVideoFileDataUrl,
          externalUserId,
          fileName: normalizedCustomVideoFileName,
          kind: "segment_source",
          language: normalizedLanguage,
          mediaType: normalizedCustomVideoMediaType ?? inferStudioUploadMediaType(normalizedCustomVideoFileMimeType, normalizedCustomVideoFileName),
          mimeType: normalizedCustomVideoFileMimeType,
          projectId: normalizedProjectId,
          role: "segment_source",
          segmentIndex: normalizedSegmentIndex,
        })
      : undefined;

  const payload = await postAdsflowJson<AdsflowSegmentTalkingPhotoPreviewResponse>("/api/web/segment-talking-photo/preview", {
    admin_token: env.adsflowAdminToken,
    custom_video_asset_id: customVideoAssetId,
    custom_video_data_url: customVideoAssetId ? undefined : normalizedCustomVideoFileDataUrl,
    custom_video_media_type: normalizedCustomVideoMediaType,
    custom_video_mime_type: normalizedCustomVideoFileMimeType,
    custom_video_original_name: normalizedCustomVideoFileName,
    external_user_id: externalUserId,
    language: normalizedLanguage,
    project_id: normalizedProjectId,
    segment_index: normalizedSegmentIndex,
    speaker_target: normalizedSpeakerTarget,
    user_email: user.email ?? undefined,
    user_email_verified: user.emailVerified ?? undefined,
    user_name: user.name ?? undefined,
  }, {
    retryDelaysMs: [],
    timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
  });

  return normalizeAdsflowSegmentTalkingPhotoPreview(payload, normalizedSpeakerTarget);
}

export async function createStudioSegmentTalkingPhotoJob(
  script: string,
  user: StudioUser,
  options?: {
    customVideoAssetId?: number;
    customVideoFileDataUrl?: string;
    customVideoMediaType?: "photo" | "video";
    customVideoFileMimeType?: string;
    customVideoFileName?: string;
    durationSeconds?: number;
    language?: string;
    projectId?: number;
    prompt?: string;
    segmentIndex?: number;
    speakerConfirmationToken?: string;
    speakerTarget?: StudioTalkingCharacterTarget;
    voiceType?: string | null;
  },
): Promise<StudioSegmentAiVideoJob> {
  assertAdsflowConfigured();

  const normalizedScript = normalizeGenerationText(script);
  if (!normalizedScript) {
    throw new Error("Script is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const normalizedPrompt =
    normalizePrompt(String(options?.prompt ?? "")) || "natural talking avatar, stable camera, realistic lip sync";
  const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
    sourceLanguage: normalizedLanguage,
    timeoutMs: OPENROUTER_STUDIO_VISUAL_JOB_TRANSLATION_TIMEOUT_MS,
  });
  const normalizedCustomVideoAssetId = normalizePositiveInteger(options?.customVideoAssetId);
  const normalizedCustomVideoFileDataUrl = String(options?.customVideoFileDataUrl ?? "").trim() || undefined;
  const normalizedCustomVideoMediaType = options?.customVideoMediaType === "video" ? "video" : options?.customVideoMediaType === "photo" ? "photo" : undefined;
  const normalizedCustomVideoFileMimeType = String(options?.customVideoFileMimeType ?? "").trim() || undefined;
  const normalizedCustomVideoFileName = String(options?.customVideoFileName ?? "").trim() || undefined;
  const normalizedDurationSeconds = normalizeStudioSegmentVisualDurationSeconds(options?.durationSeconds);
  if (!normalizedCustomVideoAssetId && !normalizedCustomVideoFileDataUrl) {
    throw new Error("Photo or video source asset id or data URL is required.");
  }

  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
  const normalizedSpeakerTarget = normalizeStudioTalkingCharacterTarget(options?.speakerTarget);
  if (!normalizedSpeakerTarget) {
    throw new Error("Speaker target is required.");
  }
  const normalizedVoiceType = normalizeGenerationText(options?.voiceType) || undefined;
  const normalizedSpeakerConfirmationToken = normalizeGenerationText(options?.speakerConfirmationToken) || undefined;
  const externalUserId = await resolveStudioExternalUserId(user);
  const subscriptionDetails = await fetchAdsflowSubscriptionDetailsForWebMutation(externalUserId, user);
  const customVideoAssetId =
    normalizedCustomVideoAssetId
      ? normalizedCustomVideoAssetId
      : normalizedCustomVideoFileDataUrl && normalizedCustomVideoFileName
      ? await uploadStudioMediaAsset(user, {
          dataUrl: normalizedCustomVideoFileDataUrl,
          externalUserId,
          fileName: normalizedCustomVideoFileName,
          kind: "segment_source",
          language: normalizedLanguage,
          mediaType: normalizedCustomVideoMediaType ?? inferStudioUploadMediaType(normalizedCustomVideoFileMimeType, normalizedCustomVideoFileName),
          mimeType: normalizedCustomVideoFileMimeType,
          projectId: normalizedProjectId,
          role: "segment_source",
          segmentIndex: normalizedSegmentIndex,
        })
      : undefined;
  const speakerPreview = normalizedSpeakerConfirmationToken
    ? null
    : await previewStudioSegmentTalkingPhotoSpeaker(user, {
        customVideoAssetId,
        customVideoFileDataUrl: customVideoAssetId ? undefined : normalizedCustomVideoFileDataUrl,
        customVideoFileMimeType: normalizedCustomVideoFileMimeType,
        customVideoFileName: normalizedCustomVideoFileName,
        customVideoMediaType: normalizedCustomVideoMediaType,
        language: normalizedLanguage,
        projectId: normalizedProjectId ?? undefined,
        segmentIndex: normalizedSegmentIndex ?? undefined,
        speakerTarget: normalizedSpeakerTarget,
      });
  const confirmedSourceAssetId = speakerPreview?.sourceAssetId ?? customVideoAssetId;
  const confirmedSourceMediaType = speakerPreview?.sourceMediaType ?? normalizedCustomVideoMediaType ?? "photo";
  const confirmedSpeakerTarget = speakerPreview?.speakerTarget ?? normalizedSpeakerTarget;
  const speakerConfirmationToken = speakerPreview?.confirmationToken ?? normalizedSpeakerConfirmationToken;

  if (!confirmedSourceAssetId) {
    throw new Error("Talking character source must be persisted before generation.");
  }
  if (!speakerConfirmationToken) {
    throw new Error("Speaker confirmation token is required.");
  }

  const payload = await postAdsflowJson<AdsflowSegmentAiVideoJobCreateResponse>("/api/web/segment-talking-photo/jobs", {
    admin_token: env.adsflowAdminToken,
    credit_cost: STUDIO_SEGMENT_TALKING_PHOTO_CREDIT_COST,
    custom_video_asset_id: confirmedSourceAssetId,
    custom_video_data_url: undefined,
    custom_video_media_type: confirmedSourceMediaType,
    custom_video_mime_type: normalizedCustomVideoFileMimeType,
    custom_video_original_name: normalizedCustomVideoFileName,
    external_user_id: externalUserId,
    ...buildStudioSegmentVisualDurationPayload(normalizedDurationSeconds),
    language: normalizedLanguage,
    project_id: normalizedProjectId,
    prompt: upstreamPrompt,
    resolution: confirmedSourceMediaType === "video" ? "480p" : "720p",
    script: normalizedScript,
    seed: -1,
    segment_index: normalizedSegmentIndex,
    speaker_confirmation_token: speakerConfirmationToken,
    speaker_target: confirmedSpeakerTarget,
    user_email: user.email ?? undefined,
    user_email_verified: user.emailVerified ?? undefined,
    user_name: user.name ?? undefined,
    voice_type: normalizedVoiceType,
  }, {
    retryDelaysMs: [],
    timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
  });

  const jobId = String(payload.job_id ?? "").trim();
  if (!jobId) {
    throw new Error("AdsFlow did not return a segment talking character job id.");
  }

  return {
    jobId,
    profile: await enrichWorkspaceProfileAfterAdsflowWebMutation(
      payload.user ?? undefined,
      payload.user?.user_id ? String(payload.user.user_id) : undefined,
      subscriptionDetails,
    ),
    status: String(payload.status ?? "queued"),
  };
}

export async function createStudioSegmentSceneSoundJob(
  prompt: string,
  user: StudioUser,
  options?: {
    durationSeconds?: number;
    language?: string;
    projectId?: number;
    segmentIndex?: number;
    source?: string;
    visualMediaAssetId?: number;
    visualSourceJobId?: string;
    visualSourceKind?: string;
  },
): Promise<StudioSegmentSceneSoundJob> {
  assertAdsflowConfigured();

  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const upstreamPrompt = await translateStudioGenerationPromptToEnglish(normalizedPrompt, {
    sourceLanguage: normalizedLanguage,
    timeoutMs: OPENROUTER_STUDIO_VISUAL_JOB_TRANSLATION_TIMEOUT_MS,
  });
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
  const normalizedDurationSeconds = normalizeStudioSegmentVisualDurationSeconds(options?.durationSeconds);
  const normalizedSource = String(options?.source ?? "current").trim().toLowerCase() === "original" ? "original" : "current";
  const normalizedVisualMediaAssetId = normalizePositiveInteger(options?.visualMediaAssetId);
  const normalizedVisualSourceJobId = normalizeGenerationText(options?.visualSourceJobId);
  const normalizedVisualSourceKind = normalizeGenerationText(options?.visualSourceKind).toLowerCase();
  const visualSourceKind =
    normalizedVisualSourceKind === "segment-ai-video" ||
    normalizedVisualSourceKind === "segment-photo-animation" ||
    normalizedVisualSourceKind === "segment-talking-photo"
      ? normalizedVisualSourceKind
      : undefined;

  if (!normalizedProjectId) {
    throw new Error("Project id is required for scene sound generation.");
  }

  const externalUserId = await resolveStudioExternalUserId(user);
  const subscriptionDetails = await fetchAdsflowSubscriptionDetailsForWebMutation(externalUserId, user);

  const payload = await postAdsflowJson<AdsflowSegmentAiVideoJobCreateResponse>("/api/web/segment-scene-sound/jobs", {
    admin_token: env.adsflowAdminToken,
    credit_cost: STUDIO_SEGMENT_SCENE_SOUND_CREDIT_COST,
    external_user_id: externalUserId,
    language: normalizedLanguage,
    ...buildStudioSegmentVisualDurationPayload(normalizedDurationSeconds),
    project_id: normalizedProjectId,
    prompt: upstreamPrompt,
    segment_index: normalizedSegmentIndex,
    source: normalizedSource,
    user_email: user.email ?? undefined,
    user_name: user.name ?? undefined,
    visual_media_asset_id: normalizedVisualMediaAssetId,
    visual_source_job_id: normalizedVisualSourceJobId || undefined,
    visual_source_kind: visualSourceKind,
  }, {
    retryDelaysMs: [],
    timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
  });

  const jobId = String(payload.job_id ?? "").trim();
  if (!jobId) {
    throw new Error("AdsFlow did not return a segment scene sound job id.");
  }

  return {
    jobId,
    profile: await enrichWorkspaceProfileAfterAdsflowWebMutation(
      payload.user ?? undefined,
      payload.user?.user_id ? String(payload.user.user_id) : undefined,
      subscriptionDetails,
    ),
    status: String(payload.status ?? "queued"),
  };
}

export async function createStudioSegmentVoiceoverJob(
  text: string,
  user: StudioUser,
  options?: {
    language?: string;
    projectId?: number;
    segmentIndex?: number;
    voiceType?: string | null;
  },
): Promise<StudioSegmentVoiceoverJob> {
  assertAdsflowConfigured();

  const normalizedText = normalizeGenerationText(text);
  if (!normalizedText) {
    throw new Error("Voiceover text is required.");
  }

  const normalizedLanguage = normalizeStudioLanguage(options?.language);
  const normalizedProjectId = normalizePositiveInteger(options?.projectId);
  const normalizedSegmentIndex = normalizeNonNegativeInteger(options?.segmentIndex);
  const normalizedVoiceType = normalizeStudioVoiceIdForLanguage(options?.voiceType, normalizedLanguage);
  const requiredCredits = getStudioSegmentVoiceoverCreditCost(normalizedVoiceType);

  if (!normalizedProjectId) {
    throw new Error("Project id is required for segment voiceover generation.");
  }

  if (normalizedSegmentIndex === null) {
    throw new Error("Segment index is required for segment voiceover generation.");
  }

  if (!normalizedVoiceType || normalizedVoiceType === "none") {
    throw new Error("Voice type is required for segment voiceover generation.");
  }

  const externalUserId = await resolveStudioExternalUserId(user);
  const subscriptionDetails = await fetchAdsflowSubscriptionDetailsForWebMutation(externalUserId, user);

  let payload: AdsflowSegmentAiVideoJobCreateResponse;
  try {
    payload = await postAdsflowJson<AdsflowSegmentAiVideoJobCreateResponse>("/api/web/segment-voiceover/jobs", {
      admin_token: env.adsflowAdminToken,
      credit_cost: requiredCredits,
      external_user_id: externalUserId,
      language: normalizedLanguage,
      project_id: normalizedProjectId,
      segment_index: normalizedSegmentIndex,
      text: normalizedText,
      user_email: user.email ?? undefined,
      user_name: user.name ?? undefined,
      voice_type: normalizedVoiceType,
    }, {
      retryDelaysMs: [],
      timeoutMs: ADSFLOW_MUTATION_TIMEOUT_MS,
    });
  } catch (error) {
    if (isAdsflowHttpStatusError(error, 404)) {
      throw new Error("AdsFlow segment voiceover endpoint is not deployed. Deploy /api/web/segment-voiceover/jobs before enabling scene voiceover generation.");
    }

    throw error;
  }

  const jobId = String(payload.job_id ?? "").trim();
  if (!jobId) {
    throw new Error("AdsFlow did not return a segment voiceover job id.");
  }

  return {
    jobId,
    profile: await enrichWorkspaceProfileAfterAdsflowWebMutation(
      payload.user ?? undefined,
      payload.user?.user_id ? String(payload.user.user_id) : undefined,
      subscriptionDetails,
    ),
    status: String(payload.status ?? "queued"),
  };
}

export async function getStudioSegmentAiPhotoJobStatus(
  jobId: string,
  user: StudioUser,
): Promise<StudioSegmentAiPhotoJobStatus> {
  const safeJobId = String(jobId ?? "").trim();
  const waveSpeedPredictionId = parseWaveSpeedSegmentAiPhotoPredictionId(safeJobId);

  if (waveSpeedPredictionId) {
    return getWaveSpeedSegmentAiPhotoJobStatus(safeJobId, waveSpeedPredictionId, user);
  }

  const payload = await fetchAdsflowSegmentAiPhotoJobStatus(jobId, user);
  const status = String(payload.status ?? "queued").trim() || "queued";
  const resolvedJobId = String(payload.job_id ?? jobId).trim() || safeJobId;
  const asset = payload.asset ? await normalizeAdsflowSegmentAiPhotoAsset(payload.asset) : undefined;

  return {
    asset,
    error: normalizeGenerationText(payload.error) || undefined,
    jobId: resolvedJobId,
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
  const safeJobId = String(jobId ?? "").trim();
  const waveSpeedPredictionId = parseWaveSpeedSegmentAiVideoPredictionId(safeJobId);

  if (waveSpeedPredictionId) {
    const profile = await getWaveSpeedSegmentAiVideoJobProfile(safeJobId, user);
    const prediction = await getWaveSpeedPredictionStatus(waveSpeedPredictionId);
    const status = prediction.status || "processing";
    const asset = prediction.outputUrl ? normalizeWaveSpeedSegmentAiVideoAsset(safeJobId) : undefined;
    if (asset) {
      warmStudioGeneratedVideoPlayback("segment-ai-video", safeJobId, user);
      warmStudioGeneratedVideoPoster("segment-ai-video", safeJobId, user);
    }

    return {
      asset,
      error: prediction.error || undefined,
      jobId: safeJobId,
      profile,
      status,
    };
  }

  try {
    const payload = await fetchAdsflowSegmentAiVideoJobStatus(jobId, user);
    const status = String(payload.status ?? "queued").trim() || "queued";
    const resolvedJobId = String(payload.job_id ?? jobId).trim() || safeJobId;
    const asset = payload.asset ? normalizeAdsflowSegmentAiVideoAsset(resolvedJobId, payload.asset) : undefined;
    if (asset) {
      warmStudioGeneratedVideoPlayback("segment-ai-video", resolvedJobId, user);
      warmStudioGeneratedVideoPoster("segment-ai-video", resolvedJobId, user);
    }

    return {
      asset,
      error: normalizeGenerationText(payload.error) || undefined,
      jobId: resolvedJobId,
      profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
        rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
      }),
      status,
    };
  } catch (error) {
    if (isAdsflowHttpStatusError(error, 500)) {
      console.warn("[studio] Segment AI video status returned 500, probing file endpoint", {
        error: error instanceof Error ? error.message : "Unknown AdsFlow status error.",
        jobId: safeJobId,
      });

      return recoverStudioSegmentGeneratedVideoJobStatus("segment-ai-video", safeJobId, user, {
        fallbackError: "Генерация ИИ видео завершилась с ошибкой в AdsFlow. Попробуйте ещё раз.",
      });
    }

    throw error;
  }
}

export async function getStudioSegmentPhotoAnimationJobStatus(
  jobId: string,
  user: StudioUser,
): Promise<StudioSegmentAiVideoJobStatus> {
  const safeJobId = String(jobId ?? "").trim();
  const waveSpeedPredictionId = parseWaveSpeedSegmentAiVideoPredictionId(safeJobId);

  if (waveSpeedPredictionId) {
    const profile = await getWaveSpeedSegmentAiVideoJobProfile(safeJobId, user);
    const prediction = await getWaveSpeedPredictionStatus(waveSpeedPredictionId);
    const status = prediction.status || "processing";
    const asset = prediction.outputUrl ? normalizeWaveSpeedSegmentPhotoAnimationAsset(safeJobId) : undefined;
    if (asset) {
      warmStudioGeneratedVideoPlayback("segment-photo-animation", safeJobId, user);
      warmStudioGeneratedVideoPoster("segment-photo-animation", safeJobId, user);
    }

    return {
      asset,
      error: prediction.error || undefined,
      jobId: safeJobId,
      profile,
      status,
    };
  }

  try {
    const payload = await fetchAdsflowSegmentPhotoAnimationJobStatus(jobId, user);
    const status = String(payload.status ?? "queued").trim() || "queued";
    const resolvedJobId = String(payload.job_id ?? jobId).trim() || safeJobId;
    const asset = payload.asset ? normalizeAdsflowSegmentPhotoAnimationAsset(resolvedJobId, payload.asset) : undefined;
    if (asset) {
      warmStudioGeneratedVideoPlayback("segment-photo-animation", resolvedJobId, user);
      warmStudioGeneratedVideoPoster("segment-photo-animation", resolvedJobId, user);
    }

    return {
      asset,
      error: normalizeGenerationText(payload.error) || undefined,
      jobId: resolvedJobId,
      profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
        rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
      }),
      status,
    };
  } catch (error) {
    if (isAdsflowHttpStatusError(error, 500)) {
      console.warn("[studio] Segment photo animation status returned 500, probing file endpoint", {
        error: error instanceof Error ? error.message : "Unknown AdsFlow status error.",
        jobId: safeJobId,
      });

      return recoverStudioSegmentGeneratedVideoJobStatus("segment-photo-animation", safeJobId, user, {
        fallbackError: "Анимация фото завершилась с ошибкой в AdsFlow. Попробуйте ещё раз.",
      });
    }

    throw error;
  }
}

export async function getStudioSegmentTalkingPhotoJobStatus(
  jobId: string,
  user: StudioUser,
): Promise<StudioSegmentAiVideoJobStatus> {
  const safeJobId = String(jobId ?? "").trim();
  const waveSpeedPredictionId = parseWaveSpeedSegmentAiVideoPredictionId(safeJobId);

  if (waveSpeedPredictionId) {
    const profile = await getWaveSpeedSegmentAiVideoJobProfile(safeJobId, user);
    const prediction = await getWaveSpeedPredictionStatus(waveSpeedPredictionId);
    const status = prediction.status || "processing";
    const asset = prediction.outputUrl ? normalizeWaveSpeedSegmentTalkingPhotoAsset(safeJobId) : undefined;
    if (asset) {
      warmStudioGeneratedVideoPlayback("segment-talking-photo", safeJobId, user);
      warmStudioGeneratedVideoPoster("segment-talking-photo", safeJobId, user);
    }

    return {
      asset,
      error: prediction.error || undefined,
      jobId: safeJobId,
      profile,
      status,
    };
  }

  try {
    const payload = await fetchAdsflowSegmentTalkingPhotoJobStatus(jobId, user);
    const status = String(payload.status ?? "queued").trim() || "queued";
    const resolvedJobId = String(payload.job_id ?? jobId).trim() || safeJobId;
    const asset = payload.asset ? normalizeAdsflowSegmentTalkingPhotoAsset(resolvedJobId, payload.asset) : undefined;
    if (asset) {
      warmStudioGeneratedVideoPlayback("segment-talking-photo", resolvedJobId, user);
      warmStudioGeneratedVideoPoster("segment-talking-photo", resolvedJobId, user);
    }

    return {
      asset,
      error: normalizeGenerationText(payload.error) || undefined,
      jobId: resolvedJobId,
      profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
        rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
      }),
      status,
    };
  } catch (error) {
    if (isAdsflowHttpStatusError(error, 500)) {
      console.warn("[studio] Segment talking character status returned 500, probing file endpoint", {
        error: error instanceof Error ? error.message : "Unknown AdsFlow status error.",
        jobId: safeJobId,
      });

      return recoverStudioSegmentGeneratedVideoJobStatus("segment-talking-photo", safeJobId, user, {
        fallbackError: "Говорящий персонаж завершился с ошибкой в AdsFlow. Попробуйте ещё раз.",
      });
    }

    throw error;
  }
}

export async function getStudioSegmentSceneSoundJobStatus(
  jobId: string,
  user: StudioUser,
): Promise<StudioSegmentSceneSoundJobStatus> {
  const payload = await fetchAdsflowSegmentSceneSoundJobStatus(jobId, user);
  const status = String(payload.status ?? "queued").trim() || "queued";
  const resolvedJobId = String(payload.job_id ?? jobId).trim() || String(jobId ?? "").trim();
  const asset = payload.asset ? normalizeAdsflowSegmentSceneSoundAsset(resolvedJobId, payload.asset) : undefined;

  return {
    asset,
    error: normalizeGenerationText(payload.error) || undefined,
    jobId: resolvedJobId,
    profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
      rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
    }),
    status,
  };
}

export async function getStudioSegmentVoiceoverJobStatus(
  jobId: string,
  user: StudioUser,
): Promise<StudioSegmentVoiceoverJobStatus> {
  const payload = await fetchAdsflowSegmentVoiceoverJobStatus(jobId, user);
  const status = String(payload.status ?? "queued").trim() || "queued";
  const resolvedJobId = String(payload.job_id ?? jobId).trim() || String(jobId ?? "").trim();
  const asset = payload.asset ? normalizeAdsflowSegmentVoiceoverAsset(resolvedJobId, payload.asset) : undefined;
  const speechStartTime = normalizeNumber(payload.speech_start_time);
  const speechEndTime = normalizeNumber(payload.speech_end_time);
  const speechDuration =
    normalizeNumber(payload.speech_duration) ??
    (speechStartTime !== null && speechEndTime !== null ? Math.max(0, speechEndTime - speechStartTime) : null);

  return {
    asset,
    error: normalizeGenerationText(payload.error) || undefined,
    jobId: resolvedJobId,
    profile: await enrichWorkspaceProfile(payload.user ?? undefined, {
      rawUserId: payload.user?.user_id ? String(payload.user.user_id) : undefined,
    }),
    speechDuration: speechDuration !== null ? Math.max(0, speechDuration) : null,
    speechEndTime:
      speechStartTime !== null && speechEndTime !== null ? Math.max(speechStartTime, speechEndTime) : null,
    speechStartTime: speechStartTime !== null ? Math.max(0, speechStartTime) : null,
    speechWords: normalizeSegmentVoiceoverSpeechWords(payload.speech_words),
    status,
  };
}

export async function getStudioGenerationStatus(jobId: string, user: StudioUser): Promise<StudioGenerationStatus> {
  let payload: AdsflowJobStatusResponse;

  try {
    payload = await fetchAdsflowJobStatus(jobId, user);
  } catch (error) {
    const historyEntry = await getWorkspaceGenerationHistoryEntry(user, jobId).catch(() => null);
    if (historyEntry) {
      const historyStatus = buildStudioGenerationStatusFromHistoryEntry(historyEntry);
      if (historyStatus.generation) {
        warmStudioGenerationPlayback(historyStatus.generation, user);
      }
      console.warn("[studio] Falling back to local generation history status", {
        error: error instanceof Error ? error.message : "Unknown AdsFlow status error.",
        jobId: normalizeGenerationText(jobId),
        status: historyStatus.status,
      });
      return historyStatus;
    }

    throw error;
  }

  const status = String(payload.status ?? "queued");
  const safeJobId = String(payload.job_id ?? jobId).trim();
  const existingHistoryEntry = await getWorkspaceGenerationHistoryEntry(user, safeJobId).catch(() => null);
  const resolvedMetadata = resolveGenerationPresentation({
    description: payload.description ?? existingHistoryEntry?.description ?? "",
    fallbackTitle: existingHistoryEntry?.prefillSettings?.language === "en" ? "Ready video" : "Готовое видео",
    hashtags: payload.hashtags ?? existingHistoryEntry?.hashtags ?? [],
    language: existingHistoryEntry?.prefillSettings?.language,
    prompt: existingHistoryEntry?.prompt ?? payload.prompt ?? "",
    title: payload.title ?? existingHistoryEntry?.title ?? "",
  });

  try {
    await saveWorkspaceGenerationHistory(user, {
      adId: payload.ad_id ?? null,
      description: resolvedMetadata.description,
      downloadPath: payload.download_path ?? null,
      editedFromProjectAdId: existingHistoryEntry?.editedFromProjectAdId ?? null,
      error: payload.error ?? null,
      finalAssetId: payload.media_asset_id ?? existingHistoryEntry?.finalAssetId ?? null,
      finalAssetKind: "final_video",
      finalAssetStatus: status,
      generatedAt: payload.generated_at ?? null,
      hashtags: resolvedMetadata.hashtags,
      jobId: safeJobId,
      prompt: resolvedMetadata.prompt,
      status,
      title: resolvedMetadata.title,
      updatedAt: payload.generated_at ?? new Date().toISOString(),
      versionRootProjectAdId: existingHistoryEntry?.versionRootProjectAdId ?? null,
    });
  } catch (error) {
    console.error("[studio] Failed to sync generation history", error);
  }

  const publicStatus = getStudioGenerationPublicStatus({
    downloadPath: payload.download_path,
    error: payload.error,
    projectStatus: payload.project_status,
    readyReason: payload.ready_reason,
    status,
  });

  if (publicStatus === "done") {
    if (!payload.download_path) {
      throw new Error("AdsFlow finished the job without a video path.");
    }

    const generation = buildStudioGeneration(payload, {
      ...resolvedMetadata,
      historyEntry: existingHistoryEntry,
    });
    if (!generation) {
      console.warn("[studio] Done generation is missing playable preview metadata", {
        adId: payload.ad_id ?? null,
        downloadPath: payload.download_path ?? null,
        jobId: safeJobId,
        status,
      });
      return {
        jobId: safeJobId,
        status: publicStatus,
        error: "Готовое видео недоступно как прямой media-файл.",
        isReadyForEditor: typeof payload.ready === "boolean" ? payload.ready : undefined,
        projectStatus: normalizeGenerationText(payload.project_status) || undefined,
        readyReason: normalizeGenerationText(payload.ready_reason) || undefined,
      };
    }

    warmStudioGenerationPlayback(generation, user);

    return {
      jobId: safeJobId,
      status: publicStatus,
      generation,
      isReadyForEditor: typeof payload.ready === "boolean" ? payload.ready : undefined,
      projectStatus: normalizeGenerationText(payload.project_status) || undefined,
      readyReason: normalizeGenerationText(payload.ready_reason) || undefined,
    };
  }

  return {
    jobId: safeJobId,
    status,
    error: payload.error ?? undefined,
    isReadyForEditor: typeof payload.ready === "boolean" ? payload.ready : undefined,
    projectStatus: normalizeGenerationText(payload.project_status) || undefined,
    readyReason: normalizeGenerationText(payload.ready_reason) || undefined,
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

const getCachedWorkspaceProfileForUser = async (user: StudioUser): Promise<WorkspaceProfile> => {
  const externalUserId = await resolveStudioExternalUserId(user);
  const cacheKey = await resolveStudioAuthScopedCacheKey(user, externalUserId);
  return getCachedWorkspaceBootstrap(cacheKey)?.profile ?? buildWorkspaceProfile();
};

const getWaveSpeedSegmentAiPhotoJobContext = async (
  jobId: string,
  user: StudioUser,
): Promise<WaveSpeedSegmentAiPhotoJobContext | null> => {
  const context = studioWaveSpeedSegmentAiPhotoJobContexts.get(jobId);
  if (!context) {
    return null;
  }

  const externalUserId = await resolveStudioExternalUserId(user);
  if (context.ownerExternalUserId !== externalUserId) {
    throw new Error("WaveSpeed segment AI photo job is not available for this user.");
  }

  return context;
};

const refundWaveSpeedSegmentAiPhotoJobCredits = async (
  jobId: string,
  user: StudioUser,
  context: WaveSpeedSegmentAiPhotoJobContext,
) => {
  if (context.refunded) {
    return { ...context.profile };
  }

  context.refunded = true;
  try {
    context.profile = await refundWorkspaceGenerationCredit(user, context.consumed, context.language);
  } catch (error) {
    console.error("[studio] Failed to refund WaveSpeed GPT Image 2 credits", error);
  }
  studioWaveSpeedSegmentAiPhotoJobContexts.set(jobId, context);
  return { ...context.profile };
};

const uploadWaveSpeedSegmentAiPhotoAsset = async (
  jobId: string,
  outputUrl: string,
  user: StudioUser,
  context: WaveSpeedSegmentAiPhotoJobContext,
): Promise<StudioGeneratedImageAsset> => {
  const downloaded = await fetchRemoteStudioGeneratedImage(new URL(outputUrl));
  if (!downloaded.bytes.length) {
    throw new Error("WaveSpeed GPT Image 2 returned an empty image.");
  }

  const mimeType = inferStudioGeneratedImageMimeType(downloaded.mimeType, null, outputUrl);
  const fileName = normalizeWaveSpeedSegmentAiPhotoFileName(jobId, context.referenceKind);
  const assetId = await uploadStudioMediaAsset(user, {
    dataUrl: buildDataUrlFromBytes(downloaded.bytes, mimeType),
    externalUserId: context.ownerExternalUserId,
    fileName,
    kind: "workspace_reference",
    language: context.language,
    mediaType: "photo",
    mimeType,
    projectId: context.projectId,
    role: context.referenceKind === "scene" ? "scene_reference" : "character_reference",
    segmentIndex: context.segmentIndex,
  });

  return {
    assetId,
    fileName,
    fileSize: downloaded.bytes.length,
    mimeType,
    remoteUrl: `/api/workspace/media-assets/${assetId}`,
  };
};

const getWaveSpeedSegmentAiPhotoJobStatus = async (
  jobId: string,
  predictionId: string,
  user: StudioUser,
): Promise<StudioSegmentAiPhotoJobStatus> => {
  const context = await getWaveSpeedSegmentAiPhotoJobContext(jobId, user);
  const profile = context ? { ...context.profile } : await getCachedWorkspaceProfileForUser(user);

  if (!context) {
    return {
      error: "WaveSpeed segment AI photo job is not available.",
      jobId,
      profile,
      status: "failed",
    };
  }

  if (context.asset) {
    return {
      asset: context.asset,
      jobId,
      profile,
      status: "completed",
    };
  }

  if (context.upscalePredictionId) {
    const upscalePrediction = await getWaveSpeedPredictionStatus(context.upscalePredictionId);
    const upscaleStatus = upscalePrediction.status || "processing";

    if (upscaleStatus === "failed") {
      return {
        error: upscalePrediction.error || "WaveSpeed image upscale failed.",
        jobId,
        profile: await refundWaveSpeedSegmentAiPhotoJobCredits(jobId, user, context),
        status: upscaleStatus,
      };
    }

    if (upscalePrediction.outputUrl) {
      try {
        context.asset = await uploadWaveSpeedSegmentAiPhotoAsset(jobId, upscalePrediction.outputUrl, user, context);
        studioWaveSpeedSegmentAiPhotoJobContexts.set(jobId, context);
        return {
          asset: context.asset,
          jobId,
          profile: { ...context.profile },
          status: "completed",
        };
      } catch (error) {
        const refundedProfile = await refundWaveSpeedSegmentAiPhotoJobCredits(jobId, user, context);
        return {
          error: error instanceof Error ? error.message : "Failed to save upscaled WaveSpeed GPT Image 2 result.",
          jobId,
          profile: refundedProfile,
          status: "failed",
        };
      }
    }

    if (upscaleStatus === "completed") {
      return {
        error: "WaveSpeed image upscale did not return an output image.",
        jobId,
        profile: await refundWaveSpeedSegmentAiPhotoJobCredits(jobId, user, context),
        status: "failed",
      };
    }

    return {
      error: upscalePrediction.error || undefined,
      jobId,
      profile,
      status: upscaleStatus,
    };
  }

  const prediction = await getWaveSpeedPredictionStatus(predictionId);
  const status = prediction.status || "processing";

  if (status === "failed") {
    return {
      error: prediction.error || "WaveSpeed GPT Image 2 generation failed.",
      jobId,
      profile: await refundWaveSpeedSegmentAiPhotoJobCredits(jobId, user, context),
      status,
    };
  }

  if (prediction.outputUrl) {
    if (context.upscaleRequired) {
      try {
        const upscalePrediction = await createWaveSpeedImageUpscaleJob({
          imageUrl: prediction.outputUrl,
          outputFormat: "png",
          targetResolution: "4k",
        });
        context.baseOutputUrl = prediction.outputUrl;
        context.upscalePredictionId = upscalePrediction.id;
        studioWaveSpeedSegmentAiPhotoJobContexts.set(jobId, context);

        console.info(
          JSON.stringify({
            basePredictionId: predictionId,
            event: "server.segment-ai-photo.wavespeed-upscale.created",
            jobId,
            model: "wavespeed-ai/image-upscaler",
            targetResolution: "4k",
            upscalePredictionId: upscalePrediction.id,
          }),
        );

        if (upscalePrediction.outputUrl) {
          context.asset = await uploadWaveSpeedSegmentAiPhotoAsset(jobId, upscalePrediction.outputUrl, user, context);
          studioWaveSpeedSegmentAiPhotoJobContexts.set(jobId, context);
          return {
            asset: context.asset,
            jobId,
            profile: { ...context.profile },
            status: "completed",
          };
        }

        return {
          error: upscalePrediction.error || undefined,
          jobId,
          profile,
          status: upscalePrediction.status || "processing",
        };
      } catch (error) {
        const refundedProfile = await refundWaveSpeedSegmentAiPhotoJobCredits(jobId, user, context);
        return {
          error: error instanceof Error ? error.message : "Failed to upscale WaveSpeed GPT Image 2 result.",
          jobId,
          profile: refundedProfile,
          status: "failed",
        };
      }
    }

    try {
      context.asset = await uploadWaveSpeedSegmentAiPhotoAsset(jobId, prediction.outputUrl, user, context);
      studioWaveSpeedSegmentAiPhotoJobContexts.set(jobId, context);
      return {
        asset: context.asset,
        jobId,
        profile: { ...context.profile },
        status: "completed",
      };
    } catch (error) {
      const refundedProfile = await refundWaveSpeedSegmentAiPhotoJobCredits(jobId, user, context);
      return {
        error: error instanceof Error ? error.message : "Failed to save WaveSpeed GPT Image 2 result.",
        jobId,
        profile: refundedProfile,
        status: "failed",
      };
    }
  }

  return {
    error: prediction.error || undefined,
    jobId,
    profile,
    status,
  };
};

const getWaveSpeedSegmentAiVideoJobProfile = async (jobId: string, user: StudioUser): Promise<WorkspaceProfile> => {
  const context = studioWaveSpeedSegmentAiVideoJobContexts.get(jobId);
  if (!context) {
    return getCachedWorkspaceProfileForUser(user);
  }

  const externalUserId = await resolveStudioExternalUserId(user);
  if (context.ownerExternalUserId !== externalUserId) {
    throw new Error("WaveSpeed segment AI video job is not available for this user.");
  }

  return { ...context.profile };
};

const probeStudioGeneratedVideoFileAvailability = async (
  kind: StudioGeneratedVideoPosterKind,
  jobId: string,
  user: StudioUser,
): Promise<boolean> => {
  try {
    const upstreamUrl = await getStudioGeneratedVideoFileProxyTarget(kind, jobId, user);
    const response = await fetchAdsflowResponse(
      upstreamUrl,
      {
        headers: {
          connection: "close",
          range: "bytes=0-0",
        },
      },
      {
        retryDelaysMs: [],
        timeoutMs: 15_000,
      },
    );

    if ("cancel" in (response.body ?? {})) {
      void (response.body as ReadableStream<Uint8Array>).cancel().catch(() => undefined);
    }

    return response.ok;
  } catch {
    return false;
  }
};

const recoverStudioSegmentGeneratedVideoJobStatus = async (
  kind: StudioGeneratedVideoPosterKind,
  jobId: string,
  user: StudioUser,
  options: {
    fallbackError: string;
  },
): Promise<StudioSegmentAiVideoJobStatus> => {
  const safeJobId = String(jobId ?? "").trim();
  const profile = await getCachedWorkspaceProfileForUser(user);
  const isFileAvailable = await probeStudioGeneratedVideoFileAvailability(kind, safeJobId, user);

  if (isFileAvailable) {
    const asset = normalizeAdsflowSegmentGeneratedVideoAsset(kind, safeJobId);

    warmStudioGeneratedVideoPlayback(kind, safeJobId, user);
    warmStudioGeneratedVideoPoster(kind, safeJobId, user);

    return {
      asset,
      jobId: safeJobId,
      profile,
      status: "ready",
    };
  }

  return {
    error: options.fallbackError,
    jobId: safeJobId,
    profile,
    status: "failed",
  };
};

export async function getStudioSegmentAiVideoJobFileProxyTarget(jobId: string, user: StudioUser): Promise<URL> {
  const safeJobId = normalizeGenerationText(jobId);
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const waveSpeedPredictionId = parseWaveSpeedSegmentAiVideoPredictionId(safeJobId);
  if (waveSpeedPredictionId) {
    await getWaveSpeedSegmentAiVideoJobProfile(safeJobId, user);
    const outputUrl = await getWaveSpeedPredictionOutputUrl(waveSpeedPredictionId);
    if (!outputUrl) {
      throw new Error("WaveSpeed generated video is not ready yet.");
    }

    return new URL(outputUrl);
  }

  assertAdsflowConfigured();

  const externalUserId = await resolveStudioExternalUserId(user);
  return buildAdsflowUrl(`/api/web/segment-ai-video/jobs/${encodeURIComponent(safeJobId)}/file`, {
    admin_token: env.adsflowAdminToken ?? "",
    external_user_id: externalUserId,
  });
}

export async function getStudioSegmentPhotoAnimationJobFileProxyTarget(jobId: string, user: StudioUser): Promise<URL> {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const waveSpeedPredictionId = parseWaveSpeedSegmentAiVideoPredictionId(safeJobId);
  if (waveSpeedPredictionId) {
    await getWaveSpeedSegmentAiVideoJobProfile(safeJobId, user);
    const outputUrl = await getWaveSpeedPredictionOutputUrl(waveSpeedPredictionId);
    if (!outputUrl) {
      throw new Error("WaveSpeed generated photo animation is not ready yet.");
    }

    return new URL(outputUrl);
  }

  assertAdsflowConfigured();

  const externalUserId = await resolveStudioExternalUserId(user);

  return buildAdsflowUrl(`/api/web/segment-photo-animation/jobs/${encodeURIComponent(safeJobId)}/file`, {
    admin_token: env.adsflowAdminToken ?? "",
    external_user_id: externalUserId,
  });
}

export async function getStudioSegmentTalkingPhotoJobFileProxyTarget(jobId: string, user: StudioUser): Promise<URL> {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const waveSpeedPredictionId = parseWaveSpeedSegmentAiVideoPredictionId(safeJobId);
  if (waveSpeedPredictionId) {
    await getWaveSpeedSegmentAiVideoJobProfile(safeJobId, user);
    const outputUrl = await getWaveSpeedPredictionOutputUrl(waveSpeedPredictionId);
    if (!outputUrl) {
      throw new Error("WaveSpeed generated talking character is not ready yet.");
    }

    return new URL(outputUrl);
  }

  assertAdsflowConfigured();

  const externalUserId = await resolveStudioExternalUserId(user);

  return buildAdsflowUrl(`/api/web/segment-talking-photo/jobs/${encodeURIComponent(safeJobId)}/file`, {
    admin_token: env.adsflowAdminToken ?? "",
    external_user_id: externalUserId,
  });
}

export async function getStudioSegmentSceneSoundJobFileProxyTarget(jobId: string, user: StudioUser): Promise<URL> {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  assertAdsflowConfigured();

  const externalUserId = await resolveStudioExternalUserId(user);

  return buildAdsflowUrl(`/api/web/segment-scene-sound/jobs/${encodeURIComponent(safeJobId)}/file`, {
    admin_token: env.adsflowAdminToken ?? "",
    external_user_id: externalUserId,
  });
}

export async function getStudioSegmentVoiceoverJobFileProxyTarget(jobId: string, user: StudioUser): Promise<URL> {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  assertAdsflowConfigured();

  const externalUserId = await resolveStudioExternalUserId(user);

  return buildAdsflowUrl(`/api/web/segment-voiceover/jobs/${encodeURIComponent(safeJobId)}/file`, {
    admin_token: env.adsflowAdminToken ?? "",
    external_user_id: externalUserId,
  });
}

const getStudioGeneratedVideoFileProxyTarget = (
  kind: StudioGeneratedVideoPosterKind,
  jobId: string,
  user: StudioUser,
): Promise<URL> => {
  switch (kind) {
    case "segment-ai-video":
      return getStudioSegmentAiVideoJobFileProxyTarget(jobId, user);
    case "segment-photo-animation":
      return getStudioSegmentPhotoAnimationJobFileProxyTarget(jobId, user);
    case "segment-talking-photo":
      return getStudioSegmentTalkingPhotoJobFileProxyTarget(jobId, user);
  }
};

const normalizeAdsflowSegmentGeneratedVideoAsset = (
  kind: StudioGeneratedVideoPosterKind,
  jobId: string,
): StudioGeneratedVideoAsset => {
  switch (kind) {
    case "segment-ai-video":
      return normalizeAdsflowSegmentAiVideoAsset(jobId);
    case "segment-photo-animation":
      return normalizeAdsflowSegmentPhotoAnimationAsset(jobId);
    case "segment-talking-photo":
      return normalizeAdsflowSegmentTalkingPhotoAsset(jobId);
  }
};

const getStudioGeneratedVideoPlaybackSource = async (
  kind: StudioGeneratedVideoPosterKind,
  jobId: string,
  user: StudioUser,
): Promise<WorkspaceProjectPlaybackSource> => {
  const safeJobId = normalizeGenerationText(jobId);
  if (!safeJobId) {
    throw new Error("Job id is required.");
  }

  const upstreamUrl = await getStudioGeneratedVideoFileProxyTarget(kind, safeJobId, user);

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
      const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
      if (
        message.includes("the operation was aborted due to timeout") ||
        message.includes("timed out") ||
        message.includes("timeout")
      ) {
        return;
      }

      console.warn("[studio] Failed to warm generated segment video playback cache", {
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

  const upstreamUrl = await getStudioGeneratedVideoFileProxyTarget(kind, safeJobId, user);

  return {
    cacheKey: getWorkspaceVideoPosterCacheKey({
      posterId: `${kind}:${safeJobId}`,
      targetUrl: upstreamUrl,
      version: safeJobId,
    }),
    posterId: `${kind}:${safeJobId}`,
    upstreamUrl,
  };
};

const warmStudioGeneratedVideoPoster = (kind: StudioGeneratedVideoPosterKind, jobId: string, user: StudioUser) => {
  void getStudioGeneratedVideoPosterSource(kind, jobId, user)
    .then((posterSource) => warmWorkspaceVideoPoster(posterSource))
    .catch((error) => {
      const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
      if (
        message.includes("the operation was aborted due to timeout") ||
        message.includes("timed out") ||
        message.includes("timeout")
      ) {
        return;
      }

      console.warn("[studio] Failed to warm generated video poster", {
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

export async function getStudioSegmentTalkingPhotoJobPosterPath(jobId: string, user: StudioUser): Promise<string> {
  return ensureWorkspaceVideoPoster(await getStudioGeneratedVideoPosterSource("segment-talking-photo", jobId, user));
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

export async function getStudioSegmentTalkingPhotoPlaybackAsset(
  jobId: string,
  user: StudioUser,
): Promise<WorkspaceProjectPlaybackAsset> {
  return getStudioGeneratedVideoPlaybackAsset("segment-talking-photo", jobId, user);
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

async function getStudioGenerationPlaybackSource(
  generation: StudioGeneration,
  user: StudioUser,
): Promise<WorkspaceProjectPlaybackSource> {
  const safeJobId = normalizeGenerationText(generation.id);
  if (!safeJobId || !generation.videoUrl || !isStudioPlaybackUrl(generation.videoUrl)) {
    throw new Error("Studio generation playback source is unavailable.");
  }

  const preferredPath = extractStudioVideoPathFromProxyUrl(generation.videoFallbackUrl ?? generation.videoUrl);

  return getStudioPlaybackSource(
    {
      jobId: safeJobId,
      preferredPath,
      version: generation.generatedAt,
    },
    user,
  );
}

async function prepareStudioLatestGenerationForBootstrap(
  latestGeneration: StudioGenerationStatus | null,
  user: StudioUser,
): Promise<StudioGenerationStatus | null> {
  if (!latestGeneration?.generation || latestGeneration.status !== "done") {
    return latestGeneration;
  }

  warmStudioGenerationPlayback(latestGeneration.generation, user);
  return latestGeneration;
}

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
      const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
      if (
        message.includes("the operation was aborted due to timeout") ||
        message.includes("timed out") ||
        message.includes("timeout")
      ) {
        return;
      }

      console.warn("[studio] Failed to warm studio playback cache", {
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
