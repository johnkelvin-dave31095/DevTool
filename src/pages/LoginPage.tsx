import { Suspense, lazy, useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const SpaceHeroCanvas = lazy(async () => {
  const module = await import("../components/login/SpaceHeroCanvas");
  return { default: module.SpaceHeroCanvas };
});

type LoginPageProps = {
  onLogin: (payload: { email: string; password: string }) => void | Promise<void>;
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
  const [email, setEmail] = useState("johnkelvin.dave@oaktechsystems.com");
  const [password, setPassword] = useState("");
  const [resetSignal, setResetSignal] = useState(0);
  const [isPreviewLaunching, setIsPreviewLaunching] = useState(false);
  const effectiveLaunching = isLaunching || isPreviewLaunching;

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

  useEffect(() => {
    if (!isPreviewLaunching) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsPreviewLaunching(false);
      setResetSignal((value) => value + 1);
    }, 4800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isPreviewLaunching]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLogin({ email: email.trim(), password });
  }

  function handleReturnToLogin() {
    setResetSignal((value) => value + 1);
  }

  function handlePreviewLaunch() {
    setIsPreviewLaunching(true);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030916] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(90,132,255,0.24),transparent_24%),radial-gradient(circle_at_bottom,rgba(71,197,165,0.16),transparent_30%),linear-gradient(180deg,#050c19_0%,#020611_100%)]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-6 pt-5">
        <button
          type="button"
          onClick={handleReturnToLogin}
          disabled={effectiveLaunching}
          className="pointer-events-auto h-10 rounded-full border border-[rgba(177,214,255,0.18)] bg-[rgba(8,16,31,0.72)] px-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#dbe9ff] shadow-[0_14px_32px_rgba(2,6,18,0.34)] backdrop-blur-xl transition-colors hover:bg-[rgba(13,24,45,0.9)]"
        >
          Login
        </button>
      </div>

      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <SpaceHeroCanvas
            resetSignal={resetSignal}
            launchSignal={effectiveLaunching}
          >
            <div className="overflow-hidden rounded-[1.4rem] border border-[rgba(177,214,255,0.22)] bg-[rgba(10,19,38,0.46)] shadow-[0_30px_90px_rgba(3,8,20,0.44)] backdrop-blur-2xl">
              <div className="border-b border-[rgba(177,214,255,0.16)] px-5 py-5 text-center">
                <p className="font-studio text-[2rem] font-semibold tracking-[-0.06em] text-[#f4f9ff]">
                  Dev Tool
                </p>
              </div>

              <div className="px-5 py-5">
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label
                      htmlFor="login-email"
                      className="text-[11px] uppercase tracking-[0.24em] text-[#8dbdff]"
                    >
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={isLoggingIn || effectiveLaunching}
                      className="h-11 rounded-[0.95rem] border-[rgba(177,214,255,0.18)] bg-[rgba(255,255,255,0.08)] px-4 text-[15px] text-[#eff6ff] shadow-none placeholder:text-[rgba(239,246,255,0.32)] focus:border-[#79bcff]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="login-password"
                      className="text-[11px] uppercase tracking-[0.24em] text-[#8dbdff]"
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
                      className="h-11 rounded-[0.95rem] border-[rgba(177,214,255,0.18)] bg-[rgba(255,255,255,0.08)] px-4 text-[15px] text-[#eff6ff] shadow-none placeholder:text-[rgba(239,246,255,0.32)] focus:border-[#79bcff]"
                    />
                  </div>

                  {error ? (
                    <div className="rounded-[0.95rem] border border-[rgba(255,131,131,0.24)] bg-[rgba(255,131,131,0.10)] px-4 py-3 text-sm text-[#ffb0b0]">
                      {error}
                    </div>
                  ) : null}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="submit"
                      disabled={isLoggingIn || effectiveLaunching}
                      className="h-11 w-full rounded-full bg-[#dfeeff] text-[15px] font-semibold text-[#081324] shadow-[0_16px_36px_rgba(157,204,255,0.2)] hover:bg-white"
                    >
                      {effectiveLaunching ? "Warping" : isLoggingIn ? "Signing in" : "Enter"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isLoggingIn || effectiveLaunching}
                      onClick={handlePreviewLaunch}
                      className="h-11 w-full rounded-full border-[rgba(177,214,255,0.22)] bg-[rgba(255,255,255,0.04)] text-[13px] font-semibold text-[#dce9ff] hover:bg-[rgba(255,255,255,0.08)]"
                    >
                      Preview Warp
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </SpaceHeroCanvas>
        </Suspense>
      </div>
    </div>
  );
}
