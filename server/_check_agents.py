import asyncio
import motor.motor_asyncio as m
from app.core.config import settings


async def go():
    c = m.AsyncIOMotorClient(settings.MONGODB_URL)
    db = c[settings.MONGODB_DB]
    agents = await db.users.find(
        {"role": "agent"},
        {"username": 1, "email": 1, "role": 1, "status": 1, "agent_last_seen": 1},
    ).to_list(50)
    print(f"Found {len(agents)} agent(s):")
    for a in agents:
        print(f"  {a}")
    await c.close()


asyncio.run(go())
