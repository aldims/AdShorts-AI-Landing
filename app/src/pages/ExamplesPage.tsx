import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { AccountMenuButton } from "../components/AccountMenuButton";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { PrimarySiteNav } from "../components/PrimarySiteNav";
import { SiteHeaderWorkspaceStatus } from "../components/SiteHeaderWorkspaceStatus";
import { readExamplePrefillIntent, writeExamplePrefillIntent, type ExamplePrefillIntent } from "../lib/example-prefill";
import { defineMessages, useLocale, type Locale } from "../lib/i18n";
import { writeStudioEntryIntent, type StudioEntryIntentSection } from "../lib/studio-entry-intent";
import { type ExamplePrefillStudioSettings } from "../../shared/example-prefill";

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

type ExampleGoal = "ads" | "growth" | "expert";
type ExampleFilter = "all" | ExampleGoal;

type ExampleItem = {
  goal: ExampleGoal;
  id: string;
  isLocal?: boolean;
  posterSrc?: string;
  prefillSettings?: ExamplePrefillStudioSettings | null;
  promptHint: string;
  seedPrompt: string;
  summary: string;
  tags: string[];
  title: string;
  videoSrc: string;
};

type ExampleVideoPreviewProps = {
  className: string;
  example: ExampleItem;
  overlay?: ReactNode;
  priority?: boolean;
  videoClassName: string;
};

type LocalExamplesResponse = {
  data?: {
    canManage?: boolean;
    enabled: boolean;
    items: ExampleItem[];
  };
  error?: string;
};

type LocalExampleDeleteResponse = {
  data?: {
    exampleId?: string;
  };
  error?: string;
};

const EXAMPLE_PREVIEW_PLAY_EVENT = "adshorts:example-preview-play";

const examplesMessages = defineMessages({
  all: { ru: "Все", en: "All" },
  deleteExample: { ru: "Удалить общий пример", en: "Delete shared example" },
  deleteFailed: { ru: "Не удалось удалить локальный пример.", en: "Could not delete the local example." },
  emptyProject: { ru: "Нужен пустой проект без шаблона?", en: "Need a blank project without a template?" },
  filters: { ru: "Фильтр примеров", en: "Example filter" },
  heroAria: { ru: "Преимущества страницы", en: "Page benefits" },
  heroHeading: { ru: "Готовые сцены для запуска Shorts", en: "Ready scenes for launching Shorts" },
  heroLead: {
    ru: "Выберите подходящий шаблон, нажмите «Использовать» и получите готовую структуру прямо в студии.",
    en: "Choose a template, click Use and get a ready structure directly in the studio.",
  },
  howItWorks: { ru: "Как это работает", en: "How it works" },
  oneClick: { ru: "1 клик", en: "1 click" },
  openStudio: { ru: "Открыть студию", en: "Open studio" },
  playExample: { ru: "Воспроизвести пример", en: "Play example" },
  signIn: { ru: "Войти", en: "Sign in" },
  startFast: { ru: "Быстрый старт за несколько секунд", en: "Quick start in seconds" },
  stepChoose: { ru: "Выберите пример", en: "Choose an example" },
  stepChooseText: { ru: "Реклама, рост канал, экспертиза.", en: "Ads, channel growth, expertise." },
  stepGet: { ru: "Получите похожий Shorts", en: "Get a similar Shorts" },
  stepGetText: { ru: "Добавляйте свои настройки при необходимости.", en: "Adjust settings whenever you need." },
  stepUse: { ru: "Нажмите Использовать", en: "Click Use" },
  stepUseText: { ru: "Все настройки уже готовы для генерации.", en: "All settings are ready for generation." },
  studioDistance: { ru: "до студии", en: "to studio" },
  use: { ru: "Использовать", en: "Use" },
});

