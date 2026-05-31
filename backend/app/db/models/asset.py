from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[str] = mapped_column(
        Enum("desktop", "laptop", "other"), nullable=False, default="desktop"
    )
    mac_address: Mapped[str] = mapped_column(String(17), unique=True, nullable=False, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    connection_type: Mapped[str] = mapped_column(
        Enum("lan", "wifi"), nullable=False, default="wifi"
    )
    employee_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )
    serial_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    os_type: Mapped[str | None] = mapped_column(
        Enum("windows", "linux", "macos"), nullable=True
    )
    hostname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("active", "offline", "blocked"), nullable=False, default="offline", index=True
    )
    agent_installed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    agent_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    agent_last_seen: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    agent_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    employee: Mapped["Employee | None"] = relationship("Employee")
    adder: Mapped["User | None"] = relationship("User", foreign_keys=[added_by])
    metrics: Mapped[list["AssetMetric"]] = relationship(
        "AssetMetric", back_populates="asset", cascade="all, delete-orphan"
    )
