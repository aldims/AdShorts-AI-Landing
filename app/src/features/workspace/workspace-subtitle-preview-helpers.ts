import type { CSSProperties } from "react";
import type { ExamplePrefillStudioSettings } from "../../../shared/example-prefill";
import type { Locale } from "../../lib/i18n";
import {
  getWorkspaceSegmentEditorDisplayStartTime,
  getWorkspaceSegmentEditorPlaybackDuration,
  getWorkspaceSegmentTimelineSpeechRange,
} from "../../lib/workspaceSegmentEditorTimeline";
import {
  createStudioSubtitleColorOption,
  fallbackStudioSubtitleColorOption,
  fallbackStudioSubtitleStyleOption,
} from "./workspace-segment-editor";
import type {
  StudioSubtitleColorCatalogOption,
  StudioSubtitleColorOption,
  StudioSubtitleStyleOption,
  WorkspaceSegmentEditorDraftSegment,
} from "./workspace-types";

type StudioSubtitleExampleCopy = {
  activeWordIndex?: number;
  label?: string;
  lines?: string[];
  note?: string;
};

export type StudioSubtitleExampleOption = {
  activeWordIndex: number;
  copy?: Partial<Record<Locale, StudioSubtitleExampleCopy>>;
  id: string;
  label: string;
  lines: string[];
  note: string;
};

export type StudioSubtitlePreviewWordState = "active" | "future" | "past";
export type StudioSubtitlePreviewWord = {
  sourceIndex?: number;
  state: StudioSubtitlePreviewWordState;
  text: string;
};
export type WorkspaceSegmentSubtitleCaretPoint = {
  clientX: number;
  clientY: number;
};

const STUDIO_SUBTITLE_PREVIEW_MAX_CHARS_PER_LINE = 20;
const STUDIO_SUBTITLE_PREVIEW_MAX_WORDS_PER_LINE = 4;

const studioSubtitleStyleLabelsRu: Record<string, string> = {
  cinema: "Кино",
  editorial: "Редакционный",
  impact: "Акцент",
  karaoke: "Караоке",
  modern: "Современный",
  story: "История",
};

const studioSubtitleStyleLabelsEn: Record<string, string> = {
  cinema: "Cinema",
  editorial: "Editorial",
  impact: "Impact",
  karaoke: "Karaoke",
  modern: "Modern",
  story: "Story",
};

const studioSubtitleStyleDescriptionsRu: Record<string, string> = {
  cinema: "Чистые субтитры без цветовой подсветки.",
  editorial: "Спокойный стиль для сцен с большим количеством текста.",
  impact: "Крупные яркие субтитры с плотным контуром.",
  karaoke: "Фразы с подсветкой активного слова.",
  modern: "Универсальный стиль для Shorts.",
  story: "Мягкий стиль для разговорных роликов.",
};

const studioSubtitleStyleDescriptionsEn: Record<string, string> = {
  cinema: "Clean lower-third with a soft crossfade and no color accent.",
  editorial: "Calm explanatory preset with plenty of breathing room.",
  impact: "Aggressive viral style with a heavy outline and tight placement.",
  karaoke: "Phrase caption with clear active-word highlighting.",
  modern: "Current default for Shorts in Manrope.",
  story: "Soft social/UGC style with lighter animation.",
};

const studioSubtitleColorLabelsRu: Record<string, string> = {
  black: "Черный",
  blue: "Синий",
  cyan: "Голубой",
  gold: "Золотой",
  green: "Зеленый",
  orange: "Оранжевый",
  pink: "Розовый",
  purple: "Фиолетовый",
  red: "Красный",
  white: "Белый",
  yellow: "Желтый",
};

const studioSubtitleColorLabelsEn: Record<string, string> = {
  black: "Black",
  blue: "Blue",
  cyan: "Cyan",
  gold: "Gold",
  green: "Green",
  orange: "Orange",
  pink: "Pink",
  purple: "Purple",
  red: "Red",
  white: "White",
  yellow: "Yellow",
};

