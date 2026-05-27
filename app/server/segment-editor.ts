import { env } from "./env.js";
import { getWorkspaceProjects } from "./projects.js";
import {
  buildWorkspaceMediaAssetRef,
  fetchProjectMediaEnvelope,
  mergeWorkspaceMediaAssetRefs,
} from "./media-assets.js";
import {
  assertAdsflowConfigured,
  buildAdsflowUrl,
  fetchAdsflowJson as fetchAdsflowJsonWithPolicy,
  UpstreamFetchError,
  UpstreamHttpError,
  upstreamPolicies,
} from "./upstream-client.js";
import { listWorkspaceDeletedProjects, listWorkspaceGenerationHistory } from "./workspace-history.js";
import type { ProjectMediaEnvelope, WorkspaceMediaAssetRef } from "../shared/workspace-media-assets.js";

type SegmentEditorUser = {
  email?: string | null;
  id?: string | null;
  name?: string | null;
};

type AdsflowSegmentEditorSpeechWordPayload = {
  confidence?: number | string | null;
  end_time?: number | string | null;
  start_time?: number | string | null;
  text?: string | null;
};

type AdsflowSegmentEditorSegmentPayload = {
  current_video?: string | null;
  duration?: number | string | null;
  duration_mode?: string | null;
  end_time?: number | string | null;
  index?: number | string | null;
  manual_duration_seconds?: number | string | null;
  media_type?: string | null;
  original_video?: string | null;
  scene_sound?: AdsflowProjectMediaEntryPayload | null;
  scene_sound_asset_id?: number | string | null;
  speech_duration?: number | string | null;
  speech_end_time?: number | string | null;
  speech_start_time?: number | string | null;
  speech_words?: AdsflowSegmentEditorSpeechWordPayload[] | null;
  start_time?: number | string | null;
  subtitle_color?: string | null;
  subtitle_style?: string | null;
  subtitle_type?: string | null;
  text?: string | null;
  voiceover?: AdsflowProjectMediaEntryPayload | null;
  voiceover_asset_id?: number | string | null;
  voiceover_language?: string | null;
  voiceover_text_hash?: string | null;
  voiceover_voice_type?: string | null;
  voice_type?: string | null;
};

export type AdsflowSegmentEditorResponse = {
  description?: string | null;
  language?: string | null;
  music_asset_id?: number | string | null;
  music_name?: string | null;
  music_type?: string | null;
  project_id?: number | string | null;
  segments?: AdsflowSegmentEditorSegmentPayload[] | null;
  subtitle_color?: string | null;
  subtitle_style?: string | null;
  subtitle_type?: string | null;
  title?: string | null;
  tts_asset_id?: number | string | null;
  voice_type?: string | null;
};

type AdsflowProjectMediaEntryPayload = {
  asset_kind?: string | null;
  download_url?: string | null;
  file_name?: string | null;
  file_size?: number | string | null;
  id?: number | string | null;
  kind?: string | null;
  link_role?: string | null;
  local_path?: string | null;
  media_asset_id?: number | string | null;
  media_type?: string | null;
  mime_type?: string | null;
  preview?: string | null;
  rendered_animation_mode?: string | null;
  rendered_via_i2v?: boolean | string | number | null;
  role?: string | null;
  segment_index?: number | string | null;
  source?: string | null;
  source_kind?: string | null;
  storage_key?: string | null;
  url?: string | null;
};

type WorkspaceSegmentSceneSoundRef = {
  download_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  media_asset_id?: number | null;
  mime_type?: string | null;
  remote_url?: string | null;
  url?: string | null;
};

type WorkspaceSegmentVoiceoverRef = WorkspaceSegmentSceneSoundRef;

type AdsflowProjectGenerationSettingsPayload = {
  background_urls?: AdsflowProjectMediaEntryPayload[] | null;
  content_language?: string | null;
  custom_music_asset_id?: number | string | null;
  custom_music_original_name?: string | null;
  current_rendered_segments?: AdsflowProjectMediaEntryPayload[] | null;
  final_video_asset_id?: number | string | null;
  final_video_download_path?: string | null;
  music_asset_id?: number | string | null;
  music_type?: string | null;
  original_ai_description?: string | null;
  original_ai_title?: string | null;
  original_video_segments?: AdsflowSegmentEditorSegmentPayload[] | null;
  original_videos?: AdsflowProjectMediaEntryPayload[] | null;
  project_title?: string | null;
  requested_language?: string | null;
  source_video_urls?: AdsflowProjectMediaEntryPayload[] | null;
  subtitle_color?: string | null;
  subtitle_style?: string | null;
  subtitle_type?: string | null;
  tts_asset_id?: number | string | null;
  video_segments?: AdsflowSegmentEditorSegmentPayload[] | null;
  video_urls?: AdsflowProjectMediaEntryPayload[] | null;
  voice_type?: string | null;
};

type AdsflowProjectDetailsResponse = {
  ai_title?: string | null;
  background_urls?: AdsflowProjectMediaEntryPayload[] | null;
  content_language?: string | null;
  custom_music_asset_id?: number | string | null;
  description?: string | null;
  generation_settings?: AdsflowProjectGenerationSettingsPayload | null;
  id?: number | string | null;
  music_asset_id?: number | string | null;
  music_name?: string | null;
  music_type?: string | null;
  project_id?: number | string | null;
  source_video_urls?: AdsflowProjectMediaEntryPayload[] | null;
  subtitle_color?: string | null;
  subtitle_style?: string | null;
  subtitle_type?: string | null;
  tts_asset_id?: number | string | null;
  video_urls?: AdsflowProjectMediaEntryPayload[] | null;
  voice_type?: string | null;
};

type WorkspaceSegmentEditorSessionBuildOptions = {
  projectDetailsPayload?: AdsflowProjectDetailsResponse | null;
  projectMediaEnvelope?: ProjectMediaEnvelope | null;
};

export type WorkspaceSegmentEditorVideoSource = "current" | "original";
export type WorkspaceSegmentEditorVideoDelivery = "preview" | "playback";
export type WorkspaceSegmentEditorSourceKind = "ai_generated" | "stock" | "upload" | "unknown";

export type WorkspaceSegmentEditorSpeechWord = {
  confidence: number;
  endTime: number;
  startTime: number;
  text: string;
};

export type WorkspaceSegmentEditorMediaType = "photo" | "video";

export type WorkspaceSegmentEditorSegment = {
  currentAsset: WorkspaceMediaAssetRef | null;
  currentExternalPlaybackUrl: string | null;
  currentExternalPreviewUrl: string | null;
  currentPlaybackUrl: string | null;
  currentPosterUrl: string | null;
  currentPreviewUrl: string | null;
  currentSourceKind: WorkspaceSegmentEditorSourceKind;
  duration: number;
  durationMode: "auto" | "manual";
  endTime: number;
  index: number;
  manualDurationSeconds: number | null;
  mediaType: WorkspaceSegmentEditorMediaType;
  originalAsset: WorkspaceMediaAssetRef | null;
  originalExternalPlaybackUrl: string | null;
  originalExternalPreviewUrl: string | null;
  originalPlaybackUrl: string | null;
  originalPosterUrl: string | null;
  originalPreviewUrl: string | null;
  originalSourceKind: WorkspaceSegmentEditorSourceKind;
  sceneSoundAssetId: number | null;
  scene_sound: WorkspaceSegmentSceneSoundRef | null;
  scene_sound_asset_id: number | null;
  speechDuration: number | null;
  speechEndTime: number | null;
  speechStartTime: number | null;
  speechWords: WorkspaceSegmentEditorSpeechWord[];
  startTime: number;
  subtitleColor: string | null;
  subtitleStyle: string | null;
  subtitleType: string | null;
  text: string;
  voiceover: WorkspaceSegmentVoiceoverRef | null;
  voiceoverAssetId: number | null;
  voiceoverLanguage: string | null;
  voiceoverTextHash: string | null;
  voiceoverVoiceType: string | null;
  voiceover_asset_id: number | null;
  voiceType: string | null;
};

export type WorkspaceSegmentEditorSession = {
  customMusicAssetId: number | null;
  customMusicFileName: string;
  description: string;
  language: string;
  musicAssetId: number | null;
  musicName: string;
  musicType: string;
  projectId: number;
  segments: WorkspaceSegmentEditorSegment[];
  subtitleColor: string;
  subtitleStyle: string;
  subtitleType: string;
  title: string;
  ttsAssetId: number | null;
  voiceType: string;
};

export class WorkspaceSegmentEditorError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "WorkspaceSegmentEditorError";
    this.statusCode = statusCode;
  }
}

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizeWorkspaceSegmentEditorLanguage = (value: unknown) => {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === "en" || normalized === "ru" ? normalized : "";
};

