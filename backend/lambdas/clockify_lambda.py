import json
import logging
import os
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


logger = logging.getLogger()
logger.setLevel(logging.INFO)

CLOCKIFY_API_BASE_URL = os.environ.get(
    "CLOCKIFY_API_BASE_URL",
    "https://api.clockify.me/api/v1",
)


def lambda_handler(event, context):
    try:
        logger.info(
            "clockify_lambda_request %s",
            json.dumps(
                {
                    "httpMethod": get_http_method(event),
                    "queryStringParameters": event.get("queryStringParameters") or {},
                },
                default=str,
            ),
        )

        if get_http_method(event) == "OPTIONS":
            return response(200, {"message": "ok"})

        settings = get_settings()
        payload = parse_payload(event)
        action = get_action(event, payload)

        if action == "list":
            include_archived = to_bool(
                get_option(event, payload, "includeArchived", False),
                default=False,
            )
            only_active_tasks = to_bool(
                get_option(event, payload, "onlyActiveTasks", True),
                default=True,
            )

            listing = list_projects_and_tasks(
                api_key=settings["api_key"],
                workspace_id=settings["workspace_id"],
                include_archived=include_archived,
                only_active_tasks=only_active_tasks,
            )

            return response(200, listing)

        if action == "push":
            entries = extract_entries(payload)

            if not entries:
                return response(400, {"message": "No reviewed entries provided."})

            catalog = list_projects_and_tasks(
                api_key=settings["api_key"],
                workspace_id=settings["workspace_id"],
                include_archived=False,
                only_active_tasks=False,
            )
            project_lookup = {
                project["projectId"]: project for project in catalog["projects"]
            }

            created = []
            skipped = []

            for entry in entries:
                try:
                    validated_entry = validate_push_entry(entry)

                    project = project_lookup.get(validated_entry["projectId"])
                    if not project:
                        skip_payload = {
                            "title": validated_entry["title"],
                            "projectId": validated_entry["projectId"],
                            "taskId": validated_entry["taskId"],
                            "start": validated_entry["start"],
                            "end": validated_entry["end"],
                            "error": "Clockify project not found for the submitted projectId.",
                        }
                        skipped.append(skip_payload)
                        logger.warning(
                            "clockify_push_skipped %s",
                            json.dumps(skip_payload, default=str),
                        )
                        continue

                    task = None

                    if validated_entry["taskId"]:
                        task = next(
                            (
                                item
                                for item in project.get("tasks", [])
                                if item.get("taskId") == validated_entry["taskId"]
                            ),
                            None,
                        )

                    if validated_entry["taskId"] and not task:
                        skip_payload = {
                            "title": validated_entry["title"],
                            "projectId": validated_entry["projectId"],
                            "projectName": project.get("projectName"),
                            "taskId": validated_entry["taskId"],
                            "start": validated_entry["start"],
                            "end": validated_entry["end"],
                            "error": "Clockify task not found under the submitted projectId.",
                        }
                        skipped.append(skip_payload)
                        logger.warning(
                            "clockify_push_skipped %s",
                            json.dumps(skip_payload, default=str),
                        )
                        continue

                    time_entry = create_time_entry(
                        api_key=settings["api_key"],
                        workspace_id=settings["workspace_id"],
                        project_id=validated_entry["projectId"],
                        task_id=validated_entry["taskId"],
                        description=validated_entry["description"],
                        start=validated_entry["start"],
                        end=validated_entry["end"],
                        billable=validated_entry["billable"],
                    )

                    created_payload = {
                        "title": validated_entry["title"],
                        "projectId": validated_entry["projectId"],
                        "projectName": project.get("projectName"),
                        "taskId": validated_entry["taskId"],
                        "taskName": task.get("taskName") if task else None,
                        "timeEntryId": time_entry.get("id"),
                        "start": validated_entry["start"],
                        "end": validated_entry["end"],
                        "billable": validated_entry["billable"],
                    }
                    created.append(created_payload)
                    logger.info(
                        "clockify_push_created %s",
                        json.dumps(created_payload, default=str),
                    )

                except ValidationError as exc:
                    skip_payload = {
                        "title": entry.get("title"),
                        "error": str(exc),
                    }
                    skipped.append(skip_payload)
                    logger.warning(
                        "clockify_push_skipped %s",
                        json.dumps(skip_payload, default=str),
                    )

                except ClockifyError as exc:
                    skip_payload = {
                        "title": entry.get("title"),
                        "error": exc.message,
                        "details": exc.details,
                    }
                    skipped.append(skip_payload)
                    logger.warning(
                        "clockify_push_skipped %s",
                        json.dumps(skip_payload, default=str),
                    )

            status_code = 200 if created else 400

            return response(
                status_code,
                {
                    "action": "push",
                    "createdCount": len(created),
                    "skippedCount": len(skipped),
                    "created": created,
                    "skipped": skipped,
                },
            )

        if action not in ("create", "sync"):
            return response(
                400,
                {
                    "message": "Unsupported action.",
                    "supportedActions": ["list", "push", "create", "sync"],
                },
            )

        outlook_events = extract_events(payload)

        if not outlook_events:
            return response(400, {"message": "No Outlook events provided."})

        created = []
        skipped = []

        for outlook_event in outlook_events:
            try:
                validated_event = validate_outlook_event(outlook_event)

                project = find_project_by_name(
                    api_key=settings["api_key"],
                    workspace_id=settings["workspace_id"],
                    project_name=validated_event["projectName"],
                )

                if not project:
                    skipped.append(
                        {
                            "title": validated_event["rawTitle"],
                            "projectName": validated_event["projectName"],
                            "taskName": validated_event["taskName"],
                            "start": validated_event["start"],
                            "end": validated_event["end"],
                            "error": "Clockify project not found. Time entry skipped.",
                        }
                    )
                    continue

                task = find_task_by_name(
                    api_key=settings["api_key"],
                    workspace_id=settings["workspace_id"],
                    project_id=project["id"],
                    task_name=validated_event["taskName"],
                )

                if not task:
                    skipped.append(
                        {
                            "title": validated_event["rawTitle"],
                            "projectName": validated_event["projectName"],
                            "projectId": project["id"],
                            "taskName": validated_event["taskName"],
                            "start": validated_event["start"],
                            "end": validated_event["end"],
                            "error": "Clockify task not found under the matched project. Time entry skipped.",
                        }
                    )
                    continue

                time_entry = create_time_entry(
                    api_key=settings["api_key"],
                    workspace_id=settings["workspace_id"],
                    project_id=project["id"],
                    task_id=task["id"],
                    description=validated_event["notes"],
                    start=validated_event["start"],
                    end=validated_event["end"],
                    billable=True,
                )

                created.append(
                    {
                        "title": validated_event["rawTitle"],
                        "projectId": project["id"],
                        "projectName": project.get("name"),
                        "taskId": task["id"],
                        "taskName": task.get("name"),
                        "timeEntryId": time_entry.get("id"),
                        "start": validated_event["start"],
                        "end": validated_event["end"],
                        "billable": True,
                    }
                )

            except ValidationError as exc:
                skipped.append(
                    {
                        "title": outlook_event.get("title"),
                        "error": str(exc),
                    }
                )

            except ClockifyError as exc:
                skipped.append(
                    {
                        "title": outlook_event.get("title"),
                        "error": exc.message,
                        "details": exc.details,
                    }
                )

        status_code = 200 if created else 400

        return response(
            status_code,
            {
                "action": action,
                "createdCount": len(created),
                "skippedCount": len(skipped),
                "created": created,
                "skipped": skipped,
            },
        )

    except ValidationError as exc:
        return response(400, {"message": str(exc)})

    except ConfigError as exc:
        return response(500, {"message": str(exc)})

    except Exception as exc:
        return response(
            500,
            {
                "message": "Unexpected Clockify integration error.",
                "details": str(exc),
            },
        )


