import type { Locale } from "../../lib/i18n";
import { workspaceText } from "./workspace-page-model";
import { formatWorkspaceSegmentEditorChecklistPreview } from "./workspace-segment-editor-checklist";
import {
  getWorkspaceSegmentEffectiveSubtitleSettings,
  getWorkspaceSegmentVoiceOverrideId,
} from "./workspace-segment-editor";
import type {
  StudioSubtitleColorOption,
  StudioSubtitleStyleOption,
  StudioVoiceOption,
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentEditorDraftSession,
} from "./workspace-types";

export type WorkspaceSegmentTimelineVoiceSettings = {
  getVoiceOptionById: (voiceId: string | null | undefined) => StudioVoiceOption | null;
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
  if (getWorkspaceSegmentVoiceOverrideId(segment) === "none") {
    return workspaceText(locale, "Добавить озвучку", "Add voiceover");
  }

  const voiceOverrideOption = settings.getVoiceOptionById(getWorkspaceSegmentVoiceOverrideId(segment));
  if (!settings.studioSidebarVoiceEnabled && !voiceOverrideOption) {
    return workspaceText(locale, "Добавить озвучку", "Add voiceover");
  }

  const voice =
    voiceOverrideOption ?? settings.selectedVoiceOptions.find((option) => option.id === settings.studioSidebarVoiceId);
  if (voiceOverrideOption && voiceOverrideOption.id !== settings.studioSidebarVoiceId) {
    return voice?.label ?? workspaceText(locale, "Голос изменен", "Voice changed");
  }

  return voice?.label ?? workspaceText(locale, "Голос видео", "Video voice");
};

export const getWorkspaceSegmentTimelineVoiceOption = (
  segment: WorkspaceSegmentEditorDraftSegment,
  settings: WorkspaceSegmentTimelineVoiceSettings,
) => {
  if (getWorkspaceSegmentVoiceOverrideId(segment) === "none") {
    return null;
  }

  const voiceOverrideOption = settings.getVoiceOptionById(getWorkspaceSegmentVoiceOverrideId(segment));
  if (!settings.studioSidebarVoiceEnabled && !voiceOverrideOption) {
    return null;
  }

  return voiceOverrideOption ?? settings.selectedVoiceOptions.find((option) => option.id === settings.studioSidebarVoiceId) ?? null;
};

export const getWorkspaceSegmentTimelineSoundLabel = (
  locale: Locale,
  segment: WorkspaceSegmentEditorDraftSegment,
  options?: { isEmpty?: boolean; isPending?: boolean },
) => {
  if (options?.isPending) {
    return workspaceText(locale, "Звук", "Sound");
  }

  if (options?.isEmpty) {
    return workspaceText(locale, "Добавить звук", "Add sound");
  }

  return (
    formatWorkspaceSegmentEditorChecklistPreview(segment.sceneSoundPrompt || segment.sceneSoundGeneratedFromPrompt || "", 28) ||
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
) =>
  `${getWorkspaceSegmentTimelineVoiceLabel(locale, segment, settings)} · “${getWorkspaceSegmentTimelineVoiceTextPreview(
    locale,
    segment,
  )}”`;

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
  const styleLabel =
    options.subtitleStyleOptions.find((style) => style.id === effectiveSubtitleSettings.subtitleStyleId)?.label ??
    effectiveSubtitleSettings.subtitleStyleId;
  const colorLabel = colorOption?.label ?? effectiveSubtitleSettings.subtitleColorId;

  return {
    colorAccent: colorOption?.accent ?? null,
    label: styleLabel,
    title: `${styleLabel}: ${colorLabel}`,
  };
};
