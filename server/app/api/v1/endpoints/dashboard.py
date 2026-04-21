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

    vuln_counts = {}
    for s in Severity:
        vuln_counts[s.value] = await db.vulnerabilities.count_documents(
            {"scan_id": {"$in": scan_ids}, "severity": s.value}
        )

    recent_scans_cursor = db.scans.find({"user_id": user_id}).sort("created_at", -1).limit(5)
    recent_scans = [
        {"id": str(doc["_id"]), "target": doc["target"], "status": doc["status"], "created_at": doc["created_at"]}
        async for doc in recent_scans_cursor
    ]

    return {
        "scans": {
            "total": total_scans,
            "running": running_scans,
            "completed": completed_scans,
            "failed": failed_scans,
        },
        "vulnerabilities": vuln_counts,
        "recent_scans": recent_scans,
    }
