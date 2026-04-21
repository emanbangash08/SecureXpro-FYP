from datetime import datetime, timezone
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    AGENT = "agent"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    BANNED = "banned"


def user_document(
    username: str,
    email: str,
    hashed_password: str,
    full_name: str = "",
    role: UserRole = UserRole.AGENT,
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "username": username,
        "email": email,
        "hashed_password": hashed_password,
        "full_name": full_name,
        "role": role.value,
        "status": UserStatus.ACTIVE.value,
        "created_at": now,
        "updated_at": now,
        "last_login": None,
        "reset_token": None,
        "reset_token_expires": None,
    }