const exampleGoalCopy: Record<Locale, Record<ExampleGoal, { label: string; shortLabel: string }>> = {
  ru: {
    ads: {
      label: "📣 Рекламные Shorts",
      shortLabel: "📣 Реклама",
    },
    growth: {
      label: "📈 Shorts для роста канала",
      shortLabel: "📈 Рост канала",
    },
    expert: {
      label: "🎓 Экспертные Shorts",
      shortLabel: "🎓 Экспертиза",
    },
  },
  en: {
    ads: {
      label: "📣 Ad Shorts",
      shortLabel: "📣 Ads",
    },
    growth: {
      label: "📈 Channel growth Shorts",
      shortLabel: "📈 Growth",
    },
    expert: {
      label: "🎓 Expert Shorts",
      shortLabel: "🎓 Expertise",
    },
  },
};

const exampleGoalOrder: ExampleGoal[] = ["ads", "growth", "expert"];

const createExamplePrefillSettings = (
  locale: Locale,
  overrides: Partial<ExamplePrefillStudioSettings> = {},
): ExamplePrefillStudioSettings => ({
  language: locale,
  musicType: "ai",
  subtitleColorId: "purple",
  subtitleEnabled: true,
  subtitleStyleId: "modern",
  videoMode: "standard",
  voiceEnabled: true,
  voiceId: locale === "en" ? "Aiden" : "Bys_24000",
  ...overrides,
});

const exampleItems: ExampleItem[] = [
  {
    goal: "growth",
    id: "story-future-city",
    prefillSettings: createExamplePrefillSettings("ru", {
      musicType: "inspirational",
      subtitleColorId: "cyan",
      subtitleStyleId: "story",
      voiceId: "Nec_24000",
    }),
    promptHint: "Атмосферный storytelling с сильным первым кадром.",
    seedPrompt:
      "Сделай storytelling Shorts про то, как AI меняет привычный город: атмосферный первый кадр, 3 коротких тезиса и финальный вывод без воды.",
    summary:
      "Формат для личных историй, трендов и нарратива, где важны настроение, темп и ощущение цельной сцены с первой секунды.",
    tags: ["Storytelling", "Атмосфера", "Hook"],
    title: "Storytelling с кинематографичным первым кадром",
    videoSrc: "/1ru.mp4",
  },
  {
    goal: "ads",
    id: "sales-offer-contrast",
    prefillSettings: createExamplePrefillSettings("ru", {
      musicType: "business",
      subtitleColorId: "yellow",
      subtitleStyleId: "impact",
      voiceId: "Pon_24000",
    }),
    promptHint: "Продажа через боль, решение и короткий CTA.",
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
    id: "facts-curiosity-loop",
    prefillSettings: createExamplePrefillSettings("ru", {
      musicType: "ai",
      subtitleColorId: "purple",
      subtitleStyleId: "modern",
      voiceId: "Bys_24000",
    }),
    promptHint: "Любопытный факт с удержанием и payoff.",
    seedPrompt:
      "Сделай Shorts в формате любопытного факта о кошках: яркий hook, 3 быстрых наблюдения и короткий финальный вывод с удержанием.",
    summary:
      "Формат для познавательных тем, подборок и каналов с фактами, где важны curiosity loop, surprise и быстрый payoff.",
    tags: ["Факты", "Удержание", "Любопытство"],
    title: "Факт-ролик с визуальным якорем",
    videoSrc: "/3ru.mp4",
  },
  {
    goal: "expert",
    id: "story-mini-scene",
    prefillSettings: createExamplePrefillSettings("ru", {
      musicType: "dramatic",
      subtitleColorId: "white",
      subtitleStyleId: "cinema",
      voiceId: "Ost_24000",
    }),
    promptHint: "Нарастающий интерес и визуальная сцена.",
    seedPrompt:
      "Сделай Shorts про редкую находку в Альпах: атмосферный первый кадр, нарастающий интерес, ощущение загадки и короткий разворот в финале.",
    summary:
      "Полезно для роликов, которые должны ощущаться как маленькая сцена, а не как просто набор фактов.",
    tags: ["Сцена", "Эмоция", "Нарратив"],
    title: "Мини-история с нарастающим интересом",
    videoSrc: "/2ru.mp4",
  },
  {
    goal: "ads",
    id: "ugc-viral-find",
    prefillSettings: createExamplePrefillSettings("ru", {
      musicType: "fun",
      subtitleColorId: "orange",
      subtitleStyleId: "karaoke",
      voiceId: "Tur_24000",
    }),
    promptHint: "Живая подача с ощущением, что ролик снят сейчас.",
    seedPrompt:
      "Сделай viral-style Shorts про продукт для ежедневной привычки: разговорный тон, быстрый hook, ощущение живой находки и нативный CTA.",
    summary:
      "Подходит для тестов, реакций, нативных интеграций и роликов, которые должны ощущаться живыми, быстрыми и невылизанными.",
    tags: ["Viral", "Нативно", "Живо"],
    title: "Viral-подача с эффектом «снято сейчас»",
    videoSrc: "/3ru.mp4",
  },
  {
    goal: "growth",
    id: "effects-wow-frame",
    prefillSettings: createExamplePrefillSettings("ru", {
      musicType: "energetic",
      subtitleColorId: "blue",
      subtitleStyleId: "impact",
      videoMode: "ai_video",
      voiceId: "male-qn-jingying",
    }),
    promptHint: "Визуальный wow-эффект как основной крючок.",
    seedPrompt:
      "Сделай Shorts с визуальным wow-эффектом: первый кадр должен удивлять, дальше 3 быстрые смены сцены и финальный короткий вывод.",
    summary:
      "Формат для роликов, где ключевую роль играет визуальное впечатление, динамика монтажа и цепляющий первый кадр.",
    tags: ["WOW", "Эффект", "Динамика"],
    title: "WOW-сцена с упором на визуальный эффект",
    videoSrc: "/1ru.mp4",
  },
];

