"""
Agent service — operations for the distributed scanning runtime.

Lifecycle:
  1. User creates a scan with `assigned_agent_id=<agent_user_id>`. The scan
     is saved with status=PENDING_AGENT (see scan_service.create_scan) and is
     NOT pushed onto the Celery queue.
  2. The agent runtime (server/agent_runtime/agent.py) logs in as the agent
     user, polls `GET /agents/me/next-scan`, runs Nmap locally, and uploads
     the XML via `POST /agents/me/scan-results/{scan_id}`.
  3. submit_agent_result() parses the XML into the same HostResult shape the
     in-process recon service produces, stores it on the scan document, and
     dispatches a Celery task to continue with Phase 2+ (vuln correlation,
     exploit analysis, risk scoring) on the central server.
"""
from datetime import datetime, timezone, timedelta

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.scan import ScanStatus
from app.services.recon_service import _parse_nmap_xml


# An agent is considered "online" if it has heart-beat within this window.
AGENT_ONLINE_WINDOW_SECONDS = 60


# ── Polling ───────────────────────────────────────────────────────────────────

async def get_next_scan_for_agent(
    db: AsyncIOMotorDatabase, agent_id: str
) -> dict | None:
    """
    Return the oldest PENDING_AGENT scan assigned to this agent and mark it
    as dispatched. Atomic via find_one_and_update so two pollers can't grab
    the same scan.
    """
    now = datetime.now(timezone.utc)
    doc = await db.scans.find_one_and_update(
        {
            "assigned_agent_id": agent_id,
            "status": ScanStatus.PENDING_AGENT.value,
        },
        {
            "$set": {
                "agent_dispatched_at": now,
                "updated_at": now,
            },
        },
        sort=[("created_at", 1)],
    )
    if not doc:
        return None
    return {
        "scan_id": str(doc["_id"]),
        "target": doc["target"],
        "scan_type": doc["scan_type"],
        "options": doc.get("options") or {},
    }


# ── Result submission ─────────────────────────────────────────────────────────

async def submit_agent_result(
    db: AsyncIOMotorDatabase,
    scan_id: str,
    agent_id: str,
    nmap_xml: str,
) -> dict:
    """
    Persist the agent-supplied Nmap XML, parse it, and dispatch the central
    Celery worker to run Phase 2+ (vuln correlation, exploit, risk).
    """
    try:
        oid = ObjectId(scan_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found"
        )

    scan = await db.scans.find_one({"_id": oid})
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found"
        )

    # Agent may only submit for scans actually assigned to it.
    if scan.get("assigned_agent_id") != agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This scan is not assigned to you",
        )

    if scan["status"] not in (
        ScanStatus.PENDING_AGENT.value,
        ScanStatus.PENDING.value,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Scan already in status '{scan['status']}'; cannot accept result.",
        )

    hosts = _parse_nmap_xml(nmap_xml)
    recon_results = [
        {
            "ip": h.ip,
            "hostname": h.hostname,
            "os_guess": h.os_guess,
            "ports": [
                {
                    "port": p.port,
                    "protocol": p.protocol,
                    "state": p.state,
                    "service": p.service,
                    "version": p.version,
                    "extra_info": p.extra_info,
                }
                for p in h.ports
            ],
        }
        for h in hosts
    ]

    now = datetime.now(timezone.utc)
    await db.scans.update_one(
        {"_id": oid},
        {
            "$set": {
                "recon_results": recon_results,
                "status": ScanStatus.PENDING.value,
                "agent_result_received_at": now,
                "updated_at": now,
            }
        },
    )

    # Hand off to the central Celery worker. scan_tasks._execute_scan Phase 1
    # detects pre-populated recon_results + assigned_agent_id and skips nmap,
    # falling straight through to vuln correlation / exploit / risk phases.
    from app.tasks.scan_tasks import run_scan_task
    task = run_scan_task.apply_async(args=[scan_id], queue="scans")
    await db.scans.update_one(
        {"_id": oid},
        {"$set": {"task_id": task.id, "updated_at": datetime.now(timezone.utc)}},
    )

    return {
        "scan_id": scan_id,
        "hosts_parsed": len(recon_results),
        "task_id": task.id,
    }


