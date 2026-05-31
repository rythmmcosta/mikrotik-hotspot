from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AccessQueue(Base):
    __tablename__ = "access_queue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    guest_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("guests.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    mobile: Mapped[str] = mapped_column(String(32), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), index=True
    )
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    guest: Mapped["Guest"] = relationship("Guest", back_populates="queue_entry")
