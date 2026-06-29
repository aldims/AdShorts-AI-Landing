import {
  STUDIO_ALLOWED_SEGMENT_CUSTOM_IMAGE_EXTENSIONS,
  truncateStudioCustomAssetName,
} from "./workspace-segment-editor";
import {
  getWorkspaceSegmentEditorBrandStorageKey,
  normalizeWorkspaceSegmentEditorStorageEmail,
  readWorkspaceSegmentEditorStorageCandidates,
  removeWorkspaceSegmentEditorStorageValue,
  removeWorkspaceSegmentEditorStorageValueFrom,
  writeWorkspaceSegmentEditorStorageValue,
} from "./workspace-segment-editor-storage";
import type { StudioBrandLogoFile } from "./workspace-types";
import type { Locale } from "../../lib/i18n";

export const STUDIO_BRAND_LOGO_MAX_BYTES = 12 * 1024 * 1024;
export const STUDIO_BRAND_TEXT_MAX_CHARS = 50;

const STUDIO_BRAND_SETTINGS_STORAGE_KEY_PREFIX = "adshorts.studio-brand:";

const normalizeWorkspaceEmail = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();

const getStudioBrandSettingsStorageKey = (email: string) => `${STUDIO_BRAND_SETTINGS_STORAGE_KEY_PREFIX}${email}`;

export type StudioBrandSettingsSnapshot = {
  brandLogoFile: StudioBrandLogoFile | null;
  brandText: string;
};

type StoredStudioBrandSettings = {
  brandLogoFile?: {
    dataUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  } | null;
  brandText?: string;
};

export type WorkspaceSegmentEditorProjectBrandState = StudioBrandSettingsSnapshot & {
  systemWatermarkEnabled: boolean;
};

export type WorkspaceSegmentEditorProjectBrandSnapshot = {
  applied: WorkspaceSegmentEditorProjectBrandState;
  baseline: WorkspaceSegmentEditorProjectBrandState;
};

export type WorkspaceSegmentEditorEffectiveBrandState = {
  brandSnapshot: StudioBrandSettingsSnapshot;
  state: WorkspaceSegmentEditorProjectBrandState;
  hasBranding: boolean;
  hasBrandChange: boolean;
  hasBrandRemoval: boolean;
  hasSystemWatermarkAddition: boolean;
  hasSystemWatermarkRemoval: boolean;
};

export const isSupportedStudioBrandLogoFile = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase();
  return STUDIO_ALLOWED_SEGMENT_CUSTOM_IMAGE_EXTENSIONS.some((extension) => normalized.endsWith(extension));
};

export const getStudioBrandLogoMimeType = (file: File) => {
  if (file.type) {
    return file.type;
  }

  const normalized = file.name.trim().toLowerCase();
  if (normalized.endsWith(".avif")) return "image/avif";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
};

const getStudioBrandTextPreview = (value: string) => {
  const normalized = value.trim();
  return normalized ? truncateStudioCustomAssetName(normalized, 20) : "";
};

export const getStudioBrandSummary = (
  options: { brandLogoFile?: StudioBrandLogoFile | null; brandText?: string | null },
  locale: Locale = "ru",
) => {
  const normalizedText = String(options.brandText ?? "").trim();
  if (options.brandLogoFile && normalizedText) {
    return `${truncateStudioCustomAssetName(options.brandLogoFile.fileName, 18)} + ${locale === "en" ? "text" : "текст"}`;
  }

  if (options.brandLogoFile) {
    return truncateStudioCustomAssetName(options.brandLogoFile.fileName, 22);
  }

  if (normalizedText) {
    return `${locale === "en" ? "Text" : "Текст"}: ${getStudioBrandTextPreview(normalizedText)}`;
  }

  return locale === "en" ? "Logo or brand text" : "Лого или текст бренда";
};

const inferStudioBrandLogoExtension = (mimeType: string) => {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "image/avif") return ".avif";
  if (normalized === "image/png") return ".png";
  if (normalized === "image/webp") return ".webp";
  return ".jpg";
};

