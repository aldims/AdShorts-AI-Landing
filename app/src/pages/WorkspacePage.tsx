import { Fragment, type CSSProperties, type ChangeEvent, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type SyntheticEvent as ReactSyntheticEvent, type WheelEvent as ReactWheelEvent, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AccountMenuButton } from "../components/AccountMenuButton";
import { PrimarySiteNav } from "../components/PrimarySiteNav";
import { SiteHeaderWorkspaceStatus } from "../components/SiteHeaderWorkspaceStatus";
import { clearExamplePrefillIntent, readExamplePrefillIntent } from "../lib/example-prefill";
import { clearStudioEntryIntent, readStudioEntryIntent, type StudioEntryIntentSection } from "../lib/studio-entry-intent";
import {
  createWorkspaceMediaLibraryItem,
  getWorkspaceImageDownloadName,
  getWorkspaceProjectDisplayTitle,
  getWorkspaceVideoDownloadName,
  type WorkspaceMediaLibraryItem,
  type WorkspaceMediaLibraryItemKind,
} from "../lib/workspaceMediaLibrary";

type WorkspaceTab = "overview" | "studio" | "generations" | "billing" | "settings";

type Session = {
  name: string;
  email: string;
  plan: string;
};

const isAbortLikeError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";

type WorkspaceProfile = {
  balance: number;
  expiresAt: string | null;
  plan: string;
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
  generatedAt: string;
  hashtags: string[];
  id: string;
  modelLabel: string;
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

type WorkspaceLocalExampleGoal = "stories" | "fun" | "ads" | "fantasy" | "interesting" | "effects";

type WorkspaceLocalExamplesResponse = {
  data?: {
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

type WorkspaceProjectsPayload = {
  projects: WorkspaceProject[];
};

type WorkspaceProjectsResponse = {
  data?: WorkspaceProjectsPayload;
  error?: string;
};

type WorkspaceMediaLibraryPayload = {
  items: WorkspaceMediaLibraryItem[];
};

type WorkspaceMediaLibraryResponse = {
  data?: WorkspaceMediaLibraryPayload;
  error?: string;
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

type WorkspaceSegmentEditorVideoAction = "ai" | "ai_photo" | "custom" | "original" | "photo_animation";
type WorkspaceSegmentEditorPayloadVideoAction = "ai" | "custom" | "original";
type WorkspaceSegmentPreviewKind = "video" | "image";
type WorkspaceSegmentAiVideoMode = "ai_video" | "photo_animation";
type WorkspaceSegmentMediaType = "photo" | "video";
type WorkspaceSegmentCustomVisualSource = "upload" | "media-library";
type WorkspaceSegmentVisualModalTab = "ai_video" | "photo_animation" | "ai_photo" | "upload" | "library";

type WorkspaceSegmentEditorSpeechWord = {
  confidence: number;
  endTime: number;
  startTime: number;
  text: string;
};

type WorkspaceSegmentEditorSegment = {
  currentPlaybackUrl: string | null;
  currentPreviewUrl: string | null;
  duration: number;
  endTime: number;
  index: number;
  mediaType: WorkspaceSegmentMediaType;
  originalPlaybackUrl: string | null;
  originalPreviewUrl: string | null;
  speechDuration: number | null;
  speechEndTime: number | null;
  speechStartTime: number | null;
  speechWords: WorkspaceSegmentEditorSpeechWord[];
  startTime: number;
  text: string;
};

type WorkspaceSegmentEditorSession = {
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
  customVideoFileDataUrl?: string;
  customVideoFileMimeType?: string;
  customVideoFileName?: string;
  customVideoFileUploadKey?: string;
  duration?: number;
  endTime?: number;
  index: number;
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
  originalText: string;
  originalTextByLanguage: WorkspaceSegmentEditorLocalizedTextMap;
  textByLanguage: WorkspaceSegmentEditorLocalizedTextMap;
  videoAction: WorkspaceSegmentEditorVideoAction;
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

type WorkspaceSegmentAiPhotoPromptImproveRequest = {
  language: StudioLanguage;
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

type WorkspaceSegmentAiVideoJobCreateRequest = {
  language: StudioLanguage;
  prompt: string;
  projectId?: number;
  segmentIndex?: number;
};

type WorkspaceSegmentPhotoAnimationJobCreateRequest = WorkspaceSegmentAiVideoJobCreateRequest;

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
  dataUrl?: string;
  file?: File;
  fileName: string;
  fileSize: number;
  objectUrl?: string;
};

type StudioVideoMode = "ai_photo" | "ai_video" | "custom" | "standard";

type StudioVideoOption = {
  costLabel?: string;
  description: string;
  id: StudioVideoMode;
  label: string;
};

const STUDIO_VIDEO_GENERATION_CREDIT_COST = 10;

type StudioCustomVideoFile = {
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
const STUDIO_ALLOWED_SEGMENT_CUSTOM_IMAGE_EXTENSIONS = [".avif", ".jpeg", ".jpg", ".png", ".webp"] as const;
const STUDIO_ALLOWED_SEGMENT_CUSTOM_VISUAL_EXTENSIONS = [
  ...STUDIO_ALLOWED_CUSTOM_VIDEO_EXTENSIONS,
  ...STUDIO_ALLOWED_SEGMENT_CUSTOM_IMAGE_EXTENSIONS,
] as const;
const WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS = 1;
const WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS = 8;
const WORKSPACE_SEGMENT_EDITOR_NEW_SEGMENT_DURATION_SECONDS = 2.4;
const WORKSPACE_SEGMENT_GENERATION_JOB_TIMEOUT_MS = 4 * 60 * 1000;

const normalizeWorkspaceSegmentGenerationJobStatus = (value: unknown) => String(value ?? "").trim().toLowerCase();

const isWorkspaceSegmentGenerationJobDoneStatus = (value: unknown) =>
  ["completed", "done", "ready", "success", "succeeded"].includes(normalizeWorkspaceSegmentGenerationJobStatus(value));

const isWorkspaceSegmentGenerationJobFailedStatus = (value: unknown) =>
  ["canceled", "cancelled", "error", "failed", "timeout"].includes(normalizeWorkspaceSegmentGenerationJobStatus(value));

const studioPromptChips = ["Видео", "Субтитры", "Озвучка", "Музыка", "Язык"];
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
  if (segment.videoAction === "ai" || segment.videoAction === "photo_animation") {
    return Boolean(segment.aiVideoAsset);
  }

  if (segment.videoAction === "ai_photo") {
    return Boolean(segment.aiPhotoAsset);
  }

  if (segment.videoAction === "custom") {
    return Boolean(segment.customVideo);
  }

  return false;
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
  if (segment.videoAction === "ai") {
    return "обновлено видео";
  }

  if (segment.videoAction === "photo_animation") {
    return "добавлено движение в фото";
  }

  if (segment.videoAction === "custom") {
    return segment.customVideo?.source === "media-library"
      ? "выбран визуал из медиатеки"
      : "добавлен свой визуал";
  }

  if (segment.videoAction === "ai_photo") {
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

const studioEnglishVoicePreviewText = "This is a quick English voice preview for your video.";

const studioVoiceOptionsByLanguage: Record<StudioLanguage, StudioVoiceOption[]> = {
  ru: [
    {
      id: "Bys_24000",
      label: "Борис",
      description: "Базовый мужской голос",
      previewSampleUrl: "/voice-previews/boris.wav",
    },
    {
      id: "Nec_24000",
      label: "Наталья",
      description: "Базовый женский голос",
      previewSampleUrl: "/voice-previews/natalya.wav",
    },
    {
      id: "Tur_24000",
      label: "Тарас",
      description: "Уверенный мужской голос",
      previewSampleUrl: "/voice-previews/taras.wav",
    },
    {
      id: "May_24000",
      label: "Марфа",
      description: "Молодой женский голос",
      previewSampleUrl: "/voice-previews/marfa.wav",
    },
    {
      id: "Ost_24000",
      label: "Александра",
      description: "Естественный рекламный голос",
      previewSampleUrl: "/voice-previews/alexandra.wav",
    },
    {
      id: "Pon_24000",
      label: "Сергей",
      description: "Деловой мужской голос",
      previewSampleUrl: "/voice-previews/sergey.wav",
    },
    {
      id: "Rma_24000",
      label: "Рма",
      description: "Более плотный и выразительный тембр",
      previewSampleUrl: "/voice-previews/rma.wav",
    },
    {
      id: "Rnu_24000",
      label: "Рну",
      description: "Спокойный мужской голос",
      previewSampleUrl: "/voice-previews/rnu.wav",
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
    costLabel: "10 кредитов",
  },
  {
    id: "ai_photo",
    label: "Только ИИ фото",
    description: "Только анимированные ИИ фото, без стоков",
    costLabel: "10 кредитов",
  },
  {
    id: "ai_video",
    label: "ИИ видео",
    description: "Полностью ИИ-режим с Wan I2V для всех сцен",
    costLabel: "10 кредитов",
  },
  {
    id: "custom",
    label: "Свое видео",
    description: "Загрузите свой mp4, mov, webm или m4v",
  },
];
const workspaceLocalExampleGoalOptions: Array<{
  description: string;
  id: WorkspaceLocalExampleGoal;
  label: string;
}> = [
  {
    description: "Сюжеты, повествование и личные истории.",
    id: "stories",
    label: "📖 Истории",
  },
  {
    description: "Юмор, мемы, лёгкие ролики и развлекательная подача.",
    id: "fun",
    label: "😂 Развлечения",
  },
  {
    description: "Офферы, продажи, продукты и рекламные связки.",
    id: "ads",
    label: "💰 Реклама",
  },
  {
    description: "Фантазийные сцены, космос, вау-миры и невозможные идеи.",
    id: "fantasy",
    label: "🌌 Фантазия",
  },
  {
    description: "Факты, разборы, необычные наблюдения и познавательные темы.",
    id: "interesting",
    label: "🧠 Интересное",
  },
  {
    description: "Переходы, визуальные трюки, motion и заметные эффекты.",
    id: "effects",
    label: "✨ Эффекты",
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

const createStudioObjectUrl = (file: Blob) => {
  if (typeof URL === "undefined") {
    throw new Error("Object URL is not available in this environment.");
  }

  return URL.createObjectURL(file);
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
    | Pick<StudioCustomMusicFile, "dataUrl" | "objectUrl">
    | Pick<StudioCustomVideoFile, "dataUrl" | "objectUrl" | "remoteUrl">
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

  const remoteUrl =
    typeof (asset as { remoteUrl?: unknown } | null | undefined)?.remoteUrl === "string"
      ? String((asset as { remoteUrl?: string }).remoteUrl).trim()
      : "";
  return remoteUrl || null;
};

const getStudioCustomAssetPosterUrl = (
  asset: Pick<StudioCustomVideoFile, "posterUrl"> | null | undefined,
) => {
  const posterUrl = typeof asset?.posterUrl === "string" ? asset.posterUrl.trim() : "";
  return posterUrl || null;
};

const resolveStudioCustomAssetDataUrl = async (
  asset:
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
  return STUDIO_ALLOWED_CUSTOM_VIDEO_EXTENSIONS.some((extension) => normalized.endsWith(extension));
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

const getWorkspaceSegmentDraftVisualAsset = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (segment.videoAction === "ai" || segment.videoAction === "photo_animation") {
    return segment.aiVideoAsset;
  }

  if (segment.videoAction === "custom") {
    return segment.customVideo;
  }

  if (segment.videoAction === "ai_photo") {
    return segment.aiPhotoAsset;
  }

  return null;
};

const getWorkspaceSegmentFallbackPreviewKind = (
  segment: Pick<WorkspaceSegmentEditorDraftSegment, "mediaType">,
): WorkspaceSegmentPreviewKind => (segment.mediaType === "photo" ? "image" : "video");

const getWorkspaceSegmentPreviewKind = (segment: WorkspaceSegmentEditorDraftSegment): WorkspaceSegmentPreviewKind =>
  getWorkspaceSegmentCustomPreviewKind(getWorkspaceSegmentDraftVisualAsset(segment)) ??
  getWorkspaceSegmentFallbackPreviewKind(segment);

const getStudioVideoChipValue = (videoMode: StudioVideoMode, customVideoFile: StudioCustomVideoFile | null) => {
  if (videoMode === "custom") {
    return customVideoFile ? truncateStudioCustomAssetName(customVideoFile.fileName) : "Свое видео";
  }

  return studioVideoOptions.find((option) => option.id === videoMode)?.label ?? "Стандартный";
};

const getRequiredCreditsForVideoMode = (videoMode: StudioVideoMode) => {
  void videoMode;
  return STUDIO_VIDEO_GENERATION_CREDIT_COST;
};

const cloneStudioCustomVideoFile = (value: StudioCustomVideoFile | null) => (value ? { ...value } : null);
const cloneWorkspaceProject = (project: WorkspaceProject): WorkspaceProject => ({
  ...project,
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
  mediaType: normalizeWorkspaceSegmentMediaType(segment.mediaType),
  originalText: typeof segment.originalText === "string" ? segment.originalText : segment.text,
  originalTextByLanguage: cloneWorkspaceSegmentEditorLocalizedTextMap(
    segment.originalTextByLanguage,
    typeof segment.originalText === "string" ? segment.originalText : segment.text,
  ),
  textByLanguage: cloneWorkspaceSegmentEditorLocalizedTextMap(segment.textByLanguage, segment.text),
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

const normalizeWorkspaceSegmentEditorSetting = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
};

const normalizeWorkspaceSegmentEditorTimeValue = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
};

const getWorkspaceSegmentEditorPlaybackDuration = (
  segment: Pick<
    WorkspaceSegmentEditorSegment,
    "duration" | "endTime" | "speechDuration" | "speechEndTime" | "speechStartTime" | "speechWords" | "startTime" | "text"
  >,
  fallbackWordCount?: number,
) => {
  const resolvedWordCount = Math.max(1, fallbackWordCount ?? tokenizeWorkspaceSegmentSubtitleText(String(segment.text ?? "")).length);
  const estimatedDurationFloor = Math.max(1.8, resolvedWordCount * 0.34);
  const displayStart =
    normalizeWorkspaceSegmentEditorTimeValue(segment.startTime) ??
    normalizeWorkspaceSegmentEditorTimeValue(segment.speechStartTime) ??
    segment.speechWords[0]?.startTime ??
    0;
  const displayEnd =
    normalizeWorkspaceSegmentEditorTimeValue(segment.endTime) ??
    normalizeWorkspaceSegmentEditorTimeValue(segment.speechEndTime) ??
    segment.speechWords[segment.speechWords.length - 1]?.endTime ??
    displayStart;
  const timelineDuration = displayEnd - displayStart;
  const candidates = [
    typeof segment.speechDuration === "number" && Number.isFinite(segment.speechDuration) && segment.speechDuration > 0
      ? segment.speechDuration
      : null,
    typeof segment.duration === "number" && Number.isFinite(segment.duration) && segment.duration > 0
      ? segment.duration
      : null,
    Number.isFinite(timelineDuration) && timelineDuration > 0 ? timelineDuration : null,
    estimatedDurationFloor,
  ].filter((value): value is number => value !== null);

  if (candidates.length > 0) {
    return Math.max(...candidates);
  }

  return estimatedDurationFloor;
};

const normalizeWorkspaceSegmentEditorSegmentUrls = <
  T extends {
    currentPlaybackUrl?: string | null;
    currentPreviewUrl?: string | null;
    currentVideoUrl?: string | null;
    originalPlaybackUrl?: string | null;
    originalPreviewUrl?: string | null;
    originalVideoUrl?: string | null;
  },
>(
  segment: T,
) => ({
  ...segment,
  currentPlaybackUrl: normalizeWorkspaceSegmentEditorUrl(
    segment.currentPlaybackUrl ?? segment.currentPreviewUrl ?? segment.currentVideoUrl,
  ),
  currentPreviewUrl: normalizeWorkspaceSegmentEditorUrl(
    segment.currentPreviewUrl ?? segment.currentPlaybackUrl ?? segment.currentVideoUrl,
  ),
  originalPlaybackUrl: normalizeWorkspaceSegmentEditorUrl(
    segment.originalPlaybackUrl ?? segment.originalPreviewUrl ?? segment.originalVideoUrl,
  ),
  originalPreviewUrl: normalizeWorkspaceSegmentEditorUrl(
    segment.originalPreviewUrl ?? segment.originalPlaybackUrl ?? segment.originalVideoUrl,
  ),
});

const cloneWorkspaceSegmentEditorDraftSession = (
  session: WorkspaceSegmentEditorDraftSession,
): WorkspaceSegmentEditorDraftSession => ({
  ...session,
  segments: session.segments.map((segment) => cloneWorkspaceSegmentEditorDraftSegment(segment)),
});

const createWorkspaceSegmentEditorDraftSession = (
  session: WorkspaceSegmentEditorSession,
): WorkspaceSegmentEditorDraftSession => ({
  ...session,
  segments: session.segments.map((segment) => ({
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
    mediaType: normalizeWorkspaceSegmentMediaType(segment.mediaType),
    originalText: segment.text,
    originalTextByLanguage: {
      ru: segment.text,
    },
    textByLanguage: {
      ru: segment.text,
    },
    videoAction: "original",
  })),
});

const getWorkspaceSegmentEditorNextSegmentIndex = (segments: WorkspaceSegmentEditorDraftSegment[]) =>
  segments.reduce((maxIndex, segment) => Math.max(maxIndex, segment.index), -1) + 1;

const getWorkspaceSegmentEditorInsertedSegmentTiming = (
  segments: WorkspaceSegmentEditorDraftSegment[],
  insertAt: number,
) => {
  const previousSegment = insertAt > 0 ? segments[insertAt - 1] ?? null : null;
  const nextSegment = segments[insertAt] ?? null;
  const startTime = previousSegment ? getWorkspaceSegmentEditorDisplayEndTime(previousSegment) : 0;
  const fallbackDuration = previousSegment
    ? getWorkspaceSegmentEditorPlaybackDuration(previousSegment)
    : nextSegment
      ? getWorkspaceSegmentEditorPlaybackDuration(nextSegment)
      : WORKSPACE_SEGMENT_EDITOR_NEW_SEGMENT_DURATION_SECONDS;
  const nextStartTime = nextSegment ? getWorkspaceSegmentEditorDisplayStartTime(nextSegment) : null;
  const duration =
    typeof nextStartTime === "number" && nextStartTime > startTime
      ? nextStartTime - startTime
      : fallbackDuration;
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
    currentPlaybackUrl: null,
    currentPreviewUrl: null,
    customVideo: null,
    duration,
    endTime,
    index: nextIndex,
    mediaType: "video",
    originalPlaybackUrl: null,
    originalPreviewUrl: null,
    originalText: baseText,
    originalTextByLanguage: { ...textByLanguage },
    speechDuration: null,
    speechEndTime: null,
    speechStartTime: null,
    speechWords: [],
    startTime,
    text: baseText,
    textByLanguage: { ...textByLanguage },
    videoAction: "original",
  };
};

const normalizeWorkspaceSegmentEditorSession = (
  session: WorkspaceSegmentEditorSession,
): WorkspaceSegmentEditorSession => ({
  ...session,
  segments: session.segments.map((segment) => ({
    ...normalizeWorkspaceSegmentEditorSegmentUrls(segment),
    mediaType: normalizeWorkspaceSegmentMediaType(segment.mediaType),
  })),
});

const getWorkspaceSegmentEditorDisplayStartTime = (segment: WorkspaceSegmentEditorSegment) =>
  normalizeWorkspaceSegmentEditorTimeValue(segment.startTime) ??
  normalizeWorkspaceSegmentEditorTimeValue(segment.speechStartTime) ??
  segment.speechWords[0]?.startTime ??
  0;

const getWorkspaceSegmentEditorDisplayEndTime = (segment: WorkspaceSegmentEditorSegment) =>
  normalizeWorkspaceSegmentEditorTimeValue(segment.endTime) ??
  normalizeWorkspaceSegmentEditorTimeValue(segment.speechEndTime) ??
  segment.speechWords[segment.speechWords.length - 1]?.endTime ??
  getWorkspaceSegmentEditorDisplayStartTime(segment);

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
    const normalizedMediaType = normalizeWorkspaceSegmentMediaType(segment.mediaType);
    const normalizedTextByLanguage = cloneWorkspaceSegmentEditorLocalizedTextMap(segment.textByLanguage, segment.text);
    const normalizedOriginalTextByLanguage = cloneWorkspaceSegmentEditorLocalizedTextMap(
      segment.originalTextByLanguage,
      normalizedOriginalText,
    );
    const hasUrlChanges =
      normalizedSegment.currentPlaybackUrl !== segment.currentPlaybackUrl ||
      normalizedSegment.currentPreviewUrl !== segment.currentPreviewUrl ||
      normalizedSegment.originalPlaybackUrl !== segment.originalPlaybackUrl ||
      normalizedSegment.originalPreviewUrl !== segment.originalPreviewUrl;
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
      normalizedVideoAction !== segment.videoAction ||
      normalizedMediaType !== segment.mediaType;

    if (
      segment.customVideo ||
      segment.aiPhotoAsset ||
      segment.aiVideoAsset ||
      normalizedVideoAction === "original" ||
      normalizedVideoAction === "ai" ||
      normalizedVideoAction === "ai_photo" ||
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
        mediaType: normalizedMediaType,
        originalText: normalizedOriginalText,
        originalTextByLanguage: normalizedOriginalTextByLanguage,
        textByLanguage: normalizedTextByLanguage,
        videoAction: normalizedVideoAction,
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
      mediaType: normalizedMediaType,
      originalText: normalizedOriginalText,
      originalTextByLanguage: normalizedOriginalTextByLanguage,
      textByLanguage: normalizedTextByLanguage,
      videoAction: "original" as const,
    };
  });

  return hasChanges
    ? {
        ...session,
        segments,
      }
    : session;
};

type WorkspaceSegmentEditorUploadFile = {
  fieldName: string;
  file: File;
  fileName: string;
};

const buildWorkspaceSegmentEditorPayload = async (
  session: WorkspaceSegmentEditorDraftSession,
): Promise<{ payload: WorkspaceSegmentEditorPayload; uploads: WorkspaceSegmentEditorUploadFile[] }> => {
  const segments: WorkspaceSegmentEditorPayloadSegment[] = [];
  const uploads: WorkspaceSegmentEditorUploadFile[] = [];

  for (const segment of session.segments) {
    const readyAiVideoAsset =
      segment.videoAction === "ai"
        ? isWorkspaceSegmentAiVideoReady(segment, "ai_video")
          ? segment.aiVideoAsset
          : null
        : segment.videoAction === "photo_animation"
          ? isWorkspaceSegmentAiVideoReady(segment, "photo_animation")
            ? segment.aiVideoAsset
            : null
          : null;
    const customVisualAsset =
      segment.videoAction === "custom"
        ? segment.customVideo
        : segment.videoAction === "ai_photo"
          ? segment.aiPhotoAsset
          : readyAiVideoAsset
            ? readyAiVideoAsset
          : null;
    const payloadVideoAction: WorkspaceSegmentEditorPayloadVideoAction =
      segment.videoAction === "ai_photo" || Boolean(readyAiVideoAsset)
        ? "custom"
        : segment.videoAction === "photo_animation"
          ? "original"
          : segment.videoAction;
    let customVideoFileDataUrl: string | undefined;
    let customVideoFileUploadKey: string | undefined;

    if (payloadVideoAction === "custom") {
      if (customVisualAsset?.file) {
        customVideoFileUploadKey = `segmentCustomFile-${segment.index}`;
        uploads.push({
          fieldName: customVideoFileUploadKey,
          file: customVisualAsset.file,
          fileName: customVisualAsset.fileName,
        });
      } else {
        customVideoFileDataUrl = await resolveStudioCustomAssetDataUrl(customVisualAsset);
      }
    }

    segments.push({
      customVideoFileDataUrl,
      customVideoFileMimeType: payloadVideoAction === "custom" ? customVisualAsset?.mimeType : undefined,
      customVideoFileName: payloadVideoAction === "custom" ? customVisualAsset?.fileName : undefined,
      customVideoFileUploadKey,
      duration: segment.duration,
      endTime: segment.endTime,
      // Keep the original segment identity in `index`; array order carries the new sequence after reorder.
      index: segment.index,
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

const getWorkspaceSegmentDraftPreviewUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  const fallbackStillPreviewUrl =
    segment.currentPreviewUrl ??
    segment.originalPreviewUrl;
  const fallbackPreviewUrl =
    fallbackStillPreviewUrl ??
    segment.currentPlaybackUrl ??
    segment.originalPlaybackUrl;

  if (segment.videoAction === "ai") {
    return getStudioCustomAssetPosterUrl(segment.aiVideoAsset);
  }

  if (segment.videoAction === "photo_animation") {
    return getStudioCustomAssetPosterUrl(segment.aiVideoAsset) ?? fallbackStillPreviewUrl ?? fallbackPreviewUrl;
  }

  if (segment.videoAction === "custom") {
    const customPreviewUrl = getStudioCustomAssetPreviewUrl(segment.customVideo);
    return getWorkspaceSegmentCustomPreviewKind(segment.customVideo) === "video"
      ? getStudioCustomAssetPosterUrl(segment.customVideo)
      : customPreviewUrl ?? fallbackPreviewUrl;
  }

  if (segment.videoAction === "ai_photo") {
    return (
      getStudioCustomAssetPreviewUrl(segment.aiPhotoAsset) ??
      fallbackPreviewUrl
    );
  }

  if (segment.videoAction === "original") {
    return (
      segment.originalPreviewUrl ??
      segment.originalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentPlaybackUrl
    );
  }

  return (
    segment.currentPreviewUrl ??
    segment.currentPlaybackUrl ??
    segment.originalPreviewUrl ??
    segment.originalPlaybackUrl
  );
};

const getWorkspaceSegmentDraftFallbackPosterUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (segment.videoAction !== "photo_animation") {
    return null;
  }

  return segment.currentPreviewUrl ?? segment.originalPreviewUrl ?? null;
};

const getWorkspaceSegmentDraftVideoUrl = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (segment.videoAction === "ai" || segment.videoAction === "photo_animation") {
    return (
      getStudioCustomAssetPreviewUrl(segment.aiVideoAsset) ??
      segment.currentPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.originalPreviewUrl
    );
  }

  if (segment.videoAction === "custom") {
    return (
      getStudioCustomAssetPreviewUrl(segment.customVideo) ??
      segment.currentPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.originalPreviewUrl
    );
  }

  if (segment.videoAction === "ai_photo") {
    return (
      getStudioCustomAssetPreviewUrl(segment.aiPhotoAsset) ??
      segment.currentPlaybackUrl ??
      segment.originalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.originalPreviewUrl
    );
  }

  if (segment.videoAction === "original") {
    return (
      segment.originalPlaybackUrl ??
      segment.currentPlaybackUrl ??
      segment.originalPreviewUrl ??
      segment.currentPreviewUrl
    );
  }

  return (
    segment.currentPlaybackUrl ??
    segment.originalPlaybackUrl ??
    segment.currentPreviewUrl ??
    segment.originalPreviewUrl
  );
};

const getWorkspaceSegmentDraftSourceLabel = (segment: WorkspaceSegmentEditorDraftSegment) => {
  if (segment.videoAction === "custom") {
    return segment.customVideo?.source === "media-library" ? "Медиатека" : "Свой визуал";
  }

  if (segment.videoAction === "ai_photo") {
    return "ИИ фото";
  }

  if (segment.videoAction === "photo_animation") {
    return "ИИ анимация фото";
  }

  if (segment.videoAction === "ai") {
    return "ИИ видео";
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

const areWorkspaceProfilesEqual = (left: WorkspaceProfile | null | undefined, right: WorkspaceProfile | null | undefined) =>
  normalizeWorkspacePlan(left?.plan) === normalizeWorkspacePlan(right?.plan) &&
  normalizeWorkspaceBalance(left?.balance) === normalizeWorkspaceBalance(right?.balance) &&
  normalizeWorkspaceExpiry(left?.expiresAt) === normalizeWorkspaceExpiry(right?.expiresAt);

const STUDIO_PREVIEW_DISMISS_STORAGE_KEY_PREFIX = "adshorts.studio-preview-dismiss:";
const STUDIO_MEDIA_LIBRARY_HIDDEN_STORAGE_KEY_PREFIX = "adshorts.media-library-hidden:";
const STUDIO_CONTENT_PLAN_VISIBILITY_STORAGE_KEY_PREFIX = "adshorts.content-plan-visible:";

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

const getWorkspaceMediaLibraryItemStorageKey = (item: WorkspaceMediaLibraryItem) => item.itemKey;

const getWorkspaceMediaLibraryItemKindLabel = (kind: WorkspaceMediaLibraryItemKind) => {
  if (kind === "photo_animation") {
    return "ИИ анимация фото";
  }

  if (kind === "ai_video") {
    return "ИИ видео";
  }

  return "ИИ фото";
};

const getWorkspaceMediaLibraryItemRemoteUrl = (item: WorkspaceMediaLibraryItem) => item.downloadUrl ?? item.previewUrl;

const getWorkspaceMediaLibraryItemMimeType = (item: WorkspaceMediaLibraryItem) =>
  item.previewKind === "video" ? "video/mp4" : "image/jpeg";

const createStudioCustomVideoFileFromMediaLibraryItem = (item: WorkspaceMediaLibraryItem): StudioCustomVideoFile => ({
  fileName: item.downloadName,
  fileSize: 0,
  libraryItemKey: getWorkspaceMediaLibraryItemStorageKey(item),
  mimeType: getWorkspaceMediaLibraryItemMimeType(item),
  posterUrl: item.previewKind === "video" ? item.previewPosterUrl ?? undefined : undefined,
  remoteUrl: getWorkspaceMediaLibraryItemRemoteUrl(item),
  source: "media-library",
});

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
    generatedAt: normalizedGeneratedAt,
    hashtags: [],
    id: String(matchingGeneration?.id ?? `draft:${draft.projectId}`),
    jobId: matchingGeneration?.id ?? null,
    prompt: matchingGeneration?.prompt ?? "",
    source: "project",
    status: "ready",
    title: matchingGeneration?.title ?? draft.title,
    updatedAt: fallbackTimestamp,
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

  return draft.segments.flatMap((segment, segmentListIndex) => {
    const items: WorkspaceMediaLibraryItem[] = [];
    const aiPhotoPreviewUrl = getStudioCustomAssetPreviewUrl(segment.aiPhotoAsset);
    const aiVideoPreviewUrl = getStudioCustomAssetPreviewUrl(segment.aiVideoAsset);
    const aiVideoPosterUrl =
      getStudioCustomAssetPosterUrl(segment.aiVideoAsset) ??
      segment.currentPreviewUrl ??
      segment.originalPreviewUrl ??
      null;

    if (aiPhotoPreviewUrl) {
      items.push(createWorkspaceMediaLibraryItem({
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

    if (aiVideoPreviewUrl && segment.aiVideoGeneratedMode === "ai_video") {
      items.push(createWorkspaceMediaLibraryItem({
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
  const previewKind = options.kind === "ai_photo" ? "image" : "video";
  const previewPosterUrl =
    options.kind === "ai_photo"
      ? previewUrl
      : getStudioCustomAssetPosterUrl(options.asset) ??
        (options.kind === "photo_animation" ? segment.currentPreviewUrl ?? segment.originalPreviewUrl ?? null : null);
  const downloadName =
    options.kind === "ai_photo"
      ? getImageDownloadName(`${projectTitle}-segment-${segmentNumber}-ai-photo`)
      : options.kind === "photo_animation"
        ? getVideoDownloadName(`${projectTitle}-segment-${segmentNumber}-animation`)
        : getVideoDownloadName(`${projectTitle}-segment-${segmentNumber}-ai-video`);
  const downloadUrl = appendUrlToken(previewUrl, "download", `${downloadToken}:${segment.index}:${options.sourceJobId}`);
  const item = createWorkspaceMediaLibraryItem({
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
    createdAt: Date.now(),
    id: item.itemKey,
    item,
    sourceJobId: options.sourceJobId,
  } satisfies WorkspaceGeneratedMediaLibraryEntry;
};

const captureProjectPoster = (videoUrl: string, options?: { previewTime?: number }) =>
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

      const preferredPreviewTime = Number.isFinite(options?.previewTime) ? Math.max(0, Number(options?.previewTime)) : 0.15;
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

const captureProjectPosterOnce = (
  videoUrl: string,
  options?: {
    cacheKey?: string;
    previewTime?: number;
  },
) => {
  const normalizedVideoUrl = String(videoUrl ?? "").trim();
  if (!normalizedVideoUrl) {
    return Promise.reject(new Error("Video URL is required for poster capture."));
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
  isProjectActionBusy: boolean;
  isPreviewing: boolean;
  onAddToExamples: (project: WorkspaceProject) => void;
  onActivate: (projectId: string, hasVideo: boolean) => void;
  onBlur: (event: ReactFocusEvent<HTMLElement>) => void;
  onDeactivate: (projectId: string) => void;
  onDelete: (project: WorkspaceProject) => void;
  onEdit: (project: WorkspaceProject) => void;
  onOpenPreview: (project: WorkspaceProject) => void;
  onPublish: (project: WorkspaceProject) => void;
  project: WorkspaceProject;
};

function WorkspaceProjectCard({
  canUseLocalExamples,
  isProjectActionBusy,
  isPreviewing,
  onAddToExamples,
  onActivate,
  onBlur,
  onDeactivate,
  onDelete,
  onEdit,
  onOpenPreview,
  onPublish,
  project,
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
      videoElement.preload = "auto";
      videoElement.load();
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
      className={`studio-project-card${hasPreviewFrame ? " has-preview-frame" : ""}${isPreviewing ? " is-previewing" : ""}${isPreviewing && isPreviewVideoReady ? " is-preview-ready" : ""}`}
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
            aria-label={`Открыть превью: ${projectTitle}`}
            onClick={() => {
              setShouldLoadPreview(true);
              onOpenPreview(project);
            }}
          />
        ) : null}
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
        <span className={`studio-project-card__status studio-project-card__status--${project.status}`}>
          {getProjectStatusLabel(project.status)}
        </span>
        <div className="studio-project-card__thumb-footer">
          <span className="studio-project-card__date">{formatProjectDate(project.updatedAt)}</span>
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

const formatDateTimeLocalValue = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";

  const timezoneOffsetMs = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

const publishCalendarWeekdayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const publishTimePresets = ["09:00", "12:00", "15:00", "18:00", "21:00"];

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
    subnote: "~6,9 ₽ за кредит",
  },
  {
    name: "Pack 500",
    credits: "500 кредитов",
    price: "2 750 ₽",
    subnote: "~5,5 ₽ за кредит",
    badge: "Выгодно",
  },
  {
    name: "Pack 1000",
    credits: "1000 кредитов",
    price: "4 990 ₽",
    subnote: "~5 ₽ за кредит",
  },
];

type StudioView = "create" | "projects" | "media";
type StudioCreateMode = "default" | "segment-editor";

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
  customVideoFile: StudioCustomVideoFile | null;
  isPreparingCustomVideo: boolean;
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

    const previewUrl =
      voice.previewSampleUrl ||
      (voice.previewText
        ? `/api/workspace/voice-preview?language=en&voiceId=${encodeURIComponent(voice.id)}`
        : null);

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

function WorkspaceSegmentPreviewCardMedia({
  autoplay = true,
  fallbackPosterUrl,
  imageLoading = "eager",
  isPlaybackRequested = false,
  loop,
  mediaKey,
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
  previewKind,
  previewUrl,
  videoRef,
}: WorkspaceSegmentPreviewCardMediaProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [capturedPosterUrl, setCapturedPosterUrl] = useState<string | null>(null);
  const [isPreferredPosterReady, setIsPreferredPosterReady] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const normalizedPosterUrl = typeof posterUrl === "string" ? posterUrl.trim() : "";
  const normalizedFallbackPosterUrl = typeof fallbackPosterUrl === "string" ? fallbackPosterUrl.trim() : "";
  const resolvedPosterUrl =
    (isPreferredPosterReady ? normalizedPosterUrl : normalizedFallbackPosterUrl || normalizedPosterUrl) ||
    capturedPosterUrl;

  const setVideoElementRef = useCallback(
    (element: HTMLVideoElement | null) => {
      localVideoRef.current = element;
      videoRef?.(element);
    },
    [videoRef],
  );

  useEffect(() => {
    setCapturedPosterUrl(null);
  }, [posterUrl, previewUrl]);

  useEffect(() => {
    setIsVideoPlaying(false);
  }, [mediaKey, previewUrl]);

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
    if (previewKind !== "video" || posterUrl || preload !== "auto") {
      return;
    }

    const normalizedPreviewUrl = previewUrl.trim().toLowerCase();
    if (!normalizedPreviewUrl.startsWith("blob:") && !normalizedPreviewUrl.startsWith("data:")) {
      return;
    }

    let cancelled = false;
    const posterCacheKey = `${previewUrl}::segment-preview-poster`;

    void captureProjectPosterOnce(previewUrl, {
      cacheKey: posterCacheKey,
      previewTime: 0.45,
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
  }, [posterUrl, preload, previewKind, previewUrl]);

  useEffect(() => {
    if (previewKind !== "video" || autoplay || preload !== "auto" || !primePausedFrame) {
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
      const previewFrameTime =
        duration <= 0.04
          ? 0.001
          : Math.max(
              0.001,
              Math.min(
                0.24,
                duration * 0.16,
                duration > 0.08 ? duration - 0.04 : duration * 0.5,
              ),
            );

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
    element.load();

    return () => {
      cancelled = true;
      element.removeEventListener("loadeddata", handleLoadedData);
    };
  }, [autoplay, preload, previewKind, previewUrl, primePausedFrame]);

  if (previewKind === "image") {
    return <img key={mediaKey} src={previewUrl} alt="" loading={imageLoading} decoding="async" draggable={false} />;
  }

  if (preferPosterFrame && resolvedPosterUrl) {
    return (
      <img
        key={`${mediaKey}:poster`}
        src={resolvedPosterUrl}
        alt=""
        loading={imageLoading}
        decoding="async"
        draggable={false}
        aria-hidden="true"
      />
    );
  }

  return (
    <>
      <video
        key={mediaKey}
        ref={setVideoElementRef}
        src={previewUrl}
        autoPlay={autoplay}
        loop={loop ?? autoplay}
        muted={muted}
        poster={resolvedPosterUrl ?? undefined}
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
          onVideoError?.();
        }}
        onEnded={() => {
          setIsVideoPlaying(false);
          onVideoEnded?.();
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
        onTimeUpdate={(event) => onVideoTimeUpdate?.(event.currentTarget.currentTime)}
      />
      {resolvedPosterUrl && !isVideoPlaying && !isPlaybackRequested ? (
        <img
          className="studio-segment-preview-card-media__poster"
          src={resolvedPosterUrl}
          alt=""
          loading={imageLoading}
          decoding="async"
          draggable={false}
          aria-hidden="true"
        />
      ) : null}
    </>
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
      className={`studio-segment-editor__subtitle${compact ? " is-compact" : ""}${isEdited ? " is-edited" : ""}`}
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
  customVideoFile,
  isPreparingCustomVideo,
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
  const selectedVideoLabel = getStudioVideoChipValue(selectedVideoMode, customVideoFile);
  const selectedVideoTitle = customVideoFile?.fileName ?? selectedVideoLabel;
  const customVideoFileLabel = customVideoFile ? truncateStudioCustomAssetName(customVideoFile.fileName) : null;

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

      const estimatedMenuHeight = Math.min(window.innerHeight - 32, 380);
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

  const handleCustomVideoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) return;

    await onSelectCustomFile(file);
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
        accept=".mp4,.mov,.webm,.m4v,video/mp4,video/quicktime,video/webm,video/*"
        onChange={(event) => {
          void handleCustomVideoChange(event);
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
        <span className="studio-video-selector__label">Видео</span>
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
              aria-label="Выбор режима видео"
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
                        {option.costLabel ? <small className="studio-video-selector__cost">{option.costLabel}</small> : null}
                      </span>
                      <small>{option.description}</small>
                    </button>
                  ))}
              </div>

              <div className="studio-video-selector__section">
                <span className="studio-video-selector__menu-title">Загрузить свое видео</span>
                <div className={`studio-video-selector__custom${selectedVideoMode === "custom" ? " is-selected" : ""}`}>
                  <button
                    className="studio-video-selector__custom-main"
                    type="button"
                    onClick={handleCustomVideoSelect}
                  >
                    <span>Загрузить свой ролик</span>
                    <small title={customVideoFile?.fileName}>
                      {customVideoFileLabel ?? "Поддерживаются .mp4, .mov, .webm, .m4v"}
                    </small>
                  </button>
                  <button
                    className="studio-video-selector__custom-action"
                    type="button"
                    aria-label={customVideoFile ? "Заменить видеофайл" : "Загрузить видеофайл"}
                    title={customVideoFile ? "Заменить файл" : "Загрузить файл"}
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
  const initialExamplePrefillRef = useRef(readExamplePrefillIntent());
  const initialStudioEntryIntentRef = useRef(readStudioEntryIntent());
  const preserveExamplePrefillRef = useRef(Boolean(initialExamplePrefillRef.current));
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(defaultTab);
  const [studioView, setStudioView] = useState<StudioView>("create");
  const [createMode, setCreateMode] = useState<StudioCreateMode>("default");
  const [topicInput, setTopicInput] = useState("");
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
  const [selectedMusicType, setSelectedMusicType] = useState<StudioMusicType>("ai");
  const [selectedCustomMusic, setSelectedCustomMusic] = useState<StudioCustomMusicFile | null>(null);
  const [isPreparingCustomMusic, setIsPreparingCustomMusic] = useState(false);
  const [musicSelectionError, setMusicSelectionError] = useState<string | null>(null);
  const [, setStatus] = useState("Ready to generate");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isStudioPreviewInlineActive, setIsStudioPreviewInlineActive] = useState(false);
  const [isStudioPreviewPlaying, setIsStudioPreviewPlaying] = useState(false);
  const [studioPreviewCurrentTime, setStudioPreviewCurrentTime] = useState(0);
  const [studioPreviewDuration, setStudioPreviewDuration] = useState(0);
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
  const [isLocalExamplesEnabled, setIsLocalExamplesEnabled] = useState(false);
  const [isLocalExampleModalOpen, setIsLocalExampleModalOpen] = useState(false);
  const [localExampleSource, setLocalExampleSource] = useState<WorkspaceLocalExampleSource | null>(null);
  const [selectedLocalExampleGoal, setSelectedLocalExampleGoal] = useState<WorkspaceLocalExampleGoal>("stories");
  const [isSavingLocalExample, setIsSavingLocalExample] = useState(false);
  const [localExampleSaveError, setLocalExampleSaveError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [segmentEditorLoadedSession, setSegmentEditorLoadedSession] = useState<WorkspaceSegmentEditorSession | null>(null);
  const [segmentEditorDraft, setSegmentEditorDraft] = useState<WorkspaceSegmentEditorDraftSession | null>(null);
  const [segmentEditorAppliedSession, setSegmentEditorAppliedSession] = useState<WorkspaceSegmentEditorDraftSession | null>(null);
  const [segmentEditorError, setSegmentEditorError] = useState<string | null>(null);
  const [segmentEditorVideoError, setSegmentEditorVideoError] = useState<string | null>(null);
  const [segmentEditorPreviewTimes, setSegmentEditorPreviewTimes] = useState<Record<number, number>>({});
  const [segmentThumbDropInsertIndex, setSegmentThumbDropInsertIndex] = useState<number | null>(null);
  const [segmentThumbDragState, setSegmentThumbDragState] = useState<WorkspaceSegmentThumbDragState | null>(null);
  const [queuedSegmentEditorPlaybackIndex, setQueuedSegmentEditorPlaybackIndex] = useState<number | null>(null);
  const [isSegmentEditorLoading, setIsSegmentEditorLoading] = useState(false);
  const [isSegmentAiPhotoModalOpen, setIsSegmentAiPhotoModalOpen] = useState(false);
  const [segmentAiPhotoModalSegmentIndex, setSegmentAiPhotoModalSegmentIndex] = useState<number | null>(null);
  const [segmentAiPhotoModalPrompt, setSegmentAiPhotoModalPrompt] = useState("");
  const [segmentAiVideoModalPrompt, setSegmentAiVideoModalPrompt] = useState("");
  const [segmentAiPhotoModalTab, setSegmentAiPhotoModalTab] = useState<WorkspaceSegmentVisualModalTab>("ai_video");
  const [isSegmentAiPhotoPromptImproving, setIsSegmentAiPhotoPromptImproving] = useState(false);
  const [isSegmentAiPhotoPromptImproved, setIsSegmentAiPhotoPromptImproved] = useState(false);
  const [isSegmentAiPhotoPromptHighlighted, setIsSegmentAiPhotoPromptHighlighted] = useState(false);
  const [isSegmentEditorGeneratingAiPhoto, setIsSegmentEditorGeneratingAiPhoto] = useState(false);
  const [segmentEditorGeneratingAiPhotoSegmentIndex, setSegmentEditorGeneratingAiPhotoSegmentIndex] = useState<number | null>(null);
  const [isSegmentEditorGeneratingAiVideo, setIsSegmentEditorGeneratingAiVideo] = useState(false);
  const [segmentEditorGeneratingAiVideoSegmentIndex, setSegmentEditorGeneratingAiVideoSegmentIndex] = useState<number | null>(null);
  const [isSegmentEditorGeneratingPhotoAnimation, setIsSegmentEditorGeneratingPhotoAnimation] = useState(false);
  const [segmentEditorGeneratingPhotoAnimationSegmentIndex, setSegmentEditorGeneratingPhotoAnimationSegmentIndex] = useState<number | null>(null);
  const [isSegmentEditorPreparingCustomVideo, setIsSegmentEditorPreparingCustomVideo] = useState(false);
  const [segmentEditorPanelHeightLock, setSegmentEditorPanelHeightLock] = useState<number | null>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [playingSegmentEditorPreviewIndex, setPlayingSegmentEditorPreviewIndex] = useState<number | null>(null);
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectDeleteError, setProjectDeleteError] = useState<string | null>(null);
  const [projectPendingDelete, setProjectPendingDelete] = useState<WorkspaceProject | null>(null);
  const [isProjectDeleteSubmitting, setIsProjectDeleteSubmitting] = useState(false);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [hasLoadedProjects, setHasLoadedProjects] = useState(false);
  const [generatedMediaLibraryEntries, setGeneratedMediaLibraryEntries] = useState<WorkspaceGeneratedMediaLibraryEntry[]>([]);
  const [mediaLibraryItems, setMediaLibraryItems] = useState<WorkspaceMediaLibraryItem[]>([]);
  const [loadedMediaLibraryFingerprint, setLoadedMediaLibraryFingerprint] = useState<string | null>(null);
  const [loadedMediaLibraryReloadToken, setLoadedMediaLibraryReloadToken] = useState(-1);
  const [mediaLibraryError, setMediaLibraryError] = useState<string | null>(null);
  const [isMediaLibraryLoading, setIsMediaLibraryLoading] = useState(false);
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
  const [activeContentPlanId, setActiveContentPlanId] = useState<string | null>(null);
  const [expandedContentPlanUsedIdeasPlanId, setExpandedContentPlanUsedIdeasPlanId] = useState<string | null>(null);
  const [selectedContentPlanIdeaId, setSelectedContentPlanIdeaId] = useState<string | null>(null);
  const [composerSourceIdea, setComposerSourceIdea] = useState<WorkspaceContentPlanComposerSource | null>(null);
  const [activeProjectPreviewId, setActiveProjectPreviewId] = useState<string | null>(null);
  const [projectPreviewModal, setProjectPreviewModal] = useState<WorkspaceProject | null>(null);
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
  const previewModalVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewModalPendingPlaybackRef = useRef<{ immediate?: boolean; resetToStart?: boolean } | null>(null);
  const pendingProjectDeleteIdsRef = useRef<Set<string>>(new Set());
  const promptInnerRef = useRef<HTMLDivElement | null>(null);
  const segmentAiPhotoModalPanelRef = useRef<HTMLFormElement | null>(null);
  const segmentAiPhotoModalFileInputRef = useRef<HTMLInputElement | null>(null);
  const segmentAiPhotoModalTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const segmentAiPhotoPromptHighlightTimerRef = useRef<number | null>(null);
  const segmentAiPhotoPromptImproveRunRef = useRef(0);
  const segmentEditorLanguageTranslateRunRef = useRef(0);
  const resetTimerRef = useRef<number | null>(null);
  const generationRunRef = useRef(0);
  const segmentAiPhotoRunRef = useRef(0);
  const segmentAiVideoRunRef = useRef(0);
  const segmentPhotoAnimationRunRef = useRef(0);
  const segmentEditorRunRef = useRef(0);
  const segmentEditorRequestAbortRef = useRef<AbortController | null>(null);
  const segmentEditorPreviewVideoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
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
  const segmentCarouselDragStateRef = useRef<{
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
  const dismissMediaLibraryItem = useCallback(
    (item: WorkspaceMediaLibraryItem) => {
      const itemKey = getWorkspaceMediaLibraryItemStorageKey(item);

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
  useEffect(() => {
    const nextReferencedUrls = getReferencedStudioObjectUrls({
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
  }, [segmentEditorAppliedSession, segmentEditorDraft, selectedCustomMusic, selectedCustomVideo]);

  useEffect(
    () => () => {
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
    return () => {
      cancelSegmentEditorSyntheticPlayback();
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
      if (segmentCarouselWheelResetTimerRef.current) {
        window.clearTimeout(segmentCarouselWheelResetTimerRef.current);
      }
      segmentCarouselDragStateRef.current = null;
      segmentEditorRequestAbortRef.current?.abort("segment-editor-dispose");
      generationRunRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const pendingExamplePrefill = initialExamplePrefillRef.current;
    if (!pendingExamplePrefill) return;

    setStudioView("create");
    setTopicInput(pendingExamplePrefill.prompt);
    clearExamplePrefillIntent();
    initialExamplePrefillRef.current = null;
  }, []);

  useEffect(() => {
    const pendingStudioEntryIntent = initialStudioEntryIntentRef.current;
    if (!pendingStudioEntryIntent || initialExamplePrefillRef.current) {
      return;
    }

    setActiveTab("studio");
    clearStudioEntryIntent();
    initialStudioEntryIntentRef.current = null;

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
  }, []);

  const isAnyPreviewModalOpen = isPreviewModalOpen || Boolean(projectPreviewModal) || isPublishModalOpen;
  const isAnyWorkspaceModalOpen =
    isAnyPreviewModalOpen || isSegmentAiPhotoModalOpen || isLocalExampleModalOpen || Boolean(projectPendingDelete);

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
    setIsPreviewModalOpen(false);
    setProjectPreviewModal(null);
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

  const closeSegmentAiPhotoModal = () => {
    if (segmentAiPhotoPromptHighlightTimerRef.current) {
      window.clearTimeout(segmentAiPhotoPromptHighlightTimerRef.current);
      segmentAiPhotoPromptHighlightTimerRef.current = null;
    }
    setIsSegmentAiPhotoModalOpen(false);
    setSegmentAiPhotoModalSegmentIndex(null);
    setSegmentAiPhotoModalPrompt("");
    setSegmentAiVideoModalPrompt("");
    setSegmentAiPhotoModalTab("ai_video");
    setIsSegmentAiPhotoPromptImproving(false);
    setIsSegmentAiPhotoPromptImproved(false);
    setIsSegmentAiPhotoPromptHighlighted(false);
  };

  const closeProjectDeleteModal = () => {
    if (isProjectDeleteSubmitting) {
      return;
    }

    setProjectPendingDelete(null);
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
    isAnyWorkspaceModalOpen,
    isLocalExampleModalOpen,
    isPublishModalOpen,
    isSegmentAiPhotoModalOpen,
    projectPendingDelete,
    isProjectDeleteSubmitting,
  ]);

  useEffect(() => {
    if (activeTab !== "studio" && isAnyWorkspaceModalOpen) {
      setProjectPendingDelete(null);
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

  useEffect(() => {
    setProjects([]);
    setProjectsError(null);
    setProjectDeleteError(null);
    setProjectPendingDelete(null);
    setIsProjectDeleteSubmitting(false);
    pendingProjectDeleteIdsRef.current.clear();
    setHasLoadedProjects(false);
    setGeneratedMediaLibraryEntries([]);
    setMediaLibraryItems([]);
    setLoadedMediaLibraryFingerprint(null);
    setLoadedMediaLibraryReloadToken(-1);
    setMediaLibraryError(null);
    setIsMediaLibraryLoading(false);
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
    setSegmentEditorError(null);
    setSegmentEditorVideoError(null);
    setIsSegmentAiPhotoModalOpen(false);
    setSegmentAiPhotoModalSegmentIndex(null);
    setSegmentAiPhotoModalPrompt("");
    segmentAiPhotoRunRef.current += 1;
    setIsSegmentEditorGeneratingAiPhoto(false);
    setSegmentEditorGeneratingAiPhotoSegmentIndex(null);
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
      current && contentPlans.some((plan) => plan.id === current) ? current : contentPlans[0]?.id ?? null,
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
      setCreateMode("default");
      setSegmentEditorVideoError(null);
      setIsSegmentAiPhotoModalOpen(false);
      setSegmentAiPhotoModalSegmentIndex(null);
      setSegmentAiPhotoModalPrompt("");
      setSegmentAiVideoModalPrompt("");
      setIsSegmentAiPhotoPromptImproving(false);
      setIsSegmentAiPhotoPromptImproved(false);
      setIsSegmentAiPhotoPromptHighlighted(false);
      segmentAiPhotoRunRef.current += 1;
      segmentAiVideoRunRef.current += 1;
      segmentPhotoAnimationRunRef.current += 1;
      setIsSegmentEditorGeneratingAiPhoto(false);
      setSegmentEditorGeneratingAiPhotoSegmentIndex(null);
      setIsSegmentEditorGeneratingAiVideo(false);
      setSegmentEditorGeneratingAiVideoSegmentIndex(null);
      setIsSegmentEditorGeneratingPhotoAnimation(false);
      setSegmentEditorGeneratingPhotoAnimationSegmentIndex(null);
      setPlayingSegmentEditorPreviewIndex(null);
      setSegmentEditorPreviewTimes({});
      setQueuedSegmentEditorPlaybackIndex(null);
      setSegmentEditorPanelHeightLock(null);
      return;
    }

    setCreateMode("default");
    setSegmentEditorDraft(null);
    setSegmentEditorVideoError(null);
    setIsSegmentAiPhotoModalOpen(false);
    setSegmentAiPhotoModalSegmentIndex(null);
    setSegmentAiPhotoModalPrompt("");
    segmentAiPhotoRunRef.current += 1;
    setIsSegmentEditorGeneratingAiPhoto(false);
    setSegmentEditorGeneratingAiPhotoSegmentIndex(null);
    setSegmentEditorPreviewTimes({});
    setQueuedSegmentEditorPlaybackIndex(null);
    setSegmentEditorPanelHeightLock(null);
    setActiveSegmentIndex(0);
  }, [activeTab, studioView]);

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
        setActiveSegmentIndex((current) => Math.max(0, current - 1));
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveSegmentIndex((current) => Math.min(segmentEditorDraft.segments.length - 1, current + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createMode, segmentEditorDraft]);

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

    setActiveSegmentIndex((current) =>
      Math.min(segmentEditorDraft.segments.length - 1, Math.max(0, current + direction)),
    );
  };

  const isSegmentCarouselClickSuppressed = () => window.performance.now() < segmentCarouselSuppressClickUntilRef.current;

  const handleSegmentCarouselPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!segmentEditorDraft || segmentEditorDraft.segments.length <= 1) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const interactiveControl = target?.closest("button, input, textarea, label, a") ?? null;
    if (
      target?.closest(".studio-segment-editor__arrow") ||
      (interactiveControl && !interactiveControl.classList.contains("studio-segment-editor__card-hitbox"))
    ) {
      return;
    }

    segmentCarouselDragStateRef.current = {
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
      segmentCarouselSuppressClickUntilRef.current = window.performance.now() + 320;
    }

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
    const shouldNavigate =
      !options?.cancelled && dragState.dragDetected && Math.abs(deltaX) >= 56 && Boolean(segmentEditorDraft);

    if (dragState.dragDetected) {
      event.preventDefault();
      segmentCarouselSuppressClickUntilRef.current = window.performance.now() + 320;
    }

    if (shouldNavigate && segmentEditorDraft) {
      const direction = deltaX < 0 ? 1 : -1;
      setQueuedSegmentEditorPlaybackIndex(null);
      setActiveSegmentIndex((current) =>
        Math.min(segmentEditorDraft.segments.length - 1, Math.max(0, current + direction)),
      );
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

        setIsLocalExamplesEnabled(Boolean(payload?.data?.enabled && response.ok));
      } catch {
        if (!cancelled) {
          setIsLocalExamplesEnabled(false);
        }
      }
    };

    void loadLocalExamplesAvailability();

    return () => {
      cancelled = true;
    };
  }, [session.email]);

  useEffect(() => {
    setIsStudioPreviewInlineActive(false);
    setIsStudioPreviewPlaying(false);
    setStudioPreviewCurrentTime(0);
    setStudioPreviewDuration(0);
  }, [generatedVideo?.id]);

  useEffect(() => {
    setIsLocalExampleModalOpen(false);
    setIsSavingLocalExample(false);
    setLocalExampleSaveError(null);
    setLocalExampleSource(null);
  }, [generatedVideo?.id]);

  useEffect(() => {
    const previewElement = previewVideoRef.current;
    if (!previewElement) return;

    previewElement.volume = studioPreviewVolume;
    const shouldMutePreview = !isStudioPreviewInlineActive || studioPreviewVolume <= 0;
    previewElement.muted = shouldMutePreview;
    previewElement.defaultMuted = shouldMutePreview;
  }, [generatedVideo?.id, isStudioPreviewInlineActive, studioPreviewVolume]);

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
    if (isWorkspaceBootstrapPending) {
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
        setGenerateError(null);
      }
      return;
    }

    const fallbackGeneration = buildStudioGenerationFromProject(fallbackProject);
    if (!fallbackGeneration) {
      return;
    }

    setGeneratedVideo(fallbackGeneration);
    setGenerateError(null);

  }, [failedStudioVideoUrls, generatedVideo?.videoUrl, isWorkspaceBootstrapPending, projects]);

  useEffect(() => {
    const nextPreviewVideoUrl = String(generatedVideo?.videoUrl ?? "").trim() || null;

    if (!nextPreviewVideoUrl) {
      setStudioPreviewPosterUrl(null);
      return;
    }

    const cachedPoster = getProjectPosterCacheValue(nextPreviewVideoUrl);
    if (cachedPoster) {
      setStudioPreviewPosterUrl(cachedPoster);
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
  }, [generatedVideo?.videoUrl]);

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
          current && payload.data?.plans.some((plan) => plan.id === current)
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

  const shouldPrefetchMediaLibrary = activeTab === "studio";

  useEffect(() => {
    if (!shouldPrefetchMediaLibrary) {
      setIsMediaLibraryLoading(false);
      return;
    }

    if (!hasLoadedProjects || isProjectsLoading) {
      const hasPersistedSnapshot = loadedMediaLibraryFingerprint !== null;
      setIsMediaLibraryLoading(!hasPersistedSnapshot);
      if (!hasPersistedSnapshot) {
        setMediaLibraryError(null);
      }
      return;
    }

    if (!mediaLibraryProjects.length) {
      setMediaLibraryItems([]);
      setLoadedMediaLibraryFingerprint(mediaLibraryProjectsFingerprint);
      setLoadedMediaLibraryReloadToken(mediaLibraryReloadToken);
      setMediaLibraryError(null);
      setIsMediaLibraryLoading(false);
      return;
    }

    const shouldBypassMediaLibraryCache = mediaLibraryReloadToken !== loadedMediaLibraryReloadToken;
    const shouldFetchMediaLibrary =
      shouldBypassMediaLibraryCache || loadedMediaLibraryFingerprint !== mediaLibraryProjectsFingerprint;

    if (!shouldFetchMediaLibrary) {
      setIsMediaLibraryLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort("media-library-timeout"), MEDIA_LIBRARY_REQUEST_TIMEOUT_MS);
    setIsMediaLibraryLoading(true);
    setMediaLibraryError(null);

    const loadMediaLibrary = async () => {
      try {
        const requestUrl = shouldBypassMediaLibraryCache ? "/api/workspace/media-library?reload=1" : "/api/workspace/media-library";
        const response = await fetch(requestUrl, {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as WorkspaceMediaLibraryResponse | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error ?? "Не удалось загрузить медиатеку.");
        }

        if (cancelled) {
          return;
        }

        setMediaLibraryItems(payload.data.items);
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
    shouldPrefetchMediaLibrary,
  ]);

  const header = tabCopy[activeTab];
  const sectionTitleId = header.heading ? "account-shell-title" : undefined;
  const workspacePlan = normalizeWorkspacePlan(workspaceProfile?.plan);
  const workspacePlanLabel = workspacePlan ?? "…";
  const workspaceBalance = normalizeWorkspaceBalance(workspaceProfile?.balance);
  const workspaceCanPurchaseCreditPacks = workspacePlan === "PRO" || workspacePlan === "ULTRA";
  const workspaceBillingDescription = workspaceCanPurchaseCreditPacks
    ? `На тарифе ${workspacePlanLabel} можно докупать кредиты пакетами.`
    : "Покупка дополнительных кредитов доступна только на тарифах PRO и ULTRA.";
  const workspaceCreditPackActionLabel = workspaceCanPurchaseCreditPacks
    ? "Открыть пакеты кредитов"
    : "Перейти на PRO или ULTRA";
  const workspaceCreditPackNote = workspaceCanPurchaseCreditPacks
    ? "Пакеты пополняют текущий баланс и не меняют сам тариф."
    : "Сначала нужен активный тариф PRO или ULTRA, после этого откроется докупка пакетов.";
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
  const previewModalHashtags = isProjectPreviewModalOpen ? projectPreviewModal?.hashtags ?? [] : generatedVideoHashtags;
  const generatedVideoPlaybackUrl = String(generatedVideo?.videoUrl ?? "").trim() || null;
  const generatedVideoDismissKey = getStudioPreviewDismissKey(generatedVideo);
  const isGeneratedVideoDismissed = Boolean(generatedVideoDismissKey) && dismissedStudioPreviewKey === generatedVideoDismissKey;
  const visibleGeneratedVideo = isGeneratedVideoDismissed ? null : generatedVideo;
  const visibleGeneratedVideoPlaybackUrl = isGeneratedVideoDismissed ? null : generatedVideoPlaybackUrl;
  const canSaveGeneratedVideoToLocalExamples = isLocalExamplesEnabled && Boolean(generatedVideoPlaybackUrl);
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
  const studioInlinePreviewDownloadName = getVideoDownloadName(generatedVideoModalTitle);
  const previewModalProject = isProjectPreviewModalOpen ? projectPreviewModal : null;
  const canEditPreviewModalProject = Boolean(previewModalProject?.adId);
  const canPublishPreviewModalProject = Boolean(previewModalProject?.adId);
  const canAddPreviewModalProjectToExamples = isLocalExamplesEnabled && Boolean(previewModalProject?.videoUrl);
  const isPreviewModalProjectActionBusy = isSegmentEditorLoading || isSavingLocalExample;
  const hasPreviewModalDescription = Boolean(previewModalDescription);
  const hasPreviewModalHashtags = previewModalHashtags.length > 0;
  const selectedVoiceOptions = studioVoiceOptionsByLanguage[selectedLanguage];
  const resolvedSelectedVoiceId =
    selectedVoiceOptions.find((voice) => voice.id === selectedVoiceId)?.id ?? selectedVoiceOptions[0]?.id ?? "";
  const isCurrentDraftSubtitleDisabled = normalizeWorkspaceSegmentEditorSetting(segmentEditorDraft?.subtitleType) === "none";
  const isCurrentDraftVoiceDisabled = normalizeWorkspaceSegmentEditorSetting(segmentEditorDraft?.voiceType) === "none";
  const readyProjectsCount = projects.filter((project) => project.status === "ready").length;
  const activeProjectsCount = projects.filter(
    (project) => project.status === "queued" || project.status === "processing",
  ).length;
  const failedProjectsCount = projects.filter((project) => project.status === "failed").length;
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
          return [nextEntry, ...currentEntries];
        }

        const nextEntries = [...currentEntries];
        nextEntries[existingEntryIndex] = {
          ...nextEntry,
          createdAt: currentEntries[existingEntryIndex]?.createdAt ?? nextEntry.createdAt,
        };
        return nextEntries;
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
    const itemsByKey = new Map<string, WorkspaceMediaLibraryItem>();

    [...liveMediaLibraryItems, ...draftMediaLibraryItems, ...mediaLibraryItems].forEach((item) => {
      if (!itemsByKey.has(item.dedupeKey)) {
        itemsByKey.set(item.dedupeKey, item);
      }
    });

    return Array.from(itemsByKey.values());
  }, [draftMediaLibraryItems, liveMediaLibraryItems, mediaLibraryItems]);
  const hiddenMediaLibraryItemKeySet = useMemo(() => new Set(hiddenMediaLibraryItemKeys), [hiddenMediaLibraryItemKeys]);
  const visibleMediaLibraryItems = useMemo(
    () =>
      resolvedMediaLibraryItems.filter((item) => !hiddenMediaLibraryItemKeySet.has(getWorkspaceMediaLibraryItemStorageKey(item))),
    [hiddenMediaLibraryItemKeySet, resolvedMediaLibraryItems],
  );
  const visibleAiPhotoMediaItemsCount = visibleMediaLibraryItems.filter((item) => item.kind === "ai_photo").length;
  const visibleAiVideoMediaItemsCount = visibleMediaLibraryItems.filter((item) => item.kind === "ai_video").length;
  const visiblePhotoAnimationMediaItemsCount = visibleMediaLibraryItems.filter((item) => item.kind === "photo_animation").length;
  const segmentEditorSegmentCount = segmentEditorDraft?.segments.length ?? 0;
  const activeSegment = segmentEditorDraft?.segments[activeSegmentIndex] ?? null;
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
    isSegmentEditorGeneratingPhotoAnimation;
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
  const segmentAiPhotoModalScenarioPrompt = segmentAiPhotoModalSegment ? getWorkspaceSegmentAiPhotoPromptPrefill(segmentAiPhotoModalSegment) : "";
  const segmentAiPhotoModalSegmentNumber =
    segmentEditorDraft && segmentAiPhotoModalSegment
      ? getWorkspaceSegmentEditorDisplayNumber(segmentEditorDraft.segments, segmentAiPhotoModalSegment.index)
      : null;
  const normalizedSegmentAiPhotoModalPrompt = normalizeWorkspaceSegmentAiPhotoPrompt(segmentAiPhotoModalPrompt);
  const normalizedSegmentAiVideoModalPrompt = normalizeWorkspaceSegmentAiVideoPrompt(segmentAiVideoModalPrompt);
  const isSegmentAiPhotoModalAiReady = Boolean(
    segmentAiPhotoModalSegment?.aiPhotoAsset &&
      normalizeWorkspaceSegmentAiPhotoPrompt(segmentAiPhotoModalSegment.aiPhotoGeneratedFromPrompt) === normalizedSegmentAiPhotoModalPrompt,
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
    isReady = false,
  }: {
    isBusy?: boolean;
    isReady?: boolean;
  }) =>
    isBusy
      ? { label: "Идет", tone: "processing" as const }
      : isReady
        ? { label: "Готово", tone: "ready" as const }
        : null;
  const canAnimateSegmentPhoto = segmentAiPhotoModalSegment?.mediaType === "photo";
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
  const segmentAiPhotoModalPreviewKind = segmentAiPhotoModalSegment
    ? getWorkspaceSegmentPreviewKind(segmentAiPhotoModalSegment)
    : "video";
  const segmentAiPhotoModalPreviewPosterUrl = segmentAiPhotoModalSegment
    ? getWorkspaceSegmentDraftPreviewUrl(segmentAiPhotoModalSegment)
    : null;
  const segmentAiPhotoModalFallbackPosterUrl = segmentAiPhotoModalSegment
    ? getWorkspaceSegmentDraftFallbackPosterUrl(segmentAiPhotoModalSegment)
    : null;
  const segmentAiPhotoModalPreviewUrl = segmentAiPhotoModalSegment
    ? segmentAiPhotoModalPreviewKind === "image"
      ? segmentAiPhotoModalPreviewPosterUrl
      : getWorkspaceSegmentDraftVideoUrl(segmentAiPhotoModalSegment)
    : null;
  const segmentAiPhotoModalSourceBaseLabel = segmentAiPhotoModalSegment
    ? getWorkspaceSegmentDraftSourceLabel(segmentAiPhotoModalSegment)
    : "Сток";
  const segmentAiPhotoModalSourceLabel =
    segmentAiPhotoModalSourceBaseLabel === "ИИ фото" ? "Фото" : segmentAiPhotoModalSourceBaseLabel;
  const segmentAiPhotoModalFormatLabel = segmentAiPhotoModalPreviewKind === "image" ? "Фото" : "Видео";
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
  const segmentAiPhotoModalLibraryStatus = createSegmentAiPhotoModalStatus({
    isBusy: isMediaLibraryLoading && segmentAiPhotoModalLibraryItems.length === 0,
    isReady: hasSegmentAiPhotoModalLibrarySelection,
  });
  const segmentAiPhotoModalUploadStatus = createSegmentAiPhotoModalStatus({
    isBusy: isSegmentEditorPreparingCustomVideo,
    isReady: hasSegmentAiPhotoModalCustomFile,
  });
  const segmentAiPhotoModalActiveStatus =
    segmentAiPhotoModalTab === "ai_video"
      ? segmentAiPhotoModalAiVideoStatus
      : segmentAiPhotoModalTab === "photo_animation"
        ? segmentAiPhotoModalPhotoAnimationStatus
        : segmentAiPhotoModalTab === "library"
          ? segmentAiPhotoModalLibraryStatus
          : segmentAiPhotoModalTab === "upload"
            ? segmentAiPhotoModalUploadStatus
            : segmentAiPhotoModalAiPhotoStatus;
  const canImproveSegmentAiPhotoPrompt = Boolean(
    normalizedSegmentAiPhotoModalPrompt || normalizeWorkspaceSegmentAiPhotoPrompt(segmentAiPhotoModalScenarioPrompt),
  );
  const canImproveSegmentAiVideoPrompt = Boolean(
    normalizedSegmentAiVideoModalPrompt || normalizeWorkspaceSegmentAiVideoPrompt(segmentAiPhotoModalScenarioPrompt),
  );
  const segmentAiPhotoModalTimeLabel = segmentAiPhotoModalSegment
    ? `${formatWorkspaceSegmentEditorTime(getWorkspaceSegmentEditorDisplayStartTime(segmentAiPhotoModalSegment))} - ${formatWorkspaceSegmentEditorTime(
        getWorkspaceSegmentEditorDisplayEndTime(segmentAiPhotoModalSegment),
        {
          roundUp: true,
        },
      )}`
    : "";
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
  const activeSegmentMediaUrl = activeSegment
    ? getWorkspaceSegmentPreviewKind(activeSegment) === "image"
      ? getWorkspaceSegmentDraftPreviewUrl(activeSegment)
      : getWorkspaceSegmentDraftVideoUrl(activeSegment)
    : null;
  const studioSidebarActiveItem =
    studioView === "projects" ? "projects" : studioView === "media" ? "media" : createMode === "segment-editor" ? "edit" : "create";
  const shouldShowStudioSidebar = isSegmentEditorPageActive;
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
  const resetSegmentEditorPreviewPlaybackState = () => {
    cancelSegmentEditorSyntheticPlayback();
    setPlayingSegmentEditorPreviewIndex(null);
    setQueuedSegmentEditorPlaybackIndex(null);
    setSegmentEditorPreviewTimes({});
  };
  const moveSegmentEditorThumb = (fromIndex: number, insertIndex: number) => {
    if (!segmentEditorDraft) {
      return;
    }

    const nextSegments = moveArrayItemToInsertIndex(segmentEditorDraft.segments, fromIndex, insertIndex);
    if (nextSegments === segmentEditorDraft.segments) {
      return;
    }

    const activeSegmentStableIndex = segmentEditorDraft.segments[activeSegmentIndex]?.index ?? null;
    const nextActiveSegmentIndex =
      activeSegmentStableIndex === null
        ? Math.max(0, Math.min(insertIndex, nextSegments.length - 1))
        : nextSegments.findIndex((segment) => segment.index === activeSegmentStableIndex);

    resetSegmentEditorPreviewPlaybackState();
    setSegmentEditorVideoError(null);
    setSegmentEditorDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            segments: moveArrayItemToInsertIndex(currentDraft.segments, fromIndex, insertIndex),
          }
        : currentDraft,
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

      if (isDragActive && !options?.cancelled) {
        event.preventDefault();
        updateSegmentThumbPointerDrag(event.clientX, event.clientY, segmentArrayIndex);
        const finalInsertIndex = resolveSegmentThumbInsertIndexFromClientX(event.clientX, segmentArrayIndex);
        moveSegmentEditorThumb(segmentArrayIndex, finalInsertIndex);
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
  const segmentEditorPromptInnerStyle: CSSProperties | undefined =
    createMode === "segment-editor" && segmentEditorPanelHeightLock
      ? {
          height: `${segmentEditorPanelHeightLock}px`,
          minHeight: `${segmentEditorPanelHeightLock}px`,
          maxHeight: `${segmentEditorPanelHeightLock}px`,
        }
      : undefined;

  useEffect(() => {
    if (createMode !== "segment-editor" || (isSegmentAiPhotoModalOpen && !segmentAiPhotoModalSegment)) {
      setIsSegmentAiPhotoModalOpen(false);
      setSegmentAiPhotoModalSegmentIndex(null);
      setSegmentAiPhotoModalPrompt("");
    }
  }, [createMode, isSegmentAiPhotoModalOpen, segmentAiPhotoModalSegment]);

  useLayoutEffect(() => {
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

    cancelSegmentEditorSyntheticPlayback();
    Object.values(segmentEditorPreviewVideoRefs.current).forEach((element) => {
      if (!element) return;

      element.pause();

      try {
        element.currentTime = 0;
      } catch {
        // Ignore reset errors while metadata is still loading.
      }
    });

    setQueuedSegmentEditorPlaybackIndex(null);
    setPlayingSegmentEditorPreviewIndex(null);
    setSegmentEditorPreviewTimes({});

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [isSegmentAiPhotoModalOpen]);

  useEffect(() => {
    cancelSegmentEditorSyntheticPlayback();
    Object.values(segmentEditorPreviewVideoRefs.current).forEach((element) => {
      if (!element) return;

      element.muted = true;
      element.defaultMuted = true;
      element.pause();

      try {
        element.currentTime = 0;
      } catch {
        // Ignore reset errors while metadata is still loading.
      }
    });

    setPlayingSegmentEditorPreviewIndex(null);
    setSegmentEditorPreviewTimes({});
  }, [activeSegmentIndex, activeSegmentMediaUrl, createMode]);

  useEffect(() => {
    if (createMode !== "segment-editor") {
      return;
    }

    const queuedSegment = activeSegment?.index === queuedSegmentEditorPlaybackIndex ? activeSegment : null;

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
    if (element.preload !== "auto") {
      element.preload = "auto";
    }
    element.load();

    return () => {
      cancelled = true;
      element.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [activeSegment, activeSegmentIndex, createMode, queuedSegmentEditorPlaybackIndex]);

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
      setVideoSelectionError("Поддерживаются только .mp4, .mov, .webm и .m4v.");
      return;
    }

    if (file.size > STUDIO_CUSTOM_VIDEO_MAX_BYTES) {
      setVideoSelectionError("Видеофайл слишком большой. Максимум 48 МБ.");
      return;
    }

    setIsPreparingCustomVideo(true);
    setVideoSelectionError(null);

    try {
      setSelectedCustomVideo({
        file,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "video/mp4",
        objectUrl: createStudioObjectUrl(file),
      });
      setSelectedVideoMode("custom");
    } catch (error) {
      setVideoSelectionError(error instanceof Error ? error.message : "Не удалось подготовить видеофайл.");
    } finally {
      setIsPreparingCustomVideo(false);
    }
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

  const lockSegmentEditorPromptHeight = () => {
    const nextPromptHeight = promptInnerRef.current?.getBoundingClientRect().height ?? 0;
    setSegmentEditorPanelHeightLock(nextPromptHeight > 0 ? Math.ceil(nextPromptHeight) : null);
  };

  const openSegmentEditorWithDraft = (
    nextDraft: WorkspaceSegmentEditorDraftSession,
    options?: { initialSegmentIndex?: number },
  ) => {
    lockSegmentEditorPromptHeight();
    setSegmentEditorDraft(cloneWorkspaceSegmentEditorDraftSession(nextDraft));
    setSegmentEditorVideoError(null);
    segmentAiPhotoRunRef.current += 1;
    setIsSegmentEditorGeneratingAiPhoto(false);
    setSegmentEditorPreviewTimes({});
    setQueuedSegmentEditorPlaybackIndex(null);
    setPlayingSegmentEditorPreviewIndex(null);
    const boundedSegmentIndex = Math.max(
      0,
      Math.min(options?.initialSegmentIndex ?? 0, Math.max(0, nextDraft.segments.length - 1)),
    );
    setActiveSegmentIndex(boundedSegmentIndex);
    setCreateMode("segment-editor");
  };

  const ensureSegmentEditorDraftForProject = async (
    projectId: number,
    options?: { initialSegmentIndex?: number; openDraft?: boolean },
  ) => {
    setSegmentEditorError(null);
    setSegmentEditorVideoError(null);

    if (segmentEditorDraft?.projectId === projectId) {
      if (options?.openDraft !== false) {
        openSegmentEditorWithDraft(segmentEditorDraft, { initialSegmentIndex: options?.initialSegmentIndex });
      }
      return segmentEditorDraft;
    }

    if (currentAppliedSegmentEditorSession?.projectId === projectId) {
      if (options?.openDraft !== false) {
        openSegmentEditorWithDraft(currentAppliedSegmentEditorSession, { initialSegmentIndex: options?.initialSegmentIndex });
      }
      return currentAppliedSegmentEditorSession;
    }

    if (segmentEditorLoadedSession?.projectId === projectId) {
      const nextDraft = createWorkspaceSegmentEditorDraftSession(segmentEditorLoadedSession);
      if (options?.openDraft !== false) {
        openSegmentEditorWithDraft(nextDraft, { initialSegmentIndex: options?.initialSegmentIndex });
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
      const response = await fetch(`/api/workspace/projects/${projectId}/segment-editor`, {
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as WorkspaceSegmentEditorResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Не удалось загрузить сегменты проекта.");
      }

      if (segmentEditorRunRef.current !== runId) {
        return;
      }

      const normalizedSession = normalizeWorkspaceSegmentEditorSession(payload.data);
      setSegmentEditorLoadedSession(normalizedSession);
      const nextDraft = createWorkspaceSegmentEditorDraftSession(normalizedSession);
      if (options?.openDraft !== false) {
        openSegmentEditorWithDraft(nextDraft, { initialSegmentIndex: options?.initialSegmentIndex });
      }
      return nextDraft;
    } catch (error) {
      if (controller.signal.aborted) {
        if (controller.signal.reason === "segment-editor-timeout" && segmentEditorRunRef.current === runId) {
          setSegmentEditorError("Сегменты загружаются слишком долго. Попробуйте ещё раз.");
        }

        return null;
      }

      if (segmentEditorRunRef.current !== runId) {
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : "Не удалось открыть редактор Shorts.";
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
      setQueuedSegmentEditorPlaybackIndex(null);
      setPlayingSegmentEditorPreviewIndex(null);
      setSegmentEditorPreviewTimes({});
      setCreateMode("default");
      return;
    }

    if (segmentEditorDraft) {
      lockSegmentEditorPromptHeight();
      setCreateMode("segment-editor");
      return;
    }

    await handleOpenSegmentEditor();
  };

  const handleStudioTopMenuSelect = (section: StudioEntryIntentSection) => {
    setActiveTab("studio");

    if (section === "projects") {
      setStudioView("projects");
      return;
    }

    if (section === "media") {
      setStudioView("media");
      return;
    }

    setStudioView("create");

    if (section === "edit") {
      void handleStudioCreateModeSwitch("segment-editor");
      return;
    }

    void handleStudioCreateModeSwitch("default");
  };

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
        return currentDraft;
      }

      return updater(currentDraft);
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
    resetSegmentEditorPreviewPlaybackState();
    setSegmentEditorVideoError(null);
    updateSegmentEditorDraft((currentDraft) => {
      if (currentDraft.segments.length >= WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS) {
        return currentDraft;
      }

      const boundedInsertIndex = currentDraft.segments.length;
      const sourceSegment = currentDraft.segments[currentDraft.segments.length - 1] ?? null;
      const nextSegment = createWorkspaceSegmentEditorInsertedSegment({
        draft: currentDraft,
        insertAt: boundedInsertIndex,
        sourceSegment,
      });

      return {
        ...currentDraft,
        segments: [
          ...currentDraft.segments.slice(0, boundedInsertIndex),
          nextSegment,
          ...currentDraft.segments.slice(boundedInsertIndex),
        ],
      };
    });
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

    resetSegmentEditorPreviewPlaybackState();
    setSegmentEditorVideoError(null);
    if (segmentAiPhotoModalSegmentIndex === targetSegment.index) {
      closeSegmentAiPhotoModal();
    }

    updateSegmentEditorDraft((currentDraft) => {
      if (currentDraft.segments.length <= WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        segments: currentDraft.segments.filter((segment) => segment.index !== targetSegment.index),
      };
    });
    setActiveSegmentIndex((current) => {
      const boundedCurrentIndex = Math.max(0, Math.min(current, segmentEditorDraft.segments.length - 1));
      if (boundedCurrentIndex > targetSegmentArrayIndex) {
        return boundedCurrentIndex - 1;
      }

      if (boundedCurrentIndex === targetSegmentArrayIndex) {
        return Math.max(0, Math.min(targetSegmentArrayIndex, segmentEditorDraft.segments.length - 2));
      }

      return boundedCurrentIndex;
    });
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
      updateSegmentEditorDraft((currentDraft) => ({
        ...currentDraft,
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
    const nextSegments = isStructureChanged
      ? cloneWorkspaceSegmentEditorDraftSession(baselineSession).segments
      : reorderWorkspaceSegmentEditorSegmentsByIndex(
          segmentEditorDraft.segments,
          baselineSession.segments.map((segment) => segment.index),
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
            segments:
              currentDraft.segments.length !== baselineSession.segments.length
                ? cloneWorkspaceSegmentEditorDraftSession(baselineSession).segments
                : reorderWorkspaceSegmentEditorSegmentsByIndex(
                    currentDraft.segments,
                    baselineSession.segments.map((segment) => segment.index),
                  ),
          }
        : currentDraft,
    );
    setActiveSegmentIndex(nextActiveSegmentIndex >= 0 ? nextActiveSegmentIndex : 0);
  };

  const openSegmentAiPhotoModal = (segmentArrayIndex: number, segment: WorkspaceSegmentEditorDraftSegment) => {
    setSegmentEditorVideoError(null);
    setActiveSegmentIndex(segmentArrayIndex);
    setSegmentAiPhotoModalSegmentIndex(segment.index);
    setSegmentAiPhotoModalPrompt(
      segment.aiPhotoPromptInitialized ? segment.aiPhotoPrompt : getWorkspaceSegmentAiPhotoPromptPrefill(segment),
    );
    setSegmentAiVideoModalPrompt(
      segment.aiVideoPromptInitialized ? segment.aiVideoPrompt : getWorkspaceSegmentAiVideoPromptPrefill(segment),
    );
    setSegmentAiPhotoModalTab(
      segment.videoAction === "custom"
        ? segment.customVideo?.source === "media-library"
          ? "library"
          : "upload"
        : segment.videoAction === "ai_photo"
          ? "ai_photo"
          : segment.videoAction === "photo_animation" && segment.mediaType === "photo"
            ? "photo_animation"
            : "ai_video",
    );
    setIsSegmentAiPhotoPromptImproving(false);
    setIsSegmentAiPhotoPromptImproved(false);
    setIsSegmentAiPhotoPromptHighlighted(false);
    setIsSegmentAiPhotoModalOpen(true);
  };

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

  const cancelPendingSegmentPhotoAnimationRun = (targetSegmentIndex: number) => {
    if (segmentEditorGeneratingPhotoAnimationSegmentIndex !== targetSegmentIndex) {
      return;
    }

    segmentPhotoAnimationRunRef.current += 1;
    setIsSegmentEditorGeneratingPhotoAnimation(false);
    setSegmentEditorGeneratingPhotoAnimationSegmentIndex(null);
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
      cancelPendingSegmentPhotoAnimationRun(targetSegmentIndex);
      updateSegmentEditorDraftSegmentByIndex(targetSegmentIndex, (segment) => ({
        ...segment,
        customVideo: {
          file,
          fileName: file.name,
          fileSize: file.size,
          mimeType: getWorkspaceSegmentCustomVisualMimeType(file),
          objectUrl: createStudioObjectUrl(file),
          source: "upload",
        },
        videoAction: "custom",
      }));
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
    cancelPendingSegmentPhotoAnimationRun(targetSegmentIndex);
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

  const handleSegmentEditorVisualReset = () => {
    setSegmentEditorVideoError(null);
    if (activeSegment?.index !== undefined) {
      cancelPendingSegmentAiPhotoRun(activeSegment.index);
      cancelPendingSegmentAiVideoRun(activeSegment.index);
      cancelPendingSegmentPhotoAnimationRun(activeSegment.index);
    }
    updateActiveSegmentDraft((segment) => ({
      ...segment,
      videoAction: "original",
    }));
  };

  const resetSegmentEditorVisualByIndex = (targetSegmentIndex: number) => {
    setSegmentEditorVideoError(null);
    cancelPendingSegmentAiPhotoRun(targetSegmentIndex);
    cancelPendingSegmentAiVideoRun(targetSegmentIndex);
    cancelPendingSegmentPhotoAnimationRun(targetSegmentIndex);
    cancelPendingSegmentPhotoAnimationRun(targetSegmentIndex);
    updateSegmentEditorDraftSegmentByIndex(targetSegmentIndex, (segment) => ({
      ...segment,
      videoAction: "original",
    }));
  };

  const getInvalidAiVideoSegmentIndex = (draft: WorkspaceSegmentEditorDraftSession) =>
    draft.segments.findIndex((segment) => {
      if (segment.videoAction !== "ai") {
        return false;
      }

      const normalizedPrompt = normalizeWorkspaceSegmentAiVideoPrompt(segment.aiVideoPrompt);
      if (!normalizedPrompt) {
        return true;
      }

      return !isWorkspaceSegmentAiVideoReady(segment, "ai_video");
    });

  const getAiVideoSegmentValidationMessage = (segment: WorkspaceSegmentEditorDraftSegment) => {
    const segmentNumber = segmentEditorDraft
      ? getWorkspaceSegmentEditorDisplayNumber(segmentEditorDraft.segments, segment.index)
      : segment.index + 1;
    const normalizedPrompt = normalizeWorkspaceSegmentAiVideoPrompt(segment.aiVideoPrompt);

    if (!normalizedPrompt) {
      return `Введите промт для ИИ видео в сегменте ${segmentNumber}.`;
    }

    if (!segment.aiVideoAsset || segment.aiVideoGeneratedMode !== "ai_video") {
      return `Сгенерируйте ИИ видео для сегмента ${segmentNumber}.`;
    }

    return `Промт ИИ видео в сегменте ${segmentNumber} изменился. Сгенерируйте видео заново.`;
  };

  const getInvalidPhotoAnimationSegmentIndex = (draft: WorkspaceSegmentEditorDraftSession) =>
    draft.segments.findIndex((segment) => {
      if (segment.videoAction !== "photo_animation") {
        return false;
      }

      const normalizedPrompt = normalizeWorkspaceSegmentAiVideoPrompt(segment.aiVideoPrompt);
      if (!normalizedPrompt) {
        return true;
      }

      if (segment.mediaType !== "photo") {
        return true;
      }

      return !isWorkspaceSegmentAiVideoReady(segment, "photo_animation");
    });

  const getPhotoAnimationSegmentValidationMessage = (segment: WorkspaceSegmentEditorDraftSegment) => {
    const segmentNumber = segmentEditorDraft
      ? getWorkspaceSegmentEditorDisplayNumber(segmentEditorDraft.segments, segment.index)
      : segment.index + 1;
    const normalizedPrompt = normalizeWorkspaceSegmentAiVideoPrompt(segment.aiVideoPrompt);

    if (segment.mediaType !== "photo") {
      return `ИИ анимация фото доступна только для фото-сегментов.`;
    }

    if (!normalizedPrompt) {
      return `Введите промт для ИИ анимации фото в сегменте ${segmentNumber}.`;
    }

    if (!segment.aiVideoAsset || segment.aiVideoGeneratedMode !== "photo_animation") {
      return `Сгенерируйте ИИ анимацию фото для сегмента ${segmentNumber}.`;
    }

    return `Промт ИИ анимации фото в сегменте ${segmentNumber} изменился. Сгенерируйте анимацию заново.`;
  };

  const getInvalidAiPhotoSegmentIndex = (draft: WorkspaceSegmentEditorDraftSession) =>
    draft.segments.findIndex((segment) => {
      if (segment.videoAction !== "ai_photo") {
        return false;
      }

      const normalizedPrompt = normalizeWorkspaceSegmentAiPhotoPrompt(segment.aiPhotoPrompt);
      if (!normalizedPrompt) {
        return true;
      }

      return !isWorkspaceSegmentAiPhotoReady(segment);
    });

  const getAiPhotoSegmentValidationMessage = (segment: WorkspaceSegmentEditorDraftSegment) => {
    const segmentNumber = segmentEditorDraft
      ? getWorkspaceSegmentEditorDisplayNumber(segmentEditorDraft.segments, segment.index)
      : segment.index + 1;
    const normalizedPrompt = normalizeWorkspaceSegmentAiPhotoPrompt(segment.aiPhotoPrompt);

    if (!normalizedPrompt) {
      return `Введите промт для ИИ фото в сегменте ${segmentNumber}.`;
    }

    if (!segment.aiPhotoAsset) {
      return `Сгенерируйте ИИ фото для сегмента ${segmentNumber}.`;
    }

    return `Промт ИИ фото в сегменте ${segmentNumber} изменился. Сгенерируйте фото заново.`;
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
        if (Date.now() - startedAt >= WORKSPACE_SEGMENT_GENERATION_JOB_TIMEOUT_MS) {
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
        if (Date.now() - startedAt >= WORKSPACE_SEGMENT_GENERATION_JOB_TIMEOUT_MS) {
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
          updateSegmentEditorDraftSegmentByIndex(options.segmentIndex, (segment) => ({
            ...segment,
            aiVideoAsset: payload.data!.asset!,
            aiVideoGeneratedMode: "ai_video",
            aiVideoGeneratedFromPrompt: options.prompt,
            aiVideoPrompt: options.prompt,
            aiVideoPromptInitialized: true,
            videoAction: "ai",
          }));
          upsertGeneratedMediaLibraryEntry({
            asset: payload.data.asset,
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
      prompt: string;
      runId: number;
      segmentIndex: number;
    },
  ) => {
    const safeJobId = jobId.trim();

    if (!safeJobId) {
      throw new Error("Не удалось запустить задачу ИИ анимации фото.");
    }

    let latestStatus = initialStatus;
    const startedAt = Date.now();

    try {
      while (segmentPhotoAnimationRunRef.current === options.runId) {
        if (Date.now() - startedAt >= WORKSPACE_SEGMENT_GENERATION_JOB_TIMEOUT_MS) {
          throw new Error("ИИ анимация фото генерируется слишком долго. Попробуйте запустить ещё раз.");
        }

        const response = await fetch(`/api/studio/segment-photo-animation/jobs/${encodeURIComponent(safeJobId)}`);
        const payload = (await response.json().catch(() => null)) as WorkspaceSegmentAiVideoJobStatusResponse | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error ?? "Не удалось получить статус ИИ анимации фото.");
        }

        if (segmentPhotoAnimationRunRef.current !== options.runId) {
          return;
        }

        latestStatus = normalizeWorkspaceSegmentGenerationJobStatus(payload.data.status);
        applyWorkspaceProfile(payload.data.profile);

        if (payload.data.asset) {
          updateSegmentEditorDraftSegmentByIndex(options.segmentIndex, (segment) => ({
            ...segment,
            aiVideoAsset: payload.data!.asset!,
            aiVideoGeneratedMode: "photo_animation",
            aiVideoGeneratedFromPrompt: options.prompt,
            aiVideoPrompt: options.prompt,
            aiVideoPromptInitialized: true,
            videoAction: "photo_animation",
          }));
          upsertGeneratedMediaLibraryEntry({
            asset: payload.data.asset,
            kind: "photo_animation",
            projectId: segmentEditorDraft?.projectId ?? 0,
            segmentIndex: options.segmentIndex,
            sourceJobId: safeJobId,
          });
          return;
        }

        if (isWorkspaceSegmentGenerationJobFailedStatus(latestStatus)) {
          throw new Error(payload.data.error ?? "Не удалось анимировать фото сегмента.");
        }

        if (isWorkspaceSegmentGenerationJobDoneStatus(latestStatus)) {
          throw new Error(payload.data.error ?? "Сгенерированная ИИ анимация фото недоступна.");
        }

        await new Promise((resolve) => window.setTimeout(resolve, latestStatus === "queued" ? 1500 : 2200));
      }
    } finally {
      if (segmentPhotoAnimationRunRef.current === options.runId) {
        setIsSegmentEditorGeneratingPhotoAnimation(false);
        setSegmentEditorGeneratingPhotoAnimationSegmentIndex(null);
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

    cancelPendingSegmentAiVideoRun(targetSegmentIndex);

    if (options?.shouldCloseModal) {
      closeSegmentAiPhotoModal();
    }

    const runId = segmentAiPhotoRunRef.current + 1;
    segmentAiPhotoRunRef.current = runId;
    setIsSegmentEditorGeneratingAiPhoto(true);
    setSegmentEditorGeneratingAiPhotoSegmentIndex(targetSegmentIndex);
    setSegmentEditorVideoError(null);

    let pollStarted = false;

    try {
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
        navigate("/pricing");
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

    cancelPendingSegmentAiPhotoRun(targetSegmentIndex);
    cancelPendingSegmentPhotoAnimationRun(targetSegmentIndex);

    if (options?.shouldCloseModal) {
      closeSegmentAiPhotoModal();
    }

    const runId = segmentAiVideoRunRef.current + 1;
    segmentAiVideoRunRef.current = runId;
    setIsSegmentEditorGeneratingAiVideo(true);
    setSegmentEditorGeneratingAiVideoSegmentIndex(targetSegmentIndex);
    setSegmentEditorVideoError(null);

    let pollStarted = false;

    try {
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
        navigate("/pricing");
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
      setSegmentEditorVideoError("Введите промт для ИИ анимации фото.");
      return;
    }

    if (targetSegment?.mediaType !== "photo") {
      setSegmentEditorVideoError("ИИ анимация фото доступна только для фото-сегментов.");
      return;
    }

    updateSegmentEditorDraftSegmentByIndex(targetSegmentIndex, (segment) => ({
      ...segment,
      aiVideoPrompt: nextPrompt,
      aiVideoPromptInitialized: true,
      videoAction: "photo_animation",
    }));

    cancelPendingSegmentAiPhotoRun(targetSegmentIndex);
    cancelPendingSegmentAiVideoRun(targetSegmentIndex);

    if (options?.shouldCloseModal) {
      closeSegmentAiPhotoModal();
    }

    const runId = segmentPhotoAnimationRunRef.current + 1;
    segmentPhotoAnimationRunRef.current = runId;
    setIsSegmentEditorGeneratingPhotoAnimation(true);
    setSegmentEditorGeneratingPhotoAnimationSegmentIndex(targetSegmentIndex);
    setSegmentEditorVideoError(null);

    let pollStarted = false;

    try {
      const response = await fetch("/api/studio/segment-photo-animation/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: selectedLanguage,
          projectId: segmentEditorDraft.projectId,
          prompt: normalizedPrompt,
          segmentIndex: targetSegmentIndex,
        } satisfies WorkspaceSegmentPhotoAnimationJobCreateRequest),
      });
      const payload = (await response.json().catch(() => null)) as WorkspaceSegmentAiVideoJobCreateResponse | null;

      if (response.status === 402) {
        if (segmentPhotoAnimationRunRef.current === runId) {
          setIsSegmentEditorGeneratingPhotoAnimation(false);
          setSegmentEditorGeneratingPhotoAnimationSegmentIndex(null);
        }
        navigate("/pricing");
        return;
      }

      if (!response.ok || !payload?.data?.jobId) {
        throw new Error(payload?.error ?? "Не удалось запустить ИИ анимацию фото.");
      }

      if (segmentPhotoAnimationRunRef.current !== runId) {
        return;
      }

      applyWorkspaceProfile(payload.data.profile);
      pollStarted = true;
      await pollSegmentEditorPhotoAnimationJob(payload.data.jobId, payload.data.status, {
        prompt: normalizedPrompt,
        runId,
        segmentIndex: targetSegmentIndex,
      });
    } catch (error) {
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

  const handleSegmentAiPhotoModalCustomVideoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file || !segmentAiPhotoModalSegment) {
      return;
    }

    setSegmentAiPhotoModalTab("upload");
    const isApplied = await handleSegmentEditorCustomVideoSelect(file, {
      segmentIndex: segmentAiPhotoModalSegment.index,
    });
    if (isApplied) {
      closeSegmentAiPhotoModal();
    }
  };

  const handleSegmentAiPhotoModalGenerateScene = async (prompt?: string) => {
    if (!segmentAiPhotoModalSegment) {
      return;
    }

    setSegmentAiPhotoModalTab("ai_photo");
    await handleSegmentEditorAiPhotoGenerate({
      prompt: prompt ?? segmentAiPhotoModalPrompt,
      segmentIndex: segmentAiPhotoModalSegment.index,
      shouldCloseModal: true,
    });
  };

  const handleSegmentAiVideoModalGenerate = async (prompt?: string) => {
    if (!segmentAiPhotoModalSegment) {
      return;
    }

    setSegmentEditorVideoError(null);
    setSegmentAiPhotoModalTab("ai_video");
    await handleSegmentEditorAiVideoGenerate({
      prompt: prompt ?? segmentAiVideoModalPrompt,
      segmentIndex: segmentAiPhotoModalSegment.index,
      shouldCloseModal: true,
    });
  };

  const handleSegmentPhotoAnimationModalGenerate = async (prompt?: string) => {
    if (!segmentAiPhotoModalSegment) {
      return;
    }

    setSegmentEditorVideoError(null);
    setSegmentAiPhotoModalTab("photo_animation");
    await handleSegmentEditorPhotoAnimationGenerate({
      prompt: prompt ?? segmentAiVideoModalPrompt,
      segmentIndex: segmentAiPhotoModalSegment.index,
      shouldCloseModal: true,
    });
  };

  const handleSegmentAiPhotoModalImprovePrompt = async () => {
    if (isSegmentAiPhotoPromptImproving) {
      return;
    }

    const isAiVideoPromptTab = segmentAiPhotoModalTab === "ai_video" || segmentAiPhotoModalTab === "photo_animation";
    const sourcePrompt = isAiVideoPromptTab
      ? normalizedSegmentAiVideoModalPrompt || normalizeWorkspaceSegmentAiVideoPrompt(segmentAiPhotoModalScenarioPrompt)
      : normalizedSegmentAiPhotoModalPrompt || normalizeWorkspaceSegmentAiPhotoPrompt(segmentAiPhotoModalScenarioPrompt);
    if (!sourcePrompt) {
      setSegmentEditorVideoError("Введите описание сцены или используйте текст сегмента.");
      return;
    }

    setSegmentEditorVideoError(null);
    setSegmentAiPhotoModalTab(
      isAiVideoPromptTab ? (segmentAiPhotoModalTab === "photo_animation" ? "photo_animation" : "ai_video") : "ai_photo",
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
      } else {
        setSegmentAiPhotoModalPrompt(improvedPrompt);
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

    const invalidAiVideoSegmentIndex = getInvalidAiVideoSegmentIndex(effectiveDraft);
    if (invalidAiVideoSegmentIndex >= 0) {
      const invalidSegment = effectiveDraft.segments[invalidAiVideoSegmentIndex];
      if (invalidSegment) {
        const invalidSegmentDraftIndex = segmentEditorDraft.segments.findIndex((segment) => segment.index === invalidSegment.index);
        setActiveSegmentIndex(invalidSegmentDraftIndex >= 0 ? invalidSegmentDraftIndex : invalidAiVideoSegmentIndex);
        setSegmentEditorVideoError(getAiVideoSegmentValidationMessage(invalidSegment));
      }
      return;
    }

    const invalidPhotoAnimationSegmentIndex = getInvalidPhotoAnimationSegmentIndex(effectiveDraft);
    if (invalidPhotoAnimationSegmentIndex >= 0) {
      const invalidSegment = effectiveDraft.segments[invalidPhotoAnimationSegmentIndex];
      if (invalidSegment) {
        const invalidSegmentDraftIndex = segmentEditorDraft.segments.findIndex((segment) => segment.index === invalidSegment.index);
        setActiveSegmentIndex(
          invalidSegmentDraftIndex >= 0 ? invalidSegmentDraftIndex : invalidPhotoAnimationSegmentIndex,
        );
        setSegmentEditorVideoError(getPhotoAnimationSegmentValidationMessage(invalidSegment));
      }
      return;
    }

    const invalidAiPhotoSegmentIndex = getInvalidAiPhotoSegmentIndex(effectiveDraft);
    if (invalidAiPhotoSegmentIndex >= 0) {
      const invalidSegment = effectiveDraft.segments[invalidAiPhotoSegmentIndex];
      if (invalidSegment) {
        const invalidSegmentDraftIndex = segmentEditorDraft.segments.findIndex((segment) => segment.index === invalidSegment.index);
        setActiveSegmentIndex(invalidSegmentDraftIndex >= 0 ? invalidSegmentDraftIndex : invalidAiPhotoSegmentIndex);
        setSegmentEditorVideoError(getAiPhotoSegmentValidationMessage(invalidSegment));
      }
      return;
    }

    const nextAppliedSession = cloneWorkspaceSegmentEditorDraftSession(effectiveDraft);
    setSegmentEditorAppliedSession(nextAppliedSession);

    const regenerationPrompt =
      (generatedVideo?.adId === effectiveDraft.projectId ? String(generatedVideo.prompt ?? "").trim() : "") ||
      (projects.find((project) => project.adId === effectiveDraft.projectId)?.prompt.trim() ?? "") ||
      topicInput.trim();
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

  const removeProjectFromLocalState = (targetProject: WorkspaceProject) => {
    setProjects((currentProjects) =>
      currentProjects.filter((project) => !doesWorkspaceProjectMatch(project, targetProject)),
    );
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
  };

  const handleDeleteProject = async () => {
    const project = projectPendingDelete;
    if (!project) {
      return;
    }

    if (pendingProjectDeleteIdsRef.current.has(project.id)) {
      return;
    }

    setProjectDeleteError(null);
    setIsProjectDeleteSubmitting(true);
    pendingProjectDeleteIdsRef.current.add(project.id);
    removeProjectFromLocalState(project);

    try {
      const response = await fetch(`/api/workspace/projects/${encodeURIComponent(project.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as WorkspaceProjectDeleteResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Не удалось удалить проект.");
      }

      setProjectPendingDelete(null);
    } catch (error) {
      restoreProjectToLocalState(project);
      setProjectDeleteError(error instanceof Error ? error.message : "Не удалось удалить проект.");
    } finally {
      pendingProjectDeleteIdsRef.current.delete(project.id);
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
      invalidateSegmentEditorOnSuccess?: boolean;
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
          updateDismissedStudioPreviewKey(null);
          setGenerateError(statusPayload.data.error ?? null);
          if (options?.invalidateSegmentEditorOnSuccess) {
            setSegmentEditorLoadedSession(null);
          }
          if (options?.clearAppliedSegmentEditorOnSuccess) {
            setSegmentEditorAppliedSession(null);
            setSegmentEditorDraft(null);
            setSegmentEditorVideoError(null);
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

      setStatus("Generation failed");
      setGenerateError(error instanceof Error ? error.message : "Failed to generate task.");
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
      isRegeneration?: boolean;
      musicType?: StudioMusicType | string;
      projectId?: number;
      segmentEditor?: WorkspaceSegmentEditorPayload;
      segmentEditorSession?: WorkspaceSegmentEditorDraftSession | null;
      subtitleEnabled?: boolean;
      subtitleColorId?: string;
      subtitleStyleId?: string;
      voiceEnabled?: boolean;
      voiceId?: string;
    },
  ) => {
    preserveExamplePrefillRef.current = false;
    const requiredCredits = getRequiredCreditsForVideoMode(selectedVideoMode);

    if (workspaceBalance !== null && workspaceBalance < requiredCredits) {
      navigate("/pricing");
      return;
    }

    const safeTopic = nextTopic.trim();

    if (!safeTopic.trim()) {
      setGenerateError("Введите prompt для генерации.");
      setStatus("Prompt required");
      return;
    }

    if (isPreparingCustomVideo || isPreparingCustomMusic) {
      if (isPreparingCustomVideo) {
        setGenerateError("Подождите, пока видеофайл загрузится в студию.");
        setStatus("Video preparing");
        return;
      }

      setGenerateError("Подождите, пока аудиофайл загрузится в студию.");
      setStatus("Audio preparing");
      return;
    }

    if (
      isSegmentEditorPreparingCustomVideo ||
      isSegmentEditorGeneratingAiPhoto ||
      isSegmentEditorGeneratingAiVideo ||
      isSegmentEditorGeneratingPhotoAnimation
    ) {
      if (isSegmentEditorGeneratingAiPhoto) {
        setGenerateError("Подождите, пока ИИ фото создаётся для сегмента.");
        setStatus("AI photo preparing");
        return;
      }

      if (isSegmentEditorGeneratingAiVideo) {
        setGenerateError("Подождите, пока ИИ видео создаётся для сегмента.");
        setStatus("AI video preparing");
        return;
      }

      if (isSegmentEditorGeneratingPhotoAnimation) {
        setGenerateError("Подождите, пока ИИ анимация фото создаётся для сегмента.");
        setStatus("Photo animation preparing");
        return;
      }

      setGenerateError("Подождите, пока видео сегмента загрузится в редактор.");
      setStatus("Video preparing");
      return;
    }

    if (selectedVideoMode === "custom" && !selectedCustomVideo) {
      setGenerateError("Загрузите свой видеофайл или выберите другой режим видео.");
      setStatus("Video required");
      return;
    }

    if (selectedMusicType === "custom" && !selectedCustomMusic) {
      setGenerateError("Загрузите свой аудиофайл или выберите другой режим музыки.");
      setStatus("Music required");
      return;
    }

    const shouldPreserveCurrentPreview = Boolean(options?.isRegeneration);
    const effectiveMusicType = options?.musicType ?? selectedMusicType;
    const effectiveSubtitleEnabled = options?.subtitleEnabled ?? areSubtitlesEnabled;
    const effectiveVoiceEnabled = options?.voiceEnabled ?? isVoiceoverEnabled;
    const effectiveSubtitleColorId = effectiveSubtitleEnabled ? options?.subtitleColorId ?? selectedSubtitleColorId : undefined;
    const effectiveSubtitleStyleId = effectiveSubtitleEnabled ? options?.subtitleStyleId ?? selectedSubtitleStyleId : undefined;
    const effectiveVoiceId = effectiveVoiceEnabled ? options?.voiceId ?? (resolvedSelectedVoiceId || undefined) : undefined;
    const currentComposerSourceIdea = isWorkspaceContentPlanSourceIdeaSynchronized(safeTopic, composerSourceIdea)
      ? composerSourceIdea
        ? { ...composerSourceIdea }
        : null
      : null;

    flushSync(() => {
      setTopicInput(safeTopic);
      updateDismissedStudioPreviewKey(null);
      if (!currentComposerSourceIdea && composerSourceIdea) {
        setComposerSourceIdea(null);
        setSelectedContentPlanIdeaId((current) => (current === composerSourceIdea.ideaId ? null : current));
      }
      if (!shouldPreserveCurrentPreview) {
        setGeneratedVideo(null);
        setSegmentEditorLoadedSession(null);
        setSegmentEditorAppliedSession(null);
      }
      setIsGenerating(true);
      setIsPreviewModalOpen(false);
      setGenerateError(null);
      setVideoSelectionError(null);
      setMusicSelectionError(null);
      setSegmentEditorError(null);
      setSegmentEditorVideoError(null);
      segmentAiPhotoRunRef.current += 1;
      setIsSegmentEditorGeneratingAiPhoto(false);
      setSegmentEditorGeneratingAiPhotoSegmentIndex(null);
      setSegmentEditorDraft(null);
      setIsSegmentAiPhotoModalOpen(false);
      setSegmentAiPhotoModalSegmentIndex(null);
      setSegmentAiPhotoModalPrompt("");
      setCreateMode("default");
      setHasLoadedProjects(false);
      setStatus("Task queued");
    });

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });

    try {
      const formData = new FormData();
      const effectiveSegmentEditorBuild = options?.segmentEditorSession
        ? await buildWorkspaceSegmentEditorPayload(options.segmentEditorSession)
        : null;
      const effectiveSegmentEditor = options?.segmentEditor ?? effectiveSegmentEditorBuild?.payload;

      appendStudioFormValue(formData, "prompt", safeTopic);
      appendStudioFormValue(formData, "isRegeneration", Boolean(options?.isRegeneration));
      appendStudioFormValue(formData, "language", selectedLanguage);
      appendStudioFormValue(formData, "musicType", effectiveMusicType);
      appendStudioFormValue(formData, "projectId", options?.projectId);
      appendStudioFormValue(formData, "subtitleEnabled", effectiveSubtitleEnabled);
      appendStudioFormValue(formData, "subtitleColorId", effectiveSubtitleColorId);
      appendStudioFormValue(formData, "subtitleStyleId", effectiveSubtitleStyleId);
      appendStudioFormValue(formData, "videoMode", selectedVideoMode);
      appendStudioFormValue(formData, "voiceEnabled", effectiveVoiceEnabled);
      appendStudioFormValue(formData, "voiceId", effectiveVoiceId);

      if (effectiveMusicType === "custom") {
        appendStudioFormValue(formData, "customMusicFileName", selectedCustomMusic?.fileName);

        if (selectedCustomMusic?.file) {
          formData.append("customMusicFile", selectedCustomMusic.file, selectedCustomMusic.fileName);
        } else {
          appendStudioFormValue(
            formData,
            "customMusicFileDataUrl",
            await resolveStudioCustomAssetDataUrl(selectedCustomMusic),
          );
        }
      }

      if (selectedVideoMode === "custom") {
        appendStudioFormValue(formData, "customVideoFileName", selectedCustomVideo?.fileName);
        appendStudioFormValue(formData, "customVideoFileMimeType", selectedCustomVideo?.mimeType);

        if (selectedCustomVideo?.file) {
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

      const response = await fetch("/api/studio/generate", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as StudioGenerationStartResponse | null;

      if (response.status === 402) {
        setIsGenerating(false);
        navigate("/pricing");
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
        invalidateSegmentEditorOnSuccess: Boolean(options?.isRegeneration && options?.projectId),
      });
    } catch (error) {
      setIsGenerating(false);
      setStatus("Generation failed");
      setGenerateError(error instanceof Error ? error.message : "Failed to generate task.");
    }
  };

  const buildCurrentRegenerationOptions = (segmentEditorSession?: WorkspaceSegmentEditorDraftSession | null) => {
    const effectiveSegmentEditorSession = segmentEditorSession ?? currentAppliedSegmentEditorSession;
    const projectId = effectiveSegmentEditorSession?.projectId ?? generatedVideo?.adId ?? undefined;
    const generationOverrides = getWorkspaceSegmentEditorGenerationOverrides(effectiveSegmentEditorSession);

    if (!projectId) {
      return {
        isRegeneration: true,
        ...generationOverrides,
      };
    }

    return {
      clearAppliedSegmentEditorOnSuccess: Boolean(effectiveSegmentEditorSession),
      isRegeneration: true,
      ...generationOverrides,
      projectId,
      ...(effectiveSegmentEditorSession ? { segmentEditorSession: effectiveSegmentEditorSession } : {}),
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
    if (!isLocalExamplesEnabled || !source) {
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

    setStudioView("create");
    await ensureSegmentEditorDraftForProject(project.adId);
  };

  const handleOpenMediaLibraryItem = async (item: WorkspaceMediaLibraryItem) => {
    setStudioView("create");
    const draft = await ensureSegmentEditorDraftForProject(item.projectId, {
      openDraft: false,
    });

    if (!draft) {
      return;
    }

    const matchedSegmentIndex = draft.segments.findIndex((segment) => segment.index === item.segmentIndex);
    const initialSegmentIndex =
      matchedSegmentIndex >= 0
        ? matchedSegmentIndex
        : Math.max(0, Math.min(item.segmentListIndex, Math.max(0, draft.segments.length - 1)));

    openSegmentEditorWithDraft(draft, { initialSegmentIndex });
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

    const cleanupRetryListeners = () => {
      element.removeEventListener("loadeddata", handlePlaybackRetry);
      element.removeEventListener("canplay", handlePlaybackRetry);
    };

    const markPlaybackStarted = () => {
      cleanupRetryListeners();
      if (!cancelled) {
        setQueuedSegmentEditorPlaybackIndex((current) => (current === segmentPlaybackIndex ? null : current));
      }
    };

    const tryStartPlayback = async () => {
      if (cancelled) {
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

      if (!cancelled && !element.paused && !element.ended) {
        markPlaybackStarted();
        return true;
      }

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

    if (element.preload !== "auto") {
      element.preload = "auto";
    }

    if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || element.networkState === HTMLMediaElement.NETWORK_EMPTY) {
      element.load();
    } else {
      window.requestAnimationFrame(() => {
        if (cancelled) {
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

  const handleSegmentEditorPreviewVideoRef = (segmentIndex: number) => (element: HTMLVideoElement | null) => {
    if (element) {
      segmentEditorPreviewVideoRefs.current[segmentIndex] = element;

      const shouldResumeQueuedPlayback =
        createMode === "segment-editor" &&
        activeSegment?.index === segmentIndex &&
        queuedSegmentEditorPlaybackIndex === segmentIndex;

      if (shouldResumeQueuedPlayback) {
        const startQueuedPlayback = async () => {
          if (
            createMode !== "segment-editor" ||
            activeSegment?.index !== segmentIndex ||
            queuedSegmentEditorPlaybackIndex !== segmentIndex
          ) {
            return;
          }

          try {
            element.currentTime = 0;
          } catch {
            // Ignore reset errors while metadata is still loading.
          }

          await requestSegmentEditorVideoPlayback(segmentIndex, element, { resetToStart: true });
        };

        if (element.readyState >= 1) {
          void startQueuedPlayback();
        } else {
          element.addEventListener("loadedmetadata", () => void startQueuedPlayback(), { once: true });
          if (element.preload !== "auto") {
            element.preload = "auto";
          }
          element.load();
        }
      }

      return;
    }

    delete segmentEditorPreviewVideoRefs.current[segmentIndex];
  };

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
      cancelSegmentEditorSyntheticPlayback();
      setPlayingSegmentEditorPreviewIndex(null);
      setQueuedSegmentEditorPlaybackIndex(null);
      setActiveSegmentIndex(segmentArrayIndex);
      return;
    }

    const segment = segmentEditorDraft?.segments[segmentArrayIndex] ?? null;
    if (!segment) {
      setQueuedSegmentEditorPlaybackIndex(null);
      return;
    }

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
      setQueuedSegmentEditorPlaybackIndex(segmentPlaybackIndex);
      return;
    }

    if (element.readyState < 1) {
      if (element.preload !== "auto") {
        element.preload = "auto";
      }
      setQueuedSegmentEditorPlaybackIndex(segmentPlaybackIndex);
      element.load();
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

    flushSync(() => {
      setActiveProjectPreviewId(null);
      setIsPreviewModalOpen(false);
      setProjectPreviewModal(project);
      setPreviewModalOpenToken(Date.now());
      setPreviewModalPlaybackError(null);
      setPreviewModalUseFallbackSource(false);
    });
    queuePreviewModalPlayback({ immediate: true, resetToStart: true });
  };

  const handleOpenPreviewModalProjectSegmentEditor = async () => {
    const project = projectPreviewModal;
    if (!project) {
      return;
    }

    closePreviewModals();
    await handleOpenProjectSegmentEditor(project);
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

    setStudioPreviewCurrentTime(0);
  };

  const handleDismissStudioPreview = () => {
    const previewElement = previewVideoRef.current;
    previewElement?.pause();
    setIsStudioPreviewInlineActive(false);
    setIsStudioPreviewPlaying(false);
    setStudioPreviewDuration(0);
    resetStudioPreviewPlaybackPosition();
    updateDismissedStudioPreviewKey(getStudioPreviewDismissKey(generatedVideo));
  };

  const handleStudioPreviewKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    void (isStudioPreviewInlineActive ? handleStudioPreviewTogglePlayback() : handleEnableInlineStudioPreview());
  };

  const handleEnableInlineStudioPreview = async () => {
    const previewElement = previewVideoRef.current;
    if (!previewElement) return;

    setIsStudioPreviewInlineActive(true);
    previewElement.preload = "auto";
    resetStudioPreviewPlaybackPosition();
    previewElement.volume = studioPreviewVolume;
    previewElement.muted = studioPreviewVolume <= 0;
    previewElement.defaultMuted = studioPreviewVolume <= 0;

    try {
      await previewElement.play();
    } catch {
      setIsStudioPreviewInlineActive(false);
      previewElement.pause();
      previewElement.muted = true;
      previewElement.defaultMuted = true;
      resetStudioPreviewPlaybackPosition();
    }
  };

  const handleStudioPreviewTogglePlayback = async () => {
    const previewElement = previewVideoRef.current;
    if (!previewElement || !isStudioPreviewInlineActive) return;

    if (previewElement.paused) {
      previewElement.volume = studioPreviewVolume;
      previewElement.muted = studioPreviewVolume <= 0;
      previewElement.defaultMuted = studioPreviewVolume <= 0;
      await playVideoElement(previewElement, true);
      return;
    }

    previewElement.pause();
  };

  const handleStudioPreviewSurfaceClick = () => {
    void (isStudioPreviewInlineActive ? handleStudioPreviewTogglePlayback() : handleEnableInlineStudioPreview());
  };

  const handleStudioPreviewMouseEnter = () => {
    if (isStudioPreviewInlineActive || isAnyPreviewModalOpen || activeTab !== "studio" || studioView !== "create" || createMode !== "default") {
      return;
    }

    const previewElement = previewVideoRef.current;
    if (!previewElement) {
      return;
    }

    resetStudioPreviewPlaybackPosition();
    previewElement.preload = "auto";
    previewElement.muted = true;
    previewElement.defaultMuted = true;
    void playVideoElement(previewElement, true);
  };

  const handleStudioPreviewMouseLeave = () => {
    if (isStudioPreviewInlineActive) {
      return;
    }

    previewVideoRef.current?.pause();
    resetStudioPreviewPlaybackPosition();
  };

  const handleStudioPreviewVideoError = () => {
    if (!generatedVideo?.videoUrl) {
      return;
    }

    previewVideoRef.current?.pause();
    setIsStudioPreviewInlineActive(false);
    setIsStudioPreviewPlaying(false);
    setStudioPreviewCurrentTime(0);
    setStudioPreviewDuration(0);
    markStudioVideoAsFailed(generatedVideo.videoUrl);
  };

  const handlePreviewModalVideoLoadedData = (event: ReactSyntheticEvent<HTMLVideoElement>) => {
    if (!isCurrentPreviewModalVideoElement(event.currentTarget)) {
      return;
    }

    setPreviewModalPlaybackError(null);
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

  const handlePreviewModalVideoClick = (event: ReactMouseEvent<HTMLVideoElement>) => {
    const element = event.currentTarget;
    if (!isCurrentPreviewModalVideoElement(element) || element.paused) {
      return;
    }

    element.pause();
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

  const handleStudioPreviewMetadataLoaded = () => {
    const previewElement = previewVideoRef.current;
    if (!previewElement) return;

    const nextDuration = Number.isFinite(previewElement.duration) ? previewElement.duration : 0;
    setStudioPreviewDuration(nextDuration > 0 ? nextDuration : 0);
  };

  const handleStudioPreviewTimeUpdate = () => {
    const previewElement = previewVideoRef.current;
    if (!previewElement) return;

    const nextTime = Number.isFinite(previewElement.currentTime) ? previewElement.currentTime : 0;
    setStudioPreviewCurrentTime(nextTime >= 0 ? nextTime : 0);
  };

  const handleStudioPreviewSeek = (nextTime: number) => {
    const previewElement = previewVideoRef.current;
    if (!previewElement) return;

    const safeTime = Math.max(0, Math.min(nextTime, studioPreviewDuration || 0));
    previewElement.currentTime = safeTime;
    setStudioPreviewCurrentTime(safeTime);
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
      setIsStudioPreviewInlineActive(false);
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

        if (latestGeneration.status === "done") {
          setStatus("");
          setIsGenerating(false);
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
    navigate("/app/studio", { replace: true });
  }, [hasLoadedProjects, isProjectsLoading, location.search, navigate, projects]);

  const isStudioRouteVisible = activeTab === "studio";
  const effectivePublishPublication = publishJobStatus?.publication ?? publishBootstrap?.publication ?? null;
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
  const publishHeaderStatusLink = effectivePublishPublication?.link ?? null;
  const publishStatusLabel = publishError
    ? "Ошибка публикации"
    : effectivePublishPublication?.state === "published"
      ? "Shorts уже опубликован"
      : effectivePublishPublication?.state === "scheduled"
        ? "Публикация запланирована"
        : isPublishInFlight
          ? "Отправляем видео в YouTube"
          : "Готово к отправке";
  const publishStatusTone = publishError
    ? "error"
    : effectivePublishPublication?.state === "published"
      ? "published"
      : effectivePublishPublication?.state === "scheduled"
        ? "scheduled"
        : isPublishInFlight
          ? "processing"
          : "ready";
  const publishHeaderStatusMeta = publishError
    ? publishError
    : getYouTubePublicationMetaLabel(effectivePublishPublication) ||
      (publishMode === "schedule" ? publishScheduleSummary : "Сразу после подтверждения");
  const activeContentPlan = contentPlans.find((plan) => plan.id === activeContentPlanId) ?? contentPlans[0] ?? null;
  const historyContentPlans = activeContentPlan
    ? contentPlans.filter((plan) => plan.id !== activeContentPlan.id)
    : [];
  const activeContentPlanIdeas = activeContentPlan
    ? activeContentPlan.ideas.slice().sort((left, right) => left.position - right.position)
    : [];
  const activeContentPlanUnusedIdeas = activeContentPlanIdeas.filter((idea) => !idea.isUsed);
  const activeContentPlanUsedIdeas = activeContentPlanIdeas.filter((idea) => idea.isUsed);
  const isContentPlanUsedIdeasExpanded = activeContentPlan
    ? expandedContentPlanUsedIdeasPlanId === activeContentPlan.id
    : false;
  const shouldShowStudioContentPlanRail = createMode !== "segment-editor" && isContentPlanVisible;
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
          <strong>{idea.title}</strong>
          <p className="studio-content-plan__idea-summary">{idea.summary}</p>
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
  const contentPlanPanel = createMode !== "segment-editor" ? (
    <aside
      className={`studio-content-plan${shouldShowStudioContentPlanRail ? " is-visible" : ""}`}
      aria-label="Контент-план"
      hidden={!shouldShowStudioContentPlanRail}
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
        ) : !activeContentPlan ? (
          <div className="studio-content-plan__state">
            <strong>Планов пока нет</strong>
            <p>Введите тему и получите готовые идеи для Shorts.</p>
          </div>
        ) : (
          <>
            <section className="studio-content-plan__section">
              <div className="studio-content-plan__section-head">
                <span className="studio-content-plan__section-label">Текущий план</span>
                <span className="studio-content-plan__section-meta">
                  {activeContentPlanUnusedIdeas.length} новых из {activeContentPlan.ideas.length}
                </span>
              </div>

              <div className="studio-content-plan__plan studio-content-plan__plan--active">
                <div className="studio-content-plan__ideas-group">
                  {activeContentPlanUnusedIdeas.length > 0 ? (
                    <div className="studio-content-plan__ideas">
                      {activeContentPlanUnusedIdeas.map((idea) => renderContentPlanIdeaCard(activeContentPlan, idea))}
                    </div>
                  ) : (
                    <div className="studio-content-plan__state is-compact">
                      <p>В этом плане не осталось новых идей. Можно открыть использованные ниже или сгенерировать ещё.</p>
                    </div>
                  )}
                </div>

                {activeContentPlanUsedIdeas.length > 0 ? (
                  <section className={`studio-content-plan__used-group${isContentPlanUsedIdeasExpanded ? " is-expanded" : ""}`}>
                    <button
                      className={`studio-content-plan__used-toggle${isContentPlanUsedIdeasExpanded ? " is-expanded" : ""}`}
                      type="button"
                      aria-expanded={isContentPlanUsedIdeasExpanded}
                      onClick={() =>
                        setExpandedContentPlanUsedIdeasPlanId((current) =>
                          current === activeContentPlan.id ? null : activeContentPlan.id,
                        )
                      }
                    >
                      <span>Использованные</span>
                      <span>{formatWorkspaceContentPlanIdeaCount(activeContentPlanUsedIdeas.length)}</span>
                    </button>

                    {isContentPlanUsedIdeasExpanded ? (
                      <div className="studio-content-plan__ideas">
                        {activeContentPlanUsedIdeas.map((idea) => renderContentPlanIdeaCard(activeContentPlan, idea))}
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <div className="studio-content-plan__plan-actions studio-content-plan__plan-actions--footer">
                  <button
                    className="studio-content-plan__ghost-btn"
                    type="button"
                    disabled={contentPlanDeletingPlanId === activeContentPlan.id || isContentPlanGenerating}
                    onClick={() => void handleRegenerateContentPlan(activeContentPlan)}
                  >
                    {isContentPlanGenerating ? "Создаём..." : "Создать еще"}
                  </button>
                  <button
                    className="studio-content-plan__ghost-btn is-danger"
                    type="button"
                    disabled={contentPlanDeletingPlanId === activeContentPlan.id}
                    onClick={() => void handleDeleteContentPlan(activeContentPlan)}
                  >
                    {contentPlanDeletingPlanId === activeContentPlan.id ? "Удаляем..." : "Удалить"}
                  </button>
                </div>
              </div>
            </section>

            <section className="studio-content-plan__section studio-content-plan__history">
              <div className="studio-content-plan__section-head">
                <span className="studio-content-plan__section-label">История планов</span>
                <span className="studio-content-plan__section-meta">{historyContentPlans.length}</span>
              </div>

              {historyContentPlans.length > 0 ? (
                <div className="studio-content-plan__history-list">
                  {historyContentPlans.map((plan) => {
                    const unusedIdeasCount = plan.ideas.filter((idea) => !idea.isUsed).length;

                    return (
                      <button
                        key={plan.id}
                        className="studio-content-plan__history-item"
                        type="button"
                        onClick={() => setActiveContentPlanId(plan.id)}
                      >
                        <div className="studio-content-plan__history-item-copy">
                          <strong>{plan.query}</strong>
                          <span>{formatProjectDate(plan.updatedAt)}</span>
                        </div>
                        <span className="studio-content-plan__history-item-stats">
                          {unusedIdeasCount}/{plan.ideas.length} новых
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="studio-content-plan__state is-compact">
                  <p>Следующие сохранённые планы появятся здесь.</p>
                </div>
              )}
            </section>
          </>
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
      {segmentEditorChangeSummary ? <div className="studio-sidebar__summary">{segmentEditorChangeSummary}</div> : null}
    </aside>
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

	            <div className={`studio-canvas-content${createMode === "segment-editor" ? " is-segment-editor" : ""}${shouldShowStudioContentPlanRail ? " has-content-plan" : ""}`}>
	              {createMode === "default" && segmentEditorError ? (
	                <div className="studio-segment-editor__status is-error" role="status" aria-live="polite">
	                  {segmentEditorError}
	                </div>
	              ) : null}
                <div className={`studio-canvas-create-layout${shouldShowStudioContentPlanRail ? " has-content-plan" : ""}`}>
	              <div className={`studio-canvas-preview${createMode === "segment-editor" ? " is-segment-editor" : ""}`}>
	                {createMode === "segment-editor" && segmentEditorDraft && activeSegment ? (
	                  <div className="studio-segment-editor">
	                    <div className="studio-segment-editor__layout">
                      <div className="studio-segment-editor__preview-column">
                        <div className="studio-segment-editor__header studio-segment-editor__header--aside">
                          <div className="studio-segment-editor__header-stack">
                            <div className="studio-segment-editor__header-copy">
                              <p className="studio-segment-editor__eyebrow">Редактор Shorts</p>
                            </div>
                          </div>
                        </div>

                        <div className={`studio-segment-editor__stage${hasSegmentEditorChanges ? " has-summary" : ""}`}>
                          <div
                            className="studio-segment-editor__carousel"
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
                              onClick={() => setActiveSegmentIndex((current) => Math.max(0, current - 1))}
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

                                  return <div className={`studio-segment-editor__card is-empty ${slotClass}`} key={`empty:${offset}`} aria-hidden="true" />;
                                }

                                const isActiveCard = offset === 0;
                                const segmentNumber = nextSegmentArrayIndex + 1;
                                const mediaKind = getWorkspaceSegmentPreviewKind(segment);
                                const previewPosterUrl = getWorkspaceSegmentDraftPreviewUrl(segment);
                                const fallbackPosterUrl = getWorkspaceSegmentDraftFallbackPosterUrl(segment);
                                const mediaUrl = mediaKind === "image" ? previewPosterUrl : getWorkspaceSegmentDraftVideoUrl(segment);
                                const mediaKey = mediaUrl
                                  ? `${segment.index}:${mediaKind}:${mediaUrl}:${previewPosterUrl ?? "no-poster"}`
                                  : "";
                                const isAiPhotoGenerationPending = segmentEditorGeneratingAiPhotoSegmentIndex === segment.index;
                                const isAiVideoGenerationPending = segmentEditorGeneratingAiVideoSegmentIndex === segment.index;
                                const isPhotoAnimationGenerationPending =
                                  segmentEditorGeneratingPhotoAnimationSegmentIndex === segment.index;
                                const isVisualGenerationPending =
                                  isAiPhotoGenerationPending || isAiVideoGenerationPending || isPhotoAnimationGenerationPending;
                                const isSegmentPlaying = isActiveCard && playingSegmentEditorPreviewIndex === segment.index;
                                const isSegmentPlaybackRequested =
                                  isActiveCard &&
                                  mediaKind === "video" &&
                                  (queuedSegmentEditorPlaybackIndex === segment.index || isSegmentPlaying);
                                const subtitlePreviewTime = isSegmentPlaying ? segmentEditorPreviewTimes[segment.index] ?? 0 : 0;
                                const isVisualEdited = isWorkspaceSegmentDraftVisualEdited(segment);
                                const segmentSourceLabel = getWorkspaceSegmentDraftSourceLabel(segment);
                                const shouldShowEditableSubtitleOverlay =
                                  isActiveCard &&
                                  studioSidebarSubtitlesEnabled;

                                return (
                                  <div
                                    key={`segment:${segment.index}`}
                                    className={`studio-segment-editor__card ${slotClass}${isVisualGenerationPending ? " is-pending" : ""}${
                                      isVisualEdited ? " is-visual-edited" : ""
                                    }`}
                                    aria-current={offset === 0 ? "true" : undefined}
                                    aria-busy={isVisualGenerationPending ? true : undefined}
                                  >
                                    <div className="studio-segment-editor__card-media">
                                      {mediaUrl ? (
                                        <WorkspaceSegmentPreviewCardMedia
                                          autoplay={false}
                                          fallbackPosterUrl={mediaKind === "video" ? fallbackPosterUrl : null}
                                          isPlaybackRequested={isSegmentPlaybackRequested}
                                          loop={false}
                                          mediaKey={mediaKey}
                                          muted
                                          posterUrl={mediaKind === "video" ? previewPosterUrl : null}
                                          preload="auto"
                                          previewUrl={mediaUrl}
                                          previewKind={mediaKind}
                                          videoRef={mediaKind === "video" ? handleSegmentEditorPreviewVideoRef(segment.index) : undefined}
                                          onVideoTimeUpdate={handleSegmentEditorPreviewTimeUpdate(segment.index)}
                                          onVideoEnded={() => {
                                            if (segmentEditorSyntheticPlaybackRef.current?.segmentIndex === segment.index) {
                                              return;
                                            }

                                            setPlayingSegmentEditorPreviewIndex((current) =>
                                              current === segment.index ? null : current,
                                            );
                                          }}
                                          onVideoPause={() => {
                                            if (segmentEditorSyntheticPlaybackRef.current?.segmentIndex === segment.index) {
                                              return;
                                            }

                                            setPlayingSegmentEditorPreviewIndex((current) =>
                                              current === segment.index ? null : current,
                                            );
                                          }}
                                          onVideoPlay={() => setPlayingSegmentEditorPreviewIndex(segment.index)}
                                        />
                                      ) : (
                                        <div className="studio-segment-editor__card-placeholder">Нет превью</div>
                                      )}
                                      {!isActiveCard ? (
                                        <button
                                          className="studio-segment-editor__card-hitbox studio-segment-editor__card-hitbox--side"
                                          type="button"
                                          aria-label={`Переключиться на сегмент ${segmentNumber}`}
                                          onPointerDown={(event) => {
                                            event.stopPropagation();
                                          }}
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
                                          onPointerDown={(event) => {
                                            event.stopPropagation();
                                          }}
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
                                            {isPhotoAnimationGenerationPending
                                              ? "Анимируем фото"
                                              : isAiVideoGenerationPending
                                                ? "Генерируем ИИ видео"
                                                : "Генерируем фото"}
                                          </strong>
                                          <span>Сегмент {segmentNumber} обновится автоматически</span>
                                        </div>
                                      ) : null}
                                      {isActiveCard ? (
                                        <div className="studio-segment-editor__card-visual-meta">
                                          {isVisualEdited ? (
                                            <span className="studio-segment-editor__card-visual-status">Визуал изменен</span>
                                          ) : (
                                            <span className="studio-segment-editor__card-visual-spacer" aria-hidden="true"></span>
                                          )}
                                          <div className="studio-segment-editor__card-visual-actions">
                                            <button
                                              className="studio-segment-editor__card-visual-edit"
                                              type="button"
                                              aria-label={`Редактировать визуал сегмента ${segmentNumber}`}
                                              title="Редактировать визуал"
                                              onPointerDown={(event) => {
                                                event.stopPropagation();
                                              }}
                                              onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                openSegmentAiPhotoModal(nextSegmentArrayIndex, segment);
                                              }}
                                            >
                                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                                            </button>
                                            {isVisualEdited ? (
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
                                                  handleSegmentEditorVisualReset();
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
                                      <div className={`studio-segment-editor__card-overlay${isActiveCard ? " is-active" : ""}`}>
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
                                        {isActiveCard && hasSegmentEditorChanges ? (
                                          <div className="studio-segment-editor__card-overlay-footer">
                                            <button
                                              className="studio-segment-editor__panel-btn is-primary studio-segment-editor__card-create"
                                              type="button"
                                              disabled={
                                                isGenerating ||
                                                isSegmentEditorPreparingCustomVideo ||
                                                isSegmentEditorGeneratingAiPhoto ||
                                                isSegmentEditorGeneratingAiVideo ||
                                                isSegmentEditorGeneratingPhotoAnimation
                                              }
                                              onPointerDown={(event) => {
                                                event.stopPropagation();
                                              }}
                                              onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                void handleCreateShortsFromSegmentEditor();
                                              }}
                                            >
                                              Создать Shorts
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="studio-segment-editor__preload" aria-hidden="true">
                              {segmentEditorDraft.segments.map((segment) => {
                                const previewKind = getWorkspaceSegmentPreviewKind(segment);
                                const previewPosterUrl = getWorkspaceSegmentDraftPreviewUrl(segment);
                                const fallbackPosterUrl = getWorkspaceSegmentDraftFallbackPosterUrl(segment);
                                const previewUrl = previewKind === "image" ? previewPosterUrl : getWorkspaceSegmentDraftVideoUrl(segment);

                                if (!previewUrl) {
                                  return null;
                                }

                                const previewKey = `${segment.index}:${previewKind}:${previewUrl}:${previewPosterUrl ?? "no-poster"}`;

                                return (
                                  <div className="studio-segment-editor__preload-item" key={`preload:${previewKey}`}>
                                    <WorkspaceSegmentPreviewCardMedia
                                      autoplay={false}
                                      fallbackPosterUrl={previewKind === "video" ? fallbackPosterUrl : null}
                                      mediaKey={`preload:${previewKey}:${previewKind}`}
                                      posterUrl={previewKind === "video" ? previewPosterUrl : null}
                                      preload="auto"
                                      previewUrl={previewUrl}
                                      previewKind={previewKind}
                                    />
                                  </div>
                                );
                              })}
                            </div>

                            <button
                              className="studio-segment-editor__arrow"
                              type="button"
                              aria-label="Следующий сегмент"
                              disabled={activeSegmentIndex >= segmentEditorDraft.segments.length - 1}
                              onClick={() => setActiveSegmentIndex((current) => Math.min(segmentEditorDraft.segments.length - 1, current + 1))}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </div>

                        </div>

                        <div className="studio-segment-editor__thumbbar" style={segmentThumbBarStyle}>
                          <div
                            ref={segmentThumbStripRef}
                            className="studio-segment-editor__thumbstrip"
                            role="list"
                            aria-label="Все сегменты"
                          >
                            {visibleSegmentThumbInsertIndex === 0 ? (
                              <div className="studio-segment-editor__thumb-gap" aria-hidden="true">
                                <div className="studio-segment-editor__thumb-gap-line"></div>
                              </div>
                            ) : null}
                            {segmentEditorDraft.segments.map((segment, index) => {
                              const thumbPreviewKind = getWorkspaceSegmentPreviewKind(segment);
                              const thumbPreviewPosterUrl = getWorkspaceSegmentDraftPreviewUrl(segment);
                              const thumbFallbackPosterUrl = getWorkspaceSegmentDraftFallbackPosterUrl(segment);
                              const thumbUrl =
                                thumbPreviewKind === "image"
                                  ? thumbPreviewPosterUrl
                                  : getWorkspaceSegmentDraftVideoUrl(segment);
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
                                      aria-label={`Открыть сегмент ${index + 1}`}
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
                                        void handleSegmentEditorCardClick(index, segment.index, thumbPreviewKind);
                                      }}
                                    >
                                      <span className="studio-segment-editor__thumb-media">
                                        {thumbUrl ? (
                                          <WorkspaceSegmentPreviewCardMedia
                                            autoplay={false}
                                            fallbackPosterUrl={thumbPreviewKind === "video" ? thumbFallbackPosterUrl : null}
                                            loop={false}
                                            mediaKey={`thumb:${segment.index}:${thumbPreviewKind}:${thumbUrl}:${thumbPreviewPosterUrl ?? "no-poster"}`}
                                            muted
                                            posterUrl={thumbPreviewKind === "video" ? thumbPreviewPosterUrl : null}
                                            preload="auto"
                                            previewKind={thumbPreviewKind}
                                            previewUrl={thumbUrl}
                                          />
                                        ) : (
                                          <span className="studio-segment-editor__thumb-placeholder">Нет превью</span>
                                        )}
                                      </span>
                                      <span className="studio-segment-editor__thumb-copy">
                                        <strong>Сегмент {index + 1}</strong>
                                        <small>
                                          {formatWorkspaceSegmentEditorTime(getWorkspaceSegmentEditorDisplayStartTime(segment))} -{" "}
                                          {formatWorkspaceSegmentEditorTime(getWorkspaceSegmentEditorDisplayEndTime(segment), {
                                            roundUp: true,
                                          })}
                                        </small>
                                      </span>
                                    </button>
                                    <button
                                      className="studio-segment-editor__thumb-delete"
                                      type="button"
                                      disabled={!canDeleteSegmentEditorSegment || isSegmentEditorStructureActionBusy}
                                      aria-label={`Удалить сегмент ${index + 1}`}
                                      title={
                                        canDeleteSegmentEditorSegment
                                          ? "Удалить сегмент"
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
                  <div
                    className={`studio-canvas-preview__video-btn${isStudioPreviewInlineActive ? " is-inline-active" : ""}${isStudioPreviewPlaying ? " is-playing" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label={
                      hasGeneratedVideoTitle
                        ? `Воспроизвести превью: ${generatedVideoTitle}`
                        : "Воспроизвести превью видео"
                    }
                    onClick={handleStudioPreviewSurfaceClick}
                    onKeyDown={handleStudioPreviewKeyDown}
                    onMouseEnter={handleStudioPreviewMouseEnter}
                    onMouseLeave={handleStudioPreviewMouseLeave}
                  >
                    <button
                      className="studio-canvas-preview__dismiss"
                      type="button"
                      aria-label="Закрыть текущее видео"
                      title="Закрыть"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDismissStudioPreview();
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                      </svg>
                    </button>
                    <video
                      ref={previewVideoRef}
                      key={visibleGeneratedVideo.id}
                      className="studio-canvas-preview__video"
                      src={visibleGeneratedVideoPlaybackUrl}
                      poster={studioPreviewPosterUrl ?? undefined}
                      loop={!isStudioPreviewInlineActive}
                      muted={!isStudioPreviewInlineActive}
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={handleStudioPreviewMetadataLoaded}
                      onDurationChange={handleStudioPreviewMetadataLoaded}
                      onPlay={() => setIsStudioPreviewPlaying(true)}
                      onPause={() => setIsStudioPreviewPlaying(false)}
                      onError={handleStudioPreviewVideoError}
                      onTimeUpdate={handleStudioPreviewTimeUpdate}
                    />
                    {!isGenerating ? (
                      <div className="studio-canvas-preview__quick-actions" onClick={(event) => event.stopPropagation()}>
                        <button
                          className="studio-canvas-preview__quick-action"
                          type="button"
                          aria-label="Открыть Shorts по сегментам"
                          title={visibleGeneratedVideo?.adId ? "Открыть Shorts по сегментам" : "Shorts по сегментам доступны после сохранения проекта"}
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
                        {isLocalExamplesEnabled ? (
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
                          href={visibleGeneratedVideoPlaybackUrl ?? undefined}
                          download={studioInlinePreviewDownloadName}
                          aria-label="Скачать видео"
                          title="Скачать"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </a>
                      </div>
                    ) : null}
                    {!isGenerating ? (
                      <button
                        className="studio-canvas-preview__center-control"
                        type="button"
                        aria-label={
                          !isStudioPreviewInlineActive
                            ? "Включить видео"
                            : isStudioPreviewPlaying
                              ? "Пауза"
                              : "Воспроизвести"
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!isStudioPreviewInlineActive) {
                            void handleEnableInlineStudioPreview();
                            return;
                          }
                          void handleStudioPreviewTogglePlayback();
                        }}
                      >
                        {!isStudioPreviewInlineActive || !isStudioPreviewPlaying ? (
                          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                            <path d="M10 7.6c0-1.23 1.33-2 2.38-1.36l9.18 5.52a1.56 1.56 0 0 1 0 2.68l-9.18 5.52A1.56 1.56 0 0 1 10 18.6V7.6Z" fill="currentColor" />
                          </svg>
                        ) : (
                          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                            <rect x="8.5" y="7" width="4.5" height="14" rx="1.6" fill="currentColor" />
                            <rect x="15" y="7" width="4.5" height="14" rx="1.6" fill="currentColor" />
                          </svg>
                        )}
                      </button>
                    ) : null}
                    {isStudioPreviewInlineActive ? (
                      <div
                        className="studio-canvas-preview__controlbar"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="studio-canvas-preview__timeline" aria-label="Перемотка видео">
                          <input
                            type="range"
                            min="0"
                            max={studioPreviewDuration > 0 ? studioPreviewDuration : 0}
                            step="0.01"
                            value={Math.min(studioPreviewCurrentTime, studioPreviewDuration || 0)}
                            disabled={studioPreviewDuration <= 0}
                            onChange={(event) => handleStudioPreviewSeek(Number(event.target.value))}
                          />
                        </div>
                        <label className="studio-canvas-preview__volume" aria-label="Громкость видео">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M5 9.5v5h3.4L13 18V6L8.4 9.5H5Z" fill="currentColor" />
                            <path d="M16.5 9a4.5 4.5 0 0 1 0 6M18.8 6.5a7.8 7.8 0 0 1 0 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={Math.round(studioPreviewVolume * 100)}
                            onChange={(event) => setStudioPreviewVolume(Number(event.target.value) / 100)}
                          />
                        </label>
                      </div>
                    ) : null}
                    {isSegmentEditorLoading ? (
                      <div className="studio-canvas-preview__overlay">
                        <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                        <span>Загружаем сегменты...</span>
                      </div>
                    ) : isGenerating ? (
                      <div className="studio-canvas-preview__overlay">
                        <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                        <span>Генерация...</span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className={`studio-canvas-preview__placeholder${isGenerating ? " is-generating" : ""}${generateError ? " is-error" : ""}`}>
                    {isGenerating ? (
                      <>
                        <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                        <strong>Генерация видео...</strong>
                        <p>Это займёт около минуты</p>
                      </>
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
	                style={segmentEditorPromptInnerStyle}
	              >
	                <div className="studio-canvas-prompt__editor-layout">
	                  <div className="studio-canvas-prompt__editor-pane">
	                    <>
                          {composerSourceIdea ? (
                            <div className="studio-canvas-prompt__source">
                              <span className="studio-canvas-prompt__source-label">Из контент-плана</span>
                              <strong>{composerSourceIdea.title}</strong>
                              <button type="button" onClick={handleClearComposerSourceIdea}>
                                Сбросить
                              </button>
                            </div>
                          ) : null}
	                        {segmentEditorError ? <p className="studio-canvas-prompt__notice is-error">{segmentEditorError}</p> : null}
	                        {hasAppliedSegmentEditorSession ? (
	                          <p className="studio-canvas-prompt__notice">
	                            Сегменты сохранены: {currentAppliedSegmentEditorSession?.segments.length ?? 0}. Следующий запуск обновит текущий проект.
                          </p>
                        ) : null}
                        <textarea
                          className="studio-canvas-prompt__textarea"
                          placeholder="Опишите идею для Shorts..."
                          value={topicInput}
                          onChange={(event) => setTopicInput(event.target.value)}
                          rows={1}
	                        />
		                        <div className="studio-canvas-prompt__footer">
	                          <div className="studio-canvas-prompt__chips">
		                            {studioPromptChips.map((chip) =>
		                              chip === "Видео" ? (
		                                <StudioVideoSelectorChip
                                  key={chip}
                                  customVideoFile={selectedCustomVideo}
                                  isPreparingCustomVideo={isPreparingCustomVideo}
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
                              <button
                                className={`studio-canvas-prompt__chip studio-canvas-prompt__chip--toggle${isContentPlanVisible ? " is-active" : ""}`}
                                type="button"
                                onClick={handleToggleContentPlanVisibility}
                              >
                                План
                              </button>
	                          </div>
	                          <button
                            className={`studio-canvas-prompt__btn${isGenerating || isPreparingCustomVideo || isPreparingCustomMusic ? " is-generating" : ""}`}
                            type="button"
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
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </>
                  </div>
                </div>
              </div>
            </div>
            ) : null}
          </div>

	          <div className="studio-projects" hidden={studioView !== "projects"}>
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
                    onClick={() => setStudioView("create")}
                  >
                    Создать Shorts
                  </button>
                </div>
              ) : (
                <div className="studio-projects__grid">
	                  {projects.map((project) => (
	                    <WorkspaceProjectCard
	                      key={project.id}
                          canUseLocalExamples={isLocalExamplesEnabled}
                          isProjectActionBusy={isSegmentEditorLoading || isSavingLocalExample}
	                      isPreviewing={activeProjectPreviewId === project.id}
                          onAddToExamples={handleOpenProjectLocalExampleModal}
	                      onActivate={activateProjectPreview}
	                      onBlur={handleProjectCardBlur(project.id)}
	                      onDeactivate={deactivateProjectPreview}
                        onDelete={requestProjectDelete}
                          onEdit={(targetProject) => void handleOpenProjectSegmentEditor(targetProject)}
	                      onOpenPreview={handleOpenProjectPreviewModal}
                          onPublish={(targetProject) => void handleOpenProjectPublish(targetProject)}
	                      project={project}
	                    />
              ))}
            </div>
              )}
            </div>
            <div className="studio-media-library" hidden={studioView !== "media"}>
              {visibleMediaLibraryItems.length > 0 ? (
                <>
                  <div className="studio-media-library__head">
                    <div className="studio-media-library__copy">
                      <strong>Медиатека ИИ визуалов</strong>
                    </div>
                    <div className="studio-media-library__pills">
                      <span>ИИ фото: {visibleAiPhotoMediaItemsCount}</span>
                      <span>ИИ видео: {visibleAiVideoMediaItemsCount}</span>
                      <span>ИИ анимации: {visiblePhotoAnimationMediaItemsCount}</span>
                    </div>
                  </div>

                  <div className="studio-media-library__grid">
                    {visibleMediaLibraryItems.map((item) => {
                      const itemKindLabel = getWorkspaceMediaLibraryItemKindLabel(item.kind);
                      const itemKindLabelLower = itemKindLabel.toLowerCase();
                      const canDownloadSegment = Boolean(item.downloadUrl);
                      const openPhotoLabel = `Открыть ${itemKindLabelLower}, проект ${item.projectTitle}, сегмент ${item.segmentNumber}`;
                      const deletePhotoLabel = `Удалить из медиатеки ${itemKindLabelLower}, проект ${item.projectTitle}, сегмент ${item.segmentNumber}`;

                      return (
                        <article
                          key={`media-library:${item.itemKey}`}
                          className="studio-media-library__card"
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
                                <WorkspaceSegmentPreviewCardMedia
                                  autoplay={false}
                                  imageLoading="lazy"
                                  mediaKey={`media-library:${item.projectId}:${item.segmentIndex}:${item.previewUrl}:${item.previewPosterUrl ?? "no-poster"}`}
                                  posterUrl={item.previewKind === "video" ? item.previewPosterUrl : null}
                                  preferPosterFrame
                                  preload="none"
                                  previewUrl={item.previewUrl}
                                  previewKind={item.previewKind}
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
                      void handleStudioCreateModeSwitch("default");
                    }}
                  >
                    Создать Shorts
                  </button>
                </div>
              ) : isMediaLibraryLoading && resolvedMediaLibraryItems.length === 0 ? (
                <div className="studio-projects__loading">
                  <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                  <p>Загружаем AI-сегменты всех проектов...</p>
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
            </div>
          </div>
        </main>

        {segmentThumbDragState && segmentThumbDragSegment && segmentThumbDragGhostStyle && typeof document !== "undefined"
          ? createPortal(
              <div className="studio-segment-editor__thumb-ghost" aria-hidden="true" style={segmentThumbDragGhostStyle}>
                {(() => {
                  const ghostPreviewKind = getWorkspaceSegmentPreviewKind(segmentThumbDragSegment);
                  const ghostPreviewPosterUrl = getWorkspaceSegmentDraftPreviewUrl(segmentThumbDragSegment);
                  const ghostFallbackPosterUrl = getWorkspaceSegmentDraftFallbackPosterUrl(segmentThumbDragSegment);
                  const ghostPreviewUrl =
                    ghostPreviewKind === "image"
                      ? ghostPreviewPosterUrl
                      : getWorkspaceSegmentDraftVideoUrl(segmentThumbDragSegment);

                  return (
                    <span className="studio-segment-editor__thumb-media">
                      {ghostPreviewUrl ? (
                        <WorkspaceSegmentPreviewCardMedia
                          autoplay={false}
                          fallbackPosterUrl={ghostPreviewKind === "video" ? ghostFallbackPosterUrl : null}
                          loop={false}
                          mediaKey={`thumb-ghost:${segmentThumbDragSegment.index}:${ghostPreviewKind}:${ghostPreviewUrl}:${ghostPreviewPosterUrl ?? "no-poster"}`}
                          muted
                          posterUrl={ghostPreviewKind === "video" ? ghostPreviewPosterUrl : null}
                          preload="auto"
                          previewKind={ghostPreviewKind}
                          previewUrl={ghostPreviewUrl}
                        />
                      ) : (
                        <span className="studio-segment-editor__thumb-placeholder">Нет превью</span>
                      )}
                    </span>
                  );
                })()}
                <span className="studio-segment-editor__thumb-copy">
                  <strong>Сегмент {segmentThumbDragState.draggedIndex + 1}</strong>
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
              <div className="workspace-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-project-delete-title">
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

                    <div className="workspace-confirm-modal__copy">
                      <span className="workspace-confirm-modal__eyebrow">Удаление проекта</span>
                      <strong id="workspace-project-delete-title">Удалить проект?</strong>
                    </div>
                  </div>

                  <div className="workspace-confirm-modal__project">
                    <span>Будет удалён</span>
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
                        "Удалить проект"
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
              <div className="studio-ai-photo-modal" role="dialog" aria-modal="true" aria-labelledby="segment-visual-modal-title">
                <button
                  className="studio-ai-photo-modal__backdrop route-close"
                  type="button"
                  aria-label="Закрыть окно редактирования визуала"
                  onClick={closeSegmentAiPhotoModal}
                />
                <form
                  ref={segmentAiPhotoModalPanelRef}
                  className={`studio-ai-photo-modal__panel studio-ai-photo-modal__panel--${segmentAiPhotoModalTab}`}
                  role="document"
                >
                  <button
                    className="studio-ai-photo-modal__close route-close"
                    type="button"
                    aria-label="Закрыть окно редактирования визуала"
                    onClick={closeSegmentAiPhotoModal}
                  >
                    ×
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
                    <section className="studio-ai-photo-modal__preview-pane" aria-label="Превью сегмента">
                      <div className="studio-ai-photo-modal__preview-shell">
                        <div className="studio-ai-photo-modal__preview-frame">
                          {segmentAiPhotoModalPreviewUrl ? (
                            <WorkspaceSegmentPreviewCardMedia
                              autoplay={segmentAiPhotoModalPreviewKind === "video"}
                              fallbackPosterUrl={
                                segmentAiPhotoModalPreviewKind === "video" ? segmentAiPhotoModalFallbackPosterUrl : null
                              }
                              loop={segmentAiPhotoModalPreviewKind === "video"}
                              mediaKey={`segment-visual-modal:${segmentAiPhotoModalSegment.index}:${segmentAiPhotoModalPreviewKind}:${segmentAiPhotoModalPreviewUrl}:${
                                segmentAiPhotoModalPreviewPosterUrl ?? "no-poster"
                              }`}
                              muted
                              posterUrl={segmentAiPhotoModalPreviewKind === "video" ? segmentAiPhotoModalPreviewPosterUrl : null}
                              preload="auto"
                              previewKind={segmentAiPhotoModalPreviewKind}
                              previewUrl={segmentAiPhotoModalPreviewUrl}
                            />
                          ) : (
                            <div className="studio-ai-photo-modal__preview-placeholder">
                              <div className="studio-ai-photo-modal__preview-icon" aria-hidden="true">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                                  <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
                                  <path d="m7 14 3-3 2.5 2.5L16 10l3 4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                              <strong>Нет превью</strong>
                              <p>Выберите источник, чтобы обновить визуал сегмента.</p>
                            </div>
                          )}

                          <div className="studio-ai-photo-modal__preview-overlay">
                            <div className="studio-ai-photo-modal__preview-badges">
                              <span className="studio-ai-photo-modal__preview-badge">
                                Сегмент {segmentAiPhotoModalSegmentNumber ?? segmentAiPhotoModalSegment.index + 1}
                              </span>
                              <span className="studio-ai-photo-modal__preview-badge is-muted">{segmentAiPhotoModalTimeLabel}</span>
                            </div>

                            <div className="studio-ai-photo-modal__preview-badges is-footer">
                              <span className="studio-ai-photo-modal__preview-badge is-accent">{segmentAiPhotoModalSourceLabel}</span>
                              <span className="studio-ai-photo-modal__preview-badge is-muted">{segmentAiPhotoModalFormatLabel}</span>
                            </div>
                          </div>
                        </div>

                      </div>
                    </section>

                    <section className="studio-ai-photo-modal__control-pane">
                      <div className="studio-ai-photo-modal__control-head">
                        <div className="studio-ai-photo-modal__control-topline">
                          <span className="studio-ai-photo-modal__control-kicker">Визуал сегмента</span>
                          {segmentAiPhotoModalActiveStatus ? (
                            <span className={`studio-ai-photo-modal__state-chip is-${segmentAiPhotoModalActiveStatus.tone}`}>
                              {segmentAiPhotoModalActiveStatus.label}
                            </span>
                          ) : null}
                        </div>

                        <div className="studio-ai-photo-modal__control-title">
                          <strong id="segment-visual-modal-title">
                            Сегмент {segmentAiPhotoModalSegmentNumber ?? segmentAiPhotoModalSegment.index + 1}
                          </strong>
                          <p>{segmentAiPhotoModalTimeLabel}</p>
                        </div>
                      </div>

                      <div className="studio-ai-photo-modal__source-switcher" role="tablist" aria-label="Источник визуала">
                        <button
                          className={`studio-ai-photo-modal__source-tab${segmentAiPhotoModalTab === "ai_video" ? " is-active" : ""}`}
                          type="button"
                          role="tab"
                          aria-selected={segmentAiPhotoModalTab === "ai_video"}
                          onClick={() => {
                            setSegmentEditorVideoError(null);
                            setSegmentAiPhotoModalTab("ai_video");
                          }}
                        >
                          <span className="studio-ai-photo-modal__source-copy">
                            <strong>ИИ видео</strong>
                            <span>Сцена и движение</span>
                          </span>
                          {segmentAiPhotoModalAiVideoStatus ? (
                            <span className={`studio-ai-photo-modal__source-status is-${segmentAiPhotoModalAiVideoStatus.tone}`}>
                              <span className="studio-ai-photo-modal__source-status-dot" aria-hidden="true"></span>
                              {segmentAiPhotoModalAiVideoStatus.label}
                            </span>
                          ) : null}
                        </button>

                        <button
                          className={`studio-ai-photo-modal__source-tab${segmentAiPhotoModalTab === "photo_animation" ? " is-active" : ""}`}
                          type="button"
                          role="tab"
                          aria-selected={segmentAiPhotoModalTab === "photo_animation"}
                          disabled={!canAnimateSegmentPhoto}
                          title={!canAnimateSegmentPhoto ? "Только для фото" : "Анимировать фото"}
                          onClick={() => {
                            setSegmentEditorVideoError(null);
                            setSegmentAiPhotoModalTab("photo_animation");
                          }}
                        >
                          <span className="studio-ai-photo-modal__source-copy">
                            <strong>Анимация фото</strong>
                            <span>Движение из исходного фото</span>
                          </span>
                          {canAnimateSegmentPhoto ? (
                            segmentAiPhotoModalPhotoAnimationStatus ? (
                              <span className={`studio-ai-photo-modal__source-status is-${segmentAiPhotoModalPhotoAnimationStatus.tone}`}>
                                <span className="studio-ai-photo-modal__source-status-dot" aria-hidden="true"></span>
                                {segmentAiPhotoModalPhotoAnimationStatus.label}
                              </span>
                            ) : null
                          ) : (
                            <span className="studio-ai-photo-modal__source-status is-disabled">Только для фото</span>
                          )}
                        </button>

                        <button
                          className={`studio-ai-photo-modal__source-tab${segmentAiPhotoModalTab === "ai_photo" ? " is-active" : ""}`}
                          type="button"
                          role="tab"
                          aria-selected={segmentAiPhotoModalTab === "ai_photo"}
                          onClick={() => {
                            setSegmentEditorVideoError(null);
                            setSegmentAiPhotoModalTab("ai_photo");
                          }}
                        >
                          <span className="studio-ai-photo-modal__source-copy">
                            <strong>Фото</strong>
                            <span>Сцена по описанию</span>
                          </span>
                          {segmentAiPhotoModalAiPhotoStatus ? (
                            <span className={`studio-ai-photo-modal__source-status is-${segmentAiPhotoModalAiPhotoStatus.tone}`}>
                              <span className="studio-ai-photo-modal__source-status-dot" aria-hidden="true"></span>
                              {segmentAiPhotoModalAiPhotoStatus.label}
                            </span>
                          ) : null}
                        </button>

                        <button
                          className={`studio-ai-photo-modal__source-tab${segmentAiPhotoModalTab === "library" ? " is-active" : ""}`}
                          type="button"
                          role="tab"
                          aria-selected={segmentAiPhotoModalTab === "library"}
                          onClick={() => {
                            setSegmentEditorVideoError(null);
                            setSegmentAiPhotoModalTab("library");
                          }}
                        >
                          <span className="studio-ai-photo-modal__source-copy">
                            <strong>Медиатека</strong>
                            <span>Готовые AI-визуалы</span>
                          </span>
                          {segmentAiPhotoModalLibraryStatus ? (
                            <span className={`studio-ai-photo-modal__source-status is-${segmentAiPhotoModalLibraryStatus.tone}`}>
                              <span className="studio-ai-photo-modal__source-status-dot" aria-hidden="true"></span>
                              {segmentAiPhotoModalLibraryStatus.label}
                            </span>
                          ) : null}
                        </button>

                        <button
                          className={`studio-ai-photo-modal__source-tab${segmentAiPhotoModalTab === "upload" ? " is-active" : ""}`}
                          type="button"
                          role="tab"
                          aria-selected={segmentAiPhotoModalTab === "upload"}
                          onClick={() => {
                            setSegmentEditorVideoError(null);
                            setSegmentAiPhotoModalTab("upload");
                          }}
                        >
                          <span className="studio-ai-photo-modal__source-copy">
                            <strong>Свой файл</strong>
                            <span>Фото или видео</span>
                          </span>
                          {segmentAiPhotoModalUploadStatus ? (
                            <span className={`studio-ai-photo-modal__source-status is-${segmentAiPhotoModalUploadStatus.tone}`}>
                              <span className="studio-ai-photo-modal__source-status-dot" aria-hidden="true"></span>
                              {segmentAiPhotoModalUploadStatus.label}
                            </span>
                          ) : null}
                        </button>
                      </div>

                      {segmentAiPhotoModalTab === "ai_video" ? (
                        <div className="studio-ai-photo-modal__tab-panel" role="tabpanel">
                          <div className="studio-ai-photo-modal__tab-panel-head">
                            <strong>ИИ видео</strong>
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
                              rows={7}
                              placeholder="Кинематографичный крупный план астронавта в пыльной буре на Марсе, драматичный свет, плавное движение камеры"
                            />
                            <div className="studio-ai-photo-modal__field-toolbar">
                              <button
                                className="studio-ai-photo-modal__field-action"
                                type="button"
                                disabled={
                                  !canImproveSegmentAiVideoPrompt ||
                                  isSegmentAiPhotoPromptImproving ||
                                  isSegmentEditorGeneratingAiVideo ||
                                  isSegmentEditorGeneratingPhotoAnimation ||
                                  isSegmentEditorPreparingCustomVideo
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
                              className="studio-ai-photo-modal__action studio-ai-photo-modal__action--primary"
                              type="button"
                              disabled={
                                isSegmentEditorGeneratingAiVideo ||
                                isSegmentEditorGeneratingPhotoAnimation ||
                                isSegmentEditorPreparingCustomVideo ||
                                isSegmentAiPhotoPromptImproving
                              }
                              onClick={() => {
                                void handleSegmentAiVideoModalGenerate();
                              }}
                            >
                              {isSegmentAiVideoModalGeneratingCurrentSegment ? "Генерируем..." : "Сгенерировать видео(7 кредитов)"}
                            </button>
                          </div>
                        </div>
                      ) : segmentAiPhotoModalTab === "photo_animation" ? (
                        <div className="studio-ai-photo-modal__tab-panel" role="tabpanel">
                          <div className="studio-ai-photo-modal__tab-panel-head">
                            <strong>Анимация фото</strong>
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
                              rows={7}
                              placeholder="Плавный наезд камеры, легкое движение волос и ткани, атмосферный свет, кинематографичный параллакс"
                            />
                            <div className="studio-ai-photo-modal__field-toolbar">
                              <button
                                className="studio-ai-photo-modal__field-action"
                                type="button"
                                disabled={
                                  !canImproveSegmentAiVideoPrompt ||
                                  isSegmentAiPhotoPromptImproving ||
                                  isSegmentEditorGeneratingAiVideo ||
                                  isSegmentEditorGeneratingPhotoAnimation ||
                                  isSegmentEditorPreparingCustomVideo
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
                              className="studio-ai-photo-modal__action studio-ai-photo-modal__action--primary"
                              type="button"
                              disabled={
                                !canAnimateSegmentPhoto ||
                                isSegmentEditorGeneratingAiVideo ||
                                isSegmentEditorGeneratingPhotoAnimation ||
                                isSegmentEditorPreparingCustomVideo ||
                                isSegmentAiPhotoPromptImproving
                              }
                              onClick={() => {
                                void handleSegmentPhotoAnimationModalGenerate();
                              }}
                            >
                              {isSegmentPhotoAnimationModalGeneratingCurrentSegment ? "Анимируем..." : "Анимировать фото(5 кредитов)"}
                            </button>
                          </div>
                        </div>
                      ) : segmentAiPhotoModalTab === "ai_photo" ? (
                        <div className="studio-ai-photo-modal__tab-panel" role="tabpanel">
                          <div className="studio-ai-photo-modal__tab-panel-head">
                            <strong>Фото</strong>
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
                              rows={7}
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
                                  isSegmentEditorGeneratingAiVideo ||
                                  isSegmentEditorGeneratingPhotoAnimation ||
                                  isSegmentEditorPreparingCustomVideo
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
                              className="studio-ai-photo-modal__action studio-ai-photo-modal__action--primary"
                              type="button"
                              disabled={
                                isSegmentEditorGeneratingAiPhoto ||
                                isSegmentEditorGeneratingAiVideo ||
                                isSegmentEditorGeneratingPhotoAnimation ||
                                isSegmentEditorPreparingCustomVideo ||
                                isSegmentAiPhotoPromptImproving
                              }
                              onClick={() => {
                                void handleSegmentAiPhotoModalGenerateScene();
                              }}
                            >
                              {isSegmentAiPhotoModalGeneratingCurrentSegment ? "Генерируем..." : "Сгенерировать фото(2 кредита)"}
                            </button>
                          </div>
                        </div>
                      ) : segmentAiPhotoModalTab === "library" ? (
                        <div className="studio-ai-photo-modal__tab-panel" role="tabpanel">
                          <div className="studio-ai-photo-modal__tab-panel-head">
                            <strong>Медиатека</strong>
                            <p>Готовые визуалы из проектов и текущей сессии.</p>
                          </div>

                          {segmentAiPhotoModalLibraryItems.length > 0 ? (
                            <div className="studio-ai-photo-modal__library-pills" aria-hidden="true">
                              <span>Фото: {visibleAiPhotoMediaItemsCount}</span>
                              <span>ИИ видео: {visibleAiVideoMediaItemsCount}</span>
                              <span>Анимации: {visiblePhotoAnimationMediaItemsCount}</span>
                            </div>
                          ) : null}

                          {isMediaLibraryLoading && segmentAiPhotoModalLibraryItems.length === 0 ? (
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
                          ) : segmentAiPhotoModalLibraryItems.length === 0 ? (
                            <div className="studio-ai-photo-modal__library-state">
                              <div className="studio-ai-photo-modal__library-state-copy">
                                <strong>Медиатека пока пуста</strong>
                                <p>Сначала сохраните хотя бы один AI-визуал.</p>
                              </div>
                            </div>
                          ) : (
                            <div className="studio-ai-photo-modal__library-grid">
                              {segmentAiPhotoModalLibraryItems.map((item) => {
                                const itemKey = getWorkspaceMediaLibraryItemStorageKey(item);
                                const rawItemKindLabel = getWorkspaceMediaLibraryItemKindLabel(item.kind);
                                const itemKindLabel = rawItemKindLabel === "ИИ фото" ? "Фото" : rawItemKindLabel;
                                const isSelectedLibraryItem = itemKey === segmentAiPhotoModalSelectedLibraryItemKey;

                                return (
                                  <button
                                    key={`segment-modal-library:${itemKey}`}
                                    className={`studio-ai-photo-modal__library-card${isSelectedLibraryItem ? " is-selected" : ""}`}
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
                                      <WorkspaceSegmentPreviewCardMedia
                                        autoplay={false}
                                        imageLoading="lazy"
                                        mediaKey={`segment-modal-library:${itemKey}:${item.previewPosterUrl ?? "no-poster"}`}
                                        muted
                                        posterUrl={item.previewKind === "video" ? item.previewPosterUrl : null}
                                        preferPosterFrame
                                        preload="none"
                                        previewKind={item.previewKind}
                                        previewUrl={item.previewUrl}
                                      />
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="studio-ai-photo-modal__tab-panel" role="tabpanel">
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
                                isSegmentEditorGeneratingAiVideo ||
                                isSegmentEditorGeneratingPhotoAnimation
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
        {previewModalVideoPlaybackUrl ? (
          <div
            className={`studio-video-modal${isAnyPreviewModalOpen ? " is-open" : ""}`}
            role="dialog"
            aria-hidden={!isAnyPreviewModalOpen}
            aria-modal={isAnyPreviewModalOpen ? "true" : undefined}
            aria-labelledby="studio-video-modal-title"
          >
            <button
              className="studio-video-modal__backdrop route-close"
              type="button"
              aria-label="Закрыть превью"
              onClick={closePreviewModals}
            />
            <div className="studio-video-modal__panel" role="document">
              <button className="studio-video-modal__close route-close" type="button" aria-label="Закрыть превью" onClick={closePreviewModals}>
                ×
              </button>
              <div className="studio-video-modal__layout">
                <div className="studio-video-modal__player-slot">
                  <div className="studio-video-modal__player">
                    <video
                      ref={handlePreviewModalVideoRef}
                      key={`${isProjectPreviewModalOpen ? projectPreviewModal?.id ?? "project" : generatedVideo?.id ?? "generated"}-${previewModalSourceKey}-${previewModalOpenToken || previewModalUpdatedAt || "modal"}`}
                      src={previewModalVideoPlaybackUrl}
                      controls
                      autoPlay={isAnyPreviewModalOpen}
                      playsInline
                      preload="metadata"
                      onCanPlay={handlePreviewModalVideoCanPlay}
                      onClick={handlePreviewModalVideoClick}
                      onLoadedData={handlePreviewModalVideoLoadedData}
                      onPlay={handlePreviewModalVideoPlay}
                      onError={handlePreviewModalVideoError}
                    />
                    {previewModalPlaybackError ? (
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
                    ) : null}
                    {isProjectPreviewModalOpen && previewModalProject ? (
                      <div className="studio-video-modal__quick-actions" aria-label="Быстрые действия проекта">
                        <button
                          className="studio-canvas-preview__quick-action"
                          type="button"
                          aria-label="Открыть Shorts по сегментам"
                          title={canEditPreviewModalProject ? "Открыть Shorts по сегментам" : "Shorts по сегментам доступны после сохранения проекта"}
                          disabled={!canEditPreviewModalProject || isPreviewModalProjectActionBusy}
                          onClick={() => void handleOpenPreviewModalProjectSegmentEditor()}
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
                          title={canPublishPreviewModalProject ? "Опубликовать" : "Публикация доступна после сохранения проекта"}
                          disabled={!canPublishPreviewModalProject || isPreviewModalProjectActionBusy}
                          onClick={() => void handleOpenProjectPublish(previewModalProject)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M14 5h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M10 14 19 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {isLocalExamplesEnabled ? (
                          <button
                            className="studio-canvas-preview__quick-action studio-canvas-preview__quick-action--accent"
                            type="button"
                            aria-label="Добавить видео в локальные примеры"
                            title="Добавить в примеры"
                            disabled={!canAddPreviewModalProjectToExamples || isSavingLocalExample}
                            onClick={() => handleOpenProjectLocalExampleModal(previewModalProject)}
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
                          href={previewModalVideoPlaybackUrl}
                          download={previewModalDownloadName}
                          aria-label="Скачать видео"
                          title="Скачать"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </a>
                      </div>
                    ) : (
                      <a
                        className="studio-video-modal__download"
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
                    )}
                  </div>
                </div>

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
                    {isProjectPreviewModalOpen ? (
                      <div className="studio-video-modal__meta">
                        <span className="studio-video-modal__label">Обновлен</span>
                        <p className="studio-video-modal__description">{formatProjectDate(previewModalUpdatedAt)}</p>
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
                    {isProjectPreviewModalOpen ? (
                      <>
                        <button className="studio-video-modal__action studio-video-modal__action--primary route-button" type="button" onClick={() => void handlePublishPreview()}>
                          Опубликовать
                        </button>
                        <a
                          className="studio-video-modal__action route-button"
                          href={previewModalVideoPlaybackUrl}
                          download={previewModalDownloadName}
                        >
                          Скачать видео
                        </a>
                      </>
                    ) : (
                      <>
                        <button className="studio-video-modal__action studio-video-modal__action--primary route-button" type="button" onClick={() => void handlePublishPreview()}>
                          Опубликовать
                        </button>
                        <button className="studio-video-modal__action route-button" type="button" onClick={() => void handleRegeneratePreview()}>
                          Перегенерировать
                        </button>
                      </>
                    )}
                  </div>
                </div>
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
                {publishHeaderStatusLink ? (
                  <a
                    className={`studio-publish-modal__header-status is-clickable is-${publishStatusTone}`}
                    href={publishHeaderStatusLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="studio-publish-modal__header-status-label">{publishStatusLabel}</span>
                    <small>{publishHeaderStatusMeta}</small>
                  </a>
                ) : (
                  <div className={`studio-publish-modal__header-status is-${publishStatusTone}`}>
                    <span className="studio-publish-modal__header-status-label">{publishStatusLabel}</span>
                    <small>{publishHeaderStatusMeta}</small>
                  </div>
                )}
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
                      <section className="studio-publish-modal__section">
                        <div className="studio-publish-modal__section-head">
                          <div>
                            <span className="studio-publish-modal__section-kicker">Канал</span>
                            <strong>Куда публиковать</strong>
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
                              <p>Подключите YouTube-канал и вернитесь к публикации без выхода из студии.</p>
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
                            <strong>Когда отправить Shorts</strong>
                            <p>Выберите мгновенную публикацию или соберите расписание в календаре.</p>
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
                          </button>
                          <button
                            className={`studio-publish-modal__mode-card${publishMode === "schedule" ? " is-active" : ""}`}
                            type="button"
                            onClick={() => handlePublishModeChange("schedule")}
                          >
                            <span>По расписанию</span>
                            <strong>Запланировать публикацию</strong>
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
                                        <div className="studio-publish-modal__time-head">
                                          <strong>Время</strong>
                                          <p>Часовой пояс браузера</p>
                                        </div>

                                        <div className="studio-publish-modal__time-presets">
                                          {publishTimePresets.map((timePreset) => (
                                            <button
                                              key={timePreset}
                                              className={`studio-publish-modal__time-preset${publishTimeValue === timePreset ? " is-active" : ""}`}
                                              type="button"
                                              onClick={() => handlePublishTimeSelect(timePreset)}
                                            >
                                              {timePreset}
                                            </button>
                                          ))}
                                        </div>

                                        <label className="studio-publish-modal__field studio-publish-modal__field--time" htmlFor={publishTimeFieldId}>
                                          <span className="studio-publish-modal__field-label">
                                            <span>Точное время</span>
                                            <small>24 часа</small>
                                          </span>
                                          <input
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
	                    {projects.map((project) => (
	                      <article className="account-library__item account-project-card" key={project.id}>
                        <div className="account-project-card__meta">
                          <span className="account-library__label">
                            {project.adId ? `Проект #${project.adId}` : `Job ${project.jobId?.slice(0, 8) ?? "N/A"}`}
                          </span>
                          <span className={`account-status ${getProjectStatusClassName(project.status)}`}>
                            {getProjectStatusLabel(project.status)}
                          </span>
                      </div>

                        <h4>{project.title}</h4>
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
                                onClick={() => requestProjectDelete(project)}
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
	                  </article>
                    ))}
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
                            <button className="account-topup__cta" type="button" onClick={openWorkspaceCreditPacks}>
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
