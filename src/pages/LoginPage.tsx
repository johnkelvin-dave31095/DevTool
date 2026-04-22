import { useState } from "react";
import { ArrowRight, KeyRound, ShieldCheck, Wrench } from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

type LoginPageProps = {
  onLogin: (payload: { email: string; password: string }) => void | Promise<void>;
  isLoggingIn: boolean;
  error: string | null;
};

export function LoginPage({ onLogin, isLoggingIn, error }: LoginPageProps) {
  const [email, setEmail] = useState("johnkelvin.dave@oaktechsystems.com");
  const [password, setPassword] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLogin({ email: email.trim(), password });
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(246,251,250,0.98),rgba(239,246,244,0.96))] text-foreground">
      <div className="mx-auto grid min-h-screen max-w-[1480px] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden border-b border-[rgba(37,122,110,0.10)] px-6 py-10 sm:px-10 lg:border-b-0 lg:border-r lg:px-14 lg:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(84,176,160,0.16),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(14,89,104,0.08),transparent_26%)]" />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(37,122,110,0.98),rgba(68,167,152,0.92))] text-white shadow-[0_18px_32px_rgba(37,122,110,0.22)]">
                <Wrench className="h-6 w-6" />
              </div>
              <div>
                <p className="font-studio text-2xl font-semibold tracking-[-0.04em] text-[hsl(var(--sea-ink))]">
                  DevTool
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Internal sync control
                </p>
              </div>
            </div>

            <div className="mt-16 max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">
                Production workspace
              </p>
              <h1 className="mt-4 font-studio text-5xl font-semibold tracking-[-0.06em] text-[hsl(var(--sea-ink))] sm:text-6xl">
                DevTool access for Outlook and Clockify operations.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-[hsl(var(--muted-foreground))]">
                Credential-backed sync, review-first delivery, and one place to manage the internal time pipeline.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              <LoginSignal
                icon={ShieldCheck}
                title="Secure entry"
                detail="Internal-only sign in"
              />
              <LoginSignal
                icon={KeyRound}
                title="User mapping"
                detail="Per-user credentials"
              />
              <LoginSignal
                icon={ArrowRight}
                title="Fast review"
                detail="Push after approval"
              />
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-md border border-[rgba(37,122,110,0.12)] bg-[rgba(255,255,255,0.94)] p-7 shadow-[0_28px_60px_rgba(34,88,82,0.10)] backdrop-blur-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">
                Sign in
              </p>
              <h2 className="mt-3 font-studio text-3xl font-semibold tracking-[-0.05em] text-[hsl(var(--sea-ink))]">
                Open DevTool
              </h2>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-[11px] uppercase tracking-[0.24em] text-primary">
                  Email
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 rounded-none border-[rgba(37,122,110,0.14)] bg-white text-[15px] shadow-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-[11px] uppercase tracking-[0.24em] text-primary">
                  Password
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="h-12 rounded-none border-[rgba(37,122,110,0.14)] bg-white text-[15px] shadow-none"
                />
              </div>

              {error ? (
                <div className="border border-[rgba(240,119,93,0.20)] bg-[rgba(240,119,93,0.08)] px-4 py-3 text-sm text-accent">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={isLoggingIn}
                className="h-12 w-full rounded-full bg-[#111533] text-[15px] font-semibold text-white shadow-[0_14px_30px_rgba(17,21,51,0.18)] hover:bg-[#171c42]"
              >
                {isLoggingIn ? "Signing in" : "Enter workspace"}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

function LoginSignal({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof ShieldCheck;
  title: string;
  detail: string;
}) {
  return (
    <div className="border border-[rgba(37,122,110,0.10)] bg-[rgba(255,255,255,0.72)] p-4 backdrop-blur-sm">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-4 font-semibold text-[hsl(var(--sea-ink))]">{title}</p>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{detail}</p>
    </div>
  );
}
