"""
Security primitives — password hashing, JWT issuance/decoding, reset-token HMAC.

Hardening notes:
  • Every JWT now carries an `iat` claim. `get_current_user` rejects tokens
    whose `iat` is older than the user's `tokens_invalidated_at` timestamp,
    so a password reset (or admin-triggered invalidation) instantly kills
    every outstanding session for that user.
  • Reset tokens are stored as HMAC-SHA256(token, SECRET_KEY). The raw token
    is only ever in transit and in client memory — a DB dump cannot replay
    outstanding tokens.
"""
import hmac
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    now = _now_utc()
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {"sub": str(subject), "exp": expire, "iat": now, "type": "access"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: str | Any) -> str:
    now = _now_utc()
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(subject), "exp": expire, "iat": now, "type": "refresh"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return {}


# ── Reset-token HMAC ──────────────────────────────────────────────────────────

def hash_reset_token(raw_token: str) -> str:
    """
    HMAC-SHA256(raw_token, SECRET_KEY) → hex digest.

    Store this in the DB instead of the raw token. The raw token is only
    exposed via the API response (one-time) and via the reset link itself;
    nothing on disk can be replayed if leaked.
    """
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        raw_token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_reset_token(raw_token: str, stored_hash: str) -> bool:
    """Constant-time compare of HMAC(raw) vs stored hash."""
    return hmac.compare_digest(hash_reset_token(raw_token), stored_hash)
