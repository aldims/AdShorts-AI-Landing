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
        <div className="icm__orb" aria-hidden="true" />

        <button className="icm__close" type="button" aria-label="Закрыть" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="icm__toprow">
          <p className="icm__eyebrow">Кредиты закончились</p>
          <div className="icm__badge">
            <span className="icm__badge-dot" aria-hidden="true" />
            Тариф {planLabel}
          </div>
        </div>

        <div className="icm__body">
          <h2 className="icm__title" id="icm-title">Пополните баланс</h2>
          <p className="icm__desc">Продолжайте выпускать Shorts без ограничений.</p>
        </div>

        <div className="icm__actions">
          <button className="icm__btn-primary" type="button" onClick={onAction}>
            Выбрать тариф
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
          <button className="icm__btn-ghost" type="button" onClick={onClose}>Позже</button>
        </div>
      </div>
    </div>
  );
}
