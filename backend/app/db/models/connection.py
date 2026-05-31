from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Connection(Base):
    __tablename__ = "connections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    user_type: Mapped[str] = mapped_column(Enum("employee", "guest"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    hotspot_username: Mapped[str] = mapped_column(String(64), nullable=False)
    mac_address: Mapped[str] = mapped_column(String(17), nullable=False, index=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    bytes_in: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    bytes_out: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    uptime_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    connected_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    disconnected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    disconnect_reason: Mapped[str | None] = mapped_column(
        Enum("logout", "admin_terminate", "idle_timeout", "session_timeout", "unknown"),
        nullable=True,
    )
    terminated_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
