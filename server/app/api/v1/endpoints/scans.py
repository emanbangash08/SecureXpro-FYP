from fastapi import APIRouter, Depends, Query, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.user import UserOut
from app.schemas.scan import ScanCreate, ScanOut, ScanListOut
from app.models.scan import ScanType, ScanStatus
from app.services import scan_service, recon_service, vuln_service, risk_service

router = APIRouter(prefix="/scans", tags=["Scans"])


async def _run_scan(db: AsyncIOMotorDatabase, scan_id: str, target: str, options: dict) -> None:
    try:
        await scan_service.update_scan_status(db, scan_id, ScanStatus.RUNNING)
        hosts = await recon_service.run_nmap_scan(target, options)
        recon_data = [
            {"ip": h.ip, "hostname": h.hostname, "os": h.os_guess,
             "ports": [{"port": p.port, "service": p.service, "version": p.version} for p in h.ports]}
            for h in hosts
        ]
        await db.scans.update_one({"_id": scan_id}, {"$set": {"recon_results": recon_data}})
        await vuln_service.correlate_vulnerabilities(db, scan_id, hosts)
        risk_summary = await risk_service.compute_risk_summary(db, scan_id)
        await db.scans.update_one({"_id": scan_id}, {"$set": {"risk_summary": risk_summary}})
        await scan_service.update_scan_status(db, scan_id, ScanStatus.COMPLETED)
    except Exception as exc:
        await scan_service.update_scan_status(db, scan_id, ScanStatus.FAILED, error=str(exc))


@router.post("/", response_model=ScanOut, status_code=201)
async def create_scan(
    data: ScanCreate,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    scan = await scan_service.create_scan(db, current_user.id, data)
    background_tasks.add_task(_run_scan, db, scan.id, scan.target, scan.options)
    return scan


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


@router.delete("/{scan_id}", status_code=204)
async def delete_scan(
    scan_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    await scan_service.delete_scan(db, scan_id, current_user.id)
