from datetime import datetime, timezone


def audit_log_document(
    action: str,
    outcome: str,
    *,
    user_id: str | None = None,
    username: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    details: dict | None = None,
) -> dict:
    return {
        "action": action,
        "outcome": outcome,
        "user_id": user_id,
        "username": username,
        "ip": ip,
        "user_agent": user_agent,
        "details": details or {},
        "created_at": datetime.now(timezone.utc),
    }
