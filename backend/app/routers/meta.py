"""Frontend-facing constants (single source of truth for labels/colors/order)."""
from fastapi import APIRouter

from app.constants import CATEGORIES, STATUS_COLORS, STATUS_LABELS, SUB_TYPES

router = APIRouter(tags=["meta"])


@router.get("/meta")
async def get_meta() -> dict:
    return {
        "categories": CATEGORIES,
        "sub_types": SUB_TYPES,
        "status_colors": STATUS_COLORS,
        "status_labels": STATUS_LABELS,
    }
