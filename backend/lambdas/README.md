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
