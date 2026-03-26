import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AccountMenuButton } from "../components/AccountMenuButton";
import { PrimarySiteNav } from "../components/PrimarySiteNav";

type WorkspaceTab = "overview" | "studio" | "generations" | "billing" | "settings";

type Session = {
  name: string;
  email: string;
  plan: string;
};

type WorkspaceProfile = {
  balance: number;
  plan: string;
};

type Props = {
  defaultTab: WorkspaceTab;
  session: Session;
  onLogout: () => void | Promise<void>;
};

type StudioGeneration = {
  aspectRatio: string;
  description: string;
  durationLabel: string;
  generatedAt: string;
  hashtags: string[];
  id: string;
  modelLabel: string;
  prompt: string;
  title: string;
  videoUrl: string;
};

type StudioGenerationJob = {
  jobId: string;
  profile: WorkspaceProfile;
  status: string;
  title: string;
};

type StudioGenerationStartResponse = {
  data?: StudioGenerationJob;
  error?: string;
};

type StudioGenerationStatusPayload = {
  error?: string;
  generation?: StudioGeneration;
  jobId: string;
  status: string;
};

type StudioGenerationStatusResponse = {
  data?: StudioGenerationStatusPayload;
  error?: string;
};

type WorkspaceBootstrapPayload = {
  latestGeneration?: StudioGenerationStatusPayload | null;
  profile: WorkspaceProfile;
};

type WorkspaceBootstrapResponse = {
  data?: WorkspaceBootstrapPayload;
  error?: string;
};

type WorkspaceProject = {
  adId: number | null;
  createdAt: string;
  description: string;
  generatedAt: string | null;
  hashtags: string[];
  id: string;
  jobId: string | null;
  prompt: string;
  source: "project" | "task";
  status: string;
  title: string;
  updatedAt: string;
  videoUrl: string | null;
};

type WorkspaceProjectsPayload = {
  projects: WorkspaceProject[];
};

type WorkspaceProjectsResponse = {
  data?: WorkspaceProjectsPayload;
  error?: string;
};

const studioPromptTools = ["Img", "Vid", "Sfx"];
const studioPromptChips = ["Видео", "Субтитры", "Озвучка", "Музыка", "Бренд", "Сегменты", "Язык"];

const getStudioStatusLabel = (value: string) => {
  switch (value) {
    case "queued":
      return "Task queued";
    case "processing":
      return "Генерация видео...";
    case "retrying":
      return "Retrying generation...";
    case "done":
      return "";
    case "failed":
      return "Generation failed";
    default:
      return "Генерация видео...";
  }
};

const getProjectStatusLabel = (value: string) => {
  switch (value) {
    case "ready":
      return "Готов";
    case "queued":
      return "В очереди";
    case "processing":
      return "Генерация";
    case "failed":
      return "Ошибка";
    case "draft":
      return "Черновик";
    default:
      return "Проект";
  }
};

const getProjectStatusClassName = (value: string) => {
  switch (value) {
    case "ready":
      return "account-status--ready";
    case "queued":
    case "processing":
      return "account-status--processing";
    case "failed":
      return "account-status--failed";
    default:
      return "account-status--draft";
  }
};

const formatProjectDate = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Дата недоступна";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const tabCopy: Record<
  WorkspaceTab,
  {
    eyebrow: string;
    heading: string;
    subtitle: string;
  }
> = {
  overview: {
    eyebrow: "Personal workspace",
    heading: "Личный кабинет AdShorts AI",
    subtitle:
      "Управляйте генерациями, тарифом, каналами публикации и рабочими пресетами из одного workspace.",
  },
  studio: {
    eyebrow: "Студия Shorts",
    heading: "",
    subtitle: "",
  },
  generations: {
    eyebrow: "Проекты",
    heading: "Все проекты аккаунта",
    subtitle: "Здесь собраны все генерации и готовые Shorts, связанные с вашим аккаунтом в общей БД.",
  },
  billing: {
    eyebrow: "Billing & usage",
    heading: "Тариф и usage",
    subtitle: "Контролируйте лимиты, инвойсы, оплату команды и ежемесячную загрузку workspace.",
  },
  settings: {
    eyebrow: "Settings",
    heading: "Настройки workspace",
    subtitle: "Профиль, интеграции, уведомления и безопасность собраны в одной панели.",
  },
};

