import {
  areWorkspaceMediaLibraryUrlsEqual,
  createWorkspaceMediaLibraryItem,
  getWorkspaceImageDownloadName,
  getWorkspaceProjectDisplayTitle,
  getWorkspaceVideoDownloadName,
  type WorkspaceMediaLibraryItem,
} from "../src/lib/workspaceMediaLibrary.js";
import { getWorkspaceProjects, type WorkspaceProject } from "./projects.js";
import {
  getWorkspaceSegmentEditorSessionForAccessibleProject,
  type WorkspaceSegmentEditorSession,
} from "./segment-editor.js";

type MediaLibraryUser = {
  email?: string | null;
  id?: string | null;
  name?: string | null;
};

const WORKSPACE_MEDIA_LIBRARY_CACHE_TTL_MS = 60_000;
const WORKSPACE_MEDIA_LIBRARY_SEGMENT_CONCURRENCY = 6;

const workspaceMediaLibraryCache = new Map<string, { expiresAt: number; items: WorkspaceMediaLibraryItem[] }>();
const workspaceMediaLibraryInFlight = new Map<string, Promise<WorkspaceMediaLibraryItem[]>>();

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const getWorkspaceMediaLibraryCacheKey = (user: MediaLibraryUser) => {
  const userId = normalizeText(user.id);
  if (userId) {
    return `user:${userId}:workspace-media-library`;
  }

  const email = normalizeText(user.email).toLowerCase();
  return email ? `email:${email}:workspace-media-library` : null;
};

const cloneWorkspaceMediaLibraryItems = (items: WorkspaceMediaLibraryItem[]) => items.map((item) => ({ ...item }));

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

