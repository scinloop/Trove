"""Frontend-facing constants (single source of truth for labels/colors/order)."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import (
    ACQUIRE_STATUS,
    CATEGORIES,
    REQUIRED_GENRE_CATEGORIES,
    STATUS_COLORS,
    STATUS_LABELS,
    TAG_GROUPS,
    TASK_KIND_META,
    TASK_KINDS,
    TASK_STATUS_COLORS,
    TASK_STATUS_LABELS,
    WORK_STATUS,
)
from app.crud import list_genres
from app.database import get_session

router = APIRouter(tags=["meta"])


@router.get("/meta")
async def get_meta(session: AsyncSession = Depends(get_session)) -> dict:
    genres: dict[str, list[dict]] = {}
    for g in await list_genres(session):
        genres.setdefault(g.category, []).append(
            {"key": g.key, "label": g.label, "color": g.color}
        )
    return {
        "categories": CATEGORIES,
        "genres": genres,
        "genre_required": REQUIRED_GENRE_CATEGORIES,
        "work_status": [
            {"key": k, "label": v["label"], "color": v["color"]} for k, v in WORK_STATUS.items()
        ],
        "acquire_status": [
            {"key": k, "label": v["label"], "color": v["color"]} for k, v in ACQUIRE_STATUS.items()
        ],
        "tag_groups": TAG_GROUPS,
        "status_colors": STATUS_COLORS,
        "status_labels": STATUS_LABELS,
        "task_kinds": TASK_KINDS,
        "task_kind_meta": TASK_KIND_META,
        "task_status_colors": TASK_STATUS_COLORS,
        "task_status_labels": TASK_STATUS_LABELS,
    }
