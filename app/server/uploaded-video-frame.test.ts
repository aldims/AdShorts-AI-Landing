import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
  extractUploadedVideoReferenceFrame,
  resolveUploadedVideoReferenceFrameTime,
} from "./uploaded-video-frame.js";

const execFileAsync = promisify(execFile);
const testDirectories: string[] = [];
const ffmpegBinary = process.env.FFMPEG_PATH?.trim() || "ffmpeg";

const createTestDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), "adshorts-uploaded-video-frame-test-"));
  testDirectories.push(directory);
  return directory;
};

const createColorTransitionVideo = async (sourcePath: string) => {
  await execFileAsync(ffmpegBinary, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=160x80:d=1:r=24",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=160x80:d=1:r=24",
    "-filter_complex",
    "[0:v][1:v]concat=n=2:v=1:a=0[out]",
    "-map",
    "[out]",
    "-c:v",
    "mpeg4",
    sourcePath,
  ]);
};

const getAverageRgb = async (bytes: Buffer) => {
  const { data, info } = await sharp(bytes)
    .resize(1, 1, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(info.channels).toBe(3);
  return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0] as const;
};

afterEach(async () => {
  await Promise.all(testDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("resolveUploadedVideoReferenceFrameTime", () => {
  it("uses a frame 0.25 seconds before the end", () => {
    expect(resolveUploadedVideoReferenceFrameTime(4.041667, { seekFromEndSeconds: 0.25 })).toBeCloseTo(3.791667);
  });

  it("keeps the target inside a short video", () => {
    expect(resolveUploadedVideoReferenceFrameTime(0.2, { seekSeconds: 1 })).toBeCloseTo(0.15);
  });
});

describe("extractUploadedVideoReferenceFrame", () => {
  it("decodes the requested final frame instead of returning an undecoded canvas", async () => {
    const directory = await createTestDirectory();
    const sourcePath = join(directory, "transition.mp4");
    await createColorTransitionVideo(sourcePath);

    const result = await extractUploadedVideoReferenceFrame(sourcePath, {
      maxSide: 64,
      seekFromEndSeconds: 0.25,
    });
    const [red, , blue] = await getAverageRgb(result.bytes);
    const metadata = await sharp(result.bytes).metadata();

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.durationSeconds).toBeCloseTo(2, 1);
    expect(result.seekTimeSeconds).toBeCloseTo(1.75, 1);
    expect(metadata.width).toBe(64);
    expect(metadata.height).toBe(32);
    expect(blue).toBeGreaterThan(red + 100);
  });

  it("supports a decoded frame near the beginning for character references", async () => {
    const directory = await createTestDirectory();
    const sourcePath = join(directory, "transition.mp4");
    await createColorTransitionVideo(sourcePath);

    const result = await extractUploadedVideoReferenceFrame(sourcePath, { seekSeconds: 0.25 });
    const [red, , blue] = await getAverageRgb(result.bytes);

    expect(red).toBeGreaterThan(blue + 100);
  });
});
