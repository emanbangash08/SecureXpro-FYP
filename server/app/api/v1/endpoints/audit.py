from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db
from app.api.deps import require_admin
from app.schemas.user import UserOut
from app.services import audit_service

router = APIRouter(prefix="/admin/audit", tags=["Audit"])


@router.get("/logs")
async def list_audit_logs(
    user_id:   Optional[str] = Query(None),
    action:    Optional[str] = Query(None, description="Partial match, e.g. 'auth' or 'scan.create'"),
    outcome:   Optional[str] = Query(None, description="success | failure | banned | issued | ..."),
    date_from: Optional[str] = Query(None),
    date_to:   Optional[str] = Query(None),
    skip:  int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: UserOut = Depends(require_admin),
):
    df = datetime.fromisoformat(date_from.replace("Z", "+00:00")) if date_from else None
    dt = datetime.fromisoformat(date_to.replace("Z", "+00:00")) if date_to else None
    return await audit_service.list_audit_logs(
        db,
        user_id=user_id,
        action=action,
        outcome=outcome,
        date_from=df,
        date_to=dt,
        skip=skip,
        limit=limit,
    )


@router.get("/anomalies")
async def get_anomalies(
    db: AsyncIOMotorDatabase = Depends(get_db),
    _: UserOut = Depends(require_admin),
):
    anomalies = await audit_service.get_anomalies(db)
    return {"count": len(anomalies), "anomalies": anomalies}
