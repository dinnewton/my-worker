from datetime import datetime, timezone
from sqlalchemy import DateTime, Integer, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class KPISnapshot(Base):
    __tablename__ = "kpi_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    active_leads: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    posts_published: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    proposals_sent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sites_built: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    revenue: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
