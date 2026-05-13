"""
Create the application admin account.

Run from the server/ directory:
    python create_admin.py
"""
import asyncio
from app.core.config import settings
from app.core.security import hash_password
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone


ADMIN = {
    "username":  "superadmin",
    "email":     "admin@securex.pro",
    "password":  "Admin@1234",
    "full_name": "System Admin",
    "role":      "admin",
}


async def create():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    existing = await db.users.find_one({"email": ADMIN["email"]})
    if existing:
        print(f"Admin account already exists: {ADMIN['email']}")
        client.close()
        return

    now = datetime.now(timezone.utc)
    await db.users.insert_one({
        "username":         ADMIN["username"],
        "email":            ADMIN["email"],
        "hashed_password":  hash_password(ADMIN["password"]),
        "full_name":        ADMIN["full_name"],
        "role":             ADMIN["role"],
        "status":           "active",
        "created_at":       now,
        "updated_at":       now,
        "last_login":       None,
        "reset_token":      None,
        "reset_token_expires": None,
    })

    print("Admin account created:")
    print(f"  Email:    {ADMIN['email']}")
    print(f"  Password: {ADMIN['password']}")
    print(f"  Role:     {ADMIN['role']}")

    client.close()


if __name__ == "__main__":
    asyncio.run(create())
