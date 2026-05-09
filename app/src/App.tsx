import { type ReactNode, Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { authClient } from "./lib/auth-client";
import { logClientEvent } from "./lib/client-log";
import {
  LocaleProvider,
  defineMessages,
  localizePathForLocale,
  pathnameHasLocalePrefix,
  persistPreferredLocale,
  readPreferredLocale,
  resolveLocaleFromPathname,
  stripLocalePrefix,
  useLocale,
  type Locale,
} from "./lib/i18n";
import { syncMetrikaUserId } from "./lib/metrika";
import { captureReferralFromLocation } from "./lib/referrals";

const AuthModal = lazy(() =>
  import("./components/AuthModal").then((module) => ({
    default: module.AuthModal,
  })),
);
const LandingPage = lazy(() =>
  import("./pages/LandingPage").then((module) => ({
    default: module.LandingPage,
  })),
);
const ExamplesPage = lazy(() =>
  import("./pages/ExamplesPage").then((module) => ({
    default: module.ExamplesPage,
  })),
);
const PricingPage = lazy(() =>
  import("./pages/PricingPage").then((module) => ({
    default: module.PricingPage,
  })),
);
const WorkspacePage = lazy(() =>
  import("./pages/WorkspacePage").then((module) => ({
    default: module.WorkspacePage,
  })),
);

type AuthMode = "signup" | "signin";
type WorkspaceTab = "overview" | "studio" | "generations" | "billing" | "settings";

type Session = {
  email: string;
  emailVerified: boolean;
  name: string;
  plan: string;
};

type WorkspaceProfile = {
  balance: number;
  expiresAt: string | null;
  plan: string;
  startPlanUsed: boolean;
  userId?: string | null;
};

type WorkspaceBootstrapResponse = {
  data?: {
    profile?: WorkspaceProfile;
  };
  error?: string;
};

type AuthState = {
  isOpen: boolean;
  mode: AuthMode;
};

type ImpersonationState = {
  adsflowUserId: string;
  email: string;
  expiresAt: string;
};

const WORKSPACE_PROFILE_STORAGE_KEY_PREFIX = "adshorts.workspace-profile:";
const IMPERSONATION_COOKIE_NAME = "adshorts.impersonation";

const appMessages = defineMessages({
  loadingSession: {
    ru: "Проверяем сессию…",
    en: "Checking session…",
  },
});

const publicSiteOrigin = "https://adshortsai.com";
type PublicRoutePathname = "/" | "/pricing" | "/examples";

type PublicRouteMeta = {
  canonicalPath: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  ogTitle: Record<Locale, string>;
  ogDescription: Record<Locale, string>;
};

const publicRouteMeta: Record<PublicRoutePathname, PublicRouteMeta> = {
  "/": {
    canonicalPath: "/",
    title: {
      ru: "AdShorts AI — Shorts/Reels/TikTok за 1 минуту",
      en: "AdShorts AI — Shorts/Reels/TikTok in 1 Minute",
    },
    description: {
      ru: "AdShorts AI создаёт YouTube Shorts, Reels и TikTok за минуту: AI-сценарий, озвучка, субтитры, фон и публикация без ручного монтажа.",
      en: "AdShorts AI creates YouTube Shorts, Reels and TikTok videos in minutes: AI script, voiceover, subtitles, visuals and publishing without manual editing.",
    },
    ogTitle: {
      ru: "AdShorts AI — Shorts/Reels/TikTok за 1 минуту",
      en: "AdShorts AI — Shorts/Reels/TikTok in 1 Minute",
    },
    ogDescription: {
      ru: "Введите идею — получите готовый Shorts с озвучкой, субтитрами и визуалом.",
      en: "Enter an idea and get a ready Shorts video with voiceover, subtitles and visuals.",
    },
  },
  "/pricing": {
    canonicalPath: "/pricing/",
    title: {
      ru: "Тарифы AdShorts AI: создание Shorts с AI-сценарием и субтитрами",
      en: "AdShorts AI Pricing: AI Shorts, Reels and TikTok Videos",
    },
    description: {
      ru: "Тарифы AdShorts AI для создания YouTube Shorts, Reels и TikTok: бесплатный старт, Pro для регулярного контента и Ultra для больших объёмов.",
      en: "AdShorts AI pricing for creating YouTube Shorts, Reels and TikTok videos with AI scripts, voiceover, subtitles, visuals and publishing tools.",
    },
    ogTitle: {
      ru: "Тарифы AdShorts AI",
      en: "AdShorts AI Pricing",
    },
    ogDescription: {
      ru: "Выберите тариф для регулярного создания вертикальных роликов: AI-сценарий, озвучка, субтитры, визуал и публикация.",
      en: "Choose a plan for regular short-form video production: AI script, voiceover, subtitles, visuals and publishing tools.",
    },
  },
  "/examples": {
    canonicalPath: "/examples/",
    title: {
      ru: "Примеры Shorts AdShorts AI: шаблоны для рекламы, роста и обучения",
      en: "AdShorts AI Examples: Templates for Ads, Growth and Education",
    },
    description: {
      ru: "Примеры Shorts, которые можно использовать как стартовый шаблон: реклама услуг, рост канала, обучающий контент и storytelling.",
      en: "AdShorts AI examples for short-form video creation: ad Shorts, channel growth, educational content and storytelling templates.",
    },
    ogTitle: {
      ru: "Примеры Shorts AdShorts AI",
      en: "AdShorts AI Examples",
    },
    ogDescription: {
      ru: "Готовые сцены и шаблоны для запуска Shorts: выберите пример и откройте похожую структуру в студии.",
      en: "Ready scenes and templates for Shorts: choose an example and open a similar structure in the studio.",
    },
  },
};

const workspaceRouteMeta = {
  canonicalPath: "/app/studio",
  title: {
    ru: "AdShorts AI — Shorts/Reels/TikTok за 1 минуту",
    en: "AdShorts AI — Shorts/Reels/TikTok in 1 Minute",
  },
  description: {
    ru: "AdShorts AI: веб-студия для создания Shorts, Reels и TikTok с AI-сценарием, озвучкой, субтитрами и публикацией.",
    en: "AdShorts AI: a web studio for creating Shorts, Reels and TikTok videos with AI scripts, voiceover, subtitles and publishing.",
  },
  ogTitle: {
    ru: "AdShorts AI — Shorts/Reels/TikTok за 1 минуту",
    en: "AdShorts AI — Shorts/Reels/TikTok in 1 Minute",
  },
  ogDescription: {
    ru: "Введите идею — получите готовый Shorts с озвучкой, субтитрами и визуалом.",
    en: "Enter an idea and get a ready Shorts video with voiceover, subtitles and visuals.",
  },
} satisfies PublicRouteMeta;

const indexablePublicPathnames = new Set<PublicRoutePathname>(["/", "/pricing", "/examples"]);

const getIndexablePublicPathname = (pathname: string): PublicRoutePathname | null =>
  indexablePublicPathnames.has(pathname as PublicRoutePathname) ? (pathname as PublicRoutePathname) : null;

const normalizeAppPathnameForMeta = (pathname: string) => {
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (normalizedPathname === "/") return "/";
  return normalizedPathname.replace(/\/+$/, "") || "/";
};

const ensureNamedMeta = (name: string) => {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.appendChild(meta);
  }
  return meta;
};

