from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import require_admin
from app.schemas.user import UserOut

router = APIRouter(prefix="/settings", tags=["Settings"])

_SETTINGS_KEY = {"_type": "platform"}


class ScanDefaults(BaseModel):
    intensity: str = "normal"
    thread_count: int = 16
    timeout: int = 300


class SettingsOut(BaseModel):
    organization_name: str = "SecureX Pro"
    admin_email: str = ""
    timezone: str = "UTC"
    email_notifications: bool = True
    notify_critical: bool = True
    notify_scan_complete: bool = True
    notify_agent_status: bool = True
    scan_defaults: ScanDefaults = ScanDefaults()
    updated_at: datetime | None = None


class SettingsUpdate(BaseModel):
    organization_name: str | None = None
    admin_email: str | None = None
    timezone: str | None = None
    email_notifications: bool | None = None
    notify_critical: bool | None = None
    notify_scan_complete: bool | None = None
    notify_agent_status: bool | None = None
    scan_defaults: ScanDefaults | None = None


def _doc_to_settings(doc: dict) -> SettingsOut:
    doc = {k: v for k, v in doc.items() if k not in ("_id", "_type")}
    if "scan_defaults" in doc and isinstance(doc["scan_defaults"], dict):
        doc["scan_defaults"] = ScanDefaults(**doc["scan_defaults"])
    valid = SettingsOut.model_fields.keys()
    return SettingsOut(**{k: v for k, v in doc.items() if k in valid})


@router.get("/", response_model=SettingsOut)
async def get_settings(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(require_admin),
):
    doc = await db.settings.find_one(_SETTINGS_KEY)
    if not doc:
        return SettingsOut()
    return _doc_to_settings(doc)


@router.put("/", response_model=SettingsOut)
async def update_settings(
    data: SettingsUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(require_admin),
):
    updates = data.model_dump(exclude_none=True)
    if "scan_defaults" in updates:
        updates["scan_defaults"] = updates["scan_defaults"]
    updates["updated_at"] = datetime.now(timezone.utc)

    await db.settings.update_one(
        _SETTINGS_KEY,
        {"$set": updates},
        upsert=True,
    )
    doc = await db.settings.find_one(_SETTINGS_KEY)
    return _doc_to_settings(doc)
