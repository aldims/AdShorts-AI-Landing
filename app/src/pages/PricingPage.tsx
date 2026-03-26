import { Link } from "react-router-dom";
import { AccountMenuButton } from "../components/AccountMenuButton";
import { PrimarySiteNav } from "../components/PrimarySiteNav";

type Session = {
  name: string;
  email: string;
  plan: string;
} | null;

type Props = {
  session: Session;
  onOpenSignup: () => void;
  onOpenSignin: () => void;
  onLogout: () => void | Promise<void>;
  onOpenWorkspace: () => void;
};

type PricingPlan = {
  name: string;
  audience: string;
  audienceLines?: string[];
  price: string;
  billing: string;
  credits: string;
  subnote: string;
  features: string[];
  badge?: string;
  featured?: boolean;
  ctaLabel: string;
  ctaType: "app" | "telegram";
};

type PricingPack = {
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

const pricingPlans: PricingPlan[] = [
  {
    name: "START",
    audience: "Для первого запуска",
    price: "390 ₽",
    billing: "",
    credits: "5 кредитов",
    subnote: "Доступен один раз",
    features: [
      "Автопубликация в YouTube",
      "Брендинг на видео",
      "Улучшение видео до Premium",
      "Видео без водяного знака",
    ],
    ctaLabel: "Оформить START",
    ctaType: "telegram",
  },
  {
    name: "PRO",
    audience: "Для регулярного контент-потока",
    audienceLines: ["Для регулярного", "контент-потока"],
    price: "1 490 ₽",
    billing: "",
    credits: "25 кредитов",
    subnote: "1 кредит = 1 видео",
    features: [
      "Всё из START",
      "Приоритетная генерация",
      "Можно докупать кредиты",
      "Видео без водяного знака",
    ],
    badge: "Most popular",
    featured: true,
    ctaLabel: "Оформить через Telegram",
    ctaType: "telegram",
  },
  {
    name: "ULTRA",
    audience: "Для максимального объёма",
    audienceLines: ["Для максимального", "объёма"],
    price: "4 990 ₽",
    billing: "",
    credits: "100 кредитов",
    subnote: "1 кредит = 1 видео",
    features: [
      "Всё из PRO",
      "Максимальный приоритет",
      "Ранний доступ к новым функциям",
      "Видео без водяного знака",
    ],
    badge: "Best value",
    ctaLabel: "Перейти на Ultra",
    ctaType: "telegram",
  },
];

const pricingPacks: PricingPack[] = [
  {
    name: "Pack 10",
    credits: "10 кредитов",
    price: "690 ₽",
    subnote: "~69 ₽/кредит",
  },
  {
    name: "Pack 50",
    credits: "50 кредитов",
    price: "2 750 ₽",
    subnote: "~55 ₽/кредит",
    badge: "Выгодно",
  },
  {
    name: "Pack 100",
    credits: "100 кредитов",
    price: "4 990 ₽",
    subnote: "~50 ₽/кредит",
  },
];

const pricingFaqs: PricingFAQ[] = [
  {
    question: "1 кредит = 1 видео",
    answer: "Каждая генерация Shorts списывает 1 кредит. Это единая логика для всех тарифов.",
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

export function PricingPage({ session, onOpenSignup, onOpenSignin, onLogout, onOpenWorkspace }: Props) {
  const openPrimaryFlow = () => {
    if (session) {
      onOpenWorkspace();
      return;
    }

    onOpenSignup();
  };

  return (
    <div className="route-page pricing-page">
      <header className="site-header" id="top">
        <div className="container site-header__inner">
          <Link className="brand" to="/" aria-label="AdShorts AI">
            <img src="/logo.png" alt="" width="44" height="44" />
            <span>AdShorts AI</span>
          </Link>

          <PrimarySiteNav activeItem="pricing" onOpenStudio={openPrimaryFlow} />

          <div className="site-header__actions">
            {session ? (
              <AccountMenuButton email={session.email} name={session.name} onLogout={onLogout} plan={session.plan} />
            ) : (
              <button className="site-header__link route-button" type="button" onClick={onOpenSignin}>
                Sign in
              </button>
            )}
            {!session ? (
              <button className="btn btn--header route-button" type="button" onClick={openPrimaryFlow}>
                Создать видео бесплатно
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main>
        <section className="section pricing-max-hero">
          <div className="container">
            <div className="pricing-max-hero__heading">
              <p className="eyebrow">Тарифы</p>
              <h1>Выберите свой тариф</h1>
            </div>
          </div>
        </section>

        <section className="section pricing-max-plans" id="plans">
          <div className="container">
            <div className="pricing-max-grid">
              {pricingPlans.map((plan) => (
                <article
                  key={plan.name}
                  className={plan.featured ? "pricing-max-card pricing-max-card--featured" : "pricing-max-card"}
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
                    <small>{plan.subnote}</small>
                  </div>

                  <ul className="pricing-max-card__features">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>

                  {plan.ctaType === "app" ? (
                    <button
                      className="btn pricing-max-card__cta pricing-max-card__cta--primary route-button"
                      type="button"
                      onClick={openPrimaryFlow}
                    >
                      {plan.ctaLabel}
                    </button>
                  ) : (
                    <a
                      className="btn pricing-max-card__cta pricing-max-card__cta--secondary"
                      href="https://t.me/AdShortsAIBot"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {plan.ctaLabel}
                    </a>
                  )}
                </article>
              ))}

              <article className="pricing-max-enterprise">
                <div className="pricing-max-enterprise__copy">
                  <span className="pricing-max-enterprise__eyebrow">Agency / Teams</span>
                  <h3>Нужен объём выше Ultra или запуск для команды?</h3>
                  <p>
                    Если вы ведёте несколько брендов, рубрик или клиентских потоков, начните с Telegram и мы подберём
                    расширенный сценарий подключения.
                  </p>
                </div>

                <ul className="pricing-max-enterprise__list">
                  <li>Кастомный месячный объём</li>
                  <li>Поддержка запуска контент-серий</li>
                  <li>Путь апгрейда от solo creator к team workflow</li>
                </ul>

                <a
                  className="btn pricing-max-button pricing-max-button--ghost"
                  href="https://t.me/AdShortsAIBot"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Обсудить подключение
                </a>
              </article>
            </div>

          </div>
        </section>

        <section className="section pricing-max-addons">
          <div className="container">
            <div className="pricing-max-section-head">
              <div>
                <p className="eyebrow">Дополнительные кредиты</p>
                <h2>Пополняйте кредиты не меняя тарифный план</h2>
              </div>
            </div>

            <div className="pricing-max-addons__grid">
              {pricingPacks.map((pack) => (
                <article key={pack.name} className="pricing-max-pack">
                  {pack.badge ? <span className="pricing-max-pack__badge">{pack.badge}</span> : null}
                  <span className="pricing-max-pack__name">{pack.name}</span>
                  <strong>{pack.credits}</strong>
                  <span>{pack.price}</span>
                  <small>{pack.subnote}</small>
                </article>
              ))}
            </div>
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
    </div>
  );
}
