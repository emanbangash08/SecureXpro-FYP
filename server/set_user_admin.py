"""Promote saboor8778@gmail.com (or any user) to admin role."""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

TARGET_EMAIL = "saboor8778@gmail.com"

async def main() -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    user = await db.users.find_one({"email": TARGET_EMAIL})
    if not user:
        print(f"[ERROR] No user found with email: {TARGET_EMAIL}")
        client.close()
        return

    print(f"Found: {user.get('email')} | current role={user.get('role')} | status={user.get('status')}")

    res = await db.users.update_one(
        {"email": TARGET_EMAIL},
        {"$set": {"role": "admin", "status": "active"}}
    )
    print(f"Updated: matched={res.matched_count} modified={res.modified_count}")

    updated = await db.users.find_one({"email": TARGET_EMAIL})
    print(f"New role: {updated.get('role')}")
    client.close()

asyncio.run(main())
