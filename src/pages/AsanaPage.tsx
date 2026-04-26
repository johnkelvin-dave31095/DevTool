import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import {
  ApiError,
  ASANA_TICKETS_URL,
  AsanaTicketsResponse,
  CLOCKIFY_SYNC_URL,
  ClockifyListResponse,
  ClockifyProject,
  ClockifySyncResponse,
  postJson,
} from "../lib/api";
import { cn } from "../lib/utils";

type ReviewStatus = "ready" | "needs_review" | "error" | "skipped";
type DescriptionParts = {
  link: boolean;
  title: boolean;
  section: boolean;
  body: boolean;
};

type AppToast = {
  title: string;
  detail?: string;
  tone: "success" | "warning";
};

type AsanaTaskRow = {
  title?: string;
  projects: string[];
  section?: string[];
  ticket_link?: string;
  ticket_date_creation: string | null;
  ticket_date_done: string | null;
  description: string;
};

type AsanaDraftRow = {
  id: string;
  sourceLink: string;
  sourceTitle: string;
  sourceSection: string;
  sourceBody: string;
  createdAt: string | null;
  doneAt: string | null;
  include: boolean;
  projectId: string;
  taskId: string;
  hours: number;
  description: string;
};

type ReviewedAsanaRow = AsanaDraftRow & {
  status: ReviewStatus;
  projectName?: string;
  taskName?: string;
  issues: Array<{
    tone: "warning" | "error";
    message: string;
  }>;
};

