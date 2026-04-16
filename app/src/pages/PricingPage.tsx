import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AccountMenuButton } from "../components/AccountMenuButton";
import { AgencyContactModal } from "../components/AgencyContactModal";
import { PrimarySiteNav } from "../components/PrimarySiteNav";
import { SiteHeaderWorkspaceStatus } from "../components/SiteHeaderWorkspaceStatus";
import { getInsufficientCreditsPricingNotice } from "../lib/insufficient-credits";
import {
  clearPricingEntryIntent,
  readPricingEntryIntent,
  type PricingEntryIntent,
} from "../lib/pricing-entry-intent";
import { writeStudioEntryIntent, type StudioEntryIntentSection } from "../lib/studio-entry-intent";

type Session = {
  name: string;
  email: string;
  plan: string;
} | null;

type WorkspaceProfile = {
  balance: number;
  expiresAt: string | null;
  plan: string;
} | null;

type Props = {
  session: Session;
  workspaceProfile?: WorkspaceProfile;
  onOpenSignup: () => void;
  onOpenSignin: () => void;
  onLogout: () => void | Promise<void>;
  onOpenWorkspace: () => void;
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
    url: string;
  };
  error?: string;
};

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

const PENDING_CHECKOUT_STORAGE_KEY = "adshorts.pending-checkout-plan";
const PACKAGE_RESTRICTION_ERROR_FRAGMENT = "PRO and ULTRA";
const CHECKOUT_REQUEST_TIMEOUT_MS = 20_000;

const pricingPlans: PricingPlan[] = [
  {
    checkoutProductId: "start",
    name: "START",
    audience: "Для первого запуска",
    audienceLines: ["Для первого", "запуска"],
    price: "390 ₽",
    billing: "",
    credits: "50 кредитов",
    subnote: "До 5 видео, доступен один раз",
    features: [
      "Автопубликация в YouTube",
      "Брендинг на видео",
      "Видео без водяного знака",
    ],
    ctaLabel: "Оплатить START",
  },
  {
    checkoutProductId: "pro",
    name: "PRO",
    audience: "Для регулярного контент-потока",
    audienceLines: ["Для регулярного", "контент-потока"],
    price: "1 490 ₽",
    billing: "",
    credits: "250 кредитов",
    subnote: "До 25 видео",
    features: [
      "Всё из START",
      "Приоритетная генерация",
      "Можно докупать кредиты",
      "Видео без водяного знака",
    ],
    badge: "Самый популярный",
    featured: true,
    ctaLabel: "Оплатить PRO",
  },
  {
    checkoutProductId: "ultra",
    name: "ULTRA",
    audience: "Для максимального объёма",
    audienceLines: ["Для максимального", "объёма"],
    price: "4 990 ₽",
    billing: "",
    credits: "1000 кредитов",
    subnote: "До 100 видео",
    features: [
      "Всё из PRO",
      "Максимальный приоритет",
      "Ранний доступ к новым функциям",
      "Видео без водяного знака",
    ],
    badge: "Лучшая выгода",
    ctaLabel: "Оплатить ULTRA",
  },
];

const DEFAULT_FEATURED_PLAN_ID: PlanCheckoutProductId =
  pricingPlans.find((plan) => plan.featured)?.checkoutProductId ?? "pro";

const pricingPacks: PricingPack[] = [
  {
    checkoutProductId: "package_10",
    name: "Pack 100",
    credits: "100 кредитов",
    price: "690 ₽",
    subnote: "До 10 видео",
  },
  {
    checkoutProductId: "package_50",
    name: "Pack 500",
    credits: "500 кредитов",
    price: "2 750 ₽",
    subnote: "до 50 видео",
    badge: "Выгодно",
  },
  {
    checkoutProductId: "package_100",
    name: "Pack 1000",
    credits: "1000 кредитов",
    price: "4 990 ₽",
    subnote: "до 100 видео",
  },
];

const pricingFaqs: PricingFAQ[] = [
  {
    question: "1 видео = 10 кредитов",
    answer: "Каждая генерация Shorts списывает 10 кредитов. Это единая логика для всех тарифов.",
  },
  {
    question: "Срок действия функций",
    answer: "Функции тарифа активны 30 дней. Неиспользованные кредиты сохраняются и не сгорают.",
  },
  {
    question: "Что включено в оплату",
    answer: "Все видео идут без водяного знака. Автопродления нет, повторная оплата только вручную.",
  },
];

