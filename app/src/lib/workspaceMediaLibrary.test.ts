import { describe, expect, it } from "vitest";

import {
  dedupeWorkspaceMediaLibraryItems,
  getWorkspaceMediaLibraryAssetIdentityKey,
  getWorkspaceMediaLibraryDisplayAssetIdentityKey,
  getWorkspaceMediaLibraryHiddenIdentityKeys,
  getWorkspaceMediaLibraryResolvedDedupeKey,
  isWorkspaceMediaLibraryItemHidden,
  sortWorkspaceMediaLibraryItemsNewestFirst,
  type WorkspaceMediaLibraryItem,
} from "./workspaceMediaLibrary";

const createMediaLibraryItem = (
  overrides: Partial<WorkspaceMediaLibraryItem>,
): WorkspaceMediaLibraryItem => ({
  assetExpiresAt: null,
  assetId: null,
  assetKind: null,
  assetLifecycle: null,
  assetMediaType: null,
  createdAt: 0,
  dedupeKey: "dedupe",
  downloadName: "file.jpg",
  downloadUrl: null,
  itemKey: "item",
  kind: "ai_photo",
  previewKind: "image",
  previewPosterUrl: null,
  previewUrl: "https://cdn.example.com/default.jpg",
  projectId: 1,
  projectTitle: "Project",
  segmentIndex: 0,
  segmentListIndex: 0,
  segmentNumber: 1,
  source: "persisted",
  ...overrides,
});

