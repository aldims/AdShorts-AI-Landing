export const SUPPORTED_LOCALES = ["ru", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ru";

export const LOCALE_URL_PREFIX: Record<Locale, string> = {
  ru: "",
  en: "/en",
};

export const LOCALE_LABELS: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
};

export const DEFAULT_STUDIO_VOICE_ID: Record<Locale, string> = {
  ru: "Bys_24000",
  en: "Aiden",
};

const supportedLocaleSet = new Set<string>(SUPPORTED_LOCALES);

export const isSupportedLocale = (value: string | null | undefined): value is Locale =>
  supportedLocaleSet.has(String(value ?? "").trim().toLowerCase());

export const normalizeLocale = (value: string | null | undefined): Locale => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return isSupportedLocale(normalized) ? normalized : DEFAULT_LOCALE;
};
