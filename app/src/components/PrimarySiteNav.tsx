import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { defineMessages, useLocale } from "../lib/i18n";
import { type StudioEntryIntentSection } from "../lib/studio-entry-intent";

type NavItem = "examples" | "home" | "pricing" | "studio";
type StudioNavItem = StudioEntryIntentSection | "pricing";

type Props = {
  activeItem?: NavItem | null;
  activeStudioSection?: StudioEntryIntentSection | null;
  onOpenStudio: () => void;
  onOpenStudioSection?: (section: StudioEntryIntentSection) => void;
  preferStudioSections?: boolean;
  projectsCount?: number;
  showStudioPricingLink?: boolean;
  studioSectionLabels?: Partial<Record<StudioEntryIntentSection, string>>;
  onStudioBack?: (() => void) | null;
};

const navMessages = defineMessages({
  ariaMain: {
    ru: "Главная навигация",
    en: "Main navigation",
  },
  ariaStudioSections: {
    ru: "Разделы студии",
    en: "Studio sections",
  },
  backToStudio: {
    ru: "Вернуться в студию",
    en: "Back to studio",
  },
  examples: {
    ru: "Примеры",
    en: "Examples",
  },
  home: {
    ru: "Главная",
    en: "Home",
  },
  media: {
    ru: "Медиатека",
    en: "Media library",
  },
  pricing: {
    ru: "Тарифы",
    en: "Pricing",
  },
  projects: {
    ru: "Проекты",
    en: "Projects",
  },
  studio: {
    ru: "Студия",
    en: "Studio",
  },
  studioCreate: {
    ru: "Создать Shorts",
    en: "Create Shorts",
  },
});

