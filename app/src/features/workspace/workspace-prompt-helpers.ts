import type { StudioSegmentVisualQuality } from "../../../shared/studio-credit-costs";
import type {
  WorkspaceReferenceKind,
  WorkspaceSavedReference,
} from "../../../shared/workspace-references";
import type {
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentPreviewKind,
} from "./workspace-types";

export type WorkspaceReferenceVisualOption = {
  assetId: number | null;
  displayNumber?: number;
  key: string;
  kind: WorkspaceReferenceKind;
  label: string;
  previewKind: WorkspaceSegmentPreviewKind;
  savedReference?: WorkspaceSavedReference;
  segment?: WorkspaceSegmentEditorDraftSegment;
  source: "project-character" | "project-scene" | "saved";
  sourceProjectId: number | null;
  sourceSegmentIndex: number | null;
  subtitle: string;
  videoPosterReferenceUrl?: string | null;
  videoReferenceUrl?: string | null;
};

const escapeWorkspacePromptRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type WorkspacePromptCharacterMentionToken =
  | { text: string; type: "text" }
  | { option: WorkspaceReferenceVisualOption; text: string; type: "mention" };

type WorkspacePromptCharacterMentionMatch = {
  end: number;
  option: WorkspaceReferenceVisualOption;
  start: number;
  text: string;
};

export type WorkspacePromptRichEditorSelectionRange = {
  end: number;
  start: number;
};

