import { describe, expect, it } from "vitest";

import { normalizeStudioGenerateMultipartSegmentState } from "./studio-generate-multipart.js";

describe("studio generate multipart segment state", () => {
  it("preserves durable scene fields from camel-case form payloads", () => {
    const infographic = { mediaAssetId: 501, text: "Три шага" };

    expect(
      normalizeStudioGenerateMultipartSegmentState({
        infographic,
        infographicRemoved: false,
        manualTimingUserChanged: true,
        voiceoverAssetId: 611,
      }),
    ).toEqual({
      infographic,
      infographicRemoved: false,
      manualTimingUserChanged: true,
      voiceoverAssetId: 611,
    });
  });

  it("accepts snake-case aliases and rejects invalid asset ids", () => {
    expect(
      normalizeStudioGenerateMultipartSegmentState({
        infographic_removed: "true",
        manual_timing_user_changed: "false",
        voiceover_asset_id: "611",
      }),
    ).toEqual({
      infographic: undefined,
      infographicRemoved: true,
      manualTimingUserChanged: false,
      voiceoverAssetId: undefined,
    });

    expect(
      normalizeStudioGenerateMultipartSegmentState({ voiceover_asset_id: true }),
    ).toMatchObject({ voiceoverAssetId: undefined });
  });

  it("does not coerce invalid boolean strings into destructive flags", () => {
    expect(
      normalizeStudioGenerateMultipartSegmentState({
        infographic_removed: "remove-maybe",
        manual_timing_user_changed: "changed-maybe",
      }),
    ).toMatchObject({
      infographicRemoved: undefined,
      manualTimingUserChanged: undefined,
    });
  });
});
