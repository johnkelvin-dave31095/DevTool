import { Suspense, lazy, useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const SpaceHeroCanvas = lazy(async () => {
  const module = await import("../components/login/SpaceHeroCanvas");
  return { default: module.SpaceHeroCanvas };
});

type LoginPageProps = {
  onLogin: (payload: {
    email: string;
    password: string;
  }) => void | Promise<void>;
  isLoggingIn: boolean;
  isLaunching: boolean;
  error: string | null;
  onLaunchComplete: () => void;
};

export function LoginPage({
  onLogin,
  isLoggingIn,
  isLaunching,
  error,
  onLaunchComplete,
}: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginPanelDetached, setIsLoginPanelDetached] = useState(false);
  const effectiveLaunching = isLaunching;

  useEffect(() => {
    if (!isLaunching) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onLaunchComplete();
    }, 4800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isLaunching, onLaunchComplete]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLogin({ email: email.trim(), password });
  }

  function handleReturnToLogin() {
    setIsLoginPanelDetached(true);
  }

  function handleRegenerateScene() {
    window.location.reload();
  }

  const loginPanel = (
    <div className="overflow-hidden border border-[rgba(205,182,233,0.22)] bg-[rgba(39,28,48,0.58)] shadow-[0_30px_90px_rgba(18,12,24,0.44)] backdrop-blur-2xl">
      <div className="px-5 py-5">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label
              htmlFor="login-email"
              className="text-[11px] uppercase tracking-[0.24em] text-[#d0b7f1]"
            >
              Email
            </Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoggingIn || effectiveLaunching}
              className="h-11 rounded-none border-[rgba(205,182,233,0.18)] bg-[rgba(255,255,255,0.08)] px-4 text-[15px] text-[#f3ecff] shadow-none placeholder:text-[rgba(243,236,255,0.32)] focus:border-[#d0b7f1]"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="login-password"
              className="text-[11px] uppercase tracking-[0.24em] text-[#d0b7f1]"
            >
              Password
            </Label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoggingIn || effectiveLaunching}
              placeholder="Enter your password"
              className="h-11 rounded-none border-[rgba(205,182,233,0.18)] bg-[rgba(255,255,255,0.08)] px-4 text-[15px] text-[#f3ecff] shadow-none placeholder:text-[rgba(243,236,255,0.32)] focus:border-[#d0b7f1]"
            />
          </div>

          {error ? (
            <div className="border border-[rgba(255,131,131,0.24)] bg-[rgba(255,131,131,0.10)] px-4 py-3 text-sm text-[#ffb0b0]">
              {error}
            </div>
          ) : null}

          <div>
            <Button
              type="submit"
              disabled={isLoggingIn || effectiveLaunching}
              className="h-11 w-full rounded-none bg-[#d0b7f1] text-[15px] font-semibold text-[#241a2c] shadow-[0_16px_36px_rgba(94,67,128,0.28)] hover:bg-[#dcc9f6]"
            >
              {effectiveLaunching
                ? "Warping"
                : isLoggingIn
                  ? "Signing in"
                  : "Enter"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#211828] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,133,214,0.24),transparent_24%),radial-gradient(circle_at_bottom,rgba(102,79,129,0.28),transparent_34%),linear-gradient(180deg,#4f3c5d_0%,#211828_100%)]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-6 pt-5">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleReturnToLogin}
            disabled={effectiveLaunching}
            className="h-10 rounded-none border border-[rgba(205,182,233,0.18)] bg-[rgba(40,28,50,0.72)] px-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0e6ff] shadow-[0_14px_32px_rgba(18,12,24,0.34)] backdrop-blur-xl transition-colors hover:bg-[rgba(58,42,72,0.9)]"
          >
            Login
          </button>
          <button
            type="button"
            onClick={handleRegenerateScene}
            disabled={effectiveLaunching}
            className="h-10 rounded-none border border-[rgba(205,182,233,0.18)] bg-[rgba(49,37,62,0.72)] px-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f2e7ff] shadow-[0_14px_32px_rgba(18,12,24,0.28)] backdrop-blur-xl transition-colors hover:bg-[rgba(66,49,84,0.9)]"
          >
            Regen
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute left-6 top-1/2 z-10 hidden -translate-y-1/2 xl:block">
        <div className="space-y-7 text-white/92">
          <div className="space-y-1 font-mono text-[12px] leading-none tracking-[0.28em]">
            <p>+</p>
            <p>++</p>
            <p>+++</p>
            <p className="pt-2 text-[11px] uppercase tracking-[0.34em] text-white">
              Scroll to drift deeper
            </p>
            <p>+++</p>
            <p>++</p>
            <p>+</p>
          </div>
          <div className="space-y-1 font-mono text-[12px] leading-none tracking-[0.28em]">
            <p>+</p>
            <p>++</p>
            <p>+++</p>
            <p className="pt-2 text-[11px] uppercase tracking-[0.34em] text-white">
              Click the worlds awake
            </p>
            <p>+++</p>
            <p>++</p>
            <p>+</p>
          </div>
        </div>
      </div>

      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <SpaceHeroCanvas launchSignal={effectiveLaunching} />
        </Suspense>
      </div>

      {isLoginPanelDetached && !effectiveLaunching ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
          <div className="pointer-events-auto w-full max-w-[16.8rem]">
            {loginPanel}
          </div>
        </div>
      ) : null}
    </div>
  );
}
