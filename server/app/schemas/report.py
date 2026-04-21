from pydantic import BaseModel
from datetime import datetime
from app.models.report import ReportFormat


class ReportCreate(BaseModel):
    scan_id: str
    title: str
    format: ReportFormat = ReportFormat.PDF


class ReportOut(BaseModel):
    id: str
    scan_id: str
    user_id: str
    title: str
    format: ReportFormat
    file_path: str
    generated: bool
    created_at: datetime
