import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { AccountMenuButton } from "../components/AccountMenuButton";
import { PrimarySiteNav } from "../components/PrimarySiteNav";
import { SiteHeaderWorkspaceStatus } from "../components/SiteHeaderWorkspaceStatus";
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

const heroPromptText = "Как нейросети меняют маркетинг в 2026";
const heroChips = ["Видео", "Субтитры", "Озвучка", "9:16"];
const heroPreviewImageSrc = "/hero_image.png";
const landingRefineProofs = [
  {
    label: "ТОЧЕЧНАЯ ПРАВКА",
    title: "Меняйте только нужный фрагмент",
    description: "Корректируйте один кадр без пересборки остального ролика.",
  },
  {
    label: "ОДИН КОНТЕКСТ",
    title: "Текст, визуал и субтитры рядом",
    description: "Вся сцена редактируется на одном экране без лишних переключений.",
  },
  {
    label: "ФИНАЛЬНЫЙ КОНТРОЛЬ",
    title: "Проверяйте подачу перед экспортом",
    description: "Сразу видно, как сцена выглядит в итоговом вертикальном формате.",
  },
] as const;
const landingRefineMetrics = [
  { value: "3", label: "слоя контроля в одном экране" },
  { value: "1 сцена", label: "правится без пересборки всего ролика" },
  { value: "9:16", label: "финальный формат виден сразу" },
] as const;
const landingRefineCarouselCards = [
  {
    number: "02",
    title: "Аргумент",
    time: "00:05 - 00:10",
    source: "Сток",
    tone: "argument",
    media: "hero",
    slotClass: "is-side is-left",
    isEdited: false,
  },
  {
    number: "03",
    title: "Финальный акцент",
    time: "00:11 - 00:17",
    source: "Кастом",
    tone: "accent",
    media: "hero",
    slotClass: "is-active",
    isEdited: true,
  },
  {
    number: "04",
    title: "CTA",
    time: "00:18 - 00:22",
    source: "AI фото",
    tone: "cta",
    media: "hero",
    slotClass: "is-side is-right",
    isEdited: false,
  },
] as const;
const landingRevealSelector = [
  ".section-head",
  ".capability",
  ".showcase-card",
  ".step-card",
  ".trust-shell__copy",
  ".stat-card",
  ".pricing-shell__copy",
  ".plan-card",
  ".guide-card",
  ".guides-strip__cta",
  ".landing-refine-proof",
  ".landing-refine-board__shell",
].join(", ");

