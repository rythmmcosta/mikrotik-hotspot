from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BrowsingLog(Base):
    __tablename__ = "browsing_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hotspot_username: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    user_type: Mapped[str | None] = mapped_column(
        Enum("employee", "guest", "asset"), nullable=True
    )
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    query_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    mac_address: Mapped[str | None] = mapped_column(String(17), nullable=True, index=True)
    queried_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), index=True
    )

    __table_args__ = (
        Index("idx_browsing_user_time", "hotspot_username", "queried_at"),
        Index("idx_browsing_domain_time", "domain", "queried_at"),
    )
