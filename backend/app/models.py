"""SQLAlchemy ORM models."""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    category: Mapped[str] = mapped_column(String(20), index=True)  # comic|novel|anime|character|video|game|movie|clothing|shortdrama
    sub_type: Mapped[str | None] = mapped_column(String(20))       # 角色分类 / 漫画分类的子类型（见 CATEGORY_SUB_TYPES）
    source: Mapped[str | None] = mapped_column(String(200))        # 来源作品 / 作者 / 平台
    rating: Mapped[int] = mapped_column(Integer, default=3)        # 0-5
    status: Mapped[str] = mapped_column(String(10), default="doing", index=True)  # wish|doing|done
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    note: Mapped[str | None] = mapped_column(Text)
    emoji: Mapped[str | None] = mapped_column(String(16))
    image_url: Mapped[str | None] = mapped_column(String(500))     # /static/uploads/...（服装等图片展示）
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    kind: Mapped[str] = mapped_column(String(10), default="todo", index=True)      # todo 待办任务 | goal 长期目标
    planned_minutes: Mapped[int | None] = mapped_column(Integer)  # 预计时长（分钟）；goal 恒为 NULL
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)  # pending|doing|done
    note: Mapped[str | None] = mapped_column(Text)
    done_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