export function PricingPage({
  session,
  workspaceProfile = null,
  onOpenSignup,
  onOpenSignin,
  onLogout,
  onOpenWorkspace,
}: Props) {
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [activeCheckoutProductId, setActiveCheckoutProductId] = useState<CheckoutProductId | null>(null);
  const [activePlanId, setActivePlanId] = useState<PlanCheckoutProductId>(DEFAULT_FEATURED_PLAN_ID);
  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
  const [entryIntent, setEntryIntent] = useState<PricingEntryIntent | null>(null);
  const currentPlanLabel = String(workspaceProfile?.plan ?? session?.plan ?? "").trim().toUpperCase() || null;
  const canPurchaseAddonCredits = currentPlanLabel === "PRO" || currentPlanLabel === "ULTRA";
  const addonsEligibilityNote = canPurchaseAddonCredits
    ? `На тарифе ${currentPlanLabel} вам доступны пакеты дополнительных кредитов. Нажмите на нужный пакет, чтобы перейти к оплате.`
      : currentPlanLabel
        ? `На тарифе ${currentPlanLabel} пакеты недоступны. Дополнительные кредиты можно покупать только на PRO и ULTRA.`
        : "Дополнительные кредиты можно покупать только на тарифах PRO и ULTRA.";
  const plansEntryNotice =
    entryIntent?.source === "insufficient-credits" && entryIntent.section === "plans"
      ? getInsufficientCreditsPricingNotice("plans")
      : null;
  const addonsEntryNotice =
    entryIntent?.source === "insufficient-credits" && entryIntent.section === "addons"
      ? getInsufficientCreditsPricingNotice("addons")
      : null;

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
    setCheckoutError(null);
    setActiveCheckoutProductId(productId);

    try {
      const response = await fetch(`/api/payments/checkout/${encodeURIComponent(productId)}`, {
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

      const errorMessage = payload?.error ?? "Не удалось открыть страницу оплаты.";
      if (!response.ok || !payload?.data?.url) {
        if (productId.startsWith("package_") && errorMessage.includes(PACKAGE_RESTRICTION_ERROR_FRAGMENT)) {
          setActivePlanId("pro");
          await requestCheckout("pro");
          return;
        }

        throw new Error(errorMessage);
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
        window.location.assign(payload.data.url);
      }
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "TimeoutError"
          ? "Страница оплаты отвечает слишком долго. Попробуйте ещё раз через несколько секунд."
          : error instanceof Error
            ? error.message
            : "Не удалось открыть страницу оплаты.";
      setCheckoutError(message);
    } finally {
      setActiveCheckoutProductId(null);
    }
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

  useEffect(() => {
    const nextEntryIntent = readPricingEntryIntent();
    if (!nextEntryIntent) {
      return;
    }

    setEntryIntent(nextEntryIntent);
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
    void requestCheckout(pendingCheckoutProductId);
  }, [session]);

  return (
    <div className="route-page pricing-page">
      <header className="site-header" id="top">
        <div className="container site-header__inner">
          <Link className="brand" to="/" aria-label="AdShorts AI">
            <img src="/logo.png" alt="" width="44" height="44" />
            <span>AdShorts AI</span>
          </Link>

          <PrimarySiteNav activeItem="pricing" onOpenStudio={openPrimaryFlow} onOpenStudioSection={openStudioSection} />

          <div className="site-header__actions">
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
              <button className="site-header__link route-button" type="button" onClick={onOpenSignin}>
                Вход
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="section pricing-max-hero">
          <div className="container">
            <div className="pricing-max-hero__heading">
              <p className="eyebrow">Тарифы</p>
              <h1>Выберите свой тариф</h1>
              {checkoutError ? (
                <p className="pricing-max-hero__status" role="alert">
                  {checkoutError}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="section pricing-max-plans" id="plans">
          <div className="container">
            {plansEntryNotice ? (
              <p className="pricing-max-section__status pricing-max-section__status--info" role="status">
                {plansEntryNotice}
              </p>
            ) : null}
            <div className="pricing-max-grid" onMouseLeave={() => setActivePlanId(DEFAULT_FEATURED_PLAN_ID)}>
              {pricingPlans.map((plan) => {
                const isActivePlan = plan.checkoutProductId === activePlanId;

                return (
                  <article
                    key={plan.name}
                    className={isActivePlan ? "pricing-max-card pricing-max-card--featured" : "pricing-max-card"}
                    onMouseEnter={() => setActivePlanId(plan.checkoutProductId)}
                    onFocusCapture={() => setActivePlanId(plan.checkoutProductId)}
                    onBlurCapture={(event) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        return;
                      }

                      setActivePlanId(DEFAULT_FEATURED_PLAN_ID);
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
                      {plan.badge ? <span className="pricing-max-card__badge">{plan.badge}</span> : null}
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
                      disabled={activeCheckoutProductId === plan.checkoutProductId}
                    >
                      {activeCheckoutProductId === plan.checkoutProductId ? "Открываем оплату..." : plan.ctaLabel}
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
                  <h3>Нужен объём выше Ultra или запуск для команды?</h3>
                  <p>
                    Если вы ведёте несколько брендов, рубрик или клиентских потоков, оставьте заявку и мы подберём
                    расширенный сценарий подключения.
                  </p>
                </div>

                <ul className="pricing-max-enterprise__list">
                  <li>Кастомный месячный объём</li>
                  <li>Поддержка запуска контент-серий</li>
                  <li>Путь апгрейда от solo creator к team workflow</li>
                </ul>

                <span className="btn pricing-max-button pricing-max-button--ghost pricing-max-enterprise__cta">
                  Оставить заявку
                </span>
              </button>
            </div>

          </div>
        </section>

        <section className="section pricing-max-addons" id="addons">
          <div className="container">
            <div className="pricing-max-section-head">
              <div>
                <p className="eyebrow">Дополнительные кредиты</p>
                <h2>Пополняйте кредиты не меняя тарифный план</h2>
              </div>
            </div>

            {addonsEntryNotice ? (
              <p className="pricing-max-section__status pricing-max-section__status--info" role="status">
                {addonsEntryNotice}
              </p>
            ) : null}

            {checkoutError ? (
              <p className="pricing-max-addons__status" role="alert">
                {checkoutError}
              </p>
            ) : null}

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
                    disabled={activeCheckoutProductId === pack.checkoutProductId || !canPurchaseAddonCredits}
                  >
                    {activeCheckoutProductId === pack.checkoutProductId
                      ? "Открываем оплату..."
                      : canPurchaseAddonCredits
                        ? "Купить пакет"
                        : "Нужен PRO / ULTRA"}
                  </button>
                </article>
              ))}
            </div>
            <p className="pricing-max-addons__note">{addonsEligibilityNote}</p>
          </div>
        </section>

        <section className="section pricing-max-faq">
          <div className="container pricing-max-faq__frame">
            <div className="pricing-max-faq__lead">
              <p className="eyebrow">Как работает</p>
              <h2>Как работают тарифы</h2>
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
