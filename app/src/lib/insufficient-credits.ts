import type { StudioCreditAction } from "../../shared/studio-credit-costs";
import type { Locale } from "../../shared/locales";
import type { PricingEntryIntentSection } from "./pricing-entry-intent";

export type InsufficientCreditsContext = {
  action: StudioCreditAction;
  balance: number | null;
  plan: string | null;
  requiredCredits: number;
};

const isAddonEligiblePlan = (plan: string | null) => plan === "PRO" || plan === "ULTRA";

const formatCreditsLabel = (value: number | null) => {
  if (value === null) {
    return "—";
  }

  return String(Math.max(0, value));
};

const formatCreditsWord = (value: number, locale: Locale = "ru") => {
  if (locale === "en") {
    return Math.abs(value) === 1 ? "credit" : "credits";
  }

  const normalizedValue = Math.abs(value) % 100;
  const lastDigit = normalizedValue % 10;

  if (normalizedValue >= 11 && normalizedValue <= 19) {
    return "кредитов";
  }

  if (lastDigit === 1) {
    return "кредит";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "кредита";
  }

  return "кредитов";
};

export const formatCreditsCountLabel = (value: number, locale: Locale = "ru") => `${value} ${formatCreditsWord(value, locale)}`;

export const canPurchaseAddonCredits = (plan: string | null) => isAddonEligiblePlan(plan);

export const getInsufficientCreditsPricingSection = (plan: string | null): PricingEntryIntentSection =>
  isAddonEligiblePlan(plan) ? "addons" : "plans";

export const getInsufficientCreditsContextActionLabel = (action: StudioCreditAction) => {
  switch (action) {
    case "ai_photo":
      return "Генерация ИИ фото";
    case "ai_video":
      return "Генерация ИИ видео";
    case "photo_animation":
      return "ИИ анимация фото";
    case "image_edit":
      return "Дорисовать";
    case "image_upscale":
      return "Улучшение качества изображения";
    case "video_generation":
    default:
      return "Создание Shorts";
  }
};

export const getInsufficientCreditsBannerCopy = (context: InsufficientCreditsContext) => {
  const formattedBalance = formatCreditsLabel(context.balance);

  if (isAddonEligiblePlan(context.plan)) {
    return {
      ctaLabel: "Купить кредиты",
      note: "Пакеты пополняют баланс и не меняют ваш тариф.",
      text: `На балансе ${formattedBalance} кредитов, а для этого действия нужно ${context.requiredCredits}. Пополните пакет и продолжайте без паузы.`,
      title: "Не хватает кредитов, чтобы продолжить",
    };
  }

  return {
    ctaLabel: "Выбрать тариф",
    note: "После перехода на PRO или ULTRA откроется покупка дополнительных пакетов.",
    text: `На балансе ${formattedBalance} кредитов, а для этого действия нужно ${context.requiredCredits}. Выберите тариф с кредитами и сразу продолжайте генерацию.`,
    title: "Не хватает кредитов, чтобы продолжить",
  };
};
