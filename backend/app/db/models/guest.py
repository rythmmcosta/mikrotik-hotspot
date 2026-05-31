from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Guest(Base):
    __tablename__ = "guests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    mobile: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mobile_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    hotspot_username: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    hotspot_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bandwidth_profile_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("bandwidth_profiles.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        Enum(
            "pending_otp",
            "pending_approval",
            "approved",
            "rejected",
            "expired",
            "suspended",
        ),
        nullable=False,
        default="pending_otp",
        index=True,
    )
    approval_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejected_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    access_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    bandwidth_profile: Mapped["BandwidthProfile | None"] = relationship("BandwidthProfile")
    approver: Mapped["User | None"] = relationship("User", foreign_keys=[approved_by])
    rejecter: Mapped["User | None"] = relationship("User", foreign_keys=[rejected_by])
    queue_entry: Mapped["AccessQueue | None"] = relationship(
        "AccessQueue", back_populates="guest", uselist=False
    )
