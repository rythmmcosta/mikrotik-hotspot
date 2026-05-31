from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Integer, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AssetMetric(Base):
    __tablename__ = "asset_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    collected_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), index=True
    )
    cpu_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    cpu_per_core: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ram_total: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    ram_used: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    ram_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    disk_read_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    disk_write_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    net_bytes_sent: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    net_bytes_recv: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    net_packets_sent: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    net_packets_recv: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    active_connections: Mapped[int | None] = mapped_column(Integer, nullable=True)

    asset: Mapped["Asset"] = relationship("Asset", back_populates="metrics")
