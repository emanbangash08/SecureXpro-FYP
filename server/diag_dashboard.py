import asyncio
from app.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    # Check user
    user = await db.users.find_one({"email": "saboor8778@gmail.com"})
    uid_str = str(user["_id"])
    print(f"User ID (string): {uid_str}")
    print(f"User ID type in doc: {type(user['_id'])}")

    # Check what type user_id is stored as in scans
    scan = await db.scans.find_one({"user_id": {"$exists": True}})
    if scan:
        print(f"\nScan user_id value: {scan.get('user_id')}")
        print(f"Scan user_id type: {type(scan.get('user_id'))}")

    # Try query with string comparison
    count_str = await db.scans.count_documents({"user_id": uid_str})
    print(f"\nScans found with string user_id match: {count_str}")

    # Try query with ObjectId comparison
    from bson import ObjectId
    count_oid = await db.scans.count_documents({"user_id": ObjectId(uid_str)})
    print(f"Scans found with ObjectId user_id match: {count_oid}")

    # Check all distinct user_id types in scans
    print("\nAll distinct user_id values in scans:")
    async for s in db.scans.find({}, {"user_id": 1, "_id": 0}):
        uid = s.get("user_id")
        print(f"  value={uid!r}  type={type(uid).__name__}")
        break  # just show the first one to understand type

    client.close()

asyncio.run(main())
