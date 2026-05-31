from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BandwidthProfile(Base):
    __tablename__ = "bandwidth_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    rate_limit_rx: Mapped[str] = mapped_column(String(32), nullable=False)
    rate_limit_tx: Mapped[str] = mapped_column(String(32), nullable=False)
    burst_limit_rx: Mapped[str | None] = mapped_column(String(32), nullable=True)
    burst_limit_tx: Mapped[str | None] = mapped_column(String(32), nullable=True)
    burst_threshold_rx: Mapped[str | None] = mapped_column(String(32), nullable=True)
    burst_threshold_tx: Mapped[str | None] = mapped_column(String(32), nullable=True)
    burst_time_seconds: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    mikrotik_profile_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_default_employee: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_default_guest: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
