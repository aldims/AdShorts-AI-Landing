import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { appendInternationalPaymentsWaitlistSubmission, parseInternationalPaymentsWaitlistSubmission } from "./international-payments-waitlist.js";
import { env } from "./env.js";

const originalDataDir = env.dataDir;
const testDirectories: string[] = [];

afterEach(async () => {
  env.dataDir = originalDataDir;
  await Promise.all(
    testDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("international payments waitlist", () => {
  it("stores only one entry per normalized email", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "adshorts-waitlist-"));
    testDirectories.push(dataDir);
    env.dataDir = dataDir;

    const firstSubmission = parseInternationalPaymentsWaitlistSubmission({ email: "Alice@Example.COM" }, {
      submittedAt: "2026-06-14T10:00:00.000Z",
      userAgent: "unit-test",
    });
    const secondSubmission = parseInternationalPaymentsWaitlistSubmission({ email: "alice@example.com" }, {
      submittedAt: "2026-06-14T10:00:01.000Z",
      userAgent: "unit-test",
    });
    const thirdSubmission = parseInternationalPaymentsWaitlistSubmission({ email: "bob@example.com" }, {
      submittedAt: "2026-06-14T10:00:02.000Z",
      userAgent: "unit-test",
    });

    await expect(appendInternationalPaymentsWaitlistSubmission(firstSubmission)).resolves.toBe(true);
    await expect(appendInternationalPaymentsWaitlistSubmission(secondSubmission)).resolves.toBe(false);
    await expect(appendInternationalPaymentsWaitlistSubmission(thirdSubmission)).resolves.toBe(true);

    const fileContents = await readFile(join(dataDir, "international-payments-waitlist.jsonl"), "utf8");

    expect(fileContents.trim().split("\n")).toHaveLength(2);
    expect(fileContents).toContain("\"email\":\"alice@example.com\"");
    expect(fileContents).toContain("\"email\":\"bob@example.com\"");
  });
});
