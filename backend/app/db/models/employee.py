from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    hotspot_username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    hotspot_password: Mapped[str] = mapped_column(String(255), nullable=False)
    bandwidth_profile_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("bandwidth_profiles.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        Enum("active", "suspended", "deleted"), nullable=False, default="active", index=True
    )
    mikrotik_synced: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    quota_daily_mb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quota_weekly_mb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quota_monthly_mb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bytes_used_today: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bytes_used_week: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bytes_used_month: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    bandwidth_profile: Mapped["BandwidthProfile | None"] = relationship("BandwidthProfile")
    creator: Mapped["User"] = relationship(
        "User", back_populates="employees_created", foreign_keys=[created_by]
    )
