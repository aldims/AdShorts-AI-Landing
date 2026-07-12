import type { ExamplePrefillStudioSettings } from "../../../shared/example-prefill";
import type { WorkspaceMediaAssetRef } from "../../../shared/workspace-media-assets";
import type {
  WorkspaceSegmentDurationMode,
  WorkspaceSegmentDurationSyncMode,
} from "../../lib/workspaceSegmentEditorTimeline";

export type StudioVideoMode = "ai_photo" | "ai_video" | "custom" | "standard";

export type WorkspaceSegmentVoiceTimelineHistoryKind = "voice" | "text";

export type WorkspaceSegmentVoiceTimelineState = {
  canBack: boolean;
  canForward: boolean;
  hasHistory: boolean;
  historyKind: WorkspaceSegmentVoiceTimelineHistoryKind;
  isEdited: boolean;
};

export type WorkspacePublishPlatform = "instagram" | "youtube";

export type WorkspaceProjectPublication = {
  channelName: string | null;
  channelPk: number | null;
  link: string | null;
  platform?: WorkspacePublishPlatform;
  providerMediaId?: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  state: string | null;
  youtubeVideoId: string | null;
};

export type WorkspaceProjectYouTubePublication = WorkspaceProjectPublication;
export type WorkspaceProjectInstagramPublication = WorkspaceProjectPublication;

export type WorkspaceProject = {
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
  instagramPublication: WorkspaceProjectInstagramPublication | null;
  youtubePublication: WorkspaceProjectYouTubePublication | null;
};

export type WorkspaceSegmentEditorVideoAction =
  | "ai"
  | "ai_photo"
  | "custom"
  | "image_edit"
  | "original"
  | "photo_animation"
  | "talking_photo";

export type WorkspaceSegmentPreviewKind = "video" | "image";

export type WorkspaceSegmentAiVideoMode = "ai_video" | "photo_animation" | "talking_photo";

export type WorkspaceSegmentMediaType = "photo" | "video";

export type WorkspaceSegmentSourceKind = "ai_generated" | "stock" | "upload" | "unknown";

export type WorkspaceSegmentCustomVisualSource = "upload" | "media-library";

export type WorkspaceSegmentEditorSpeechWord = {
  confidence: number;
  endTime: number;
  startTime: number;
  text: string;
};

export type WorkspaceSegmentSceneSoundPayload = {
  download_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  media_asset_id?: number | null;
  mime_type?: string | null;
  remote_url?: string | null;
  url?: string | null;
};

export type WorkspaceSegmentEditorSegment = {
  currentAsset: WorkspaceMediaAssetRef | null;
  currentExternalPlaybackUrl: string | null;
  currentExternalPreviewUrl: string | null;
  currentPlaybackUrl: string | null;
  currentPosterUrl: string | null;
  currentPreviewUrl: string | null;
  currentSourceKind: WorkspaceSegmentSourceKind;
  duration: number;
  durationExtensionSourceDurationSeconds?: number | null;
  duration_extension_source_duration_seconds?: number | null;
  durationMode?: WorkspaceSegmentDurationMode | null;
  durationSyncMode?: WorkspaceSegmentDurationSyncMode | null;
  durationSyncModeUserSelected?: boolean | null;
  duration_sync_mode?: WorkspaceSegmentDurationSyncMode | null;
  duration_sync_mode_user_selected?: boolean | null;
  endTime: number;
  index: number;
  manualDurationSeconds?: number | null;
  mediaType: WorkspaceSegmentMediaType;
  originalAsset: WorkspaceMediaAssetRef | null;
  originalExternalPlaybackUrl: string | null;
  originalExternalPreviewUrl: string | null;
  originalPlaybackUrl: string | null;
  originalPosterUrl: string | null;
  originalPreviewUrl: string | null;
  originalSourceKind: WorkspaceSegmentSourceKind;
  sceneSound?: StudioCustomVideoFile | null;
  sceneSoundAssetId?: number | null;
  scene_sound?: WorkspaceSegmentSceneSoundPayload | null;
  scene_sound_asset_id?: number | null;
  speechDuration: number | null;
  speechDurationSource?: "audio" | null;
  speechEndTime: number | null;
  speechStartTime: number | null;
  speechWords: WorkspaceSegmentEditorSpeechWord[];
  startTime: number;
  voiceSourceDuration?: number | null;
  voiceSourceEndTime?: number | null;
  voiceSourceStartTime?: number | null;
  voice_source_duration?: number | null;
  voice_source_end_time?: number | null;
  voice_source_start_time?: number | null;
  _voice_source_duration?: number | null;
  _voice_source_end_time?: number | null;
  _voice_source_start_time?: number | null;
  _voice_render_source_end_time?: number | null;
  _voice_render_source_start_time?: number | null;
  subtitleColor?: string | null;
  subtitle_color?: string | null;
  subtitleStyle?: string | null;
  subtitle_style?: string | null;
  subtitleType?: string | null;
  subtitle_type?: string | null;
  text: string;
  voiceover?: WorkspaceSegmentSceneSoundPayload | null;
  voiceoverAssetId?: number | null;
  voiceoverLanguage?: string | null;
  voiceoverTextHash?: string | null;
  voiceoverVoiceType?: string | null;
  voiceover_asset_id?: number | null;
  voiceType?: string | null;
  voice_type?: string | null;
  aiVideoGeneratedMode?: WorkspaceSegmentAiVideoMode | null;
  videoAction?: WorkspaceSegmentEditorVideoAction | null;
};

