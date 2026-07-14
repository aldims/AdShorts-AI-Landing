import type { ReactNode } from "react";
import type { ExamplePrefillStudioSettings } from "../../../shared/example-prefill";
import type { StudioSegmentVisualQuality } from "../../../shared/studio-credit-costs";
import type { WorkspaceMediaAssetRef } from "../../../shared/workspace-media-assets";
import type { WorkspaceReferenceKind, WorkspaceSavedReference } from "../../../shared/workspace-references";
import type { Locale } from "../../lib/i18n";
import type { CheckoutProductId } from "../../lib/payment-return";
import {
  getWorkspaceVideoDownloadName,
  sortWorkspaceMediaLibraryItemsNewestFirst,
  type WorkspaceMediaLibraryItem,
  type WorkspaceMediaLibraryPreviewKind,
} from "../../lib/workspaceMediaLibrary";
import type { WorkspaceProfile } from "./workspace-profile-helpers";
import type { WorkspaceSegmentEditorPayload } from "./workspace-segment-payload-helpers";
import type { StudioMusicType } from "./workspace-studio-options";
import type {
  WorkspaceTalkingCharacterTarget,
  WorkspaceTalkingTargetResizeHandle,
} from "./workspace-talking-character-helpers";
import type {
  StudioBrandLogoFile,
  StudioCustomMusicFile,
  StudioCustomVideoFile,
  StudioLanguage,
  StudioSubtitleColorCatalogOption,
  StudioSubtitleStyleOption,
  StudioVideoMode,
  WorkspaceProject,
  WorkspaceProjectPublication,
  WorkspacePublishPlatform,
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentEditorDraftSession,
  WorkspaceSegmentEditorSession,
  WorkspaceSegmentEditorSpeechWord,
  WorkspaceSegmentInfographicTransform,
  WorkspaceSegmentTimelineHistoryKind,
} from "./workspace-types";

export const characterPickerIconUrl = "/character.png";

export type WorkspaceTab = "overview" | "studio" | "generations" | "billing" | "settings";
export type WorkspaceMediaLibraryFilter =
  | "all"
  | "photo"
  | "video"
  | "ai_photo"
  | "image_edit"
  | "ai_video"
  | "photo_animation"
  | "talking_photo"
  | "characters"
  | "scenes";

export const workspaceText = (locale: Locale, ru: string, en: string) => (locale === "en" ? en : ru);
export const STUDIO_GENERATION_UNAVAILABLE_ERROR_CODE = "generation_unavailable";
export const getStudioGenerationUnavailableMessage = (locale: Locale) =>
  workspaceText(
    locale,
    "Генерация временно недоступна. Кредиты не списаны — попробуйте позже.",
    "Generation is temporarily unavailable. Credits were not charged — try again later.",
  );

export type Session = {
  displayEmail?: string;
  name: string;
  email: string;
  plan: string;
};

export const isAbortLikeError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";

export type WorkspacePackageCheckoutProductId = Extract<CheckoutProductId, "package_10" | "package_50" | "package_100">;

export type WorkspaceCheckoutResponse = {
  data?: {
    simulatedPayment?: {
      addedCredits: number;
      paymentId: string;
      productId: CheckoutProductId;
      profile: WorkspaceProfile;
    };
    url?: string;
    widget?: {
      confirmationToken: string;
      paymentId: string;
      returnUrl: string;
      url?: string;
    };
  };
  error?: string;
  warning?: string;
};

export type Props = {
  defaultTab: WorkspaceTab;
  initialProfile?: WorkspaceProfile | null;
  isProfileVerified?: boolean;
  isGuest?: boolean;
  session: Session;
  onLogout: () => void | Promise<void>;
  onAuthRequired?: () => void;
  onProfileChange?: (profile: WorkspaceProfile | null) => void;
};

export type WorkspaceGenerateOptions = {
  addWatermark?: boolean;
  brandChanged?: boolean;
  clearBranding?: boolean;
  brandLogoFile?: StudioBrandLogoFile | null;
  brandText?: string | null;
  clearAppliedSegmentEditorOnSuccess?: boolean;
  editedFromProjectAdId?: number;
  isRegeneration?: boolean;
  language?: StudioLanguage | string;
  musicName?: string;
  musicType?: StudioMusicType | string;
  projectId?: number;
  segmentEditor?: WorkspaceSegmentEditorPayload;
  segmentEditorAllowStructureChange?: boolean;
  segmentEditorPersistedSegmentIndexes?: readonly number[];
  segmentEditorSession?: WorkspaceSegmentEditorDraftSession | null;
  subtitleEnabled?: boolean;
  subtitleColorId?: string;
  subtitleStyleId?: string;
  videoMode?: StudioVideoMode | string;
  videoModeChanged?: boolean;
  versionRootProjectAdId?: number;
  voiceEnabled?: boolean;
  voiceId?: string;
};

export type WorkspaceCreditTopupPack = {
  badge?: string;
  checkoutProductId: WorkspacePackageCheckoutProductId;
  credits: string;
  name: string;
  price: string;
  subnote: string;
};

export type StudioGeneration = {
  adId: number | null;
  aspectRatio: string;
  description: string;
  durationLabel: string;
  finalAsset?: WorkspaceMediaAssetRef | null;
  generatedAt: string;
  hashtags: string[];
  id: string;
  isReadyForEditor?: boolean | null;
  modelLabel: string;
  prefillSettings?: ExamplePrefillStudioSettings | null;
  prompt: string;
  projectStatus?: string | null;
  readyReason?: string | null;
  title: string;
  videoFallbackUrl?: string | null;
  videoUrl: string;
};

export type StudioGeneratedVideoActionMode = "expanded" | "compact";
export type StudioGenerationUiSource = "idle" | "studio" | "segment-editor" | "bootstrap";

export const isStudioGenerationUserFacing = (
  isGenerating: boolean,
  generationUiSource: StudioGenerationUiSource,
) => isGenerating && generationUiSource !== "idle";

export const shouldShowStudioGenerationError = (
  generateError: string | null | undefined,
  isGenerating: boolean,
  generationUiSource: StudioGenerationUiSource,
) => Boolean(generateError) && !isStudioGenerationUserFacing(isGenerating, generationUiSource);

export const shouldUseWorkspaceStudioExpandedPromptLayout = (options: {
  hasComposerSourceIdea: boolean;
  topicInput: string;
}) => {
  // Prompt text scrolls inside the textarea; only auxiliary source metadata needs more panel space.
  return options.hasComposerSourceIdea;
};

