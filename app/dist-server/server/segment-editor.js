import { env } from "./env.js";
import { getWorkspaceProjects } from "./projects.js";
import { buildWorkspaceMediaAssetRef, fetchProjectMediaEnvelope, mergeWorkspaceMediaAssetRefs, } from "./media-assets.js";
import { assertAdsflowConfigured, buildAdsflowUrl, fetchAdsflowJson as fetchAdsflowJsonWithPolicy, fetchUpstreamResponse, UpstreamFetchError, UpstreamHttpError, upstreamPolicies, } from "./upstream-client.js";
import { listWorkspaceDeletedProjects, listWorkspaceGenerationHistory } from "./workspace-history.js";
export class WorkspaceSegmentEditorError extends Error {
    statusCode;
    constructor(message, statusCode = 400) {
        super(message);
        this.name = "WorkspaceSegmentEditorError";
        this.statusCode = statusCode;
    }
}
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeBooleanFlag = (value) => {
    if (value === true) {
        return true;
    }
    if (value === false || value === null || value === undefined) {
        return false;
    }
    const normalized = normalizeText(value).toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
};
const normalizeWorkspaceSegmentEditorLanguage = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    return normalized === "en" || normalized === "ru" ? normalized : "";
};
const normalizeInteger = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return null;
    const rounded = Math.trunc(numeric);
    return rounded >= 0 ? rounded : null;
};
const normalizeNumber = (value) => {
    if (value === null || typeof value === "undefined" || value === "") {
        return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};
const normalizeSegmentDurationMode = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    return normalized === "manual" ? "manual" : "auto";
};
const normalizeManualDurationSeconds = (value) => {
    const numeric = normalizeNumber(value);
    return numeric !== null && numeric >= 1 ? numeric : null;
};
const normalizePositiveProjectId = (value) => {
    const normalized = normalizeInteger(value);
    return normalized !== null && normalized > 0 ? normalized : null;
};
const normalizeMediaType = (value) => String(value ?? "").trim().toLowerCase() === "photo" ? "photo" : "video";
const normalizeUrl = (value) => {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || null;
};
const normalizeWorkspaceProjectMusicFileName = (value) => {
    const normalized = normalizeText(value);
    if (!normalized ||
        normalized.includes("/") ||
        normalized.includes("\\") ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.(?:aac|m4a|mp3|ogg|wav)$/i.test(normalized)) {
        return "";
    }
    return normalized;
};
export const resolveWorkspaceSegmentEditorCustomMusicMetadata = (projectDetailsPayload) => {
    const generationSettings = projectDetailsPayload?.generation_settings && typeof projectDetailsPayload.generation_settings === "object"
        ? projectDetailsPayload.generation_settings
        : null;
    const generationMusicType = normalizeText(generationSettings?.music_type).toLowerCase();
    const projectMusicType = normalizeText(projectDetailsPayload?.music_type).toLowerCase();
    const explicitCustomMusicAssetId = normalizeInteger(generationSettings?.custom_music_asset_id ?? projectDetailsPayload?.custom_music_asset_id);
    const explicitCustomMusicFileName = normalizeText(generationSettings?.custom_music_original_name);
    const projectMusicFileName = normalizeText(projectDetailsPayload?.music_name);
    if (generationMusicType !== "custom" &&
        projectMusicType !== "custom" &&
        !explicitCustomMusicAssetId &&
        !explicitCustomMusicFileName) {
        return {
            customMusicAssetId: null,
            customMusicFileName: "",
        };
    }
    return {
        customMusicAssetId: normalizeInteger(explicitCustomMusicAssetId ??
            generationSettings?.music_asset_id ??
            projectDetailsPayload?.music_asset_id) ?? null,
        customMusicFileName: explicitCustomMusicFileName || projectMusicFileName,
    };
};
const resolveWorkspaceSegmentEditorLanguage = (payload, projectDetailsPayload) => {
    const generationSettings = projectDetailsPayload?.generation_settings && typeof projectDetailsPayload.generation_settings === "object"
        ? projectDetailsPayload.generation_settings
        : null;
    return (normalizeWorkspaceSegmentEditorLanguage(payload.language) ||
        normalizeWorkspaceSegmentEditorLanguage(generationSettings?.content_language) ||
        normalizeWorkspaceSegmentEditorLanguage(generationSettings?.requested_language) ||
        "");
};
const isWorkspaceRenderableMediaUrl = (value) => {
    const normalized = normalizeUrl(value);
    if (!normalized) {
        return false;
    }
    if (normalized.startsWith("/")) {
        return true;
    }
    try {
        const resolvedUrl = new URL(normalized);
        return (resolvedUrl.protocol === "http:" ||
            resolvedUrl.protocol === "https:" ||
            resolvedUrl.protocol === "file:");
    }
    catch {
        return false;
    }
};
const pickWorkspaceRenderableMediaUrl = (...candidates) => {
    for (const candidate of candidates) {
        if (isWorkspaceRenderableMediaUrl(candidate)) {
            return normalizeUrl(candidate);
        }
    }
    return null;
};
const ADSFLOW_MEDIA_DOWNLOAD_PATH_PATTERN = /\/api\/media\/(\d+)\/download(?:[/?#]|$)/i;
const buildWorkspaceMediaAssetProxyUrl = (assetId) => `/api/workspace/media-assets/${assetId}`;
const getProjectMediaEntryAssetId = (entry) => normalizeInteger(entry?.media_asset_id) ?? normalizeInteger(entry?.id);
const getProjectMediaEntryRoleText = (entry) => [
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
const isProjectMediaEntryAudio = (entry) => {
    const mediaType = normalizeText(entry?.media_type).toLowerCase();
    const mimeType = normalizeText(entry?.mime_type).toLowerCase();
    return mediaType === "audio" || mimeType.startsWith("audio/");
};
const isProjectSceneSoundMediaEntry = (entry) => {
    if (!isProjectMediaEntryAudio(entry)) {
        return false;
    }
    const roleText = getProjectMediaEntryRoleText(entry).replace(/-/g, "_");
    return (roleText.includes("scene_sound") ||
        roleText.includes("segment_sound") ||
        roleText.includes("segment_scene") ||
        roleText.includes("sound_effect"));
};
const isProjectVoiceoverMediaEntry = (entry) => {
    if (!isProjectMediaEntryAudio(entry)) {
        return false;
    }
    const roleText = getProjectMediaEntryRoleText(entry).replace(/-/g, "_");
    return (roleText.includes("voiceover") ||
        roleText.includes("segment_voice") ||
        roleText.includes("segment_tts") ||
        roleText.includes("tts"));
};
const buildWorkspaceSegmentSceneSoundRef = (entry) => {
    if (!entry || typeof entry !== "object") {
        return null;
    }
    const record = entry;
    const assetId = normalizePositiveProjectId(record.media_asset_id) ?? normalizePositiveProjectId(record.id);
    const downloadUrl = normalizeText(record.download_url);
    const remoteUrl = normalizeText(record.remote_url);
    const url = normalizeText(record.url);
    if (!assetId && !downloadUrl && !remoteUrl && !url) {
        return null;
    }
    return {
        download_url: downloadUrl || null,
        file_name: normalizeText(record.file_name) ||
            normalizeText(record.storage_key).split("/").pop() ||
            (assetId ? `segment-scene-sound-${assetId}.wav` : "segment-scene-sound.wav"),
        file_size: Math.max(0, Number(record.file_size ?? 0) || 0),
        media_asset_id: assetId,
        mime_type: normalizeText(record.mime_type) || "audio/wav",
        remote_url: remoteUrl || null,
        url: url || null,
    };
};
const findProjectSceneSoundMediaEntry = (entries, segmentIndex) => entries.find((entry) => normalizeInteger(entry?.segment_index) === segmentIndex && isProjectSceneSoundMediaEntry(entry)) ??
    null;
const findProjectVoiceoverMediaEntry = (entries, segmentIndex) => entries.find((entry) => normalizeInteger(entry?.segment_index) === segmentIndex && isProjectVoiceoverMediaEntry(entry)) ??
    null;
const getWorkspaceMediaAssetRoleText = (asset) => [
    asset?.kind,
    asset?.libraryKind,
    asset?.role,
    asset?.sourceKind,
    asset?.storageKey,
]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean)
    .join(" ");
const isWorkspaceSceneSoundMediaAsset = (asset) => {
    const mediaType = normalizeText(asset?.mediaType).toLowerCase();
    const mimeType = normalizeText(asset?.mimeType).toLowerCase();
    const isAudio = mediaType === "audio" || mimeType.startsWith("audio/");
    if (!isAudio) {
        return false;
    }
    const roleText = getWorkspaceMediaAssetRoleText(asset).replace(/-/g, "_");
    return (roleText.includes("scene_sound") ||
        roleText.includes("segment_sound") ||
        roleText.includes("segment_scene") ||
        roleText.includes("sound_effect"));
};
const isWorkspaceVoiceoverMediaAsset = (asset) => {
    const mediaType = normalizeText(asset?.mediaType).toLowerCase();
    const mimeType = normalizeText(asset?.mimeType).toLowerCase();
    const isAudio = mediaType === "audio" || mimeType.startsWith("audio/");
    if (!isAudio) {
        return false;
    }
    const roleText = getWorkspaceMediaAssetRoleText(asset).replace(/-/g, "_");
    return (roleText.includes("voiceover") ||
        roleText.includes("segment_voice") ||
        roleText.includes("segment_tts") ||
        roleText.includes("tts"));
};
const buildWorkspaceSegmentSceneSoundRefFromAsset = (asset) => {
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
        file_name: normalizeText(asset.storageKey).split("/").pop() ||
            (assetId ? `segment-scene-sound-${assetId}.wav` : "segment-scene-sound.wav"),
        file_size: 0,
        media_asset_id: assetId,
        mime_type: normalizeText(asset.mimeType) || "audio/wav",
        remote_url: remoteUrl || null,
        url: normalizeText(asset.originalUrl) || null,
    };
};
const findProjectSceneSoundMediaAsset = (assets, segmentIndex) => assets.find((asset) => normalizeInteger(asset?.segmentIndex) === segmentIndex && isWorkspaceSceneSoundMediaAsset(asset)) ??
    null;
const findProjectVoiceoverMediaAsset = (assets, segmentIndex) => assets.find((asset) => normalizeInteger(asset?.segmentIndex) === segmentIndex && isWorkspaceVoiceoverMediaAsset(asset)) ??
    null;
const normalizeWorkspaceProjectMediaUrl = (entry, value) => {
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
    }
    catch {
        return normalizedUrl;
    }
};
const getProjectMediaEntryRenderableUrl = (entry, ...candidates) => normalizeWorkspaceProjectMediaUrl(entry, pickWorkspaceRenderableMediaUrl(...candidates));
const normalizeProjectMediaEntries = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item) => Boolean(item && typeof item === "object"));
};
const pickProjectMediaEntries = (...candidates) => {
    for (const candidate of candidates) {
        const entries = normalizeProjectMediaEntries(candidate);
        if (entries.length > 0) {
            return entries;
        }
    }
    return [];
};
const detectWorkspaceSegmentSourceKind = (entry) => {
    const source = normalizeText(entry?.source_kind || entry?.source).toLowerCase();
    const renderedAnimationMode = normalizeText(entry?.rendered_animation_mode).toLowerCase();
    const renderedViaI2v = entry?.rendered_via_i2v === true ||
        entry?.rendered_via_i2v === 1 ||
        normalizeText(entry?.rendered_via_i2v).toLowerCase() === "true";
    if (source === "ai_generated" || source === "ai" || source === "generated") {
        return "ai_generated";
    }
    if (source === "pexels" ||
        source === "pixabay" ||
        source === "stock" ||
        source === "stock_photo" ||
        source === "stock_video" ||
        source === "unsplash") {
        return "stock";
    }
    if (source.includes("upload") ||
        source.includes("telegram") ||
        source.includes("user") ||
        source.includes("library")) {
        return "upload";
    }
    const identifier = normalizeText(entry?.id).toLowerCase();
    const localPath = normalizeText(entry?.local_path).toLowerCase();
    const storageKey = normalizeText(entry?.storage_key).toLowerCase();
    const joinedUrls = [entry?.url, entry?.download_url, entry?.preview].map((value) => normalizeText(value).toLowerCase()).join(" ");
    if (identifier.startsWith("aiimg_") ||
        renderedViaI2v ||
        renderedAnimationMode === "i2v" ||
        localPath.includes("wavespeed") ||
        localPath.includes("deapi") ||
        storageKey.includes("wavespeed") ||
        storageKey.includes("deapi")) {
        return "ai_generated";
    }
    if (joinedUrls.includes("pexels.com") || joinedUrls.includes("pixabay.com") || joinedUrls.includes("unsplash.com")) {
        return "stock";
    }
    return "unknown";
};
const getProjectMediaEntryPreviewUrl = (entry) => getProjectMediaEntryRenderableUrl(entry, entry?.preview, entry?.download_url, entry?.url);
const getProjectMediaEntryPlaybackUrl = (entry) => pickWorkspaceRenderableMediaUrl(entry?.download_url, entry?.url, entry?.preview);
const getProjectOriginalMediaEntries = (payload) => pickProjectMediaEntries(payload?.source_video_urls, payload?.generation_settings?.source_video_urls, payload?.generation_settings?.original_videos);
const getProjectCurrentMediaEntries = (payload, originalEntries) => pickProjectMediaEntries(payload?.generation_settings?.current_rendered_segments, payload?.video_urls, payload?.background_urls, payload?.generation_settings?.video_urls, payload?.generation_settings?.background_urls, originalEntries);
const getProjectSegmentMarker = (entry, fallback) => normalizeText(entry?.download_url) ||
    normalizeText(entry?.url) ||
    normalizeText(entry?.storage_key) ||
    normalizeText(getProjectMediaEntryAssetId(entry)) ||
    fallback;
