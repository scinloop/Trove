"""Aggregated statistics endpoint."""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import CATEGORY_KEYS
from app.database import get_session
from app.models import Item, Task
from app.schemas import ItemOut

router = APIRouter(tags=["stats"])


@router.get("/stats")
async def get_stats(session: AsyncSession = Depends(get_session)) -> dict:
    items = (await session.execute(select(Item))).scalars().all()
    total = len(items)
    by_category: dict[str, int] = {key: 0 for key in CATEGORY_KEYS}
    character_split: dict[str, int] = {"game": 0, "anime_manga": 0}
    done = 0
    rating_sum = 0
    now = datetime.now()
    recent30 = 0

    for it in items:
        by_category[it.category] = by_category.get(it.category, 0) + 1
        if it.category == "character":
            for key in it.sub_types or []:  # 多选题材：包含即计入
                if key in character_split:
                    character_split[key] += 1
        if it.status == "done":
            done += 1
        rating_sum += it.rating
        if (now - it.created_at).days < 30:
            recent30 += 1

    recent = sorted(items, key=lambda i: (i.created_at, i.id), reverse=True)[:6]

    tasks_rows = (await session.execute(select(Task))).scalars().all()
    tasks = {
        "total": len(tasks_rows),
        "pending": sum(1 for t in tasks_rows if t.status == "pending"),
        "doing": sum(1 for t in tasks_rows if t.status == "doing"),
        "done": sum(1 for t in tasks_rows if t.status == "done"),
        "goals": sum(1 for t in tasks_rows if t.kind == "goal"),
    }

    return {
        "total": total,
        "recent30": recent30,
        "avg_rating": round(rating_sum / total, 1) if total else 0,
        "done_rate": round(done / total * 100) if total else 0,
        "by_category": by_category,
        "character_split": character_split,
        "recent": [ItemOut.model_validate(i) for i in recent],
        "tasks": tasks,
    }
