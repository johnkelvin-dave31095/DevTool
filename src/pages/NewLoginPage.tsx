import { Suspense, lazy, useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const OrbitHeroCanvas = lazy(async () => {
  const module = await import("../components/login/OrbitHeroCanvas");
  return { default: module.OrbitHeroCanvas };
});

type NewLoginPageProps = {
  onLogin: (payload: {
    email: string;
    password: string;
  }) => void | Promise<void>;
  isLoggingIn: boolean;
  isLaunching: boolean;
  error: string | null;
  onLaunchComplete: () => void;
};

export function NewLoginPage({
  onLogin,
  isLoggingIn,
  isLaunching,
  error,
  onLaunchComplete,
}: NewLoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060816] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(108,160,255,0.22),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(255,181,120,0.14),transparent_18%),linear-gradient(135deg,#07111f_0%,#050814_42%,#0b1325_100%)]" />
      <div className="absolute inset-y-0 right-[-18%] w-[56%] rotate-[18deg] bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.01))] blur-3xl" />
      <div className="absolute inset-y-0 left-[-22%] w-[48%] rotate-[-12deg] bg-[radial-gradient(circle,rgba(120,210,255,0.16),transparent_62%)] blur-3xl" />

      <div className="absolute inset-0 opacity-80">
        <Suspense fallback={null}>
          <OrbitHeroCanvas />
        </Suspense>
      </div>

      <div className="relative z-10 flex min-h-screen items-center px-6 py-10">
        <div className="mx-auto grid w-full max-w-7xl gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="flex flex-col justify-between border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,29,0.78),rgba(7,11,23,0.42))] p-8 shadow-[0_32px_120px_rgba(3,8,20,0.55)] backdrop-blur-xl md:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-none border border-[#8bb8ff]/30 bg-[#091325]/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d9e7ff]">
                <Sparkles className="h-3.5 w-3.5 text-[#8bb8ff]" />
                Login Concept 02
              </div>

              <div className="mt-8 max-w-2xl">
                <p className="text-sm uppercase tracking-[0.34em] text-[#8ea8d8]">
                  New idea exploration
                </p>
                <h1 className="mt-4 font-studio text-5xl font-semibold tracking-[-0.05em] text-[#f6f8ff] sm:text-6xl">
                  A sharper, more editorial entry point for DevTool.
                </h1>
                <p className="mt-6 max-w-xl text-base leading-7 text-[#b5c4e6]">
                  This alternate login keeps the same auth flow, but pushes the visual direction
                  toward a cleaner command-center concept with layered depth and a calmer form
                  presentation.
                </p>
              </div>
            </div>

            <div className="mt-10 grid gap-4 text-sm text-[#d8e2f5] sm:grid-cols-3">
              <div className="rounded-none border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#7fa5df]">Signal</p>
                <p className="mt-3 text-base leading-6">Stronger content hierarchy for first-time focus.</p>
              </div>
              <div className="rounded-none border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#7fa5df]">Surface</p>
                <p className="mt-3 text-base leading-6">Warmer glass treatment with less visual noise on the form.</p>
              </div>
              <div className="rounded-none border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#7fa5df]">Mood</p>
                <p className="mt-3 text-base leading-6">A quieter, premium alternative to the original space portal.</p>
              </div>
            </div>
          </section>

          <section className="relative flex items-center justify-center">
            <div className="w-full max-w-md overflow-hidden rounded-[14px] border border-[rgba(171,197,255,0.22)] bg-[linear-gradient(180deg,rgba(246,248,255,0.92),rgba(225,233,255,0.78))] text-[#09111f] shadow-[0_32px_120px_rgba(2,7,18,0.48)] backdrop-blur-2xl">
              <div className="border-b border-[rgba(9,17,31,0.08)] px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#4f6fa8]">
                  Alternate login
                </p>
                <h2 className="mt-3 font-studio text-3xl font-semibold tracking-[-0.04em] text-[#0a1222]">
                  Sign in to continue
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#4a5975]">
                  Testing a second direction without touching the live login page.
                </p>
              </div>

              <div className="px-6 py-6">
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label
                      htmlFor="new-login-email"
                      className="text-[11px] uppercase tracking-[0.24em] text-[#4f6fa8]"
                    >
                      Email
                    </Label>
                    <Input
                      id="new-login-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={isLoggingIn || isLaunching}
                      placeholder="name@company.com"
                      className="h-12 rounded-none border-[rgba(88,116,168,0.18)] bg-white/75 px-4 text-[15px] text-[#0a1222] shadow-none placeholder:text-[#7a88a3] focus:border-[#6489d4]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="new-login-password"
                      className="text-[11px] uppercase tracking-[0.24em] text-[#4f6fa8]"
                    >
                      Password
                    </Label>
                    <Input
                      id="new-login-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={isLoggingIn || isLaunching}
                      placeholder="Enter your password"
                      className="h-12 rounded-none border-[rgba(88,116,168,0.18)] bg-white/75 px-4 text-[15px] text-[#0a1222] shadow-none placeholder:text-[#7a88a3] focus:border-[#6489d4]"
                    />
                  </div>

                  {error ? (
                    <div className="rounded-none border border-[rgba(192,72,72,0.18)] bg-[rgba(255,92,92,0.09)] px-4 py-3 text-sm text-[#9f2f2f]">
                      {error}
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={isLoggingIn || isLaunching}
                    className="h-12 w-full rounded-none bg-[#0b1730] text-[15px] font-semibold text-white shadow-[0_18px_44px_rgba(11,23,48,0.28)] transition-transform hover:translate-y-[-1px] hover:bg-[#132344]"
                  >
                    <span>
                      {isLaunching ? "Launching workspace" : isLoggingIn ? "Signing in" : "Continue"}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>

                <div className="mt-6 flex items-center justify-between gap-4 border-t border-[rgba(9,17,31,0.08)] pt-5 text-xs uppercase tracking-[0.24em] text-[#5a6d90]">
                  <span>Concept-only route</span>
                  <a
                    href="/"
                    className="font-semibold text-[#15346b] transition-colors hover:text-[#0b1730]"
                  >
                    Back to original login
                  </a>
                </div>
              </div>
            </div>

            {isLaunching ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center border border-white/10 bg-[rgba(3,9,20,0.45)] backdrop-blur-md">
                <div className="border border-white/10 bg-[rgba(10,18,34,0.82)] px-8 py-7 text-center shadow-[0_22px_80px_rgba(0,0,0,0.34)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#8fb2ec]">
                    DevTool
                  </p>
                  <p className="mt-3 font-studio text-2xl font-semibold tracking-[-0.04em] text-white">
                    Preparing your workspace
                  </p>
                  <p className="mt-2 text-sm text-[#b4c4e0]">
                    Holding on this concept screen while the app finishes its login handoff.
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