const normalizeInteger = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  const rounded = Math.trunc(numeric);
  return rounded >= 0 ? rounded : null;
};

const normalizeNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeSegmentDurationMode = (value: unknown): "auto" | "manual" => {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === "manual" ? "manual" : "auto";
};

const normalizeManualDurationSeconds = (value: unknown) => {
  const numeric = normalizeNumber(value);
  return numeric !== null && numeric >= 1 ? numeric : null;
};

const normalizePositiveProjectId = (value: unknown) => {
  const normalized = normalizeInteger(value);
  return normalized !== null && normalized > 0 ? normalized : null;
};

const normalizeMediaType = (value: unknown): WorkspaceSegmentEditorMediaType =>
  String(value ?? "").trim().toLowerCase() === "photo" ? "photo" : "video";

const normalizeUrl = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
};

export const resolveWorkspaceSegmentEditorCustomMusicMetadata = (
  projectDetailsPayload?: AdsflowProjectDetailsResponse | null,
) => {
  const generationSettings =
    projectDetailsPayload?.generation_settings && typeof projectDetailsPayload.generation_settings === "object"
      ? projectDetailsPayload.generation_settings
      : null;
  const generationMusicType = normalizeText(generationSettings?.music_type).toLowerCase();
  const projectMusicType = normalizeText(projectDetailsPayload?.music_type).toLowerCase();
  const explicitCustomMusicAssetId = normalizeInteger(
    generationSettings?.custom_music_asset_id ?? projectDetailsPayload?.custom_music_asset_id,
  );
  const explicitCustomMusicFileName = normalizeText(generationSettings?.custom_music_original_name);
  const projectMusicFileName = normalizeText(projectDetailsPayload?.music_name);

  if (
    generationMusicType !== "custom" &&
    projectMusicType !== "custom" &&
    !explicitCustomMusicAssetId &&
    !explicitCustomMusicFileName
  ) {
    return {
      customMusicAssetId: null,
      customMusicFileName: "",
    };
  }

  return {
    customMusicAssetId:
      normalizeInteger(
        explicitCustomMusicAssetId ??
          generationSettings?.music_asset_id ??
          projectDetailsPayload?.music_asset_id,
      ) ?? null,
    customMusicFileName: explicitCustomMusicFileName || projectMusicFileName,
  };
};

const resolveWorkspaceSegmentEditorLanguage = (
  payload: AdsflowSegmentEditorResponse,
  projectDetailsPayload?: AdsflowProjectDetailsResponse | null,
) => {
  const generationSettings =
    projectDetailsPayload?.generation_settings && typeof projectDetailsPayload.generation_settings === "object"
      ? projectDetailsPayload.generation_settings
      : null;

  return (
    normalizeWorkspaceSegmentEditorLanguage(payload.language) ||
    normalizeWorkspaceSegmentEditorLanguage(generationSettings?.content_language) ||
    normalizeWorkspaceSegmentEditorLanguage(generationSettings?.requested_language) ||
    ""
  );
};

const isWorkspaceRenderableMediaUrl = (value: string | null | undefined) => {
  const normalized = normalizeUrl(value);
  if (!normalized) {
    return false;
  }

  if (normalized.startsWith("/")) {
    return true;
  }

  try {
    const resolvedUrl = new URL(normalized);
    return (
      resolvedUrl.protocol === "http:" ||
      resolvedUrl.protocol === "https:" ||
      resolvedUrl.protocol === "file:"
    );
  } catch {
    return false;
  }
};

const pickWorkspaceRenderableMediaUrl = (...candidates: Array<string | null | undefined>) => {
  for (const candidate of candidates) {
    if (isWorkspaceRenderableMediaUrl(candidate)) {
      return normalizeUrl(candidate);
    }
  }

  return null;
};

const ADSFLOW_MEDIA_DOWNLOAD_PATH_PATTERN = /\/api\/media\/(\d+)\/download(?:[/?#]|$)/i;

const buildWorkspaceMediaAssetProxyUrl = (assetId: number) => `/api/workspace/media-assets/${assetId}`;

const getProjectMediaEntryAssetId = (entry?: AdsflowProjectMediaEntryPayload | null) =>
  normalizeInteger(entry?.media_asset_id) ?? normalizeInteger(entry?.id);

const getProjectMediaEntryRoleText = (entry?: AdsflowProjectMediaEntryPayload | null) =>
  [
    entry?.asset_kind,
    entry?.kind,
    entry?.link_role,
    entry?.role,
    entry?.source,
    entry?.source_kind,
    entry?.storage_key,
  ]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean)
    .join(" ");

const isProjectMediaEntryAudio = (entry?: AdsflowProjectMediaEntryPayload | null) => {
  const mediaType = normalizeText(entry?.media_type).toLowerCase();
  const mimeType = normalizeText(entry?.mime_type).toLowerCase();
  return mediaType === "audio" || mimeType.startsWith("audio/");
};

const isProjectSceneSoundMediaEntry = (entry?: AdsflowProjectMediaEntryPayload | null) => {
  if (!isProjectMediaEntryAudio(entry)) {
    return false;
  }

  const roleText = getProjectMediaEntryRoleText(entry).replace(/-/g, "_");
  return (
    roleText.includes("scene_sound") ||
    roleText.includes("segment_sound") ||
    roleText.includes("segment_scene") ||
    roleText.includes("sound_effect")
  );
};

const isProjectVoiceoverMediaEntry = (entry?: AdsflowProjectMediaEntryPayload | null) => {
  if (!isProjectMediaEntryAudio(entry)) {
    return false;
  }

  const roleText = getProjectMediaEntryRoleText(entry).replace(/-/g, "_");
  return (
    roleText.includes("voiceover") ||
    roleText.includes("segment_voice") ||
    roleText.includes("segment_tts") ||
    roleText.includes("tts")
  );
};

const buildWorkspaceSegmentSceneSoundRef = (
  entry?: AdsflowProjectMediaEntryPayload | WorkspaceSegmentSceneSoundRef | null,
): WorkspaceSegmentSceneSoundRef | null => {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as AdsflowProjectMediaEntryPayload & WorkspaceSegmentSceneSoundRef;
  const assetId = normalizePositiveProjectId(record.media_asset_id) ?? normalizePositiveProjectId(record.id);
  const downloadUrl = normalizeText(record.download_url);
  const remoteUrl = normalizeText(record.remote_url);
  const url = normalizeText(record.url);

  if (!assetId && !downloadUrl && !remoteUrl && !url) {
    return null;
  }

  return {
    download_url: downloadUrl || null,
    file_name:
      normalizeText(record.file_name) ||
      normalizeText(record.storage_key).split("/").pop() ||
      (assetId ? `segment-scene-sound-${assetId}.wav` : "segment-scene-sound.wav"),
    file_size: Math.max(0, Number(record.file_size ?? 0) || 0),
    media_asset_id: assetId,
    mime_type: normalizeText(record.mime_type) || "audio/wav",
    remote_url: remoteUrl || null,
    url: url || null,
  };
};

const findProjectSceneSoundMediaEntry = (
  entries: AdsflowProjectMediaEntryPayload[],
  segmentIndex: number,
) =>
  entries.find((entry) => normalizeInteger(entry?.segment_index) === segmentIndex && isProjectSceneSoundMediaEntry(entry)) ??
  null;

const findProjectVoiceoverMediaEntry = (
  entries: AdsflowProjectMediaEntryPayload[],
  segmentIndex: number,
) =>
  entries.find((entry) => normalizeInteger(entry?.segment_index) === segmentIndex && isProjectVoiceoverMediaEntry(entry)) ??
  null;

const getWorkspaceMediaAssetRoleText = (asset?: WorkspaceMediaAssetRef | null) =>
  [
    asset?.kind,
    asset?.libraryKind,
    asset?.role,
    asset?.sourceKind,
    asset?.storageKey,
  ]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean)
    .join(" ");

const isWorkspaceSceneSoundMediaAsset = (asset?: WorkspaceMediaAssetRef | null) => {
  const mediaType = normalizeText(asset?.mediaType).toLowerCase();
  const mimeType = normalizeText(asset?.mimeType).toLowerCase();
  const isAudio = mediaType === "audio" || mimeType.startsWith("audio/");
  if (!isAudio) {
    return false;
  }

  const roleText = getWorkspaceMediaAssetRoleText(asset).replace(/-/g, "_");
  return (
    roleText.includes("scene_sound") ||
    roleText.includes("segment_sound") ||
    roleText.includes("segment_scene") ||
    roleText.includes("sound_effect")
  );
};

