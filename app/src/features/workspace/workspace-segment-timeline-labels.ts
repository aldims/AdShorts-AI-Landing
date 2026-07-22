import type { Locale } from "../../lib/i18n";
import { workspaceText } from "./workspace-page-model";
import { formatWorkspaceSegmentEditorChecklistPreview } from "./workspace-segment-editor-checklist";
import {
  createWorkspaceSegmentSceneSoundAsset,
  getWorkspaceSegmentEmbeddedVisualSoundAsset,
  getWorkspaceSegmentEffectiveSubtitleSettings,
  normalizeWorkspaceSegmentEditorTextForCompare,
  normalizeWorkspaceSegmentEditorSetting,
  normalizeWorkspaceSegmentSceneSoundPrompt,
  getWorkspaceSegmentVoiceOverrideId,
  WORKSPACE_SEGMENT_SCENE_SOUND_DEFAULT_PROMPT,
} from "./workspace-segment-editor";
import { getStudioSubtitleStyleDisplayLabel } from "./workspace-subtitle-preview-helpers";
import type {
  StudioSubtitleColorOption,
  StudioSubtitleStyleOption,
  StudioVoiceOption,
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentEditorDraftSession,
} from "./workspace-types";

export type WorkspaceSegmentTimelineVoiceSettings = {
  getVoiceOptionById: (voiceId: string | null | undefined) => StudioVoiceOption | null;
  projectVoiceType?: string | null;
  selectedVoiceOptions: StudioVoiceOption[];
  studioSidebarVoiceEnabled: boolean;
  studioSidebarVoiceId: StudioVoiceOption["id"];
};

export type WorkspaceSegmentTimelineSubtitleDisplay = {
  colorAccent: string | null;
  label: string;
  title: string;
};

export const getWorkspaceSegmentTimelineVoiceLabel = (
  locale: Locale,
  segment: WorkspaceSegmentEditorDraftSegment,
  settings: WorkspaceSegmentTimelineVoiceSettings,
) => {
  const voiceOverrideId = getWorkspaceSegmentVoiceOverrideId(segment);
  if (voiceOverrideId === "none") {
    return workspaceText(locale, "Добавить озвучку", "Add voiceover");
  }

  const projectVoiceId = normalizeWorkspaceSegmentEditorSetting(settings.projectVoiceType);
  if (!voiceOverrideId && projectVoiceId === "none") {
    return workspaceText(locale, "Добавить озвучку", "Add voiceover");
  }

  const voiceOverrideOption = settings.getVoiceOptionById(voiceOverrideId);
  const projectVoiceOption = settings.getVoiceOptionById(projectVoiceId);
  const voiceoverVoiceOption = settings.getVoiceOptionById(segment.voiceoverVoiceType);
  const fallbackStudioVoiceOption = settings.studioSidebarVoiceEnabled
    ? settings.selectedVoiceOptions.find((option) => option.id === settings.studioSidebarVoiceId) ??
      settings.getVoiceOptionById(settings.studioSidebarVoiceId)
    : null;
  if (!voiceOverrideOption && !projectVoiceOption && !voiceoverVoiceOption && !fallbackStudioVoiceOption) {
    return workspaceText(locale, "Добавить озвучку", "Add voiceover");
  }

  const voice =
    voiceOverrideOption ??
    projectVoiceOption ??
    voiceoverVoiceOption ??
    fallbackStudioVoiceOption;
  if (voiceOverrideOption && voiceOverrideOption.id !== settings.studioSidebarVoiceId) {
    return voice?.label ?? workspaceText(locale, "Голос изменен", "Voice changed");
  }

  return voice?.label ?? workspaceText(locale, "Голос видео", "Video voice");
};

export const getWorkspaceSegmentTimelineVoiceOption = (
  segment: WorkspaceSegmentEditorDraftSegment,
  settings: WorkspaceSegmentTimelineVoiceSettings,
) => {
  const voiceOverrideId = getWorkspaceSegmentVoiceOverrideId(segment);
  if (voiceOverrideId === "none") {
    return null;
  }

  const projectVoiceId = normalizeWorkspaceSegmentEditorSetting(settings.projectVoiceType);
  if (!voiceOverrideId && projectVoiceId === "none") {
    return null;
  }

  const voiceOverrideOption = settings.getVoiceOptionById(voiceOverrideId);
  const projectVoiceOption = settings.getVoiceOptionById(projectVoiceId);
  const voiceoverVoiceOption = settings.getVoiceOptionById(segment.voiceoverVoiceType);
  const fallbackStudioVoiceOption = settings.studioSidebarVoiceEnabled
    ? settings.selectedVoiceOptions.find((option) => option.id === settings.studioSidebarVoiceId) ??
      settings.getVoiceOptionById(settings.studioSidebarVoiceId)
    : null;
  if (!voiceOverrideOption && !projectVoiceOption && !voiceoverVoiceOption && !fallbackStudioVoiceOption) {
    return null;
  }

  return (
    voiceOverrideOption ??
    projectVoiceOption ??
    voiceoverVoiceOption ??
    fallbackStudioVoiceOption ??
    null
  );
};

