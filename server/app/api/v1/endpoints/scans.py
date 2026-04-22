from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.user import UserOut
from app.schemas.scan import ScanCreate, ScanOut, ScanListOut
from app.models.scan import ScanType, ScanStatus
from app.services import scan_service

router = APIRouter(prefix="/scans", tags=["Scans"])


@router.post("/", response_model=ScanOut, status_code=201)
async def create_scan(
    data: ScanCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    return await scan_service.create_scan(db, current_user.id, data)


@router.get("/", response_model=ScanListOut)
async def list_scans(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    scan_type: ScanType | None = None,
    scan_status: ScanStatus | None = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    return await scan_service.list_scans(db, current_user.id, skip, limit, scan_type, scan_status)


@router.get("/{scan_id}", response_model=ScanOut)
async def get_scan(
    scan_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    return await scan_service.get_scan(db, scan_id, current_user.id)


@router.post("/{scan_id}/cancel", response_model=ScanOut)
async def cancel_scan(
    scan_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    return await scan_service.cancel_scan(db, scan_id, current_user.id)


@router.post("/{scan_id}/retry", response_model=ScanOut)
async def retry_scan(
    scan_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    return await scan_service.retry_scan(db, scan_id, current_user.id)


@router.delete("/{scan_id}", status_code=204)
async def delete_scan(
    scan_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    await scan_service.delete_scan(db, scan_id, current_user.id)
