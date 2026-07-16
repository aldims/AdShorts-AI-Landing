import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { extractUploadedVideoAudio } from "./uploaded-video-audio.js";

const execFileAsync = promisify(execFile);
const testDirectories: string[] = [];
const ffmpegBinary = process.env.FFMPEG_PATH?.trim() || "ffmpeg";

const createTestDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), "adshorts-uploaded-video-audio-test-"));
  testDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(testDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("extractUploadedVideoAudio", () => {
  it("extracts the first audio stream into an m4a asset", async () => {
    const directory = await createTestDirectory();
    const sourcePath = join(directory, "with-audio.mp4");
    await execFileAsync(ffmpegBinary, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=32x32:d=0.2",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=0.2",
      "-shortest",
      "-c:v",
      "mpeg4",
      "-c:a",
      "aac",
      sourcePath,
    ]);

    const result = await extractUploadedVideoAudio(sourcePath);

    expect(result?.mimeType).toBe("audio/mp4");
    expect(result?.bytes.length).toBeGreaterThan(0);
  });

  it("returns null when the uploaded video has no audio stream", async () => {
    const directory = await createTestDirectory();
    const sourcePath = join(directory, "silent.mp4");
    await execFileAsync(ffmpegBinary, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=32x32:d=0.2",
      "-c:v",
      "mpeg4",
      sourcePath,
    ]);

    await expect(extractUploadedVideoAudio(sourcePath)).resolves.toBeNull();
  });
});
