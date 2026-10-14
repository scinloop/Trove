"""Frontend-facing constants (single source of truth for labels/colors/order)."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import (
    ACQUIRE_STATUS,
    REQUIRED_GENRE_CATEGORIES,
    STATUS_COLORS,
    STATUS_LABELS,
    TASK_KIND_META,
    TASK_KINDS,
    TASK_STATUS_COLORS,
    TASK_STATUS_LABELS,
    WORK_STATUS,
)
from app.crud import list_categories, list_genres, list_tag_groups
from app.database import get_session

router = APIRouter(tags=["meta"])


@router.get("/meta")
async def get_meta(session: AsyncSession = Depends(get_session)) -> dict:
    genres: dict[str, list[dict]] = {}
    for g in await list_genres(session):
        genres.setdefault(g.category, []).append(
            {"key": g.key, "label": g.label, "color": g.color}
        )
    categories = [
        {"key": c.key, "label": c.label, "emoji": c.emoji, "color": c.color, "note": c.note}
        for c in await list_categories(session)
    ]
    tag_groups = [g.name for g in await list_tag_groups(session)]
    return {
        "categories": categories,
        "genres": genres,
        "genre_required": REQUIRED_GENRE_CATEGORIES,
        "work_status": [
            {"key": k, "label": v["label"], "color": v["color"]} for k, v in WORK_STATUS.items()
        ],
        "acquire_status": [
            {"key": k, "label": v["label"], "color": v["color"]} for k, v in ACQUIRE_STATUS.items()
        ],
        "tag_groups": tag_groups,
        "status_colors": STATUS_COLORS,
        "status_labels": STATUS_LABELS,
        "task_kinds": TASK_KINDS,
        "task_kind_meta": TASK_KIND_META,
        "task_status_colors": TASK_STATUS_COLORS,
        "task_status_labels": TASK_STATUS_LABELS,
    }
