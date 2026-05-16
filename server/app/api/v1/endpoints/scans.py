from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.user import UserOut
from app.schemas.scan import ScanCreate, ScanOut, ScanListOut
from app.models.scan import ScanType, ScanStatus
from app.services import scan_service
from app.utils.helpers import doc_to_out

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


@router.get("/{scan_id}/exploits")
async def get_scan_exploits(
    scan_id: str,
    label: str | None = Query(
        None,
        description="Filter by feasibility bucket: trivial | easy | moderate | hard | theoretical",
    ),
    category: str | None = Query(
        None,
        description="Filter by exploit category: rce | auth_bypass | info_disclosure | misconfiguration | dos | other",
    ),
    min_score: float | None = Query(
        None, ge=0, le=100,
        description="Only return findings with feasibility_score >= min_score",
    ),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    """
    Return Module-3 exploit analysis for one scan.

    Each item carries the CVE plus its category labels, parsed CVSS metrics
    (AC/PR/AV/UI), the list of matching Metasploit modules, a 0–100 feasibility
    score, a coarse label, and a human-readable attack-chain narrative.
    """
    # Authorise — the scan must belong to the caller (admins skip this check)
    try:
        scan = await db.scans.find_one({"_id": ObjectId(scan_id)})
    except Exception:
        scan = None
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    if str(scan.get("user_id")) != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your scan")

    query: dict = {
        "scan_id": scan_id,
        "cve_id":  {"$regex": "^CVE-", "$options": "i"},
    }
    if label:
        query["feasibility_label"] = label
    if category:
        query["exploit_categories"] = category
    if min_score is not None:
        query["feasibility_score"] = {"$gte": min_score}

    cursor = (
        db.vulnerabilities.find(query)
        .sort("feasibility_score", -1)
    )

    items: list[dict] = []
    async for v in cursor:
        items.append({
            "id":                       str(v.get("_id")),
            "cve_id":                   v.get("cve_id"),
            "title":                    v.get("title"),
            "severity":                 v.get("severity"),
            "cvss_score":               v.get("cvss_score"),
            "cvss_vector":              v.get("cvss_vector"),
            "cwe_ids":                  v.get("cwe_ids", []),
            "affected_host":            v.get("affected_host"),
            "affected_port":            v.get("affected_port"),
            "affected_service":         v.get("affected_service"),
            "exploit_available":        v.get("exploit_available"),
            "in_kev":                   v.get("in_kev"),
            "epss_score":               v.get("epss_score"),
            "epss_percentile":          v.get("epss_percentile"),
            # Module-3 enrichment
            "exploit_categories":       v.get("exploit_categories", []),
            "attack_vector":            v.get("attack_vector"),
            "attack_complexity":        v.get("attack_complexity"),
            "privileges_required":      v.get("privileges_required"),
            "user_interaction":         v.get("user_interaction"),
            "metasploit_modules":       v.get("metasploit_modules", []),
            "metasploit_module_count":  v.get("metasploit_module_count", 0),
            "feasibility_score":        v.get("feasibility_score"),
            "feasibility_label":        v.get("feasibility_label"),
            "attack_chain":             v.get("attack_chain"),
        })

    return {
        "scan_id": scan_id,
        "total": len(items),
        "summary": scan.get("exploit_summary"),
        "items": items,
    }
