from datetime import datetime, timezone
from enum import Enum


class ReportFormat(str, Enum):
    PDF = "pdf"
    HTML = "html"
    JSON = "json"


def report_document(
    scan_id: str,
    user_id: str,
    title: str,
    format: ReportFormat,
    file_path: str = "",
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "scan_id": scan_id,
        "user_id": user_id,
        "title": title,
        "format": format.value,
        "file_path": file_path,
        "generated": False,
        "created_at": now,
    }
