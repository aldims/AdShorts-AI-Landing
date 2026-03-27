import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router-dom";

import { AccountMenuButton } from "../components/AccountMenuButton";
import { PrimarySiteNav } from "../components/PrimarySiteNav";
import { SiteHeaderWorkspaceStatus } from "../components/SiteHeaderWorkspaceStatus";
import { readExamplePrefillIntent, writeExamplePrefillIntent, type ExamplePrefillIntent } from "../lib/example-prefill";

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

type ExampleGoal = "sales" | "expert" | "facts" | "storytelling" | "ugc";
type ExampleFilter = "all" | ExampleGoal;

type ExampleItem = {
  featured?: boolean;
  goal: ExampleGoal;
  hook: string;
  id: string;
  posterSrc?: string;
  seedPrompt: string;
  summary: string;
  tags: string[];
  title: string;
  videoSrc: string;
};

type ExampleVideoPreviewProps = {
  buttonClassName?: string;
  className: string;
  example: ExampleItem;
  onOpen?: (example: ExampleItem) => void;
  overlay?: ReactNode;
  priority?: boolean;
  videoClassName: string;
};

const exampleGoalCopy: Record<ExampleGoal, { label: string; shortLabel: string }> = {
  expert: {
    label: "Экспертный контент",
    shortLabel: "Экспертный",
  },
  facts: {
    label: "Факты",
    shortLabel: "Факты",
  },
  sales: {
    label: "Продажи",
    shortLabel: "Продажи",
  },
  storytelling: {
    label: "Storytelling",
    shortLabel: "Story",
  },
  ugc: {
    label: "UGC / Viral",
    shortLabel: "UGC / Viral",
  },
};

const exampleFilterOptions: Array<{ id: ExampleFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "sales", label: "Продажи" },
  { id: "expert", label: "Экспертный контент" },
  { id: "facts", label: "Факты" },
  { id: "storytelling", label: "Storytelling" },
  { id: "ugc", label: "UGC / Viral" },
];

const examplesRevealSelector = [
  ".examples-hero__copy",
  ".examples-hero__featured",
  ".examples-browser__filters",
  ".examples-browser__meta",
  ".examples-browser__card",
  ".examples-cta__inner",
].join(", ");

