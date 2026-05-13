from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
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


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(require_admin),
):
    cursor = db.users.find({}).sort("created_at", -1)
    return [UserOut(**doc_to_out(doc)) async for doc in cursor]


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
    scan_running   = await db.scans.count_documents({"status": "running"})
    scan_completed = await db.scans.count_documents({"status": "completed"})
    scan_failed    = await db.scans.count_documents({"status": "failed"})

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
            "running":   scan_running,
            "completed": scan_completed,
            "failed":    scan_failed,
        },
        "vulnerabilities": {
            "total":    vuln_total,
            "critical": vuln_critical,
            "high":     vuln_high,
            "medium":   vuln_medium,
            "low":      vuln_low,
        },
    }