export const readStoredStudioBrandSettings = (email: string | null | undefined): StudioBrandSettingsSnapshot => {
  if (typeof window === "undefined") {
    return { brandLogoFile: null, brandText: "" };
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return { brandLogoFile: null, brandText: "" };
  }

  try {
    const rawValue = window.localStorage.getItem(getStudioBrandSettingsStorageKey(normalizedEmail));
    if (!rawValue) {
      return { brandLogoFile: null, brandText: "" };
    }

    const parsed = JSON.parse(rawValue) as StoredStudioBrandSettings | null;
    const brandText = String(parsed?.brandText ?? "").slice(0, STUDIO_BRAND_TEXT_MAX_CHARS);
    const storedLogo = parsed?.brandLogoFile && typeof parsed.brandLogoFile === "object" ? parsed.brandLogoFile : null;
    const dataUrl = String(storedLogo?.dataUrl ?? "").trim();
    const mimeType =
      String(storedLogo?.mimeType ?? "").trim() ||
      String(dataUrl.match(/^data:([^;,]+);base64,/i)?.[1] ?? "").trim() ||
      "image/png";
    const fileSize = Math.max(0, Number(storedLogo?.fileSize ?? 0) || 0);
    const rawFileName = String(storedLogo?.fileName ?? "").trim();
    const fileName = isSupportedStudioBrandLogoFile(rawFileName)
      ? rawFileName
      : `brand-logo${inferStudioBrandLogoExtension(mimeType)}`;

    if (!dataUrl || !dataUrl.startsWith("data:image/") || fileSize > STUDIO_BRAND_LOGO_MAX_BYTES) {
      return { brandLogoFile: null, brandText };
    }

    return {
      brandLogoFile: {
        dataUrl,
        fileName,
        fileSize,
        mimeType,
      },
      brandText,
    };
  } catch {
    return { brandLogoFile: null, brandText: "" };
  }
};

export const persistStudioBrandSettings = (
  email: string | null | undefined,
  settings: StudioBrandSettingsSnapshot,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return;
  }

  try {
    const storageKey = getStudioBrandSettingsStorageKey(normalizedEmail);
    const brandText = settings.brandText.trim().slice(0, STUDIO_BRAND_TEXT_MAX_CHARS);
    const logoDataUrl = String(settings.brandLogoFile?.dataUrl ?? "").trim();
    const payload: StoredStudioBrandSettings = {
      brandText,
      brandLogoFile:
        settings.brandLogoFile && logoDataUrl
          ? {
              dataUrl: logoDataUrl,
              fileName: settings.brandLogoFile.fileName,
              fileSize: settings.brandLogoFile.fileSize,
              mimeType: settings.brandLogoFile.mimeType,
            }
          : null,
    };

    if (!payload.brandText && !payload.brandLogoFile) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors.
  }
};

export const normalizeStudioBrandSettingsText = (value: string | null | undefined) =>
  String(value ?? "").trim().slice(0, STUDIO_BRAND_TEXT_MAX_CHARS);

const getStudioBrandLogoComparableKey = (brandLogoFile: StudioBrandLogoFile | null | undefined) => {
  if (!brandLogoFile) {
    return "";
  }

  return [
    String(brandLogoFile.assetId ?? ""),
    String(brandLogoFile.dataUrl ?? ""),
    String(brandLogoFile.objectUrl ?? ""),
    String(brandLogoFile.fileName ?? ""),
    String(brandLogoFile.mimeType ?? ""),
    String(brandLogoFile.fileSize ?? ""),
  ].join("|");
};

export const areStudioBrandSettingsEqual = (
  left: StudioBrandSettingsSnapshot,
  right: StudioBrandSettingsSnapshot,
) =>
  normalizeStudioBrandSettingsText(left.brandText) === normalizeStudioBrandSettingsText(right.brandText) &&
  getStudioBrandLogoComparableKey(left.brandLogoFile) === getStudioBrandLogoComparableKey(right.brandLogoFile);

const normalizeStoredStudioBrandLogoFile = (value: unknown): StudioBrandLogoFile | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<StudioBrandLogoFile>;
  const assetId = Number.isFinite(Number(record.assetId)) && Number(record.assetId) > 0
    ? Math.trunc(Number(record.assetId))
    : undefined;
  const dataUrl = String(record.dataUrl ?? "").trim();
  const mimeType =
    String(record.mimeType ?? "").trim() ||
    String(dataUrl.match(/^data:([^;,]+);base64,/i)?.[1] ?? "").trim() ||
    "image/png";
  const fileSize = Math.max(0, Number(record.fileSize ?? 0) || 0);
  const rawFileName = String(record.fileName ?? "").trim();
  const fileName = isSupportedStudioBrandLogoFile(rawFileName)
    ? rawFileName
    : `brand-logo${inferStudioBrandLogoExtension(mimeType)}`;

  if (!assetId && (!dataUrl || !dataUrl.startsWith("data:image/"))) {
    return null;
  }

  if (fileSize > STUDIO_BRAND_LOGO_MAX_BYTES) {
    return null;
  }

  return {
    assetId,
    dataUrl: dataUrl || undefined,
    fileName,
    fileSize,
    mimeType,
  };
};