def get_http_method(event):
    return (
        clean_string(event.get("requestContext", {}).get("http", {}).get("method"))
        or clean_string(event.get("httpMethod"))
        or "POST"
    ).upper()


def get_settings():
    api_key = os.environ.get("CLOCKIFY_API_KEY")
    workspace_id = os.environ.get("CLOCKIFY_WORKSPACE_ID")

    if not api_key:
        raise ConfigError("Missing environment variable: CLOCKIFY_API_KEY")

    if not workspace_id:
        raise ConfigError("Missing environment variable: CLOCKIFY_WORKSPACE_ID")

    return {
        "api_key": api_key,
        "workspace_id": workspace_id,
    }


def parse_payload(event):
    body = event.get("body")

    if body is None:
        return event if isinstance(event, dict) else {}

    if event.get("isBase64Encoded"):
        raise ValidationError("Base64 encoded requests are not supported.")

    if isinstance(body, dict):
        return body

    if isinstance(body, str):
        if not body.strip():
            return {}

        try:
            return json.loads(body)
        except json.JSONDecodeError as exc:
            raise ValidationError(f"Invalid JSON body: {exc.msg}") from exc

    return {}


def get_action(event, payload):
    if isinstance(payload, dict):
        action = payload.get("action")
        if action is not None:
            return clean_string(action).lower()

    query_params = event.get("queryStringParameters") or {}
    action = query_params.get("action")

    if action is not None:
        return clean_string(action).lower()

    return "create"


