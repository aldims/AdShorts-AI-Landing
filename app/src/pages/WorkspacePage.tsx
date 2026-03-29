import { type CSSProperties, type ChangeEvent, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AccountMenuButton } from "../components/AccountMenuButton";
import { PrimarySiteNav } from "../components/PrimarySiteNav";
import { SiteHeaderWorkspaceStatus } from "../components/SiteHeaderWorkspaceStatus";
import { clearExamplePrefillIntent, readExamplePrefillIntent } from "../lib/example-prefill";

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

type StudioGenerationRequest = {
  customMusicFileDataUrl?: string;
  customMusicFileName?: string;
  customVideoFileDataUrl?: string;
  customVideoFileMimeType?: string;
  customVideoFileName?: string;
  isRegeneration?: boolean;
  language?: StudioLanguage;
  musicType?: string;
  prompt: string;
  subtitleColorId?: string;
  subtitleStyleId?: string;
  videoMode?: string;
  voiceId?: string;
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
  dataUrl: string;
  fileName: string;
  fileSize: number;
};

type StudioVideoMode = "ai_photo" | "ai_video" | "custom" | "standard";

type StudioVideoOption = {
  costLabel?: string;
  description: string;
  id: StudioVideoMode;
  label: string;
};

type StudioCustomVideoFile = {
  dataUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
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
  state: StudioSubtitlePreviewWordState;
  text: string;
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

const studioSubtitleExampleOptions: StudioSubtitleExampleOption[] = [
  {
    activeWordIndex: 2,
    id: "hook",
    label: "Хук",
    note: "Первые 2 секунды",
    lines: ["Это не монтаж,", "это сценарий"],
  },
  {
    activeWordIndex: 2,
    id: "offer",
    label: "Оффер",
    note: "Показывает выгоду",
    lines: ["Запуск за 15 минут", "без команды и продакшна"],
  },
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

const getStudioSubtitlePreviewStyle = (style: StudioSubtitleStyleOption, color: StudioSubtitleColorOption) =>
  ({
    "--subtitle-accent": studioSubtitleStyleUsesAccentColor(style) ? color.accent : "#FFFFFF",
    "--subtitle-outline": studioSubtitleStyleUsesAccentColor(style) ? color.outline : "rgba(255, 255, 255, 0.18)",
    "--subtitle-preview-active-lift":
      style.wordEffect === "slide" ? "-2px" : style.wordEffect === "scale" ? "-1px" : "0px",
    "--subtitle-preview-active-scale":
      style.wordEffect === "scale" ? (style.id === "impact" ? "1.12" : "1.06") : "1",
    "--subtitle-preview-font-family": getStudioSubtitlePreviewFontFamily(style.fontFamily),
    "--subtitle-preview-font-size":
      `${Math.max(14, Math.min(30, Math.round(style.fontSize / (style.id === "impact" ? 3.8 : style.id === "cinema" ? 4.8 : 4.4))))}px`,
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
    "--subtitle-preview-line-height": style.id === "cinema" ? "1.18" : style.id === "editorial" ? "1.12" : "1.03",
    "--subtitle-preview-caption-width": style.id === "editorial" ? "88%" : style.id === "cinema" ? "92%" : style.id === "impact" ? "78%" : "82%",
    "--subtitle-preview-word-gap": style.id === "editorial" ? "0.4em" : style.id === "cinema" ? "0.28em" : "0.32em",
  }) as CSSProperties;
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
  },
  {
    id: "ai_photo",
    label: "Только ИИ фото",
    description: "Только анимированные ИИ фото, без стоков",
  },
  {
    id: "ai_video",
    label: "ИИ видео",
    description: "Полностью ИИ-режим с Wan I2V для всех сцен",
    costLabel: "3 кредита",
  },
  {
    id: "custom",
    label: "Свое видео",
    description: "Загрузите свой mp4, mov, webm или m4v",
  },
];
const projectPosterCache = new Map<string, string>();
const PROJECTS_REQUEST_TIMEOUT_MS = 25_000;
const FALLBACK_VIDEO_DOWNLOAD_NAME = "adshorts-video";

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

const getStudioVideoChipValue = (videoMode: StudioVideoMode, customVideoFile: StudioCustomVideoFile | null) => {
  if (videoMode === "custom") {
    return customVideoFile ? truncateStudioCustomAssetName(customVideoFile.fileName) : "Свое видео";
  }

  return studioVideoOptions.find((option) => option.id === videoMode)?.label ?? "Стандартный";
};

const getRequiredCreditsForVideoMode = (videoMode: StudioVideoMode) => (videoMode === "ai_video" ? 3 : 1);

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

