type WorkspaceGenerationMusicSelection = {
  assetId?: number | null;
  dataUrl?: string | null;
  file?: unknown;
  fileName?: string | null;
};

type WorkspaceGenerationMusicSession = {
  customMusicAssetId?: number | null;
  customMusicFileName?: string | null;
};

const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizePositiveInteger = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const rounded = Math.trunc(numeric);
  return rounded > 0 ? rounded : null;
};

export const resolveWorkspaceGenerationMusicRequest = (options: {
  requestedMusicType?: string | null;
  selectedCustomMusic?: WorkspaceGenerationMusicSelection | null;
  selectedMusicType?: string | null;
  segmentEditorSession?: WorkspaceGenerationMusicSession | null;
}) => {
  const effectiveMusicType =
    normalizeText(options.requestedMusicType).toLowerCase() ||
    normalizeText(options.selectedMusicType).toLowerCase() ||
    "ai";
  const selectedCustomMusic = options.selectedCustomMusic ?? null;
  const sessionCustomMusicAssetId = normalizePositiveInteger(options.segmentEditorSession?.customMusicAssetId);
  const selectedCustomMusicAssetId = normalizePositiveInteger(selectedCustomMusic?.assetId);
  const selectedCustomMusicFileName = normalizeText(selectedCustomMusic?.fileName);
  const sessionCustomMusicFileName = normalizeText(options.segmentEditorSession?.customMusicFileName);
  const hasSelectedCustomMusicFile = Boolean(selectedCustomMusic?.file);
  const hasSelectedCustomMusicDataUrl = Boolean(normalizeText(selectedCustomMusic?.dataUrl));
  const customMusicAssetId = selectedCustomMusicAssetId ?? sessionCustomMusicAssetId;
  const customMusicFileName = selectedCustomMusicFileName || sessionCustomMusicFileName || null;
  const requiresCustomMusic = effectiveMusicType === "custom";
  const hasAnyCustomMusicSource = requiresCustomMusic
    ? Boolean(customMusicAssetId || hasSelectedCustomMusicFile || hasSelectedCustomMusicDataUrl)
    : false;

  return {
    customMusicAssetId,
    customMusicFileName,
    effectiveMusicType,
    hasAnyCustomMusicSource,
    hasSelectedCustomMusicDataUrl,
    hasSelectedCustomMusicFile,
    requiresCustomMusic,
  };
};