export type StudioGenerationJob = {
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
  title: string;
};

export type StudioGenerationStartResponse = {
  code?: string;
  data?: StudioGenerationJob;
  error?: string;
};

export type StudioGenerationAvailabilityResponse = {
  code?: string;
  data?: {
    available?: boolean;
  };
  error?: string;
};

export type StudioGenerationStatusPayload = {
  error?: string;
  generation?: StudioGeneration;
  jobId: string;
  isReadyForEditor?: boolean | null;
  projectStatus?: string | null;
  readyReason?: string | null;
  status: string;
};

export type StudioGenerationStatusResponse = {
  data?: StudioGenerationStatusPayload;
  error?: string;
};

export type WorkspaceLocalExampleGoal = "ads" | "growth" | "expert";

export type WorkspaceLocalExamplesResponse = {
  data?: {
    canManage?: boolean;
    enabled: boolean;
    items?: Array<{
      id: string;
    }>;
  };
  error?: string;
};

export type WorkspaceLocalExampleSaveResponse = {
  data?: {
    item?: {
      id: string;
    };
  };
  error?: string;
};

export type WorkspaceBootstrapPayload = {
  featureFlags?: {
    segmentInfographic?: boolean;
  };
  latestGeneration?: StudioGenerationStatusPayload | null;
  notifications?: WorkspaceNotification[];
  profile: WorkspaceProfile;
  studioOptions: WorkspaceStudioOptionsPayload;
};

export type WorkspaceNotification = {
  createdAt: string | null;
  id: number;
  message: string;
  source: string | null;
  title: string;
};

export type WorkspaceBootstrapResponse = {
  data?: WorkspaceBootstrapPayload;
  error?: string;
};

export type WorkspaceNotificationsResponse = {
  data?: {
    notifications?: WorkspaceNotification[];
  };
  error?: string;
};

export const WORKSPACE_REFERRAL_SOURCE_STORAGE_KEY = "adshorts.web-referral-source";
export const WORKSPACE_REFERRAL_SOURCE_PATTERN = /^(?:[A-Za-z0-9_]{2,64}|en\/[A-Za-z0-9_]{2,61})$/;

export const normalizeWorkspaceReferralSource = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return WORKSPACE_REFERRAL_SOURCE_PATTERN.test(normalized) ? normalized : "";
};

export const readWorkspaceReferralSourceFromSearch = (search: string) => {
  const params = new URLSearchParams(search);
  return normalizeWorkspaceReferralSource(params.get("referral_source") ?? params.get("ref") ?? params.get("referral"));
};

export const readStoredWorkspaceReferralSource = () => {
  if (typeof window === "undefined") return "";

  try {
    return normalizeWorkspaceReferralSource(window.localStorage.getItem(WORKSPACE_REFERRAL_SOURCE_STORAGE_KEY));
  } catch {
    return "";
  }
};

export const buildWorkspaceBootstrapRequestUrl = (search: string) => {
  const referralSource = readWorkspaceReferralSourceFromSearch(search) || readStoredWorkspaceReferralSource();
  if (!referralSource) return "/api/workspace/bootstrap";
  return `/api/workspace/bootstrap?${new URLSearchParams({ referral_source: referralSource }).toString()}`;
};

export type WorkspaceProjectsPayload = {
  projects: WorkspaceProject[];
};

export type WorkspaceProjectsResponse = {
  data?: WorkspaceProjectsPayload;
  error?: string;
};

export type WorkspaceMediaLibraryPayload = {
  items: WorkspaceMediaLibraryItem[];
  nextCursor: string | null;
  total: number;
};

export type WorkspaceMediaLibraryResponse = {
  data?: WorkspaceMediaLibraryPayload;
  error?: string;
};

export const mergeWorkspaceMediaLibraryPageItems = (
  currentItems: WorkspaceMediaLibraryItem[],
  nextItems: WorkspaceMediaLibraryItem[],
) => {
  const itemsByKey = new Map<string, WorkspaceMediaLibraryItem>();

  [...currentItems, ...nextItems].forEach((item) => {
    if (!itemsByKey.has(item.itemKey)) {
      itemsByKey.set(item.itemKey, item);
    }
  });

  return sortWorkspaceMediaLibraryItemsNewestFirst(Array.from(itemsByKey.values()));
};

export type WorkspaceProjectDeletePayload = {
  projectId: string;
};

export type WorkspaceProjectDeleteResponse = {
  data?: WorkspaceProjectDeletePayload;
  error?: string;
};

export type WorkspaceLocalExampleSource = {
  prefillSettings: ExamplePrefillStudioSettings | null;
  prompt: string;
  sourceId: string | null;
  title: string;
  videoFallbackUrl?: string | null;
  videoUrl: string;
};

export type WorkspaceSegmentVisualModalTab =
  | "ai_video"
  | "photo_animation"
  | "talking_photo"
  | "ai_photo"
  | "image_edit"
  | "image_upscale"
  | "infographic"
  | "scene_sound"
  | "voiceover"
  | "upload"
  | "library";
export type WorkspaceSegmentEditorPromptToolTab = WorkspaceSegmentVisualModalTab;

export type WorkspaceSegmentTimelineVoiceTextEditSnapshot = {
  segment: WorkspaceSegmentEditorDraftSegment;
  segmentIndex: number;
  ttsAssetId: WorkspaceSegmentEditorDraftSession["ttsAssetId"];
};

export type WorkspaceSegmentTimelineRedoSnapshot =
  | {
      kind: "music";
      customMusicAssetId?: number | null;
      customMusicFileName?: string | null;
      musicAssetId?: number | null;
      musicName?: string | null;
      musicType: string;
      selectedCustomMusic: StudioCustomMusicFile | null;
    }
  | {
      kind: Exclude<WorkspaceSegmentTimelineHistoryKind, "music">;
      segment: WorkspaceSegmentEditorDraftSegment;
      segmentIndex: number;
    };

export type WorkspaceSegmentTimelineAudioPreviewTrack = {
  durationSeconds?: number | null;
  endTime?: number | null;
  mediaKind?: "audio" | "video";
  startTime?: number | null;
  url: string;
  volume?: number | null;
};

export type WorkspaceSegmentEditorFullPreviewStatus = "idle" | "loading" | "paused" | "playing";

