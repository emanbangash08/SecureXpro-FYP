from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.user import UserOut
from app.models.scan import ScanStatus
from app.models.vulnerability import Severity

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    user_id = current_user.id

    total_scans = await db.scans.count_documents({"user_id": user_id})
    running_scans = await db.scans.count_documents({"user_id": user_id, "status": ScanStatus.RUNNING.value})
    completed_scans = await db.scans.count_documents({"user_id": user_id, "status": ScanStatus.COMPLETED.value})
    failed_scans = await db.scans.count_documents({"user_id": user_id, "status": ScanStatus.FAILED.value})

    scan_ids = [str(doc["_id"]) async for doc in db.scans.find({"user_id": user_id}, {"_id": 1})]

    vuln_counts = {
        s.value: await db.vulnerabilities.count_documents({"scan_id": {"$in": scan_ids}, "severity": s.value})
        for s in Severity
    }

    # Recent scans for the scan table
    recent_scans_cursor = db.scans.find({"user_id": user_id}).sort("created_at", -1).limit(5)
    recent_scans = [
        {
            "id": str(doc["_id"]),
            "target": doc["target"],
            "scan_type": doc["scan_type"],
            "status": doc["status"],
            "risk_summary": doc.get("risk_summary", {}),
            "created_at": doc["created_at"].isoformat(),
            "started_at": doc["started_at"].isoformat() if doc.get("started_at") else None,
            "completed_at": doc["completed_at"].isoformat() if doc.get("completed_at") else None,
        }
        async for doc in recent_scans_cursor
    ]

    # Activity feed — last 10 scan events
    activity_cursor = db.scans.find({"user_id": user_id}).sort("updated_at", -1).limit(10)
    activity_feed = []
    async for doc in activity_cursor:
        status = doc["status"]
        risk = doc.get("risk_summary", {})
        overall = risk.get("overall", "info")
        if status == ScanStatus.COMPLETED.value:
            severity = overall if overall in ("critical", "high", "medium", "low") else "success"
            title = f"Scan completed — {doc['target']}"
        elif status == ScanStatus.FAILED.value:
            severity = "high"
            title = f"Scan failed — {doc['target']}"
        elif status == ScanStatus.RUNNING.value:
            severity = "info"
            title = f"Scan running — {doc['target']}"
        else:
            severity = "info"
            title = f"Scan queued — {doc['target']}"

        ts = doc.get("updated_at") or doc.get("created_at")
        activity_feed.append({
            "id": str(doc["_id"]),
            "type": f"scan_{status}",
            "title": title,
            "severity": severity,
            "timestamp": ts.isoformat() if ts else None,
        })

    # Vulnerability trends — last 6 months
    now = datetime.now(timezone.utc)
    trends = []
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i == 0:
            month_end = now
        else:
            next_m = month_start.replace(day=28) + timedelta(days=4)
            month_end = next_m.replace(day=1)

        month_scan_ids = [
            str(doc["_id"])
            async for doc in db.scans.find(
                {"user_id": user_id, "created_at": {"$gte": month_start, "$lt": month_end}},
                {"_id": 1},
            )
        ]

        month_vulns = {
            s.value: await db.vulnerabilities.count_documents(
                {"scan_id": {"$in": month_scan_ids}, "severity": s.value}
            )
            for s in (Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW)
        }

        trends.append({
            "month": month_start.strftime("%b"),
            "critical": month_vulns[Severity.CRITICAL.value],
            "high": month_vulns[Severity.HIGH.value],
            "medium": month_vulns[Severity.MEDIUM.value],
            "low": month_vulns[Severity.LOW.value],
        })

    return {
        "scans": {
            "total": total_scans,
            "running": running_scans,
            "completed": completed_scans,
            "failed": failed_scans,
        },
        "vulnerabilities": vuln_counts,
        "recent_scans": recent_scans,
        "activity_feed": activity_feed,
        "vulnerability_trends": trends,
    }
