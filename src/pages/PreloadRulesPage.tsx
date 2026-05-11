import { FormEvent, useEffect, useState } from "react";
import { Plus, RefreshCw, SlidersHorizontal, Trash2 } from "lucide-react";

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
import { Select } from "../components/ui/select";
import {
  ApiError,
  INTEGRATION_SETUP_URL,
  MappingDeleteResponse,
  MappingListResponse,
  MappingSaveResponse,
  OutlookMappingRule,
  postJson,
} from "../lib/api";

type MappingFormState = {
  scope: "shared" | "user";
  matchType: "exact_title" | "contains_title";
  matchValue: string;
  projectName: string;
  taskName: string;
  descriptionTemplate: string;
};

const initialMappingForm: MappingFormState = {
  scope: "shared",
  matchType: "exact_title",
  matchValue: "",
  projectName: "",
  taskName: "",
  descriptionTemplate: "",
};

export function PreloadRulesPage({ currentEmail }: { currentEmail: string }) {
  const [mappingRules, setMappingRules] = useState<OutlookMappingRule[]>([]);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [mappingForm, setMappingForm] = useState<MappingFormState>(initialMappingForm);

  useEffect(() => {
    let isActive = true;

    async function bootstrap() {
      setMappingError(null);
      setIsLoadingMappings(true);

      try {
        const data = await postJson<
          MappingListResponse,
          { action: "listMappings"; email: string }
        >(INTEGRATION_SETUP_URL, {
          action: "listMappings",
          email: currentEmail,
        });

        if (!isActive) {
          return;
        }

        setMappingRules(data.rules);
      } catch (exc) {
        if (!isActive) {
          return;
        }

        setMappingError(getErrorMessage(exc));
      } finally {
        if (isActive) {
          setIsLoadingMappings(false);
        }
      }
    }

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, [currentEmail]);

  async function loadMappings() {
    setMappingError(null);
    setIsLoadingMappings(true);

    try {
      const data = await postJson<
        MappingListResponse,
        { action: "listMappings"; email: string }
      >(INTEGRATION_SETUP_URL, {
        action: "listMappings",
        email: currentEmail,
      });

      setMappingRules(data.rules);
    } catch (exc) {
      setMappingError(getErrorMessage(exc));
    } finally {
      setIsLoadingMappings(false);
    }
  }

  function updateMappingForm<K extends keyof MappingFormState>(
    key: K,
    value: MappingFormState[K],
  ) {
    setMappingForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetMappingForm() {
    setMappingForm(initialMappingForm);
  }

  async function handleSaveMapping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMappingError(null);
    setIsSavingMapping(true);

    try {
      await postJson<
        MappingSaveResponse,
        {
          action: "saveMapping";
          email: string;
          scope: "shared" | "user";
          matchType: "exact_title" | "contains_title";
          matchValue: string;
          projectName: string;
          taskName: string;
          descriptionTemplate: string;
          isActive: true;
          priority: 100;
        }
      >(INTEGRATION_SETUP_URL, {
        action: "saveMapping",
        email: currentEmail,
        scope: mappingForm.scope,
        matchType: mappingForm.matchType,
        matchValue: mappingForm.matchValue.trim(),
        projectName: mappingForm.projectName.trim(),
        taskName: mappingForm.taskName.trim(),
        descriptionTemplate: mappingForm.descriptionTemplate.trim(),
        isActive: true,
        priority: 100,
      });

      resetMappingForm();
      await loadMappings();
    } catch (exc) {
      setMappingError(getErrorMessage(exc));
    } finally {
      setIsSavingMapping(false);
    }
  }

  async function handleDeleteMapping(ruleId: string) {
    setMappingError(null);
    setDeletingRuleId(ruleId);

    try {
      await postJson<
        MappingDeleteResponse,
        { action: "deleteMapping"; email: string; ruleId: string }
      >(INTEGRATION_SETUP_URL, {
        action: "deleteMapping",
        email: currentEmail,
        ruleId,
      });

      setMappingRules((current) => current.filter((rule) => rule.id !== ruleId));
    } catch (exc) {
      setMappingError(getErrorMessage(exc));
    } finally {
      setDeletingRuleId(null);
    }
  }

  return (
    <section className="app-page-shell">
      <Card className="app-hero-surface-strong overflow-hidden border-border/80">
        <CardHeader className="gap-3 border-b border-border/80 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                Management
              </p>
              <CardTitle className="mt-2 font-studio text-3xl tracking-[-0.04em] text-foreground">
                Outlook preload rules
              </CardTitle>
              <CardDescription className="mt-2 max-w-xl">
                Manage the title rules that prefill Clockify project, task, and description values before sync review starts.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full px-4"
              onClick={() => void loadMappings()}
              disabled={isLoadingMappings}
            >
              <RefreshCw className={isLoadingMappings ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Card className="border-border/80 bg-muted/35 shadow-none">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Add preload rule</CardTitle>
                  <CardDescription>
                    New Outlook titles will be matched in the order returned by the backend.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSaveMapping}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[11px] uppercase tracking-[0.22em] text-primary">
                      Match type
                    </Label>
                    <Select
                      value={mappingForm.matchType}
                      onChange={(event) =>
                        updateMappingForm(
                          "matchType",
                          event.target.value as MappingFormState["matchType"],
                        )
                      }
                      className="h-11 rounded-none"
                    >
                      <option value="exact_title">Exact title</option>
                      <option value="contains_title">Contains title</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] uppercase tracking-[0.22em] text-primary">
                      Scope
                    </Label>
                    <Select
                      value={mappingForm.scope}
                      onChange={(event) =>
                        updateMappingForm(
                          "scope",
                          event.target.value as MappingFormState["scope"],
                        )
                      }
                      className="h-11 rounded-none"
                    >
                      <option value="shared">Shared</option>
                      <option value="user">This user only</option>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[11px] uppercase tracking-[0.22em] text-primary">
                      Outlook title
                    </Label>
                    <Input
                      value={mappingForm.matchValue}
                      onChange={(event) => updateMappingForm("matchValue", event.target.value)}
                      className="h-11 rounded-none"
                      placeholder="Operations Call"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] uppercase tracking-[0.22em] text-primary">
                      Project
                    </Label>
                    <Input
                      value={mappingForm.projectName}
                      onChange={(event) => updateMappingForm("projectName", event.target.value)}
                      className="h-11 rounded-none"
                      placeholder="HR"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[11px] uppercase tracking-[0.22em] text-primary">
                      Task
                    </Label>
                    <Input
                      value={mappingForm.taskName}
                      onChange={(event) => updateMappingForm("taskName", event.target.value)}
                      className="h-11 rounded-none"
                      placeholder="Internal Meeting"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] uppercase tracking-[0.22em] text-primary">
                      Description
                    </Label>
                    <Input
                      value={mappingForm.descriptionTemplate}
                      onChange={(event) =>
                        updateMappingForm("descriptionTemplate", event.target.value)
                      }
                      className="h-11 rounded-none"
                      placeholder="Daily Operations Call"
                    />
                  </div>
                </div>

                {mappingError ? (
                  <div className="border border-[rgba(240,119,93,0.20)] bg-[rgba(240,119,93,0.08)] px-4 py-3 text-sm text-accent">
                    {mappingError}
                  </div>
                ) : null}

                <div className="flex items-center justify-end">
                  <Button
                    type="submit"
                    disabled={isSavingMapping}
                    className="h-11 rounded-full px-5 shadow-[0_12px_28px_rgba(36,24,48,0.26)]"
                  >
                    <Plus className="h-4 w-4" />
                    {isSavingMapping ? "Saving rule" : "Add rule"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/80 shadow-none">
            <CardHeader className="border-b border-border/80">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Existing rules</CardTitle>
                  <CardDescription>
                    Review current matches and remove stale mappings before the next sync.
                  </CardDescription>
                </div>
                {isLoadingMappings ? (
                  <span className="text-xs text-muted-foreground">Loading...</span>
                ) : (
                  <span className="text-xs uppercase tracking-[0.18em] text-primary">
                    {mappingRules.length} total
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {!isLoadingMappings && mappingRules.length === 0 ? (
                <div className="border border-dashed border-border/80 bg-muted/35 px-4 py-5 text-sm text-muted-foreground">
                  No preload rules yet.
                </div>
              ) : null}

              {mappingRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-start justify-between gap-4 border border-border/80 bg-background/45 px-4 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{rule.matchValue}</p>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-primary">
                        {rule.matchType === "exact_title" ? "Exact" : "Contains"}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {rule.scope}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {rule.projectName} / {rule.taskName}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {rule.descriptionTemplate || "No default description"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={deletingRuleId === rule.id}
                    className="h-9 w-9 rounded-full p-0 text-muted-foreground hover:text-accent"
                    onClick={() => void handleDeleteMapping(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </section>
  );
}

function getErrorMessage(exc: unknown) {
  if (exc instanceof ApiError) {
    return exc.message;
  }

  if (exc instanceof Error) {
    return exc.message;
  }

  return "Unexpected setup error.";
}
