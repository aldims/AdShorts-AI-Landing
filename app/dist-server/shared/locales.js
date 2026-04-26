export const SUPPORTED_LOCALES = ["ru", "en"];
export const DEFAULT_LOCALE = "ru";
export const LOCALE_URL_PREFIX = {
    ru: "",
    en: "/en",
};
export const LOCALE_LABELS = {
    ru: "Русский",
    en: "English",
};
export const DEFAULT_STUDIO_VOICE_ID = {
    ru: "Bys_24000",
    en: "Aiden",
};
const supportedLocaleSet = new Set(SUPPORTED_LOCALES);
export const isSupportedLocale = (value) => supportedLocaleSet.has(String(value ?? "").trim().toLowerCase());
export const normalizeLocale = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return isSupportedLocale(normalized) ? normalized : DEFAULT_LOCALE;
};