const ensureCanonicalLink = () => {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  return link;
};

const ensurePropertyMeta = (property: string) => {
  let meta = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("property", property);
    document.head.appendChild(meta);
  }
  return meta;
};

const normalizeWorkspaceEmail = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();
const isAbortLikeError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
const normalizeWorkspaceBooleanFlag = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;

  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return null;
};

const normalizeWorkspaceProfile = (value: unknown): WorkspaceProfile | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const profile = value as { balance?: unknown; expiresAt?: unknown; plan?: unknown; startPlanUsed?: unknown; userId?: unknown };
  const parsedBalance = Number(profile.balance);
  const normalizedPlan = String(profile.plan ?? "").trim().toUpperCase();
  const normalizedExpiresAt = normalizedPlan === "START" ? null : String(profile.expiresAt ?? "").trim() || null;
  const normalizedStartPlanUsed = normalizeWorkspaceBooleanFlag(profile.startPlanUsed) ?? normalizedPlan === "START";
  const normalizedUserId = String(profile.userId ?? "").trim() || null;

  if (!Number.isFinite(parsedBalance) || !normalizedPlan) {
    return null;
  }

  return {
    balance: Math.max(0, parsedBalance),
    expiresAt: normalizedExpiresAt,
    plan: normalizedPlan,
    startPlanUsed: normalizedStartPlanUsed,
    userId: normalizedUserId,
  };
};

