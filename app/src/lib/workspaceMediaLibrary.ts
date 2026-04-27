import type { WorkspaceMediaAssetLifecycle } from "../../shared/workspace-media-assets.js";

const FALLBACK_WORKSPACE_DOWNLOAD_NAME = "adshorts-video";

export type WorkspaceMediaLibraryItemKind = "ai_photo" | "ai_video" | "photo_animation" | "image_edit";
export type WorkspaceMediaLibraryItemSource = "draft" | "live" | "persisted";
export type WorkspaceMediaLibraryPreviewKind = "video" | "image";

export type WorkspaceMediaLibraryItem = {
  assetExpiresAt: string | null;
  assetId: number | null;
  assetKind: string | null;
  assetLifecycle: WorkspaceMediaAssetLifecycle | null;
  assetMediaType: string | null;
  createdAt: number;
  dedupeKey: string;
  downloadName: string;
  downloadUrl: string | null;
  itemKey: string;
  kind: WorkspaceMediaLibraryItemKind;
  previewKind: WorkspaceMediaLibraryPreviewKind;
  previewPosterUrl: string | null;
  previewUrl: string;
  projectId: number;
  projectTitle: string;
  segmentIndex: number;
  segmentListIndex: number;
  segmentNumber: number;
  source: WorkspaceMediaLibraryItemSource;
};

export const normalizeWorkspaceMediaLibraryCreatedAt = (value: number | string | null | undefined) => {
  const timestamp =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Date.parse(value)
        : Number.NaN;

  return Number.isFinite(timestamp) ? Math.max(0, Math.trunc(timestamp)) : 0;
};

