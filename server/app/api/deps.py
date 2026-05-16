from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import decode_token
from app.core.database import get_db
from app.models.user import UserRole
from app.schemas.user import UserOut
from app.utils.helpers import doc_to_out

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> UserOut:
    """
    Decode the bearer JWT and resolve the user.

    Kill-switch: if the user has `tokens_invalidated_at` set (i.e. they
    triggered a password reset), reject any token whose `iat` is older
    than that timestamp. This terminates every outstanding session for
    that user the moment they reset their password.
    """
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub") if payload else None
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    invalidated_at = user.get("tokens_invalidated_at")
    iat = payload.get("iat")
    if invalidated_at and iat is not None:
        # `iat` is a unix timestamp (int) when set by create_*_token; allow a
        # tiny clock-skew margin so the password-reset turn doesn't kill the
        # token it just minted by accident.
        if iat < int(invalidated_at.timestamp()) - 2:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session revoked — please log in again",
            )

    return UserOut(**doc_to_out(user))


async def require_admin(current_user: UserOut = Depends(get_current_user)) -> UserOut:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
