import type { Locale } from "../../lib/i18n";

export type WorkspaceContentPlanIdea = {
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

export type WorkspaceContentPlan = {
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

export type WorkspaceContentPlansResponse = {
  data?: WorkspaceContentPlansPayload;
  error?: string;
};

type WorkspaceContentPlanPayload = {
  plan: WorkspaceContentPlan;
};

export type WorkspaceContentPlanResponse = {
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

export type WorkspaceContentPlanIdeaUpdateResponse = {
  data?: WorkspaceContentPlanIdeaUpdatePayload;
  error?: string;
};

type WorkspaceContentPlanIdeaDeletePayload = {
  ideaId: string;
  planId: string;
  updatedAt: string;
};

export type WorkspaceContentPlanIdeaDeleteResponse = {
  data?: WorkspaceContentPlanIdeaDeletePayload;
  error?: string;
};

export type WorkspaceContentPlanComposerSource = {
  ideaId: string;
  planId: string;
  prompt: string;
};

export type WorkspaceContentPlanIdeaMutation = {
  ideaId: string;
  ideaUpdatedAt: string;
  isUsed: boolean;
  planId: string;
  planUpdatedAt: string;
  usedAt: string | null;
};

export const WORKSPACE_CONTENT_PLAN_IDEA_COUNT_DEFAULT = 5;

const STUDIO_CONTENT_PLAN_VISIBILITY_STORAGE_KEY_PREFIX = "adshorts.content-plan-visible:";

const normalizeWorkspaceEmail = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();

const getStudioContentPlanVisibilityStorageKey = (email: string) =>
  `${STUDIO_CONTENT_PLAN_VISIBILITY_STORAGE_KEY_PREFIX}${email}`;

export const formatWorkspaceContentPlanIdeaCount = (value: number, locale: Locale = "ru") => {
  const count = Math.max(1, Math.trunc(value));
  if (locale === "en") {
    return `${count} ${count === 1 ? "idea" : "ideas"}`;
  }

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

export const sanitizeWorkspaceContentPlanIdeaPrompt = (value: unknown) => {
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

export const isWorkspaceContentPlanSourceIdeaSynchronized = (
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

const getDefaultStudioContentPlanVisibility = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }

  return !window.matchMedia("(max-width: 1100px)").matches;
};

export const readStudioContentPlanVisibility = (email: string | null | undefined) => {
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

export const persistStudioContentPlanVisibility = (email: string | null | undefined, isVisible: boolean) => {
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

export const applyWorkspaceContentPlanIdeaUpdate = (
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

export const removeWorkspaceContentPlanIdea = (
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