const isWorkspaceVoiceoverMediaAsset = (asset?: WorkspaceMediaAssetRef | null) => {
  const mediaType = normalizeText(asset?.mediaType).toLowerCase();
  const mimeType = normalizeText(asset?.mimeType).toLowerCase();
  const isAudio = mediaType === "audio" || mimeType.startsWith("audio/");
  if (!isAudio) {
    return false;
  }

  const roleText = getWorkspaceMediaAssetRoleText(asset).replace(/-/g, "_");
  return (
    roleText.includes("voiceover") ||
    roleText.includes("segment_voice") ||
    roleText.includes("segment_tts") ||
    roleText.includes("tts")
  );
};

const buildWorkspaceSegmentSceneSoundRefFromAsset = (
  asset?: WorkspaceMediaAssetRef | null,
): WorkspaceSegmentSceneSoundRef | null => {
  if (!asset) {
    return null;
  }

  const assetId = normalizePositiveProjectId(asset.assetId);
  const downloadUrl = normalizeText(asset.downloadPath) || normalizeText(asset.downloadUrl);
  const remoteUrl = normalizeText(asset.playbackUrl) || normalizeText(asset.originalUrl);

  if (!assetId && !downloadUrl && !remoteUrl) {
    return null;
  }

  return {
    download_url: downloadUrl || null,
    file_name:
      normalizeText(asset.storageKey).split("/").pop() ||
      (assetId ? `segment-scene-sound-${assetId}.wav` : "segment-scene-sound.wav"),
    file_size: 0,
    media_asset_id: assetId,
    mime_type: normalizeText(asset.mimeType) || "audio/wav",
    remote_url: remoteUrl || null,
    url: normalizeText(asset.originalUrl) || null,
  };
};

const findProjectSceneSoundMediaAsset = (
  assets: WorkspaceMediaAssetRef[],
  segmentIndex: number,
) =>
  assets.find((asset) => normalizeInteger(asset?.segmentIndex) === segmentIndex && isWorkspaceSceneSoundMediaAsset(asset)) ??
  null;

const findProjectVoiceoverMediaAsset = (
  assets: WorkspaceMediaAssetRef[],
  segmentIndex: number,
) =>
  assets.find((asset) => normalizeInteger(asset?.segmentIndex) === segmentIndex && isWorkspaceVoiceoverMediaAsset(asset)) ??
  null;

const normalizeWorkspaceProjectMediaUrl = (
  entry: AdsflowProjectMediaEntryPayload | null | undefined,
  value: string | null,
) => {
  const normalizedUrl = normalizeUrl(value);
  if (!normalizedUrl) {
    return null;
  }

  const assetId = getProjectMediaEntryAssetId(entry);
  if (!assetId || normalizeMediaType(entry?.media_type) !== "photo") {
    return normalizedUrl;
  }

  const matchedPath = normalizedUrl.match(ADSFLOW_MEDIA_DOWNLOAD_PATH_PATTERN);
  if (matchedPath) {
    return buildWorkspaceMediaAssetProxyUrl(assetId);
  }

  try {
    const resolvedUrl = new URL(normalizedUrl);
    return ADSFLOW_MEDIA_DOWNLOAD_PATH_PATTERN.test(resolvedUrl.pathname)
      ? buildWorkspaceMediaAssetProxyUrl(assetId)
      : normalizedUrl;
  } catch {
    return normalizedUrl;
  }
};

const getProjectMediaEntryRenderableUrl = (
  entry: AdsflowProjectMediaEntryPayload | null | undefined,
  ...candidates: Array<string | null | undefined>
) => normalizeWorkspaceProjectMediaUrl(entry, pickWorkspaceRenderableMediaUrl(...candidates));

const normalizeProjectMediaEntries = (value: unknown): AdsflowProjectMediaEntryPayload[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is AdsflowProjectMediaEntryPayload => Boolean(item && typeof item === "object"));
};

const pickProjectMediaEntries = (...candidates: unknown[]) => {
  for (const candidate of candidates) {
    const entries = normalizeProjectMediaEntries(candidate);
    if (entries.length > 0) {
      return entries;
    }
  }

  return [] as AdsflowProjectMediaEntryPayload[];
};

const detectWorkspaceSegmentSourceKind = (
  entry?: AdsflowProjectMediaEntryPayload | null,
): WorkspaceSegmentEditorSourceKind => {
  const source = normalizeText(entry?.source_kind || entry?.source).toLowerCase();
  const renderedAnimationMode = normalizeText(entry?.rendered_animation_mode).toLowerCase();
  const renderedViaI2v =
    entry?.rendered_via_i2v === true ||
    entry?.rendered_via_i2v === 1 ||
    normalizeText(entry?.rendered_via_i2v).toLowerCase() === "true";
  if (source === "ai_generated" || source === "ai" || source === "generated") {
    return "ai_generated";
  }

  if (
    source === "pexels" ||
    source === "pixabay" ||
    source === "stock" ||
    source === "stock_photo" ||
    source === "stock_video" ||
    source === "unsplash"
  ) {
    return "stock";
  }

  if (
    source.includes("upload") ||
    source.includes("telegram") ||
    source.includes("user") ||
    source.includes("library")
  ) {
    return "upload";
  }

  const identifier = normalizeText(entry?.id).toLowerCase();
  const localPath = normalizeText(entry?.local_path).toLowerCase();
  const storageKey = normalizeText(entry?.storage_key).toLowerCase();
  const joinedUrls = [entry?.url, entry?.download_url, entry?.preview].map((value) => normalizeText(value).toLowerCase()).join(" ");

  if (
    identifier.startsWith("aiimg_") ||
    renderedViaI2v ||
    renderedAnimationMode === "i2v" ||
    localPath.includes("wavespeed") ||
    localPath.includes("deapi") ||
    storageKey.includes("wavespeed") ||
    storageKey.includes("deapi")
  ) {
    return "ai_generated";
  }

  if (joinedUrls.includes("pexels.com") || joinedUrls.includes("pixabay.com") || joinedUrls.includes("unsplash.com")) {
    return "stock";
  }

  return "unknown";
};

const getProjectMediaEntryPreviewUrl = (entry?: AdsflowProjectMediaEntryPayload | null) =>
  getProjectMediaEntryRenderableUrl(entry, entry?.preview, entry?.download_url, entry?.url);

const getProjectMediaEntryPlaybackUrl = (entry?: AdsflowProjectMediaEntryPayload | null) =>
  pickWorkspaceRenderableMediaUrl(entry?.download_url, entry?.url, entry?.preview);

const getProjectOriginalMediaEntries = (payload: AdsflowProjectDetailsResponse | null | undefined) =>
  pickProjectMediaEntries(
    payload?.source_video_urls,
    payload?.generation_settings?.source_video_urls,
    payload?.generation_settings?.original_videos,
  );

const getProjectCurrentMediaEntries = (
  payload: AdsflowProjectDetailsResponse | null | undefined,
  originalEntries: AdsflowProjectMediaEntryPayload[],
) =>
  pickProjectMediaEntries(
    payload?.generation_settings?.current_rendered_segments,
    payload?.video_urls,
    payload?.background_urls,
    payload?.generation_settings?.video_urls,
    payload?.generation_settings?.background_urls,
    originalEntries,
  );

const getProjectSegmentMarker = (
  entry: AdsflowProjectMediaEntryPayload | null | undefined,
  fallback: string,
) =>
  normalizeText(entry?.download_url) ||
  normalizeText(entry?.url) ||
  normalizeText(entry?.storage_key) ||
  normalizeText(getProjectMediaEntryAssetId(entry)) ||
  fallback;

const pickProjectDetailSegments = (
  settings: AdsflowProjectGenerationSettingsPayload | null | undefined,
) => {
  const candidates = [settings?.original_video_segments, settings?.video_segments];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate;
    }
  }

  return [] as AdsflowSegmentEditorSegmentPayload[];
};

