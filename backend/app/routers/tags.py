"""Tag library endpoints: picker source + management with usage counts."""
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud
from app.database import get_session
from app.models import Tag
from app.schemas import TagCreate, TagUpdate

router = APIRouter(prefix="/tags", tags=["tags"])


async def _get_or_404(session: AsyncSession, tag_id: int) -> Tag:
    tag = await session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="tag not found")
    return tag


@router.get("")
async def list_tags(session: AsyncSession = Depends(get_session)) -> list[dict]:
    return await crud.list_tags(session)


@router.post("")
async def create_tag(data: TagCreate, response: Response, session: AsyncSession = Depends(get_session)) -> dict:
    tag, created = await crud.create_tag(session, data.label, data.group)
    response.status_code = 201 if created else 200
    return {"id": tag.id, "label": tag.label, "group": tag.group, "color": tag.color}


@router.patch("/{tag_id}")
async def rename_tag(
    tag_id: int,
    data: TagUpdate,
    session: AsyncSession = Depends(get_session),
) -> dict:
    tag = await _get_or_404(session, tag_id)
    tag = await crud.rename_tag(session, tag, data.label, data.group)
    return {"id": tag.id, "label": tag.label, "group": tag.group, "color": tag.color}


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(tag_id: int, session: AsyncSession = Depends(get_session)) -> None:
    tag = await _get_or_404(session, tag_id)
    await crud.delete_tag(session, tag)
