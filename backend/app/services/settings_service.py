from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_value, encrypt_value
from app.db.models.setting import Setting
from app.db.models.user import User

ENCRYPTED_KEYS = {
    ("smtp", "password"),
    ("sms", "account_sid"),
    ("sms", "auth_token"),
    ("mikrotik", "password"),
}


async def get_category(db: AsyncSession, category: str) -> list[Setting]:
    result = await db.execute(select(Setting).where(Setting.category == category))
    return list(result.scalars().all())


async def get_value(db: AsyncSession, category: str, key: str) -> str | None:
    result = await db.execute(
        select(Setting).where(Setting.category == category, Setting.key_name == key)
    )
    row = result.scalar_one_or_none()
    if not row or row.value is None:
        return None
    if row.is_encrypted:
        return decrypt_value(row.value)
    return row.value


async def set_value(db: AsyncSession, category: str, key: str, value: str | None, user: User | None = None) -> None:
    result = await db.execute(
        select(Setting).where(Setting.category == category, Setting.key_name == key)
    )
    row = result.scalar_one_or_none()
    is_enc = (category, key) in ENCRYPTED_KEYS
    stored = encrypt_value(value) if (is_enc and value is not None) else value

    if row:
        row.value = stored
        row.is_encrypted = is_enc
        row.updated_by = user.id if user else None
    else:
        db.add(Setting(
            category=category,
            key_name=key,
            value=stored,
            is_encrypted=is_enc,
            updated_by=user.id if user else None,
        ))


async def update_category(db: AsyncSession, category: str, updates: dict, user: User | None = None) -> None:
    for key, value in updates.items():
        await set_value(db, category, key, value, user)


async def get_all_settings(db: AsyncSession) -> dict[str, list[Setting]]:
    result = await db.execute(select(Setting).order_by(Setting.category, Setting.key_name))
    rows = result.scalars().all()
    categories: dict[str, list[Setting]] = {}
    for row in rows:
        categories.setdefault(row.category, []).append(row)
    return categories
