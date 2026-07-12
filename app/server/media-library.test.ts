import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildWorkspaceDurableMediaLibraryItem,
  buildWorkspacePersistedMediaLibraryItems,
  buildWorkspaceReferenceMediaLibraryItems,
  dedupeWorkspaceMediaLibraryPageItems,
  getWorkspaceMediaLibraryKindFromDurableAsset,
  getWorkspaceMediaLibraryNextCursorForPage,
  getWorkspaceMediaLibrarySegmentPreviewUrl,
} from "./media-library.js";
import { buildWorkspaceMediaAssetRef } from "./media-assets.js";
import {
  clearWorkspaceSavedReferences,
  createWorkspaceSavedReference,
  type WorkspaceReferenceUser,
} from "./workspace-references.js";
import { createWorkspaceMediaLibraryItem } from "../src/lib/workspaceMediaLibrary.js";
import type { WorkspaceProject } from "./projects.js";
import type { WorkspaceSegmentEditorSegment, WorkspaceSegmentEditorSession } from "./segment-editor.js";

const referenceTestUsers: WorkspaceReferenceUser[] = [];

const createReferenceTestUser = (): WorkspaceReferenceUser => {
  const user = {
    email: `media-library-reference-${randomUUID()}@example.test`,
    id: `media-library-reference-${randomUUID()}`,
  };
  referenceTestUsers.push(user);
  return user;
};

afterEach(async () => {
  await Promise.all(referenceTestUsers.splice(0).map((user) => clearWorkspaceSavedReferences(user)));
});

const createPhotoSegment = (): WorkspaceSegmentEditorSegment => ({
  currentAsset: {
    assetId: 202,
    createdAt: "2026-04-09T00:00:00.000Z",
    deletedAt: null,
    downloadPath: "/api/media/202/download",
    downloadUrl: null,
    expiresAt: null,
    isCurrent: true,
    kind: "segment_current",
    lifecycle: "ready",
    mediaType: "video",
    mimeType: "video/mp4",
    originalUrl: null,
    playbackUrl: "/api/media/202/download",
    projectId: 42,
    role: "segment_current",
    segmentIndex: 0,
    sourceKind: "ai_generated",
    status: "ready",
    storageKey: "users/1/projects/42/final/202-video.mp4",
  },
  currentExternalPlaybackUrl: "https://cdn.example.com/segments/0-animation.mp4",
  currentExternalPreviewUrl: "https://cdn.example.com/segments/0-animation-preview.mp4",
  currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=current&delivery=playback&v=current",
  currentPosterUrl: "/api/workspace/media-assets/202/poster",
  currentPreviewUrl: "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=current&delivery=preview&v=current",
  currentSourceKind: "ai_generated",
  duration: 4,
  endTime: 4,
  index: 0,
  mediaType: "photo",
  originalAsset: {
    assetId: 101,
    createdAt: "2026-04-09T00:00:00.000Z",
    deletedAt: null,
    downloadPath: "/api/media/101/download",
    downloadUrl: null,
    expiresAt: null,
    isCurrent: true,
    kind: "segment_original",
    lifecycle: "ready",
    mediaType: "photo",
    mimeType: "image/jpeg",
    originalUrl: null,
    playbackUrl: "/api/media/101/download",
    projectId: 42,
    role: "segment_original",
    segmentIndex: 0,
    sourceKind: "ai_generated",
    status: "ready",
    storageKey: "users/1/projects/42/generated/101-image.jpg",
  },
  originalExternalPlaybackUrl: "https://cdn.example.com/segments/0-original.jpg",
  originalExternalPreviewUrl: "https://cdn.example.com/segments/0-original-preview.jpg",
  originalPlaybackUrl: "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=original&delivery=playback&v=original",
  originalPosterUrl: null,
  originalPreviewUrl: "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=original&delivery=preview&v=original",
  originalSourceKind: "ai_generated",
  speechDuration: null,
  speechEndTime: null,
  speechStartTime: null,
  speechWords: [],
  startTime: 0,
  text: "Segment",
});

const project: WorkspaceProject & { adId: number } = {
  adId: 42,
  createdAt: "2026-04-09T00:00:00.000Z",
  description: "",
  editedFromProjectAdId: null,
  finalAsset: null,
  generatedAt: "2026-04-09T00:00:00.000Z",
  hashtags: [],
  id: "project:42",
  jobId: null,
  posterUrl: null,
  prompt: "Prompt",
  source: "project",
  status: "ready",
  title: "Test project",
  updatedAt: "2026-04-09T00:00:00.000Z",
  versionRootProjectAdId: null,
  videoFallbackUrl: null,
  videoUrl: null,
  youtubePublication: null,
};

