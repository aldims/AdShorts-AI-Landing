import { type ReactNode, Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { authClient } from "./lib/auth-client";

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

const WORKSPACE_PROFILE_STORAGE_KEY_PREFIX = "adshorts.workspace-profile:";

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

  const profile = value as { balance?: unknown; expiresAt?: unknown; plan?: unknown; startPlanUsed?: unknown };
  const parsedBalance = Number(profile.balance);
  const normalizedPlan = String(profile.plan ?? "").trim().toUpperCase();
  const normalizedExpiresAt = String(profile.expiresAt ?? "").trim() || null;
  const normalizedStartPlanUsed = normalizeWorkspaceBooleanFlag(profile.startPlanUsed) ?? normalizedPlan === "START";

  if (!Number.isFinite(parsedBalance) || !normalizedPlan) {
    return null;
  }

  return {
    balance: Math.max(0, parsedBalance),
    expiresAt: normalizedExpiresAt,
    plan: normalizedPlan,
    startPlanUsed: normalizedStartPlanUsed,
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
    normalizedLeft.startPlanUsed === normalizedRight.startPlanUsed
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

function LoadingScreen() {
  return (
    <div className="route-page route-page--loading">
      <div className="route-loading">
        <span className="route-loading__eyebrow">Auth</span>
        <strong>Проверяем сессию…</strong>
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
  const { data: authSession, isPending: isSessionPending } = authClient.useSession();
  const [authState, setAuthState] = useState<AuthState>({ isOpen: false, mode: "signup" });
  const [workspaceProfile, setWorkspaceProfile] = useState<WorkspaceProfile | null>(null);
  const [isWorkspaceProfilePending, setIsWorkspaceProfilePending] = useState(false);

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

  const shouldBlockWorkspaceRoute = Boolean(session && !workspaceProfile && isWorkspaceProfilePending);

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
    setAuthState({ isOpen: true, mode });
  };

  const closeAuth = () => {
    setAuthState((current) => ({ ...current, isOpen: false }));
  };

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          setWorkspaceProfile(null);
          setIsWorkspaceProfilePending(false);
          closeAuth();
          navigate("/");
        },
      },
    });
  };

  const workspaceEntryTab = useMemo<WorkspaceTab>(() => {
    if (location.pathname.startsWith("/app/studio")) return "studio";
    if (location.pathname.startsWith("/app/projects")) return "generations";
    return "overview";
  }, [location.pathname]);

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <RouteSuspense>
              <LandingPage
                session={session}
                workspaceProfile={workspaceProfile}
                onOpenSignup={() => openAuth("signup")}
                onOpenSignin={() => openAuth("signin")}
                onLogout={handleLogout}
                onOpenWorkspace={() => navigate("/app/studio")}
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
                onOpenWorkspace={() => navigate("/app/studio")}
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
                onOpenWorkspace={() => navigate("/app/studio")}
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
              <Navigate to="/" replace />
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
              <Navigate to="/" replace />
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
              <Navigate to="/" replace />
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
    </>
  );
}
