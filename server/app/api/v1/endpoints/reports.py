from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

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
    doc = report_document(data.scan_id, current_user.id, data.title, data.format)
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
    from bson import ObjectId
    from fastapi import HTTPException, status
    doc = await db.reports.find_one({"_id": ObjectId(report_id), "user_id": current_user.id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return ReportOut(**doc_to_out(doc))