const englishExampleCopy: Record<string, Pick<ExampleItem, "promptHint" | "seedPrompt" | "summary" | "tags" | "title"> & {
  prefillSettings?: Partial<ExamplePrefillStudioSettings>;
}> = {
  "story-future-city": {
    prefillSettings: { musicType: "inspirational", subtitleColorId: "cyan", subtitleStyleId: "story", voiceId: "Serena" },
    promptHint: "Atmospheric storytelling with a strong first frame.",
    seedPrompt:
      "Create a storytelling Shorts about how AI changes a familiar city: an atmospheric first frame, 3 short points and a clear final takeaway with no fluff.",
    summary:
      "A format for personal stories, trends and narrative videos where mood, pace and a complete scene matter from the first second.",
    tags: ["Storytelling", "Atmosphere", "Hook"],
    title: "Storytelling with a cinematic first frame",
  },
  "sales-offer-contrast": {
    prefillSettings: { musicType: "business", subtitleColorId: "yellow", subtitleStyleId: "impact", voiceId: "Ryan" },
    promptHint: "A sale through pain, solution and a short CTA.",
    seedPrompt:
      "Create a sales Shorts for an ad setup service: a strong hook about losing customers, then the solution and a short CTA to send a request.",
    summary:
      "Works for services, agencies and experts when you need to show the pain, solution and next step without a long explanation.",
    tags: ["Sales", "Offer", "CTA"],
    title: "Selling a service through contrast and a result promise",
  },
  "facts-curiosity-loop": {
    prefillSettings: { voiceId: "Aiden" },
    promptHint: "A curious fact with retention and payoff.",
    seedPrompt:
      "Create a Shorts in a curious fact format about cats: a bright hook, 3 quick observations and a short final takeaway that keeps retention.",
    summary:
      "A format for educational topics, lists and fact channels where curiosity loop, surprise and fast payoff matter.",
    tags: ["Facts", "Retention", "Curiosity"],
    title: "Fact video with a visual anchor",
  },
  "story-mini-scene": {
    prefillSettings: { musicType: "dramatic", subtitleColorId: "white", subtitleStyleId: "cinema", voiceId: "Vivian" },
    promptHint: "Rising interest and a visual scene.",
    seedPrompt:
      "Create a Shorts about a rare discovery in the Alps: an atmospheric first frame, rising interest, a sense of mystery and a short twist at the end.",
    summary:
      "Useful for videos that should feel like a small scene rather than a simple set of facts.",
    tags: ["Scene", "Emotion", "Narrative"],
    title: "Mini-story with rising interest",
  },
  "ugc-viral-find": {
    prefillSettings: { musicType: "fun", subtitleColorId: "orange", subtitleStyleId: "karaoke", voiceId: "Dylan" },
    promptHint: "A lively delivery that feels shot right now.",
    seedPrompt:
      "Create a viral-style Shorts about a product for a daily habit: conversational tone, fast hook, a live discovery feeling and a native CTA.",
    summary:
      "Works for tests, reactions, native integrations and videos that should feel alive, fast and not overproduced.",
    tags: ["Viral", "Native", "Lively"],
    title: "Viral delivery with a just-shot feel",
  },
  "effects-wow-frame": {
    prefillSettings: { musicType: "energetic", subtitleColorId: "blue", subtitleStyleId: "impact", videoMode: "ai_video", voiceId: "Eric" },
    promptHint: "A visual wow effect as the main hook.",
    seedPrompt:
      "Create a Shorts with a visual wow effect: the first frame should surprise, then 3 quick scene changes and a short final takeaway.",
    summary:
      "A format for videos where visual impression, montage dynamics and a catchy first frame do most of the work.",
    tags: ["WOW", "Effect", "Dynamic"],
    title: "WOW scene focused on a visual effect",
  },
};

