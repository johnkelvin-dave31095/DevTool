# Outlook Calendar Lambda

This Lambda reads Outlook calendar events and returns them in the shape the Clockify Lambda can insert later.

## Runtime

Python 3.12. No external dependencies are required.

## Handler

```txt
backend/lambdas/outlook_calendar_lambda.lambda_handler
```

If you upload only the Python file to Lambda, use:

```txt
outlook_calendar_lambda.lambda_handler
```

## Environment Variables

```txt
MS_TENANT_ID=your Microsoft Entra tenant ID
MS_CLIENT_ID=your app registration client ID
MS_CLIENT_SECRET=your app registration client secret
OUTLOOK_USER_ID=user@company.com
DEFAULT_TIMEZONE=Asia/Manila
ALLOWED_ORIGIN=http://127.0.0.1:5174
```

Optional:

```txt
OUTLOOK_CALENDAR_ID=calendar id
```

## Microsoft Graph Permission

For client credentials, the app registration needs Microsoft Graph application permission:

```txt
Calendars.Read
```

Grant admin consent after adding the permission.

## Query Parameters

```txt
GET /outlook/events
GET /outlook/events?start=2026-04-21T00:00:00+08:00&end=2026-04-22T00:00:00+08:00
GET /outlook/events?calendarId={calendar-id}
```

If `start` and `end` are not supplied, the Lambda reads the current day in `DEFAULT_TIMEZONE`.

## Response Shape

```json
{
  "range": {
    "start": "2026-04-21T00:00:00+08:00",
    "end": "2026-04-22T00:00:00+08:00",
    "timezone": "Asia/Manila"
  },
  "count": 1,
  "events": [
    {
      "outlookEventId": "AAMk...",
      "title": "Project Alpha",
      "notes": "Work notes from the Outlook event body.",
      "start": "2026-04-21T01:00:00Z",
      "end": "2026-04-21T03:00:00Z",
      "hours": 2,
      "billable": true,
      "isAllDay": false,
      "source": "outlook",
      "webLink": "https://outlook.office.com/calendar/item/..."
    }
  ]
}
```

For the Clockify Lambda:

- `title` maps to the Clockify project name.
- `notes` maps to the Clockify description.
- `start` and `end` map to the Clockify time interval.
- `billable` should stay `true`.

---

# Asana Tasks Lambda

This Lambda reads completed Asana tasks for a timeframe and can filter by assignee, including an email address.

## Runtime

Python 3.12. No external dependencies are required.

## Handler

```txt
backend/lambdas/asana_tasks_lambda.lambda_handler
```

If you upload only the Python file to Lambda, use:

```txt
asana_tasks_lambda.lambda_handler
```

## Environment Variables

```txt
ASANA_WORKSPACE_GID=your workspace gid
DEFAULT_TIMEZONE=Asia/Manila
ALLOWED_ORIGIN=http://127.0.0.1:5174
```

Use one of these credential options:

```txt
ASANA_ACCESS_TOKEN=your Asana personal access token
```

or

```txt
DATABASE_URL=postgres connection string
```

`ASANA_PAT` is also accepted as an alternative to `ASANA_ACCESS_TOKEN`.

## Query Parameters

```txt
GET /asana/tasks
GET /asana/tasks?start=2026-04-01T00:00:00+08:00&end=2026-04-30T23:59:59+08:00
GET /asana/tasks?assignee=me
GET /asana/tasks?assignee=user@company.com
GET /asana/tasks?userId=123
GET /asana/tasks?userIntegrationId=456
GET /asana/tasks?projectId=1200000000000001
GET /asana/tasks?hydrate=true
```

Notes:

- `assignee` can be `me`, a user gid, or an email address.
- If you use `DATABASE_URL`, the Lambda loads the token from `user_integrations.asana_api_key`.
- Database-backed lookup accepts either `userIntegrationId` or `userId`.
- `hydrate=true` fetches each task again through `GET /tasks/{gid}` after the search result, which is slower but useful if you want the per-task response shape.
- The Lambda uses Asana's Premium search endpoint, so the workspace or calling user must have Premium access.

## Response Shape

```json
{
  "range": {
    "start": "2026-03-31T16:00:00Z",
    "end": "2026-04-30T15:59:59Z",
    "timezone": "Asia/Manila"
  },
  "filters": {
    "assignee": "user@company.com",
    "projectId": null,
    "sectionId": null,
    "text": null,
    "hydrate": false,
    "limit": 100,
    "maxPages": 10
  },
  "count": 1,
  "tasks": [
    {
      "gid": "1211568351507662",
      "name": "Phase 1: Set up Affiliate Partner Web Portal",
      "completed": true,
      "completed_at": "2026-04-26T17:14:34.000Z",
      "notes": "Task notes",
      "permalink_url": "https://app.asana.com/0/0/1211568351507662/f",
      "assignee": {
        "gid": "1200000000000001",
        "name": "Sample User",
        "email": "user@company.com"
      }
    }
  ],
  "warnings": []
}
```
