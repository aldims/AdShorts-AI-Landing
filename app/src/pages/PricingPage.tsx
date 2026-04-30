import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AccountMenuButton } from "../components/AccountMenuButton";
import { AgencyContactModal } from "../components/AgencyContactModal";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { PrimarySiteNav } from "../components/PrimarySiteNav";
import { SiteHeaderWorkspaceStatus } from "../components/SiteHeaderWorkspaceStatus";
import { defineMessages, useLocale, type Locale } from "../lib/i18n";
import { clearPricingEntryIntent, readPricingEntryIntent } from "../lib/pricing-entry-intent";
import { writeStudioEntryIntent, type StudioEntryIntentSection } from "../lib/studio-entry-intent";
import { openYooKassaPaymentWidget } from "../lib/yookassa-widget";
import {
  PENDING_CHECKOUT_STORAGE_KEY,
  buildPaymentReturnUrl,
  clearPreCheckoutProfile,
  getCheckoutProductLabel,
  isPackageCheckoutProductId,
  readPaymentReturnProductId,
  readPreCheckoutProfile,
  writePreCheckoutProfile,
} from "../lib/payment-return";

type Session = {
  name: string;
  email: string;
  plan: string;
} | null;

type WorkspaceProfile = {
  balance: number;
  expiresAt: string | null;
  plan: string;
  startPlanUsed: boolean;
} | null;

type Props = {
  session: Session;
  workspaceProfile?: WorkspaceProfile;
  onOpenSignup: () => void;
  onOpenSignin: () => void;
  onLogout: () => void | Promise<void>;
  onOpenWorkspace: () => void;
  onWorkspaceProfileChange?: (profile: WorkspaceProfile | null) => void;
};

type PricingPlan = {
  checkoutProductId: PlanCheckoutProductId;
  name: string;
  audience: string;
  audienceLines?: string[];
  price: string;
  billing: string;
  credits: string;
  subnote?: string;
  features: string[];
  badge?: string;
  featured?: boolean;
  ctaLabel: string;
};

type CheckoutProductId = "start" | "pro" | "ultra" | "package_10" | "package_50" | "package_100";
type PlanCheckoutProductId = "start" | "pro" | "ultra";
type PackageCheckoutProductId = "package_10" | "package_50" | "package_100";

type CheckoutResponse = {
  data?: {
    simulatedPayment?: {
      addedCredits: number;
      paymentId: string;
      productId: CheckoutProductId;
      profile: NonNullable<WorkspaceProfile>;
    };
    url?: string;
    widget?: {
      confirmationToken: string;
      paymentId: string;
      returnUrl: string;
      url?: string;
    };
  };
  error?: string;
  warning?: string;
};

type WorkspaceBootstrapResponse = {
  data?: {
    profile?: WorkspaceProfile;
  };
  error?: string;
};

type CheckoutResultState = {
  addedCredits: number | null;
  balance: number | null;
  plan: string | null;
  productId: CheckoutProductId;
  status: "checking" | "pending" | "success";
};

type PlanCheckoutRestriction = "current" | "unavailable" | "used";

type PricingPack = {
  checkoutProductId: PackageCheckoutProductId;
  name: string;
  credits: string;
  price: string;
  subnote: string;
  badge?: string;
};

type PricingFAQ = {
  question: string;
  answer: string;
};

const PACKAGE_RESTRICTION_ERROR_FRAGMENT = "PRO and ULTRA";
const CHECKOUT_REQUEST_TIMEOUT_MS = 20_000;
const PAYMENT_PROFILE_POLL_ATTEMPTS = 6;
const PAYMENT_PROFILE_POLL_INTERVAL_MS = 2_000;

const DEFAULT_FEATURED_PLAN_ID: PlanCheckoutProductId = "pro";

