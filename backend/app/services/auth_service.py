from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, UnauthorizedException
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.models.user import User
from jose import JWTError


async def login(db: AsyncSession, username: str, password: str) -> dict:
    result = await db.execute(select(User).where(User.username == username, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise UnauthorizedException("Invalid username or password")

    user.last_login_at = datetime.now(timezone.utc)

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


async def refresh(db: AsyncSession, refresh_token: str) -> dict:
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise UnauthorizedException("Invalid token type")
        user_id = int(payload["sub"])
    except JWTError:
        raise UnauthorizedException("Invalid or expired refresh token")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedException()

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


async def change_password(db: AsyncSession, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.password_hash):
        raise BadRequestException("Current password is incorrect")
    if len(new_password) < 8:
        raise BadRequestException("Password must be at least 8 characters")
    user.password_hash = hash_password(new_password)
