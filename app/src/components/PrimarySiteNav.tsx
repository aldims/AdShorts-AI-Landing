import { Link } from "react-router-dom";

type NavItem = "examples" | "guides" | "home" | "studio";

type Props = {
  activeItem?: NavItem | null;
  onOpenStudio: () => void;
};

export function PrimarySiteNav({ activeItem = null, onOpenStudio }: Props) {
  return (
    <nav className="site-nav" aria-label="Главная навигация">
      <Link className={`site-nav__item${activeItem === "home" ? " site-nav__item--active" : ""}`} to="/">
        Home
      </Link>
      <a className={`site-nav__item${activeItem === "examples" ? " site-nav__item--active" : ""}`} href="/#examples">
        Examples
      </a>
      <button
        className={`site-nav__item route-button${activeItem === "studio" ? " site-nav__item--active" : ""}`}
        type="button"
        onClick={onOpenStudio}
      >
        <span>Studio</span>
        <span className="site-nav__badge">Web</span>
      </button>
      <a className={`site-nav__item${activeItem === "guides" ? " site-nav__item--active" : ""}`} href="/#guides">
        Guides
      </a>
    </nav>
  );
}
