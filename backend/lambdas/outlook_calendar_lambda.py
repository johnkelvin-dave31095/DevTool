import json
import os
import re
from datetime import datetime, timedelta, timezone
from html import unescape
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
TOKEN_URL_TEMPLATE = "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"


def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    try:
        settings = get_settings()
        params = event.get("queryStringParameters") or {}
        start, end = get_date_range(params, settings["timezone"])
        calendar_id = params.get("calendarId") or os.environ.get("OUTLOOK_CALENDAR_ID")

        access_token = get_access_token(
            tenant_id=settings["tenant_id"],
            client_id=settings["client_id"],
            client_secret=settings["client_secret"],
        )

        raw_events = get_calendar_events(
            access_token=access_token,
            user_id=settings["user_id"],
            start=start,
            end=end,
            timezone_name=settings["timezone"],
            calendar_id=calendar_id,
        )

        formatted_events = [
            format_event(raw_event, settings["timezone"])
            for raw_event in raw_events
            if should_include_event(raw_event)
        ]

        return response(
            200,
            {
                "range": {
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                    "timezone": settings["timezone"],
                },
                "count": len(formatted_events),
                "events": formatted_events,
            },
        )
    except ConfigError as exc:
        return response(500, {"message": str(exc)})
    except GraphError as exc:
        return response(exc.status_code, {"message": exc.message, "details": exc.details})
    except Exception as exc:
        return response(500, {"message": "Unexpected Outlook sync error.", "details": str(exc)})


def get_settings() -> dict[str, str]:
    required = {
        "tenant_id": "MS_TENANT_ID",
        "client_id": "MS_CLIENT_ID",
        "client_secret": "MS_CLIENT_SECRET",
        "user_id": "OUTLOOK_USER_ID",
    }
    values = {key: os.environ.get(env_name) for key, env_name in required.items()}
    missing = [required[key] for key, value in values.items() if not value]

    if missing:
        raise ConfigError(f"Missing required environment variables: {', '.join(missing)}")

    values["timezone"] = os.environ.get("DEFAULT_TIMEZONE", "UTC")
    return values  # type: ignore[return-value]


def get_date_range(
    params: dict[str, str],
    timezone_name: str,
) -> tuple[datetime, datetime]:
    local_tz = ZoneInfo(timezone_name)
    now = datetime.now(local_tz)
    default_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    default_end = default_start + timedelta(days=1)

    start = parse_datetime(params.get("start"), local_tz) if params.get("start") else default_start
    end = parse_datetime(params.get("end"), local_tz) if params.get("end") else default_end

    if end <= start:
        raise ConfigError("The end query parameter must be later than start.")

    return start, end


def parse_datetime(value: str, fallback_tz: ZoneInfo) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=fallback_tz)

    return parsed


def get_access_token(tenant_id: str, client_id: str, client_secret: str) -> str:
    token_url = TOKEN_URL_TEMPLATE.format(tenant_id=tenant_id)
    payload = urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }
    ).encode("utf-8")

    data = request_json(
        token_url,
        method="POST",
        body=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    access_token = data.get("access_token")
    if not access_token:
        raise GraphError(502, "Microsoft token response did not include an access token.", data)

    return access_token


def get_calendar_events(
    access_token: str,
    user_id: str,
    start: datetime,
    end: datetime,
    timezone_name: str,
    calendar_id: str | None,
) -> list[dict[str, Any]]:
    if calendar_id:
        path = f"/users/{user_id}/calendars/{calendar_id}/calendarView"
    else:
        path = f"/users/{user_id}/calendarView"

    query = urlencode(
        {
            "startDateTime": start.isoformat(),
            "endDateTime": end.isoformat(),
            "$select": "id,subject,body,bodyPreview,start,end,isCancelled,isAllDay,webLink",
            "$orderby": "start/dateTime",
            "$top": "100",
        }
    )
    url = f"{GRAPH_BASE_URL}{path}?{query}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Prefer": f'outlook.timezone="{timezone_name}"',
    }

    events: list[dict[str, Any]] = []
    while url:
        data = request_json(url, method="GET", headers=headers)
        events.extend(data.get("value", []))
        url = data.get("@odata.nextLink")

    return events


def should_include_event(raw_event: dict[str, Any]) -> bool:
    if raw_event.get("isCancelled"):
        return False

    subject = (raw_event.get("subject") or "").strip()
    return bool(subject)


def format_event(raw_event: dict[str, Any], fallback_timezone: str) -> dict[str, Any]:
    start = parse_graph_datetime(raw_event["start"], fallback_timezone)
    end = parse_graph_datetime(raw_event["end"], fallback_timezone)
    notes = clean_body(raw_event.get("body", {}).get("content") or raw_event.get("bodyPreview") or "")
    duration_hours = round((end - start).total_seconds() / 3600, 2)

    return {
        "outlookEventId": raw_event["id"],
        "title": raw_event.get("subject", "").strip(),
        "notes": notes,
        "start": start.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "end": end.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "hours": duration_hours,
        "billable": True,
        "isAllDay": bool(raw_event.get("isAllDay")),
        "source": "outlook",
        "webLink": raw_event.get("webLink"),
    }


def parse_graph_datetime(value: dict[str, str], fallback_timezone: str) -> datetime:
    timezone_name = value.get("timeZone") or fallback_timezone
    date_time = value["dateTime"].replace("Z", "+00:00")
    parsed = datetime.fromisoformat(date_time)

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=ZoneInfo(timezone_name))

    return parsed


def clean_body(value: str) -> str:
    without_tags = re.sub(r"<[^>]+>", " ", value)
    without_entities = unescape(without_tags)
    return re.sub(r"\s+", " ", without_entities).strip()


def request_json(
    url: str,
    method: str,
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
) -> dict[str, Any]:
    request = Request(url=url, method=method, headers=headers or {}, data=body)

    try:
        with urlopen(request, timeout=30) as result:
            raw_body = result.read().decode("utf-8")
            return json.loads(raw_body) if raw_body else {}
    except HTTPError as exc:
        raw_error = exc.read().decode("utf-8")
        details = parse_error_body(raw_error)
        message = details.get("error_description") or details.get("error", {}).get("message")
        raise GraphError(exc.code, message or "Microsoft Graph request failed.", details) from exc
    except URLError as exc:
        raise GraphError(502, "Could not reach Microsoft Graph.", str(exc)) from exc


def parse_error_body(raw_error: str) -> Any:
    try:
        return json.loads(raw_error)
    except json.JSONDecodeError:
        return raw_error


def response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "*"),
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
            "Content-Type": "application/json",
        },
        "body": json.dumps(body),
    }


class ConfigError(Exception):
    pass


class GraphError(Exception):
    def __init__(self, status_code: int, message: str, details: Any = None):
        self.status_code = status_code
        self.message = message
        self.details = details
        super().__init__(message)
