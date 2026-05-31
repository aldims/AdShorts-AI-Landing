import type {
  WorkspaceReferenceKind,
  WorkspaceSavedReference,
} from "../../../shared/workspace-references";
import { getPositiveWorkspaceMediaAssetId } from "./workspace-segment-editor";

export type WorkspaceReferenceCreationSource = "ai" | "upload" | "project";
export type WorkspaceReferenceCharacterGender = "male" | "female";

export type WorkspaceReferenceCharacterPromptFields = {
  ageRange: string;
  description: string;
  gender: WorkspaceReferenceCharacterGender | "";
  style: string;
};

export type WorkspaceReferenceScenePromptFields = {
  description: string;
  lightingMood: string;
  placeType: string;
  style: string;
};

export const WORKSPACE_REFERENCE_CHARACTER_MIN_AGE = 1;
const WORKSPACE_REFERENCE_STYLE_UNSET_OPTION = "Не задан";

export const WORKSPACE_REFERENCE_CHARACTER_DEFAULTS: WorkspaceReferenceCharacterPromptFields = {
  ageRange: "",
  description: "",
  gender: "",
  style: WORKSPACE_REFERENCE_STYLE_UNSET_OPTION,
};

export const WORKSPACE_REFERENCE_SCENE_DEFAULTS: WorkspaceReferenceScenePromptFields = {
  description: "Детализированная сцена с выразительной композицией, глубиной кадра и чистым фокусом. Пространство подходит для короткого видео.",
  lightingMood: "Естественное мягкое освещение",
  placeType: "Интерьер",
  style: "Фотореалистичная",
};

export const WORKSPACE_REFERENCE_CHARACTER_STYLE_OPTIONS = [
  WORKSPACE_REFERENCE_STYLE_UNSET_OPTION,
  "Реалистичный — естественное фото человека",
  "Кинематографичный — дорогой свет и кино-качество",
  "UGC — как живое фото с телефона",
  "Студийный — чистый профессиональный портрет",
  "Аниме — японский аниме-стиль",
  "3D — мультяшный 3D-персонаж",
  "Иллюстрация — рисованный стиль",
  "Футуристичный — cyberpunk образ",
] as const;

export const getWorkspaceReferenceGenderLabel = (gender: WorkspaceReferenceCharacterGender | "") =>
  gender === "female" ? "женский" : gender === "male" ? "мужской" : "";

const getWorkspaceReferenceAgeUnit = (age: number) => {
  const lastTwoDigits = age % 100;
  const lastDigit = age % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "лет";
  }

  if (lastDigit === 1) {
    return "год";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "года";
  }

  return "лет";
};

const parseWorkspaceReferenceCharacterAge = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const age = Number.parseInt(normalized, 10);
  return Number.isFinite(age) && age >= WORKSPACE_REFERENCE_CHARACTER_MIN_AGE ? age : null;
};

export const normalizeWorkspaceReferenceCharacterAgeInput = (value: string) => {
  const parsedAge = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedAge)) {
    return "";
  }

  return String(Math.max(WORKSPACE_REFERENCE_CHARACTER_MIN_AGE, parsedAge));
};

const normalizeWorkspaceReferencePromptPart = (value: unknown) =>
  String(value ?? "").replace(/\s+/g, " ").trim();

export const isValidWorkspaceReferenceCharacterAge = (value: unknown) => {
  const normalized = normalizeWorkspaceReferencePromptPart(value);
  return !normalized || parseWorkspaceReferenceCharacterAge(normalized) !== null;
};

export const formatWorkspaceReferenceCharacterAge = (value: unknown) => {
  const age = parseWorkspaceReferenceCharacterAge(value);
  if (age === null) {
    return normalizeWorkspaceReferencePromptPart(value);
  }

  return `${age} ${getWorkspaceReferenceAgeUnit(age)}`;
};

export const normalizeWorkspaceReferenceCharacterStyleValue = (value: unknown) => {
  const normalized = normalizeWorkspaceReferencePromptPart(value);
  return WORKSPACE_REFERENCE_CHARACTER_STYLE_OPTIONS.includes(normalized as typeof WORKSPACE_REFERENCE_CHARACTER_STYLE_OPTIONS[number])
    ? normalized
    : WORKSPACE_REFERENCE_CHARACTER_DEFAULTS.style;
};

export const getWorkspaceReferencePromptStyle = (value: unknown) => {
  const normalized = normalizeWorkspaceReferencePromptPart(value);
  return normalized === WORKSPACE_REFERENCE_STYLE_UNSET_OPTION ? "" : normalized;
};

