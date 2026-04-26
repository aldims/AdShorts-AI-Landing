import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "../lib/i18n";

type Props = {
  email: string;
  name: string;
  onLogout: () => void | Promise<void>;
  plan: string;
};

export function AccountMenuButton({ email, name, onLogout, plan }: Props) {
  const { locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const accountInitials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || email.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await onLogout();
  };

  return (
    <div className="site-header__account-wrap" ref={menuRef}>
      <button
        className={`site-header__account route-button${isOpen ? " is-active" : ""}`}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={`${locale === "en" ? "Account" : "Аккаунт"} ${name}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={menuId}
        title={`${name} · ${plan}`}
      >
        <span>{accountInitials}</span>
      </button>

      {isOpen ? (
        <div className="account-menu" id={menuId} role="dialog" aria-label={locale === "en" ? "Account" : "Аккаунт"}>
          <div className="account-menu__panel">
            <div className="account-menu__badge">{plan.toUpperCase()}</div>
            <div className="account-menu__identity">
              <strong>{name}</strong>
              <span>{email}</span>
            </div>
            <button className="account-menu__action route-button" type="button" onClick={handleLogout}>
              {locale === "en" ? "Log out" : "Выход"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
