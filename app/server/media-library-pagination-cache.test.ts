import { afterEach, describe, expect, it, vi } from "vitest";

const { postAdsflowJsonMock } = vi.hoisted(() => ({
  postAdsflowJsonMock: vi.fn(),
}));

vi.mock("./env.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./env.js")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      adsflowAdminToken: "test-admin-token",
      adsflowApiBaseUrl: "https://adsflow.example.test",
    },
  };
});

vi.mock("./upstream-client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./upstream-client.js")>();
  return {
    ...actual,
    postAdsflowJson: postAdsflowJsonMock,
  };
});

import {
  fetchWorkspaceDurableMediaLibraryItems,
  invalidateWorkspaceMediaLibraryCache,
} from "./media-library.js";

const user = { email: "media-pagination-cache@example.test" };

const createAsset = (id: number) => ({
  created_at: new Date(Date.UTC(2026, 6, 15, 12, 0, id)).toISOString(),
  id,
  kind: "source_ai_image",
  media_type: "photo",
  project_id: 42,
  role: "source_ai_image",
  segment_index: id,
  source_kind: "ai_generated",
  status: "ready",
});

afterEach(() => {
  postAdsflowJsonMock.mockReset();
  invalidateWorkspaceMediaLibraryCache(user);
});

describe("durable media library pagination cache", () => {
  it("continues from the cached upstream cursor instead of refetching earlier pages", async () => {
    postAdsflowJsonMock.mockImplementation(async (_path: string, body: { cursor?: number }) => {
      if (body.cursor === 0) {
        return {
          assets: [createAsset(1), createAsset(2)],
          next_cursor: 2,
        };
      }

      if (body.cursor === 2) {
        return {
          assets: [createAsset(3), createAsset(4)],
          next_cursor: 4,
        };
      }

      return { assets: [], next_cursor: null };
    });

    const firstPageSnapshot = await fetchWorkspaceDurableMediaLibraryItems(user, {
      limit: 2,
      offset: 0,
    });
    const secondPageSnapshot = await fetchWorkspaceDurableMediaLibraryItems(user, {
      limit: 2,
      offset: 2,
    });

    expect(firstPageSnapshot.items).toHaveLength(2);
    expect(secondPageSnapshot.items).toHaveLength(4);
    expect(postAdsflowJsonMock.mock.calls.map(([, body]) => body.cursor)).toEqual([0, 2]);
  });
});