export const shouldShowWorkspaceSegmentEditorFullPreviewBusyIndicator = (
  status: WorkspaceSegmentEditorFullPreviewStatus,
  options?: { blockedByActiveGeneration?: boolean },
) => status === "loading" && options?.blockedByActiveGeneration !== true;

export type WorkspaceSegmentEditorFullPreviewAudioTrack = {
  endGraceSeconds?: number;
  key: string;
  kind: "embedded_voice" | "music" | "sound" | "voice";
  loop?: boolean;
  mediaKind?: "audio" | "video";
  previewArrayIndex?: number | null;
  segmentIndex?: number | null;
  sourceKind: "isolated" | "timeline";
  volume: number;
  sourceStartTime: number;
  timelineEndTime: number;
  timelineStartTime: number;
  url: string;
  voiceFallbackReason?: string | null;
  voiceSourceKind?: "embedded" | "project" | "scene" | "segment" | null;
};

export type WorkspaceSegmentEditorFullPreviewDebugWindow = Window & {
  __adshortsFullPreviewTrace?: Array<Record<string, unknown>>;
  __adshortsVoiceDurationTrace?: Array<Record<string, unknown>>;
};

export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_MUSIC_VOLUME = 0.16;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_MUSIC_DUCKED_VOLUME = 0.06;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_SOUND_VOLUME = 0.25;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_SOUND_DUCKED_VOLUME = 0.14;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_VOLUME = 1;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_AUDIO_FADE_SECONDS = 0.08;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_DUCK_ATTACK_SECONDS = 0.22;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_DUCK_RELEASE_SECONDS = 0.55;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_AUDIO_SEEK_TOLERANCE_SECONDS = 0.09;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_AUDIO_READY_TIMEOUT_MS = 900;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_AUDIO_START_READY_TIMEOUT_MS = 12000;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_AUDIO_LOOKAHEAD_SECONDS = 7.5;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VISUAL_AHEAD_SEGMENTS = 2;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VISUAL_LOOKAHEAD_SECONDS = 14;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VISUAL_START_READY_TIMEOUT_MS = 6500;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VISUAL_TRANSITION_READY_TIMEOUT_MS = 6500;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VISUAL_WARMUP_THROTTLE_MS = 3500;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_AUDIO_END_TOLERANCE_SECONDS = 0.6;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_START_SEEK_TOLERANCE_SECONDS = 0.035;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_END_GRACE_SECONDS = 0.45;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_AUDIBLE_TAIL_SECONDS = 0.22;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_MUSIC_SEEK_TOLERANCE_SECONDS = 0.75;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_START_GATE_SECONDS = 2;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_START_GATE_TIMEOUT_MS = 8000;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_START_GATE_SYNC_TOLERANCE_SECONDS = 0.04;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_START_GATE_LEAD_TOLERANCE_SECONDS = 0.75;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_START_GATE_PROGRESS_SECONDS = 0.018;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_CLOCK_LAG_TOLERANCE_SECONDS = 0.045;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_BUFFERING_UI_DELAY_MS = 300;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_MEDIA_END_TOLERANCE_SECONDS = 0.02;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_VOICE_STALL_TIMEOUT_MS = 12000;
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_DEBUG_STORAGE_KEY = "adshortsPreviewDebug";
export const WORKSPACE_SEGMENT_EDITOR_FULL_PREVIEW_AUDIO_DEBUG_EVENTS = [
  "canplay",
  "ended",
  "error",
  "pause",
  "play",
  "seeked",
  "seeking",
  "stalled",
  "waiting",
] as const;
export const WORKSPACE_SEGMENT_TIMELINE_AUDIO_PREVIEW_NATURAL_END_CLEANUP_DELAY_MS = 450;
export const WORKSPACE_SEGMENT_TIMELINE_AUDIO_PREVIEW_TAIL_PADDING_SECONDS = 0.45;

export type WorkspaceSegmentEditorResponse = {
  data?: WorkspaceSegmentEditorSession;
  error?: string;
};

export type WorkspaceSegmentAiPhotoJobCreateRequest = {
  characterContinuityMode?: "auto" | "off" | "force";
  characterIds?: number[];
  language: StudioLanguage;
  preserveCharacters?: boolean;
  prompt: string;
  projectId?: number;
  purpose?: "workspace_reference";
  billingQuality?: StudioSegmentVisualQuality;
  quality?: StudioSegmentVisualQuality;
  referenceKind?: WorkspaceReferenceKind;
  referenceAssetIds?: number[];
  sceneReferenceAssetIds?: number[];
  segmentIndex?: number;
};

export type WorkspaceSegmentImageUpscaleRequest = {
  imageAssetId?: number;
  imageDataUrl?: string;
  imageFileName?: string;
  language: StudioLanguage;
  projectId?: number;
  segmentIndex?: number;
};

export type WorkspaceSegmentImageEditRequest = WorkspaceSegmentImageUpscaleRequest & {
  characterContinuityMode?: "auto" | "off" | "force";
  characterIds?: number[];
  preserveCharacters?: boolean;
  prompt: string;
  referenceAssetIds?: number[];
  sceneReferenceAssetIds?: number[];
};

export type WorkspaceSegmentInfographicRequest = {
  draftId?: string;
  idempotencyKey: string;
  projectId: number;
  segmentIndex: number;
  sourceMediaAssetId: number;
  stylePrompt?: string;
  text: string;
};

export type WorkspaceSegmentAiPhotoPromptImproveMode = "ai_photo" | "ai_video" | "photo_animation" | "image_edit";

export type WorkspaceStudioPromptImproveMode = WorkspaceSegmentAiPhotoPromptImproveMode | "studio_idea";

export type WorkspaceSegmentPromptImprovementSnapshot = {
  mode: WorkspaceSegmentAiPhotoPromptImproveMode;
  prompt: string;
  segmentIndex: number | null;
};

export type WorkspaceSegmentAiPhotoPromptImproveRequest = {
  language: StudioLanguage;
  mode: WorkspaceSegmentAiPhotoPromptImproveMode;
  prompt: string;
};

export type WorkspaceStudioPromptImproveRequest = {
  language: StudioLanguage;
  mode: WorkspaceStudioPromptImproveMode;
  prompt: string;
};

export type WorkspaceSegmentAiPhotoPromptImprovePayload = {
  prompt: string;
};

export type WorkspaceSegmentAiPhotoPromptImproveResponse = {
  data?: WorkspaceSegmentAiPhotoPromptImprovePayload;
  error?: string;
};

