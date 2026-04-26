import { Link } from "react-router-dom";
import { defineMessages, useLocale } from "../lib/i18n";

type WorkspaceProfile = {
  balance: number;
  expiresAt: string | null;
  plan: string;
  startPlanUsed: boolean;
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

const getDaysLeft = (value: Date) => {
  const diffMs = value.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

const workspaceStatusMessages = defineMessages({
  balance: {
    ru: "Баланс",
    en: "Balance",
  },
  freePlanTooltip: {
    ru: "Бесплатный тариф без даты окончания.",
    en: "Free plan with no expiration date.",
  },
  openPlan: {
    ru: "Открыть тариф",
    en: "Open plan",
  },
  plan: {
    ru: "Тариф",
    en: "Plan",
  },
  refillBalance: {
    ru: "Пополнить баланс",
    en: "Top up balance",
  },
  tariffActive: {
    ru: "Тариф активен.",
    en: "Plan is active.",
  },
});

export function SiteHeaderWorkspaceStatus({ profile = null }: Props) {
  const { locale, localizePath, t } = useLocale();
  const normalizedPlan = normalizePlan(profile?.plan);
  const expiryDate = normalizeExpiry(profile?.expiresAt);
  const daysLeft = expiryDate ? getDaysLeft(expiryDate) : null;
  const hasPaidPlan = normalizedPlan !== "FREE" && normalizedPlan !== "…";
  const isExpiringSoon = Boolean(hasPaidPlan && daysLeft !== null && daysLeft <= 3);

  let tooltipText = t(workspaceStatusMessages.freePlanTooltip);
  if (hasPaidPlan && expiryDate) {
    const formattedExpiryDate = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(expiryDate);
    tooltipText =
      daysLeft !== null
        ? locale === "en"
          ? `Active until ${formattedExpiryDate}. ${daysLeft} days left.`
          : `Активен до ${formattedExpiryDate}. Осталось ${daysLeft} дн.`
        : locale === "en"
          ? `Active until ${formattedExpiryDate}.`
          : `Активен до ${formattedExpiryDate}.`;
  } else if (hasPaidPlan) {
    tooltipText = t(workspaceStatusMessages.tariffActive);
  }

  return (
    <>
      <Link
        className={`site-header__plan${isExpiringSoon ? " is-expiring-soon" : ""}`}
        to={localizePath("/pricing")}
        aria-label={t(workspaceStatusMessages.openPlan)}
      >
        <span>{t(workspaceStatusMessages.plan)}</span>
        <strong>{normalizedPlan}</strong>
        <span className="site-header__plan-tooltip" aria-hidden="true">
          {tooltipText}
        </span>
      </Link>
      <Link className="site-header__credits" to={localizePath("/pricing")} aria-label={t(workspaceStatusMessages.refillBalance)}>
        <span className="site-header__credits-label">{t(workspaceStatusMessages.balance)}</span>
        <span className="site-header__credits-value">
          <strong>{normalizeBalance(profile?.balance)}</strong>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M13 3v6h6l-8 12v-6H5l8-12z" />
          </svg>
        </span>
      </Link>
    </>
  );
}
