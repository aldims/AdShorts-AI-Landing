import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { type StudioEntryIntentSection } from "../lib/studio-entry-intent";

type NavItem = "examples" | "home" | "pricing" | "studio";

type Props = {
  activeItem?: NavItem | null;
  activeStudioSection?: StudioEntryIntentSection | null;
  onOpenStudio: () => void;
  onOpenStudioSection?: (section: StudioEntryIntentSection) => void;
  projectsCount?: number;
};

const studioNavItems: Array<{
  id: StudioEntryIntentSection;
  label: string;
}> = [
  { id: "create", label: "Создать Shorts" },
  { id: "projects", label: "Проекты" },
  { id: "media", label: "Медиатека" },
];

export function PrimarySiteNav({
  activeItem = null,
  activeStudioSection = null,
  onOpenStudio,
  onOpenStudioSection,
  projectsCount = 0,
}: Props) {
  const isStudioActive = activeItem === "studio";
  const resolvedActiveStudioSection = activeStudioSection === "edit" ? "create" : activeStudioSection;
  const studioMenuId = useId();
  const [isStudioMenuOpen, setIsStudioMenuOpen] = useState(false);

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

  const handleStudioSectionSelect = (section: StudioEntryIntentSection) => {
    if (onOpenStudioSection) {
      onOpenStudioSection(section);
      return;
    }

    onOpenStudio();
  };

  const handleStudioPrimaryClick = () => {
    if (onOpenStudioSection) {
      setIsStudioMenuOpen(true);
      handleStudioSectionSelect("create");
      return;
    }

    onOpenStudio();
  };

  return (
    <nav className="site-nav" aria-label="Главная навигация">
      <Link className={`site-nav__item${activeItem === "home" ? " site-nav__item--active" : ""}`} to="/">
        Главная
      </Link>
      <Link className={`site-nav__item${activeItem === "examples" ? " site-nav__item--active" : ""}`} to="/examples">
        Примеры
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
          <span>Студия</span>
        </button>

        <div className="site-nav__submenu-viewport" aria-hidden={!isStudioMenuOpen}>
          <div className="site-nav__submenu-viewport-inner">
            <div id={studioMenuId} className="site-nav__submenu" role="menu" aria-label="Разделы студии">
              {studioNavItems.map((item) => (
                <button
                  key={item.id}
                  className={`site-nav__submenu-item${isStudioActive && resolvedActiveStudioSection === item.id ? " is-active" : ""}`}
                  type="button"
                  role="menuitem"
                  tabIndex={isStudioMenuOpen ? 0 : -1}
                  onClick={() => handleStudioSectionSelect(item.id)}
                >
                  <span>{item.label}</span>
                  {item.id === "projects" && projectsCount > 0 ? <span className="site-nav__studio-count">{projectsCount}</span> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Link className={`site-nav__item${activeItem === "pricing" ? " site-nav__item--active" : ""}`} to="/pricing">
        Тарифы
      </Link>
    </nav>
  );
}
