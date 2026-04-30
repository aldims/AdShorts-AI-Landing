import {
  areWorkspaceMediaLibraryUrlsEqual,
  createWorkspaceMediaLibraryItem,
  dedupeWorkspaceMediaLibraryItems,
  getWorkspaceMediaLibraryUrlMarker,
  getWorkspaceImageDownloadName,
  getWorkspaceProjectDisplayTitle,
  getWorkspaceVideoDownloadName,
  normalizeWorkspaceMediaLibraryCreatedAt,
  sortWorkspaceMediaLibraryItemsNewestFirst,
  type WorkspaceMediaLibraryItemKind,
  type WorkspaceMediaLibraryItem,
} from "../src/lib/workspaceMediaLibrary.js";
import { env } from "./env.js";
import {
  buildWorkspaceMediaAssetRef,
  isAdsflowMediaAssetPayload,
  type AdsflowMediaAssetPayload,
} from "./media-assets.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
import {
  ensureWorkspaceVideoPoster,
  getWorkspaceVideoPosterCacheKey,
} from "./project-posters.js";
import {
  ensureWorkspacePreviewImage,
  getWorkspacePreviewImageCacheKey,
} from "./preview-images.js";
import { getWorkspaceProjects, type WorkspaceProject } from "./projects.js";
import {
  getWorkspaceProjectSegmentVideoProxyTarget,
  getWorkspaceSegmentEditorSession,
  getWorkspaceSegmentEditorSessionForAccessibleProject,
  type WorkspaceSegmentEditorSegment,
  type WorkspaceSegmentEditorVideoDelivery,
  type WorkspaceSegmentEditorVideoSource,
  type WorkspaceSegmentEditorSession,
} from "./segment-editor.js";
import {
  clearWorkspaceMediaIndex,
  getWorkspaceMediaIndexProjectEntry,
  listWorkspaceMediaIndexProjectEntries,
  pruneWorkspaceMediaIndexProjects,
  upsertWorkspaceMediaIndexProjectEntry,
  type WorkspaceMediaIndexProjectEntry,
  type WorkspaceMediaIndexStoredItem,
} from "./workspace-media-index.js";
import { postAdsflowJson, upstreamPolicies } from "./upstream-client.js";

type MediaLibraryUser = {
  email?: string | null;
  id?: string | null;
  name?: string | null;
};

type AdsflowWebMediaLibraryResponse = {
  assets?: unknown[] | null;
  cursor?: number | string | null;
  limit?: number | string | null;
  next_cursor?: number | string | null;
};

type AdsflowProjectMediaLinkPayload = {
  is_current?: boolean | null;
  project_id?: number | string | null;
  role?: string | null;
  segment_index?: number | string | null;
};

type AdsflowWebMediaLibraryAssetPayload = AdsflowMediaAssetPayload & {
  links?: unknown[] | null;
};

const WORKSPACE_MEDIA_LIBRARY_CACHE_TTL_MS = 60_000;
const WORKSPACE_MEDIA_LIBRARY_SEGMENT_CONCURRENCY = 6;
const WORKSPACE_MEDIA_LIBRARY_DEFAULT_LIMIT = 24;
const WORKSPACE_MEDIA_LIBRARY_MAX_LIMIT = 96;
const WORKSPACE_MEDIA_LIBRARY_INDEX_SCHEMA_VERSION = "media-v4";

export type WorkspaceMediaLibraryPage = {
  items: WorkspaceMediaLibraryItem[];
  nextCursor: string | null;
  total: number;
};

const workspaceMediaLibraryCache = new Map<string, { expiresAt: number; page: WorkspaceMediaLibraryPage }>();
const workspaceMediaLibraryInFlight = new Map<string, Promise<WorkspaceMediaLibraryPage>>();
const workspaceMediaLibraryIndexWarmInFlight = new Set<string>();

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizeInteger = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const rounded = Math.trunc(numeric);
  return rounded >= 0 ? rounded : null;
};

const isWorkspaceRenderableMediaPreviewUrl = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
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

const isWorkspaceMediaLibraryItemKind = (value: string): value is WorkspaceMediaLibraryItemKind =>
  value === "ai_photo" || value === "ai_video" || value === "photo_animation" || value === "image_edit";

const isWorkspaceSegmentEditorVideoSource = (value: string): value is WorkspaceSegmentEditorVideoSource =>
  value === "current" || value === "original";

const isWorkspaceSegmentEditorVideoDelivery = (value: string): value is WorkspaceSegmentEditorVideoDelivery =>
  value === "preview" || value === "playback";

const getWorkspaceMediaLibraryCacheKey = (user: MediaLibraryUser) => {
  const userId = normalizeText(user.id);
  if (userId) {
    return `user:${userId}:workspace-media-library`;
  }

  const email = normalizeText(user.email).toLowerCase();
  return email ? `email:${email}:workspace-media-library` : null;
};

const cloneWorkspaceMediaLibraryItems = (items: WorkspaceMediaLibraryItem[]) => items.map((item) => ({ ...item }));
const cloneWorkspaceMediaLibraryPage = (page: WorkspaceMediaLibraryPage): WorkspaceMediaLibraryPage => ({
  items: cloneWorkspaceMediaLibraryItems(page.items),
  nextCursor: page.nextCursor,
  total: page.total,
});

const buildWorkspaceMediaLibraryPreviewUrl = (options: {
  kind: WorkspaceMediaLibraryItemKind;
  projectId: number;
  segmentIndex: number;
  version: string;
}) => {
  const previewUrl = new URL("/api/workspace/media-library-preview", env.appUrl);
  previewUrl.searchParams.set("kind", options.kind);
  previewUrl.searchParams.set("projectId", String(options.projectId));
  previewUrl.searchParams.set("segmentIndex", String(options.segmentIndex));
  if (options.version) {
    previewUrl.searchParams.set("v", options.version);
  }

  return `${previewUrl.pathname}${previewUrl.search}`;
};

const buildWorkspaceMediaLibraryPreviewVersion = (
  value: string | null | undefined,
  fallbackToken: string,
) => getWorkspaceMediaLibraryUrlMarker(value) || normalizeText(fallbackToken);

const appendUrlToken = (value: string | null | undefined, key: string, token: string | number | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  const normalizedToken = String(token ?? "").trim();
  if (!normalizedValue || !normalizedToken) {
    return normalizedValue || null;
  }

  try {
    const resolvedUrl = new URL(normalizedValue, "http://localhost");
    resolvedUrl.searchParams.set(key, normalizedToken);

    if (/^https?:\/\//i.test(normalizedValue)) {
      return resolvedUrl.toString();
    }

    return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
  } catch {
    return normalizedValue;
  }
};

const mapWithConcurrencyLimit = async <T, TResult>(
  items: T[],
  concurrencyLimit: number,
  mapper: (item: T, index: number) => Promise<TResult>,
) => {
  if (!items.length) {
    return [] as TResult[];
  }

  const nextResults = new Array<TResult>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrencyLimit, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        nextResults[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    }),
  );

  return nextResults;
};

