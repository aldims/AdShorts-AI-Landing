export type PricingEntryIntentSection = "plans" | "addons";

export type PricingEntryIntent = {
  section: PricingEntryIntentSection;
  source: "insufficient-credits";
};

const PRICING_ENTRY_INTENT_STORAGE_KEY = "adshorts.pricing-entry-intent";

const isValidPricingEntryIntent = (value: unknown): value is PricingEntryIntent => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as { section?: unknown; source?: unknown };
  return (
    payload.source === "insufficient-credits" &&
    (payload.section === "plans" || payload.section === "addons")
  );
};

export const readPricingEntryIntent = (): PricingEntryIntent | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(PRICING_ENTRY_INTENT_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const payload = JSON.parse(rawValue) as unknown;
    if (!isValidPricingEntryIntent(payload)) {
      window.sessionStorage.removeItem(PRICING_ENTRY_INTENT_STORAGE_KEY);
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

export const writePricingEntryIntent = (intent: PricingEntryIntent) => {
  if (typeof window === "undefined" || !isValidPricingEntryIntent(intent)) {
    return;
  }

  try {
    window.sessionStorage.setItem(PRICING_ENTRY_INTENT_STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // Ignore storage write errors.
  }
};

export const clearPricingEntryIntent = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(PRICING_ENTRY_INTENT_STORAGE_KEY);
  } catch {
    // Ignore storage remove errors.
  }
};
