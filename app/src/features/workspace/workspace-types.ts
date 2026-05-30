export type StudioVideoMode = "ai_photo" | "ai_video" | "custom" | "standard";

export type WorkspaceSegmentVoiceTimelineHistoryKind = "voice" | "text";

export type WorkspaceSegmentVoiceTimelineState = {
  canBack: boolean;
  canForward: boolean;
  hasHistory: boolean;
  historyKind: WorkspaceSegmentVoiceTimelineHistoryKind;
  isEdited: boolean;
};
