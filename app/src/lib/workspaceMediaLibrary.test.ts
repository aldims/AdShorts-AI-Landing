import { describe, expect, it } from "vitest";

import {
  getWorkspaceMediaLibraryAssetIdentityKey,
  getWorkspaceMediaLibraryDisplayAssetIdentityKey,
  type WorkspaceMediaLibraryItem,
} from "./workspaceMediaLibrary";

const createMediaLibraryItem = (
  overrides: Partial<WorkspaceMediaLibraryItem>,
): WorkspaceMediaLibraryItem => ({
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
});
