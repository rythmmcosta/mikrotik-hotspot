from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, ConflictException, UnauthorizedException
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.models.user import User
from app.schemas.auth import UpdateProfileRequest
from jose import JWTError


async def login(db: AsyncSession, username: str, password: str) -> dict:
    result = await db.execute(select(User).where(User.username == username, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise UnauthorizedException("Invalid username or password")

    user.last_login_at = datetime.now(timezone.utc)

    if user.totp_enabled:
        # Return a short-lived temp token for TOTP completion
        import secrets as _secrets
        access_token = create_access_token({"sub": str(user.id), "role": user.role, "totp_pending": True}, timedelta(minutes=5))
        return {
            "access_token": None,
            "refresh_token": None,
            "token_type": "bearer",
            "requires_totp": True,
            "totp_token": access_token,
        }

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "requires_totp": False,
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


async def update_profile(db: AsyncSession, user: User, data: UpdateProfileRequest) -> User:
    if data.email is not None and data.email != user.email:
        existing = await db.execute(
            select(User).where(User.email == data.email, User.id != user.id)
        )
        if existing.scalar_one_or_none():
            raise ConflictException("Email is already in use by another account")
        user.email = data.email

    if data.full_name is not None:
        user.full_name = data.full_name or None
    if data.mobile is not None:
        user.mobile = data.mobile or None
    if data.telegram_chat_id is not None:
        user.telegram_chat_id = data.telegram_chat_id or None
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url or None

    await db.flush()
    await db.refresh(user)
    return user


async def setup_totp(db: AsyncSession, user: User) -> dict:
    import pyotp, io, base64
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=user.email, issuer_name="HotspotMgr")

    try:
        import qrcode
        qr = qrcode.QRCode()
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        img = qr.make_image()
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        qr_b64 = base64.b64encode(buf.getvalue()).decode()
        qr_data_url = f"data:image/png;base64,{qr_b64}"
    except ImportError:
        qr_data_url = None

    # Store temp secret (not yet enabled)
    user.totp_secret = secret
    await db.flush()
    return {"secret": secret, "provisioning_uri": provisioning_uri, "qr_data_url": qr_data_url}


async def confirm_totp(db: AsyncSession, user: User, code: str) -> list[str]:
    import pyotp, secrets as _secrets, json
    if not user.totp_secret:
        raise BadRequestException("TOTP setup not started")
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(code, valid_window=1):
        raise BadRequestException("Invalid TOTP code")
    user.totp_enabled = True
    # Generate backup codes
    backup_codes = [_secrets.token_hex(4).upper() for _ in range(8)]
    user.totp_backup_codes = json.dumps([hash_password(c) for c in backup_codes])
    await db.flush()
    return backup_codes


async def verify_totp_code(user: User, code: str) -> bool:
    import pyotp, json
    if not user.totp_enabled or not user.totp_secret:
        return True  # TOTP not required
    totp = pyotp.TOTP(user.totp_secret)
    if totp.verify(code, valid_window=1):
        return True
    # Check backup codes
    if user.totp_backup_codes:
        try:
            hashed_codes = json.loads(user.totp_backup_codes)
            for hc in hashed_codes:
                if verify_password(code, hc):
                    # Remove used backup code
                    hashed_codes.remove(hc)
                    user.totp_backup_codes = json.dumps(hashed_codes)
                    return True
        except Exception:
            pass
    return False


async def disable_totp(db: AsyncSession, user: User, current_password: str) -> None:
    if not verify_password(current_password, user.password_hash):
        raise BadRequestException("Current password is incorrect")
    user.totp_enabled = False
    user.totp_secret = None
    user.totp_backup_codes = None
    await db.flush()
