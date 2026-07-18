export type WorkspaceMediaAssetLifecycle =
  | "uploading"
  | "processing"
  | "ready"
  | "expired"
  | "deleted"
  | "failed"
  | "unavailable";

export type WorkspaceMediaAssetRef = {
  assetId: number | null;
  createdAt: string | null;
  deletedAt: string | null;
  downloadPath: string | null;
  downloadUrl: string | null;
  durationSeconds?: number | null;
  expiresAt: string | null;
  isCurrent: boolean | null;
  kind: string | null;
  libraryKind: string | null;
  lifecycle: WorkspaceMediaAssetLifecycle;
  mediaType: string | null;
  mimeType: string | null;
  originalUrl: string | null;
  playbackUrl: string | null;
  projectId: number | null;
  renderedAnimationMode?: string | null;
  renderedViaI2v?: boolean | null;
  role: string | null;
  segmentIndex: number | null;
  sourceKind: string | null;
  status: string | null;
  storageKey: string | null;
};

export type ProjectMediaEnvelope = {
  assets: WorkspaceMediaAssetRef[];
  loaded: boolean;
  projectId: number;
};

export type SegmentMediaEnvelope = {
  currentAsset: WorkspaceMediaAssetRef | null;
  originalAsset: WorkspaceMediaAssetRef | null;
};

export type UploadSessionRef = {
  asset: WorkspaceMediaAssetRef | null;
  assetId: number | null;
  completedAt: string | null;
  contentType: string | null;
  fileName: string | null;
  fileSize: number | null;
  kind: string | null;
  mediaType: string | null;
  status: "pending" | "uploaded" | "failed" | "unavailable";
  uploadMethod: "direct_storage" | "bff_proxy" | "legacy_base64" | "unavailable";
  uploadUrl: string | null;
};

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizeWorkspaceMediaAssetToken = (value: unknown) => normalizeText(value).toLowerCase();

const normalizeWorkspaceMediaAssetBoolean = (value: unknown) => {
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

export const isWorkspaceNonAiRenderedPhotoVideoAsset = (
  asset: WorkspaceMediaAssetRef | null | undefined,
) => {
  const mediaType = normalizeWorkspaceMediaAssetToken(asset?.mediaType);
  const mimeType = normalizeWorkspaceMediaAssetToken(asset?.mimeType);
  if (mediaType !== "video" && !mimeType.startsWith("video/")) {
    return false;
  }

  const renderedAnimationMode = normalizeWorkspaceMediaAssetToken(
    asset?.renderedAnimationMode ??
      (asset as { rendered_animation_mode?: string | null } | null | undefined)?.rendered_animation_mode,
  );
  const renderedViaI2v = normalizeWorkspaceMediaAssetBoolean(
    asset?.renderedViaI2v ??
      (asset as { rendered_via_i2v?: boolean | string | number | null } | null | undefined)?.rendered_via_i2v,
  );
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
  const isRenderedSegment =
    signature.includes("rendered_segment") ||
    signature.includes("current_rendered_segment") ||
    signature.includes("/rendered_segment/");
  const hasPhotoMarker =
    libraryKind === "photo_animation" ||
    libraryKind === "ai_photo" ||
    signature.includes("photo_animation") ||
    signature.includes("photo-animation") ||
    signature.includes("source_ai_image") ||
    signature.includes("ai_photo") ||
    signature.includes("ai-photo");
  const hasGeneratedVideoMarker =
    renderedViaI2v === true ||
    renderedAnimationMode === "i2v";
  // A rendered segment is the delivery MP4 for a photo and may contain only
  // synthetic camera movement. Treat it as AI video only when the asset keeps
  // positive image-to-video provenance; absence of that provenance is not AI.
  return isRenderedSegment && hasPhotoMarker && !hasGeneratedVideoMarker;
};

const normalizeIsoString = (value: unknown) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
};

const isExpiredIsoString = (value: string | null) => {
  if (!value) {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= Date.now();
};

export const resolveWorkspaceMediaAssetLifecycle = (options: {
  deletedAt?: string | null | undefined;
  downloadPath?: string | null | undefined;
  downloadUrl?: string | null | undefined;
  expiresAt?: string | null | undefined;
  status?: string | null | undefined;
}) => {
  const deletedAt = normalizeIsoString(options.deletedAt);
  if (deletedAt) {
    return "deleted" satisfies WorkspaceMediaAssetLifecycle;
  }

  const expiresAt = normalizeIsoString(options.expiresAt);
  if (isExpiredIsoString(expiresAt)) {
    return "expired" satisfies WorkspaceMediaAssetLifecycle;
  }

  const status = normalizeText(options.status).toLowerCase();
  switch (status) {
    case "uploading":
      return "uploading" satisfies WorkspaceMediaAssetLifecycle;
    case "queued":
    case "pending":
    case "processing":
    case "rendering":
      return "processing" satisfies WorkspaceMediaAssetLifecycle;
    case "ready":
    case "completed":
    case "done":
      return "ready" satisfies WorkspaceMediaAssetLifecycle;
    case "failed":
    case "error":
      return "failed" satisfies WorkspaceMediaAssetLifecycle;
    case "deleted":
      return "deleted" satisfies WorkspaceMediaAssetLifecycle;
    case "expired":
      return "expired" satisfies WorkspaceMediaAssetLifecycle;
    default: {
      const downloadPath = normalizeText(options.downloadPath);
      const downloadUrl = normalizeText(options.downloadUrl);
      return downloadPath || downloadUrl ? "ready" : "unavailable";
    }
  }
};

export const isWorkspaceMediaAssetReady = (asset: Pick<
  WorkspaceMediaAssetRef,
  "downloadPath" | "downloadUrl" | "lifecycle"
>) => asset.lifecycle === "ready" && Boolean(normalizeText(asset.downloadPath) || normalizeText(asset.downloadUrl));
