from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.models.scan import scan_document, ScanStatus, ScanType
from app.schemas.scan import ScanCreate, ScanOut, ScanListOut
from app.utils.helpers import doc_to_out


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_scan_or_404(db: AsyncIOMotorDatabase, scan_id: str, user_id: str) -> dict:
    try:
        oid = ObjectId(scan_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    doc = await db.scans.find_one({"_id": oid, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    return doc


async def _check_concurrency(db: AsyncIOMotorDatabase, user_id: str) -> None:
    active = await db.scans.count_documents({
        "user_id": user_id,
        "status": {"$in": [ScanStatus.PENDING.value, ScanStatus.RUNNING.value]},
    })
    if active >= settings.MAX_CONCURRENT_SCANS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"You already have {active} active scan(s). "
                f"Maximum concurrent scans per user: {settings.MAX_CONCURRENT_SCANS_PER_USER}."
            ),
        )


def _dispatch_task(scan_id: str) -> str:
    """Submit a scan to the Celery queue and return the task ID."""
    from app.tasks.scan_tasks import run_scan_task
    task = run_scan_task.apply_async(args=[scan_id], queue="scans")
    return task.id


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def create_scan(db: AsyncIOMotorDatabase, user_id: str, data: ScanCreate) -> ScanOut:
    await _check_concurrency(db, user_id)

    doc = scan_document(user_id, data.target, data.scan_type, data.options.model_dump())
    result = await db.scans.insert_one(doc)
    scan_id = str(result.inserted_id)

    task_id = _dispatch_task(scan_id)

    await db.scans.update_one(
        {"_id": result.inserted_id},
        {"$set": {"task_id": task_id, "updated_at": datetime.now(timezone.utc)}},
    )

    created = await db.scans.find_one({"_id": result.inserted_id})
    return ScanOut(**doc_to_out(created))


async def get_scan(db: AsyncIOMotorDatabase, scan_id: str, user_id: str) -> ScanOut:
    doc = await _get_scan_or_404(db, scan_id, user_id)
    return ScanOut(**doc_to_out(doc))


async def list_scans(
    db: AsyncIOMotorDatabase,
    user_id: str,
    skip: int = 0,
    limit: int = 20,
    scan_type: ScanType | None = None,
    scan_status: ScanStatus | None = None,
) -> ScanListOut:
    query: dict = {"user_id": user_id}
    if scan_type:
        query["scan_type"] = scan_type.value
    if scan_status:
        query["status"] = scan_status.value

    total = await db.scans.count_documents(query)
    cursor = db.scans.find(query).sort("created_at", -1).skip(skip).limit(limit)
    items = [ScanOut(**doc_to_out(doc)) async for doc in cursor]
    return ScanListOut(total=total, items=items)


async def delete_scan(db: AsyncIOMotorDatabase, scan_id: str, user_id: str) -> None:
    doc = await _get_scan_or_404(db, scan_id, user_id)

    # Revoke the Celery task if still queued/running so the worker stops
    task_id = doc.get("task_id")
    if task_id and doc["status"] in (ScanStatus.PENDING.value, ScanStatus.RUNNING.value):
        _revoke_task(task_id)

    result = await db.scans.delete_one({"_id": ObjectId(scan_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    await db.vulnerabilities.delete_many({"scan_id": scan_id})
    await db.reports.delete_many({"scan_id": scan_id})


# ── Lifecycle transitions ──────────────────────────────────────────────────────

async def cancel_scan(db: AsyncIOMotorDatabase, scan_id: str, user_id: str) -> ScanOut:
    doc = await _get_scan_or_404(db, scan_id, user_id)

    terminal = {ScanStatus.COMPLETED.value, ScanStatus.FAILED.value, ScanStatus.CANCELLED.value}
    if doc["status"] in terminal:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel a scan with status '{doc['status']}'.",
        )

    task_id = doc.get("task_id")
    if task_id:
        _revoke_task(task_id)

    now = datetime.now(timezone.utc)
    await db.scans.update_one(
        {"_id": ObjectId(scan_id)},
        {"$set": {"status": ScanStatus.CANCELLED.value, "completed_at": now, "updated_at": now}},
    )
    updated = await db.scans.find_one({"_id": ObjectId(scan_id)})
    return ScanOut(**doc_to_out(updated))


async def retry_scan(db: AsyncIOMotorDatabase, scan_id: str, user_id: str) -> ScanOut:
    doc = await _get_scan_or_404(db, scan_id, user_id)

    retryable = {ScanStatus.FAILED.value, ScanStatus.CANCELLED.value}
    if doc["status"] not in retryable:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only failed or cancelled scans can be retried.",
        )

    await _check_concurrency(db, user_id)

    now = datetime.now(timezone.utc)
    await db.scans.update_one(
        {"_id": ObjectId(scan_id)},
        {
            "$set": {
                "status": ScanStatus.PENDING.value,
                "task_id": None,
                "error": None,
                "recon_results": None,
                "vuln_results": None,
                "web_results": None,
                "risk_summary": None,
                "started_at": None,
                "completed_at": None,
                "updated_at": now,
            }
        },
    )

    task_id = _dispatch_task(scan_id)

    await db.scans.update_one(
        {"_id": ObjectId(scan_id)},
        {"$set": {"task_id": task_id, "updated_at": datetime.now(timezone.utc)}},
    )

    updated = await db.scans.find_one({"_id": ObjectId(scan_id)})
    return ScanOut(**doc_to_out(updated))


# ── Internal ──────────────────────────────────────────────────────────────────

def _revoke_task(task_id: str) -> None:
    """Tell the Celery broker to revoke a task (terminate if already started)."""
    try:
        from celery_app import celery_app
        celery_app.control.revoke(task_id, terminate=True, signal="SIGTERM")
    except Exception:
        pass  # Best-effort — DB status is the source of truth
