type WorkspaceSegmentEditorMusicState = {
  customMusicAssetId?: number | null;
  customMusicFileName?: string | null;
  musicType?: string | null;
};

const normalizePositiveInteger = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const rounded = Math.trunc(numeric);
  return rounded > 0 ? rounded : null;
};

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

export const sanitizeWorkspaceSegmentEditorCustomMusicState = <T extends WorkspaceSegmentEditorMusicState>(
  state: T,
  options?: {
    allowEphemeralCustomMusic?: boolean;
    fallbackMusicType?: string | null;
  },
): T => {
  const normalizedMusicType = normalizeText(state.musicType);
  const normalizedCustomMusicAssetId = normalizePositiveInteger(state.customMusicAssetId);
  const normalizedCustomMusicFileName = normalizeText(state.customMusicFileName) || null;

  if (normalizedMusicType.toLowerCase() !== "custom") {
    return {
      ...state,
      customMusicAssetId: normalizedCustomMusicAssetId,
      customMusicFileName: normalizedCustomMusicFileName,
      musicType: normalizedMusicType || state.musicType,
    };
  }

  if (normalizedCustomMusicAssetId) {
    return {
      ...state,
      customMusicAssetId: normalizedCustomMusicAssetId,
      customMusicFileName: normalizedCustomMusicFileName,
      musicType: normalizedMusicType,
    };
  }

  if (options?.allowEphemeralCustomMusic && normalizedCustomMusicFileName) {
    return {
      ...state,
      customMusicAssetId: null,
      customMusicFileName: normalizedCustomMusicFileName,
      musicType: normalizedMusicType,
    };
  }

  const normalizedFallbackMusicType = normalizeText(options?.fallbackMusicType);
  const fallbackMusicType =
    normalizedFallbackMusicType && normalizedFallbackMusicType.toLowerCase() !== "custom"
      ? normalizedFallbackMusicType
      : "ai";

  return {
    ...state,
    customMusicAssetId: null,
    customMusicFileName: null,
    musicType: fallbackMusicType,
  };
};
