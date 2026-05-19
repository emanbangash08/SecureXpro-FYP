"""
Audit service — write action logs and detect anomalies.

Action format:  <domain>.<verb>   e.g.  auth.login, scan.create
Outcome values: success | failure | banned | invalid_token | unknown_email | issued
"""
import logging
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.audit_log import audit_log_document

logger = logging.getLogger(__name__)


# ── Write ─────────────────────────────────────────────────────────────────────

def _meta(request: Request | None) -> dict:
    if request is None:
        return {"ip": None, "user_agent": None}
    client = request.client
    return {
        "ip": client.host if client else None,
        "user_agent": request.headers.get("user-agent"),
    }


async def log_action(
    db: AsyncIOMotorDatabase,
    action: str,
    outcome: str,
    *,
    user_id: str | None = None,
    username: str | None = None,
    request: Request | None = None,
    details: dict | None = None,
) -> None:
    """Fire-and-forget audit write. Never raises."""
    try:
        meta = _meta(request)
        doc = audit_log_document(
            action,
            outcome,
            user_id=user_id,
            username=username,
            ip=meta["ip"],
            user_agent=meta["user_agent"],
            details=details,
        )
        await db.audit_logs.insert_one(doc)
    except Exception as exc:
        logger.warning("Audit log write failed (%s/%s): %s", action, outcome, exc)


# ── Query ─────────────────────────────────────────────────────────────────────

async def list_audit_logs(
    db: AsyncIOMotorDatabase,
    *,
    user_id: str | None = None,
    action: str | None = None,
    outcome: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    skip: int = 0,
    limit: int = 100,
) -> dict:
    filt: dict = {}
    if user_id:
        filt["user_id"] = user_id
    if action:
        filt["action"] = {"$regex": action, "$options": "i"}
    if outcome:
        filt["outcome"] = outcome
    if date_from or date_to:
        date_filt: dict = {}
        if date_from:
            date_filt["$gte"] = date_from
        if date_to:
            date_filt["$lte"] = date_to
        filt["created_at"] = date_filt

    total = await db.audit_logs.count_documents(filt)
    cursor = (
        db.audit_logs.find(filt)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    items = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        items.append(doc)
    return {"total": total, "items": items}


# ── Anomaly detection ─────────────────────────────────────────────────────────

async def get_anomalies(db: AsyncIOMotorDatabase) -> list[dict]:
    """
    Run a fixed set of heuristic rules over audit_logs and scans and return
    a list of anomaly dicts. Each dict has: type, severity, description,
    detected_at, and context fields.
    """
    now = datetime.now(timezone.utc)
    anomalies: list[dict] = []

    # ── Rule 1: Brute-force login (5+ failures from same IP in 15 min) ────────
    cutoff_15m = now - timedelta(minutes=15)
    pipeline = [
        {"$match": {
            "action": "auth.login",
            "outcome": "failure",
            "created_at": {"$gte": cutoff_15m},
            "ip": {"$ne": None},
        }},
        {"$group": {"_id": "$ip", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gte": 5}}},
    ]
    async for doc in db.audit_logs.aggregate(pipeline):
        anomalies.append({
            "type": "brute_force",
            "severity": "high",
            "description": f"IP {doc['_id']} made {doc['count']} failed login attempts in the last 15 minutes.",
            "ip": doc["_id"],
            "count": doc["count"],
            "detected_at": now.isoformat(),
        })

    # ── Rule 2: Scan flood (5+ scans by same user in 60 min) ─────────────────
    cutoff_1h = now - timedelta(hours=1)
    pipeline = [
        {"$match": {
            "action": "scan.create",
            "outcome": "success",
            "created_at": {"$gte": cutoff_1h},
        }},
        {"$group": {
            "_id": "$user_id",
            "count": {"$sum": 1},
            "username": {"$first": "$username"},
        }},
        {"$match": {"count": {"$gte": 5}}},
    ]
    async for doc in db.audit_logs.aggregate(pipeline):
        anomalies.append({
            "type": "scan_flood",
            "severity": "medium",
            "description": f"User '{doc['username']}' created {doc['count']} scans in the last hour.",
            "user_id": doc["_id"],
            "username": doc["username"],
            "count": doc["count"],
            "detected_at": now.isoformat(),
        })

    # ── Rule 3: Banned account login attempts (last 24 h) ────────────────────
    cutoff_24h = now - timedelta(hours=24)
    pipeline = [
        {"$match": {
            "action": "auth.login",
            "outcome": "banned",
            "created_at": {"$gte": cutoff_24h},
        }},
        {"$group": {
            "_id": "$username",
            "count": {"$sum": 1},
            "last_attempt": {"$max": "$created_at"},
            "user_id": {"$first": "$user_id"},
        }},
    ]
    async for doc in db.audit_logs.aggregate(pipeline):
        anomalies.append({
            "type": "banned_login",
            "severity": "high",
            "description": f"Banned account '{doc['_id']}' attempted to log in {doc['count']} time(s) in the last 24 hours.",
            "username": doc["_id"],
            "user_id": doc.get("user_id"),
            "count": doc["count"],
            "last_attempt": doc["last_attempt"].isoformat() if doc.get("last_attempt") else None,
            "detected_at": now.isoformat(),
        })

    # ── Rule 4: Mass scan failures (3+ failed scans per user in 24 h) ─────────
    async for doc in db.scans.aggregate([
        {"$match": {"status": "failed", "updated_at": {"$gte": cutoff_24h}}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gte": 3}}},
    ]):
        uid = doc["_id"]
        user_doc = await db.users.find_one(
            {"_id": ObjectId(uid)}, {"username": 1}
        ) if uid else None
        uname = user_doc["username"] if user_doc else uid
        anomalies.append({
            "type": "scan_failures",
            "severity": "medium",
            "description": f"User '{uname}' had {doc['count']} failed scans in the last 24 hours.",
            "user_id": uid,
            "username": uname,
            "count": doc["count"],
            "detected_at": now.isoformat(),
        })

    # ── Rule 5: Privilege escalation (user role changed to admin in 24 h) ─────
    pipeline = [
        {"$match": {
            "action": "admin.user_update",
            "created_at": {"$gte": cutoff_24h},
            "details.role": "admin",
        }},
    ]
    async for doc in db.audit_logs.aggregate(pipeline):
        anomalies.append({
            "type": "privilege_escalation",
            "severity": "critical",
            "description": (
                f"Admin '{doc.get('username')}' granted admin role to user "
                f"'{doc.get('details', {}).get('target_username', 'unknown')}' in the last 24 hours."
            ),
            "actor_username": doc.get("username"),
            "target_username": doc.get("details", {}).get("target_username"),
            "detected_at": now.isoformat(),
        })

    # ── Rule 6: Account deletion surge (3+ deletes in 1 h by same admin) ──────
    pipeline = [
        {"$match": {
            "action": "admin.user_delete",
            "outcome": "success",
            "created_at": {"$gte": cutoff_1h},
        }},
        {"$group": {
            "_id": "$user_id",
            "count": {"$sum": 1},
            "username": {"$first": "$username"},
        }},
        {"$match": {"count": {"$gte": 3}}},
    ]
    async for doc in db.audit_logs.aggregate(pipeline):
        anomalies.append({
            "type": "bulk_deletion",
            "severity": "critical",
            "description": f"Admin '{doc['username']}' deleted {doc['count']} accounts in the last hour.",
            "actor_username": doc["username"],
            "count": doc["count"],
            "detected_at": now.isoformat(),
        })

    return anomalies
