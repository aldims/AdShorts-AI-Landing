import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AccountMenuButton } from "../components/AccountMenuButton";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { PrimarySiteNav } from "../components/PrimarySiteNav";
import { SiteHeaderWorkspaceStatus } from "../components/SiteHeaderWorkspaceStatus";
import { defineMessages, useLocale, type Locale } from "../lib/i18n";
import { writeStudioEntryIntent, type StudioEntryIntentSection } from "../lib/studio-entry-intent";
import { openYooKassaPaymentWidget } from "../lib/yookassa-widget";

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
};

const heroPreviewImageSrc = "/hero_image.webp";
const landingRefineCarouselImageSrc = "/t1.png";
const heroPreviewMaxScroll = 600;

const landingMessages = defineMessages({
  accountSignIn: { ru: "Войти", en: "Sign in" },
  autoPublish: { ru: "Автопубликация в YouTube", en: "YouTube auto-publishing" },
  checkoutOpening: { ru: "Открываем оплату...", en: "Opening checkout..." },
  chooseStart: { ru: "Выбрать START", en: "Choose START" },
  choosePro: { ru: "Выбрать PRO", en: "Choose PRO" },
  chooseUltra: { ru: "Выбрать ULTRA", en: "Choose ULTRA" },
  footerEnglish: { ru: "English", en: "Русский" },
  guidesAll: { ru: "Все материалы", en: "All guides" },
  heroAlt: { ru: "Интерфейс AdShorts AI", en: "AdShorts AI interface" },
  heroAria: {
    ru: "Shorts / Reels / TikTok за 1 минуту. В один клик.",
    en: "Shorts / Reels / TikTok in 1 minute. In one click.",
  },
  heroCta: { ru: "Создать Shorts бесплатно", en: "Create Shorts for free" },
  heroLine2: { ru: "за\u00a01\u00a0минуту. В один клик.", en: "in\u00a01\u00a0minute. In one click." },
  heroPreview: { ru: "Превью студии", en: "Studio preview" },
  heroPrompt: {
    ru: "Как нейросети меняют маркетинг в 2026",
    en: "How AI changes marketing in 2026",
  },
  heroSub: {
    ru: "Введите идею — получите готовый Shorts с озвучкой, субтитрами и визуалом",
    en: "Enter an idea — get a finished Shorts with voiceover, subtitles and visuals",
  },
  heroFeatureChannelGrowth: { ru: "Рост канала", en: "Channel growth" },
  heroFeatureEffortlessContent: { ru: "Контент без усилий", en: "Effortless content" },
  heroFeatureNewClients: { ru: "Новые клиенты", en: "New clients" },
  noEditing: { ru: "Без монтажа", en: "No editing" },
  noWatermark: { ru: "Без водяного знака", en: "No watermark" },
  planPopular: { ru: "Популярный", en: "Popular" },
  planScaleEyebrow: { ru: "ТАРИФЫ", en: "PRICING" },
  planScaleHeading: { ru: "Создавайте Shorts в любом масштабе", en: "Create Shorts at any scale" },
  planScaleSub: {
    ru: "От первых видео до стабильного потока и роста канала",
    en: "From first videos to a steady content flow and channel growth",
  },
  priorityGeneration: { ru: "Приоритетная генерация", en: "Priority generation" },
  readyToPublish: { ru: "Готово к публикации", en: "Ready to publish" },
  refineEyebrow: { ru: "ПОЛНЫЙ КОНТРОЛЬ", en: "FULL CONTROL" },
  refineHeading: { ru: "Доведите Shorts до идеала", en: "Refine every Shorts until it works" },
  refineSub: {
    ru: "Изменяйте любой сегмент: генерируйте, дорисовывайте, анимируйте, улучшайте или загружайте свой контент",
    en: "Edit any segment: generate, extend, animate, improve or upload your own content",
  },
  regularEyebrow: { ru: "РЕГУЛЯРНОСТЬ", en: "CONSISTENCY" },
  regularHeading: { ru: "Публикуйте Shorts регулярно", en: "Publish Shorts consistently" },
  regularSub: {
    ru: "Создавайте готовые ролики за минуты — от идеи до публикации в одном месте",
    en: "Create finished videos in minutes — from idea to publishing in one place",
  },
  seeExamples: { ru: "Смотреть примеры", en: "View examples" },
  segment: { ru: "Сегмент", en: "Segment" },
  segmentText: { ru: "Текст сегмента", en: "Segment text" },
  segmentTextStrong: {
    ru: "Редактируйте текст сцены прямо на карточке сегмента",
    en: "Edit scene text directly on the segment card",
  },
  used: { ru: "Использован", en: "Used" },
  visualChanged: { ru: "Визуал изменен", en: "Visual updated" },
  workflowEyebrow: { ru: "КАК ЭТО РАБОТАЕТ", en: "HOW IT WORKS" },
  workflowHeading: { ru: "От идеи до готового Shorts за 3 шага", en: "From idea to finished Shorts in 3 steps" },
});