export function WorkspacePage({ defaultTab, session, onLogout }: Props) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(defaultTab);
  const [topicInput, setTopicInput] = useState("AI tools");
  const [status, setStatus] = useState("Ready to generate");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [workspaceProfile, setWorkspaceProfile] = useState<WorkspaceProfile | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<StudioGeneration | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [hasLoadedProjects, setHasLoadedProjects] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const generationRunRef = useRef(0);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
      generationRunRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.body.classList.toggle("modal-open", isPreviewModalOpen);

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [isPreviewModalOpen]);

  useEffect(() => {
    if (!isPreviewModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPreviewModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPreviewModalOpen]);

  useEffect(() => {
    if (activeTab !== "studio" && isPreviewModalOpen) {
      setIsPreviewModalOpen(false);
    }
  }, [activeTab, isPreviewModalOpen]);

  useEffect(() => {
    setProjects([]);
    setProjectsError(null);
    setHasLoadedProjects(false);
  }, [session.email]);

  useEffect(() => {
    if (!generatedVideo?.id) return;
    setHasLoadedProjects(false);
  }, [generatedVideo?.id]);

  useEffect(() => {
    if (activeTab !== "generations" || hasLoadedProjects) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort("projects-timeout"), 12000);

    const loadProjects = async () => {
      setIsProjectsLoading(true);
      setProjectsError(null);

      try {
        const response = await fetch("/api/workspace/projects", {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as WorkspaceProjectsResponse | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error ?? "Failed to load projects.");
        }

        setProjects(payload.data.projects);
      } catch (error) {
        if (controller.signal.aborted) {
          if (controller.signal.reason === "projects-timeout") {
            setProjectsError("Сервер слишком долго отвечает. Попробуйте обновить вкладку Проекты.");
            setHasLoadedProjects(true);
          }

          return;
        }

        setProjectsError(error instanceof Error ? error.message : "Failed to load projects.");
        setHasLoadedProjects(true);
      } finally {
        window.clearTimeout(timeoutId);
        setIsProjectsLoading(false);
      }
    };

    void loadProjects();

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [activeTab, hasLoadedProjects]);

  const header = tabCopy[activeTab];
  const sectionTitleId = header.heading ? "account-shell-title" : undefined;
  const workspacePlan = workspaceProfile?.plan ?? session.plan;
  const workspaceBalance = workspaceProfile?.balance ?? 1;
  const generatedVideoTopic = generatedVideo?.prompt ?? "";
  const generatedVideoTitle = generatedVideo?.title ?? "";
  const generatedVideoDescription = generatedVideo?.description ?? "";
  const generatedVideoHashtags = generatedVideo?.hashtags ?? [];
  const hasGeneratedVideoTitle = Boolean(generatedVideoTitle);
  const hasGeneratedVideoDescription = Boolean(generatedVideoDescription);
  const hasGeneratedVideoHashtags = generatedVideoHashtags.length > 0;
  const hasGeneratedPublishMeta =
    hasGeneratedVideoTitle || hasGeneratedVideoDescription || hasGeneratedVideoHashtags;
  const generatedVideoModalTitle = hasGeneratedVideoTitle ? generatedVideoTitle : "Результат генерации";
  const readyProjectsCount = projects.filter((project) => project.status === "ready").length;
  const activeProjectsCount = projects.filter(
    (project) => project.status === "queued" || project.status === "processing",
  ).length;
  const failedProjectsCount = projects.filter((project) => project.status === "failed").length;

  const pollGenerationJob = async (jobId: string, initialStatus = "queued") => {
    const safeJobId = jobId.trim();

    if (!safeJobId) {
      setGenerateError("Generation job is missing.");
      setStatus("Generation failed");
      return;
    }

    setIsGenerating(true);
    setStatus(getStudioStatusLabel(initialStatus));
    generationRunRef.current += 1;
    const runId = generationRunRef.current;

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    try {
      let latestStatus = initialStatus;

      while (generationRunRef.current === runId) {
        const statusResponse = await fetch(`/api/studio/generations/${encodeURIComponent(safeJobId)}`);
        const statusPayload = (await statusResponse.json().catch(() => null)) as StudioGenerationStatusResponse | null;

        if (!statusResponse.ok || !statusPayload?.data) {
          throw new Error(statusPayload?.error ?? "Failed to fetch generation status.");
        }

        latestStatus = statusPayload.data.status;
        setStatus(getStudioStatusLabel(latestStatus));

        if (statusPayload.data.generation) {
          setGeneratedVideo(statusPayload.data.generation);
          setGenerateError(statusPayload.data.error ?? null);
          setTopicInput(statusPayload.data.generation.prompt);
          setStatus("");
          break;
        }

        if (latestStatus === "failed") {
          throw new Error(statusPayload.data.error ?? "Generation failed.");
        }

        await new Promise((resolve) => window.setTimeout(resolve, 2500));
      }

      if (generationRunRef.current !== runId) {
        return;
      }

      resetTimerRef.current = window.setTimeout(() => {
        setStatus("Ready to generate");
        resetTimerRef.current = null;
      }, 2200);
    } catch (error) {
      if (generationRunRef.current !== runId) {
        return;
      }

      setStatus("Generation failed");
      setGenerateError(error instanceof Error ? error.message : "Failed to generate task.");
    } finally {
      if (generationRunRef.current === runId) {
        setIsGenerating(false);
      }
    }
  };

  const handleGenerate = async (nextTopic: string) => {
    if (workspaceBalance <= 0) {
      navigate("/pricing");
      return;
    }

    const safeTopic = nextTopic.trim();

    if (!safeTopic.trim()) {
      setGenerateError("Введите prompt для генерации.");
      setStatus("Prompt required");
      return;
    }

    setTopicInput(safeTopic);
    setIsPreviewModalOpen(false);
    setGenerateError(null);
    setHasLoadedProjects(false);
    setStatus("Task queued");

    try {
      const response = await fetch("/api/studio/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: safeTopic }),
      });

      const payload = (await response.json().catch(() => null)) as StudioGenerationStartResponse | null;

      if (response.status === 402) {
        navigate("/pricing");
        return;
      }

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Failed to create generation task.");
      }

      setGeneratedVideo(null);
      setWorkspaceProfile(payload.data.profile);
      await pollGenerationJob(payload.data.jobId, payload.data.status);
    } catch (error) {
      setStatus("Generation failed");
      setGenerateError(error instanceof Error ? error.message : "Failed to generate task.");
    }
  };

  const handleAccountLogout = async () => {
    await onLogout();
  };

  const handlePublishPreview = () => {
    setIsPreviewModalOpen(false);
    setActiveTab("generations");
  };

  const handleEditPreview = () => {
    setIsPreviewModalOpen(false);
    setActiveTab("studio");
  };

  const handleRegeneratePreview = async () => {
    if (!generatedVideo) return;

    setIsPreviewModalOpen(false);
    await handleGenerate(generatedVideo.prompt);
  };

  const handleUpgradePreview = () => {
    setIsPreviewModalOpen(false);
    setActiveTab("billing");
  };

  useEffect(() => {
    let isCancelled = false;

    const bootstrapWorkspace = async () => {
      try {
        const response = await fetch("/api/workspace/bootstrap");
        const payload = (await response.json().catch(() => null)) as WorkspaceBootstrapResponse | null;

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error ?? "Failed to bootstrap workspace.");
        }

        if (isCancelled) return;

        setWorkspaceProfile(payload.data.profile);

        const latestGeneration = payload.data.latestGeneration;
        if (!latestGeneration) return;

        if (latestGeneration.generation) {
          setGeneratedVideo(latestGeneration.generation);
          setGenerateError(latestGeneration.error ?? null);
          setTopicInput(latestGeneration.generation.prompt);
        }

        if (latestGeneration.status === "done") {
          setStatus("");
          setIsGenerating(false);
          return;
        }

        if (latestGeneration.status === "failed") {
          setStatus("Generation failed");
          setGenerateError(latestGeneration.error ?? "Generation failed.");
          setIsGenerating(false);
          return;
        }

        setStatus(getStudioStatusLabel(latestGeneration.status));
        void pollGenerationJob(latestGeneration.jobId, latestGeneration.status);
      } catch (error) {
        if (isCancelled) return;
        console.error("[workspace] Failed to bootstrap workspace", error);
      }
    };

    void bootstrapWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [session.email]);

  const studioPromptStage = (
    <div className="studio-prompt-stage">
      <div className="studio-prompt-stage__frame">
        <div className="studio-prompt-stage__toolbar" aria-hidden="true">
          {studioPromptTools.map((tool, index) => (
            <span className={`studio-prompt-stage__tool${index === 1 ? " is-active" : ""}`} key={tool}>
              {tool === "Img" ? <img src="/hybrid.png" alt="" width="36" height="36" aria-hidden="true" /> : tool}
            </span>
          ))}
        </div>

        <div className="studio-prompt-stage__main">
          <div className="studio-prompt-stage__head">
            <span className="results-label">Тема Shorts</span>
            {status ? <span className="status-pill status-pill--soft">{status}</span> : null}
          </div>

          <label className="composer-field composer-field--prompt">
            <textarea
              aria-label="Тема Shorts"
              className="composer-field__textarea composer-field__textarea--stage"
              placeholder="Опишите идею"
              value={topicInput}
              onChange={(event) => setTopicInput(event.target.value)}
            />
          </label>

          <div className="studio-prompt-stage__footer">
            <div className="studio-prompt-stage__chips" aria-hidden="true">
              {studioPromptChips.map((chip) => (
                <span className="studio-prompt-stage__chip" key={chip}>
                  {chip}
                </span>
              ))}
            </div>

            <button
              className={`btn btn--studio route-button${isGenerating ? " is-working" : ""}`}
              type="button"
              onClick={() => handleGenerate(topicInput)}
            >
              {isGenerating ? "Generating..." : "Создать Shorts"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="route-page workspace-route">
      <header className="site-header site-header--workspace">
        <div className="container site-header__inner">
          <Link className="brand" to="/" aria-label="AdShorts AI">
            <img src="/logo.png" alt="" width="44" height="44" />
            <span>AdShorts AI</span>
          </Link>

          <PrimarySiteNav activeItem={activeTab === "studio" ? "studio" : null} onOpenStudio={() => setActiveTab("studio")} />

          <div className="site-header__actions">
            <a
              className="site-header__link"
              href="https://t.me/AdShortsAIBot"
              target="_blank"
              rel="noopener noreferrer"
            >
              Telegram
            </a>
            <AccountMenuButton email={session.email} name={session.name} onLogout={handleAccountLogout} plan={workspacePlan} />
          </div>
        </div>
      </header>

      <main className="workspace-route__main">
        <div className="workspace-route__scene" aria-hidden="true">
          <span className="hero__scene-stars"></span>
          <span className="hero__scene-glow hero__scene-glow--left"></span>
          <span className="hero__scene-glow hero__scene-glow--center"></span>
          <span className="hero__scene-glow hero__scene-glow--right"></span>
          <span className="hero__scene-orbit hero__scene-orbit--one"></span>
          <span className="hero__scene-orbit hero__scene-orbit--two"></span>
          <span className="hero__scene-beam"></span>
        </div>

        <section
          className="account-shell--page workspace-route__shell"
          aria-labelledby={sectionTitleId}
          aria-label={sectionTitleId ? undefined : header.eyebrow}
        >
          <div className="account-shell__frame">
        <aside className="account-shell__sidebar">
          <div className="account-user account-user--summary">
            <div className="account-user__summary-row">
              <span>Тариф</span>
              <strong>{workspacePlan}</strong>
            </div>
            <div className="account-user__summary-row">
              <span>Баланс</span>
              <strong>{workspaceBalance} credits</strong>
            </div>
          </div>

          <nav className="account-nav" aria-label="Личный кабинет">
            <button
              className={`account-nav__item${activeTab === "overview" ? " is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("overview")}
            >
              <strong>Обзор</strong>
              <span>Метрики и активность</span>
            </button>
            <button
              className={`account-nav__item${activeTab === "studio" ? " is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("studio")}
            >
              <strong>Студия</strong>
              <span>Создание Shorts</span>
            </button>
            <button
              className={`account-nav__item${activeTab === "generations" ? " is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("generations")}
            >
              <strong>Проекты</strong>
              <span>Все созданные Shorts</span>
            </button>
            <button
              className={`account-nav__item${activeTab === "billing" ? " is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("billing")}
            >
              <strong>Использование</strong>
              <span>Тариф, лимиты и оплата</span>
            </button>
            <button
              className={`account-nav__item${activeTab === "settings" ? " is-active" : ""}`}
              type="button"
              onClick={() => setActiveTab("settings")}
            >
              <strong>Настройки</strong>
              <span>Профиль и интеграции</span>
            </button>
          </nav>

        </aside>

        <div className="account-shell__content">
          <div className={`account-shell__topbar${activeTab === "studio" ? " account-shell__topbar--studio" : ""}`}>
            <div className="account-shell__topbar-copy">
              <p className="account-shell__eyebrow">{header.eyebrow}</p>
              {header.heading ? <h2 id="account-shell-title">{header.heading}</h2> : null}
              {header.subtitle ? <p className="account-shell__subtitle">{header.subtitle}</p> : null}
            </div>
          </div>

          <div className={`account-shell__body${activeTab === "studio" ? " account-shell__body--studio" : ""}`}>
            {activeTab === "overview" && (
              <section className="account-panel is-active" data-account-panel="overview">
                <div className="account-stats">
                  <article className="account-stat">
                    <span>Кредиты</span>
                    <strong>184</strong>
                  </article>
                  <article className="account-stat">
                    <span>Экспортов в марте</span>
                    <strong>126</strong>
                  </article>
                  <article className="account-stat">
                    <span>Подключенные каналы</span>
                    <strong>2</strong>
                  </article>
                </div>

                <div className="account-layout">
                  <div className="account-stack">
                    <article className="account-card">
                      <div className="account-card__head">
                        <div>
                          <h3>Публикация</h3>
                          <p>Текущая готовность каналов и автопостинга.</p>
                        </div>
                      </div>

                      <div className="account-checklist">
                        <div className="account-checklist__item">
                          <span>YouTube Shorts</span>
                          <strong>Connected</strong>
                        </div>
                        <div className="account-checklist__item">
                          <span>TikTok</span>
                          <strong>Connected</strong>
                        </div>
                        <div className="account-checklist__item">
                          <span>Instagram Reels</span>
                          <strong>Needs OAuth</strong>
                        </div>
                      </div>
                    </article>

                    <article className="account-card">
                      <div className="account-card__head">
                        <div>
                          <h3>План и usage</h3>
                          <p>Текущий тариф и расход на команду.</p>
                        </div>
                        <span className="account-pill">Growth</span>
                      </div>

                      <div className="account-usage">
                        <div className="account-usage__meta">
                          <span>642 / 1000 credits used</span>
                          <strong>64%</strong>
                        </div>
                        <div className="account-usage__bar">
                          <span className="account-usage__fill" style={{ width: "64%" }}></span>
                        </div>
                      </div>
                    </article>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "studio" && (
              <section className="account-panel is-active account-section account-section--studio" data-account-panel="studio">
                {isGenerating || generatedVideo || generateError ? (
                  <div className={`studio-live-stage${isGenerating ? " is-generating" : ""}`}>
                    <div className="studio-live-stage__surface">
                      <div className="studio-live-stage__media">
                        {generatedVideo ? (
                          <button
                            className="studio-live-stage__preview route-button"
                            type="button"
                            aria-label={hasGeneratedVideoTitle ? `Открыть превью: ${generatedVideoTitle}` : "Открыть превью видео"}
                            onClick={() => setIsPreviewModalOpen(true)}
                          >
                            <video
                              key={generatedVideo.id}
                              className="studio-live-stage__video"
                              src={generatedVideo.videoUrl}
                              autoPlay
                              loop
                              muted
                              playsInline
                              preload="metadata"
                            />
                          </button>
                        ) : (
                          <div className={`studio-live-stage__placeholder${generateError ? " is-error" : ""}`}>
                            {isGenerating ? <span className="studio-live-stage__spinner" aria-hidden="true"></span> : null}
                            <strong>{isGenerating ? "Генерация видео..." : "Generation failed"}</strong>
                            <p>{isGenerating ? null : generateError}</p>
                          </div>
                        )}

                        {isGenerating && generatedVideo ? (
                          <div className="studio-live-stage__overlay">
                            <span className="studio-live-stage__spinner" aria-hidden="true"></span>
                            <strong>Генерация видео...</strong>
                          </div>
                        ) : null}
                      </div>

                      {generateError && generatedVideo ? <p className="studio-live-stage__error">{generateError}</p> : null}
                    </div>
                  </div>
                ) : null}
              </section>
            )}

            {activeTab === "generations" && (
              <section className="account-panel is-active" data-account-panel="generations">
                <div className="account-card__head account-card__head--panel">
                  <div>
                    <h3>Проекты аккаунта</h3>
                    <p>Список генераций и готовых Shorts, найденных для текущего аккаунта в общей БД.</p>
                  </div>
                  <div className="account-pills">
                    <span className="account-pill">Готово: {readyProjectsCount}</span>
                    <span className="account-pill">В работе: {activeProjectsCount}</span>
                    <span className="account-pill">Ошибки: {failedProjectsCount}</span>
                  </div>
                </div>

                {isProjectsLoading ? (
                  <article className="account-empty-state">
                    <strong>Загружаем проекты...</strong>
                    <p>Собираем список генераций и готовых видео из базы данных аккаунта.</p>
                  </article>
                ) : null}

                {!isProjectsLoading && projectsError ? (
                  <article className="account-empty-state account-empty-state--error">
                    <strong>Не удалось загрузить проекты</strong>
                    <p>{projectsError}</p>
                    <button
                      className="account-linkbtn route-button"
                      type="button"
                      onClick={() => {
                        setProjectsError(null);
                        setHasLoadedProjects(false);
                      }}
                    >
                      Повторить загрузку
                    </button>
                  </article>
                ) : null}

                {!isProjectsLoading && !projectsError && !projects.length ? (
                  <article className="account-empty-state">
                    <strong>Проектов пока нет</strong>
                    <p>Как только в этом аккаунте появятся созданные Shorts, они отобразятся в этой вкладке.</p>
                  </article>
                ) : null}

                {!isProjectsLoading && !projectsError && projects.length ? (
                  <div className="account-library account-library--projects">
                    {projects.map((project) => (
                      <article className="account-library__item account-project-card" key={project.id}>
                        <div className="account-project-card__meta">
                          <span className="account-library__label">
                            {project.adId ? `Проект #${project.adId}` : `Job ${project.jobId?.slice(0, 8) ?? "N/A"}`}
                          </span>
                          <span className={`account-status ${getProjectStatusClassName(project.status)}`}>
                            {getProjectStatusLabel(project.status)}
                          </span>
                        </div>

                        <h4>{project.title}</h4>
                        <p>{project.description}</p>

                        <div className="account-project-card__details">
                          <div className="account-project-card__detail">
                            <span>Тема</span>
                            <strong>{project.prompt || "Без темы"}</strong>
                          </div>
                          <div className="account-project-card__detail">
                            <span>Источник</span>
                            <strong>{project.source === "task" ? "Generation task" : "Saved project"}</strong>
                          </div>
                          <div className="account-project-card__detail">
                            <span>Обновлен</span>
                            <strong>{formatProjectDate(project.updatedAt)}</strong>
                          </div>
                        </div>

                        {project.hashtags.length ? (
                          <div className="account-project-card__tags" aria-label="Хэштеги проекта">
                            {project.hashtags.map((tag) => (
                              <span key={`${project.id}-${tag}`}>{tag}</span>
                            ))}
                          </div>
                        ) : null}

                        <div className="account-project-card__footer">
                          <span>
                            Создан: {formatProjectDate(project.createdAt)}
                            {project.generatedAt ? ` · Готов: ${formatProjectDate(project.generatedAt)}` : ""}
                          </span>

                          {project.videoUrl ? (
                            <a
                              className="account-linkbtn"
                              href={project.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Открыть видео
                            </a>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            )}

            {activeTab === "billing" && (
              <section className="account-panel is-active" data-account-panel="billing">
                <div className="account-layout">
                  <article className="account-card">
                    <div className="account-card__head">
                      <div>
                        <h3>Текущий тариф</h3>
                        <p>Growth plan с monthly batch-лимитами и командным доступом.</p>
                      </div>
                      <span className="account-pill">Next invoice Apr 12</span>
                    </div>

                    <div className="account-billing">
                      <div className="account-billing__row">
                        <span>Monthly price</span>
                        <strong>$79</strong>
                      </div>
                      <div className="account-billing__row">
                        <span>Seats</span>
                        <strong>3 editors</strong>
                      </div>
                      <div className="account-billing__row">
                        <span>Included credits</span>
                        <strong>1000 / mo</strong>
                      </div>
                    </div>

                    <div className="account-usage">
                      <div className="account-usage__meta">
                        <span>Storage used</span>
                        <strong>72%</strong>
                      </div>
                      <div className="account-usage__bar">
                        <span className="account-usage__fill" style={{ width: "72%" }}></span>
                      </div>
                    </div>
                  </article>

                  <div className="account-stack">
                    <article className="account-card">
                      <div className="account-card__head">
                        <div>
                          <h3>Инвойсы</h3>
                          <p>Последние списания и документы.</p>
                        </div>
                      </div>

                      <div className="account-invoices">
                        <div className="account-invoice">
                          <span>Mar 2026</span>
                          <strong>$79 paid</strong>
                        </div>
                        <div className="account-invoice">
                          <span>Feb 2026</span>
                          <strong>$79 paid</strong>
                        </div>
                        <div className="account-invoice">
                          <span>Jan 2026</span>
                          <strong>$49 paid</strong>
                        </div>
                      </div>
                    </article>

                    <article className="account-card">
                      <div className="account-card__head">
                        <div>
                          <h3>Payment method</h3>
                          <p>Основной способ оплаты команды.</p>
                        </div>
                      </div>

                      <div className="account-checklist">
                        <div className="account-checklist__item">
                          <span>Visa ending in 2048</span>
                          <strong>Primary</strong>
                        </div>
                        <div className="account-checklist__item">
                          <span>Billing email</span>
                          <strong>finance@adshorts.ai</strong>
                        </div>
                      </div>
                    </article>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "settings" && (
              <section className="account-panel is-active" data-account-panel="settings">
                <div className="account-formgrid">
                  <article className="account-card">
                    <div className="account-card__head">
                      <div>
                        <h3>Profile</h3>
                        <p>Основные данные аккаунта и workspace owner.</p>
                      </div>
                    </div>

                    <div className="account-fields">
                      <div className="account-field">
                        <span>Name</span>
                        <strong>{session.name}</strong>
                      </div>
                      <div className="account-field">
                        <span>Email</span>
                        <strong>{session.email}</strong>
                      </div>
                      <div className="account-field">
                        <span>Workspace</span>
                        <strong>AdShorts Growth Team</strong>
                      </div>
                    </div>
                  </article>

                  <article className="account-card">
                    <div className="account-card__head">
                      <div>
                        <h3>Integrations</h3>
                        <p>Подключения и состояние API/каналов.</p>
                      </div>
                    </div>

                    <div className="account-checklist">
                      <div className="account-checklist__item">
                        <span>YouTube publish API</span>
                        <strong>Connected</strong>
                      </div>
                      <div className="account-checklist__item">
                        <span>Google OAuth</span>
                        <strong>Healthy</strong>
                      </div>
                      <div className="account-checklist__item">
                        <span>Webhook exports</span>
                        <strong>Pending setup</strong>
                      </div>
                    </div>
                  </article>

                  <article className="account-card">
                    <div className="account-card__head">
                      <div>
                        <h3>Notifications</h3>
                        <p>Что будет приходить команде по email и в product UI.</p>
                      </div>
                    </div>

                    <div className="account-checklist">
                      <div className="account-checklist__item">
                        <span>Generation finished</span>
                        <strong>Enabled</strong>
                      </div>
                      <div className="account-checklist__item">
                        <span>Weekly usage digest</span>
                        <strong>Enabled</strong>
                      </div>
                      <div className="account-checklist__item">
                        <span>Billing reminders</span>
                        <strong>Enabled</strong>
                      </div>
                    </div>
                  </article>

                  <article className="account-card">
                    <div className="account-card__head">
                      <div>
                        <h3>Security</h3>
                        <p>Доступ, сессии и безопасность аккаунта.</p>
                      </div>
                    </div>

                    <div className="account-checklist">
                      <div className="account-checklist__item">
                        <span>2FA</span>
                        <strong>Recommended</strong>
                      </div>
                      <div className="account-checklist__item">
                        <span>Last login</span>
                        <strong>Today · 13:42</strong>
                      </div>
                      <div className="account-checklist__item">
                        <span>Workspace access</span>
                        <strong>3 members</strong>
                      </div>
                    </div>

                    <button className="account-linkbtn account-linkbtn--danger route-button" type="button" onClick={onLogout}>
                      Выйти из аккаунта
                    </button>
                  </article>
                </div>
              </section>
            )}
          </div>
          {activeTab === "studio" ? studioPromptStage : null}
        </div>
          </div>
        </section>
      </main>

      {generatedVideo && isPreviewModalOpen ? (
        <div
          className="studio-video-modal is-open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="studio-video-modal-title"
        >
          <button
            className="studio-video-modal__backdrop route-close"
            type="button"
            aria-label="Закрыть превью"
            onClick={() => setIsPreviewModalOpen(false)}
          />
          <div className="studio-video-modal__panel" role="document">
            <button
              className="studio-video-modal__close route-close"
              type="button"
              aria-label="Закрыть превью"
              onClick={() => setIsPreviewModalOpen(false)}
            >
              ×
            </button>

            <div className="studio-video-modal__layout">
              <div className="studio-video-modal__player">
                <video
                  key={`${generatedVideo.id}-modal`}
                  src={generatedVideo.videoUrl}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                />
              </div>

              <div className="studio-video-modal__sidebar">
                <div className="studio-video-modal__section">
                  <p className="studio-video-modal__eyebrow">Готово к публикации</p>
                  <strong id="studio-video-modal-title">{generatedVideoModalTitle}</strong>
                </div>

                <div className="studio-video-modal__section">
                  <div className="studio-video-modal__meta">
                    <span className="studio-video-modal__label">Тема</span>
                    <p className="studio-video-modal__description">{generatedVideoTopic}</p>
                  </div>
                  {hasGeneratedVideoTitle ? (
                    <div className="studio-video-modal__meta">
                      <span className="studio-video-modal__label">Заголовок</span>
                      <p className="studio-video-modal__description">{generatedVideoTitle}</p>
                    </div>
                  ) : null}
                  {hasGeneratedVideoDescription ? (
                    <div className="studio-video-modal__meta">
                      <span className="studio-video-modal__label">Описание</span>
                      <p className="studio-video-modal__description">{generatedVideoDescription}</p>
                    </div>
                  ) : null}
                  {hasGeneratedVideoHashtags ? (
                    <div className="studio-video-modal__meta">
                      <span className="studio-video-modal__label">Хэштеги</span>
                      <div className="studio-video-modal__hashtags" aria-label="Хэштеги">
                        {generatedVideoHashtags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {!hasGeneratedPublishMeta ? (
                    <p className="studio-video-modal__description">
                      Publish-метаданные для web-генерации пока не вернулись из AdsFlow API.
                    </p>
                  ) : null}
                </div>

                <div className="studio-video-modal__actions" aria-label="Действия с видео">
                  <button className="studio-video-modal__action studio-video-modal__action--primary route-button" type="button" onClick={handlePublishPreview}>
                    Опубликовать
                  </button>
                  <button className="studio-video-modal__action route-button" type="button" onClick={handleEditPreview}>
                    Редактировать
                  </button>
                  <button className="studio-video-modal__action route-button" type="button" onClick={() => void handleRegeneratePreview()}>
                    Перегенерировать
                  </button>
                  <button className="studio-video-modal__action studio-video-modal__action--premium route-button" type="button" onClick={handleUpgradePreview}>
                    Улучшить до премиум
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
