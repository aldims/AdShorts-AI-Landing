import { describe, expect, it } from "vitest";

import { createAssetPreparationQueue } from "./asset-preparation-queue.js";

describe("asset preparation queue", () => {
  it("deduplicates concurrent tasks by cache key", async () => {
    const queue = createAssetPreparationQueue<number>({
      backgroundConcurrency: 1,
      interactiveConcurrency: 1,
      name: "test-queue",
    });

    let runCount = 0;
    let resolveTask!: (value: number) => void;
    const taskPromise = new Promise<number>((resolve) => {
      resolveTask = resolve;
    });

    const firstRequest = queue.schedule("asset:1", "background", async () => {
      runCount += 1;
      return taskPromise;
    });
    const secondRequest = queue.schedule("asset:1", "interactive", async () => {
      runCount += 1;
      return 7;
    });

    resolveTask(42);

    await expect(firstRequest).resolves.toBe(42);
    await expect(secondRequest).resolves.toBe(42);
    expect(runCount).toBe(1);
  });
});
