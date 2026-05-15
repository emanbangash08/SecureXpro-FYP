from fastapi import APIRouter, Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.api.deps import get_current_user
from app.schemas.user import (
    UserCreate, UserLogin, UserOut, TokenResponse,
    RefreshTokenRequest, ForgotPasswordRequest,
    ResetPasswordRequest, ForgotPasswordResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_403_FORBIDDEN)
async def register_disabled(_: UserCreate):
    """
    Self-registration is disabled. New users are provisioned by an administrator
    via POST /admin/users — see the admin user-management page.
    """
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Self-registration is disabled. Contact your administrator to create an account.",
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    data: UserLogin,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    return await auth_service.login_user(db, data.email, data.password)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshTokenRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    return await auth_service.refresh_access_token(db, data.refresh_token)


@router.get("/me", response_model=UserOut)
async def me(current_user: UserOut = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit("5/15 minutes")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    return await auth_service.forgot_password(db, data.email, request=request)


@router.post("/reset-password")
@limiter.limit("10/15 minutes")
async def reset_password(
    request: Request,
    data: ResetPasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    return await auth_service.reset_password(db, data.token, data.new_password, request=request)