const getVideoDownloadName = (value: string) => {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedValue ? `${normalizedValue}.mp4` : `${FALLBACK_VIDEO_DOWNLOAD_NAME}.mp4`;
};

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

const captureProjectPoster = (videoUrl: string) =>
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

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        fail(new Error("Canvas context is unavailable."));
        return;
      }

      context.drawImage(video, 0, 0, width, height);
      settled = true;
      cleanup();
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    video.onloadeddata = () => {
      if (settled) return;

      const previewTime = Number.isFinite(video.duration) && video.duration > 0.15 ? 0.15 : 0;
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

type WorkspaceProjectCardProps = {
  isPreviewing: boolean;
  onActivate: (projectId: string, hasVideo: boolean) => void;
  onBlur: (event: ReactFocusEvent<HTMLElement>) => void;
  onDeactivate: (projectId: string) => void;
  onOpenPreview: (project: WorkspaceProject) => void;
  project: WorkspaceProject;
};

function WorkspaceProjectCard({
  isPreviewing,
  onActivate,
  onBlur,
  onDeactivate,
  onOpenPreview,
  project,
}: WorkspaceProjectCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const projectPreviewNote = getProjectPreviewNote(project);
  const [shouldResolvePoster, setShouldResolvePoster] = useState(false);
  const [shouldWarmVideo, setShouldWarmVideo] = useState(false);
  const [isPreviewVideoReady, setIsPreviewVideoReady] = useState(false);
  const publicationStatusLabel = getYouTubePublicationStatusLabel(project.youtubePublication);
  const publicationMetaLabel = getYouTubePublicationMetaLabel(project.youtubePublication);
  const [posterUrl, setPosterUrl] = useState<string | null>(() => {
    if (!project.videoUrl) return null;
    return projectPosterCache.get(project.videoUrl) ?? null;
  });

  useEffect(() => {
    if (!project.videoUrl) {
      setPosterUrl(null);
      setShouldWarmVideo(false);
      setIsPreviewVideoReady(false);
      return;
    }

    setPosterUrl(projectPosterCache.get(project.videoUrl) ?? null);
    setIsPreviewVideoReady(false);
  }, [project.videoUrl]);

  useEffect(() => {
    if (!project.videoUrl || posterUrl || shouldResolvePoster || typeof IntersectionObserver === "undefined") {
      if (project.videoUrl && !posterUrl && typeof IntersectionObserver === "undefined") {
        setShouldResolvePoster(true);
      }
      return;
    }

    const node = cardRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShouldResolvePoster(true);
        if (project.videoUrl) {
          setShouldWarmVideo(true);
        }
        observer.disconnect();
      },
      {
        rootMargin: "320px 0px",
        threshold: 0.15,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [posterUrl, project.videoUrl, shouldResolvePoster]);

  useEffect(() => {
    if (!project.videoUrl || posterUrl || !shouldResolvePoster) return;

    const cachedPoster = projectPosterCache.get(project.videoUrl);
    if (cachedPoster) {
      setPosterUrl(cachedPoster);
      return;
    }

    let cancelled = false;

    void captureProjectPoster(project.videoUrl)
      .then((capturedPosterUrl) => {
        if (cancelled) return;
        projectPosterCache.set(project.videoUrl as string, capturedPosterUrl);
        setPosterUrl(capturedPosterUrl);
      })
      .catch(() => {
        if (cancelled) return;
        setPosterUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [posterUrl, project.videoUrl, shouldResolvePoster]);

  useEffect(() => {
    if (!project.videoUrl || !shouldWarmVideo) return;

    const videoElement = previewVideoRef.current;
    if (!videoElement) return;

    videoElement.preload = "auto";
    videoElement.load();
  }, [project.videoUrl, shouldWarmVideo]);

  useEffect(() => {
    const videoElement = previewVideoRef.current;
    if (!videoElement || !project.videoUrl || !shouldWarmVideo) return;

    if (!isPreviewing) {
      videoElement.pause();
      return;
    }

    void videoElement.play().catch(() => {
      // Ignore autoplay rejection for hover preview.
    });
  }, [isPreviewing, project.videoUrl, shouldWarmVideo]);

  return (
    <article
      ref={cardRef}
      className={`studio-project-card${isPreviewing ? " is-previewing" : ""}${isPreviewing && isPreviewVideoReady ? " is-preview-ready" : ""}`}
      onMouseEnter={() => {
        if (project.videoUrl) {
          setShouldWarmVideo(true);
        }
        onActivate(project.id, Boolean(project.videoUrl));
      }}
      onMouseLeave={() => onDeactivate(project.id)}
      onFocusCapture={() => {
        if (project.videoUrl) {
          setShouldWarmVideo(true);
        }
        onActivate(project.id, Boolean(project.videoUrl));
      }}
      onBlurCapture={onBlur}
    >
      <div className="studio-project-card__thumb">
        <div className="studio-project-card__thumb-poster" aria-hidden={isPreviewing}>
          {posterUrl ? <img className="studio-project-card__thumb-image" src={posterUrl} alt="" /> : null}
          <div className={`studio-project-card__thumb-placeholder${posterUrl ? " has-image" : ""}`}>
            {!posterUrl ? (
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
        {project.videoUrl && shouldWarmVideo ? (
          <div className="studio-project-card__thumb-media">
            <video
              ref={previewVideoRef}
              src={project.videoUrl}
              muted
              playsInline
              loop
              preload="auto"
              onCanPlay={() => setIsPreviewVideoReady(true)}
            />
          </div>
        ) : null}
        {project.videoUrl ? (
          <button
            className="studio-project-card__thumb-trigger"
            type="button"
            aria-label={`Открыть превью: ${project.title || "Без названия"}`}
            onClick={() => onOpenPreview(project)}
          />
        ) : null}
        <span className={`studio-project-card__status studio-project-card__status--${project.status}`}>
          {getProjectStatusLabel(project.status)}
        </span>
      </div>
      <div className="studio-project-card__body">
        <p>{project.prompt || project.description}</p>
        {publicationStatusLabel ? (
          <div className="studio-project-card__publication">
            <strong>{publicationStatusLabel}</strong>
            {project.youtubePublication?.link ? (
              <a href={project.youtubePublication.link} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
                Открыть
              </a>
            ) : null}
            {publicationMetaLabel ? <span>{publicationMetaLabel}</span> : null}
          </div>
        ) : null}
        <span className="studio-project-card__date">{formatProjectDate(project.updatedAt)}</span>
      </div>
      {project.videoUrl ? (
        <a
          className="studio-project-card__link"
          href={project.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Открыть видео"
          onClick={(event) => event.stopPropagation()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>
      ) : null}
    </article>
  );
}

const formatProjectDate = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Дата недоступна";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
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

const getYouTubePublicationStatusLabel = (publication: WorkspaceProjectYouTubePublication | null | undefined) => {
  const state = String(publication?.state ?? "").trim().toLowerCase();
  if (state === "published") return "YouTube: опубликовано";
  if (state === "scheduled") return "YouTube: запланировано";
  return "";
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
    name: "Pack 10",
    credits: "10 кредитов",
    price: "690 ₽",
    subnote: "~69 ₽ за кредит",
  },
  {
    name: "Pack 50",
    credits: "50 кредитов",
    price: "2 750 ₽",
    subnote: "~55 ₽ за кредит",
    badge: "Выгодно",
  },
  {
    name: "Pack 100",
    credits: "100 кредитов",
    price: "4 990 ₽",
    subnote: "~50 ₽ за кредит",
  },
];

type StudioView = "create" | "projects";

type StudioSubtitleSelectorChipProps = {
  onSelectColor: (colorId: StudioSubtitleColorOption["id"]) => void;
  onSelectExample: (exampleId: StudioSubtitleExampleOption["id"]) => void;
  onSelectStyle: (styleId: StudioSubtitleStyleOption["id"]) => void;
  selectedColorId: StudioSubtitleColorOption["id"];
  selectedExampleId: StudioSubtitleExampleOption["id"];
  selectedStyleId: StudioSubtitleStyleOption["id"];
  subtitleColorOptions: StudioSubtitleColorOption[];
  subtitleStyleOptions: StudioSubtitleStyleOption[];
};

type StudioLanguageSelectorChipProps = {
  onSelect: (language: StudioLanguage) => void;
  selectedLanguage: StudioLanguage;
};

type StudioVoiceSelectorChipProps = {
  onSelect: (voiceId: StudioVoiceOption["id"]) => void;
  selectedVoiceId: StudioVoiceOption["id"];
  voiceOptions: StudioVoiceOption[];
};

type StudioMusicSelectorChipProps = {
  customMusicFile: StudioCustomMusicFile | null;
  isPreparingCustomMusic: boolean;
  onSelectCustomFile: (file: File) => Promise<void>;
  onSelectMusicType: (musicType: StudioMusicType) => void;
  selectedMusicType: StudioMusicType;
  uploadError: string | null;
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
  onSelectColor,
  onSelectExample,
  onSelectStyle,
  selectedColorId,
  selectedExampleId,
  selectedStyleId,
  subtitleColorOptions,
  subtitleStyleOptions,
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
    <div className="studio-subtitle-selector" ref={rootRef}>
      <button
        ref={triggerRef}
        className={`studio-canvas-prompt__chip studio-subtitle-selector__trigger${isOpen ? " is-open" : ""}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="studio-subtitle-selector__label">Субтитры</span>
        <strong className="studio-subtitle-selector__value">{selectedStyle.label}</strong>
        <svg className="studio-subtitle-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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
                  <span>Стиль</span>
                </div>
                <div className="studio-subtitle-selector__styles">
                  {safeStyleOptions.map((style) => (
                    <button
                      key={style.id}
                      className={`studio-subtitle-selector__style${style.id === selectedStyleId ? " is-selected" : ""}`}
                      type="button"
                      onClick={() => onSelectStyle(style.id)}
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

function StudioLanguageSelectorChip({ onSelect, selectedLanguage }: StudioLanguageSelectorChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = studioLanguageOptions.find((option) => option.id === selectedLanguage) ?? studioLanguageOptions[0];

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
    <div className="studio-voice-selector studio-voice-selector--language" ref={rootRef}>
      <button
        ref={triggerRef}
        className={`studio-canvas-prompt__chip studio-voice-selector__trigger${isOpen ? " is-open" : ""}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="studio-voice-selector__label">Язык</span>
        <strong className="studio-voice-selector__value">{selectedOption?.label ?? "Русский"}</strong>
        <svg className="studio-voice-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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

function StudioVoiceSelectorChip({ onSelect, selectedVoiceId, voiceOptions }: StudioVoiceSelectorChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<StudioVoiceOption["id"] | null>(null);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const selectedVoice = voiceOptions.find((voice) => voice.id === selectedVoiceId) ?? voiceOptions[0];

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
    <div className="studio-voice-selector" ref={rootRef}>
      <button
        ref={triggerRef}
        className={`studio-canvas-prompt__chip studio-voice-selector__trigger${isOpen ? " is-open" : ""}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="studio-voice-selector__label">Озвучка</span>
        <strong className="studio-voice-selector__value">{selectedVoice?.label ?? "Выберите голос"}</strong>
        <svg className="studio-voice-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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
              {voiceOptions.map((voice) => (
                (() => {
                  const canPreviewVoice = Boolean(voice.previewSampleUrl || voice.previewText);

                  return (
                    <div
                      key={voice.id}
                      className={`studio-voice-selector__option${voice.id === selectedVoiceId ? " is-selected" : ""}`}
                    >
                      <button
                        className="studio-voice-selector__option-main"
                        type="button"
                        role="menuitemradio"
                        aria-checked={voice.id === selectedVoiceId}
                        onClick={() => {
                          stopVoicePreview();
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
    <div className="studio-music-selector" ref={rootRef}>
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
        className={`studio-canvas-prompt__chip studio-music-selector__trigger${isOpen ? " is-open" : ""}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="studio-music-selector__label">Музыка</span>
        <strong className="studio-music-selector__value" title={selectedMusicTitle}>
          {selectedMusicLabel}
        </strong>
        <svg className="studio-music-selector__icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 4.5 6 8l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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
  const preserveExamplePrefillRef = useRef(Boolean(initialExamplePrefillRef.current));
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(defaultTab);
  const [studioView, setStudioView] = useState<StudioView>("create");
  const [topicInput, setTopicInput] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<StudioLanguage>("ru");
  const [subtitleStyleOptions, setSubtitleStyleOptions] = useState<StudioSubtitleStyleOption[]>([]);
  const [subtitleColorCatalog, setSubtitleColorCatalog] = useState<StudioSubtitleColorCatalogOption[]>([]);
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
  const [studioPreviewVolume, setStudioPreviewVolume] = useState(0.88);
  const [workspaceProfile, setWorkspaceProfile] = useState<WorkspaceProfile | null>(initialProfile);
  const [generatedVideo, setGeneratedVideo] = useState<StudioGeneration | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [hasLoadedProjects, setHasLoadedProjects] = useState(false);
  const [activeProjectPreviewId, setActiveProjectPreviewId] = useState<string | null>(null);
  const [projectPreviewModal, setProjectPreviewModal] = useState<WorkspaceProject | null>(null);
  const [previewModalOpenToken, setPreviewModalOpenToken] = useState<number>(0);
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
  const resetTimerRef = useRef<number | null>(null);
  const generationRunRef = useRef(0);
  const publishRunRef = useRef(0);
  const publishPlannerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const publishPlannerPopoverRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
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

  const isAnyPreviewModalOpen = isPreviewModalOpen || Boolean(projectPreviewModal) || isPublishModalOpen;

  const closePreviewModals = () => {
    setIsPreviewModalOpen(false);
    setProjectPreviewModal(null);
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

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.body.classList.toggle("modal-open", isAnyPreviewModalOpen);

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [isAnyPreviewModalOpen]);

  useEffect(() => {
    if (!isAnyPreviewModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isPublishModalOpen) {
          closePublishModal();
          return;
        }
        closePreviewModals();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAnyPreviewModalOpen, isPublishModalOpen]);

  useEffect(() => {
    if (activeTab !== "studio" && isAnyPreviewModalOpen) {
      closePublishModal();
      closePreviewModals();
    }
  }, [activeTab, isAnyPreviewModalOpen]);

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
    setHasLoadedProjects(false);
    setActiveProjectPreviewId(null);
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
  }, [session.email]);

  useEffect(() => {
    if (!generatedVideo?.id) return;
    setHasLoadedProjects(false);
  }, [generatedVideo?.id]);

  useEffect(() => {
    setIsStudioPreviewInlineActive(false);
    setStudioPreviewCurrentTime(0);
    setStudioPreviewDuration(0);
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
    if (generatedVideo?.videoUrl) {
      return;
    }

    const fallbackProject = projects.find((project) => project.status === "ready" && Boolean(project.videoUrl));
    if (!fallbackProject) {
      return;
    }

    const fallbackGeneration = buildStudioGenerationFromProject(fallbackProject);
    if (!fallbackGeneration) {
      return;
    }

    setGeneratedVideo(fallbackGeneration);
    setGenerateError(null);

    if (!preserveExamplePrefillRef.current && !topicInput.trim() && fallbackGeneration.prompt.trim()) {
      setTopicInput(fallbackGeneration.prompt);
    }
  }, [generatedVideo?.videoUrl, projects, topicInput]);

  useEffect(() => {
    if (activeTab !== "studio" || studioView !== "projects") {
      setActiveProjectPreviewId(null);
    }
  }, [activeTab, studioView]);

  const shouldLoadProjects = !hasLoadedProjects;

  useEffect(() => {
    if (!shouldLoadProjects) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort("projects-timeout"), PROJECTS_REQUEST_TIMEOUT_MS);

    const loadProjects = async () => {
      setIsProjectsLoading(true);
      setProjectsError(null);

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
  const previewModalVideoUrl = isProjectPreviewModalOpen
    ? projectPreviewModal?.videoUrl ?? null
    : isPreviewModalOpen
      ? generatedVideo?.videoUrl ?? null
      : null;
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
  const previewModalVideoPlaybackUrl = appendUrlToken(
    previewModalVideoUrl,
    "playback",
    previewModalOpenToken || previewModalUpdatedAt || generatedVideo?.generatedAt || generatedVideo?.id,
  );
  const shouldPreferMutedModalFallback = true;
  const previewModalDownloadName = getVideoDownloadName(previewModalTitle);
  const studioInlinePreviewDownloadName = getVideoDownloadName(generatedVideoModalTitle);
  const hasPreviewModalDescription = Boolean(previewModalDescription);
  const hasPreviewModalHashtags = previewModalHashtags.length > 0;
  const selectedVoiceOptions = studioVoiceOptionsByLanguage[selectedLanguage];
  const resolvedSelectedVoiceId =
    selectedVoiceOptions.find((voice) => voice.id === selectedVoiceId)?.id ?? selectedVoiceOptions[0]?.id ?? "";
  const readyProjectsCount = projects.filter((project) => project.status === "ready").length;
  const activeProjectsCount = projects.filter(
    (project) => project.status === "queued" || project.status === "processing",
  ).length;
  const failedProjectsCount = projects.filter((project) => project.status === "failed").length;

  useEffect(() => {
    if (!resolvedSelectedVoiceId || resolvedSelectedVoiceId === selectedVoiceId) {
      return;
    }

    setSelectedVoiceId(resolvedSelectedVoiceId);
  }, [resolvedSelectedVoiceId, selectedVoiceId]);

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
    const currentStyle = subtitleStyleOptions.find((style) => style.id === selectedSubtitleStyleId);
    const nextStyle = subtitleStyleOptions.find((style) => style.id === styleId);

    setSelectedSubtitleStyleId(styleId);

    if (!nextStyle) {
      return;
    }

    const hasKnownCurrentColor = subtitleColorOptions.some((color) => color.id === selectedSubtitleColorId);
    const shouldFollowStyleDefault =
      !hasKnownCurrentColor ||
      !selectedSubtitleColorId ||
      (currentStyle ? selectedSubtitleColorId === currentStyle.defaultColorId : selectedSubtitleColorId === "purple");

    if (shouldFollowStyleDefault) {
      setSelectedSubtitleColorId(nextStyle.defaultColorId);
    }
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
      const dataUrl = await readFileAsDataUrl(file);
      setSelectedCustomVideo({
        dataUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "video/mp4",
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
      return;
    }

    if (file.size > STUDIO_CUSTOM_MUSIC_MAX_BYTES) {
      setMusicSelectionError("Аудиофайл слишком большой. Максимум 18 МБ.");
      return;
    }

    setIsPreparingCustomMusic(true);
    setMusicSelectionError(null);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSelectedCustomMusic({
        dataUrl,
        fileName: file.name,
        fileSize: file.size,
      });
      setSelectedMusicType("custom");
    } catch (error) {
      setMusicSelectionError(error instanceof Error ? error.message : "Не удалось подготовить аудиофайл.");
    } finally {
      setIsPreparingCustomMusic(false);
    }
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

  const pollGenerationJob = async (jobId: string, initialStatus = "queued") => {
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

      while (generationRunRef.current === runId) {
        const statusResponse = await fetch(`/api/studio/generations/${encodeURIComponent(safeJobId)}`);
        const statusPayload = (await statusResponse.json().catch(() => null)) as StudioGenerationStatusResponse | null;

        if (!statusResponse.ok || !statusPayload?.data) {
          throw new Error(statusPayload?.error ?? "Failed to fetch generation status.");
        }

        latestStatus = statusPayload.data.status;
        setStatus(getStudioStatusLabel(latestStatus));

        if (statusPayload.data.generation) {
          setGeneratedVideo(statusPayload.data.generation);
          setGenerateError(statusPayload.data.error ?? null);
          setTopicInput(statusPayload.data.generation.prompt);
          setStatus("");
          break;
        }

        if (latestStatus === "done") {
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

  const handleGenerate = async (nextTopic: string, options?: { isRegeneration?: boolean }) => {
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

    flushSync(() => {
    setTopicInput(safeTopic);
      setGeneratedVideo(null);
      setIsGenerating(true);
    setIsPreviewModalOpen(false);
    setGenerateError(null);
      setVideoSelectionError(null);
      setMusicSelectionError(null);
      setHasLoadedProjects(false);
    setStatus("Task queued");
    });

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });

    try {
      const response = await fetch("/api/studio/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customMusicFileDataUrl: selectedMusicType === "custom" ? selectedCustomMusic?.dataUrl : undefined,
          customMusicFileName: selectedMusicType === "custom" ? selectedCustomMusic?.fileName : undefined,
          customVideoFileDataUrl: selectedVideoMode === "custom" ? selectedCustomVideo?.dataUrl : undefined,
          customVideoFileMimeType: selectedVideoMode === "custom" ? selectedCustomVideo?.mimeType : undefined,
          customVideoFileName: selectedVideoMode === "custom" ? selectedCustomVideo?.fileName : undefined,
          isRegeneration: Boolean(options?.isRegeneration),
          language: selectedLanguage,
          musicType: selectedMusicType,
          prompt: safeTopic,
          subtitleColorId: selectedSubtitleColorId,
          subtitleStyleId: selectedSubtitleStyleId,
          videoMode: selectedVideoMode,
          voiceId: resolvedSelectedVoiceId || undefined,
        } satisfies StudioGenerationRequest),
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
      await pollGenerationJob(payload.data.jobId, payload.data.status);
    } catch (error) {
      setIsGenerating(false);
      setStatus("Generation failed");
      setGenerateError(error instanceof Error ? error.message : "Failed to generate task.");
    }
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

  const handleRegeneratePreview = async () => {
    if (!generatedVideo) return;

    closePreviewModals();
    await handleGenerate(generatedVideo.prompt, { isRegeneration: true });
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

  const queuePreviewModalPlayback = (options?: { resetToStart?: boolean }) => {
    window.requestAnimationFrame(() => {
      const modalElement = previewModalVideoRef.current;
      if (!modalElement) return;

      modalElement.preload = "auto";

      if (options?.resetToStart) {
        try {
          modalElement.currentTime = 0;
        } catch {
          // Ignore timing reset until metadata is ready.
        }
      }

      void playVideoElement(modalElement, shouldPreferMutedModalFallback);
    });
  };

  const handleOpenPreviewModal = () => {
    if (!generatedVideo) return;

    setProjectPreviewModal(null);
    setPreviewModalOpenToken(Date.now());
    setIsPreviewModalOpen(true);
    syncPreviewPlaybackPosition();
    queuePreviewModalPlayback();
  };

  const handleOpenProjectPreviewModal = (project: WorkspaceProject) => {
    if (!project.videoUrl) return;

    flushSync(() => {
    setIsPreviewModalOpen(false);
      setProjectPreviewModal(project);
      setPreviewModalOpenToken(Date.now());
    });
    queuePreviewModalPlayback({ resetToStart: true });
  };

  const playStudioPreviewElement = async () => {
    const previewElement = previewVideoRef.current;
    if (!previewElement) return;

    previewElement.preload = "auto";

    if (isStudioPreviewInlineActive) {
      previewElement.volume = studioPreviewVolume;
      previewElement.muted = studioPreviewVolume <= 0;
      previewElement.defaultMuted = studioPreviewVolume <= 0;

      try {
        await previewElement.play();
        return;
      } catch {
        setIsStudioPreviewInlineActive(false);
      }
    }

    previewElement.muted = true;
    previewElement.defaultMuted = true;
    await playVideoElement(previewElement, true);
  };

  const handleStudioPreviewKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    if (!isStudioPreviewInlineActive) {
      void handleEnableInlineStudioPreview();
      return;
    }

    void handleStudioPreviewTogglePlayback();
  };

  const handleEnableInlineStudioPreview = async () => {
    const previewElement = previewVideoRef.current;
    if (!previewElement) return;

    setIsStudioPreviewInlineActive(true);
    previewElement.preload = "auto";
    previewElement.volume = studioPreviewVolume;
    previewElement.muted = studioPreviewVolume <= 0;
    previewElement.defaultMuted = studioPreviewVolume <= 0;

    try {
      await previewElement.play();
    } catch {
      setIsStudioPreviewInlineActive(false);
      previewElement.muted = true;
      previewElement.defaultMuted = true;
      await playVideoElement(previewElement, true);
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
    if (!isStudioPreviewInlineActive) {
      void handleEnableInlineStudioPreview();
      return;
    }

    void handleStudioPreviewTogglePlayback();
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
    if (!generatedVideo) return;

    const previewElement = previewVideoRef.current;
    if (!previewElement) return;

    if (activeTab !== "studio" || studioView !== "create" || isPreviewModalOpen) {
      previewElement.pause();
      previewElement.preload = "auto";
      previewElement.load();
      return;
    }

    void playStudioPreviewElement();
  }, [activeTab, generatedVideo?.id, isPreviewModalOpen, isStudioPreviewInlineActive, studioView]);

  useEffect(() => {
    if (!isAnyPreviewModalOpen) {
      previewModalVideoRef.current?.pause();

      const previewElement = previewVideoRef.current;
      if (previewElement && activeTab === "studio" && studioView === "create") {
        void playStudioPreviewElement();
      }
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
    isStudioPreviewInlineActive,
    shouldPreferMutedModalFallback,
    studioView,
  ]);

  useEffect(() => {
    const previewElement = previewVideoRef.current;
    if (!previewElement) return;

    if (activeTab !== "studio" || studioView !== "create" || isAnyPreviewModalOpen) {
      previewElement.pause();
      return;
    }

    if (generatedVideo) {
      void playStudioPreviewElement();
    }
  }, [activeTab, generatedVideo, isAnyPreviewModalOpen, isStudioPreviewInlineActive, studioView]);

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
          if (!preserveExamplePrefillRef.current) {
          setTopicInput(latestGeneration.generation.prompt);
          }
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

  return (
    <>
      <div className="route-page studio-canvas-route" hidden={!isStudioRouteVisible}>
        <header className="site-header site-header--workspace">
          <div className="container site-header__inner">
            <Link className="brand" to="/" aria-label="AdShorts AI">
              <img src="/logo.png" alt="" width="44" height="44" />
              <span>AdShorts AI</span>
            </Link>

            <PrimarySiteNav
              activeItem="studio"
              onOpenStudio={() => setActiveTab("studio")}
              studioView={studioView}
              onStudioViewChange={setStudioView}
              projectsCount={projects.length}
            />

            <div className="site-header__actions">
              <SiteHeaderWorkspaceStatus profile={workspaceProfile} />
              <button className="site-header__link route-button" type="button" onClick={openWorkspaceCreditPacks}>
                Тарифы
              </button>
              <AccountMenuButton email={session.email} name={session.name} onLogout={handleAccountLogout} plan={workspacePlanLabel} />
        </div>
          </div>
        </header>

        <main className="studio-canvas-main">
          <div className="studio-canvas-bg" aria-hidden="true">
            <span className="studio-canvas-bg__gradient"></span>
          </div>

          <div hidden={studioView !== "create"}>
              <div className="studio-canvas-content">
                <div className="studio-canvas-preview">
                  {generatedVideo ? (
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
                    >
                      <video
                        ref={previewVideoRef}
                        key={generatedVideo.id}
                        className="studio-canvas-preview__video"
                        src={generatedVideo.videoUrl}
                        autoPlay
                        loop={!isStudioPreviewInlineActive}
                        muted={!isStudioPreviewInlineActive}
                        playsInline
                        preload="auto"
                        onLoadedMetadata={handleStudioPreviewMetadataLoaded}
                        onDurationChange={handleStudioPreviewMetadataLoaded}
                        onPlay={() => setIsStudioPreviewPlaying(true)}
                        onPause={() => setIsStudioPreviewPlaying(false)}
                        onTimeUpdate={handleStudioPreviewTimeUpdate}
                      />
                      {!isGenerating ? (
                        <div className="studio-canvas-preview__quick-actions" onClick={(event) => event.stopPropagation()}>
                          <button
                            className="studio-canvas-preview__quick-action"
                            type="button"
                            aria-label="Редактировать видео"
                            title="Редактировать"
                            onClick={() => handleOpenPreviewModal()}
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
                          <a
                            className="studio-canvas-preview__quick-action"
                            href={generatedVideo.videoUrl}
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
                      {isGenerating ? (
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
              </div>

              <div className="studio-canvas-prompt">
                <div className="studio-canvas-prompt__inner">
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
                            selectedVoiceId={resolvedSelectedVoiceId}
                            onSelect={setSelectedVoiceId}
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
                    <button
                      className={`studio-canvas-prompt__btn${isGenerating || isPreparingCustomVideo || isPreparingCustomMusic ? " is-generating" : ""}`}
                      type="button"
                      disabled={isGenerating || isPreparingCustomVideo || isPreparingCustomMusic}
                      onClick={() => handleGenerate(topicInput)}
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
                </div>
              </div>
          </div>

          <div className="studio-projects" hidden={studioView !== "projects"}>
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
                      isPreviewing={activeProjectPreviewId === project.id}
                      onActivate={activateProjectPreview}
                      onBlur={handleProjectCardBlur(project.id)}
                      onDeactivate={deactivateProjectPreview}
                      onOpenPreview={handleOpenProjectPreviewModal}
                      project={project}
                    />
              ))}
            </div>
              )}
            </div>
        </main>

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
              <button
                className="studio-video-modal__close route-close"
                type="button"
                aria-label="Закрыть превью"
                onClick={closePreviewModals}
              >
                ×
            </button>

              <div className="studio-video-modal__layout">
                <div className="studio-video-modal__player-slot">
                  <div className="studio-video-modal__player">
                    <video
                      ref={previewModalVideoRef}
                      key={`${isProjectPreviewModalOpen ? projectPreviewModal?.id ?? "project" : generatedVideo?.id ?? "generated"}-${previewModalOpenToken || previewModalUpdatedAt || "modal"}`}
                      src={previewModalVideoPlaybackUrl}
                      controls
                      autoPlay={isAnyPreviewModalOpen}
                      playsInline
                      preload="auto"
                      onCanPlay={() => {
                        if (isAnyPreviewModalOpen && previewModalVideoRef.current?.paused) {
                          void playVideoElement(previewModalVideoRef.current, shouldPreferMutedModalFallback);
                        }
                      }}
                    />
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
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Открыть видео
                        </a>
                        <button className="studio-video-modal__action route-button" type="button" onClick={closePreviewModals}>
                          Закрыть
                        </button>
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
                                className="studio-publish-modal__utility-btn"
                                type="button"
                                disabled={isDisconnectingPublishChannel || isPublishInFlight}
                                onClick={() => void handleDisconnectPublishChannel()}
                              >
                                {isDisconnectingPublishChannel ? "Отключаем..." : "Отключить канал"}
                              </button>
                            ) : null}
                            {publishChannels.length ? (
                              <button className="studio-publish-modal__utility-btn" type="button" onClick={() => void handleStartYouTubeConnect()}>
                                Подключить ещё канал
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

          <PrimarySiteNav activeItem={null} onOpenStudio={() => setActiveTab("studio")} />

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

                          {project.videoUrl ? (
                            <a
                              className="account-linkbtn"
                              href={project.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Открыть видео
                            </a>
                          ) : null}
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
                          <span>Во вкладке Billing пользователь видит пакеты 10 / 50 / 100 кредитов.</span>
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