export function PrimarySiteNav({
  activeItem = null,
  activeStudioSection = null,
  onOpenStudio,
  onOpenStudioSection,
  preferStudioSections = false,
  projectsCount = 0,
  showStudioPricingLink = true,
  studioSectionLabels,
  onStudioBack = null,
}: Props) {
  const { localizePath, t } = useLocale();
  const isStudioActive = activeItem === "studio";
  const shouldRenderStudioSections = Boolean(onOpenStudioSection && (isStudioActive || preferStudioSections));
  const resolvedActiveStudioSection = activeStudioSection === "edit" ? "create" : activeStudioSection;
  const studioMenuId = useId();
  const compactMenuId = useId();
  const [isStudioMenuOpen, setIsStudioMenuOpen] = useState(false);
  const [isCompactMenuOpen, setIsCompactMenuOpen] = useState(false);
  const studioTabsContentRef = useRef<HTMLDivElement | null>(null);
  const studioTabItemRefs = useRef<Partial<Record<StudioNavItem, HTMLElement | null>>>({});

  useEffect(() => {
    if (isStudioActive) {
      const animationFrameId = window.requestAnimationFrame(() => {
        setIsStudioMenuOpen(true);
      });

      return () => {
        window.cancelAnimationFrame(animationFrameId);
      };
    }

    if (activeItem) {
      setIsStudioMenuOpen(false);
    }
  }, [activeItem, isStudioActive]);

  useEffect(() => {
    setIsCompactMenuOpen(false);
  }, [activeItem, activeStudioSection, preferStudioSections]);

  useEffect(() => {
    if (!shouldRenderStudioSections) {
      return;
    }

    const content = studioTabsContentRef.current;
    const activeStudioNavItem: StudioNavItem =
      activeItem === "pricing" && showStudioPricingLink ? "pricing" : resolvedActiveStudioSection ?? "create";
    const activeElement = studioTabItemRefs.current[activeStudioNavItem];

    if (!content || !activeElement) {
      return;
    }

    const updateSelection = () => {
      const contentRect = content.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();

      content.style.setProperty("--site-nav-selection-x", `${activeRect.left - contentRect.left}px`);
      content.style.setProperty("--site-nav-selection-width", `${activeRect.width}px`);
      content.dataset.selectionReady = activeRect.width > 0 ? "true" : "false";
    };

    updateSelection();
    window.addEventListener("resize", updateSelection);

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateSelection);
    resizeObserver?.observe(content);
    resizeObserver?.observe(activeElement);

    return () => {
      delete content.dataset.selectionReady;
      window.removeEventListener("resize", updateSelection);
      resizeObserver?.disconnect();
    };
  }, [
    activeItem,
    projectsCount,
    resolvedActiveStudioSection,
    shouldRenderStudioSections,
    showStudioPricingLink,
  ]);

  const handleStudioSectionSelect = (section: StudioEntryIntentSection) => {
    setIsCompactMenuOpen(false);

    if (onOpenStudioSection) {
      onOpenStudioSection(section);
      return;
    }

    onOpenStudio();
  };

  const handleStudioPrimaryClick = () => {
    setIsCompactMenuOpen(false);

    if (onOpenStudioSection) {
      handleStudioSectionSelect("create");
      return;
    }

    onOpenStudio();
  };

  const activeStudioSectionLabel =
    resolvedActiveStudioSection === "projects"
      ? studioSectionLabels?.projects ?? t(navMessages.projects)
      : resolvedActiveStudioSection === "media"
        ? studioSectionLabels?.media ?? t(navMessages.media)
        : studioSectionLabels?.create ?? t(navMessages.studioCreate);
  const compactToggleLabel =
    isStudioActive && shouldRenderStudioSections
      ? activeStudioSectionLabel
      : isStudioActive
        ? t(navMessages.studio)
        : activeItem === "pricing"
          ? t(navMessages.pricing)
          : activeItem === "examples"
            ? t(navMessages.examples)
            : t(navMessages.home);

  const compactToggle = (
    <button
      className="site-nav__compact-toggle route-button"
      type="button"
      aria-controls={compactMenuId}
      aria-expanded={isCompactMenuOpen}
      aria-label={shouldRenderStudioSections ? `${t(navMessages.ariaStudioSections)}: ${compactToggleLabel}` : undefined}
      onClick={() => setIsCompactMenuOpen((current) => !current)}
    >
      <span>{compactToggleLabel}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  if (shouldRenderStudioSections && onOpenStudioSection) {
    return (
      <nav
        className={`site-nav site-nav--studio-tabs${isCompactMenuOpen ? " is-compact-open" : ""}`}
        aria-label={t(navMessages.ariaStudioSections)}
      >
        {compactToggle}
        <div ref={studioTabsContentRef} id={compactMenuId} className="site-nav__content">
          <span className="site-nav__selection" aria-hidden="true" />
          {([
            { id: "create", label: t(navMessages.studioCreate) },
            { id: "projects", label: t(navMessages.projects) },
            { id: "media", label: t(navMessages.media) },
          ] as Array<{ id: StudioEntryIntentSection; label: string }>).map((item) => (
            <button
              key={item.id}
              ref={(element) => {
                studioTabItemRefs.current[item.id] = element;
              }}
              className={`site-nav__item route-button${resolvedActiveStudioSection === item.id ? " site-nav__item--active" : ""}`}
              type="button"
              onClick={() => handleStudioSectionSelect(item.id)}
            >
              <span>{item.label}</span>
              {item.id === "projects" && projectsCount > 0 ? <span className="site-nav__studio-count">{projectsCount}</span> : null}
            </button>
          ))}
          {showStudioPricingLink ? (
            <Link
              ref={(element) => {
                studioTabItemRefs.current.pricing = element;
              }}
              className={`site-nav__item${activeItem === "pricing" ? " site-nav__item--active" : ""}`}
              to={localizePath("/pricing/")}
              state={{ fromStudio: true }}
              onClick={() => setIsCompactMenuOpen(false)}
            >
              {t(navMessages.pricing)}
            </Link>
          ) : null}
        </div>
      </nav>
    );
  }

  return (
    <nav className={`site-nav${isCompactMenuOpen ? " is-compact-open" : ""}`} aria-label={t(navMessages.ariaMain)}>
      {compactToggle}
      <div id={compactMenuId} className="site-nav__content">
        <Link
          className={`site-nav__item${activeItem === "home" ? " site-nav__item--active" : ""}`}
          to={localizePath("/")}
          onClick={() => setIsCompactMenuOpen(false)}
        >
          {t(navMessages.home)}
        </Link>
        <Link
          className={`site-nav__item${activeItem === "examples" ? " site-nav__item--active" : ""}`}
          to={localizePath("/examples/")}
          onClick={() => setIsCompactMenuOpen(false)}
        >
          {t(navMessages.examples)}
        </Link>

        <div className={`site-nav__menu-shell${isStudioMenuOpen ? " is-open" : ""}`}>
          <button
            className={`site-nav__item site-nav__item--submenu route-button${isStudioActive ? " site-nav__item--active" : ""}${isStudioMenuOpen ? " is-open" : ""}`}
            type="button"
            aria-controls={studioMenuId}
            aria-expanded={isStudioMenuOpen}
            aria-haspopup="menu"
            onClick={handleStudioPrimaryClick}
          >
            <span>{t(navMessages.studio)}</span>
          </button>

          <div className="site-nav__submenu-viewport" aria-hidden={!isStudioMenuOpen} hidden={!isStudioMenuOpen}>
            <div className="site-nav__submenu-viewport-inner">
              <div id={studioMenuId} className="site-nav__submenu" role="menu" aria-label={t(navMessages.ariaStudioSections)}>
                {onStudioBack ? (
                  <button
                    className="site-nav__submenu-back"
                    type="button"
                    role="menuitem"
                    aria-label={t(navMessages.backToStudio)}
                    tabIndex={isStudioMenuOpen ? 0 : -1}
                    onClick={onStudioBack}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ) : null}
                {([
                  { id: "create", label: t(navMessages.studioCreate) },
                  { id: "projects", label: t(navMessages.projects) },
                  { id: "media", label: t(navMessages.media) },
                ] as Array<{ id: StudioEntryIntentSection; label: string }>).map((item) => (
                  <button
                    key={item.id}
                    className={`site-nav__submenu-item${isStudioActive && resolvedActiveStudioSection === item.id ? " is-active" : ""}`}
                    type="button"
                    role="menuitem"
                    tabIndex={isStudioMenuOpen ? 0 : -1}
                    onClick={() => handleStudioSectionSelect(item.id)}
                  >
                    <span>{studioSectionLabels?.[item.id] ?? item.label}</span>
                    {item.id === "projects" && projectsCount > 0 ? <span className="site-nav__studio-count">{projectsCount}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Link
          className={`site-nav__item${activeItem === "pricing" ? " site-nav__item--active" : ""}`}
          to={localizePath("/pricing/")}
          onClick={() => setIsCompactMenuOpen(false)}
        >
          {t(navMessages.pricing)}
        </Link>
      </div>
    </nav>
  );
}
