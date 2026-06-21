export type PendingAuthFlow = {
  authMode: "signin" | "signup";
  authProvider: "google" | "telegram";
  lang: string;
  path: string | null;
  startedAt: string;
};

const PENDING_AUTH_FLOW_STORAGE_KEY = "adshorts.pending-auth-flow";
const PENDING_AUTH_FLOW_MAX_AGE_MS = 30 * 60 * 1000;

const readSessionStorage = () => {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const normalizeAuthMode = (value: unknown): PendingAuthFlow["authMode"] | null =>
  value === "signin" || value === "signup" ? value : null;

const normalizeAuthProvider = (value: unknown): PendingAuthFlow["authProvider"] | null =>
  value === "google" || value === "telegram" ? value : null;

export const writePendingAuthFlow = (flow: Omit<PendingAuthFlow, "startedAt">) => {
  const storage = readSessionStorage();
  if (!storage) return;

  try {
    storage.setItem(
      PENDING_AUTH_FLOW_STORAGE_KEY,
      JSON.stringify({
        ...flow,
        startedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Analytics must not block auth.
  }
};

export const clearPendingAuthFlow = () => {
  const storage = readSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(PENDING_AUTH_FLOW_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

export const readPendingAuthFlow = (nowMs = Date.now()): PendingAuthFlow | null => {
  const storage = readSessionStorage();
  if (!storage) return null;

  try {
    const rawValue = storage.getItem(PENDING_AUTH_FLOW_STORAGE_KEY);
    if (!rawValue) return null;

    const value = JSON.parse(rawValue) as Record<string, unknown>;
    const authMode = normalizeAuthMode(value.authMode);
    const authProvider = normalizeAuthProvider(value.authProvider);
    const startedAt = typeof value.startedAt === "string" ? value.startedAt : "";
    const startedAtMs = Date.parse(startedAt);
    if (!authMode || !authProvider || !Number.isFinite(startedAtMs)) {
      clearPendingAuthFlow();
      return null;
    }

    if (nowMs - startedAtMs > PENDING_AUTH_FLOW_MAX_AGE_MS) {
      clearPendingAuthFlow();
      return null;
    }

    return {
      authMode,
      authProvider,
      lang: typeof value.lang === "string" ? value.lang : "",
      path: typeof value.path === "string" ? value.path : null,
      startedAt,
    };
  } catch {
    clearPendingAuthFlow();
    return null;
  }
};
