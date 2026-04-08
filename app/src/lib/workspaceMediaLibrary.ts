const FALLBACK_WORKSPACE_DOWNLOAD_NAME = "adshorts-video";

export type WorkspaceMediaLibraryItemKind = "ai_photo" | "ai_video" | "photo_animation" | "image_edit";
export type WorkspaceMediaLibraryItemSource = "draft" | "live" | "persisted";
export type WorkspaceMediaLibraryPreviewKind = "video" | "image";

export type WorkspaceMediaLibraryItem = {
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
  "kind" | "previewPosterUrl" | "previewUrl"
>) =>
  item.kind === "photo_animation" && item.previewPosterUrl
    ? getWorkspaceMediaLibraryAssetIdentity(item.previewPosterUrl)
    : getWorkspaceMediaLibraryAssetIdentity(item.previewUrl);

export const buildWorkspaceMediaLibraryItemDedupeKey = (options: {
  kind: WorkspaceMediaLibraryItemKind;
  previewUrl: string;
  projectId: number;
  segmentIndex: number;
}) =>
  `project:${options.projectId}:segment:${options.segmentIndex}:kind:${options.kind}:asset:${getWorkspaceMediaLibraryAssetIdentity(
    options.previewUrl,
  )}`;

export const buildWorkspaceMediaLibraryItemKey = (
  source: WorkspaceMediaLibraryItemSource,
  options: {
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
  })}`;
};

export const createWorkspaceMediaLibraryItem = (options: {
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
    kind: options.kind,
    previewUrl: options.previewUrl,
    projectId: options.projectId,
    segmentIndex: options.segmentIndex,
  });

  return {
    dedupeKey,
    downloadName: options.downloadName,
    downloadUrl: options.downloadUrl,
    itemKey: buildWorkspaceMediaLibraryItemKey(options.source, {
      kind: options.kind,
      previewUrl: options.previewUrl,
      projectId: options.projectId,
      segmentIndex: options.segmentIndex,
      sourceJobId: options.sourceJobId,
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
