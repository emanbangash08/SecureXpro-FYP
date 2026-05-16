import asyncio
from datetime import datetime, timezone
from app.core.config import settings
from app.core.security import hash_password
from motor.motor_asyncio import AsyncIOMotorClient

EMAIL    = "superadmin@securex.pro"
PASSWORD = "Admin@123"
USERNAME = "admin"

async def create():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    existing = await db.users.find_one({"email": EMAIL})
    if existing:
        await db.users.update_one(
            {"email": EMAIL},
            {"$set": {"password": hash_password(PASSWORD), "role": "admin", "status": "active"}}
        )
        print(f"Updated existing account -> {EMAIL}")
    else:
        await db.users.insert_one({
            "email":      EMAIL,
            "username":   USERNAME,
            "full_name":  "Super Admin",
            "password":   hash_password(PASSWORD),
            "role":       "admin",
            "status":     "active",
            "created_at": datetime.now(timezone.utc),
            "last_login": None,
        })
        print(f"Created new admin account -> {EMAIL}")

    print(f"\n  Email:    {EMAIL}")
    print(f"  Password: {PASSWORD}")
    client.close()

asyncio.run(create())
