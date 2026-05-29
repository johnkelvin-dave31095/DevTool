import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, TriangleAlert, X } from "lucide-react";

import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import {
  ApiError,
  ASANA_TICKETS_URL,
  CLOCKIFY_SYNC_URL,
  ClockifyListResponse,
  ClockifyProject,
  ClockifySyncResponse,
  postJson,
} from "../lib/api";
import { cn } from "../lib/utils";

type SplitProject = {
  id: string;
  name: string;
};

type SplitProjectResponse = {
  action: "listSplitProjects";
  projects: SplitProject[];
};

type ClientOption = {
  id: string;
  label: string;
  projectId: string;
  projectName: string;
};

type SplitPlanEntry = {
  order: number;
  title: string;
  description: string;
  start: string;
  end: string;
  projectId: string;
  taskId?: string | null;
  splitHours: number;
};

type SplitPlanResponse = {
  action: "planSplit";
  entries: SplitPlanEntry[];
};

type AppToast = {
  title: string;
  detail?: string;
  tone: "success" | "warning";
};

const PLANNING_TIMEZONE = "Asia/Manila";
const DEFAULT_WORK_START_HOUR = 8;

export function AsanaPage({ currentEmail }: { currentEmail: string }) {
  const [description, setDescription] = useState("");
  const [workDate, setWorkDate] = useState(getToday());
  const [totalHours, setTotalHours] = useState("");
  const [selectedExtraProjectId, setSelectedExtraProjectId] = useState("");
  const [defaultClients, setDefaultClients] = useState<ClientOption[]>([]);
  const [extraClients, setExtraClients] = useState<ClientOption[]>([]);
  const [clockifyProjects, setClockifyProjects] = useState<ClockifyProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<AppToast | null>(null);

  useEffect(() => {
    void loadProjects();
  }, [currentEmail]);

  const allClients = useMemo(
    () => [...defaultClients, ...extraClients],
    [defaultClients, extraClients],
  );

  const availableExtraProjects = useMemo(() => {
    const selectedProjectIds = new Set(
      allClients.map((client) => client.projectId),
    );

    return clockifyProjects
      .filter((project) => !selectedProjectIds.has(project.projectId))
      .sort((left, right) => left.projectName.localeCompare(right.projectName));
  }, [allClients, clockifyProjects]);

  async function loadProjects() {
    setIsLoading(true);
    setError(null);

    try {
      const [catalog, splitProjects] = await Promise.all([
        postJson<ClockifyListResponse, { action: "list"; email: string }>(
          CLOCKIFY_SYNC_URL,
          {
            action: "list",
            email: currentEmail,
          },
        ),
        postJson<SplitProjectResponse, { action: "listSplitProjects" }>(
          ASANA_TICKETS_URL,
          {
            action: "listSplitProjects",
          },
        ),
      ]);

      setClockifyProjects(catalog.projects);
      setDefaultClients(buildClientOptions(splitProjects.projects, catalog.projects));
      setExtraClients([]);
      setSelectedExtraProjectId("");
    } catch (exc) {
      setError(getErrorMessage(exc));
    } finally {
      setIsLoading(false);
    }
  }

  function handleAddExtraProject(projectId: string) {
    if (!projectId) {
      setError("Select a project.");
      return;
    }

    const matchedProject =
      clockifyProjects.find(
        (project) => project.projectId === projectId,
      ) ?? null;

    if (!matchedProject) {
      setError("Selected project was not found.");
      return;
    }

    const nextClient: ClientOption = {
      id: `extra-${matchedProject.projectId}`,
      label: matchedProject.projectName,
      projectId: matchedProject.projectId,
      projectName: matchedProject.projectName,
    };

    const alreadyExists = allClients.some(
      (client) => client.projectId === nextClient.projectId,
    );

    if (alreadyExists) {
      setError(`Project already included: ${matchedProject.projectName}`);
      return;
    }

    setExtraClients((current) => [...current, nextClient]);
    setSelectedExtraProjectId("");
    setError(null);
  }

  function handleRemoveExtraProject(clientId: string) {
    setExtraClients((current) => current.filter((client) => client.id !== clientId));
  }

  async function handlePushToClockify() {
    const trimmedDescription = description.trim();
    const parsedHours = parseHours(totalHours);

    if (!trimmedDescription) {
      setError("Enter a description.");
      return;
    }

    if (!workDate) {
      setError("Select a work date.");
      return;
    }

    if (!parsedHours) {
      setError("Enter total hours greater than zero.");
      return;
    }

    const endTime = resolveEndTime(parsedHours);

    if (!endTime) {
      setError("Total hours must stay within the selected Manila work day.");
      return;
    }

    if (allClients.length === 0) {
      setError("No projects available to split.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const plan = await postJson<
        SplitPlanResponse,
        {
          action: "planSplit";
          email: string;
          description: string;
          totalHours: number;
          workDate: string;
          endTime: string;
          timezone: string;
          clients: Array<{
            clientLabel: string;
            projectId: string;
            projectName: string;
          }>;
        }
      >(ASANA_TICKETS_URL, {
        action: "planSplit",
        email: currentEmail,
        description: trimmedDescription,
        totalHours: parsedHours,
        workDate,
        endTime,
        timezone: PLANNING_TIMEZONE,
        clients: allClients.map((client) => ({
          clientLabel: client.label,
          projectId: client.projectId,
          projectName: client.projectName,
        })),
      });

      const data = await postJson<
        ClockifySyncResponse,
        {
          action: "pushFrClockify";
          email: string;
          workDate: string;
          timezone: string;
          entries: Array<{
            order: number;
            title: string;
            description: string;
            start: string;
            end: string;
            projectId: string;
            taskId?: string;
            billable: boolean;
            splitHours: number;
          }>;
        }
      >(CLOCKIFY_SYNC_URL, {
        action: "pushFrClockify",
        email: currentEmail,
        workDate,
        timezone: PLANNING_TIMEZONE,
        entries: plan.entries.map((entry) => ({
          order: entry.order,
          title: entry.title,
          description: entry.description,
          start: entry.start,
          end: entry.end,
          projectId: entry.projectId,
          ...(entry.taskId ? { taskId: entry.taskId } : {}),
          billable: true,
          splitHours: entry.splitHours,
        })),
      });

      handleClockifyResult(data);
    } catch (exc) {
      if (exc instanceof ApiError && isClockifySyncResponse(exc.details)) {
        handleClockifyResult(exc.details);
      } else {
        setError(getErrorMessage(exc));
        setToast({
          title: "Push failed",
          detail: getErrorMessage(exc),
          tone: "warning",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClockifyResult(data: ClockifySyncResponse) {
    if (data.createdCount > 0) {
      setToast({
        title: "Done",
        detail: `${data.createdCount} created, ${data.skippedCount} skipped.`,
        tone: data.skippedCount > 0 ? "warning" : "success",
      });
      return;
    }

    const firstError =
      data.skipped[0]?.error ?? "No Clockify entries were created.";
    setError(firstError);
    setToast({
      title: "Push skipped",
      detail: firstError,
      tone: "warning",
    });
  }

  return (
    <div className="app-page-shell">
      {error ? <PageAlert text={error} /> : null}

      <Card className="border-border/80 bg-card/95 shadow-none">
        <CardContent className="space-y-5 pt-6">
          <div className="rounded-[14px] border border-border/80 bg-background px-4 py-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="fr-clockify-date">Work Date</Label>
                <Input
                  id="fr-clockify-date"
                  type="date"
                  value={workDate}
                  onChange={(event) => setWorkDate(event.target.value)}
                  className="h-11 rounded-[14px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fr-clockify-hours">Total Hours</Label>
                <Input
                  id="fr-clockify-hours"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={totalHours}
                  onChange={(event) => setTotalHours(event.target.value)}
                  className="h-11 rounded-[14px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fr-clockify-extra-project">Add Project</Label>
                <Select
                  id="fr-clockify-extra-project"
                  value={selectedExtraProjectId}
                  onChange={(event) => {
                    const nextProjectId = event.target.value;
                    setSelectedExtraProjectId(nextProjectId);

                    if (nextProjectId) {
                      handleAddExtraProject(nextProjectId);
                    }
                  }}
                  className="h-11 rounded-[14px]"
                >
                  <option value="">Select project</option>
                  {availableExtraProjects.map((project) => (
                    <option key={project.projectId} value={project.projectId}>
                      {project.projectName}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-3 rounded-[14px] border border-border bg-card px-3 py-3">
              <div className="flex flex-wrap gap-2">
                {isLoading ? (
                  <span className="text-sm text-muted-foreground">Loading projects...</span>
                ) : (
                  <>
                    {defaultClients.map((client) => (
                      <span
                        key={client.id}
                        className="rounded-full border border-border px-3 py-1 text-sm text-foreground"
                      >
                        {client.label}
                      </span>
                    ))}
                    {extraClients.map((client) => (
                      <span
                        key={client.id}
                        className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-sm text-foreground"
                      >
                        {client.label}
                        <button
                          type="button"
                          onClick={() => handleRemoveExtraProject(client.id)}
                          className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fr-clockify-description">Description</Label>
            <textarea
              id="fr-clockify-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={8}
              className="min-h-[220px] w-full resize-none rounded-[14px] border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none transition-colors focus:border-primary/40"
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              onClick={handlePushToClockify}
              disabled={isSubmitting || isLoading}
              className="h-11 rounded-[14px] px-5"
            >
              {isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Push to Clockify
            </Button>
          </div>
        </CardContent>
      </Card>

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 w-full max-w-sm">
          <div
            className={cn(
              "border bg-card p-4 shadow-[0_22px_48px_rgba(18,12,24,0.42)]",
              toast.tone === "success"
                ? "border-primary/24"
                : "border-[rgba(240,119,93,0.22)]",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  toast.tone === "success"
                    ? "bg-primary/10 text-primary"
                    : "bg-accent/10 text-accent",
                )}
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

function PageAlert({ text }: { text: string }) {
  return (
    <section className="border border-[rgba(240,119,93,0.20)] bg-[rgba(240,119,93,0.08)] px-4 py-3 text-sm text-accent">
      <div className="flex gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="font-semibold">{text}</p>
      </div>
    </section>
  );
}

function buildClientOptions(
  splitProjects: SplitProject[],
  clockifyProjects: ClockifyProject[],
) {
  const clockifyByName = new Map(
    clockifyProjects.map((project) => [
      normalizeName(project.projectName),
      project,
    ]),
  );

  return splitProjects
    .map((project) => {
      const clockifyProject = clockifyByName.get(normalizeName(project.name));

      if (!clockifyProject) {
        return null;
      }

      return {
        id: project.id,
        label: project.name,
        projectId: clockifyProject.projectId,
        projectName: clockifyProject.projectName,
      };
    })
    .filter((client): client is ClientOption => Boolean(client))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function parseHours(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentTime() {
  const date = new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function resolveEndTime(totalHours: number) {
  const totalMinutes = Math.round(totalHours * 60);
  const endMinutes = DEFAULT_WORK_START_HOUR * 60 + totalMinutes;

  if (endMinutes > 24 * 60 - 1) {
    return null;
  }

  const hours = String(Math.floor(endMinutes / 60)).padStart(2, "0");
  const minutes = String(endMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getErrorMessage(exc: unknown) {
  if (exc instanceof ApiError) {
    if (exc.details && typeof exc.details === "object") {
      const details = exc.details as Record<string, unknown>;

      if (typeof details.message === "string" && details.message.trim()) {
        return details.message;
      }

      if (typeof details.error === "string" && details.error.trim()) {
        return details.error;
      }
    }

    return `${exc.message} (HTTP ${exc.status})`;
  }

  if (exc instanceof Error) {
    return exc.message;
  }

  return "Unexpected FR Clockify error.";
}

function isClockifySyncResponse(value: unknown): value is ClockifySyncResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeResponse = value as Partial<ClockifySyncResponse>;
  return (
    Array.isArray(maybeResponse.created) && Array.isArray(maybeResponse.skipped)
  );
}
