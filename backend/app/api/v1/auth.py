from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user, get_client_ip
from app.db.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserProfile,
)
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


@router.put("/me", response_model=UserProfile)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.update_profile(db, current_user, body)


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


@router.post("/totp/setup")
async def totp_setup(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.setup_totp(db, current_user)


@router.post("/totp/confirm")
async def totp_confirm(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    backup_codes = await auth_service.confirm_totp(db, current_user, body.get("code", ""))
    return {"message": "TOTP enabled", "backup_codes": backup_codes}


@router.post("/totp/verify")
async def totp_verify(body: dict, db: AsyncSession = Depends(get_db)):
    """Complete login when TOTP is required. Body: {totp_token, code}"""
    from app.core.security import decode_token, create_access_token, create_refresh_token
    from jose import JWTError
    from sqlalchemy import select
    try:
        payload = decode_token(body.get("totp_token", ""))
        if not payload.get("totp_pending"):
            from app.core.exceptions import UnauthorizedException
            raise UnauthorizedException("Invalid TOTP token")
        user_id = int(payload["sub"])
    except JWTError:
        from app.core.exceptions import UnauthorizedException
        raise UnauthorizedException("Invalid or expired TOTP token")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        from app.core.exceptions import UnauthorizedException
        raise UnauthorizedException()

    valid = await auth_service.verify_totp_code(user, body.get("code", ""))
    if not valid:
        from app.core.exceptions import UnauthorizedException
        raise UnauthorizedException("Invalid TOTP code")

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role})
    import datetime as _dt
    user.last_login_at = _dt.datetime.now(_dt.timezone.utc)
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer", "requires_totp": False}


@router.delete("/totp")
async def totp_disable(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await auth_service.disable_totp(db, current_user, body.get("current_password", ""))
    return {"message": "TOTP disabled"}