const session = (segment: WorkspaceSegmentEditorSegment): WorkspaceSegmentEditorSession => ({
  description: "",
  musicAssetId: null,
  musicName: "",
  musicType: "",
  projectId: 42,
  segments: [segment],
  subtitleColor: "",
  subtitleStyle: "",
  subtitleType: "",
  title: "Session",
  ttsAssetId: null,
  voiceType: "",
});

describe("media library photo sources", () => {
  it("uses the external image url for ai_photo previews", () => {
    const segment = createPhotoSegment();

    expect(getWorkspaceMediaLibrarySegmentPreviewUrl(segment, "ai_photo")).toBe(
      "https://cdn.example.com/segments/0-original-preview.jpg",
    );
  });

  it("stores photo items with image preview urls and animation items with video preview urls", () => {
    const items = buildWorkspacePersistedMediaLibraryItems(project, session(createPhotoSegment()));

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      assetId: 101,
      kind: "ai_photo",
      previewKind: "image",
      previewUrl: "https://cdn.example.com/segments/0-original-preview.jpg",
    });
    expect(items[1]).toMatchObject({
      assetId: 202,
      kind: "photo_animation",
      previewKind: "video",
      previewPosterUrl: expect.stringContaining("/api/workspace/media-assets/202/poster"),
      previewUrl: "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=current&delivery=preview&v=current",
    });
  });

  it("uses a poster generated from the animation video instead of the source photo", () => {
    const segment = createPhotoSegment();

    const items = buildWorkspacePersistedMediaLibraryItems(project, session(segment));
    const animation = items.find((item) => item.kind === "photo_animation");

    expect(animation?.previewPosterUrl).toContain("/api/workspace/media-assets/202/poster");
    expect(animation?.previewPosterUrl).not.toBe(segment.originalExternalPreviewUrl);
  });

  it("uses media asset creation dates for persisted library items", () => {
    const segment = createPhotoSegment();
    segment.originalAsset = segment.originalAsset
      ? { ...segment.originalAsset, createdAt: "2026-04-09T10:00:00.000Z" }
      : segment.originalAsset;
    segment.currentAsset = segment.currentAsset
      ? { ...segment.currentAsset, createdAt: "2026-04-10T10:00:00.000Z" }
      : segment.currentAsset;
    const editedProject = {
      ...project,
      createdAt: "2026-04-08T10:00:00.000Z",
      generatedAt: "2026-04-08T10:00:00.000Z",
      updatedAt: "2026-04-12T10:00:00.000Z",
    };

    const items = buildWorkspacePersistedMediaLibraryItems(editedProject, session(segment));

    expect(items.find((item) => item.kind === "ai_photo")?.createdAt).toBe(
      Date.parse("2026-04-09T10:00:00.000Z"),
    );
    expect(items.find((item) => item.kind === "photo_animation")?.createdAt).toBe(
      Date.parse("2026-04-10T10:00:00.000Z"),
    );
  });

  it("does not expose deleted segment assets even when preview urls are still present", () => {
    const segment = createPhotoSegment();
    segment.originalAsset = {
      ...segment.originalAsset,
      lifecycle: "deleted",
      status: "deleted",
    };
    segment.currentAsset = {
      ...segment.currentAsset,
      lifecycle: "deleted",
      status: "deleted",
    };

    const items = buildWorkspacePersistedMediaLibraryItems(project, session(segment));

    expect(items).toHaveLength(0);
  });

  it("skips ai_photo items when a photo only has non-renderable external sources", () => {
    const segment = createPhotoSegment();
    segment.originalExternalPreviewUrl = null;
    segment.originalExternalPlaybackUrl = null;

    const items = buildWorkspacePersistedMediaLibraryItems(project, session(segment));

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("photo_animation");
  });

  it("does not create a photo animation item when current and original proxy media are the same", () => {
    const segment = createPhotoSegment();
    segment.originalExternalPreviewUrl = null;
    segment.originalExternalPlaybackUrl = null;
    segment.currentExternalPreviewUrl = null;
    segment.currentExternalPlaybackUrl = null;
    segment.originalPreviewUrl = "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=original&delivery=preview&v=same";
    segment.currentPreviewUrl = "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=current&delivery=preview&v=same";
    segment.originalPlaybackUrl = "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=original&delivery=playback&v=same";
    segment.currentPlaybackUrl = "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=current&delivery=playback&v=same";

    const items = buildWorkspacePersistedMediaLibraryItems(project, session(segment));

    expect(items).toHaveLength(0);
  });

  it("does not store uploaded original photos as ai_photo items", () => {
    const segment = createPhotoSegment();
    segment.currentAsset = null;
    segment.currentExternalPlaybackUrl = null;
    segment.currentExternalPreviewUrl = null;
    segment.currentPlaybackUrl = null;
    segment.currentPreviewUrl = null;
    segment.currentSourceKind = "unknown";
    segment.originalAsset = {
      ...segment.originalAsset!,
      sourceKind: "upload",
      storageKey: "users/1/projects/42/source/101-image.jpg",
    };
    segment.originalSourceKind = "upload";

    const items = buildWorkspacePersistedMediaLibraryItems(project, session(segment));

    expect(items).toHaveLength(0);
  });

  it("keeps ai animations created from uploaded photos without exposing the uploaded photo", () => {
    const segment = createPhotoSegment();
    segment.originalAsset = {
      ...segment.originalAsset!,
      sourceKind: "upload",
      storageKey: "users/1/projects/42/source/101-image.jpg",
    };
    segment.originalSourceKind = "upload";

    const items = buildWorkspacePersistedMediaLibraryItems(project, session(segment));

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      assetId: 202,
      kind: "photo_animation",
      previewKind: "video",
    });
  });

  it("does not create a photo animation item when only the original external image differs from equal proxy media", () => {
    const segment = createPhotoSegment();
    segment.currentExternalPreviewUrl = null;
    segment.currentExternalPlaybackUrl = null;
    segment.originalPreviewUrl = "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=original&delivery=preview&v=same";
    segment.currentPreviewUrl = "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=current&delivery=preview&v=same";
    segment.originalPlaybackUrl = "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=original&delivery=playback&v=same";
    segment.currentPlaybackUrl = "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=current&delivery=playback&v=same";

    const items = buildWorkspacePersistedMediaLibraryItems(project, session(segment));

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("ai_photo");
    expect(items[0]?.assetId).toBe(101);
  });

  it("does not store stock current videos as ai_video items", () => {
    const segment = createPhotoSegment();
    segment.mediaType = "video";
    segment.currentAsset = {
      ...segment.currentAsset!,
      kind: "stock_video",
      role: "stock_video",
      sourceKind: "stock",
    };
    segment.currentSourceKind = "stock";

    const items = buildWorkspacePersistedMediaLibraryItems(project, session(segment));

    expect(items).toHaveLength(0);
  });

  it("lets explicit stock source metadata override ai-looking video assets", () => {
    const segment = createPhotoSegment();
    segment.mediaType = "video";
    segment.currentAsset = {
      ...segment.currentAsset!,
      kind: "source_ai_video",
      role: "source_ai_video",
      sourceKind: "stock",
      storageKey: "users/1/assets/204/source_ai_video/204-stock-provider-cache.mp4",
    };
    segment.currentSourceKind = "stock";

    const items = buildWorkspacePersistedMediaLibraryItems(project, session(segment));

    expect(items).toHaveLength(0);
  });

  it("lets explicit stock source metadata override ai-looking original photos", () => {
    const segment = createPhotoSegment();
    segment.currentAsset = null;
    segment.currentExternalPlaybackUrl = null;
    segment.currentExternalPreviewUrl = null;
    segment.currentPlaybackUrl = null;
    segment.currentPreviewUrl = null;
    segment.currentSourceKind = "unknown";
    segment.originalAsset = {
      ...segment.originalAsset!,
      kind: "source_ai_image",
      role: "source_ai_image",
      sourceKind: "stock",
      storageKey: "users/1/assets/101/source_ai_image/101-stock-provider-cache.jpg",
    };
    segment.originalSourceKind = "stock";

    const items = buildWorkspacePersistedMediaLibraryItems(project, session(segment));

    expect(items).toHaveLength(0);
  });

  it("does not store generic rendered segment cache without ai source markers", () => {
    const segment = createPhotoSegment();
    segment.mediaType = "video";
    segment.currentAsset = {
      ...segment.currentAsset!,
      kind: "rendered_segment",
      role: "rendered_segment",
      sourceKind: null,
      storageKey: "users/1/assets/404/rendered_segment/404-rendered_segment_cache_stock_0.mp4",
    };
    segment.currentSourceKind = "unknown";

    const items = buildWorkspacePersistedMediaLibraryItems(project, session(segment));

    expect(items).toHaveLength(0);
  });

  it("classifies a video segment rendered from a photo source as photo animation", () => {
    const segment = createPhotoSegment();
    segment.mediaType = "video";
    segment.currentAsset = {
      ...segment.currentAsset!,
      assetId: 303,
      kind: "rendered_segment",
      mediaType: "video",
      mimeType: "video/mp4",
      role: "rendered_segment",
    };
    segment.originalAsset = {
      ...segment.originalAsset!,
      mediaType: "photo",
      mimeType: "image/png",
    };

    const items = buildWorkspacePersistedMediaLibraryItems(project, session(segment));

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      assetId: 303,
      kind: "photo_animation",
      previewKind: "video",
      previewPosterUrl: expect.stringContaining("/api/workspace/media-assets/303/poster"),
    });
  });
});

