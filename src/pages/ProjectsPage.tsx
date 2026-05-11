import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FolderKanban,
  PencilLine,
  Plus,
  RefreshCw,
  Save,
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
import { Select } from "../components/ui/select";
import {
  ApiError,
  PROJECTS_COMPLETENESS_URL,
  PROJECTS_CRUD_URL,
  PROJECTS_LOOKUP_URL,
  ProjectApiResponse,
  postJson,
} from "../lib/api";
import { cn } from "../lib/utils";

type KvpRecord = {
  kvp_id: number;
  kvp_group: string;
  kvp_key: string;
  kvp_value: string;
  sort_order?: number;
  is_active?: boolean;
};

type ProjectSummary = {
  project_id: number;
  project_name: string | null;
  is_active?: boolean | null;
  ghl_sub_account_name: string | null;
  clockify_project_name: string | null;
  asana_project_name: string | null;
  asset_class: string | null;
  teams_channel_name: string | null;
};

type ProjectCompleteness = {
  project_id: number;
  project_name: string | null;
  completeness_percent: number;
  is_complete: boolean;
  missing_fields: string[];
  missing_sections: string[];
  child_counts: Record<string, number>;
};

type ProjectTypeRecord = {
  project_type_id?: number;
  kvp_id: number;
};

type DomainRecord = {
  domain_id?: number;
  domain_type_kvp_id: number | null;
  domain_name: string | null;
  expiration_date: string | null;
  description: string | null;
};

type EmailRecord = {
  email_id?: number;
  email_address: string | null;
  email_provider_kvp_id: number | null;
  password: string | null;
  other_details: string | null;
};

type PhoneRecord = {
  phone_id?: number;
  phone_type_kvp_id: number | null;
  phone_number: string | null;
  agent_name: string | null;
  agent_gender_kvp_id?: number | null;
  agent_tone_kvp_id: number | null;
  description: string | null;
};

type ResourceRecord = {
  resource_id?: number;
  resource_type_kvp_id: number | null;
  name: string | null;
  link: string | null;
  description: string | null;
};

type ProjectRecord = {
  project_id: number;
  project_name: string | null;
  is_active: boolean | null;
  notes_html: string | null;
  ghl_sub_account_name: string | null;
  clockify_project_name: string | null;
  asana_project_name: string | null;
  asset_class: string | null;
  teams_channel_name: string | null;
  fund_raising_start_date: string | null;
  sp_folder: string | null;
  assigned_account_executive: string | null;
  assigned_pm: string | null;
  assigned_sdr: string | null;
  principal_point_of_contact: string | null;
  is_principal_eo_ypo_member: boolean | null;
  project_types?: ProjectTypeRecord[];
  domains?: DomainRecord[];
  emails?: EmailRecord[];
  phones?: PhoneRecord[];
  resources?: ResourceRecord[];
};

type ProjectTypeFormRow = {
  localId: string;
  project_type_id?: number;
  kvp_id: string;
};

type DomainFormRow = {
  localId: string;
  domain_id?: number;
  domain_type_kvp_id: string;
  domain_name: string;
  expiration_date: string;
  description: string;
};

type EmailFormRow = {
  localId: string;
  email_id?: number;
  email_address: string;
  email_provider_kvp_id: string;
  password: string;
  other_details: string;
};

type PhoneFormRow = {
  localId: string;
  phone_id?: number;
  phone_type_kvp_id: string;
  phone_number: string;
  agent_name: string;
  agent_gender_kvp_id: string;
  agent_tone_kvp_id: string;
  description: string;
};

type ResourceFormRow = {
  localId: string;
  resource_id?: number;
  resource_type_kvp_id: string;
  name: string;
  link: string;
  description: string;
};

type ProjectFormState = {
  project_name: string;
  project_status: "active" | "inactive";
  ghl_sub_account_name: string;
  clockify_project_name: string;
  asana_project_name: string;
  asset_class: string;
  teams_channel_name: string;
  fund_raising_start_date: string;
  sp_folder: string;
  assigned_account_executive: string;
  assigned_pm: string;
  assigned_sdr: string;
  principal_point_of_contact: string;
  is_principal_eo_ypo_member: boolean;
  project_types: ProjectTypeFormRow[];
  domains: DomainFormRow[];
  emails: EmailFormRow[];
  phones: PhoneFormRow[];
  resources: ResourceFormRow[];
  notes_html: string;
};

type DetailMode = "create" | "view";
type ActiveTab = "project" | "technical" | "notes";
type AppMessage = {
  tone: "success" | "warning";
  text: string;
};
type TechnicalTextModalState = {
  section: "phones" | "domains" | "emails" | "resources";
  localId: string;
  field: "description" | "other_details";
  title: string;
};

const EMPTY_FORM = (): ProjectFormState => ({
  project_name: "",
  project_status: "active",
  ghl_sub_account_name: "",
  clockify_project_name: "",
  asana_project_name: "",
  asset_class: "",
  teams_channel_name: "",
  fund_raising_start_date: "",
  sp_folder: "",
  assigned_account_executive: "",
  assigned_pm: "",
  assigned_sdr: "",
  principal_point_of_contact: "",
  is_principal_eo_ypo_member: false,
  project_types: [],
  domains: [],
  emails: [],
  phones: [],
  resources: [],
  notes_html: "",
});

const trackerInputClass =
  "h-11 rounded-none border-border bg-white text-black placeholder:text-black/35 shadow-none read-only:text-black read-only:opacity-100";
const compactTrackerInputClass =
  "h-10 rounded-none border-border bg-white px-3 text-sm text-black placeholder:text-black/35 shadow-none read-only:text-black read-only:opacity-100";
const compactSelectClass =
  "h-10 rounded-none border-border bg-background/80 px-3 text-sm text-black shadow-none";
const compactTextareaClass =
  "h-10 min-h-[40px] w-full resize-none overflow-hidden rounded-none border border-border bg-white px-3 py-2 text-sm leading-5 text-black shadow-none outline-none transition-colors focus:border-primary/40 read-only:opacity-100";

