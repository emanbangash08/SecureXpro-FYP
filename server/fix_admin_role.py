import asyncio
from app.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    result = await db.users.update_one(
        {"email": "admin@securex.pro"},
        {"$set": {"role": "admin", "status": "active"}}
    )
    print("Modified:", result.modified_count)

    u = await db.users.find_one({"email": "admin@securex.pro"}, {"email": 1, "role": 1, "status": 1})
    print("Current state:", u)
    client.close()

asyncio.run(fix())