const buildSegmentEditorPayloadFromProjectDetails = (
  requestedProjectId: number,
  payload: AdsflowProjectDetailsResponse | null | undefined,
): AdsflowSegmentEditorResponse | null => {
  if (!payload) {
    return null;
  }

  const settings = payload.generation_settings ?? {};
  const rawSegments = pickProjectDetailSegments(settings);
  if (rawSegments.length === 0) {
    return null;
  }

  const originalEntries = getProjectOriginalMediaEntries(payload);
  const currentEntries = getProjectCurrentMediaEntries(payload, originalEntries);
  const projectId =
    normalizePositiveProjectId(payload.project_id) ??
    normalizePositiveProjectId(payload.id) ??
    requestedProjectId;
  const segments = rawSegments
    .map((segment, slot): AdsflowSegmentEditorSegmentPayload | null => {
      if (!segment || typeof segment !== "object") {
        return null;
      }

      const record = segment as Record<string, unknown>;
      const index = normalizeInteger(record.segment_index) ?? normalizeInteger(record.index) ?? slot;
      const currentEntry = currentEntries[slot] ?? currentEntries[index] ?? null;
      const originalEntry = originalEntries[slot] ?? originalEntries[index] ?? currentEntry;
      const startTime = normalizeNumber(record.start_time);
      const endTime = normalizeNumber(record.end_time);
      const duration =
        normalizeNumber(record.duration) ??
        (startTime !== null && endTime !== null ? Math.max(0, endTime - startTime) : null);
      const text = normalizeText(record.text);
      const sceneSound = buildWorkspaceSegmentSceneSoundRef(
        typeof record.scene_sound === "object" ? record.scene_sound as WorkspaceSegmentSceneSoundRef : null,
      );
      const sceneSoundAssetId =
        normalizePositiveProjectId(record.scene_sound_asset_id) ??
        normalizePositiveProjectId(record.sceneSoundAssetId) ??
        sceneSound?.media_asset_id ??
        null;
      const voiceover = buildWorkspaceSegmentSceneSoundRef(
        typeof record.voiceover === "object" ? record.voiceover as WorkspaceSegmentVoiceoverRef : null,
      );
      const voiceoverAssetId =
        normalizePositiveProjectId(record.voiceover_asset_id) ??
        normalizePositiveProjectId(record.voiceoverAssetId) ??
        voiceover?.media_asset_id ??
        null;

      if (!text && duration === null && !currentEntry && !originalEntry) {
        return null;
      }

      return {
        current_video: getProjectSegmentMarker(currentEntry, `project:${projectId}:segment:${index}:current`),
        duration,
        duration_mode: normalizeText(record.duration_mode),
        end_time: endTime,
        index,
        manual_duration_seconds: normalizeNumber(record.manual_duration_seconds),
        media_type: normalizeMediaType(currentEntry?.media_type ?? originalEntry?.media_type ?? record.media_type),
        original_video: getProjectSegmentMarker(originalEntry, `project:${projectId}:segment:${index}:original`),
        scene_sound: sceneSound,
        scene_sound_asset_id: sceneSoundAssetId,
        speech_duration: normalizeNumber(record.speech_duration),
        speech_end_time: normalizeNumber(record.speech_end_time),
        speech_start_time: normalizeNumber(record.speech_start_time),
        speech_words: Array.isArray(record.speech_words) ? record.speech_words as AdsflowSegmentEditorSpeechWordPayload[] : null,
        start_time: startTime,
        subtitle_color: normalizeText(record.subtitle_color),
        subtitle_style: normalizeText(record.subtitle_style),
        subtitle_type: normalizeText(record.subtitle_type),
        text,
        voiceover,
        voiceover_asset_id: voiceoverAssetId,
        voiceover_language: normalizeText(record.voiceover_language ?? record.voiceoverLanguage),
        voiceover_text_hash: normalizeText(record.voiceover_text_hash ?? record.voiceoverTextHash),
        voiceover_voice_type: normalizeText(record.voiceover_voice_type ?? record.voiceoverVoiceType),
        voice_type: normalizeText(record.voice_type),
      } satisfies AdsflowSegmentEditorSegmentPayload;
    })
    .filter((segment): segment is AdsflowSegmentEditorSegmentPayload => Boolean(segment));

  if (segments.length === 0) {
    return null;
  }

  return {
    description: normalizeText(settings.original_ai_description) || normalizeText(payload.description),
    language: normalizeWorkspaceSegmentEditorLanguage(settings.content_language) ||
      normalizeWorkspaceSegmentEditorLanguage(settings.requested_language) ||
      normalizeWorkspaceSegmentEditorLanguage(payload.content_language),
    music_asset_id:
      normalizePositiveProjectId(settings.music_asset_id) ??
      normalizePositiveProjectId(settings.custom_music_asset_id) ??
      normalizePositiveProjectId(payload.music_asset_id),
    music_name: normalizeText(payload.music_name),
    music_type: normalizeText(payload.music_type) || normalizeText(settings.music_type),
    project_id: projectId,
    segments,
    subtitle_color: normalizeText(payload.subtitle_color) || normalizeText(settings.subtitle_color),
    subtitle_style: normalizeText(payload.subtitle_style) || normalizeText(settings.subtitle_style),
    subtitle_type: normalizeText(payload.subtitle_type) || normalizeText(settings.subtitle_type),
    title:
      normalizeText(settings.project_title) ||
      normalizeText(settings.original_ai_title) ||
      normalizeText(payload.ai_title) ||
      normalizeText(payload.description) ||
      `Проект #${projectId}`,
    tts_asset_id: normalizePositiveProjectId(settings.tts_asset_id) ?? normalizePositiveProjectId(payload.tts_asset_id),
    voice_type: normalizeText(payload.voice_type) || normalizeText(settings.voice_type),
  };
};

const buildProjectMediaAssetIndex = (assets: WorkspaceMediaAssetRef[]) =>
  new Map(
    assets
      .filter((asset): asset is WorkspaceMediaAssetRef & { assetId: number } => typeof asset.assetId === "number" && asset.assetId > 0)
      .map((asset) => [asset.assetId, asset] as const),
  );

const buildSegmentMediaAssetFromEntry = (
  entry: AdsflowProjectMediaEntryPayload | null | undefined,
  projectMediaByAssetId: Map<number, WorkspaceMediaAssetRef>,
  options?: {
    projectMediaLoaded?: boolean;
    projectId?: number | null;
    role?: string | null;
    segmentIndex?: number | null;
  },
) => {
  const assetId = getProjectMediaEntryAssetId(entry);
  const linkedAsset = assetId !== null ? projectMediaByAssetId.get(assetId) ?? null : null;
  const hasMissingProjectAssetReference =
    assetId !== null &&
    !linkedAsset &&
    Boolean(options?.projectMediaLoaded);
  const entryKind = normalizeText(entry?.kind || entry?.asset_kind) || options?.role || null;
  const entryRole = normalizeText(entry?.role || entry?.link_role) || options?.role || entryKind;
  const entryAsset = buildWorkspaceMediaAssetRef({
    download_path: entry?.download_url ?? entry?.url ?? null,
    download_url: entry?.download_url ?? null,
    id: assetId,
    kind: entryKind,
    media_type: entry?.media_type ?? null,
    mime_type: entry?.mime_type ?? null,
    original_url: entry?.url ?? null,
    project_id: options?.projectId ?? null,
    role: entryRole,
    segment_index: options?.segmentIndex ?? null,
    source_kind: detectWorkspaceSegmentSourceKind(entry),
    status: linkedAsset?.status ?? (hasMissingProjectAssetReference ? "deleted" : null),
    storage_key: entry?.storage_key ?? null,
  });

  return mergeWorkspaceMediaAssetRefs(linkedAsset, entryAsset);
};

const isWorkspacePhotoMediaAssetRef = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  const mediaType = normalizeText(asset?.mediaType).toLowerCase();
  const mimeType = normalizeText(asset?.mimeType).toLowerCase();
  return mediaType === "photo" || mediaType === "image" || mimeType.startsWith("image/");
};

const isWorkspaceVideoMediaAssetRef = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  const mediaType = normalizeText(asset?.mediaType).toLowerCase();
  const mimeType = normalizeText(asset?.mimeType).toLowerCase();
  return mediaType === "video" || mimeType.startsWith("video/");
};

const isProjectMediaEntryPhoto = (entry: AdsflowProjectMediaEntryPayload | null | undefined) => {
  const mediaType = normalizeText(entry?.media_type).toLowerCase();
  const mimeType = normalizeText(entry?.mime_type).toLowerCase();
  return mediaType === "photo" || mediaType === "image" || mimeType.startsWith("image/");
};

const isProjectMediaEntryVideo = (entry: AdsflowProjectMediaEntryPayload | null | undefined) => {
  const mediaType = normalizeText(entry?.media_type).toLowerCase();
  const mimeType = normalizeText(entry?.mime_type).toLowerCase();
  return mediaType === "video" || mimeType.startsWith("video/");
};

const resolveWorkspaceSegmentMediaType = (options: {
  currentAsset: WorkspaceMediaAssetRef | null;
  currentEntry: AdsflowProjectMediaEntryPayload | null;
  originalAsset: WorkspaceMediaAssetRef | null;
  originalEntry: AdsflowProjectMediaEntryPayload | null;
  payloadMediaType: unknown;
}): WorkspaceSegmentEditorMediaType => {
  const payloadMediaType = normalizeMediaType(options.payloadMediaType);
  if (payloadMediaType === "photo") {
    return "photo";
  }

  if (
    isWorkspaceVideoMediaAssetRef(options.currentAsset) ||
    isWorkspaceVideoMediaAssetRef(options.originalAsset) ||
    isProjectMediaEntryVideo(options.currentEntry) ||
    isProjectMediaEntryVideo(options.originalEntry)
  ) {
    return "video";
  }

  if (
    isWorkspacePhotoMediaAssetRef(options.currentAsset) ||
    isWorkspacePhotoMediaAssetRef(options.originalAsset) ||
    isProjectMediaEntryPhoto(options.currentEntry) ||
    isProjectMediaEntryPhoto(options.originalEntry)
  ) {
    return "photo";
  }

  return payloadMediaType;
};

