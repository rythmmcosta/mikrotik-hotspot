from datetime import datetime
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class GuestBlacklist(Base):
    __tablename__ = "guest_blacklist"
    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(Enum("email", "mobile", "ip"), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("type", "value", name="uq_blacklist_type_val"),)
