"""
Agent endpoints — used by the distributed scanning runtime.

All `/agents/me/*` routes require the bearer token to belong to a user with
role=agent. The discovery route `/agents/available` is open to any logged-in
user and feeds the scan-creation form's agent dropdown.
"""
from fastapi import APIRouter, Body, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import UserRole
from app.schemas.user import UserOut
from app.services import agent_service

router = APIRouter(prefix="/agents", tags=["Agents"])


# ── Role gate ─────────────────────────────────────────────────────────────────

async def require_agent(current_user: UserOut = Depends(get_current_user)) -> UserOut:
    if current_user.role != UserRole.AGENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent role required",
        )
    return current_user


# ── Agent-runtime routes (require agent role) ─────────────────────────────────

@router.get("/me/next-scan")
async def next_scan(
    db: AsyncIOMotorDatabase = Depends(get_db),
    agent: UserOut = Depends(require_agent),
):
    """
    Atomically claim the oldest PENDING_AGENT scan for this agent.
    Returns 204 No Content when there is nothing to do.
    """
    job = await agent_service.get_next_scan_for_agent(db, agent.id)
    if not job:
        # 204 keeps the polling loop cheap — no JSON body to parse.
        from fastapi import Response
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return job


@router.post("/me/scan-results/{scan_id}")
async def submit_result(
    scan_id: str,
    payload: dict = Body(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    agent: UserOut = Depends(require_agent),
):
    """
    Upload the raw Nmap XML produced on the agent's network. The server
    parses it, persists recon_results, and hands the scan to the central
    Celery worker for Phase 2+ (vuln correlation, exploit, risk).
    """
    nmap_xml = (payload or {}).get("nmap_xml")
    if not isinstance(nmap_xml, str) or not nmap_xml.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Body must include 'nmap_xml' as a non-empty string",
        )
    return await agent_service.submit_agent_result(db, scan_id, agent.id, nmap_xml)


@router.post("/me/heartbeat")
async def heartbeat(
    db: AsyncIOMotorDatabase = Depends(get_db),
    agent: UserOut = Depends(require_agent),
):
    """Bump the agent's last-seen timestamp so the UI can show it online."""
    return await agent_service.update_heartbeat(db, agent.id)


@router.get("/me/scans")
async def my_scans(
    limit: int = 50,
    db: AsyncIOMotorDatabase = Depends(get_db),
    agent: UserOut = Depends(require_agent),
):
    """List scans assigned to this agent (any status) for the dashboard view."""
    return await agent_service.list_scans_for_agent(db, agent.id, limit)


@router.get("/me")
async def me(
    db: AsyncIOMotorDatabase = Depends(get_db),
    agent: UserOut = Depends(require_agent),
):
    """Return the agent's own profile + derived CLI online status."""
    return await agent_service.get_agent_self(db, agent.id)


# ── Discovery route (any logged-in user) ──────────────────────────────────────

@router.get("/available")
async def available(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: UserOut = Depends(get_current_user),
):
    """List active agents with `online` derived from recent heartbeat."""
    return await agent_service.list_available_agents(db)