export type WorkspaceStudioPromptImproveResponse = WorkspaceSegmentAiPhotoPromptImproveResponse;

export type WorkspaceSegmentTextTranslateRequest = {
  sourceLanguage: StudioLanguage;
  targetLanguage: StudioLanguage;
  texts: string[];
};

export type WorkspaceSegmentTextTranslatePayload = {
  texts: string[];
};

export type WorkspaceSegmentTextTranslateResponse = {
  data?: WorkspaceSegmentTextTranslatePayload;
  error?: string;
};

export type WorkspaceSegmentAiPhotoJobCreatePayload = {
  asset?: StudioCustomVideoFile;
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

export type WorkspaceSegmentAiPhotoJobCreateResponse = {
  data?: WorkspaceSegmentAiPhotoJobCreatePayload;
  error?: string;
};

export type WorkspaceSegmentAiPhotoJobStatusPayload = {
  asset?: StudioCustomVideoFile;
  error?: string;
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

export type WorkspaceSegmentAiPhotoJobStatusResponse = {
  data?: WorkspaceSegmentAiPhotoJobStatusPayload;
  error?: string;
};

export type WorkspaceSegmentImageUpscaleJobCreatePayload = {
  jobId: string;
  profile: WorkspaceProfile;
  requestFingerprint?: string;
  status: string;
};

export type WorkspaceSegmentImageUpscaleJobCreateResponse = {
  data?: WorkspaceSegmentImageUpscaleJobCreatePayload;
  error?: string;
};

export type WorkspaceSegmentImageUpscaleJobStatusPayload = {
  asset?: StudioCustomVideoFile;
  error?: string;
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

export type WorkspaceSegmentImageUpscaleJobStatusResponse = {
  data?: WorkspaceSegmentImageUpscaleJobStatusPayload;
  error?: string;
};

export type WorkspaceSegmentInfographicJobCreateResponse = WorkspaceSegmentImageUpscaleJobCreateResponse;

export type WorkspaceSegmentInfographicJobAsset = StudioCustomVideoFile & {
  inputHash?: string | null;
  input_hash?: string | null;
  initialTransform?: WorkspaceSegmentInfographicTransform | null;
  initial_transform?: {
    center_x?: number | null;
    center_y?: number | null;
    width?: number | null;
  } | null;
  intrinsicHeight?: number | null;
  intrinsicWidth?: number | null;
  intrinsic_height?: number | null;
  intrinsic_width?: number | null;
  sourceVisualIdentity?: string | null;
  source_visual_identity?: string | null;
  parts?: Array<{
    frame?: { height?: number | null; width?: number | null; x?: number | null; y?: number | null } | null;
    intrinsicHeight?: number | null;
    intrinsicWidth?: number | null;
    intrinsic_height?: number | null;
    intrinsic_width?: number | null;
    mediaAssetId?: number | null;
    media_asset_id?: number | null;
    reveal?: { delaySeconds?: number | null; delay_seconds?: number | null; durationSeconds?: number | null; duration_seconds?: number | null } | null;
    text?: string | null;
  }> | null;
};

export type WorkspaceSegmentInfographicJobStatusResponse = {
  data?: Omit<WorkspaceSegmentImageUpscaleJobStatusPayload, "asset"> & {
    asset?: WorkspaceSegmentInfographicJobAsset;
    draftId?: string;
    projectId?: number;
    requestFingerprint?: string;
    segmentIndex?: number;
  };
  error?: string;
};

export type WorkspaceSegmentAiVideoJobCreateRequest = {
  characterContinuityMode?: "auto" | "off" | "force";
  characterIds?: number[];
  durationSeconds?: number;
  imageAssetId?: number;
  imageDataUrl?: string;
  imageFileName?: string;
  imageMimeType?: string;
  language: StudioLanguage;
  preserveCharacters?: boolean;
  prompt: string;
  projectId?: number;
  billingQuality?: StudioSegmentVisualQuality;
  quality?: StudioSegmentVisualQuality;
  referenceAssetIds?: number[];
  sceneReferenceAssetIds?: number[];
  segmentIndex?: number;
};

export type WorkspaceProjectCharacter = {
  aliases: string[];
  characterId: number;
  description: string | null;
  label: string;
  referenceAssetIds: number[];
  sourceSegmentIds: number[];
};

export type WorkspaceProjectCharactersPayload = {
  characters: WorkspaceProjectCharacter[];
  projectId: number;
};

export type WorkspaceProjectCharactersResponse = {
  data?: WorkspaceProjectCharactersPayload;
  error?: string;
};

export type WorkspaceReferenceCreateResponse = {
  data?: {
    reference: WorkspaceSavedReference;
  };
  error?: string;
};

export type WorkspaceReferenceDeleteResponse = {
  data?: {
    referenceId: string;
  };
  error?: string;
};

export type WorkspaceReferenceUpdateResponse = {
  data?: {
    reference: WorkspaceSavedReference;
  };
  error?: string;
};

export type WorkspaceSegmentPhotoAnimationJobCreateRequest = WorkspaceSegmentAiVideoJobCreateRequest & {
  customVideoAssetId?: number;
  customVideoFileDataUrl?: string;
  customVideoFileMimeType?: string;
  customVideoFileName?: string;
  durationExtensionBaseDurationSeconds?: number;
  durationExtensionMode?: "stitch";
  durationExtensionSourceVideoAssetId?: number;
  durationExtensionSourceVideoFileDataUrl?: string;
  durationExtensionSourceVideoFileMimeType?: string;
  durationExtensionSourceVideoFileName?: string;
  durationExtensionTailDurationSeconds?: number;
  durationExtensionTargetDurationSeconds?: number;
};

export type WorkspaceTalkingTargetDragState = {
  mode: "create" | "move" | "resize";
  originTarget?: WorkspaceTalkingCharacterTarget;
  resizeHandle?: WorkspaceTalkingTargetResizeHandle;
  segmentIndex: number;
  startX: number;
  startY: number;
};

export type WorkspaceSegmentTalkingPhotoJobCreateRequest = {
  customVideoAssetId?: number;
  customVideoFileDataUrl?: string;
  customVideoMediaType?: "photo" | "video";
  customVideoFileMimeType?: string;
  customVideoFileName?: string;
  durationSeconds?: number;
  language: StudioLanguage;
  projectId?: number;
  prompt?: string;
  script: string;
  segmentIndex?: number;
  speakerConfirmationToken?: string;
  speakerTarget?: WorkspaceTalkingCharacterTarget;
  voiceType?: string | null;
};

export type WorkspaceSegmentTalkingPhotoSpeakerPreviewCreateRequest = {
  customVideoAssetId?: number;
  customVideoFileDataUrl?: string;
  customVideoMediaType?: "photo" | "video";
  customVideoFileMimeType?: string;
  customVideoFileName?: string;
  language: StudioLanguage;
  projectId?: number;
  segmentIndex?: number;
  speakerTarget: WorkspaceTalkingCharacterTarget;
};

export type WorkspaceSegmentTalkingPhotoSpeakerPreview = {
  confirmationToken: string;
  expiresInSeconds: number | null;
  overlay: {
    box: {
      height: number;
      width: number;
      x: number;
      y: number;
    } | null;
    dataUrl: string;
    height: number | null;
    mimeType: string;
    width: number | null;
  };
  projectId: number | null;
  segmentIndex: number | null;
  sourceAssetId: number;
  sourceMediaType: "photo" | "video";
  speakerTarget: WorkspaceTalkingCharacterTarget;
};

export type WorkspaceSegmentSceneSoundJobCreateRequest = {
  durationSeconds?: number;
  language: StudioLanguage;
  projectId?: number;
  project_id?: number;
  prompt: string;
  segmentIndex?: number;
  segment_index?: number;
  source?: "current" | "original";
  visualMediaAssetId?: number;
  visualSourceJobId?: string;
  visualSourceKind?: "segment-ai-video" | "segment-photo-animation" | "segment-talking-photo";
};

export type WorkspaceSegmentVoiceoverJobCreateRequest = {
  language: StudioLanguage;
  projectId?: number;
  project_id?: number;
  segmentIndex?: number;
  segment_index?: number;
  text: string;
  voiceType?: string;
  voice_type?: string;
};

export type WorkspaceProjectVoiceoverSegmentRequest = {
  duration?: number | null;
  segmentIndex?: number;
  segment_index?: number;
  targetDuration?: number | null;
  target_duration?: number | null;
  text: string;
};

export type WorkspaceProjectVoiceoverJobCreateRequest = {
  language: StudioLanguage;
  projectId?: number;
  project_id?: number;
  segments: WorkspaceProjectVoiceoverSegmentRequest[];
  text: string;
  voiceType?: string;
  voice_type?: string;
};

export type WorkspaceBatchVoiceoverSegmentRequest = WorkspaceProjectVoiceoverSegmentRequest & {
  targetDurationSeconds?: number | null;
  target_duration_seconds?: number | null;
};

export type WorkspaceBatchVoiceoverGroupRequest = {
  language: StudioLanguage;
  segments: WorkspaceBatchVoiceoverSegmentRequest[];
  voiceType?: string;
  voice_type?: string;
};

export type WorkspaceBatchVoiceoverJobCreateRequest = {
  groups: WorkspaceBatchVoiceoverGroupRequest[];
  projectId?: number;
  project_id?: number;
};

export type WorkspaceSegmentVoiceoverJobStatusPayload = WorkspaceSegmentAiPhotoJobStatusPayload & {
  speechDuration?: number | null;
  speechDurationSource?: "audio" | null;
  speechEndTime?: number | null;
  speechStartTime?: number | null;
  speechWords?: WorkspaceSegmentEditorSpeechWord[];
  voiceSourceDuration?: number | null;
  voiceSourceEndTime?: number | null;
  voiceSourceStartTime?: number | null;
};

export type WorkspaceSegmentVoiceoverJobStatusResponse = {
  data?: WorkspaceSegmentVoiceoverJobStatusPayload;
  error?: string;
};

export type WorkspaceProjectVoiceoverJobStatusResponse = WorkspaceSegmentVoiceoverJobStatusResponse;

export type WorkspaceBatchVoiceoverJobSegmentStatusPayload = WorkspaceSegmentVoiceoverJobStatusPayload & {
  language: StudioLanguage;
  segmentIndex: number;
  text: string;
  voiceType: string;
};

export type WorkspaceBatchVoiceoverJobStatusPayload = {
  creditCost?: number;
  error?: string;
  jobId: string;
  profile: WorkspaceProfile;
  segments: WorkspaceBatchVoiceoverJobSegmentStatusPayload[];
  status: string;
};

export type WorkspaceBatchVoiceoverJobStatusResponse = {
  data?: WorkspaceBatchVoiceoverJobStatusPayload;
  error?: string;
};

export type WorkspaceSegmentAiVideoJobCreatePayload = {
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

export type WorkspaceSegmentAiVideoJobCreateResponse = {
  data?: WorkspaceSegmentAiVideoJobCreatePayload;
  error?: string;
};

export type WorkspaceSegmentAiVideoJobStatusPayload = {
  asset?: StudioCustomVideoFile;
  error?: string;
  jobId: string;
  profile: WorkspaceProfile;
  speechDuration?: number | null;
  speechDurationSource?: "audio" | null;
  speechEndTime?: number | null;
  speechStartTime?: number | null;
  speechWords?: WorkspaceSegmentEditorSpeechWord[];
  status: string;
};

export type WorkspaceSegmentAiVideoJobStatusResponse = {
  data?: WorkspaceSegmentAiVideoJobStatusPayload;
  error?: string;
};

export type WorkspaceSegmentThumbDragState = {
  draggedIndex: number;
  dropTargets: Array<{ left: number; right: number }>;
  initialScrollLeft: number;
  offsetX: number;
  offsetY: number;
  pointerId: number;
  width: number;
  x: number;
  y: number;
};

export type WorkspacePublishChannel = {
  channelId: string | null;
  channelName: string;
  pk: number;
};

export type WorkspacePublishBootstrapPayload = {
  channels: WorkspacePublishChannel[];
  defaults: {
    description: string;
    hashtags: string;
    publishAt: string | null;
    title: string;
  };
  platform: WorkspacePublishPlatform;
  publication: WorkspaceProjectPublication | null;
  selectedChannelPk: number | null;
  videoProjectId: number;
};

export const getPublishBootstrapForPlatform = (
  bootstrap: WorkspacePublishBootstrapPayload | null,
  platform: WorkspacePublishPlatform,
): WorkspacePublishBootstrapPayload | null => {
  return bootstrap?.platform === platform ? bootstrap : null;
};

export const getPublishChannelsForPlatform = (
  bootstrap: WorkspacePublishBootstrapPayload | null,
  platform: WorkspacePublishPlatform,
): WorkspacePublishChannel[] => getPublishBootstrapForPlatform(bootstrap, platform)?.channels ?? [];

export type WorkspacePublishBootstrapResponse = {
  data?: WorkspacePublishBootstrapPayload;
  error?: string;
};

export type WorkspacePublishJob = {
  enqueueError?: string | null;
  jobId: string;
  platform: WorkspacePublishPlatform;
  status: string;
  videoProjectId: number;
};

export type WorkspacePublishStartResponse = {
  data?: WorkspacePublishJob;
  error?: string;
};

export type WorkspacePublishJobStatusPayload = {
  error?: string;
  jobId: string;
  platform: WorkspacePublishPlatform;
  publication: WorkspaceProjectPublication | null;
  status: string;
  videoProjectId: number | null;
};

export type WorkspacePublishJobStatusResponse = {
  data?: WorkspacePublishJobStatusPayload;
  error?: string;
};

export type WorkspaceSegmentVisualRunState = Record<number, number>;
export type WorkspaceSegmentVisualRunScope =
  | "ai_photo"
  | "ai_video"
  | "custom_upload"
  | "image_edit"
  | "image_upscale"
  | "infographic"
  | "photo_animation"
  | "scene_sound"
  | "talking_photo"
  | "voiceover";

export const hasWorkspaceSegmentVisualRun = (
  runState: WorkspaceSegmentVisualRunState,
  segmentIndex: number | null | undefined,
) => typeof segmentIndex === "number" && Boolean(runState[segmentIndex]);

export const hasAnyWorkspaceSegmentVisualRun = (runState: WorkspaceSegmentVisualRunState) =>
  Object.keys(runState).length > 0;

export const isWorkspaceSegmentCustomVisualUploadBusy = (
  runState: WorkspaceSegmentVisualRunState,
  segmentIndex: number | null | undefined,
) => hasWorkspaceSegmentVisualRun(runState, segmentIndex);

export const isWorkspaceSegmentSceneSoundRunBusy = (
  segmentIndex: number | null | undefined,
  options: {
    hasActiveSceneSoundRun?: boolean;
    sceneSoundRunState: WorkspaceSegmentVisualRunState;
  },
) =>
  typeof segmentIndex === "number" &&
  (options.hasActiveSceneSoundRun === true || hasWorkspaceSegmentVisualRun(options.sceneSoundRunState, segmentIndex));

export const clearWorkspaceSegmentVisualRunState = (
  runState: WorkspaceSegmentVisualRunState,
  segmentIndex: number,
  runId?: number,
): WorkspaceSegmentVisualRunState => {
  if (!runState[segmentIndex] || (typeof runId === "number" && runState[segmentIndex] !== runId)) {
    return runState;
  }

  const nextRunState = { ...runState };
  delete nextRunState[segmentIndex];
  return nextRunState;
};

export type WorkspaceStudioOptionsPayload = {
  subtitleColors: StudioSubtitleColorCatalogOption[];
  subtitleStyles: StudioSubtitleStyleOption[];
};

export const STUDIO_PROMPT_PANEL_BASE_WIDTH = 620;
export const STUDIO_PROMPT_PANEL_EXPANDED_MAX_WIDTH = 1220;
export const STUDIO_PROMPT_PANEL_INLINE_BUFFER = 8;
export const WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS = 8;
export const WORKSPACE_SEGMENT_STILL_GENERATION_JOB_TIMEOUT_MS = 4 * 60 * 1000;
// Backend expires and refunds at 30 minutes. Keep polling through a short
// transport grace period so the terminal/refund state is observed reliably.
export const WORKSPACE_SEGMENT_INFOGRAPHIC_JOB_TIMEOUT_MS = 35 * 60 * 1000;
export const WORKSPACE_SEGMENT_AI_PHOTO_JOB_TIMEOUT_MS = 10 * 60 * 1000;
export const WORKSPACE_SEGMENT_AI_PHOTO_SERVER_BUSY_MESSAGE = "Сервер генерации изображений сейчас загружен. Попробуйте позже.";
export const WORKSPACE_SEGMENT_VIDEO_GENERATION_JOB_TIMEOUT_MS = 10 * 60 * 1000;
export const WORKSPACE_SEGMENT_PHOTO_ANIMATION_JOB_TIMEOUT_MS = 25 * 60 * 1000;
export const WORKSPACE_SEGMENT_SCENE_SOUND_JOB_TIMEOUT_MS = 10 * 60 * 1000;
export const SEGMENT_AI_PHOTO_MODAL_LIBRARY_INITIAL_RENDER_COUNT = 12;
export const SEGMENT_AI_PHOTO_MODAL_LIBRARY_RENDER_STEP = 12;
export const SEGMENT_AI_PHOTO_MODAL_EXIT_DURATION_MS = 280;
export const MEDIA_LIBRARY_LOAD_MORE_SCROLL_THRESHOLD_PX = 320;

export const normalizeWorkspaceSegmentGenerationJobStatus = (value: unknown) => String(value ?? "").trim().toLowerCase();

export const isWorkspaceSegmentGenerationJobDoneStatus = (value: unknown) =>
  ["completed", "done", "ready", "success", "succeeded"].includes(normalizeWorkspaceSegmentGenerationJobStatus(value));

export const isWorkspaceSegmentGenerationJobFailedStatus = (value: unknown) =>
  ["canceled", "cancelled", "error", "failed", "timeout"].includes(normalizeWorkspaceSegmentGenerationJobStatus(value));

export const studioPromptChips = ["Видео", "Субтитры", "Озвучка", "Музыка", "Язык"];
export const measureElementChildrenInlineWidth = (element: HTMLElement, gap: number) => {
  const childWidths = Array.from(element.children)
    .map((child) => Math.ceil((child as HTMLElement).getBoundingClientRect().width))
    .filter((width) => width > 0);

  if (childWidths.length === 0) {
    return 0;
  }

  return childWidths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, childWidths.length - 1);
};

export const workspaceLocalExampleGoalOptions: Array<{
  description: string;
  id: WorkspaceLocalExampleGoal;
  label: string;
}> = [
  {
    description: "Офферы, продажи, продукты и рекламные связки.",
    id: "ads",
    label: "📣 Реклама",
  },
  {
    description: "Темы для охватов, удержания, динамичных форматов и роста канала.",
    id: "growth",
    label: "📈 Рост канала",
  },
  {
    description: "Факты, разборы, объяснения и обучающие ролики.",
    id: "expert",
    label: "🎓 Обучение",
  },
];
export const workspaceLocalExampleGoalEnglishCopy: Record<WorkspaceLocalExampleGoal, Pick<(typeof workspaceLocalExampleGoalOptions)[number], "description" | "label">> = {
  ads: {
    description: "Offers, sales, products and ad concepts.",
    label: "📣 Ads",
  },
  expert: {
    description: "Facts, explainers and educational videos.",
    label: "🎓 Education",
  },
  growth: {
    description: "Reach, retention, dynamic formats and channel growth.",
    label: "📈 Channel growth",
  },
};

export const getWorkspaceLocalExampleGoalCopy = (
  option: (typeof workspaceLocalExampleGoalOptions)[number],
  locale: Locale,
) => (locale === "en" ? workspaceLocalExampleGoalEnglishCopy[option.id] ?? option : option);
export const PROJECTS_REQUEST_TIMEOUT_MS = 25_000;
export const MEDIA_LIBRARY_REQUEST_TIMEOUT_MS = 25_000;
export const SEGMENT_EDITOR_REQUEST_TIMEOUT_MS = 90_000;
export const SEGMENT_EDITOR_PREPARING_RETRY_DELAY_MS = 1_500;
export const SEGMENT_EDITOR_TIMELINE_STANDARD_FIT_SLOTS = 8;
export const WORKSPACE_CHECKOUT_REQUEST_TIMEOUT_MS = 20_000;

export const getWorkspaceSegmentEditorSessionUrl = (
  projectId: number,
  options?: {
    bypassCache?: boolean;
    forceRefresh?: boolean;
  },
) =>
  `/api/workspace/projects/${projectId}/segment-editor${
    options?.bypassCache || options?.forceRefresh ? "/reload" : ""
  }`;

export const isWorkspaceSegmentEditorNotFoundError = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized === "not found" || normalized.includes("404");
};

export const isWorkspaceSegmentEditorProjectUnavailableError = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("проект удал") ||
    normalized.includes("недоступен для редактирования") ||
    normalized.includes("project deleted") ||
    normalized.includes("not available for editing")
  );
};

