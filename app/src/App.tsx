import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { AuthModal } from "./components/AuthModal";
import { authClient } from "./lib/auth-client";
import { LandingPage } from "./pages/LandingPage";
import { PricingPage } from "./pages/PricingPage";
import { WorkspacePage } from "./pages/WorkspacePage";

type AuthMode = "signup" | "signin";
type WorkspaceTab = "overview" | "studio" | "generations" | "billing" | "settings";

type Session = {
  email: string;
  emailVerified: boolean;
  name: string;
  plan: string;
};

type AuthState = {
  isOpen: boolean;
  mode: AuthMode;
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

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: authSession, isPending: isSessionPending } = authClient.useSession();
  const [authState, setAuthState] = useState<AuthState>({ isOpen: false, mode: "signup" });

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
          closeAuth();
          navigate("/");
        },
      },
    });
  };

  const workspaceEntryTab = useMemo<WorkspaceTab>(() => {
    if (location.pathname.startsWith("/app/studio")) return "studio";
    return "overview";
  }, [location.pathname]);

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              session={session}
              onOpenSignup={() => openAuth("signup")}
              onOpenSignin={() => openAuth("signin")}
              onLogout={handleLogout}
              onOpenWorkspace={() => navigate("/app/studio")}
            />
          }
        />
        <Route
          path="/pricing"
          element={
            <PricingPage
              session={session}
              onOpenSignup={() => openAuth("signup")}
              onOpenSignin={() => openAuth("signin")}
              onLogout={handleLogout}
              onOpenWorkspace={() => navigate("/app/studio")}
            />
          }
        />
        <Route
          path="/app"
          element={
            isSessionPending ? (
              <LoadingScreen />
            ) : session ? (
              <WorkspacePage defaultTab={workspaceEntryTab} session={session} onLogout={handleLogout} />
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
            ) : session ? (
              <WorkspacePage defaultTab="studio" session={session} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>

      <AuthModal
        isOpen={authState.isOpen}
        mode={authState.mode}
        onClose={closeAuth}
        onModeChange={(mode) => setAuthState({ isOpen: true, mode })}
        onSignedIn={() => navigate("/app/studio")}
      />
    </>
  );
}
