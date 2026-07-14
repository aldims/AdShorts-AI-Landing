const normalizePositiveInteger = (value) => {
    return typeof value === "number" && Number.isInteger(value) && value > 0
        ? value
        : undefined;
};
const normalizeOptionalBoolean = (value) => {
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
export const normalizeStudioGenerateMultipartSegmentState = (segment) => ({
    infographic: segment.infographic,
    infographicRemoved: normalizeOptionalBoolean(segment.infographicRemoved ?? segment.infographic_removed),
    manualTimingUserChanged: normalizeOptionalBoolean(segment.manualTimingUserChanged ?? segment.manual_timing_user_changed),
    voiceoverAssetId: normalizePositiveInteger(segment.voiceoverAssetId ?? segment.voiceover_asset_id),
});
