"""
Celery tasks for scan execution.

Each task runs in its own worker process and manages its own DB connection
(Motor requires an event loop, so we spin one up with asyncio.run()).

Worker startup (from server/ directory):
  Windows:  celery -A celery_app worker --loglevel=info -Q scans --pool=solo
  Linux:    celery -A celery_app worker --loglevel=info -Q scans --concurrency=4
"""
import asyncio
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from celery_app import celery_app
from app.core.config import settings
from app.models.scan import ScanStatus, ScanType

logger = logging.getLogger(__name__)


def _nmap_target(target: str) -> str:
    """Extract bare hostname/IP for nmap from a target that may be a URL."""
    if target.startswith(("http://", "https://")):
        parsed = urlparse(target)
        return parsed.hostname or target
    return target


def _web_target(target: str) -> str:
    """Ensure the target is a full URL for web assessment."""
    if not target.startswith(("http://", "https://")):
        return "http://" + target
    return target


async def _execute_scan(scan_id: str) -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    try:
        scan = await db.scans.find_one({"_id": ObjectId(scan_id)})
        if not scan:
            logger.warning("Scan %s not found — skipping.", scan_id)
            return

        if scan["status"] == ScanStatus.CANCELLED.value:
            return

        now = datetime.now(timezone.utc)
        await db.scans.update_one(
            {"_id": ObjectId(scan_id)},
            {"$set": {"status": ScanStatus.RUNNING.value, "started_at": now, "updated_at": now}},
        )

        scan_type = scan["scan_type"]
        target    = scan["target"]
        options   = scan.get("options", {})

        from app.services import recon_service, vuln_service, risk_service

        # ── Phase 1: Reconnaissance (nmap) ────────────────────────────────────
        hosts = []
        if scan_type in (ScanType.RECONNAISSANCE.value, ScanType.VULNERABILITY.value,
                         ScanType.FULL.value):
            nmap_host = _nmap_target(target)
            hosts = await recon_service.run_nmap_scan(nmap_host, options)
            recon_data = [
                {
                    "ip": h.ip,
                    "hostname": h.hostname,
                    "os": h.os_guess,
                    "ports": [
                        {
                            "port": p.port,
                            "protocol": p.protocol,
                            "service": p.service,
                            "version": p.version,
                            "extra_info": p.extra_info,
                        }
                        for p in h.ports
                    ],
                }
                for h in hosts
            ]
            await db.scans.update_one(
                {"_id": ObjectId(scan_id)},
                {"$set": {"recon_results": recon_data, "updated_at": datetime.now(timezone.utc)}},
            )

        # ── Phase 2: Vulnerability Correlation (NVD CVE lookup) ───────────────
        if hosts and scan_type in (ScanType.VULNERABILITY.value, ScanType.FULL.value):
            await vuln_service.correlate_vulnerabilities(db, scan_id, hosts)

        # ── Phase 3: Web Assessment (OWASP checks) ────────────────────────────
        if scan_type in (ScanType.WEB_ASSESSMENT.value, ScanType.FULL.value):
            from app.services import web_service
            web_url = _web_target(target)
            web_results = await web_service.run_web_assessment(db, scan_id, web_url, options)
            await db.scans.update_one(
                {"_id": ObjectId(scan_id)},
                {"$set": {"web_results": web_results, "updated_at": datetime.now(timezone.utc)}},
            )

        # ── Risk Summary (aggregates all phases) ──────────────────────────────
        risk_summary = await risk_service.compute_risk_summary(db, scan_id)

        now = datetime.now(timezone.utc)
        await db.scans.update_one(
            {"_id": ObjectId(scan_id)},
            {"$set": {
                "status": ScanStatus.COMPLETED.value,
                "risk_summary": risk_summary,
                "completed_at": now,
                "updated_at": now,
            }},
        )
        logger.info("Scan %s completed successfully.", scan_id)

    except Exception as exc:
        logger.exception("Scan %s failed: %s", scan_id, exc)
        now = datetime.now(timezone.utc)
        await db.scans.update_one(
            {"_id": ObjectId(scan_id)},
            {"$set": {
                "status": ScanStatus.FAILED.value,
                "error": str(exc),
                "completed_at": now,
                "updated_at": now,
            }},
        )
    finally:
        client.close()


@celery_app.task(
    bind=True,
    name="app.tasks.scan_tasks.run_scan_task",
    max_retries=0,
    acks_late=True,
)
def run_scan_task(self, scan_id: str) -> None:
    asyncio.run(_execute_scan(scan_id))
