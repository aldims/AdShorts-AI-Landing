import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "./locales.js";

const STUDIO_VIDEO_LANGUAGE_MIN_LETTER_COUNT = 3;

const normalizeStudioVideoLanguage = (value: string | null | undefined): Locale => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return isSupportedLocale(normalized) ? normalized : DEFAULT_LOCALE;
};

const countScriptLetters = (value: string, script: "Cyrillic" | "Latin") =>
  value.match(new RegExp(`\\p{Script=${script}}`, "gu"))?.length ?? 0;

export const detectStudioVideoLanguage = (
  text: string | null | undefined,
  interfaceLanguage: string | null | undefined,
): Locale => {
  const fallbackLanguage = normalizeStudioVideoLanguage(interfaceLanguage);
  const normalizedText = String(text ?? "").trim();
  if (!normalizedText) {
    return fallbackLanguage;
  }

  const russianLetterCount = countScriptLetters(normalizedText, "Cyrillic");
  const englishLetterCount = countScriptLetters(normalizedText, "Latin");
  const recognizedLetterCount = russianLetterCount + englishLetterCount;

  if (
    recognizedLetterCount < STUDIO_VIDEO_LANGUAGE_MIN_LETTER_COUNT ||
    russianLetterCount === englishLetterCount
  ) {
    return fallbackLanguage;
  }

  return russianLetterCount > englishLetterCount ? "ru" : "en";
};

export const resolveStudioVideoLanguage = (options: {
  interfaceLanguage: string | null | undefined;
  manuallySelectedLanguage?: string | null;
  text: string | null | undefined;
}): Locale => {
  const normalizedManualLanguage = String(options.manuallySelectedLanguage ?? "").trim().toLowerCase();
  if (isSupportedLocale(normalizedManualLanguage)) {
    return normalizedManualLanguage;
  }

  return detectStudioVideoLanguage(options.text, options.interfaceLanguage);
};