export const isWorkspaceSegmentEditorPreparingError = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("пока") ||
    normalized.includes("not ready") ||
    normalized.includes("still being prepared") ||
    normalized.includes("project_not_ready") ||
    normalized.includes("does not have segment data") ||
    normalized.includes("segment data")
  );
};

export const waitWorkspaceDelay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const isTextInputTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

export const renderWorkspaceMediaLibraryPlayOverlay = (previewKind: WorkspaceMediaLibraryPreviewKind): ReactNode => {
  if (previewKind !== "video") {
    return null;
  }

  return (
    <span className="studio-media-library__play-indicator" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 7.5v9l7-4.5-7-4.5Z" fill="currentColor" />
      </svg>
    </span>
  );
};

export const getVideoDownloadName = getWorkspaceVideoDownloadName;

export const tabCopy: Record<
  WorkspaceTab,
  Record<Locale, {
    eyebrow: string;
    heading: string;
    subtitle: string;
  }>
> = {
  overview: {
    ru: {
      eyebrow: "Личный кабинет",
      heading: "Личный кабинет AdShorts AI",
      subtitle:
        "Управляйте генерациями, тарифом, каналами публикации и рабочими пресетами из одного workspace.",
    },
    en: {
      eyebrow: "Personal workspace",
      heading: "AdShorts AI workspace",
      subtitle: "Manage generations, plan, publishing channels and working presets from one workspace.",
    },
  },
  studio: {
    ru: {
      eyebrow: "Студия Shorts",
      heading: "",
      subtitle: "",
    },
    en: {
      eyebrow: "Shorts Studio",
      heading: "",
      subtitle: "",
    },
  },
  generations: {
    ru: {
      eyebrow: "Проекты",
      heading: "Все проекты аккаунта",
      subtitle: "Здесь собраны все генерации и готовые Shorts, связанные с вашим аккаунтом в общей БД.",
    },
    en: {
      eyebrow: "Projects",
      heading: "All account projects",
      subtitle: "All generations and finished Shorts linked to your account in the shared database.",
    },
  },
  billing: {
    ru: {
      eyebrow: "Тариф и кредиты",
      heading: "Тариф и пополнение",
      subtitle: "Здесь видно текущий тариф, баланс кредитов и сценарий докупки пакетов для PRO и ULTRA.",
    },
    en: {
      eyebrow: "Plan and credits",
      heading: "Plan and top-ups",
      subtitle: "Current plan, credit balance and add-on pack flow for PRO and ULTRA.",
    },
  },
  settings: {
    ru: {
      eyebrow: "Настройки",
      heading: "Настройки workspace",
      subtitle: "Профиль, интеграции, уведомления и безопасность собраны в одной панели.",
    },
    en: {
      eyebrow: "Settings",
      heading: "Workspace settings",
      subtitle: "Profile, integrations, notifications and account security in one panel.",
    },
  },
};

