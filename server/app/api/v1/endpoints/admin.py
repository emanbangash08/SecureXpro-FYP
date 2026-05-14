import re
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import require_admin
from app.schemas.user import UserOut
from app.models.user import UserRole, UserStatus
from app.utils.helpers import doc_to_out

router = APIRouter(prefix="/admin", tags=["Admin"])


class UserRoleUpdate(BaseModel):
    role: UserRole | None = None
    status: UserStatus | None = None


@router.get("/users")
async def list_users(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(require_admin),
):
    cursor = db.users.find({}).sort("created_at", -1)
    users = []
    async for doc in cursor:
        user = doc_to_out(doc)
        uid = user["id"]
        user["scan_count"] = await db.scans.count_documents({"user_id": uid})
        users.append(user)
    return users


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    data: UserRoleUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(require_admin),
):
    updates = data.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    updates["updated_at"] = datetime.now(timezone.utc)
    # Store enum values as strings
    if "role" in updates:
        updates["role"] = updates["role"].value
    if "status" in updates:
        updates["status"] = updates["status"].value

    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    doc = await db.users.find_one({"_id": ObjectId(user_id)})
    return UserOut(**doc_to_out(doc))


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")


@router.get("/users/{user_id}/detail")
async def get_user_detail(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(require_admin),
):
    doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")

    user = doc_to_out(doc)
    user["scan_count"]      = await db.scans.count_documents({"user_id": user_id})
    user["completed_scans"] = await db.scans.count_documents({"user_id": user_id, "status": "completed"})
    user["failed_scans"]    = await db.scans.count_documents({"user_id": user_id, "status": "failed"})
    user["running_scans"]   = await db.scans.count_documents({"user_id": user_id, "status": "running"})
    return user


@router.get("/scans")
async def list_all_scans(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str]   = Query(None),
    scan_type: Optional[str] = Query(None),
    user_id: Optional[str]   = Query(None),
    search: Optional[str]    = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str]   = Query(None),
    risk: Optional[str]      = Query(None),
    has_exploits: Optional[bool] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(require_admin),
):
    filt: dict = {}
    if status:    filt["status"]    = status
    if scan_type: filt["scan_type"] = scan_type
    if user_id:   filt["user_id"]   = user_id
    if risk:      filt["risk_summary.overall_risk"] = risk
    if has_exploits is True:  filt["exploit_count"] = {"$gt": 0}
    if has_exploits is False: filt["exploit_count"] = {"$not": {"$gt": 0}}
    if search:
        filt["target"] = {"$regex": re.escape(search.strip()), "$options": "i"}
    if date_from or date_to:
        date_filt: dict = {}
        if date_from:
            date_filt["$gte"] = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
        if date_to:
            date_filt["$lte"] = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
        filt["created_at"] = date_filt

    total  = await db.scans.count_documents(filt)
    cursor = db.scans.find(filt).sort("created_at", -1).skip(skip).limit(limit)

    items = []
    async for doc in cursor:
        scan = doc_to_out(doc)
        uid = scan.get("user_id", "")
        user_doc = await db.users.find_one({"_id": ObjectId(uid)}) if uid else None
        scan["username"]   = user_doc["username"]  if user_doc else "unknown"
        scan["user_email"] = user_doc["email"]     if user_doc else ""
        scan["vuln_count"] = await db.vulnerabilities.count_documents({"scan_id": scan["id"]})
        items.append(scan)

    return {"total": total, "items": items}


@router.get("/scans/{scan_id}")
async def get_scan_detail(
    scan_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(require_admin),
):
    doc = await db.scans.find_one({"_id": ObjectId(scan_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Scan not found")

    scan = doc_to_out(doc)
    uid = scan.get("user_id", "")
    user_doc = await db.users.find_one({"_id": ObjectId(uid)}) if uid else None
    scan["username"]   = user_doc["username"] if user_doc else "unknown"
    scan["user_email"] = user_doc["email"]    if user_doc else ""

    vuln_cursor = db.vulnerabilities.find({"scan_id": scan_id}).sort("cvss_score", -1).limit(100)
    scan["vulnerabilities"] = [doc_to_out(v) async for v in vuln_cursor]
    scan["vuln_count"] = len(scan["vulnerabilities"])
    return scan


@router.get("/stats")
async def admin_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(require_admin),
):
    user_total   = await db.users.count_documents({})
    admin_count  = await db.users.count_documents({"role": "admin"})
    user_count   = await db.users.count_documents({"role": "user"})
    agent_count  = await db.users.count_documents({"role": "agent"})
    active_users = await db.users.count_documents({"status": "active"})
    banned_users = await db.users.count_documents({"status": "banned"})

    scan_total     = await db.scans.count_documents({})
    scan_pending   = await db.scans.count_documents({"status": "pending"})
    scan_running   = await db.scans.count_documents({"status": "running"})
    scan_completed = await db.scans.count_documents({"status": "completed"})
    scan_failed    = await db.scans.count_documents({"status": "failed"})
    scan_cancelled = await db.scans.count_documents({"status": "cancelled"})

    vuln_total    = await db.vulnerabilities.count_documents({})
    vuln_critical = await db.vulnerabilities.count_documents({"severity": "critical"})
    vuln_high     = await db.vulnerabilities.count_documents({"severity": "high"})
    vuln_medium   = await db.vulnerabilities.count_documents({"severity": "medium"})
    vuln_low      = await db.vulnerabilities.count_documents({"severity": "low"})

    return {
        "users": {
            "total":   user_total,
            "by_role": {"admin": admin_count, "user": user_count, "agent": agent_count},
            "active":  active_users,
            "banned":  banned_users,
        },
        "scans": {
            "total":     scan_total,
            "pending":   scan_pending,
            "running":   scan_running,
            "completed": scan_completed,
            "failed":    scan_failed,
            "cancelled": scan_cancelled,
        },
        "vulnerabilities": {
            "total":    vuln_total,
            "critical": vuln_critical,
            "high":     vuln_high,
            "medium":   vuln_medium,
            "low":      vuln_low,
        },
    }