const normalizeWorkspaceSegmentEditorProjectBrandState = (
  value: unknown,
  fallback?: WorkspaceSegmentEditorProjectBrandState | null,
): WorkspaceSegmentEditorProjectBrandState => {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    brandLogoFile:
      normalizeStoredStudioBrandLogoFile(record.brandLogoFile) ??
      normalizeStoredStudioBrandLogoFile(record.brand_logo_file) ??
      fallback?.brandLogoFile ??
      null,
    brandText: normalizeStudioBrandSettingsText(String(record.brandText ?? record.brand_text ?? fallback?.brandText ?? "")),
    systemWatermarkEnabled:
      typeof record.systemWatermarkEnabled === "boolean"
        ? record.systemWatermarkEnabled
        : typeof record.system_watermark_enabled === "boolean"
          ? record.system_watermark_enabled
          : Boolean(fallback?.systemWatermarkEnabled),
  };
};

export const createWorkspaceSegmentEditorProjectBrandState = (
  options?: {
    brandLogoFile?: StudioBrandLogoFile | null;
    brandText?: string | null;
    systemWatermarkEnabled?: boolean;
  } | null,
): WorkspaceSegmentEditorProjectBrandState => ({
  brandLogoFile: options?.brandLogoFile ?? null,
  brandText: normalizeStudioBrandSettingsText(options?.brandText),
  systemWatermarkEnabled: Boolean(options?.systemWatermarkEnabled),
});

export const areWorkspaceSegmentEditorProjectBrandStatesEqual = (
  left: WorkspaceSegmentEditorProjectBrandState,
  right: WorkspaceSegmentEditorProjectBrandState,
) =>
  areStudioBrandSettingsEqual(left, right) &&
  left.systemWatermarkEnabled === right.systemWatermarkEnabled;

const hasWorkspaceSegmentEditorBranding = (state: StudioBrandSettingsSnapshot) =>
  Boolean(state.brandLogoFile) || Boolean(normalizeStudioBrandSettingsText(state.brandText));

export const resolveWorkspaceSegmentEditorEffectiveBrandState = (options: {
  applied: WorkspaceSegmentEditorProjectBrandState;
  baseline: WorkspaceSegmentEditorProjectBrandState;
  current: WorkspaceSegmentEditorProjectBrandState;
  showSystemWatermarkControl?: boolean;
  useCurrentDraft?: boolean;
}): WorkspaceSegmentEditorEffectiveBrandState => {
  const state = options.useCurrentDraft ? options.current : options.applied;
  const brandSnapshot: StudioBrandSettingsSnapshot = {
    brandLogoFile: state.brandLogoFile,
    brandText: normalizeStudioBrandSettingsText(state.brandText),
  };
  const baselineBrandSnapshot: StudioBrandSettingsSnapshot = {
    brandLogoFile: options.baseline.brandLogoFile,
    brandText: normalizeStudioBrandSettingsText(options.baseline.brandText),
  };
  const hasBranding = hasWorkspaceSegmentEditorBranding(brandSnapshot);
  const hasBaselineBranding = hasWorkspaceSegmentEditorBranding(baselineBrandSnapshot);
  const showSystemWatermarkControl = Boolean(options.showSystemWatermarkControl);

  return {
    brandSnapshot,
    state,
    hasBranding,
    hasBrandChange: !areStudioBrandSettingsEqual(baselineBrandSnapshot, brandSnapshot),
    hasBrandRemoval: hasBaselineBranding && !hasBranding,
    hasSystemWatermarkAddition:
      showSystemWatermarkControl &&
      !options.baseline.systemWatermarkEnabled &&
      state.systemWatermarkEnabled,
    hasSystemWatermarkRemoval:
      showSystemWatermarkControl &&
      options.baseline.systemWatermarkEnabled &&
      !state.systemWatermarkEnabled,
  };
};

export const shouldSendWorkspaceSegmentEditorBrandChangeForGeneration = (
  state: WorkspaceSegmentEditorEffectiveBrandState,
  options?: { isBrandDirty?: boolean },
) =>
  Boolean(
    options?.isBrandDirty ||
      state.hasBranding ||
      state.hasBrandChange ||
      state.hasSystemWatermarkAddition ||
      state.hasSystemWatermarkRemoval,
  );

