import { Link } from "react-router-dom";

type NavItem = "examples" | "home" | "pricing" | "studio";
type StudioView = "create" | "projects";

type Props = {
  activeItem?: NavItem | null;
  onOpenStudio: () => void;
  studioView?: StudioView;
  onStudioViewChange?: (view: StudioView) => void;
  projectsCount?: number;
};

export function PrimarySiteNav({
  activeItem = null,
  onOpenStudio,
  studioView = "create",
  onStudioViewChange,
  projectsCount = 0,
}: Props) {
  const isStudioActive = activeItem === "studio";

  return (
    <nav className="site-nav" aria-label="Главная навигация">
      <Link className={`site-nav__item${activeItem === "home" ? " site-nav__item--active" : ""}`} to="/">
        Главная
      </Link>
      <Link className={`site-nav__item${activeItem === "examples" ? " site-nav__item--active" : ""}`} to="/examples">
        Примеры
      </Link>

      {isStudioActive && onStudioViewChange ? (
        <div className="site-nav__item site-nav__item--active site-nav__item--studio">
          <span className="site-nav__studio-label">Студия</span>
          <div className="site-nav__studio-toggle">
            <button
              className={`site-nav__studio-btn${studioView === "create" ? " is-active" : ""}`}
              type="button"
              onClick={() => onStudioViewChange("create")}
            >
              Создать
            </button>
            <button
              className={`site-nav__studio-btn${studioView === "projects" ? " is-active" : ""}`}
              type="button"
              onClick={() => onStudioViewChange("projects")}
            >
              Проекты
              {projectsCount > 0 ? <span className="site-nav__studio-count">{projectsCount}</span> : null}
            </button>
          </div>
        </div>
      ) : (
        <button
          className={`site-nav__item route-button${isStudioActive ? " site-nav__item--active" : ""}`}
          type="button"
          onClick={onOpenStudio}
        >
          <span>Студия</span>
        </button>
      )}

      <Link className={`site-nav__item${activeItem === "pricing" ? " site-nav__item--active" : ""}`} to="/pricing">
        Тарифы
      </Link>
    </nav>
  );
}