const getExampleItemsForLocale = (locale: Locale): ExampleItem[] => {
  if (locale === "ru") return exampleItems;

  return exampleItems.map((item) => {
    const copy = englishExampleCopy[item.id];
    if (!copy) return item;

    return {
      ...item,
      ...copy,
      prefillSettings: createExamplePrefillSettings("en", copy.prefillSettings),
    };
  });
};

const formatExampleOrdinal = (index: number) => String(index + 1).padStart(2, "0");

const getRussianPluralForm = (count: number, forms: [string, string, string]) => {
  const absoluteCount = Math.abs(count) % 100;
  const lastDigit = absoluteCount % 10;

  if (absoluteCount >= 11 && absoluteCount <= 19) {
    return forms[2];
  }

  if (lastDigit === 1) {
    return forms[0];
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return forms[1];
  }

  return forms[2];
};

function ExampleVideoPreview({
  className,
  example,
  overlay,
  priority = false,
  videoClassName,
}: ExampleVideoPreviewProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLButtonElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isInViewport, setIsInViewport] = useState(priority);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<"preview" | "paused" | "sound">("paused");

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

    if (!isInViewport && playbackMode !== "sound") {
      video.pause();
      if (video.currentTime > 0.04) {
        video.currentTime = 0;
      }
      setPlaybackMode("paused");
      return;
    }
  }, [isInViewport, playbackMode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isInViewport || playbackMode === "sound") {
      return;
    }

    if (video.preload !== "auto") {
      video.preload = "auto";
    }

    if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) {
      video.load();
    }
  }, [example.videoSrc, isInViewport, playbackMode]);

  useEffect(() => {
    setPlaybackMode("paused");
  }, [example.videoSrc]);

  useEffect(() => {
    const handleExternalPreviewPlay = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string }>;
      if (customEvent.detail?.id === example.id) {
        return;
      }

      const video = videoRef.current;
      if (!video) {
        return;
      }

      video.pause();
      setPlaybackMode("paused");
    };

    window.addEventListener(EXAMPLE_PREVIEW_PLAY_EVENT, handleExternalPreviewPlay as EventListener);
    return () => window.removeEventListener(EXAMPLE_PREVIEW_PLAY_EVENT, handleExternalPreviewPlay as EventListener);
  }, [example.id]);

  const handlePreviewClick = () => {
    const video = videoRef.current;
    if (!video) return;

    if (playbackMode === "sound" && !video.paused && !video.ended) {
      video.pause();
      setPlaybackMode("paused");
      return;
    }

    window.dispatchEvent(new CustomEvent(EXAMPLE_PREVIEW_PLAY_EVENT, { detail: { id: example.id } }));
    if (video.ended || playbackMode !== "sound") {
      video.currentTime = 0;
    }

    video.loop = false;
    video.defaultMuted = false;
    video.muted = false;
    video.volume = 1;
    setPlaybackMode("sound");
    void video.play().catch(() => {
      setPlaybackMode("paused");
      video.pause();
    });
  };

  const handlePreviewMouseEnter = () => {
    const video = videoRef.current;
    if (!video || !isInViewport || playbackMode === "sound") {
      return;
    }

    video.currentTime = 0;
    video.defaultMuted = true;
    video.muted = true;
    video.loop = true;
    setPlaybackMode("preview");
    void video.play().catch(() => undefined);
  };

  const handlePreviewMouseLeave = () => {
    const video = videoRef.current;
    if (!video || playbackMode === "sound") {
      return;
    }

    video.pause();
    if (video.currentTime > 0.04) {
      video.currentTime = 0;
    }
    setPlaybackMode("paused");
  };

  const media = (
    <>
      <video
        ref={videoRef}
        className={videoClassName}
        src={example.videoSrc}
        poster={example.posterSrc}
        muted={playbackMode !== "sound"}
        loop={playbackMode !== "sound"}
        playsInline
        preload={isInViewport ? "auto" : "none"}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setPlaybackMode("paused");
        }}
      />
      {overlay}
    </>
  );

  return (
    <button
      ref={containerRef}
      className={`${className}${isPlaying ? " is-playing" : ""}${playbackMode === "sound" ? " is-sound-playing" : ""}`}
      type="button"
      onClick={handlePreviewClick}
      onMouseEnter={handlePreviewMouseEnter}
      onMouseLeave={handlePreviewMouseLeave}
      aria-pressed={playbackMode === "sound"}
      aria-label={`${t(examplesMessages.playExample)}: ${example.title}`}
    >
      {media}
    </button>
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
  const { locale, localizePath, t } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const accountPlanLabel = String(workspaceProfile?.plan ?? "").trim().toUpperCase() || "…";
  const initialFilter = (searchParams.get("filter") as ExampleFilter | null) ?? "all";
  const [activeFilter, setActiveFilter] = useState<ExampleFilter>(
    (["all", "ads", "growth", "expert"] as ExampleFilter[]).includes(initialFilter) ? initialFilter : "all"
  );
  const [localExamples, setLocalExamples] = useState<ExampleItem[]>([]);
  const [canManageLocalExamples, setCanManageLocalExamples] = useState(false);
  const [deletingLocalExampleId, setDeletingLocalExampleId] = useState<string | null>(null);
  const [localExampleDeleteError, setLocalExampleDeleteError] = useState<string | null>(null);
  const knownGoals = new Set<string>(["ads", "growth", "expert"]);
  const filteredLocalExamples = localExamples.filter((e) => knownGoals.has(e.goal));
  const localeExampleItems = getExampleItemsForLocale(locale);
  const goalCopy = exampleGoalCopy[locale];
  const allExamples = filteredLocalExamples.length > 0 ? filteredLocalExamples : localeExampleItems;
  const totalThemeCount = new Set(allExamples.map((example) => example.goal)).size;
  const totalSceneCount = allExamples.length;
  const exampleFilterOptions: Array<{ id: ExampleFilter; label: string }> = [
    { id: "all", label: t(examplesMessages.all) },
    ...exampleGoalOrder
      .filter((goal) => allExamples.some((example) => example.goal === goal))
      .map((goal) => ({
        id: goal,
        label: goalCopy[goal].shortLabel,
      })),
  ];
  const visibleExamples = activeFilter === "all" ? allExamples : allExamples.filter((example) => example.goal === activeFilter);

  useEffect(() => {
    if (!session) return;

    const pendingIntent = readExamplePrefillIntent();
    if (!pendingIntent) return;

    navigate(localizePath("/app/studio"), { replace: true });
  }, [localizePath, navigate, session]);

  useEffect(() => {
    let cancelled = false;

    const loadLocalExamples = async () => {
      try {
        const response = await fetch("/api/examples/local");
        const payload = (await response.json().catch(() => null)) as LocalExamplesResponse | null;
        if (!response.ok || !payload?.data?.enabled) {
          if (!cancelled) {
            setLocalExamples([]);
            setCanManageLocalExamples(false);
            setLocalExampleDeleteError(null);
          }
          return;
        }

        if (!cancelled) {
          setLocalExamples(Array.isArray(payload.data.items) ? payload.data.items : []);
          setCanManageLocalExamples(Boolean(payload.data.canManage && session));
          setLocalExampleDeleteError(null);
        }
      } catch {
        if (!cancelled) {
          setLocalExamples([]);
          setCanManageLocalExamples(false);
        }
      }
    };

    void loadLocalExamples();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (activeFilter === "all") {
      return;
    }

    if (!exampleFilterOptions.some((item) => item.id === activeFilter)) {
      setActiveFilter("all");
    }
  }, [activeFilter, exampleFilterOptions]);

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

  const openExampleInStudio = (example: ExampleItem) => {
    const intent = {
      exampleId: example.id,
      prompt: example.seedPrompt,
      settings: example.prefillSettings ?? null,
    } satisfies ExamplePrefillIntent;

    writeExamplePrefillIntent(intent);

    if (session) {
      navigate(localizePath("/app/studio"));
      return;
    }

    onOpenSignup();
  };

  const handleDeleteLocalExample = async (exampleId: string) => {
    if (!session || !canManageLocalExamples || deletingLocalExampleId) {
      return;
    }

    setDeletingLocalExampleId(exampleId);
    setLocalExampleDeleteError(null);

    try {
      const response = await fetch(`/api/examples/local/${encodeURIComponent(exampleId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as LocalExampleDeleteResponse | null;

      if (!response.ok || payload?.data?.exampleId !== exampleId) {
        throw new Error(payload?.error ?? t(examplesMessages.deleteFailed));
      }

      setLocalExamples((current) => current.filter((item) => item.id !== exampleId));
    } catch (error) {
      setLocalExampleDeleteError(error instanceof Error ? error.message : t(examplesMessages.deleteFailed));
    } finally {
      setDeletingLocalExampleId((current) => (current === exampleId ? null : current));
    }
  };

  return (
    <div className="route-page examples-page">
      <header className="site-header" id="top">
        <div className="container site-header__inner">
          <Link className="brand" to={localizePath("/")} aria-label="AdShorts AI">
            <img src="/logo.png" alt="" width="44" height="44" />
            <span>AdShorts AI</span>
          </Link>

          <PrimarySiteNav activeItem="examples" onOpenStudio={openPrimaryFlow} onOpenStudioSection={openStudioSection} />

          <div className="site-header__actions">
            <LanguageSwitcher />
            {session ? (
              <>
                <SiteHeaderWorkspaceStatus profile={workspaceProfile} />
                <AccountMenuButton email={session.email} name={session.name} onLogout={onLogout} plan={accountPlanLabel} />
              </>
            ) : (
              <button className="site-header__signin route-button" type="button" onClick={onOpenSignin}>
                {t(examplesMessages.signIn)}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="examples-modern">
        <section className="examples-modern__hero">
          <div className="container">
            <div className="examples-modern__hero-grid">
              <div className="examples-modern__hero-copy">
                <h1>{t(examplesMessages.heroHeading)}</h1>
                <p className="examples-modern__hero-lead">{t(examplesMessages.heroLead)}</p>

                <div className="examples-modern__hero-facts" aria-label={t(examplesMessages.heroAria)}>
                  <article className="examples-modern__hero-fact">
                    <strong>{totalThemeCount}</strong>
                    <span>{locale === "en" ? (totalThemeCount === 1 ? "theme" : "themes") : getRussianPluralForm(totalThemeCount, ["тема", "темы", "тем"])}</span>
                  </article>
                  <article className="examples-modern__hero-fact">
                    <strong>{totalSceneCount}</strong>
                    <span>{locale === "en" ? (totalSceneCount === 1 ? "ready scene" : "ready scenes") : getRussianPluralForm(totalSceneCount, ["готовая сцена", "готовые сцены", "готовых сцен"])}</span>
                  </article>
                  <article className="examples-modern__hero-fact">
                    <strong>{t(examplesMessages.oneClick)}</strong>
                    <span>{t(examplesMessages.studioDistance)}</span>
                  </article>
                </div>
              </div>

              <aside className="examples-modern__hero-panel" aria-label={t(examplesMessages.howItWorks)}>
                <span className="examples-modern__hero-panel-label">{t(examplesMessages.howItWorks)}</span>
                <strong className="examples-modern__hero-panel-title">{t(examplesMessages.startFast)}</strong>

                <div className="examples-modern__hero-steps">
                  <article className="examples-modern__hero-step">
                    <span className="examples-modern__hero-step-number">01</span>
                    <div>
                      <strong>{t(examplesMessages.stepChoose)}</strong>
                      <p>{t(examplesMessages.stepChooseText)}</p>
                    </div>
                  </article>

                  <article className="examples-modern__hero-step">
                    <span className="examples-modern__hero-step-number">02</span>
                    <div>
                      <strong>{t(examplesMessages.stepUse)}</strong>
                      <p>{t(examplesMessages.stepUseText)}</p>
                    </div>
                  </article>

                  <article className="examples-modern__hero-step">
                    <span className="examples-modern__hero-step-number">03</span>
                    <div>
                      <strong>{t(examplesMessages.stepGet)}</strong>
                      <p>{t(examplesMessages.stepGetText)}</p>
                    </div>
                  </article>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="section examples-modern__catalog">
          <div className="container examples-modern__catalog-inner">
            <div className="examples-modern__filters-shell">
              <div className="examples-modern__filters" aria-label={t(examplesMessages.filters)}>
                {exampleFilterOptions.map((item) => (
                  <button
                    key={item.id}
                    className={`examples-modern__filter${activeFilter === item.id ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setActiveFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="examples-modern__grid">
              {visibleExamples.map((example, index) => (
                <article key={example.id} className="examples-modern__card">
                  {example.isLocal && canManageLocalExamples ? (
                    <button
                      className="examples-modern__delete"
                      type="button"
                      aria-label={t(examplesMessages.deleteExample)}
                      title={t(examplesMessages.deleteExample)}
                      disabled={deletingLocalExampleId === example.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDeleteLocalExample(example.id);
                      }}
                    >
                      {deletingLocalExampleId === example.id ? (
                        <span className="examples-modern__delete-spinner" aria-hidden="true"></span>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M6 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <path d="M9.5 4h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <path d="M10 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <path d="M14 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <path d="m7 7 1 11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  ) : null}
                  <ExampleVideoPreview
                    className="examples-modern__preview"
                    example={example}
                    overlay={
                      <>
                        <div className="examples-modern__preview-bar">
                          <span className="examples-modern__preview-goal">{(goalCopy[example.goal] ?? goalCopy["ads"]).shortLabel}</span>
                          {!example.isLocal ? <span className="examples-modern__preview-index">{formatExampleOrdinal(index)}</span> : null}
                        </div>
                        <div className="examples-modern__preview-copy">
                          <h3 className="examples-modern__preview-title">{example.title}</h3>
                        </div>
                      </>
                    }
                    priority={index < 4}
                    videoClassName="examples-modern__preview-video"
                  />

                  <div className="examples-modern__card-body">
                    <button className="examples-modern__use route-button" type="button" onClick={() => openExampleInStudio(example)}>
                      {t(examplesMessages.use)}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {localExampleDeleteError ? (
              <p className="examples-modern__error" role="alert">
                {localExampleDeleteError}
              </p>
            ) : null}

            <div className="examples-modern__catalog-footer">
              <p>{t(examplesMessages.emptyProject)}</p>
              <button className="examples-modern__secondary route-button" type="button" onClick={openPrimaryFlow}>
                {t(examplesMessages.openStudio)}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
