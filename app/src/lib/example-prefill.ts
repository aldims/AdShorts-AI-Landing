export type ExamplePrefillIntent = {
  exampleId: string;
  prompt: string;
};

const EXAMPLE_PREFILL_INTENT_STORAGE_KEY = "adshorts.example-prefill-intent";

const isValidExamplePrefillIntent = (value: unknown): value is ExamplePrefillIntent => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as { exampleId?: unknown; prompt?: unknown };
  return typeof payload.exampleId === "string" && payload.exampleId.trim().length > 0 && typeof payload.prompt === "string" && payload.prompt.trim().length > 0;
};

export const readExamplePrefillIntent = (): ExamplePrefillIntent | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(EXAMPLE_PREFILL_INTENT_STORAGE_KEY);
    if (!rawValue) return null;

    const payload = JSON.parse(rawValue) as unknown;
    if (!isValidExamplePrefillIntent(payload)) {
      window.sessionStorage.removeItem(EXAMPLE_PREFILL_INTENT_STORAGE_KEY);
      return null;
    }

    return {
      exampleId: payload.exampleId.trim(),
      prompt: payload.prompt.trim(),
    };
  } catch {
    return null;
  }
};

export const writeExamplePrefillIntent = (intent: ExamplePrefillIntent) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedIntent: ExamplePrefillIntent = {
    exampleId: intent.exampleId.trim(),
    prompt: intent.prompt.trim(),
  };

  if (!normalizedIntent.exampleId || !normalizedIntent.prompt) {
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
