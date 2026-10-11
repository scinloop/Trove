"""Pydantic schemas for request validation and serialization."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.constants import CATEGORY_KEYS, STATUS_KEYS, TASK_KINDS


class ItemBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: str
    sub_type: str | None = None
    source: str | None = Field(default=None, max_length=200)
    rating: int = Field(default=3, ge=0, le=5)
    status: str = "doing"
    favorite: bool = False
    tags: list[str] = Field(default_factory=list)
    note: str | None = None
    emoji: str | None = Field(default=None, max_length=16)
    image_url: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _validate(self) -> "ItemBase":
        # 题材(sub_type)与分类的匹配校验需要查 genres 表，放在 crud 中做
        if self.category not in CATEGORY_KEYS:
            raise ValueError(f"unknown category: {self.category}")
        if self.status not in STATUS_KEYS:
            raise ValueError(f"unknown status: {self.status}")
        return self


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = None
    sub_type: str | None = None
    source: str | None = Field(default=None, max_length=200)
    rating: int | None = Field(default=None, ge=0, le=5)
    status: str | None = None
    favorite: bool | None = None
    tags: list[str] | None = None
    note: str | None = None
    emoji: str | None = Field(default=None, max_length=16)
    image_url: str | None = Field(default=None, max_length=500)


class ItemOut(BaseModel):
    """输出模型：只做序列化，不重跑输入校验（兼容未填写题材的存量数据）。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    category: str
    sub_type: str | None
    source: str | None
    rating: int
    status: str
    favorite: bool
    tags: list[str]
    note: str | None
    emoji: str | None
    image_url: str | None
    created_at: datetime
    updated_at: datetime


# ---------------- genres（题材库） ----------------

class GenreCreate(BaseModel):
    category: str
    label: str = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def _validate(self) -> "GenreCreate":
        if self.category not in CATEGORY_KEYS:
            raise ValueError(f"unknown category: {self.category}")
        return self


class GenreUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=50)
    color: str | None = Field(default=None, max_length=20)


# ---------------- tags（标签库） ----------------

class TagCreate(BaseModel):
    label: str = Field(min_length=1, max_length=50)


class TagUpdate(BaseModel):
    label: str = Field(min_length=1, max_length=50)


# ---------------- chapters（小说章节） ----------------

class ChapterPaste(BaseModel):
    """粘贴整本文本导入。"""
    text: str = Field(min_length=1, max_length=20_000_000)


class ChapterCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(max_length=5_000_000)


class ChapterUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, max_length=5_000_000)


class ChapterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: int
    idx: int
    title: str
    word_count: int


class ChapterDetail(ChapterOut):
    content: str


# ---------------- tasks ----------------

class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    kind: str = "todo"  # todo 待办任务 | goal 长期目标
    planned_minutes: int | None = Field(default=None, ge=1, le=100_000)
    note: str | None = None

    @model_validator(mode="after")
    def _validate(self) -> "TaskBase":
        if self.kind not in TASK_KINDS:
            raise ValueError(f"unknown kind: {self.kind}")
        if self.kind == "goal":
            self.planned_minutes = None  # 长期目标不设时长
        return self


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    kind: str | None = None
    planned_minutes: int | None = Field(default=None, ge=1, le=100_000)
    status: str | None = None
    note: str | None = None


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    done_at: datetime | None
    created_at: datetime
    updated_at: datetime