export function ProjectsPage() {
  const notesEditorRef = useRef<HTMLDivElement | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [lookups, setLookups] = useState<KvpRecord[]>([]);
  const [completeness, setCompleteness] = useState<ProjectCompleteness[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [detailMode, setDetailMode] = useState<DetailMode>("view");
  const [activeTab, setActiveTab] = useState<ActiveTab>("project");
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<ProjectFormState>(EMPTY_FORM);
  const [savedSnapshot, setSavedSnapshot] = useState<ProjectFormState>(
    EMPTY_FORM,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const [message, setMessage] = useState<AppMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTechnicalTextModal, setActiveTechnicalTextModal] =
    useState<TechnicalTextModalState | null>(null);

  useEffect(() => {
    void initializePage();
  }, []);

  useEffect(() => {
    if (!notesEditorRef.current) {
      return;
    }

    if (notesEditorRef.current.innerHTML !== form.notes_html) {
      notesEditorRef.current.innerHTML = form.notes_html;
    }
  }, [form.notes_html, activeTab, viewMode]);

  const completenessById = useMemo(
    () => new Map(completeness.map((item) => [item.project_id, item])),
    [completeness],
  );

  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return projects;
    }

    return projects.filter((project) =>
      [
        project.project_id,
        project.project_name,
        project.ghl_sub_account_name,
        project.clockify_project_name,
        project.asana_project_name,
        project.asset_class,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(normalizedQuery)),
    );
  }, [projects, searchQuery]);

  const currentCompleteness =
    selectedProjectId !== null
      ? completenessById.get(selectedProjectId) ?? null
      : null;

  const isCreateMode = detailMode === "create";
  const isFormEditable = isCreateMode || isEditing;
  const isDirty = useMemo(
    () => serializeForm(form) !== serializeForm(savedSnapshot),
    [form, savedSnapshot],
  );

  const projectTypeOptions = getLookupOptions(lookups, "project_type");
  const domainTypeOptions = getLookupOptions(lookups, "domain_type");
  const emailProviderOptions = getLookupOptions(lookups, "email_provider");
  const phoneTypeOptions = getLookupOptions(lookups, "phone_type");
  const agentGenderOptions = getLookupOptions(lookups, "agent_gender");
  const agentToneOptions = getLookupOptions(lookups, "agent_tone");
  const resourceTypeOptions = getLookupOptions(lookups, "resource_type");

  async function initializePage() {
    setIsLoading(true);
    setError(null);

    try {
      const [projectRows, lookupRows, completenessRows] = await Promise.all([
        callProjectApi<ProjectSummary[]>({
          url: PROJECTS_CRUD_URL,
          body: { action: "list_projects" },
        }),
        callProjectApi<KvpRecord[]>({
          url: PROJECTS_LOOKUP_URL,
          body: { action: "list_kvp" },
        }),
        callProjectApi<ProjectCompleteness[]>({
          url: PROJECTS_COMPLETENESS_URL,
          body: { action: "list_completeness" },
        }),
      ]);

      setProjects(projectRows);
      setLookups(lookupRows);
      setCompleteness(completenessRows);
    } catch (exc) {
      setError(getErrorMessage(exc));
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshListData() {
    setError(null);

    try {
      const [projectRows, completenessRows] = await Promise.all([
        callProjectApi<ProjectSummary[]>({
          url: PROJECTS_CRUD_URL,
          body: { action: "list_projects" },
        }),
        callProjectApi<ProjectCompleteness[]>({
          url: PROJECTS_COMPLETENESS_URL,
          body: { action: "list_completeness" },
        }),
      ]);

      setProjects(projectRows);
      setCompleteness(completenessRows);
    } catch (exc) {
      setError(getErrorMessage(exc));
    }
  }

  async function openProject(projectId: number) {
    setError(null);
    setMessage(null);
    setIsOpeningProject(true);

    try {
      const project = await callProjectApi<ProjectRecord>({
        url: PROJECTS_CRUD_URL,
        body: { action: "get_project", project_id: projectId },
      });

      const nextForm = toFormState(project);

      setSelectedProjectId(projectId);
      setForm(nextForm);
      setSavedSnapshot(nextForm);
      setViewMode("detail");
      setDetailMode("view");
      setActiveTab("project");
      setIsEditing(false);
    } catch (exc) {
      setError(getErrorMessage(exc));
    } finally {
      setIsOpeningProject(false);
    }
  }

  function handleCreateProject() {
    const nextForm = EMPTY_FORM();
    setSelectedProjectId(null);
    setForm(nextForm);
    setSavedSnapshot(nextForm);
    setViewMode("detail");
    setDetailMode("create");
    setActiveTab("project");
    setIsEditing(true);
    setError(null);
    setMessage(null);
  }

  function handleBackToList() {
    setViewMode("list");
    setDetailMode("view");
    setActiveTab("project");
    setIsEditing(false);
    setError(null);
    setMessage(null);
  }

  function handleCancelEdit() {
    setForm(savedSnapshot);
    setIsEditing(false);
    if (isCreateMode) {
      handleBackToList();
    }
  }

  async function handleSaveProject() {
    if (!form.project_name.trim()) {
      setError("Project name is required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      let projectId = selectedProjectId;

      if (isCreateMode) {
        const created = await callProjectApi<ProjectRecord>({
          url: PROJECTS_CRUD_URL,
          body: {
            action: "create_project",
            data: serializeProjectPayload(form),
          },
        });

        projectId = created.project_id;
      } else if (projectId !== null) {
        await callProjectApi<ProjectRecord>({
          url: PROJECTS_CRUD_URL,
          body: {
            action: "update_project",
            project_id: projectId,
            data: serializeProjectPayload(form),
          },
        });
      }

      if (projectId === null) {
        throw new Error("Project id is missing.");
      }

      await syncProjectTypes(projectId, savedSnapshot.project_types, form.project_types);
      await syncChildRows(projectId, savedSnapshot.domains, form.domains, {
        idKey: "domain_id",
        createAction: "create_domain",
        updateAction: "update_domain",
        deleteAction: "delete_domain",
        toPayload: (row) => ({
          domain_type_kvp_id: toOptionalNumber(row.domain_type_kvp_id),
          domain_name: row.domain_name.trim() || null,
          expiration_date: row.expiration_date.trim() || null,
          description: row.description.trim() || null,
        }),
      });
      await syncChildRows(projectId, savedSnapshot.emails, form.emails, {
        idKey: "email_id",
        createAction: "create_email",
        updateAction: "update_email",
        deleteAction: "delete_email",
        toPayload: (row) => ({
          email_address: row.email_address.trim() || null,
          email_provider_kvp_id: toOptionalNumber(row.email_provider_kvp_id),
          password: row.password.trim() || null,
          other_details: row.other_details.trim() || null,
        }),
      });
      await syncChildRows(projectId, savedSnapshot.phones, form.phones, {
        idKey: "phone_id",
        createAction: "create_phone",
        updateAction: "update_phone",
        deleteAction: "delete_phone",
        toPayload: (row) => ({
          phone_type_kvp_id: toOptionalNumber(row.phone_type_kvp_id),
          phone_number: row.phone_number.trim() || null,
          agent_name: row.agent_name.trim() || null,
          agent_gender_kvp_id: toOptionalNumber(row.agent_gender_kvp_id),
          agent_tone_kvp_id: toOptionalNumber(row.agent_tone_kvp_id),
          description: row.description.trim() || null,
        }),
      });
      await syncChildRows(projectId, savedSnapshot.resources, form.resources, {
        idKey: "resource_id",
        createAction: "create_resource",
        updateAction: "update_resource",
        deleteAction: "delete_resource",
        toPayload: (row) => ({
          resource_type_kvp_id: toOptionalNumber(row.resource_type_kvp_id),
          name: row.name.trim() || null,
          link: row.link.trim() || null,
          description: row.description.trim() || null,
        }),
      });

      await refreshListData();
      await openProject(projectId);
      setMessage({
        tone: "success",
        text: isCreateMode ? "Project created." : "Project updated.",
      });
    } catch (exc) {
      setError(getErrorMessage(exc));
    } finally {
      setIsSaving(false);
    }
  }

  async function syncProjectTypes(
    projectId: number,
    previousRows: ProjectTypeFormRow[],
    nextRows: ProjectTypeFormRow[],
  ) {
    const previousByKvpId = new Map(
      previousRows.map((row) => [row.kvp_id, row]),
    );
    const nextByKvpId = new Map(nextRows.map((row) => [row.kvp_id, row]));

    for (const row of previousRows) {
      if (!nextByKvpId.has(row.kvp_id) && row.project_type_id) {
        await callProjectApi({
          url: PROJECTS_CRUD_URL,
          body: {
            action: "delete_project_type",
            record_id: row.project_type_id,
          },
        });
      }
    }

    for (const row of nextRows) {
      if (!previousByKvpId.has(row.kvp_id)) {
        await callProjectApi({
          url: PROJECTS_CRUD_URL,
          body: {
            action: "create_project_type",
            project_id: projectId,
            data: {
              kvp_id: Number(row.kvp_id),
            },
          },
        });
      }
    }
  }

  async function syncChildRows<
    TRow extends { localId: string } & Record<string, unknown>,
  >(
    projectId: number,
    previousRows: TRow[],
    nextRows: TRow[],
    config: {
      idKey: keyof TRow;
      createAction: string;
      updateAction: string;
      deleteAction: string;
      toPayload: (row: TRow) => Record<string, unknown>;
    },
  ) {
    const previousById = new Map<number, TRow>();

    for (const row of previousRows) {
      const rowId = row[config.idKey];
      if (typeof rowId === "number") {
        previousById.set(rowId, row);
      }
    }

    const nextIds = new Set<number>();

    for (const row of nextRows) {
      const rowId = row[config.idKey];
      if (typeof rowId === "number") {
        nextIds.add(rowId);
      }
    }

    for (const [rowId] of previousById) {
      if (!nextIds.has(rowId)) {
        await callProjectApi({
          url: PROJECTS_CRUD_URL,
          body: {
            action: config.deleteAction,
            record_id: rowId,
          },
        });
      }
    }

    for (const row of nextRows) {
      const payload = config.toPayload(row);
      const rowId = row[config.idKey];

      if (typeof rowId === "number") {
        const previousRow = previousById.get(rowId);
        const previousPayload = previousRow
          ? config.toPayload(previousRow)
          : null;

        if (
          previousPayload &&
          JSON.stringify(payload) === JSON.stringify(previousPayload)
        ) {
          continue;
        }

        await callProjectApi({
          url: PROJECTS_CRUD_URL,
          body: {
            action: config.updateAction,
            record_id: rowId,
            data: payload,
          },
        });
        continue;
      }

      if (Object.values(payload).every((value) => value === null)) {
        continue;
      }

      await callProjectApi({
        url: PROJECTS_CRUD_URL,
        body: {
          action: config.createAction,
          project_id: projectId,
          data: payload,
        },
      });
    }
  }

  function updateForm<K extends keyof ProjectFormState>(
    key: K,
    value: ProjectFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleProjectType(kvpId: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      project_types: checked
        ? [
            ...current.project_types,
            {
              localId: createLocalId("project-type"),
              kvp_id: kvpId,
            },
          ]
        : current.project_types.filter((row) => row.kvp_id !== kvpId),
    }));
  }

  function updateCollectionRow<
    TKey extends "domains" | "emails" | "phones" | "resources",
  >(
    key: TKey,
    localId: string,
    patch: Partial<ProjectFormState[TKey][number]>,
  ) {
    setForm((current) => ({
      ...current,
      [key]: current[key].map((row) =>
        row.localId === localId ? { ...row, ...patch } : row,
      ),
    }));
  }

  function addCollectionRow(key: "domains" | "emails" | "phones" | "resources") {
    setForm((current) => ({
      ...current,
      [key]:
        key === "domains"
          ? [...current.domains, createEmptyDomainRow()]
          : key === "emails"
            ? [...current.emails, createEmptyEmailRow()]
            : key === "phones"
              ? [...current.phones, createEmptyPhoneRow()]
              : [...current.resources, createEmptyResourceRow()],
    }));
  }

  function removeCollectionRow(
    key: "domains" | "emails" | "phones" | "resources",
    localId: string,
  ) {
    setForm((current) => ({
      ...current,
      [key]: current[key].filter((row) => row.localId !== localId),
    }));
  }

  const pageTitle = isCreateMode
    ? "Create Project"
    : form.project_name.trim() || "Project Details";

  const activeTechnicalTextValue = activeTechnicalTextModal
    ? getTechnicalTextValue(form, activeTechnicalTextModal)
    : "";

  function applyNotesCommand(command: string) {
    notesEditorRef.current?.focus();
    document.execCommand(command, false);
    updateForm("notes_html", notesEditorRef.current?.innerHTML ?? "");
  }

  function openTechnicalTextModal(
    section: TechnicalTextModalState["section"],
    localId: string,
    field: TechnicalTextModalState["field"],
    title: string,
  ) {
    setActiveTechnicalTextModal({
      section,
      localId,
      field,
      title,
    });
  }

  return (
    <div className="app-page-shell">
      {error ? <PageAlert tone="warning" text={error} /> : null}
      {message ? <PageAlert tone={message.tone} text={message.text} /> : null}

      {viewMode === "list" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                Project Registry
              </p>
              <h1 className="mt-2 font-studio text-4xl font-semibold tracking-[-0.04em] text-foreground">
                Projects
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Start with the project list, then open a record to review project details and technical details.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-full px-5"
                onClick={() => void refreshListData()}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                Refresh
              </Button>
              <Button
                type="button"
                className="rounded-full px-5"
                onClick={handleCreateProject}
              >
                <Plus className="h-4 w-4" />
                Create
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden border-border/80 bg-card/95 shadow-[0_18px_48px_rgba(18,12,24,0.18)]">
            <CardHeader className="border-b border-border/80">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle className="font-studio text-3xl font-semibold tracking-[-0.04em] text-foreground">
                    Project List
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Click a row to open the full record.
                  </CardDescription>
                </div>
                <div className="w-full max-w-sm">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                    Search
                  </Label>
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search project name, GHL, Clockify, Asana..."
                    className="mt-2 h-11 rounded-none border-border bg-background/80 shadow-none"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead className="bg-muted/35 text-left">
                    <tr className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">Project ID</th>
                      <th className="border-l border-border/70 px-4 py-3 font-semibold">
                        Project Name
                      </th>
                      <th className="border-l border-border/70 px-4 py-3 font-semibold">
                        GHL Sub Account
                      </th>
                      <th className="border-l border-border/70 px-4 py-3 font-semibold">
                        Clockify
                      </th>
                      <th className="border-l border-border/70 px-4 py-3 font-semibold">
                        Asana
                      </th>
                      <th className="border-l border-border/70 px-4 py-3 font-semibold">
                        Completeness
                      </th>
                      <th className="border-l border-border/70 px-4 py-3 font-semibold">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-16 text-center text-sm text-muted-foreground"
                        >
                          Loading projects...
                        </td>
                      </tr>
                    ) : filteredProjects.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-16 text-center text-sm text-muted-foreground"
                        >
                          No projects found.
                        </td>
                      </tr>
                    ) : (
                      filteredProjects.map((project) => {
                        const projectCompleteness =
                          completenessById.get(project.project_id);

                        return (
                          <tr
                            key={project.project_id}
                            className="cursor-pointer border-t border-border/70 transition-colors hover:bg-muted/30"
                            onClick={() => void openProject(project.project_id)}
                          >
                            <td className="px-4 py-3 text-foreground">
                              {project.project_id}
                            </td>
                            <td className="border-l border-border/70 px-4 py-3 font-medium text-foreground">
                              {project.project_name || "-"}
                            </td>
                            <td className="border-l border-border/70 px-4 py-3 text-muted-foreground">
                              {project.ghl_sub_account_name || "-"}
                            </td>
                            <td className="border-l border-border/70 px-4 py-3 text-muted-foreground">
                              {project.clockify_project_name || "-"}
                            </td>
                            <td className="border-l border-border/70 px-4 py-3 text-muted-foreground">
                              {project.asana_project_name || "-"}
                            </td>
                            <td className="border-l border-border/70 px-4 py-3">
                              <span className="font-semibold text-foreground">
                                {projectCompleteness
                                  ? `${projectCompleteness.completeness_percent}%`
                                  : "-"}
                              </span>
                            </td>
                            <td className="border-l border-border/70 px-4 py-3">
                              <Badge
                                variant={
                                  project.is_active === false
                                    ? "secondary"
                                    : "default"
                                }
                                className="rounded-none px-2"
                              >
                                {project.is_active === false ? "Not Active" : "Active"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : (
        <section className="space-y-4">
          <Card className="overflow-hidden border-border/80 bg-card/95 shadow-[0_18px_48px_rgba(18,12,24,0.18)]">
            <CardHeader className="border-b border-border/80">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <Button
                    type="button"
                    variant="ghost"
                    className="mb-3 h-9 rounded-full px-3"
                    onClick={handleBackToList}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to list
                  </Button>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="h-6 rounded-none bg-primary/12 px-2.5 text-[10px] text-primary">
                      {isCreateMode ? "New project" : `Project #${selectedProjectId ?? "-"}`}
                    </Badge>
                    {currentCompleteness ? (
                      <Badge
                        variant={currentCompleteness.is_complete ? "default" : "secondary"}
                        className="h-6 rounded-none px-2.5 text-[10px]"
                      >
                        {currentCompleteness.completeness_percent}% complete
                      </Badge>
                    ) : null}
                  </div>

                  <CardTitle className="mt-3 font-studio text-4xl font-semibold tracking-[-0.04em] text-foreground">
                    {pageTitle}
                  </CardTitle>
                  <CardDescription className="mt-2 max-w-2xl">
                    Review the record across project details, technical details, and notes.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {!isCreateMode && !isEditing ? (
                    <Button
                      type="button"
                      className="rounded-full px-5"
                      onClick={() => setIsEditing(true)}
                      disabled={isOpeningProject}
                    >
                      <PencilLine className="h-4 w-4" />
                      Update
                    </Button>
                  ) : null}

                  {(isCreateMode || isEditing) && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full px-5"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="rounded-full px-5"
                        onClick={() => void handleSaveProject()}
                        disabled={isSaving || (!isCreateMode && !isDirty)}
                      >
                        <Save className="h-4 w-4" />
                        {isSaving ? "Saving" : "Save"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-0 py-0">
              <div className="border-b border-border/80 px-6 pt-4">
                <div
                  className="flex flex-wrap gap-6"
                  role="tablist"
                  aria-label="Project sections"
                >
                  <TabButton
                    isActive={activeTab === "project"}
                    onClick={() => setActiveTab("project")}
                    controlsId="project-details-panel"
                    tabId="project-details-tab"
                  >
                    Project Details
                  </TabButton>
                  <TabButton
                    isActive={activeTab === "technical"}
                    onClick={() => setActiveTab("technical")}
                    controlsId="technical-details-panel"
                    tabId="technical-details-tab"
                  >
                    Technical Details
                  </TabButton>
                  <TabButton
                    isActive={activeTab === "notes"}
                    onClick={() => setActiveTab("notes")}
                    controlsId="notes-panel"
                    tabId="notes-tab"
                  >
                    Notes
                  </TabButton>
                </div>
              </div>

              <div
                id={
                  activeTab === "project"
                    ? "project-details-panel"
                    : activeTab === "technical"
                      ? "technical-details-panel"
                      : "notes-panel"
                }
                role="tabpanel"
                aria-labelledby={
                  activeTab === "project"
                    ? "project-details-tab"
                    : activeTab === "technical"
                      ? "technical-details-tab"
                      : "notes-tab"
                }
                className="px-6 py-6"
              >
                {isOpeningProject ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    Loading project...
                  </div>
                ) : activeTab === "project" ? (
                  <div className="space-y-8 [&_label]:!text-black">
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      <FieldBlock label="Project Name">
                        <Input
                          value={form.project_name}
                          onChange={(event) =>
                            updateForm("project_name", event.target.value)
                          }
                          readOnly={!isFormEditable}
                          className={trackerInputClass}
                        />
                      </FieldBlock>
                      <FieldBlock label="Sub Account Name in GHL">
                        <Input
                          value={form.ghl_sub_account_name}
                          onChange={(event) =>
                            updateForm("ghl_sub_account_name", event.target.value)
                          }
                          readOnly={!isFormEditable}
                          className={trackerInputClass}
                        />
                      </FieldBlock>
                      <FieldBlock label="Project Name in Clockify">
                        <Input
                          value={form.clockify_project_name}
                          onChange={(event) =>
                            updateForm("clockify_project_name", event.target.value)
                          }
                          readOnly={!isFormEditable}
                          className={trackerInputClass}
                        />
                      </FieldBlock>
                      <FieldBlock label="Project Name in Asana">
                        <Input
                          value={form.asana_project_name}
                          onChange={(event) =>
                            updateForm("asana_project_name", event.target.value)
                          }
                          readOnly={!isFormEditable}
                          className={trackerInputClass}
                        />
                      </FieldBlock>
                      <FieldBlock label="Asset Class">
                        <Input
                          value={form.asset_class}
                          onChange={(event) =>
                            updateForm("asset_class", event.target.value)
                          }
                          readOnly={!isFormEditable}
                          className={trackerInputClass}
                        />
                      </FieldBlock>
                      <FieldBlock label="Teams Channel Name">
                        <Input
                          value={form.teams_channel_name}
                          onChange={(event) =>
                            updateForm("teams_channel_name", event.target.value)
                          }
                          readOnly={!isFormEditable}
                          className={trackerInputClass}
                        />
                      </FieldBlock>
                      <FieldBlock label="Fund Raising Start Date">
                        <Input
                          type="date"
                          value={form.fund_raising_start_date}
                          onChange={(event) =>
                            updateForm("fund_raising_start_date", event.target.value)
                          }
                          readOnly={!isFormEditable}
                          onKeyDown={
                            !isFormEditable
                              ? (event) => event.preventDefault()
                              : undefined
                          }
                          className={trackerInputClass}
                        />
                      </FieldBlock>
                      <FieldBlock label="SP Folder">
                        <Input
                          value={form.sp_folder}
                          onChange={(event) =>
                            updateForm("sp_folder", event.target.value)
                          }
                          readOnly={!isFormEditable}
                          className={trackerInputClass}
                        />
                      </FieldBlock>
                      <FieldBlock label="Assigned Account Executive (AE)">
                        <Input
                          value={form.assigned_account_executive}
                          onChange={(event) =>
                            updateForm(
                              "assigned_account_executive",
                              event.target.value,
                            )
                          }
                          readOnly={!isFormEditable}
                          className={trackerInputClass}
                        />
                      </FieldBlock>
                      <FieldBlock label="Assigned PM">
                        <Input
                          value={form.assigned_pm}
                          onChange={(event) =>
                            updateForm("assigned_pm", event.target.value)
                          }
                          readOnly={!isFormEditable}
                          className={trackerInputClass}
                        />
                      </FieldBlock>
                      <FieldBlock label="Assigned SDR">
                        <Input
                          value={form.assigned_sdr}
                          onChange={(event) =>
                            updateForm("assigned_sdr", event.target.value)
                          }
                          readOnly={!isFormEditable}
                          className={trackerInputClass}
                        />
                      </FieldBlock>
                      <FieldBlock label="Principal Point of Contact">
                        <Input
                          value={form.principal_point_of_contact}
                          onChange={(event) =>
                            updateForm(
                              "principal_point_of_contact",
                              event.target.value,
                            )
                          }
                          readOnly={!isFormEditable}
                          className={trackerInputClass}
                        />
                      </FieldBlock>
                      <FieldBlock label="Project Status">
                        {isFormEditable ? (
                          <Select
                            value={form.project_status}
                            onChange={(event) =>
                              updateForm(
                                "project_status",
                                event.target.value as "active" | "inactive",
                              )
                            }
                            className="h-11 rounded-none border-border bg-white text-black shadow-none"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Not Active</option>
                          </Select>
                        ) : (
                          <ReadonlyFieldValue
                            value={
                              form.project_status === "active"
                                ? "Active"
                                : "Not Active"
                            }
                          />
                        )}
                      </FieldBlock>
                    </div>

                    <FieldBlock label="Is Principal EO/YPO Member?" labelClassName="text-black">
                      <label className="inline-flex items-center gap-3 text-sm text-black">
                        <input
                          type="checkbox"
                          checked={form.is_principal_eo_ypo_member}
                          onChange={
                            isFormEditable
                              ? (event) =>
                                  updateForm(
                                    "is_principal_eo_ypo_member",
                                    event.target.checked,
                                  )
                              : undefined
                          }
                          disabled={!isFormEditable}
                          className="h-4 w-4 border-border text-primary focus:ring-ring"
                        />
                        <span>Yes</span>
                      </label>
                    </FieldBlock>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black">
                          Project Type
                        </Label>
                        <p className="mt-2 text-sm text-black/70">
                          Select one or more project types.
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {projectTypeOptions.length === 0 ? (
                          <div className="rounded-none border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                            No project type lookup values found.
                          </div>
                        ) : (
                          projectTypeOptions.map((option) => {
                            const checked = form.project_types.some(
                              (row) => row.kvp_id === option.value,
                            );

                            return (
                              <label
                                key={option.value}
                                className="flex items-center gap-3 rounded-none border border-border/80 bg-background/60 px-4 py-3 text-sm text-black"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={
                                    isFormEditable
                                      ? (event) =>
                                          toggleProjectType(
                                            option.value,
                                            event.target.checked,
                                          )
                                      : undefined
                                  }
                                  disabled={!isFormEditable}
                                  className="h-4 w-4 border-border text-primary opacity-100 focus:ring-ring disabled:cursor-default disabled:opacity-100"
                                />
                                <span>{option.label}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                ) : activeTab === "technical" ? (
                  <div className="space-y-2">
                    <EditableTableSection
                      title="Phone Numbers"
                      description="Track project phone numbers with phone type, agent name, gender, tone, and description."
                      addLabel="Add Phone"
                      disabled={!isFormEditable}
                      onAdd={() => addCollectionRow("phones")}
                    >
                      {form.phones.length === 0 ? (
                        <TableEmptyState text="No phone records added yet." />
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[980px] border-collapse text-sm">
                            <thead className="bg-muted/35 text-left">
                              <tr className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                                <th className="px-2 py-1.5 font-semibold">Type</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">Phone Number</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">Agent Name</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">Gender</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">Tone</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">Description</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {form.phones.map((row) => (
                                <tr key={row.localId} className="border-t border-border/70 align-top">
                                  <td className="px-2 py-1.5">
                                    {isFormEditable ? (
                                      <Select
                                        value={row.phone_type_kvp_id}
                                        onChange={(event) =>
                                          updateCollectionRow("phones", row.localId, {
                                            phone_type_kvp_id: event.target.value,
                                          })
                                        }
                                        className={compactSelectClass}
                                      >
                                        <option value="">Select type</option>
                                        {phoneTypeOptions.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </Select>
                                    ) : (
                                      <ReadonlyFieldValue
                                        value={getLookupLabel(phoneTypeOptions, row.phone_type_kvp_id)}
                                      />
                                    )}
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    <Input
                                      value={row.phone_number}
                                      onChange={(event) =>
                                        updateCollectionRow("phones", row.localId, {
                                          phone_number: event.target.value,
                                        })
                                      }
                                      readOnly={!isFormEditable}
                                      className={compactTrackerInputClass}
                                    />
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    <Input
                                      value={row.agent_name}
                                      onChange={(event) =>
                                        updateCollectionRow("phones", row.localId, {
                                          agent_name: event.target.value,
                                        })
                                      }
                                      readOnly={!isFormEditable}
                                      className={compactTrackerInputClass}
                                    />
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    {isFormEditable ? (
                                      <Select
                                        value={row.agent_gender_kvp_id}
                                        onChange={(event) =>
                                          updateCollectionRow("phones", row.localId, {
                                            agent_gender_kvp_id: event.target.value,
                                          })
                                        }
                                        className={compactSelectClass}
                                      >
                                        <option value="">Select gender</option>
                                        {agentGenderOptions.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </Select>
                                    ) : (
                                      <ReadonlyFieldValue
                                        value={getLookupLabel(agentGenderOptions, row.agent_gender_kvp_id)}
                                      />
                                    )}
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    {isFormEditable ? (
                                      <Select
                                        value={row.agent_tone_kvp_id}
                                        onChange={(event) =>
                                          updateCollectionRow("phones", row.localId, {
                                            agent_tone_kvp_id: event.target.value,
                                          })
                                        }
                                        className={compactSelectClass}
                                      >
                                        <option value="">Select tone</option>
                                        {agentToneOptions.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </Select>
                                    ) : (
                                      <ReadonlyFieldValue
                                        value={getLookupLabel(agentToneOptions, row.agent_tone_kvp_id)}
                                      />
                                    )}
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    <TechnicalTextCell
                                      value={row.description}
                                      placeholder="Open description"
                                      onClick={() =>
                                        openTechnicalTextModal(
                                          "phones",
                                          row.localId,
                                          "description",
                                          "Phone Description",
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    {isFormEditable ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-9 rounded-none px-3 text-sm"
                                        onClick={() =>
                                          removeCollectionRow("phones", row.localId)
                                        }
                                      >
                                        Remove
                                      </Button>
                                    ) : (
                                      <span className="text-sm text-black">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </EditableTableSection>

                    <EditableTableSection
                      title="Domains"
                      description="Store multiple domains with type, name, expiration date, and description."
                      addLabel="Add Domain"
                      disabled={!isFormEditable}
                      onAdd={() => addCollectionRow("domains")}
                    >
                      {form.domains.length === 0 ? (
                        <TableEmptyState text="No domains added yet." />
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[900px] border-collapse text-sm">
                            <thead className="bg-muted/35 text-left">
                              <tr className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                                <th className="px-2 py-1.5 font-semibold">Domain Type</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">
                                  Domain Name
                                </th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">
                                  Expiration Date
                                </th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">
                                  Domain Description
                                </th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">
                                  Action
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {form.domains.map((row) => (
                                <tr key={row.localId} className="border-t border-border/70">
                                  <td className="px-2 py-1.5">
                                    {isFormEditable ? (
                                      <Select
                                        value={row.domain_type_kvp_id}
                                        onChange={(event) =>
                                          updateCollectionRow("domains", row.localId, {
                                            domain_type_kvp_id: event.target.value,
                                          })
                                        }
                                        className={compactSelectClass}
                                      >
                                        <option value="">Select type</option>
                                        {domainTypeOptions.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </Select>
                                    ) : (
                                      <ReadonlyFieldValue
                                        value={getLookupLabel(domainTypeOptions, row.domain_type_kvp_id)}
                                      />
                                    )}
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    <Input
                                      value={row.domain_name}
                                      onChange={(event) =>
                                        updateCollectionRow("domains", row.localId, {
                                          domain_name: event.target.value,
                                        })
                                      }
                                      readOnly={!isFormEditable}
                                      className={compactTrackerInputClass}
                                    />
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    <Input
                                      type="date"
                                      value={row.expiration_date}
                                      onChange={(event) =>
                                        updateCollectionRow("domains", row.localId, {
                                          expiration_date: event.target.value,
                                        })
                                      }
                                      readOnly={!isFormEditable}
                                      onKeyDown={
                                        !isFormEditable
                                          ? (event) => event.preventDefault()
                                          : undefined
                                      }
                                      className={compactTrackerInputClass}
                                    />
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    <TechnicalTextCell
                                      value={row.description}
                                      placeholder="Open description"
                                      onClick={() =>
                                        openTechnicalTextModal(
                                          "domains",
                                          row.localId,
                                          "description",
                                          "Domain Description",
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    {isFormEditable ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-9 rounded-none px-3 text-sm"
                                        onClick={() =>
                                          removeCollectionRow("domains", row.localId)
                                        }
                                      >
                                        Remove
                                      </Button>
                                    ) : (
                                      <span className="text-sm text-black">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </EditableTableSection>

                    <EditableTableSection
                      title="Emails"
                      description="Manage email accounts, provider, password, and other credential notes."
                      addLabel="Add Email"
                      disabled={!isFormEditable}
                      onAdd={() => addCollectionRow("emails")}
                    >
                      {form.emails.length === 0 ? (
                        <TableEmptyState text="No email records added yet." />
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[920px] border-collapse text-sm">
                            <thead className="bg-muted/35 text-left">
                              <tr className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                                <th className="px-2 py-1.5 font-semibold">Email Address</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">Provider</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">Password</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">Other Details</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {form.emails.map((row) => (
                                <tr key={row.localId} className="border-t border-border/70 align-top">
                                  <td className="px-2 py-1.5">
                                    <Input
                                      value={row.email_address}
                                      onChange={(event) =>
                                        updateCollectionRow("emails", row.localId, {
                                          email_address: event.target.value,
                                        })
                                      }
                                      readOnly={!isFormEditable}
                                      className={compactTrackerInputClass}
                                    />
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    {isFormEditable ? (
                                      <Select
                                        value={row.email_provider_kvp_id}
                                        onChange={(event) =>
                                          updateCollectionRow("emails", row.localId, {
                                            email_provider_kvp_id: event.target.value,
                                          })
                                        }
                                        className={compactSelectClass}
                                      >
                                        <option value="">Select provider</option>
                                        {emailProviderOptions.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </Select>
                                    ) : (
                                      <ReadonlyFieldValue
                                        value={getLookupLabel(emailProviderOptions, row.email_provider_kvp_id)}
                                      />
                                    )}
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    <Input
                                      value={row.password}
                                      onChange={(event) =>
                                        updateCollectionRow("emails", row.localId, {
                                          password: event.target.value,
                                        })
                                      }
                                      readOnly={!isFormEditable}
                                      className={compactTrackerInputClass}
                                    />
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    <TechnicalTextCell
                                      value={row.other_details}
                                      placeholder="Open details"
                                      onClick={() =>
                                        openTechnicalTextModal(
                                          "emails",
                                          row.localId,
                                          "other_details",
                                          "Other Details",
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    {isFormEditable ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-9 rounded-none px-3 text-sm"
                                        onClick={() =>
                                          removeCollectionRow("emails", row.localId)
                                        }
                                      >
                                        Remove
                                      </Button>
                                    ) : (
                                      <span className="text-sm text-black">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </EditableTableSection>

                    <EditableTableSection
                      title="Scripts and Documents"
                      description="Use resource types for fundraising scripts, SDR scripts, knowledge base, FAQs, and project documents."
                      addLabel="Add Resource"
                      disabled={!isFormEditable}
                      onAdd={() => addCollectionRow("resources")}
                    >
                      {form.resources.length === 0 ? (
                        <TableEmptyState text="No resources added yet." />
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[940px] border-collapse text-sm">
                            <thead className="bg-muted/35 text-left">
                              <tr className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                                <th className="px-2 py-1.5 font-semibold">Type</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">Name</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">Link</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">Description</th>
                                <th className="border-l border-border/70 px-2 py-1.5 font-semibold">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {form.resources.map((row) => (
                                <tr key={row.localId} className="border-t border-border/70 align-top">
                                  <td className="px-2 py-1.5">
                                    {isFormEditable ? (
                                      <Select
                                        value={row.resource_type_kvp_id}
                                        onChange={(event) =>
                                          updateCollectionRow("resources", row.localId, {
                                            resource_type_kvp_id: event.target.value,
                                          })
                                        }
                                        className={compactSelectClass}
                                      >
                                        <option value="">Select type</option>
                                        {resourceTypeOptions.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </Select>
                                    ) : (
                                      <ReadonlyFieldValue
                                        value={getLookupLabel(resourceTypeOptions, row.resource_type_kvp_id)}
                                      />
                                    )}
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    <Input
                                      value={row.name}
                                      onChange={(event) =>
                                        updateCollectionRow("resources", row.localId, {
                                          name: event.target.value,
                                        })
                                      }
                                      readOnly={!isFormEditable}
                                      className={compactTrackerInputClass}
                                    />
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    <Input
                                      value={row.link}
                                      onChange={(event) =>
                                        updateCollectionRow("resources", row.localId, {
                                          link: event.target.value,
                                        })
                                      }
                                      readOnly={!isFormEditable}
                                      className={compactTrackerInputClass}
                                    />
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    <TechnicalTextCell
                                      value={row.description}
                                      placeholder="Open description"
                                      onClick={() =>
                                        openTechnicalTextModal(
                                          "resources",
                                          row.localId,
                                          "description",
                                          "Resource Description",
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="border-l border-border/70 px-2 py-1.5">
                                    {isFormEditable ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-9 rounded-none px-3 text-sm"
                                        onClick={() =>
                                          removeCollectionRow("resources", row.localId)
                                        }
                                      >
                                        Remove
                                      </Button>
                                    ) : (
                                      <span className="text-sm text-black">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </EditableTableSection>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <Label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black">
                        Notes
                      </Label>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Large rich text note area for project-specific tracker notes.
                      </p>
                    </div>

                    {isFormEditable ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-none px-4"
                            onClick={() => applyNotesCommand("bold")}
                          >
                            Bold
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-none px-4"
                            onClick={() => applyNotesCommand("italic")}
                          >
                            Italic
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-none px-4"
                            onClick={() => applyNotesCommand("underline")}
                          >
                            Underline
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-none px-4"
                            onClick={() => applyNotesCommand("insertUnorderedList")}
                          >
                            Bullets
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-none px-4"
                            onClick={() => applyNotesCommand("insertOrderedList")}
                          >
                            Numbered
                          </Button>
                        </div>

                        <div
                          ref={notesEditorRef}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={(event) =>
                            updateForm(
                              "notes_html",
                              (event.currentTarget as HTMLDivElement).innerHTML,
                            )
                          }
                          className="min-h-[420px] rounded-none border border-border bg-white px-4 py-3 text-sm leading-7 text-black outline-none transition-colors focus:border-primary/40"
                        />
                      </>
                    ) : (
                      <div
                        className="min-h-[420px] rounded-none border border-border bg-white px-4 py-3 text-sm leading-7 text-black"
                        dangerouslySetInnerHTML={{
                          __html: form.notes_html.trim() || "<p>-</p>",
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
      {activeTechnicalTextModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(18,12,24,0.68)] px-4 py-6"
          onClick={() => setActiveTechnicalTextModal(null)}
        >
          <div
            className="w-full max-w-3xl rounded-none border border-border bg-card p-5 shadow-[0_28px_80px_rgba(18,12,24,0.42)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-studio text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  {activeTechnicalTextModal.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {isFormEditable
                    ? "Review or update the full text here."
                    : "Full text preview."}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="rounded-none px-4"
                onClick={() => setActiveTechnicalTextModal(null)}
              >
                Close
              </Button>
            </div>

            <div className="mt-5">
              <textarea
                autoFocus
                wrap="soft"
                spellCheck={false}
                value={activeTechnicalTextValue}
                onChange={(event) => {
                  if (!activeTechnicalTextModal || !isFormEditable) {
                    return;
                  }

                  if (activeTechnicalTextModal.section === "emails") {
                    updateCollectionRow(
                      "emails",
                      activeTechnicalTextModal.localId,
                      {
                        other_details: event.target.value,
                      },
                    );
                    return;
                  }

                  updateCollectionRow(
                    activeTechnicalTextModal.section,
                    activeTechnicalTextModal.localId,
                    {
                      description: event.target.value,
                    },
                  );
                }}
                readOnly={!isFormEditable}
                rows={12}
                placeholder="Add details"
                className="min-h-[280px] w-full resize-none overflow-x-hidden rounded-none border border-border bg-white px-4 py-3 text-sm leading-6 text-black outline-none transition-colors placeholder:text-muted-foreground [overflow-wrap:anywhere] [word-break:break-word] focus:border-primary/40 read-only:opacity-100"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TabButton({
  children,
  isActive,
  onClick,
  tabId,
  controlsId,
}: {
  children: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  tabId: string;
  controlsId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      id={tabId}
      role="tab"
      aria-selected={isActive}
      aria-controls={controlsId}
      className={cn(
        "border-b-2 px-0 pb-3 text-sm font-semibold transition-colors",
        isActive
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FieldBlock({
  label,
  className,
  labelClassName,
  children,
}: {
  label: string;
  className?: string;
  labelClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.24em] text-primary",
          labelClassName,
        )}
      >
        {label}
      </Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EditableTableSection({
  title,
  description,
  addLabel,
  disabled,
  onAdd,
  children,
}: {
  title: string;
  description: string;
  addLabel: string;
  disabled: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-none border-border/80 bg-card/60 shadow-none">
      <CardHeader className="border-b border-border/80 px-3 py-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold leading-none text-foreground">
              {title}
            </CardTitle>
            <CardDescription className="mt-1 text-sm leading-5">{description}</CardDescription>
          </div>
          {!disabled ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-none px-4 text-xs uppercase tracking-[0.18em]"
              onClick={onAdd}
            >
              <Plus className="h-3.5 w-3.5" />
              {addLabel}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

function ReadonlyFieldValue({ value }: { value: string }) {
  return (
    <div className="flex h-10 min-h-[40px] items-center rounded-none border border-border bg-white px-3 py-2 text-sm text-black">
      {value.trim() || "-"}
    </div>
  );
}

function TechnicalTextCell({
  value,
  placeholder,
  onClick,
}: {
  value: string;
  placeholder: string;
  onClick: () => void;
}) {
  const hasValue = value.trim().length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center rounded-none border border-border bg-white px-3 py-2 text-left text-sm text-black shadow-none transition-colors hover:border-primary/40"
    >
      <span
        className={cn(
          "block w-full truncate",
          !hasValue && "text-muted-foreground",
        )}
      >
        {hasValue ? getLongTextPreview(value) : placeholder}
      </span>
    </button>
  );
}

function TableEmptyState({ text }: { text: string }) {
  return (
    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-md flex-col items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-none bg-primary/10 text-primary">
          <FolderKanban className="h-5 w-5" />
        </span>
        <p>{text}</p>
      </div>
    </div>
  );
}

function PageAlert({
  tone,
  text,
}: {
  tone: "success" | "warning";
  text: string;
}) {
  return (
    <section
      className={cn(
        "border px-4 py-3 text-sm",
        tone === "success"
          ? "border-primary/20 bg-primary/8 text-foreground"
          : "border-[rgba(240,119,93,0.20)] bg-[rgba(240,119,93,0.08)] text-accent",
      )}
    >
      <div className="flex gap-3">
        {tone === "success" ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        ) : (
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
        )}
        <p className="font-semibold">{text}</p>
      </div>
    </section>
  );
}

async function callProjectApi<TData>({
  url,
  body,
}: {
  url: string;
  body: Record<string, unknown>;
}) {
  const response = await postJson<ProjectApiResponse<TData>, typeof body>(url, body);

  if (!response.success) {
    throw new Error(response.error || response.message || "Project request failed.");
  }

  return response.data;
}

function toFormState(project: ProjectRecord): ProjectFormState {
  return {
    project_name: project.project_name ?? "",
    project_status: project.is_active === false ? "inactive" : "active",
    ghl_sub_account_name: project.ghl_sub_account_name ?? "",
    clockify_project_name: project.clockify_project_name ?? "",
    asana_project_name: project.asana_project_name ?? "",
    asset_class: project.asset_class ?? "",
    teams_channel_name: project.teams_channel_name ?? "",
    fund_raising_start_date: toDateInputValue(project.fund_raising_start_date),
    sp_folder: project.sp_folder ?? "",
    assigned_account_executive: project.assigned_account_executive ?? "",
    assigned_pm: project.assigned_pm ?? "",
    assigned_sdr: project.assigned_sdr ?? "",
    principal_point_of_contact: project.principal_point_of_contact ?? "",
    is_principal_eo_ypo_member: Boolean(project.is_principal_eo_ypo_member),
    project_types: (project.project_types ?? []).map((row) => ({
      localId: createLocalId("project-type"),
      project_type_id: row.project_type_id,
      kvp_id: String(row.kvp_id),
    })),
    domains: (project.domains ?? []).map((row) => ({
      localId: createLocalId("domain"),
      domain_id: row.domain_id,
      domain_type_kvp_id: row.domain_type_kvp_id
        ? String(row.domain_type_kvp_id)
        : "",
      domain_name: row.domain_name ?? "",
      expiration_date: toDateInputValue(row.expiration_date),
      description: row.description ?? "",
    })),
    emails: (project.emails ?? []).map((row) => ({
      localId: createLocalId("email"),
      email_id: row.email_id,
      email_address: row.email_address ?? "",
      email_provider_kvp_id: row.email_provider_kvp_id
        ? String(row.email_provider_kvp_id)
        : "",
      password: row.password ?? "",
      other_details: row.other_details ?? "",
    })),
    phones: (project.phones ?? []).map((row) => ({
      localId: createLocalId("phone"),
      phone_id: row.phone_id,
      phone_type_kvp_id: row.phone_type_kvp_id ? String(row.phone_type_kvp_id) : "",
      phone_number: row.phone_number ?? "",
      agent_name: row.agent_name ?? "",
      agent_gender_kvp_id: row.agent_gender_kvp_id
        ? String(row.agent_gender_kvp_id)
        : "",
      agent_tone_kvp_id: row.agent_tone_kvp_id ? String(row.agent_tone_kvp_id) : "",
      description: row.description ?? "",
    })),
    resources: (project.resources ?? []).map((row) => ({
      localId: createLocalId("resource"),
      resource_id: row.resource_id,
      resource_type_kvp_id: row.resource_type_kvp_id
        ? String(row.resource_type_kvp_id)
        : "",
      name: row.name ?? "",
      link: row.link ?? "",
      description: row.description ?? "",
    })),
    notes_html: project.notes_html ?? "",
  };
}

function serializeProjectPayload(form: ProjectFormState) {
  return {
    project_name: form.project_name.trim(),
    is_active: form.project_status === "active",
    notes_html: form.notes_html.trim() || null,
    ghl_sub_account_name: toNullableString(form.ghl_sub_account_name),
    clockify_project_name: toNullableString(form.clockify_project_name),
    asana_project_name: toNullableString(form.asana_project_name),
    asset_class: toNullableString(form.asset_class),
    teams_channel_name: toNullableString(form.teams_channel_name),
    fund_raising_start_date: toNullableString(form.fund_raising_start_date),
    sp_folder: toNullableString(form.sp_folder),
    assigned_account_executive: toNullableString(form.assigned_account_executive),
    assigned_pm: toNullableString(form.assigned_pm),
    assigned_sdr: toNullableString(form.assigned_sdr),
    principal_point_of_contact: toNullableString(form.principal_point_of_contact),
    is_principal_eo_ypo_member: form.is_principal_eo_ypo_member,
  };
}

function serializeForm(form: ProjectFormState) {
  return JSON.stringify({
    ...serializeProjectPayload(form),
    project_status: form.project_status,
    notes_html: form.notes_html,
    project_types: form.project_types
      .map((row) => ({
        project_type_id: row.project_type_id ?? null,
        kvp_id: row.kvp_id,
      }))
      .sort((left, right) => left.kvp_id.localeCompare(right.kvp_id)),
    domains: form.domains.map((row) => ({
      domain_id: row.domain_id ?? null,
      domain_type_kvp_id: row.domain_type_kvp_id,
      domain_name: row.domain_name,
      expiration_date: row.expiration_date,
      description: row.description,
    })),
    emails: form.emails.map((row) => ({
      email_id: row.email_id ?? null,
      email_address: row.email_address,
      email_provider_kvp_id: row.email_provider_kvp_id,
      password: row.password,
      other_details: row.other_details,
    })),
    phones: form.phones.map((row) => ({
      phone_id: row.phone_id ?? null,
      phone_type_kvp_id: row.phone_type_kvp_id,
      phone_number: row.phone_number,
      agent_name: row.agent_name,
      agent_gender_kvp_id: row.agent_gender_kvp_id,
      agent_tone_kvp_id: row.agent_tone_kvp_id,
      description: row.description,
    })),
    resources: form.resources.map((row) => ({
      resource_id: row.resource_id ?? null,
      resource_type_kvp_id: row.resource_type_kvp_id,
      name: row.name,
      link: row.link,
      description: row.description,
    })),
  });
}

function getLookupOptions(lookups: KvpRecord[], group: string) {
  return lookups
    .filter((item) => item.kvp_group === group && item.is_active !== false)
    .sort((left, right) => {
      const leftOrder = left.sort_order ?? 0;
      const rightOrder = right.sort_order ?? 0;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.kvp_value.localeCompare(right.kvp_value);
    })
    .map((item) => ({
      value: String(item.kvp_id),
      label: item.kvp_value,
    }));
}

function getLookupLabel(
  options: Array<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? "";
}

function getTechnicalTextValue(
  form: ProjectFormState,
  modal: TechnicalTextModalState,
) {
  if (modal.section === "emails") {
    const row = form.emails.find((item) => item.localId === modal.localId);
    return row?.other_details ?? "";
  }

  if (modal.section === "domains") {
    const row = form.domains.find((item) => item.localId === modal.localId);
    return row?.description ?? "";
  }

  if (modal.section === "phones") {
    const row = form.phones.find((item) => item.localId === modal.localId);
    return row?.description ?? "";
  }

  const row = form.resources.find((item) => item.localId === modal.localId);
  return row?.description ?? "";
}

function getLongTextPreview(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  return normalized.length > 48
    ? `${normalized.slice(0, 48).trimEnd()}...`
    : normalized;
}

function createEmptyDomainRow(): DomainFormRow {
  return {
    localId: createLocalId("domain"),
    domain_type_kvp_id: "",
    domain_name: "",
    expiration_date: "",
    description: "",
  };
}

function createEmptyEmailRow(): EmailFormRow {
  return {
    localId: createLocalId("email"),
    email_address: "",
    email_provider_kvp_id: "",
    password: "",
    other_details: "",
  };
}

function createEmptyPhoneRow(): PhoneFormRow {
  return {
    localId: createLocalId("phone"),
    phone_type_kvp_id: "",
    phone_number: "",
    agent_name: "",
    agent_gender_kvp_id: "",
    agent_tone_kvp_id: "",
    description: "",
  };
}

function createEmptyResourceRow(): ResourceFormRow {
  return {
    localId: createLocalId("resource"),
    resource_type_kvp_id: "",
    name: "",
    link: "",
    description: "",
  };
}

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toOptionalNumber(value: string) {
  return value.trim() ? Number(value) : null;
}

function toNullableString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const normalized = String(value);
  return normalized.length >= 10 ? normalized.slice(0, 10) : normalized;
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

  return "Unexpected project error.";
}
