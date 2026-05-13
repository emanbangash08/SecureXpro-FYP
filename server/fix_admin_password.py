"""One-off helper to upsert the SecureX admin account with the canonical hashed_password field."""
import asyncio
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.core.security import hash_password, verify_password


EMAIL = "admin@securex.pro"
PASSWORD = "Admin@SecureX1"
USERNAME = "admin"
FULL_NAME = "SecureX Admin"


async def main() -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    print("Existing users:")
    async for u in db.users.find({}, {"email": 1, "hashed_password": 1, "password": 1, "role": 1, "status": 1}):
        print(
            f"  - {u.get('email')} | role={u.get('role')} | status={u.get('status')} "
            f"| hashed={bool(u.get('hashed_password'))} | plain={bool(u.get('password'))}"
        )

    res = await db.users.update_one(
        {"email": EMAIL},
        {
            "$set": {
                "email": EMAIL,
                "username": USERNAME,
                "full_name": FULL_NAME,
                "hashed_password": hash_password(PASSWORD),
                "role": "admin",
                "status": "active",
            },
            "$setOnInsert": {
                "created_at": datetime.now(timezone.utc),
                "last_login": None,
            },
            "$unset": {"password": ""},
        },
        upsert=True,
    )
    print(f"\nupsert matched={res.matched_count} modified={res.modified_count} upserted_id={res.upserted_id}")

    u = await db.users.find_one({"email": EMAIL})
    print(f"verify({PASSWORD!r}) -> {verify_password(PASSWORD, u['hashed_password'])}")
    client.close()


asyncio.run(main())
