const STUDIO_PREVIEW_DISMISS_STORAGE_KEY_PREFIX = "adshorts.studio-preview-dismiss:";
const STUDIO_MEDIA_LIBRARY_HIDDEN_STORAGE_KEY_PREFIX = "adshorts.media-library-hidden:";
const STUDIO_CREATE_MODE_STORAGE_KEY_PREFIX = "adshorts.studio-create-mode:";
const STUDIO_CREATE_SETTINGS_STORAGE_KEY_PREFIX = "adshorts.studio-create-settings:";
const STUDIO_WELCOME_CARD_DISMISS_STORAGE_KEY_PREFIX = "adshorts.studio-welcome-card-dismiss:";

export const normalizeWorkspaceEmail = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();

const getStudioPreviewDismissStorageKey = (email: string) => `${STUDIO_PREVIEW_DISMISS_STORAGE_KEY_PREFIX}${email}`;
const getStudioMediaLibraryHiddenStorageKey = (email: string) => `${STUDIO_MEDIA_LIBRARY_HIDDEN_STORAGE_KEY_PREFIX}${email}`;
const getStudioCreateModeStorageKey = (email: string) => `${STUDIO_CREATE_MODE_STORAGE_KEY_PREFIX}${email}`;
const getStudioCreateSettingsStorageKey = (email: string) => `${STUDIO_CREATE_SETTINGS_STORAGE_KEY_PREFIX}${email}`;
const getStudioWelcomeCardDismissStorageOwner = (email: string | null | undefined) =>
  normalizeWorkspaceEmail(email) || "guest";
const getStudioWelcomeCardDismissStorageKey = (owner: string) =>
  `${STUDIO_WELCOME_CARD_DISMISS_STORAGE_KEY_PREFIX}${owner}`;

export type StoredStudioCreateSettings = {
  language?: string;
  musicName?: string | null;
  musicType?: string;
  subtitleColorId?: string;
  subtitleEnabled?: boolean;
  subtitleStyleId?: string;
  updatedAt?: string;
  version?: 1;
  videoMode?: string;
  voiceEnabled?: boolean;
  voiceId?: string;
  voiceIdsByLanguage?: Partial<Record<"ru" | "en", string>>;
};

export type StoredStudioCreateMode = "default" | "segment-editor";

export const readStoredStudioCreateMode = (
  email: string | null | undefined,
): StoredStudioCreateMode | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  try {
    const storedMode = window.localStorage.getItem(getStudioCreateModeStorageKey(normalizedEmail));
    return storedMode === "default" || storedMode === "segment-editor" ? storedMode : null;
  } catch {
    return null;
  }
};

export const persistStudioCreateMode = (
  email: string | null | undefined,
  mode: StoredStudioCreateMode,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return;
  }

  try {
    window.localStorage.setItem(getStudioCreateModeStorageKey(normalizedEmail), mode);
  } catch {
    // Ignore storage quota errors.
  }
};

const normalizeStoredStudioCreateString = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
};

const normalizeStoredStudioCreateBoolean = (value: unknown) => (typeof value === "boolean" ? value : undefined);

const normalizeStoredStudioCreateVoiceIdsByLanguage = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const ru = normalizeStoredStudioCreateString(source.ru);
  const en = normalizeStoredStudioCreateString(source.en);

  if (!ru && !en) {
    return undefined;
  }

  return {
    ...(ru ? { ru } : {}),
    ...(en ? { en } : {}),
  } satisfies Partial<Record<"ru" | "en", string>>;
};

const normalizeStoredStudioCreateSettings = (value: unknown): StoredStudioCreateSettings | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const voiceIdsByLanguage = normalizeStoredStudioCreateVoiceIdsByLanguage(source.voiceIdsByLanguage);
  const settings: StoredStudioCreateSettings = {
    language: normalizeStoredStudioCreateString(source.language),
    musicName: normalizeStoredStudioCreateString(source.musicName) ?? null,
    musicType: normalizeStoredStudioCreateString(source.musicType),
    subtitleColorId: normalizeStoredStudioCreateString(source.subtitleColorId),
    subtitleEnabled: normalizeStoredStudioCreateBoolean(source.subtitleEnabled),
    subtitleStyleId: normalizeStoredStudioCreateString(source.subtitleStyleId),
    updatedAt: normalizeStoredStudioCreateString(source.updatedAt),
    version: source.version === 1 ? 1 : undefined,
    videoMode: normalizeStoredStudioCreateString(source.videoMode),
    voiceEnabled: normalizeStoredStudioCreateBoolean(source.voiceEnabled),
    voiceId: normalizeStoredStudioCreateString(source.voiceId),
    voiceIdsByLanguage,
  };

  return settings;
};

