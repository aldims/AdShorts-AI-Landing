import { type FocusEvent as ReactFocusEvent, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { AccountMenuButton } from "../components/AccountMenuButton";
import { PrimarySiteNav } from "../components/PrimarySiteNav";
import { clearExamplePrefillIntent, readExamplePrefillIntent } from "../lib/example-prefill";

type WorkspaceTab = "overview" | "studio" | "generations" | "billing" | "settings";

type Session = {
  name: string;
  email: string;
  plan: string;
};

type WorkspaceProfile = {
  balance: number;
  expiresAt: string | null;
  plan: string;
};

type Props = {
  defaultTab: WorkspaceTab;
  initialProfile?: WorkspaceProfile | null;
  session: Session;
  onLogout: () => void | Promise<void>;
  onProfileChange?: (profile: WorkspaceProfile | null) => void;
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

type StudioGenerationRequest = {
  isRegeneration?: boolean;
  prompt: string;
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

const studioPromptChips = ["Видео", "Субтитры", "Озвучка", "Музыка", "9:16"];
const projectPosterCache = new Map<string, string>();
const PROJECTS_REQUEST_TIMEOUT_MS = 25_000;
const FALLBACK_VIDEO_DOWNLOAD_NAME = "adshorts-video";

const normalizeWorkspacePlan = (value: unknown) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
};

const normalizeWorkspaceBalance = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
};

const normalizeWorkspaceExpiry = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const areWorkspaceProfilesEqual = (left: WorkspaceProfile | null | undefined, right: WorkspaceProfile | null | undefined) =>
  normalizeWorkspacePlan(left?.plan) === normalizeWorkspacePlan(right?.plan) &&
  normalizeWorkspaceBalance(left?.balance) === normalizeWorkspaceBalance(right?.balance) &&
  normalizeWorkspaceExpiry(left?.expiresAt) === normalizeWorkspaceExpiry(right?.expiresAt);

const getVideoDownloadName = (value: string) => {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedValue ? `${normalizedValue}.mp4` : `${FALLBACK_VIDEO_DOWNLOAD_NAME}.mp4`;
};

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

const getProjectPreviewNote = (project: WorkspaceProject) => {
  if (project.videoUrl) {
    return "Наведите, чтобы посмотреть";
  }

  switch (project.status) {
    case "queued":
      return "В очереди на генерацию";
    case "processing":
      return "Собираем превью";
    case "failed":
      return "Видео не готово";
    default:
      return "Превью появится после рендера";
  }
};

const captureProjectPoster = (videoUrl: string) =>
  new Promise<string>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Document is not available."));
      return;
    }

    const video = document.createElement("video");
    let settled = false;
    let shouldSeekPreviewFrame = true;
    const timeoutId = window.setTimeout(() => {
      fail(new Error("Poster capture timed out."));
    }, 12000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const drawFrame = () => {
      if (settled) return;

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        fail(new Error("Video dimensions are unavailable."));
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        fail(new Error("Canvas context is unavailable."));
        return;
      }

      context.drawImage(video, 0, 0, width, height);
      settled = true;
      cleanup();
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };

    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    video.onloadeddata = () => {
      if (settled) return;

      const previewTime = Number.isFinite(video.duration) && video.duration > 0.15 ? 0.15 : 0;
      if (shouldSeekPreviewFrame && previewTime > 0) {
        shouldSeekPreviewFrame = false;

        try {
          video.currentTime = previewTime;
          return;
        } catch {
          drawFrame();
          return;
        }
      }

      drawFrame();
    };

    video.onseeked = () => {
      drawFrame();
    };

    video.onerror = () => {
      fail(new Error("Failed to load project preview frame."));
    };
  });

type WorkspaceProjectCardProps = {
  isPreviewing: boolean;
  onActivate: (projectId: string, hasVideo: boolean) => void;
  onBlur: (event: ReactFocusEvent<HTMLElement>) => void;
  onDeactivate: (projectId: string) => void;
  onOpenPreview: (project: WorkspaceProject) => void;
  project: WorkspaceProject;
};

