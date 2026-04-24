import { Fragment, memo, type CSSProperties, type ChangeEvent, type FocusEvent as ReactFocusEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type SyntheticEvent as ReactSyntheticEvent, type WheelEvent as ReactWheelEvent, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AccountMenuButton } from "../components/AccountMenuButton";
import { InsufficientCreditsModal } from "../components/InsufficientCreditsModal";
import { PrimarySiteNav } from "../components/PrimarySiteNav";
import { SiteHeaderWorkspaceStatus } from "../components/SiteHeaderWorkspaceStatus";
import {
  buildWorkspaceMediaLibraryRequestPath,
  canCapturePosterInBrowser,
  MEDIA_LIBRARY_PAGE_SIZE,
  shouldLoadWorkspaceMediaLibraryView,
} from "../features/workspace/hot-path";
import { clearExamplePrefillIntent, readExamplePrefillIntent } from "../lib/example-prefill";
import { logClientEvent } from "../lib/client-log";
import {
  canPurchaseAddonCredits,
  formatCreditsCountLabel,
  getInsufficientCreditsPricingSection,
  type InsufficientCreditsContext,
} from "../lib/insufficient-credits";
import { writePricingEntryIntent } from "../lib/pricing-entry-intent";
import { clearStudioEntryIntent, readStudioEntryIntent, type StudioEntryIntentSection } from "../lib/studio-entry-intent";
import {
  createWorkspaceMediaLibraryItem,
  dedupeWorkspaceMediaLibraryItems,
  getWorkspaceImageDownloadName,
  getWorkspaceProjectDisplayTitle,
  getWorkspaceVideoDownloadName,
  normalizeWorkspaceMediaLibraryCreatedAt,
  sortWorkspaceMediaLibraryItemsNewestFirst,
  type WorkspaceMediaLibraryItem,
  type WorkspaceMediaLibraryItemKind,
  type WorkspaceMediaLibraryItemSource,
  type WorkspaceMediaLibraryPreviewKind,
} from "../lib/workspaceMediaLibrary";
import {
  buildWorkspaceProjectStackGroups,
  type WorkspaceProjectStackGroup,
} from "../lib/workspaceProjectStacks";
import { resolveWorkspaceGenerationMusicRequest } from "../lib/workspaceGenerationMusic";
import { resolveWorkspaceRegenerationPrompt } from "../lib/workspaceRegenerationPrompt";
import {
  resolveWorkspaceMediaSurface,
  type WorkspaceResolvedMediaContext,
  type WorkspaceResolvedMediaSurface,
} from "../lib/workspaceResolvedMedia";
import { sanitizeWorkspaceSegmentEditorCustomMusicState } from "../lib/workspaceSegmentEditorMusic";
import {
  getWorkspaceSegmentEditorDisplayEndTime,
  getWorkspaceSegmentEditorDisplayStartTime,
  getWorkspaceSegmentEditorPlaybackDuration,
  rebuildWorkspaceSegmentEditorTimeline,
} from "../lib/workspaceSegmentEditorTimeline";
import {
  filterWorkspaceStillAssetUrls,
  getWorkspaceSegmentPausedPreviewTime,
  sanitizeWorkspaceSegmentPosterUrl,
} from "../lib/workspaceSegmentPreview";
import { hasWorkspaceSegmentEditorStructureChanged } from "../lib/workspaceSegmentEditorStructure";
import {
  STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST,
  STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST,
  STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST,
  STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST,
  STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST,
  STUDIO_VIDEO_GENERATION_CREDIT_COST,
  type StudioCreditAction,
} from "../../shared/studio-credit-costs";
import { type ExamplePrefillStudioSettings } from "../../shared/example-prefill";
import type { WorkspaceMediaAssetRef } from "../../shared/workspace-media-assets";

type WorkspaceTab = "overview" | "studio" | "generations" | "billing" | "settings";
type WorkspaceMediaLibraryFilter = "all" | "photo" | "video";

type Session = {
  name: string;
  email: string;
  plan: string;
};

const isAbortLikeError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";

const ensureVideoElementLoading = (
  element: HTMLVideoElement,
  minimumReadyState: number = HTMLMediaElement.HAVE_CURRENT_DATA,
) => {
  if (element.preload !== "auto") {
    element.preload = "auto";
  }

  if (element.networkState === HTMLMediaElement.NETWORK_EMPTY) {
    element.load();
    return;
  }

  if (
    element.readyState < minimumReadyState &&
    element.networkState !== HTMLMediaElement.NETWORK_LOADING
  ) {
    element.load();
  }
};

const WORKSPACE_SEGMENT_GENERATED_VIDEO_WARMUP_ATTACH_TIMEOUT_MS = 480;
const WORKSPACE_SEGMENT_GENERATED_VIDEO_WARMUP_TIMEOUT_MS = 4_500;

const normalizeWorkspaceVideoSourceUrl = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "";
  }

  if (typeof window === "undefined") {
    return normalized;
  }

  try {
    return new URL(normalized, window.location.href).href;
  } catch {
    return normalized;
  }
};

const videoElementUsesWorkspaceSourceUrl = (element: HTMLVideoElement, sourceUrl: string) => {
  const normalizedSourceUrl = normalizeWorkspaceVideoSourceUrl(sourceUrl);
  if (!normalizedSourceUrl) {
    return false;
  }

  return [element.currentSrc, element.src, element.getAttribute("src")]
    .map((candidate) => normalizeWorkspaceVideoSourceUrl(candidate))
    .some((candidate) => candidate === normalizedSourceUrl);
};

const disposeWorkspaceDetachedVideoElement = (element: HTMLVideoElement | null | undefined) => {
  if (!element) {
    return;
  }

  element.pause();
  element.removeAttribute("src");

  try {
    element.load();
  } catch {
    // Ignore cleanup errors while the browser is tearing down the detached element.
  }
};

const waitForWorkspaceVideoElementReady = (
  element: HTMLVideoElement,
  options?: {
    minimumReadyState?: number;
    timeoutMs?: number;
  },
) =>
  new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    const minimumReadyState = options?.minimumReadyState ?? HTMLMediaElement.HAVE_CURRENT_DATA;
    const timeoutMs = options?.timeoutMs ?? WORKSPACE_SEGMENT_GENERATED_VIDEO_WARMUP_TIMEOUT_MS;

    if (element.readyState >= minimumReadyState) {
      resolve(true);
      return;
    }

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      settle(element.readyState >= minimumReadyState);
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      element.removeEventListener("loadedmetadata", handlePotentialReady);
      element.removeEventListener("loadeddata", handlePotentialReady);
      element.removeEventListener("canplay", handlePotentialReady);
      element.removeEventListener("error", handleError);
    };

    const settle = (result: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(result);
    };

    const handlePotentialReady = () => {
      if (element.readyState >= minimumReadyState) {
        settle(true);
      }
    };

    const handleError = () => {
      settle(false);
    };

    element.addEventListener("loadedmetadata", handlePotentialReady);
    element.addEventListener("loadeddata", handlePotentialReady);
    element.addEventListener("canplay", handlePotentialReady);
    element.addEventListener("error", handleError);
    ensureVideoElementLoading(element, minimumReadyState);
    handlePotentialReady();
  });

type WorkspaceProfile = {
  balance: number;
  expiresAt: string | null;
  plan: string;
  startPlanUsed: boolean;
};

type Props = {
  defaultTab: WorkspaceTab;
  initialProfile?: WorkspaceProfile | null;
  session: Session;
  onLogout: () => void | Promise<void>;
  onProfileChange?: (profile: WorkspaceProfile | null) => void;
};

type WorkspaceCreditTopupPack = {
  badge?: string;
  credits: string;
  name: string;
  price: string;
  subnote: string;
};

type StudioGeneration = {
  adId: number | null;
  aspectRatio: string;
  description: string;
  durationLabel: string;
  finalAsset?: WorkspaceMediaAssetRef | null;
  generatedAt: string;
  hashtags: string[];
  id: string;
  modelLabel: string;
  prefillSettings?: ExamplePrefillStudioSettings | null;
  prompt: string;
  title: string;
  videoFallbackUrl?: string | null;
  videoUrl: string;
};

type StudioGenerationJob = {
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
  title: string;
};

type StudioGenerationStartResponse = {
  data?: StudioGenerationJob;
  error?: string;
};

type StudioGenerationStatusPayload = {
  error?: string;
  generation?: StudioGeneration;
  jobId: string;
  status: string;
};

type StudioGenerationStatusResponse = {
  data?: StudioGenerationStatusPayload;
  error?: string;
};

type WorkspaceLocalExampleGoal = "ads" | "growth" | "expert";

type WorkspaceLocalExamplesResponse = {
  data?: {
    canManage?: boolean;
    enabled: boolean;
    items?: Array<{
      id: string;
    }>;
  };
  error?: string;
};

type WorkspaceLocalExampleSaveResponse = {
  data?: {
    item?: {
      id: string;
    };
  };
  error?: string;
};

type WorkspaceBootstrapPayload = {
  latestGeneration?: StudioGenerationStatusPayload | null;
  profile: WorkspaceProfile;
  studioOptions: WorkspaceStudioOptionsPayload;
};

type WorkspaceBootstrapResponse = {
  data?: WorkspaceBootstrapPayload;
  error?: string;
};

type WorkspaceProjectYouTubePublication = {
  channelName: string | null;
  link: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  state: string | null;
  youtubeVideoId: string | null;
};

type WorkspaceProject = {
  adId: number | null;
  createdAt: string;
  description: string;
  editedFromProjectAdId: number | null;
  finalAsset?: WorkspaceMediaAssetRef | null;
  generatedAt: string | null;
  hashtags: string[];
  id: string;
  jobId: string | null;
  prompt: string;
  source: "project" | "task";
  status: string;
  title: string;
  updatedAt: string;
  versionRootProjectAdId: number | null;
  posterUrl: string | null;
  prefillSettings?: ExamplePrefillStudioSettings | null;
  videoFallbackUrl: string | null;
  videoUrl: string | null;
  youtubePublication: WorkspaceProjectYouTubePublication | null;
};

type WorkspaceProjectsPayload = {
  projects: WorkspaceProject[];
};

type WorkspaceProjectsResponse = {
  data?: WorkspaceProjectsPayload;
  error?: string;
};

type WorkspaceMediaLibraryPayload = {
  items: WorkspaceMediaLibraryItem[];
  nextCursor: string | null;
  total: number;
};

type WorkspaceMediaLibraryResponse = {
  data?: WorkspaceMediaLibraryPayload;
  error?: string;
};

const mergeWorkspaceMediaLibraryPageItems = (
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

type WorkspaceProjectDeletePayload = {
  projectId: string;
};

type WorkspaceProjectDeleteResponse = {
  data?: WorkspaceProjectDeletePayload;
  error?: string;
};

type WorkspaceContentPlanIdea = {
  createdAt: string;
  id: string;
  isUsed: boolean;
  planId: string;
  position: number;
  prompt: string;
  summary: string;
  title: string;
  updatedAt: string;
  usedAt: string | null;
};

type WorkspaceContentPlan = {
  createdAt: string;
  id: string;
  ideas: WorkspaceContentPlanIdea[];
  language: "en" | "ru";
  query: string;
  updatedAt: string;
};

type WorkspaceContentPlansPayload = {
  plans: WorkspaceContentPlan[];
};

type WorkspaceContentPlansResponse = {
  data?: WorkspaceContentPlansPayload;
  error?: string;
};

type WorkspaceContentPlanPayload = {
  plan: WorkspaceContentPlan;
};

type WorkspaceContentPlanResponse = {
  data?: WorkspaceContentPlanPayload;
  error?: string;
};

type WorkspaceContentPlanIdeaUpdatePayload = {
  ideaId: string;
  isUsed: boolean;
  planId: string;
  updatedAt: string;
  usedAt: string | null;
};

type WorkspaceContentPlanIdeaUpdateResponse = {
  data?: WorkspaceContentPlanIdeaUpdatePayload;
  error?: string;
};

type WorkspaceContentPlanIdeaDeletePayload = {
  ideaId: string;
  planId: string;
  updatedAt: string;
};

type WorkspaceContentPlanIdeaDeleteResponse = {
  data?: WorkspaceContentPlanIdeaDeletePayload;
  error?: string;
};

type WorkspaceLocalExampleSource = {
  prefillSettings: ExamplePrefillStudioSettings | null;
  prompt: string;
  sourceId: string | null;
  title: string;
  videoUrl: string;
};

type WorkspaceContentPlanComposerSource = {
  ideaId: string;
  planId: string;
  prompt: string;
  title: string;
};

type WorkspaceContentPlanIdeaMutation = {
  ideaId: string;
  ideaUpdatedAt: string;
  isUsed: boolean;
  planId: string;
  planUpdatedAt: string;
  usedAt: string | null;
};

const WORKSPACE_CONTENT_PLAN_IDEA_COUNT_DEFAULT = 5;

const formatWorkspaceContentPlanIdeaCount = (value: number) => {
  const count = Math.max(1, Math.trunc(value));
  const normalized = Math.abs(count) % 100;
  const tail = normalized % 10;

  if (normalized >= 11 && normalized <= 19) {
    return `${count} идей`;
  }

  if (tail === 1) {
    return `${count} идея`;
  }

  if (tail >= 2 && tail <= 4) {
    return `${count} идеи`;
  }

  return `${count} идей`;
};

type WorkspaceGeneratedMediaLibraryEntry = {
  createdAt: number;
  id: string;
  item: WorkspaceMediaLibraryItem;
  sourceJobId: string;
};

type StoredWorkspaceGeneratedMediaLibraryEntry = {
  createdAt: number;
  id: string;
  item: WorkspaceMediaLibraryItem;
  sourceJobId: string;
};

type WorkspaceSegmentEditorVideoAction = "ai" | "ai_photo" | "custom" | "image_edit" | "original" | "photo_animation";
type WorkspaceSegmentEditorPayloadVideoAction = "ai" | "custom" | "original";
type WorkspaceSegmentPreviewKind = "video" | "image";
type WorkspaceSegmentAiVideoMode = "ai_video" | "photo_animation";
type WorkspaceSegmentMediaType = "photo" | "video";
type WorkspaceSegmentSourceKind = "ai_generated" | "stock" | "upload" | "unknown";
type WorkspaceSegmentCustomVisualSource = "upload" | "media-library";
type WorkspaceSegmentVisualModalTab = "ai_video" | "photo_animation" | "ai_photo" | "image_edit" | "image_upscale" | "upload" | "library";

type WorkspaceSegmentEditorSpeechWord = {
  confidence: number;
  endTime: number;
  startTime: number;
  text: string;
};

type WorkspaceSegmentEditorSegment = {
  currentAsset: WorkspaceMediaAssetRef | null;
  currentExternalPlaybackUrl: string | null;
  currentExternalPreviewUrl: string | null;
  currentPlaybackUrl: string | null;
  currentPreviewUrl: string | null;
  currentSourceKind: WorkspaceSegmentSourceKind;
  duration: number;
  endTime: number;
  index: number;
  mediaType: WorkspaceSegmentMediaType;
  originalAsset: WorkspaceMediaAssetRef | null;
  originalExternalPlaybackUrl: string | null;
  originalExternalPreviewUrl: string | null;
  originalPlaybackUrl: string | null;
  originalPreviewUrl: string | null;
  originalSourceKind: WorkspaceSegmentSourceKind;
  speechDuration: number | null;
  speechEndTime: number | null;
  speechStartTime: number | null;
  speechWords: WorkspaceSegmentEditorSpeechWord[];
  startTime: number;
  text: string;
};

type WorkspaceSegmentEditorSession = {
  customMusicAssetId?: number | null;
  customMusicFileName?: string | null;
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

type WorkspaceSegmentEditorPayloadSegment = {
  customVideoAssetId?: number;
  customVideoFileDataUrl?: string;
  customVideoFileMimeType?: string;
  customVideoFileName?: string;
  customVideoRemoteUrl?: string;
  customVideoFileUploadKey?: string;
  duration?: number;
  endTime?: number;
  index: number;
  resetVisual?: boolean;
  startTime?: number;
  text: string;
  videoAction: WorkspaceSegmentEditorPayloadVideoAction;
};

type WorkspaceSegmentEditorPayload = {
  projectId: number;
  segments: WorkspaceSegmentEditorPayloadSegment[];
};

type WorkspaceSegmentEditorLocalizedTextMap = Partial<Record<StudioLanguage, string>>;

type WorkspaceSegmentEditorDraftSegment = WorkspaceSegmentEditorSegment & {
  aiPhotoAsset: StudioCustomVideoFile | null;
  aiPhotoGeneratedFromPrompt: string | null;
  aiPhotoPrompt: string;
  aiPhotoPromptInitialized: boolean;
  aiVideoAsset: StudioCustomVideoFile | null;
  aiVideoGeneratedMode: WorkspaceSegmentAiVideoMode | null;
  aiVideoGeneratedFromPrompt: string | null;
  aiVideoPrompt: string;
  aiVideoPromptInitialized: boolean;
  customVideo: StudioCustomVideoFile | null;
  imageEditAsset: StudioCustomVideoFile | null;
  imageEditGeneratedFromPrompt: string | null;
  imageEditPrompt: string;
  imageEditPromptInitialized: boolean;
  originalText: string;
  originalTextByLanguage: WorkspaceSegmentEditorLocalizedTextMap;
  photoAnimationSourceAsset: StudioCustomVideoFile | null;
  textByLanguage: WorkspaceSegmentEditorLocalizedTextMap;
  videoAction: WorkspaceSegmentEditorVideoAction;
  visualReset: boolean;
};

type WorkspaceSegmentEditorDraftSession = Omit<WorkspaceSegmentEditorSession, "segments"> & {
  segments: WorkspaceSegmentEditorDraftSegment[];
};

type WorkspaceSegmentEditorResponse = {
  data?: WorkspaceSegmentEditorSession;
  error?: string;
};

type WorkspaceSegmentAiPhotoJobCreateRequest = {
  language: StudioLanguage;
  prompt: string;
  projectId?: number;
  segmentIndex?: number;
};

type WorkspaceSegmentImageUpscaleRequest = {
  imageAssetId?: number;
  imageDataUrl?: string;
  imageFileName?: string;
  language: StudioLanguage;
  projectId?: number;
  segmentIndex?: number;
};

type WorkspaceSegmentImageEditRequest = WorkspaceSegmentImageUpscaleRequest & {
  prompt: string;
};

type WorkspaceSegmentAiPhotoPromptImproveMode = "ai_photo" | "ai_video" | "photo_animation" | "image_edit";

type WorkspaceSegmentAiPhotoPromptImproveRequest = {
  language: StudioLanguage;
  mode: WorkspaceSegmentAiPhotoPromptImproveMode;
  prompt: string;
};

type WorkspaceSegmentAiPhotoPromptImprovePayload = {
  prompt: string;
};

type WorkspaceSegmentAiPhotoPromptImproveResponse = {
  data?: WorkspaceSegmentAiPhotoPromptImprovePayload;
  error?: string;
};

type WorkspaceSegmentTextTranslateRequest = {
  sourceLanguage: StudioLanguage;
  targetLanguage: StudioLanguage;
  texts: string[];
};

type WorkspaceSegmentTextTranslatePayload = {
  texts: string[];
};

type WorkspaceSegmentTextTranslateResponse = {
  data?: WorkspaceSegmentTextTranslatePayload;
  error?: string;
};

type WorkspaceSegmentAiPhotoJobCreatePayload = {
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

type WorkspaceSegmentAiPhotoJobCreateResponse = {
  data?: WorkspaceSegmentAiPhotoJobCreatePayload;
  error?: string;
};

type WorkspaceSegmentAiPhotoJobStatusPayload = {
  asset?: StudioCustomVideoFile;
  error?: string;
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

type WorkspaceSegmentAiPhotoJobStatusResponse = {
  data?: WorkspaceSegmentAiPhotoJobStatusPayload;
  error?: string;
};

type WorkspaceSegmentImageUpscaleJobCreatePayload = {
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

type WorkspaceSegmentImageUpscaleJobCreateResponse = {
  data?: WorkspaceSegmentImageUpscaleJobCreatePayload;
  error?: string;
};

type WorkspaceSegmentImageUpscaleJobStatusPayload = {
  asset?: StudioCustomVideoFile;
  error?: string;
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

type WorkspaceSegmentImageUpscaleJobStatusResponse = {
  data?: WorkspaceSegmentImageUpscaleJobStatusPayload;
  error?: string;
};

type WorkspaceSegmentAiVideoJobCreateRequest = {
  language: StudioLanguage;
  prompt: string;
  projectId?: number;
  segmentIndex?: number;
};

type WorkspaceSegmentPhotoAnimationJobCreateRequest = WorkspaceSegmentAiVideoJobCreateRequest & {
  customVideoAssetId?: number;
  customVideoFileDataUrl?: string;
  customVideoFileMimeType?: string;
  customVideoFileName?: string;
};

type StoredWorkspaceSegmentPhotoAnimationJob = {
  createdAt: number;
  jobId: string;
  projectId: number;
  prompt: string;
  segmentIndex: number;
  sourceAsset: StudioCustomVideoFile | null;
  status: string;
};

type WorkspaceSegmentAiVideoJobCreatePayload = {
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

type WorkspaceSegmentAiVideoJobCreateResponse = {
  data?: WorkspaceSegmentAiVideoJobCreatePayload;
  error?: string;
};

type WorkspaceSegmentAiVideoJobStatusPayload = {
  asset?: StudioCustomVideoFile;
  error?: string;
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
};

type WorkspaceSegmentAiVideoJobStatusResponse = {
  data?: WorkspaceSegmentAiVideoJobStatusPayload;
  error?: string;
};

type WorkspaceSegmentPreviewCardMediaProps = {
  autoplay?: boolean;
  fallbackPosterUrl?: string | null;
  imageLoading?: "eager" | "lazy";
  isPlaybackRequested?: boolean;
  loop?: boolean;
  mediaKey: string;
  mountVideoWhenIdle?: boolean;
  muted?: boolean;
  onVideoError?: () => void;
  onVideoEnded?: () => void;
  onVideoTimeUpdate?: (currentTime: number) => void;
  onVideoPause?: () => void;
  onVideoPlay?: () => void;
  posterUrl?: string | null;
  preferPosterFrame?: boolean;
  preload?: "auto" | "metadata" | "none";
  primePausedFrame?: boolean;
  previewFallbackUrls?: Array<string | null | undefined>;
  previewKind: WorkspaceSegmentPreviewKind;
  previewUrl: string;
  videoRef?: (element: HTMLVideoElement | null) => void;
};

type WorkspaceSegmentSubtitleOverlayProps = {
  clipCurrentTime: number;
  compact?: boolean;
  isEditable?: boolean;
  isPlaying: boolean;
  onResetText?: () => void;
  onTextChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  segment: WorkspaceSegmentEditorDraftSegment;
  segmentNumber: number;
  subtitleColorId: StudioSubtitleColorOption["id"];
  subtitleColorOptions: StudioSubtitleColorOption[];
  subtitleStyleId: StudioSubtitleStyleOption["id"];
  subtitleStyleOptions: StudioSubtitleStyleOption[];
};

type WorkspaceSegmentThumbDragState = {
  draggedIndex: number;
  height: number;
  offsetX: number;
  offsetY: number;
  pointerId: number;
  width: number;
  x: number;
  y: number;
};

type WorkspacePublishChannel = {
  channelId: string | null;
  channelName: string;
  pk: number;
};

type WorkspacePublishBootstrapPayload = {
  channels: WorkspacePublishChannel[];
  defaults: {
    description: string;
    hashtags: string;
    publishAt: string | null;
    title: string;
  };
  publication: WorkspaceProjectYouTubePublication | null;
  selectedChannelPk: number | null;
  videoProjectId: number;
};

type WorkspacePublishBootstrapResponse = {
  data?: WorkspacePublishBootstrapPayload;
  error?: string;
};

type WorkspacePublishJob = {
  enqueueError?: string | null;
  jobId: string;
  status: string;
  videoProjectId: number;
};

type WorkspacePublishStartResponse = {
  data?: WorkspacePublishJob;
  error?: string;
};

type WorkspacePublishJobStatusPayload = {
  error?: string;
  jobId: string;
  publication: WorkspaceProjectYouTubePublication | null;
  status: string;
  videoProjectId: number | null;
};

type WorkspacePublishJobStatusResponse = {
  data?: WorkspacePublishJobStatusPayload;
  error?: string;
};

type StudioVoiceOption = {
  id: string;
  label: string;
  description: string;
  previewPitch?: number;
  previewRate?: number;
  previewText?: string;
  previewSampleUrl?: string;
};

type StudioLanguage = "ru" | "en";

type StudioLanguageOption = {
  description: string;
  id: StudioLanguage;
  label: string;
};

type StudioMusicType =
  | "ai"
  | "business"
  | "calm"
  | "custom"
  | "dramatic"
  | "energetic"
  | "fun"
  | "inspirational"
  | "luxury"
  | "none"
  | "tech"
  | "upbeat";

type StudioMusicOption = {
  description: string;
  id: StudioMusicType;
  label: string;
};

type StudioCustomMusicFile = {
  assetId?: number;
  dataUrl?: string;
  file?: File;
  fileName: string;
  fileSize: number;
  objectUrl?: string;
};

type StudioVideoMode = "ai_photo" | "ai_video" | "custom" | "standard";

type StudioVideoOption = {
  description: string;
  id: StudioVideoMode;
  label: string;
};

type StudioCustomVideoFile = {
  assetId?: number;
  dataUrl?: string;
  file?: File;
  fileName: string;
  fileSize: number;
  libraryItemKey?: string;
  mimeType: string;
  objectUrl?: string;
  posterUrl?: string;
  remoteUrl?: string;
  source?: WorkspaceSegmentCustomVisualSource;
};

type StudioBrandLogoFile = {
  assetId?: number;
  dataUrl?: string;
  file?: File;
  fileName: string;
  fileSize: number;
  mimeType: string;
  objectUrl?: string;
};

type StudioSubtitleStyleOption = {
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

type StudioSubtitleColorCatalogOption = {
  hex: string;
  id: string;
  label: string;
};

type StudioSubtitleColorOption = {
  accent: string;
  id: string;
  label: string;
  outline: string;
  surface: string;
  text: string;
};

type StudioSubtitleExampleOption = {
  activeWordIndex: number;
  id: string;
  label: string;
  lines: string[];
  note: string;
};

type StudioSubtitleColorOverrides = Partial<Pick<StudioSubtitleColorOption, "outline" | "surface" | "text">>;
type StudioSubtitlePreviewWordState = "active" | "future" | "past";
type StudioSubtitlePreviewWord = {
  sourceIndex?: number;
  state: StudioSubtitlePreviewWordState;
  text: string;
};
type WorkspaceSegmentSubtitleCaretPoint = {
  clientX: number;
  clientY: number;
};

type WorkspaceStudioOptionsPayload = {
  subtitleColors: StudioSubtitleColorCatalogOption[];
  subtitleStyles: StudioSubtitleStyleOption[];
};

const STUDIO_SUBTITLE_PREVIEW_MAX_CHARS_PER_LINE = 20;
const STUDIO_SUBTITLE_PREVIEW_MAX_WORDS_PER_LINE = 4;
const STUDIO_CUSTOM_ASSET_NAME_MAX_CHARS = 16;
const STUDIO_CUSTOM_MUSIC_MAX_BYTES = 18 * 1024 * 1024;
const STUDIO_ALLOWED_CUSTOM_MUSIC_EXTENSIONS = [".m4a", ".mp3", ".wav"] as const;
const STUDIO_CUSTOM_VIDEO_MAX_BYTES = 48 * 1024 * 1024;
const STUDIO_ALLOWED_CUSTOM_VIDEO_EXTENSIONS = [".m4v", ".mov", ".mp4", ".webm"] as const;
const STUDIO_BRAND_LOGO_MAX_BYTES = 12 * 1024 * 1024;
const STUDIO_BRAND_TEXT_MAX_CHARS = 50;
const STUDIO_PROMPT_PANEL_BASE_WIDTH = 620;
const STUDIO_PROMPT_PANEL_EXPANDED_MAX_WIDTH = 1220;
const STUDIO_PROMPT_PANEL_ADAPTIVE_BREAKPOINT = 640;
const STUDIO_PROMPT_PANEL_INLINE_BUFFER = 8;
const STUDIO_ALLOWED_SEGMENT_CUSTOM_IMAGE_EXTENSIONS = [".avif", ".jpeg", ".jpg", ".png", ".webp"] as const;
const STUDIO_ALLOWED_SEGMENT_CUSTOM_VISUAL_EXTENSIONS = [
  ...STUDIO_ALLOWED_CUSTOM_VIDEO_EXTENSIONS,
  ...STUDIO_ALLOWED_SEGMENT_CUSTOM_IMAGE_EXTENSIONS,
] as const;
const WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS = 1;
const WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS = 8;
const WORKSPACE_SEGMENT_EDITOR_NEW_SEGMENT_DURATION_SECONDS = 2.4;
const WORKSPACE_SEGMENT_STILL_GENERATION_JOB_TIMEOUT_MS = 4 * 60 * 1000;
const WORKSPACE_SEGMENT_VIDEO_GENERATION_JOB_TIMEOUT_MS = 10 * 60 * 1000;
const WORKSPACE_SEGMENT_PHOTO_ANIMATION_JOB_TIMEOUT_MS = 25 * 60 * 1000;
const SEGMENT_AI_PHOTO_MODAL_LIBRARY_INITIAL_RENDER_COUNT = 24;
const SEGMENT_AI_PHOTO_MODAL_LIBRARY_RENDER_STEP = 48;
const SEGMENT_AI_PHOTO_MODAL_EXIT_DURATION_MS = 280;
const MEDIA_LIBRARY_LOAD_MORE_SCROLL_THRESHOLD_PX = 320;

const normalizeWorkspaceSegmentGenerationJobStatus = (value: unknown) => String(value ?? "").trim().toLowerCase();

const isWorkspaceSegmentGenerationJobDoneStatus = (value: unknown) =>
  ["completed", "done", "ready", "success", "succeeded"].includes(normalizeWorkspaceSegmentGenerationJobStatus(value));

const isWorkspaceSegmentGenerationJobFailedStatus = (value: unknown) =>
  ["canceled", "cancelled", "error", "failed", "timeout"].includes(normalizeWorkspaceSegmentGenerationJobStatus(value));

const studioPromptChips = ["Видео", "Субтитры", "Озвучка", "Музыка", "Язык"];
const measureElementChildrenInlineWidth = (element: HTMLElement, gap: number) => {
  const childWidths = Array.from(element.children)
    .map((child) => Math.ceil((child as HTMLElement).getBoundingClientRect().width))
    .filter((width) => width > 0);

  if (childWidths.length === 0) {
    return 0;
  }

  return childWidths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, childWidths.length - 1);
};

const rgbFromHex = (value: string) => {
  const normalized = value.replace("#", "");
  if (normalized.length !== 6) return null;

  const numeric = Number.parseInt(normalized, 16);
  if (Number.isNaN(numeric)) return null;

  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
};

const createStudioSubtitleColorOption = (
  id: string,
  label: string,
  accent: string,
  overrides: StudioSubtitleColorOverrides = {},
): StudioSubtitleColorOption => {
  const rgb = rgbFromHex(accent) ?? { r: 255, g: 255, b: 255 };
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;

  return {
    id,
    label,
    accent,
    surface: overrides.surface ?? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`,
    text: overrides.text ?? (brightness >= 170 ? "#08111d" : "#f8fbff"),
    outline: overrides.outline ?? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.34)`,
  };
};

const fallbackStudioSubtitleStyleOption: StudioSubtitleStyleOption = {
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
};

const fallbackStudioSubtitleColorOption = createStudioSubtitleColorOption("purple", "Фиолетовый", "#8B5CF6");

const buildStudioSubtitleColorOptions = (
  colorCatalog: StudioSubtitleColorCatalogOption[],
): StudioSubtitleColorOption[] =>
  colorCatalog.map((color) =>
    createStudioSubtitleColorOption(
      color.id,
      color.label,
      `#${color.hex.replace(/^#/, "")}`,
      color.id === "gold"
        ? {
            outline: "rgba(255, 215, 0, 0.42)",
            surface: "rgba(255, 215, 0, 0.18)",
          }
        : color.id === "white"
          ? {
              outline: "rgba(255, 255, 255, 0.3)",
              surface: "rgba(255, 255, 255, 0.14)",
            }
          : color.id === "black"
            ? {
                outline: "rgba(255, 255, 255, 0.22)",
                surface: "rgba(255, 255, 255, 0.08)",
              }
            : {},
    ),
  );

const getStudioSubtitleColorAfterStyleChange = (options: {
  currentColorId: StudioSubtitleColorOption["id"];
  currentStyleId: StudioSubtitleStyleOption["id"];
  nextStyleId: StudioSubtitleStyleOption["id"];
  subtitleColorOptions: StudioSubtitleColorOption[];
  subtitleStyleOptions: StudioSubtitleStyleOption[];
}) => {
  const { currentColorId, currentStyleId, nextStyleId, subtitleColorOptions, subtitleStyleOptions } = options;
  const currentStyle = subtitleStyleOptions.find((style) => style.id === currentStyleId);
  const nextStyle = subtitleStyleOptions.find((style) => style.id === nextStyleId);

  if (!nextStyle) {
    return currentColorId;
  }

  const hasKnownCurrentColor = subtitleColorOptions.some((color) => color.id === currentColorId);
  const shouldFollowStyleDefault =
    !hasKnownCurrentColor ||
    !currentColorId ||
    (currentStyle ? currentColorId === currentStyle.defaultColorId : currentColorId === "purple");

  return shouldFollowStyleDefault ? nextStyle.defaultColorId : currentColorId;
};

const studioSubtitleExampleOptions: StudioSubtitleExampleOption[] = [
  {
    activeWordIndex: 1,
    id: "cta",
    label: "CTA",
    note: "Финальный призыв",
    lines: ["Забери шаблон", "и протестируй сегодня"],
  },
];

const getStudioSubtitlePreviewFontFamily = (value: string) =>
  value === "Manrope" ? '"Manrope", "Avenir Next", "Segoe UI", sans-serif' : '"DejaVu Sans", "Trebuchet MS", sans-serif';

const getStudioSubtitleLogicLabel = (style: StudioSubtitleStyleOption) => {
  switch (style.logicMode) {
    case "crossfade":
      return "Crossfade";
    case "phrase":
      return "Phrase follow";
    case "sliding":
      return "Sliding";
    default:
      return "Block mode";
  }
};

const getStudioSubtitleTransitionLabel = (style: StudioSubtitleStyleOption) => {
  switch (style.transitionMode) {
    case "hard_cut":
      return "Hard cut";
    case "slide_up":
      return "Slide up";
    case "soft_crossfade":
      return "Crossfade";
    case "soft_fade":
      return "Soft fade";
    case "karaoke_follow":
      return "Follow word";
    default:
      return style.transitionMode || "Transition";
  }
};

const studioSubtitleStyleUsesAccentColor = (style: StudioSubtitleStyleOption) => style.usesAccentColor;

const getStudioSubtitlePreviewMaxWordsPerLine = (style: StudioSubtitleStyleOption) => {
  if (style.logicMode === "crossfade") return Math.max(5, style.windowSize);
  if (style.logicMode === "sliding") return Math.max(4, Math.min(6, style.windowSize));
  if (style.logicMode === "phrase") return Math.max(3, Math.min(5, style.windowSize - 1));
  return Math.max(2, Math.min(STUDIO_SUBTITLE_PREVIEW_MAX_WORDS_PER_LINE, style.windowSize));
};

const getStudioSubtitlePreviewMaxCharsPerLine = (style: StudioSubtitleStyleOption) => {
  if (style.id === "impact") return 18;
  if (style.id === "editorial") return 24;
  if (style.id === "cinema") return 28;
  return STUDIO_SUBTITLE_PREVIEW_MAX_CHARS_PER_LINE;
};

const splitStudioSubtitlePreviewLines = (words: StudioSubtitlePreviewWord[], style: StudioSubtitleStyleOption) => {
  if (style.id === "impact") {
    return words.slice(-1).map((word) => [word]);
  }

  const maxWordsPerLine = getStudioSubtitlePreviewMaxWordsPerLine(style);
  const maxCharsPerLine = getStudioSubtitlePreviewMaxCharsPerLine(style);

  if (words.length <= maxWordsPerLine) return [words];

  let bestSplitIndex = Math.min(maxWordsPerLine, words.length);
  let bestDifference = Number.POSITIVE_INFINITY;

  for (let splitIndex = 1; splitIndex < words.length; splitIndex += 1) {
    const firstLine = words.slice(0, splitIndex);
    const secondLine = words.slice(splitIndex);
    const firstLineLength = firstLine.map((word) => word.text).join(" ").length;
    const secondLineLength = secondLine.map((word) => word.text).join(" ").length;
    const isFirstLineValid =
      firstLine.length <= maxWordsPerLine &&
      firstLineLength <= maxCharsPerLine;
    const isSecondLineValid =
      secondLine.length <= maxWordsPerLine &&
      secondLineLength <= maxCharsPerLine;

    if (!isFirstLineValid || !isSecondLineValid) continue;

    const nextDifference = Math.abs(firstLineLength - secondLineLength);
    if (nextDifference < bestDifference) {
      bestDifference = nextDifference;
      bestSplitIndex = splitIndex;
    }
  }

  return [words.slice(0, bestSplitIndex), words.slice(bestSplitIndex)];
};

const buildStudioSubtitlePreviewVisibleWords = (
  words: string[],
  activeWordIndex: number,
  style: StudioSubtitleStyleOption,
): StudioSubtitlePreviewWord[] => {
  const normalizeWord = (word: string) => (style.id === "impact" ? word.toUpperCase() : word);
  const buildState = (wordIndex: number): StudioSubtitlePreviewWordState =>
    !studioSubtitleStyleUsesAccentColor(style) || style.logicMode === "crossfade"
      ? "past"
      : wordIndex < activeWordIndex
        ? "past"
        : wordIndex === activeWordIndex
          ? "active"
          : "future";

  if (style.logicMode === "crossfade" || style.logicMode === "phrase") {
    return words.map((word, wordIndex) => ({
      state: buildState(wordIndex),
      text: normalizeWord(word),
    }));
  }

  if (style.id === "impact") {
    const activeWord = words[activeWordIndex];
    return activeWord
      ? [
          {
            state: "active",
            text: normalizeWord(activeWord),
          },
        ]
      : [];
  }

  if (style.logicMode === "sliding") {
    const windowSize = Math.max(2, Math.min(6, style.windowSize));
    let startIndex = Math.max(0, activeWordIndex - Math.floor(windowSize / 2));
    let endIndex = Math.min(words.length, startIndex + windowSize);

    if (endIndex - startIndex < windowSize) {
      startIndex = Math.max(0, endIndex - windowSize);
    }

    return words.slice(startIndex, endIndex).map((word, offset) => {
      const wordIndex = startIndex + offset;
      return {
        state: buildState(wordIndex),
        text: normalizeWord(word),
      };
    });
  }

  const blockSize = Math.max(2, style.windowSize);
  const blockStart = Math.floor(activeWordIndex / blockSize) * blockSize;
  return words.slice(blockStart, activeWordIndex + 1).map((word, offset) => {
    const wordIndex = blockStart + offset;
    return {
      state: buildState(wordIndex),
      text: normalizeWord(word),
    };
  });
};

const buildStudioSubtitlePreviewLines = (
  example: StudioSubtitleExampleOption,
  style: StudioSubtitleStyleOption,
): StudioSubtitlePreviewWord[][] => {
  const words = example.lines
    .join(" ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) return [];

  const activeWordIndex = Math.max(0, Math.min(words.length - 1, example.activeWordIndex));
  const visibleWords = buildStudioSubtitlePreviewVisibleWords(words, activeWordIndex, style);
  return splitStudioSubtitlePreviewLines(visibleWords, style);
};

const getStudioSubtitlePreviewStyle = (style: StudioSubtitleStyleOption, color: StudioSubtitleColorOption) => {
  const previewFontSize = Math.max(
    14,
    Math.min(30, Math.round(style.fontSize / (style.id === "impact" ? 3.8 : style.id === "cinema" ? 4.8 : 4.4))),
  );
  const previewLineHeight = style.id === "cinema" ? 1.18 : style.id === "editorial" ? 1.12 : 1.03;
  const previewLineGap = style.id === "karaoke" ? 10 : style.logicMode === "phrase" ? 8 : 6;

  return {
    "--subtitle-accent": studioSubtitleStyleUsesAccentColor(style) ? color.accent : "#FFFFFF",
    "--subtitle-outline": studioSubtitleStyleUsesAccentColor(style) ? color.outline : "rgba(255, 255, 255, 0.18)",
    "--subtitle-preview-active-lift":
      style.wordEffect === "slide" ? "-2px" : style.wordEffect === "scale" ? "-1px" : "0px",
    "--subtitle-preview-active-scale":
      style.wordEffect === "scale" ? (style.id === "impact" ? "1.12" : "1.06") : "1",
    "--subtitle-preview-font-family": getStudioSubtitlePreviewFontFamily(style.fontFamily),
    "--subtitle-preview-font-size": `${previewFontSize}px`,
    "--subtitle-preview-font-weight":
      style.id === "impact" ? 900 : style.id === "editorial" || style.id === "cinema" ? 760 : style.fontFamily === "Manrope" ? 860 : 800,
    "--subtitle-preview-future-opacity":
      style.id === "karaoke" ? "0.58" : style.logicMode === "phrase" ? "0.18" : style.logicMode === "crossfade" ? "1" : style.id === "editorial" ? "0.22" : "0.08",
    "--subtitle-preview-offset":
      `${Math.max(14, Math.min(48, Math.round(style.marginBottom / (style.id === "impact" ? 8.8 : style.id === "story" ? 9.4 : 10))))}px`,
    "--subtitle-preview-outline-width":
      `${Math.max(0.75, Math.min(3.5, style.outlineWidth * (style.id === "impact" ? 0.92 : style.id === "cinema" ? 0.45 : 0.72)))}px`,
    "--subtitle-preview-letter-spacing":
      style.id === "cinema" ? "0.06em" : style.id === "editorial" ? "0.015em" : style.id === "impact" ? "-0.02em" : "0em",
    "--subtitle-preview-line-height": String(previewLineHeight),
    "--subtitle-preview-line-gap": `${previewLineGap}px`,
    "--subtitle-preview-caption-width": style.id === "editorial" ? "88%" : style.id === "cinema" ? "92%" : style.id === "impact" ? "78%" : "82%",
    "--subtitle-preview-word-gap": style.id === "editorial" ? "0.4em" : style.id === "cinema" ? "0.28em" : "0.32em",
  } as CSSProperties;
};

const WORKSPACE_SEGMENT_SUBTITLE_PREVIEW_MAX_LINES = 6;

const normalizeWorkspaceSegmentEditorTextForCompare = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizeWorkspaceSegmentSubtitleToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^[^0-9A-Za-zА-Яа-яЁё]+|[^0-9A-Za-zА-Яа-яЁё]+$/g, "");

const tokenizeWorkspaceSegmentSubtitleText = (value: string) =>
  value
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

const resolveWorkspaceSegmentSubtitleCaretPositionFromTextareaPoint = ({
  clientX,
  clientY,
  textarea,
}: WorkspaceSegmentSubtitleCaretPoint & {
  textarea: HTMLTextAreaElement;
}) => {
  const value = textarea.value ?? "";
  if (!value) {
    return 0;
  }

  const textareaRect = textarea.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const mirrorTextNode = document.createTextNode(`${value}\u200b`);
  const mirroredStyleProperties = [
    "box-sizing",
    "font-family",
    "font-size",
    "font-style",
    "font-variant",
    "font-weight",
    "letter-spacing",
    "line-height",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "text-align",
    "text-indent",
    "text-transform",
    "white-space",
    "word-break",
  ] as const;

  mirror.style.position = "fixed";
  mirror.style.left = `${textareaRect.left}px`;
  mirror.style.top = `${textareaRect.top}px`;
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.overflow = "hidden";
  mirror.style.width = `${textareaRect.width}px`;
  mirror.style.minHeight = `${textareaRect.height}px`;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.wordBreak = computedStyle.wordBreak === "normal" ? "break-word" : computedStyle.wordBreak;

  mirroredStyleProperties.forEach((property) => {
    mirror.style.setProperty(property, computedStyle.getPropertyValue(property));
  });

  mirror.appendChild(mirrorTextNode);
  document.body.appendChild(mirror);

  const range = document.createRange();
  let bestIndex = value.length;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 0; index <= value.length; index += 1) {
    range.setStart(mirrorTextNode, index);
    range.setEnd(mirrorTextNode, index);

    const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    const hasBox = rect.width > 0 || rect.height > 0;
    if (!hasBox) {
      continue;
    }

    const score = Math.abs(clientY - (rect.top + rect.height / 2)) * 1000 + Math.abs(clientX - rect.left);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  document.body.removeChild(mirror);
  return bestIndex;
};

const formatStudioSubtitlePreviewWord = (value: string, style: StudioSubtitleStyleOption) =>
  style.id === "impact" ? value.toUpperCase() : value;

const normalizeWorkspaceSegmentSubtitlePreviewText = (value: string) => value.replace(/\s+/g, " ").trim();

const getWorkspaceSegmentSubtitlePreviewMaxCharsPerLine = (style: StudioSubtitleStyleOption) => {
  if (style.id === "impact") return 20;
  if (style.id === "editorial") return 26;
  if (style.id === "cinema") return 30;
  return 28;
};

const getWorkspaceSegmentSubtitlePreviewMaxWordsPerLine = (style: StudioSubtitleStyleOption) => {
  if (style.id === "impact") return 1;
  if (style.id === "cinema") return 5;
  return 4;
};

const splitWorkspaceSegmentSubtitlePreviewLines = (
  words: StudioSubtitlePreviewWord[],
  style: StudioSubtitleStyleOption,
): StudioSubtitlePreviewWord[][] => {
  if (words.length === 0) {
    return [];
  }

  if (style.id === "impact") {
    return words.map((word) => [word]);
  }

  const maxCharsPerLine = getWorkspaceSegmentSubtitlePreviewMaxCharsPerLine(style);
  const maxWordsPerLine = getWorkspaceSegmentSubtitlePreviewMaxWordsPerLine(style);
  const joinedWordLengths = words.map((word) => word.text.length);
  const prefixLengths = [0];

  for (const wordLength of joinedWordLengths) {
    prefixLengths.push(prefixLengths[prefixLengths.length - 1] + wordLength);
  }

  const getLineLength = (startIndex: number, endIndexExclusive: number) => {
    const wordCount = endIndexExclusive - startIndex;
    const joinedLength = prefixLengths[endIndexExclusive] - prefixLengths[startIndex];
    return joinedLength + Math.max(0, wordCount - 1);
  };

  const dp = new Array<number>(words.length + 1).fill(Number.POSITIVE_INFINITY);
  const nextBreak = new Array<number>(words.length + 1).fill(words.length);
  dp[words.length] = 0;

  for (let startIndex = words.length - 1; startIndex >= 0; startIndex -= 1) {
    const maxEndIndex = Math.min(words.length, startIndex + maxWordsPerLine);

    for (let endIndex = startIndex + 1; endIndex <= maxEndIndex; endIndex += 1) {
      const wordCount = endIndex - startIndex;
      const lineLength = getLineLength(startIndex, endIndex);

      if (wordCount > 1 && lineLength > maxCharsPerLine) {
        break;
      }

      const isLastLine = endIndex === words.length;
      const slack = Math.max(0, maxCharsPerLine - lineLength);
      let penalty = Math.pow(slack, isLastLine ? 1.6 : 2);

      if (wordCount === 1) {
        penalty += isLastLine ? 180 : 420;
      } else if (wordCount === 2 && !isLastLine) {
        penalty += 18;
      }

      const totalPenalty = penalty + dp[endIndex];

      if (totalPenalty < dp[startIndex]) {
        dp[startIndex] = totalPenalty;
        nextBreak[startIndex] = endIndex;
      }
    }
  }

  const lines: StudioSubtitlePreviewWord[][] = [];
  let currentIndex = 0;

  while (currentIndex < words.length) {
    const nextIndex = Math.max(currentIndex + 1, nextBreak[currentIndex] || words.length);
    lines.push(words.slice(currentIndex, nextIndex));
    currentIndex = nextIndex;
  }

  return lines;
};

const addWorkspaceSegmentSubtitlePreviewLeadingEllipsis = (word: StudioSubtitlePreviewWord): StudioSubtitlePreviewWord => ({
  ...word,
  text: word.text.startsWith("…") ? word.text : `…${word.text}`,
});

const addWorkspaceSegmentSubtitlePreviewTrailingEllipsis = (word: StudioSubtitlePreviewWord): StudioSubtitlePreviewWord => ({
  ...word,
  text: word.text.endsWith("…") ? word.text : `${word.text}…`,
});

const clampWorkspaceSegmentSubtitlePreviewLines = ({
  activeWordIndex,
  lines,
}: {
  activeWordIndex: number | null;
  lines: StudioSubtitlePreviewWord[][];
}) => {
  if (lines.length <= WORKSPACE_SEGMENT_SUBTITLE_PREVIEW_MAX_LINES) {
    return lines;
  }

  const maxVisibleLines = WORKSPACE_SEGMENT_SUBTITLE_PREVIEW_MAX_LINES;
  const anchorLineIndex =
    activeWordIndex === null
      ? 0
      : Math.max(
          0,
          lines.findIndex((line) => line.some((word) => word.sourceIndex === activeWordIndex)),
        );
  const preferredStartIndex = Math.max(0, anchorLineIndex - (maxVisibleLines - 2));
  const startIndex = Math.min(preferredStartIndex, Math.max(0, lines.length - maxVisibleLines));
  const endIndex = Math.min(lines.length, startIndex + maxVisibleLines);
  const visibleLines = lines.slice(startIndex, endIndex).map((line) => line.map((word) => ({ ...word })));

  if (startIndex > 0 && visibleLines[0]?.length) {
    visibleLines[0][0] = addWorkspaceSegmentSubtitlePreviewLeadingEllipsis(visibleLines[0][0]);
  }

  if (endIndex < lines.length) {
    const lastLine = visibleLines[visibleLines.length - 1];
    const lastWordIndex = lastLine?.length ? lastLine.length - 1 : -1;
    if (lastLine && lastWordIndex >= 0) {
      lastLine[lastWordIndex] = addWorkspaceSegmentSubtitlePreviewTrailingEllipsis(lastLine[lastWordIndex]);
    }
  }

  return visibleLines;
};

const resolveWorkspaceSegmentSpeechActiveWordIndex = (
  segment: WorkspaceSegmentEditorDraftSegment,
  textWords: string[],
  clipCurrentTime: number,
) => {
  if (segment.speechWords.length === 0 || textWords.length === 0) {
    return null;
  }

  const normalizedTextWords = textWords.map(normalizeWorkspaceSegmentSubtitleToken).filter(Boolean);
  const normalizedSpeechWords = segment.speechWords
    .map((word) => {
      const token = normalizeWorkspaceSegmentSubtitleToken(word.text);
      if (!token) {
        return null;
      }

      return {
        endTime: word.endTime,
        startTime: word.startTime,
        token,
      };
    })
    .filter(
      (
        word,
      ): word is {
        endTime: number;
        startTime: number;
        token: string;
      } => Boolean(word),
    );

  if (
    normalizedTextWords.length === 0 ||
    normalizedTextWords.length > normalizedSpeechWords.length ||
    normalizedTextWords.some((word, index) => word !== normalizedSpeechWords[index]?.token)
  ) {
    return null;
  }

  const baseline =
    (typeof segment.speechStartTime === "number" && Number.isFinite(segment.speechStartTime) ? segment.speechStartTime : null) ??
    (typeof segment.startTime === "number" && Number.isFinite(segment.startTime) ? segment.startTime : null) ??
    segment.speechWords[0]?.startTime ??
    0;
  const currentTime = Math.max(0, clipCurrentTime);
  const visibleWordCount = normalizedTextWords.length;

  for (let index = 0; index < visibleWordCount; index += 1) {
    const word = normalizedSpeechWords[index];
    if (!word) {
      return null;
    }

    const localStart = Math.max(0, word.startTime - baseline);
    const localEnd = Math.max(localStart, word.endTime - baseline);

    if (currentTime <= localEnd || currentTime < localStart) {
      return index;
    }
  }

  return visibleWordCount - 1;
};

const resolveWorkspaceSegmentSyntheticActiveWordIndex = (
  segment: WorkspaceSegmentEditorDraftSegment,
  wordCount: number,
  clipCurrentTime: number,
) => {
  if (wordCount <= 1) {
    return 0;
  }

  const effectiveDuration = getWorkspaceSegmentEditorPlaybackDuration(segment, wordCount);
  const progress = Math.min(0.999, Math.max(0, clipCurrentTime) / Math.max(0.001, effectiveDuration));
  return Math.min(wordCount - 1, Math.floor(progress * wordCount));
};

const resolveWorkspaceSegmentPreviewProgressWordIndex = (
  segment: WorkspaceSegmentEditorDraftSegment,
  textWords: string[],
  clipCurrentTime: number,
) => {
  const syntheticWordIndex = resolveWorkspaceSegmentSyntheticActiveWordIndex(segment, textWords.length, clipCurrentTime);
  const speechWordIndex = resolveWorkspaceSegmentSpeechActiveWordIndex(segment, textWords, clipCurrentTime);

  if (speechWordIndex === null) {
    return syntheticWordIndex;
  }

  // Some segments arrive with stalled word timings in the tail. Keep preview progress
  // advancing with the synthetic timer instead of freezing on the last good speech word.
  return Math.max(speechWordIndex, syntheticWordIndex);
};

const buildWorkspaceSegmentSubtitlePreviewLines = ({
  clipCurrentTime,
  isPlaying,
  segment,
  style,
}: {
  clipCurrentTime: number;
  isPlaying: boolean;
  segment: WorkspaceSegmentEditorDraftSegment;
  style: StudioSubtitleStyleOption;
}) => {
  const previewText = normalizeWorkspaceSegmentSubtitlePreviewText(String(segment.text ?? ""));
  const textWords = tokenizeWorkspaceSegmentSubtitleText(previewText);
  if (textWords.length === 0) {
    return [];
  }

  try {
    const progressWordIndex =
      clipCurrentTime > 0 || isPlaying
        ? resolveWorkspaceSegmentPreviewProgressWordIndex(segment, textWords, clipCurrentTime)
        : null;
    const activeWordIndex = isPlaying ? progressWordIndex : null;
    const visibleWords = textWords.map<StudioSubtitlePreviewWord>((word, index) => ({
      sourceIndex: index,
      state:
        activeWordIndex === null || !studioSubtitleStyleUsesAccentColor(style) || style.logicMode === "crossfade"
          ? "past"
          : index < activeWordIndex
            ? "past"
            : index === activeWordIndex
              ? "active"
              : "future",
      text: formatStudioSubtitlePreviewWord(word, style),
    }));

    return clampWorkspaceSegmentSubtitlePreviewLines({
      activeWordIndex: progressWordIndex,
      lines: splitWorkspaceSegmentSubtitlePreviewLines(visibleWords, style),
    });
  } catch {
    return clampWorkspaceSegmentSubtitlePreviewLines({
      activeWordIndex: null,
      lines: splitWorkspaceSegmentSubtitlePreviewLines(
        textWords.map<StudioSubtitlePreviewWord>((word, index) => ({
          sourceIndex: index,
          state: "past",
          text: formatStudioSubtitlePreviewWord(word, style),
        })),
        style,
      ),
    });
  }
};

const isWorkspaceSegmentDraftTextEdited = (segment: WorkspaceSegmentEditorDraftSegment) =>
  normalizeWorkspaceSegmentEditorTextForCompare(segment.text) !==
  normalizeWorkspaceSegmentEditorTextForCompare(segment.originalText);

const isWorkspaceSegmentDraftVisualEdited = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (isWorkspaceSegmentServerPhotoAnimationOverride(segment)) {
    return true;
  }

  if (segment.videoAction === "ai" || segment.videoAction === "photo_animation") {
    return Boolean(segment.aiVideoAsset);
  }

  if (segment.videoAction === "image_edit") {
    return Boolean(segment.imageEditAsset);
  }

  if (segment.videoAction === "ai_photo") {
    return Boolean(segment.aiPhotoAsset);
  }

  if (segment.videoAction === "custom") {
    return Boolean(segment.customVideo) || isWorkspaceSegmentCurrentVisualDifferentFromOriginal(segment);
  }

  if (isWorkspaceSegmentCurrentVisualDifferentFromOriginal(segment)) {
    return true;
  }

  if (
    segment.currentSourceKind !== "unknown" &&
    segment.originalSourceKind !== "unknown" &&
    segment.currentSourceKind !== segment.originalSourceKind
  ) {
    return true;
  }

  return segment.currentSourceKind === "upload" && segment.originalSourceKind !== "upload";
};

const getWorkspaceSegmentEditorPendingInsertedSegmentIndices = (
  draft: WorkspaceSegmentEditorDraftSession,
  baseline?: WorkspaceSegmentEditorDraftSession | null,
) => {
  if (!baseline) {
    return new Set<number>();
  }

  const baselineSegmentIndices = new Set(baseline.segments.map((segment) => segment.index));
  const pendingSegmentIndices = new Set<number>();

  draft.segments.forEach((segment) => {
    if (baselineSegmentIndices.has(segment.index)) {
      return;
    }

    if (!isWorkspaceSegmentDraftTextEdited(segment) && !isWorkspaceSegmentDraftVisualEdited(segment)) {
      pendingSegmentIndices.add(segment.index);
    }
  });

  return pendingSegmentIndices;
};

const createWorkspaceSegmentEditorComparableDraftSession = (
  draft: WorkspaceSegmentEditorDraftSession,
  baseline?: WorkspaceSegmentEditorDraftSession | null,
) => {
  const pendingInsertedSegmentIndices = getWorkspaceSegmentEditorPendingInsertedSegmentIndices(draft, baseline);
  if (pendingInsertedSegmentIndices.size === 0) {
    return draft;
  }

  return {
    ...draft,
    segments: draft.segments.filter((segment) => !pendingInsertedSegmentIndices.has(segment.index)),
  };
};

type WorkspaceSegmentEditorChecklistSettingId = "music" | "subtitle" | "voice";

type WorkspaceSegmentEditorChecklistItem =
  | {
      key: string;
      kind: "segment";
      label: string;
      resetText: boolean;
      resetVisual: boolean;
      segmentIndex: number;
    }
  | {
      key: string;
      kind: "global";
      label: string;
      resetOrder: boolean;
      resetSettingIds: WorkspaceSegmentEditorChecklistSettingId[];
    };

type WorkspaceSegmentEditorChecklistBuildOptions = {
  subtitleColorOptions?: StudioSubtitleColorOption[];
  subtitleStyleOptions?: StudioSubtitleStyleOption[];
};

const getWorkspaceSegmentEditorSettingsSnapshot = (session?: WorkspaceSegmentEditorDraftSession | null) => {
  const subtitleEnabled = normalizeWorkspaceSegmentEditorSetting(session?.subtitleType) !== "none";
  const voiceEnabled = normalizeWorkspaceSegmentEditorSetting(session?.voiceType) !== "none";

  return {
    musicType: normalizeWorkspaceSegmentEditorSetting(session?.musicType) ?? "ai",
    subtitleColorId: subtitleEnabled ? normalizeWorkspaceSegmentEditorSetting(session?.subtitleColor) ?? "purple" : null,
    subtitleEnabled,
    subtitleStyleId: subtitleEnabled ? normalizeWorkspaceSegmentEditorSetting(session?.subtitleStyle) ?? "modern" : null,
    voiceEnabled,
    voiceId: voiceEnabled ? normalizeWorkspaceSegmentEditorSetting(session?.voiceType) ?? "" : null,
  };
};

const formatWorkspaceSegmentEditorChecklistPreview = (value: string, maxChars = 52) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
};

const getWorkspaceSegmentEditorChecklistVoiceLabel = (voiceId?: string | null) => {
  const safeVoiceId = normalizeWorkspaceSegmentEditorSetting(voiceId);
  if (!safeVoiceId) {
    return "выключена";
  }

  for (const voiceOptions of Object.values(studioVoiceOptionsByLanguage)) {
    const matchedVoice = voiceOptions.find((voice) => voice.id === safeVoiceId);
    if (matchedVoice) {
      return `голос ${matchedVoice.label}`;
    }
  }

  return `голос ${safeVoiceId}`;
};

const getWorkspaceSegmentEditorChecklistMusicLabel = (musicType?: string | null) => {
  const safeMusicType = normalizeWorkspaceSegmentEditorSetting(musicType) ?? "ai";
  return studioMusicOptions.find((option) => option.id === safeMusicType)?.label ?? safeMusicType;
};

const getWorkspaceSegmentEditorChecklistSubtitleStyleLabel = (
  styleId: string | null,
  styleOptions?: StudioSubtitleStyleOption[],
) => {
  const safeStyleId = normalizeWorkspaceSegmentEditorSetting(styleId);
  if (!safeStyleId) {
    return "без стиля";
  }

  return styleOptions?.find((style) => style.id === safeStyleId)?.label ?? safeStyleId;
};

const getWorkspaceSegmentEditorChecklistSubtitleColorLabel = (
  colorId: string | null,
  colorOptions?: StudioSubtitleColorOption[],
) => {
  const safeColorId = normalizeWorkspaceSegmentEditorSetting(colorId);
  if (!safeColorId) {
    return "без цвета";
  }

  return colorOptions?.find((color) => color.id === safeColorId)?.label ?? safeColorId;
};

const getWorkspaceSegmentEditorChecklistTextLabel = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (!formatWorkspaceSegmentEditorChecklistPreview(segment.text)) {
    return "текст очищен";
  }

  return "обновлен текст";
};

const getWorkspaceSegmentEditorChecklistVisualLabel = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (latestVisualAction === "ai") {
    return "обновлено видео";
  }

  if (latestVisualAction === "photo_animation") {
    return "добавлено движение в фото";
  }

  if (latestVisualAction === "custom") {
    return segment.customVideo?.source === "media-library"
      ? "выбран визуал из медиатеки"
      : "добавлен свой визуал";
  }

  if (latestVisualAction === "image_edit") {
    return "отредактировано фото";
  }

  if (latestVisualAction === "ai_photo") {
    return "обновлено изображение";
  }

  return "обновлен визуал";
};

const lowerCaseWorkspaceChecklistLabelPrefix = (value: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  return `${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
};

const getWorkspaceSegmentEditorChecklistSubtitleLabel = (
  draftSettings: ReturnType<typeof getWorkspaceSegmentEditorSettingsSnapshot>,
  baselineSettings: ReturnType<typeof getWorkspaceSegmentEditorSettingsSnapshot>,
  options?: WorkspaceSegmentEditorChecklistBuildOptions,
) => {
  if (!baselineSettings.subtitleEnabled && !draftSettings.subtitleEnabled) {
    return "Субтитры: выключены";
  }

  if (!draftSettings.subtitleEnabled) {
    return "Субтитры: выключены";
  }

  const nextStyleLabel = getWorkspaceSegmentEditorChecklistSubtitleStyleLabel(
    draftSettings.subtitleStyleId,
    options?.subtitleStyleOptions,
  );
  const nextColorLabel = getWorkspaceSegmentEditorChecklistSubtitleColorLabel(
    draftSettings.subtitleColorId,
    options?.subtitleColorOptions,
  );

  if (!baselineSettings.subtitleEnabled) {
    return `Субтитры: включены, стиль ${nextStyleLabel}, цвет ${nextColorLabel}`;
  }

  const changes: string[] = [];
  if (draftSettings.subtitleStyleId !== baselineSettings.subtitleStyleId) {
    changes.push(`стиль ${nextStyleLabel}`);
  }

  if (draftSettings.subtitleColorId !== baselineSettings.subtitleColorId) {
    changes.push(`цвет ${nextColorLabel}`);
  }

  return changes.length > 0 ? `Субтитры: ${changes.join(", ")}` : `Субтитры: стиль ${nextStyleLabel}, цвет ${nextColorLabel}`;
};

const getWorkspaceSegmentEditorChecklistVoiceSettingsLabel = (
  draftSettings: ReturnType<typeof getWorkspaceSegmentEditorSettingsSnapshot>,
) =>
  `Озвучка: ${getWorkspaceSegmentEditorChecklistVoiceLabel(draftSettings.voiceId)}`;

const getWorkspaceSegmentEditorChecklistMusicSettingsLabel = (
  draftSettings: ReturnType<typeof getWorkspaceSegmentEditorSettingsSnapshot>,
) =>
  `Музыка: ${getWorkspaceSegmentEditorChecklistMusicLabel(draftSettings.musicType)}`;

const getWorkspaceSegmentEditorChecklistOrderLabel = (
  draft: WorkspaceSegmentEditorDraftSession,
  baseline: WorkspaceSegmentEditorDraftSession,
) => {
  const baselineSegmentIds = baseline.segments.map((segment) => segment.index).sort((left, right) => left - right);
  const draftSegmentIds = draft.segments.map((segment) => segment.index).sort((left, right) => left - right);
  const hasSameSegmentSet =
    baselineSegmentIds.length === draftSegmentIds.length &&
    baselineSegmentIds.every((segmentIndex, index) => segmentIndex === draftSegmentIds[index]);

  if (!hasSameSegmentSet) {
    return `Сегменты: было ${baseline.segments.length}, стало ${draft.segments.length}`;
  }

  return "Сегменты: изменен порядок";
};

const buildWorkspaceSegmentEditorChangeChecklist = (
  draft: WorkspaceSegmentEditorDraftSession,
  baseline?: WorkspaceSegmentEditorDraftSession | null,
  options?: WorkspaceSegmentEditorChecklistBuildOptions,
) => {
  const pendingInsertedSegmentIndices = getWorkspaceSegmentEditorPendingInsertedSegmentIndices(draft, baseline);
  const comparableDraft = createWorkspaceSegmentEditorComparableDraftSession(draft, baseline);
  const items: WorkspaceSegmentEditorChecklistItem[] = [];

  draft.segments.forEach((segment, index) => {
    if (pendingInsertedSegmentIndices.has(segment.index)) {
      return;
    }

    const segmentNumber = index + 1;
    const segmentChanges: string[] = [];
    let resetText = false;
    let resetVisual = false;

    if (isWorkspaceSegmentDraftTextEdited(segment)) {
      segmentChanges.push(getWorkspaceSegmentEditorChecklistTextLabel(segment));
      resetText = true;
    }

    if (isWorkspaceSegmentDraftVisualEdited(segment)) {
      segmentChanges.push(getWorkspaceSegmentEditorChecklistVisualLabel(segment));
      resetVisual = true;
    }

    if (segmentChanges.length > 0) {
      items.push({
        key: `segment-change:${segment.index}`,
        kind: "segment",
        label: `Сегмент ${segmentNumber}: ${segmentChanges.join(", ")}`,
        resetText,
        resetVisual,
        segmentIndex: segment.index,
      });
    }
  });

  const draftSettings = getWorkspaceSegmentEditorSettingsSnapshot(draft);
  const baselineSettings = getWorkspaceSegmentEditorSettingsSnapshot(baseline);
  const globalChanges: string[] = [];
  const resetSettingIds: WorkspaceSegmentEditorChecklistSettingId[] = [];
  let resetOrder = false;

  if (
    draftSettings.subtitleEnabled !== baselineSettings.subtitleEnabled ||
    draftSettings.subtitleStyleId !== baselineSettings.subtitleStyleId ||
    draftSettings.subtitleColorId !== baselineSettings.subtitleColorId
  ) {
    globalChanges.push(
      lowerCaseWorkspaceChecklistLabelPrefix(
        getWorkspaceSegmentEditorChecklistSubtitleLabel(draftSettings, baselineSettings, options),
      ),
    );
    resetSettingIds.push("subtitle");
  }

  if (draftSettings.voiceEnabled !== baselineSettings.voiceEnabled || draftSettings.voiceId !== baselineSettings.voiceId) {
    globalChanges.push(
      lowerCaseWorkspaceChecklistLabelPrefix(getWorkspaceSegmentEditorChecklistVoiceSettingsLabel(draftSettings)),
    );
    resetSettingIds.push("voice");
  }

  if (draftSettings.musicType !== baselineSettings.musicType) {
    globalChanges.push(
      lowerCaseWorkspaceChecklistLabelPrefix(getWorkspaceSegmentEditorChecklistMusicSettingsLabel(draftSettings)),
    );
    resetSettingIds.push("music");
  }

  if (baseline && !areWorkspaceSegmentEditorSegmentOrdersEqual(comparableDraft, baseline)) {
    globalChanges.push(lowerCaseWorkspaceChecklistLabelPrefix(getWorkspaceSegmentEditorChecklistOrderLabel(comparableDraft, baseline)));
    resetOrder = true;
  }

  if (globalChanges.length > 0) {
    items.push({
      key: "segment-settings:global",
      kind: "global",
      label: `Общее: ${globalChanges.join(", ")}`,
      resetOrder,
      resetSettingIds,
    });
  }

  return items;
};

const studioLanguageOptions: StudioLanguageOption[] = [
  {
    id: "ru",
    label: "Русский",
    description: "Русскоязычные голоса",
  },
  {
    id: "en",
    label: "Английский",
    description: "Англоязычные голоса",
  },
];

const studioEnglishVoicePreviewText =
  "Listen to how the voice sounds — its pace, intonation, and overall quality.";
const studioRussianVoicePreviewAssetVersion = "20260419-5";

const studioVoiceOptionsByLanguage: Record<StudioLanguage, StudioVoiceOption[]> = {
  ru: [
    {
      id: "Bys_24000",
      label: "Борис",
      description: "Базовый мужской голос",
      previewSampleUrl: `/voice-previews/boris.wav?v=${studioRussianVoicePreviewAssetVersion}`,
    },
    {
      id: "Nec_24000",
      label: "Наталья",
      description: "Базовый женский голос",
      previewSampleUrl: `/voice-previews/natalya.wav?v=${studioRussianVoicePreviewAssetVersion}`,
    },
    {
      id: "Tur_24000",
      label: "Тарас",
      description: "Уверенный мужской голос",
      previewSampleUrl: `/voice-previews/taras.wav?v=${studioRussianVoicePreviewAssetVersion}`,
    },
    {
      id: "May_24000",
      label: "Марфа",
      description: "Молодой женский голос",
      previewSampleUrl: `/voice-previews/marfa.wav?v=${studioRussianVoicePreviewAssetVersion}`,
    },
    {
      id: "Ost_24000",
      label: "Александра",
      description: "Естественный рекламный голос",
      previewSampleUrl: `/voice-previews/alexandra.wav?v=${studioRussianVoicePreviewAssetVersion}`,
    },
    {
      id: "Pon_24000",
      label: "Сергей",
      description: "Деловой мужской голос",
      previewSampleUrl: `/voice-previews/sergey.wav?v=${studioRussianVoicePreviewAssetVersion}`,
    },
    {
      id: "male-qn-jingying",
      label: "Алексей",
      description: "Выразительный мужской голос",
      previewSampleUrl: `/voice-previews/aleksey.wav?v=${studioRussianVoicePreviewAssetVersion}`,
    },
    {
      id: "Rma_24000",
      label: "Рма",
      description: "Более плотный и выразительный тембр",
      previewSampleUrl: `/voice-previews/rma.wav?v=${studioRussianVoicePreviewAssetVersion}`,
    },
    {
      id: "Rnu_24000",
      label: "Рну",
      description: "Спокойный мужской голос",
      previewSampleUrl: `/voice-previews/rnu.wav?v=${studioRussianVoicePreviewAssetVersion}`,
    },
  ],
  en: [
    {
      id: "Aiden",
      label: "Aiden",
      description: "Ясный американский мужской голос",
      previewPitch: 0.96,
      previewRate: 0.98,
      previewText: studioEnglishVoicePreviewText,
    },
    {
      id: "Ryan",
      label: "Ryan",
      description: "Энергичный мужской голос с сильным ритмом",
      previewPitch: 1,
      previewRate: 1.05,
      previewText: studioEnglishVoicePreviewText,
    },
    {
      id: "Serena",
      label: "Serena",
      description: "Теплый мягкий женский голос",
      previewPitch: 1.1,
      previewRate: 0.98,
      previewText: studioEnglishVoicePreviewText,
    },
    {
      id: "Vivian",
      label: "Vivian",
      description: "Яркий молодой женский голос с характером",
      previewPitch: 1.18,
      previewRate: 1.04,
      previewText: studioEnglishVoicePreviewText,
    },
    {
      id: "Uncle_Fu",
      label: "Uncle Fu",
      description: "Низкий зрелый мужской тембр",
      previewPitch: 0.82,
      previewRate: 0.9,
      previewText: studioEnglishVoicePreviewText,
    },
    {
      id: "Dylan",
      label: "Dylan",
      description: "Молодой мужской голос с пекинским оттенком",
      previewPitch: 0.93,
      previewRate: 1.02,
      previewText: studioEnglishVoicePreviewText,
    },
    {
      id: "Eric",
      label: "Eric",
      description: "Живой мужской голос с легкой хрипотцой",
      previewPitch: 0.91,
      previewRate: 1,
      previewText: studioEnglishVoicePreviewText,
    },
    {
      id: "Ono_Anna",
      label: "Ono Anna",
      description: "Легкий японский женский тембр",
      previewPitch: 1.2,
      previewRate: 1.08,
      previewText: studioEnglishVoicePreviewText,
    },
    {
      id: "Sohee",
      label: "Sohee",
      description: "Теплый корейский женский голос с эмоцией",
      previewPitch: 1.13,
      previewRate: 1,
      previewText: studioEnglishVoicePreviewText,
    },
  ],
};
const studioMusicOptions: StudioMusicOption[] = [
  {
    id: "ai",
    label: "Авто",
    description: "AI подберет музыку под ролик",
  },
  {
    id: "energetic",
    label: "Энергичная",
    description: "Для динамичных и продажных Shorts",
  },
  {
    id: "calm",
    label: "Спокойная",
    description: "Для экспертной подачи и размеренного темпа",
  },
  {
    id: "business",
    label: "Деловая",
    description: "Для продуктов, сервисов и B2B-подачи",
  },
  {
    id: "upbeat",
    label: "Оптимистичная",
    description: "Для легких продающих и lifestyle роликов",
  },
  {
    id: "inspirational",
    label: "Вдохновляющая",
    description: "Для историй, роста и мотивационных тем",
  },
  {
    id: "dramatic",
    label: "Драматичная",
    description: "Для сильного хука и эмоционального накала",
  },
  {
    id: "tech",
    label: "Технологичная",
    description: "Для AI, SaaS и цифровых продуктов",
  },
  {
    id: "luxury",
    label: "Люксовая",
    description: "Для премиальных брендов и дорогой подачи",
  },
  {
    id: "fun",
    label: "Веселая",
    description: "Для UGC, мемов и вирусных форматов",
  },
  {
    id: "custom",
    label: "Своя музыка",
    description: "Загрузите свой .mp3, .wav или .m4a",
  },
  {
    id: "none",
    label: "Без музыки",
    description: "Оставить только голос и видео",
  },
];
const studioMusicStyleOptions = studioMusicOptions.filter(
  (option): option is StudioMusicOption & { id: Exclude<StudioMusicType, "ai" | "custom" | "none"> } =>
    !["ai", "custom", "none"].includes(option.id),
);
const studioVideoOptions: StudioVideoOption[] = [
  {
    id: "standard",
    label: "Стандартный",
    description: "Анимированные ИИ фото + стоки",
  },
  {
    id: "ai_photo",
    label: "Только ИИ фото",
    description: "Только анимированные ИИ фото, без стоков",
  },
  {
    id: "ai_video",
    label: "ИИ видео",
    description: "Полностью ИИ-режим для всех сцен",
  },
  {
    id: "custom",
    label: "Свой визуал",
    description: "Загрузите свое фото или видео",
  },
];
const workspaceLocalExampleGoalOptions: Array<{
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
    description: "Факты, разборы, объяснения и ролики с экспертной подачей.",
    id: "expert",
    label: "🎓 Экспертиза",
  },
];
const projectPosterCache = new Map<string, string>();
const projectPosterCaptureRequests = new Map<string, Promise<string>>();
const projectPosterCaptureQueue: Array<() => void> = [];
const PROJECT_POSTER_CACHE_MAX_ITEMS = 72;
const PROJECT_POSTER_CAPTURE_CONCURRENCY = 4;
const PROJECT_POSTER_CAPTURE_MAX_DIMENSION = 1280;
const PROJECT_POSTER_CAPTURE_QUALITY = 0.9;
let activeProjectPosterCaptureCount = 0;
const PROJECTS_REQUEST_TIMEOUT_MS = 25_000;
const MEDIA_LIBRARY_REQUEST_TIMEOUT_MS = 25_000;
const SEGMENT_EDITOR_REQUEST_TIMEOUT_MS = 20_000;

const getStudioCompactMenuStyle = ({
  estimatedMenuHeight,
  minWidth,
  preferredWidth,
  triggerRect,
}: {
  estimatedMenuHeight: number;
  minWidth: number;
  preferredWidth?: number;
  triggerRect: DOMRect;
}): CSSProperties => {
  const safePreferredWidth = preferredWidth ?? triggerRect.width;
  const menuWidth = Math.min(
    Math.max(minWidth, Math.round(Math.max(triggerRect.width, safePreferredWidth))),
    window.innerWidth - 32,
  );
  const nextLeft = Math.min(Math.max(16, triggerRect.left), window.innerWidth - menuWidth - 16);
  const availableAbove = Math.max(96, triggerRect.top - 24);
  const availableBelow = Math.max(96, window.innerHeight - triggerRect.bottom - 24);
  const shouldOpenDownward = availableAbove < estimatedMenuHeight && availableBelow > availableAbove;

  if (shouldOpenDownward) {
    const nextTop = Math.min(window.innerHeight - 16, triggerRect.bottom + 12);
    return {
      left: `${nextLeft}px`,
      top: `${nextTop}px`,
      minWidth: `${menuWidth}px`,
      maxHeight: `${availableBelow}px`,
      transform: "none",
    };
  }

  const nextTop = Math.max(16, triggerRect.top - 12);
  return {
    left: `${nextLeft}px`,
    top: `${nextTop}px`,
    minWidth: `${menuWidth}px`,
    maxHeight: `${availableAbove}px`,
    transform: "translateY(-100%)",
  };
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result) {
        reject(new Error("Не удалось подготовить файл."));
        return;
      }

      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });

const readBlobAsDataUrl = (blob: Blob) =>
  readFileAsDataUrl(
    new File([blob], "studio-asset", {
      type: blob.type || "application/octet-stream",
    }),
  );

type StudioUploadableAsset =
  | Pick<StudioBrandLogoFile, "assetId" | "dataUrl" | "file" | "fileName" | "mimeType" | "objectUrl">
  | Pick<StudioCustomMusicFile, "assetId" | "dataUrl" | "file" | "fileName" | "objectUrl">
  | Pick<StudioCustomVideoFile, "assetId" | "dataUrl" | "file" | "fileName" | "mimeType" | "objectUrl" | "remoteUrl">;

const fetchStudioUploadSourceBlob = async (sourceUrl: string, fallbackMessage: string) => {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`${fallbackMessage} (${response.status}).`);
  }

  return response.blob();
};

const buildStudioUploadFileFromAsset = async (
  asset: StudioUploadableAsset | null | undefined,
  options: {
    fallbackFileName: string;
    fallbackMimeType?: string | null;
  },
) => {
  if (!asset) {
    return null;
  }

  const fileName = String(asset.fileName || options.fallbackFileName).trim() || options.fallbackFileName;
  const fallbackMimeType =
    "mimeType" in asset && typeof asset.mimeType === "string" && asset.mimeType.trim()
      ? asset.mimeType.trim()
      : String(options.fallbackMimeType || "").trim() || "application/octet-stream";
  const sourceFile = asset.file;
  if (sourceFile) {
    if (sourceFile.name === fileName && (sourceFile.type || fallbackMimeType) === sourceFile.type) {
      return sourceFile;
    }

    return new File([sourceFile], fileName, {
      type: sourceFile.type || fallbackMimeType,
    });
  }

  const dataUrl = typeof asset.dataUrl === "string" ? asset.dataUrl.trim() : "";
  const remoteUrl = "remoteUrl" in asset && typeof asset.remoteUrl === "string" ? asset.remoteUrl.trim() : "";
  const objectUrl = typeof asset.objectUrl === "string" ? asset.objectUrl.trim() : "";
  const sourceUrl = dataUrl || remoteUrl || objectUrl;
  if (!sourceUrl) {
    return null;
  }

  const blob = await fetchStudioUploadSourceBlob(sourceUrl, "Не удалось подготовить файл для загрузки");
  return new File([blob], fileName, {
    type: blob.type || fallbackMimeType,
  });
};

const createStudioObjectUrl = (file: Blob) => {
  if (typeof URL === "undefined") {
    throw new Error("Object URL is not available in this environment.");
  }

  return URL.createObjectURL(file);
};

const buildWorkspaceMediaAssetProxyUrl = (assetId: number) => `/api/workspace/media-assets/${Math.trunc(assetId)}`;
const buildWorkspaceMediaAssetPlaybackUrl = (assetId: number) =>
  `/api/workspace/media-assets/${Math.trunc(assetId)}/playback`;
const WORKSPACE_MEDIA_ASSET_RAW_PROXY_ROUTE_PATTERN =
  /^\/api\/(?:workspace\/media-assets\/\d+|media\/\d+\/download)(?:[/?#]|$)/i;
const WORKSPACE_VIDEO_FILE_NAME_PATTERN = /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i;

const getWorkspaceMediaAssetResolvedPreviewUrl = (
  asset:
    | {
        assetId?: number | null;
        fileName?: string | null;
        mimeType?: string | null;
        remoteUrl?: string | null;
      }
    | null
    | undefined,
) => {
  const assetId =
    Number.isFinite(Number(asset?.assetId)) && Number(asset?.assetId) > 0
      ? Math.trunc(Number(asset?.assetId))
      : null;
  const fileName = String(asset?.fileName ?? "").trim();
  const mimeType = String(asset?.mimeType ?? "").trim().toLowerCase();
  const remoteUrl = String(asset?.remoteUrl ?? "").trim();
  const isVideoAsset =
    mimeType.startsWith("video/") ||
    WORKSPACE_VIDEO_FILE_NAME_PATTERN.test(fileName);

  if (assetId && isVideoAsset && (!remoteUrl || WORKSPACE_MEDIA_ASSET_RAW_PROXY_ROUTE_PATTERN.test(remoteUrl))) {
    return buildWorkspaceMediaAssetPlaybackUrl(assetId);
  }

  if (remoteUrl) {
    return remoteUrl;
  }

  return assetId ? buildWorkspaceMediaAssetProxyUrl(assetId) : null;
};

const revokeStudioObjectUrl = (value: string | null | undefined) => {
  if (typeof URL === "undefined") {
    return;
  }

  const normalized = String(value ?? "").trim();
  if (normalized.startsWith("blob:")) {
    URL.revokeObjectURL(normalized);
  }
};

const getStudioCustomAssetPreviewUrl = (
  asset:
    | Pick<StudioBrandLogoFile, "assetId" | "dataUrl" | "fileName" | "mimeType" | "objectUrl">
    | Pick<StudioCustomMusicFile, "assetId" | "dataUrl" | "objectUrl">
    | Pick<StudioCustomVideoFile, "assetId" | "dataUrl" | "fileName" | "mimeType" | "objectUrl" | "remoteUrl">
    | null
    | undefined,
) => {
  const objectUrl = typeof asset?.objectUrl === "string" ? asset.objectUrl.trim() : "";
  if (objectUrl) {
    return objectUrl;
  }

  const dataUrl = typeof asset?.dataUrl === "string" ? asset.dataUrl.trim() : "";
  if (dataUrl) {
    return dataUrl;
  }

  const remoteUrl = getWorkspaceMediaAssetResolvedPreviewUrl({
    assetId:
      Number.isFinite(Number((asset as { assetId?: unknown } | null | undefined)?.assetId)) &&
      Number((asset as { assetId?: unknown } | null | undefined)?.assetId) > 0
        ? Math.trunc(Number((asset as { assetId?: unknown }).assetId))
        : null,
    fileName:
      typeof (asset as { fileName?: unknown } | null | undefined)?.fileName === "string"
        ? String((asset as { fileName?: string }).fileName)
        : "",
    mimeType:
      typeof (asset as { mimeType?: unknown } | null | undefined)?.mimeType === "string"
        ? String((asset as { mimeType?: string }).mimeType)
        : "",
    remoteUrl:
    typeof (asset as { remoteUrl?: unknown } | null | undefined)?.remoteUrl === "string"
        ? String((asset as { remoteUrl?: string }).remoteUrl)
        : "",
  });
  if (remoteUrl) {
    return remoteUrl;
  }

  return null;
};

const getStudioCustomAssetPosterUrl = (
  asset: Pick<StudioCustomVideoFile, "posterUrl"> | null | undefined,
) => {
  const posterUrl = typeof asset?.posterUrl === "string" ? asset.posterUrl.trim() : "";
  return posterUrl || null;
};

const getWorkspaceMediaAssetFileName = (asset: WorkspaceMediaAssetRef | null | undefined, fallbackName: string) => {
  const storageFileName = String(asset?.storageKey ?? "").split("/").pop()?.trim();
  const downloadFileName = String(asset?.downloadPath ?? asset?.downloadUrl ?? asset?.playbackUrl ?? "").split("/").pop()?.split("?")[0]?.trim();
  return storageFileName || downloadFileName || fallbackName;
};

const createStudioCustomVideoFileFromWorkspaceMediaAsset = (
  asset: WorkspaceMediaAssetRef | null | undefined,
  options: {
    fallbackFileName: string;
    fallbackMimeType?: string;
    fallbackRemoteUrl?: string | null;
    posterUrl?: string | null;
  },
): StudioCustomVideoFile | null => {
  const assetId =
    Number.isFinite(Number(asset?.assetId)) && Number(asset?.assetId) > 0
      ? Math.trunc(Number(asset?.assetId))
      : undefined;
  const fileName = getWorkspaceMediaAssetFileName(asset, options.fallbackFileName);
  const remoteUrl = getWorkspaceMediaAssetResolvedPreviewUrl({
    assetId: assetId ?? null,
    fileName,
    mimeType: String(asset?.mimeType ?? "").trim() || options.fallbackMimeType || "video/mp4",
    remoteUrl:
    String(asset?.downloadPath ?? "").trim() ||
    String(asset?.downloadUrl ?? "").trim() ||
    String(asset?.playbackUrl ?? "").trim() ||
    String(asset?.originalUrl ?? "").trim() ||
    String(options.fallbackRemoteUrl ?? "").trim() ||
      "",
  });

  if (!assetId && !remoteUrl) {
    return null;
  }

  return {
    assetId,
    fileName,
    fileSize: 0,
    mimeType: String(asset?.mimeType ?? "").trim() || options.fallbackMimeType || "video/mp4",
    posterUrl: String(options.posterUrl ?? "").trim() || undefined,
    remoteUrl: remoteUrl || undefined,
    source: "media-library",
  };
};

const isStudioSegmentPhotoAnimationPosterUrl = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue.includes("/api/studio/segment-photo-animation/jobs/") && normalizedValue.includes("/poster");
};

const isStudioSegmentAiVideoPosterUrl = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue.includes("/api/studio/segment-ai-video/jobs/") && normalizedValue.includes("/poster");
};

const getWorkspaceAiVideoPreferredPosterUrl = (
  segment: WorkspaceSegmentEditorDraftSegment,
  asset: Pick<StudioCustomVideoFile, "posterUrl"> | null | undefined,
) => {
  const assetPosterUrl = getStudioCustomAssetPosterUrl(asset);
  if (!assetPosterUrl || isStudioSegmentAiVideoPosterUrl(assetPosterUrl)) {
    return null;
  }

  if (assetPosterUrl && getWorkspaceSegmentStillPreviewUrls(segment).includes(assetPosterUrl)) {
    return null;
  }

  return assetPosterUrl;
};

const getWorkspacePhotoAnimationSourcePosterUrl = (segment: WorkspaceSegmentEditorDraftSegment) =>
  getStudioCustomAssetPreviewUrl(getWorkspaceSegmentPhotoAnimationSourceAsset(segment)) ??
  getWorkspaceSegmentPreferredStillPreviewUrl(segment);

const getWorkspacePhotoAnimationPreferredPosterUrl = (
  segment: WorkspaceSegmentEditorDraftSegment,
  asset: Pick<StudioCustomVideoFile, "posterUrl"> | null | undefined,
) => {
  const sourcePosterUrl = getWorkspacePhotoAnimationSourcePosterUrl(segment);
  if (sourcePosterUrl) {
    return sourcePosterUrl;
  }

  const assetPosterUrl = getStudioCustomAssetPosterUrl(asset);
  if (!assetPosterUrl || isStudioSegmentPhotoAnimationPosterUrl(assetPosterUrl)) {
    return null;
  }

  return assetPosterUrl;
};

const resolveStudioCustomAssetDataUrl = async (
  asset:
    | Pick<StudioBrandLogoFile, "dataUrl" | "file">
    | Pick<StudioCustomMusicFile, "dataUrl" | "file">
    | Pick<StudioCustomVideoFile, "dataUrl" | "file" | "remoteUrl">
    | null
    | undefined,
) => {
  const dataUrl = typeof asset?.dataUrl === "string" ? asset.dataUrl.trim() : "";
  if (dataUrl) {
    return dataUrl;
  }

  if (asset?.file) {
    return readFileAsDataUrl(asset.file);
  }

  const remoteUrl =
    typeof (asset as { remoteUrl?: unknown } | null | undefined)?.remoteUrl === "string"
      ? String((asset as { remoteUrl?: string }).remoteUrl).trim()
      : "";
  if (remoteUrl) {
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      throw new Error(`Не удалось загрузить удаленный файл (${response.status}).`);
    }

    return readBlobAsDataUrl(await response.blob());
  }

  return undefined;
};

const appendStudioFormValue = (
  formData: FormData,
  key: string,
  value: boolean | number | string | null | undefined,
) => {
  if (value === null || value === undefined) {
    return;
  }

  formData.append(key, String(value));
};

type StudioDirectMediaUploadAssetPayload = {
  assetId?: number | string | null;
  id?: number | string | null;
};

type StudioDirectMediaUploadPayload = {
  asset?: StudioDirectMediaUploadAssetPayload | null;
  upload?: {
    headers?: Record<string, string> | null;
    method?: string | null;
    url?: string | null;
  } | null;
};

type StudioDirectMediaUploadResponse = {
  data?: StudioDirectMediaUploadPayload | null;
  error?: string;
};

type StudioDirectMediaUploadSession = {
  assetId: number;
  method: string;
  mimeType: string;
  uploadHeaders: Record<string, string>;
  uploadUrl: string;
};

const STUDIO_DIRECT_MEDIA_UPLOAD_TIMEOUT_MS = 90_000;

const getStudioDirectUploadAssetId = (payload: StudioDirectMediaUploadPayload | null | undefined) => {
  const rawAssetId = payload?.asset?.assetId ?? payload?.asset?.id;
  const numeric = Number(rawAssetId);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
};

const createStudioDirectUploadTimeoutController = (timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    clear: () => globalThis.clearTimeout(timeoutId),
    signal: controller.signal,
  };
};

const initializeStudioMediaFileUpload = async (
  file: File,
  options: {
    fileName: string;
    kind: string;
    language: StudioLanguage;
    mediaType: "audio" | "photo" | "video";
    mimeType?: string | null;
    projectId?: number | null;
    role: string;
    segmentIndex?: number | null;
  },
) => {
  const mimeType = String(options.mimeType || file.type || "application/octet-stream").trim() || "application/octet-stream";
  const initResponse = await fetch("/api/studio/media-upload/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: options.fileName || file.name,
      kind: options.kind,
      language: options.language,
      mediaType: options.mediaType,
      mimeType,
      projectId: options.projectId ?? undefined,
      role: options.role,
      segmentIndex: options.segmentIndex ?? undefined,
      sizeBytes: file.size,
    }),
  });
  const initPayload = (await initResponse.json().catch(() => null)) as StudioDirectMediaUploadResponse | null;
  if (!initResponse.ok || !initPayload?.data) {
    throw new Error(initPayload?.error ?? "Не удалось создать upload-сессию.");
  }

  const assetId = getStudioDirectUploadAssetId(initPayload.data);
  const uploadUrl = String(initPayload.data.upload?.url ?? "").trim();
  if (!assetId || !uploadUrl) {
    throw new Error("Upload-сессия не вернула assetId или upload URL.");
  }

  const uploadHeaders = Object.fromEntries(
    Object.entries(initPayload.data.upload?.headers ?? {}).filter(([, value]) => typeof value === "string" && value.trim()),
  );
  if (!Object.keys(uploadHeaders).some((key) => key.toLowerCase() === "content-type")) {
    uploadHeaders["content-type"] = mimeType;
  }

  return {
    assetId,
    method: String(initPayload.data.upload?.method ?? "PUT").trim() || "PUT",
    mimeType,
    uploadHeaders,
    uploadUrl,
  } satisfies StudioDirectMediaUploadSession;
};

const uploadStudioMediaFileViaDirectSession = async (
  file: File,
  session: StudioDirectMediaUploadSession,
) => {
  const timeout = createStudioDirectUploadTimeoutController(STUDIO_DIRECT_MEDIA_UPLOAD_TIMEOUT_MS);

  try {
    const uploadResponse = await fetch(session.uploadUrl, {
      body: file,
      headers: session.uploadHeaders,
      method: session.method,
      signal: timeout.signal,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Storage upload failed (${uploadResponse.status}).`);
  }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Загрузка файла заняла слишком много времени. Попробуйте еще раз.");
    }

    throw error;
  } finally {
    timeout.clear();
  }
};

const completeStudioMediaFileUpload = async (
  assetId: number,
  options: {
    language: StudioLanguage;
    projectId?: number | null;
    role: string;
    segmentIndex?: number | null;
  },
) => {
  const completeResponse = await fetch("/api/studio/media-upload/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assetId,
      language: options.language,
      projectId: options.projectId ?? undefined,
      role: options.role,
      segmentIndex: options.segmentIndex ?? undefined,
    }),
  });
  const completePayload = (await completeResponse.json().catch(() => null)) as StudioDirectMediaUploadResponse | null;
  if (!completeResponse.ok || !completePayload?.data) {
    throw new Error(completePayload?.error ?? "Не удалось подтвердить upload.");
  }

  return getStudioDirectUploadAssetId(completePayload.data) ?? assetId;
};

const uploadStudioMediaFileToStorage = async (
  file: File,
  options: {
    fileName: string;
    kind: string;
    language: StudioLanguage;
    mediaType: "audio" | "photo" | "video";
    mimeType?: string | null;
    projectId?: number | null;
    role: string;
    segmentIndex?: number | null;
  },
) => {
  const session = await initializeStudioMediaFileUpload(file, options);
  await uploadStudioMediaFileViaDirectSession(file, session);
  return completeStudioMediaFileUpload(session.assetId, options);
};

const ensureStudioUploadedAssetId = async (
  asset: StudioUploadableAsset | null | undefined,
  options: {
    fallbackFileName: string;
    fallbackMimeType?: string | null;
    kind: string;
    language: StudioLanguage;
    mediaType: "audio" | "photo" | "video";
    projectId?: number | null;
    role: string;
    segmentIndex?: number | null;
  },
) => {
  const existingAssetId =
    asset && Number.isFinite(Number(asset.assetId)) && Number(asset.assetId) > 0
      ? Math.trunc(Number(asset.assetId))
      : null;
  if (existingAssetId) {
    return existingAssetId;
  }

  const uploadFile = await buildStudioUploadFileFromAsset(asset, {
    fallbackFileName: options.fallbackFileName,
    fallbackMimeType: options.fallbackMimeType,
  });
  if (!uploadFile) {
    return null;
  }

  return uploadStudioMediaFileToStorage(uploadFile, {
    fileName: uploadFile.name || options.fallbackFileName,
    kind: options.kind,
    language: options.language,
    mediaType: options.mediaType,
    mimeType: uploadFile.type || options.fallbackMimeType,
    projectId: options.projectId,
    role: options.role,
    segmentIndex: options.segmentIndex,
  });
};

const getProjectPosterCacheValue = (videoUrl: string | null | undefined) => {
  const normalized = String(videoUrl ?? "").trim();
  if (!normalized) {
    return null;
  }

  const cachedPoster = projectPosterCache.get(normalized) ?? null;
  if (!cachedPoster) {
    return null;
  }

  projectPosterCache.delete(normalized);
  projectPosterCache.set(normalized, cachedPoster);
  return cachedPoster;
};

const setProjectPosterCacheValue = (videoUrl: string | null | undefined, posterUrl: string | null | undefined) => {
  const normalizedVideoUrl = String(videoUrl ?? "").trim();
  const normalizedPosterUrl = String(posterUrl ?? "").trim();
  if (!normalizedVideoUrl || !normalizedPosterUrl) {
    return;
  }

  if (projectPosterCache.has(normalizedVideoUrl)) {
    projectPosterCache.delete(normalizedVideoUrl);
  }

  projectPosterCache.set(normalizedVideoUrl, normalizedPosterUrl);

  while (projectPosterCache.size > PROJECT_POSTER_CACHE_MAX_ITEMS) {
    const oldestKey = projectPosterCache.keys().next().value;
    if (typeof oldestKey !== "string") {
      break;
    }

    projectPosterCache.delete(oldestKey);
  }
};

const getPosterCaptureSize = (width: number, height: number) => {
  const longestSide = Math.max(width, height);

  if (!Number.isFinite(longestSide) || longestSide <= PROJECT_POSTER_CAPTURE_MAX_DIMENSION) {
    return {
      height,
      width,
    };
  }

  const scale = PROJECT_POSTER_CAPTURE_MAX_DIMENSION / longestSide;
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
};

const flushProjectPosterCaptureQueue = () => {
  while (activeProjectPosterCaptureCount < PROJECT_POSTER_CAPTURE_CONCURRENCY && projectPosterCaptureQueue.length > 0) {
    const nextTask = projectPosterCaptureQueue.shift();
    if (!nextTask) {
      break;
    }

    activeProjectPosterCaptureCount += 1;
    nextTask();
  }
};

const enqueueProjectPosterCapture = (task: () => Promise<string>) =>
  new Promise<string>((resolve, reject) => {
    const runTask = () => {
      void task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeProjectPosterCaptureCount = Math.max(0, activeProjectPosterCaptureCount - 1);
          flushProjectPosterCaptureQueue();
        });
    };

    projectPosterCaptureQueue.push(runTask);
    flushProjectPosterCaptureQueue();
  });

const isSupportedStudioMusicFile = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase();
  return STUDIO_ALLOWED_CUSTOM_MUSIC_EXTENSIONS.some((extension) => normalized.endsWith(extension));
};

const truncateStudioCustomAssetName = (value: string, maxChars = STUDIO_CUSTOM_ASSET_NAME_MAX_CHARS) => {
  const normalized = value.trim();

  if (!normalized || normalized.length <= maxChars) {
    return normalized;
  }

  const lastDotIndex = normalized.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === normalized.length - 1) {
    return `${normalized.slice(0, Math.max(1, maxChars - 3))}...`;
  }

  const extension = normalized.slice(lastDotIndex);
  const baseMaxChars = maxChars - extension.length - 3;

  if (baseMaxChars <= 0) {
    return `${normalized.slice(0, Math.max(1, maxChars - 3))}...`;
  }

  return `${normalized.slice(0, baseMaxChars)}...${extension}`;
};

const getStudioMusicChipValue = (musicType: StudioMusicType, customMusicFile: StudioCustomMusicFile | null) => {
  if (musicType === "custom") {
    return customMusicFile ? truncateStudioCustomAssetName(customMusicFile.fileName) : "Своя музыка";
  }

  return studioMusicOptions.find((option) => option.id === musicType)?.label ?? "Авто";
};

const isSupportedStudioVideoFile = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase();
  return STUDIO_ALLOWED_SEGMENT_CUSTOM_VISUAL_EXTENSIONS.some((extension) => normalized.endsWith(extension));
};

const isSupportedStudioBrandLogoFile = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase();
  return STUDIO_ALLOWED_SEGMENT_CUSTOM_IMAGE_EXTENSIONS.some((extension) => normalized.endsWith(extension));
};

const getStudioBrandLogoMimeType = (file: File) => {
  if (file.type) {
    return file.type;
  }

  const normalized = file.name.trim().toLowerCase();
  if (normalized.endsWith(".avif")) return "image/avif";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
};

const getStudioBrandTextPreview = (value: string) => {
  const normalized = value.trim();
  return normalized ? truncateStudioCustomAssetName(normalized, 20) : "";
};

const hasStudioBranding = (options: { brandLogoFile?: StudioBrandLogoFile | null; brandText?: string | null }) =>
  Boolean(options.brandLogoFile) || Boolean(String(options.brandText ?? "").trim());

const getStudioBrandSummary = (options: { brandLogoFile?: StudioBrandLogoFile | null; brandText?: string | null }) => {
  const normalizedText = String(options.brandText ?? "").trim();
  if (options.brandLogoFile && normalizedText) {
    return `${truncateStudioCustomAssetName(options.brandLogoFile.fileName, 18)} + текст`;
  }

  if (options.brandLogoFile) {
    return truncateStudioCustomAssetName(options.brandLogoFile.fileName, 22);
  }

  if (normalizedText) {
    return `Текст: ${getStudioBrandTextPreview(normalizedText)}`;
  }

  return "Лого или текст бренда";
};

const isSupportedWorkspaceSegmentVisualFile = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase();
  return STUDIO_ALLOWED_SEGMENT_CUSTOM_VISUAL_EXTENSIONS.some((extension) => normalized.endsWith(extension));
};

const isWorkspaceSegmentImageFile = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase();
  return STUDIO_ALLOWED_SEGMENT_CUSTOM_IMAGE_EXTENSIONS.some((extension) => normalized.endsWith(extension));
};

const getWorkspaceSegmentCustomVisualMimeType = (file: File) => {
  if (file.type) {
    return file.type;
  }

  return isWorkspaceSegmentImageFile(file.name) ? "image/jpeg" : "video/mp4";
};

const getWorkspaceSegmentCustomPreviewKind = (customVideo: StudioCustomVideoFile | null): WorkspaceSegmentPreviewKind | null => {
  if (!customVideo) {
    return null;
  }

  if (customVideo.mimeType.startsWith("image/") || isWorkspaceSegmentImageFile(customVideo.fileName)) {
    return "image";
  }

  return "video";
};

const getReferencedStudioObjectUrls = (options: {
  brandLogoFile?: StudioBrandLogoFile | null;
  customMusicFile?: StudioCustomMusicFile | null;
  customVideoFile?: StudioCustomVideoFile | null;
  segmentEditorAppliedSession?: WorkspaceSegmentEditorDraftSession | null;
  segmentEditorDraft?: WorkspaceSegmentEditorDraftSession | null;
}) => {
  const referencedUrls = new Set<string>();

  const register = (value: string | null | undefined) => {
    const normalized = String(value ?? "").trim();
    if (normalized.startsWith("blob:")) {
      referencedUrls.add(normalized);
    }
  };

  register(options.brandLogoFile?.objectUrl);
  register(options.customMusicFile?.objectUrl);
  register(options.customVideoFile?.objectUrl);

  [options.segmentEditorDraft, options.segmentEditorAppliedSession].forEach((session) => {
    session?.segments.forEach((segment) => {
      register(segment.customVideo?.objectUrl);
      register(segment.aiPhotoAsset?.objectUrl);
      register(segment.aiVideoAsset?.objectUrl);
    });
  });

  return referencedUrls;
};

const normalizeWorkspaceSegmentAiPhotoPrompt = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeWorkspaceSegmentMediaType = (value: unknown): WorkspaceSegmentMediaType =>
  String(value ?? "").trim().toLowerCase() === "photo" ? "photo" : "video";

const getWorkspaceSegmentAiPhotoPromptPrefill = (segment: Pick<WorkspaceSegmentEditorSegment, "text">) =>
  String(segment.text ?? "").trim();

const isWorkspaceSegmentAiPhotoReady = (segment: Pick<
  WorkspaceSegmentEditorDraftSegment,
  "aiPhotoAsset" | "aiPhotoGeneratedFromPrompt" | "aiPhotoPrompt"
>) =>
  Boolean(segment.aiPhotoAsset) &&
  normalizeWorkspaceSegmentAiPhotoPrompt(segment.aiPhotoGeneratedFromPrompt) ===
    normalizeWorkspaceSegmentAiPhotoPrompt(segment.aiPhotoPrompt);

const normalizeWorkspaceSegmentImageEditPrompt = normalizeWorkspaceSegmentAiPhotoPrompt;
const getWorkspaceSegmentImageEditPromptPrefill = getWorkspaceSegmentAiPhotoPromptPrefill;

const isWorkspaceSegmentImageEditReady = (segment: Pick<
  WorkspaceSegmentEditorDraftSegment,
  "imageEditAsset" | "imageEditGeneratedFromPrompt" | "imageEditPrompt"
>) =>
  Boolean(segment.imageEditAsset) &&
  normalizeWorkspaceSegmentImageEditPrompt(segment.imageEditGeneratedFromPrompt) ===
    normalizeWorkspaceSegmentImageEditPrompt(segment.imageEditPrompt);

const normalizeWorkspaceSegmentAiVideoPrompt = normalizeWorkspaceSegmentAiPhotoPrompt;

const getWorkspaceSegmentAiVideoPromptPrefill = getWorkspaceSegmentAiPhotoPromptPrefill;

const isWorkspaceSegmentAiVideoReady = (segment: Pick<
  WorkspaceSegmentEditorDraftSegment,
  "aiVideoAsset" | "aiVideoGeneratedFromPrompt" | "aiVideoGeneratedMode" | "aiVideoPrompt"
>, mode?: WorkspaceSegmentAiVideoMode) =>
  Boolean(segment.aiVideoAsset) &&
  (!mode || segment.aiVideoGeneratedMode === mode) &&
  normalizeWorkspaceSegmentAiVideoPrompt(segment.aiVideoGeneratedFromPrompt) ===
    normalizeWorkspaceSegmentAiVideoPrompt(segment.aiVideoPrompt);

const hasWorkspaceSegmentDisplayAiVideoAsset = (segment: Pick<
  WorkspaceSegmentEditorDraftSegment,
  "aiVideoAsset" | "aiVideoGeneratedMode" | "videoAction"
>, mode?: WorkspaceSegmentAiVideoMode) =>
  Boolean(segment.aiVideoAsset) &&
  (!mode ||
    segment.aiVideoGeneratedMode === mode ||
    (!segment.aiVideoGeneratedMode &&
      ((mode === "ai_video" && segment.videoAction === "ai") ||
        (mode === "photo_animation" && segment.videoAction === "photo_animation"))));

const getWorkspaceSegmentDisplayAiVideoAssetUrl = (segment: Pick<
  WorkspaceSegmentEditorDraftSegment,
  "aiVideoAsset" | "aiVideoGeneratedMode" | "videoAction"
>, mode?: WorkspaceSegmentAiVideoMode) =>
  hasWorkspaceSegmentDisplayAiVideoAsset(segment, mode) ? getStudioCustomAssetPreviewUrl(segment.aiVideoAsset) : null;

const getWorkspaceSegmentDraftVisualAsset = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (latestVisualAction === "ai" || latestVisualAction === "photo_animation") {
    return segment.aiVideoAsset;
  }

  if (latestVisualAction === "image_edit") {
    return segment.imageEditAsset;
  }

  if (latestVisualAction === "custom") {
    return segment.customVideo;
  }

  if (latestVisualAction === "ai_photo") {
    return segment.aiPhotoAsset;
  }

  return null;
};

const getWorkspaceSegmentOriginalPhotoAsset = (segment: WorkspaceSegmentEditorDraftSegment): StudioCustomVideoFile | null => {
  const hasOriginalPhotoAsset = isWorkspacePhotoMediaAsset(segment.originalAsset);
  if (segment.mediaType !== "photo" && !hasOriginalPhotoAsset) {
    return null;
  }

  const originalRemoteUrl =
    segment.originalExternalPreviewUrl ??
    segment.originalExternalPlaybackUrl ??
    segment.originalPreviewUrl ??
    segment.originalPlaybackUrl ??
    null;
  const remoteUrl = hasOriginalPhotoAsset
    ? originalRemoteUrl ??
      getWorkspaceSegmentPreferredStillPreviewUrl(segment) ??
      segment.currentExternalPreviewUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentPlaybackUrl ??
      ""
    : getWorkspaceSegmentPreferredStillPreviewUrl(segment)
      ?? segment.currentPreviewUrl
      ?? segment.originalPreviewUrl
      ?? segment.currentPlaybackUrl
      ?? segment.originalPlaybackUrl
      ?? segment.currentExternalPreviewUrl
      ?? segment.originalExternalPreviewUrl
      ?? "";
  if (!remoteUrl) {
    return null;
  }

  return {
    fileName: `segment-photo-${segment.index + 1}.jpg`,
    fileSize: 0,
    mimeType: "image/jpeg",
    remoteUrl,
  };
};

const getWorkspaceSegmentCurrentPhotoAsset = (segment: WorkspaceSegmentEditorDraftSegment): StudioCustomVideoFile | null => {
  const currentStillUrl =
    filterWorkspaceStillAssetUrls([
      segment.currentExternalPreviewUrl,
      segment.currentExternalPlaybackUrl,
      segment.currentPreviewUrl,
      segment.currentPlaybackUrl,
    ])[0] ?? null;

  if (!currentStillUrl) {
    return null;
  }

  if (
    !isWorkspacePhotoMediaAsset(segment.currentAsset) &&
    !isWorkspaceSegmentCurrentVisualDifferentFromOriginal(segment) &&
    segment.mediaType !== "photo"
  ) {
    return null;
  }

  return {
    fileName: `segment-current-photo-${segment.index + 1}.jpg`,
    fileSize: 0,
    mimeType: "image/jpeg",
    remoteUrl: currentStillUrl,
  };
};

const createWorkspaceSegmentStillFrameAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
  remoteUrl: string,
): StudioCustomVideoFile => ({
  fileName: `segment-frame-${segment.index + 1}.jpg`,
  fileSize: 0,
  mimeType: "image/jpeg",
  remoteUrl,
});

const getWorkspaceSegmentFallbackStillFrameAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
): StudioCustomVideoFile | null => {
  const stillUrl =
    getWorkspaceSegmentPreferredStillPreviewUrl(segment) ||
    segment.currentPreviewUrl ||
    segment.originalPreviewUrl ||
    "";

  return stillUrl ? createWorkspaceSegmentStillFrameAsset(segment, stillUrl) : null;
};

const getWorkspaceSegmentLatestEditablePhotoAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
): StudioCustomVideoFile | null => {
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);
  const originalPhotoAsset = getWorkspaceSegmentOriginalPhotoAsset(segment);
  const currentPhotoAsset = getWorkspaceSegmentCurrentPhotoAsset(segment);

  if (latestVisualAction === "custom") {
    if (getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "image" && segment.customVideo) {
      return segment.customVideo;
    }

    return currentPhotoAsset ?? originalPhotoAsset ?? getWorkspaceSegmentFallbackStillFrameAsset(segment);
    }

  if (latestVisualAction === "image_edit") {
    if (getWorkspaceSegmentCustomPreviewKind(segment.imageEditAsset) === "image" && segment.imageEditAsset) {
      return segment.imageEditAsset;
    }

    return (
      currentPhotoAsset ??
      (getWorkspaceSegmentCustomPreviewKind(segment.aiPhotoAsset) === "image" ? segment.aiPhotoAsset : null) ??
      originalPhotoAsset ??
      getWorkspaceSegmentFallbackStillFrameAsset(segment)
    );
  }

  if (latestVisualAction === "ai_photo") {
    if (getWorkspaceSegmentCustomPreviewKind(segment.aiPhotoAsset) === "image" && segment.aiPhotoAsset) {
      return segment.aiPhotoAsset;
    }

    return currentPhotoAsset ?? originalPhotoAsset ?? getWorkspaceSegmentFallbackStillFrameAsset(segment);
  }

  if (latestVisualAction === "photo_animation") {
    if (getWorkspaceSegmentCustomPreviewKind(segment.photoAnimationSourceAsset) === "image" && segment.photoAnimationSourceAsset) {
      return segment.photoAnimationSourceAsset;
    }

    if (getWorkspaceSegmentCustomPreviewKind(segment.imageEditAsset) === "image" && segment.imageEditAsset) {
      return segment.imageEditAsset;
    }

    if (getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "image" && segment.customVideo) {
      return segment.customVideo;
    }

    if (getWorkspaceSegmentCustomPreviewKind(segment.aiPhotoAsset) === "image" && segment.aiPhotoAsset) {
      return segment.aiPhotoAsset;
    }

    return currentPhotoAsset ?? originalPhotoAsset ?? getWorkspaceSegmentFallbackStillFrameAsset(segment);
  }

  if (latestVisualAction === "original") {
    return currentPhotoAsset ?? originalPhotoAsset ?? getWorkspaceSegmentFallbackStillFrameAsset(segment);
  }

      return null;
};

const getWorkspaceSegmentPhotoAnimationSourceAsset = (segment: WorkspaceSegmentEditorDraftSegment) => {
  return getWorkspaceSegmentLatestEditablePhotoAsset(segment);
};

const shouldForceFreshPhotoAnimationSourceUpload = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  sourceAsset: StudioCustomVideoFile | null | undefined,
) => {
  if (!segment || !sourceAsset || getWorkspaceSegmentCustomPreviewKind(sourceAsset) !== "image") {
    return false;
  }

  const hasUploadableBytes = Boolean(sourceAsset.file || sourceAsset.dataUrl || sourceAsset.objectUrl);
  if (!hasUploadableBytes) {
    return false;
  }

  if (sourceAsset.source === "media-library" || sourceAsset.source === "upload") {
    return false;
  }

  return (
    (segment.videoAction === "ai_photo" && segment.aiPhotoAsset === sourceAsset) ||
    (segment.videoAction === "image_edit" && segment.imageEditAsset === sourceAsset) ||
    (segment.videoAction === "photo_animation" && segment.photoAnimationSourceAsset === sourceAsset)
  );
};

const getWorkspacePhotoAnimationUploadSourceAsset = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  sourceAsset: StudioCustomVideoFile | null | undefined,
) => {
  if (!sourceAsset) {
      return null;
    }

  if (!shouldForceFreshPhotoAnimationSourceUpload(segment, sourceAsset)) {
    return sourceAsset;
  }

    return {
    ...sourceAsset,
    assetId: undefined,
    };
};

const getWorkspaceSegmentImageEditSource = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const sourceAsset = getWorkspaceSegmentLatestEditablePhotoAsset(segment);
  if (!sourceAsset) {
      return null;
    }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);
  const defaultFileName =
    latestVisualAction === "image_edit"
      ? `segment-image-edit-${segment.index + 1}.png`
      : latestVisualAction === "ai_photo"
        ? `segment-ai-photo-${segment.index + 1}.png`
        : latestVisualAction === "custom"
          ? `segment-visual-${segment.index + 1}.png`
          : `segment-photo-${segment.index + 1}.png`;

    return {
    asset: sourceAsset,
    fileName: sourceAsset.fileName || defaultFileName,
  };
};

const getWorkspaceSegmentImageUpscaleSource = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const sourceAsset = getWorkspaceSegmentLatestEditablePhotoAsset(segment);
  if (!sourceAsset) {
      return null;
    }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);
  const target =
    latestVisualAction === "ai_photo" && sourceAsset === segment.aiPhotoAsset
      ? ("ai_photo" as const)
      : latestVisualAction === "image_edit" && sourceAsset === segment.imageEditAsset
        ? ("image_edit" as const)
        : latestVisualAction === "custom" && sourceAsset === segment.customVideo
          ? ("custom" as const)
          : ("original" as const);

  const defaultFileName =
    target === "ai_photo"
      ? `segment-ai-photo-${segment.index + 1}.png`
      : target === "image_edit"
        ? `segment-image-edit-${segment.index + 1}.png`
        : target === "custom"
          ? `segment-visual-${segment.index + 1}.png`
          : `segment-photo-${segment.index + 1}.png`;

    return {
    asset: sourceAsset,
    fileName: sourceAsset.fileName || defaultFileName,
    target,
  };
};

const createWorkspaceSegmentGeneratedImageAsset = (
  asset: Pick<StudioCustomVideoFile, "assetId" | "dataUrl" | "fileName" | "fileSize" | "mimeType">,
): StudioCustomVideoFile => ({
  assetId: asset.assetId,
  dataUrl: asset.dataUrl,
  fileName: asset.fileName,
  fileSize: asset.fileSize,
  mimeType: asset.mimeType,
});

const applyWorkspaceSegmentUpscaledImageAsset = (
  segment: WorkspaceSegmentEditorDraftSegment,
  asset: Pick<StudioCustomVideoFile, "assetId" | "dataUrl" | "fileName" | "fileSize" | "mimeType">,
): WorkspaceSegmentEditorDraftSegment => {
  const nextAsset = createWorkspaceSegmentGeneratedImageAsset(asset);

  if (segment.videoAction === "ai_photo" && getWorkspaceSegmentCustomPreviewKind(segment.aiPhotoAsset) === "image") {
    return {
      ...segment,
      aiPhotoAsset: nextAsset,
      videoAction: "ai_photo",
    };
  }

  if (segment.videoAction === "image_edit" && getWorkspaceSegmentCustomPreviewKind(segment.imageEditAsset) === "image") {
    return {
      ...segment,
      imageEditAsset: nextAsset,
      videoAction: "image_edit",
    };
  }

  return {
    ...segment,
    customVideo: nextAsset,
    videoAction: "custom",
  };
};

const canWorkspaceSegmentUsePhotoEditingTools = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
) =>
  Boolean(
    segment &&
      getWorkspaceSegmentSelectedVisualPreviewKind(segment) === "image",
  );

const canWorkspaceSegmentAnimatePhoto = (segment: WorkspaceSegmentEditorDraftSegment | null | undefined) =>
  Boolean(segment && canWorkspaceSegmentUsePhotoEditingTools(segment) && getWorkspaceSegmentPhotoAnimationSourceAsset(segment));

const canWorkspaceSegmentEditPhoto = (segment: WorkspaceSegmentEditorDraftSegment | null | undefined) =>
  Boolean(segment && canWorkspaceSegmentUsePhotoEditingTools(segment) && getWorkspaceSegmentImageEditSource(segment));

const canWorkspaceSegmentUpscalePhoto = (segment: WorkspaceSegmentEditorDraftSegment | null | undefined) =>
  Boolean(segment && canWorkspaceSegmentUsePhotoEditingTools(segment) && getWorkspaceSegmentImageUpscaleSource(segment));

const getWorkspaceSegmentVisualModalDefaultTab = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentVisualModalTab => {
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  return latestVisualAction === "custom"
    ? segment.customVideo?.source === "media-library"
      ? "library"
      : "upload"
    : latestVisualAction === "image_edit" && canWorkspaceSegmentEditPhoto(segment)
      ? "image_edit"
    : latestVisualAction === "ai_photo"
      ? "ai_photo"
    : latestVisualAction === "photo_animation" && canWorkspaceSegmentAnimatePhoto(segment)
      ? "photo_animation"
      : "ai_video";
};

const isWorkspaceSegmentVisualModalTabAllowed = (
  segment: WorkspaceSegmentEditorDraftSegment,
  tab: WorkspaceSegmentVisualModalTab,
) => {
  switch (tab) {
    case "photo_animation":
      return canWorkspaceSegmentAnimatePhoto(segment);
    case "image_edit":
      return canWorkspaceSegmentEditPhoto(segment);
    case "image_upscale":
      return canWorkspaceSegmentUpscalePhoto(segment);
    default:
      return true;
  }
};

const resolveWorkspaceSegmentVisualModalTab = (
  segment: WorkspaceSegmentEditorDraftSegment,
  tab: WorkspaceSegmentVisualModalTab,
): WorkspaceSegmentVisualModalTab =>
  isWorkspaceSegmentVisualModalTabAllowed(segment, tab) ? tab : getWorkspaceSegmentVisualModalDefaultTab(segment);

const getWorkspaceSegmentPromptSceneModeForTab = (tab: WorkspaceSegmentVisualModalTab): "create" | "edit" => {
  switch (tab) {
    case "photo_animation":
    case "image_edit":
    case "image_upscale":
      return "edit";
    default:
      return "create";
  }
};

const getWorkspaceSegmentVisualTabForPromptSceneMode = (
  segment: WorkspaceSegmentEditorDraftSegment,
  mode: "create" | "edit",
  currentTab: WorkspaceSegmentVisualModalTab,
): WorkspaceSegmentVisualModalTab => {
  const candidateTabs =
    mode === "create"
      ? (["ai_video", "ai_photo", "library", "upload"] as const)
      : (["photo_animation", "image_edit", "image_upscale"] as const);

  if (candidateTabs.some((tab) => tab === currentTab)) {
    return resolveWorkspaceSegmentVisualModalTab(segment, currentTab);
  }

  const firstAllowedTab = candidateTabs.find((tab) => isWorkspaceSegmentVisualModalTabAllowed(segment, tab));
  return firstAllowedTab ?? getWorkspaceSegmentVisualModalDefaultTab(segment);
};

const getWorkspaceSegmentPhotoToolUnavailableReason = (
  segment: WorkspaceSegmentEditorDraftSegment | null | undefined,
  fallbackReason: string,
) => {
  if (!segment) {
    return fallbackReason;
  }

  if (getWorkspaceSegmentSelectedVisualPreviewKind(segment) !== "image") {
    return "Сначала выберите фото";
  }

  return fallbackReason;
};

const getWorkspaceSegmentFallbackPreviewKind = (
  segment: Pick<WorkspaceSegmentEditorDraftSegment, "mediaType">,
): WorkspaceSegmentPreviewKind => (segment.mediaType === "photo" ? "image" : "video");

const getWorkspaceSegmentSelectedVisualPreviewKind = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentPreviewKind => {
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (latestVisualAction === "ai" || latestVisualAction === "photo_animation") {
    return "video";
  }

  return (
    getWorkspaceSegmentCustomPreviewKind(getWorkspaceSegmentDraftVisualAsset(segment)) ??
    getWorkspaceSegmentFallbackPreviewKind(segment)
  );
};

const getWorkspaceSegmentPreviewKind = (segment: WorkspaceSegmentEditorDraftSegment): WorkspaceSegmentPreviewKind => {
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  // Fresh segment sessions can promote a photo segment to a server-backed animation
  // before the local `videoAction` catches up. The carousel must treat that case as
  // video, otherwise it falls back to synthetic pan/zoom playback over the source photo.
  if (latestVisualAction === "ai") {
    return getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "ai_video")
      ? "video"
      : getWorkspaceSegmentFallbackPreviewKind(segment);
  }

  if (latestVisualAction === "photo_animation") {
    return getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "photo_animation") ||
      isWorkspaceSegmentServerPhotoAnimationOverride(segment) ||
      isWorkspacePhotoAnimationMediaAsset(segment.currentAsset)
      ? "video"
      : getWorkspaceSegmentFallbackPreviewKind(segment);
  }

  return (
    getWorkspaceSegmentCustomPreviewKind(getWorkspaceSegmentDraftVisualAsset(segment)) ??
    getWorkspaceSegmentFallbackPreviewKind(segment)
  );
};

const normalizeWorkspaceMediaAssetToken = (value: string | null | undefined) =>
  String(value ?? "").trim().toLowerCase();

const getWorkspaceMediaAssetSignature = (asset: WorkspaceMediaAssetRef | null | undefined) =>
  [
    asset?.kind,
    asset?.role,
    asset?.sourceKind,
    asset?.storageKey,
    asset?.downloadPath,
    asset?.downloadUrl,
    asset?.originalUrl,
  ]
    .map(normalizeWorkspaceMediaAssetToken)
    .filter(Boolean)
    .join(" ");

const isWorkspacePhotoAnimationMediaAsset = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  const signature = getWorkspaceMediaAssetSignature(asset);
  return (
    signature.includes("photo_animation") ||
    signature.includes("photo-animation") ||
    signature.includes("image_to_video") ||
    signature.includes("image-to-video") ||
    signature.includes("animate_photo") ||
    signature.includes("animate-photo")
  );
};

const isWorkspacePhotoMediaAsset = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  const mediaType = normalizeWorkspaceMediaAssetToken(asset?.mediaType);
  const mimeType = normalizeWorkspaceMediaAssetToken(asset?.mimeType);
  return mediaType === "photo" || mediaType === "image" || mimeType.startsWith("image/");
};

const isWorkspaceVideoMediaAsset = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  const mediaType = normalizeWorkspaceMediaAssetToken(asset?.mediaType);
  const mimeType = normalizeWorkspaceMediaAssetToken(asset?.mimeType);
  return mediaType === "video" || mimeType.startsWith("video/");
};

const getWorkspaceMediaAssetIdentityKey = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  const assetId = Number(asset?.assetId);
  if (Number.isFinite(assetId) && assetId > 0) {
    return `asset:${Math.trunc(assetId)}`;
  }

  const storageKey = String(asset?.storageKey ?? "").trim();
  if (storageKey) {
    return `storage:${storageKey}`;
  }

  const urlIdentity = [
    asset?.downloadPath,
    asset?.downloadUrl,
    asset?.playbackUrl,
    asset?.originalUrl,
  ].find((value) => String(value ?? "").trim());
  return urlIdentity ? `url:${String(urlIdentity).trim()}` : null;
};

const isWorkspaceSegmentCurrentVisualDifferentFromOriginal = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const currentAssetIdentity = getWorkspaceMediaAssetIdentityKey(segment.currentAsset);
  const originalAssetIdentity = getWorkspaceMediaAssetIdentityKey(segment.originalAsset);

  if (currentAssetIdentity && originalAssetIdentity) {
    return currentAssetIdentity !== originalAssetIdentity;
  }

  if (currentAssetIdentity || originalAssetIdentity) {
    return Boolean(
      segment.currentPlaybackUrl ||
        segment.currentPreviewUrl ||
        segment.currentExternalPlaybackUrl ||
        segment.currentExternalPreviewUrl,
    );
  }

  const currentUrlIdentity = [
    segment.currentExternalPlaybackUrl,
    segment.currentExternalPreviewUrl,
    segment.currentPlaybackUrl,
    segment.currentPreviewUrl,
  ].find((value) => String(value ?? "").trim());
  const originalUrlIdentity = [
    segment.originalExternalPlaybackUrl,
    segment.originalExternalPreviewUrl,
    segment.originalPlaybackUrl,
    segment.originalPreviewUrl,
  ].find((value) => String(value ?? "").trim());

  return Boolean(
    currentUrlIdentity &&
      originalUrlIdentity &&
      String(currentUrlIdentity).trim() !== String(originalUrlIdentity).trim(),
  );
};

const hasWorkspaceSegmentCurrentVideoReference = (segment: WorkspaceSegmentEditorDraftSegment) =>
  Boolean(
    segment.currentPlaybackUrl ||
      segment.currentExternalPlaybackUrl ||
      segment.currentPreviewUrl ||
      segment.currentExternalPreviewUrl,
  );

const isWorkspaceSegmentServerPhotoAnimationOverride = (segment: WorkspaceSegmentEditorDraftSegment) =>
  Boolean(
    isWorkspaceSegmentCurrentVisualDifferentFromOriginal(segment) &&
      isWorkspacePhotoMediaAsset(segment.originalAsset) &&
      (isWorkspaceVideoMediaAsset(segment.currentAsset) || segment.mediaType === "video") &&
      hasWorkspaceSegmentCurrentVideoReference(segment),
  );

const hasWorkspaceSegmentPlayableVideoUrl = (segment: WorkspaceSegmentEditorDraftSegment) =>
  Boolean(
    getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "photo_animation") ||
      getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "ai_video") ||
      segment.currentPlaybackUrl ||
      segment.currentExternalPlaybackUrl ||
      segment.currentPreviewUrl ||
      segment.currentExternalPreviewUrl ||
      segment.originalPlaybackUrl ||
      segment.originalExternalPlaybackUrl ||
      segment.originalPreviewUrl ||
      segment.originalExternalPreviewUrl,
  );

const getWorkspaceSegmentLatestVisualAction = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentEditorVideoAction => {
  if (segment.videoAction === "custom" && segment.customVideo) {
    return "custom";
  }

  if (segment.videoAction === "photo_animation") {
    return "photo_animation";
  }

  if (segment.aiVideoGeneratedMode === "photo_animation" && hasWorkspaceSegmentPlayableVideoUrl(segment)) {
    return "photo_animation";
  }

  if (isWorkspacePhotoAnimationMediaAsset(segment.currentAsset)) {
    return "photo_animation";
  }

  if (isWorkspaceSegmentServerPhotoAnimationOverride(segment)) {
    return "photo_animation";
  }

  if (
    segment.videoAction === "original" &&
    segment.mediaType === "video" &&
    isWorkspacePhotoMediaAsset(segment.originalAsset) &&
    (segment.currentSourceKind === "ai_generated" || segment.currentAsset?.sourceKind === "ai_generated") &&
    hasWorkspaceSegmentPlayableVideoUrl(segment)
  ) {
    return "photo_animation";
  }

  if (
    segment.videoAction === "image_edit" &&
    segment.mediaType === "video" &&
    hasWorkspaceSegmentPlayableVideoUrl(segment)
  ) {
    return "photo_animation";
  }

  return segment.videoAction;
};

const getStudioVideoChipValue = (
  videoMode: StudioVideoMode,
  customVideoFile: StudioCustomVideoFile | null,
  options?: { brandLogoFile?: StudioBrandLogoFile | null; brandText?: string | null },
) => {
  const visualLabel =
    videoMode === "custom"
      ? customVideoFile
        ? truncateStudioCustomAssetName(customVideoFile.fileName)
        : "Свой визуал"
      : studioVideoOptions.find((option) => option.id === videoMode)?.label ?? "Стандартный";

  return hasStudioBranding(options ?? {}) ? `${visualLabel} + бренд` : visualLabel;
};

const getRequiredCreditsForVideoMode = (videoMode: StudioVideoMode) => {
  void videoMode;
  return STUDIO_VIDEO_GENERATION_CREDIT_COST;
};

const cloneStudioCustomVideoFile = (value: StudioCustomVideoFile | null) => (value ? { ...value } : null);
const cloneWorkspaceMediaAssetRef = (value: WorkspaceMediaAssetRef | null) => (value ? { ...value } : null);
const cloneWorkspaceProject = (project: WorkspaceProject): WorkspaceProject => ({
  ...project,
  finalAsset: project.finalAsset ? { ...project.finalAsset } : null,
  hashtags: [...project.hashtags],
  youtubePublication: project.youtubePublication ? { ...project.youtubePublication } : null,
});

const cloneWorkspaceSegmentEditorLocalizedTextMap = (
  value: WorkspaceSegmentEditorLocalizedTextMap | null | undefined,
  fallbackText: string,
): WorkspaceSegmentEditorLocalizedTextMap => {
  const nextMap: WorkspaceSegmentEditorLocalizedTextMap = {};

  (["ru", "en"] as const).forEach((language) => {
    if (typeof value?.[language] === "string") {
      nextMap[language] = value[language];
    }
  });

  if (typeof nextMap.ru !== "string") {
    nextMap.ru = fallbackText;
  }

  return nextMap;
};

const cloneWorkspaceSegmentEditorDraftSegment = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentEditorDraftSegment => ({
  ...normalizeWorkspaceSegmentEditorSegmentUrls(segment),
  aiPhotoAsset: cloneStudioCustomVideoFile(segment.aiPhotoAsset),
  aiPhotoGeneratedFromPrompt:
    typeof segment.aiPhotoGeneratedFromPrompt === "string" && segment.aiPhotoGeneratedFromPrompt.trim()
      ? segment.aiPhotoGeneratedFromPrompt
      : null,
  aiPhotoPrompt: typeof segment.aiPhotoPrompt === "string" ? segment.aiPhotoPrompt : "",
  aiPhotoPromptInitialized: Boolean(segment.aiPhotoPromptInitialized),
  aiVideoAsset: cloneStudioCustomVideoFile(segment.aiVideoAsset),
  aiVideoGeneratedMode:
    segment.aiVideoGeneratedMode === "photo_animation" || segment.aiVideoGeneratedMode === "ai_video"
      ? segment.aiVideoGeneratedMode
      : null,
  aiVideoGeneratedFromPrompt:
    typeof segment.aiVideoGeneratedFromPrompt === "string" && segment.aiVideoGeneratedFromPrompt.trim()
      ? segment.aiVideoGeneratedFromPrompt
      : null,
  aiVideoPrompt: typeof segment.aiVideoPrompt === "string" ? segment.aiVideoPrompt : "",
  aiVideoPromptInitialized: Boolean(segment.aiVideoPromptInitialized),
  customVideo: cloneStudioCustomVideoFile(segment.customVideo),
  imageEditAsset: cloneStudioCustomVideoFile(segment.imageEditAsset),
  imageEditGeneratedFromPrompt:
    typeof segment.imageEditGeneratedFromPrompt === "string" && segment.imageEditGeneratedFromPrompt.trim()
      ? segment.imageEditGeneratedFromPrompt
      : null,
  imageEditPrompt: typeof segment.imageEditPrompt === "string" ? segment.imageEditPrompt : "",
  imageEditPromptInitialized: Boolean(segment.imageEditPromptInitialized),
  mediaType: normalizeWorkspaceSegmentMediaType(segment.mediaType),
  originalText: typeof segment.originalText === "string" ? segment.originalText : segment.text,
  originalTextByLanguage: cloneWorkspaceSegmentEditorLocalizedTextMap(
    segment.originalTextByLanguage,
    typeof segment.originalText === "string" ? segment.originalText : segment.text,
  ),
    photoAnimationSourceAsset: cloneStudioCustomVideoFile(segment.photoAnimationSourceAsset),
  textByLanguage: cloneWorkspaceSegmentEditorLocalizedTextMap(segment.textByLanguage, segment.text),
    visualReset: Boolean(segment.visualReset),
});

const areWorkspaceSegmentEditorLocalizedTextMapsEqual = (
  left: WorkspaceSegmentEditorLocalizedTextMap | null | undefined,
  right: WorkspaceSegmentEditorLocalizedTextMap | null | undefined,
) =>
  (["ru", "en"] as const).every((language) => {
    const leftValue = typeof left?.[language] === "string" ? left[language] : undefined;
    const rightValue = typeof right?.[language] === "string" ? right[language] : undefined;
    return leftValue === rightValue;
  });

const normalizeWorkspaceSegmentEditorUrl = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
};

const ADSFLOW_MEDIA_DOWNLOAD_URL_PATTERN = /\/api\/media\/(\d+)\/download(?:[/?#]|$)/i;

const normalizeWorkspaceSegmentMediaAssetProxyUrl = (value: unknown) => {
  const normalizedUrl = normalizeWorkspaceSegmentEditorUrl(value);
  if (!normalizedUrl) {
    return null;
  }

  const matchedPath = normalizedUrl.match(ADSFLOW_MEDIA_DOWNLOAD_URL_PATTERN);
  if (matchedPath) {
    return `/api/workspace/media-assets/${matchedPath[1]}`;
  }

  try {
    const resolvedUrl = new URL(normalizedUrl);
    const matchedAbsolutePath = resolvedUrl.pathname.match(ADSFLOW_MEDIA_DOWNLOAD_URL_PATTERN);
    if (matchedAbsolutePath) {
      return `/api/workspace/media-assets/${matchedAbsolutePath[1]}`;
    }
  } catch {
    return normalizedUrl;
  }

  return normalizedUrl;
};

const normalizeWorkspaceSegmentSourceKind = (value: unknown): WorkspaceSegmentSourceKind => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "ai_generated" || normalized === "stock" || normalized === "upload") {
    return normalized;
  }

  return "unknown";
};

const getUniqueWorkspaceSegmentPreviewUrls = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      values
        .map((value) => normalizeWorkspaceSegmentEditorUrl(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );

const getWorkspaceSegmentStillPreviewUrls = (
  segment: Pick<
    WorkspaceSegmentEditorDraftSegment,
    | "currentExternalPlaybackUrl"
    | "currentExternalPreviewUrl"
    | "currentPlaybackUrl"
    | "currentPreviewUrl"
    | "originalExternalPlaybackUrl"
    | "originalExternalPreviewUrl"
    | "originalPlaybackUrl"
    | "originalPreviewUrl"
  >,
) =>
  filterWorkspaceStillAssetUrls([
    segment.currentExternalPreviewUrl,
    segment.originalExternalPreviewUrl,
    segment.currentExternalPlaybackUrl,
    segment.originalExternalPlaybackUrl,
    segment.currentPreviewUrl,
    segment.originalPreviewUrl,
    segment.currentPlaybackUrl,
    segment.originalPlaybackUrl,
  ]);

const getWorkspaceSegmentPreferredStillPreviewUrl = (
  segment: Pick<
    WorkspaceSegmentEditorDraftSegment,
    | "currentExternalPlaybackUrl"
    | "currentExternalPreviewUrl"
    | "currentPlaybackUrl"
    | "currentPreviewUrl"
    | "originalExternalPlaybackUrl"
    | "originalExternalPreviewUrl"
    | "originalPlaybackUrl"
    | "originalPreviewUrl"
  >,
) => getWorkspaceSegmentStillPreviewUrls(segment)[0] ?? null;

const hasWorkspaceSegmentOriginalVisualReference = (segment: WorkspaceSegmentEditorDraftSegment) =>
  Boolean(
    segment.originalAsset ||
      segment.originalPlaybackUrl ||
      segment.originalPreviewUrl ||
      segment.originalExternalPlaybackUrl ||
      segment.originalExternalPreviewUrl,
  );

const getWorkspaceSegmentOriginalMediaType = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentMediaType => {
  if (isWorkspacePhotoMediaAsset(segment.originalAsset)) {
    return "photo";
  }

  if (isWorkspaceVideoMediaAsset(segment.originalAsset)) {
    return "video";
  }

  if (filterWorkspaceStillAssetUrls([
    segment.originalExternalPreviewUrl,
    segment.originalExternalPlaybackUrl,
    segment.originalPreviewUrl,
    segment.originalPlaybackUrl,
  ]).length > 0) {
    return "photo";
  }

  return segment.mediaType;
};

const isWorkspaceSegmentOriginalProxyUrl = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim();
  return normalized.includes("/api/workspace/project-segment-video") && normalized.includes("source=original");
};

const isWorkspaceMediaAssetProxyUrl = (value: string | null | undefined) =>
  /\/api\/workspace\/media-assets\/\d+(?:[/?#]|$)/i.test(String(value ?? "").trim());

const hasWorkspaceSegmentMediaAssetCurrentVisualUrl = (segment: WorkspaceSegmentEditorDraftSegment) =>
  [
    segment.currentPlaybackUrl,
    segment.currentPreviewUrl,
    segment.currentExternalPlaybackUrl,
    segment.currentExternalPreviewUrl,
  ].some(isWorkspaceMediaAssetProxyUrl);

const isWorkspaceSegmentStaleUploadOriginalVisual = (segment: WorkspaceSegmentEditorDraftSegment) => {
  return (
    segment.currentSourceKind === "upload" ||
    segment.originalSourceKind === "upload" ||
    segment.videoAction === "custom" ||
    (segment.visualReset && hasWorkspaceSegmentMediaAssetCurrentVisualUrl(segment))
  );
};

const isWorkspaceSegmentVisualResetApplied = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (!segment.visualReset) {
    return false;
  }

  if (
    segment.videoAction !== "original" ||
    segment.customVideo ||
    segment.aiPhotoAsset ||
    segment.aiVideoAsset ||
    segment.imageEditAsset ||
    segment.photoAnimationSourceAsset
  ) {
    return false;
  }

  const currentAssetIdentity = getWorkspaceMediaAssetIdentityKey(segment.currentAsset);
  const originalAssetIdentity = getWorkspaceMediaAssetIdentityKey(segment.originalAsset);
  if (currentAssetIdentity || originalAssetIdentity) {
    return Boolean(currentAssetIdentity && originalAssetIdentity && currentAssetIdentity === originalAssetIdentity);
  }

  const currentUrlIdentity =
    segment.currentPlaybackUrl ??
    segment.currentPreviewUrl ??
    segment.currentExternalPlaybackUrl ??
    segment.currentExternalPreviewUrl ??
    null;
  const originalUrlIdentity =
    segment.originalPlaybackUrl ??
    segment.originalPreviewUrl ??
    segment.originalExternalPlaybackUrl ??
    segment.originalExternalPreviewUrl ??
    null;

  if (!currentUrlIdentity) {
    return true;
  }

  if (!originalUrlIdentity) {
    return false;
  }

  return (
    currentUrlIdentity === originalUrlIdentity ||
    (isWorkspaceSegmentOriginalProxyUrl(currentUrlIdentity) && isWorkspaceSegmentOriginalProxyUrl(originalUrlIdentity))
  );
};

const clearWorkspaceSegmentCurrentVisualReference = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentEditorDraftSegment => ({
  ...segment,
  currentAsset: null,
  currentExternalPlaybackUrl: null,
  currentExternalPreviewUrl: null,
  currentPlaybackUrl: null,
  currentPreviewUrl: null,
  currentSourceKind: "unknown",
});

const buildWorkspaceSegmentOriginalProxyUrl = (
  projectId: number,
  segmentIndex: number,
  delivery: "playback" | "preview",
) => {
  const params = new URLSearchParams({
    delivery,
    projectId: String(projectId),
    segmentIndex: String(segmentIndex),
    source: "original",
  });
  return `/api/workspace/project-segment-video?${params.toString()}`;
};

const rewriteWorkspaceSegmentProjectProxyUrl = (value: string | null | undefined, projectId: number) => {
  const normalized = String(value ?? "").trim();
  if (!normalized || !normalized.includes("/api/workspace/project-segment-video")) {
    return value ?? null;
  }

  try {
    const url = new URL(normalized, window.location.origin);
    url.searchParams.set("projectId", String(projectId));
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return normalized.replace(/([?&]projectId=)[^&#]*/i, `$1${projectId}`);
  }
};

const ensureWorkspaceSegmentOriginalProxyReference = (
  segment: WorkspaceSegmentEditorDraftSegment,
  projectId: number | null | undefined,
  options?: { force?: boolean },
): WorkspaceSegmentEditorDraftSegment => {
  const normalizedProjectId = Number(projectId);
  if (
    !Number.isInteger(normalizedProjectId) ||
    normalizedProjectId <= 0 ||
    (!options?.force && (segment.originalPlaybackUrl || segment.originalPreviewUrl))
  ) {
    return segment;
  }

  return {
    ...segment,
    originalAsset: options?.force ? null : segment.originalAsset,
    originalExternalPlaybackUrl: options?.force ? null : segment.originalExternalPlaybackUrl,
    originalExternalPreviewUrl: options?.force ? null : segment.originalExternalPreviewUrl,
    originalPlaybackUrl: buildWorkspaceSegmentOriginalProxyUrl(normalizedProjectId, segment.index, "playback"),
    originalPreviewUrl: buildWorkspaceSegmentOriginalProxyUrl(normalizedProjectId, segment.index, "preview"),
    originalSourceKind: options?.force || segment.originalSourceKind === "upload" ? "unknown" : segment.originalSourceKind,
  };
};

const resetWorkspaceSegmentDraftVisualToOriginal = (
  segment: WorkspaceSegmentEditorDraftSegment,
  projectId?: number | null,
): WorkspaceSegmentEditorDraftSegment => {
  const sourceSegment = isWorkspaceSegmentStaleUploadOriginalVisual(segment)
    ? ensureWorkspaceSegmentOriginalProxyReference(segment, projectId, { force: true })
    : segment;
  const resetSegment: WorkspaceSegmentEditorDraftSegment = {
    ...sourceSegment,
    aiPhotoAsset: null,
    aiPhotoGeneratedFromPrompt: null,
    aiPhotoPrompt: "",
    aiPhotoPromptInitialized: false,
    aiVideoAsset: null,
    aiVideoGeneratedMode: null,
    aiVideoGeneratedFromPrompt: null,
    aiVideoPrompt: "",
    aiVideoPromptInitialized: false,
    customVideo: null,
    imageEditAsset: null,
    imageEditGeneratedFromPrompt: null,
    imageEditPrompt: "",
    imageEditPromptInitialized: false,
    photoAnimationSourceAsset: null,
    videoAction: "original",
    visualReset: true,
  };

  if (!hasWorkspaceSegmentOriginalVisualReference(sourceSegment)) {
    return clearWorkspaceSegmentCurrentVisualReference(resetSegment);
  }

  if (isWorkspaceSegmentStaleUploadOriginalVisual(sourceSegment)) {
    const correctedOriginalSegment: WorkspaceSegmentEditorDraftSegment = {
      ...sourceSegment,
      originalAsset: null,
      originalExternalPlaybackUrl: null,
      originalExternalPreviewUrl: null,
      originalSourceKind: "unknown",
    };

    if (!sourceSegment.originalPlaybackUrl && !sourceSegment.originalPreviewUrl) {
      return clearWorkspaceSegmentCurrentVisualReference({
        ...resetSegment,
        originalAsset: correctedOriginalSegment.originalAsset,
        originalExternalPlaybackUrl: correctedOriginalSegment.originalExternalPlaybackUrl,
        originalExternalPreviewUrl: correctedOriginalSegment.originalExternalPreviewUrl,
        originalSourceKind: correctedOriginalSegment.originalSourceKind,
      });
    }

    return {
      ...resetSegment,
      currentAsset: null,
      currentExternalPlaybackUrl: null,
      currentExternalPreviewUrl: null,
      currentPlaybackUrl: sourceSegment.originalPlaybackUrl,
      currentPreviewUrl: sourceSegment.originalPreviewUrl,
      currentSourceKind: "unknown",
      mediaType: getWorkspaceSegmentOriginalMediaType(correctedOriginalSegment),
      originalAsset: correctedOriginalSegment.originalAsset,
      originalExternalPlaybackUrl: correctedOriginalSegment.originalExternalPlaybackUrl,
      originalExternalPreviewUrl: correctedOriginalSegment.originalExternalPreviewUrl,
      originalSourceKind: correctedOriginalSegment.originalSourceKind,
    };
  }

  return {
    ...resetSegment,
    currentAsset: cloneWorkspaceMediaAssetRef(sourceSegment.originalAsset),
    currentExternalPlaybackUrl: sourceSegment.originalExternalPlaybackUrl,
    currentExternalPreviewUrl: sourceSegment.originalExternalPreviewUrl,
    currentPlaybackUrl: sourceSegment.originalPlaybackUrl,
    currentPreviewUrl: sourceSegment.originalPreviewUrl,
    currentSourceKind: sourceSegment.originalSourceKind,
    mediaType: getWorkspaceSegmentOriginalMediaType(sourceSegment),
  };
};

const normalizeWorkspaceSegmentEditorSetting = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
};

const normalizeWorkspaceSegmentEditorSegmentUrls = <
  T extends {
    currentExternalPlaybackUrl?: string | null;
    currentExternalPreviewUrl?: string | null;
    currentPlaybackUrl?: string | null;
    currentPreviewUrl?: string | null;
    currentVideoUrl?: string | null;
    currentSourceKind?: WorkspaceSegmentSourceKind | string | null;
    originalExternalPlaybackUrl?: string | null;
    originalExternalPreviewUrl?: string | null;
    originalPlaybackUrl?: string | null;
    originalPreviewUrl?: string | null;
    originalVideoUrl?: string | null;
    originalSourceKind?: WorkspaceSegmentSourceKind | string | null;
  },
>(
  segment: T,
) => ({
  ...segment,
  currentExternalPlaybackUrl: normalizeWorkspaceSegmentMediaAssetProxyUrl(segment.currentExternalPlaybackUrl),
  currentExternalPreviewUrl: normalizeWorkspaceSegmentMediaAssetProxyUrl(segment.currentExternalPreviewUrl),
  currentPlaybackUrl: normalizeWorkspaceSegmentEditorUrl(
    segment.currentPlaybackUrl ?? segment.currentPreviewUrl ?? segment.currentVideoUrl,
  ),
  currentPreviewUrl: normalizeWorkspaceSegmentEditorUrl(
    segment.currentPreviewUrl ?? segment.currentPlaybackUrl ?? segment.currentVideoUrl,
  ),
  currentSourceKind: normalizeWorkspaceSegmentSourceKind(segment.currentSourceKind),
  originalExternalPlaybackUrl: normalizeWorkspaceSegmentMediaAssetProxyUrl(segment.originalExternalPlaybackUrl),
  originalExternalPreviewUrl: normalizeWorkspaceSegmentMediaAssetProxyUrl(segment.originalExternalPreviewUrl),
  originalPlaybackUrl: normalizeWorkspaceSegmentEditorUrl(
    segment.originalPlaybackUrl ?? segment.originalPreviewUrl ?? segment.originalVideoUrl,
  ),
  originalPreviewUrl: normalizeWorkspaceSegmentEditorUrl(
    segment.originalPreviewUrl ?? segment.originalPlaybackUrl ?? segment.originalVideoUrl,
  ),
  originalSourceKind: normalizeWorkspaceSegmentSourceKind(segment.originalSourceKind),
});

const cloneWorkspaceSegmentEditorDraftSession = (
  session: WorkspaceSegmentEditorDraftSession,
): WorkspaceSegmentEditorDraftSession => ({
  ...sanitizeWorkspaceSegmentEditorCustomMusicState(session, {
    allowEphemeralCustomMusic: true,
  }),
  segments: session.segments.map((segment) => cloneWorkspaceSegmentEditorDraftSegment(segment)),
});

const shouldPreferEstimatedDurationForDraftSegment = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const hasSpeechTiming =
    (typeof segment.speechDuration === "number" && Number.isFinite(segment.speechDuration) && segment.speechDuration > 0) ||
    (typeof segment.speechStartTime === "number" && Number.isFinite(segment.speechStartTime)) ||
    (typeof segment.speechEndTime === "number" && Number.isFinite(segment.speechEndTime)) ||
    segment.speechWords.length > 0;
  if (hasSpeechTiming) {
    return false;
  }

  const hasPersistedMediaReference = Boolean(
    segment.currentAsset ||
      segment.originalAsset ||
      segment.currentPlaybackUrl ||
      segment.currentPreviewUrl ||
      segment.currentExternalPlaybackUrl ||
      segment.currentExternalPreviewUrl ||
      segment.originalPlaybackUrl ||
      segment.originalPreviewUrl ||
      segment.originalExternalPlaybackUrl ||
      segment.originalExternalPreviewUrl,
  );
  if (hasPersistedMediaReference) {
    return false;
  }

  return getWorkspaceSegmentPreviewKind(segment) === "image";
};

const rebuildWorkspaceSegmentEditorDraftTimeline = (
  segments: WorkspaceSegmentEditorDraftSegment[],
) =>
  rebuildWorkspaceSegmentEditorTimeline(segments, {
    preferEstimatedDuration: shouldPreferEstimatedDurationForDraftSegment,
});

const createWorkspaceSegmentEditorDraftSession = (
  session: WorkspaceSegmentEditorSession,
): WorkspaceSegmentEditorDraftSession => ({
  ...session,
  segments: rebuildWorkspaceSegmentEditorDraftTimeline(
    session.segments.map((segment) => ({
    ...normalizeWorkspaceSegmentEditorSegmentUrls(segment),
    aiPhotoAsset: null,
    aiPhotoGeneratedFromPrompt: null,
    aiPhotoPrompt: "",
    aiPhotoPromptInitialized: false,
    aiVideoAsset: null,
    aiVideoGeneratedMode: null,
    aiVideoGeneratedFromPrompt: null,
    aiVideoPrompt: "",
    aiVideoPromptInitialized: false,
    customVideo: null,
    imageEditAsset: null,
    imageEditGeneratedFromPrompt: null,
    imageEditPrompt: "",
    imageEditPromptInitialized: false,
    mediaType: normalizeWorkspaceSegmentMediaType(segment.mediaType),
    originalText: segment.text,
    originalTextByLanguage: {
      ru: segment.text,
    },
      photoAnimationSourceAsset: null,
    textByLanguage: {
      ru: segment.text,
    },
    videoAction: "original",
      visualReset: false,
    })),
  ),
});

const shouldPromoteFreshServerVideoToPhotoAnimation = (
  liveSegment: WorkspaceSegmentEditorDraftSegment,
  freshSegment: WorkspaceSegmentEditorSegment,
) => {
  if (freshSegment.mediaType !== "video") {
    return false;
  }

  if (!["ai_photo", "image_edit", "original", "photo_animation"].includes(liveSegment.videoAction)) {
    return false;
  }

  const hasPhotoAnimationSource =
    liveSegment.mediaType === "photo" ||
    liveSegment.videoAction === "photo_animation" ||
    liveSegment.aiVideoGeneratedMode === "photo_animation" ||
    isWorkspacePhotoAnimationMediaAsset(freshSegment.currentAsset) ||
    getWorkspaceSegmentCustomPreviewKind(liveSegment.aiPhotoAsset) === "image" ||
    getWorkspaceSegmentCustomPreviewKind(liveSegment.imageEditAsset) === "image" ||
    getWorkspaceSegmentCustomPreviewKind(liveSegment.photoAnimationSourceAsset) === "image";

  if (!hasPhotoAnimationSource) {
    return false;
  }

  return Boolean(
    freshSegment.currentPlaybackUrl ||
      freshSegment.currentPreviewUrl ||
      freshSegment.currentExternalPlaybackUrl ||
      freshSegment.currentExternalPreviewUrl,
  );
};

const createWorkspaceSegmentFreshPhotoAnimationAsset = (
  freshSegment: WorkspaceSegmentEditorSegment,
): StudioCustomVideoFile | null =>
  createStudioCustomVideoFileFromWorkspaceMediaAsset(freshSegment.currentAsset, {
    fallbackFileName: `segment-${freshSegment.index + 1}-animation.mp4`,
    fallbackMimeType: "video/mp4",
    fallbackRemoteUrl:
      freshSegment.currentPlaybackUrl ??
      freshSegment.currentExternalPlaybackUrl ??
      freshSegment.currentPreviewUrl ??
      freshSegment.currentExternalPreviewUrl,
  });

const mergeWorkspaceSegmentEditorDraftSegmentWithFreshSession = (
  liveSegment: WorkspaceSegmentEditorDraftSegment,
  freshSegment: WorkspaceSegmentEditorSegment,
): WorkspaceSegmentEditorDraftSegment => {
  const normalizedFreshSegment = normalizeWorkspaceSegmentEditorSegmentUrls(freshSegment);
  const shouldUseFreshServerVideo = shouldPromoteFreshServerVideoToPhotoAnimation(liveSegment, normalizedFreshSegment);
  const freshPhotoAnimationAsset = shouldUseFreshServerVideo
    ? createWorkspaceSegmentFreshPhotoAnimationAsset(normalizedFreshSegment)
    : null;

  return {
    ...normalizedFreshSegment,
    aiPhotoAsset: cloneStudioCustomVideoFile(liveSegment.aiPhotoAsset),
    aiPhotoGeneratedFromPrompt: liveSegment.aiPhotoGeneratedFromPrompt,
    aiPhotoPrompt: liveSegment.aiPhotoPrompt,
    aiPhotoPromptInitialized: liveSegment.aiPhotoPromptInitialized,
    aiVideoAsset: shouldUseFreshServerVideo
      ? freshPhotoAnimationAsset ?? cloneStudioCustomVideoFile(liveSegment.aiVideoAsset)
      : cloneStudioCustomVideoFile(liveSegment.aiVideoAsset),
    aiVideoGeneratedMode: shouldUseFreshServerVideo ? "photo_animation" : liveSegment.aiVideoGeneratedMode,
    aiVideoGeneratedFromPrompt: liveSegment.aiVideoGeneratedFromPrompt,
    aiVideoPrompt: liveSegment.aiVideoPrompt,
    aiVideoPromptInitialized: shouldUseFreshServerVideo ? true : liveSegment.aiVideoPromptInitialized,
    customVideo: cloneStudioCustomVideoFile(liveSegment.customVideo),
    imageEditAsset: cloneStudioCustomVideoFile(liveSegment.imageEditAsset),
    imageEditGeneratedFromPrompt: liveSegment.imageEditGeneratedFromPrompt,
    imageEditPrompt: liveSegment.imageEditPrompt,
    imageEditPromptInitialized: liveSegment.imageEditPromptInitialized,
    originalText: liveSegment.originalText,
    originalTextByLanguage: cloneWorkspaceSegmentEditorLocalizedTextMap(
      liveSegment.originalTextByLanguage,
      liveSegment.originalText,
    ),
    photoAnimationSourceAsset: cloneStudioCustomVideoFile(liveSegment.photoAnimationSourceAsset),
    text: liveSegment.text,
    textByLanguage: cloneWorkspaceSegmentEditorLocalizedTextMap(liveSegment.textByLanguage, liveSegment.text),
    videoAction: shouldUseFreshServerVideo ? "photo_animation" : liveSegment.videoAction,
    visualReset: liveSegment.visualReset,
  };
};

const refreshWorkspaceSegmentEditorDraftWithFreshSession = (
  liveDraft: WorkspaceSegmentEditorDraftSession,
  freshSession: WorkspaceSegmentEditorSession,
  options?: {
    baselineSession?: WorkspaceSegmentEditorSession | null;
  },
): WorkspaceSegmentEditorDraftSession => {
  const normalizedFreshSession = normalizeWorkspaceSegmentEditorSession(freshSession);
  const normalizedLiveMusicState = sanitizeWorkspaceSegmentEditorCustomMusicState(liveDraft, {
    allowEphemeralCustomMusic: true,
  });
  const normalizedBaselineSession =
    options?.baselineSession && options.baselineSession.projectId === liveDraft.projectId
      ? normalizeWorkspaceSegmentEditorSession(options.baselineSession)
      : null;
  const shouldPreserveLiveStructure = normalizedBaselineSession
    ? hasWorkspaceSegmentEditorStructureChanged(
        liveDraft.segments.map((segment) => segment.index),
        normalizedBaselineSession.segments.map((segment) => segment.index),
      )
    : hasWorkspaceSegmentEditorStructureChanged(
        liveDraft.segments.map((segment) => segment.index),
        normalizedFreshSession.segments.map((segment) => segment.index),
      );
  const freshSegmentsByIndex = new Map(normalizedFreshSession.segments.map((segment) => [segment.index, segment] as const));
  const mergedSegments: WorkspaceSegmentEditorDraftSegment[] = [];
  const handledSegmentIndexes = new Set<number>();

  liveDraft.segments.forEach((segment) => {
    const freshSegment = freshSegmentsByIndex.get(segment.index);
    if (!freshSegment) {
      mergedSegments.push(cloneWorkspaceSegmentEditorDraftSegment(segment));
      return;
    }

    handledSegmentIndexes.add(segment.index);
    mergedSegments.push(mergeWorkspaceSegmentEditorDraftSegmentWithFreshSession(segment, freshSegment));
  });

  if (!shouldPreserveLiveStructure) {
    normalizedFreshSession.segments.forEach((segment) => {
      if (handledSegmentIndexes.has(segment.index)) {
        return;
      }

      mergedSegments.push(createWorkspaceSegmentEditorDraftSession({
        ...normalizedFreshSession,
        segments: [segment],
      }).segments[0]);
    });
  }

  return {
    ...normalizedFreshSession,
    customMusicAssetId: normalizedLiveMusicState.customMusicAssetId ?? null,
    customMusicFileName: normalizedLiveMusicState.customMusicFileName ?? null,
    description: liveDraft.description,
    musicType: normalizedLiveMusicState.musicType,
    segments: rebuildWorkspaceSegmentEditorDraftTimeline(mergedSegments),
    subtitleColor: liveDraft.subtitleColor,
    subtitleStyle: liveDraft.subtitleStyle,
    subtitleType: liveDraft.subtitleType,
    title: liveDraft.title,
    voiceType: liveDraft.voiceType,
  };
};

const getWorkspaceSegmentEditorNextSegmentIndex = (segments: WorkspaceSegmentEditorDraftSegment[]) =>
  segments.reduce((maxIndex, segment) => Math.max(maxIndex, segment.index), -1) + 1;

const getWorkspaceSegmentEditorInsertedSegmentTiming = (
  segments: WorkspaceSegmentEditorDraftSegment[],
  insertAt: number,
) => {
  const previousSegment = insertAt > 0 ? segments[insertAt - 1] ?? null : null;
  const nextSegment = segments[insertAt] ?? null;
  const startTime = previousSegment ? getWorkspaceSegmentEditorDisplayEndTime(previousSegment) : 0;
  const nextStartTime = nextSegment ? getWorkspaceSegmentEditorDisplayStartTime(nextSegment) : null;
  const duration =
    typeof nextStartTime === "number" && nextStartTime > startTime
      ? nextStartTime - startTime
      : WORKSPACE_SEGMENT_EDITOR_NEW_SEGMENT_DURATION_SECONDS;
  const safeDuration = Math.max(1, duration);

  return {
    duration: safeDuration,
    endTime: startTime + safeDuration,
    startTime,
  };
};

const createWorkspaceSegmentEditorInsertedSegment = (options: {
  draft: WorkspaceSegmentEditorDraftSession;
  insertAt: number;
  sourceSegment?: WorkspaceSegmentEditorDraftSegment | null;
}): WorkspaceSegmentEditorDraftSegment => {
  const { draft, insertAt } = options;
  const nextIndex = getWorkspaceSegmentEditorNextSegmentIndex(draft.segments);
  const baseText = "";
  const textByLanguage = cloneWorkspaceSegmentEditorLocalizedTextMap(null, baseText);
  const { duration, endTime, startTime } = getWorkspaceSegmentEditorInsertedSegmentTiming(draft.segments, insertAt);

  return {
    aiPhotoAsset: null,
    aiPhotoGeneratedFromPrompt: null,
    aiPhotoPrompt: "",
    aiPhotoPromptInitialized: false,
    aiVideoAsset: null,
    aiVideoGeneratedMode: null,
    aiVideoGeneratedFromPrompt: null,
    aiVideoPrompt: "",
    aiVideoPromptInitialized: false,
    currentAsset: null,
    currentExternalPlaybackUrl: null,
    currentExternalPreviewUrl: null,
    currentPlaybackUrl: null,
    currentPreviewUrl: null,
    currentSourceKind: "unknown",
    customVideo: null,
    duration,
    endTime,
    index: nextIndex,
    imageEditAsset: null,
    imageEditGeneratedFromPrompt: null,
    imageEditPrompt: "",
    imageEditPromptInitialized: false,
    mediaType: "video",
    originalAsset: null,
    originalExternalPlaybackUrl: null,
    originalExternalPreviewUrl: null,
    originalPlaybackUrl: null,
    originalPreviewUrl: null,
    originalSourceKind: "unknown",
    originalText: baseText,
    originalTextByLanguage: { ...textByLanguage },
    photoAnimationSourceAsset: null,
    speechDuration: null,
    speechEndTime: null,
    speechStartTime: null,
    speechWords: [],
    startTime,
    text: baseText,
    textByLanguage: { ...textByLanguage },
    videoAction: "original",
    visualReset: false,
  };
};

const normalizeWorkspaceSegmentEditorSession = (
  session: WorkspaceSegmentEditorSession,
): WorkspaceSegmentEditorSession => {
  const sanitizedSession = sanitizeWorkspaceSegmentEditorCustomMusicState(session);
  return {
    ...sanitizedSession,
    segments: sanitizedSession.segments.map((segment) => ({
    ...normalizeWorkspaceSegmentEditorSegmentUrls(segment),
    mediaType: normalizeWorkspaceSegmentMediaType(segment.mediaType),
  })),
  };
};

const WORKSPACE_SEGMENT_EDITOR_SESSION_STORAGE_KEY_PREFIX = "adshorts.segment-editor-session:";

const normalizeWorkspaceSegmentEditorStorageEmail = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();

const getWorkspaceSegmentEditorSessionStorageKey = (email: string, projectId: number) =>
  `${WORKSPACE_SEGMENT_EDITOR_SESSION_STORAGE_KEY_PREFIX}${email}:${projectId}`;

type WorkspaceSegmentEditorStorageName = "localStorage" | "sessionStorage";

type WorkspaceSegmentEditorStorageCandidate = {
  rawValue: string;
  storageName: WorkspaceSegmentEditorStorageName;
};

type WorkspaceSegmentEditorStorageEntry = WorkspaceSegmentEditorStorageCandidate & {
  storageKey: string;
};

const WORKSPACE_SEGMENT_EDITOR_STORAGE_NAMES: WorkspaceSegmentEditorStorageName[] = ["localStorage", "sessionStorage"];

const getWorkspaceSegmentEditorBrowserStorage = (storageName: WorkspaceSegmentEditorStorageName) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window[storageName];
  } catch {
    return null;
  }
};

const removeWorkspaceSegmentEditorStorageValueFrom = (
  storageName: WorkspaceSegmentEditorStorageName,
  storageKey: string,
) => {
  const storage = getWorkspaceSegmentEditorBrowserStorage(storageName);
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(storageKey);
  } catch {
    // Ignore storage cleanup errors.
  }
};

const removeWorkspaceSegmentEditorStorageValue = (storageKey: string) => {
  WORKSPACE_SEGMENT_EDITOR_STORAGE_NAMES.forEach((storageName) => {
    removeWorkspaceSegmentEditorStorageValueFrom(storageName, storageKey);
  });
};

const readWorkspaceSegmentEditorStorageCandidates = (storageKey: string): WorkspaceSegmentEditorStorageCandidate[] => {
  const candidates: WorkspaceSegmentEditorStorageCandidate[] = [];

  WORKSPACE_SEGMENT_EDITOR_STORAGE_NAMES.forEach((storageName) => {
    const storage = getWorkspaceSegmentEditorBrowserStorage(storageName);
    if (!storage) {
      return;
    }

    try {
      const rawValue = storage.getItem(storageKey);
      if (rawValue) {
        candidates.push({ rawValue, storageName });
      }
    } catch {
      // Ignore storage read errors.
    }
  });

  return candidates;
};

const readWorkspaceSegmentEditorStorageEntries = (storageKeyPrefix: string): WorkspaceSegmentEditorStorageEntry[] => {
  const entries: WorkspaceSegmentEditorStorageEntry[] = [];

  WORKSPACE_SEGMENT_EDITOR_STORAGE_NAMES.forEach((storageName) => {
    const storage = getWorkspaceSegmentEditorBrowserStorage(storageName);
    if (!storage) {
      return;
    }

    const storageKeys: string[] = [];
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const storageKey = storage.key(index);
        if (storageKey?.startsWith(storageKeyPrefix)) {
          storageKeys.push(storageKey);
        }
      }
    } catch {
      return;
    }

    storageKeys.forEach((storageKey) => {
      try {
        const rawValue = storage.getItem(storageKey);
        if (rawValue) {
          entries.push({ rawValue, storageKey, storageName });
        }
      } catch {
        // Ignore storage read errors.
      }
    });
  });

  return entries;
};

const writeWorkspaceSegmentEditorStorageValue = (storageKey: string, rawValue: string) => {
  const localStorage = getWorkspaceSegmentEditorBrowserStorage("localStorage");
  let didWriteLocalStorage = false;

  if (localStorage) {
    try {
      localStorage.setItem(storageKey, rawValue);
      didWriteLocalStorage = true;
    } catch {
      // Fall back to sessionStorage below.
    }
  }

  const sessionStorage = getWorkspaceSegmentEditorBrowserStorage("sessionStorage");
  if (!sessionStorage) {
    return;
  }

  try {
    if (didWriteLocalStorage) {
      sessionStorage.removeItem(storageKey);
    } else {
      sessionStorage.setItem(storageKey, rawValue);
    }
  } catch {
    // Ignore storage write errors.
  }
};

const isStoredWorkspaceSegmentEditorSession = (value: unknown): value is WorkspaceSegmentEditorSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<WorkspaceSegmentEditorSession>;
  return Number.isFinite(Number(payload.projectId)) && Array.isArray(payload.segments);
};

const readStoredWorkspaceSegmentEditorSession = (email: string | null | undefined, projectId: number | null | undefined) => {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return null;
  }

  const storageKey = getWorkspaceSegmentEditorSessionStorageKey(normalizedEmail, normalizedProjectId);

  for (const candidate of readWorkspaceSegmentEditorStorageCandidates(storageKey)) {
    try {
      const parsedValue = JSON.parse(candidate.rawValue) as unknown;
      if (!isStoredWorkspaceSegmentEditorSession(parsedValue)) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      const normalizedSession = normalizeWorkspaceSegmentEditorSession(parsedValue);
      if (normalizedSession.projectId !== normalizedProjectId) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      if (candidate.storageName === "sessionStorage") {
        writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedSession));
      }

      return normalizedSession;
    } catch {
      removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
    }
  }

  return null;
};

const writeStoredWorkspaceSegmentEditorSession = (
  email: string | null | undefined,
  session: WorkspaceSegmentEditorSession | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(session?.projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0 || !session) {
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(
    getWorkspaceSegmentEditorSessionStorageKey(normalizedEmail, normalizedProjectId),
    JSON.stringify(normalizeWorkspaceSegmentEditorSession(session)),
  );
};

const WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_KEY_PREFIX = "adshorts.segment-editor-draft:";
const WORKSPACE_SEGMENT_PHOTO_ANIMATION_PENDING_STORAGE_KEY_PREFIX = "adshorts.segment-photo-animation-pending:";
const WORKSPACE_SEGMENT_PHOTO_ANIMATION_PENDING_TTL_MS = 24 * 60 * 60 * 1000;

const getWorkspaceSegmentEditorDraftStorageKey = (email: string, projectId: number) =>
  `${WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_KEY_PREFIX}${email}:${projectId}`;

const getWorkspaceSegmentPhotoAnimationPendingStorageKey = (email: string) =>
  `${WORKSPACE_SEGMENT_PHOTO_ANIMATION_PENDING_STORAGE_KEY_PREFIX}${email}`;

const normalizePersistedStudioCustomVideoFile = (value: StudioCustomVideoFile | null | undefined): StudioCustomVideoFile | null => {
  if (!value) {
    return null;
  }

  const dataUrl = typeof value.dataUrl === "string" ? value.dataUrl.trim() : "";
  const assetId = Number.isFinite(Number(value.assetId)) && Number(value.assetId) > 0 ? Math.trunc(Number(value.assetId)) : null;
  const fileName = typeof value.fileName === "string" ? value.fileName : "";
  const fileSize = Number.isFinite(value.fileSize) ? Math.max(0, value.fileSize) : 0;
  const libraryItemKey = typeof value.libraryItemKey === "string" ? value.libraryItemKey.trim() : "";
  const mimeType = typeof value.mimeType === "string" && value.mimeType.trim() ? value.mimeType : "application/octet-stream";
  const posterUrl = typeof value.posterUrl === "string" ? value.posterUrl.trim() : "";
  const remoteUrl = getWorkspaceMediaAssetResolvedPreviewUrl({
    assetId,
    fileName,
    mimeType,
    remoteUrl: typeof value.remoteUrl === "string" ? value.remoteUrl : "",
  }) ?? "";
  const source =
    value.source === "media-library" || value.source === "upload"
      ? value.source
      : undefined;

  if (!assetId && !dataUrl && !remoteUrl && !libraryItemKey) {
    return null;
  }

  return {
    assetId: assetId ?? undefined,
    dataUrl: dataUrl || undefined,
    fileName,
    fileSize,
    libraryItemKey: libraryItemKey || undefined,
    mimeType,
    posterUrl: posterUrl || undefined,
    remoteUrl: remoteUrl || undefined,
    source,
  };
};

const isStoredWorkspaceSegmentEditorDraftSession = (value: unknown): value is WorkspaceSegmentEditorDraftSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<WorkspaceSegmentEditorDraftSession>;
  return Number.isFinite(Number(payload.projectId)) && Array.isArray(payload.segments);
};

const hasWorkspaceSegmentImmediateImagePreview = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const currentVisualAsset = getWorkspaceSegmentDraftVisualAsset(segment);
  const currentVisualAssetPreviewUrl =
    getWorkspaceSegmentCustomPreviewKind(currentVisualAsset) === "image"
      ? getStudioCustomAssetPreviewUrl(currentVisualAsset)
      : null;

  return (
    Boolean(currentVisualAssetPreviewUrl) ||
    filterWorkspaceStillAssetUrls([
      segment.currentExternalPreviewUrl,
      segment.currentExternalPlaybackUrl,
      segment.originalExternalPreviewUrl,
      segment.originalExternalPlaybackUrl,
      segment.currentPreviewUrl,
      segment.originalPreviewUrl,
    ]).length > 0
  );
};

const canRestoreStoredWorkspaceSegmentEditorDraftSession = (session: WorkspaceSegmentEditorDraftSession) =>
  session.segments.every((segment) => {
    const selectedVisualPreviewKind = getWorkspaceSegmentSelectedVisualPreviewKind(segment);
    if (selectedVisualPreviewKind !== "image") {
      return true;
    }

    return hasWorkspaceSegmentImmediateImagePreview(segment);
  });

const normalizeStoredWorkspaceSegmentEditorDraftSession = (
  session: WorkspaceSegmentEditorDraftSession,
): WorkspaceSegmentEditorDraftSession => {
  const clonedSession = sanitizeWorkspaceSegmentEditorCustomMusicState(
    cloneWorkspaceSegmentEditorDraftSession(session),
  );
  return {
    ...clonedSession,
    segments: rebuildWorkspaceSegmentEditorDraftTimeline(
      clonedSession.segments.map((segment) => ({
    ...cloneWorkspaceSegmentEditorDraftSegment(segment),
    aiPhotoAsset: normalizePersistedStudioCustomVideoFile(segment.aiPhotoAsset),
    aiVideoAsset: normalizePersistedStudioCustomVideoFile(segment.aiVideoAsset),
    customVideo: normalizePersistedStudioCustomVideoFile(segment.customVideo),
    imageEditAsset: normalizePersistedStudioCustomVideoFile(segment.imageEditAsset),
        photoAnimationSourceAsset: normalizePersistedStudioCustomVideoFile(segment.photoAnimationSourceAsset),
      })),
    ),
  };
};

const isStoredWorkspaceSegmentPhotoAnimationJob = (value: unknown): value is StoredWorkspaceSegmentPhotoAnimationJob => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<StoredWorkspaceSegmentPhotoAnimationJob>;
  return (
    typeof payload.jobId === "string" &&
    payload.jobId.trim().length > 0 &&
    Number.isInteger(Number(payload.projectId)) &&
    Number(payload.projectId) > 0 &&
    Number.isInteger(Number(payload.segmentIndex)) &&
    Number(payload.segmentIndex) >= 0
  );
};

const normalizeStoredWorkspaceSegmentPhotoAnimationJob = (
  value: StoredWorkspaceSegmentPhotoAnimationJob,
): StoredWorkspaceSegmentPhotoAnimationJob => ({
  createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
  jobId: String(value.jobId ?? "").trim(),
  projectId: Math.trunc(Number(value.projectId)),
  prompt: normalizeWorkspaceSegmentAiVideoPrompt(value.prompt),
  segmentIndex: Math.trunc(Number(value.segmentIndex)),
  sourceAsset: normalizePersistedStudioCustomVideoFile(value.sourceAsset),
  status: String(value.status ?? "queued").trim() || "queued",
});

const readStoredWorkspaceSegmentPhotoAnimationJobs = (
  email: string | null | undefined,
): StoredWorkspaceSegmentPhotoAnimationJob[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const storageKey = getWorkspaceSegmentPhotoAnimationPendingStorageKey(normalizedEmail);
  const candidate = readWorkspaceSegmentEditorStorageCandidates(storageKey)[0];
  if (!candidate) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(candidate.rawValue) as unknown;
    const rawJobs = Array.isArray(parsedValue) ? parsedValue : [];
    const now = Date.now();
    const jobs = rawJobs
      .filter(isStoredWorkspaceSegmentPhotoAnimationJob)
      .map(normalizeStoredWorkspaceSegmentPhotoAnimationJob)
      .filter((job) => now - job.createdAt <= WORKSPACE_SEGMENT_PHOTO_ANIMATION_PENDING_TTL_MS);

    if (jobs.length !== rawJobs.length || candidate.storageName === "sessionStorage") {
      writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(jobs));
    }

    return jobs;
  } catch {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return [];
  }
};

const writeStoredWorkspaceSegmentPhotoAnimationJobs = (
  email: string | null | undefined,
  jobs: StoredWorkspaceSegmentPhotoAnimationJob[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return;
  }

  const storageKey = getWorkspaceSegmentPhotoAnimationPendingStorageKey(normalizedEmail);
  const normalizedJobs = jobs
    .filter(isStoredWorkspaceSegmentPhotoAnimationJob)
    .map(normalizeStoredWorkspaceSegmentPhotoAnimationJob)
    .filter((job) => Date.now() - job.createdAt <= WORKSPACE_SEGMENT_PHOTO_ANIMATION_PENDING_TTL_MS);

  if (!normalizedJobs.length) {
    removeWorkspaceSegmentEditorStorageValue(storageKey);
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedJobs));
};

const upsertStoredWorkspaceSegmentPhotoAnimationJob = (
  email: string | null | undefined,
  job: StoredWorkspaceSegmentPhotoAnimationJob,
) => {
  const normalizedJob = normalizeStoredWorkspaceSegmentPhotoAnimationJob(job);
  const jobs = readStoredWorkspaceSegmentPhotoAnimationJobs(email).filter((item) => item.jobId !== normalizedJob.jobId);
  writeStoredWorkspaceSegmentPhotoAnimationJobs(email, [normalizedJob, ...jobs]);
};

const removeStoredWorkspaceSegmentPhotoAnimationJob = (
  email: string | null | undefined,
  jobId: string | null | undefined,
) => {
  const safeJobId = String(jobId ?? "").trim();
  if (!safeJobId) {
    return;
  }

  const jobs = readStoredWorkspaceSegmentPhotoAnimationJobs(email).filter((job) => job.jobId !== safeJobId);
  writeStoredWorkspaceSegmentPhotoAnimationJobs(email, jobs);
};

const readStoredWorkspaceSegmentEditorDraft = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return null;
  }

  const storageKey = getWorkspaceSegmentEditorDraftStorageKey(normalizedEmail, normalizedProjectId);

  for (const candidate of readWorkspaceSegmentEditorStorageCandidates(storageKey)) {
    try {
      const parsedValue = JSON.parse(candidate.rawValue) as unknown;
      if (!isStoredWorkspaceSegmentEditorDraftSession(parsedValue)) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      const normalizedDraft = normalizeStoredWorkspaceSegmentEditorDraftSession(parsedValue);
      if (normalizedDraft.projectId !== normalizedProjectId) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      if (!canRestoreStoredWorkspaceSegmentEditorDraftSession(normalizedDraft)) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      if (candidate.storageName === "sessionStorage") {
        writeWorkspaceSegmentEditorStorageValue(storageKey, JSON.stringify(normalizedDraft));
      }

      return normalizedDraft;
    } catch {
      removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
    }
  }

  return null;
};

const readStoredWorkspaceSegmentEditorDrafts = (
  email: string | null | undefined,
): WorkspaceSegmentEditorDraftSession[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const storageKeyPrefix = `${WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_KEY_PREFIX}${normalizedEmail}:`;
  const draftsByProjectId = new Map<number, WorkspaceSegmentEditorDraftSession>();
  const handledStorageKeys = new Set<string>();

  readWorkspaceSegmentEditorStorageEntries(storageKeyPrefix).forEach((entry) => {
    if (handledStorageKeys.has(entry.storageKey)) {
      removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
      return;
    }

    const storageProjectId = Number(entry.storageKey.slice(storageKeyPrefix.length));
    if (!Number.isInteger(storageProjectId) || storageProjectId <= 0) {
      removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
      return;
    }

    try {
      const parsedValue = JSON.parse(entry.rawValue) as unknown;
      if (!isStoredWorkspaceSegmentEditorDraftSession(parsedValue)) {
        removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
        return;
      }

      const normalizedDraft = normalizeStoredWorkspaceSegmentEditorDraftSession(parsedValue);
      if (normalizedDraft.projectId !== storageProjectId) {
        removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
        return;
      }

      if (!canRestoreStoredWorkspaceSegmentEditorDraftSession(normalizedDraft)) {
        removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
        return;
      }

      if (entry.storageName === "sessionStorage") {
        writeWorkspaceSegmentEditorStorageValue(entry.storageKey, JSON.stringify(normalizedDraft));
      }

      draftsByProjectId.set(normalizedDraft.projectId, normalizedDraft);
      handledStorageKeys.add(entry.storageKey);
    } catch {
      removeWorkspaceSegmentEditorStorageValueFrom(entry.storageName, entry.storageKey);
    }
  });

  return Array.from(draftsByProjectId.values()).sort((left, right) => right.projectId - left.projectId);
};

const writeStoredWorkspaceSegmentEditorDraft = (
  email: string | null | undefined,
  session: WorkspaceSegmentEditorDraftSession | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(session?.projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0 || !session) {
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(
    getWorkspaceSegmentEditorDraftStorageKey(normalizedEmail, normalizedProjectId),
    JSON.stringify(normalizeStoredWorkspaceSegmentEditorDraftSession(session)),
  );
};

const removeStoredWorkspaceSegmentEditorDraft = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return;
  }

  removeWorkspaceSegmentEditorStorageValue(getWorkspaceSegmentEditorDraftStorageKey(normalizedEmail, normalizedProjectId));
};

const moveArrayItemToInsertIndex = <T,>(items: T[], fromIndex: number, insertIndex: number) => {
  if (fromIndex < 0 || fromIndex >= items.length) {
    return items;
  }

  const boundedInsertIndex = Math.max(0, Math.min(insertIndex, items.length));
  const adjustedInsertIndex = boundedInsertIndex > fromIndex ? boundedInsertIndex - 1 : boundedInsertIndex;
  if (adjustedInsertIndex === fromIndex) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  if (typeof movedItem === "undefined") {
    return items;
  }

  nextItems.splice(adjustedInsertIndex, 0, movedItem);
  return nextItems;
};

const getVisibleInsertIndexForDraggedItem = (
  itemCount: number,
  draggedIndex: number | null,
  insertIndex: number | null,
) => {
  if (draggedIndex === null || insertIndex === null || draggedIndex < 0 || draggedIndex >= itemCount) {
    return null;
  }

  const boundedInsertIndex = Math.max(0, Math.min(insertIndex, itemCount));
  const adjustedInsertIndex = boundedInsertIndex > draggedIndex ? boundedInsertIndex - 1 : boundedInsertIndex;
  return adjustedInsertIndex === draggedIndex ? null : boundedInsertIndex;
};

const reorderWorkspaceSegmentEditorSegmentsByIndex = (
  segments: WorkspaceSegmentEditorDraftSegment[],
  orderedSegmentIndices: number[],
) => {
  if (segments.length !== orderedSegmentIndices.length) {
    return segments;
  }

  const segmentsByIndex = new Map(segments.map((segment) => [segment.index, segment]));
  const nextSegments = orderedSegmentIndices
    .map((segmentIndex) => segmentsByIndex.get(segmentIndex))
    .filter((segment): segment is WorkspaceSegmentEditorDraftSegment => Boolean(segment));

  return nextSegments.length === segments.length ? nextSegments : segments;
};

const areWorkspaceSegmentEditorSegmentOrdersEqual = (
  left?: Pick<WorkspaceSegmentEditorDraftSession, "segments"> | null,
  right?: Pick<WorkspaceSegmentEditorDraftSession, "segments"> | null,
) => {
  if (!left || !right || left.segments.length !== right.segments.length) {
    return false;
  }

  return left.segments.every((segment, index) => segment.index === right.segments[index]?.index);
};

const getWorkspaceSegmentEditorDisplayNumber = (
  segments: WorkspaceSegmentEditorDraftSegment[],
  segmentIndex: number,
) => {
  const arrayIndex = segments.findIndex((segment) => segment.index === segmentIndex);
  return (arrayIndex >= 0 ? arrayIndex : segmentIndex) + 1;
};

const normalizeLegacyWorkspaceSegmentEditorDraftSession = (
  session: WorkspaceSegmentEditorDraftSession,
): WorkspaceSegmentEditorDraftSession => {
  let hasChanges = false;

  const segments = session.segments.map((segment) => {
    const normalizedSegment = normalizeWorkspaceSegmentEditorSegmentUrls(segment);
    const normalizedOriginalText =
      typeof segment.originalText === "string" && segment.originalText.trim() ? segment.originalText : segment.text;
    const normalizedVideoAction: WorkspaceSegmentEditorVideoAction =
      segment.videoAction === "ai" ||
      segment.videoAction === "ai_photo" ||
      segment.videoAction === "custom" ||
      segment.videoAction === "image_edit" ||
      segment.videoAction === "photo_animation"
        ? segment.videoAction
        : "original";
    const normalizedAiPhotoPrompt = typeof segment.aiPhotoPrompt === "string" ? segment.aiPhotoPrompt : "";
    const normalizedAiPhotoGeneratedFromPrompt =
      typeof segment.aiPhotoGeneratedFromPrompt === "string" && segment.aiPhotoGeneratedFromPrompt.trim()
        ? segment.aiPhotoGeneratedFromPrompt
        : null;
    const normalizedAiPhotoPromptInitialized =
      Boolean(segment.aiPhotoPromptInitialized) ||
      Boolean(normalizedAiPhotoPrompt) ||
      Boolean(normalizedAiPhotoGeneratedFromPrompt);
    const normalizedAiVideoPrompt = typeof segment.aiVideoPrompt === "string" ? segment.aiVideoPrompt : "";
    const normalizedAiVideoGeneratedFromPrompt =
      typeof segment.aiVideoGeneratedFromPrompt === "string" && segment.aiVideoGeneratedFromPrompt.trim()
        ? segment.aiVideoGeneratedFromPrompt
        : null;
    const normalizedAiVideoGeneratedMode =
      segment.aiVideoGeneratedMode === "photo_animation" || segment.aiVideoGeneratedMode === "ai_video"
        ? segment.aiVideoGeneratedMode
        : null;
    const normalizedAiVideoPromptInitialized =
      Boolean(segment.aiVideoPromptInitialized) ||
      Boolean(normalizedAiVideoPrompt) ||
      Boolean(normalizedAiVideoGeneratedFromPrompt);
    const normalizedImageEditPrompt = typeof segment.imageEditPrompt === "string" ? segment.imageEditPrompt : "";
    const normalizedImageEditGeneratedFromPrompt =
      typeof segment.imageEditGeneratedFromPrompt === "string" && segment.imageEditGeneratedFromPrompt.trim()
        ? segment.imageEditGeneratedFromPrompt
        : null;
    const normalizedImageEditPromptInitialized =
      Boolean(segment.imageEditPromptInitialized) ||
      Boolean(normalizedImageEditPrompt) ||
      Boolean(normalizedImageEditGeneratedFromPrompt);
    const normalizedMediaType = normalizeWorkspaceSegmentMediaType(segment.mediaType);
    const normalizedTextByLanguage = cloneWorkspaceSegmentEditorLocalizedTextMap(segment.textByLanguage, segment.text);
    const normalizedOriginalTextByLanguage = cloneWorkspaceSegmentEditorLocalizedTextMap(
      segment.originalTextByLanguage,
      normalizedOriginalText,
    );
    const hasUrlChanges =
      normalizedSegment.currentExternalPlaybackUrl !== segment.currentExternalPlaybackUrl ||
      normalizedSegment.currentExternalPreviewUrl !== segment.currentExternalPreviewUrl ||
      normalizedSegment.currentPlaybackUrl !== segment.currentPlaybackUrl ||
      normalizedSegment.currentPreviewUrl !== segment.currentPreviewUrl ||
      normalizedSegment.currentSourceKind !== segment.currentSourceKind ||
      normalizedSegment.originalExternalPlaybackUrl !== segment.originalExternalPlaybackUrl ||
      normalizedSegment.originalExternalPreviewUrl !== segment.originalExternalPreviewUrl ||
      normalizedSegment.originalPlaybackUrl !== segment.originalPlaybackUrl ||
      normalizedSegment.originalPreviewUrl !== segment.originalPreviewUrl ||
      normalizedSegment.originalSourceKind !== segment.originalSourceKind;
    const hasOriginalTextChanges = normalizedOriginalText !== segment.originalText;
    const hasLocalizedTextChanges =
      !areWorkspaceSegmentEditorLocalizedTextMapsEqual(normalizedTextByLanguage, segment.textByLanguage) ||
      !areWorkspaceSegmentEditorLocalizedTextMapsEqual(normalizedOriginalTextByLanguage, segment.originalTextByLanguage);
    const hasAiPhotoChanges =
      normalizedAiPhotoPrompt !== segment.aiPhotoPrompt ||
      normalizedAiPhotoGeneratedFromPrompt !== segment.aiPhotoGeneratedFromPrompt ||
      normalizedAiPhotoPromptInitialized !== segment.aiPhotoPromptInitialized ||
      normalizedAiVideoPrompt !== segment.aiVideoPrompt ||
      normalizedAiVideoGeneratedFromPrompt !== segment.aiVideoGeneratedFromPrompt ||
      normalizedAiVideoGeneratedMode !== segment.aiVideoGeneratedMode ||
      normalizedAiVideoPromptInitialized !== segment.aiVideoPromptInitialized ||
      normalizedImageEditPrompt !== segment.imageEditPrompt ||
      normalizedImageEditGeneratedFromPrompt !== segment.imageEditGeneratedFromPrompt ||
      normalizedImageEditPromptInitialized !== segment.imageEditPromptInitialized ||
      normalizedVideoAction !== segment.videoAction ||
      normalizedMediaType !== segment.mediaType;

    if (
      segment.customVideo ||
      segment.aiPhotoAsset ||
      segment.aiVideoAsset ||
      segment.imageEditAsset ||
      segment.photoAnimationSourceAsset ||
      normalizedVideoAction === "original" ||
      normalizedVideoAction === "ai" ||
      normalizedVideoAction === "custom" ||
      normalizedVideoAction === "ai_photo" ||
      normalizedVideoAction === "image_edit" ||
      normalizedVideoAction === "photo_animation"
    ) {
      if (!hasUrlChanges && !hasOriginalTextChanges && !hasLocalizedTextChanges && !hasAiPhotoChanges) {
        return segment;
      }

      hasChanges = true;
      return {
        ...normalizedSegment,
        aiPhotoAsset: cloneStudioCustomVideoFile(segment.aiPhotoAsset),
        aiPhotoGeneratedFromPrompt: normalizedAiPhotoGeneratedFromPrompt,
        aiPhotoPrompt: normalizedAiPhotoPrompt,
        aiPhotoPromptInitialized: normalizedAiPhotoPromptInitialized,
        aiVideoAsset: cloneStudioCustomVideoFile(segment.aiVideoAsset),
        aiVideoGeneratedMode: normalizedAiVideoGeneratedMode,
        aiVideoGeneratedFromPrompt: normalizedAiVideoGeneratedFromPrompt,
        aiVideoPrompt: normalizedAiVideoPrompt,
        aiVideoPromptInitialized: normalizedAiVideoPromptInitialized,
        customVideo: cloneStudioCustomVideoFile(segment.customVideo),
        imageEditAsset: cloneStudioCustomVideoFile(segment.imageEditAsset),
        imageEditGeneratedFromPrompt: normalizedImageEditGeneratedFromPrompt,
        imageEditPrompt: normalizedImageEditPrompt,
        imageEditPromptInitialized: normalizedImageEditPromptInitialized,
        mediaType: normalizedMediaType,
        originalText: normalizedOriginalText,
        originalTextByLanguage: normalizedOriginalTextByLanguage,
        photoAnimationSourceAsset: cloneStudioCustomVideoFile(segment.photoAnimationSourceAsset),
        textByLanguage: normalizedTextByLanguage,
        videoAction: normalizedVideoAction,
        visualReset: Boolean(segment.visualReset),
      };
    }

    hasChanges = true;
    return {
      ...normalizedSegment,
      aiPhotoAsset: null,
      aiPhotoGeneratedFromPrompt: normalizedAiPhotoGeneratedFromPrompt,
      aiPhotoPrompt: normalizedAiPhotoPrompt,
      aiPhotoPromptInitialized: normalizedAiPhotoPromptInitialized,
      aiVideoAsset: null,
      aiVideoGeneratedMode: normalizedAiVideoGeneratedMode,
      aiVideoGeneratedFromPrompt: normalizedAiVideoGeneratedFromPrompt,
      aiVideoPrompt: normalizedAiVideoPrompt,
      aiVideoPromptInitialized: normalizedAiVideoPromptInitialized,
      imageEditAsset: null,
      imageEditGeneratedFromPrompt: normalizedImageEditGeneratedFromPrompt,
      imageEditPrompt: normalizedImageEditPrompt,
      imageEditPromptInitialized: normalizedImageEditPromptInitialized,
      mediaType: normalizedMediaType,
      originalText: normalizedOriginalText,
      originalTextByLanguage: normalizedOriginalTextByLanguage,
      photoAnimationSourceAsset: null,
      textByLanguage: normalizedTextByLanguage,
      videoAction: "original" as const,
      visualReset: Boolean(segment.visualReset),
    };
  });

  const visualResetSegments = segments.map((segment) => {
    if (!segment.visualReset) {
      return segment;
    }

    hasChanges = true;
    return resetWorkspaceSegmentDraftVisualToOriginal(segment, session.projectId);
  });
  const normalizedSegments = rebuildWorkspaceSegmentEditorDraftTimeline(visualResetSegments);

  return hasChanges || normalizedSegments !== visualResetSegments
    ? {
        ...session,
        segments: normalizedSegments,
      }
    : session;
};

type WorkspaceSegmentEditorUploadFile = {
  fieldName: string;
  file: File;
  fileName: string;
};

/** If the user opened a generation mode but never produced an asset, export uses the segment's original media. */
const resolveWorkspaceSegmentExportVideoAction = (
  segment: WorkspaceSegmentEditorDraftSegment,
): WorkspaceSegmentEditorVideoAction => {
  const { videoAction } = segment;
  if (videoAction === "ai" && !hasWorkspaceSegmentDisplayAiVideoAsset(segment, "ai_video")) {
    return "original";
  }
  if (videoAction === "photo_animation" && !hasWorkspaceSegmentDisplayAiVideoAsset(segment, "photo_animation")) {
    return "original";
  }
  if (videoAction === "ai_photo" && !isWorkspaceSegmentAiPhotoReady(segment)) {
    return "original";
  }
  if (videoAction === "image_edit" && !isWorkspaceSegmentImageEditReady(segment)) {
    return "original";
  }
  if (videoAction === "custom" && !segment.customVideo) {
    return "original";
  }
  return videoAction;
};

const buildWorkspaceSegmentEditorPayload = async (
  session: WorkspaceSegmentEditorDraftSession,
  options: {
    language: StudioLanguage;
  },
): Promise<{ payload: WorkspaceSegmentEditorPayload; uploads: WorkspaceSegmentEditorUploadFile[] }> => {
  const segments: WorkspaceSegmentEditorPayloadSegment[] = [];
  const uploads: WorkspaceSegmentEditorUploadFile[] = [];
  const normalizedSegments = rebuildWorkspaceSegmentEditorDraftTimeline(session.segments);

  for (const segment of normalizedSegments) {
    const exportAction = resolveWorkspaceSegmentExportVideoAction(segment);
    const selectedAiVideoAsset =
      exportAction === "ai"
        ? hasWorkspaceSegmentDisplayAiVideoAsset(segment, "ai_video")
          ? segment.aiVideoAsset
          : null
        : exportAction === "photo_animation"
          ? hasWorkspaceSegmentDisplayAiVideoAsset(segment, "photo_animation")
            ? segment.aiVideoAsset
            : null
          : null;
    const customVisualAsset =
      exportAction === "custom"
        ? segment.customVideo
        : exportAction === "image_edit"
          ? segment.imageEditAsset
        : exportAction === "ai_photo"
          ? segment.aiPhotoAsset
          : selectedAiVideoAsset
            ? selectedAiVideoAsset
            : null;
    const payloadVideoAction: WorkspaceSegmentEditorPayloadVideoAction =
      exportAction === "ai_photo" || exportAction === "image_edit" || Boolean(selectedAiVideoAsset)
        ? "custom"
        : exportAction === "photo_animation"
          ? "original"
          : exportAction;
    let customVideoFileDataUrl: string | undefined;
    let customVideoAssetId: number | undefined;
    let customVideoFileUploadKey: string | undefined;
    let customVideoRemoteUrl: string | undefined;

    if (payloadVideoAction === "custom") {
      if (customVisualAsset?.assetId) {
        customVideoAssetId = customVisualAsset.assetId;
      } else if (customVisualAsset) {
        customVideoAssetId = (await ensureStudioUploadedAssetId(customVisualAsset, {
          fallbackFileName: customVisualAsset.fileName || `segment-visual-${segment.index + 1}.bin`,
          fallbackMimeType: customVisualAsset.mimeType,
          kind: "segment_source",
          language: options.language,
          mediaType: getWorkspaceSegmentCustomPreviewKind(customVisualAsset) === "image" ? "photo" : "video",
          projectId: session.projectId,
          role: "segment_source",
          segmentIndex: segment.index,
        })) ?? undefined;
      }

      if (!customVideoAssetId && typeof customVisualAsset?.remoteUrl === "string" && customVisualAsset.remoteUrl.trim()) {
        customVideoRemoteUrl = customVisualAsset.remoteUrl.trim();
      } else {
        customVideoFileDataUrl = customVideoAssetId ? undefined : await resolveStudioCustomAssetDataUrl(customVisualAsset);
      }
    }

    segments.push({
      customVideoAssetId,
      customVideoFileDataUrl,
      customVideoFileMimeType: payloadVideoAction === "custom" ? customVisualAsset?.mimeType : undefined,
      customVideoFileName: payloadVideoAction === "custom" ? customVisualAsset?.fileName : undefined,
      customVideoRemoteUrl,
      customVideoFileUploadKey,
      duration: segment.duration,
      endTime: segment.endTime,
      // Keep the original segment identity in `index`; array order carries the new sequence after reorder.
      index: segment.index,
      resetVisual: Boolean(segment.visualReset),
      startTime: segment.startTime,
      text: segment.text,
      videoAction: payloadVideoAction,
    });
  }

  return {
    payload: {
      projectId: session.projectId,
      segments,
    },
    uploads,
  };
};

const isWorkspaceSegmentEditorNotFoundError = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized === "not found" || normalized.includes("404");
};

const getWorkspaceSegmentExternalVideoFallbackUrls = (segment: WorkspaceSegmentEditorDraftSegment) =>
  getUniqueWorkspaceSegmentPreviewUrls([
    segment.currentExternalPlaybackUrl,
    segment.originalExternalPlaybackUrl,
    segment.currentExternalPreviewUrl,
    segment.originalExternalPreviewUrl,
  ]);

const getWorkspaceSegmentPersistedSourceKind = (segment: WorkspaceSegmentEditorDraftSegment): WorkspaceSegmentSourceKind =>
  segment.currentSourceKind !== "unknown" ? segment.currentSourceKind : segment.originalSourceKind;

const getWorkspaceSegmentVisualResetPreviewUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (!segment.visualReset) {
    return null;
  }

  if (isWorkspaceSegmentStaleUploadOriginalVisual(segment)) {
    return segment.originalPreviewUrl ?? segment.originalPlaybackUrl ?? null;
  }

  return (
    segment.originalPreviewUrl ??
    segment.originalExternalPreviewUrl ??
    segment.originalPlaybackUrl ??
    segment.originalExternalPlaybackUrl ??
    null
  );
};

const getWorkspaceSegmentVisualResetVideoUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (!segment.visualReset) {
    return null;
  }

  if (isWorkspaceSegmentStaleUploadOriginalVisual(segment)) {
    return segment.originalPlaybackUrl ?? segment.originalPreviewUrl ?? null;
  }

  return (
    segment.originalPlaybackUrl ??
    segment.originalExternalPlaybackUrl ??
    segment.originalPreviewUrl ??
    segment.originalExternalPreviewUrl ??
    null
  );
};

const getWorkspaceSegmentDraftPreviewUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (segment.visualReset) {
    return getWorkspaceSegmentVisualResetPreviewUrl(segment);
  }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);
  const preferredStillPreviewUrl = getWorkspaceSegmentPreferredStillPreviewUrl(segment);
  const fallbackStillPreviewUrl =
    preferredStillPreviewUrl ??
    (segment.mediaType === "photo"
      ? null
      : segment.currentPreviewUrl ??
        segment.originalPreviewUrl ??
        segment.currentExternalPreviewUrl ??
        segment.originalExternalPreviewUrl);
  const fallbackPreviewUrl =
    fallbackStillPreviewUrl ??
    segment.currentPlaybackUrl ??
    segment.originalPlaybackUrl ??
    segment.currentExternalPlaybackUrl ??
    segment.originalExternalPlaybackUrl;

  if (latestVisualAction === "ai") {
    const displayGeneratedVideoUrl = getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "ai_video");
    return (
      (displayGeneratedVideoUrl ? getWorkspaceAiVideoPreferredPosterUrl(segment, segment.aiVideoAsset) : null) ??
      displayGeneratedVideoUrl ??
      fallbackStillPreviewUrl ??
      fallbackPreviewUrl
    );
  }

  if (latestVisualAction === "photo_animation") {
    const displayGeneratedVideoUrl = getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "photo_animation");
    const sourcePreviewUrl = getWorkspacePhotoAnimationSourcePosterUrl(segment);
    return (
      (displayGeneratedVideoUrl ? getWorkspacePhotoAnimationPreferredPosterUrl(segment, segment.aiVideoAsset) : null) ??
      displayGeneratedVideoUrl ??
      sourcePreviewUrl ??
      fallbackStillPreviewUrl ??
      fallbackPreviewUrl
    );
  }

  if (segment.videoAction === "custom") {
    const customPreviewUrl = getStudioCustomAssetPreviewUrl(segment.customVideo);
    return getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "video"
      ? getStudioCustomAssetPosterUrl(segment.customVideo)
      : customPreviewUrl ?? fallbackPreviewUrl;
  }

  if (segment.videoAction === "image_edit") {
    return getStudioCustomAssetPreviewUrl(segment.imageEditAsset) ?? fallbackPreviewUrl;
  }

  if (segment.videoAction === "ai_photo") {
    return (
      getStudioCustomAssetPreviewUrl(segment.aiPhotoAsset) ??
      fallbackPreviewUrl
    );
  }

  if (segment.videoAction === "original") {
    if (isWorkspaceSegmentServerPhotoAnimationOverride(segment)) {
      return (
        getWorkspacePhotoAnimationSourcePosterUrl(segment) ??
        segment.currentPreviewUrl ??
        segment.currentExternalPreviewUrl ??
        segment.currentPlaybackUrl ??
        segment.currentExternalPlaybackUrl ??
        fallbackStillPreviewUrl ??
        fallbackPreviewUrl
      );
    }

    if (segment.mediaType === "video") {
      return (
        segment.originalPreviewUrl ??
        segment.originalPlaybackUrl ??
        segment.currentPreviewUrl ??
        segment.currentPlaybackUrl ??
        preferredStillPreviewUrl ??
        segment.originalExternalPreviewUrl ??
        segment.currentExternalPreviewUrl ??
        segment.originalExternalPlaybackUrl ??
        segment.currentExternalPlaybackUrl
      );
    }

    return (
      preferredStillPreviewUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl
    );
  }

  if (segment.mediaType === "photo") {
    return preferredStillPreviewUrl;
  }

  return (
    segment.currentPreviewUrl ??
    segment.currentPlaybackUrl ??
    preferredStillPreviewUrl ??
    segment.currentExternalPreviewUrl ??
    segment.currentExternalPlaybackUrl ??
    segment.originalPreviewUrl ??
    segment.originalPlaybackUrl ??
    segment.originalExternalPreviewUrl ??
    segment.originalExternalPlaybackUrl
  );
};

const getWorkspaceSegmentDraftFallbackPosterUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (segment.visualReset) {
    return null;
  }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (latestVisualAction === "photo_animation") {
    return (
      getWorkspacePhotoAnimationSourcePosterUrl(segment) ??
      segment.currentExternalPreviewUrl ??
      segment.originalExternalPreviewUrl ??
      segment.currentPreviewUrl ??
      segment.originalPreviewUrl ??
      null
    );
  }

  if (segment.videoAction === "original" && segment.mediaType === "video") {
    if (
      segment.originalPreviewUrl ||
      segment.originalPlaybackUrl ||
      segment.currentPreviewUrl ||
      segment.currentPlaybackUrl
    ) {
      return null;
    }

    return segment.originalExternalPreviewUrl ?? segment.currentExternalPreviewUrl ?? null;
  }

  if (segment.videoAction === "custom" && getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "video") {
    // A user-selected custom video must not inherit the previous segment still frame.
    // Otherwise the carousel keeps showing the old photo until playback starts.
    return null;
  }

  return null;
};

const getWorkspaceSegmentDraftPreviewFallbackUrls = (
  segment: WorkspaceSegmentEditorDraftSegment,
  previewKind: WorkspaceSegmentPreviewKind,
) => {
  if (segment.visualReset) {
    return getUniqueWorkspaceSegmentPreviewUrls([
      segment.originalPlaybackUrl,
      segment.originalPreviewUrl,
      ...(isWorkspaceSegmentStaleUploadOriginalVisual(segment)
        ? []
        : [segment.originalExternalPlaybackUrl, segment.originalExternalPreviewUrl]),
    ]);
  }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (previewKind === "image") {
    const stillPreviewFallbackUrls = getWorkspaceSegmentStillPreviewUrls(segment);

    if (latestVisualAction === "custom") {
      return getUniqueWorkspaceSegmentPreviewUrls([
        getStudioCustomAssetPreviewUrl(segment.customVideo),
        ...stillPreviewFallbackUrls,
      ]);
    }

    if (latestVisualAction === "ai_photo") {
      return getUniqueWorkspaceSegmentPreviewUrls([
        getStudioCustomAssetPreviewUrl(segment.aiPhotoAsset),
        ...stillPreviewFallbackUrls,
      ]);
    }

    if (latestVisualAction === "image_edit") {
      return getUniqueWorkspaceSegmentPreviewUrls([
        getStudioCustomAssetPreviewUrl(segment.imageEditAsset),
        ...stillPreviewFallbackUrls,
      ]);
    }

    if (latestVisualAction === "original") {
      return stillPreviewFallbackUrls;
    }

    if (latestVisualAction === "photo_animation") {
      return getUniqueWorkspaceSegmentPreviewUrls([
        getWorkspacePhotoAnimationSourcePosterUrl(segment),
        ...stillPreviewFallbackUrls,
      ]);
    }

    return stillPreviewFallbackUrls;
  }

  if (latestVisualAction === "ai" || latestVisualAction === "photo_animation") {
    const displayGeneratedVideoUrl =
      latestVisualAction === "ai"
        ? getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "ai_video")
        : getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "photo_animation");

    if (!displayGeneratedVideoUrl) {
      return getUniqueWorkspaceSegmentPreviewUrls([
        segment.currentPlaybackUrl,
        segment.originalPlaybackUrl,
        segment.currentPreviewUrl,
        segment.originalPreviewUrl,
        ...getWorkspaceSegmentExternalVideoFallbackUrls(segment),
      ]);
    }

    // Generated video previews must never silently fall back to the original segment media.
    // Otherwise the UI can display the old source clip/photo when the generated asset
    // has a transient loading issue, which looks like the generation used the wrong source.
    return [];
  }

  if (latestVisualAction === "custom") {
    if (segment.customVideo?.source === "media-library" && getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "video") {
      return getUniqueWorkspaceSegmentPreviewUrls([getStudioCustomAssetPreviewUrl(segment.customVideo)]);
    }

    return getUniqueWorkspaceSegmentPreviewUrls([
      getStudioCustomAssetPreviewUrl(segment.customVideo),
      segment.currentPlaybackUrl,
      segment.originalPlaybackUrl,
      segment.currentPreviewUrl,
      segment.originalPreviewUrl,
      ...getWorkspaceSegmentExternalVideoFallbackUrls(segment),
    ]);
  }

  if (latestVisualAction === "original") {
    if (isWorkspaceSegmentServerPhotoAnimationOverride(segment)) {
      return getUniqueWorkspaceSegmentPreviewUrls([
        segment.currentPlaybackUrl,
        segment.currentExternalPlaybackUrl,
        segment.currentPreviewUrl,
        segment.currentExternalPreviewUrl,
      ]);
    }

    return getUniqueWorkspaceSegmentPreviewUrls([
      segment.originalPlaybackUrl,
      segment.originalExternalPlaybackUrl,
      segment.currentPlaybackUrl,
      segment.currentExternalPlaybackUrl,
      segment.originalPreviewUrl,
      segment.currentPreviewUrl,
      segment.originalExternalPreviewUrl,
      segment.currentExternalPreviewUrl,
    ]);
  }

  return getUniqueWorkspaceSegmentPreviewUrls([
    segment.currentPlaybackUrl,
    segment.originalPlaybackUrl,
    segment.currentPreviewUrl,
    segment.originalPreviewUrl,
    ...getWorkspaceSegmentExternalVideoFallbackUrls(segment),
  ]);
};

const getWorkspaceSegmentDraftVideoUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (segment.visualReset) {
    return getWorkspaceSegmentVisualResetVideoUrl(segment);
  }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (latestVisualAction === "ai") {
    return (
      getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "ai_video") ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl
    );
  }

  if (latestVisualAction === "photo_animation") {
    return (
      getWorkspaceSegmentDisplayAiVideoAssetUrl(segment, "photo_animation") ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl
    );
  }

  if (segment.videoAction === "custom") {
    return (
      getStudioCustomAssetPreviewUrl(segment.customVideo) ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl
    );
  }

  if (segment.videoAction === "image_edit") {
    return (
      getStudioCustomAssetPreviewUrl(segment.imageEditAsset) ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl
    );
  }

  if (segment.videoAction === "ai_photo") {
    return (
      getStudioCustomAssetPreviewUrl(segment.aiPhotoAsset) ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl
    );
  }

  if (segment.videoAction === "original") {
    if (isWorkspaceSegmentServerPhotoAnimationOverride(segment)) {
      return (
        segment.currentPlaybackUrl ??
        segment.currentExternalPlaybackUrl ??
        segment.currentPreviewUrl ??
        segment.currentExternalPreviewUrl ??
        segment.originalPlaybackUrl ??
        segment.originalExternalPlaybackUrl ??
        segment.originalPreviewUrl ??
        segment.originalExternalPreviewUrl
      );
    }

    return (
      segment.originalPlaybackUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPlaybackUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalPreviewUrl ??
      segment.originalExternalPreviewUrl ??
      segment.currentPreviewUrl ??
      segment.currentExternalPreviewUrl
    );
  }

  return (
    segment.currentPlaybackUrl ??
    segment.currentExternalPlaybackUrl ??
    segment.originalPlaybackUrl ??
    segment.originalExternalPlaybackUrl ??
    segment.currentPreviewUrl ??
    segment.currentExternalPreviewUrl ??
    segment.originalPreviewUrl ??
    segment.originalExternalPreviewUrl
  );
};

const getWorkspaceSegmentResolvedMediaSurface = (
  segment: WorkspaceSegmentEditorDraftSegment,
  context: WorkspaceResolvedMediaContext,
  options?: { isPlaybackRequested?: boolean },
): WorkspaceResolvedMediaSurface => {
  const previewKind = getWorkspaceSegmentPreviewKind(segment);
  const previewUrl = getWorkspaceSegmentDraftPreviewUrl(segment);
  const viewerUrl = previewKind === "video" ? getWorkspaceSegmentDraftVideoUrl(segment) : previewUrl;
  const fallbackPosterUrl = previewKind === "video" ? getWorkspaceSegmentDraftFallbackPosterUrl(segment) : null;
  const fallbackUrls = getWorkspaceSegmentDraftPreviewFallbackUrls(segment, previewKind);
  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);
  const shouldWarmCarouselVideoPlayback = context === "segment-carousel-card" && previewKind === "video";

  return resolveWorkspaceMediaSurface({
    context,
    displayUrl: previewKind === "image" ? previewUrl : viewerUrl,
    fallbackPosterUrl,
    fallbackUrls,
    forceMountVideoWhenIdle: latestVisualAction === "custom" || shouldWarmCarouselVideoPlayback,
    isGeneratedVideo: latestVisualAction === "ai" || latestVisualAction === "photo_animation",
    isPlaybackRequested: options?.isPlaybackRequested,
    posterUrl: previewKind === "video" ? previewUrl : null,
    previewKind,
    viewerUrl,
  });
};

const getWorkspaceMediaLibraryResolvedPosterUrl = (item: WorkspaceMediaLibraryItem) =>
  ((item.kind === "photo_animation" && isStudioSegmentPhotoAnimationPosterUrl(item.previewPosterUrl)) ||
    (item.kind === "ai_video" && isStudioSegmentAiVideoPosterUrl(item.previewPosterUrl)))
    ? null
    : item.previewPosterUrl;

const getWorkspaceMediaLibraryResolvedMediaSurface = (
  item: WorkspaceMediaLibraryItem,
  context: WorkspaceResolvedMediaContext,
): WorkspaceResolvedMediaSurface =>
  resolveWorkspaceMediaSurface({
    context,
    displayUrl: item.previewUrl,
    isGeneratedVideo: item.kind === "ai_video" || item.kind === "photo_animation",
    posterUrl: item.previewKind === "video" ? getWorkspaceMediaLibraryResolvedPosterUrl(item) : null,
    previewKind: item.previewKind,
    viewerUrl: item.previewUrl,
  });

const getWorkspaceSegmentDraftSourceLabel = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (isWorkspaceSegmentVisualResetApplied(segment)) {
    return "Сток";
  }

  const latestVisualAction = getWorkspaceSegmentLatestVisualAction(segment);

  if (latestVisualAction === "custom") {
    return segment.customVideo?.source === "media-library" ? "Медиатека" : "Свой визуал";
  }

  if (latestVisualAction === "image_edit") {
    return "Дорисовка";
  }

  if (latestVisualAction === "ai_photo") {
    return "ИИ фото";
  }

  if (latestVisualAction === "photo_animation") {
    return "ИИ анимация";
  }

  if (latestVisualAction === "ai") {
    return "ИИ видео";
  }

  const persistedSourceKind = getWorkspaceSegmentPersistedSourceKind(segment);
  if (persistedSourceKind === "ai_generated") {
    return segment.mediaType === "photo" ? "ИИ фото" : "ИИ видео";
  }

  if (persistedSourceKind === "upload") {
    return "Свой визуал";
  }

  return "Сток";
};

const formatWorkspaceSegmentEditorTime = (value: number, options?: { roundUp?: boolean }) => {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const totalSeconds = options?.roundUp ? Math.ceil(safeValue) : Math.floor(safeValue);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const getWorkspaceSegmentEditorGenerationOverrides = (
  session?: WorkspaceSegmentEditorDraftSession | null,
) => ({
  musicType: normalizeWorkspaceSegmentEditorSetting(session?.musicType),
  subtitleEnabled: normalizeWorkspaceSegmentEditorSetting(session?.subtitleType) !== "none",
  subtitleColorId:
    normalizeWorkspaceSegmentEditorSetting(session?.subtitleType) === "none"
      ? undefined
      : normalizeWorkspaceSegmentEditorSetting(session?.subtitleColor),
  subtitleStyleId:
    normalizeWorkspaceSegmentEditorSetting(session?.subtitleType) === "none"
      ? undefined
      : normalizeWorkspaceSegmentEditorSetting(session?.subtitleStyle),
  voiceEnabled: normalizeWorkspaceSegmentEditorSetting(session?.voiceType) !== "none",
  voiceId:
    normalizeWorkspaceSegmentEditorSetting(session?.voiceType) === "none"
      ? undefined
      : normalizeWorkspaceSegmentEditorSetting(session?.voiceType),
});

const isTextInputTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

const normalizeWorkspacePlan = (value: unknown) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
};

const normalizeWorkspaceBalance = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
};

const normalizeWorkspaceExpiry = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const normalizeWorkspaceStartPlanUsed = (value: unknown, plan: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;

  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return normalizeWorkspacePlan(plan) === "START";
};

const areWorkspaceProfilesEqual = (left: WorkspaceProfile | null | undefined, right: WorkspaceProfile | null | undefined) =>
  normalizeWorkspacePlan(left?.plan) === normalizeWorkspacePlan(right?.plan) &&
  normalizeWorkspaceBalance(left?.balance) === normalizeWorkspaceBalance(right?.balance) &&
  normalizeWorkspaceExpiry(left?.expiresAt) === normalizeWorkspaceExpiry(right?.expiresAt) &&
  normalizeWorkspaceStartPlanUsed(left?.startPlanUsed, left?.plan) ===
    normalizeWorkspaceStartPlanUsed(right?.startPlanUsed, right?.plan);

const STUDIO_PREVIEW_DISMISS_STORAGE_KEY_PREFIX = "adshorts.studio-preview-dismiss:";
const STUDIO_MEDIA_LIBRARY_HIDDEN_STORAGE_KEY_PREFIX = "adshorts.media-library-hidden:";
const STUDIO_CONTENT_PLAN_VISIBILITY_STORAGE_KEY_PREFIX = "adshorts.content-plan-visible:";
const STUDIO_BRAND_SETTINGS_STORAGE_KEY_PREFIX = "adshorts.studio-brand:";

const normalizeWorkspaceEmail = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();

const sanitizeWorkspaceContentPlanIdeaPrompt = (value: unknown) => {
  const fallbackPrompt = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!fallbackPrompt) {
    return "";
  }

  let normalized = fallbackPrompt.replace(/^["'`]+|["'`]+$/g, "").trim();
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

const normalizeWorkspaceContentPlanSourceMatchText = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim()
    .toLocaleLowerCase();

const isWorkspaceContentPlanSourceIdeaSynchronized = (
  prompt: string,
  sourceIdea: WorkspaceContentPlanComposerSource | null | undefined,
) => {
  if (!sourceIdea) {
    return false;
  }

  const normalizedPrompt = normalizeWorkspaceContentPlanSourceMatchText(prompt);
  const normalizedSourcePrompt = normalizeWorkspaceContentPlanSourceMatchText(sourceIdea.prompt);
  return Boolean(normalizedPrompt) && normalizedPrompt === normalizedSourcePrompt;
};

const getStudioPreviewDismissStorageKey = (email: string) => `${STUDIO_PREVIEW_DISMISS_STORAGE_KEY_PREFIX}${email}`;
const getStudioMediaLibraryHiddenStorageKey = (email: string) => `${STUDIO_MEDIA_LIBRARY_HIDDEN_STORAGE_KEY_PREFIX}${email}`;
const getStudioContentPlanVisibilityStorageKey = (email: string) =>
  `${STUDIO_CONTENT_PLAN_VISIBILITY_STORAGE_KEY_PREFIX}${email}`;
const getStudioBrandSettingsStorageKey = (email: string) => `${STUDIO_BRAND_SETTINGS_STORAGE_KEY_PREFIX}${email}`;

type StudioBrandSettingsSnapshot = {
  brandLogoFile: StudioBrandLogoFile | null;
  brandText: string;
};

type StoredStudioBrandSettings = {
  brandLogoFile?: {
    dataUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  } | null;
  brandText?: string;
};

const inferStudioBrandLogoExtension = (mimeType: string) => {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "image/avif") return ".avif";
  if (normalized === "image/png") return ".png";
  if (normalized === "image/webp") return ".webp";
  return ".jpg";
};

const readStoredStudioBrandSettings = (email: string | null | undefined): StudioBrandSettingsSnapshot => {
  if (typeof window === "undefined") {
    return { brandLogoFile: null, brandText: "" };
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return { brandLogoFile: null, brandText: "" };
  }

  try {
    const rawValue = window.localStorage.getItem(getStudioBrandSettingsStorageKey(normalizedEmail));
    if (!rawValue) {
      return { brandLogoFile: null, brandText: "" };
    }

    const parsed = JSON.parse(rawValue) as StoredStudioBrandSettings | null;
    const brandText = String(parsed?.brandText ?? "").slice(0, STUDIO_BRAND_TEXT_MAX_CHARS);
    const storedLogo = parsed?.brandLogoFile && typeof parsed.brandLogoFile === "object" ? parsed.brandLogoFile : null;
    const dataUrl = String(storedLogo?.dataUrl ?? "").trim();
    const mimeType =
      String(storedLogo?.mimeType ?? "").trim() ||
      String(dataUrl.match(/^data:([^;,]+);base64,/i)?.[1] ?? "").trim() ||
      "image/png";
    const fileSize = Math.max(0, Number(storedLogo?.fileSize ?? 0) || 0);
    const rawFileName = String(storedLogo?.fileName ?? "").trim();
    const fileName = isSupportedStudioBrandLogoFile(rawFileName)
      ? rawFileName
      : `brand-logo${inferStudioBrandLogoExtension(mimeType)}`;

    if (!dataUrl || !dataUrl.startsWith("data:image/") || fileSize > STUDIO_BRAND_LOGO_MAX_BYTES) {
      return { brandLogoFile: null, brandText };
    }

    return {
      brandLogoFile: {
        dataUrl,
        fileName,
        fileSize,
        mimeType,
      },
      brandText,
    };
  } catch {
    return { brandLogoFile: null, brandText: "" };
  }
};

const persistStudioBrandSettings = (
  email: string | null | undefined,
  settings: StudioBrandSettingsSnapshot,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return;
  }

  try {
    const storageKey = getStudioBrandSettingsStorageKey(normalizedEmail);
    const brandText = settings.brandText.trim().slice(0, STUDIO_BRAND_TEXT_MAX_CHARS);
    const logoDataUrl = String(settings.brandLogoFile?.dataUrl ?? "").trim();
    const payload: StoredStudioBrandSettings = {
      brandText,
      brandLogoFile:
        settings.brandLogoFile && logoDataUrl
          ? {
              dataUrl: logoDataUrl,
              fileName: settings.brandLogoFile.fileName,
              fileSize: settings.brandLogoFile.fileSize,
              mimeType: settings.brandLogoFile.mimeType,
            }
          : null,
    };

    if (!payload.brandText && !payload.brandLogoFile) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors.
  }
};

const getWorkspaceMediaLibraryItemStorageKey = (item: WorkspaceMediaLibraryItem) => item.itemKey;

const getWorkspaceMediaLibraryItemKindLabel = (
  kind: WorkspaceMediaLibraryItemKind,
  assetKind?: string | null,
) => {
  const normalizedAssetKind = String(assetKind ?? "").trim().toLowerCase();
  if (normalizedAssetKind === "final_video") {
    return "Готовое видео";
  }

  if (normalizedAssetKind === "custom_video" || normalizedAssetKind === "segment_source") {
    return "Загруженное видео";
  }

  if (normalizedAssetKind === "brand_logo" || normalizedAssetKind === "uploaded_photo") {
    return "Загруженное фото";
  }

  if (kind === "photo_animation") {
    return "ИИ анимация фото";
  }

  if (kind === "ai_video") {
    return "ИИ видео";
  }

  if (kind === "image_edit") {
    return "Дорисовать фото";
  }

  return "ИИ фото";
};

const renderWorkspaceMediaLibraryPlayOverlay = (previewKind: WorkspaceMediaLibraryPreviewKind): ReactNode => {
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

const getWorkspaceMediaLibraryItemRemoteUrl = (item: WorkspaceMediaLibraryItem) =>
  getWorkspaceMediaAssetResolvedPreviewUrl({
    assetId: item.assetId,
    fileName: item.downloadName,
    mimeType: getWorkspaceMediaLibraryItemMimeType(item),
    remoteUrl: item.previewKind === "video" ? item.previewUrl : item.previewUrl ?? item.downloadUrl,
  });

const getWorkspaceMediaLibraryItemMimeType = (item: WorkspaceMediaLibraryItem) =>
  item.previewKind === "video" ? "video/mp4" : "image/jpeg";

const createStudioCustomVideoFileFromMediaLibraryItem = (item: WorkspaceMediaLibraryItem): StudioCustomVideoFile => ({
  assetId: item.assetId ?? undefined,
  fileName: item.downloadName,
  fileSize: 0,
  libraryItemKey: getWorkspaceMediaLibraryItemStorageKey(item),
  mimeType: getWorkspaceMediaLibraryItemMimeType(item),
  posterUrl: item.previewKind === "video" ? getWorkspaceMediaLibraryResolvedPosterUrl(item) ?? undefined : undefined,
  remoteUrl: getWorkspaceMediaLibraryItemRemoteUrl(item) ?? undefined,
  source: "media-library",
});

const getWorkspaceGeneratedMediaLibraryRestoreKey = (
  projectId: number,
  segmentIndex: number,
  kind: WorkspaceMediaLibraryItemKind,
) => `${projectId}:${segmentIndex}:${kind}`;

const hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary = (
  draft: WorkspaceSegmentEditorDraftSession | null | undefined,
  generatedEntries: WorkspaceGeneratedMediaLibraryEntry[],
): WorkspaceSegmentEditorDraftSession | null => {
  if (!draft) {
    return null;
  }

  if (!generatedEntries.length) {
    return draft;
  }

  const latestItemsByRestoreKey = new Map<string, WorkspaceMediaLibraryItem>();
  generatedEntries
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt)
    .forEach((entry) => {
      const projectId = Number(entry.item.projectId);
      const segmentIndex = Number(entry.item.segmentIndex);
      if (!Number.isInteger(projectId) || projectId <= 0 || !Number.isInteger(segmentIndex) || segmentIndex < 0) {
        return;
      }

      const restoreKey = getWorkspaceGeneratedMediaLibraryRestoreKey(projectId, segmentIndex, entry.item.kind);
      if (!latestItemsByRestoreKey.has(restoreKey)) {
        latestItemsByRestoreKey.set(restoreKey, entry.item);
      }
    });

  let hasChanges = false;
  const nextSegments = draft.segments.map((segment) => {
    let nextSegment = segment;

    const applyPatch = (patch: Partial<WorkspaceSegmentEditorDraftSegment>) => {
      hasChanges = true;
      nextSegment = {
        ...nextSegment,
        ...patch,
      };
    };

    const resolveItem = (kind: WorkspaceMediaLibraryItemKind) =>
      latestItemsByRestoreKey.get(getWorkspaceGeneratedMediaLibraryRestoreKey(draft.projectId, segment.index, kind)) ?? null;

    if (!nextSegment.aiVideoAsset) {
      const aiVideoItem =
        nextSegment.videoAction === "ai" || nextSegment.aiVideoGeneratedMode === "ai_video"
          ? resolveItem("ai_video")
          : null;
      if (aiVideoItem) {
        applyPatch({
          aiVideoAsset: createStudioCustomVideoFileFromMediaLibraryItem(aiVideoItem),
          aiVideoGeneratedMode: "ai_video",
        });
      } else {
        const photoAnimationItem =
          nextSegment.videoAction === "photo_animation" || nextSegment.aiVideoGeneratedMode === "photo_animation"
            ? resolveItem("photo_animation")
            : null;
        if (photoAnimationItem) {
          applyPatch({
            aiVideoAsset: createStudioCustomVideoFileFromMediaLibraryItem(photoAnimationItem),
            aiVideoGeneratedMode: "photo_animation",
          });
        }
      }
    }

    if (!nextSegment.aiPhotoAsset && nextSegment.videoAction === "ai_photo") {
      const aiPhotoItem = resolveItem("ai_photo");
      if (aiPhotoItem) {
        applyPatch({
          aiPhotoAsset: createStudioCustomVideoFileFromMediaLibraryItem(aiPhotoItem),
        });
      }
    }

    if (!nextSegment.imageEditAsset && nextSegment.videoAction === "image_edit") {
      const imageEditItem = resolveItem("image_edit");
      if (imageEditItem) {
        applyPatch({
          imageEditAsset: createStudioCustomVideoFileFromMediaLibraryItem(imageEditItem),
        });
      }
    }

    return nextSegment;
  });

  return hasChanges
    ? {
        ...draft,
        segments: nextSegments,
      }
    : draft;
};

const getStudioPreviewDismissKey = (
  generation: Pick<StudioGeneration, "adId" | "id" | "videoUrl"> | null | undefined,
) => {
  const normalizedId = String(generation?.id ?? "").trim();
  if (normalizedId) {
    return `id:${normalizedId}`;
  }

  if (typeof generation?.adId === "number" && generation.adId > 0) {
    return `ad:${generation.adId}`;
  }

  const normalizedVideoUrl = String(generation?.videoUrl ?? "").trim();
  return normalizedVideoUrl ? `url:${normalizedVideoUrl}` : null;
};

const readDismissedStudioPreviewKey = (email: string | null | undefined) => {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  try {
    const storageValue = window.sessionStorage.getItem(getStudioPreviewDismissStorageKey(normalizedEmail));
    return String(storageValue ?? "").trim() || null;
  } catch {
    return null;
  }
};

const persistDismissedStudioPreviewKey = (email: string | null | undefined, dismissKey: string | null) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return;
  }

  try {
    const storageKey = getStudioPreviewDismissStorageKey(normalizedEmail);
    const normalizedDismissKey = String(dismissKey ?? "").trim();

    if (!normalizedDismissKey) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    window.sessionStorage.setItem(storageKey, normalizedDismissKey);
  } catch {
    // Ignore storage write errors.
  }
};

const readHiddenMediaLibraryItemKeys = (email: string | null | undefined) => {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return [] as string[];
  }

  try {
    const storageValue = window.localStorage.getItem(getStudioMediaLibraryHiddenStorageKey(normalizedEmail));
    if (!storageValue) {
      return [] as string[];
    }

    const parsed = JSON.parse(storageValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [] as string[];
    }

    return Array.from(
      new Set(
        parsed
          .map((value) => String(value ?? "").trim())
          .filter((value) => Boolean(value)),
      ),
    );
  } catch {
    return [] as string[];
  }
};

const getDefaultStudioContentPlanVisibility = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }

  return !window.matchMedia("(max-width: 1100px)").matches;
};

const readStudioContentPlanVisibility = (email: string | null | undefined) => {
  if (typeof window === "undefined") {
    return true;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return getDefaultStudioContentPlanVisibility();
  }

  try {
    const storageValue = window.localStorage.getItem(getStudioContentPlanVisibilityStorageKey(normalizedEmail));
    if (storageValue === "1" || storageValue === "true") {
      return true;
    }

    if (storageValue === "0" || storageValue === "false") {
      return false;
    }
  } catch {
    return getDefaultStudioContentPlanVisibility();
  }

  return getDefaultStudioContentPlanVisibility();
};

const persistStudioContentPlanVisibility = (email: string | null | undefined, isVisible: boolean) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return;
  }

  try {
    window.localStorage.setItem(getStudioContentPlanVisibilityStorageKey(normalizedEmail), isVisible ? "1" : "0");
  } catch {
    // Ignore storage write errors.
  }
};

const persistHiddenMediaLibraryItemKeys = (email: string | null | undefined, keys: string[]) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return;
  }

  try {
    const storageKey = getStudioMediaLibraryHiddenStorageKey(normalizedEmail);
    const normalizedKeys = Array.from(
      new Set(
        keys
          .map((value) => String(value ?? "").trim())
          .filter((value) => Boolean(value)),
      ),
    );

    if (normalizedKeys.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(normalizedKeys));
  } catch {
    // Ignore storage write errors.
  }
};

const WORKSPACE_GENERATED_MEDIA_LIBRARY_STORAGE_KEY_PREFIX = "adshorts.generated-media-library:";
const WORKSPACE_GENERATED_MEDIA_LIBRARY_MAX_ENTRIES = 80;

const getWorkspaceGeneratedMediaLibraryStorageKey = (email: string) =>
  `${WORKSPACE_GENERATED_MEDIA_LIBRARY_STORAGE_KEY_PREFIX}${email}`;

const isWorkspaceMediaLibraryPreviewKind = (value: unknown): value is WorkspaceMediaLibraryPreviewKind =>
  value === "image" || value === "video";

const isWorkspaceMediaLibraryItemSource = (value: unknown): value is WorkspaceMediaLibraryItemSource =>
  value === "draft" || value === "live" || value === "persisted";

const isStoredWorkspaceGeneratedMediaLibraryEntry = (value: unknown): value is StoredWorkspaceGeneratedMediaLibraryEntry => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<StoredWorkspaceGeneratedMediaLibraryEntry>;
  const item = payload.item as Partial<WorkspaceMediaLibraryItem> | undefined;

  return (
    Number.isFinite(Number(payload.createdAt)) &&
    typeof payload.id === "string" &&
    typeof payload.sourceJobId === "string" &&
    Boolean(item) &&
    typeof item?.itemKey === "string" &&
    typeof item?.dedupeKey === "string" &&
    typeof item?.downloadName === "string" &&
    (typeof item?.downloadUrl === "string" || item?.downloadUrl === null) &&
    (item?.kind === "ai_photo" || item?.kind === "ai_video" || item?.kind === "photo_animation" || item?.kind === "image_edit") &&
    isWorkspaceMediaLibraryPreviewKind(item?.previewKind) &&
    (typeof item?.previewPosterUrl === "string" || item?.previewPosterUrl === null) &&
    typeof item?.previewUrl === "string" &&
    (typeof item?.createdAt === "number" || typeof item?.createdAt === "string" || typeof item?.createdAt === "undefined") &&
    Number.isFinite(Number(item?.projectId)) &&
    typeof item?.projectTitle === "string" &&
    Number.isFinite(Number(item?.segmentIndex)) &&
    Number.isFinite(Number(item?.segmentListIndex)) &&
    Number.isFinite(Number(item?.segmentNumber)) &&
    isWorkspaceMediaLibraryItemSource(item?.source)
  );
};

const normalizeStoredWorkspaceGeneratedMediaLibraryEntry = (
  entry: StoredWorkspaceGeneratedMediaLibraryEntry,
): WorkspaceGeneratedMediaLibraryEntry => ({
  createdAt: Math.max(0, Number(entry.createdAt) || 0),
  id: String(entry.id),
  item: {
    ...entry.item,
    createdAt: normalizeWorkspaceMediaLibraryCreatedAt(entry.item.createdAt ?? entry.createdAt),
    downloadUrl: entry.item.downloadUrl ?? null,
    previewPosterUrl:
      ((entry.item.kind === "photo_animation" && isStudioSegmentPhotoAnimationPosterUrl(entry.item.previewPosterUrl)) ||
      (entry.item.kind === "ai_video" && isStudioSegmentAiVideoPosterUrl(entry.item.previewPosterUrl)))
        ? null
        : entry.item.previewPosterUrl ?? null,
  },
  sourceJobId: String(entry.sourceJobId),
});

const readStoredGeneratedMediaLibraryEntries = (
  email: string | null | undefined,
): WorkspaceGeneratedMediaLibraryEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(getWorkspaceGeneratedMediaLibraryStorageKey(normalizedEmail));
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isStoredWorkspaceGeneratedMediaLibraryEntry)
      .map((entry) => normalizeStoredWorkspaceGeneratedMediaLibraryEntry(entry))
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, WORKSPACE_GENERATED_MEDIA_LIBRARY_MAX_ENTRIES);
  } catch {
    return [];
  }
};

const persistGeneratedMediaLibraryEntries = (
  email: string | null | undefined,
  entries: WorkspaceGeneratedMediaLibraryEntry[],
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return;
  }

  try {
    const storageKey = getWorkspaceGeneratedMediaLibraryStorageKey(normalizedEmail);
    const normalizedEntries = entries
      .slice()
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, WORKSPACE_GENERATED_MEDIA_LIBRARY_MAX_ENTRIES);

    if (normalizedEntries.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(normalizedEntries));
  } catch {
    // Ignore storage write errors.
  }
};

const applyWorkspaceContentPlanIdeaUpdate = (
  plans: WorkspaceContentPlan[],
  payload: WorkspaceContentPlanIdeaMutation,
) =>
  plans.map((plan) =>
    plan.id === payload.planId
      ? {
          ...plan,
          ideas: plan.ideas.map((idea) =>
            idea.id === payload.ideaId
              ? {
                  ...idea,
                  isUsed: payload.isUsed,
                  updatedAt: payload.ideaUpdatedAt,
                  usedAt: payload.usedAt,
                }
              : idea,
          ),
          updatedAt: payload.planUpdatedAt,
        }
      : plan,
  );

const removeWorkspaceContentPlanIdea = (
  plans: WorkspaceContentPlan[],
  payload: {
    ideaId: string;
    planId: string;
    updatedAt: string;
  },
) =>
  plans.map((plan) =>
    plan.id !== payload.planId
      ? plan
      : {
          ...plan,
          ideas: plan.ideas.filter((idea) => idea.id !== payload.ideaId),
          updatedAt: payload.updatedAt,
        },
  );

const getVideoDownloadName = getWorkspaceVideoDownloadName;
const getImageDownloadName = getWorkspaceImageDownloadName;

const buildStudioGenerationFromProject = (project: WorkspaceProject): StudioGeneration | null => {
  if (!project.videoUrl) return null;

  return {
    adId: project.adId,
    aspectRatio: "9:16",
    description: project.description,
    durationLabel: "Ready",
    generatedAt: project.generatedAt ?? project.updatedAt ?? project.createdAt,
    hashtags: project.hashtags,
    id: project.jobId ?? project.id,
    modelLabel: "AdsFlow pipeline",
    prefillSettings: project.prefillSettings ?? null,
    prompt: project.prompt,
    title: project.title,
    videoFallbackUrl: project.videoFallbackUrl,
    videoUrl: project.videoUrl,
  };
};

const appendUrlToken = (value: string | null | undefined, key: string, token: string | number | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  const normalizedToken = String(token ?? "").trim();
  if (!normalizedValue || !normalizedToken) return normalizedValue || null;

  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const resolvedUrl = new URL(normalizedValue, baseUrl);
    resolvedUrl.searchParams.set(key, normalizedToken);

    if (/^https?:\/\//i.test(normalizedValue)) {
      return resolvedUrl.toString();
    }

    return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
  } catch {
    return normalizedValue;
  }
};

const getStudioStatusLabel = (value: string) => {
  switch (value) {
    case "queued":
      return "Task queued";
    case "processing":
      return "Генерация видео...";
    case "preparing_preview":
      return "Подготавливаем видео...";
    case "retrying":
      return "Retrying generation...";
    case "done":
      return "";
    case "failed":
      return "Generation failed";
    default:
      return "Генерация видео...";
  }
};

const getProjectStatusLabel = (value: string) => {
  switch (value) {
    case "ready":
      return "Готов";
    case "queued":
      return "В очереди";
    case "processing":
      return "Генерация";
    case "failed":
      return "Ошибка";
    case "draft":
      return "Черновик";
    default:
      return "Проект";
  }
};

const getProjectStatusClassName = (value: string) => {
  switch (value) {
    case "ready":
      return "account-status--ready";
    case "queued":
    case "processing":
      return "account-status--processing";
    case "failed":
      return "account-status--failed";
    default:
      return "account-status--draft";
  }
};

const shouldShowProjectStatusBadge = (value: string) => value !== "ready";

const getProjectPreviewNote = (project: WorkspaceProject) => {
  if (project.videoUrl) {
    return "";
  }

  switch (project.status) {
    case "queued":
      return "В очереди на генерацию";
    case "processing":
      return "Собираем превью";
    case "failed":
      return "Видео не готово";
    default:
      return "Превью появится после рендера";
  }
};

const WORKSPACE_MEDIA_LIBRARY_FALLBACK_TIMESTAMP = "1970-01-01T00:00:00.000Z";

const createWorkspaceMediaLibraryProjectFromDraft = (
  draft: WorkspaceSegmentEditorDraftSession,
  options?: {
    generatedVideo?: StudioGeneration | null;
    project?: WorkspaceProject | null;
  },
): WorkspaceProject => {
  if (options?.project) {
    return options.project;
  }

  const matchingGeneration =
    options?.generatedVideo && options.generatedVideo.adId === draft.projectId ? options.generatedVideo : null;
  const normalizedGeneratedAt = String(matchingGeneration?.generatedAt ?? "").trim() || null;
  const fallbackTimestamp = normalizedGeneratedAt ?? WORKSPACE_MEDIA_LIBRARY_FALLBACK_TIMESTAMP;

  return {
    adId: draft.projectId,
    createdAt: fallbackTimestamp,
    description: draft.description,
    editedFromProjectAdId: null,
    generatedAt: normalizedGeneratedAt,
    hashtags: [],
    id: String(matchingGeneration?.id ?? `draft:${draft.projectId}`),
    jobId: matchingGeneration?.id ?? null,
    prompt: matchingGeneration?.prompt ?? "",
    source: "project",
    status: "ready",
    title: matchingGeneration?.title ?? draft.title,
    updatedAt: fallbackTimestamp,
    versionRootProjectAdId: null,
    posterUrl: null,
    videoFallbackUrl: matchingGeneration?.videoFallbackUrl ?? null,
    videoUrl: matchingGeneration?.videoUrl ?? null,
    youtubePublication: null,
  };
};

const buildWorkspaceMediaLibraryDraftItems = (
  project: WorkspaceProject,
  draft: WorkspaceSegmentEditorDraftSession,
): WorkspaceMediaLibraryItem[] => {
  const projectId = project.adId ?? draft.projectId;
  const projectTitle = getWorkspaceProjectDisplayTitle(project);
  const downloadToken = project.updatedAt || project.generatedAt || project.createdAt || project.id;
  const createdAt = normalizeWorkspaceMediaLibraryCreatedAt(project.updatedAt || project.generatedAt || project.createdAt);

  return draft.segments.flatMap((segment, segmentListIndex) => {
    const items: WorkspaceMediaLibraryItem[] = [];
    const aiPhotoPreviewUrl = getStudioCustomAssetPreviewUrl(segment.aiPhotoAsset);
    const imageEditPreviewUrl = getStudioCustomAssetPreviewUrl(segment.imageEditAsset);
    const aiVideoPreviewUrl = getStudioCustomAssetPreviewUrl(segment.aiVideoAsset);
    const aiVideoPosterUrl =
      segment.aiVideoGeneratedMode === "photo_animation"
        ? getWorkspacePhotoAnimationPreferredPosterUrl(segment, segment.aiVideoAsset)
        : getWorkspaceAiVideoPreferredPosterUrl(segment, segment.aiVideoAsset);

    if (aiPhotoPreviewUrl) {
      items.push(createWorkspaceMediaLibraryItem({
        assetId: segment.aiPhotoAsset?.assetId ?? undefined,
        createdAt,
        downloadName: getImageDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-ai-photo`),
        downloadUrl: appendUrlToken(aiPhotoPreviewUrl, "download", `${downloadToken}:${segment.index}:draft-ai-photo`),
        kind: "ai_photo",
        previewKind: "image",
        previewPosterUrl: aiPhotoPreviewUrl,
        previewUrl: aiPhotoPreviewUrl,
        projectId,
        projectTitle,
        segmentIndex: segment.index,
        segmentListIndex,
        source: "draft",
      }));
    }

    if (imageEditPreviewUrl) {
      items.push(createWorkspaceMediaLibraryItem({
        assetId: segment.imageEditAsset?.assetId ?? undefined,
        createdAt,
        downloadName: getImageDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-i2i`),
        downloadUrl: appendUrlToken(imageEditPreviewUrl, "download", `${downloadToken}:${segment.index}:draft-image-edit`),
        kind: "image_edit",
        previewKind: "image",
        previewPosterUrl: imageEditPreviewUrl,
        previewUrl: imageEditPreviewUrl,
        projectId,
        projectTitle,
        segmentIndex: segment.index,
        segmentListIndex,
        source: "draft",
      }));
    }

    if (aiVideoPreviewUrl && segment.aiVideoGeneratedMode === "ai_video") {
      items.push(createWorkspaceMediaLibraryItem({
        assetId: segment.aiVideoAsset?.assetId ?? undefined,
        createdAt,
        downloadName: getVideoDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-ai-video`),
        downloadUrl: appendUrlToken(aiVideoPreviewUrl, "download", `${downloadToken}:${segment.index}:draft-ai-video`),
        kind: "ai_video",
        previewKind: "video",
        previewPosterUrl: aiVideoPosterUrl,
        previewUrl: aiVideoPreviewUrl,
        projectId,
        projectTitle,
        segmentIndex: segment.index,
        segmentListIndex,
        source: "draft",
      }));
    }

    if (aiVideoPreviewUrl && segment.aiVideoGeneratedMode === "photo_animation") {
      items.push(createWorkspaceMediaLibraryItem({
        assetId: segment.aiVideoAsset?.assetId ?? undefined,
        createdAt,
        downloadName: getVideoDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-animation`),
        downloadUrl: appendUrlToken(aiVideoPreviewUrl, "download", `${downloadToken}:${segment.index}:draft-animation`),
        kind: "photo_animation",
        previewKind: "video",
        previewPosterUrl: aiVideoPosterUrl,
        previewUrl: aiVideoPreviewUrl,
        projectId,
        projectTitle,
        segmentIndex: segment.index,
        segmentListIndex,
        source: "draft",
      }));
    }

    return items;
  });
};

const buildWorkspaceGeneratedMediaLibraryEntry = (options: {
  asset: StudioCustomVideoFile;
  kind: WorkspaceMediaLibraryItemKind;
  project: WorkspaceProject;
  segment: WorkspaceSegmentEditorDraftSegment;
  segmentListIndex: number;
  sourceJobId: string;
}) => {
  const previewUrl = getStudioCustomAssetPreviewUrl(options.asset);
  if (!previewUrl) {
    return null;
  }

  const project = cloneWorkspaceProject(options.project);
  const projectId = project.adId ?? 0;
  if (!projectId) {
    return null;
  }

  const projectTitle = getWorkspaceProjectDisplayTitle(project);
  const segment = cloneWorkspaceSegmentEditorDraftSegment(options.segment);
  const segmentNumber = options.segmentListIndex + 1;
  const downloadToken = project.updatedAt || project.generatedAt || project.createdAt || project.id;
  const previewKind = options.kind === "ai_photo" || options.kind === "image_edit" ? "image" : "video";
  const previewPosterUrl =
    options.kind === "ai_photo" || options.kind === "image_edit"
      ? previewUrl
      : options.kind === "photo_animation"
        ? getWorkspacePhotoAnimationPreferredPosterUrl(segment, options.asset)
        : getWorkspaceAiVideoPreferredPosterUrl(segment, options.asset);
  const downloadName =
    options.kind === "ai_photo"
      ? getImageDownloadName(`${projectTitle}-segment-${segmentNumber}-ai-photo`)
      : options.kind === "image_edit"
        ? getImageDownloadName(`${projectTitle}-segment-${segmentNumber}-i2i`)
      : options.kind === "photo_animation"
        ? getVideoDownloadName(`${projectTitle}-segment-${segmentNumber}-animation`)
        : getVideoDownloadName(`${projectTitle}-segment-${segmentNumber}-ai-video`);
  const downloadUrl = appendUrlToken(previewUrl, "download", `${downloadToken}:${segment.index}:${options.sourceJobId}`);
  const item = createWorkspaceMediaLibraryItem({
    assetId: options.asset.assetId ?? undefined,
    createdAt: Date.now(),
    downloadName,
    downloadUrl,
    kind: options.kind,
    previewKind,
    previewPosterUrl,
    previewUrl,
    projectId,
    projectTitle,
    segmentIndex: segment.index,
    segmentListIndex: options.segmentListIndex,
    source: "live",
    sourceJobId: options.sourceJobId,
  });

  return {
    createdAt: item.createdAt,
    id: item.itemKey,
    item,
    sourceJobId: options.sourceJobId,
  } satisfies WorkspaceGeneratedMediaLibraryEntry;
};

const captureProjectPoster = (
  videoUrl: string,
  options?: {
    previewTime?: number;
    useSegmentPreviewTime?: boolean;
  },
) =>
  new Promise<string>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Document is not available."));
      return;
    }

    const video = document.createElement("video");
    let settled = false;
    let shouldSeekPreviewFrame = true;
    const timeoutId = window.setTimeout(() => {
      fail(new Error("Poster capture timed out."));
    }, 12000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const drawFrame = () => {
      if (settled) return;

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        fail(new Error("Video dimensions are unavailable."));
        return;
      }

      const targetSize = getPosterCaptureSize(width, height);
      const canvas = document.createElement("canvas");
      canvas.width = targetSize.width;
      canvas.height = targetSize.height;
      const context = canvas.getContext("2d");

      if (!context) {
        fail(new Error("Canvas context is unavailable."));
        return;
      }

      context.drawImage(video, 0, 0, targetSize.width, targetSize.height);
      settled = true;
      cleanup();
      resolve(canvas.toDataURL("image/jpeg", PROJECT_POSTER_CAPTURE_QUALITY));
    };

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    video.onloadeddata = () => {
      if (settled) return;

      const preferredPreviewTime = Number.isFinite(options?.previewTime)
        ? Math.max(0, Number(options?.previewTime))
        : options?.useSegmentPreviewTime
          ? getWorkspaceSegmentPausedPreviewTime(video.duration)
          : 0.15;
      const previewTime = Number.isFinite(video.duration) && video.duration > preferredPreviewTime ? preferredPreviewTime : 0;
      if (shouldSeekPreviewFrame && previewTime > 0) {
        shouldSeekPreviewFrame = false;

        try {
          video.currentTime = previewTime;
          return;
        } catch {
          drawFrame();
          return;
        }
      }

      drawFrame();
    };

    video.onseeked = () => {
      drawFrame();
    };

    video.onerror = () => {
      fail(new Error("Failed to load project preview frame."));
    };
  });

const captureProjectPosterFrameFromVideoElement = (video: HTMLVideoElement) => {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    return null;
  }

  const targetSize = getPosterCaptureSize(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = targetSize.width;
  canvas.height = targetSize.height;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  try {
    context.drawImage(video, 0, 0, targetSize.width, targetSize.height);
    return canvas.toDataURL("image/jpeg", PROJECT_POSTER_CAPTURE_QUALITY);
  } catch {
    return null;
  }
};

const captureProjectPosterOnce = (
  videoUrl: string,
  options?: {
    cacheKey?: string;
    previewTime?: number;
    useSegmentPreviewTime?: boolean;
  },
) => {
  const normalizedVideoUrl = String(videoUrl ?? "").trim();
  if (!normalizedVideoUrl) {
    return Promise.reject(new Error("Video URL is required for poster capture."));
  }

  if (!canCapturePosterInBrowser(normalizedVideoUrl)) {
    return Promise.reject(new Error("Remote video poster capture is disabled."));
  }

  const normalizedCacheKey = String(options?.cacheKey ?? normalizedVideoUrl).trim() || normalizedVideoUrl;

  const cachedPoster = getProjectPosterCacheValue(normalizedCacheKey);
  if (cachedPoster) {
    return Promise.resolve(cachedPoster);
  }

  const inFlightRequest = projectPosterCaptureRequests.get(normalizedCacheKey);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const nextRequest = enqueueProjectPosterCapture(() => captureProjectPoster(normalizedVideoUrl, options))
    .then((capturedPosterUrl) => {
      setProjectPosterCacheValue(normalizedCacheKey, capturedPosterUrl);
      return capturedPosterUrl;
    })
    .finally(() => {
      projectPosterCaptureRequests.delete(normalizedCacheKey);
    });

  projectPosterCaptureRequests.set(normalizedCacheKey, nextRequest);
  return nextRequest;
};

type WorkspaceProjectCardProps = {
  canUseLocalExamples: boolean;
  isChild?: boolean;
  isProjectActionBusy: boolean;
  isPreviewing: boolean;
  showStackCollapseHandle?: boolean;
  isStackExpanded?: boolean;
  isStackLead?: boolean;
  onAddToExamples: (project: WorkspaceProject) => void;
  onActivate: (projectId: string, hasVideo: boolean) => void;
  onBlur: (event: ReactFocusEvent<HTMLElement>) => void;
  onDeactivate: (projectId: string) => void;
  onDelete: (project: WorkspaceProject) => void;
  onEdit: (project: WorkspaceProject) => void;
  onOpenPreview: (project: WorkspaceProject) => void;
  onPublish: (project: WorkspaceProject) => void;
  onToggleStack?: () => void;
  project: WorkspaceProject;
  stackBadgeLabel?: string | null;
};

function WorkspaceProjectCard({
  canUseLocalExamples,
  isChild = false,
  isProjectActionBusy,
  isPreviewing,
  showStackCollapseHandle = false,
  isStackExpanded = false,
  isStackLead = false,
  onAddToExamples,
  onActivate,
  onBlur,
  onDeactivate,
  onDelete,
  onEdit,
  onOpenPreview,
  onPublish,
  onToggleStack,
  project,
  stackBadgeLabel = null,
}: WorkspaceProjectCardProps) {
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const projectPreviewNote = getProjectPreviewNote(project);
  const projectTitle = getWorkspaceProjectDisplayTitle(project);
  const projectDownloadUrl = appendUrlToken(project.videoUrl, "download", project.updatedAt || project.generatedAt || project.id);
  const projectDownloadName = getVideoDownloadName(projectTitle);
  const canEditProject = Boolean(project.adId);
  const canDownloadProject = Boolean(projectDownloadUrl);
  const canAddProjectToExamples = canUseLocalExamples && Boolean(project.videoUrl);
  const canPublishProject = Boolean(project.adId);
  const [shouldLoadPreview, setShouldLoadPreview] = useState(false);
  const [hasPreviewFrame, setHasPreviewFrame] = useState(false);
  const [isPreviewVideoReady, setIsPreviewVideoReady] = useState(false);
  const [isPosterLoadFailed, setIsPosterLoadFailed] = useState(false);
  const posterUrl = isPosterLoadFailed ? null : project.posterUrl;
  const handleToggleStack = typeof onToggleStack === "function" ? onToggleStack : null;
  const hasStackBadge = Boolean(stackBadgeLabel);
  const hasCollapseHandle = Boolean(handleToggleStack && showStackCollapseHandle);
  const shouldToggleStackFromCard = Boolean(handleToggleStack && hasStackBadge);
  const shouldShowStatusBadge = shouldShowProjectStatusBadge(project.status);

  useEffect(() => {
    if (!project.videoUrl) {
      setShouldLoadPreview(false);
      setHasPreviewFrame(false);
      setIsPreviewVideoReady(false);
      setIsPosterLoadFailed(false);
      return;
    }

    setHasPreviewFrame(false);
    setIsPreviewVideoReady(false);
    setIsPosterLoadFailed(false);
  }, [project.posterUrl, project.videoUrl]);

  useEffect(() => {
    if (!project.videoUrl || !shouldLoadPreview || !isPreviewing) return;

    const videoElement = previewVideoRef.current;
    if (!videoElement) return;

    if (
      videoElement.networkState === HTMLMediaElement.NETWORK_EMPTY ||
      videoElement.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
    ) {
      ensureVideoElementLoading(videoElement, HTMLMediaElement.HAVE_FUTURE_DATA);
    }
  }, [isPreviewing, project.videoUrl, shouldLoadPreview]);

  useEffect(() => {
    const videoElement = previewVideoRef.current;
    if (!videoElement || !project.videoUrl || !shouldLoadPreview) return;

    if (!isPreviewing) {
      videoElement.pause();
      try {
        videoElement.currentTime = 0;
      } catch {
        // Ignore reset errors until metadata is available.
      }
      return;
    }

    void videoElement.play().catch(() => {
      // Ignore autoplay rejection for hover preview.
    });
  }, [isPreviewing, project.videoUrl, shouldLoadPreview]);

  return (
    <article
      className={[
        "studio-project-card",
        hasPreviewFrame ? "has-preview-frame" : "",
        hasStackBadge ? "has-stack-badge" : "",
        hasCollapseHandle ? "has-stack-collapse-handle" : "",
        isChild ? "is-stack-child" : "",
        isPreviewing ? "is-previewing" : "",
        isPreviewing && isPreviewVideoReady ? "is-preview-ready" : "",
        isStackLead ? "is-stack-lead" : "",
      ].filter(Boolean).join(" ")}
      onMouseEnter={() => {
        if (project.videoUrl) {
          setShouldLoadPreview(true);
        }
        onActivate(project.id, Boolean(project.videoUrl));
      }}
      onMouseLeave={() => onDeactivate(project.id)}
      onFocusCapture={() => {
        if (project.videoUrl) {
          setShouldLoadPreview(true);
        }
        onActivate(project.id, Boolean(project.videoUrl));
      }}
      onBlurCapture={onBlur}
    >
      <div className="studio-project-card__thumb">
        {project.videoUrl && shouldLoadPreview ? (
          <div className="studio-project-card__thumb-media">
            <video
              ref={previewVideoRef}
              src={project.videoUrl}
              muted
              playsInline
              loop
              poster={posterUrl ?? undefined}
              preload={isPreviewing ? "auto" : "none"}
              onLoadedData={() => {
                setHasPreviewFrame(true);
                setIsPreviewVideoReady(true);
              }}
              onCanPlay={() => {
                setIsPreviewVideoReady(true);
              }}
              onError={() => {
                setHasPreviewFrame(false);
                setIsPreviewVideoReady(false);
              }}
            />
          </div>
        ) : null}
        <div className="studio-project-card__thumb-poster" aria-hidden={isPreviewing && isPreviewVideoReady}>
          {posterUrl ? (
            <img
              className="studio-project-card__thumb-image"
              src={posterUrl}
              alt=""
              decoding="async"
              onError={() => setIsPosterLoadFailed(true)}
            />
          ) : null}
          <div className={`studio-project-card__thumb-placeholder${posterUrl || hasPreviewFrame ? " has-image" : ""}`}>
            {!posterUrl && !hasPreviewFrame ? (
              <div className="studio-project-card__thumb-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
                </svg>
              </div>
            ) : null}
            <div className="studio-project-card__thumb-copy">
              {projectPreviewNote ? <span className="studio-project-card__thumb-note">{projectPreviewNote}</span> : null}
              <strong>{project.title || "Без названия"}</strong>
            </div>
          </div>
        </div>
        {project.videoUrl ? (
          <button
            className="studio-project-card__thumb-trigger"
            type="button"
            aria-label={
              shouldToggleStackFromCard
                ? isStackExpanded
                  ? `Свернуть версии: ${projectTitle}`
                  : `Показать версии: ${projectTitle}`
                : `Открыть превью: ${projectTitle}`
            }
            onClick={() => {
              if (shouldToggleStackFromCard) {
                handleToggleStack?.();
                return;
              }

              setShouldLoadPreview(true);
              onOpenPreview(project);
            }}
          />
        ) : null}
        {stackBadgeLabel ? <span className="studio-project-card__stack-label">{stackBadgeLabel}</span> : null}
        <div className="studio-project-card__quick-actions" onClick={(event) => event.stopPropagation()}>
          <button
            className="studio-canvas-preview__quick-action"
            type="button"
            aria-label="Открыть Shorts по сегментам"
            title={canEditProject ? "Открыть Shorts по сегментам" : "Shorts по сегментам доступны после сохранения проекта"}
            disabled={!canEditProject || isProjectActionBusy}
            onClick={() => onEdit(project)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="m13 7 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className="studio-canvas-preview__quick-action"
            type="button"
            aria-label="Опубликовать в YouTube"
            title={canPublishProject ? "Опубликовать" : "Публикация доступна после сохранения проекта"}
            disabled={!canPublishProject || isProjectActionBusy}
            onClick={() => onPublish(project)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M14 5h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 14 19 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {canUseLocalExamples ? (
            <button
              className="studio-canvas-preview__quick-action studio-canvas-preview__quick-action--accent"
              type="button"
              aria-label="Добавить видео в локальные примеры"
              title="Добавить в примеры"
              disabled={!canAddProjectToExamples || isProjectActionBusy}
              onClick={() => onAddToExamples(project)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 4.75 14.16 9.13l4.84.7-3.5 3.41.83 4.82L12 15.8 7.67 18.06l.83-4.82L5 9.83l4.84-.7L12 4.75Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
          <a
            className={`studio-canvas-preview__quick-action${canDownloadProject ? "" : " is-disabled"}`}
            href={projectDownloadUrl ?? undefined}
            download={projectDownloadName}
            aria-label="Скачать видео"
            aria-disabled={!canDownloadProject}
            tabIndex={canDownloadProject ? 0 : -1}
            title={canDownloadProject ? "Скачать" : "Видео ещё не готово для скачивания"}
            onClick={(event) => {
              event.stopPropagation();
              if (!canDownloadProject) {
                event.preventDefault();
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
        {shouldShowStatusBadge ? (
        <span className={`studio-project-card__status studio-project-card__status--${project.status}`}>
          {getProjectStatusLabel(project.status)}
        </span>
        ) : null}
        <div className="studio-project-card__thumb-footer">
          <div className="studio-project-card__thumb-meta">
          <span className="studio-project-card__date">{formatProjectDate(project.updatedAt)}</span>
          </div>
          <button
            className="studio-project-card__delete workspace-delete-btn"
            type="button"
            aria-label="Удалить проект"
            title="Удалить проект"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(project);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 7h16" strokeLinecap="round" />
              <path d="M9 3h6" strokeLinecap="round" />
              <path d="M10 11v6" strokeLinecap="round" />
              <path d="M14 11v6" strokeLinecap="round" />
              <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      {hasCollapseHandle ? (
        <button
          className="workspace-project-stack__collapse-handle studio-project-card__stack-collapse"
          type="button"
          aria-label="Свернуть стопку проектов"
          title="Свернуть стопку"
          onClick={(event) => {
            event.stopPropagation();
            handleToggleStack?.();
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <path d="M14 7l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </article>
  );
}

const doesWorkspaceProjectMatch = (
  project: Pick<WorkspaceProject, "id" | "adId" | "jobId">,
  target: Pick<WorkspaceProject, "id" | "adId" | "jobId">,
) => {
  if (project.id === target.id) {
    return true;
  }

  if (project.adId !== null && target.adId !== null && project.adId === target.adId) {
    return true;
  }

  if (project.jobId && target.jobId && project.jobId === target.jobId) {
    return true;
  }

  return false;
};

const formatProjectDate = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Дата недоступна";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const formatProjectVersionsLabel = (count: number) => {
  const absoluteCount = Math.abs(Math.trunc(count));
  const lastTwoDigits = absoluteCount % 100;
  const lastDigit = absoluteCount % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${absoluteCount} версий`;
  }

  if (lastDigit === 1) {
    return `${absoluteCount} версия`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${absoluteCount} версии`;
  }

  return `${absoluteCount} версий`;
};

type AccountProjectListCardProps = {
  isChild?: boolean;
  isStackExpanded?: boolean;
  isStackLead?: boolean;
  onDelete: (project: WorkspaceProject) => void;
  onToggleStack?: () => void;
  project: WorkspaceProject;
  showStackCollapseHandle?: boolean;
  stackBadgeLabel?: string | null;
};

function AccountProjectListCard({
  isChild = false,
  isStackExpanded = false,
  isStackLead = false,
  onDelete,
  onToggleStack,
  project,
  showStackCollapseHandle = false,
  stackBadgeLabel = null,
}: AccountProjectListCardProps) {
  const handleToggleStack = typeof onToggleStack === "function" ? onToggleStack : null;
  const hasCollapseHandle = Boolean(handleToggleStack && showStackCollapseHandle);
  const isToggleable = Boolean(handleToggleStack && stackBadgeLabel);
  const shouldShowStatusBadge = shouldShowProjectStatusBadge(project.status);

  return (
    <article
      className={[
        "account-library__item",
        "account-project-card",
        isChild ? "account-project-card--child" : "",
        isStackLead ? "account-project-card--stack-lead" : "",
        hasCollapseHandle ? "has-stack-collapse-handle" : "",
        isToggleable ? "is-toggleable" : "",
      ].filter(Boolean).join(" ")}
      aria-expanded={isToggleable ? isStackExpanded : undefined}
      onClick={isToggleable ? () => handleToggleStack?.() : undefined}
      onKeyDown={
        isToggleable
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") {
                return;
              }

              event.preventDefault();
              handleToggleStack?.();
            }
          : undefined
      }
      role={isToggleable ? "button" : undefined}
      tabIndex={isToggleable ? 0 : undefined}
    >
      <div className="account-project-card__meta">
        <span className="account-library__label">
          {project.adId ? `Проект #${project.adId}` : `Job ${project.jobId?.slice(0, 8) ?? "N/A"}`}
        </span>
        <div className="account-project-card__meta-actions">
          {stackBadgeLabel ? (
            <span className="account-project-stack__badge">{stackBadgeLabel}</span>
          ) : null}
          {shouldShowStatusBadge ? (
            <span className={`account-status ${getProjectStatusClassName(project.status)}`}>
              {getProjectStatusLabel(project.status)}
            </span>
          ) : null}
        </div>
      </div>

      <h4>{getWorkspaceProjectDisplayTitle(project)}</h4>
      <p>{project.description}</p>

      <div className="account-project-card__details">
        <div className="account-project-card__detail">
          <span>Тема</span>
          <strong>{project.prompt || "Без темы"}</strong>
        </div>
        <div className="account-project-card__detail">
          <span>Источник</span>
          <strong>{project.source === "task" ? "Generation task" : "Saved project"}</strong>
        </div>
        <div className="account-project-card__detail">
          <span>Обновлен</span>
          <strong>{formatProjectDate(project.updatedAt)}</strong>
        </div>
      </div>

      {project.hashtags.length ? (
        <div className="account-project-card__tags" aria-label="Хэштеги проекта">
          {project.hashtags.map((tag) => (
            <span key={`${project.id}-${tag}`}>{tag}</span>
          ))}
        </div>
      ) : null}

      <div className="account-project-card__footer">
        <span>
          Создан: {formatProjectDate(project.createdAt)}
          {project.generatedAt ? ` · Готов: ${formatProjectDate(project.generatedAt)}` : ""}
        </span>

        <div className="account-project-card__actions">
          <button
            className="account-linkbtn account-linkbtn--subtle-danger workspace-delete-btn"
            type="button"
            aria-label="Удалить проект"
            title="Удалить проект"
            onKeyDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(project);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 7h16" strokeLinecap="round" />
              <path d="M9 3h6" strokeLinecap="round" />
              <path d="M10 11v6" strokeLinecap="round" />
              <path d="M14 11v6" strokeLinecap="round" />
              <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      {hasCollapseHandle ? (
        <button
          className="workspace-project-stack__collapse-handle account-project-card__stack-collapse"
          type="button"
          aria-label="Свернуть стопку проектов"
          title="Свернуть стопку"
          onClick={(event) => {
            event.stopPropagation();
            handleToggleStack?.();
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <path d="M14 7l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </article>
  );
}

const formatDateTimeLocalValue = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";

  const timezoneOffsetMs = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

const publishCalendarWeekdayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

type PublishCalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isPast: boolean;
  isToday: boolean;
};

const parsePublishDateTimeLocalValue = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildPublishDateTimeLocalValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const createDefaultPublishScheduleDate = () => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(12, 0, 0, 0);
  return next;
};

const startOfPublishDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const startOfPublishMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);

const shiftPublishMonth = (value: Date, delta: number) => new Date(value.getFullYear(), value.getMonth() + delta, 1);

const isSamePublishDay = (left: Date | null | undefined, right: Date | null | undefined) =>
  Boolean(
    left &&
      right &&
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate(),
  );

const formatPublishCalendarMonth = (value: Date) =>
  new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(value);

const formatPublishTimeValue = (value: Date | null | undefined) => {
  if (!value) return "";

  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
};

const applyPublishScheduleDatePart = (currentValue: string, selectedDate: Date) => {
  const baseDate = parsePublishDateTimeLocalValue(currentValue) ?? createDefaultPublishScheduleDate();
  return buildPublishDateTimeLocalValue(
    new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      baseDate.getHours(),
      baseDate.getMinutes(),
      0,
      0,
    ),
  );
};

const applyPublishScheduleTimePart = (currentValue: string, nextTime: string) => {
  const normalized = nextTime.trim();
  if (!normalized) return "";

  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return currentValue;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return currentValue;
  }

  const baseDate = parsePublishDateTimeLocalValue(currentValue) ?? createDefaultPublishScheduleDate();
  baseDate.setHours(hours, minutes, 0, 0);
  return buildPublishDateTimeLocalValue(baseDate);
};

const buildPublishCalendarDays = (month: Date): PublishCalendarDay[] => {
  const monthStart = startOfPublishMonth(month);
  const gridStart = new Date(monthStart);
  const weekDayIndex = (monthStart.getDay() + 6) % 7;
  gridStart.setDate(monthStart.getDate() - weekDayIndex);

  const today = startOfPublishDay(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dayStart = startOfPublishDay(date);

    return {
      date,
      isCurrentMonth: date.getMonth() === monthStart.getMonth(),
      isPast: dayStart.getTime() < today.getTime(),
      isToday: isSamePublishDay(dayStart, today),
    } satisfies PublishCalendarDay;
  });
};

const normalizePublishDateTimeInput = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const getYouTubePublicationMetaLabel = (publication: WorkspaceProjectYouTubePublication | null | undefined) => {
  if (!publication) return "";

  if (publication.state === "scheduled" && publication.scheduledAt) {
    return `Выход: ${formatProjectDate(publication.scheduledAt)}`;
  }

  if (publication.state === "published" && publication.publishedAt) {
    return `Опубликовано: ${formatProjectDate(publication.publishedAt)}`;
  }

  return publication.channelName ? `Канал: ${publication.channelName}` : "";
};

const tabCopy: Record<
  WorkspaceTab,
  {
    eyebrow: string;
    heading: string;
    subtitle: string;
  }
> = {
  overview: {
    eyebrow: "Personal workspace",
    heading: "Личный кабинет AdShorts AI",
    subtitle:
      "Управляйте генерациями, тарифом, каналами публикации и рабочими пресетами из одного workspace.",
  },
  studio: {
    eyebrow: "Студия Shorts",
    heading: "",
    subtitle: "",
  },
  generations: {
    eyebrow: "Проекты",
    heading: "Все проекты аккаунта",
    subtitle: "Здесь собраны все генерации и готовые Shorts, связанные с вашим аккаунтом в общей БД.",
  },
  billing: {
    eyebrow: "Тариф и кредиты",
    heading: "Тариф и пополнение",
    subtitle: "Здесь видно текущий тариф, баланс кредитов и сценарий докупки пакетов для PRO и ULTRA.",
  },
  settings: {
    eyebrow: "Settings",
    heading: "Настройки workspace",
    subtitle: "Профиль, интеграции, уведомления и безопасность собраны в одной панели.",
  },
};

const workspaceCreditTopupPacks: WorkspaceCreditTopupPack[] = [
  {
    name: "Pack 100",
    credits: "100 кредитов",
    price: "690 ₽",
    subnote: "До 10 видео",
  },
  {
    name: "Pack 500",
    credits: "500 кредитов",
    price: "2 750 ₽",
    subnote: "до 50 видео",
    badge: "Выгодно",
  },
  {
    name: "Pack 1000",
    credits: "1000 кредитов",
    price: "4 990 ₽",
    subnote: "до 100 видео",
  },
];

type StudioView = "create" | "projects" | "media";
type StudioCreateMode = "default" | "segment-editor";

type StudioRouteState = {
  projectId: number | null;
  section: StudioEntryIntentSection;
  segmentIndex: number | null;
};

const parseStudioRouteInteger = (value: string | null, options?: { allowZero?: boolean }) => {
  if (!value) {
    return null;
  }

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue)) {
    return null;
  }

  if (options?.allowZero) {
    return parsedValue >= 0 ? parsedValue : null;
  }

  return parsedValue > 0 ? parsedValue : null;
};

const getStudioRouteState = (search: string): StudioRouteState => {
  const searchParams = new URLSearchParams(search);
  const section = searchParams.get("section");

  return {
    projectId: parseStudioRouteInteger(searchParams.get("projectId")),
    section: section === "projects" || section === "media" || section === "edit" ? section : "create",
    segmentIndex: parseStudioRouteInteger(searchParams.get("segment"), { allowZero: true }),
  };
};

const getStudioRouteSection = (search: string): StudioEntryIntentSection => {
  return getStudioRouteState(search).section;
};

const getStudioViewFromRouteSection = (section: StudioEntryIntentSection): StudioView => {
  if (section === "projects") {
    return "projects";
  }

  if (section === "media") {
    return "media";
  }

  return "create";
};

const buildStudioRouteUrl = (
  search: string,
  section: StudioEntryIntentSection,
  options?: { projectId?: number | null; segmentIndex?: number | null },
) => {
  const searchParams = new URLSearchParams(search);

  if (section === "projects" || section === "media" || section === "edit") {
    searchParams.set("section", section);
  } else {
    searchParams.delete("section");
  }

  if (section === "edit" && typeof options?.projectId === "number" && Number.isInteger(options.projectId) && options.projectId > 0) {
    searchParams.set("projectId", String(options.projectId));
  } else {
    searchParams.delete("projectId");
  }

  if (
    section === "edit" &&
    typeof options?.segmentIndex === "number" &&
    Number.isInteger(options.segmentIndex) &&
    options.segmentIndex >= 0
  ) {
    searchParams.set("segment", String(options.segmentIndex));
  } else {
    searchParams.delete("segment");
  }

  const nextSearch = searchParams.toString();
  return nextSearch ? `/app/studio?${nextSearch}` : "/app/studio";
};

type StudioSubtitleSelectorChipProps = {
  isEnabled: boolean;
  onSelectColor: (colorId: StudioSubtitleColorOption["id"]) => void;
  onSelectExample: (exampleId: StudioSubtitleExampleOption["id"]) => void;
  onSelectStyle: (styleId: StudioSubtitleStyleOption["id"]) => void;
  onToggleEnabled: (enabled: boolean) => void;
  selectedColorId: StudioSubtitleColorOption["id"];
  selectedExampleId: StudioSubtitleExampleOption["id"];
  selectedStyleId: StudioSubtitleStyleOption["id"];
  subtitleColorOptions: StudioSubtitleColorOption[];
  subtitleStyleOptions: StudioSubtitleStyleOption[];
  variant?: "chip" | "sidebar";
};

type StudioLanguageSelectorChipProps = {
  onSelect: (language: StudioLanguage) => void;
  selectedLanguage: StudioLanguage;
  variant?: "chip" | "sidebar";
};

type StudioVoiceSelectorChipProps = {
  isEnabled: boolean;
  onSelect: (voiceId: StudioVoiceOption["id"]) => void;
  onToggleEnabled: (enabled: boolean) => void;
  selectedLanguage: StudioLanguage;
  selectedVoiceId: StudioVoiceOption["id"];
  voiceOptions: StudioVoiceOption[];
  variant?: "chip" | "sidebar";
};

type StudioMusicSelectorChipProps = {
  customMusicFile: StudioCustomMusicFile | null;
  isPreparingCustomMusic: boolean;
  onSelectCustomFile: (file: File) => Promise<boolean | void>;
  onSelectMusicType: (musicType: StudioMusicType) => void;
  selectedMusicType: StudioMusicType;
  uploadError: string | null;
  variant?: "chip" | "sidebar";
};

type StudioVideoSelectorChipProps = {
  brandLogoFile: StudioBrandLogoFile | null;
  brandText: string;
  brandUploadError: string | null;
  customVideoFile: StudioCustomVideoFile | null;
  isPreparingBrandLogo: boolean;
  isPreparingCustomVideo: boolean;
  onBrandLogoSelect: (file: File) => Promise<void>;
  onBrandTextChange: (value: string) => void;
  onClearBrandText: () => void;
  onRemoveBrandLogo: () => void;
  onSelectCustomFile: (file: File) => Promise<void>;
  onSelectVideoMode: (videoMode: StudioVideoMode) => void;
  selectedVideoMode: StudioVideoMode;
  uploadError: string | null;
};

function StudioSubtitleSelectorChip({
  isEnabled,
  onSelectColor,
  onSelectExample,
  onSelectStyle,
  onToggleEnabled,
  selectedColorId,
  selectedExampleId,
  selectedStyleId,
  subtitleColorOptions,
  subtitleStyleOptions,
  variant = "chip",
}: StudioSubtitleSelectorChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const safeStyleOptions = subtitleStyleOptions.length ? subtitleStyleOptions : [fallbackStudioSubtitleStyleOption];
  const safeColorOptions = subtitleColorOptions.length ? subtitleColorOptions : [fallbackStudioSubtitleColorOption];
  const selectedStyle = safeStyleOptions.find((style) => style.id === selectedStyleId) ?? safeStyleOptions[0];
  const selectedColor = safeColorOptions.find((color) => color.id === selectedColorId) ?? safeColorOptions[0];
  const previewStyle = getStudioSubtitlePreviewStyle(selectedStyle, selectedColor);
  const previewColorLabel = studioSubtitleStyleUsesAccentColor(selectedStyle) ? selectedColor.label : "Белый текст";
  const styleLogicLabel = getStudioSubtitleLogicLabel(selectedStyle);
  const transitionLabel = getStudioSubtitleTransitionLabel(selectedStyle);
  const isSidebarVariant = variant === "sidebar";

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      const menuRect = menuRef.current?.getBoundingClientRect();
      if (!triggerRect || !menuRect) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const menuWidth = Math.min(Math.max(680, Math.round(triggerRect.width * 2.4)), viewportWidth - 32, 760);
      const nextLeft = Math.min(Math.max(16, triggerRect.left), viewportWidth - menuWidth - 16);
      const availableAbove = triggerRect.top - 16;
      const availableBelow = viewportHeight - triggerRect.bottom - 16;
      const shouldOpenBelow = availableBelow >= menuRect.height || availableBelow > availableAbove;
      const nextTop = shouldOpenBelow
        ? Math.min(viewportHeight - menuRect.height - 16, triggerRect.bottom + 12)
        : Math.max(16, triggerRect.top - menuRect.height - 12);

      setMenuStyle({
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
        width: `${menuWidth}px`,
      });
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  return (
    <div className={`studio-subtitle-selector${isSidebarVariant ? " studio-subtitle-selector--sidebar" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        className={
          isSidebarVariant
            ? `studio-subtitle-selector__trigger studio-subtitle-selector__trigger--sidebar studio-sidebar__item studio-sidebar__item--static${
                isOpen ? " is-open" : ""
              }`
            : `studio-canvas-prompt__chip studio-subtitle-selector__trigger${isOpen ? " is-open" : ""}`
        }
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isSidebarVariant ? (
          <>
            <span className="studio-sidebar__item-icon" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M7 11.5h4M7 14.5h6M14 11.5h3M16 14.5h1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="studio-sidebar__item-copy">
              <strong>Субтитры</strong>
              <span className="studio-sidebar__item-value">{isEnabled ? selectedStyle.label : "Выкл"}</span>
            </span>
            <svg
              className="studio-subtitle-selector__icon studio-subtitle-selector__icon--sidebar"
              width="14"
              height="14"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          <>
            <span className="studio-subtitle-selector__label">Субтитры</span>
            <strong className="studio-subtitle-selector__value">{isEnabled ? selectedStyle.label : "Выкл"}</strong>
            <svg className="studio-subtitle-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="studio-subtitle-selector__menu"
              id={menuId}
              role="menu"
              aria-label="Настройки субтитров"
              style={
                menuStyle ?? {
                  left: "16px",
                  top: "16px",
                  visibility: "hidden",
                  pointerEvents: "none",
                }
              }
            >
              <div className="studio-subtitle-selector__section">
                <div className="studio-subtitle-selector__section-head">
                  <span>Режим</span>
                </div>
                <div className="studio-subtitle-selector__styles">
                  <button
                    className={`studio-subtitle-selector__style${!isEnabled ? " is-selected" : ""}`}
                    type="button"
                    onClick={() => {
                      onToggleEnabled(false);
                      setIsOpen(false);
                    }}
                  >
                    <span>Без субтитров</span>
                    <small>Полностью скрыть титры в ролике</small>
                  </button>
                </div>
              </div>

              <div className="studio-subtitle-selector__section">
                <div className="studio-subtitle-selector__section-head">
                  <span>Стиль</span>
                </div>
                <div className="studio-subtitle-selector__styles">
                  {safeStyleOptions.map((style) => (
                    <button
                      key={style.id}
                      className={`studio-subtitle-selector__style${style.id === selectedStyleId ? " is-selected" : ""}`}
                      type="button"
                      onClick={() => {
                        onToggleEnabled(true);
                        onSelectStyle(style.id);
                      }}
                    >
                      <span>{style.label}</span>
                      <small>{style.description}</small>
                    </button>
                ))}
                </div>
              </div>

              <div className="studio-subtitle-selector__section">
                <div className="studio-subtitle-selector__section-head">
                  <span>Цвет</span>
                </div>
                <div className="studio-subtitle-selector__colors">
                  {safeColorOptions.map((color) => (
                    <button
                      key={color.id}
                      className={`studio-subtitle-selector__color${color.id === selectedColorId ? " is-selected" : ""}`}
                      type="button"
                      onClick={() => onSelectColor(color.id)}
                    >
                      <span className="studio-subtitle-selector__color-swatch" style={{ background: color.accent }} aria-hidden="true"></span>
                      <span>{color.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="studio-subtitle-selector__section">
                <div className="studio-subtitle-selector__section-head">
                  <span>Примеры</span>
                </div>
                <div className="studio-subtitle-selector__examples">
                  {studioSubtitleExampleOptions.map((example) => {
                    const previewLines = buildStudioSubtitlePreviewLines(example, selectedStyle);

                    return (
                      <button
                        key={example.id}
                        className={`studio-subtitle-selector__example${example.id === selectedExampleId ? " is-selected" : ""}`}
                        type="button"
                        onClick={() => onSelectExample(example.id)}
                      >
                        <span className="studio-subtitle-selector__example-label">{example.label}</span>
                        <small className="studio-subtitle-selector__example-note">{example.note}</small>
                        <div
                          className="studio-subtitle-selector__example-stage"
                          data-style={selectedStyle.id}
                          data-uses-accent={studioSubtitleStyleUsesAccentColor(selectedStyle) ? "true" : "false"}
                          style={previewStyle}
                          aria-hidden="true"
                        >
                          <div className="studio-subtitle-selector__example-video-meta">
                            <span>{selectedStyle.label}</span>
                            <span>{previewColorLabel}</span>
                          </div>
                          <div
                            className="studio-subtitle-selector__example-caption"
                            data-logic={selectedStyle.logicMode}
                            data-style={selectedStyle.id}
                          >
                            {previewLines.map((line, lineIndex) => (
                              <span key={`${example.id}-line-${lineIndex}`} className="studio-subtitle-selector__example-line">
                                {line.map((word, wordIndex) => (
                                  <span
                                    key={`${example.id}-word-${lineIndex}-${wordIndex}`}
                                    className={`studio-subtitle-selector__example-word is-${word.state}`}
                                  >
                                    {word.text}
                                  </span>
                                ))}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="studio-subtitle-selector__example-tags" aria-hidden="true">
                          <span>{selectedStyle.fontFamily}</span>
                          <span>{styleLogicLabel}</span>
                          <span>{transitionLabel}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function StudioLanguageSelectorChip({ onSelect, selectedLanguage, variant = "chip" }: StudioLanguageSelectorChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = studioLanguageOptions.find((option) => option.id === selectedLanguage) ?? studioLanguageOptions[0];
  const isSidebarVariant = variant === "sidebar";

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const estimatedMenuHeight = Math.min(window.innerHeight - 32, 48 + studioLanguageOptions.length * 58);
      setMenuStyle(
        getStudioCompactMenuStyle({
          estimatedMenuHeight,
          minWidth: 228,
          triggerRect,
        }),
      );
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  return (
    <div
      className={`studio-voice-selector studio-voice-selector--language${isSidebarVariant ? " studio-voice-selector--sidebar" : ""}`}
      ref={rootRef}
    >
      <button
        ref={triggerRef}
        className={
          isSidebarVariant
            ? `studio-voice-selector__trigger studio-voice-selector__trigger--sidebar studio-sidebar__item studio-sidebar__item--static${
                isOpen ? " is-open" : ""
              }`
            : `studio-canvas-prompt__chip studio-voice-selector__trigger${isOpen ? " is-open" : ""}`
        }
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isSidebarVariant ? (
          <>
            <span className="studio-sidebar__item-icon" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M4 7h9M8.5 4v3m0 0c0 4.6-1.7 8-4.5 10m4.5-10c1.1 2.6 2.9 4.9 5.4 6.9M13 20l1.8-4.3m0 0L17 10l2.2 5.7m-4.4 0h4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="studio-sidebar__item-copy">
              <strong>Язык</strong>
              <span className="studio-sidebar__item-value">{selectedOption?.label ?? "Русский"}</span>
            </span>
            <svg className="studio-voice-selector__icon studio-voice-selector__icon--sidebar" width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          <>
            <span className="studio-voice-selector__label">Язык</span>
            <strong className="studio-voice-selector__value">{selectedOption?.label ?? "Русский"}</strong>
            <svg className="studio-voice-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>

      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="studio-voice-selector__menu"
              id={menuId}
              role="menu"
              aria-label="Выбор языка"
              style={menuStyle}
            >
              <span className="studio-voice-selector__menu-title">Выберите язык</span>
              {studioLanguageOptions.map((option) => (
                <div
                  key={option.id}
                  className={`studio-voice-selector__option${option.id === selectedLanguage ? " is-selected" : ""}`}
                >
                  <button
                    className="studio-voice-selector__option-main"
                    type="button"
                    role="menuitemradio"
                    aria-checked={option.id === selectedLanguage}
                    onClick={() => {
                      onSelect(option.id);
                      setIsOpen(false);
                    }}
                  >
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function StudioVoiceSelectorChip({
  isEnabled,
  onSelect,
  onToggleEnabled,
  selectedLanguage,
  selectedVoiceId,
  voiceOptions,
  variant = "chip",
}: StudioVoiceSelectorChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<StudioVoiceOption["id"] | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const selectedVoice = voiceOptions.find((voice) => voice.id === selectedVoiceId) ?? voiceOptions[0];
  const isSidebarVariant = variant === "sidebar";

  const stopVoicePreview = () => {
    const previewAudio = previewAudioRef.current;
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      previewAudio.onended = null;
      previewAudio.onerror = null;
      previewAudioRef.current = null;
    }

    setPreviewingVoiceId(null);
  };

  useEffect(() => {
    return () => {
      stopVoicePreview();
    };
  }, []);

  useEffect(() => {
    if (!previewingVoiceId) return;
    if (voiceOptions.some((voice) => voice.id === previewingVoiceId)) return;
    stopVoicePreview();
  }, [previewingVoiceId, voiceOptions]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        stopVoicePreview();
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        stopVoicePreview();
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const estimatedMenuHeight = Math.min(window.innerHeight - 32, 48 + voiceOptions.length * 58);
      setMenuStyle(
        getStudioCompactMenuStyle({
          estimatedMenuHeight,
          minWidth: 228,
          triggerRect,
        }),
      );
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, voiceOptions.length]);

  const handlePreviewVoice = async (voice: StudioVoiceOption) => {
    if (typeof window === "undefined") {
      return;
    }

    if (previewingVoiceId === voice.id) {
      stopVoicePreview();
      return;
    }

    stopVoicePreview();

    const previewUrl = (() => {
      if (voice.previewSampleUrl) {
        return voice.previewSampleUrl;
      }

      if (!voice.previewText) {
        return null;
      }

      const params = new URLSearchParams({
        language: selectedLanguage,
        text: voice.previewText,
        voiceId: voice.id,
      });
      return `/api/workspace/voice-preview?${params.toString()}`;
    })();

    if (!previewUrl || typeof Audio === "undefined") {
      return;
    }

    const previewAudio = new Audio(previewUrl);
    previewAudio.preload = "auto";
    previewAudio.onended = () => {
      previewAudioRef.current = null;
      setPreviewingVoiceId((current) => (current === voice.id ? null : current));
    };
    previewAudio.onerror = () => {
      previewAudioRef.current = null;
      setPreviewingVoiceId((current) => (current === voice.id ? null : current));
    };

    previewAudioRef.current = previewAudio;
    setPreviewingVoiceId(voice.id);

    try {
      await previewAudio.play();
    } catch {
      stopVoicePreview();
    }
  };

  return (
    <div className={`studio-voice-selector${isSidebarVariant ? " studio-voice-selector--sidebar" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        className={
          isSidebarVariant
            ? `studio-voice-selector__trigger studio-voice-selector__trigger--sidebar studio-sidebar__item studio-sidebar__item--static${
                isOpen ? " is-open" : ""
              }`
            : `studio-canvas-prompt__chip studio-voice-selector__trigger${isOpen ? " is-open" : ""}`
        }
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isSidebarVariant ? (
          <>
            <span className="studio-sidebar__item-icon" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M12 4v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <rect x="9" y="3.5" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
                <path d="M7 11a5 5 0 1 0 10 0M12 18.5v2M8.5 20.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="studio-sidebar__item-copy">
              <strong>Озвучка</strong>
              <span className="studio-sidebar__item-value">{isEnabled ? selectedVoice?.label ?? "Выберите голос" : "Выкл"}</span>
            </span>
            <svg className="studio-voice-selector__icon studio-voice-selector__icon--sidebar" width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          <>
            <span className="studio-voice-selector__label">Озвучка</span>
            <strong className="studio-voice-selector__value">{isEnabled ? selectedVoice?.label ?? "Выберите голос" : "Выкл"}</strong>
            <svg className="studio-voice-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>

      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="studio-voice-selector__menu"
              id={menuId}
              role="menu"
              aria-label="Выбор голоса"
              style={menuStyle}
            >
              <span className="studio-voice-selector__menu-title">Выберите голос</span>
              <div className={`studio-voice-selector__option${!isEnabled ? " is-selected" : ""}`}>
                <button
                  className="studio-voice-selector__option-main"
                  type="button"
                  role="menuitemradio"
                  aria-checked={!isEnabled}
                  onClick={() => {
                    stopVoicePreview();
                    onToggleEnabled(false);
                    setIsOpen(false);
                  }}
                >
                  <span>Без озвучки</span>
                  <small>Оставить ролик без голосовой дорожки</small>
                </button>
              </div>
              {voiceOptions.map((voice) => (
                (() => {
                  const canPreviewVoice = Boolean(voice.previewSampleUrl || voice.previewText);
                  const isVoiceSelected = isEnabled && voice.id === selectedVoiceId;

                  return (
                    <div
                      key={voice.id}
                      className={`studio-voice-selector__option${isVoiceSelected ? " is-selected" : ""}`}
                    >
                      <button
                        className="studio-voice-selector__option-main"
                        type="button"
                        role="menuitemradio"
                        aria-checked={isVoiceSelected}
                        onClick={() => {
                          stopVoicePreview();
                          onToggleEnabled(true);
                          onSelect(voice.id);
                          setIsOpen(false);
                        }}
                      >
                        <span>{voice.label}</span>
                        <small>{voice.description}</small>
                      </button>
                      <button
                        className={`studio-voice-selector__preview${previewingVoiceId === voice.id ? " is-playing" : ""}`}
                        type="button"
                        aria-label={
                          !canPreviewVoice
                            ? `Превью недоступно: ${voice.label}`
                            : previewingVoiceId === voice.id
                              ? `Остановить: ${voice.label}`
                              : `Прослушать: ${voice.label}`
                        }
                        title={!canPreviewVoice ? "Превью недоступно" : previewingVoiceId === voice.id ? "Остановить" : "Прослушать"}
                        disabled={!canPreviewVoice}
                        onClick={() => void handlePreviewVoice(voice)}
                      >
                        {previewingVoiceId === voice.id ? (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <rect x="3.25" y="3.25" width="7.5" height="7.5" rx="1.2" fill="currentColor" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <path d="M4.2 3.5v7l5.8-3.5-5.8-3.5Z" fill="currentColor" />
                          </svg>
                        )}
                      </button>
                    </div>
                  );
                })()
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

const WorkspaceSegmentPreviewCardMedia = memo(function WorkspaceSegmentPreviewCardMedia({
  autoplay = true,
  fallbackPosterUrl,
  imageLoading = "eager",
  isPlaybackRequested = false,
  loop,
  mediaKey,
  mountVideoWhenIdle = true,
  muted = true,
  onVideoError,
  onVideoEnded,
  onVideoTimeUpdate,
  onVideoPause,
  onVideoPlay,
  posterUrl,
  preferPosterFrame = false,
  preload = "metadata",
  primePausedFrame = false,
  previewFallbackUrls = [],
  previewKind,
  previewUrl,
  videoRef,
}: WorkspaceSegmentPreviewCardMediaProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isPreferredPosterReady, setIsPreferredPosterReady] = useState(false);
  const [isPosterFrameLoadFailed, setIsPosterFrameLoadFailed] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [previewCandidateIndex, setPreviewCandidateIndex] = useState(0);
  const [imageCandidateIndex, setImageCandidateIndex] = useState(0);
  const normalizedPreviewUrl = previewUrl.trim();
  const normalizedPosterUrl = sanitizeWorkspaceSegmentPosterUrl(previewKind, normalizedPreviewUrl, posterUrl);
  const normalizedFallbackPosterUrl = sanitizeWorkspaceSegmentPosterUrl(previewKind, normalizedPreviewUrl, fallbackPosterUrl);
  const normalizedPreviewFallbackUrls = useMemo(
    () => getUniqueWorkspaceSegmentPreviewUrls(previewFallbackUrls),
    [previewFallbackUrls],
  );
  const previewFallbackSignature = normalizedPreviewFallbackUrls.join("|");
  const previewCandidateUrls = useMemo(
    () => getUniqueWorkspaceSegmentPreviewUrls([normalizedPreviewUrl, ...normalizedPreviewFallbackUrls]),
    [normalizedPreviewFallbackUrls, normalizedPreviewUrl],
  );
  const resolvedPreviewUrl = previewCandidateUrls[previewCandidateIndex] ?? normalizedPreviewUrl;
  const segmentPreviewPosterCacheKey = `${resolvedPreviewUrl}::segment-preview-poster:v2-late-frame`;
  const [capturedPosterUrl, setCapturedPosterUrl] = useState<string | null>(() =>
    canCapturePosterInBrowser(resolvedPreviewUrl) ? getProjectPosterCacheValue(segmentPreviewPosterCacheKey) : null,
  );
  const resolvedPosterUrl =
    (isPreferredPosterReady ? normalizedPosterUrl : normalizedFallbackPosterUrl || normalizedPosterUrl) ||
    capturedPosterUrl;
  const canUseResolvedPosterFrame = Boolean(resolvedPosterUrl) && !isPosterFrameLoadFailed;
  const shouldPrimePausedFrame =
    previewKind === "video" && !autoplay && (primePausedFrame || (preferPosterFrame && !canUseResolvedPosterFrame));
  const shouldKeepVideoUnmountedWhileIdle =
    previewKind === "video" && !autoplay && !isPlaybackRequested && !mountVideoWhenIdle;
  const imageCandidateUrls = useMemo(
    () =>
      getUniqueWorkspaceSegmentPreviewUrls([
        preferPosterFrame && canUseResolvedPosterFrame ? resolvedPosterUrl : null,
        ...previewCandidateUrls,
        preferPosterFrame ? null : canUseResolvedPosterFrame ? resolvedPosterUrl : null,
      ]),
    [canUseResolvedPosterFrame, preferPosterFrame, previewCandidateUrls, resolvedPosterUrl],
  );
  const imageCandidateSignature = imageCandidateUrls.join("|");
  const resolvedImageUrl = imageCandidateUrls[imageCandidateIndex] ?? resolvedPreviewUrl;

  const setVideoElementRef = useCallback(
    (element: HTMLVideoElement | null) => {
      localVideoRef.current = element;
      videoRef?.(element);
    },
    [videoRef],
  );

  const cacheMountedVideoPosterFrame = useCallback(
    (element: HTMLVideoElement | null) => {
      if (
        !element ||
        previewKind !== "video" ||
        normalizedPosterUrl ||
        normalizedFallbackPosterUrl ||
        !canCapturePosterInBrowser(resolvedPreviewUrl)
      ) {
        return;
      }

      const cachedPoster = captureProjectPosterFrameFromVideoElement(element);
      if (!cachedPoster) {
        return;
      }

      setProjectPosterCacheValue(segmentPreviewPosterCacheKey, cachedPoster);
      setCapturedPosterUrl((current) => current ?? cachedPoster);
    },
    [
      normalizedFallbackPosterUrl,
      normalizedPosterUrl,
      previewKind,
      resolvedPreviewUrl,
      segmentPreviewPosterCacheKey,
    ],
  );

  const advancePreviewCandidate = useCallback(() => {
    if (previewCandidateIndex >= previewCandidateUrls.length - 1) {
      return false;
    }

    setPreviewCandidateIndex((current) => Math.min(current + 1, previewCandidateUrls.length - 1));
    return true;
  }, [previewCandidateIndex, previewCandidateUrls.length]);

  const advanceImageCandidate = useCallback(() => {
    if (imageCandidateIndex >= imageCandidateUrls.length - 1) {
      return false;
    }

    setImageCandidateIndex((current) => Math.min(current + 1, imageCandidateUrls.length - 1));
    return true;
  }, [imageCandidateIndex, imageCandidateUrls.length]);

  useEffect(() => {
    const cachedPoster =
      canCapturePosterInBrowser(resolvedPreviewUrl) ? getProjectPosterCacheValue(segmentPreviewPosterCacheKey) : null;
    setCapturedPosterUrl(cachedPoster);
  }, [resolvedPreviewUrl, segmentPreviewPosterCacheKey]);

  useEffect(() => {
    setIsPosterFrameLoadFailed(false);
  }, [normalizedFallbackPosterUrl, normalizedPosterUrl, resolvedPreviewUrl]);

  useEffect(() => {
    setIsVideoPlaying(false);
  }, [mediaKey, resolvedPreviewUrl]);

  useEffect(() => {
    setPreviewCandidateIndex(0);
  }, [mediaKey, normalizedPreviewUrl, previewFallbackSignature, previewKind]);

  useEffect(() => {
    setImageCandidateIndex(0);
  }, [imageCandidateSignature, mediaKey, previewKind]);

  useEffect(() => {
    if (!normalizedPosterUrl) {
      setIsPreferredPosterReady(false);
      return;
    }

    if (!normalizedFallbackPosterUrl || normalizedFallbackPosterUrl === normalizedPosterUrl) {
      setIsPreferredPosterReady(true);
      return;
    }

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (!cancelled) {
        setIsPreferredPosterReady(true);
      }
    };

    image.onerror = () => {
      if (!cancelled) {
        setIsPreferredPosterReady(false);
      }
    };

    setIsPreferredPosterReady(false);
    image.src = normalizedPosterUrl;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [normalizedFallbackPosterUrl, normalizedPosterUrl]);

  useEffect(() => {
    if (
      previewKind !== "video" ||
      normalizedPosterUrl ||
      normalizedFallbackPosterUrl ||
      !shouldKeepVideoUnmountedWhileIdle ||
      !canCapturePosterInBrowser(resolvedPreviewUrl)
    ) {
      return;
    }

    let cancelled = false;
    // Capture a stable preview frame so the card can stay visually still
    // while the underlying video is warming up for fast playback.
    void captureProjectPosterOnce(resolvedPreviewUrl, {
      cacheKey: segmentPreviewPosterCacheKey,
      useSegmentPreviewTime: true,
    })
      .then((nextPosterUrl) => {
        if (!cancelled) {
          setCapturedPosterUrl(nextPosterUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCapturedPosterUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    normalizedFallbackPosterUrl,
    normalizedPosterUrl,
    preload,
    previewKind,
    resolvedPreviewUrl,
    segmentPreviewPosterCacheKey,
    shouldKeepVideoUnmountedWhileIdle,
  ]);

  useEffect(() => {
    if (
      previewKind !== "video" ||
      autoplay ||
      preload === "none" ||
      !shouldPrimePausedFrame ||
      isPlaybackRequested ||
      isVideoPlaying
    ) {
      return;
    }

    const element = localVideoRef.current;
    if (!element) {
      return;
    }

    let cancelled = false;

    const primePausedPreviewFrame = () => {
      if (cancelled || localVideoRef.current !== element || !element.paused || element.ended || element.readyState < 2) {
        return;
      }

      const duration = typeof element.duration === "number" && Number.isFinite(element.duration) ? Math.max(0, element.duration) : 0;
      const previewFrameTime = getWorkspaceSegmentPausedPreviewTime(duration);

      try {
        if (Math.abs(element.currentTime - previewFrameTime) > 0.02) {
          element.currentTime = previewFrameTime;
        }
        element.dataset.previewPrimed = "true";
      } catch {
        // Ignore seek errors while the browser is still finalizing the buffered range.
      }
    };

    if (element.readyState >= 2) {
      primePausedPreviewFrame();
      return;
    }

    const handleLoadedData = () => {
      primePausedPreviewFrame();
    };

    element.addEventListener("loadeddata", handleLoadedData, { once: true });
    ensureVideoElementLoading(element, HTMLMediaElement.HAVE_CURRENT_DATA);

    return () => {
      cancelled = true;
      element.removeEventListener("loadeddata", handleLoadedData);
    };
  }, [autoplay, isPlaybackRequested, isVideoPlaying, preload, previewKind, resolvedPreviewUrl, shouldPrimePausedFrame]);

  if (previewKind === "image") {
    return (
      <img
        key={`${mediaKey}:${resolvedImageUrl}`}
        src={resolvedImageUrl}
        alt=""
        loading={imageLoading}
        decoding="async"
        draggable={false}
        onError={() => {
          advanceImageCandidate();
        }}
      />
    );
  }

  if (shouldKeepVideoUnmountedWhileIdle && preferPosterFrame && canUseResolvedPosterFrame && resolvedPosterUrl) {
    return (
      <img
        key={`${mediaKey}:poster`}
        src={resolvedPosterUrl}
        alt=""
        loading={imageLoading}
        decoding="async"
        draggable={false}
        aria-hidden="true"
        onError={() => {
          setIsPosterFrameLoadFailed(true);
        }}
      />
    );
  }

  if (shouldKeepVideoUnmountedWhileIdle) {
    if (canUseResolvedPosterFrame && resolvedPosterUrl) {
      return (
        <img
          key={`${mediaKey}:poster`}
          src={resolvedPosterUrl}
          alt=""
          loading={imageLoading}
          decoding="async"
          draggable={false}
          aria-hidden="true"
          onError={() => {
            setIsPosterFrameLoadFailed(true);
          }}
        />
      );
    }

    return <div className="studio-segment-preview-card-media__idle-placeholder" aria-hidden="true" />;
  }

  return (
    <>
      <video
        key={`${mediaKey}:${resolvedPreviewUrl}`}
        ref={setVideoElementRef}
        src={resolvedPreviewUrl}
        autoPlay={autoplay}
        loop={loop ?? autoplay}
        muted={muted}
        poster={canUseResolvedPosterFrame ? resolvedPosterUrl ?? undefined : undefined}
        playsInline
        preload={preload}
        disablePictureInPicture
        disableRemotePlayback
        draggable={false}
        tabIndex={-1}
        aria-hidden="true"
        onContextMenu={(event) => event.preventDefault()}
        onError={() => {
          setIsVideoPlaying(false);
          if (advancePreviewCandidate()) {
            return;
          }
          onVideoError?.();
        }}
        onEnded={() => {
          setIsVideoPlaying(false);
          onVideoEnded?.();
        }}
        onLoadedData={(event) => {
          cacheMountedVideoPosterFrame(event.currentTarget);
        }}
        onLoadedMetadata={(event) => onVideoTimeUpdate?.(event.currentTarget.currentTime)}
        onPause={() => {
          setIsVideoPlaying(false);
          onVideoPause?.();
        }}
        onPlay={() => {
          setIsVideoPlaying(true);
          onVideoPlay?.();
        }}
        onSeeked={(event) => {
          cacheMountedVideoPosterFrame(event.currentTarget);
        }}
        onTimeUpdate={(event) => onVideoTimeUpdate?.(event.currentTarget.currentTime)}
      />
      {canUseResolvedPosterFrame && resolvedPosterUrl && !isVideoPlaying && !isPlaybackRequested ? (
        <img
          className="studio-segment-preview-card-media__poster"
          src={resolvedPosterUrl}
          alt=""
          loading={imageLoading}
          decoding="async"
          draggable={false}
          aria-hidden="true"
          onError={() => {
            setIsPosterFrameLoadFailed(true);
          }}
        />
      ) : null}
    </>
  );
});

type WorkspaceModalVideoPlayerProps = {
  autoPlay?: boolean;
  errorOverlay?: ReactNode;
  fitMode?: "contain" | "cover";
  onCanPlay?: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onError?: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onLoadedData?: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onLoadedMetadata?: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onPause?: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onPlay?: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  poster?: string | null;
  preload?: "auto" | "metadata" | "none";
  preferMutedAutoplay?: boolean;
  src: string;
  topActions?: ReactNode;
  uiRevealMode?: "always" | "hover";
  videoKey: string;
  videoRef?: (element: HTMLVideoElement | null) => void;
  volume?: number;
  onVolumeChange?: (nextVolume: number) => void;
};

const clampWorkspaceModalPlayerVolume = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
};

const playWorkspaceModalVideoElement = async (element: HTMLVideoElement | null, volume: number) => {
  if (!element) {
    return { muted: volume <= 0, played: false };
  }

  const safeVolume = clampWorkspaceModalPlayerVolume(volume);
  element.volume = safeVolume;
  element.muted = safeVolume <= 0;
  element.defaultMuted = safeVolume <= 0;

  try {
    await element.play();
    return { muted: element.muted, played: true };
  } catch {
    element.muted = true;
    element.defaultMuted = true;
  }

  try {
    await element.play();
    return { muted: true, played: true };
  } catch {
    element.pause();
    return { muted: element.muted, played: false };
  }
};

function WorkspaceModalVideoPlayer({
  autoPlay = false,
  errorOverlay,
  fitMode = "contain",
  onCanPlay,
  onError,
  onLoadedData,
  onLoadedMetadata,
  onPause,
  onPlay,
  poster,
  preload = "metadata",
  preferMutedAutoplay = false,
  src,
  topActions,
  uiRevealMode = "always",
  videoKey,
  videoRef,
  volume = 0.88,
  onVolumeChange,
}: WorkspaceModalVideoPlayerProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const lastNonZeroVolumeRef = useRef(Math.max(0.2, clampWorkspaceModalPlayerVolume(volume)));
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const shouldPreferMutedAutoplay = autoPlay && preferMutedAutoplay;
  const [isActuallyMuted, setIsActuallyMuted] = useState(shouldPreferMutedAutoplay || clampWorkspaceModalPlayerVolume(volume) <= 0);
  const safeVolume = clampWorkspaceModalPlayerVolume(volume);
  const progressValue = duration > 0 ? Math.min(1000, Math.max(0, Math.round((currentTime / duration) * 1000))) : 0;

  const assignVideoRef = useCallback(
    (element: HTMLVideoElement | null) => {
      localVideoRef.current = element;
      videoRef?.(element);
    },
    [videoRef],
  );

  const updateVolume = useCallback(
    (nextVolume: number) => {
      const safeNextVolume = clampWorkspaceModalPlayerVolume(nextVolume);
      if (safeNextVolume > 0) {
        lastNonZeroVolumeRef.current = safeNextVolume;
      }
      setIsActuallyMuted(safeNextVolume <= 0);
      onVolumeChange?.(safeNextVolume);
    },
    [onVolumeChange],
  );

  const attemptPlayback = useCallback(async () => {
    const element = localVideoRef.current;
    if (!element) {
      return;
    }

    const result = await playWorkspaceModalVideoElement(element, shouldPreferMutedAutoplay ? 0 : safeVolume);
    setIsActuallyMuted(result.muted);
  }, [safeVolume, shouldPreferMutedAutoplay]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(autoPlay);
    setIsActuallyMuted(shouldPreferMutedAutoplay || safeVolume <= 0);
  }, [autoPlay, safeVolume, shouldPreferMutedAutoplay, videoKey]);

  useEffect(() => {
    const element = localVideoRef.current;
    if (!element) {
      return;
    }

    element.volume = safeVolume;
    if (safeVolume <= 0) {
      element.muted = true;
      element.defaultMuted = true;
      setIsActuallyMuted(true);
      return;
    }

    if (!isActuallyMuted) {
      element.muted = false;
      element.defaultMuted = false;
    }
  }, [isActuallyMuted, safeVolume]);

  const handleTogglePlayback = useCallback(() => {
    const element = localVideoRef.current;
    if (!element) {
      return;
    }

    if (element.paused) {
      void attemptPlayback();
      return;
    }

    element.pause();
  }, [attemptPlayback]);

  const handleToggleMute = useCallback(() => {
    if (safeVolume <= 0 || isActuallyMuted) {
      const nextVolume = Math.max(0.2, lastNonZeroVolumeRef.current);
      updateVolume(nextVolume);
      const element = localVideoRef.current;
      if (element) {
        element.volume = nextVolume;
        element.muted = false;
        element.defaultMuted = false;
      }
      return;
    }

    updateVolume(0);
  }, [isActuallyMuted, safeVolume, updateVolume]);

  const handleSeek = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const element = localVideoRef.current;
      if (!element || duration <= 0) {
        return;
      }

      const nextValue = Number(event.target.value);
      const nextTime = (Math.min(1000, Math.max(0, nextValue)) / 1000) * duration;
      try {
        element.currentTime = nextTime;
        setCurrentTime(nextTime);
      } catch {
        // Ignore seek errors while metadata is still being resolved.
      }
    },
    [duration],
  );

  return (
    <div
      className={`studio-video-modal__player is-video${fitMode === "cover" ? " is-cover-media" : ""}${
        uiRevealMode === "hover" ? " is-hover-ui" : ""
      }`}
    >
      <div className="studio-video-modal__player-stage" onClick={handleTogglePlayback}>
        <video
          key={videoKey}
          ref={assignVideoRef}
        src={src}
        autoPlay={autoPlay}
        playsInline
        preload={preload}
        poster={poster ?? undefined}
        muted={isActuallyMuted || shouldPreferMutedAutoplay}
        controls={false}
          onCanPlay={(event) => {
            const element = event.currentTarget;
            const nextDuration =
              typeof element.duration === "number" && Number.isFinite(element.duration) ? Math.max(0, element.duration) : 0;
            setDuration(nextDuration);
            if (autoPlay && element.paused) {
              void attemptPlayback();
            }
            onCanPlay?.(event);
          }}
          onClick={(event) => {
            event.stopPropagation();
            handleTogglePlayback();
          }}
          onLoadedData={(event) => {
            const element = event.currentTarget;
            setCurrentTime(Number.isFinite(element.currentTime) ? Math.max(0, element.currentTime) : 0);
            setDuration(Number.isFinite(element.duration) ? Math.max(0, element.duration) : 0);
            onLoadedData?.(event);
          }}
          onLoadedMetadata={(event) => {
            const element = event.currentTarget;
            setDuration(Number.isFinite(element.duration) ? Math.max(0, element.duration) : 0);
            onLoadedMetadata?.(event);
          }}
          onPause={(event) => {
            setIsPlaying(false);
            onPause?.(event);
          }}
          onPlay={(event) => {
            setIsPlaying(true);
            setIsActuallyMuted(event.currentTarget.muted);
            onPlay?.(event);
          }}
          onTimeUpdate={(event) => {
            setCurrentTime(Number.isFinite(event.currentTarget.currentTime) ? Math.max(0, event.currentTarget.currentTime) : 0);
          }}
          onEnded={() => {
            setIsPlaying(false);
          }}
          onVolumeChange={(event) => {
            setIsActuallyMuted(event.currentTarget.muted || event.currentTarget.volume <= 0);
          }}
          onError={(event) => {
            setIsPlaying(false);
            onError?.(event);
          }}
        />
      </div>
      {topActions ? <div className="studio-video-modal__top-actions">{topActions}</div> : null}
      {errorOverlay}
      <div className="studio-video-modal__player-controls">
        <input
          className="studio-video-modal__progress"
          type="range"
          min={0}
          max={1000}
          step={1}
          value={progressValue}
          aria-label="Позиция воспроизведения"
          onChange={handleSeek}
        />
        <div className="studio-video-modal__player-toolbar">
          <button
            className="studio-video-modal__control-btn"
            type="button"
            aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
            onClick={handleTogglePlayback}
          >
            {isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="5" y="4.25" width="3.25" height="11.5" rx="1.2" fill="currentColor" />
                <rect x="11.75" y="4.25" width="3.25" height="11.5" rx="1.2" fill="currentColor" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M7 5.25v9.5l7.5-4.75L7 5.25Z" fill="currentColor" />
              </svg>
            )}
          </button>
          <button
            className="studio-video-modal__control-btn"
            type="button"
            aria-label={isActuallyMuted || safeVolume <= 0 ? "Включить звук" : "Выключить звук"}
            onClick={handleToggleMute}
          >
            {isActuallyMuted || safeVolume <= 0 ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4.5 7.5H7.5L11 4.5V15.5L7.5 12.5H4.5V7.5Z" fill="currentColor" />
                <path d="M13.25 7 16.75 13M16.75 7 13.25 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4.5 7.5H7.5L11 4.5V15.5L7.5 12.5H4.5V7.5Z" fill="currentColor" />
                <path d="M13.4 7.2a4 4 0 0 1 0 5.6M15.7 5a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <span className="studio-video-modal__time">
            {formatWorkspaceSegmentEditorTime(currentTime)} / {formatWorkspaceSegmentEditorTime(duration, { roundUp: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

function WorkspaceSegmentSubtitleOverlay({
  clipCurrentTime,
  compact = false,
  isEditable = false,
  isPlaying,
  onResetText,
  onTextChange,
  segment,
  segmentNumber,
  subtitleColorId,
  subtitleColorOptions,
  subtitleStyleId,
  subtitleStyleOptions,
}: WorkspaceSegmentSubtitleOverlayProps) {
  const [isEditingText, setIsEditingText] = useState(false);
  const pendingCaretPointRef = useRef<WorkspaceSegmentSubtitleCaretPoint | null>(null);
  const subtitleTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const safeStyleOptions = subtitleStyleOptions.length ? subtitleStyleOptions : [fallbackStudioSubtitleStyleOption];
  const safeColorOptions = subtitleColorOptions.length ? subtitleColorOptions : [fallbackStudioSubtitleColorOption];
  const selectedStyle = safeStyleOptions.find((style) => style.id === subtitleStyleId) ?? safeStyleOptions[0];
  const selectedColor = safeColorOptions.find((color) => color.id === subtitleColorId) ?? safeColorOptions[0];
  const isEdited = isWorkspaceSegmentDraftTextEdited(segment);
  const previewStyle = getStudioSubtitlePreviewStyle(selectedStyle, selectedColor);
  const previewLines = buildWorkspaceSegmentSubtitlePreviewLines({
    clipCurrentTime,
    isPlaying,
    segment,
    style: selectedStyle,
  });
  const isInlineEditorVisible = isEditable && Boolean(onTextChange);
  const shouldShowInlineEditor = isInlineEditorVisible && isEditingText;

  useEffect(() => {
    if (!isInlineEditorVisible) {
      pendingCaretPointRef.current = null;
      setIsEditingText(false);
    }
  }, [isInlineEditorVisible]);

  useEffect(() => {
    pendingCaretPointRef.current = null;
    setIsEditingText(false);
  }, [segment.index]);

  useEffect(() => {
    if (!shouldShowInlineEditor) {
      return;
    }

    const nextFrameId = window.requestAnimationFrame(() => {
      const element = subtitleTextareaRef.current;
      if (!element) {
        return;
      }

      element.focus();
      const textLength = element.value.length;
      const pendingCaretPoint = pendingCaretPointRef.current;
      pendingCaretPointRef.current = null;
      const nextCaretPosition =
        pendingCaretPoint
          ? resolveWorkspaceSegmentSubtitleCaretPositionFromTextareaPoint({
              ...pendingCaretPoint,
              textarea: element,
            })
          : textLength;
      try {
        const boundedCaretPosition = Math.max(0, Math.min(textLength, nextCaretPosition));
        element.setSelectionRange(boundedCaretPosition, boundedCaretPosition);
      } catch {
        // Ignore selection errors on unsupported inputs.
      }
    });

    return () => window.cancelAnimationFrame(nextFrameId);
  }, [shouldShowInlineEditor]);

  if (previewLines.length === 0 && !isInlineEditorVisible) {
    return null;
  }

  return (
    <div
      className={`studio-segment-editor__subtitle${compact ? " is-compact" : ""}${isEdited ? " is-edited" : ""}${
        shouldShowInlineEditor ? " is-editing" : ""
      }`}
      style={previewStyle}
      aria-hidden={isInlineEditorVisible || isEdited ? undefined : true}
    >
      <div className="studio-segment-editor__subtitle-backdrop"></div>
      <div className="studio-segment-editor__subtitle-shell">
        {isEdited ? (
          <div className="studio-segment-editor__subtitle-meta">
            <span className="studio-segment-editor__subtitle-meta-spacer" aria-hidden="true"></span>
            <span className="studio-segment-editor__subtitle-status">Текст изменен</span>
            {onResetText ? (
              <button
                className="studio-segment-editor__subtitle-reset"
                type="button"
                aria-label="Сбросить текст сегмента"
                title="Сбросить текст сегмента"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onResetText();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M20 11a8 8 0 1 1-2.34-5.66L20 8"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20 4v4h-4"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>
        ) : null}
        {isInlineEditorVisible && !shouldShowInlineEditor ? (
          <div className="studio-segment-editor__subtitle-edit-hint" aria-hidden="true">
            <span className="studio-segment-editor__subtitle-edit-hint-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 20h9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        ) : null}
        {shouldShowInlineEditor ? (
          <div
            className="studio-segment-editor__subtitle-caption-edit-shell"
            onClick={(event) => {
              event.stopPropagation();
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            <div
              className="studio-subtitle-selector__example-caption studio-segment-editor__subtitle-caption-preview is-editing"
              data-logic={selectedStyle.logicMode}
              data-style={selectedStyle.id}
            >
              <textarea
                ref={subtitleTextareaRef}
                className="studio-segment-editor__textarea studio-segment-editor__subtitle-caption-textarea"
                value={segment.text}
                onChange={onTextChange}
                rows={4}
                placeholder="Введите текст сегмента"
                aria-label={`Текст сегмента ${segmentNumber}`}
                onBlur={() => {
                  setIsEditingText(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsEditingText(false);
                    event.currentTarget.blur();
                    return;
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsEditingText(false);
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
          </div>
        ) : previewLines.length > 0 || isInlineEditorVisible ? (
          isInlineEditorVisible ? (
            <button
              className="studio-subtitle-selector__example-caption studio-segment-editor__subtitle-caption-trigger"
              type="button"
              data-logic={selectedStyle.logicMode}
              data-style={selectedStyle.id}
              aria-label={`Редактировать текст сегмента ${segmentNumber}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                pendingCaretPointRef.current =
                  event.detail > 0
                    ? {
                        clientX: event.clientX,
                        clientY: event.clientY,
                      }
                    : null;
                setIsEditingText(true);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
            >
              {previewLines.length > 0 ? (
                previewLines.map((line, lineIndex) => (
                  <span
                    key={`${segment.index}-subtitle-line-${lineIndex}`}
                    className="studio-subtitle-selector__example-line"
                  >
                    {line.map((word, wordIndex) => (
                      <span
                        key={`${segment.index}-subtitle-word-${lineIndex}-${wordIndex}`}
                        className={`studio-subtitle-selector__example-word is-${word.state}`}
                      >
                        {word.text}
                      </span>
                    ))}
                  </span>
                ))
              ) : (
                <span className="studio-segment-editor__subtitle-empty">Нажмите, чтобы добавить текст</span>
              )}
            </button>
          ) : (
            <div
              className="studio-subtitle-selector__example-caption"
              data-logic={selectedStyle.logicMode}
              data-style={selectedStyle.id}
            >
              {previewLines.map((line, lineIndex) => (
                <span
                  key={`${segment.index}-subtitle-line-${lineIndex}`}
                  className="studio-subtitle-selector__example-line"
                >
                  {line.map((word, wordIndex) => (
                    <span
                      key={`${segment.index}-subtitle-word-${lineIndex}-${wordIndex}`}
                      className={`studio-subtitle-selector__example-word is-${word.state}`}
                    >
                      {word.text}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

function StudioVideoSelectorChip({
  brandLogoFile,
  brandText,
  brandUploadError,
  customVideoFile,
  isPreparingBrandLogo,
  isPreparingCustomVideo,
  onBrandLogoSelect,
  onBrandTextChange,
  onClearBrandText,
  onRemoveBrandLogo,
  onSelectCustomFile,
  onSelectVideoMode,
  selectedVideoMode,
  uploadError,
}: StudioVideoSelectorChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const brandLogoInputRef = useRef<HTMLInputElement | null>(null);
  const selectedVideoLabel = getStudioVideoChipValue(selectedVideoMode, customVideoFile, {
    brandLogoFile,
    brandText,
  });
  const selectedVideoTitle = [customVideoFile?.fileName ?? selectedVideoLabel, hasStudioBranding({ brandLogoFile, brandText }) ? getStudioBrandSummary({ brandLogoFile, brandText }) : ""]
    .filter(Boolean)
    .join(" · ");
  const customVideoFileLabel = customVideoFile ? truncateStudioCustomAssetName(customVideoFile.fileName) : null;
  const brandLogoPreviewUrl = getStudioCustomAssetPreviewUrl(brandLogoFile);
  const brandTextLength = brandText.length;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const estimatedMenuHeight = Math.min(window.innerHeight - 32, 560);
      setMenuStyle(
        getStudioCompactMenuStyle({
          estimatedMenuHeight,
          minWidth: 332,
          preferredWidth: 388,
          triggerRect,
        }),
      );
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  const openCustomVideoPicker = () => {
    fileInputRef.current?.click();
  };

  const openBrandLogoPicker = () => {
    brandLogoInputRef.current?.click();
  };

  const handleCustomVideoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) return;

    await onSelectCustomFile(file);
  };

  const handleBrandLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) return;

    await onBrandLogoSelect(file);
  };

  const handleCustomVideoSelect = () => {
    if (customVideoFile) {
      onSelectVideoMode("custom");
      setIsOpen(false);
      return;
    }

    openCustomVideoPicker();
  };

  return (
    <div className="studio-video-selector" ref={rootRef}>
      <input
        ref={fileInputRef}
        className="studio-video-selector__file-input"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.avif,.mp4,.mov,.webm,.m4v,image/*,video/*"
        onChange={(event) => {
          void handleCustomVideoChange(event);
        }}
      />
      <input
        ref={brandLogoInputRef}
        className="studio-video-selector__file-input"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.avif,image/*"
        onChange={(event) => {
          void handleBrandLogoChange(event);
        }}
      />

      <button
        ref={triggerRef}
        className={`studio-canvas-prompt__chip studio-video-selector__trigger${isOpen ? " is-open" : ""}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="studio-video-selector__label">Визуал</span>
        <strong className="studio-video-selector__value" title={selectedVideoTitle}>
          {selectedVideoLabel}
        </strong>
        <svg className="studio-video-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="studio-video-selector__menu"
              id={menuId}
              role="menu"
              aria-label="Выбор режима визуала"
              style={menuStyle}
            >
              <span className="studio-video-selector__menu-title">Режим создания</span>
              <div className="studio-video-selector__options">
                {studioVideoOptions
                  .filter((option) => option.id !== "custom")
                  .map((option) => (
                    <button
                      key={option.id}
                      className={`studio-video-selector__option${selectedVideoMode === option.id ? " is-selected" : ""}`}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selectedVideoMode === option.id}
                      onClick={() => {
                        onSelectVideoMode(option.id);
                        setIsOpen(false);
                      }}
                    >
                      <span className="studio-video-selector__option-row">
                        <span>{option.label}</span>
                      </span>
                      <small>{option.description}</small>
                    </button>
                  ))}
              </div>

              <div className="studio-video-selector__section">
                <span className="studio-video-selector__menu-title">Загрузить свой визуал</span>
                <div className={`studio-video-selector__custom${selectedVideoMode === "custom" ? " is-selected" : ""}`}>
                  <button
                    className="studio-video-selector__custom-main"
                    type="button"
                    onClick={handleCustomVideoSelect}
                  >
                    <span>Загрузить свой визуал</span>
                    <small title={customVideoFile?.fileName}>
                      {customVideoFileLabel ?? "Поддерживаются .jpg, .png, .webp, .avif, .mp4, .mov, .webm, .m4v"}
                    </small>
                  </button>
                  <button
                    className="studio-video-selector__custom-action"
                    type="button"
                    aria-label={customVideoFile ? "Заменить визуал" : "Загрузить визуал"}
                    title={customVideoFile ? "Заменить визуал" : "Загрузить визуал"}
                    onClick={openCustomVideoPicker}
                  >
                    {isPreparingCustomVideo ? (
                      <span className="studio-video-selector__spinner" aria-hidden="true"></span>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 18.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
                {uploadError ? <p className="studio-video-selector__error">{uploadError}</p> : null}
              </div>

              <div className="studio-video-selector__section">
                <span className="studio-video-selector__menu-title">Бренд</span>
                <div
                  className={`studio-video-selector__brand${
                    hasStudioBranding({ brandLogoFile, brandText }) ? " is-selected" : ""
                  }`}
                >
                  <div className="studio-video-selector__brand-head">
                    <div className="studio-video-selector__brand-preview" aria-hidden="true">
                      {brandLogoPreviewUrl ? (
                        <img src={brandLogoPreviewUrl} alt="" />
                      ) : (
                        <span className="studio-video-selector__brand-preview-placeholder">Logo</span>
                      )}
                    </div>
                    <div className="studio-video-selector__brand-copy">
                      <span>{hasStudioBranding({ brandLogoFile, brandText }) ? "Бренд добавлен" : "Добавить бренд"}</span>
                      <small title={brandLogoFile?.fileName ?? brandText}>{getStudioBrandSummary({ brandLogoFile, brandText })}</small>
                    </div>
                    <div className="studio-video-selector__brand-actions">
                      <button
                        className="studio-video-selector__custom-action"
                        type="button"
                        aria-label={brandLogoFile ? "Заменить логотип" : "Добавить логотип"}
                        title={brandLogoFile ? "Заменить логотип" : "Добавить логотип"}
                        onClick={openBrandLogoPicker}
                      >
                        {isPreparingBrandLogo ? (
                          <span className="studio-video-selector__spinner" aria-hidden="true"></span>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 18.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      {brandLogoFile ? (
                        <button
                          className="studio-video-selector__custom-action studio-video-selector__custom-action--danger"
                          type="button"
                          aria-label="Убрать логотип"
                          title="Убрать логотип"
                          onClick={onRemoveBrandLogo}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <label className="studio-video-selector__brand-field">
                    <span>Текст бренда</span>
                    <input
                      className="studio-video-selector__brand-input"
                      type="text"
                      value={brandText}
                      maxLength={STUDIO_BRAND_TEXT_MAX_CHARS}
                      placeholder="Например, adshortsai.com"
                      onChange={(event) => onBrandTextChange(event.target.value)}
                    />
                  </label>
                  <div className="studio-video-selector__brand-meta">
                    <span>{brandTextLength}/{STUDIO_BRAND_TEXT_MAX_CHARS}</span>
                    {brandText ? (
                      <button className="studio-video-selector__brand-clear" type="button" onClick={onClearBrandText}>
                        Очистить текст
                      </button>
                    ) : (
                      <span>Лого: .jpg, .png, .webp, .avif</span>
                    )}
                  </div>
                  <button
                    className="studio-video-selector__brand-apply"
                    type="button"
                    disabled={isPreparingBrandLogo}
                    onClick={() => {
                      setIsOpen(false);
                      triggerRef.current?.focus();
                    }}
                  >
                    Применить
                  </button>
                </div>
                {brandUploadError ? <p className="studio-video-selector__error">{brandUploadError}</p> : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function StudioMusicSelectorChip({
  customMusicFile,
  isPreparingCustomMusic,
  onSelectCustomFile,
  onSelectMusicType,
  selectedMusicType,
  uploadError,
  variant = "chip",
}: StudioMusicSelectorChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedMusicLabel = getStudioMusicChipValue(selectedMusicType, customMusicFile);
  const selectedMusicTitle = customMusicFile?.fileName ?? selectedMusicLabel;
  const customMusicFileLabel = customMusicFile ? truncateStudioCustomAssetName(customMusicFile.fileName) : null;
  const isSidebarVariant = variant === "sidebar";

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const estimatedMenuHeight = Math.min(window.innerHeight - 32, 460);
      setMenuStyle(
        getStudioCompactMenuStyle({
          estimatedMenuHeight,
          minWidth: 312,
          preferredWidth: 368,
          triggerRect,
        }),
      );
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  const openCustomMusicPicker = () => {
    fileInputRef.current?.click();
  };

  const handleCustomMusicChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) return;

    await onSelectCustomFile(file);
  };

  const handleCustomMusicSelect = () => {
    if (customMusicFile) {
      onSelectMusicType("custom");
      setIsOpen(false);
      return;
    }

    openCustomMusicPicker();
  };

  return (
    <div className={`studio-music-selector${isSidebarVariant ? " studio-music-selector--sidebar" : ""}`} ref={rootRef}>
      <input
        ref={fileInputRef}
        className="studio-music-selector__file-input"
        type="file"
        accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/*"
        onChange={(event) => {
          void handleCustomMusicChange(event);
        }}
      />

      <button
        ref={triggerRef}
        className={
          isSidebarVariant
            ? `studio-music-selector__trigger studio-music-selector__trigger--sidebar studio-sidebar__item studio-sidebar__item--static${
                isOpen ? " is-open" : ""
              }`
            : `studio-canvas-prompt__chip studio-music-selector__trigger${isOpen ? " is-open" : ""}`
        }
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isSidebarVariant ? (
          <>
            <span className="studio-sidebar__item-icon" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M14 5v10.5a2.5 2.5 0 1 1-2-2.45V7.2l8-1.7v8a2.5 2.5 0 1 1-2-2.45V5.85L14 6.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="studio-sidebar__item-copy">
              <strong>Музыка</strong>
              <span className="studio-sidebar__item-value" title={selectedMusicTitle}>{selectedMusicLabel}</span>
            </span>
            <svg className="studio-music-selector__icon studio-music-selector__icon--sidebar" width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          <>
            <span className="studio-music-selector__label">Музыка</span>
            <strong className="studio-music-selector__value" title={selectedMusicTitle}>
              {selectedMusicLabel}
            </strong>
            <svg className="studio-music-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>

      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="studio-music-selector__menu"
              id={menuId}
              role="menu"
              aria-label="Выбор музыки"
              style={menuStyle}
            >
              <div className="studio-music-selector__section">
                <span className="studio-music-selector__menu-title">Режим</span>
                <div className="studio-music-selector__presets">
                  {studioMusicOptions
                    .filter((option) => option.id === "ai" || option.id === "none")
                    .map((option) => (
                      <button
                        key={option.id}
                        className={`studio-music-selector__preset${selectedMusicType === option.id ? " is-selected" : ""}`}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selectedMusicType === option.id}
                        onClick={() => {
                          onSelectMusicType(option.id);
                          setIsOpen(false);
                        }}
                      >
                        <span>{option.label}</span>
                        <small>{option.description}</small>
                      </button>
                    ))}
                </div>
              </div>

              <div className="studio-music-selector__section">
                <span className="studio-music-selector__menu-title">Стиль музыки</span>
                <div className="studio-music-selector__styles">
                  {studioMusicStyleOptions.map((option) => (
                    <button
                      key={option.id}
                      className={`studio-music-selector__style${selectedMusicType === option.id ? " is-selected" : ""}`}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selectedMusicType === option.id}
                      onClick={() => {
                        onSelectMusicType(option.id);
                        setIsOpen(false);
                      }}
                    >
                      <span>{option.label}</span>
                      <small>{option.description}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="studio-music-selector__section">
                <span className="studio-music-selector__menu-title">Своя музыка</span>
                <div className={`studio-music-selector__custom${selectedMusicType === "custom" ? " is-selected" : ""}`}>
                  <button
                    className="studio-music-selector__custom-main"
                    type="button"
                    onClick={handleCustomMusicSelect}
                  >
                    <span>Загрузить свой трек</span>
                    <small title={customMusicFile?.fileName}>
                      {customMusicFileLabel ?? "Поддерживаются .mp3, .wav и .m4a"}
                    </small>
                  </button>
                  <button
                    className="studio-music-selector__custom-action"
                    type="button"
                    aria-label={customMusicFile ? "Заменить аудиофайл" : "Загрузить аудиофайл"}
                    title={customMusicFile ? "Заменить файл" : "Загрузить файл"}
                    onClick={openCustomMusicPicker}
                  >
                    {isPreparingCustomMusic ? (
                      <span className="studio-music-selector__spinner" aria-hidden="true"></span>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 18.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
                {uploadError ? <p className="studio-music-selector__error">{uploadError}</p> : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function WorkspacePage({ defaultTab, initialProfile = null, session, onLogout, onProfileChange }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const routeStudioState = useMemo(() => getStudioRouteState(location.search), [location.search]);
  const initialExamplePrefillRef = useRef(readExamplePrefillIntent());
  const initialStudioEntryIntentRef = useRef(readStudioEntryIntent());
  const preserveExamplePrefillRef = useRef(Boolean(initialExamplePrefillRef.current));
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(defaultTab);
  const [studioView, setStudioView] = useState<StudioView>(() =>
    defaultTab === "studio" ? getStudioViewFromRouteSection(getStudioRouteSection(location.search)) : "create",
  );
  const [createMode, setCreateMode] = useState<StudioCreateMode>("default");
  const [topicInput, setTopicInput] = useState("");
  const previousActiveTabRef = useRef<WorkspaceTab>(defaultTab);
  const [contentPlanQueryInput, setContentPlanQueryInput] = useState("");
  const [hasEditedContentPlanQueryInput, setHasEditedContentPlanQueryInput] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<StudioLanguage>("ru");
  const [subtitleStyleOptions, setSubtitleStyleOptions] = useState<StudioSubtitleStyleOption[]>([]);
  const [subtitleColorCatalog, setSubtitleColorCatalog] = useState<StudioSubtitleColorCatalogOption[]>([]);
  const [areSubtitlesEnabled, setAreSubtitlesEnabled] = useState(true);
  const [isVoiceoverEnabled, setIsVoiceoverEnabled] = useState(true);
  const [selectedSubtitleStyleId, setSelectedSubtitleStyleId] = useState<StudioSubtitleStyleOption["id"]>("modern");
  const [selectedSubtitleColorId, setSelectedSubtitleColorId] = useState<StudioSubtitleColorOption["id"]>("purple");
  const [selectedSubtitleExampleId, setSelectedSubtitleExampleId] = useState<StudioSubtitleExampleOption["id"]>(studioSubtitleExampleOptions[0]?.id ?? "hook");
  const [selectedVoiceId, setSelectedVoiceId] = useState<StudioVoiceOption["id"]>(
    studioVoiceOptionsByLanguage.ru[0]?.id ?? "Bys_24000",
  );
  const [selectedVideoMode, setSelectedVideoMode] = useState<StudioVideoMode>("standard");
  const [selectedCustomVideo, setSelectedCustomVideo] = useState<StudioCustomVideoFile | null>(null);
  const [isPreparingCustomVideo, setIsPreparingCustomVideo] = useState(false);
  const [videoSelectionError, setVideoSelectionError] = useState<string | null>(null);
  const initialBrandSettingsRef = useRef<StudioBrandSettingsSnapshot | null>(null);
  if (!initialBrandSettingsRef.current) {
    initialBrandSettingsRef.current = readStoredStudioBrandSettings(session.email);
  }
  const [selectedBrandLogo, setSelectedBrandLogo] = useState<StudioBrandLogoFile | null>(
    () => initialBrandSettingsRef.current?.brandLogoFile ?? null,
  );
  const [brandText, setBrandText] = useState(() => initialBrandSettingsRef.current?.brandText ?? "");
  const [isPreparingBrandLogo, setIsPreparingBrandLogo] = useState(false);
  const [brandSelectionError, setBrandSelectionError] = useState<string | null>(null);
  const [selectedMusicType, setSelectedMusicType] = useState<StudioMusicType>("ai");
  const [selectedCustomMusic, setSelectedCustomMusic] = useState<StudioCustomMusicFile | null>(null);
  const [isPreparingCustomMusic, setIsPreparingCustomMusic] = useState(false);
  const [musicSelectionError, setMusicSelectionError] = useState<string | null>(null);
  const [, setStatus] = useState("Ready to generate");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [studioPreviewPosterUrl, setStudioPreviewPosterUrl] = useState<string | null>(null);
  const [failedStudioVideoUrls, setFailedStudioVideoUrls] = useState<string[]>([]);
  const [studioPreviewVolume, setStudioPreviewVolume] = useState(0.88);
  const [dismissedStudioPreviewKey, setDismissedStudioPreviewKey] = useState<string | null>(() =>
    readDismissedStudioPreviewKey(session.email),
  );
  const [hiddenMediaLibraryItemKeys, setHiddenMediaLibraryItemKeys] = useState<string[]>(() =>
    readHiddenMediaLibraryItemKeys(session.email),
  );
  const [isWorkspaceBootstrapPending, setIsWorkspaceBootstrapPending] = useState(true);
  const [workspaceProfile, setWorkspaceProfile] = useState<WorkspaceProfile | null>(initialProfile);
  const [generatedVideo, setGeneratedVideo] = useState<StudioGeneration | null>(null);
  const [canManageLocalExamples, setCanManageLocalExamples] = useState(false);
  const [isLocalExampleModalOpen, setIsLocalExampleModalOpen] = useState(false);
  const [localExampleSource, setLocalExampleSource] = useState<WorkspaceLocalExampleSource | null>(null);
  const [selectedLocalExampleGoal, setSelectedLocalExampleGoal] = useState<WorkspaceLocalExampleGoal>("ads");
  const [isSavingLocalExample, setIsSavingLocalExample] = useState(false);
  const [localExampleSaveError, setLocalExampleSaveError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [insufficientCreditsContext, setInsufficientCreditsContext] = useState<InsufficientCreditsContext | null>(null);
  const [segmentEditorLoadedSession, setSegmentEditorLoadedSession] = useState<WorkspaceSegmentEditorSession | null>(null);
  const [segmentEditorDraft, setSegmentEditorDraft] = useState<WorkspaceSegmentEditorDraftSession | null>(null);
  const [segmentEditorAppliedSession, setSegmentEditorAppliedSession] = useState<WorkspaceSegmentEditorDraftSession | null>(null);
  const [segmentEditorError, setSegmentEditorError] = useState<string | null>(null);
  const [segmentEditorVideoError, setSegmentEditorVideoError] = useState<string | null>(null);
  const [segmentEditorPreviewTimes, setSegmentEditorPreviewTimes] = useState<Record<number, number>>({});
  const [segmentThumbDropInsertIndex, setSegmentThumbDropInsertIndex] = useState<number | null>(null);
  const [segmentThumbDragState, setSegmentThumbDragState] = useState<WorkspaceSegmentThumbDragState | null>(null);
  const [queuedSegmentEditorPlaybackIndex, setQueuedSegmentEditorPlaybackIndex] = useState<number | null>(null);
  const [segmentCarouselDragProgress, setSegmentCarouselDragProgress] = useState(0);
  const [isSegmentCarouselDragging, setIsSegmentCarouselDragging] = useState(false);
  const [isSegmentEditorLoading, setIsSegmentEditorLoading] = useState(false);
  const [isSegmentAiPhotoModalOpen, setIsSegmentAiPhotoModalOpen] = useState(false);
  const [isSegmentAiPhotoModalVisible, setIsSegmentAiPhotoModalVisible] = useState(false);
  const [segmentAiPhotoModalLibraryRenderCount, setSegmentAiPhotoModalLibraryRenderCount] = useState(
    SEGMENT_AI_PHOTO_MODAL_LIBRARY_INITIAL_RENDER_COUNT,
  );
  const [segmentAiPhotoModalSegmentIndex, setSegmentAiPhotoModalSegmentIndex] = useState<number | null>(null);
  const [segmentAiPhotoModalPrompt, setSegmentAiPhotoModalPrompt] = useState("");
  const [segmentImageEditModalPrompt, setSegmentImageEditModalPrompt] = useState("");
  const [segmentAiVideoModalPrompt, setSegmentAiVideoModalPrompt] = useState("");
  const [segmentAiPhotoModalTab, setSegmentAiPhotoModalTab] = useState<WorkspaceSegmentVisualModalTab>("ai_photo");
  const [segmentEditorPromptSceneMode, setSegmentEditorPromptSceneMode] = useState<"create" | "edit">("create");
  const [segmentAiPhotoModalLibraryFilter, setSegmentAiPhotoModalLibraryFilter] = useState<WorkspaceMediaLibraryFilter>("all");
  const [isSegmentAiPhotoPromptImproving, setIsSegmentAiPhotoPromptImproving] = useState(false);
  const [isSegmentAiPhotoPromptImproved, setIsSegmentAiPhotoPromptImproved] = useState(false);
  const [isSegmentAiPhotoPromptHighlighted, setIsSegmentAiPhotoPromptHighlighted] = useState(false);
  const [isSegmentEditorGeneratingAiPhoto, setIsSegmentEditorGeneratingAiPhoto] = useState(false);
  const [segmentEditorGeneratingAiPhotoSegmentIndex, setSegmentEditorGeneratingAiPhotoSegmentIndex] = useState<number | null>(null);
  const [isSegmentEditorGeneratingAiVideo, setIsSegmentEditorGeneratingAiVideo] = useState(false);
  const [segmentEditorGeneratingAiVideoSegmentIndex, setSegmentEditorGeneratingAiVideoSegmentIndex] = useState<number | null>(null);
  const [isSegmentEditorGeneratingPhotoAnimation, setIsSegmentEditorGeneratingPhotoAnimation] = useState(false);
  const [segmentEditorGeneratingPhotoAnimationSegmentIndex, setSegmentEditorGeneratingPhotoAnimationSegmentIndex] = useState<number | null>(null);
  const [isSegmentEditorGeneratingImageEdit, setIsSegmentEditorGeneratingImageEdit] = useState(false);
  const [segmentEditorGeneratingImageEditSegmentIndex, setSegmentEditorGeneratingImageEditSegmentIndex] = useState<number | null>(null);
  const [isSegmentEditorUpscalingImage, setIsSegmentEditorUpscalingImage] = useState(false);
  const [segmentEditorUpscalingImageSegmentIndex, setSegmentEditorUpscalingImageSegmentIndex] = useState<number | null>(null);
  const [isSegmentEditorPreparingCustomVideo, setIsSegmentEditorPreparingCustomVideo] = useState(false);
  const [segmentEditorPanelHeightLock, setSegmentEditorPanelHeightLock] = useState<number | null>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [playingSegmentEditorPreviewIndex, setPlayingSegmentEditorPreviewIndex] = useState<number | null>(null);
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectDeleteError, setProjectDeleteError] = useState<string | null>(null);
  const [projectPendingDelete, setProjectPendingDelete] = useState<WorkspaceProject | null>(null);
  const [projectPendingDeleteProjects, setProjectPendingDeleteProjects] = useState<WorkspaceProject[]>([]);
  const [expandedAccountProjectStackKey, setExpandedAccountProjectStackKey] = useState<string | null>(null);
  const [expandedStudioProjectStackKey, setExpandedStudioProjectStackKey] = useState<string | null>(null);
  const [isProjectDeleteSubmitting, setIsProjectDeleteSubmitting] = useState(false);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [hasLoadedProjects, setHasLoadedProjects] = useState(false);
  const [storedSegmentEditorDrafts, setStoredSegmentEditorDrafts] = useState<WorkspaceSegmentEditorDraftSession[]>(() =>
    readStoredWorkspaceSegmentEditorDrafts(session.email),
  );
  const [generatedMediaLibraryEntries, setGeneratedMediaLibraryEntries] = useState<WorkspaceGeneratedMediaLibraryEntry[]>(() =>
    readStoredGeneratedMediaLibraryEntries(session.email),
  );
  const [mediaLibraryItems, setMediaLibraryItems] = useState<WorkspaceMediaLibraryItem[]>([]);
  const [mediaLibraryFilter, setMediaLibraryFilter] = useState<WorkspaceMediaLibraryFilter>("all");
  const [mediaLibraryNextCursor, setMediaLibraryNextCursor] = useState<string | null>(null);
  const [mediaLibraryTotal, setMediaLibraryTotal] = useState<number | null>(null);
  const [loadedMediaLibraryFingerprint, setLoadedMediaLibraryFingerprint] = useState<string | null>(null);
  const [loadedMediaLibraryReloadToken, setLoadedMediaLibraryReloadToken] = useState(-1);
  const [mediaLibraryError, setMediaLibraryError] = useState<string | null>(null);
  const [isMediaLibraryLoading, setIsMediaLibraryLoading] = useState(false);
  const [isMediaLibraryLoadingMore, setIsMediaLibraryLoadingMore] = useState(false);
  const [mediaLibraryReloadToken, setMediaLibraryReloadToken] = useState(0);
  const [contentPlans, setContentPlans] = useState<WorkspaceContentPlan[]>([]);
  const [contentPlansError, setContentPlansError] = useState<string | null>(null);
  const [hasLoadedContentPlans, setHasLoadedContentPlans] = useState(false);
  const [isContentPlansLoading, setIsContentPlansLoading] = useState(false);
  const [isContentPlanGenerating, setIsContentPlanGenerating] = useState(false);
  const [contentPlanDeletingPlanId, setContentPlanDeletingPlanId] = useState<string | null>(null);
  const [contentPlanDeletingIdeaId, setContentPlanDeletingIdeaId] = useState<string | null>(null);
  const [contentPlanUpdatingIdeaId, setContentPlanUpdatingIdeaId] = useState<string | null>(null);
  const [isContentPlanVisible, setIsContentPlanVisible] = useState<boolean>(() =>
    readStudioContentPlanVisibility(session.email),
  );
  const [adaptivePromptPanelWidth, setAdaptivePromptPanelWidth] = useState<number | null>(null);
  const [activeContentPlanId, setActiveContentPlanId] = useState<string | null>(null);
  const [expandedContentPlanUsedIdeasPlanId, setExpandedContentPlanUsedIdeasPlanId] = useState<string | null>(null);
  const [selectedContentPlanIdeaId, setSelectedContentPlanIdeaId] = useState<string | null>(null);
  const [composerSourceIdea, setComposerSourceIdea] = useState<WorkspaceContentPlanComposerSource | null>(null);
  const [activeProjectPreviewId, setActiveProjectPreviewId] = useState<string | null>(null);
  const [projectPreviewModal, setProjectPreviewModal] = useState<WorkspaceProject | null>(null);
  const [projectPreviewModalAspectRatio, setProjectPreviewModalAspectRatio] = useState<number | null>(null);
  const [mediaLibraryPreviewModal, setMediaLibraryPreviewModal] = useState<WorkspaceMediaLibraryItem | null>(null);
  const [previewModalOpenToken, setPreviewModalOpenToken] = useState<number>(0);
  const [previewModalPlaybackError, setPreviewModalPlaybackError] = useState<string | null>(null);
  const [previewModalUseFallbackSource, setPreviewModalUseFallbackSource] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishBootstrap, setPublishBootstrap] = useState<WorkspacePublishBootstrapPayload | null>(null);
  const [publishTargetVideoProjectId, setPublishTargetVideoProjectId] = useState<number | null>(null);
  const [publishTargetTitle, setPublishTargetTitle] = useState<string>("");
  const [publishBootstrapError, setPublishBootstrapError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishBootstrapLoading, setIsPublishBootstrapLoading] = useState(false);
  const [isPublishSubmitting, setIsPublishSubmitting] = useState(false);
  const [isDisconnectingPublishChannel, setIsDisconnectingPublishChannel] = useState(false);
  const [publishJobStatus, setPublishJobStatus] = useState<WorkspacePublishJobStatusPayload | null>(null);
  const [selectedPublishChannelPk, setSelectedPublishChannelPk] = useState<number | null>(null);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [publishHashtags, setPublishHashtags] = useState("");
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [publishScheduledAtInput, setPublishScheduledAtInput] = useState("");
  const [isPublishPlannerOpen, setIsPublishPlannerOpen] = useState(false);
  const [publishPlannerStyle, setPublishPlannerStyle] = useState<CSSProperties | null>(null);
  const [publishCalendarMonth, setPublishCalendarMonth] = useState(() => startOfPublishMonth(new Date()));
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaLibraryScrollRootRef = useRef<HTMLDivElement | null>(null);
  const mediaLibraryLoadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const mediaLibraryLoadMoreCursorRef = useRef<string | null>(null);
  const mediaLibraryPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewModalVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewModalPendingPlaybackRef = useRef<{ immediate?: boolean; resetToStart?: boolean } | null>(null);
  const pendingProjectDeleteIdsRef = useRef<Set<string>>(new Set());
  const contentPlanPanelRef = useRef<HTMLElement | null>(null);
  const promptInnerRef = useRef<HTMLDivElement | null>(null);
  const promptFooterRef = useRef<HTMLDivElement | null>(null);
  const promptChipsRef = useRef<HTMLDivElement | null>(null);
  const promptSubmitRef = useRef<HTMLDivElement | null>(null);
  const segmentAiPhotoModalPanelRef = useRef<HTMLFormElement | null>(null);
  const segmentAiPhotoModalFileInputRef = useRef<HTMLInputElement | null>(null);
  const segmentAiPhotoModalTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const segmentAiPhotoPromptHighlightTimerRef = useRef<number | null>(null);
  const segmentAiPhotoModalCloseTimerRef = useRef<number | null>(null);
  const segmentAiPhotoPromptImproveRunRef = useRef(0);
  const segmentEditorLanguageTranslateRunRef = useRef(0);
  const resetTimerRef = useRef<number | null>(null);
  const generationRunRef = useRef(0);
  const segmentAiPhotoRunRef = useRef(0);
  const segmentAiVideoRunRef = useRef(0);
  const segmentPhotoAnimationRunRef = useRef(0);
  const segmentPhotoAnimationActiveJobIdRef = useRef<string | null>(null);
  const segmentImageEditRunRef = useRef(0);
  const segmentImageUpscaleRunRef = useRef(0);
  const segmentEditorRunRef = useRef(0);
  const segmentEditorRequestAbortRef = useRef<AbortController | null>(null);
  const segmentEditorRouteRestoreKeyRef = useRef<string | null>(null);
  const segmentEditorHandledRouteRestoreKeyRef = useRef<string | null>(null);
  const segmentEditorDraftRef = useRef<WorkspaceSegmentEditorDraftSession | null>(null);
  const detachedSegmentEditorDraftRef = useRef<{
    activeSegmentIndex: number;
    draft: WorkspaceSegmentEditorDraftSession;
  } | null>(null);
  const pendingStudioRouteSectionRef = useRef<StudioEntryIntentSection | null>(null);
  const pendingStudioRouteSectionResetTimerRef = useRef<number | null>(null);
  const segmentEditorPreviewVideoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const segmentEditorPreviewVideoRefCallbacks = useRef<Record<number, (element: HTMLVideoElement | null) => void>>({});
  const segmentEditorDetachedWarmupVideoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const segmentEditorPreviewResetTokenRef = useRef(0);
  const segmentEditorCreateModeRef = useRef<StudioCreateMode>("default");
  const activeSegmentPlaybackIndexRef = useRef<number | null>(null);
  const pendingSegmentEditorActivatedPlaybackIndexRef = useRef<number | null>(null);
  const queuedSegmentEditorPlaybackIndexRef = useRef<number | null>(null);
  const requestSegmentEditorVideoPlaybackRef = useRef<
    null | ((segmentPlaybackIndex: number, element: HTMLVideoElement, options?: { resetToStart?: boolean }) => Promise<unknown>)
  >(null);
  const segmentEditorSyntheticPlaybackFrameRef = useRef<number | null>(null);
  const segmentEditorSyntheticPlaybackFinishTimeoutRef = useRef<number | null>(null);
  const segmentEditorSyntheticPlaybackRef = useRef<{
    duration: number;
    segmentIndex: number;
    startedAt: number;
  } | null>(null);
  const segmentCarouselWheelDeltaRef = useRef(0);
  const segmentCarouselWheelResetTimerRef = useRef<number | null>(null);
  const segmentCarouselLastWheelStepAtRef = useRef(0);
  const segmentCarouselReleaseTimerRef = useRef<number | null>(null);
  const segmentCarouselDragStateRef = useRef<{
    clickTarget?: {
      previewKind: WorkspaceSegmentPreviewKind;
      segmentArrayIndex: number;
      segmentPlaybackIndex: number;
    };
    dragDetected: boolean;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const segmentCarouselSuppressClickUntilRef = useRef(0);
  const segmentThumbStripRef = useRef<HTMLDivElement | null>(null);
  const segmentThumbButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const segmentThumbDragStateRef = useRef<WorkspaceSegmentThumbDragState | null>(null);
  const segmentThumbPendingDragRef = useRef<{
    index: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const segmentThumbSuppressClickUntilRef = useRef(0);
  const publishRunRef = useRef(0);
  const publishPlannerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const publishPlannerPopoverRef = useRef<HTMLDivElement | null>(null);
  const referencedStudioObjectUrlsRef = useRef<Set<string>>(new Set());
  const publishFormSnapshotRef = useRef({
    description: "",
    hashtags: "",
    mode: "now" as "now" | "schedule",
    scheduledAtInput: "",
    title: "",
  });
  const publishTitleFieldId = useId();
  const publishDescriptionFieldId = useId();
  const publishHashtagsFieldId = useId();
  const publishTimeFieldId = useId();
  const publishPlannerPopoverId = useId();
  const subtitleColorOptions = subtitleColorCatalog.length
    ? buildStudioSubtitleColorOptions(subtitleColorCatalog)
    : [fallbackStudioSubtitleColorOption];
  const updateDismissedStudioPreviewKey = useCallback(
    (dismissKey: string | null) => {
      setDismissedStudioPreviewKey(dismissKey);
      persistDismissedStudioPreviewKey(session.email, dismissKey);
    },
    [session.email],
  );
  const updateContentPlanVisibility = useCallback(
    (nextValue: boolean) => {
      setIsContentPlanVisible(nextValue);
      persistStudioContentPlanVisibility(session.email, nextValue);
    },
    [session.email],
  );
  const clearStudioPromptInput = useCallback(() => {
    setTopicInput("");
    setComposerSourceIdea(null);
    setSelectedContentPlanIdeaId(null);
  }, []);

  useEffect(() => {
    const previousActiveTab = previousActiveTabRef.current;

    if (activeTab === "studio" && previousActiveTab !== "studio") {
      clearStudioPromptInput();
    }

    previousActiveTabRef.current = activeTab;
  }, [activeTab, clearStudioPromptInput]);

  useEffect(() => {
    if (!isContentPlanVisible || createMode === "segment-editor") {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (contentPlanPanelRef.current?.contains(target)) {
        return;
      }

      if (target instanceof Element && target.closest('[data-studio-content-plan-toggle="true"]')) {
        return;
      }

      updateContentPlanVisibility(false);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [createMode, isContentPlanVisible, updateContentPlanVisibility]);

  const dismissMediaLibraryItem = useCallback(
    (item: WorkspaceMediaLibraryItem) => {
      const itemKey = getWorkspaceMediaLibraryItemStorageKey(item);

      if (typeof item.assetId === "number" && item.assetId > 0) {
        setMediaLibraryItems((current) => current.filter((candidate) => candidate.assetId !== item.assetId));

        void fetch(`/api/workspace/media-library/${encodeURIComponent(String(item.assetId))}`, {
          method: "DELETE",
        }).then(async (response) => {
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error ?? "Не удалось удалить asset из медиатеки.");
          }

          setMediaLibraryReloadToken((current) => current + 1);
        }).catch((error) => {
          setMediaLibraryError(error instanceof Error ? error.message : "Не удалось удалить asset из медиатеки.");
          setMediaLibraryReloadToken((current) => current + 1);
        });
        return;
      }

      setHiddenMediaLibraryItemKeys((current) => {
        if (current.includes(itemKey)) {
          return current;
        }

        const nextKeys = [...current, itemKey];
        persistHiddenMediaLibraryItemKeys(session.email, nextKeys);
        return nextKeys;
      });
    },
    [session.email],
  );
  const isSegmentVisualGenerationPending = useCallback(
    (segmentIndex: number) =>
      segmentEditorGeneratingAiPhotoSegmentIndex === segmentIndex ||
      segmentEditorGeneratingImageEditSegmentIndex === segmentIndex ||
      segmentEditorGeneratingAiVideoSegmentIndex === segmentIndex ||
      segmentEditorGeneratingPhotoAnimationSegmentIndex === segmentIndex ||
      segmentEditorUpscalingImageSegmentIndex === segmentIndex,
    [
      segmentEditorGeneratingAiPhotoSegmentIndex,
      segmentEditorGeneratingAiVideoSegmentIndex,
      segmentEditorGeneratingImageEditSegmentIndex,
      segmentEditorGeneratingPhotoAnimationSegmentIndex,
      segmentEditorUpscalingImageSegmentIndex,
    ],
  );
  const getSegmentVisualPlaceholderLabel = useCallback(
    (segmentIndex: number) => (isSegmentVisualGenerationPending(segmentIndex) ? "Генерация..." : "Нет превью"),
    [isSegmentVisualGenerationPending],
  );
  const syncStorageBackedMediaLibraryState = useCallback(() => {
    const nextStoredDrafts = readStoredWorkspaceSegmentEditorDrafts(session.email);
    setStoredSegmentEditorDrafts((currentDrafts) => {
      if (!currentDrafts.length) {
        return nextStoredDrafts;
      }

      const draftsByProjectId = new Map(nextStoredDrafts.map((draft) => [draft.projectId, draft] as const));
      if (segmentEditorDraft) {
        draftsByProjectId.set(
          segmentEditorDraft.projectId,
          normalizeStoredWorkspaceSegmentEditorDraftSession(segmentEditorDraft),
        );
      }
      currentDrafts.forEach((draft) => {
        if (!draftsByProjectId.has(draft.projectId)) {
          draftsByProjectId.set(draft.projectId, draft);
        }
      });

      return Array.from(draftsByProjectId.values()).sort((left, right) => right.projectId - left.projectId);
    });

    const nextGeneratedEntries = readStoredGeneratedMediaLibraryEntries(session.email);
    setGeneratedMediaLibraryEntries((currentEntries) => {
      if (!currentEntries.length) {
        return nextGeneratedEntries;
      }

      if (!nextGeneratedEntries.length) {
        return currentEntries;
      }

      const entriesById = new Map<string, WorkspaceGeneratedMediaLibraryEntry>();

      [...currentEntries, ...nextGeneratedEntries].forEach((entry) => {
        if (!entriesById.has(entry.id)) {
          entriesById.set(entry.id, entry);
        }
      });

      return Array.from(entriesById.values())
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, WORKSPACE_GENERATED_MEDIA_LIBRARY_MAX_ENTRIES);
    });
  }, [segmentEditorDraft, session.email]);
  useEffect(() => {
    const nextReferencedUrls = getReferencedStudioObjectUrls({
      brandLogoFile: selectedBrandLogo,
      customMusicFile: selectedCustomMusic,
      customVideoFile: selectedCustomVideo,
      segmentEditorAppliedSession,
      segmentEditorDraft,
    });

    referencedStudioObjectUrlsRef.current.forEach((url) => {
      if (!nextReferencedUrls.has(url)) {
        revokeStudioObjectUrl(url);
      }
    });

    referencedStudioObjectUrlsRef.current = nextReferencedUrls;
  }, [segmentEditorAppliedSession, segmentEditorDraft, selectedBrandLogo, selectedCustomMusic, selectedCustomVideo]);

  useEffect(() => {
    persistStudioBrandSettings(session.email, {
      brandLogoFile: selectedBrandLogo,
      brandText,
    });
  }, [brandText, selectedBrandLogo, session.email]);

  useEffect(
    () => () => {
      if (segmentAiPhotoModalCloseTimerRef.current) {
        window.clearTimeout(segmentAiPhotoModalCloseTimerRef.current);
      }
      referencedStudioObjectUrlsRef.current.forEach((url) => {
        revokeStudioObjectUrl(url);
      });
      referencedStudioObjectUrlsRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    const shouldSyncStorageBackedMediaLibrary =
      activeTab === "studio" &&
      (studioView === "media" ||
        ((isSegmentAiPhotoModalOpen || (studioView === "create" && createMode === "segment-editor")) &&
          segmentAiPhotoModalTab === "library"));

    if (!shouldSyncStorageBackedMediaLibrary) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      syncStorageBackedMediaLibraryState();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeTab,
    createMode,
    isSegmentAiPhotoModalOpen,
    segmentAiPhotoModalTab,
    studioView,
    syncStorageBackedMediaLibraryState,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const normalizedEmail = normalizeWorkspaceEmail(session.email);
    const normalizedDraftEmail = normalizeWorkspaceSegmentEditorStorageEmail(session.email);
    const generatedStorageKey = normalizedEmail ? getWorkspaceGeneratedMediaLibraryStorageKey(normalizedEmail) : null;
    const draftStorageKeyPrefix = normalizedDraftEmail
      ? `${WORKSPACE_SEGMENT_EDITOR_DRAFT_STORAGE_KEY_PREFIX}${normalizedDraftEmail}:`
      : null;

    const handleFocus = () => {
      syncStorageBackedMediaLibraryState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncStorageBackedMediaLibraryState();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      const storageKey = String(event.key ?? "").trim();
      if (!storageKey) {
        return;
      }

      if (
        (generatedStorageKey && storageKey === generatedStorageKey) ||
        (draftStorageKeyPrefix && storageKey.startsWith(draftStorageKeyPrefix))
      ) {
        syncStorageBackedMediaLibraryState();
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session.email, syncStorageBackedMediaLibraryState]);

  const hasExplicitStudioRouteState =
    location.pathname.startsWith("/app/studio") &&
    (routeStudioState.section !== "create" || routeStudioState.projectId !== null || routeStudioState.segmentIndex !== null);

  const markPendingStudioRouteSection = (section: StudioEntryIntentSection) => {
    if (pendingStudioRouteSectionResetTimerRef.current) {
      window.clearTimeout(pendingStudioRouteSectionResetTimerRef.current);
      pendingStudioRouteSectionResetTimerRef.current = null;
    }
    pendingStudioRouteSectionRef.current = section;
  };

  const syncStudioRouteSection = (
    section: StudioEntryIntentSection,
    options?: { projectId?: number | null; replace?: boolean; segmentIndex?: number | null },
  ) => {
    const baseSearch = location.pathname.startsWith("/app/studio") ? location.search : "";
    const nextUrl = buildStudioRouteUrl(baseSearch, section, {
      projectId: options?.projectId,
      segmentIndex: options?.segmentIndex,
    });
    const currentUrl = `${location.pathname}${location.search}`;

    if (currentUrl === nextUrl) {
      return;
    }

    markPendingStudioRouteSection(section);
    navigate(nextUrl, { replace: options?.replace ?? false });
  };

  const getSegmentEditorOrderSnapshot = (draft: Pick<WorkspaceSegmentEditorDraftSession, "segments"> | null | undefined) =>
    draft?.segments.map((segment, arrayIndex) => ({
      arrayIndex,
      mediaType: segment.mediaType,
      segmentIndex: segment.index,
      videoAction: segment.videoAction,
    })) ?? [];

  const getSegmentEditorRouteSegmentIndex = (
    draft: Pick<WorkspaceSegmentEditorDraftSession, "segments"> | null | undefined,
    segmentArrayIndex: number,
  ) => {
    if (!draft || draft.segments.length === 0) {
      return Math.max(0, segmentArrayIndex);
    }

    return draft.segments[segmentArrayIndex]?.index ?? Math.max(0, Math.min(segmentArrayIndex, draft.segments.length - 1));
  };

  const resolveSegmentEditorArrayIndexFromRouteSegment = (
    draft: Pick<WorkspaceSegmentEditorDraftSession, "segments"> | null | undefined,
    routeSegmentIndex: number,
  ) => {
    if (!draft || draft.segments.length === 0) {
      return 0;
    }

    const stableMatchIndex = draft.segments.findIndex((segment) => segment.index === routeSegmentIndex);
    if (stableMatchIndex >= 0) {
      return stableMatchIndex;
    }

    return Math.max(0, Math.min(routeSegmentIndex, draft.segments.length - 1));
  };

  const syncSegmentEditorRouteForArrayIndex = (
    draft: Pick<WorkspaceSegmentEditorDraftSession, "projectId" | "segments"> | null | undefined,
    segmentArrayIndex: number,
    options?: { replace?: boolean },
  ) => {
    if (!draft || draft.segments.length === 0) {
      return;
    }

    const boundedSegmentArrayIndex = Math.max(0, Math.min(segmentArrayIndex, draft.segments.length - 1));
    const routeSegmentIndex = getSegmentEditorRouteSegmentIndex(draft, boundedSegmentArrayIndex);
    const handledRouteKey = `${draft.projectId}:${routeSegmentIndex}`;
    segmentEditorRouteRestoreKeyRef.current = null;
    segmentEditorHandledRouteRestoreKeyRef.current = handledRouteKey;
    syncStudioRouteSection("edit", {
      projectId: draft.projectId,
      replace: options?.replace ?? true,
      segmentIndex: routeSegmentIndex,
    });
  };

  const activateSegmentEditorSegmentByArrayIndex = (
    nextSegmentArrayIndex: number,
    options?: { pendingPlaybackIndex?: number | null; replaceRoute?: boolean; syncRoute?: boolean },
  ) => {
    if (!segmentEditorDraft || segmentEditorDraft.segments.length === 0) {
      return;
    }

    const boundedSegmentArrayIndex = Math.max(0, Math.min(nextSegmentArrayIndex, segmentEditorDraft.segments.length - 1));
    if (boundedSegmentArrayIndex !== activeSegmentIndex) {
      pendingSegmentEditorActivatedPlaybackIndexRef.current = options?.pendingPlaybackIndex ?? null;
      resetSegmentEditorPreviewPlaybackState();
    }

    setActiveSegmentIndex(boundedSegmentArrayIndex);

    if (options?.syncRoute !== false) {
      syncSegmentEditorRouteForArrayIndex(segmentEditorDraft, boundedSegmentArrayIndex, {
        replace: options?.replaceRoute ?? true,
      });
    }
  };

  const logSegmentEditorDiagnostics = (
    event: string,
    payload: Record<string, unknown> = {},
    options?: { includeOrder?: boolean; level?: "debug" | "info" | "warn" | "error"; draft?: Pick<WorkspaceSegmentEditorDraftSession, "projectId" | "segments"> | null },
  ) => {
    const draftSnapshot = options?.draft ?? segmentEditorDraft;

    void logClientEvent(
      event,
      {
        ...payload,
        activeSegmentArrayIndex: activeSegmentIndex,
        activeSegmentStableIndex: draftSnapshot?.segments[activeSegmentIndex]?.index ?? null,
        createMode,
        draftProjectId: draftSnapshot?.projectId ?? null,
        path: `${location.pathname}${location.search}`,
        routeProjectId: routeStudioState.projectId,
        routeSection: routeStudioState.section,
        routeSegmentIndex: routeStudioState.segmentIndex,
        studioView,
        ...(options?.includeOrder ? { segmentOrder: getSegmentEditorOrderSnapshot(draftSnapshot) } : {}),
      },
      options?.level ?? "info",
    );
  };

  useEffect(() => {
    if (!location.pathname.startsWith("/app/studio")) {
      if (pendingStudioRouteSectionResetTimerRef.current) {
        window.clearTimeout(pendingStudioRouteSectionResetTimerRef.current);
        pendingStudioRouteSectionResetTimerRef.current = null;
      }
      pendingStudioRouteSectionRef.current = null;
      return;
    }

    if (pendingStudioRouteSectionRef.current === routeStudioState.section) {
      if (pendingStudioRouteSectionResetTimerRef.current) {
        window.clearTimeout(pendingStudioRouteSectionResetTimerRef.current);
      }
      pendingStudioRouteSectionResetTimerRef.current = window.setTimeout(() => {
        if (pendingStudioRouteSectionRef.current === routeStudioState.section) {
          pendingStudioRouteSectionRef.current = null;
        }
        pendingStudioRouteSectionResetTimerRef.current = null;
      }, 0);
    }
  }, [location.pathname, routeStudioState.section]);

  useEffect(() => {
    if (!location.pathname.startsWith("/app/studio")) {
      return;
    }

    const routeStudioView = getStudioViewFromRouteSection(routeStudioState.section);
    setStudioView((current) => (current === routeStudioView ? current : routeStudioView));
  }, [location.pathname, routeStudioState.section]);

  useEffect(() => {
    segmentEditorCreateModeRef.current = createMode;
  }, [createMode]);

  useEffect(() => {
    queuedSegmentEditorPlaybackIndexRef.current = queuedSegmentEditorPlaybackIndex;
  }, [queuedSegmentEditorPlaybackIndex]);

  useEffect(() => {
    return () => {
      if (pendingStudioRouteSectionResetTimerRef.current) {
        window.clearTimeout(pendingStudioRouteSectionResetTimerRef.current);
      }
      stopSegmentEditorPreviewVideoElements({ clearRefs: true });
      cancelSegmentEditorSyntheticPlayback();
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
      if (segmentCarouselWheelResetTimerRef.current) {
        window.clearTimeout(segmentCarouselWheelResetTimerRef.current);
      }
      if (segmentCarouselReleaseTimerRef.current) {
        window.clearTimeout(segmentCarouselReleaseTimerRef.current);
      }
      segmentCarouselDragStateRef.current = null;
      segmentEditorRequestAbortRef.current?.abort("segment-editor-dispose");
      generationRunRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const pendingExamplePrefill = initialExamplePrefillRef.current;
    if (!pendingExamplePrefill) return;

    if (hasExplicitStudioRouteState) {
      clearExamplePrefillIntent();
      initialExamplePrefillRef.current = null;
      return;
    }

    setStudioView("create");
    syncStudioRouteSection("create", { replace: true });
    setTopicInput(pendingExamplePrefill.prompt);
    applyExamplePrefillSettings(pendingExamplePrefill.settings);
    clearExamplePrefillIntent();
    initialExamplePrefillRef.current = null;
  }, [hasExplicitStudioRouteState]);

  useEffect(() => {
    const pendingStudioEntryIntent = initialStudioEntryIntentRef.current;
    if (!pendingStudioEntryIntent || initialExamplePrefillRef.current) {
      return;
    }

    if (hasExplicitStudioRouteState || new URLSearchParams(location.search).has("section")) {
      clearStudioEntryIntent();
      initialStudioEntryIntentRef.current = null;
      return;
    }

    setActiveTab("studio");
    clearStudioEntryIntent();
    initialStudioEntryIntentRef.current = null;
    syncStudioRouteSection(pendingStudioEntryIntent.section, { replace: true });

    if (pendingStudioEntryIntent.section === "projects") {
      setStudioView("projects");
      return;
    }

    if (pendingStudioEntryIntent.section === "media") {
      setStudioView("media");
      return;
    }

    setStudioView("create");

    if (pendingStudioEntryIntent.section === "edit") {
      void handleStudioCreateModeSwitch("segment-editor");
      return;
    }

    void handleStudioCreateModeSwitch("default");
  }, [hasExplicitStudioRouteState, location.search]);

  const isAnyPreviewModalOpen = isPreviewModalOpen || Boolean(projectPreviewModal) || Boolean(mediaLibraryPreviewModal) || isPublishModalOpen;
  const isAnyWorkspaceModalOpen =
    isAnyPreviewModalOpen ||
    isSegmentAiPhotoModalOpen ||
    isLocalExampleModalOpen ||
    Boolean(projectPendingDelete) ||
    Boolean(insufficientCreditsContext);

  const stopPreviewModalVideoElement = (element: HTMLVideoElement | null) => {
    if (!element) {
      return;
    }

    element.pause();
    element.removeAttribute("src");
    element.load();
  };

  const closePreviewModals = () => {
    stopPreviewModalVideoElement(previewModalVideoRef.current);
    stopPreviewModalVideoElement(mediaLibraryPreviewVideoRef.current);
    setIsPreviewModalOpen(false);
    setProjectPreviewModal(null);
    setProjectPreviewModalAspectRatio(null);
    setMediaLibraryPreviewModal(null);
    setPreviewModalPlaybackError(null);
    setPreviewModalUseFallbackSource(false);
    previewModalPendingPlaybackRef.current = null;
  };

  const closePublishModal = () => {
    publishRunRef.current += 1;
    setIsPublishModalOpen(false);
    setIsPublishBootstrapLoading(false);
    setIsPublishSubmitting(false);
    setIsPublishPlannerOpen(false);
    setPublishPlannerStyle(null);
    setPublishBootstrapError(null);
    setPublishError(null);
    setPublishJobStatus(null);
    setPublishCalendarMonth(startOfPublishMonth(new Date()));
  };

  const closeLocalExampleModal = () => {
    if (isSavingLocalExample) {
      return;
    }

    setIsLocalExampleModalOpen(false);
    setLocalExampleSaveError(null);
    setLocalExampleSource(null);
  };

  const resetSegmentAiPhotoModalState = useCallback(() => {
    if (segmentAiPhotoModalCloseTimerRef.current) {
      window.clearTimeout(segmentAiPhotoModalCloseTimerRef.current);
      segmentAiPhotoModalCloseTimerRef.current = null;
    }
    if (segmentAiPhotoPromptHighlightTimerRef.current) {
      window.clearTimeout(segmentAiPhotoPromptHighlightTimerRef.current);
      segmentAiPhotoPromptHighlightTimerRef.current = null;
    }
    setIsSegmentAiPhotoModalOpen(false);
    setIsSegmentAiPhotoModalVisible(false);
    setSegmentAiPhotoModalSegmentIndex(null);
    setSegmentAiPhotoModalPrompt("");
    setSegmentImageEditModalPrompt("");
    setSegmentAiVideoModalPrompt("");
    setSegmentAiPhotoModalTab("ai_photo");
    setIsSegmentAiPhotoPromptImproving(false);
    setIsSegmentAiPhotoPromptImproved(false);
    setIsSegmentAiPhotoPromptHighlighted(false);
  }, []);

  const closeSegmentAiPhotoModal = useCallback((options?: { immediate?: boolean }) => {
    if (segmentAiPhotoPromptHighlightTimerRef.current) {
      window.clearTimeout(segmentAiPhotoPromptHighlightTimerRef.current);
      segmentAiPhotoPromptHighlightTimerRef.current = null;
    }

    if (options?.immediate || !isSegmentAiPhotoModalVisible) {
      resetSegmentAiPhotoModalState();
      return;
    }

    if (segmentAiPhotoModalCloseTimerRef.current) {
      window.clearTimeout(segmentAiPhotoModalCloseTimerRef.current);
    }

    setIsSegmentAiPhotoModalVisible(false);
    segmentAiPhotoModalCloseTimerRef.current = window.setTimeout(() => {
      resetSegmentAiPhotoModalState();
    }, SEGMENT_AI_PHOTO_MODAL_EXIT_DURATION_MS);
  }, [isSegmentAiPhotoModalVisible, resetSegmentAiPhotoModalState]);

  const handleSegmentAiPhotoModalPaidAction = (
    action: (snapshot: {
      aiPhotoPrompt: string;
      aiVideoPrompt: string;
      imageEditPrompt: string;
      segmentIndex: number | null;
      tab: WorkspaceSegmentVisualModalTab;
    }) => Promise<void>,
  ) => {
    const snapshot = {
      aiPhotoPrompt: segmentAiPhotoModalPrompt,
      aiVideoPrompt: segmentAiVideoModalPrompt,
      imageEditPrompt: segmentImageEditModalPrompt,
      segmentIndex: segmentAiPhotoModalSegment?.index ?? null,
      tab: segmentAiPhotoModalTab,
    };
    flushSync(() => {
      closeSegmentAiPhotoModal();
    });
    void action(snapshot);
  };

  const closeProjectDeleteModal = () => {
    if (isProjectDeleteSubmitting) {
      return;
    }

    setProjectPendingDelete(null);
    setProjectPendingDeleteProjects([]);
  };

  const closeInsufficientCreditsModal = () => {
    setInsufficientCreditsContext(null);
  };

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.body.classList.toggle("modal-open", isAnyWorkspaceModalOpen);

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [isAnyWorkspaceModalOpen]);

  const isSegmentEditorPageActive = activeTab === "studio" && studioView === "create" && createMode === "segment-editor";

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.body.classList.toggle("segment-editor-open", isSegmentEditorPageActive);

    return () => {
      document.body.classList.remove("segment-editor-open");
    };
  }, [isSegmentEditorPageActive]);

  useEffect(() => {
    if (!isAnyWorkspaceModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (insufficientCreditsContext) {
          closeInsufficientCreditsModal();
          return;
        }
        if (projectPendingDelete) {
          closeProjectDeleteModal();
          return;
        }
        if (isLocalExampleModalOpen) {
          closeLocalExampleModal();
          return;
        }
        if (isSegmentAiPhotoModalOpen) {
          closeSegmentAiPhotoModal();
          return;
        }
        if (isPublishModalOpen) {
          closePublishModal();
          return;
        }
        closePreviewModals();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    insufficientCreditsContext,
    isAnyWorkspaceModalOpen,
    isLocalExampleModalOpen,
    isPublishModalOpen,
    isSegmentAiPhotoModalOpen,
    projectPendingDelete,
    isProjectDeleteSubmitting,
  ]);

  useEffect(() => {
    if (activeTab !== "studio" && isAnyWorkspaceModalOpen) {
      closeInsufficientCreditsModal();
      setProjectPendingDelete(null);
      setProjectPendingDeleteProjects([]);
      closeLocalExampleModal();
      closeSegmentAiPhotoModal();
      closePublishModal();
      closePreviewModals();
    }
  }, [activeTab, isAnyWorkspaceModalOpen]);

  useEffect(() => {
    setWorkspaceProfile((current) => {
      if (areWorkspaceProfilesEqual(current, initialProfile)) {
        return current;
      }

      return initialProfile;
    });
  }, [initialProfile]);

  const applyWorkspaceProfile = (nextProfile: WorkspaceProfile | null) => {
    setWorkspaceProfile((current) => {
      if (areWorkspaceProfilesEqual(current, nextProfile)) {
        return current;
      }

      return nextProfile;
    });

    if (!areWorkspaceProfilesEqual(workspaceProfile, nextProfile)) {
      onProfileChange?.(nextProfile);
    }
  };

  const openInsufficientCreditsModal = useCallback(
    (action: StudioCreditAction, requiredCredits: number) => {
      setInsufficientCreditsContext({
        action,
        balance: normalizeWorkspaceBalance(workspaceProfile?.balance),
        plan: normalizeWorkspacePlan(workspaceProfile?.plan),
        requiredCredits,
      });
    },
    [workspaceProfile],
  );

  useEffect(() => {
    if (!insufficientCreditsContext) {
      return;
    }

    const nextBalance = normalizeWorkspaceBalance(workspaceProfile?.balance);
    const nextPlan = normalizeWorkspacePlan(workspaceProfile?.plan);

    if (nextBalance !== null && nextBalance >= insufficientCreditsContext.requiredCredits) {
      setInsufficientCreditsContext(null);
      return;
    }

    if (nextBalance !== insufficientCreditsContext.balance || nextPlan !== insufficientCreditsContext.plan) {
      setInsufficientCreditsContext((current) =>
        current
          ? {
              ...current,
              balance: nextBalance,
              plan: nextPlan,
            }
          : current,
      );
    }
  }, [insufficientCreditsContext, workspaceProfile]);

  useEffect(() => {
    setProjects([]);
    setProjectsError(null);
    setProjectDeleteError(null);
    setProjectPendingDelete(null);
    setProjectPendingDeleteProjects([]);
    setIsProjectDeleteSubmitting(false);
    pendingProjectDeleteIdsRef.current.clear();
    setHasLoadedProjects(false);
    setStoredSegmentEditorDrafts(readStoredWorkspaceSegmentEditorDrafts(session.email));
    setGeneratedMediaLibraryEntries(readStoredGeneratedMediaLibraryEntries(session.email));
    setMediaLibraryItems([]);
    setMediaLibraryNextCursor(null);
    setMediaLibraryTotal(null);
    setLoadedMediaLibraryFingerprint(null);
    setLoadedMediaLibraryReloadToken(-1);
    setMediaLibraryError(null);
    setIsMediaLibraryLoading(false);
    setIsMediaLibraryLoadingMore(false);
    setMediaLibraryReloadToken(0);
    setContentPlans([]);
    setContentPlansError(null);
    setHasLoadedContentPlans(false);
    setIsContentPlansLoading(false);
    setIsContentPlanGenerating(false);
    setContentPlanDeletingPlanId(null);
    setContentPlanDeletingIdeaId(null);
    setContentPlanUpdatingIdeaId(null);
    setActiveContentPlanId(null);
    setExpandedContentPlanUsedIdeasPlanId(null);
    setSelectedContentPlanIdeaId(null);
    setComposerSourceIdea(null);
    setContentPlanQueryInput("");
    setHasEditedContentPlanQueryInput(false);
    setIsContentPlanVisible(readStudioContentPlanVisibility(session.email));
    setActiveProjectPreviewId(null);
    setFailedStudioVideoUrls([]);
    setDismissedStudioPreviewKey(readDismissedStudioPreviewKey(session.email));
    setHiddenMediaLibraryItemKeys(readHiddenMediaLibraryItemKeys(session.email));
    setIsWorkspaceBootstrapPending(true);
    setIsPublishModalOpen(false);
    setPublishBootstrap(null);
    setPublishJobStatus(null);
    setPublishBootstrapError(null);
    setPublishError(null);
    setPublishTargetVideoProjectId(null);
    setPublishTargetTitle("");
    setSelectedVideoMode("standard");
    setSelectedCustomVideo(null);
    setVideoSelectionError(null);
    setIsPreparingCustomVideo(false);
    setSelectedMusicType("ai");
    setSelectedCustomMusic(null);
    setMusicSelectionError(null);
    setIsPreparingCustomMusic(false);
    setCreateMode("default");
    setSegmentEditorLoadedSession(null);
    setSegmentEditorDraft(null);
    setSegmentEditorAppliedSession(null);
    clearDetachedSegmentEditorDraft();
    setSegmentEditorError(null);
    setSegmentEditorVideoError(null);
    closeSegmentAiPhotoModal({ immediate: true });
    segmentAiPhotoRunRef.current += 1;
    setIsSegmentEditorGeneratingAiPhoto(false);
    setSegmentEditorGeneratingAiPhotoSegmentIndex(null);
    segmentImageUpscaleRunRef.current += 1;
    setIsSegmentEditorUpscalingImage(false);
    setSegmentEditorUpscalingImageSegmentIndex(null);
    setIsSegmentEditorLoading(false);
    setIsSegmentEditorPreparingCustomVideo(false);
    setSegmentEditorPreviewTimes({});
    setQueuedSegmentEditorPlaybackIndex(null);
    setSegmentEditorPanelHeightLock(null);
    setActiveSegmentIndex(0);
  }, [session.email]);

  useEffect(() => {
    if (activeTab !== "studio" || studioView !== "create" || createMode === "segment-editor") {
      return;
    }

    if (hasEditedContentPlanQueryInput) {
      return;
    }

    const normalizedTopic = topicInput.trim();
    if (!normalizedTopic) {
      return;
    }

    setContentPlanQueryInput((current) => (current.trim() ? current : normalizedTopic));
  }, [activeTab, createMode, hasEditedContentPlanQueryInput, studioView, topicInput]);

  useEffect(() => {
    if (contentPlans.length === 0) {
      setActiveContentPlanId((current) => (current === null ? current : null));
      return;
    }

    setActiveContentPlanId((current) =>
      current === null ? null : current && contentPlans.some((plan) => plan.id === current) ? current : contentPlans[0]?.id ?? null,
    );
  }, [contentPlans]);

  useEffect(() => {
    if (!composerSourceIdea) {
      return;
    }

    if (isWorkspaceContentPlanSourceIdeaSynchronized(topicInput, composerSourceIdea)) {
      return;
    }

    setComposerSourceIdea(null);
    setSelectedContentPlanIdeaId((current) => (current === composerSourceIdea.ideaId ? null : current));
  }, [composerSourceIdea, topicInput]);

  useEffect(() => {
    if (activeTab === "studio" && studioView === "create") {
      return;
    }

    if (activeTab === "studio") {
      cancelPendingSegmentEditorLoad();
      setSegmentEditorVideoError(null);
      closeSegmentAiPhotoModal();
      setPlayingSegmentEditorPreviewIndex(null);
      setSegmentEditorPreviewTimes({});
      setQueuedSegmentEditorPlaybackIndex(null);
      setSegmentEditorPanelHeightLock(null);
      return;
    }

    cancelPendingSegmentEditorLoad();
    stashCurrentSegmentEditorDraft();
    setCreateMode("default");
    setSegmentEditorDraft(null);
    setSegmentEditorVideoError(null);
    closeSegmentAiPhotoModal({ immediate: true });
    segmentAiPhotoRunRef.current += 1;
    segmentImageUpscaleRunRef.current += 1;
    setIsSegmentEditorGeneratingAiPhoto(false);
    setSegmentEditorGeneratingAiPhotoSegmentIndex(null);
    setIsSegmentEditorUpscalingImage(false);
    setSegmentEditorUpscalingImageSegmentIndex(null);
    setSegmentEditorPreviewTimes({});
    setQueuedSegmentEditorPlaybackIndex(null);
    setSegmentEditorPanelHeightLock(null);
    setActiveSegmentIndex(0);
  }, [activeTab, studioView]);

  useEffect(() => {
    segmentEditorDraftRef.current = segmentEditorDraft;
  }, [segmentEditorDraft]);

  useEffect(() => {
    if (!segmentEditorDraft?.segments.length) {
      setActiveSegmentIndex(0);
      return;
    }

    setActiveSegmentIndex((current) => Math.min(current, segmentEditorDraft.segments.length - 1));
  }, [segmentEditorDraft]);

  useEffect(() => {
    if (segmentEditorAppliedSession) {
      return;
    }

    setSegmentEditorDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      return normalizeLegacyWorkspaceSegmentEditorDraftSession(currentDraft);
    });
  }, [segmentEditorAppliedSession]);

  useLayoutEffect(() => {
    if (!segmentEditorLoadedSession) {
      return;
    }

    writeStoredWorkspaceSegmentEditorSession(session.email, segmentEditorLoadedSession);
  }, [segmentEditorLoadedSession, session.email]);

  useLayoutEffect(() => {
    if (!segmentEditorDraft) {
      return;
    }

    const normalizedDraft = normalizeStoredWorkspaceSegmentEditorDraftSession(segmentEditorDraft);
    writeStoredWorkspaceSegmentEditorDraft(session.email, normalizedDraft);
    setStoredSegmentEditorDrafts((currentDrafts) => {
      const nextDrafts = currentDrafts.filter((draft) => draft.projectId !== normalizedDraft.projectId);
      return [normalizedDraft, ...nextDrafts];
    });
  }, [segmentEditorDraft, session.email]);

  useEffect(() => {
    persistGeneratedMediaLibraryEntries(session.email, generatedMediaLibraryEntries);
  }, [generatedMediaLibraryEntries, session.email]);

  useEffect(() => {
    if (!generatedMediaLibraryEntries.length) {
      return;
    }

    setSegmentEditorDraft((currentDraft) =>
      currentDraft ? hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary(currentDraft, generatedMediaLibraryEntries) : currentDraft,
    );
  }, [generatedMediaLibraryEntries]);

  useEffect(() => {
    segmentCarouselWheelDeltaRef.current = 0;
    segmentCarouselLastWheelStepAtRef.current = 0;
    if (segmentCarouselWheelResetTimerRef.current) {
      window.clearTimeout(segmentCarouselWheelResetTimerRef.current);
      segmentCarouselWheelResetTimerRef.current = null;
    }
  }, [createMode, segmentEditorDraft]);

  useEffect(() => {
    segmentThumbPendingDragRef.current = null;
    segmentThumbSuppressClickUntilRef.current = 0;
    segmentThumbDragStateRef.current = null;
    setSegmentThumbDragState(null);
    setSegmentThumbDropInsertIndex(null);
  }, [createMode, segmentEditorDraft]);

  useEffect(() => {
    if (!segmentThumbDragState || typeof document === "undefined") {
      return undefined;
    }

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [segmentThumbDragState]);

  useEffect(() => {
    if (createMode !== "segment-editor" || !segmentEditorDraft || segmentEditorDraft.segments.length <= 1) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextInputTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        activateSegmentEditorSegmentByArrayIndex(activeSegmentIndex - 1);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        activateSegmentEditorSegmentByArrayIndex(activeSegmentIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSegmentIndex, createMode, segmentEditorDraft]);

  const handleSegmentCarouselWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!segmentEditorDraft || segmentEditorDraft.segments.length <= 1) {
      return;
    }

    const horizontalDelta =
      Math.abs(event.deltaX) >= Math.abs(event.deltaY)
        ? event.deltaX
        : event.shiftKey
          ? event.deltaY
          : 0;

    if (Math.abs(horizontalDelta) < 6) {
      return;
    }

    event.preventDefault();
    segmentCarouselWheelDeltaRef.current += horizontalDelta;

    if (segmentCarouselWheelResetTimerRef.current) {
      window.clearTimeout(segmentCarouselWheelResetTimerRef.current);
    }

    segmentCarouselWheelResetTimerRef.current = window.setTimeout(() => {
      segmentCarouselWheelDeltaRef.current = 0;
      segmentCarouselWheelResetTimerRef.current = null;
    }, 160);

    if (Math.abs(segmentCarouselWheelDeltaRef.current) < 34) {
      return;
    }

    const now = window.performance.now();
    if (now - segmentCarouselLastWheelStepAtRef.current < 140) {
      return;
    }

    const direction = segmentCarouselWheelDeltaRef.current > 0 ? 1 : -1;
    segmentCarouselLastWheelStepAtRef.current = now;
    segmentCarouselWheelDeltaRef.current = 0;
    setSegmentCarouselDragProgress(0);
    setIsSegmentCarouselDragging(false);

    activateSegmentEditorSegmentByArrayIndex(activeSegmentIndex + direction);
  };

  const isSegmentCarouselClickSuppressed = () => window.performance.now() < segmentCarouselSuppressClickUntilRef.current;

  const handleSegmentCarouselPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!segmentEditorDraft || segmentEditorDraft.segments.length <= 1) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    if (segmentCarouselReleaseTimerRef.current) {
      window.clearTimeout(segmentCarouselReleaseTimerRef.current);
      segmentCarouselReleaseTimerRef.current = null;
    }
    setSegmentCarouselDragProgress(0);
    setIsSegmentCarouselDragging(false);

    const target = event.target as HTMLElement | null;
    const interactiveControl = target?.closest("button, input, textarea, label, a") ?? null;
    if (
      target?.closest(".studio-segment-editor__arrow") ||
      (interactiveControl && !interactiveControl.classList.contains("studio-segment-editor__card-hitbox"))
    ) {
      return;
    }

    const sideHitbox = target?.closest<HTMLButtonElement>(".studio-segment-editor__card-hitbox--side") ?? null;
    const sideSegmentArrayIndex = Number(sideHitbox?.dataset.segmentArrayIndex);
    const sideSegmentPlaybackIndex = Number(sideHitbox?.dataset.segmentPlaybackIndex);
    const sidePreviewKind = sideHitbox?.dataset.previewKind;
    const clickTarget: NonNullable<(typeof segmentCarouselDragStateRef.current)>["clickTarget"] =
      sideHitbox &&
      Number.isInteger(sideSegmentArrayIndex) &&
      Number.isInteger(sideSegmentPlaybackIndex) &&
      (sidePreviewKind === "image" || sidePreviewKind === "video")
        ? {
            previewKind: sidePreviewKind,
            segmentArrayIndex: sideSegmentArrayIndex,
            segmentPlaybackIndex: sideSegmentPlaybackIndex,
          }
        : undefined;

    segmentCarouselDragStateRef.current = {
      clickTarget,
      dragDetected: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture errors for unsupported pointers.
    }
  };

  const handleSegmentCarouselPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = segmentCarouselDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (!dragState.dragDetected) {
      if (Math.abs(deltaX) < 14 || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }

      dragState.dragDetected = true;
      setIsSegmentCarouselDragging(true);
      segmentCarouselSuppressClickUntilRef.current = window.performance.now() + 320;
    }

    const carouselWidth = Math.max(1, event.currentTarget.clientWidth);
    const dragRange = Math.max(120, carouselWidth * 0.46);
    setSegmentCarouselDragProgress(Math.max(-1, Math.min(1, deltaX / dragRange)));
    event.preventDefault();
  };

  const finishSegmentCarouselPointerDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    options?: { cancelled?: boolean },
  ) => {
    const dragState = segmentCarouselDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const targetDirection = deltaX < 0 ? 1 : -1;
    const targetSegmentIndex = activeSegmentIndex + targetDirection;
    const shouldNavigate =
      !options?.cancelled &&
      dragState.dragDetected &&
      Math.abs(deltaX) >= 56 &&
      Boolean(segmentEditorDraft) &&
      targetSegmentIndex >= 0 &&
      targetSegmentIndex < (segmentEditorDraft?.segments.length ?? 0);

    if (dragState.dragDetected) {
      event.preventDefault();
      segmentCarouselSuppressClickUntilRef.current = window.performance.now() + 320;
    }

    if (shouldNavigate && segmentEditorDraft) {
      const nextProgress = deltaX < 0 ? -1 : 1;
      setQueuedSegmentEditorPlaybackIndex(null);
      setIsSegmentCarouselDragging(false);
      setSegmentCarouselDragProgress(nextProgress);
      if (segmentCarouselReleaseTimerRef.current) {
        window.clearTimeout(segmentCarouselReleaseTimerRef.current);
      }
      segmentCarouselReleaseTimerRef.current = window.setTimeout(() => {
        segmentCarouselReleaseTimerRef.current = null;
        activateSegmentEditorSegmentByArrayIndex(targetSegmentIndex);
        setSegmentCarouselDragProgress(0);
      }, 150);
    } else if (!options?.cancelled && !dragState.dragDetected && dragState.clickTarget) {
      event.preventDefault();
      segmentCarouselSuppressClickUntilRef.current = window.performance.now() + 180;
      setIsSegmentCarouselDragging(false);
      setSegmentCarouselDragProgress(0);
      void handleSegmentEditorCardClick(
        dragState.clickTarget.segmentArrayIndex,
        dragState.clickTarget.segmentPlaybackIndex,
        dragState.clickTarget.previewKind,
      );
    } else {
      setIsSegmentCarouselDragging(false);
      setSegmentCarouselDragProgress(0);
    }

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore capture errors for unsupported pointers.
    }

    segmentCarouselDragStateRef.current = null;
  };

  useEffect(() => {
    if (!generatedVideo?.id) return;
    setHasLoadedProjects(false);
  }, [generatedVideo?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadLocalExamplesAvailability = async () => {
      try {
        const response = await fetch("/api/examples/local");
        const payload = (await response.json().catch(() => null)) as WorkspaceLocalExamplesResponse | null;

        if (cancelled) {
          return;
        }

        setCanManageLocalExamples(Boolean(payload?.data?.enabled && payload?.data?.canManage && response.ok));
      } catch {
        if (!cancelled) {
          setCanManageLocalExamples(false);
        }
      }
    };

    void loadLocalExamplesAvailability();

    return () => {
      cancelled = true;
    };
  }, [session.email]);

  useEffect(() => {
    previewVideoRef.current?.pause();
  }, [generatedVideo?.id]);

  useEffect(() => {
    setIsLocalExampleModalOpen(false);
    setIsSavingLocalExample(false);
    setLocalExampleSaveError(null);
    setLocalExampleSource(null);
  }, [generatedVideo?.id]);

  useEffect(() => {
    if (!projects.length) {
      setActiveProjectPreviewId(null);
      setProjectPreviewModal((current) => (current ? null : current));
      return;
    }

    setActiveProjectPreviewId((current) => {
      if (!current) return current;
      return projects.some((project) => project.id === current) ? current : null;
    });
  }, [projects]);

  useEffect(() => {
    setProjectPreviewModal((current) => {
      if (!current) return current;
      return projects.some((project) => project.id === current.id) ? current : null;
    });
  }, [projects]);

  useEffect(() => {
    if (isWorkspaceBootstrapPending || isGenerating) {
      return;
    }

    if (generatedVideo?.videoUrl && !isStudioVideoMarkedFailed(generatedVideo.videoUrl)) {
      return;
    }

    const fallbackProject = projects.find(
      (project) => project.status === "ready" && Boolean(project.videoUrl) && !isStudioVideoMarkedFailed(project.videoUrl),
    );
    if (!fallbackProject) {
      if (generatedVideo?.videoUrl && isStudioVideoMarkedFailed(generatedVideo.videoUrl)) {
        setGeneratedVideo(null);
      }
      return;
    }

    const fallbackGeneration = buildStudioGenerationFromProject(fallbackProject);
    if (!fallbackGeneration) {
      return;
    }

    setGeneratedVideo(fallbackGeneration);
  }, [failedStudioVideoUrls, generatedVideo?.videoUrl, isGenerating, isWorkspaceBootstrapPending, projects]);

  useEffect(() => {
    if (generatedVideo && generateError === "Failed to fetch generation status.") {
      setGenerateError(null);
    }
  }, [generateError, generatedVideo]);

  useEffect(() => {
    const nextPreviewVideoUrl = String(generatedVideo?.videoUrl ?? "").trim() || null;
    const matchingProjectPosterUrl =
      generatedVideo?.adId && Number.isFinite(generatedVideo.adId)
        ? projects.find((project) => project.adId === generatedVideo.adId)?.posterUrl ?? null
        : null;

    if (!nextPreviewVideoUrl) {
      setStudioPreviewPosterUrl(null);
      return;
    }

    if (matchingProjectPosterUrl) {
      setStudioPreviewPosterUrl(matchingProjectPosterUrl);
      return;
    }

    const cachedPoster = getProjectPosterCacheValue(nextPreviewVideoUrl);
    if (cachedPoster) {
      setStudioPreviewPosterUrl(cachedPoster);
      return;
    }

    if (!canCapturePosterInBrowser(nextPreviewVideoUrl)) {
      setStudioPreviewPosterUrl(null);
      return;
    }

    let cancelled = false;
    setStudioPreviewPosterUrl(null);

    void captureProjectPosterOnce(nextPreviewVideoUrl)
      .then((capturedPosterUrl) => {
        if (cancelled) return;
        setStudioPreviewPosterUrl(capturedPosterUrl);
      })
      .catch(() => {
        if (cancelled) return;
        setStudioPreviewPosterUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [generatedVideo?.adId, generatedVideo?.videoUrl, projects]);

  useEffect(() => {
    if (activeTab !== "studio" || studioView !== "projects") {
      setActiveProjectPreviewId(null);
    }
  }, [activeTab, studioView]);

  useEffect(() => {
    if (!isAnyPreviewModalOpen) {
      return;
    }

    setActiveProjectPreviewId(null);
  }, [isAnyPreviewModalOpen]);

  const shouldLoadProjects = !hasLoadedProjects;
  const mediaLibraryProjects = useMemo(
    () =>
      projects.filter(
        (project): project is WorkspaceProject & { adId: number } =>
          project.status === "ready" && typeof project.adId === "number" && project.adId > 0,
      ),
    [projects],
  );
  const mediaLibraryProjectsFingerprint = useMemo(
    () =>
      mediaLibraryProjects
        .map(
          (project) =>
            `${project.adId}:${project.updatedAt}:${project.generatedAt ?? ""}:${project.createdAt}:${project.videoUrl ?? ""}`,
        )
        .join("|"),
    [mediaLibraryProjects],
  );
  const isStudioVideoMarkedFailed = (value: string | null | undefined) => {
    const normalized = String(value ?? "").trim();
    return normalized ? failedStudioVideoUrls.includes(normalized) : false;
  };

  const markStudioVideoAsFailed = (value: string | null | undefined) => {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
      return;
    }

    setFailedStudioVideoUrls((current) => (current.includes(normalized) ? current : [...current, normalized]));
  };

  useEffect(() => {
    if (!shouldLoadProjects) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort("projects-timeout"), PROJECTS_REQUEST_TIMEOUT_MS);

    const loadProjects = async () => {
      setIsProjectsLoading(true);
      setProjectsError(null);
      setProjectDeleteError(null);

      try {
        const response = await fetch("/api/workspace/projects", {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as WorkspaceProjectsResponse | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error ?? "Failed to load projects.");
        }

        setProjects(payload.data.projects);
        setHasLoadedProjects(true);
      } catch (error) {
        if (controller.signal.aborted) {
          if (controller.signal.reason === "projects-timeout") {
            setProjectsError("Сервер слишком долго отвечает. Попробуйте обновить.");
            setHasLoadedProjects(true);
          }

          return;
        }

        setProjectsError(error instanceof Error ? error.message : "Failed to load projects.");
        setHasLoadedProjects(true);
      } finally {
        window.clearTimeout(timeoutId);
        setIsProjectsLoading(false);
      }
    };

    void loadProjects();

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [shouldLoadProjects]);

  const shouldLoadContentPlans = activeTab === "studio" && studioView === "create" && createMode !== "segment-editor";

  useEffect(() => {
    if (!shouldLoadContentPlans) {
      setIsContentPlansLoading(false);
      return;
    }

    if (hasLoadedContentPlans) {
      return;
    }

    let cancelled = false;
    setIsContentPlansLoading(true);
    setContentPlansError(null);

    const loadContentPlans = async () => {
      try {
        const response = await fetch("/api/workspace/content-plans");
        const payload = (await response.json().catch(() => null)) as WorkspaceContentPlansResponse | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error ?? "Не удалось загрузить контент-планы.");
        }

        if (cancelled) {
          return;
        }

        setContentPlans(payload.data.plans);
        setActiveContentPlanId((current) =>
          current === null
            ? null
            : current && payload.data?.plans.some((plan) => plan.id === current)
            ? current
            : payload.data?.plans[0]?.id ?? null,
        );
        setHasLoadedContentPlans(true);
        setIsContentPlansLoading(false);
      } catch (error) {
        if (cancelled || isAbortLikeError(error)) {
          return;
        }

        setContentPlansError(error instanceof Error ? error.message : "Не удалось загрузить контент-планы.");
        setHasLoadedContentPlans(true);
        setIsContentPlansLoading(false);
      }
    };

    void loadContentPlans();

    return () => {
      cancelled = true;
    };
  }, [hasLoadedContentPlans, shouldLoadContentPlans]);

  const isMediaLibraryStudioView = shouldLoadWorkspaceMediaLibraryView(activeTab, studioView);
  const shouldLoadSegmentModalMediaLibrary =
    (isSegmentAiPhotoModalOpen || (activeTab === "studio" && studioView === "create" && createMode === "segment-editor")) &&
    segmentAiPhotoModalTab === "library";
  const shouldWarmStudioMediaLibrary = activeTab === "studio";
  const shouldLoadMediaLibrary = shouldWarmStudioMediaLibrary || shouldLoadSegmentModalMediaLibrary;

  useEffect(() => {
    if (!shouldLoadMediaLibrary) {
      setIsMediaLibraryLoading(false);
      setIsMediaLibraryLoadingMore(false);
      return;
    }

    if (!hasLoadedProjects || isProjectsLoading) {
      const hasPersistedSnapshot = loadedMediaLibraryFingerprint !== null;
      setIsMediaLibraryLoading(!hasPersistedSnapshot);
      setIsMediaLibraryLoadingMore(false);
      if (!hasPersistedSnapshot) {
        setMediaLibraryError(null);
      }
      return;
    }

    const shouldBypassMediaLibraryCache = mediaLibraryReloadToken !== loadedMediaLibraryReloadToken;
    const shouldFetchMediaLibrary =
      shouldBypassMediaLibraryCache || loadedMediaLibraryFingerprint !== mediaLibraryProjectsFingerprint;

    if (!shouldFetchMediaLibrary) {
      setIsMediaLibraryLoading(false);
      setIsMediaLibraryLoadingMore(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort("media-library-timeout"), MEDIA_LIBRARY_REQUEST_TIMEOUT_MS);
    setIsMediaLibraryLoading(true);
    setIsMediaLibraryLoadingMore(false);
    setMediaLibraryError(null);

    const loadMediaLibrary = async () => {
      try {
        const response = await fetch(
          buildWorkspaceMediaLibraryRequestPath({
            limit: MEDIA_LIBRARY_PAGE_SIZE,
            reload: shouldBypassMediaLibraryCache,
          }),
          {
          signal: controller.signal,
          },
        );
        const payload = (await response.json().catch(() => null)) as WorkspaceMediaLibraryResponse | null;
        const payloadData = payload?.data;

        if (!response.ok || !payloadData) {
          throw new Error(payload?.error ?? "Не удалось загрузить медиатеку.");
        }

        if (cancelled) {
          return;
        }

        setMediaLibraryItems(mergeWorkspaceMediaLibraryPageItems([], payloadData.items));
        setMediaLibraryNextCursor(payloadData.nextCursor);
        setMediaLibraryTotal(payloadData.total);
        setLoadedMediaLibraryFingerprint(mediaLibraryProjectsFingerprint);
        setLoadedMediaLibraryReloadToken(mediaLibraryReloadToken);
        setMediaLibraryError(null);
        setIsMediaLibraryLoading(false);
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (controller.signal.aborted) {
          if (controller.signal.reason === "media-library-timeout") {
            setMediaLibraryError(mediaLibraryItems.length > 0 ? null : "Сервер слишком долго отвечает. Попробуйте обновить.");
            setIsMediaLibraryLoading(false);
          }
          return;
        }

        if (isAbortLikeError(error)) {
          return;
        }

        setMediaLibraryError(mediaLibraryItems.length > 0 ? null : error instanceof Error ? error.message : "Не удалось загрузить медиатеку.");
        setIsMediaLibraryLoading(false);
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    void loadMediaLibrary();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    hasLoadedProjects,
    isProjectsLoading,
    loadedMediaLibraryFingerprint,
    loadedMediaLibraryReloadToken,
    mediaLibraryItems.length,
    mediaLibraryProjects,
    mediaLibraryProjectsFingerprint,
    mediaLibraryReloadToken,
    shouldLoadMediaLibrary,
  ]);

  const handleLoadMoreMediaLibrary = useCallback(async () => {
    const requestCursor = mediaLibraryNextCursor;
    if (!requestCursor || isMediaLibraryLoading || mediaLibraryLoadMoreCursorRef.current === requestCursor) {
      return;
    }

    mediaLibraryLoadMoreCursorRef.current = requestCursor;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort("media-library-timeout"), MEDIA_LIBRARY_REQUEST_TIMEOUT_MS);
    setIsMediaLibraryLoading(true);
    setIsMediaLibraryLoadingMore(true);
    setMediaLibraryError(null);

    try {
      const response = await fetch(buildWorkspaceMediaLibraryRequestPath({
        cursor: requestCursor,
        limit: MEDIA_LIBRARY_PAGE_SIZE,
      }), {
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as WorkspaceMediaLibraryResponse | null;
      const payloadData = payload?.data;

      if (!response.ok || !payloadData) {
        throw new Error(payload?.error ?? "Не удалось загрузить медиатеку.");
      }

      setMediaLibraryItems((current) => mergeWorkspaceMediaLibraryPageItems(current, payloadData.items));
      setMediaLibraryNextCursor(payloadData.nextCursor);
      setMediaLibraryTotal(payloadData.total);
    } catch (error) {
      if (controller.signal.aborted || isAbortLikeError(error)) {
        return;
      }

      setMediaLibraryError(error instanceof Error ? error.message : "Не удалось загрузить медиатеку.");
    } finally {
      if (mediaLibraryLoadMoreCursorRef.current === requestCursor) {
        mediaLibraryLoadMoreCursorRef.current = null;
      }
      window.clearTimeout(timeoutId);
      setIsMediaLibraryLoading(false);
      setIsMediaLibraryLoadingMore(false);
    }
  }, [isMediaLibraryLoading, mediaLibraryNextCursor]);

  const maybeLoadMoreMediaLibrary = useCallback(() => {
    if (
      activeTab !== "studio" ||
      studioView !== "media" ||
      !mediaLibraryNextCursor ||
      isMediaLibraryLoading ||
      mediaLibraryError
    ) {
      return;
    }

    const root = mediaLibraryScrollRootRef.current;
    const sentinel = mediaLibraryLoadMoreSentinelRef.current;
    if (!root || !sentinel) {
      return;
    }

    const remainingRootScrollDistance = root.scrollHeight - root.scrollTop - root.clientHeight;
    if (remainingRootScrollDistance <= MEDIA_LIBRARY_LOAD_MORE_SCROLL_THRESHOLD_PX) {
      void handleLoadMoreMediaLibrary();
      return;
    }

    const pageScrollElement = document.scrollingElement ?? document.documentElement;
    const remainingPageScrollDistance = pageScrollElement.scrollHeight - window.scrollY - window.innerHeight;
    if (remainingPageScrollDistance <= MEDIA_LIBRARY_LOAD_MORE_SCROLL_THRESHOLD_PX) {
      void handleLoadMoreMediaLibrary();
      return;
    }

    const sentinelRect = sentinel.getBoundingClientRect();
    if (sentinelRect.top - window.innerHeight <= MEDIA_LIBRARY_LOAD_MORE_SCROLL_THRESHOLD_PX) {
      void handleLoadMoreMediaLibrary();
    }
  }, [
    activeTab,
    handleLoadMoreMediaLibrary,
    isMediaLibraryLoading,
    mediaLibraryError,
    mediaLibraryNextCursor,
    studioView,
  ]);

  useEffect(() => {
    if (
      activeTab !== "studio" ||
      studioView !== "media" ||
      !mediaLibraryNextCursor ||
      isMediaLibraryLoading ||
      mediaLibraryError
    ) {
      return;
    }

    const root = mediaLibraryScrollRootRef.current;
    if (!root) {
      return;
    }

    let frameId: number | null = null;
    const scheduleCheck = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        maybeLoadMoreMediaLibrary();
      });
    };

    scheduleCheck();
    root.addEventListener("scroll", scheduleCheck, { passive: true });
    window.addEventListener("scroll", scheduleCheck, { passive: true });
    window.addEventListener("resize", scheduleCheck);
    document.addEventListener("scroll", scheduleCheck, { capture: true, passive: true });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      root.removeEventListener("scroll", scheduleCheck);
      window.removeEventListener("scroll", scheduleCheck);
      window.removeEventListener("resize", scheduleCheck);
      document.removeEventListener("scroll", scheduleCheck, { capture: true });
    };
  }, [
    activeTab,
    hiddenMediaLibraryItemKeys.length,
    isMediaLibraryLoading,
    mediaLibraryError,
    mediaLibraryItems.length,
    mediaLibraryNextCursor,
    maybeLoadMoreMediaLibrary,
    studioView,
  ]);

  useEffect(() => {
    if (
      activeTab !== "studio" ||
      studioView !== "media" ||
      !mediaLibraryNextCursor ||
      isMediaLibraryLoading ||
      mediaLibraryError
    ) {
      return;
    }

    const root = mediaLibraryScrollRootRef.current;
    const sentinel = mediaLibraryLoadMoreSentinelRef.current;
    if (!root || !sentinel || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void handleLoadMoreMediaLibrary();
        }
      },
      {
        root,
        rootMargin: "480px 0px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [
    activeTab,
    handleLoadMoreMediaLibrary,
    isMediaLibraryLoading,
    mediaLibraryError,
    mediaLibraryNextCursor,
    studioView,
  ]);

  useEffect(() => {
    if (!shouldLoadSegmentModalMediaLibrary || !mediaLibraryNextCursor || isMediaLibraryLoading || mediaLibraryError) {
      return;
    }

    void handleLoadMoreMediaLibrary();
  }, [handleLoadMoreMediaLibrary, isMediaLibraryLoading, mediaLibraryError, mediaLibraryNextCursor, shouldLoadSegmentModalMediaLibrary]);

  const header = tabCopy[activeTab];
  const sectionTitleId = header.heading ? "account-shell-title" : undefined;
  const workspacePlan = normalizeWorkspacePlan(workspaceProfile?.plan);
  const workspacePlanLabel = workspacePlan ?? "…";
  const workspaceBalance = normalizeWorkspaceBalance(workspaceProfile?.balance);
  const workspaceCanPurchaseCreditPacks = canPurchaseAddonCredits(workspacePlan);
  const workspaceBillingDescription = workspaceCanPurchaseCreditPacks
    ? `На тарифе ${workspacePlanLabel} можно докупать кредиты пакетами.`
    : "Покупка дополнительных кредитов доступна только на тарифах PRO и ULTRA.";
  const workspaceCreditPackActionLabel = workspaceCanPurchaseCreditPacks
    ? "Открыть пакеты кредитов"
    : "Перейти на PRO или ULTRA";
  const workspaceCreditPackNote = workspaceCanPurchaseCreditPacks
    ? "Пакеты пополняют текущий баланс и не меняют сам тариф."
    : "Сначала нужен активный тариф PRO или ULTRA, после этого откроется докупка пакетов.";
  const studioCreateRequiredCredits = getRequiredCreditsForVideoMode(selectedVideoMode);
  const studioCreateCostLabel = `${studioCreateRequiredCredits} ⚡`;
  const generatedVideoTopic = generatedVideo?.prompt ?? "";
  const generatedVideoTitle = generatedVideo?.title ?? "";
  const generatedVideoDescription = generatedVideo?.description ?? "";
  const generatedVideoHashtags = generatedVideo?.hashtags ?? [];
  const normalizedGeneratedVideoPrompt = generatedVideoTopic.trim() || topicInput.trim();
  const normalizedGeneratedVideoTitle = generatedVideoTitle.trim() || normalizedGeneratedVideoPrompt || "Видео без названия";
  const hasGeneratedVideoTitle = Boolean(generatedVideoTitle);
  const generatedVideoModalTitle = hasGeneratedVideoTitle ? generatedVideoTitle : "Результат генерации";
  const isProjectPreviewModalOpen = Boolean(projectPreviewModal);
  const previewModalTitle = isProjectPreviewModalOpen
    ? projectPreviewModal?.title || "Без названия"
    : generatedVideoModalTitle;
  const previewModalTopic = isProjectPreviewModalOpen ? projectPreviewModal?.prompt ?? "" : generatedVideoTopic;
  const previewModalDescription = isProjectPreviewModalOpen
    ? projectPreviewModal?.description ?? ""
    : generatedVideoDescription;
  const openWorkspaceCreditPacks = () => {
    navigate(workspaceCanPurchaseCreditPacks ? "/pricing#addons" : "/pricing#plans");
  };
  const handleInsufficientCreditsAction = () => {
    const targetSection = getInsufficientCreditsPricingSection(insufficientCreditsContext?.plan ?? workspacePlan);
    closeInsufficientCreditsModal();
    writePricingEntryIntent({
      section: targetSection,
      source: "insufficient-credits",
    });
    navigate(`/pricing#${targetSection}`);
  };
  const previewModalHashtags = isProjectPreviewModalOpen ? projectPreviewModal?.hashtags ?? [] : generatedVideoHashtags;
  const generatedVideoPlaybackUrl = String(generatedVideo?.videoUrl ?? "").trim() || null;
  const generatedVideoDismissKey = getStudioPreviewDismissKey(generatedVideo);
  const isGeneratedVideoDismissed = Boolean(generatedVideoDismissKey) && dismissedStudioPreviewKey === generatedVideoDismissKey;
  const visibleGeneratedVideo = isGeneratedVideoDismissed ? null : generatedVideo;
  const visibleGeneratedVideoPlaybackUrl = isGeneratedVideoDismissed ? null : generatedVideoPlaybackUrl;
  const canSaveGeneratedVideoToLocalExamples = canManageLocalExamples && Boolean(generatedVideoPlaybackUrl);
  const selectedLocalExampleGoalOption =
    workspaceLocalExampleGoalOptions.find((option) => option.id === selectedLocalExampleGoal) ??
    workspaceLocalExampleGoalOptions[0];
  const isGeneratedVideoPlaybackBroken = isStudioVideoMarkedFailed(generatedVideo?.videoUrl);
  const previewModalPrimaryVideoUrl = isProjectPreviewModalOpen
    ? projectPreviewModal?.videoUrl ?? null
    : isPreviewModalOpen
      ? generatedVideo?.videoUrl ?? null
      : null;
  const previewModalFallbackVideoUrl = isProjectPreviewModalOpen
    ? projectPreviewModal?.videoFallbackUrl ?? null
    : isPreviewModalOpen
      ? generatedVideo?.videoFallbackUrl ?? null
      : null;
  const previewModalVideoUrl =
    previewModalUseFallbackSource && previewModalFallbackVideoUrl
      ? previewModalFallbackVideoUrl
      : previewModalPrimaryVideoUrl;
  const previewModalPublication = isProjectPreviewModalOpen
    ? projectPreviewModal?.youtubePublication ?? null
    : generatedVideo?.adId
      ? projects.find((project) => project.adId === generatedVideo.adId)?.youtubePublication ?? null
      : null;
  const previewModalUpdatedAt = isProjectPreviewModalOpen ? projectPreviewModal?.updatedAt ?? "" : "";
  const previewModalStatusLabel =
    previewModalPublication?.state === "published"
      ? "Shorts опубликован"
      : previewModalPublication?.state === "scheduled"
        ? "Публикация запланирована"
        : "Готово к публикации";
  const previewModalStatusTone =
    previewModalPublication?.state === "published"
      ? "published"
      : previewModalPublication?.state === "scheduled"
        ? "scheduled"
        : "ready";
  const previewModalStatusMeta =
    getYouTubePublicationMetaLabel(previewModalPublication) ||
    (isProjectPreviewModalOpen
      ? `Обновлено ${formatProjectDate(previewModalUpdatedAt)}`
      : "Готово к отправке в YouTube");
  const previewModalStatusLink = previewModalPublication?.link ?? null;
  const previewModalPublishTargetAdId = isProjectPreviewModalOpen ? projectPreviewModal?.adId ?? null : generatedVideo?.adId ?? null;
  const previewModalPlaybackToken = isProjectPreviewModalOpen
    ? projectPreviewModal?.updatedAt ?? projectPreviewModal?.generatedAt ?? projectPreviewModal?.createdAt ?? projectPreviewModal?.id
    : generatedVideo?.generatedAt ?? generatedVideo?.id;
  const previewModalSourceKey = previewModalUseFallbackSource && previewModalFallbackVideoUrl ? "fallback" : "primary";
  const previewModalVideoPlaybackUrl = appendUrlToken(
    previewModalVideoUrl,
    "playback",
    previewModalPlaybackToken,
  );
  const shouldPreferMutedModalFallback = true;
  const previewModalDownloadName = getVideoDownloadName(previewModalTitle);
  const projectPreviewModalPanelStyle = isProjectPreviewModalOpen
    ? ({
        "--studio-video-modal-aspect-ratio": String(projectPreviewModalAspectRatio ?? 9 / 16),
      } as CSSProperties)
    : undefined;
  const studioInlinePreviewDownloadName = getVideoDownloadName(generatedVideoModalTitle);
  const mediaLibraryPreviewModalSurface = mediaLibraryPreviewModal
    ? getWorkspaceMediaLibraryResolvedMediaSurface(mediaLibraryPreviewModal, "media-viewer")
    : null;
  const mediaLibraryPreviewModalPosterUrl = mediaLibraryPreviewModalSurface?.posterUrl ?? null;
  const mediaLibraryPreviewModalTitle = mediaLibraryPreviewModal
    ? getWorkspaceMediaLibraryItemKindLabel(mediaLibraryPreviewModal.kind, mediaLibraryPreviewModal.assetKind)
    : "";
  const formatSegmentVisualCreditsLabel = (credits: number) => `${credits} ⚡`;
  const renderSegmentPaidActionContent = (
    _actionLabel: string,
    credits: number,
    isBusy: boolean,
    _busyLabel: string,
  ) =>
    isBusy ? (
      <span className="studio-ai-photo-modal__action-spinner" aria-hidden="true"></span>
    ) : (
      <span className="studio-ai-photo-modal__action-cost" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{formatSegmentVisualCreditsLabel(credits)}</span>
      </span>
    );
  const hasPreviewModalDescription = Boolean(previewModalDescription);
  const hasPreviewModalHashtags = previewModalHashtags.length > 0;
  const selectedVoiceOptions = studioVoiceOptionsByLanguage[selectedLanguage];
  const resolvedSelectedVoiceId =
    selectedVoiceOptions.find((voice) => voice.id === selectedVoiceId)?.id ?? selectedVoiceOptions[0]?.id ?? "";
  const buildCurrentExamplePrefillSettings = (): ExamplePrefillStudioSettings => {
    const settings: ExamplePrefillStudioSettings = {
      language: selectedLanguage,
      subtitleColorId: selectedSubtitleColorId,
      subtitleEnabled: areSubtitlesEnabled,
      subtitleStyleId: selectedSubtitleStyleId,
      voiceEnabled: isVoiceoverEnabled,
      voiceId: resolvedSelectedVoiceId || undefined,
    };
    const normalizedBrandText = brandText.trim();

    if (selectedMusicType !== "custom") {
      settings.musicType = selectedMusicType;
    }

    if (selectedVideoMode !== "custom") {
      settings.videoMode = selectedVideoMode;
    }

    if (normalizedBrandText) {
      settings.brandText = normalizedBrandText.slice(0, STUDIO_BRAND_TEXT_MAX_CHARS);
    }

    return settings;
  };
  const applyExamplePrefillSettings = (settings: ExamplePrefillStudioSettings | null | undefined) => {
    if (!settings) {
      return;
    }

    const nextLanguage = settings.language === "ru" || settings.language === "en" ? settings.language : null;
    const effectiveLanguage = nextLanguage ?? selectedLanguage;
    const nextVoiceOptions = studioVoiceOptionsByLanguage[effectiveLanguage];
    const requestedVoiceId = typeof settings.voiceId === "string" ? settings.voiceId.trim() : "";
    const nextVoiceId =
      nextVoiceOptions.find((voice) => voice.id === requestedVoiceId)?.id ??
      (requestedVoiceId ? nextVoiceOptions[0]?.id ?? "" : "");
    const nextMusicType =
      typeof settings.musicType === "string" && settings.musicType !== "custom"
        ? studioMusicOptions.find((option) => option.id === settings.musicType)?.id ?? null
        : null;
    const nextVideoMode =
      typeof settings.videoMode === "string" && settings.videoMode !== "custom"
        ? studioVideoOptions.find((option) => option.id === settings.videoMode)?.id ?? null
        : null;
    const nextSubtitleStyleId = typeof settings.subtitleStyleId === "string" ? settings.subtitleStyleId.trim() : "";
    const nextSubtitleColorId = typeof settings.subtitleColorId === "string" ? settings.subtitleColorId.trim() : "";
    const nextBrandText = typeof settings.brandText === "string" ? settings.brandText.trim() : "";

    if (nextLanguage) {
      setSelectedLanguage(nextLanguage);
    }

    if (typeof settings.subtitleEnabled === "boolean") {
      setAreSubtitlesEnabled(settings.subtitleEnabled);
    }

    if (nextSubtitleStyleId) {
      setSelectedSubtitleStyleId(nextSubtitleStyleId);
    }

    if (nextSubtitleColorId) {
      setSelectedSubtitleColorId(nextSubtitleColorId);
    }

    if (typeof settings.voiceEnabled === "boolean") {
      setIsVoiceoverEnabled(settings.voiceEnabled);
    }

    if (nextVoiceId) {
      setSelectedVoiceId(nextVoiceId);
    }

    if (nextMusicType) {
      setSelectedMusicType(nextMusicType);
      setSelectedCustomMusic(null);
      setMusicSelectionError(null);
    }

    if (nextVideoMode) {
      setSelectedVideoMode(nextVideoMode);
      setSelectedCustomVideo(null);
      setVideoSelectionError(null);
    }

    if (nextBrandText) {
      setBrandText(nextBrandText.slice(0, STUDIO_BRAND_TEXT_MAX_CHARS));
    }
  };
  const isCurrentDraftSubtitleDisabled = normalizeWorkspaceSegmentEditorSetting(segmentEditorDraft?.subtitleType) === "none";
  const isCurrentDraftVoiceDisabled = normalizeWorkspaceSegmentEditorSetting(segmentEditorDraft?.voiceType) === "none";
  const readyProjectsCount = projects.filter((project) => project.status === "ready").length;
  const activeProjectsCount = projects.filter(
    (project) => project.status === "queued" || project.status === "processing",
  ).length;
  const failedProjectsCount = projects.filter((project) => project.status === "failed").length;
  const accountProjectGroups = useMemo(
    () => buildWorkspaceProjectStackGroups(projects),
    [projects],
  );
  const currentProjectId = generatedVideo?.adId ?? null;
  const currentAppliedSegmentEditorSession =
    currentProjectId && segmentEditorAppliedSession?.projectId === currentProjectId ? segmentEditorAppliedSession : null;
  const hasAppliedSegmentEditorSession = Boolean(currentAppliedSegmentEditorSession);
  const segmentEditorProjectId = segmentEditorDraft?.projectId ?? null;
  const segmentEditorAppliedBaseSession =
    segmentEditorProjectId && segmentEditorAppliedSession?.projectId === segmentEditorProjectId ? segmentEditorAppliedSession : null;
  const segmentEditorLoadedBaseDraft = useMemo(
    () =>
      segmentEditorProjectId && segmentEditorLoadedSession?.projectId === segmentEditorProjectId
        ? createWorkspaceSegmentEditorDraftSession(segmentEditorLoadedSession)
        : null,
    [segmentEditorLoadedSession, segmentEditorProjectId],
  );
  const segmentEditorChecklistBaseSession = segmentEditorAppliedBaseSession ?? segmentEditorLoadedBaseDraft;
  const currentDraftMediaLibraryProject = useMemo(() => {
    if (!segmentEditorDraft) {
      return null;
    }

    const matchingProject =
      projects.find((project) => project.adId === segmentEditorDraft.projectId) ??
      (generatedVideo?.adId === segmentEditorDraft.projectId
        ? createWorkspaceMediaLibraryProjectFromDraft(segmentEditorDraft, {
            generatedVideo,
          })
        : null);

    return createWorkspaceMediaLibraryProjectFromDraft(segmentEditorDraft, {
      generatedVideo,
      project: matchingProject,
    });
  }, [generatedVideo, projects, segmentEditorDraft]);

  useEffect(() => {
    if (!expandedAccountProjectStackKey) {
      return;
    }

    const expandedGroup = accountProjectGroups.find((group) => group.key === expandedAccountProjectStackKey) ?? null;
    if (expandedGroup?.isStack) {
      return;
    }

    setExpandedAccountProjectStackKey(null);
  }, [accountProjectGroups, expandedAccountProjectStackKey]);

  useEffect(() => {
    if (!expandedStudioProjectStackKey) {
      return;
    }

    const expandedGroup = accountProjectGroups.find((group) => group.key === expandedStudioProjectStackKey) ?? null;
    if (expandedGroup?.isStack) {
      return;
    }

    setExpandedStudioProjectStackKey(null);
  }, [accountProjectGroups, expandedStudioProjectStackKey]);
  const storedDraftMediaLibraryItems = useMemo(() => {
    const knownProjectIds = new Set(
      projects
        .map((project) => project.adId)
        .filter((projectId): projectId is number => typeof projectId === "number" && projectId > 0),
    );

    if (typeof generatedVideo?.adId === "number" && generatedVideo.adId > 0) {
      knownProjectIds.add(generatedVideo.adId);
    }

    return storedSegmentEditorDrafts.flatMap((draft) => {
      if (draft.projectId === segmentEditorDraft?.projectId || !knownProjectIds.has(draft.projectId)) {
        return [];
      }

      const matchingProject =
        projects.find((project) => project.adId === draft.projectId) ??
        (generatedVideo?.adId === draft.projectId
          ? createWorkspaceMediaLibraryProjectFromDraft(draft, {
              generatedVideo,
            })
          : null);

      const project = createWorkspaceMediaLibraryProjectFromDraft(draft, {
        generatedVideo: generatedVideo?.adId === draft.projectId ? generatedVideo : null,
        project: matchingProject,
      });

      return buildWorkspaceMediaLibraryDraftItems(project, draft);
    });
  }, [generatedVideo, projects, segmentEditorDraft?.projectId, storedSegmentEditorDrafts]);
  const upsertGeneratedMediaLibraryEntry = useCallback(
    (options: {
      asset: StudioCustomVideoFile;
      kind: WorkspaceMediaLibraryItemKind;
      projectId: number;
      segmentIndex: number;
      sourceJobId: string;
    }) => {
      const normalizedJobId = String(options.sourceJobId ?? "").trim();
      if (!normalizedJobId) {
        return;
      }

      const activeDraft = segmentEditorDraft?.projectId === options.projectId ? segmentEditorDraft : null;
      const activeDraftSegmentListIndex =
        activeDraft?.segments.findIndex((segment) => segment.index === options.segmentIndex) ?? -1;
      const activeDraftSegment =
        activeDraftSegmentListIndex >= 0 && activeDraft ? activeDraft.segments[activeDraftSegmentListIndex] ?? null : null;

      if (!activeDraft || !activeDraftSegment) {
        return;
      }

      const project =
        currentDraftMediaLibraryProject?.adId === options.projectId
          ? currentDraftMediaLibraryProject
          : createWorkspaceMediaLibraryProjectFromDraft(activeDraft, {
              generatedVideo,
              project: projects.find((item) => item.adId === options.projectId) ?? null,
            });
      const nextEntry = buildWorkspaceGeneratedMediaLibraryEntry({
        asset: options.asset,
        kind: options.kind,
        project,
        segment: activeDraftSegment,
        segmentListIndex: activeDraftSegmentListIndex,
        sourceJobId: normalizedJobId,
      });

      if (!nextEntry) {
        return;
      }

      setGeneratedMediaLibraryEntries((currentEntries) => {
        const existingEntryIndex = currentEntries.findIndex((entry) => entry.id === nextEntry.id);
        if (existingEntryIndex < 0) {
          return [nextEntry, ...currentEntries].slice(0, WORKSPACE_GENERATED_MEDIA_LIBRARY_MAX_ENTRIES);
        }

        const nextEntries = [...currentEntries];
        nextEntries[existingEntryIndex] = {
          ...nextEntry,
          createdAt: currentEntries[existingEntryIndex]?.createdAt ?? nextEntry.createdAt,
        };
        return nextEntries
          .sort((left, right) => right.createdAt - left.createdAt)
          .slice(0, WORKSPACE_GENERATED_MEDIA_LIBRARY_MAX_ENTRIES);
      });
    },
    [currentDraftMediaLibraryProject, generatedVideo, projects, segmentEditorDraft],
  );
  const liveMediaLibraryItems = useMemo(
    () =>
      generatedMediaLibraryEntries
        .slice()
        .sort((left, right) => right.createdAt - left.createdAt)
        .map((entry) => entry.item),
    [generatedMediaLibraryEntries],
  );
  const draftMediaLibraryItems = useMemo(
    () =>
      segmentEditorDraft && currentDraftMediaLibraryProject
        ? buildWorkspaceMediaLibraryDraftItems(currentDraftMediaLibraryProject, segmentEditorDraft)
        : [],
    [currentDraftMediaLibraryProject, segmentEditorDraft],
  );
  const resolvedMediaLibraryItems = useMemo(() => {
    return sortWorkspaceMediaLibraryItemsNewestFirst(
      dedupeWorkspaceMediaLibraryItems(
        [...liveMediaLibraryItems, ...draftMediaLibraryItems, ...storedDraftMediaLibraryItems, ...mediaLibraryItems],
      ),
    );
  }, [draftMediaLibraryItems, liveMediaLibraryItems, mediaLibraryItems, storedDraftMediaLibraryItems]);
  const hiddenMediaLibraryItemKeySet = useMemo(() => new Set(hiddenMediaLibraryItemKeys), [hiddenMediaLibraryItemKeys]);
  const hiddenLoadedPersistedMediaLibraryItemsCount = useMemo(
    () =>
      resolvedMediaLibraryItems.filter(
        (item) =>
          item.source === "persisted" &&
          !(typeof item.assetId === "number" && item.assetId > 0) &&
          hiddenMediaLibraryItemKeySet.has(getWorkspaceMediaLibraryItemStorageKey(item)),
      ).length,
    [hiddenMediaLibraryItemKeySet, resolvedMediaLibraryItems],
  );
  const visibleMediaLibraryItems = useMemo(
    () =>
      resolvedMediaLibraryItems.filter((item) => {
        if (!hiddenMediaLibraryItemKeySet.has(getWorkspaceMediaLibraryItemStorageKey(item))) {
          return true;
        }

        return item.source === "persisted" && typeof item.assetId === "number" && item.assetId > 0;
      }),
    [hiddenMediaLibraryItemKeySet, resolvedMediaLibraryItems],
  );
  const isMediaLibraryInitialLoading = isMediaLibraryLoading && !isMediaLibraryLoadingMore;
  const mediaLibraryVisiblePersistedTotal =
    mediaLibraryTotal === null ? null : Math.max(0, mediaLibraryTotal - hiddenLoadedPersistedMediaLibraryItemsCount);
  const mediaLibraryVisibleCount = visibleMediaLibraryItems.length;
  const mediaLibraryDisplayTotalCount =
    mediaLibraryVisiblePersistedTotal === null
      ? null
      : mediaLibraryNextCursor
        ? Math.max(mediaLibraryVisiblePersistedTotal, mediaLibraryVisibleCount)
        : mediaLibraryVisibleCount;
  const mediaLibraryAllPillLabel =
    mediaLibraryDisplayTotalCount === null && isMediaLibraryInitialLoading
      ? "Все"
      : mediaLibraryDisplayTotalCount !== null && mediaLibraryDisplayTotalCount > mediaLibraryVisibleCount
        ? `Все ${mediaLibraryVisibleCount} из ${mediaLibraryDisplayTotalCount}`
        : `Все ${mediaLibraryVisibleCount}`;
  useEffect(() => {
    if (
      activeTab !== "studio" ||
      studioView !== "media" ||
      !mediaLibraryNextCursor ||
      isMediaLibraryLoading ||
      mediaLibraryError ||
      mediaLibraryDisplayTotalCount === null ||
      mediaLibraryVisibleCount >= mediaLibraryDisplayTotalCount
    ) {
        return;
      }

    const root = mediaLibraryScrollRootRef.current;
    if (!root || root.clientHeight <= 0) {
      return;
    }

    const hasFilledVisibleArea =
      root.scrollHeight - root.clientHeight > MEDIA_LIBRARY_LOAD_MORE_SCROLL_THRESHOLD_PX;
    if (hasFilledVisibleArea) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void handleLoadMoreMediaLibrary();
    }, 80);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeTab,
    handleLoadMoreMediaLibrary,
    isMediaLibraryLoading,
    mediaLibraryDisplayTotalCount,
    mediaLibraryError,
    mediaLibraryNextCursor,
    mediaLibraryVisibleCount,
    studioView,
  ]);
  const shouldShowMediaLibraryGridLoadingState =
    isMediaLibraryStudioView && isMediaLibraryLoadingMore && visibleMediaLibraryItems.length > 0;
  const isMediaLibraryResolvingVisibleItems =
    !mediaLibraryError &&
    visibleMediaLibraryItems.length === 0 &&
    (isMediaLibraryLoadingMore ||
      (Boolean(mediaLibraryNextCursor) &&
        (mediaLibraryDisplayTotalCount === null || mediaLibraryDisplayTotalCount > 0)));
  const visibleAiPhotoMediaItemsCount = visibleMediaLibraryItems.filter((item) => item.kind === "ai_photo").length;
  const visibleImageEditMediaItemsCount = visibleMediaLibraryItems.filter((item) => item.kind === "image_edit").length;
  const visibleAiVideoMediaItemsCount = visibleMediaLibraryItems.filter((item) => item.kind === "ai_video").length;
  const visiblePhotoAnimationMediaItemsCount = visibleMediaLibraryItems.filter((item) => item.kind === "photo_animation").length;
  const visibleAiPhotoGroupMediaItemsCount = visibleAiPhotoMediaItemsCount + visibleImageEditMediaItemsCount;
  const visibleAiVideoGroupMediaItemsCount = visibleAiVideoMediaItemsCount + visiblePhotoAnimationMediaItemsCount;
  const filteredVisibleMediaLibraryItems = useMemo(() => {
    if (mediaLibraryFilter === "photo") {
      return visibleMediaLibraryItems.filter((item) => item.kind === "ai_photo" || item.kind === "image_edit");
    }

    if (mediaLibraryFilter === "video") {
      return visibleMediaLibraryItems.filter((item) => item.kind === "ai_video" || item.kind === "photo_animation");
    }

    return visibleMediaLibraryItems;
  }, [mediaLibraryFilter, visibleMediaLibraryItems]);
  const segmentEditorSegmentCount = segmentEditorDraft?.segments.length ?? 0;
  const activeSegment = segmentEditorDraft?.segments[activeSegmentIndex] ?? null;
  useEffect(() => {
    activeSegmentPlaybackIndexRef.current = activeSegment?.index ?? null;
  }, [activeSegment?.index]);
  const segmentEditorChangeChecklist = segmentEditorDraft
    ? buildWorkspaceSegmentEditorChangeChecklist(segmentEditorDraft, segmentEditorChecklistBaseSession, {
        subtitleColorOptions,
        subtitleStyleOptions,
      })
    : [];
  const hasSegmentEditorChanges = segmentEditorChangeChecklist.length > 0;
  const canAddSegmentEditorSegment = segmentEditorSegmentCount < WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS;
  const canDeleteSegmentEditorSegment = segmentEditorSegmentCount > WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS;
  const isSegmentEditorStructureActionBusy =
    isGenerating ||
    isSegmentEditorPreparingCustomVideo ||
    isSegmentEditorGeneratingAiPhoto ||
    isSegmentEditorGeneratingAiVideo ||
    isSegmentEditorGeneratingPhotoAnimation ||
    isSegmentEditorGeneratingImageEdit ||
    isSegmentEditorUpscalingImage;
  const segmentAiPhotoModalSegment =
    typeof segmentAiPhotoModalSegmentIndex === "number"
      ? segmentEditorDraft?.segments.find((segment) => segment.index === segmentAiPhotoModalSegmentIndex) ?? null
      : null;
  const segmentAiPhotoModalCustomFileName = segmentAiPhotoModalSegment?.customVideo?.fileName?.trim() || "";
  const hasSegmentAiPhotoModalCustomFile = Boolean(segmentAiPhotoModalCustomFileName);
  const segmentAiPhotoModalCustomFileLabel = segmentAiPhotoModalCustomFileName
    ? truncateStudioCustomAssetName(segmentAiPhotoModalCustomFileName, 36)
    : null;
  const segmentAiPhotoModalSelectedLibraryItemKey =
    segmentAiPhotoModalSegment?.videoAction === "custom" && segmentAiPhotoModalSegment.customVideo?.source === "media-library"
      ? segmentAiPhotoModalSegment.customVideo.libraryItemKey ?? null
      : null;
  const hasSegmentAiPhotoModalLibrarySelection = Boolean(segmentAiPhotoModalSelectedLibraryItemKey);
  const segmentAiPhotoModalLibraryItems = visibleMediaLibraryItems;
  const filteredSegmentAiPhotoModalLibraryItems = useMemo(() => {
    if (segmentAiPhotoModalLibraryFilter === "photo") {
      return segmentAiPhotoModalLibraryItems.filter((item) => item.kind === "ai_photo" || item.kind === "image_edit");
    }

    if (segmentAiPhotoModalLibraryFilter === "video") {
      return segmentAiPhotoModalLibraryItems.filter((item) => item.kind === "ai_video" || item.kind === "photo_animation");
    }

    return segmentAiPhotoModalLibraryItems;
  }, [segmentAiPhotoModalLibraryFilter, segmentAiPhotoModalLibraryItems]);
  const shouldRenderSegmentAiPhotoModalLibraryGrid =
    ((isSegmentAiPhotoModalOpen && isSegmentAiPhotoModalVisible) || (!isSegmentAiPhotoModalOpen && isSegmentEditorPageActive)) &&
    segmentAiPhotoModalTab === "library";
  const visibleSegmentAiPhotoModalLibraryItems = useMemo(
    () =>
      shouldRenderSegmentAiPhotoModalLibraryGrid
        ? filteredSegmentAiPhotoModalLibraryItems.slice(0, segmentAiPhotoModalLibraryRenderCount)
        : [],
    [
      filteredSegmentAiPhotoModalLibraryItems,
      segmentAiPhotoModalLibraryRenderCount,
      shouldRenderSegmentAiPhotoModalLibraryGrid,
    ],
  );
  const hasMoreSegmentAiPhotoModalLibraryItems =
    shouldRenderSegmentAiPhotoModalLibraryGrid &&
    visibleSegmentAiPhotoModalLibraryItems.length < filteredSegmentAiPhotoModalLibraryItems.length;
  useEffect(() => {
    if (!shouldRenderSegmentAiPhotoModalLibraryGrid) {
      setSegmentAiPhotoModalLibraryRenderCount(SEGMENT_AI_PHOTO_MODAL_LIBRARY_INITIAL_RENDER_COUNT);
      return;
    }

    setSegmentAiPhotoModalLibraryRenderCount(SEGMENT_AI_PHOTO_MODAL_LIBRARY_INITIAL_RENDER_COUNT);
  }, [
    segmentAiPhotoModalLibraryFilter,
    segmentAiPhotoModalSegment?.index,
    shouldRenderSegmentAiPhotoModalLibraryGrid,
  ]);
  useEffect(() => {
    if (!hasMoreSegmentAiPhotoModalLibraryItems) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSegmentAiPhotoModalLibraryRenderCount((current) =>
        Math.min(current + SEGMENT_AI_PHOTO_MODAL_LIBRARY_RENDER_STEP, filteredSegmentAiPhotoModalLibraryItems.length),
      );
    }, 32);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [filteredSegmentAiPhotoModalLibraryItems.length, hasMoreSegmentAiPhotoModalLibraryItems]);
  const segmentAiPhotoModalScenarioPrompt = segmentAiPhotoModalSegment ? getWorkspaceSegmentAiPhotoPromptPrefill(segmentAiPhotoModalSegment) : "";
  const segmentAiPhotoModalSegmentNumber =
    segmentEditorDraft && segmentAiPhotoModalSegment
      ? getWorkspaceSegmentEditorDisplayNumber(segmentEditorDraft.segments, segmentAiPhotoModalSegment.index)
      : null;
  const normalizedSegmentAiPhotoModalPrompt = normalizeWorkspaceSegmentAiPhotoPrompt(segmentAiPhotoModalPrompt);
  const normalizedSegmentImageEditModalPrompt = normalizeWorkspaceSegmentImageEditPrompt(segmentImageEditModalPrompt);
  const normalizedSegmentAiVideoModalPrompt = normalizeWorkspaceSegmentAiVideoPrompt(segmentAiVideoModalPrompt);
  const isSegmentAiPhotoModalAiReady = Boolean(
    segmentAiPhotoModalSegment?.aiPhotoAsset &&
      normalizeWorkspaceSegmentAiPhotoPrompt(segmentAiPhotoModalSegment.aiPhotoGeneratedFromPrompt) === normalizedSegmentAiPhotoModalPrompt,
  );
  const isSegmentImageEditModalReady = Boolean(
    segmentAiPhotoModalSegment &&
      isWorkspaceSegmentImageEditReady(segmentAiPhotoModalSegment),
  );
  const isSegmentAiVideoModalReady = Boolean(
    segmentAiPhotoModalSegment &&
      isWorkspaceSegmentAiVideoReady(segmentAiPhotoModalSegment, "ai_video"),
  );
  const isSegmentPhotoAnimationModalReady = Boolean(
    segmentAiPhotoModalSegment &&
      isWorkspaceSegmentAiVideoReady(segmentAiPhotoModalSegment, "photo_animation"),
  );
  const createSegmentAiPhotoModalStatus = ({
    isBusy = false,
  }: {
    isBusy?: boolean;
    isReady?: boolean;
  }) => (isBusy ? { label: "Идет", tone: "processing" as const } : null);
  const canAnimateSegmentPhoto = canWorkspaceSegmentAnimatePhoto(segmentAiPhotoModalSegment);
  const isSegmentAiPhotoModalGeneratingCurrentSegment = Boolean(
    segmentAiPhotoModalSegment &&
      isSegmentEditorGeneratingAiPhoto &&
      segmentEditorGeneratingAiPhotoSegmentIndex === segmentAiPhotoModalSegment.index,
  );
  const isSegmentAiVideoModalGeneratingCurrentSegment = Boolean(
    segmentAiPhotoModalSegment &&
      isSegmentEditorGeneratingAiVideo &&
      segmentEditorGeneratingAiVideoSegmentIndex === segmentAiPhotoModalSegment.index,
  );
  const isSegmentPhotoAnimationModalGeneratingCurrentSegment = Boolean(
    segmentAiPhotoModalSegment &&
      isSegmentEditorGeneratingPhotoAnimation &&
      segmentEditorGeneratingPhotoAnimationSegmentIndex === segmentAiPhotoModalSegment.index,
  );
  const isSegmentImageEditModalGeneratingCurrentSegment = Boolean(
    segmentAiPhotoModalSegment &&
      isSegmentEditorGeneratingImageEdit &&
      segmentEditorGeneratingImageEditSegmentIndex === segmentAiPhotoModalSegment.index,
  );
  const isSegmentImageUpscaleCurrentSegment = Boolean(
    segmentAiPhotoModalSegment &&
      isSegmentEditorUpscalingImage &&
      segmentEditorUpscalingImageSegmentIndex === segmentAiPhotoModalSegment.index,
  );
  const canEditSegmentImage = canWorkspaceSegmentEditPhoto(segmentAiPhotoModalSegment);
  const canUpscaleSegmentImage = canWorkspaceSegmentUpscalePhoto(segmentAiPhotoModalSegment);
  const segmentPhotoToolUnavailableReason = getWorkspaceSegmentPhotoToolUnavailableReason(
    segmentAiPhotoModalSegment,
    "Сначала выберите фото",
  );
  const segmentAiPhotoModalAiVideoStatus = createSegmentAiPhotoModalStatus({
    isBusy: isSegmentAiVideoModalGeneratingCurrentSegment,
    isReady: isSegmentAiVideoModalReady,
  });
  const segmentAiPhotoModalPhotoAnimationStatus = createSegmentAiPhotoModalStatus({
    isBusy: isSegmentPhotoAnimationModalGeneratingCurrentSegment,
    isReady: isSegmentPhotoAnimationModalReady,
  });
  const segmentAiPhotoModalAiPhotoStatus = createSegmentAiPhotoModalStatus({
    isBusy: isSegmentAiPhotoModalGeneratingCurrentSegment,
    isReady: isSegmentAiPhotoModalAiReady,
  });
  const segmentAiPhotoModalImageEditStatus = createSegmentAiPhotoModalStatus({
    isBusy: isSegmentImageEditModalGeneratingCurrentSegment,
    isReady: isSegmentImageEditModalReady,
  });
  const segmentAiPhotoModalLibraryStatus = createSegmentAiPhotoModalStatus({
    isBusy: isMediaLibraryLoading && segmentAiPhotoModalLibraryItems.length === 0,
    isReady: hasSegmentAiPhotoModalLibrarySelection,
  });
  const segmentAiPhotoModalUploadStatus = createSegmentAiPhotoModalStatus({
    isBusy: isSegmentEditorPreparingCustomVideo,
    isReady: hasSegmentAiPhotoModalCustomFile,
  });
  const segmentAiPhotoModalUpscaleStatus = createSegmentAiPhotoModalStatus({
    isBusy: isSegmentImageUpscaleCurrentSegment,
  });
  const canImproveSegmentAiPhotoPrompt = Boolean(
    normalizedSegmentAiPhotoModalPrompt || normalizeWorkspaceSegmentAiPhotoPrompt(segmentAiPhotoModalScenarioPrompt),
  );
  const canImproveSegmentImageEditPrompt = Boolean(
    normalizedSegmentImageEditModalPrompt || normalizeWorkspaceSegmentImageEditPrompt(segmentAiPhotoModalScenarioPrompt),
  );
  const canImproveSegmentAiVideoPrompt = Boolean(
    normalizedSegmentAiVideoModalPrompt || normalizeWorkspaceSegmentAiVideoPrompt(segmentAiPhotoModalScenarioPrompt),
  );
  const renderSegmentAiPhotoModalSourceButton = ({
    title,
    description,
    footer,
    isActive = false,
    isSelectable = true,
    disabled = false,
    buttonTitle,
    onClick,
  }: {
    title: string;
    description: string;
    footer?: ReactNode;
    isActive?: boolean;
    isSelectable?: boolean;
    disabled?: boolean;
    buttonTitle?: string;
    onClick: () => void;
  }) => (
    <button
      className={`studio-ai-photo-modal__source-tab${isActive ? " is-active" : ""}`}
      type="button"
      aria-pressed={isSelectable ? isActive : undefined}
      disabled={disabled}
      title={buttonTitle}
      onClick={onClick}
    >
      <span className="studio-ai-photo-modal__source-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      {footer}
    </button>
  );
  const isSegmentThumbReorderEnabled = Boolean(segmentEditorDraft && segmentEditorDraft.segments.length > 1);
  const draggedSegmentThumbIndex = segmentThumbDragState?.draggedIndex ?? null;
  const visibleSegmentThumbInsertIndex = getVisibleInsertIndexForDraggedItem(
    segmentEditorDraft?.segments.length ?? 0,
    draggedSegmentThumbIndex,
    segmentThumbDropInsertIndex,
  );
  const segmentThumbDragSegment =
    segmentEditorDraft && segmentThumbDragState ? segmentEditorDraft.segments[segmentThumbDragState.draggedIndex] ?? null : null;
  const segmentThumbVisibleSlotCount = Math.max(
    1,
    segmentEditorSegmentCount + (canAddSegmentEditorSegment ? 1 : 0) + (visibleSegmentThumbInsertIndex === null ? 0 : 1),
  );
  const segmentThumbBarStyle = {
    "--studio-segment-editor-thumb-count": segmentThumbVisibleSlotCount,
  } as CSSProperties;
  const segmentThumbDragGhostStyle: CSSProperties | null = segmentThumbDragState
    ? {
        left: `${segmentThumbDragState.x - segmentThumbDragState.offsetX}px`,
        top: `${segmentThumbDragState.y - segmentThumbDragState.offsetY}px`,
        width: `${segmentThumbDragState.width}px`,
      }
    : null;

  useEffect(() => {
    setPreviewModalPlaybackError(null);
    if (!previewModalVideoPlaybackUrl) {
      previewModalPendingPlaybackRef.current = null;
    }
  }, [previewModalVideoPlaybackUrl]);
  const activeSegmentMediaSurface = activeSegment
    ? getWorkspaceSegmentResolvedMediaSurface(activeSegment, "segment-carousel-card", {
        isPlaybackRequested:
          getWorkspaceSegmentPreviewKind(activeSegment) === "video" &&
          (queuedSegmentEditorPlaybackIndex === activeSegment.index || playingSegmentEditorPreviewIndex === activeSegment.index),
      })
    : null;
  const activeSegmentMediaUrl = activeSegmentMediaSurface?.viewerUrl ?? null;
  const activeSegmentStableIndex = activeSegment?.index ?? null;
  const activeSegmentPreviewKind = activeSegmentMediaSurface?.previewKind ?? null;
  const studioSidebarActiveItem =
    studioView === "projects" ? "projects" : studioView === "media" ? "media" : createMode === "segment-editor" ? "edit" : "create";
  const studioNavSectionLabels =
    createMode === "segment-editor"
      ? {
          create: "Редактор Shorts",
        }
      : undefined;
  const shouldShowStudioSidebar = false;
  const studioSidebarSubtitleStyleId =
    normalizeWorkspaceSegmentEditorSetting(segmentEditorDraft?.subtitleStyle) ?? selectedSubtitleStyleId;
  const studioSidebarSubtitleColorId =
    normalizeWorkspaceSegmentEditorSetting(segmentEditorDraft?.subtitleColor) ?? selectedSubtitleColorId;
  const studioSidebarSubtitlesEnabled = segmentEditorDraft ? !isCurrentDraftSubtitleDisabled : areSubtitlesEnabled;
  const studioSidebarVoiceId =
    selectedVoiceOptions.find((voice) => voice.id === normalizeWorkspaceSegmentEditorSetting(segmentEditorDraft?.voiceType))?.id ??
    resolvedSelectedVoiceId;
  const studioSidebarVoiceEnabled = segmentEditorDraft ? !isCurrentDraftVoiceDisabled : isVoiceoverEnabled;
  const studioSidebarMusicTypeRaw = normalizeWorkspaceSegmentEditorSetting(segmentEditorDraft?.musicType);
  const studioSidebarMusicType = studioMusicOptions.some((option) => option.id === studioSidebarMusicTypeRaw)
    ? (studioSidebarMusicTypeRaw as StudioMusicType)
    : selectedMusicType;
  const studioSidebarProjectTitle = (() => {
    if (!segmentEditorDraft) {
      return "";
    }

    const matchingProject = projects.find((project) => project.adId === segmentEditorDraft.projectId);
    if (matchingProject) {
      return getWorkspaceProjectDisplayTitle(matchingProject);
    }

    const normalizedTitle = segmentEditorDraft.title.trim();
    return normalizedTitle || `Проект #${segmentEditorDraft.projectId}`;
  })();
  const studioCanvasPageTitle = "";
  const showStudioCanvasPageTitle = false;
  const cancelSegmentEditorSyntheticPlayback = () => {
    if (segmentEditorSyntheticPlaybackFrameRef.current !== null) {
      window.cancelAnimationFrame(segmentEditorSyntheticPlaybackFrameRef.current);
      segmentEditorSyntheticPlaybackFrameRef.current = null;
    }

    if (segmentEditorSyntheticPlaybackFinishTimeoutRef.current !== null) {
      window.clearTimeout(segmentEditorSyntheticPlaybackFinishTimeoutRef.current);
      segmentEditorSyntheticPlaybackFinishTimeoutRef.current = null;
    }

    segmentEditorSyntheticPlaybackRef.current = null;
  };
  const clearSegmentThumbDragState = () => {
    segmentThumbPendingDragRef.current = null;
    segmentThumbDragStateRef.current = null;
    setSegmentThumbDragState(null);
    setSegmentThumbDropInsertIndex(null);
  };
  const isSegmentThumbClickSuppressed = () => window.performance.now() < segmentThumbSuppressClickUntilRef.current;
  const setSegmentThumbButtonRef =
    (segmentIndex: number) =>
    (element: HTMLButtonElement | null) => {
      if (element) {
        segmentThumbButtonRefs.current[segmentIndex] = element;
        return;
      }

      delete segmentThumbButtonRefs.current[segmentIndex];
    };
  const scrollSegmentThumbStripForPointer = (clientX: number) => {
    const stripElement = segmentThumbStripRef.current;
    if (!stripElement) {
      return;
    }

    const bounds = stripElement.getBoundingClientRect();
    const edgeThreshold = 56;
    let scrollDelta = 0;

    if (clientX < bounds.left + edgeThreshold) {
      scrollDelta = -Math.ceil(((bounds.left + edgeThreshold - clientX) / edgeThreshold) * 18);
    } else if (clientX > bounds.right - edgeThreshold) {
      scrollDelta = Math.ceil(((clientX - (bounds.right - edgeThreshold)) / edgeThreshold) * 18);
    }

    if (scrollDelta !== 0) {
      stripElement.scrollLeft += scrollDelta;
    }
  };
  const resolveSegmentThumbInsertIndexFromClientX = (clientX: number, draggedIndex: number) => {
    if (!segmentEditorDraft) {
      return 0;
    }

    const visibleIndices = segmentEditorDraft.segments
      .map((_, index) => index)
      .filter((segmentIndex) => segmentIndex !== draggedIndex);
    if (visibleIndices.length === 0) {
      return 0;
    }

    let visibleInsertIndex = 0;

    for (const segmentIndex of visibleIndices) {
      const segment = segmentEditorDraft.segments[segmentIndex];
      const element = segment ? segmentThumbButtonRefs.current[segment.index] ?? null : null;
      const bounds = element?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0) {
        continue;
      }

      if (clientX < bounds.left + bounds.width / 2) {
        break;
      }

      visibleInsertIndex += 1;
    }

    return visibleInsertIndex >= draggedIndex ? visibleInsertIndex + 1 : visibleInsertIndex;
  };
  const startSegmentThumbPointerDrag = (event: ReactPointerEvent<HTMLButtonElement>, draggedIndex: number) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextDragState: WorkspaceSegmentThumbDragState = {
      draggedIndex,
      height: bounds.height,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      pointerId: event.pointerId,
      width: bounds.width,
      x: event.clientX,
      y: event.clientY,
    };

    scrollSegmentThumbStripForPointer(event.clientX);
    segmentThumbDragStateRef.current = nextDragState;
    setSegmentThumbDragState(nextDragState);
    setSegmentThumbDropInsertIndex(resolveSegmentThumbInsertIndexFromClientX(event.clientX, draggedIndex));
  };
  const updateSegmentThumbPointerDrag = (clientX: number, clientY: number, draggedIndex: number) => {
    scrollSegmentThumbStripForPointer(clientX);
    const currentDragState = segmentThumbDragStateRef.current;
    if (!currentDragState || currentDragState.draggedIndex !== draggedIndex) {
      return;
    }

    const nextDragState: WorkspaceSegmentThumbDragState = {
      ...currentDragState,
      x: clientX,
      y: clientY,
    };

    segmentThumbDragStateRef.current = nextDragState;
    setSegmentThumbDragState(nextDragState);
    setSegmentThumbDropInsertIndex(resolveSegmentThumbInsertIndexFromClientX(clientX, draggedIndex));
  };
  const stopSegmentEditorPreviewVideoElements = (options?: { clearRefs?: boolean }) => {
    segmentEditorPreviewResetTokenRef.current += 1;

    Object.values(segmentEditorPreviewVideoRefs.current).forEach((element) => {
      if (!element) {
        return;
      }

      element.pause();
      element.muted = true;
      element.defaultMuted = true;
      if (element.preload !== "none") {
        element.preload = "none";
      }

      delete element.dataset.previewPrimed;

      try {
        element.currentTime = 0;
      } catch {
        // Ignore reset errors while metadata is still loading.
      }
    });

    if (options?.clearRefs) {
      segmentEditorPreviewVideoRefs.current = {};
    }
  };

  const resetSegmentEditorPreviewPlaybackState = (options?: { clearRefs?: boolean }) => {
    cancelSegmentEditorSyntheticPlayback();
    stopSegmentEditorPreviewVideoElements(options);
    setPlayingSegmentEditorPreviewIndex(null);
    setQueuedSegmentEditorPlaybackIndex(null);
    setSegmentEditorPreviewTimes({});
  };
  const clearSegmentEditorDetachedWarmupVideo = useCallback((segmentIndex: number) => {
    const existingElement = segmentEditorDetachedWarmupVideoRefs.current[segmentIndex] ?? null;
    if (!existingElement) {
      return;
    }

    disposeWorkspaceDetachedVideoElement(existingElement);
    delete segmentEditorDetachedWarmupVideoRefs.current[segmentIndex];
  }, []);

  const clearAllSegmentEditorDetachedWarmupVideos = useCallback(() => {
    Object.keys(segmentEditorDetachedWarmupVideoRefs.current).forEach((segmentIndexKey) => {
      const segmentIndex = Number(segmentIndexKey);
      if (Number.isFinite(segmentIndex)) {
        clearSegmentEditorDetachedWarmupVideo(segmentIndex);
      }
    });
  }, [clearSegmentEditorDetachedWarmupVideo]);

  const warmSegmentEditorGeneratedVideoForPlayback = useCallback(
    async (segmentIndex: number, previewUrl: string | null | undefined) => {
      const normalizedPreviewUrl = String(previewUrl ?? "").trim();
      if (!normalizedPreviewUrl || typeof document === "undefined" || typeof window === "undefined") {
        return false;
      }

      const attachedPreviewVideo = await new Promise<HTMLVideoElement | null>((resolve) => {
        const startedAt = window.performance.now();
        let animationFrameId = 0;

        const finish = (element: HTMLVideoElement | null) => {
          if (animationFrameId) {
            window.cancelAnimationFrame(animationFrameId);
          }

          resolve(element);
        };

        const tryResolve = () => {
          const candidate = segmentEditorPreviewVideoRefs.current[segmentIndex] ?? null;
          if (candidate && videoElementUsesWorkspaceSourceUrl(candidate, normalizedPreviewUrl)) {
            finish(candidate);
            return;
          }

          if (window.performance.now() - startedAt >= WORKSPACE_SEGMENT_GENERATED_VIDEO_WARMUP_ATTACH_TIMEOUT_MS) {
            finish(null);
            return;
          }

          animationFrameId = window.requestAnimationFrame(tryResolve);
        };

        tryResolve();
      });

      if (attachedPreviewVideo) {
        return waitForWorkspaceVideoElementReady(attachedPreviewVideo);
      }

      const existingWarmupElement = segmentEditorDetachedWarmupVideoRefs.current[segmentIndex] ?? null;
      if (existingWarmupElement && !videoElementUsesWorkspaceSourceUrl(existingWarmupElement, normalizedPreviewUrl)) {
        clearSegmentEditorDetachedWarmupVideo(segmentIndex);
      }

      let warmupElement = segmentEditorDetachedWarmupVideoRefs.current[segmentIndex] ?? null;
      if (!warmupElement) {
        warmupElement = document.createElement("video");
        warmupElement.defaultMuted = true;
        warmupElement.muted = true;
        warmupElement.playsInline = true;
        warmupElement.preload = "auto";
        segmentEditorDetachedWarmupVideoRefs.current[segmentIndex] = warmupElement;
      }

      if (!videoElementUsesWorkspaceSourceUrl(warmupElement, normalizedPreviewUrl)) {
        warmupElement.src = normalizedPreviewUrl;
      }

      return waitForWorkspaceVideoElementReady(warmupElement);
    },
    [clearSegmentEditorDetachedWarmupVideo],
  );

  useEffect(() => {
    if (createMode === "segment-editor") {
      return;
    }

    clearAllSegmentEditorDetachedWarmupVideos();
  }, [clearAllSegmentEditorDetachedWarmupVideos, createMode]);

  useEffect(() => {
    return () => {
      clearAllSegmentEditorDetachedWarmupVideos();
    };
  }, [clearAllSegmentEditorDetachedWarmupVideos]);
  const moveSegmentEditorThumb = (fromIndex: number, insertIndex: number) => {
    if (!segmentEditorDraft) {
      return;
    }

    const currentOrder = getSegmentEditorOrderSnapshot(segmentEditorDraft);
    const nextSegments = rebuildWorkspaceSegmentEditorDraftTimeline(
      moveArrayItemToInsertIndex(segmentEditorDraft.segments, fromIndex, insertIndex),
    );
    if (nextSegments === segmentEditorDraft.segments) {
      logSegmentEditorDiagnostics(
        "client.segment-editor.reorder.noop",
        {
          fromIndex,
          insertIndex,
        },
        {
          includeOrder: true,
        },
      );
      return;
    }

    const activeSegmentStableIndex = segmentEditorDraft.segments[activeSegmentIndex]?.index ?? null;
    const nextActiveSegmentIndex =
      activeSegmentStableIndex === null
        ? Math.max(0, Math.min(insertIndex, nextSegments.length - 1))
        : nextSegments.findIndex((segment) => segment.index === activeSegmentStableIndex);

    logSegmentEditorDiagnostics("client.segment-editor.reorder.commit", {
      activeSegmentStableIndex,
      fromIndex,
      insertIndex,
      nextActiveSegmentIndex,
      nextOrder: getSegmentEditorOrderSnapshot({ segments: nextSegments }),
      previousOrder: currentOrder,
    });

    resetSegmentEditorPreviewPlaybackState();
    setSegmentEditorVideoError(null);
    setSegmentEditorDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            segments: rebuildWorkspaceSegmentEditorDraftTimeline(
              moveArrayItemToInsertIndex(currentDraft.segments, fromIndex, insertIndex),
            ),
          }
        : currentDraft,
    );
    syncSegmentEditorRouteForArrayIndex(
      { projectId: segmentEditorDraft.projectId, segments: nextSegments },
      nextActiveSegmentIndex >= 0 ? nextActiveSegmentIndex : 0,
    );
    setActiveSegmentIndex(nextActiveSegmentIndex >= 0 ? nextActiveSegmentIndex : 0);
  };
  const handleSegmentThumbPointerDown =
    (segmentArrayIndex: number) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!isSegmentThumbReorderEnabled || (event.pointerType === "mouse" && event.button !== 0)) {
        return;
      }

      segmentThumbPendingDragRef.current = {
        index: segmentArrayIndex,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture errors for unsupported pointers.
      }
    };
  const handleSegmentThumbPointerMove =
    (segmentArrayIndex: number) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const pendingDragState = segmentThumbPendingDragRef.current;
      if (
        !pendingDragState ||
        pendingDragState.pointerId !== event.pointerId ||
        pendingDragState.index !== segmentArrayIndex
      ) {
        return;
      }

      const currentDragState = segmentThumbDragStateRef.current;
      if (!currentDragState) {
        const deltaX = event.clientX - pendingDragState.startX;
        const deltaY = event.clientY - pendingDragState.startY;
        if (Math.hypot(deltaX, deltaY) < 8) {
          return;
        }

        event.preventDefault();
        segmentThumbSuppressClickUntilRef.current = window.performance.now() + 320;
        startSegmentThumbPointerDrag(event, segmentArrayIndex);
        return;
      }

      if (currentDragState.pointerId !== event.pointerId || currentDragState.draggedIndex !== segmentArrayIndex) {
        return;
      }

      event.preventDefault();
      updateSegmentThumbPointerDrag(event.clientX, event.clientY, segmentArrayIndex);
    };
  const finishSegmentThumbPointerDrag =
    (segmentArrayIndex: number) =>
    (event: ReactPointerEvent<HTMLButtonElement>, options?: { cancelled?: boolean }) => {
      const pendingDragState = segmentThumbPendingDragRef.current;
      if (
        !pendingDragState ||
        pendingDragState.pointerId !== event.pointerId ||
        pendingDragState.index !== segmentArrayIndex
      ) {
        return;
      }

      const currentDragState = segmentThumbDragStateRef.current;
      const isDragActive =
        Boolean(currentDragState) &&
        currentDragState?.pointerId === event.pointerId &&
        currentDragState.draggedIndex === segmentArrayIndex;

      const finalInsertIndex = isDragActive
        ? resolveSegmentThumbInsertIndexFromClientX(event.clientX, segmentArrayIndex)
        : null;

      logSegmentEditorDiagnostics("client.segment-editor.reorder.finish", {
        cancelled: options?.cancelled ?? false,
        finalInsertIndex,
        isDragActive,
        pointerId: event.pointerId,
        segmentArrayIndex,
      });

      if (isDragActive && !options?.cancelled) {
        event.preventDefault();
        updateSegmentThumbPointerDrag(event.clientX, event.clientY, segmentArrayIndex);
        if (finalInsertIndex !== null) {
          moveSegmentEditorThumb(segmentArrayIndex, finalInsertIndex);
        }
        segmentThumbSuppressClickUntilRef.current = window.performance.now() + 320;
      }

      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore capture errors for unsupported pointers.
      }

      clearSegmentThumbDragState();
    };
  const syncAdaptivePromptPanelWidth = useCallback(() => {
    if (createMode === "segment-editor" || typeof window === "undefined") {
      setAdaptivePromptPanelWidth((currentWidth) => (currentWidth === null ? currentWidth : null));
      return;
    }

    const promptInnerElement = promptInnerRef.current;
    const promptFooterElement = promptFooterRef.current;
    const promptChipsElement = promptChipsRef.current;
    const promptSubmitElement = promptSubmitRef.current;

    if (!promptInnerElement || !promptFooterElement || !promptChipsElement || !promptSubmitElement) {
      return;
    }

    const promptShellElement = promptInnerElement.parentElement;
    const promptShellStyle = promptShellElement ? window.getComputedStyle(promptShellElement) : null;
    const shellPaddingInline =
      (promptShellStyle ? Number.parseFloat(promptShellStyle.paddingLeft) || 0 : 0) +
      (promptShellStyle ? Number.parseFloat(promptShellStyle.paddingRight) || 0 : 0);
    const availableViewportWidth = Math.max(0, window.innerWidth - shellPaddingInline);

    if (availableViewportWidth <= STUDIO_PROMPT_PANEL_ADAPTIVE_BREAKPOINT) {
      setAdaptivePromptPanelWidth((currentWidth) => (currentWidth === null ? currentWidth : null));
      return;
    }

    const promptInnerStyle = window.getComputedStyle(promptInnerElement);
    const promptFooterStyle = window.getComputedStyle(promptFooterElement);
    const promptChipsStyle = window.getComputedStyle(promptChipsElement);
    const promptPaddingInline =
      (Number.parseFloat(promptInnerStyle.paddingLeft) || 0) + (Number.parseFloat(promptInnerStyle.paddingRight) || 0);
    const footerGap = Number.parseFloat(promptFooterStyle.columnGap || promptFooterStyle.gap) || 0;
    const chipsGap = Number.parseFloat(promptChipsStyle.columnGap || promptChipsStyle.gap) || 0;
    const chipsWidth = measureElementChildrenInlineWidth(promptChipsElement, chipsGap);
    const submitWidth = Math.ceil(promptSubmitElement.getBoundingClientRect().width);
    const configuredPromptMaxWidth =
      Number.parseFloat(promptInnerStyle.getPropertyValue("--studio-prompt-panel-max-width")) || 0;
    const maxPromptWidth = Math.min(
      availableViewportWidth,
      Math.max(configuredPromptMaxWidth, STUDIO_PROMPT_PANEL_EXPANDED_MAX_WIDTH),
    );
    const minPromptWidth = Math.min(STUDIO_PROMPT_PANEL_BASE_WIDTH, maxPromptWidth);
    const desiredWidth = Math.ceil(
      promptPaddingInline + chipsWidth + submitWidth + footerGap + STUDIO_PROMPT_PANEL_INLINE_BUFFER,
    );
    const nextWidth = Math.min(maxPromptWidth, Math.max(minPromptWidth, desiredWidth));

    setAdaptivePromptPanelWidth((currentWidth) =>
      currentWidth !== null && Math.abs(currentWidth - nextWidth) < 1 ? currentWidth : nextWidth,
    );
  }, [createMode]);

  useLayoutEffect(() => {
    syncAdaptivePromptPanelWidth();
  });

  useEffect(() => {
    if (createMode === "segment-editor" || typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      syncAdaptivePromptPanelWidth();
    };

    window.addEventListener("resize", handleResize);

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncAdaptivePromptPanelWidth()) : null;

    [promptFooterRef.current, promptChipsRef.current, promptSubmitRef.current].forEach((element) => {
      if (element && resizeObserver) {
        resizeObserver.observe(element);
      }
    });

    void document.fonts?.ready.then(() => {
      syncAdaptivePromptPanelWidth();
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, [createMode, syncAdaptivePromptPanelWidth]);

  const promptInnerStyle: CSSProperties | undefined =
    createMode === "segment-editor" && segmentEditorPanelHeightLock
      ? {
          height: `${segmentEditorPanelHeightLock}px`,
          minHeight: `${segmentEditorPanelHeightLock}px`,
          maxHeight: `${segmentEditorPanelHeightLock}px`,
        }
      : adaptivePromptPanelWidth !== null
        ? {
            width: `${adaptivePromptPanelWidth}px`,
            maxWidth: `${adaptivePromptPanelWidth}px`,
          }
        : undefined;

  useEffect(() => {
    if (createMode !== "segment-editor" || (isSegmentAiPhotoModalOpen && !segmentAiPhotoModalSegment)) {
      resetSegmentAiPhotoModalState();
    }
  }, [createMode, isSegmentAiPhotoModalOpen, resetSegmentAiPhotoModalState, segmentAiPhotoModalSegment]);

  useEffect(() => {
    if (!isSegmentAiPhotoModalOpen) {
      return;
    }

    const resetModalScrollPosition = () => {
      segmentAiPhotoModalPanelRef.current?.scrollTo({ top: 0, behavior: "auto" });
      segmentAiPhotoModalTextareaRef.current?.scrollTo({ top: 0, behavior: "auto" });
    };

    resetModalScrollPosition();
    const animationFrameId = window.requestAnimationFrame(resetModalScrollPosition);
    const timeoutId = window.setTimeout(resetModalScrollPosition, 80);

    resetSegmentEditorPreviewPlaybackState();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [isSegmentAiPhotoModalOpen]);

  useEffect(() => {
    if (!isSegmentAiPhotoModalOpen || !segmentAiPhotoModalSegment) {
      setIsSegmentAiPhotoModalVisible(false);
      setSegmentAiPhotoModalLibraryRenderCount(SEGMENT_AI_PHOTO_MODAL_LIBRARY_INITIAL_RENDER_COUNT);
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      setIsSegmentAiPhotoModalVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [isSegmentAiPhotoModalOpen, segmentAiPhotoModalSegment]);

  useEffect(() => {
    if (!isSegmentAiPhotoModalOpen || !isSegmentAiPhotoModalVisible) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (segmentAiPhotoModalPanelRef.current?.contains(target)) {
        return;
      }

      if (target.closest(".studio-segment-editor__carousel, .studio-segment-editor__thumbbar")) {
        return;
      }

      const interactiveControl = target.closest('button, input, textarea, label, a, [role="button"], [role="link"]');
      if (interactiveControl) {
        return;
      }

      closeSegmentAiPhotoModal();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [closeSegmentAiPhotoModal, isSegmentAiPhotoModalOpen, isSegmentAiPhotoModalVisible]);

  useEffect(() => {
    cancelSegmentEditorSyntheticPlayback();
    stopSegmentEditorPreviewVideoElements();
    const pendingActivatedPlaybackIndex =
      createMode === "segment-editor" &&
      activeSegmentStableIndex !== null &&
      activeSegmentPreviewKind === "video" &&
      pendingSegmentEditorActivatedPlaybackIndexRef.current === activeSegmentStableIndex
        ? activeSegmentStableIndex
        : null;

    pendingSegmentEditorActivatedPlaybackIndexRef.current = null;
    setQueuedSegmentEditorPlaybackIndex(pendingActivatedPlaybackIndex);
    setPlayingSegmentEditorPreviewIndex(null);
    setSegmentEditorPreviewTimes({});
  }, [activeSegmentMediaUrl, activeSegmentPreviewKind, activeSegmentStableIndex, createMode]);

  useEffect(() => {
    if (createMode !== "segment-editor") {
      return;
    }

    const queuedSegment = activeSegmentStableIndex === queuedSegmentEditorPlaybackIndex ? activeSegment : null;

    if (queuedSegmentEditorPlaybackIndex === null || !queuedSegment) {
      return;
    }

    const element = segmentEditorPreviewVideoRefs.current[queuedSegmentEditorPlaybackIndex] ?? null;
    if (!element) {
      return;
    }

    let cancelled = false;
    const queuedIndex = queuedSegmentEditorPlaybackIndex;

    const startPlayback = async () => {
      if (cancelled) {
        return;
      }

      const previewKind = getWorkspaceSegmentPreviewKind(queuedSegment);

      if (previewKind === "video") {
        await requestSegmentEditorVideoPlayback(queuedIndex, element, { resetToStart: true });
        return;
      }

      element.muted = true;
      element.defaultMuted = true;
      setSegmentEditorPreviewTime(queuedIndex, 0);
      setQueuedSegmentEditorPlaybackIndex(null);
      startSegmentEditorSyntheticPlayback(queuedIndex, getSegmentEditorSyntheticPlaybackDuration(queuedSegment));
      await playVideoElement(element, true);
    };

    if (element.readyState >= 1) {
      void startPlayback();
      return () => {
        cancelled = true;
      };
    }

    const handleLoadedMetadata = () => {
      void startPlayback();
    };

    element.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
    ensureVideoElementLoading(element, HTMLMediaElement.HAVE_METADATA);

    return () => {
      cancelled = true;
      element.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [activeSegment, activeSegmentMediaUrl, activeSegmentStableIndex, createMode, queuedSegmentEditorPlaybackIndex]);

  useEffect(() => {
    if (!isVoiceoverEnabled || !resolvedSelectedVoiceId || resolvedSelectedVoiceId === selectedVoiceId) {
      return;
    }

    setSelectedVoiceId(resolvedSelectedVoiceId);
  }, [isVoiceoverEnabled, resolvedSelectedVoiceId, selectedVoiceId]);

  useEffect(() => {
    publishFormSnapshotRef.current = {
      description: publishDescription,
      hashtags: publishHashtags,
      mode: publishMode,
      scheduledAtInput: publishScheduledAtInput,
      title: publishTitle,
    };
  }, [publishDescription, publishHashtags, publishMode, publishScheduledAtInput, publishTitle]);

  useEffect(() => {
    if (!isPublishPlannerOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !publishPlannerTriggerRef.current?.contains(target) &&
        !publishPlannerPopoverRef.current?.contains(target)
      ) {
        setIsPublishPlannerOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPublishPlannerOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPublishPlannerOpen]);

  useLayoutEffect(() => {
    if (!isPublishPlannerOpen) {
      setPublishPlannerStyle(null);
      return undefined;
    }

    const updatePlannerPosition = () => {
      const triggerRect = publishPlannerTriggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      setPublishPlannerStyle(
        getStudioCompactMenuStyle({
          estimatedMenuHeight: 452,
          minWidth: 344,
          preferredWidth: 416,
          triggerRect,
        }),
      );
    };

    updatePlannerPosition();

    window.addEventListener("resize", updatePlannerPosition);
    window.addEventListener("scroll", updatePlannerPosition, true);

    return () => {
      window.removeEventListener("resize", updatePlannerPosition);
      window.removeEventListener("scroll", updatePlannerPosition, true);
    };
  }, [isPublishPlannerOpen, publishCalendarMonth, publishScheduledAtInput]);

  const activateProjectPreview = (projectId: string, hasVideo: boolean) => {
    if (!hasVideo) return;
    setActiveProjectPreviewId(projectId);
  };

  const deactivateProjectPreview = (projectId: string) => {
    setActiveProjectPreviewId((current) => (current === projectId ? null : current));
  };

  const handleProjectCardBlur =
    (projectId: string) =>
    (event: ReactFocusEvent<HTMLElement>) => {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
        return;
      }

      deactivateProjectPreview(projectId);
    };

  const handleSubtitleStyleSelect = (styleId: StudioSubtitleStyleOption["id"]) => {
    setAreSubtitlesEnabled(true);
    setSelectedSubtitleStyleId(styleId);
    setSelectedSubtitleColorId((currentColorId) =>
      getStudioSubtitleColorAfterStyleChange({
        currentColorId,
        currentStyleId: selectedSubtitleStyleId,
        nextStyleId: styleId,
        subtitleColorOptions,
        subtitleStyleOptions,
      }),
    );
  };

  const handleSubtitleToggle = (enabled: boolean) => {
    setAreSubtitlesEnabled(enabled);
  };

  const handleVoiceToggle = (enabled: boolean) => {
    setIsVoiceoverEnabled(enabled);
  };

  const handleVoiceSelect = (voiceId: StudioVoiceOption["id"]) => {
    setIsVoiceoverEnabled(true);
    setSelectedVoiceId(voiceId);
  };

  const handleVideoModeSelect = (videoMode: StudioVideoMode) => {
    setSelectedVideoMode(videoMode);
    setVideoSelectionError(null);
  };

  const handleCustomVideoSelect = async (file: File) => {
    if (!isSupportedStudioVideoFile(file.name)) {
      setVideoSelectionError("Поддерживаются .jpg, .jpeg, .png, .webp, .avif, .mp4, .mov, .webm и .m4v.");
      return;
    }

    if (file.size > STUDIO_CUSTOM_VIDEO_MAX_BYTES) {
      setVideoSelectionError("Файл слишком большой. Максимум 48 МБ.");
      return;
    }

    setIsPreparingCustomVideo(true);
    setVideoSelectionError(null);

    try {
      setSelectedCustomVideo({
        file,
        fileName: file.name,
        fileSize: file.size,
        mimeType: getWorkspaceSegmentCustomVisualMimeType(file),
        objectUrl: createStudioObjectUrl(file),
      });
      setSelectedVideoMode("custom");
    } catch (error) {
      setVideoSelectionError(error instanceof Error ? error.message : "Не удалось подготовить визуал.");
    } finally {
      setIsPreparingCustomVideo(false);
    }
  };

  const handleBrandLogoSelect = async (file: File) => {
    if (!isSupportedStudioBrandLogoFile(file.name)) {
      setBrandSelectionError("Поддерживаются .jpg, .jpeg, .png, .webp и .avif.");
      return;
    }

    if (file.size > STUDIO_BRAND_LOGO_MAX_BYTES) {
      setBrandSelectionError("Логотип слишком большой. Максимум 12 МБ.");
      return;
    }

    setIsPreparingBrandLogo(true);
    setBrandSelectionError(null);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSelectedBrandLogo({
        dataUrl,
        file,
        fileName: file.name,
        fileSize: file.size,
        mimeType: getStudioBrandLogoMimeType(file),
        objectUrl: createStudioObjectUrl(file),
      });
    } catch (error) {
      setBrandSelectionError(error instanceof Error ? error.message : "Не удалось подготовить логотип.");
    } finally {
      setIsPreparingBrandLogo(false);
    }
  };

  const handleRemoveBrandLogo = () => {
    setSelectedBrandLogo(null);
    setBrandSelectionError(null);
  };

  const handleBrandTextChange = (value: string) => {
    setBrandText(value.slice(0, STUDIO_BRAND_TEXT_MAX_CHARS));
    setBrandSelectionError(null);
  };

  const handleClearBrandText = () => {
    setBrandText("");
    setBrandSelectionError(null);
  };

  const handleMusicTypeSelect = (musicType: StudioMusicType) => {
    setSelectedMusicType(musicType);
    setMusicSelectionError(null);
  };

  const handleCustomMusicSelect = async (file: File) => {
    if (!isSupportedStudioMusicFile(file.name)) {
      setMusicSelectionError("Поддерживаются только .mp3, .wav и .m4a.");
      return false;
    }

    if (file.size > STUDIO_CUSTOM_MUSIC_MAX_BYTES) {
      setMusicSelectionError("Аудиофайл слишком большой. Максимум 18 МБ.");
      return false;
    }

    setIsPreparingCustomMusic(true);
    setMusicSelectionError(null);

    try {
      setSelectedCustomMusic({
        file,
        fileName: file.name,
        fileSize: file.size,
        objectUrl: createStudioObjectUrl(file),
      });
      setSelectedMusicType("custom");
      return true;
    } catch (error) {
      setMusicSelectionError(error instanceof Error ? error.message : "Не удалось подготовить аудиофайл.");
      return false;
    } finally {
      setIsPreparingCustomMusic(false);
    }
  };

  const getStudioLanguageForVoiceId = (voiceId: string | null | undefined): StudioLanguage | null => {
    const normalizedVoiceId = String(voiceId ?? "").trim();
    if (!normalizedVoiceId || normalizedVoiceId === "none") {
      return null;
    }

    for (const language of Object.keys(studioVoiceOptionsByLanguage) as StudioLanguage[]) {
      if (studioVoiceOptionsByLanguage[language].some((voice) => voice.id === normalizedVoiceId)) {
        return language;
      }
    }

    return null;
  };

  const getSegmentEditorProjectPrefillSettings = (
    projectId: number | null | undefined,
  ): ExamplePrefillStudioSettings | null => {
    const normalizedProjectId = Number(projectId);
    if (!Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
      return null;
    }

    return (
      projects.find((project) => project.adId === normalizedProjectId)?.prefillSettings ??
      (generatedVideo?.adId === normalizedProjectId ? generatedVideo.prefillSettings ?? null : null)
    );
  };

  const syncStudioSettingsFromSegmentEditorDraft = (
    draft: WorkspaceSegmentEditorDraftSession,
    projectSettings?: ExamplePrefillStudioSettings | null,
  ) => {
    const draftMusicType = normalizeWorkspaceSegmentEditorSetting(draft.musicType);
    const draftSubtitleType = normalizeWorkspaceSegmentEditorSetting(draft.subtitleType);
    const draftSubtitleStyleId = normalizeWorkspaceSegmentEditorSetting(draft.subtitleStyle);
    const draftSubtitleColorId = normalizeWorkspaceSegmentEditorSetting(draft.subtitleColor);
    const draftVoiceId = normalizeWorkspaceSegmentEditorSetting(draft.voiceType);
    const projectVoiceId = typeof projectSettings?.voiceId === "string" ? projectSettings.voiceId.trim() : "";
    const nextLanguage =
      projectSettings?.language === "ru" || projectSettings?.language === "en"
        ? projectSettings.language
        : getStudioLanguageForVoiceId(draftVoiceId) ?? getStudioLanguageForVoiceId(projectVoiceId) ?? selectedLanguage;
    const nextVoiceOptions = studioVoiceOptionsByLanguage[nextLanguage];
    const nextVoiceId =
      nextVoiceOptions.find((voice) => voice.id === draftVoiceId)?.id ??
      nextVoiceOptions.find((voice) => voice.id === projectVoiceId)?.id ??
      nextVoiceOptions.find((voice) => voice.id === selectedVoiceId)?.id ??
      nextVoiceOptions[0]?.id ??
      "";
    const nextMusicType =
      studioMusicOptions.find((option) => option.id === draftMusicType)?.id ??
      (typeof projectSettings?.musicType === "string"
        ? studioMusicOptions.find((option) => option.id === projectSettings.musicType)?.id
        : undefined);
    const nextSubtitleStyleId =
      (draftSubtitleStyleId && subtitleStyleOptions.some((style) => style.id === draftSubtitleStyleId)
        ? draftSubtitleStyleId
        : null) ??
      (typeof projectSettings?.subtitleStyleId === "string" ? projectSettings.subtitleStyleId.trim() : "");
    const nextSubtitleColorId =
      (draftSubtitleColorId && subtitleColorOptions.some((color) => color.id === draftSubtitleColorId)
        ? draftSubtitleColorId
        : null) ??
      (typeof projectSettings?.subtitleColorId === "string" ? projectSettings.subtitleColorId.trim() : "");

    setSelectedLanguage(nextLanguage);

    if (nextVoiceId) {
      setSelectedVoiceId(nextVoiceId);
    }

    if (nextMusicType && nextMusicType !== "custom") {
      setSelectedMusicType(nextMusicType as StudioMusicType);
      setSelectedCustomMusic(null);
      setMusicSelectionError(null);
    }

    setAreSubtitlesEnabled(draftSubtitleType !== "none");

    if (nextSubtitleStyleId) {
      setSelectedSubtitleStyleId(nextSubtitleStyleId);
    }

    if (nextSubtitleColorId) {
      setSelectedSubtitleColorId(nextSubtitleColorId);
    }

    setIsVoiceoverEnabled(draftVoiceId !== "none");

    if (
      typeof projectSettings?.videoMode === "string" &&
      projectSettings.videoMode !== "custom" &&
      studioVideoOptions.some((option) => option.id === projectSettings.videoMode)
    ) {
      setSelectedVideoMode(projectSettings.videoMode);
      setSelectedCustomVideo(null);
      setVideoSelectionError(null);
    }
  };

  const lockSegmentEditorPromptHeight = () => {
    const nextPromptHeight = promptInnerRef.current?.getBoundingClientRect().height ?? 0;
    setSegmentEditorPanelHeightLock(nextPromptHeight > 0 ? Math.ceil(nextPromptHeight) : null);
  };

  const stashCurrentSegmentEditorDraft = () => {
    if (!segmentEditorDraft) {
      return;
    }

    detachedSegmentEditorDraftRef.current = {
      activeSegmentIndex,
      draft: cloneWorkspaceSegmentEditorDraftSession(segmentEditorDraft),
    };
  };

  const clearDetachedSegmentEditorDraft = () => {
    detachedSegmentEditorDraftRef.current = null;
  };

  const cancelPendingSegmentEditorLoad = (reason = "segment-editor-hidden") => {
    const controller = segmentEditorRequestAbortRef.current;
    if (!controller) {
      setIsSegmentEditorLoading(false);
      return;
    }

    segmentEditorRunRef.current += 1;
    segmentEditorRequestAbortRef.current = null;
    controller.abort(reason);
    setIsSegmentEditorLoading(false);
  };

  const openSegmentEditorWithDraft = (
    nextDraft: WorkspaceSegmentEditorDraftSession,
    options?: { initialSegmentIndex?: number; initialSegmentMode?: "array" | "route" },
  ) => {
    const nextDraftSnapshot = cloneWorkspaceSegmentEditorDraftSession(nextDraft);
    logSegmentEditorDiagnostics(
      "client.segment-editor.open-draft",
      {
        initialSegmentIndex: options?.initialSegmentIndex ?? 0,
      },
      {
        includeOrder: true,
        draft: nextDraftSnapshot,
      },
    );
    lockSegmentEditorPromptHeight();
    resetSegmentEditorPreviewPlaybackState({ clearRefs: true });
    syncStudioSettingsFromSegmentEditorDraft(
      nextDraftSnapshot,
      getSegmentEditorProjectPrefillSettings(nextDraftSnapshot.projectId),
    );
    segmentEditorDraftRef.current = nextDraftSnapshot;
    setSegmentEditorDraft(nextDraftSnapshot);
    setSegmentEditorVideoError(null);
    segmentAiPhotoRunRef.current += 1;
    setIsSegmentEditorGeneratingAiPhoto(false);
    segmentImageUpscaleRunRef.current += 1;
    setIsSegmentEditorUpscalingImage(false);
    setSegmentEditorUpscalingImageSegmentIndex(null);
    const boundedSegmentIndex =
      options?.initialSegmentMode === "route"
        ? resolveSegmentEditorArrayIndexFromRouteSegment(nextDraftSnapshot, options?.initialSegmentIndex ?? 0)
        : Math.max(0, Math.min(options?.initialSegmentIndex ?? 0, Math.max(0, nextDraftSnapshot.segments.length - 1)));
    const initialSegment = nextDraftSnapshot.segments[boundedSegmentIndex];
    setActiveSegmentIndex(boundedSegmentIndex);
    setSegmentEditorPromptSceneMode("create");
    if (initialSegment) {
      setSegmentAiPhotoModalTab(resolveWorkspaceSegmentVisualModalTab(initialSegment, "ai_photo"));
    } else {
      setSegmentAiPhotoModalTab("ai_photo");
    }
    setCreateMode("segment-editor");
  };

  const ensureSegmentEditorDraftForProject = async (
    projectId: number,
    options?: {
      initialSegmentIndex?: number;
      initialSegmentMode?: "array" | "route";
      bypassCache?: boolean;
      forceRefresh?: boolean;
      openDraft?: boolean;
      replaceRoute?: boolean;
      syncRoute?: boolean;
    },
  ) => {
    const requestedSegmentIndex = options?.initialSegmentIndex ?? 0;
    segmentEditorRouteRestoreKeyRef.current = `${projectId}:${requestedSegmentIndex}`;

    logSegmentEditorDiagnostics("client.segment-editor.load.start", {
      openDraft: options?.openDraft ?? true,
      projectId,
      replaceRoute: options?.replaceRoute ?? false,
      requestedSegmentIndex,
      syncRoute: options?.syncRoute ?? true,
    });

    setSegmentEditorError(null);
    setSegmentEditorVideoError(null);

    if (options?.syncRoute !== false) {
      syncStudioRouteSection("edit", {
        projectId,
        replace: options?.replaceRoute ?? false,
        segmentIndex: requestedSegmentIndex,
      });
    }

    if (segmentEditorDraft?.projectId === projectId && !options?.forceRefresh) {
      logSegmentEditorDiagnostics("client.segment-editor.load.reuse-active-draft", {
        projectId,
        requestedSegmentIndex,
      });
      if (options?.openDraft !== false) {
        openSegmentEditorWithDraft(segmentEditorDraft, {
          initialSegmentIndex: options?.initialSegmentIndex,
          initialSegmentMode: options?.initialSegmentMode,
        });
      }
      return segmentEditorDraft;
    }

    const restoredDetachedDraftState =
      detachedSegmentEditorDraftRef.current?.draft.projectId === projectId
        ? detachedSegmentEditorDraftRef.current
        : null;
    const restoredDetachedDraft = Boolean(restoredDetachedDraftState);
    if (restoredDetachedDraftState) {
      const restoredDraft = hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary(
        cloneWorkspaceSegmentEditorDraftSession(restoredDetachedDraftState.draft),
        generatedMediaLibraryEntries,
      );
      if (!restoredDraft) {
        return null;
      }
      logSegmentEditorDiagnostics(
        "client.segment-editor.load.restore-detached-draft",
        {
          projectId,
          requestedSegmentIndex,
          restoredActiveSegmentIndex: restoredDetachedDraftState.activeSegmentIndex,
        },
        {
          includeOrder: true,
          draft: restoredDraft,
        },
      );
      if (options?.openDraft !== false) {
        openSegmentEditorWithDraft(restoredDraft, {
          initialSegmentIndex: options?.initialSegmentIndex ?? restoredDetachedDraftState.activeSegmentIndex,
          initialSegmentMode: options?.initialSegmentIndex === undefined ? "array" : options?.initialSegmentMode,
        });
      }
    }

    const storedDraft = restoredDetachedDraft
      ? null
      : hydrateWorkspaceSegmentEditorDraftFromGeneratedMediaLibrary(
          readStoredWorkspaceSegmentEditorDraft(session.email, projectId),
          generatedMediaLibraryEntries,
        );
    const restoredStoredDraft = Boolean(storedDraft && options?.openDraft !== false);
    if (restoredStoredDraft && storedDraft) {
      logSegmentEditorDiagnostics(
        "client.segment-editor.load.restore-stored-draft",
        {
          projectId,
          requestedSegmentIndex,
        },
        {
          includeOrder: true,
          draft: storedDraft,
        },
      );
      openSegmentEditorWithDraft(storedDraft, {
        initialSegmentIndex: options?.initialSegmentIndex,
        initialSegmentMode: options?.initialSegmentMode,
      });
    }

    if (!restoredDetachedDraft && !restoredStoredDraft && !options?.forceRefresh && currentAppliedSegmentEditorSession?.projectId === projectId) {
      logSegmentEditorDiagnostics(
        "client.segment-editor.load.reuse-applied-session",
        {
          projectId,
          requestedSegmentIndex,
        },
        {
          includeOrder: true,
          draft: currentAppliedSegmentEditorSession,
        },
      );
      if (options?.openDraft !== false) {
        openSegmentEditorWithDraft(currentAppliedSegmentEditorSession, {
          initialSegmentIndex: options?.initialSegmentIndex,
          initialSegmentMode: options?.initialSegmentMode,
        });
      }
      return currentAppliedSegmentEditorSession;
    }

    if (!restoredDetachedDraft && !restoredStoredDraft && !options?.forceRefresh && segmentEditorLoadedSession?.projectId === projectId) {
      const nextDraft = createWorkspaceSegmentEditorDraftSession(segmentEditorLoadedSession);
      logSegmentEditorDiagnostics(
        "client.segment-editor.load.reuse-loaded-session",
        {
          projectId,
          requestedSegmentIndex,
        },
        {
          includeOrder: true,
          draft: nextDraft,
        },
      );
      if (options?.openDraft !== false) {
        openSegmentEditorWithDraft(nextDraft, {
          initialSegmentIndex: options?.initialSegmentIndex,
          initialSegmentMode: options?.initialSegmentMode,
        });
      }
      return nextDraft;
    }

    segmentEditorRunRef.current += 1;
    const runId = segmentEditorRunRef.current;
    segmentEditorRequestAbortRef.current?.abort("segment-editor-replaced");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort("segment-editor-timeout"), SEGMENT_EDITOR_REQUEST_TIMEOUT_MS);
    segmentEditorRequestAbortRef.current = controller;
    setIsSegmentEditorLoading(true);

    try {
      const response = await fetch(
        `/api/workspace/projects/${projectId}/segment-editor${options?.bypassCache || options?.forceRefresh ? "?refresh=1" : ""}`,
        {
        signal: controller.signal,
        },
      );
      const payload = (await response.json().catch(() => null)) as WorkspaceSegmentEditorResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Не удалось загрузить сегменты проекта.");
      }

      if (segmentEditorRunRef.current !== runId) {
        return;
      }

      const normalizedSessionPayload = normalizeWorkspaceSegmentEditorSession(payload.data);
      const normalizedSession =
        normalizedSessionPayload.projectId === projectId
          ? normalizedSessionPayload
          : {
              ...normalizedSessionPayload,
              projectId,
              segments: normalizedSessionPayload.segments.map((segment) => ({
                  ...segment,
                  currentPlaybackUrl: rewriteWorkspaceSegmentProjectProxyUrl(segment.currentPlaybackUrl, projectId),
                  currentPreviewUrl: rewriteWorkspaceSegmentProjectProxyUrl(segment.currentPreviewUrl, projectId),
                  originalPlaybackUrl: rewriteWorkspaceSegmentProjectProxyUrl(segment.originalPlaybackUrl, projectId),
                  originalPreviewUrl: rewriteWorkspaceSegmentProjectProxyUrl(segment.originalPreviewUrl, projectId),
                })),
            };
      setSegmentEditorLoadedSession(normalizedSession);
      const nextDraft = createWorkspaceSegmentEditorDraftSession(normalizedSession);
      const liveDraft = segmentEditorDraftRef.current;

      if (liveDraft?.projectId === projectId) {
        const refreshedLiveDraft = refreshWorkspaceSegmentEditorDraftWithFreshSession(liveDraft, normalizedSession, {
          baselineSession: segmentEditorLoadedSession?.projectId === projectId ? segmentEditorLoadedSession : null,
        });
        logSegmentEditorDiagnostics(
          "client.segment-editor.load.preserve-live-draft-after-fetch",
          {
            projectId,
            requestedSegmentIndex,
            segmentCount: refreshedLiveDraft.segments.length,
          },
          {
            includeOrder: true,
            draft: refreshedLiveDraft,
          },
        );
        setSegmentEditorDraft(refreshedLiveDraft);
        return refreshedLiveDraft;
      }

      logSegmentEditorDiagnostics(
        "client.segment-editor.load.success",
        {
          projectId,
          requestedSegmentIndex,
          segmentCount: nextDraft.segments.length,
        },
        {
          includeOrder: true,
          draft: nextDraft,
        },
      );
      if (options?.openDraft !== false) {
        openSegmentEditorWithDraft(nextDraft, {
          initialSegmentIndex: options?.initialSegmentIndex,
          initialSegmentMode: options?.initialSegmentMode,
        });
      }
      return nextDraft;
    } catch (error) {
      if (controller.signal.aborted) {
        logSegmentEditorDiagnostics(
          "client.segment-editor.load.aborted",
          {
            projectId,
            reason: String(controller.signal.reason ?? "aborted"),
            requestedSegmentIndex,
          },
          {
            level: controller.signal.reason === "segment-editor-timeout" ? "warn" : "info",
          },
        );
        if (controller.signal.reason === "segment-editor-timeout" && segmentEditorRunRef.current === runId) {
          setSegmentEditorError("Сегменты загружаются слишком долго. Попробуйте ещё раз.");
        }

        return null;
      }

      if (segmentEditorRunRef.current !== runId) {
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : "Не удалось открыть редактор Shorts.";
      logSegmentEditorDiagnostics(
        "client.segment-editor.load.error",
        {
          error: errorMessage,
          projectId,
          requestedSegmentIndex,
        },
        {
          level: "error",
        },
      );
      setSegmentEditorError(
        isWorkspaceSegmentEditorNotFoundError(errorMessage)
          ? "Для этого проекта сегменты пока недоступны."
          : errorMessage,
      );
      return null;
    } finally {
      window.clearTimeout(timeoutId);
      if (segmentEditorRequestAbortRef.current === controller) {
        segmentEditorRequestAbortRef.current = null;
      }
      if (segmentEditorRunRef.current === runId) {
        setIsSegmentEditorLoading(false);
      }
    }
  };

  const handleOpenSegmentEditor = async (initialSegmentIndex = 0) => {
    const projectId = generatedVideo?.adId ?? null;

    if (!projectId) {
      setSegmentEditorError("Редактор Shorts доступен только для сохранённого проекта.");
      return;
    }

    await ensureSegmentEditorDraftForProject(projectId, { initialSegmentIndex });
  };

  const handleStudioCreateModeSwitch = async (nextMode: StudioCreateMode) => {
    if (nextMode === createMode) {
      return;
    }

    if (nextMode === "default") {
      closeSegmentAiPhotoModal();
      resetSegmentEditorPreviewPlaybackState({ clearRefs: true });
      setCreateMode("default");
      return;
    }

    if (segmentEditorDraft) {
      lockSegmentEditorPromptHeight();
      const segment = segmentEditorDraft.segments[activeSegmentIndex];
      setSegmentEditorPromptSceneMode("create");
      if (segment) {
        setSegmentAiPhotoModalTab(resolveWorkspaceSegmentVisualModalTab(segment, "ai_photo"));
      } else {
        setSegmentAiPhotoModalTab("ai_photo");
      }
      setCreateMode("segment-editor");
      return;
    }

    await handleOpenSegmentEditor();
  };

  const handleStudioTopMenuSelect = (section: StudioEntryIntentSection) => {
    setActiveTab("studio");

    if (section === "projects") {
      markPendingStudioRouteSection("projects");
      flushSync(() => {
        cancelPendingSegmentEditorLoad();
        stashCurrentSegmentEditorDraft();
        segmentEditorRouteRestoreKeyRef.current = null;
        segmentEditorHandledRouteRestoreKeyRef.current = null;
        setSegmentEditorDraft(null);
        setCreateMode("default");
        setStudioView("projects");
      });
      syncStudioRouteSection("projects");
      return;
    }

    if (section === "media") {
      markPendingStudioRouteSection("media");
      flushSync(() => {
        cancelPendingSegmentEditorLoad();
        stashCurrentSegmentEditorDraft();
        segmentEditorRouteRestoreKeyRef.current = null;
        segmentEditorHandledRouteRestoreKeyRef.current = null;
        setSegmentEditorDraft(null);
        setCreateMode("default");
        setStudioView("media");
      });
      syncStudioRouteSection("media");
      return;
    }

    if (section !== "edit") {
      markPendingStudioRouteSection("create");
    }
    setStudioView("create");

    if (section === "edit") {
      void handleStudioCreateModeSwitch("segment-editor");
      return;
    }

    cancelPendingSegmentEditorLoad();
    stashCurrentSegmentEditorDraft();
    segmentEditorRouteRestoreKeyRef.current = null;
    segmentEditorHandledRouteRestoreKeyRef.current = null;
    setSegmentEditorDraft(null);
    syncStudioRouteSection("create");
    void handleStudioCreateModeSwitch("default");
  };

  useEffect(() => {
    if (!location.pathname.startsWith("/app/studio")) {
      segmentEditorRouteRestoreKeyRef.current = null;
      segmentEditorHandledRouteRestoreKeyRef.current = null;
      return;
    }

    if (pendingStudioRouteSectionRef.current && pendingStudioRouteSectionRef.current !== "edit") {
      return;
    }

    if (routeStudioState.section !== "edit" || !routeStudioState.projectId) {
      segmentEditorRouteRestoreKeyRef.current = null;
      segmentEditorHandledRouteRestoreKeyRef.current = null;
      return;
    }

    const requestedSegmentIndex = routeStudioState.segmentIndex ?? 0;
    const restoreKey = `${routeStudioState.projectId}:${requestedSegmentIndex}`;

    logSegmentEditorDiagnostics("client.segment-editor.route.restore-check", {
      requestedProjectId: routeStudioState.projectId,
      requestedSegmentIndex,
      restoreKey,
    });

    setActiveTab("studio");
    setStudioView("create");

    if (segmentEditorDraft?.projectId === routeStudioState.projectId) {
      if (createMode !== "segment-editor") {
        segmentEditorRouteRestoreKeyRef.current = restoreKey;
        segmentEditorHandledRouteRestoreKeyRef.current = restoreKey;
        openSegmentEditorWithDraft(segmentEditorDraft, {
          initialSegmentIndex: requestedSegmentIndex,
          initialSegmentMode: "route",
        });
        return;
      }

      if (segmentEditorHandledRouteRestoreKeyRef.current !== restoreKey) {
        segmentEditorRouteRestoreKeyRef.current = restoreKey;
        const boundedSegmentIndex = resolveSegmentEditorArrayIndexFromRouteSegment(
          segmentEditorDraft,
          requestedSegmentIndex,
        );
        setActiveSegmentIndex((current) => (current === boundedSegmentIndex ? current : boundedSegmentIndex));
        segmentEditorHandledRouteRestoreKeyRef.current = restoreKey;
      }
      return;
    }

    const storedDraft = readStoredWorkspaceSegmentEditorDraft(session.email, routeStudioState.projectId);
    const storedSession =
      segmentEditorLoadedSession?.projectId === routeStudioState.projectId
        ? segmentEditorLoadedSession
        : readStoredWorkspaceSegmentEditorSession(session.email, routeStudioState.projectId);

    if (storedDraft) {
      segmentEditorRouteRestoreKeyRef.current = restoreKey;
      segmentEditorHandledRouteRestoreKeyRef.current = restoreKey;

      if (storedSession && segmentEditorLoadedSession?.projectId !== storedSession.projectId) {
        setSegmentEditorLoadedSession(storedSession);
      }

      openSegmentEditorWithDraft(storedDraft, {
        initialSegmentIndex: requestedSegmentIndex,
        initialSegmentMode: "route",
      });
      void ensureSegmentEditorDraftForProject(routeStudioState.projectId, {
        initialSegmentIndex: requestedSegmentIndex,
        initialSegmentMode: "route",
        openDraft: false,
        replaceRoute: true,
      });
      return;
    }

    if (storedSession) {
      segmentEditorRouteRestoreKeyRef.current = restoreKey;
      segmentEditorHandledRouteRestoreKeyRef.current = restoreKey;

      if (segmentEditorLoadedSession?.projectId !== storedSession.projectId) {
        setSegmentEditorLoadedSession(storedSession);
      }

      openSegmentEditorWithDraft(createWorkspaceSegmentEditorDraftSession(storedSession), {
        initialSegmentIndex: requestedSegmentIndex,
        initialSegmentMode: "route",
      });
      void ensureSegmentEditorDraftForProject(routeStudioState.projectId, {
        initialSegmentIndex: requestedSegmentIndex,
        initialSegmentMode: "route",
        openDraft: false,
        replaceRoute: true,
      });
      return;
    }

    if (segmentEditorRouteRestoreKeyRef.current === restoreKey) {
      return;
    }

    segmentEditorRouteRestoreKeyRef.current = restoreKey;
    segmentEditorHandledRouteRestoreKeyRef.current = null;
    void ensureSegmentEditorDraftForProject(routeStudioState.projectId, {
      initialSegmentIndex: requestedSegmentIndex,
      initialSegmentMode: "route",
      replaceRoute: true,
    });
  }, [
    createMode,
    location.pathname,
    routeStudioState.projectId,
    routeStudioState.section,
    routeStudioState.segmentIndex,
    segmentEditorLoadedSession,
    segmentEditorDraft,
    session.email,
  ]);

  useEffect(() => {
    if (!location.pathname.startsWith("/app/studio") || routeStudioState.section !== "edit") {
      return;
    }

    const routeRestoreKey = routeStudioState.projectId ? `${routeStudioState.projectId}:${routeStudioState.segmentIndex ?? 0}` : null;
    if (routeRestoreKey && segmentEditorRouteRestoreKeyRef.current === routeRestoreKey) {
      return;
    }

    if (activeTab === "studio" && studioView === "create" && createMode === "segment-editor") {
      return;
    }

    syncStudioRouteSection(activeTab === "studio" ? (studioView === "projects" ? "projects" : studioView === "media" ? "media" : "create") : "create", {
      replace: true,
    });
  }, [
    activeTab,
    createMode,
    location.pathname,
    routeStudioState.projectId,
    routeStudioState.section,
    routeStudioState.segmentIndex,
    studioView,
  ]);

  const updateActiveSegmentDraft = (
    updater: (segment: WorkspaceSegmentEditorDraftSegment) => WorkspaceSegmentEditorDraftSegment,
  ) => {
    setSegmentEditorDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        segments: currentDraft.segments.map((segment, index) => (index === activeSegmentIndex ? updater(segment) : segment)),
      };
    });
  };

  const updateSegmentEditorDraftSegmentByIndex = (
    targetSegmentIndex: number,
    updater: (segment: WorkspaceSegmentEditorDraftSegment) => WorkspaceSegmentEditorDraftSegment,
  ) => {
    updateSegmentEditorDraft((currentDraft) => ({
      ...currentDraft,
      segments: currentDraft.segments.map((segment) =>
        segment.index === targetSegmentIndex ? updater(segment) : segment,
      ),
    }));
  };

  const updateSegmentEditorDraft = (
    updater: (draft: WorkspaceSegmentEditorDraftSession) => WorkspaceSegmentEditorDraftSession,
  ) => {
    setSegmentEditorDraft((currentDraft) => {
      if (!currentDraft) {
        segmentEditorDraftRef.current = currentDraft;
        return currentDraft;
      }

      const nextDraft = updater(currentDraft);
      segmentEditorDraftRef.current = nextDraft;
      return nextDraft;
    });
  };

  const handleAddSegmentEditorSegment = () => {
    if (!segmentEditorDraft) {
      return;
    }

    if (segmentEditorDraft.segments.length >= WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS) {
      setSegmentEditorVideoError(`Можно добавить максимум ${WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS} сегментов.`);
      return;
    }

    const insertAt = segmentEditorDraft.segments.length;
    logSegmentEditorDiagnostics("client.segment-editor.structure.add", {
      insertAt,
      segmentCountBefore: segmentEditorDraft.segments.length,
    }, { includeOrder: true });
    resetSegmentEditorPreviewPlaybackState();
    setSegmentEditorVideoError(null);
    const nextSegment = createWorkspaceSegmentEditorInsertedSegment({
      draft: segmentEditorDraft,
      insertAt,
      sourceSegment: segmentEditorDraft.segments[segmentEditorDraft.segments.length - 1] ?? null,
    });
    const nextSegments = rebuildWorkspaceSegmentEditorDraftTimeline([...segmentEditorDraft.segments, nextSegment]);
    updateSegmentEditorDraft((currentDraft) => {
      if (currentDraft.segments.length >= WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        segments: rebuildWorkspaceSegmentEditorDraftTimeline([
          ...currentDraft.segments,
          cloneWorkspaceSegmentEditorDraftSegment(nextSegment),
        ]),
      };
    });
    syncSegmentEditorRouteForArrayIndex({ projectId: segmentEditorDraft.projectId, segments: nextSegments }, insertAt);
    setActiveSegmentIndex(insertAt);
  };

  const handleDeleteSegmentEditorSegment = (targetSegmentIndex: number) => {
    if (!segmentEditorDraft) {
      return;
    }

    if (segmentEditorDraft.segments.length <= WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS) {
      setSegmentEditorVideoError(`В редакторе должен остаться минимум ${WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS} сегмент.`);
      return;
    }

    const targetSegmentArrayIndex = segmentEditorDraft.segments.findIndex((segment) => segment.index === targetSegmentIndex);
    if (targetSegmentArrayIndex < 0) {
      return;
    }

    const targetSegment = segmentEditorDraft.segments[targetSegmentArrayIndex] ?? null;
    if (!targetSegment) {
      return;
    }

    logSegmentEditorDiagnostics("client.segment-editor.structure.delete", {
      segmentCountBefore: segmentEditorDraft.segments.length,
      targetSegmentArrayIndex,
      targetSegmentIndex,
    }, { includeOrder: true });

    resetSegmentEditorPreviewPlaybackState();
    setSegmentEditorVideoError(null);
    if (segmentAiPhotoModalSegmentIndex === targetSegment.index) {
      closeSegmentAiPhotoModal();
    }

    const nextSegments = rebuildWorkspaceSegmentEditorDraftTimeline(
      segmentEditorDraft.segments.filter((segment) => segment.index !== targetSegment.index),
    );

    updateSegmentEditorDraft((currentDraft) => {
      if (currentDraft.segments.length <= WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        segments: rebuildWorkspaceSegmentEditorDraftTimeline(
          currentDraft.segments.filter((segment) => segment.index !== targetSegment.index),
        ),
      };
    });
    const nextActiveSegmentArrayIndex = (() => {
      const boundedCurrentIndex = Math.max(0, Math.min(activeSegmentIndex, segmentEditorDraft.segments.length - 1));
      if (boundedCurrentIndex > targetSegmentArrayIndex) {
        return boundedCurrentIndex - 1;
      }

      if (boundedCurrentIndex === targetSegmentArrayIndex) {
        return Math.max(0, Math.min(targetSegmentArrayIndex, segmentEditorDraft.segments.length - 2));
      }

      return boundedCurrentIndex;
    })();
    syncSegmentEditorRouteForArrayIndex(
      {
        projectId: segmentEditorDraft.projectId,
        segments: nextSegments,
      },
      nextActiveSegmentArrayIndex,
    );
    setActiveSegmentIndex(nextActiveSegmentArrayIndex);
  };

  const handleSegmentEditorSubtitleColorSelect = (colorId: StudioSubtitleColorOption["id"]) => {
    updateSegmentEditorDraft((currentDraft) => ({
      ...currentDraft,
      subtitleColor: colorId,
    }));
  };

  const handleSegmentEditorSubtitleToggle = (enabled: boolean) => {
    updateSegmentEditorDraft((currentDraft) => ({
      ...currentDraft,
      subtitleType: enabled
        ? normalizeWorkspaceSegmentEditorSetting(currentDraft.subtitleType) === "none"
          ? "default"
          : currentDraft.subtitleType || "default"
        : "none",
    }));
  };

  const handleSegmentEditorSubtitleStyleSelect = (styleId: StudioSubtitleStyleOption["id"]) => {
    updateSegmentEditorDraft((currentDraft) => {
      const currentStyleId = normalizeWorkspaceSegmentEditorSetting(currentDraft.subtitleStyle) ?? studioSidebarSubtitleStyleId;
      const currentColorId = normalizeWorkspaceSegmentEditorSetting(currentDraft.subtitleColor) ?? studioSidebarSubtitleColorId;
      const nextColorId = getStudioSubtitleColorAfterStyleChange({
        currentColorId,
        currentStyleId,
        nextStyleId: styleId,
        subtitleColorOptions,
        subtitleStyleOptions,
      });

      return {
        ...currentDraft,
        subtitleColor: nextColorId,
        subtitleStyle: styleId,
        subtitleType:
          normalizeWorkspaceSegmentEditorSetting(currentDraft.subtitleType) === "none"
            ? "default"
            : currentDraft.subtitleType || "default",
      };
    });
  };

  const translateSegmentEditorTexts = async (
    texts: string[],
    sourceLanguage: StudioLanguage,
    targetLanguage: StudioLanguage,
  ) => {
    if (sourceLanguage === targetLanguage || texts.length === 0) {
      return texts;
    }

    const response = await fetch("/api/studio/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceLanguage,
        targetLanguage,
        texts,
      } satisfies WorkspaceSegmentTextTranslateRequest),
    });
    const payload = (await response.json().catch(() => null)) as WorkspaceSegmentTextTranslateResponse | null;
    const translatedTexts = Array.isArray(payload?.data?.texts) ? payload.data.texts : null;

    if (!response.ok || !translatedTexts || translatedTexts.length !== texts.length) {
      throw new Error(payload?.error ?? "Не удалось перевести текст сегментов.");
    }

    return translatedTexts.map((text, index) => (typeof text === "string" ? text : texts[index] ?? ""));
  };

  const handleSegmentEditorLanguageSelect = async (language: StudioLanguage) => {
    if (language === selectedLanguage) {
      return;
    }

    const previousLanguage = selectedLanguage;
    const previousVoiceId = resolvedSelectedVoiceId;
    const wasVoiceoverEnabledInDraft = !isCurrentDraftVoiceDisabled;
    setSelectedLanguage(language);
    setSegmentEditorError(null);

    const nextVoiceOptions = studioVoiceOptionsByLanguage[language];
    const nextVoiceId =
      nextVoiceOptions.find((voice) => voice.id === studioSidebarVoiceId)?.id ??
      nextVoiceOptions[0]?.id ??
      studioSidebarVoiceId;

    if (nextVoiceId) {
      setSelectedVoiceId(nextVoiceId);
      if (wasVoiceoverEnabledInDraft) {
        updateSegmentEditorDraft((currentDraft) => ({
          ...currentDraft,
          voiceType: nextVoiceId,
        }));
      }
    }

    const currentDraft = segmentEditorDraft;
    if (!currentDraft || currentDraft.segments.length === 0) {
      return;
    }

    const cachedLocalizedSegments = currentDraft.segments.map((segment) => ({
      originalText:
        typeof segment.originalTextByLanguage?.[language] === "string" ? segment.originalTextByLanguage[language] : null,
      text: typeof segment.textByLanguage?.[language] === "string" ? segment.textByLanguage[language] : null,
    }));
    const hasCachedTargetTexts = cachedLocalizedSegments.every((segment) => typeof segment.text === "string");

    if (hasCachedTargetTexts) {
      updateSegmentEditorDraft((draft) => ({
        ...draft,
        segments: draft.segments.map((segment, index) => ({
          ...segment,
          originalText:
            cachedLocalizedSegments[index]?.originalText ??
            segment.originalTextByLanguage?.[previousLanguage] ??
            segment.originalText,
          text: cachedLocalizedSegments[index]?.text ?? segment.text,
        })),
      }));
      return;
    }

    const translateRunId = segmentEditorLanguageTranslateRunRef.current + 1;
    segmentEditorLanguageTranslateRunRef.current = translateRunId;
    const sourceTexts = currentDraft.segments.map((segment) => segment.textByLanguage?.[previousLanguage] ?? segment.text);
    const sourceOriginalTexts = currentDraft.segments.map(
      (segment) => segment.originalTextByLanguage?.[previousLanguage] ?? segment.originalText,
    );

    try {
      const [translatedTexts, translatedOriginalTexts] = await Promise.all([
        translateSegmentEditorTexts(sourceTexts, previousLanguage, language),
        translateSegmentEditorTexts(sourceOriginalTexts, previousLanguage, language),
      ]);

      if (segmentEditorLanguageTranslateRunRef.current !== translateRunId) {
        return;
      }

      updateSegmentEditorDraft((draft) => ({
        ...draft,
        segments: draft.segments.map((segment, index) => {
          const currentLanguageText = segment.textByLanguage?.[previousLanguage] ?? segment.text;
          const currentLanguageOriginalText =
            segment.originalTextByLanguage?.[previousLanguage] ?? segment.originalText;
          const nextText = translatedTexts[index] ?? "";
          const nextOriginalText = translatedOriginalTexts[index] ?? nextText;

          return {
            ...segment,
            originalText: nextOriginalText,
            originalTextByLanguage: {
              ...segment.originalTextByLanguage,
              [previousLanguage]: currentLanguageOriginalText,
              [language]: nextOriginalText,
            },
            text: nextText,
            textByLanguage: {
              ...segment.textByLanguage,
              [previousLanguage]: currentLanguageText,
              [language]: nextText,
            },
          };
        }),
      }));
    } catch (error) {
      if (segmentEditorLanguageTranslateRunRef.current !== translateRunId) {
        return;
      }

      setSelectedLanguage(previousLanguage);
      if (previousVoiceId) {
        setSelectedVoiceId(previousVoiceId);
        if (wasVoiceoverEnabledInDraft) {
          updateSegmentEditorDraft((draft) => ({
            ...draft,
            voiceType: previousVoiceId,
          }));
        }
      }
      setSegmentEditorError(error instanceof Error ? error.message : "Не удалось перевести текст сегментов.");
    }
  };

  const handleSegmentEditorVoiceToggle = (enabled: boolean) => {
    updateSegmentEditorDraft((currentDraft) => ({
      ...currentDraft,
      voiceType: enabled ? studioSidebarVoiceId || resolvedSelectedVoiceId : "none",
    }));
  };

  const handleSegmentEditorVoiceSelect = (voiceId: StudioVoiceOption["id"]) => {
    setSelectedVoiceId(voiceId);
    updateSegmentEditorDraft((currentDraft) => ({
      ...currentDraft,
      voiceType: voiceId,
    }));
  };

  const handleSegmentEditorMusicTypeSelect = (musicType: StudioMusicType) => {
    handleMusicTypeSelect(musicType);
    updateSegmentEditorDraft((currentDraft) => ({
      ...currentDraft,
      musicType,
    }));
  };

  const handleSegmentEditorCustomMusicSelect = async (file: File) => {
    const didPrepareMusic = await handleCustomMusicSelect(file);

    if (!didPrepareMusic) {
      return;
    }

    updateSegmentEditorDraft((currentDraft) => ({
      ...currentDraft,
      customMusicAssetId: null,
      customMusicFileName: file.name,
      musicType: "custom",
    }));
  };

  const resetSegmentEditorSettingChange = (settingId: "music" | "subtitle" | "voice") => {
    const baselineSession = segmentEditorChecklistBaseSession;
    if (!baselineSession) {
      return;
    }

    if (settingId === "music") {
      const nextMusicType = normalizeWorkspaceSegmentEditorSetting(baselineSession.musicType) ?? "ai";
      setSelectedMusicType(nextMusicType as StudioMusicType);
      setSelectedCustomMusic(null);
      updateSegmentEditorDraft((currentDraft) => ({
        ...currentDraft,
        customMusicAssetId: baselineSession.customMusicAssetId ?? null,
        customMusicFileName: baselineSession.customMusicFileName ?? null,
        musicType: nextMusicType,
      }));
      return;
    }

    if (settingId === "subtitle") {
      const baselineSubtitleType = normalizeWorkspaceSegmentEditorSetting(baselineSession.subtitleType);
      const baselineSubtitleStyleId = normalizeWorkspaceSegmentEditorSetting(baselineSession.subtitleStyle) ?? selectedSubtitleStyleId;
      const baselineSubtitleColorId = normalizeWorkspaceSegmentEditorSetting(baselineSession.subtitleColor) ?? selectedSubtitleColorId;

      updateSegmentEditorDraft((currentDraft) => ({
        ...currentDraft,
        subtitleColor: baselineSubtitleColorId,
        subtitleStyle: baselineSubtitleStyleId,
        subtitleType: baselineSubtitleType === "none" ? "none" : baselineSubtitleType || "default",
      }));
      return;
    }

    const baselineVoiceType = normalizeWorkspaceSegmentEditorSetting(baselineSession.voiceType);
    if (baselineVoiceType && baselineVoiceType !== "none") {
      setSelectedVoiceId(baselineVoiceType);
    }
    updateSegmentEditorDraft((currentDraft) => ({
      ...currentDraft,
      voiceType: baselineVoiceType === "none" ? "none" : baselineVoiceType || resolvedSelectedVoiceId,
    }));
  };

  const resetSegmentEditorOrderChange = () => {
    const baselineSession = segmentEditorChecklistBaseSession;
    if (!baselineSession || !segmentEditorDraft) {
      return;
    }

    const isStructureChanged = segmentEditorDraft.segments.length !== baselineSession.segments.length;
    const nextSegments = rebuildWorkspaceSegmentEditorDraftTimeline(
      isStructureChanged
      ? cloneWorkspaceSegmentEditorDraftSession(baselineSession).segments
      : reorderWorkspaceSegmentEditorSegmentsByIndex(
          segmentEditorDraft.segments,
          baselineSession.segments.map((segment) => segment.index),
          ),
        );
    if (
      nextSegments === segmentEditorDraft.segments ||
      (nextSegments.length === segmentEditorDraft.segments.length &&
        nextSegments.every((segment, index) => segment === segmentEditorDraft.segments[index]))
    ) {
      return;
    }

    const activeSegmentStableIndex = segmentEditorDraft.segments[activeSegmentIndex]?.index ?? null;
    const nextActiveSegmentIndex =
      activeSegmentStableIndex === null
        ? 0
        : nextSegments.findIndex((segment) => segment.index === activeSegmentStableIndex);

    logSegmentEditorDiagnostics("client.segment-editor.reorder.reset", {
      activeSegmentStableIndex,
      nextActiveSegmentIndex,
      nextOrder: getSegmentEditorOrderSnapshot({ segments: nextSegments }),
    }, { includeOrder: true });

    resetSegmentEditorPreviewPlaybackState();
    setSegmentEditorVideoError(null);
    if (
      typeof segmentAiPhotoModalSegmentIndex === "number" &&
      !nextSegments.some((segment) => segment.index === segmentAiPhotoModalSegmentIndex)
    ) {
      closeSegmentAiPhotoModal();
    }
    setSegmentEditorDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            segments: rebuildWorkspaceSegmentEditorDraftTimeline(
              currentDraft.segments.length !== baselineSession.segments.length
                ? cloneWorkspaceSegmentEditorDraftSession(baselineSession).segments
                : reorderWorkspaceSegmentEditorSegmentsByIndex(
                    currentDraft.segments,
                    baselineSession.segments.map((segment) => segment.index),
                  ),
                  ),
          }
        : currentDraft,
    );
    syncSegmentEditorRouteForArrayIndex(
      { projectId: segmentEditorDraft.projectId, segments: nextSegments },
      nextActiveSegmentIndex >= 0 ? nextActiveSegmentIndex : 0,
    );
    setActiveSegmentIndex(nextActiveSegmentIndex >= 0 ? nextActiveSegmentIndex : 0);
  };

  const syncSegmentAiPhotoModalForSegment = useCallback(
    (
      segment: WorkspaceSegmentEditorDraftSegment,
      options?: {
        preserveTab?: boolean;
        resetLibraryFilter?: boolean;
      },
    ) => {
      const nextAiPhotoPrompt = segment.aiPhotoPromptInitialized
        ? segment.aiPhotoPrompt
        : getWorkspaceSegmentAiPhotoPromptPrefill(segment);
      const nextImageEditPrompt = segment.imageEditPromptInitialized
        ? segment.imageEditPrompt
        : getWorkspaceSegmentImageEditPromptPrefill(segment);
      const nextAiVideoPrompt = segment.aiVideoPromptInitialized
        ? segment.aiVideoPrompt
        : getWorkspaceSegmentAiVideoPromptPrefill(segment);
      const nextTab = getWorkspaceSegmentVisualModalDefaultTab(segment);

      setSegmentEditorVideoError(null);
      if (options?.resetLibraryFilter) {
        setSegmentAiPhotoModalLibraryFilter("all");
      }
      setSegmentAiPhotoModalSegmentIndex(segment.index);
      setSegmentAiPhotoModalPrompt(nextAiPhotoPrompt);
      setSegmentImageEditModalPrompt(nextImageEditPrompt);
      setSegmentAiVideoModalPrompt(nextAiVideoPrompt);
      setSegmentAiPhotoModalTab((current) =>
        options?.preserveTab ? resolveWorkspaceSegmentVisualModalTab(segment, current) : nextTab,
      );
      setIsSegmentAiPhotoPromptImproving(false);
      setIsSegmentAiPhotoPromptImproved(false);
      setIsSegmentAiPhotoPromptHighlighted(false);
    },
    [],
  );

  useEffect(() => {
    if (
      !isSegmentAiPhotoModalOpen ||
      !isSegmentAiPhotoModalVisible ||
      !activeSegment ||
      segmentAiPhotoModalSegmentIndex === activeSegment.index
    ) {
      return;
    }

    syncSegmentAiPhotoModalForSegment(activeSegment, { preserveTab: true });
  }, [
    activeSegment,
    isSegmentAiPhotoModalOpen,
    isSegmentAiPhotoModalVisible,
    segmentAiPhotoModalSegmentIndex,
    syncSegmentAiPhotoModalForSegment,
  ]);

  useEffect(() => {
    if (createMode !== "segment-editor" || !activeSegment || isSegmentAiPhotoModalOpen) {
      return;
    }

    syncSegmentAiPhotoModalForSegment(activeSegment, { preserveTab: true });
  }, [activeSegment?.index, createMode, isSegmentAiPhotoModalOpen, syncSegmentAiPhotoModalForSegment]);

  useEffect(() => {
    const nextMode = getWorkspaceSegmentPromptSceneModeForTab(segmentAiPhotoModalTab);
    setSegmentEditorPromptSceneMode((current) => (current === nextMode ? current : nextMode));
  }, [segmentAiPhotoModalTab]);

  const cancelPendingSegmentAiPhotoRun = (targetSegmentIndex: number) => {
    if (segmentEditorGeneratingAiPhotoSegmentIndex !== targetSegmentIndex) {
      return;
    }

    segmentAiPhotoRunRef.current += 1;
    setIsSegmentEditorGeneratingAiPhoto(false);
    setSegmentEditorGeneratingAiPhotoSegmentIndex(null);
  };

  const cancelPendingSegmentAiVideoRun = (targetSegmentIndex: number) => {
    if (segmentEditorGeneratingAiVideoSegmentIndex !== targetSegmentIndex) {
      return;
    }

    segmentAiVideoRunRef.current += 1;
    setIsSegmentEditorGeneratingAiVideo(false);
    setSegmentEditorGeneratingAiVideoSegmentIndex(null);
  };

  const cancelPendingSegmentImageEditRun = (targetSegmentIndex: number) => {
    if (segmentEditorGeneratingImageEditSegmentIndex !== targetSegmentIndex) {
      return;
    }

    segmentImageEditRunRef.current += 1;
    setIsSegmentEditorGeneratingImageEdit(false);
    setSegmentEditorGeneratingImageEditSegmentIndex(null);
  };

  const cancelPendingSegmentPhotoAnimationRun = (targetSegmentIndex: number) => {
    if (segmentEditorGeneratingPhotoAnimationSegmentIndex !== targetSegmentIndex) {
      return;
    }

    segmentPhotoAnimationRunRef.current += 1;
    setIsSegmentEditorGeneratingPhotoAnimation(false);
    setSegmentEditorGeneratingPhotoAnimationSegmentIndex(null);
  };

  const cancelPendingSegmentImageUpscaleRun = (targetSegmentIndex: number) => {
    if (segmentEditorUpscalingImageSegmentIndex !== targetSegmentIndex) {
      return;
    }

    segmentImageUpscaleRunRef.current += 1;
    setIsSegmentEditorUpscalingImage(false);
    setSegmentEditorUpscalingImageSegmentIndex(null);
  };

  const handleSegmentEditorCustomVideoSelect = async (
    file: File,
    options?: {
      segmentIndex?: number;
    },
  ) => {
    const targetSegmentIndex = options?.segmentIndex ?? activeSegment?.index;
    if (typeof targetSegmentIndex !== "number") {
      return false;
    }

    if (!isSupportedWorkspaceSegmentVisualFile(file.name)) {
      setSegmentEditorVideoError("Поддерживаются фото и видео: .jpg, .jpeg, .png, .webp, .avif, .mp4, .mov, .webm и .m4v.");
      return false;
    }

    if (file.size > STUDIO_CUSTOM_VIDEO_MAX_BYTES) {
      setSegmentEditorVideoError("Файл слишком большой. Максимум 48 МБ.");
      return false;
    }

    setIsSegmentEditorPreparingCustomVideo(true);
    setSegmentEditorVideoError(null);

    try {
      cancelPendingSegmentAiPhotoRun(targetSegmentIndex);
      cancelPendingSegmentAiVideoRun(targetSegmentIndex);
      cancelPendingSegmentImageEditRun(targetSegmentIndex);
      cancelPendingSegmentPhotoAnimationRun(targetSegmentIndex);
      cancelPendingSegmentImageUpscaleRun(targetSegmentIndex);
      const mimeType = getWorkspaceSegmentCustomVisualMimeType(file);
      const objectUrl = createStudioObjectUrl(file);

      updateSegmentEditorDraftSegmentByIndex(targetSegmentIndex, (segment) => ({
        ...segment,
        customVideo: {
          file,
          fileName: file.name,
          fileSize: file.size,
          mimeType,
          objectUrl,
          source: "upload",
        },
        videoAction: "custom",
      }));

      const projectId = segmentEditorDraft?.projectId;
      if (projectId) {
        void (async () => {
          try {
            const uploadSession = await initializeStudioMediaFileUpload(file, {
              fileName: file.name,
              kind: "segment_source",
              language: selectedLanguage,
              mediaType: isWorkspaceSegmentImageFile(file.name) ? "photo" : "video",
              mimeType,
              projectId,
              role: "segment_source",
              segmentIndex: targetSegmentIndex,
            });

            updateSegmentEditorDraftSegmentByIndex(targetSegmentIndex, (segment) => {
              if (segment.customVideo?.objectUrl !== objectUrl) {
                return segment;
              }

              return {
                ...segment,
                customVideo: {
                  ...segment.customVideo,
                  assetId: uploadSession.assetId,
                  remoteUrl: getWorkspaceMediaAssetResolvedPreviewUrl({
                    assetId: uploadSession.assetId,
                    fileName: file.name,
                    mimeType,
                  }) ?? undefined,
                },
              };
            });

            await uploadStudioMediaFileViaDirectSession(file, uploadSession);
            const assetId = await completeStudioMediaFileUpload(uploadSession.assetId, {
              language: selectedLanguage,
              projectId,
              role: "segment_source",
              segmentIndex: targetSegmentIndex,
            });

            updateSegmentEditorDraftSegmentByIndex(targetSegmentIndex, (segment) => {
              if (segment.customVideo?.objectUrl !== objectUrl) {
                return segment;
              }

              return {
                ...segment,
                customVideo: {
                  ...segment.customVideo,
                  assetId,
                  remoteUrl: getWorkspaceMediaAssetResolvedPreviewUrl({
                    assetId,
                    fileName: file.name,
                    mimeType,
                  }) ?? undefined,
                },
              };
            });
          } catch (error) {
            let shouldReportError = false;
            updateSegmentEditorDraftSegmentByIndex(targetSegmentIndex, (segment) => {
              if (segment.customVideo?.objectUrl !== objectUrl) {
                return segment;
              }

              shouldReportError = true;
              return {
                ...segment,
                customVideo: {
                  ...segment.customVideo,
                  assetId: undefined,
                  remoteUrl: undefined,
                },
              };
            });
            if (shouldReportError) {
              setSegmentEditorVideoError(
                error instanceof Error ? error.message : "Не удалось загрузить файл сегмента.",
              );
            }
          }
        })();
      }

      return true;
    } catch (error) {
      setSegmentEditorVideoError(error instanceof Error ? error.message : "Не удалось подготовить файл сегмента.");
      return false;
    } finally {
      setIsSegmentEditorPreparingCustomVideo(false);
    }
  };

  const handleSegmentEditorMediaLibrarySelect = (
    item: WorkspaceMediaLibraryItem,
    options?: {
      segmentIndex?: number;
    },
  ) => {
    const targetSegmentIndex = options?.segmentIndex ?? activeSegment?.index;
    if (typeof targetSegmentIndex !== "number") {
      return false;
    }

    const remoteUrl = getWorkspaceMediaLibraryItemRemoteUrl(item);
    if (!remoteUrl) {
      setSegmentEditorVideoError("Не удалось получить файл из медиатеки.");
      return false;
    }

    setSegmentEditorVideoError(null);
    cancelPendingSegmentAiPhotoRun(targetSegmentIndex);
    cancelPendingSegmentAiVideoRun(targetSegmentIndex);
    cancelPendingSegmentImageEditRun(targetSegmentIndex);
    cancelPendingSegmentPhotoAnimationRun(targetSegmentIndex);
    cancelPendingSegmentImageUpscaleRun(targetSegmentIndex);
    logSegmentEditorDiagnostics("client.segment-editor.media-library.apply", {
      itemKey: item.itemKey,
      itemKind: item.kind,
      previewKind: item.previewKind,
      targetSegmentIndex,
    });
    updateSegmentEditorDraftSegmentByIndex(targetSegmentIndex, (segment) => ({
      ...segment,
      customVideo: createStudioCustomVideoFileFromMediaLibraryItem(item),
      videoAction: "custom",
    }));

    return true;
  };

  const handleSegmentEditorTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    updateActiveSegmentDraft((segment) => ({
      ...segment,
      text: nextValue,
      textByLanguage: {
        ...segment.textByLanguage,
        [selectedLanguage]: nextValue,
      },
    }));
  };

  const handleSegmentEditorAiPhotoPromptChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setSegmentEditorVideoError(null);
    setSegmentAiPhotoModalTab("ai_photo");
    setIsSegmentAiPhotoPromptImproved(false);
    setIsSegmentAiPhotoPromptHighlighted(false);
    if (segmentAiPhotoPromptHighlightTimerRef.current) {
      window.clearTimeout(segmentAiPhotoPromptHighlightTimerRef.current);
      segmentAiPhotoPromptHighlightTimerRef.current = null;
    }
    setSegmentAiPhotoModalPrompt(nextValue);
    if (segmentAiPhotoModalSegment) {
      updateSegmentEditorDraftSegmentByIndex(segmentAiPhotoModalSegment.index, (segment) => ({
        ...segment,
        aiPhotoPrompt: nextValue,
        aiPhotoPromptInitialized: true,
      }));
    }
  };

  const handleSegmentEditorAiVideoPromptChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setSegmentEditorVideoError(null);
    setSegmentAiPhotoModalTab("ai_video");
    setIsSegmentAiPhotoPromptImproved(false);
    setIsSegmentAiPhotoPromptHighlighted(false);
    if (segmentAiPhotoPromptHighlightTimerRef.current) {
      window.clearTimeout(segmentAiPhotoPromptHighlightTimerRef.current);
      segmentAiPhotoPromptHighlightTimerRef.current = null;
    }
    setSegmentAiVideoModalPrompt(nextValue);
    if (segmentAiPhotoModalSegment) {
      updateSegmentEditorDraftSegmentByIndex(segmentAiPhotoModalSegment.index, (segment) => ({
        ...segment,
        aiVideoPrompt: nextValue,
        aiVideoPromptInitialized: true,
      }));
    }
  };

  const handleSegmentEditorImageEditPromptChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setSegmentEditorVideoError(null);
    setSegmentAiPhotoModalTab("image_edit");
    setIsSegmentAiPhotoPromptImproved(false);
    setIsSegmentAiPhotoPromptHighlighted(false);
    if (segmentAiPhotoPromptHighlightTimerRef.current) {
      window.clearTimeout(segmentAiPhotoPromptHighlightTimerRef.current);
      segmentAiPhotoPromptHighlightTimerRef.current = null;
    }
    setSegmentImageEditModalPrompt(nextValue);
    if (segmentAiPhotoModalSegment) {
      updateSegmentEditorDraftSegmentByIndex(segmentAiPhotoModalSegment.index, (segment) => ({
        ...segment,
        imageEditPrompt: nextValue,
        imageEditPromptInitialized: true,
      }));
    }
  };

  const handleSegmentEditorPhotoAnimationPromptChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setSegmentEditorVideoError(null);
    setSegmentAiPhotoModalTab("photo_animation");
    setIsSegmentAiPhotoPromptImproved(false);
    setIsSegmentAiPhotoPromptHighlighted(false);
    if (segmentAiPhotoPromptHighlightTimerRef.current) {
      window.clearTimeout(segmentAiPhotoPromptHighlightTimerRef.current);
      segmentAiPhotoPromptHighlightTimerRef.current = null;
    }
    setSegmentAiVideoModalPrompt(nextValue);
    if (segmentAiPhotoModalSegment) {
      updateSegmentEditorDraftSegmentByIndex(segmentAiPhotoModalSegment.index, (segment) => ({
        ...segment,
        aiVideoPrompt: nextValue,
        aiVideoPromptInitialized: true,
      }));
    }
  };

  const handleSegmentEditorTextReset = () => {
    updateActiveSegmentDraft((segment) => ({
      ...segment,
      text: segment.originalText,
      textByLanguage: {
        ...segment.textByLanguage,
        [selectedLanguage]: segment.originalText,
      },
    }));
  };

  const resetSegmentEditorTextByIndex = (targetSegmentIndex: number) => {
    updateSegmentEditorDraftSegmentByIndex(targetSegmentIndex, (segment) => ({
      ...segment,
      text: segment.originalText,
      textByLanguage: {
        ...segment.textByLanguage,
        [selectedLanguage]: segment.originalText,
      },
    }));
  };

  const resetSegmentEditorVisualByIndex = (targetSegmentIndex: number) => {
    setSegmentEditorVideoError(null);
    resetSegmentEditorPreviewPlaybackState();
    cancelPendingSegmentAiPhotoRun(targetSegmentIndex);
    cancelPendingSegmentAiVideoRun(targetSegmentIndex);
    cancelPendingSegmentImageEditRun(targetSegmentIndex);
    cancelPendingSegmentPhotoAnimationRun(targetSegmentIndex);
    cancelPendingSegmentImageUpscaleRun(targetSegmentIndex);
    updateSegmentEditorDraftSegmentByIndex(targetSegmentIndex, (segment) =>
      resetWorkspaceSegmentDraftVisualToOriginal(segment, segmentEditorDraftRef.current?.projectId ?? segmentEditorDraft?.projectId),
    );
  };

  const pollSegmentEditorAiPhotoJob = async (
    jobId: string,
    initialStatus = "queued",
    options: {
      prompt: string;
      runId: number;
      segmentIndex: number;
    },
  ) => {
    const safeJobId = jobId.trim();

    if (!safeJobId) {
      throw new Error("Не удалось запустить задачу ИИ фото.");
    }

    let latestStatus = initialStatus;
    const startedAt = Date.now();

    try {
      while (segmentAiPhotoRunRef.current === options.runId) {
        if (Date.now() - startedAt >= WORKSPACE_SEGMENT_STILL_GENERATION_JOB_TIMEOUT_MS) {
          throw new Error("ИИ фото генерируется слишком долго. Попробуйте запустить ещё раз.");
        }

        const response = await fetch(`/api/studio/segment-ai-photo/jobs/${encodeURIComponent(safeJobId)}`);
        const payload = (await response.json().catch(() => null)) as WorkspaceSegmentAiPhotoJobStatusResponse | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error ?? "Не удалось получить статус ИИ фото.");
        }

        if (segmentAiPhotoRunRef.current !== options.runId) {
          return;
        }

        latestStatus = normalizeWorkspaceSegmentGenerationJobStatus(payload.data.status);
        applyWorkspaceProfile(payload.data.profile);

        if (payload.data.asset) {
          updateSegmentEditorDraftSegmentByIndex(options.segmentIndex, (segment) => ({
            ...segment,
            aiPhotoAsset: payload.data!.asset!,
            aiPhotoGeneratedFromPrompt: options.prompt,
            aiPhotoPromptInitialized: true,
            videoAction: "ai_photo",
          }));
          upsertGeneratedMediaLibraryEntry({
            asset: payload.data.asset,
            kind: "ai_photo",
            projectId: segmentEditorDraft?.projectId ?? 0,
            segmentIndex: options.segmentIndex,
            sourceJobId: safeJobId,
          });
          return;
        }

        if (isWorkspaceSegmentGenerationJobFailedStatus(latestStatus)) {
          throw new Error(payload.data.error ?? "Не удалось сгенерировать ИИ фото.");
        }

        if (isWorkspaceSegmentGenerationJobDoneStatus(latestStatus)) {
          throw new Error(payload.data.error ?? "Сгенерированное ИИ фото недоступно.");
        }

        await new Promise((resolve) => window.setTimeout(resolve, latestStatus === "queued" ? 1500 : 2000));
      }
    } finally {
      if (segmentAiPhotoRunRef.current === options.runId) {
        setIsSegmentEditorGeneratingAiPhoto(false);
        setSegmentEditorGeneratingAiPhotoSegmentIndex(null);
      }
    }
  };

  const pollSegmentEditorImageEditJob = async (
    jobId: string,
    initialStatus = "queued",
    options: {
      prompt: string;
      runId: number;
      segmentIndex: number;
    },
  ) => {
    const safeJobId = jobId.trim();

    if (!safeJobId) {
      throw new Error("Не удалось запустить задачу дорисовки фото.");
    }

    let latestStatus = initialStatus;
    const startedAt = Date.now();

    try {
      while (segmentImageEditRunRef.current === options.runId) {
        if (Date.now() - startedAt >= WORKSPACE_SEGMENT_STILL_GENERATION_JOB_TIMEOUT_MS) {
          throw new Error("Дорисовка фото занимает слишком много времени. Попробуйте ещё раз.");
        }

        const response = await fetch(`/api/studio/segment-image-edit/jobs/${encodeURIComponent(safeJobId)}`);
        const payload = (await response.json().catch(() => null)) as WorkspaceSegmentAiPhotoJobStatusResponse | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error ?? "Не удалось получить статус дорисовки фото.");
        }

        if (segmentImageEditRunRef.current !== options.runId) {
          return;
        }

        latestStatus = normalizeWorkspaceSegmentGenerationJobStatus(payload.data.status);
        applyWorkspaceProfile(payload.data.profile);

        if (payload.data.asset) {
          updateSegmentEditorDraftSegmentByIndex(options.segmentIndex, (segment) => ({
            ...segment,
            imageEditAsset: payload.data!.asset!,
            imageEditGeneratedFromPrompt: options.prompt,
            imageEditPrompt: options.prompt,
            imageEditPromptInitialized: true,
            videoAction: "image_edit",
          }));
          upsertGeneratedMediaLibraryEntry({
            asset: payload.data.asset,
            kind: "image_edit",
            projectId: segmentEditorDraft?.projectId ?? 0,
            segmentIndex: options.segmentIndex,
            sourceJobId: safeJobId,
          });
          return;
        }

        if (isWorkspaceSegmentGenerationJobFailedStatus(latestStatus)) {
          throw new Error(payload.data.error ?? "Не удалось завершить дорисовку фото.");
        }

        if (isWorkspaceSegmentGenerationJobDoneStatus(latestStatus)) {
          throw new Error(payload.data.error ?? "Изображение после дорисовки недоступно.");
        }

        await new Promise((resolve) => window.setTimeout(resolve, latestStatus === "queued" ? 1500 : 2000));
      }
    } finally {
      if (segmentImageEditRunRef.current === options.runId) {
        setIsSegmentEditorGeneratingImageEdit(false);
        setSegmentEditorGeneratingImageEditSegmentIndex(null);
      }
    }
  };

  const pollSegmentEditorAiVideoJob = async (
    jobId: string,
    initialStatus = "queued",
    options: {
      prompt: string;
      runId: number;
      segmentIndex: number;
    },
  ) => {
    const safeJobId = jobId.trim();

    if (!safeJobId) {
      throw new Error("Не удалось запустить задачу ИИ видео.");
    }

    let latestStatus = initialStatus;
    const startedAt = Date.now();

    try {
      while (segmentAiVideoRunRef.current === options.runId) {
        if (Date.now() - startedAt >= WORKSPACE_SEGMENT_VIDEO_GENERATION_JOB_TIMEOUT_MS) {
          throw new Error("ИИ видео генерируется слишком долго. Попробуйте запустить ещё раз.");
        }

        const response = await fetch(`/api/studio/segment-ai-video/jobs/${encodeURIComponent(safeJobId)}`);
        const payload = (await response.json().catch(() => null)) as WorkspaceSegmentAiVideoJobStatusResponse | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error ?? "Не удалось получить статус ИИ видео.");
        }

        if (segmentAiVideoRunRef.current !== options.runId) {
          return;
        }

        latestStatus = normalizeWorkspaceSegmentGenerationJobStatus(payload.data.status);
        applyWorkspaceProfile(payload.data.profile);

        if (payload.data.asset) {
          const currentSegment = segmentEditorDraft?.segments.find((segment) => segment.index === options.segmentIndex) ?? null;
          const preferredPosterUrl = currentSegment
            ? getWorkspaceAiVideoPreferredPosterUrl(currentSegment, payload.data.asset)
            : null;
          const nextAiVideoAsset = preferredPosterUrl
            ? {
                ...payload.data.asset,
                posterUrl: preferredPosterUrl,
              }
            : payload.data.asset;

          updateSegmentEditorDraftSegmentByIndex(options.segmentIndex, (segment) => ({
            ...segment,
            aiVideoAsset: nextAiVideoAsset,
            aiVideoGeneratedMode: "ai_video",
            aiVideoGeneratedFromPrompt: options.prompt,
            aiVideoPrompt: options.prompt,
            aiVideoPromptInitialized: true,
            videoAction: "ai",
          }));
          const didWarmVideoPlayback = await warmSegmentEditorGeneratedVideoForPlayback(
            options.segmentIndex,
            getStudioCustomAssetPreviewUrl(nextAiVideoAsset),
          );
          logSegmentEditorDiagnostics("client.segment-editor.ai-video.warmup", {
            didWarmVideoPlayback,
            jobId: safeJobId,
            targetSegmentIndex: options.segmentIndex,
          });
          upsertGeneratedMediaLibraryEntry({
            asset: nextAiVideoAsset,
            kind: "ai_video",
            projectId: segmentEditorDraft?.projectId ?? 0,
            segmentIndex: options.segmentIndex,
            sourceJobId: safeJobId,
          });
          return;
        }

        if (isWorkspaceSegmentGenerationJobFailedStatus(latestStatus)) {
          throw new Error(payload.data.error ?? "Не удалось сгенерировать ИИ видео.");
        }

        if (isWorkspaceSegmentGenerationJobDoneStatus(latestStatus)) {
          throw new Error(payload.data.error ?? "Сгенерированное ИИ видео недоступно.");
        }

        await new Promise((resolve) => window.setTimeout(resolve, latestStatus === "queued" ? 1500 : 2200));
      }
    } finally {
      if (segmentAiVideoRunRef.current === options.runId) {
        setIsSegmentEditorGeneratingAiVideo(false);
        setSegmentEditorGeneratingAiVideoSegmentIndex(null);
      }
    }
  };

  const pollSegmentEditorPhotoAnimationJob = async (
    jobId: string,
    initialStatus = "queued",
    options: {
      projectId: number;
      prompt: string;
      runId: number;
      segmentIndex: number;
      sourceAsset?: StudioCustomVideoFile | null;
    },
  ) => {
    const safeJobId = jobId.trim();

    if (!safeJobId) {
      throw new Error("Не удалось запустить задачу ИИ анимации фото.");
    }

    let latestStatus = initialStatus;
    const startedAt = Date.now();
    let transientStatusFailures = 0;
    segmentPhotoAnimationActiveJobIdRef.current = safeJobId;

    try {
      while (segmentPhotoAnimationRunRef.current === options.runId) {
        if (Date.now() - startedAt >= WORKSPACE_SEGMENT_PHOTO_ANIMATION_JOB_TIMEOUT_MS) {
          throw new Error("ИИ анимация фото генерируется слишком долго. Попробуйте запустить ещё раз.");
        }

        let response: Response;
        let payload: WorkspaceSegmentAiVideoJobStatusResponse | null = null;
        try {
          response = await fetch(`/api/studio/segment-photo-animation/jobs/${encodeURIComponent(safeJobId)}`);
          payload = (await response.json().catch(() => null)) as WorkspaceSegmentAiVideoJobStatusResponse | null;
        } catch (error) {
          transientStatusFailures += 1;
          logSegmentEditorDiagnostics(
            "client.segment-editor.photo-animation.status.transient-fetch-failed",
            {
              error:
                error instanceof Error
                  ? {
                      message: error.message,
                      name: error.name,
                    }
                  : String(error),
              failures: transientStatusFailures,
              jobId: safeJobId,
              targetSegmentIndex: options.segmentIndex,
            },
            {
              level: "warn",
            },
          );
          await new Promise((resolve) => window.setTimeout(resolve, 3500));
          continue;
        }

        if (!response.ok || !payload?.data) {
          const statusError = payload?.error ?? "Не удалось получить статус ИИ анимации фото.";
          if (response.status >= 500) {
            transientStatusFailures += 1;
            logSegmentEditorDiagnostics(
              "client.segment-editor.photo-animation.status.transient-server-failed",
              {
                failures: transientStatusFailures,
                jobId: safeJobId,
                statusCode: response.status,
                targetSegmentIndex: options.segmentIndex,
              },
              {
                level: "warn",
              },
            );
            await new Promise((resolve) => window.setTimeout(resolve, 3500));
            continue;
          }

          throw new Error(statusError);
        }
        transientStatusFailures = 0;

        if (segmentPhotoAnimationRunRef.current !== options.runId) {
          return;
        }

        latestStatus = normalizeWorkspaceSegmentGenerationJobStatus(payload.data.status);
        applyWorkspaceProfile(payload.data.profile);
        upsertStoredWorkspaceSegmentPhotoAnimationJob(session.email, {
          createdAt: startedAt,
          jobId: safeJobId,
          projectId: options.projectId,
          prompt: options.prompt,
          segmentIndex: options.segmentIndex,
          sourceAsset:
            cloneStudioCustomVideoFile(options.sourceAsset ?? null) ??
            segmentEditorDraftRef.current?.segments.find((segment) => segment.index === options.segmentIndex)
              ?.photoAnimationSourceAsset ?? null,
          status: latestStatus,
        });

        if (payload.data.asset) {
          const currentDraft = segmentEditorDraftRef.current;
          const currentSegment = currentDraft?.segments.find((segment) => segment.index === options.segmentIndex) ?? null;
          const resolvedSourceAsset =
            cloneStudioCustomVideoFile(options.sourceAsset ?? null) ??
            cloneStudioCustomVideoFile(currentSegment?.photoAnimationSourceAsset ?? null);
          const posterSegment =
            currentSegment && resolvedSourceAsset
              ? {
                  ...currentSegment,
                  photoAnimationSourceAsset: resolvedSourceAsset,
                }
              : currentSegment;
          const preferredPosterUrl = posterSegment
            ? getWorkspacePhotoAnimationPreferredPosterUrl(posterSegment, payload.data.asset)
            : resolvedSourceAsset
              ? getStudioCustomAssetPreviewUrl(resolvedSourceAsset)
            : null;
          const nextPhotoAnimationAsset = preferredPosterUrl
            ? {
                ...payload.data.asset,
                posterUrl: preferredPosterUrl,
              }
            : payload.data.asset;

          updateSegmentEditorDraftSegmentByIndex(options.segmentIndex, (segment) => ({
            ...segment,
            aiVideoAsset: nextPhotoAnimationAsset,
            aiVideoGeneratedMode: "photo_animation",
            aiVideoGeneratedFromPrompt: options.prompt,
            aiVideoPrompt: options.prompt,
            aiVideoPromptInitialized: true,
            photoAnimationSourceAsset:
              resolvedSourceAsset ?? cloneStudioCustomVideoFile(segment.photoAnimationSourceAsset),
            videoAction: "photo_animation",
          }));
          const didWarmVideoPlayback = await warmSegmentEditorGeneratedVideoForPlayback(
            options.segmentIndex,
            getStudioCustomAssetPreviewUrl(nextPhotoAnimationAsset),
          );
          logSegmentEditorDiagnostics("client.segment-editor.photo-animation.warmup", {
            didWarmVideoPlayback,
            jobId: safeJobId,
            targetSegmentIndex: options.segmentIndex,
          });
          upsertGeneratedMediaLibraryEntry({
            asset: nextPhotoAnimationAsset,
            kind: "photo_animation",
            projectId: currentDraft?.projectId ?? options.projectId,
            segmentIndex: options.segmentIndex,
            sourceJobId: safeJobId,
          });
          removeStoredWorkspaceSegmentPhotoAnimationJob(session.email, safeJobId);
          const projectId = segmentEditorDraftRef.current?.projectId ?? options.projectId;
          if (projectId > 0) {
            void ensureSegmentEditorDraftForProject(projectId, {
              bypassCache: true,
              forceRefresh: true,
              initialSegmentIndex: options.segmentIndex,
              initialSegmentMode: "route",
              openDraft: false,
              syncRoute: false,
            });
          }
          return;
        }

        if (isWorkspaceSegmentGenerationJobFailedStatus(latestStatus)) {
          removeStoredWorkspaceSegmentPhotoAnimationJob(session.email, safeJobId);
          throw new Error(payload.data.error ?? "Не удалось анимировать фото сегмента.");
        }

        if (isWorkspaceSegmentGenerationJobDoneStatus(latestStatus)) {
          const refreshedDraft = await ensureSegmentEditorDraftForProject(options.projectId, {
            bypassCache: true,
            forceRefresh: true,
            initialSegmentIndex: options.segmentIndex,
            initialSegmentMode: "route",
            openDraft: false,
            syncRoute: false,
          });
          const refreshedSegment = refreshedDraft?.segments.find((segment) => segment.index === options.segmentIndex) ?? null;
          if (refreshedSegment && getWorkspaceSegmentLatestVisualAction(refreshedSegment) === "photo_animation") {
            removeStoredWorkspaceSegmentPhotoAnimationJob(session.email, safeJobId);
            return;
          }

          removeStoredWorkspaceSegmentPhotoAnimationJob(session.email, safeJobId);
          throw new Error(payload.data.error ?? "Сгенерированная ИИ анимация фото недоступна.");
        }

        await new Promise((resolve) => window.setTimeout(resolve, latestStatus === "queued" ? 1500 : 2200));
      }
    } finally {
      if (segmentPhotoAnimationActiveJobIdRef.current === safeJobId) {
        segmentPhotoAnimationActiveJobIdRef.current = null;
      }
      if (segmentPhotoAnimationRunRef.current === options.runId) {
        setIsSegmentEditorGeneratingPhotoAnimation(false);
        setSegmentEditorGeneratingPhotoAnimationSegmentIndex(null);
      }
    }
  };

  const pollSegmentEditorImageUpscaleJob = async (
    jobId: string,
    initialStatus = "queued",
    options: {
      runId: number;
      segmentIndex: number;
    },
  ) => {
    const safeJobId = jobId.trim();

    if (!safeJobId) {
      throw new Error("Не удалось запустить задачу улучшения изображения.");
    }

    let latestStatus = initialStatus;
    const startedAt = Date.now();

    try {
      while (segmentImageUpscaleRunRef.current === options.runId) {
        if (Date.now() - startedAt >= WORKSPACE_SEGMENT_STILL_GENERATION_JOB_TIMEOUT_MS) {
          throw new Error("Улучшение качества изображения занимает слишком много времени. Попробуйте ещё раз.");
        }

        const response = await fetch(`/api/studio/segment-image-upscale/jobs/${encodeURIComponent(safeJobId)}`);
        const payload = (await response.json().catch(() => null)) as WorkspaceSegmentImageUpscaleJobStatusResponse | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error ?? "Не удалось получить статус улучшения изображения.");
        }

        if (segmentImageUpscaleRunRef.current !== options.runId) {
          return;
        }

        latestStatus = normalizeWorkspaceSegmentGenerationJobStatus(payload.data.status);
        applyWorkspaceProfile(payload.data.profile);

        if (payload.data.asset) {
          updateSegmentEditorDraftSegmentByIndex(options.segmentIndex, (segment) =>
            applyWorkspaceSegmentUpscaledImageAsset(segment, payload.data!.asset!),
          );
          return;
        }

        if (isWorkspaceSegmentGenerationJobFailedStatus(latestStatus)) {
          throw new Error(payload.data.error ?? "Не удалось улучшить качество изображения.");
        }

        if (isWorkspaceSegmentGenerationJobDoneStatus(latestStatus)) {
          throw new Error(payload.data.error ?? "Улучшенное изображение недоступно.");
        }

        await new Promise((resolve) => window.setTimeout(resolve, latestStatus === "queued" ? 1500 : 2200));
      }
    } finally {
      if (segmentImageUpscaleRunRef.current === options.runId) {
        setIsSegmentEditorUpscalingImage(false);
        setSegmentEditorUpscalingImageSegmentIndex(null);
      }
    }
  };

  const handleSegmentEditorAiPhotoGenerate = async (
    options?: {
      prompt?: string;
      segmentIndex?: number;
      shouldCloseModal?: boolean;
    },
  ) => {
    if (!segmentEditorDraft) {
      return;
    }

    const targetSegmentIndex = options?.segmentIndex ?? activeSegment?.index;
    if (typeof targetSegmentIndex !== "number") {
      return;
    }

    const targetSegment =
      segmentEditorDraft.segments.find((segment) => segment.index === targetSegmentIndex) ??
      (activeSegment?.index === targetSegmentIndex ? activeSegment : null);
    const nextPrompt = options?.prompt ?? targetSegment?.aiPhotoPrompt ?? "";
    const normalizedPrompt = normalizeWorkspaceSegmentAiPhotoPrompt(nextPrompt);
    if (!normalizedPrompt) {
      setSegmentEditorVideoError("Введите промт для ИИ фото.");
      return;
    }

    updateSegmentEditorDraftSegmentByIndex(targetSegmentIndex, (segment) => ({
      ...segment,
      aiPhotoPrompt: nextPrompt,
      aiPhotoPromptInitialized: true,
      videoAction: "ai_photo",
    }));

    if (workspaceBalance !== null && workspaceBalance < STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST) {
      setSegmentEditorVideoError(null);
      openInsufficientCreditsModal("ai_photo", STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST);
      return;
    }

    cancelPendingSegmentAiVideoRun(targetSegmentIndex);

    const runId = segmentAiPhotoRunRef.current + 1;
    segmentAiPhotoRunRef.current = runId;
    setIsSegmentEditorGeneratingAiPhoto(true);
    setSegmentEditorGeneratingAiPhotoSegmentIndex(targetSegmentIndex);
    setSegmentEditorVideoError(null);
    setInsufficientCreditsContext(null);

    let pollStarted = false;

    try {
      if (options?.shouldCloseModal) {
        closeSegmentAiPhotoModal();
      }

      const response = await fetch("/api/studio/segment-ai-photo/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: selectedLanguage,
          projectId: segmentEditorDraft.projectId,
          prompt: normalizedPrompt,
          segmentIndex: targetSegmentIndex,
        } satisfies WorkspaceSegmentAiPhotoJobCreateRequest),
      });
      const payload = (await response.json().catch(() => null)) as WorkspaceSegmentAiPhotoJobCreateResponse | null;

      if (response.status === 402) {
        if (segmentAiPhotoRunRef.current === runId) {
          setIsSegmentEditorGeneratingAiPhoto(false);
          setSegmentEditorGeneratingAiPhotoSegmentIndex(null);
        }
        openInsufficientCreditsModal("ai_photo", STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST);
        return;
      }

      if (!response.ok || !payload?.data?.jobId) {
        throw new Error(payload?.error ?? "Не удалось запустить генерацию ИИ фото.");
      }

      if (segmentAiPhotoRunRef.current !== runId) {
        return;
      }

      applyWorkspaceProfile(payload.data.profile);
      pollStarted = true;
      await pollSegmentEditorAiPhotoJob(payload.data.jobId, payload.data.status, {
        prompt: normalizedPrompt,
        runId,
        segmentIndex: targetSegmentIndex,
      });
    } catch (error) {
      if (segmentAiPhotoRunRef.current !== runId) {
        return;
      }
      setSegmentEditorVideoError(error instanceof Error ? error.message : "Не удалось сгенерировать ИИ фото.");
    } finally {
      if (!pollStarted && segmentAiPhotoRunRef.current === runId) {
        setIsSegmentEditorGeneratingAiPhoto(false);
        setSegmentEditorGeneratingAiPhotoSegmentIndex(null);
      }
    }
  };

  const handleSegmentEditorImageEditGenerate = async (
    options?: {
      prompt?: string;
      segmentIndex?: number;
      shouldCloseModal?: boolean;
    },
  ) => {
    if (!segmentEditorDraft) {
      return;
    }

    const targetSegmentIndex = options?.segmentIndex ?? activeSegment?.index;
    if (typeof targetSegmentIndex !== "number") {
      return;
    }

    const targetSegment =
      segmentEditorDraft.segments.find((segment) => segment.index === targetSegmentIndex) ??
      (activeSegment?.index === targetSegmentIndex ? activeSegment : null);
    if (targetSegment && !canWorkspaceSegmentUsePhotoEditingTools(targetSegment)) {
      setSegmentEditorVideoError("Сначала выберите фото для сегмента.");
      return;
    }
    const imageEditSource = targetSegment ? getWorkspaceSegmentImageEditSource(targetSegment) : null;
    const nextPrompt = options?.prompt ?? targetSegment?.imageEditPrompt ?? "";
    const normalizedPrompt = normalizeWorkspaceSegmentImageEditPrompt(nextPrompt);
    if (!normalizedPrompt) {
      setSegmentEditorVideoError("Введите промт для дорисовки фото.");
      return;
    }

    if (!imageEditSource) {
      setSegmentEditorVideoError("Выберите фото для дорисовки.");
      return;
    }

    updateSegmentEditorDraftSegmentByIndex(targetSegmentIndex, (segment) => ({
      ...segment,
      imageEditPrompt: nextPrompt,
      imageEditPromptInitialized: true,
      videoAction: "image_edit",
    }));

    if (workspaceBalance !== null && workspaceBalance < STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST) {
      setSegmentEditorVideoError(null);
      openInsufficientCreditsModal("image_edit", STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST);
      return;
    }

    cancelPendingSegmentAiPhotoRun(targetSegmentIndex);
    cancelPendingSegmentAiVideoRun(targetSegmentIndex);
    cancelPendingSegmentPhotoAnimationRun(targetSegmentIndex);

    const runId = segmentImageEditRunRef.current + 1;
    segmentImageEditRunRef.current = runId;
    setIsSegmentEditorGeneratingImageEdit(true);
    setSegmentEditorGeneratingImageEditSegmentIndex(targetSegmentIndex);
    setSegmentEditorVideoError(null);
    setInsufficientCreditsContext(null);

    let pollStarted = false;

    try {
      const requestImageEditJob = async (request: WorkspaceSegmentImageEditRequest) => {
        const response = await fetch("/api/studio/segment-image-edit/jobs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request satisfies WorkspaceSegmentImageEditRequest),
        });
        const payload = (await response.json().catch(() => null)) as WorkspaceSegmentAiPhotoJobCreateResponse | null;

        return { payload, response };
      };

      const shouldRetryWithInlineSource = (errorMessage: string | null | undefined) => {
        const normalizedMessage = String(errorMessage ?? "").trim().toLowerCase();
        return (
          normalizedMessage.includes("segment image source is unavailable") ||
          normalizedMessage.includes("image source is unavailable")
        );
      };

      let inlineImageDataUrl: string | undefined;
      try {
        inlineImageDataUrl = await resolveStudioCustomAssetDataUrl(imageEditSource.asset);
      } catch (error) {
        console.warn("[workspace] Failed to resolve inline image-edit source; falling back to uploaded asset id.", error);
      }

      let primaryRequest: WorkspaceSegmentImageEditRequest;
      if (inlineImageDataUrl) {
        primaryRequest = {
          imageDataUrl: inlineImageDataUrl,
          imageFileName: imageEditSource.fileName,
          language: selectedLanguage,
          projectId: segmentEditorDraft.projectId,
          prompt: normalizedPrompt,
          segmentIndex: targetSegmentIndex,
        };
      } else {
        // Force re-upload when possible so the asset is registered with the correct kind/role for image-edit.
        // Only preserve an existing assetId as a last resort (no uploadable bytes available).
        const hasUploadableBytes = Boolean(
          imageEditSource.asset.file ||
          imageEditSource.asset.dataUrl ||
          imageEditSource.asset.objectUrl ||
          ("remoteUrl" in imageEditSource.asset && imageEditSource.asset.remoteUrl),
        );
        const imageEditUploadAsset: StudioCustomVideoFile = hasUploadableBytes
          ? { ...imageEditSource.asset, assetId: undefined }
          : imageEditSource.asset;
        const imageAssetId = await ensureStudioUploadedAssetId(imageEditUploadAsset, {
        fallbackFileName: imageEditSource.fileName,
        fallbackMimeType: imageEditSource.asset.mimeType,
        kind: "segment_image",
        language: selectedLanguage,
        mediaType: "photo",
        projectId: segmentEditorDraft.projectId,
        role: "segment_source",
        segmentIndex: targetSegmentIndex,
      });
      if (!imageAssetId) {
        throw new Error("Не удалось подготовить исходное фото для дорисовки.");
        }

        primaryRequest = {
          imageAssetId,
          imageFileName: imageEditSource.fileName,
          language: selectedLanguage,
          projectId: segmentEditorDraft.projectId,
          prompt: normalizedPrompt,
          segmentIndex: targetSegmentIndex,
        };
      }

      if (options?.shouldCloseModal) {
        closeSegmentAiPhotoModal();
      }

      let { response, payload } = await requestImageEditJob(primaryRequest);

      if (!response.ok && !primaryRequest.imageDataUrl && shouldRetryWithInlineSource(payload?.error)) {
        const imageDataUrl = inlineImageDataUrl || await resolveStudioCustomAssetDataUrl(imageEditSource.asset);
        if (imageDataUrl) {
          ({ response, payload } = await requestImageEditJob({
            imageDataUrl,
          imageFileName: imageEditSource.fileName,
          language: selectedLanguage,
          projectId: segmentEditorDraft.projectId,
          prompt: normalizedPrompt,
          segmentIndex: targetSegmentIndex,
          }));
        }
      }

      if (response.status === 402) {
        if (segmentImageEditRunRef.current === runId) {
          setIsSegmentEditorGeneratingImageEdit(false);
          setSegmentEditorGeneratingImageEditSegmentIndex(null);
        }
        openInsufficientCreditsModal("image_edit", STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST);
        return;
      }

      if (!response.ok || !payload?.data?.jobId) {
        throw new Error(payload?.error ?? "Не удалось запустить дорисовку фото.");
      }

      if (segmentImageEditRunRef.current !== runId) {
        return;
      }

      applyWorkspaceProfile(payload.data.profile);
      pollStarted = true;
      await pollSegmentEditorImageEditJob(payload.data.jobId, payload.data.status, {
        prompt: normalizedPrompt,
        runId,
        segmentIndex: targetSegmentIndex,
      });
    } catch (error) {
      if (segmentImageEditRunRef.current !== runId) {
        return;
      }
      setSegmentEditorVideoError(error instanceof Error ? error.message : "Не удалось выполнить дорисовку фото.");
    } finally {
      if (!pollStarted && segmentImageEditRunRef.current === runId) {
        setIsSegmentEditorGeneratingImageEdit(false);
        setSegmentEditorGeneratingImageEditSegmentIndex(null);
      }
    }
  };

  const handleSegmentEditorAiVideoGenerate = async (
    options?: {
      prompt?: string;
      segmentIndex?: number;
      shouldCloseModal?: boolean;
    },
  ) => {
    if (!segmentEditorDraft) {
      return;
    }

    const targetSegmentIndex = options?.segmentIndex ?? activeSegment?.index;
    if (typeof targetSegmentIndex !== "number") {
      return;
    }

    const targetSegment =
      segmentEditorDraft.segments.find((segment) => segment.index === targetSegmentIndex) ??
      (activeSegment?.index === targetSegmentIndex ? activeSegment : null);
    const nextPrompt = options?.prompt ?? targetSegment?.aiVideoPrompt ?? "";
    const normalizedPrompt = normalizeWorkspaceSegmentAiVideoPrompt(nextPrompt);
    if (!normalizedPrompt) {
      setSegmentEditorVideoError("Введите промт для ИИ видео.");
      return;
    }

    updateSegmentEditorDraftSegmentByIndex(targetSegmentIndex, (segment) => ({
      ...segment,
      aiVideoPrompt: nextPrompt,
      aiVideoPromptInitialized: true,
      videoAction: "ai",
    }));

    if (workspaceBalance !== null && workspaceBalance < STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST) {
      setSegmentEditorVideoError(null);
      openInsufficientCreditsModal("ai_video", STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST);
      return;
    }

    cancelPendingSegmentAiPhotoRun(targetSegmentIndex);
    cancelPendingSegmentPhotoAnimationRun(targetSegmentIndex);

    const runId = segmentAiVideoRunRef.current + 1;
    segmentAiVideoRunRef.current = runId;
    setIsSegmentEditorGeneratingAiVideo(true);
    setSegmentEditorGeneratingAiVideoSegmentIndex(targetSegmentIndex);
    setSegmentEditorVideoError(null);
    setInsufficientCreditsContext(null);

    let pollStarted = false;

    try {
      if (options?.shouldCloseModal) {
        closeSegmentAiPhotoModal();
      }

      const response = await fetch("/api/studio/segment-ai-video/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: selectedLanguage,
          projectId: segmentEditorDraft.projectId,
          prompt: normalizedPrompt,
          segmentIndex: targetSegmentIndex,
        } satisfies WorkspaceSegmentAiVideoJobCreateRequest),
      });
      const payload = (await response.json().catch(() => null)) as WorkspaceSegmentAiVideoJobCreateResponse | null;

      if (response.status === 402) {
        if (segmentAiVideoRunRef.current === runId) {
          setIsSegmentEditorGeneratingAiVideo(false);
          setSegmentEditorGeneratingAiVideoSegmentIndex(null);
        }
        openInsufficientCreditsModal("ai_video", STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST);
        return;
      }

      if (!response.ok || !payload?.data?.jobId) {
        throw new Error(payload?.error ?? "Не удалось запустить генерацию ИИ видео.");
      }

      if (segmentAiVideoRunRef.current !== runId) {
        return;
      }

      applyWorkspaceProfile(payload.data.profile);
      pollStarted = true;
      await pollSegmentEditorAiVideoJob(payload.data.jobId, payload.data.status, {
        prompt: normalizedPrompt,
        runId,
        segmentIndex: targetSegmentIndex,
      });
    } catch (error) {
      if (segmentAiVideoRunRef.current !== runId) {
        return;
      }
      setSegmentEditorVideoError(error instanceof Error ? error.message : "Не удалось сгенерировать ИИ видео.");
    } finally {
      if (!pollStarted && segmentAiVideoRunRef.current === runId) {
        setIsSegmentEditorGeneratingAiVideo(false);
        setSegmentEditorGeneratingAiVideoSegmentIndex(null);
      }
    }
  };

  const handleSegmentEditorPhotoAnimationGenerate = async (
    options?: {
      prompt?: string;
      segmentIndex?: number;
      shouldCloseModal?: boolean;
    },
  ) => {
    logSegmentEditorDiagnostics("client.segment-editor.photo-animation.start", {
      activeSegmentIndex,
      hasDraft: Boolean(segmentEditorDraft),
      requestedSegmentIndex: options?.segmentIndex ?? null,
      shouldCloseModal: Boolean(options?.shouldCloseModal),
    });
    if (!segmentEditorDraft) {
      logSegmentEditorDiagnostics("client.segment-editor.photo-animation.blocked.no-draft", {
        requestedSegmentIndex: options?.segmentIndex ?? null,
      });
      return;
    }

    const targetSegmentIndex = options?.segmentIndex ?? activeSegment?.index;
    if (typeof targetSegmentIndex !== "number") {
      logSegmentEditorDiagnostics("client.segment-editor.photo-animation.blocked.no-segment-index", {
        activeSegmentIndex,
        requestedSegmentIndex: options?.segmentIndex ?? null,
      });
      return;
    }

    const targetSegment =
      segmentEditorDraft.segments.find((segment) => segment.index === targetSegmentIndex) ??
      (activeSegment?.index === targetSegmentIndex ? activeSegment : null);
    if (targetSegment && !canWorkspaceSegmentUsePhotoEditingTools(targetSegment)) {
      logSegmentEditorDiagnostics("client.segment-editor.photo-animation.blocked.invalid-media-type", {
        targetMediaType: targetSegment.mediaType,
        targetSegmentIndex,
        targetVideoAction: targetSegment.videoAction ?? null,
      });
      setSegmentEditorVideoError("Сначала выберите фото для сегмента.");
      return;
    }
    const photoAnimationSourceAsset = targetSegment
      ? getWorkspaceSegmentPhotoAnimationSourceAsset(targetSegment)
      : null;
    const photoAnimationUploadSourceAsset = targetSegment
      ? getWorkspacePhotoAnimationUploadSourceAsset(targetSegment, photoAnimationSourceAsset)
      : photoAnimationSourceAsset;
    const nextPrompt = options?.prompt ?? targetSegment?.aiVideoPrompt ?? "";
    const normalizedPrompt = normalizeWorkspaceSegmentAiVideoPrompt(nextPrompt);
    logSegmentEditorDiagnostics("client.segment-editor.photo-animation.resolved", {
      hasPhotoAnimationSourceAsset: Boolean(photoAnimationSourceAsset),
      hasTargetSegment: Boolean(targetSegment),
      promptLength: normalizedPrompt.length,
      targetSegmentIndex,
      targetVideoAction: targetSegment?.videoAction ?? null,
    });
    if (!normalizedPrompt) {
      logSegmentEditorDiagnostics("client.segment-editor.photo-animation.blocked.empty-prompt", {
        targetSegmentIndex,
      });
      setSegmentEditorVideoError("Введите промт для ИИ анимации фото.");
      return;
    }

    if (!canWorkspaceSegmentAnimatePhoto(targetSegment)) {
      logSegmentEditorDiagnostics("client.segment-editor.photo-animation.blocked.no-photo-source", {
        hasPhotoAnimationSourceAsset: Boolean(photoAnimationSourceAsset),
        targetSegmentIndex,
        targetVideoAction: targetSegment?.videoAction ?? null,
      });
      setSegmentEditorVideoError("Выберите фото для сегмента, чтобы запустить ИИ анимацию.");
      return;
    }

    updateSegmentEditorDraftSegmentByIndex(targetSegmentIndex, (segment) => ({
      ...segment,
      aiVideoPrompt: nextPrompt,
      aiVideoPromptInitialized: true,
      photoAnimationSourceAsset: cloneStudioCustomVideoFile(photoAnimationSourceAsset),
      videoAction: "photo_animation",
    }));

    if (workspaceBalance !== null && workspaceBalance < STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST) {
      logSegmentEditorDiagnostics("client.segment-editor.photo-animation.blocked.insufficient-credits", {
        balance: workspaceBalance,
        requiredCredits: STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST,
        targetSegmentIndex,
      });
      setSegmentEditorVideoError(null);
      openInsufficientCreditsModal("photo_animation", STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST);
      return;
    }

    cancelPendingSegmentAiPhotoRun(targetSegmentIndex);
    cancelPendingSegmentAiVideoRun(targetSegmentIndex);

    const runId = segmentPhotoAnimationRunRef.current + 1;
    segmentPhotoAnimationRunRef.current = runId;
    setIsSegmentEditorGeneratingPhotoAnimation(true);
    setSegmentEditorGeneratingPhotoAnimationSegmentIndex(targetSegmentIndex);
    setSegmentEditorVideoError(null);
    setInsufficientCreditsContext(null);

    let pollStarted = false;

    try {
      const customVideoAssetId = photoAnimationUploadSourceAsset
        ? await ensureStudioUploadedAssetId(photoAnimationUploadSourceAsset, {
            fallbackFileName: photoAnimationUploadSourceAsset.fileName || `segment-photo-${targetSegmentIndex + 1}.jpg`,
            fallbackMimeType: photoAnimationUploadSourceAsset.mimeType,
            kind: "segment_source",
            language: selectedLanguage,
            mediaType: "photo",
            projectId: segmentEditorDraft.projectId,
            role: "segment_source",
            segmentIndex: targetSegmentIndex,
          })
        : null;
      const customVideoFileMimeType = photoAnimationUploadSourceAsset?.mimeType;
      const customVideoFileName = photoAnimationUploadSourceAsset?.fileName;

      if (photoAnimationUploadSourceAsset && !customVideoAssetId) {
        logSegmentEditorDiagnostics("client.segment-editor.photo-animation.blocked.empty-source-data", {
          sourceMimeType: photoAnimationUploadSourceAsset?.mimeType ?? null,
          sourceRemoteUrl: photoAnimationUploadSourceAsset?.remoteUrl ?? null,
          targetSegmentIndex,
        });
        throw new Error("Не удалось подготовить выбранное фото для анимации.");
      }

      if (options?.shouldCloseModal) {
        closeSegmentAiPhotoModal();
      }

      logSegmentEditorDiagnostics("client.segment-editor.photo-animation.fetch.start", {
        customVideoAssetId,
        sourceFileName: customVideoFileName ?? null,
        sourceMimeType: customVideoFileMimeType ?? null,
        targetSegmentIndex,
      });
      const response = await fetch("/api/studio/segment-photo-animation/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customVideoAssetId: customVideoAssetId ?? undefined,
          customVideoFileMimeType,
          customVideoFileName,
          language: selectedLanguage,
          projectId: segmentEditorDraft.projectId,
          prompt: normalizedPrompt,
          segmentIndex: targetSegmentIndex,
        } satisfies WorkspaceSegmentPhotoAnimationJobCreateRequest),
      });
      const payload = (await response.json().catch(() => null)) as WorkspaceSegmentAiVideoJobCreateResponse | null;
      logSegmentEditorDiagnostics("client.segment-editor.photo-animation.fetch.response", {
        hasJobId: Boolean(payload?.data?.jobId),
        jobId: payload?.data?.jobId ?? null,
        responseOk: response.ok,
        statusCode: response.status,
        targetSegmentIndex,
      });

      if (response.status === 402) {
        if (segmentPhotoAnimationRunRef.current === runId) {
          setIsSegmentEditorGeneratingPhotoAnimation(false);
          setSegmentEditorGeneratingPhotoAnimationSegmentIndex(null);
        }
        openInsufficientCreditsModal("photo_animation", STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST);
        return;
      }

      if (!response.ok || !payload?.data?.jobId) {
        throw new Error(payload?.error ?? "Не удалось запустить ИИ анимацию фото.");
      }

      if (segmentPhotoAnimationRunRef.current !== runId) {
        return;
      }

      applyWorkspaceProfile(payload.data.profile);
      upsertStoredWorkspaceSegmentPhotoAnimationJob(session.email, {
        createdAt: Date.now(),
        jobId: payload.data.jobId,
        projectId: segmentEditorDraft.projectId,
        prompt: normalizedPrompt,
        segmentIndex: targetSegmentIndex,
        sourceAsset: cloneStudioCustomVideoFile(photoAnimationSourceAsset),
        status: payload.data.status,
      });
      pollStarted = true;
      await pollSegmentEditorPhotoAnimationJob(payload.data.jobId, payload.data.status, {
        projectId: segmentEditorDraft.projectId,
        prompt: normalizedPrompt,
        runId,
        segmentIndex: targetSegmentIndex,
        sourceAsset: cloneStudioCustomVideoFile(photoAnimationSourceAsset),
      });
    } catch (error) {
      logSegmentEditorDiagnostics("client.segment-editor.photo-animation.failed", {
        error:
          error instanceof Error
            ? {
                message: error.message,
                name: error.name,
              }
            : String(error),
        targetSegmentIndex,
      });
      if (segmentPhotoAnimationRunRef.current !== runId) {
        return;
      }
      setSegmentEditorVideoError(error instanceof Error ? error.message : "Не удалось анимировать фото сегмента.");
    } finally {
      if (!pollStarted && segmentPhotoAnimationRunRef.current === runId) {
        setIsSegmentEditorGeneratingPhotoAnimation(false);
        setSegmentEditorGeneratingPhotoAnimationSegmentIndex(null);
      }
    }
  };

  const resumePendingSegmentPhotoAnimationJob = (job: StoredWorkspaceSegmentPhotoAnimationJob) => {
    if (segmentPhotoAnimationActiveJobIdRef.current) {
      return false;
    }

    const currentDraft = segmentEditorDraftRef.current;
    if (!currentDraft || currentDraft.projectId !== job.projectId) {
      return false;
    }

    const targetSegment = currentDraft.segments.find((segment) => segment.index === job.segmentIndex) ?? null;
    if (!targetSegment) {
      removeStoredWorkspaceSegmentPhotoAnimationJob(session.email, job.jobId);
      return false;
    }

    const runId = segmentPhotoAnimationRunRef.current + 1;
    segmentPhotoAnimationRunRef.current = runId;
    setIsSegmentEditorGeneratingPhotoAnimation(true);
    setSegmentEditorGeneratingPhotoAnimationSegmentIndex(job.segmentIndex);
    setSegmentEditorVideoError(null);
    updateSegmentEditorDraftSegmentByIndex(job.segmentIndex, (segment) => ({
      ...segment,
      aiVideoPrompt: job.prompt || segment.aiVideoPrompt,
      aiVideoPromptInitialized: Boolean(job.prompt || segment.aiVideoPrompt),
      photoAnimationSourceAsset: cloneStudioCustomVideoFile(job.sourceAsset) ?? cloneStudioCustomVideoFile(segment.photoAnimationSourceAsset),
      videoAction: "photo_animation",
    }));
    logSegmentEditorDiagnostics("client.segment-editor.photo-animation.resume", {
      jobId: job.jobId,
      projectId: job.projectId,
      targetSegmentIndex: job.segmentIndex,
    });

    void pollSegmentEditorPhotoAnimationJob(job.jobId, job.status || "queued", {
      projectId: job.projectId,
      prompt: job.prompt,
      runId,
      segmentIndex: job.segmentIndex,
      sourceAsset: cloneStudioCustomVideoFile(job.sourceAsset),
    }).catch((error) => {
      if (segmentPhotoAnimationRunRef.current !== runId) {
        return;
      }

      setSegmentEditorVideoError(error instanceof Error ? error.message : "Не удалось анимировать фото сегмента.");
    });
    return true;
  };

  useEffect(() => {
    if (createMode !== "segment-editor" || !segmentEditorDraft) {
      return undefined;
    }

    const tryResumePendingPhotoAnimation = () => {
      if (segmentPhotoAnimationActiveJobIdRef.current) {
        return;
      }

      const currentDraft = segmentEditorDraftRef.current;
      if (!currentDraft) {
        return;
      }

      const pendingJob = readStoredWorkspaceSegmentPhotoAnimationJobs(session.email)
        .filter((job) => job.projectId === currentDraft.projectId)
        .sort((left, right) => left.createdAt - right.createdAt)[0] ?? null;
      if (!pendingJob) {
        return;
      }

      resumePendingSegmentPhotoAnimationJob(pendingJob);
    };

    tryResumePendingPhotoAnimation();
    const intervalId = window.setInterval(tryResumePendingPhotoAnimation, 30_000);
    const handleFocus = () => tryResumePendingPhotoAnimation();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        tryResumePendingPhotoAnimation();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [createMode, segmentEditorDraft?.projectId, segmentEditorDraft?.segments.length, session.email]);

  const handleSegmentEditorImageUpscale = async (
    options?: {
      segmentIndex?: number;
    },
  ) => {
    if (!segmentEditorDraft) {
      return;
    }

    const targetSegmentIndex = options?.segmentIndex ?? activeSegment?.index;
    if (typeof targetSegmentIndex !== "number") {
      return;
    }

    const targetSegment =
      segmentEditorDraft.segments.find((segment) => segment.index === targetSegmentIndex) ??
      (activeSegment?.index === targetSegmentIndex ? activeSegment : null);
    if (targetSegment && !canWorkspaceSegmentUsePhotoEditingTools(targetSegment)) {
      setSegmentEditorVideoError("Сначала выберите фото для сегмента.");
      return;
    }
    const upscaleSource = targetSegment ? getWorkspaceSegmentImageUpscaleSource(targetSegment) : null;

    if (!upscaleSource) {
      setSegmentEditorVideoError("Выберите фото сегмента, чтобы улучшить качество изображения.");
      return;
    }

    if (workspaceBalance !== null && workspaceBalance < STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST) {
      setSegmentEditorVideoError(null);
      openInsufficientCreditsModal("image_upscale", STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST);
      return;
    }

    const runId = segmentImageUpscaleRunRef.current + 1;
    segmentImageUpscaleRunRef.current = runId;
    setIsSegmentEditorUpscalingImage(true);
    setSegmentEditorUpscalingImageSegmentIndex(targetSegmentIndex);
    setSegmentEditorVideoError(null);
    setInsufficientCreditsContext(null);

    let pollStarted = false;

    try {
      const imageAssetId = await ensureStudioUploadedAssetId(upscaleSource.asset, {
        fallbackFileName: upscaleSource.fileName,
        fallbackMimeType: upscaleSource.asset.mimeType,
        kind: "segment_image",
        language: selectedLanguage,
        mediaType: "photo",
        projectId: segmentEditorDraft.projectId,
        role: "segment_source",
        segmentIndex: targetSegmentIndex,
      });
      if (!imageAssetId) {
        throw new Error("Не удалось подготовить изображение для улучшения качества.");
      }

      const response = await fetch("/api/studio/segment-image-upscale/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageAssetId,
          imageFileName: upscaleSource.fileName,
          language: selectedLanguage,
          projectId: segmentEditorDraft.projectId,
          segmentIndex: targetSegmentIndex,
        } satisfies WorkspaceSegmentImageUpscaleRequest),
      });
      const payload = (await response.json().catch(() => null)) as WorkspaceSegmentImageUpscaleJobCreateResponse | null;

      if (response.status === 402) {
        if (segmentImageUpscaleRunRef.current === runId) {
          setIsSegmentEditorUpscalingImage(false);
          setSegmentEditorUpscalingImageSegmentIndex(null);
        }
        openInsufficientCreditsModal("image_upscale", STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST);
        return;
      }

      if (!response.ok || !payload?.data?.jobId) {
        throw new Error(payload?.error ?? "Не удалось запустить улучшение качества изображения.");
      }

      if (segmentImageUpscaleRunRef.current !== runId) {
        return;
      }

      applyWorkspaceProfile(payload.data.profile);
      pollStarted = true;
      await pollSegmentEditorImageUpscaleJob(payload.data.jobId, payload.data.status, {
        runId,
        segmentIndex: targetSegmentIndex,
      });
    } catch (error) {
      if (segmentImageUpscaleRunRef.current !== runId) {
        return;
      }

      setSegmentEditorVideoError(error instanceof Error ? error.message : "Не удалось улучшить качество изображения.");
    } finally {
      if (!pollStarted && segmentImageUpscaleRunRef.current === runId) {
        setIsSegmentEditorUpscalingImage(false);
        setSegmentEditorUpscalingImageSegmentIndex(null);
      }
    }
  };

  const handleSegmentAiPhotoModalCustomVideoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    const targetSegmentIndex = segmentAiPhotoModalSegment?.index ?? activeSegment?.index;
    if (!file || typeof targetSegmentIndex !== "number") {
      return;
    }

    setSegmentAiPhotoModalTab("upload");
    const isApplied = await handleSegmentEditorCustomVideoSelect(file, {
      segmentIndex: targetSegmentIndex,
    });
    if (isApplied && isSegmentAiPhotoModalOpen) {
      closeSegmentAiPhotoModal();
    }
  };

  const handleSegmentAiPhotoModalGenerateScene = async (options?: { prompt?: string; segmentIndex?: number | null }) => {
    const targetSegmentIndex = options?.segmentIndex ?? segmentAiPhotoModalSegment?.index;
    if (typeof targetSegmentIndex !== "number") {
      return;
    }

    setSegmentAiPhotoModalTab("ai_photo");
    await handleSegmentEditorAiPhotoGenerate({
      prompt: options?.prompt ?? segmentAiPhotoModalPrompt,
      segmentIndex: targetSegmentIndex,
      shouldCloseModal: options?.segmentIndex === undefined,
    });
  };

  const handleSegmentAiVideoModalGenerate = async (options?: { prompt?: string; segmentIndex?: number | null }) => {
    const targetSegmentIndex = options?.segmentIndex ?? segmentAiPhotoModalSegment?.index;
    if (typeof targetSegmentIndex !== "number") {
      return;
    }

    setSegmentEditorVideoError(null);
    setSegmentAiPhotoModalTab("ai_video");
    await handleSegmentEditorAiVideoGenerate({
      prompt: options?.prompt ?? segmentAiVideoModalPrompt,
      segmentIndex: targetSegmentIndex,
      shouldCloseModal: options?.segmentIndex === undefined,
    });
  };

  const handleSegmentImageEditModalGenerate = async (options?: { prompt?: string; segmentIndex?: number | null }) => {
    const targetSegmentIndex = options?.segmentIndex ?? segmentAiPhotoModalSegment?.index;
    if (typeof targetSegmentIndex !== "number") {
      return;
    }

    setSegmentEditorVideoError(null);
    setSegmentAiPhotoModalTab("image_edit");
    await handleSegmentEditorImageEditGenerate({
      prompt: options?.prompt ?? segmentImageEditModalPrompt,
      segmentIndex: targetSegmentIndex,
      shouldCloseModal: options?.segmentIndex === undefined,
    });
  };

  const handleSegmentPhotoAnimationModalGenerate = async (options?: { prompt?: string; segmentIndex?: number | null }) => {
    const targetSegmentIndex = options?.segmentIndex ?? segmentAiPhotoModalSegment?.index;
    if (typeof targetSegmentIndex !== "number") {
      return;
    }

    setSegmentEditorVideoError(null);
    setSegmentAiPhotoModalTab("photo_animation");
    await handleSegmentEditorPhotoAnimationGenerate({
      prompt: options?.prompt ?? segmentAiVideoModalPrompt,
      segmentIndex: targetSegmentIndex,
      shouldCloseModal: options?.segmentIndex === undefined,
    });
  };

  const handleSegmentAiPhotoModalUpscaleImage = async (options?: { segmentIndex?: number | null }) => {
    const targetSegmentIndex = options?.segmentIndex ?? segmentAiPhotoModalSegment?.index;
    if (typeof targetSegmentIndex !== "number") {
      return;
    }

    setSegmentEditorVideoError(null);
    setSegmentAiPhotoModalTab("image_upscale");
    await handleSegmentEditorImageUpscale({
      segmentIndex: targetSegmentIndex,
    });
  };

  const handleSegmentAiPhotoModalImprovePrompt = async () => {
    if (isSegmentAiPhotoPromptImproving) {
      return;
    }

    const isAiVideoPromptTab = segmentAiPhotoModalTab === "ai_video" || segmentAiPhotoModalTab === "photo_animation";
    const isImageEditPromptTab = segmentAiPhotoModalTab === "image_edit";
    const improveMode: WorkspaceSegmentAiPhotoPromptImproveMode =
      segmentAiPhotoModalTab === "photo_animation"
        ? "photo_animation"
        : isAiVideoPromptTab
          ? "ai_video"
          : isImageEditPromptTab
            ? "image_edit"
            : "ai_photo";
    const sourcePrompt = isAiVideoPromptTab
      ? normalizedSegmentAiVideoModalPrompt || normalizeWorkspaceSegmentAiVideoPrompt(segmentAiPhotoModalScenarioPrompt)
      : isImageEditPromptTab
        ? normalizedSegmentImageEditModalPrompt || normalizeWorkspaceSegmentImageEditPrompt(segmentAiPhotoModalScenarioPrompt)
        : normalizedSegmentAiPhotoModalPrompt || normalizeWorkspaceSegmentAiPhotoPrompt(segmentAiPhotoModalScenarioPrompt);
    if (!sourcePrompt) {
      setSegmentEditorVideoError("Введите описание сцены или используйте текст сегмента.");
      return;
    }

    setSegmentEditorVideoError(null);
    setSegmentAiPhotoModalTab(
      isAiVideoPromptTab
        ? (segmentAiPhotoModalTab === "photo_animation" ? "photo_animation" : "ai_video")
        : isImageEditPromptTab
          ? "image_edit"
          : "ai_photo",
    );
    setIsSegmentAiPhotoPromptImproving(true);
    setIsSegmentAiPhotoPromptImproved(false);
    setIsSegmentAiPhotoPromptHighlighted(false);
    const runId = segmentAiPhotoPromptImproveRunRef.current + 1;
    segmentAiPhotoPromptImproveRunRef.current = runId;

    if (segmentAiPhotoPromptHighlightTimerRef.current) {
      window.clearTimeout(segmentAiPhotoPromptHighlightTimerRef.current);
      segmentAiPhotoPromptHighlightTimerRef.current = null;
    }

    try {
      const response = await fetch("/api/studio/segment-ai-photo/improve-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: selectedLanguage,
          mode: improveMode,
          prompt: sourcePrompt,
        } satisfies WorkspaceSegmentAiPhotoPromptImproveRequest),
      });
      const payload = (await response.json().catch(() => null)) as WorkspaceSegmentAiPhotoPromptImproveResponse | null;

      if (!response.ok || !payload?.data?.prompt) {
        throw new Error(payload?.error ?? "Не удалось улучшить промт.");
      }

      if (segmentAiPhotoPromptImproveRunRef.current !== runId) {
        return;
      }

      const improvedPrompt = payload.data.prompt;
      if (isAiVideoPromptTab) {
        setSegmentAiVideoModalPrompt(improvedPrompt);
        if (segmentAiPhotoModalSegment) {
          updateSegmentEditorDraftSegmentByIndex(segmentAiPhotoModalSegment.index, (segment) => ({
            ...segment,
            aiVideoPrompt: improvedPrompt,
            aiVideoPromptInitialized: true,
          }));
        }
      } else if (isImageEditPromptTab) {
        setSegmentImageEditModalPrompt(improvedPrompt);
        if (segmentAiPhotoModalSegment) {
          updateSegmentEditorDraftSegmentByIndex(segmentAiPhotoModalSegment.index, (segment) => ({
            ...segment,
            imageEditPrompt: improvedPrompt,
            imageEditPromptInitialized: true,
          }));
        }
      } else {
        setSegmentAiPhotoModalPrompt(improvedPrompt);
        if (segmentAiPhotoModalSegment) {
          updateSegmentEditorDraftSegmentByIndex(segmentAiPhotoModalSegment.index, (segment) => ({
            ...segment,
            aiPhotoPrompt: improvedPrompt,
            aiPhotoPromptInitialized: true,
          }));
        }
      }
      setIsSegmentAiPhotoPromptImproved(true);
      setIsSegmentAiPhotoPromptHighlighted(true);
      segmentAiPhotoPromptHighlightTimerRef.current = window.setTimeout(() => {
        if (segmentAiPhotoPromptImproveRunRef.current === runId) {
          setIsSegmentAiPhotoPromptHighlighted(false);
        }
        segmentAiPhotoPromptHighlightTimerRef.current = null;
      }, 1800);
    } catch (error) {
      if (segmentAiPhotoPromptImproveRunRef.current === runId) {
        setSegmentEditorVideoError(error instanceof Error ? error.message : "Не удалось улучшить промт.");
      }
    } finally {
      if (segmentAiPhotoPromptImproveRunRef.current === runId) {
        setIsSegmentAiPhotoPromptImproving(false);
      }
    }
  };

  const handleCreateShortsFromSegmentEditor = async () => {
    if (!segmentEditorDraft) {
      return;
    }

    logSegmentEditorDiagnostics("client.segment-editor.create-shorts.start", {
      segmentCount: segmentEditorDraft.segments.length,
    }, { includeOrder: true });

    const effectiveDraft = createWorkspaceSegmentEditorComparableDraftSession(
      segmentEditorDraft,
      segmentEditorChecklistBaseSession,
    );

    if (effectiveDraft.segments.length < WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS) {
      setSegmentEditorVideoError(`В редакторе должен остаться минимум ${WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS} сегмент.`);
      return;
    }

    if (effectiveDraft.segments.length > WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS) {
      setSegmentEditorVideoError(`Редактор поддерживает максимум ${WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS} сегментов.`);
      return;
    }

    if (workspaceBalance !== null && workspaceBalance < studioCreateRequiredCredits) {
      setSegmentEditorVideoError(null);
      openInsufficientCreditsModal("video_generation", studioCreateRequiredCredits);
      return;
    }

    const nextAppliedSession = (() => {
      const clonedSession = cloneWorkspaceSegmentEditorDraftSession(effectiveDraft);
      return {
        ...clonedSession,
        segments: rebuildWorkspaceSegmentEditorDraftTimeline(clonedSession.segments),
      };
    })();
    setSegmentEditorAppliedSession(nextAppliedSession);

    const regenerationPrompt = resolveWorkspaceRegenerationPrompt({
      draftDescription: effectiveDraft.description,
      generatedVideoAdId: generatedVideo?.adId ?? null,
      generatedVideoPrompt: generatedVideo?.prompt ?? null,
      projectId: effectiveDraft.projectId,
      projectPrompt: projects.find((project) => project.adId === effectiveDraft.projectId)?.prompt ?? null,
      topicInput,
    });
    if (!regenerationPrompt) {
      setSegmentEditorVideoError("Не удалось определить тему проекта для перегенерации.");
      return;
    }
    logSegmentEditorDiagnostics("client.segment-editor.create-shorts.apply", {
      projectId: effectiveDraft.projectId,
      regenerationPromptLength: regenerationPrompt.length,
      segmentCount: effectiveDraft.segments.length,
    }, { includeOrder: true, draft: effectiveDraft });
    await handleGenerate(regenerationPrompt, buildCurrentRegenerationOptions(nextAppliedSession));
  };

  const applyPublicationToLocalState = (
    videoProjectId: number,
    publication: WorkspaceProjectYouTubePublication | null,
  ) => {
    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.adId === videoProjectId
          ? {
              ...project,
              youtubePublication: publication,
            }
          : project,
      ),
    );

    setProjectPreviewModal((currentProject) =>
      currentProject && currentProject.adId === videoProjectId
        ? {
            ...currentProject,
            youtubePublication: publication,
          }
        : currentProject,
    );
  };

  const clearPersistedSegmentEditorDraftForProject = (projectId: number | null | undefined) => {
    const normalizedProjectId = Number(projectId);
    if (!Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
      return;
    }

    removeStoredWorkspaceSegmentEditorDraft(session.email, normalizedProjectId);
    setStoredSegmentEditorDrafts((currentDrafts) =>
      currentDrafts.filter((draft) => draft.projectId !== normalizedProjectId),
    );
  };

  const removeProjectFromLocalState = (targetProject: WorkspaceProject) => {
    setProjects((currentProjects) =>
      currentProjects.filter((project) => !doesWorkspaceProjectMatch(project, targetProject)),
    );
    if (targetProject.adId !== null) {
      clearPersistedSegmentEditorDraftForProject(targetProject.adId);
      setMediaLibraryItems((currentItems) =>
        currentItems.filter((item) => item.projectId !== targetProject.adId),
      );
    }
    setActiveProjectPreviewId((currentProjectId) =>
      currentProjectId === targetProject.id ? null : currentProjectId,
    );
    setProjectPreviewModal((currentProject) =>
      currentProject && doesWorkspaceProjectMatch(currentProject, targetProject) ? null : currentProject,
    );

    if (targetProject.adId !== null && publishTargetVideoProjectId === targetProject.adId) {
      closePublishModal();
      setPublishBootstrap(null);
      setPublishTargetVideoProjectId(null);
      setPublishTargetTitle("");
      setSelectedPublishChannelPk(null);
    }
  };

  const restoreProjectToLocalState = (targetProject: WorkspaceProject) => {
    setProjects((currentProjects) => {
      if (currentProjects.some((project) => doesWorkspaceProjectMatch(project, targetProject))) {
        return currentProjects;
      }

      const getProjectSortTime = (project: WorkspaceProject) => {
        const timestamp = Date.parse(project.updatedAt || project.createdAt);
        return Number.isNaN(timestamp) ? 0 : timestamp;
      };

      return [...currentProjects, targetProject].sort(
        (left, right) => getProjectSortTime(right) - getProjectSortTime(left),
      );
    });
  };

  const requestProjectDelete = (project: WorkspaceProject) => {
    if (pendingProjectDeleteIdsRef.current.has(project.id) || isProjectDeleteSubmitting) {
      return;
    }

    setProjectDeleteError(null);
    setProjectPendingDelete(project);
    setProjectPendingDeleteProjects([project]);
  };

  const requestProjectStackDelete = (targetProjects: WorkspaceProject[]) => {
    const projectsToDelete = targetProjects.filter(
      (project, index, array) =>
        !pendingProjectDeleteIdsRef.current.has(project.id) &&
        array.findIndex((candidate) => candidate.id === project.id) === index,
    );

    if (isProjectDeleteSubmitting || projectsToDelete.length === 0) {
      return;
    }

    setProjectDeleteError(null);
    setProjectPendingDelete(projectsToDelete[0] ?? null);
    setProjectPendingDeleteProjects(projectsToDelete);
  };

  const handleDeleteProject = async () => {
    const project = projectPendingDelete;
    if (!project) {
      return;
    }

    const projectsToDelete = (projectPendingDeleteProjects.length > 0 ? projectPendingDeleteProjects : [project]).filter(
      (targetProject, index, array) => array.findIndex((candidate) => candidate.id === targetProject.id) === index,
    );

    if (
      projectsToDelete.length === 0 ||
      projectsToDelete.some((targetProject) => pendingProjectDeleteIdsRef.current.has(targetProject.id))
    ) {
      return;
    }

    setProjectDeleteError(null);
    setIsProjectDeleteSubmitting(true);
    projectsToDelete.forEach((targetProject) => {
      pendingProjectDeleteIdsRef.current.add(targetProject.id);
      removeProjectFromLocalState(targetProject);
    });

    try {
      const results = await Promise.all(
        projectsToDelete.map(async (targetProject) => {
          try {
            const response = await fetch(`/api/workspace/projects/${encodeURIComponent(targetProject.id)}`, {
              method: "DELETE",
            });
            const payload = (await response.json().catch(() => null)) as WorkspaceProjectDeleteResponse | null;

            if (!response.ok || !payload?.data) {
              throw new Error(payload?.error ?? "Не удалось удалить проект.");
            }

            return { project: targetProject, status: "fulfilled" as const };
          } catch (error) {
            return {
              error: error instanceof Error ? error.message : "Не удалось удалить проект.",
              project: targetProject,
              status: "rejected" as const,
            };
          }
        }),
      );
      const failedResults = results.filter((result): result is Extract<(typeof results)[number], { status: "rejected" }> =>
        result.status === "rejected",
      );

      if (failedResults.length > 0) {
        failedResults.forEach((result) => restoreProjectToLocalState(result.project));
        setProjectPendingDelete(failedResults[0]?.project ?? null);
        setProjectPendingDeleteProjects(failedResults.map((result) => result.project));
        if (failedResults.length !== projectsToDelete.length) {
          setHasLoadedProjects(false);
        }
        throw new Error(failedResults[0]?.error ?? "Не удалось удалить проект.");
      }

      setProjectPendingDelete(null);
      setProjectPendingDeleteProjects([]);
      const deletedAdIds = new Set(projectsToDelete.flatMap((targetProject) => (targetProject.adId !== null ? [targetProject.adId] : [])));
      setSegmentEditorDraft((currentDraft) =>
        currentDraft && deletedAdIds.has(currentDraft.projectId) ? null : currentDraft,
      );
      setMediaLibraryReloadToken((currentToken) => currentToken + 1);
    } catch (error) {
      setMediaLibraryReloadToken((currentToken) => currentToken + 1);
      setProjectDeleteError(error instanceof Error ? error.message : "Не удалось удалить проект.");
    } finally {
      projectsToDelete.forEach((targetProject) => pendingProjectDeleteIdsRef.current.delete(targetProject.id));
      setIsProjectDeleteSubmitting(false);
    }
  };

  const buildOptimisticPublishBootstrap = (
    videoProjectId: number,
    fallbackTitle: string,
  ): WorkspacePublishBootstrapPayload => {
    const matchingProject = projects.find((project) => project.adId === videoProjectId) ?? null;
    const matchingGeneration = generatedVideo?.adId === videoProjectId ? generatedVideo : null;
    const optimisticHashtags =
      matchingProject?.hashtags.length
        ? matchingProject.hashtags
        : matchingGeneration?.hashtags.length
          ? matchingGeneration.hashtags
          : [];
    const optimisticPublication =
      matchingProject?.youtubePublication ??
      (previewModalPublishTargetAdId === videoProjectId ? previewModalPublication : null) ??
      null;

    return {
      channels: [],
      defaults: {
        description: matchingProject?.description ?? matchingGeneration?.description ?? "",
        hashtags: optimisticHashtags.join(" ").trim(),
        publishAt: optimisticPublication?.scheduledAt ?? null,
        title: matchingProject?.title ?? matchingGeneration?.title ?? fallbackTitle,
      },
      publication: optimisticPublication,
      selectedChannelPk: null,
      videoProjectId,
    };
  };

  const openPublishModalForVideoProject = async (videoProjectId: number, title: string, initialError?: string | null) => {
    publishRunRef.current += 1;
    const runId = publishRunRef.current;
    const optimisticBootstrap = buildOptimisticPublishBootstrap(videoProjectId, title);
    const optimisticPublishMode = optimisticBootstrap.defaults.publishAt ? "schedule" : "now";
    const optimisticScheduledAtInput = formatDateTimeLocalValue(optimisticBootstrap.defaults.publishAt);

    setIsPublishModalOpen(true);
    setIsPublishBootstrapLoading(true);
    setPublishBootstrap(optimisticBootstrap);
    setPublishJobStatus(
      optimisticBootstrap.publication
        ? {
            jobId: "",
            publication: optimisticBootstrap.publication,
            status: optimisticBootstrap.publication.state ?? "done",
            videoProjectId: optimisticBootstrap.videoProjectId,
          }
        : null,
    );
    setPublishBootstrapError(null);
    setPublishError(initialError ?? null);
    setPublishTargetVideoProjectId(videoProjectId);
    setPublishTargetTitle(title);
    setSelectedPublishChannelPk(null);
    setPublishTitle(optimisticBootstrap.defaults.title);
    setPublishDescription(optimisticBootstrap.defaults.description);
    setPublishHashtags(optimisticBootstrap.defaults.hashtags);
    setPublishMode(optimisticPublishMode);
    setPublishScheduledAtInput(optimisticScheduledAtInput);
    setPublishCalendarMonth(
      startOfPublishMonth(parsePublishDateTimeLocalValue(optimisticScheduledAtInput) ?? createDefaultPublishScheduleDate()),
    );

    try {
      const response = await fetch("/api/workspace/publish/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoProjectId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as WorkspacePublishBootstrapResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Не удалось загрузить настройки публикации.");
      }

      if (publishRunRef.current !== runId) {
        return;
      }

      const currentFormSnapshot = publishFormSnapshotRef.current;
      const nextPublishMode = payload.data.defaults.publishAt ? "schedule" : "now";
      setPublishBootstrap(payload.data);
      setSelectedPublishChannelPk(payload.data.selectedChannelPk);
      const initialScheduledAtInput = formatDateTimeLocalValue(payload.data.defaults.publishAt);
      if (currentFormSnapshot.title === optimisticBootstrap.defaults.title) {
        setPublishTitle(payload.data.defaults.title);
      }
      if (currentFormSnapshot.description === optimisticBootstrap.defaults.description) {
        setPublishDescription(payload.data.defaults.description);
      }
      if (currentFormSnapshot.hashtags === optimisticBootstrap.defaults.hashtags) {
        setPublishHashtags(payload.data.defaults.hashtags);
      }
      if (currentFormSnapshot.mode === optimisticPublishMode) {
        setPublishMode(nextPublishMode);
      }
      if (currentFormSnapshot.scheduledAtInput === optimisticScheduledAtInput) {
        setPublishScheduledAtInput(initialScheduledAtInput);
        setPublishCalendarMonth(
          startOfPublishMonth(parsePublishDateTimeLocalValue(initialScheduledAtInput) ?? createDefaultPublishScheduleDate()),
        );
      }
      setPublishJobStatus(
        payload.data.publication
          ? {
              jobId: "",
              publication: payload.data.publication,
              status: payload.data.publication.state ?? "done",
              videoProjectId: payload.data.videoProjectId,
            }
          : null,
      );
      applyPublicationToLocalState(payload.data.videoProjectId, payload.data.publication);
    } catch (error) {
      if (publishRunRef.current !== runId) {
        return;
      }
      setPublishBootstrapError(error instanceof Error ? error.message : "Не удалось загрузить настройки публикации.");
    } finally {
      if (publishRunRef.current === runId) {
        setIsPublishBootstrapLoading(false);
      }
    }
  };

  const pollPublishJob = async (jobId: string) => {
    publishRunRef.current += 1;
    const runId = publishRunRef.current;

    setIsPublishSubmitting(true);
    setPublishError(null);

    try {
      while (publishRunRef.current === runId) {
        const response = await fetch(`/api/workspace/publish/jobs/${encodeURIComponent(jobId)}`);
        const payload = (await response.json().catch(() => null)) as WorkspacePublishJobStatusResponse | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error ?? "Не удалось получить статус публикации.");
        }

        const publishData = payload.data;
        setPublishJobStatus(publishData);

        if (publishData.publication && publishData.videoProjectId) {
          setPublishBootstrap((currentBootstrap) =>
            currentBootstrap && currentBootstrap.videoProjectId === publishData.videoProjectId
              ? {
                  ...currentBootstrap,
                  publication: publishData.publication,
                }
              : currentBootstrap,
          );
          applyPublicationToLocalState(publishData.videoProjectId, publishData.publication);
        }

        if (publishData.status === "done") {
          setHasLoadedProjects(false);
          break;
        }

        if (publishData.status === "failed") {
          throw new Error(publishData.error ?? "Публикация завершилась с ошибкой.");
        }

        await new Promise((resolve) => window.setTimeout(resolve, 2500));
      }
    } catch (error) {
      if (publishRunRef.current !== runId) return;
      setPublishError(error instanceof Error ? error.message : "Не удалось опубликовать видео.");
    } finally {
      if (publishRunRef.current === runId) {
        setIsPublishSubmitting(false);
      }
    }
  };

  const handleStartYouTubeConnect = async () => {
    if (!publishTargetVideoProjectId) return;

    setPublishError(null);

    try {
      const response = await fetch("/api/workspace/youtube/connect-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoProjectId: publishTargetVideoProjectId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { data?: { url?: string }; error?: string } | null;

      if (!response.ok || !payload?.data?.url) {
        throw new Error(payload?.error ?? "Не удалось открыть YouTube OAuth.");
      }

      window.location.assign(payload.data.url);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Не удалось открыть YouTube OAuth.");
    }
  };

  const handleDisconnectPublishChannel = async () => {
    if (!publishTargetVideoProjectId || !selectedPublishChannelPk) {
      return;
    }

    setPublishError(null);
    setIsDisconnectingPublishChannel(true);

    try {
      const response = await fetch("/api/workspace/youtube/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelPk: selectedPublishChannelPk,
          videoProjectId: publishTargetVideoProjectId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as WorkspacePublishBootstrapResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Не удалось отключить YouTube-канал.");
      }

      setPublishBootstrap(payload.data);
      setSelectedPublishChannelPk(payload.data.selectedChannelPk);
      setPublishJobStatus(
        payload.data.publication
          ? {
              jobId: publishJobStatus?.jobId ?? "",
              publication: payload.data.publication,
              status: publishJobStatus?.status ?? payload.data.publication.state ?? "done",
              videoProjectId: payload.data.videoProjectId,
            }
          : null,
      );
      applyPublicationToLocalState(payload.data.videoProjectId, payload.data.publication);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Не удалось отключить YouTube-канал.");
    } finally {
      setIsDisconnectingPublishChannel(false);
    }
  };

  const handleSubmitPublish = async () => {
    if (!publishTargetVideoProjectId) return;

    if (!selectedPublishChannelPk) {
      setPublishError("Выберите YouTube-канал.");
      return;
    }

    if (!publishTitle.trim()) {
      setPublishError("Введите заголовок для YouTube.");
      return;
    }

    const publishAt = publishMode === "schedule" ? normalizePublishDateTimeInput(publishScheduledAtInput) : null;
    if (publishMode === "schedule" && !publishAt) {
      setPublishError("Выберите корректное время публикации.");
      return;
    }

    setPublishError(null);

    try {
      const response = await fetch("/api/workspace/publish/youtube", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelPk: selectedPublishChannelPk,
          description: publishDescription,
          hashtags: publishHashtags,
          publishAt,
          title: publishTitle,
          videoProjectId: publishTargetVideoProjectId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as WorkspacePublishStartResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Не удалось запустить публикацию.");
      }

      setPublishJobStatus({
        jobId: payload.data.jobId,
        publication: publishBootstrap?.publication ?? null,
        status: payload.data.status,
        videoProjectId: payload.data.videoProjectId,
      });
      if (payload.data.enqueueError) {
        setPublishError(`Очередь публикации ответила с предупреждением: ${payload.data.enqueueError}`);
      }

      await pollPublishJob(payload.data.jobId);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Не удалось запустить публикацию.");
    }
  };

  const pollGenerationJob = async (
    jobId: string,
    initialStatus = "queued",
    options?: {
      clearAppliedSegmentEditorOnSuccess?: boolean;
      clearStoredSegmentEditorDraftProjectId?: number | null;
      invalidateSegmentEditorOnSuccess?: boolean;
      openStudioCreateOnSuccess?: boolean;
      showSegmentEditorGenerationError?: boolean;
    },
  ) => {
    const safeJobId = jobId.trim();

    if (!safeJobId) {
      setGenerateError("Generation job is missing.");
      setStatus("Generation failed");
      return;
    }

    setIsGenerating(true);
    setStatus(getStudioStatusLabel(initialStatus));
    generationRunRef.current += 1;
    const runId = generationRunRef.current;

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    try {
      let latestStatus = initialStatus;
      let doneWithoutPreviewAttempts = 0;
      const maxDoneWithoutPreviewAttempts = 4;

      while (generationRunRef.current === runId) {
        const statusResponse = await fetch(`/api/studio/generations/${encodeURIComponent(safeJobId)}`);
        const statusPayload = (await statusResponse.json().catch(() => null)) as StudioGenerationStatusResponse | null;

        if (!statusResponse.ok || !statusPayload?.data) {
          throw new Error(statusPayload?.error ?? "Failed to fetch generation status.");
        }

        latestStatus = statusPayload.data.status;
        setStatus(getStudioStatusLabel(latestStatus));

        if (statusPayload.data.generation) {
          doneWithoutPreviewAttempts = 0;
          setGeneratedVideo(statusPayload.data.generation);
          setTopicInput("");
          updateDismissedStudioPreviewKey(null);
          setGenerateError(statusPayload.data.error ?? null);
          if (options?.invalidateSegmentEditorOnSuccess) {
            setSegmentEditorLoadedSession(null);
          }
          if (options?.clearAppliedSegmentEditorOnSuccess) {
            segmentEditorRouteRestoreKeyRef.current = null;
            segmentEditorHandledRouteRestoreKeyRef.current = null;
            clearDetachedSegmentEditorDraft();
            clearPersistedSegmentEditorDraftForProject(options?.clearStoredSegmentEditorDraftProjectId);
            setCreateMode("default");
            setSegmentEditorAppliedSession(null);
            setSegmentEditorDraft(null);
            setSegmentEditorVideoError(null);
          }
          if (options?.openStudioCreateOnSuccess) {
            setActiveTab("studio");
            setStudioView("create");
            setCreateMode("default");
            syncStudioRouteSection("create", { replace: true });
          }
          setStatus("");
          break;
        }

        if (latestStatus === "done") {
          doneWithoutPreviewAttempts += 1;

          if (doneWithoutPreviewAttempts < maxDoneWithoutPreviewAttempts) {
            console.warn("[workspace] Generation is done but preview payload is not ready yet", {
              attempt: doneWithoutPreviewAttempts,
              jobId: safeJobId,
              status: latestStatus,
            });
            setGenerateError(null);
            setStatus("Подготавливаем превью...");
            await new Promise((resolve) => window.setTimeout(resolve, 1500));
            continue;
          }

          throw new Error(statusPayload.data.error ?? "Готовое видео недоступно для встроенного превью.");
        }

        if (latestStatus === "failed") {
          throw new Error(statusPayload.data.error ?? "Generation failed.");
        }

        await new Promise((resolve) => window.setTimeout(resolve, 2500));
      }

      if (generationRunRef.current !== runId) {
        return;
      }

      resetTimerRef.current = window.setTimeout(() => {
        setStatus("Ready to generate");
        resetTimerRef.current = null;
      }, 2200);
    } catch (error) {
      if (generationRunRef.current !== runId) {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : "Failed to generate task.";
      setStatus("Generation failed");
      setGenerateError(errorMessage);
      if (options?.showSegmentEditorGenerationError) {
        setSegmentEditorVideoError(errorMessage);
      }
    } finally {
      if (generationRunRef.current === runId) {
        setIsGenerating(false);
      }
    }
  };

  const handleContentPlanQueryInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setHasEditedContentPlanQueryInput(true);
    setContentPlanQueryInput(event.target.value);
  };

  const handleToggleContentPlanVisibility = () => {
    updateContentPlanVisibility(!isContentPlanVisible);
  };

  const handleClearComposerSourceIdea = () => {
    setComposerSourceIdea(null);
    setSelectedContentPlanIdeaId(null);
  };

  const handleSelectContentPlanIdea = (plan: WorkspaceContentPlan, idea: WorkspaceContentPlanIdea) => {
    if (selectedContentPlanIdeaId === idea.id) {
      handleClearComposerSourceIdea();
      return;
    }

    const nextPrompt = sanitizeWorkspaceContentPlanIdeaPrompt(idea.prompt);
    setTopicInput(nextPrompt);
    setGenerateError(null);
    setActiveContentPlanId(plan.id);
    setSelectedContentPlanIdeaId(idea.id);
    setComposerSourceIdea({
      ideaId: idea.id,
      planId: plan.id,
      prompt: nextPrompt,
      title: idea.title,
    });
  };

  const persistContentPlanIdeaUsedState = async (
    plan: WorkspaceContentPlan,
    idea: WorkspaceContentPlanIdea,
    nextIsUsed: boolean,
    options?: {
      silentError?: boolean;
      trackBusy?: boolean;
    },
  ) => {
    if (idea.isUsed === nextIsUsed) {
      return true;
    }

    const optimisticTimestamp = new Date().toISOString();
    const rollbackPayload: WorkspaceContentPlanIdeaMutation = {
      ideaId: idea.id,
      ideaUpdatedAt: idea.updatedAt,
      isUsed: idea.isUsed,
      planId: plan.id,
      planUpdatedAt: plan.updatedAt,
      usedAt: idea.usedAt,
    };
    const optimisticPayload: WorkspaceContentPlanIdeaMutation = {
      ideaId: idea.id,
      ideaUpdatedAt: optimisticTimestamp,
      isUsed: nextIsUsed,
      planId: plan.id,
      planUpdatedAt: optimisticTimestamp,
      usedAt: nextIsUsed ? optimisticTimestamp : null,
    };

    setContentPlans((current) => applyWorkspaceContentPlanIdeaUpdate(current, optimisticPayload));
    if (options?.trackBusy) {
      setContentPlanUpdatingIdeaId(idea.id);
    }

    try {
      const response = await fetch(`/api/workspace/content-plans/${encodeURIComponent(plan.id)}/ideas/${encodeURIComponent(idea.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isUsed: nextIsUsed,
        }),
      });
      const payload = (await response.json().catch(() => null)) as WorkspaceContentPlanIdeaUpdateResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Не удалось обновить статус идеи.");
      }

      const updatedIdea = payload.data;
      setContentPlans((current) =>
        applyWorkspaceContentPlanIdeaUpdate(current, {
          ideaId: updatedIdea.ideaId,
          ideaUpdatedAt: updatedIdea.updatedAt,
          isUsed: updatedIdea.isUsed,
          planId: updatedIdea.planId,
          planUpdatedAt: updatedIdea.updatedAt,
          usedAt: updatedIdea.usedAt,
        }),
      );
      return true;
    } catch (error) {
      setContentPlans((current) => applyWorkspaceContentPlanIdeaUpdate(current, rollbackPayload));
      if (!options?.silentError) {
        setContentPlansError(error instanceof Error ? error.message : "Не удалось обновить статус идеи.");
      }
      return false;
    } finally {
      if (options?.trackBusy) {
        setContentPlanUpdatingIdeaId((current) => (current === idea.id ? null : current));
      }
    }
  };

  const handleToggleContentPlanIdeaUsed = async (plan: WorkspaceContentPlan, idea: WorkspaceContentPlanIdea) => {
    setContentPlansError(null);
    await persistContentPlanIdeaUsedState(plan, idea, !idea.isUsed, {
      trackBusy: true,
    });
  };

  const handleDeleteContentPlanIdea = async (plan: WorkspaceContentPlan, idea: WorkspaceContentPlanIdea) => {
    if (typeof window !== "undefined" && !window.confirm(`Удалить идею «${idea.title}»?`)) {
      return;
    }

    const previousPlans = contentPlans;
    const previousSelectedIdeaId = selectedContentPlanIdeaId;
    const previousComposerSourceIdea = composerSourceIdea;
    const optimisticUpdatedAt = new Date().toISOString();

    setContentPlansError(null);
    setContentPlanDeletingIdeaId(idea.id);
    setContentPlans((current) =>
      removeWorkspaceContentPlanIdea(current, {
        ideaId: idea.id,
        planId: plan.id,
        updatedAt: optimisticUpdatedAt,
      }),
    );

    if (selectedContentPlanIdeaId === idea.id) {
      setSelectedContentPlanIdeaId(null);
    }

    if (composerSourceIdea?.ideaId === idea.id) {
      setComposerSourceIdea(null);
    }

    try {
      const response = await fetch(`/api/workspace/content-plans/${encodeURIComponent(plan.id)}/ideas/${encodeURIComponent(idea.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as WorkspaceContentPlanIdeaDeleteResponse | null;

      if (!response.ok || !payload?.data || payload.data.ideaId !== idea.id || payload.data.planId !== plan.id) {
        throw new Error(payload?.error ?? "Не удалось удалить идею.");
      }

      const deletedIdea = payload.data;
      setContentPlans((current) => removeWorkspaceContentPlanIdea(current, deletedIdea));
    } catch (error) {
      setContentPlans(previousPlans);
      setSelectedContentPlanIdeaId(previousSelectedIdeaId);
      setComposerSourceIdea(previousComposerSourceIdea);
      setContentPlansError(error instanceof Error ? error.message : "Не удалось удалить идею.");
    } finally {
      setContentPlanDeletingIdeaId((current) => (current === idea.id ? null : current));
    }
  };

  const handleDeleteContentPlan = async (plan: WorkspaceContentPlan) => {
    if (typeof window !== "undefined" && !window.confirm(`Удалить контент-план «${plan.query}»?`)) {
      return;
    }

    const previousPlans = contentPlans;
    const previousActivePlanId = activeContentPlanId;
    const previousExpandedUsedIdeasPlanId = expandedContentPlanUsedIdeasPlanId;
    const previousSelectedIdeaId = selectedContentPlanIdeaId;
    const previousComposerSourceIdea = composerSourceIdea;
    const nextPlans = contentPlans.filter((item) => item.id !== plan.id);

    setContentPlansError(null);
    setContentPlanDeletingPlanId(plan.id);
    setContentPlans(nextPlans);
    setActiveContentPlanId((current) => (current === plan.id ? nextPlans[0]?.id ?? null : current));
    setExpandedContentPlanUsedIdeasPlanId((current) => (current === plan.id ? null : current));

    if (composerSourceIdea?.planId === plan.id) {
      setComposerSourceIdea(null);
      setSelectedContentPlanIdeaId(null);
    }

    try {
      const response = await fetch(`/api/workspace/content-plans/${encodeURIComponent(plan.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { data?: { planId: string }; error?: string } | null;

      if (!response.ok || payload?.data?.planId !== plan.id) {
        throw new Error(payload?.error ?? "Не удалось удалить контент-план.");
      }
    } catch (error) {
      setContentPlans(previousPlans);
      setActiveContentPlanId(previousActivePlanId);
      setExpandedContentPlanUsedIdeasPlanId(previousExpandedUsedIdeasPlanId);
      setSelectedContentPlanIdeaId(previousSelectedIdeaId);
      setComposerSourceIdea(previousComposerSourceIdea);
      setContentPlansError(error instanceof Error ? error.message : "Не удалось удалить контент-план.");
    } finally {
      setContentPlanDeletingPlanId((current) => (current === plan.id ? null : current));
    }
  };

  const handleGenerateContentPlan = async (options?: { appendToPlanId?: string; query?: string }) => {
    const nextQuery = String(options?.query ?? contentPlanQueryInput).trim();
    const nextCount = WORKSPACE_CONTENT_PLAN_IDEA_COUNT_DEFAULT;
    const appendToPlanId = String(options?.appendToPlanId ?? "").trim();
    if (!nextQuery) {
      setContentPlansError("Введите тему для контент-плана.");
      return;
    }

    setHasEditedContentPlanQueryInput(true);
    setContentPlanQueryInput(nextQuery);
    setContentPlansError(null);
    setIsContentPlanGenerating(true);

    try {
      const response = await fetch("/api/workspace/content-plans/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          count: nextCount,
          ...(appendToPlanId ? { planId: appendToPlanId } : {}),
          query: nextQuery,
        }),
      });
      const payload = (await response.json().catch(() => null)) as WorkspaceContentPlanResponse | null;

      if (!response.ok || !payload?.data?.plan) {
        throw new Error(payload?.error ?? "Не удалось сгенерировать контент-план.");
      }

      const nextPlan = payload.data.plan;
      setContentPlans((current) => [nextPlan, ...current.filter((plan) => plan.id !== nextPlan.id)]);
      setActiveContentPlanId(nextPlan.id);
      if (!appendToPlanId) {
        setExpandedContentPlanUsedIdeasPlanId(null);
      }
      setHasLoadedContentPlans(true);
      updateContentPlanVisibility(true);
    } catch (error) {
      setContentPlansError(error instanceof Error ? error.message : "Не удалось сгенерировать контент-план.");
    } finally {
      setIsContentPlanGenerating(false);
    }
  };

  const handleRegenerateContentPlan = async (plan: WorkspaceContentPlan) => {
    setHasEditedContentPlanQueryInput(true);
    setContentPlanQueryInput(plan.query);
    await handleGenerateContentPlan({
      appendToPlanId: plan.id,
      query: plan.query,
    });
  };

  const handleRetryContentPlansLoad = () => {
    setContentPlansError(null);
    setHasLoadedContentPlans(false);
  };

  const handleGenerate = async (
    nextTopic: string,
    options?: {
      clearAppliedSegmentEditorOnSuccess?: boolean;
      editedFromProjectAdId?: number;
      isRegeneration?: boolean;
      musicType?: StudioMusicType | string;
      projectId?: number;
      segmentEditor?: WorkspaceSegmentEditorPayload;
      segmentEditorSession?: WorkspaceSegmentEditorDraftSession | null;
      subtitleEnabled?: boolean;
      subtitleColorId?: string;
      subtitleStyleId?: string;
      versionRootProjectAdId?: number;
      voiceEnabled?: boolean;
      voiceId?: string;
    },
  ) => {
    const isSegmentEditorGeneration = Boolean(options?.segmentEditorSession);
    const effectiveVideoMode =
      isSegmentEditorGeneration && selectedVideoMode === "custom" && !selectedCustomVideo
        ? "standard"
        : selectedVideoMode;
    const reportGeneratePreflightFailure = (errorMessage: string, statusLabel: string) => {
      console.warn("[studio] generate.preflight-blocked", {
        effectiveVideoMode,
        errorMessage,
        isSegmentEditorGeneration,
        projectId: options?.projectId ?? null,
        requestedMusicType: options?.musicType ?? null,
        selectedVideoMode,
        statusLabel,
      });
      setGenerateError(errorMessage);
      setStatus(statusLabel);
      if (isSegmentEditorGeneration) {
        setSegmentEditorVideoError(errorMessage);
      }
    };
    console.info("[studio] generate.start", {
      createMode,
      brandLogoSelected: Boolean(selectedBrandLogo),
      brandLogoHasDataUrl: Boolean(String(selectedBrandLogo?.dataUrl ?? "").trim()),
      brandTextLength: brandText.trim().length,
      effectiveVideoMode,
      isRegeneration: Boolean(options?.isRegeneration),
      projectId: options?.projectId ?? null,
      promptLength: nextTopic.trim().length,
      hasSegmentEditorSession: Boolean(options?.segmentEditorSession),
      selectedVideoMode,
    });
    preserveExamplePrefillRef.current = false;
    const requiredCredits = getRequiredCreditsForVideoMode(effectiveVideoMode);

    if (workspaceBalance !== null && workspaceBalance < requiredCredits) {
      setGenerateError(null);
      setStatus("Credits required");
      openInsufficientCreditsModal("video_generation", requiredCredits);
      return;
    }

    const safeTopic = nextTopic.trim();

    if (!safeTopic.trim()) {
      reportGeneratePreflightFailure("Введите prompt для генерации.", "Prompt required");
      return;
    }

    if (isPreparingCustomVideo || isPreparingCustomMusic || isPreparingBrandLogo) {
      if (isPreparingCustomVideo) {
        reportGeneratePreflightFailure("Подождите, пока видеофайл загрузится в студию.", "Video preparing");
        return;
      }

      if (isPreparingBrandLogo) {
        reportGeneratePreflightFailure("Подождите, пока логотип подготовится в студии.", "Brand preparing");
        return;
      }

      reportGeneratePreflightFailure("Подождите, пока аудиофайл загрузится в студию.", "Audio preparing");
      return;
    }

    if (
      isSegmentEditorPreparingCustomVideo ||
      isSegmentEditorGeneratingAiPhoto ||
      isSegmentEditorGeneratingImageEdit ||
      isSegmentEditorGeneratingAiVideo ||
      isSegmentEditorGeneratingPhotoAnimation ||
      isSegmentEditorUpscalingImage
    ) {
      if (isSegmentEditorGeneratingAiPhoto) {
        reportGeneratePreflightFailure("Подождите, пока ИИ фото создаётся для сегмента.", "AI photo preparing");
        return;
      }

      if (isSegmentEditorGeneratingImageEdit) {
        reportGeneratePreflightFailure("Подождите, пока дорисовка фото выполняется для сегмента.", "Image edit preparing");
        return;
      }

      if (isSegmentEditorGeneratingAiVideo) {
        reportGeneratePreflightFailure("Подождите, пока ИИ видео создаётся для сегмента.", "AI video preparing");
        return;
      }

      if (isSegmentEditorGeneratingPhotoAnimation) {
        reportGeneratePreflightFailure("Подождите, пока ИИ анимация фото создаётся для сегмента.", "Photo animation preparing");
        return;
      }

      if (isSegmentEditorUpscalingImage) {
        reportGeneratePreflightFailure("Подождите, пока качество изображения улучшается для сегмента.", "Image upscaling");
        return;
      }

      reportGeneratePreflightFailure("Подождите, пока видео сегмента загрузится в редактор.", "Video preparing");
      return;
    }

    if (effectiveVideoMode === "custom" && !selectedCustomVideo) {
      reportGeneratePreflightFailure("Загрузите свой визуал или выберите другой режим создания.", "Video required");
      return;
    }

    const effectiveMusicRequest = resolveWorkspaceGenerationMusicRequest({
      requestedMusicType: options?.musicType ?? null,
      segmentEditorSession: options?.segmentEditorSession
        ? {
            customMusicAssetId: options.segmentEditorSession.customMusicAssetId,
            customMusicFileName: options.segmentEditorSession.customMusicFileName,
          }
        : null,
      selectedCustomMusic,
      selectedMusicType,
    });
    const effectiveMusicType = effectiveMusicRequest.effectiveMusicType;
    const effectiveSubtitleEnabled = options?.subtitleEnabled ?? areSubtitlesEnabled;
    const effectiveVoiceEnabled = options?.voiceEnabled ?? isVoiceoverEnabled;
    const effectiveSubtitleColorId = effectiveSubtitleEnabled ? options?.subtitleColorId ?? selectedSubtitleColorId : undefined;
    const effectiveSubtitleStyleId = effectiveSubtitleEnabled ? options?.subtitleStyleId ?? selectedSubtitleStyleId : undefined;
    const effectiveVoiceId = effectiveVoiceEnabled ? options?.voiceId ?? (resolvedSelectedVoiceId || undefined) : undefined;

    if (effectiveMusicRequest.requiresCustomMusic && !effectiveMusicRequest.hasAnyCustomMusicSource) {
      reportGeneratePreflightFailure("Загрузите свой аудиофайл или выберите другой режим музыки.", "Music required");
      return;
    }

    const currentComposerSourceIdea = isWorkspaceContentPlanSourceIdeaSynchronized(safeTopic, composerSourceIdea)
      ? composerSourceIdea
        ? { ...composerSourceIdea }
        : null
      : null;

    flushSync(() => {
      if (isSegmentEditorGeneration) {
        stashCurrentSegmentEditorDraft();
        segmentEditorRouteRestoreKeyRef.current = null;
        segmentEditorHandledRouteRestoreKeyRef.current = null;
        resetSegmentEditorPreviewPlaybackState({ clearRefs: true });
      }
      previewVideoRef.current?.pause();
      resetStudioPreviewPlaybackPosition();
      stopPreviewModalVideoElement(previewModalVideoRef.current);
      setTopicInput(safeTopic);
      updateDismissedStudioPreviewKey(null);
      if (!currentComposerSourceIdea && composerSourceIdea) {
        setComposerSourceIdea(null);
        setSelectedContentPlanIdeaId((current) => (current === composerSourceIdea.ideaId ? null : current));
      }
        setGeneratedVideo(null);
      if (!isSegmentEditorGeneration) {
          setSegmentEditorLoadedSession(null);
          setSegmentEditorAppliedSession(null);
      }
      setIsGenerating(true);
      setIsPreviewModalOpen(false);
      setGenerateError(null);
      setInsufficientCreditsContext(null);
      setVideoSelectionError(null);
      setMusicSelectionError(null);
      setBrandSelectionError(null);
      setSegmentEditorError(null);
      setSegmentEditorVideoError(null);
      segmentAiPhotoRunRef.current += 1;
      setIsSegmentEditorGeneratingAiPhoto(false);
      setSegmentEditorGeneratingAiPhotoSegmentIndex(null);
      closeSegmentAiPhotoModal({ immediate: true });
        setSegmentEditorDraft(null);
        setCreateMode("default");
      setHasLoadedProjects(false);
      setStatus(options?.segmentEditorSession ? "Подготавливаем сегменты..." : "Task queued");
    });

    if (location.pathname.startsWith("/app/studio")) {
      const currentStudioUrl = `${location.pathname}${location.search}`;
      markPendingStudioRouteSection("create");
      if (currentStudioUrl !== "/app/studio") {
        navigate("/app/studio", { replace: true });
      }
    }

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });

    try {
      const formData = new FormData();
      if (options?.segmentEditorSession) {
        console.info("[studio] generate.segment-editor-payload.start", {
          projectId: options.segmentEditorSession.projectId,
          segmentCount: options.segmentEditorSession.segments.length,
        });
      }
      const effectiveSegmentEditorBuild = options?.segmentEditorSession
        ? await buildWorkspaceSegmentEditorPayload(options.segmentEditorSession, {
            language: selectedLanguage,
          })
        : null;
      if (effectiveSegmentEditorBuild) {
        console.info("[studio] generate.segment-editor-payload.success", {
          projectId: effectiveSegmentEditorBuild.payload.projectId,
          segmentCount: effectiveSegmentEditorBuild.payload.segments.length,
          uploadCount: effectiveSegmentEditorBuild.uploads.length,
        });
      }
      const effectiveSegmentEditor = options?.segmentEditor ?? effectiveSegmentEditorBuild?.payload;

      appendStudioFormValue(formData, "prompt", safeTopic);
      appendStudioFormValue(formData, "editedFromProjectAdId", options?.editedFromProjectAdId);
      appendStudioFormValue(formData, "isRegeneration", Boolean(options?.isRegeneration));
      appendStudioFormValue(formData, "language", selectedLanguage);
      appendStudioFormValue(formData, "musicType", effectiveMusicType);
      appendStudioFormValue(formData, "projectId", options?.projectId);
      appendStudioFormValue(formData, "subtitleEnabled", effectiveSubtitleEnabled);
      appendStudioFormValue(formData, "subtitleColorId", effectiveSubtitleColorId);
      appendStudioFormValue(formData, "subtitleStyleId", effectiveSubtitleStyleId);
      appendStudioFormValue(formData, "versionRootProjectAdId", options?.versionRootProjectAdId);
      appendStudioFormValue(formData, "videoMode", effectiveVideoMode);
      appendStudioFormValue(formData, "voiceEnabled", effectiveVoiceEnabled);
      appendStudioFormValue(formData, "voiceId", effectiveVoiceId);
      appendStudioFormValue(formData, "brandText", brandText.trim() || undefined);

      let brandLogoAssetId = selectedBrandLogo?.assetId;
      let customMusicAssetId = effectiveMusicRequest.customMusicAssetId;
      let customVideoAssetId = selectedCustomVideo?.assetId;

      if (selectedBrandLogo && !brandLogoAssetId) {
        setStatus("Загружаем бренд...");
        brandLogoAssetId = (await ensureStudioUploadedAssetId(selectedBrandLogo, {
          fallbackFileName: selectedBrandLogo.fileName || "brand-logo.png",
          fallbackMimeType: selectedBrandLogo.mimeType,
          kind: "brand_logo",
          language: selectedLanguage,
          mediaType: "photo",
          projectId: options?.projectId,
          role: "brand_logo",
        })) ?? undefined;
      }

      if (effectiveMusicType === "custom" && selectedCustomMusic && !customMusicAssetId) {
        setStatus("Загружаем музыку...");
        customMusicAssetId = (await ensureStudioUploadedAssetId(selectedCustomMusic, {
          fallbackFileName: selectedCustomMusic.fileName || "custom-music.mp3",
          fallbackMimeType: "audio/mpeg",
          kind: "custom_music",
          language: selectedLanguage,
          mediaType: "audio",
          projectId: options?.projectId,
          role: "music",
        })) ?? null;
      }

      if (effectiveVideoMode === "custom" && selectedCustomVideo && !customVideoAssetId) {
        setStatus("Загружаем визуал...");
        customVideoAssetId = (await ensureStudioUploadedAssetId(selectedCustomVideo, {
          fallbackFileName: selectedCustomVideo.fileName || "custom-visual.mp4",
          fallbackMimeType: selectedCustomVideo.mimeType,
          kind: "custom_video",
          language: selectedLanguage,
          mediaType: getWorkspaceSegmentCustomPreviewKind(selectedCustomVideo) === "image" ? "photo" : "video",
          projectId: options?.projectId,
          role: "custom_video",
        })) ?? undefined;
      }

      if (selectedBrandLogo) {
        appendStudioFormValue(formData, "brandLogoFileName", selectedBrandLogo.fileName);
        appendStudioFormValue(formData, "brandLogoFileMimeType", selectedBrandLogo.mimeType);

        if (brandLogoAssetId) {
          appendStudioFormValue(formData, "brandLogoAssetId", brandLogoAssetId);
        } else if (selectedBrandLogo.file) {
          formData.append("brandLogoFile", selectedBrandLogo.file, selectedBrandLogo.fileName);
        } else {
          appendStudioFormValue(
            formData,
            "brandLogoFileDataUrl",
            await resolveStudioCustomAssetDataUrl(selectedBrandLogo),
          );
        }
      }

      if (effectiveMusicType === "custom") {
        appendStudioFormValue(
          formData,
          "customMusicFileName",
          selectedCustomMusic?.fileName ?? effectiveMusicRequest.customMusicFileName,
        );

        if (customMusicAssetId) {
          appendStudioFormValue(formData, "customMusicAssetId", customMusicAssetId);
        } else if (selectedCustomMusic?.file) {
          formData.append("customMusicFile", selectedCustomMusic.file, selectedCustomMusic.fileName);
        } else {
          appendStudioFormValue(
            formData,
            "customMusicFileDataUrl",
            await resolveStudioCustomAssetDataUrl(selectedCustomMusic),
          );
        }
      }

      if (effectiveVideoMode === "custom") {
        appendStudioFormValue(formData, "customVideoFileName", selectedCustomVideo?.fileName);
        appendStudioFormValue(formData, "customVideoFileMimeType", selectedCustomVideo?.mimeType);

        if (customVideoAssetId) {
          appendStudioFormValue(formData, "customVideoAssetId", customVideoAssetId);
        } else if (selectedCustomVideo?.file) {
          formData.append("customVideoFile", selectedCustomVideo.file, selectedCustomVideo.fileName);
        } else {
          appendStudioFormValue(
            formData,
            "customVideoFileDataUrl",
            await resolveStudioCustomAssetDataUrl(selectedCustomVideo),
          );
        }
      }

      if (effectiveSegmentEditor) {
        formData.append("segmentEditor", JSON.stringify(effectiveSegmentEditor));
      }

      effectiveSegmentEditorBuild?.uploads.forEach((upload) => {
        formData.append(upload.fieldName, upload.file, upload.fileName);
      });

      setStatus("Task queued");
      const response = await fetch("/api/studio/generate", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as StudioGenerationStartResponse | null;

      if (response.status === 402) {
        setIsGenerating(false);
        setStatus("Credits required");
        openInsufficientCreditsModal("video_generation", requiredCredits);
        return;
      }

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Failed to create generation task.");
      }

      applyWorkspaceProfile(payload.data.profile);
      if (currentComposerSourceIdea) {
        const sourcePlan = contentPlans.find((plan) => plan.id === currentComposerSourceIdea.planId) ?? null;
        const sourceIdea = sourcePlan?.ideas.find((idea) => idea.id === currentComposerSourceIdea.ideaId) ?? null;
        if (sourcePlan && sourceIdea) {
          void persistContentPlanIdeaUsedState(sourcePlan, sourceIdea, true, {
            silentError: true,
          });
        }
      }
      await pollGenerationJob(payload.data.jobId, payload.data.status, {
        clearAppliedSegmentEditorOnSuccess: Boolean(options?.clearAppliedSegmentEditorOnSuccess),
        clearStoredSegmentEditorDraftProjectId: options?.segmentEditorSession?.projectId ?? null,
        invalidateSegmentEditorOnSuccess: Boolean(options?.isRegeneration && options?.projectId),
        openStudioCreateOnSuccess: true,
        showSegmentEditorGenerationError: isSegmentEditorGeneration,
      });
    } catch (error) {
      console.error("[studio] generate.failed-before-job", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate task.";
      setIsGenerating(false);
      setStatus("Generation failed");
      setGenerateError(errorMessage);
      if (isSegmentEditorGeneration) {
        setSegmentEditorVideoError(errorMessage);
      }
    }
  };

  const buildCurrentRegenerationOptions = (segmentEditorSession?: WorkspaceSegmentEditorDraftSession | null) => {
    const effectiveSegmentEditorSession = segmentEditorSession ?? currentAppliedSegmentEditorSession;
    const projectId = effectiveSegmentEditorSession?.projectId ?? generatedVideo?.adId ?? undefined;
    const generationOverrides = getWorkspaceSegmentEditorGenerationOverrides(effectiveSegmentEditorSession);
    const editedFromProjectAdId = effectiveSegmentEditorSession?.projectId ?? undefined;
    const versionRootProjectAdId = effectiveSegmentEditorSession?.projectId
      ? (projects.find((project) => project.adId === effectiveSegmentEditorSession.projectId)?.versionRootProjectAdId ??
        effectiveSegmentEditorSession.projectId)
      : undefined;

    if (!projectId) {
      return {
        isRegeneration: true,
        ...generationOverrides,
      };
    }

    return {
      clearAppliedSegmentEditorOnSuccess: Boolean(effectiveSegmentEditorSession),
      ...(editedFromProjectAdId ? { editedFromProjectAdId } : {}),
      isRegeneration: true,
      ...generationOverrides,
      projectId,
      ...(effectiveSegmentEditorSession ? { segmentEditorSession: effectiveSegmentEditorSession } : {}),
      ...(versionRootProjectAdId ? { versionRootProjectAdId } : {}),
    };
  };

  const handleAccountLogout = async () => {
    await onLogout();
  };

  const handlePublishPreview = async () => {
    if (!previewModalPublishTargetAdId) {
      setGenerateError("Видео ещё не готово к публикации в YouTube.");
      return;
    }

    await openPublishModalForVideoProject(previewModalPublishTargetAdId, previewModalTitle);
  };

  const openLocalExampleModalForSource = (source: WorkspaceLocalExampleSource | null) => {
    if (!canManageLocalExamples || !source) {
      return;
    }

    setLocalExampleSaveError(null);
    setLocalExampleSource(source);
    setIsLocalExampleModalOpen(true);
  };

  const openLocalExampleModal = () => {
    if (!generatedVideo || !generatedVideoPlaybackUrl) {
      return;
    }

    openLocalExampleModalForSource({
      prefillSettings: generatedVideo.prefillSettings ?? buildCurrentExamplePrefillSettings(),
      prompt: normalizedGeneratedVideoPrompt,
      sourceId: generatedVideo.id,
      title: normalizedGeneratedVideoTitle,
      videoUrl: generatedVideoPlaybackUrl,
    });
  };

  const handleOpenProjectLocalExampleModal = (project: WorkspaceProject) => {
    if (!project.videoUrl) {
      return;
    }

    openLocalExampleModalForSource({
      prefillSettings: project.prefillSettings ?? buildCurrentExamplePrefillSettings(),
      prompt: project.prompt.trim(),
      sourceId: project.id,
      title: getWorkspaceProjectDisplayTitle(project),
      videoUrl: project.videoUrl,
    });
  };

  const handleSaveVideoToLocalExamples = async () => {
    if (!localExampleSource?.videoUrl) {
      setLocalExampleSaveError("Видео ещё не готово для сохранения в примеры.");
      return;
    }

    const prompt = localExampleSource.prompt.trim();
    if (!prompt) {
      setLocalExampleSaveError("У видео нет темы, которую можно сохранить в примеры.");
      return;
    }

    setIsSavingLocalExample(true);
    setLocalExampleSaveError(null);

    try {
      const response = await fetch("/api/examples/local", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          goal: selectedLocalExampleGoal,
          prefillSettings: localExampleSource.prefillSettings,
          prompt,
          sourceId: localExampleSource.sourceId,
          title: localExampleSource.title,
          videoUrl: localExampleSource.videoUrl,
        }),
      });
      const payload = (await response.json().catch(() => null)) as WorkspaceLocalExampleSaveResponse | null;

      if (!response.ok || !payload?.data?.item?.id) {
        throw new Error(payload?.error ?? "Не удалось добавить видео в примеры.");
      }

      setIsLocalExampleModalOpen(false);
      setLocalExampleSaveError(null);
      setLocalExampleSource(null);
    } catch (error) {
      setLocalExampleSaveError(error instanceof Error ? error.message : "Не удалось добавить видео в примеры.");
    } finally {
      setIsSavingLocalExample(false);
    }
  };

  const handleOpenProjectSegmentEditor = async (project: WorkspaceProject) => {
    if (!project.adId) {
      setSegmentEditorError("Редактор Shorts доступен только для сохранённого проекта.");
      return;
    }

    setActiveTab("studio");
    setStudioView("create");
    await ensureSegmentEditorDraftForProject(project.adId);
  };

  const handleOpenMediaLibraryItem = (item: WorkspaceMediaLibraryItem) => {
    setPreviewModalPlaybackError(null);
    setPreviewModalUseFallbackSource(false);
    setMediaLibraryPreviewModal(item);
  };

  const handleOpenProjectPublish = async (project: WorkspaceProject) => {
    if (!project.adId) {
      setGenerateError("Видео ещё не готово к публикации в YouTube.");
      return;
    }

    await openPublishModalForVideoProject(project.adId, getWorkspaceProjectDisplayTitle(project));
  };

  const handleRegeneratePreview = async () => {
    if (!generatedVideo) return;

    closePreviewModals();
    await handleGenerate(generatedVideo.prompt, buildCurrentRegenerationOptions());
  };

  const playVideoElement = async (element: HTMLVideoElement | null, preferMutedFallback = false) => {
    if (!element) return;

    if (element.preload !== "auto") {
      element.preload = "auto";
    }

    try {
      await element.play();
      return;
    } catch {
      if (!preferMutedFallback) return;
    }

    element.muted = true;
    element.defaultMuted = true;

    try {
      await element.play();
    } catch {
      element.pause();
    }
  };

  const requestSegmentEditorVideoPlayback = async (
    segmentPlaybackIndex: number,
    element: HTMLVideoElement,
    options?: { resetToStart?: boolean },
  ) => {
    let cancelled = false;
    const requestToken = segmentEditorPreviewResetTokenRef.current;

    logSegmentEditorDiagnostics("client.segment-editor.playback.request", {
      hasElement: Boolean(element),
      mediaUrl: element.currentSrc || element.src || null,
      paused: element.paused,
      previewKind: "video",
      readyState: element.readyState,
      resetToStart: Boolean(options?.resetToStart),
      segmentPlaybackIndex,
    });

    const cleanupRetryListeners = () => {
      element.removeEventListener("loadeddata", handlePlaybackRetry);
      element.removeEventListener("canplay", handlePlaybackRetry);
    };

    const markPlaybackStarted = () => {
      cleanupRetryListeners();
      if (!cancelled) {
        setQueuedSegmentEditorPlaybackIndex((current) => (current === segmentPlaybackIndex ? null : current));
      }
      logSegmentEditorDiagnostics("client.segment-editor.playback.started", {
        currentTime: element.currentTime,
        mediaUrl: element.currentSrc || element.src || null,
        paused: element.paused,
        readyState: element.readyState,
        segmentPlaybackIndex,
      });
    };

    const tryStartPlayback = async () => {
      if (cancelled || segmentEditorPreviewResetTokenRef.current !== requestToken) {
        logSegmentEditorDiagnostics("client.segment-editor.playback.skipped-stale", {
          segmentPlaybackIndex,
        });
        return false;
      }

      if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        logSegmentEditorDiagnostics("client.segment-editor.playback.waiting-for-data", {
          mediaUrl: element.currentSrc || element.src || null,
          networkState: element.networkState,
          readyState: element.readyState,
          segmentPlaybackIndex,
        });
        return false;
      }

      if (options?.resetToStart) {
        try {
          element.currentTime = 0;
        } catch {
          // Ignore reset errors while metadata is still loading.
        }

        setSegmentEditorPreviewTime(segmentPlaybackIndex, 0);
      }

      element.muted = true;
      element.defaultMuted = true;
      await playVideoElement(element, true);

      if (!cancelled && segmentEditorPreviewResetTokenRef.current === requestToken && !element.paused && !element.ended) {
        markPlaybackStarted();
        return true;
      }

      logSegmentEditorDiagnostics("client.segment-editor.playback.not-started", {
        currentTime: element.currentTime,
        ended: element.ended,
        mediaUrl: element.currentSrc || element.src || null,
        networkState: element.networkState,
        paused: element.paused,
        readyState: element.readyState,
        segmentPlaybackIndex,
      });

      return false;
    };

    const handlePlaybackRetry = () => {
      void tryStartPlayback();
    };

    setQueuedSegmentEditorPlaybackIndex(segmentPlaybackIndex);
    cleanupRetryListeners();
    element.addEventListener("loadeddata", handlePlaybackRetry, { once: true });
    element.addEventListener("canplay", handlePlaybackRetry, { once: true });

    const startedImmediately = await tryStartPlayback();
    if (startedImmediately || cancelled) {
      cleanupRetryListeners();
      return;
    }

    ensureVideoElementLoading(element, HTMLMediaElement.HAVE_CURRENT_DATA);

    if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      window.requestAnimationFrame(() => {
        if (cancelled || segmentEditorPreviewResetTokenRef.current !== requestToken) {
          return;
        }

        void tryStartPlayback();
      });
    }

    return () => {
      cancelled = true;
      cleanupRetryListeners();
    };
  };
  requestSegmentEditorVideoPlaybackRef.current = requestSegmentEditorVideoPlayback;

  const getSegmentEditorPreviewVideoRef = useCallback((segmentIndex: number) => {
    const existingCallback = segmentEditorPreviewVideoRefCallbacks.current[segmentIndex];
    if (existingCallback) {
      return existingCallback;
    }

    const callback = (element: HTMLVideoElement | null) => {
      if (element) {
        segmentEditorPreviewVideoRefs.current[segmentIndex] = element;

        const shouldResumeQueuedPlayback =
          segmentEditorCreateModeRef.current === "segment-editor" &&
          queuedSegmentEditorPlaybackIndexRef.current === segmentIndex;

        logSegmentEditorDiagnostics("client.segment-editor.preview-video.ref.attach", {
          mediaUrl: element.currentSrc || element.src || null,
          readyState: element.readyState,
          segmentIndex,
          shouldResumeQueuedPlayback,
        });

        if (shouldResumeQueuedPlayback) {
          const requestToken = segmentEditorPreviewResetTokenRef.current;
          const playbackRequest = requestSegmentEditorVideoPlaybackRef.current;
          const startQueuedPlayback = async () => {
            if (
              segmentEditorCreateModeRef.current !== "segment-editor" ||
              queuedSegmentEditorPlaybackIndexRef.current !== segmentIndex ||
              segmentEditorPreviewResetTokenRef.current !== requestToken ||
              !playbackRequest
            ) {
              return;
            }

            try {
              element.currentTime = 0;
            } catch {
              // Ignore reset errors while metadata is still loading.
            }

            await playbackRequest(segmentIndex, element, { resetToStart: true });
          };

          if (element.readyState >= 1) {
            void startQueuedPlayback();
          } else {
            element.addEventListener("loadeddata", () => void startQueuedPlayback(), { once: true });
            ensureVideoElementLoading(element, HTMLMediaElement.HAVE_METADATA);
          }
        }

        return;
      }

      delete segmentEditorPreviewVideoRefs.current[segmentIndex];
    };

    segmentEditorPreviewVideoRefCallbacks.current[segmentIndex] = callback;
    return callback;
  }, []);

  const setSegmentEditorPreviewTime = (segmentIndex: number, nextTime: number) => {
    const safeTime = Number.isFinite(nextTime) ? Math.max(0, nextTime) : 0;
    setSegmentEditorPreviewTimes((current) => {
      const previousTime = current[segmentIndex];
      if (
        typeof previousTime === "number" &&
        Number.isFinite(previousTime) &&
        Math.abs(previousTime - safeTime) < 0.04
      ) {
        return current;
      }

      return {
        ...current,
        [segmentIndex]: safeTime,
      };
    });
  };

  const getSegmentEditorSyntheticPlaybackDuration = (segment: WorkspaceSegmentEditorDraftSegment) =>
    getWorkspaceSegmentEditorPlaybackDuration(segment);

  const startSegmentEditorSyntheticPlayback = (segmentIndex: number, duration: number) => {
    cancelSegmentEditorSyntheticPlayback();

    const safeDuration = Number.isFinite(duration) ? Math.max(0.001, duration) : 0.001;
    const playback = {
      duration: safeDuration,
      segmentIndex,
      startedAt: window.performance.now(),
    };

    segmentEditorSyntheticPlaybackRef.current = playback;
    setPlayingSegmentEditorPreviewIndex(segmentIndex);
    setSegmentEditorPreviewTime(segmentIndex, 0);

    const tick = (frameNow: number) => {
      const currentPlayback = segmentEditorSyntheticPlaybackRef.current;
      if (!currentPlayback || currentPlayback.segmentIndex !== segmentIndex) {
        return;
      }

      const elapsedSeconds = Math.min(currentPlayback.duration, Math.max(0, (frameNow - currentPlayback.startedAt) / 1000));
      setSegmentEditorPreviewTime(segmentIndex, elapsedSeconds);

      if (elapsedSeconds >= currentPlayback.duration) {
        segmentEditorSyntheticPlaybackFrameRef.current = null;
        segmentEditorSyntheticPlaybackFinishTimeoutRef.current = window.setTimeout(() => {
          segmentEditorSyntheticPlaybackFinishTimeoutRef.current = null;

          const previewElement = segmentEditorPreviewVideoRefs.current[segmentIndex] ?? null;
          if (previewElement) {
            previewElement.pause();
            previewElement.muted = true;
            previewElement.defaultMuted = true;

            try {
              previewElement.currentTime = 0;
            } catch {
              // Ignore reset errors while metadata is still loading.
            }
          }

          cancelSegmentEditorSyntheticPlayback();
          setPlayingSegmentEditorPreviewIndex((current) => (current === segmentIndex ? null : current));
        }, 220);
        return;
      }

      segmentEditorSyntheticPlaybackFrameRef.current = window.requestAnimationFrame(tick);
    };

    segmentEditorSyntheticPlaybackFrameRef.current = window.requestAnimationFrame(tick);
  };

  const handleSegmentEditorPreviewTimeUpdate =
    (segmentIndex: number) =>
    (currentTime: number) => {
      if (segmentEditorSyntheticPlaybackRef.current?.segmentIndex === segmentIndex) {
        return;
      }

      setSegmentEditorPreviewTime(segmentIndex, currentTime);
    };

  const handleSegmentEditorCardClick = async (
    segmentArrayIndex: number,
    segmentPlaybackIndex: number,
    previewKind: WorkspaceSegmentPreviewKind,
  ) => {
    if (segmentArrayIndex !== activeSegmentIndex) {
      const pendingPlaybackIndex = previewKind === "video" ? segmentPlaybackIndex : null;
      logSegmentEditorDiagnostics("client.segment-editor.card.click.switch-active", {
        activeSegmentIndex,
        pendingPlaybackIndex,
        previewKind,
        segmentArrayIndex,
        segmentPlaybackIndex,
      });
      activateSegmentEditorSegmentByArrayIndex(segmentArrayIndex, {
        pendingPlaybackIndex,
      });
      return;
    }

    const segment = segmentEditorDraft?.segments[segmentArrayIndex] ?? null;
    if (!segment) {
      setQueuedSegmentEditorPlaybackIndex(null);
      return;
    }

    logSegmentEditorDiagnostics("client.segment-editor.card.click.active", {
      activeSegmentIndex,
      previewKind,
      segmentArrayIndex,
      segmentPlaybackIndex,
    });

    const isSyntheticPlaybackActive = segmentEditorSyntheticPlaybackRef.current?.segmentIndex === segmentPlaybackIndex;

    if (previewKind !== "video") {
      if (isSyntheticPlaybackActive) {
        cancelSegmentEditorSyntheticPlayback();
        setPlayingSegmentEditorPreviewIndex((current) => (current === segmentPlaybackIndex ? null : current));
        setSegmentEditorPreviewTime(segmentPlaybackIndex, 0);
        setQueuedSegmentEditorPlaybackIndex(null);
        return;
      }

      startSegmentEditorSyntheticPlayback(segmentPlaybackIndex, getSegmentEditorSyntheticPlaybackDuration(segment));
      setQueuedSegmentEditorPlaybackIndex(null);
      return;
    }

    const element = segmentEditorPreviewVideoRefs.current[segmentPlaybackIndex] ?? null;
    const isVideoPlaybackActive = Boolean(element && !element.paused && !element.ended);
    logSegmentEditorDiagnostics("client.segment-editor.card.click.video-state", {
      hasElement: Boolean(element),
      isVideoPlaybackActive,
      mediaUrl: element?.currentSrc || element?.src || null,
      paused: element?.paused ?? null,
      previewKind,
      readyState: element?.readyState ?? null,
      segmentPlaybackIndex,
    });
    if (isSyntheticPlaybackActive || isVideoPlaybackActive) {
      cancelSegmentEditorSyntheticPlayback();
      if (element) {
        element.pause();
        element.muted = true;
        element.defaultMuted = true;
      }

      setPlayingSegmentEditorPreviewIndex((current) => (current === segmentPlaybackIndex ? null : current));
      setQueuedSegmentEditorPlaybackIndex(null);
      return;
    }

    if (!element) {
      logSegmentEditorDiagnostics("client.segment-editor.card.click.queue-without-video-element", {
        segmentPlaybackIndex,
      });
      setQueuedSegmentEditorPlaybackIndex(segmentPlaybackIndex);
      return;
    }

    if (element.readyState < 1) {
      if (element.preload !== "auto") {
        element.preload = "auto";
      }
      logSegmentEditorDiagnostics("client.segment-editor.card.click.load-before-play", {
        mediaUrl: element.currentSrc || element.src || null,
        readyState: element.readyState,
        segmentPlaybackIndex,
      });
      await requestSegmentEditorVideoPlayback(segmentPlaybackIndex, element, { resetToStart: true });
      return;
    }

    const effectiveDuration =
      typeof element.duration === "number" && Number.isFinite(element.duration) ? Math.max(0, element.duration) : 0;
    const isPreviewPrimed = element.dataset.previewPrimed === "true";
    const shouldResetToStart =
      isPreviewPrimed || element.ended || (effectiveDuration > 0 && element.currentTime >= effectiveDuration - 0.12);
    if (shouldResetToStart) {
      try {
        element.currentTime = 0;
      } catch {
        // Ignore reset errors while metadata is still loading.
      }

      setSegmentEditorPreviewTime(segmentPlaybackIndex, 0);
    }

    if (isPreviewPrimed) {
      delete element.dataset.previewPrimed;
    }

    await requestSegmentEditorVideoPlayback(segmentPlaybackIndex, element);
  };

  const handleActiveSegmentEditorCardClick =
    (segmentArrayIndex: number, segmentPlaybackIndex: number, previewKind: WorkspaceSegmentPreviewKind) =>
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (isSegmentCarouselClickSuppressed()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void handleSegmentEditorCardClick(segmentArrayIndex, segmentPlaybackIndex, previewKind);
    };

  const handleSideSegmentEditorCardClick =
    (segmentArrayIndex: number, segmentPlaybackIndex: number, previewKind: WorkspaceSegmentPreviewKind) =>
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (isSegmentCarouselClickSuppressed()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void handleSegmentEditorCardClick(segmentArrayIndex, segmentPlaybackIndex, previewKind);
    };

  const getSegmentCarouselCardStyle = (offset: number, options?: { isAddCard?: boolean }): CSSProperties => {
    const position = Math.max(-1, Math.min(1, offset + segmentCarouselDragProgress));
    const distance = Math.min(1, Math.abs(position));
    const x = position * 58 + (options?.isAddCard ? 15 : 0);
    const scale = 1 - distance * 0.12;
    const opacity = 1 - distance * 0.56;
    const saturation = 1 - distance * 0.28;
    const brightness = 1 - distance * 0.3;
    const contrast = 1 - distance * 0.06;

    return {
      "--studio-segment-card-media-filter": `saturate(${saturation.toFixed(3)}) brightness(${brightness.toFixed(
        3,
      )}) contrast(${contrast.toFixed(3)})`,
      "--studio-segment-card-opacity": opacity.toFixed(3),
      "--studio-segment-card-scale": scale.toFixed(3),
      "--studio-segment-card-x": `${x.toFixed(2)}%`,
      "--studio-segment-card-z": String(Math.round(30 - distance * 10)),
    } as CSSProperties;
  };

  const syncPreviewPlaybackPosition = () => {
    const previewElement = previewVideoRef.current;
    const modalElement = previewModalVideoRef.current;
    if (!previewElement || !modalElement) return;

    const previewTime = previewElement.currentTime;
    if (!Number.isFinite(previewTime) || previewTime <= 0) return;

    const applyCurrentTime = () => {
      try {
        if (Math.abs(modalElement.currentTime - previewTime) > 0.25) {
          modalElement.currentTime = previewTime;
        }
      } catch {
        // Ignore timing sync errors when metadata is not ready yet.
      }
    };

    if (modalElement.readyState >= 1) {
      applyCurrentTime();
      return;
    }

    modalElement.addEventListener("loadedmetadata", applyCurrentTime, { once: true });
  };

  const startPreviewModalPlayback = (
    modalElement: HTMLVideoElement | null,
    options?: { immediate?: boolean; resetToStart?: boolean },
  ) => {
    if (!modalElement) return false;

    setPreviewModalPlaybackError(null);
    modalElement.preload = "auto";
    if (modalElement.networkState === HTMLMediaElement.NETWORK_EMPTY) {
      modalElement.load();
    }

    if (options?.resetToStart) {
      try {
        modalElement.currentTime = 0;
      } catch {
        // Ignore timing reset until metadata is ready.
      }
    }

    void playVideoElement(modalElement, shouldPreferMutedModalFallback);
    return true;
  };

  const isCurrentPreviewModalVideoElement = (element: HTMLVideoElement | null) =>
    Boolean(element && element === previewModalVideoRef.current && element.isConnected);

  const handlePreviewModalVideoRef = useCallback((element: HTMLVideoElement | null) => {
    previewModalVideoRef.current = element;

    if (!element) {
      return;
    }

    const pendingOptions = previewModalPendingPlaybackRef.current;
    if (!pendingOptions?.immediate) {
      return;
    }

    previewModalPendingPlaybackRef.current = null;
    startPreviewModalPlayback(element, pendingOptions);
  }, []);

  const queuePreviewModalPlayback = (options?: { immediate?: boolean; resetToStart?: boolean }) => {
    previewModalPendingPlaybackRef.current = options ?? null;

    if (options?.immediate && startPreviewModalPlayback(previewModalVideoRef.current, options)) {
      previewModalPendingPlaybackRef.current = null;
      return;
    }

    window.requestAnimationFrame(() => {
      const pendingOptions = previewModalPendingPlaybackRef.current ?? options;
      if (!pendingOptions) {
        return;
      }

      if (startPreviewModalPlayback(previewModalVideoRef.current, pendingOptions)) {
        previewModalPendingPlaybackRef.current = null;
      }
    });
  };

  const handleOpenProjectPreviewModal = (project: WorkspaceProject) => {
    if (!project.videoUrl) return;

    markPendingStudioRouteSection("projects");
    flushSync(() => {
      cancelPendingSegmentEditorLoad();
      stashCurrentSegmentEditorDraft();
      segmentEditorRouteRestoreKeyRef.current = null;
      segmentEditorHandledRouteRestoreKeyRef.current = null;
      setSegmentEditorDraft(null);
      setCreateMode("default");
      setStudioView("projects");
      setActiveProjectPreviewId(null);
      setIsPreviewModalOpen(false);
      setProjectPreviewModal(project);
      setProjectPreviewModalAspectRatio(null);
      setPreviewModalOpenToken(Date.now());
      setPreviewModalPlaybackError(null);
      setPreviewModalUseFallbackSource(false);
    });
    syncStudioRouteSection("projects", { replace: true });
    queuePreviewModalPlayback({ immediate: true, resetToStart: true });
  };

  const handleRetryPreviewModalPlayback = () => {
    queuePreviewModalPlayback({ immediate: true });
  };

  const resetStudioPreviewPlaybackPosition = () => {
    const previewElement = previewVideoRef.current;
    if (!previewElement) return;

    try {
      previewElement.currentTime = 0;
    } catch {
      // Ignore timing reset until metadata is ready.
    }
  };

  const handleDismissStudioPreview = () => {
    const previewElement = previewVideoRef.current;
    previewElement?.pause();
    resetStudioPreviewPlaybackPosition();
    updateDismissedStudioPreviewKey(getStudioPreviewDismissKey(generatedVideo));
  };

  const handleStudioPreviewVideoError = () => {
    if (!generatedVideo?.videoUrl) {
      return;
    }

    previewVideoRef.current?.pause();
    markStudioVideoAsFailed(generatedVideo.videoUrl);
  };

  const handlePreviewModalVideoLoadedData = (event: ReactSyntheticEvent<HTMLVideoElement>) => {
    if (!isCurrentPreviewModalVideoElement(event.currentTarget)) {
      return;
    }

    setPreviewModalPlaybackError(null);
  };

  const handlePreviewModalVideoLoadedMetadata = (event: ReactSyntheticEvent<HTMLVideoElement>) => {
    const element = event.currentTarget;
    if (!isProjectPreviewModalOpen || !isCurrentPreviewModalVideoElement(element)) {
      return;
    }

    const width = element.videoWidth;
    const height = element.videoHeight;
    if (!width || !height) {
      return;
    }

    setProjectPreviewModalAspectRatio(width / height);
  };

  const handlePreviewModalVideoPlay = (event: ReactSyntheticEvent<HTMLVideoElement>) => {
    if (!isCurrentPreviewModalVideoElement(event.currentTarget)) {
      return;
    }

    setPreviewModalPlaybackError(null);
  };

  const handlePreviewModalVideoCanPlay = (event: ReactSyntheticEvent<HTMLVideoElement>) => {
    const element = event.currentTarget;
    if (!isAnyPreviewModalOpen || !isCurrentPreviewModalVideoElement(element) || !element.paused) {
      return;
    }

    void playVideoElement(element, shouldPreferMutedModalFallback);
  };

  const handlePreviewModalVideoError = (event: ReactSyntheticEvent<HTMLVideoElement>) => {
    const element = event.currentTarget;
    if (!previewModalVideoUrl || !isAnyPreviewModalOpen || !isCurrentPreviewModalVideoElement(element)) {
      return;
    }

    if (element.error?.code === MediaError.MEDIA_ERR_ABORTED) {
      return;
    }

    if (
      isProjectPreviewModalOpen &&
      !previewModalUseFallbackSource &&
      previewModalFallbackVideoUrl &&
      previewModalFallbackVideoUrl !== previewModalPrimaryVideoUrl
    ) {
      previewModalPendingPlaybackRef.current = {
        immediate: true,
        resetToStart: true,
      };
      setPreviewModalPlaybackError(null);
      setPreviewModalUseFallbackSource(true);
      return;
    }

    element.pause();
    setPreviewModalPlaybackError("Видео не удалось запустить. Повторите попытку или откройте файл напрямую.");
  };

  useEffect(() => {
    if (!isAnyPreviewModalOpen) {
      previewModalVideoRef.current?.pause();
      return;
    }

    previewVideoRef.current?.pause();
    if (isPreviewModalOpen) {
      syncPreviewPlaybackPosition();
    }
  }, [
    activeTab,
    generatedVideo?.id,
    isAnyPreviewModalOpen,
    isPreviewModalOpen,
    shouldPreferMutedModalFallback,
    createMode,
    studioView,
  ]);

  useEffect(() => {
    const previewElement = previewVideoRef.current;
    if (!previewElement) return;

    if (activeTab !== "studio" || studioView !== "create" || createMode !== "default" || isAnyPreviewModalOpen) {
      previewElement.pause();
      resetStudioPreviewPlaybackPosition();
      return;
    }
  }, [activeTab, createMode, generatedVideo?.id, isAnyPreviewModalOpen, studioView]);

  useEffect(() => {
    const modalElement = previewModalVideoRef.current;
    if (!modalElement || !previewModalVideoPlaybackUrl || !isAnyPreviewModalOpen) {
      return;
    }

    if (isPreviewModalOpen) {
      syncPreviewPlaybackPosition();
    }
    void playVideoElement(modalElement, shouldPreferMutedModalFallback);
  }, [isAnyPreviewModalOpen, isPreviewModalOpen, previewModalVideoPlaybackUrl, shouldPreferMutedModalFallback]);

  useEffect(() => {
    if (!isProjectPreviewModalOpen) {
      setProjectPreviewModalAspectRatio(null);
      return;
    }

    setProjectPreviewModalAspectRatio(null);
  }, [isProjectPreviewModalOpen, previewModalVideoPlaybackUrl]);

  useEffect(() => {
    let isCancelled = false;
    setIsWorkspaceBootstrapPending(true);

    const bootstrapWorkspace = async () => {
      try {
        const response = await fetch("/api/workspace/bootstrap");
        const payload = (await response.json().catch(() => null)) as WorkspaceBootstrapResponse | null;

        if (response.status === 401 || response.status === 403) {
          return;
        }

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error ?? "Failed to bootstrap workspace.");
        }

        if (isCancelled) return;

        applyWorkspaceProfile(payload.data.profile);
        const nextSubtitleStyleOptions =
          payload.data.studioOptions.subtitleStyles.length > 0
            ? payload.data.studioOptions.subtitleStyles
            : [fallbackStudioSubtitleStyleOption];
        const nextSubtitleColorCatalog =
          payload.data.studioOptions.subtitleColors.length > 0
            ? payload.data.studioOptions.subtitleColors
            : [{ hex: fallbackStudioSubtitleColorOption.accent.replace("#", ""), id: "purple", label: "Фиолетовый" }];
        const nextSubtitleColorOptions = buildStudioSubtitleColorOptions(nextSubtitleColorCatalog);
        const nextSelectedSubtitleStyleId =
          nextSubtitleStyleOptions.find((style) => style.id === selectedSubtitleStyleId)?.id ??
          nextSubtitleStyleOptions[0]?.id ??
          fallbackStudioSubtitleStyleOption.id;
        const nextSelectedSubtitleColorId =
          nextSubtitleColorOptions.find((color) => color.id === selectedSubtitleColorId)?.id ??
          nextSubtitleStyleOptions.find((style) => style.id === nextSelectedSubtitleStyleId)?.defaultColorId ??
          nextSubtitleColorOptions[0]?.id ??
          fallbackStudioSubtitleColorOption.id;

        setSubtitleStyleOptions(nextSubtitleStyleOptions);
        setSubtitleColorCatalog(nextSubtitleColorCatalog);
        setSelectedSubtitleStyleId(nextSelectedSubtitleStyleId);
        setSelectedSubtitleColorId(nextSelectedSubtitleColorId);

        const latestGeneration = payload.data.latestGeneration;
        if (!latestGeneration) return;

        if (latestGeneration.generation) {
          setGeneratedVideo(latestGeneration.generation);
          setGenerateError(latestGeneration.error ?? null);
        }

        if (latestGeneration.status === "done" && latestGeneration.generation) {
          setStatus("");
          setIsGenerating(false);
          return;
        }

        if (latestGeneration.status === "done") {
          setStatus("Подготавливаем видео...");
          void pollGenerationJob(latestGeneration.jobId, "preparing_preview");
          return;
        }

        if (latestGeneration.status === "failed") {
          setStatus("Generation failed");
          setGenerateError(latestGeneration.error ?? "Generation failed.");
          setIsGenerating(false);
          return;
        }

        setStatus(getStudioStatusLabel(latestGeneration.status));
        void pollGenerationJob(latestGeneration.jobId, latestGeneration.status);
      } catch (error) {
        if (isCancelled || isAbortLikeError(error)) return;
        console.error("[workspace] Failed to bootstrap workspace", error);
      } finally {
        if (!isCancelled) {
          setIsWorkspaceBootstrapPending(false);
        }
      }
    };

    void bootstrapWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [session.email]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const publishParam = Number(searchParams.get("publish") ?? 0);
    const youtubeError = searchParams.get("youtube_error");
    if (!Number.isFinite(publishParam) || publishParam <= 0 || !hasLoadedProjects || isProjectsLoading) {
      return;
    }

    const targetProject = projects.find((project) => project.adId === publishParam) ?? null;
    if (targetProject?.videoUrl) {
      flushSync(() => {
        setIsPreviewModalOpen(false);
        setProjectPreviewModal(targetProject);
        setPreviewModalOpenToken(Date.now());
        setPreviewModalUseFallbackSource(false);
      });
      queuePreviewModalPlayback({ resetToStart: true });
    }

    void openPublishModalForVideoProject(
      publishParam,
      targetProject?.title ?? "Публикация в YouTube",
      youtubeError ?? null,
    );
    searchParams.delete("publish");
    searchParams.delete("youtube_error");
    navigate(buildStudioRouteUrl(`?${searchParams.toString()}`, "create"), { replace: true });
  }, [hasLoadedProjects, isProjectsLoading, location.search, navigate, projects]);

  const isStudioRouteVisible = activeTab === "studio";
  const effectivePublishStatus = publishJobStatus?.status ?? "";
  const isPublishInFlight = isPublishSubmitting || effectivePublishStatus === "queued" || effectivePublishStatus === "processing";
  const publishChannels = publishBootstrap?.channels ?? [];
  const publishCanSubmit =
    Boolean(selectedPublishChannelPk) &&
    Boolean(publishTitle.trim()) &&
    !isPublishInFlight &&
    !isDisconnectingPublishChannel;
  const selectedPublishChannel = publishChannels.find((channel) => channel.pk === selectedPublishChannelPk) ?? null;
  const publishScheduledDate = parsePublishDateTimeLocalValue(publishScheduledAtInput);
  const publishCalendarDays = buildPublishCalendarDays(publishCalendarMonth);
  const publishTimeValue = formatPublishTimeValue(publishScheduledDate) || "12:00";
  const publishPrimaryActionLabel = publishMode === "schedule" ? "Запланировать публикацию" : "Опубликовать в YouTube";
  const publishScheduleSummary =
    publishMode === "schedule"
      ? publishScheduledDate
        ? formatProjectDate(publishScheduledDate.toISOString())
        : "Выберите день и время публикации"
      : "Видео отправится в YouTube сразу после подтверждения.";
  const shouldRenderStudioContentPlanRail = createMode !== "segment-editor";
  const isStudioContentPlanRailVisible = shouldRenderStudioContentPlanRail && isContentPlanVisible;
  const renderContentPlanIdeaCard = (plan: WorkspaceContentPlan, idea: WorkspaceContentPlanIdea) => {
    const isSelectedIdea = selectedContentPlanIdeaId === idea.id;
    const isDeletingIdea = contentPlanDeletingIdeaId === idea.id;
    const isUpdatingIdea = contentPlanUpdatingIdeaId === idea.id;

    return (
      <article
        key={idea.id}
        className={`studio-content-plan__idea${idea.isUsed ? " is-used" : ""}${isSelectedIdea ? " is-selected" : ""}`}
      >
        <div className="studio-content-plan__idea-meta">
          <button
            className={`studio-content-plan__idea-status${idea.isUsed ? " is-active" : ""}`}
            type="button"
            aria-pressed={idea.isUsed}
            aria-label={idea.isUsed ? "Пометить как неиспользованную" : "Пометить как использованную"}
            aria-busy={isUpdatingIdea || isDeletingIdea}
            disabled={isUpdatingIdea || isDeletingIdea}
            onClick={() => void handleToggleContentPlanIdeaUsed(plan, idea)}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3.25 8.25 6.2 11.2l6.55-6.55"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <button
          className="studio-content-plan__idea-main"
          type="button"
          aria-pressed={isSelectedIdea}
          disabled={isDeletingIdea}
          onClick={() => handleSelectContentPlanIdea(plan, idea)}
        >
          <span className="studio-content-plan__idea-main-copy">
            <strong>{idea.title}</strong>
            <p className="studio-content-plan__idea-summary">{idea.summary}</p>
          </span>
        </button>

        <div className="studio-content-plan__idea-actions">
          <button
            className="studio-content-plan__idea-delete"
            type="button"
            aria-label={`Удалить идею ${idea.title}`}
            disabled={isDeletingIdea}
            onClick={() => void handleDeleteContentPlanIdea(plan, idea)}
          >
            {isDeletingIdea ? (
              <span className="studio-canvas-prompt__btn-spinner" aria-hidden="true"></span>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 7h16" strokeLinecap="round" />
                <path d="M9.5 4h5l1 2h4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 7l.8 11a2 2 0 0 0 2 1.86h2.4a2 2 0 0 0 2-1.86L16 7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 10.5v5.5M14 10.5v5.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </article>
    );
  };
  const renderContentPlanSection = (plan: WorkspaceContentPlan) => {
    const planIdeas = plan.ideas.slice().sort((left, right) => left.position - right.position);
    const unusedIdeas = planIdeas.filter((idea) => !idea.isUsed);
    const usedIdeas = planIdeas.filter((idea) => idea.isUsed);
    const isExpandedPlan = activeContentPlanId === plan.id;
    const isUsedIdeasExpanded = expandedContentPlanUsedIdeasPlanId === plan.id;

    return (
      <section key={plan.id} className={`studio-content-plan__plan${isExpandedPlan ? " is-expanded" : ""}`}>
        <button
          className={`studio-content-plan__plan-toggle${isExpandedPlan ? " is-expanded" : ""}`}
          type="button"
          aria-expanded={isExpandedPlan}
          onClick={() => setActiveContentPlanId((current) => (current === plan.id ? null : plan.id))}
        >
          <span className="studio-content-plan__plan-toggle-copy">
            <strong>{plan.query}</strong>
            <span>{formatProjectDate(plan.updatedAt)}</span>
          </span>
          <span className="studio-content-plan__plan-toggle-meta">
            <span className="studio-content-plan__plan-toggle-stats">
              {unusedIdeas.length}/{plan.ideas.length} новых
            </span>
            <span className={`studio-content-plan__plan-chevron${isExpandedPlan ? " is-expanded" : ""}`} aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="m4.25 6.25 3.75 3.75 3.75-3.75"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
        </button>

        {isExpandedPlan ? (
          <div className="studio-content-plan__plan-panel">
            <div className="studio-content-plan__ideas-group">
              {unusedIdeas.length > 0 ? (
                <div className="studio-content-plan__ideas">
                  {unusedIdeas.map((idea) => renderContentPlanIdeaCard(plan, idea))}
                </div>
              ) : (
                <div className="studio-content-plan__state is-compact">
                  <p>В этом плане не осталось новых идей. Можно открыть использованные ниже или сгенерировать ещё.</p>
                </div>
              )}
            </div>

            {usedIdeas.length > 0 ? (
              <section className={`studio-content-plan__used-group${isUsedIdeasExpanded ? " is-expanded" : ""}`}>
                <button
                  className={`studio-content-plan__used-toggle${isUsedIdeasExpanded ? " is-expanded" : ""}`}
                  type="button"
                  aria-expanded={isUsedIdeasExpanded}
                  onClick={() =>
                    setExpandedContentPlanUsedIdeasPlanId((current) => (current === plan.id ? null : plan.id))
                  }
                >
                  <span>Использованные</span>
                  <span>{formatWorkspaceContentPlanIdeaCount(usedIdeas.length)}</span>
                </button>

                {isUsedIdeasExpanded ? (
                  <div className="studio-content-plan__ideas">
                    {usedIdeas.map((idea) => renderContentPlanIdeaCard(plan, idea))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <div className="studio-content-plan__plan-actions studio-content-plan__plan-actions--footer">
              <button
                className="studio-content-plan__ghost-btn"
                type="button"
                disabled={contentPlanDeletingPlanId === plan.id || isContentPlanGenerating}
                onClick={() => void handleRegenerateContentPlan(plan)}
              >
                {isContentPlanGenerating ? "Создаём..." : "Создать еще"}
              </button>
              <button
                className="studio-content-plan__ghost-btn is-danger"
                type="button"
                disabled={contentPlanDeletingPlanId === plan.id}
                onClick={() => void handleDeleteContentPlan(plan)}
              >
                {contentPlanDeletingPlanId === plan.id ? "Удаляем..." : "Удалить"}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    );
  };
  const contentPlanPanel = shouldRenderStudioContentPlanRail ? (
    <aside
      ref={contentPlanPanelRef}
      className={`studio-content-plan${isStudioContentPlanRailVisible ? " is-visible" : ""}`}
      aria-label="Контент-план"
      aria-hidden={!isStudioContentPlanRailVisible}
    >
      <div className="studio-content-plan__header">
        <div className="studio-content-plan__copy">
          <strong>Контент-план</strong>
        </div>
        <button
          className="studio-content-plan__collapse-btn"
          type="button"
          aria-label="Скрыть контент-план"
          onClick={handleToggleContentPlanVisibility}
        >
          <span aria-hidden="true">−</span>
        </button>
      </div>

      <div className="studio-content-plan__composer">
        <div className="studio-content-plan__composer-row">
          <input
            id="studio-content-plan-query"
            className="studio-content-plan__input"
            type="text"
            placeholder="Введите тему для контент-плана"
            value={contentPlanQueryInput}
            onChange={handleContentPlanQueryInputChange}
          />
          <button
            className="studio-content-plan__primary-btn"
            type="button"
            aria-label="Создать контент-план"
            disabled={isContentPlanGenerating || isContentPlansLoading}
            onClick={() => void handleGenerateContentPlan()}
          >
            {isContentPlanGenerating ? (
              <span className="studio-canvas-prompt__btn-spinner" aria-hidden="true"></span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {contentPlansError ? (
        <div className="studio-content-plan__error">
          <p className="studio-content-plan__notice is-error" role="alert">
            {contentPlansError}
          </p>
          <button className="studio-content-plan__ghost-btn" type="button" onClick={handleRetryContentPlansLoad}>
            Повторить
          </button>
        </div>
      ) : null}

      <div className="studio-content-plan__body">
        {isContentPlansLoading ? (
          <div className="studio-content-plan__state">
            <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
            <p>Загружаем контент-планы...</p>
          </div>
        ) : contentPlans.length === 0 ? (
          <div className="studio-content-plan__state">
            <strong>Планов пока нет</strong>
            <p>Введите тему и получите готовые идеи для Shorts.</p>
          </div>
        ) : (
          <section className="studio-content-plan__section">
            <div className="studio-content-plan__plans-list">
              {contentPlans.map((plan) => renderContentPlanSection(plan))}
            </div>
          </section>
        )}
      </div>
    </aside>
  ) : null;
  const handlePublishModeChange = (nextMode: "now" | "schedule") => {
    setPublishMode(nextMode);

    if (nextMode === "schedule") {
      const nextDate = publishScheduledDate ?? createDefaultPublishScheduleDate();
      setPublishScheduledAtInput(buildPublishDateTimeLocalValue(nextDate));
      setPublishCalendarMonth(startOfPublishMonth(nextDate));
      setIsPublishPlannerOpen(true);
      return;
    }

    setIsPublishPlannerOpen(false);
  };

  const handlePublishCalendarDaySelect = (nextDate: Date) => {
    if (startOfPublishDay(nextDate).getTime() < startOfPublishDay(new Date()).getTime()) {
      return;
    }

    setPublishScheduledAtInput((currentValue) => applyPublishScheduleDatePart(currentValue, nextDate));
    setPublishCalendarMonth(startOfPublishMonth(nextDate));
  };

  const handlePublishTimeSelect = (nextTime: string) => {
    setPublishScheduledAtInput((currentValue) => applyPublishScheduleTimePart(currentValue, nextTime));
  };

  const segmentEditorChangeSummary = hasSegmentEditorChanges ? (
    <aside className="studio-segment-editor__change-summary studio-segment-editor__change-summary--sidebar" aria-label="Изменения Shorts">
      <div className="studio-segment-editor__change-list">
        {segmentEditorChangeChecklist.map((item) => (
          <div className="studio-segment-editor__change-item" key={item.key}>
            <span className="studio-segment-editor__change-check" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="m5 12.5 4.2 4.2L19 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="studio-segment-editor__change-label">{item.label}</span>
            <button
              className="studio-segment-editor__change-reset"
              type="button"
              aria-label={`Сбросить ${item.label}`}
              title={`Сбросить ${item.label}`}
              onClick={() => {
                if (item.kind === "segment") {
                  if (item.resetText) {
                    resetSegmentEditorTextByIndex(item.segmentIndex);
                  }

                  if (item.resetVisual) {
                    resetSegmentEditorVisualByIndex(item.segmentIndex);
                  }

                  return;
                }

                item.resetSettingIds.forEach((settingId) => {
                  resetSegmentEditorSettingChange(settingId);
                });

                if (item.resetOrder) {
                  resetSegmentEditorOrderChange();
                }
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M20 11a8 8 0 1 1-2.34-5.66L20 8"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M20 4v4h-4"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </aside>
  ) : null;
  const isSegmentEditorCreateShortsDisabled =
    isGenerating ||
    isSegmentEditorPreparingCustomVideo ||
    isSegmentEditorGeneratingAiPhoto ||
    isSegmentEditorGeneratingImageEdit ||
    isSegmentEditorGeneratingAiVideo ||
    isSegmentEditorGeneratingPhotoAnimation ||
    isSegmentEditorUpscalingImage;
  const handleSegmentEditorPromptVisualToolSelect = (tab: WorkspaceSegmentVisualModalTab) => {
    if (!activeSegment) {
      return;
    }

    setSegmentEditorVideoError(null);
    setSegmentEditorPromptSceneMode(getWorkspaceSegmentPromptSceneModeForTab(tab));
    if (tab === "library") {
      setSegmentAiPhotoModalLibraryFilter("all");
    }
    syncSegmentAiPhotoModalForSegment(activeSegment, { preserveTab: true, resetLibraryFilter: tab === "library" });
    setSegmentAiPhotoModalTab(resolveWorkspaceSegmentVisualModalTab(activeSegment, tab));
  };
  const handleSegmentEditorPromptSceneModeSelect = (mode: "create" | "edit") => {
    if (!activeSegment) {
      return;
    }

    setSegmentEditorVideoError(null);
    setSegmentEditorPromptSceneMode(mode);
    syncSegmentAiPhotoModalForSegment(activeSegment, { preserveTab: true });
    setSegmentAiPhotoModalTab(
      getWorkspaceSegmentVisualTabForPromptSceneMode(activeSegment, mode, segmentAiPhotoModalTab),
    );
  };
  const canSelectSegmentEditorPromptVisualTool = (tab: WorkspaceSegmentVisualModalTab) =>
    Boolean(activeSegment && isWorkspaceSegmentVisualModalTabAllowed(activeSegment, tab));
  const activeSegmentDisplayNumber =
    segmentEditorDraft && activeSegment
      ? getWorkspaceSegmentEditorDisplayNumber(segmentEditorDraft.segments, activeSegment.index)
      : activeSegmentIndex + 1;
  const isPromptAiPhotoMode = segmentAiPhotoModalTab === "ai_photo";
  const isPromptAiVideoMode = segmentAiPhotoModalTab === "ai_video";
  const isPromptPhotoAnimationMode = segmentAiPhotoModalTab === "photo_animation";
  const isPromptImageEditMode = segmentAiPhotoModalTab === "image_edit";
  const isPromptUpscaleMode = segmentAiPhotoModalTab === "image_upscale";
  const isPromptLibraryMode = segmentAiPhotoModalTab === "library";
  const isPromptUploadMode = segmentAiPhotoModalTab === "upload";
  const isPromptTextMode = !isPromptLibraryMode && !isPromptUploadMode && !isPromptUpscaleMode;
  const promptVisualTextareaValue = isPromptImageEditMode
    ? segmentImageEditModalPrompt
    : isPromptAiPhotoMode
      ? segmentAiPhotoModalPrompt
      : segmentAiVideoModalPrompt;
  const promptVisualActionCost = isPromptAiPhotoMode
    ? STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST
    : isPromptAiVideoMode
      ? STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST
      : isPromptPhotoAnimationMode
        ? STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST
        : isPromptImageEditMode
          ? STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST
          : isPromptUpscaleMode
            ? STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST
            : null;
  const isPromptVisualBusy =
    (isPromptAiPhotoMode && isSegmentAiPhotoModalGeneratingCurrentSegment) ||
    (isPromptAiVideoMode && isSegmentAiVideoModalGeneratingCurrentSegment) ||
    (isPromptPhotoAnimationMode && isSegmentPhotoAnimationModalGeneratingCurrentSegment) ||
    (isPromptImageEditMode && isSegmentImageEditModalGeneratingCurrentSegment) ||
    (isPromptUpscaleMode && isSegmentImageUpscaleCurrentSegment) ||
    (isPromptUploadMode && isSegmentEditorPreparingCustomVideo);
  const isPromptVisualDisabled =
    !activeSegment ||
    isSegmentEditorGeneratingAiPhoto ||
    isSegmentEditorGeneratingImageEdit ||
    isSegmentEditorGeneratingAiVideo ||
    isSegmentEditorGeneratingPhotoAnimation ||
    isSegmentEditorPreparingCustomVideo ||
    isSegmentEditorUpscalingImage ||
    isSegmentAiPhotoPromptImproving ||
    (isPromptPhotoAnimationMode && !canAnimateSegmentPhoto) ||
    (isPromptImageEditMode && !canEditSegmentImage) ||
    (isPromptUpscaleMode && !canUpscaleSegmentImage);
  const canImprovePromptVisual =
    isPromptImageEditMode
      ? canImproveSegmentImageEditPrompt
      : isPromptAiPhotoMode
        ? canImproveSegmentAiPhotoPrompt
        : isPromptAiVideoMode || isPromptPhotoAnimationMode
          ? canImproveSegmentAiVideoPrompt
          : false;
  const isPromptImproveDisabled = !canImprovePromptVisual || isPromptVisualDisabled;
  const handlePromptVisualTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (isPromptImageEditMode) {
      handleSegmentEditorImageEditPromptChange(event);
    } else if (isPromptAiPhotoMode) {
      handleSegmentEditorAiPhotoPromptChange(event);
    } else if (isPromptPhotoAnimationMode) {
      handleSegmentEditorPhotoAnimationPromptChange(event);
    } else {
      handleSegmentEditorAiVideoPromptChange(event);
    }
  };
  const handlePromptVisualAction = () => {
    if (!activeSegment) {
      return;
    }
    if (isPromptAiPhotoMode) {
      void handleSegmentAiPhotoModalGenerateScene({ prompt: segmentAiPhotoModalPrompt, segmentIndex: activeSegment.index });
    } else if (isPromptAiVideoMode) {
      void handleSegmentAiVideoModalGenerate({ prompt: segmentAiVideoModalPrompt, segmentIndex: activeSegment.index });
    } else if (isPromptPhotoAnimationMode) {
      void handleSegmentPhotoAnimationModalGenerate({ prompt: segmentAiVideoModalPrompt, segmentIndex: activeSegment.index });
    } else if (isPromptImageEditMode) {
      void handleSegmentImageEditModalGenerate({ prompt: segmentImageEditModalPrompt, segmentIndex: activeSegment.index });
    } else if (isPromptUpscaleMode) {
      void handleSegmentAiPhotoModalUpscaleImage({ segmentIndex: activeSegment.index });
    } else if (isPromptLibraryMode) {
      setSegmentAiPhotoModalTab("library");
    } else {
      syncSegmentAiPhotoModalForSegment(activeSegment, { preserveTab: true });
      setSegmentAiPhotoModalTab("upload");
      segmentAiPhotoModalFileInputRef.current?.click();
    }
  };
  const promptVisualActionLabel = isPromptAiPhotoMode
    ? "Создать ИИ фото"
    : isPromptAiVideoMode
      ? "Создать ИИ видео"
      : isPromptPhotoAnimationMode
        ? "Анимировать фото"
        : isPromptImageEditMode
          ? "Дорисовать фото"
          : isPromptUpscaleMode
            ? "Улучшить качество"
            : isPromptLibraryMode
              ? "Выбрать визуал"
              : segmentAiPhotoModalCustomFileName
                ? "Заменить визуал"
                : "Загрузить визуал";
  const renderSegmentEditorPromptToolIcon = (
    kind:
      | "ai_photo"
      | "ai_video"
      | "library"
      | "upload"
      | "photo_animation"
      | "image_edit"
      | "image_upscale",
  ) => {
    const iconClassName = `studio-segment-editor__prompt-tool-icon studio-segment-editor__prompt-tool-icon--${kind.replace("_", "-")}`;
    const aiBadge =
      kind === "ai_photo" || kind === "ai_video" || kind === "photo_animation" || kind === "image_edit" || kind === "image_upscale" ? (
      <span className="studio-segment-editor__prompt-tool-icon__badge">AI</span>
      ) : null;

    if (kind === "ai_photo") {
      return (
        <span className={iconClassName} aria-hidden="true">
          {aiBadge}
          <svg className="studio-segment-editor__prompt-tool-icon__svg" viewBox="0 0 40 40" fill="none">
            <rect x="8.5" y="12.5" width="23" height="18" rx="4.5" />
            <path d="m11.5 27 6.4-6.6 4.5 4.7 2.9-3.1 4.2 5" />
            <circle cx="26.3" cy="17.8" r="1.8" />
          </svg>
        </span>
      );
    }

    if (kind === "ai_video" || kind === "photo_animation") {
      return (
        <span className={iconClassName} aria-hidden="true">
          {aiBadge}
          <svg className="studio-segment-editor__prompt-tool-icon__svg" viewBox="0 0 40 40" fill="none">
            <rect x="9" y="11" width="22" height="19" rx="4.5" />
            <path d="M12.5 15h17M12.5 26h17" />
            <path d="m18 17.6 7 4.4-7 4.4v-8.8Z" />
            {kind === "photo_animation" ? <path d="M13.5 9.5c4.8-3.3 11.7-2.1 15.1 2.6M30 8.5v4.4h-4.4" /> : null}
          </svg>
        </span>
      );
    }

    if (kind === "library") {
      return (
        <span className={iconClassName} aria-hidden="true">
          <svg className="studio-segment-editor__prompt-tool-icon__svg" viewBox="0 0 40 40" fill="none">
            <path d="M8.5 14.5v-1.7c0-2 1.4-3.3 3.4-3.3h6.3l2.7 3h7.2c2 0 3.4 1.3 3.4 3.3v1.7" />
            <rect x="7.5" y="14.5" width="25" height="16" rx="4.5" />
            <path d="M13.5 20.5h4.5v4.5h-4.5zM21.8 20.5h4.7M21.8 25h4.7" />
          </svg>
        </span>
      );
    }

    if (kind === "upload" || kind === "image_edit") {
      return (
        <span className={iconClassName} aria-hidden="true">
          {aiBadge}
          <svg className="studio-segment-editor__prompt-tool-icon__svg" viewBox="0 0 40 40" fill="none">
            <rect x="9" y="11" width="21" height="18" rx="4.5" />
            <path d="m12 25 5.5-5.7 4 4.1 2.5-2.7 4 4.6" />
            {kind === "upload" ? (
              <>
                <path d="M28.5 9.5v10M24.5 13.5l4-4 4 4" />
                <path d="M24.5 31h8" />
              </>
            ) : (
              <path d="m25.5 30.5 5.9-5.9c.8-.8 2-.8 2.8 0s.8 2 0 2.8l-5.9 5.9-3.6.8.8-3.6Z" />
            )}
          </svg>
        </span>
      );
    }

    return (
      <span className={iconClassName} aria-hidden="true">
        {aiBadge}
        <svg className="studio-segment-editor__prompt-tool-icon__svg" viewBox="0 0 40 40" fill="none">
          <rect x="10" y="10" width="20" height="20" rx="5" />
          <path d="M15 18v-4h4M15 14l6 6M25 22v4h-4M25 26l-6-6" />
          <path d="m28.3 11.7.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8.8-1.7Z" />
        </svg>
      </span>
    );
  };
  const renderSegmentEditorPromptToolButtonContent = (
    kind:
      | "ai_photo"
      | "ai_video"
      | "library"
      | "upload"
      | "photo_animation"
      | "image_edit"
      | "image_upscale",
    label: string,
  ) => (
    <span className="studio-segment-editor__prompt-tool-button-content">
      {renderSegmentEditorPromptToolIcon(kind)}
      <span className="studio-segment-editor__prompt-tool-label">{label}</span>
    </span>
  );
  const segmentEditorPromptPanel = (
    <div className="studio-segment-editor__prompt-shell">
      <div className="studio-canvas-prompt__inner studio-canvas-prompt__inner--editor studio-segment-editor__prompt-panel">
        <div className="studio-canvas-prompt__editor-layout">
          <div className="studio-canvas-prompt__editor-pane">
            <div className="studio-segment-editor__prompt-topbar" aria-label="Режим панели">
              <div className="studio-segment-editor__prompt-header">
                <div className="studio-segment-editor__prompt-title">
                  Сцена {activeSegmentDisplayNumber}
                </div>
                <div className="studio-segment-editor__prompt-mode-switch">
                  <button
                    className={`studio-segment-editor__prompt-mode-button${segmentEditorPromptSceneMode === "create" ? " is-active" : ""}`}
                    type="button"
                    aria-pressed={segmentEditorPromptSceneMode === "create"}
                    onClick={() => {
                      handleSegmentEditorPromptSceneModeSelect("create");
                    }}
                  >
                    Создать сцену
                  </button>
                  <button
                    className={`studio-segment-editor__prompt-mode-button${segmentEditorPromptSceneMode === "edit" ? " is-active" : ""}`}
                    type="button"
                    aria-pressed={segmentEditorPromptSceneMode === "edit"}
                    onClick={() => {
                      handleSegmentEditorPromptSceneModeSelect("edit");
                    }}
                  >
                    Редактировать сцену
                  </button>
                </div>
              </div>
              {segmentEditorPromptSceneMode === "create" ? (
                <div className="studio-segment-editor__prompt-submenu" aria-label="Инструменты создания сцены">
                  <button
                    className={`studio-segment-editor__prompt-submenu-button studio-segment-editor__prompt-submenu-button--icon${segmentAiPhotoModalTab === "ai_photo" ? " is-active" : ""}`}
                    type="button"
                    aria-label="ИИ фото"
                    disabled={!canSelectSegmentEditorPromptVisualTool("ai_photo")}
                    title="ИИ фото"
                    onClick={() => {
                      handleSegmentEditorPromptVisualToolSelect("ai_photo");
                    }}
                  >
                    {renderSegmentEditorPromptToolButtonContent("ai_photo", "ИИ фото")}
                  </button>
                  <button
                    className={`studio-segment-editor__prompt-submenu-button studio-segment-editor__prompt-submenu-button--icon${segmentAiPhotoModalTab === "ai_video" ? " is-active" : ""}`}
                    type="button"
                    aria-label="ИИ видео"
                    disabled={!canSelectSegmentEditorPromptVisualTool("ai_video")}
                    title="ИИ видео"
                    onClick={() => {
                      handleSegmentEditorPromptVisualToolSelect("ai_video");
                    }}
                  >
                    {renderSegmentEditorPromptToolButtonContent("ai_video", "ИИ видео")}
                  </button>
                  <button
                    className={`studio-segment-editor__prompt-submenu-button studio-segment-editor__prompt-submenu-button--icon${segmentAiPhotoModalTab === "library" ? " is-active" : ""}`}
                    type="button"
                    aria-label="Медиатека"
                    disabled={!canSelectSegmentEditorPromptVisualTool("library")}
                    title="Медиатека"
                    onClick={() => {
                      handleSegmentEditorPromptVisualToolSelect("library");
                    }}
                  >
                    {renderSegmentEditorPromptToolButtonContent("library", "Медиатека")}
                  </button>
                  <button
                    className={`studio-segment-editor__prompt-submenu-button studio-segment-editor__prompt-submenu-button--icon${segmentAiPhotoModalTab === "upload" ? " is-active" : ""}`}
                    type="button"
                    aria-label="Свой визуал"
                    disabled={!canSelectSegmentEditorPromptVisualTool("upload")}
                    title="Свой визуал"
                    onClick={() => {
                      handleSegmentEditorPromptVisualToolSelect("upload");
                    }}
                  >
                    {renderSegmentEditorPromptToolButtonContent("upload", "Свой визуал")}
                  </button>
                </div>
              ) : (
                <div className="studio-segment-editor__prompt-submenu" aria-label="Инструменты редактирования сцены">
                  <button
                    className={`studio-segment-editor__prompt-submenu-button studio-segment-editor__prompt-submenu-button--icon${segmentAiPhotoModalTab === "photo_animation" ? " is-active" : ""}`}
                    type="button"
                    aria-label="ИИ анимация фото"
                    disabled={!canSelectSegmentEditorPromptVisualTool("photo_animation")}
                    title="ИИ анимация фото"
                    onClick={() => {
                      handleSegmentEditorPromptVisualToolSelect("photo_animation");
                    }}
                  >
                    {renderSegmentEditorPromptToolButtonContent("photo_animation", "ИИ анимация")}
                  </button>
                  <button
                    className={`studio-segment-editor__prompt-submenu-button studio-segment-editor__prompt-submenu-button--icon${segmentAiPhotoModalTab === "image_edit" ? " is-active" : ""}`}
                    type="button"
                    aria-label="Дорисовать фото"
                    disabled={!canSelectSegmentEditorPromptVisualTool("image_edit")}
                    title="Дорисовать фото"
                    onClick={() => {
                      handleSegmentEditorPromptVisualToolSelect("image_edit");
                    }}
                  >
                    {renderSegmentEditorPromptToolButtonContent("image_edit", "Дорисовать")}
                  </button>
                  <button
                    className={`studio-segment-editor__prompt-submenu-button studio-segment-editor__prompt-submenu-button--icon${segmentAiPhotoModalTab === "image_upscale" ? " is-active" : ""}`}
                    type="button"
                    aria-label="Улучшить качество"
                    disabled={!canSelectSegmentEditorPromptVisualTool("image_upscale")}
                    title="Улучшить качество"
                    onClick={() => {
                      handleSegmentEditorPromptVisualToolSelect("image_upscale");
                    }}
                  >
                    {renderSegmentEditorPromptToolButtonContent("image_upscale", "Улучшить")}
                  </button>
                </div>
              )}
            </div>
            <div className="studio-canvas-prompt__input-row">
              <div className="studio-canvas-prompt__input-main">
                <div className="studio-segment-editor__prompt-visual-panel">
                  <input
                    ref={segmentAiPhotoModalFileInputRef}
                    className="studio-segment-editor__prompt-file-input"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.avif,.mp4,.mov,.webm,.m4v,image/*,video/*"
                    onChange={(event) => {
                      void handleSegmentAiPhotoModalCustomVideoChange(event);
                    }}
                  />
                  {isPromptLibraryMode ? (
                    <div className="studio-segment-editor__prompt-library">
                      {segmentAiPhotoModalLibraryItems.length > 0 ? (
                        <div className="studio-segment-editor__prompt-library-filters" aria-label="Фильтр медиатеки">
                          <button
                            className={`studio-segment-editor__prompt-library-filter${segmentAiPhotoModalLibraryFilter === "all" ? " is-active" : ""}`}
                            type="button"
                            aria-pressed={segmentAiPhotoModalLibraryFilter === "all"}
                            onClick={() => setSegmentAiPhotoModalLibraryFilter("all")}
                          >
                            Все
                          </button>
                          <button
                            className={`studio-segment-editor__prompt-library-filter${segmentAiPhotoModalLibraryFilter === "photo" ? " is-active" : ""}`}
                            type="button"
                            aria-pressed={segmentAiPhotoModalLibraryFilter === "photo"}
                            onClick={() => setSegmentAiPhotoModalLibraryFilter((current) => (current === "photo" ? "all" : "photo"))}
                          >
                            ИИ фото
                          </button>
                          <button
                            className={`studio-segment-editor__prompt-library-filter${segmentAiPhotoModalLibraryFilter === "video" ? " is-active" : ""}`}
                            type="button"
                            aria-pressed={segmentAiPhotoModalLibraryFilter === "video"}
                            onClick={() => setSegmentAiPhotoModalLibraryFilter((current) => (current === "video" ? "all" : "video"))}
                          >
                            ИИ видео
                          </button>
                        </div>
                      ) : null}
                      <div className="studio-segment-editor__prompt-library-body">
                        {!shouldRenderSegmentAiPhotoModalLibraryGrid && segmentAiPhotoModalLibraryItems.length > 0 ? (
                          <div className="studio-segment-editor__prompt-info-card" role="status" aria-live="polite">
                            <strong>Открываем медиатеку</strong>
                            <span>Подготавливаем превью.</span>
                          </div>
                        ) : isMediaLibraryLoading && segmentAiPhotoModalLibraryItems.length === 0 ? (
                          <div className="studio-segment-editor__prompt-info-card" role="status" aria-live="polite">
                            <strong>Загружаем медиатеку</strong>
                            <span>Собираем AI-визуалы.</span>
                          </div>
                        ) : mediaLibraryError && segmentAiPhotoModalLibraryItems.length === 0 ? (
                          <div className="studio-segment-editor__prompt-info-card is-error" role="alert">
                            <strong>Не удалось загрузить медиатеку</strong>
                            <span>{mediaLibraryError}</span>
                            <button
                              className="studio-segment-editor__prompt-library-retry"
                              type="button"
                              onClick={() => setMediaLibraryReloadToken((current) => current + 1)}
                            >
                              Повторить
                            </button>
                          </div>
                        ) : isMediaLibraryResolvingVisibleItems ? (
                          <div className="studio-segment-editor__prompt-info-card" role="status" aria-live="polite">
                            <strong>Загружаем медиатеку</strong>
                            <span>Подбираем доступные AI-визуалы.</span>
                          </div>
                        ) : segmentAiPhotoModalLibraryItems.length === 0 ? (
                          <div className="studio-segment-editor__prompt-info-card">
                            <strong>Медиатека пока пуста</strong>
                            <span>Сначала сохраните хотя бы один AI-визуал.</span>
                          </div>
                        ) : filteredSegmentAiPhotoModalLibraryItems.length === 0 ? (
                          <div className="studio-segment-editor__prompt-info-card">
                            <strong>{segmentAiPhotoModalLibraryFilter === "photo" ? "Нет ИИ фото" : "Нет ИИ видео"}</strong>
                            <span>
                              {segmentAiPhotoModalLibraryFilter === "photo"
                                ? "В медиатеке сейчас нет доступных фото для этого фильтра."
                                : "В медиатеке сейчас нет доступных видео для этого фильтра."}
                            </span>
                            <button
                              className="studio-segment-editor__prompt-library-retry"
                              type="button"
                              onClick={() => setSegmentAiPhotoModalLibraryFilter("all")}
                            >
                              Сбросить фильтр
                            </button>
                          </div>
                        ) : (
                          <div className="studio-segment-editor__prompt-library-grid">
                            {visibleSegmentAiPhotoModalLibraryItems.map((item) => {
                              const itemKey = getWorkspaceMediaLibraryItemStorageKey(item);
                              const itemKindLabel = getWorkspaceMediaLibraryItemKindLabel(item.kind, item.assetKind);
                              const isSelectedLibraryItem = itemKey === segmentAiPhotoModalSelectedLibraryItemKey;
                              const mediaLibrarySurface = getWorkspaceMediaLibraryResolvedMediaSurface(
                                item,
                                "segment-modal-library-tile",
                              );

                              return (
                                <button
                                  key={`segment-editor-panel-library:${itemKey}`}
                                  className={`studio-segment-editor__prompt-library-card${
                                    item.previewKind === "video"
                                      ? " studio-segment-editor__prompt-library-card--video"
                                      : " studio-segment-editor__prompt-library-card--photo"
                                  }${isSelectedLibraryItem ? " is-selected" : ""}`}
                                  type="button"
                                  aria-label={`Выбрать ${itemKindLabel} из медиатеки`}
                                  disabled={!activeSegment || isSegmentEditorStructureActionBusy}
                                  onClick={() => {
                                    if (!activeSegment) {
                                      return;
                                    }

                                    setSegmentEditorVideoError(null);
                                    setSegmentAiPhotoModalTab("library");
                                    handleSegmentEditorMediaLibrarySelect(item, {
                                      segmentIndex: activeSegment.index,
                                    });
                                  }}
                                >
                                  <span className="studio-segment-editor__prompt-library-media">
                                    {renderWorkspaceMediaLibraryPlayOverlay(item.previewKind)}
                                    <WorkspaceSegmentPreviewCardMedia
                                      autoplay={false}
                                      imageLoading="lazy"
                                      mediaKey={`segment-editor-panel-library:${itemKey}:${mediaLibrarySurface.displayUrl}:${mediaLibrarySurface.posterUrl ?? "no-poster"}`}
                                      mountVideoWhenIdle={mediaLibrarySurface.mountVideoWhenIdle}
                                      muted
                                      posterUrl={mediaLibrarySurface.posterUrl}
                                      preferPosterFrame={mediaLibrarySurface.preferPosterFrame}
                                      preload={item.previewKind === "video" ? mediaLibrarySurface.preloadPolicy : undefined}
                                      primePausedFrame={mediaLibrarySurface.primePausedFrame}
                                      previewKind={mediaLibrarySurface.previewKind}
                                      previewUrl={mediaLibrarySurface.displayUrl ?? item.previewUrl}
                                    />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : isPromptUploadMode || isPromptUpscaleMode ? (
                    <div className="studio-segment-editor__prompt-info-card">
                      <strong>
                        {isPromptUploadMode
                            ? segmentAiPhotoModalCustomFileLabel ?? "Свой визуал"
                            : "Улучшить качество"}
                      </strong>
                      <span>
                        {isPromptUploadMode
                            ? "Загрузите фото или видео для текущего сегмента."
                            : "Улучшение качества изображения."}
                      </span>
                    </div>
                  ) : (
                    <div className={`studio-segment-editor__prompt-field${isSegmentAiPhotoPromptHighlighted ? " is-highlighted" : ""}`}>
                      <textarea
                        ref={segmentAiPhotoModalTextareaRef}
                        className="studio-segment-editor__prompt-textarea"
                        value={promptVisualTextareaValue}
                        onChange={handlePromptVisualTextareaChange}
                        rows={6}
                        placeholder="Опишите что должно быть в сцене..."
                      />
                      <button
                        className="studio-segment-editor__prompt-improve"
                        type="button"
                        aria-label="Улучшить описание"
                        title="Улучшить описание"
                        disabled={isPromptImproveDisabled}
                        onClick={() => {
                          void handleSegmentAiPhotoModalImprovePrompt();
                        }}
                      >
                        {isSegmentAiPhotoPromptImproving ? (
                          <span className="studio-segment-editor__prompt-action-spinner" aria-hidden="true"></span>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M12 3.7 13.3 8l4.3 1.3-4.3 1.3L12 14.9l-1.3-4.3-4.3-1.3L10.7 8 12 3.7Z"
                              fill="currentColor"
                            />
                            <path
                              d="M18.4 14.3 19.1 16.4l2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z"
                              fill="currentColor"
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        className="studio-segment-editor__prompt-action studio-segment-editor__prompt-action--in-field"
                        type="button"
                        disabled={isPromptVisualDisabled}
                        onClick={handlePromptVisualAction}
                      >
                        {isPromptVisualBusy ? (
                          <span className="studio-segment-editor__prompt-action-spinner" aria-hidden="true"></span>
                        ) : (
                          <>
                            <span>{promptVisualActionLabel}</span>
                            {promptVisualActionCost !== null ? (
                              <small>{formatSegmentVisualCreditsLabel(promptVisualActionCost)}</small>
                            ) : null}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  {segmentEditorVideoError ? (
                    <p className="studio-segment-editor__prompt-note is-error">{segmentEditorVideoError}</p>
                  ) : null}
                  {!isPromptLibraryMode && !isPromptTextMode ? (
                    <div className="studio-segment-editor__prompt-action-row">
                      <button
                        className="studio-segment-editor__prompt-action"
                        type="button"
                        disabled={isPromptVisualDisabled}
                        onClick={handlePromptVisualAction}
                      >
                        {isPromptVisualBusy ? (
                          <span className="studio-segment-editor__prompt-action-spinner" aria-hidden="true"></span>
                        ) : (
                          <>
                            <span>{promptVisualActionLabel}</span>
                            {promptVisualActionCost !== null ? (
                              <small>{formatSegmentVisualCreditsLabel(promptVisualActionCost)}</small>
                            ) : null}
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="studio-canvas-prompt__footer">
              <div className="studio-segment-editor__prompt-controls">
                <StudioSubtitleSelectorChip
                  isEnabled={studioSidebarSubtitlesEnabled}
                  onToggleEnabled={handleSegmentEditorSubtitleToggle}
                  selectedColorId={studioSidebarSubtitleColorId}
                  selectedExampleId={selectedSubtitleExampleId}
                  selectedStyleId={studioSidebarSubtitleStyleId}
                  subtitleColorOptions={subtitleColorOptions}
                  subtitleStyleOptions={subtitleStyleOptions}
                  onSelectColor={handleSegmentEditorSubtitleColorSelect}
                  onSelectExample={setSelectedSubtitleExampleId}
                  onSelectStyle={handleSegmentEditorSubtitleStyleSelect}
                />
                <StudioVoiceSelectorChip
                  isEnabled={studioSidebarVoiceEnabled}
                  onToggleEnabled={handleSegmentEditorVoiceToggle}
                  selectedLanguage={selectedLanguage}
                  selectedVoiceId={studioSidebarVoiceId}
                  voiceOptions={selectedVoiceOptions}
                  onSelect={handleSegmentEditorVoiceSelect}
                />
                <StudioMusicSelectorChip
                  customMusicFile={selectedCustomMusic}
                  isPreparingCustomMusic={isPreparingCustomMusic}
                  onSelectCustomFile={handleSegmentEditorCustomMusicSelect}
                  onSelectMusicType={handleSegmentEditorMusicTypeSelect}
                  selectedMusicType={studioSidebarMusicType}
                  uploadError={musicSelectionError}
                />
                <StudioLanguageSelectorChip
                  selectedLanguage={selectedLanguage}
                  onSelect={handleSegmentEditorLanguageSelect}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="studio-segment-editor__prompt-submit-row">
        <button
          className={`studio-canvas-prompt__btn studio-segment-editor__prompt-submit${isGenerating ? " is-generating" : ""}`}
          type="button"
          aria-busy={isGenerating ? true : undefined}
          aria-label={`Создать Shorts за ${formatCreditsCountLabel(STUDIO_VIDEO_GENERATION_CREDIT_COST)}`}
          title={`Создать Shorts за ${formatCreditsCountLabel(STUDIO_VIDEO_GENERATION_CREDIT_COST)}`}
          disabled={isSegmentEditorCreateShortsDisabled}
          onClick={() => {
            void handleCreateShortsFromSegmentEditor();
          }}
        >
          {isGenerating ? (
            <>
              <span className="studio-segment-editor__change-summary-create-spinner" aria-hidden="true"></span>
              <span>Генерируем Shorts</span>
            </>
          ) : (
            <span className="studio-canvas-prompt__btn-label">Создать Shorts {STUDIO_VIDEO_GENERATION_CREDIT_COST} ⚡</span>
          )}
        </button>
      </div>
    </div>
  );
  const studioSidebar = (
    <aside className="studio-sidebar" aria-label="Параметры редактирования">
      {studioSidebarProjectTitle ? (
        <div className="studio-sidebar__project" aria-label="Название проекта">
          <span className="studio-sidebar__project-label">Проект</span>
          <strong className="studio-sidebar__project-title" title={studioSidebarProjectTitle}>
            {studioSidebarProjectTitle}
          </strong>
        </div>
      ) : null}

      <div className="studio-sidebar__nav studio-sidebar__nav--settings" aria-label="Параметры видео">
        <StudioSubtitleSelectorChip
          isEnabled={studioSidebarSubtitlesEnabled}
          variant="sidebar"
          onToggleEnabled={handleSegmentEditorSubtitleToggle}
          selectedColorId={studioSidebarSubtitleColorId}
          selectedExampleId={selectedSubtitleExampleId}
          selectedStyleId={studioSidebarSubtitleStyleId}
          subtitleColorOptions={subtitleColorOptions}
          subtitleStyleOptions={subtitleStyleOptions}
          onSelectColor={handleSegmentEditorSubtitleColorSelect}
          onSelectExample={setSelectedSubtitleExampleId}
          onSelectStyle={handleSegmentEditorSubtitleStyleSelect}
        />
        <StudioVoiceSelectorChip
          isEnabled={studioSidebarVoiceEnabled}
          variant="sidebar"
          onToggleEnabled={handleSegmentEditorVoiceToggle}
          selectedLanguage={selectedLanguage}
          selectedVoiceId={studioSidebarVoiceId}
          voiceOptions={selectedVoiceOptions}
          onSelect={handleSegmentEditorVoiceSelect}
        />
        <StudioMusicSelectorChip
          variant="sidebar"
          customMusicFile={selectedCustomMusic}
          isPreparingCustomMusic={isPreparingCustomMusic}
          onSelectCustomFile={handleSegmentEditorCustomMusicSelect}
          onSelectMusicType={handleSegmentEditorMusicTypeSelect}
          selectedMusicType={studioSidebarMusicType}
          uploadError={musicSelectionError}
        />
        <StudioLanguageSelectorChip
          variant="sidebar"
          selectedLanguage={selectedLanguage}
          onSelect={handleSegmentEditorLanguageSelect}
        />
      </div>
      {segmentEditorChangeSummary ? (
        <div className="studio-sidebar__summary">
          {segmentEditorChangeSummary}
        </div>
      ) : null}
    </aside>
  );
  const renderStudioShortsGenerationStatus = () => (
    <div className="studio-canvas-preview__generation-status">
      <span className="studio-segment-editor__generation-spinner" aria-hidden="true"></span>
      <strong>Генерируем Shorts</strong>
      <span>Собираем сегменты в видео</span>
    </div>
  );

  return (
    <>
      <div
        className={`route-page studio-canvas-route${isSegmentEditorPageActive ? " is-segment-editor" : ""}`}
        hidden={!isStudioRouteVisible}
      >
        <header className="site-header site-header--workspace">
          <div className="container site-header__inner">
            <Link className="brand" to="/" aria-label="AdShorts AI">
              <img src="/logo.png" alt="" width="44" height="44" />
              <span>AdShorts AI</span>
            </Link>

            <PrimarySiteNav
              activeItem="studio"
              onOpenStudio={() => setActiveTab("studio")}
              activeStudioSection={studioSidebarActiveItem}
              onOpenStudioSection={handleStudioTopMenuSelect}
              projectsCount={projects.length}
              studioSectionLabels={studioNavSectionLabels}
              onStudioBack={isSegmentEditorPageActive ? () => handleStudioTopMenuSelect("create") : null}
            />

            <div className="site-header__actions">
              <SiteHeaderWorkspaceStatus profile={workspaceProfile} />
              <AccountMenuButton email={session.email} name={session.name} onLogout={handleAccountLogout} plan={workspacePlanLabel} />
        </div>
          </div>
        </header>

        <main className={`studio-canvas-main${createMode === "segment-editor" ? " is-segment-editor" : ""}`}>
          <div className="studio-canvas-bg" aria-hidden="true">
            <span className="studio-canvas-bg__gradient"></span>
          </div>

          <div
            className={`studio-canvas-shell${
              shouldShowStudioSidebar
                ? " has-floating-sidebar"
                : " is-sidebar-hidden"
            }`}
          >
            {shouldShowStudioSidebar ? studioSidebar : null}

            <div className="studio-canvas-stage">
          <div className={`studio-canvas-create${createMode === "segment-editor" ? " is-segment-editor" : ""}`} hidden={studioView !== "create"}>
            {showStudioCanvasPageTitle ? (
              <div
                className={`studio-canvas-page-title${createMode === "segment-editor" ? " is-segment-editor" : ""}`}
                aria-label="Заголовок страницы"
              >
                <h1>{studioCanvasPageTitle}</h1>
              </div>
            ) : null}

	            <div className={`studio-canvas-content${createMode === "segment-editor" ? " is-segment-editor" : ""}`}>
	              {createMode === "default" && generateError && visibleGeneratedVideo ? (
	                <div className="studio-segment-editor__status is-error" role="status" aria-live="polite">
	                  {generateError}
	                </div>
	              ) : null}
	              {createMode === "default" && segmentEditorError ? (
	                <div className="studio-segment-editor__status is-error" role="status" aria-live="polite">
	                  {segmentEditorError}
	                </div>
	              ) : null}
	              {createMode === "segment-editor" && segmentEditorVideoError ? (
	                <div className="studio-segment-editor__status is-error" role="status" aria-live="polite">
	                  {segmentEditorVideoError}
	                </div>
	              ) : null}
                <div className="studio-canvas-create-layout">
	              <div className={`studio-canvas-preview${createMode === "segment-editor" ? " is-segment-editor" : ""}`}>
	                {createMode === "segment-editor" && segmentEditorDraft && activeSegment ? (
	                  <div className="studio-segment-editor">
	                    <div className="studio-segment-editor__layout">
                      <div className="studio-segment-editor__prompt-column">
                        {segmentEditorPromptPanel}
                      </div>
                      <div className="studio-segment-editor__preview-column">
                        <div className={`studio-segment-editor__stage${hasSegmentEditorChanges ? " has-summary" : ""}`}>
                          <div
                            className={`studio-segment-editor__carousel${isSegmentCarouselDragging ? " is-dragging" : ""}`}
                            onPointerCancel={(event) => finishSegmentCarouselPointerDrag(event, { cancelled: true })}
                            onPointerDown={handleSegmentCarouselPointerDown}
                            onPointerMove={handleSegmentCarouselPointerMove}
                            onPointerUp={finishSegmentCarouselPointerDrag}
                            onWheel={handleSegmentCarouselWheel}
                          >
                            <button
                              className="studio-segment-editor__arrow"
                              type="button"
                              aria-label="Предыдущий сегмент"
                              disabled={activeSegmentIndex <= 0}
                              onClick={() => activateSegmentEditorSegmentByArrayIndex(activeSegmentIndex - 1)}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>

                            <div className="studio-segment-editor__cards">
                              {([-1, 0, 1] as const).map((offset) => {
                                const nextSegmentArrayIndex = activeSegmentIndex + offset;
                                const segment = segmentEditorDraft.segments[nextSegmentArrayIndex] ?? null;
                                const slotClass =
                                  offset === 0 ? "is-active" : offset < 0 ? "is-side is-left" : "is-side is-right";

                                if (!segment) {
                                  if (
                                    offset > 0 &&
                                    nextSegmentArrayIndex === segmentEditorDraft.segments.length &&
                                    canAddSegmentEditorSegment
                                  ) {
                                    return (
                                      <button
                                        key={`add:${offset}`}
                                        className={`studio-segment-editor__card studio-segment-editor__card--add ${slotClass}`}
                                        type="button"
                                        style={getSegmentCarouselCardStyle(offset, { isAddCard: true })}
                                        disabled={isSegmentEditorStructureActionBusy}
                                        aria-label="Добавить сегмент"
                                        title={
                                          isSegmentEditorStructureActionBusy
                                            ? "Сейчас нельзя менять состав сегментов"
                                            : "Добавить сегмент"
                                        }
                                        onClick={handleAddSegmentEditorSegment}
                                      >
                                        <div className="studio-segment-editor__card-media studio-segment-editor__card-media--add">
                                          <div className="studio-segment-editor__card-add-copy">
                                            <span className="studio-segment-editor__card-add-icon" aria-hidden="true">
                                              +
                                            </span>
                                            <strong>Добавить сегмент</strong>
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  }

                                  return (
                                    <div
                                      className={`studio-segment-editor__card is-empty ${slotClass}`}
                                      key={`empty:${offset}`}
                                      style={getSegmentCarouselCardStyle(offset)}
                                      aria-hidden="true"
                                    />
                                  );
                                }

                                const isActiveCard = offset === 0;
                                const segmentNumber = nextSegmentArrayIndex + 1;
                                const isAiPhotoGenerationPending = segmentEditorGeneratingAiPhotoSegmentIndex === segment.index;
                                const isImageEditGenerationPending = segmentEditorGeneratingImageEditSegmentIndex === segment.index;
                                const isAiVideoGenerationPending = segmentEditorGeneratingAiVideoSegmentIndex === segment.index;
                                const isPhotoAnimationGenerationPending =
                                  segmentEditorGeneratingPhotoAnimationSegmentIndex === segment.index;
                                const isImageUpscalePending = segmentEditorUpscalingImageSegmentIndex === segment.index;
                                const isVisualGenerationPending =
                                  isAiPhotoGenerationPending ||
                                  isImageEditGenerationPending ||
                                  isAiVideoGenerationPending ||
                                  isPhotoAnimationGenerationPending ||
                                  isImageUpscalePending;
                                const isSegmentPlaying = isActiveCard && playingSegmentEditorPreviewIndex === segment.index;
                                const isSegmentPlaybackRequested =
                                  isActiveCard &&
                                  getWorkspaceSegmentPreviewKind(segment) === "video" &&
                                  (queuedSegmentEditorPlaybackIndex === segment.index || isSegmentPlaying);
                                const segmentMediaSurface = getWorkspaceSegmentResolvedMediaSurface(
                                  segment,
                                  "segment-carousel-card",
                                  {
                                    isPlaybackRequested: isSegmentPlaybackRequested,
                                  },
                                );
                                const mediaKind = segmentMediaSurface.previewKind;
                                const mediaUrl = segmentMediaSurface.displayUrl;
                                const mediaKey = mediaUrl
                                  ? `${segment.index}:${mediaKind}:${mediaUrl}:${segmentMediaSurface.posterUrl ?? "no-poster"}`
                                  : "";
                                const subtitlePreviewTime = isSegmentPlaying ? segmentEditorPreviewTimes[segment.index] ?? 0 : 0;
                                const isVisualEdited = isWorkspaceSegmentDraftVisualEdited(segment);
                                const segmentSourceLabel = getWorkspaceSegmentDraftSourceLabel(segment);
                                const hasResettableVisual =
                                  isVisualEdited ||
                                  segment.visualReset ||
                                  segment.videoAction === "custom" ||
                                  Boolean(segment.customVideo) ||
                                  segmentSourceLabel === "Свой визуал" ||
                                  segmentSourceLabel === "Медиатека";
                                const canResetVisual =
                                  hasResettableVisual && !isWorkspaceSegmentVisualResetApplied(segment);
                                const shouldShowEditableSubtitleOverlay =
                                  isActiveCard &&
                                  studioSidebarSubtitlesEnabled;

                                return (
                                  <div
                                    key={`segment:${segment.index}`}
                                    className={`studio-segment-editor__card ${slotClass}${isVisualGenerationPending ? " is-pending" : ""}${
                                      canResetVisual ? " is-visual-edited" : ""
                                    }`}
                                    style={getSegmentCarouselCardStyle(offset)}
                                    aria-current={offset === 0 ? "true" : undefined}
                                    aria-busy={isVisualGenerationPending ? true : undefined}
                                  >
                                    <div className="studio-segment-editor__card-media">
                                      {mediaUrl ? (
                                        <WorkspaceSegmentPreviewCardMedia
                                          autoplay={false}
                                          fallbackPosterUrl={segmentMediaSurface.fallbackPosterUrl}
                                          imageLoading={isActiveCard ? "eager" : "lazy"}
                                          isPlaybackRequested={isSegmentPlaybackRequested}
                                          loop={false}
                                          mediaKey={mediaKey}
                                          mountVideoWhenIdle={segmentMediaSurface.mountVideoWhenIdle}
                                          muted
                                          posterUrl={segmentMediaSurface.posterUrl}
                                          preferPosterFrame={segmentMediaSurface.preferPosterFrame}
                                          preload={mediaKind === "video" ? segmentMediaSurface.preloadPolicy : undefined}
                                          primePausedFrame={segmentMediaSurface.primePausedFrame}
                                          previewFallbackUrls={segmentMediaSurface.fallbackUrls}
                                          previewUrl={mediaUrl}
                                          previewKind={mediaKind}
                                          videoRef={
                                            isActiveCard && mediaKind === "video"
                                              ? getSegmentEditorPreviewVideoRef(segment.index)
                                              : undefined
                                          }
                                          onVideoTimeUpdate={handleSegmentEditorPreviewTimeUpdate(segment.index)}
                                          onVideoEnded={() => {
                                            logSegmentEditorDiagnostics("client.segment-editor.preview-video.ended", {
                                              segmentIndex: segment.index,
                                            });
                                            if (segmentEditorSyntheticPlaybackRef.current?.segmentIndex === segment.index) {
                                              return;
                                            }

                                            setPlayingSegmentEditorPreviewIndex((current) =>
                                              current === segment.index ? null : current,
                                            );
                                          }}
                                          onVideoPause={() => {
                                            logSegmentEditorDiagnostics("client.segment-editor.preview-video.paused", {
                                              segmentIndex: segment.index,
                                            });
                                            if (segmentEditorSyntheticPlaybackRef.current?.segmentIndex === segment.index) {
                                              return;
                                            }

                                            setPlayingSegmentEditorPreviewIndex((current) =>
                                              current === segment.index ? null : current,
                                            );
                                          }}
                                          onVideoPlay={() => {
                                            logSegmentEditorDiagnostics("client.segment-editor.preview-video.playing", {
                                              segmentIndex: segment.index,
                                            });
                                            setPlayingSegmentEditorPreviewIndex(segment.index);
                                          }}
                                        />
                                      ) : (
                                        <div className="studio-segment-editor__card-placeholder">
                                          {getSegmentVisualPlaceholderLabel(segment.index)}
                                        </div>
                                      )}
                                      {!isActiveCard ? (
                                        <button
                                          className="studio-segment-editor__card-hitbox studio-segment-editor__card-hitbox--side"
                                          type="button"
                                          data-preview-kind={mediaKind}
                                          data-segment-array-index={nextSegmentArrayIndex}
                                          data-segment-playback-index={segment.index}
                                          aria-label={`Переключиться на сегмент ${segmentNumber}`}
                                          onClick={handleSideSegmentEditorCardClick(
                                            nextSegmentArrayIndex,
                                            segment.index,
                                            mediaKind,
                                          )}
                                        />
                                      ) : null}
                                      {isActiveCard ? (
                                        <button
                                          className="studio-segment-editor__card-hitbox"
                                          type="button"
                                          disabled={isVisualGenerationPending}
                                          aria-label={
                                            mediaKind === "video"
                                              ? isSegmentPlaying
                                                ? `Остановить сегмент ${segmentNumber}`
                                                : `Воспроизвести сегмент ${segmentNumber}`
                                              : `Сегмент ${segmentNumber}`
                                          }
                                          aria-pressed={mediaKind === "video" ? isSegmentPlaying : undefined}
                                          onClick={handleActiveSegmentEditorCardClick(
                                            nextSegmentArrayIndex,
                                            segment.index,
                                            mediaKind,
                                          )}
                                        />
                                      ) : null}
                                      {shouldShowEditableSubtitleOverlay ? (
                                        <WorkspaceSegmentSubtitleOverlay
                                          clipCurrentTime={subtitlePreviewTime}
                                          isEditable
                                          isPlaying={isSegmentPlaying}
                                          onResetText={handleSegmentEditorTextReset}
                                          onTextChange={handleSegmentEditorTextChange}
                                          segment={segment}
                                          segmentNumber={segmentNumber}
                                          subtitleColorId={segmentEditorDraft.subtitleColor || selectedSubtitleColorId}
                                          subtitleColorOptions={subtitleColorOptions}
                                          subtitleStyleId={segmentEditorDraft.subtitleStyle || selectedSubtitleStyleId}
                                          subtitleStyleOptions={subtitleStyleOptions}
                                        />
                                      ) : null}
                                      {isVisualGenerationPending ? (
                                        <div className="studio-segment-editor__card-loader" role="status" aria-live="polite">
                                          <span className="studio-segment-editor__card-loader-spinner" aria-hidden="true"></span>
                                          <strong>
                                            {isImageUpscalePending
                                              ? "Улучшаем качество фото"
                                              : isPhotoAnimationGenerationPending
                                              ? "Анимируем фото"
                                              : isAiVideoGenerationPending
                                                ? "Генерируем ИИ видео"
                                                : isImageEditGenerationPending
                                                  ? "Редактируем фото"
                                                  : "Генерируем фото"}
                                          </strong>
                                          <span>Сегмент {segmentNumber} обновится автоматически</span>
                                        </div>
                                      ) : null}
                                      <div className={`studio-segment-editor__card-overlay${isActiveCard ? " is-active" : ""}`}>
                                        {isActiveCard ? (
                                          <div className="studio-segment-editor__card-overlay-footer">
                                            <div className="studio-segment-editor__card-overlay-main">
                                              <div className="studio-segment-editor__card-copy">
                                                <strong>Сегмент {segmentNumber}</strong>
                                                <span>
                                                  {formatWorkspaceSegmentEditorTime(getWorkspaceSegmentEditorDisplayStartTime(segment))} -{" "}
                                                  {formatWorkspaceSegmentEditorTime(getWorkspaceSegmentEditorDisplayEndTime(segment), {
                                                    roundUp: true,
                                                  })}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="studio-segment-editor__card-footer-actions">
                                              {segmentSourceLabel !== "Сток" ? (
                                                <small className="studio-segment-editor__card-badge">{segmentSourceLabel}</small>
                                              ) : null}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="studio-segment-editor__card-overlay-main">
                                            <div className="studio-segment-editor__card-copy">
                                              <strong>Сегмент {segmentNumber}</strong>
                                              <span>
                                                {formatWorkspaceSegmentEditorTime(getWorkspaceSegmentEditorDisplayStartTime(segment))} -{" "}
                                                {formatWorkspaceSegmentEditorTime(getWorkspaceSegmentEditorDisplayEndTime(segment), {
                                                  roundUp: true,
                                                })}
                                              </span>
                                            </div>
                                            {segmentSourceLabel !== "Сток" ? (
                                              <small className="studio-segment-editor__card-badge">{segmentSourceLabel}</small>
                                            ) : null}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {isActiveCard ? (
                                      <div className="studio-segment-editor__card-visual-meta">
                                        {canResetVisual ? (
                                          <span className="studio-segment-editor__card-visual-status">Визуал изменен</span>
                                        ) : (
                                          <span className="studio-segment-editor__card-visual-spacer" aria-hidden="true"></span>
                                        )}
                                        <div className="studio-segment-editor__card-visual-actions">
                                          {canResetVisual ? (
                                            <button
                                              className="studio-segment-editor__card-visual-reset"
                                              type="button"
                                              aria-label="Сбросить визуал сегмента"
                                              title="Сбросить визуал сегмента"
                                              onPointerDown={(event) => {
                                                event.stopPropagation();
                                              }}
                                              onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                resetSegmentEditorVisualByIndex(segment.index);
                                              }}
                                            >
                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                                <path
                                                  d="M20 11a8 8 0 1 1-2.34-5.66L20 8"
                                                  stroke="currentColor"
                                                  strokeWidth="1.9"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                />
                                                <path
                                                  d="M20 4v4h-4"
                                                  stroke="currentColor"
                                                  strokeWidth="1.9"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                />
                                              </svg>
                                            </button>
                                          ) : null}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>

                            <button
                              className="studio-segment-editor__arrow"
                              type="button"
                              aria-label="Следующий сегмент"
                              disabled={activeSegmentIndex >= segmentEditorDraft.segments.length - 1}
                              onClick={() => activateSegmentEditorSegmentByArrayIndex(activeSegmentIndex + 1)}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>

                            {isGenerating ? (
                              <div className="studio-segment-editor__generation-overlay" role="status" aria-live="polite">
                                <span className="studio-segment-editor__generation-spinner" aria-hidden="true"></span>
                                <strong>Генерируем Shorts</strong>
                                <span>Собираем сегменты в видео</span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="studio-segment-editor__thumbbar" style={segmentThumbBarStyle}>
                            <div
                              ref={segmentThumbStripRef}
                              className="studio-segment-editor__thumbstrip"
                              role="list"
                              aria-label="Все сцены"
                            >
                              {visibleSegmentThumbInsertIndex === 0 ? (
                                <div className="studio-segment-editor__thumb-gap" aria-hidden="true">
                                  <div className="studio-segment-editor__thumb-gap-line"></div>
                                </div>
                              ) : null}
                              {segmentEditorDraft.segments.map((segment, index) => {
                                const thumbMediaSurface = getWorkspaceSegmentResolvedMediaSurface(segment, "segment-thumb");
                                const thumbPreviewKind = thumbMediaSurface.previewKind;
                                const thumbUrl = thumbMediaSurface.displayUrl;
                                const isActiveThumb = index === activeSegmentIndex;
                                const isThumbVisualEdited = isWorkspaceSegmentDraftVisualEdited(segment);
                                const isDraggedThumb = index === draggedSegmentThumbIndex;

                                return (
                                  <Fragment key={`segment-thumb:${segment.index}`}>
                                    <div className={`studio-segment-editor__thumb-shell${isDraggedThumb ? " is-dragging" : ""}`}>
                                      <button
                                        ref={setSegmentThumbButtonRef(segment.index)}
                                        className={`studio-segment-editor__thumb${isActiveThumb ? " is-active" : ""}${
                                          isThumbVisualEdited ? " is-visual-edited" : ""
                                        }`}
                                        type="button"
                                        aria-pressed={isActiveThumb}
                                        aria-grabbed={isDraggedThumb ? true : undefined}
                                        aria-label={`Открыть сцену ${index + 1}`}
                                        onPointerCancel={(event) => finishSegmentThumbPointerDrag(index)(event, { cancelled: true })}
                                        onPointerDown={handleSegmentThumbPointerDown(index)}
                                        onPointerMove={handleSegmentThumbPointerMove(index)}
                                        onPointerUp={finishSegmentThumbPointerDrag(index)}
                                        onClick={(event) => {
                                          if (isSegmentThumbClickSuppressed()) {
                                            event.preventDefault();
                                            return;
                                          }

                                          event.preventDefault();
                                          if (index !== activeSegmentIndex) {
                                            void handleSegmentEditorCardClick(index, segment.index, thumbPreviewKind);
                                          }
                                        }}
                                      >
                                        <span className="studio-segment-editor__thumb-media">
                                          {thumbUrl ? (
                                            <WorkspaceSegmentPreviewCardMedia
                                              autoplay={false}
                                              fallbackPosterUrl={thumbMediaSurface.fallbackPosterUrl}
                                              imageLoading="lazy"
                                              loop={false}
                                              mediaKey={`thumb:${segment.index}:${thumbPreviewKind}:${thumbUrl}:${thumbMediaSurface.posterUrl ?? "no-poster"}`}
                                              mountVideoWhenIdle={thumbMediaSurface.mountVideoWhenIdle}
                                              muted
                                              posterUrl={thumbMediaSurface.posterUrl}
                                              preferPosterFrame={thumbMediaSurface.preferPosterFrame}
                                              preload={thumbPreviewKind === "video" ? thumbMediaSurface.preloadPolicy : undefined}
                                              primePausedFrame={thumbMediaSurface.primePausedFrame}
                                              previewFallbackUrls={thumbMediaSurface.fallbackUrls}
                                              previewKind={thumbPreviewKind}
                                              previewUrl={thumbUrl}
                                            />
                                          ) : (
                                            <span className="studio-segment-editor__thumb-placeholder">
                                              {getSegmentVisualPlaceholderLabel(segment.index)}
                                            </span>
                                          )}
                                          <span className="studio-segment-editor__thumb-copy">
                                            <strong>Сцена {index + 1}</strong>
                                            <small>
                                              {formatWorkspaceSegmentEditorTime(getWorkspaceSegmentEditorDisplayStartTime(segment))} -{" "}
                                              {formatWorkspaceSegmentEditorTime(getWorkspaceSegmentEditorDisplayEndTime(segment), {
                                                roundUp: true,
                                              })}
                                            </small>
                                          </span>
                                        </span>
                                      </button>
                                      <button
                                        className="studio-segment-editor__thumb-delete"
                                        type="button"
                                        disabled={!canDeleteSegmentEditorSegment || isSegmentEditorStructureActionBusy}
                                        aria-label={`Удалить сцену ${index + 1}`}
                                        title={
                                          canDeleteSegmentEditorSegment
                                            ? "Удалить сцену"
                                            : `Нужно оставить минимум ${WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS} сегмент`
                                        }
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          handleDeleteSegmentEditorSegment(segment.index);
                                        }}
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                          <path
                                            d="M7 7l10 10"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                          <path
                                            d="M17 7 7 17"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </button>
                                    </div>
                                    {visibleSegmentThumbInsertIndex === index + 1 ? (
                                      <div className="studio-segment-editor__thumb-gap" aria-hidden="true">
                                        <div className="studio-segment-editor__thumb-gap-line"></div>
                                      </div>
                                    ) : null}
                                  </Fragment>
                                );
                              })}
                              {canAddSegmentEditorSegment ? (
                                <div className="studio-segment-editor__thumb-shell studio-segment-editor__thumb-shell--add">
                                  <button
                                    className="studio-segment-editor__thumb studio-segment-editor__thumb--add"
                                    type="button"
                                    disabled={isSegmentEditorStructureActionBusy}
                                    aria-label="Добавить сегмент"
                                    title={
                                      isSegmentEditorStructureActionBusy
                                        ? "Сейчас нельзя менять состав сегментов"
                                        : "Добавить сегмент"
                                    }
                                    onClick={handleAddSegmentEditorSegment}
                                  >
                                    <span className="studio-segment-editor__thumb-media studio-segment-editor__thumb-media--add">
                                      <span className="studio-segment-editor__thumb-add-icon" aria-hidden="true">
                                        +
                                      </span>
                                    </span>
                                    <span className="studio-segment-editor__thumb-copy">
                                      <strong>Добавить сегмент</strong>
                                    </span>
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                ) : visibleGeneratedVideo && visibleGeneratedVideoPlaybackUrl && !isGeneratedVideoPlaybackBroken ? (
                  <div className="studio-canvas-preview__player-shell">
                    <WorkspaceModalVideoPlayer
                      autoPlay={false}
                      onError={() => handleStudioPreviewVideoError()}
                      poster={studioPreviewPosterUrl ?? undefined}
                      preload="metadata"
                      src={visibleGeneratedVideoPlaybackUrl}
                      topActions={
                        !isGenerating ? (
                          <>
                            <button
                              className="studio-canvas-preview__quick-action"
                              type="button"
                              aria-label="Открыть Shorts по сегментам"
                              title={
                                visibleGeneratedVideo?.adId
                                  ? "Открыть Shorts по сегментам"
                                  : "Shorts по сегментам доступны после сохранения проекта"
                              }
                              disabled={!visibleGeneratedVideo?.adId || isSegmentEditorLoading}
                              onClick={() => void handleOpenSegmentEditor()}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                <path d="m13 7 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              </svg>
                            </button>
                            <button
                              className="studio-canvas-preview__quick-action"
                              type="button"
                              aria-label="Опубликовать в YouTube"
                              title="Опубликовать"
                              onClick={() => void handlePublishPreview()}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M14 5h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M10 14 19 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                            {canManageLocalExamples ? (
                              <button
                                className="studio-canvas-preview__quick-action studio-canvas-preview__quick-action--accent"
                                type="button"
                                aria-label="Добавить видео в локальные примеры"
                                title="Добавить в примеры"
                                disabled={!canSaveGeneratedVideoToLocalExamples || isSavingLocalExample}
                                onClick={openLocalExampleModal}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path
                                    d="M12 4.75 14.16 9.13l4.84.7-3.5 3.41.83 4.82L12 15.8 7.67 18.06l.83-4.82L5 9.83l4.84-.7L12 4.75Z"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            ) : null}
                            <a
                              className="studio-canvas-preview__quick-action"
                              href={visibleGeneratedVideoPlaybackUrl}
                              download={studioInlinePreviewDownloadName}
                              aria-label="Скачать видео"
                              title="Скачать"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </a>
                            <button
                              className="studio-canvas-preview__quick-action"
                              type="button"
                              aria-label="Закрыть текущее видео"
                              title="Закрыть"
                              onClick={handleDismissStudioPreview}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                              </svg>
                            </button>
                          </>
                        ) : null
                      }
                      videoKey={visibleGeneratedVideo.id}
                      videoRef={(element) => {
                        previewVideoRef.current = element;
                      }}
                      volume={studioPreviewVolume}
                      onVolumeChange={setStudioPreviewVolume}
                    />
                    {isSegmentEditorLoading ? (
                      <div className="studio-canvas-preview__overlay">
                        <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                        <span>Загружаем сегменты...</span>
                      </div>
                    ) : isGenerating ? (
                      <div className="studio-canvas-preview__overlay is-generating" role="status" aria-live="polite">
                        {renderStudioShortsGenerationStatus()}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div
                    className={`studio-canvas-preview__placeholder${isGenerating ? " is-generating" : ""}${generateError ? " is-error" : ""}`}
                    role={isGenerating ? "status" : undefined}
                    aria-live={isGenerating ? "polite" : undefined}
                  >
                    {isGenerating ? (
                      renderStudioShortsGenerationStatus()
                    ) : generateError ? (
                      <>
                        <strong>Ошибка генерации</strong>
                        <p>{generateError}</p>
                      </>
                    ) : isWorkspaceBootstrapPending ? (
                      <>
                        <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                        <strong>Загрузка...</strong>
                      </>
                    ) : (
                      <>
                        <div className="studio-canvas-preview__icon" aria-hidden="true">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
                          </svg>
                        </div>
                        <strong>Создайте свой Shorts</strong>
                        <p>Введите тему и нажмите «Создать»</p>
                      </>
	                    )}
	                  </div>
	                )}
	              </div>
                  {contentPlanPanel}
                </div>
	            </div>

	            {createMode !== "segment-editor" ? (
	            <div className="studio-canvas-prompt">
	              <div
                ref={promptInnerRef}
	                className="studio-canvas-prompt__inner"
	                style={promptInnerStyle}
	              >
	                <div className="studio-canvas-prompt__editor-layout">
	                  <div className="studio-canvas-prompt__editor-pane">
	                    <>
                          {composerSourceIdea ? (
                            <div className="studio-canvas-prompt__head">
                              <div className="studio-canvas-prompt__source">
                                <span className="studio-canvas-prompt__source-label">Из контент-плана</span>
                                <strong>{composerSourceIdea.title}</strong>
                                <button type="button" onClick={handleClearComposerSourceIdea}>
                                  Сбросить
                                </button>
                              </div>
                              <div className="studio-canvas-prompt__topbar">
                                <button
                                  className={`studio-canvas-prompt__chip studio-canvas-prompt__chip--toggle${isContentPlanVisible ? " is-active" : ""}`}
                                  type="button"
                                  data-studio-content-plan-toggle="true"
                                  onClick={handleToggleContentPlanVisibility}
                                >
                                  План
                                </button>
                              </div>
                            </div>
                          ) : null}
	                        {segmentEditorError ? <p className="studio-canvas-prompt__notice is-error">{segmentEditorError}</p> : null}
	                        {hasAppliedSegmentEditorSession ? (
	                          <p className="studio-canvas-prompt__notice">
	                            Сегменты сохранены: {currentAppliedSegmentEditorSession?.segments.length ?? 0}. Следующий запуск обновит текущий проект.
                          </p>
                        ) : null}
                        <div className="studio-canvas-prompt__input-row">
                          <div className="studio-canvas-prompt__input-main">
                            <textarea
                              className="studio-canvas-prompt__textarea"
                              placeholder="Опишите идею для Shorts..."
                              value={topicInput}
                              onChange={(event) => setTopicInput(event.target.value)}
                              rows={1}
	                            />
                          </div>
                          {!composerSourceIdea ? (
                            <div className="studio-canvas-prompt__topbar">
                              <button
                                className={`studio-canvas-prompt__chip studio-canvas-prompt__chip--toggle${isContentPlanVisible ? " is-active" : ""}`}
                                type="button"
                                data-studio-content-plan-toggle="true"
                                onClick={handleToggleContentPlanVisibility}
                              >
                                План
                              </button>
                            </div>
                          ) : null}
                        </div>
		                        <div className="studio-canvas-prompt__footer" ref={promptFooterRef}>
	                          <div className="studio-canvas-prompt__chips" ref={promptChipsRef}>
		                            {studioPromptChips.map((chip) =>
		                              chip === "Видео" ? (
		                                <StudioVideoSelectorChip
                                  key={chip}
                                  brandLogoFile={selectedBrandLogo}
                                  brandText={brandText}
                                  brandUploadError={brandSelectionError}
                                  customVideoFile={selectedCustomVideo}
                                  isPreparingBrandLogo={isPreparingBrandLogo}
                                  isPreparingCustomVideo={isPreparingCustomVideo}
                                  onBrandLogoSelect={handleBrandLogoSelect}
                                  onBrandTextChange={handleBrandTextChange}
                                  onClearBrandText={handleClearBrandText}
                                  onRemoveBrandLogo={handleRemoveBrandLogo}
                                  onSelectCustomFile={handleCustomVideoSelect}
                                  onSelectVideoMode={handleVideoModeSelect}
                                  selectedVideoMode={selectedVideoMode}
                                  uploadError={videoSelectionError}
                                />
                              ) : chip === "Субтитры" ? (
                                <StudioSubtitleSelectorChip
                                  key={chip}
                                  isEnabled={areSubtitlesEnabled}
                                  onToggleEnabled={handleSubtitleToggle}
                                  selectedColorId={selectedSubtitleColorId}
                                  selectedExampleId={selectedSubtitleExampleId}
                                  selectedStyleId={selectedSubtitleStyleId}
                                  subtitleColorOptions={subtitleColorOptions}
                                  subtitleStyleOptions={subtitleStyleOptions}
                                  onSelectColor={setSelectedSubtitleColorId}
                                  onSelectExample={setSelectedSubtitleExampleId}
                                  onSelectStyle={handleSubtitleStyleSelect}
                                />
                              ) : chip === "Озвучка" ? (
                                <StudioVoiceSelectorChip
                                  key={chip}
                                  isEnabled={isVoiceoverEnabled}
                                  onToggleEnabled={handleVoiceToggle}
                                  selectedLanguage={selectedLanguage}
                                  selectedVoiceId={resolvedSelectedVoiceId}
                                  onSelect={handleVoiceSelect}
                                  voiceOptions={selectedVoiceOptions}
                                />
                              ) : chip === "Музыка" ? (
                                <StudioMusicSelectorChip
                                  key={chip}
                                  customMusicFile={selectedCustomMusic}
                                  isPreparingCustomMusic={isPreparingCustomMusic}
                                  onSelectCustomFile={handleCustomMusicSelect}
                                  onSelectMusicType={handleMusicTypeSelect}
                                  selectedMusicType={selectedMusicType}
                                  uploadError={musicSelectionError}
                                />
                              ) : chip === "Язык" ? (
                                <StudioLanguageSelectorChip
                                  key={chip}
                                  selectedLanguage={selectedLanguage}
                                  onSelect={setSelectedLanguage}
                                />
		                              ) : (
		                                <span className="studio-canvas-prompt__chip" key={chip}>
		                                  {chip}
		                                </span>
		                              ),
		                            )}
	                          </div>
                            <div className="studio-canvas-prompt__submit" ref={promptSubmitRef}>
	                            <button
                                className={`studio-canvas-prompt__btn${isGenerating || isPreparingCustomVideo || isPreparingCustomMusic ? " is-generating" : ""}`}
                                type="button"
                                aria-label={`Создать Shorts за ${formatCreditsCountLabel(studioCreateRequiredCredits)}`}
                                title={`Создать Shorts за ${studioCreateCostLabel}`}
                                disabled={isGenerating || isPreparingCustomVideo || isPreparingCustomMusic}
                                onClick={() =>
                                  hasAppliedSegmentEditorSession
                                    ? handleGenerate(topicInput, buildCurrentRegenerationOptions())
                                    : handleGenerate(topicInput)
                                }
                              >
                                {isGenerating || isPreparingCustomVideo || isPreparingCustomMusic ? (
                                  <span className="studio-canvas-prompt__btn-spinner"></span>
                                ) : (
                                  <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                                      <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                    <span className="studio-canvas-prompt__btn-label">{studioCreateCostLabel}</span>
                                  </>
                                )}
                              </button>
                            </div>
                        </div>
                      </>
                  </div>
                </div>
              </div>
            </div>
            ) : null}
          </div>

	          {studioView === "projects" ? (
              <div className="studio-projects">
              {projectDeleteError ? (
                <p className="project-action-error" role="alert">
                  {projectDeleteError}
                </p>
              ) : null}
              {isProjectsLoading ? (
                <div className="studio-projects__loading">
                  <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                  <p>Загружаем проекты...</p>
                </div>
              ) : projectsError ? (
                <div className="studio-projects__error">
                  <strong>Не удалось загрузить</strong>
                  <p>{projectsError}</p>
                  <button
                    className="studio-projects__retry"
                    type="button"
                    onClick={() => setHasLoadedProjects(false)}
                  >
                    Повторить
                  </button>
                </div>
              ) : projects.length === 0 ? (
                <div className="studio-projects__empty">
                  <div className="studio-projects__empty-icon" aria-hidden="true">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <strong>Проектов пока нет</strong>
                  <p>Создайте свой Shorts, и он появится здесь</p>
                  <button
                    className="studio-projects__create"
                    type="button"
                    onClick={() => {
                      setStudioView("create");
                      syncStudioRouteSection("create");
                    }}
                  >
                    Создать Shorts
                  </button>
                </div>
              ) : (
                <div className="studio-projects__grid">
                  {accountProjectGroups.flatMap((group: WorkspaceProjectStackGroup<WorkspaceProject>) => {
                    if (!group.isStack) {
                      return [
                        <WorkspaceProjectCard
                          key={group.leadProject.id}
                          canUseLocalExamples={canManageLocalExamples}
                          isProjectActionBusy={isSegmentEditorLoading || isSavingLocalExample}
                          isPreviewing={activeProjectPreviewId === group.leadProject.id}
                          onAddToExamples={handleOpenProjectLocalExampleModal}
                          onActivate={activateProjectPreview}
                          onBlur={handleProjectCardBlur(group.leadProject.id)}
                          onDeactivate={deactivateProjectPreview}
                          onDelete={requestProjectDelete}
                          onEdit={(targetProject) => void handleOpenProjectSegmentEditor(targetProject)}
                          onOpenPreview={handleOpenProjectPreviewModal}
                          onPublish={(targetProject) => void handleOpenProjectPublish(targetProject)}
                          project={group.leadProject}
                        />,
                      ];
                    }

                    const isExpanded = expandedStudioProjectStackKey === group.key;
                    const toggleStack = () =>
                      setExpandedStudioProjectStackKey((currentKey) => (currentKey === group.key ? null : group.key));

                    if (isExpanded) {
                      return group.projects.map((project, index) => (
	                    <WorkspaceProjectCard
	                      key={project.id}
                          canUseLocalExamples={canManageLocalExamples}
                          isProjectActionBusy={isSegmentEditorLoading || isSavingLocalExample}
	                      isPreviewing={activeProjectPreviewId === project.id}
                          isStackExpanded={index === 0}
                          onAddToExamples={handleOpenProjectLocalExampleModal}
	                      onActivate={activateProjectPreview}
	                      onBlur={handleProjectCardBlur(project.id)}
	                      onDeactivate={deactivateProjectPreview}
                        onDelete={requestProjectDelete}
                          onEdit={(targetProject) => void handleOpenProjectSegmentEditor(targetProject)}
	                      onOpenPreview={handleOpenProjectPreviewModal}
                          onPublish={(targetProject) => void handleOpenProjectPublish(targetProject)}
                          onToggleStack={index === 0 ? toggleStack : undefined}
	                      project={project}
                          showStackCollapseHandle={index === 0}
                          stackBadgeLabel={null}
                        />
                      ));
                    }

                    return (
                      <div className={`studio-project-stack${isExpanded ? " is-expanded" : ""}`} key={group.key}>
                        <div className="studio-project-stack__lead">
                          <WorkspaceProjectCard
                            canUseLocalExamples={canManageLocalExamples}
                            isProjectActionBusy={isSegmentEditorLoading || isSavingLocalExample}
                            isPreviewing={activeProjectPreviewId === group.leadProject.id}
                            isStackExpanded={isExpanded}
                            isStackLead
                            onAddToExamples={handleOpenProjectLocalExampleModal}
                            onActivate={activateProjectPreview}
                            onBlur={handleProjectCardBlur(group.leadProject.id)}
                            onDeactivate={deactivateProjectPreview}
                            onDelete={() => requestProjectStackDelete(group.projects)}
                            onEdit={(targetProject) => void handleOpenProjectSegmentEditor(targetProject)}
                            onOpenPreview={handleOpenProjectPreviewModal}
                            onPublish={(targetProject) => void handleOpenProjectPublish(targetProject)}
                            onToggleStack={toggleStack}
                            project={group.leadProject}
                            stackBadgeLabel={formatProjectVersionsLabel(group.projects.length)}
                          />
                        </div>
                      </div>
                    );
                  })}
            </div>
              )}
            </div>
            ) : null}
            {studioView === "media" ? (
            <div className="studio-media-library" ref={mediaLibraryScrollRootRef}>
              {visibleMediaLibraryItems.length > 0 ? (
                <>
                  <div className="studio-media-library__head">
                    <div className="studio-media-library__copy">
                      <strong>Медиатека ИИ визуалов</strong>
                    </div>
                    <div className="studio-media-library__pills">
                      <button
                        className={`studio-media-library__pill${mediaLibraryFilter === "all" ? " is-active" : ""}`}
                        type="button"
                        aria-pressed={mediaLibraryFilter === "all"}
                        onClick={() => setMediaLibraryFilter("all")}
                      >
                        {mediaLibraryAllPillLabel}
                      </button>
                      <button
                        className={`studio-media-library__pill${mediaLibraryFilter === "photo" ? " is-active" : ""}`}
                        type="button"
                        aria-pressed={mediaLibraryFilter === "photo"}
                        onClick={() => setMediaLibraryFilter((current) => (current === "photo" ? "all" : "photo"))}
                      >
                        ИИ фото: {visibleAiPhotoGroupMediaItemsCount}
                      </button>
                      <button
                        className={`studio-media-library__pill${mediaLibraryFilter === "video" ? " is-active" : ""}`}
                        type="button"
                        aria-pressed={mediaLibraryFilter === "video"}
                        onClick={() => setMediaLibraryFilter((current) => (current === "video" ? "all" : "video"))}
                      >
                        ИИ видео: {visibleAiVideoGroupMediaItemsCount}
                      </button>
                    </div>
                  </div>

                  {filteredVisibleMediaLibraryItems.length > 0 ? (
                    <div className="studio-media-library__grid">
                      {filteredVisibleMediaLibraryItems.map((item) => {
                      const itemKindLabel = getWorkspaceMediaLibraryItemKindLabel(item.kind, item.assetKind);
                      const itemKindLabelLower = itemKindLabel.toLowerCase();
                      const canDownloadSegment = Boolean(item.downloadUrl);
                      const openPhotoLabel = `Открыть ${itemKindLabelLower}, проект ${item.projectTitle}, сегмент ${item.segmentNumber}`;
                      const deletePhotoLabel = `Удалить из медиатеки ${itemKindLabelLower}, проект ${item.projectTitle}, сегмент ${item.segmentNumber}`;
                      const mediaLibrarySurface = getWorkspaceMediaLibraryResolvedMediaSurface(item, "media-library-tile");

                      return (
                        <article
                          key={`media-library:${item.itemKey}`}
                          className={`studio-media-library__card ${
                            item.previewKind === "video"
                              ? "studio-media-library__card--video"
                              : "studio-media-library__card--photo"
                          }`}
                        >
                          <div className="studio-media-library__frame">
                            <button
                              className="studio-media-library__card-hitbox"
                              type="button"
                              aria-label={openPhotoLabel}
                              onClick={() => {
                                void handleOpenMediaLibraryItem(item);
                              }}
                            >
                              <span className="studio-media-library__media">
                                {renderWorkspaceMediaLibraryPlayOverlay(item.previewKind)}
                                <WorkspaceSegmentPreviewCardMedia
                                  autoplay={false}
                                  imageLoading="lazy"
                                  mediaKey={`media-library:${item.projectId}:${item.segmentIndex}:${mediaLibrarySurface.displayUrl}:${mediaLibrarySurface.posterUrl ?? "no-poster"}`}
                                  mountVideoWhenIdle={mediaLibrarySurface.mountVideoWhenIdle}
                                  muted
                                  posterUrl={mediaLibrarySurface.posterUrl}
                                  preferPosterFrame={mediaLibrarySurface.preferPosterFrame}
                                  preload={item.previewKind === "video" ? mediaLibrarySurface.preloadPolicy : undefined}
                                  primePausedFrame={mediaLibrarySurface.primePausedFrame}
                                  previewUrl={mediaLibrarySurface.displayUrl ?? item.previewUrl}
                                  previewKind={mediaLibrarySurface.previewKind}
                                />
                              </span>
                            </button>
                            <a
                              className={`studio-media-library__download${canDownloadSegment ? "" : " is-disabled"}`}
                              href={item.downloadUrl ?? undefined}
                              download={item.downloadName}
                              aria-label={`Скачать ${itemKindLabelLower}`}
                              tabIndex={canDownloadSegment ? 0 : -1}
                              title="Скачать"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (!canDownloadSegment) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                  d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
                                  stroke="currentColor"
                                  strokeWidth="1.9"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </a>
                            <button
                              className="studio-media-library__delete"
                              type="button"
                              aria-label={deletePhotoLabel}
                              title="Удалить из медиатеки"
                              onClick={(event) => {
                                event.stopPropagation();
                                dismissMediaLibraryItem(item);
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <path d="M4 7h16" strokeLinecap="round" />
                                <path d="M9 3h6" strokeLinecap="round" />
                                <path d="M10 11v6" strokeLinecap="round" />
                                <path d="M14 11v6" strokeLinecap="round" />
                                <path
                                  d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="studio-projects__empty">
                      <div className="studio-projects__empty-icon" aria-hidden="true">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
                        </svg>
                      </div>
                      <strong>{mediaLibraryFilter === "photo" ? "Нет ИИ фото" : "Нет ИИ видео"}</strong>
                      <p>
                        {mediaLibraryFilter === "photo"
                          ? "В медиатеке сейчас нет доступных фото для этого фильтра."
                          : "В медиатеке сейчас нет доступных видео для этого фильтра."}
                      </p>
                      <button
                        className="studio-projects__retry"
                        type="button"
                        onClick={() => setMediaLibraryFilter("all")}
                      >
                        Сбросить фильтр
                      </button>
                    </div>
                  )}
                  {mediaLibraryNextCursor || shouldShowMediaLibraryGridLoadingState ? (
                    <div
                      ref={mediaLibraryNextCursor ? mediaLibraryLoadMoreSentinelRef : undefined}
                      className="studio-media-library__load-more-sentinel"
                      role={isMediaLibraryLoadingMore ? "status" : undefined}
                      aria-live={isMediaLibraryLoadingMore ? "polite" : undefined}
                    >
                      {isMediaLibraryLoadingMore ? (
                        <>
                          <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                          <span>Загрузка...</span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : !hasLoadedProjects && isProjectsLoading ? (
                <div className="studio-projects__loading">
                  <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                  <p>Загружаем проекты для медиатеки...</p>
                </div>
              ) : projectsError ? (
                <div className="studio-projects__error">
                  <strong>Не удалось загрузить проекты</strong>
                  <p>{projectsError}</p>
                  <button
                    className="studio-projects__retry"
                    type="button"
                    onClick={() => setHasLoadedProjects(false)}
                  >
                    Повторить
                  </button>
                </div>
              ) : mediaLibraryProjects.length === 0 && resolvedMediaLibraryItems.length === 0 ? (
                <div className="studio-projects__empty">
                  <div className="studio-projects__empty-icon" aria-hidden="true">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
                    </svg>
                  </div>
                  <strong>Медиатека появится после генерации AI визуалов</strong>
                  <p>Сгенерируйте ИИ фото, ИИ видео или анимацию фото в редакторе сегментов, чтобы они появились здесь сразу.</p>
                  <button
                    className="studio-projects__create"
                    type="button"
                    onClick={() => {
                      setStudioView("create");
                      syncStudioRouteSection("create");
                      void handleStudioCreateModeSwitch("default");
                    }}
                  >
                    Создать Shorts
                  </button>
                </div>
              ) : isMediaLibraryLoading && resolvedMediaLibraryItems.length === 0 ? (
                <div className="studio-projects__loading">
                  <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                  <p>Загружаем медиатеку...</p>
                </div>
              ) : mediaLibraryError && resolvedMediaLibraryItems.length === 0 ? (
                <div className="studio-projects__error">
                  <strong>Не удалось открыть медиатеку</strong>
                  <p>{mediaLibraryError}</p>
                  <button
                    className="studio-projects__retry"
                    type="button"
                    onClick={() => setMediaLibraryReloadToken((current) => current + 1)}
                  >
                    Повторить
                  </button>
                </div>
              ) : isMediaLibraryResolvingVisibleItems ? (
                <div className="studio-projects__loading">
                  <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                  <p>Подбираем доступные медиа...</p>
                </div>
              ) : visibleMediaLibraryItems.length === 0 ? (
                <div className="studio-projects__empty">
                  <div className="studio-projects__empty-icon" aria-hidden="true">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
                    </svg>
                  </div>
                  <strong>Медиатека пока пуста</strong>
                  <p>В этой сессии и в готовых проектах пока нет доступных ИИ визуалов.</p>
                </div>
              ) : null}
            </div>
            ) : null}
            </div>
          </div>
        </main>

        {segmentThumbDragState && segmentThumbDragSegment && segmentThumbDragGhostStyle && typeof document !== "undefined"
          ? createPortal(
              <div className="studio-segment-editor__thumb-ghost" aria-hidden="true" style={segmentThumbDragGhostStyle}>
                {(() => {
                  const ghostMediaSurface = getWorkspaceSegmentResolvedMediaSurface(
                    segmentThumbDragSegment,
                    "segment-drag-ghost",
                  );
                  const ghostPreviewKind = ghostMediaSurface.previewKind;
                  const ghostPreviewUrl = ghostMediaSurface.displayUrl;

                  return (
                    <span className="studio-segment-editor__thumb-media">
                      {ghostPreviewUrl ? (
                        <WorkspaceSegmentPreviewCardMedia
                          autoplay={false}
                          fallbackPosterUrl={ghostMediaSurface.fallbackPosterUrl}
                          imageLoading="lazy"
                          loop={false}
                          mediaKey={`thumb-ghost:${segmentThumbDragSegment.index}:${ghostPreviewKind}:${ghostPreviewUrl}:${ghostMediaSurface.posterUrl ?? "no-poster"}`}
                          mountVideoWhenIdle={ghostMediaSurface.mountVideoWhenIdle}
                          muted
                          posterUrl={ghostMediaSurface.posterUrl}
                          preferPosterFrame={ghostMediaSurface.preferPosterFrame}
                          preload={ghostPreviewKind === "video" ? ghostMediaSurface.preloadPolicy : undefined}
                          previewFallbackUrls={ghostMediaSurface.fallbackUrls}
                          previewKind={ghostPreviewKind}
                          previewUrl={ghostPreviewUrl}
                        />
                      ) : (
                        <span className="studio-segment-editor__thumb-placeholder">
                          {getSegmentVisualPlaceholderLabel(segmentThumbDragSegment.index)}
                        </span>
                      )}
                    </span>
                  );
                })()}
                <span className="studio-segment-editor__thumb-copy">
                  <strong>Сцена {segmentThumbDragState.draggedIndex + 1}</strong>
                  <small>
                    {formatWorkspaceSegmentEditorTime(getWorkspaceSegmentEditorDisplayStartTime(segmentThumbDragSegment))} -{" "}
                    {formatWorkspaceSegmentEditorTime(getWorkspaceSegmentEditorDisplayEndTime(segmentThumbDragSegment), {
                      roundUp: true,
                    })}
                  </small>
                </span>
              </div>,
              document.body,
            )
          : null}

        {insufficientCreditsContext && typeof document !== "undefined"
          ? createPortal(
              <InsufficientCreditsModal
                context={insufficientCreditsContext}
                onAction={handleInsufficientCreditsAction}
                onClose={closeInsufficientCreditsModal}
              />,
              document.body,
            )
          : null}

        {isLocalExampleModalOpen && localExampleSource && typeof document !== "undefined"
          ? createPortal(
              <div className="studio-local-example-modal" role="dialog" aria-modal="true" aria-labelledby="studio-local-example-title">
                <button
                  className="studio-local-example-modal__backdrop route-close"
                  type="button"
                  aria-label="Закрыть окно добавления в примеры"
                  onClick={closeLocalExampleModal}
                />

                <div className="studio-local-example-modal__panel" role="document">
                  <button
                    className="studio-local-example-modal__close route-close"
                    type="button"
                    aria-label="Закрыть окно добавления в примеры"
                    onClick={closeLocalExampleModal}
                    disabled={isSavingLocalExample}
                  >
                    ×
                  </button>

                  <div className="studio-local-example-modal__hero">
                    <span className="studio-local-example-modal__eyebrow">Локальные примеры</span>
                    <strong id="studio-local-example-title">Добавить видео в примеры</strong>
                    <p>
                      Видео сохранится локально для вашего аккаунта и останется в примерах даже после удаления проекта.
                    </p>
                  </div>

                  <div className="studio-local-example-modal__summary">
                    <span>Заголовок видео</span>
                    <strong>{localExampleSource.title}</strong>
                    <p>{localExampleSource.prompt || "Тема будет сохранена из выбранного проекта."}</p>
                  </div>

                  <div className="studio-local-example-modal__section">
                    <div className="studio-local-example-modal__section-head">
                      <strong>Куда добавить</strong>
                      <span>При нажатии «Использовать» в примерах в студию подставится эта тема из базы.</span>
                    </div>

                    <div className="studio-local-example-modal__goal-grid" role="list" aria-label="Раздел примеров">
                      {workspaceLocalExampleGoalOptions.map((option) => (
                        <button
                          key={option.id}
                          className={`studio-local-example-modal__goal${selectedLocalExampleGoal === option.id ? " is-selected" : ""}`}
                          type="button"
                          onClick={() => setSelectedLocalExampleGoal(option.id)}
                        >
                          <strong>{option.label}</strong>
                          <span>{option.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedLocalExampleGoalOption ? (
                    <p className="studio-local-example-modal__hint">
                      Раздел: <strong>{selectedLocalExampleGoalOption.label}</strong>. {selectedLocalExampleGoalOption.description}
                    </p>
                  ) : null}

                  {localExampleSaveError ? (
                    <p className="studio-local-example-modal__error" role="alert">
                      {localExampleSaveError}
                    </p>
                  ) : null}

                  <div className="studio-local-example-modal__actions">
                    <button
                      className="studio-local-example-modal__action studio-local-example-modal__action--secondary"
                      type="button"
                      onClick={closeLocalExampleModal}
                      disabled={isSavingLocalExample}
                    >
                      Отмена
                    </button>
                    <button
                      className="studio-local-example-modal__action studio-local-example-modal__action--primary"
                      type="button"
                      onClick={() => void handleSaveVideoToLocalExamples()}
                      disabled={isSavingLocalExample}
                    >
                      {isSavingLocalExample ? (
                        <>
                          <span className="studio-local-example-modal__spinner" aria-hidden="true"></span>
                          Сохраняем...
                        </>
                      ) : (
                        "Добавить в примеры"
                      )}
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}

        {projectPendingDelete && typeof document !== "undefined"
          ? createPortal(
              <div className="workspace-confirm-modal" role="dialog" aria-modal="true" aria-label="Удаление проекта">
                <button
                  className="workspace-confirm-modal__backdrop route-close"
                  type="button"
                  aria-label="Закрыть подтверждение удаления проекта"
                  onClick={closeProjectDeleteModal}
                />
                <div className="workspace-confirm-modal__panel" role="document">
                  <button
                    className="workspace-confirm-modal__close route-close"
                    type="button"
                    aria-label="Закрыть подтверждение удаления проекта"
                    onClick={closeProjectDeleteModal}
                    disabled={isProjectDeleteSubmitting}
                  >
                    ×
                  </button>

                  <div className="workspace-confirm-modal__hero">
                    <div className="workspace-confirm-modal__icon" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="M4 7h16" strokeLinecap="round" />
                        <path d="M9 3h6" strokeLinecap="round" />
                        <path d="M10 11v6" strokeLinecap="round" />
                        <path d="M14 11v6" strokeLinecap="round" />
                        <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                      <span className="workspace-confirm-modal__eyebrow">
                        {projectPendingDeleteProjects.length > 1 ? "Удаление стопки" : "Удаление проекта"}
                      </span>
                  </div>

                  <div className="workspace-confirm-modal__project">
                    <span>
                      {projectPendingDeleteProjects.length > 1
                        ? `Будет удалено проектов: ${projectPendingDeleteProjects.length}`
                        : "Будет удалён"}
                    </span>
                    <strong>{getWorkspaceProjectDisplayTitle(projectPendingDelete)}</strong>
                  </div>

                  {projectDeleteError ? (
                    <p className="workspace-confirm-modal__error" role="alert">
                      {projectDeleteError}
                    </p>
                  ) : null}

                  <div className="workspace-confirm-modal__actions">
                    <button
                      className="workspace-confirm-modal__action workspace-confirm-modal__action--secondary"
                      type="button"
                      onClick={closeProjectDeleteModal}
                      disabled={isProjectDeleteSubmitting}
                    >
                      Отмена
                    </button>
                    <button
                      className="workspace-confirm-modal__action workspace-confirm-modal__action--danger"
                      type="button"
                      onClick={() => void handleDeleteProject()}
                      disabled={isProjectDeleteSubmitting}
                    >
                      {isProjectDeleteSubmitting ? (
                        <>
                          <span className="workspace-confirm-modal__spinner" aria-hidden="true"></span>
                          Удаляем...
                        </>
                      ) : (
                        projectPendingDeleteProjects.length > 1 ? "Удалить стопку" : "Удалить проект"
                      )}
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}

        {isSegmentAiPhotoModalOpen && segmentAiPhotoModalSegment && typeof document !== "undefined"
          ? createPortal(
              <div
                className={`studio-ai-photo-modal${isSegmentAiPhotoModalVisible ? " is-visible" : ""}`}
                role="dialog"
                aria-labelledby="segment-visual-modal-title"
              >
                <form
                  ref={segmentAiPhotoModalPanelRef}
                  className={`studio-ai-photo-modal__panel studio-ai-photo-modal__panel--${segmentAiPhotoModalTab}`}
                  role="document"
                >
                  <button
                    className="studio-ai-photo-modal__close route-close"
                    type="button"
                    aria-label="Закрыть окно редактирования визуала"
                    onClick={() => {
                      closeSegmentAiPhotoModal();
                    }}
                  >
                    <span aria-hidden="true">−</span>
                  </button>

                  <input
                    ref={segmentAiPhotoModalFileInputRef}
                    className="studio-ai-photo-modal__file-input"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.avif,.mp4,.mov,.webm,.m4v,image/*,video/*"
                    onChange={(event) => {
                      void handleSegmentAiPhotoModalCustomVideoChange(event);
                    }}
                  />

                  <div className="studio-ai-photo-modal__layout">
                    <section className="studio-ai-photo-modal__control-pane">
                      <div className="studio-ai-photo-modal__control-head">
                        <div className="studio-ai-photo-modal__control-topline">
                          <div className="studio-ai-photo-modal__control-title">
                            <span className="studio-ai-photo-modal__control-kicker" id="segment-visual-modal-title">
                              Визуал сегмента {segmentAiPhotoModalSegmentNumber ?? segmentAiPhotoModalSegment.index + 1}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="studio-ai-photo-modal__tool-groups" aria-label="Инструменты визуала">
                        <section className="studio-ai-photo-modal__tool-group" aria-labelledby="segment-visual-group-create">
                          <div className="studio-ai-photo-modal__tool-group-head">
                            <strong id="segment-visual-group-create">Создание сцены</strong>
                          </div>
                          <div className="studio-ai-photo-modal__source-switcher" aria-label="Создание сцены">
                            {renderSegmentAiPhotoModalSourceButton({
                              title: "ИИ фото",
                              description: "Сцена по описанию",
                              isActive: segmentAiPhotoModalTab === "ai_photo",
                              footer: segmentAiPhotoModalAiPhotoStatus ? (
                                <span className={`studio-ai-photo-modal__source-status is-${segmentAiPhotoModalAiPhotoStatus.tone}`}>
                                  <span className="studio-ai-photo-modal__source-status-dot" aria-hidden="true"></span>
                                  {segmentAiPhotoModalAiPhotoStatus.label}
                                </span>
                              ) : null,
                              onClick: () => {
                                setSegmentEditorVideoError(null);
                                setSegmentAiPhotoModalTab("ai_photo");
                              },
                            })}
                            {renderSegmentAiPhotoModalSourceButton({
                              title: "ИИ видео",
                              description: "Сцена и движение",
                              isActive: segmentAiPhotoModalTab === "ai_video",
                              footer: segmentAiPhotoModalAiVideoStatus ? (
                                <span className={`studio-ai-photo-modal__source-status is-${segmentAiPhotoModalAiVideoStatus.tone}`}>
                                  <span className="studio-ai-photo-modal__source-status-dot" aria-hidden="true"></span>
                                  {segmentAiPhotoModalAiVideoStatus.label}
                                </span>
                              ) : null,
                              onClick: () => {
                                setSegmentEditorVideoError(null);
                                setSegmentAiPhotoModalTab("ai_video");
                              },
                            })}
                            {renderSegmentAiPhotoModalSourceButton({
                              title: "ИИ анимация фото",
                              description: "Движение из выбранного фото",
                              isActive: segmentAiPhotoModalTab === "photo_animation",
                              disabled: !canAnimateSegmentPhoto,
                              buttonTitle: !canAnimateSegmentPhoto ? segmentPhotoToolUnavailableReason : "Анимировать фото",
                              footer: canAnimateSegmentPhoto ? (
                                segmentAiPhotoModalPhotoAnimationStatus ? (
                                  <span className={`studio-ai-photo-modal__source-status is-${segmentAiPhotoModalPhotoAnimationStatus.tone}`}>
                                    <span className="studio-ai-photo-modal__source-status-dot" aria-hidden="true"></span>
                                    {segmentAiPhotoModalPhotoAnimationStatus.label}
                                  </span>
                                ) : null
                              ) : null,
                              onClick: () => {
                                setSegmentEditorVideoError(null);
                                setSegmentAiPhotoModalTab("photo_animation");
                              },
                            })}
                          </div>
                        </section>

                        <section className="studio-ai-photo-modal__tool-group" aria-labelledby="segment-visual-group-edit">
                          <div className="studio-ai-photo-modal__tool-group-head">
                            <strong id="segment-visual-group-edit">Редактирование сцены</strong>
                          </div>
                          <div className="studio-ai-photo-modal__source-switcher" aria-label="Редактирование сцены">
                            {renderSegmentAiPhotoModalSourceButton({
                              title: "Дорисовать фото",
                              description: "Изменить фото",
                              isActive: segmentAiPhotoModalTab === "image_edit",
                              disabled: !canEditSegmentImage,
                              buttonTitle: !canEditSegmentImage ? segmentPhotoToolUnavailableReason : "Изменить фото",
                              footer: canEditSegmentImage ? (
                                segmentAiPhotoModalImageEditStatus ? (
                                  <span className={`studio-ai-photo-modal__source-status is-${segmentAiPhotoModalImageEditStatus.tone}`}>
                                    <span className="studio-ai-photo-modal__source-status-dot" aria-hidden="true"></span>
                                    {segmentAiPhotoModalImageEditStatus.label}
                                  </span>
                                ) : null
                              ) : null,
                              onClick: () => {
                                setSegmentEditorVideoError(null);
                                setSegmentAiPhotoModalTab("image_edit");
                              },
                            })}
                            {renderSegmentAiPhotoModalSourceButton({
                              title: "Улучшить качество",
                              description: "Апскейл выбранного фото",
                              isActive: segmentAiPhotoModalTab === "image_upscale",
                              disabled: !canUpscaleSegmentImage,
                              buttonTitle: !canUpscaleSegmentImage
                                ? segmentPhotoToolUnavailableReason
                                : "Улучшить качество выбранного фото",
                              footer: canUpscaleSegmentImage ? (
                                segmentAiPhotoModalUpscaleStatus ? (
                                  <span className={`studio-ai-photo-modal__source-status is-${segmentAiPhotoModalUpscaleStatus.tone}`}>
                                    <span className="studio-ai-photo-modal__source-status-dot" aria-hidden="true"></span>
                                    {segmentAiPhotoModalUpscaleStatus.label}
                                  </span>
                                ) : null
                              ) : null,
                              onClick: () => {
                                setSegmentEditorVideoError(null);
                                setSegmentAiPhotoModalTab("image_upscale");
                              },
                            })}
                          </div>
                        </section>

                        <section className="studio-ai-photo-modal__tool-group" aria-labelledby="segment-visual-group-pick">
                          <div className="studio-ai-photo-modal__tool-group-head">
                            <strong id="segment-visual-group-pick">Использование готовой сцены</strong>
                          </div>
                          <div className="studio-ai-photo-modal__source-switcher" aria-label="Использование готовой сцены">
                            {renderSegmentAiPhotoModalSourceButton({
                              title: "Медиатека",
                              description: "Готовые AI-визуалы",
                              isActive: segmentAiPhotoModalTab === "library",
                              footer: segmentAiPhotoModalLibraryStatus ? (
                                <span className={`studio-ai-photo-modal__source-status is-${segmentAiPhotoModalLibraryStatus.tone}`}>
                                  <span className="studio-ai-photo-modal__source-status-dot" aria-hidden="true"></span>
                                  {segmentAiPhotoModalLibraryStatus.label}
                                </span>
                              ) : null,
                              onClick: () => {
                                setSegmentEditorVideoError(null);
                                setSegmentAiPhotoModalTab("library");
                              },
                            })}
                            {renderSegmentAiPhotoModalSourceButton({
                              title: "Свой файл",
                              description: "Фото или видео",
                              isActive: segmentAiPhotoModalTab === "upload",
                              footer: segmentAiPhotoModalUploadStatus ? (
                                <span className={`studio-ai-photo-modal__source-status is-${segmentAiPhotoModalUploadStatus.tone}`}>
                                  <span className="studio-ai-photo-modal__source-status-dot" aria-hidden="true"></span>
                                  {segmentAiPhotoModalUploadStatus.label}
                                </span>
                              ) : null,
                              onClick: () => {
                                setSegmentEditorVideoError(null);
                                setSegmentAiPhotoModalTab("upload");
                              },
                            })}
                          </div>
                        </section>
                      </div>

                      {segmentAiPhotoModalTab === "ai_video" ? (
                        <div className="studio-ai-photo-modal__tab-panel">
                          <div className="studio-ai-photo-modal__tab-panel-head">
                            <strong>ИИ видео</strong>
                            <p>Короткое точное описание сцены и движения работает лучше.</p>
                          </div>

                          <div className={`studio-ai-photo-modal__prompt-field${isSegmentAiPhotoPromptHighlighted ? " is-highlighted" : ""}`}>
                            <textarea
                              ref={segmentAiPhotoModalTextareaRef}
                              className="studio-ai-photo-modal__textarea"
                              value={segmentAiVideoModalPrompt}
                              onChange={handleSegmentEditorAiVideoPromptChange}
                              onFocus={() => {
                                setSegmentEditorVideoError(null);
                                setSegmentAiPhotoModalTab("ai_video");
                              }}
                              aria-label="Промт для генерации ИИ видео"
                              rows={6}
                              placeholder="Кинематографичный крупный план астронавта в пыльной буре на Марсе, драматичный свет, плавное движение камеры"
                            />
                            <div className="studio-ai-photo-modal__field-toolbar">
                              <button
                                className="studio-ai-photo-modal__field-action"
                                type="button"
                                disabled={
                                  !canImproveSegmentAiVideoPrompt ||
                                  isSegmentAiPhotoPromptImproving ||
                                  isSegmentEditorGeneratingImageEdit ||
                                  isSegmentEditorGeneratingAiVideo ||
                                  isSegmentEditorGeneratingPhotoAnimation ||
                                  isSegmentEditorPreparingCustomVideo ||
                                  isSegmentEditorUpscalingImage
                                }
                                onClick={() => {
                                  void handleSegmentAiPhotoModalImprovePrompt();
                                }}
                              >
                                {isSegmentAiPhotoPromptImproving ? (
                                  <>
                                    <span className="studio-ai-photo-modal__action-spinner" aria-hidden="true"></span>
                                    Улучшаем...
                                  </>
                                ) : (
                                  "✨ Улучшить описание"
                                )}
                              </button>
                            </div>
                          </div>

                          {isSegmentAiPhotoPromptImproved ? (
                            <p className="studio-ai-photo-modal__field-note is-success">Описание обновлено.</p>
                          ) : null}

                          <div className="studio-ai-photo-modal__tab-actions">
                            <button
                              className="studio-ai-photo-modal__action studio-ai-photo-modal__action--primary studio-ai-photo-modal__action--paid"
                              type="button"
                              aria-label={`Сгенерировать видео за ${formatSegmentVisualCreditsLabel(STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST)}`}
                              title={`Сгенерировать видео за ${formatSegmentVisualCreditsLabel(STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST)}`}
                              disabled={
                                isSegmentEditorGeneratingImageEdit ||
                                isSegmentEditorGeneratingAiVideo ||
                                isSegmentEditorGeneratingPhotoAnimation ||
                                isSegmentEditorPreparingCustomVideo ||
                                isSegmentAiPhotoPromptImproving ||
                                isSegmentEditorUpscalingImage
                              }
                              onClick={() => {
                                handleSegmentAiPhotoModalPaidAction((snapshot) =>
                                  handleSegmentAiVideoModalGenerate({
                                    prompt: snapshot.aiVideoPrompt,
                                    segmentIndex: snapshot.segmentIndex,
                                  }),
                                );
                              }}
                            >
                              {renderSegmentPaidActionContent(
                                "Сгенерировать видео",
                                STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST,
                                isSegmentAiVideoModalGeneratingCurrentSegment,
                                "Генерируем...",
                              )}
                            </button>
                          </div>
                        </div>
                      ) : segmentAiPhotoModalTab === "photo_animation" ? (
                        <div className="studio-ai-photo-modal__tab-panel">
                          <div className="studio-ai-photo-modal__tab-panel-head">
                            <strong>ИИ анимация фото</strong>
                            <p>Добавляет движение к текущему фото сегмента.</p>
                          </div>

                          <div className={`studio-ai-photo-modal__prompt-field${isSegmentAiPhotoPromptHighlighted ? " is-highlighted" : ""}`}>
                            <textarea
                              ref={segmentAiPhotoModalTextareaRef}
                              className="studio-ai-photo-modal__textarea"
                              value={segmentAiVideoModalPrompt}
                              onChange={handleSegmentEditorPhotoAnimationPromptChange}
                              onFocus={() => {
                                setSegmentEditorVideoError(null);
                                setSegmentAiPhotoModalTab("photo_animation");
                              }}
                              aria-label="Промт для ИИ анимации фото"
                              rows={6}
                              placeholder="Плавный наезд камеры, легкое движение волос и ткани, атмосферный свет, кинематографичный параллакс"
                            />
                            <div className="studio-ai-photo-modal__field-toolbar">
                              <button
                                className="studio-ai-photo-modal__field-action"
                                type="button"
                                disabled={
                                  !canImproveSegmentAiVideoPrompt ||
                                  isSegmentAiPhotoPromptImproving ||
                                  isSegmentEditorGeneratingImageEdit ||
                                  isSegmentEditorGeneratingAiVideo ||
                                  isSegmentEditorGeneratingPhotoAnimation ||
                                  isSegmentEditorPreparingCustomVideo ||
                                  isSegmentEditorUpscalingImage
                                }
                                onClick={() => {
                                  void handleSegmentAiPhotoModalImprovePrompt();
                                }}
                              >
                                {isSegmentAiPhotoPromptImproving ? (
                                  <>
                                    <span className="studio-ai-photo-modal__action-spinner" aria-hidden="true"></span>
                                    Улучшаем...
                                  </>
                                ) : (
                                  "✨ Улучшить описание"
                                )}
                              </button>
                            </div>
                          </div>

                          {isSegmentAiPhotoPromptImproved ? (
                            <p className="studio-ai-photo-modal__field-note is-success">Описание обновлено.</p>
                          ) : null}

                          <div className="studio-ai-photo-modal__tab-actions">
                            <button
                              className="studio-ai-photo-modal__action studio-ai-photo-modal__action--primary studio-ai-photo-modal__action--paid"
                              type="button"
                              aria-label={`Анимировать фото за ${formatSegmentVisualCreditsLabel(STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST)}`}
                              title={`Анимировать фото за ${formatSegmentVisualCreditsLabel(STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST)}`}
                              disabled={
                                !canAnimateSegmentPhoto ||
                                isSegmentEditorGeneratingImageEdit ||
                                isSegmentEditorGeneratingAiVideo ||
                                isSegmentEditorGeneratingPhotoAnimation ||
                                isSegmentEditorPreparingCustomVideo ||
                                isSegmentAiPhotoPromptImproving ||
                                isSegmentEditorUpscalingImage
                              }
                              onClick={() => {
                                handleSegmentAiPhotoModalPaidAction((snapshot) =>
                                  handleSegmentPhotoAnimationModalGenerate({
                                    prompt: snapshot.aiVideoPrompt,
                                    segmentIndex: snapshot.segmentIndex,
                                  }),
                                );
                              }}
                            >
                              {renderSegmentPaidActionContent(
                                "Анимировать фото",
                                STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST,
                                isSegmentPhotoAnimationModalGeneratingCurrentSegment,
                                "Анимируем...",
                              )}
                            </button>
                          </div>
                        </div>
                      ) : segmentAiPhotoModalTab === "image_edit" ? (
                        <div className="studio-ai-photo-modal__tab-panel">
                          <div className="studio-ai-photo-modal__tab-panel-head">
                            <strong>Дорисовать фото</strong>
                            <p>Меняет текущее фото сегмента по вашему описанию.</p>
                          </div>

                          <div className={`studio-ai-photo-modal__prompt-field${isSegmentAiPhotoPromptHighlighted ? " is-highlighted" : ""}`}>
                            <textarea
                              ref={segmentAiPhotoModalTextareaRef}
                              className="studio-ai-photo-modal__textarea"
                              value={segmentImageEditModalPrompt}
                              onChange={handleSegmentEditorImageEditPromptChange}
                              onFocus={() => {
                                setSegmentEditorVideoError(null);
                                setSegmentAiPhotoModalTab("image_edit");
                              }}
                              aria-label="Промт для дорисовки фото"
                              rows={6}
                              placeholder="Сохрани композицию, замени фон на неоновый ночной Токио, добавь дождь, кинематографичный свет, фотореализм"
                            />
                            <div className="studio-ai-photo-modal__field-toolbar">
                              <button
                                className="studio-ai-photo-modal__field-action"
                                type="button"
                                disabled={
                                  !canImproveSegmentImageEditPrompt ||
                                  isSegmentAiPhotoPromptImproving ||
                                  isSegmentEditorGeneratingImageEdit ||
                                  isSegmentEditorGeneratingAiVideo ||
                                  isSegmentEditorGeneratingPhotoAnimation ||
                                  isSegmentEditorPreparingCustomVideo ||
                                  isSegmentEditorUpscalingImage
                                }
                                onClick={() => {
                                  void handleSegmentAiPhotoModalImprovePrompt();
                                }}
                              >
                                {isSegmentAiPhotoPromptImproving ? (
                                  <>
                                    <span className="studio-ai-photo-modal__action-spinner" aria-hidden="true"></span>
                                    Улучшаем...
                                  </>
                                ) : (
                                  "✨ Улучшить описание"
                                )}
                              </button>
                            </div>
                          </div>

                          {isSegmentAiPhotoPromptImproved ? (
                            <p className="studio-ai-photo-modal__field-note is-success">Описание обновлено.</p>
                          ) : null}
                          <div className="studio-ai-photo-modal__tab-actions">
                            <button
                              className="studio-ai-photo-modal__action studio-ai-photo-modal__action--primary studio-ai-photo-modal__action--paid"
                              type="button"
                              aria-label={`Дорисовать фото за ${formatSegmentVisualCreditsLabel(STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST)}`}
                              title={`Дорисовать фото за ${formatSegmentVisualCreditsLabel(STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST)}`}
                              disabled={
                                !canEditSegmentImage ||
                                isSegmentEditorGeneratingImageEdit ||
                                isSegmentEditorGeneratingAiVideo ||
                                isSegmentEditorGeneratingPhotoAnimation ||
                                isSegmentEditorPreparingCustomVideo ||
                                isSegmentAiPhotoPromptImproving ||
                                isSegmentEditorUpscalingImage
                              }
                              onClick={() => {
                                handleSegmentAiPhotoModalPaidAction((snapshot) =>
                                  handleSegmentImageEditModalGenerate({
                                    prompt: snapshot.imageEditPrompt,
                                    segmentIndex: snapshot.segmentIndex,
                                  }),
                                );
                              }}
                            >
                              {renderSegmentPaidActionContent(
                                "Дорисовать фото",
                                STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST,
                                isSegmentImageEditModalGeneratingCurrentSegment,
                                "Дорисовываем...",
                              )}
                            </button>
                          </div>
                        </div>
                      ) : segmentAiPhotoModalTab === "image_upscale" ? (
                        <div className="studio-ai-photo-modal__tab-panel">
                          <div className="studio-ai-photo-modal__tab-panel-head">
                            <strong>Улучшить качество</strong>
                            <p>Повышает детализацию и чёткость текущего фото сегмента.</p>
                          </div>

                          <div className="studio-ai-photo-modal__info-card">
                            <strong>Используем текущее фото сегмента</strong>
                            <p>После обработки фото в сегменте заменится на улучшенную версию.</p>
                          </div>

                          <div className="studio-ai-photo-modal__tab-actions">
                            <button
                              className="studio-ai-photo-modal__action studio-ai-photo-modal__action--primary studio-ai-photo-modal__action--paid"
                              type="button"
                              aria-label={`Улучшить качество за ${formatSegmentVisualCreditsLabel(STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST)}`}
                              title={`Улучшить качество за ${formatSegmentVisualCreditsLabel(STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST)}`}
                              disabled={
                                !canUpscaleSegmentImage ||
                                isSegmentEditorGeneratingAiPhoto ||
                                isSegmentEditorGeneratingImageEdit ||
                                isSegmentEditorGeneratingAiVideo ||
                                isSegmentEditorGeneratingPhotoAnimation ||
                                isSegmentEditorPreparingCustomVideo ||
                                isSegmentEditorUpscalingImage ||
                                isSegmentAiPhotoPromptImproving
                              }
                              onClick={() => {
                                handleSegmentAiPhotoModalPaidAction((snapshot) =>
                                  handleSegmentAiPhotoModalUpscaleImage({
                                    segmentIndex: snapshot.segmentIndex,
                                  }),
                                );
                              }}
                            >
                              {renderSegmentPaidActionContent(
                                "Улучшить качество",
                                STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST,
                                isSegmentImageUpscaleCurrentSegment,
                                "Улучшаем...",
                              )}
                            </button>
                          </div>
                        </div>
                      ) : segmentAiPhotoModalTab === "ai_photo" ? (
                        <div className="studio-ai-photo-modal__tab-panel">
                          <div className="studio-ai-photo-modal__tab-panel-head">
                            <strong>ИИ фото</strong>
                            <p>Короткое точное описание работает лучше.</p>
                          </div>

                          <div className={`studio-ai-photo-modal__prompt-field${isSegmentAiPhotoPromptHighlighted ? " is-highlighted" : ""}`}>
                            <textarea
                              ref={segmentAiPhotoModalTextareaRef}
                              className="studio-ai-photo-modal__textarea"
                              value={segmentAiPhotoModalPrompt}
                              onChange={handleSegmentEditorAiPhotoPromptChange}
                              onFocus={() => {
                                setSegmentEditorVideoError(null);
                                setSegmentAiPhotoModalTab("ai_photo");
                              }}
                              aria-label="Описание сцены для генерации"
                              rows={6}
                              placeholder="Скелет в пустыне находит блестящий смартфон, закат, песок, драматичный свет"
                            />
                            <div className="studio-ai-photo-modal__field-toolbar">
                              <button
                                className="studio-ai-photo-modal__field-action"
                                type="button"
                                disabled={
                                  !canImproveSegmentAiPhotoPrompt ||
                                  isSegmentAiPhotoPromptImproving ||
                                  isSegmentEditorGeneratingAiPhoto ||
                                  isSegmentEditorGeneratingImageEdit ||
                                  isSegmentEditorGeneratingAiVideo ||
                                  isSegmentEditorGeneratingPhotoAnimation ||
                                  isSegmentEditorPreparingCustomVideo ||
                                  isSegmentEditorUpscalingImage
                                }
                                onClick={() => {
                                  void handleSegmentAiPhotoModalImprovePrompt();
                                }}
                              >
                                {isSegmentAiPhotoPromptImproving ? (
                                  <>
                                    <span className="studio-ai-photo-modal__action-spinner" aria-hidden="true"></span>
                                    Улучшаем...
                                  </>
                                ) : (
                                  "✨ Улучшить описание"
                                )}
                              </button>
                            </div>
                          </div>

                          {isSegmentAiPhotoPromptImproved ? (
                            <p className="studio-ai-photo-modal__field-note is-success">Описание обновлено.</p>
                          ) : null}

                          <div className="studio-ai-photo-modal__tab-actions">
                            <button
                              className="studio-ai-photo-modal__action studio-ai-photo-modal__action--primary studio-ai-photo-modal__action--paid"
                              type="button"
                              aria-label={`Сгенерировать ИИ фото за ${formatSegmentVisualCreditsLabel(STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST)}`}
                              title={`Сгенерировать ИИ фото за ${formatSegmentVisualCreditsLabel(STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST)}`}
                              disabled={
                                isSegmentEditorGeneratingAiPhoto ||
                                isSegmentEditorGeneratingImageEdit ||
                                isSegmentEditorGeneratingAiVideo ||
                                isSegmentEditorGeneratingPhotoAnimation ||
                                isSegmentEditorPreparingCustomVideo ||
                                isSegmentAiPhotoPromptImproving ||
                                isSegmentEditorUpscalingImage
                              }
                              onClick={() => {
                                handleSegmentAiPhotoModalPaidAction((snapshot) =>
                                  handleSegmentAiPhotoModalGenerateScene({
                                    prompt: snapshot.aiPhotoPrompt,
                                    segmentIndex: snapshot.segmentIndex,
                                  }),
                                );
                              }}
                            >
                              {renderSegmentPaidActionContent(
                                "Сгенерировать ИИ фото",
                                STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST,
                                isSegmentAiPhotoModalGeneratingCurrentSegment,
                                "Генерируем...",
                              )}
                            </button>
                          </div>
                        </div>
                      ) : segmentAiPhotoModalTab === "library" ? (
                        <div className="studio-ai-photo-modal__tab-panel">
                          <div className="studio-ai-photo-modal__tab-panel-head">
                            <strong>Медиатека</strong>
                          </div>

                          {segmentAiPhotoModalLibraryItems.length > 0 ? (
                            <div className="studio-media-library__pills" aria-label="Фильтр медиатеки">
                              <button
                                className={`studio-media-library__pill${segmentAiPhotoModalLibraryFilter === "all" ? " is-active" : ""}`}
                                type="button"
                                aria-pressed={segmentAiPhotoModalLibraryFilter === "all"}
                                onClick={() => setSegmentAiPhotoModalLibraryFilter("all")}
                              >
                                Все
                              </button>
                              <button
                                className={`studio-media-library__pill${segmentAiPhotoModalLibraryFilter === "photo" ? " is-active" : ""}`}
                                type="button"
                                aria-pressed={segmentAiPhotoModalLibraryFilter === "photo"}
                                onClick={() =>
                                  setSegmentAiPhotoModalLibraryFilter((current) => (current === "photo" ? "all" : "photo"))
                                }
                              >
                                ИИ фото
                              </button>
                              <button
                                className={`studio-media-library__pill${segmentAiPhotoModalLibraryFilter === "video" ? " is-active" : ""}`}
                                type="button"
                                aria-pressed={segmentAiPhotoModalLibraryFilter === "video"}
                                onClick={() =>
                                  setSegmentAiPhotoModalLibraryFilter((current) => (current === "video" ? "all" : "video"))
                                }
                              >
                                ИИ видео
                              </button>
                            </div>
                          ) : null}

                          <div className="studio-ai-photo-modal__library-body">
                            {!shouldRenderSegmentAiPhotoModalLibraryGrid && segmentAiPhotoModalLibraryItems.length > 0 ? (
                              <div className="studio-ai-photo-modal__library-state" role="status" aria-live="polite">
                                <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                                <div className="studio-ai-photo-modal__library-state-copy">
                                  <strong>Открываем медиатеку</strong>
                                  <p>Подготавливаем превью.</p>
                                </div>
                              </div>
                            ) : isMediaLibraryLoading && segmentAiPhotoModalLibraryItems.length === 0 ? (
                              <div className="studio-ai-photo-modal__library-state" role="status" aria-live="polite">
                                <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                                <div className="studio-ai-photo-modal__library-state-copy">
                                  <strong>Загружаем медиатеку</strong>
                                  <p>Собираем AI-визуалы.</p>
                                </div>
                              </div>
                            ) : mediaLibraryError && segmentAiPhotoModalLibraryItems.length === 0 ? (
                              <div className="studio-ai-photo-modal__library-state studio-ai-photo-modal__library-state--error" role="alert">
                                <div className="studio-ai-photo-modal__library-state-copy">
                                  <strong>Не удалось загрузить медиатеку</strong>
                                  <p>{mediaLibraryError}</p>
                                </div>
                                <button
                                  className="studio-ai-photo-modal__library-state-action"
                                  type="button"
                                  onClick={() => setMediaLibraryReloadToken((current) => current + 1)}
                                >
                                  Повторить
                                </button>
                              </div>
                            ) : isMediaLibraryResolvingVisibleItems ? (
                              <div className="studio-ai-photo-modal__library-state" role="status" aria-live="polite">
                                <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                                <div className="studio-ai-photo-modal__library-state-copy">
                                  <strong>Загружаем медиатеку</strong>
                                  <p>Подбираем доступные AI-визуалы.</p>
                                </div>
                              </div>
                            ) : segmentAiPhotoModalLibraryItems.length === 0 ? (
                              <div className="studio-ai-photo-modal__library-state">
                                <div className="studio-ai-photo-modal__library-state-copy">
                                  <strong>Медиатека пока пуста</strong>
                                  <p>Сначала сохраните хотя бы один AI-визуал.</p>
                                </div>
                              </div>
                            ) : filteredSegmentAiPhotoModalLibraryItems.length === 0 ? (
                              <div className="studio-ai-photo-modal__library-state">
                                <div className="studio-ai-photo-modal__library-state-copy">
                                  <strong>{segmentAiPhotoModalLibraryFilter === "photo" ? "Нет ИИ фото" : "Нет ИИ видео"}</strong>
                                  <p>
                                    {segmentAiPhotoModalLibraryFilter === "photo"
                                      ? "В медиатеке сейчас нет доступных фото для этого фильтра."
                                      : "В медиатеке сейчас нет доступных видео для этого фильтра."}
                                  </p>
                                </div>
                                <button
                                  className="studio-ai-photo-modal__library-state-action"
                                  type="button"
                                  onClick={() => setSegmentAiPhotoModalLibraryFilter("all")}
                                >
                                  Сбросить фильтр
                                </button>
                              </div>
                            ) : (
                              <div className="studio-ai-photo-modal__library-grid">
                                {visibleSegmentAiPhotoModalLibraryItems.map((item) => {
                                const itemKey = getWorkspaceMediaLibraryItemStorageKey(item);
                                const rawItemKindLabel = getWorkspaceMediaLibraryItemKindLabel(item.kind, item.assetKind);
                                const itemKindLabel = rawItemKindLabel;
                                const isSelectedLibraryItem = itemKey === segmentAiPhotoModalSelectedLibraryItemKey;
                                const mediaLibrarySurface = getWorkspaceMediaLibraryResolvedMediaSurface(
                                  item,
                                  "segment-modal-library-tile",
                                );

                                return (
                                  <button
                                    key={`segment-modal-library:${itemKey}`}
                                    className={`studio-ai-photo-modal__library-card${
                                      item.previewKind === "video"
                                        ? " studio-ai-photo-modal__library-card--video"
                                        : " studio-ai-photo-modal__library-card--photo"
                                    }${isSelectedLibraryItem ? " is-selected" : ""}`}
                                    type="button"
                                    aria-label={`Выбрать ${itemKindLabel} из медиатеки`}
                                    disabled={isSegmentEditorStructureActionBusy}
                                    onClick={() => {
                                      setSegmentEditorVideoError(null);
                                      setSegmentAiPhotoModalTab("library");
                                      const isApplied = handleSegmentEditorMediaLibrarySelect(item, {
                                        segmentIndex: segmentAiPhotoModalSegment.index,
                                      });
                                      if (isApplied) {
                                        closeSegmentAiPhotoModal();
                                      }
                                    }}
                                  >
                                    <span className="studio-ai-photo-modal__library-media">
                                      {renderWorkspaceMediaLibraryPlayOverlay(item.previewKind)}
                                      <WorkspaceSegmentPreviewCardMedia
                                        autoplay={false}
                                        imageLoading="lazy"
                                        mediaKey={`segment-modal-library:${itemKey}:${mediaLibrarySurface.displayUrl}:${mediaLibrarySurface.posterUrl ?? "no-poster"}`}
                                        mountVideoWhenIdle={mediaLibrarySurface.mountVideoWhenIdle}
                                        muted
                                        posterUrl={mediaLibrarySurface.posterUrl}
                                        preferPosterFrame={mediaLibrarySurface.preferPosterFrame}
                                        preload={item.previewKind === "video" ? mediaLibrarySurface.preloadPolicy : undefined}
                                        primePausedFrame={mediaLibrarySurface.primePausedFrame}
                                        previewKind={mediaLibrarySurface.previewKind}
                                        previewUrl={mediaLibrarySurface.displayUrl ?? item.previewUrl}
                                      />
                                    </span>
                                  </button>
                                );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="studio-ai-photo-modal__tab-panel">
                          <div className="studio-ai-photo-modal__tab-panel-head">
                            <strong>Свой файл</strong>
                            <p>JPG, PNG, WEBP, AVIF, MP4, MOV, WEBM, M4V.</p>
                          </div>

                          <div className={`studio-ai-photo-modal__upload-card${segmentAiPhotoModalCustomFileLabel ? " is-active" : ""}`}>
                            <div className="studio-ai-photo-modal__upload-copy">
                              <strong>{segmentAiPhotoModalCustomFileLabel ?? "Файл не выбран"}</strong>
                              <span>
                                {segmentAiPhotoModalCustomFileLabel ? "Файл готов к применению." : "Загрузите фото или видео для сегмента."}
                              </span>
                            </div>

                            <button
                              className={`studio-ai-photo-modal__upload-btn${segmentAiPhotoModalCustomFileName ? " is-active" : ""}`}
                              type="button"
                              title={segmentAiPhotoModalCustomFileName || "Загрузить файл"}
                              disabled={
                                isSegmentEditorPreparingCustomVideo ||
                                isSegmentEditorGeneratingAiPhoto ||
                                isSegmentEditorGeneratingImageEdit ||
                                isSegmentEditorGeneratingAiVideo ||
                                isSegmentEditorGeneratingPhotoAnimation ||
                                isSegmentEditorUpscalingImage
                              }
                              onClick={() => {
                                setSegmentEditorVideoError(null);
                                setSegmentAiPhotoModalTab("upload");
                                segmentAiPhotoModalFileInputRef.current?.click();
                              }}
                            >
                              {isSegmentEditorPreparingCustomVideo
                                ? "Загрузка..."
                                : segmentAiPhotoModalCustomFileName
                                  ? "Заменить файл"
                                  : "Загрузить файл"}
                            </button>
                          </div>
                        </div>
                      )}
                      {segmentEditorVideoError ? <p className="studio-ai-photo-modal__error">{segmentEditorVideoError}</p> : null}
                    </section>
                  </div>
                </form>
              </div>,
              document.body,
            )
          : null}
        {mediaLibraryPreviewModal ? (
          <div
            className="studio-video-modal is-open"
            role="dialog"
            aria-modal="true"
            aria-label="Просмотр медиа из медиатеки"
          >
            <button
              className="studio-video-modal__backdrop route-close"
              type="button"
              aria-label="Закрыть просмотр визуала"
              onClick={closePreviewModals}
            />
            <div className="studio-video-modal__panel studio-video-modal__panel--video-only" role="document">
              <button className="studio-video-modal__close route-close" type="button" aria-label="Закрыть просмотр визуала" onClick={closePreviewModals}>
                ×
              </button>
              <div className="studio-video-modal__layout studio-video-modal__layout--video-only">
                <div className="studio-video-modal__player-slot">
                  {mediaLibraryPreviewModalSurface?.previewKind === "image" ? (
                    <div className="studio-video-modal__player is-image is-cover-media">
                      <img
                        src={mediaLibraryPreviewModalSurface.displayUrl ?? mediaLibraryPreviewModal.previewUrl}
                        alt={mediaLibraryPreviewModalTitle}
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <WorkspaceModalVideoPlayer
                      autoPlay
                      fitMode="cover"
                      poster={mediaLibraryPreviewModalSurface?.posterUrl ?? mediaLibraryPreviewModalPosterUrl ?? undefined}
                      preload={mediaLibraryPreviewModalSurface?.preloadPolicy ?? "auto"}
                      preferMutedAutoplay={mediaLibraryPreviewModalSurface?.preferMutedAutoplay ?? true}
                      src={mediaLibraryPreviewModalSurface?.viewerUrl ?? mediaLibraryPreviewModal.previewUrl}
                      topActions={
                        <a
                          className="studio-video-modal__top-action"
                          href={mediaLibraryPreviewModal.downloadUrl ?? mediaLibraryPreviewModal.previewUrl}
                          download={mediaLibraryPreviewModal.downloadName}
                          aria-label="Скачать визуал"
                          title="Скачать визуал"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
                              stroke="currentColor"
                              strokeWidth="1.9"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </a>
                      }
                      videoKey={`media-library-preview:${mediaLibraryPreviewModal.itemKey}:${mediaLibraryPreviewModalSurface?.viewerUrl ?? mediaLibraryPreviewModal.previewUrl}`}
                      videoRef={(element) => {
                        mediaLibraryPreviewVideoRef.current = element;
                      }}
                      volume={studioPreviewVolume}
                      onVolumeChange={setStudioPreviewVolume}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {previewModalVideoPlaybackUrl ? (
          <div
            className={`studio-video-modal${isAnyPreviewModalOpen ? " is-open" : ""}`}
            role="dialog"
            aria-hidden={!isAnyPreviewModalOpen}
            aria-modal={isAnyPreviewModalOpen ? "true" : undefined}
            aria-labelledby={isProjectPreviewModalOpen ? undefined : "studio-video-modal-title"}
            aria-label={isProjectPreviewModalOpen ? "Просмотр видео проекта" : undefined}
          >
            <button
              className="studio-video-modal__backdrop route-close"
              type="button"
              aria-label="Закрыть превью"
              onClick={closePreviewModals}
            />
            <div
              className={`studio-video-modal__panel${isProjectPreviewModalOpen ? " studio-video-modal__panel--video-only" : ""}`}
              role="document"
              style={projectPreviewModalPanelStyle}
            >
              <button className="studio-video-modal__close route-close" type="button" aria-label="Закрыть превью" onClick={closePreviewModals}>
                ×
              </button>
              <div className={`studio-video-modal__layout${isProjectPreviewModalOpen ? " studio-video-modal__layout--video-only" : ""}`}>
                <div className="studio-video-modal__player-slot">
                  <WorkspaceModalVideoPlayer
                    autoPlay={isAnyPreviewModalOpen}
                    errorOverlay={
                      previewModalPlaybackError ? (
                        <div className="studio-video-modal__error" role="alert">
                          <p>{previewModalPlaybackError}</p>
                          <div className="studio-video-modal__error-actions">
                            <button className="studio-video-modal__error-btn" type="button" onClick={handleRetryPreviewModalPlayback}>
                              Повторить
                            </button>
                            <a
                              className="studio-video-modal__error-btn"
                              href={previewModalVideoPlaybackUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Открыть напрямую
                            </a>
                          </div>
                        </div>
                      ) : null
                    }
                    onCanPlay={handlePreviewModalVideoCanPlay}
                    onError={handlePreviewModalVideoError}
                    onLoadedData={handlePreviewModalVideoLoadedData}
                    onLoadedMetadata={handlePreviewModalVideoLoadedMetadata}
                    onPlay={handlePreviewModalVideoPlay}
                    preload="metadata"
                    src={previewModalVideoPlaybackUrl}
                    topActions={
                      isProjectPreviewModalOpen ? null : (
                        <a
                          className="studio-video-modal__top-action"
                          href={previewModalVideoPlaybackUrl}
                          download={previewModalDownloadName}
                          aria-label="Скачать видео"
                          title="Скачать видео"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
                              stroke="currentColor"
                              strokeWidth="1.9"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </a>
                      )
                    }
                    videoKey={`${isProjectPreviewModalOpen ? projectPreviewModal?.id ?? "project" : generatedVideo?.id ?? "generated"}-${previewModalSourceKey}-${previewModalOpenToken || previewModalUpdatedAt || "modal"}`}
                    videoRef={handlePreviewModalVideoRef}
                    volume={studioPreviewVolume}
                    onVolumeChange={setStudioPreviewVolume}
                  />
                </div>

                {isProjectPreviewModalOpen ? null : (
                <div className="studio-video-modal__sidebar">
                  <div className="studio-video-modal__section studio-video-modal__section--hero">
                    <div className="studio-video-modal__title-block">
                      <p className="studio-video-modal__eyebrow">Готово к публикации</p>
                      <strong id="studio-video-modal-title">{previewModalTitle}</strong>
                    </div>
                    {previewModalStatusLink ? (
                      <a
                        className={`studio-video-modal__header-status is-clickable is-${previewModalStatusTone}`}
                        href={previewModalStatusLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span className="studio-video-modal__header-status-label">{previewModalStatusLabel}</span>
                        <small>{previewModalStatusMeta}</small>
                      </a>
                    ) : (
                      <div className={`studio-video-modal__header-status is-${previewModalStatusTone}`}>
                        <span className="studio-video-modal__header-status-label">{previewModalStatusLabel}</span>
                        <small>{previewModalStatusMeta}</small>
                      </div>
                    )}
                  </div>

                  <div className="studio-video-modal__section">
                    <div className="studio-video-modal__meta">
                      <span className="studio-video-modal__label">Тема</span>
                      <p className="studio-video-modal__description">{previewModalTopic || "Без темы"}</p>
                    </div>
                    <div className="studio-video-modal__meta">
                      <span className="studio-video-modal__label">Заголовок</span>
                      <p className="studio-video-modal__description">{previewModalTitle}</p>
                    </div>
                    {hasPreviewModalDescription ? (
                      <div className="studio-video-modal__meta">
                        <span className="studio-video-modal__label">Описание</span>
                        <p className="studio-video-modal__description">{previewModalDescription}</p>
                      </div>
                    ) : null}
                    <div className="studio-video-modal__meta">
                      <span className="studio-video-modal__label">Хэштеги</span>
                      {hasPreviewModalHashtags ? (
                        <div className="studio-video-modal__hashtags" aria-label="Хэштеги">
                          {previewModalHashtags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="studio-video-modal__description studio-video-modal__description--subtle">
                          Хэштеги не добавлены
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="studio-video-modal__actions" aria-label="Действия с видео">
                        <button className="studio-video-modal__action studio-video-modal__action--primary route-button" type="button" onClick={() => void handlePublishPreview()}>
                          Опубликовать
                        </button>
                        <button className="studio-video-modal__action route-button" type="button" onClick={() => void handleRegeneratePreview()}>
                          Перегенерировать
                        </button>
                  </div>
                </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
        {isPublishModalOpen ? (
          <div className="studio-publish-modal" role="dialog" aria-modal="true" aria-labelledby="studio-publish-modal-title">
            <button className="studio-publish-modal__backdrop route-close" type="button" aria-label="Закрыть публикацию" onClick={closePublishModal} />
            <div className="studio-publish-modal__panel" role="document">
              <button className="studio-publish-modal__close route-close" type="button" aria-label="Закрыть публикацию" onClick={closePublishModal}>
                ×
              </button>

              <div className="studio-publish-modal__header">
                <div className="studio-publish-modal__header-copy">
                  <p className="studio-publish-modal__eyebrow">Публикация в YouTube</p>
                  <strong id="studio-publish-modal-title">{publishTargetTitle || "Готово к публикации"}</strong>
                </div>
              </div>

              {isPublishBootstrapLoading && !publishBootstrap ? (
                <div className="studio-publish-modal__loading">
                  <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                  <p>Загружаем настройки публикации...</p>
                </div>
              ) : publishBootstrapError && !publishBootstrap ? (
                <div className="studio-publish-modal__error">
                  <strong>Не удалось открыть публикацию</strong>
                  <p>{publishBootstrapError}</p>
                </div>
              ) : (
                <>
                  <div className="studio-publish-modal__body">
                    <div className="studio-publish-modal__main">
                      {publishError ? (
                        <div className="studio-publish-modal__inline-state is-error">
                          <div>
                            <strong>Ошибка публикации</strong>
                            <p>{publishError}</p>
                          </div>
                        </div>
                      ) : null}
                      <section className="studio-publish-modal__section">
                        <div className="studio-publish-modal__section-head">
                          <div>
                            <span className="studio-publish-modal__section-kicker">Канал</span>
                          </div>
                          <div className="studio-publish-modal__section-tools">
                            {selectedPublishChannel ? (
                              <button
                                className="studio-publish-modal__utility-btn studio-publish-modal__utility-btn--icon"
                                type="button"
                                disabled={isDisconnectingPublishChannel || isPublishInFlight}
                                aria-label="Отключить канал"
                                title="Отключить канал"
                                onClick={() => void handleDisconnectPublishChannel()}
                              >
                                {isDisconnectingPublishChannel ? "…" : "−"}
                              </button>
                            ) : null}
                            {publishChannels.length ? (
                              <button
                                className="studio-publish-modal__utility-btn studio-publish-modal__utility-btn--icon"
                                type="button"
                                disabled={isDisconnectingPublishChannel || isPublishInFlight}
                                aria-label="Подключить ещё канал"
                                title="Подключить ещё канал"
                                onClick={() => void handleStartYouTubeConnect()}
                              >
                                +
                              </button>
                            ) : null}
                          </div>
                        </div>

                          {publishChannels.length ? (
                          <div className="studio-publish-modal__channel-grid" role="radiogroup" aria-label="Канал YouTube">
                            {publishChannels.map((channel) => {
                              const isSelected = channel.pk === selectedPublishChannelPk;

                              return (
                                <button
                                  key={channel.pk}
                                  className={`studio-publish-modal__channel-card${isSelected ? " is-selected" : ""}`}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  onClick={() => setSelectedPublishChannelPk(channel.pk)}
                                >
                                  <span className="studio-publish-modal__channel-avatar" aria-hidden="true">
                                    {channel.channelName.trim().slice(0, 1).toUpperCase() || "Y"}
                                  </span>
                                  <span className="studio-publish-modal__channel-copy">
                                    <strong>{channel.channelName}</strong>
                                  </span>
                                  <span className="studio-publish-modal__channel-indicator" aria-hidden="true" />
                                </button>
                              );
                            })}
                          </div>
                        ) : isPublishBootstrapLoading ? (
                          <div className="studio-publish-modal__inline-state">
                            <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                            <div>
                              <strong>Синхронизируем каналы</strong>
                              <p>Окно уже готово, список подключённых YouTube-каналов подтягивается фоном.</p>
                            </div>
                          </div>
                        ) : publishBootstrapError ? (
                          <div className="studio-publish-modal__inline-state is-error">
                            <div>
                              <strong>Не удалось получить каналы</strong>
                              <p>{publishBootstrapError}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="studio-publish-modal__empty-state">
                            <div className="studio-publish-modal__empty-icon" aria-hidden="true">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <path d="M8 6h8m-8 6h8m-8 6h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                <path d="M19 8v8M15 12h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                              </svg>
                            </div>
                            <div className="studio-publish-modal__empty-copy">
                              <strong>Канал ещё не подключён</strong>
                              <p>Подключите YouTube-канал и публикуйте Shorts прямо из студии.</p>
                            </div>
                            <button className="studio-publish-modal__primary-btn" type="button" onClick={() => void handleStartYouTubeConnect()}>
                              Подключить YouTube
                            </button>
                          </div>
                        )}
                      </section>

                      <section className="studio-publish-modal__section">
                        <div className="studio-publish-modal__section-head">
                          <div>
                            <span className="studio-publish-modal__section-kicker">НАСТРОЙКИ ПУБЛИКАЦИИ</span>
                          </div>
                        </div>

                        <div className="studio-publish-modal__field-grid">
                          <label className="studio-publish-modal__field studio-publish-modal__field--full" htmlFor={publishTitleFieldId}>
                            <span className="studio-publish-modal__field-label">
                              <span>Заголовок</span>
                              <small>{publishTitle.length}/100</small>
                            </span>
                            <input
                              id={publishTitleFieldId}
                              value={publishTitle}
                              onChange={(event) => setPublishTitle(event.target.value)}
                              maxLength={100}
                              placeholder="Например: 3 секрета viral Shorts"
                            />
                          </label>

                          <label className="studio-publish-modal__field studio-publish-modal__field--full" htmlFor={publishDescriptionFieldId}>
                            <span className="studio-publish-modal__field-label">
                              <span>Описание</span>
                              <small>{publishDescription.length}/5000</small>
                            </span>
                            <textarea
                              id={publishDescriptionFieldId}
                              value={publishDescription}
                              onChange={(event) => setPublishDescription(event.target.value)}
                              rows={5}
                              maxLength={5000}
                              placeholder="Добавьте описание ролика, CTA и полезный контекст."
                            />
                          </label>

                          <label className="studio-publish-modal__field studio-publish-modal__field--full" htmlFor={publishHashtagsFieldId}>
                            <span className="studio-publish-modal__field-label">
                              <span>Хэштеги</span>
                            </span>
                            <input
                              id={publishHashtagsFieldId}
                              value={publishHashtags}
                              onChange={(event) => setPublishHashtags(event.target.value)}
                              placeholder="#shorts #adsflow"
                            />
                          </label>
                        </div>
                      </section>

                      <section className="studio-publish-modal__section">
                        <div className="studio-publish-modal__section-head">
                          <div>
                            <span className="studio-publish-modal__section-kicker">Планирование</span>
                          </div>
                        </div>

                        <div className="studio-publish-modal__mode-grid">
                          <button
                            className={`studio-publish-modal__mode-card${publishMode === "now" ? " is-active" : ""}`}
                            type="button"
                            onClick={() => handlePublishModeChange("now")}
                          >
                            <span>Сразу</span>
                            <strong>Опубликовать сейчас</strong>
                            <p>Shorts уйдёт в канал сразу после подтверждения.</p>
                          </button>
                          <button
                            className={`studio-publish-modal__mode-card${publishMode === "schedule" ? " is-active" : ""}`}
                            type="button"
                            onClick={() => handlePublishModeChange("schedule")}
                          >
                            <span>По расписанию</span>
                            <strong>Запланировать публикацию</strong>
                            <p>Выберите день и точное время выхода в ленту.</p>
                          </button>
                        </div>

                        {publishMode === "schedule" ? (
                          <>
                            <div className="studio-publish-modal__schedule-inline">
                              <div className="studio-publish-modal__schedule-preview">
                                <span>Дата и время</span>
                                <strong>{publishScheduleSummary}</strong>
                              </div>
                              <button
                                ref={publishPlannerTriggerRef}
                                className={`studio-publish-modal__planner-toggle${isPublishPlannerOpen ? " is-open" : ""}`}
                                type="button"
                                aria-haspopup="dialog"
                                aria-expanded={isPublishPlannerOpen}
                                aria-controls={publishPlannerPopoverId}
                                onClick={() => setIsPublishPlannerOpen((open) => !open)}
                              >
                                <span>{isPublishPlannerOpen ? "Скрыть календарь" : "Открыть календарь"}</span>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                  <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </div>

                            {isPublishPlannerOpen && publishPlannerStyle && typeof document !== "undefined"
                              ? createPortal(
                                  <div
                                    ref={publishPlannerPopoverRef}
                                    className="studio-publish-modal__planner-popover"
                                    id={publishPlannerPopoverId}
                                    role="dialog"
                                    aria-label="Календарь публикации"
                                    style={publishPlannerStyle}
                                  >
                                    <div className="studio-publish-modal__planner-popover-grid">
                                      <div className="studio-publish-modal__calendar-card">
                                        <div className="studio-publish-modal__calendar-toolbar">
                                          <button
                                            className="studio-publish-modal__calendar-nav"
                                            type="button"
                                            aria-label="Предыдущий месяц"
                                            onClick={() => setPublishCalendarMonth((currentMonth) => shiftPublishMonth(currentMonth, -1))}
                                          >
                                            ‹
                                          </button>
                                          <strong>{formatPublishCalendarMonth(publishCalendarMonth)}</strong>
                                          <button
                                            className="studio-publish-modal__calendar-nav"
                                            type="button"
                                            aria-label="Следующий месяц"
                                            onClick={() => setPublishCalendarMonth((currentMonth) => shiftPublishMonth(currentMonth, 1))}
                                          >
                                            ›
                                          </button>
                                        </div>

                                        <div className="studio-publish-modal__calendar-weekdays" aria-hidden="true">
                                          {publishCalendarWeekdayLabels.map((weekday) => (
                                            <span key={weekday}>{weekday}</span>
                                          ))}
                                        </div>

                                        <div className="studio-publish-modal__calendar-grid">
                                          {publishCalendarDays.map((day) => {
                                            const isSelected = isSamePublishDay(day.date, publishScheduledDate);

                                            return (
                                              <button
                                                key={day.date.toISOString()}
                                                className={`studio-publish-modal__calendar-day${day.isCurrentMonth ? "" : " is-outside"}${day.isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}`}
                                                type="button"
                                                disabled={day.isPast}
                                                onClick={() => handlePublishCalendarDaySelect(day.date)}
                                              >
                                                <span>{day.date.getDate()}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      <div className="studio-publish-modal__time-card">
                                        <label className="studio-publish-modal__field studio-publish-modal__field--time" htmlFor={publishTimeFieldId}>
                                          <span className="studio-publish-modal__field-label">
                                            <span>Время публикации</span>
                                          </span>
                                          <input
                                            aria-label="Время публикации"
                                            id={publishTimeFieldId}
                                            type="time"
                                            step={300}
                                            value={publishTimeValue}
                                            onChange={(event) => handlePublishTimeSelect(event.target.value)}
                                          />
                                        </label>

                                        <button className="studio-publish-modal__utility-btn" type="button" onClick={() => setIsPublishPlannerOpen(false)}>
                                          Готово
                                        </button>
                                      </div>
                                    </div>
                                  </div>,
                                  document.body,
                                )
                              : null}
                          </>
                        ) : null}
                      </section>
                    </div>

                  </div>

                  <div className="studio-publish-modal__footer">
                    <div className="studio-publish-modal__actions">
                      <button className="studio-publish-modal__secondary-btn" type="button" onClick={closePublishModal}>
                        Отмена
                      </button>
                      <button
                        className="studio-publish-modal__primary-btn"
                        type="button"
                        disabled={!publishCanSubmit || !publishChannels.length}
                        onClick={() => void handleSubmitPublish()}
                      >
                        {isPublishInFlight ? "Публикуем..." : publishPrimaryActionLabel}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
      <div className="route-page workspace-route" hidden={isStudioRouteVisible}>
      <header className="site-header site-header--workspace">
        <div className="container site-header__inner">
          <Link className="brand" to="/" aria-label="AdShorts AI">
            <img src="/logo.png" alt="" width="44" height="44" />
            <span>AdShorts AI</span>
          </Link>

          <PrimarySiteNav
            activeItem={null}
            onOpenStudio={() => setActiveTab("studio")}
            onOpenStudioSection={handleStudioTopMenuSelect}
            projectsCount={projects.length}
          />

          <div className="site-header__actions">
            <SiteHeaderWorkspaceStatus profile={workspaceProfile} />
            <a
              className="site-header__link"
              href="https://t.me/AdShortsAIBot"
              target="_blank"
              rel="noopener noreferrer"
            >
              Telegram
            </a>
            <AccountMenuButton email={session.email} name={session.name} onLogout={handleAccountLogout} plan={workspacePlanLabel} />
          </div>
        </div>
      </header>

      <main className="workspace-route__main">
        <div className="workspace-route__scene" aria-hidden="true">
          <span className="hero__scene-stars"></span>
          <span className="hero__scene-glow hero__scene-glow--center"></span>
        </div>

        <section
          className="account-shell--page workspace-route__shell"
          aria-labelledby={sectionTitleId}
          aria-label={sectionTitleId ? undefined : header.eyebrow}
        >
          <div className="account-shell__frame">
        <aside className="account-shell__sidebar">
          <div className="account-user account-user--summary">
            <div className="account-user__summary-row">
              <span>Тариф</span>
              <strong>{workspacePlanLabel}</strong>
            </div>
            <div className="account-user__summary-row">
              <span>Баланс</span>
              <strong>{workspaceBalance === null ? "…" : `${workspaceBalance} credits`}</strong>
            </div>
          </div>

          <nav className="account-nav" aria-label="Личный кабинет">
            <button
              className={`account-nav__item${activeTab === "overview" ? " is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("overview")}
            >
              <strong>Обзор</strong>
              <span>Метрики и активность</span>
            </button>
            <button
              className="account-nav__item"
              type="button"
              onClick={() => setActiveTab("studio")}
            >
              <strong>Студия</strong>
              <span>Создание Shorts</span>
            </button>
            <button
              className={`account-nav__item${activeTab === "generations" ? " is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("generations")}
            >
              <strong>Проекты</strong>
              <span>Все созданные Shorts</span>
            </button>
            <button
              className={`account-nav__item${activeTab === "billing" ? " is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("billing")}
            >
              <strong>Billing</strong>
              <span>Тариф, кредиты и пополнение</span>
            </button>
            <button
              className={`account-nav__item${activeTab === "settings" ? " is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("settings")}
            >
              <strong>Настройки</strong>
              <span>Профиль и интеграции</span>
            </button>
          </nav>

        </aside>

        <div className="account-shell__content">
          <div className="account-shell__topbar">
            <div className="account-shell__topbar-copy">
              <p className="account-shell__eyebrow">{header.eyebrow}</p>
              {header.heading ? <h2 id="account-shell-title">{header.heading}</h2> : null}
              {header.subtitle ? <p className="account-shell__subtitle">{header.subtitle}</p> : null}
            </div>
          </div>

          <div className="account-shell__body">
            {activeTab === "overview" && (
              <section className="account-panel is-active" data-account-panel="overview">
                <div className="account-stats">
                  <article className="account-stat">
                    <span>Кредиты</span>
                    <strong>184</strong>
                  </article>
                  <article className="account-stat">
                    <span>Экспортов в марте</span>
                    <strong>126</strong>
                  </article>
                  <article className="account-stat">
                    <span>Подключенные каналы</span>
                    <strong>2</strong>
                  </article>
                </div>

                <div className="account-layout">
                  <div className="account-stack">
                    <article className="account-card">
                      <div className="account-card__head">
                        <div>
                          <h3>Публикация</h3>
                          <p>Текущая готовность каналов и автопостинга.</p>
                        </div>
                      </div>

                      <div className="account-checklist">
                        <div className="account-checklist__item">
                          <span>YouTube Shorts</span>
                          <strong>Connected</strong>
                        </div>
                        <div className="account-checklist__item">
                          <span>TikTok</span>
                          <strong>Connected</strong>
                        </div>
                        <div className="account-checklist__item">
                          <span>Instagram Reels</span>
                          <strong>Needs OAuth</strong>
                        </div>
                      </div>
                    </article>

                    <article className="account-card">
                      <div className="account-card__head">
                        <div>
                          <h3>План и usage</h3>
                          <p>Текущий тариф и расход на команду.</p>
                        </div>
                        <span className="account-pill">Growth</span>
                      </div>

                      <div className="account-usage">
                        <div className="account-usage__meta">
                          <span>642 / 1000 credits used</span>
                          <strong>64%</strong>
                        </div>
                        <div className="account-usage__bar">
                          <span className="account-usage__fill" style={{ width: "64%" }}></span>
                        </div>
                      </div>
                    </article>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "generations" && (
              <section className="account-panel is-active" data-account-panel="generations">
                <div className="account-card__head account-card__head--panel">
                  <div>
                    <h3>Проекты аккаунта</h3>
                    <p>Список генераций и готовых Shorts, найденных для текущего аккаунта в общей БД.</p>
                  </div>
                  <div className="account-pills">
                    <span className="account-pill">Готово: {readyProjectsCount}</span>
                    <span className="account-pill">В работе: {activeProjectsCount}</span>
                    <span className="account-pill">Ошибки: {failedProjectsCount}</span>
                  </div>
                </div>

                {isProjectsLoading ? (
                  <article className="account-empty-state">
                    <strong>Загружаем проекты...</strong>
                    <p>Собираем список генераций и готовых видео из базы данных аккаунта.</p>
                  </article>
                ) : null}

                {!isProjectsLoading && projectsError ? (
                  <article className="account-empty-state account-empty-state--error">
                    <strong>Не удалось загрузить проекты</strong>
                    <p>{projectsError}</p>
                          <button
                      className="account-linkbtn route-button"
                            type="button"
                      onClick={() => {
                        setProjectsError(null);
                        setHasLoadedProjects(false);
                      }}
                    >
                      Повторить загрузку
                          </button>
                  </article>
                ) : null}

                {!isProjectsLoading && !projectsError && !projects.length ? (
                  <article className="account-empty-state">
                    <strong>Проектов пока нет</strong>
                    <p>Как только в этом аккаунте появятся созданные Shorts, они отобразятся в этой вкладке.</p>
                  </article>
                        ) : null}

	                {!isProjectsLoading && !projectsError && projects.length ? (
	                  <div className="account-library account-library--projects">
                      {projectDeleteError ? (
                        <p className="project-action-error" role="alert">
                          {projectDeleteError}
                        </p>
                      ) : null}
	                    {accountProjectGroups.flatMap((group: WorkspaceProjectStackGroup<WorkspaceProject>) => {
                        if (!group.isStack) {
                          return [
                            <AccountProjectListCard
                              key={group.leadProject.id}
                              onDelete={requestProjectDelete}
                              project={group.leadProject}
                            />,
                          ];
                        }

                        const isExpanded = expandedAccountProjectStackKey === group.key;
                        const toggleStack = () =>
                          setExpandedAccountProjectStackKey((currentKey) =>
                            currentKey === group.key ? null : group.key,
                          );

                        if (isExpanded) {
                          return group.projects.map((project, index) => (
                            <AccountProjectListCard
                              isStackExpanded={index === 0}
                              key={project.id}
                              onDelete={requestProjectDelete}
                              onToggleStack={index === 0 ? toggleStack : undefined}
                              project={project}
                              showStackCollapseHandle={index === 0}
                              stackBadgeLabel={null}
                            />
                          ));
                        }

                        return (
                          <div
                            className={`account-project-stack${isExpanded ? " is-expanded" : ""}${group.isStack ? " is-stack" : ""}`}
                            key={group.key}
                          >
                            <div className="account-project-stack__lead">
                              <AccountProjectListCard
                                isStackExpanded={isExpanded}
                                isStackLead
                                onDelete={() => requestProjectStackDelete(group.projects)}
                                onToggleStack={toggleStack}
                                project={group.leadProject}
                                stackBadgeLabel={formatProjectVersionsLabel(group.projects.length)}
                              />
                            </div>
	                        </div>
                        );
                      })}
                </div>
                ) : null}
              </section>
            )}

            {activeTab === "billing" && (
              <section className="account-panel is-active" data-account-panel="billing">
                <div className="account-layout">
                  <article className="account-card">
                    <div className="account-card__head">
                      <div>
                        <h3>Текущий тариф</h3>
                        <p>{workspaceBillingDescription}</p>
                      </div>
                      <span className="account-pill">{workspacePlanLabel}</span>
                    </div>

                    <div className="account-billing">
                      <div className="account-billing__row">
                        <span>Тариф</span>
                        <strong>{workspacePlanLabel}</strong>
                      </div>
                      <div className="account-billing__row">
                        <span>Баланс кредитов</span>
                        <strong>{workspaceBalance === null ? "…" : `${workspaceBalance} credits`}</strong>
                      </div>
                      <div className="account-billing__row">
                        <span>Дополнительные пакеты</span>
                        <strong>{workspaceCanPurchaseCreditPacks ? "Доступны" : "Только PRO / ULTRA"}</strong>
                      </div>
                    </div>

                    <div className="account-billing__note">
                      <p>{workspaceCreditPackNote}</p>
                      </div>

                    <button className="account-topup__primary" type="button" onClick={openWorkspaceCreditPacks}>
                      {workspaceCreditPackActionLabel}
                    </button>
                  </article>

                  <div className="account-stack">
                    <article className="account-card">
                      <div className="account-card__head">
                        <div>
                          <h3>Пакеты кредитов</h3>
                          <p>Дополнительные пакеты доступны только для пользователей PRO и ULTRA.</p>
                        </div>
                      </div>

                      <div className="account-topups__grid">
                        {workspaceCreditTopupPacks.map((pack) => (
                          <article
                            key={pack.name}
                            className={`account-topup${workspaceCanPurchaseCreditPacks ? "" : " is-locked"}`}
                          >
                            {pack.badge ? <span className="account-topup__badge">{pack.badge}</span> : null}
                            <span className="account-topup__name">{pack.name}</span>
                            <strong>{pack.credits}</strong>
                            <span className="account-topup__price">{pack.price}</span>
                            <small>{pack.subnote}</small>
                            <button
                              className="account-topup__cta"
                              type="button"
                              onClick={openWorkspaceCreditPacks}
                              disabled={!workspaceCanPurchaseCreditPacks}
                            >
                              {workspaceCanPurchaseCreditPacks ? "Выбрать пакет" : "Нужен PRO / ULTRA"}
                            </button>
                          </article>
                        ))}
                        </div>

                      <p className="account-topups__footnote">
                        Пакеты не меняют тариф и начисляются поверх текущего баланса кредитов.
                      </p>
                    </article>

                    <article className="account-card">
                      <div className="account-card__head">
                        <div>
                          <h3>Как будет работать пополнение</h3>
                          <p>Сценарий для PRO и ULTRA внутри интерфейса.</p>
                        </div>
                      </div>

                      <div className="account-credit-flow">
                        <div className="account-credit-flow__item">
                          <strong>1</strong>
                          <span>Во вкладке Billing пользователь видит пакеты 100 / 500 / 1000 кредитов.</span>
                        </div>
                        <div className="account-credit-flow__item">
                          <strong>2</strong>
                          <span>На FREE и START интерфейс ведёт на апгрейд до PRO или ULTRA.</span>
                        </div>
                        <div className="account-credit-flow__item">
                          <strong>3</strong>
                          <span>На PRO и ULTRA открывается сценарий выбора пакета и пополнения текущего баланса.</span>
                        </div>
                      </div>
                    </article>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "settings" && (
              <section className="account-panel is-active" data-account-panel="settings">
                <div className="account-formgrid">
                  <article className="account-card">
                    <div className="account-card__head">
                      <div>
                        <h3>Profile</h3>
                        <p>Основные данные аккаунта и workspace owner.</p>
                      </div>
                    </div>

                    <div className="account-fields">
                      <div className="account-field">
                        <span>Name</span>
                        <strong>{session.name}</strong>
                      </div>
                      <div className="account-field">
                        <span>Email</span>
                        <strong>{session.email}</strong>
                      </div>
                      <div className="account-field">
                        <span>Workspace</span>
                        <strong>AdShorts Growth Team</strong>
                      </div>
                    </div>
                  </article>

                  <article className="account-card">
                    <div className="account-card__head">
                      <div>
                        <h3>Integrations</h3>
                        <p>Подключения и состояние API/каналов.</p>
                      </div>
                    </div>

                    <div className="account-checklist">
                      <div className="account-checklist__item">
                        <span>YouTube publish API</span>
                        <strong>Connected</strong>
                      </div>
                      <div className="account-checklist__item">
                        <span>Google OAuth</span>
                        <strong>Healthy</strong>
                      </div>
                      <div className="account-checklist__item">
                        <span>Webhook exports</span>
                        <strong>Pending setup</strong>
                      </div>
                    </div>
                  </article>

                  <article className="account-card">
                    <div className="account-card__head">
                      <div>
                        <h3>Notifications</h3>
                        <p>Что будет приходить команде по email и в product UI.</p>
                      </div>
                    </div>

                    <div className="account-checklist">
                      <div className="account-checklist__item">
                        <span>Generation finished</span>
                        <strong>Enabled</strong>
                      </div>
                      <div className="account-checklist__item">
                        <span>Weekly usage digest</span>
                        <strong>Enabled</strong>
                      </div>
                      <div className="account-checklist__item">
                        <span>Billing reminders</span>
                        <strong>Enabled</strong>
                      </div>
                    </div>
                  </article>

                  <article className="account-card">
                    <div className="account-card__head">
                      <div>
                        <h3>Security</h3>
                        <p>Доступ, сессии и безопасность аккаунта.</p>
                      </div>
                    </div>

                    <div className="account-checklist">
                      <div className="account-checklist__item">
                        <span>2FA</span>
                        <strong>Recommended</strong>
                      </div>
                      <div className="account-checklist__item">
                        <span>Last login</span>
                        <strong>Today · 13:42</strong>
                      </div>
                      <div className="account-checklist__item">
                        <span>Workspace access</span>
                        <strong>3 members</strong>
                      </div>
                    </div>

                    <button className="account-linkbtn account-linkbtn--danger route-button" type="button" onClick={onLogout}>
                      Выйти из аккаунта
                    </button>
                  </article>
                </div>
              </section>
            )}
          </div>
        </div>
          </div>
        </section>
      </main>
              </div>
    </>
  );
}
