"""Pydantic schemas for request validation and serialization."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.constants import CATEGORY_KEYS, STATUS_KEYS, SUB_TYPES


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

    @model_validator(mode="after")
    def _validate(self) -> "ItemBase":
        if self.category not in CATEGORY_KEYS:
            raise ValueError(f"unknown category: {self.category}")
        if self.category == "character":
            if self.sub_type not in SUB_TYPES:
                raise ValueError("character items require sub_type: " + ", ".join(SUB_TYPES))
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


class ItemOut(ItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