export const sortWorkspaceMediaLibraryItemsNewestFirst = (items: WorkspaceMediaLibraryItem[]) =>
  items.slice().sort((left, right) => {
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

export const getWorkspaceProjectDisplayTitle = (project: {
  adId: number | null;
  jobId: string | null;
  title: string;
}) => {
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

export const getWorkspaceDownloadBaseName = (value: string) => {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedValue || FALLBACK_WORKSPACE_DOWNLOAD_NAME;
};

export const getWorkspaceVideoDownloadName = (value: string) => `${getWorkspaceDownloadBaseName(value)}.mp4`;

export const getWorkspaceImageDownloadName = (value: string) => `${getWorkspaceDownloadBaseName(value)}.jpg`;

const hashWorkspaceMediaLibraryValue = (value: string) => {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
};

export const getWorkspaceMediaLibraryUrlMarker = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return "";
  }

  try {
    const resolvedUrl = new URL(normalizedValue, "http://localhost");
    return String(resolvedUrl.searchParams.get("v") ?? "").trim();
  } catch {
    return "";
  }
};

export const areWorkspaceMediaLibraryUrlsEqual = (left: string | null | undefined, right: string | null | undefined) => {
  const leftMarker = getWorkspaceMediaLibraryUrlMarker(left);
  const rightMarker = getWorkspaceMediaLibraryUrlMarker(right);
  if (leftMarker || rightMarker) {
    return leftMarker === rightMarker;
  }

  return String(left ?? "").trim() === String(right ?? "").trim();
};

const getWorkspaceMediaLibraryAssetIdentity = (value: string | null | undefined) => {
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

export const getWorkspaceMediaLibraryAssetIdentityKey = (value: string | null | undefined) =>
  getWorkspaceMediaLibraryAssetIdentity(value);

export const getWorkspaceMediaLibraryDisplayAssetIdentityKey = (item: Pick<
  WorkspaceMediaLibraryItem,
  "assetId" | "kind" | "previewPosterUrl" | "previewUrl"
>) =>
  item.kind === "photo_animation" && item.previewPosterUrl
    ? getWorkspaceMediaLibraryAssetIdentity(item.previewPosterUrl)
    : typeof item.assetId === "number" && item.assetId > 0
      ? `asset:${item.assetId}`
      : getWorkspaceMediaLibraryAssetIdentity(item.previewUrl);

export const getWorkspaceMediaLibraryResolvedDedupeKey = (item: Pick<
  WorkspaceMediaLibraryItem,
  "assetId" | "kind" | "previewPosterUrl" | "previewUrl"
>) => `${item.kind}:${getWorkspaceMediaLibraryDisplayAssetIdentityKey(item)}`;

export const getWorkspaceMediaLibraryHiddenIdentityKeys = (item: Pick<
  WorkspaceMediaLibraryItem,
  "assetId" | "dedupeKey" | "itemKey" | "kind" | "previewPosterUrl" | "previewUrl"
>) =>
  Array.from(
    new Set(
      [
        item.itemKey,
        item.dedupeKey,
        getWorkspaceMediaLibraryResolvedDedupeKey(item),
        typeof item.assetId === "number" && item.assetId > 0 ? `asset:${Math.trunc(item.assetId)}` : "",
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );

export const isWorkspaceMediaLibraryItemHidden = (
  item: Pick<
    WorkspaceMediaLibraryItem,
    "assetId" | "dedupeKey" | "itemKey" | "kind" | "previewPosterUrl" | "previewUrl"
  >,
  hiddenKeys: ReadonlySet<string>,
) => getWorkspaceMediaLibraryHiddenIdentityKeys(item).some((key) => hiddenKeys.has(key));

const getWorkspaceMediaLibraryVideoModeSlotKey = (item: Pick<
  WorkspaceMediaLibraryItem,
  "kind" | "projectId" | "segmentIndex"
>) =>
  item.kind === "ai_video" || item.kind === "photo_animation"
    ? `project:${item.projectId}:segment:${item.segmentIndex}:generated-video`
    : null;

const shouldWorkspaceMediaLibraryCollapseVideoModeSlotCollision = (
  left: Pick<WorkspaceMediaLibraryItem, "kind" | "source">,
  right: Pick<WorkspaceMediaLibraryItem, "kind" | "source">,
) =>
  left.kind !== right.kind &&
  (left.kind === "ai_video" || left.kind === "photo_animation") &&
  (right.kind === "ai_video" || right.kind === "photo_animation") &&
  (left.source !== "persisted" || right.source !== "persisted");

export const dedupeWorkspaceMediaLibraryItems = (items: WorkspaceMediaLibraryItem[]) => {
  const itemsByPrimaryKey = new Map<string, WorkspaceMediaLibraryItem>();
  const primaryKeysByVideoModeSlot = new Map<string, string>();

  for (const item of items) {
    const primaryKey = getWorkspaceMediaLibraryResolvedDedupeKey(item);
    const videoModeSlotKey = getWorkspaceMediaLibraryVideoModeSlotKey(item);
    const existingPrimaryKey = videoModeSlotKey ? primaryKeysByVideoModeSlot.get(videoModeSlotKey) ?? null : null;

    if (existingPrimaryKey) {
      const existingItem = itemsByPrimaryKey.get(existingPrimaryKey) ?? null;

      if (
        existingItem &&
        shouldWorkspaceMediaLibraryCollapseVideoModeSlotCollision(existingItem, item)
      ) {
        continue;
      }
    }

    if (!itemsByPrimaryKey.has(primaryKey)) {
      itemsByPrimaryKey.set(primaryKey, item);

      if (videoModeSlotKey && !primaryKeysByVideoModeSlot.has(videoModeSlotKey)) {
        primaryKeysByVideoModeSlot.set(videoModeSlotKey, primaryKey);
      }
    }
  }

  return Array.from(itemsByPrimaryKey.values());
};

export const buildWorkspaceMediaLibraryItemDedupeKey = (options: {
  assetId?: number | null;
  kind: WorkspaceMediaLibraryItemKind;
  previewUrl: string;
  projectId: number;
  segmentIndex: number;
}) => {
  if (typeof options.assetId === "number" && options.assetId > 0) {
    return `asset:${options.assetId}`;
  }

  return `project:${options.projectId}:segment:${options.segmentIndex}:kind:${options.kind}:asset:${getWorkspaceMediaLibraryAssetIdentity(options.previewUrl)}`;
};

export const buildWorkspaceMediaLibraryItemKey = (
  source: WorkspaceMediaLibraryItemSource,
  options: {
    assetId?: number | null;
    kind: WorkspaceMediaLibraryItemKind;
    previewUrl: string;
    projectId: number;
    segmentIndex: number;
    sourceJobId?: string | null;
  },
) => {
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

export const createWorkspaceMediaLibraryItem = (options: {
  assetExpiresAt?: string | null;
  assetId?: number | null;
  assetKind?: string | null;
  assetLifecycle?: WorkspaceMediaAssetLifecycle | null;
  assetMediaType?: string | null;
  createdAt?: number | string | null;
  downloadName: string;
  downloadUrl: string | null;
  kind: WorkspaceMediaLibraryItemKind;
  previewKind: WorkspaceMediaLibraryPreviewKind;
  previewPosterUrl: string | null;
  previewUrl: string;
  projectId: number;
  projectTitle: string;
  segmentIndex: number;
  segmentListIndex: number;
  source: WorkspaceMediaLibraryItemSource;
  sourceJobId?: string | null;
}) => {
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
    assetMediaType:
      typeof options.assetMediaType === "string" && options.assetMediaType.trim()
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
  } satisfies WorkspaceMediaLibraryItem;
};