# ── Heartbeat & availability ──────────────────────────────────────────────────

async def update_heartbeat(db: AsyncIOMotorDatabase, agent_id: str) -> dict:
    """
    Bump the agent's last-seen timestamp. Stored on the user document under
    `agent_last_seen` so list_available_agents can filter by recency.
    """
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"_id": ObjectId(agent_id), "role": "agent"},
        {"$set": {"agent_last_seen": now}},
    )
    return {"last_seen": now}


async def list_scans_for_agent(
    db: AsyncIOMotorDatabase, agent_id: str, limit: int = 50
) -> list[dict]:
    """
    Return scans assigned to this agent across all statuses, newest first.
    Used by the agent dashboard to show the queue + history.
    """
    cursor = (
        db.scans.find({"assigned_agent_id": agent_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    items: list[dict] = []
    async for s in cursor:
        items.append({
            "id":                          str(s["_id"]),
            "user_id":                     s.get("user_id"),
            "target":                      s.get("target"),
            "scan_type":                   s.get("scan_type"),
            "status":                      s.get("status"),
            "options":                     s.get("options") or {},
            "current_phase":               s.get("current_phase"),
            "exploit_count":               s.get("exploit_count", 0),
            "error":                       s.get("error"),
            "created_at":                  s.get("created_at"),
            "agent_dispatched_at":         s.get("agent_dispatched_at"),
            "agent_result_received_at":    s.get("agent_result_received_at"),
            "started_at":                  s.get("started_at"),
            "completed_at":                s.get("completed_at"),
        })
    return items


def _is_recent(last_seen: datetime | None, cutoff: datetime) -> bool:
    """
    Compare two datetimes safely. Mongo round-trips strip tzinfo, so a value
    written as aware-UTC comes back naive. Normalise both sides to naive-UTC
    before comparing to avoid `can't compare offset-naive and offset-aware`.
    """
    if not last_seen:
        return False
    ls = last_seen.replace(tzinfo=None) if last_seen.tzinfo else last_seen
    co = cutoff.replace(tzinfo=None) if cutoff.tzinfo else cutoff
    return ls >= co


async def get_agent_self(db: AsyncIOMotorDatabase, agent_id: str) -> dict:
    """
    Return the agent's own profile + derived CLI online status.
    Lets the agent dashboard show whether the runtime is reaching the server.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(
        seconds=AGENT_ONLINE_WINDOW_SECONDS
    )
    user = await db.users.find_one(
        {"_id": ObjectId(agent_id), "role": "agent"},
        {"_id": 1, "username": 1, "full_name": 1, "agent_last_seen": 1},
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found"
        )
    last_seen = user.get("agent_last_seen")
    return {
        "id":         str(user["_id"]),
        "username":   user.get("username", ""),
        "full_name":  user.get("full_name", ""),
        "last_seen":  last_seen,
        "online":     _is_recent(last_seen, cutoff),
    }


async def list_available_agents(db: AsyncIOMotorDatabase) -> list[dict]:
    """
    Return all active agents and a derived `online` flag based on recent
    heart-beat. Used by the scan-creation form's agent dropdown.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(
        seconds=AGENT_ONLINE_WINDOW_SECONDS
    )
    cursor = db.users.find(
        {"role": "agent", "status": "active"},
        {"_id": 1, "username": 1, "full_name": 1, "agent_last_seen": 1},
    ).sort("username", 1)

    out: list[dict] = []
    async for u in cursor:
        last_seen = u.get("agent_last_seen")
        out.append({
            "id":          str(u["_id"]),
            "username":    u.get("username", ""),
            "full_name":   u.get("full_name", ""),
            "last_seen":   last_seen,
            "online":      _is_recent(last_seen, cutoff),
        })
    return out
