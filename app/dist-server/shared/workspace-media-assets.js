const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeWorkspaceMediaAssetToken = (value) => normalizeText(value).toLowerCase();
const normalizeWorkspaceMediaAssetBoolean = (value) => {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        return value === 1;
    }
    const normalized = normalizeWorkspaceMediaAssetToken(value);
    if (normalized === "true" || normalized === "1") {
        return true;
    }
    if (normalized === "false" || normalized === "0") {
        return false;
    }
    return null;
};
export const isWorkspaceNonAiRenderedPhotoVideoAsset = (asset) => {
    const mediaType = normalizeWorkspaceMediaAssetToken(asset?.mediaType);
    const mimeType = normalizeWorkspaceMediaAssetToken(asset?.mimeType);
    if (mediaType !== "video" && !mimeType.startsWith("video/")) {
        return false;
    }
    const renderedAnimationMode = normalizeWorkspaceMediaAssetToken(asset?.renderedAnimationMode ??
        asset?.rendered_animation_mode);
    const renderedViaI2v = normalizeWorkspaceMediaAssetBoolean(asset?.renderedViaI2v ??
        asset?.rendered_via_i2v);
    const signature = [
        asset?.kind,
        asset?.libraryKind,
        asset?.role,
        asset?.sourceKind,
        asset?.storageKey,
        asset?.downloadPath,
        asset?.downloadUrl,
        asset?.originalUrl,
    ]
        .map(normalizeWorkspaceMediaAssetToken)
        .filter(Boolean)
        .join(" ");
    const libraryKind = normalizeWorkspaceMediaAssetToken(asset?.libraryKind);
    const isRenderedSegment = signature.includes("rendered_segment") ||
        signature.includes("current_rendered_segment") ||
        signature.includes("/rendered_segment/");
    const hasPhotoMarker = libraryKind === "photo_animation" ||
        libraryKind === "ai_photo" ||
        signature.includes("photo_animation") ||
        signature.includes("photo-animation") ||
        signature.includes("source_ai_image") ||
        signature.includes("ai_photo") ||
        signature.includes("ai-photo");
    const hasGeneratedVideoMarker = renderedViaI2v === true ||
        renderedAnimationMode === "i2v";
    // A rendered segment is the delivery MP4 for a photo and may contain only
    // synthetic camera movement. Treat it as AI video only when the asset keeps
    // positive image-to-video provenance; absence of that provenance is not AI.
    return isRenderedSegment && hasPhotoMarker && !hasGeneratedVideoMarker;
};
const normalizeIsoString = (value) => {
    const normalized = normalizeText(value);
    if (!normalized) {
        return null;
    }
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
};
const isExpiredIsoString = (value) => {
    if (!value) {
        return false;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && parsed <= Date.now();
};
export const resolveWorkspaceMediaAssetLifecycle = (options) => {
    const deletedAt = normalizeIsoString(options.deletedAt);
    if (deletedAt) {
        return "deleted";
    }
    const expiresAt = normalizeIsoString(options.expiresAt);
    if (isExpiredIsoString(expiresAt)) {
        return "expired";
    }
    const status = normalizeText(options.status).toLowerCase();
    switch (status) {
        case "uploading":
            return "uploading";
        case "queued":
        case "pending":
        case "processing":
        case "rendering":
            return "processing";
        case "ready":
        case "completed":
        case "done":
            return "ready";
        case "failed":
        case "error":
            return "failed";
        case "deleted":
            return "deleted";
        case "expired":
            return "expired";
        default: {
            const downloadPath = normalizeText(options.downloadPath);
            const downloadUrl = normalizeText(options.downloadUrl);
            return downloadPath || downloadUrl ? "ready" : "unavailable";
        }
    }
};
export const isWorkspaceMediaAssetReady = (asset) => asset.lifecycle === "ready" && Boolean(normalizeText(asset.downloadPath) || normalizeText(asset.downloadUrl));
