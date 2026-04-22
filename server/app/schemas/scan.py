from pydantic import BaseModel, field_validator
from datetime import datetime
from app.models.scan import ScanStatus, ScanType


class ScanOptions(BaseModel):
    # Network scan options
    port_range: str = "1-1000"
    os_detection: bool = False
    aggressive: bool = False
    udp: bool = False
    nse_scripts: bool = False
    traceroute: bool = False
    intensity: str = "T4"           # T3 | T4 | T5
    # Web assessment options
    check_sensitive_paths: bool = True
    check_ssl: bool = True


class ScanCreate(BaseModel):
    target: str
    scan_type: ScanType
    options: ScanOptions = ScanOptions()

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
    task_id: str | None = None
    current_phase: str | None = None
    recon_results: list | None = None
    vuln_results: dict | None = None
    web_results: dict | None = None
    risk_summary: dict | None = None
    exploit_count: int = 0
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
