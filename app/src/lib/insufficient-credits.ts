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

export const getInsufficientCreditsContextActionLabel = (action: StudioCreditAction, locale: Locale = "ru") => {
  if (locale === "en") {
    switch (action) {
      case "ai_photo":
        return "AI photo generation";
      case "ai_video":
        return "AI video generation";
      case "photo_animation":
        return "AI photo animation";
      case "talking_photo":
        return "Talking photo";
      case "image_edit":
        return "Image edit";
      case "image_upscale":
        return "Image upscale";
      case "scene_sound":
        return "Scene sound";
      case "video_generation":
      default:
        return "Shorts generation";
    }
  }

  switch (action) {
    case "ai_photo":
      return "Генерация ИИ фото";
    case "ai_video":
      return "Генерация ИИ видео";
    case "photo_animation":
      return "ИИ анимация фото";
    case "talking_photo":
      return "Говорящее фото";
    case "image_edit":
      return "Дорисовать";
    case "image_upscale":
      return "Улучшение качества изображения";
    case "scene_sound":
      return "Звук сцены";
    case "video_generation":
    default:
      return "Создание Shorts";
  }
};

export const getInsufficientCreditsBannerCopy = (context: InsufficientCreditsContext, locale: Locale = "ru") => {
  const formattedBalance = formatCreditsLabel(context.balance);
  const formattedBalanceCredits =
    context.balance === null ? `— ${locale === "en" ? "credits" : "кредитов"}` : formatCreditsCountLabel(context.balance, locale);
  const formattedRequiredCredits = formatCreditsCountLabel(context.requiredCredits, locale);

  if (isAddonEligiblePlan(context.plan)) {
    return locale === "en"
      ? {
          ctaLabel: "Buy credits",
          eyebrow: "Out of credits",
          note: "Packs top up your balance without changing your plan.",
          text: `Your balance is ${formattedBalance} credits. You need ${formattedRequiredCredits} to continue.`,
          title: `Need ${formattedRequiredCredits}`,
        }
      : {
          ctaLabel: "Купить кредиты",
          eyebrow: "НЕДОСТАТОЧНО КРЕДИТОВ",
          note: "",
          text: `На балансе ${formattedBalanceCredits}. Пополните баланс, чтобы продолжить генерацию.`,
          title: `Нужно ${formattedRequiredCredits}`,
        };
  }

  return locale === "en"
    ? {
        ctaLabel: "Choose plan",
        eyebrow: "Out of credits",
        note: "",
        text: `Your balance is ${formattedBalance} credits. You need ${formattedRequiredCredits} to continue generation.`,
        title: `Need ${formattedRequiredCredits}`,
      }
    : {
        ctaLabel: "Выбрать тариф",
        eyebrow: "НЕДОСТАТОЧНО КРЕДИТОВ",
        note: "",
        text: `На балансе ${formattedBalanceCredits}. Пополните баланс, чтобы продолжить генерацию.`,
        title: `Нужно ${formattedRequiredCredits}`,
      };
};
