import { Link } from "react-router-dom";
import { defineMessages, useLocale, type Locale } from "../lib/i18n";

type WorkspaceProfile = {
  balance: number;
  expiresAt: string | null;
  plan: string;
  startPlanUsed: boolean;
} | null;

type Props = {
  isProfileVerified?: boolean;
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

const getDaysLeft = (value: Date) => {
  const diffMs = value.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

const formatExpiryDate = (value: Date, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: locale === "en" ? "short" : "2-digit",
    year: "numeric",
  }).format(value);

const workspaceStatusMessages = defineMessages({
  balance: {
    ru: "Баланс",
    en: "Balance",
  },
  freePlanTooltip: {
    ru: "Бесплатный тариф без даты окончания.",
    en: "Free plan with no expiration date.",
  },
  openPlanAndBalance: {
    ru: "Открыть тариф и баланс",
    en: "Open plan and balance",
  },
  plan: {
    ru: "Тариф",
    en: "Plan",
  },
  tariffActive: {
    ru: "Тариф активен.",
    en: "Plan is active.",
  },
  tariffActiveUntil: {
    ru: "Тариф активен до {date}.",
    en: "Plan is active until {date}.",
  },
});

export function SiteHeaderWorkspaceStatus({ isProfileVerified = true, profile = null }: Props) {
  const { locale, localizePath, t } = useLocale();
  const displayProfile = isProfileVerified ? profile : null;
  const normalizedPlan = normalizePlan(displayProfile?.plan);
  const expiryDate = normalizeExpiry(displayProfile?.expiresAt);
  const daysLeft = expiryDate ? getDaysLeft(expiryDate) : null;
  const hasPaidPlan = normalizedPlan !== "FREE" && normalizedPlan !== "…";
  const hasExpiringPlan = normalizedPlan === "PRO" || normalizedPlan === "ULTRA";
  const isExpiringSoon = Boolean(hasPaidPlan && daysLeft !== null && daysLeft <= 3);

  let tooltipText = t(workspaceStatusMessages.freePlanTooltip);
  if (hasExpiringPlan && expiryDate) {
    tooltipText = t(workspaceStatusMessages.tariffActiveUntil).replace("{date}", formatExpiryDate(expiryDate, locale));
  } else if (hasPaidPlan) {
    tooltipText = t(workspaceStatusMessages.tariffActive);
  }

  return (
    <Link
      className={`site-header__billing${isExpiringSoon ? " is-expiring-soon" : ""}`}
      to={localizePath("/pricing/")}
      aria-label={t(workspaceStatusMessages.openPlanAndBalance)}
    >
      <span className="site-header__billing-plan">
        <span>{t(workspaceStatusMessages.plan)}</span>
        <strong>{normalizedPlan}</strong>
        <span className="site-header__plan-tooltip" aria-hidden="true">
          {tooltipText}
        </span>
      </span>
      <span className="site-header__billing-divider" aria-hidden="true" />
      <span className="site-header__billing-credits">
        <span className="site-header__credits-label">{t(workspaceStatusMessages.balance)}</span>
        <span className="site-header__credits-value">
          <strong>{normalizeBalance(displayProfile?.balance)}</strong>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M13 3v6h6l-8 12v-6H5l8-12z" />
          </svg>
        </span>
      </span>
    </Link>
  );
}
