import { useEffect, useState } from "react";

import { Footer } from "./components/Footer";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { IntegrationPage } from "./pages/IntegrationPage";
import { LoginPage } from "./pages/LoginPage";
import { SetupPage } from "./pages/SetupPage";
import {
  ApiError,
  INTEGRATION_SETUP_URL,
  LoginResponse,
  SetupSaveResponse,
  SetupStatusResponse,
  postJson,
} from "./lib/api";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [setupState, setSetupState] = useState<"checking" | "needs_setup" | "ready">("checking");
  const [isEditingSetup, setIsEditingSetup] = useState(false);
  const [setupSnapshot, setSetupSnapshot] = useState<{
    configured: boolean;
    hasClockifyApiKey: boolean;
    clockifyWorkspaceId: string | null;
  }>({
    configured: false,
    hasClockifyApiKey: false,
    clockifyWorkspaceId: null,
  });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSavingSetup, setIsSavingSetup] = useState(false);

  useEffect(() => {
    setIsAuthenticated(window.sessionStorage.getItem("devtool-auth") === "true");
    setCurrentEmail(window.sessionStorage.getItem("devtool-email") ?? "");
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !currentEmail) {
      return;
    }

    let isActive = true;

    async function checkSetup() {
      setSetupError(null);
      setSetupState("checking");

      try {
        const data = await postJson<
          SetupStatusResponse,
          { action: "status"; email: string }
        >(INTEGRATION_SETUP_URL, {
          action: "status",
          email: currentEmail,
        });

        if (!isActive) {
          return;
        }

        setSetupSnapshot({
          configured: data.configured,
          hasClockifyApiKey: Boolean(data.hasClockifyApiKey),
          clockifyWorkspaceId: data.clockifyWorkspaceId ?? null,
        });
        setSetupState(data.configured ? "ready" : "needs_setup");
      } catch (exc) {
        if (!isActive) {
          return;
        }

        setSetupError(getSetupError(exc));
        setSetupState("needs_setup");
      }
    }

    checkSetup();

    return () => {
      isActive = false;
    };
  }, [currentEmail, isAuthenticated]);

  async function handleLogin(payload: { email: string; password: string }) {
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const data = await postJson<
        LoginResponse,
        { action: "login"; email: string; password: string }
      >(INTEGRATION_SETUP_URL, {
        action: "login",
        email: payload.email,
        password: payload.password,
      });

      if (!data.authenticated) {
        throw new Error("Login failed.");
      }

      const resolvedEmail = data.email?.trim() || payload.email.trim();

      if (!resolvedEmail) {
        throw new Error("Login succeeded but no email was returned.");
      }

      window.sessionStorage.setItem("devtool-auth", "true");
      window.sessionStorage.setItem("devtool-email", resolvedEmail);
      setCurrentEmail(resolvedEmail);
      setSetupSnapshot({
        configured: data.configured,
        hasClockifyApiKey: Boolean(data.hasClockifyApiKey),
        clockifyWorkspaceId: data.clockifyWorkspaceId ?? null,
      });
      setSetupState(data.configured ? "ready" : "needs_setup");
      setIsEditingSetup(false);
      setIsAuthenticated(true);
    } catch (exc) {
      setLoginError(getSetupError(exc));
      setIsAuthenticated(false);
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleLogout() {
    window.sessionStorage.removeItem("devtool-auth");
    window.sessionStorage.removeItem("devtool-email");
    setIsAuthenticated(false);
    setCurrentEmail("");
    setSetupState("checking");
    setIsEditingSetup(false);
    setSetupSnapshot({
      configured: false,
      hasClockifyApiKey: false,
      clockifyWorkspaceId: null,
    });
    setLoginError(null);
    setSetupError(null);
    setIsLoggingIn(false);
    setIsSavingSetup(false);
  }

  function handleOpenSetupEditor() {
    setSetupError(null);
    setIsEditingSetup(true);
  }

  function handleCloseSetupEditor() {
    setSetupError(null);
    setIsEditingSetup(false);
  }

  async function handleSetupSave(payload: {
    clockifyApiKey: string;
    clockifyWorkspaceId: string;
  }) {
    setSetupError(null);
    setIsSavingSetup(true);

    try {
      await postJson<
        SetupSaveResponse,
        {
          action: "save";
          email: string;
          clockifyApiKey: string;
          clockifyWorkspaceId: string;
        }
      >(INTEGRATION_SETUP_URL, {
        action: "save",
        email: currentEmail,
        clockifyApiKey: payload.clockifyApiKey,
        clockifyWorkspaceId: payload.clockifyWorkspaceId,
      });

      setSetupSnapshot({
        configured: true,
        hasClockifyApiKey: true,
        clockifyWorkspaceId: payload.clockifyWorkspaceId,
      });
      setSetupState("ready");
      setIsEditingSetup(false);
    } catch (exc) {
      setSetupError(getSetupError(exc));
    } finally {
      setIsSavingSetup(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={handleLogin}
        isLoggingIn={isLoggingIn}
        error={loginError}
      />
    );
  }

  if (setupState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,rgba(246,251,250,0.98),rgba(239,246,244,0.96))] px-6">
        <div className="border border-[rgba(37,122,110,0.12)] bg-[rgba(255,255,255,0.92)] px-8 py-6 text-center shadow-[0_24px_48px_rgba(34,88,82,0.10)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            DevTool
          </p>
          <p className="mt-3 font-studio text-2xl font-semibold tracking-[-0.04em] text-[hsl(var(--sea-ink))]">
            Checking workspace setup
          </p>
        </div>
      </div>
    );
  }

  if (setupState === "needs_setup" || isEditingSetup) {
    return (
      <SetupPage
        email={currentEmail}
        isSaving={isSavingSetup}
        isEditing={isEditingSetup && setupState === "ready"}
        initialWorkspaceId={setupSnapshot.clockifyWorkspaceId}
        hasExistingApiKey={setupSnapshot.hasClockifyApiKey}
        error={setupError}
        onSave={handleSetupSave}
        onCancel={isEditingSetup ? handleCloseSetupEditor : undefined}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[196px_1fr]">
        <Sidebar
          currentEmail={currentEmail}
          onEditSetup={handleOpenSetupEditor}
          onLogout={handleLogout}
        />
        <div className="flex min-w-0 flex-col">
          <Topbar currentEmail={currentEmail} />
          <main className="flex-1">
            <IntegrationPage currentEmail={currentEmail} />
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}

function getSetupError(exc: unknown) {
  if (exc instanceof ApiError) {
    return exc.message;
  }

  if (exc instanceof Error) {
    return exc.message;
  }

  return "Unexpected setup error.";
}
