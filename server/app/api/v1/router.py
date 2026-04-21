from fastapi import APIRouter
from app.api.v1.endpoints import auth, scans, vulnerabilities, dashboard, reports

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(scans.router)
api_router.include_router(vulnerabilities.router)
api_router.include_router(dashboard.router)
api_router.include_router(reports.router)
