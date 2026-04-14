import { resolveWorkspaceMediaAssetLifecycle, } from "../shared/workspace-media-assets.js";
import { env } from "./env.js";
import { fetchAdsflowJson, upstreamPolicies, } from "./upstream-client.js";
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeInteger = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return null;
    }
    const rounded = Math.trunc(numeric);
    return rounded >= 0 ? rounded : null;
};
const normalizeIsoString = (value) => {
    const normalized = normalizeText(value);
    if (!normalized) {
        return null;
    }
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
};
const normalizeBoolean = (value) => {
    if (typeof value === "boolean") {
        return value;
    }
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === "true") {
        return true;
    }
    if (normalized === "false") {
        return false;
    }
    return null;
};
export const isAdsflowMediaAssetPayload = (value) => Boolean(value) && typeof value === "object";
export const buildWorkspaceMediaAssetRef = (value) => {
    if (!value) {
        return null;
    }
    const assetId = normalizeInteger(value.id);
    const createdAt = normalizeIsoString(value.created_at);
    const deletedAt = normalizeIsoString(value.deleted_at);
    const downloadPath = normalizeText(value.download_path) || null;
    const downloadUrl = normalizeText(value.download_url) || null;
    const expiresAt = normalizeIsoString(value.expires_at);
    const kind = normalizeText(value.kind) || null;
    const mediaType = normalizeText(value.media_type) || null;
    const mimeType = normalizeText(value.mime_type) || null;
    const originalUrl = normalizeText(value.original_url) || null;
    const projectId = normalizeInteger(value.project_id);
    const role = normalizeText(value.role) || kind;
    const segmentIndex = normalizeInteger(value.segment_index);
    const sourceKind = normalizeText(value.source_kind) || null;
    const status = normalizeText(value.status) || null;
    const storageKey = normalizeText(value.storage_key) || null;
    const isCurrent = normalizeBoolean(value.is_current);
    return {
        assetId,
        createdAt,
        deletedAt,
        downloadPath,
        downloadUrl,
        expiresAt,
        isCurrent,
        kind,
        lifecycle: resolveWorkspaceMediaAssetLifecycle({
            deletedAt,
            downloadPath,
            downloadUrl,
            expiresAt,
            status,
        }),
        mediaType,
        mimeType,
        originalUrl,
        playbackUrl: downloadPath || downloadUrl || null,
        projectId,
        role,
        segmentIndex,
        sourceKind,
        status,
        storageKey,
    };
};
export const mergeWorkspaceMediaAssetRefs = (primary, fallback) => {
    if (!primary && !fallback) {
        return null;
    }
    if (!primary) {
        return fallback ?? null;
    }
    if (!fallback) {
        return primary;
    }
    return {
        assetId: primary.assetId ?? fallback.assetId,
        createdAt: primary.createdAt ?? fallback.createdAt,
        deletedAt: primary.deletedAt ?? fallback.deletedAt,
        downloadPath: primary.downloadPath ?? fallback.downloadPath,
        downloadUrl: primary.downloadUrl ?? fallback.downloadUrl,
        expiresAt: primary.expiresAt ?? fallback.expiresAt,
        isCurrent: primary.isCurrent ?? fallback.isCurrent,
        kind: primary.kind ?? fallback.kind,
        lifecycle: primary.lifecycle !== "unavailable"
            ? primary.lifecycle
            : fallback.lifecycle,
        mediaType: primary.mediaType ?? fallback.mediaType,
        mimeType: primary.mimeType ?? fallback.mimeType,
        originalUrl: primary.originalUrl ?? fallback.originalUrl,
        playbackUrl: primary.playbackUrl ?? fallback.playbackUrl,
        projectId: primary.projectId ?? fallback.projectId,
        role: primary.role ?? fallback.role,
        segmentIndex: primary.segmentIndex ?? fallback.segmentIndex,
        sourceKind: primary.sourceKind ?? fallback.sourceKind,
        status: primary.status ?? fallback.status,
        storageKey: primary.storageKey ?? fallback.storageKey,
    };
};
export const getWorkspaceMediaAssetIdentityKey = (asset) => {
    if (!asset) {
        return "missing";
    }
    if (typeof asset.assetId === "number" && asset.assetId > 0) {
        return `asset:${asset.assetId}`;
    }
    if (asset.downloadPath) {
        return `path:${asset.downloadPath}`;
    }
    if (asset.downloadUrl) {
        return `url:${asset.downloadUrl}`;
    }
    return "missing";
};
export const fetchProjectMediaEnvelope = async (projectId) => {
    const safeProjectId = normalizeInteger(projectId);
    if (safeProjectId === null || safeProjectId <= 0) {
        return {
            assets: [],
            projectId: Number(projectId) || 0,
        };
    }
    const payload = await fetchAdsflowJson({
        context: {
            endpoint: "project.media",
            projectId: safeProjectId,
        },
        params: {
            admin_token: env.adsflowAdminToken ?? "",
        },
        path: `/api/projects/${safeProjectId}/media`,
        policy: upstreamPolicies.adsflowMetadata,
    }).catch((error) => {
        console.warn(`[media-assets] Failed to load project media for ${safeProjectId}`, error);
        return null;
    });
    const assets = Array.isArray(payload?.assets)
        ? payload.assets
            .map((item) => (isAdsflowMediaAssetPayload(item) ? buildWorkspaceMediaAssetRef(item) : null))
            .filter((item) => Boolean(item))
        : [];
    return {
        assets,
        projectId: normalizeInteger(payload?.project_id) ?? safeProjectId,
    };
};