def get_option(event, payload, key, default=None):
    if isinstance(payload, dict) and payload.get(key) is not None:
        return payload.get(key)

    query_params = event.get("queryStringParameters") or {}
    if query_params.get(key) is not None:
        return query_params.get(key)

    return default


def extract_entries(payload):
    if isinstance(payload, dict) and isinstance(payload.get("body"), str):
        nested_payload = json.loads(payload["body"])
        return extract_entries(nested_payload)

    if isinstance(payload, dict) and isinstance(payload.get("entries"), list):
        return payload["entries"]

    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict) and payload.get("projectId"):
        return [payload]

    return []


def extract_events(payload):
    if isinstance(payload, dict) and isinstance(payload.get("body"), str):
        nested_payload = json.loads(payload["body"])
        return extract_events(nested_payload)

    if isinstance(payload, dict) and isinstance(payload.get("events"), list):
        return payload["events"]

    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict) and payload.get("title"):
        return [payload]

    return []


def validate_push_entry(entry):
    title = clean_string(entry.get("title"))
    description = clean_string(entry.get("description"))
    start = clean_string(entry.get("start"))
    end = clean_string(entry.get("end"))
    project_id = clean_string(entry.get("projectId"))
    task_id = clean_string(entry.get("taskId"))
    billable = to_bool(entry.get("billable"), default=True)

    if not title:
        raise ValidationError("Missing title.")

    if not start:
        raise ValidationError("Missing start.")

    if not end:
        raise ValidationError("Missing end.")

    if not project_id:
        raise ValidationError("Missing projectId.")

    start_dt = parse_iso_datetime(start)
    end_dt = parse_iso_datetime(end)

    if end_dt <= start_dt:
        raise ValidationError("The end time must be later than the start time.")

    return {
        "title": title,
        "description": description,
        "start": start,
        "end": end,
        "projectId": project_id,
        "taskId": task_id,
        "billable": billable,
        "outlookEventId": entry.get("outlookEventId"),
    }


def validate_outlook_event(outlook_event):
    raw_title = clean_string(outlook_event.get("title"))
    notes = clean_string(outlook_event.get("notes"))
    start = clean_string(outlook_event.get("start"))
    end = clean_string(outlook_event.get("end"))

    if not raw_title:
        raise ValidationError("Missing title. Expected format: Project: Task")

    if ":" not in raw_title:
        raise ValidationError("Invalid title format. Expected format: Project: Task")

    project_name, task_name = raw_title.split(":", 1)

    project_name = clean_string(project_name)
    task_name = clean_string(task_name)

    if not project_name:
        raise ValidationError("Missing project name before ':'.")

    if not task_name:
        raise ValidationError("Missing task name after ':'.")

    if not start:
        raise ValidationError("Missing start.")

    if not end:
        raise ValidationError("Missing end.")

    start_dt = parse_iso_datetime(start)
    end_dt = parse_iso_datetime(end)

    if end_dt <= start_dt:
        raise ValidationError("The end time must be later than the start time.")

    return {
        "rawTitle": raw_title,
        "projectName": project_name,
        "taskName": task_name,
        "notes": notes,
        "start": start,
        "end": end,
        "billable": True,
        "outlookEventId": outlook_event.get("outlookEventId"),
    }


