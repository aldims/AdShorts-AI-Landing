import {
  formatCreditsCountLabel,
  getInsufficientCreditsBannerCopy,
  getInsufficientCreditsContextActionLabel,
  type InsufficientCreditsContext,
} from "../lib/insufficient-credits";

type Props = {
  context: InsufficientCreditsContext;
  onAction: () => void;
  onClose: () => void;
};

export function InsufficientCreditsModal({ context, onAction, onClose }: Props) {
  const copy = getInsufficientCreditsBannerCopy(context);
  const planLabel = context.plan ?? "FREE";
  const numericBalance = context.balance === null ? null : Math.max(0, context.balance);
  const balanceLabel = numericBalance === null ? "—" : formatCreditsCountLabel(numericBalance);
  const requiredLabel = formatCreditsCountLabel(context.requiredCredits);
  const actionLabel = getInsufficientCreditsContextActionLabel(context.action);
  const missingCredits = Math.max(0, context.requiredCredits - (numericBalance ?? 0));
  const missingLabel = formatCreditsCountLabel(missingCredits);

  return (
    <div className="studio-credits-modal" role="dialog" aria-modal="true" aria-labelledby="studio-credits-modal-title">
      <button
        className="studio-credits-modal__backdrop route-close"
        type="button"
        aria-label="Закрыть окно пополнения кредитов"
        onClick={onClose}
      />

      <div className="studio-credits-modal__panel" role="document">
        <div className="studio-credits-modal__halo studio-credits-modal__halo--lime" aria-hidden="true"></div>
        <div className="studio-credits-modal__halo studio-credits-modal__halo--sun" aria-hidden="true"></div>

        <button
          className="studio-credits-modal__close route-close"
          type="button"
          aria-label="Закрыть окно пополнения кредитов"
          onClick={onClose}
        >
          ×
        </button>

        <div className="studio-credits-modal__topline">
          <span className="studio-credits-modal__chip studio-credits-modal__chip--alert">Кредиты закончились</span>
          <span className="studio-credits-modal__chip">Продолжите без паузы</span>
        </div>

        <div className="studio-credits-modal__hero">
          <div className="studio-credits-modal__hero-copy">
            <span className="studio-credits-modal__eyebrow">Пополнение</span>
            <strong id="studio-credits-modal-title">{copy.title}</strong>
            <p>{copy.text}</p>
          </div>

          <div className="studio-credits-modal__accent" aria-hidden="true">
            <div className="studio-credits-modal__accent-core">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12.6 2.75 6.65 12h4.05l-.95 9.25L17.35 12H13.3l1.3-9.25Z"
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="studio-credits-modal__summary">
          <div className="studio-credits-modal__metric">
            <span>На балансе</span>
            <strong>{balanceLabel}</strong>
          </div>
          <div className="studio-credits-modal__metric is-deficit">
            <span>Не хватает</span>
            <strong>{missingLabel}</strong>
          </div>
          <div className="studio-credits-modal__metric is-accent">
            <span>Нужно сейчас</span>
            <strong>{requiredLabel}</strong>
          </div>
        </div>

        <div className="studio-credits-modal__details">
          <div className="studio-credits-modal__detail">
            <span>Действие</span>
            <strong>{actionLabel}</strong>
          </div>
          <div className="studio-credits-modal__detail">
            <span>Текущий тариф</span>
            <strong>{planLabel}</strong>
          </div>
        </div>

        <p className="studio-credits-modal__note">{copy.note}</p>

        <div className="studio-credits-modal__actions">
          <button className="studio-credits-modal__action studio-credits-modal__action--secondary" type="button" onClick={onClose}>
            Позже
          </button>
          <button className="studio-credits-modal__action studio-credits-modal__action--primary" type="button" onClick={onAction}>
            {copy.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
