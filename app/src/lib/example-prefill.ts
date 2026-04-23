import {
  normalizeExamplePrefillIntent,
  type ExamplePrefillIntent,
} from "../../shared/example-prefill";

export type { ExamplePrefillIntent } from "../../shared/example-prefill";

const EXAMPLE_PREFILL_INTENT_STORAGE_KEY = "adshorts.example-prefill-intent";

export const readExamplePrefillIntent = (): ExamplePrefillIntent | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(EXAMPLE_PREFILL_INTENT_STORAGE_KEY);
    if (!rawValue) return null;

    const payload = JSON.parse(rawValue) as unknown;
    const normalizedIntent = normalizeExamplePrefillIntent(payload);
    if (!normalizedIntent) {
      window.sessionStorage.removeItem(EXAMPLE_PREFILL_INTENT_STORAGE_KEY);
      return null;
    }

    return normalizedIntent;
  } catch {
    return null;
  }
};

export const writeExamplePrefillIntent = (intent: ExamplePrefillIntent) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedIntent = normalizeExamplePrefillIntent(intent);

  if (!normalizedIntent) {
    return;
  }

  try {
    window.sessionStorage.setItem(EXAMPLE_PREFILL_INTENT_STORAGE_KEY, JSON.stringify(normalizedIntent));
  } catch {
    // Ignore storage write errors.
  }
};

export const clearExamplePrefillIntent = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(EXAMPLE_PREFILL_INTENT_STORAGE_KEY);
  } catch {
    // Ignore storage remove errors.
  }
};
