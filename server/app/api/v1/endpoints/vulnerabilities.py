from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.user import UserOut
from app.schemas.vulnerability import VulnerabilityOut, VulnerabilityListOut
from app.models.vulnerability import Severity
from app.utils.helpers import doc_to_out

router = APIRouter(prefix="/vulnerabilities", tags=["Vulnerabilities"])


@router.get("/scan/{scan_id}", response_model=VulnerabilityListOut)
async def list_vulnerabilities(
    scan_id: str,
    severity: Severity | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    query: dict = {"scan_id": scan_id}
    if severity:
        query["severity"] = severity.value

    total = await db.vulnerabilities.count_documents(query)
    cursor = db.vulnerabilities.find(query).sort("cvss_score", -1).skip(skip).limit(limit)
    items = [VulnerabilityOut(**doc_to_out(doc)) async for doc in cursor]

    counts = {}
    for s in Severity:
        counts[s.value] = await db.vulnerabilities.count_documents({"scan_id": scan_id, "severity": s.value})

    return VulnerabilityListOut(
        total=total,
        critical=counts[Severity.CRITICAL.value],
        high=counts[Severity.HIGH.value],
        medium=counts[Severity.MEDIUM.value],
        low=counts[Severity.LOW.value],
        items=items,
    )


@router.get("/{vuln_id}", response_model=VulnerabilityOut)
async def get_vulnerability(
    vuln_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    doc = await db.vulnerabilities.find_one({"_id": ObjectId(vuln_id)})
    if not doc:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vulnerability not found")
    return VulnerabilityOut(**doc_to_out(doc))
