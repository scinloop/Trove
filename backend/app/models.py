"""SQLAlchemy ORM models."""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    category: Mapped[str] = mapped_column(String(20), index=True)  # comic|novel|anime|character|video|game|movie
    sub_type: Mapped[str | None] = mapped_column(String(20))       # game|anime_manga (character only)
    source: Mapped[str | None] = mapped_column(String(200))        # 来源作品 / 作者 / 平台
    rating: Mapped[int] = mapped_column(Integer, default=3)        # 0-5
    status: Mapped[str] = mapped_column(String(10), default="doing", index=True)  # wish|doing|done
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    note: Mapped[str | None] = mapped_column(Text)
    emoji: Mapped[str | None] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
