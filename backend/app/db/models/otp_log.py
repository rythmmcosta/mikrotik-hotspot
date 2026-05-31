from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OtpLog(Base):
    __tablename__ = "otp_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    target_type: Mapped[str] = mapped_column(
        Enum("guest_email", "guest_mobile"), nullable=False, index=True
    )
    target_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("guests.id", ondelete="CASCADE"), nullable=False
    )
    target_value: Mapped[str] = mapped_column(String(255), nullable=False)
    otp_code: Mapped[str] = mapped_column(String(64), nullable=False)
    channel: Mapped[str] = mapped_column(Enum("email", "sms"), nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    is_expired: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
