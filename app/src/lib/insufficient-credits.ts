import type { StudioCreditAction } from "../../shared/studio-credit-costs";
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

const formatCreditsWord = (value: number) => {
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

export const formatCreditsCountLabel = (value: number) => `${value} ${formatCreditsWord(value)}`;

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
      return "Дорисовать фото";
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

export const getInsufficientCreditsPricingNotice = (section: PricingEntryIntentSection) =>
  section === "addons"
    ? "Кредитов не хватило для этого действия. Пополните баланс и возвращайтесь к генерации."
    : "Кредитов не хватило для этого действия. Выберите тариф и продолжайте без паузы.";