const exampleItems: ExampleItem[] = [
  {
    featured: true,
    goal: "storytelling",
    hook: "Атмосфера в первом кадре может удержать не хуже, чем громкий заголовок.",
    id: "story-future-city",
    seedPrompt:
      "Сделай storytelling Shorts про то, как AI меняет привычный город: атмосферный первый кадр, 3 коротких тезиса и финальный вывод без воды.",
    summary:
      "Формат для личных историй, трендов и нарратива, где важны настроение, темп и ощущение цельной сцены с первой секунды.",
    tags: ["Storytelling", "Атмосфера", "Hook"],
    title: "Storytelling с кинематографичным первым кадром",
    videoSrc: "/1ru.mp4",
  },
  {
    goal: "sales",
    hook: "Если оффер не цепляет за 2 секунды, человек уже ушёл дальше.",
    id: "sales-offer-contrast",
    seedPrompt:
      "Сделай продающий Shorts для услуги по настройке рекламы: сильный hook про потерю клиентов, затем решение и короткий CTA на заявку.",
    summary:
      "Подходит для сервисов, агентств и экспертов, когда нужно быстро показать боль, решение и понятный следующий шаг без длинного объяснения.",
    tags: ["Продажи", "Оффер", "CTA"],
    title: "Продажа услуги через контраст и обещание результата",
    videoSrc: "/2ru.mp4",
  },
  {
    goal: "expert",
    hook: "Экспертный ролик должен начинаться с вывода, а не с вступления.",
    id: "expert-breakdown",
    seedPrompt:
      "Сделай экспертный Shorts про 3 ошибки в продвижении Telegram-канала: плотная подача, быстрый темп, без вступления и с четким финалом.",
    summary:
      "Формат для эксперта, который хочет коротко объяснить тему и дать зрителю ощущение пользы уже в первые 5 секунд.",
    tags: ["Эксперт", "Разбор", "Польза"],
    title: "Экспертный разбор за 25 секунд",
    videoSrc: "/1ru.mp4",
  },
  {
    goal: "facts",
    hook: "Удивительный факт работает лучше, когда у него есть payoff, а не просто цифра.",
    id: "facts-curiosity-loop",
    seedPrompt:
      "Сделай Shorts в формате любопытного факта о кошках: яркий hook, 3 быстрых наблюдения и короткий финальный вывод с удержанием.",
    summary:
      "Формат для познавательных тем, подборок и каналов с фактами, где важны curiosity loop, surprise и быстрый payoff.",
    tags: ["Факты", "Удержание", "Любопытство"],
    title: "Факт-ролик с визуальным якорем",
    videoSrc: "/3ru.mp4",
  },
  {
    goal: "storytelling",
    hook: "Одна напряжённая сцена может работать лучше, чем десять сухих тезисов.",
    id: "story-mini-scene",
    seedPrompt:
      "Сделай storytelling Shorts про редкую находку в Альпах: атмосферный первый кадр, нарастающий интерес и короткий разворот в финале.",
    summary:
      "Полезно для брендов и личных аккаунтов, когда ролик должен ощущаться как маленькая сцена, а не как просто набор фактов.",
    tags: ["Сцена", "Эмоция", "Нарратив"],
    title: "Мини-история с нарастающим интересом",
    videoSrc: "/2ru.mp4",
  },
  {
    goal: "ugc",
    hook: "Лучшие нативные ролики выглядят не как реклама, а как личная находка.",
    id: "ugc-viral-find",
    seedPrompt:
      "Сделай UGC-style Shorts про продукт для ежедневной привычки: разговорный тон, быстрый hook, ощущение живой находки и нативный CTA.",
    summary:
      "Подходит для тестов, реакций, нативных интеграций и роликов, которые должны ощущаться живыми, быстрыми и невылизанными.",
    tags: ["UGC", "Viral", "Нативно"],
    title: "UGC / viral-подача с эффектом «снято сейчас»",
    videoSrc: "/3ru.mp4",
  },
];

const playVideoElement = async (element: HTMLVideoElement | null, preferMutedFallback = true) => {
  if (!element) return;

  try {
    await element.play();
    return;
  } catch {
    if (!preferMutedFallback) return;
  }

  const previousMutedState = element.muted;
  element.muted = true;

  try {
    await element.play();
  } catch {
    element.pause();
  } finally {
    element.muted = previousMutedState;
  }
};

function ExampleVideoPreview({
  buttonClassName = "examples-preview__button",
  className,
  example,
  onOpen,
  overlay,
  priority = false,
  videoClassName,
}: ExampleVideoPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isInViewport, setIsInViewport] = useState(priority);

  useEffect(() => {
    if (priority || typeof IntersectionObserver === "undefined") {
      setIsInViewport(true);
      return undefined;
    }

    const node = containerRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInViewport(entry.isIntersecting);
        });
      },
      {
        threshold: 0.35,
        rootMargin: "120px 0px 120px 0px",
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [priority]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isInViewport) {
      video.pause();
      return;
    }

    video.muted = true;
    void video.play().catch(() => {
      video.pause();
    });
  }, [example.videoSrc, isInViewport]);

  const media = (
    <>
      <video
        ref={videoRef}
        className={videoClassName}
        src={example.videoSrc}
        poster={example.posterSrc}
        muted
        loop
        playsInline
        preload={priority ? "auto" : "metadata"}
      />
      {overlay}
    </>
  );

  return (
    <div ref={containerRef} className={className}>
      {onOpen ? (
        <button
          className={buttonClassName}
          type="button"
          onClick={() => onOpen(example)}
          aria-label={`Открыть пример: ${example.title}`}
        >
          {media}
        </button>
      ) : (
        media
      )}
    </div>
  );
}

