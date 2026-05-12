from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.user import UserOut
from app.schemas.report import ReportCreate, ReportOut
from app.models.report import report_document
from app.utils.helpers import doc_to_out

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("/", response_model=ReportOut, status_code=201)
async def create_report(
    data: ReportCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    scan = await db.scans.find_one({"_id": ObjectId(data.scan_id), "user_id": current_user.id})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    doc = report_document(data.scan_id, current_user.id, data.title, data.format)
    doc["generated"] = True
    result = await db.reports.insert_one(doc)
    created = await db.reports.find_one({"_id": result.inserted_id})
    return ReportOut(**doc_to_out(created))


@router.get("/", response_model=list[ReportOut])
async def list_reports(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    cursor = db.reports.find({"user_id": current_user.id}).sort("created_at", -1)
    return [ReportOut(**doc_to_out(doc)) async for doc in cursor]


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(
    report_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    doc = await db.reports.find_one({"_id": ObjectId(report_id), "user_id": current_user.id})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportOut(**doc_to_out(doc))


@router.get("/{report_id}/content")
async def get_report_content(
    report_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    """Return structured report content built from the associated scan data."""
    report_doc = await db.reports.find_one({"_id": ObjectId(report_id), "user_id": current_user.id})
    if not report_doc:
        raise HTTPException(status_code=404, detail="Report not found")

    scan_doc = await db.scans.find_one({"_id": ObjectId(report_doc["scan_id"])})
    if not scan_doc:
        raise HTTPException(status_code=404, detail="Associated scan not found")

    vuln_cursor = db.vulnerabilities.find({"scan_id": report_doc["scan_id"]}).sort("cvss_score", -1)
    vulns = []
    async for v in vuln_cursor:
        vulns.append({
            "id": str(v["_id"]),
            "cve_id": v.get("cve_id", ""),
            "title": v.get("title", ""),
            "description": v.get("description", ""),
            "severity": v.get("severity", ""),
            "cvss_score": v.get("cvss_score", 0),
            "affected_host": v.get("affected_host", ""),
            "affected_service": v.get("affected_service", ""),
            "affected_port": v.get("affected_port"),
            "exploit_available": v.get("exploit_available", False),
            "remediation": v.get("remediation", ""),
            "owasp": v.get("owasp"),
            "evidence": v.get("evidence"),
            "affected_url": v.get("affected_url"),
        })

    risk = scan_doc.get("risk_summary", {})
    return {
        "report_id": report_id,
        "title": report_doc["title"],
        "format": report_doc["format"],
        "generated_at": report_doc["created_at"].isoformat(),
        "scan": {
            "id": str(scan_doc["_id"]),
            "target": scan_doc["target"],
            "scan_type": scan_doc["scan_type"],
            "status": scan_doc["status"],
            "started_at": scan_doc.get("started_at", "").isoformat() if scan_doc.get("started_at") else None,
            "completed_at": scan_doc.get("completed_at", "").isoformat() if scan_doc.get("completed_at") else None,
        },
        "risk_summary": {
            "overall": risk.get("overall", "unknown"),
            "critical": risk.get("critical", 0),
            "high": risk.get("high", 0),
            "medium": risk.get("medium", 0),
            "low": risk.get("low", 0),
            "info": risk.get("info", 0),
            "max_cvss": risk.get("max_cvss", 0),
        },
        "vulnerability_count": len(vulns),
        "vulnerabilities": vulns,
    }


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    result = await db.reports.delete_one({"_id": ObjectId(report_id), "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
