import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const FFMPEG_BINARY = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
const UPLOADED_VIDEO_AUDIO_EXTRACTION_TIMEOUT_MS = 5 * 60_000;
const UPLOADED_VIDEO_AUDIO_MAX_BUFFER_BYTES = 8 * 1024 * 1024;

const isMissingAudioStreamError = (error: unknown) => {
  const stderr = String((error as { stderr?: unknown } | null)?.stderr ?? "").toLowerCase();
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  const details = `${message}\n${stderr}`;

  return (
    details.includes("matches no streams") ||
    details.includes("does not contain any stream") ||
    details.includes("output file does not contain any stream")
  );
};

export type ExtractedUploadedVideoAudio = {
  bytes: Buffer;
  mimeType: "audio/mp4";
};

export const extractUploadedVideoAudio = async (
  sourcePath: string,
): Promise<ExtractedUploadedVideoAudio | null> => {
  const workingDirectory = await mkdtemp(join(tmpdir(), "adshorts-uploaded-video-audio-"));
  const outputPath = join(workingDirectory, "audio.m4a");

  try {
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
          "-map",
          "0:a:0",
          "-vn",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-movflags",
          "+faststart",
          outputPath,
        ],
        {
          maxBuffer: UPLOADED_VIDEO_AUDIO_MAX_BUFFER_BYTES,
          timeout: UPLOADED_VIDEO_AUDIO_EXTRACTION_TIMEOUT_MS,
        },
      );
    } catch (error) {
      if (isMissingAudioStreamError(error)) {
        return null;
      }
      throw error;
    }

    const bytes = await readFile(outputPath);
    if (!bytes.length) {
      throw new Error("Extracted uploaded video audio is empty.");
    }

    return {
      bytes,
      mimeType: "audio/mp4",
    };
  } finally {
    await rm(workingDirectory, { force: true, recursive: true }).catch(() => undefined);
  }
};
