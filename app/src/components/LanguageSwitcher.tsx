import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { LOCALE_LABELS, SUPPORTED_LOCALES } from "../../shared/locales";
import { localizePathForLocale, persistPreferredLocale, useLocale, type Locale } from "../lib/i18n";

const shortLocaleLabels: Record<Locale, string> = {
  ru: "RU",
  en: "EN",
};

export function LanguageSwitcher() {
  const { locale } = useLocale();
  const location = useLocation();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const ariaLabel = locale === "en" ? "Language selection" : "Выбор языка";
  const currentLabel = LOCALE_LABELS[locale];
  const triggerLabel = locale === "en" ? `Language: ${currentLabel}` : `Язык: ${currentLabel}`;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={`language-switcher${isOpen ? " is-open" : ""}`} ref={rootRef}>
      <button
        className="language-switcher__trigger route-button"
        type="button"
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => setIsOpen((current) => !current)}
      >
        <svg className="language-switcher__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3 12h18M12 3c2.2 2.35 3.4 5.35 3.4 9s-1.2 6.65-3.4 9M12 3c-2.2 2.35-3.4 5.35-3.4 9s1.2 6.65 3.4 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>{shortLocaleLabels[locale]}</span>
      </button>

      <nav className="language-switcher__menu" id={menuId} aria-label={ariaLabel} role="menu" hidden={!isOpen}>
        {SUPPORTED_LOCALES.map((targetLocale) => {
          const isActive = targetLocale === locale;

          return (
            <Link
              key={targetLocale}
              aria-current={isActive ? "page" : undefined}
              aria-label={`${shortLocaleLabels[targetLocale]} ${LOCALE_LABELS[targetLocale]}`}
              className={`language-switcher__option${isActive ? " is-active" : ""}`}
              role="menuitem"
              to={localizePathForLocale(targetLocale, currentPath)}
              onClick={() => {
                persistPreferredLocale(targetLocale);
                setIsOpen(false);
              }}
            >
              <span className="language-switcher__code">{shortLocaleLabels[targetLocale]}</span>
              <span className="language-switcher__label">{LOCALE_LABELS[targetLocale]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