const pricingMessages = defineMessages({
  addonBuy: {
    ru: "Купить пакет",
    en: "Buy pack",
  },
  addonHeading: {
    ru: "Пополняйте кредиты не меняя тарифный план",
    en: "Top up credits without changing your plan",
  },
  addonUpgradeCta: {
    ru: "Выбрать PRO",
    en: "Choose PRO",
  },
  addonUpgradeDescription: {
    ru: "Доступны на тарифах PRO и ULTRA. Перейдите на платный тариф, чтобы докупать кредиты без смены тарифа.",
    en: "Available on PRO and ULTRA plans. Upgrade to a paid plan to buy extra credits without changing plans.",
  },
  addonUpgradeTitle: {
    ru: "Дополнительные пакеты",
    en: "Add-on packs",
  },
  checkoutOpening: {
    ru: "Открываем оплату...",
    en: "Opening checkout...",
  },
  checkoutTimeout: {
    ru: "Страница оплаты отвечает слишком долго. Попробуйте ещё раз через несколько секунд.",
    en: "Checkout is taking too long. Try again in a few seconds.",
  },
  checkoutUnavailable: {
    ru: "Не удалось открыть страницу оплаты.",
    en: "Could not open checkout.",
  },
  enterpriseCta: {
    ru: "Оставить заявку",
    en: "Request a plan",
  },
  enterpriseHeading: {
    ru: "Нужен объём выше Ultra?",
    en: "Need more than Ultra?",
  },
  enterpriseIntro: {
    ru: "Оставьте заявку — подберём индивидуальный лимит генераций.",
    en: "Send a request and we will suggest an individual generation limit.",
  },
  enterpriseItemMoreShorts: {
    ru: "Больше Shorts в месяц",
    en: "More Shorts per month",
  },
  enterpriseItemPriorityGeneration: {
    ru: "Приоритетная генерация",
    en: "Priority generation",
  },
  enterpriseItemVolumeCredits: {
    ru: "Индивидуальный объём кредитов",
    en: "Individual credit volume",
  },
  faqHeading: {
    ru: "Как работают тарифы",
    en: "How plans work",
  },
  heroHeading: {
    ru: "Выберите свой тариф",
    en: "Choose your plan",
  },
  signIn: {
    ru: "Войти",
    en: "Sign in",
  },
  startUsed: {
    ru: "Тариф START уже использован для этого аккаунта.",
    en: "The START plan has already been used for this account.",
  },
  currentPlan: {
    ru: "Текущий тариф",
    en: "Current plan",
  },
  planUnavailable: {
    ru: "Этот тариф недоступен для текущего аккаунта.",
    en: "This plan is not available for the current account.",
  },
  unavailable: {
    ru: "Недоступно",
    en: "Unavailable",
  },
  used: {
    ru: "Использован",
    en: "Used",
  },
});

type LocalizedPlanCopy = Omit<PricingPlan, "audience" | "audienceLines" | "badge" | "billing" | "ctaLabel" | "credits" | "features" | "subnote"> & {
  audience: Record<Locale, string>;
  audienceLines?: Record<Locale, string[]>;
  badge?: Record<Locale, string>;
  billing: Record<Locale, string>;
  ctaLabel: Record<Locale, string>;
  credits: Record<Locale, string>;
  features: Record<Locale, string[]>;
  subnote?: Record<Locale, string>;
};

const pricingPlanCopy: LocalizedPlanCopy[] = [
  {
    checkoutProductId: "start",
    name: "START",
    audience: { ru: "Разовый пакет для первого запуска", en: "Ideal for the first launch" },
    audienceLines: { ru: ["Разовый пакет для", "первого запуска"], en: ["Ideal for the first", "launch"] },
    price: "390 ₽",
    billing: { ru: "/ 50 кредитов", en: "/ 50 credits" },
    credits: { ru: "До 5 Shorts", en: "Up to 5 Shorts" },
    subnote: { ru: "≈ 78 ₽ за Shorts", en: "≈ 78 ₽ per Short" },
    features: {
      ru: ["Без водяного знака"],
      en: ["Full Shorts creation access", "No watermark", "Studio editing", "YouTube auto-publishing"],
    },
    ctaLabel: { ru: "Оплатить START", en: "Pay for START" },
  },
  {
    checkoutProductId: "pro",
    name: "PRO",
    audience: { ru: "Для регулярного создания Shorts", en: "Ideal for a regular content flow" },
    audienceLines: { ru: ["Для регулярного", "создания Shorts"], en: ["Ideal for a regular", "content flow"] },
    price: "1 490 ₽",
    billing: { ru: "/ 250 кредитов", en: "/ 250 credits" },
    credits: { ru: "До 25 Shorts", en: "Up to 25 Shorts" },
    subnote: { ru: "≈ 60 ₽ за Shorts", en: "≈ 60 ₽ per Short" },
    features: {
      ru: ["Без водяного знака", "Приоритетная генерация", "Можно докупать пакеты"],
      en: ["Everything in START", "Priority generation", "Credit top-ups available", "Built for regular content"],
    },
    badge: { ru: "Самый популярный", en: "Most popular" },
    featured: true,
    ctaLabel: { ru: "Оплатить PRO", en: "Pay for PRO" },
  },
  {
    checkoutProductId: "ultra",
    name: "ULTRA",
    audience: { ru: "Для максимального объёма", en: "Ideal for maximum volume" },
    audienceLines: { ru: ["Для максимального", "объёма"], en: ["Ideal for maximum", "volume"] },
    price: "4 990 ₽",
    billing: { ru: "/ 1000 кредитов", en: "/ 1000 credits" },
    credits: { ru: "До 100 Shorts", en: "Up to 100 Shorts" },
    subnote: { ru: "≈ 50 ₽ за Shorts", en: "≈ 50 ₽ per Short" },
    features: {
      ru: ["Без водяного знака", "Максимальный приоритет", "Можно докупать пакеты", "Ранний доступ к новым функциям"],
      en: ["Everything in PRO", "Maximum priority", "Early access to new features", "Best limits for active use"],
    },
    badge: { ru: "Лучшая выгода", en: "Best value" },
    ctaLabel: { ru: "Оплатить ULTRA", en: "Pay for ULTRA" },
  },
];

