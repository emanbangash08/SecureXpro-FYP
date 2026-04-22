from datetime import datetime, timezone
from enum import Enum


class ScanStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ScanType(str, Enum):
    RECONNAISSANCE = "reconnaissance"
    VULNERABILITY = "vulnerability"
    WEB_ASSESSMENT = "web_assessment"
    FULL = "full"


def scan_document(
    user_id: str,
    target: str,
    scan_type: ScanType,
    options: dict | None = None,
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "user_id": user_id,
        "target": target,
        "scan_type": scan_type.value,
        "status": ScanStatus.PENDING.value,
        "options": options or {},
        "task_id": None,
        "current_phase": None,
        "recon_results": None,
        "vuln_results": None,
        "web_results": None,
        "risk_summary": None,
        "exploit_count": 0,
        "error": None,
        "started_at": None,
        "completed_at": None,
        "created_at": now,
        "updated_at": now,
    }
