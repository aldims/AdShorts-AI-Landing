import { type InsufficientCreditsContext } from "../lib/insufficient-credits";

type Props = {
  context: InsufficientCreditsContext;
  onAction: () => void;
  onClose: () => void;
};

export function InsufficientCreditsModal({ context, onAction, onClose }: Props) {
  const planLabel = (context.plan ?? "FREE").toUpperCase();

  return (
    <div className="icm" role="dialog" aria-modal="true" aria-labelledby="icm-title">
      <button className="icm__backdrop" type="button" aria-label="Закрыть" onClick={onClose} />

      <div className="icm__panel">
        <div className="icm__light icm__light--purple" aria-hidden="true" />
        <div className="icm__light icm__light--red"    aria-hidden="true" />
        <div className="icm__noise"                    aria-hidden="true" />

        {/* top bar */}
        <div className="icm__topbar">
          <div className="icm__status">
            <span className="icm__status-dot" aria-hidden="true" />
            Тариф {planLabel}
          </div>
          <button className="icm__close" type="button" aria-label="Закрыть" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* hero */}
        <div className="icm__hero">
          <h2 className="icm__title" id="icm-title">
            Кредиты<br />
            <span className="icm__title-accent">закончились</span>
          </h2>
          <p className="icm__desc">
            Пополните баланс и продолжайте выпускать Shorts без ограничений.
          </p>
        </div>

        {/* actions */}
        <div className="icm__cta">
          <button className="icm__btn-primary" type="button" onClick={onAction}>
            <span className="icm__btn-glow" aria-hidden="true" />
            <span className="icm__btn-label">Тарифы</span>
            <svg className="icm__btn-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
          <button className="icm__btn-ghost" type="button" onClick={onClose}>
            Позже
          </button>
        </div>
      </div>
    </div>
  );
}