const normalizeSpeechWords = (value: unknown): WorkspaceSegmentEditorSpeechWord[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as AdsflowSegmentEditorSpeechWordPayload;
      const text = normalizeText(record.text);
      const startTime = normalizeNumber(record.start_time);
      const endTime = normalizeNumber(record.end_time);
      const confidence = normalizeNumber(record.confidence);

      if (!text || startTime === null || endTime === null || endTime <= startTime) {
        return null;
      }

      return {
        confidence: confidence !== null ? Math.max(0, confidence) : 0,
        endTime: Math.max(startTime, endTime),
        startTime: Math.max(0, startTime),
        text,
      };
    })
    .filter((item): item is WorkspaceSegmentEditorSpeechWord => Boolean(item));
};

const PROJECT_ACCESS_CACHE_TTL_MS = 5 * 60_000;
const SEGMENT_EDITOR_SESSION_CACHE_TTL_MS = 10 * 60_000;
const PROJECT_ACCESS_FALLBACK_TIMEOUT_MS = 8_000;
const SEGMENT_EDITOR_OPTIONAL_CONTEXT_TIMEOUT_MS = 2_500;
const SEGMENT_EDITOR_FALLBACK_CONTEXT_TIMEOUT_MS = 4_000;
const PROJECT_ACCESS_TIMEOUT_ERROR_MESSAGE = "Список проектов загружается слишком долго. Попробуйте ещё раз.";
const SEGMENT_EDITOR_TIMEOUT_ERROR_MESSAGE = "Сегменты загружаются слишком долго. Попробуйте ещё раз.";
const SEGMENT_EDITOR_PREPARING_ERROR_MESSAGE = "Project components are still being prepared";
const WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS = 1;
const WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS = 8;
const projectAccessCache = new Map<string, number>();
const segmentEditorSessionCache = new Map<string, { expiresAt: number; session: WorkspaceSegmentEditorSession }>();
const segmentEditorSessionInFlight = new Map<string, Promise<WorkspaceSegmentEditorSession>>();

const getProjectAccessCacheKey = (user: SegmentEditorUser, projectId: number) => {
  const userId = normalizeText(user.id);
  if (userId) {
    return `user:${userId}:project:${projectId}`;
  }

  const email = normalizeText(user.email).toLowerCase();
  return email ? `email:${email}:project:${projectId}` : null;
};

const hasCachedProjectAccess = (user: SegmentEditorUser, projectId: number) => {
  const cacheKey = getProjectAccessCacheKey(user, projectId);
  if (!cacheKey) {
    return false;
  }

  const expiresAt = projectAccessCache.get(cacheKey);
  if (!expiresAt) {
    return false;
  }

  if (expiresAt <= Date.now()) {
    projectAccessCache.delete(cacheKey);
    return false;
  }

  return true;
};

const cacheProjectAccess = (user: SegmentEditorUser, projectId: number) => {
  const cacheKey = getProjectAccessCacheKey(user, projectId);
  if (!cacheKey) {
    return;
  }

  projectAccessCache.set(cacheKey, Date.now() + PROJECT_ACCESS_CACHE_TTL_MS);
};

const clearCachedProjectAccess = (user: SegmentEditorUser, projectId?: number) => {
  const exactCacheKey =
    typeof projectId === "number" && Number.isFinite(projectId) && projectId > 0
      ? getProjectAccessCacheKey(user, projectId)
      : null;

  if (exactCacheKey) {
    projectAccessCache.delete(exactCacheKey);
    return;
  }

  const userId = normalizeText(user.id);
  const email = normalizeText(user.email).toLowerCase();
  const cachePrefix = userId ? `user:${userId}:project:` : email ? `email:${email}:project:` : null;

  if (!cachePrefix) {
    return;
  }

  for (const key of projectAccessCache.keys()) {
    if (key.startsWith(cachePrefix)) {
      projectAccessCache.delete(key);
    }
  }
};

const getSegmentEditorSessionCacheKey = (user: SegmentEditorUser, projectId: number) => {
  const userId = normalizeText(user.id);
  if (userId) {
    return `user:${userId}:segment-editor:${projectId}`;
  }

  const email = normalizeText(user.email).toLowerCase();
  return email ? `email:${email}:segment-editor:${projectId}` : null;
};

const getCachedSegmentEditorSession = (user: SegmentEditorUser, projectId: number) => {
  const cacheKey = getSegmentEditorSessionCacheKey(user, projectId);
  if (!cacheKey) {
    return null;
  }

  const cachedEntry = segmentEditorSessionCache.get(cacheKey);
  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    segmentEditorSessionCache.delete(cacheKey);
    return null;
  }

  if (cachedEntry.session.projectId !== projectId) {
    console.warn("[segment-editor] Dropping cached session with mismatched project id", {
      cachedProjectId: cachedEntry.session.projectId,
      requestedProjectId: projectId,
    });
    segmentEditorSessionCache.delete(cacheKey);
    return null;
  }

  return cachedEntry.session;
};

const setCachedSegmentEditorSession = (
  user: SegmentEditorUser,
  projectId: number,
  session: WorkspaceSegmentEditorSession,
) => {
  const cacheKey = getSegmentEditorSessionCacheKey(user, projectId);
  if (!cacheKey) {
    return;
  }

  if (session.projectId !== projectId) {
    console.warn("[segment-editor] Refusing to cache session with mismatched project id", {
      requestedProjectId: projectId,
      sessionProjectId: session.projectId,
    });
    return;
  }

  segmentEditorSessionCache.set(cacheKey, {
    expiresAt: Date.now() + SEGMENT_EDITOR_SESSION_CACHE_TTL_MS,
    session,
  });
};