export function AsanaPage({ currentEmail }: { currentEmail: string }) {
  const [startDate, setStartDate] = useState(getMonthStart());
  const [endDate, setEndDate] = useState(getToday());
  const [projects, setProjects] = useState<ClockifyProject[]>([]);
  const [draftRows, setDraftRows] = useState<AsanaDraftRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<AppToast | null>(null);
  const [descriptionParts, setDescriptionParts] = useState<DescriptionParts>({
    link: false,
    title: false,
    section: false,
    body: true,
  });
  const [activeDescriptionRowId, setActiveDescriptionRowId] = useState<
    string | null
  >(null);

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.projectId, project])),
    [projects],
  );

  const reviewedRows = useMemo(
    () => draftRows.map((row) => validateRow(row, projectById)),
    [draftRows, projectById],
  );

  const activeDescriptionRow = useMemo(
    () => reviewedRows.find((row) => row.id === activeDescriptionRowId) ?? null,
    [activeDescriptionRowId, reviewedRows],
  );

  const summary = useMemo(() => {
    const readyCount = reviewedRows.filter(
      (row) => row.status === "ready",
    ).length;
    const needsReviewCount = reviewedRows.filter(
      (row) => row.status === "needs_review",
    ).length;
    const errorCount = reviewedRows.filter(
      (row) => row.status === "error",
    ).length;
    const includedCount = reviewedRows.filter((row) => row.include).length;

    return {
      total: reviewedRows.length,
      readyCount,
      needsReviewCount,
      errorCount,
      includedCount,
      canSubmit:
        readyCount > 0 &&
        needsReviewCount === 0 &&
        errorCount === 0 &&
        includedCount > 0,
    };
  }, [reviewedRows]);

  const allRowsIncluded =
    reviewedRows.length > 0 && reviewedRows.every((row) => row.include);

  const asanaStatus = useMemo(() => {
    if (isLoading) {
      return { label: "Building review", variant: "secondary" as const };
    }

    if (isSubmitting) {
      return { label: "Pushing to Clockify", variant: "secondary" as const };
    }

    if (summary.errorCount > 0 || summary.needsReviewCount > 0 || error) {
      return { label: "Needs review", variant: "accent" as const };
    }

    if (summary.readyCount > 0) {
      return { label: "Ready", variant: "default" as const };
    }

    return { label: "Ready", variant: "default" as const };
  }, [error, isLoading, isSubmitting, summary]);

  async function handleLoadTickets() {
    setError(null);
    setIsLoading(true);

    try {
      const [asanaData, catalog] = await Promise.all([
        postJson<
          AsanaTicketsResponse,
          { email: string; start: string; end: string; limit: number }
        >(ASANA_TICKETS_URL, {
          email: currentEmail,
          start: `${startDate}T00:00:00+08:00`,
          end: `${endDate}T23:59:59+08:00`,
          limit: 100,
        }),
        postJson<ClockifyListResponse, { action: "list"; email: string }>(
          CLOCKIFY_SYNC_URL,
          {
            action: "list",
            email: currentEmail,
          },
        ),
      ]);

      setProjects(catalog.projects);
      setDraftRows(
        buildDraftRows(asanaData.tasks, catalog.projects, descriptionParts),
      );
    } catch (exc) {
      setError(getErrorMessage(exc));
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePushToClockify() {
    const rowsToSubmit = reviewedRows.filter(
      (row) => row.include && row.status === "ready",
    );

    if (rowsToSubmit.length === 0) {
      setError(
        "Resolve the review table first. At least one included row must be ready.",
      );
      return;
    }

    if (!summary.canSubmit) {
      setError(
        "Fix or skip every row that still needs review before pushing to Clockify.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to push ${rowsToSubmit.length} reviewed row${rowsToSubmit.length === 1 ? "" : "s"} to Clockify?`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const data = await postJson<
        ClockifySyncResponse,
        {
          action: "push";
          email: string;
          entries: Array<{
            title: string;
            description: string;
            start: string;
            end: string;
            projectId: string;
            taskId?: string;
            billable: boolean;
          }>;
        }
      >(CLOCKIFY_SYNC_URL, {
        action: "push",
        email: currentEmail,
        entries: rowsToSubmit.map((row) => ({
          title: row.sourceTitle,
          description: row.description,
          start: getClockifyStart(row),
          end: getClockifyEnd(row),
          projectId: row.projectId,
          ...(row.taskId ? { taskId: row.taskId } : {}),
          billable: true,
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
        title: "Push complete",
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

  function handleSetAllIncluded(include: boolean) {
    setDraftRows((current) =>
      current.map((row) => ({
        ...row,
        include,
      })),
    );
  }

  function updateDraftRow(
    rowId: string,
    updater: (row: AsanaDraftRow) => AsanaDraftRow,
  ) {
    setDraftRows((current) =>
      current.map((row) => (row.id === rowId ? updater(row) : row)),
    );
  }

  function handleDescriptionPartsChange(part: keyof DescriptionParts) {
    const nextParts = {
      ...descriptionParts,
      [part]: !descriptionParts[part],
    };

    setDescriptionParts(nextParts);
    setDraftRows((current) =>
      current.map((row) => ({
        ...row,
        description: buildDescriptionFromParts(
          row.sourceLink,
          row.sourceTitle,
          row.sourceSection,
          row.sourceBody,
          nextParts,
        ),
      })),
    );
  }

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="sticky top-16 z-20">
        <Card className="overflow-hidden rounded-none border border-border/80 bg-card/95 shadow-[0_10px_24px_rgba(20,14,28,0.22)] backdrop-blur-md">
          <CardContent className="p-0">
            <div className="flex flex-col xl:flex-row xl:items-stretch">
              <div className="min-w-0 px-4 py-3 xl:flex-1">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={asanaStatus.variant}
                      className="h-6 border border-primary/15 bg-primary/10 px-2.5 text-[10px] text-foreground"
                    >
                      {asanaStatus.label}
                    </Badge>
                    <Badge className="h-6 bg-primary/12 px-2.5 text-[10px] text-primary">
                      Asana review
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h1 className="font-studio text-[2rem] font-semibold leading-none tracking-[-0.04em] text-foreground">
                      Asana Completed Tickets
                    </h1>
                  </div>
                </div>
              </div>

              <div className="hidden w-px shrink-0 bg-border/80 xl:block" />

              <div className="grid gap-2 px-4 py-3 sm:grid-cols-2 xl:min-w-[360px] xl:grid-cols-2 xl:items-center">
                <StudioField label="Start">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="h-9 rounded-xl border-[hsl(var(--border))] bg-background/80 text-foreground shadow-none"
                  />
                </StudioField>
                <StudioField label="End">
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="h-9 rounded-xl border-[hsl(var(--border))] bg-background/80 text-foreground shadow-none"
                  />
                </StudioField>
              </div>

              <div className="hidden w-px shrink-0 bg-border/80 xl:block" />

              <div className="flex flex-wrap items-center gap-2 px-4 py-3 xl:min-w-[290px] xl:justify-center">
                <InlineStat label="Draft" value={String(summary.total)} />
                <span className="text-primary/35">•</span>
                <InlineStat label="Ready" value={String(summary.readyCount)} />
                <span className="text-primary/35">•</span>
                <InlineStat
                  label="Review"
                  value={String(summary.needsReviewCount + summary.errorCount)}
                />
              </div>

              <div className="hidden w-px shrink-0 bg-border/80 xl:block" />

              <div className="px-4 py-3 xl:flex xl:min-w-[190px] xl:items-center xl:justify-center">
                <Button
                  onClick={handleLoadTickets}
                  disabled={isLoading}
                  className="h-11 w-full rounded-full border-0 px-7 text-[15px] font-semibold shadow-[0_10px_24px_rgba(20,14,28,0.28)] xl:w-auto xl:min-w-[160px]"
                >
                  {isLoading ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {draftRows.length > 0 && !isLoading
                    ? "Refresh review"
                    : "Load tickets"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {error ? (
        <section className="rounded-lg border border-accent/40 bg-accent/10 p-4 text-accent">
          <div className="flex gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        </section>
      ) : null}

      <section>
        <Card className="overflow-hidden border-[hsl(var(--border))] bg-card/92 shadow-[0_22px_60px_rgba(20,14,28,0.24)]">
          <CardHeader className="app-hero-surface border-b border-border/80 px-4 py-3">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-stretch xl:justify-between">
              <div className="flex min-w-0 flex-col xl:flex-row xl:items-center xl:gap-3">
                <CardTitle className="font-studio shrink-0 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                  Sync Review Table
                </CardTitle>
              </div>

              <div className="flex self-stretch">
                <div className="flex items-center pr-3">
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={allRowsIncluded}
                      onChange={(event) =>
                        handleSetAllIncluded(event.target.checked)
                      }
                      className="h-4 w-4 border-border text-primary focus:ring-ring"
                      disabled={reviewedRows.length === 0}
                    />
                    <span className="font-medium">Select all</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-l border-border/80 pl-3">
                  <DescriptionPartOption
                    label="Link"
                    checked={descriptionParts.link}
                    onChange={() => handleDescriptionPartsChange("link")}
                  />
                  <DescriptionPartOption
                    label="Title"
                    checked={descriptionParts.title}
                    onChange={() => handleDescriptionPartsChange("title")}
                  />
                  <DescriptionPartOption
                    label="Section"
                    checked={descriptionParts.section}
                    onChange={() => handleDescriptionPartsChange("section")}
                  />
                  <DescriptionPartOption
                    label="Description"
                    checked={descriptionParts.body}
                    onChange={() => handleDescriptionPartsChange("body")}
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-hidden border border-border/80 bg-card/70">
              <table className="w-full table-fixed border-collapse bg-background text-sm">
                <colgroup>
                  <col className="w-[96px]" />
                  <col className="w-[208px]" />
                  <col className="w-[110px]" />
                  <col className="w-[90px]" />
                  <col className="w-[154px]" />
                  <col className="w-[161px]" />
                  <col className="w-[120px]" />
                  <col className="w-[168px]" />
                  <col className="w-[240px]" />
                </colgroup>
                <thead className="app-table-head text-left">
                  <tr className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    <th className="px-3 py-3 font-semibold">Sync</th>
                    <th className="border-l border-border/70 px-3 py-3 font-semibold">
                      Source Event
                    </th>
                    <th className="border-l border-border/70 px-3 py-3 font-semibold">
                      Ticket Link
                    </th>
                    <th className="border-l border-border/70 px-3 py-3 font-semibold">
                      Section
                    </th>
                    <th className="border-l border-border/70 px-3 py-3 font-semibold">
                      Project
                    </th>
                    <th className="border-l border-border/70 px-3 py-3 font-semibold">
                      Task
                    </th>
                    <th className="border-l border-border/70 px-3 py-3 font-semibold">
                      Hours
                    </th>
                    <th className="border-l border-border/70 px-3 py-3 font-semibold">
                      Description
                    </th>
                    <th className="border-l border-border/70 px-3 py-3 font-semibold">
                      State
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reviewedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-12 text-center text-sm text-muted-foreground"
                      >
                        Load Asana tickets to build the review table.
                      </td>
                    </tr>
                  ) : (
                    reviewedRows.map((row) => (
                      <ReviewTableRow
                        key={row.id}
                        row={row}
                        projects={projects}
                        availableTasks={
                          row.projectId
                            ? (projectById.get(row.projectId)?.tasks ?? [])
                            : []
                        }
                        onToggleInclude={() =>
                          updateDraftRow(row.id, (current) => ({
                            ...current,
                            include: !current.include,
                          }))
                        }
                        onProjectChange={(projectId) =>
                          updateDraftRow(row.id, (current) => ({
                            ...current,
                            projectId,
                            taskId: "",
                          }))
                        }
                        onTaskChange={(taskId) =>
                          updateDraftRow(row.id, (current) => ({
                            ...current,
                            taskId,
                          }))
                        }
                        onHoursChange={(hoursValue) =>
                          updateDraftRow(row.id, (current) => ({
                            ...current,
                            hours: parseHours(hoursValue),
                          }))
                        }
                        onDescriptionChange={(description) =>
                          updateDraftRow(row.id, (current) => ({
                            ...current,
                            description,
                          }))
                        }
                        onEditDescription={() =>
                          setActiveDescriptionRowId(row.id)
                        }
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {reviewedRows.length > 0 ? (
        <section>
          <Card className="border-[hsl(var(--border))] bg-card/92 shadow-[0_18px_48px_rgba(20,14,28,0.2)]">
            <CardContent className="flex justify-end px-4 py-4">
              <Button
                onClick={handlePushToClockify}
                disabled={!summary.canSubmit || isSubmitting}
                className="h-11 rounded-2xl bg-primary px-5 text-primary-foreground shadow-[0_14px_28px_rgba(36,24,48,0.28)] hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRightLeft className="h-4 w-4" />
                )}
                Push to Clockify
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeDescriptionRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(18,12,24,0.68)] px-4 py-6"
          onClick={() => setActiveDescriptionRowId(null)}
        >
          <div
            className="w-full max-w-2xl rounded-[28px] border border-border bg-card p-5 shadow-[0_28px_80px_rgba(18,12,24,0.42)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-studio text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  {activeDescriptionRow.sourceTitle}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatDateTime(activeDescriptionRow.createdAt)} -{" "}
                  {formatDateTime(activeDescriptionRow.doneAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="rounded-full px-4"
                onClick={() => setActiveDescriptionRowId(null)}
              >
                Close
              </Button>
            </div>

            <div className="mt-5">
              <textarea
                autoFocus
                wrap="soft"
                spellCheck={false}
                value={activeDescriptionRow.description}
                onChange={(event) =>
                  updateDraftRow(activeDescriptionRow.id, (current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={10}
                placeholder="Add description"
                className="min-h-[240px] w-full resize-none overflow-x-hidden rounded-[22px] border border-border/80 bg-background/70 px-4 py-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground [overflow-wrap:anywhere] [word-break:break-word] focus:border-primary/40"
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                type="button"
                className="ml-auto rounded-full px-5"
                onClick={() => setActiveDescriptionRowId(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}

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

function ReviewTableRow({
  row,
  projects,
  availableTasks,
  onToggleInclude,
  onProjectChange,
  onTaskChange,
  onHoursChange,
  onDescriptionChange,
  onEditDescription,
}: {
  row: ReviewedAsanaRow;
  projects: ClockifyProject[];
  availableTasks: ClockifyProject["tasks"];
  onToggleInclude: () => void;
  onProjectChange: (projectId: string) => void;
  onTaskChange: (taskId: string) => void;
  onHoursChange: (hours: string) => void;
  onDescriptionChange: (description: string) => void;
  onEditDescription: () => void;
}) {
  const hasDescription = row.description.trim().length > 0;
  const issueSummary = row.issues.map((issue) => issue.message).join(" ");

  return (
    <tr className="border-t border-border/70 align-top">
      <td className="px-3 py-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={row.include}
            onChange={onToggleInclude}
            className="h-4 w-4 border-border text-primary focus:ring-ring"
          />
          <span>Include</span>
        </label>
      </td>
      <td className="border-l border-border/70 px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary">
            <Clock3 className="h-3.5 w-3.5" />
            Ticket
          </div>
          <p
            className="mt-1 truncate font-semibold leading-5 text-foreground"
            title={row.sourceTitle}
          >
            {row.sourceTitle}
          </p>
          <p className="truncate text-xs leading-5 text-muted-foreground">
            {formatDateTime(row.createdAt)} - {formatDateTime(row.doneAt)}
          </p>
        </div>
      </td>
      <td className="border-l border-border/70 px-3 py-2">
        <div className="min-w-0">
          {row.sourceLink ? (
            <a
              href={row.sourceLink}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
              title={row.sourceLink}
            >
              Open ticket
            </a>
          ) : (
            <p className="truncate text-sm text-muted-foreground">No link</p>
          )}
        </div>
      </td>
      <td className="border-l border-border/70 px-3 py-2">
        <div className="min-w-0">
          <p
            className="truncate text-sm text-foreground"
            title={row.sourceSection || "No section"}
          >
            {row.sourceSection || "No section"}
          </p>
        </div>
      </td>
      <td className="border-l border-border/70 px-3 py-2">
        <Select
          value={row.projectId}
          onChange={(event) => onProjectChange(event.target.value)}
          disabled={!row.include}
          className="h-9 w-full rounded-none border-border bg-background/80 shadow-none"
        >
          <option value="">Select project</option>
          {projects.map((project) => (
            <option key={project.projectId} value={project.projectId}>
              {project.projectName}
            </option>
          ))}
        </Select>
      </td>
      <td className="border-l border-border/70 px-3 py-2">
        <Select
          value={row.taskId}
          onChange={(event) => onTaskChange(event.target.value)}
          disabled={!row.include || !row.projectId}
          className="h-9 w-full rounded-none border-border bg-background/80 shadow-none"
        >
          <option value="">
            {row.projectId ? "Manual / None" : "Pick project first"}
          </option>
          {availableTasks.map((task) => (
            <option key={task.taskId} value={task.taskId}>
              {task.taskName}
            </option>
          ))}
        </Select>
      </td>
      <td className="border-l border-border/70 px-3 py-2">
        <Input
          type="number"
          min="0.25"
          step="0.25"
          value={row.hours > 0 ? String(row.hours) : ""}
          onChange={(event) => onHoursChange(event.target.value)}
          disabled={!row.include}
          className="h-9 w-24 rounded-none border-border bg-background/80 shadow-none"
        />
      </td>
      <td className="border-l border-border/70 px-3 py-2">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onEditDescription}
            disabled={!row.include}
            className="flex h-9 w-full items-center justify-between gap-3 rounded-none border border-border bg-background/80 px-3 py-0 text-left shadow-none transition-colors hover:border-primary/28 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm text-foreground",
                !hasDescription && "text-[hsl(var(--muted-foreground))]",
              )}
            >
              {hasDescription
                ? getDescriptionPreview(row.description)
                : "Add description"}
            </span>
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Edit
            </span>
          </button>
        </div>
      </td>
      <td className="border-l border-border/70 px-3 py-2">
        <div className="min-w-0 space-y-1">
          <StatusBadge status={row.status} />
          {issueSummary ? (
            <p
              title={issueSummary}
              className={cn(
                "truncate text-xs leading-5",
                row.issues.some((issue) => issue.tone === "error")
                  ? "text-accent"
                  : "text-muted-foreground",
              )}
            >
              {issueSummary}
            </p>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function buildDraftRows(
  tasks: AsanaTaskRow[],
  projects: ClockifyProject[],
  descriptionParts: DescriptionParts,
) {
  const projectsByName = new Map(
    projects.map((project) => [normalizeName(project.projectName), project]),
  );

  return tasks.map((task, index) => {
    const sourceTitle = buildSourceTitle(task, index);
    const sourceBody = task.description ?? "";
    const suggestedProject =
      task.projects
        .map((projectName) => projectsByName.get(normalizeName(projectName)))
        .find(Boolean) ?? null;

    return {
      id: `asana-${index}-${task.ticket_date_creation ?? "na"}-${task.ticket_date_done ?? "na"}`,
      sourceLink: task.ticket_link ?? "",
      sourceTitle,
      sourceSection: (task.section ?? []).join(", "),
      sourceBody,
      createdAt: task.ticket_date_creation,
      doneAt: task.ticket_date_done,
      include: true,
      projectId: suggestedProject?.projectId ?? "",
      taskId: "",
      hours: 0.5,
      description: buildDescriptionFromParts(
        task.ticket_link ?? "",
        sourceTitle,
        (task.section ?? []).join(", "),
        sourceBody,
        descriptionParts,
      ),
    };
  });
}

function buildSourceTitle(task: AsanaTaskRow, index: number) {
  const explicitTitle = task.title?.trim();
  if (explicitTitle) {
    return explicitTitle;
  }

  const firstProject = task.projects[0]?.trim();
  if (firstProject) {
    return firstProject;
  }

  const firstSection = task.section?.[0]?.trim();
  if (firstSection) {
    return firstSection;
  }

  const normalizedDescription = task.description.replace(/\s+/g, " ").trim();
  if (normalizedDescription) {
    return normalizedDescription.length > 60
      ? `${normalizedDescription.slice(0, 60).trimEnd()}...`
      : normalizedDescription;
  }

  return `Asana task ${index + 1}`;
}

function validateRow(
  row: AsanaDraftRow,
  projectById: Map<string, ClockifyProject>,
): ReviewedAsanaRow {
  const issues: ReviewedAsanaRow["issues"] = [];

  if (!row.include) {
    return {
      ...row,
      projectName: projectById.get(row.projectId)?.projectName,
      taskName: projectById
        .get(row.projectId)
        ?.tasks.find((task) => task.taskId === row.taskId)?.taskName,
      status: "skipped",
      issues,
    };
  }

  const project = row.projectId ? projectById.get(row.projectId) : undefined;
  const task = project?.tasks.find((item) => item.taskId === row.taskId);

  if (!row.projectId) {
    issues.push({ tone: "warning", message: "Select a Clockify project." });
  } else if (!project) {
    issues.push({
      tone: "error",
      message: "Selected project is no longer available.",
    });
  }

  if (row.taskId && !task) {
    issues.push({
      tone: "error",
      message: "Selected task does not belong to the chosen project.",
    });
  }

  if (!Number.isFinite(row.hours) || row.hours <= 0) {
    issues.push({ tone: "error", message: "Hours must be greater than zero." });
  }

  const start = getClockifyStart(row);
  const end = getClockifyEnd(row);

  if (!start || !end) {
    issues.push({
      tone: "error",
      message: "Ticket completion date is missing or invalid.",
    });
  } else if (new Date(end).getTime() <= new Date(start).getTime()) {
    issues.push({
      tone: "error",
      message: "Derived Clockify time range is invalid.",
    });
  }

  if (!row.description.trim()) {
    issues.push({
      tone: "warning",
      message: "Description is empty.",
    });
  }

  const status: ReviewStatus = issues.some((issue) => issue.tone === "error")
    ? "error"
    : issues.length > 0
      ? "needs_review"
      : "ready";

  return {
    ...row,
    projectName: project?.projectName,
    taskName: task?.taskName,
    status,
    issues,
  };
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const variants: Record<
    ReviewStatus,
    "default" | "secondary" | "accent" | "muted"
  > = {
    ready: "default",
    needs_review: "secondary",
    error: "accent",
    skipped: "muted",
  };

  const labels: Record<ReviewStatus, string> = {
    ready: "Ready",
    needs_review: "Needs review",
    error: "Error",
    skipped: "Skipped",
  };

  return (
    <Badge
      variant={variants[status]}
      className="h-5 rounded-none px-2 text-[10px] uppercase tracking-[0.16em]"
    >
      {labels[status]}
    </Badge>
  );
}

function DescriptionPartOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 border-border text-primary focus:ring-ring"
      />
      <span>{label}</span>
    </label>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <span className="text-lg font-semibold tracking-[-0.03em] text-foreground">
        {value}
      </span>
    </div>
  );
}

function StudioField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
        {label}
      </Label>
      {children}
    </div>
  );
}

function buildDescriptionFromParts(
  link: string,
  title: string,
  section: string,
  notes: string,
  parts: DescriptionParts,
) {
  const cleanLink = link.trim();
  const cleanTitle = title.trim();
  const cleanSection = section.trim();
  const cleanNotes = notes.trim();
  const values = [
    parts.link ? cleanLink : "",
    parts.title ? cleanTitle : "",
    parts.section ? cleanSection : "",
    parts.body ? cleanNotes : "",
  ].filter(Boolean);

  return values.join("\n\n");
}

function getDescriptionPreview(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  return normalized.length > 56
    ? `${normalized.slice(0, 56).trimEnd()}...`
    : normalized;
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function parseHours(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed * 100) / 100
    : 0;
}

function getClockifyEnd(row: AsanaDraftRow) {
  return toValidIso(row.doneAt ?? row.createdAt ?? "");
}

function getClockifyStart(row: AsanaDraftRow) {
  const end = getClockifyEnd(row);
  const endTime = new Date(end).getTime();

  if (!end || !Number.isFinite(endTime) || !Number.isFinite(row.hours) || row.hours <= 0) {
    return "";
  }

  return new Date(endTime - row.hours * 60 * 60 * 1000).toISOString();
}

function toValidIso(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthStart() {
  const date = new Date();
  date.setUTCDate(1);
  return date.toISOString().slice(0, 10);
}

function getErrorMessage(exc: unknown) {
  if (exc instanceof ApiError) {
    if (exc.details && typeof exc.details === "object") {
      const details = exc.details as Record<string, unknown>;
      if (typeof details.message === "string" && details.message.trim()) {
        return details.message;
      }
    }

    return `${exc.message} (HTTP ${exc.status})`;
  }

  if (exc instanceof Error) {
    return exc.message;
  }

  return "Unexpected Asana error.";
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