export const workspaceCreditTopupPacks: Array<Record<Locale, WorkspaceCreditTopupPack>> = [
  {
    ru: {
      checkoutProductId: "package_10",
      name: "Pack 100",
      credits: "100 кредитов",
      price: "690 ₽",
      subnote: "До 10 видео",
    },
    en: {
      checkoutProductId: "package_10",
      name: "Pack 100",
      credits: "100 credits",
      price: "690 ₽",
      subnote: "Up to 10 videos",
    },
  },
  {
    ru: {
      checkoutProductId: "package_50",
      name: "Pack 500",
      credits: "500 кредитов",
      price: "2 750 ₽",
      subnote: "до 50 видео",
      badge: "Выгодно",
    },
    en: {
      checkoutProductId: "package_50",
      name: "Pack 500",
      credits: "500 credits",
      price: "2 750 ₽",
      subnote: "Up to 50 videos",
      badge: "Good value",
    },
  },
  {
    ru: {
      checkoutProductId: "package_100",
      name: "Pack 1000",
      credits: "1000 кредитов",
      price: "4 990 ₽",
      subnote: "до 100 видео",
    },
    en: {
      checkoutProductId: "package_100",
      name: "Pack 1000",
      credits: "1000 credits",
      price: "4 990 ₽",
      subnote: "Up to 100 videos",
    },
  },
];

