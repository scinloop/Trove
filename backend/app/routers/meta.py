"""Frontend-facing constants (single source of truth for labels/colors/order)."""
from fastapi import APIRouter

from app.constants import (
    CATEGORIES,
    CATEGORY_SUB_TYPES,
    STATUS_COLORS,
    STATUS_LABELS,
    SUB_TYPES,
    TASK_KIND_META,
    TASK_KINDS,
    TASK_STATUS_COLORS,
    TASK_STATUS_LABELS,
)

router = APIRouter(tags=["meta"])


@router.get("/meta")
async def get_meta() -> dict:
    return {
        "categories": CATEGORIES,
        "sub_types": SUB_TYPES,
        "category_sub_types": CATEGORY_SUB_TYPES,
        "status_colors": STATUS_COLORS,
        "status_labels": STATUS_LABELS,
        "task_kinds": TASK_KINDS,
        "task_kind_meta": TASK_KIND_META,
        "task_status_colors": TASK_STATUS_COLORS,
        "task_status_labels": TASK_STATUS_LABELS,
    }