export const invalidateWorkspaceSegmentEditorSessionCache = (user: SegmentEditorUser, projectId?: number) => {
  clearCachedProjectAccess(user, projectId);

  const exactCacheKey =
    typeof projectId === "number" && Number.isFinite(projectId) && projectId > 0
      ? getSegmentEditorSessionCacheKey(user, projectId)
      : null;

  if (exactCacheKey) {
    segmentEditorSessionCache.delete(exactCacheKey);
    segmentEditorSessionInFlight.delete(exactCacheKey);
    return;
  }

  const userId = normalizeText(user.id);
  const email = normalizeText(user.email).toLowerCase();
  const cachePrefix = userId ? `user:${userId}:segment-editor:` : email ? `email:${email}:segment-editor:` : null;

  if (!cachePrefix) {
    return;
  }

  for (const key of segmentEditorSessionCache.keys()) {
    if (key.startsWith(cachePrefix)) {
      segmentEditorSessionCache.delete(key);
    }
  }

  for (const key of segmentEditorSessionInFlight.keys()) {
    if (key.startsWith(cachePrefix)) {
      segmentEditorSessionInFlight.delete(key);
    }
  }
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const createEmptyProjectMediaEnvelope = (projectId: number): ProjectMediaEnvelope => ({
  assets: [],
  loaded: false,
  projectId,
});

const withOptionalSegmentEditorContextTimeout = async <T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs: number,
  options: {
    label: string;
    projectId: number;
  },
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn("[segment-editor] Optional context timed out; continuing without it", {
        label: options.label,
        projectId: options.projectId,
        timeoutMs,
      });
      resolve(fallback);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const resolveOptionalSegmentEditorContext = async (
  projectId: number,
  projectDetailsPromise: Promise<AdsflowProjectDetailsResponse | null>,
  projectMediaPromise: Promise<ProjectMediaEnvelope>,
  timeoutMs: number,
) => {
  const [projectDetailsPayload, projectMediaEnvelope] = await Promise.all([
    withOptionalSegmentEditorContextTimeout(projectDetailsPromise, null, timeoutMs, {
      label: "project-details",
      projectId,
    }),
    withOptionalSegmentEditorContextTimeout(projectMediaPromise, createEmptyProjectMediaEnvelope(projectId), timeoutMs, {
      label: "project-media",
      projectId,
    }),
  ]);

  return {
    projectDetailsPayload,
    projectMediaEnvelope,
  };
};

const assertWorkspaceProjectAccess = async (user: SegmentEditorUser, projectId: number) => {
  const deletedProjects = await listWorkspaceDeletedProjects(user).catch(() => []);
  if (deletedProjects.some((entry) => entry.adId === projectId || entry.projectId === `project:${projectId}`)) {
    throw new WorkspaceSegmentEditorError("Проект удалён и недоступен для редактирования.", 404);
  }

  if (hasCachedProjectAccess(user, projectId)) {
    return;
  }

  const historyEntries = await listWorkspaceGenerationHistory(user, 120).catch(() => []);
  if (historyEntries.some((entry) => entry.adId === projectId)) {
    cacheProjectAccess(user, projectId);
    return;
  }

  let projects: Awaited<ReturnType<typeof getWorkspaceProjects>>;
  try {
    projects = await withTimeout(
      getWorkspaceProjects(user),
      PROJECT_ACCESS_FALLBACK_TIMEOUT_MS,
      PROJECT_ACCESS_TIMEOUT_ERROR_MESSAGE,
    );
  } catch (error) {
    if (error instanceof Error && error.message === PROJECT_ACCESS_TIMEOUT_ERROR_MESSAGE) {
      throw new WorkspaceSegmentEditorError(error.message, 504);
    }

    throw error;
  }
  const project = projects.find((item) => item.adId === projectId) ?? null;

  if (!project) {
    throw new WorkspaceSegmentEditorError("Проект не найден или недоступен для редактирования.", 404);
  }

  cacheProjectAccess(user, projectId);

  return project;
};

const buildWorkspaceSegmentEditorVideoUrl = (
  projectId: number,
  segmentIndex: number,
  source: WorkspaceSegmentEditorVideoSource,
  delivery: WorkspaceSegmentEditorVideoDelivery,
  marker?: string,
) => {
  const previewUrl = new URL("/api/workspace/project-segment-video", env.appUrl);
  previewUrl.searchParams.set("projectId", String(projectId));
  previewUrl.searchParams.set("segmentIndex", String(segmentIndex));
  previewUrl.searchParams.set("source", source);
  previewUrl.searchParams.set("delivery", delivery);
  if (marker) {
    previewUrl.searchParams.set("v", marker);
  }
  return `${previewUrl.pathname}${previewUrl.search}`;
};

const buildWorkspaceSegmentEditorPosterUrl = (
  projectId: number,
  segmentIndex: number,
  source: WorkspaceSegmentEditorVideoSource,
  marker?: string,
) => {
  const posterUrl = new URL("/api/workspace/project-segment-poster", env.appUrl);
  posterUrl.searchParams.set("projectId", String(projectId));
  posterUrl.searchParams.set("segmentIndex", String(segmentIndex));
  posterUrl.searchParams.set("source", source);
  if (marker) {
    posterUrl.searchParams.set("v", marker);
  }
  return `${posterUrl.pathname}${posterUrl.search}`;
};

const buildWorkspaceMediaAssetPosterUrl = (asset: WorkspaceMediaAssetRef | null | undefined) => {
  const assetId = normalizeInteger(asset?.assetId);
  if (assetId === null || assetId <= 0 || !isWorkspaceVideoMediaAssetRef(asset)) {
    return null;
  }

  const posterUrl = new URL(`/api/workspace/media-assets/${assetId}/poster`, env.appUrl);
  const version = [
    asset?.createdAt,
    asset?.expiresAt,
    asset?.storageKey,
    asset?.mimeType,
    asset?.downloadPath,
    asset?.downloadUrl,
    asset?.playbackUrl,
    asset?.originalUrl,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(":");

  if (version) {
    posterUrl.searchParams.set("v", version);
  }

  return `${posterUrl.pathname}${posterUrl.search}`;
};

const isWorkspaceSegmentTimelineFallbackEntry = (entry: AdsflowProjectMediaEntryPayload | null | undefined) => {
  const source = normalizeText(entry?.source).toLowerCase();
  const sourceKind = normalizeText(entry?.source_kind).toLowerCase();
  const role = normalizeText(entry?.role || entry?.link_role || entry?.kind || entry?.asset_kind).toLowerCase();

  return (
    source === "final_video" ||
    source === "project_background" ||
    source === "combined_background" ||
    sourceKind === "final_video" ||
    role === "final_video" ||
    role === "combined_background"
  );
};

const buildWorkspaceSegmentPosterUrl = (
  projectId: number,
  segmentIndex: number,
  source: WorkspaceSegmentEditorVideoSource,
  asset: WorkspaceMediaAssetRef | null | undefined,
  entry: AdsflowProjectMediaEntryPayload | null | undefined,
  marker?: string,
) => {
  if (isWorkspaceSegmentTimelineFallbackEntry(entry)) {
    return buildWorkspaceSegmentEditorPosterUrl(projectId, segmentIndex, source, marker);
  }

  return buildWorkspaceMediaAssetPosterUrl(asset);
};

export const buildWorkspaceSegmentEditorSessionFromPayload = (
  requestedProjectId: number,
  payload: AdsflowSegmentEditorResponse,
  options: WorkspaceSegmentEditorSessionBuildOptions = {},
): WorkspaceSegmentEditorSession => {
  const sessionProjectId = normalizePositiveProjectId(requestedProjectId) ?? requestedProjectId;
  const upstreamProjectId = normalizePositiveProjectId(payload.project_id);

  if (upstreamProjectId !== null && upstreamProjectId !== sessionProjectId) {
    console.warn("[segment-editor] Upstream returned a different project_id for segment editor; using requested project id", {
      requestedProjectId: sessionProjectId,
      upstreamProjectId,
    });
  }

  const projectDetailsPayload = options.projectDetailsPayload ?? null;
  const projectMediaEnvelope = options.projectMediaEnvelope ?? {
    assets: [],
    loaded: false,
    projectId: sessionProjectId,
  };
  const originalEntries = getProjectOriginalMediaEntries(projectDetailsPayload);
  const currentEntries = getProjectCurrentMediaEntries(projectDetailsPayload, originalEntries);
  const projectMediaByAssetId = buildProjectMediaAssetIndex(projectMediaEnvelope.assets);
  const segments = (payload.segments ?? [])
    .map((segment) =>
      buildWorkspaceSegmentEditorSegment(sessionProjectId, segment, {
        currentEntries,
        projectMediaAssets: projectMediaEnvelope.assets,
        projectMediaLoaded: projectMediaEnvelope.loaded,
        projectMediaByAssetId,
        originalEntries,
      }),
    )
    .filter((segment): segment is WorkspaceSegmentEditorSegment => Boolean(segment))
    .sort((left, right) => left.index - right.index);

  if (segments.length < WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS) {
    throw new WorkspaceSegmentEditorError("Для этого проекта пока нет данных сегментов.", 409);
  }

  if (segments.length > WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS) {
    throw new WorkspaceSegmentEditorError(
      `Редактор сегментов пока поддерживает проекты до ${WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS} сегментов.`,
      409,
    );
  }

  const customMusicMetadata = resolveWorkspaceSegmentEditorCustomMusicMetadata(projectDetailsPayload);
  const generationSettings =
    projectDetailsPayload?.generation_settings && typeof projectDetailsPayload.generation_settings === "object"
      ? projectDetailsPayload.generation_settings
      : null;
  const musicAssetId =
    normalizePositiveProjectId(payload.music_asset_id) ??
    normalizePositiveProjectId(projectDetailsPayload?.music_asset_id) ??
    normalizePositiveProjectId(generationSettings?.music_asset_id) ??
    normalizePositiveProjectId(generationSettings?.custom_music_asset_id) ??
    null;
  const musicType =
    normalizeText(payload.music_type) ||
    normalizeText(projectDetailsPayload?.music_type) ||
    normalizeText(generationSettings?.music_type) ||
    (customMusicMetadata.customMusicAssetId ? "custom" : musicAssetId ? "ai" : "");
  const ttsAssetId =
    normalizePositiveProjectId(payload.tts_asset_id) ??
    normalizePositiveProjectId(projectDetailsPayload?.tts_asset_id) ??
    normalizePositiveProjectId(generationSettings?.tts_asset_id) ??
    null;

  return {
    customMusicAssetId: customMusicMetadata.customMusicAssetId,
    customMusicFileName: customMusicMetadata.customMusicFileName,
    description: normalizeText(payload.description),
    language: resolveWorkspaceSegmentEditorLanguage(payload, projectDetailsPayload),
    musicAssetId,
    musicName:
      normalizeText(payload.music_name) ||
      normalizeText(projectDetailsPayload?.music_name) ||
      normalizeText(generationSettings?.custom_music_original_name),
    musicType,
    projectId: sessionProjectId,
    segments,
    subtitleColor: normalizeText(payload.subtitle_color),
    subtitleStyle: normalizeText(payload.subtitle_style),
    subtitleType: normalizeText(payload.subtitle_type),
    title: normalizeText(payload.title) || `Проект #${sessionProjectId}`,
    ttsAssetId,
    voiceType: normalizeText(payload.voice_type),
  };
};

export const buildWorkspaceSegmentEditorSegment = (
  projectId: number,
  payload: AdsflowSegmentEditorSegmentPayload,
  projectSources?: {
    currentEntries: AdsflowProjectMediaEntryPayload[];
    projectMediaAssets?: WorkspaceMediaAssetRef[];
    projectMediaLoaded?: boolean;
    projectMediaByAssetId: Map<number, WorkspaceMediaAssetRef>;
    originalEntries: AdsflowProjectMediaEntryPayload[];
  },
): WorkspaceSegmentEditorSegment | null => {
  const index = normalizeInteger(payload.index);
  if (index === null) {
    return null;
  }

  const startTime = normalizeNumber(payload.start_time) ?? 0;
  const endTime = normalizeNumber(payload.end_time) ?? Math.max(startTime, startTime + (normalizeNumber(payload.duration) ?? 0));
  const duration = normalizeNumber(payload.duration) ?? Math.max(0, endTime - startTime);
  const durationMode = normalizeSegmentDurationMode(payload.duration_mode);
  const manualDurationSeconds =
    normalizeManualDurationSeconds(payload.manual_duration_seconds) ??
    (durationMode === "manual" ? normalizeManualDurationSeconds(duration) : null);
  const speechStartTime = normalizeNumber(payload.speech_start_time);
  const speechEndTime = normalizeNumber(payload.speech_end_time);
  const speechDuration =
    normalizeNumber(payload.speech_duration) ??
    (speechStartTime !== null && speechEndTime !== null ? Math.max(0, speechEndTime - speechStartTime) : null);
  const speechWords = normalizeSpeechWords(payload.speech_words);
  const currentVideoMarker = normalizeText(payload.current_video);
  const originalVideoMarker = normalizeText(payload.original_video);
  const hasCurrentVideo = Boolean(currentVideoMarker);
  const hasOriginalVideo = Boolean(originalVideoMarker);
  const currentEntry = projectSources?.currentEntries[index] ?? null;
  const explicitOriginalEntry = projectSources?.originalEntries[index] ?? null;
  const originalEntry =
    explicitOriginalEntry ??
    (!hasOriginalVideo && currentEntry && detectWorkspaceSegmentSourceKind(currentEntry) !== "upload" ? currentEntry : null);
  const projectMediaByAssetId = projectSources?.projectMediaByAssetId ?? new Map();
  const projectMediaAssets = projectSources?.projectMediaAssets ?? [];
  const projectMediaLoaded = Boolean(projectSources?.projectMediaLoaded);
  const currentAsset = buildSegmentMediaAssetFromEntry(currentEntry, projectMediaByAssetId, {
    projectId,
    projectMediaLoaded,
    role: "segment_current",
    segmentIndex: index,
  });
  const originalAsset = buildSegmentMediaAssetFromEntry(originalEntry, projectMediaByAssetId, {
    projectId,
    projectMediaLoaded,
    role: "segment_original",
    segmentIndex: index,
  });
  const resolvedMediaType = resolveWorkspaceSegmentMediaType({
    currentAsset,
    currentEntry,
    originalAsset,
    originalEntry,
    payloadMediaType: payload.media_type,
  });
  const explicitSceneSound = buildWorkspaceSegmentSceneSoundRef(payload.scene_sound);
  const projectSceneSoundEntry = findProjectSceneSoundMediaEntry(
    [
      ...(projectSources?.currentEntries ?? []),
      ...(projectSources?.originalEntries ?? []),
    ],
    index,
  );
  const projectSceneSoundAsset = findProjectSceneSoundMediaAsset(projectMediaAssets, index);
  const sceneSound =
    explicitSceneSound ??
    buildWorkspaceSegmentSceneSoundRef(projectSceneSoundEntry) ??
    buildWorkspaceSegmentSceneSoundRefFromAsset(projectSceneSoundAsset);
  const sceneSoundAssetId =
    normalizePositiveProjectId(payload.scene_sound_asset_id) ??
    sceneSound?.media_asset_id ??
    normalizePositiveProjectId(projectSceneSoundAsset?.assetId) ??
    null;
  const explicitVoiceover = buildWorkspaceSegmentSceneSoundRef(payload.voiceover);
  const projectVoiceoverEntry = findProjectVoiceoverMediaEntry(
    [
      ...(projectSources?.currentEntries ?? []),
      ...(projectSources?.originalEntries ?? []),
    ],
    index,
  );
  const projectVoiceoverAsset = findProjectVoiceoverMediaAsset(projectMediaAssets, index);
  const voiceover =
    explicitVoiceover ??
    buildWorkspaceSegmentSceneSoundRef(projectVoiceoverEntry) ??
    buildWorkspaceSegmentSceneSoundRefFromAsset(projectVoiceoverAsset);
  const voiceoverAssetId =
    normalizePositiveProjectId(payload.voiceover_asset_id) ??
    voiceover?.media_asset_id ??
    normalizePositiveProjectId(projectVoiceoverAsset?.assetId) ??
    null;

  return {
    currentAsset,
    currentExternalPlaybackUrl: getProjectMediaEntryPlaybackUrl(currentEntry),
    currentExternalPreviewUrl: getProjectMediaEntryPreviewUrl(currentEntry),
    currentPlaybackUrl: hasCurrentVideo
      ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "current", "playback", currentVideoMarker)
      : null,
    currentPosterUrl: buildWorkspaceSegmentPosterUrl(projectId, index, "current", currentAsset, currentEntry, currentVideoMarker),
    currentPreviewUrl: hasCurrentVideo
      ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "current", "preview", currentVideoMarker)
      : null,
    currentSourceKind: detectWorkspaceSegmentSourceKind(currentEntry),
    duration: duration > 0 ? duration : Math.max(0, endTime - startTime),
    durationMode,
    endTime,
    index,
    manualDurationSeconds,
    mediaType: resolvedMediaType,
    originalAsset,
    originalExternalPlaybackUrl: getProjectMediaEntryPlaybackUrl(originalEntry),
    originalExternalPreviewUrl: getProjectMediaEntryPreviewUrl(originalEntry),
    originalPlaybackUrl: hasOriginalVideo
      ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "original", "playback", originalVideoMarker)
      : null,
    originalPosterUrl: buildWorkspaceSegmentPosterUrl(projectId, index, "original", originalAsset, originalEntry, originalVideoMarker),
    originalPreviewUrl: hasOriginalVideo
      ? buildWorkspaceSegmentEditorVideoUrl(projectId, index, "original", "preview", originalVideoMarker)
      : null,
    originalSourceKind: detectWorkspaceSegmentSourceKind(originalEntry),
    sceneSoundAssetId,
    scene_sound: sceneSound,
    scene_sound_asset_id: sceneSoundAssetId,
    speechDuration: speechDuration !== null ? Math.max(0, speechDuration) : null,
    speechEndTime:
      speechStartTime !== null && speechEndTime !== null ? Math.max(speechStartTime, speechEndTime) : null,
    speechStartTime: speechStartTime !== null ? Math.max(0, speechStartTime) : null,
    speechWords,
    startTime,
    subtitleColor: normalizeText(payload.subtitle_color) || null,
    subtitleStyle: normalizeText(payload.subtitle_style) || null,
    subtitleType: normalizeText(payload.subtitle_type) || null,
    text: normalizeText(payload.text),
    voiceover,
    voiceoverAssetId,
    voiceoverLanguage: normalizeText(payload.voiceover_language) || null,
    voiceoverTextHash: normalizeText(payload.voiceover_text_hash) || null,
    voiceoverVoiceType: normalizeText(payload.voiceover_voice_type) || null,
    voiceover_asset_id: voiceoverAssetId,
    voiceType: normalizeText(payload.voice_type) || null,
  };
};

