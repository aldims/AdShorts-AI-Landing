import { createContext, type ReactNode, useContext, useMemo } from "react";

import {
  DEFAULT_LOCALE,
  LOCALE_URL_PREFIX,
  SUPPORTED_LOCALES,
  type Locale,
  isSupportedLocale,
  normalizeLocale,
} from "../../shared/locales";

export type { Locale };

export type LocalizedText = Record<Locale, string>;

type LocaleContextValue = {
  locale: Locale;
  localizePath: (path: string) => string;
  t: (message: LocalizedText) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const PREFERRED_LOCALE_STORAGE_KEY = "adshorts.locale";
const LEGACY_PREFERRED_LOCALE_STORAGE_KEY = "manual_lang";

export const defineMessages = <T extends Record<string, LocalizedText>>(messages: T) => messages;

export const tForLocale = (locale: Locale, message: LocalizedText) => message[locale] ?? message[DEFAULT_LOCALE];

const localePathSegmentPattern = new RegExp(`^/(${SUPPORTED_LOCALES.join("|")})(?=/|$)`);

export const pathnameHasLocalePrefix = (pathname: string): boolean => {
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return localePathSegmentPattern.test(normalizedPathname);
};

export const resolveLocaleFromPathname = (pathname: string): Locale => {
  const firstSegment = pathname.split(/[?#]/)[0]?.split("/").filter(Boolean)[0] ?? "";
  return normalizeLocale(firstSegment);
};

export const stripLocalePrefix = (pathname: string): string => {
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const stripped = normalizedPathname.replace(localePathSegmentPattern, "") || "/";
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
};

export const localizePathForLocale = (locale: Locale, path: string): string => {
  if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(path) || path.startsWith("mailto:") || path.startsWith("#")) {
    return path;
  }

  const [pathAndQuery, hash = ""] = path.split("#", 2);
  const [pathname = "/", query = ""] = pathAndQuery.split("?", 2);
  const strippedPathname = stripLocalePrefix(pathname || "/");
  const prefix = LOCALE_URL_PREFIX[locale];
  const localizedPathname =
    locale === DEFAULT_LOCALE
      ? strippedPathname
      : strippedPathname === "/"
        ? prefix || "/"
        : `${prefix}${strippedPathname}`;
  const normalizedLocalizedPathname = localizedPathname || "/";

  return `${normalizedLocalizedPathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
};

export const readPreferredLocale = (): Locale | null => {
  if (typeof window === "undefined") return null;

  try {
    const storedLocale =
      window.localStorage.getItem(PREFERRED_LOCALE_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_PREFERRED_LOCALE_STORAGE_KEY);

    return isSupportedLocale(storedLocale) ? storedLocale : null;
  } catch {
    return null;
  }
};

export const persistPreferredLocale = (locale: Locale) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PREFERRED_LOCALE_STORAGE_KEY, locale);
    window.localStorage.setItem(LEGACY_PREFERRED_LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage write errors.
  }
};

export function LocaleProvider({ children, locale }: { children: ReactNode; locale: Locale }) {
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      localizePath: (path: string) => localizePathForLocale(locale, path),
      t: (message: LocalizedText) => tForLocale(locale, message),
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error("useLocale must be used inside LocaleProvider.");
  }

  return value;
};
