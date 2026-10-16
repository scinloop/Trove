"""Item CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud
from app.config import settings
from app.database import get_session
from app.routers import bangumi
from app.schemas import ItemCreate, ItemDetail, ItemOut, ItemUpdate

router = APIRouter(tags=["items"])


class ItemListOut(BaseModel):
    total: int
    items: list[ItemOut]


class SyncResult(BaseModel):
    """写回结果：更新后的条目 + 本次同步的细节（前端据此提示）。"""

    item: ItemDetail
    synced: dict


@router.get("/items", response_model=ItemListOut)
async def list_items(
    category: str | None = None,
    sub: str | None = None,
    q: str | None = None,
    sort: str = Query(default="recent", pattern="^(recent|rating|title)$"),
    favorite: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=60, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> ItemListOut:
    """分页列表：page/page_size，返回 {total, items}；page_size=200 为上限。"""
    total, items = await crud.list_items(
        session, category=category, sub=sub, q=q, sort=sort, favorite=favorite,
        limit=page_size, offset=(page - 1) * page_size,
    )
    return ItemListOut(total=total, items=[ItemOut.model_validate(i) for i in items])


@router.post("/items", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
async def create_item(data: ItemCreate, session: AsyncSession = Depends(get_session)) -> ItemOut:
    item = await crud.create_item(session, data)
    if item.bgm_id:  # 绑定了 Bangumi 条目 → 同步刮削档案与封面（失败不影响保存）
        await bangumi.apply_scrape(session, item)
    return ItemOut.model_validate(item)


@router.get("/items/{item_id}", response_model=ItemDetail)
async def get_item(item_id: int, session: AsyncSession = Depends(get_session)) -> ItemDetail:
    item = await crud.get_item(session, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="item not found")
    return ItemDetail.model_validate(item)


@router.patch("/items/{item_id}", response_model=ItemOut)
async def update_item(item_id: int, data: ItemUpdate, session: AsyncSession = Depends(get_session)) -> ItemOut:
    item = await crud.get_item(session, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="item not found")
    prev_bgm_id = item.bgm_id
    updated = await crud.update_item(session, item, data)
    # 新绑定或首次刮削时才抓取（避免每次编辑都请求 Bangumi）
    if updated.bgm_id and (updated.bgm_id != prev_bgm_id or not updated.bangumi):
        await bangumi.apply_scrape(session, updated)
    return ItemOut.model_validate(updated)


@router.post("/items/{item_id}/scrape", response_model=ItemDetail)
async def rescrape_item(
    item_id: int,
    with_extras: bool = Query(default=True, description="同时抓取角色阵容/关联条目/剧集"),
    session: AsyncSession = Depends(get_session),
) -> ItemDetail:
    """重新刮削：刷新快照（Bangumi 数据更新或换绑条目后手动触发）。"""
    item = await crud.get_item(session, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="item not found")
    if not item.bgm_id:
        raise HTTPException(status_code=422, detail="该条目未绑定 Bangumi 条目")
    ok = await bangumi.apply_scrape(session, item, with_extras=with_extras)
    if not ok:
        raise HTTPException(status_code=502, detail="刮削失败：Bangumi 不可达或条目不存在")
    return ItemDetail.model_validate(item)


@router.post("/items/{item_id}/sync", response_model=SyncResult)
async def sync_item(item_id: int, session: AsyncSession = Depends(get_session)) -> SyncResult:
    """把本地收藏写回 Bangumi。

    - 作品条目：进度状态（想/在/已 → 想看/在看/看过）、评分（5 星 → 10 分）、标签、短评
    - 书籍（漫画/小说）：另写话数 / 卷数进度
    - 动画：把「看到第 N 集」写回为逐集已看
    - 角色条目：写角色收藏标记
    """
    item = await crud.get_item(session, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="item not found")
    if not item.bgm_id:
        raise HTTPException(status_code=422, detail="该条目未绑定 Bangumi 条目")
    if not settings.bgm_configured:
        raise HTTPException(status_code=401, detail="未配置 Bangumi 访问令牌（backend/.env 的 BGM_TOKEN）")

    synced = await bangumi.sync_collection(item)
    if (
        item.ep_progress
        and item.bgm_type != bangumi.TYPE_CHARACTER
        and item.category not in bangumi.BOOK_CATEGORIES
    ):
        synced["episodes"] = await bangumi.sync_episode_progress(item, item.ep_progress)
    return SyncResult(item=ItemDetail.model_validate(item), synced=synced)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: int, session: AsyncSession = Depends(get_session)) -> Response:
    item = await crud.get_item(session, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="item not found")
    await crud.delete_item(session, item)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
