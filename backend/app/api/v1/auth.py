from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user, get_client_ip
from app.db.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, RefreshRequest, TokenResponse, UserProfile
from app.services import auth_service, employee_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.login(db, body.username, body.password)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.refresh(db, body.refresh_token)


@router.get("/me", response_model=UserProfile)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/employee-login")
async def employee_login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Called by captive portal to authenticate employees and return hotspot credentials."""
    from app.core.exceptions import UnauthorizedException
    creds = await employee_service.authenticate_employee(db, body.username, body.password)
    if not creds:
        raise UnauthorizedException("Invalid email or password")
    return creds


@router.put("/password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await auth_service.change_password(db, current_user, body.current_password, body.new_password)
    return {"message": "Password changed successfully"}
