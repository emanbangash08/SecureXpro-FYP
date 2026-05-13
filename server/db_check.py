import asyncio
from app.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    print("=== USERS ===")
    async for u in db.users.find({}, {"email": 1, "role": 1, "username": 1}):
        print(f"  id={u['_id']}  email={u.get('email')}  role={u.get('role')}")

    print("\n=== SCANS (all) ===")
    count = await db.scans.count_documents({})
    print(f"  Total scans in DB: {count}")
    async for s in db.scans.find({}, {"target": 1, "status": 1, "user_id": 1, "scan_type": 1}).limit(10):
        print(f"  id={s['_id']}  user_id={s.get('user_id')}  target={s.get('target')}  status={s.get('status')}")

    print("\n=== VULNERABILITIES (all) ===")
    vcount = await db.vulnerabilities.count_documents({})
    print(f"  Total vulnerabilities in DB: {vcount}")

    client.close()

asyncio.run(main())
