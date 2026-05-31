const STUDIO_PREVIEW_DISMISS_STORAGE_KEY_PREFIX = "adshorts.studio-preview-dismiss:";
const STUDIO_MEDIA_LIBRARY_HIDDEN_STORAGE_KEY_PREFIX = "adshorts.media-library-hidden:";

export const normalizeWorkspaceEmail = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();

const getStudioPreviewDismissStorageKey = (email: string) => `${STUDIO_PREVIEW_DISMISS_STORAGE_KEY_PREFIX}${email}`;
const getStudioMediaLibraryHiddenStorageKey = (email: string) => `${STUDIO_MEDIA_LIBRARY_HIDDEN_STORAGE_KEY_PREFIX}${email}`;

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
