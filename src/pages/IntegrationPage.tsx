import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Lottie from "lottie-react";
import {
  ArrowRightLeft,
  CheckCircle2,
  Clock3,
  Plus,
  X,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { SearchSelect } from "../components/ui/search-select";
import {
  ApiError,
  CLOCKIFY_SYNC_URL,
  ClockifyListResponse,
  ClockifyTask,
  ClockifyProject,
  ClockifySyncResponse,
  INTEGRATION_SETUP_URL,
  MappingListResponse,
  OutlookMappingRule,
  OUTLOOK_EVENTS_URL,
  OutlookEvent,
  OutlookEventsResponse,
  postJson,
} from "../lib/api";
import clockTimeAnimation from "../assets/clock time.json";
import { cn } from "../lib/utils";

type SyncActivity = {
  id: string;
  title: string;
  detail: string;
  time: string;
  status: "success" | "warning" | "pending";
};

type AppToast = {
  title: string;
  detail?: string;
  tone: "success" | "warning";
};

type DescriptionMode = "body" | "title" | "body_title";

type ClockifyPushEntry = {
  title: string;
  description: string;
  start: string;
  end: string;
  projectId: string;
  taskId?: string;
  billable: boolean;
  outlookEventId?: string;
};

type SyncDraftRow = {
  id: string;
  source: "outlook" | "manual";
  outlookEventId?: string;
  sourceTitle: string;
  sourceNotes: string;
  start: string;
  end: string;
  hours: number;
  description: string;
  include: boolean;
  projectId: string;
  taskId: string;
  suggestedProjectId?: string;
  suggestedTaskId?: string;
};

type ReviewStatus = "ready" | "needs_review" | "error" | "skipped";

type ReviewedSyncRow = SyncDraftRow & {
  projectName?: string;
  taskName?: string;
  status: ReviewStatus;
  issues: Array<{
    tone: "warning" | "error";
    message: string;
  }>;
};

type MergeReviewEntry = {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskName: string;
  start: string;
  end: string;
  hours: number;
  description: string;
  sourceRows: ReviewedSyncRow[];
  spansMultipleDays: boolean;
};

type MergeReviewState = {
  directRows: ReviewedSyncRow[];
  mergedEntries: MergeReviewEntry[];
};

export function IntegrationPage({ currentEmail }: { currentEmail: string }) {
  const [startDate, setStartDate] = useState(getUtcMinus7Today());
  const [endDate, setEndDate] = useState(getUtcMinus7Today());
  const [events, setEvents] = useState<OutlookEvent[]>([]);
  const [projects, setProjects] = useState<ClockifyProject[]>([]);
  const [draftRows, setDraftRows] = useState<SyncDraftRow[]>([]);
  const [activity, setActivity] = useState<SyncActivity[]>([]);
  const [syncResult, setSyncResult] = useState<ClockifySyncResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPreparingReview, setIsPreparingReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDescriptionRowId, setActiveDescriptionRowId] = useState<
    string | null
  >(null);
  const [toast, setToast] = useState<AppToast | null>(null);
  const [descriptionMode, setDescriptionMode] =
    useState<DescriptionMode>("body");
  const [mergeReviewState, setMergeReviewState] =
    useState<MergeReviewState | null>(null);

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.projectId, project])),
    [projects],
  );

  const reviewedRows = useMemo(
    () => draftRows.map((row) => validateDraftRow(row, projectById)),
    [draftRows, projectById],
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
    const skippedCount = reviewedRows.filter(
      (row) => row.status === "skipped",
    ).length;
    const includedCount = reviewedRows.filter((row) => row.include).length;

    return {
      readyCount,
      needsReviewCount,
      errorCount,
      skippedCount,
      includedCount,
      canSubmit:
        readyCount > 0 &&
        needsReviewCount === 0 &&
        errorCount === 0 &&
        includedCount > 0,
    };
  }, [reviewedRows]);

  const activeDescriptionRow = useMemo(
    () => reviewedRows.find((row) => row.id === activeDescriptionRowId) ?? null,
    [activeDescriptionRowId, reviewedRows],
  );
  const mergeReviewSummary = useMemo(() => {
    if (!mergeReviewState) {
      return null;
    }

    const mergedRowCount = mergeReviewState.mergedEntries.reduce(
      (sum, entry) => sum + entry.sourceRows.length,
      0,
    );
    const mergedHours = roundHours(
      mergeReviewState.mergedEntries.reduce((sum, entry) => sum + entry.hours, 0),
    );

    return {
      groupCount: mergeReviewState.mergedEntries.length,
      mergedRowCount,
      mergedHours,
      directRowCount: mergeReviewState.directRows.length,
    };
  }, [mergeReviewState]);

  const isBusy = isPreparingReview || isSubmitting;
  const allRowsIncluded =
    reviewedRows.length > 0 && reviewedRows.every((row) => row.include);

  const syncStatus = useMemo(() => {
    if (isPreparingReview) {
      return { label: "Building review", variant: "secondary" as const };
    }

    if (isSubmitting) {
      return { label: "Pushing to Clockify", variant: "secondary" as const };
    }

    if (summary.errorCount > 0 || summary.needsReviewCount > 0 || error) {
      return { label: "Needs review", variant: "accent" as const };
    }

    if (summary.readyCount > 0) {
      return { label: "Ready to push", variant: "default" as const };
    }

    return { label: "Ready", variant: "default" as const };
  }, [error, isPreparingReview, isSubmitting, summary]);

  async function handlePrepareReview() {
    setError(null);
    setSyncResult(null);
    setIsPreparingReview(true);

    try {
      const range = buildDateRange(startDate, endDate);

      const [outlookData, catalog, mappings] = await Promise.all([
        postJson<OutlookEventsResponse, typeof range & { email: string }>(
          OUTLOOK_EVENTS_URL,
          {
            ...range,
            email: currentEmail,
          },
        ),
        postJson<ClockifyListResponse, { action: "list"; email: string }>(
          CLOCKIFY_SYNC_URL,
          {
            action: "list",
            email: currentEmail,
          },
        ),
        postJson<MappingListResponse, { action: "listMappings"; email: string }>(
          INTEGRATION_SETUP_URL,
          {
            action: "listMappings",
            email: currentEmail,
          },
        ),
      ]);

      const nextRows = buildDraftRows(
        outlookData.events,
        catalog.projects,
        mappings.rules,
        descriptionMode,
      );

      setEvents(outlookData.events);
      setProjects(catalog.projects);
      setDraftRows(nextRows);
      setToast({
        title: "Sync successful",
        detail: `${outlookData.count} event${outlookData.count === 1 ? "" : "s"} loaded for review.`,
        tone: nextRows.length > 0 ? "success" : "warning",
      });

      addActivity({
        title: "Review table refreshed",
        detail: `${outlookData.count} Outlook event${outlookData.count === 1 ? "" : "s"} staged against ${catalog.projectCount} Clockify project${catalog.projectCount === 1 ? "" : "s"}.`,
        status: nextRows.some((row) => row.projectId && row.taskId)
          ? "success"
          : "pending",
      });
    } catch (exc) {
      setError(getErrorMessage(exc));
      setToast({
        title: "Sync failed",
        detail: getErrorMessage(exc),
        tone: "warning",
      });
      addActivity({
        title: "Review build failed",
        detail: getErrorMessage(exc),
        status: "warning",
      });
    } finally {
      setIsPreparingReview(false);
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

    const mergeReview = buildMergeReviewState(rowsToSubmit, projectById);

    if (mergeReview) {
      setError(null);
      setMergeReviewState(mergeReview);
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to push ${rowsToSubmit.length} reviewed row${rowsToSubmit.length === 1 ? "" : "s"} to Clockify?`,
    );

    if (!confirmed) {
      return;
    }

    await submitClockifyEntries(rowsToSubmit.map(mapReviewedRowToPushEntry));
  }

  async function submitClockifyEntries(entries: ClockifyPushEntry[]) {
    setError(null);
    setIsSubmitting(true);

    try {
      const data = await postJson<
        ClockifySyncResponse,
        {
          action: "push";
          email: string;
          entries: ClockifyPushEntry[];
        }
      >(CLOCKIFY_SYNC_URL, {
        action: "push",
        email: currentEmail,
        entries,
      });

      handleClockifyResult(data);
      return true;
    } catch (exc) {
      if (exc instanceof ApiError && isClockifySyncResponse(exc.details)) {
        handleClockifyResult(exc.details);
        return true;
      } else {
        setError(getErrorMessage(exc));
        setToast({
          title: "Push failed",
          detail: getErrorMessage(exc),
          tone: "warning",
        });
        addActivity({
          title: "Clockify push failed",
          detail: getErrorMessage(exc),
          status: "warning",
        });
      }

      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleMergeReviewHoursChange(entryId: string, hoursValue: string) {
    setMergeReviewState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        mergedEntries: current.mergedEntries.map((entry) => {
          if (entry.id !== entryId) {
            return entry;
          }

          const nextHours = Number.parseFloat(hoursValue);

          if (!Number.isFinite(nextHours) || nextHours <= 0) {
            return {
              ...entry,
              hours: 0,
              end: "",
            };
          }

          const roundedHours = roundHours(nextHours);

          return {
            ...entry,
            hours: roundedHours,
            end: getEndFromStartAndHours(entry.start, roundedHours),
          };
        }),
      };
    });
  }

  function handleMergeReviewDescriptionChange(
    entryId: string,
    description: string,
  ) {
    setMergeReviewState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        mergedEntries: current.mergedEntries.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                description,
              }
            : entry,
        ),
      };
    });
  }

  async function handleMergeReviewSubmit() {
    if (!mergeReviewState) {
      return;
    }

    const invalidEntry = mergeReviewState.mergedEntries.find(
      (entry) => getMergeReviewIssues(entry).length > 0,
    );

    if (invalidEntry) {
      setError("Finish each merged entry before submitting to Clockify.");
      return;
    }

    const submitted = await submitClockifyEntries([
      ...mergeReviewState.directRows.map(mapReviewedRowToPushEntry),
      ...mergeReviewState.mergedEntries.map(mapMergeReviewEntryToPushEntry),
    ]);

    if (submitted) {
      setMergeReviewState(null);
    }
  }

  function handleClockifyResult(data: ClockifySyncResponse) {
    setSyncResult(data);

    if (data.createdCount > 0) {
      setToast({
        title: "Push complete",
        detail: `${data.createdCount} created, ${data.skippedCount} skipped.`,
        tone: data.skippedCount > 0 ? "warning" : "success",
      });
      addActivity({
        title: "Clockify push complete",
        detail: `${data.createdCount} created, ${data.skippedCount} skipped.`,
        status: data.skippedCount > 0 ? "warning" : "success",
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
    addActivity({
      title: "Clockify push skipped",
      detail: firstError,
      status: "warning",
    });
  }

  function updateDraftRow(
    rowId: string,
    updater: (row: SyncDraftRow) => SyncDraftRow,
  ) {
    setDraftRows((current) =>
      current.map((row) => (row.id === rowId ? updater(row) : row)),
    );
  }

  function handleToggleInclude(rowId: string) {
    updateDraftRow(rowId, (row) => ({
      ...row,
      include: !row.include,
    }));
  }

  function handleSetAllIncluded(include: boolean) {
    setDraftRows((current) =>
      current.map((row) => ({
        ...row,
        include,
      })),
    );
  }

    function handleAddManualRow() {
      if (projects.length === 0) {
        setError(
          "Load the review table first so Clockify projects are available for manual rows.",
        );
        return;
      }

      setError(null);
      setSyncResult(null);
      setDraftRows((current) => [...current, createManualDraftRow(startDate)]);
    }

  function handleRemoveRow(rowId: string) {
    setDraftRows((current) => current.filter((row) => row.id !== rowId));

    if (activeDescriptionRowId === rowId) {
      setActiveDescriptionRowId(null);
    }
  }

  function handleSourceTitleChange(rowId: string, sourceTitle: string) {
    updateDraftRow(rowId, (row) => ({
      ...row,
      sourceTitle,
    }));
  }

  function handleStartChange(rowId: string, localValue: string) {
    updateDraftRow(rowId, (row) => {
      const nextStart = fromUtcMinus7DateTimeLocalValue(localValue);

      if (!nextStart) {
        return {
          ...row,
          start: "",
          end: "",
        };
      }

      return {
        ...row,
        start: nextStart,
        end: getEndFromStartAndHours(nextStart, row.hours),
      };
    });
  }

  function handleProjectChange(rowId: string, projectId: string) {
    updateDraftRow(rowId, (row) => {
      const selectedProject = projectById.get(projectId);
      const keepsCurrentTask = selectedProject?.tasks.some(
        (task) => task.taskId === row.taskId,
      );

      return {
        ...row,
        projectId,
        taskId: keepsCurrentTask ? row.taskId : "",
      };
    });
  }

  function handleTaskChange(rowId: string, taskId: string) {
    updateDraftRow(rowId, (row) => ({
      ...row,
      taskId,
    }));
  }

  function handleDescriptionChange(rowId: string, description: string) {
    updateDraftRow(rowId, (row) => ({
      ...row,
      description,
    }));
  }

  function handleHoursChange(rowId: string, hoursValue: string) {
    updateDraftRow(rowId, (row) => {
      const nextHours = Number.parseFloat(hoursValue);

      if (!Number.isFinite(nextHours) || nextHours <= 0) {
        return {
          ...row,
          hours: 0,
        };
      }

      return {
        ...row,
        hours: roundHours(nextHours),
        end: getEndFromStartAndHours(row.start, nextHours),
      };
    });
  }

  function handleDescriptionModeChange(mode: DescriptionMode) {
    setDescriptionMode(mode);
    setDraftRows((current) =>
      current.map((row) =>
        row.source === "outlook"
          ? {
              ...row,
              description: buildDescriptionFromMode(
                row.sourceTitle,
                row.sourceNotes,
                mode,
              ),
            }
          : row,
      ),
    );
  }

  function addActivity(item: Omit<SyncActivity, "id" | "time">) {
    setActivity((current) => [
      {
        id: createActivityId(),
        ...item,
        time: "Just now",
      },
      ...current.slice(0, 5),
    ]);
  }

  return (
    <div className="app-page-shell">
      <section>
        <Card className="overflow-hidden rounded-none border border-border/80 bg-card/95 shadow-[0_10px_24px_rgba(20,14,28,0.22)] backdrop-blur-md">
          <CardContent className="p-0">
            <div className="flex flex-col xl:flex-row xl:items-stretch">
              <div className="min-w-0 px-4 py-3 xl:flex-1">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className="h-6 border border-primary/15 bg-primary/10 px-2.5 text-[10px] text-foreground"
                    >
                      {syncStatus.label}
                    </Badge>
                    <Badge className="h-6 bg-primary/12 px-2.5 text-[10px] text-primary">
                      Premium sync
                    </Badge>
                    <Badge className="h-6 bg-secondary/55 px-2.5 text-[10px] text-foreground">
                      UTC-7 window
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h1 className="font-studio text-[2rem] font-semibold leading-none tracking-[-0.04em] text-foreground">
                      Outlook to Clockify
                    </h1>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Review Outlook events, resolve matches, and push a clean batch to Clockify.
                  </p>
                </div>
              </div>

              <div className="hidden w-px shrink-0 bg-border/80 xl:block" />

              <div className="grid gap-2 px-4 py-3 sm:grid-cols-2 xl:min-w-[360px] xl:grid-cols-2 xl:items-center">
                <StudioField label="Start">
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="h-9 rounded-xl border-[hsl(var(--border))] bg-background/80 text-foreground shadow-none"
                  />
                </StudioField>
                <StudioField label="End">
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="h-9 rounded-xl border-[hsl(var(--border))] bg-background/80 text-foreground shadow-none"
                  />
                </StudioField>
              </div>

              <div className="hidden w-px shrink-0 bg-border/80 xl:block" />

              <div className="grid gap-2 px-4 py-3 sm:grid-cols-2 xl:min-w-[320px] xl:grid-cols-2 xl:items-center">
                <InlineStat label="Draft" value={String(reviewedRows.length)} />
                <span className="text-primary/35">•</span>
                <InlineStat label="Ready" value={String(summary.readyCount)} />
                <span className="text-primary/35">•</span>
                <InlineStat
                  label="Review"
                  value={String(summary.needsReviewCount + summary.errorCount)}
                />
                <InlineStat label="Included" value={String(summary.includedCount)} />
              </div>

              <div className="hidden w-px shrink-0 bg-border/80 xl:block" />

              <div className="px-4 py-3 xl:flex xl:min-w-[190px] xl:items-center xl:justify-center">
                <Button
                  onClick={handlePrepareReview}
                  disabled={isPreparingReview || isSubmitting}
                  className="h-11 w-full rounded-full border-0 px-7 text-[15px] font-semibold shadow-[0_10px_24px_rgba(20,14,28,0.28)] xl:w-auto xl:min-w-[160px]"
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4",
                      isPreparingReview && "animate-spin",
                    )}
                  />
                  {draftRows.length > 0 ? "Refresh review" : "Sync Calendar"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isBusy ? (
          <div className="border-x border-b border-border/80 bg-card/92 px-3 py-2 shadow-[0_8px_18px_rgba(20,14,28,0.18)]">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/12">
                <Lottie
                  animationData={clockTimeAnimation}
                  loop
                  className="h-9 w-9"
                />
              </div>
              <p className="font-semibold text-foreground">
                {isPreparingReview
                  ? "Building review table"
                  : "Pushing to Clockify"}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      {error ? <PageAlert text={error} /> : null}

      <section>
        <Card className="overflow-hidden border-[hsl(var(--border))] bg-card/92 shadow-[0_22px_60px_rgba(20,14,28,0.24)]">
            <CardHeader className="app-hero-surface border-b border-border/80 px-4 py-3">
              <div className="flex flex-col gap-2 xl:flex-row xl:items-stretch xl:justify-between">
                <div className="flex min-w-0 flex-col xl:flex-row xl:items-center xl:gap-3">
                  <div>
                    <CardTitle className="font-studio shrink-0 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                      Review Table
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Check each staged row before pushing it to Clockify.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex flex-wrap items-start gap-3 xl:justify-end">
                  <div className="border border-border/80 bg-background/90 px-4 py-3 shadow-[0_6px_18px_rgba(18,12,24,0.08)]">
                    <div className="flex self-stretch">
                      <div className="flex items-center pr-4">
                        <label className="inline-flex items-center gap-3 text-[15px] text-foreground">
                          <input
                            type="checkbox"
                            checked={allRowsIncluded}
                            onChange={(event) =>
                              handleSetAllIncluded(event.target.checked)
                            }
                            disabled={reviewedRows.length === 0}
                            className="h-6 w-6 rounded-md border-border bg-background text-primary focus:ring-ring"
                          />
                          <span className="font-medium">Select all</span>
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-l border-border/80 pl-4">
                        <DescriptionModeOption
                          label="Body to description"
                          checked={descriptionMode === "body"}
                          onChange={() => handleDescriptionModeChange("body")}
                        />
                        <DescriptionModeOption
                          label="Title to description"
                          checked={descriptionMode === "title"}
                          onChange={() => handleDescriptionModeChange("title")}
                        />
                        <DescriptionModeOption
                          label="Title + body to description"
                          checked={descriptionMode === "body_title"}
                          onChange={() =>
                            handleDescriptionModeChange("body_title")
                          }
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-4">
              {reviewedRows.length === 0 ? (
              <div className="app-hero-surface-strong rounded-[22px] border border-dashed border-border/80 px-5 py-5 text-sm text-muted-foreground">
                No review rows.
              </div>
              ) : (
                <>
                  <div className="overflow-hidden border border-border/80 bg-card/70">
                    <table className="w-full table-fixed border-collapse bg-background text-sm">
                    <colgroup>
                      <col className="w-[6.5%]" />
                      <col className="w-[13.3%]" />
                      <col className="w-[21.7%]" />
                      <col className="w-[14%]" />
                      <col className="w-[8%]" />
                      <col className="w-[17.5%]" />
                      <col className="w-[19%]" />
                    </colgroup>
                    <thead className="app-table-head text-left text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Sync</th>
                        <th className="px-3 py-2.5 font-semibold">
                          Source event
                        </th>
                        <th className="px-3 py-2.5 font-semibold">Project</th>
                        <th className="px-3 py-2.5 font-semibold">Task</th>
                        <th className="px-3 py-2.5 font-semibold">Hours</th>
                        <th className="px-3 py-2.5 font-semibold">
                          Description
                        </th>
                        <th className="px-3 py-2.5 font-semibold">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewedRows.map((row) => (
                        <SyncReviewRow
                          key={row.id}
                          row={row}
                          projects={projects}
                          onEditDescription={() =>
                            setActiveDescriptionRowId(row.id)
                          }
                          onRemove={() => handleRemoveRow(row.id)}
                          onToggleInclude={() => handleToggleInclude(row.id)}
                          onSourceTitleChange={(sourceTitle) =>
                            handleSourceTitleChange(row.id, sourceTitle)
                          }
                          onStartChange={(start) =>
                            handleStartChange(row.id, start)
                          }
                          onProjectChange={(projectId) =>
                            handleProjectChange(row.id, projectId)
                          }
                          onTaskChange={(taskId) =>
                            handleTaskChange(row.id, taskId)
                          }
                          onHoursChange={(hours) =>
                            handleHoursChange(row.id, hours)
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-full px-4"
                      onClick={handleAddManualRow}
                    >
                      <Plus className="h-4 w-4" />
                      Add row
                    </Button>

                    <Button
                      onClick={handlePushToClockify}
                      disabled={!summary.canSubmit || isSubmitting}
                      className="h-11 rounded-2xl bg-primary px-5 text-primary-foreground shadow-[0_14px_28px_rgba(36,24,48,0.28)] hover:bg-primary/90"
                    >
                      {isSubmitting ? (
                        <span className="-my-2 flex h-9 w-9 items-center justify-center">
                          <Lottie
                            animationData={clockTimeAnimation}
                            loop
                            className="h-9 w-9"
                          />
                        </span>
                      ) : (
                        <ArrowRightLeft className="h-4 w-4" />
                      )}
                      Push to Clockify
                    </Button>
                  </div>
                </>
              )}
          </CardContent>
        </Card>
      </section>

      {syncResult ? (
        <section>
          <Card className="border-border/80 bg-card/95 shadow-none">
            <CardHeader className="border-b border-border/80">
              <CardTitle>Clockify Result</CardTitle>
              <CardDescription>Latest push result from Clockify.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {syncResult.created.map((item) => (
                <ResultRow
                  key={item.timeEntryId ?? `${item.title}-${item.start}`}
                  title={item.title}
                  detail={`${item.projectName ?? "Project"} / ${item.taskName ?? "Task"}`}
                  status="success"
                />
              ))}
              {syncResult.skipped.map((item) => (
                <ResultRow
                  key={`${item.title}-${item.start}-${item.error}`}
                  title={item.title ?? "Skipped event"}
                  detail={item.error}
                  status="warning"
                />
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card className="border-border/80 bg-card/95 shadow-none">
          <CardHeader className="border-b border-border/80">
            <CardTitle>Activity</CardTitle>
            <CardDescription>Recent sync and push events for this page.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {activity.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/80 bg-muted/35 p-4 text-sm text-muted-foreground">
                  No activity yet.
                </div>
              ) : (
                activity.map((item) => (
                  <ActivityItem key={item.id} item={item} />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>

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
                  {formatDateTime(activeDescriptionRow.start)} -{" "}
                  {formatDateTime(activeDescriptionRow.end)}
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
                  handleDescriptionChange(
                    activeDescriptionRow.id,
                    event.target.value,
                  )
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

      {mergeReviewState ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(18,12,24)] px-4 py-6"
          onClick={() => {
            if (!isSubmitting) {
              setMergeReviewState(null);
            }
          }}
        >
          <div
            className="max-h-[calc(100vh-1rem)] w-full max-w-[1120px] overflow-y-auto rounded-none border border-border/80 bg-card shadow-[0_28px_80px_rgba(18,12,24,0.42)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-border/80 bg-card px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="h-6 rounded-none border border-primary bg-primary px-2.5 text-[9px] uppercase tracking-[0.16em] text-primary-foreground"
                    >
                      Merge review
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="h-6 rounded-none border border-border bg-secondary px-2.5 text-[10px] text-foreground"
                    >
                      Final check before Clockify push
                    </Badge>
                  </div>
                  <h3 className="mt-2 font-studio text-[1.65rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[1.9rem]">
                    Merge duplicate Clockify rows
                  </h3>
                  <p className="mt-1.5 max-w-3xl text-[13px] leading-5 text-muted-foreground">
                    Duplicate project and task combinations are grouped here so
                    we can send a single clean Clockify entry. Adjust the merged
                    hours or description wherever needed before submitting.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-none px-4"
                    disabled={isSubmitting}
                    onClick={() => setMergeReviewState(null)}
                  >
                    Back to review table
                  </Button>
                </div>
              </div>

              {mergeReviewSummary ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <MergeReviewStat
                    label="Duplicate groups"
                    value={String(mergeReviewSummary.groupCount)}
                    detail="Each group becomes one Clockify entry"
                  />
                  <MergeReviewStat
                    label="Rows being merged"
                    value={String(mergeReviewSummary.mergedRowCount)}
                    detail="Original Outlook rows in duplicate sets"
                  />
                  <MergeReviewStat
                    label="Merged hours"
                    value={String(mergeReviewSummary.mergedHours)}
                    detail="Editable total that will be submitted"
                  />
                  <MergeReviewStat
                    label="Unchanged rows"
                    value={String(mergeReviewSummary.directRowCount)}
                    detail="Ready rows that will push as-is"
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-3 px-4 py-4 sm:px-5">
              {mergeReviewState.mergedEntries.map((entry) => {
                const issues = getMergeReviewIssues(entry);

                return (
                  <div
                    key={entry.id}
                    className="overflow-hidden rounded-none border border-border/80 bg-background shadow-[0_12px_32px_rgba(18,12,24,0.10)]"
                  >
                    <div className="border-b border-border/70 bg-card px-3 py-3 sm:px-4">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="h-6 rounded-none border border-primary bg-primary px-2.5 text-[10px] text-primary-foreground"
                            >
                              {entry.projectName}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="h-6 rounded-none border border-border bg-secondary px-2.5 text-[10px] text-foreground"
                            >
                              {entry.taskName || "No task"}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="h-6 rounded-none border border-border bg-background px-2.5 text-[10px] text-muted-foreground"
                            >
                              {entry.sourceRows.length} source row
                              {entry.sourceRows.length === 1 ? "" : "s"}
                            </Badge>
                          </div>
                          <h4 className="mt-2 text-lg font-semibold text-foreground">
                            Final Clockify entry
                          </h4>
                          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                            {formatDateTime(entry.start)} -{" "}
                            {formatDateTime(entry.end)}
                          </p>
                          {entry.spansMultipleDays ? (
                            <p className="mt-1.5 text-[13px] leading-5 text-accent">
                              This merge spans multiple Outlook dates. Double-check
                              the total hours and final wording.
                            </p>
                          ) : (
                            <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
                              Review the combined description, then push one
                              consolidated entry to Clockify.
                            </p>
                          )}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[320px]">
                          <div className="rounded-none border border-border/70 bg-background px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                              Merged hours
                            </p>
                            <Input
                              type="number"
                              min="0.25"
                              step="0.25"
                              value={entry.hours > 0 ? String(entry.hours) : ""}
                              onChange={(event) =>
                                handleMergeReviewHoursChange(
                                  entry.id,
                                  event.target.value,
                                )
                              }
                              className="mt-1.5 h-9 rounded-none border-border bg-card text-sm shadow-none"
                            />
                          </div>
                          <div className="rounded-none border border-border/70 bg-background px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                              Result
                            </p>
                            <p className="mt-1.5 text-sm font-semibold text-foreground">
                              1 Clockify entry
                            </p>
                            <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
                              Replaces {entry.sourceRows.length} duplicate row
                              {entry.sourceRows.length === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] xl:p-4">
                      <div className="min-w-0 rounded-none border border-border/70 bg-card p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              Source rows
                            </p>
                            <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
                              Original Outlook details included in this merge.
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="h-6 rounded-none border border-border bg-secondary px-2.5 py-0 text-[10px] text-foreground"
                          >
                            {entry.sourceRows.length} rows
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                          {entry.sourceRows.map((row) => (
                            <div
                              key={row.id}
                              className="min-w-0 rounded-none border border-border/70 bg-background px-2.5 py-2.5"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <p
                                    className="truncate text-[13px] font-semibold text-foreground"
                                    title={row.sourceTitle}
                                  >
                                    {row.sourceTitle}
                                  </p>
                                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                                    {formatDateTime(row.start)} -{" "}
                                    {formatDateTime(row.end)}
                                  </p>
                                </div>
                                <Badge
                                  variant="secondary"
                                  className="h-6 w-fit rounded-none border border-border bg-card px-2.5 py-0 text-[10px] text-foreground"
                                >
                                  {formatHoursLabel(row.hours)}
                                </Badge>
                              </div>
                              {row.description.trim() ? (
                                <div className="mt-2 max-h-24 overflow-y-auto rounded-none border border-border/60 bg-card px-2.5 py-2">
                                  <p className="whitespace-pre-wrap text-[11px] leading-4 text-muted-foreground [overflow-wrap:anywhere] [word-break:break-word]">
                                    {row.description.trim()}
                                  </p>
                                </div>
                              ) : (
                                <p className="mt-2 text-[11px] text-muted-foreground">
                                  No description on this source row.
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="min-w-0 rounded-none border border-border/70 bg-card p-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              Final merged description
                            </Label>
                            <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
                              This is the exact description that Clockify will receive.
                            </p>
                          </div>
                          <Badge
                            variant={issues.length > 0 ? "accent" : "secondary"}
                            className="mt-2 h-6 w-fit rounded-none border px-2.5 py-0 text-[10px] sm:mt-0"
                          >
                            {issues.length > 0 ? "Needs attention" : "Ready to submit"}
                          </Badge>
                        </div>
                        <textarea
                          wrap="soft"
                          spellCheck={false}
                          value={entry.description}
                          onChange={(event) =>
                            handleMergeReviewDescriptionChange(
                              entry.id,
                              event.target.value,
                            )
                          }
                          rows={10}
                          className="mt-3 min-h-[240px] w-full resize-y rounded-none border border-border/80 bg-background px-3 py-3 text-[13px] leading-5 text-foreground outline-none transition-colors placeholder:text-muted-foreground [overflow-wrap:anywhere] [word-break:break-word] focus:border-primary/40"
                          placeholder="Combine the duplicate descriptions here"
                        />
                        {issues.length > 0 ? (
                          <div className="mt-2 rounded-none border border-accent bg-card px-3 py-2.5">
                            {issues.map((issue) => (
                              <p
                                key={`${entry.id}-${issue}`}
                                className="text-[12px] leading-4 text-accent"
                              >
                                {issue}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 rounded-none border border-border bg-background px-3 py-2.5">
                            <p className="text-[12px] leading-4 text-muted-foreground">
                              This merged entry will replace the duplicate rows
                              in the Clockify push.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-0 border-t border-border/80 bg-card px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    {mergeReviewState.directRows.length} other reviewed row
                    {mergeReviewState.directRows.length === 1 ? "" : "s"} will
                    be pushed unchanged.
                  </p>
                  <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
                    Submit the merged entries only when every group shows as ready.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-none px-4"
                    disabled={isSubmitting}
                    onClick={() => setMergeReviewState(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="h-9 rounded-none px-4"
                    disabled={
                      isSubmitting ||
                      mergeReviewState.mergedEntries.some(
                        (entry) => getMergeReviewIssues(entry).length > 0,
                      )
                    }
                    onClick={handleMergeReviewSubmit}
                  >
                    {isSubmitting ? "Submitting..." : "Push merged entries"}
                  </Button>
                </div>
              </div>
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
                <p className="font-semibold text-foreground">
                  {toast.title}
                </p>
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

function SyncReviewRow({
  row,
  projects,
  onEditDescription,
  onRemove,
  onToggleInclude,
  onSourceTitleChange,
  onStartChange,
  onProjectChange,
  onTaskChange,
  onHoursChange,
}: {
  row: ReviewedSyncRow;
  projects: ClockifyProject[];
  onEditDescription: () => void;
  onRemove: () => void;
  onToggleInclude: () => void;
  onSourceTitleChange: (sourceTitle: string) => void;
  onStartChange: (start: string) => void;
  onProjectChange: (projectId: string) => void;
  onTaskChange: (taskId: string) => void;
  onHoursChange: (hours: string) => void;
}) {
  const selectedProject = projects.find(
    (project) => project.projectId === row.projectId,
  );
  const availableTasks = selectedProject?.tasks ?? [];
  const hasDescription = row.description.trim().length > 0;
  const issueSummary =
    row.issues.length > 0
      ? `${row.issues[0].message}${row.issues.length > 1 ? ` +${row.issues.length - 1} more` : ""}`
      : "";

  return (
    <tr
      className={cn(
        "border-t border-border/80 align-middle transition-colors hover:bg-muted/25",
        row.status === "ready" && "bg-primary/6",
        row.status === "needs_review" && "bg-[rgba(243,189,93,0.08)]",
        row.status === "error" && "bg-[rgba(240,119,93,0.08)]",
        row.status === "skipped" && "bg-muted/40 text-muted-foreground",
      )}
    >
      <td className="px-3 py-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={row.include}
            onChange={onToggleInclude}
            className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          {row.include ? "Include" : "Skip"}
        </label>
      </td>
      <td className="border-l border-border/70 px-3 py-2">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-primary">
              <Clock3 className="h-3 w-3" />
              {row.source === "manual" ? "Manual" : "Event"}
            </div>
            {row.source === "manual" ? (
              <button
                type="button"
                onClick={onRemove}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
                aria-label="Remove manual row"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          {row.source === "manual" ? (
            <div className="space-y-2">
              <Input
                type="text"
                value={row.sourceTitle}
                onChange={(event) => onSourceTitleChange(event.target.value)}
                disabled={!row.include}
                placeholder="Manual entry title"
                className="h-9 rounded-none border-border bg-background/80 shadow-none"
              />
              <Input
                type="datetime-local"
                value={toUtcMinus7DateTimeLocalValue(row.start)}
                onChange={(event) => onStartChange(event.target.value)}
                disabled={!row.include}
                className="h-9 rounded-none border-border bg-background/80 text-xs shadow-none"
              />
              <p className="truncate text-xs leading-5 text-muted-foreground">
                {row.start && row.end
                  ? `${formatDateTime(row.start)} - ${formatDateTime(row.end)}`
                  : "Pick a start time"}
              </p>
            </div>
          ) : (
            <>
              <p
                className="truncate font-semibold leading-5 text-foreground"
                title={row.sourceTitle}
              >
                {row.sourceTitle}
              </p>
              <p className="truncate text-xs leading-5 text-muted-foreground">
                {formatDateTime(row.start)} - {formatDateTime(row.end)}
              </p>
            </>
          )}
        </div>
      </td>
      <td className="border-l border-border/70 px-3 py-2">
        <SearchSelect
          value={row.projectId}
          onChange={onProjectChange}
          disabled={!row.include}
          allowCopySelected
          placeholder="Select project"
          searchPlaceholder="Search projects..."
          emptyResultsLabel="No projects found."
          options={[
            { value: "", label: "Select project" },
            ...projects.map((project) => ({
              value: project.projectId,
              label: project.projectName,
            })),
          ]}
        />
      </td>
      <td className="border-l border-border/70 px-3 py-2">
        <SearchSelect
          value={row.taskId}
          onChange={onTaskChange}
          disabled={!row.include || !row.projectId}
          placeholder={row.projectId ? "No task" : "Pick project first"}
          searchPlaceholder="Search tasks..."
          emptyResultsLabel={
            row.projectId ? "No tasks found." : "Pick a project first."
          }
          options={[
            {
              value: "",
              label: row.projectId ? "No task" : "Pick project first",
            },
            ...availableTasks.map((task) => ({
              value: task.taskId,
              label: task.taskName,
            })),
          ]}
        />
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

function CompactStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card/72 px-3 py-3 shadow-[0_10px_24px_rgba(18,12,24,0.18)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
        {label}
      </p>
      <p className="mt-1.5 text-[1.5rem] font-semibold leading-none tracking-[-0.04em] text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
        {detail}
      </p>
    </div>
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

function TableHeroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "accent" | "muted";
}) {
  const tones = {
    default: "border-primary/16 bg-primary/10 text-primary",
    accent: "border-accent/16 bg-[rgba(240,119,93,0.06)] text-accent",
    muted: "border-border bg-muted/40 text-muted-foreground",
  };

  return (
    <div className={cn("rounded-2xl border px-3 py-3", tones[tone])}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em]">
        {label}
      </p>
      <p className="mt-1.5 text-[1.45rem] font-semibold leading-none tracking-[-0.04em]">
        {value}
      </p>
    </div>
  );
}

function StudioField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
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

function ResultRow({
  title,
  detail,
  status,
}: {
  title: string;
  detail: string;
  status: "success" | "warning";
}) {
  return (
    <div className="flex gap-3 rounded-md border bg-background p-4">
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          status === "success"
            ? "bg-primary/10 text-primary"
            : "bg-accent/10 text-accent",
        )}
      >
        {status === "success" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <TriangleAlert className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function ActivityItem({ item }: { item: SyncActivity }) {
  const iconStyles = {
    success: "bg-primary/10 text-primary",
    warning: "bg-accent/10 text-accent",
    pending: "bg-secondary/20 text-secondary-foreground",
  };

  return (
    <div className="flex gap-3 rounded-md border bg-background p-4">
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          iconStyles[item.status],
        )}
      >
        {item.status === "warning" ? (
          <TriangleAlert className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">{item.title}</p>
          <p className="text-sm text-muted-foreground">{item.time}</p>
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {item.detail}
        </p>
      </div>
    </div>
  );
}

function getUtcMinus7Today() {
  const utcMinus7 = new Date(Date.now() - 7 * 60 * 60 * 1000);
  return utcMinus7.toISOString().slice(0, 10);
}

function buildDateRange(start: string, end: string) {
  return {
    start: `${start}T00:00:00-07:00`,
    end: `${addDays(end, 1)}T00:00:00-07:00`,
  };
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildDraftRows(
  events: OutlookEvent[],
  projects: ClockifyProject[],
  mappingRules: OutlookMappingRule[],
  descriptionMode: DescriptionMode,
): SyncDraftRow[] {
  const projectsByName = new Map(
    projects.map((project) => [normalizeName(project.projectName), project]),
  );

  return events.map((event) => {
    const mappingRule = findFirstMatchingRule(event.title, mappingRules);
      const fallbackTitleParts = splitTitle(event.title);
      const projectName = mappingRule?.projectName ?? fallbackTitleParts[0];
      const taskName = mappingRule?.taskName ?? fallbackTitleParts[1];
      const suggestedProject = projectsByName.get(normalizeName(projectName));
      const suggestedTask = findTaskByName(suggestedProject?.tasks ?? [], taskName);
      const sourceNotes = event.notes ?? "";
      const description =
        cleanRuleDescription(mappingRule?.descriptionTemplate) ??
        buildDescriptionFromMode(event.title, sourceNotes, descriptionMode);

      return {
        id: getEventKey(event),
        source: "outlook",
        outlookEventId: event.outlookEventId,
        sourceTitle: event.title,
        sourceNotes,
        start: event.start,
        end: event.end,
        hours: roundHours(
        event.hours > 0 ? event.hours : calculateHours(event.start, event.end),
      ),
      description,
      include: true,
      projectId: suggestedProject?.projectId ?? "",
      taskId: suggestedTask?.taskId ?? "",
      suggestedProjectId: suggestedProject?.projectId,
      suggestedTaskId: suggestedTask?.taskId,
    };
  });
}

function validateDraftRow(
  row: SyncDraftRow,
  projectById: Map<string, ClockifyProject>,
): ReviewedSyncRow {
  const issues: ReviewedSyncRow["issues"] = [];

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

  if (!row.sourceTitle.trim()) {
    issues.push({
      tone: "warning",
      message: row.source === "manual" ? "Add a title for the manual row." : "Title is missing.",
    });
  }

  if (!Number.isFinite(row.hours) || row.hours <= 0) {
    issues.push({ tone: "error", message: "Hours must be greater than zero." });
  }

  const startTime = new Date(row.start).getTime();
  const endTime = new Date(row.end).getTime();

  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    endTime <= startTime
  ) {
    issues.push({
      tone: "error",
      message: "Start and end times must form a valid range.",
    });
  }

  if (!row.description.trim()) {
    issues.push({
      tone: "warning",
      message: "Description is empty. Add context before push.",
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

function calculateHours(start: string, end: string) {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  return diffMs / (1000 * 60 * 60);
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function createManualDraftRow(startDate: string): SyncDraftRow {
  const start = toUtcIsoFromUtcMinus7Value(`${startDate}T09:00:00-07:00`);

  return {
    id: createRowId(),
    source: "manual",
    sourceTitle: "",
    sourceNotes: "",
    start,
    end: getEndFromStartAndHours(start, 1),
    hours: 1,
    description: "",
    include: true,
    projectId: "",
    taskId: "",
  };
}

function getEndFromStartAndHours(start: string, hours: number) {
  const startTime = new Date(start).getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(hours) || hours <= 0) {
    return "";
  }

  return new Date(startTime + hours * 60 * 60 * 1000).toISOString();
}

function getEventKey(event: OutlookEvent) {
  return event.outlookEventId ?? `${event.title}-${event.start}-${event.end}`;
}

function buildMergeReviewState(
  rows: ReviewedSyncRow[],
  projectById: Map<string, ClockifyProject>,
) {
  const rowsByProjectTask = new Map<string, ReviewedSyncRow[]>();

  for (const row of rows) {
    const key = getProjectTaskKey(row.projectId, row.taskId);
    const existing = rowsByProjectTask.get(key);

    if (existing) {
      existing.push(row);
    } else {
      rowsByProjectTask.set(key, [row]);
    }
  }

  const directRows: ReviewedSyncRow[] = [];
  const mergedEntries: MergeReviewEntry[] = [];
  const mergedKeys = new Set<string>();

  for (const row of rows) {
    const key = getProjectTaskKey(row.projectId, row.taskId);
    const groupedRows = rowsByProjectTask.get(key) ?? [row];

    if (groupedRows.length === 1) {
      directRows.push(row);
      continue;
    }

    if (mergedKeys.has(key)) {
      continue;
    }

    mergedEntries.push(buildMergeReviewEntry(groupedRows, projectById));
    mergedKeys.add(key);
  }

  return mergedEntries.length > 0
    ? {
        directRows,
        mergedEntries,
      }
    : null;
}

function buildMergeReviewEntry(
  rows: ReviewedSyncRow[],
  projectById: Map<string, ClockifyProject>,
): MergeReviewEntry {
  const sortedRows = [...rows].sort(
    (left, right) =>
      new Date(left.start).getTime() - new Date(right.start).getTime(),
  );
  const firstRow = sortedRows[0];
  const totalHours = roundHours(
    sortedRows.reduce((sum, row) => sum + row.hours, 0),
  );
  const project = projectById.get(firstRow.projectId);
  const task = project?.tasks.find((item) => item.taskId === firstRow.taskId);

  return {
    id: `merge-${getProjectTaskKey(firstRow.projectId, firstRow.taskId)}`,
    title: buildMergedTitle(sortedRows),
    projectId: firstRow.projectId,
    projectName: firstRow.projectName ?? project?.projectName ?? "Project",
    taskId: firstRow.taskId,
    taskName: firstRow.taskName ?? task?.taskName ?? "",
    start: firstRow.start,
    end: getEndFromStartAndHours(firstRow.start, totalHours),
    hours: totalHours,
    description: buildMergedDescription(sortedRows),
    sourceRows: sortedRows,
    spansMultipleDays: new Set(
      sortedRows.map((row) => toUtcMinus7DateTimeLocalValue(row.start).slice(0, 10)),
    ).size > 1,
  };
}

function getProjectTaskKey(projectId: string, taskId: string) {
  return `${projectId}::${taskId || "__no_task__"}`;
}

function buildMergedTitle(rows: ReviewedSyncRow[]) {
  const uniqueTitles = Array.from(
    new Set(rows.map((row) => row.sourceTitle.trim()).filter(Boolean)),
  );

  if (uniqueTitles.length === 0) {
    return "Merged Outlook rows";
  }

  if (uniqueTitles.length === 1) {
    return uniqueTitles[0];
  }

  return `${uniqueTitles[0]} +${uniqueTitles.length - 1} more`;
}

function buildMergedDescription(rows: ReviewedSyncRow[]) {
  const sections = rows
    .map((row) => {
      const cleanTitle = row.sourceTitle.trim();
      const cleanDescription = row.description.trim();

      if (!cleanTitle && !cleanDescription) {
        return "";
      }

      if (
        cleanTitle &&
        cleanDescription &&
        normalizeWhitespace(cleanTitle) !== normalizeWhitespace(cleanDescription)
      ) {
        return `${cleanTitle}\n${cleanDescription}`;
      }

      return cleanDescription || cleanTitle;
    })
    .filter(Boolean);

  return Array.from(new Set(sections)).join("\n\n");
}

function getMergeReviewIssues(entry: MergeReviewEntry) {
  const issues: string[] = [];

  if (!Number.isFinite(entry.hours) || entry.hours <= 0) {
    issues.push("Merged hours must be greater than zero.");
  }

  const startTime = new Date(entry.start).getTime();
  const endTime = new Date(entry.end).getTime();

  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    endTime <= startTime
  ) {
    issues.push("Merged time range is invalid.");
  }

  if (!entry.description.trim()) {
    issues.push("Merged description cannot be empty.");
  }

  return issues;
}

function mapReviewedRowToPushEntry(row: ReviewedSyncRow): ClockifyPushEntry {
  return {
    title: row.sourceTitle,
    description: row.description,
    start: row.start,
    end: row.end,
    projectId: row.projectId,
    ...(row.taskId ? { taskId: row.taskId } : {}),
    billable: true,
    outlookEventId: row.outlookEventId,
  };
}

function mapMergeReviewEntryToPushEntry(
  entry: MergeReviewEntry,
): ClockifyPushEntry {
  return {
    title: entry.title,
    description: entry.description,
    start: entry.start,
    end: entry.end,
    projectId: entry.projectId,
    ...(entry.taskId ? { taskId: entry.taskId } : {}),
    billable: true,
  };
}

function splitTitle(title: string) {
  if (!title.includes(":")) {
    return [title.trim(), ""] as const;
  }

  const [projectName, taskName] = title.split(":", 2);
  return [projectName.trim(), taskName.trim()] as const;
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function findFirstMatchingRule(
  title: string,
  mappingRules: OutlookMappingRule[],
) {
  const normalizedTitle = normalizeName(title);

  return (
    mappingRules.find((rule) => {
      if (!rule.isActive) {
        return false;
      }

      const normalizedMatchValue = normalizeName(rule.matchValue);

      if (!normalizedMatchValue) {
        return false;
      }

      if (rule.matchType === "exact_title") {
        return normalizedTitle === normalizedMatchValue;
      }

      if (rule.matchType === "contains_title") {
        return normalizedTitle.includes(normalizedMatchValue);
      }

      return false;
    }) ?? null
  );
}

function MergeReviewStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-none border border-border/70 bg-background px-3 py-2.5 shadow-[0_8px_20px_rgba(18,12,24,0.10)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
        {label}
      </p>
      <p className="mt-1.5 text-[1.3rem] font-semibold leading-none tracking-[-0.05em] text-foreground">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{detail}</p>
    </div>
  );
}

function DescriptionModeOption({
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
        type="radio"
        name="description-mode"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 border-border text-primary focus:ring-ring"
      />
      <span>{label}</span>
    </label>
  );
}

function findTaskByName(tasks: ClockifyTask[], taskName: string) {
  const normalizedTaskName = normalizeName(taskName);

  if (!normalizedTaskName) {
    return undefined;
  }

  return tasks.find((task) => normalizeName(task.taskName) === normalizedTaskName);
}

function cleanRuleDescription(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function buildDescriptionFromMode(
  title: string,
  notes: string,
  mode: DescriptionMode,
) {
  const cleanTitle = title.trim();
  const cleanNotes = notes.trim();

  if (mode === "title") {
    return cleanTitle;
  }

  if (mode === "body_title") {
    return [cleanTitle, cleanNotes].filter(Boolean).join("\n\n");
  }

  return cleanNotes;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Etc/GMT+7",
  }).format(new Date(value));
}

function toUtcMinus7DateTimeLocalValue(value: string) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  return new Date(timestamp - 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function fromUtcMinus7DateTimeLocalValue(value: string) {
  return value ? toUtcIsoFromUtcMinus7Value(`${value}:00-07:00`) : "";
}

function toUtcIsoFromUtcMinus7Value(value: string) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  return new Date(timestamp).toISOString();
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

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatHoursLabel(value: number) {
  return `${roundHours(value)} hour${roundHours(value) === 1 ? "" : "s"}`;
}

function getErrorMessage(exc: unknown) {
  if (exc instanceof ApiError) {
    if (exc.details && typeof exc.details === "object") {
      const details = exc.details as Record<string, unknown>;
      const detailMessage =
        stringifyDetail(details.message) ??
        stringifyDetail(details.error) ??
        stringifyDetail(details.details);

      if (detailMessage) {
        return detailMessage;
      }
    }

    return `${exc.message} (HTTP ${exc.status})`;
  }

  if (exc instanceof Error) {
    return exc.message;
  }

  return "Unexpected integration error.";
}

function stringifyDetail(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  return null;
}

function createActivityId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRowId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `manual-${crypto.randomUUID()}`;
  }

  return `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