const loadWorkspaceSegmentEditorSession = async (projectId: number): Promise<WorkspaceSegmentEditorSession> => {
  assertAdsflowConfigured();
  let payload: AdsflowSegmentEditorResponse | null = null;
  let projectDetailsPayload: AdsflowProjectDetailsResponse | null = null;
  let projectMediaEnvelope = createEmptyProjectMediaEnvelope(projectId);
  const projectDetailsPromise = fetchAdsflowJsonWithPolicy<AdsflowProjectDetailsResponse>({
    context: {
      endpoint: "segment-editor.project-details",
      projectId,
    },
    params: {
      admin_token: env.adsflowAdminToken ?? "",
    },
    path: `/api/projects/${projectId}`,
    policy: upstreamPolicies.adsflowMetadata,
  }).catch((error) => {
    console.warn(`[segment-editor] Failed to load source metadata for project ${projectId}`, error);
    return null;
  });
  const projectMediaPromise = fetchProjectMediaEnvelope(projectId).catch((error) => {
    console.warn(`[segment-editor] Failed to load durable media for project ${projectId}`, error);
    return createEmptyProjectMediaEnvelope(projectId);
  });

  try {
    payload = await fetchAdsflowJsonWithPolicy<AdsflowSegmentEditorResponse>({
      context: {
        endpoint: "segment-editor.session",
        projectId,
      },
      init: {
        headers: {
          "X-Admin-Token": env.adsflowAdminToken ?? "",
        },
      },
      path: `/api/projects/${projectId}/segment-editor`,
      policy: upstreamPolicies.adsflowMetadata,
    });

    const optionalContext = await resolveOptionalSegmentEditorContext(
      projectId,
      projectDetailsPromise,
      projectMediaPromise,
      SEGMENT_EDITOR_OPTIONAL_CONTEXT_TIMEOUT_MS,
    );
    projectDetailsPayload = optionalContext.projectDetailsPayload;
    projectMediaEnvelope = optionalContext.projectMediaEnvelope;
  } catch (error) {
    if (error instanceof UpstreamFetchError && error.isTimeout) {
      projectDetailsPayload = await withOptionalSegmentEditorContextTimeout(
        projectDetailsPromise,
        null,
        SEGMENT_EDITOR_FALLBACK_CONTEXT_TIMEOUT_MS,
        {
          label: "project-details-timeout-fallback",
          projectId,
        },
      );
      const fallbackPayload = buildSegmentEditorPayloadFromProjectDetails(projectId, projectDetailsPayload);
      if (fallbackPayload) {
        console.warn("[segment-editor] Using project details fallback after upstream timeout", {
          projectId,
          segmentCount: fallbackPayload.segments?.length ?? 0,
        });
        payload = fallbackPayload;
        projectMediaEnvelope = await withOptionalSegmentEditorContextTimeout(
          projectMediaPromise,
          createEmptyProjectMediaEnvelope(projectId),
          SEGMENT_EDITOR_OPTIONAL_CONTEXT_TIMEOUT_MS,
          {
            label: "project-media-timeout-fallback",
            projectId,
          },
        );
      } else {
        throw new WorkspaceSegmentEditorError(SEGMENT_EDITOR_TIMEOUT_ERROR_MESSAGE, 504);
      }
    }

    if (error instanceof UpstreamHttpError && error.statusCode === 404) {
      throw new WorkspaceSegmentEditorError("Для этого проекта сегменты пока недоступны.", 404);
    }

    if (error instanceof UpstreamHttpError && error.statusCode === 409) {
      projectDetailsPayload = await withOptionalSegmentEditorContextTimeout(
        projectDetailsPromise,
        null,
        SEGMENT_EDITOR_FALLBACK_CONTEXT_TIMEOUT_MS,
        {
          label: "project-details-preparing-fallback",
          projectId,
        },
      );
      const fallbackPayload = buildSegmentEditorPayloadFromProjectDetails(projectId, projectDetailsPayload);
      if (fallbackPayload) {
        console.warn("[segment-editor] Using project details fallback after upstream preparing response", {
          projectId,
          segmentCount: fallbackPayload.segments?.length ?? 0,
        });
        payload = fallbackPayload;
        projectMediaEnvelope = await withOptionalSegmentEditorContextTimeout(
          projectMediaPromise,
          createEmptyProjectMediaEnvelope(projectId),
          SEGMENT_EDITOR_OPTIONAL_CONTEXT_TIMEOUT_MS,
          {
            label: "project-media-preparing-fallback",
            projectId,
          },
        );
      } else {
        throw new WorkspaceSegmentEditorError(normalizeText(error.message) || SEGMENT_EDITOR_PREPARING_ERROR_MESSAGE, 409);
      }
    }

    const message = error instanceof Error ? error.message.trim().toLowerCase() : "";
    if (!payload && (message === "not found" || message.includes("404"))) {
      throw new WorkspaceSegmentEditorError("Для этого проекта сегменты пока недоступны.", 404);
    }

    if (!payload) {
      throw error;
    }
  }

  if (!payload) {
    throw new WorkspaceSegmentEditorError("Не удалось загрузить сегменты проекта.", 500);
  }

  return buildWorkspaceSegmentEditorSessionFromPayload(projectId, payload, {
    projectDetailsPayload,
    projectMediaEnvelope,
  });
};

