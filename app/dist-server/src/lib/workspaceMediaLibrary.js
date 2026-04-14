const FALLBACK_WORKSPACE_DOWNLOAD_NAME = "adshorts-video";
export const normalizeWorkspaceMediaLibraryCreatedAt = (value) => {
    const timestamp = typeof value === "number"
        ? value
        : typeof value === "string"
            ? Date.parse(value)
            : Number.NaN;
    return Number.isFinite(timestamp) ? Math.max(0, Math.trunc(timestamp)) : 0;
};
export const sortWorkspaceMediaLibraryItemsNewestFirst = (items) => items.slice().sort((left, right) => {
    const createdAtDifference = right.createdAt - left.createdAt;
    if (createdAtDifference !== 0) {
        return createdAtDifference;
    }
    const projectIdDifference = right.projectId - left.projectId;
    if (projectIdDifference !== 0) {
        return projectIdDifference;
    }
    return 0;
});
export const getWorkspaceProjectDisplayTitle = (project) => {
    const normalizedTitle = project.title.trim();
    if (normalizedTitle) {
        return normalizedTitle;
    }
    if (project.adId !== null) {
        return `Проект #${project.adId}`;
    }
    if (project.jobId) {
        return `Job ${project.jobId.slice(0, 8)}`;
    }
    return "Без названия";
};
export const getWorkspaceDownloadBaseName = (value) => {
    const normalizedValue = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, "-")
        .replace(/^-+|-+$/g, "");
    return normalizedValue || FALLBACK_WORKSPACE_DOWNLOAD_NAME;
};
export const getWorkspaceVideoDownloadName = (value) => `${getWorkspaceDownloadBaseName(value)}.mp4`;
export const getWorkspaceImageDownloadName = (value) => `${getWorkspaceDownloadBaseName(value)}.jpg`;
const hashWorkspaceMediaLibraryValue = (value) => {
    let hash = 5381;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 33) ^ value.charCodeAt(index);
    }
    return (hash >>> 0).toString(36);
};
export const getWorkspaceMediaLibraryUrlMarker = (value) => {
    const normalizedValue = String(value ?? "").trim();
    if (!normalizedValue) {
        return "";
    }
    try {
        const resolvedUrl = new URL(normalizedValue, "http://localhost");
        return String(resolvedUrl.searchParams.get("v") ?? "").trim();
    }
    catch {
        return "";
    }
};
export const areWorkspaceMediaLibraryUrlsEqual = (left, right) => {
    const leftMarker = getWorkspaceMediaLibraryUrlMarker(left);
    const rightMarker = getWorkspaceMediaLibraryUrlMarker(right);
    if (leftMarker || rightMarker) {
        return leftMarker === rightMarker;
    }
    return String(left ?? "").trim() === String(right ?? "").trim();
};
const getWorkspaceMediaLibraryAssetIdentity = (value) => {
    const normalizedValue = String(value ?? "").trim();
    if (!normalizedValue) {
        return "missing";
    }
    const marker = getWorkspaceMediaLibraryUrlMarker(normalizedValue);
    if (marker) {
        return `marker:${marker}`;
    }
    if (normalizedValue.startsWith("data:")) {
        return `data:${hashWorkspaceMediaLibraryValue(normalizedValue)}`;
    }
    if (normalizedValue.startsWith("blob:")) {
        return `blob:${hashWorkspaceMediaLibraryValue(normalizedValue)}`;
    }
    return `url:${hashWorkspaceMediaLibraryValue(normalizedValue)}`;
};
export const getWorkspaceMediaLibraryAssetIdentityKey = (value) => getWorkspaceMediaLibraryAssetIdentity(value);
export const getWorkspaceMediaLibraryDisplayAssetIdentityKey = (item) => typeof item.assetId === "number" && item.assetId > 0
    ? `asset:${item.assetId}`
    : item.kind === "photo_animation" && item.previewPosterUrl
        ? getWorkspaceMediaLibraryAssetIdentity(item.previewPosterUrl)
        : getWorkspaceMediaLibraryAssetIdentity(item.previewUrl);
export const buildWorkspaceMediaLibraryItemDedupeKey = (options) => {
    if (typeof options.assetId === "number" && options.assetId > 0) {
        return `asset:${options.assetId}`;
    }
    return `project:${options.projectId}:segment:${options.segmentIndex}:kind:${options.kind}:asset:${getWorkspaceMediaLibraryAssetIdentity(options.previewUrl)}`;
};
export const buildWorkspaceMediaLibraryItemKey = (source, options) => {
    if (source === "live" && options.sourceJobId) {
        return `live:${options.kind}:job:${options.sourceJobId}`;
    }
    return `${source}:${buildWorkspaceMediaLibraryItemDedupeKey({
        kind: options.kind,
        previewUrl: options.previewUrl,
        projectId: options.projectId,
        segmentIndex: options.segmentIndex,
        assetId: options.assetId,
    })}`;
};
export const createWorkspaceMediaLibraryItem = (options) => {
    const segmentNumber = options.segmentListIndex + 1;
    const dedupeKey = buildWorkspaceMediaLibraryItemDedupeKey({
        assetId: options.assetId,
        kind: options.kind,
        previewUrl: options.previewUrl,
        projectId: options.projectId,
        segmentIndex: options.segmentIndex,
    });
    return {
        assetExpiresAt: typeof options.assetExpiresAt === "string" ? options.assetExpiresAt : null,
        assetId: Number.isFinite(Number(options.assetId)) ? Math.trunc(Number(options.assetId)) : null,
        assetKind: typeof options.assetKind === "string" && options.assetKind.trim() ? options.assetKind.trim() : null,
        assetLifecycle: options.assetLifecycle ?? null,
        assetMediaType: typeof options.assetMediaType === "string" && options.assetMediaType.trim()
            ? options.assetMediaType.trim()
            : null,
        createdAt: normalizeWorkspaceMediaLibraryCreatedAt(options.createdAt),
        dedupeKey,
        downloadName: options.downloadName,
        downloadUrl: options.downloadUrl,
        itemKey: buildWorkspaceMediaLibraryItemKey(options.source, {
            kind: options.kind,
            previewUrl: options.previewUrl,
            projectId: options.projectId,
            segmentIndex: options.segmentIndex,
            sourceJobId: options.sourceJobId,
            assetId: options.assetId,
        }),
        kind: options.kind,
        previewKind: options.previewKind,
        previewPosterUrl: options.previewPosterUrl,
        previewUrl: options.previewUrl,
        projectId: options.projectId,
        projectTitle: options.projectTitle,
        segmentIndex: options.segmentIndex,
        segmentListIndex: options.segmentListIndex,
        segmentNumber,
        source: options.source,
    };
};
