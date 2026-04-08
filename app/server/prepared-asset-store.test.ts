import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm, utimes } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createPreparedAssetStore } from "./prepared-asset-store.js";

describe("prepared asset store", () => {
  it("removes expired asset files and metadata during cleanup", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "prepared-asset-store-"));
    const store = createPreparedAssetStore({
      cleanupIntervalMs: 60_000,
      maxAgeMs: 1_000,
      name: "test-store",
      rootDir,
    });

    const cacheKey = "asset:old";
    const absolutePath = await store.writeBufferToFile(
      cacheKey,
      Buffer.from("asset"),
      {
        contentType: "text/plain",
        fileName: "asset.txt",
        savedAt: new Date().toISOString(),
      },
    );
    const metadataPath = store.getMetadataPath(cacheKey);
    const expiredAt = new Date(Date.now() - 60_000);

    await Promise.all([
      utimes(absolutePath, expiredAt, expiredAt),
      utimes(metadataPath, expiredAt, expiredAt),
    ]);

    await store.runCleanup();

    await expect(store.exists(cacheKey)).resolves.toBe(false);
    await rm(rootDir, { force: true, recursive: true });
  });
});