type LocalizedPackCopy = Omit<PricingPack, "badge" | "credits" | "subnote"> & {
  badge?: Record<Locale, string>;
  credits: Record<Locale, string>;
  subnote: Record<Locale, string>;
};

const pricingPackCopy: LocalizedPackCopy[] = [
  {
    checkoutProductId: "package_10",
    name: "Pack 100",
    credits: { ru: "100 кредитов", en: "100 credits" },
    price: "690 ₽",
    subnote: { ru: "До 10 Shorts", en: "Up to 10 Shorts" },
  },
  {
    checkoutProductId: "package_50",
    name: "Pack 500",
    credits: { ru: "500 кредитов", en: "500 credits" },
    price: "2 750 ₽",
    subnote: { ru: "До 50 Shorts", en: "Up to 50 Shorts" },
  },
  {
    checkoutProductId: "package_100",
    name: "Pack 1000",
    credits: { ru: "1000 кредитов", en: "1000 credits" },
    price: "4 990 ₽",
    subnote: { ru: "До 100 Shorts", en: "Up to 100 Shorts" },
    badge: { ru: "Выгодно", en: "Good value" },
  },
];

const pricingFaqCopy: Array<{ question: Record<Locale, string>; answer: Record<Locale, string> }> = [
  {
    question: { ru: "Как списываются кредиты", en: "How credits are charged" },
    answer: {
      ru: "Стандартный Shorts — 10 кредитов, Премиум Shorts — 20 кредитов. В редакторе стоимость каждого AI-улучшения указана на кнопке.",
      en: "Standard Shorts cost 10 credits, Premium Shorts cost 20 credits. In the editor, each AI improvement shows its cost on the button.",
    },
  },
  {
    question: { ru: "Срок действия тарифа", en: "Feature access period" },
    answer: {
      ru: "START — разовый пакет без срока действия. PRO и ULTRA активны 30 дней. Неиспользованные кредиты сохраняются и не сгорают.",
      en: "START is a one-time package with no expiration. PRO and ULTRA are active for 30 days. Unused credits stay on the account and do not expire.",
    },
  },
  {
    question: { ru: "Что включено в оплату", en: "What payment includes" },
    answer: {
      ru: "Все видео идут без водяного знака. Автопродления нет, повторная оплата только вручную.",
      en: "All videos are generated without a watermark. There is no auto-renewal; repeat payments are manual.",
    },
  },
];

const getPricingPlans = (locale: Locale): PricingPlan[] =>
  pricingPlanCopy.map((plan) => ({
    ...plan,
    audience: plan.audience[locale],
    audienceLines: plan.audienceLines?.[locale],
    badge: plan.badge?.[locale],
    billing: plan.billing[locale],
    credits: plan.credits[locale],
    ctaLabel: plan.ctaLabel[locale],
    features: plan.features[locale],
    subnote: plan.subnote?.[locale],
  }));

const getPricingPacks = (locale: Locale): PricingPack[] =>
  pricingPackCopy.map((pack) => ({
    ...pack,
    badge: pack.badge?.[locale],
    credits: pack.credits[locale],
    subnote: pack.subnote[locale],
  }));

const getPricingFaqs = (locale: Locale): PricingFAQ[] =>
  pricingFaqCopy.map((faq) => ({
    answer: faq.answer[locale],
    question: faq.question[locale],
  }));

const delay = (durationMs: number) => new Promise((resolve) => window.setTimeout(resolve, durationMs));

const normalizeWorkspaceProfilePayload = (value: unknown): WorkspaceProfile => {
  if (!value || typeof value !== "object") return null;

  const payload = value as { balance?: unknown; expiresAt?: unknown; plan?: unknown; startPlanUsed?: unknown };
  const balance = Number(payload.balance);
  const plan = String(payload.plan ?? "").trim().toUpperCase();
  if (!Number.isFinite(balance) || !plan) return null;

  return {
    balance: Math.max(0, balance),
    expiresAt: String(payload.expiresAt ?? "").trim() || null,
    plan,
    startPlanUsed: Boolean(payload.startPlanUsed || plan === "START"),
  };
};

