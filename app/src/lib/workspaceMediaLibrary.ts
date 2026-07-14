import type { WorkspaceMediaAssetLifecycle } from "../../shared/workspace-media-assets.js";

const FALLBACK_WORKSPACE_DOWNLOAD_NAME = "adshorts-video";

export type WorkspaceMediaLibraryItemKind =
  | "ai_photo"
  | "ai_video"
  | "photo_animation"
  | "talking_photo"
  | "image_edit"
  | "character_reference"
  | "scene_reference";
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
  referenceId?: string | null;
  segmentIndex: number;
  segmentListIndex: number;
  segmentNumber: number;
  source: WorkspaceMediaLibraryItemSource;
};

export const isWorkspaceMediaLibraryDisplayItem = (
  item: Pick<WorkspaceMediaLibraryItem, "kind">,
) => item.kind === "ai_photo" || item.kind === "ai_video";

export const normalizeWorkspaceMediaLibraryCreatedAt = (value: number | string | null | undefined) => {
  const timestamp =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Date.parse(value)
        : Number.NaN;

  return Number.isFinite(timestamp) ? Math.max(0, Math.trunc(timestamp)) : 0;
};

export const formatWorkspaceMediaLibraryCreatedAt = (
  value: number | string | null | undefined,
  locale: "ru" | "en" = "ru",
) => {
  const timestamp = normalizeWorkspaceMediaLibraryCreatedAt(value);
  if (timestamp <= 0) {
    return locale === "en" ? "Date unavailable" : "Дата недоступна";
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
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

const getPositiveWorkspaceMediaLibraryAssetId = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;

export const isWorkspaceMediaLibraryStableAssetUrl = (
  value: string | null | undefined,
  assetId?: number | null,
) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return false;
  }

  try {
    const url = new URL(normalizedValue, "http://localhost");
    const match = url.pathname.match(/^\/api\/workspace\/media-assets\/(\d+)(?:\/(?:playback|poster|source-frame))?$/i);
    if (!match) {
      return false;
    }

    const routeAssetId = Number(match[1]);
    const expectedAssetId = getPositiveWorkspaceMediaLibraryAssetId(assetId);
    return !expectedAssetId || routeAssetId === expectedAssetId;
  } catch {
    return false;
  }
};

export const isWorkspaceMediaLibraryTransientStudioJobUrl = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return false;
  }

  try {
    const url = new URL(normalizedValue, "http://localhost");
    return url.pathname.startsWith("/api/studio/") && url.pathname.includes("/jobs/");
  } catch {
    return normalizedValue.includes("/api/studio/") && normalizedValue.includes("/jobs/");
  }
};

export const isWorkspaceMediaLibraryLegacyFallbackDownloadUrl = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return false;
  }

  try {
    const url = new URL(normalizedValue, "http://localhost");
    return String(url.searchParams.get("download") ?? "").startsWith("1970-01-01T00:00:00.000Z");
  } catch {
    return normalizedValue.includes("download=1970-01-01T00");
  }
};

export const getWorkspaceMediaLibraryDisplayAssetIdentityKey = (item: Pick<
  WorkspaceMediaLibraryItem,
  "assetId" | "kind" | "previewPosterUrl" | "previewUrl"
>) =>
  (item.kind === "photo_animation" || item.kind === "talking_photo") && item.previewPosterUrl
    ? getWorkspaceMediaLibraryAssetIdentity(item.previewPosterUrl)
    : typeof item.assetId === "number" && item.assetId > 0
      ? `asset:${item.assetId}`
      : getWorkspaceMediaLibraryAssetIdentity(item.previewUrl);

export const getWorkspaceMediaLibraryResolvedDedupeKey = (item: Pick<
  WorkspaceMediaLibraryItem,
  "assetId" | "kind" | "previewPosterUrl" | "previewUrl" | "referenceId"
>) =>
  (item.kind === "character_reference" || item.kind === "scene_reference") && item.referenceId
    ? `${item.kind}:reference:${item.referenceId}`
    : `${item.kind}:${getWorkspaceMediaLibraryDisplayAssetIdentityKey(item)}`;