export function ExamplesPage({
  session,
  workspaceProfile = null,
  onOpenSignup,
  onOpenSignin,
  onLogout,
  onOpenWorkspace,
}: Props) {
  const navigate = useNavigate();
  const revealRootRef = useRef<HTMLElement>(null);
  const modalVideoRef = useRef<HTMLVideoElement | null>(null);
  const [activeFilter, setActiveFilter] = useState<ExampleFilter>("all");
  const [activeExample, setActiveExample] = useState<ExampleItem | null>(null);
  const accountPlanLabel = String(workspaceProfile?.plan ?? "").trim().toUpperCase() || "…";

  const featuredExample = useMemo(() => exampleItems.find((item) => item.featured) ?? exampleItems[0], []);

  const filteredExamples = useMemo(() => {
    if (activeFilter === "all") return exampleItems;
    return exampleItems.filter((item) => item.goal === activeFilter);
  }, [activeFilter]);

  const galleryExamples = useMemo(() => {
    const withoutFeatured = filteredExamples.filter((item) => item.id !== featuredExample.id);
    return withoutFeatured.length > 0 ? withoutFeatured : filteredExamples;
  }, [featuredExample.id, filteredExamples]);

  const activeFilterLabel = activeFilter === "all" ? "Все примеры" : exampleGoalCopy[activeFilter].label;

  useEffect(() => {
    if (!session) return;

    const pendingIntent = readExamplePrefillIntent();
    if (!pendingIntent) return;

    navigate("/app/studio", { replace: true });
  }, [navigate, session]);

  useEffect(() => {
    const root = revealRootRef.current;
    if (!root) return undefined;

    const revealNodes = Array.from(root.querySelectorAll<HTMLElement>(examplesRevealSelector));
    if (!revealNodes.length) return undefined;

    revealNodes.forEach((node) => {
      node.setAttribute("data-reveal", "");
      node.classList.remove("is-visible");
      delete node.dataset.revealDelay;

      const parent = node.parentElement;
      if (!parent) return;

      const siblings = Array.from(parent.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child.matches(examplesRevealSelector),
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

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.body.classList.toggle("modal-open", Boolean(activeExample));

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [activeExample]);

  useEffect(() => {
    if (!activeExample) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveExample(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeExample]);

  useEffect(() => {
    if (!activeExample) {
      modalVideoRef.current?.pause();
      return;
    }

    void playVideoElement(modalVideoRef.current, true);
  }, [activeExample]);

  const openPrimaryFlow = () => {
    if (session) {
      onOpenWorkspace();
      return;
    }

    onOpenSignup();
  };

  const openExampleInStudio = (example: ExampleItem) => {
    const intent = {
      exampleId: example.id,
      prompt: example.seedPrompt,
    } satisfies ExamplePrefillIntent;

    writeExamplePrefillIntent(intent);
    setActiveExample(null);

    if (session) {
      navigate("/app/studio");
      return;
    }

    onOpenSignup();
  };

  const openExampleModal = (example: ExampleItem) => {
    flushSync(() => {
      setActiveExample(example);
    });

    const modalVideo = modalVideoRef.current;
    if (!modalVideo) return;

    modalVideo.currentTime = 0;
    modalVideo.preload = "auto";
    modalVideo.muted = false;
    modalVideo.load();
    void playVideoElement(modalVideo, true);
  };

  return (
    <div className="route-page examples-page">
      <header className="site-header" id="top">
        <div className="container site-header__inner">
          <Link className="brand" to="/" aria-label="AdShorts AI">
            <img src="/logo.png" alt="" width="44" height="44" />
            <span>AdShorts AI</span>
          </Link>

          <PrimarySiteNav activeItem="examples" onOpenStudio={openPrimaryFlow} />

          <div className="site-header__actions">
            {session ? (
              <>
                <SiteHeaderWorkspaceStatus profile={workspaceProfile} />
                <AccountMenuButton email={session.email} name={session.name} onLogout={onLogout} plan={accountPlanLabel} />
              </>
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

      <main className="examples-showcase" ref={revealRootRef}>
        <section className="examples-hero">
          <div className="examples-hero__scene" aria-hidden="true">
            <span className="examples-hero__beam examples-hero__beam--left"></span>
            <span className="examples-hero__beam examples-hero__beam--right"></span>
            <span className="examples-hero__grid-glow"></span>
          </div>

          <div className="container examples-hero__grid">
            <div className="examples-hero__copy">
              <p className="eyebrow">ПРИМЕРЫ</p>
              <h1>Смотрите реальные Shorts и запускайте свой формат в студии</h1>
              <p className="examples-hero__lead">
                Видео-first витрина с готовыми форматами под продажи, экспертный контент, факты, storytelling и
                UGC-подачу. Выберите пример, возьмите seed prompt и переходите в генерацию.
              </p>

              <div className="examples-hero__chips" aria-label="Категории примеров">
                {exampleFilterOptions.slice(1).map((item) => (
                  <span key={item.id}>{item.label}</span>
                ))}
              </div>

              <div className="examples-hero__actions">
                <button className="btn btn--primary route-button" type="button" onClick={() => openExampleInStudio(featuredExample)}>
                  Использовать пример в студии
                </button>
                <button className="examples-hero__ghost route-button" type="button" onClick={() => openExampleModal(featuredExample)}>
                  Смотреть пример
                </button>
              </div>

              <div className="examples-hero__stats" aria-label="Статистика витрины">
                <article>
                  <strong>{exampleItems.length}</strong>
                  <span>готовых примеров</span>
                </article>
                <article>
                  <strong>5</strong>
                  <span>контентных задач</span>
                </article>
                <article>
                  <strong>1 клик</strong>
                  <span>до перехода в студию</span>
                </article>
              </div>
            </div>

            <article className="examples-hero__featured">
              <ExampleVideoPreview
                className="examples-hero__media"
                example={featuredExample}
                onOpen={openExampleModal}
                overlay={
                  <div className="examples-hero__media-overlay">
                    <span className="examples-hero__goal">{exampleGoalCopy[featuredExample.goal].label}</span>
                    <span className="examples-hero__watch">Смотреть</span>
                  </div>
                }
                priority
                videoClassName="examples-hero__video"
              />

              <div className="examples-hero__featured-copy">
                <span className="examples-hero__featured-label">Featured example</span>
                <h2>{featuredExample.title}</h2>
                <p>{featuredExample.summary}</p>

                <div className="examples-hero__tag-row">
                  {featuredExample.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>

                <div className="examples-hero__prompt">
                  <span>Seed prompt</span>
                  <p>{featuredExample.seedPrompt}</p>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="section section--dark examples-browser">
          <div className="container examples-browser__inner">
            <div className="examples-browser__filters">
              <div className="examples-browser__filters-inner" aria-label="Фильтры примеров">
                {exampleFilterOptions.map((item) => (
                  <button
                    key={item.id}
                    className={`examples-browser__filter${activeFilter === item.id ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setActiveFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="examples-browser__meta">
              <div>
                <span className="examples-browser__meta-label">Подборка</span>
                <strong>{activeFilterLabel}</strong>
              </div>
              <p>
                {galleryExamples.length} {galleryExamples.length === 1 ? "пример" : galleryExamples.length < 5 ? "примера" : "примеров"} с
                preview-видео и готовым seed prompt.
              </p>
            </div>

            <div className="examples-browser__grid">
              {galleryExamples.map((example, index) => {
                const isAccent = index === 0 && galleryExamples.length > 1;

                return (
                  <article
                    key={example.id}
                    className={`examples-browser__card${isAccent ? " examples-browser__card--accent" : ""}`}
                  >
                    <ExampleVideoPreview
                      buttonClassName="examples-browser__preview-button"
                      className="examples-browser__preview"
                      example={example}
                      onOpen={openExampleModal}
                      overlay={
                        <div className="examples-browser__preview-overlay">
                          <span className="examples-browser__preview-goal">{exampleGoalCopy[example.goal].shortLabel}</span>
                          <span className="examples-browser__preview-action">Смотреть</span>
                        </div>
                      }
                      videoClassName="examples-browser__preview-video"
                    />

                    <div className="examples-browser__card-copy">
                      <span className="examples-browser__card-goal">{exampleGoalCopy[example.goal].label}</span>
                      <h3>{example.title}</h3>
                      <p>{example.summary}</p>

                      <div className="examples-browser__tags" aria-label="Теги примера">
                        {example.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>

                      <div className="examples-browser__actions">
                        <button
                          className="examples-browser__cta examples-browser__cta--primary route-button"
                          type="button"
                          onClick={() => openExampleInStudio(example)}
                        >
                          Использовать в студии
                        </button>
                        <button
                          className="examples-browser__cta route-button"
                          type="button"
                          onClick={() => openExampleModal(example)}
                        >
                          Смотреть
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section section--paper examples-cta">
          <div className="container examples-cta__inner">
            <div className="examples-cta__copy">
              <p className="eyebrow eyebrow--dark">ГОТОВО К ЗАПУСКУ</p>
              <h2>Берите структуру, меняйте тему и собирайте свой Shorts в студии</h2>
              <p>
                В витрине уже есть формат, который можно использовать как стартовую точку. Дальше меняете тему,
                подачу и запускаете генерацию под свою задачу.
              </p>
            </div>

            <div className="examples-cta__actions">
              <button className="btn btn--primary route-button" type="button" onClick={() => openExampleInStudio(featuredExample)}>
                Использовать featured example
              </button>
              <button className="examples-cta__secondary route-button" type="button" onClick={openPrimaryFlow}>
                Открыть студию
              </button>
            </div>
          </div>
        </section>

        {activeExample ? (
          <div
            className="examples-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="examples-modal-title"
          >
            <button
              className="examples-modal__backdrop route-close"
              type="button"
              aria-label="Закрыть пример"
              onClick={() => setActiveExample(null)}
            />

            <div className="examples-modal__panel" role="document">
              <button
                className="examples-modal__close route-close"
                type="button"
                aria-label="Закрыть пример"
                onClick={() => setActiveExample(null)}
              >
                ×
              </button>

              <div className="examples-modal__layout">
                <div className="examples-modal__player">
                  <video
                    ref={modalVideoRef}
                    key={`${activeExample.id}-modal`}
                    className="examples-modal__video"
                    src={activeExample.videoSrc}
                    poster={activeExample.posterSrc}
                    controls
                    playsInline
                    preload="auto"
                    onLoadedData={() => void playVideoElement(modalVideoRef.current, true)}
                    onCanPlay={() => void playVideoElement(modalVideoRef.current, true)}
                  />
                </div>

                <div className="examples-modal__copy">
                  <div className="examples-modal__section">
                    <span className="examples-modal__eyebrow">Готовый формат</span>
                    <strong id="examples-modal-title">{activeExample.title}</strong>
                    <p>{activeExample.summary}</p>
                  </div>

                  <div className="examples-modal__section">
                    <div className="examples-modal__meta">
                      <span>Задача</span>
                      <p>{exampleGoalCopy[activeExample.goal].label}</p>
                    </div>
                    <div className="examples-modal__meta">
                      <span>Hook</span>
                      <p>{activeExample.hook}</p>
                    </div>
                    <div className="examples-modal__meta">
                      <span>Recommended prompt seed</span>
                      <code>{activeExample.seedPrompt}</code>
                    </div>
                    <div className="examples-modal__tags" aria-label="Теги примера">
                      {activeExample.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>

                  <div className="examples-modal__actions">
                    <button
                      className="examples-modal__action examples-modal__action--primary route-button"
                      type="button"
                      onClick={() => openExampleInStudio(activeExample)}
                    >
                      Использовать в студии
                    </button>
                    <button className="examples-modal__action route-button" type="button" onClick={() => setActiveExample(null)}>
                      Закрыть
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
