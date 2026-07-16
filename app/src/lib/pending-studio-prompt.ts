export type PendingStudioPrompt = {
  prompt: string;
  updatedAt: string;
};

const PENDING_STUDIO_PROMPT_STORAGE_KEY = "adshorts.pending-studio-prompt";
const PENDING_STUDIO_PROMPT_MAX_AGE_MS = 30 * 60 * 1000;

const readSessionStorage = () => {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const writePendingStudioPrompt = (prompt: string) => {
  const storage = readSessionStorage();
  if (!storage) return;

  try {
    if (!prompt) {
      storage.removeItem(PENDING_STUDIO_PROMPT_STORAGE_KEY);
      return;
    }

    storage.setItem(
      PENDING_STUDIO_PROMPT_STORAGE_KEY,
      JSON.stringify({
        prompt,
        updatedAt: new Date().toISOString(),
      } satisfies PendingStudioPrompt),
    );
  } catch {
    // A storage failure must not block the studio or authentication.
  }
};

export const clearPendingStudioPrompt = () => {
  const storage = readSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(PENDING_STUDIO_PROMPT_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

export const readPendingStudioPrompt = (nowMs = Date.now()): PendingStudioPrompt | null => {
  const storage = readSessionStorage();
  if (!storage) return null;

  try {
    const rawValue = storage.getItem(PENDING_STUDIO_PROMPT_STORAGE_KEY);
    if (!rawValue) return null;

    const value = JSON.parse(rawValue) as Record<string, unknown>;
    const prompt = typeof value.prompt === "string" ? value.prompt : "";
    const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : "";
    const updatedAtMs = Date.parse(updatedAt);

    if (!prompt || !Number.isFinite(updatedAtMs) || nowMs - updatedAtMs > PENDING_STUDIO_PROMPT_MAX_AGE_MS) {
      clearPendingStudioPrompt();
      return null;
    }

    return { prompt, updatedAt };
  } catch {
    clearPendingStudioPrompt();
    return null;
  }
};
