from datetime import datetime, timezone


def scan_log_document(
    scan_id: str,
    phase: str,
    level: str,   # "cmd" | "info" | "success" | "error" | "warning"
    message: str,
) -> dict:
    return {
        "scan_id": scan_id,
        "phase": phase,
        "level": level,
        "message": message,
        "created_at": datetime.now(timezone.utc),
    }