const getWorkspaceSegmentEditorSessionInternal = async (
  user: SegmentEditorUser,
  projectId: number,
  options?: {
    bypassCache?: boolean;
    skipProjectAccessCheck?: boolean;
  },
): Promise<WorkspaceSegmentEditorSession> => {
  const shouldBypassCache = Boolean(options?.bypassCache);
  const cacheKey = getSegmentEditorSessionCacheKey(user, projectId);
  const shouldTrackInFlight = Boolean(cacheKey && !shouldBypassCache);

  if (!shouldBypassCache) {
    const cachedSession = getCachedSegmentEditorSession(user, projectId);
    if (cachedSession) {
      return cachedSession;
    }

    if (cacheKey) {
      const inFlightRequest = segmentEditorSessionInFlight.get(cacheKey);
      if (inFlightRequest) {
        return inFlightRequest;
      }
    }
  }

  const request = (async () => {
    if (!options?.skipProjectAccessCheck) {
      await assertWorkspaceProjectAccess(user, projectId);
    }

    return loadWorkspaceSegmentEditorSession(projectId);
  })();

  if (shouldTrackInFlight && cacheKey) {
    segmentEditorSessionInFlight.set(cacheKey, request);
  }

  try {
    const session = await request;
    setCachedSegmentEditorSession(user, projectId, session);
    return session;
  } finally {
    if (shouldTrackInFlight && cacheKey) {
      segmentEditorSessionInFlight.delete(cacheKey);
    }
  }
};

export async function getWorkspaceSegmentEditorSession(
  user: SegmentEditorUser,
  projectId: number,
  options?: {
    bypassCache?: boolean;
  },
): Promise<WorkspaceSegmentEditorSession> {
  return getWorkspaceSegmentEditorSessionInternal(user, projectId, {
    bypassCache: options?.bypassCache,
  });
}

export async function getWorkspaceSegmentEditorSessionForAccessibleProject(
  user: SegmentEditorUser,
  projectId: number,
  options?: {
    bypassCache?: boolean;
  },
): Promise<WorkspaceSegmentEditorSession> {
  return getWorkspaceSegmentEditorSessionInternal(user, projectId, {
    bypassCache: options?.bypassCache,
    skipProjectAccessCheck: true,
  });
}

export async function getWorkspaceProjectSegmentVideoProxyTarget(
  user: SegmentEditorUser,
  options: {
    delivery: WorkspaceSegmentEditorVideoDelivery;
    projectId: number;
    segmentIndex: number;
    source: WorkspaceSegmentEditorVideoSource;
  },
) {
  assertAdsflowConfigured();
  await assertWorkspaceProjectAccess(user, options.projectId);

  return {
    headers: {
      "X-Admin-Token": env.adsflowAdminToken ?? "",
    },
    url: buildAdsflowUrl(`/api/projects/${options.projectId}/segments/${options.segmentIndex}/video`, {
      delivery: options.delivery,
      source: options.source,
    }),
  };
}

export async function getWorkspaceProjectMusicAudioProxyTarget(
  user: SegmentEditorUser,
  options: {
    projectId: number;
  },
) {
  assertAdsflowConfigured();
  await assertWorkspaceProjectAccess(user, options.projectId);

  return {
    headers: {
      "X-Admin-Token": env.adsflowAdminToken ?? "",
    },
    url: buildAdsflowUrl(`/api/projects/${options.projectId}/audio/music`),
  };
}

export async function getWorkspaceProjectSegmentVoiceoverProxyTarget(
  user: SegmentEditorUser,
  options: {
    projectId: number;
    segmentIndex: number;
  },
) {
  assertAdsflowConfigured();
  await assertWorkspaceProjectAccess(user, options.projectId);

  return {
    headers: {
      "X-Admin-Token": env.adsflowAdminToken ?? "",
    },
    url: buildAdsflowUrl(`/api/projects/${options.projectId}/segments/${options.segmentIndex}/voiceover`),
  };
}

export async function getWorkspaceProjectSegmentVideoAsset(
  user: SegmentEditorUser,
  options: {
    delivery: WorkspaceSegmentEditorVideoDelivery;
    projectId: number;
    segmentIndex: number;
    source: WorkspaceSegmentEditorVideoSource;
  },
): Promise<null> {
  void user;
  void options;
  return null;
}