export const getWorkspaceSegmentTimelineSoundLabel = (
  locale: Locale,
  segment: WorkspaceSegmentEditorDraftSegment,
  options?: { isEmpty?: boolean; isPending?: boolean },
) => {
  if (options?.isPending) {
    return workspaceText(locale, "Создаём звук", "Creating sound");
  }

  if (options?.isEmpty) {
    return workspaceText(locale, "Добавить звук", "Add sound");
  }

  if (
    !createWorkspaceSegmentSceneSoundAsset(segment, segment.index) &&
    getWorkspaceSegmentEmbeddedVisualSoundAsset(segment)
  ) {
    return workspaceText(locale, "Звук ИИ видео", "AI video sound");
  }

  const prompt = segment.sceneSoundPrompt || segment.sceneSoundGeneratedFromPrompt || "";
  if (
    normalizeWorkspaceSegmentSceneSoundPrompt(prompt) ===
    normalizeWorkspaceSegmentSceneSoundPrompt(WORKSPACE_SEGMENT_SCENE_SOUND_DEFAULT_PROMPT)
  ) {
    return workspaceText(locale, "Авто", "Auto");
  }

  return (
    formatWorkspaceSegmentEditorChecklistPreview(prompt, 28) ||
    workspaceText(locale, "Звук сцены", "Scene sound")
  );
};

export const getWorkspaceSegmentTimelineVoiceTextPreview = (
  locale: Locale,
  segment: WorkspaceSegmentEditorDraftSegment,
) => formatWorkspaceSegmentEditorChecklistPreview(segment.text, 30) || workspaceText(locale, "Текст пуст", "No text");

export const getWorkspaceSegmentTimelineVoiceDisplayLabel = (
  locale: Locale,
  segment: WorkspaceSegmentEditorDraftSegment,
  settings: WorkspaceSegmentTimelineVoiceSettings,
) => {
  const textPreview = getWorkspaceSegmentTimelineVoiceTextPreview(locale, segment);
  if (!normalizeWorkspaceSegmentEditorTextForCompare(segment.text)) {
    return workspaceText(locale, "Добавить озвучку", "Add voiceover");
  }

  return `${getWorkspaceSegmentTimelineVoiceLabel(locale, segment, settings)} · “${textPreview}”`;
};

export const getWorkspaceSegmentTimelineSubtitleDisplay = (
  locale: Locale,
  segmentEditorDraft: WorkspaceSegmentEditorDraftSession | null,
  segment: WorkspaceSegmentEditorDraftSegment,
  options: {
    studioSidebarSubtitleColorId: StudioSubtitleColorOption["id"];
    studioSidebarSubtitleStyleId: StudioSubtitleStyleOption["id"];
    subtitleColorOptions: StudioSubtitleColorOption[];
    subtitleStyleOptions: StudioSubtitleStyleOption[];
  },
): WorkspaceSegmentTimelineSubtitleDisplay => {
  const effectiveSubtitleSettings = getWorkspaceSegmentEffectiveSubtitleSettings(segmentEditorDraft, segment, {
    subtitleColorId: options.studioSidebarSubtitleColorId,
    subtitleStyleId: options.studioSidebarSubtitleStyleId,
  });

  if (!effectiveSubtitleSettings.voiceEnabled) {
    const label = workspaceText(locale, "Нет озвучки", "No voiceover");
    return { colorAccent: null, label, title: label };
  }

  if (!effectiveSubtitleSettings.isEnabled) {
    const label = workspaceText(locale, "Добавить субтитры", "Add subtitles");
    return { colorAccent: null, label, title: label };
  }

  const colorOption = options.subtitleColorOptions.find((color) => color.id === effectiveSubtitleSettings.subtitleColorId);
  const styleOption = options.subtitleStyleOptions.find((style) => style.id === effectiveSubtitleSettings.subtitleStyleId);
  const styleLabel =
    getStudioSubtitleStyleDisplayLabel(locale, styleOption) ||
    effectiveSubtitleSettings.subtitleStyleId;
  const colorLabel = colorOption?.label ?? effectiveSubtitleSettings.subtitleColorId;

  return {
    colorAccent: colorOption?.accent ?? null,
    label: styleLabel,
    title: `${styleLabel}: ${colorLabel}`,
  };
};
