import { Link } from "react-router-dom";

type WorkspaceProfile = {
  balance: number;
  expiresAt: string | null;
  plan: string;
} | null;

type Props = {
  profile?: WorkspaceProfile;
};

const normalizePlan = (value: unknown) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || "…";
};

const normalizeBalance = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(Math.max(0, parsed)) : "…";
};

const normalizeExpiry = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const formatExpiryDate = (value: Date) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);

const getDaysLeft = (value: Date) => {
  const diffMs = value.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

export function SiteHeaderWorkspaceStatus({ profile = null }: Props) {
  const normalizedPlan = normalizePlan(profile?.plan);
  const expiryDate = normalizeExpiry(profile?.expiresAt);
  const daysLeft = expiryDate ? getDaysLeft(expiryDate) : null;
  const hasPaidPlan = normalizedPlan !== "FREE" && normalizedPlan !== "…";
  const isExpiringSoon = Boolean(hasPaidPlan && daysLeft !== null && daysLeft <= 3);

  let tooltipText = "Бесплатный тариф без даты окончания.";
  if (hasPaidPlan && expiryDate) {
    tooltipText =
      daysLeft !== null
        ? `Активен до ${formatExpiryDate(expiryDate)}. Осталось ${daysLeft} дн.`
        : `Активен до ${formatExpiryDate(expiryDate)}.`;
  } else if (hasPaidPlan) {
    tooltipText = "Тариф активен. Дата окончания уточняется.";
  }

  return (
    <>
      <Link
        className={`site-header__plan${isExpiringSoon ? " is-expiring-soon" : ""}`}
        to="/pricing"
        aria-label="Открыть тариф"
        title={tooltipText}
      >
        <span>Тариф</span>
        <strong>{normalizedPlan}</strong>
        <span className="site-header__plan-tooltip" aria-hidden="true">
          {tooltipText}
        </span>
      </Link>
      <Link className="site-header__credits" to="/pricing" aria-label="Пополнить баланс">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13 3v6h6l-8 12v-6H5l8-12z" />
        </svg>
        <span>{normalizeBalance(profile?.balance)}</span>
      </Link>
    </>
  );
}
