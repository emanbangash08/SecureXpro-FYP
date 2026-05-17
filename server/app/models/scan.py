from datetime import datetime, timezone
from enum import Enum


class ScanStatus(str, Enum):
    PENDING = "pending"
    PENDING_AGENT = "pending_agent"   # waiting for a remote agent to pick up recon
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
    assigned_agent_id: str | None = None,
) -> dict:
    now = datetime.now(timezone.utc)
    # If an agent is assigned, the scan waits in PENDING_AGENT until the
    # agent polls and picks it up; otherwise it goes straight to the Celery
    # queue (PENDING).
    initial_status = (
        ScanStatus.PENDING_AGENT.value if assigned_agent_id else ScanStatus.PENDING.value
    )
    return {
        "user_id": user_id,
        "target": target,
        "scan_type": scan_type.value,
        "status": initial_status,
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
        # ── Agent dispatch (Module: distributed scanning) ────────────────────
        "assigned_agent_id":      assigned_agent_id,    # user_id of the agent
        "agent_dispatched_at":    None,                  # when agent picked it up
        "agent_result_received_at": None,                # when agent uploaded XML
    }