const areWorkspaceProfilesEqual = (left: WorkspaceProfile | null | undefined, right: WorkspaceProfile | null | undefined) => {
  const normalizedLeft = normalizeWorkspaceProfile(left);
  const normalizedRight = normalizeWorkspaceProfile(right);

  if (!normalizedLeft || !normalizedRight) {
    return normalizedLeft === normalizedRight;
  }

  return (
    normalizedLeft.plan === normalizedRight.plan &&
    normalizedLeft.balance === normalizedRight.balance &&
    normalizedLeft.expiresAt === normalizedRight.expiresAt &&
    normalizedLeft.startPlanUsed === normalizedRight.startPlanUsed &&
    normalizedLeft.userId === normalizedRight.userId
  );
};

const getWorkspaceProfileStorageKey = (email: string) => `${WORKSPACE_PROFILE_STORAGE_KEY_PREFIX}${email}`;

const readCachedWorkspaceProfile = (email: string | null | undefined): WorkspaceProfile | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  try {
    return normalizeWorkspaceProfile(window.localStorage.getItem(getWorkspaceProfileStorageKey(normalizedEmail)) ? JSON.parse(window.localStorage.getItem(getWorkspaceProfileStorageKey(normalizedEmail)) as string) : null);
  } catch {
    return null;
  }
};

const persistWorkspaceProfile = (email: string | null | undefined, profile: WorkspaceProfile | null) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = normalizeWorkspaceEmail(email);
  if (!normalizedEmail || !profile) {
    return;
  }

  try {
    window.localStorage.setItem(getWorkspaceProfileStorageKey(normalizedEmail), JSON.stringify(profile));
  } catch {
    // Ignore storage write errors.
  }
};

const readCookieValue = (name: string) => {
  if (typeof document === "undefined") {
    return "";
  }

  const prefix = `${name}=`;
  const item = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));
  return item ? item.slice(prefix.length) : "";
};

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return window.atob(padded);
};

const readImpersonationState = (): ImpersonationState | null => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const rawCookie = readCookieValue(IMPERSONATION_COOKIE_NAME);
  if (!rawCookie) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(rawCookie)) as Partial<ImpersonationState>;
    const expiresAt = String(payload.expiresAt ?? "").trim();
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      return null;
    }

    return {
      adsflowUserId: String(payload.adsflowUserId ?? "").trim(),
      email: String(payload.email ?? "").trim(),
      expiresAt,
    };
  } catch {
    return null;
  }
};

