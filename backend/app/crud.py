"""CRUD helpers for items and tasks."""
from datetime import datetime

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import String, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import CATEGORY_EMOJI, CATEGORY_SUB_TYPES, SUB_TYPES
from app.models import Item, Task
from app.schemas import ItemBase, ItemCreate, ItemUpdate, TaskBase, TaskCreate, TaskUpdate


# ---------------- items ----------------

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
        if sub not in SUB_TYPES:
            raise HTTPException(status_code=422, detail=f"unknown sub_type: {sub}")
        stmt = stmt.where(Item.sub_type == sub)
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
    if "category" not in changes:
        # 未切换分类：对合并结果先归一化子类型（兼容未填写子类型的存量漫画），再校验
        allowed = CATEGORY_SUB_TYPES.get(item.category, [])
        if not allowed:
            merged["sub_type"] = None
        elif merged.get("sub_type") not in allowed:
            merged["sub_type"] = allowed[0]
    try:
        ItemBase(**merged)  # full-object validation (category/status rules etc.)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    for field, value in changes.items():
        setattr(item, field, value)
    allowed = CATEGORY_SUB_TYPES.get(item.category, [])
    if not allowed:
        item.sub_type = None
    elif item.sub_type not in allowed:
        item.sub_type = allowed[0]
    if not item.emoji:
        item.emoji = CATEGORY_EMOJI.get(item.category)
    await session.commit()
    await session.refresh(item)
    return item


async def delete_item(session: AsyncSession, item: Item) -> None:
    await session.delete(item)
    await session.commit()


# ---------------- tasks / goals ----------------

async def list_tasks(
    session: AsyncSession,
    *,
    kind: str | None = None,
    status: str | None = None,
) -> list[Task]:
    stmt = select(Task)
    if kind:
        stmt = stmt.where(Task.kind == kind)
    if status:
        stmt = stmt.where(Task.status == status)
    # 未完成的排前，完成的垫底；各自按创建时间倒序
    stmt = stmt.order_by((Task.status == "done").asc(), Task.created_at.desc(), Task.id.desc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_task(session: AsyncSession, task_id: int) -> Task | None:
    return await session.get(Task, task_id)


async def create_task(session: AsyncSession, data: TaskCreate) -> Task:
    task = Task(**data.model_dump())
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task


async def update_task(session: AsyncSession, task: Task, data: TaskUpdate) -> Task:
    changes = data.model_dump(exclude_unset=True)
    merged = {name: getattr(task, name) for name in TaskBase.model_fields}
    merged.update(changes)
    try:
        TaskBase(**merged)  # full-object validation (goal 不设时长等规则)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    was_done = task.status == "done"
    for field, value in changes.items():
        setattr(task, field, value)
    if task.kind == "goal":
        task.planned_minutes = None
    if task.status == "done" and not was_done:
        task.done_at = datetime.now()
    elif task.status != "done":
        task.done_at = None
    await session.commit()
    await session.refresh(task)
    return task


async def delete_task(session: AsyncSession, task: Task) -> None:
    await session.delete(task)
    await session.commit()
