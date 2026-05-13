from datetime import datetime, timezone, timedelta
import traceback
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.user import UserOut
from app.models.scan import ScanStatus
from app.models.vulnerability import Severity

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _to_iso(val) -> str | None:
    """Safely convert datetime or string to ISO format string."""
    if val is None:
        return None
    if isinstance(val, str):
        return val
    try:
        return val.isoformat()
    except Exception:
        return str(val)


@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    try:
        return await _compute_stats(db, current_user)
    except Exception as exc:
        tb = traceback.format_exc()
        print(f"[dashboard/stats] ERROR: {exc}\n{tb}")
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}")


async def _compute_stats(db, current_user: UserOut):
    user_id = current_user.id

    total_scans     = await db.scans.count_documents({"user_id": user_id})
    running_scans   = await db.scans.count_documents({"user_id": user_id, "status": ScanStatus.RUNNING.value})
    completed_scans = await db.scans.count_documents({"user_id": user_id, "status": ScanStatus.COMPLETED.value})
    failed_scans    = await db.scans.count_documents({"user_id": user_id, "status": ScanStatus.FAILED.value})

    scan_ids = [str(doc["_id"]) async for doc in db.scans.find({"user_id": user_id}, {"_id": 1})]

    # Count vulnerabilities per severity (sequential awaits — safe in any Python 3.6+)
    vuln_counts: dict[str, int] = {}
    for s in Severity:
        vuln_counts[s.value] = await db.vulnerabilities.count_documents(
            {"scan_id": {"$in": scan_ids}, "severity": s.value}
        )

    # Recent scans
    recent_scans_cursor = db.scans.find({"user_id": user_id}).sort("created_at", -1).limit(5)
    recent_scans = []
    async for doc in recent_scans_cursor:
        recent_scans.append({
            "id":           str(doc["_id"]),
            "target":       doc.get("target", ""),
            "scan_type":    doc.get("scan_type", ""),
            "status":       doc.get("status", ""),
            "risk_summary": doc.get("risk_summary") or {},
            "created_at":   _to_iso(doc.get("created_at")),
            "started_at":   _to_iso(doc.get("started_at")),
            "completed_at": _to_iso(doc.get("completed_at")),
        })

    # Activity feed — last 10 scan events
    activity_cursor = db.scans.find({"user_id": user_id}).sort("created_at", -1).limit(10)
    activity_feed = []
    async for doc in activity_cursor:
        status  = doc.get("status", "")
        risk    = doc.get("risk_summary") or {}
        overall = risk.get("overall", "info")
        if status == ScanStatus.COMPLETED.value:
            severity = overall if overall in ("critical", "high", "medium", "low") else "success"
            title    = f"Scan completed — {doc.get('target', '')}"
        elif status == ScanStatus.FAILED.value:
            severity = "high"
            title    = f"Scan failed — {doc.get('target', '')}"
        elif status == ScanStatus.RUNNING.value:
            severity = "info"
            title    = f"Scan running — {doc.get('target', '')}"
        else:
            severity = "info"
            title    = f"Scan queued — {doc.get('target', '')}"

        ts = doc.get("updated_at") or doc.get("created_at")
        activity_feed.append({
            "id":        str(doc["_id"]),
            "type":      f"scan_{status}",
            "title":     title,
            "severity":  severity,
            "timestamp": _to_iso(ts),
        })

    # Vulnerability trends — last 6 months
    now    = datetime.now(timezone.utc)
    trends = []
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        if i == 0:
            month_end = now
        else:
            next_m    = month_start.replace(day=28) + timedelta(days=4)
            month_end = next_m.replace(day=1)

        month_scan_ids = [
            str(doc["_id"])
            async for doc in db.scans.find(
                {"user_id": user_id, "created_at": {"$gte": month_start, "$lt": month_end}},
                {"_id": 1},
            )
        ]

        month_vulns: dict[str, int] = {}
        for s in (Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW):
            month_vulns[s.value] = await db.vulnerabilities.count_documents(
                {"scan_id": {"$in": month_scan_ids}, "severity": s.value}
            )

        trends.append({
            "month":    month_start.strftime("%b"),
            "critical": month_vulns[Severity.CRITICAL.value],
            "high":     month_vulns[Severity.HIGH.value],
            "medium":   month_vulns[Severity.MEDIUM.value],
            "low":      month_vulns[Severity.LOW.value],
        })

    return {
        "scans": {
            "total":     total_scans,
            "running":   running_scans,
            "completed": completed_scans,
            "failed":    failed_scans,
        },
        "vulnerabilities": vuln_counts,
        "recent_scans":     recent_scans,
        "activity_feed":    activity_feed,
        "vulnerability_trends": trends,
    }