const pickProjectDetailSegments = (settings) => {
    const candidates = [settings?.original_video_segments, settings?.video_segments];
    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate;
        }
    }
    return [];
};
const getProjectDetailsSourceProjectId = (payload) => {
    const settings = payload?.generation_settings && typeof payload.generation_settings === "object"
        ? payload.generation_settings
        : null;
    const detailsRecord = (payload ?? {});
    const settingsRecord = (settings ?? {});
    return (normalizePositiveProjectId(payload?.source_project_id) ??
        normalizePositiveProjectId(detailsRecord.sourceProjectId) ??
        normalizePositiveProjectId(settings?.source_project_id) ??
        normalizePositiveProjectId(settingsRecord.sourceProjectId));
};
const getSegmentEditorSegmentIndex = (segment, fallbackIndex) => {
    const record = (segment ?? {});
    return normalizeInteger(record.segment_index) ?? normalizeInteger(segment?.index) ?? fallbackIndex;
};
const normalizeSegmentEditorComparableText = (value) => normalizeText(value).toLowerCase();
const getSegmentEditorVoiceoverTextHash = (value) => normalizeSegmentEditorComparableText(value);
const segmentEditorDisabledVoiceTypes = new Set(["none", "silent", "no_voice"]);
const inferSegmentEditorPayloadProjectVoiceType = (payload, fallbackVoiceType) => {
    const segments = payload.segments ?? [];
    if (segments.length === 0) {
        return fallbackVoiceType;
    }
    const candidateCounts = new Map();
    for (const segment of segments) {
        const candidate = normalizeText(segment.voice_type);
        if (!candidate) {
            continue;
        }
        const candidateKey = candidate.toLowerCase();
        if (segmentEditorDisabledVoiceTypes.has(candidateKey)) {
            continue;
        }
        const existing = candidateCounts.get(candidateKey);
        candidateCounts.set(candidateKey, {
            count: (existing?.count ?? 0) + 1,
            value: existing?.value ?? candidate,
        });
    }
    if (candidateCounts.size !== 1) {
        return fallbackVoiceType;
    }
    const [{ count, value }] = Array.from(candidateCounts.values());
    const minimumCount = Math.max(1, Math.ceil(segments.length * 0.6));
    return count >= minimumCount ? value : fallbackVoiceType;
};
const getSegmentEditorSegmentTextFingerprint = (segments) => (segments ?? []).map((segment) => normalizeSegmentEditorComparableText(segment?.text)).join("\n");
const doSegmentEditorSegmentTextsMatch = (leftSegments, rightSegments) => {
    const left = leftSegments ?? [];
    const right = rightSegments ?? [];
    if (left.length === 0 || right.length === 0 || left.length !== right.length) {
        return false;
    }
    const leftFingerprint = getSegmentEditorSegmentTextFingerprint(left);
    const rightFingerprint = getSegmentEditorSegmentTextFingerprint(right);
    return Boolean(leftFingerprint) && leftFingerprint === rightFingerprint;
};
const doSegmentEditorGlobalVoicesMatch = (payload, sourcePayload) => {
    const voiceType = normalizeSegmentEditorComparableText(payload.voice_type);
    const sourceVoiceType = normalizeSegmentEditorComparableText(sourcePayload?.voice_type);
    return !voiceType || !sourceVoiceType || voiceType === sourceVoiceType;
};
const canReuseSourceSegmentEditorProjectTts = (payload, sourcePayload) => {
    const payloadTtsAssetId = normalizePositiveProjectId(payload.tts_asset_id);
    const sourceTtsAssetId = normalizePositiveProjectId(sourcePayload?.tts_asset_id);
    return (sourceTtsAssetId !== null &&
        (payloadTtsAssetId === null || payloadTtsAssetId === sourceTtsAssetId) &&
        doSegmentEditorGlobalVoicesMatch(payload, sourcePayload) &&
        doSegmentEditorSegmentTextsMatch(payload.segments, sourcePayload?.segments));
};
const canReuseSourceSegmentEditorMusic = (payload, projectDetailsPayload, sourcePayload) => {
    if (normalizePositiveProjectId(payload.music_asset_id) !== null ||
        normalizePositiveProjectId(sourcePayload?.music_asset_id) === null) {
        return false;
    }
    const musicName = normalizeSegmentEditorComparableText(payload.music_name || projectDetailsPayload?.music_name);
    const sourceMusicName = normalizeSegmentEditorComparableText(sourcePayload?.music_name);
    if (musicName && sourceMusicName) {
        return musicName === sourceMusicName;
    }
    const musicType = normalizeSegmentEditorComparableText(payload.music_type || projectDetailsPayload?.music_type);
    const sourceMusicType = normalizeSegmentEditorComparableText(sourcePayload?.music_type);
    if (musicType && sourceMusicType) {
        return musicType === sourceMusicType;
    }
    return !musicName && !musicType;
};
const getSegmentEditorSegmentMapByIndex = (segments) => {
    const map = new Map();
    (segments ?? []).forEach((segment, slot) => {
        map.set(getSegmentEditorSegmentIndex(segment, slot), segment);
    });
    return map;
};
const pickSegmentEditorNumber = (...values) => {
    for (const value of values) {
        const normalized = normalizeNumber(value);
        if (normalized !== null) {
            return normalized;
        }
    }
    return null;
};
const pickSegmentEditorVoiceSourceStartTime = (record) => pickSegmentEditorNumber(record?._voice_source_start_time, record?.voice_source_start_time, record?.voiceSourceStartTime);
const pickSegmentEditorVoiceSourceEndTime = (record) => pickSegmentEditorNumber(record?._voice_source_end_time, record?.voice_source_end_time, record?.voiceSourceEndTime);
const pickSegmentEditorVoiceSourceDuration = (record) => pickSegmentEditorNumber(record?._voice_source_duration, record?.voice_source_duration, record?.voiceSourceDuration);
const pickSegmentEditorText = (...values) => {
    for (const value of values) {
        const normalized = normalizeText(value);
        if (normalized) {
            return normalized;
        }
    }
    return "";
};
const hydrateSegmentEditorPayloadWithInheritedAudio = (payload, projectDetailsPayload, sourcePayload) => {
    const generationSettings = projectDetailsPayload?.generation_settings && typeof projectDetailsPayload.generation_settings === "object"
        ? projectDetailsPayload.generation_settings
        : null;
    const shouldReuseSourceTts = canReuseSourceSegmentEditorProjectTts(payload, sourcePayload);
    const shouldReuseSourceMusic = canReuseSourceSegmentEditorMusic(payload, projectDetailsPayload, sourcePayload);
    const inheritedTtsAssetId = shouldReuseSourceTts
        ? normalizePositiveProjectId(sourcePayload?.tts_asset_id)
        : normalizePositiveProjectId(payload.tts_asset_id);
    const inheritedMusicAssetId = shouldReuseSourceMusic
        ? normalizePositiveProjectId(sourcePayload?.music_asset_id)
        : normalizePositiveProjectId(payload.music_asset_id);
    const detailSegmentsByIndex = getSegmentEditorSegmentMapByIndex(pickProjectDetailSegments(generationSettings));
    const sourceSegmentsByIndex = shouldReuseSourceTts
        ? getSegmentEditorSegmentMapByIndex(sourcePayload?.segments)
        : new Map();
    const rawEffectiveVoiceType = pickSegmentEditorText(payload.voice_type, projectDetailsPayload?.voice_type, generationSettings?.voice_type, sourcePayload?.voice_type);
    const effectiveVoiceType = inferSegmentEditorPayloadProjectVoiceType(payload, rawEffectiveVoiceType);
    const effectiveLanguage = normalizeWorkspaceSegmentEditorLanguage(payload.language) ||
        normalizeWorkspaceSegmentEditorLanguage(generationSettings?.content_language) ||
        normalizeWorkspaceSegmentEditorLanguage(generationSettings?.requested_language) ||
        normalizeWorkspaceSegmentEditorLanguage(projectDetailsPayload?.content_language) ||
        normalizeWorkspaceSegmentEditorLanguage(sourcePayload?.language);
    const canHydrateProjectVoiceover = inheritedTtsAssetId !== null && Boolean(effectiveVoiceType);
    return {
        ...payload,
        music_asset_id: inheritedMusicAssetId ?? payload.music_asset_id,
        music_name: pickSegmentEditorText(payload.music_name, projectDetailsPayload?.music_name, sourcePayload?.music_name),
        music_type: pickSegmentEditorText(payload.music_type, projectDetailsPayload?.music_type, sourcePayload?.music_type),
        segments: (payload.segments ?? []).map((segment, slot) => {
            const index = getSegmentEditorSegmentIndex(segment, slot);
            const detailSegment = detailSegmentsByIndex.get(index) ?? null;
            const sourceSegment = sourceSegmentsByIndex.get(index) ?? null;
            const segmentRecord = segment;
            const detailRecord = (detailSegment ?? {});
            const sourceRecord = (sourceSegment ?? {});
            const segmentVoiceSourceStartTime = pickSegmentEditorVoiceSourceStartTime(segmentRecord);
            const segmentVoiceSourceEndTime = pickSegmentEditorVoiceSourceEndTime(segmentRecord);
            const segmentVoiceSourceDuration = pickSegmentEditorVoiceSourceDuration(segmentRecord);
            const detailVoiceSourceStartTime = pickSegmentEditorVoiceSourceStartTime(detailRecord);
            const detailVoiceSourceEndTime = pickSegmentEditorVoiceSourceEndTime(detailRecord);
            const detailVoiceSourceDuration = pickSegmentEditorVoiceSourceDuration(detailRecord);
            const sourceVoiceSourceStartTime = pickSegmentEditorVoiceSourceStartTime(sourceRecord);
            const sourceVoiceSourceEndTime = pickSegmentEditorVoiceSourceEndTime(sourceRecord);
            const sourceVoiceSourceDuration = pickSegmentEditorVoiceSourceDuration(sourceRecord);
            const voiceSourceStartTime = shouldReuseSourceTts
                ? pickSegmentEditorNumber(detailVoiceSourceStartTime, sourceVoiceSourceStartTime, sourceSegment?.speech_start_time, segmentVoiceSourceStartTime)
                : pickSegmentEditorNumber(segmentVoiceSourceStartTime, detailVoiceSourceStartTime, sourceVoiceSourceStartTime);
            const voiceSourceEndTime = shouldReuseSourceTts
                ? pickSegmentEditorNumber(detailVoiceSourceEndTime, sourceVoiceSourceEndTime, sourceSegment?.speech_end_time, segmentVoiceSourceEndTime)
                : pickSegmentEditorNumber(segmentVoiceSourceEndTime, detailVoiceSourceEndTime, sourceVoiceSourceEndTime);
            const voiceSourceDuration = (shouldReuseSourceTts
                ? pickSegmentEditorNumber(detailVoiceSourceDuration, sourceVoiceSourceDuration, sourceSegment?.speech_duration, segmentVoiceSourceDuration)
                : pickSegmentEditorNumber(segmentVoiceSourceDuration, detailVoiceSourceDuration, sourceVoiceSourceDuration)) ??
                (voiceSourceStartTime !== null && voiceSourceEndTime !== null
                    ? Math.max(0, voiceSourceEndTime - voiceSourceStartTime)
                    : null);
            const speechStartTime = shouldReuseSourceTts
                ? pickSegmentEditorNumber(voiceSourceStartTime, sourceSegment?.speech_start_time, segment.speech_start_time)
                : pickSegmentEditorNumber(segment.speech_start_time, voiceSourceStartTime, sourceSegment?.speech_start_time);
            const speechEndTime = shouldReuseSourceTts
                ? pickSegmentEditorNumber(voiceSourceEndTime, sourceSegment?.speech_end_time, segment.speech_end_time)
                : pickSegmentEditorNumber(segment.speech_end_time, voiceSourceEndTime, sourceSegment?.speech_end_time);
            const speechDuration = (shouldReuseSourceTts
                ? pickSegmentEditorNumber(voiceSourceDuration, sourceSegment?.speech_duration, segment.speech_duration)
                : pickSegmentEditorNumber(segment.speech_duration, voiceSourceDuration, sourceSegment?.speech_duration)) ??
                (speechStartTime !== null && speechEndTime !== null ? Math.max(0, speechEndTime - speechStartTime) : null);
            const speechWords = shouldReuseSourceTts && Array.isArray(sourceSegment?.speech_words) && sourceSegment.speech_words.length > 0
                ? sourceSegment.speech_words
                : Array.isArray(segment.speech_words) && segment.speech_words.length > 0
                    ? segment.speech_words
                    : Array.isArray(sourceSegment?.speech_words) && sourceSegment.speech_words.length > 0
                        ? sourceSegment.speech_words
                        : Array.isArray(detailSegment?.speech_words) && detailSegment.speech_words.length > 0
                            ? detailSegment.speech_words
                            : null;
            const hasProjectVoiceoverTiming = canHydrateProjectVoiceover &&
                (speechStartTime !== null ||
                    speechEndTime !== null ||
                    speechDuration !== null ||
                    (Array.isArray(speechWords) && speechWords.length > 0));
            const segmentText = pickSegmentEditorText(segment.text, detailSegment?.text, sourceSegment?.text);
            const projectVoiceoverTextHash = hasProjectVoiceoverTiming
                ? getSegmentEditorVoiceoverTextHash(segmentText)
                : "";
            const rawSegmentVoiceType = normalizeText(segment.voice_type);
            const segmentVoiceType = rawSegmentVoiceType &&
                effectiveVoiceType &&
                normalizeSegmentEditorComparableText(rawSegmentVoiceType) === normalizeSegmentEditorComparableText(effectiveVoiceType)
                ? null
                : rawSegmentVoiceType || null;
            return {
                ...segment,
                _voice_source_duration: voiceSourceDuration,
                _voice_source_end_time: voiceSourceEndTime,
                _voice_source_start_time: voiceSourceStartTime,
                speech_duration: speechDuration,
                speech_end_time: speechEndTime,
                speech_start_time: speechStartTime,
                speech_words: speechWords,
                text: segmentText,
                voice_type: segmentVoiceType,
                voiceover_language: pickSegmentEditorText(...(hasProjectVoiceoverTiming
                    ? [
                        effectiveLanguage,
                        detailSegment?.voiceover_language,
                        sourceSegment?.voiceover_language,
                        segment.voiceover_language,
                    ]
                    : [
                        segment.voiceover_language,
                        detailSegment?.voiceover_language,
                        sourceSegment?.voiceover_language,
                    ])),
                voiceover_text_hash: pickSegmentEditorText(...(hasProjectVoiceoverTiming
                    ? [
                        projectVoiceoverTextHash,
                        detailSegment?.voiceover_text_hash,
                        sourceSegment?.voiceover_text_hash,
                        segment.voiceover_text_hash,
                    ]
                    : [
                        segment.voiceover_text_hash,
                        detailSegment?.voiceover_text_hash,
                        sourceSegment?.voiceover_text_hash,
                    ])),
                voiceover_voice_type: pickSegmentEditorText(...(hasProjectVoiceoverTiming
                    ? [
                        effectiveVoiceType,
                        detailSegment?.voiceover_voice_type,
                        sourceSegment?.voiceover_voice_type,
                        sourceRecord.voiceoverVoiceType,
                        segment.voiceover_voice_type,
                    ]
                    : [
                        segment.voiceover_voice_type,
                        detailSegment?.voiceover_voice_type,
                        sourceSegment?.voiceover_voice_type,
                        sourceRecord.voiceoverVoiceType,
                    ])),
            };
        }),
        tts_asset_id: inheritedTtsAssetId ?? payload.tts_asset_id,
        voice_type: effectiveVoiceType,
    };
};
const buildSegmentEditorPayloadFromProjectDetails = (requestedProjectId, payload) => {
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
    const projectId = normalizePositiveProjectId(payload.project_id) ??
        normalizePositiveProjectId(payload.id) ??
        requestedProjectId;
    const segments = rawSegments
        .map((segment, slot) => {
        if (!segment || typeof segment !== "object") {
            return null;
        }
        const record = segment;
        const index = normalizeInteger(record.segment_index) ?? normalizeInteger(record.index) ?? slot;
        const currentEntry = currentEntries[slot] ?? currentEntries[index] ?? null;
        const originalEntry = originalEntries[slot] ?? originalEntries[index] ?? currentEntry;
        const startTime = normalizeNumber(record.start_time);
        const endTime = normalizeNumber(record.end_time);
        const duration = normalizeNumber(record.duration) ??
            (startTime !== null && endTime !== null ? Math.max(0, endTime - startTime) : null);
        const text = normalizeText(record.text);
        const sceneSound = buildWorkspaceSegmentSceneSoundRef(typeof record.scene_sound === "object" ? record.scene_sound : null);
        const sceneSoundAssetId = normalizePositiveProjectId(record.scene_sound_asset_id) ??
            normalizePositiveProjectId(record.sceneSoundAssetId) ??
            sceneSound?.media_asset_id ??
            null;
        const voiceover = buildWorkspaceSegmentSceneSoundRef(typeof record.voiceover === "object" ? record.voiceover : null);
        const voiceoverAssetId = normalizePositiveProjectId(record.voiceover_asset_id) ??
            normalizePositiveProjectId(record.voiceoverAssetId) ??
            voiceover?.media_asset_id ??
            null;
        const voiceSourceDuration = pickSegmentEditorVoiceSourceDuration(record);
        const voiceSourceEndTime = pickSegmentEditorVoiceSourceEndTime(record);
        const voiceSourceStartTime = pickSegmentEditorVoiceSourceStartTime(record);
        if (!text && duration === null && !currentEntry && !originalEntry) {
            return null;
        }
        return {
            _voice_source_duration: voiceSourceDuration,
            _voice_source_end_time: voiceSourceEndTime,
            _voice_source_start_time: voiceSourceStartTime,
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
            speech_duration: normalizeNumber(record.speech_duration) ?? voiceSourceDuration,
            speech_end_time: normalizeNumber(record.speech_end_time) ?? voiceSourceEndTime,
            speech_start_time: normalizeNumber(record.speech_start_time) ?? voiceSourceStartTime,
            speech_words: Array.isArray(record.speech_words) ? record.speech_words : null,
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
        };
    })
        .filter((segment) => Boolean(segment));
    if (segments.length === 0) {
        return null;
    }
    return {
        description: normalizeText(settings.original_ai_description) || normalizeText(payload.description),
        language: normalizeWorkspaceSegmentEditorLanguage(settings.content_language) ||
            normalizeWorkspaceSegmentEditorLanguage(settings.requested_language) ||
            normalizeWorkspaceSegmentEditorLanguage(payload.content_language),
        music_asset_id: normalizePositiveProjectId(settings.music_asset_id) ??
            normalizePositiveProjectId(settings.custom_music_asset_id) ??
            normalizePositiveProjectId(payload.music_asset_id),
        music_name: normalizeText(payload.music_name),
        music_type: normalizeText(payload.music_type) || normalizeText(settings.music_type),
        project_id: projectId,
        segments,
        subtitle_color: normalizeText(payload.subtitle_color) || normalizeText(settings.subtitle_color),
        subtitle_style: normalizeText(payload.subtitle_style) || normalizeText(settings.subtitle_style),
        subtitle_type: normalizeText(payload.subtitle_type) || normalizeText(settings.subtitle_type),
        title: normalizeText(settings.project_title) ||
            normalizeText(settings.original_ai_title) ||
            normalizeText(payload.ai_title) ||
            normalizeText(payload.description) ||
            `Проект #${projectId}`,
        tts_asset_id: normalizePositiveProjectId(settings.tts_asset_id) ?? normalizePositiveProjectId(payload.tts_asset_id),
        voice_type: normalizeText(payload.voice_type) || normalizeText(settings.voice_type),
    };
};
const buildProjectMediaAssetIndex = (assets) => new Map(assets
    .filter((asset) => typeof asset.assetId === "number" && asset.assetId > 0)
    .map((asset) => [asset.assetId, asset]));
