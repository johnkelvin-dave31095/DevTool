import { useState } from "react";
import { ChevronRight, KeyRound, Save, Settings2 } from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const DEFAULT_CLOCKIFY_WORKSPACE_ID = "67325a7a4b43c758b9738504";

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
  const [clockifyWorkspaceId, setClockifyWorkspaceId] = useState(
    initialWorkspaceId ?? DEFAULT_CLOCKIFY_WORKSPACE_ID,
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      clockifyApiKey: clockifyApiKey.trim(),
      clockifyWorkspaceId: clockifyWorkspaceId.trim(),
    });
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(79,60,93,0.38),rgba(28,21,36,0.96))] px-6 py-10 text-foreground sm:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
            <span>Settings</span>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">Clockify setup</span>
          </div>
          <div className="flex flex-wrap gap-3">
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
        </div>

        <div className="mt-6 border border-border/80 bg-card/95 p-6 shadow-[0_18px_40px_rgba(20,14,28,0.28)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Settings2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                    Clockify setup
                  </p>
                  <h1 className="mt-1 font-studio text-3xl font-semibold tracking-[-0.05em] text-foreground">
                    {isEditing ? "Update credentials" : "Connect workspace"}
                  </h1>
                </div>
              </div>
            </div>
            <div className="min-w-[220px] border border-border/80 bg-muted/50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                Account
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-foreground">{email}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Outlook requests stay mapped to this user.
              </p>
            </div>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
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
                  className="h-12 rounded-none border-border bg-background/80 text-[15px] shadow-none"
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
                  className="h-12 rounded-none border-border bg-background/80 text-[15px] shadow-none"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 border border-border/80 bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>Stored per user. The workspace id is prefilled for your shared company workspace.</p>
            </div>

            {error ? (
              <div className="border border-[rgba(240,119,93,0.20)] bg-[rgba(240,119,93,0.08)] px-4 py-3 text-sm text-accent">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-end">
              <Button
                type="submit"
                disabled={isSaving}
                className="h-12 rounded-full px-6 text-[15px] font-semibold shadow-[0_14px_30px_rgba(36,24,48,0.26)]"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving setup" : isEditing ? "Update setup" : "Save setup"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