export type StudioCreateMode = "default" | "segment-editor";

export type WorkspaceScenesModeSwitchTarget = "current" | "project" | "scratch";

export type WorkspaceRetainedScenesDraftState<TDraft> = {
  activeSegmentIndex: number;
  draft: TDraft;
};

export const resolveWorkspaceRetainedScenesDraftState = <TDraft,>(
  activeDraft: TDraft | null | undefined,
  activeSegmentIndex: number,
  detachedDraftState: WorkspaceRetainedScenesDraftState<TDraft> | null | undefined,
): WorkspaceRetainedScenesDraftState<TDraft> | null => {
  if (activeDraft) {
    return {
      activeSegmentIndex,
      draft: activeDraft,
    };
  }

  return detachedDraftState ?? null;
};

export const resolveWorkspaceScenesModeSwitchTarget = (options: {
  hasDisplayedGeneratedProject: boolean;
  hasRetainedScenesDraft?: boolean;
  isSegmentEditorActive: boolean;
}): WorkspaceScenesModeSwitchTarget => {
  if (options.isSegmentEditorActive || options.hasRetainedScenesDraft) {
    return "current";
  }
  if (options.hasDisplayedGeneratedProject) {
    return "project";
  }
  return "scratch";
};

export const shouldShowWorkspaceStartFreshScenesAction = (options: {
  hasContent: boolean;
  hasResettableChanges: boolean;
  isSegmentEditorActive: boolean;
}) =>
  options.isSegmentEditorActive &&
  (options.hasContent || options.hasResettableChanges);

