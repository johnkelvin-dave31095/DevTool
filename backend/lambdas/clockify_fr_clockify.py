import json
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


FR_CLOCKIFY_TIMEZONE = "Asia/Manila"
FR_CLOCKIFY_START_TIME = "08:00:00"


def parse_fr_clockify_request(payload):
    nested_payload = payload

    if isinstance(payload, dict) and isinstance(payload.get("body"), str):
        nested_payload = json.loads(payload["body"])

    if not isinstance(nested_payload, dict):
        raise ValueError("Invalid FR Clockify payload.")

    work_date = clean_string(nested_payload.get("workDate"))
    timezone_name = clean_string(nested_payload.get("timezone")) or FR_CLOCKIFY_TIMEZONE
    start_time = clean_string(nested_payload.get("startTime")) or FR_CLOCKIFY_START_TIME
    entries_payload = nested_payload.get("entries")

    if not work_date:
        raise ValueError("Missing workDate.")

    if not isinstance(entries_payload, list) or not entries_payload:
        raise ValueError("No FR Clockify entries provided.")

    entries = [
        validate_fr_clockify_entry(item, index)
        for index, item in enumerate(entries_payload, start=1)
    ]

    return {
        "workDate": work_date,
        "timezone": timezone_name,
        "startTime": normalize_start_time(start_time),
        "entries": entries,
    }


def build_fr_clockify_entries(request_payload):
    timezone_name = request_payload["timezone"]

    try:
        tz = ZoneInfo(timezone_name)
    except Exception as exc:
        raise ValueError(f"Unsupported timezone: {timezone_name}") from exc

    try:
        anchor_start = datetime.fromisoformat(
            f"{request_payload['workDate']}T{request_payload['startTime']}"
        ).replace(tzinfo=tz)
    except ValueError as exc:
        raise ValueError("Invalid workDate or startTime.") from exc

    ordered_entries = sorted(
        request_payload["entries"],
        key=lambda entry: (entry["order"], entry["sequence"]),
    )

    cursor = anchor_start
    built_entries = []

    for entry in ordered_entries:
        duration_seconds = entry["durationSeconds"]
        entry_start = cursor
        entry_end = cursor + timedelta(seconds=duration_seconds)
        cursor = entry_end

        if entry_end.date() != anchor_start.date():
            raise ValueError("FR Clockify hours must stay within the selected Manila work day.")

        built_entries.append(
            {
                "title": entry["title"],
                "description": entry["description"],
                "projectId": entry["projectId"],
                "taskId": entry["taskId"],
                "billable": entry["billable"],
                "start": entry_start.astimezone(timezone.utc)
                .isoformat()
                .replace("+00:00", "Z"),
                "end": entry_end.astimezone(timezone.utc)
                .isoformat()
                .replace("+00:00", "Z"),
            }
        )

    return built_entries


def validate_fr_clockify_entry(entry, index):
    if not isinstance(entry, dict):
        raise ValueError(f"FR Clockify entry #{index} is invalid.")

    title = clean_string(entry.get("title"))
    description = clean_string(entry.get("description"))
    project_id = clean_string(entry.get("projectId"))
    task_id = clean_string(entry.get("taskId"))
    billable = to_bool(entry.get("billable"), default=True)
    order = parse_optional_int(entry.get("order"), default=index)
    duration_seconds = parse_duration_seconds(entry)

    if not title:
        raise ValueError(f"FR Clockify entry #{index} is missing title.")

    if not project_id:
        raise ValueError(f"FR Clockify entry #{index} is missing projectId.")

    return {
        "title": title,
        "description": description,
        "projectId": project_id,
        "taskId": task_id,
        "billable": billable,
        "order": order,
        "sequence": index,
        "durationSeconds": duration_seconds,
    }


def parse_duration_seconds(entry):
    start = clean_string(entry.get("start"))
    end = clean_string(entry.get("end"))

    if start and end:
        start_dt = parse_iso_datetime(start)
        end_dt = parse_iso_datetime(end)
        duration_seconds = int(round((end_dt - start_dt).total_seconds()))

        if duration_seconds <= 0:
            raise ValueError("FR Clockify entry duration must be greater than zero.")

        return duration_seconds

    split_hours = entry.get("splitHours")

    try:
        parsed_hours = float(split_hours)
    except (TypeError, ValueError) as exc:
        raise ValueError("FR Clockify entry is missing a valid splitHours value.") from exc

    if parsed_hours <= 0:
        raise ValueError("FR Clockify splitHours must be greater than zero.")

    return int(round(parsed_hours * 3600))


def normalize_start_time(value):
    if len(value) == 5:
        return f"{value}:00"
    return value


def parse_iso_datetime(value):
    normalized = clean_string(value).replace("Z", "+00:00")

    try:
        return datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(f"Invalid ISO datetime: {value}") from exc


def parse_optional_int(value, default):
    if value is None or value == "":
        return default

    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid FR Clockify order value: {value}") from exc


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


def clean_string(value):
    if value is None:
        return ""

    return str(value).strip()
