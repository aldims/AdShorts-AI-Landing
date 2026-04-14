const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
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