describe("media library durable assets", () => {
  it("does not expose final project videos as media library items", () => {
    const asset = buildWorkspaceMediaAssetRef({
      download_path: "/api/media/777/download",
      id: 777,
      kind: "final_video",
      media_type: "video",
      project_id: 42,
      role: "final_video",
      status: "ready",
    });

    expect(getWorkspaceMediaLibraryKindFromDurableAsset(asset)).toBeNull();
  });

  it("keeps segment-level ai videos in the media library", () => {
    const asset = buildWorkspaceMediaAssetRef({
      download_path: "/api/media/778/download",
      id: 778,
      kind: "segment_current",
      media_type: "video",
      project_id: 42,
      role: "segment_current",
      segment_index: 0,
      source_kind: "ai_generated",
      status: "ready",
    });

    expect(getWorkspaceMediaLibraryKindFromDurableAsset(asset)).toBe("ai_video");
  });

  it("uses durable library_kind to classify photo animations", () => {
    const asset = buildWorkspaceMediaAssetRef({
      download_path: "/api/media/786/download",
      id: 786,
      kind: "rendered_segment",
      library_kind: "photo_animation",
      media_type: "video",
      project_id: 42,
      role: "rendered_segment",
      segment_index: 0,
      source_kind: "ai_generated",
      status: "ready",
      storage_key: "users/1/assets/786/rendered_segment/786-rendered_segment_cache_ai_0.mp4",
    });

    expect(getWorkspaceMediaLibraryKindFromDurableAsset(asset)).toBe("photo_animation");
  });

  it("uses durable library_kind to classify talking photos", () => {
    const asset = buildWorkspaceMediaAssetRef({
      download_path: "/api/media/787/download",
      id: 787,
      kind: "rendered_segment",
      library_kind: "talking_photo",
      media_type: "video",
      project_id: 42,
      role: "rendered_segment",
      segment_index: 0,
      source_kind: "ai_generated",
      status: "ready",
      storage_key: "users/1/assets/787/rendered_segment/787-rendered_segment_talking_photo.mp4",
    });

    expect(getWorkspaceMediaLibraryKindFromDurableAsset(asset)).toBe("talking_photo");
  });

  it("uses stable media asset playback urls for durable video previews", () => {
    const item = buildWorkspaceDurableMediaLibraryItem({
      created_at: "2026-04-09T00:00:00.000Z",
      download_path: "/api/media/786/download",
      id: 786,
      kind: "rendered_segment",
      library_kind: "photo_animation",
      media_type: "video",
      mime_type: "video/mp4",
      project_id: 42,
      role: "rendered_segment",
      segment_index: 6,
      source_kind: "ai_generated",
      status: "ready",
      storage_key: "users/1/assets/786/rendered_segment/786-wavespeed_wan_0.mp4",
    });

    expect(item).toMatchObject({
      assetId: 786,
      downloadUrl: "/api/workspace/media-assets/786",
      kind: "photo_animation",
      previewKind: "video",
      previewUrl: "/api/workspace/media-assets/786/playback",
      segmentIndex: 6,
    });
  });

  it("keeps durable source_ai_image assets in the media library even when source_kind is missing", () => {
    const asset = buildWorkspaceMediaAssetRef({
      download_path: "/api/media/783/download",
      id: 783,
      kind: "source_ai_image",
      media_type: "photo",
      project_id: 42,
      role: "source_ai_image",
      segment_index: 0,
      status: "ready",
      storage_key: "users/1/assets/783/source_ai_image/783-source_media_0.png",
    });

    expect(getWorkspaceMediaLibraryKindFromDurableAsset(asset)).toBe("ai_photo");
  });

  it("keeps durable rendered_segment assets in the media library even when source_kind is missing", () => {
    const asset = buildWorkspaceMediaAssetRef({
      download_path: "/api/media/784/download",
      id: 784,
      kind: "rendered_segment",
      media_type: "video",
      project_id: 42,
      role: "rendered_segment",
      segment_index: 0,
      status: "ready",
      storage_key: "users/1/assets/784/rendered_segment/784-wavespeed_wan_0.mp4",
    });

    expect(getWorkspaceMediaLibraryKindFromDurableAsset(asset)).toBe("ai_video");
  });

  it("does not keep generic durable rendered_segment cache without ai source markers", () => {
    const asset = buildWorkspaceMediaAssetRef({
      download_path: "/api/media/785/download",
      id: 785,
      kind: "rendered_segment",
      media_type: "video",
      project_id: 42,
      role: "rendered_segment",
      segment_index: 0,
      status: "ready",
      storage_key: "users/1/assets/785/rendered_segment/785-rendered_segment_cache_stock_0.mp4",
    });

    expect(getWorkspaceMediaLibraryKindFromDurableAsset(asset)).toBeNull();
  });

  it("does not expose source helper uploads as durable media library items", () => {
    const sourceUpload = buildWorkspaceMediaAssetRef({
      download_path: "/api/media/779/download",
      id: 779,
      kind: "source_upload",
      media_type: "photo",
      project_id: 42,
      role: "source_upload",
      segment_index: 0,
      status: "ready",
    });
    const segmentImage = buildWorkspaceMediaAssetRef({
      download_path: "/api/media/780/download",
      id: 780,
      kind: "segment_image",
      media_type: "photo",
      project_id: 42,
      role: "segment_source",
      segment_index: 0,
      status: "ready",
    });

    expect(getWorkspaceMediaLibraryKindFromDurableAsset(sourceUpload)).toBeNull();
    expect(getWorkspaceMediaLibraryKindFromDurableAsset(segmentImage)).toBeNull();
  });

  it("does not expose segment infographic overlays as selectable scene visuals", () => {
    const asset = buildWorkspaceMediaAssetRef({
      download_path: "/api/media/790/download",
      id: 790,
      kind: "segment_infographic",
      library_kind: "infographic",
      media_type: "photo",
      project_id: 42,
      role: "segment_infographic",
      segment_index: 0,
      source_kind: "ai_generated_infographic",
      status: "ready",
    });

    expect(getWorkspaceMediaLibraryKindFromDurableAsset(asset)).toBeNull();
  });

  it("does not expose stock durable assets as ai media library items", () => {
    const asset = buildWorkspaceMediaAssetRef({
      download_path: "/api/media/781/download",
      id: 781,
      kind: "segment_current",
      media_type: "video",
      project_id: 42,
      role: "segment_current",
      segment_index: 0,
      source_kind: "stock",
      status: "ready",
    });

    expect(getWorkspaceMediaLibraryKindFromDurableAsset(asset)).toBeNull();
  });

  it("does not expose stock durable assets even when their kind looks ai-generated", () => {
    const stockSourceKindAsset = buildWorkspaceMediaAssetRef({
      download_path: "/api/media/787/download",
      id: 787,
      kind: "source_ai_image",
      media_type: "photo",
      project_id: 42,
      role: "source_ai_image",
      segment_index: 0,
      source_kind: "stock",
      status: "ready",
      storage_key: "users/1/assets/787/source_ai_image/787-provider-cache.jpg",
    });
    const stockProviderUrlAsset = buildWorkspaceMediaAssetRef({
      download_path: "/api/media/788/download",
      id: 788,
      kind: "source_ai_image",
      media_type: "photo",
      original_url: "https://images.pexels.com/photos/4046567/pexels-photo-4046567.jpeg",
      project_id: 42,
      role: "source_ai_image",
      segment_index: 1,
      status: "ready",
      storage_key: "users/1/assets/788/source_ai_image/788-provider-cache.jpg",
    });

    expect(getWorkspaceMediaLibraryKindFromDurableAsset(stockSourceKindAsset)).toBeNull();
    expect(getWorkspaceMediaLibraryKindFromDurableAsset(stockProviderUrlAsset)).toBeNull();
  });

  it("does not expose custom uploaded durable assets as ai media library items", () => {
    const asset = buildWorkspaceMediaAssetRef({
      download_path: "/api/media/782/download",
      id: 782,
      kind: "custom_video",
      media_type: "video",
      project_id: 42,
      role: "custom_video",
      segment_index: 0,
      source_kind: "upload",
      status: "ready",
    });

    expect(getWorkspaceMediaLibraryKindFromDurableAsset(asset)).toBeNull();
  });
});

