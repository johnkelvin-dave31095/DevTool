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
SPLIT_TIMEZONE = "Asia/Manila"
SPLIT_START_TIME = "08:00:00"
SPLIT_PROJECTS = [
    "Zenith Group",
    "OT Project Notaroo FI/ FR",
    "OT Project Nirman Ventures FR",
    "OT Project Lotus Domaine Fund 3 genAI",
    "OT Project FR - Pillar Fund",
    "OT Project CnV FR",
    "OT Project Astera Technologies FR",
    "OT Project Analytix Solutions FI/ FR",
]
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
        action = str(body.get("action") or "").strip()

        if action == "listSplitProjects":
            return json_response(
                200,
                {
                    "action": "listSplitProjects",
                    "projects": [
                        {"id": slugify_project_name(name), "name": name}
                        for name in SPLIT_PROJECTS
                    ],
                },
            )

        if action == "planSplit":
            return handle_plan_split(body)

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


def handle_plan_split(body):
    description = required(body, "description")
    total_hours = parse_positive_hours(body.get("totalHours"))
    work_date = required(body, "workDate")
    timezone_name = resolve_split_timezone(body.get("timezone"))
    clients = parse_clients(body.get("clients"))
    anchor_start = parse_anchor_start(work_date, timezone_name)
    anchor_end = anchor_start + timedelta(hours=total_hours)

    if anchor_end.date() != anchor_start.date():
        raise ValueError("totalHours must stay within the selected Manila work day.")

    return json_response(
        200,
        {
            "action": "planSplit",
            "totalHours": total_hours,
            "clientCount": len(clients),
            "splitHours": round(total_hours / len(clients), 4),
            "anchorStart": anchor_start.isoformat(),
            "anchorEnd": anchor_end.isoformat(),
            "entries": build_split_entries(
                description=description,
                total_hours=total_hours,
                clients=clients,
                anchor_start=anchor_start,
            ),
        },
    )


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


def parse_positive_hours(value):
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("totalHours must be a positive number.") from exc

    if parsed <= 0:
        raise ValueError("totalHours must be greater than zero.")

    return round(parsed, 4)


def required(data, key):
    value = str(data.get(key) or "").strip()
    if not value:
        raise ValueError(f"Missing {key}.")
    return value


def parse_clients(payload):
    if not isinstance(payload, list) or not payload:
        raise ValueError("Select at least one client.")

    clients = []

    for index, raw_client in enumerate(payload, start=1):
        if not isinstance(raw_client, dict):
            raise ValueError(f"Client #{index} is invalid.")

        client_label = clean_text(raw_client.get("clientLabel"))
        project_id = clean_text(raw_client.get("projectId"))
        project_name = clean_text(raw_client.get("projectName"))
        task_id = clean_text(raw_client.get("taskId"))
        task_name = clean_text(raw_client.get("taskName"))

        if not client_label:
            raise ValueError(f"Client #{index} is missing clientLabel.")

        if not project_id:
            raise ValueError(f"Client #{index} is missing projectId.")

        if not project_name:
            raise ValueError(f"Client #{index} is missing projectName.")

        clients.append(
            {
                "clientLabel": client_label,
                "projectId": project_id,
                "projectName": project_name,
                "taskId": task_id or None,
                "taskName": task_name or None,
            }
        )

    return clients


def required_env(name):
    value = os.environ.get(name)
    if not value:
        raise ValueError(f"Missing environment variable: {name}")
    return value


def resolve_split_timezone(timezone_name):
    candidate = clean_text(timezone_name)
    if candidate:
        return candidate
    return SPLIT_TIMEZONE


def parse_anchor_start(work_date, timezone_name):
    try:
        tz = ZoneInfo(timezone_name)
    except Exception as exc:
        raise ValueError(f"Unsupported timezone: {timezone_name}") from exc

    try:
        anchor = datetime.fromisoformat(f"{work_date}T{SPLIT_START_TIME}")
    except ValueError as exc:
        raise ValueError("Invalid workDate.") from exc

    return anchor.replace(tzinfo=tz)


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


def build_split_entries(description, total_hours, clients, anchor_start):
    total_seconds = int(round(total_hours * 3600))
    base_seconds = total_seconds // len(clients)
    remainder_seconds = total_seconds % len(clients)
    cursor = anchor_start
    entries = []

    for index, client in enumerate(clients):
        duration_seconds = base_seconds + (1 if index < remainder_seconds else 0)
        entry_start = cursor
        entry_end = cursor + timedelta(seconds=duration_seconds)
        cursor = entry_end

        entries.append(
            {
                "order": index + 1,
                "clientLabel": client["clientLabel"],
                "projectId": client["projectId"],
                "projectName": client["projectName"],
                "taskId": client["taskId"],
                "taskName": client["taskName"],
                "title": client["clientLabel"],
                "description": description,
                "start": entry_start.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
                "end": entry_end.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
                "splitHours": round(duration_seconds / 3600, 4),
                "totalHours": total_hours,
                "clientCount": len(clients),
            }
        )

    return entries


def parse_datetime(value, fallback_tz):
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=fallback_tz)


def clean_text(value):
    return str(value or "").strip()


def slugify_project_name(value):
    cleaned = clean_text(value).lower()
    return "".join(char if char.isalnum() else "-" for char in cleaned).strip("-")


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
