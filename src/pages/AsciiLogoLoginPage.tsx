import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { AsciiLogoScene } from "../components/login/AsciiLogoScene";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

type AsciiLogoLoginPageProps = {
  onLogin: (payload: {
    email: string;
    password: string;
  }) => void | Promise<void>;
  isLoggingIn: boolean;
  isLaunching: boolean;
  error: string | null;
  onLaunchComplete: () => void;
};

export function AsciiLogoLoginPage({
  onLogin,
  isLoggingIn,
  isLaunching,
  error,
  onLaunchComplete,
}: AsciiLogoLoginPageProps) {
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
    <div className="relative h-screen w-screen overflow-hidden bg-[#05020b] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(120,84,255,0.12),transparent_30%),linear-gradient(180deg,#05020b_0%,#070311_100%)]" />
      <div className="relative z-10 grid h-full w-full lg:grid-cols-[1.2fr_0.8fr]">
        <section className="relative hidden h-full lg:block">
          <AsciiLogoScene />
          <div className="pointer-events-none absolute bottom-8 left-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[rgba(143,116,255,0.72)]">
              drag to rotate
            </p>
          </div>
        </section>

        <section className="relative flex h-full items-center justify-center px-6 py-10 sm:px-8">
          <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-[rgba(120,84,255,0.2)] bg-[linear-gradient(180deg,rgba(10,7,18,0.9),rgba(6,4,12,0.86))] shadow-[0_32px_120px_rgba(0,0,0,0.52)] backdrop-blur-xl">
            <div className="border-b border-[rgba(120,84,255,0.14)] px-6 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8f74ff]">
                Oaktech Systems
              </p>
              <h1 className="mt-2 font-studio text-3xl font-semibold tracking-[-0.04em] text-white">
                Oaktech DevTool
              </h1>
            </div>

            <div className="px-6 py-6">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label
                    htmlFor="ascii-login-email"
                    className="text-[11px] uppercase tracking-[0.24em] text-[#8f74ff]"
                  >
                    Email
                  </Label>
                  <Input
                    id="ascii-login-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isLoggingIn || isLaunching}
                    className="h-12 rounded-2xl border-[rgba(120,84,255,0.18)] bg-[rgba(255,255,255,0.04)] px-4 text-[15px] text-white shadow-none placeholder:text-[rgba(194,202,214,0.42)] focus:border-[#8f74ff]"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="ascii-login-password"
                    className="text-[11px] uppercase tracking-[0.24em] text-[#8f74ff]"
                  >
                    Password
                  </Label>
                  <Input
                    id="ascii-login-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isLoggingIn || isLaunching}
                    className="h-12 rounded-2xl border-[rgba(120,84,255,0.18)] bg-[rgba(255,255,255,0.04)] px-4 text-[15px] text-white shadow-none placeholder:text-[rgba(194,202,214,0.42)] focus:border-[#8f74ff]"
                  />
                </div>

                {error ? (
                  <div className="rounded-2xl border border-[rgba(255,111,111,0.18)] bg-[rgba(255,111,111,0.08)] px-4 py-3 text-sm text-[#ffb4b4]">
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  disabled={isLoggingIn || isLaunching}
                  className="h-12 w-full rounded-2xl bg-[#7854ff] text-[15px] font-semibold text-white shadow-[0_18px_44px_rgba(120,84,255,0.3)] transition-transform hover:translate-y-[-1px] hover:bg-[#8d70ff]"
                >
                  <span>
                    {isLaunching ? "Launching workspace" : isLoggingIn ? "Signing in" : "Continue"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