export const getStudioSubtitleStyleDisplayLabel = (
  locale: Locale,
  style: Pick<StudioSubtitleStyleOption, "id" | "label"> | null | undefined,
) => {
  if (!style) {
    return "";
  }

  return locale === "ru"
    ? studioSubtitleStyleLabelsRu[style.id] ?? style.label
    : studioSubtitleStyleLabelsEn[style.id] ?? style.label;
};

export const getStudioSubtitleStyleDisplayDescription = (
  locale: Locale,
  style: Pick<StudioSubtitleStyleOption, "id" | "description"> | null | undefined,
) => {
  if (!style) {
    return "";
  }

  return locale === "ru"
    ? studioSubtitleStyleDescriptionsRu[style.id] ?? style.description
    : studioSubtitleStyleDescriptionsEn[style.id] ?? style.description;
};

export const getStudioSubtitleColorDisplayLabel = (
  locale: Locale,
  color: Pick<StudioSubtitleColorOption, "id" | "label"> | null | undefined,
) => {
  if (!color) {
    return "";
  }

  return locale === "ru"
    ? studioSubtitleColorLabelsRu[color.id] ?? color.label
    : studioSubtitleColorLabelsEn[color.id] ?? color.label;
};

export const buildStudioSubtitleColorOptions = (
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

export const resolveWorkspaceExamplePrefillSubtitleSelection = (options: {
  prefillSettings?: ExamplePrefillStudioSettings | null;
  selectedSubtitleColorId: string;
  selectedSubtitleStyleId: string;
  subtitleColorOptions: StudioSubtitleColorOption[];
  subtitleStyleOptions: StudioSubtitleStyleOption[];
}): { subtitleColorId: string; subtitleStyleId: string } => {
  const {
    prefillSettings,
    selectedSubtitleColorId,
    selectedSubtitleStyleId,
    subtitleColorOptions,
    subtitleStyleOptions,
  } = options;
  const requestedPrefillStyleId =
    typeof prefillSettings?.subtitleStyleId === "string" ? prefillSettings.subtitleStyleId.trim() : "";
  const requestedPrefillColorId =
    typeof prefillSettings?.subtitleColorId === "string" ? prefillSettings.subtitleColorId.trim() : "";
  const subtitleStyleId =
    (requestedPrefillStyleId && subtitleStyleOptions.find((style) => style.id === requestedPrefillStyleId)?.id) ||
    subtitleStyleOptions.find((style) => style.id === selectedSubtitleStyleId)?.id ||
    subtitleStyleOptions[0]?.id ||
    fallbackStudioSubtitleStyleOption.id;
  const subtitleColorId =
    (requestedPrefillColorId && subtitleColorOptions.find((color) => color.id === requestedPrefillColorId)?.id) ||
    subtitleColorOptions.find((color) => color.id === selectedSubtitleColorId)?.id ||
    subtitleStyleOptions.find((style) => style.id === subtitleStyleId)?.defaultColorId ||
    subtitleColorOptions[0]?.id ||
    fallbackStudioSubtitleColorOption.id;

  return {
    subtitleColorId,
    subtitleStyleId,
  };
};

export const getStudioSubtitleColorAfterStyleChange = (options: {
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

export const studioSubtitleExampleOptions: StudioSubtitleExampleOption[] = [
  {
    activeWordIndex: 1,
    id: "cta",
    label: "CTA",
    note: "Финальный призыв",
    lines: ["Забери шаблон", "и протестируй сегодня"],
    copy: {
      en: {
        activeWordIndex: 2,
        note: "Final call to action",
        lines: ["Grab the template", "and test it today"],
      },
    },
  },
];

export const getStudioSubtitleExampleDisplayOption = (
  locale: Locale,
  example: StudioSubtitleExampleOption,
): StudioSubtitleExampleOption => {
  const copy = example.copy?.[locale];
  return copy
    ? {
        ...example,
        ...copy,
      }
    : example;
};

const getStudioSubtitlePreviewFontFamily = (value: string) =>
  value === "Manrope" ? '"Manrope", "Avenir Next", "Segoe UI", sans-serif' : '"DejaVu Sans", "Trebuchet MS", sans-serif';

export const getStudioSubtitleLogicLabel = (style: StudioSubtitleStyleOption, locale: Locale = "en") => {
  if (locale === "ru") {
    switch (style.logicMode) {
      case "crossfade":
        return "Плавная смена";
      case "phrase":
        return "По фразам";
      case "sliding":
        return "Лента";
      default:
        return "Блок";
    }
  }

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

export const getStudioSubtitleTransitionLabel = (style: StudioSubtitleStyleOption, locale: Locale = "en") => {
  if (locale === "ru") {
    switch (style.transitionMode) {
      case "hard_cut":
        return "Без анимации";
      case "slide_up":
        return "Снизу вверх";
      case "soft_crossfade":
        return "Плавно";
      case "soft_fade":
        return "Мягко";
      case "karaoke_follow":
        return "По словам";
      default:
        return style.transitionMode || "Переход";
    }
  }

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

export const studioSubtitleStyleUsesAccentColor = (style: StudioSubtitleStyleOption) => style.usesAccentColor;

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

export const buildStudioSubtitlePreviewLines = (
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

export const getStudioSubtitlePreviewStyle = (style: StudioSubtitleStyleOption, color: StudioSubtitleColorOption) => {
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

export const resolveWorkspaceSegmentSubtitleCaretPositionFromTextareaPoint = ({
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

  const visibleWordCount = normalizedTextWords.length;
  const timelineBaseline =
    (typeof segment.speechStartTime === "number" && Number.isFinite(segment.speechStartTime) ? segment.speechStartTime : null) ??
    (typeof segment.startTime === "number" && Number.isFinite(segment.startTime) ? segment.startTime : null) ??
    segment.speechWords[0]?.startTime ??
    0;
  const speechEndTime =
    typeof segment.speechEndTime === "number" && Number.isFinite(segment.speechEndTime) ? segment.speechEndTime : null;
  const timelineSpeechDuration =
    speechEndTime !== null && speechEndTime > timelineBaseline ? speechEndTime - timelineBaseline : null;
  const playbackDuration = getWorkspaceSegmentEditorPlaybackDuration(segment, textWords.length, {
    preferEstimatedDuration: true,
  });
  const lastVisibleSpeechWord = normalizedSpeechWords[visibleWordCount - 1] ?? normalizedSpeechWords[normalizedSpeechWords.length - 1];
  const firstSpeechWordStart = normalizedSpeechWords[0]?.startTime ?? 0;
  const lastSpeechWordEnd = lastVisibleSpeechWord?.endTime ?? firstSpeechWordStart;
  const localTimingDuration = timelineSpeechDuration ?? playbackDuration;
  const usesLocalSpeechWordTiming =
    timelineBaseline > 0.05 &&
    firstSpeechWordStart < timelineBaseline - 0.05 &&
    lastSpeechWordEnd <= localTimingDuration + 0.5;
  const baseline = usesLocalSpeechWordTiming ? 0 : timelineBaseline;
  const currentTime = Math.max(0, clipCurrentTime);

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

  const explicitSpeechDuration =
    typeof segment.speechDuration === "number" && Number.isFinite(segment.speechDuration) && segment.speechDuration > 0
      ? segment.speechDuration
      : null;
  const speechRange = getWorkspaceSegmentTimelineSpeechRange(segment);
  const displayStartTime = getWorkspaceSegmentEditorDisplayStartTime(segment);
  const localSpeechStartTime =
    speechRange !== null ? Math.max(0, speechRange.startTime - displayStartTime) : 0;
  const speechRangeDuration =
    speechRange !== null && speechRange.endTime > speechRange.startTime
      ? speechRange.endTime - speechRange.startTime
      : null;
  const effectiveDuration =
    explicitSpeechDuration ??
    speechRangeDuration ??
    getWorkspaceSegmentEditorPlaybackDuration(segment, wordCount, { preferEstimatedDuration: true });
  const speechCurrentTime = Math.max(0, clipCurrentTime - localSpeechStartTime);
  const progress = Math.min(0.999, speechCurrentTime / Math.max(0.001, effectiveDuration));
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

export const buildWorkspaceSegmentSubtitlePreviewLines = ({
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
