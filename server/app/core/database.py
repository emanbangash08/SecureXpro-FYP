from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from .config import settings

_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    global _client
    _client = AsyncIOMotorClient(settings.MONGODB_URL)
    await _client.admin.command("ping")


async def close_db() -> None:
    global _client
    if _client:
        _client.close()
        _client = None


def get_db() -> AsyncIOMotorDatabase:
    if _client is None:
        raise RuntimeError("Database not connected. Call connect_db() first.")
    return _client[settings.MONGODB_DB_NAME]


async def create_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.scans.create_index("user_id")
    await db.scans.create_index("created_at")
    await db.scans.create_index([("status", 1), ("user_id", 1)])
    await db.scans.create_index("task_id", sparse=True)
    await db.vulnerabilities.create_index("scan_id")
    await db.vulnerabilities.create_index("cve_id")
    await db.vulnerabilities.create_index([("severity", 1), ("scan_id", 1)])
    await db.scan_logs.create_index("scan_id")
    await db.scan_logs.create_index([("scan_id", 1), ("created_at", 1)])
    await db.exploits.create_index("vulnerability_id")
    await db.reports.create_index("scan_id")
    await db.reports.create_index("user_id")
    await db.audit_logs.create_index("user_id")
    await db.audit_logs.create_index("created_at")