const buildSegmentMediaAssetFromEntry = (entry, projectMediaByAssetId, options) => {
    const assetId = getProjectMediaEntryAssetId(entry);
    const linkedAsset = assetId !== null ? projectMediaByAssetId.get(assetId) ?? null : null;
    const hasMissingProjectAssetReference = assetId !== null &&
        !linkedAsset &&
        Boolean(options?.projectMediaLoaded);
    const entryKind = normalizeText(entry?.kind || entry?.asset_kind) || options?.role || null;
    const entryRole = normalizeText(entry?.role || entry?.link_role) || options?.role || entryKind;
    const entryAsset = buildWorkspaceMediaAssetRef({
        download_path: entry?.download_url ?? entry?.url ?? null,
        download_url: entry?.download_url ?? null,
        duration: entry?.duration ?? null,
        durationSeconds: entry?.durationSeconds ?? null,
        duration_seconds: entry?.duration_seconds ?? null,
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
const isWorkspacePhotoMediaAssetRef = (asset) => {
    const mediaType = normalizeText(asset?.mediaType).toLowerCase();
    const mimeType = normalizeText(asset?.mimeType).toLowerCase();
    return mediaType === "photo" || mediaType === "image" || mimeType.startsWith("image/");
};
const isWorkspaceVideoMediaAssetRef = (asset) => {
    const mediaType = normalizeText(asset?.mediaType).toLowerCase();
    const mimeType = normalizeText(asset?.mimeType).toLowerCase();
    return mediaType === "video" || mimeType.startsWith("video/");
};
const isProjectMediaEntryPhoto = (entry) => {
    const mediaType = normalizeText(entry?.media_type).toLowerCase();
    const mimeType = normalizeText(entry?.mime_type).toLowerCase();
    return mediaType === "photo" || mediaType === "image" || mimeType.startsWith("image/");
};
const isProjectMediaEntryVideo = (entry) => {
    const mediaType = normalizeText(entry?.media_type).toLowerCase();
    const mimeType = normalizeText(entry?.mime_type).toLowerCase();
    return mediaType === "video" || mimeType.startsWith("video/");
};
const resolveWorkspaceSegmentMediaType = (options) => {
    const payloadMediaType = normalizeMediaType(options.payloadMediaType);
    if (payloadMediaType === "photo") {
        return "photo";
    }
    if (isWorkspaceVideoMediaAssetRef(options.currentAsset) ||
        isWorkspaceVideoMediaAssetRef(options.originalAsset) ||
        isProjectMediaEntryVideo(options.currentEntry) ||
        isProjectMediaEntryVideo(options.originalEntry)) {
        return "video";
    }
    if (isWorkspacePhotoMediaAssetRef(options.currentAsset) ||
        isWorkspacePhotoMediaAssetRef(options.originalAsset) ||
        isProjectMediaEntryPhoto(options.currentEntry) ||
        isProjectMediaEntryPhoto(options.originalEntry)) {
        return "photo";
    }
    return payloadMediaType;
};
const normalizeSpeechWords = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => {
        if (!item || typeof item !== "object") {
            return null;
        }
        const record = item;
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
        .filter((item) => Boolean(item));
};
const getSegmentEditorSpeechWordsRange = (segment) => {
    const speechWords = Array.isArray(segment.speechWords) ? segment.speechWords : [];
    const firstSpeechWord = speechWords[0] ?? null;
    const lastSpeechWord = speechWords[speechWords.length - 1] ?? null;
    const startTime = normalizeNumber(firstSpeechWord?.startTime);
    const endTime = normalizeNumber(lastSpeechWord?.endTime);
    if (startTime === null || endTime === null || endTime <= startTime) {
        return null;
    }
    return { endTime, startTime };
};
const hasSegmentEditorAuthoritativeSpeechTiming = (segment) => {
    const voiceSourceStartTime = normalizeNumber(segment.voiceSourceStartTime);
    const voiceSourceEndTime = normalizeNumber(segment.voiceSourceEndTime);
    if (voiceSourceStartTime !== null && voiceSourceEndTime !== null && voiceSourceEndTime > voiceSourceStartTime) {
        return true;
    }
    const voiceSourceDuration = normalizeNumber(segment.voiceSourceDuration);
    if (voiceSourceStartTime !== null && voiceSourceDuration !== null && voiceSourceDuration > 0) {
        return true;
    }
    const speechWordsRange = getSegmentEditorSpeechWordsRange(segment);
    if (speechWordsRange) {
        return true;
    }
    const speechStartTime = normalizeNumber(segment.speechStartTime);
    const speechEndTime = normalizeNumber(segment.speechEndTime);
    if (speechStartTime !== null && speechEndTime !== null && speechEndTime > speechStartTime) {
        return true;
    }
    const speechDuration = normalizeNumber(segment.speechDuration);
    return speechStartTime !== null && speechDuration !== null && speechDuration > 0;
};
const PROJECT_ACCESS_CACHE_TTL_MS = 5 * 60_000;
const SEGMENT_EDITOR_SESSION_CACHE_TTL_MS = 10 * 60_000;
const PROJECT_ACCESS_FALLBACK_TIMEOUT_MS = 8_000;
const SEGMENT_EDITOR_OPTIONAL_CONTEXT_TIMEOUT_MS = 2_500;
const SEGMENT_EDITOR_FALLBACK_CONTEXT_TIMEOUT_MS = 4_000;
const PROJECT_ACCESS_TIMEOUT_ERROR_MESSAGE = "Список проектов загружается слишком долго. Попробуйте ещё раз.";
const SEGMENT_EDITOR_TIMEOUT_ERROR_MESSAGE = "Сегменты загружаются слишком долго. Попробуйте ещё раз.";
const SEGMENT_EDITOR_PREPARING_ERROR_MESSAGE = "Project components are still being prepared";
const SEGMENT_EDITOR_VOICEOVER_DURATION_CACHE_TTL_MS = 30 * 60_000;
const SEGMENT_EDITOR_VOICEOVER_DURATION_FETCH_TIMEOUT_MS = 6_500;
const WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS = 1;
const WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS = 8;
const projectAccessCache = new Map();
const segmentEditorSessionCache = new Map();
const segmentEditorSessionInFlight = new Map();
const segmentEditorVoiceoverDurationCache = new Map();
const readId3v2TagSize = (buffer) => {
    if (buffer.length < 10 || buffer.toString("ascii", 0, 3) !== "ID3") {
        return 0;
    }
    const size = ((buffer[6] & 0x7f) << 21) |
        ((buffer[7] & 0x7f) << 14) |
        ((buffer[8] & 0x7f) << 7) |
        (buffer[9] & 0x7f);
    const hasFooter = (buffer[5] & 0x10) !== 0;
    return Math.min(buffer.length, 10 + size + (hasFooter ? 10 : 0));
};
const MPEG_SAMPLE_RATES = {
    0: [11025, 12000, 8000],
    2: [22050, 24000, 16000],
    3: [44100, 48000, 32000],
};
const MPEG_BITRATES_KBPS = {
    "1:1": [32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    "1:2": [32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    "1:3": [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    "2:1": [32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    "2:2": [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    "2:3": [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const getMpegFrameInfo = (buffer, offset) => {
    if (offset + 4 > buffer.length) {
        return null;
    }
    const header = buffer.readUInt32BE(offset);
    if (((header & 0xffe00000) >>> 0) !== 0xffe00000) {
        return null;
    }
    const versionBits = (header >> 19) & 0x3;
    const layerBits = (header >> 17) & 0x3;
    const bitrateIndex = (header >> 12) & 0xf;
    const sampleRateIndex = (header >> 10) & 0x3;
    const padding = (header >> 9) & 0x1;
    if (versionBits === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 0xf || sampleRateIndex === 3) {
        return null;
    }
    const layer = 4 - layerBits;
    const versionGroup = versionBits === 3 ? 1 : 2;
    const sampleRate = MPEG_SAMPLE_RATES[versionBits]?.[sampleRateIndex] ?? null;
    const bitrateKbps = MPEG_BITRATES_KBPS[`${versionGroup}:${layer}`]?.[bitrateIndex - 1] ?? null;
    if (!sampleRate || !bitrateKbps) {
        return null;
    }
    const samplesPerFrame = layer === 1 ? 384 : layer === 3 && versionBits !== 3 ? 576 : 1152;
    const frameLength = layer === 1
        ? Math.floor(((12 * bitrateKbps * 1000) / sampleRate + padding) * 4)
        : Math.floor((((layer === 3 && versionBits !== 3 ? 72 : 144) * bitrateKbps * 1000) / sampleRate) + padding);
    if (frameLength <= 4) {
        return null;
    }
    return {
        frameLength,
        sampleRate,
        samplesPerFrame,
    };
};
const readMp3DurationSeconds = (buffer) => {
    let offset = readId3v2TagSize(buffer);
    let durationSeconds = 0;
    let frameCount = 0;
    while (offset + 4 <= buffer.length) {
        const frameInfo = getMpegFrameInfo(buffer, offset);
        if (!frameInfo) {
            const nextSyncOffset = buffer.indexOf(0xff, offset + 1);
            if (nextSyncOffset < 0) {
                break;
            }
            offset = nextSyncOffset;
            continue;
        }
        durationSeconds += frameInfo.samplesPerFrame / frameInfo.sampleRate;
        frameCount += 1;
        offset += frameInfo.frameLength;
    }
    return frameCount > 0 && Number.isFinite(durationSeconds) ? durationSeconds : null;
};
const readWavDurationSeconds = (buffer) => {
    if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
        return null;
    }
    let offset = 12;
    let byteRate = null;
    let dataSize = 0;
    while (offset + 8 <= buffer.length) {
        const chunkId = buffer.toString("ascii", offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);
        const chunkStart = offset + 8;
        if (chunkStart + chunkSize > buffer.length) {
            break;
        }
        if (chunkId === "fmt " && chunkSize >= 16) {
            byteRate = buffer.readUInt32LE(chunkStart + 8);
        }
        else if (chunkId === "data") {
            dataSize += chunkSize;
        }
        offset = chunkStart + chunkSize + (chunkSize % 2);
    }
    return byteRate && dataSize > 0 && byteRate > 0 ? dataSize / byteRate : null;
};
export const readWorkspaceAudioDurationSecondsFromBuffer = (buffer) => {
    const isWav = buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE";
    const durationSeconds = isWav
        ? readWavDurationSeconds(buffer) ?? readMp3DurationSeconds(buffer)
        : readMp3DurationSeconds(buffer) ?? readWavDurationSeconds(buffer);
    return durationSeconds !== null && Number.isFinite(durationSeconds) && durationSeconds > 0
        ? Math.round(durationSeconds * 1000) / 1000
        : null;
};
const getProjectAccessCacheKey = (user, projectId) => {
    const userId = normalizeText(user.id);
    if (userId) {
        return `user:${userId}:project:${projectId}`;
    }
    const email = normalizeText(user.email).toLowerCase();
    return email ? `email:${email}:project:${projectId}` : null;
};
const hasCachedProjectAccess = (user, projectId) => {
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
const cacheProjectAccess = (user, projectId) => {
    const cacheKey = getProjectAccessCacheKey(user, projectId);
    if (!cacheKey) {
        return;
    }
    projectAccessCache.set(cacheKey, Date.now() + PROJECT_ACCESS_CACHE_TTL_MS);
};
const clearCachedProjectAccess = (user, projectId) => {
    const exactCacheKey = typeof projectId === "number" && Number.isFinite(projectId) && projectId > 0
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
const getSegmentEditorSessionCacheKey = (user, projectId) => {
    const userId = normalizeText(user.id);
    if (userId) {
        return `user:${userId}:segment-editor:${projectId}`;
    }
    const email = normalizeText(user.email).toLowerCase();
    return email ? `email:${email}:segment-editor:${projectId}` : null;
};
const getCachedSegmentEditorSession = (user, projectId) => {
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
const setCachedSegmentEditorSession = (user, projectId, session) => {
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
const getSegmentEditorVoiceoverDurationCacheKey = (projectId, segmentIndex) => `${projectId}:${segmentIndex}`;
const getSegmentEditorVoiceoverAssetDurationCacheKey = (assetId) => `asset:${assetId}`;
const readCachedSegmentEditorVoiceoverDuration = (projectId, segmentIndex) => {
    const cachedEntry = segmentEditorVoiceoverDurationCache.get(getSegmentEditorVoiceoverDurationCacheKey(projectId, segmentIndex));
    if (!cachedEntry) {
        return null;
    }
    if (cachedEntry.expiresAt <= Date.now()) {
        segmentEditorVoiceoverDurationCache.delete(getSegmentEditorVoiceoverDurationCacheKey(projectId, segmentIndex));
        return null;
    }
    return cachedEntry.durationSeconds;
};
const readCachedSegmentEditorVoiceoverAssetDuration = (assetId) => {
    const cachedEntry = segmentEditorVoiceoverDurationCache.get(getSegmentEditorVoiceoverAssetDurationCacheKey(assetId));
    if (!cachedEntry) {
        return null;
    }
    if (cachedEntry.expiresAt <= Date.now()) {
        segmentEditorVoiceoverDurationCache.delete(getSegmentEditorVoiceoverAssetDurationCacheKey(assetId));
        return null;
    }
    return cachedEntry.durationSeconds;
};
const writeCachedSegmentEditorVoiceoverDuration = (projectId, segmentIndex, durationSeconds) => {
    segmentEditorVoiceoverDurationCache.set(getSegmentEditorVoiceoverDurationCacheKey(projectId, segmentIndex), {
        durationSeconds,
        expiresAt: Date.now() + SEGMENT_EDITOR_VOICEOVER_DURATION_CACHE_TTL_MS,
    });
};
const writeCachedSegmentEditorVoiceoverAssetDuration = (assetId, durationSeconds) => {
    segmentEditorVoiceoverDurationCache.set(getSegmentEditorVoiceoverAssetDurationCacheKey(assetId), {
        durationSeconds,
        expiresAt: Date.now() + SEGMENT_EDITOR_VOICEOVER_DURATION_CACHE_TTL_MS,
    });
};
const fetchWorkspaceProjectSegmentVoiceoverDuration = async (projectId, segmentIndex) => {
    const cachedDurationSeconds = readCachedSegmentEditorVoiceoverDuration(projectId, segmentIndex);
    if (cachedDurationSeconds !== null) {
        return cachedDurationSeconds;
    }
    const response = await fetchUpstreamResponse(buildAdsflowUrl(`/api/projects/${projectId}/segments/${segmentIndex}/voiceover`), {
        headers: {
            "X-Admin-Token": env.adsflowAdminToken ?? "",
        },
        signal: AbortSignal.timeout(SEGMENT_EDITOR_VOICEOVER_DURATION_FETCH_TIMEOUT_MS),
    }, upstreamPolicies.proxyInteractive, {
        assetKind: "segment-voiceover-duration",
        endpoint: "segment-editor.segment-voiceover-duration",
        projectId,
    });
    if (!response.ok) {
        void response.body?.cancel();
        return null;
    }
    const durationSeconds = readWorkspaceAudioDurationSecondsFromBuffer(Buffer.from(await response.arrayBuffer()));
    if (durationSeconds !== null) {
        writeCachedSegmentEditorVoiceoverDuration(projectId, segmentIndex, durationSeconds);
    }
    return durationSeconds;
};
const fetchWorkspaceVoiceoverAssetDuration = async (assetId, projectId) => {
    const cachedDurationSeconds = readCachedSegmentEditorVoiceoverAssetDuration(assetId);
    if (cachedDurationSeconds !== null) {
        return cachedDurationSeconds;
    }
    const response = await fetchUpstreamResponse(buildAdsflowUrl(`/api/media/${assetId}/download`, {
        admin_token: env.adsflowAdminToken ?? "",
    }), {
        signal: AbortSignal.timeout(SEGMENT_EDITOR_VOICEOVER_DURATION_FETCH_TIMEOUT_MS),
    }, upstreamPolicies.proxyInteractive, {
        assetKind: "segment-voiceover-asset-duration",
        endpoint: "segment-editor.segment-voiceover-asset-duration",
        projectId,
    });
    if (!response.ok) {
        void response.body?.cancel();
        return null;
    }
    const durationSeconds = readWorkspaceAudioDurationSecondsFromBuffer(Buffer.from(await response.arrayBuffer()));
    if (durationSeconds !== null) {
        writeCachedSegmentEditorVoiceoverAssetDuration(assetId, durationSeconds);
    }
    return durationSeconds;
};
export async function getWorkspaceProjectSegmentVoiceoverDuration(user, options) {
    assertAdsflowConfigured();
    await assertWorkspaceProjectAccess(user, options.projectId);
    return fetchWorkspaceProjectSegmentVoiceoverDuration(options.projectId, options.segmentIndex);
}
const enrichWorkspaceSegmentEditorSessionWithVoiceoverDurations = async (session) => {
    if (!session.segments.length) {
        return session;
    }
    const projectVoiceoverSegmentsNeedingMeasurement = !session.voiceType || session.voiceType === "none" || session.ttsAssetId === null
        ? []
        : session.segments.filter((segment) => (hasSegmentEditorAuthoritativeSpeechTiming(segment) &&
            normalizeNumber(segment.speechDuration) === null));
    const voiceoverAssetSegmentsNeedingMeasurement = session.segments.filter((segment) => {
        const assetId = normalizePositiveProjectId(segment.voiceoverAssetId ?? segment.voiceover?.media_asset_id);
        return (assetId !== null &&
            assetId !== session.ttsAssetId &&
            segment.voiceover !== null &&
            normalizeText(segment.voiceover.mime_type).toLowerCase().startsWith("audio/") &&
            segment.speechDurationSource !== "audio");
    });
    if (projectVoiceoverSegmentsNeedingMeasurement.length === 0 && voiceoverAssetSegmentsNeedingMeasurement.length === 0) {
        return session;
    }
    const measuredProjectVoiceoverDurations = await Promise.all(projectVoiceoverSegmentsNeedingMeasurement.map(async (segment) => {
        try {
            const durationSeconds = await fetchWorkspaceProjectSegmentVoiceoverDuration(session.projectId, segment.index);
            return [segment.index, durationSeconds];
        }
        catch (error) {
            console.warn("[segment-editor] Failed to measure segment voiceover duration", {
                error: error instanceof Error ? error.message : String(error),
                projectId: session.projectId,
                segmentIndex: segment.index,
            });
            return [segment.index, null];
        }
    }));
    const measuredVoiceoverAssetDurations = await Promise.all(voiceoverAssetSegmentsNeedingMeasurement.map(async (segment) => {
        const assetId = normalizePositiveProjectId(segment.voiceoverAssetId ?? segment.voiceover?.media_asset_id);
        if (assetId === null) {
            return [segment.index, null];
        }
        try {
            const durationSeconds = await fetchWorkspaceVoiceoverAssetDuration(assetId, session.projectId);
            return [segment.index, durationSeconds];
        }
        catch (error) {
            console.warn("[segment-editor] Failed to measure segment voiceover asset duration", {
                assetId,
                error: error instanceof Error ? error.message : String(error),
                projectId: session.projectId,
                segmentIndex: segment.index,
            });
            return [segment.index, null];
        }
    }));
    const durationBySegmentIndex = new Map([
        ...measuredProjectVoiceoverDurations,
        ...measuredVoiceoverAssetDurations,
    ].filter((entry) => entry[1] !== null));
    if (durationBySegmentIndex.size === 0) {
        return session;
    }
    return {
        ...session,
        segments: session.segments.map((segment) => {
            const durationSeconds = durationBySegmentIndex.get(segment.index);
            if (!durationSeconds) {
                return segment;
            }
            const speechWordsRange = getSegmentEditorSpeechWordsRange(segment);
            const speechStartTime = normalizeNumber(segment.voiceSourceStartTime) ??
                normalizeNumber(segment.speechStartTime) ??
                speechWordsRange?.startTime ??
                segment.startTime;
            const voiceSourceDuration = Math.max(normalizeNumber(segment.voiceSourceDuration) ?? 0, durationSeconds);
            return {
                ...segment,
                speechDuration: durationSeconds,
                speechDurationSource: "audio",
                speechEndTime: speechStartTime + durationSeconds,
                speechStartTime,
                voiceSourceDuration,
            };
        }),
    };
};
export const invalidateWorkspaceSegmentEditorSessionCache = (user, projectId) => {
    clearCachedProjectAccess(user, projectId);
    if (typeof projectId === "number" && Number.isFinite(projectId) && projectId > 0) {
        const voiceoverDurationCachePrefix = `${projectId}:`;
        for (const key of segmentEditorVoiceoverDurationCache.keys()) {
            if (key.startsWith(voiceoverDurationCachePrefix)) {
                segmentEditorVoiceoverDurationCache.delete(key);
            }
        }
    }
    const exactCacheKey = typeof projectId === "number" && Number.isFinite(projectId) && projectId > 0
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
const withTimeout = async (promise, timeoutMs, errorMessage) => {
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(errorMessage));
        }, timeoutMs);
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    }
    finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
};
const createEmptyProjectMediaEnvelope = (projectId) => ({
    assets: [],
    loaded: false,
    projectId,
});
const withOptionalSegmentEditorContextTimeout = async (promise, fallback, timeoutMs, options) => {
    let timeoutId = null;
    const timeoutPromise = new Promise((resolve) => {
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
    }
    finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
};
const resolveOptionalSegmentEditorContext = async (projectId, projectDetailsPromise, projectMediaPromise, timeoutMs) => {
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
const shouldLoadSourceSegmentEditorPayload = (payload, projectDetailsPayload) => {
    const sourceProjectId = getProjectDetailsSourceProjectId(projectDetailsPayload);
    if (!sourceProjectId || normalizePositiveProjectId(payload.project_id) === sourceProjectId) {
        return null;
    }
    const needsTts = normalizePositiveProjectId(payload.tts_asset_id) === null;
    const needsMusic = normalizePositiveProjectId(payload.music_asset_id) === null;
    const needsSourceVoiceRanges = Boolean(normalizeText(payload.voice_type)) &&
        (payload.segments ?? []).some((segment) => {
            const durationMode = normalizeSegmentDurationMode(segment?.duration_mode);
            return durationMode === "manual" || normalizeManualDurationSeconds(segment?.manual_duration_seconds) !== null;
        });
    return needsTts || needsMusic || needsSourceVoiceRanges ? sourceProjectId : null;
};
const loadSourceSegmentEditorPayload = async (projectId, sourceProjectId) => {
    try {
        return await withOptionalSegmentEditorContextTimeout(fetchAdsflowJsonWithPolicy({
            context: {
                endpoint: "segment-editor.source-session",
                projectId: sourceProjectId,
            },
            init: {
                headers: {
                    "X-Admin-Token": env.adsflowAdminToken ?? "",
                },
            },
            path: `/api/projects/${sourceProjectId}/segment-editor`,
            policy: upstreamPolicies.adsflowMetadata,
        }), null, SEGMENT_EDITOR_OPTIONAL_CONTEXT_TIMEOUT_MS, {
            label: "source-segment-editor",
            projectId,
        });
    }
    catch (error) {
        console.warn("[segment-editor] Failed to load source segment editor audio metadata", {
            error: error instanceof Error ? error.message : String(error),
            projectId,
            sourceProjectId,
        });
        return null;
    }
};
const assertWorkspaceProjectAccess = async (user, projectId) => {
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
    let projects;
    try {
        projects = await withTimeout(getWorkspaceProjects(user), PROJECT_ACCESS_FALLBACK_TIMEOUT_MS, PROJECT_ACCESS_TIMEOUT_ERROR_MESSAGE);
    }
    catch (error) {
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
const buildWorkspaceSegmentEditorVideoUrl = (projectId, segmentIndex, source, delivery, marker) => {
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
const buildWorkspaceSegmentEditorPosterUrl = (projectId, segmentIndex, source, marker) => {
    const posterUrl = new URL("/api/workspace/project-segment-poster", env.appUrl);
    posterUrl.searchParams.set("projectId", String(projectId));
    posterUrl.searchParams.set("segmentIndex", String(segmentIndex));
    posterUrl.searchParams.set("source", source);
    if (marker) {
        posterUrl.searchParams.set("v", marker);
    }
    return `${posterUrl.pathname}${posterUrl.search}`;
};
const buildWorkspaceMediaAssetPosterUrl = (asset) => {
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
const isWorkspaceSegmentTimelineFallbackEntry = (entry) => {
    const source = normalizeText(entry?.source).toLowerCase();
    const sourceKind = normalizeText(entry?.source_kind).toLowerCase();
    const role = normalizeText(entry?.role || entry?.link_role || entry?.kind || entry?.asset_kind).toLowerCase();
    return (source === "final_video" ||
        source === "project_background" ||
        source === "combined_background" ||
        sourceKind === "final_video" ||
        role === "final_video" ||
        role === "combined_background");
};
const buildWorkspaceSegmentPosterUrl = (projectId, segmentIndex, source, asset, entry, marker) => {
    if (isWorkspaceSegmentTimelineFallbackEntry(entry)) {
        return buildWorkspaceSegmentEditorPosterUrl(projectId, segmentIndex, source, marker);
    }
    return buildWorkspaceMediaAssetPosterUrl(asset);
};
const getWorkspaceSegmentEditorPayloadSourceDurationSeconds = (payload) => normalizeManualDurationSeconds(payload.durationExtensionSourceDurationSeconds) ??
    normalizeManualDurationSeconds(payload.duration_extension_source_duration_seconds) ??
    normalizeManualDurationSeconds(payload.sourceDurationSeconds) ??
    normalizeManualDurationSeconds(payload.source_duration_seconds);
const getWorkspaceProjectMediaEntryDurationSeconds = (entry) => {
    if (!entry || isWorkspaceSegmentTimelineFallbackEntry(entry)) {
        return null;
    }
    return (normalizeManualDurationSeconds(entry.durationSeconds) ??
        normalizeManualDurationSeconds(entry.duration_seconds) ??
        normalizeManualDurationSeconds(entry.duration));
};
export const buildWorkspaceSegmentEditorSessionFromPayload = (requestedProjectId, payload, options = {}) => {
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
    const generationSettings = projectDetailsPayload?.generation_settings && typeof projectDetailsPayload.generation_settings === "object"
        ? projectDetailsPayload.generation_settings
        : null;
    const originalEntries = getProjectOriginalMediaEntries(projectDetailsPayload);
    const currentEntries = getProjectCurrentMediaEntries(projectDetailsPayload, originalEntries);
    const sceneSoundEntries = pickProjectMediaEntries(generationSettings?.segment_scene_sounds);
    const projectMediaByAssetId = buildProjectMediaAssetIndex(projectMediaEnvelope.assets);
    const segments = (payload.segments ?? [])
        .map((segment) => buildWorkspaceSegmentEditorSegment(sessionProjectId, segment, {
        currentEntries,
        projectMediaAssets: projectMediaEnvelope.assets,
        projectMediaLoaded: projectMediaEnvelope.loaded,
        projectMediaByAssetId,
        originalEntries,
        sceneSoundEntries,
    }))
        .filter((segment) => Boolean(segment))
        .sort((left, right) => left.index - right.index);
    if (segments.length < WORKSPACE_SEGMENT_EDITOR_MIN_SEGMENTS) {
        throw new WorkspaceSegmentEditorError("Для этого проекта пока нет данных сегментов.", 409);
    }
    if (segments.length > WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS) {
        throw new WorkspaceSegmentEditorError(`Редактор сегментов пока поддерживает проекты до ${WORKSPACE_SEGMENT_EDITOR_MAX_SEGMENTS} сегментов.`, 409);
    }
    const customMusicMetadata = resolveWorkspaceSegmentEditorCustomMusicMetadata(projectDetailsPayload);
    const musicAssetId = normalizePositiveProjectId(payload.music_asset_id) ??
        normalizePositiveProjectId(projectDetailsPayload?.music_asset_id) ??
        normalizePositiveProjectId(generationSettings?.music_asset_id) ??
        normalizePositiveProjectId(generationSettings?.custom_music_asset_id) ??
        null;
    const musicType = normalizeText(payload.music_type) ||
        normalizeText(projectDetailsPayload?.music_type) ||
        normalizeText(generationSettings?.music_type) ||
        (customMusicMetadata.customMusicAssetId ? "custom" : musicAssetId ? "ai" : "");
    const ttsAssetId = normalizePositiveProjectId(payload.tts_asset_id) ??
        normalizePositiveProjectId(projectDetailsPayload?.tts_asset_id) ??
        normalizePositiveProjectId(generationSettings?.tts_asset_id) ??
        null;
    const finalVideoAssetId = normalizePositiveProjectId(projectDetailsPayload?.final_video_asset_id) ??
        normalizePositiveProjectId(generationSettings?.final_video_asset_id) ??
        normalizePositiveProjectId(generationSettings?.final_asset_id) ??
        null;
    return {
        customMusicAssetId: customMusicMetadata.customMusicAssetId,
        customMusicFileName: customMusicMetadata.customMusicFileName,
        description: normalizeText(payload.description),
        finalVideoAssetId,
        finalVideoInvalidatedAt: normalizeText(generationSettings?.final_video_invalidated_at) || null,
        finalVideoStale: normalizeBooleanFlag(generationSettings?.final_video_stale),
        language: resolveWorkspaceSegmentEditorLanguage(payload, projectDetailsPayload),
        musicAssetId,
        musicName: normalizeText(payload.music_name) ||
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
export const buildWorkspaceSegmentEditorSegment = (projectId, payload, projectSources) => {
    const index = normalizeInteger(payload.index);
    if (index === null) {
        return null;
    }
    const startTime = normalizeNumber(payload.start_time) ?? 0;
    const endTime = normalizeNumber(payload.end_time) ?? Math.max(startTime, startTime + (normalizeNumber(payload.duration) ?? 0));
    const duration = normalizeNumber(payload.duration) ?? Math.max(0, endTime - startTime);
    const durationMode = normalizeSegmentDurationMode(payload.duration_mode);
    const manualDurationSeconds = normalizeManualDurationSeconds(payload.manual_duration_seconds) ??
        (durationMode === "manual" ? normalizeManualDurationSeconds(duration) : null);
    const speechStartTime = normalizeNumber(payload.speech_start_time);
    const speechEndTime = normalizeNumber(payload.speech_end_time);
    const speechDuration = normalizeNumber(payload.speech_duration) ??
        (speechStartTime !== null && speechEndTime !== null ? Math.max(0, speechEndTime - speechStartTime) : null);
    const payloadRecord = payload;
    const voiceSourceStartTime = pickSegmentEditorVoiceSourceStartTime(payloadRecord);
    const voiceSourceEndTime = pickSegmentEditorVoiceSourceEndTime(payloadRecord);
    const voiceSourceDuration = pickSegmentEditorVoiceSourceDuration(payloadRecord) ??
        (voiceSourceStartTime !== null && voiceSourceEndTime !== null
            ? Math.max(0, voiceSourceEndTime - voiceSourceStartTime)
            : null);
    const normalizedVoiceSourceDuration = voiceSourceDuration !== null ? Math.max(0, Number(voiceSourceDuration.toFixed(3))) : null;
    const speechWords = normalizeSpeechWords(payload.speech_words);
    const currentVideoMarker = normalizeText(payload.current_video);
    const originalVideoMarker = normalizeText(payload.original_video);
    const hasCurrentVideo = Boolean(currentVideoMarker);
    const hasOriginalVideo = Boolean(originalVideoMarker);
    const currentEntry = projectSources?.currentEntries[index] ?? null;
    const explicitOriginalEntry = projectSources?.originalEntries[index] ?? null;
    const originalEntry = explicitOriginalEntry ??
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
    const durationExtensionSourceDurationSeconds = resolvedMediaType === "video"
        ? getWorkspaceSegmentEditorPayloadSourceDurationSeconds(payload) ??
            getWorkspaceProjectMediaEntryDurationSeconds(currentEntry) ??
            getWorkspaceProjectMediaEntryDurationSeconds(originalEntry)
        : null;
    const explicitSceneSound = buildWorkspaceSegmentSceneSoundRef(payload.scene_sound);
    const projectSceneSoundEntry = findProjectSceneSoundMediaEntry([
        ...(projectSources?.sceneSoundEntries ?? []),
        ...(projectSources?.currentEntries ?? []),
        ...(projectSources?.originalEntries ?? []),
    ], index);
    const projectSceneSoundAsset = findProjectSceneSoundMediaAsset(projectMediaAssets, index);
    const sceneSound = explicitSceneSound ??
        buildWorkspaceSegmentSceneSoundRef(projectSceneSoundEntry) ??
        buildWorkspaceSegmentSceneSoundRefFromAsset(projectSceneSoundAsset);
    const sceneSoundAssetId = normalizePositiveProjectId(payload.scene_sound_asset_id) ??
        sceneSound?.media_asset_id ??
        normalizePositiveProjectId(projectSceneSoundAsset?.assetId) ??
        null;
    const explicitVoiceover = buildWorkspaceSegmentSceneSoundRef(payload.voiceover);
    const projectVoiceoverEntry = findProjectVoiceoverMediaEntry([
        ...(projectSources?.currentEntries ?? []),
        ...(projectSources?.originalEntries ?? []),
    ], index);
    const projectVoiceoverAsset = findProjectVoiceoverMediaAsset(projectMediaAssets, index);
    const voiceover = explicitVoiceover ??
        buildWorkspaceSegmentSceneSoundRef(projectVoiceoverEntry) ??
        buildWorkspaceSegmentSceneSoundRefFromAsset(projectVoiceoverAsset);
    const voiceoverAssetId = normalizePositiveProjectId(payload.voiceover_asset_id) ??
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
        durationExtensionSourceDurationSeconds,
        duration_extension_source_duration_seconds: durationExtensionSourceDurationSeconds,
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
        speechDurationSource: null,
        speechEndTime: speechStartTime !== null && speechEndTime !== null ? Math.max(speechStartTime, speechEndTime) : null,
        speechStartTime: speechStartTime !== null ? Math.max(0, speechStartTime) : null,
        speechWords,
        startTime,
        voiceSourceDuration: normalizedVoiceSourceDuration,
        voiceSourceEndTime: voiceSourceStartTime !== null && voiceSourceEndTime !== null
            ? Math.max(voiceSourceStartTime, voiceSourceEndTime)
            : null,
        voiceSourceStartTime: voiceSourceStartTime !== null ? Math.max(0, voiceSourceStartTime) : null,
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
const loadWorkspaceSegmentEditorSession = async (projectId) => {
    assertAdsflowConfigured();
    let payload = null;
    let projectDetailsPayload = null;
    let projectMediaEnvelope = createEmptyProjectMediaEnvelope(projectId);
    const projectDetailsPromise = fetchAdsflowJsonWithPolicy({
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
        payload = await fetchAdsflowJsonWithPolicy({
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
        const optionalContext = await resolveOptionalSegmentEditorContext(projectId, projectDetailsPromise, projectMediaPromise, SEGMENT_EDITOR_OPTIONAL_CONTEXT_TIMEOUT_MS);
        projectDetailsPayload = optionalContext.projectDetailsPayload;
        projectMediaEnvelope = optionalContext.projectMediaEnvelope;
    }
    catch (error) {
        if (error instanceof UpstreamFetchError && error.isTimeout) {
            projectDetailsPayload = await withOptionalSegmentEditorContextTimeout(projectDetailsPromise, null, SEGMENT_EDITOR_FALLBACK_CONTEXT_TIMEOUT_MS, {
                label: "project-details-timeout-fallback",
                projectId,
            });
            const fallbackPayload = buildSegmentEditorPayloadFromProjectDetails(projectId, projectDetailsPayload);
            if (fallbackPayload) {
                console.warn("[segment-editor] Using project details fallback after upstream timeout", {
                    projectId,
                    segmentCount: fallbackPayload.segments?.length ?? 0,
                });
                payload = fallbackPayload;
                projectMediaEnvelope = await withOptionalSegmentEditorContextTimeout(projectMediaPromise, createEmptyProjectMediaEnvelope(projectId), SEGMENT_EDITOR_OPTIONAL_CONTEXT_TIMEOUT_MS, {
                    label: "project-media-timeout-fallback",
                    projectId,
                });
            }
            else {
                throw new WorkspaceSegmentEditorError(SEGMENT_EDITOR_TIMEOUT_ERROR_MESSAGE, 504);
            }
        }
        if (error instanceof UpstreamHttpError && error.statusCode === 404) {
            throw new WorkspaceSegmentEditorError("Для этого проекта сегменты пока недоступны.", 404);
        }
        if (error instanceof UpstreamHttpError && error.statusCode === 409) {
            projectDetailsPayload = await withOptionalSegmentEditorContextTimeout(projectDetailsPromise, null, SEGMENT_EDITOR_FALLBACK_CONTEXT_TIMEOUT_MS, {
                label: "project-details-preparing-fallback",
                projectId,
            });
            const fallbackPayload = buildSegmentEditorPayloadFromProjectDetails(projectId, projectDetailsPayload);
            if (fallbackPayload) {
                console.warn("[segment-editor] Using project details fallback after upstream preparing response", {
                    projectId,
                    segmentCount: fallbackPayload.segments?.length ?? 0,
                });
                payload = fallbackPayload;
                projectMediaEnvelope = await withOptionalSegmentEditorContextTimeout(projectMediaPromise, createEmptyProjectMediaEnvelope(projectId), SEGMENT_EDITOR_OPTIONAL_CONTEXT_TIMEOUT_MS, {
                    label: "project-media-preparing-fallback",
                    projectId,
                });
            }
            else {
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
    const sourceProjectId = shouldLoadSourceSegmentEditorPayload(payload, projectDetailsPayload);
    const sourcePayload = sourceProjectId !== null ? await loadSourceSegmentEditorPayload(projectId, sourceProjectId) : null;
    payload = hydrateSegmentEditorPayloadWithInheritedAudio(payload, projectDetailsPayload, sourcePayload);
    const session = buildWorkspaceSegmentEditorSessionFromPayload(projectId, payload, {
        projectDetailsPayload,
        projectMediaEnvelope,
    });
    return enrichWorkspaceSegmentEditorSessionWithVoiceoverDurations(session);
};
const getWorkspaceSegmentEditorSessionInternal = async (user, projectId, options) => {
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
    }
    finally {
        if (shouldTrackInFlight && cacheKey) {
            segmentEditorSessionInFlight.delete(cacheKey);
        }
    }
};
export async function getWorkspaceSegmentEditorSession(user, projectId, options) {
    return getWorkspaceSegmentEditorSessionInternal(user, projectId, {
        bypassCache: options?.bypassCache,
    });
}
export async function getWorkspaceSegmentEditorSessionForAccessibleProject(user, projectId, options) {
    return getWorkspaceSegmentEditorSessionInternal(user, projectId, {
        bypassCache: options?.bypassCache,
        skipProjectAccessCheck: true,
    });
}
export async function getWorkspaceProjectSegmentVideoProxyTarget(user, options) {
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
export async function getWorkspaceProjectMusicAudioProxyTarget(user, options) {
    assertAdsflowConfigured();
    await assertWorkspaceProjectAccess(user, options.projectId);
    const musicName = normalizeWorkspaceProjectMusicFileName(options.musicName);
    if (musicName) {
        return {
            headers: {},
            url: buildAdsflowUrl(`/api/music/${encodeURIComponent(musicName)}`, {
                admin_token: env.adsflowAdminToken ?? "",
            }),
        };
    }
    return {
        headers: {
            "X-Admin-Token": env.adsflowAdminToken ?? "",
        },
        url: buildAdsflowUrl(`/api/projects/${options.projectId}/audio/music`),
    };
}
export async function getWorkspaceProjectSegmentVoiceoverProxyTarget(user, options) {
    assertAdsflowConfigured();
    await assertWorkspaceProjectAccess(user, options.projectId);
    return {
        headers: {
            "X-Admin-Token": env.adsflowAdminToken ?? "",
        },
        url: buildAdsflowUrl(`/api/projects/${options.projectId}/segments/${options.segmentIndex}/voiceover`),
    };
}
export async function getWorkspaceProjectSegmentVideoAsset(user, options) {
    void user;
    void options;
    return null;
}
