from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import HTTPException, status

from app.models.scan import scan_document, ScanStatus, ScanType
from app.schemas.scan import ScanCreate, ScanOut, ScanListOut
from app.utils.helpers import doc_to_out


async def create_scan(db: AsyncIOMotorDatabase, user_id: str, data: ScanCreate) -> ScanOut:
    doc = scan_document(user_id, data.target, data.scan_type, data.options)
    result = await db.scans.insert_one(doc)
    created = await db.scans.find_one({"_id": result.inserted_id})
    return ScanOut(**doc_to_out(created))


async def get_scan(db: AsyncIOMotorDatabase, scan_id: str, user_id: str) -> ScanOut:
    scan = await db.scans.find_one({"_id": ObjectId(scan_id), "user_id": user_id})
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    return ScanOut(**doc_to_out(scan))


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


async def update_scan_status(
    db: AsyncIOMotorDatabase,
    scan_id: str,
    new_status: ScanStatus,
    error: str | None = None,
) -> None:
    update: dict = {
        "status": new_status.value,
        "updated_at": datetime.now(timezone.utc),
    }
    if new_status == ScanStatus.RUNNING:
        update["started_at"] = datetime.now(timezone.utc)
    if new_status in (ScanStatus.COMPLETED, ScanStatus.FAILED, ScanStatus.CANCELLED):
        update["completed_at"] = datetime.now(timezone.utc)
    if error:
        update["error"] = error

    await db.scans.update_one({"_id": ObjectId(scan_id)}, {"$set": update})


async def delete_scan(db: AsyncIOMotorDatabase, scan_id: str, user_id: str) -> None:
    result = await db.scans.delete_one({"_id": ObjectId(scan_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    await db.vulnerabilities.delete_many({"scan_id": scan_id})
    await db.reports.delete_many({"scan_id": scan_id})