function getHeroPreviewTransform(scrollY: number) {
  const progress = Math.min(scrollY / heroPreviewMaxScroll, 1);
  const rotateY = -25 + progress * 25;
  const rotateX = 12 - progress * 12;
  const rotateZ = 3 - progress * 3;
  const translateY = progress * -40;

  return `rotateY(${rotateY}deg) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) translateY(${translateY}px)`;
}

const landingRefineProofs: Record<Locale, Array<{ label: string; title: string; description: string }>> = {
  ru: [
    {
      label: "ГЕНЕРАЦИЯ",
      title: "Генерация по описанию",
      description: "Создавайте сцены с помощью AI.",
    },
    {
      label: "ДОРИСОВКА",
      title: "Изменение сцен",
      description: "Дорисовывайте и меняйте отдельные элементы в сцене.",
    },
    {
      label: "АНИМАЦИЯ",
      title: "Анимация сцен",
      description: "Добавляйте движение и оживляйте изображения.",
    },
  ],
  en: [
    {
      label: "GENERATION",
      title: "Generate from a brief",
      description: "Create scenes with AI.",
    },
    {
      label: "EDITING",
      title: "Change scenes",
      description: "Extend and adjust individual scene elements.",
    },
    {
      label: "ANIMATION",
      title: "Animate scenes",
      description: "Add movement and bring images to life.",
    },
  ],
};

const landingRefineCarouselCards: Record<Locale, Array<{
  number: string;
  title: string;
  time: string;
  source: string;
  tone: string;
  media: string;
  slotClass: string;
  isEdited: boolean;
}>> = {
  ru: [
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
  ],
  en: [
    {
      number: "02",
      title: "Argument",
      time: "00:05 - 00:10",
      source: "Stock",
      tone: "argument",
      media: "hero",
      slotClass: "is-side is-left",
      isEdited: false,
    },
    {
      number: "03",
      title: "Final emphasis",
      time: "00:11 - 00:17",
      source: "Custom",
      tone: "accent",
      media: "hero",
      slotClass: "is-active",
      isEdited: true,
    },
    {
      number: "04",
      title: "CTA",
      time: "00:18 - 00:22",
      source: "AI photo",
      tone: "cta",
      media: "hero",
      slotClass: "is-side is-right",
      isEdited: false,
    },
  ],
};