function WorkspaceProjectCard({
  isPreviewing,
  onActivate,
  onBlur,
  onDeactivate,
  onOpenPreview,
  project,
}: WorkspaceProjectCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [shouldResolvePoster, setShouldResolvePoster] = useState(false);
  const [shouldWarmVideo, setShouldWarmVideo] = useState(false);
  const [isPreviewVideoReady, setIsPreviewVideoReady] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(() => {
    if (!project.videoUrl) return null;
    return projectPosterCache.get(project.videoUrl) ?? null;
  });

  useEffect(() => {
    if (!project.videoUrl) {
      setPosterUrl(null);
      setShouldWarmVideo(false);
      setIsPreviewVideoReady(false);
      return;
    }

    setPosterUrl(projectPosterCache.get(project.videoUrl) ?? null);
    setIsPreviewVideoReady(false);
  }, [project.videoUrl]);

  useEffect(() => {
    if (!project.videoUrl || posterUrl || shouldResolvePoster || typeof IntersectionObserver === "undefined") {
      if (project.videoUrl && !posterUrl && typeof IntersectionObserver === "undefined") {
        setShouldResolvePoster(true);
      }
      return;
    }

    const node = cardRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShouldResolvePoster(true);
        if (project.videoUrl) {
          setShouldWarmVideo(true);
        }
        observer.disconnect();
      },
      {
        rootMargin: "320px 0px",
        threshold: 0.15,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [posterUrl, project.videoUrl, shouldResolvePoster]);

  useEffect(() => {
    if (!project.videoUrl || posterUrl || !shouldResolvePoster) return;

    const cachedPoster = projectPosterCache.get(project.videoUrl);
    if (cachedPoster) {
      setPosterUrl(cachedPoster);
      return;
    }

    let cancelled = false;

    void captureProjectPoster(project.videoUrl)
      .then((capturedPosterUrl) => {
        if (cancelled) return;
        projectPosterCache.set(project.videoUrl as string, capturedPosterUrl);
        setPosterUrl(capturedPosterUrl);
      })
      .catch(() => {
        if (cancelled) return;
        setPosterUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [posterUrl, project.videoUrl, shouldResolvePoster]);

  useEffect(() => {
    if (!project.videoUrl || !shouldWarmVideo) return;

    const videoElement = previewVideoRef.current;
    if (!videoElement) return;

    videoElement.preload = "auto";
    videoElement.load();
  }, [project.videoUrl, shouldWarmVideo]);

  useEffect(() => {
    const videoElement = previewVideoRef.current;
    if (!videoElement || !project.videoUrl || !shouldWarmVideo) return;

    if (!isPreviewing) {
      videoElement.pause();
      return;
    }

    void videoElement.play().catch(() => {
      // Ignore autoplay rejection for hover preview.
    });
  }, [isPreviewing, project.videoUrl, shouldWarmVideo]);

  return (
    <article
      ref={cardRef}
      className={`studio-project-card${isPreviewing ? " is-previewing" : ""}${isPreviewing && isPreviewVideoReady ? " is-preview-ready" : ""}`}
      onMouseEnter={() => {
        if (project.videoUrl) {
          setShouldWarmVideo(true);
        }
        onActivate(project.id, Boolean(project.videoUrl));
      }}
      onMouseLeave={() => onDeactivate(project.id)}
      onFocusCapture={() => {
        if (project.videoUrl) {
          setShouldWarmVideo(true);
        }
        onActivate(project.id, Boolean(project.videoUrl));
      }}
      onBlurCapture={onBlur}
    >
      <div className="studio-project-card__thumb">
        <div className="studio-project-card__thumb-poster" aria-hidden={isPreviewing}>
          {posterUrl ? <img className="studio-project-card__thumb-image" src={posterUrl} alt="" /> : null}
          <div className={`studio-project-card__thumb-placeholder${posterUrl ? " has-image" : ""}`}>
            {!posterUrl ? (
              <div className="studio-project-card__thumb-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
                </svg>
              </div>
            ) : null}
            <div className="studio-project-card__thumb-copy">
              <span className="studio-project-card__thumb-note">{getProjectPreviewNote(project)}</span>
              <strong>{project.title || "Без названия"}</strong>
            </div>
          </div>
        </div>
        {project.videoUrl && shouldWarmVideo ? (
          <div className="studio-project-card__thumb-media">
            <video
              ref={previewVideoRef}
              src={project.videoUrl}
              muted
              playsInline
              loop
              preload="auto"
              onCanPlay={() => setIsPreviewVideoReady(true)}
            />
          </div>
        ) : null}
        {project.videoUrl ? (
          <button
            className="studio-project-card__thumb-trigger"
            type="button"
            aria-label={`Открыть превью: ${project.title || "Без названия"}`}
            onClick={() => onOpenPreview(project)}
          />
        ) : null}
        <span className={`studio-project-card__status studio-project-card__status--${project.status}`}>
          {getProjectStatusLabel(project.status)}
        </span>
      </div>
      <div className="studio-project-card__body">
        <h4>{project.title || "Без названия"}</h4>
        <p>{project.prompt || project.description}</p>
        <span className="studio-project-card__date">{formatProjectDate(project.updatedAt)}</span>
      </div>
      {project.videoUrl ? (
        <a
          className="studio-project-card__link"
          href={project.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Открыть видео"
          onClick={(event) => event.stopPropagation()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>
      ) : null}
    </article>
  );
}

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

type StudioView = "create" | "projects";

export function WorkspacePage({ defaultTab, initialProfile = null, session, onLogout, onProfileChange }: Props) {
  const navigate = useNavigate();
  const initialExamplePrefillRef = useRef(readExamplePrefillIntent());
  const preserveExamplePrefillRef = useRef(Boolean(initialExamplePrefillRef.current));
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(defaultTab);
  const [studioView, setStudioView] = useState<StudioView>("create");
  const [topicInput, setTopicInput] = useState("AI tools");
  const [, setStatus] = useState("Ready to generate");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [workspaceProfile, setWorkspaceProfile] = useState<WorkspaceProfile | null>(initialProfile);
  const [generatedVideo, setGeneratedVideo] = useState<StudioGeneration | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
  const [hasLoadedProjects, setHasLoadedProjects] = useState(false);
  const [activeProjectPreviewId, setActiveProjectPreviewId] = useState<string | null>(null);
  const [projectPreviewModal, setProjectPreviewModal] = useState<WorkspaceProject | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewModalVideoRef = useRef<HTMLVideoElement | null>(null);
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
    const pendingExamplePrefill = initialExamplePrefillRef.current;
    if (!pendingExamplePrefill) return;

    setStudioView("create");
    setTopicInput(pendingExamplePrefill.prompt);
    clearExamplePrefillIntent();
    initialExamplePrefillRef.current = null;
  }, []);

  const isAnyPreviewModalOpen = isPreviewModalOpen || Boolean(projectPreviewModal);

  const closePreviewModals = () => {
    setIsPreviewModalOpen(false);
    setProjectPreviewModal(null);
  };

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.body.classList.toggle("modal-open", isAnyPreviewModalOpen);

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [isAnyPreviewModalOpen]);

  useEffect(() => {
    if (!isAnyPreviewModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreviewModals();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAnyPreviewModalOpen]);

  useEffect(() => {
    if (activeTab !== "studio" && isAnyPreviewModalOpen) {
      closePreviewModals();
    }
  }, [activeTab, isAnyPreviewModalOpen]);

  useEffect(() => {
    setWorkspaceProfile((current) => {
      if (areWorkspaceProfilesEqual(current, initialProfile)) {
        return current;
      }

      return initialProfile;
    });
  }, [initialProfile]);

  const applyWorkspaceProfile = (nextProfile: WorkspaceProfile | null) => {
    setWorkspaceProfile((current) => {
      if (areWorkspaceProfilesEqual(current, nextProfile)) {
        return current;
      }

      return nextProfile;
    });

    if (!areWorkspaceProfilesEqual(workspaceProfile, nextProfile)) {
      onProfileChange?.(nextProfile);
    }
  };

  useEffect(() => {
    setProjects([]);
    setProjectsError(null);
    setHasLoadedProjects(false);
    setActiveProjectPreviewId(null);
  }, [session.email]);

  useEffect(() => {
    if (!generatedVideo?.id) return;
    setHasLoadedProjects(false);
  }, [generatedVideo?.id]);

  useEffect(() => {
    if (!projects.length) {
      setActiveProjectPreviewId(null);
      setProjectPreviewModal((current) => (current ? null : current));
      return;
    }

    setActiveProjectPreviewId((current) => {
      if (!current) return current;
      return projects.some((project) => project.id === current) ? current : null;
    });
  }, [projects]);

  useEffect(() => {
    setProjectPreviewModal((current) => {
      if (!current) return current;
      return projects.some((project) => project.id === current.id) ? current : null;
    });
  }, [projects]);

  useEffect(() => {
    if (activeTab !== "studio" || studioView !== "projects") {
      setActiveProjectPreviewId(null);
    }
  }, [activeTab, studioView]);

  const shouldLoadProjects = !hasLoadedProjects;

  useEffect(() => {
    if (!shouldLoadProjects) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort("projects-timeout"), PROJECTS_REQUEST_TIMEOUT_MS);

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
        setHasLoadedProjects(true);
      } catch (error) {
        if (controller.signal.aborted) {
          if (controller.signal.reason === "projects-timeout") {
            setProjectsError("Сервер слишком долго отвечает. Попробуйте обновить.");
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
  }, [shouldLoadProjects]);

  const header = tabCopy[activeTab];
  const sectionTitleId = header.heading ? "account-shell-title" : undefined;
  const workspacePlan = normalizeWorkspacePlan(workspaceProfile?.plan);
  const workspacePlanLabel = workspacePlan ?? "…";
  const workspaceBalance = normalizeWorkspaceBalance(workspaceProfile?.balance);
  const workspaceBalanceLabel = workspaceBalance === null ? "…" : String(workspaceBalance);
  const planButton = (
    <button
      className="site-header__plan"
      type="button"
      onClick={() => navigate("/pricing")}
      title="Открыть тариф"
    >
      <span>Тариф</span>
      <strong>{workspacePlanLabel}</strong>
    </button>
  );
  const creditsButton = (
    <button
      className="site-header__credits"
      type="button"
      onClick={() => navigate("/pricing")}
      title="Пополнить баланс"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 3v6h6l-8 12v-6H5l8-12z" />
      </svg>
      <span>{workspaceBalanceLabel}</span>
    </button>
  );
  const generatedVideoTopic = generatedVideo?.prompt ?? "";
  const generatedVideoTitle = generatedVideo?.title ?? "";
  const generatedVideoDescription = generatedVideo?.description ?? "";
  const generatedVideoHashtags = generatedVideo?.hashtags ?? [];
  const hasGeneratedVideoTitle = Boolean(generatedVideoTitle);
  const generatedVideoModalTitle = hasGeneratedVideoTitle ? generatedVideoTitle : "Результат генерации";
  const isProjectPreviewModalOpen = Boolean(projectPreviewModal);
  const previewModalTitle = isProjectPreviewModalOpen
    ? projectPreviewModal?.title || "Без названия"
    : generatedVideoModalTitle;
  const previewModalTopic = isProjectPreviewModalOpen ? projectPreviewModal?.prompt ?? "" : generatedVideoTopic;
  const previewModalDescription = isProjectPreviewModalOpen
    ? projectPreviewModal?.description ?? ""
    : generatedVideoDescription;
  const previewModalHashtags = isProjectPreviewModalOpen ? projectPreviewModal?.hashtags ?? [] : generatedVideoHashtags;
  const previewModalVideoUrl = isProjectPreviewModalOpen
    ? projectPreviewModal?.videoUrl ?? null
    : isPreviewModalOpen
      ? generatedVideo?.videoUrl ?? null
      : null;
  const previewModalUpdatedAt = isProjectPreviewModalOpen ? projectPreviewModal?.updatedAt ?? "" : "";
  const shouldPreferMutedModalFallback = !isProjectPreviewModalOpen;
  const previewModalDownloadName = getVideoDownloadName(previewModalTitle);
  const hasPreviewModalDescription = Boolean(previewModalDescription);
  const hasPreviewModalHashtags = previewModalHashtags.length > 0;
  const readyProjectsCount = projects.filter((project) => project.status === "ready").length;
  const activeProjectsCount = projects.filter(
    (project) => project.status === "queued" || project.status === "processing",
  ).length;
  const failedProjectsCount = projects.filter((project) => project.status === "failed").length;

  const activateProjectPreview = (projectId: string, hasVideo: boolean) => {
    if (!hasVideo) return;
    setActiveProjectPreviewId(projectId);
  };

  const deactivateProjectPreview = (projectId: string) => {
    setActiveProjectPreviewId((current) => (current === projectId ? null : current));
  };

  const handleProjectCardBlur =
    (projectId: string) =>
    (event: ReactFocusEvent<HTMLElement>) => {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
        return;
      }

      deactivateProjectPreview(projectId);
    };

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

  const handleGenerate = async (nextTopic: string, options?: { isRegeneration?: boolean }) => {
    preserveExamplePrefillRef.current = false;

    if (workspaceBalance !== null && workspaceBalance <= 0) {
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
        body: JSON.stringify({
          isRegeneration: Boolean(options?.isRegeneration),
          prompt: safeTopic,
        } satisfies StudioGenerationRequest),
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
      applyWorkspaceProfile(payload.data.profile);
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
    closePreviewModals();
    setActiveTab("generations");
  };

  const handleRegeneratePreview = async () => {
    if (!generatedVideo) return;

    closePreviewModals();
    await handleGenerate(generatedVideo.prompt, { isRegeneration: true });
  };

  const playVideoElement = async (element: HTMLVideoElement | null, preferMutedFallback = false) => {
    if (!element) return;

    if (element.preload !== "auto") {
      element.preload = "auto";
    }

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

  const syncPreviewPlaybackPosition = () => {
    const previewElement = previewVideoRef.current;
    const modalElement = previewModalVideoRef.current;
    if (!previewElement || !modalElement) return;

    const previewTime = previewElement.currentTime;
    if (!Number.isFinite(previewTime) || previewTime <= 0) return;

    const applyCurrentTime = () => {
      try {
        if (Math.abs(modalElement.currentTime - previewTime) > 0.25) {
          modalElement.currentTime = previewTime;
        }
      } catch {
        // Ignore timing sync errors when metadata is not ready yet.
      }
    };

    if (modalElement.readyState >= 1) {
      applyCurrentTime();
      return;
    }

    modalElement.addEventListener("loadedmetadata", applyCurrentTime, { once: true });
  };

  const handleOpenPreviewModal = () => {
    if (!generatedVideo) return;

    setProjectPreviewModal(null);
    setIsPreviewModalOpen(true);
    syncPreviewPlaybackPosition();
    void playVideoElement(previewModalVideoRef.current, true);
  };

  const handleOpenProjectPreviewModal = (project: WorkspaceProject) => {
    if (!project.videoUrl) return;

    flushSync(() => {
      setIsPreviewModalOpen(false);
      setProjectPreviewModal(project);
    });

    const modalElement = previewModalVideoRef.current;
    if (!modalElement) return;

    modalElement.muted = false;
    modalElement.currentTime = 0;
    modalElement.preload = "auto";
    modalElement.load();
    void playVideoElement(modalElement);
  };

  useEffect(() => {
    if (!generatedVideo) return;

    const previewElement = previewVideoRef.current;
    if (!previewElement) return;

    if (activeTab !== "studio" || studioView !== "create" || isPreviewModalOpen) {
      previewElement.pause();
      previewElement.preload = "auto";
      previewElement.load();
      return;
    }

    void playVideoElement(previewElement);
  }, [activeTab, generatedVideo?.id, isPreviewModalOpen, studioView]);

  useEffect(() => {
    if (!isAnyPreviewModalOpen) {
      previewModalVideoRef.current?.pause();

      const previewElement = previewVideoRef.current;
      if (previewElement && activeTab === "studio" && studioView === "create") {
        void playVideoElement(previewElement);
      }
      return;
    }

    previewVideoRef.current?.pause();
    if (isPreviewModalOpen) {
      syncPreviewPlaybackPosition();
    }
    void playVideoElement(previewModalVideoRef.current, shouldPreferMutedModalFallback);
  }, [
    activeTab,
    generatedVideo?.id,
    isAnyPreviewModalOpen,
    isPreviewModalOpen,
    shouldPreferMutedModalFallback,
    studioView,
  ]);

  useEffect(() => {
    const previewElement = previewVideoRef.current;
    if (!previewElement) return;

    if (activeTab !== "studio" || studioView !== "create" || isAnyPreviewModalOpen) {
      previewElement.pause();
      return;
    }

    if (generatedVideo) {
      void playVideoElement(previewElement);
    }
  }, [activeTab, generatedVideo, isAnyPreviewModalOpen, studioView]);

  useEffect(() => {
    const modalElement = previewModalVideoRef.current;
    if (!modalElement || !previewModalVideoUrl || !isAnyPreviewModalOpen) {
      return;
    }

    modalElement.currentTime = 0;
    modalElement.load();
    void playVideoElement(modalElement, shouldPreferMutedModalFallback);
  }, [isAnyPreviewModalOpen, previewModalVideoUrl, shouldPreferMutedModalFallback]);

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

        applyWorkspaceProfile(payload.data.profile);

        const latestGeneration = payload.data.latestGeneration;
        if (!latestGeneration) return;

        if (latestGeneration.generation) {
          setGeneratedVideo(latestGeneration.generation);
          setGenerateError(latestGeneration.error ?? null);
          if (!preserveExamplePrefillRef.current) {
            setTopicInput(latestGeneration.generation.prompt);
          }
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

  const isStudioRouteVisible = activeTab === "studio";

  return (
    <>
      <div className="route-page studio-canvas-route" hidden={!isStudioRouteVisible}>
        <header className="site-header site-header--workspace">
          <div className="container site-header__inner">
            <Link className="brand" to="/" aria-label="AdShorts AI">
              <img src="/logo.png" alt="" width="44" height="44" />
              <span>AdShorts AI</span>
            </Link>

            <PrimarySiteNav
              activeItem="studio"
              onOpenStudio={() => setActiveTab("studio")}
              studioView={studioView}
              onStudioViewChange={setStudioView}
              projectsCount={projects.length}
            />

            <div className="site-header__actions">
              {planButton}
              {creditsButton}
              <AccountMenuButton email={session.email} name={session.name} onLogout={handleAccountLogout} plan={workspacePlanLabel} />
            </div>
          </div>
        </header>

        <main className="studio-canvas-main">
          <div className="studio-canvas-bg" aria-hidden="true">
            <span className="studio-canvas-bg__gradient"></span>
          </div>

          <div hidden={studioView !== "create"}>
              <div className="studio-canvas-content">
                <div className="studio-canvas-preview">
                  {generatedVideo ? (
                    <button
                      className="studio-canvas-preview__video-btn"
                      type="button"
                      aria-label={hasGeneratedVideoTitle ? `Открыть превью: ${generatedVideoTitle}` : "Открыть превью видео"}
                      onClick={handleOpenPreviewModal}
                    >
                      <video
                        ref={previewVideoRef}
                        key={generatedVideo.id}
                        className="studio-canvas-preview__video"
                        src={generatedVideo.videoUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                      />
                      {isGenerating ? (
                        <div className="studio-canvas-preview__overlay">
                          <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                          <span>Генерация...</span>
                        </div>
                      ) : null}
                    </button>
                  ) : (
                    <div className={`studio-canvas-preview__placeholder${isGenerating ? " is-generating" : ""}${generateError ? " is-error" : ""}`}>
                      {isGenerating ? (
                        <>
                          <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                          <strong>Генерация видео...</strong>
                          <p>Это займёт около минуты</p>
                        </>
                      ) : generateError ? (
                        <>
                          <strong>Ошибка генерации</strong>
                          <p>{generateError}</p>
                        </>
                      ) : (
                        <>
                          <div className="studio-canvas-preview__icon" aria-hidden="true">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="2" y="4" width="20" height="16" rx="2" />
                              <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
                            </svg>
                          </div>
                          <strong>Создайте первый Shorts</strong>
                          <p>Введите тему и нажмите «Создать»</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="studio-canvas-prompt">
                <div className="studio-canvas-prompt__inner">
                  <textarea
                    className="studio-canvas-prompt__textarea"
                    placeholder="Опишите идею для Shorts..."
                    value={topicInput}
                    onChange={(event) => setTopicInput(event.target.value)}
                    rows={1}
                  />
                  <div className="studio-canvas-prompt__footer">
                    <div className="studio-canvas-prompt__chips">
                      {studioPromptChips.map((chip) => (
                        <span className="studio-canvas-prompt__chip" key={chip}>
                          {chip}
                        </span>
                      ))}
                    </div>
                    <button
                      className={`studio-canvas-prompt__btn${isGenerating ? " is-generating" : ""}`}
                      type="button"
                      disabled={isGenerating}
                      onClick={() => handleGenerate(topicInput)}
                    >
                      {isGenerating ? (
                        <span className="studio-canvas-prompt__btn-spinner"></span>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
          </div>

          <div className="studio-projects" hidden={studioView !== "projects"}>
              {isProjectsLoading ? (
                <div className="studio-projects__loading">
                  <span className="studio-canvas-preview__spinner" aria-hidden="true"></span>
                  <p>Загружаем проекты...</p>
                </div>
              ) : projectsError ? (
                <div className="studio-projects__error">
                  <strong>Не удалось загрузить</strong>
                  <p>{projectsError}</p>
                  <button
                    className="studio-projects__retry"
                    type="button"
                    onClick={() => setHasLoadedProjects(false)}
                  >
                    Повторить
                  </button>
                </div>
              ) : projects.length === 0 ? (
                <div className="studio-projects__empty">
                  <div className="studio-projects__empty-icon" aria-hidden="true">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <strong>Проектов пока нет</strong>
                  <p>Создайте первый Shorts, и он появится здесь</p>
                  <button
                    className="studio-projects__create"
                    type="button"
                    onClick={() => setStudioView("create")}
                  >
                    Создать Shorts
                  </button>
                </div>
              ) : (
                <div className="studio-projects__grid">
                  {projects.map((project) => (
                    <WorkspaceProjectCard
                      key={project.id}
                      isPreviewing={activeProjectPreviewId === project.id}
                      onActivate={activateProjectPreview}
                      onBlur={handleProjectCardBlur(project.id)}
                      onDeactivate={deactivateProjectPreview}
                      onOpenPreview={handleOpenProjectPreviewModal}
                      project={project}
                    />
                  ))}
                </div>
              )}
            </div>
        </main>

        {previewModalVideoUrl ? (
          <div
            className={`studio-video-modal${isAnyPreviewModalOpen ? " is-open" : ""}`}
            role="dialog"
            aria-hidden={!isAnyPreviewModalOpen}
            aria-modal={isAnyPreviewModalOpen ? "true" : undefined}
            aria-labelledby="studio-video-modal-title"
          >
            <button
              className="studio-video-modal__backdrop route-close"
              type="button"
              aria-label="Закрыть превью"
              onClick={closePreviewModals}
            />
            <div className="studio-video-modal__panel" role="document">
              <button
                className="studio-video-modal__close route-close"
                type="button"
                aria-label="Закрыть превью"
                onClick={closePreviewModals}
              >
                ×
              </button>

              <div className="studio-video-modal__layout">
                <div className="studio-video-modal__player">
                  <video
                    ref={previewModalVideoRef}
                    key={`${isProjectPreviewModalOpen ? projectPreviewModal?.id ?? "project" : generatedVideo?.id ?? "generated"}-modal`}
                    src={previewModalVideoUrl}
                    controls
                    autoPlay={isAnyPreviewModalOpen}
                    playsInline
                    preload="auto"
                    onLoadedData={() => {
                      if (isAnyPreviewModalOpen) {
                        void playVideoElement(previewModalVideoRef.current, shouldPreferMutedModalFallback);
                      }
                    }}
                    onCanPlay={() => {
                      if (isAnyPreviewModalOpen) {
                        void playVideoElement(previewModalVideoRef.current, shouldPreferMutedModalFallback);
                      }
                    }}
                  />
                  <a
                    className="studio-video-modal__download"
                    href={previewModalVideoUrl}
                    download={previewModalDownloadName}
                    aria-label="Скачать видео"
                    title="Скачать видео"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                </div>

                <div className="studio-video-modal__sidebar">
                  <div className="studio-video-modal__section">
                    <p className="studio-video-modal__eyebrow">Готово к публикации</p>
                    <strong id="studio-video-modal-title">{previewModalTitle}</strong>
                  </div>

                  <div className="studio-video-modal__section">
                    <div className="studio-video-modal__meta">
                      <span className="studio-video-modal__label">Тема</span>
                      <p className="studio-video-modal__description">{previewModalTopic || "Без темы"}</p>
                    </div>
                    {!isProjectPreviewModalOpen && hasGeneratedVideoTitle ? (
                      <div className="studio-video-modal__meta">
                        <span className="studio-video-modal__label">Заголовок</span>
                        <p className="studio-video-modal__description">{generatedVideoTitle}</p>
                      </div>
                    ) : null}
                    {isProjectPreviewModalOpen ? (
                      <div className="studio-video-modal__meta">
                        <span className="studio-video-modal__label">Обновлен</span>
                        <p className="studio-video-modal__description">{formatProjectDate(previewModalUpdatedAt)}</p>
                      </div>
                    ) : null}
                    {hasPreviewModalDescription ? (
                      <div className="studio-video-modal__meta">
                        <span className="studio-video-modal__label">Описание</span>
                        <p className="studio-video-modal__description">{previewModalDescription}</p>
                      </div>
                    ) : null}
                    {hasPreviewModalHashtags ? (
                      <div className="studio-video-modal__meta">
                        <span className="studio-video-modal__label">Хэштеги</span>
                        <div className="studio-video-modal__hashtags" aria-label="Хэштеги">
                          {previewModalHashtags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="studio-video-modal__actions" aria-label="Действия с видео">
                    {isProjectPreviewModalOpen ? (
                      <>
                        <a
                          className="studio-video-modal__action studio-video-modal__action--primary route-button"
                          href={previewModalVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Открыть видео
                        </a>
                        <button className="studio-video-modal__action route-button" type="button" onClick={closePreviewModals}>
                          Закрыть
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="studio-video-modal__action studio-video-modal__action--primary route-button" type="button" onClick={handlePublishPreview}>
                          Опубликовать
                        </button>
                        <button className="studio-video-modal__action route-button" type="button" onClick={() => void handleRegeneratePreview()}>
                          Перегенерировать
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="route-page workspace-route" hidden={isStudioRouteVisible}>
      <header className="site-header site-header--workspace">
        <div className="container site-header__inner">
          <Link className="brand" to="/" aria-label="AdShorts AI">
            <img src="/logo.png" alt="" width="44" height="44" />
            <span>AdShorts AI</span>
          </Link>

          <PrimarySiteNav activeItem={null} onOpenStudio={() => setActiveTab("studio")} />

          <div className="site-header__actions">
            {planButton}
            {creditsButton}
            <a
              className="site-header__link"
              href="https://t.me/AdShortsAIBot"
              target="_blank"
              rel="noopener noreferrer"
            >
              Telegram
            </a>
            <AccountMenuButton email={session.email} name={session.name} onLogout={handleAccountLogout} plan={workspacePlanLabel} />
          </div>
        </div>
      </header>

      <main className="workspace-route__main">
        <div className="workspace-route__scene" aria-hidden="true">
          <span className="hero__scene-stars"></span>
          <span className="hero__scene-glow hero__scene-glow--center"></span>
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
              <strong>{workspacePlanLabel}</strong>
            </div>
            <div className="account-user__summary-row">
              <span>Баланс</span>
              <strong>{workspaceBalance === null ? "…" : `${workspaceBalance} credits`}</strong>
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
              className="account-nav__item"
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
          <div className="account-shell__topbar">
            <div className="account-shell__topbar-copy">
              <p className="account-shell__eyebrow">{header.eyebrow}</p>
              {header.heading ? <h2 id="account-shell-title">{header.heading}</h2> : null}
              {header.subtitle ? <p className="account-shell__subtitle">{header.subtitle}</p> : null}
            </div>
          </div>

          <div className="account-shell__body">
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
        </div>
          </div>
        </section>
      </main>
    </div>
    </>
  );
}