const fetchWorkspaceProfile = async () => {
  const response = await fetch("/api/workspace/bootstrap");
  const payload = (await response.json().catch(() => null)) as WorkspaceBootstrapResponse | null;
  if (!response.ok || !payload?.data?.profile) {
    throw new Error(payload?.error ?? "Failed to refresh workspace profile.");
  }

  return normalizeWorkspaceProfilePayload(payload.data.profile);
};

export function PricingPage({
  session,
  workspaceProfile = null,
  onOpenSignup,
  onOpenSignin,
  onLogout,
  onOpenWorkspace,
  onWorkspaceProfileChange,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { locale, localizePath, t } = useLocale();
  const pricingPlans = getPricingPlans(locale);
  const pricingPacks = getPricingPacks(locale);
  const pricingFaqs = getPricingFaqs(locale);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [activeCheckoutProductId, setActiveCheckoutProductId] = useState<CheckoutProductId | null>(null);
  const [activePlanId, setActivePlanId] = useState<PlanCheckoutProductId>(DEFAULT_FEATURED_PLAN_ID);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResultState | null>(null);
  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
  const currentPlanLabel = String(workspaceProfile?.plan ?? session?.plan ?? "").trim().toUpperCase() || null;
  const isStartPlanUsed = Boolean(workspaceProfile?.startPlanUsed || currentPlanLabel === "START");
  const canPurchaseAddonCredits = currentPlanLabel === "PRO" || currentPlanLabel === "ULTRA";
  const getPlanCheckoutRestriction = (productId: PlanCheckoutProductId): PlanCheckoutRestriction | null => {
    if (currentPlanLabel === "ULTRA" && productId === "ultra") {
      return "current";
    }

    if (currentPlanLabel === "ULTRA" && (productId === "start" || productId === "pro")) {
      return "unavailable";
    }

    if (currentPlanLabel === "PRO" && productId === "pro") {
      return "current";
    }

    if (currentPlanLabel === "PRO" && productId === "start") {
      return isStartPlanUsed ? "used" : "unavailable";
    }

    if (productId === "start" && isStartPlanUsed) {
      return "used";
    }

    return null;
  };
  const getPlanRestrictionLabel = (restriction: PlanCheckoutRestriction | null) => {
    if (restriction === "current") return t(pricingMessages.currentPlan);
    if (restriction === "used") return t(pricingMessages.used);
    if (restriction === "unavailable") return t(pricingMessages.unavailable);
    return null;
  };
  const getPlanRestrictionMessage = (restriction: PlanCheckoutRestriction | null) =>
    restriction === "used" ? t(pricingMessages.startUsed) : t(pricingMessages.planUnavailable);
  const defaultActivePlanId =
    currentPlanLabel === "PRO" || currentPlanLabel === "ULTRA" ? "ultra" : DEFAULT_FEATURED_PLAN_ID;
  const addonsEligibilityNote = canPurchaseAddonCredits
    ? locale === "en"
      ? `Your ${currentPlanLabel} plan can buy extra credit packs. Pick a pack to continue to checkout.`
      : `На тарифе ${currentPlanLabel} вам доступны пакеты дополнительных кредитов. Нажмите на нужный пакет, чтобы перейти к оплате.`
      : currentPlanLabel
        ? locale === "en"
          ? `Credit packs are not available on ${currentPlanLabel}. Extra credits can be purchased only on PRO and ULTRA.`
          : `На тарифе ${currentPlanLabel} пакеты недоступны. Дополнительные кредиты можно покупать только на PRO и ULTRA.`
        : locale === "en"
          ? "Extra credits can be purchased only on PRO and ULTRA plans."
          : "Дополнительные кредиты можно покупать только на тарифах PRO и ULTRA.";
  const openPrimaryFlow = () => {
    if (session) {
      onOpenWorkspace();
      return;
    }

    onOpenSignup();
  };

  const openStudioSection = (section: StudioEntryIntentSection) => {
    if (session) {
      writeStudioEntryIntent({ section });
    }

    openPrimaryFlow();
  };

  const requestCheckout = async (productId: CheckoutProductId) => {
    const planRestriction =
      productId === "start" || productId === "pro" || productId === "ultra"
        ? getPlanCheckoutRestriction(productId)
        : null;
    if (planRestriction) {
      setCheckoutError(getPlanRestrictionMessage(planRestriction));
      return;
    }

    setCheckoutError(null);
    setActiveCheckoutProductId(productId);
    writePreCheckoutProfile(productId, {
      balance: workspaceProfile?.balance ?? 0,
      plan: currentPlanLabel ?? "FREE",
    });

    try {
      const response = await fetch(`/api/payments/checkout/${encodeURIComponent(productId)}?mode=widget`, {
        signal: AbortSignal.timeout(CHECKOUT_REQUEST_TIMEOUT_MS),
      });
      const payload = (await response.json().catch(() => null)) as CheckoutResponse | null;

      if (response.status === 401) {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(PENDING_CHECKOUT_STORAGE_KEY, productId);
        }
        onOpenSignin();
        return;
      }

      const errorMessage = payload?.error ?? t(pricingMessages.checkoutUnavailable);
      if (payload?.data?.simulatedPayment) {
        const simulatedPayment = payload.data.simulatedPayment;
        onWorkspaceProfileChange?.(simulatedPayment.profile);
        clearPreCheckoutProfile();
        setCheckoutResult({
          addedCredits: simulatedPayment.addedCredits,
          balance: simulatedPayment.profile.balance,
          plan: simulatedPayment.profile.plan,
          productId: simulatedPayment.productId,
          status: "success",
        });
        navigate(`${localizePath("/pricing")}#payment-result`, { replace: true });
        return;
      }

      if (!response.ok || (!payload?.data?.url && !payload?.data?.widget?.confirmationToken)) {
        if (productId.startsWith("package_") && errorMessage.includes(PACKAGE_RESTRICTION_ERROR_FRAGMENT)) {
          setActivePlanId("pro");
          await requestCheckout("pro");
          return;
        }

        throw new Error(errorMessage);
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
        if (payload.data.widget?.confirmationToken) {
          const returnUrl = buildPaymentReturnUrl({
            paymentId: payload.data.widget.paymentId,
            pricingPath: localizePath("/pricing"),
            productId,
          });
          try {
            await openYooKassaPaymentWidget({
              confirmationToken: payload.data.widget.confirmationToken,
              returnUrl,
              onError: setCheckoutError,
            });
            return;
          } catch (widgetError) {
            if (!payload.data.url) {
              throw widgetError;
            }
          }
        }

        if (payload.data.url) {
          window.location.assign(payload.data.url);
        }
      }
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "TimeoutError"
          ? t(pricingMessages.checkoutTimeout)
          : error instanceof Error
            ? error.message
            : t(pricingMessages.checkoutUnavailable);
      setCheckoutError(message);
    } finally {
      setActiveCheckoutProductId(null);
    }
  };

  const handleDismissPaymentResult = () => {
    setCheckoutResult(null);
    navigate(localizePath("/pricing"), { replace: true });
  };

  const handlePlanCheckout = (productId: PlanCheckoutProductId) => {
    if (!session) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(PENDING_CHECKOUT_STORAGE_KEY, productId);
      }
      onOpenSignup();
      return;
    }

    void requestCheckout(productId);
  };

  const handleAddonPackAction = (pack: PricingPack) => {
    if (!session) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(PENDING_CHECKOUT_STORAGE_KEY, "pro");
      }
      onOpenSignup();
      return;
    }

    if (!canPurchaseAddonCredits) {
      setActivePlanId("pro");
      void requestCheckout("pro");
      return;
    }

    void requestCheckout(pack.checkoutProductId);
  };

  const handleAddonUpgradeAction = () => {
    setActivePlanId("pro");
    handlePlanCheckout("pro");
  };

  useEffect(() => {
    const intent = readPricingEntryIntent();
    if (!intent) {
      return;
    }

    clearPricingEntryIntent();
  }, []);

  useEffect(() => {
    if (!session || typeof window === "undefined") {
      return;
    }

    const pendingCheckoutProductId = window.sessionStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY);
    if (
      pendingCheckoutProductId !== "start" &&
      pendingCheckoutProductId !== "pro" &&
      pendingCheckoutProductId !== "ultra" &&
      pendingCheckoutProductId !== "package_10" &&
      pendingCheckoutProductId !== "package_50" &&
      pendingCheckoutProductId !== "package_100"
    ) {
      return;
    }

    window.sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
    const pendingPlanRestriction =
      pendingCheckoutProductId === "start" || pendingCheckoutProductId === "pro" || pendingCheckoutProductId === "ultra"
        ? getPlanCheckoutRestriction(pendingCheckoutProductId)
        : null;
    if (pendingPlanRestriction) {
      setCheckoutError(getPlanRestrictionMessage(pendingPlanRestriction));
      return;
    }

    void requestCheckout(pendingCheckoutProductId);
  }, [isStartPlanUsed, session]);

  useEffect(() => {
    if (getPlanCheckoutRestriction(activePlanId)) {
      setActivePlanId(defaultActivePlanId);
    }
  }, [activePlanId, defaultActivePlanId, isStartPlanUsed, currentPlanLabel]);

  useEffect(() => {
    const productId = readPaymentReturnProductId(location.search);
    if (!session || !productId) {
      return;
    }

    let isCancelled = false;
    const previousProfile = readPreCheckoutProfile(productId);
    const expectedPlan = isPackageCheckoutProductId(productId) ? null : productId.toUpperCase();

    const applyProfile = (profile: WorkspaceProfile) => {
      if (profile) {
        onWorkspaceProfileChange?.(profile);
      }

      const nextBalance = profile?.balance ?? null;
      const nextPlan = profile?.plan ? String(profile.plan).trim().toUpperCase() : null;
      const addedCredits =
        previousProfile && nextBalance !== null ? Math.max(0, nextBalance - previousProfile.balance) : null;
      const planActivated = Boolean(expectedPlan && nextPlan === expectedPlan);
      const balanceIncreased = Boolean(addedCredits !== null && addedCredits > 0);
      const success =
        balanceIncreased || planActivated || Boolean(!previousProfile && expectedPlan && nextPlan && nextPlan !== "FREE");

      setCheckoutResult({
        addedCredits,
        balance: nextBalance,
        plan: nextPlan,
        productId,
        status: success ? "success" : "pending",
      });

      if (success) {
        clearPreCheckoutProfile();
      }

      return success;
    };

    const pollPaymentProfile = async () => {
      setCheckoutResult({
        addedCredits: null,
        balance: null,
        plan: null,
        productId,
        status: "checking",
      });

      for (let attempt = 0; attempt < PAYMENT_PROFILE_POLL_ATTEMPTS; attempt += 1) {
        try {
          const profile = await fetchWorkspaceProfile();
          if (isCancelled) return;
          if (applyProfile(profile)) return;
        } catch {
          if (isCancelled) return;
        }

        if (attempt < PAYMENT_PROFILE_POLL_ATTEMPTS - 1) {
          await delay(PAYMENT_PROFILE_POLL_INTERVAL_MS);
        }
      }
    };

    void pollPaymentProfile();

    return () => {
      isCancelled = true;
    };
  }, [location.search, navigate, onWorkspaceProfileChange, session]);

  const checkoutResultTitle = checkoutResult
    ? checkoutResult.status === "success"
      ? locale === "en"
        ? "Payment successful"
        : "Оплата прошла успешно"
      : checkoutResult.status === "checking"
        ? locale === "en"
          ? "Checking payment"
          : "Проверяем оплату"
        : locale === "en"
          ? "Payment is being processed"
          : "Оплата обрабатывается"
    : "";
  const checkoutResultProduct = checkoutResult ? getCheckoutProductLabel(checkoutResult.productId) : "";
  const checkoutResultPlanLabel = checkoutResult
    ? isPackageCheckoutProductId(checkoutResult.productId)
      ? checkoutResult.plan || currentPlanLabel || "PRO"
      : checkoutResultProduct
    : "";
  const checkoutResultAddedCredits =
    checkoutResult?.addedCredits !== null && checkoutResult?.addedCredits !== undefined
      ? `+${Math.max(0, checkoutResult.addedCredits)}`
      : "…";
  const checkoutResultBalance = checkoutResult?.balance !== null && checkoutResult?.balance !== undefined ? String(checkoutResult.balance) : "…";
  const checkoutResultDescription = checkoutResult
    ? checkoutResult.status === "success"
      ? isPackageCheckoutProductId(checkoutResult.productId)
        ? locale === "en"
          ? "Credits are already on your balance. You can create the next Short now."
          : "Кредиты уже на балансе. Можно сразу создавать следующий Shorts."
        : locale === "en"
          ? `Plan ${checkoutResultPlanLabel} is active. You can create the next Short now.`
          : `Тариф ${checkoutResultPlanLabel} активирован. Можно сразу создавать следующий Shorts.`
      : checkoutResult.status === "checking"
        ? locale === "en"
          ? "Refreshing your account balance and plan status."
          : "Обновляем баланс и статус тарифа в аккаунте."
        : locale === "en"
          ? "YooKassa returned to the site, but the new balance is not visible yet. Refresh the page in a moment if it does not update."
          : "YooKassa вернула вас на сайт, но новый баланс пока не виден. Если статус не обновится, перезагрузите страницу через минуту."
    : "";

  return (
    <div className="route-page pricing-page">
      <header className="site-header" id="top">
        <div className="container site-header__inner">
          <Link className="brand" to={localizePath("/")} aria-label="AdShorts AI">
            <img src="/logo.png" alt="" width="44" height="44" />
            <span>AdShorts AI</span>
          </Link>

          <PrimarySiteNav activeItem="pricing" onOpenStudio={openPrimaryFlow} onOpenStudioSection={openStudioSection} />

          <div className="site-header__actions">
            <LanguageSwitcher />
            {session ? (
              <>
                <SiteHeaderWorkspaceStatus profile={workspaceProfile} />
                <AccountMenuButton
                  email={session.email}
                  name={session.name}
                  onLogout={onLogout}
                  plan={currentPlanLabel ?? "FREE"}
                />
              </>
            ) : (
              <button className="site-header__signin route-button" type="button" onClick={onOpenSignin}>
                {t(pricingMessages.signIn)}
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="section pricing-max-hero">
          <div className="container">
            <div className="pricing-max-hero__heading">
              <h1>{t(pricingMessages.heroHeading)}</h1>
              {checkoutError ? (
                <p className="pricing-max-hero__status" role="alert">
                  {checkoutError}
                </p>
              ) : null}
              {checkoutResult ? (
                <div
                  className={`pricing-payment-result pricing-payment-result--${checkoutResult.status}`}
                  id="payment-result"
                  role={checkoutResult.status === "success" ? "status" : "alert"}
                >
                  <button
                    className="pricing-payment-result__close"
                    type="button"
                    aria-label={locale === "en" ? "Close payment result" : "Закрыть результат оплаты"}
                    onClick={handleDismissPaymentResult}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                  <div className="pricing-payment-result__mark" aria-hidden="true">
                    <span />
                  </div>
                  <div className="pricing-payment-result__content">
                    <span className="pricing-payment-result__eyebrow">{checkoutResultProduct}</span>
                    <strong className="pricing-payment-result__title">{checkoutResultTitle}</strong>
                    <p>{checkoutResultDescription}</p>
                    <dl className="pricing-payment-result__facts">
                      <div>
                        <dt>{locale === "en" ? "Plan" : "Тариф"}</dt>
                        <dd>{checkoutResultPlanLabel}</dd>
                      </div>
                      <div>
                        <dt>{locale === "en" ? "Added" : "Начислено"}</dt>
                        <dd>{checkoutResultAddedCredits}</dd>
                      </div>
                      <div>
                        <dt>{locale === "en" ? "Balance" : "Баланс"}</dt>
                        <dd>{checkoutResultBalance}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="pricing-payment-result__actions">
                    <button className="btn pricing-payment-result__primary route-button" type="button" onClick={onOpenWorkspace}>
                      {locale === "en" ? "Open Studio" : "Открыть студию"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="section pricing-max-plans" id="plans">
          <div className="container">
            <div className="pricing-max-grid" onMouseLeave={() => setActivePlanId(defaultActivePlanId)}>
              {pricingPlans.map((plan) => {
                const planRestriction = getPlanCheckoutRestriction(plan.checkoutProductId);
                const planRestrictionLabel = getPlanRestrictionLabel(planRestriction);
                const isPlanRestricted = Boolean(planRestriction);
                const isActivePlan = !isPlanRestricted && plan.checkoutProductId === activePlanId;
                const cardClassName = [
                  "pricing-max-card",
                  isActivePlan ? "pricing-max-card--featured" : "",
                  isPlanRestricted ? "pricing-max-card--disabled" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <article
                    key={plan.name}
                    className={cardClassName}
                    aria-disabled={isPlanRestricted}
                    onMouseEnter={() => {
                      if (!isPlanRestricted) {
                        setActivePlanId(plan.checkoutProductId);
                      }
                    }}
                    onFocusCapture={() => {
                      if (!isPlanRestricted) {
                        setActivePlanId(plan.checkoutProductId);
                      }
                    }}
                    onBlurCapture={(event) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        return;
                      }

                      setActivePlanId(defaultActivePlanId);
                    }}
                  >
                    <div className="pricing-max-card__head">
                      <div>
                        <span className="pricing-max-card__name">{plan.name}</span>
                        <h3>
                          {plan.audienceLines
                            ? plan.audienceLines.map((line) => (
                                <span key={`${plan.name}-${line}`} className="pricing-max-card__title-line">
                                  {line}
                                </span>
                              ))
                            : plan.audience}
                        </h3>
                      </div>
                      {planRestrictionLabel ? (
                        <span className="pricing-max-card__badge pricing-max-card__badge--used">{planRestrictionLabel}</span>
                      ) : plan.badge ? (
                        <span className="pricing-max-card__badge">{plan.badge}</span>
                      ) : null}
                    </div>

                    <div className="pricing-max-card__price">
                      <strong>{plan.price}</strong>
                      <span>{plan.billing}</span>
                    </div>

                    <div className="pricing-max-card__output">
                      <span>{plan.credits}</span>
                      {plan.subnote ? <small>{plan.subnote}</small> : null}
                    </div>

                    <ul className="pricing-max-card__features">
                      {plan.features.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>

                    <button
                      className="btn pricing-max-card__cta pricing-max-card__cta--primary route-button"
                      type="button"
                      onClick={() => handlePlanCheckout(plan.checkoutProductId)}
                      disabled={isPlanRestricted || activeCheckoutProductId === plan.checkoutProductId}
                    >
                      {planRestrictionLabel
                        ? planRestrictionLabel
                        : activeCheckoutProductId === plan.checkoutProductId
                          ? t(pricingMessages.checkoutOpening)
                          : plan.ctaLabel}
                    </button>
                  </article>
                );
              })}

              <button
                className="pricing-max-enterprise"
                type="button"
                aria-controls="agency-contact-modal"
                aria-haspopup="dialog"
                onClick={() => setIsAgencyModalOpen(true)}
                onMouseEnter={() => setActivePlanId(DEFAULT_FEATURED_PLAN_ID)}
                onFocus={() => setActivePlanId(DEFAULT_FEATURED_PLAN_ID)}
              >
                <div className="pricing-max-enterprise__copy">
                  <span className="pricing-max-enterprise__eyebrow">Agency / Teams</span>
                  <h3>{t(pricingMessages.enterpriseHeading)}</h3>
                  <p>{t(pricingMessages.enterpriseIntro)}</p>
                </div>

                <ul className="pricing-max-enterprise__list">
                  <li>{t(pricingMessages.enterpriseItemMoreShorts)}</li>
                  <li>{t(pricingMessages.enterpriseItemVolumeCredits)}</li>
                  <li>{t(pricingMessages.enterpriseItemPriorityGeneration)}</li>
                </ul>

                <span className="btn pricing-max-button pricing-max-button--ghost pricing-max-enterprise__cta">
                  {t(pricingMessages.enterpriseCta)}
                </span>
              </button>
            </div>

          </div>
        </section>

        <section className="section pricing-max-addons" id="addons">
          <div className="container">
            {canPurchaseAddonCredits ? (
              <div className="pricing-max-section-head">
                <div>
                  <h2>{t(pricingMessages.addonHeading)}</h2>
                </div>
              </div>
            ) : null}

            {checkoutError ? (
              <p className="pricing-max-addons__status" role="alert">
                {checkoutError}
              </p>
            ) : null}

            {canPurchaseAddonCredits ? (
              <>
                <div className="pricing-max-addons__grid">
                  {pricingPacks.map((pack) => (
                    <article key={pack.name} className="pricing-max-pack">
                      {pack.badge ? <span className="pricing-max-pack__badge">{pack.badge}</span> : null}
                      <span className="pricing-max-pack__name">{pack.name}</span>
                      <strong>{pack.credits}</strong>
                      <span className="pricing-max-pack__price">{pack.price}</span>
                      <small>{pack.subnote}</small>
                      <button
                        className="btn pricing-max-card__cta pricing-max-card__cta--secondary pricing-max-pack__cta route-button"
                        type="button"
                        onClick={() => handleAddonPackAction(pack)}
                        disabled={activeCheckoutProductId === pack.checkoutProductId}
                      >
                        {activeCheckoutProductId === pack.checkoutProductId ? t(pricingMessages.checkoutOpening) : t(pricingMessages.addonBuy)}
                      </button>
                    </article>
                  ))}
                </div>
                <p className="pricing-max-addons__note">{addonsEligibilityNote}</p>
              </>
            ) : (
              <article className="pricing-max-addon-lock">
                <h3>{t(pricingMessages.addonUpgradeTitle)}</h3>
                <p>{t(pricingMessages.addonUpgradeDescription)}</p>
                <button
                  className="btn pricing-max-card__cta pricing-max-card__cta--primary pricing-max-addon-lock__cta route-button"
                  type="button"
                  onClick={handleAddonUpgradeAction}
                  disabled={activeCheckoutProductId === "pro"}
                >
                  {activeCheckoutProductId === "pro" ? t(pricingMessages.checkoutOpening) : t(pricingMessages.addonUpgradeCta)}
                </button>
              </article>
            )}
          </div>
        </section>

        <section className="section pricing-max-faq">
          <div className="container pricing-max-faq__frame">
            <div className="pricing-max-faq__lead">
              <h2>{t(pricingMessages.faqHeading)}</h2>
            </div>

            <div className="pricing-max-faq__grid">
              {pricingFaqs.map((faq) => (
                <article key={faq.question} className="pricing-max-faq-card">
                  <h3>{faq.question}</h3>
                  <p>{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <AgencyContactModal
        isOpen={isAgencyModalOpen}
        onClose={() => setIsAgencyModalOpen(false)}
        defaultEmail={session?.email ?? null}
        defaultName={session?.name ?? null}
      />
    </div>
  );
}
