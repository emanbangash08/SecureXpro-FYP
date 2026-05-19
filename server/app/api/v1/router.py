from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, scans, vulnerabilities, dashboard, reports,
    scan_logs, admin, settings, exploits, agents, audit,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(scans.router)
api_router.include_router(scan_logs.router)
api_router.include_router(vulnerabilities.router)
api_router.include_router(exploits.router)
api_router.include_router(dashboard.router)
api_router.include_router(reports.router)
api_router.include_router(admin.router)
api_router.include_router(audit.router)
api_router.include_router(settings.router)
api_router.include_router(agents.router)