export const getStudioPreviewDismissKey = (
  generation:
    | {
        adId?: number | null;
        id?: string | null;
        videoUrl?: string | null;
      }
    | null
    | undefined,
) => {
  const normalizedId = String(generation?.id ?? "").trim();
  if (normalizedId) {
    return `id:${normalizedId}`;
  }

  if (typeof generation?.adId === "number" && generation.adId > 0) {
    return `ad:${generation.adId}`;
  }

  const normalizedVideoUrl = String(generation?.videoUrl ?? "").trim();
  return normalizedVideoUrl ? `url:${normalizedVideoUrl}` : null;
};

export const readDismissedStudioPreviewKey = (email: string | null | undefined) => {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  try {
    const storageValue = window.sessionStorage.getItem(getStudioPreviewDismissStorageKey(normalizedEmail));
    return String(storageValue ?? "").trim() || null;
  } catch {
    return null;
  }
};

export const persistDismissedStudioPreviewKey = (email: string | null | undefined, dismissKey: string | null) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return;
  }

  try {
    const storageKey = getStudioPreviewDismissStorageKey(normalizedEmail);
    const normalizedDismissKey = String(dismissKey ?? "").trim();

    if (!normalizedDismissKey) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    window.sessionStorage.setItem(storageKey, normalizedDismissKey);
  } catch {
    // Ignore storage write errors.
  }
};

export const readDismissedStudioWelcomeCard = (email: string | null | undefined) => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const storageValue = window.localStorage.getItem(
      getStudioWelcomeCardDismissStorageKey(getStudioWelcomeCardDismissStorageOwner(email)),
    );
    return storageValue === "1" || storageValue === "true";
  } catch {
    return false;
  }
};

export const persistDismissedStudioWelcomeCard = (
  email: string | null | undefined,
  isDismissed: boolean,
) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const storageKey = getStudioWelcomeCardDismissStorageKey(getStudioWelcomeCardDismissStorageOwner(email));

    if (!isDismissed) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, "1");
  } catch {
    // Ignore storage write errors.
  }
};

export const readHiddenMediaLibraryItemKeys = (email: string | null | undefined) => {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return [] as string[];
  }

  try {
    const storageValue = window.localStorage.getItem(getStudioMediaLibraryHiddenStorageKey(normalizedEmail));
    if (!storageValue) {
      return [] as string[];
    }

    const parsed = JSON.parse(storageValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [] as string[];
    }

    return Array.from(
      new Set(
        parsed
          .map((value) => String(value ?? "").trim())
          .filter((value) => Boolean(value)),
      ),
    );
  } catch {
    return [] as string[];
  }
};

export const persistHiddenMediaLibraryItemKeys = (email: string | null | undefined, keys: string[]) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return;
  }

  try {
    const storageKey = getStudioMediaLibraryHiddenStorageKey(normalizedEmail);
    const normalizedKeys = Array.from(
      new Set(
        keys
          .map((value) => String(value ?? "").trim())
          .filter((value) => Boolean(value)),
      ),
    );

    if (normalizedKeys.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(normalizedKeys));
  } catch {
    // Ignore storage write errors.
  }
};

export const readStoredStudioCreateSettings = (email: string | null | undefined): StoredStudioCreateSettings | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(getStudioCreateSettingsStorageKey(normalizedEmail));
    if (!rawValue) {
      return null;
    }

    return normalizeStoredStudioCreateSettings(JSON.parse(rawValue));
  } catch {
    return null;
  }
};

export const persistStudioCreateSettings = (
  email: string | null | undefined,
  settings: StoredStudioCreateSettings,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return;
  }

  try {
    const storageKey = getStudioCreateSettingsStorageKey(normalizedEmail);
    const normalizedSettings = normalizeStoredStudioCreateSettings({
      ...settings,
      updatedAt: new Date().toISOString(),
      version: 1,
    });

    if (!normalizedSettings) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(normalizedSettings));
  } catch {
    // Ignore storage quota errors.
  }
};
