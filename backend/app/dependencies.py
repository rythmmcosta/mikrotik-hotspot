from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_token
from app.db.models.user import User
from app.db.session import get_db, get_session_factory

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise UnauthorizedException()
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise UnauthorizedException("Invalid token type")
        user_id: int = payload.get("sub")
    except JWTError:
        raise UnauthorizedException("Invalid or expired token")

    result = await db.execute(select(User).where(User.id == int(user_id), User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedException("User not found or inactive")
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise ForbiddenException()
    return current_user


async def require_operator_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("admin", "operator"):
        raise ForbiddenException()
    return current_user


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def get_current_user_ws(token: str) -> User | None:
    """Authenticate a WebSocket connection via token query param."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        user_id = payload.get("sub")
    except JWTError:
        return None

    factory = get_session_factory()
    async with factory() as db:
        result = await db.execute(select(User).where(User.id == int(user_id), User.is_active == True))
        return result.scalar_one_or_none()