describe("workspace media library display identity", () => {
  it("deduplicates photo animations by their poster image", () => {
    const firstItem = createMediaLibraryItem({
      kind: "photo_animation",
      previewKind: "video",
      previewPosterUrl: "https://cdn.example.com/source-photo.jpg",
      previewUrl: "/api/workspace/project-segment-video?projectId=10&segmentIndex=0&source=current&delivery=preview&v=one",
    });
    const secondItem = createMediaLibraryItem({
      itemKey: "item-2",
      projectId: 2,
      kind: "photo_animation",
      previewKind: "video",
      previewPosterUrl: "https://cdn.example.com/source-photo.jpg",
      previewUrl: "/api/workspace/project-segment-video?projectId=11&segmentIndex=4&source=current&delivery=preview&v=two",
    });

    expect(getWorkspaceMediaLibraryDisplayAssetIdentityKey(firstItem)).toBe(
      getWorkspaceMediaLibraryDisplayAssetIdentityKey(secondItem),
    );
  });

  it("keeps photo animations deduplicated by poster even when asset ids differ", () => {
    const firstItem = createMediaLibraryItem({
      assetId: 101,
      kind: "photo_animation",
      previewKind: "video",
      previewPosterUrl: "https://cdn.example.com/source-photo.jpg",
      previewUrl: "/api/workspace/project-segment-video?projectId=10&segmentIndex=0&source=current&delivery=preview&v=one",
    });
    const secondItem = createMediaLibraryItem({
      assetId: 202,
      itemKey: "item-2",
      projectId: 2,
      kind: "photo_animation",
      previewKind: "video",
      previewPosterUrl: "https://cdn.example.com/source-photo.jpg",
      previewUrl: "/api/workspace/project-segment-video?projectId=11&segmentIndex=4&source=current&delivery=preview&v=two",
    });

    expect(getWorkspaceMediaLibraryDisplayAssetIdentityKey(firstItem)).toBe(
      getWorkspaceMediaLibraryDisplayAssetIdentityKey(secondItem),
    );
    expect(getWorkspaceMediaLibraryResolvedDedupeKey(firstItem)).toBe(
      getWorkspaceMediaLibraryResolvedDedupeKey(secondItem),
    );
  });

  it("keeps photo identity based on the photo preview itself", () => {
    const item = createMediaLibraryItem({
      kind: "ai_photo",
      previewPosterUrl: "https://cdn.example.com/unused-poster.jpg",
      previewUrl: "https://cdn.example.com/actual-photo.jpg",
    });

    expect(getWorkspaceMediaLibraryDisplayAssetIdentityKey(item)).toBe(
      getWorkspaceMediaLibraryAssetIdentityKey(item.previewUrl),
    );
  });

  it("sorts newer media items before older ones", () => {
    const oldItem = createMediaLibraryItem({
      createdAt: 1_000,
      itemKey: "old",
      projectId: 1,
    });
    const freshItem = createMediaLibraryItem({
      createdAt: 2_000,
      itemKey: "fresh",
      projectId: 2,
    });

    expect(sortWorkspaceMediaLibraryItemsNewestFirst([oldItem, freshItem]).map((item) => item.itemKey)).toEqual([
      "fresh",
      "old",
    ]);
  });

  it("prefers durable asset identity over preview url hashes", () => {
    const firstItem = createMediaLibraryItem({
      assetId: 101,
      previewUrl: "/api/workspace/project-segment-video?projectId=1&segmentIndex=0&source=current&delivery=preview&v=one",
    });
    const secondItem = createMediaLibraryItem({
      assetId: 101,
      itemKey: "item-2",
      previewUrl: "/api/workspace/project-segment-video?projectId=2&segmentIndex=3&source=current&delivery=preview&v=two",
      projectId: 2,
    });

    expect(getWorkspaceMediaLibraryDisplayAssetIdentityKey(firstItem)).toBe("asset:101");
    expect(getWorkspaceMediaLibraryDisplayAssetIdentityKey(secondItem)).toBe("asset:101");
  });

  it("collapses a stale photo animation draft with a persisted ai video for the same segment", () => {
    const items = dedupeWorkspaceMediaLibraryItems([
      createMediaLibraryItem({
        assetId: null,
        itemKey: "live-photo-animation",
        kind: "photo_animation",
        previewKind: "video",
        previewPosterUrl: "https://cdn.example.com/source-photo.jpg",
        previewUrl: "/api/studio/segment-photo-animation/jobs/job-1/video",
        projectId: 3031,
        segmentIndex: 1,
        source: "live",
      }),
      createMediaLibraryItem({
        assetId: 903,
        itemKey: "persisted-ai-video",
        kind: "ai_video",
        previewKind: "video",
        previewPosterUrl: null,
        previewUrl: "/api/workspace/project-segment-video?projectId=3031&segmentIndex=1&source=current&delivery=preview&v=ready",
        projectId: 3031,
        segmentIndex: 1,
        source: "persisted",
      }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]?.itemKey).toBe("live-photo-animation");
    expect(items[0]?.kind).toBe("photo_animation");
  });

  it("keeps a fresh ai video when a stale photo animation still exists for the same segment", () => {
    const items = dedupeWorkspaceMediaLibraryItems([
      createMediaLibraryItem({
        assetId: null,
        createdAt: 2_000,
        itemKey: "live-ai-video",
        kind: "ai_video",
        previewKind: "video",
        previewPosterUrl: null,
        previewUrl: "/api/studio/segment-ai-video/jobs/job-2/video",
        projectId: 3031,
        segmentIndex: 1,
        source: "live",
      }),
      createMediaLibraryItem({
        assetId: 904,
        createdAt: 1_000,
        itemKey: "persisted-photo-animation",
        kind: "photo_animation",
        previewKind: "video",
        previewPosterUrl: "https://cdn.example.com/stale-source-photo.jpg",
        previewUrl: "/api/workspace/project-segment-video?projectId=3031&segmentIndex=1&source=current&delivery=preview&v=stale",
        projectId: 3031,
        segmentIndex: 1,
        source: "persisted",
      }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]?.itemKey).toBe("live-ai-video");
    expect(items[0]?.kind).toBe("ai_video");
  });

  it("does not collapse two persisted video generations from the same segment when their modes differ", () => {
    const items = dedupeWorkspaceMediaLibraryItems([
      createMediaLibraryItem({
        assetId: 111,
        itemKey: "persisted-ai-video",
        kind: "ai_video",
        previewKind: "video",
        previewPosterUrl: null,
        previewUrl: "/api/workspace/project-segment-video?projectId=55&segmentIndex=2&source=current&delivery=preview&v=one",
        projectId: 55,
        segmentIndex: 2,
        source: "persisted",
      }),
      createMediaLibraryItem({
        assetId: 222,
        itemKey: "persisted-photo-animation",
        kind: "photo_animation",
        previewKind: "video",
        previewPosterUrl: "https://cdn.example.com/another-source-photo.jpg",
        previewUrl: "/api/workspace/project-segment-video?projectId=55&segmentIndex=2&source=current&delivery=preview&v=two",
        projectId: 55,
        segmentIndex: 2,
        source: "persisted",
      }),
    ]);

    expect(items).toHaveLength(2);
  });

  it("matches hidden persisted media by durable asset identity", () => {
    const hiddenItem = createMediaLibraryItem({
      assetId: 777,
      itemKey: "live:ai_photo:job:abc",
      dedupeKey: "asset:777",
      source: "live",
    });
    const reloadedItem = createMediaLibraryItem({
      assetId: 777,
      itemKey: "persisted:asset:777",
      dedupeKey: "asset:777",
      source: "persisted",
    });
    const hiddenKeys = new Set(getWorkspaceMediaLibraryHiddenIdentityKeys(hiddenItem));

    expect(isWorkspaceMediaLibraryItemHidden(reloadedItem, hiddenKeys)).toBe(true);
  });

  it("matches hidden media when only the display identity survives reload", () => {
    const hiddenItem = createMediaLibraryItem({
      assetId: 101,
      kind: "photo_animation",
      itemKey: "persisted:asset:101",
      previewKind: "video",
      previewPosterUrl: "https://cdn.example.com/source-photo.jpg",
      previewUrl: "https://cdn.example.com/generated-video-a.mp4",
    });
    const reloadedItem = createMediaLibraryItem({
      assetId: null,
      kind: "photo_animation",
      itemKey: "persisted:project:55:segment:1",
      previewKind: "video",
      previewPosterUrl: "https://cdn.example.com/source-photo.jpg",
      previewUrl: "https://cdn.example.com/generated-video-b.mp4",
    });
    const hiddenKeys = new Set(getWorkspaceMediaLibraryHiddenIdentityKeys(hiddenItem));

    expect(isWorkspaceMediaLibraryItemHidden(reloadedItem, hiddenKeys)).toBe(true);
  });
});
