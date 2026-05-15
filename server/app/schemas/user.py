"""
User schemas + a single source of truth for password strength rules.

Strong-password policy (applied to UserCreate AND ResetPasswordRequest):
  • minimum 12 characters
  • at least one lowercase letter
  • at least one uppercase letter
  • at least one digit
  • at least one special character
"""
import re

from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from app.models.user import UserRole, UserStatus


# ── Shared validators ─────────────────────────────────────────────────────────

_SPECIAL_CHARS = r"""!@#$%^&*()_+\-=\[\]{};:'",.<>/?\\|`~"""
_SPECIAL_RE = re.compile(f"[{re.escape(_SPECIAL_CHARS)}]")


def validate_strong_password(v: str) -> str:
    """
    Raise ValueError if the password does not meet the strong-password policy.
    Returns the password unchanged on success.
    """
    if len(v) < 12:
        raise ValueError("Password must be at least 12 characters")
    if not re.search(r"[a-z]", v):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"\d", v):
        raise ValueError("Password must contain at least one digit")
    if not _SPECIAL_RE.search(v):
        raise ValueError("Password must contain at least one special character")
    return v


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    """
    Used by the admin user-creation endpoint. EmailStr enforces RFC-5322 syntax
    so admins cannot accidentally provision an unreachable address.
    """
    full_name: str
    username: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.USER

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        return validate_strong_password(v)

    @field_validator("username")
    @classmethod
    def _username_valid(cls, v: str) -> str:
        if len(v.strip()) < 3:
            raise ValueError("Username must be at least 3 characters")
        return v.strip()

    @field_validator("full_name")
    @classmethod
    def _full_name_valid(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return v.strip()


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    role: UserRole
    status: UserStatus
    created_at: datetime
    last_login: datetime | None = None


class UserUpdate(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    full_name: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        return validate_strong_password(v)


class ForgotPasswordResponse(BaseModel):
    """
    Response for the forgot-password endpoint.

    `reset_token` is present when the email matches a user and absent
    otherwise. The frontend uses the token to build a /reset-password URL
    that the user can click directly (no email transport involved).
    """
    message: str
    reset_token: str | None = None