export const getWorkspaceMediaLibraryHiddenIdentityKeys = (item: Pick<
  WorkspaceMediaLibraryItem,
  "assetId" | "dedupeKey" | "itemKey" | "kind" | "previewPosterUrl" | "previewUrl" | "referenceId"
>) =>
  Array.from(
    new Set(
      [
        item.itemKey,
        item.dedupeKey,
        getWorkspaceMediaLibraryResolvedDedupeKey(item),
        item.referenceId ? `reference:${item.referenceId}` : "",
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
  item.kind === "ai_video" || item.kind === "photo_animation" || item.kind === "talking_photo"
    ? `project:${item.projectId}:segment:${item.segmentIndex}:generated-video`
    : null;

const shouldWorkspaceMediaLibraryCollapseVideoModeSlotCollision = (
  left: Pick<WorkspaceMediaLibraryItem, "kind" | "source">,
  right: Pick<WorkspaceMediaLibraryItem, "kind" | "source">,
) =>
  left.kind !== right.kind &&
  (left.kind === "ai_video" || left.kind === "photo_animation" || left.kind === "talking_photo") &&
  (right.kind === "ai_video" || right.kind === "photo_animation" || right.kind === "talking_photo") &&
  (left.source !== "persisted" || right.source !== "persisted");

export const dedupeWorkspaceMediaLibraryItems = (items: WorkspaceMediaLibraryItem[]) => {
  const itemsByPrimaryKey = new Map<string, WorkspaceMediaLibraryItem>();
  const primaryKeysByVideoModeSlot = new Map<string, string>();

  for (const item of sortWorkspaceMediaLibraryItemsNewestFirst(items)) {
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

const getWorkspaceMediaLibraryItemSpecificityRank = (item: Pick<WorkspaceMediaLibraryItem, "kind">) => {
  if (item.kind === "character_reference" || item.kind === "scene_reference") {
    return 1;
  }

  if (item.kind === "photo_animation" || item.kind === "talking_photo" || item.kind === "image_edit") {
    return 4;
  }

  if (item.kind === "ai_video" || item.kind === "ai_photo") {
    return 3;
  }

  return 2;
};

const getWorkspaceMediaLibrarySourceRank = (item: Pick<WorkspaceMediaLibraryItem, "source">) => {
  if (item.source === "persisted") {
    return 3;
  }

  if (item.source === "live") {
    return 2;
  }

  return 1;
};

const getWorkspaceMediaLibraryItemUrls = (
  item: Pick<WorkspaceMediaLibraryItem, "downloadUrl" | "previewPosterUrl" | "previewUrl">,
) => [item.previewUrl, item.previewPosterUrl, item.downloadUrl];

export const hasWorkspaceMediaLibraryStableAssetUrl = (
  item: Pick<WorkspaceMediaLibraryItem, "assetId" | "downloadUrl" | "previewPosterUrl" | "previewUrl">,
) => {
  const assetId = getPositiveWorkspaceMediaLibraryAssetId(item.assetId);
  return getWorkspaceMediaLibraryItemUrls(item).some((url) => isWorkspaceMediaLibraryStableAssetUrl(url, assetId));
};

export const hasWorkspaceMediaLibraryTransientStudioJobUrl = (
  item: Pick<WorkspaceMediaLibraryItem, "downloadUrl" | "previewPosterUrl" | "previewUrl">,
) => getWorkspaceMediaLibraryItemUrls(item).some(isWorkspaceMediaLibraryTransientStudioJobUrl);

export const hasWorkspaceMediaLibraryLegacyFallbackDownloadUrl = (
  item: Pick<WorkspaceMediaLibraryItem, "downloadUrl">,
) => isWorkspaceMediaLibraryLegacyFallbackDownloadUrl(item.downloadUrl);

export const isWorkspaceMediaLibraryItemDurableForStorage = (
  item: Pick<WorkspaceMediaLibraryItem, "assetId" | "downloadUrl" | "previewPosterUrl" | "previewUrl">,
) => {
  if (hasWorkspaceMediaLibraryLegacyFallbackDownloadUrl(item)) {
    return false;
  }

  if (getPositiveWorkspaceMediaLibraryAssetId(item.assetId)) {
    return true;
  }

  return hasWorkspaceMediaLibraryStableAssetUrl(item) && !hasWorkspaceMediaLibraryTransientStudioJobUrl(item);
};

const shouldPreferWorkspaceMediaLibraryAssetDuplicate = (
  candidate: WorkspaceMediaLibraryItem,
  existing: WorkspaceMediaLibraryItem,
) => {
  const candidateIsTransient = hasWorkspaceMediaLibraryLegacyFallbackDownloadUrl(candidate) ||
    hasWorkspaceMediaLibraryTransientStudioJobUrl(candidate);
  const existingIsTransient = hasWorkspaceMediaLibraryLegacyFallbackDownloadUrl(existing) ||
    hasWorkspaceMediaLibraryTransientStudioJobUrl(existing);
  if (candidateIsTransient !== existingIsTransient) {
    return !candidateIsTransient;
  }

  const specificityDifference =
    getWorkspaceMediaLibraryItemSpecificityRank(candidate) -
    getWorkspaceMediaLibraryItemSpecificityRank(existing);
  if (specificityDifference !== 0) {
    return specificityDifference > 0;
  }

  const stableRouteDifference =
    Number(hasWorkspaceMediaLibraryStableAssetUrl(candidate)) -
    Number(hasWorkspaceMediaLibraryStableAssetUrl(existing));
  if (stableRouteDifference !== 0) {
    return stableRouteDifference > 0;
  }

  const sourceDifference = getWorkspaceMediaLibrarySourceRank(candidate) - getWorkspaceMediaLibrarySourceRank(existing);
  if (sourceDifference !== 0) {
    return sourceDifference > 0;
  }

  return candidate.createdAt > existing.createdAt;
};

export const dedupeWorkspaceMediaLibraryPageItems = (items: WorkspaceMediaLibraryItem[]) => {
  const sortedItems = sortWorkspaceMediaLibraryItemsNewestFirst(items);
  const itemIndexesByPrimaryKey = new Map<string, number>();
  const itemIndexesByVideoModeSlot = new Map<string, number>();
  const itemIndexesByAssetId = new Map<number, number>();
  const result: WorkspaceMediaLibraryItem[] = [];
  const indexKeys = new Map<number, { assetId: number | null; primaryKey: string; videoModeSlotKey: string | null }>();

  const unregisterIndex = (index: number) => {
    const keys = indexKeys.get(index);
    if (!keys) {
      return;
    }

    if (itemIndexesByPrimaryKey.get(keys.primaryKey) === index) {
      itemIndexesByPrimaryKey.delete(keys.primaryKey);
    }

    if (keys.videoModeSlotKey && itemIndexesByVideoModeSlot.get(keys.videoModeSlotKey) === index) {
      itemIndexesByVideoModeSlot.delete(keys.videoModeSlotKey);
    }

    if (keys.assetId && itemIndexesByAssetId.get(keys.assetId) === index) {
      itemIndexesByAssetId.delete(keys.assetId);
    }
  };

  const registerItemAtIndex = (index: number, item: WorkspaceMediaLibraryItem) => {
    const primaryKey = getWorkspaceMediaLibraryResolvedDedupeKey(item);
    const videoModeSlotKey = getWorkspaceMediaLibraryVideoModeSlotKey(item);
    const assetId = getPositiveWorkspaceMediaLibraryAssetId(item.assetId);

    itemIndexesByPrimaryKey.set(primaryKey, index);
    if (videoModeSlotKey) {
      itemIndexesByVideoModeSlot.set(videoModeSlotKey, index);
    }

    if (assetId) {
      itemIndexesByAssetId.set(assetId, index);
    }

    indexKeys.set(index, {
      assetId,
      primaryKey,
      videoModeSlotKey,
    });
  };

  const pushItem = (item: WorkspaceMediaLibraryItem) => {
    const nextIndex = result.length;
    result.push(item);
    registerItemAtIndex(nextIndex, item);
  };

  const replaceItem = (index: number, item: WorkspaceMediaLibraryItem) => {
    unregisterIndex(index);
    result[index] = item;
    registerItemAtIndex(index, item);
  };

  for (const item of sortedItems) {
    const primaryKey = getWorkspaceMediaLibraryResolvedDedupeKey(item);
    const videoModeSlotKey = getWorkspaceMediaLibraryVideoModeSlotKey(item);
    const assetId = getPositiveWorkspaceMediaLibraryAssetId(item.assetId);
    const existingPrimaryIndex = itemIndexesByPrimaryKey.get(primaryKey);
    const existingVideoModeSlotIndex = videoModeSlotKey ? itemIndexesByVideoModeSlot.get(videoModeSlotKey) : undefined;
    const existingAssetIndex = assetId ? itemIndexesByAssetId.get(assetId) : undefined;
    const existingIndex = existingAssetIndex ?? existingPrimaryIndex ?? existingVideoModeSlotIndex;

    if (existingIndex === undefined) {
      pushItem(item);
      continue;
    }

    const existingItem = result[existingIndex];
    if (!existingItem) {
      replaceItem(existingIndex, item);
      continue;
    }

    if (
      existingVideoModeSlotIndex === existingIndex &&
      existingAssetIndex === undefined &&
      existingPrimaryIndex === undefined &&
      !shouldWorkspaceMediaLibraryCollapseVideoModeSlotCollision(existingItem, item)
    ) {
      pushItem(item);
      continue;
    }

    if (shouldPreferWorkspaceMediaLibraryAssetDuplicate(item, existingItem)) {
      replaceItem(existingIndex, item);
    }
  }

  return result;
};

export const buildWorkspaceMediaLibraryItemDedupeKey = (options: {
  assetId?: number | null;
  kind: WorkspaceMediaLibraryItemKind;
  previewUrl: string;
  projectId: number;
  referenceId?: string | null;
  segmentIndex: number;
}) => {
  if (
    (options.kind === "character_reference" || options.kind === "scene_reference") &&
    typeof options.referenceId === "string" &&
    options.referenceId.trim()
  ) {
    return `reference:${options.kind}:${options.referenceId.trim()}`;
  }

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
    referenceId?: string | null;
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
    referenceId: options.referenceId,
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
  referenceId?: string | null;
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
    referenceId: options.referenceId,
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
      referenceId: options.referenceId,
    }),
    kind: options.kind,
    previewKind: options.previewKind,
    previewPosterUrl: options.previewPosterUrl,
    previewUrl: options.previewUrl,
    projectId: options.projectId,
    projectTitle: options.projectTitle,
    referenceId: typeof options.referenceId === "string" && options.referenceId.trim() ? options.referenceId.trim() : null,
    segmentIndex: options.segmentIndex,
    segmentListIndex: options.segmentListIndex,
    segmentNumber,
    source: options.source,
  } satisfies WorkspaceMediaLibraryItem;
};
