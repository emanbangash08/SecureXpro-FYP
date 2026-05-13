"""
One-time migration: rename role "admin" → "user" in MongoDB.

Run from the server/ directory:
    python migrate_roles.py

Skip any account whose email matches ADMIN_EMAIL — that account
keeps the "admin" role and becomes the true application admin.
"""
import asyncio
from app.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient

ADMIN_EMAIL = "admin@securex.pro"  # change this to your real admin email


async def migrate():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    result = await db.users.update_many(
        {"role": "admin", "email": {"$ne": ADMIN_EMAIL}},
        {"$set": {"role": "user"}},
    )
    print(f"Migrated {result.modified_count} account(s): admin → user")

    kept = await db.users.count_documents({"role": "admin"})
    print(f"Kept {kept} account(s) with admin role")

    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
