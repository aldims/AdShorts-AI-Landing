import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { env } from "./env.js";
import {
  appendProductFeedbackSubmission,
  parseProductFeedbackSubmission,
  ProductFeedbackValidationError,
} from "./product-feedback.js";

const originalDataDir = env.dataDir;
const testDirectories: string[] = [];

afterEach(async () => {
  env.dataDir = originalDataDir;
  await Promise.all(testDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("product feedback", () => {
  it("normalizes and durably stores authenticated feedback", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "adshorts-feedback-"));
    testDirectories.push(dataDir);
    env.dataDir = dataDir;

    const submission = parseProductFeedbackSubmission(
      {
        message: "  Понравился результат.  \r\n Улучшите выбор музыки.  ",
        plan: "free",
        projectId: 4171,
        source: "/app/studio",
        userEmail: "spoofed@example.com",
      },
      {
        submittedAt: "2026-07-11T10:00:00.000Z",
        userAgent: "unit-test",
        userEmail: "Owner@Example.com",
        userId: "auth-user-1",
      },
    );

    expect(submission).toMatchObject({
      message: "Понравился результат.\nУлучшите выбор музыки.",
      plan: "FREE",
      projectId: 4171,
      userEmail: "owner@example.com",
      userId: "auth-user-1",
    });

    await appendProductFeedbackSubmission(submission);
    const stored = await readFile(join(dataDir, "product-feedback.jsonl"), "utf8");
    expect(JSON.parse(stored.trim())).toEqual(submission);
  });

  it("rejects empty and oversized feedback", () => {
    const metadata = { userEmail: "owner@example.com", userId: "auth-user-1" };

    expect(() => parseProductFeedbackSubmission({ message: "  " }, metadata)).toThrow(ProductFeedbackValidationError);
    expect(() => parseProductFeedbackSubmission({ message: "x".repeat(2001) }, metadata)).toThrow(
      ProductFeedbackValidationError,
    );
  });
});
