// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getWorkspaceGeneratedMediaLibraryStorageKey,
  getWorkspaceMediaLibraryResolvedMediaSurface,
  getWorkspaceMediaLibraryTileImageUrl,
  getWorkspaceMediaLibraryTilePosterUrl,
  persistGeneratedMediaLibraryEntries,
  readStoredGeneratedMediaLibraryEntries,
  type WorkspaceGeneratedMediaLibraryEntry,
} from "./workspace-media-library-helpers";
import {
  createWorkspaceMediaLibraryItem,
  type WorkspaceMediaLibraryItem,
} from "../../lib/workspaceMediaLibrary";

const TEST_EMAIL = "media-library-storage@example.test";
type WorkspaceMediaLibraryItemOptions = Parameters<typeof createWorkspaceMediaLibraryItem>[0];
let originalLocalStorage: PropertyDescriptor | undefined;

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, String(value));
    },
  };
};

const createMediaLibraryItem = (
  overrides: Partial<WorkspaceMediaLibraryItemOptions>,
): WorkspaceMediaLibraryItem => createWorkspaceMediaLibraryItem({
  assetId: 901,
  createdAt: "2026-06-19T12:00:00.000Z",
  downloadName: "visual.mp4",
  downloadUrl: "/api/workspace/media-assets/901",
  kind: "talking_photo",
  previewKind: "video",
  previewPosterUrl: "/api/workspace/media-assets/901/poster",
  previewUrl: "/api/workspace/media-assets/901/playback",
  projectId: 42,
  projectTitle: "Project",
  segmentIndex: 0,
  segmentListIndex: 0,
  source: "live",
  sourceJobId: "job-901",
  ...overrides,
});

const createGeneratedEntry = (
  overrides: Partial<WorkspaceGeneratedMediaLibraryEntry>,
): WorkspaceGeneratedMediaLibraryEntry => {
  const item = overrides.item ?? createMediaLibraryItem({});

  return {
    createdAt: item.createdAt,
    id: item.itemKey,
    item,
    sourceJobId: "job-901",
    ...overrides,
  };
};

describe("workspace generated media library storage", () => {
  beforeEach(() => {
    originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
  });

  afterEach(() => {
    if (originalLocalStorage) {
      Object.defineProperty(window, "localStorage", originalLocalStorage);
    }
  });

  it("does not persist transient generated entries without durable asset routes", () => {
    const staleEntry = createGeneratedEntry({
      id: "live:talking_photo:job:stale",
      item: createMediaLibraryItem({
        assetId: null,
        downloadUrl: "/api/studio/segment-talking-photo/jobs/stale/video?download=1970-01-01T00%3A00%3A00.000Z%3A0%3Astale",
        previewPosterUrl: "/api/studio/segment-talking-photo/jobs/stale/poster",
        previewUrl: "/api/studio/segment-talking-photo/jobs/stale/video",
        sourceJobId: "stale",
      }),
      sourceJobId: "stale",
    });
    const durableEntry = createGeneratedEntry({});

    persistGeneratedMediaLibraryEntries(TEST_EMAIL, [staleEntry, durableEntry]);

    const stored = JSON.parse(window.localStorage.getItem(getWorkspaceGeneratedMediaLibraryStorageKey(TEST_EMAIL)) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0]?.item?.assetId).toBe(901);
    expect(stored[0]?.item?.source).toBe("persisted");
  });

  it("filters legacy fallback download entries when reading existing storage", () => {
    const durableEntry = createGeneratedEntry({});
    const staleEntry = createGeneratedEntry({
      id: "live:talking_photo:job:old",
      item: createMediaLibraryItem({
        assetId: null,
        downloadUrl: "/api/studio/segment-talking-photo/jobs/old/video?download=1970-01-01T00%3A00%3A00.000Z%3A0%3Aold",
        previewPosterUrl: "/api/studio/segment-talking-photo/jobs/old/poster",
        previewUrl: "/api/studio/segment-talking-photo/jobs/old/video",
        sourceJobId: "old",
      }),
      sourceJobId: "old",
    });

    window.localStorage.setItem(
      getWorkspaceGeneratedMediaLibraryStorageKey(TEST_EMAIL),
      JSON.stringify([staleEntry, durableEntry]),
    );

    const restoredEntries = readStoredGeneratedMediaLibraryEntries(TEST_EMAIL);
    expect(restoredEntries.map((entry) => entry.item.assetId)).toEqual([901]);
    expect(restoredEntries[0]?.item.source).toBe("persisted");
  });
});

describe("workspace media library tile surfaces", () => {
  it("uses a compact asset preview for image tiles and keeps the original in the viewer", () => {
    const item = createMediaLibraryItem({
      assetId: 902,
      downloadName: "visual.png",
      kind: "ai_photo",
      previewKind: "image",
      previewPosterUrl: null,
      previewUrl: "/api/workspace/media-assets/902",
    });

    expect(getWorkspaceMediaLibraryTileImageUrl(item)).toBe("/api/workspace/media-assets/902/preview");
    expect(getWorkspaceMediaLibraryResolvedMediaSurface(item, "media-library-tile")).toMatchObject({
      displayUrl: "/api/workspace/media-assets/902/preview",
      viewerUrl: "/api/workspace/media-assets/902",
    });
    expect(getWorkspaceMediaLibraryResolvedMediaSurface(item, "media-viewer")).toMatchObject({
      displayUrl: "/api/workspace/media-assets/902",
      viewerUrl: "/api/workspace/media-assets/902",
    });
  });

  it("prefers a durable asset preview over a legacy generated preview proxy", () => {
    const item = createMediaLibraryItem({
      assetId: 9262,
      kind: "ai_photo",
      previewKind: "image",
      previewPosterUrl:
        "/api/workspace/media-library-preview?kind=ai_photo&projectId=4226&segmentIndex=0",
      previewUrl: "/api/workspace/media-assets/9262",
    });

    expect(getWorkspaceMediaLibraryTileImageUrl(item)).toBe("/api/workspace/media-assets/9262/preview");
  });

  it("keeps the legacy generated preview proxy when no durable asset exists", () => {
    const item = createMediaLibraryItem({
      assetId: null,
      kind: "ai_photo",
      previewKind: "image",
      previewPosterUrl:
        "/api/workspace/media-library-preview?kind=ai_photo&projectId=4226&segmentIndex=0",
      previewUrl: "/api/workspace/project-segment-video?projectId=4226&segmentIndex=0",
    });

    expect(getWorkspaceMediaLibraryTileImageUrl(item)).toBe(item.previewPosterUrl);
  });

  it("uses a compact poster for video tiles and keeps the full poster in the viewer", () => {
    const item = createMediaLibraryItem({
      assetId: 903,
      previewPosterUrl: "/api/workspace/media-assets/903/poster",
    });

    expect(getWorkspaceMediaLibraryTilePosterUrl(item)).toBe("/api/workspace/media-assets/903/poster?tile=1");
    expect(getWorkspaceMediaLibraryResolvedMediaSurface(item, "media-library-tile").posterUrl).toBe(
      "/api/workspace/media-assets/903/poster?tile=1",
    );
    expect(getWorkspaceMediaLibraryResolvedMediaSurface(item, "media-viewer").posterUrl).toBe(
      "/api/workspace/media-assets/903/poster",
    );
  });
});