export const resolveWorkspaceGenerationSystemWatermarkOnSuccess = (options: {
  explicitAddWatermarkOverride?: boolean;
  serverAddWatermark?: boolean | null;
}) =>
  typeof options.serverAddWatermark === "boolean"
    ? options.serverAddWatermark
    : typeof options.explicitAddWatermarkOverride === "boolean"
      ? options.explicitAddWatermarkOverride
      : false;

export const resolveWorkspaceSegmentEditorProjectBrandSnapshot = (options: {
  defaultState: WorkspaceSegmentEditorProjectBrandState;
  storedSnapshot?: WorkspaceSegmentEditorProjectBrandSnapshot | null;
}): WorkspaceSegmentEditorProjectBrandSnapshot => {
  const baseline = options.storedSnapshot?.baseline ?? options.defaultState;
  return {
    applied: options.storedSnapshot?.applied ?? baseline,
    baseline,
  };
};

const serializeWorkspaceSegmentEditorProjectBrandState = (
  state: WorkspaceSegmentEditorProjectBrandState,
) => {
  const brandLogoFile = normalizeStoredStudioBrandLogoFile(state.brandLogoFile);

  return {
    brandLogoFile: brandLogoFile
      ? {
          assetId: brandLogoFile.assetId,
          dataUrl: brandLogoFile.dataUrl,
          fileName: brandLogoFile.fileName,
          fileSize: brandLogoFile.fileSize,
          mimeType: brandLogoFile.mimeType,
        }
      : null,
    brandText: normalizeStudioBrandSettingsText(state.brandText),
    systemWatermarkEnabled: Boolean(state.systemWatermarkEnabled),
  };
};

const normalizeWorkspaceSegmentEditorProjectBrandSnapshot = (
  value: unknown,
): WorkspaceSegmentEditorProjectBrandSnapshot | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const hasNestedSnapshot = Boolean(record.baseline || record.applied);
  const baseline = hasNestedSnapshot
    ? normalizeWorkspaceSegmentEditorProjectBrandState(record.baseline)
    : normalizeWorkspaceSegmentEditorProjectBrandState(record);
  const applied = hasNestedSnapshot
    ? normalizeWorkspaceSegmentEditorProjectBrandState(record.applied, baseline)
    : baseline;

  return { applied, baseline };
};

export const readStoredWorkspaceSegmentEditorBrandSnapshot = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return null;
  }

  const storageKey = getWorkspaceSegmentEditorBrandStorageKey(normalizedEmail, normalizedProjectId);

  for (const candidate of readWorkspaceSegmentEditorStorageCandidates(storageKey)) {
    try {
      const parsedValue = JSON.parse(candidate.rawValue) as unknown;
      const normalizedSnapshot = normalizeWorkspaceSegmentEditorProjectBrandSnapshot(parsedValue);
      if (!normalizedSnapshot) {
        removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
        continue;
      }

      if (candidate.storageName === "sessionStorage") {
        writeWorkspaceSegmentEditorStorageValue(
          storageKey,
          JSON.stringify({
            applied: serializeWorkspaceSegmentEditorProjectBrandState(normalizedSnapshot.applied),
            baseline: serializeWorkspaceSegmentEditorProjectBrandState(normalizedSnapshot.baseline),
          }),
        );
      }

      return normalizedSnapshot;
    } catch {
      removeWorkspaceSegmentEditorStorageValueFrom(candidate.storageName, storageKey);
    }
  }

  return null;
};

export const writeStoredWorkspaceSegmentEditorBrandSnapshot = (
  email: string | null | undefined,
  projectId: number | null | undefined,
  snapshot: WorkspaceSegmentEditorProjectBrandSnapshot,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return;
  }

  writeWorkspaceSegmentEditorStorageValue(
    getWorkspaceSegmentEditorBrandStorageKey(normalizedEmail, normalizedProjectId),
    JSON.stringify({
      applied: serializeWorkspaceSegmentEditorProjectBrandState(snapshot.applied),
      baseline: serializeWorkspaceSegmentEditorProjectBrandState(snapshot.baseline),
    }),
  );
};

export const removeStoredWorkspaceSegmentEditorBrandSnapshot = (
  email: string | null | undefined,
  projectId: number | null | undefined,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceSegmentEditorStorageEmail(email);
  const normalizedProjectId = Number(projectId);
  if (!normalizedEmail || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return;
  }

  removeWorkspaceSegmentEditorStorageValue(getWorkspaceSegmentEditorBrandStorageKey(normalizedEmail, normalizedProjectId));
};
