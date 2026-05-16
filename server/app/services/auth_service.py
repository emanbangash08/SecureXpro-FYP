"""
Authentication service.

Hardening:
  • Reset tokens are stored as HMAC-SHA256 (see core.security.hash_reset_token).
    The raw token only ever lives in transit and in the client's memory.
  • Every forgot-password and reset-password attempt is appended to the
    `password_reset_logs` collection with the source IP and user-agent so
    enumeration/brute-force can be detected after the fact.
  • A successful password reset bumps `users.tokens_invalidated_at` to "now".
    JWTs issued before that timestamp are rejected by `get_current_user`,
    so any session that an attacker already had is killed instantly.
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_reset_token,
    verify_reset_token,
)
from app.models.user import user_document, UserRole
from app.schemas.user import UserCreate, UserOut, TokenResponse, ForgotPasswordResponse
from app.utils.helpers import doc_to_out

logger = logging.getLogger(__name__)

PASSWORD_RESET_EXPIRES_MINUTES = 60


# ── Audit helpers ─────────────────────────────────────────────────────────────

def _request_meta(request: Optional[Request]) -> dict:
    if request is None:
        return {"ip": None, "user_agent": None}
    client = request.client
    return {
        "ip": client.host if client else None,
        "user_agent": request.headers.get("user-agent"),
    }


async def _audit_reset(
    db: AsyncIOMotorDatabase,
    *,
    action: str,            # "request" | "complete"
    outcome: str,           # "issued" | "unknown_email" | "token_invalid" | "success"
    email: Optional[str],
    user_id: Optional[str],
    request: Optional[Request],
) -> None:
    """Append one row to the password_reset_logs collection. Never raises."""
    try:
        doc = {
            "timestamp": datetime.now(timezone.utc),
            "action":    action,
            "outcome":   outcome,
            "email":     email,
            "user_id":   user_id,
            **_request_meta(request),
        }
        await db.password_reset_logs.insert_one(doc)
    except Exception as exc:
        logger.warning("Audit log write failed (%s/%s): %s", action, outcome, exc)


# ── Registration / login / refresh ────────────────────────────────────────────

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

    # Same kill-switch as in get_current_user — a stale refresh token after a
    # password reset must not be usable to mint new access tokens.
    invalidated_at = user.get("tokens_invalidated_at")
    iat = payload.get("iat")
    if invalidated_at and iat is not None and iat < int(invalidated_at.timestamp()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")

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


# ── Password reset ────────────────────────────────────────────────────────────

async def forgot_password(
    db: AsyncIOMotorDatabase,
    email: str,
    *,
    request: Optional[Request] = None,
) -> ForgotPasswordResponse:
    """
    Issue a password-reset token and return it directly in the response so the
    UI can render a click-to-reset link.

    Storage: only HMAC(token, SECRET_KEY) is persisted. A DB dump cannot
    replay outstanding tokens.

    Audit: every request — registered or not — is written to
    `password_reset_logs` so suspicious patterns can be reviewed later.
    """
    GENERIC_MSG = "If this email is registered, a password reset link has been generated."

    user = await db.users.find_one({"email": email})
    if not user:
        logger.info("Password reset requested for unknown email: %s", email)
        await _audit_reset(
            db,
            action="request",
            outcome="unknown_email",
            email=email,
            user_id=None,
            request=request,
        )
        return ForgotPasswordResponse(message=GENERIC_MSG)

    raw_token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_EXPIRES_MINUTES)

    # Invalidate any prior unused token by overwriting both fields atomically.
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "reset_token_hash": hash_reset_token(raw_token),
            "reset_token_expires": expires,
        },
        "$unset": {"reset_token": ""}},  # remove legacy plaintext field if present
    )

    await _audit_reset(
        db,
        action="request",
        outcome="issued",
        email=email,
        user_id=str(user["_id"]),
        request=request,
    )

    return ForgotPasswordResponse(message=GENERIC_MSG, reset_token=raw_token)


async def reset_password(
    db: AsyncIOMotorDatabase,
    token: str,
    new_password: str,
    *,
    request: Optional[Request] = None,
) -> dict:
    """
    Consume a reset token and set a new password.

    Token lookup is done by HMAC — we hash the submitted token the same way
    we hashed it at issue time and look that up. Constant-time compare is
    implicit via the indexed equality query.

    On success: clears the reset fields, hashes the new password, and bumps
    `tokens_invalidated_at` so every JWT issued before this moment is rejected.
    """
    now = datetime.now(timezone.utc)
    token_hash = hash_reset_token(token)

    user = await db.users.find_one({
        "reset_token_hash": token_hash,
        "reset_token_expires": {"$gt": now},
    })

    if not user:
        await _audit_reset(
            db,
            action="complete",
            outcome="token_invalid",
            email=None,
            user_id=None,
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "hashed_password": hash_password(new_password),
                "tokens_invalidated_at": now,
                "updated_at": now,
            },
            "$unset": {
                "reset_token_hash":    "",
                "reset_token_expires": "",
                "reset_token":         "",  # legacy field, drop if present
            },
        },
    )

    await _audit_reset(
        db,
        action="complete",
        outcome="success",
        email=user.get("email"),
        user_id=str(user["_id"]),
        request=request,
    )

    return {"message": "Password updated successfully"}
