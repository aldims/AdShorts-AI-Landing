import { useCallback, useEffect, useRef } from "react";
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
const heroChips = ["Визуал", "Озвучка", "Субтитры", "Музыка", "Язык"];
const heroPreviewImageSrc = "/hero_image.webp";
const landingRefineCarouselImageSrc = "/t1.png";
const landingRefineProofs = [
  {
    label: "ГЕНЕРАЦИЯ",
    title: "Генерация по описанию",
    description: "Создавайте сцены с помощью AI.",
  },
  {
    label: "АНИМАЦИЯ",
    title: "Анимация сцен",
    description: "Добавляйте движение и оживляйте изображения.",
  },
  {
    label: "КАЧЕСТВО",
    title: "Улучшение качества",
    description: "Делайте видео чётче и детализированнее.",
  },
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
const landingGuidesIndexHref = "https://adshortsai.com/shorts-guides/";
const landingGuideCards = [
  {
    label: "БАЗА",
    title: "Все гайды по Shorts в одном месте",
    description: "Единая точка входа: идеи, структура ролика, удержание, оформление и публикация.",
    href: landingGuidesIndexHref,
  },
  {
    label: "ХУК",
    title: "Как сделать сильный первый экран",
    description: "Что удерживает внимание и снижает вероятность свайпа в первые секунды ролика.",
    href: "https://adshortsai.com/kak-sdelat-huk-v-shorts/",
  },
  {
    label: "СУБТИТРЫ",
    title: "Автоматические субтитры",
    description: "Как субтитры помогают коротким видео работать даже без звука и не терять удержание.",
    href: "https://adshortsai.com/subtitry-dlya-shorts-avtomatom/",
  },
] as const;
export function LandingPage({ session, workspaceProfile = null, onOpenSignup, onOpenSignin, onLogout, onOpenWorkspace }: Props) {
  const previewRef = useRef<HTMLDivElement>(null);
  const revealRootRef = useRef<HTMLElement>(null);
  const statsObserverRef = useRef<IntersectionObserver | null>(null);
  const accountPlanLabel = String(workspaceProfile?.plan ?? "").trim().toUpperCase() || "…";

  const animateCounter = useCallback((el: HTMLElement, target: string) => {
    const numericMatch = target.match(/[\d,.]+/);
    if (!numericMatch) return;

    const raw = numericMatch[0];
    const hasComma = raw.includes(",");
    const numericValue = parseFloat(raw.replace(/,/g, ""));
    const prefix = target.slice(0, target.indexOf(raw));
    const suffix = target.slice(target.indexOf(raw) + raw.length);
    const duration = 1200;
    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = numericValue * eased;

      let formatted: string;
      if (hasComma) {
        formatted = Math.round(current).toLocaleString("en-US");
      } else if (Number.isInteger(numericValue)) {
        formatted = String(Math.round(current));
      } else {
        formatted = current.toFixed(1);
      }

      el.textContent = `${prefix}${formatted}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target;
      }
    };

    requestAnimationFrame(step);
  }, []);

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

    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!nodes.length) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      nodes.forEach((n) => n.classList.add("is-visible"));
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
      { threshold: 0.08, rootMargin: "0px 0px -50px 0px" },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = revealRootRef.current;
    if (!root) return undefined;

    const carouselNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-carousel-reveal]"));
    if (!carouselNodes.length) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      carouselNodes.forEach((n) => n.classList.add("is-revealed"));
      return undefined;
    }

    const carouselObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          carouselObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );

    carouselNodes.forEach((n) => carouselObserver.observe(n));
    return () => carouselObserver.disconnect();
  }, []);

  useEffect(() => {
    const root = revealRootRef.current;
    if (!root) return undefined;

    const statCards = Array.from(root.querySelectorAll<HTMLElement>(".stat-card"));
    if (!statCards.length) return undefined;

    const targets = new Map<HTMLElement, string>();
    statCards.forEach((card) => {
      const strong = card.querySelector("strong");
      if (strong) targets.set(card, strong.textContent ?? "");
    });

    if (typeof IntersectionObserver === "undefined") return undefined;

    statsObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const card = entry.target as HTMLElement;
          const strong = card.querySelector<HTMLElement>("strong");
          const target = targets.get(card);
          if (strong && target) {
            card.classList.add("is-counted");
            animateCounter(strong, target);
          }
          statsObserverRef.current?.unobserve(card);
        });
      },
      { threshold: 0.3 },
    );

    statCards.forEach((card) => statsObserverRef.current?.observe(card));

    return () => statsObserverRef.current?.disconnect();
  }, [animateCounter]);

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
          </div>
        </div>
      </header>

      <main ref={revealRootRef}>
        <section className="hero">
          {/* Background scene */}
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
            {/* Left: copy */}
            <div className="hero__copy">
              <div className="hero__badge">
                <span className="hero__badge-dot" aria-hidden="true"></span>
                Создание Shorts с AI
              </div>

              <h1>
                <span className="hero__title-line1">
                  <span className="hero__title-highlight">Shorts за&nbsp;1&nbsp;минуту</span>
                </span>
                <span className="hero__title-line2">в один клик.</span>
              </h1>

              <p className="hero__lead">
                Введите идею — остальное сделает AdShorts AI.
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
                <li>Без монтажа</li>
                <li>Полностью автоматически</li>
                <li>Готово к публикации</li>
              </ul>

              <div className="hero__service-pills" aria-label="Что входит в ролик">
                <span className="hero__service-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zM4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  AI сценарий
                </span>
                <span className="hero__service-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                  Визуал
                </span>
                <span className="hero__service-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M12 1v22M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M15 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4"/></svg>
                  Озвучка
                </span>
                <span className="hero__service-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M4 6h16M4 10h16M4 14h10"/></svg>
                  Субтитры
                </span>
                <span className="hero__service-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  Музыка
                </span>
              </div>
            </div>

            {/* Right: phone mockup */}
            <aside className="hero-live-preview" aria-label="Превью студии">
              <div className="hero-live-preview__perspective" ref={previewRef}>
                <div className="hero-live-preview__glow" aria-hidden="true"></div>
                <div className="hero-live-preview__reflection" aria-hidden="true"></div>
                <div className="hero-live-preview__frame">
                  <div className="hero-live-preview__video">
                    <img
                      className="hero-live-preview__image"
                      src={heroPreviewImageSrc}
                      alt="Интерфейс AdShorts AI"
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                    />
                    <span className="hero-live-preview__image-shade" aria-hidden="true"></span>
                    {/* Overlay label */}
                    <div className="hero-live-preview__video-label" aria-hidden="true">
                      <span className="hero-live-preview__video-label-dot"></span>
                      Генерация…
                    </div>
                  </div>
                  <div className="hero-live-preview__prompt">
                    <span className="hero-live-preview__prompt-text">{heroPromptText}</span>
                    <button className="hero-live-preview__btn" type="button" aria-label="Generate" tabIndex={-1}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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

          {/* Trust strip */}
          <div className="container hero__trust">
            <span className="hero__trust-label">ИДЕАЛЬНО ДЛЯ</span>
            <div className="hero__trust-list">
              <span>YouTube Shorts</span>
              <span>Instagram Reels</span>
              <span>TikTok</span>
              <span>Авторы</span>
              <span>Бренды</span>
              <span>Агентства</span>
            </div>
          </div>
        </section>

        <section className="section lp-section lp-section--a lp-section--workflow">
          <div className="container">
            <div className="lp-section-head lp-section-head--left" data-reveal="">
              <p className="lp-eyebrow">КАК ЭТО РАБОТАЕТ</p>
              <h2>От идеи до готового Shorts за 3 шага</h2>
              <p>
                Введите идею — AI создаст сценарий, озвучку и видео. Готовый ролик сразу готов для публикации.
              </p>
            </div>

            <div className="steps-grid">
              <article className="step-card" data-reveal="" data-reveal-delay="1">
                <div className="step-card__num">01</div>
                <h3>Введите идею</h3>
                <p>Напишите, о чём должен быть ролик.</p>
              </article>

              <article className="step-card" data-reveal="" data-reveal-delay="2">
                <div className="step-card__num">02</div>
                <h3>Получите готовый Shorts</h3>
                <p>Видео создаётся автоматически: визуал, озвучка и субтитры.</p>
              </article>

              <article className="step-card" data-reveal="" data-reveal-delay="3">
                <div className="step-card__num">03</div>
                <h3>Опубликуйте в один клик</h3>
                <p>Отправьте ролик в YouTube Shorts прямо из сервиса.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section lp-section lp-section--b section--tight section--landing-refine" aria-labelledby="landing-refine-heading">
          <div className="container landing-refine-layout">
            <div className="landing-refine-copy">
              <div className="lp-section-head lp-section-head--left landing-refine-head" data-reveal="">
                <p className="lp-eyebrow">ТОЧНАЯ ДОВОДКА В СТУДИИ</p>
                <h2 id="landing-refine-heading">Доведите Shorts до идеала</h2>
                <p>Изменяйте любой сегмент: генерируйте, анимируйте, улучшайте или загружайте свой контент</p>
              </div>

              <div className="landing-refine-proof-list">
                {landingRefineProofs.map((proof, index) => (
                  <article className="landing-refine-proof" key={proof.title} data-reveal="" data-reveal-delay={String(index + 1)}>
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
              <div className="landing-refine-board__shell" data-carousel-reveal="">
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
                                      src={landingRefineCarouselImageSrc}
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
                                      <strong>Редактируйте текст сцены прямо на карточке сегмента</strong>
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

        <section className="section lp-section lp-section--a section--tight section--publish-regular" aria-labelledby="publish-regular-heading">
          <div className="container">
            <div className="lp-section-head lp-section-head--left" data-reveal="">
              <p className="lp-eyebrow">РЕГУЛЯРНОСТЬ</p>
              <h2 id="publish-regular-heading">Публикуйте Shorts регулярно</h2>
              <p>Развивайте канал без монтажа и поиска идей</p>
            </div>
            <div className="landing-publish-regular">
              <div className="steps-grid landing-publish-regular__grid">
                <article className="step-card landing-publish-regular__card" data-reveal="" data-reveal-delay="1">
                  <div className="landing-publish-regular__card-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <h3>Идеи и контент-план с AI</h3>
                  <p>Введите тему — AI предложит идеи и готовые сценарии для регулярных Shorts.</p>
                </article>

                <article className="step-card landing-publish-regular__card" data-reveal="" data-reveal-delay="2">
                  <div className="landing-publish-regular__card-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                  </div>
                  <h3>Быстрое создание Shorts</h3>
                  <p>Создавайте готовые Shorts без лишних действий и задержек.</p>
                </article>

                <article className="step-card landing-publish-regular__card" data-reveal="" data-reveal-delay="3">
                  <div className="landing-publish-regular__card-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </div>
                  <h3>Мгновенная публикация</h3>
                  <p>Готовый ролик отправляется в YouTube Shorts прямо из студии.</p>
                </article>
              </div>

              <div className="landing-publish-regular__actions">
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
            </div>
          </div>
        </section>

        <section className="section lp-section lp-section--b section--tight section--examples-cta" aria-labelledby="examples-cta-heading">
          <div className="container">
            <div className="lp-section-head lp-section-head--left" data-reveal="">
              <p className="lp-eyebrow">ПРИМЕРЫ</p>
              <h2 id="examples-cta-heading">Вдохновляйтесь примерами Shorts</h2>
              <p>Используйте готовые шаблоны, чтобы создавать похожие видео</p>
            </div>

            <div className="landing-examples-cta">
              <div className="landing-examples-cta__grid">
                <Link className="landing-examples-cta__card" to="/examples?filter=ads" aria-label="Открыть примеры Shorts: Рекламные Shorts" data-reveal="" data-reveal-delay="1">
                  <div className="landing-examples-cta__icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                  </div>
                  <h3>Рекламные Shorts</h3>
                  <p>Продвигайте продукт или услугу и ведите зрителя к действию.</p>
                </Link>

                <Link className="landing-examples-cta__card" to="/examples?filter=growth" aria-label="Открыть примеры Shorts: Shorts для роста канала" data-reveal="" data-reveal-delay="2">
                  <div className="landing-examples-cta__icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
                    </svg>
                  </div>
                  <h3>Shorts для роста канала</h3>
                  <p>Набирайте просмотры и привлекайте новых подписчиков.</p>
                </Link>

                <Link className="landing-examples-cta__card" to="/examples?filter=expert" aria-label="Открыть примеры Shorts: Экспертные Shorts" data-reveal="" data-reveal-delay="3">
                  <div className="landing-examples-cta__icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/><line x1="12" y1="12" x2="12" y2="14"/>
                    </svg>
                  </div>
                  <h3>Экспертные Shorts</h3>
                  <p>Делитесь знаниями и формируйте доверие аудитории.</p>
                </Link>
              </div>

              <div className="landing-examples-cta__actions">
                <Link className="btn btn--primary btn--premium-cta route-button" to="/examples">
                  <span className="btn--premium-cta__label">Смотреть примеры</span>
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

        <section className="section lp-section lp-section--pricing" id="pricing">
          <div className="container">
            <div className="lp-section-head lp-section-head--left" data-reveal="">
              <p className="lp-eyebrow">ТАРИФЫ</p>
              <h2>Создавайте Shorts в любом масштабе</h2>
              <p>От первых видео до стабильного потока и роста канала</p>
            </div>

            <div className="plan-grid">
              <article className="plan-card" data-reveal="" data-reveal-delay="1">
                <span className="plan-card__label">START</span>
                <strong>390 ₽</strong>
                <h3>50 кредитов</h3>
                <p>До 5 видео — для первого запуска и проверки идеи.</p>
                <div className="plan-card__divider" aria-hidden="true" />
                <ul className="plan-card__features">
                  <li>5 готовых Shorts</li>
                  <li>Сценарий + озвучка + субтитры</li>
                  <li>Без водяного знака</li>
                </ul>
              </article>

              <article className="plan-card plan-card--accent" data-reveal="" data-reveal-delay="2">
                <span className="plan-card__label">PRO</span>
                <strong>1 490 ₽</strong>
                <h3>250 кредитов</h3>
                <p>До 25 видео — для стабильного контент-потока.</p>
                <div className="plan-card__divider" aria-hidden="true" />
                <ul className="plan-card__features">
                  <li>25 готовых Shorts</li>
                  <li>Приоритетная генерация</li>
                  <li>Автопубликация в YouTube</li>
                </ul>
              </article>

              <article className="plan-card" data-reveal="" data-reveal-delay="3">
                <span className="plan-card__label">ULTRA</span>
                <strong>4 990 ₽</strong>
                <h3>1000 кредитов</h3>
                <p>До 100 видео — для серийного производства и команд.</p>
                <div className="plan-card__divider" aria-hidden="true" />
                <ul className="plan-card__features">
                  <li>100 готовых Shorts</li>
                  <li>Командный доступ</li>
                  <li>API интеграция</li>
                </ul>
              </article>
            </div>

            <div className="lp-section-head__cta lp-section-head__cta--pricing-under">
              <Link className="btn btn--primary btn--premium-cta route-button" to="/pricing">
                <span className="btn--premium-cta__label">Все тарифы</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        <section className="section lp-section lp-section--a" id="history">
          <div className="container trust-shell">
            <div className="trust-shell__copy" data-reveal="">
              <p className="lp-eyebrow">НАДЁЖНОСТЬ И СКОРОСТЬ</p>
              <h2>Результат за минуты, качество — на уровне продакшна</h2>
              <p>
                AdShorts AI помогает быстро выпускать short-видео без потери качества: от идеи и сценария до готового
                ролика в одном сервисе.
              </p>
            </div>

            <div className="trust-stats">
              <article className="stat-card" data-reveal="" data-reveal-delay="1">
                <strong>50,000+</strong>
                <span>создателей и маркетологов</span>
              </article>
              <article className="stat-card" data-reveal="" data-reveal-delay="2">
                <strong>12M+</strong>
                <span>сгенерированных Shorts</span>
              </article>
              <article className="stat-card" data-reveal="" data-reveal-delay="3">
                <strong>4.9/5</strong>
                <span>средняя оценка пользователей</span>
              </article>
              <article className="stat-card" data-reveal="" data-reveal-delay="4">
                <strong>~1 мин</strong>
                <span>до первого готового ролика</span>
              </article>
            </div>
          </div>
        </section>

        <section className="section lp-section lp-section--b section--guides" id="guides" aria-labelledby="guides-heading">
          <div className="container guides-strip">
            <div className="lp-section-head lp-section-head--left" data-reveal="">
              <p className="lp-eyebrow">ГАЙДЫ</p>
              <h2 id="guides-heading">Полезные материалы по созданию Shorts</h2>
              <p>
                Короткие разборы по хуку, структуре и оформлению помогают быстрее понять, как собрать Shorts,
                которые удерживают внимание и доводят зрителя до CTA.
              </p>
            </div>

            <div className="guides-strip__cards">
              {landingGuideCards.map((guide, index) => (
                <a
                  key={guide.href}
                  className="guide-card route-guide-link"
                  href={guide.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-reveal=""
                  data-reveal-delay={String(index + 1)}
                >
                  <div className="guide-card__meta">
                    <span className="guide-card__label">{guide.label}</span>
                    <span className="guide-card__icon" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M7 17 17 7M9 7h8v8"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                  <h3>{guide.title}</h3>
                  <p>{guide.description}</p>
                </a>
              ))}
            </div>

            <a
              className="guides-strip__cta route-linkbtn"
              href={landingGuidesIndexHref}
              target="_blank"
              rel="noopener noreferrer"
              data-reveal=""
            >
              Все материалы
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{marginLeft: 8}}>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <Link className="footer__brand-link" to="/" aria-label="AdShorts AI">
              <img src="/logo.png" alt="" width="36" height="36" style={{borderRadius: 10}} />
              <span style={{color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: "0.9rem"}}>AdShorts AI</span>
            </Link>
          </div>

          <div className="footer__links">
            <a href="mailto:support@adshortsai.com">Контакты: support@adshortsai.com</a>
            <a href="https://adshortsai.com/terms-of-use/" target="_blank" rel="noopener noreferrer">Условия использования</a>
            <a href="https://adshortsai.com/terms/" target="_blank" rel="noopener noreferrer">Пользовательское соглашение</a>
            <a href="https://adshortsai.com/privacy/" target="_blank" rel="noopener noreferrer">Политика конфиденциальности</a>
            <a href="https://adshortsai.com/data-deletion.html" target="_blank" rel="noopener noreferrer">Удаление данных</a>
            <a href="https://adshortsai.com/en/" target="_blank" rel="noopener noreferrer">English</a>
          </div>

          <p className="footer__copyright">© AdShorts AI</p>
        </div>
      </footer>
    </div>
  );
}
