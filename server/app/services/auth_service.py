import secrets
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import HTTPException, status

from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.models.user import user_document, UserRole
from app.schemas.user import UserCreate, UserOut, TokenResponse, ForgotPasswordResponse
from app.utils.helpers import doc_to_out


async def register_user(db: AsyncIOMotorDatabase, data: UserCreate) -> UserOut:
    existing = await db.users.find_one({"$or": [{"email": data.email}, {"username": data.username}]})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email or username already registered")

    doc = user_document(data.username, data.email, hash_password(data.password), data.full_name, data.role)
    result = await db.users.insert_one(doc)
    created = await db.users.find_one({"_id": result.inserted_id})
    return UserOut(**doc_to_out(created))


async def login_user(db: AsyncIOMotorDatabase, email: str, password: str) -> TokenResponse:
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.get("status") != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")

    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login": datetime.now(timezone.utc)}})

    user_id = str(user["_id"])
    user_out = UserOut(**doc_to_out(user))
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
        user=user_out,
    )


async def refresh_access_token(db: AsyncIOMotorDatabase, refresh_token: str) -> TokenResponse:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    user_out = UserOut(**doc_to_out(user))
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
        user=user_out,
    )


async def get_user_by_id(db: AsyncIOMotorDatabase, user_id: str) -> UserOut:
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserOut(**doc_to_out(user))


async def forgot_password(db: AsyncIOMotorDatabase, email: str) -> ForgotPasswordResponse:
    user = await db.users.find_one({"email": email})
    # Always return success to prevent email enumeration
    if not user:
        return ForgotPasswordResponse(message="If this email is registered, a reset link has been sent.")

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"reset_token": token, "reset_token_expires": expires}}
    )

    # In production: send email with reset link
    # For demo: return token directly so frontend can demonstrate the flow
    return ForgotPasswordResponse(
        message="Password reset link has been sent to your email.",
        reset_token=token,  # Remove this in production
    )


async def reset_password(db: AsyncIOMotorDatabase, token: str, new_password: str) -> dict:
    user = await db.users.find_one({
        "reset_token": token,
        "reset_token_expires": {"$gt": datetime.now(timezone.utc)}
    })

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "hashed_password": hash_password(new_password),
            "reset_token": None,
            "reset_token_expires": None,
            "updated_at": datetime.now(timezone.utc),
        }}
    )

    return {"message": "Password updated successfully"}
