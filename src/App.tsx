import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  KeyRound,
  Settings2,
  SlidersHorizontal,
  User2,
  X,
} from "lucide-react";

import { Footer } from "./components/Footer";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { Button } from "./components/ui/button";
import { IntegrationPage } from "./pages/IntegrationPage";
import { LoginPage } from "./pages/LoginPage";
import { PreloadRulesPage } from "./pages/PreloadRulesPage";
import { SetupPage } from "./pages/SetupPage";
import {
  ApiError,
  INTEGRATION_SETUP_URL,
  LoginResponse,
  SetupSaveResponse,
  SetupStatusResponse,
  postJson,
} from "./lib/api";

type AppModule = "clockify" | "rules";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [activeModule, setActiveModule] = useState<AppModule>("clockify");
  const [setupState, setSetupState] = useState<"checking" | "needs_setup" | "ready">("checking");
  const [isEditingSetup, setIsEditingSetup] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
  const [isLoginLaunching, setIsLoginLaunching] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<{
    email: string;
    configured: boolean;
    hasClockifyApiKey: boolean;
    clockifyWorkspaceId: string | null;
  } | null>(null);
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
      const nextSnapshot = {
        configured: data.configured,
        hasClockifyApiKey: Boolean(data.hasClockifyApiKey),
        clockifyWorkspaceId: data.clockifyWorkspaceId ?? null,
      };
      setPendingLogin({
        email: resolvedEmail,
        configured: data.configured,
        hasClockifyApiKey: nextSnapshot.hasClockifyApiKey,
        clockifyWorkspaceId: nextSnapshot.clockifyWorkspaceId,
      });
      setSetupSnapshot(nextSnapshot);
      setSetupState(data.configured ? "ready" : "needs_setup");
      setIsEditingSetup(false);
      setIsLoginLaunching(true);
    } catch (exc) {
      setLoginError(getSetupError(exc));
      setPendingLogin(null);
      setIsLoginLaunching(false);
      setIsAuthenticated(false);
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleLoginLaunchComplete() {
    if (!pendingLogin) {
      return;
    }

    window.sessionStorage.setItem("devtool-auth", "true");
    window.sessionStorage.setItem("devtool-email", pendingLogin.email);
    setCurrentEmail(pendingLogin.email);
    setSetupSnapshot({
      configured: pendingLogin.configured,
      hasClockifyApiKey: pendingLogin.hasClockifyApiKey,
      clockifyWorkspaceId: pendingLogin.clockifyWorkspaceId,
    });
    setSetupState(pendingLogin.configured ? "ready" : "needs_setup");
    setIsLoginLaunching(false);
    setPendingLogin(null);
    setIsAuthenticated(true);
  }

  function handleLogout() {
    window.sessionStorage.removeItem("devtool-auth");
    window.sessionStorage.removeItem("devtool-email");
    setIsAuthenticated(false);
    setCurrentEmail("");
    setActiveModule("clockify");
    setSetupState("checking");
    setIsEditingSetup(false);
    setIsSettingsOpen(false);
    setSetupSnapshot({
      configured: false,
      hasClockifyApiKey: false,
      clockifyWorkspaceId: null,
    });
    setLoginError(null);
    setIsLoginLaunching(false);
    setPendingLogin(null);
    setSetupError(null);
    setIsLoggingIn(false);
    setIsSavingSetup(false);
  }

  function handleOpenSetupEditor() {
    setSetupError(null);
    setIsSettingsOpen(false);
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

  function handleOpenSettings() {
    setIsSettingsOpen(true);
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={handleLogin}
        isLoggingIn={isLoggingIn}
        isLaunching={isLoginLaunching}
        error={loginError}
        onLaunchComplete={handleLoginLaunchComplete}
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
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          onOpenSettings={handleOpenSettings}
          onLogout={handleLogout}
        />
        <div className="flex min-w-0 flex-col">
          <Topbar currentEmail={currentEmail} />
          <ModuleRail
            activeModule={activeModule}
            onOpenSettings={handleOpenSettings}
            onSelectModule={setActiveModule}
          />
          <main className="flex-1">
            {activeModule === "clockify" ? (
              <IntegrationPage currentEmail={currentEmail} />
            ) : (
              <PreloadRulesPage currentEmail={currentEmail} />
            )}
          </main>
          <Footer />
        </div>
      </div>
      {isSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(12,31,29,0.28)] p-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl border border-[rgba(37,122,110,0.12)] bg-[rgba(255,255,255,0.98)] shadow-[0_24px_60px_rgba(28,77,71,0.16)]">
            <div className="flex items-center justify-between border-b border-[rgba(37,122,110,0.10)] px-6 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Settings
                </p>
                <h2 className="mt-1 font-studio text-2xl font-semibold tracking-[-0.04em] text-[hsl(var(--sea-ink))]">
                  DevTool settings
                </h2>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(37,122,110,0.12)] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--sea-ink))]"
                onClick={() => setIsSettingsOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 p-6">
              <SettingsMenuItem
                icon={<User2 className="h-4 w-4" />}
                title="Account"
                detail={currentEmail}
              />
              <SettingsMenuItem
                icon={<KeyRound className="h-4 w-4" />}
                title="Clockify setup"
                detail={
                  setupSnapshot.clockifyWorkspaceId
                    ? `Workspace ${setupSnapshot.clockifyWorkspaceId}`
                    : "Open API key and workspace settings"
                }
                actionLabel="Open"
                onClick={handleOpenSetupEditor}
              />
            </div>
          </div>
        </div>
      ) : null}
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

function ModuleRail({
  activeModule,
  onOpenSettings,
  onSelectModule,
}: {
  activeModule: AppModule;
  onOpenSettings: () => void;
  onSelectModule: (module: AppModule) => void;
}) {
  return (
    <div className="border-b border-[rgba(37,122,110,0.10)] bg-[rgba(255,255,255,0.86)] px-4 py-3 lg:hidden">
      <div className="flex gap-2 overflow-x-auto">
        <Button
          type="button"
          variant={activeModule === "clockify" ? "default" : "outline"}
          className="h-10 shrink-0 rounded-full px-4"
          onClick={() => onSelectModule("clockify")}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Clockify
        </Button>
        <Button
          type="button"
          variant={activeModule === "rules" ? "default" : "outline"}
          className="h-10 shrink-0 rounded-full px-4"
          onClick={() => onSelectModule("rules")}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Preload Rules
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 shrink-0 rounded-full px-4"
          onClick={onOpenSettings}
        >
          <Settings2 className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  );
}

function SettingsMenuItem({
  icon,
  title,
  detail,
  actionLabel,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  actionLabel?: string;
  onClick?: () => void;
}) {
  const isInteractive = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isInteractive}
      className="flex items-center justify-between gap-4 border border-[rgba(37,122,110,0.10)] bg-[rgba(250,252,251,0.92)] px-4 py-4 text-left transition-colors enabled:hover:border-[rgba(37,122,110,0.18)] enabled:hover:bg-white disabled:cursor-default"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(37,122,110,0.10)] text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[hsl(var(--sea-ink))]">{title}</p>
          <p className="mt-1 truncate text-sm text-[hsl(var(--muted-foreground))]">{detail}</p>
        </div>
      </div>
      {actionLabel ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          {actionLabel}
        </span>
      ) : null}
    </button>
  );
}
