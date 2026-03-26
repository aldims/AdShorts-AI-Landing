import { Link } from "react-router-dom";

type NavItem = "examples" | "home" | "pricing" | "studio";

type Props = {
  activeItem?: NavItem | null;
  onOpenStudio: () => void;
};

export function PrimarySiteNav({ activeItem = null, onOpenStudio }: Props) {
  return (
    <nav className="site-nav" aria-label="Главная навигация">
      <Link className={`site-nav__item${activeItem === "home" ? " site-nav__item--active" : ""}`} to="/">
        Главная
      </Link>
      <Link className={`site-nav__item${activeItem === "examples" ? " site-nav__item--active" : ""}`} to="/examples">
        Примеры
      </Link>
      <button
        className={`site-nav__item route-button${activeItem === "studio" ? " site-nav__item--active" : ""}`}
        type="button"
        onClick={onOpenStudio}
      >
        <span>Студия</span>
      </button>
      <Link className={`site-nav__item${activeItem === "pricing" ? " site-nav__item--active" : ""}`} to="/pricing">
        Тарифы
      </Link>
    </nav>
  );
}