const landingGuidesIndexHref = "/shorts-guides/";
const landingGuideCards: Record<Locale, Array<{ label: string; title: string; description: string; href: string }>> = {
  ru: [
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
      href: "/kak-sdelat-huk-v-shorts/",
    },
    {
      label: "СУБТИТРЫ",
      title: "Автоматические субтитры",
      description: "Как субтитры помогают коротким видео работать даже без звука и не терять удержание.",
      href: "/subtitry-dlya-shorts-avtomatom/",
    },
  ],
  en: [
    {
      label: "BASE",
      title: "All Shorts guides in one place",
      description: "A single entry point for ideas, structure, retention, packaging and publishing.",
      href: "/shorts-guides/",
    },
    {
      label: "HOOK",
      title: "How to create a strong first screen",
      description: "What keeps attention and reduces swipes in the first seconds of a video.",
      href: "/how-to-create-a-hook-in-shorts/",
    },
    {
      label: "SUBTITLES",
      title: "Automatic subtitles",
      description: "How subtitles help short videos work without sound and keep retention.",
      href: "/automatic-subtitles-for-youtube-shorts/",
    },
  ],
};
export function LandingPage({ session, workspaceProfile = null, onOpenSignup, onOpenSignin, onLogout, onOpenWorkspace }: Props) {
  const { locale, localizePath, t } = useLocale();
  const [activeCheckoutProductId, setActiveCheckoutProductId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const revealRootRef = useRef<HTMLElement>(null);
  const revealTimersRef = useRef<number[]>([]);
  const statsObserverRef = useRef<IntersectionObserver | null>(null);
  const accountPlanLabel = String(workspaceProfile?.plan ?? "").trim().toUpperCase() || "…";
  const currentPlanLabel = String(workspaceProfile?.plan ?? session?.plan ?? "").trim().toUpperCase() || null;
  const isStartPlanUsed = Boolean(workspaceProfile?.startPlanUsed || currentPlanLabel === "START");
  const refineProofs = landingRefineProofs[locale];
  const refineCarouselCards = landingRefineCarouselCards[locale];
  const guideCards = landingGuideCards[locale];
  const guidesIndexHref = localizePath(landingGuidesIndexHref);

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

  useLayoutEffect(() => {
    let initialSyncFrame = 0;
    let restoreTransitionFrame = 0;

    const syncPreviewTransform = () => {
      if (!previewRef.current) return;
      previewRef.current.style.transform = getHeroPreviewTransform(window.scrollY);
    };

    const syncPreviewTransformImmediately = () => {
      if (!previewRef.current) return;
      window.cancelAnimationFrame(restoreTransitionFrame);
      previewRef.current.style.transition = "none";
      syncPreviewTransform();
      restoreTransitionFrame = window.requestAnimationFrame(() => {
        if (!previewRef.current) return;
        previewRef.current.style.transition = "";
      });
    };

    syncPreviewTransformImmediately();
    initialSyncFrame = window.requestAnimationFrame(syncPreviewTransformImmediately);

    window.addEventListener("scroll", syncPreviewTransform, { passive: true });
    window.addEventListener("pageshow", syncPreviewTransformImmediately);

    return () => {
      window.cancelAnimationFrame(initialSyncFrame);
      window.cancelAnimationFrame(restoreTransitionFrame);
      window.removeEventListener("scroll", syncPreviewTransform);
      window.removeEventListener("pageshow", syncPreviewTransformImmediately);
      if (!previewRef.current) return;
      previewRef.current.style.transition = "";
    };
  }, []);

  useEffect(() => {
    const root = revealRootRef.current;
    if (!root) return undefined;

    const groupedNodes = new Set(
      Array.from(root.querySelectorAll<HTMLElement>("[data-reveal-group] [data-reveal]")),
    );
    const singleNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]")).filter(
      (node) => !groupedNodes.has(node),
    );
    const groupNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal-group]"));
    if (!singleNodes.length && !groupNodes.length) return undefined;

    const clearRevealTimers = () => {
      revealTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      revealTimersRef.current = [];
    };

    const revealGroup = (group: HTMLElement) => {
      const items = Array.from(group.querySelectorAll<HTMLElement>("[data-reveal]"));
      const staggerMs = 180;

      items.forEach((item, index) => {
        const timerId = window.setTimeout(() => {
          item.classList.add("is-visible");
        }, index * staggerMs);
        revealTimersRef.current.push(timerId);
      });
    };

    if (typeof IntersectionObserver === "undefined") {
      singleNodes.forEach((n) => n.classList.add("is-visible"));
      groupNodes.forEach((group) => revealGroup(group));
      return undefined;
    }

    const singleObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          singleObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -12% 0px" },
    );

    const groupObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          revealGroup(entry.target as HTMLElement);
          groupObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -10% 0px" },
    );

    singleNodes.forEach((node) => singleObserver.observe(node));
    groupNodes.forEach((group) => groupObserver.observe(group));

    return () => {
      singleObserver.disconnect();
      groupObserver.disconnect();
      clearRevealTimers();
    };
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

  const handlePlanCheckout = async (productId: "start" | "pro" | "ultra") => {
    if (productId === "start" && isStartPlanUsed) {
      return;
    }

    if (!session) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("adshorts.pending-checkout-plan", productId);
      }
      onOpenSignup();
      return;
    }

    setActiveCheckoutProductId(productId);
    try {
      const response = await fetch(`/api/payments/checkout/${encodeURIComponent(productId)}?mode=widget`, {
        signal: AbortSignal.timeout(20_000),
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: {
          url?: string;
          widget?: {
            confirmationToken: string;
            paymentId: string;
            returnUrl: string;
            url?: string;
          };
        };
        error?: string;
      } | null;

      if (response.status === 401) {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem("adshorts.pending-checkout-plan", productId);
        }
        onOpenSignin();
        return;
      }

      if (!response.ok || (!payload?.data?.url && !payload?.data?.widget?.confirmationToken)) {
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("adshorts.pending-checkout-plan");
        if (payload.data.widget?.confirmationToken) {
          try {
            await openYooKassaPaymentWidget({
              confirmationToken: payload.data.widget.confirmationToken,
              returnUrl: payload.data.widget.returnUrl || window.location.href,
              onError: () => {},
            });
            return;
          } catch {
            if (!payload.data.url) {
              return;
            }
          }
        }

        if (payload.data.url) {
          window.location.assign(payload.data.url);
        }
      }
    } finally {
      setActiveCheckoutProductId(null);
    }
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
          <Link className="brand" to={localizePath("/")} aria-label="AdShorts AI">
            <img src="/logo.png" alt="" width="44" height="44" />
            <span>AdShorts AI</span>
          </Link>

          <PrimarySiteNav activeItem="home" onOpenStudio={openPrimaryFlow} onOpenStudioSection={openStudioSection} />

          <div className="site-header__actions">
            <LanguageSwitcher />
            {session ? (
              <>
                <SiteHeaderWorkspaceStatus profile={workspaceProfile} />
                <AccountMenuButton email={session.email} name={session.name} onLogout={onLogout} plan={accountPlanLabel} />
              </>
            ) : (
              <button className="site-header__signin route-button" type="button" onClick={onOpenSignin}>
                {t(landingMessages.accountSignIn)}
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
              <h1 aria-label={t(landingMessages.heroAria)}>
                <span className="hero__title-line1">
                  <span className="hero__title-highlight">Shorts / Reels / TikTok</span>
                </span>
                <span className="hero__title-line2">{t(landingMessages.heroLine2)}</span>
              </h1>

              <p className="hero__lead">{t(landingMessages.heroSub)}</p>

              <div className="hero__actions">
                <button className="btn btn--primary btn--hero btn--premium-cta route-button" type="button" onClick={openPrimaryFlow}>
                  <span className="btn--premium-cta__label">{t(landingMessages.heroCta)}</span>
                  <svg className="btn--premium-cta__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <ul className="hero__features">
                <li>{t(landingMessages.heroFeatureChannelGrowth)}</li>
                <li>{t(landingMessages.heroFeatureNewClients)}</li>
                <li>{t(landingMessages.heroFeatureEffortlessContent)}</li>
              </ul>

            </div>

            {/* Right: phone mockup */}
            <aside className="hero-live-preview" aria-label={t(landingMessages.heroPreview)}>
              <div className="hero-live-preview__perspective" ref={previewRef}>
                <div className="hero-live-preview__glow" aria-hidden="true"></div>
                <div className="hero-live-preview__reflection" aria-hidden="true"></div>
                <div className="hero-live-preview__frame">
                  <div className="hero-live-preview__video">
                    <img
                      className="hero-live-preview__image"
                      src={heroPreviewImageSrc}
                      alt={t(landingMessages.heroAlt)}
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                    />
                    <span className="hero-live-preview__image-shade" aria-hidden="true"></span>
                    {/* Overlay label */}
                    <div className="hero-live-preview__video-label" aria-hidden="true">
                      <span className="hero-live-preview__video-label-dot"></span>
                      {locale === "en" ? "Generating…" : "Генерация…"}
                    </div>
                  </div>
                  <div className="hero-live-preview__prompt">
                    <span className="hero-live-preview__prompt-text">{t(landingMessages.heroPrompt)}</span>
                    <button className="hero-live-preview__btn" type="button" aria-label="Generate" tabIndex={-1}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="section lp-section lp-section--a lp-section--workflow">
          <div className="container">
            <div className="lp-section-head lp-section-head--left" data-reveal="">
              <p className="lp-eyebrow">{t(landingMessages.workflowEyebrow)}</p>
              <h2>{t(landingMessages.workflowHeading)}</h2>
            </div>

            <div className="steps-grid" data-reveal-group="">
              <article className="step-card" data-reveal="" data-reveal-delay="1">
                <div className="step-card__num">01</div>
                <h3>{locale === "en" ? "Enter an idea" : "Введите идею"}</h3>
                <p>{locale === "en" ? "Write what the video should be about." : "Напишите, о чём должен быть ролик."}</p>
              </article>

              <article className="step-card" data-reveal="" data-reveal-delay="2">
                <div className="step-card__num">02</div>
                <h3>{locale === "en" ? "Get a finished Shorts" : "Получите готовый Shorts"}</h3>
                <p>
                  {locale === "en"
                    ? "AI creates the video structure, visuals, voiceover and subtitles."
                    : "AI сам создаст структуру ролика, визуал, озвучку и субтитры."}
                </p>
              </article>

              <article className="step-card" data-reveal="" data-reveal-delay="3">
                <div className="step-card__num">03</div>
                <h3>{locale === "en" ? "Publish in one click" : "Опубликуйте в один клик"}</h3>
                <p>{locale === "en" ? "Send the video to YouTube Shorts directly from the service." : "Отправьте ролик в YouTube Shorts прямо из сервиса."}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section lp-section lp-section--b section--tight section--landing-refine" aria-labelledby="landing-refine-heading">
          <div className="container landing-refine-layout">
            <div className="landing-refine-copy">
              <div className="lp-section-head lp-section-head--left landing-refine-head" data-reveal="">
                <p className="lp-eyebrow">{t(landingMessages.refineEyebrow)}</p>
                <h2 id="landing-refine-heading">{t(landingMessages.refineHeading)}</h2>
                <p>{t(landingMessages.refineSub)}</p>
              </div>

              <div className="landing-refine-proof-list" data-reveal-group="">
                {refineProofs.map((proof, index) => (
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
              <div className="landing-refine-board__shell landing-refine-board__shell--linear" data-carousel-reveal="">
                <div className="landing-refine-board__editor">
                  <div className="studio-segment-editor__stage">
                    <div className="studio-segment-editor__carousel">
                      <button className="studio-segment-editor__arrow" type="button" tabIndex={-1} aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      <div className="studio-segment-editor__cards">
                        {refineCarouselCards.map((card) => {
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
                                      <span className="studio-segment-editor__card-visual-status">{t(landingMessages.visualChanged)}</span>
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
                                      <span>{t(landingMessages.segmentText)}</span>
                                      <strong>{t(landingMessages.segmentTextStrong)}</strong>
                                    </div>
                                  </>
                                ) : null}

                                <div className={`studio-segment-editor__card-overlay${isActiveCard ? " is-active" : ""}`}>
                                  {isActiveCard ? (
                                    <div className="studio-segment-editor__card-overlay-footer">
                                      <div className="studio-segment-editor__card-overlay-main">
                                        <div className="studio-segment-editor__card-copy">
                                          <strong>{t(landingMessages.segment)} {card.number}</strong>
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
                                        <strong>{t(landingMessages.segment)} {card.number}</strong>
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
              <p className="lp-eyebrow">{t(landingMessages.regularEyebrow)}</p>
              <h2 id="publish-regular-heading">{t(landingMessages.regularHeading)}</h2>
              <p>{t(landingMessages.regularSub)}</p>
            </div>
            <div className="landing-publish-regular">
              <div className="steps-grid landing-publish-regular__grid" data-reveal-group="">
                <article className="step-card landing-publish-regular__card" data-reveal="" data-reveal-delay="1">
                  <div className="landing-publish-regular__card-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <h3>{locale === "en" ? "AI ideas and content plan" : "Идеи и контент-план с AI"}</h3>
                  <p>{locale === "en" ? "Enter a topic — AI suggests ideas and ready scripts for regular Shorts." : "Введите тему — AI предложит идеи и готовые сценарии для регулярных Shorts."}</p>
                </article>

                <article className="step-card landing-publish-regular__card" data-reveal="" data-reveal-delay="2">
                  <div className="landing-publish-regular__card-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                  </div>
                  <h3>{locale === "en" ? "Fast Shorts creation" : "Быстрое создание Shorts"}</h3>
                  <p>{locale === "en" ? "Create finished Shorts without extra steps or delays." : "Создавайте готовые Shorts без лишних действий и задержек."}</p>
                </article>

                <article className="step-card landing-publish-regular__card" data-reveal="" data-reveal-delay="3">
                  <div className="landing-publish-regular__card-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </div>
                  <h3>{locale === "en" ? "Instant publishing" : "Мгновенная публикация"}</h3>
                  <p>{locale === "en" ? "The finished video is sent to YouTube Shorts directly from the studio." : "Готовый ролик отправляется в YouTube Shorts прямо из студии."}</p>
                </article>
              </div>

              <div className="landing-publish-regular__actions">
                <button className="btn btn--primary btn--premium-cta route-button" type="button" onClick={openPrimaryFlow}>
                  <span className="btn--premium-cta__label">{t(landingMessages.heroCta)}</span>
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
              <p className="lp-eyebrow">{locale === "en" ? "EXAMPLES" : "ПРИМЕРЫ"}</p>
              <h2 id="examples-cta-heading">{locale === "en" ? "Get inspired by Shorts examples" : "Вдохновляйтесь примерами Shorts"}</h2>
              <p>{locale === "en" ? "Use ready examples to create similar videos" : "Используйте готовые шаблоны, чтобы создавать похожие видео"}</p>
            </div>

            <div className="landing-examples-cta">
              <div className="landing-examples-cta__grid" data-reveal-group="">
                <Link className="landing-examples-cta__card" to={localizePath("/examples?filter=ads")} aria-label={locale === "en" ? "Open Shorts examples: ad Shorts" : "Открыть примеры Shorts: Рекламные Shorts"} data-reveal="" data-reveal-delay="1">
                  <div className="landing-examples-cta__icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                  </div>
                  <h3>{locale === "en" ? "Ad Shorts" : "Рекламные Shorts"}</h3>
                  <p>{locale === "en" ? "Promote a product or service and guide viewers to action." : "Продвигайте продукт или услугу и ведите зрителя к действию."}</p>
                </Link>

                <Link className="landing-examples-cta__card" to={localizePath("/examples?filter=growth")} aria-label={locale === "en" ? "Open Shorts examples: channel growth Shorts" : "Открыть примеры Shorts: Shorts для роста канала"} data-reveal="" data-reveal-delay="2">
                  <div className="landing-examples-cta__icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
                    </svg>
                  </div>
                  <h3>{locale === "en" ? "Channel growth Shorts" : "Shorts для роста канала"}</h3>
                  <p>{locale === "en" ? "Gain views and attract new subscribers." : "Набирайте просмотры и привлекайте новых подписчиков."}</p>
                </Link>

                <Link className="landing-examples-cta__card" to={localizePath("/examples?filter=expert")} aria-label={locale === "en" ? "Open Shorts examples: educational Shorts" : "Открыть примеры Shorts: Обучающие Shorts"} data-reveal="" data-reveal-delay="3">
                  <div className="landing-examples-cta__icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/><line x1="12" y1="12" x2="12" y2="14"/>
                    </svg>
                  </div>
                  <h3>{locale === "en" ? "Educational Shorts" : "Обучающие Shorts"}</h3>
                  <p>{locale === "en" ? "Share knowledge and build audience trust." : "Делитесь знаниями и формируйте доверие аудитории."}</p>
                </Link>
              </div>

              <div className="landing-examples-cta__actions">
                <Link className="btn btn--primary btn--premium-cta route-button" to={localizePath("/examples")}>
                  <span className="btn--premium-cta__label">{t(landingMessages.seeExamples)}</span>
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
              <p className="lp-eyebrow">{t(landingMessages.planScaleEyebrow)}</p>
              <h2>{t(landingMessages.planScaleHeading)}</h2>
              <p>{t(landingMessages.planScaleSub)}</p>
            </div>

            <div className="plan-grid" data-reveal-group="">
              <article
                className={`plan-card${isStartPlanUsed ? " plan-card--disabled" : ""}`}
                data-reveal=""
                data-reveal-delay="1"
                aria-disabled={isStartPlanUsed}
              >
                <div className="plan-card__header">
                  <span className="plan-card__label">START</span>
                  {isStartPlanUsed ? (
                    <span className="plan-card__badge plan-card__badge--used">{t(landingMessages.used)}</span>
                  ) : null}
                </div>
                <div className="plan-card__price">
                  <strong>390 ₽</strong>
                </div>
                <p className="plan-card__tagline">
                  {locale === "en" ? "Ideal for the first launch" : "Разовый пакет для первого запуска"}
                </p>
                <div className="plan-card__divider" aria-hidden="true" />
                <ul className="plan-card__features">
                  <li>
                    {locale === "en" ? "Up to 5 Shorts" : "До 5 Shorts"}
                  </li>
                  <li>
                    {t(landingMessages.noWatermark)}
                  </li>
                  <li>
                    {t(landingMessages.autoPublish)}
                  </li>
                </ul>
                <button
                  className="plan-card__cta route-button"
                  type="button"
                  onClick={() => void handlePlanCheckout("start")}
                  disabled={isStartPlanUsed || activeCheckoutProductId === "start"}
                >
                  {isStartPlanUsed
                    ? t(landingMessages.used)
                    : activeCheckoutProductId === "start"
                      ? t(landingMessages.checkoutOpening)
                      : t(landingMessages.chooseStart)}
                </button>
              </article>

              <article className="plan-card plan-card--accent" data-reveal="" data-reveal-delay="2">
                <div className="plan-card__header">
                  <span className="plan-card__label">PRO</span>
                  <span className="plan-card__badge">{t(landingMessages.planPopular)}</span>
                </div>
                <div className="plan-card__price">
                  <strong>1 490 ₽</strong>
                </div>
                <p className="plan-card__tagline">
                  {locale === "en" ? "Ideal for a regular content flow" : "Идеально для регулярного контент-потока"}
                </p>
                <div className="plan-card__divider" aria-hidden="true" />
                <ul className="plan-card__features">
                  <li>
                    {locale === "en" ? "Up to 25 Shorts" : "До 25 Shorts"}
                  </li>
                  <li>
                    {locale === "en" ? "Everything in START" : "Всё из START"}
                  </li>
                  <li>
                    {t(landingMessages.priorityGeneration)}
                  </li>
                </ul>
                <button
                  className="plan-card__cta plan-card__cta--accent route-button"
                  type="button"
                  onClick={() => void handlePlanCheckout("pro")}
                  disabled={activeCheckoutProductId === "pro"}
                >
                  {activeCheckoutProductId === "pro" ? t(landingMessages.checkoutOpening) : t(landingMessages.choosePro)}
                </button>
              </article>

              <article className="plan-card" data-reveal="" data-reveal-delay="3">
                <div className="plan-card__header">
                  <span className="plan-card__label">ULTRA</span>
                </div>
                <div className="plan-card__price">
                  <strong>4 990 ₽</strong>
                </div>
                <p className="plan-card__tagline">
                  {locale === "en" ? "Ideal for maximum volume" : "Идеально для максимального объёма"}
                </p>
                <div className="plan-card__divider" aria-hidden="true" />
                <ul className="plan-card__features">
                  <li>
                    {locale === "en" ? "Up to 100 Shorts" : "До 100 Shorts"}
                  </li>
                  <li>
                    {locale === "en" ? "Everything in PRO" : "Всё из PRO"}
                  </li>
                  <li>
                    {locale === "en" ? "Maximum priority" : "Максимальный приоритет"}
                  </li>
                </ul>
                <button
                  className="plan-card__cta route-button"
                  type="button"
                  onClick={() => void handlePlanCheckout("ultra")}
                  disabled={activeCheckoutProductId === "ultra"}
                >
                  {activeCheckoutProductId === "ultra" ? t(landingMessages.checkoutOpening) : t(landingMessages.chooseUltra)}
                </button>
              </article>
            </div>

            <div className="lp-section-head__cta lp-section-head__cta--pricing-under">
              <Link className="btn btn--primary btn--premium-cta route-button" to={localizePath("/pricing")}>
                <span className="btn--premium-cta__label">{locale === "en" ? "Go to plans" : "Перейти к тарифам"}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        <section className="section lp-section lp-section--b section--guides" id="guides" aria-labelledby="guides-heading">
          <div className="container guides-strip">
            <div className="lp-section-head lp-section-head--left" data-reveal="">
              <p className="lp-eyebrow">{locale === "en" ? "GUIDES" : "ГАЙДЫ"}</p>
              <h2 id="guides-heading">
                {locale === "en" ? (
                  <>
                    {"Useful Shorts "}
                    <br />
                    guides
                  </>
                ) : (
                  <>
                    {"Полезные материалы "}
                    <br />
                    по Shorts
                  </>
                )}
              </h2>
              <p>
                {locale === "en"
                  ? "Walkthroughs on hooks, structure, and subtitles—to help your Shorts hold attention better."
                  : "Разборы по хукам, структуре и субтитрам — чтобы ваши Shorts лучше удерживали внимание."}
              </p>
            </div>

            <div className="guides-strip__cards" data-reveal-group="">
              {guideCards.map((guide, index) => (
                <a
                  key={guide.href}
                  className="guide-card route-guide-link"
                  href={localizePath(guide.href)}
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
              href={guidesIndexHref}
              data-reveal=""
            >
              {t(landingMessages.guidesAll)}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{marginLeft: 8}}>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer__inner">

          <Link className="footer__brand-link" to={localizePath("/")} aria-label="AdShorts AI">
            <img src="/logo.png" alt="" width="30" height="30" style={{borderRadius: 8}} />
            <span className="footer__brand-name">AdShorts AI</span>
          </Link>

          <nav className="footer__links" aria-label="Footer navigation">
            <a href="mailto:support@adshortsai.com">support@adshortsai.com</a>
            <a href="https://t.me/AdShortsAIBot" target="_blank" rel="noopener noreferrer">Telegram</a>
            <a href="https://adshortsai.com/offer/" target="_blank" rel="noopener noreferrer">{locale === "en" ? "Public Offer" : "Оферта"}</a>
            <a href={locale === "en" ? "https://adshortsai.com/en/terms-of-use/" : "https://adshortsai.com/terms-of-use/"} target="_blank" rel="noopener noreferrer">{locale === "en" ? "Terms" : "Условия"}</a>
            <a href={locale === "en" ? "https://adshortsai.com/en/terms/" : "https://adshortsai.com/terms/"} target="_blank" rel="noopener noreferrer">{locale === "en" ? "Agreement" : "Соглашение"}</a>
            <a href={locale === "en" ? "https://adshortsai.com/en/privacy/" : "https://adshortsai.com/privacy/"} target="_blank" rel="noopener noreferrer">{locale === "en" ? "Privacy" : "Конфиденциальность"}</a>
            <a href={locale === "en" ? "https://adshortsai.com/en/data-deletion/" : "https://adshortsai.com/data-deletion.html"} target="_blank" rel="noopener noreferrer">{locale === "en" ? "Data deletion" : "Удаление данных"}</a>
            <a href={locale === "en" ? "https://adshortsai.com/" : "https://adshortsai.com/en/"} target="_blank" rel="noopener noreferrer">{t(landingMessages.footerEnglish)}</a>
          </nav>

          <p className="footer__copyright">© {new Date().getFullYear()} AdShorts AI</p>

        </div>
      </footer>
    </div>
  );
}
