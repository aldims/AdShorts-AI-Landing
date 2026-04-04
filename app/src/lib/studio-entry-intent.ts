export type StudioEntryIntentSection = "create" | "edit" | "projects" | "media";

export type StudioEntryIntent = {
  section: StudioEntryIntentSection;
};

const STUDIO_ENTRY_INTENT_STORAGE_KEY = "adshorts.studio-entry-intent";

const isValidStudioEntryIntent = (value: unknown): value is StudioEntryIntent => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as { section?: unknown };
  return payload.section === "create" || payload.section === "edit" || payload.section === "projects" || payload.section === "media";
};

export const readStudioEntryIntent = (): StudioEntryIntent | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(STUDIO_ENTRY_INTENT_STORAGE_KEY);
    if (!rawValue) return null;

    const payload = JSON.parse(rawValue) as unknown;
    if (!isValidStudioEntryIntent(payload)) {
      window.sessionStorage.removeItem(STUDIO_ENTRY_INTENT_STORAGE_KEY);
      return null;
    }

    return { section: payload.section };
  } catch {
    return null;
  }
};

export const writeStudioEntryIntent = (intent: StudioEntryIntent) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!isValidStudioEntryIntent(intent)) {
    return;
  }

  try {
    window.sessionStorage.setItem(STUDIO_ENTRY_INTENT_STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // Ignore storage write errors.
  }
};

export const clearStudioEntryIntent = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(STUDIO_ENTRY_INTENT_STORAGE_KEY);
  } catch {
    // Ignore storage remove errors.
  }
};