const parseWorkspaceMediaLibraryLimit = (value: unknown) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return WORKSPACE_MEDIA_LIBRARY_DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(Math.trunc(normalized), WORKSPACE_MEDIA_LIBRARY_MAX_LIMIT));
};

const parseWorkspaceMediaLibraryCursor = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return 0;
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.trunc(numeric);
};

const buildWorkspaceMediaLibraryNextCursor = (offset: number) => String(Math.max(0, offset));

export const getWorkspaceMediaLibraryNextCursorForPage = (options: {
  hasAdditionalItems: boolean;
  offset: number;
  pageItemCount: number;
}) => {
  const nextOffset = options.offset + options.pageItemCount;
  return options.hasAdditionalItems && nextOffset > options.offset
    ? buildWorkspaceMediaLibraryNextCursor(nextOffset)
    : null;
};

const getWorkspaceMediaLibraryProjectVersion = (project: WorkspaceProject) =>
  `${normalizeText(project.updatedAt || project.generatedAt || project.createdAt || project.id)}:${WORKSPACE_MEDIA_LIBRARY_INDEX_SCHEMA_VERSION}`;

const getWorkspaceMediaLibraryProjectCreatedAt = (
  project: Pick<WorkspaceProject, "createdAt" | "generatedAt" | "updatedAt">,
) =>
  normalizeWorkspaceMediaLibraryCreatedAt(project.generatedAt || project.createdAt || project.updatedAt);

const getWorkspaceMediaLibraryIndexWarmKey = (user: MediaLibraryUser, projectId: number) => {
  const cacheKey = getWorkspaceMediaLibraryCacheKey(user);
  return cacheKey ? `${cacheKey}:project:${projectId}` : `anonymous:project:${projectId}`;
};

const resolvePreferredExternalUserId = async (user: MediaLibraryUser) => {
  try {
    return (await resolveExternalUserIdentity(user)).preferred;
  } catch {
    return buildExternalUserId(user);
  }
};

const buildWorkspaceMediaLibraryDownloadName = (
  projectTitle: string,
  segmentListIndex: number,
  kind: WorkspaceMediaLibraryItemKind,
) => {
  const segmentLabel = `${projectTitle}-segment-${segmentListIndex + 1}`;

  if (kind === "ai_video") {
    return getWorkspaceVideoDownloadName(`${segmentLabel}-ai-video`);
  }

  if (kind === "photo_animation") {
    return getWorkspaceVideoDownloadName(`${segmentLabel}-animation`);
  }

  if (kind === "image_edit") {
    return getWorkspaceImageDownloadName(`${segmentLabel}-edit`);
  }

  return getWorkspaceImageDownloadName(segmentLabel);
};

const isAdsflowProjectMediaLinkPayload = (value: unknown): value is AdsflowProjectMediaLinkPayload =>
  Boolean(value) && typeof value === "object";

const getAdsflowDurableAssetProjectId = (
  asset: AdsflowWebMediaLibraryAssetPayload,
  links: AdsflowProjectMediaLinkPayload[],
) =>
  normalizeInteger(asset.project_id) ??
  normalizeInteger(links.find((link) => normalizeInteger(link.project_id) !== null)?.project_id);

const getAdsflowDurableAssetSegmentIndex = (
  asset: AdsflowWebMediaLibraryAssetPayload,
  links: AdsflowProjectMediaLinkPayload[],
) =>
  normalizeInteger(asset.segment_index) ??
  normalizeInteger(links.find((link) => normalizeInteger(link.segment_index) !== null)?.segment_index);

const getAdsflowDurableAssetRole = (
  asset: AdsflowWebMediaLibraryAssetPayload,
  links: AdsflowProjectMediaLinkPayload[],
) =>
  normalizeText(asset.role) ||
  normalizeText(links.find((link) => normalizeText(link.role))?.role) ||
  normalizeText(asset.kind);