export const buildWorkspaceReferenceAiPrompt = (options: {
  character?: Partial<WorkspaceReferenceCharacterPromptFields> | null;
  kind: WorkspaceReferenceKind;
  scene?: Partial<WorkspaceReferenceScenePromptFields> | null;
}) => {
  if (options.kind === "scene") {
    const scene = {
      ...WORKSPACE_REFERENCE_SCENE_DEFAULTS,
      ...(options.scene ?? {}),
    };
    return [
      `Тип сцены: ${scene.placeType}`,
      `Стиль: ${scene.style}`,
      `Свет и атмосфера: ${scene.lightingMood}`,
      scene.description,
    ].map(normalizeWorkspaceReferencePromptPart).filter(Boolean).join(". ");
  }

  const character = {
    ...WORKSPACE_REFERENCE_CHARACTER_DEFAULTS,
    ...(options.character ?? {}),
  };
  const characterAgeLabel = formatWorkspaceReferenceCharacterAge(character.ageRange);
  const characterGenderLabel = getWorkspaceReferenceGenderLabel(character.gender);
  const characterStyle = getWorkspaceReferencePromptStyle(character.style);
  return [
    character.description ? `Создай референс персонажа: ${character.description}` : "",
    characterGenderLabel ? `Пол персонажа: ${characterGenderLabel}` : "",
    characterAgeLabel ? `Возраст: ${characterAgeLabel}` : "",
    characterStyle ? `Стиль: ${characterStyle}` : "",
  ].map(normalizeWorkspaceReferencePromptPart).filter(Boolean).join(". ");
};

export const buildWorkspaceReferencePromptFromVisualSource = (options: {
  basePrompt: string;
  kind: WorkspaceReferenceKind;
  source: Exclude<WorkspaceReferenceCreationSource, "ai">;
  sourceLabel?: string | null;
}) => {
  const basePrompt = normalizeWorkspaceReferencePromptPart(options.basePrompt);
  const sourceLabel = normalizeWorkspaceReferencePromptPart(options.sourceLabel);
  const sourceDescription =
    options.source === "upload"
      ? "загруженного фото"
      : "выбранного визуала проекта";
  const goal =
    options.kind === "character"
      ? `Создай AI-фото персонажа на основе ${sourceDescription}. Сохрани узнаваемые черты, пропорции и характер образа из референса, сделай чистый цельный референс персонажа.`
      : `Создай AI-фото сцены на основе ${sourceDescription}. Сохрани ключевую композицию и атмосферу референса, сделай чистый цельный референс сцены.`;

  return [
    goal,
    basePrompt ? `Уточнения: ${basePrompt}` : "",
    sourceLabel ? `Источник: ${sourceLabel}` : "",
  ].map(normalizeWorkspaceReferencePromptPart).filter(Boolean).join(". ");
};

export const getNextWorkspaceReferenceDefaultName = (
  references: readonly Pick<WorkspaceSavedReference, "kind" | "name">[] | null | undefined,
  kind: WorkspaceReferenceKind,
) => {
  const prefix = kind === "character" ? "Персонаж" : "Сцена";
  const pattern = new RegExp(`^${prefix}\\s+(\\d+)$`, "i");
  const maxNumber = (Array.isArray(references) ? references : [])
    .filter((reference) => reference.kind === kind)
    .reduce((currentMax, reference) => {
      const match = String(reference.name ?? "").trim().match(pattern);
      const parsed = match ? Number(match[1]) : Number.NaN;
      return Number.isFinite(parsed) && parsed > currentMax ? parsed : currentMax;
    }, 0);

  return `${prefix} ${maxNumber + 1}`;
};

const normalizeWorkspaceReferenceIdList = (values: readonly unknown[] | null | undefined) =>
  Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map(getPositiveWorkspaceMediaAssetId)
      .filter((value): value is number => typeof value === "number" && value > 0),
  ));

export const buildWorkspaceSegmentVisualReferenceRequest = (options: {
  characterIds?: readonly unknown[] | null;
  referenceAssetIds?: readonly unknown[] | null;
  sceneReferenceAssetIds?: readonly unknown[] | null;
}) => {
  const characterIds = normalizeWorkspaceReferenceIdList(options.characterIds);
  const referenceAssetIds = normalizeWorkspaceReferenceIdList(options.referenceAssetIds);
  const sceneReferenceAssetIds = normalizeWorkspaceReferenceIdList(options.sceneReferenceAssetIds);
  const preserveCharacters = characterIds.length > 0 || referenceAssetIds.length > 0;

  return {
    characterContinuityMode: preserveCharacters ? "force" as const : "off" as const,
    characterIds,
    preserveCharacters,
    referenceAssetIds,
    sceneReferenceAssetIds,
  };
};

export const buildWorkspaceReferenceGenerationMediaScope = (projectId: unknown): { projectId?: number } => {
  const numericProjectId = Number(projectId);
  if (!Number.isFinite(numericProjectId) || numericProjectId <= 0) {
    return {};
  }

  return { projectId: Math.trunc(numericProjectId) };
};
