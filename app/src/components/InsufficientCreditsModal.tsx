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
  const progressPercent =
    context.requiredCredits > 0
      ? numericBalance === null
        ? 12
        : Math.max(8, Math.min(100, Math.round((numericBalance / context.requiredCredits) * 100)))
      : 100;

  return (
    <div className="studio-credits-modal" role="dialog" aria-modal="true" aria-labelledby="studio-credits-modal-title">
      <button
        className="studio-credits-modal__backdrop route-close"
        type="button"
        aria-label="Закрыть окно пополнения кредитов"
        onClick={onClose}
      />

      <div className="studio-credits-modal__panel" role="document">
        <div className="studio-credits-modal__panel-glow" aria-hidden="true"></div>

        <div className="studio-credits-modal__header">
          <div className="studio-credits-modal__topline">
            <span className="studio-credits-modal__chip studio-credits-modal__chip--alert">Недостаточно кредитов</span>
            <span className="studio-credits-modal__chip">Пополнение в 1 шаг</span>
          </div>

          <button
            className="studio-credits-modal__close route-close"
            type="button"
            aria-label="Закрыть окно пополнения кредитов"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="studio-credits-modal__hero">
          <div className="studio-credits-modal__hero-copy">
            <span className="studio-credits-modal__eyebrow">Пополнение</span>
            <strong id="studio-credits-modal-title">{copy.title}</strong>
            <p>{copy.text}</p>

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
          </div>

          <aside className="studio-credits-modal__aside">
            <div className="studio-credits-modal__balance-card">
              <div className="studio-credits-modal__balance-head">
                <span>Текущий баланс</span>
                <strong>{balanceLabel}</strong>
              </div>
              <div className="studio-credits-modal__balance-bar" aria-hidden="true">
                <span style={{ width: `${progressPercent}%` }}></span>
              </div>
              <p className="studio-credits-modal__balance-caption">
                Для этого действия нужно {requiredLabel}. После пополнения можно сразу продолжить.
              </p>
            </div>

            <div className="studio-credits-modal__summary">
              <div className="studio-credits-modal__metric is-deficit">
                <span>Не хватает</span>
                <strong>{missingLabel}</strong>
              </div>
              <div className="studio-credits-modal__metric is-accent">
                <span>Нужно сейчас</span>
                <strong>{requiredLabel}</strong>
              </div>
            </div>
          </aside>
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
