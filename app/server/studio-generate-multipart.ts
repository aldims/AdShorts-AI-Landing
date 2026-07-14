type StudioGenerateMultipartSegmentState = {
  infographic?: unknown;
  infographicRemoved?: unknown;
  infographic_removed?: unknown;
  manualTimingUserChanged?: unknown;
  manual_timing_user_changed?: unknown;
  voiceoverAssetId?: unknown;
  voiceover_asset_id?: unknown;
};

const normalizePositiveInteger = (value: unknown) => {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
};

const normalizeOptionalBoolean = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
};

export const normalizeStudioGenerateMultipartSegmentState = (
  segment: StudioGenerateMultipartSegmentState,
) => ({
  infographic: segment.infographic,
  infographicRemoved: normalizeOptionalBoolean(
    segment.infographicRemoved ?? segment.infographic_removed,
  ),
  manualTimingUserChanged: normalizeOptionalBoolean(
    segment.manualTimingUserChanged ?? segment.manual_timing_user_changed,
  ),
  voiceoverAssetId: normalizePositiveInteger(
    segment.voiceoverAssetId ?? segment.voiceover_asset_id,
  ),
});
