import { describe, expect, it } from "vitest";

import {
  getStudioVoicePreview,
  STUDIO_VOICE_PREVIEW_SAMPLES,
  StudioVoicePreviewNotFoundError,
} from "./voice-preview.js";

describe("studio voice previews", () => {
  it("serves every configured preview from bundled audio files", async () => {
    for (const [voiceId, sample] of Object.entries(STUDIO_VOICE_PREVIEW_SAMPLES)) {
      const preview = await getStudioVoicePreview({
        language: sample.language,
        voiceId,
      });

      expect(preview.contentType).toBe("audio/wav");
      expect(preview.audio.byteLength).toBeGreaterThan(1024);
    }
  });

  it("keeps direct preview requests on static aliases", async () => {
    await expect(getStudioVoicePreview({ language: "ru", voiceId: "глеб" })).resolves.toMatchObject({
      contentType: "audio/wav",
    });
    await expect(getStudioVoicePreview({ language: "ru", voiceId: "liam_timing" })).resolves.toMatchObject({
      contentType: "audio/wav",
    });
    await expect(getStudioVoicePreview({ language: "ru", voiceId: "liam" })).resolves.toMatchObject({
      contentType: "audio/wav",
    });
    await expect(getStudioVoicePreview({ language: "ru", voiceId: "Елена" })).resolves.toMatchObject({
      contentType: "audio/wav",
    });
    await expect(getStudioVoicePreview({ language: "ru", voiceId: "adam_v3" })).resolves.toMatchObject({
      contentType: "audio/wav",
    });
    await expect(getStudioVoicePreview({ language: "ru", voiceId: "mark" })).resolves.toMatchObject({
      contentType: "audio/wav",
    });
    await expect(getStudioVoicePreview({ language: "ru", voiceId: "vika grib" })).resolves.toMatchObject({
      contentType: "audio/wav",
    });
    await expect(getStudioVoicePreview({ language: "en", voiceId: "uncle fu" })).resolves.toMatchObject({
      contentType: "audio/wav",
    });
  });

  it("rejects unsupported or mismatched preview requests without generation fallback", async () => {
    await expect(getStudioVoicePreview({ language: "en", voiceId: "Liam" })).rejects.toBeInstanceOf(
      StudioVoicePreviewNotFoundError,
    );
    await expect(getStudioVoicePreview({ language: "ru", voiceId: "unknown" })).rejects.toBeInstanceOf(
      StudioVoicePreviewNotFoundError,
    );
  });
});
