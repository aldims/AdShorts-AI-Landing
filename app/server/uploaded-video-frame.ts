import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import {
  WORKSPACE_SEGMENT_REFERENCE_FRAME_LATEST_DECODABLE_OFFSET_SECONDS,
  WORKSPACE_SEGMENT_REFERENCE_FRAME_MAX_SIDE,
} from "../shared/workspace-reference-frames.js";

const execFileAsync = promisify(execFile);
const FFMPEG_BINARY = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
const FFPROBE_BINARY =
  process.env.FFPROBE_PATH?.trim() ||
  (FFMPEG_BINARY.includes("/") ? join(dirname(FFMPEG_BINARY), "ffprobe") : "ffprobe");
const UPLOADED_VIDEO_FRAME_EXTRACTION_TIMEOUT_MS = 5 * 60_000;
const UPLOADED_VIDEO_FRAME_MAX_BUFFER_BYTES = 8 * 1024 * 1024;

export type UploadedVideoReferenceFrameOptions = {
  maxSide?: number;
  seekFromEndSeconds?: number;
  seekSeconds?: number;
};

export type ExtractedUploadedVideoFrame = {
  bytes: Buffer;
  durationSeconds: number;
  mimeType: "image/jpeg";
  seekTimeSeconds: number;
};

const normalizeNonNegativeFiniteNumber = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
};

export const resolveUploadedVideoReferenceFrameTime = (
  durationSeconds: number,
  options: UploadedVideoReferenceFrameOptions = {},
) => {
  const duration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;
  if (duration <= 0) {
    return 0;
  }

  const latestDecodableTime = Math.max(
    0,
    duration - WORKSPACE_SEGMENT_REFERENCE_FRAME_LATEST_DECODABLE_OFFSET_SECONDS,
  );
  const requestedTime = options.seekFromEndSeconds === undefined
    ? normalizeNonNegativeFiniteNumber(options.seekSeconds, 0)
    : duration - normalizeNonNegativeFiniteNumber(options.seekFromEndSeconds, 0);

  return Math.min(Math.max(0, requestedTime), latestDecodableTime);
};

const probeUploadedVideoDuration = async (sourcePath: string) => {
  const { stdout } = await execFileAsync(
    FFPROBE_BINARY,
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      sourcePath,
    ],
    {
      maxBuffer: UPLOADED_VIDEO_FRAME_MAX_BUFFER_BYTES,
      timeout: UPLOADED_VIDEO_FRAME_EXTRACTION_TIMEOUT_MS,
    },
  );
  const durationSeconds = Number.parseFloat(String(stdout ?? "").trim());
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Uploaded video duration is unavailable for reference frame extraction.");
  }
  return durationSeconds;
};

export const extractUploadedVideoReferenceFrame = async (
  sourcePath: string,
  options: UploadedVideoReferenceFrameOptions = {},
): Promise<ExtractedUploadedVideoFrame> => {
  const durationSeconds = await probeUploadedVideoDuration(sourcePath);
  const seekTimeSeconds = resolveUploadedVideoReferenceFrameTime(durationSeconds, options);
  const maxSide = Math.max(
    64,
    Math.min(4096, Math.trunc(options.maxSide ?? WORKSPACE_SEGMENT_REFERENCE_FRAME_MAX_SIDE)),
  );
  const workingDirectory = await mkdtemp(join(tmpdir(), "adshorts-uploaded-video-frame-"));
  const outputPath = join(workingDirectory, "reference-frame.jpg");

  try {
    await execFileAsync(
      FFMPEG_BINARY,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        sourcePath,
        "-ss",
        seekTimeSeconds.toFixed(6),
        "-map",
        "0:v:0",
        "-frames:v",
        "1",
        "-an",
        "-vf",
        `scale=min(${maxSide}\\,iw):min(${maxSide}\\,ih):force_original_aspect_ratio=decrease`,
        "-q:v",
        "2",
        outputPath,
      ],
      {
        maxBuffer: UPLOADED_VIDEO_FRAME_MAX_BUFFER_BYTES,
        timeout: UPLOADED_VIDEO_FRAME_EXTRACTION_TIMEOUT_MS,
      },
    );

    const bytes = await readFile(outputPath);
    if (!bytes.length) {
      throw new Error("Extracted uploaded video reference frame is empty.");
    }

    return {
      bytes,
      durationSeconds,
      mimeType: "image/jpeg",
      seekTimeSeconds,
    };
  } finally {
    await rm(workingDirectory, { force: true, recursive: true }).catch(() => undefined);
  }
};
