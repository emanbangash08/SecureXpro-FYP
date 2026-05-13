import asyncio
from app.core.config import settings
from app.core.security import hash_password
from motor.motor_asyncio import AsyncIOMotorClient

NEW_PASSWORD = "Admin@SecureX1"

async def reset():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    hashed = hash_password(NEW_PASSWORD)
    result = await db.users.update_one(
        {"email": "admin@securex.pro"},
        {"$set": {"password": hashed, "role": "admin", "status": "active"}}
    )
    print(f"Modified: {result.modified_count}")
    u = await db.users.find_one({"email": "admin@securex.pro"}, {"email": 1, "role": 1, "status": 1})
    print(f"Admin user: {u}")
    print(f"\nCredentials:")
    print(f"  Email:    admin@securex.pro")
    print(f"  Password: {NEW_PASSWORD}")
    client.close()

asyncio.run(reset())
