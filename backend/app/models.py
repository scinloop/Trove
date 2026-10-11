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
    sub_type: Mapped[str | None] = mapped_column(String(20))       # 题材 key（genres 表），可空
    source: Mapped[str | None] = mapped_column(String(200))        # 来源作品 / 作者 / 平台
    rating: Mapped[int] = mapped_column(Integer, default=3)        # 0-5
    status: Mapped[str] = mapped_column(String(10), default="doing", index=True)  # wish|doing|done
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[list] = mapped_column(JSON, default=list)         # 标签字符串数组（字典见 tags 表）
    note: Mapped[str | None] = mapped_column(Text)
    emoji: Mapped[str | None] = mapped_column(String(16))
    image_url: Mapped[str | None] = mapped_column(String(500))     # /static/uploads/...（服装等图片展示）
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class Genre(Base):
    """可维护的题材（子分类）库：按分类分组，items.sub_type 存 key。"""

    __tablename__ = "genres"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(20), index=True)
    key: Mapped[str] = mapped_column(String(32), unique=True)
    label: Mapped[str] = mapped_column(String(50))
    color: Mapped[str] = mapped_column(String(20), default="#71717a")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class Tag(Base):
    """可维护的标签库：items.tags 仍存标签字符串，此表用于选择器与管理。"""

    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    label: Mapped[str] = mapped_column(String(50), unique=True)
    color: Mapped[str] = mapped_column(String(20), default="#71717a")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class Chapter(Base):
    """小说章节：正文按章存储，支持字数统计与书内搜索。"""

    __tablename__ = "chapters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(Integer, index=True)      # -> items.id (novel)
    idx: Mapped[int] = mapped_column(Integer, default=0)           # 章序（0 起）
    title: Mapped[str] = mapped_column(String(200), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    word_count: Mapped[int] = mapped_column(Integer, default=0)
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
