import { useState } from "react";
import { Database, KeyRound, Save } from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

type SetupPageProps = {
  email: string;
  isSaving: boolean;
  isEditing?: boolean;
  initialWorkspaceId?: string | null;
  hasExistingApiKey?: boolean;
  error: string | null;
  onSave: (payload: { clockifyApiKey: string; clockifyWorkspaceId: string }) => void;
  onCancel?: () => void;
  onLogout: () => void;
};

export function SetupPage({
  email,
  isSaving,
  isEditing = false,
  initialWorkspaceId,
  hasExistingApiKey = false,
  error,
  onSave,
  onCancel,
  onLogout,
}: SetupPageProps) {
  const [clockifyApiKey, setClockifyApiKey] = useState("");
  const [clockifyWorkspaceId, setClockifyWorkspaceId] = useState(initialWorkspaceId ?? "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      clockifyApiKey: clockifyApiKey.trim(),
      clockifyWorkspaceId: clockifyWorkspaceId.trim(),
    });
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(246,251,250,0.98),rgba(239,246,244,0.96))] text-foreground">
      <div className="mx-auto grid min-h-screen max-w-[1480px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden border-b border-[rgba(37,122,110,0.10)] px-6 py-10 sm:px-10 lg:border-b-0 lg:border-r lg:px-14 lg:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(84,176,160,0.16),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(14,89,104,0.08),transparent_26%)]" />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(37,122,110,0.98),rgba(68,167,152,0.92))] text-white shadow-[0_18px_32px_rgba(37,122,110,0.22)]">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <p className="font-studio text-2xl font-semibold tracking-[-0.04em] text-[hsl(var(--sea-ink))]">
                  DevTool setup
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  One-time Clockify connection
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {isEditing && onCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="rounded-full px-4"
                >
                  Back
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={onLogout}
                className="rounded-full px-4"
              >
                Sign out
              </Button>
            </div>

            <div className="mt-16 max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">
                Per-user configuration
              </p>
              <h1 className="mt-4 font-studio text-5xl font-semibold tracking-[-0.06em] text-[hsl(var(--sea-ink))] sm:text-6xl">
                {isEditing
                  ? "Update your Clockify credentials and workspace access."
                  : "Connect your Clockify credentials before using sync."}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-[hsl(var(--muted-foreground))]">
                {isEditing
                  ? "Your login email stays mapped to Outlook. Re-enter the Clockify API key and update the workspace id whenever access changes."
                  : "Your login email is already used for Outlook. You only need to save your Clockify API key and workspace id once."}
              </p>
            </div>

            <div className="mt-12 border border-[rgba(37,122,110,0.10)] bg-[rgba(255,255,255,0.72)] p-5 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                Current user
              </p>
              <p className="mt-3 text-xl font-semibold text-[hsl(var(--sea-ink))]">{email}</p>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                Outlook requests will use this email automatically.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-xl border border-[rgba(37,122,110,0.12)] bg-[rgba(255,255,255,0.94)] p-7 shadow-[0_28px_60px_rgba(34,88,82,0.10)] backdrop-blur-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">
                Clockify credentials
              </p>
              <h2 className="mt-3 font-studio text-3xl font-semibold tracking-[-0.05em] text-[hsl(var(--sea-ink))]">
                Save workspace access
              </h2>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="clockify-api-key" className="text-[11px] uppercase tracking-[0.24em] text-primary">
                  Clockify API key
                </Label>
                <Input
                  id="clockify-api-key"
                  type="text"
                  value={clockifyApiKey}
                  onChange={(event) => setClockifyApiKey(event.target.value)}
                  placeholder={hasExistingApiKey ? "Enter a new Clockify API key" : ""}
                  className="h-12 rounded-none border-[rgba(37,122,110,0.14)] bg-white text-[15px] shadow-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clockify-workspace-id" className="text-[11px] uppercase tracking-[0.24em] text-primary">
                  Clockify workspace id
                </Label>
                <Input
                  id="clockify-workspace-id"
                  type="text"
                  value={clockifyWorkspaceId}
                  onChange={(event) => setClockifyWorkspaceId(event.target.value)}
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
                disabled={isSaving}
                className="h-12 w-full rounded-full bg-[#111533] text-[15px] font-semibold text-white shadow-[0_14px_30px_rgba(17,21,51,0.18)] hover:bg-[#171c42]"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving setup" : isEditing ? "Update setup" : "Save setup"}
              </Button>
            </form>

            <div className="mt-6 flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
              <KeyRound className="h-4 w-4 text-primary" />
              Stored per user for this DevTool workspace.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
