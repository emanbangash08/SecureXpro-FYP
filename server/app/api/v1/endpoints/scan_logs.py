from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.user import UserOut

router = APIRouter(prefix="/scans", tags=["Scan Logs"])


@router.get("/{scan_id}/logs")
async def get_scan_logs(
    scan_id: str,
    skip: int = 0,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    """Return all terminal log lines for a scan in insertion order."""
    # Verify the scan belongs to this user
    try:
        oid = ObjectId(scan_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    scan = await db.scans.find_one({"_id": oid, "user_id": current_user.id})
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    cursor = db.scan_logs.find({"scan_id": scan_id}).sort("created_at", 1).skip(skip)
    logs = []
    async for doc in cursor:
        logs.append({
            "id": str(doc["_id"]),
            "phase": doc["phase"],
            "level": doc["level"],
            "message": doc["message"],
            "created_at": doc["created_at"].isoformat(),
        })
    return {"scan_id": scan_id, "count": len(logs), "logs": logs}


@router.get("/{scan_id}/report")
async def get_scan_report(
    scan_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    """Return a structured JSON report for a completed scan."""
    try:
        oid = ObjectId(scan_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    scan = await db.scans.find_one({"_id": oid, "user_id": current_user.id})
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    rs = scan.get("risk_summary") or {}
    recon = scan.get("recon_results") or []
    web   = scan.get("web_results") or {}

    total_ports = sum(len(h.get("ports", [])) for h in recon)

    # Gather vulnerabilities
    vuln_cursor = db.vulnerabilities.find({"scan_id": scan_id}).sort("cvss_score", -1)
    vulns = []
    async for v in vuln_cursor:
        vulns.append({
            "cve_id":    v.get("cve_id"),
            "title":     v.get("title"),
            "severity":  v.get("severity"),
            "cvss_score": v.get("cvss_score"),
            "affected_host": v.get("affected_host"),
            "affected_port": v.get("affected_port"),
            "remediation": v.get("remediation"),
            "owasp": v.get("owasp"),
        })

    return {
        "scan_id":     scan_id,
        "target":      scan["target"],
        "scan_type":   scan["scan_type"],
        "status":      scan["status"],
        "started_at":  scan.get("started_at"),
        "completed_at": scan.get("completed_at"),
        "summary": {
            "hosts_discovered": len(recon),
            "open_ports":       total_ports,
            "total_vulns":      rs.get("total", 0),
            "critical":         rs.get("critical", 0),
            "high":             rs.get("high", 0),
            "medium":           rs.get("medium", 0),
            "low":              rs.get("low", 0),
            "exploit_count":    scan.get("exploit_count", 0),
            "max_cvss_score":   rs.get("max_cvss_score", 0),
            "overall_risk":     rs.get("overall_risk", "info"),
        },
        "hosts":            recon,
        "vulnerabilities":  vulns,
        "web_results":      web,
    }
