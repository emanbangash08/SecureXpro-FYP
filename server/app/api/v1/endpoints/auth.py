from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.user import (
    UserCreate, UserLogin, UserOut, TokenResponse,
    RefreshTokenRequest, ForgotPasswordRequest,
    ResetPasswordRequest, ForgotPasswordResponse
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(data: UserCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    return await auth_service.register_user(db, data)


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncIOMotorDatabase = Depends(get_db)):
    return await auth_service.login_user(db, data.email, data.password)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshTokenRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    return await auth_service.refresh_access_token(db, data.refresh_token)


@router.get("/me", response_model=UserOut)
async def me(current_user: UserOut = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(data: ForgotPasswordRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    return await auth_service.forgot_password(db, data.email)


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    return await auth_service.reset_password(db, data.token, data.new_password)
