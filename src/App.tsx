import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  Blocks,
  CheckCircle2,
  KeyRound,
  Settings2,
  SlidersHorizontal,
  TriangleAlert,
  User2,
  X,
} from "lucide-react";

import { Footer } from "./components/Footer";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { AsanaPage } from "./pages/AsanaPage";
import { AsciiLogoLoginPage } from "./pages/AsciiLogoLoginPage";
import { IntegrationPage } from "./pages/IntegrationPage";
import { LoginPage } from "./pages/LoginPage";
import { NewLoginPage } from "./pages/NewLoginPage";
import { PreloadRulesPage } from "./pages/PreloadRulesPage";
import { SetupPage } from "./pages/SetupPage";
import {
  ApiError,
  ChangePasswordResponse,
  INTEGRATION_SETUP_URL,
  LoginResponse,
  SetupSaveResponse,
  SetupStatusResponse,
  postJson,
} from "./lib/api";

type AppModule = "outlook" | "asana" | "rules";
type AppTheme = "purple" | "light";
type LoginVariant = "classic" | "newlogin" | "newlogin-ascii";
type AppToast = {
  title: string;
  detail?: string;
  tone: "success" | "warning";
};

const THEME_STORAGE_KEY = "devtool-theme";

function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "purple") {
    return "purple";
  }

  return "light";
}