def list_projects_and_tasks(api_key, workspace_id, include_archived=False, only_active_tasks=True):
    projects = get_all_projects(
        api_key=api_key,
        workspace_id=workspace_id,
        include_archived=include_archived,
    )

    result_projects = []
    total_task_count = 0

    for project in projects:
        tasks = get_all_tasks(
            api_key=api_key,
            workspace_id=workspace_id,
            project_id=project["id"],
            only_active_tasks=only_active_tasks,
        )

        total_task_count += len(tasks)

        result_projects.append(
            {
                "projectId": project.get("id"),
                "projectName": project.get("name"),
                "clientId": project.get("clientId"),
                "billable": project.get("billable"),
                "archived": project.get("archived"),
                "public": project.get("public"),
                "taskCount": len(tasks),
                "tasks": [
                    {
                        "taskId": task.get("id"),
                        "taskName": task.get("name"),
                        "status": task.get("status"),
                        "billable": task.get("billable"),
                        "assigneeId": task.get("assigneeId"),
                        "assigneeIds": task.get("assigneeIds", []),
                    }
                    for task in tasks
                ],
            }
        )

    return {
        "action": "list",
        "workspaceId": workspace_id,
        "projectCount": len(result_projects),
        "taskCount": total_task_count,
        "includeArchived": include_archived,
        "onlyActiveTasks": only_active_tasks,
        "projects": result_projects,
    }


def get_all_projects(api_key, workspace_id, include_archived=False):
    page = 1
    page_size = 50
    all_projects = []

    while True:
        query_params = {
            "page": page,
            "page-size": page_size,
        }

        if not include_archived:
            query_params["archived"] = "false"

        query = urlencode(query_params)
        url = f"{CLOCKIFY_API_BASE_URL}/workspaces/{workspace_id}/projects?{query}"

        projects = request_json(
            url,
            method="GET",
            api_key=api_key,
        )

        if not isinstance(projects, list):
            raise ClockifyError(502, "Unexpected Clockify project response.", projects)

        all_projects.extend(projects)

        if len(projects) < page_size:
            break

        page += 1

    return all_projects


def get_all_tasks(api_key, workspace_id, project_id, only_active_tasks=True):
    page = 1
    page_size = 50
    all_tasks = []

    while True:
        query_params = {
            "page": page,
            "page-size": page_size,
        }

        if only_active_tasks:
            query_params["is-active"] = "true"

        query = urlencode(query_params)
        url = f"{CLOCKIFY_API_BASE_URL}/workspaces/{workspace_id}/projects/{project_id}/tasks?{query}"

        tasks = request_json(
            url,
            method="GET",
            api_key=api_key,
        )

        if not isinstance(tasks, list):
            raise ClockifyError(502, "Unexpected Clockify task response.", tasks)

        all_tasks.extend(tasks)

        if len(tasks) < page_size:
            break

        page += 1

    return all_tasks


def find_project_by_name(api_key, workspace_id, project_name):
    page = 1
    page_size = 50
    normalized_project_name = normalize_name(project_name)

    while True:
        query = urlencode(
            {
                "name": project_name,
                "archived": "false",
                "page": page,
                "page-size": page_size,
            }
        )

        url = f"{CLOCKIFY_API_BASE_URL}/workspaces/{workspace_id}/projects?{query}"

        projects = request_json(
            url,
            method="GET",
            api_key=api_key,
        )

        if not isinstance(projects, list):
            raise ClockifyError(502, "Unexpected Clockify project response.", projects)

        for project in projects:
            if normalize_name(project.get("name")) == normalized_project_name:
                return project

        if len(projects) < page_size:
            break

        page += 1

    return None