const normalizeWorkspaceDurableAssetClassifier = (value: unknown) =>
  normalizeText(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const WORKSPACE_MEDIA_LIBRARY_FINAL_VIDEO_CLASSIFIERS = new Set([
  "complete_video",
  "completevideo",
  "final_video",
  "finalvideo",
  "full_video",
  "fullvideo",
]);

const WORKSPACE_MEDIA_LIBRARY_UNSEGMENTED_FINAL_CLASSIFIERS = new Set([
  "complete",
  "final",
  "full",
]);

const WORKSPACE_MEDIA_LIBRARY_SOURCE_INPUT_CLASSIFIERS = new Set([
  "segment_image",
  "segment_source",
  "source_upload",
]);

const WORKSPACE_MEDIA_LIBRARY_AI_GENERATED_CLASSIFIERS = new Set([
  "ai",
  "ai_generated",
  "ai_image",
  "ai_photo",
  "ai_video",
  "generated",
  "image_edit",
  "photo_animation",
  "segment_ai_image",
  "segment_ai_photo",
  "segment_ai_video",
  "source_ai_image",
  "source_ai_photo",
]);

const WORKSPACE_MEDIA_LIBRARY_NON_AI_CLASSIFIERS = new Set([
  "custom",
  "custom_photo",
  "custom_video",
  "library",
  "media_library",
  "pexels",
  "pixabay",
  "stock",
  "stock_photo",
  "stock_video",
  "telegram",
  "unsplash",
  "upload",
  "uploaded",
  "uploaded_photo",
  "uploaded_video",
  "user",
  "user_upload",
]);

const isWorkspaceDurableFinalVideoAsset = (
  asset: ReturnType<typeof buildWorkspaceMediaAssetRef>,
) => {
  if (!asset) {
    return false;
  }

  const mediaType = normalizeText(asset.mediaType).toLowerCase();
  const mimeType = normalizeText(asset.mimeType).toLowerCase();
  const isVideoAsset = mediaType === "video" || mimeType.startsWith("video/");
  if (!isVideoAsset) {
    return false;
  }

  const hasSegmentIndex = typeof asset.segmentIndex === "number" && asset.segmentIndex >= 0;
  const classifiers = [
    asset.kind,
    asset.role,
    asset.sourceKind,
    asset.libraryKind,
  ].map(normalizeWorkspaceDurableAssetClassifier);

  return classifiers.some((classifier) => {
    if (!classifier) {
      return false;
    }

    if (WORKSPACE_MEDIA_LIBRARY_FINAL_VIDEO_CLASSIFIERS.has(classifier)) {
      return true;
    }

    return (
      !hasSegmentIndex &&
      (WORKSPACE_MEDIA_LIBRARY_UNSEGMENTED_FINAL_CLASSIFIERS.has(classifier) ||
        classifier.endsWith("_final_video") ||
        classifier.endsWith("_full_video") ||
        classifier.endsWith("_complete_video"))
    );
  });
};

const getWorkspaceDurableAssetClassifiers = (
  asset: ReturnType<typeof buildWorkspaceMediaAssetRef>,
) =>
  [
    asset?.kind,
    asset?.role,
    asset?.sourceKind,
    asset?.libraryKind,
  ].map(normalizeWorkspaceDurableAssetClassifier);

const isWorkspaceDurableSourceInputAsset = (
  asset: ReturnType<typeof buildWorkspaceMediaAssetRef>,
) => {
  if (!asset) {
    return false;
  }

  return getWorkspaceDurableAssetClassifiers(asset).some((classifier) =>
    WORKSPACE_MEDIA_LIBRARY_SOURCE_INPUT_CLASSIFIERS.has(classifier),
  );
};

const isWorkspaceAiGeneratedClassifier = (classifier: string) =>
  WORKSPACE_MEDIA_LIBRARY_AI_GENERATED_CLASSIFIERS.has(classifier);

const isWorkspaceNonAiClassifier = (classifier: string) =>
  WORKSPACE_MEDIA_LIBRARY_NON_AI_CLASSIFIERS.has(classifier) ||
  classifier.includes("custom") ||
  classifier.includes("stock") ||
  classifier.includes("upload") ||
  classifier.includes("uploaded") ||
  classifier.includes("user_upload");

const isWorkspaceDurableAiGeneratedAsset = (
  asset: ReturnType<typeof buildWorkspaceMediaAssetRef>,
) => {
  if (!asset) {
    return false;
  }

  const classifiers = getWorkspaceDurableAssetClassifiers(asset).filter(Boolean);
  if (classifiers.some(isWorkspaceNonAiClassifier)) {
    return false;
  }

  if (classifiers.some(isWorkspaceAiGeneratedClassifier)) {
    return true;
  }

  const storageKey = normalizeText(asset.storageKey).toLowerCase();
  return (
    storageKey.includes("/source_ai_image/") ||
    storageKey.includes("/source_ai_photo/") ||
    storageKey.includes("wavespeed") ||
    storageKey.includes("deapi")
  );
};

export const getWorkspaceMediaLibraryKindFromDurableAsset = (
  asset: ReturnType<typeof buildWorkspaceMediaAssetRef>,
): WorkspaceMediaLibraryItemKind | null => {
  if (
    !asset ||
    isWorkspaceDurableFinalVideoAsset(asset) ||
    isWorkspaceDurableSourceInputAsset(asset) ||
    !isWorkspaceDurableAiGeneratedAsset(asset)
  ) {
    return null;
  }

  const mediaType = normalizeText(asset.mediaType).toLowerCase();
  const classifier = `${normalizeText(asset.kind)} ${normalizeText(asset.role)} ${normalizeText(asset.sourceKind)} ${normalizeText(asset.libraryKind)}`.toLowerCase();

  if (mediaType === "video") {
    if (classifier.includes("photo_animation") || classifier.includes("animation")) {
      return "photo_animation";
    }

    return "ai_video";
  }

  if (mediaType === "photo" || mediaType === "image") {
    if (classifier.includes("image_edit") || classifier.includes("upscale") || classifier.includes("i2i")) {
      return "image_edit";
    }

    return "ai_photo";
  }

  return null;
};

const buildWorkspaceDurableMediaAssetProxyUrl = (assetId: number) => `/api/workspace/media-assets/${assetId}`;
const buildWorkspaceDurableMediaAssetPlaybackUrl = (assetId: number) =>
  `/api/workspace/media-assets/${assetId}/playback`;

const buildWorkspaceDurableMediaAssetPreviewUrl = (
  assetId: number,
  previewKind: WorkspaceMediaLibraryItem["previewKind"],
) => (previewKind === "video" ? buildWorkspaceDurableMediaAssetPlaybackUrl(assetId) : buildWorkspaceDurableMediaAssetProxyUrl(assetId));

const buildWorkspaceDurableMediaAssetPosterVersion = (
  asset: NonNullable<ReturnType<typeof buildWorkspaceMediaAssetRef>>,
) => {
  const versionParts = [
    asset.createdAt,
    asset.expiresAt,
    asset.storageKey,
    asset.mimeType,
    asset.assetId ? String(asset.assetId) : null,
  ].filter((value): value is string => Boolean(normalizeText(value)));

  return versionParts.join(":");
};

const buildWorkspaceDurableMediaAssetPosterUrl = (
  asset: NonNullable<ReturnType<typeof buildWorkspaceMediaAssetRef>>,
) => {
  const assetId = asset.assetId ?? 0;
  const posterUrl = new URL(`/api/workspace/media-assets/${assetId}/poster`, env.appUrl);
  const version = buildWorkspaceDurableMediaAssetPosterVersion(asset);
  if (version) {
    posterUrl.searchParams.set("v", version);
  }

  return `${posterUrl.pathname}${posterUrl.search}`;
};

const getWorkspaceMediaLibraryItemSpecificityRank = (item: WorkspaceMediaLibraryItem) => {
  if (item.kind === "photo_animation" || item.kind === "image_edit") {
    return 3;
  }

  if (item.kind === "ai_video" || item.kind === "ai_photo") {
    return 2;
  }

  return 1;
};

export const dedupeWorkspaceMediaLibraryPageItems = (items: WorkspaceMediaLibraryItem[]) => {
  const dedupedItems = dedupeWorkspaceMediaLibraryItems(items);
  const itemIndexesByAssetId = new Map<number, number>();
  const result: WorkspaceMediaLibraryItem[] = [];

  for (const item of dedupedItems) {
    const assetId =
      typeof item.assetId === "number" && item.assetId > 0
        ? item.assetId
        : null;

    if (!assetId) {
      result.push(item);
      continue;
    }

    const existingIndex = itemIndexesByAssetId.get(assetId);
    if (existingIndex === undefined) {
      itemIndexesByAssetId.set(assetId, result.length);
      result.push(item);
      continue;
    }

    const existingItem = result[existingIndex];
    if (
      getWorkspaceMediaLibraryItemSpecificityRank(item) >
      getWorkspaceMediaLibraryItemSpecificityRank(existingItem)
    ) {
      result[existingIndex] = item;
    }
  }

  return result;
};

export const buildWorkspaceDurableMediaLibraryItem = (
  rawAsset: AdsflowWebMediaLibraryAssetPayload,
): WorkspaceMediaLibraryItem | null => {
  const links = Array.isArray(rawAsset.links)
    ? rawAsset.links.filter(isAdsflowProjectMediaLinkPayload)
    : [];
  const canonicalPayload = {
    ...rawAsset,
    project_id: getAdsflowDurableAssetProjectId(rawAsset, links) ?? rawAsset.project_id,
    role: getAdsflowDurableAssetRole(rawAsset, links) || rawAsset.role,
    segment_index: getAdsflowDurableAssetSegmentIndex(rawAsset, links) ?? rawAsset.segment_index,
  } satisfies AdsflowMediaAssetPayload;
  const asset = buildWorkspaceMediaAssetRef(canonicalPayload);
  const assetId = asset?.assetId ?? null;
  if (!asset || !assetId || assetId <= 0 || asset.lifecycle !== "ready") {
    return null;
  }

  const kind = getWorkspaceMediaLibraryKindFromDurableAsset(asset);
  if (!kind) {
    return null;
  }

  const projectId = asset.projectId ?? 0;
  const segmentIndex = asset.segmentIndex ?? 0;
  const segmentListIndex = Math.max(0, segmentIndex);
  const projectTitle = projectId > 0 ? `Проект #${projectId}` : "Медиатека";
  const previewKind = kind === "ai_photo" || kind === "image_edit" ? "image" : "video";
  const previewUrl = buildWorkspaceDurableMediaAssetPreviewUrl(assetId, previewKind);
  const downloadUrl = buildWorkspaceDurableMediaAssetProxyUrl(assetId);
  const rawKind = normalizeText(asset.kind || asset.role);
  const downloadStem =
    projectId > 0
      ? `${projectTitle}-asset-${assetId}`
      : `${rawKind || "media"}-${assetId}`;

  return createWorkspaceMediaLibraryItem({
    assetExpiresAt: asset.expiresAt,
    assetId,
    assetKind: asset.kind,
    assetLifecycle: asset.lifecycle,
    assetMediaType: asset.mediaType,
    createdAt: asset.createdAt,
    downloadName:
      previewKind === "video"
        ? getWorkspaceVideoDownloadName(downloadStem)
        : getWorkspaceImageDownloadName(downloadStem),
    downloadUrl,
    kind,
    previewKind,
    previewPosterUrl: previewKind === "video" ? buildWorkspaceDurableMediaAssetPosterUrl(asset) : null,
    previewUrl,
    projectId,
    projectTitle,
    segmentIndex,
    segmentListIndex,
    source: "persisted",
  });
};

const fetchWorkspaceDurableMediaLibraryItems = async (
  user: MediaLibraryUser,
  options?: {
    existingItems?: WorkspaceMediaLibraryItem[];
    limit?: number;
    offset?: number;
  },
): Promise<{ hasMore: boolean; items: WorkspaceMediaLibraryItem[] }> => {
  if (!env.adsflowApiBaseUrl || !env.adsflowAdminToken) {
    return {
      hasMore: false,
      items: [],
    };
  }

  const externalUserId = await resolvePreferredExternalUserId(user);
  const targetItemCount = Math.max(
    1,
    (options?.offset ?? 0) + (options?.limit ?? WORKSPACE_MEDIA_LIBRARY_DEFAULT_LIMIT),
  );
  const requestPageSize = Math.max(
    WORKSPACE_MEDIA_LIBRARY_DEFAULT_LIMIT,
    Math.min(WORKSPACE_MEDIA_LIBRARY_MAX_LIMIT, options?.limit ?? WORKSPACE_MEDIA_LIBRARY_MAX_LIMIT),
  );
  const existingItems = options?.existingItems ?? [];
  const collectedItems: WorkspaceMediaLibraryItem[] = [];
  const visitedCursors = new Set<number>();
  let nextCursor = 0;
  let hasMore = false;

  while (!visitedCursors.has(nextCursor)) {
    visitedCursors.add(nextCursor);
    const payload = await postAdsflowJson<AdsflowWebMediaLibraryResponse>(
      "/api/web/media-library",
      {
        admin_token: env.adsflowAdminToken,
        external_user_id: externalUserId,
        user_email: user.email ?? undefined,
        user_name: user.name ?? undefined,
        limit: requestPageSize,
        cursor: nextCursor,
        status: "ready",
      },
      upstreamPolicies.adsflowMetadata,
      {
        assetKind: "media-library",
        endpoint: "web.media-library",
      },
    ).catch((error) => {
      console.warn("[workspace] Failed to load durable media library", {
        error: error instanceof Error ? error.message : "Unknown durable media library error.",
      });
      return null;
    });

    if (!Array.isArray(payload?.assets)) {
      return {
        hasMore: false,
        items: collectedItems,
      };
    }

    collectedItems.push(
      ...payload.assets
        .map((item) =>
          isAdsflowMediaAssetPayload(item)
            ? buildWorkspaceDurableMediaLibraryItem(item as AdsflowWebMediaLibraryAssetPayload)
            : null,
        )
        .filter((item): item is WorkspaceMediaLibraryItem => Boolean(item)),
    );

    const dedupedVisibleCount = dedupeWorkspaceMediaLibraryPageItems([
      ...existingItems,
      ...collectedItems,
    ]).length;
    const payloadNextCursor = normalizeInteger(payload.next_cursor);
    if (payloadNextCursor === null) {
      hasMore = false;
      break;
    }

    if (dedupedVisibleCount >= targetItemCount) {
      hasMore = true;
      break;
    }

    nextCursor = payloadNextCursor;
  }

  return {
    hasMore,
    items: collectedItems,
  };
};

const getWorkspacePhotoOriginalPreviewUrl = (segment: WorkspaceSegmentEditorSegment) =>
  segment.originalExternalPreviewUrl ??
  segment.originalExternalPlaybackUrl ??
  null;

const getWorkspacePhotoOriginalDownloadUrl = (segment: WorkspaceSegmentEditorSegment) =>
  segment.originalExternalPlaybackUrl ??
  segment.originalExternalPreviewUrl ??
  null;

const getWorkspacePhotoOriginalComparisonPreviewUrl = (segment: WorkspaceSegmentEditorSegment) =>
  segment.originalPreviewUrl ??
  segment.originalPlaybackUrl ??
  segment.originalExternalPreviewUrl ??
  segment.originalExternalPlaybackUrl ??
  null;

const getWorkspacePhotoOriginalComparisonPlaybackUrl = (segment: WorkspaceSegmentEditorSegment) =>
  segment.originalPlaybackUrl ??
  segment.originalPreviewUrl ??
  segment.originalExternalPlaybackUrl ??
  segment.originalExternalPreviewUrl ??
  null;

const getWorkspacePhotoCurrentComparisonPreviewUrl = (segment: WorkspaceSegmentEditorSegment) =>
  segment.currentPreviewUrl ??
  segment.currentPlaybackUrl ??
  segment.currentExternalPreviewUrl ??
  segment.currentExternalPlaybackUrl ??
  null;

const getWorkspacePhotoCurrentComparisonPlaybackUrl = (segment: WorkspaceSegmentEditorSegment) =>
  segment.currentPlaybackUrl ??
  segment.currentPreviewUrl ??
  segment.currentExternalPlaybackUrl ??
  segment.currentExternalPreviewUrl ??
  null;

const getWorkspacePhotoAnimationPreviewUrl = (segment: WorkspaceSegmentEditorSegment) =>
  segment.currentPreviewUrl ??
  segment.currentPlaybackUrl ??
  segment.currentExternalPreviewUrl ??
  segment.currentExternalPlaybackUrl ??
  null;

const getWorkspacePhotoAnimationDownloadUrl = (segment: WorkspaceSegmentEditorSegment) =>
  segment.currentPlaybackUrl ??
  segment.currentExternalPlaybackUrl ??
  segment.currentPreviewUrl ??
  segment.currentExternalPreviewUrl ??
  null;

const isWorkspaceMediaLibraryAssetVisible = (assetId: number | null | undefined, lifecycle: string | null | undefined) => {
  if (typeof assetId !== "number" || assetId <= 0) {
    return true;
  }

  const normalizedLifecycle = normalizeText(lifecycle).toLowerCase();
  return normalizedLifecycle !== "deleted" && normalizedLifecycle !== "expired";
};

const toWorkspaceMediaIndexStoredItems = (items: WorkspaceMediaLibraryItem[]): WorkspaceMediaIndexStoredItem[] =>
  items.map((item) => ({
    assetExpiresAt: item.assetExpiresAt,
    assetId: item.assetId,
    assetKind: item.assetKind,
    assetLifecycle: item.assetLifecycle,
    assetMediaType: item.assetMediaType,
    createdAt: item.createdAt,
    kind: item.kind,
    previewKind: item.previewKind,
    previewPosterUrl: item.previewPosterUrl,
    previewUrl: item.previewUrl,
    segmentIndex: item.segmentIndex,
    segmentListIndex: item.segmentListIndex,
  }));

const hydrateWorkspaceMediaLibraryIndexEntry = (
  project: WorkspaceProject & { adId: number },
  entry: WorkspaceMediaIndexProjectEntry,
) => {
  const projectTitle = getWorkspaceProjectDisplayTitle(project);
  const downloadToken = getWorkspaceMediaLibraryProjectVersion(project);
  const fallbackCreatedAt = getWorkspaceMediaLibraryProjectCreatedAt(project);

  return entry.items
    .filter((item) => isWorkspaceMediaLibraryAssetVisible(item.assetId ?? null, item.assetLifecycle ?? null))
    .map((item) => {
      const assetId =
        typeof item.assetId === "number" && Number.isFinite(item.assetId) && item.assetId > 0
          ? Math.trunc(item.assetId)
          : null;
      const previewUrl = assetId ? buildWorkspaceDurableMediaAssetPreviewUrl(assetId, item.previewKind) : item.previewUrl;
      const downloadUrl = assetId
        ? buildWorkspaceDurableMediaAssetProxyUrl(assetId)
        : appendUrlToken(
          previewUrl,
          "download",
          `${downloadToken}:${item.segmentIndex}:${item.kind}`,
        );

      return createWorkspaceMediaLibraryItem({
        assetExpiresAt: item.assetExpiresAt ?? null,
        assetId,
        assetKind: item.assetKind ?? null,
        assetLifecycle: item.assetLifecycle ?? null,
        assetMediaType: item.assetMediaType ?? null,
        createdAt: item.createdAt ?? fallbackCreatedAt,
        downloadName: buildWorkspaceMediaLibraryDownloadName(projectTitle, item.segmentListIndex, item.kind),
        downloadUrl,
        kind: item.kind,
        previewKind: item.previewKind,
        previewPosterUrl: item.previewPosterUrl,
        previewUrl,
        projectId: project.adId,
        projectTitle,
        segmentIndex: item.segmentIndex,
        segmentListIndex: item.segmentListIndex,
        source: "persisted",
      });
    });
};

const isWorkspaceMediaIndexEntryUsable = (entry: WorkspaceMediaIndexProjectEntry) =>
  entry.items.every((item) => {
    if (item.previewKind === "image") {
      return isWorkspaceRenderableMediaPreviewUrl(item.previewUrl);
    }

    if (!normalizeText(item.previewUrl)) {
      return false;
    }

    return Boolean(item.assetId) || !normalizeText(item.previewUrl).includes("/api/workspace/project-segment-video");
  });

const isWorkspaceAiGeneratedSourceKind = (value: unknown) =>
  isWorkspaceAiGeneratedClassifier(normalizeWorkspaceDurableAssetClassifier(value));

const isWorkspaceMediaLibraryAiGeneratedAsset = (
  asset: WorkspaceSegmentEditorSegment["currentAsset"] | WorkspaceSegmentEditorSegment["originalAsset"],
) => Boolean(asset && isWorkspaceDurableAiGeneratedAsset(asset));

const isWorkspaceMediaLibraryAiGeneratedSegmentSource = (
  sourceKind: unknown,
  asset: WorkspaceSegmentEditorSegment["currentAsset"] | WorkspaceSegmentEditorSegment["originalAsset"],
) => isWorkspaceAiGeneratedSourceKind(sourceKind) || isWorkspaceMediaLibraryAiGeneratedAsset(asset);

export const buildWorkspacePersistedMediaLibraryItems = (
  project: WorkspaceProject & { adId: number },
  session: WorkspaceSegmentEditorSession,
) => {
  const projectId = project.adId;
  const projectTitle = getWorkspaceProjectDisplayTitle(project);
  const downloadToken = project.updatedAt || project.generatedAt || project.createdAt || project.id;
  const fallbackCreatedAt = getWorkspaceMediaLibraryProjectCreatedAt(project);

  return session.segments.flatMap((segment, segmentListIndex) => {
    const originalPreviewUrl = segment.originalPreviewUrl;
    const originalPlaybackUrl = segment.originalPlaybackUrl ?? segment.originalPreviewUrl;
    const currentPreviewUrl = segment.currentPreviewUrl ?? segment.currentPlaybackUrl;
    const currentPlaybackUrl = segment.currentPlaybackUrl ?? segment.currentPreviewUrl;
    const items: WorkspaceMediaLibraryItem[] = [];

    if (segment.mediaType !== "photo") {
      const hasAiGeneratedCurrentSource = isWorkspaceMediaLibraryAiGeneratedSegmentSource(
        segment.currentSourceKind,
        segment.currentAsset,
      );
      const hasAiVideoVariant =
        hasAiGeneratedCurrentSource &&
        Boolean(currentPreviewUrl || currentPlaybackUrl) &&
        (!originalPreviewUrl ||
          !originalPlaybackUrl ||
          !areWorkspaceMediaLibraryUrlsEqual(currentPreviewUrl, originalPreviewUrl) ||
          !areWorkspaceMediaLibraryUrlsEqual(currentPlaybackUrl, originalPlaybackUrl));

      if (hasAiVideoVariant) {
        const aiVideoPreviewUrl = currentPlaybackUrl ?? currentPreviewUrl;
        if (aiVideoPreviewUrl && isWorkspaceMediaLibraryAssetVisible(segment.currentAsset?.assetId, segment.currentAsset?.lifecycle)) {
          const originalAssetMediaType = normalizeText(segment.originalAsset?.mediaType).toLowerCase();
          const originalAssetMimeType = normalizeText(segment.originalAsset?.mimeType).toLowerCase();
          const isPhotoAnimationVariant =
            originalAssetMediaType === "photo" ||
            originalAssetMediaType === "image" ||
            originalAssetMimeType.startsWith("image/");
          const videoKind = isPhotoAnimationVariant ? "photo_animation" : "ai_video";
          const videoSuffix = isPhotoAnimationVariant ? "animation" : "ai-video";
          items.push(
            createWorkspaceMediaLibraryItem({
              assetExpiresAt: segment.currentAsset?.expiresAt ?? null,
              assetId: segment.currentAsset?.assetId ?? null,
              assetKind: segment.currentAsset?.kind ?? null,
              assetLifecycle: segment.currentAsset?.lifecycle ?? null,
              assetMediaType: segment.currentAsset?.mediaType ?? null,
              createdAt: segment.currentAsset?.createdAt ?? fallbackCreatedAt,
              downloadName: getWorkspaceVideoDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-${videoSuffix}`),
              downloadUrl: appendUrlToken(
                currentPlaybackUrl ?? aiVideoPreviewUrl,
                "download",
                `${downloadToken}:${segment.index}:${videoSuffix}`,
              ),
              kind: videoKind,
              previewKind: "video",
              previewPosterUrl:
                isPhotoAnimationVariant
                  ? getWorkspacePhotoOriginalPreviewUrl(segment) ??
                    buildWorkspaceMediaLibraryPreviewUrl({
                      kind: videoKind,
                      projectId,
                      segmentIndex: segment.index,
                      version: buildWorkspaceMediaLibraryPreviewVersion(
                        currentPreviewUrl ?? currentPlaybackUrl ?? originalPreviewUrl,
                        `${downloadToken}:${segment.index}:${videoSuffix}`,
                      ),
                    })
                  : buildWorkspaceMediaLibraryPreviewUrl({
                    kind: videoKind,
                    projectId,
                    segmentIndex: segment.index,
                    version: buildWorkspaceMediaLibraryPreviewVersion(
                      currentPreviewUrl ?? currentPlaybackUrl ?? originalPreviewUrl,
                      `${downloadToken}:${segment.index}:${videoSuffix}`,
                    ),
                  }),
              previewUrl: aiVideoPreviewUrl,
              projectId,
              projectTitle,
              segmentIndex: segment.index,
              segmentListIndex,
              source: "persisted",
            }),
          );
        }
      }

      return items;
    }

    const originalPhotoPreviewUrl = getWorkspacePhotoOriginalPreviewUrl(segment);
    const originalPhotoDownloadUrl = getWorkspacePhotoOriginalDownloadUrl(segment);
    const hasAiGeneratedOriginalSource = isWorkspaceMediaLibraryAiGeneratedSegmentSource(
      segment.originalSourceKind,
      segment.originalAsset,
    );

    if (
      hasAiGeneratedOriginalSource &&
      originalPhotoPreviewUrl &&
      isWorkspaceMediaLibraryAssetVisible(segment.originalAsset?.assetId, segment.originalAsset?.lifecycle)
    ) {
      items.push(
        createWorkspaceMediaLibraryItem({
          assetExpiresAt: segment.originalAsset?.expiresAt ?? null,
          assetId: segment.originalAsset?.assetId ?? null,
          assetKind: segment.originalAsset?.kind ?? null,
          assetLifecycle: segment.originalAsset?.lifecycle ?? null,
          assetMediaType: segment.originalAsset?.mediaType ?? null,
          createdAt: segment.originalAsset?.createdAt ?? fallbackCreatedAt,
          downloadName: getWorkspaceImageDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}`),
          downloadUrl: appendUrlToken(
            originalPhotoDownloadUrl ?? originalPhotoPreviewUrl,
            "download",
            `${downloadToken}:${segment.index}:original`,
          ),
          kind: "ai_photo",
          previewKind: "image",
          previewPosterUrl: buildWorkspaceMediaLibraryPreviewUrl({
            kind: "ai_photo",
            projectId,
            segmentIndex: segment.index,
            version: buildWorkspaceMediaLibraryPreviewVersion(
              originalPhotoPreviewUrl,
              `${downloadToken}:${segment.index}:ai-photo`,
            ),
          }),
          previewUrl: originalPhotoPreviewUrl,
          projectId,
          projectTitle,
          segmentIndex: segment.index,
          segmentListIndex,
          source: "persisted",
        }),
      );
    }

    const hasAnimatedVariant =
      isWorkspaceMediaLibraryAiGeneratedSegmentSource(segment.currentSourceKind, segment.currentAsset) &&
      Boolean(
        getWorkspacePhotoAnimationPreviewUrl(segment) ||
        getWorkspacePhotoAnimationDownloadUrl(segment),
      ) &&
      (!areWorkspaceMediaLibraryUrlsEqual(
        getWorkspacePhotoCurrentComparisonPreviewUrl(segment),
        getWorkspacePhotoOriginalComparisonPreviewUrl(segment),
      ) ||
        !areWorkspaceMediaLibraryUrlsEqual(
          getWorkspacePhotoCurrentComparisonPlaybackUrl(segment),
          getWorkspacePhotoOriginalComparisonPlaybackUrl(segment),
        ));

    if (hasAnimatedVariant) {
      const animatedPreviewUrl = getWorkspacePhotoAnimationPreviewUrl(segment);
      const animatedDownloadUrl = getWorkspacePhotoAnimationDownloadUrl(segment);
      const animatedPosterUrl =
        originalPhotoPreviewUrl ??
        buildWorkspaceMediaLibraryPreviewUrl({
          kind: "photo_animation",
          projectId,
          segmentIndex: segment.index,
          version: buildWorkspaceMediaLibraryPreviewVersion(
            animatedPreviewUrl ?? animatedDownloadUrl ?? originalPhotoPreviewUrl,
            `${downloadToken}:${segment.index}:photo-animation`,
          ),
        });
      if (animatedPreviewUrl && isWorkspaceMediaLibraryAssetVisible(segment.currentAsset?.assetId, segment.currentAsset?.lifecycle)) {
        items.push(
          createWorkspaceMediaLibraryItem({
            assetExpiresAt: segment.currentAsset?.expiresAt ?? null,
            assetId: segment.currentAsset?.assetId ?? null,
            assetKind: segment.currentAsset?.kind ?? null,
            assetLifecycle: segment.currentAsset?.lifecycle ?? null,
            assetMediaType: segment.currentAsset?.mediaType ?? null,
            createdAt: segment.currentAsset?.createdAt ?? fallbackCreatedAt,
            downloadName: getWorkspaceVideoDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-animation`),
            downloadUrl: appendUrlToken(
              animatedDownloadUrl ?? animatedPreviewUrl,
              "download",
              `${downloadToken}:${segment.index}:animation`,
            ),
            kind: "photo_animation",
            previewKind: "video",
            previewPosterUrl: animatedPosterUrl,
            previewUrl: animatedPreviewUrl,
            projectId,
            projectTitle,
            segmentIndex: segment.index,
            segmentListIndex,
            source: "persisted",
          }),
        );
      }
    }

    return items;
  });
};

const buildWorkspaceMediaLibraryIndexEntry = async (
  user: MediaLibraryUser,
  project: WorkspaceProject & { adId: number },
  options?: {
    bypassCache?: boolean;
  },
) => {
  const session = await getWorkspaceSegmentEditorSessionForAccessibleProject(user, project.adId, {
    bypassCache: options?.bypassCache,
  });
  const items = buildWorkspacePersistedMediaLibraryItems(project, session);
  const entry: WorkspaceMediaIndexProjectEntry = {
    items: toWorkspaceMediaIndexStoredItems(items),
    projectId: project.adId,
    projectVersion: getWorkspaceMediaLibraryProjectVersion(project),
    updatedAt: new Date().toISOString(),
  };
  await upsertWorkspaceMediaIndexProjectEntry(user, entry);
  return entry;
};

const warmWorkspaceMediaLibraryProjectIndexEntries = (
  user: MediaLibraryUser,
  projects: Array<WorkspaceProject & { adId: number }>,
  options?: {
    bypassCache?: boolean;
  },
) => {
  if (!projects.length) {
    return;
  }

  void mapWithConcurrencyLimit(projects, 2, async (project) => {
    const warmKey = getWorkspaceMediaLibraryIndexWarmKey(user, project.adId);
    if (workspaceMediaLibraryIndexWarmInFlight.has(warmKey)) {
      return;
    }

    workspaceMediaLibraryIndexWarmInFlight.add(warmKey);
    try {
      await buildWorkspaceMediaLibraryIndexEntry(user, project, options);
    } catch (error) {
      console.warn("[workspace] Failed to warm media library index entry", {
        error: error instanceof Error ? error.message : "Unknown media library index warmup error.",
        projectId: project.adId,
      });
    } finally {
      workspaceMediaLibraryIndexWarmInFlight.delete(warmKey);
    }
  });
};

type WorkspaceMediaLibraryIndexedRecords = {
  hasPendingProjects: boolean;
  records: Array<{
    entry: WorkspaceMediaIndexProjectEntry;
    project: WorkspaceProject & { adId: number };
  }>;
};

const loadWorkspaceMediaLibraryIndexEntries = async (
  user: MediaLibraryUser,
  options?: {
    bypassCache?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<WorkspaceMediaLibraryIndexedRecords> => {
  const projects = await getWorkspaceProjects(user);
  const readyProjects = projects.filter(
    (project): project is WorkspaceProject & { adId: number } =>
      project.status === "ready" && typeof project.adId === "number" && project.adId > 0,
  );

  if (!readyProjects.length) {
    return {
      hasPendingProjects: false,
      records: [],
    };
  }

  if (options?.bypassCache) {
    await clearWorkspaceMediaIndex(user);
  }

  const validProjectVersions = new Map(
    readyProjects.map((project) => [project.adId, getWorkspaceMediaLibraryProjectVersion(project)] as const),
  );
  await pruneWorkspaceMediaIndexProjects(user, validProjectVersions);

  const existingEntries = await listWorkspaceMediaIndexProjectEntries(user);
  const entriesByProjectId = new Map(existingEntries.map((entry) => [entry.projectId, entry] as const));
  const targetItemCount = Math.max(1, (options?.offset ?? 0) + (options?.limit ?? WORKSPACE_MEDIA_LIBRARY_DEFAULT_LIMIT));
  const resolvedEntries: Array<{
    entry: WorkspaceMediaIndexProjectEntry;
    project: WorkspaceProject & { adId: number };
  }> = [];
  const remainingProjects: Array<WorkspaceProject & { adId: number }> = [];
  let indexedItemCount = 0;
  let firstFailure: Error | null = null;
  let hasSuccessfulProjectLoad = false;

  for (const project of readyProjects) {
    const projectVersion = getWorkspaceMediaLibraryProjectVersion(project);
    let entry = entriesByProjectId.get(project.adId) ?? null;

    if (entry && normalizeText(entry.projectVersion) !== projectVersion) {
      entry = null;
    }

    if (entry && !isWorkspaceMediaIndexEntryUsable(entry)) {
      entry = null;
    }

    if (!entry) {
      if (indexedItemCount >= targetItemCount) {
        remainingProjects.push(project);
        continue;
      }

      try {
        entry = await buildWorkspaceMediaLibraryIndexEntry(user, project, options);
        entriesByProjectId.set(entry.projectId, entry);
        hasSuccessfulProjectLoad = true;
      } catch (error) {
        if (!firstFailure) {
          firstFailure = error instanceof Error ? error : new Error("Не удалось загрузить медиатеку сегментов.");
        }
        continue;
      }
    }

    resolvedEntries.push({ entry, project });
    indexedItemCount += entry.items.length;
  }

  if (resolvedEntries.length === 0 && firstFailure && !hasSuccessfulProjectLoad) {
    console.warn("[workspace] Failed to build media library project index, using available durable media only", {
      error: firstFailure.message,
    });
  }

  if (remainingProjects.length > 0) {
    warmWorkspaceMediaLibraryProjectIndexEntries(user, remainingProjects, options);
  }

  return {
    hasPendingProjects: remainingProjects.length > 0,
    records: resolvedEntries,
  };
};

const findWorkspaceMediaLibrarySegment = (
  session: WorkspaceSegmentEditorSession,
  segmentIndex: number,
): WorkspaceSegmentEditorSegment | null =>
  session.segments.find((segment) => segment.index === segmentIndex) ?? null;

export const getWorkspaceMediaLibrarySegmentPreviewUrl = (
  segment: WorkspaceSegmentEditorSegment,
  kind: WorkspaceMediaLibraryItemKind,
) => {
  if (kind === "ai_photo") {
    return getWorkspacePhotoOriginalPreviewUrl(segment);
  }

  if (kind === "image_edit") {
    return (
      segment.currentExternalPreviewUrl ??
      segment.currentExternalPlaybackUrl ??
      segment.originalExternalPreviewUrl ??
      segment.originalExternalPlaybackUrl ??
      segment.currentPreviewUrl ??
      segment.currentPlaybackUrl ??
      segment.originalPreviewUrl ??
      segment.originalPlaybackUrl ??
      null
    );
  }

  return segment.currentPreviewUrl ?? segment.currentPlaybackUrl ?? segment.originalPreviewUrl ?? segment.originalPlaybackUrl ?? null;
};

const resolveWorkspaceMediaLibraryPreviewSource = async (
  user: MediaLibraryUser,
  rawPreviewUrl: string,
) => {
  const normalizedPreviewUrl = normalizeText(rawPreviewUrl);
  if (!normalizedPreviewUrl) {
    return null;
  }

  let resolvedUrl: URL;
  try {
    resolvedUrl = new URL(normalizedPreviewUrl, env.appUrl);
  } catch {
    return null;
  }

  const version = getWorkspaceMediaLibraryUrlMarker(normalizedPreviewUrl) || normalizedPreviewUrl;

  if (resolvedUrl.pathname === "/api/workspace/project-segment-video") {
    const projectId = Number(resolvedUrl.searchParams.get("projectId") ?? 0);
    const segmentIndex = Number(resolvedUrl.searchParams.get("segmentIndex") ?? -1);
    const source = String(resolvedUrl.searchParams.get("source") ?? "").trim();
    const delivery = String(resolvedUrl.searchParams.get("delivery") ?? "").trim();

    if (
      !Number.isFinite(projectId) ||
      projectId <= 0 ||
      !Number.isFinite(segmentIndex) ||
      segmentIndex < 0 ||
      !isWorkspaceSegmentEditorVideoSource(source) ||
      !isWorkspaceSegmentEditorVideoDelivery(delivery)
    ) {
      return null;
    }

    const target = await getWorkspaceProjectSegmentVideoProxyTarget(user, {
      delivery,
      projectId,
      segmentIndex,
      source,
    });

    return {
      headers: target.headers,
      upstreamUrl: target.url,
      version,
    };
  }

  if (resolvedUrl.protocol === "http:" || resolvedUrl.protocol === "https:" || resolvedUrl.protocol === "file:") {
    return {
      headers: undefined,
      upstreamUrl: resolvedUrl,
      version,
    };
  }

  return null;
};

export class WorkspaceMediaLibraryPreviewError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "WorkspaceMediaLibraryPreviewError";
    this.statusCode = statusCode;
  }
}

export const getWorkspaceMediaLibraryPreviewPath = async (
  user: MediaLibraryUser,
  options: {
    kind: WorkspaceMediaLibraryItemKind;
    projectId: number;
    segmentIndex: number;
    version?: string | null;
  },
) => {
  if (!Number.isFinite(options.projectId) || options.projectId <= 0) {
    throw new WorkspaceMediaLibraryPreviewError("Project id is required.", 400);
  }

  if (!Number.isFinite(options.segmentIndex) || options.segmentIndex < 0) {
    throw new WorkspaceMediaLibraryPreviewError("Segment index is required.", 400);
  }

  if (!isWorkspaceMediaLibraryItemKind(options.kind)) {
    throw new WorkspaceMediaLibraryPreviewError("Media library preview kind is invalid.", 400);
  }

  const normalizedVersion = normalizeText(options.version);
  let rawPreviewUrl: string | null = null;

  if (normalizedVersion) {
    const indexEntry = await getWorkspaceMediaIndexProjectEntry(user, options.projectId, normalizedVersion);
    const indexedItem =
      indexEntry?.items.find(
        (item) => item.kind === options.kind && item.segmentIndex === options.segmentIndex,
      ) ?? null;
    rawPreviewUrl = indexedItem?.previewUrl ?? null;
  }

  if (!rawPreviewUrl) {
    const session = await getWorkspaceSegmentEditorSession(user, options.projectId);
    const segment = findWorkspaceMediaLibrarySegment(session, options.segmentIndex);
    if (!segment) {
      throw new WorkspaceMediaLibraryPreviewError("Segment preview source is unavailable.", 404);
    }

    rawPreviewUrl = getWorkspaceMediaLibrarySegmentPreviewUrl(segment, options.kind);
  }

  if (!rawPreviewUrl) {
    throw new WorkspaceMediaLibraryPreviewError("Segment preview source is unavailable.", 404);
  }

  const previewSource = await resolveWorkspaceMediaLibraryPreviewSource(user, rawPreviewUrl);
  if (!previewSource) {
    throw new WorkspaceMediaLibraryPreviewError("Segment preview source is unavailable.", 404);
  }

  const previewId = `workspace-media:${options.projectId}:${options.segmentIndex}:${options.kind}`;

  if (options.kind === "ai_photo" || options.kind === "image_edit") {
    return ensureWorkspacePreviewImage({
      cacheKey: getWorkspacePreviewImageCacheKey({
        previewId,
        targetUrl: previewSource.upstreamUrl,
        version: previewSource.version,
      }),
      upstreamHeaders: previewSource.headers,
      upstreamUrl: previewSource.upstreamUrl,
    });
  }

  return ensureWorkspaceVideoPoster({
    cacheKey: getWorkspaceVideoPosterCacheKey({
      posterId: previewId,
      targetUrl: previewSource.upstreamUrl,
      version: previewSource.version,
    }),
    upstreamHeaders: previewSource.headers,
    upstreamUrl: previewSource.upstreamUrl,
  });
};

export const invalidateWorkspaceMediaLibraryCache = (user: MediaLibraryUser) => {
  const cacheKey = getWorkspaceMediaLibraryCacheKey(user);
  if (!cacheKey) {
    return;
  }

  workspaceMediaLibraryCache.delete(cacheKey);
  workspaceMediaLibraryInFlight.delete(cacheKey);
};

export const getWorkspaceMediaLibraryItems = async (
  user: MediaLibraryUser,
  options?: {
    bypassCache?: boolean;
    cursor?: string | null;
    limit?: number;
  },
) => {
  const shouldBypassCache = Boolean(options?.bypassCache);
  const offset = parseWorkspaceMediaLibraryCursor(options?.cursor ?? null);
  const limit = parseWorkspaceMediaLibraryLimit(options?.limit);
  const baseCacheKey = getWorkspaceMediaLibraryCacheKey(user);
  const cacheKey = baseCacheKey ? `${baseCacheKey}:offset:${offset}:limit:${limit}` : null;

  if (!shouldBypassCache && cacheKey) {
    const cachedEntry = workspaceMediaLibraryCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      return cloneWorkspaceMediaLibraryPage(cachedEntry.page);
    }

    const inFlightRequest = workspaceMediaLibraryInFlight.get(cacheKey);
    if (inFlightRequest) {
      return cloneWorkspaceMediaLibraryPage(await inFlightRequest);
    }
  }

  const request = loadWorkspaceMediaLibraryIndexEntries(user, options).then(async (entries) => {
    const hydratedIndexItems = entries.records.flatMap(({ entry, project }) =>
      hydrateWorkspaceMediaLibraryIndexEntry(project, entry),
    );
    const durableMedia = await fetchWorkspaceDurableMediaLibraryItems(user, {
      existingItems: hydratedIndexItems,
      limit,
      offset,
    });
    const allItems = sortWorkspaceMediaLibraryItemsNewestFirst(
      dedupeWorkspaceMediaLibraryPageItems([
        ...hydratedIndexItems,
        ...durableMedia.items,
      ]),
    );
    const pageItems = allItems.slice(offset, offset + limit);
    const hasAdditionalItems =
      offset + pageItems.length < allItems.length ||
      entries.hasPendingProjects ||
      durableMedia.hasMore;
    const nextCursor = getWorkspaceMediaLibraryNextCursorForPage({
      hasAdditionalItems,
      offset,
      pageItemCount: pageItems.length,
    });
    const nextOffset = offset + pageItems.length;
    const total = hasAdditionalItems
      ? Math.max(allItems.length, nextOffset + 1)
      : allItems.length;

    return {
      items: pageItems,
      nextCursor,
      total,
    } satisfies WorkspaceMediaLibraryPage;
  });
  const shouldTrackInFlight = Boolean(cacheKey && !shouldBypassCache);

  if (shouldTrackInFlight && cacheKey) {
    workspaceMediaLibraryInFlight.set(cacheKey, request);
  }

  try {
    const page = await request;
    if (cacheKey) {
      workspaceMediaLibraryCache.set(cacheKey, {
        expiresAt: Date.now() + WORKSPACE_MEDIA_LIBRARY_CACHE_TTL_MS,
        page: cloneWorkspaceMediaLibraryPage(page),
      });
    }

    return cloneWorkspaceMediaLibraryPage(page);
  } finally {
    if (shouldTrackInFlight && cacheKey) {
      workspaceMediaLibraryInFlight.delete(cacheKey);
    }
  }
};
