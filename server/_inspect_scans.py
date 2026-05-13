import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def main():
    c = AsyncIOMotorClient(settings.MONGODB_URL)
    db = c[settings.MONGODB_DB_NAME]
    scans = await db.scans.find({}, sort=[('created_at', -1)]).limit(5).to_list(None)
    for s in scans:
        print(f"id={str(s['_id'])[-6:]} target={s.get('target')} status={s.get('status')} phase={s.get('current_phase')} created={s.get('created_at')}")
    c.close()
asyncio.run(main())