export function LandingPage({ session, workspaceProfile = null, onOpenSignup, onOpenSignin, onLogout, onOpenWorkspace }: Props) {
  const previewRef = useRef<HTMLDivElement>(null);
  const revealRootRef = useRef<HTMLElement>(null);
  const accountPlanLabel = String(workspaceProfile?.plan ?? "").trim().toUpperCase() || "…";

  useEffect(() => {
    const handleScroll = () => {
      if (!previewRef.current) return;
      const scrollY = window.scrollY;
      const maxScroll = 600;
      const progress = Math.min(scrollY / maxScroll, 1);
      
      const rotateY = -25 + progress * 25;
      const rotateX = 12 - progress * 12;
      const rotateZ = 3 - progress * 3;
      const translateY = progress * -40;
      
      previewRef.current.style.transform = 
        `rotateY(${rotateY}deg) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) translateY(${translateY}px)`;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const root = revealRootRef.current;
    if (!root) return undefined;

    const revealNodes = Array.from(root.querySelectorAll<HTMLElement>(landingRevealSelector));
    if (!revealNodes.length) return undefined;

    revealNodes.forEach((node) => {
      node.setAttribute("data-reveal", "");
      node.classList.remove("is-visible");
      delete node.dataset.revealDelay;

      const parent = node.parentElement;
      if (!parent) return;

      const siblings = Array.from(parent.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child.matches(landingRevealSelector),
      );
      const siblingIndex = siblings.indexOf(node);

      if (siblingIndex >= 0 && siblingIndex < 5) {
        node.dataset.revealDelay = String(siblingIndex + 1);
      }
    });

    if (typeof IntersectionObserver === "undefined") {
      revealNodes.forEach((node) => node.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -30px 0px",
      },
    );

    revealNodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);

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

  return (
    <div className="route-page">
      <header className="site-header" id="top">
        <div className="container site-header__inner">
          <Link className="brand" to="/" aria-label="AdShorts AI">
            <img src="/logo.png" alt="" width="44" height="44" />
            <span>AdShorts AI</span>
          </Link>

          <PrimarySiteNav activeItem="home" onOpenStudio={openPrimaryFlow} onOpenStudioSection={openStudioSection} />

          <div className="site-header__actions">
            <a
              className="site-header__link"
              href="https://t.me/AdShortsAIBot"
              target="_blank"
              rel="noopener noreferrer"
            >
              Telegram
            </a>
            {session ? (
              <>
                <SiteHeaderWorkspaceStatus profile={workspaceProfile} />
                <AccountMenuButton email={session.email} name={session.name} onLogout={onLogout} plan={accountPlanLabel} />
              </>
            ) : (
              <button className="site-header__link route-button" type="button" onClick={onOpenSignin}>
                Вход
              </button>
            )}
            {!session ? (
              <button className="btn btn--header btn--premium-cta btn--premium-cta--compact route-button" type="button" onClick={openPrimaryFlow}>
                <span className="btn--premium-cta__label">Создать видео бесплатно</span>
                <svg
                  className="btn--premium-cta__arrow"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main ref={revealRootRef}>
        <section className="hero">
          <div className="hero__scene" aria-hidden="true">
            <span className="hero__scene-stars"></span>
            <span className="hero__scene-glow hero__scene-glow--left"></span>
            <span className="hero__scene-glow hero__scene-glow--center"></span>
            <span className="hero__scene-glow hero__scene-glow--right"></span>
            <span className="hero__scene-orbit hero__scene-orbit--one"></span>
            <span className="hero__scene-orbit hero__scene-orbit--two"></span>
            <span className="hero__scene-beam"></span>
          </div>

          <div className="container hero__grid">
            <div className="hero__copy">
              <p className="eyebrow">AI studio for short-form creators</p>
              <h1>
                <span className="hero__title-highlight">Shorts / Reels / TikTok</span>
                <span className="hero__title-subline">за 1 минуту. В один клик.</span>
              </h1>
              <p className="hero__lead">
                Превратите любую вашу идею в готовый Shorts.
              </p>

              <div className="hero__actions">
                <button className="btn btn--primary btn--hero btn--premium-cta route-button" type="button" onClick={openPrimaryFlow}>
                  <span className="btn--premium-cta__label">Создать Shorts бесплатно</span>
                  <svg className="btn--premium-cta__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <ul className="hero__features">
                <li>Оптимизирован под Shorts</li>
                <li>Всё делается автоматически</li>
                <li>Готово к публикации</li>
              </ul>

              <div className="hero__service-pills" aria-label="Что входит в ролик">
                <span className="hero__service-pill">AI сценарий</span>
                <span className="hero__service-pill">Озвучка</span>
                <span className="hero__service-pill">Визуал</span>
                <span className="hero__service-pill">Субтитры</span>
                <span className="hero__service-pill">Музыка</span>
                <span className="hero__service-pill">9:16</span>
              </div>
            </div>

            <aside className="hero-live-preview" aria-label="Live studio preview">
              <div className="hero-live-preview__perspective" ref={previewRef}>
                <div className="hero-live-preview__glow" aria-hidden="true"></div>
                <div className="hero-live-preview__reflection" aria-hidden="true"></div>
                <div className="hero-live-preview__frame">
                  <div className="hero-live-preview__video">
                    <img
                      className="hero-live-preview__image"
                      src={heroPreviewImageSrc}
                      alt="Превью интерфейса AdShorts AI внутри hero-экрана"
                      loading="eager"
                      decoding="async"
                    />
                    <span className="hero-live-preview__image-shade" aria-hidden="true"></span>
                  </div>
                  <div className="hero-live-preview__prompt">
                    <span className="hero-live-preview__prompt-text">{heroPromptText}</span>
                    <button className="hero-live-preview__btn" type="button" aria-label="Generate">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  <div className="hero-live-preview__chips">
                    {heroChips.map((chip) => (
                      <span className="hero-live-preview__chip" key={chip}>{chip}</span>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            
          </div>

          <div className="container hero__trust">
            <span className="hero__trust-label">Built for</span>
            <div className="hero__trust-list">
              <span>YouTube Shorts</span>
              <span>Instagram Reels</span>
              <span>TikTok</span>
              <span>Solo creators</span>
              <span>Brand teams</span>
              <span>Growth agencies</span>
            </div>
          </div>
        </section>

        <section className="section section--paper section--workflow">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow eyebrow--dark">КАК ЭТО РАБОТАЕТ</p>
              <h2>От идеи до готового Shorts за 3 шага</h2>
              <p>
                Вы задаёте тему, сервис автоматически собирает сценарий, озвучку, визуал и субтитры, а на выходе
                получаете готовый ролик для публикации.
              </p>
            </div>

            <div className="steps-grid">
              <article className="step-card">
                <div className="step-card__num">01</div>
                <h3>Введите идею</h3>
                <p>Опишите, о чём ролик: тему, оффер или формат — сервис подхватит и соберёт структуру под Shorts.</p>
              </article>

              <article className="step-card">
                <div className="step-card__num">02</div>
                <h3>Получите готовый Shorts</h3>
                <p>Сценарий, озвучка, визуал и субтитры собираются автоматически — без ручного монтажа.</p>
              </article>

              <article className="step-card">
                <div className="step-card__num">03</div>
                <h3>Публикуйте прямо из студии</h3>
                <p>Отправьте готовый ролик в YouTube Shorts из интерфейса, без скачивания и лишних шагов.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--paper section--tight section--landing-refine" aria-labelledby="landing-refine-heading">
          <div className="container landing-refine-layout">
            <div className="landing-refine-copy">
              <div className="section-head landing-refine-head">
                <p className="eyebrow eyebrow--dark">ТОЧНАЯ ДОВОДКА В СТУДИИ</p>
                <h2 id="landing-refine-heading">
                  <span className="landing-refine-head__line">Доведите каждый сегмент</span>
                  <span className="landing-refine-head__line">до финального качества</span>
                </h2>
                <p>
                  Первый драфт собирает AI, финальную точность даёте вы: правьте текст, визуал и субтитры сцена за
                  сценой, пока ролик не будет выглядеть именно так, как нужно.
                </p>
              </div>

              <div className="landing-refine-metrics" aria-hidden="true">
                {landingRefineMetrics.map((metric) => (
                  <article className="landing-refine-metric" key={metric.label}>
                    <strong>{metric.value}</strong>
                    <span>{metric.label}</span>
                  </article>
                ))}
              </div>

              <div className="landing-refine-proof-list">
                {landingRefineProofs.map((proof, index) => (
                  <article className="landing-refine-proof" key={proof.title}>
                    <span className="landing-refine-proof__index">{String(index + 1).padStart(2, "0")}</span>
                    <div className="landing-refine-proof__copy">
                      <span className="landing-refine-proof__label">{proof.label}</span>
                      <h3>{proof.title}</h3>
                      <p>{proof.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="landing-refine-board" aria-hidden="true">
              <div className="landing-refine-board__shell">
                <div className="landing-refine-board__editor">
                  <div className="studio-segment-editor__stage">
                    <div className="studio-segment-editor__carousel">
                      <button className="studio-segment-editor__arrow" type="button" tabIndex={-1} aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      <div className="studio-segment-editor__cards">
                        {landingRefineCarouselCards.map((card) => {
                          const isActiveCard = card.slotClass === "is-active";

                          return (
                            <article
                              className={`studio-segment-editor__card ${card.slotClass}${card.isEdited ? " is-visual-edited" : ""}`}
                              key={card.number}
                            >
                              <div className="studio-segment-editor__card-media">
                                <div className={`landing-refine-board__editor-shot landing-refine-board__editor-shot--${card.tone}`}>
                                  {card.media === "hero" ? (
                                    <img
                                      className="landing-refine-board__editor-shot-image"
                                      src={heroPreviewImageSrc}
                                      alt=""
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  ) : null}
                                </div>

                                {isActiveCard ? (
                                  <>
                                    <div className="studio-segment-editor__card-visual-meta">
                                      <span className="studio-segment-editor__card-visual-status">Визуал изменен</span>
                                      <div className="studio-segment-editor__card-visual-actions">
                                        <button
                                          className="studio-segment-editor__card-visual-edit"
                                          type="button"
                                          tabIndex={-1}
                                          aria-hidden="true"
                                        >
                                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                            <path
                                              d="M12 20h9"
                                              stroke="currentColor"
                                              strokeWidth="1.8"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                            />
                                            <path
                                              d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
                                              stroke="currentColor"
                                              strokeWidth="1.8"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                            />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>

                                    <div className="landing-refine-board__editor-caption">
                                      <span>Текст сегмента</span>
                                      <strong>Каждая сцена может работать точнее</strong>
                                    </div>
                                  </>
                                ) : null}

                                <div className={`studio-segment-editor__card-overlay${isActiveCard ? " is-active" : ""}`}>
                                  {isActiveCard ? (
                                    <div className="studio-segment-editor__card-overlay-footer">
                                      <div className="studio-segment-editor__card-overlay-main">
                                        <div className="studio-segment-editor__card-copy">
                                          <strong>Сегмент {card.number}</strong>
                                          <span>{card.time}</span>
                                        </div>
                                      </div>
                                      <div className="studio-segment-editor__card-footer-actions">
                                        <small className="studio-segment-editor__card-badge">{card.source}</small>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="studio-segment-editor__card-overlay-main">
                                      <div className="studio-segment-editor__card-copy">
                                        <strong>Сегмент {card.number}</strong>
                                        <span>{card.time}</span>
                                      </div>
                                      <small className="studio-segment-editor__card-badge">{card.source}</small>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>

                      <button className="studio-segment-editor__arrow" type="button" tabIndex={-1} aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--stone section--tight section--publish-regular" aria-labelledby="publish-regular-heading">
          <div className="container">
            <div className="section-head section-head--center">
              <h2 id="publish-regular-heading">Публикуйте Shorts регулярно</h2>
              <p>И развивайте канал без монтажа и поиска идей</p>
            </div>
          </div>
        </section>

        <section className="section section--paper section--tight section--examples-cta" aria-labelledby="examples-cta-heading">
          <div className="container">
            <div className="section-head section-head--center">
              <h2 id="examples-cta-heading">Посмотрите примеры Shorts</h2>
              <p>Выберите идею и создайте такое же видео за минуту</p>
              <div className="landing-examples-cta__actions">
                <Link className="btn btn--primary btn--premium-cta route-button" to="/examples">
                  <span className="btn--premium-cta__label">👉 Смотреть примеры</span>
                  <svg
                    className="btn--premium-cta__arrow"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--dark" id="pricing">
          <div className="container pricing-shell">
            <div className="pricing-shell__copy">
              <p className="eyebrow">ТАРИФЫ ADSHORTS AI</p>
              <h2>Выберите тариф под свой объём Shorts</h2>
              <p>
                Все тарифы работают через баланс кредитов в веб-студии. 1 видео списывает 10 кредитов: START подходит
                для теста, PRO для регулярного выпуска, ULTRA для масштабирования.
              </p>

              <div className="pricing-shell__actions">
                <button className="btn btn--primary btn--premium-cta route-button" type="button" onClick={openPrimaryFlow}>
                  <span className="btn--premium-cta__label">Создать Shorts бесплатно</span>
                  <svg
                    className="btn--premium-cta__arrow"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <a
                className="pricing-shell__micro-link"
                href="https://t.me/AdShortsAIBot"
                target="_blank"
                rel="noopener noreferrer"
              >
                Открыть бота
              </a>
            </div>

            <div className="plan-grid">
              <article className="plan-card">
                <span className="plan-card__label">START</span>
                <strong>390 ₽</strong>
                <h3>50 кредитов</h3>
                <p>До 5 видео для первого запуска и проверки идеи.</p>
                <ul className="plan-card__list">
                  <li>Быстрый старт без лишних настроек</li>
                  <li>Сценарий, озвучка и визуал в одном потоке</li>
                  <li>Подходит для первого теста гипотезы</li>
                </ul>
              </article>

              <article className="plan-card plan-card--accent">
                <span className="plan-card__label">PRO</span>
                <strong>1 490 ₽</strong>
                <h3>250 кредитов</h3>
                <p>До 25 видео для стабильного контент-потока.</p>
                <ul className="plan-card__list">
                  <li>Регулярный выпуск Shorts без ручной сборки</li>
                  <li>Приоритетная генерация</li>
                  <li>Можно докупать кредиты</li>
                </ul>
              </article>

              <article className="plan-card">
                <span className="plan-card__label">ULTRA</span>
                <strong>4 990 ₽</strong>
                <h3>1000 кредитов</h3>
                <p>До 100 видео для серийного производства и команд.</p>
                <ul className="plan-card__list">
                  <li>Максимальный объём под масштабирование</li>
                  <li>Максимальный приоритет</li>
                  <li>Ранний доступ к новым функциям</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--paper section--tight" id="product">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow eyebrow--dark">ВСЁ ДЛЯ SHORTS В ОДНОМ СЕРВИСЕ</p>
              <h2>Превращайте идею в готовый Shorts в одном сервисе.</h2>
              <p>
                AdShorts AI автоматически создаёт сценарий, озвучку, визуал и субтитры. Вы получаете готовый
                вертикальный ролик без монтажа, сложных программ и переключения между сервисами.
              </p>
            </div>

            <div className="capability-grid">
              <article className="capability capability--lead">
                <h3>От идеи до готового Shorts — в одном сервисе</h3>
                <p>
                  Сценарий, озвучка, видеофон, субтитры и экспорт собираются в одном сервисе, чтобы вы могли создавать
                  готовые short-видео без монтажа и без сложных программ.
                </p>

                <div className="capability__list">
                  <span>Hook и структура</span>
                  <span>AI Сценарий</span>
                  <span>Визуал</span>
                  <span>Озвучка</span>
                  <span>Субтитры</span>
                  <span>Музыка</span>
                  <span>Автопубликация</span>
                </div>
              </article>

              <article className="capability">
                <span className="capability__label">HOOK И СТРУКТУРА</span>
                <h3>Сильное начало и понятная структура ролика</h3>
                <p>
                  Хук в первые секунды, правильный ритм и логичная структура, чтобы ролик удерживал внимание до конца.
                </p>
              </article>

              <article className="capability">
                <span className="capability__label">AI СЦЕНАРИЙ</span>
                <h3>Структура для первых секунд и удержания внимания</h3>
                <p>
                  Сильное начало, правильный ритм и логичный сценарий, оптимизированный для коротких вертикальных
                  видео.
                </p>
              </article>

              <article className="capability">
                <span className="capability__label">ВИЗУАЛ</span>
                <h3>Готовые сцены и единый стиль роликов</h3>
                <p>
                  Сцены, динамика и визуальный стиль создаются автоматически, чтобы ролики выглядели целостно и
                  профессионально.
                </p>
              </article>

              <article className="capability">
                <span className="capability__label">ОЗВУЧКА</span>
                <h3>Озвучка, которая звучит естественно</h3>
                <p>
                  Натуральное звучание, разные языки и быстрая настройка голоса, чтобы озвучка подходила под стиль
                  ролика.
                </p>
              </article>

              <article className="capability">
                <span className="capability__label">Субтитры</span>
                <h3>Субтитры с акцентами и правильным ритмом</h3>
                <p>
                  Выделение важных фраз, удобная скорость чтения и формат, который хорошо смотрится на мобильных
                  экранах.
                </p>
              </article>

              <article className="capability">
                <span className="capability__label">МУЗЫКА</span>
                <h3>Музыка, подходящая под ритм ролика</h3>
                <p>
                  Фоновая музыка подбирается автоматически, чтобы ролик звучал динамично и удерживал внимание.
                </p>
              </article>

              <article className="capability">
                <span className="capability__label">АВТОПУБЛИКАЦИЯ</span>
                <h3>Публикуйте сразу в YouTube Shorts</h3>
                <p>
                  Готовый ролик можно отправить в YouTube прямо из студии, без скачивания и без ручной загрузки.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--stone" id="history">
          <div className="container trust-shell">
            <div className="trust-shell__copy">
              <p className="eyebrow eyebrow--dark">НАДЁЖНОСТЬ И СКОРОСТЬ</p>
              <h2>Результат за минуты, качество — на уровне продакшна.</h2>
              <p>
                AdShorts AI помогает быстро выпускать short-видео без потери качества: от идеи и сценария до готового
                ролика в одном сервисе.
              </p>
            </div>

            <div className="trust-stats">
              <article className="stat-card">
                <strong>50,000+</strong>
                <span>создателей и маркетологов</span>
              </article>
              <article className="stat-card">
                <strong>12M+</strong>
                <span>сгенерированных Shorts</span>
              </article>
              <article className="stat-card">
                <strong>4.9/5</strong>
                <span>средняя оценка пользователей</span>
              </article>
              <article className="stat-card">
                <strong>~1 мин</strong>
                <span>до первого готового ролика</span>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--paper section--guides" id="guides">
          <div className="container guides-strip">
            <div className="guides-strip__copy">
              <p className="eyebrow eyebrow--dark">ГАЙДЫ</p>
              <h2>Полезные материалы привлекают трафик и подводят к продукту.</h2>
            </div>

            <div className="guides-strip__cards">
              <a
                className="guide-card route-guide-link"
                href="http://127.0.0.1:4173/shorts-guides/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="guide-card__label">БАЗА</span>
                <h3>Все гайды по Shorts в одном месте</h3>
                <p>Единая точка входа: идеи, структура ролика, удержание, оформление и публикация.</p>
              </a>

              <a
                className="guide-card route-guide-link"
                href="http://127.0.0.1:4173/kak-sdelat-huk-v-shorts/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="guide-card__label">ХУК</span>
                <h3>Как сделать сильный первый экран</h3>
                <p>Что удерживает внимание и снижает вероятность свайпа.</p>
              </a>

              <a
                className="guide-card route-guide-link"
                href="http://127.0.0.1:4173/subtitry-dlya-shorts-avtomatom/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="guide-card__label">СУБТИТРЫ</span>
                <h3>Автоматические субтитры</h3>
                <p>Как субтитры помогают коротким видео работать даже без звука.</p>
              </a>
            </div>

            <a
              className="guides-strip__cta route-linkbtn"
              href="http://127.0.0.1:4173/shorts-guides/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Все материалы
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div>
            <p>App staging route for AdShorts AI.</p>
            <p>© 2026 AdShorts AI</p>
          </div>

          <div className="footer__links">
            <a href="/app">Web studio</a>
            <a href="#guides">Guides</a>
            <a href="https://t.me/AdShortsAIBot" target="_blank" rel="noopener noreferrer">
              Telegram bot
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