function getLoginVariant(): LoginVariant {
  if (typeof window === "undefined") {
    return "newlogin-ascii";
  }

  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const view = new URLSearchParams(window.location.search).get("view")?.toLowerCase();

  if (
    path === "/login" ||
    path === "/login-classic" ||
    path === "/login-original" ||
    hash === "#/login" ||
    hash === "#/login-classic" ||
    hash === "#/login-original" ||
    view === "login" ||
    view === "login-classic" ||
    view === "login-original"
  ) {
    return "classic";
  }

  if (
    path === "/newlogin-ascii" ||
    hash === "#/newlogin-ascii" ||
    view === "newlogin-ascii"
  ) {
    return "newlogin-ascii";
  }

  if (path === "/newlogin" || hash === "#/newlogin" || view === "newlogin") {
    return "newlogin";
  }

  return "newlogin-ascii";
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [activeModule, setActiveModule] = useState<AppModule>("outlook");
  const [theme, setTheme] = useState<AppTheme>(() => getStoredTheme());
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
  const [loginVariant] = useState<LoginVariant>(() => getLoginVariant());
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    repeatNewPassword: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [toast, setToast] = useState<AppToast | null>(null);

  useEffect(() => {
    setIsAuthenticated(window.sessionStorage.getItem("devtool-auth") === "true");
    setCurrentEmail(window.sessionStorage.getItem("devtool-email") ?? "");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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
    setActiveModule("outlook");
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
    setIsPasswordModalOpen(false);
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      repeatNewPassword: "",
    });
    setPasswordError(null);
    setIsChangingPassword(false);
    setToast(null);
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
    asanaApiKey: string;
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
          asanaApiKey: string;
          clockifyWorkspaceId: string;
        }
      >(INTEGRATION_SETUP_URL, {
        action: "save",
        email: currentEmail,
        clockifyApiKey: payload.clockifyApiKey,
        asanaApiKey: payload.asanaApiKey,
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

  function handleOpenPasswordModal() {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      repeatNewPassword: "",
    });
    setPasswordError(null);
    setIsPasswordModalOpen(true);
  }

  function handleClosePasswordModal() {
    setIsPasswordModalOpen(false);
    setPasswordError(null);
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      repeatNewPassword: "",
    });
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);

    const currentPassword = passwordForm.currentPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const repeatNewPassword = passwordForm.repeatNewPassword.trim();

    if (!currentPassword) {
      setPasswordError("Enter your latest password.");
      return;
    }

    if (!newPassword) {
      setPasswordError("Enter a new password.");
      return;
    }

    if (newPassword !== repeatNewPassword) {
      setPasswordError("New password fields do not match.");
      return;
    }

    setIsChangingPassword(true);

    try {
      await postJson<
        ChangePasswordResponse,
        {
          action: "changePassword";
          email: string;
          currentPassword: string;
          newPassword: string;
        }
      >(INTEGRATION_SETUP_URL, {
        action: "changePassword",
        email: currentEmail,
        currentPassword,
        newPassword,
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        repeatNewPassword: "",
      });
      setIsPasswordModalOpen(false);
      setToast({
        title: "Password updated",
        tone: "success",
      });
    } catch (exc) {
      setPasswordError(getSetupError(exc));
    } finally {
      setIsChangingPassword(false);
    }
  }

  if (!isAuthenticated) {
    if (loginVariant === "newlogin-ascii") {
      return (
        <AsciiLogoLoginPage
          onLogin={handleLogin}
          isLoggingIn={isLoggingIn}
          isLaunching={isLoginLaunching}
          error={loginError}
          onLaunchComplete={handleLoginLaunchComplete}
        />
      );
    }

    if (loginVariant === "newlogin") {
      return (
        <NewLoginPage
          onLogin={handleLogin}
          isLoggingIn={isLoggingIn}
          isLaunching={isLoginLaunching}
          error={loginError}
          onLaunchComplete={handleLoginLaunchComplete}
        />
      );
    }

    if (loginVariant === "classic") {
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

    return (
      <AsciiLogoLoginPage
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
      <div className="app-shell flex min-h-screen items-center justify-center px-6">
        <div className="border border-border/80 bg-card/95 px-8 py-6 text-center shadow-[0_24px_48px_rgba(20,14,28,0.28)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            DevTool
          </p>
          <p className="mt-3 font-studio text-2xl font-semibold tracking-[-0.04em] text-foreground">
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
    <div className="app-shell min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[196px_1fr]">
        <Sidebar
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          onOpenSettings={handleOpenSettings}
          onLogout={handleLogout}
        />
        <div className="flex min-w-0 flex-col">
          <Topbar
            currentEmail={currentEmail}
            theme={theme}
            onToggleTheme={() => setTheme((current) => (current === "purple" ? "light" : "purple"))}
          />
          <ModuleRail
            activeModule={activeModule}
            onOpenSettings={handleOpenSettings}
            onSelectModule={setActiveModule}
          />
          <main className="flex-1">
            {activeModule === "outlook" ? (
              <IntegrationPage currentEmail={currentEmail} />
            ) : activeModule === "asana" ? (
              <AsanaPage currentEmail={currentEmail} />
            ) : (
              <PreloadRulesPage currentEmail={currentEmail} />
            )}
          </main>
          <Footer />
        </div>
      </div>
      {isSettingsOpen ? (
        <div className="settings-scrim fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl border border-border/80 bg-card shadow-[0_24px_60px_rgba(18,12,24,0.42)]">
            <div className="flex items-center justify-between border-b border-border/80 px-6 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Settings
                </p>
                <h2 className="mt-1 font-studio text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  DevTool settings
                </h2>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border/80 text-muted-foreground transition-colors hover:text-foreground"
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
              <SettingsMenuItem
                icon={<KeyRound className="h-4 w-4" />}
                title="Change password"
                detail="Update your account password"
                actionLabel="Open"
                onClick={handleOpenPasswordModal}
              />
            </div>
          </div>
        </div>
      ) : null}
      {isPasswordModalOpen ? (
        <div className="settings-scrim fixed inset-0 z-[60] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="w-full max-w-md border border-border/80 bg-card shadow-[0_24px_60px_rgba(18,12,24,0.42)]">
            <div className="flex items-center justify-between border-b border-border/80 px-6 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Account
                </p>
                <h2 className="mt-1 font-studio text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  Change password
                </h2>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border/80 text-muted-foreground transition-colors hover:text-foreground"
                onClick={handleClosePasswordModal}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form className="space-y-5 p-6" onSubmit={handleChangePassword}>
              <div className="space-y-2">
                <Label
                  htmlFor="settings-current-password"
                  className="text-[11px] uppercase tracking-[0.24em] text-primary"
                >
                  Latest password
                </Label>
                <Input
                  id="settings-current-password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                  }
                  className="h-12 rounded-none border-border bg-background/80 text-[15px] shadow-none"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="settings-new-password"
                  className="text-[11px] uppercase tracking-[0.24em] text-primary"
                >
                  New password
                </Label>
                <Input
                  id="settings-new-password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      newPassword: event.target.value,
                    }))
                  }
                  className="h-12 rounded-none border-border bg-background/80 text-[15px] shadow-none"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="settings-repeat-new-password"
                  className="text-[11px] uppercase tracking-[0.24em] text-primary"
                >
                  Repeat new password
                </Label>
                <Input
                  id="settings-repeat-new-password"
                  type="password"
                  value={passwordForm.repeatNewPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      repeatNewPassword: event.target.value,
                    }))
                  }
                  className="h-12 rounded-none border-border bg-background/80 text-[15px] shadow-none"
                />
              </div>

              {passwordError ? (
                <div className="border border-[rgba(240,119,93,0.20)] bg-[rgba(240,119,93,0.08)] px-4 py-3 text-sm text-accent">
                  {passwordError}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full px-4"
                  onClick={handleClosePasswordModal}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isChangingPassword}
                  className="rounded-full px-5"
                >
                  {isChangingPassword ? "Saving" : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div className="fixed bottom-5 right-5 z-[70] w-full max-w-sm">
          <div
            className={[
              "border bg-card p-4 shadow-[0_22px_48px_rgba(18,12,24,0.42)]",
              toast.tone === "success"
                ? "border-primary/24"
                : "border-[rgba(240,119,93,0.22)]",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <span
                className={[
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  toast.tone === "success"
                    ? "bg-primary/10 text-primary"
                    : "bg-accent/10 text-accent",
                ].join(" ")}
              >
                {toast.tone === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <TriangleAlert className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{toast.title}</p>
                {toast.detail ? (
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {toast.detail}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-8 w-8 rounded-full p-0"
                onClick={() => setToast(null)}
              >
                <X className="h-4 w-4" />
              </Button>
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
    <div className="border-b border-border/80 bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex gap-2 overflow-x-auto">
        <Button
          type="button"
          variant={activeModule === "outlook" ? "default" : "outline"}
          className="h-10 shrink-0 rounded-full px-4"
          onClick={() => onSelectModule("outlook")}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Outlook
        </Button>
        <Button
          type="button"
          variant={activeModule === "asana" ? "default" : "outline"}
          className="h-10 shrink-0 rounded-full px-4"
          onClick={() => onSelectModule("asana")}
        >
          <Blocks className="h-4 w-4" />
          Asana
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
      className="flex items-center justify-between gap-4 border border-border/80 bg-muted/35 px-4 py-4 text-left transition-colors enabled:hover:border-primary/24 enabled:hover:bg-muted/60 disabled:cursor-default"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{detail}</p>
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
