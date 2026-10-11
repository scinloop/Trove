"""CRUD helpers for items."""
from pydantic import ValidationError
from sqlalchemy import String, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.constants import CATEGORY_EMOJI
from app.models import Item
from app.schemas import ItemBase, ItemCreate, ItemUpdate


async def list_items(
    session: AsyncSession,
    *,
    category: str | None = None,
    sub: str | None = None,
    q: str | None = None,
    sort: str = "recent",
    favorite: bool | None = None,
) -> list[Item]:
    stmt = select(Item)
    if category:
        stmt = stmt.where(Item.category == category)
    if sub:
        stmt = stmt.where(Item.category == "character", Item.sub_type == sub)
    if favorite is not None:
        stmt = stmt.where(Item.favorite == favorite)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Item.title.ilike(like),
                Item.source.ilike(like),
                Item.note.ilike(like),
                Item.tags.cast(String).ilike(like),  # tags stored as JSON text
            )
        )
    if sort == "rating":
        stmt = stmt.order_by(Item.rating.desc(), Item.created_at.desc(), Item.id.desc())
    elif sort == "title":
        stmt = stmt.order_by(Item.title, Item.id)
    else:  # recent
        stmt = stmt.order_by(Item.created_at.desc(), Item.id.desc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_item(session: AsyncSession, item_id: int) -> Item | None:
    return await session.get(Item, item_id)


async def create_item(session: AsyncSession, data: ItemCreate) -> Item:
    item = Item(**data.model_dump())
    if not item.emoji:
        item.emoji = CATEGORY_EMOJI.get(item.category)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


async def update_item(session: AsyncSession, item: Item, data: ItemUpdate) -> Item:
    changes = data.model_dump(exclude_unset=True)
    merged = {name: getattr(item, name) for name in ItemBase.model_fields}
    merged.update(changes)
    try:
        ItemBase(**merged)  # full-object validation (character/sub_type rules etc.)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    for field, value in changes.items():
        setattr(item, field, value)
    if item.category != "character":
        item.sub_type = None
    if not item.emoji:
        item.emoji = CATEGORY_EMOJI.get(item.category)
    await session.commit()
    await session.refresh(item)
    return item


async def delete_item(session: AsyncSession, item: Item) -> None:
    await session.delete(item)
    await session.commit()