describe("media library pagination", () => {
  it("does not return a non-advancing cursor for empty pages", () => {
    expect(
      getWorkspaceMediaLibraryNextCursorForPage({
        hasAdditionalItems: true,
        offset: 24,
        pageItemCount: 0,
      }),
    ).toBeNull();
  });

  it("returns the next offset when the page includes items", () => {
    expect(
      getWorkspaceMediaLibraryNextCursorForPage({
        hasAdditionalItems: true,
        offset: 24,
        pageItemCount: 12,
      }),
    ).toBe("36");
  });
});

describe("media library dedupe", () => {
  it("collapses durable ai_video duplicates when a more specific photo_animation item exists for the same asset", () => {
    const durableVideo = createWorkspaceMediaLibraryItem({
      assetId: 900,
      createdAt: "2026-04-09T00:00:00.000Z",
      downloadName: "video.mp4",
      downloadUrl: "/api/workspace/media-assets/900",
      kind: "ai_video",
      previewKind: "video",
      previewPosterUrl: "/api/workspace/media-assets/900/poster",
      previewUrl: "/api/workspace/media-assets/900",
      projectId: 42,
      projectTitle: "Проект #42",
      segmentIndex: 0,
      segmentListIndex: 0,
      source: "persisted",
    });
    const animation = createWorkspaceMediaLibraryItem({
      assetId: 900,
      createdAt: "2026-04-09T00:01:00.000Z",
      downloadName: "animation.mp4",
      downloadUrl: "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=current&delivery=playback",
      kind: "photo_animation",
      previewKind: "video",
      previewPosterUrl: "/api/workspace/media-assets/100",
      previewUrl: "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=current&delivery=preview",
      projectId: 42,
      projectTitle: "Project",
      segmentIndex: 0,
      segmentListIndex: 0,
      source: "persisted",
    });

    expect(dedupeWorkspaceMediaLibraryPageItems([durableVideo, animation])).toEqual([animation]);
  });

  it("collapses saved references with generated visuals that use the same asset id", () => {
    const generatedPhoto = createWorkspaceMediaLibraryItem({
      assetId: 901,
      createdAt: "2026-04-09T00:00:00.000Z",
      downloadName: "photo.jpg",
      downloadUrl: "/api/workspace/media-assets/901",
      kind: "ai_photo",
      previewKind: "image",
      previewPosterUrl: null,
      previewUrl: "/api/workspace/media-assets/901",
      projectId: 42,
      projectTitle: "Project",
      segmentIndex: 0,
      segmentListIndex: 0,
      source: "persisted",
    });
    const characterReference = createWorkspaceMediaLibraryItem({
      assetId: 901,
      createdAt: "2026-04-09T00:01:00.000Z",
      downloadName: "hero.jpg",
      downloadUrl: "/api/workspace/media-assets/901",
      kind: "character_reference",
      previewKind: "image",
      previewPosterUrl: null,
      previewUrl: "/api/workspace/media-assets/901",
      projectId: 42,
      projectTitle: "Персонажи",
      referenceId: "reference-901",
      segmentIndex: 0,
      segmentListIndex: 0,
      source: "persisted",
    });

    expect(dedupeWorkspaceMediaLibraryPageItems([generatedPhoto, characterReference])).toEqual([generatedPhoto]);
  });
});

describe("media library saved references", () => {
  it("exposes saved characters and scenes as separate image media kinds", async () => {
    const user = createReferenceTestUser();
    const character = await createWorkspaceSavedReference(user, {
      assetId: 1001,
      kind: "character",
      name: "Hero",
      sourceProjectId: 77,
      sourceSegmentIndex: 2,
    });
    const scene = await createWorkspaceSavedReference(user, {
      assetId: 1002,
      kind: "scene",
      name: "Kitchen",
      sourceProjectId: 77,
      sourceSegmentIndex: 3,
    });

    const items = await buildWorkspaceReferenceMediaLibraryItems(user);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: 1001,
          kind: "character_reference",
          previewKind: "image",
          referenceId: character.id,
        }),
        expect.objectContaining({
          assetId: 1002,
          kind: "scene_reference",
          previewKind: "image",
          referenceId: scene.id,
        }),
      ]),
    );
  });
});
