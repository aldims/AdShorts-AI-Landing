import { describe, expect, it } from "vitest";

import {
  getWorkspaceMediaLibraryAssetIdentityKey,
  getWorkspaceMediaLibraryDisplayAssetIdentityKey,
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
});
