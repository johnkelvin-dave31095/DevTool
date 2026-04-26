import json
import os
import ssl
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import pg8000.dbapi as pg8000


ASANA_API_BASE_URL = "https://app.asana.com/api/1.0"
OPT_FIELDS = ",".join(
    [
        "gid",
        "projects.name",
        "memberships.section.name",
        "created_at",
        "completed_at",
        "notes",
    ]
)


def lambda_handler(event, _context):
    try:
        if http_method(event) == "OPTIONS":
            return json_response(200, {"message": "ok"})

        body = parse_body(event)
        email = required(body, "email")
        workspace_gid = required_env("ASANA_WORKSPACE_GID")
        timezone_name = os.environ.get("DEFAULT_TIMEZONE", "UTC")
        start, end = get_date_range(body, timezone_name)
        limit = int(body.get("limit") or 100)
        max_pages = int(body.get("maxPages") or 10)

        access_token = get_asana_api_key(email)
        tasks = fetch_completed_tasks(
            access_token=access_token,
            workspace_gid=workspace_gid,
            assignee=email,
            start=start,
            end=end,
            limit=max(1, min(limit, 100)),
            max_pages=max(1, min(max_pages, 50)),
        )

        return json_response(200, {"count": len(tasks), "tasks": tasks})

    except ValueError as exc:
        return json_response(400, {"message": str(exc)})
    except Exception as exc:
        return json_response(500, {"message": str(exc)})


def http_method(event):
    return (
        str(event.get("requestContext", {}).get("http", {}).get("method") or "")
        or str(event.get("httpMethod") or "")
        or "POST"
    ).upper()


def parse_body(event):
    body = event.get("body")
    if body is None:
        return event if isinstance(event, dict) else {}
    if isinstance(body, dict):
        return body
    if not isinstance(body, str) or not body.strip():
        return {}
    return json.loads(body)


def required(data, key):
    value = str(data.get(key) or "").strip()
    if not value:
        raise ValueError(f"Missing {key}.")
    return value


def required_env(name):
    value = os.environ.get(name)
    if not value:
        raise ValueError(f"Missing environment variable: {name}")
    return value


def get_date_range(body, timezone_name):
    tz = ZoneInfo(timezone_name)
    now = datetime.now(tz)
    start_text = body.get("start") or now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    end_text = body.get("end") or (now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat()
    start = parse_datetime(start_text, tz)
    end = parse_datetime(end_text, tz)
    if end <= start:
        raise ValueError("end must be later than start.")
    return start, end


def parse_datetime(value, fallback_tz):
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=fallback_tz)


def get_asana_api_key(email):
    query = """
        SELECT a.asana_api_key
        FROM user_integrations a
        INNER JOIN users b ON b.id = a.id
        WHERE LOWER(b.email) = LOWER(%s)
          AND a.asana_api_key IS NOT NULL
          AND a.asana_api_key <> ''
        LIMIT 1
    """
    row = fetch_one(query, (email,))
    if not row or not str(row[0]).strip():
        raise ValueError("No Asana API key found for the provided email.")
    return str(row[0]).strip()


def fetch_one(query, params):
    conn = cursor = None
    try:
        conn = pg8000.connect(
            host=required_env("DB_HOST"),
            database=required_env("DB_NAME"),
            user=required_env("DB_USER"),
            password=required_env("DB_PASSWORD"),
            port=int(os.environ.get("DB_PORT", "5432")),
            timeout=10,
            ssl_context=ssl.create_default_context(),
        )
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor.fetchone()
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def fetch_completed_tasks(access_token, workspace_gid, assignee, start, end, limit, max_pages):
    tasks = []
    after = start
    seen = set()

    for _ in range(max_pages):
        page = search_page(access_token, workspace_gid, assignee, after, end, limit)
        if not page:
            break

        for task in page:
            gid = task.get("gid")
            if gid and gid not in seen:
                seen.add(gid)
                tasks.append(normalize_task(task))

        if len(page) < limit or not page[-1].get("completed_at"):
            break

        next_after = parse_datetime(page[-1]["completed_at"], ZoneInfo("UTC"))
        if next_after <= after:
            break
        after = next_after

    return tasks


def search_page(access_token, workspace_gid, assignee, start, end, limit):
    query = urlencode(
        {
            "completed": "true",
            "assignee.any": assignee,
            "completed_at.after": to_utc_iso(start),
            "completed_at.before": to_utc_iso(end),
            "sort_by": "completed_at",
            "sort_ascending": "true",
            "limit": str(limit),
            "opt_fields": OPT_FIELDS,
        }
    )
    url = f"{ASANA_API_BASE_URL}/workspaces/{workspace_gid}/tasks/search?{query}"
    return asana_request(url, access_token).get("data", [])


def normalize_task(task):
    sections = []
    for membership in task.get("memberships") or []:
        name = (membership.get("section") or {}).get("name")
        if name and name not in sections:
            sections.append(name)

    return {
        "projects": [p["name"] for p in (task.get("projects") or []) if p.get("name")],
        "section": sections,
        "ticket_date_creation": task.get("created_at"),
        "ticket_date_done": task.get("completed_at"),
        "description": task.get("notes") or "",
    }


def asana_request(url, access_token):
    request = Request(
        url,
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        method="GET",
    )
    try:
        with urlopen(request, timeout=30) as result:
            return json.loads(result.read().decode("utf-8") or "{}")
    except HTTPError as exc:
        body = exc.read().decode("utf-8")
        raise ValueError(body or f"Asana request failed with status {exc.code}") from exc
    except URLError as exc:
        raise ValueError(f"Could not reach Asana: {exc}") from exc


def to_utc_iso(value):
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def json_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "*"),
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Content-Type": "application/json",
        },
        "body": json.dumps(body),
    }
