"""Pydantic schemas for request validation and serialization."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.constants import (
    CATEGORY_KEYS,
    CATEGORY_SUB_TYPES,
    STATUS_KEYS,
    SUB_TYPES,
    TASK_KINDS,
    TASK_STATUS_KEYS,
)


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
        if self.category not in CATEGORY_KEYS:
            raise ValueError(f"unknown category: {self.category}")
        allowed = CATEGORY_SUB_TYPES.get(self.category, [])
        if allowed:
            if self.sub_type not in allowed:
                raise ValueError(f"{self.category} 的子类型必须是: " + ", ".join(allowed))
        else:
            self.sub_type = None
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
    """输出模型：只做序列化，不重跑输入校验（兼容未填写子类型的存量数据）。"""

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