def find_task_by_name(api_key, workspace_id, project_id, task_name):
    page = 1
    page_size = 50
    normalized_task_name = normalize_name(task_name)

    while True:
        query = urlencode(
            {
                "name": task_name,
                "strict-name-search": "true",
                "is-active": "true",
                "page": page,
                "page-size": page_size,
            }
        )

        url = f"{CLOCKIFY_API_BASE_URL}/workspaces/{workspace_id}/projects/{project_id}/tasks?{query}"

        tasks = request_json(
            url,
            method="GET",
            api_key=api_key,
        )

        if not isinstance(tasks, list):
            raise ClockifyError(502, "Unexpected Clockify task response.", tasks)

        for task in tasks:
            if normalize_name(task.get("name")) == normalized_task_name:
                return task

        if len(tasks) < page_size:
            break

        page += 1

    return None


def create_time_entry(
    api_key,
    workspace_id,
    project_id,
    task_id,
    description,
    start,
    end,
    billable=True,
):
    url = f"{CLOCKIFY_API_BASE_URL}/workspaces/{workspace_id}/time-entries"

    body = {
        "billable": billable,
        "description": description,
        "projectId": project_id,
        "start": start,
        "end": end,
        "type": "REGULAR",
    }

    if task_id:
        body["taskId"] = task_id

    return request_json(
        url,
        method="POST",
        api_key=api_key,
        body=body,
    )


def request_json(url, method, api_key, body=None):
    headers = {
        "X-Api-Key": api_key,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    data = None

    if body is not None:
        data = json.dumps(body).encode("utf-8")

    request = Request(
        url=url,
        method=method,
        headers=headers,
        data=data,
    )

    try:
        with urlopen(request, timeout=30) as result:
            raw_body = result.read().decode("utf-8")
            return json.loads(raw_body) if raw_body else {}

    except HTTPError as exc:
        raw_error = exc.read().decode("utf-8")
        details = parse_error_body(raw_error)
        logger.warning(
            "clockify_http_error %s",
            json.dumps(
                {
                    "method": method,
                    "url": url,
                    "statusCode": exc.code,
                    "details": details,
                },
                default=str,
            ),
        )

        message = None

        if isinstance(details, dict):
            message = (
                details.get("message")
                or details.get("error")
                or details.get("error_description")
            )

        raise ClockifyError(
            exc.code,
            message or "Clockify request failed.",
            details,
        ) from exc

    except URLError as exc:
        logger.warning(
            "clockify_url_error %s",
            json.dumps(
                {
                    "method": method,
                    "url": url,
                    "details": str(exc),
                },
                default=str,
            ),
        )
        raise ClockifyError(
            502,
            "Could not reach Clockify.",
            str(exc),
        ) from exc


def parse_error_body(raw_error):
    try:
        return json.loads(raw_error)
    except json.JSONDecodeError:
        return raw_error


def parse_iso_datetime(value):
    normalized = clean_string(value).replace("Z", "+00:00")

    try:
        return datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValidationError(f"Invalid ISO datetime: {value}") from exc


def clean_string(value):
    if value is None:
        return ""

    return str(value).strip()


def normalize_name(value):
    return clean_string(value).casefold()


def to_bool(value, default=False):
    if isinstance(value, bool):
        return value

    if value is None:
        return default

    normalized = clean_string(value).lower()

    if normalized in ("true", "1", "yes", "y", "on"):
        return True

    if normalized in ("false", "0", "no", "n", "off"):
        return False

    return default


def response(status_code, body):
    logger.info(
        "clockify_lambda_response %s",
        json.dumps(
            {
                "statusCode": status_code,
                "body": body,
            },
            default=str,
        ),
    )
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


class ConfigError(Exception):
    pass


class ValidationError(Exception):
    pass


class ClockifyError(Exception):
    def __init__(self, status_code, message, details=None):
        self.status_code = status_code
        self.message = message
        self.details = details
        super().__init__(message)
