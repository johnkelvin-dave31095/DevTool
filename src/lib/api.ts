export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "https://oa8qtpoae1.execute-api.us-east-1.amazonaws.com/prod";

export const OUTLOOK_EVENTS_URL = `${API_BASE_URL}/DevTools/OutlookCalendar`;
export const CLOCKIFY_SYNC_URL = `${API_BASE_URL}/DevTools/Clockify`;
export const ASANA_TICKETS_URL = `${API_BASE_URL}/DevTools/Asana`;
export const PROJECTS_CRUD_URL = `${API_BASE_URL}/projects/crud`;
export const PROJECTS_LOOKUP_URL = `${API_BASE_URL}/projects/lookup`;
export const PROJECTS_COMPLETENESS_URL = `${API_BASE_URL}/projects/completeness`;
export const INTEGRATION_SETUP_URL =
  import.meta.env.VITE_SETUP_URL ?? `${API_BASE_URL}/DevTools/AccountSetup`;

export type OutlookEvent = {
  outlookEventId?: string;
  title: string;
  notes: string;
  start: string;
  end: string;
  hours: number;
  billable: boolean;
  isAllDay?: boolean;
  source?: string;
  webLink?: string;
};

export type OutlookEventsResponse = {
  range: {
    start: string;
    end: string;
    timezone: string;
  };
  count: number;
  events: OutlookEvent[];
};

export type ClockifySyncResponse = {
  action?: string;
  createdCount: number;
  skippedCount: number;
  created: Array<{
    title: string;
    projectId?: string;
    projectName?: string;
    taskId?: string;
    taskName?: string;
    timeEntryId?: string;
    start: string;
    end: string;
    billable: boolean;
  }>;
  skipped: Array<{
    title?: string;
    projectName?: string;
    taskName?: string;
    start?: string;
    end?: string;
    error: string;
    details?: unknown;
  }>;
};

export type ClockifyTask = {
  taskId: string;
  taskName: string;
  status?: string;
  billable?: boolean;
  assigneeId?: string;
  assigneeIds?: string[];
};

export type ClockifyProject = {
  projectId: string;
  projectName: string;
  clientId?: string;
  billable?: boolean;
  archived?: boolean;
  public?: boolean;
  taskCount: number;
  tasks: ClockifyTask[];
};

export type ClockifyListResponse = {
  action: "list";
  workspaceId: string;
  projectCount: number;
  taskCount: number;
  includeArchived: boolean;
  onlyActiveTasks: boolean;
  projects: ClockifyProject[];
};

export type SetupStatusResponse = {
  action: "status";
  configured: boolean;
  userId?: string;
  email?: string;
  hasClockifyApiKey?: boolean;
  clockifyWorkspaceId?: string | null;
};

export type SetupSaveResponse = {
  action: "save";
  saved: boolean;
  userId?: string;
  email?: string;
  hasClockifyApiKey?: boolean;
  clockifyWorkspaceId?: string | null;
};

export type LoginResponse = {
  action: "login";
  authenticated: boolean;
  userId?: string;
  email?: string;
  configured: boolean;
  hasClockifyApiKey?: boolean;
  clockifyWorkspaceId?: string | null;
};

export type ChangePasswordResponse = {
  action: "changePassword";
  changed: boolean;
  userId?: string;
  email?: string;
};

export type OutlookMappingRule = {
  id: string;
  userId?: string | null;
  scope: "shared" | "user";
  matchType: "exact_title" | "contains_title";
  matchValue: string;
  projectName: string;
  taskName: string;
  descriptionTemplate?: string | null;
  isActive: boolean;
  priority: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type MappingListResponse = {
  action: "listMappings";
  userId?: string;
  email?: string;
  count: number;
  rules: OutlookMappingRule[];
};

export type MappingSaveResponse = {
  action: "saveMapping";
  saved: boolean;
  rule: OutlookMappingRule;
};

export type MappingDeleteResponse = {
  action: "deleteMapping";
  deleted: boolean;
  ruleId: string;
};

export type AsanaTaskSummary = {
  title?: string;
  projects: string[];
  section?: string[];
  ticket_link?: string;
  ticket_date_creation: string | null;
  ticket_date_done: string | null;
  description: string;
};

export type AsanaTicketsResponse = {
  count: number;
  tasks: AsanaTaskSummary[];
};

export type ProjectApiResponse<TData> = {
  success: boolean;
  action: string;
  data: TData;
  error?: string;
  message?: string;
};

export async function postJson<TResponse, TBody>(
  url: string,
  body: TBody,
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.message ??
      data?.error ??
      `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, data);
  }

  return data as TResponse;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: unknown,
  ) {
    super(message);
  }
}
