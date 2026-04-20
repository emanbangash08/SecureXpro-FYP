from pydantic import BaseModel, field_validator
from datetime import datetime
from app.models.scan import ScanStatus, ScanType


class ScanCreate(BaseModel):
    target: str
    scan_type: ScanType
    options: dict = {}

    @field_validator("target")
    @classmethod
    def target_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Target cannot be empty")
        return v.strip()


class ScanOut(BaseModel):
    id: str
    user_id: str
    target: str
    scan_type: ScanType
    status: ScanStatus
    options: dict
    risk_summary: dict | None = None
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class ScanStatusUpdate(BaseModel):
    status: ScanStatus
    error: str | None = None


class ScanListOut(BaseModel):
    total: int
    items: list[ScanOut]