const clearImpersonationCookie = () => {
  if (typeof document === "undefined") {
    return;
  }

  const secureSuffix = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${IMPERSONATION_COOKIE_NAME}=; Max-Age=0; path=/; SameSite=Lax${secureSuffix}`;
};

function LoadingScreen() {
  const { t } = useLocale();

  return (
    <div className="route-page route-page--loading">
      <div className="route-loading">
        <span className="route-loading__eyebrow">Auth</span>
        <strong>{t(appMessages.loadingSession)}</strong>
      </div>
    </div>
  );
}

function RouteSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>;
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const locale = useMemo(() => resolveLocaleFromPathname(location.pathname), [location.pathname]);
  const appPathname = useMemo(() => stripLocalePrefix(location.pathname), [location.pathname]);
  const localizePath = useMemo(() => (path: string) => localizePathForLocale(locale, path), [locale]);
  const hasExplicitLocalePrefix = useMemo(() => pathnameHasLocalePrefix(location.pathname), [location.pathname]);
  const { data: authSession, isPending: isSessionPending } = authClient.useSession();
  const [authState, setAuthState] = useState<AuthState>({ isOpen: false, mode: "signup" });
  const [workspaceProfile, setWorkspaceProfile] = useState<WorkspaceProfile | null>(null);
  const [isWorkspaceProfilePending, setIsWorkspaceProfilePending] = useState(false);
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(() => readImpersonationState());

  const session = useMemo<Session | null>(() => {
    if (!authSession?.user) return null;

    return {
      email: authSession.user.email,
      emailVerified: authSession.user.emailVerified,
      name: authSession.user.name,
      plan: "FREE",
    };
  }, [authSession]);

  useEffect(() => {
    captureReferralFromLocation(location);
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (!session?.email) {
      setWorkspaceProfile(null);
      setIsWorkspaceProfilePending(false);
      return;
    }

    const cachedProfile = readCachedWorkspaceProfile(session.email);
    setWorkspaceProfile((current) => (areWorkspaceProfilesEqual(current, cachedProfile) ? current : cachedProfile ?? null));
    setIsWorkspaceProfilePending(!cachedProfile);

    const controller = new AbortController();
    let isCancelled = false;

    const loadWorkspaceProfile = async () => {
      try {
        const response = await fetch("/api/workspace/bootstrap", {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as WorkspaceBootstrapResponse | null;

        if (response.status === 401 || response.status === 403) {
          if (isCancelled) return;
          setWorkspaceProfile((current) => (areWorkspaceProfilesEqual(current, cachedProfile) ? current : cachedProfile ?? null));
          return;
        }

        if (!response.ok || !payload?.data?.profile) {
          throw new Error(payload?.error ?? "Failed to load workspace profile.");
        }

        if (isCancelled) return;

        const nextProfile = payload.data?.profile ?? null;
        setWorkspaceProfile((current) => (areWorkspaceProfilesEqual(current, nextProfile) ? current : nextProfile));
        persistWorkspaceProfile(session.email, nextProfile);
      } catch (error) {
        if (isCancelled || controller.signal.aborted || isAbortLikeError(error)) return;
        if (cachedProfile) return;
        console.error("[app] Failed to preload workspace profile", error);
      } finally {
        if (!isCancelled) {
          setIsWorkspaceProfilePending(false);
        }
      }
    };

    void loadWorkspaceProfile();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [session?.email]);

  useEffect(() => {
    if (!session?.email || !workspaceProfile) {
      return;
    }

    persistWorkspaceProfile(session.email, workspaceProfile);
  }, [session?.email, workspaceProfile]);

  useEffect(() => {
    if (!session?.email || !workspaceProfile?.userId) {
      return;
    }

    syncMetrikaUserId(workspaceProfile.userId);
  }, [session?.email, workspaceProfile?.userId]);

  useEffect(() => {
    setImpersonation(readImpersonationState());
  }, [location.key, session?.email]);

  const shouldBlockWorkspaceRoute = Boolean(session && !workspaceProfile && isWorkspaceProfilePending);

  useEffect(() => {
    if (hasExplicitLocalePrefix) {
      persistPreferredLocale(locale);
      return;
    }

    const preferredLocale = readPreferredLocale();
    if (!preferredLocale || preferredLocale === locale) {
      return;
    }

    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    const preferredPath = localizePathForLocale(preferredLocale, currentPath);
    if (preferredPath !== currentPath) {
      navigate(preferredPath, { replace: true });
    }
  }, [hasExplicitLocalePrefix, locale, location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const targetId = decodeURIComponent(location.hash.slice(1));
    if (!targetId) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "auto" });
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [location.hash, location.key, location.pathname, location.search]);

  useEffect(() => {
    document.body.classList.toggle("modal-open", authState.isOpen);
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [authState.isOpen]);

  useEffect(() => {
    if (session && authState.isOpen) {
      setAuthState((current) => ({ ...current, isOpen: false }));
    }
  }, [authState.isOpen, session]);

  const openAuth = (mode: AuthMode) => {
    if (mode === "signup") {
      void logClientEvent("signup_start", {
        lang: locale,
        path: `${location.pathname}${location.search}`,
      });
    }

    setAuthState({ isOpen: true, mode });
  };

  const closeAuth = () => {
    setAuthState((current) => ({ ...current, isOpen: false }));
  };

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          clearImpersonationCookie();
          setImpersonation(null);
          setWorkspaceProfile(null);
          setIsWorkspaceProfilePending(false);
          closeAuth();
          navigate(localizePath("/"));
        },
      },
    });
  };

  const workspaceEntryTab = useMemo<WorkspaceTab>(() => {
    if (appPathname.startsWith("/app/studio")) return "studio";
    if (appPathname.startsWith("/app/projects")) return "generations";
    return "overview";
  }, [appPathname]);

  useEffect(() => {
    document.documentElement.lang = locale;
    const normalizedAppPathname = normalizeAppPathnameForMeta(appPathname);
    const publicPathname = getIndexablePublicPathname(normalizedAppPathname);
    const isIndexablePublicPage = Boolean(publicPathname);
    const routeMeta = publicPathname ? publicRouteMeta[publicPathname] : workspaceRouteMeta;
    const title = routeMeta.title[locale];
    const description = routeMeta.description[locale];
    const canonicalPath = localizePath(routeMeta.canonicalPath);

    document.title = title;

    ensureNamedMeta("description").content = description;
    ensureNamedMeta("robots").content = isIndexablePublicPage ? "index, follow" : "noindex, nofollow";
    ensureCanonicalLink().href = `${publicSiteOrigin}${canonicalPath}`;
    ensurePropertyMeta("og:type").content = "website";
    ensurePropertyMeta("og:url").content = `${publicSiteOrigin}${canonicalPath}`;
    ensurePropertyMeta("og:title").content = routeMeta.ogTitle[locale];
    ensurePropertyMeta("og:description").content = routeMeta.ogDescription[locale];
  }, [appPathname, locale, localizePath]);

  return (
    <LocaleProvider locale={locale}>
      {impersonation ? (
        <div className="admin-impersonation-banner" role="status">
          <span>
            Admin impersonation: <strong>{impersonation.email || session?.email || "user"}</strong>
            {impersonation.adsflowUserId ? <em>AdsFlow ID {impersonation.adsflowUserId}</em> : null}
          </span>
          <button className="button-reset" type="button" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      ) : null}
      <Routes>
        <Route
          path="/"
          element={
            <RouteSuspense>
              <LandingPage
                session={session}
                workspaceProfile={workspaceProfile}
                useLayeredHero
                onOpenSignup={() => openAuth("signup")}
                onOpenSignin={() => openAuth("signin")}
                onLogout={handleLogout}
                onOpenWorkspace={() => navigate(localizePath("/app/studio"))}
              />
            </RouteSuspense>
          }
        />
        <Route
          path="/en"
          element={
            <RouteSuspense>
              <LandingPage
                session={session}
                workspaceProfile={workspaceProfile}
                useLayeredHero
                onOpenSignup={() => openAuth("signup")}
                onOpenSignin={() => openAuth("signin")}
                onLogout={handleLogout}
                onOpenWorkspace={() => navigate(localizePath("/app/studio"))}
              />
            </RouteSuspense>
          }
        />
        <Route
          path="/hero-background-test"
          element={
            <RouteSuspense>
              <LandingPage
                session={session}
                workspaceProfile={workspaceProfile}
                useLayeredHero
                onOpenSignup={() => openAuth("signup")}
                onOpenSignin={() => openAuth("signin")}
                onLogout={handleLogout}
                onOpenWorkspace={() => navigate(localizePath("/app/studio"))}
              />
            </RouteSuspense>
          }
        />
        <Route
          path="/en/hero-background-test"
          element={
            <RouteSuspense>
              <LandingPage
                session={session}
                workspaceProfile={workspaceProfile}
                useLayeredHero
                onOpenSignup={() => openAuth("signup")}
                onOpenSignin={() => openAuth("signin")}
                onLogout={handleLogout}
                onOpenWorkspace={() => navigate(localizePath("/app/studio"))}
              />
            </RouteSuspense>
          }
        />
        <Route
          path="/pricing"
          element={
            <RouteSuspense>
              <PricingPage
                session={session}
                workspaceProfile={workspaceProfile}
                onOpenSignup={() => openAuth("signup")}
                onOpenSignin={() => openAuth("signin")}
                onLogout={handleLogout}
                onOpenWorkspace={() => navigate(localizePath("/app/studio"))}
                onWorkspaceProfileChange={setWorkspaceProfile}
              />
            </RouteSuspense>
          }
        />
        <Route
          path="/en/pricing"
          element={
            <RouteSuspense>
              <PricingPage
                session={session}
                workspaceProfile={workspaceProfile}
                onOpenSignup={() => openAuth("signup")}
                onOpenSignin={() => openAuth("signin")}
                onLogout={handleLogout}
                onOpenWorkspace={() => navigate(localizePath("/app/studio"))}
                onWorkspaceProfileChange={setWorkspaceProfile}
              />
            </RouteSuspense>
          }
        />
        <Route
          path="/examples"
          element={
            <RouteSuspense>
              <ExamplesPage
                session={session}
                workspaceProfile={workspaceProfile}
                onOpenSignup={() => openAuth("signup")}
                onOpenSignin={() => openAuth("signin")}
                onLogout={handleLogout}
                onOpenWorkspace={() => navigate(localizePath("/app/studio"))}
              />
            </RouteSuspense>
          }
        />
        <Route
          path="/en/examples"
          element={
            <RouteSuspense>
              <ExamplesPage
                session={session}
                workspaceProfile={workspaceProfile}
                onOpenSignup={() => openAuth("signup")}
                onOpenSignin={() => openAuth("signin")}
                onLogout={handleLogout}
                onOpenWorkspace={() => navigate(localizePath("/app/studio"))}
              />
            </RouteSuspense>
          }
        />
        <Route
          path="/app"
          element={
            isSessionPending ? (
              <LoadingScreen />
            ) : shouldBlockWorkspaceRoute ? (
              <LoadingScreen />
            ) : session ? (
              <RouteSuspense>
                <WorkspacePage
                  defaultTab={workspaceEntryTab}
                  initialProfile={workspaceProfile}
                  onLogout={handleLogout}
                  onProfileChange={setWorkspaceProfile}
                  session={session}
                />
              </RouteSuspense>
            ) : (
              <Navigate to={localizePath("/")} replace />
            )
          }
        />
        <Route
          path="/en/app"
          element={
            isSessionPending ? (
              <LoadingScreen />
            ) : shouldBlockWorkspaceRoute ? (
              <LoadingScreen />
            ) : session ? (
              <RouteSuspense>
                <WorkspacePage
                  defaultTab={workspaceEntryTab}
                  initialProfile={workspaceProfile}
                  onLogout={handleLogout}
                  onProfileChange={setWorkspaceProfile}
                  session={session}
                />
              </RouteSuspense>
            ) : (
              <Navigate to={localizePath("/")} replace />
            )
          }
        />
        <Route
          path="/app/studio"
          element={
            isSessionPending ? (
              <LoadingScreen />
            ) : shouldBlockWorkspaceRoute ? (
              <LoadingScreen />
            ) : session ? (
              <RouteSuspense>
                <WorkspacePage
                  defaultTab="studio"
                  initialProfile={workspaceProfile}
                  onLogout={handleLogout}
                  onProfileChange={setWorkspaceProfile}
                  session={session}
                />
              </RouteSuspense>
            ) : (
              <Navigate to={localizePath("/")} replace />
            )
          }
        />
        <Route
          path="/en/app/studio"
          element={
            isSessionPending ? (
              <LoadingScreen />
            ) : shouldBlockWorkspaceRoute ? (
              <LoadingScreen />
            ) : session ? (
              <RouteSuspense>
                <WorkspacePage
                  defaultTab="studio"
                  initialProfile={workspaceProfile}
                  onLogout={handleLogout}
                  onProfileChange={setWorkspaceProfile}
                  session={session}
                />
              </RouteSuspense>
            ) : (
              <Navigate to={localizePath("/")} replace />
            )
          }
        />
        <Route
          path="/app/projects"
          element={
            isSessionPending ? (
              <LoadingScreen />
            ) : shouldBlockWorkspaceRoute ? (
              <LoadingScreen />
            ) : session ? (
              <RouteSuspense>
                <WorkspacePage
                  defaultTab="generations"
                  initialProfile={workspaceProfile}
                  onLogout={handleLogout}
                  onProfileChange={setWorkspaceProfile}
                  session={session}
                />
              </RouteSuspense>
            ) : (
              <Navigate to={localizePath("/")} replace />
            )
          }
        />
        <Route
          path="/en/app/projects"
          element={
            isSessionPending ? (
              <LoadingScreen />
            ) : shouldBlockWorkspaceRoute ? (
              <LoadingScreen />
            ) : session ? (
              <RouteSuspense>
                <WorkspacePage
                  defaultTab="generations"
                  initialProfile={workspaceProfile}
                  onLogout={handleLogout}
                  onProfileChange={setWorkspaceProfile}
                  session={session}
                />
              </RouteSuspense>
            ) : (
              <Navigate to={localizePath("/")} replace />
            )
          }
        />
      </Routes>

      {authState.isOpen ? (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={authState.isOpen}
            mode={authState.mode}
            onClose={closeAuth}
            onModeChange={(mode) => setAuthState({ isOpen: true, mode })}
            onSignedIn={closeAuth}
          />
        </Suspense>
      ) : null}
    </LocaleProvider>
  );
}