export const shouldShowWorkspaceStudioWelcomeCard = (options: {
  createMode: StudioCreateMode;
  hasCreatedVideo: boolean;
  hasGenerationError: boolean;
  isBootstrapPending: boolean;
  isClosed: boolean;
  isCreateView: boolean;
  isDismissed: boolean;
  isGenerationVisible: boolean;
  isManuallyOpened: boolean;
}) =>
  options.isCreateView &&
  options.createMode === "default" &&
  !options.isBootstrapPending &&
  !options.isGenerationVisible &&
  !options.hasGenerationError &&
  (options.isManuallyOpened || (!options.hasCreatedVideo && !options.isClosed && !options.isDismissed));

export const shouldShowWorkspaceStudioIdeaEmptyState = (options: {
  createMode: StudioCreateMode;
  hasComposerSourceIdea: boolean;
  hasTopicInput: boolean;
  isContentPlanVisible: boolean;
  isCreateView: boolean;
  isPreviewStageVisible: boolean;
  isWelcomeVisible: boolean;
}) =>
  options.isCreateView &&
  options.createMode === "default" &&
  !options.isPreviewStageVisible &&
  !options.isWelcomeVisible &&
  !options.isContentPlanVisible &&
  !options.hasComposerSourceIdea;

export type WorkspaceStudioIdeaSuggestion = {
  category: string;
  prompt: string;
};

const WORKSPACE_STUDIO_IDEA_SUGGESTION_ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1_000;

const workspaceStudioIdeaSuggestionPacks: Record<
  Locale,
  ReadonlyArray<ReadonlyArray<WorkspaceStudioIdeaSuggestion>>
> = {
  ru: [
    [
      { category: "Польза", prompt: "3 ошибки в [вашей теме], которые совершают почти все" },
      { category: "Продажи", prompt: "Покажите продукт: проблема → решение → результат" },
      { category: "История", prompt: "Всё шло по плану, пока не случилось неожиданное" },
    ],
    [
      { category: "Эксперт", prompt: "Объясните сложную тему простыми словами за 30 секунд" },
      { category: "Результат", prompt: "До и после: покажите заметный результат" },
      { category: "Разбор", prompt: "Разберите популярный миф и покажите, как на самом деле" },
    ],
    [
      { category: "Советы", prompt: "5 быстрых советов, которые можно применить сегодня" },
      { category: "Сравнение", prompt: "Сравните два подхода и помогите выбрать лучший" },
      { category: "FAQ", prompt: "Ответьте на вопрос, который клиенты задают чаще всего" },
    ],
    [
      { category: "Факт", prompt: "Неожиданный факт, который меняет взгляд на привычную вещь" },
      { category: "Кейс", prompt: "Мини-кейс: задача, решение и результат в цифрах" },
      { category: "Хук", prompt: "Начните с провокационного вопроса и дайте ясный ответ" },
    ],
    [
      { category: "Процесс", prompt: "Покажите путь изнутри: от первого шага до результата" },
      { category: "Продажи", prompt: "3 причины попробовать [продукт или услугу] сейчас" },
      { category: "Клиент", prompt: "Короткая история клиента с понятным выводом" },
    ],
  ],
  en: [
    [
      { category: "Value", prompt: "3 mistakes in [your topic] that almost everyone makes" },
      { category: "Sales", prompt: "Show the product: problem → solution → result" },
      { category: "Story", prompt: "Everything went to plan until something unexpected happened" },
    ],
    [
      { category: "Expert", prompt: "Explain a complex topic in simple words in 30 seconds" },
      { category: "Result", prompt: "Before and after: show a visible result" },
      { category: "Breakdown", prompt: "Debunk a popular myth and show what really happens" },
    ],
    [
      { category: "Tips", prompt: "5 quick tips people can use today" },
      { category: "Compare", prompt: "Compare two approaches and help people choose" },
      { category: "FAQ", prompt: "Answer the question customers ask most often" },
    ],
    [
      { category: "Fact", prompt: "A surprising fact that changes how people see something familiar" },
      { category: "Case", prompt: "Mini case study: challenge, solution and measurable result" },
      { category: "Hook", prompt: "Open with a provocative question and give a clear answer" },
    ],
    [
      { category: "Process", prompt: "Show the process from the first step to the final result" },
      { category: "Sales", prompt: "3 reasons to try [the product or service] now" },
      { category: "Customer", prompt: "A short customer story with a clear takeaway" },
    ],
  ],
};

export const getWorkspaceStudioIdeaSuggestionRotation = (timestamp = Date.now()) =>
  Math.floor(timestamp / WORKSPACE_STUDIO_IDEA_SUGGESTION_ROTATION_INTERVAL_MS);

export const getWorkspaceStudioIdeaSuggestions = (locale: Locale, rotation: number) => {
  const packs = workspaceStudioIdeaSuggestionPacks[locale];
  const safeRotation = Number.isFinite(rotation) ? Math.trunc(rotation) : 0;
  const normalizedRotation = ((safeRotation % packs.length) + packs.length) % packs.length;
  return packs[normalizedRotation];
};
