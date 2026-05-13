"""
Diagnose and fix admin account.
Run from server/ directory:  python check_admin.py
"""
import asyncio
from app.core.config import settings
from app.core.security import hash_password
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone


async def main():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    print("=== All users in DB ===")
    async for u in db.users.find({}, {"email": 1, "role": 1, "status": 1, "username": 1}):
        print(f"  email={u.get('email')}  role={u.get('role')}  status={u.get('status')}")

    admin = await db.users.find_one({"email": "admin@securex.pro"})
    print()
    if not admin:
        print("❌ admin@securex.pro NOT FOUND — creating it now...")
        now = datetime.now(timezone.utc)
        await db.users.insert_one({
            "username":            "superadmin",
            "email":               "admin@securex.pro",
            "hashed_password":     hash_password("Admin@1234"),
            "full_name":           "System Admin",
            "role":                "admin",
            "status":              "active",
            "created_at":          now,
            "updated_at":          now,
            "last_login":          None,
            "reset_token":         None,
            "reset_token_expires": None,
        })
        print("✅ Created  admin@securex.pro  /  Admin@1234  (role=admin)")
    else:
        print(f"✅ admin@securex.pro EXISTS — current role: {admin.get('role')}")
        if admin.get("role") != "admin":
            print("   ⚠ Role is wrong — fixing to 'admin'...")
            await db.users.update_one(
                {"email": "admin@securex.pro"},
                {"$set": {"role": "admin", "status": "active"}},
            )
            print("   ✅ Fixed role → admin")
        else:
            print("   Role is correct ✓")

    # Also ensure no other user accidentally still has role=admin
    wrong = await db.users.count_documents({"role": "admin", "email": {"$ne": "admin@securex.pro"}})
    if wrong:
        print(f"\n⚠ {wrong} other account(s) still have role=admin — converting to 'user'...")
        await db.users.update_many(
            {"role": "admin", "email": {"$ne": "admin@securex.pro"}},
            {"$set": {"role": "user"}},
        )
        print("✅ Converted those accounts to role=user")

    print("\nDone. Login credentials:")
    print("  Email:    admin@securex.pro")
    print("  Password: Admin@1234")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