export type WorkspaceSegmentEditorSession = {
  customMusicAssetId?: number | null;
  customMusicFileName?: string | null;
  description: string;
  finalVideoAssetId?: number | null;
  finalVideoInvalidatedAt?: string | null;
  finalVideoStale?: boolean;
  language?: StudioLanguage | "";
  musicAssetId?: number | null;
  musicName?: string | null;
  musicType: string;
  projectId: number;
  segments: WorkspaceSegmentEditorSegment[];
  subtitleColor: string;
  subtitleStyle: string;
  subtitleType: string;
  title: string;
  ttsAssetId?: number | null;
  voiceType: string;
};

export type WorkspaceSegmentEditorLocalizedTextMap = Partial<Record<StudioLanguage, string>>;

export type WorkspaceSegmentEditorDraftSegment = WorkspaceSegmentEditorSegment & {
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
  durationSyncMode?: WorkspaceSegmentDurationSyncMode | null;
  durationSyncModeUserSelected?: boolean | null;
  duration_sync_mode_user_selected?: boolean | null;
  durationExtensionSourceDurationSeconds?: number | null;
  estimatedVoiceoverDurationSeconds?: number | null;
  estimatedVoiceoverTextHash?: string | null;
  originalText: string;
  originalTextByLanguage: WorkspaceSegmentEditorLocalizedTextMap;
  photoAnimationSourceAsset: StudioCustomVideoFile | null;
  sceneSoundAsset: StudioCustomVideoFile | null;
  sceneSoundGeneratedFromPrompt: string | null;
  sceneSoundPrompt: string;
  sceneSoundPromptInitialized: boolean;
  sceneSoundReset?: boolean;
  textByLanguage: WorkspaceSegmentEditorLocalizedTextMap;
  voiceoverAsset: StudioCustomVideoFile | null;
  voiceoverLanguage: string | null;
  voiceoverTextHash: string | null;
  voiceoverVoiceType: string | null;
  videoAction: WorkspaceSegmentEditorVideoAction;
  visualReset: boolean;
};

export type WorkspaceSegmentEditorDraftSession = Omit<WorkspaceSegmentEditorSession, "segments"> & {
  segments: WorkspaceSegmentEditorDraftSegment[];
};

export type WorkspaceSegmentEditorMediaUploadScope = {
  projectId?: number;
  segmentIndex?: number;
};

export type WorkspaceSegmentTimelineHistoryKind = "visual" | "music" | "voice" | "sound" | "text" | "subtitle";

export type StudioVoiceOption = {
  badgeLabel?: string;
  creditCost?: number;
  id: string;
  label: string;
  description: string;
  previewSampleUrl?: string;
};

export type StudioLanguage = "ru" | "en";

export type StudioCustomMusicFile = {
  assetId?: number;
  dataUrl?: string;
  file?: File;
  fileName: string;
  fileSize: number;
  objectUrl?: string;
};

export type StudioVideoOption = {
  description: string;
  detail?: string;
  duration?: string;
  id: StudioVideoMode;
  label: string;
};

export type StudioCustomVideoFile = {
  assetId?: number;
  dataUrl?: string;
  durationSeconds?: number;
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

export type StudioBrandLogoFile = {
  assetId?: number;
  dataUrl?: string;
  file?: File;
  fileName: string;
  fileSize: number;
  mimeType: string;
  objectUrl?: string;
};

export type StudioSubtitleStyleOption = {
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

export type StudioSubtitleColorCatalogOption = {
  hex: string;
  id: string;
  label: string;
};

export type StudioSubtitleColorOption = {
  accent: string;
  id: string;
  label: string;
  outline: string;
  surface: string;
  text: string;
};

export type StudioSubtitleColorOverrides = Partial<Pick<StudioSubtitleColorOption, "outline" | "surface" | "text">>;