const buildWorkspacePersistedMediaLibraryItems = (
  project: WorkspaceProject & { adId: number },
  session: WorkspaceSegmentEditorSession,
) => {
  const projectId = project.adId;
  const projectTitle = getWorkspaceProjectDisplayTitle(project);
  const downloadToken = project.updatedAt || project.generatedAt || project.createdAt || project.id;

  return session.segments.flatMap((segment, segmentListIndex) => {
    const originalPreviewUrl = segment.originalPreviewUrl;
    const originalPlaybackUrl = segment.originalPlaybackUrl ?? segment.originalPreviewUrl;
    const currentPreviewUrl = segment.currentPreviewUrl ?? segment.currentPlaybackUrl;
    const currentPlaybackUrl = segment.currentPlaybackUrl ?? segment.currentPreviewUrl;
    const items: WorkspaceMediaLibraryItem[] = [];

    if (segment.mediaType !== "photo") {
      const hasAiVideoVariant =
        Boolean(currentPreviewUrl || currentPlaybackUrl) &&
        (!originalPreviewUrl ||
          !originalPlaybackUrl ||
          !areWorkspaceMediaLibraryUrlsEqual(currentPreviewUrl, originalPreviewUrl) ||
          !areWorkspaceMediaLibraryUrlsEqual(currentPlaybackUrl, originalPlaybackUrl));

      if (hasAiVideoVariant) {
        const aiVideoPreviewUrl = currentPlaybackUrl ?? currentPreviewUrl;
        if (aiVideoPreviewUrl) {
          items.push(
            createWorkspaceMediaLibraryItem({
              downloadName: getWorkspaceVideoDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-ai-video`),
              downloadUrl: appendUrlToken(
                currentPlaybackUrl ?? aiVideoPreviewUrl,
                "download",
                `${downloadToken}:${segment.index}:ai-video`,
              ),
              kind: "ai_video",
              previewKind: "video",
              previewPosterUrl: currentPreviewUrl ?? originalPreviewUrl,
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

    if (originalPreviewUrl) {
      items.push(
        createWorkspaceMediaLibraryItem({
          downloadName: getWorkspaceImageDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}`),
          downloadUrl: appendUrlToken(originalPreviewUrl, "download", `${downloadToken}:${segment.index}:original`),
          kind: "ai_photo",
          previewKind: "image",
          previewPosterUrl: originalPreviewUrl,
          previewUrl: originalPreviewUrl,
          projectId,
          projectTitle,
          segmentIndex: segment.index,
          segmentListIndex,
          source: "persisted",
        }),
      );
    }

    const hasAnimatedVariant =
      Boolean(currentPreviewUrl || currentPlaybackUrl) &&
      (!areWorkspaceMediaLibraryUrlsEqual(currentPreviewUrl, originalPreviewUrl) ||
        !areWorkspaceMediaLibraryUrlsEqual(currentPlaybackUrl, originalPlaybackUrl));

    if (hasAnimatedVariant) {
      const animatedPreviewUrl = currentPreviewUrl ?? currentPlaybackUrl;
      if (animatedPreviewUrl) {
        items.push(
          createWorkspaceMediaLibraryItem({
            downloadName: getWorkspaceVideoDownloadName(`${projectTitle}-segment-${segmentListIndex + 1}-animation`),
            downloadUrl: appendUrlToken(
              currentPlaybackUrl ?? animatedPreviewUrl,
              "download",
              `${downloadToken}:${segment.index}:animation`,
            ),
            kind: "photo_animation",
            previewKind: "video",
            previewPosterUrl: originalPreviewUrl ?? animatedPreviewUrl,
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

const loadWorkspaceMediaLibraryItems = async (
  user: MediaLibraryUser,
  options?: {
    bypassCache?: boolean;
  },
) => {
  const projects = await getWorkspaceProjects(user);
  const readyProjects = projects.filter(
    (project): project is WorkspaceProject & { adId: number } =>
      project.status === "ready" && typeof project.adId === "number" && project.adId > 0,
  );

  if (!readyProjects.length) {
    return [] as WorkspaceMediaLibraryItem[];
  }

  let firstFailure: Error | null = null;
  let hasSuccessfulProjectLoad = false;

  const results = await mapWithConcurrencyLimit(
    readyProjects,
    WORKSPACE_MEDIA_LIBRARY_SEGMENT_CONCURRENCY,
    async (project) => {
      try {
        const session = await getWorkspaceSegmentEditorSessionForAccessibleProject(user, project.adId, {
          bypassCache: options?.bypassCache,
        });
        hasSuccessfulProjectLoad = true;
        return buildWorkspacePersistedMediaLibraryItems(project, session);
      } catch (error) {
        if (!firstFailure) {
          firstFailure = error instanceof Error ? error : new Error("Не удалось загрузить медиатеку сегментов.");
        }
        return [] as WorkspaceMediaLibraryItem[];
      }
    },
  );

  const items = results.flatMap((result) => result);
  if (!items.length && firstFailure && !hasSuccessfulProjectLoad) {
    throw firstFailure;
  }

  return items;
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
  },
) => {
  const shouldBypassCache = Boolean(options?.bypassCache);
  const cacheKey = getWorkspaceMediaLibraryCacheKey(user);

  if (!shouldBypassCache && cacheKey) {
    const cachedEntry = workspaceMediaLibraryCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      return cloneWorkspaceMediaLibraryItems(cachedEntry.items);
    }

    const inFlightRequest = workspaceMediaLibraryInFlight.get(cacheKey);
    if (inFlightRequest) {
      return cloneWorkspaceMediaLibraryItems(await inFlightRequest);
    }
  }

  const request = loadWorkspaceMediaLibraryItems(user, options);
  const shouldTrackInFlight = Boolean(cacheKey && !shouldBypassCache);

  if (shouldTrackInFlight && cacheKey) {
    workspaceMediaLibraryInFlight.set(cacheKey, request);
  }

  try {
    const items = await request;
    if (cacheKey) {
      workspaceMediaLibraryCache.set(cacheKey, {
        expiresAt: Date.now() + WORKSPACE_MEDIA_LIBRARY_CACHE_TTL_MS,
        items: cloneWorkspaceMediaLibraryItems(items),
      });
    }

    return cloneWorkspaceMediaLibraryItems(items);
  } finally {
    if (shouldTrackInFlight && cacheKey) {
      workspaceMediaLibraryInFlight.delete(cacheKey);
    }
  }
};
