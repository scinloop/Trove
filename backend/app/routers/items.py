"""Item CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud
from app.database import get_session
from app.schemas import ItemCreate, ItemDetail, ItemOut, ItemUpdate

router = APIRouter(tags=["items"])


class ItemListOut(BaseModel):
    total: int
    items: list[ItemOut]


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
    updated = await crud.update_item(session, item, data)
    return ItemOut.model_validate(updated)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: int, session: AsyncSession = Depends(get_session)) -> Response:
    item = await crud.get_item(session, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="item not found")
    await crud.delete_item(session, item)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
