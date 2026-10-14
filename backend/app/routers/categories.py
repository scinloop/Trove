"""Main category (主分类) + tag group (标签大分组) management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud
from app.database import get_session
from app.models import Category, TagGroup
from app.schemas import CategoryCreate, CategoryUpdate, TagGroupCreate, TagGroupRename

router = APIRouter(tags=["meta-manage"])


# ---------------- 主分类 ----------------

def _dump(c: Category) -> dict:
    return {
        "key": c.key,
        "label": c.label,
        "emoji": c.emoji,
        "color": c.color,
        "note": c.note,
        "sort_order": c.sort_order,
    }


@router.get("/categories")
async def list_categories(session: AsyncSession = Depends(get_session)) -> list[dict]:
    return [_dump(c) for c in await crud.list_categories(session)]


@router.post("/categories", status_code=201)
async def create_category(data: CategoryCreate, session: AsyncSession = Depends(get_session)) -> dict:
    return _dump(
        await crud.create_category(
            session, label=data.label, emoji=data.emoji, color=data.color, note=data.note
        )
    )


async def _cat_or_404(session: AsyncSession, key: str) -> Category:
    cat = await session.get(Category, key)
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    return cat


@router.patch("/categories/{key}")
async def update_category(
    key: str,
    data: CategoryUpdate,
    session: AsyncSession = Depends(get_session),
) -> dict:
    cat = await _cat_or_404(session, key)
    return _dump(
        await crud.update_category(
            session, cat, label=data.label, emoji=data.emoji, color=data.color, note=data.note
        )
    )


@router.post("/categories/{key}/move")
async def move_category(
    key: str,
    dir: str = Query(..., pattern="^(up|down)$"),
    session: AsyncSession = Depends(get_session),
) -> dict:
    cat = await _cat_or_404(session, key)
    await crud.move_category(session, cat, dir)
    return {"ok": True}


@router.delete("/categories/{key}", status_code=204)
async def delete_category(key: str, session: AsyncSession = Depends(get_session)) -> None:
    cat = await _cat_or_404(session, key)
    await crud.delete_category(session, cat)


# ---------------- 标签大分组 ----------------

@router.get("/tag-groups")
async def list_tag_groups(session: AsyncSession = Depends(get_session)) -> list[dict]:
    groups = await crud.list_tag_groups(session)
    # 带组内标签数，前端展示用
    tags = await crud.list_tags(session)
    counts: dict[str, int] = {}
    for t in tags:
        if t["group"]:
            counts[t["group"]] = counts.get(t["group"], 0) + 1
    return [
        {"id": g.id, "name": g.name, "sort_order": g.sort_order, "tag_count": counts.get(g.name, 0)}
        for g in groups
    ]


@router.post("/tag-groups", status_code=201)
async def create_tag_group(data: TagGroupCreate, session: AsyncSession = Depends(get_session)) -> dict:
    g = await crud.create_tag_group(session, data.name)
    return {"id": g.id, "name": g.name, "sort_order": g.sort_order, "tag_count": 0}


async def _group_or_404(session: AsyncSession, group_id: int) -> TagGroup:
    g = await session.get(TagGroup, group_id)
    if not g:
        raise HTTPException(status_code=404, detail="分组不存在")
    return g


@router.patch("/tag-groups/{group_id}")
async def rename_tag_group(
    group_id: int,
    data: TagGroupRename,
    session: AsyncSession = Depends(get_session),
) -> dict:
    g = await _group_or_404(session, group_id)
    g = await crud.rename_tag_group(session, g, data.name)
    return {"id": g.id, "name": g.name, "sort_order": g.sort_order}


@router.delete("/tag-groups/{group_id}")
async def delete_tag_group(group_id: int, session: AsyncSession = Depends(get_session)) -> dict:
    g = await _group_or_404(session, group_id)
    moved = await crud.delete_tag_group(session, g)
    return {"ok": True, "moved_to_ungrouped": moved}


@router.post("/tag-groups/{group_id}/move")
async def move_tag_group(
    group_id: int,
    dir: str = Query(..., pattern="^(up|down)$"),
    session: AsyncSession = Depends(get_session),
) -> dict:
    g = await _group_or_404(session, group_id)
    await crud.move_tag_group(session, g, dir)
    return {"ok": True}