const findNextWorkspacePromptCharacterMention = (
  value: string,
  options: WorkspaceReferenceVisualOption[],
  startIndex: number,
): WorkspacePromptCharacterMentionMatch | null => {
  let nextMatch: WorkspacePromptCharacterMentionMatch | null = null;

  options.forEach((option) => {
    const label = option.label.trim();
    if (!label) {
      return;
    }

    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeWorkspacePromptRegExp(label)})(?=$|[^\\p{L}\\p{N}_])`, "giu");
    let match = pattern.exec(value);
    while (match) {
      const prefix = match[1] ?? "";
      const mentionText = match[2] ?? "";
      const mentionStart = match.index + prefix.length;
      const mentionEnd = mentionStart + mentionText.length;

      if (
        mentionStart >= startIndex &&
        (!nextMatch || mentionStart < nextMatch.start || (mentionStart === nextMatch.start && mentionEnd > nextMatch.end))
      ) {
        nextMatch = {
          end: mentionEnd,
          option,
          start: mentionStart,
          text: mentionText,
        };
      }

      match = pattern.exec(value);
    }
  });

  return nextMatch;
};

export const buildWorkspacePromptCharacterMentionTokens = (
  value: string,
  options: WorkspaceReferenceVisualOption[],
) => {
  const tokens: WorkspacePromptCharacterMentionToken[] = [];
  const orderedOptions = [...options].sort((left, right) => right.label.length - left.label.length);
  let cursor = 0;

  while (cursor < value.length) {
    const match = findNextWorkspacePromptCharacterMention(value, orderedOptions, cursor);
    if (!match) {
      tokens.push({ text: value.slice(cursor), type: "text" });
      break;
    }

    if (match.start > cursor) {
      tokens.push({ text: value.slice(cursor, match.start), type: "text" });
    }
    tokens.push({ option: match.option, text: match.text, type: "mention" });
    cursor = match.end;
  }

  return tokens;
};

export const resolveWorkspacePromptMentionedCharacterOptions = (
  value: string,
  options: WorkspaceReferenceVisualOption[],
) => {
  const mentionedOptions: WorkspaceReferenceVisualOption[] = [];
  const mentionedKeys = new Set<string>();

  buildWorkspacePromptCharacterMentionTokens(value, options).forEach((token) => {
    if (token.type === "mention" && !mentionedKeys.has(token.option.key)) {
      mentionedKeys.add(token.option.key);
      mentionedOptions.push(token.option);
    }
  });

  return mentionedOptions;
};

export const resolveWorkspacePromptCharacterBillingQuality = (
  value: string,
  options: WorkspaceReferenceVisualOption[],
  quality: StudioSegmentVisualQuality,
): StudioSegmentVisualQuality =>
  resolveWorkspacePromptMentionedCharacterOptions(value, options).length > 0 ? "premium" : quality;

export const removeWorkspacePromptCharacterMentionText = (
  value: string,
  targetOption: WorkspaceReferenceVisualOption,
  options: WorkspaceReferenceVisualOption[],
) => {
  const nextValue = buildWorkspacePromptCharacterMentionTokens(value, options)
    .filter((token) => token.type !== "mention" || token.option.key !== targetOption.key)
    .map((token) => token.text)
    .join("");

  return nextValue
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]*(?:\r\n?|\n)+[ \t]*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.!?;:])/g, "$1")
    .replace(/^[,.!?;:][ \t]*/, "")
    .trim();
};

const isWorkspacePromptWordStart = (value: string) => /^[\p{L}\p{N}_]/u.test(value);

const isWorkspacePromptCharacterMentionEndOffset = (
  value: string,
  options: WorkspaceReferenceVisualOption[],
  offset: number,
) => {
  if (offset <= 0 || offset > value.length) {
    return false;
  }

  let cursor = 0;
  return buildWorkspacePromptCharacterMentionTokens(value, options).some((token) => {
    cursor += token.text.length;
    return token.type === "mention" && cursor === offset;
  });
};

const getWorkspacePromptCharacterMentionRanges = (
  value: string,
  options: WorkspaceReferenceVisualOption[],
) => {
  const ranges: Array<{ end: number; start: number }> = [];
  let cursor = 0;

  buildWorkspacePromptCharacterMentionTokens(value, options).forEach((token) => {
    const start = cursor;
    const end = start + token.text.length;
    if (token.type === "mention") {
      ranges.push({ end, start });
    }
    cursor = end;
  });

  return ranges;
};

export const shouldInsertWorkspacePromptMentionBoundarySpace = (
  value: string,
  options: WorkspaceReferenceVisualOption[],
  offset: number,
  insertedText: string,
) => {
  if (!insertedText || !isWorkspacePromptWordStart(insertedText)) {
    return false;
  }

  const beforeCaret = value.slice(0, offset);
  const afterCaret = value.slice(offset);
  const isAtTrailingWhitespace = afterCaret.length > 0 && /^\s+$/.test(afterCaret);
  return (
    Boolean(beforeCaret) &&
    !/\s$/.test(beforeCaret) &&
    (!/^\s/.test(afterCaret) || isAtTrailingWhitespace) &&
    isWorkspacePromptCharacterMentionEndOffset(value, options, offset)
  );
};

export const repairWorkspacePromptMentionBoundaryInput = (
  previousValue: string,
  nextValue: string,
  options: WorkspaceReferenceVisualOption[],
  nextCaretOffset: number,
) => {
  const insertedLength = nextValue.length - previousValue.length;
  if (insertedLength <= 0 || nextCaretOffset < insertedLength) {
    return null;
  }

  const insertionStart = nextCaretOffset - insertedLength;
  const insertedText = nextValue.slice(insertionStart, nextCaretOffset);
  if (
    !shouldInsertWorkspacePromptMentionBoundarySpace(
      previousValue,
      options,
      insertionStart,
      insertedText,
    ) ||
    nextValue.slice(0, insertionStart) !== previousValue.slice(0, insertionStart) ||
    nextValue.slice(nextCaretOffset) !== previousValue.slice(insertionStart)
  ) {
    return null;
  }

  return {
    caretOffset: nextCaretOffset + 1,
    value: `${previousValue.slice(0, insertionStart)} ${insertedText}${previousValue.slice(insertionStart)}`,
  };
};

export const getWorkspacePromptCharacterMentionTokenSignature = (tokens: WorkspacePromptCharacterMentionToken[]) =>
  tokens
    .filter((token) => token.type === "mention")
    .map((token) => `${token.option.key}:${token.text}`)
    .join("|");

export const getWorkspacePromptRichEditorDomMentionSignature = (root: HTMLElement | null) =>
  Array.from(root?.querySelectorAll<HTMLElement>("[data-prompt-character-key]") ?? [])
    .map((element) => `${element.dataset.promptCharacterKey ?? ""}:${element.dataset.promptCharacterLabel ?? ""}`)
    .join("|");

const escapeWorkspacePromptRichEditorHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getWorkspacePromptRichEditorTextHtml = (value: string) =>
  escapeWorkspacePromptRichEditorHtml(value).replace(/\n/g, "<br>");

export const getWorkspacePromptRichEditorNodeText = (node: Node): string => {
  if (node.nodeType === 3) {
    return node.textContent ?? "";
  }

  if (node.nodeType !== 1) {
    return "";
  }

  const element = node as HTMLElement;
  const mentionLabel = element.dataset.promptCharacterLabel;
  if (mentionLabel) {
    return mentionLabel;
  }
  if (element.tagName === "BR") {
    return "\n";
  }

  return Array.from(element.childNodes).map(getWorkspacePromptRichEditorNodeText).join("");
};

export const normalizeWorkspacePromptRichEditorValue = (value: unknown) =>
  String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]*(?:\r\n?|\n)+[ \t]*/g, " ")
    .replace(/[ \t]{2,}/g, " ");

export const getWorkspacePromptRichEditorText = (root: HTMLElement | null) =>
  normalizeWorkspacePromptRichEditorValue(root ? getWorkspacePromptRichEditorNodeText(root) : "");

const getWorkspacePromptRichEditorNodeTextLength = (node: Node): number => {
  if (node.nodeType === 3) {
    return node.textContent?.length ?? 0;
  }

  if (node.nodeType !== 1) {
    return 0;
  }

  const element = node as HTMLElement;
  const mentionLabel = element.dataset.promptCharacterLabel;
  if (mentionLabel) {
    return mentionLabel.length;
  }
  if (element.tagName === "BR") {
    return 1;
  }

  return Array.from(element.childNodes).reduce(
    (length, childNode) => length + getWorkspacePromptRichEditorNodeTextLength(childNode),
    0,
  );
};

const getWorkspacePromptRichEditorBoundaryOffset = (
  root: HTMLElement,
  container: Node,
  containerOffset: number,
) => {
  let offset = 0;
  let hasFoundBoundary = false;

  const visit = (node: Node): boolean => {
    if (node === container) {
      if (node.nodeType === 3) {
        offset += Math.max(0, Math.min(node.textContent?.length ?? 0, containerOffset));
      } else {
        const children = Array.from(node.childNodes).slice(0, containerOffset);
        offset += children.reduce(
          (length, childNode) => length + getWorkspacePromptRichEditorNodeTextLength(childNode),
          0,
        );
      }
      hasFoundBoundary = true;
      return true;
    }

    if (node.nodeType === 3) {
      offset += node.textContent?.length ?? 0;
      return false;
    }

    if (node.nodeType === 1 && (node as HTMLElement).dataset.promptCharacterLabel) {
      offset += getWorkspacePromptRichEditorNodeTextLength(node);
      return false;
    }

    for (const childNode of Array.from(node.childNodes)) {
      if (visit(childNode)) {
        return true;
      }
    }

    return false;
  };

  visit(root);
  return hasFoundBoundary ? offset : getWorkspacePromptRichEditorText(root).length;
};

export const clampWorkspacePromptRichEditorSelectionRange = (
  value: string,
  range: WorkspacePromptRichEditorSelectionRange,
): WorkspacePromptRichEditorSelectionRange => {
  const start = Math.max(0, Math.min(value.length, range.start));
  const end = Math.max(0, Math.min(value.length, range.end));
  return start <= end ? { end, start } : { end: start, start: end };
};

export const getWorkspacePromptRichEditorSelectionRange = (
  root: HTMLElement | null,
): WorkspacePromptRichEditorSelectionRange | null => {
  if (!root || typeof window === "undefined") {
    return null;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null;
  }

  return clampWorkspacePromptRichEditorSelectionRange(getWorkspacePromptRichEditorText(root), {
    end: getWorkspacePromptRichEditorBoundaryOffset(root, range.endContainer, range.endOffset),
    start: getWorkspacePromptRichEditorBoundaryOffset(root, range.startContainer, range.startOffset),
  });
};

export const getWorkspacePromptRichEditorSelectionOffset = (root: HTMLElement | null) => {
  const selectionRange = getWorkspacePromptRichEditorSelectionRange(root);
  return selectionRange?.end ?? getWorkspacePromptRichEditorText(root).length;
};

export const setWorkspacePromptRichEditorSelectionOffset = (root: HTMLElement | null, targetOffset: number) => {
  if (!root || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const normalizedTargetOffset = Math.max(0, targetOffset);
  let offset = 0;
  let target: { node: Node; offset: number } | null = null;

  const visit = (node: Node): boolean => {
    if (node.nodeType === 3) {
      const textLength = node.textContent?.length ?? 0;
      if (offset + textLength >= normalizedTargetOffset) {
        target = {
          node,
          offset: Math.max(0, Math.min(textLength, normalizedTargetOffset - offset)),
        };
        return true;
      }
      offset += textLength;
      return false;
    }

    if (node.nodeType === 1 && (node as HTMLElement).dataset.promptCharacterLabel) {
      const mentionLength = getWorkspacePromptRichEditorNodeTextLength(node);
      if (normalizedTargetOffset <= offset) {
        const parentNode = node.parentNode;
        if (parentNode) {
          target = {
            node: parentNode,
            offset: Array.from(parentNode.childNodes).indexOf(node as ChildNode),
          };
          return true;
        }
      }
      if (offset + mentionLength >= normalizedTargetOffset) {
        const parentNode = node.parentNode;
        if (parentNode) {
          target = {
            node: parentNode,
            offset: Array.from(parentNode.childNodes).indexOf(node as ChildNode) + 1,
          };
          return true;
        }
      }
      offset += mentionLength;
      return false;
    }

    for (const childNode of Array.from(node.childNodes)) {
      if (visit(childNode)) {
        return true;
      }
    }

    return false;
  };

  visit(root);
  if (!target) {
    target = {
      node: root,
      offset: root.childNodes.length,
    };
  }

  const range = document.createRange();
  range.setStart(target.node, target.offset);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

export const replaceWorkspacePromptRichEditorTextRange = (
  value: string,
  range: WorkspacePromptRichEditorSelectionRange,
  insertedText: string,
) => {
  const normalizedRange = clampWorkspacePromptRichEditorSelectionRange(value, range);
  const nextValue = `${value.slice(0, normalizedRange.start)}${insertedText}${value.slice(normalizedRange.end)}`;
  return {
    caretOffset: normalizedRange.start + insertedText.length,
    value: nextValue,
  };
};

const getWorkspacePromptPreviousTextOffset = (value: string, offset: number) => {
  const before = value.slice(0, Math.max(0, Math.min(value.length, offset)));
  const characters = Array.from(before);
  const previousCharacter = characters[characters.length - 1];
  return previousCharacter ? before.length - previousCharacter.length : before.length;
};

const getWorkspacePromptNextTextOffset = (value: string, offset: number) => {
  const normalizedOffset = Math.max(0, Math.min(value.length, offset));
  const nextCharacter = Array.from(value.slice(normalizedOffset))[0];
  return nextCharacter ? normalizedOffset + nextCharacter.length : normalizedOffset;
};

export const getWorkspacePromptRichEditorDeletionRange = (
  value: string,
  options: WorkspaceReferenceVisualOption[],
  range: WorkspacePromptRichEditorSelectionRange,
  direction: "backward" | "forward",
): WorkspacePromptRichEditorSelectionRange => {
  const normalizedRange = clampWorkspacePromptRichEditorSelectionRange(value, range);
  if (normalizedRange.start !== normalizedRange.end) {
    return normalizedRange;
  }

  const caretOffset = normalizedRange.start;
  const mentionRanges = getWorkspacePromptCharacterMentionRanges(value, options);
  if (direction === "backward") {
    const mentionRange = mentionRanges.find(({ end, start }) => start < caretOffset && caretOffset <= end);
    return mentionRange ?? {
      end: caretOffset,
      start: getWorkspacePromptPreviousTextOffset(value, caretOffset),
    };
  }

  const mentionRange = mentionRanges.find(({ end, start }) => start <= caretOffset && caretOffset < end);
  return mentionRange ?? {
    end: getWorkspacePromptNextTextOffset(value, caretOffset),
    start: caretOffset,
  };
};

export const insertWorkspacePromptCharacterMentionText = (
  value: string,
  label: string,
  offsetOrRange: number | WorkspacePromptRichEditorSelectionRange,
) => {
  const range =
    typeof offsetOrRange === "number"
      ? { end: offsetOrRange, start: offsetOrRange }
      : offsetOrRange;
  const normalizedRange = clampWorkspacePromptRichEditorSelectionRange(value, range);
  const before = value.slice(0, normalizedRange.start);
  const after = value.slice(normalizedRange.end);
  const leadingSpace = before && !/\s$/.test(before) ? " " : "";
  const trailingSpace = after && !/^[\s,.!?;:]/.test(after) ? " " : "";

  return `${before}${leadingSpace}${label}${trailingSpace}${after}`;
};

export const buildWorkspacePromptRichEditorHtml = (
  tokens: WorkspacePromptCharacterMentionToken[],
  getAvatarUrl: (option: WorkspaceReferenceVisualOption) => string | null,
) =>
  tokens.map((token) => {
    if (token.type === "text") {
      return getWorkspacePromptRichEditorTextHtml(token.text);
    }

    const avatarUrl = getAvatarUrl(token.option);
    const avatarHtml = avatarUrl
      ? `<img src="${escapeWorkspacePromptRichEditorHtml(avatarUrl)}" alt="">`
      : "";
    const escapedKey = escapeWorkspacePromptRichEditorHtml(token.option.key);
    const escapedLabel = escapeWorkspacePromptRichEditorHtml(token.option.label);

    return [
      `<span class="studio-segment-editor__prompt-inline-mention" contenteditable="false" data-prompt-character-key="${escapedKey}" data-prompt-character-label="${escapedLabel}" title="${escapedLabel}">`,
      `<span class="studio-segment-editor__prompt-inline-mention-avatar">${avatarHtml}</span>`,
      `<span class="studio-segment-editor__prompt-inline-mention-label">${escapedLabel}</span>`,
      "</span>",
    ].join("");
  }).join("");
